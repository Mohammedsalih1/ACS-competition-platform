import ApiError from '../../utils/ApiError.js';
import { ERROR_CODES } from '../../constants/errorCodes.js';
import { ROLES } from '../../constants/roles.js';
import JudgingCriteria from '../../models/judgingCriteria.model.js';
import JudgeAssignment from '../../models/judgeAssignment.model.js';
import Evaluation from '../../models/evaluation.model.js';
import Submission from '../../models/submission.model.js';
import { User } from '../../models/user.model.js';

// ── Criteria ────────────────────────────────────────────────────────

export const listCriteria = async ({ activeOnly = true } = {}) => {
  const filter = activeOnly ? { isActive: true } : {};
  return JudgingCriteria.find(filter).sort('order').lean();
};

export const getCriterionById = async (criterionId) => {
  const criterion = await JudgingCriteria.findById(criterionId);
  if (!criterion) throw ApiError.notFound('Judging criterion not found');
  return criterion;
};

export const createCriterion = async (data, adminId) => {
  const existing = await JudgingCriteria.findOne({ key: data.key });
  if (existing) throw ApiError.conflict('A criterion with this key already exists', ERROR_CODES.DUPLICATE_CRITERION_KEY);
  return JudgingCriteria.create({ ...data, createdBy: adminId });
};

export const updateCriterion = async (criterionId, updates) => {
  const criterion = await JudgingCriteria.findByIdAndUpdate(
    criterionId,
    updates,
    { new: true, runValidators: true },
  );
  if (!criterion) throw ApiError.notFound('Judging criterion not found');
  return criterion;
};

export const deleteCriterion = async (criterionId) => {
  const used = await Evaluation.exists({ 'scores.criterion': criterionId });
  if (used) {
    throw ApiError.conflict(
      'Cannot delete a criterion that has been used in evaluations. Deactivate it instead.',
    );
  }
  const criterion = await JudgingCriteria.findByIdAndDelete(criterionId);
  if (!criterion) throw ApiError.notFound('Judging criterion not found');
  return criterion;
};

// ── Assignments ─────────────────────────────────────────────────────

export const assignJudge = async (judgeId, submissionId, adminId) => {
  const [judge, submission] = await Promise.all([
    User.findById(judgeId).lean(),
    Submission.findById(submissionId).lean(),
  ]);

  if (!judge || judge.role !== ROLES.JUDGE) {
    throw ApiError.badRequest('User is not a judge');
  }
  if (!submission) throw ApiError.notFound('Submission not found');

  const existing = await JudgeAssignment.findOne({ judge: judgeId, submission: submissionId });
  if (existing) throw ApiError.conflict('Judge is already assigned to this submission');

  return JudgeAssignment.create({
    judge: judgeId,
    submission: submissionId,
    assignedBy: adminId,
  });
};

export const bulkAssignJudge = async (judgeId, submissionIds, adminId) => {
  const judge = await User.findById(judgeId).lean();
  if (!judge || judge.role !== ROLES.JUDGE) {
    throw ApiError.badRequest('User is not a judge');
  }

  const submissions = await Submission.find({ _id: { $in: submissionIds } }).select('_id').lean();
  if (submissions.length !== submissionIds.length) {
    throw ApiError.badRequest('One or more submissions not found');
  }

  const existing = await JudgeAssignment.find({
    judge: judgeId,
    submission: { $in: submissionIds },
  }).lean();
  const existingSet = new Set(existing.map((a) => a.submission.toString()));

  const newAssignments = submissionIds
    .filter((id) => !existingSet.has(id))
    .map((submissionId) => ({
      judge: judgeId,
      submission: submissionId,
      assignedBy: adminId,
    }));

  if (newAssignments.length === 0) {
    return { created: 0, skipped: submissionIds.length };
  }

  const result = await JudgeAssignment.insertMany(newAssignments);
  return { created: result.length, skipped: existingSet.size };
};

export const removeAssignment = async (judgeId, submissionId) => {
  const hasEvaluation = await Evaluation.exists({ judge: judgeId, submission: submissionId });
  if (hasEvaluation) {
    throw ApiError.conflict('Cannot remove assignment — judge has already submitted an evaluation');
  }
  const result = await JudgeAssignment.findOneAndDelete({ judge: judgeId, submission: submissionId });
  if (!result) throw ApiError.notFound('Assignment not found');
  return result;
};

export const getMyAssignments = async (judgeId) => {
  return JudgeAssignment.find({ judge: judgeId })
    .populate({
      path: 'submission',
      populate: { path: 'contestant', select: 'name email' },
    })
    .sort('-createdAt')
    .lean();
};

