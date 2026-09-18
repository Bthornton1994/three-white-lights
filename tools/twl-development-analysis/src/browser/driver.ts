/**
 * Playwright driver. Builds a CaptureBundle from a served build by playing the
 * real loop with the fake clock paused and stepped 16 ms at a time, so the
 * browser's sim ticks are reproducible and comparable to the mechanics probe.
 *
 * Read-only against the target. It never edits, only observes.
 */
import { existsSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import type {
  Beat,
  CaptureBundle,
  DomSample,
  IntentConfig,
  LiftId,
  PlannedInput,
  ProbeTrace,
  ServedFacts,
  ServedProvenance,
  Trace,
  Viewport,
} from "../types.ts";
import { attemptsFor } from "../attempt-plan.ts";
import { readDomInPage } from "./dom-sample.ts";
import { ensureDir } from "../util/fs.ts";
import { sha256Hex } from "../util/hash.ts";

export interface DriveOptions {
  url: string;
  outDir: string;
  targetSha: string;
  intent: IntentConfig;
  probeTraces: ProbeTrace[];
  tickMs: number;
  liftsByViewport: Record<Viewport["name"], LiftId[]>;
  attemptsPerLift?: number | null;
  chromiumPath?: string | null;
  spritePaths: string[];
  log?: (line: string) => void;
  /** `reference` walks title -> lift -> attempts only; used for the PR #69 comparison capture. */
  mode?: "full" | "reference";
  /**
   * Accept TLS-intercepting proxies for the two font hosts only. Off by
   * default; sandboxes with a MITM proxy need it to load the display font.
   */
  ignoreHttpsErrors?: boolean;
}

const FRAME_MS = 16;
const FAKE_EPOCH = Date.parse("2026-09-17T12:00:00.000Z");
const ALLOWED_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

export async function launchBrowser(chromiumPath?: string | null): Promise<{ browser: Browser; executable: string | null }> {
  const candidates: (string | null)[] = [null];
  if (chromiumPath) candidates.unshift(chromiumPath);
  if (process.env.TWL_CHROMIUM_PATH) candidates.unshift(process.env.TWL_CHROMIUM_PATH);
  if (existsSync("/opt/pw-browsers/chromium")) candidates.push("/opt/pw-browsers/chromium");
  let lastErr: unknown = null;
  for (const exe of candidates) {
    try {
      const browser = await chromium.launch({ headless: true, ...(exe ? { executablePath: exe } : {}) });
      return { browser, executable: exe };
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(`could not launch Chromium: ${String(lastErr)}`);
}

async function fetchServedFacts(url: string, mechanicsSha: string, baseSha: string, spritePaths: string[]): Promise<ServedFacts> {
  const index = await (await fetch(url + "/")).text();
  const scriptMatch = /<script[^>]+src="([^"]+)"/.exec(index);
  const cssMatch = /<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/.exec(index);
  const scriptPath = scriptMatch?.[1] ?? null;
  const cssPath = cssMatch?.[1] ?? null;
  const script = scriptPath ? Buffer.from(await (await fetch(url + scriptPath)).arrayBuffer()) : null;
  const css = cssPath ? Buffer.from(await (await fetch(url + cssPath)).arrayBuffer()) : null;
  const spriteHashes: Record<string, string> = {};
  for (const p of spritePaths) {
    const r = await fetch(url + p);
    if (r.ok) spriteHashes[p] = sha256Hex(Buffer.from(await r.arrayBuffer()));
  }
  const scriptText = script ? script.toString("utf8") : "";
  const provenanceRes = await fetch(url + "/__provenance.json");
  let provenance: ServedProvenance | null = null;
  if (provenanceRes.ok) {
    try {
      provenance = (await provenanceRes.json()) as ServedProvenance;
    } catch {
      provenance = null;
    }
  }
  const port = (() => {
    try {
      return Number(new URL(url).port);
    } catch {
      return null;
    }
  })();
  return {
    url,
    indexSha256: sha256Hex(index),
    scriptPath,
    scriptSha256: script ? sha256Hex(script) : null,
    cssPath,
    cssSha256: css ? sha256Hex(css) : null,
    scriptContainsMechanicsSha: scriptText.includes(mechanicsSha),
    scriptContainsBaseSha: scriptText.includes(baseSha),
    spriteHashes,
    provenance,
    port,
  };
}

class ViewportSession {
  private fakeNow = FAKE_EPOCH;
  private beatSeq = 0;
  readonly beats: Beat[] = [];
  readonly traces: Trace[] = [];
  readonly notes: string[] = [];

  private readonly page: Page;
  private readonly viewport: Viewport;
  private readonly opts: DriveOptions;
  private readonly evidenceDir: string;

  constructor(page: Page, viewport: Viewport, opts: DriveOptions, evidenceDir: string) {
    this.page = page;
    this.viewport = viewport;
    this.opts = opts;
    this.evidenceDir = evidenceDir;
  }

  private log(line: string): void {
    this.opts.log?.(`[${this.viewport.name}] ${line}`);
  }

  private domArgs() {
    return {
      tokenNames: Object.keys(this.opts.intent.ironAmber.tokens),
      forbidden: this.opts.intent.forbiddenDom,
      displayFont: this.opts.intent.ironAmber.displayFontFamily,
    };
  }

  async readDom(): Promise<DomSample> {
    return (await this.page.evaluate(readDomInPage, this.domArgs())) as DomSample;
  }

  async install(): Promise<void> {
    await this.page.clock.install({ time: FAKE_EPOCH });
  }

  /** Pauses the fake clock one second ahead of wherever it currently is (it ticks in real time until paused). */
  async pause(): Promise<void> {
    const now = await this.page.evaluate(() => Date.now());
    this.fakeNow = Math.max(this.fakeNow, now) + 1000;
    await this.page.clock.pauseAt(this.fakeNow);
  }

  async runFor(ms: number): Promise<void> {
    await this.page.clock.runFor(ms);
    this.fakeNow += ms;
  }

  async fakePerfNow(): Promise<number> {
    return this.page.evaluate(() => performance.now());
  }

  async settle(ms = 20): Promise<void> {
    await this.page.waitForTimeout(ms);
  }

  private async waitForFonts(): Promise<void> {
    await this.page.waitForFunction(() => document.fonts.status === "loaded", null, { timeout: 8000 }).catch(() => {
      this.notes.push(`${this.viewport.name}: fonts did not report loaded within 8 s`);
    });
  }

  async waitScreen(screen: string, timeout = 15_000): Promise<void> {
    await this.page.waitForSelector(`main.arcade-root[data-screen="${screen}"]`, { timeout });
  }

  async beat(label: string, lift: LiftId | null, frame: number | null, withCanvas: boolean): Promise<Beat> {
    await this.settle(withCanvas ? 80 : 20);
    const dom = await this.readDom();
    const id = `${this.viewport.name}-${String(this.beatSeq).padStart(2, "0")}-${lift ?? "none"}-${label}`;
    this.beatSeq += 1;
    const shot = path.join(this.evidenceDir, `${id}.png`);
    await this.page.screenshot({ path: shot, fullPage: false });
    let canvasPng: string | null = null;
    if (withCanvas) {
      const dataUrl = await this.page.evaluate(() => {
        const c =
          (document.querySelector("canvas.sprite-world") as HTMLCanvasElement | null) ??
          (document.querySelector("canvas.stage-canvas") as HTMLCanvasElement | null);
        return c ? c.toDataURL("image/png") : null;
      });
      if (dataUrl) {
        canvasPng = path.join(this.evidenceDir, `${id}.canvas.png`);
        writeFileSync(canvasPng, Buffer.from(dataUrl.split(",")[1] ?? "", "base64"));
      }
    }
    const rel = (p: string | null): string | null => (p ? path.relative(this.opts.outDir, p) : null);
    const beat: Beat = { id, viewport: this.viewport.name, lift, label, frame, dom, screenshot: rel(shot), canvasPng: rel(canvasPng) };
    this.beats.push(beat);
    this.log(`beat ${id} screen=${dom.screen} phase=${dom.phase ?? "-"} frame=${dom.animFrame ?? "-"} worldY=${dom.worldY ?? "-"}`);
    return beat;
  }

  async clickText(text: string): Promise<void> {
    await this.page.getByRole("button", { name: text, exact: false }).first().click();
  }

  private async padDown(): Promise<void> {
    const pad = this.page.locator(".hold-pad").first();
    const box = await pad.boundingBox();
    if (!box) throw new Error("hold pad not visible");
    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await this.page.mouse.down();
  }

  private async padUp(): Promise<void> {
    await this.page.mouse.up();
  }

  /**
   * Aligns the fake clock BEFORE the click that schedules the walkout timer,
   * so the timer (and therefore the play loop's first frame) lands on a 16 ms
   * boundary of performance.now(). Aligning after the click is too late: the
   * timer's due time is fixed at click time.
   */
  private async alignForWalkout(walkoutMs: number): Promise<void> {
    const now = await this.fakePerfNow();
    const target = now + walkoutMs;
    const pad = (FRAME_MS - (target % FRAME_MS)) % FRAME_MS;
    if (pad > 0) await this.runFor(pad);
  }

  /** Yields one browser macrotask so React's scheduler (MessageChannel) has committed before a DOM read. */
  private async flushReact(): Promise<void> {
    await this.page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          const ch = new MessageChannel();
          ch.port1.onmessage = () => {
            const ch2 = new MessageChannel();
            ch2.port1.onmessage = () => resolve();
            ch2.port2.postMessage(0);
          };
          ch.port2.postMessage(0);
        }),
    );
  }

  /**
   * Plays one attempt from the walkout screen with the probe's script,
   * stepping 16 ms per frame and mirroring the sim tick counter.
   */
  async playAttempt(lift: LiftId, probe: ProbeTrace, attempt: number, clickToWalkout: () => Promise<void>): Promise<Trace> {
    const tickMs = this.opts.tickMs;
    await this.alignForWalkout(probe.walkoutMs);
    const clickAt = await this.fakePerfNow();
    await clickToWalkout();
    await this.waitScreen("walkout");
    await this.flushReact();
    await this.beat("walkout", lift, null, true);
    // Stop one millisecond short, then fire the timer as the last event of its own
    // runFor: React commits the play screen and registers the rAF loop while the
    // clock is paused exactly on the timer's (aligned) due time.
    const due = clickAt + probe.walkoutMs;
    const now = await this.fakePerfNow();
    if (due - now - 1 > 0) await this.runFor(due - now - 1);
    await this.runFor(1);
    await this.waitScreen("play");
    await this.flushReact();
    const playStart = await this.fakePerfNow();
    const brace = await this.beat("brace", lift, 0, true);
    const heldBeforeFirstInput = brace.dom.held;
    let firstPressAccepted: boolean | null = null;
    const script = [...probe.script].sort((a, b) => a.tick - b.tick);
    const handled = new Set<number>();
    let held = false;
    let tick = 0;
    let carry = 0;
    const inputPlan: PlannedInput[] = [];
    const samples: Trace["samples"] = [];
    const maxFrames = probe.frames.length + 120;
    let endScreen: string | null = null;
    let framesRun = 0;
    const shotTaken = new Set<string>();
    for (let f = 0; f < maxFrames; f += 1) {
      const nextTick = tick + 1;
      for (let i = 0; i < script.length; i += 1) {
        const s = script[i]!;
        if (s.tick !== nextTick || handled.has(i)) continue;
        handled.add(i);
        if (s.kind === "press") {
          if (held) continue;
          held = true;
          await this.padDown();
          if (firstPressAccepted === null) firstPressAccepted = heldBeforeFirstInput !== true;
        } else {
          if (!held) continue;
          held = false;
          await this.padUp();
        }
        inputPlan.push({ frame: f, kind: s.kind });
      }
      await this.runFor(FRAME_MS);
      framesRun = f + 1;
      carry = carry + Math.max(0, Math.min(100, FRAME_MS));
      while (carry >= tickMs) {
        carry -= tickMs;
        tick += 1;
      }
      await this.flushReact();
      const dom = await this.readDom();
      samples.push({ frame: f, dom });
      if (dom.screen !== "play") {
        endScreen = dom.screen;
        break;
      }
      const key = dom.commandPress
        ? "press"
        : dom.commandLockout
          ? "lock"
          : dom.phase === "HOLE"
            ? "hole"
            : dom.phase === "ASCENT"
              ? "ascent"
              : null;
      if (key && !shotTaken.has(key)) {
        shotTaken.add(key);
        await this.beat(key, lift, f, true);
      }
    }
    if (held) {
      await this.padUp();
      held = false;
    }
    if (endScreen === null) {
      const dom = await this.readDom();
      endScreen = dom.screen;
      this.notes.push(`${this.viewport.name}/${lift}/attempt${attempt}: play did not resolve within ${maxFrames} frames`);
    }
    const trace: Trace = {
      id: `${this.viewport.name}-${lift}-a${attempt}`,
      viewport: this.viewport.name,
      lift,
      attempt,
      inputPlan,
      samples,
      endScreen,
      framesRun,
      heldBeforeFirstInput,
      firstPressAccepted,
    };
    this.traces.push(trace);
    this.notes.push(`${trace.id}: clickAt=${clickAt} playStart=${playStart} (mod16=${playStart % FRAME_MS}) frames=${framesRun} ticks=${tick} end=${endScreen}`);
    return trace;
  }

  async playLift(lift: LiftId, attempts: number, first: boolean): Promise<void> {
    if (!first) {
      await this.page.evaluate(() => localStorage.clear());
      await this.page.reload();
      await this.page.waitForSelector("h1");
      await this.pause();
    }
    await this.clickText("Step onto the platform");
    await this.waitScreen("lift");
    if (first) await this.beat("lift", null, null, false);
    const cards = this.page.locator(".lift-card");
    await cards.nth(["squat", "bench", "deadlift"].indexOf(lift)).click();
    await this.waitScreen("attempts");
    await this.beat("attempts", lift, null, true);
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const probe = this.opts.probeTraces.find((t) => t.lift === lift && t.attempt === attempt);
      if (!probe) {
        this.notes.push(`no probe trace for ${lift} attempt ${attempt}; skipping`);
        return;
      }
      const trace = await this.playAttempt(lift, probe, attempt, async () => {
        if (attempt === 1) await this.clickText("Load the bar");
        else await this.clickText("Walk out");
      });
      if (trace.endScreen !== "judging") return;
      await this.beat("judging", lift, null, true);
      await this.runFor(probe.judgingMs + FRAME_MS);
      await this.page.waitForSelector('main.arcade-root[data-screen="success"], main.arcade-root[data-screen="failure"]', { timeout: 15_000 });
      const outcome = await this.beat("outcome", lift, null, true);
      if (attempt < attempts) {
        if (outcome.dom.screen === "success") await this.clickText("Next attempt");
        else await this.clickText("Continue");
        await this.page.waitForSelector('main.arcade-root[data-screen="transition"], main.arcade-root[data-screen="bomb"]', { timeout: 15_000 });
        const t = await this.beat("transition", lift, null, true);
        if (t.dom.screen === "bomb") return;
      } else if (attempts === 3) {
        if (outcome.dom.screen === "success") await this.clickText("See the card");
        else await this.clickText("Continue");
        await this.page.waitForSelector('main.arcade-root[data-screen="results"], main.arcade-root[data-screen="bomb"]', { timeout: 15_000 });
        await this.beat("results", lift, null, false);
      }
    }
  }

  async run(lifts: LiftId[]): Promise<void> {
    await this.install();
    await this.page.goto(this.opts.url + "/", { waitUntil: "load" });
    await this.page.waitForSelector("h1");
    await this.waitForFonts();
    await this.pause();
    let title = await this.beat("title", null, null, false);
    if (title.dom.displayFontLoaded === false) {
      // One retry: the font hosts are external and may fail transiently behind a proxy.
      this.notes.push(`${this.viewport.name}: display font not loaded on first paint; reloading once`);
      await this.page.reload({ waitUntil: "load" });
      await this.page.waitForSelector("h1");
      await this.waitForFonts();
      await this.pause();
      this.beats.pop();
      this.beatSeq -= 1;
      title = await this.beat("title", null, null, false);
    }
    if (this.opts.mode === "reference") {
      await this.clickText("Step onto the platform");
      await this.waitScreen("lift");
      await this.beat("lift", null, null, false);
      await this.page.locator(".lift-card").first().click();
      await this.waitScreen("attempts");
      await this.beat("attempts", "squat", null, true);
      return;
    }
    let first = true;
    for (const lift of lifts) {
      const attempts = attemptsFor(lift, this.viewport.name, this.opts.attemptsPerLift ?? null);
      await this.playLift(lift, attempts, first);
      first = false;
    }
  }
}

