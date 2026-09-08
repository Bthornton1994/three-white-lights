#!/usr/bin/env node
/**
 * verify-owner-route.mjs — VL-3: drives the OWNER PLAYTEST ROUTE
 * (`owner-playtest.html` served by `npx vite --config vite.owner.config.ts`)
 * headless, the way the owner will reach it, and photographs it.
 *
 * Claude Code Session B's instrument (CLAUDE.md "VL-3": "the owner route is a
 * standalone web entry, not a shell edit"). It does not claim Visual,
 * Animation, Soft-Feel or Owner-Playtest PASS — only Bryant closes those. It
 * checks that the route a human is about to be handed opens into the real
 * Play surface with the scenario funded, and that the Capacity purchase the
 * scenario exists for can be made from it, so the owner is not handed a page
 * that fails before it starts.
 *
 * THIS IS NOT THE PLAYED PATH, AND SAYS SO. The route is opened by URL with
 * `?scenario=capacity` — that is the route's whole purpose, and the entry file
 * is the one place the query string is read. The in-app played path (the
 * shell's own GYM EMPIRE pill, no query string) stays
 * `tools/capture-capacity-proof.mjs`'s subject; this tool does not stand in
 * for it. The address bar is asserted to carry exactly the scenario query
 * so a run against the wrong page cannot pass by accident.
 *
 * WHAT IT DOES, at 390x844 (and 375x812 with `--both`):
 *
 *   1. Load `<url>/owner-playtest.html?scenario=capacity`; wait for
 *      `gymscreen-root` and at least one `[data-memberid]`.
 *   2. Read the HUD's Gym Bucks; assert it is at or above the Capacity
 *      price (`STATION_UPGRADE_COST_GYM_BUCKS.capacity`, read from source).
 *   3. Assert NO shell chrome (`shell-open-gym`), NO diagnostics readout, NO
 *      dev-controls block is drawn on the Play surface (present in the DOM
 *      under the More drawer is fine — that drawer is the product's own —
 *      but nothing of it may be VISIBLE on Play: effective opacity, box
 *      inside the viewport).
 *   4. Photograph BEFORE. Wait until one member is `using` and one `queuing`
 *      (the queue the scenario is about), photograph QUEUE.
 *   5. Press the bench (the same synthetic click on the bench art the
 *      capacity proof uses, because members ride over it with their own
 *      Pressable); assert the station panel opens and the Capacity row is
 *      purchasable and reachable by the browser's own hit-test; press it.
 *   6. Assert `floorgrid-bay-expansion` appears and is DRAWN (box, opacity,
 *      picture), dismiss the panel, photograph AFTER; then keep watching
 *      until two members are `using` at once or the budget ends, and
 *      photograph RELIEF.
 *   7. Write `owner-route-<viewport>-<stage>.png`, `owner-route-notes.json`
 *      and `owner-route-notes.txt` to the out dir, stamped with the commit
 *      and whether the tree was dirty.
 *
 * Usage: node tools/verify-owner-route.mjs [--url http://localhost:5173]
 *          [--out docs/design/living-gym-world/vl-3] [--both]
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

import { numberInBlock, parserSelfTest } from './readTuning.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function arg(name, fallback) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 && process.argv[idx + 1] !== undefined ? process.argv[idx + 1] : fallback;
}
const URL = arg('--url', 'http://localhost:5173');
const OUT = arg('--out', join(ROOT, 'docs', 'design', 'living-gym-world', 'vl-3'));
const SCENARIO = 'capacity';
const ROUTE = `/owner-playtest.html?scenario=${SCENARIO}`;
const QUEUE_BUDGET_MS = 60000;
const RELIEF_BUDGET_MS = 30000;
const VIEWPORTS = process.argv.includes('--both')
  ? [
      { name: '390x844', width: 390, height: 844 },
      { name: '375x812', width: 375, height: 812 },
    ]
  : [{ name: '390x844', width: 390, height: 844 }];
const PW_CHROMIUM = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;

const selfTest = parserSelfTest();
if (!Array.isArray(selfTest) || selfTest.length > 0) {
  console.error('readTuning.mjs parser self-test failed:', selfTest);
  process.exit(2);
}
const tuningSource = readFileSync(join(ROOT, 'src', 'empire', 'empireTuning.ts'), 'utf8');
const CAPACITY_PRICE = numberInBlock(tuningSource, 'STATION_UPGRADE_COST_GYM_BUCKS', 'capacity');
if (CAPACITY_PRICE === null) {
  console.error('STATION_UPGRADE_COST_GYM_BUCKS.capacity not found in empireTuning.ts');
  process.exit(2);
}
const SHA = execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim();
const DIRTY = execSync('git status --porcelain --untracked-files=no', { cwd: ROOT }).toString().trim() !== '';
mkdirSync(OUT, { recursive: true });

const notes = [];
const note = (line) => {
  notes.push(line);
  console.log(line);
};

/** Effective opacity up the parent chain and the box, for "drawn, not merely mounted". */
const VISIBILITY_READER = `
  (id) => {
    const node = document.querySelector('[data-testid="' + id + '"]');
    if (node === null) return { present: false };
    let opacity = 1;
    let at = node;
    while (at !== null && at !== document.body) {
      const s = getComputedStyle(at);
      opacity *= Number(s.opacity);
      if (s.display === 'none' || s.visibility === 'hidden') opacity = 0;
      at = at.parentElement;
    }
    const b = node.getBoundingClientRect();
    const inside = b.width > 0 && b.height > 0 && b.x + b.width > 0 && b.y + b.height > 0 && b.x < innerWidth && b.y < innerHeight;
    return { present: true, opacity, box: { x: b.x, y: b.y, w: b.width, h: b.height }, insideViewport: inside, drawn: opacity > 0 && inside };
  }
`;

