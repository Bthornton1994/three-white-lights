/**
 * liftReplay.ts — a scripted rep, frozen at named moments, for capture.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 * ---------------------------------------------------------------------------
 * GDD §12.2's bar for the sprite work is: "judge whether a maximal attempt
 * animates *heavier* than a light one." Judging that needs photographs of the
 * two, at the same beats, from the real renderer.
 *
 * They cannot be taken by driving pointer events at a wall clock. A limit
 * attempt is won inside a band of a few ticks (`lift.test.ts` measures it), and
 * a loaded machine running a headless browser cannot land a press inside a band
 * that narrow. Every previous attempt produced a rep that died in the descent —
 * three screenshots of the same resolved NO LIFT, which is evidence of nothing.
 *
 * So the rep is DRIVEN DETERMINISTICALLY: a script, played through `runLift`,
 * frozen at ticks chosen by what is happening at them. The renderer is the real
 * `LiftScreen`; only the clock is replaced.
 *
 * ---------------------------------------------------------------------------
 * NOTHING HERE IS HARD-CODED TO A TICK
 * ---------------------------------------------------------------------------
 * The script is read back out of the mechanic: press when the brace ends,
 * release on the tick the DEPTH cue calls ideal, press again on the tick the
 * DRIVE cue calls ideal, and hold. Every one of those is asked of `lift.ts`
 * rather than derived from `liftTuning.ts`, so the capture follows the cue
 * wherever a tuning pass moves it and cannot quietly drift into photographing a
 * rep the game is not asking the player to perform.
 *
 * The moments are chosen the same way — by predicate over the played history
 * ("the tick nearest the sticking point", "the tick the bar is losing hardest
 * on"), never by tick number.
 *
 * ---------------------------------------------------------------------------
 * NOT A GAME FEATURE
 * ---------------------------------------------------------------------------
 * Nothing in the played loop imports this. It is reachable only through the
 * debug query string `?replay=<loadRatio>&moment=<id>` (see `replayRoute.ts`),
 * and GDD §10 Prototype 1 is a throwaway build. When the mechanic ships, this
 * is where a replay clip (GDD §6.2, "bar-speed replay clip as feedback") would
 * be built from — the inputs are the recording, the states are regenerated.
 *
 * PURE. Zero React, zero I/O, zero side effects.
 */

import {
  braceTicks,
  promptFor,
  runLift,
  type CueWindow,
  type LiftConfig,
  type LiftPhase,
  type LiftState,
  type ScriptedInput,
} from '../game/lift';
import { LIFT_TUNING, STICK_HEIGHT_FRAC } from '../game/liftTuning';
import { frameKey, liftFrameSpec, totalKgFor } from './liftFrame';

/** One photographed beat of a rep. */
export type CaptureMomentId =
  | 'brace'
  | 'descent'
  | 'depth-cue'
  | 'hole'
  | 'drive-cue'
  | 'losing'
  | 'sticking-point'
  | 'lockout'
  | 'result';

/**
 * The beats, in the order they happen.
 *
 * Chosen to cover the whole rep AND, specifically, the three things a resolved
 * frame can never show: the ascent, the bar losing, and the sticking point.
 * `liftFrame.ts`'s `liveStrain` falls through to the LOCKOUT phase weighting for
 * RESOLVED, so a resolved frame draws a lifter RELAXING — it is evidence of the
 * outcome and of nothing else.
 */
export const CAPTURE_MOMENTS: readonly CaptureMomentId[] = Object.freeze([
  'brace',
  'descent',
  'depth-cue',
  'hole',
  'drive-cue',
  'losing',
  'sticking-point',
  'lockout',
  'result',
]);

/**
 * The phase each moment must be in.
 *
 * The verifier checks the captured frames against this. A hash comparison
 * already let a sequence of three identical resolved frames through once; a
 * phase comparison would not have.
 */
