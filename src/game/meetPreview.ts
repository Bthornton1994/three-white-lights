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
import { sealServerValue } from './progression';
import { newServerRecord, type ServerRecord } from './sessionServer';
import { SESSION_BOUNDARY } from './sessionTuning';

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
  /**
   * The third attempt held MID-UNRACK, and MID-STEP-BACK.
   *
   * Two more photographs of the SAME beat, and they exist because a still of a
   * moving thing proves nothing on its own: `walkout` and `walkout-third` are
   * both shot after the choreography has settled, so without these a critic
   * could open every frame in the run and never see the walk-out move. Each
   * pins `holdWalkoutAtMs` at an instant inside a named stage of
   * `src/meet/walkout.ts`'s sheet, which stops the hall's clock outright rather
   * than racing the shutter — the same reason the whole preview exists.
   */
  | 'walkout-unrack'
  | 'walkout-step'
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
  /**
   * A GOOD LIFT ON AN URGENT ATTEMPT — the only moment that draws
   * `CROWD.URGENT_CHEER_RISE_PX`.
   *
   * Every other judging preview is a FIRST attempt, so `cheerCrowdRise`'s
   * urgent arm had never been drawn to a screen in the graded artifact and
   * `URGENT_CHEER_CROWD_RISE` had no photograph and no test caller. GDD §6.2's
   * deferred rule rests on "what a reaction may escalate is loudness, and it
   * does" — this is the moment that claim is about, and it now exists to be
   * looked at. NOT A RULING ON THE RULE: §6.2 marks it pending playtest and
   * this only makes it playtestable.
   */
  | 'verdict-good-urgent'
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
  'walkout-unrack',
  'walkout-step',
  'lift',
  'deliberation',
  'verdict-good',
  'verdict-good-urgent',
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

/**
 * The instant of the walk-out this beat is held at, or `null` to let the beat
 * play.
 *
 * `null` for every moment except the two mid-motion ones. That is deliberate:
 * `walkout` and `walkout-third` let the choreography RUN and come to rest, so
 * those two frames photograph a settled lifter — which is what makes the crowd
 * the only thing separating them and makes the opener/third-attempt pixel
 * difference a clean measurement of `urgent` reaching the picture.
 */
