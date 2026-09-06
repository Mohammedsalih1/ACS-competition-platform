import mongoose from 'mongoose';

export const UPLOAD_STATUS = Object.freeze({
  PENDING: 'pending',
  UPLOADED: 'uploaded',
  FAILED: 'failed',
});

const fileSchema = new mongoose.Schema(
  {
    submission: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Submission',
      required: true,
      index: true,
    },
    originalFileName: { type: String, required: false },
    fileSize: { type: Number, required: false },
    mimeType: { type: String, required: false },
    storagePath: { type: String, required: false, select: false },
    status: {
      type: String,
      enum: Object.values(UPLOAD_STATUS),
      default: UPLOAD_STATUS.PENDING,
    },
  },
  { timestamps: true },
);

export const File = mongoose.model('File', fileSchema);
export default File;