import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ROLES } from '../../constants/roles.js';
import * as controller from './judging.controller.js';
import {
  createCriterionSchema,
  updateCriterionSchema,
  criterionIdParamSchema,
  submissionIdParamSchema,
  createAssignmentSchema,
  bulkAssignSchema,
  submitEvaluationSchema,
} from './judging.validation.js';

const router = Router();

router.use(authenticate);

// ── Criteria ────────────────────────────────────────────────────────

router.get(
  '/criteria',
  authorize(ROLES.ADMIN, ROLES.JUDGE),
  asyncHandler(controller.listCriteria),
);

router.post(
  '/criteria',
  authorize(ROLES.ADMIN),
  validate({ body: createCriterionSchema }),
  asyncHandler(controller.createCriterion),
);

router.patch(
  '/criteria/:criterionId',
  authorize(ROLES.ADMIN),
  validate({ params: criterionIdParamSchema, body: updateCriterionSchema }),
  asyncHandler(controller.updateCriterion),
);

router.delete(
  '/criteria/:criterionId',
  authorize(ROLES.ADMIN),
  validate({ params: criterionIdParamSchema }),
  asyncHandler(controller.deleteCriterion),
);

// ── Assignments ─────────────────────────────────────────────────────

router.get(
  '/assignments',
  authorize(ROLES.ADMIN),
  asyncHandler(controller.listAssignments),
);

router.get(
  '/assignments/mine',
  authorize(ROLES.JUDGE),
  asyncHandler(controller.getMyAssignments),
);

router.post(
  '/assignments',
  authorize(ROLES.ADMIN),
  validate({ body: createAssignmentSchema }),
  asyncHandler(controller.assignJudge),
);

router.post(
  '/assignments/bulk',
  authorize(ROLES.ADMIN),
  validate({ body: bulkAssignSchema }),
  asyncHandler(controller.bulkAssign),
);

router.delete(
  '/assignments',
  authorize(ROLES.ADMIN),
  validate({ body: createAssignmentSchema }),
  asyncHandler(controller.removeAssignment),
);

// ── Evaluations ─────────────────────────────────────────────────────

router.post(
  '/evaluations/:submissionId',
  authorize(ROLES.JUDGE),
  validate({ params: submissionIdParamSchema, body: submitEvaluationSchema }),
  asyncHandler(controller.submitEvaluation),
);

router.get(
  '/evaluations/:submissionId/mine',
  authorize(ROLES.JUDGE),
  validate({ params: submissionIdParamSchema }),
  asyncHandler(controller.getMyEvaluation),
);

router.get(
  '/evaluations/:submissionId',
  authorize(ROLES.ADMIN),
  validate({ params: submissionIdParamSchema }),
  asyncHandler(controller.getEvaluationsForSubmission),
);

export default router;
