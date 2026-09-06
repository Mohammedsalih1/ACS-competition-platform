import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ROLES } from "../../constants/roles.js";
import * as controller from "./submission.controller.js";
import uploadMiddleware from "../../middleware/upload.middleware.js";
import ApiError from "../../utils/ApiError.js";

const router = Router();

// Wraps multer errors into ApiError for consistent API responses
const uploadHandler = (req, res, next) => {
  const upload = uploadMiddleware.single("projectFile");
  upload(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return next(
          ApiError.payloadTooLarge("File exceeds 50 MB limit", "FILE_TOO_LARGE"),
        );
      }
      if (err.message === "UNSUPPORTED_FILE_TYPE") {
        return next(
          new ApiError(415, "UNSUPPORTED_FILE_TYPE", "File must be a ZIP archive"),
        );
      }
      return next(ApiError.internal("Upload failed"));
    }
    next();
  });
};

router.use(authenticate);

import { validate } from "../../middleware/validate.js";
import { createSubmissionSchema } from "./submission.validation.js";

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
  uploadHandler,
  asyncHandler(controller.uploadSubmissionFile),
);

// GET /:submissionId/download — download project ZIP
router.get(
  "/:submissionId/download",
  authorize(ROLES.CONTESTANT),
  asyncHandler(controller.downloadSubmissionFile),
);

export default router;
