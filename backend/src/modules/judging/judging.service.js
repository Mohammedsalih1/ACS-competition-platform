import ApiError from '../../utils/ApiError.js';
import JudgingCriteria from '../../models/judgingCriteria.model.js';
import Evaluation from '../../models/evaluation.model.js';
import Submission, { SUBMISSION_STATUS } from '../../models/submission.model.js';
import CompetitionSetting from '../../models/competitionSetting.model.js';
import { getStageRubricForSubmission } from '../stages/stages.service.js';
import { ProjectStageParticipation } from '../../models/competitionStage.model.js';

const FINAL_FILTER = { $or: [{ status: 'submitted' }, { status: { $exists: false } }] };
const ELIGIBLE_STATUS = [SUBMISSION_STATUS.SUBMITTED, SUBMISSION_STATUS.UNDER_REVIEW, SUBMISSION_STATUS.SCORED];

export const listCriteria = ({ activeOnly = true } = {}) => JudgingCriteria.find(activeOnly ? { isActive: true } : {}).sort('order').lean();
export const createCriterion = async (data, adminId) => {
  if (await JudgingCriteria.exists({ key: data.key })) throw ApiError.conflict('A criterion with this key already exists');
  return JudgingCriteria.create({ ...data, createdBy: adminId });
};
export const updateCriterion = async (id, updates) => {
  const item = await JudgingCriteria.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
  if (!item) throw ApiError.notFound('Judging criterion not found');
  return item;
};
export const deleteCriterion = async (id) => {
  if (await Evaluation.exists({ 'scores.criterion': id })) throw ApiError.conflict('Deactivate criteria that are already used in evaluations');
  if (!await JudgingCriteria.findByIdAndDelete(id)) throw ApiError.notFound('Judging criterion not found');
};

export const getSettings = async () => CompetitionSetting.findOneAndUpdate(
  { key: 'judging' }, { $setOnInsert: { requiredEvaluations: 3 } },
  { upsert: true, new: true, setDefaultsOnInsert: true },
).populate('history.changedBy', 'name email').lean();

export const updateSettings = async (requiredEvaluations, reason, adminId) => {
  const current = await getSettings();
  if (current.requiredEvaluations === requiredEvaluations) return current;
  const maxCompleted = (await Submission.findOne().sort('-completedEvaluationCount').select('completedEvaluationCount').lean())?.completedEvaluationCount || 0;
  if (requiredEvaluations < maxCompleted) throw ApiError.conflict(`Required evaluations cannot be lower than the existing completed count (${maxCompleted})`);
  if (maxCompleted && !reason) throw ApiError.badRequest('A reason is required after judging has started');
  return CompetitionSetting.findOneAndUpdate(
    { key: 'judging' },
    { $set: { requiredEvaluations, updatedBy: adminId }, $push: { history: { from: current.requiredEvaluations, to: requiredEvaluations, reason, changedBy: adminId } } },
    { new: true, runValidators: true },
  ).populate('history.changedBy', 'name email');
};

const assertEligible = async (submissionId) => {
  const submission = await Submission.findOne({ _id: submissionId, status: { $in: ELIGIBLE_STATUS }, 'files.0': { $exists: true } }).lean();
  if (!submission) throw ApiError.notFound('This project is not available for judging');
  return submission;
};

const normalizeScores = (scores, complete, config) => {
  const criteria = config.criteria;
  const byId = new Map(criteria.map((item) => [String(item.criterionId), item]));
  const seen = new Set();
  const normalized = (scores || []).map((item) => {
    const criterion = byId.get(String(item.criterionId));
    if (!criterion) throw ApiError.badRequest('Unknown or inactive core criterion');
    if (seen.has(String(item.criterionId))) throw ApiError.badRequest('Each criterion may only be scored once');
    if (!Number.isInteger(item.score) || item.score < 0 || item.score > criterion.maxScore) throw ApiError.badRequest(`Score for ${criterion.name} must be a whole number from 0 to ${criterion.maxScore}`);
    seen.add(String(item.criterionId));
    return { criterion: item.criterionId, score: item.score, maxScore: criterion.maxScore, note: item.note || '' };
  });
  if (complete && seen.size !== criteria.length) throw ApiError.badRequest(`A final evaluation requires all ${criteria.length} active stage criteria`);
  return normalized;
};
const normalizeBonus = (score, config) => {
  if (!config.bonusEnabled) return 0;
  if (!Number.isInteger(score) || score < 0 || score > config.bonusMax) throw ApiError.badRequest(`Innovation bonus must be a whole number from 0 to ${config.bonusMax}`);
  return score;
};

const populate = (query) => query.populate('judge', 'name email').populate('scores.criterion', 'key name nameAr description descriptionAr standard standardAr verificationMethodAr maxScore order gradeLevels').populate('projectVersion', 'originalFileName createdAt');

