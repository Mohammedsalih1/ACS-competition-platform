import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { CompetitionStage, ProjectStageParticipation } from '../models/competitionStage.model.js';
import JudgingCriteria from '../models/judgingCriteria.model.js';
import Submission from '../models/submission.model.js';
import Evaluation from '../models/evaluation.model.js';
import { logger } from '../utils/logger.js';

const run = async () => {
  await connectDatabase();
  const criteria = await JudgingCriteria.find().sort('order').lean();
  if (criteria.filter((item) => !item.isBonus).length !== 8 || criteria.filter((item) => item.isBonus).length !== 1) throw new Error('Official rubric is incomplete; run npm run seed:criteria first.');
  let stage = await CompetitionStage.findOne({ name: 'Initial Competition Stage' });
  if (!stage) {
    stage = await CompetitionStage.create({ name: 'Initial Competition Stage', description: 'Default stage created to preserve existing project eligibility.', order: 1, status: 'open', requiredEvaluations: 3, activeRubricVersion: 1, rubricVersions: [{ version: 1, criteria: criteria.map((item) => ({ criterionId: item._id, key: item.key, name: item.name, nameAr: item.nameAr, description: item.description, standard: item.standard, maxScore: item.maxScore, order: item.order, active: true, bonus: item.isBonus })), bonusEnabled: true, bonusMax: criteria.find((item) => item.isBonus).maxScore, reason: 'Compatibility migration: official default rubric' }], history: [{ action: 'created', reason: 'Idempotent legacy data migration' }] });
  }
  const submissions = await Submission.find({ status: { $ne: 'draft' } }).select('_id').lean();
  let assigned = 0;
  for (const submission of submissions) {
    if (!await ProjectStageParticipation.exists({ submission: submission._id, active: true })) {
      const participation = await ProjectStageParticipation.create({ submission: submission._id, stage: stage._id, version: stage.activeRubricVersion, completedEvaluationCount: 0, history: [{ stage: stage._id, reason: 'Compatibility migration; existing evaluations remain legacy' }] });
      await Submission.updateOne({ _id: submission._id }, { $set: { stageParticipation: participation._id } });
      assigned += 1;
    }
  }
  const indexes = await Evaluation.collection.indexes();
  const legacyIndex = indexes.find((item) => item.name === 'judge_1_submission_1');
  if (legacyIndex?.unique && !legacyIndex.partialFilterExpression) await Evaluation.collection.dropIndex(legacyIndex.name);
  await Evaluation.collection.createIndex({ judge: 1, submission: 1 }, { unique: true, partialFilterExpression: { participation: null } });
  await Evaluation.collection.createIndex({ judge: 1, participation: 1, rubricVersion: 1 }, { unique: true, partialFilterExpression: { participation: { $type: 'objectId' } } });
  logger.info(`Stage migration complete: ${assigned} projects assigned. Historical evaluations preserved as legacy records.`);
  await disconnectDatabase();
};

run().catch(async (error) => { logger.error('Stage migration failed:', error); await disconnectDatabase().catch(() => {}); process.exitCode = 1; });
