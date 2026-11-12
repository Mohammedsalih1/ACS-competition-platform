import mongoose from 'mongoose';

const rubricCriterionSchema = new mongoose.Schema({
  key: { type: String, required: true },
  name: { type: String, required: true },
  nameAr: { type: String, default: '' },
  description: { type: String, default: '' },
  standard: { type: String, default: '' },
  maxScore: { type: Number, min: 1, max: 100, default: 10 },
  order: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  bonus: { type: Boolean, default: false },
  criterionId: { type: mongoose.Schema.Types.ObjectId, ref: 'JudgingCriteria', default: null },
}, { _id: false });

const versionSchema = new mongoose.Schema({
  version: { type: Number, required: true },
  criteria: { type: [rubricCriterionSchema], required: true },
  bonusEnabled: { type: Boolean, default: true },
  bonusMax: { type: Number, min: 0, max: 20, default: 5 },
  reason: { type: String, default: '' },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const stageSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 2000, default: '' },
  order: { type: Number, required: true, default: 0 },
  status: { type: String, enum: ['draft', 'open', 'judging', 'closed', 'archived'], default: 'draft', index: true },
  requiredEvaluations: { type: Number, min: 1, max: 20, default: 3 },
  rubricVersions: { type: [versionSchema], default: [] },
  activeRubricVersion: { type: Number, default: 1 },
  history: [{ action: String, reason: String, actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, at: { type: Date, default: Date.now } }],
}, { timestamps: true });

stageSchema.index({ order: 1, name: 1 });
export const CompetitionStage = mongoose.model('CompetitionStage', stageSchema);
export const ProjectStageParticipation = mongoose.model('ProjectStageParticipation', new mongoose.Schema({
  submission: { type: mongoose.Schema.Types.ObjectId, ref: 'Submission', required: true, index: true },
  stage: { type: mongoose.Schema.Types.ObjectId, ref: 'CompetitionStage', required: true, index: true },
  version: { type: Number, required: true, default: 1 },
  completedEvaluationCount: { type: Number, min: 0, default: 0 },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assignedAt: { type: Date, default: Date.now },
  active: { type: Boolean, default: true, index: true },
  history: [{ stage: { type: mongoose.Schema.Types.ObjectId, ref: 'CompetitionStage' }, actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, reason: String, at: { type: Date, default: Date.now } }],
}, { timestamps: true }));
