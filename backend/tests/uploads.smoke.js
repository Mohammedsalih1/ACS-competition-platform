/**
 * Submissions + ZIP upload end-to-end smoke test.
 *
 * Boots the real app against an in-memory MongoDB and a throwaway storage
 * directory, then drives the whole contestant file flow over HTTP: create a
 * submission, upload an archive, read it back, and every way those can fail.
 * No mocks and no stubbed multer - the bytes really go to disk, so this catches
 * the wiring that unit tests miss.
 *
 *   npm run smoke:uploads
 *
 * The auth foundation is covered by `npm run smoke`; this file assumes it works
 * and only logs in to get the tokens it needs.
 */
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'acs-upload-test-'));

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'upload-smoke-secret-that-is-long-enough-here-32';
process.env.ACCESS_TOKEN_TTL = '15m';
process.env.BCRYPT_ROUNDS = '10';
process.env.LOG_LEVEL = 'error';
process.env.COOKIE_SECURE = 'false';
process.env.CORS_ORIGINS = 'http://localhost:5173';
process.env.LOGIN_RATE_LIMIT_MAX = '100';
process.env.GLOBAL_RATE_LIMIT_MAX = '1000';
// Never touch the developer's real storage/ directory.
process.env.STORAGE_PATH = storageRoot;
// Keeps the "too large" case at 2 MB instead of pushing 50 MB through fetch.
process.env.MAX_UPLOAD_SIZE_MB = '1';

let mongo = null;
if (process.env.SMOKE_MONGODB_URI) {
  process.env.MONGODB_URI = process.env.SMOKE_MONGODB_URI;
} else {
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri('acs_upload_test');
}

const AdmZip = (await import('adm-zip')).default;
const { connectDatabase, disconnectDatabase } = await import('../src/config/database.js');
const { createApp } = await import('../src/app.js');
const { User } = await import('../src/models/user.model.js');
const { Submission, SUBMISSION_STATUS } = await import('../src/models/submission.model.js');
const { File, UPLOAD_STATUS } = await import('../src/models/file.model.js');
const { ROLES } = await import('../src/constants/roles.js');
const { TEMP_DIR, SUBMISSIONS_DIR, MAX_FILE_SIZE } = await import('../src/config/storage.config.js');

await connectDatabase();
const server = createApp().listen(0);
const base = `http://127.0.0.1:${server.address().port}/api/v1`;

// --- tiny assertion harness -------------------------------------------------
let passed = 0;
const failures = [];
const gaps = [];

