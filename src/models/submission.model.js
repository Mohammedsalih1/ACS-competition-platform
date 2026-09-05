import mongoose from "mongoose";

const submissionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: false,
    },

    // File metadata — populated after successful upload
    fileId: { type: String, required: false },
    originalFileName: { type: String, required: false },
    fileSize: { type: Number, required: false },
    mimeType: { type: String, required: false },
    storagePath: {
      type: String,
      required: false,
      select: false, // internal only — never returned in queries
    },

    status: {
      type: String,
      enum: ["PENDING", "SUBMITTED", "FAILED"],
      default: "PENDING",
    },
  },
  { timestamps: true },
);

export default mongoose.model("Submission", submissionSchema);
