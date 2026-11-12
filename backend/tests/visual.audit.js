import fs from 'fs/promises';
import path from 'path';
import AdmZip from 'adm-zip';
import { chromium } from 'playwright-core';

const API = 'http://localhost:5000/api/v1';
const WEB = 'http://localhost:5173';
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const output = path.resolve('../.audit-artifacts');
await fs.mkdir(output, { recursive: true });

const credentials = {
  admin: { email: 'visual-admin@acs.test', password: 'VisualAudit!2026' },
  judge: { email: 'judge@acs.local', password: 'VisualAudit!2026' },
  contestant: { email: 'contestant@acs.local', password: 'VisualAudit!2026' },
};
const request = async (route, { method = 'GET', token, body } = {}) => {
  const response = await fetch(API + route, { method, headers: { ...(token && { Authorization: `Bearer ${token}` }), ...(body && !(body instanceof FormData) && { 'Content-Type': 'application/json' }) }, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  if (!response.ok) throw new Error(`${method} ${route}: ${data.error?.message || response.status}`);
  return data.data;
};
const tokenFor = async (account) => (await request('/auth/login', { method: 'POST', body: credentials[account] })).accessToken;

const contestantToken = await tokenFor('contestant');
const created = await request('/submissions', { method: 'POST', token: contestantToken, body: { title: 'Sudan Community Services Portal', description: 'A bilingual community platform for coordinating local services, requests, volunteers, and operational reporting.' } });
const submissionId = created.id;
const zip = new AdmZip();
zip.addFile('src/App.jsx', Buffer.from('export default function App(){ return <main>Community Services</main> }'));
zip.addFile('src/api.js', Buffer.from('export const getServices = () => fetch("/api/services")'));
zip.addFile('README.md', Buffer.from('# Community Services Portal'));
const form = new FormData();
form.append('projectFile', new Blob([zip.toBuffer()], { type: 'application/zip' }), 'community-portal.zip');
await request(`/submissions/${submissionId}/upload`, { method: 'POST', token: contestantToken, body: form });

const browser = await chromium.launch({ executablePath: edge, headless: true });
const findings = [];
const consoleErrors = [];
const workflow = [];
const viewports = { desktop: { width: 1440, height: 1000 }, tablet: { width: 1024, height: 768 }, mobile: { width: 390, height: 844 } };

async function login(context, account) {
  const page = await context.newPage();
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push({ account, text: message.text() }); });
  page.on('pageerror', (error) => consoleErrors.push({ account, text: error.message }));
  await page.goto(WEB + '/login');
  await page.locator('input[name="email"]').fill(credentials[account].email);
  await page.locator('input[name="password"]').fill(credentials[account].password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(account === 'admin' ? '**/admin' : '**/judge');
  return page;
}

async function inspect(page, account, label, route, viewport, action) {
  await page.setViewportSize(viewports[viewport]);
  await page.goto(WEB + route, { waitUntil: 'networkidle' });
  if (action) await action(page);
  await page.waitForTimeout(350);
  const metrics = await page.evaluate(() => ({
    title: document.title,
    bodyWidth: document.body.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    bodyHeight: document.body.scrollHeight,
    emptyButtons: [...document.querySelectorAll('button')].filter((button) => !button.textContent.trim() && !button.getAttribute('aria-label')).length,
    clipped: [...document.querySelectorAll('main *')].filter((element) => element.scrollWidth > element.clientWidth + 3 && getComputedStyle(element).overflowX === 'visible').slice(0, 5).map((element) => element.tagName + '.' + element.className),
  }));
  const screenshot = path.join(output, `${account}-${label}-${viewport}.png`);
  await page.screenshot({ path: screenshot, fullPage: true });
  findings.push({ account, label, route, viewport, screenshot, ...metrics, horizontalOverflow: metrics.bodyWidth > metrics.viewportWidth + 2 });
}

for (const account of ['admin', 'judge']) {
  const context = await browser.newContext();
  const page = await login(context, account);
  if (account === 'admin') {
    await inspect(page, account, 'dashboard', '/admin', 'desktop');
    await inspect(page, account, 'project-details', `/admin/projects/${submissionId}`, 'desktop');
    await inspect(page, account, 'settings', '/admin/settings', 'desktop');
    await inspect(page, account, 'dashboard', '/admin', 'mobile', async (current) => current.getByRole('button', { name: 'Open navigation' }).click());
    await page.setViewportSize(viewports.desktop);
    await page.goto(WEB + '/admin/settings');
    await page.locator('input[type="number"]').fill('1');
    await page.getByRole('button', { name: 'Save settings' }).click();
    await page.getByText('Judging settings updated.').waitFor();
    workflow.push('Admin configured required evaluations through the UI');
  } else {
    await inspect(page, account, 'dashboard', '/judge', 'desktop');
    await inspect(page, account, 'projects', '/judge/projects', 'desktop');
    await inspect(page, account, 'project-details', `/judge/projects/${submissionId}`, 'desktop');
    await inspect(page, account, 'evaluation', `/judge/projects/${submissionId}/evaluate`, 'desktop');
    await inspect(page, account, 'evaluation', `/judge/projects/${submissionId}/evaluate`, 'tablet');
    await inspect(page, account, 'evaluation', `/judge/projects/${submissionId}/evaluate`, 'mobile');
    await inspect(page, account, 'workspace', `/judge/projects/${submissionId}/workspace`, 'desktop');
    await inspect(page, account, 'workspace', `/judge/projects/${submissionId}/workspace`, 'mobile');
    await inspect(page, account, 'sidebar-hover', '/judge', 'desktop', async (current) => current.getByRole('link', { name: 'Open Projects', exact: true }).hover());
    await page.goto(WEB + `/judge/projects/${submissionId}/workspace`);
    await page.getByRole('button', { name: 'Open file App.jsx' }).click();
    await page.getByText('Community Services', { exact: false }).waitFor();
    workflow.push('Judge opened extracted source through the UI workspace');
    await page.goto(WEB + `/judge/projects/${submissionId}/evaluate`);
    for (let index = 1; index <= 8; index += 1) {
      const card = page.locator('section').filter({ hasText: `Criterion ${String(index).padStart(2, '0')}` }).first();
      await card.getByRole('button', { name: '8', exact: true }).click();
    }
    await page.getByRole('button', { name: '3', exact: true }).last().click();
    await page.getByRole('button', { name: 'Save draft' }).last().click();
    await page.getByText('Draft saved successfully.').waitFor();
    const draftState = await request(`/judging/evaluations/${submissionId}/mine`, { token: await tokenFor('judge') });
    const draftSubmission = (await request('/submissions?limit=100', { token: await tokenFor('judge') })).submissions.find((item) => item.id === submissionId);
    if (draftState.evaluation?.status !== 'draft' || draftSubmission.completedEvaluationCount !== 0) throw new Error('Draft persistence/count verification failed');
    workflow.push('Judge saved an eight-criterion draft; completion remained zero');
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Submit final' }).last().click();
    await page.waitForURL('**/judge/evaluations');
    await page.goto(WEB + `/judge/projects/${submissionId}/evaluate`);
    await page.getByText('Final evaluation locked.').waitFor();
    workflow.push('Judge submitted and revisited a locked final evaluation');
  }
  await context.close();
}
const approvalContext = await browser.newContext();
const approvalPage = await login(approvalContext, 'admin');
await approvalPage.goto(WEB + `/admin/projects/${submissionId}`);
approvalPage.once('dialog', (dialog) => dialog.accept());
await approvalPage.getByRole('button', { name: 'Approve official result' }).click();
await approvalPage.getByText('Approved for publication').waitFor();
workflow.push('Administrator approved the completed aggregate through the UI');
await approvalContext.close();
await browser.close();
const report = { submissionId, findings, workflow, consoleErrors };
await fs.writeFile(path.join(output, 'visual-audit.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
