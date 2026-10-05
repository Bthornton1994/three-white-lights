/** Browser → actual client → loopback handler → real PGlite SQL → native hooks.
 * Only GoTrue identities are mocked. No game state or lift result is injected. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { rehearseMeet, rehearseTraining } from './production-meet-browser.mjs';

const root = fileURLToPath(new URL('../', import.meta.url)); const web = path.join(root, 'web');
const fixturePort = '5188'; const browserPort = '5189'; const api = `http://127.0.0.1:${fixturePort}`; const base = `http://127.0.0.1:${browserPort}`;
const evidence = path.join(root, '.gauntlet/evidence/production/account-browser');
const report = { startedAt: new Date().toISOString(), status: 'running', checks: [], attempts: [], errors: [], assetFailures: [], requests: [], authChecks: [], sourceHashes: {}, limitations: ['Auth identities and tokens are explicit local fixtures, not live Supabase sessions.', 'Database/SQL, production handler, native replay and client/hooks are real; PGlite has one connection.', 'Automated browser input does not establish physical-device touch feel, native haptics, or human performance.'] };
const responseReads = []; let browser; let page; let fixture; let vite;
let fixtureLog = ''; let viteLog = '';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(read, message) { const deadline = Date.now() + 30_000; while (Date.now() < deadline) { if (await read()) return; await delay(80); } throw new Error(message); }
async function visibleButton(name) { const candidates = page.getByRole('button', { name, exact: true }); for (const candidate of await candidates.all()) if (await candidate.isVisible()) return candidate; throw new Error(`No visible button named ${name}`); }
async function signIn(key) {
  await page.goto(base, { waitUntil: 'networkidle' }); await (await visibleButton('Sign in')).click();
  await page.getByLabel('Email', { exact: true }).fill(`${key}@twl.test`); await page.getByLabel('Password', { exact: true }).fill('local-fixture-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  await page.getByText('Saved career', { exact: true }).waitFor({ state: 'attached' });
  await page.getByRole('button', { name: 'Your athlete', exact: true }).waitFor();
  assert.equal(await page.locator('.practice-banner').count(), 0);
}
async function persisted(key) {
  const response = await fetch(`${api}/__fixture/state`, { headers: { authorization: `Bearer fixture-${key}` } }); assert.equal(response.status, 200);
  const account = await response.json(); assert.ok(account.state, 'The real SQL account was not persisted.');
  return { revision: account.revision, game: JSON.parse(account.state.gameSave), state: account.state };
}
function watch(activePage) {
  activePage.on('pageerror', error => report.errors.push(error.message));
  activePage.on('response', response => {
    if (response.status() >= 400 && /\.(png|jpe?g|css|js)(\?|$)/.test(response.url())) report.assetFailures.push({ path: new URL(response.url()).pathname, status: response.status() });
    if (response.url().endsWith('/auth/v1/user')) report.authChecks.push({ operation: 'verify-restored-identity', status: response.status() });
    if (!response.url().endsWith('/functions/v1/twl-api')) return;
    const request = response.request(); const command = request.postDataJSON();
    responseReads.push(response.json().then(body => report.requests.push({ kind: command.kind, requestId: command.requestId ?? null, evidenceCount: command.payload?.evidence?.length ?? null, status: response.status(), revision: body.opening?.revision ?? null, acknowledgement: body.response?.wire?.acknowledgedProposalId ?? null, message: body.message ?? null })).catch(error => report.errors.push(error.message)));
  });
}
try {
  await mkdir(evidence, { recursive: true });
  for (const name of ['scripts/production-account-browser.mjs', 'scripts/production-meet-browser.mjs', 'web/tests/production-http-fixture.mjs', 'src/production/client.ts', 'src/production/server.ts', 'src/production/handler.ts', 'src/production/evidenceReplay.ts', 'supabase/functions/twl-api/domain.js', 'supabase/functions/twl-api/domain.manifest.json', 'supabase/migrations/20260930193634_twl_authoritative_accounts.sql', 'src/session/useSession.ts', 'src/meet/useCareer.ts', 'src/meet/useMeetDay.ts', 'web/src/App.tsx', 'web/src/Training.tsx', 'web/src/Meet.tsx', 'web/src/Career.tsx', 'web/src/LiftPlayer.tsx', 'web/src/liftBrowser.ts']) report.sourceHashes[name] = createHash('sha256').update(await readFile(path.join(root, name))).digest('hex');
  fixture = spawn(process.execPath, [path.join(web, 'tests/production-http-fixture.mjs'), fixturePort, browserPort], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  for (const stream of [fixture.stdout, fixture.stderr]) stream.on('data', chunk => { fixtureLog += chunk.toString(); });
  await waitFor(async () => { if (fixture.exitCode !== null) throw new Error(fixtureLog); try { return (await fetch(`${api}/auth/v1/user`, { headers: { authorization: 'Bearer fixture-alice' } })).ok; } catch { return false; } }, 'The loopback SQL fixture did not become ready.');
  vite = spawn(process.execPath, [path.join(web, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', browserPort, '--strictPort'], { cwd: web, env: { ...process.env, VITE_SUPABASE_URL: api, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture' }, stdio: ['ignore', 'pipe', 'pipe'] });
  for (const stream of [vite.stdout, vite.stderr]) stream.on('data', chunk => { viteLog += chunk.toString(); });
  await waitFor(async () => { if (vite.exitCode !== null) throw new Error(viteLog); try { return (await fetch(base)).ok; } catch { return false; } }, 'The local account Vite app did not become ready.');
  const { chromium } = createRequire(path.join(web, 'package.json'))('playwright');
  browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined });
  const trainingContext = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  page = await trainingContext.newPage(); watch(page); await signIn('alice');
  const training = { checks: [], attempts: [] }; const trainingEvidence = path.join(evidence, 'training'); await mkdir(trainingEvidence, { recursive: true });
  await rehearseTraining(page, training, trainingEvidence, { savedAccount: true });
  assert.match(await page.locator('.training-save-confirmed').innerText(), /Saved to your lifter/);
  const alice = await persisted('alice'); assert.equal(training.trainingReps.length, 15); assert.equal(alice.game.fatigue.sessions.length, 1); assert.equal(alice.game.wire.meets.length, 0); assert.equal(alice.game.wire.totalKg, null);
  await responseReads.splice(0).reduce(async (prior, current) => { await prior; await current; }, Promise.resolve());
  const trainingSave = report.requests.find(request => request.kind === 'record-training-session'); assert.equal(trainingSave?.status, 200); assert.equal(trainingSave?.evidenceCount, 15); assert.equal(trainingSave?.acknowledgement, trainingSave?.requestId);
  report.checks.push({ name: 'browser played five by three bench reps; actual client/native hook confirmed the SQL-persisted session', status: 'passed', revision: alice.revision, evidenceCount: trainingSave.evidenceCount });
  const aliceReloadRequests = report.requests.length; const aliceReloadAuth = report.authChecks.length;
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Session logged.', exact: true }).waitFor();
  assert.equal(await page.locator('.practice-banner').count(), 0);
  await Promise.all(responseReads.splice(0));
  assert.ok(report.authChecks.slice(aliceReloadAuth).some(check => check.status === 200), 'Reload did not verify the stored GoTrue identity.');
  assert.ok(report.requests.slice(aliceReloadRequests).some(request => request.kind === 'bootstrap' && request.status === 200 && request.revision === alice.revision), 'Reload did not read the saved SQL revision.');
  report.checks.push({ name: 'reload verifies GoTrue identity and restores the SQL-confirmed session in a fresh native hook', status: 'passed' });
  report.training = training; await trainingContext.close();
  console.log('PASS browser → client → handler → SQL → confirmed native training');
  const meetContext = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  page = await meetContext.newPage(); watch(page); await signIn('bob');
  const meet = { checks: [], attempts: [] }; const meetEvidence = path.join(evidence, 'meet'); await mkdir(meetEvidence, { recursive: true });
  await rehearseMeet(page, meet, meetEvidence, { savedAccount: true });
  const bob = await persisted('bob'); assert.equal(meet.attempts.length, 9); assert.equal(bob.game.wire.meets.length, 1); assert.ok(bob.game.wire.totalKg > 0); assert.equal(bob.game.fatigue.sessions.length, 0);
  await Promise.all(responseReads.splice(0));
  const meetSave = report.requests.find(request => request.kind === 'record-meet-result'); assert.equal(meetSave?.status, 200); assert.equal(meetSave?.evidenceCount, 9); assert.ok(meetSave?.requestId.endsWith(`:${meetSave?.acknowledgement}`));
  const aliceAgain = await persisted('alice'); assert.deepEqual(aliceAgain.state, alice.state);
  report.checks.push({ name: 'browser played nine attempts; actual client/native hook confirmed one SQL meet and original proposal acknowledgement', status: 'passed', revision: bob.revision, evidenceCount: meetSave.evidenceCount, totalKg: bob.game.wire.totalKg });
  report.checks.push({ name: 'the second signed-in account did not alter the first lifter or session', status: 'passed' });
  await page.goto(`${base}#career`, { waitUntil: 'networkidle' });
  await Promise.all(responseReads.splice(0)); const bobReloadRequests = report.requests.length; const bobReloadAuth = report.authChecks.length;
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByText('Saved career', { exact: true }).waitFor({ state: 'attached' });
  await page.getByRole('complementary', { name: 'Your competition standing', exact: true }).waitFor();
  assert.match(await page.getByRole('complementary', { name: 'Your competition standing', exact: true }).innerText(), new RegExp(String(bob.game.wire.totalKg)));
  assert.equal(await page.locator('.practice-banner').count(), 0);
  await Promise.all(responseReads.splice(0));
  assert.ok(report.authChecks.slice(bobReloadAuth).some(check => check.status === 200), 'Meet reload did not verify the stored GoTrue identity.');
  assert.ok(report.requests.slice(bobReloadRequests).some(request => request.kind === 'bootstrap' && request.status === 200 && request.revision === bob.revision), 'Meet reload did not read the saved SQL revision.');
  report.checks.push({ name: 'reload restores the recorded meet total through a fresh production client and Career reading', status: 'passed', totalKg: bob.game.wire.totalKg });
  report.meet = meet; await meetContext.close(); assert.deepEqual(report.errors, []);
  report.status = report.assetFailures.length ? 'account-flow-passed-art-incomplete' : 'account-flow-passed';
  if (report.assetFailures.length) report.limitations.push('Missing art was recorded during this account-flow check. Functional acknowledgement does not satisfy the separate full-art release gate.');
} catch (error) {
  report.status = 'failed'; report.failure = error.stack; process.exitCode = 1;
  if (page && !page.isClosed()) { try { await page.screenshot({ path: path.join(evidence, 'failure.png'), fullPage: true }); await writeFile(path.join(evidence, 'failure-body.txt'), await page.locator('body').innerText()); } catch { /* A crashed page cannot capture. */ } }
} finally {
  await Promise.all(responseReads); report.finishedAt = new Date().toISOString(); report.fixtureLog = fixtureLog; report.viteLog = viteLog;
  await writeFile(path.join(evidence, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  if (browser) await browser.close(); if (vite) vite.kill('SIGTERM'); if (fixture) fixture.kill('SIGTERM');
  console.log(JSON.stringify({ status: report.status, evidence, failure: report.failure ?? null }));
}
