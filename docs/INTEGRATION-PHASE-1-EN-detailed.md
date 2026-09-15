# Integration Phase 1 — Full Platform Merge, Stabilization & Issue Report

**Owner:** Altyeb Abd Eljalil
**Branch:** `integration`
**Date:** 2026-09-08

---

## A. Integration Status

### What was merged

All four Phase 1 workstreams now live in a single repository on `integration`:

| Workstream | Source branch | Landed as |
| --- | --- | --- |
| Backend — Foundation, Auth & Authorization | `backend-foundation` | `backend/src/{config,middleware,models,modules/auth,modules/users,utils}` |
| Backend — File Storage & ZIP Upload | `feature/Zuhair-File-Storage`, `zuhair-uploads` | `backend/src/modules/submissions`, `backend/src/middleware/upload.middleware.js`, `backend/src/config/storage.config.js`, `backend/src/models/{file,submission}.model.js` |
| Frontend — Authentication & Contestant Interface | `awab-f402` (`AwabAbdelbagi/F-402`) | `src/{api,context,hooks,pages,components/common,components/layout,components/ui}` |
| Frontend — Judge Dashboard & Project Management | `main` line | `src/{layouts,routes,pages/judge,components/judge}` |

The repository is one unit: a Vite/React frontend at the root and an Express/MongoDB backend under `backend/`, each with its own `package.json` and its own lint and test tooling.

### State after the merge

**Backend — working.** Boots, connects to MongoDB, prepares its storage directories, and serves `/api/v1`. Auth, authorization, user management and the full ZIP upload pipeline are live and covered by tests.

**Frontend — working.** `npm run build` succeeds (2068 modules). Login, session restore, role-based routing and the judge UI all render. The judge pages are still driven by local mock data — see §C.1, this is a backend gap, not a frontend one.

### Flows tested and results

Verified by three automated suites (`npm test` inside `backend/`) — **198 assertions, 0 failures**:

| Suite | Command | Assertions | Result |
| --- | --- | --- | --- |
| Wiring check (no database) | `npm run check` | 98 | Pass |
| Auth end-to-end | `npm run smoke` | 43 | Pass |
| Submissions & upload end-to-end | `npm run smoke:uploads` | 57 | Pass (+3 documented gaps) |

Flows exercised end-to-end against a real in-memory MongoDB and a real temporary filesystem — no mocks, no stubbed multer:

- **Login / session / permissions** — valid and invalid credentials, no user enumeration, httpOnly refresh cookie, refresh rotation, stolen-token reuse detection (whole family revoked), logout, idempotent logout.
- **Role separation** — contestant / judge / admin enforced server-side on every request; a contestant hitting an admin route gets `403 INSUFFICIENT_ROLE`; account disabling revokes an in-flight access token immediately; a password change invalidates every token issued before it.
- **Submission creation** — contestant-only; `status` and `contestant` cannot be smuggled through the body; title validation.
- **ZIP upload** — happy path, byte-for-byte disk verification, correct storage layout, `draft → submitted` transition, re-upload keeping revisions, and every rejection path (no file, wrong mime, renamed non-ZIP, corrupt archive, empty archive, oversize, wrong field name).
- **Ownership** — a contestant cannot upload to or download another contestant's submission; malformed and non-existent ids are handled without a 500.
- **Download** — owner receives the newest revision as a ZIP attachment; `404` when nothing is uploaded yet.
- **Error envelope** — every failure returns `{ success: false, error: { code, message } }` with a `requestId`, and internal details never leak.

**Not verified end-to-end:** the browser-to-backend upload has no UI yet (§C.1), so the multipart path was verified at the HTTP layer with a real `FormData` request rather than through a rendered form.

---

## B. Problems Found

Fourteen issues surfaced during and after the merge. All are fixed unless the status says otherwise.

### B1 — `multer` was declared in the frontend's `package.json`

- **Problem:** The backend imports `multer`, but it was listed in the root (frontend) `package.json` and absent from `backend/package.json`. It only worked because Node walks up to the root `node_modules`. A clean `npm ci` inside `backend/` would produce a server that crashes on the first upload.
- **Where:** `package.json`, `backend/package.json`, `backend/src/middleware/upload.middleware.js`
- **Root cause:** The `mutler added` commit installed the dependency from the repository root instead of from `backend/`.
- **Fix:** Moved `multer@^2.3.0` to `backend/package.json` and removed it from the frontend; reinstalled so it resolves locally.
- **Status:** Resolved.

### B2 — `initStorage()` was never called