export function holdWalkoutAtMs(moment: MeetMomentId): number | null {
  if (moment === 'walkout-unrack') return MEET_PREVIEW.WALKOUT_HOLD_MS.UNRACK;
  if (moment === 'walkout-step') return MEET_PREVIEW.WALKOUT_HOLD_MS.STEP;
  return null;
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

/**
 * The stored row the preview's stand-in server starts from.
 *
 * DEBUG ONLY, and it exists because `previewContext()` describes a lifter with
 * a competition history — a 605 kg best total and per-lift bests — while a fresh
 * server record starts empty. Without this the preview's recap always reads
 * FIRST TOTAL, the PR branch is unphotographable, and the walkout's PR beat
 * never fires: the screenshots would show a lifter the preview data says does
 * not exist.
 *
 * The prior meet carries a DIFFERENT id from `MEET_LOCAL`, because
 * `applyMeetResult` refuses a second result for the same meet and a preview
 * that refused its own submission would produce a null recap.
 *
 * IT IS A ROW AND NOT A PORT, because this module is PURE (see the header) and
 * a port is a closure with a timer in it. `src/shell/shellRoute.ts` is what
 * wraps this in a real `localSessionServer`, and it does so only for an entry
 * that has a scripted state — see `previewMeetPort` there for the argument that
 * the live path cannot reach it.
 */
export function previewServerRecord(): ServerRecord {
  // SEALED, like every other `record` row in `progression.ts` 7.5. A debug
  // preview is not a shortcut past the boundary's rules; that it reaches no
  // stored field is a reason to keep it, not a reason to leave it writable.
  return sealServerValue({
    ...newServerRecord(SESSION_BOUNDARY.LOCAL_SERVER_SIGNUP_DAY),
    totalKg: MEET_PREVIEW.PREVIOUS_BEST_TOTAL_KG,
    meets: [
      {
        meetId: `${MEET_LOCAL.id}-previous`,
        meetDayIndex: MEET_PREVIEW.DAY - MEET_PREVIEW.PREVIOUS_MEET_DAYS_AGO,
        totalKg: MEET_PREVIEW.PREVIOUS_BEST_TOTAL_KG,
        bestByLift: MEET_PREVIEW.PREVIOUS_BEST_BY_LIFT_KG,
        bodyweightKg: MEET_ENTRY.bodyweight.kilograms,
      },
    ],
  });
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

/** The tick the mechanic locked the bar out on, or null if it never did. */
function lockoutTick(config: LiftConfig, script: readonly ScriptedInput[]): number | null {
  for (const state of runLift(config, [...script]).history) {
    if (state.events.some((event) => event.kind === 'lockout')) return state.tick;
  }
  return null;
}

/**
 * The deadlift's script (GDD §6.2, "lockout grind").
 *
 * ---------------------------------------------------------------------------
 * A SEPARATE FUNCTION BECAUSE THE DEADLIFT HAS NO DEPTH CUE TO BUILD ONE FROM
 * ---------------------------------------------------------------------------
 * `repScript` below is written entirely around the depth cue: it finds the
 * armed window and places a release inside, before or after it depending on the
 * style. A deadlift arms no depth cue, so that function returned after its very
 * first line for every deadlift attempt — which meant every deadlift in every
 * meet fixture was an UNDRIVEN PULL regardless of the style asked for. At meet
 * loads an undriven pull stalls, so 'perfect' deadlifts were missing.
 *
 * WHERE THE STYLE VOCABULARY DOES NOT MAP CLEANLY, said plainly rather than
 * approximated. `RepStyle`'s members were named for a lift that is judged on
 * depth, and two of them lose meaning here:
 *
 *   'high'      Has no deadlift meaning at all. There is no depth to come up
 *               short of — the floor is the bottom. Scripted as 'dumped', so a
 *               caller asking for an arguable miss gets an unanimous one rather
 *               than a make. `judgingMargin` calls every non-'no-depth' miss
 *               unanimous anyway, so nothing downstream is misled.
 *   'dumped'    Its own docstring promises "a miss AT ANY LOAD". THAT PROMISE
 *               DOES NOT HOLD ON A DEADLIFT AND MUST NOT BE MADE TO. A warm-up
 *               deadlift cannot be lost by any input, because GDD §12.3 forbids
 *               punishing a player for showing up and `LOCKOUT_SAG_PER_TICK` is
 *               tuned so the bar cannot fall far enough at light loads. That is
 *               the constraint working, not a gap. Meet attempts are heavy by
 *               construction, which is why the fixtures built on this style
 *               still bomb out — but a caller using 'dumped' at a warm-up load
 *               on a deadlift will get a MAKE, and needs to know that.
 *
 * The other three carry over exactly: 'perfect' drives every cue and holds the
 * lockout, 'stalled' pulls and never drives, and 'marginal' is the arguable
 * make — here a grip that slipped at lockout and was caught, which grades a
 * grind rather than a clean lift.
 */
function deadliftScript(config: LiftConfig, style: RepStyle): ScriptedInput[] {
  const pull = braceTicks(config.loadRatio, config.kind) + 1;
  let script: ScriptedInput[] = [{ tick: pull, kind: 'press' }];
  // Never driven. Same meaning as squat's 'stalled': a miss at a limit load and
  // a make at a light one, which is `lift.ts`'s demand curve, not a bug.
  if (style === 'stalled') return script;

  // Tap every cue the mechanic arms, chasing them one at a time — cue N's tick
  // depends on when cue N-1 resolved, which is a runtime fact and not something
  // this file may precompute. A tap is a release and a press one tick apart,
  // because that is what a tap is on a device.
  for (let i = 0; i < MEET_PREVIEW.DEADLIFT_CUES_CHASED; i += 1) {
    const cue = armedCue(config, script, 'drive');
    if (cue === null) break;
    if (script.some((input) => input.tick === cue.idealTick)) break;
    const locked = lockoutTick(config, script);
    if (locked !== null && cue.idealTick >= locked) break;
    script = [
      ...script,
      { tick: cue.idealTick - 1, kind: 'release' },
      { tick: cue.idealTick, kind: 'press' },
    ];
  }

  if (style === 'perfect') return script;

  const locked = lockoutTick(config, script);
  if (locked === null) return script;
  if (style === 'marginal') {
    // Slipped and caught it. A make, and an ugly one.
    return [
      ...script,
      { tick: locked + 1, kind: 'release' },
      { tick: locked + 1 + MEET_PREVIEW.DEADLIFT_SLIP_TICKS, kind: 'press' },
    ];
  }
  // 'dumped' and 'high': put it down and leave it down.
  return [...script, { tick: locked + 1, kind: 'release' }];
}

/**
 * The bench's script (GDD §6.2, ruled 2026-08-25).
 *
 * ---------------------------------------------------------------------------
 * A SEPARATE FUNCTION FOR THE SAME REASON THE DEADLIFT HAS ONE: THE CUE IT
 * USED TO BE BUILT FROM IS GONE
 * ---------------------------------------------------------------------------
 * `repScript` below builds a squat from the depth cue the mechanic arms —
 * release at its ideal tick, at its close, before it opens. A bench arms no
 * depth cue at all any more. The 2026-08-25 ruling replaced the release-at-a-
 * moment check with a control check: the bar is fed down, and what is graded
 * is the SPEED IT ARRIVES AT THE CHEST WITH. There is no window to read a
 * release tick off, deliberately, because a ring counting the player down to
 * the chest is squat's anticipation check wearing bench's name.
 *
 * SO THE SCRIPT ASKS THE MECHANIC THE ONLY WAY LEFT: it plays the descent at
 * every hold up to `MEET_PREVIEW.BENCH_HOLD_SCAN_MAX` and keeps the one whose
 * `touchQuality` came back highest. That is still "every moment is asked of
 * `lift.ts`" — it is a search rather than a lookup, and a search that reads
 * the mechanic's own grade cannot agree with a broken descent the way a
 * recomputed tick could.
 *
 * WHAT WOULD HAVE HAPPENED WITHOUT THIS, MEASURED RATHER THAN GUESSED. The
 * squat script releases at the depth cue's ideal tick and then taps the drive.
 * On the new bench that release lands in HOLE (the bar has already arrived),
 * the press command goes unanswered, the burst produces zero force, and every
 * bench attempt in every meet fixture misses. The full suite reported 23
 * failures across five files — recaps reading `DQ` where they expected a
 * placing, openers with no options to choose — all of them one unanswered
 * command. This is the same shape the deadlift's own header records, one lift
 * over.
 *
 * WHERE THE STYLE VOCABULARY DOES NOT MAP CLEANLY, said plainly rather than
 * approximated, exactly as `deadliftScript` does:
 *
 *   'high'      Has no bench meaning as written. There is no depth to come up
 *               short of — the chest is the bottom and touching it is what
 *               makes the press legal. Its bench analogue is the press that
 *               NEVER TOUCHES, which is three red lights in the real sport and
 *               a miss with its own reason ('no-touch'). Scripted as 'dumped'
 *               for that reason. Note the referees do not argue about it:
 *               `judgingMargin` calls every non-'no-depth' miss unanimous, so
 *               a caller asking for an ARGUABLE miss gets an unanimous one.
 *   'dumped'    Its promise — "a miss AT ANY LOAD" — DOES hold here, unlike on
 *               a deadlift. A bar braked at once and never fed again never
 *               reaches the chest at any load, because the descent stops and
 *               `CHEST_TOUCH_TIMEOUT_TICKS` ends the rep. No load enters that
 *               at all, so the promise is structural rather than swept.
 *   'stalled'   "Depth hit, then never driven" becomes "the bar reached the
 *               chest and NOTHING ELSE WAS ANSWERED" — no burst, no drive.
 *               The same caveat its own docstring carries applies with the
 *               same force: at light loads an unanswered bench still goes up,
 *               which is `lift.ts`'s design and not a bug.
 *
 * The other two carry over: 'perfect' catches the bar, mashes the burst and
 * drives every cue; 'marginal' is the arguable make — here the bar dropped
 * onto the chest and then pressed hard, which costs the whole ascent through
 * `BENCH_TOUCH_DEMAND_PENALTY` and grades a grind rather than a clean lift
 * where it still makes.
 */
function benchScript(config: LiftConfig, style: RepStyle): ScriptedInput[] {
  const press = braceTicks(config.loadRatio, config.kind) + 1;

  // 'high' and 'dumped': brake at once and never feed the bar again. It stops
  // short of the chest and the rep ends 'no-touch'.
  if (style === 'high' || style === 'dumped') {
    return [
      { tick: press, kind: 'press' },
      { tick: press + 1, kind: 'release' },
    ];
  }

  // The hold that arrives best, searched by playing the descent rather than
  // computed from the gravity and brake curves. 'marginal' skips the search
  // and never lets go, which is the bar dropped onto the chest.
  let script: ScriptedInput[] = [{ tick: press, kind: 'press' }];
  if (style !== 'marginal') {
    let bestHold: number = MEET_PREVIEW.BENCH_HOLD_SCAN_MAX;
    let bestQuality = -1;
    for (let hold = 1; hold <= MEET_PREVIEW.BENCH_HOLD_SCAN_MAX; hold += 1) {
      const probe: ScriptedInput[] = [
        { tick: press, kind: 'press' },
        { tick: press + hold, kind: 'release' },
      ];
      const touched = runLift(config, probe).history.find((state) =>
        state.events.some((event) => event.kind === 'chest-touch'),
      );
      const quality = touched?.touchQuality ?? -1;
      if (quality > bestQuality) {
        bestQuality = quality;
        bestHold = hold;
      }
    }
    script = [...script, { tick: press + bestHold, kind: 'release' }];
  }

  // 'stalled' answers nothing after the touch: no burst, no drive.
  if (style === 'stalled') return script;

  const command = commandTick(config, script);
  if (command === null) return script;
  for (let i = 0; i < MEET_PREVIEW.BENCH_BURST_TAPS_SCRIPTED; i += 1) {
    script = [...script, { tick: command + i * MEET_PREVIEW.BENCH_BURST_TAP_GAP_TICKS, kind: 'press' }];
  }

  // Then the ascent, chased cue by cue the way the deadlift's is: cue N's tick
  // is a function of when cue N-1 resolved, which is a runtime fact.
  for (let i = 0; i < MEET_PREVIEW.DEADLIFT_CUES_CHASED; i += 1) {
    const cue = lastArmedDrive(config, script);
    if (cue === null || script.some((input) => input.tick === cue.idealTick)) break;
    script = [...script, { tick: cue.idealTick, kind: 'press' }];
  }
  return script;
}

/** The tick the mechanic fired the bench press command on, or null. */
function commandTick(config: LiftConfig, script: readonly ScriptedInput[]): number | null {
  for (const state of runLift(config, script).history) {
    if (state.events.some((event) => event.kind === 'press-command')) return state.tick;
  }
  return null;
}

/** The LAST drive cue the mechanic has armed under this script, or null. */
function lastArmedDrive(config: LiftConfig, script: readonly ScriptedInput[]): CueWindow | null {
  let latest: CueWindow | null = null;
  for (const state of runLift(config, script).history) {
    const active = state.activeCue;
    if (active !== null && active.cue === 'drive') latest = active;
  }
  return latest;
}

/**
 * The script for one styled rep, derived from the cues the mechanic armed.
 *
 * NOT A TICK NUMBER ANYWHERE. Every moment is asked of `lift.ts`.
 */
export function repScript(config: LiftConfig, style: RepStyle): ScriptedInput[] {
  if (config.kind === 'deadlift') return deadliftScript(config, style);
  if (config.kind === 'bench') return benchScript(config, style);
  const script: ScriptedInput[] = [
    { tick: braceTicks(config.loadRatio, config.kind) + 1, kind: 'press' },
  ];
  const depth = armedCue(config, script, 'depth');
  if (depth === null) return script;

  if (style === 'dumped') {
    // Straight back up. The depth cue may not even be armed yet, which is the
    // point: there is nothing here for a referee to weigh.
    script.push({ tick: braceTicks(config.loadRatio, config.kind) + 2, kind: 'release' });
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
function openedMeet(context: MeetDayContext = previewContext()): MeetDayState {
  const weighed = stepMeetDay(createMeetDay(context), { kind: 'confirm-weigh-in' });
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
  /**
   * The meet to play. Defaults to the shipped one.
   *
   * The parameter exists so a test can play a POUND meet on the real loop
   * instead of hand-building a card in the unit it wants to check. `meet.ts`
   * exports `POUND_MEET_RULES` and `MeetDefinition.rules` takes them, so this is
   * a configuration the engine already supports rather than an abuse of it —
   * see GDD §11's open pound-meet ruling.
   */
  context: MeetDayContext = previewContext(),
): MeetDayState {
  let state = openedMeet(context);
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
    case 'walkout-third':
    case 'walkout-unrack':
    case 'walkout-step': {
      // Two missed squats, so the third is the one that decides whether the
      // lifter bombs. The longest walkout the piece can produce, and the same
      // state for all three: what differs between them is only which instant of
      // the beat is held (`holdWalkoutAtMs`), so a critic comparing the frames
      // is comparing the choreography and nothing else.
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
    case 'verdict-good-urgent': {
      // Two missed squats, so the third is urgent by `isUrgentAttempt`'s own
      // test — last attempt, nothing banked — and then MADE, which is the one
      // combination that reaches the urgent cheer. Built from the same
      // `takeAttempt` ladder as `walkout-third` rather than a hand-made state,
      // so it is the app's own arithmetic deciding this is urgent.
      const first = takeAttempt(openedMeet(), 'dumped');
      const second = takeAttempt(chooseOption(first, 'repeat'), 'dumped');
      return takeAttempt(chooseOption(second, 'repeat'), 'perfect', 'verdict');
    }
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

/**
 * The query string that opens a REAL, unfrozen meet: `?meet=live`.
 *
 * Deliberately not a `MeetMomentId` — there is no state to build for it, which
 * is the whole point. `?meet=<moment>` freezes a scripted beat so it can be
 * photographed; this asks for the played loop with its clock running, which is
 * the only way to show that the walkout, deliberation and verdict beats
 * actually elapse rather than merely having durations.
 */
export const LIVE_MEET_PARAM = 'live';

export function isLiveMeetRequest(search: string): boolean {
  return new URLSearchParams(search).get('meet') === LIVE_MEET_PARAM;
}