async function visibility(page, testId) {
  return page.evaluate(`(${VISIBILITY_READER})(${JSON.stringify(testId)})`);
}

async function members(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('[data-memberid]')].map((n) => ({
      id: n.getAttribute('data-memberid'),
      lifecycle: n.getAttribute('data-lifecycle'),
      cell: n.getAttribute('data-cell'),
      tick: n.getAttribute('data-tick'),
      clip: n.getAttribute('data-clip'),
    })),
  );
}

async function bucks(page) {
  const text = await page.evaluate(() => document.querySelector('[data-testid="gymscreen-gym-bucks"]')?.textContent ?? null);
  const m = text === null ? null : /gym bucks: ([\d.]+)/.exec(text);
  return { text, value: m === null ? null : Number(m[1]) };
}

async function syntheticClick(page, testId) {
  return page.evaluate((id) => {
    const node = document.querySelector(`[data-testid="${id}"]`);
    if (node === null) return false;
    node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, altKey: false, view: window }));
    return true;
  }, testId);
}

async function rowRead(page, testId) {
  return page.evaluate((id) => {
    const node = document.querySelector(`[data-testid="${id}"]`);
    if (node === null) return null;
    const b = node.getBoundingClientRect();
    const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
    return {
      box: { x: b.x, y: b.y, w: b.width, h: b.height },
      insideViewport: b.width > 0 && b.height > 0 && b.x >= 0 && b.y >= 0 && b.x + b.width <= innerWidth && b.y + b.height <= innerHeight,
      hitTestInsideRow: hit !== null && (hit === node || node.contains(hit)),
      hitTestId: hit === null ? null : (hit.closest('[data-testid]')?.getAttribute('data-testid') ?? hit.tagName),
      text: node.textContent,
    };
  }, testId);
}

async function expansionDrawn(page) {
  const bay = await visibility(page, 'floorgrid-bay-expansion');
  const sprite = await visibility(page, 'floorgrid-bay-expansion-sprite');
  const picture = await page.evaluate(() => {
    const sprite = document.querySelector('[data-testid="floorgrid-bay-expansion-sprite"]');
    if (sprite === null) return null;
    const img = sprite.querySelector('img');
    if (img !== null && img.getAttribute('src')) return img.getAttribute('src');
    for (const el of [sprite, ...sprite.querySelectorAll('*')]) {
      const bg = getComputedStyle(el).backgroundImage;
      if (bg && bg !== 'none') return bg;
    }
    return null;
  });
  return { bay, sprite, picture, drawn: bay.drawn === true && sprite.drawn === true && picture !== null };
}

