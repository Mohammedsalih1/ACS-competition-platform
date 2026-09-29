/**
 * securePath — centralized path-safety checks.
 *
 * Protects against path traversal, null-byte injection,
 * encoded sequences, and access to blocked files.
 */
import path from 'path';
import ApiError from './ApiError.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
import { BLOCKED_SERVE_PATTERNS } from '../config/storage.config.js';

const ENCODED_TRAVERSAL_RE = /(%2e|%252e|%c0%ae|%e0%40%ae)/i;
const NULL_BYTE_RE = /\0|%00/i;

/**
 * Sanitize a user-supplied relative path.
 * Throws ApiError if any suspicious pattern is found.
 */
export function sanitizePath(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') {
    throw ApiError.badRequest('File path is required', ERROR_CODES.BAD_REQUEST);
  }

  if (NULL_BYTE_RE.test(inputPath)) {
    throw new ApiError(400, ERROR_CODES.PATH_TRAVERSAL_DETECTED, 'Path contains null bytes');
  }

  if (ENCODED_TRAVERSAL_RE.test(inputPath)) {
    throw new ApiError(400, ERROR_CODES.PATH_TRAVERSAL_DETECTED, 'Path contains encoded traversal sequence');
  }

  let normalized = inputPath.replace(/\\/g, '/');

  if (normalized.startsWith('/') || path.isAbsolute(normalized)) {
    throw new ApiError(400, ERROR_CODES.PATH_TRAVERSAL_DETECTED, 'Path must be relative');
  }

  const segments = normalized.split('/');
  if (segments.some((s) => s === '..')) {
    throw new ApiError(400, ERROR_CODES.PATH_TRAVERSAL_DETECTED, 'Path traversal is not allowed');
  }

  normalized = segments.filter((s) => s !== '' && s !== '.').join('/');
  return normalized;
}

/**
 * Resolve a relative path against a root directory.
 * Guarantees the resolved path stays inside rootDir.
 */
export function resolveSecure(rootDir, inputPath) {
  const safe = sanitizePath(inputPath);
  const absolute = path.join(rootDir, safe);
  const resolved = path.resolve(absolute);
  const resolvedRoot = path.resolve(rootDir);

  if (!resolved.startsWith(resolvedRoot + path.sep) && resolved !== resolvedRoot) {
    throw new ApiError(400, ERROR_CODES.PATH_TRAVERSAL_DETECTED, 'Resolved path escapes the project directory');
  }

  return resolved;
}

/**
 * Check whether a file path points to a sensitive/blocked file.
 */
export function isBlockedFile(filePath) {
  if (!filePath || typeof filePath !== 'string') return { blocked: false };
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  const segments = normalized.split('/');
  const basename = segments[segments.length - 1];

  for (const pattern of BLOCKED_SERVE_PATTERNS) {
    const lowerPattern = pattern.toLowerCase();

    if (segments.some((seg) => seg === lowerPattern)) {
      return { blocked: true, reason: `Access to '${pattern}' is not allowed` };
    }

    if (lowerPattern.startsWith('.') && basename.endsWith(lowerPattern)) {
      return { blocked: true, reason: `Files of type '${pattern}' cannot be viewed` };
    }

    if (basename === lowerPattern) {
      return { blocked: true, reason: `Access to '${pattern}' is not allowed` };
    }
  }

  return { blocked: false };
}
