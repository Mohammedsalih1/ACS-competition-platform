import multer from "multer";
import ApiError from "../utils/ApiError.js";
import {
  TEMP_DIR,
  MAX_FILE_SIZE,
  ALLOWED_MIME_TYPES,
} from "../config/storage.config.js";

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, TEMP_DIR),
  filename: (_req, _file, cb) => {
    const suffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `temp-${suffix}.zip`);
  },
});

// First layer: rejects wrong MIME before writing to disk.
// Real validation (magic bytes) happens in the service.
const uploadMiddleware = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("UNSUPPORTED_FILE_TYPE"));
    }
  },
});

export default uploadMiddleware;
