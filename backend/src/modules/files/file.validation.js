/**
 * File viewer request schemas.
 */
import { z } from 'zod';
import { objectIdSchema } from '../users/user.validation.js';

export const submissionIdParamSchema = z.object({
  submissionId: objectIdSchema,
});

// Security refinements for file/folder paths
const NULL_BYTE_RE = /\0|%00/i;
const ENCODED_TRAVERSAL_RE = /(%2e|%252e|%c0%ae|%e0%40%ae)/i;

const safePathRefine = (schema) =>
  schema
    .refine((p) => !NULL_BYTE_RE.test(p), { message: 'Path contains invalid characters' })
    .refine((p) => !p.includes('..'), { message: 'Path traversal is not allowed' })
    .refine((p) => !p.startsWith('/'), { message: 'Path must be relative' })
    .refine((p) => !p.includes('\\'), { message: 'Backslash paths are not allowed' })
    .refine((p) => !ENCODED_TRAVERSAL_RE.test(p), { message: 'Encoded path traversal is not allowed' });

export const folderQuerySchema = z.object({
  path: safePathRefine(
    z.string().trim().max(1024, 'Path too long'),
  ).default(''),
});

export const filePathQuerySchema = z.object({
  path: safePathRefine(
    z.string().trim().min(1, 'File path is required').max(1024, 'Path too long'),
  ),
});
