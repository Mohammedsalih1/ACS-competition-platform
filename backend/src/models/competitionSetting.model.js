import mongoose from 'mongoose';

const settingHistorySchema = new mongoose.Schema(
  {
    from: { type: Number, required: true },
    to: { type: Number, required: true },
    reason: { type: String, trim: true, maxlength: 500, default: '' },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const competitionSettingSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, default: 'judging' },
    requiredEvaluations: { type: Number, min: 1, max: 20, default: 3 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    history: { type: [settingHistorySchema], default: [] },
  },
  { timestamps: true },
);

export default mongoose.model('CompetitionSetting', competitionSettingSchema);
