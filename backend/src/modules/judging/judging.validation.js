import { z } from 'zod';
import { objectIdSchema } from '../users/user.validation.js';

export const criterionIdParamSchema = z.object({ criterionId: objectIdSchema });
export const submissionIdParamSchema = z.object({ submissionId: objectIdSchema });

const gradeLevelSchema = z.object({
  min: z.number().int().min(0), max: z.number().int().min(0),
  label: z.string().trim().min(1).max(100), labelAr: z.string().trim().max(100).optional().default(''),
  description: z.string().trim().max(500).optional().default(''),
  descriptionAr: z.string().trim().max(500).optional().default(''),
});
export const createCriterionSchema = z.object({
  key: z.string().trim().toLowerCase().regex(/^[a-z0-9_]+$/).min(1).max(50),
  name: z.string().trim().min(1).max(200), nameAr: z.string().trim().max(200).optional().default(''),
  description: z.string().trim().max(2000).optional().default(''), descriptionAr: z.string().trim().max(2000).optional().default(''),
  standard: z.string().trim().max(500).optional().default(''), standardAr: z.string().trim().max(500).optional().default(''),
  verificationMethodAr: z.string().trim().max(2000).optional().default(''),
  maxScore: z.number().int().min(1).max(100), order: z.number().int().min(0).optional().default(0),
  isBonus: z.boolean().optional().default(false), gradeLevels: z.array(gradeLevelSchema).optional().default([]),
}).strict();
export const updateCriterionSchema = createCriterionSchema.partial().omit({ key: true }).extend({ isActive: z.boolean().optional() }).refine((v) => Object.keys(v).length > 0);
const criterionScoreSchema = z.object({ criterionId: objectIdSchema, score: z.number().int().min(0).max(100), note: z.string().trim().max(1000).optional().default('') }).strict();
export const evaluationSchema = z.object({
  scores: z.array(criterionScoreSchema).max(8).default([]), bonusScore: z.number().int().min(0).max(20).default(0),
  generalNote: z.string().trim().max(2000).optional().default(''),
}).strict();
export const settingSchema = z.object({ requiredEvaluations: z.number().int().min(1).max(20), reason: z.string().trim().max(500).optional().default('') }).strict();
