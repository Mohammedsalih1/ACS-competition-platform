/**
 * file.routes.js — File & Code Viewer endpoints.
 *
 * Endpoints:
 *   GET /files/:submissionId           — project overview + full nested tree
 *   GET /files/:submissionId/folder    — immediate children of a folder
 *   GET /files/:submissionId/info      — single-file metadata + viewability
 *   GET /files/:submissionId/content   — single-file source code
 */
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { fileLimiter } from '../../middleware/rateLimiters.js';
import { ROLES } from '../../constants/roles.js';
import * as controller from './file.controller.js';
import {
  submissionIdParamSchema,
  folderQuerySchema,
  filePathQuerySchema,
} from './file.validation.js';

const router = Router();

router.use(fileLimiter);
router.use(authenticate);

router.get(
  '/:submissionId',
  authorize(ROLES.CONTESTANT, ROLES.JUDGE, ROLES.ADMIN),
  validate({ params: submissionIdParamSchema }),
  asyncHandler(controller.getProjectFiles),
);

router.get(
  '/:submissionId/folder',
  authorize(ROLES.CONTESTANT, ROLES.JUDGE, ROLES.ADMIN),
  validate({ params: submissionIdParamSchema, query: folderQuerySchema }),
  asyncHandler(controller.getFolderContents),
);

router.get(
  '/:submissionId/info',
  authorize(ROLES.CONTESTANT, ROLES.JUDGE, ROLES.ADMIN),
  validate({ params: submissionIdParamSchema, query: filePathQuerySchema }),
  asyncHandler(controller.getFileInfo),
);

router.get(
  '/:submissionId/content',
  authorize(ROLES.CONTESTANT, ROLES.JUDGE, ROLES.ADMIN),
  validate({ params: submissionIdParamSchema, query: filePathQuerySchema }),
  asyncHandler(controller.getFileContent),
);

export default router;
