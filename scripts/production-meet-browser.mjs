/** Visible-controls rehearsal. It drives native lifts; it never injects game state. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const web = path.join(root, 'web');
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitUntil(read, message, timeout = 15_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await read()) return;
    await pause(12);
  }
  throw new Error(message);
}

async function visibleButton(page, name) {
  const buttons = page.getByRole('button', { name, exact: true });
  for (const button of await buttons.all()) if (await button.isVisible()) return button;
  throw new Error(`No visible button named ${String(name)}`);
}

async function shot(page, evidence, name) {
  await page.screenshot({ path: path.join(evidence, `${name}.png`), fullPage: true });
}

/** Only visible presentation cues are read: phase, ring highlight and control copy. */
async function liftView(page) {
  return page.locator('.lift-player').evaluate((element) => ({
    phase: element.getAttribute('data-phase'),
    tick: Number(element.getAttribute('data-tick')),
    held: element.getAttribute('data-held') === 'true',
    paused: element.classList.contains('lift-player--paused'),
    label: element.querySelector('.lift-control')?.textContent ?? '',
    onBeat: !!element.querySelector('.lift-cue--on-beat'),
    outcome: element.classList.contains('lift-player--miss') ? 'miss'
      : element.classList.contains('lift-player--grind') ? 'grind'
        : element.classList.contains('lift-player--good-lift') ? 'good-lift' : null,
  }));
}

async function playVisibleLift(page, kind) {
  const control = page.locator('.lift-control');
  await control.waitFor({ state: 'visible' });
  await waitUntil(() => control.isEnabled(), 'The lift control never became ready.');
  const box = await control.boundingBox();
  assert.ok(box && box.y >= 0 && box.y + box.height <= 844, 'Lift control is outside the phone viewport.');
  assert.ok(box.width >= 40 && box.height >= 40, 'Lift control is too small.');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  let held = false;
  let usedBeat = false;
  const press = async () => { if (!held) { await page.mouse.down(); held = true; } };
  const release = async () => { if (held) { await page.mouse.up(); held = false; } };
  const tap = async () => { await press(); await pause(18); await release(); };
  if (kind === 'deadlift') await tap();
  else await press();
  const deadline = Date.now() + 18_000;
  try {
    while (Date.now() < deadline) {
      const view = await liftView(page);
      if (view.phase === 'RESOLVED') return view;
      if (view.paused) {
        await release();
        await press();
        if (kind === 'deadlift' || view.phase === 'ASCENT' || view.phase === 'HOLE') await release();
      } else if (kind === 'squat') {
        if (view.phase === 'DESCENT' && view.onBeat) await release();
        if ((view.phase === 'HOLE' || view.phase === 'ASCENT') && view.onBeat && !usedBeat) { await tap(); usedBeat = true; }
      } else if (kind === 'bench') {
        if (view.phase === 'HOLE') await release();
        if (/Tap fast/.test(view.label)) await tap();
      } else {
        if (view.phase === 'ASCENT' && view.onBeat && !usedBeat) { await tap(); usedBeat = true; }
        if (view.phase === 'LOCKOUT') {
          if (/Down|release/.test(view.label)) await release();
          else await press();
        }
      }
      if (!view.onBeat) usedBeat = false;
      await pause(7);
    }
    throw new Error(`${kind} never resolved through its visible controls.`);
  } finally { await release(); }
}

async function createPracticeLifter(page) {
  await (await visibleButton(page, 'Create your lifter')).click();
  await page.getByLabel('Platform name', { exact: true }).fill('Mara Vellum');
  await page.getByLabel('Bodyweight (kg)', { exact: true }).fill('63.5');
  await page.getByRole('combobox', { name: /^Competition sex/ }).selectOption('female');
  await (await visibleButton(page, 'Create lifter')).click();
  await page.getByRole('heading', { name: /A total\s+worth chasing/ }).waitFor();
}

