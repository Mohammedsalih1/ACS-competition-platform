import AdmZip from "adm-zip";
import fs from "fs/promises";
import path from "path";
import ApiError from "../../utils/ApiError.js";
import { ERROR_CODES } from "../../constants/errorCodes.js";
import Submission, { SUBMISSION_STATUS } from "../../models/submission.model.js";
import File, { UPLOAD_STATUS } from "../../models/file.model.js";
import {
  SUBMISSIONS_DIR,
  ZIP_MAGIC_BYTES,
} from "../../config/storage.config.js";
import {
  extractAndProcess,
  getProjectStructure as fetchProjectStructure,
  getFileContent as fetchFileContent,
  buildNestedTree,
} from "./extraction.service.js";

// ── Helpers ─────────────────────────────────────────────────────────

async function verifyMagicBytes(filePath) {
  let fh;
  try {
    fh = await fs.open(filePath, "r");
    const buffer = Buffer.alloc(4);
    await fh.read(buffer, 0, 4, 0);
    return ZIP_MAGIC_BYTES.every((b, i) => b === buffer[i]);
  } finally {
    await fh?.close();
  }
}

export const createSubmission = async ({ contestant, title, description, liveUrl }) => {
  return Submission.create({ contestant, title, description, liveUrl });
};

const submissionView = (query) => query
  .populate('contestant', 'name email role')
  .populate('files', 'originalFileName fileSize mimeType status createdAt')
  .select('-__v');

export const getSubmissionById = async (submissionId) => {
  const submission = await submissionView(Submission.findById(submissionId));
  if (!submission) throw ApiError.notFound('Submission not found');
  return submission;
};

export const getSubmissionForViewer = async (submissionId, user) => {
  const submission = await getSubmissionById(submissionId);
  const isOwner = String(submission.contestant?._id) === String(user.id);
  const canReview = ['judge', 'admin'].includes(user.role);
  if (!isOwner && !canReview) throw ApiError.forbidden('You do not have access to this submission');
  return submission;
};

export const listSubmissions = async ({ page, limit, status, sort, contestant }) => {
  const filter = {};
  if (status) filter.status = status;
  if (contestant) filter.contestant = contestant;

  const [items, total] = await Promise.all([
    submissionView(Submission.find(filter))
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit),
    Submission.countDocuments(filter),
  ]);
  return { items, total };
};

export const updateSubmission = async (submissionId, contestantId, updates) => {
  const submission = await Submission.findOne({ _id: submissionId, contestant: contestantId });
  if (!submission) throw ApiError.forbidden('You do not own this submission');
  Object.assign(submission, updates);
  await submission.save();
  return getSubmissionById(submissionId);
};

export const updateSubmissionStatus = async (submissionId, status) => {
  const submission = await Submission.findByIdAndUpdate(
    submissionId,
    { status, ...(status === SUBMISSION_STATUS.SUBMITTED && { submittedAt: new Date() }) },
    { new: true, runValidators: true },
  );
  if (!submission) throw ApiError.notFound('Submission not found');
  return getSubmissionById(submissionId);
};

async function safeMove(src, dest) {
  try {
    await fs.rename(src, dest);
  } catch (err) {
    if (err.code === "EXDEV") {
      await fs.copyFile(src, dest);
      await fs.unlink(src);
    } else {
      throw err;
    }
  }
}

async function cleanupTemp(filePath) {
  try {
    await fs.unlink(filePath);
  } catch {
    // already deleted
  }
}

function storageError(err) {
  const unavailable = ["EACCES", "EROFS", "ENOSPC", "EPERM"];
  if (unavailable.includes(err.code)) {
    return new ApiError(503, ERROR_CODES.STORAGE_UNAVAILABLE, "Storage unavailable");
  }
  return ApiError.internal("Failed to store file");
}

// ── Public API ──────────────────────────────────────────────────────

// Ownership check — throws if the submission doesn't exist or isn't the caller's.
export const verifyOwnership = async (submissionId, contestantId) => {
  const submission = await Submission.findOne({
    _id: submissionId,
    contestant: contestantId,
  });
  if (!submission) {
    throw ApiError.forbidden("You do not own this submission");
  }
  return submission;
};