export async function captureBundle(opts: DriveOptions, mechanicsSha: string, baseSha: string): Promise<CaptureBundle> {
  const evidenceDir = ensureDir(path.join(opts.outDir, "evidence"));
  const served = await fetchServedFacts(opts.url, mechanicsSha, baseSha, opts.spritePaths);
  const { browser, executable } = await launchBrowser(opts.chromiumPath);
  const notes: string[] = [];
  if (executable) notes.push(`chromium executable override: ${executable}`);
  if (opts.ignoreHttpsErrors) notes.push("ignoreHTTPSErrors enabled for font hosts (opt-in)");
  const beats: Beat[] = [];
  const traces: Trace[] = [];
  let version: string | null = null;
  try {
    version = browser.version();
    for (const viewport of opts.intent.viewports) {
      const context: BrowserContext = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 1,
        reducedMotion: "no-preference",
        locale: "en-US",
        timezoneId: "UTC",
        ignoreHTTPSErrors: Boolean(opts.ignoreHttpsErrors),
      });
      const origin = new URL(opts.url).host;
      await context.route("**/*", (route) => {
        const host = new URL(route.request().url()).host;
        if (host === origin || ALLOWED_HOSTS.includes(host)) return route.continue();
        return route.abort();
      });
      const page = await context.newPage();
      page.on("pageerror", (err) => notes.push(`${viewport.name}: pageerror ${err.message}`));
      page.on("console", (msg) => {
        if (msg.type() === "error") notes.push(`${viewport.name}: console.error ${msg.text()}`);
      });
      const session = new ViewportSession(page, viewport, opts, evidenceDir);
      try {
        await session.run(opts.liftsByViewport[viewport.name] ?? []);
      } catch (err) {
        notes.push(`${viewport.name}: driver aborted: ${err instanceof Error ? err.message : String(err)}`);
        try {
          await session.beat("abort", null, null, false);
        } catch {
          /* ignore */
        }
      }
      beats.push(...session.beats);
      traces.push(...session.traces);
      notes.push(...session.notes);
      await context.close();
    }
  } finally {
    await browser.close();
  }
  return {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    targetSha: opts.targetSha,
    served,
    viewports: opts.intent.viewports,
    beats,
    traces,
    cases: [],
    attemptsPerLift: opts.attemptsPerLift ?? null,
    evidenceDir: path.relative(opts.outDir, evidenceDir) || "evidence",
    browser: { playwright: playwrightVersion(), version },
    notes,
  };
}

export function playwrightVersion(): string | null {
  try {
    const require = createRequire(import.meta.url);
    return (require("playwright/package.json") as { version: string }).version;
  } catch {
    return null;
  }
}
