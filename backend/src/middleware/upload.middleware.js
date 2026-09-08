import fs from "fs";
import multer from "multer";
import {
  TEMP_DIR,
  MAX_FILE_SIZE,
  ALLOWED_MIME_TYPES,
} from "../config/storage.config.js";

const storage = multer.diskStorage({
  // `storage/` is gitignored, so on a fresh clone the temp directory does not
  // exist yet and multer would fail with a bare ENOENT. Create it on demand
  // rather than relying on a startup hook that only server.js runs.
  destination: (_req, _file, cb) => {
    fs.mkdir(TEMP_DIR, { recursive: true }, (err) => cb(err, TEMP_DIR));
  },
  filename: (_req, _file, cb) => {
    const suffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `temp-${suffix}.zip`);
  },
});

// First layer: rejects wrong MIME before writing to disk.
// Real validation (magic bytes) happens in the service.
const uploadMiddleware = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      // Flagged rather than message-matched, so the route handler does not have
      // to compare error strings to tell this apart from a real failure.
      cb(Object.assign(new Error("UNSUPPORTED_FILE_TYPE"), { code: "UNSUPPORTED_FILE_TYPE" }));
    }
  },
});

export default uploadMiddleware;