/** Reusable by the built-app release runner after it creates a fresh phone page. */
export async function rehearseMeet(page, report, evidence, options = {}) {
  await mkdir(evidence, { recursive: true });
  await createPracticeLifter(page);
  await page.locator('.career-event-open .career-enter').first().click();
  await page.locator('.meet-phase-weigh-in').waitFor();
  const mute = page.getByRole('button', { name: 'Mute meet sounds', exact: true });
  if (await mute.isVisible()) await mute.click();
  assert.equal(await page.getByRole('button', { name: 'Enable meet sounds', exact: true }).getAttribute('aria-pressed'), 'false');
  await shot(page, evidence, '01-phone-weigh-in');
  await page.getByRole('button', { name: 'Declare openers', exact: true }).click();
  for (const kind of ['squat', 'bench', 'deadlift']) {
    const input = page.getByRole('spinbutton', { name: `${kind} opening attempt in kilograms`, exact: true });
    const minimum = await input.getAttribute('min');
    assert.ok(minimum !== null, 'Opener has no legal minimum.');
    await input.fill(minimum);
  }
  await shot(page, evidence, '02-phone-openers');
  await page.getByRole('button', { name: 'Take the platform', exact: true }).click();
  for (let index = 0; index < 9; index += 1) {
    const kind = ['squat', 'bench', 'deadlift'][Math.floor(index / 3)];
    if (index % 3 !== 0) {
      await page.locator('.meet-phase-attempt-select').waitFor({ timeout: 18_000 });
      await page.locator('.meet-option').first().click();
    }
    await page.locator(`.meet-phase-lift .lift-player--${kind}`).waitFor({ timeout: 18_000 });
    await waitUntil(async () => (await liftView(page)).phase !== 'RESOLVED', 'The next live attempt never began.');
    if (index % 3 === 0) await shot(page, evidence, `03-live-${kind}`);
    const outcome = await playVisibleLift(page, kind);
    report.attempts.push({ kind, ordinal: index % 3 + 1, outcome: outcome.outcome, resolvedTick: outcome.tick });
    console.log(`ATTEMPT ${kind} ${index % 3 + 1}: ${outcome.outcome}`);
    assert.notEqual(outcome.outcome, 'miss', `${kind} ${index % 3 + 1} missed during the successful-total rehearsal.`);
    if (index === 0) {
      await page.locator('.meet-phase-verdict').waitFor({ timeout: 8_000 });
      await shot(page, evidence, '04-phone-judges');
    }
  }
  await page.locator('.meet-phase-recap').waitFor({ timeout: 18_000 });
  const confirmation = options.savedAccount ? 'RESULT CONFIRMED ON YOUR CAREER RECORD' : 'PRACTICE RESULT RECORDED';
  await page.getByRole('status').filter({ hasText: confirmation }).waitFor({ timeout: 10_000 });
  assert.notEqual((await page.locator('.meet-total strong').textContent())?.trim(), '—');
  const recapLayout = await page.locator('.meet-finish-intro').evaluate((intro) => {
    const box = (selector) => {
      const node = intro.querySelector(selector);
      if (!node) throw new Error(`Missing recap ${selector}`);
      const r = node.getBoundingClientRect();
      return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
    };
    return { eyebrow: box(':scope > .meet-eyebrow'), title: box('h1'), total: box('.meet-total'), stats: box('.meet-finish-stats'), background: getComputedStyle(intro).backgroundColor };
  });
  assert.ok(recapLayout.eyebrow.bottom + 8 <= recapLayout.title.y, 'Recap title overlaps its completion label');
  assert.ok(recapLayout.title.bottom <= recapLayout.total.y, 'Recap title overlaps the total');
  assert.ok(recapLayout.total.bottom <= recapLayout.stats.y, 'Recap stats overlap the total');
  assert.notEqual(recapLayout.background, 'rgba(0, 0, 0, 0)', 'Hall signage competes with transparent recap text');
  report.checks.push({ name: 'phone recap: completion label, title, total and stats have separate readable bounds', status: 'passed', recapLayout });
  await shot(page, evidence, options.savedAccount ? '05-phone-recorded-recap' : '05-phone-practice-recap');
  await page.getByRole('button', { name: 'View the complete result sheet', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Meet result sheet', exact: true });
  await dialog.waitFor();
  assert.match(await dialog.locator('.meet-paper footer').innerText(), options.savedAccount ? /RECORDED RESULT/ : /PRACTICE RESULT/);
  const player = dialog.locator('.meet-paper-table-wrap tbody tr').filter({ hasText: 'Mara Vellum' });
  const cells = player.locator('th, td');
  assert.equal(await cells.count(), 18);
  assert.equal((await cells.nth(2).textContent())?.trim(), 'Mara Vellum');
  assert.equal((await cells.nth(3).textContent())?.trim(), '63.50');
  const signed = (await cells.allTextContents()).map((value) => value.trim());
  assert.equal(signed.filter((value) => /^-\d/.test(value)).length, 0);
  assert.match(await dialog.locator('.meet-paper-category').innerText(), /ALL WEIGHT CLASSES · RANKED BY TOTAL/);
  assert.match(await dialog.locator('.meet-paper-athlete').innerText(), /Mara Vellum[\s\S]*YOUR CATEGORY.*69 kg/);
  const mobile = dialog.getByRole('region', { name: 'Mara Vellum result', exact: true });
  assert.ok(await mobile.isVisible(), 'The phone result requires a horizontal desktop-table scroll');
  assert.equal(await dialog.locator('.meet-paper-cards > section').count(), await dialog.locator('.meet-paper-table-wrap tbody tr').count(), 'Phone results lost a lifter');
  assert.deepEqual((await mobile.locator('tbody td').allTextContents()).map((v) => v.trim()), signed.slice(4, 16), 'Phone attempts and best lifts disagree with the full result');
  assert.match(await mobile.locator('dl').innerText(), /TOTAL\s*90\s*kg/);
  const assertFits = async () => {
    const clipped = await dialog.locator('.meet-paper-cards th, .meet-paper-cards td, .meet-paper-lifter h3, .meet-paper-lifter dd').evaluateAll((nodes) => nodes.filter((node) => {
      const r = node.getBoundingClientRect();
      return r.left < 0 || r.right > innerWidth || node.scrollWidth > node.clientWidth + 1;
    }).map((node) => node.textContent));
    assert.deepEqual(clipped, [], 'Phone result cells are clipped');
  };
  await assertFits();
  await shot(page, evidence, '06-phone-result-sheet');
  const viewport = page.viewportSize();
  await page.setViewportSize({ width: 320, height: 740 });
  await assertFits();
  await shot(page, evidence, '06-small-phone-result-sheet');
  await page.setViewportSize({ width: 1440, height: 960 });
  assert.ok(await dialog.locator('.meet-paper-table-wrap').isVisible(), 'Desktop formal sheet is missing');
  assert.equal(await mobile.isVisible(), false, 'Phone cards duplicate the desktop sheet');
  await shot(page, evidence, '06-desktop-result-sheet');
  await page.setViewportSize(viewport);
  report.checks.push({ name: 'result sheet: all nine attempts fit 390px and 320px phones; flight scope, athlete category and formal desktop table are explicit', status: 'passed' });
  const downloadWait = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download PNG', exact: true }).click();
  const download = await downloadWait;
  assert.equal(download.suggestedFilename(), options.savedAccount ? 'mara-vellum-recorded-result.png' : 'mara-vellum-practice-result.png');
  const pngPath = path.join(evidence, options.savedAccount ? 'mara-vellum-recorded-result.png' : 'mara-vellum-practice-result.png');
  await download.saveAs(pngPath);
  const png = await readFile(pngPath);
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), 1600);
  assert.equal(png.readUInt32BE(20), 1060);
  report.checks.push({ name: `${options.savedAccount ? 'confirmed saved' : 'confirmed practice'} meet: nine native attempts, successful total, correct result columns and PNG download`, status: 'passed', cells: signed });
  await dialog.getByRole('button', { name: 'Back to recap ×', exact: true }).click();
  await (await visibleButton(page, 'Back to career')).click();
  await page.getByRole('button', { name: 'Back to training', exact: true }).click();
  await startBenchTraining(page, report, evidence);
}