export const listAssignments = async ({ judgeId, submissionId } = {}) => {
  const filter = {};
  if (judgeId) filter.judge = judgeId;
  if (submissionId) filter.submission = submissionId;

  return JudgeAssignment.find(filter)
    .populate('judge', 'name email')
    .populate({
      path: 'submission',
      select: 'title status contestant',
      populate: { path: 'contestant', select: 'name email' },
    })
    .sort('-createdAt')
    .lean();
};

export const isJudgeAssigned = async (judgeId, submissionId) => {
  return JudgeAssignment.exists({ judge: judgeId, submission: submissionId });
};

// ── Evaluations ─────────────────────────────────────────────────────

export const submitEvaluation = async (judgeId, submissionId, { scores, generalNote }) => {
  const assigned = await isJudgeAssigned(judgeId, submissionId);
  if (!assigned) {
    throw ApiError.forbidden('You are not assigned to evaluate this submission', ERROR_CODES.JUDGE_NOT_ASSIGNED);
  }

  const existing = await Evaluation.findOne({ judge: judgeId, submission: submissionId });
  if (existing) {
    throw ApiError.conflict(
      'You have already evaluated this submission',
      ERROR_CODES.ALREADY_EVALUATED,
    );
  }

  const criteria = await JudgingCriteria.find({ isActive: true }).lean();
  const criteriaMap = new Map(criteria.map((c) => [c._id.toString(), c]));

  const nonBonusCriteria = criteria.filter((c) => !c.isBonus);
  const submittedIds = new Set(scores.map((s) => s.criterionId));

  for (const c of nonBonusCriteria) {
    if (!submittedIds.has(c._id.toString())) {
      throw ApiError.badRequest(`Missing score for required criterion: ${c.name}`, ERROR_CODES.MISSING_CRITERION_SCORE);
    }
  }

  let totalScore = 0;
  const evaluationScores = scores.map((s) => {
    const criterion = criteriaMap.get(s.criterionId);
    if (!criterion) {
      throw ApiError.badRequest(`Unknown criterion: ${s.criterionId}`);
    }
    if (s.score > criterion.maxScore) {
      throw ApiError.badRequest(
        `Score for "${criterion.name}" exceeds maximum of ${criterion.maxScore}`,
        ERROR_CODES.SCORE_OUT_OF_RANGE,
      );
    }
    if (!Number.isInteger(s.score)) {
      throw ApiError.badRequest(`Score for "${criterion.name}" must be a whole number`);
    }
    totalScore += s.score;
    return { criterion: s.criterionId, score: s.score, note: s.note };
  });

  const evaluation = await Evaluation.create({
    judge: judgeId,
    submission: submissionId,
    scores: evaluationScores,
    totalScore,
    generalNote,
  });

  return evaluation.populate([
    { path: 'judge', select: 'name email' },
    { path: 'scores.criterion', select: 'key name nameAr maxScore isBonus order' },
  ]);
};

export const getMyEvaluation = async (judgeId, submissionId) => {
  const evaluation = await Evaluation.findOne({ judge: judgeId, submission: submissionId })
    .populate('judge', 'name email')
    .populate('scores.criterion', 'key name nameAr maxScore isBonus order');

  if (!evaluation) throw ApiError.notFound('You have not evaluated this submission yet');
  return evaluation;
};

export const getEvaluationsForSubmission = async (submissionId) => {
  const submission = await Submission.findById(submissionId);
  if (!submission) throw ApiError.notFound('Submission not found');

  const evaluations = await Evaluation.find({ submission: submissionId })
    .populate('judge', 'name email')
    .populate('scores.criterion', 'key name nameAr maxScore isBonus order')
    .sort('createdAt');

  if (evaluations.length === 0) return { evaluations: [], summary: null };

  const criteria = await JudgingCriteria.find({ isActive: true }).sort('order').lean();

  const averages = criteria.map((c) => {
    const relevant = evaluations.flatMap((e) =>
      e.scores.filter((s) => s.criterion?._id?.toString() === c._id.toString()),
    );
    const avg = relevant.length > 0
      ? relevant.reduce((sum, s) => sum + s.score, 0) / relevant.length
      : 0;
    return { criterionId: c._id, key: c.key, name: c.name, average: Math.round(avg * 100) / 100, maxScore: c.maxScore };
  });

  const totalAvg = evaluations.reduce((sum, e) => sum + e.totalScore, 0) / evaluations.length;

  return {
    evaluations,
    summary: {
      judgeCount: evaluations.length,
      averages,
      totalAverage: Math.round(totalAvg * 100) / 100,
    },
  };
};
