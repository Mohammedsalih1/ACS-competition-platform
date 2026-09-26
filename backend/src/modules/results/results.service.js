import ApiError from '../../utils/ApiError.js';
import { ERROR_CODES } from '../../constants/errorCodes.js';
import { ROLES } from '../../constants/roles.js';
import JudgingCriteria from '../../models/judgingCriteria.model.js';
import JudgeAssignment from '../../models/judgeAssignment.model.js';
import Evaluation from '../../models/evaluation.model.js';
import Submission, { SUBMISSION_STATUS } from '../../models/submission.model.js';
import ResultsSetting from '../../models/resultsSetting.model.js';
import { User } from '../../models/user.model.js';

/**
 * Scoring rules
 * - An evaluation's total is the sum of its criterion scores (bonus included).
 * - A project's `averageScore` is the mean of its judges' totals; `totalScore`
 *   is their sum. Ranking uses the average so projects with a different number
 *   of judges stay comparable.
 * - A project needs at least one evaluation to be ranked. `isComplete` says
 *   whether every assigned judge has finished.
 * - Ties share a rank (1, 2, 2, 4); order within a tie is earliest submission first.
 */

const round2 = (n) => Math.round(n * 100) / 100;
const idOf = (v) => v?.toString();

// ── Publication state ───────────────────────────────────────────────

export const getPublicationState = async () => {
  const setting = await ResultsSetting.findOne({ key: 'results' });
  return {
    published: setting?.published ?? false,
    publishedAt: setting?.publishedAt ?? null,
  };
};

