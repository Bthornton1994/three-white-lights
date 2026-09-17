#!/usr/bin/env node
/**
 * Layout-only QA for the squat DEPTH gauge + stable athlete slot.
 * Does not retune feel, judging, or frame mappings.
 */
const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");

const URL = process.env.SMOKE_URL || "http://127.0.0.1:5173/";
const CHROME = process.env.CHROME_PATH || "/usr/local/bin/google-chrome";
const OUT = path.resolve(__dirname);
const ARTIFACTS = "/opt/cursor/artifacts/layout-qa";
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(ARTIFACTS, { recursive: true });

function overlapArea(a, b) {
  if (!a || !b) return 0;
  const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return x * y;
}

async function measure(page) {
  return page.evaluate(() => {
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        top: r.top,
        left: r.left,
        right: r.right,
        bottom: r.bottom,
        width: r.width,
        height: r.height,
        cx: r.left + r.width / 2,
        cy: r.top + r.height / 2,
      };
    };
    const wrap = document.querySelector("[data-anim-runtime]");
    const slot = document.querySelector(".stage-slot");
    const gauge = document.querySelector(".squat-depth-gauge");
    const athlete = document.querySelector(".illustrated-athlete");
    const panel = document.querySelector(".panel");
    const label = document.querySelector(".squat-depth-gauge-label");
    const ticks = [...document.querySelectorAll(".squat-depth-tick")].map((el) => ({
      text: el.textContent,
      box: box(el),
    }));
    const legal = document.querySelector(".squat-depth-target");
    const marker = document.querySelector("[data-squat-depth-marker]");
    const rail = document.querySelector(".squat-depth-track");
    return {
      screen: document.querySelector("[data-proof-screen]")?.getAttribute("data-proof-screen"),
      runtime: wrap?.getAttribute("data-anim-runtime"),
      lift: wrap?.getAttribute("data-anim-lift"),
      frame: wrap?.getAttribute("data-anim-frame"),
      pose: wrap?.getAttribute("data-anim-pose"),
      src: wrap?.getAttribute("data-anim-src") || athlete?.getAttribute("src"),
      depth: wrap?.getAttribute("data-squat-depth"),
      phase: wrap?.getAttribute("data-squat-depth-phase") || gauge?.getAttribute("data-squat-depth-phase"),
      gaugeInStage: !!(gauge && wrap && wrap.contains(gauge)),
      gaugeInSlot: !!(gauge && slot && slot.contains(gauge)),
      athleteInSlot: !!(athlete && slot && slot.contains(athlete)),
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      wrap: box(wrap),
      slot: box(slot),
      gauge: box(gauge),
      athlete: box(athlete),
      panel: box(panel),
      label: box(label),
      ticks,
      legal: box(legal),
      marker: box(marker),
      rail: box(rail),
      viewport: { w: window.innerWidth, h: window.innerHeight },
    };
  });
}

