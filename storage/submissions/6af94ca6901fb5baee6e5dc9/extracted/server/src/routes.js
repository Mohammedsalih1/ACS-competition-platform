import { Router } from 'express';
import { getLocations, areaStatus } from './controllers.js';
import { validate } from './middleware.js';
import { areaStatusSchema } from './schemas.js';

const router = Router();

router.get('/health', (req, res) => res.json({ status: "ok" }))
router.get('/locations', getLocations);
router.get('/areas/:id/status', validate(areaStatusSchema), areaStatus);

export default router;
