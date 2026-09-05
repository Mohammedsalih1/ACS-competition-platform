import fs from "fs/promises";
import * as submissionService from "./submission.service.js";
import ApiError from "../../utils/ApiError.js";
import { sendCreated, sendSuccess } from "../../utils/apiResponse.js";

// POST /:submissionId/upload
export const uploadSubmissionFile = async (req, res) => {
  if (!req.file) {
    throw ApiError.badRequest("Project file is required", "FILE_REQUIRED");
  }

  const userId = req.user.id;
  const { submissionId } = req.params;

  let submission;
  let fileMetadata;

  try {
    // Verify ownership (service layer, per §7 rule 6)
    submission = await submissionService.verifyOwnership(submissionId, userId);

    // Validate & store the ZIP
    fileMetadata = await submissionService.processAndStoreZip(
      req.file.path,
      submissionId,
    );
  } catch (err) {
    // Clean up temp file on any failure
    await fs.unlink(req.file.path).catch(() => {});
    throw err;
  }

  // Update submission record
  submission.fileId = fileMetadata.fileId;
  submission.originalFileName = req.file.originalname;
  submission.fileSize = fileMetadata.fileSize;
  submission.mimeType = "application/zip";
  submission.storagePath = fileMetadata.storagePath;
  submission.status = "SUBMITTED";
  await submission.save();

  // Return only safe metadata — no internal paths
  return sendCreated(res, {
    fileId: fileMetadata.fileId,
    originalFileName: req.file.originalname,
  });
};

// GET /:submissionId/download
export const downloadSubmissionFile = async (req, res) => {
  const userId = req.user.id;
  const { submissionId } = req.params;

  const submission = await submissionService.verifyOwnership(
    submissionId,
    userId,
  );

  if (!submission.fileId) {
    throw ApiError.notFound("No file uploaded for this submission yet");
  }

  const filePath = await submissionService.getFilePath(
    submissionId,
    submission.fileId,
  );

  const safeFileName = submission.originalFileName || "project.zip";
  res.setHeader("Content-Type", "application/zip");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${encodeURIComponent(safeFileName)}"`,
  );

  return res.sendFile(filePath);
};
