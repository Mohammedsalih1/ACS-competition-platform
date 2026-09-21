/**
 * File viewer request schemas.
 *
 * Validates the submissionId param and the optional `path` query parameter
 * used by the folder-contents, file-info, and file-content endpoints.
 */
import { z } from 'zod';
import { objectIdSchema } from '../users/user.validation.js';

export const submissionIdParamSchema = z.object({
  submissionId: objectIdSchema,
});

/**
 * The `path` query is a forward-slash–separated relative path inside the
 * extracted project.  Root (empty string or missing) means the project root.
 *
 * Security: the service layer does the real path-traversal check; here we
 * only reject obviously malicious patterns early so they never reach the
 * file-system helpers.
 */
const safePathSchema = z
  .string()
  .trim()
  .max(1024, 'Path too long')
  .refine((p) => !p.includes('..'), { message: 'Path traversal is not allowed' })
  .refine((p) => !p.startsWith('/'), { message: 'Path must be relative' });

export const folderQuerySchema = z.object({
  path: safePathSchema.default(''),
});

export const filePathQuerySchema = z.object({
  path: z
    .string()
    .trim()
    .min(1, 'File path is required')
    .max(1024, 'Path too long')
    .refine((p) => !p.includes('..'), { message: 'Path traversal is not allowed' })
    .refine((p) => !p.startsWith('/'), { message: 'Path must be relative' }),
});
