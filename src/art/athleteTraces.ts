/**
 * athleteTraces — the canonical squat input corpus, driven out of the real
 * mechanic and recorded tick by tick through the frozen presentation contract
 * and the rig binding.
 *
 * ---------------------------------------------------------------------------
 * WHAT A TRACE IS, AND WHAT IT IS NOT
 * ---------------------------------------------------------------------------
 * A trace is one scripted squat rep — `runLift(config, script)` from
 * `src/game/lift.ts`, the same function the mechanics lane's own tests and
 * `src/lift/liftReplay.ts` replay reps with — read every tick through
 * `liftPresentation(state, totalKg, prior)` with `prior` the immediately
 * preceding state, and then through `athleteRigInputsFrom`. The record is what
 * the production athlete stage would write to the `.riv` on that tick, and
 * the contract tick it wrote it from.
 *
 * NOTHING HERE IS AUTHORED. There is no pose curve, no keyframe, no
 * hand-written `barHeight`. The only synthetic things in a trace are the
 * SCRIPT — which tick the finger went down or came up — and the seed, and
 * both are written into the record so the trace is reproducible from the
 * file alone. The script itself is read off the mechanic rather than
 * transcribed: the drive press lands relative to the tick the engine's own
 * drive cue calls ideal, found by playing the rep once without it, the way
 * `lift.test.ts`'s `driveIdealTick` does. `athleteTraces.test.ts` scans this
 * file for a constructed contract field and pins the committed corpus to
 * what this module produces today, byte for byte.
 *
 * Squat only, on purpose: the v1 athlete is squat-only by ruling, and bench
 * and deadlift stay blocked until the human opens them.
 *
 * `docs/design/athlete-traces/` holds the record; `tools/athleteTraces.mjs`
 * writes and checks it.
 */
import {
  braceTicks,
  descentRate,
  runLift,
  type LiftConfig,
  type LiftOutcome,
  type LiftPhase,
  type LiftState,
  type MissReason,
  type ScriptedInput,
} from '../game/lift';
import { liftPresentation, type LiftPresentationState } from '../game/liftPresentation';
import { LIFT_TUNING } from '../game/liftTuning';
import { totalKgFor } from '../lift/liftFrame';
import { athleteRigInputsFrom, type AthleteRigInputs } from './athleteRig';

/**
 * One scenario: a load, a release rule, a drive rule, and the outcome the
 * mechanic is expected to hand back. The expectation is a CLAIM the test
 * checks against the engine, not an input to it — if the mechanics lane
 * retunes and a scenario stops reaching its outcome, the test says so.
 */
export interface AthleteTraceScenario {
  readonly id: string;
  readonly title: string;
  /** The script, in the mechanic's own terms. */
  readonly how: string;
  /** Attempt weight over the demo lifter's best single. */
  readonly loadRatio: number;
  /**
   * Depth (0 = standing, 1 = the authored bottom) the finger comes up at.
   * `'ideal'` is `LIFT_TUNING.DEPTH_IDEAL.squat`; null never releases.
   */
  readonly releaseDepth: number | 'ideal' | null;
  /**
   * Ticks from the tick the engine's own drive cue calls ideal to the drive
   * press. Null answers no drive cue at all.
   */
  readonly driveOffsetTicks: number | null;
  readonly expects: {
    readonly outcome: LiftOutcome;
    readonly missReason: MissReason | null;
  };
}

/**
 * The seed every trace runs on: the seed `LiftScreen` gives a player's FIRST
 * rep (`liftReplay.ts`'s `CAPTURE_SEED` makes the same choice), so the corpus
 * is the rep a player would actually get, not a specially seeded one. The
 * demo best single is also what `totalKg` is derived from.
 */
export const ATHLETE_TRACE_BEST_SINGLE_KG = LIFT_TUNING.DEMO.BEST_SINGLE_KG;
export const ATHLETE_TRACE_SEED = LIFT_TUNING.DEMO.BEST_SINGLE_KG;

/** Where the record lives, repository-relative. */
export const ATHLETE_TRACE_DIR = 'docs/design/athlete-traces';

/**
 * THE SCENARIOS. Loads are the screen's own choices (`LIFT_TUNING.DEMO.
 * LOAD_CHOICES`) where one reaches the outcome; the two that are not — the
 * timeout's load and its buried reversal — are the parameters the mechanic's
 * own reachability test (`lift.test.ts`, "reaches every miss reason")
 * searches, because that miss is rare by design and no screen load reaches
 * it from an ideal depth.
 */
