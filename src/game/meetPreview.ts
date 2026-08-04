/**
 * meetPreview.ts — DEBUG ONLY. Builds a `MeetDayState` frozen at one beat of
 * meet day, so the real screens can be photographed at moments a wall clock and
 * a headless browser cannot reliably hit.
 *
 * WHY THIS EXISTS. The same reason `src/session/sessionPreview.ts` and
 * `src/lift/liftReplay.ts` do, and more so: a third attempt is nine attempts
 * and a dozen timing inputs past the weigh-in, a limit attempt is won inside a
 * band of a few ticks, and a headless browser on a loaded machine cannot land a
 * press inside a band that narrow. Driving meet day with pointer events to
 * photograph its bomb-out beat produces a photograph of a meet that bombed the
 * squat by accident — which is evidence of a broken harness, not of the screen.
 *
 * WHAT IT IS NOT: a second renderer or a mock. It drives the SAME
 * `stepMeetDay` the played loop runs on, hands the resulting state to the same
 * components, and — this is the part that matters — its rep outcomes are
 * produced by PLAYING THE REAL MECHANIC through `runLift` with scripted inputs,
 * not by fabricating a `LiftResolution`. So a "close call" here is a rep that
 * really did land at the edge of the depth window, and the margin the judging
 * model reads off it is the margin a player would have earned.
 *
 * NOTHING IS HARD-CODED TO A TICK. Every script is read back out of the
 * mechanic — press when the brace ends, release on the tick the depth cue calls
 * ideal (or at its edge, or before it opens), press on the tick the drive cue
 * calls ideal — exactly as `liftReplay.ts` does, so these follow the cue
 * wherever a tuning pass moves it.
 *
 * PURE. Zero React, zero I/O, no clock — the day is `MEET_PREVIEW.DAY`, a fixed
 * index, so every number below it is stable across runs. Nothing in the played
 * app reaches this module; it is entered from the `?meet=` query string in
 * `App.tsx` and nowhere else.
 */

import { braceTicks, runLift, type CueWindow, type LiftConfig, type LiftResolution, type ScriptedInput } from './lift';
import { EMPTY_FATIGUE_STATE } from './fatigue';
import { LIFT_ORDER, type LiftKind } from './meet';
import {
  attemptConfigFor,
  attemptDecisionFor,
  createMeetDay,
  stepMeetDay,
  type MeetDayContext,
  type MeetDayState,
} from './meetDay';
import { MEET_ENTRY, MEET_LOCAL, MEET_PREVIEW } from './meetTuning';

/** The beats a preview can be frozen on. In loop order. */
export type MeetMomentId =
  /** GDD §6.1's weigh-in beat. What the meet opens on. */
  | 'weigh-in'
  /** GDD §6.1's openers, pre-filled from e1RM. */
  | 'openers'
  /** GDD §6.2 step 1 on an opening squat: the bar loads and is walked out. */
  | 'walkout'
  /**
   * The same beat on a THIRD attempt with nothing banked — the longest hold in
   * the piece, and the one GDD §12.2 judges.
   */
  | 'walkout-third'
  /** The attempt live on the platform (GDD §6.2 steps 2-3). */
  | 'lift'
  /** GDD §6.2 step 4: the judges taking a beat, no lights showing. */
  | 'deliberation'
  /** Three white lights. */
  | 'verdict-good'
  /** Two to one — the split panel a deliberation can end on. */
  | 'verdict-split'
  /** Three reds. */
  | 'verdict-no-lift'
  /**
   * Two to one AGAINST — a high squat the lifter thought they had. The proof
   * that the deliberation beat is not a tell: it precedes this too.
   */
  | 'verdict-split-red'
  /** GDD §6.3's choice after a make: a small increase vs a big one. */
  | 'select-after-make'
  /** GDD §6.3's choice after a miss: repeat vs go past it. THE BITE. */
  | 'select-after-miss'
  /** GDD §6.3's somber moment. */
  | 'bombed'
  /** GDD §6.5's recap. */
  | 'recap'
  /** The shareable card the recap hands off to (GDD §6.5, S3). */
  | 'recap-card';

export const MEET_MOMENTS = Object.freeze([
  'weigh-in',
  'openers',
  'walkout',
  'walkout-third',
  'lift',
  'deliberation',
  'verdict-good',
  'verdict-split',
  'verdict-no-lift',
  'verdict-split-red',
  'select-after-make',
  'select-after-miss',
  'bombed',
  'recap',
  'recap-card',
] as const satisfies readonly MeetMomentId[]);

export interface MeetPreviewRequest {
  readonly moment: MeetMomentId;
}

/** True when `value` names a beat this module can build. */
export function isMeetMoment(value: string): value is MeetMomentId {
  return (MEET_MOMENTS as readonly string[]).includes(value);
}

/**
 * Parse `?meet=<moment>` out of a query string, or null.
 *
 * Takes the string rather than reading `window`, so it is pure and testable.
 * `App.tsx` supplies it.
 */
