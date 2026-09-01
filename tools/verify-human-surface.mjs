#!/usr/bin/env node
/**
 * Stage C.1d / C-DEBT-04 / D.1b human-surface verifier.
 *
 * Clicks the bounding box of the VISIBLE sprite/station/member root, not an
 * invisible helper Pressable. A testID is used only to FIND the drawn object
 * whose pixels a human would tap.
 *
 * C-DEBT-04 and the occupied-station completion claim run on both a
 * mobile-sized viewport and a desktop viewport.
 *
 * Stage D.1b adds world-legibility and interaction-close claims: Quality
 * changes the bench sprite, Throughput shows a plate tree, occupied bay
 * stays inspectable via the world label, one tap switches selection, and
 * boxed Capacity is refused in the panel before purchase.
 */
import { existsSync, mkdirSync } from 'node:fs';
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
  if (
    usingIds.some(
      (id) =>
        typeof id === 'string' &&
        (id.includes('flat-bench') || id.includes('competition-bench-bay')),
    )
  ) {
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
    const usingIds = await page.locator('[data-testid^="floorsim-using-"]').evaluateAll((nodes) =>
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

  const equipmentBox = await boxOf('floorgrid-fixed-power-bar');
  if (equipmentBox !== null && equipmentBox.width >= 4 && equipmentBox.height >= 4) {
    const eqCandidates = [
      { x: equipmentBox.x + equipmentBox.width * 0.2, y: equipmentBox.y + equipmentBox.height * 0.2 },
      { x: equipmentBox.x + equipmentBox.width * 0.8, y: equipmentBox.y + equipmentBox.height * 0.2 },
      { x: equipmentBox.x + equipmentBox.width * 0.5, y: equipmentBox.y + equipmentBox.height * 0.5 },
    ];
    const eqPoint = eqCandidates.find((candidate) => !pointHitsMember(candidate.x, candidate.y));
    if (eqPoint !== undefined) {
      await page.mouse.click(eqPoint.x, eqPoint.y);
      await page.waitForTimeout(300);
      const equipmentIdentity = await textOf('floorgrid-equipment-panel-identity');
      const stationCountAfterEq = await page.getByTestId('floorgrid-station-panel').count();
      if (
        equipmentIdentity !== null &&
        equipmentIdentity.includes('Power bar') &&
        stationCountAfterEq === 0
      ) {
        ok(
          `${tag}: tapping power-bar inspects equipment ("${equipmentIdentity}"), not the Competition Bench Bay`,
        );
      } else {
        fail(
          `${tag}: tapping power-bar collapsed into the station — equipment="${equipmentIdentity}", station panels=${stationCountAfterEq}`,
        );
      }
      await page.getByText('close', { exact: true }).click().catch(() => {});
    } else {
      fail(`${tag}: power-bar bbox was fully covered by a member; equipment-vs-station tap could not be aimed`);
    }
  } else {
    fail(`${tag}: floorgrid-fixed-power-bar has no box to inspect as equipment`);
  }

  // Stage D.1b — one-press cross-object selection. No close between taps.
  const bayLabelClicked = await clickVisible('floorgrid-bay-label-competition-bench-bay');
  await page.waitForTimeout(300);
  const stationAfterLabel = await page.getByTestId('floorgrid-station-panel').count();
  if (bayLabelClicked && stationAfterLabel === 1) {
    ok(`${tag}: tapping the visible "bench bay" label opens the station panel`);
  } else {
    fail(
      `${tag}: bay label tap did not open the station panel — clicked=${bayLabelClicked}, panels=${stationAfterLabel}`,
    );
  }
  const powerClickedOnce = await clickVisible('floorgrid-fixed-power-bar');
  await page.waitForTimeout(300);
  const equipmentAfterStation = await textOf('floorgrid-equipment-panel-identity');
  const stationAfterPower = await page.getByTestId('floorgrid-station-panel').count();
  if (
    powerClickedOnce &&
    equipmentAfterStation !== null &&
    equipmentAfterStation.includes('Power bar') &&
    stationAfterPower === 0
  ) {
    ok(`${tag}: one tap switches station → Power Bar equipment (no close)`);
  } else {
    fail(
      `${tag}: station → equipment was not one tap — equipment="${equipmentAfterStation}", station=${stationAfterPower}`,
    );
  }
  const memberSwitchClicked = await clickVisible('floorgrid-ambient-0');
  await page.waitForTimeout(300);
  const memberAfterEquipment = await page.getByTestId('floorgrid-member-panel').count();
  const equipmentAfterMember = await page.getByTestId('floorgrid-equipment-panel').count();
  if (memberSwitchClicked && memberAfterEquipment === 1 && equipmentAfterMember === 0) {
    ok(`${tag}: one tap switches equipment → member (no close)`);
  } else {
    fail(
      `${tag}: equipment → member was not one tap — member=${memberAfterEquipment}, equipment=${equipmentAfterMember}`,
    );
  }
  const bayFromMember = await clickVisible('floorgrid-bay-label-competition-bench-bay');
  await page.waitForTimeout(300);
  const stationAfterMember = await page.getByTestId('floorgrid-station-panel').count();
  const memberAfterBay = await page.getByTestId('floorgrid-member-panel').count();
  if (bayFromMember && stationAfterMember === 1 && memberAfterBay === 0) {
    ok(`${tag}: one tap switches member → station (no close)`);
  } else {
    fail(
      `${tag}: member → station was not one tap — station=${stationAfterMember}, member=${memberAfterBay}`,
    );
  }
  await page.getByText('close', { exact: true }).click().catch(() => {});

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
    const occupiedLabel = await clickVisible('floorgrid-bay-label-competition-bench-bay');
    await page.waitForTimeout(300);
    const occupiedStationPanel = await page.getByTestId('floorgrid-station-panel').count();
    const occupiedMemberPanel = await page.getByTestId('floorgrid-member-panel').count();
    if (occupiedLabel && occupiedStationPanel === 1 && occupiedMemberPanel === 0) {
      ok(`${tag}: occupied bay remains inspectable via the visible "bench bay" label`);
    } else {
      fail(
        `${tag}: occupied bay label did not open the station — clicked=${occupiedLabel}, station=${occupiedStationPanel}, member=${occupiedMemberPanel}`,
      );
    }
    await page.getByText('close', { exact: true }).click().catch(() => {});
    const usingMember = await page.locator('[data-testid^="floorsim-cue-"][data-testid*="-using"]').first();
    const usingCount = await page.locator('[data-testid^="floorsim-cue-"][data-testid*="-using"]').count();
    if (usingCount > 0) {
      const usingId = await usingMember.getAttribute('data-testid');
      const usingIndex = usingId === null ? null : usingId.split('-')[2];
      if (usingIndex !== null) {
        const memberClicked = await clickVisible(`floorgrid-ambient-${usingIndex}`);
        await page.waitForTimeout(300);
        const memberPanel = await page.getByTestId('floorgrid-member-panel').count();
        if (memberClicked && memberPanel === 1) {
          ok(`${tag}: visible using member remains inspectable`);
        } else {
          fail(`${tag}: using member tap did not open the member panel — clicked=${memberClicked}, panels=${memberPanel}`);
        }
        await page.getByText('close', { exact: true }).click().catch(() => {});
      }
    }
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

function purseAmount(text) {
  const match = /gym bucks:\s*([\d.]+)/i.exec(text ?? '');
  return match === null ? Number.NaN : Number.parseFloat(match[1] ?? '');
}

async function enterGym(page) {
  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(1800);
  await page.getByText('GYM EMPIRE').click({ timeout: 15000 });
  await page.getByTestId('gymscreen-root').waitFor({ state: 'attached', timeout: 20000 });
  await page.waitForTimeout(800);
}

async function afford(page, amount) {
  await page.getByTestId('gymscreen-surface-more').click();
  await page.waitForTimeout(200);
  let purse = Number.NaN;
  for (let i = 0; i < 16; i += 1) {
    purse = purseAmount(await page.getByTestId('gymscreen-gym-bucks').innerText({ timeout: 2000 }).catch(() => ''));
    if (Number.isFinite(purse) && purse >= amount) return purse;
    await page.getByTestId('gymscreen-advance-259200').click();
    await page.waitForTimeout(250);
  }
  return purse;
}

async function shot(page, name) {
  mkdirSync('/workspace/screenshots', { recursive: true });
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: false });
}