async function startBenchTraining(page, report, evidence) {
  await (await visibleButton(page, 'Train')).click();
  await page.getByTestId('check-in-lift-bench').click();
  for (const answer of ['check-in-sleep-good', 'check-in-soreness-fresh', 'check-in-motivation-fired-up']) await page.getByTestId(answer).click();
  const rpe = page.getByTestId('session-rpe-6');
  await waitUntil(() => rpe.isEnabled(), 'RPE never became available.');
  await rpe.click();
  assert.equal(await rpe.getAttribute('aria-pressed'), 'true');
  assert.equal(await page.getByTestId('training-screen').getAttribute('data-phase'), 'briefing');
  const start = page.getByTestId('session-start');
  assert.match(await start.textContent(), /Start bench/);
  await shot(page, evidence, '07-phone-training-prescription');
  await start.click();
  const control = page.locator('.lift-control');
  await control.focus();
  await page.keyboard.down('Space');
  await waitUntil(async () => (await liftView(page)).held, 'Keyboard grip never reached the native lift.');
  await page.keyboard.press('Tab');
  await page.keyboard.up('Space');
  await page.locator('.lift-player--paused').waitFor();
  const paused = await liftView(page);
  assert.equal(paused.held, false);
  await pause(200);
  assert.equal((await liftView(page)).tick, paused.tick);
  await shot(page, evidence, '08-phone-paused-bench');
  report.checks.push({ name: 'RPE selects before explicit Start; keyboard focus loss releases grip and freezes ticks', status: 'passed' });
}

