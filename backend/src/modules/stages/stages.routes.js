import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ROLES } from '../../constants/roles.js';
import * as controller from './stages.controller.js';
import { validate } from '../../middleware/validate.js';
import { stageIdParam, createStageBody, updateStageBody, rubricBody, assignmentsBody } from './stages.validation.js';

const router = Router();
router.use(authenticate);
router.get('/', authorize(ROLES.ADMIN, ROLES.JUDGE), asyncHandler(controller.list));
router.post('/', authorize(ROLES.ADMIN), validate({ body: createStageBody }), asyncHandler(controller.create));
router.patch('/:stageId', authorize(ROLES.ADMIN), validate({ params: stageIdParam, body: updateStageBody }), asyncHandler(controller.update));
router.put('/:stageId/rubric', authorize(ROLES.ADMIN), validate({ params: stageIdParam, body: rubricBody }), asyncHandler(controller.updateRubric));
router.put('/:stageId/projects', authorize(ROLES.ADMIN), validate({ params: stageIdParam, body: assignmentsBody }), asyncHandler(controller.assign));
router.get('/:stageId/projects', authorize(ROLES.ADMIN, ROLES.JUDGE), validate({ params: stageIdParam }), asyncHandler(controller.projects));
export default router;
