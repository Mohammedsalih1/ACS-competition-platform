import * as service from './stages.service.js';
import { CompetitionStage, ProjectStageParticipation } from '../../models/competitionStage.model.js';
import { sendCreated, sendSuccess } from '../../utils/apiResponse.js';
import ApiError from '../../utils/ApiError.js';

export const list = async (_req, res) => sendSuccess(res, { stages: await service.listStages() });
export const create = async (req, res) => {
  if (!req.body.name?.trim()) throw ApiError.badRequest('Stage name is required');
  return sendCreated(res, { stage: await service.createStage(req.body, req.user.id) });
};
export const update = async (req, res) => sendSuccess(res, { stage: await service.updateStage(req.params.stageId, req.body, req.user.id) });
export const updateRubric = async (req, res) => sendSuccess(res, await service.updateRubric(req.params.stageId, req.body, req.user.id));
export const assign = async (req, res) => {
  if (!Array.isArray(req.body.submissionIds) || !req.body.submissionIds.length) throw ApiError.badRequest('Choose at least one project');
  return sendSuccess(res, { participations: await service.assignProjects(req.params.stageId, req.body.submissionIds, req.user.id, req.body.reason || '') });
};
export const projects = async (req, res) => {
  const stage = await CompetitionStage.findById(req.params.stageId).lean();
  if (!stage) throw ApiError.notFound('Competition stage not found');
  const participations = await ProjectStageParticipation.find({ stage: stage._id, active: true }).populate({ path: 'submission', populate: [{ path: 'contestant', select: 'name email' }, { path: 'files', select: 'originalFileName status' }] }).lean();
  return sendSuccess(res, { stage, projects: participations.map((item) => ({ ...item.submission, participationId: item._id })) });
};