async function finishBenchTraining(page, report, evidence, options = {}) {
  report.trainingReps = [];
  const expectedSets = Number((await page.locator('.training-set-number').textContent())?.match(/\/\s*(\d+)/)?.[1]);
  const expectedReps = await page.locator('.training-rep-pip').count();
  assert.ok(expectedSets > 0 && expectedReps > 0, 'The prescribed session is missing set or rep counts.');
  while (true) {
    await waitUntil(async () => {
      const phase = await page.getByTestId('training-screen').getAttribute('data-phase');
      if (phase === 'close-out' || phase === 'rest') return true;
      return phase === 'set' && (await liftView(page)).phase !== 'RESOLVED';
    }, 'Training did not advance after a resolved rep.');
    const phase = await page.getByTestId('training-screen').getAttribute('data-phase');
    if (phase === 'close-out') break;
    if (phase === 'rest') {
      await page.getByRole('button', { name: 'Next set', exact: true }).click();
      continue;
    }
    const hud = (await page.locator('.training-set-hud').innerText()).trim();
    const outcome = await playVisibleLift(page, 'bench');
    report.trainingReps.push({ hud, outcome: outcome.outcome, resolvedTick: outcome.tick });
    console.log(`TRAINING REP ${report.trainingReps.length}: ${outcome.outcome}`);
    assert.notEqual(outcome.outcome, 'miss', 'A rep missed during the successful training rehearsal.');
    assert.ok(report.trainingReps.length <= expectedSets * expectedReps, 'Training produced more reps than the prescription.');
  }
  assert.equal(report.trainingReps.length, expectedSets * expectedReps);
  await page.locator('.training-save-confirmed').waitFor({ timeout: 10_000 });
  await shot(page, evidence, options.savedAccount ? '09-phone-saved-training' : '09-phone-practice-training');
  report.checks.push({ name: `complete native bench prescription, manual set rests, and confirmed ${options.savedAccount ? 'saved-account' : 'practice'} close-out`, status: 'passed', sets: expectedSets, repsPerSet: expectedReps });
}