export const ATHLETE_TRACE_SCENARIOS: readonly AthleteTraceScenario[] = Object.freeze([
  Object.freeze<AthleteTraceScenario>({
    id: 'clean-make',
    title: 'Clean make',
    how: 'press at brace end; release on the tick the depth cue calls ideal; press on the tick the drive cue calls ideal; hold.',
    loadRatio: 0.75,
    releaseDepth: 'ideal',
    driveOffsetTicks: 0,
    expects: { outcome: 'good-lift', missReason: null },
  }),
  Object.freeze<AthleteTraceScenario>({
    id: 'grinding-make',
    title: 'Grinding make',
    how: 'a limit attempt; ideal depth; the drive answered two ticks late, so the bar stalls at the stick and is fought through.',
    loadRatio: 1.0,
    releaseDepth: 'ideal',
    driveOffsetTicks: 2,
    expects: { outcome: 'grind', missReason: null },
  }),
  Object.freeze<AthleteTraceScenario>({
    id: 'no-depth-miss',
    title: 'No-depth miss',
    how: 'released at half depth, above legal, then driven perfectly: a high squat that locks out and is called.',
    loadRatio: 0.88,
    releaseDepth: 0.5,
    driveOffsetTicks: 0,
    expects: { outcome: 'miss', missReason: 'no-depth' },
  }),
  Object.freeze<AthleteTraceScenario>({
    id: 'stalled-miss',
    title: 'Stalled miss',
    how: 'a limit attempt to ideal depth with the drive cue never answered: the bar wins at the stick.',
    loadRatio: 1.0,
    releaseDepth: 'ideal',
    driveOffsetTicks: null,
    expects: { outcome: 'miss', missReason: 'stalled' },
  }),
  Object.freeze<AthleteTraceScenario>({
    id: 'buried-miss',
    title: 'Buried miss',
    how: 'a limit attempt where the finger never comes up: the descent runs past the collapse depth.',
    loadRatio: 1.0,
    releaseDepth: null,
    driveOffsetTicks: null,
    expects: { outcome: 'miss', missReason: 'buried' },
  }),
  Object.freeze<AthleteTraceScenario>({
    id: 'timeout-miss',
    title: 'Timeout miss',
    how: 'near-limit load, reversal from a buried depth, the drive one tick early: the bar creeps until the ascent clock runs out.',
    loadRatio: 0.94,
    releaseDepth: 1.28,
    driveOffsetTicks: -1,
    expects: { outcome: 'miss', missReason: 'timeout' },
  }),
]);

/** One recorded tick: the contract, and the binding of it. */
export interface AthleteTraceTick {
  readonly presentation: LiftPresentationState;
  readonly rig: AthleteRigInputs;
}

export interface AthleteTraceSummary {
  readonly ticks: number;
  readonly outcome: LiftOutcome | null;
  readonly missReason: MissReason | null;
  /** Phases in order of first appearance. */
  readonly phases: readonly LiftPhase[];
  /** Ticks on which the contract reports any grind. */
  readonly grindTicks: number;
  readonly minBarHeight: number;
  readonly maxStrain: number;
}

export interface AthleteTrace {
  readonly scenario: AthleteTraceScenario;
  readonly config: LiftConfig;
  readonly script: readonly ScriptedInput[];
  readonly bestSingleKg: number;
  readonly totalKg: number;
  readonly summary: AthleteTraceSummary;
  readonly ticks: readonly AthleteTraceTick[];
}

/** Squat only — see the header. The v1 athlete is squat-only by ruling. */
const TRACE_KIND = 'squat';

export function athleteTraceConfig(scenario: AthleteTraceScenario): LiftConfig {
  return { kind: TRACE_KIND, loadRatio: scenario.loadRatio, seed: ATHLETE_TRACE_SEED };
}

/** The tick the engine's own drive cue calls ideal on this rep, or null if it never arms one. */
function armedDriveIdealTick(config: LiftConfig, script: readonly ScriptedInput[]): number | null {
  for (const state of runLift(config, script).history) {
    if (state.events.some((event) => event.kind === 'drive-cue-open')) {
      return state.activeCue?.idealTick ?? null;
    }
  }
  return null;
}

