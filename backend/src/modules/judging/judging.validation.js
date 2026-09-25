import { z } from 'zod';
import { objectIdSchema } from '../users/user.validation.js';

// ── Params ──────────────────────────────────────────────────────────

export const criterionIdParamSchema = z.object({
  criterionId: objectIdSchema,
});

export const submissionIdParamSchema = z.object({
  submissionId: objectIdSchema,
});

// ── Criteria (admin) ────────────────────────────────────────────────

const gradeLevelSchema = z.object({
  min: z.number().int().min(0),
  max: z.number().int().min(0),
  label: z.string().trim().min(1).max(100),
  labelAr: z.string().trim().max(100).optional().default(''),
  description: z.string().trim().max(500).optional().default(''),
});

export const createCriterionSchema = z
  .object({
    key: z.string().trim().toLowerCase().regex(/^[a-z0-9_]+$/, 'Key must be lowercase alphanumeric with underscores').min(1).max(50),
    name: z.string().trim().min(1).max(200),
    nameAr: z.string().trim().max(200).optional().default(''),
    description: z.string().trim().max(2000).optional().default(''),
    descriptionAr: z.string().trim().max(2000).optional().default(''),
    maxScore: z.number().int().min(1).max(100),
    order: z.number().int().min(0).optional().default(0),
    isBonus: z.boolean().optional().default(false),
    gradeLevels: z.array(gradeLevelSchema).optional().default([]),
  })
  .strict();

export const updateCriterionSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    nameAr: z.string().trim().max(200).optional(),
    description: z.string().trim().max(2000).optional(),
    descriptionAr: z.string().trim().max(2000).optional(),
    maxScore: z.number().int().min(1).max(100).optional(),
    order: z.number().int().min(0).optional(),
    isBonus: z.boolean().optional(),
    gradeLevels: z.array(gradeLevelSchema).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });

// ── Assignments (admin) ─────────────────────────────────────────────

export const createAssignmentSchema = z
  .object({
    judgeId: objectIdSchema,
    submissionId: objectIdSchema,
  })
  .strict();

export const bulkAssignSchema = z
  .object({
    judgeId: objectIdSchema,
    submissionIds: z.array(objectIdSchema).min(1).max(100),
  })
  .strict();

// ── Evaluation (judge) ──────────────────────────────────────────────

const criterionScoreSchema = z.object({
  criterionId: objectIdSchema,
  score: z.number().min(0),
  note: z.string().trim().max(1000).optional().default(''),
});

export const submitEvaluationSchema = z
  .object({
    scores: z.array(criterionScoreSchema).min(1),
    generalNote: z.string().trim().max(2000).optional().default(''),
  })
  .strict();