export const CAPTURE_MOMENT_PHASE: Readonly<Record<CaptureMomentId, LiftPhase>> = Object.freeze({
  brace: 'BRACE',
  descent: 'DESCENT',
  'depth-cue': 'DESCENT',
  hole: 'HOLE',
  'drive-cue': 'ASCENT',
  losing: 'ASCENT',
  'sticking-point': 'ASCENT',
  lockout: 'LOCKOUT',
  result: 'RESOLVED',
});

/** Which rep to photograph, and at which beat. */
export interface ReplayRequest {
  readonly loadRatio: number;
  readonly moment: CaptureMomentId;
}

/** One frozen tick, with the history the bar-path plot would have drawn by then. */
export interface CaptureFrame {
  readonly moment: CaptureMomentId;
  readonly state: LiftState;
  readonly history: readonly LiftState[];
}

/**
 * Seed for every captured rep, so two captures of the same beat are the same
 * image. Deliberately the seed `LiftScreen` gives its FIRST rep, so a captured
 * sequence is the rep a player would actually get on opening the app rather
 * than a specially-seeded one.
 */
export const CAPTURE_SEED = LIFT_TUNING.DEMO.BEST_SINGLE_KG;

// SQUAT ONLY. This capture tool exists for `squatAnimation.ts`'s sprite-work
// evidence (GDD §12.2) and predates bench's phase model; it is not the
// player-reachable session path. Widen alongside a bench capture pass if one
// is ever needed, rather than defaulting silently.
function configFor(loadRatio: number): LiftConfig {
  return { kind: 'squat', loadRatio, seed: CAPTURE_SEED };
}

/** The cue the mechanic itself armed, read out of a played rep. */
function armedCue(
  config: LiftConfig,
  script: readonly ScriptedInput[],
  cue: 'depth' | 'drive',
): CueWindow | null {
  for (const state of runLift(config, script).history) {
    const active = state.activeCue;
    if (active !== null && active.cue === cue) return active;
  }
  return null;
}

/**
 * The rep a player who obeys both cues perfectly would produce.
 *
 * Press when the brace ends; release on the tick the depth cue calls ideal;
 * press again on the tick the drive cue calls ideal; never let go. At every
 * load choice on the screen this is a make, which is the point — a capture that
 * has to be a miss cannot photograph a lockout.
 */
export function captureScript(loadRatio: number): ScriptedInput[] {
  const config = configFor(loadRatio);
  const script: ScriptedInput[] = [{ tick: braceTicks(loadRatio, 'squat') + 1, kind: 'press' }];

  const depthCue = armedCue(config, script, 'depth');
  if (depthCue === null) return script;
  script.push({ tick: depthCue.idealTick, kind: 'release' });

  const driveCue = armedCue(config, script, 'drive');
  if (driveCue === null) return script;
  script.push({ tick: driveCue.idealTick, kind: 'press' });
  return script;
}

function pick(
  states: readonly LiftState[],
  keep: (state: LiftState) => boolean,
  score?: (state: LiftState) => number,
): LiftState | null {
  const matching = states.filter(keep);
  if (matching.length === 0) return null;
  if (score === undefined) return matching[0] ?? null;
  let best = matching[0] ?? null;
  let bestScore = Infinity;
  for (const state of matching) {
    const value = score(state);
    if (value < bestScore) {
      bestScore = value;
      best = state;
    }
  }
  return best;
}

/**
 * The state each moment names, from one played rep.
 *
 * Returns null for a moment this particular rep never reached, so a miss is
 * reported as a missing frame rather than silently substituting whatever the
 * rep ended on. That substitution is exactly how three copies of one resolved
 * frame got captured as a "maximal sequence".
 */
