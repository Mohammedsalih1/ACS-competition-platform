import ApiError from '../../utils/ApiError.js';
import JudgingCriteria from '../../models/judgingCriteria.model.js';
import Evaluation from '../../models/evaluation.model.js';
import Submission, { SUBMISSION_STATUS } from '../../models/submission.model.js';
import { CompetitionStage, ProjectStageParticipation } from '../../models/competitionStage.model.js';

const activeRubric = (stage) => stage.rubricVersions.find((item) => item.version === stage.activeRubricVersion);
const maxOf = (rubric) => rubric ? rubric.criteria.filter((item) => item.active && !item.bonus).reduce((sum, item) => sum + item.maxScore, 0) + (rubric.bonusEnabled ? rubric.bonusMax : 0) : 0;
const snapshot = (criteria) => criteria.map((item) => ({ criterionId: item._id, key: item.key, name: item.name, nameAr: item.nameAr, description: item.description, standard: item.standard, maxScore: item.maxScore, order: item.order, active: true, bonus: item.isBonus }));

export const listStages = async () => {
  const stages = await CompetitionStage.find().sort('order').lean();
  const stageIds = stages.map((item) => item._id);
  const [counts, judged] = await Promise.all([
    ProjectStageParticipation.aggregate([{ $match: { stage: { $in: stageIds }, active: true } }, { $group: { _id: '$stage', count: { $sum: 1 } } }]),
    ProjectStageParticipation.aggregate([
      { $match: { stage: { $in: stageIds }, active: true } },
      { $lookup: { from: 'evaluations', localField: '_id', foreignField: 'participation', as: 'evals' } },
      { $lookup: { from: 'competitionstages', localField: 'stage', foreignField: '_id', as: 'stageInfo' } },
      { $unwind: '$stageInfo' },
      { $project: { stage: 1, count: { $size: { $filter: { input: '$evals', as: 'e', cond: { $and: [{ $eq: ['$$e.status', 'submitted'] }, { $eq: ['$$e.rubricVersion', '$stageInfo.activeRubricVersion'] }] } } } } } },
      { $group: { _id: '$stage', count: { $sum: '$count' } } },
    ]),
  ]);
  const projectCounts = new Map(counts.map((item) => [String(item._id), item.count]));
  const judgingCounts = new Map(judged.map((item) => [String(item._id), item.count]));
  return stages.map((stage) => { const rubric = activeRubric(stage); return { ...stage, projectCount: projectCounts.get(String(stage._id)) || 0, completedEvaluations: judgingCounts.get(String(stage._id)) || 0, activeCriteriaCount: rubric?.criteria.filter((item) => item.active && !item.bonus).length || 0, maxScore: maxOf(rubric) }; });
};

export const createStage = async (data, actor) => {
  const criteria = await JudgingCriteria.find().sort('order').lean();
  const coreCount = criteria.filter((item) => !item.isBonus).length;
  if (coreCount !== 8 || criteria.filter((item) => item.isBonus).length !== 1) throw ApiError.conflict('The official rubric is incomplete. Run the criteria seed and retry.');
  return CompetitionStage.create({ ...data, activeRubricVersion: 1, rubricVersions: [{ version: 1, criteria: snapshot(criteria), bonusEnabled: true, bonusMax: criteria.find((item) => item.isBonus).maxScore, changedBy: actor, reason: 'Initial official rubric' }], history: [{ action: 'created', actor }] });
};

