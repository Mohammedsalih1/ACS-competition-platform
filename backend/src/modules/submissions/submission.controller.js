import fs from "fs/promises";
import * as submissionService from "./submission.service.js";
import { sendCreated } from "../../utils/apiResponse.js";
import ApiError from "../../utils/ApiError.js";
import { ERROR_CODES } from "../../constants/errorCodes.js";

// POST /:submissionId/upload
export const uploadSubmissionFile = async (req, res) => {
  if (!req.file) {
    throw ApiError.badRequest(
      "Project file is required",
      ERROR_CODES.FILE_REQUIRED,
    );
  }

  const contestantId = req.user.id;
  const { submissionId } = req.params;

  let file;
  try {
    const submission = await submissionService.verifyOwnership(submissionId, contestantId);

    file = await submissionService.uploadZipForSubmission({
      submission,
      tempFilePath: req.file.path,
      originalFileName: req.file.originalname,
      mimeType: "application/zip",
    });
  } catch (err) {
    await fs.unlink(req.file.path).catch(() => {});
    throw err;
  }

  return sendCreated(res, {
    fileId: file._id,
    originalFileName: file.originalFileName,
  });
};

export const createSubmission = async (req, res) => {
  const submission = await submissionService.createSubmission({
    contestant: req.user.id,
    title: req.body.title,
    description: req.body.description,
  });
  return sendCreated(res, {
    id: submission.id,
    title: submission.title,
    status: submission.status,
  });
};

// GET /:submissionId/download
export const downloadSubmissionFile = async (req, res) => {
  const contestantId = req.user.id;
  const { submissionId } = req.params;

  await submissionService.verifyOwnership(submissionId, contestantId);
  const file = await submissionService.getLatestUploadedFile(submissionId);

  const safeFileName = file.originalFileName || "project.zip";
  res.setHeader("Content-Type", "application/zip");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${encodeURIComponent(safeFileName)}"`,
  );

  return res.sendFile(file.storagePath);
};