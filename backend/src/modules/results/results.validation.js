import { z } from 'zod';
import { objectIdSchema } from '../users/user.validation.js';

export const submissionIdParamSchema = z.object({
  submissionId: objectIdSchema,
});

export const leaderboardQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const publishSchema = z
  .object({
    published: z.boolean(),
  })
  .strict();
