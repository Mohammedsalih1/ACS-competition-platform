/**
 * Submission request schemas.
 *
 * Validation lives beside the routes it guards so the accepted shape of an
 * endpoint is one file away from its handler.
 */
import { z } from 'zod';
import { objectIdSchema } from '../users/user.validation.js';

export const createSubmissionSchema = z
    .object({
        title: z.string().trim().min(1, 'Title is required').max(200),
        description: z.string().trim().max(5000).optional().default(''),
    })
    .strict();

export const submissionIdParamSchema = z.object({
    submissionId: objectIdSchema,
});