/**
 * file.routes.js — File & Code Viewer endpoints.
 *
 * All routes require authentication. Access is restricted to judges, admins,
 * and the contestant who owns the submission (enforced in the service layer
 * via getSubmissionForViewer).
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
import { ROLES } from '../../constants/roles.js';
import * as controller from './file.controller.js';
import {
  submissionIdParamSchema,
  folderQuerySchema,
  filePathQuerySchema,
} from './file.validation.js';

const router = Router();

router.use(authenticate);

// GET /files/:submissionId — full project files overview
router.get(
  '/:submissionId',
  authorize(ROLES.CONTESTANT, ROLES.JUDGE, ROLES.ADMIN),
  validate({ params: submissionIdParamSchema }),
  asyncHandler(controller.getProjectFiles),
);

// GET /files/:submissionId/folder?path=src/components
router.get(
  '/:submissionId/folder',
  authorize(ROLES.CONTESTANT, ROLES.JUDGE, ROLES.ADMIN),
  validate({ params: submissionIdParamSchema, query: folderQuerySchema }),
  asyncHandler(controller.getFolderContents),
);

// GET /files/:submissionId/info?path=src/App.jsx
router.get(
  '/:submissionId/info',
  authorize(ROLES.CONTESTANT, ROLES.JUDGE, ROLES.ADMIN),
  validate({ params: submissionIdParamSchema, query: filePathQuerySchema }),
  asyncHandler(controller.getFileInfo),
);

// GET /files/:submissionId/content?path=src/App.jsx
router.get(
  '/:submissionId/content',
  authorize(ROLES.CONTESTANT, ROLES.JUDGE, ROLES.ADMIN),
  validate({ params: submissionIdParamSchema, query: filePathQuerySchema }),
  asyncHandler(controller.getFileContent),
);

export default router;
