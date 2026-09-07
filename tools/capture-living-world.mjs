#!/usr/bin/env node
/**
 * Capture living-world vertical-slice evidence.
 * Play only: member motion, station occupancy, queue cells.
 * Does not claim Visual PASS.
 *
 * Usage: node tools/capture-living-world.mjs --url http://127.0.0.1:8080
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const url = (() => {
  const idx = process.argv.indexOf('--url');
  return idx >= 0 ? process.argv[idx + 1] : 'http://127.0.0.1:8080';
})();

const OUT = '/workspace/screenshots/living-gym-world';
mkdirSync(OUT, { recursive: true });

const PW_CHROMIUM = existsSync('/opt/pw-browsers/chromium')
  ? '/opt/pw-browsers/chromium'
  : undefined;

const notes = [];
const note = (line) => {
  notes.push(line);
  console.log(line);
};

async function reachGym(page) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.getByTestId('session-check-in').waitFor({ state: 'visible', timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(320 + 220 + 1200);
  const gym = page.getByTestId('shell-open-gym');
  await gym.waitFor({ state: 'visible', timeout: 30000 });
  await gym.click({ timeout: 15000 });
  await page.getByTestId('gymscreen-root').waitFor({ state: 'attached', timeout: 30000 });
  await page.waitForTimeout(200);
}

async function worldSnapshot(page) {
  return page.evaluate(() => {
    const boxOf = (node) => {
      if (!node) return null;
      const box = node.getBoundingClientRect();
      return { x: box.x, y: box.y, w: box.width, h: box.height };
    };
    const opacityOf = (node) => {
      if (!node) return null;
      return Number(getComputedStyle(node).opacity);
    };
    const members = [...document.querySelectorAll('[data-testid^="floorgrid-ambient-"]')]
      .filter((node) => /^floorgrid-ambient-\d+$/.test(node.getAttribute('data-testid') || ''))
      .map((node) => {
      const id = node.getAttribute('data-testid') || '';
      const sprite = node.querySelector('[data-testid^="floorgrid-member-sprite-"]') || node;
      return {
        id,
        box: boxOf(node),
        spriteOpacity: opacityOf(sprite),
      };
    });
    const using = [...document.querySelectorAll('[data-testid^="floorsim-using-"]')].map((node) => ({
      id: node.getAttribute('data-testid'),
      opacity: opacityOf(node),
      box: boxOf(node),
    }));
    const claimed = [...document.querySelectorAll('[data-testid^="floorsim-claimed-"]')].map((node) => ({
      id: node.getAttribute('data-testid'),
      opacity: opacityOf(node),
      box: boxOf(node),
    }));
    const queues = [...document.querySelectorAll('[data-testid^="floorsim-queue-cell-"]')].map((node) => ({
      id: node.getAttribute('data-testid'),
      opacity: opacityOf(node),
      box: boxOf(node),
    }));
    const texture = document.querySelector('[data-testid="gymscreen-facility-art"]');
    const textureImg = texture && (texture.tagName === 'IMG' ? texture : texture.querySelector('img'));
    const occupancy = document.querySelector('[data-testid="floorgrid-occupancy"]');
    const overflowX = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
    return {
      members,
      using,
      claimed,
      queues,
      occupancyText: occupancy ? occupancy.innerText : null,
      textureSrc: textureImg ? textureImg.getAttribute('src') : null,
      overflowX,
      viewport: { w: window.innerWidth, h: window.innerHeight },
    };
  });
}

function maxJump(samples) {
  let max = 0;
  for (let i = 1; i < samples.length; i += 1) {
    const prev = samples[i - 1];
    const next = samples[i];
    if (!prev || !next || !prev.box || !next.box) continue;
    const d = Math.hypot(next.box.x - prev.box.x, next.box.y - prev.box.y);
    if (d > max) max = d;
  }
  return max;
}

async function captureViewport(browser, width, height) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await reachGym(page);
  const samples = [];
  let usingSeen = false;
  let queueSeen = false;
  let walkShot = false;
  const deadline = Date.now() + 18000;
  while (Date.now() < deadline) {
    const snap = await worldSnapshot(page);
    const first = snap.members[0] || null;
    samples.push(first);
    const usingVisible = snap.using.some((row) => row.opacity > 0);
    if (usingVisible) usingSeen = true;
    if (snap.queues.length > 0) queueSeen = true;
    if (!walkShot) {
      await page.screenshot({ path: `${OUT}/${width}x${height}-play-walk.png`, fullPage: false });
      walkShot = true;
      note(`${width}x${height} walk shot. occupancy=${JSON.stringify(snap.occupancyText)} using=${snap.using.length}`);
    }
    if (usingVisible && samples.length >= 8) {
      await page.screenshot({ path: `${OUT}/${width}x${height}-play-using.png`, fullPage: false });
      note(
        `${width}x${height} using shot. using=${JSON.stringify(snap.using)} queues=${snap.queues.length} texture=${snap.textureSrc} overflowX=${snap.overflowX}`,
      );
      break;
    }
    await page.waitForTimeout(200);
  }
  if (!usingSeen) {
    await page.screenshot({ path: `${OUT}/${width}x${height}-play-using.png`, fullPage: false });
    note(`${width}x${height} TIMED OUT waiting for using occupancy.`);
  }
  const jump = maxJump(samples.filter(Boolean));
  note(
    `${width}x${height} samples=${samples.length} maxJumpPx=${jump.toFixed(1)} usingSeen=${usingSeen} queueSeen=${queueSeen}`,
  );
  const finalSnap = await worldSnapshot(page);
  note(`${width}x${height} final ${JSON.stringify(finalSnap)}`);
  await page.close();
  return { usingSeen, queueSeen, jump, overflowX: finalSnap.overflowX, textureSrc: finalSnap.textureSrc };
}

const browser = await chromium.launch({
  headless: true,
  executablePath: PW_CHROMIUM,
});
try {
  const a = await captureViewport(browser, 390, 844);
  const b = await captureViewport(browser, 375, 812);
  const summary = { a, b, notes };
  writeFileSync(`${OUT}/notes.json`, JSON.stringify(summary, null, 2));
  writeFileSync(`${OUT}/notes.txt`, notes.join('\n') + '\n');
  console.log('wrote', OUT);
} finally {
  await browser.close();
}
