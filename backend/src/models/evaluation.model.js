import mongoose from 'mongoose';

const criterionScoreSchema = new mongoose.Schema(
  {
    criterion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'JudgingCriteria',
      required: true,
    },
    score: { type: Number, required: true, min: 0 },
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
    scores: [criterionScoreSchema],
    totalScore: { type: Number, required: true, min: 0 },
    generalNote: { type: String, trim: true, maxlength: 2000, default: '' },
    submittedAt: { type: Date, default: Date.now },
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

evaluationSchema.index({ judge: 1, submission: 1 }, { unique: true });

export const Evaluation = mongoose.model('Evaluation', evaluationSchema);
export default Evaluation;
