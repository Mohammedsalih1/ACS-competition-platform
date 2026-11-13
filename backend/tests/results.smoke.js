process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'smoke-test-secret-that-is-definitely-long-enough-32';
process.env.ACCESS_TOKEN_TTL = '15m'; process.env.BCRYPT_ROUNDS = '10'; process.env.LOG_LEVEL = 'error';
process.env.COOKIE_SECURE = 'false'; process.env.CORS_ORIGINS = 'http://localhost:5173'; process.env.LOGIN_RATE_LIMIT_MAX = '100';

let mongo = null;
if (process.env.SMOKE_MONGODB_URI) process.env.MONGODB_URI = process.env.SMOKE_MONGODB_URI;
else { const { MongoMemoryServer } = await import('mongodb-memory-server'); mongo = await MongoMemoryServer.create(); process.env.MONGODB_URI = mongo.getUri('acs_results_test'); }
const mongoose = await import('mongoose');
const { connectDatabase, disconnectDatabase } = await import('../src/config/database.js');
const { createApp } = await import('../src/app.js');
const { User } = await import('../src/models/user.model.js');
const { Session } = await import('../src/models/session.model.js');
const { default: Submission } = await import('../src/models/submission.model.js');
const { default: JudgingCriteria } = await import('../src/models/judgingCriteria.model.js');
const { default: Evaluation } = await import('../src/models/evaluation.model.js');
const { default: ResultsSetting } = await import('../src/models/resultsSetting.model.js');
const { default: CompetitionSetting } = await import('../src/models/competitionSetting.model.js');
const { CompetitionStage, ProjectStageParticipation } = await import('../src/models/competitionStage.model.js');
const { ROLES } = await import('../src/constants/roles.js');
await connectDatabase(); const server = createApp().listen(0); const base = `http://127.0.0.1:${server.address().port}/api/v1`;
let passed = 0; const failures = []; const check = (label, ok, extra = '') => { if (ok) { passed += 1; console.log(`  PASS  ${label}`); } else { failures.push(label); console.log(`  FAIL  ${label} ${extra}`); } };
const api = async (path, { method = 'GET', body, token } = {}) => { const response = await fetch(base + path, { method, headers: { ...(body && { 'Content-Type': 'application/json' }), ...(token && { Authorization: `Bearer ${token}` }) }, body: body ? JSON.stringify(body) : undefined }); const text = await response.text(); return { status: response.status, body: text ? JSON.parse(text) : null }; };
const password = 'Passw0rd!2026'; const login = async (email) => (await api('/auth/login', { method: 'POST', body: { email, password } })).body.data.accessToken;

await Promise.all([User.deleteMany({}), Session.deleteMany({}), Submission.deleteMany({}), JudgingCriteria.deleteMany({}), Evaluation.deleteMany({}), ResultsSetting.deleteMany({}), CompetitionSetting.deleteMany({})]);
const mk = (name, role) => User.create({ name, email: `${name.toLowerCase()}@acs.test`, password, role });
const [admin, contestant, judge1, judge2, judge3] = await Promise.all([mk('Admin', ROLES.ADMIN), mk('Contestant', ROLES.CONTESTANT), mk('Judge1', ROLES.JUDGE), mk('Judge2', ROLES.JUDGE), mk('Judge3', ROLES.JUDGE)]);
const criteria = await JudgingCriteria.create(Array.from({ length: 8 }, (_, index) => ({ key: `criterion_${index + 1}`, name: `Criterion ${index + 1}`, maxScore: 10, order: index + 1 })));
const bonusCriterion = await JudgingCriteria.create({ key: 'innovation_bonus', name: 'Innovation bonus', maxScore: 5, order: 9, isBonus: true });
const submission = await Submission.create({ title: 'Open Project', contestant: contestant._id, status: 'submitted', submittedAt: new Date(), files: [new mongoose.Types.ObjectId()] });
const stageData = {
  name: 'Open judging stage',
  order: 1,
  status: 'open',
  requiredEvaluations: 2,
  activeRubricVersion: 1,
  rubricVersions: [{
    version: 1,
    criteria: [...criteria, bonusCriterion].map((criterion) => ({
      criterionId: criterion._id,
      key: criterion.key,
      name: criterion.name,
      maxScore: criterion.maxScore,
      order: criterion.order,
      active: true,
      bonus: criterion.isBonus,
    })),
    bonusEnabled: true,
    bonusMax: bonusCriterion.maxScore,
  }],
};
const [openStage] = await CompetitionStage.create([stageData]);
const [secondOpenStage] = await CompetitionStage.create([{ ...stageData, name: 'Second open judging stage', order: 2 }]);
const [adminToken, contestantToken, j1, j2, j3] = await Promise.all(['admin', 'contestant', 'judge1', 'judge2', 'judge3'].map((name) => login(`${name}@acs.test`)));
const scores = (value) => criteria.map((criterion) => ({ criterionId: criterion.id, score: value, note: 'Evidence' }));
console.log('\nACS open judging and results smoke test\n');

const settings = await api('/judging/settings', { token: adminToken });
check('settings default to three required evaluations', settings.status === 200 && settings.body.data.settings.requiredEvaluations === 3);
const configured = await api('/judging/settings', { method: 'PATCH', token: adminToken, body: { requiredEvaluations: 2, reason: '' } });
check('admin can configure required evaluation count', configured.status === 200 && configured.body.data.settings.requiredEvaluations === 2);
const forbiddenSetting = await api('/judging/settings', { method: 'PATCH', token: j1, body: { requiredEvaluations: 4, reason: '' } });
check('judge cannot change competition settings', forbiddenSetting.status === 403);
const assignmentGone = await api('/judging/assignments', { token: adminToken });
check('assignment API no longer exists', assignmentGone.status === 404);