function layoutFails(tag, snap, fail) {
  if (snap.overflowX) fail.push(`${tag} overflowX`);
  if (!snap.athlete) fail.push(`${tag} missing athlete`);
  if (snap.gauge) {
    if (!snap.gaugeInStage) fail.push(`${tag} gauge not in stage`);
    if (!snap.gaugeInSlot) fail.push(`${tag} gauge not in stage-slot`);
    if (!snap.athleteInSlot) fail.push(`${tag} athlete not in stage-slot`);
    const g = snap.gauge;
    const a = snap.athlete;
    if (g && a) {
      const vOverlap = Math.max(0, Math.min(g.bottom, a.bottom) - Math.max(g.top, a.top));
      if (g.bottom <= a.top + 8) fail.push(`${tag} gauge above lifter (g.bottom=${g.bottom.toFixed(1)} a.top=${a.top.toFixed(1)})`);
      if (g.top < a.top - 28) fail.push(`${tag} gauge starts above lifter (g.top=${g.top.toFixed(1)} a.top=${a.top.toFixed(1)})`);
      if (g.height > a.height + 40) fail.push(`${tag} gauge taller than lifter band (${g.height.toFixed(1)} vs ${a.height.toFixed(1)})`);
      if (vOverlap < Math.min(48, a.height * 0.35)) {
        fail.push(`${tag} gauge not beside lifter (vOverlap=${vOverlap.toFixed(1)})`);
      }
      if (g.left + 8 < a.cx && g.right < a.right - 8) {
        fail.push(`${tag} gauge not to the right of lifter`);
      }
      if (g.right > snap.viewport.w + 1) fail.push(`${tag} gauge past viewport right`);
    }
    const pairs = [];
    if (snap.marker && snap.legal) pairs.push(["marker/legal", snap.marker, snap.legal]);
    if (snap.marker && snap.label) pairs.push(["marker/DEPTH", snap.marker, snap.label]);
    for (const tick of snap.ticks) {
      if (snap.marker) pairs.push([`marker/${tick.text}`, snap.marker, tick.box]);
      if (snap.legal) pairs.push([`legal/${tick.text}`, snap.legal, tick.box]);
      if (snap.label) pairs.push([`DEPTH/${tick.text}`, snap.label, tick.box]);
    }
    for (const [name, a, b] of pairs) {
      const area = overlapArea(a, b);
      if (area > 4) fail.push(`${tag} ${name} overlap ${area.toFixed(1)}px`);
    }
    for (let i = 0; i < snap.ticks.length; i++) {
      for (let j = i + 1; j < snap.ticks.length; j++) {
        const area = overlapArea(snap.ticks[i].box, snap.ticks[j].box);
        if (area > 4) fail.push(`${tag} tick ${snap.ticks[i].text}/${snap.ticks[j].text} overlap`);
      }
    }
  }
}

async function shot(page, name) {
  const dests = [path.join(OUT, `${name}.png`), path.join(ARTIFACTS, `${name}.png`)];
  await page.screenshot({ path: dests[0], fullPage: false });
  fs.copyFileSync(dests[0], dests[1]);
}