/**
 * The script, read off the mechanic. Throws when a scenario asks for a drive
 * the engine never arms — a trace that silently dropped its drive press would
 * be a different scenario wearing this one's name.
 */
export function athleteTraceScript(scenario: AthleteTraceScenario): readonly ScriptedInput[] {
  const config = athleteTraceConfig(scenario);
  const press = braceTicks(scenario.loadRatio, TRACE_KIND) + 1;
  const script: ScriptedInput[] = [{ tick: press, kind: 'press' }];
  if (scenario.releaseDepth === null) return script;

  const depth =
    scenario.releaseDepth === 'ideal' ? LIFT_TUNING.DEPTH_IDEAL[TRACE_KIND] : scenario.releaseDepth;
  script.push({
    tick: press + Math.round(depth / descentRate(scenario.loadRatio, TRACE_KIND)),
    kind: 'release',
  });
  if (scenario.driveOffsetTicks === null) return script;

  const ideal = armedDriveIdealTick(config, script);
  if (ideal === null) {
    throw new Error(`scenario ${scenario.id} asks for a drive and the engine armed no drive cue`);
  }
  script.push({ tick: ideal + scenario.driveOffsetTicks, kind: 'press' });
  return script;
}

/**
 * Replay a recorded recipe — config and script, as the file carries them —
 * through the contract and the binding. `athleteTrace` is this on a
 * scenario's own recipe; the acceptance harness is this on the file's.
 */
export function athleteTraceTicks(
  config: LiftConfig,
  script: readonly ScriptedInput[],
  totalKg: number,
): readonly AthleteTraceTick[] {
  const ticks: AthleteTraceTick[] = [];
  let prior: LiftState | null = null;
  for (const state of runLift(config, script).history) {
    const presentation = liftPresentation(state, totalKg, prior);
    ticks.push({ presentation, rig: athleteRigInputsFrom(presentation) });
    prior = state;
  }
  return ticks;
}

function summarise(ticks: readonly AthleteTraceTick[]): AthleteTraceSummary {
  const phases: LiftPhase[] = [];
  let grindTicks = 0;
  let minBarHeight = Infinity;
  let maxStrain = -Infinity;
  for (const { presentation } of ticks) {
    if (!phases.includes(presentation.phase)) phases.push(presentation.phase);
    if (presentation.grindIntensity > 0) grindTicks += 1;
    minBarHeight = Math.min(minBarHeight, presentation.barHeight);
    maxStrain = Math.max(maxStrain, presentation.strain);
  }
  const last = ticks[ticks.length - 1]?.presentation;
  return {
    ticks: ticks.length,
    outcome: last?.outcome ?? null,
    missReason: last?.missReason ?? null,
    phases,
    grindTicks,
    minBarHeight,
    maxStrain,
  };
}

/** One scenario, driven and recorded. */
export function athleteTrace(scenario: AthleteTraceScenario): AthleteTrace {
  const config = athleteTraceConfig(scenario);
  const script = athleteTraceScript(scenario);
  const totalKg = totalKgFor(config.loadRatio, ATHLETE_TRACE_BEST_SINGLE_KG);
  const ticks = athleteTraceTicks(config, script, totalKg);
  return {
    scenario,
    config,
    script,
    bestSingleKg: ATHLETE_TRACE_BEST_SINGLE_KG,
    totalKg,
    summary: summarise(ticks),
    ticks,
  };
}

/** The whole corpus, in scenario order. */
export function athleteTraces(): readonly AthleteTrace[] {
  return ATHLETE_TRACE_SCENARIOS.map(athleteTrace);
}

export function athleteTraceFileName(scenario: AthleteTraceScenario): string {
  return `${scenario.id}.json`;
}

/**
 * The record's on-disk form: the header pretty-printed, then one compact line
 * per tick, so a diff of a retuned mechanic reads as changed TICKS rather than
 * a wall of re-indented fields. `JSON.parse` reads it back as the same object.
 */
export function serializeAthleteTrace(trace: AthleteTrace): string {
  const { ticks, ...header } = trace;
  const headerJson = JSON.stringify(header, null, 2);
  const tickLines = ticks.map((tick) => `    ${JSON.stringify(tick)}`).join(',\n');
  return `${headerJson.slice(0, -1).trimEnd()},\n  "ticks": [\n${tickLines}\n  ]\n}\n`;
}
