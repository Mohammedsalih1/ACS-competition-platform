/**
 * Submission - a contestant's competition entry.
 *
 * Owned by the submissions module (routes, controller and service live in
 * src/modules/submissions/). A submission is created as a `draft` and flips to
 * `submitted` the first time a ZIP is accepted for it.
 *
 * File records point here via `File.submission` AND are mirrored onto `files`
 * below, so a submission can be read without a second query.
 */
import mongoose from 'mongoose';

export const SUBMISSION_STATUS = Object.freeze({
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  UNDER_REVIEW: 'under_review',
  SCORED: 'scored',
});

const submissionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 5000, default: '' },
    contestant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(SUBMISSION_STATUS),
      default: SUBMISSION_STATUS.DRAFT,
      index: true,
    },
    submittedAt: { type: Date, default: null },
    files: [{ type: mongoose.Schema.Types.ObjectId, ref: 'File' }],
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

export const Submission = mongoose.model('Submission', submissionSchema);
export default Submission;