const ambiguousQueue = await api('/submissions', { token: j1 });
check('unassigned projects remain unassigned when multiple stages are open', ambiguousQueue.status === 200 && ambiguousQueue.body.data.submissions.length === 0 && !await ProjectStageParticipation.exists({ submission: submission.id, active: true }));
await CompetitionStage.deleteOne({ _id: secondOpenStage._id });
const queue = await api('/submissions', { token: j1 });
check('unassigned projects enter the judge queue when exactly one stage is open', queue.status === 200 && queue.body.data.submissions.some((item) => item.id === submission.id) && await ProjectStageParticipation.exists({ submission: submission.id, stage: openStage._id, active: true }));
const draft = await api(`/judging/evaluations/${submission.id}/draft`, { method: 'PUT', token: j1, body: { scores: scores(8).slice(0, 3), bonusScore: 2, generalNote: 'Draft' } });
check('partial evaluation can be saved as a draft', draft.status === 200 && draft.body.data.evaluation.status === 'draft');
check('draft does not increment completion count', (await Submission.findById(submission.id)).completedEvaluationCount === 0);
const incompleteFinal = await api(`/judging/evaluations/${submission.id}/submit`, { method: 'POST', token: j1, body: { scores: scores(8).slice(0, 7), bonusScore: 2 } });
check('final evaluation requires all eight official criteria', incompleteFinal.status === 400);
const final1 = await api(`/judging/evaluations/${submission.id}/submit`, { method: 'POST', token: j1, body: { scores: scores(8), bonusScore: 2, generalNote: 'Final one' } });
check('draft can be finalized', final1.status === 201 && final1.body.data.evaluation.totalScore === 66);
const locked = await api(`/judging/evaluations/${submission.id}/draft`, { method: 'PUT', token: j1, body: { scores: [], bonusScore: 0 } });
check('final evaluation is locked', locked.status === 409);
const final2 = await api(`/judging/evaluations/${submission.id}/submit`, { method: 'POST', token: j2, body: { scores: scores(10), bonusScore: 5, generalNote: 'Final two' } });
check('second judge completes the requirement', final2.status === 201 && final2.body.data.evaluation.totalScore === 85);
const capped = await api(`/judging/evaluations/${submission.id}/submit`, { method: 'POST', token: j3, body: { scores: scores(9), bonusScore: 1 } });
check('concurrency cap rejects evaluation beyond requirement', capped.status === 409);
const persisted = await Submission.findById(submission.id);
check('completion and review state persist', persisted.completedEvaluationCount === 2 && persisted.reviewState === 'requirements_met');

const summary = await api(`/judging/evaluations/${submission.id}`, { token: adminToken });
check('admin sees individual final records', summary.status === 200 && summary.body.data.evaluations.length === 2);
check('aggregate uses arithmetic means and separate bonus', summary.body.data.summary.totalAverage === 75.5 && summary.body.data.summary.bonusAverage === 3.5);
const boardBefore = await api('/results/leaderboard', { token: adminToken });
check('admin sees completed result as provisional', boardBefore.status === 200 && boardBefore.body.data.results[0].approvalStatus === 'requirements_met');
const publishTooSoon = await api('/results/publish', { method: 'PATCH', token: adminToken, body: { published: true } });
check('unapproved results cannot be published', publishTooSoon.status === 409);
const approveDenied = await api(`/judging/evaluations/${submission.id}/approve`, { method: 'POST', token: j1 });
check('judge cannot approve official result', approveDenied.status === 403);
const approved = await api(`/judging/evaluations/${submission.id}/approve`, { method: 'POST', token: adminToken });
check('admin explicitly approves completed result', approved.status === 200 && approved.body.data.submission.reviewState === 'approved');
const published = await api('/results/publish', { method: 'PATCH', token: adminToken, body: { published: true } });
check('approved result can be published', published.status === 200 && published.body.data.published);
const contestantBoard = await api('/results/leaderboard', { token: contestantToken });
check('contestant sees only published official results', contestantBoard.status === 200 && contestantBoard.body.data.results.length === 1);
check('contestant response hides judge identities', !JSON.stringify(contestantBoard.body).includes('judge1@acs.test'));
const lowerAfterStart = await api('/judging/settings', { method: 'PATCH', token: adminToken, body: { requiredEvaluations: 1, reason: 'Invalid reduction' } });
check('settings cannot be lowered below completed history', lowerAfterStart.status === 409);
const increaseNoReason = await api('/judging/settings', { method: 'PATCH', token: adminToken, body: { requiredEvaluations: 3, reason: '' } });
check('settings changes require a reason after judging starts', increaseNoReason.status === 400);
const increase = await api('/judging/settings', { method: 'PATCH', token: adminToken, body: { requiredEvaluations: 3, reason: 'Competition policy update' } });
check('audited setting change records actor and reason', increase.status === 200 && increase.body.data.settings.history.at(-1).reason === 'Competition policy update');

console.log(`\n${passed} passed, ${failures.length} failed\n`); failures.forEach((failure) => console.log(`  - ${failure}`));
server.close(); await disconnectDatabase(); if (mongo) await mongo.stop(); process.exit(failures.length ? 1 : 0);
