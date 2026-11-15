import AdmZip from "adm-zip";
import fs from "fs/promises";
import path from "path";
import ApiError from "../../utils/ApiError.js";
import { ERROR_CODES } from "../../constants/errorCodes.js";
import Submission, { SUBMISSION_STATUS } from "../../models/submission.model.js";
import File, { UPLOAD_STATUS } from "../../models/file.model.js";
import ProjectStructure from "../../models/projectStructure.model.js";
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
import {
  cleanupSubmissionFiles,
  removeFileFromDisk,
  removeExtractedDir,
} from "../../utils/fileCleanup.js";
import { logger } from "../../utils/logger.js";
import {
  isR2Configured,
  uploadFileToR2,
  deleteFileFromR2,
} from "../../services/r2.service.js";
import Evaluation from "../../models/evaluation.model.js";
import CompetitionSetting from "../../models/competitionSetting.model.js";
import { ROLES } from "../../constants/roles.js";
import { User } from "../../models/user.model.js";
import { ProjectStageParticipation } from '../../models/competitionStage.model.js';
import { assignUnassignedSubmissionsToSoleOpenStage } from '../stages/stages.service.js';

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
  return Submission.create({ contestant, title, description, liveUrl: liveUrl || '' });
};

const submissionView = (query) => query
  .populate('contestant', 'name email role')
  .populate({ path: 'stageParticipation', populate: { path: 'stage', select: 'name order status' } })
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
  const isAdmin = user.role === ROLES.ADMIN;
  const isEligibleJudge = user.role === ROLES.JUDGE
    && submission.status !== SUBMISSION_STATUS.DRAFT
    && submission.files.length > 0;
  const canReview = isAdmin || isEligibleJudge;
  if (!isOwner && !canReview) throw ApiError.forbidden('You do not have access to this submission');
  return submission;
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const listSubmissions = async ({ page, limit, status, sort, contestant, search, hasAttachment, stage }) => {
  const filter = {};
  if (status) filter.status = status;
  if (contestant) filter.contestant = contestant;
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    const matchingContestants = await User.find({
      role: ROLES.CONTESTANT,
      $or: [{ name: pattern }, { email: pattern }],
    }).distinct('_id');
    filter.$or = [{ title: pattern }, { contestant: { $in: matchingContestants } }];
  }
  if (hasAttachment !== undefined) filter['files.0'] = hasAttachment ? { $exists: true } : { $exists: false };
  if (stage) filter.stageParticipation = { $in: await ProjectStageParticipation.find({ stage, active: true }).distinct('_id') };

  const [items, total] = await Promise.all([
    submissionView(Submission.find(filter))
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit),
    Submission.countDocuments(filter),
  ]);
  return { items, total };
};

export const listSubmissionsForUser = async (query, user) => {
  if (user.role === ROLES.JUDGE) {
    await assignUnassignedSubmissionsToSoleOpenStage();
    const stageFilter = { active: true, completedEvaluationCount: { $lt: 1000000 } };
    if (query.stage) stageFilter.stage = query.stage;
    const allParticipations = await ProjectStageParticipation.find(stageFilter).populate('stage', 'status requiredEvaluations name activeRubricVersion').lean();
    const eligibleParticipations = allParticipations.filter((item) => ['open', 'judging'].includes(item.stage?.status) && item.completedEvaluationCount < item.stage.requiredEvaluations);
    const participationIds = eligibleParticipations.map((item) => item._id);
    const submissionIds = eligibleParticipations.map((item) => item.submission);
    const filter = { _id: { $in: submissionIds }, status: { $in: [SUBMISSION_STATUS.SUBMITTED, SUBMISSION_STATUS.UNDER_REVIEW, SUBMISSION_STATUS.SCORED] }, 'files.0': { $exists: true } };
    if (query.status) filter.status = query.status;
    if (query.search) filter.title = new RegExp(escapeRegex(query.search), 'i');
    const [items, total] = await Promise.all([
      submissionView(Submission.find(filter))
        .sort(query.sort)
        .skip((query.page - 1) * query.limit)
        .limit(query.limit),
      Submission.countDocuments(filter),
    ]);
    const ids = items.map((item) => item._id);
    const bySubmission = new Map(eligibleParticipations.map((item) => [String(item.submission), item]));
    const selectedParticipationIds = items.map((item) => bySubmission.get(String(item._id))?._id).filter(Boolean);
    const activeVersionByParticipation = new Map(eligibleParticipations.map((item) => [String(item._id), item.stage.activeRubricVersion]));
    const mine = await Evaluation.find({ judge: user.id, participation: { $in: selectedParticipationIds } }).select('participation rubricVersion status').lean();
    const mineMap = new Map(mine.filter((evaluation) => evaluation.rubricVersion === activeVersionByParticipation.get(String(evaluation.participation))).map((evaluation) => [String(evaluation.participation), evaluation.status || 'submitted']));
    return {
      items: items.map((item) => { const participation = bySubmission.get(String(item._id)); return { ...item.toJSON(), requiredEvaluations: participation?.stage?.requiredEvaluations || 3, stageName: participation?.stage?.name, stageId: participation?.stage?._id, completedEvaluationCount: participation?.completedEvaluationCount || 0, myEvaluationStatus: mineMap.get(String(participation?._id)) || 'not_started' }; }),
      total,
    };
  }

  const result = await listSubmissions(query);
  if (user.role !== ROLES.ADMIN || result.items.length === 0) return result;

  const submissionIds = result.items.map((item) => item._id);
  const [settings, evaluationCounts] = await Promise.all([
    CompetitionSetting.findOne({ key: 'judging' }).lean(),
    Evaluation.aggregate([
      { $match: { submission: { $in: submissionIds }, $or: [{ status: 'submitted' }, { status: { $exists: false } }] } },
      { $group: { _id: '$submission', count: { $sum: 1 } } },
    ]),
  ]);
  const counts = new Map(evaluationCounts.map((entry) => [String(entry._id), entry.count]));
  return {
    ...result,
    items: result.items.map((item) => ({
      ...item.toJSON(),
      evaluationCount: counts.get(String(item._id)) || 0,
      requiredEvaluations: settings?.requiredEvaluations || 3,
      hasAttachment: item.files.length > 0,
    })),
  };
};