export function meetPreviewFrom(search: string): MeetPreviewRequest | null {
  const params = new URLSearchParams(search);
  const moment = params.get('meet');
  if (moment === null || !isMeetMoment(moment)) return null;
  return { moment };
}

export function previewContext(): MeetDayContext {
  return {
    day: MEET_PREVIEW.DAY,
    meet: MEET_LOCAL,
    entry: MEET_ENTRY,
    bestE1rmKg: MEET_PREVIEW.E1RM_KG,
    previousBestTotalKg: MEET_PREVIEW.PREVIOUS_BEST_TOTAL_KG,
    previousBestByLiftKg: MEET_PREVIEW.PREVIOUS_BEST_BY_LIFT_KG,
    fatigue: EMPTY_FATIGUE_STATE,
  };
}

// ---------------------------------------------------------------------------
// Scripted reps, played on the real mechanic
// ---------------------------------------------------------------------------

/** How the scripted lifter performs this attempt. */
export type RepStyle =
  /** Both cues hit dead on. A make nobody argues with. */
  | 'perfect'
  /** Depth called at the very edge of the window. A make, and arguable. */
  | 'marginal'
  /** Released before the window opened. A high squat — a miss, and arguable. */
  | 'high'
  /**
   * Depth hit, then never driven. The bar stalls — at a limit load. NOT a
   * reliable miss at a light one: below roughly 0.89 of the lifter's capacity
   * the mechanic's demand curve never exceeds it and an undriven bar still goes
   * up, which is `lift.ts`'s design and not a bug. Use `dumped` where a miss
   * has to be certain.
   */
  | 'stalled'
  /**
   * Stood up almost immediately, nowhere near depth. A miss AT ANY LOAD, and an
   * unanimous one — the referees do not argue about a squat that never bent.
   * This is what the bomb-out paths are built from, so they bomb because the
   * lifter missed three attempts rather than because a load ratio happened to
   * be over a threshold.
   */
  | 'dumped';

/** The cue the mechanic itself armed, read out of a played rep. */
function armedCue(config: LiftConfig, script: readonly ScriptedInput[], cue: 'depth' | 'drive'): CueWindow | null {
  for (const state of runLift(config, script).history) {
    const active = state.activeCue;
    if (active !== null && active.cue === cue) return active;
  }
  return null;
}

/**
 * The script for one styled rep, derived from the cues the mechanic armed.
 *
 * NOT A TICK NUMBER ANYWHERE. Every moment is asked of `lift.ts`.
 */
export function repScript(config: LiftConfig, style: RepStyle): ScriptedInput[] {
  const script: ScriptedInput[] = [{ tick: braceTicks(config.loadRatio) + 1, kind: 'press' }];
  const depth = armedCue(config, script, 'depth');
  if (depth === null) return script;

  if (style === 'dumped') {
    // Straight back up. The depth cue may not even be armed yet, which is the
    // point: there is nothing here for a referee to weigh.
    script.push({ tick: braceTicks(config.loadRatio) + 2, kind: 'release' });
  } else if (style === 'high') {
    // Stand up before the window opens. The mechanic records the signed offset
    // even though the input landed outside, which is what makes a high squat
    // measurable rather than merely wrong.
    script.push({ tick: Math.max(1, depth.openTick - 1), kind: 'release' });
  } else if (style === 'marginal') {
    // The last tick the window is still open. Inside, and barely.
    script.push({ tick: depth.closeTick, kind: 'release' });
  } else {
    script.push({ tick: depth.idealTick, kind: 'release' });
  }

  if (style === 'stalled') return script;
  if (style === 'dumped') {
    // Drive it anyway. The bar locks out and is then called high, which is the
    // "you thought you got it" shape rather than a bar that fell over.
    const dumpedDrive = armedCue(config, script, 'drive');
    if (dumpedDrive === null) return script;
    script.push({ tick: dumpedDrive.idealTick, kind: 'press' });
    return script;
  }

  const drive = armedCue(config, script, 'drive');
  if (drive === null) return script;
  script.push({ tick: drive.idealTick, kind: 'press' });
  return script;
}

/** Play one styled rep on the real mechanic and hand back its resolution. */
export function playRep(config: LiftConfig, style: RepStyle): LiftResolution {
  const replay = runLift(config, repScript(config, style));
  const resolution = replay.final.resolution;
  if (resolution === null) {
    throw new Error(`meetPreview: a ${style} rep did not resolve; the script cannot be scored.`);
  }
  return resolution;
}

// ---------------------------------------------------------------------------
// Driving the loop
// ---------------------------------------------------------------------------

/** Weigh-in confirmed, openers confirmed, first squat on the bar. */
function openedMeet(): MeetDayState {
  const weighed = stepMeetDay(createMeetDay(previewContext()), { kind: 'confirm-weigh-in' });
  return stepMeetDay(weighed, { kind: 'confirm-openers' });
}

/**
 * Take the attempt on the bar with a given style, all the way through the
 * verdict, and stop wherever `stopAt` says.
 */
type AttemptStop = 'walkout' | 'lift' | 'deliberation' | 'verdict' | 'after';

