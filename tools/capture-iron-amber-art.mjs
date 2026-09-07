#!/usr/bin/env node
/**
 * Capture Iron & Amber art-slice evidence at 390×844 and 375×812.
 * Play / Build / occupancy, plus shop / staff / more. Does not open diagnostics.
 *
 * Usage: node tools/capture-iron-amber-art.mjs --url http://127.0.0.1:8080
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const url = (() => {
  const idx = process.argv.indexOf('--url');
  return idx >= 0 ? process.argv[idx + 1] : 'http://127.0.0.1:8080';
})();

const OUT = '/workspace/screenshots/iron-amber-art';
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
  await page.waitForTimeout(800);
}

async function measure(page, label) {
  return page.evaluate((tag) => {
    const grid = document.querySelector('[data-testid="floorgrid-grid"]');
    const imgs = [...document.querySelectorAll('img')].map((img) => img.getAttribute('src') || '');
    const empireArt = imgs.filter((src) => src.includes('/empire-art/'));
    const dataUri = imgs.filter((src) => src.startsWith('data:image/png'));
    const vertical = [...document.querySelectorAll('[data-testid^="floorgrid-line-v-"]')].length;
    const horizontal = [...document.querySelectorAll('[data-testid^="floorgrid-line-h-"]')].length;
    const occupancy = document.querySelector('[data-testid="floorgrid-occupancy"]');
    const occupancyBox = occupancy ? occupancy.getBoundingClientRect() : null;
    const clock = document.querySelector('[data-testid="gymscreen-clock"]');
    const clockBox = clock ? clock.getBoundingClientRect() : null;
    const clockStyle = clock ? getComputedStyle(clock.parentElement || clock) : null;
    const accelerated = document.querySelector('[data-testid="gymscreen-accelerated-bucks"]');
    const accBox = accelerated ? accelerated.getBoundingClientRect() : null;
    const caption = document.querySelector('[data-testid="floorgrid-caption"]');
    const captionBox = caption ? caption.getBoundingClientRect() : null;
    const moreDebug = document.querySelector('[data-testid="gymscreen-more-debug"]');
    const moreDebugText = moreDebug ? moreDebug.innerText : '';
    const moreDrawer = document.querySelector('[data-testid="gymscreen-more-drawer"]');
    const moreDisplay = moreDrawer ? getComputedStyle(moreDrawer).display : 'missing';
    const overflowX = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
    const fab = document.querySelector('[data-testid="gymscreen-build-fab"]');
    const texture = document.querySelector('[data-testid="gymscreen-facility-art"]');
    const textureImg = texture && (texture.tagName === 'IMG' ? texture : texture.querySelector('img'));
    const textureSrc = textureImg ? textureImg.getAttribute('src') : (texture ? texture.getAttribute('src') : null);
    const textureBox = texture ? texture.getBoundingClientRect() : null;
    const member = document.querySelector('[data-testid^="floorgrid-member-sprite-"]');
    const memberImg = member && (member.tagName === 'IMG' ? member : member.querySelector('img'));
    const memberSrc = memberImg ? memberImg.getAttribute('src') : (member ? member.getAttribute('src') : null);
    const memberStyle = member ? getComputedStyle(member) : null;
    const memberBox = member ? member.getBoundingClientRect() : null;
    const bench = document.querySelector('[data-testid="floorgrid-fixed-sprite-flat-bench"]');
    const benchImg = bench && (bench.tagName === 'IMG' ? bench : bench.querySelector('img'));
    const benchSrc = benchImg ? benchImg.getAttribute('src') : (bench ? bench.getAttribute('src') : null);
    const plane = document.querySelector('[data-testid="floorgrid-floor-plane"]');
    const planeImg = plane && (plane.tagName === 'IMG' ? plane : plane.querySelector('img'));
    const planeSrc = planeImg ? planeImg.getAttribute('src') : (plane ? plane.getAttribute('src') : null);
    const planeBox = plane ? plane.getBoundingClientRect() : null;
    const gridBox = grid ? grid.getBoundingClientRect() : null;
    return {
      tag,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      empireArtCount: empireArt.length,
      empireArtSample: empireArt.slice(0, 8),
      dataUriCount: dataUri.length,
      verticalLines: vertical,
      horizontalLines: horizontal,
      occupancyVisible: occupancyBox !== null && occupancyBox.width > 8 && occupancyBox.height > 8,
      occupancyBox,
      occupancyText: occupancy ? occupancy.innerText : '',
      clockBox,
      clockParentOpacity: clockStyle ? clockStyle.opacity : null,
      acceleratedBox: accBox,
      captionBox,
      moreDisplay,
      moreDebugText,
      overflowX,
      fabPresent: fab !== null,
      textureSrc,
      textureBox,
      memberSrc,
      memberOpacity: memberStyle ? memberStyle.opacity : null,
      memberBox,
      benchSrc,
      planeSrc,
      planeBox,
      gridBox,
    };
  }, label);
}

async function shoot(page, name) {
  const path = `${OUT}/${name}.png`;
  await page.screenshot({ path, fullPage: false });
  note(`wrote ${path}`);
  return path;
}

async function runViewport(width, height) {
  const browser = await chromium.launch({
    ...(PW_CHROMIUM === undefined ? {} : { executablePath: PW_CHROMIUM }),
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const prefix = `${width}x${height}`;
  await reachGym(page);
  const play = await measure(page, `${prefix}-play`);
  note(JSON.stringify(play, null, 2));
  await shoot(page, `${prefix}-play`);
  await page.getByTestId('gymscreen-surface-build').click({ timeout: 8000 });
  await page.waitForTimeout(400);
  const build = await measure(page, `${prefix}-build`);
  note(JSON.stringify(build, null, 2));
  await shoot(page, `${prefix}-build`);
  await page.getByTestId('floorgrid-fixed-flat-bench').click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(300);
  const placing = await measure(page, `${prefix}-build-place`);
  note(JSON.stringify(placing, null, 2));
  await shoot(page, `${prefix}-build-place`);
  await page.getByTestId('floorgrid-place-cancel').click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(200);
  await page.getByTestId('gymscreen-surface-shop').click({ timeout: 8000 });
  await page.waitForTimeout(400);
  await shoot(page, `${prefix}-shop`);
  await page.getByTestId('gymscreen-surface-staff').click({ timeout: 8000 });
  await page.waitForTimeout(400);
  await shoot(page, `${prefix}-staff`);
  await page.getByTestId('gymscreen-surface-more').click({ timeout: 8000 });
  await page.waitForTimeout(400);
  const more = await measure(page, `${prefix}-more`);
  note(JSON.stringify(more, null, 2));
  await shoot(page, `${prefix}-more`);
  await page.getByTestId('gymscreen-surface-play').click({ timeout: 8000 });
  await page.waitForTimeout(400);
  await shoot(page, `${prefix}-play-return`);
  await browser.close();
  return { play, build, more };
}

const a = await runViewport(390, 844);
const b = await runViewport(375, 812);
writeFileSync(`${OUT}/notes.json`, JSON.stringify({ a, b, log: notes }, null, 2));
writeFileSync(`${OUT}/notes.txt`, notes.join('\n'));
console.log(`notes -> ${OUT}/notes.json`);
