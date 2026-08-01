#!/usr/bin/env node
/**
 * Deterministic lift-sequence capture.
 *
 * WHY THIS EXISTS AND `shoot.mjs` DOES NOT SUFFICE. GDD §12.2 asks a critic to
 * judge "whether a maximal attempt animates *heavier* than a light one". That
 * needs photographs of both, at the same beats, from the real renderer.
 *
 * They cannot be taken by driving pointer events at a wall clock. A limit
 * attempt is won inside a band of about eight ticks (`lift.test.ts` measures
 * it), and a headless browser on a loaded machine cannot land a press there.
 * Every previous attempt produced a rep that died in the descent, and the
 * "maximal sequence" it wrote was three copies of one resolved NO LIFT frame.
 *
 * So the rep is driven through the app's debug replay route
 * (`?replay=<loadRatio>&moment=<id>`, see `src/lift/liftReplay.ts`), which
 * freezes the REAL `LiftScreen` on one beat of a scripted rep. No mock, no
 * second renderer: the same component, the same Skia canvas, the same sprite
 * pipeline the player sees.
 *
 * Each shot is written twice — the full phone viewport (the evidence a critic
 * opens) and the stage element on its own (hashed by the verifier, so a
 * difference in a dev-menu glyph cannot masquerade as a difference in the rep).
 * A probe element, zero-sized and transparent, carries what the frame ACTUALLY
 * shows so distinctness can be checked semantically instead of by hash.
 *
 * Usage:
 *   node tools/capture-lift.mjs [--url URL] [--out DIR] [--loads 1.0,0.55]
 */
import { chromium } from 'playwright';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? dflt : args[i + 1];
};

const url = flag('url', 'http://localhost:8081');
const outRoot = path.resolve(flag('out', '.gauntlet/shots'));
const loads = flag('loads', '1.0,0.55')
  .split(',')
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isFinite(n));
const width = Number(flag('w', '390'));
const height = Number(flag('h', '844'));
const dpr = Number(flag('dpr', '2'));
const settleMs = Number(flag('settle', '900'));

/**
 * The beats, in order. Deliberately restated here rather than imported from the
 * TypeScript module: this tool is a second, independent statement of what the
 * sequence must contain, and a capture that silently agreed with a broken
 * module would be worth nothing.
 */
const MOMENTS = [
  'brace',
  'descent',
  'depth-cue',
  'hole',
  'drive-cue',
  'losing',
  'sticking-point',
  'lockout',
  'result',
];

const LABELS = { 1: 'maximal', 0.88: 'default', 0.75: 'moderate', 0.55: 'light' };
const labelFor = (load) => LABELS[load] ?? `load-${String(load).replace('.', '_')}`;

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--use-gl=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
});
const page = await browser.newPage({
  viewport: { width, height },
  deviceScaleFactor: dpr,
});

const problems = [];
page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}`));

const sequences = [];

for (const load of loads) {
  const label = labelFor(load);
  const dir = path.join(outRoot, `L1-${label}`);
  await rm(dir, { recursive: true, force: true });
  await mkdir(path.join(dir, 'stage'), { recursive: true });

  const shots = [];
  for (let i = 0; i < MOMENTS.length; i += 1) {
    const moment = MOMENTS[i];
    const target = `${url}/?replay=${load}&moment=${moment}`;
    await page.goto(target, { waitUntil: 'networkidle', timeout: 90000 });

    // The probe only exists when the replay route parsed. If it never appears,
    // the app booted normally and the shot would be of a LIVE rep at tick zero
    // wearing the label of a beat it is not at. Fail loudly instead.
    let probeText = null;
    try {
      // `attached`, not `visible`: the probe is deliberately zero-sized and
      // transparent so it cannot change a captured pixel.
      await page.waitForSelector('[data-testid="lift-replay-probe-json"]', {
        state: 'attached',
        timeout: 30000,
      });
      probeText = await page.textContent('[data-testid="lift-replay-probe-json"]');
    } catch {
      problems.push(`${label}/${moment}: replay probe never rendered`);
    }
    // Let Skia finish its first paint of the frozen frame.
    await page.waitForTimeout(settleMs);

    const name = `${String(i).padStart(2, '0')}-${moment}.png`;
    const full = path.join(dir, name);
    await page.screenshot({ path: full, fullPage: false });

    // The stage on its own. Excludes every piece of browser or dev chrome, so a
    // hash of it is a statement about the rep and nothing else.
    const stagePath = path.join(dir, 'stage', name);
    const stage = page.locator('[data-testid="lift-touch"]');
    try {
      await stage.screenshot({ path: stagePath });
    } catch (e) {
      problems.push(`${label}/${moment}: stage screenshot failed: ${e.message}`);
    }

    let probe = null;
    try {
      probe = probeText === null ? null : JSON.parse(probeText);
    } catch {
      problems.push(`${label}/${moment}: probe was not JSON: ${probeText}`);
    }

    shots.push({
      moment,
      file: name,
      full: path.relative(outRoot, full),
      stage: path.relative(outRoot, stagePath),
      probe,
    });
    process.stdout.write(
      `  ${label}/${moment.padEnd(15)} ${probe ? `${probe.phase} t=${probe.tick} h=${probe.height} net=${probe.netForce} strain=${probe.strainLevel}` : 'NO PROBE'}\n`,
    );
  }

  const manifest = {
    label,
    loadRatio: load,
    capturedAt: new Date().toISOString(),
    url,
    viewport: { width, height, deviceScaleFactor: dpr },
    shots,
  };
  await writeFile(path.join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  sequences.push({ label, dir, count: shots.length });
}

await browser.close();

console.log(JSON.stringify({ outRoot, sequences, problems }, null, 2));
process.exit(problems.length === 0 ? 0 : 1);
