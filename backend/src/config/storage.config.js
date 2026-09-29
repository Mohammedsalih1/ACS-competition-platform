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

// ── ZIP extraction settings ──────────────────────────────────────────
export const EXTRACTED_DIR_NAME = "extracted";
export const MAX_EXTRACTED_SIZE = 500 * 1024 * 1024; // 500 MB
export const MAX_FILE_COUNT = 10_000;

// Patterns to skip during extraction (OS junk, editor meta, etc.)
export const IGNORED_PATTERNS = [
  "__MACOSX",
  ".DS_Store",
  "Thumbs.db",
  "desktop.ini",
  ".git",
  ".svn",
  ".hg",
  ".env",
  ".env.local",
  ".env.production",
  "node_modules",
  ".idea",
  ".vscode",
];

// Files/directories never served through the Code Viewer
export const BLOCKED_SERVE_PATTERNS = Object.freeze([
  ".git",
  ".svn",
  ".hg",

  ".env",
  ".env.local",
  ".env.production",
  ".env.staging",
  ".env.development",

  ".pem",
  ".key",
  ".p12",
  ".pfx",
  ".jks",
  ".keystore",

  ".htpasswd",
  ".htaccess",
  ".npmrc",
  ".pypirc",
  ".netrc",

  ".idea",
  ".vscode",

  "__MACOSX",
  ".DS_Store",
  "Thumbs.db",
  "desktop.ini",

  "node_modules",
]);

// Temp files older than this are deleted automatically
export const TEMP_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

// Call once at server startup to ensure directories exist
export async function initStorage() {
  await fs.mkdir(TEMP_DIR, { recursive: true });
  await fs.mkdir(SUBMISSIONS_DIR, { recursive: true });
}
