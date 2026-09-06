import AdmZip from "adm-zip";
import fs from "fs/promises";
import path from "path";
import ApiError from "../../utils/ApiError.js";
import Submission, { SUBMISSION_STATUS } from "../../models/submission.model.js";
import File, { UPLOAD_STATUS } from "../../models/file.model.js";
import {
  SUBMISSIONS_DIR,
  ZIP_MAGIC_BYTES,
} from "../../config/storage.config.js";

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

export const createSubmission = async ({ contestant, title, description }) => {
  return Submission.create({ contestant, title, description });
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
    return new ApiError(503, "STORAGE_UNAVAILABLE", "Storage unavailable");
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
      throw new ApiError(415, "UNSUPPORTED_FILE_TYPE", "File is not a valid ZIP archive");
    }

    let zip;
    try {
      zip = new AdmZip(tempFilePath);
    } catch {
      await cleanupTemp(tempFilePath);
      throw ApiError.badRequest("Corrupt or unreadable ZIP archive", "CORRUPT_ARCHIVE");
    }

    const zipEntries = zip.getEntries();
    if (!zipEntries || zipEntries.length === 0) {
      await cleanupTemp(tempFilePath);
      throw ApiError.badRequest("ZIP archive is empty", "CORRUPT_ARCHIVE");
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

    return file;
  } catch (error) {
    file.status = UPLOAD_STATUS.FAILED;
    await file.save().catch(() => {});
    if (error.code) throw error; // known ApiError
    await cleanupTemp(tempFilePath);
    throw ApiError.internal("File processing failed");
  }
};

// Returns the most recent successfully uploaded file for a submission.
export const getLatestUploadedFile = async (submissionId) => {
  const file = await File.findOne({
    submission: submissionId,
    status: UPLOAD_STATUS.UPLOADED,
  })
    .sort({ createdAt: -1 })
    .select("+storagePath");

  if (!file) {
    throw ApiError.notFound("No file uploaded for this submission yet");
  }
  return file;
};