/** Actual browser evidence. Late stages use an explicitly labeled dev-only
 * seeded fixture; saved-account checks use the client/handler/SQL fixture.
 * Desktop software rendering and emulated touch are not device acceptance. */
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const root = fileURLToPath(new URL('..', import.meta.url));
const web = path.join(root, 'web'), output = path.join(root, '.gauntlet/shots/gym-empire/after');
const port = 5190, apiPort = 5191, base = `http://127.0.0.1:${port}`, api = `http://127.0.0.1:${apiPort}`;
const report = { capturedAt: new Date().toISOString(), sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), sourceHashes: {}, checks: [], captures: [], errors: [], limitations: ['Late-stage wallets/equipment are labeled seeded QA fixtures, not earned progression.', 'Account checks use mock GoTrue identities with the actual client, handler, committed migration and PostgreSQL WASM.', 'CI virtual CPU/software graphics and emulated touch do not establish phone GPU performance, physical haptics, fun or comparative preference.'] };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let browser, vite, fixture, activePage;
const logs = { vite: '', fixture: '' };
async function until(read, message, timeout = 30_000) { const end = Date.now() + timeout; while (Date.now() < end) { if (await read()) return; await delay(80); } throw new Error(message); }
async function check(name, run) { try { const details = await run(); report.checks.push({ name, status: 'passed', details }); console.log('PASS ' + name); } catch (error) { report.checks.push({ name, status: 'failed', error: error.message }); throw error; } }
async function scene(page) { const canvas = page.getByTestId('gym-world'); await until(() => canvas.getAttribute('data-camera'), 'Scene frame was not reported.'); return canvas.evaluate(element => ({ camera: JSON.parse(element.dataset.camera), entities: JSON.parse(element.dataset.entities), activities: JSON.parse(element.dataset.activities), memberIds: JSON.parse(element.dataset.memberIds), tick: Number(element.dataset.simTick), counts: JSON.parse(element.dataset.activityCounts), metrics: element.twlMetrics })); }
async function capture(page, name, details = {}) { await page.evaluate(() => document.fonts.ready); const file = name + '.png'; await page.screenshot({ path: path.join(output, file), fullPage: true }); report.captures.push({ file, ...details }); }
async function visibleButton(page, name) { const matches = page.getByRole('button', { name, exact: true }); for (const button of await matches.all()) if (await button.isVisible()) return button; throw new Error('Missing visible button: ' + name); }
function watch(page) { activePage = page; page.on('pageerror', error => report.errors.push(error.message)); }
async function coordinates(page, column, row) { const details = page.locator('.build-coordinate-details'); if (!(await details.evaluate(element => element.open))) await details.locator('summary').click(); await page.getByLabel('Column', { exact: true }).fill(String(column)); await page.getByLabel('Row', { exact: true }).fill(String(row)); }
async function directTouch(page, points) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...points[0], id: 1, radiusX: 4, radiusY: 4, force: 1 }] });
  await delay(150);
  for (const point of points.slice(1)) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, id: 1, radiusX: 4, radiusY: 4, force: 1 }] }); await delay(60); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach();
}
async function worldPoint(page, x, y) { const { camera } = await scene(page); const rect = await page.getByTestId('gym-world').boundingBox(); return { x: rect.x + camera.origin.x + (x - y) * camera.scale, y: rect.y + camera.origin.y + (x + y) * camera.scale * camera.floorSlope }; }
async function fixtureState(page) { const text = await page.locator('#fixture-state').textContent(); return JSON.parse(text); }
function percentiles(values) { const sorted = [...values].sort((a, b) => a - b); return { samples: sorted.length, median: sorted[Math.floor(sorted.length * .5)] ?? null, p95: sorted[Math.floor(sorted.length * .95)] ?? null, max: sorted.at(-1) ?? null }; }

