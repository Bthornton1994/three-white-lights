#!/usr/bin/env node
/**
 * Stage C.1d / C-DEBT-04 human-surface verifier.
 *
 * Clicks the bounding box of the VISIBLE sprite/station/member root, not an
 * invisible helper Pressable. A testID is used only to FIND the drawn object
 * whose pixels a human would tap.
 *
 * C-DEBT-04 and the occupied-station completion claim run on both a
 * mobile-sized viewport and a desktop viewport.
 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';

const url = process.argv.includes('--url')
  ? process.argv[process.argv.indexOf('--url') + 1]
  : 'http://localhost:8081';

const PW_CHROMIUM = existsSync('/opt/pw-browsers/chromium')
  ? '/opt/pw-browsers/chromium'
  : undefined;

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844, deviceScaleFactor: 2 },
  { name: 'desktop', width: 1280, height: 800, deviceScaleFactor: 1 },
];

const REFUSE_REASONS = new Set(['Space occupied', "Doesn't fit here", 'Outside the gym']);

let passed = 0;
let failed = 0;
function ok(msg) {
  passed += 1;
  console.log(`  ok    ${msg}`);
}
function fail(msg) {
  failed += 1;
  console.log(`  FAIL  ${msg}`);
}

function helpers(page) {
  async function boxOf(id) {
    const handle = await page.$(`[data-testid="${id}"]`);
    if (handle === null) return null;
    return handle.boundingBox();
  }

  async function clickVisible(id) {
    const box = await boxOf(id);
    if (box === null || box.width < 2 || box.height < 2) return false;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(250);
    return true;
  }

  async function clickGridTile(xTile, yTile) {
    const grid = await boxOf('floorgrid-grid');
    if (grid === null) return false;
    const tile = grid.width / 8;
    await page.mouse.click(grid.x + tile * (xTile + 0.5), grid.y + tile * (yTile + 0.5));
    await page.waitForTimeout(250);
    return true;
  }

  async function textOf(id) {
    try {
      return await page.getByTestId(id).innerText({ timeout: 2000 });
    } catch {
      return null;
    }
  }

  return { boxOf, clickVisible, clickGridTile, textOf };
}

function stationIdFromUsing(usingIds) {
  if (usingIds.some((id) => typeof id === 'string' && id.includes('flat-bench'))) {
    return 'floorgrid-fixed-flat-bench';
  }
  if (usingIds.some((id) => typeof id === 'string' && id.includes('power-bar'))) {
    return 'floorgrid-fixed-power-bar';
  }
  if (usingIds.some((id) => typeof id === 'string' && id.includes('comp-plates'))) {
    return 'floorgrid-fixed-comp-plates';
  }
  return null;
}

async function waitForOccupiedStation(page) {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const usingIds = await page.locator('[data-testid^="floorsim-using-fixed-"]').evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('data-testid')),
    );
    const occupied = stationIdFromUsing(usingIds);
    if (occupied !== null) return occupied;
    await page.waitForTimeout(250);
  }
  return null;
}

async function runSurface(page, viewportName) {
  const { boxOf, clickVisible, clickGridTile, textOf } = helpers(page);
  const tag = viewportName;

  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(1800);
  await page.getByText('GYM EMPIRE').click({ timeout: 15000 });
  await page.getByTestId('gymscreen-root').waitFor({ state: 'attached', timeout: 20000 });
  await page.waitForTimeout(800);

  await page.getByText('play', { exact: true }).click();
  await page.waitForTimeout(400);

  const memberBefore = await page.getByTestId('floorgrid-member-panel').count();
  const memberClicked = await clickVisible('floorgrid-ambient-0');
  const memberPanel = await page.getByTestId('floorgrid-member-panel').count();
  if (memberClicked && memberPanel > memberBefore) {
    ok(`${tag}: visible animated member (floorgrid-ambient-0 bbox) opens the member card`);
    await page.getByText('close', { exact: true }).click().catch(() => {});
  } else {
    fail(
      `${tag}: clicking the animated member bbox did not open a card — clicked=${memberClicked}, panels=${memberPanel}`,
    );
  }

  const stationRoots = [
    'floorgrid-fixed-flat-bench',
    'floorgrid-fixed-comp-plates',
    'floorgrid-fixed-power-bar',
  ];
  const memberBoxes = [];
  for (let i = 0; i < 8; i += 1) {
    const memberBox = await boxOf(`floorgrid-ambient-${i}`);
    if (memberBox !== null) memberBoxes.push(memberBox);
  }
  const pointHitsMember = (x, y) =>
    memberBoxes.some(
      (memberBox) =>
        x >= memberBox.x &&
        x <= memberBox.x + memberBox.width &&
        y >= memberBox.y &&
        y <= memberBox.y + memberBox.height,
    );
  let stationIdentity = null;
  let stationClickedId = null;
  for (const id of stationRoots) {
    const stationBox = await boxOf(id);
    if (stationBox === null || stationBox.width < 4 || stationBox.height < 4) continue;
    const candidates = [
      { x: stationBox.x + stationBox.width * 0.2, y: stationBox.y + stationBox.height * 0.2 },
      { x: stationBox.x + stationBox.width * 0.8, y: stationBox.y + stationBox.height * 0.2 },
      { x: stationBox.x + stationBox.width * 0.2, y: stationBox.y + stationBox.height * 0.8 },
      { x: stationBox.x + stationBox.width * 0.5, y: stationBox.y + stationBox.height * 0.5 },
    ];
    const point = candidates.find((candidate) => !pointHitsMember(candidate.x, candidate.y));
    if (point === undefined) continue;
    await page.mouse.click(point.x, point.y);
    await page.waitForTimeout(300);
    stationIdentity = await textOf('floorgrid-station-panel-identity');
    if (stationIdentity !== null && stationIdentity.length > 0) {
      stationClickedId = id;
      break;
    }
    await page.getByText('close', { exact: true }).click().catch(() => {});
  }
  if (stationClickedId !== null && stationIdentity !== null) {
    ok(
      `${tag}: visible station root (${stationClickedId} uncovered pixels) opens the station card ("${stationIdentity}")`,
    );
    await page.getByText('close', { exact: true }).click().catch(() => {});
  } else {
    fail(
      `${tag}: clicking uncovered pixels of a visible station did not open its card — identity="${stationIdentity}"`,
    );
  }

  await page.getByText('build', { exact: true }).click();
  await page.waitForTimeout(300);

  const positions = [];
  const legalTiles = [
    [6, 0],
    [5, 2],
    [0, 3],
  ];
  for (let i = 0; i < legalTiles.length; i += 1) {
    const selected = await clickVisible('floorgrid-fixed-sprite-power-bar');
    const banner = await textOf('floorgrid-pending');
    if (!selected || banner === null || !banner.includes('Power bar')) {
      fail(`${tag}: move ${i + 1}: clicking the visible power bar did not enter placement ("${banner}")`);
      break;
    }
    const [x, y] = legalTiles[i];
    await clickGridTile(x, y);
    const box = await boxOf('floorgrid-fixed-sprite-power-bar');
    if (box === null) {
      fail(`${tag}: move ${i + 1}: power bar disappeared`);
      break;
    }
    const moved =
      positions.length === 0 ||
      Math.abs(box.x - positions[positions.length - 1].x) > 8 ||
      Math.abs(box.y - positions[positions.length - 1].y) > 8;
    if (i === 0 || moved) {
      ok(
        `${tag}: move ${i + 1}: visible power bar placed at tile (${x},${y}) — sprite at (${Math.round(box.x)},${Math.round(box.y)})`,
      );
      positions.push({ x: box.x, y: box.y });
    } else {
      fail(`${tag}: move ${i + 1}: sprite did not move — still at (${Math.round(box.x)},${Math.round(box.y)})`);
    }
  }

  await clickVisible('floorgrid-fixed-sprite-power-bar');
  await clickGridTile(1, 0);
  const refused = await textOf('floorgrid-drop-refused');
  const stillPending = await textOf('floorgrid-pending');
  const refusedArea = await boxOf('floorgrid-drop-refused-area');
  if (
    refused !== null &&
    REFUSE_REASONS.has(refused.trim()) &&
    stillPending !== null &&
    refusedArea !== null &&
    refusedArea.width > 2 &&
    refusedArea.height > 2
  ) {
    ok(
      `${tag}: invalid placement shows "${refused.trim()}" in the Moving banner, outlines the attempted cells (${Math.round(refusedArea.width)}x${Math.round(refusedArea.height)}), and keeps "${stillPending}"`,
    );
  } else {
    fail(
      `${tag}: invalid placement was silent — refused="${refused}", pending="${stillPending}", area=${JSON.stringify(refusedArea)}`,
    );
  }

  await clickGridTile(7, 4);
  const doesntFit = await textOf('floorgrid-drop-refused');
  const stillMoving = await textOf('floorgrid-pending');
  if (doesntFit !== null && doesntFit.includes("Doesn't fit here") && stillMoving !== null) {
    ok(`${tag}: overflow placement shows "Doesn't fit here" and keeps selection ("${stillMoving}")`);
  } else {
    fail(`${tag}: overflow placement reason missing — refused="${doesntFit}", pending="${stillMoving}"`);
  }

  await clickGridTile(6, 0);

  await page.getByText('play', { exact: true }).click();
  await page.waitForTimeout(400);
  const occupiedStation = await waitForOccupiedStation(page);
  if (occupiedStation === null) {
    fail(`${tag}: no occupied fixed station to move while a member is using it`);
  } else {
    const before = await boxOf(occupiedStation);
    await page.getByText('build', { exact: true }).click();
    await page.waitForTimeout(200);
    const selected = await clickVisible(occupiedStation);
    const moving = await textOf('floorgrid-pending');
    await clickGridTile(0, 2);
    const after = await boxOf(occupiedStation);
    const relocated =
      before !== null &&
      after !== null &&
      (Math.abs(after.x - before.x) > 8 || Math.abs(after.y - before.y) > 8);
    await page.getByText('play', { exact: true }).click();
    await page.waitForTimeout(400);
    const membersAfter = await page.locator('[data-testid^="floorgrid-ambient-"]').count();
    if (selected && moving !== null && relocated && membersAfter > 0) {
      ok(
        `${tag}: occupied ${occupiedStation} selected ("${moving}"), moved, and ${membersAfter} member(s) still simulated`,
      );
    } else {
      fail(
        `${tag}: occupied-station move incomplete — selected=${selected}, moving="${moving}", relocated=${relocated}, members=${membersAfter}`,
      );
    }
  }

  await page.getByText('shop', { exact: true }).click();
  await page.waitForTimeout(300);
  const shopName = await textOf('gymscreen-shop-name-power-bar');
  if (shopName === 'Power bar') {
    ok(`${tag}: Shop still shows a visual Power bar card`);
  } else {
    fail(`${tag}: Shop Power bar card missing — "${shopName}"`);
  }

  await page.getByText('staff', { exact: true }).click();
  await page.waitForTimeout(300);
  const manager = await textOf('gymscreen-manager-state');
  if (manager !== null && manager.includes('No manager hired')) {
    ok(`${tag}: Staff shows a manager card, not a diagnostic dump`);
  } else {
    fail(`${tag}: Staff manager state unexpected — "${manager}"`);
  }
}

const browser = await chromium.launch({
  ...(PW_CHROMIUM === undefined ? {} : { executablePath: PW_CHROMIUM }),
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader'],
});

try {
  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.deviceScaleFactor,
    });
    const page = await context.newPage();
    try {
      await runSurface(page, viewport.name);
    } catch (err) {
      fail(
        `${viewport.name}: unexpected error: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  console.log('');
  if (failed === 0) {
    console.log(`PASS — 0 failing claim(s) of ${passed}.`);
    process.exit(0);
  }
  console.log(`FAIL — ${failed} failing claim(s) of ${passed + failed}.`);
  process.exit(1);
}
