import mongoose from 'mongoose';

/**
 * Singleton document holding the results publication state. Identified by a
 * fixed `key` so there is only ever one row.
 */
const resultsSettingSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'results', unique: true },
    published: { type: Boolean, default: false },
    publishedAt: { type: Date, default: null },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
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

export const ResultsSetting = mongoose.model('ResultsSetting', resultsSettingSchema);
export default ResultsSetting;
