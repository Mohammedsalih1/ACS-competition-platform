/**
 * file.controller.js — Route handlers for the File & Code Viewer.
 */
import * as fileService from './file.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';

export const getProjectFiles = async (req, res) => {
  const { submissionId } = req.params;
  const result = await fileService.getProjectFiles(submissionId, req.user);
  return sendSuccess(res, result);
};

export const getFolderContents = async (req, res) => {
  const { submissionId } = req.params;
  const { path: folderPath } = req.query;
  const result = await fileService.getFolderContents(submissionId, folderPath, req.user);
  return sendSuccess(res, result);
};

export const getFileInfo = async (req, res) => {
  const { submissionId } = req.params;
  const { path: filePath } = req.query;
  const result = await fileService.getFileInfo(submissionId, filePath, req.user);
  return sendSuccess(res, result);
};

export const getFileContent = async (req, res) => {
  const { submissionId } = req.params;
  const { path: filePath } = req.query;
  const result = await fileService.getFileContent(submissionId, filePath, req.user);
  return sendSuccess(res, result);
};
