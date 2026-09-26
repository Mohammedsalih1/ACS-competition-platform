import * as resultsService from './results.service.js';
import { buildPaginationMeta, sendSuccess } from '../../utils/apiResponse.js';

export const getStatus = async (req, res) => {
  const state = await resultsService.getPublicationState();
  return sendSuccess(res, state);
};

export const setPublished = async (req, res) => {
  const state = await resultsService.setPublished(req.body.published, req.user.id);
  return sendSuccess(res, state);
};

export const getLeaderboard = async (req, res) => {
  const { page, limit } = req.query;
  const { results, maxScore, total } = await resultsService.getLeaderboard(req.user, { page, limit });
  return sendSuccess(res, { results, maxScore }, { meta: buildPaginationMeta({ page, limit, total }) });
};

export const getMyResults = async (req, res) => {
  const results = await resultsService.getMyResults(req.user);
  return sendSuccess(res, { results });
};

export const getProjectResult = async (req, res) => {
  const result = await resultsService.getProjectResult(req.user, req.params.submissionId);
  return sendSuccess(res, { result });
};

export const getStats = async (req, res) => {
  const stats = await resultsService.getStats();
  return sendSuccess(res, { stats });
};
