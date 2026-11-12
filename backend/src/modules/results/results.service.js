import ApiError from '../../utils/ApiError.js';
import { ERROR_CODES } from '../../constants/errorCodes.js';
import { ROLES } from '../../constants/roles.js';
import JudgingCriteria from '../../models/judgingCriteria.model.js';
import Evaluation from '../../models/evaluation.model.js';
import Submission, { SUBMISSION_STATUS } from '../../models/submission.model.js';
import ResultsSetting from '../../models/resultsSetting.model.js';
import CompetitionSetting from '../../models/competitionSetting.model.js';
import { User } from '../../models/user.model.js';

const round2 = (value) => Math.round(value * 100) / 100;
const idOf = (value) => value?.toString();
const FINAL_MATCH = { $or: [{ status: 'submitted' }, { status: { $exists: false } }] };

export const getPublicationState = async () => {
  const setting = await ResultsSetting.findOne({ key: 'results' });
  return { published: setting?.published ?? false, publishedAt: setting?.publishedAt ?? null };
};
export const setPublished = async (published, adminId) => {
  if (published && !await Submission.exists({ reviewState: 'approved' })) throw ApiError.conflict('Approve at least one completed project before publishing results');
  const setting = await ResultsSetting.findOneAndUpdate(
    { key: 'results' },
    { $set: { published, publishedAt: published ? new Date() : null, publishedBy: published ? adminId : null } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  if (published) await Submission.updateMany({ reviewState: 'approved' }, { $set: { reviewState: 'published' } });
  else await Submission.updateMany({ reviewState: 'published' }, { $set: { reviewState: 'approved' } });
  return { published: setting.published, publishedAt: setting.publishedAt };
};
const assertVisibleTo = async (user) => {
  if (user.role === ROLES.ADMIN) return;
  if (!(await getPublicationState()).published) throw ApiError.forbidden('Results have not been published yet', ERROR_CODES.RESULTS_NOT_PUBLISHED);
};
const getMaxTotal = async () => {
  const criteria = await JudgingCriteria.find({ isActive: true, isBonus: false }).select('maxScore').lean();
  return criteria.reduce((sum, item) => sum + item.maxScore, 0) + 5;
};

const computeRanking = async (adminView = false) => {
  const aggregates = await Evaluation.aggregate([
    { $match: FINAL_MATCH },
    { $group: { _id: '$submission', averageScore: { $avg: '$totalScore' }, totalScore: { $sum: '$totalScore' }, highestScore: { $max: '$totalScore' }, lowestScore: { $min: '$totalScore' }, evaluatedCount: { $sum: 1 } } },
  ]);
  if (!aggregates.length) return [];
  const submissions = await Submission.find({
    _id: { $in: aggregates.map((item) => item._id) },
    reviewState: adminView ? { $in: ['requirements_met', 'approved', 'published'] } : 'published',
  }).populate('contestant', 'name email').lean();
  const submissionMap = new Map(submissions.map((item) => [idOf(item._id), item]));
  const rows = aggregates.flatMap((item) => {
    const submission = submissionMap.get(idOf(item._id));
    if (!submission) return [];
    return [{
      submissionId: idOf(item._id), title: submission.title,
      contestant: submission.contestant && { id: idOf(submission.contestant._id), name: submission.contestant.name, email: submission.contestant.email },
      averageScore: item.averageScore, totalScore: item.totalScore, highestScore: item.highestScore, lowestScore: item.lowestScore,
      evaluatedCount: item.evaluatedCount, isComplete: ['requirements_met', 'approved', 'published'].includes(submission.reviewState),
      approvalStatus: submission.reviewState, submittedAt: submission.submittedAt || submission.createdAt,
    }];
  }).sort((a, b) => b.averageScore - a.averageScore || new Date(a.submittedAt) - new Date(b.submittedAt));
  let previous;
  rows.forEach((row, index) => { row.rank = previous?.averageScore === row.averageScore ? previous.rank : index + 1; previous = row; });
  return rows;
};

export const getLeaderboard = async (user, { page, limit }) => {
  await assertVisibleTo(user);
  const [ranking, maxScore] = await Promise.all([computeRanking(user.role === ROLES.ADMIN), getMaxTotal()]);
  const results = ranking.slice((page - 1) * limit, page * limit).map((row) => ({
    ...(user.role === ROLES.ADMIN ? row : { rank: row.rank, submissionId: row.submissionId, title: row.title, contestant: row.contestant && { id: row.contestant.id, name: row.contestant.name }, averageScore: round2(row.averageScore) }),
    percentage: maxScore ? round2((row.averageScore / maxScore) * 100) : 0,
  }));
  return { results, maxScore, total: ranking.length };
};

export const getProjectResult = async (user, submissionId) => {
  const submission = await Submission.findById(submissionId).populate('contestant', 'name email').lean();
  if (!submission) throw ApiError.notFound('Submission not found');
  const isAdmin = user.role === ROLES.ADMIN;
  if (!isAdmin) {
    if (user.role !== ROLES.CONTESTANT || idOf(submission.contestant?._id) !== idOf(user.id)) throw ApiError.forbidden('You can only view your own result');
    await assertVisibleTo(user);
    if (submission.reviewState !== 'published') throw ApiError.forbidden('This project result is not published');
  }
  const [ranking, maxScore, criteria, evaluations, settings] = await Promise.all([
    computeRanking(isAdmin), getMaxTotal(), JudgingCriteria.find({ isActive: true, isBonus: false }).sort('order').lean(),
    Evaluation.find({ submission: submissionId, ...FINAL_MATCH }).populate('judge', 'name email').sort('submittedAt').lean(),
    CompetitionSetting.findOne({ key: 'judging' }).lean(),
  ]);
  const row = ranking.find((item) => item.submissionId === idOf(submission._id));
  const breakdown = criteria.map((criterion) => {
    const values = evaluations.flatMap((evaluation) => evaluation.scores.filter((score) => idOf(score.criterion) === idOf(criterion._id)).map((score) => score.score));
    return { criterionId: idOf(criterion._id), key: criterion.key, name: criterion.name, nameAr: criterion.nameAr, maxScore: criterion.maxScore, average: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null };
  });
  const result = {
    submissionId: idOf(submission._id), title: submission.title, contestant: submission.contestant && { id: idOf(submission.contestant._id), name: submission.contestant.name },
    rank: row?.rank ?? null, totalParticipants: ranking.length, averageScore: row ? round2(row.averageScore) : null,
    maxScore, percentage: row ? round2((row.averageScore / maxScore) * 100) : null,
    evaluatedCount: evaluations.length, requiredEvaluations: settings?.requiredEvaluations || 3,
    isComplete: ['requirements_met', 'approved', 'published'].includes(submission.reviewState), approvalStatus: submission.reviewState,
    criteria: breakdown, bonusAverage: evaluations.length ? evaluations.reduce((sum, item) => sum + (item.bonusScore || 0), 0) / evaluations.length : null,
  };
  if (isAdmin) result.evaluations = evaluations.map((evaluation) => ({ id: idOf(evaluation._id), judge: evaluation.judge && { id: idOf(evaluation.judge._id), name: evaluation.judge.name, email: evaluation.judge.email }, totalScore: evaluation.totalScore, bonusScore: evaluation.bonusScore || 0, generalNote: evaluation.generalNote, submittedAt: evaluation.submittedAt, scores: evaluation.scores.map((score) => ({ criterionId: idOf(score.criterion), score: score.score, note: score.note })) }));
  return result;
};
export const getMyResults = async (user) => { await assertVisibleTo(user); const submissions = await Submission.find({ contestant: user.id }).select('_id').lean(); return Promise.all(submissions.map((item) => getProjectResult(user, item._id))); };

export const getStats = async () => {
  const settings = await CompetitionSetting.findOne({ key: 'judging' }).lean();
  const [statuses, contestants, judges, finalEvaluations, drafts, ranking, publication, reviewStates] = await Promise.all([
    Submission.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]), User.countDocuments({ role: ROLES.CONTESTANT }), User.countDocuments({ role: ROLES.JUDGE }),
    Evaluation.countDocuments(FINAL_MATCH), Evaluation.countDocuments({ status: 'draft' }), computeRanking(true), getPublicationState(),
    Submission.aggregate([{ $group: { _id: '$reviewState', count: { $sum: 1 } } }]),
  ]);
  const byStatus = Object.fromEntries(Object.values(SUBMISSION_STATUS).map((status) => [status, 0])); statuses.forEach((item) => { byStatus[item._id] = item.count; });
  const reviews = Object.fromEntries(reviewStates.map((item) => [item._id || 'not_evaluated', item.count]));
  const required = settings?.requiredEvaluations || 3;
  const reviewable = Object.values(byStatus).reduce((a, b) => a + b, 0) - byStatus.draft;
  return {
    published: publication.published, users: { contestants, judges },
    submissions: { total: Object.values(byStatus).reduce((a, b) => a + b, 0), byStatus, awaitingReview: reviews.not_evaluated || 0, inProgress: reviews.in_progress || 0, fullyEvaluated: (reviews.requirements_met || 0) + (reviews.approved || 0) + (reviews.published || 0), pendingEvaluation: Math.max(reviewable - ranking.length, 0) },
    evaluations: { total: finalEvaluations, drafts, requiredPerProject: required, progressPercent: reviewable ? round2(Math.min(finalEvaluations / (reviewable * required), 1) * 100) : 0 },
    scores: { maxScore: await getMaxTotal(), average: ranking.length ? round2(ranking.reduce((sum, row) => sum + row.averageScore, 0) / ranking.length) : null, topProject: ranking[0] ? { submissionId: ranking[0].submissionId, title: ranking[0].title, averageScore: round2(ranking[0].averageScore) } : null },
  };
};
