import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ROLES } from '../../constants/roles.js';
import * as controller from './results.controller.js';
import { submissionIdParamSchema, leaderboardQuerySchema, publishSchema } from './results.validation.js';

const router = Router();

router.use(authenticate);

// Publication state: any signed-in user (the UI needs it to decide what to show).
router.get('/status', asyncHandler(controller.getStatus));

router.patch(
  '/publish',
  authorize(ROLES.ADMIN),
  validate({ body: publishSchema }),
  asyncHandler(controller.setPublished),
);

router.get('/stats', authorize(ROLES.ADMIN), asyncHandler(controller.getStats));

router.get(
  '/leaderboard',
  authorize(ROLES.ADMIN, ROLES.CONTESTANT),
  validate({ query: leaderboardQuerySchema }),
  asyncHandler(controller.getLeaderboard),
);

router.get('/mine', authorize(ROLES.CONTESTANT), asyncHandler(controller.getMyResults));

router.get(
  '/projects/:submissionId',
  authorize(ROLES.ADMIN, ROLES.CONTESTANT),
  validate({ params: submissionIdParamSchema }),
  asyncHandler(controller.getProjectResult),
);

export default router;