export function captureFrames(loadRatio: number): CaptureFrame[] {
  const config = configFor(loadRatio);
  const replay = runLift(config, captureScript(loadRatio));
  const all = replay.history;
  const ascent = all.filter((s) => s.phase === 'ASCENT');

  const chosen: Partial<Record<CaptureMomentId, LiftState | null>> = {
    // The last braced tick: set, loaded, nothing asked for yet.
    brace: pick(all, (s) => s.phase === 'BRACE', (s) => -s.tick),
    // Halfway down.
    descent: descentMidpoint(all),
    // The tick the depth window opens on.
    'depth-cue': pick(all, (s) => s.events.some((e) => e.kind === 'depth-cue-open')),
    // The bottom of the hole, at the end of the reversal beat.
    hole: pick(all, (s) => s.phase === 'HOLE', (s) => -s.tick),
    // The tick the drive window opens on — the cue ring is up.
    'drive-cue': pick(all, (s) => s.events.some((e) => e.kind === 'drive-cue-open')),
    // The tick the bar is losing hardest. On a limit attempt this is the grind.
    losing: pick(ascent, () => true, (s) => s.netForce),
    // The tick the bar is nearest the height the sprite system draws a stall at.
    'sticking-point': pick(ascent, () => true, (s) => Math.abs(s.height - STICK_HEIGHT_FRAC.squat)),
    lockout: pick(all, (s) => s.phase === 'LOCKOUT'),
    result: pick(all, (s) => s.phase === 'RESOLVED'),
  };

  const frames: CaptureFrame[] = [];
  for (const moment of CAPTURE_MOMENTS) {
    const state = chosen[moment] ?? null;
    if (state === null) continue;
    const index = all.indexOf(state);
    frames.push({ moment, state, history: all.slice(0, index + 1) });
  }
  return frames;
}

function descentMidpoint(all: readonly LiftState[]): LiftState | null {
  const descent = all.filter((s) => s.phase === 'DESCENT');
  if (descent.length === 0) return null;
  return descent[Math.floor(descent.length / 2)] ?? null;
}

/** The frame a debug request names, or null if this rep never reached it. */
export function captureFrameFor(request: ReplayRequest): CaptureFrame | null {
  return captureFrames(request.loadRatio).find((f) => f.moment === request.moment) ?? null;
}

/**
 * Everything about a frame that makes it SEMANTICALLY distinct from another.
 *
 * Emitted into the DOM off-screen so a capture harness can read what a shot
 * actually shows instead of hashing its bytes. Byte inequality already passed
 * on a sequence of three identical resolved frames that differed only by a
 * dev-menu glyph; this is the check that would have failed.
 */
export function replayProbe(frame: CaptureFrame): Record<string, string | number | boolean> {
  const state = frame.state;
  const totalKg = totalKgFor(state.config.loadRatio, CAPTURE_SEED);
  const spec = liftFrameSpec(state, totalKg);
  return {
    moment: frame.moment,
    loadRatio: state.config.loadRatio,
    totalKg,
    tick: state.tick,
    phase: state.phase,
    prompt: promptFor(state),
    depth: state.depth,
    height: state.height,
    velocity: state.velocity,
    netForce: state.netForce,
    stallTicks: state.stallTicks,
    ascentTicks: state.ascentTicks,
    driveQuality: state.driveQuality,
    strainLevel: spec.strainLevel,
    pitchLevel: spec.pitchLevel ?? 0,
    barLateralPx: spec.barLateralPx,
    barTiltDeg: spec.barTiltDeg,
    barForwardPx: state.barForwardPx,
    /**
     * The renderer's own cache key for this drawing. Two shots with different
     * keys MUST be different pixels inside the stage — that is the check that
     * catches a renderer showing a stale frame, which is a failure a probe
     * taken from the model alone could never see.
     */
    frameKey: frameKey(spec),
    cueOpen: state.activeCue !== null,
    outcome: state.resolution === null ? '' : state.resolution.outcome,
    historyTicks: frame.history.length,
  };
}

/** The probe, as one string, because a Text node is what a DOM query can read. */
export function replayProbeJson(frame: CaptureFrame): string {
  return JSON.stringify(replayProbe(frame));
}