export const saveDraft = async (judgeId, submissionId, payload) => {
  const [submission, config] = await Promise.all([assertEligible(submissionId), getStageRubricForSubmission(submissionId)]);
  const existing = await Evaluation.findOne({ judge: judgeId, participation: config.participationId, rubricVersion: config.rubricVersion });
  if (existing && (existing.status === 'submitted' || !existing.status)) throw ApiError.conflict('Final evaluations are locked');
  const scores = normalizeScores(payload.scores, false, config);
  const bonusScore = normalizeBonus(payload.bonusScore, config);
  const evaluation = await Evaluation.findOneAndUpdate(
    { judge: judgeId, participation: config.participationId, rubricVersion: config.rubricVersion, status: { $ne: 'submitted' } },
    { $set: { submission: submissionId, stage: config.stage.id, participation: config.participationId, rubricVersion: config.rubricVersion, rubricSnapshot: config, scores, bonusScore, totalScore: scores.reduce((n, s) => n + s.score, bonusScore), generalNote: payload.generalNote, projectVersion: submission.files.at(-1), status: 'draft', submittedAt: null }, $push: { history: { action: 'draft_saved', actor: judgeId } } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  );
  return populate(Evaluation.findById(evaluation._id));
};

export const submitEvaluation = async (judgeId, submissionId, payload) => {
  const [submission, config] = await Promise.all([assertEligible(submissionId), getStageRubricForSubmission(submissionId)]);
  const existing = await Evaluation.findOne({ judge: judgeId, participation: config.participationId, rubricVersion: config.rubricVersion }).lean();
  if (existing && (existing.status === 'submitted' || !existing.status)) throw ApiError.conflict('You have already submitted a final evaluation');
  const scores = normalizeScores(payload.scores, true, config);
  const bonusScore = normalizeBonus(payload.bonusScore, config);
  const now = new Date();
  const required = config.stage.requiredEvaluations;
  const claimed = await ProjectStageParticipation.findOneAndUpdate({ _id: config.participationId, active: true, completedEvaluationCount: { $lt: required } }, { $inc: { completedEvaluationCount: 1 } }, { new: true });
  if (!claimed) throw ApiError.conflict('This project stage has already received the required number of evaluations');
  let evaluation;
  try {
    const values = { submission: submissionId, stage: config.stage.id, participation: config.participationId, rubricVersion: config.rubricVersion, rubricSnapshot: config, scores, bonusScore, totalScore: scores.reduce((n, s) => n + s.score, bonusScore), generalNote: payload.generalNote, projectVersion: submission.files.at(-1), status: 'submitted', submittedAt: now };
    evaluation = existing
      ? await Evaluation.findOneAndUpdate({ _id: existing._id, status: 'draft' }, { $set: values, $push: { history: { action: 'submitted', actor: judgeId, at: now } } }, { new: true, runValidators: true })
      : await Evaluation.create({ judge: judgeId, submission: submissionId, ...values, history: [{ action: 'submitted', actor: judgeId, at: now }] });
    if (!evaluation) throw ApiError.conflict('Evaluation state changed; reload and try again');
  } catch (error) {
    await ProjectStageParticipation.updateOne({ _id: config.participationId, completedEvaluationCount: { $gt: 0 } }, { $inc: { completedEvaluationCount: -1 } });
    throw error;
  }
  await Submission.updateOne({ _id: submissionId }, { $inc: { completedEvaluationCount: 1 }, $set: { status: SUBMISSION_STATUS.UNDER_REVIEW, reviewState: claimed.completedEvaluationCount >= required ? 'requirements_met' : 'in_progress' } }).catch(() => {});
  return populate(Evaluation.findById(evaluation._id));
};

export const getEvaluationConfig = async (submissionId) => getStageRubricForSubmission(submissionId);
export const getMyEvaluation = async (judgeId, submissionId) => { const config = await getStageRubricForSubmission(submissionId); return populate(Evaluation.findOne({ judge: judgeId, participation: config.participationId, rubricVersion: config.rubricVersion })); };
export const listMyEvaluations = (judgeId, status) => populate(Evaluation.find({ judge: judgeId, ...(status && { status }) }).sort('-updatedAt')).populate('submission', 'title status reviewState');
export const getDashboard = async (judgeId) => {
  const settings = await getSettings();
  const [availableProjects, submittedEvaluations, draftEvaluations, requirementsMet] = await Promise.all([
    Submission.countDocuments({ status: { $in: ELIGIBLE_STATUS }, 'files.0': { $exists: true }, completedEvaluationCount: { $lt: settings.requiredEvaluations } }),
    Evaluation.countDocuments({ judge: judgeId, ...FINAL_FILTER }), Evaluation.countDocuments({ judge: judgeId, status: 'draft' }),
    Submission.countDocuments({ reviewState: { $in: ['requirements_met', 'approved', 'published'] } }),
  ]);
  return { availableProjects, submittedEvaluations, draftEvaluations, requirementsMet, requiredEvaluations: settings.requiredEvaluations };
};

export const getEvaluationsForSubmission = async (submissionId) => {
  const submission = await Submission.findById(submissionId).populate({ path: 'stageParticipation', populate: { path: 'stage' } }).lean();
  if (!submission) throw ApiError.notFound('Submission not found');
  const participation = submission.stageParticipation;
  if (participation?.stage) {
    const stage = participation.stage;
    const rubric = stage.rubricVersions?.find((item) => item.version === stage.activeRubricVersion) || stage.rubricVersions?.at(-1);
    const evaluations = await populate(Evaluation.find({ participation: participation._id, rubricVersion: rubric?.version, ...FINAL_FILTER }).sort('submittedAt'));
    const criteria = rubric?.criteria.filter((item) => item.active && !item.bonus) || [];
    const averages = criteria.map((criterion) => {
      const values = evaluations.flatMap((evaluation) => evaluation.scores.filter((score) => score.criterion?._id && String(score.criterion._id) === String(criterion.criterionId)).map((score) => score.score));
      return { criterionId: criterion.criterionId, key: criterion.key, name: criterion.name, maxScore: criterion.maxScore, average: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null };
    });
    const maxScore = criteria.reduce((sum, item) => sum + item.maxScore, 0) + (rubric?.bonusEnabled ? rubric.bonusMax : 0);
    return { evaluations, summary: { stage: { id: stage._id, name: stage.name }, rubricVersion: rubric?.version, maxScore, completed: evaluations.length, required: stage.requiredEvaluations, requirementsMet: evaluations.length >= stage.requiredEvaluations, approved: ['approved', 'published'].includes(submission.reviewState), averages, bonusAverage: evaluations.length ? evaluations.reduce((n, e) => n + e.bonusScore, 0) / evaluations.length : null, totalAverage: evaluations.length ? evaluations.reduce((n, e) => n + e.totalScore, 0) / evaluations.length : null, legacyEvaluationCount: await Evaluation.countDocuments({ submission: submissionId, participation: null, ...FINAL_FILTER }) } };
  }
  const [evaluations, settings, criteria] = await Promise.all([
    populate(Evaluation.find({ submission: submissionId, ...FINAL_FILTER }).sort('submittedAt')),
    getSettings(), JudgingCriteria.find({ isActive: true, isBonus: false }).sort('order').lean(),
  ]);
  const averages = criteria.map((criterion) => {
    const values = evaluations.flatMap((evaluation) => evaluation.scores.filter((score) => String(score.criterion?._id) === String(criterion._id)).map((score) => score.score));
    return { criterionId: criterion._id, key: criterion.key, name: criterion.name, maxScore: criterion.maxScore, average: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null };
  });
  return { evaluations, summary: { completed: evaluations.length, required: settings.requiredEvaluations, requirementsMet: evaluations.length >= settings.requiredEvaluations, approved: ['approved', 'published'].includes(submission.reviewState), averages, bonusAverage: evaluations.length ? evaluations.reduce((n, e) => n + e.bonusScore, 0) / evaluations.length : null, totalAverage: evaluations.length ? evaluations.reduce((n, e) => n + e.totalScore, 0) / evaluations.length : null } };
};

export const approveEvaluationResult = async (submissionId, adminId) => {
  const submission = await Submission.findById(submissionId).populate('stageParticipation').lean();
  if (!submission) throw ApiError.notFound('Submission not found');
  const settings = await getSettings();
  const participation = submission.stageParticipation;
  const stage = participation ? await (await import('../../models/competitionStage.model.js')).CompetitionStage.findById(participation.stage).select('requiredEvaluations activeRubricVersion').lean() : null;
  const required = stage?.requiredEvaluations;
  const count = await Evaluation.countDocuments({ ...(participation ? { participation: participation._id, rubricVersion: stage.activeRubricVersion } : { submission: submissionId, ...FINAL_FILTER }), status: 'submitted' });
  if (count < (required || settings.requiredEvaluations)) throw ApiError.conflict('The required number of final evaluations has not been reached');
  const updated = await Submission.findOneAndUpdate({ _id: submissionId, reviewState: { $ne: 'published' } }, { $set: { reviewState: 'approved', approvedAt: new Date(), approvedBy: adminId, status: SUBMISSION_STATUS.SCORED, completedEvaluationCount: count } }, { new: true });
  if (!updated) throw ApiError.notFound('Submission not found or already published');
  return updated;
};