try {
  await mkdir(output, { recursive: true });
  for (const directory of ['src/facility', 'src/production', 'web/src', 'web/tests']) {
    async function walk(folder) { for (const entry of (await readdir(folder, { withFileTypes: true })).sort((a,b) => a.name.localeCompare(b.name))) { const file = path.join(folder, entry.name); if (entry.isDirectory()) await walk(file); else report.sourceHashes[path.relative(root, file)] = createHash('sha256').update(await readFile(file)).digest('hex'); } }
    await walk(path.join(root, directory));
  }
  fixture = spawn(process.execPath, [path.join(web, 'tests/production-http-fixture.mjs'), String(apiPort), String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  for (const stream of [fixture.stdout, fixture.stderr]) stream.on('data', chunk => { logs.fixture += chunk; });
  await until(async () => { if (fixture.exitCode !== null) throw new Error(logs.fixture); try { return (await fetch(api + '/auth/v1/user', { headers: { authorization: 'Bearer fixture-alice' } })).ok; } catch { return false; } }, 'SQL fixture unavailable.');
  vite = spawn(process.execPath, [path.join(web, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: web, env: { ...process.env, VITE_SUPABASE_URL: api, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture' }, stdio: ['ignore', 'pipe', 'pipe'] });
  for (const stream of [vite.stdout, vite.stderr]) stream.on('data', chunk => { logs.vite += chunk; });
  await until(async () => { if (vite.exitCode !== null) throw new Error(logs.vite); try { return (await fetch(base)).ok; } catch { return false; } }, 'App preview unavailable.');
  const { chromium } = createRequire(path.join(web, 'package.json'))('playwright');
  browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined });
  report.hardware = { browser: browser.version(), os: os.platform() + ' ' + os.release(), cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length, ramBytes: os.totalmem(), runner: process.env.GITHUB_RUN_ID ?? 'local', graphics: 'Recorded below; browser headless is not a physical phone.' };

  for (const [width, height] of [[320,800],[390,844],[430,932],[1440,1000]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: width < 760, hasTouch: width < 760 });
    const page = await context.newPage(); watch(page);
    await check(`${width}px normal practice Gym and Build render without horizontal clipping`, async () => {
      await page.goto(base, { waitUntil: 'networkidle' }); const initial = await scene(page); await delay(1000);
      assert.ok((await scene(page)).tick > initial.tick); await capture(page, `${width}-gym`, { seeded: false, viewport: { width, height } });
      await (await visibleButton(page, 'Build gym')).click();
      await capture(page, `${width}-build`, { seeded: false, viewport: { width, height } });
      const geometry = await page.evaluate(() => { const button = [...document.querySelectorAll('button')].find(element => element.textContent.trim() === 'Place item'); const r = button.getBoundingClientRect(); const world = document.querySelector('[data-testid="gym-world"]').getBoundingClientRect(); return { viewport: innerWidth, document: document.documentElement.scrollWidth, place: { x:r.x,y:r.y,width:r.width,height:r.height }, world: { x:world.x,y:world.y,width:world.width,height:world.height }, height:innerHeight }; });
      assert.ok(geometry.document <= width + 1, 'Horizontal overflow');
      assert.ok(geometry.place.y + geometry.place.height <= height - (width < 760 ? 65 : 0), 'Place control is below the available phone viewport.');
      assert.ok(geometry.place.width >= 44 && geometry.place.height >= 44); return geometry;
    }); await context.close();
  }

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, recordVideo: { dir: output, size: { width: 390, height: 844 } } });
  const phone = await mobile.newPage(); watch(phone); await phone.goto(base + '/tests/gym-playtest.html', { waitUntil: 'networkidle' });
  await check('uncut emulated phone: real queue → second usable bench, stable identities and member response', async () => {
    await until(async () => (await scene(phone)).counts.waiting > 0 && (await scene(phone)).counts.training === 1, 'The opening queue was not observed.');
    const before = await scene(phone); await capture(phone, 'capacity-before', { seeded: true });
    await phone.getByRole('button', { name: 'Buy Second bench for 180 Gym Bucks', exact: true }).click();
    await until(async () => (await scene(phone)).entities.filter(entity => entity.item === 'flat-bench' && entity.kind === 'equipment').length === 2, 'Capacity did not render two real benches.');
    await until(async () => (await scene(phone)).counts.training === 2, 'The second usable bench never received another member.', 45_000);
    const after = await scene(phone); assert.deepEqual(after.memberIds, before.memberIds); assert.ok(after.tick > before.tick); await capture(phone, 'capacity-after', { seeded: true }); return { before: { counts: before.counts, tick: before.tick }, after: { counts: after.counts, tick: after.tick }, sameMemberIds: true };
  });
  await check('uncut emulated phone: direct selection, drag, rotation, invalid feedback, cancel, commit and member interruption', async () => {
    await phone.getByRole('button', { name: 'build', exact: true }).click();
    const frame = await scene(phone), entity = frame.entities.find(entity => entity.id === 'flat-bench');
    const rect = await phone.getByTestId('gym-world').boundingBox();
    const hull = entity.hitPolygon, center = { x: rect.x + hull.reduce((sum,p)=>sum+p.x,0)/hull.length, y: rect.y + hull.reduce((sum,p)=>sum+p.y,0)/hull.length };
    await directTouch(phone, [center]); await phone.getByRole('heading', { name: 'Competition bench', exact: true }).waitFor();
    const destination = await worldPoint(phone, 5, 4); const points = Array.from({ length: 10 }, (_,i) => ({ x:center.x+(destination.x-center.x)*(i+1)/10, y:center.y+(destination.y-center.y)*(i+1)/10 }));
    await directTouch(phone, [center, ...points]);
    await phone.getByRole('button', { name: 'Rotate 0°', exact: true }).click();
    await coordinates(phone, 2, 1);
    assert.equal(await phone.getByRole('button', { name: 'Place item', exact: true }).isDisabled(), true); await capture(phone, 'phone-invalid-rotation', { seeded: true });
    await phone.getByRole('button', { name: 'Cancel', exact: true }).click();
    const committedBefore = Number(await phone.locator('.gym-screen').getAttribute('data-layout-revision'));
    await phone.getByRole('button', { name: 'Select Competition bench', exact: true }).click();
    // Capacity reserves a second full bench; store first, then undo demonstrates
    // a valid authoritative edit while the rotation/collision preview stays real.
    await phone.getByRole('button', { name: 'Return to storage', exact: true }).click();
    await phone.getByRole('status').filter({ hasText: 'Competition bench returned to storage.' }).waitFor();
    await until(async () => (await scene(phone)).entities.every(entity => entity.item !== 'flat-bench'), 'Stored bench remained usable in the scene.');
    const interrupted = await scene(phone); assert.deepEqual(interrupted.memberIds, frame.memberIds); assert.ok(interrupted.tick > frame.tick);
    await phone.getByRole('button', { name: 'Undo last edit', exact: true }).click();
    await phone.getByRole('status').filter({ hasText: 'Last layout edit undone.' }).waitFor();
    await phone.getByRole('button', { name: 'Select Competition bench', exact: true }).click();
    await coordinates(phone, 4, 1); await phone.getByRole('button', { name: 'Place item', exact: true }).click();
    await phone.getByRole('status').filter({ hasText: 'Competition bench placed.' }).waitFor();
    await capture(phone, 'phone-placement-confirmed', { seeded: true }); return { committedBefore, committedAfter: Number(await phone.locator('.gym-screen').getAttribute('data-layout-revision')), memberResponse: interrupted.activities };
  });
  await check('lost acknowledgement retries the same key, with one edit; stale revisions refuse without rollback', async () => {
    await phone.locator('header details summary').click(); await phone.getByRole('button', { name: 'Lose next acknowledgement', exact: true }).click();
    await phone.getByRole('button', { name: 'Select Power bar', exact: true }).click(); await coordinates(phone, 1, 4);
    await phone.getByRole('button', { name: 'Place item', exact: true }).click(); await phone.getByRole('alert').waitFor();
    const first = await fixtureState(phone); const original = first.calls.at(-1);
    await phone.getByRole('button', { name: 'Retry change', exact: true }).click(); await phone.getByRole('status').filter({ hasText: 'Power bar placed.' }).waitFor();
    const retried = await fixtureState(phone); assert.equal(retried.calls.at(-1).key, original.key); assert.equal(retried.calls.at(-1).replay, true); assert.equal(retried.state.floor.layoutRevision, first.state.floor.layoutRevision);
    await phone.getByRole('button', { name: 'Select Power bar', exact: true }).click(); await coordinates(phone, 1, 4);
    await phone.getByRole('button', { name: 'Commit another layout revision', exact: true }).click();
    await phone.getByRole('button', { name: 'Place item', exact: true }).click(); await phone.getByRole('alert').filter({ hasText: 'layout changed' }).waitFor();
    const conflict = await fixtureState(phone); assert.equal(conflict.state.lastRefusal, 'layout-conflict'); return { retryKeyReused: true, oneRevision: true, conflictRefused: true };
  });
  await check('rapid purchase is charged once and member identities survive navigation', async () => {
    const before = await scene(phone); await phone.getByRole('button', { name: 'shop', exact: true }).click();
    const buy = phone.getByRole('button', { name: /^Buy Squat rack for/ }); await buy.dblclick();
    await phone.getByRole('status').filter({ hasText: 'Squat rack added to storage.' }).waitFor();
    const data = await fixtureState(phone); const buys = data.calls.filter(call => call.action.kind === 'buy-ladder' && call.action.item === 'squat-rack'); assert.equal(buys.length, 1);
    assert.equal(data.state.managed.gym.ladder.equipment.filter(item=>item==='squat-rack').length, 1);
    assert.deepEqual((await scene(phone)).memberIds, before.memberIds); return { purchaseRequests: buys.length };
  });
  const metrics = await scene(phone);
  report.performance = { hardware: report.hardware, viewport: { width: 390, height: 844 }, dpr: 1, frameIntervalsMs: percentiles(metrics.metrics.frameIntervals), buildAndDrawMs: percentiles(metrics.metrics.drawDurations), pointerToDrawMs: percentiles(metrics.metrics.interactionLatencies) };
  report.graphics = await phone.evaluate(() => { const gl = document.createElement('canvas').getContext('webgl'); if (!gl) return 'WebGL unavailable'; const ext = gl.getExtension('WEBGL_debug_renderer_info'); return { renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR) }; });
  const video = phone.video(); await mobile.close(); await video.saveAs(path.join(output, 'phone-uncut.webm')); report.video = 'phone-uncut.webm';

  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 }); const page = await context.newPage(); watch(page);
  for (const stage of ['garage','storage-unit','strip-mall-unit','warehouse']) await check(`seeded ${stage} has its actual floor size, distinct architecture and state-backed equipment`, async () => {
    await page.goto(base + '/tests/gym-playtest.html', { waitUntil: 'networkidle' }); await page.getByLabel('Stage fixture', { exact: true }).selectOption(stage); await (await visibleButton(page, 'Fit whole gym')).click(); await delay(1000); const frame = await scene(page); await capture(page, 'stage-' + stage, { seeded: true, grid: frame.camera.grid, equipment: frame.entities.filter(entity=>entity.kind==='equipment').map(entity=>entity.item) }); return { grid: frame.camera.grid, counts: frame.counts };
  }); await context.close();

  const accounts = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 }); const account = await accounts.newPage(); watch(account);
  await check('saved account: rotated layout restores on reload and a second sign-in; other account remains separate', async () => {
    async function signIn(name) { await account.goto(base, { waitUntil: 'networkidle' }); await (await visibleButton(account, 'Sign in')).click(); await account.getByLabel('Email', { exact: true }).fill(name + '@twl.test'); await account.getByLabel('Password', { exact: true }).fill('local-fixture-password'); await account.getByRole('button', { name: 'Sign in', exact: true }).last().click(); await account.getByText('Saved career', { exact: true }).waitFor({ state: 'attached' }); await scene(account); }
    await signIn('alice'); await (await visibleButton(account, 'Build gym')).click(); await account.getByRole('button', { name: 'Select Competition bench', exact: true }).click(); await account.getByRole('button', { name: 'Rotate 0°', exact: true }).click(); await coordinates(account, 4, 4); await account.getByRole('button', { name: 'Place item', exact: true }).click(); await account.getByRole('status').filter({ hasText: 'Competition bench placed.' }).waitFor();
    const read = async name => { const response = await fetch(api + '/__fixture/state', { headers: { authorization: 'Bearer fixture-' + name } }); assert.equal(response.status, 200); const value = await response.json(); return JSON.parse(value.state.facilitySave).truth.facility; };
    const saved = await read('alice'); assert.deepEqual(saved.furniture['flat-bench'], { x:3,y:3,rotation:90 });
    await account.reload({ waitUntil: 'networkidle' }); await until(async () => (await scene(account)).entities.some(entity=>entity.id==='flat-bench' && entity.rotation===90), 'Reload lost the saved rotation.'); await capture(account, 'account-reloaded', { savedAccount: true, auth: 'local mock', database: 'real SQL' });
    await (await visibleButton(account, 'Settings')).click(); await (await visibleButton(account, 'Sign out')).click(); await account.locator('.practice-banner').waitFor();
    await signIn('alice'); const restored = await scene(account); assert.equal(restored.entities.find(entity=>entity.id==='flat-bench').rotation, 90); assert.deepEqual((await read('alice')).furniture, saved.furniture);
    await (await visibleButton(account, 'Settings')).click(); await (await visibleButton(account, 'Sign out')).click(); await account.locator('.practice-banner').waitFor(); await signIn('bob'); assert.equal((await scene(account)).entities.find(entity=>entity.id==='flat-bench').rotation, 0); assert.deepEqual((await read('alice')).furniture, saved.furniture); return { rotatedPlacement: saved.furniture['flat-bench'], restoredTwice: true, accountIsolated: true };
  }); await accounts.close(); assert.deepEqual(report.errors, []); report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = error.stack; process.exitCode = 1; if (activePage && !activePage.isClosed()) { try { await capture(activePage, 'failure'); await writeFile(path.join(output, 'failure-body.txt'), await activePage.locator('body').innerText()); } catch {} } }
finally { if (browser) await browser.close(); vite?.kill('SIGTERM'); fixture?.kill('SIGTERM'); await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n'); if (report.status !== 'passed') await writeFile(path.join(output, 'server.log'), JSON.stringify(logs, null, 2)); console.log(JSON.stringify({ status: report.status, checks: report.checks.length, failure: report.failure?.split('\n')[0] })); }
