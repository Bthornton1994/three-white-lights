/**
 * Mechanics probe. Runs INSIDE a throwaway worktree of the target SHA with the
 * target's own modules loaded through Node type stripping. It reads the sim,
 * the presentation contract, the frame mapping and the sprite anchors. It
 * never mutates the target and never retunes anything.
 *
 * Invocation (from the analysis package):
 *   node --import ./src/probe/register.mjs ./src/probe/mechanics-probe.ts \
 *        --arcade <worktree>/arcade --out <facts.json> [--oracle <samples.json>]
 *
 * Output: ProbeFacts JSON. Sections that fail to load are reported in `errors`
 * and left null so the analyzers fail closed instead of guessing.
 */
import { writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

type Dict = Record<string, any>;

const FRAME_DT_MS = 16;
const MAX_FRAMES = 4000;

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : (process.argv[i + 1] ?? null);
}

async function load(arcade: string, rel: string): Promise<Dict> {
  return (await import(pathToFileURL(path.join(arcade, rel)).href)) as Dict;
}

interface ScriptInput {
  tick: number;
  kind: "press" | "release";
}

function scriptFor(scripts: Dict, lift: string, config: Dict): { style: string; script: ScriptInput[] } {
  if (lift === "squat") return { style: "ideal", script: scripts.squatScript(config, "ideal") };
  if (lift === "bench") return { style: "mash", script: scripts.benchScript(config, "mash") };
  return { style: "held", script: scripts.deadliftScript(config, "held") };
}

/**
 * Mirrors ArcadeApp's rAF loop: stepPlay(state, 16) per frame, one queued
 * input consumed per sim tick, and the same press/release guard the pad
 * applies (a press while held is ignored, a release while not held is
 * ignored). Records one row per frame with the tick it ended on.
 */
function traceAttempt(machine: Dict, frames: Dict, sheets: Dict, lift: string, stateIn: Dict, script: ScriptInput[]): Dict {
  let state = stateIn;
  const walkoutMs = machine.walkoutDurationMs(state);
  state = machine.startPlay(state);
  const config = { ...state.liftState.config };
  const weightKg = machine.currentWeightKg(state);
  const e1rmKg = state.e1rmKg;
  const effort = sheets.visualEffort(weightKg, e1rmKg);
  const sorted = [...script].sort((a, b) => a.tick - b.tick);
  const handled = new Set<number>();
  let held = false;
  const inputPlan: Dict[] = [];
  const rows: Dict[] = [];
  const recordRow = (frame: number): void => {
    const view = state.presentation;
    rows.push({
      frame,
      tick: state.liftState ? state.liftState.tick : -1,
      screen: state.screen,
      phase: view ? view.phase : null,
      depth: view ? view.depth : null,
      barHeight: view ? view.barHeight : null,
      sheetIndex: view ? frames.sheetIndexFromPresentation(view) : -1,
      frameSrc: frames.frameSrcFromPresentation(lift, state.screen, view, state.presentMs, effort),
      pose: frames.poseFromPresentation(view, state.screen),
      prompt: state.prompt,
      press: Boolean(view?.command?.pressCommandLive),
      lockout: Boolean(view?.command?.lockoutHoldLive),
      held: Boolean(view?.command?.held),
    });
  };
  recordRow(-1);
  for (let f = 0; f < MAX_FRAMES; f += 1) {
    const nextTick = state.liftState.tick + 1;
    for (let i = 0; i < sorted.length; i += 1) {
      const s = sorted[i]!;
      if (s.tick !== nextTick || handled.has(i)) continue;
      handled.add(i);
      if (s.kind === "press") {
        if (held) continue;
        held = true;
      } else {
        if (!held) continue;
        held = false;
      }
      state = machine.queueInput(state, s.kind);
      inputPlan.push({ frame: f, tick: s.tick, kind: s.kind });
    }
    state = machine.stepPlay(state, FRAME_DT_MS);
    recordRow(f);
    if (state.screen !== "play") break;
  }
  const judgingMs = state.screen === "judging" ? machine.judgingDurationMs(state) : 0;
  const outcome = state.lastOutcome ?? null;
  return {
    lift,
    attempt: state.currentAttempt,
    config: { kind: config.kind, loadRatio: config.loadRatio, seed: config.seed },
    weightKg,
    e1rmKg,
    script: sorted,
    inputPlan,
    frames: rows,
    endScreen: state.screen,
    outcome: state.liftState?.resolution?.outcome ?? null,
    made: outcome ? Boolean(outcome.made) : null,
    walkoutMs,
    judgingMs,
    effort,
    stateAfter: state,
  };
}

