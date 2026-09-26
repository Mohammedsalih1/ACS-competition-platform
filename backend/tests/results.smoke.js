/**
 * Results / ranking / stats smoke test.
 *
 * Boots the real app against an in-memory MongoDB, creates judges, projects and
 * evaluations through the real API, then verifies scoring, ranking (including
 * ties), publication gating, role visibility and the dashboard statistics.
 *
 *   npm run smoke:results
 */
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'smoke-test-secret-that-is-definitely-long-enough-32';
process.env.ACCESS_TOKEN_TTL = '15m';
process.env.BCRYPT_ROUNDS = '10';
process.env.LOG_LEVEL = 'error';
process.env.COOKIE_SECURE = 'false';
process.env.CORS_ORIGINS = 'http://localhost:5173';
process.env.LOGIN_RATE_LIMIT_MAX = '100';

let mongo = null;
if (process.env.SMOKE_MONGODB_URI) {
  process.env.MONGODB_URI = process.env.SMOKE_MONGODB_URI;
} else {
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri('acs_results_test');
}

const { connectDatabase, disconnectDatabase } = await import('../src/config/database.js');
const { createApp } = await import('../src/app.js');
const { User } = await import('../src/models/user.model.js');
const { Session } = await import('../src/models/session.model.js');
const { default: Submission } = await import('../src/models/submission.model.js');
const { default: JudgingCriteria } = await import('../src/models/judgingCriteria.model.js');
const { default: JudgeAssignment } = await import('../src/models/judgeAssignment.model.js');
const { default: Evaluation } = await import('../src/models/evaluation.model.js');
const { default: ResultsSetting } = await import('../src/models/resultsSetting.model.js');
const { ROLES } = await import('../src/constants/roles.js');

await connectDatabase();
const server = createApp().listen(0);
const base = `http://127.0.0.1:${server.address().port}/api/v1`;

