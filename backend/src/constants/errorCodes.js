/**
 * Machine-readable error codes.
 *
 * Every error response carries one of these in `error.code`. The frontend
 * switches on the CODE, never on the message text - messages are for users/devs
 * and may be re written later.
 *
 * Adding a code: add it here, document it in docs/API.md, notify frontend team if possible.
 */
export const ERROR_CODES = Object.freeze({
  // --- Generic (any module) ---
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',

  // --- Authentication (401): ---
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  REFRESH_TOKEN_MISSING: 'REFRESH_TOKEN_MISSING',
  REFRESH_TOKEN_INVALID: 'REFRESH_TOKEN_INVALID',
  SESSION_REVOKED: 'SESSION_REVOKED',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',

  // --- Authorization (403): ---
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_ROLE: 'INSUFFICIENT_ROLE',

  // --- Users ---
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  CANNOT_MODIFY_SELF: 'CANNOT_MODIFY_SELF',
  LAST_ADMIN: 'LAST_ADMIN',

  // --- File storage / uploads -------------------------------------------
  // Reserved for the storage module so upload failures land in the same
  // envelope as everything else. Defined here, thrown there.
  
  FILE_REQUIRED: 'FILE_REQUIRED',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  UNSUPPORTED_FILE_TYPE: 'UNSUPPORTED_FILE_TYPE',
  CORRUPT_ARCHIVE: 'CORRUPT_ARCHIVE',
  UPLOAD_FAILED: 'UPLOAD_FAILED',
  STORAGE_UNAVAILABLE: 'STORAGE_UNAVAILABLE',

  // --- Judging / Evaluations ------------------------------------------------
  CRITERION_NOT_FOUND: 'CRITERION_NOT_FOUND',
  DUPLICATE_CRITERION_KEY: 'DUPLICATE_CRITERION_KEY',
  CRITERION_IN_USE: 'CRITERION_IN_USE',
  JUDGE_NOT_ASSIGNED: 'JUDGE_NOT_ASSIGNED',
  ALREADY_EVALUATED: 'ALREADY_EVALUATED',
  SCORE_OUT_OF_RANGE: 'SCORE_OUT_OF_RANGE',
  MISSING_CRITERION_SCORE: 'MISSING_CRITERION_SCORE',

  // --- ZIP extraction / project processing --------------------------------
  EXTRACTION_FAILED: 'EXTRACTION_FAILED',
  PATH_TRAVERSAL_DETECTED: 'PATH_TRAVERSAL_DETECTED',
  EMPTY_PROJECT: 'EMPTY_PROJECT',
  FILE_LIMIT_EXCEEDED: 'FILE_LIMIT_EXCEEDED',
});

export default ERROR_CODES;
