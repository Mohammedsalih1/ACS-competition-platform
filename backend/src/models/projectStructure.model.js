/**
 * ProjectStructure — stores the extracted file tree of a submission's ZIP.
 *
 * Created by the extraction service after a ZIP is successfully unpacked.
 * The `tree` array is a flat list; the frontend can rebuild the hierarchy
 * using the `depth` and `path` fields or consume the nested version from
 * the API response (built by extraction.service.buildNestedTree).
 */
import mongoose from 'mongoose';

const treeEntrySchema = new mongoose.Schema(
  {
    path: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, enum: ['file', 'directory'], required: true },
    size: { type: Number, default: 0 },
    extension: { type: String, default: null },
    fileType: { type: String, default: null },
    depth: { type: Number, required: true },
  },
  { _id: false },
);

export const STRUCTURE_STATUS = Object.freeze({
  PENDING: 'pending',
  EXTRACTED: 'extracted',
  FAILED: 'failed',
});

const projectStructureSchema = new mongoose.Schema(
  {
    submission: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Submission',
      required: true,
    },
    file: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'File',
      required: true,
    },
    rootPath: { type: String, required: true },
    totalFiles: { type: Number, default: 0 },
    totalFolders: { type: Number, default: 0 },
    totalSize: { type: Number, default: 0 },
    tree: [treeEntrySchema],
    status: {
      type: String,
      enum: Object.values(STRUCTURE_STATUS),
      default: STRUCTURE_STATUS.PENDING,
    },
    error: { type: String, default: null },
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

// One structure per submission (latest extraction wins)
projectStructureSchema.index({ submission: 1 }, { unique: true });

export const ProjectStructure = mongoose.model('ProjectStructure', projectStructureSchema);
export default ProjectStructure;