- **Problem:** `storage/temp` and `storage/submissions` were only created by `initStorage()`, which nothing invoked. `storage/` is gitignored, so on any fresh clone the first upload failed with a bare `ENOENT` reported as a `500`. It worked locally only because those directories already existed from earlier manual testing.
- **Where:** `backend/src/config/storage.config.js`, `backend/src/server.js`
- **Root cause:** The storage module shipped the bootstrap helper; wiring it into startup was never picked up on either side of the merge.
- **Fix:** `server.js` now awaits `initStorage()` before listening and exits with a clear message if it fails. Additionally, multer's `destination` creates the temp directory on demand, so the app is correct even when booted through `createApp()` without `server.js` (as tests do).
- **Status:** Resolved. Covered by `initStorage() creates both directories on a fresh install`.

### B3 — A password change did not invalidate tokens issued in the same second

- **Problem:** The existing `npm run smoke` suite was **already failing** on `tokens issued before the change are rejected` — consistently, not intermittently.
- **Where:** `backend/src/models/user.model.js`
- **Root cause:** `passwordChangedAt` was deliberately backdated one second (`Date.now() - 1000`) and compared with a strict `>`. Since JWT `iat` has second precision, a token minted in the same second as the change — or the second before — compared as *newer* than the change and survived it. A stolen access token outlived the password change meant to kill it.
- **Fix:** Removed the backdating and changed the comparison to `>=`, so the check fails closed. This costs nothing legitimate: `changePassword` issues no new token, revokes all sessions, clears the refresh cookie and tells the user to log in again.
- **Status:** Resolved. `npm run smoke` went from 42/43 to 43/43.

### B4 — A corrupt ZIP returned `500` instead of `400`

- **Problem:** An archive with valid `PK\x03\x04` magic bytes but a damaged central directory produced an unhandled `500 INTERNAL_ERROR`.
- **Where:** `backend/src/modules/submissions/submission.service.js`
- **Root cause:** AdmZip parses lazily. `new AdmZip(path)` was wrapped in `try/catch`, but `zip.getEntries()` — the call that actually throws — sat outside it, so the `CORRUPT_ARCHIVE` branch was unreachable for the exact input it existed to catch.
- **Fix:** Moved `getEntries()` inside the guard.
- **Status:** Resolved. Covered by `a corrupt archive returns 400 CORRUPT_ARCHIVE, not a 500`.

### B5 — Raw filesystem errors escaped the error vocabulary

- **Problem:** The upload service's outer catch used `if (error.code) throw error;` with the comment `// known ApiError`. Node's `fs` errors also carry a `.code` (`ENOENT`, `EACCES`, `EPERM`), so they were rethrown unmapped *and* skipped the temp-file cleanup on the line below.
- **Where:** `backend/src/modules/submissions/submission.service.js`
- **Root cause:** `.code` is not a reliable marker for "this is one of ours".
- **Fix:** Changed the test to `error instanceof ApiError`.
- **Status:** Resolved.

### B6 — An oversized upload leaked a partial file into `storage/temp`

- **Problem:** Multer streams to disk and only then enforces `limits.fileSize`. On `LIMIT_FILE_SIZE` the route returned `413` correctly but nothing deleted the partial file, so the temp directory grew on every rejected request.
- **Where:** `backend/src/modules/submissions/submission.routes.js`
- **Root cause:** The error branch returned before any cleanup ran; the controller's `unlink` only covers errors raised *after* multer succeeds.
- **Fix:** The upload wrapper now unlinks `req.file?.path` before mapping any multer error.
- **Status:** Resolved. Covered by `an oversized upload does not leave a partial file in temp/`.

### B7 — A wrong form-field name returned `500`

- **Problem:** Sending the archive under any field other than `projectFile` produced `500 "Upload failed"`, telling the frontend to retry a request that could never succeed.
- **Where:** `backend/src/modules/submissions/submission.routes.js`
- **Root cause:** The wrapper mapped only `LIMIT_FILE_SIZE` and `UNSUPPORTED_FILE_TYPE`; every other `MulterError` (including `LIMIT_UNEXPECTED_FILE`) fell through to `ApiError.internal`.
- **Fix:** Any `MulterError` is now a `400 UPLOAD_FAILED` naming the expected field.
- **Status:** Resolved.

### B8 — The mime-type rejection was matched on error message text

- **Problem:** The mime filter rejected with `new Error("UNSUPPORTED_FILE_TYPE")` and the route identified it with `err.message === "UNSUPPORTED_FILE_TYPE"`. Rewording the message would silently turn a `415` into a `500`.
- **Where:** `backend/src/middleware/upload.middleware.js`, `backend/src/modules/submissions/submission.routes.js`
- **Fix:** The filter now attaches a real `code` property and the route matches on that. Removed an unused `ApiError` import from the middleware.
- **Status:** Resolved.

### B9 — `submissionIdParamSchema` was written but never mounted

- **Problem:** The param schema existed and was unused, so a malformed id such as `/submissions/abc/upload` reached Mongo and surfaced as a confusing `Invalid value for '_id'`. On upload, multer had already written the file to disk before the id was found to be invalid.
- **Where:** `backend/src/modules/submissions/submission.routes.js`
- **Fix:** Mounted `validate({ params: submissionIdParamSchema })` on both `:submissionId` routes, ahead of the upload handler so a bad id is rejected before any bytes are written.
- **Status:** Resolved. Both routes now return `400 VALIDATION_ERROR`.

