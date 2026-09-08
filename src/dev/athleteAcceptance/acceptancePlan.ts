/**
 * acceptancePlan — the playback the athlete acceptance harness runs. Pure.
 *
 * Every scenario in the canonical trace corpus (`src/art/athleteTraces.ts`)
 * is re-driven through the REAL mechanic here — `runLift` on the scenario's
 * own script — so the harness hands `AthleteStage` the same `LiftState`
 * sequence a played rep would, one tick at a time, with the true `history`.
 * Nothing is read back from the JSON records: the corpus test pins those to
 * this same engine, and the stage is what is under test, not the file.
 */
import { runLift, type LiftState } from '../../game/lift';
import {
  ATHLETE_TRACE_BEST_SINGLE_KG,
  ATHLETE_TRACE_SCENARIOS,
  athleteTraceConfig,
  athleteTraceScript,
  type AthleteTraceScenario,
} from '../../art/athleteTraces';
import { totalKgFor } from '../../lift/liftFrame';
import { ACCEPTANCE_PLAYBACK } from '../riveRuntimeSpike/spikeTuning';

export interface AcceptanceScenario {
  readonly scenario: AthleteTraceScenario;
  readonly totalKg: number;
  /** Every tick of the rep, from the first stepped state to RESOLVED. */
  readonly states: readonly LiftState[];
}

export function acceptancePlan(
  scenarios: readonly AthleteTraceScenario[] = ATHLETE_TRACE_SCENARIOS,
): readonly AcceptanceScenario[] {
  return scenarios.map((scenario) => {
    const config = athleteTraceConfig(scenario);
    return {
      scenario,
      totalKg: totalKgFor(config.loadRatio, ATHLETE_TRACE_BEST_SINGLE_KG),
      states: runLift(config, athleteTraceScript(scenario)).history,
    };
  });
}

export interface PlaybackPosition {
  readonly scenario: number;
  readonly tick: number;
  /** Ticks the resolved frame has been held so far. */
  readonly held: number;
  /** Completed passes over the whole plan. */
  readonly loops: number;
}

export const PLAYBACK_START: PlaybackPosition = Object.freeze({ scenario: 0, tick: 0, held: 0, loops: 0 });

/** One tick on: through the rep, hold at its end, then the next scenario; wrap after the last. */
export function advancePlayback(position: PlaybackPosition, plan: readonly AcceptanceScenario[]): PlaybackPosition {
  const current = plan[position.scenario];
  if (current === undefined) return PLAYBACK_START;
  const last = current.states.length - 1;
  if (position.tick < last) return { ...position, tick: position.tick + 1 };
  if (position.held < ACCEPTANCE_PLAYBACK.HOLD_TICKS_AT_END) return { ...position, held: position.held + 1 };
  const next = position.scenario + 1;
  if (next < plan.length) return { scenario: next, tick: 0, held: 0, loops: position.loops };
  return { scenario: 0, tick: 0, held: 0, loops: position.loops + 1 };
}

export interface PlaybackFrame {
  readonly scenario: AthleteTraceScenario;
  readonly state: LiftState;
  /** Every state up to and including `state` — what `useLiftLoop` hands a stage. */
  readonly history: readonly LiftState[];
  readonly totalKg: number;
  readonly tick: number;
  readonly ticks: number;
}

export function playbackFrame(plan: readonly AcceptanceScenario[], position: PlaybackPosition): PlaybackFrame | null {
  const current = plan[position.scenario];
  const state = current?.states[position.tick];
  if (current === undefined || state === undefined) return null;
  return {
    scenario: current.scenario,
    state,
    history: current.states.slice(0, position.tick + 1),
    totalKg: current.totalKg,
    tick: position.tick,
    ticks: current.states.length,
  };
}