async function pollUntil(page, predicate, budgetMs, everyMs = 100) {
  const start = Date.now();
  let last = null;
  while (Date.now() - start < budgetMs) {
    last = await members(page);
    if (predicate(last)) return { hit: true, members: last, afterMs: Date.now() - start };
    await page.waitForTimeout(everyMs);
  }
  return { hit: false, members: last, afterMs: Date.now() - start };
}

async function runViewport(browser, viewport) {
  const vp = viewport.name;
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  const result = { viewport: vp, verdicts: {}, frames: [], pageErrors };
  const shot = async (label) => {
    const file = `owner-route-${vp}-${label}.png`;
    await page.screenshot({ path: join(OUT, file), fullPage: false });
    result.frames.push(file);
    return file;
  };

  // ---- 1. the route --------------------------------------------------------
  await page.goto(`${URL}${ROUTE}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.getByTestId('gymscreen-root').waitFor({ state: 'attached', timeout: 60000 });
  await page.waitForFunction(() => document.querySelectorAll('[data-memberid]').length > 0, undefined, { timeout: 60000 });
  result.address = page.url();
  result.verdicts.routeIsScenario = result.address.endsWith(ROUTE);
  note(`${vp} opened ${result.address} (${result.verdicts.routeIsScenario ? 'the scenario route' : 'NOT the scenario route'})`);

  // ---- 2. funded through the real reducer ----------------------------------
  const funds = await bucks(page);
  result.funds = funds;
  result.verdicts.funded = funds.value !== null && funds.value >= CAPACITY_PRICE;
  note(`${vp} HUD "${funds.text}" — Capacity price ${CAPACITY_PRICE}: ${result.verdicts.funded ? 'funded' : 'NOT funded'}`);

  // ---- 3. the Play surface, and nothing over it ----------------------------
  const initial = await members(page);
  const floor = await visibility(page, 'floorgrid-grid');
  const fab = await visibility(page, 'gymscreen-build-fab');
  const dock = await visibility(page, 'gymscreen-dock');
  const shellPill = await visibility(page, 'shell-open-gym');
  const diagnostics = await visibility(page, 'gymscreen-diagnostics');
  const devControls = await visibility(page, 'gymscreen-dev-controls');
  const diagnosticsToggle = await visibility(page, 'floorgrid-diagnostics-toggle');
  result.surface = { members: initial, floor, fab, dock, shellPill, diagnostics, devControls, diagnosticsToggle };
  result.verdicts.floorAndMembersDrawn = floor.drawn === true && initial.length > 0;
  result.verdicts.playSurface = fab.drawn === true && dock.drawn === true;
  result.verdicts.noShellChrome = shellPill.present === false;
  // The More drawer holds the diagnostics block and the dev controls in the
  // DOM; on Play neither may be drawn. The hidden diagnostics toggle is the
  // product's own (opacity 0 by design) and is reported, not judged.
  result.verdicts.noDiagnosticsOnPlay = diagnostics.drawn !== true && devControls.drawn !== true;
  note(
    `${vp} floor ${floor.drawn ? 'drawn' : 'NOT drawn'} with ${initial.length} member(s) ${JSON.stringify(initial.map((m) => `${m.id}=${m.lifecycle}@${m.cell}`))}; BUILD fab ${fab.drawn ? 'drawn' : 'absent'}, dock ${dock.drawn ? 'drawn' : 'absent'}; shell pill ${shellPill.present ? 'PRESENT' : 'absent'}; diagnostics readout ${diagnostics.present ? (diagnostics.drawn ? 'DRAWN ON PLAY' : 'in the More drawer, not drawn') : 'absent'}; dev controls ${devControls.present ? (devControls.drawn ? 'DRAWN ON PLAY' : 'in the More drawer, not drawn') : 'absent'}; diagnostics toggle opacity ${diagnosticsToggle.present ? diagnosticsToggle.opacity : 'absent'}`,
  );
  await shot('before');

  // ---- 4. the queue the scenario is about -----------------------------------
  const queue = await pollUntil(
    page,
    (ms) => ms.some((m) => m.lifecycle === 'using') && ms.some((m) => m.lifecycle === 'queuing'),
    QUEUE_BUDGET_MS,
  );
  result.queue = queue;
  result.verdicts.queueForms = queue.hit;
  note(`${vp} queue: ${queue.hit ? `one using and one queuing after ${queue.afterMs} ms` : `NOT observed within ${QUEUE_BUDGET_MS} ms`} — ${JSON.stringify(queue.members?.map((m) => `${m.id}=${m.lifecycle}@${m.cell} tick${m.tick}`))}`);
  await shot('queue');

  // ---- 5. the bench, the panel, the Capacity row ---------------------------
  const benchPressed = await syntheticClick(page, 'floorgrid-fixed-flat-bench');
  const panelOpen = benchPressed && (await page.getByTestId('floorgrid-station-panel').waitFor({ state: 'attached', timeout: 10000 }).then(() => true).catch(() => false));
  result.verdicts.benchOpensPanel = panelOpen;
  note(`${vp} bench pressed: ${benchPressed}; station panel ${panelOpen ? 'opened' : 'did NOT open'}`);
  let capacityRow = null;
  if (panelOpen) {
    capacityRow = await rowRead(page, 'floorgrid-station-panel-upgrade-capacity');
    const unavailable = await page.evaluate(() => document.querySelector('[data-testid="floorgrid-station-panel-upgrade-capacity-unavailable"]')?.textContent ?? null);
    result.capacityRow = capacityRow;
    result.capacityUnavailable = unavailable;
    result.verdicts.capacityOffered = capacityRow !== null && unavailable === null;
    result.verdicts.capacityReachable = capacityRow !== null && capacityRow.insideViewport && capacityRow.hitTestInsideRow;
    note(`${vp} Capacity row ${capacityRow === null ? `absent${unavailable === null ? '' : ` (unavailable: "${unavailable}")`}` : `"${capacityRow.text}" box ${JSON.stringify(capacityRow.box)}, inside viewport ${capacityRow.insideViewport}, hit-test resolves to ${capacityRow.hitTestId}`}`);
    await shot('panel');
  } else {
    result.verdicts.capacityOffered = false;
    result.verdicts.capacityReachable = false;
  }

  // ---- 6. the purchase, the second bench, the relief ----------------------
  let purchased = false;
  if (result.verdicts.capacityOffered) {
    const before = await bucks(page);
    await syntheticClick(page, 'floorgrid-station-panel-upgrade-capacity');
    await page.getByTestId('floorgrid-station-panel-upgrade-capacity-done').waitFor({ state: 'attached', timeout: 10000 }).catch(() => {});
    const after = await bucks(page);
    purchased = before.value !== null && after.value !== null && before.value - after.value >= CAPACITY_PRICE - 1;
    result.purchase = { before: before.value, after: after.value, price: CAPACITY_PRICE };
    note(`${vp} pressed Capacity: gym bucks ${before.value} -> ${after.value} (price ${CAPACITY_PRICE})`);
    await syntheticClick(page, 'floorgrid-station-panel-dismiss');
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="floorgrid-station-panel"]').length === 0, undefined, { timeout: 5000 }).catch(() => {});
  }
  result.verdicts.priceCharged = purchased;
  let expansion = await expansionDrawn(page);
  const expansionStart = Date.now();
  while (!expansion.drawn && Date.now() - expansionStart < 10000) {
    await page.waitForTimeout(100);
    expansion = await expansionDrawn(page);
  }
  result.expansion = expansion;
  result.verdicts.secondBenchDrawn = expansion.drawn;
  note(`${vp} expansion bench ${expansion.drawn ? `drawn: bay ${JSON.stringify(expansion.bay.box)} opacity ${expansion.bay.opacity}, sprite opacity ${expansion.sprite.opacity}, picture ${expansion.picture === null ? 'none' : String(expansion.picture).split('/').pop()}` : `NOT drawn (bay ${JSON.stringify(expansion.bay)}, sprite ${JSON.stringify(expansion.sprite)})`}`);
  await shot('after');
  const relief = await pollUntil(page, (ms) => ms.filter((m) => m.lifecycle === 'using').length >= 2, RELIEF_BUDGET_MS);
  result.relief = relief;
  result.verdicts.queueRelieved = relief.hit;
  note(`${vp} relief: ${relief.hit ? `two using after ${relief.afterMs} ms` : `NOT observed within ${RELIEF_BUDGET_MS} ms`} — ${JSON.stringify(relief.members?.map((m) => `${m.id}=${m.lifecycle}@${m.cell} tick${m.tick}`))}`);
  await shot('relief');
  // Still moving afterwards: some member's cell or drawn box changes over a second.
  const a = await members(page);
  const aBox = await page.evaluate(() => [...document.querySelectorAll('[data-memberid]')].map((n) => { const b = n.getBoundingClientRect(); return [n.getAttribute('data-memberid'), Math.round(b.x), Math.round(b.y)]; }));
  await page.waitForTimeout(1000);
  const b = await members(page);
  const bBox = await page.evaluate(() => [...document.querySelectorAll('[data-memberid]')].map((n) => { const b = n.getBoundingClientRect(); return [n.getAttribute('data-memberid'), Math.round(b.x), Math.round(b.y)]; }));
  const ticksAdvanced = a.length > 0 && b.length > 0 && Number(b[0].tick) > Number(a[0].tick);
  const somebodyMoved = JSON.stringify(aBox) !== JSON.stringify(bBox);
  result.verdicts.stillMoving = ticksAdvanced && somebodyMoved;
  note(`${vp} one second later: ticks ${a[0]?.tick} -> ${b[0]?.tick}, drawn boxes ${somebodyMoved ? 'moved' : 'did NOT move'}`);
  result.verdicts.noPageErrors = pageErrors.length === 0;
  if (pageErrors.length > 0) note(`${vp} PAGE ERRORS: ${pageErrors.join(' | ')}`);
  await page.close();
  await context.close();
  return result;
}

const VERDICT_ORDER = [
  'routeIsScenario',
  'funded',
  'floorAndMembersDrawn',
  'playSurface',
  'noShellChrome',
  'noDiagnosticsOnPlay',
  'queueForms',
  'benchOpensPanel',
  'capacityOffered',
  'capacityReachable',
  'priceCharged',
  'secondBenchDrawn',
  'queueRelieved',
  'stillMoving',
  'noPageErrors',
];

const browser = await chromium.launch({
  headless: true,
  ...(PW_CHROMIUM === undefined ? {} : { executablePath: PW_CHROMIUM }),
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
let exitCode = 0;
try {
  note(`VL-3 owner route check at ${SHA}${DIRTY ? ' (DIRTY TREE)' : ''} url=${URL}${ROUTE} — opened BY URL with the scenario query on purpose; this is the owner's route, not the played in-app path`);
  const results = [];
  for (const viewport of VIEWPORTS) {
    const result = await runViewport(browser, viewport);
    results.push(result);
    for (const k of VERDICT_ORDER) {
      const v = result.verdicts[k];
      note(`${viewport.name} ${v === true ? 'ok  ' : 'FAIL'} ${k}`);
      if (v !== true) exitCode = 1;
    }
  }
  const summary = { sha: SHA, dirty: DIRTY, url: `${URL}${ROUTE}`, generatedAt: new Date().toISOString(), capacityPrice: CAPACITY_PRICE, results, notes };
  writeFileSync(join(OUT, 'owner-route-notes.json'), JSON.stringify(summary, null, 2));
  writeFileSync(join(OUT, 'owner-route-notes.txt'), notes.join('\n') + '\n');
  note(`wrote ${OUT}`);
} finally {
  await browser.close();
}
process.exit(exitCode);