export const updateStage = async (id, data, actor) => {
  const stage = await CompetitionStage.findById(id);
  if (!stage) throw ApiError.notFound('Competition stage not found');
  if (['closed', 'archived'].includes(stage.status)) throw ApiError.conflict('Closed or archived stages cannot be changed');
  if (data.status && !({ draft: ['open', 'archived'], open: ['judging', 'closed'], judging: ['closed'], closed: ['archived'], archived: [] }[stage.status] || []).includes(data.status) && data.status !== stage.status) throw ApiError.badRequest('Invalid stage status transition');
  if (data.requiredEvaluations !== undefined && data.requiredEvaluations !== stage.requiredEvaluations) {
    const participations = await ProjectStageParticipation.find({ stage: id, active: true }).select('completedEvaluationCount').lean();
    const maxCompleted = Math.max(0, ...participations.map((item) => item.completedEvaluationCount || 0));
    if (data.requiredEvaluations < maxCompleted) throw ApiError.conflict(`Required evaluations cannot be lower than the current completed count (${maxCompleted})`);
    if (maxCompleted && !data.reason?.trim()) throw ApiError.badRequest('A reason is required after judging has started');
  }
  const updates = { ...data };
  delete updates.reason;
  Object.assign(stage, updates);
  stage.history.push({ action: 'updated', actor, reason: data.reason || '' });
  await stage.save();
  return stage;
};

export const updateRubric = async (id, data, actor) => {
  const stage = await CompetitionStage.findById(id);
  if (!stage) throw ApiError.notFound('Competition stage not found');
  if (['closed', 'archived'].includes(stage.status)) throw ApiError.conflict('Rubric for closed or archived stages is immutable');
  if (!data.reason?.trim()) throw ApiError.badRequest('A reason is required for rubric changes');
  const previous = activeRubric(stage);
  const nextCriteria = data.criteria.map((item) => {
    const prior = previous.criteria.find((criterion) => criterion.key === item.key);
    if (!prior) throw ApiError.badRequest(`Unknown official criterion: ${item.key}`);
    return { ...prior.toObject?.() || prior, active: item.active, maxScore: item.maxScore };
  });
  if (nextCriteria.filter((item) => !item.bonus).length !== 8) throw ApiError.badRequest('All eight official criteria must remain configured');
  const started = await Evaluation.exists({ participation: { $in: await ProjectStageParticipation.find({ stage: id, active: true }).distinct('_id') }, status: 'submitted' });
  const activeIds = await ProjectStageParticipation.find({ stage: id, active: true }).distinct('_id');
  const projectIds = await ProjectStageParticipation.find({ _id: { $in: activeIds } }).distinct('submission');
  if (await Submission.exists({ _id: { $in: projectIds }, reviewState: 'published' })) throw ApiError.conflict('A published stage result is finalized and cannot be changed through rubric editing.');
  if (started && (stage.status !== 'judging' || data.reopen !== true)) throw ApiError.conflict('Judging has started. Set the stage to judging and explicitly reopen the stage-wide round to apply a new rubric version.');
  const version = stage.rubricVersions.length + 1;
  stage.rubricVersions.push({ version, criteria: nextCriteria, bonusEnabled: data.bonusEnabled ?? previous.bonusEnabled, bonusMax: data.bonusMax ?? previous.bonusMax, reason: data.reason.trim(), changedBy: actor });
  stage.activeRubricVersion = version;
  stage.history.push({ action: 'rubric_changed', actor, reason: data.reason.trim() });
  await stage.save();
  await ProjectStageParticipation.updateMany({ stage: id, active: true }, { $set: { version, ...(started && { completedEvaluationCount: 0 }) }, $push: { history: { stage: id, actor, reason: `Rubric v${version}: ${data.reason.trim()}${started ? ' (round reopened; prior evaluations retained)' : ''}` } } });
  if (started) await Submission.updateMany({ _id: { $in: projectIds } }, { $set: { completedEvaluationCount: 0, status: 'under_review', reviewState: 'in_progress', approvedAt: null, approvedBy: null } });
  return { stage, previousMaximum: maxOf(previous), newMaximum: maxOf(activeRubric(stage)), affectedProjects: await ProjectStageParticipation.countDocuments({ stage: id, active: true }), priorEvaluationsExist: Boolean(started) };
};