async function runD1b(page, viewportName) {
  const { clickVisible, textOf } = helpers(page);
  const tag = viewportName;

  await enterGym(page);
  await page.getByText('play', { exact: true }).click();
  await page.waitForTimeout(400);
  await shot(page, `d1b-stock-${tag}`);
  const stockQuality = await page.getByTestId('floorgrid-quality-bench-competition-bench-bay').count();
  const stockTree = await page.getByTestId('floorgrid-plate-tree-competition-bench-bay').count();
  const stockSecond = await page.getByTestId('floorgrid-bay-expansion').count();
  if (stockQuality === 0 && stockTree === 0 && stockSecond === 0) {
    ok(`${tag}: stock bay is one ordinary bench — no quality pad, no plate tree, no second bench`);
  } else {
    fail(
      `${tag}: stock bay already shows fittings — quality=${stockQuality}, tree=${stockTree}, second=${stockSecond}`,
    );
  }

  const purseBeforeQuality = await afford(page, 120);
  await page.getByTestId('gymscreen-surface-play').click();
  await page.waitForTimeout(300);
  await clickVisible('floorgrid-bay-label-competition-bench-bay');
  await page.waitForTimeout(300);
  const qualityBuy = await page.getByTestId('floorgrid-station-panel-upgrade-quality').count();
  if (qualityBuy === 1) {
    await page.getByTestId('floorgrid-station-panel-upgrade-quality').click();
    await page.waitForTimeout(400);
  } else {
    fail(`${tag}: Quality buy was not offered — purse=${purseBeforeQuality}, buttons=${qualityBuy}`);
  }
  await page.getByText('close', { exact: true }).click().catch(() => {});
  await page.waitForTimeout(200);
  await shot(page, `d1b-quality-${tag}`);
  const qualityPresent = await page.getByTestId('floorgrid-quality-bench-competition-bench-bay').count();
  const qualitySecond = await page.getByTestId('floorgrid-bay-expansion').count();
  if (qualityPresent === 1 && qualitySecond === 0) {
    ok(`${tag}: Quality changes the visible bench pad and still has one physical bench`);
  } else {
    fail(`${tag}: Quality world cue missing or added a bench — pad=${qualityPresent}, second=${qualitySecond}`);
  }

  await enterGym(page);
  await page.getByText('play', { exact: true }).click();
  await page.waitForTimeout(400);
  await afford(page, 150);
  await page.getByTestId('gymscreen-surface-play').click();
  await page.waitForTimeout(300);
  await clickVisible('floorgrid-bay-label-competition-bench-bay');
  await page.waitForTimeout(300);
  const throughputBuy = await page.getByTestId('floorgrid-station-panel-upgrade-throughput').count();
  if (throughputBuy === 1) {
    await page.getByTestId('floorgrid-station-panel-upgrade-throughput').click();
    await page.waitForTimeout(400);
  } else {
    fail(`${tag}: Throughput buy was not offered — buttons=${throughputBuy}`);
  }
  await page.getByText('close', { exact: true }).click().catch(() => {});
  await page.waitForTimeout(200);
  await shot(page, `d1b-throughput-${tag}`);
  const treePresent = await page.getByTestId('floorgrid-plate-tree-competition-bench-bay').count();
  const treeSecond = await page.getByTestId('floorgrid-bay-expansion').count();
  if (treePresent === 1 && treeSecond === 0) {
    ok(`${tag}: Throughput shows a plate tree on the same one-bench bay`);
  } else {
    fail(`${tag}: Throughput world cue missing or added a bench — tree=${treePresent}, second=${treeSecond}`);
  }

  await enterGym(page);
  await page.getByText('play', { exact: true }).click();
  await page.waitForTimeout(400);
  const purseBeforeBox = await afford(page, 180);
  await page.getByTestId('gymscreen-surface-build').click();
  await page.waitForTimeout(300);
  await clickVisible('floorgrid-fixed-sprite-flat-bench');
  await page.waitForTimeout(200);
  await helpers(page).clickGridTile(6, 2);
  await page.waitForTimeout(200);
  await clickVisible('floorgrid-fixed-sprite-power-bar');
  await page.waitForTimeout(200);
  await helpers(page).clickGridTile(5, 2);
  await page.waitForTimeout(200);
  await clickVisible('floorgrid-fixed-sprite-comp-plates');
  await page.waitForTimeout(200);
  await helpers(page).clickGridTile(6, 0);
  await page.waitForTimeout(300);
  await page.getByTestId('gymscreen-surface-play').click();
  await page.waitForTimeout(400);
  await clickVisible('floorgrid-bay-label-competition-bench-bay');
  await page.waitForTimeout(300);
  const boxedUnavailable = await textOf('floorgrid-station-panel-upgrade-capacity-unavailable');
  const boxedLive = await page.getByTestId('floorgrid-station-panel-upgrade-capacity').count();
  const purseAfterBox = purseAmount(
    await page.getByTestId('gymscreen-gym-bucks').innerText({ timeout: 2000 }).catch(() => ''),
  );
  // Exact purse equality is the wrong proxy: C.2 earnings keep ticking while
  // the boxed layout is assembled. The claim is that the player was not
  // charged the Second-bench price for a silent no-op.
  const capacityCost = 180;
  const didNotPay =
    Number.isFinite(purseAfterBox) &&
    Number.isFinite(purseBeforeBox) &&
    purseAfterBox > purseBeforeBox - capacityCost / 2;
  if (
    boxedUnavailable !== null &&
    boxedUnavailable.includes('No room for a second bench') &&
    boxedLive === 0 &&
    didNotPay
  ) {
    ok(`${tag}: boxed Capacity shows "No room for a second bench" before purchase; purse not charged`);
  } else {
    fail(
      `${tag}: boxed Capacity preflight failed — text="${boxedUnavailable}", live=${boxedLive}, purse ${purseBeforeBox}→${purseAfterBox}`,
    );
  }
  await page.getByText('close', { exact: true }).click().catch(() => {});

  await page.getByTestId('gymscreen-surface-build').click();
  await page.waitForTimeout(300);
  await clickVisible('floorgrid-fixed-sprite-flat-bench');
  await page.waitForTimeout(200);
  await helpers(page).clickGridTile(3, 0);
  await page.waitForTimeout(200);
  await clickVisible('floorgrid-fixed-sprite-power-bar');
  await page.waitForTimeout(200);
  await helpers(page).clickGridTile(0, 0);
  await page.waitForTimeout(200);
  await clickVisible('floorgrid-fixed-sprite-comp-plates');
  await page.waitForTimeout(200);
  await helpers(page).clickGridTile(1, 0);
  await page.waitForTimeout(300);
  await page.getByTestId('gymscreen-surface-play').click();
  await page.waitForTimeout(400);
  await clickVisible('floorgrid-bay-label-competition-bench-bay');
  await page.waitForTimeout(300);
  const openedLive = await page.getByTestId('floorgrid-station-panel-upgrade-capacity').count();
  if (openedLive === 1) {
    ok(`${tag}: rearranging to a legal layout re-enables the Second bench purchase`);
    await page.getByTestId('floorgrid-station-panel-upgrade-capacity').click();
    await page.waitForTimeout(400);
    await page.getByText('close', { exact: true }).click().catch(() => {});
    await shot(page, `d1b-capacity-${tag}`);
    const second = await page.getByTestId('floorgrid-bay-expansion').count();
    if (second === 1) {
      ok(`${tag}: Capacity still realises a second physical bench`);
    } else {
      fail(`${tag}: Capacity purchase did not draw the second bench`);
    }
  } else {
    fail(`${tag}: Capacity did not become purchasable after rearranging`);
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
    const d1bContext = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.deviceScaleFactor,
    });
    const d1bPage = await d1bContext.newPage();
    try {
      await runD1b(d1bPage, viewport.name);
    } catch (err) {
      fail(
        `${viewport.name}: D.1b unexpected error: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      await d1bContext.close();
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
