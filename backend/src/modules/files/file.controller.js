/**
 * file.controller.js — Route handlers for the File & Code Viewer.
 *
 * Each handler extracts the validated params/query, delegates to the service
 * layer, and sends a standardised JSON response via apiResponse helpers.
 */
import * as fileService from './file.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';

// GET /files/:submissionId
export const getProjectFiles = async (req, res) => {
  const { submissionId } = req.params;
  const result = await fileService.getProjectFiles(submissionId, req.user);
  return sendSuccess(res, result);
};

// GET /files/:submissionId/folder?path=...
export const getFolderContents = async (req, res) => {
  const { submissionId } = req.params;
  const { path: folderPath } = req.query;
  const result = await fileService.getFolderContents(submissionId, folderPath, req.user);
  return sendSuccess(res, result);
};

// GET /files/:submissionId/info?path=...
export const getFileInfo = async (req, res) => {
  const { submissionId } = req.params;
  const { path: filePath } = req.query;
  const result = await fileService.getFileInfo(submissionId, filePath, req.user);
  return sendSuccess(res, result);
};

// GET /files/:submissionId/content?path=...
export const getFileContent = async (req, res) => {
  const { submissionId } = req.params;
  const { path: filePath } = req.query;
  const result = await fileService.getFileContent(submissionId, filePath, req.user);
  return sendSuccess(res, result);
};
