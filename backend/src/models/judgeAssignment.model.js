import mongoose from 'mongoose';

const judgeAssignmentSchema = new mongoose.Schema(
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
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
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

judgeAssignmentSchema.index({ judge: 1, submission: 1 }, { unique: true });

export const JudgeAssignment = mongoose.model('JudgeAssignment', judgeAssignmentSchema);
export default JudgeAssignment;
