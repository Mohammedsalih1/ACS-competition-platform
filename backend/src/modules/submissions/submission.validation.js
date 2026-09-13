/**
 * Submission request schemas.
 *
 * Validation lives beside the routes it guards so the accepted shape of an
 * endpoint is one file away from its handler.
 */
import { z } from 'zod';
import { objectIdSchema } from '../users/user.validation.js';

const liveUrlSchema = z.union([
    z.string().trim().url('Live URL must be a valid URL').max(2048),
    z.literal(''),
]);

export const createSubmissionSchema = z
    .object({
        title: z.string().trim().min(1, 'Title is required').max(200),
        description: z.string().trim().max(5000).optional().default(''),
        liveUrl: liveUrlSchema.optional().default(''),
    })
    .strict();

export const submissionIdParamSchema = z.object({
    submissionId: objectIdSchema,
});

export const updateSubmissionSchema = z
    .object({
        title: z.string().trim().min(1).max(200).optional(),
        description: z.string().trim().max(5000).optional(),
        liveUrl: liveUrlSchema.optional(),
    })
    .strict()
    .refine((data) => Object.keys(data).length > 0, {
        message: 'Provide at least one field to update',
    });

export const listSubmissionsQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    status: z.enum(['draft', 'submitted', 'under_review', 'scored']).optional(),
    sort: z.enum(['createdAt', '-createdAt', 'updatedAt', '-updatedAt']).default('-createdAt'),
});

export const updateSubmissionStatusSchema = z.object({
    status: z.enum(['submitted', 'under_review', 'scored']),
});