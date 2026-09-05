import path from "path";
import fs from "fs/promises";

export const STORAGE_BASE =
  process.env.STORAGE_PATH || path.resolve(process.cwd(), "storage");

export const TEMP_DIR = path.join(STORAGE_BASE, "temp");
export const SUBMISSIONS_DIR = path.join(STORAGE_BASE, "submissions");

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
export const ALLOWED_MIME_TYPES = [
  "application/zip",
  "application/x-zip-compressed",
];

// ZIP local file header signature
export const ZIP_MAGIC_BYTES = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

// Call once at server startup to ensure directories exist
export async function initStorage() {
  await fs.mkdir(TEMP_DIR, { recursive: true });
  await fs.mkdir(SUBMISSIONS_DIR, { recursive: true });
}