// Validates the ZIP, moves it into permanent storage, and creates the File
// record. Returns the populated File doc. Marks the File as FAILED (rather
// than deleting it) if validation/storage fails after it was created, so
// failed attempts stay visible instead of vanishing silently.
export const uploadZipForSubmission = async ({
  submission,
  tempFilePath,
  originalFileName,
  mimeType,
}) => {
  const file = await File.create({
    submission: submission._id,
    status: UPLOAD_STATUS.PENDING,
  });

  try {
    const isZip = await verifyMagicBytes(tempFilePath);
    if (!isZip) {
      await cleanupTemp(tempFilePath);
      throw new ApiError(
        415,
        ERROR_CODES.UNSUPPORTED_FILE_TYPE,
        "File is not a valid ZIP archive",
      );
    }

    // AdmZip parses lazily: the constructor accepts a truncated or scrambled
    // archive and only throws once the central directory is actually read, so
    // getEntries() has to sit inside the same guard or a corrupt upload escapes
    // as an unhandled 500 instead of a 400.
    let zipEntries;
    try {
      zipEntries = new AdmZip(tempFilePath).getEntries();
    } catch {
      await cleanupTemp(tempFilePath);
      throw ApiError.badRequest(
        "Corrupt or unreadable ZIP archive",
        ERROR_CODES.CORRUPT_ARCHIVE,
      );
    }

    if (!zipEntries || zipEntries.length === 0) {
      await cleanupTemp(tempFilePath);
      throw ApiError.badRequest(
        "ZIP archive is empty",
        ERROR_CODES.CORRUPT_ARCHIVE,
      );
    }

    const finalDir = path.join(SUBMISSIONS_DIR, String(submission._id));
    try {
      await fs.mkdir(finalDir, { recursive: true });
    } catch (err) {
      await cleanupTemp(tempFilePath);
      throw storageError(err);
    }

    // File's own _id is the on-disk identifier — no separate uuid needed.
    const finalFilePath = path.join(finalDir, `${file._id}.zip`);
    try {
      await safeMove(tempFilePath, finalFilePath);
    } catch (err) {
      await cleanupTemp(tempFilePath);
      throw storageError(err);
    }

    const stats = await fs.stat(finalFilePath);

    file.originalFileName = originalFileName;
    file.fileSize = stats.size;
    file.mimeType = mimeType;
    file.storagePath = finalFilePath;
    file.status = UPLOAD_STATUS.UPLOADED;
    await file.save();

    submission.files.push(file._id);
    if (submission.status === SUBMISSION_STATUS.DRAFT) {
      submission.status = SUBMISSION_STATUS.SUBMITTED;
      submission.submittedAt = new Date();
    }
    await submission.save();

    // ── Phase 2: extract ZIP and build project structure ──────────
    // Runs synchronously so the upload response includes extraction
    // status. For very large archives a future iteration could defer
    // this to a background job.
    try {
      await extractAndProcess(file, submission);
    } catch (extractionError) {
      // Extraction failure is non-fatal for the upload itself — the ZIP
      // is stored successfully, extraction can be retried.
      // The error is already persisted in ProjectStructure.error.
    }

    return file;
  } catch (error) {
    file.status = UPLOAD_STATUS.FAILED;
    await file.save().catch(() => {});
    // Only OUR errors are already shaped for the client. A raw fs/mongo error
    // also carries a `.code` (ENOENT, EACCES...), so testing for that alone let
    // internals through unmapped and skipped the temp-file cleanup below.
    if (error instanceof ApiError) throw error;
    await cleanupTemp(tempFilePath);
    throw ApiError.internal("File processing failed");
  }
};

// Returns the most recent successfully uploaded file for a submission.
export const getLatestUploadedFile = async (submissionId) => {
  const file = await File.findOne({
    submission: submissionId,
    status: { $in: [UPLOAD_STATUS.UPLOADED, UPLOAD_STATUS.EXTRACTED] },
  })
    .sort({ createdAt: -1 })
    .select("+storagePath +extractedPath");

  if (!file) {
    throw ApiError.notFound("No file uploaded for this submission yet");
  }
  return file;
};

// ── Project structure helpers (delegate to extraction service) ──────

export const getSubmissionProjectStructure = async (submissionId, user) => {
  await getSubmissionForViewer(submissionId, user);
  const structure = await fetchProjectStructure(submissionId);
  return {
    ...structure.toJSON(),
    tree: buildNestedTree(structure.tree),
  };
};

export const getSubmissionFileContent = async (submissionId, filePath, user) => {
  await getSubmissionForViewer(submissionId, user);
  return fetchFileContent(submissionId, filePath);
};