export const setPublished = async (published, adminId) => {
  const setting = await ResultsSetting.findOneAndUpdate(
    { key: 'results' },
    {
      $set: {
        published,
        publishedAt: published ? new Date() : null,
        publishedBy: published ? adminId : null,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return { published: setting.published, publishedAt: setting.publishedAt };
};

const assertVisibleTo = async (user) => {
  if (user.role === ROLES.ADMIN) return;
  const { published } = await getPublicationState();
  if (!published) {
    throw ApiError.forbidden('Results have not been published yet', ERROR_CODES.RESULTS_NOT_PUBLISHED);
  }
};

// ── Core computation ────────────────────────────────────────────────

const getMaxTotal = async () => {
  const criteria = await JudgingCriteria.find({ isActive: true }).select('maxScore').lean();
  return criteria.reduce((sum, c) => sum + c.maxScore, 0);
};

/** Every submission with at least one evaluation, ranked best first. */
const computeRanking = async () => {
  const [aggregates, assignmentCounts] = await Promise.all([
    Evaluation.aggregate([
      {
        $group: {
          _id: '$submission',
          totalScore: { $sum: '$totalScore' },
          averageScore: { $avg: '$totalScore' },
          highestScore: { $max: '$totalScore' },
          lowestScore: { $min: '$totalScore' },
          evaluatedCount: { $sum: 1 },
        },
      },
    ]),
    JudgeAssignment.aggregate([{ $group: { _id: '$submission', count: { $sum: 1 } } }]),
  ]);

  if (aggregates.length === 0) return [];

  const assignedMap = new Map(assignmentCounts.map((a) => [idOf(a._id), a.count]));
  const submissions = await Submission.find({ _id: { $in: aggregates.map((a) => a._id) } })
    .populate('contestant', 'name email')
    .lean();
  const subMap = new Map(submissions.map((s) => [idOf(s._id), s]));

  const entries = aggregates
    .map((a) => {
      const sub = subMap.get(idOf(a._id));
      if (!sub) return null; // submission deleted; orphaned evaluations are ignored
      const assignedCount = Math.max(assignedMap.get(idOf(a._id)) ?? 0, a.evaluatedCount);
      return {
        submissionId: idOf(a._id),
        title: sub.title,
        contestant: sub.contestant
          ? { id: idOf(sub.contestant._id), name: sub.contestant.name, email: sub.contestant.email }
          : null,
        averageScore: round2(a.averageScore),
        totalScore: a.totalScore,
        highestScore: a.highestScore,
        lowestScore: a.lowestScore,
        evaluatedCount: a.evaluatedCount,
        assignedCount,
        isComplete: a.evaluatedCount >= assignedCount,
        submittedAt: sub.submittedAt ?? sub.createdAt,
      };
    })
    .filter(Boolean)
    .sort(
      (x, y) =>
        y.averageScore - x.averageScore ||
        new Date(x.submittedAt) - new Date(y.submittedAt) ||
        x.submissionId.localeCompare(y.submissionId),
    );

  let previous = null;
  entries.forEach((entry, i) => {
    entry.rank = previous && previous.averageScore === entry.averageScore ? previous.rank : i + 1;
    previous = entry;
  });
  return entries;
};

// ── Leaderboard ─────────────────────────────────────────────────────

export const getLeaderboard = async (user, { page, limit }) => {
  await assertVisibleTo(user);
  const [ranking, maxTotal] = await Promise.all([computeRanking(), getMaxTotal()]);
  const isAdmin = user.role === ROLES.ADMIN;
  const percentage = (avg) => (maxTotal ? round2((avg / maxTotal) * 100) : 0);

  const results = ranking.slice((page - 1) * limit, page * limit).map((e) =>
    isAdmin
      ? { ...e, percentage: percentage(e.averageScore) }
      : {
          rank: e.rank,
          submissionId: e.submissionId,
          title: e.title,
          contestant: e.contestant && { id: e.contestant.id, name: e.contestant.name },
          averageScore: e.averageScore,
          percentage: percentage(e.averageScore),
        },
  );

  return { results, maxScore: maxTotal, total: ranking.length };
};

// ── Project result ──────────────────────────────────────────────────

export const getProjectResult = async (user, submissionId) => {
  const submission = await Submission.findById(submissionId).populate('contestant', 'name email').lean();
  if (!submission) throw ApiError.notFound('Submission not found');

  const isAdmin = user.role === ROLES.ADMIN;
  if (!isAdmin) {
    if (user.role !== ROLES.CONTESTANT || idOf(submission.contestant?._id) !== idOf(user.id)) {
      throw ApiError.forbidden('You can only view the result of your own submission');
    }
    await assertVisibleTo(user);
  }

  const [ranking, maxTotal, criteria, evaluations, assignedCount] = await Promise.all([
    computeRanking(),
    getMaxTotal(),
    JudgingCriteria.find({ isActive: true }).sort('order').lean(),
    Evaluation.find({ submission: submissionId }).populate('judge', 'name email').sort('createdAt').lean(),
    JudgeAssignment.countDocuments({ submission: submissionId }),
  ]);

  const entry = ranking.find((e) => e.submissionId === idOf(submission._id)) ?? null;

  const criteriaBreakdown = criteria.map((c) => {
    const scores = evaluations.flatMap((e) =>
      e.scores.filter((s) => idOf(s.criterion) === idOf(c._id)).map((s) => s.score),
    );
    return {
      criterionId: idOf(c._id),
      key: c.key,
      name: c.name,
      nameAr: c.nameAr,
      isBonus: c.isBonus,
      maxScore: c.maxScore,
      average: scores.length ? round2(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
    };
  });

  const result = {
    submissionId: idOf(submission._id),
    title: submission.title,
    contestant: submission.contestant
      ? { id: idOf(submission.contestant._id), name: submission.contestant.name }
      : null,
    rank: entry?.rank ?? null,
    totalParticipants: ranking.length,
    averageScore: entry?.averageScore ?? null,
    totalScore: entry?.totalScore ?? null,
    highestScore: entry?.highestScore ?? null,
    lowestScore: entry?.lowestScore ?? null,
    maxScore: maxTotal,
    percentage: entry && maxTotal ? round2((entry.averageScore / maxTotal) * 100) : null,
    evaluatedCount: evaluations.length,
    assignedCount: Math.max(assignedCount, evaluations.length),
    isComplete: evaluations.length > 0 && evaluations.length >= assignedCount,
    criteria: criteriaBreakdown,
  };

  // Judge identities, notes and per-judge scores are admin-only.
  if (isAdmin) {
    result.contestant = submission.contestant && {
      id: idOf(submission.contestant._id),
      name: submission.contestant.name,
      email: submission.contestant.email,
    };
    result.evaluations = evaluations.map((e) => ({
      id: idOf(e._id),
      judge: e.judge && { id: idOf(e.judge._id), name: e.judge.name, email: e.judge.email },
      totalScore: e.totalScore,
      generalNote: e.generalNote,
      submittedAt: e.submittedAt,
      scores: e.scores.map((s) => ({ criterionId: idOf(s.criterion), score: s.score, note: s.note })),
    }));
  }

  return result;
};

/** Contestant shortcut: results for all of the caller's own submissions. */
export const getMyResults = async (user) => {
  await assertVisibleTo(user);
  const submissions = await Submission.find({ contestant: user.id }).select('_id').lean();
  return Promise.all(submissions.map((s) => getProjectResult(user, s._id)));
};

// ── Dashboard statistics (admin) ────────────────────────────────────

export const getStats = async () => {
  const [
    submissionsByStatus,
    contestantCount,
    judgeCount,
    assignmentCount,
    evaluationCount,
    assignedSubmissionIds,
    ranking,
    criteria,
    criteriaAgg,
    publication,
  ] = await Promise.all([
    Submission.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    User.countDocuments({ role: ROLES.CONTESTANT }),
    User.countDocuments({ role: ROLES.JUDGE }),
    JudgeAssignment.countDocuments(),
    Evaluation.countDocuments(),
    JudgeAssignment.distinct('submission'),
    computeRanking(),
    JudgingCriteria.find({ isActive: true }).sort('order').lean(),
    Evaluation.aggregate([
      { $unwind: '$scores' },
      { $group: { _id: '$scores.criterion', average: { $avg: '$scores.score' } } },
    ]),
    getPublicationState(),
  ]);

  const byStatus = Object.fromEntries(Object.values(SUBMISSION_STATUS).map((s) => [s, 0]));
  submissionsByStatus.forEach((s) => {
    byStatus[s._id] = s.count;
  });
  const totalSubmissions = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const reviewable = totalSubmissions - byStatus[SUBMISSION_STATUS.DRAFT];

  const unassigned = await Submission.countDocuments({
    status: { $ne: SUBMISSION_STATUS.DRAFT },
    _id: { $nin: assignedSubmissionIds },
  });
  const averages = ranking.map((r) => r.averageScore);
  const criteriaAvgMap = new Map(criteriaAgg.map((c) => [idOf(c._id), c.average]));

  return {
    published: publication.published,
    users: { contestants: contestantCount, judges: judgeCount },
    submissions: {
      total: totalSubmissions,
      byStatus,
      unassigned,
      evaluated: ranking.length,
      pendingEvaluation: Math.max(reviewable - ranking.length, 0),
      fullyEvaluated: ranking.filter((r) => r.isComplete).length,
    },
    evaluations: {
      total: evaluationCount,
      assignments: assignmentCount,
      progressPercent: assignmentCount ? round2(Math.min(evaluationCount / assignmentCount, 1) * 100) : 0,
    },
    scores: {
      maxScore: criteria.reduce((sum, c) => sum + c.maxScore, 0),
      average: averages.length ? round2(averages.reduce((a, b) => a + b, 0) / averages.length) : null,
      highest: averages.length ? Math.max(...averages) : null,
      lowest: averages.length ? Math.min(...averages) : null,
      topProject: ranking[0]
        ? { submissionId: ranking[0].submissionId, title: ranking[0].title, averageScore: ranking[0].averageScore }
        : null,
    },
    criteriaAverages: criteria.map((c) => ({
      key: c.key,
      name: c.name,
      maxScore: c.maxScore,
      average: criteriaAvgMap.has(idOf(c._id)) ? round2(criteriaAvgMap.get(idOf(c._id))) : null,
    })),
  };
};
