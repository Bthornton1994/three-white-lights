#!/usr/bin/env node
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = "/workspace/screenshots/qa/squat-depth";
const URL = process.env.SMOKE_URL || "http://127.0.0.1:8080/";
fs.mkdirSync(OUT, { recursive: true });

const PHASES = [
  { name: "stand", t: "0.08" },
  { name: "descent", t: "0.32" },
  { name: "hole", t: "0.50" },
  { name: "ascent", t: "0.72" },
  { name: "lockout", t: "0.96" },
];

async function measure(page) {
  return page.evaluate(() => {
    const wrap = document.querySelector("[data-anim-runtime]");
    const gauge = document.querySelector(".squat-depth-gauge");
    const panel = document.querySelector(".panel");
    const results = document.querySelector(".illustrated-results-panel, .results-sheet");
    const athlete = document.querySelector(".illustrated-athlete");
    const gb = gauge?.getBoundingClientRect();
    const wb = wrap?.getBoundingClientRect();
    const pb = panel?.getBoundingClientRect();
    const rb = results?.getBoundingClientRect();
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
      gaugeBelowPanel: !!(gb && pb && gb.top >= pb.top - 1),
      gaugeBelowResults: !!(gb && rb && gb.top >= rb.top - 1),
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      heading: document.querySelector("h1,h2")?.textContent?.trim() || null,
    };
  });
}

async function clickNamed(page, re) {
  await page.getByRole("button", { name: re }).first().click({ timeout: 8000 });
}

(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const report = { errors: [], phases: {}, live: {}, play: {} };
  const fail = [];

  for (const vp of [
    { name: "phone", size: { width: 390, height: 844 }, dsf: 2 },
    { name: "desk", size: { width: 1280, height: 800 }, dsf: 1 },
  ]) {
    const context = await browser.newContext({
      viewport: vp.size,
      deviceScaleFactor: vp.dsf,
      recordVideo: vp.name === "phone" ? { dir: OUT, size: vp.size } : undefined,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });

    report.phases[vp.name] = {};
    for (const phase of PHASES) {
      await page.goto(`${URL}?proof=timing&lift=squat&t=${phase.t}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(250);
      const snap = await measure(page);
      await page.screenshot({ path: path.join(OUT, `${vp.name}-${phase.name}.png`) });
      report.phases[vp.name][phase.name] = snap;
      if (snap.runtime !== "sprite-frames") fail.push(`${vp.name} ${phase.name} runtime ${snap.runtime}`);
      if (!snap.gaugeInStage) fail.push(`${vp.name} ${phase.name} gauge not in stage`);
      if (snap.gaugeBelowResults) fail.push(`${vp.name} ${phase.name} gauge below results`);
      if (snap.overflowX) fail.push(`${vp.name} ${phase.name} overflow`);
      if (!snap.src || !snap.src.includes("/sprites/squat/")) fail.push(`${vp.name} ${phase.name} src ${snap.src}`);
    }

    const hole = report.phases[vp.name].hole;
    const stand = report.phases[vp.name].stand;
    if (hole.frame === stand.frame) fail.push(`${vp.name} hole frame did not change from stand (${hole.frame})`);
    if (hole.phase !== "hole") fail.push(`${vp.name} hole phase=${hole.phase}`);
    if (Number(hole.depth) < 0.99) fail.push(`${vp.name} hole depth=${hole.depth}`);
    if (!String(hole.frame).includes("frame-03")) fail.push(`${vp.name} hole frame=${hole.frame}`);
    if (report.phases[vp.name].lockout.phase !== "lock") {
      fail.push(`${vp.name} lockout phase=${report.phases[vp.name].lockout.phase}`);
    }

    // Results: gauge must not exist
    await page.goto(`${URL}?proof=results`, { waitUntil: "networkidle" });
    await page.waitForTimeout(200);
    const resultsGauge = await page.locator(".squat-depth-gauge").count();
    if (resultsGauge !== 0) fail.push(`${vp.name} gauge on results`);
    await page.screenshot({ path: path.join(OUT, `${vp.name}-results.png`) });

    // Bench: no squat depth gauge
    await page.goto(`${URL}?proof=timing&lift=bench&t=0.5`, { waitUntil: "networkidle" });
    await page.waitForTimeout(200);
    const benchGauge = await page.locator(".squat-depth-gauge").count();
    const benchSrc = await page.locator("[data-anim-src]").first().getAttribute("data-anim-src");
    if (benchGauge !== 0) fail.push(`${vp.name} gauge on bench`);
    if (!benchSrc || !benchSrc.includes("/sprites/bench/")) fail.push(`${vp.name} bench src ${benchSrc}`);

    // Live squat attempt with DEPTH + DRIVE taps
    await page.goto(URL, { waitUntil: "networkidle" });
    await clickNamed(page, /Step onto the platform/i);
    await page.locator(".illustrated-lift-card").nth(0).click();
    await clickNamed(page, /Load the bar/i);
    const t0 = Date.now();
    while (Date.now() - t0 < 1800) {
      const s = await measure(page);
      if (s.screen === "timing") break;
      await page.waitForTimeout(40);
    }
    const live = [];
    const start = Date.now();
    let tapped = 0;
    while (Date.now() - start < 2400) {
      const s = await measure(page);
      live.push(s);
      if (s.screen === "timing") {
        const elapsed = Date.now() - start;
        if (tapped === 0 && elapsed >= 880 && elapsed <= 1100) {
          await page.getByRole("button", { name: /DEPTH|DRIVE|HOLD/i }).click();
          tapped += 1;
        } else if (tapped === 1 && elapsed >= 1650 && elapsed <= 1900) {
          await page.getByRole("button", { name: /DEPTH|DRIVE|HOLD/i }).click();
          tapped += 1;
        }
      }
      await page.waitForTimeout(70);
    }
    const uniqueFrames = [...new Set(live.map((s) => s.frame).filter(Boolean))];
    const uniquePhases = [...new Set(live.map((s) => s.phase).filter(Boolean))];
    const uniqueDepth = [...new Set(live.map((s) => s.depth).filter((d) => d !== "" && d != null))];
    report.live[vp.name] = { uniqueFrames, uniquePhases, uniqueDepth, last: live[live.length - 1], tapped };
    if (uniqueFrames.length < 3) fail.push(`${vp.name} live frames ${uniqueFrames.join(",")}`);
    if (!uniquePhases.includes("hole")) fail.push(`${vp.name} live never hole (${uniquePhases.join(",")})`);
    if (uniqueDepth.length < 2) fail.push(`${vp.name} depth did not move`);

    await page.waitForTimeout(900);
    const after = await measure(page);
    await page.screenshot({ path: path.join(OUT, `${vp.name}-after-attempt.png`) });
    report.play[vp.name] = after;

    report.errors[vp.name] = errors;
    if (errors.length) fail.push(`${vp.name} errors ${errors.join(" | ")}`);

    const video = vp.name === "phone" ? await page.video()?.path() : null;
    await context.close();
    if (video) {
      const dest = path.join(OUT, "phone-squat-depth.webm");
      try {
        fs.renameSync(video, dest);
      } catch {
        fs.copyFileSync(video, dest);
      }
    }
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, "SMOKE.json"), JSON.stringify({ fail, report }, null, 2));
  console.log(JSON.stringify({ fail, phases: report.phases, live: report.live, play: report.play, errors: report.errors }, null, 2));
  if (fail.length) process.exitCode = 1;
})();
