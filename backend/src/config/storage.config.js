import path from "path";
import fs from "fs/promises";
import { env } from "./env.js";

export const STORAGE_BASE =
  env.STORAGE_PATH || path.resolve(process.cwd(), "storage");

export const TEMP_DIR = path.join(STORAGE_BASE, "temp");
export const SUBMISSIONS_DIR = path.join(STORAGE_BASE, "submissions");

export const MAX_FILE_SIZE = env.MAX_UPLOAD_SIZE_MB * 1024 * 1024;
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
