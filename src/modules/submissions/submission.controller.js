import fs from "fs/promises";
import * as submissionService from "./submission.service.js";
import {
  buildPaginationMeta,
  sendCreated,
  sendSuccess,
} from "../../utils/apiResponse.js";
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
    liveUrl: req.body.liveUrl,
  });
  return sendCreated(res, {
    id: submission.id,
    title: submission.title,
    status: submission.status,
  });
};

export const listSubmissions = async (req, res) => {
  const { page, limit } = req.query;
  const { items, total } = await submissionService.listSubmissions(req.query);
  return sendSuccess(res, { submissions: items }, {
    meta: buildPaginationMeta({ page, limit, total }),
  });
};

export const listMySubmissions = async (req, res) => {
  const { page, limit } = req.query;
  const { items, total } = await submissionService.listSubmissions({
    ...req.query,
    contestant: req.user.id,
  });
  return sendSuccess(res, { submissions: items }, {
    meta: buildPaginationMeta({ page, limit, total }),
  });
};

export const getSubmission = async (req, res) => {
  const submission = await submissionService.getSubmissionForViewer(req.params.submissionId, req.user);
  return sendSuccess(res, { submission });
};

export const updateSubmission = async (req, res) => {
  const submission = await submissionService.updateSubmission(
    req.params.submissionId,
    req.user.id,
    req.body,
  );
  return sendSuccess(res, { submission });
};

export const updateSubmissionStatus = async (req, res) => {
  const submission = await submissionService.updateSubmissionStatus(
    req.params.submissionId,
    req.body.status,
  );
  return sendSuccess(res, { submission });
};

// GET /:submissionId/download
export const downloadSubmissionFile = async (req, res) => {
  const { submissionId } = req.params;

  await submissionService.getSubmissionForViewer(submissionId, req.user);
  const file = await submissionService.getLatestUploadedFile(submissionId);

  const safeFileName = file.originalFileName || "project.zip";
  res.setHeader("Content-Type", "application/zip");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${encodeURIComponent(safeFileName)}"`,
  );

  return res.sendFile(file.storagePath);
};

// GET /:submissionId/structure
export const getProjectStructure = async (req, res) => {
  const { submissionId } = req.params;
  const structure = await submissionService.getSubmissionProjectStructure(
    submissionId,
    req.user,
  );
  return sendSuccess(res, { projectStructure: structure });
};

// GET /:submissionId/files/*
export const getFileContent = async (req, res) => {
  const { submissionId } = req.params;
  // The file path comes as a wildcard param (everything after /files/)
  const filePath = req.params[0];

  if (!filePath) {
    throw ApiError.badRequest("File path is required");
  }

  const result = await submissionService.getSubmissionFileContent(
    submissionId,
    filePath,
    req.user,
  );
  return sendSuccess(res, result);
};