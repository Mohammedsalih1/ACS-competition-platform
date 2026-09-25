import mongoose from 'mongoose';

const gradeLevelSchema = new mongoose.Schema(
  {
    min: { type: Number, required: true },
    max: { type: Number, required: true },
    label: { type: String, required: true, trim: true },
    labelAr: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
  },
  { _id: false },
);

const judgingCriteriaSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: /^[a-z0-9_]+$/,
    },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    nameAr: { type: String, trim: true, maxlength: 200, default: '' },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    descriptionAr: { type: String, trim: true, maxlength: 2000, default: '' },
    maxScore: { type: Number, required: true, min: 1 },
    order: { type: Number, required: true, default: 0 },
    isBonus: { type: Boolean, default: false },
    gradeLevels: [gradeLevelSchema],
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
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

export const JudgingCriteria = mongoose.model('JudgingCriteria', judgingCriteriaSchema);
export default JudgingCriteria;