function takeAttempt(state: MeetDayState, style: RepStyle, stopAt: AttemptStop = 'after'): MeetDayState {
  if (state.phase !== 'walkout') return state;
  if (stopAt === 'walkout') return state;
  const lifting = stepMeetDay(state, { kind: 'walkout-done' });
  if (stopAt === 'lift') return lifting;
  const resolution = playRep(attemptConfigFor(lifting), style);
  const deliberating = stepMeetDay(lifting, { kind: 'lift-resolved', resolution });
  if (stopAt === 'deliberation') return deliberating;
  const verdict = stepMeetDay(deliberating, { kind: 'deliberation-done' });
  if (stopAt === 'verdict') return verdict;
  return stepMeetDay(verdict, { kind: 'verdict-done' });
}

/** Choose the next attempt by option id, or fall through when there is none. */
function chooseOption(state: MeetDayState, id: 'repeat' | 'small' | 'big'): MeetDayState {
  if (state.phase !== 'attempt-select') return state;
  const decision = attemptDecisionFor(state.meet, state.context.previousBestByLiftKg);
  if (decision === null) return state;
  const option = decision.options.find((candidate) => candidate.id === id) ?? decision.options[0];
  if (option === undefined) return state;
  return stepMeetDay(state, { kind: 'declare', weightKg: option.weightKg });
}

/**
 * Play a whole meet with one style per attempt, so a preview can reach a recap
 * or a bomb-out without a human.
 *
 * `styleFor` is asked per (lift, attempt). Returning 'high' or 'stalled' three
 * times on one lift bombs it, which is exactly how the bomb-out beat is
 * reached — through the engine's own rule, never by setting a flag.
 */
export function playMeet(
  styleFor: (lift: LiftKind, attemptNumber: number) => RepStyle,
  choose: (lift: LiftKind, attemptNumber: number) => 'repeat' | 'small' | 'big' = () => 'small',
): MeetDayState {
  let state = openedMeet();
  const limit = LIFT_ORDER.length * LIFT_ORDER.length * LIFT_ORDER.length;
  let guard = 0;
  while (state.phase !== 'recap' && state.phase !== 'bombed' && guard < limit) {
    guard += 1;
    if (state.phase === 'attempt-select') {
      const decision = attemptDecisionFor(state.meet, state.context.previousBestByLiftKg);
      if (decision === null) break;
      state = chooseOption(state, choose(decision.lift, decision.attemptNumber));
      continue;
    }
    const live = state.live;
    if (live === null) break;
    state = takeAttempt(state, styleFor(live.lift, live.attemptNumber));
  }
  return state;
}

/** Every attempt made. The meet that reaches a recap. */
const ALL_GOOD = (): RepStyle => 'perfect';

/** Every squat missed. The meet that bombs (GDD §6.3). */
function bombTheSquat(lift: LiftKind): RepStyle {
  return lift === 'squat' ? 'dumped' : 'perfect';
}

/**
 * The state a preview beat renders.
 *
 * Every branch goes through `stepMeetDay`, so a preview cannot show a screen
 * the machine could not reach — and every rep goes through `runLift`, so it
 * cannot show a verdict the mechanic would not have produced.
 */
export function previewStateFor(request: MeetPreviewRequest): MeetDayState {
  switch (request.moment) {
    case 'weigh-in':
      return createMeetDay(previewContext());
    case 'openers':
      return stepMeetDay(createMeetDay(previewContext()), { kind: 'confirm-weigh-in' });
    case 'walkout':
      return openedMeet();
    case 'walkout-third': {
      // Two missed squats, so the third is the one that decides whether the
      // lifter bombs. The longest walkout the piece can produce.
      const first = takeAttempt(openedMeet(), 'dumped');
      const second = takeAttempt(chooseOption(first, 'repeat'), 'dumped');
      return chooseOption(second, 'repeat');
    }
    case 'lift':
      return takeAttempt(openedMeet(), 'perfect', 'lift');
    case 'deliberation':
      return takeAttempt(openedMeet(), 'marginal', 'deliberation');
    case 'verdict-good':
      return takeAttempt(openedMeet(), 'perfect', 'verdict');
    case 'verdict-split':
      return takeAttempt(openedMeet(), 'marginal', 'verdict');
    case 'verdict-no-lift':
      return takeAttempt(openedMeet(), 'dumped', 'verdict');
    case 'verdict-split-red':
      return takeAttempt(openedMeet(), 'high', 'verdict');
    case 'select-after-make':
      return takeAttempt(openedMeet(), 'perfect');
    case 'select-after-miss':
      return takeAttempt(openedMeet(), 'dumped');
    case 'bombed':
      return playMeet(bombTheSquat, () => 'repeat');
    case 'recap':
    case 'recap-card':
      return playMeet(ALL_GOOD);
    default:
      return createMeetDay(previewContext());
  }
}

/** True when this beat should show the shareable card rather than the recap. */
export function showsCard(moment: MeetMomentId): boolean {
  return moment === 'recap-card';
}