export const assignProjects = async (stageId, submissionIds, actor, reason = '') => {
  const stage = await CompetitionStage.findById(stageId);
  if (!stage) throw ApiError.notFound('Competition stage not found');
  if (!['draft', 'open'].includes(stage.status)) throw ApiError.conflict('Projects can only be assigned to draft or open stages');
  const submissions = await Submission.find({ _id: { $in: submissionIds }, status: { $ne: 'draft' } }).select('_id').lean();
  if (submissions.length !== new Set(submissionIds.map(String)).size) throw ApiError.badRequest('One or more submitted projects could not be found');
  const existing = await ProjectStageParticipation.find({ submission: { $in: submissions.map((item) => item._id) }, active: true }).lean();
  const bySubmission = new Map(existing.map((item) => [String(item.submission), item]));
  const moving = existing.filter((item) => String(item.stage) !== String(stageId));
  if (moving.length && await Evaluation.exists({ participation: { $in: moving.map((item) => item._id) }, status: 'submitted' })) throw ApiError.conflict('A selected project has completed evaluations and cannot be moved. Preserve its current stage results first.');
  const rows = [];
  for (const submission of submissions) {
    const prior = bySubmission.get(String(submission._id));
    if (prior && String(prior.stage) === String(stageId)) { rows.push(prior); await Submission.updateOne({ _id: submission._id }, { $set: { stageParticipation: prior._id } }); continue; }
    if (prior) {
      prior.active = false;
      prior.history.push({ stage: stageId, actor, reason, at: new Date() });
      await prior.save();
    }
    rows.push(await ProjectStageParticipation.create({ submission: submission._id, stage: stageId, version: stage.activeRubricVersion, assignedBy: actor, history: [{ stage: stageId, actor, reason }] }));
    await Submission.updateOne({ _id: submission._id }, { $set: { stageParticipation: rows.at(-1)._id } });
  }
  return rows;
};

export const assignUnassignedSubmissionsToSoleOpenStage = async () => {
  const stages = await CompetitionStage.find({ status: 'open' }).select('_id').limit(2).lean();
  if (stages.length !== 1) return 0;

  const assignedSubmissionIds = await ProjectStageParticipation.distinct('submission', { active: true });
  const submissions = await Submission.find({
    _id: { $nin: assignedSubmissionIds },
    status: { $in: [SUBMISSION_STATUS.SUBMITTED, SUBMISSION_STATUS.UNDER_REVIEW, SUBMISSION_STATUS.SCORED] },
    'files.0': { $exists: true },
  }).select('_id').lean();
  if (submissions.length === 0) return 0;

  await assignProjects(
    stages[0]._id,
    submissions.map((submission) => submission._id),
    null,
    'Automatic assignment to the sole open stage',
  );
  return submissions.length;
};

export const getStageRubricForSubmission = async (submissionId) => {
  const participation = await ProjectStageParticipation.findOne({ submission: submissionId, active: true }).populate('stage').lean();
  if (!participation) throw ApiError.conflict('This project has no competition stage. Ask an administrator to assign it.');
  const stage = participation.stage;
  if (!['open', 'judging'].includes(stage.status)) throw ApiError.conflict(`Judging is unavailable while this stage is ${stage.status}`);
  const rubric = stage.rubricVersions.find((item) => item.version === stage.activeRubricVersion);
  if (!rubric) throw ApiError.conflict('The stage rubric is unavailable. Ask an administrator to repair stage configuration.');
  return { participationId: participation._id, stage: { id: stage._id, name: stage.name, status: stage.status, requiredEvaluations: stage.requiredEvaluations }, rubricVersion: rubric.version, criteria: rubric.criteria.filter((item) => item.active && !item.bonus), bonus: rubric.criteria.find((item) => item.bonus), bonusEnabled: rubric.bonusEnabled, bonusMax: rubric.bonusMax, maxScore: maxOf(rubric) };
};
