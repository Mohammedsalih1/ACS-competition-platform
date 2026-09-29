/**
 * fileCleanup — temp file cleanup and submission file removal.
 */
import fs from 'fs/promises';
import path from 'path';
import { logger } from './logger.js';
import {
  TEMP_DIR,
  SUBMISSIONS_DIR,
  TEMP_MAX_AGE_MS,
} from '../config/storage.config.js';

/** Remove stale files from the temp upload directory. */
export async function cleanupTempFiles() {
  let deleted = 0;
  let errors = 0;

  try {
    const entries = await fs.readdir(TEMP_DIR, { withFileTypes: true });
    const now = Date.now();

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const filePath = path.join(TEMP_DIR, entry.name);
      try {
        const stats = await fs.stat(filePath);
        if (now - stats.mtimeMs > TEMP_MAX_AGE_MS) {
          await fs.unlink(filePath);
          deleted++;
          logger.info(`[cleanup] Removed stale temp file: ${entry.name}`);
        }
      } catch (err) {
        errors++;
        logger.warn(`[cleanup] Failed to process temp file ${entry.name}:`, err.message);
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      logger.error('[cleanup] Failed to read temp directory:', err.message);
    }
  }

  return { deleted, errors };
}

/** Delete all disk files for a submission. */
export async function cleanupSubmissionFiles(submissionId) {
  const submissionDir = path.join(SUBMISSIONS_DIR, String(submissionId));
  try {
    await fs.rm(submissionDir, { recursive: true, force: true });
    logger.info(`[cleanup] Removed submission directory: ${submissionId}`);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      logger.error(`[cleanup] Failed to remove submission dir ${submissionId}:`, err.message);
    }
  }
}

/** Delete a single file from disk. */
export async function removeFileFromDisk(storagePath) {
  if (!storagePath) return false;
  try {
    await fs.unlink(storagePath);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') return false;
    logger.error(`[cleanup] Failed to remove file ${storagePath}:`, err.message);
    throw err;
  }
}

/** Remove an extracted directory. */
export async function removeExtractedDir(extractedPath) {
  if (!extractedPath) return false;
  try {
    await fs.rm(extractedPath, { recursive: true, force: true });
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') return false;
    logger.error(`[cleanup] Failed to remove extracted dir ${extractedPath}:`, err.message);
    throw err;
  }
}
