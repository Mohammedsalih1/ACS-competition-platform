import AdmZip from "adm-zip";
import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import ApiError from "../../utils/ApiError.js";
import Submission from "../../models/submission.model.js";
import {
  SUBMISSIONS_DIR,
  ZIP_MAGIC_BYTES,
} from "../../config/storage.config.js";

// ── Helpers ─────────────────────────────────────────────────────────

// Checks first 4 bytes against ZIP signature (PK\x03\x04)
async function verifyMagicBytes(filePath) {
  let fh;
  try {
    fh = await fs.open(filePath, "r");
    const buffer = Buffer.alloc(4);
    await fh.read(buffer, 0, 4, 0);
    return ZIP_MAGIC_BYTES.every((b, i) => b === buffer[i]);
  } finally {
    await fh?.close();
  }
}

// Moves file with fallback for cross-device (EXDEV)
async function safeMove(src, dest) {
  try {
    await fs.rename(src, dest);
  } catch (err) {
    if (err.code === "EXDEV") {
      await fs.copyFile(src, dest);
      await fs.unlink(src);
    } else {
      throw err;
    }
  }
}

// Deletes temp file, ignores if already gone
async function cleanupTemp(filePath) {
  try {
    await fs.unlink(filePath);
  } catch {
    // already deleted
  }
}

// Maps OS I/O errors to ApiError
function storageError(err) {
  const unavailable = ["EACCES", "EROFS", "ENOSPC", "EPERM"];
  if (unavailable.includes(err.code)) {
    return new ApiError(503, "Storage unavailable", "STORAGE_UNAVAILABLE");
  }
  return ApiError.internal("Failed to store file", "UPLOAD_FAILED");
}

// ── Public API ──────────────────────────────────────────────────────

// Validates ZIP (magic bytes + structure), stores it, returns metadata
export const processAndStoreZip = async (tempFilePath, submissionId) => {
  try {
    // 1. Magic bytes check
    const isZip = await verifyMagicBytes(tempFilePath);
    if (!isZip) {
      await cleanupTemp(tempFilePath);
      throw new ApiError(
        415,
        "File is not a valid ZIP archive",
        "UNSUPPORTED_FILE_TYPE",
      );
    }

    // 2. ZIP integrity check
    let zip;
    try {
      zip = new AdmZip(tempFilePath);
    } catch {
      await cleanupTemp(tempFilePath);
      throw ApiError.badRequest(
        "Corrupt or unreadable ZIP archive",
        "CORRUPT_ARCHIVE",
      );
    }

    const zipEntries = zip.getEntries();
    if (!zipEntries || zipEntries.length === 0) {
      await cleanupTemp(tempFilePath);
      throw ApiError.badRequest("ZIP archive is empty", "CORRUPT_ARCHIVE");
    }

    // 3. Prepare destination
    const finalDir = path.join(SUBMISSIONS_DIR, String(submissionId));
    try {
      await fs.mkdir(finalDir, { recursive: true });
    } catch (err) {
      await cleanupTemp(tempFilePath);
      throw storageError(err);
    }

    // 4. Move to permanent storage
    const fileId = uuidv4();
    const finalFilePath = path.join(finalDir, `${fileId}.zip`);
    try {
      await safeMove(tempFilePath, finalFilePath);
    } catch (err) {
      await cleanupTemp(tempFilePath);
      throw storageError(err);
    }

    // 5. Return metadata
    const stats = await fs.stat(finalFilePath);
    return {
      fileId,
      fileSize: stats.size,
      storagePath: finalFilePath, // internal — never expose to client
    };
  } catch (error) {
    if (error.code) throw error; // known ApiError
    await cleanupTemp(tempFilePath);
    throw ApiError.internal("File processing failed", "UPLOAD_FAILED");
  }
};

// Returns file path for download, throws NOT_FOUND if missing
export const getFilePath = async (submissionId, fileId) => {
  const filePath = path.join(
    SUBMISSIONS_DIR,
    String(submissionId),
    `${fileId}.zip`,
  );
  try {
    await fs.access(filePath);
  } catch {
    throw ApiError.notFound("File not found");
  }
  return filePath;
};

// Verifies the submission belongs to the user
export const verifyOwnership = async (submissionId, userId) => {
  const submission = await Submission.findOne({ _id: submissionId, userId });
  if (!submission) {
    throw ApiError.forbidden("You do not own this submission");
  }
  return submission;
};
