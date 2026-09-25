import * as judgingService from './judging.service.js';
import { sendCreated, sendSuccess } from '../../utils/apiResponse.js';

// ── Criteria ────────────────────────────────────────────────────────

export const listCriteria = async (req, res) => {
  const activeOnly = req.user.role !== 'admin';
  const criteria = await judgingService.listCriteria({ activeOnly });
  return sendSuccess(res, { criteria });
};

export const createCriterion = async (req, res) => {
  const criterion = await judgingService.createCriterion(req.body, req.user.id);
  return sendCreated(res, { criterion });
};

export const updateCriterion = async (req, res) => {
  const criterion = await judgingService.updateCriterion(req.params.criterionId, req.body);
  return sendSuccess(res, { criterion });
};

export const deleteCriterion = async (req, res) => {
  await judgingService.deleteCriterion(req.params.criterionId);
  return sendSuccess(res, { message: 'Criterion deleted' });
};

// ── Assignments ─────────────────────────────────────────────────────

export const assignJudge = async (req, res) => {
  const assignment = await judgingService.assignJudge(
    req.body.judgeId,
    req.body.submissionId,
    req.user.id,
  );
  return sendCreated(res, { assignment });
};

export const bulkAssign = async (req, res) => {
  const result = await judgingService.bulkAssignJudge(
    req.body.judgeId,
    req.body.submissionIds,
    req.user.id,
  );
  return sendCreated(res, result);
};

export const removeAssignment = async (req, res) => {
  await judgingService.removeAssignment(req.body.judgeId, req.body.submissionId);
  return sendSuccess(res, { message: 'Assignment removed' });
};

export const getMyAssignments = async (req, res) => {
  const assignments = await judgingService.getMyAssignments(req.user.id);
  return sendSuccess(res, { assignments });
};

export const listAssignments = async (req, res) => {
  const assignments = await judgingService.listAssignments(req.query);
  return sendSuccess(res, { assignments });
};

// ── Evaluations ─────────────────────────────────────────────────────

export const submitEvaluation = async (req, res) => {
  const evaluation = await judgingService.submitEvaluation(
    req.user.id,
    req.params.submissionId,
    req.body,
  );
  return sendCreated(res, { evaluation });
};

export const getMyEvaluation = async (req, res) => {
  const evaluation = await judgingService.getMyEvaluation(
    req.user.id,
    req.params.submissionId,
  );
  return sendSuccess(res, { evaluation });
};

export const getEvaluationsForSubmission = async (req, res) => {
  const result = await judgingService.getEvaluationsForSubmission(req.params.submissionId);
  return sendSuccess(res, result);
};
