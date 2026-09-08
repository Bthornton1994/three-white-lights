import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { descentRate, LIFT_OUTCOMES, MISS_REASONS, runLift } from '../game/lift';
import { LIFT_TUNING } from '../game/liftTuning';
import { codeOnly } from '../tuning/audit';
import { athleteRigInputsFrom, rigInputPaths, rigInputValues } from './athleteRig';
import {
  ATHLETE_TRACE_DIR,
  ATHLETE_TRACE_SCENARIOS,
  ATHLETE_TRACE_SEED,
  athleteTrace,
  athleteTraceFileName,
  athleteTraceScript,
  athleteTraceTicks,
  athleteTraces,
  serializeAthleteTrace,
  type AthleteTrace,
} from './athleteTraces';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CORPUS_DIR = path.join(REPO_ROOT, ATHLETE_TRACE_DIR);
const TOOL = path.join(REPO_ROOT, 'tools/athleteTraces.mjs');
const RAW = readFileSync(new URL('./athleteTraces.ts', import.meta.url), 'utf8');
const CODE = codeOnly(RAW);

/** Deadlift's miss, unreachable by a squat by construction — the one member the corpus does not carry. */
const DEADLIFT_ONLY_MISS = 'dropped';

function tool(args: readonly string[]): { status: number | null; stdout: string; stderr: string } {
  const run = spawnSync(process.execPath, [TOOL, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
  return { status: run.status, stdout: run.stdout, stderr: run.stderr };
}

/** Drive every scenario once per file; the corpus is deterministic so the cache cannot lie. */
let corpus: readonly AthleteTrace[] | null = null;
function traces(): readonly AthleteTrace[] {
  if (corpus === null) corpus = athleteTraces();
  return corpus;
}

describe('the scenarios reach the outcomes they name, through the real mechanic', () => {
  it('drives every scenario to its expected outcome and miss reason', () => {
    expect(ATHLETE_TRACE_SCENARIOS.length, 'scenarios').toBe(6);
    expect(new Set(ATHLETE_TRACE_SCENARIOS.map((s) => s.id)).size, 'unique ids').toBe(6);
    for (const trace of traces()) {
      const { scenario, summary, ticks } = trace;
      expect(summary.outcome, `${scenario.id} outcome`).toBe(scenario.expects.outcome);
      expect(summary.missReason, `${scenario.id} miss reason`).toBe(scenario.expects.missReason);
      expect(ticks.at(-1)?.presentation.complete, `${scenario.id} resolved`).toBe(true);
      expect(ticks.at(-1)?.presentation.phase, `${scenario.id} final phase`).toBe('RESOLVED');
      // NON-VACUITY: a rep, not a stub. The shortest (buried at a limit load) is 110 ticks.
      expect(ticks.length, `${scenario.id} ticks`).toBeGreaterThan(60);
      expect(trace.config.seed).toBe(ATHLETE_TRACE_SEED);
      expect(trace.config.kind).toBe('squat');
      expect(trace.totalKg, `${scenario.id} bar`).toBeGreaterThan(0);
    }
  });

  it('covers every squat-reachable miss reason and every outcome, exactly', () => {
    const reasons = new Set(traces().map((t) => t.summary.missReason).filter((r) => r !== null));
    const squatReasons = MISS_REASONS.filter((r) => r !== DEADLIFT_ONLY_MISS);
    expect([...reasons].sort()).toEqual([...squatReasons].sort());
    const outcomes = new Set(traces().map((t) => t.summary.outcome));
    expect([...outcomes].sort()).toEqual([...LIFT_OUTCOMES].sort());
  });

  it('every trace walks BRACE → DESCENT and the makes reach LOCKOUT; the buried miss never leaves the hole', () => {
    for (const trace of traces()) {
      const phases = trace.summary.phases;
      expect(phases.slice(0, 2), `${trace.scenario.id} opens`).toEqual(['BRACE', 'DESCENT']);
      if (trace.summary.outcome !== 'miss') {
        expect(phases, `${trace.scenario.id} locks out`).toContain('LOCKOUT');
      }
    }
    const buried = traces().find((t) => t.scenario.id === 'buried-miss')!;
    expect(buried.summary.phases).not.toContain('ASCENT');
    // `barHeight` floors at 0 (the contract: 0 = bottom of the hole); `depth`
    // is what keeps going. The buried rep's descent runs to the collapse depth.
    expect(buried.summary.minBarHeight).toBe(0);
    expect(Math.max(...buried.ticks.map((t) => t.presentation.depth)), 'depth ran past the authored bottom').toBeGreaterThanOrEqual(
      LIFT_TUNING.DEPTH_COLLAPSE.squat,
    );
    const grinding = traces().find((t) => t.scenario.id === 'grinding-make')!;
    expect(grinding.summary.grindTicks, 'the grinding make grinds').toBeGreaterThan(0);
    const clean = traces().find((t) => t.scenario.id === 'clean-make')!;
    expect(clean.summary.grindTicks, 'the clean make does not').toBe(0);
  });

  it('threads the true prior: the first tick has no motion sample, every later tick does', () => {
    for (const trace of traces()) {
      const [first, ...rest] = trace.ticks;
      expect(first?.presentation.motionSampleValid, `${trace.scenario.id} tick 0`).toBe(false);
      expect(rest.every((t) => t.presentation.motionSampleValid), `${trace.scenario.id} later ticks`).toBe(true);
      const descending = rest.filter((t) => t.presentation.phase === 'DESCENT').slice(1);
      expect(descending.length, `${trace.scenario.id} descent ticks`).toBeGreaterThan(5);
      // Every descent tick reads a falling bar — or a bar already on the
      // floor of the contract's height range (the buried rep: depth keeps
      // going while `barHeight` sits at 0, so Δheight is 0 there, honestly).
      const falling = descending.filter((t) => t.rig.barVelocity < 0);
      expect(falling.length, `${trace.scenario.id} falling ticks`).toBeGreaterThan(5);
      expect(
        descending.every((t) => t.rig.barVelocity < 0 || t.presentation.barHeight === 0),
        `${trace.scenario.id} a descent tick read as rising`,
      ).toBe(true);
    }
  });
});

describe('the script is the mechanic’s own, not a transcription', () => {
  it('the drive press lands at the armed cue’s ideal tick plus the scenario’s offset', () => {
    let driven = 0;
    for (const scenario of ATHLETE_TRACE_SCENARIOS) {
      const script = athleteTraceScript(scenario);
      if (scenario.driveOffsetTicks === null) {
        expect(script.some((s, i) => i > 0 && s.kind === 'press'), `${scenario.id} answers no drive`).toBe(false);
        continue;
      }
      driven += 1;
      // The oracle: play the rep WITHOUT the drive and read the cue the engine armed.
      const probe = runLift({ kind: 'squat', loadRatio: scenario.loadRatio, seed: ATHLETE_TRACE_SEED }, script.slice(0, 2));
      const open = probe.history.find((s) => s.events.some((e) => e.kind === 'drive-cue-open'));
      expect(open?.activeCue?.idealTick, `${scenario.id} armed a drive cue`).toBeTypeOf('number');
      expect(script[2]?.tick, `${scenario.id} drive tick`).toBe(open!.activeCue!.idealTick + scenario.driveOffsetTicks);
      expect(script[2]?.kind).toBe('press');
    }
    expect(driven, 'scenarios that answer a drive').toBe(4);
  });

  it('the release lands where the descent rate puts the named depth', () => {
    for (const scenario of ATHLETE_TRACE_SCENARIOS) {
      const script = athleteTraceScript(scenario);
      expect(script[0]?.kind).toBe('press');
      if (scenario.releaseDepth === null) {
        expect(script.length, `${scenario.id} never releases`).toBe(1);
        continue;
      }
      const depth = scenario.releaseDepth === 'ideal' ? LIFT_TUNING.DEPTH_IDEAL.squat : scenario.releaseDepth;
      expect(script[1]).toEqual({
        tick: script[0]!.tick + Math.round(depth / descentRate(scenario.loadRatio, 'squat')),
        kind: 'release',
      });
      // The engine agrees: on the release tick the rep is at (or one tick past) that depth.
      const rep = runLift({ kind: 'squat', loadRatio: scenario.loadRatio, seed: ATHLETE_TRACE_SEED }, script);
      const atRelease = rep.history.find((s) => s.tick === script[1]!.tick);
      expect(atRelease?.depth, `${scenario.id} depth at release`).toBeCloseTo(depth, 1);
    }
  });

  it('a scenario that asks for a drive the engine never arms is an error, not a silent shorter script', () => {
    // A release past the collapse depth: the rep is buried before any ascent,
    // so the engine arms no drive cue — and the scenario asked for one.
    const pastCollapse = LIFT_TUNING.DEPTH_COLLAPSE.squat + 0.05;
    expect(() =>
      athleteTraceScript({ ...ATHLETE_TRACE_SCENARIOS[0]!, id: 'probe', releaseDepth: pastCollapse, driveOffsetTicks: 0 }),
    ).toThrow(/armed no drive cue/);
    // NON-VACUITY: one tick shallower, still past the authored bottom, the cue arms and the script is three inputs.
    const shallower = { ...ATHLETE_TRACE_SCENARIOS[0]!, id: 'probe', releaseDepth: 1.1, driveOffsetTicks: 0 };
    expect(athleteTraceScript(shallower).length).toBe(3);
  });
});

describe('every recorded tick is the binding of its own contract tick', () => {
  it('rig equals athleteRigInputsFrom(presentation) and the write list is the whole spec, on every tick', () => {
    const paths = rigInputPaths();
    let ticksChecked = 0;
    for (const trace of traces()) {
      for (const tick of trace.ticks) {
        expect(tick.rig).toEqual(athleteRigInputsFrom(tick.presentation));
        const writes = rigInputValues(tick.rig);
        expect(writes.map((w) => w.path)).toEqual(paths);
        for (const w of writes) {
          if (w.type === 'enum') expect(w.values, `${w.path} = ${w.value}`).toContain(w.value);
        }
        ticksChecked += 1;
      }
    }
    expect(ticksChecked, 'ticks checked').toBeGreaterThan(900);
  });

  it('the plates on every tick are the bar’s own load, and the bar is the demo lifter’s', () => {
    for (const trace of traces()) {
      expect(trace.totalKg, `${trace.scenario.id}`).toBe(trace.ticks[0]!.presentation.load.totalKg);
      expect(trace.ticks.every((t) => t.rig.totalKg === trace.totalKg)).toBe(true);
      expect(trace.ticks.every((t) => t.rig.platesOverflow === 0), `${trace.scenario.id} fits the sleeve`).toBe(true);
      expect(trace.ticks[0]!.rig.plates.filter((p) => p.on).length, `${trace.scenario.id} shows plates`).toBeGreaterThan(0);
    }
  });
});

describe('the module hand-authors nothing', () => {
  it('imports the mechanic, calls the contract and the binding once each, and constructs no kinematic field', () => {
    const imports = [...RAW.matchAll(/from '([^']+)'/g)].map((m) => m[1] ?? '');
    expect(imports).toContain('../game/lift');
    expect(imports).toContain('../game/liftPresentation');
    expect(imports).toContain('./athleteRig');
    expect((CODE.match(/\brunLift\(/g) ?? []).length, 'runLift call sites').toBe(2);
    expect((CODE.match(/\bliftPresentation\(/g) ?? []).length).toBe(1);
    expect((CODE.match(/\bathleteRigInputsFrom\(/g) ?? []).length).toBe(1);
    // A kinematic field in KEY position is an authored value. The summary
    // READS them (`presentation.barHeight`); nothing here writes one.
    const authored = CODE.match(/\b(barHeight|barVelocity|integratorVelocity|strain|grindIntensity|effortBand|depth|phase|height|velocity)\s*:/g) ?? [];
    expect(authored, 'kinematic keys written in the module').toEqual([]);
    // NON-VACUITY: the identifiers do appear (as reads), so the ban had a subject.
    expect(/\bpresentation\.barHeight\b/.test(CODE)).toBe(true);
  });

  it('the prior handed to the contract is the previous state, never null after the first tick and never the current one', () => {
    expect(CODE).toMatch(/liftPresentation\(state, totalKg, prior\)/);
    expect(CODE).toMatch(/prior = state;/);
  });
});

describe('the committed corpus is what the mechanic produces today', () => {
  it('holds exactly one generated file per scenario plus the generated README, byte for byte', () => {
    const expected = new Map<string, string>();
    for (const trace of traces()) expected.set(athleteTraceFileName(trace.scenario), serializeAthleteTrace(trace));
    const onDisk = readdirSync(CORPUS_DIR).sort();
    expect(onDisk).toEqual([...expected.keys(), 'README.md'].sort());
    for (const [name, content] of expected) {
      const actual = readFileSync(path.join(CORPUS_DIR, name), 'utf8');
      expect(actual === content, `${name} differs from the mechanic's output — run: node tools/athleteTraces.mjs write`).toBe(true);
    }
  });

  it('parses back to the trace, and its own config + script reproduce its own ticks', () => {
    for (const trace of traces()) {
      const parsed = JSON.parse(readFileSync(path.join(CORPUS_DIR, athleteTraceFileName(trace.scenario)), 'utf8')) as AthleteTrace;
      expect(parsed).toEqual(trace);
      const replayed = athleteTraceTicks(parsed.config, parsed.script, parsed.totalKg);
      expect(replayed).toEqual(parsed.ticks);
    }
  });

  it('node tools/athleteTraces.mjs check is green on the tree, and red on a drifted, missing or stray file', () => {
    const green = tool(['check']);
    expect(green.status, green.stdout + green.stderr).toBe(0);
    expect(green.stdout).toContain('ATHLETE_TRACES_CURRENT');

    const scratch = mkdtempSync(path.join(tmpdir(), 'athlete-traces-'));
    try {
      cpSync(CORPUS_DIR, scratch, { recursive: true });
      const same = tool(['check', '--dir', scratch]);
      expect(same.status, 'a copy is current').toBe(0);

      const target = path.join(scratch, athleteTraceFileName(ATHLETE_TRACE_SCENARIOS[0]!));
      const text = readFileSync(target, 'utf8');
      // One number in one tick — the smallest drift a retune could produce.
      writeFileSync(target, text.replace(/"barHeight":([0-9.]+)/, (_m, n: string) => `"barHeight":${Number(n) + 0.001}`));
      const drifted = tool(['check', '--dir', scratch]);
      expect(drifted.status).toBe(1);
      expect(drifted.stdout).toContain('DRIFT');
      expect(drifted.stdout).toContain('ATHLETE_TRACES_DRIFT');

      writeFileSync(target, text);
      writeFileSync(path.join(scratch, 'notes.json'), '{}');
      const stray = tool(['check', '--dir', scratch]);
      expect(stray.status).toBe(1);
      expect(stray.stdout).toContain('STRAY    notes.json');

      rmSync(path.join(scratch, 'notes.json'));
      rmSync(target);
      const missing = tool(['check', '--dir', scratch]);
      expect(missing.status).toBe(1);
      expect(missing.stdout).toContain('MISSING');
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });

  it('node tools/athleteTraces.mjs write reproduces the committed bytes, and replay reproduces each record', () => {
    const scratch = mkdtempSync(path.join(tmpdir(), 'athlete-traces-write-'));
    try {
      const written = tool(['write', '--dir', scratch]);
      expect(written.status, written.stderr).toBe(0);
      for (const name of readdirSync(CORPUS_DIR)) {
        expect(readFileSync(path.join(scratch, name), 'utf8')).toBe(readFileSync(path.join(CORPUS_DIR, name), 'utf8'));
      }
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
    for (const scenario of ATHLETE_TRACE_SCENARIOS) {
      const replay = tool(['replay', path.join(ATHLETE_TRACE_DIR, athleteTraceFileName(scenario))]);
      expect(replay.status, replay.stdout).toBe(0);
      expect(replay.stdout).toContain('ATHLETE_TRACE_REPRODUCES');
    }
  });

  it('replay is red on a record whose ticks no longer follow from its recipe', () => {
    const scratch = mkdtempSync(path.join(tmpdir(), 'athlete-traces-replay-'));
    try {
      const name = athleteTraceFileName(ATHLETE_TRACE_SCENARIOS[1]!);
      const record = JSON.parse(readFileSync(path.join(CORPUS_DIR, name), 'utf8')) as { script: { tick: number; kind: string }[] };
      // Move the drive press by one tick and keep the recorded ticks: the recipe no longer produces them.
      record.script[2]!.tick += 1;
      const file = path.join(scratch, name);
      writeFileSync(file, JSON.stringify(record));
      const replay = tool(['replay', file]);
      expect(replay.status).toBe(1);
      expect(replay.stdout).toContain('ATHLETE_TRACE_DIVERGED');
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });
});
