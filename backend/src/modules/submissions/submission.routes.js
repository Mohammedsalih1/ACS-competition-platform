import fs from "fs/promises";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ROLES } from "../../constants/roles.js";
import * as controller from "./submission.controller.js";
import uploadMiddleware from "../../middleware/upload.middleware.js";
import ApiError from "../../utils/ApiError.js";
import { ERROR_CODES } from "../../constants/errorCodes.js";
import {
  createSubmissionSchema,
  submissionIdParamSchema,
} from "./submission.validation.js";

const router = Router();

// Wraps multer errors into ApiError for consistent API responses.
const uploadHandler = (req, res, next) => {
  const upload = uploadMiddleware.single("projectFile");
  upload(req, res, async (err) => {
    if (!err) return next();

    // Multer streams to disk before it enforces the size limit, so an oversized
    // upload leaves a partial file behind. Nothing downstream runs, so clean up
    // here or the temp directory grows on every rejected request.
    if (req.file?.path) await fs.unlink(req.file.path).catch(() => {});

    if (err.code === "LIMIT_FILE_SIZE") {
      return next(
        ApiError.payloadTooLarge(
          "File exceeds 50 MB limit",
          ERROR_CODES.FILE_TOO_LARGE,
        ),
      );
    }
    if (err.code === "UNSUPPORTED_FILE_TYPE") {
      return next(
        new ApiError(
          415,
          ERROR_CODES.UNSUPPORTED_FILE_TYPE,
          "File must be a ZIP archive",
        ),
      );
    }
    // Wrong field name, too many parts, too many files: all client mistakes.
    // Reporting them as 500 would tell the frontend to retry a request that can
    // never succeed.
    if (err.name === "MulterError") {
      return next(
        ApiError.badRequest(
          `Invalid upload request (${err.code}). Send the archive as a single "projectFile" field.`,
          ERROR_CODES.UPLOAD_FAILED,
        ),
      );
    }
    return next(ApiError.internal("Upload failed"));
  });
};

router.use(authenticate);

// POST / — create a new submission
router.post(
  "/",
  authorize(ROLES.CONTESTANT),
  validate({ body: createSubmissionSchema }),
  asyncHandler(controller.createSubmission),
);

// POST /:submissionId/upload — upload project ZIP
router.post(
  "/:submissionId/upload",
  authorize(ROLES.CONTESTANT),
  validate({ params: submissionIdParamSchema }),
  uploadHandler,
  asyncHandler(controller.uploadSubmissionFile),
);

// GET /:submissionId/download — download project ZIP
router.get(
  "/:submissionId/download",
  authorize(ROLES.CONTESTANT),
  validate({ params: submissionIdParamSchema }),
  asyncHandler(controller.downloadSubmissionFile),
);

export default router;
