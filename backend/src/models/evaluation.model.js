import mongoose from 'mongoose';
import { CompetitionStage, ProjectStageParticipation } from './competitionStage.model.js';

const criterionScoreSchema = new mongoose.Schema(
  {
    criterion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'JudgingCriteria',
      required: true,
    },
    score: { type: Number, required: true, min: 0 },
    maxScore: { type: Number, min: 0, default: null },
    note: { type: String, trim: true, maxlength: 1000, default: '' },
  },
  { _id: false },
);

const evaluationSchema = new mongoose.Schema(
  {
    judge: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    submission: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Submission',
      required: true,
      index: true,
    },
    stage: { type: mongoose.Schema.Types.ObjectId, ref: 'CompetitionStage', default: null, index: true },
    participation: { type: mongoose.Schema.Types.ObjectId, ref: 'ProjectStageParticipation', default: null, index: true },
    rubricVersion: { type: Number, default: null },
    rubricSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
    scores: [criterionScoreSchema],
    bonusScore: { type: Number, min: 0, max: 5, default: 0 },
    totalScore: { type: Number, min: 0, default: 0 },
    generalNote: { type: String, trim: true, maxlength: 2000, default: '' },
    status: {
      type: String,
      enum: ['draft', 'submitted', 'invalidated'],
      default: 'submitted',
      index: true,
    },
    projectVersion: { type: mongoose.Schema.Types.ObjectId, ref: 'File', default: null },
    submittedAt: { type: Date, default: null },
    history: {
      type: [{
        action: { type: String, enum: ['draft_saved', 'submitted', 'invalidated'], required: true },
        actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        reason: { type: String, trim: true, maxlength: 500, default: '' },
        at: { type: Date, default: Date.now },
      }],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: {
      versionKey: false,
      transform: (_doc, ret) => {
        ret.id = ret._id?.toString();
        delete ret._id;
        return ret;
      },
    },
  },
);

evaluationSchema.index({ judge: 1, participation: 1, rubricVersion: 1 }, { unique: true, partialFilterExpression: { participation: { $type: 'objectId' } } });
evaluationSchema.index({ submission: 1, status: 1, submittedAt: 1 });

export const Evaluation = mongoose.model('Evaluation', evaluationSchema);
export default Evaluation;