### B10 — The frontend API client broke every multipart upload

- **Problem:** `api()` unconditionally set `Content-Type: application/json`. Any `FormData` body would have had its multipart boundary destroyed, and multer would have seen no file at all.
- **Where:** `src/api/client.js`
- **Root cause:** The client was written against the JSON-only auth API before the upload endpoints existed.
- **Fix:** The client detects a `FormData` body and lets the browser set the header. This is latent rather than user-visible today only because no upload UI exists yet (§C.1) — it would have blocked the first attempt to build one.
- **Status:** Resolved.

### B11 — The API base URL was hardcoded

- **Problem:** `const API = 'http://localhost:5000/api/v1'` — no environment override, so the frontend could not point at any deployed backend.
- **Where:** `src/api/client.js`
- **Fix:** Now reads `import.meta.env.VITE_API_URL` with the localhost value as the fallback. Added a root `.env.example` documenting it and its required agreement with the backend's `PORT`, `API_PREFIX` and `CORS_ORIGINS`.
- **Status:** Resolved.

### B12 — Two broken images after the merge

- **Problem:** `src/pages/Login.jsx` referenced `/logo.png` and `src/components/layout/Sidebar.jsx` referenced `/logo-white.png`. Neither file exists in `public/` — it holds only `favicon.svg` and `icons.svg`. Both rendered as broken images, one of them on the login screen.
- **Where:** `src/pages/Login.jsx`, `src/components/layout/Sidebar.jsx`
- **Root cause:** The assets lived in the frontend author's `public/` and were not carried across in the merge; the judge sidebar was unaffected because it imports `src/assets/acs-logo.png` through the bundler instead.
- **Fix:** Both now import `src/assets/acs-logo.png`, matching the judge sidebar and letting Vite fingerprint the asset.
- **Status:** Resolved.

### B13 — The root ESLint config was linting the backend with browser globals

- **Problem:** `npm run lint` at the root reported 63 problems, most of them `'process' is not defined` and `'Buffer' is not defined` in `backend/src/**` — pure noise that buried the 14 real frontend findings.
- **Where:** `eslint.config.js`
- **Root cause:** The config was written for a frontend-only repository (`files: ['**/*.{js,jsx}']`, `globals.browser`). After the merge it swept the Node backend, which has its own tooling.
- **Fix:** Added `backend` to `globalIgnores`.
- **Status:** Resolved. Root lint now reports 14 real frontend findings (see §C.3).

### B14 — Storage settings bypassed the environment schema, and stale docs

- **Problem:** `storage.config.js` read `process.env.STORAGE_PATH` directly — the one module violating the project's own documented rule that nothing in `src/` reads `process.env` — and the 50 MB limit was a hardcoded literal with no way to configure or test it. Separately, `submission.model.js` still carried a banner reading *"PLACEHOLDER — not an implementation … has NO routes, controller or service"*, and `docs/API.md` repeated the claim, both untrue since the submissions module shipped. `API.md` also documented none of the submission endpoints.
- **Where:** `backend/src/config/storage.config.js`, `backend/src/config/env.js`, `backend/src/models/submission.model.js`, `backend/docs/API.md`
- **Fix:** Added `STORAGE_PATH` and `MAX_UPLOAD_SIZE_MB` to the `env` schema and pointed `storage.config.js` at it; documented both in `backend/.env.example`. Replaced the stale model banner with an accurate description, and added a full §4 *Submissions* section to `API.md` covering all three endpoints, the `FormData` contract, the two-stage ZIP validation, every error code, and an explicit note about what is not implemented.
- **Status:** Resolved. Also made the size limit testable — the upload suite sets it to 1 MB rather than pushing 50 MB through `fetch`.


---

## Definition of Done — status

| Criterion | Status |
| --- | --- |
| One unified project, not disconnected parts | Met |
| All Phase 1 outputs present, no functionality lost | Met |
| Frontend connected to the real backend | **Partially met** — auth and session are real; judge pages still on mock data (§C.1) |
| Authentication and authorization work per role | Met, verified |
| ZIP upload and project flows work | Met on the backend and verified end-to-end; no browser UI yet (§C.1) |
| No blocking errors or unaddressed integration issues | Met — 14 issues found, 14 fixed |
| Affected functionality retested after each fix | Met — 198 assertions, 0 failures |
| Final report delivered | This document |

---

## How to run

```bash
# Backend
cd backend && cp .env.example .env   # fill in MONGODB_URI and JWT_ACCESS_SECRET
npm install && npm run seed && npm run dev

# Backend tests (198 assertions)
npm test

# Frontend
cd .. && cp .env.example .env.local
npm install && npm run dev
```