export const updateSubmission = async (submissionId, contestantId, updates) => {
  const submission = await Submission.findOne({ _id: submissionId, contestant: contestantId });
  if (!submission) throw ApiError.forbidden('You do not own this submission');
  if (![SUBMISSION_STATUS.DRAFT, SUBMISSION_STATUS.SUBMITTED].includes(submission.status)) {
    throw ApiError.conflict('This submission can no longer be edited');
  }
  if (submission.completedEvaluationCount > 0) throw ApiError.conflict('This submission cannot be edited after judging has started');
  Object.assign(submission, updates);
  await submission.save();
  return getSubmissionById(submissionId);
};

export const updateSubmissionStatus = async (submissionId, status, actor) => {
  if (actor.role === ROLES.JUDGE) throw ApiError.forbidden('Judges cannot directly change project status');
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

// ── Re-upload cleanup ───────────────────────────────────────────────

/** Mark previous active files as REPLACED and clean up disk artifacts. */
async function replacePreviousFiles(submission) {
  const previousFiles = await File.find({
    submission: submission._id,
    status: { $in: [UPLOAD_STATUS.UPLOADED, UPLOAD_STATUS.EXTRACTED] },
  }).select("+storagePath +storageKey +storageType +extractedPath");

  for (const oldFile of previousFiles) {
    if (oldFile.storageKey) {
      await deleteFileFromR2(oldFile.storageKey).catch((err) =>
        logger.warn(`[re-upload] Failed to remove old R2 file: ${err.message}`),
      );
    }

    if (oldFile.storagePath) {
      await removeFileFromDisk(oldFile.storagePath).catch((err) =>
        logger.warn(`[re-upload] Failed to remove old ZIP: ${err.message}`),
      );
    }

    if (oldFile.extractedPath) {
      await removeExtractedDir(oldFile.extractedPath).catch((err) =>
        logger.warn(`[re-upload] Failed to remove old extraction: ${err.message}`),
      );
    }

    oldFile.status = UPLOAD_STATUS.REPLACED;
    await oldFile.save();
    logger.info(`[re-upload] Marked file ${oldFile._id} as replaced`);
  }

  // Remove previous File IDs from the submission's files array
  if (previousFiles.length > 0) {
    const replacedIds = new Set(previousFiles.map((f) => String(f._id)));
    submission.files = submission.files.filter(
      (fId) => !replacedIds.has(String(fId)),
    );
  }
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
  if (![SUBMISSION_STATUS.DRAFT, SUBMISSION_STATUS.SUBMITTED].includes(submission.status)) {
    throw ApiError.conflict('Files cannot be changed after review has started');
  }
  if (submission.completedEvaluationCount > 0) throw ApiError.conflict('Files cannot be changed after judging has started');
  // Clean up previous uploads on re-upload
  await replacePreviousFiles(submission);

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

    if (isR2Configured()) {
      const r2Key = `submissions/${submission._id}/${file._id}.zip`;
      await uploadFileToR2({
        key: r2Key,
        filePath: finalFilePath,
        mimeType,
      });
      file.storageKey = r2Key;
      file.storageType = "r2";
    }

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
    .select("+storagePath +storageKey +storageType +extractedPath");

  if (!file) {
    throw ApiError.notFound("No file uploaded for this submission yet");
  }
  return file;
};

// ── Delete submission files ─────────────────────────────────────────

/** Delete all uploaded files for a submission and revert to draft. */
export const deleteSubmissionFiles = async (submissionId, contestantId) => {
  const submission = await verifyOwnership(submissionId, contestantId);
  if (![SUBMISSION_STATUS.DRAFT, SUBMISSION_STATUS.SUBMITTED].includes(submission.status)) {
    throw ApiError.conflict('Files cannot be changed after review has started');
  }
  if (submission.completedEvaluationCount > 0) throw ApiError.conflict('Files cannot be changed after judging has started');

  const files = await File.find({ submission: submission._id }).select("+storageKey");
  for (const f of files) {
    if (f.storageKey) await deleteFileFromR2(f.storageKey).catch(() => {});
  }

  // Mark all files as replaced
  await replacePreviousFiles(submission);

  // Remove project structure
  await ProjectStructure.deleteMany({ submission: submission._id });

  // Clean up entire submission directory on disk
  await cleanupSubmissionFiles(submissionId);

  // Revert submission to draft
  submission.files = [];
  submission.status = SUBMISSION_STATUS.DRAFT;
  submission.submittedAt = null;
  await submission.save();

  logger.info(`[files] Deleted all files for submission ${submissionId}`);

  return getSubmissionById(submissionId);
};

/** Cascade-delete a submission and all associated data (admin). */
export const deleteSubmission = async (submissionId) => {
  const files = await File.find({ submission: submissionId }).select("+storageKey");
  for (const f of files) {
    if (f.storageKey) await deleteFileFromR2(f.storageKey).catch(() => {});
  }

  // Clean up files on disk
  await cleanupSubmissionFiles(submissionId);

  // Clean up DB records
  await File.deleteMany({ submission: submissionId });
  await ProjectStructure.deleteMany({ submission: submissionId });
  await Submission.findByIdAndDelete(submissionId);

  logger.info(`[submissions] Cascade-deleted submission ${submissionId}`);
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
