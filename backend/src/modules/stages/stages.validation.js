import { z } from 'zod';
import { objectIdSchema } from '../users/user.validation.js';

export const stageIdParam = z.object({ stageId: objectIdSchema });
export const createStageBody = z.object({ name: z.string().trim().min(1).max(120), description: z.string().trim().max(2000).optional().default(''), order: z.number().int().min(0).optional().default(0), requiredEvaluations: z.number().int().min(1).max(20).optional().default(3) }).strict();
export const updateStageBody = z.object({ name: z.string().trim().min(1).max(120).optional(), description: z.string().trim().max(2000).optional(), order: z.number().int().min(0).optional(), status: z.enum(['draft', 'open', 'judging', 'closed', 'archived']).optional(), requiredEvaluations: z.number().int().min(1).max(20).optional(), reason: z.string().trim().max(500).optional() }).strict().refine((data) => Object.keys(data).length > 0);
export const rubricBody = z.object({ criteria: z.array(z.object({ key: z.string().regex(/^[a-z0-9_]+$/), active: z.boolean(), maxScore: z.number().int().min(1).max(100) }).strict()).length(9), bonusEnabled: z.boolean().optional(), bonusMax: z.number().int().min(0).max(20).optional(), reason: z.string().trim().min(1).max(500), reopen: z.boolean().optional().default(false) }).strict();
export const assignmentsBody = z.object({ submissionIds: z.array(objectIdSchema).min(1).max(100), reason: z.string().trim().max(500).optional().default('') }).strict();