export async function rehearseTraining(page, report, evidence, options = {}) {
  await createPracticeLifter(page);
  await page.getByRole('button', { name: 'Back to training', exact: true }).click();
  await startBenchTraining(page, report, evidence);
  await finishBenchTraining(page, report, evidence, options);

}

async function main() {
  const evidence = path.join(root, process.env.TRAINING_ONLY === '1' ? '.gauntlet/evidence/production/training-browser' : '.gauntlet/evidence/production/meet-browser');
  const report = { startedAt: new Date().toISOString(), checks: [], attempts: [], errors: [], assetFailures: [], limitations: ['A disposable practice lifter is played through visible browser controls.', 'This check does not establish live-account persistence, physical-device touch feel or native haptics.'] };
  let browser;
  let page;
  let vite;
  let viteLog = '';
  try {
    await mkdir(evidence, { recursive: true });
    const base = process.env.BROWSER_BASE_URL ?? 'http://127.0.0.1:5178';
    if (!process.env.BROWSER_BASE_URL) {
      vite = spawn(process.execPath, [path.join(web, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5178', '--strictPort'], { cwd: web, stdio: ['ignore', 'pipe', 'pipe'] });
      for (const stream of [vite.stdout, vite.stderr]) stream.on('data', (chunk) => { viteLog += chunk.toString(); });
      await waitUntil(async () => {
        if (vite.exitCode !== null) throw new Error(viteLog);
        try { return (await fetch(base)).ok; } catch { return false; }
      }, 'Vite did not become reachable.');
    }
    const { chromium } = createRequire(path.join(web, 'package.json'))('playwright');
    browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, acceptDownloads: true });
    page = await context.newPage();
    page.on('pageerror', (error) => report.errors.push(error.message));
    page.on('response', (response) => { if (response.status() >= 400 && /\.(?:png|jpe?g|css|js)(?:\?|$)/.test(response.url())) report.assetFailures.push({ path: new URL(response.url()).pathname, status: response.status() }); });
    await page.goto(base, { waitUntil: 'networkidle' });
    if (process.env.TRAINING_ONLY === '1') await rehearseTraining(page, report, evidence);
    else await rehearseMeet(page, report, evidence);
    assert.deepEqual(report.errors, []);
    if (process.env.MEET_ALLOW_MISSING_ART === '1') {
      assert.equal(report.assetFailures.every((failure) => /^(?:\/athlete\/(?:squat|bench|deadlift)-atlas|\/empire-art\/production-(?:bar|bench|plates))\.png$/.test(failure.path)), true);
      report.limitations.push('Original final art files could not be restored in this run. Functional checks used the explicit art-unavailable message; visual and full asset validation remain incomplete.');
      report.status = 'functional-passed-art-incomplete';
    } else {
      assert.deepEqual(report.assetFailures, []);
      report.status = 'passed';
    }
  } catch (error) {
    report.status = 'failed';
    report.failure = error.stack;
    if (page && !page.isClosed()) {
      try { await shot(page, evidence, 'failure-phone'); await writeFile(path.join(evidence, 'failure-body.txt'), await page.locator('body').innerText()); } catch { /* A crashed page cannot capture. */ }
    }
    process.exitCode = 1;
  } finally {
    report.finishedAt = new Date().toISOString();
    report.viteLog = viteLog;
    await writeFile(path.join(evidence, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    if (browser) await browser.close();
    if (vite) vite.kill('SIGTERM');
    console.log(JSON.stringify({ status: report.status, attempts: report.attempts.length, evidence, failure: report.failure ?? null }));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
