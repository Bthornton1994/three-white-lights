/**
 * Browser release checks against the built app's normal controls. Auth failure
 * responses are intercepted deliberately; this does not grade live sign-in,
 * physical-device feel, native haptics, or a human's competition performance.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const web = path.join(root, 'web');
const evidence = path.join(root, '.gauntlet/shots/production-web');
const webRequire = createRequire(path.join(web, 'package.json'));
let playwright;
try { playwright = webRequire('playwright'); }
catch (error) {
  if (!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES) throw error;
  playwright = createRequire(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, 'playwright/package.json'))('playwright');
}

const report = {
  capturedAt: new Date().toISOString(),
  baseRevision: process.env.PRODUCTION_BASE_REVISION ?? null,
  sourceDigest: null,
  url: process.env.BROWSER_BASE_URL ?? 'http://127.0.0.1:4173',
  subject: 'Production browser app, reached through visible controls; no query-string debug fixtures.',
  limitations: ['Auth uses deliberately refused HTTP responses; live account creation and saved-account isolation are separate backend checks.', 'Browser input does not establish physical-device touch feel or native haptics.'],
  checks: [],
  consoleErrors: [],
  assetFailures: [],
};
let preview;
let previewLog = '';
let browser;
let activePage;

async function sourceDigest() {
  const hash = createHash('sha256');
  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (['node_modules', 'dist', '.git', '.gauntlet'].includes(entry.name)) continue;
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (entry.isFile()) {
        hash.update(path.relative(root, file));
        hash.update(await readFile(file));
      }
    }
  }
  await walk(path.join(root, 'src'));
  await walk(web);
  return hash.digest('hex');
}

async function check(name, fn) {
  try {
    const details = await fn();
    const status = details?.status === 'skipped' ? 'skipped' : 'passed';
    report.checks.push({ name, status, details: details ?? null });
    console.log(`${status === 'skipped' ? 'SKIP' : 'PASS'} ${name}`);
  } catch (error) {
    report.checks.push({ name, status: 'failed', error: error.message });
    console.error(`FAIL ${name}: ${error.message}`);
    throw error;
  }
}

async function waitUntil(fn, message, timeout = 10_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await fn()) return;
    await new Promise(resolve => setTimeout(resolve, 40));
  }
  throw new Error(message);
}

async function visibleButton(page, name) {
  const candidates = page.getByRole('button', { name, exact: true });
  let found;
  await waitUntil(async () => {
    for (const candidate of await candidates.all()) {
      if (await candidate.isVisible()) { found = candidate; return true; }
    }
    return false;
  }, `No visible button named ${String(name)}`);
  return found;
}

async function hitTest(locator, aboveFold = false) {
  await locator.waitFor({ state: 'visible' });
  const details = await locator.evaluate(element => {
    const rect = element.getBoundingClientRect();
    let opacity = 1;
    for (let current = element; current; current = current.parentElement) opacity *= Number(getComputedStyle(current).opacity);
    const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
    const hit = document.elementFromPoint(x, y);
    return {
      x: rect.x, y: rect.y, width: rect.width, height: rect.height,
      viewportWidth: innerWidth, viewportHeight: innerHeight,
      opacity, hit: hit === element || element.contains(hit),
      touchAction: getComputedStyle(element).touchAction,
      disabled: element instanceof HTMLButtonElement && element.disabled,
    };
  });
  assert.ok(details.opacity > .9, 'control is mounted but transparent');
  assert.ok(details.width >= 40 && details.height >= 40, `control target is ${details.width}×${details.height}`);
  if (aboveFold) {
    assert.ok(details.y >= 0 && details.y + details.height <= details.viewportHeight, `control is below the fold: ${JSON.stringify(details)}`);
    assert.ok(details.x >= 0 && details.x + details.width <= details.viewportWidth, 'control is horizontally clipped');
  }
  assert.ok(details.hit, 'control is covered or outside the viewport');
  assert.equal(details.disabled, false, 'control cannot be pressed');
  return details;
}

async function storageKeys(page) {
  return page.evaluate(() => ({
    local: Object.keys(localStorage).filter(key => key !== 'twl:preference:sound'),
    session: Object.keys(sessionStorage),
  }));
}

async function noProtectedPracticeStorage(page) {
  assert.deepEqual(await storageKeys(page), { local: [], session: [] }, 'practice wrote protected browser storage');
}

async function renderAudit(page) {
  await page.locator('main').waitFor({ state: 'visible' });
  await page.evaluate(() => document.fonts.ready);
  const details = await page.evaluate(() => ({
    text: document.querySelector('main')?.textContent?.trim().length ?? 0,
    overlay: !!document.querySelector('vite-error-overlay, .vite-error-overlay, [data-nextjs-dialog]'),
    width: innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    brokenImages: [...document.images].filter(image => image.getBoundingClientRect().width > 0 && image.complete && image.naturalWidth === 0).map(image => new URL(image.src).pathname),
  }));
  assert.ok(details.text > 80, 'the main screen is empty');
  assert.equal(details.overlay, false, 'a framework error overlay is rendered');
  assert.ok(details.documentWidth <= details.width + 1, `horizontal overflow: ${details.documentWidth} > ${details.width}`);
  assert.deepEqual(details.brokenImages, [], 'visible art failed to decode');
  assert.equal(new URL(page.url()).search, '', 'a debug URL replaced the played flow');
  return details;
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(evidence, `${name}.png`), fullPage: true, animations: 'disabled' });
}

async function watch(page) {
  page.on('pageerror', error => report.consoleErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && !message.text().includes('503 (Service Unavailable)')) report.consoleErrors.push(message.text());
  });
  page.on('response', response => {
    if (response.status() >= 400 && /\.(?:png|jpe?g|svg|ttf|woff2?|css|js)(?:\?|$)/.test(response.url())) report.assetFailures.push({ url: new URL(response.url()).pathname, status: response.status() });
  });
}

async function mobileStory() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  activePage = page;
  await watch(page);
  let savedRequests = 0;
  page.on('request', request => { if (request.url().includes('/functions/v1/')) savedRequests += 1; });
  await page.goto(report.url, { waitUntil: 'networkidle' });
  await page.locator('.practice-banner').filter({ hasText: 'Practice gym' }).waitFor({ state: 'visible' });

  await check('phone: practice gym loads, art decodes, and Train is visible and pressable above the fold', async () => {
    const layout = await renderAudit(page);
    const control = await hitTest(await visibleButton(page, 'Train'), true);
    await noProtectedPracticeStorage(page);
    await shot(page, '01-phone-gym');
    return { layout, control };
  });

  for (const [button, heading, screenshot] of [
    ['Shop', 'Make room for more.', '02-phone-shop'],
    ['Staff', 'Good people. Great gym.', '03-phone-staff'],
  ]) {
    await check(`phone: ${button} is reached through the normal navigation and has an exit`, async () => {
      await (await visibleButton(page, button)).click();
      await page.getByRole('heading', { name: heading, exact: true }).waitFor();
      const audit = await renderAudit(page);
      await shot(page, screenshot);
      await (await visibleButton(page, 'Gym')).click();
      await page.getByRole('region', { name: 'Your gym', exact: true }).waitFor();
      return audit;
    });
  }

  await check('phone: Build mode selects a tile through its real controls and returns to the gym', async () => {
    await (await visibleButton(page, 'Build gym')).click();
    await page.getByRole('heading', { name: 'Build your gym.', exact: true }).waitFor();
    const place = await visibleButton(page, 'Place item');
    assert.equal(await place.isDisabled(), true, 'Place item must require an explicit tile');
    await page.getByLabel('Equipment', { exact: true }).selectOption('power-bar');
    await page.getByLabel('Column', { exact: true }).fill('4');
    await page.getByLabel('Row', { exact: true }).fill('1');
    assert.equal(await place.isEnabled(), true);
    await place.click();
    await page.getByRole('status').filter({ hasText: 'placed' }).waitFor();
    await noProtectedPracticeStorage(page);
    await shot(page, '04-phone-build');
    await (await visibleButton(page, 'Back to gym')).click();
  });

  await check('phone: a practice lifter is created through settings and appears in the career flow without writing saved state', async () => {
    await (await visibleButton(page, 'Settings')).click();
    await (await visibleButton(page, 'Create a lifter')).click();
    await page.getByLabel('Platform name', { exact: true }).fill('R. VELLUM');
    await page.getByLabel('Bodyweight (kg)', { exact: true }).fill('83.5');
    await (await visibleButton(page, 'Create lifter')).click();
    await page.getByRole('heading', { name: /A total\s+worth chasing\./ }).waitFor();
    await renderAudit(page);
    await noProtectedPracticeStorage(page);
    await shot(page, '05-phone-career');
    await (await visibleButton(page, 'Gym')).click();
  });

  await check('phone: readiness and RPE lead to a real live squat with a usable lift control above the fold', async () => {
    await (await visibleButton(page, 'Train')).click();
    await page.getByTestId('training-screen').waitFor();
    await page.getByTestId('check-in-lift-squat').click();
    for (const answer of ['check-in-sleep-good', 'check-in-soreness-fresh', 'check-in-motivation-fired-up']) await page.getByTestId(answer).click();
    const rpe = page.getByTestId('session-rpe-6');
    await waitUntil(() => rpe.isEnabled(), 'the prescribed RPE choices never became available');
    await rpe.click();
    await page.getByTestId('session-start').click();
    const control = page.locator('.lift-control');
    await control.waitFor({ state: 'visible' });
    const geometry = await hitTest(control, true);
    assert.equal(geometry.touchAction, 'none', 'a lift press can be canceled by browser panning');
    await renderAudit(page);
    await shot(page, '06-phone-live-squat');
    return geometry;
  });

  await check('phone: interrupted held input releases the bar, freezes the rep, and resumes through the lift control', async () => {
    const control = page.locator('.lift-control');
    await control.focus();
    await page.keyboard.down('Space');
    await page.waitForFunction(() => document.querySelector('.lift-player')?.getAttribute('data-held') === 'true');
    await page.keyboard.press('Tab');
    await page.keyboard.up('Space');
    await page.locator('.lift-player--paused').waitFor();
    assert.equal(await page.locator('.lift-player').getAttribute('data-held'), 'false');
    const tick = await page.locator('.lift-player').getAttribute('data-tick');
    await page.waitForTimeout(100);
    assert.equal(await page.locator('.lift-player').getAttribute('data-tick'), tick);
    await control.focus();
    await page.keyboard.down('Space');
    await page.waitForFunction(() => !document.querySelector('.lift-player--paused'));
    await page.keyboard.up('Space');
    await noProtectedPracticeStorage(page);
  });

  await check('phone: a genuine failed rep exposes the lighter-target retry through the played session', async () => {
    // Regrip and hold past depth: the accepted lift engine produces this miss.
    const control = page.locator('.lift-control');
    await control.focus();
    await page.keyboard.down('Space');
    await page.getByTestId('session-close-out').waitFor({ timeout: 12_000 });
    await page.keyboard.up('Space');
    const retry = await visibleButton(page, 'Try a lighter target');
    await shot(page, '07-phone-failed-rep');
    await retry.click();
    await page.getByTestId('session-rpe-6').waitFor();
    await (await visibleButton(page, 'Return to the gym')).click();
    await noProtectedPracticeStorage(page);
  });

  await check('phone: auth validates input, surfaces a refused request, and permits an explicit retry', async () => {
    await (await visibleButton(page, 'Sign in')).click();
    const form = page.locator('.account-form');
    await form.waitFor();
    assert.equal(await form.getByLabel('Email', { exact: true }).getAttribute('type'), 'email');
    assert.equal(await form.getByLabel('Password', { exact: true }).getAttribute('minlength'), '1');
    await form.getByRole('button', { name: 'New here? Create an account', exact: true }).click();
    assert.equal(await form.getByLabel('Password', { exact: true }).getAttribute('minlength'), '8');
    await form.getByRole('button', { name: 'Already have an account? Sign in', exact: true }).click();
    const submit = form.getByRole('button', { name: 'Sign in', exact: true });
    let skipped = false;
    if (await submit.isDisabled()) {
      await form.getByRole('alert').waitFor();
      assert.notEqual(process.env.BROWSER_EXPECT_AUTH, '1', 'CI expected a configured auth client but sign-in is unavailable');
      report.limitations.push('This artifact has no auth configuration; only its explicit unavailable state was inspected.');
      skipped = true;
    } else {
      let requests = 0;
      await page.route('**/auth/v1/**', async route => {
        requests += 1;
        await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Service temporarily unavailable. Please try again.', error_description: 'Service temporarily unavailable. Please try again.' }) });
      });
      await form.getByLabel('Email', { exact: true }).fill('release-check@example.invalid');
      await form.getByLabel('Password', { exact: true }).fill('release-check-only');
      await submit.click();
      await form.getByRole('alert').waitFor();
      assert.equal(await submit.isEnabled(), true, 'auth failure stranded the submit button');
      const first = requests;
      assert.ok(first > 0, 'sign-in did not reach the auth boundary');
      await submit.click();
      await waitUntil(() => requests > first, 'explicit retry did not send another auth request');
      await form.getByRole('alert').waitFor();
      await noProtectedPracticeStorage(page);
    }
    await shot(page, '08-phone-auth-failure');
    await (await visibleButton(page, 'Back to gym')).click();
    assert.equal(savedRequests, 0, 'a guest practice action reached saved-account progression');
    return skipped ? { status: 'skipped', reason: 'This build explicitly reports auth as unavailable; no auth failure or retry was driven.' } : undefined;
  });

  await check('phone: confirmed restart clears the practice lifter and reload retains no protected progression', async () => {
    await (await visibleButton(page, 'Settings')).click();
    await page.getByRole('heading', { name: 'R. VELLUM', exact: true }).waitFor();
    await (await visibleButton(page, 'Restart practice')).click();
    await (await visibleButton(page, 'Confirm restart')).click();
    await (await visibleButton(page, 'Settings')).click();
    await page.getByRole('heading', { name: 'Your athlete', exact: true }).waitFor();
    assert.equal(await page.getByRole('heading', { name: 'R. VELLUM', exact: true }).count(), 0);
    await (await visibleButton(page, 'Gym')).click();
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('.practice-banner').filter({ hasText: 'Practice gym' }).waitFor();
    await noProtectedPracticeStorage(page);
    await renderAudit(page);
    await shot(page, '09-phone-restarted');
  });
  await context.close();
}

try {
  await mkdir(evidence, { recursive: true });
  report.sourceDigest = await sourceDigest();
  try { report.commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { report.commit = null; }
  if (!process.env.BROWSER_BASE_URL) {
    preview = spawn(process.execPath, [path.join(web, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], { cwd: web, stdio: ['ignore', 'pipe', 'pipe'] });
    for (const stream of [preview.stdout, preview.stderr]) stream.on('data', chunk => { previewLog += chunk.toString(); });
    await waitUntil(async () => {
      if (preview.exitCode !== null) throw new Error(`Production preview exited: ${previewLog}`);
      try { return (await fetch(report.url, { signal: AbortSignal.timeout(1000) })).ok; } catch { return false; }
    }, `Production preview did not start: ${previewLog}`, 15_000);
  }
  browser = await playwright.chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined });
  await mobileStory();
  await check('desktop: the production gym renders with usable navigation and no broken assets', async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    activePage = page;
    await watch(page);
    await page.goto(report.url, { waitUntil: 'networkidle' });
    await page.locator('.practice-banner').filter({ hasText: 'Practice gym' }).waitFor();
    const audit = await renderAudit(page);
    await hitTest(await visibleButton(page, 'Career'), true);
    await shot(page, '10-desktop-gym');
    await context.close();
    return audit;
  });
  await check('production metadata includes valid install icons and missing assets stay missing', async () => {
    const manifestResponse = await fetch(new URL('/manifest.webmanifest', report.url));
    assert.equal(manifestResponse.status, 200);
    const manifest = await manifestResponse.json();
    assert.equal(manifest.display, 'standalone');
    for (const icon of manifest.icons) {
      const response = await fetch(new URL(icon.src, report.url));
      assert.equal(response.status, 200, `${icon.src} is missing`);
      assert.match(response.headers.get('content-type') ?? '', /image\/png/);
    }
    const absent = await fetch(new URL('/assets/release-check-missing.png', report.url));
    assert.equal(absent.status, 404, 'a missing asset was rewritten to index.html');
  });
  await check('no unexpected browser errors or failed production assets', () => {
    assert.deepEqual(report.consoleErrors, []);
    assert.deepEqual(report.assetFailures, []);
  });
  await check('the source artifact did not change during verification', async () => {
    report.finalSourceDigest = await sourceDigest();
    assert.equal(report.finalSourceDigest, report.sourceDigest);
  });
} catch (error) {
  report.failure = error.message;
  if (activePage && !activePage.isClosed()) {
    try { await shot(activePage, 'failure'); } catch { /* A crashed page may not capture. */ }
  }
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (preview) preview.kill('SIGTERM');
  report.previewLog = previewLog;
  report.finishedAt = new Date().toISOString();
  await writeFile(path.join(evidence, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  if (report.failure) console.error(report.failure);
  console.log(`Browser evidence: ${path.relative(root, evidence)}`);
}