let passed = 0;
const failures = [];
const check = (label, condition, extra = '') => {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL  ${label} ${extra}`);
  }
};

const api = async (path, { method = 'GET', body, token } = {}) => {
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

const PASSWORD = 'Passw0rd!2026';
const login = async (email) =>
  (await api('/auth/login', { method: 'POST', body: { email, password: PASSWORD } })).body.data.accessToken;

// --- fixtures ---------------------------------------------------------------
await Promise.all([
  User.deleteMany({}),
  Session.deleteMany({}),
  Submission.deleteMany({}),
  JudgingCriteria.deleteMany({}),
  JudgeAssignment.deleteMany({}),
  Evaluation.deleteMany({}),
  ResultsSetting.deleteMany({}),
]);

const mk = (name, role) => User.create({ name, email: `${name.toLowerCase()}@acs.test`, password: PASSWORD, role });
const admin = await mk('Admin', ROLES.ADMIN);
const [alice, bob, carol] = await Promise.all([
  mk('Alice', ROLES.CONTESTANT),
  mk('Bob', ROLES.CONTESTANT),
  mk('Carol', ROLES.CONTESTANT),
]);
const [judge1, judge2] = await Promise.all([mk('Judge1', ROLES.JUDGE), mk('Judge2', ROLES.JUDGE)]);

const [c1, c2, bonus] = await JudgingCriteria.create([
  { key: 'a', name: 'A', maxScore: 10, order: 1 },
  { key: 'b', name: 'B', maxScore: 10, order: 2 },
  { key: 'bonus', name: 'Bonus', maxScore: 5, order: 3, isBonus: true },
]);

const mkSub = (title, contestant, submittedAt) =>
  Submission.create({ title, contestant: contestant._id, status: 'submitted', submittedAt, liveUrl: 'https://x.test' });
const subA = await mkSub('Alpha', alice, new Date('2026-01-01'));
const subB = await mkSub('Beta', bob, new Date('2026-01-02'));
const subC = await mkSub('Gamma', carol, new Date('2026-01-03'));
await mkSub('Unjudged', carol, new Date('2026-01-04'));

const adminToken = await login('admin@acs.test');
const j1 = await login('judge1@acs.test');
const j2 = await login('judge2@acs.test');
const aliceToken = await login('alice@acs.test');
const bobToken = await login('bob@acs.test');

console.log('\nACS results smoke test\n');

// Alpha: judged by both, (18 + 16) / 2 = 17. Beta: judged by both, (17 + 17) / 2 = 17 -> tie with Alpha.
// Gamma: 2 judges assigned, only judge1 done: 12.
for (const [sub, judges] of [[subA, [judge1, judge2]], [subB, [judge1, judge2]], [subC, [judge1, judge2]]]) {
  for (const j of judges) {
    await api('/judging/assignments', {
      method: 'POST',
      token: adminToken,
      body: { judgeId: j.id, submissionId: sub.id },
    });
  }
}
const evaluate = (token, sub, a, b, bonusScore) =>
  api(`/judging/evaluations/${sub.id}`, {
    method: 'POST',
    token,
    body: {
      scores: [
        { criterionId: c1.id, score: a },
        { criterionId: c2.id, score: b },
        ...(bonusScore === undefined ? [] : [{ criterionId: bonus.id, score: bonusScore }]),
      ],
    },
  });
check('evaluations are accepted', [
  (await evaluate(j1, subA, 10, 8)).status,
  (await evaluate(j2, subA, 9, 7)).status,
  (await evaluate(j1, subB, 9, 8)).status,
  (await evaluate(j2, subB, 10, 5, 2)).status,
  (await evaluate(j1, subC, 6, 6)).status,
].every((s) => s === 201));

// --- publication gating -----------------------------------------------------
console.log('publication');
{
  const status = await api('/results/status', { token: aliceToken });
  check('status is readable by any user and starts unpublished', status.status === 200 && status.body.data.published === false);

  const blocked = await api('/results/leaderboard', { token: aliceToken });
  check('contestant is blocked before publication (403 RESULTS_NOT_PUBLISHED)', blocked.status === 403 && blocked.body.error.code === 'RESULTS_NOT_PUBLISHED');

  const judgeDenied = await api('/results/leaderboard', { token: j1 });
  check('judge cannot read the leaderboard (403 INSUFFICIENT_ROLE)', judgeDenied.status === 403 && judgeDenied.body.error.code === 'INSUFFICIENT_ROLE');

  const notAdmin = await api('/results/publish', { method: 'PATCH', token: aliceToken, body: { published: true } });
  check('only admin can publish', notAdmin.status === 403);

  const invalid = await api('/results/publish', { method: 'PATCH', token: adminToken, body: { published: 'yes' } });
  check('publish body is validated', invalid.status === 400 && invalid.body.error.code === 'VALIDATION_ERROR');
}

// --- admin leaderboard ------------------------------------------------------
console.log('\nleaderboard (admin)');
{
  const res = await api('/results/leaderboard', { token: adminToken });
  const rows = res.body.data.results;
  check('admin sees leaderboard while unpublished', res.status === 200 && rows.length === 3);
  check('unevaluated projects are excluded', !rows.some((r) => r.title === 'Unjudged'));
  check('max score is 25 (10 + 10 + 5)', res.body.data.maxScore === 25);
  check('average is the mean of judge totals', rows[0].averageScore === 17 && rows.find((r) => r.title === 'Gamma').averageScore === 12);
  check('tied projects share rank 1', rows[0].rank === 1 && rows[1].rank === 1);
  check('tie is ordered by earlier submission', rows[0].title === 'Alpha' && rows[1].title === 'Beta');
  check('next rank skips after tie (1,1,3)', rows[2].rank === 3 && rows[2].title === 'Gamma');
  check('partial evaluation is flagged', rows[2].isComplete === false && rows[2].evaluatedCount === 1 && rows[2].assignedCount === 2);
  check('total score is the sum of judge totals', rows[0].totalScore === 34);
  check('pagination meta is present', res.body.meta.total === 3 && res.body.meta.page === 1);

  const paged = await api('/results/leaderboard?limit=1&page=2', { token: adminToken });
  check('pagination slices results', paged.body.data.results.length === 1 && paged.body.meta.totalPages === 3);

  const badQuery = await api('/results/leaderboard?limit=0', { token: adminToken });
  check('bad query returns 400 VALIDATION_ERROR', badQuery.status === 400 && badQuery.body.error.code === 'VALIDATION_ERROR');
}

// --- project result ---------------------------------------------------------
console.log('\nproject result');
{
  const res = await api(`/results/projects/${subB.id}`, { token: adminToken });
  const r = res.body.data.result;
  check('admin gets full project result', res.status === 200 && r.rank === 1 && r.averageScore === 17);
  check('admin sees per-judge evaluations', r.evaluations.length === 2 && !!r.evaluations[0].judge.email);
  check('criteria breakdown includes bonus average', r.criteria.find((c) => c.key === 'bonus').average === 2 && r.criteria.find((c) => c.key === 'a').average === 9.5);

  const unjudged = await Submission.findOne({ title: 'Unjudged' });
  const empty = await api(`/results/projects/${unjudged.id}`, { token: adminToken });
  check('project without evaluations returns null rank/score', empty.status === 200 && empty.body.data.result.rank === null && empty.body.data.result.averageScore === null);

  const missing = await api('/results/projects/64b7f0f0f0f0f0f0f0f0f0f0', { token: adminToken });
  check('unknown project returns 404', missing.status === 404 && missing.body.error.code === 'NOT_FOUND');

  const badId = await api('/results/projects/not-an-id', { token: adminToken });
  check('malformed id returns 400 VALIDATION_ERROR', badId.status === 400 && badId.body.error.code === 'VALIDATION_ERROR');

  const early = await api(`/results/projects/${subA.id}`, { token: aliceToken });
  check('owner blocked before publication', early.status === 403 && early.body.error.code === 'RESULTS_NOT_PUBLISHED');
}

// --- publish, then contestant views ----------------------------------------
console.log('\nafter publication');
{
  const pub = await api('/results/publish', { method: 'PATCH', token: adminToken, body: { published: true } });
  check('admin publishes results', pub.status === 200 && pub.body.data.published === true && !!pub.body.data.publishedAt);

  const board = await api('/results/leaderboard', { token: aliceToken });
  check('contestant sees the leaderboard', board.status === 200 && board.body.data.results.length === 3);
  check('contestant view hides emails and judge counts', !JSON.stringify(board.body).includes('@acs.test') && board.body.data.results[0].evaluatedCount === undefined);

  const own = await api(`/results/projects/${subA.id}`, { token: aliceToken });
  check('owner sees own result', own.status === 200 && own.body.data.result.rank === 1);
  check('owner does not see judge identities or notes', own.body.data.result.evaluations === undefined && !JSON.stringify(own.body).includes('judge1'));

  const others = await api(`/results/projects/${subB.id}`, { token: aliceToken });
  check("contestant cannot open someone else's result", others.status === 403);

  const mine = await api('/results/mine', { token: bobToken });
  check('/results/mine returns only own projects', mine.status === 200 && mine.body.data.results.length === 1 && mine.body.data.results[0].title === 'Beta');

  const noAuth = await api('/results/leaderboard');
  check('unauthenticated request returns 401', noAuth.status === 401 && noAuth.body.error.code === 'AUTH_REQUIRED');

  await api('/results/publish', { method: 'PATCH', token: adminToken, body: { published: false } });
  const hidden = await api('/results/leaderboard', { token: aliceToken });
  check('unpublishing hides results again', hidden.status === 403);
}

// --- stats ------------------------------------------------------------------
console.log('\nstats');
{
  const res = await api('/results/stats', { token: adminToken });
  const s = res.body.data.stats;
  check('admin gets stats', res.status === 200 && s.users.contestants === 3 && s.users.judges === 2);
  check('submission counts', s.submissions.total === 4 && s.submissions.evaluated === 3 && s.submissions.pendingEvaluation === 1);
  check('unassigned counts submitted projects with no judge', s.submissions.unassigned === 1);
  check('fully evaluated counts complete projects only', s.submissions.fullyEvaluated === 2);
  check('evaluation progress is 5 of 6 assignments', s.evaluations.total === 5 && s.evaluations.assignments === 6 && s.evaluations.progressPercent === 83.33);
  check('score aggregates', s.scores.highest === 17 && s.scores.lowest === 12 && s.scores.average === 15.33 && s.scores.topProject.title === 'Alpha');
  check('per-criterion averages included', s.criteriaAverages.length === 3);

  const denied = await api('/results/stats', { token: aliceToken });
  check('stats are admin-only', denied.status === 403 && denied.body.error.code === 'INSUFFICIENT_ROLE');
}

console.log(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length) failures.forEach((f) => console.log(`  - ${f}`));

server.close();
await disconnectDatabase();
if (mongo) await mongo.stop();
process.exit(failures.length ? 1 : 0);