const check = (label, condition, extra = '') => {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL  ${label} ${extra}`);
  }
};

/**
 * Records behaviour that is real and verified but NOT what the product should
 * ultimately do. It is asserted so the suite notices if it silently changes,
 * and listed separately so a green run never reads as "feature complete".
 */
const gap = (label, condition, note) => {
  if (condition) {
    console.log(`  GAP   ${label}`);
    gaps.push(note);
  } else {
    failures.push(`${label} (expected the documented current behaviour)`);
    console.log(`  FAIL  ${label}`);
  }
};

// --- helpers ----------------------------------------------------------------
const json = async (path, { method = 'GET', body, token } = {}) => {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
};

/** Multipart POST, exactly as a browser's FormData would send it. */
const upload = async (
  path,
  { token, buffer, filename = 'project.zip', type = 'application/zip', field = 'projectFile', omitFile = false } = {},
) => {
  const form = new FormData();
  if (!omitFile) form.append(field, new Blob([buffer], { type }), filename);

  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
};

const login = async (email, password) => {
  const res = await json('/auth/login', { method: 'POST', body: { email, password } });
  if (!res.body?.data?.accessToken) throw new Error(`login failed for ${email}: ${JSON.stringify(res.body)}`);
  return res.body.data.accessToken;
};

const createSubmission = async (token, title = 'My Project') => {
  const res = await json('/submissions', { method: 'POST', token, body: { title } });
  if (!res.body?.data?.id) throw new Error(`could not create submission: ${JSON.stringify(res.body)}`);
  return res.body.data.id;
};

const listDir = async (dir) => fs.readdir(dir).catch(() => []);

/** A real archive: correct PK\x03\x04 magic bytes and at least one entry. */
const makeZip = (entries = { 'index.html': '<h1>ACS</h1>' }) => {
  const zip = new AdmZip();
  for (const [name, content] of Object.entries(entries)) zip.addFile(name, Buffer.from(content));
  return zip.toBuffer();
};

const PASSWORD = 'Passw0rd!2026';
const ZIP_MIME = 'application/zip';

// --- fixtures ---------------------------------------------------------------
await Promise.all([User.deleteMany({}), Submission.deleteMany({}), File.deleteMany({})]);
await User.create({ name: 'Contestant One', email: 'c1@acs.test', password: PASSWORD, role: ROLES.CONTESTANT });
await User.create({ name: 'Contestant Two', email: 'c2@acs.test', password: PASSWORD, role: ROLES.CONTESTANT });
await User.create({ name: 'Judge', email: 'judge@acs.test', password: PASSWORD, role: ROLES.JUDGE });
await User.create({ name: 'Admin', email: 'admin@acs.test', password: PASSWORD, role: ROLES.ADMIN });

const contestantToken = await login('c1@acs.test', PASSWORD);
const otherContestantToken = await login('c2@acs.test', PASSWORD);
const judgeToken = await login('judge@acs.test', PASSWORD);
const adminToken = await login('admin@acs.test', PASSWORD);

console.log('\nACS submissions & upload smoke test\n');

// --- creating a submission --------------------------------------------------
console.log('submission creation');
{
  const created = await json('/submissions', { method: 'POST', token: contestantToken, body: { title: 'Bankak', description: 'A transactions platform' } });
  check('a contestant can create a submission', created.status === 201 && !!created.body.data.id);
  check('a new submission starts as a draft', created.body.data.status === SUBMISSION_STATUS.DRAFT);

  const stored = await Submission.findById(created.body.data.id);
  check('the submission is owned by its creator, not by a client-supplied id', stored.contestant.toString() === (await User.findOne({ email: 'c1@acs.test' }))._id.toString());
  check('a draft has no submittedAt timestamp yet', stored.submittedAt === null);

  const anonymous = await json('/submissions', { method: 'POST', body: { title: 'Anon' } });
  check('creating a submission requires authentication', anonymous.status === 401 && anonymous.body.error.code === 'AUTH_REQUIRED');

  const asJudge = await json('/submissions', { method: 'POST', token: judgeToken, body: { title: 'Judge Project' } });
  check('a judge cannot create a submission', asJudge.status === 403 && asJudge.body.error.code === 'INSUFFICIENT_ROLE');

  const asAdmin = await json('/submissions', { method: 'POST', token: adminToken, body: { title: 'Admin Project' } });
  check('an admin cannot create a submission on their own behalf either', asAdmin.status === 403);

  const noTitle = await json('/submissions', { method: 'POST', token: contestantToken, body: { description: 'no title' } });
  check('a missing title is rejected with field details', noTitle.status === 400 && noTitle.body.error.code === 'VALIDATION_ERROR' && noTitle.body.error.details.some((d) => d.field === 'title'));

  const blankTitle = await json('/submissions', { method: 'POST', token: contestantToken, body: { title: '   ' } });
  check('a whitespace-only title is rejected', blankTitle.status === 400);

  const longTitle = await json('/submissions', { method: 'POST', token: contestantToken, body: { title: 'x'.repeat(201) } });
  check('an over-long title is rejected', longTitle.status === 400);

  const smuggled = await json('/submissions', { method: 'POST', token: contestantToken, body: { title: 'Sneaky', status: 'scored', contestant: '507f1f77bcf86cd799439011' } });
  check('a client cannot smuggle status or ownership into the body', smuggled.status === 400 && smuggled.body.error.code === 'VALIDATION_ERROR');
}

// --- the happy path ---------------------------------------------------------
console.log('\nZIP upload - happy path');
let uploadedSubmissionId;
let uploadedFileId;
const zipBuffer = makeZip({ 'index.html': '<h1>ACS</h1>', 'src/app.js': 'console.log(1)' });
{
  uploadedSubmissionId = await createSubmission(contestantToken, 'Upload Target');

  const res = await upload(`/submissions/${uploadedSubmissionId}/upload`, { token: contestantToken, buffer: zipBuffer });
  uploadedFileId = res.body?.data?.fileId;
  check('a valid ZIP is accepted with 201', res.status === 201 && !!uploadedFileId, JSON.stringify(res.body));
  check('the response echoes the original file name', res.body.data.originalFileName === 'project.zip');
  check('the response never leaks the on-disk path', !JSON.stringify(res.body).includes(storageRoot));

  const file = await File.findById(uploadedFileId).select('+storagePath');
  check('the file record is marked uploaded', file.status === UPLOAD_STATUS.UPLOADED);
  check('the recorded size matches the bytes sent', file.fileSize === zipBuffer.length);
  check('the mime type is recorded', file.mimeType === ZIP_MIME);
  check('the file is linked back to its submission', file.submission.toString() === uploadedSubmissionId);

  const expectedPath = path.join(SUBMISSIONS_DIR, uploadedSubmissionId, `${uploadedFileId}.zip`);
  check('the archive is stored under storage/submissions/<submissionId>/<fileId>.zip', file.storagePath === expectedPath);

  const onDisk = await fs.readFile(expectedPath).catch(() => null);
  check('the archive really exists on disk', !!onDisk);
  check('the stored bytes are byte-for-byte what was uploaded', onDisk && Buffer.compare(onDisk, Buffer.from(zipBuffer)) === 0);

  check('storagePath is select:false, so a plain query cannot leak it', (await File.findById(uploadedFileId)).storagePath === undefined);

  const submission = await Submission.findById(uploadedSubmissionId);
  check('the first accepted upload flips the submission to submitted', submission.status === SUBMISSION_STATUS.SUBMITTED);
  check('submittedAt is stamped', submission.submittedAt instanceof Date);
  check('the file id is mirrored onto the submission', submission.files.map(String).includes(String(uploadedFileId)));

  check('the temp directory is left empty after a successful upload', (await listDir(TEMP_DIR)).length === 0);
}

// --- re-uploading -----------------------------------------------------------
console.log('\nZIP upload - replacing an archive');
{
  const second = makeZip({ 'v2.txt': 'second revision' });
  const res = await upload(`/submissions/${uploadedSubmissionId}/upload`, { token: contestantToken, buffer: second, filename: 'project-v2.zip' });
  check('a contestant can upload again to the same submission', res.status === 201);
  check('the second upload gets its own file id', res.body.data.fileId !== uploadedFileId);

  const submission = await Submission.findById(uploadedSubmissionId);
  check('both revisions are kept on the submission', submission.files.length === 2);
  check('re-uploading does not reset the status', submission.status === SUBMISSION_STATUS.SUBMITTED);

  const download = await fetch(`${base}/submissions/${uploadedSubmissionId}/download`, { headers: { Authorization: `Bearer ${contestantToken}` } });
  const bytes = Buffer.from(await download.arrayBuffer());
  check('downloading returns the NEWEST revision, not the first', Buffer.compare(bytes, Buffer.from(second)) === 0);

  check('the temp directory is still empty', (await listDir(TEMP_DIR)).length === 0);
}

// --- rejected uploads -------------------------------------------------------
console.log('\nZIP upload - rejected input');
{
  const target = await createSubmission(contestantToken, 'Rejection Target');

  const noFile = await upload(`/submissions/${target}/upload`, { token: contestantToken, omitFile: true });
  check('a request with no file part returns 400 FILE_REQUIRED', noFile.status === 400 && noFile.body.error.code === 'FILE_REQUIRED');

  const wrongMime = await upload(`/submissions/${target}/upload`, { token: contestantToken, buffer: Buffer.from('not a zip at all'), filename: 'notes.txt', type: 'text/plain' });
  check('a non-ZIP mime type returns 415 UNSUPPORTED_FILE_TYPE', wrongMime.status === 415 && wrongMime.body.error.code === 'UNSUPPORTED_FILE_TYPE');

  // Claims to be a ZIP, is not. Only the magic-byte check can catch this.
  const liar = await upload(`/submissions/${target}/upload`, { token: contestantToken, buffer: Buffer.from('MZ this is actually an executable'), filename: 'payload.zip', type: ZIP_MIME });
  check('a renamed non-ZIP is caught by the magic-byte check, not the mime type', liar.status === 415 && liar.body.error.code === 'UNSUPPORTED_FILE_TYPE');

  // Correct PK\x03\x04 header, then garbage: passes the magic-byte gate and
  // only fails once the central directory is parsed.
  const corrupt = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('x'.repeat(400))]);
  const corruptRes = await upload(`/submissions/${target}/upload`, { token: contestantToken, buffer: corrupt, filename: 'corrupt.zip', type: ZIP_MIME });
  check('a corrupt archive returns 400 CORRUPT_ARCHIVE, not a 500', corruptRes.status === 400 && corruptRes.body.error.code === 'CORRUPT_ARCHIVE', JSON.stringify(corruptRes.body));

  // An archive with no entries is only an end-of-central-directory record, so
  // it never carries the PK\x03\x04 local-file header the gate looks for.
  const emptyRes = await upload(`/submissions/${target}/upload`, { token: contestantToken, buffer: new AdmZip().toBuffer(), filename: 'empty.zip', type: ZIP_MIME });
  check('an empty archive is rejected', emptyRes.status === 415 || emptyRes.status === 400, JSON.stringify(emptyRes.body));

  const oversized = Buffer.alloc(MAX_FILE_SIZE + 1024, 0x41);
  oversized.set([0x50, 0x4b, 0x03, 0x04], 0);
  const tooBig = await upload(`/submissions/${target}/upload`, { token: contestantToken, buffer: oversized, filename: 'huge.zip', type: ZIP_MIME });
  check('a file over the size limit returns 413 FILE_TOO_LARGE', tooBig.status === 413 && tooBig.body.error.code === 'FILE_TOO_LARGE', JSON.stringify(tooBig.body));
  check('an oversized upload does not leave a partial file in temp/', (await listDir(TEMP_DIR)).length === 0);

  const wrongField = await upload(`/submissions/${target}/upload`, { token: contestantToken, buffer: zipBuffer, field: 'file' });
  check('the wrong form field name is a 4xx client error, not a 500', wrongField.status >= 400 && wrongField.status < 500, `got ${wrongField.status}`);

  check('no rejected upload marked the submission as submitted', (await Submission.findById(target)).status === SUBMISSION_STATUS.DRAFT);
  check('every rejected upload cleaned up after itself', (await listDir(TEMP_DIR)).length === 0);

  const failed = await File.find({ submission: target });
  check('failed attempts are recorded rather than vanishing silently', failed.length > 0 && failed.every((f) => f.status === UPLOAD_STATUS.FAILED));
}

// --- authorization ----------------------------------------------------------
console.log('\nupload authorization');
{
  const mine = await createSubmission(contestantToken, 'Mine');

  const anonymous = await upload(`/submissions/${mine}/upload`, { buffer: zipBuffer });
  check('uploading requires authentication', anonymous.status === 401 && anonymous.body.error.code === 'AUTH_REQUIRED');

  const asJudge = await upload(`/submissions/${mine}/upload`, { token: judgeToken, buffer: zipBuffer });
  check('a judge cannot upload to a submission', asJudge.status === 403 && asJudge.body.error.code === 'INSUFFICIENT_ROLE');

  const asOtherContestant = await upload(`/submissions/${mine}/upload`, { token: otherContestantToken, buffer: zipBuffer });
  check("a contestant cannot upload into someone else's submission", asOtherContestant.status === 403);

  const missing = await upload('/submissions/507f1f77bcf86cd799439011/upload', { token: contestantToken, buffer: zipBuffer });
  check('a well-formed id for a submission that does not exist is refused', missing.status === 403 || missing.status === 404);

  const malformed = await upload('/submissions/not-an-object-id/upload', { token: contestantToken, buffer: zipBuffer });
  check('a malformed submission id returns 400, not a 500', malformed.status === 400 && malformed.body.error.code === 'VALIDATION_ERROR', JSON.stringify(malformed.body));

  check('no unauthorized attempt wrote anything to temp/', (await listDir(TEMP_DIR)).length === 0);
  check('no unauthorized attempt created a stray file record', (await File.countDocuments({ submission: mine })) === 0);
}

// --- download ---------------------------------------------------------------
console.log('\ndownload');
{
  const response = await fetch(`${base}/submissions/${uploadedSubmissionId}/download`, { headers: { Authorization: `Bearer ${contestantToken}` } });
  check('an owner can download their archive', response.status === 200);
  check('the response is served as a ZIP', (response.headers.get('content-type') ?? '').includes('zip'));
  check('the response is sent as an attachment with a filename', /attachment/.test(response.headers.get('content-disposition') ?? '') && /filename=/.test(response.headers.get('content-disposition') ?? ''));

  const anonymous = await fetch(`${base}/submissions/${uploadedSubmissionId}/download`);
  check('downloading requires authentication', anonymous.status === 401);

  const other = await json(`/submissions/${uploadedSubmissionId}/download`, { token: otherContestantToken });
  check("a contestant cannot download someone else's archive", other.status === 403);

  const emptySubmission = await createSubmission(contestantToken, 'Nothing Uploaded');
  const nothing = await json(`/submissions/${emptySubmission}/download`, { token: contestantToken });
  check('a submission with no upload yet returns 404, not a broken stream', nothing.status === 404 && nothing.body.error.code === 'NOT_FOUND');

  const malformed = await json('/submissions/nope/download', { token: contestantToken });
  check('a malformed id on download returns 400', malformed.status === 400 && malformed.body.error.code === 'VALIDATION_ERROR');

  // --- known gaps, asserted so they cannot change unnoticed ---
  const asJudge = await json(`/submissions/${uploadedSubmissionId}/download`, { token: judgeToken });
  gap(
    'a judge is currently refused a submission download (403)',
    asJudge.status === 403,
    'Judges cannot read or download any submission: /submissions/:id/download is authorize(CONTESTANT) and verifyOwnership() only matches the owning contestant. The Judge Dashboard cannot be wired to real data until judge read access exists.',
  );

  const asAdmin = await json(`/submissions/${uploadedSubmissionId}/download`, { token: adminToken });
  gap(
    'an admin is currently refused a submission download (403)',
    asAdmin.status === 403,
    'Admins have no submission access either, so there is no operator path to inspect an entry.',
  );

  const list = await json('/submissions', { token: judgeToken });
  gap(
    'there is no endpoint to list submissions (404)',
    list.status === 404,
    'The submissions module exposes only POST /, POST /:id/upload and GET /:id/download. There is no GET /submissions and no GET /submissions/:id, so no client can list or read submission metadata - this is why the judge pages still run on mockProjects.js.',
  );
}

// --- summary ----------------------------------------------------------------
console.log(`\n${passed} passed, ${failures.length} failed, ${gaps.length} known gaps\n`);
if (failures.length) failures.forEach((f) => console.log(`  FAILED  - ${f}`));
if (gaps.length) {
  console.log('Known gaps (verified current behaviour, not yet implemented):');
  gaps.forEach((g) => console.log(`  - ${g}`));
  console.log('');
}

server.close();
await disconnectDatabase();
if (mongo) await mongo.stop();
await fs.rm(storageRoot, { recursive: true, force: true }).catch(() => {});
process.exit(failures.length ? 1 : 0);
