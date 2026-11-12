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
    liveUrl: { type: String, trim: true, maxlength: 2048, default: '' },
    contestant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    stageParticipation: { type: mongoose.Schema.Types.ObjectId, ref: 'ProjectStageParticipation', default: null, index: true },
    status: {
      type: String,
      enum: Object.values(SUBMISSION_STATUS),
      default: SUBMISSION_STATUS.DRAFT,
      index: true,
    },
    submittedAt: { type: Date, default: null },
    files: [{ type: mongoose.Schema.Types.ObjectId, ref: 'File' }],
    completedEvaluationCount: { type: Number, min: 0, default: 0 },
    reviewState: {
      type: String,
      enum: ['not_evaluated', 'in_progress', 'requirements_met', 'approved', 'published'],
      default: 'not_evaluated',
      index: true,
    },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
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

// Supports the administrative directory and contestant dashboard without
// scanning the full submissions collection.
submissionSchema.index({ status: 1, submittedAt: -1 });
submissionSchema.index({ contestant: 1, createdAt: -1 });

export const Submission = mongoose.model('Submission', submissionSchema);
export default Submission;
