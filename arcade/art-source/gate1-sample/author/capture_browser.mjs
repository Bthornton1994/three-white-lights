import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(new URL("../..", import.meta.url)));
const OUT = join(ROOT, "evidence", "gate1-production-sample", "browser");
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "mobile-390x844", width: 390, height: 844 },
  { name: "desktop-1280x800", width: 1280, height: 800 },
];

function metrics(page) {
  return page.evaluate(() => {
    const stage = document.querySelector(".stage-lifter");
    const cards = [...document.querySelectorAll(".lift-card-art img")].map((img) => {
      const r = img.getBoundingClientRect();
      return {
        w: Math.round(r.width),
        h: Math.round(r.height),
        src: img.currentSrc || img.src,
      };
    });
    const stageBox = stage
      ? (() => {
          const r = stage.getBoundingClientRect();
          return {
            w: Math.round(r.width),
            h: Math.round(r.height),
            src: stage.currentSrc || stage.src,
          };
        })()
      : null;
    return {
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      title: document.title,
      h1: document.querySelector("h1, h2")?.textContent ?? "",
      stage: stageBox,
      cards,
    };
  });
}

async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || "/usr/local/bin/google-chrome",
    args: ["--no-sandbox", "--disable-gpu"],
  });
  const report = { errors: [], shots: [] };
  const base = process.env.ARCADE_URL || "http://127.0.0.1:5173/";

  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    const errors = [];
    page.on("pageerror", (err) => errors.push(String(err)));
    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      const text = msg.text();
      if (text.includes("favicon") || text.includes("404 (Not Found)") && !text.includes("/sprites/")) {
        return;
      }
      errors.push(text);
    });
    page.on("response", (res) => {
      if (res.status() === 404) {
        const url = res.url();
        if (url.includes("/sprites/") || url.includes("/src/")) {
          errors.push(`404 ${url}`);
        }
      }
    });
    await page.goto(base, { waitUntil: "load" });
    await page.getByRole("button", { name: /step onto the platform/i }).waitFor({ timeout: 15000 });
    await page.waitForTimeout(250);
    let m = await metrics(page);
    const titlePath = join(OUT, `${vp.name}-title.png`);
    await page.screenshot({ path: titlePath, fullPage: false });
    report.shots.push({ viewport: vp.name, screen: "title", file: titlePath, ...m, errors: [...errors] });

    await page.getByRole("button", { name: /step onto the platform/i }).click();
    await page.getByRole("heading", { name: /choose a lift/i }).waitFor();
    await page.waitForTimeout(250);
    m = await metrics(page);
    const liftPath = join(OUT, `${vp.name}-lift-select.png`);
    await page.screenshot({ path: liftPath, fullPage: true });
    report.shots.push({ viewport: vp.name, screen: "lift-select", file: liftPath, ...m, errors: [...errors] });

    await page.getByRole("button", { name: /squat/i }).first().click();
    await page.getByRole("heading", { name: /squat attempts/i }).waitFor();
    await page.waitForTimeout(250);
    m = await metrics(page);
    const attPath = join(OUT, `${vp.name}-squat-attempts.png`);
    await page.screenshot({ path: attPath, fullPage: false });
    report.shots.push({ viewport: vp.name, screen: "squat-attempts", file: attPath, ...m, errors: [...errors] });

    // Push opener to e1RM so the stage uses squat-max (visualEffort >= 0.96).
    const plus = page.getByRole("button", { name: /raise attempt 1/i });
    for (let i = 0; i < 10; i += 1) {
      await plus.click();
    }
    await page.waitForTimeout(150);
    m = await metrics(page);
    const maxPath = join(OUT, `${vp.name}-squat-attempts-max.png`);
    await page.screenshot({ path: maxPath, fullPage: false });
    report.shots.push({ viewport: vp.name, screen: "squat-attempts-max", file: maxPath, ...m, errors: [...errors] });

    await page.getByRole("button", { name: /load the bar/i }).click();
    await page.getByText(/walk out/i).waitFor({ timeout: 5000 });
    await page.waitForTimeout(180);
    m = await metrics(page);
    const walkPath = join(OUT, `${vp.name}-squat-walkout.png`);
    await page.screenshot({ path: walkPath, fullPage: false });
    report.shots.push({ viewport: vp.name, screen: "squat-walkout", file: walkPath, ...m, errors: [...errors] });

    // Wait through walkout (~1100ms) into squat hole (~42–58% of timing).
    await page.waitForTimeout(1800);
    m = await metrics(page);
    const holePath = join(OUT, `${vp.name}-squat-hole.png`);
    await page.screenshot({ path: holePath, fullPage: false });
    report.shots.push({ viewport: vp.name, screen: "squat-hole", file: holePath, ...m, errors: [...errors] });

    await page.goto(base, { waitUntil: "load" });
    await page.getByRole("button", { name: /step onto the platform/i }).click();
    await page.getByRole("heading", { name: /choose a lift/i }).waitFor();
    await page.getByRole("button", { name: /deadlift/i }).first().click();
    await page.getByRole("heading", { name: /deadlift attempts/i }).waitFor();
    await page.waitForTimeout(200);
    m = await metrics(page);
    const dlSetupPath = join(OUT, `${vp.name}-deadlift-setup.png`);
    await page.screenshot({ path: dlSetupPath, fullPage: false });
    report.shots.push({ viewport: vp.name, screen: "deadlift-setup", file: dlSetupPath, ...m, errors: [...errors] });

    await page.getByRole("button", { name: /load the bar/i }).click();
    await page.getByText(/approach the bar/i).waitFor({ timeout: 5000 });
    const lockDeadline = Date.now() + 4500;
    while (Date.now() < lockDeadline) {
      const src = await page.locator(".stage-lifter").getAttribute("src");
      if (src && /deadlift(?:-max)?\/frame-0[56]\.png/.test(src)) {
        if (/frame-06/.test(src)) break;
      }
      await page.waitForTimeout(80);
    }
    m = await metrics(page);
    const dlLockPath = join(OUT, `${vp.name}-deadlift-lockout.png`);
    await page.screenshot({ path: dlLockPath, fullPage: false });
    report.shots.push({ viewport: vp.name, screen: "deadlift-lockout", file: dlLockPath, ...m, errors: [...errors] });

    await page.goto(new URL("/sprites/model-sheet.png", base).href, { waitUntil: "load" });
    await page.waitForTimeout(120);
    const sheetPath = join(OUT, `${vp.name}-model-sheet.png`);
    await page.screenshot({ path: sheetPath, fullPage: false });
    report.shots.push({
      viewport: vp.name,
      screen: "model-sheet",
      file: sheetPath,
      overflowX: false,
      title: "model-sheet",
      h1: "",
      stage: null,
      cards: [],
      errors: [...errors],
    });

    report.errors.push(...errors.map((e) => ({ viewport: vp.name, error: e })));
    await page.close();
  }

  writeFileSync(join(OUT, "METRICS.json"), JSON.stringify(report, null, 2));
  await browser.close();
  const overflow = report.shots.filter((s) => s.overflowX);
  const errs = report.errors;
  console.log(`shots ${report.shots.length}; overflowX ${overflow.length}; pageerrors ${errs.length}`);
  if (overflow.length || errs.length) {
    console.log(JSON.stringify({ overflow, errs }, null, 2));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