async function main(): Promise<void> {
  const arcade = arg("arcade");
  const out = arg("out");
  const oracleFile = arg("oracle");
  if (!arcade || !out) {
    console.error("usage: mechanics-probe --arcade <dir> --out <file> [--oracle <samples.json>]");
    process.exit(2);
  }
  const facts: Dict = {
    tickMs: null,
    frameDtMs: FRAME_DT_MS,
    legalDepthSquat: null,
    stage: null,
    anchors: null,
    edition: null,
    traces: [],
    oracle: null,
    errors: [],
  };
  const note = (section: string, err: unknown): void => {
    facts.errors.push(`${section}: ${err instanceof Error ? err.message : String(err)}`);
  };

  try {
    const anchors = await load(arcade, "src/sprites/anchors.ts");
    facts.stage = anchors.STAGE ?? null;
    facts.anchors = anchors.ANCHORS ?? null;
  } catch (err) {
    note("anchors", err);
  }
  try {
    const edition = await load(arcade, "src/sprites/edition.ts");
    facts.edition = edition.SPRITE_EDITION ?? null;
  } catch (err) {
    note("edition", err);
  }
  try {
    const pres = await load(arcade, "src/game/liftPresentation.ts");
    facts.tickMs = pres.PRESENTATION_TICK_MS;
  } catch (err) {
    note("presentation", err);
  }
  try {
    const tuning = await load(arcade, "src/game/liftTuning.ts");
    facts.legalDepthSquat = tuning.LIFT_TUNING?.DEPTH_LEGAL?.squat ?? null;
  } catch (err) {
    note("tuning", err);
  }

  let machine: Dict | null = null;
  let frames: Dict | null = null;
  let sheets: Dict | null = null;
  let scripts: Dict | null = null;
  try {
    machine = await load(arcade, "src/sport/machine.ts");
    frames = await load(arcade, "src/sport/frames.ts");
    sheets = await load(arcade, "src/sprites/sheets.ts");
    scripts = await load(arcade, "src/sport/scripts.ts");
  } catch (err) {
    note("machine", err);
  }

  if (machine && frames && sheets && scripts) {
    const plans: { lift: string; attempts: number }[] = [
      { lift: "squat", attempts: 3 },
      { lift: "bench", attempts: 1 },
      { lift: "deadlift", attempts: 1 },
    ];
    for (const plan of plans) {
      try {
        let state = machine.chooseLift(machine.initialState(null), plan.lift);
        for (let attempt = 1; attempt <= plan.attempts; attempt += 1) {
          state = machine.startWalkout(state);
          const probeConfig = machine.startPlay(state).liftState.config;
          const { style, script } = scriptFor(scripts, plan.lift, probeConfig);
          const trace = traceAttempt(machine, frames, sheets, plan.lift, state, script);
          const after = trace.stateAfter;
          delete trace.stateAfter;
          trace.style = style;
          facts.traces.push(trace);
          if (after.screen !== "judging") break;
          state = machine.continueAfterOutcome(machine.afterJudging(after));
          if (state.screen !== "transition") break;
        }
      } catch (err) {
        note(`trace:${plan.lift}`, err);
      }
    }
  }

  if (oracleFile && frames) {
    try {
      const samples = JSON.parse(readFileSync(oracleFile, "utf8")) as Dict[];
      // DOM attributes carry three decimals; a value on a mapping threshold is
      // ambiguous, so the oracle accepts any index reachable within +/- 0.0005.
      facts.oracle = samples.map((s) => {
        try {
          const at = (d: number, h: number): number =>
            frames!.sheetIndexFromPresentation({ kind: s.kind, phase: s.phase, depth: d, barHeight: h });
          const center = at(s.depth, s.barHeight);
          const alts = new Set<number>([
            center,
            at(s.depth - 0.0005, s.barHeight - 0.0005),
            at(s.depth + 0.0005, s.barHeight + 0.0005),
          ]);
          return { index: center, accepted: Array.from(alts) };
        } catch {
          return { index: -1, accepted: [] };
        }
      });
    } catch (err) {
      note("oracle", err);
    }
  }

  writeFileSync(out, `${JSON.stringify(facts, null, 2)}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
