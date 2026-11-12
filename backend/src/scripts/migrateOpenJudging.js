/**
 * Idempotent migration from assignment-based judging to open judging.
 * No records or historical assignment documents are deleted.
 */
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import Evaluation from '../models/evaluation.model.js';
import Submission from '../models/submission.model.js';
import JudgingCriteria from '../models/judgingCriteria.model.js';
import CompetitionSetting from '../models/competitionSetting.model.js';
import { logger } from '../utils/logger.js';

await connectDatabase();
try {
  const setting = await CompetitionSetting.findOneAndUpdate(
    { key: 'judging' }, { $setOnInsert: { requiredEvaluations: 3 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  const bonusCriteria = await JudgingCriteria.find({ isBonus: true }).distinct('_id');
  const legacy = await Evaluation.find({ status: { $exists: false } });
  for (const evaluation of legacy) {
    const bonusEntry = evaluation.scores.find((score) => bonusCriteria.some((id) => String(id) === String(score.criterion)));
    evaluation.status = 'submitted';
    evaluation.bonusScore = bonusEntry?.score || 0;
    evaluation.submittedAt ||= evaluation.createdAt;
    evaluation.history.push({ action: 'submitted', actor: evaluation.judge, reason: 'Legacy evaluation migrated', at: evaluation.submittedAt });
    await evaluation.save();
  }
  const counts = await Evaluation.aggregate([
    { $match: { status: 'submitted' } },
    { $group: { _id: '$submission', count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((item) => [String(item._id), item.count]));
  const submissions = await Submission.find({});
  for (const submission of submissions) {
    const count = countMap.get(String(submission._id)) || 0;
    if (['approved', 'published'].includes(submission.reviewState)) {
      submission.completedEvaluationCount = count;
    } else {
      submission.completedEvaluationCount = count;
      submission.reviewState = count >= setting.requiredEvaluations ? 'requirements_met' : count > 0 ? 'in_progress' : 'not_evaluated';
    }
    await submission.save();
  }
  logger.info(`Open judging migration complete: ${legacy.length} legacy evaluations, ${submissions.length} submissions reconciled`);
} finally {
  await disconnectDatabase();
}
