import * as service from './judging.service.js';
import { sendCreated, sendSuccess } from '../../utils/apiResponse.js';

export const listCriteria = async (req, res) => sendSuccess(res, { criteria: await service.listCriteria({ activeOnly: req.user.role !== 'admin' }) });
export const createCriterion = async (req, res) => sendCreated(res, { criterion: await service.createCriterion(req.body, req.user.id) });
export const updateCriterion = async (req, res) => sendSuccess(res, { criterion: await service.updateCriterion(req.params.criterionId, req.body) });
export const deleteCriterion = async (req, res) => { await service.deleteCriterion(req.params.criterionId); return sendSuccess(res, { message: 'Criterion deleted' }); };
export const getSettings = async (_req, res) => sendSuccess(res, { settings: await service.getSettings() });
export const updateSettings = async (req, res) => sendSuccess(res, { settings: await service.updateSettings(req.body.requiredEvaluations, req.body.reason, req.user.id) });
export const getDashboard = async (req, res) => sendSuccess(res, { dashboard: await service.getDashboard(req.user.id) });
export const listMyEvaluations = async (req, res) => sendSuccess(res, { evaluations: await service.listMyEvaluations(req.user.id, req.query.status) });
export const saveDraft = async (req, res) => sendSuccess(res, { evaluation: await service.saveDraft(req.user.id, req.params.submissionId, req.body) });
export const submitEvaluation = async (req, res) => sendCreated(res, { evaluation: await service.submitEvaluation(req.user.id, req.params.submissionId, req.body) });
export const getMyEvaluation = async (req, res) => sendSuccess(res, { evaluation: await service.getMyEvaluation(req.user.id, req.params.submissionId) });
export const getEvaluationConfig = async (req, res) => sendSuccess(res, { configuration: await service.getEvaluationConfig(req.params.submissionId) });
export const getEvaluationsForSubmission = async (req, res) => sendSuccess(res, await service.getEvaluationsForSubmission(req.params.submissionId));
export const approveEvaluationResult = async (req, res) => sendSuccess(res, { submission: await service.approveEvaluationResult(req.params.submissionId, req.user.id) });