async function clickNamed(page, re) {
  await page.getByRole("button", { name: re }).first().click({ timeout: 8000 });
}

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ["--no-sandbox", "--disable-gpu"],
  });
  const report = { errors: {}, live: {}, frozen: {}, jump: {} };
  const fail = [];

  for (const vp of [
    { name: "phone", size: { width: 390, height: 844 } },
    { name: "desk", size: { width: 1280, height: 800 } },
  ]) {
    const context = await browser.newContext({ viewport: vp.size });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });

    report.frozen[vp.name] = {};
    for (const phase of [
      { name: "hole", t: "0.50", expectFrame: "frame-03", expectPhase: "hole", minDepth: 0.99 },
      { name: "ascent", t: "0.72", expectFrame: "frame-04", expectPhase: "ascent", minDepth: 0.4 },
    ]) {
      await page.goto(`${URL}?proof=timing&lift=squat&t=${phase.t}`, { waitUntil: "networkidle" });
      await page.waitForFunction(() => {
        const img = document.querySelector(".illustrated-athlete");
        return img instanceof HTMLImageElement && img.complete && img.getBoundingClientRect().height > 80;
      }, { timeout: 4000 });
      await page.waitForTimeout(80);
      const snap = await measure(page);
      await shot(page, `${vp.name}-${phase.name}`);
      report.frozen[vp.name][phase.name] = snap;
      layoutFails(`${vp.name} ${phase.name}`, snap, fail);
      if (snap.runtime !== "sprite-frames") fail.push(`${vp.name} ${phase.name} runtime ${snap.runtime}`);
      if (!String(snap.frame).includes(phase.expectFrame)) fail.push(`${vp.name} ${phase.name} frame=${snap.frame}`);
      if (snap.phase !== phase.expectPhase) fail.push(`${vp.name} ${phase.name} phase=${snap.phase}`);
      if (Number(snap.depth) < phase.minDepth) fail.push(`${vp.name} ${phase.name} depth=${snap.depth}`);
      if (!snap.gauge) fail.push(`${vp.name} ${phase.name} missing gauge`);
    }

    await page.goto(`${URL}?proof=results`, { waitUntil: "networkidle" });
    await page.waitForTimeout(200);
    const resultsGauge = await page.locator(".squat-depth-gauge").count();
    if (resultsGauge !== 0) fail.push(`${vp.name} gauge on results`);
    await shot(page, `${vp.name}-results`);
    const resultsOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    if (resultsOverflow) fail.push(`${vp.name} results overflowX`);

    await page.goto(`${URL}?proof=timing&lift=bench&t=0.5`, { waitUntil: "networkidle" });
    await page.waitForTimeout(150);
    if ((await page.locator(".squat-depth-gauge").count()) !== 0) fail.push(`${vp.name} gauge on bench`);

    await page.goto(`${URL}?proof=timing&lift=deadlift&t=0.5`, { waitUntil: "networkidle" });
    await page.waitForTimeout(150);
    if ((await page.locator(".squat-depth-gauge").count()) !== 0) fail.push(`${vp.name} gauge on deadlift`);

    await page.goto(URL, { waitUntil: "networkidle" });
    await clickNamed(page, /Step onto the platform/i);
    await page.locator(".illustrated-lift-card").nth(0).click();
    await clickNamed(page, /Load the bar/i);

    const live = { walkout: null, timing: null, judging: null };
    const athleteReady = () =>
      page
        .waitForFunction(() => {
          const img = document.querySelector(".illustrated-athlete");
          if (!(img instanceof HTMLImageElement)) return false;
          const h = img.getBoundingClientRect().height;
          return img.complete && img.naturalHeight > 0 && h > 80;
        }, { timeout: 2500 })
        .catch(() => null);

    const t0 = Date.now();
    while (Date.now() - t0 < 5500) {
      const screen = await page.locator("[data-proof-screen]").getAttribute("data-proof-screen");
      if (screen === "walkout" && !live.walkout) {
        await athleteReady();
        const s = await measure(page);
        live.walkout = s;
        await shot(page, `${vp.name}-walkout`);
        layoutFails(`${vp.name} walkout`, s, fail);
        if (!s.gauge) fail.push(`${vp.name} walkout missing gauge`);
      }
      if (screen === "timing" && !live.timing) {
        await athleteReady();
        live.timing = await measure(page);
      }
      if (screen === "judging" && !live.judging) {
        await athleteReady();
        const s = await measure(page);
        live.judging = s;
        await shot(page, `${vp.name}-judging`);
        layoutFails(`${vp.name} judging`, s, fail);
        if (!s.gauge) fail.push(`${vp.name} judging missing gauge`);
        break;
      }
      await page.waitForTimeout(40);
    }
    report.live[vp.name] = {
      walkoutY: live.walkout?.athlete?.top,
      timingY: live.timing?.athlete?.top,
      judgingY: live.judging?.athlete?.top,
      walkoutH: live.walkout?.wrap?.height,
      timingH: live.timing?.wrap?.height,
      judgingH: live.judging?.wrap?.height,
    };
    if (!live.walkout) fail.push(`${vp.name} missed walkout`);
    if (!live.timing) fail.push(`${vp.name} missed timing`);
    if (!live.judging) fail.push(`${vp.name} missed judging`);
    const ys = [live.walkout?.athlete?.top, live.timing?.athlete?.top, live.judging?.athlete?.top].filter(
      (n) => typeof n === "number",
    );
    if (ys.length === 3) {
      const span = Math.max(...ys) - Math.min(...ys);
      report.jump[vp.name] = span;
      if (span > 12) fail.push(`${vp.name} athlete Y jump ${span.toFixed(1)}px (${ys.map((n) => n.toFixed(1)).join(" -> ")})`);
    }
    const hs = [live.walkout?.wrap?.height, live.timing?.wrap?.height, live.judging?.wrap?.height].filter(
      (n) => typeof n === "number",
    );
    if (hs.length === 3) {
      const hSpan = Math.max(...hs) - Math.min(...hs);
      if (hSpan > 8) fail.push(`${vp.name} stage height jump ${hSpan.toFixed(1)}px`);
    }

    report.errors[vp.name] = errors;
    if (errors.length) fail.push(`${vp.name} console ${errors.join(" | ")}`);
    await context.close();
  }

  await browser.close();
  const out = { fail, report };
  fs.writeFileSync(path.join(OUT, "LAYOUT.json"), JSON.stringify(out, null, 2));
  fs.writeFileSync(path.join(ARTIFACTS, "LAYOUT.json"), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  if (fail.length) process.exitCode = 1;
})();
