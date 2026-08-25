import { describe, expect, it } from 'vitest';

import {
  ATTEMPTS_PER_LIFT,
  LIFT_ORDER,
  currentAttemptContext,
  finalMeetTotal,
  isGoodLift,
  isSplitDecision,
  lightestCallableWeightIgnoringTheCard,
  meetLoadingRules,
  POUND_MEET_RULES,
  suggestOpener,
  type LiftKind,
  type MeetState,
} from './meet';
import {
  EMPTY_FATIGUE_STATE,
  LUCKIEST_ROLLS,
  adjustedTimingWindowMs,
  recordSession,
  type FatigueState,
} from './fatigue';
import { LIFT_TUNING } from './liftTuning';
import { WEIGHT_CLASSES_KG, formatWeight } from './resultCard';
import {
  attemptConfigFor,
  attemptDecisionFor,
  beatsPreviousBest,
  buildMeetRecap,
  countedTotalText,
  createMeetDay,
  deliberates,
  dissentChance,
  feedbackTextFor,
  judgeAttempt,
  judgePanelFor,
  judgeSeedFor,
  judgingMargin,
  liftCallOutFor,
  liveAttemptWeightText,
  meetAttemptReports,
  meetResultCard,
  meetResultProposal,
  stepMeetDay,
  suggestedOpeners,
  weighInFor,
  type AttemptDecision,
  type AttemptOption,
  type MeetDayContext,
  type MeetDayState,
  type MeetRecap,
} from './meetDay';
import { applyMeetResult, type AppliedMeetResult } from './meetServer';
import { newServerRecord, type ServerRecord } from './sessionServer';
import {
  MEET_COPY,
  MEET_ENTRY,
  MEET_LOCAL,
  MEET_PREVIEW,
  MEET_TUNING,
  type MeetDefinition,
} from './meetTuning';
import { LOAD_PRESETS } from './liftTuning';
import type { LiftConfig } from './lift';
import {
  MEET_MOMENTS,
  playMeet,
  playRep,
  repScript,
  previewContext,
  previewStateFor,
  type RepStyle,
} from './meetPreview';

// ---------------------------------------------------------------------------
// Drivers. Every one of them goes through `stepMeetDay`; none reaches into
// state directly, so a test cannot construct a screen the machine could not.
// ---------------------------------------------------------------------------

function openedMeet(context: MeetDayContext = previewContext()): MeetDayState {
  return stepMeetDay(stepMeetDay(createMeetDay(context), { kind: 'confirm-weigh-in' }), {
    kind: 'confirm-openers',
  });
}

/** Take the attempt on the bar with a given style, through to the next screen. */
function take(state: MeetDayState, style: RepStyle): MeetDayState {
  expect(state.phase, 'take() needs an attempt on the bar').toBe('walkout');
  const lifting = stepMeetDay(state, { kind: 'walkout-done' });
  const resolution = playRep(attemptConfigFor(lifting), style);
  const deliberating = stepMeetDay(lifting, { kind: 'lift-resolved', resolution });
  const verdict = stepMeetDay(deliberating, { kind: 'deliberation-done' });
  return stepMeetDay(verdict, { kind: 'verdict-done' });
}

function decisionOf(state: MeetDayState): AttemptDecision {
  const decision = attemptDecisionFor(state.meet, state.context.previousBestByLiftKg);
  expect(decision, 'expected an attempt decision').not.toBeNull();
  if (decision === null) throw new Error('unreachable');
  return decision;
}

function chooseById(state: MeetDayState, id: 'repeat' | 'small' | 'big'): MeetDayState {
  const decision = decisionOf(state);
  const option = decision.options.find((candidate) => candidate.id === id);
  expect(option, `expected a "${id}" option`).toBeDefined();
  if (option === undefined) throw new Error('unreachable');
  return stepMeetDay(state, { kind: 'declare', weightKg: option.weightKg });
}

/**
 * Choose the requested option where it exists and the first one otherwise.
 *
 * A driver, not an assertion: which two options are on offer depends on
 * whether the previous attempt stood, so a sweep that insisted on 'repeat'
 * everywhere would crash on the first make rather than testing anything.
 */
function chooseOrFallBack(state: MeetDayState, id: 'repeat' | 'small' | 'big'): MeetDayState {
  const decision = decisionOf(state);
  const option = decision.options.find((candidate) => candidate.id === id) ?? decision.options[0];
  expect(option, 'a decision must always offer something').toBeDefined();
  if (option === undefined) throw new Error('unreachable');
  return stepMeetDay(state, { kind: 'declare', weightKg: option.weightKg });
}

/** Every attempt-select screen a meet played this way passes through. */
function everyDecisionIn(
  styleFor: (lift: LiftKind, attemptNumber: number) => RepStyle,
  choose: (lift: LiftKind, attemptNumber: number) => 'repeat' | 'small' | 'big' = () => 'small',
): { decision: AttemptDecision; state: MeetDayState }[] {
  const seen: { decision: AttemptDecision; state: MeetDayState }[] = [];
  let state = openedMeet();
  let guard = 0;
  while (state.phase !== 'recap' && state.phase !== 'bombed' && guard < 64) {
    guard += 1;
    if (state.phase === 'attempt-select') {
      const decision = decisionOf(state);
      seen.push({ decision, state });
      state = chooseOrFallBack(state, choose(decision.lift, decision.attemptNumber));
      continue;
    }
    const live = state.live;
    if (live === null) break;
    state = take(state, styleFor(live.lift, live.attemptNumber));
  }
  return seen;
}

const ALL_GOOD = (): RepStyle => 'perfect';
// `dumped` rather than `stalled`: an undriven bar still goes up below roughly
// 0.89 of capacity (`lift.ts`'s demand curve), so `stalled` is a miss on the
// squat's opener and a MAKE on the bench's. A sweep built on it would silently
// stop exercising the miss branch on two lifts out of three.
const MISS_FIRST = (_lift: LiftKind, attemptNumber: number): RepStyle =>
  attemptNumber === 1 ? 'dumped' : 'perfect';

// ---------------------------------------------------------------------------
// The scripted rep styles, on the lift whose beat is not built from depth
// ---------------------------------------------------------------------------

describe("the deadlift's scripted rep styles mean what they say", () => {
  // -------------------------------------------------------------------------
  // WHY THIS BLOCK EXISTS. `repScript` was written entirely around the depth
  // cue, and a deadlift arms none — so before deadlift got its own arm, every
  // deadlift attempt in every fixture in this file was an UNDRIVEN PULL no
  // matter which style was asked for. Nothing said so. The tests failed later
  // and elsewhere, as meets that should have been made coming back missed.
  //
  // Every style is played here against the real mechanic, so a style that stops
  // meaning what its name says fails at the definition rather than in whatever
  // fixture happens to depend on it.
  // -------------------------------------------------------------------------
  const heavy = (): LiftConfig => ({ kind: 'deadlift', loadRatio: 0.95, seed: 5 });

  it('makes a perfect pull and loses a dumped one, at a meet load', () => {
    expect(playRep(heavy(), 'perfect').outcome).not.toBe('miss');
    const dumped = playRep(heavy(), 'dumped');
    expect(dumped.outcome).toBe('miss');
    // Called what it was. A deadlift put down early is not a bar that beat the
    // lifter at the sticking point.
    expect(dumped.missReason).toBe('dropped');
  });

  it('grades a marginal pull a make, and an ugly one', () => {
    // The arguable make. It has to land past the grip grace (or the slip costs
    // nothing and this is just 'perfect') and short of the drop (or it is
    // 'dumped' under another name), which is what `DEADLIFT_SLIP_TICKS` is
    // chosen between — pinned here by outcome rather than by reading the slip
    // counter, because the counter moving is not evidence the rep changed.
    const marginal = playRep(heavy(), 'marginal');
    expect(marginal.outcome).toBe('grind');
    expect(marginal.outcome).not.toBe('miss');
  });

  it('stalls an undriven pull at a limit load and lets it through at a light one', () => {
    // Carried over from squat unchanged, and it must keep meaning the same
    // thing: 'stalled' is a miss at the top of the range and a make at the
    // bottom, which is the demand curve, not a bug.
    expect(playRep({ kind: 'deadlift', loadRatio: 1.0, seed: 5 }, 'stalled').outcome).toBe('miss');
    expect(
      playRep({ kind: 'deadlift', loadRatio: LOAD_PRESETS.LIGHT, seed: 5 }, 'stalled').outcome,
    ).not.toBe('miss');
  });

  it('cannot dump a warm-up deadlift, and that is GDD §12.3 rather than a gap', () => {
    // `RepStyle`'s own docstring promises 'dumped' is "a miss AT ANY LOAD".
    // THAT PROMISE IS FALSE ON A DEADLIFT and it is pinned false here rather
    // than left for somebody to discover: a warm-up deadlift cannot be lost by
    // any input, because §12.3 forbids punishing a player for showing up and
    // `LOCKOUT_SAG_PER_TICK` is tuned so the bar cannot fall far enough.
    //
    // The fixtures in this file that bomb lifters out with 'dumped' still work
    // because meet attempts are heavy by construction — but a caller reaching
    // for 'dumped' at a warm-up load on a deadlift gets a MAKE, and this is
    // where they find that out.
    for (const load of [LOAD_PRESETS.WARMUP, LOAD_PRESETS.LIGHT]) {
      expect(playRep({ kind: 'deadlift', loadRatio: load, seed: 5 }, 'dumped').outcome).not.toBe(
        'miss',
      );
    }
    // ...and the same style at the same loads on a squat IS a miss, which is
    // what makes this a fact about the deadlift rather than about the style.
    expect(playRep({ kind: 'squat', loadRatio: LOAD_PRESETS.WARMUP, seed: 5 }, 'dumped').outcome)
      .toBe('miss');
  });

  it('gives each lift its own script shape, and does not divert one into another', () => {
    // Three kinds, three per-kind branches in a shared function, and this is
    // the guard that each diverts only what it is meant to. The shapes are
    // structurally different and that is what gets asserted:
    //
    //   DEPTH-SHAPED   squat. press, ONE release (the depth call), then at
    //                  most one drive press. The release is always second.
    //   BURST-SHAPED   bench, since the 2026-08-25 ruling. press, then a
    //                  release that is a BRAKE rather than a depth call, then
    //                  a RUN of presses — the burst and the drive cues.
    //                  'marginal' has no release at all: it is the bar fed
    //                  straight onto the chest.
    //   TAP-SHAPED     deadlift. press, then release/press PAIRS through the
    //                  ascent, then possibly a final release at the lockout.
    //
    // 'BENCH USED TO BE ON THE FIRST LINE OF THIS TEST, and moving it is the
    // point rather than an accommodation: a bench script that still came back
    // depth-shaped would mean the ruling had not reached the fixtures, which
    // is exactly the state that put 23 failures across five files into the
    // suite when the mechanic landed ahead of them. Pinned as shapes rather
    // than as literal tick numbers so a retune of any one lift does not redden
    // a test about another.
    const styles = ['perfect', 'marginal', 'high', 'stalled', 'dumped'] as const;
    for (const style of styles) {
      const script = repScript({ kind: 'squat', loadRatio: 0.9, seed: 5 }, style);
      const releases = script.filter((input) => input.kind === 'release');
      expect(releases.length, `squat ${style} releases`).toBe(1);
      expect(script[0]?.kind, `squat ${style} opens on a press`).toBe('press');
      expect(script[1]?.kind, `squat ${style} calls depth second`).toBe('release');
      expect(script.length, `squat ${style} length`).toBeLessThanOrEqual(3);
    }

    // BENCH. Every style opens on a press; the two that answer the command
    // carry a run of them afterwards, and the three that do not are two inputs
    // long. 'marginal' is the one style with no release — the bar is fed all
    // the way onto the chest, which is what makes it the arguable make.
    const benchPresses: Record<string, number> = {};
    for (const style of styles) {
      const script = repScript({ kind: 'bench', loadRatio: 0.9, seed: 5 }, style);
      expect(script[0]?.kind, `bench ${style} opens on a press`).toBe('press');
      const releases = script.filter((input) => input.kind === 'release').length;
      expect(releases, `bench ${style} releases`).toBe(style === 'marginal' ? 0 : 1);
      benchPresses[style] = script.filter((input) => input.kind === 'press').length;
      // Ticks strictly increase, or the script is not a script — a bench
      // script is now built by three passes over the mechanic and an
      // out-of-order tick would be silently dropped by `runLift`'s map.
      for (let i = 1; i < script.length; i += 1) {
        expect(
          script[i]?.tick ?? 0,
          `bench ${style} input ${i} is not after input ${i - 1}`,
        ).toBeGreaterThan(script[i - 1]?.tick ?? 0);
      }
    }
    // The two that answer the command are a RUN of presses; the three that do
    // not are the single opening one. Counts rather than bounds, so a burst
    // that stopped being written reports itself.
    expect(benchPresses['perfect'] ?? 0, 'bench perfect presses').toBeGreaterThan(4);
    expect(benchPresses['marginal'] ?? 0, 'bench marginal presses').toBeGreaterThan(4);
    expect(benchPresses['high'] ?? 0, 'bench high presses').toBe(1);
    expect(benchPresses['dumped'] ?? 0, 'bench dumped presses').toBe(1);
    expect(benchPresses['stalled'] ?? 0, 'bench stalled presses').toBe(1);

    // ...and the deadlift really is the third shape, or the contrast above is
    // asserting nothing. 'perfect' taps a cue: a release and a press adjacent.
    const pull = repScript({ kind: 'deadlift', loadRatio: 0.9, seed: 5 }, 'perfect');
    expect(pull[0]?.kind).toBe('press');
    expect(pull.filter((input) => input.kind === 'press').length).toBeGreaterThan(1);
    // 'stalled' is the one deadlift style with no tap at all — one press, and
    // the bar is on its own.
    expect(repScript({ kind: 'deadlift', loadRatio: 0.9, seed: 5 }, 'stalled')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// GDD §6.1 — Pre-meet
// ---------------------------------------------------------------------------

describe('the weigh-in beat (GDD §6.1)', () => {
  const classes = WEIGHT_CLASSES_KG.male;

  it('puts the lifter in the lightest class they make', () => {
    expect(weighInFor({ ...MEET_ENTRY, bodyweight: { unit: 'kg', kilograms: 92.4 } }, classes).weightClassText).toBe('93');
    expect(weighInFor({ ...MEET_ENTRY, bodyweight: { unit: 'kg', kilograms: 93 } }, classes).weightClassText).toBe('93');
    expect(weighInFor({ ...MEET_ENTRY, bodyweight: { unit: 'kg', kilograms: 93.1 } }, classes).weightClassText).toBe('105');
  });

  it('calls a close cut close, and a comfortable one comfortable', () => {
    const tight = weighInFor(
      { ...MEET_ENTRY, bodyweight: { unit: 'kg', kilograms: 93 - MEET_TUNING.WATER_CUT_MARGIN_KG / 2 } },
      classes,
    );
    const easy = weighInFor(
      { ...MEET_ENTRY, bodyweight: { unit: 'kg', kilograms: 93 - MEET_TUNING.WATER_CUT_MARGIN_KG * 4 } },
      classes,
    );
    expect(tight.cuttingClose).toBe(true);
    expect(easy.cuttingClose).toBe(false);
    expect(tight.flavourText).not.toBe(easy.flavourText);
  });

  it('is FLAVOUR ONLY — nothing about the meet changes with the cut', () => {
    // GDD §6.1: "Flavor only — no dieting mechanic." The test that makes that
    // true rather than claimed: two lifters who differ ONLY in bodyweight, one
    // cutting to the gram and one comfortable, get the identical meet. Same
    // openers, same floors, same bar, same beats.
    const tight: MeetDayContext = {
      ...previewContext(),
      entry: { ...MEET_ENTRY, bodyweight: { unit: 'kg', kilograms: 93 - MEET_TUNING.WATER_CUT_MARGIN_KG / 2 } },
    };
    const easy: MeetDayContext = {
      ...previewContext(),
      entry: { ...MEET_ENTRY, bodyweight: { unit: 'kg', kilograms: 93 - MEET_TUNING.WATER_CUT_MARGIN_KG * 4 } },
    };
    expect(weighInFor(tight.entry, classes).cuttingClose).toBe(true);
    expect(weighInFor(easy.entry, classes).cuttingClose).toBe(false);

    const a = openedMeet(tight);
    const b = openedMeet(easy);
    expect(a.openersKg).toEqual(b.openersKg);
    expect(a.live).toEqual(b.live);
    expect(attemptConfigFor(a).loadRatio).toBe(attemptConfigFor(b).loadRatio);
  });
});

describe('opening attempts (GDD §6.1)', () => {
  it('are pre-filled from the lifter’s e1RM', () => {
    for (const lift of LIFT_ORDER) {
      const expected = suggestOpener(lift, MEET_PREVIEW.E1RM_KG[lift], MEET_LOCAL.rules);
      expect(expected.ok).toBe(true);
      if (!expected.ok) throw new Error('unreachable');
      expect(suggestedOpeners(MEET_PREVIEW.E1RM_KG, MEET_LOCAL)[lift]).toBe(expected.value);
    }
  });

  it('MOVE when the e1RM moves — they are not a constant', () => {
    // The check that "pre-filled from e1RM" is a derivation rather than a
    // hard-coded number that happens to look plausible.
    const weak = suggestedOpeners({ squat: 100, bench: 60, deadlift: 120 }, MEET_LOCAL);
    const strong = suggestedOpeners({ squat: 300, bench: 200, deadlift: 340 }, MEET_LOCAL);
    for (const lift of LIFT_ORDER) {
      expect(strong[lift], lift).toBeGreaterThan(weak[lift]);
      expect(weak[lift], lift).toBeGreaterThanOrEqual(
        lightestCallableWeightIgnoringTheCard(lift, MEET_LOCAL.rules),
      );
    }
  });

  it('are a SAFE opener — under the lifter’s own e1RM', () => {
    const openers = suggestedOpeners(MEET_PREVIEW.E1RM_KG, MEET_LOCAL);
    for (const lift of LIFT_ORDER) {
      expect(openers[lift], lift).toBeLessThan(MEET_PREVIEW.E1RM_KG[lift]);
    }
  });

  it('can be overridden, and the override is what goes on the bar', () => {
    const step = MEET_LOCAL.rules.declarationIncrement;
    const openers = stepMeetDay(createMeetDay(previewContext()), { kind: 'confirm-weigh-in' });
    const suggested = openers.openersKg.squat;

    const raised = stepMeetDay(openers, {
      kind: 'set-opener',
      lift: 'squat',
      weightKg: suggested + step,
    });
    expect(raised.openersKg.squat).toBe(suggested + step);
    expect(raised.openerOverridden.squat).toBe(true);
    expect(raised.openerOverridden.bench).toBe(false);

    const started = stepMeetDay(raised, { kind: 'confirm-openers' });
    expect(started.phase).toBe('walkout');
    expect(started.live?.weightKg).toBe(suggested + step);
  });

  it('refuses an override below the bar', () => {
    const openers = stepMeetDay(createMeetDay(previewContext()), { kind: 'confirm-weigh-in' });
    const belowTheBar = MEET_LOCAL.rules.barAndCollarsWeight.squat - 1;
    const after = stepMeetDay(openers, { kind: 'set-opener', lift: 'squat', weightKg: belowTheBar });
    expect(after.openersKg.squat).toBe(openers.openersKg.squat);
  });
});

// ---------------------------------------------------------------------------
// GDD §6.3 — Attempt selection. The non-decreasing ratchet and its bite.
// ---------------------------------------------------------------------------

describe('attempts never decrease (GDD §6.3, CLAUDE.md domain correctness)', () => {
  it('never OFFERS a weight below the engine’s floor, on any path', () => {
    const paths: [string, (l: LiftKind, n: number) => RepStyle, () => 'repeat' | 'small' | 'big'][] = [
      ['all made, small jumps', ALL_GOOD, () => 'small'],
      ['all made, big jumps', ALL_GOOD, () => 'big'],
      ['opener missed, repeat', MISS_FIRST, () => 'repeat'],
      ['opener missed, push past', MISS_FIRST, () => 'big'],
    ];
    let checked = 0;
    for (const [name, styleFor, choose] of paths) {
      const seen = everyDecisionIn(styleFor, choose);
      expect(seen.length, `${name} produced no decisions`).toBeGreaterThan(0);
      for (const { decision, state } of seen) {
        for (const option of decision.options) {
          checked += 1;
          expect(option.weightKg, `${name}: ${option.id}`).toBeGreaterThanOrEqual(decision.floorKg);
          expect(option.weightKg, `${name}: ${option.id}`).toBeGreaterThanOrEqual(
            decision.previousWeightKg ?? 0,
          );
          // ...and the engine, asked directly, accepts every one of them.
          const declared = stepMeetDay(state, { kind: 'declare', weightKg: option.weightKg });
          expect(declared.phase, `${name}: ${option.id} was refused`).toBe('walkout');
          expect(declared.lastError).toBeNull();
        }
      }
    }
    // Non-vacuity: the sweep really did look at a pile of options rather than
    // running one iteration over a blank row.
    expect(checked).toBeGreaterThanOrEqual(24);
  });

  it('the machine REFUSES a weight below the floor, so the offer list is not the only guard', () => {
    // The offer list could be right and the declare path still wrong. This is
    // the second lock: hand `stepMeetDay` a weight under the floor by hand.
    const seen = everyDecisionIn(MISS_FIRST, () => 'repeat');
    expect(seen.length).toBeGreaterThan(0);
    const step = MEET_LOCAL.rules.declarationIncrement;
    let refused = 0;
    for (const { decision, state } of seen) {
      const tooLight = decision.floorKg - step;
      const after = stepMeetDay(state, { kind: 'declare', weightKg: tooLight });
      refused += 1;
      expect(after.phase, `declared ${tooLight} under a floor of ${decision.floorKg}`).toBe(
        'attempt-select',
      );
      expect(after.live).toBeNull();
      expect(after.lastError).not.toBeNull();
      expect(['WEIGHT_DECREASED', 'REPEAT_AFTER_GOOD_LIFT', 'INSUFFICIENT_INCREASE']).toContain(
        after.lastError?.code,
      );
    }
    expect(refused).toBeGreaterThanOrEqual(6);
  });

  it('offers a repeat ONLY after a miss', () => {
    const afterMiss = everyDecisionIn(MISS_FIRST, () => 'repeat');
    const afterMake = everyDecisionIn(ALL_GOOD, () => 'small');

    const missDecisions = afterMiss.filter((entry) => entry.decision.previousOutcome === 'no-lift');
    expect(missDecisions.length).toBeGreaterThan(0);
    for (const { decision } of missDecisions) {
      const repeat = decision.options.find((option) => option.id === 'repeat');
      expect(repeat, 'a missed attempt must be repeatable').toBeDefined();
      expect(repeat?.weightKg).toBe(decision.previousWeightKg);
      expect(repeat?.deltaKg).toBe(0);
    }

    expect(afterMake.length).toBeGreaterThan(0);
    for (const { decision } of afterMake) {
      expect(decision.previousOutcome).toBe('good');
      expect(decision.options.map((option) => option.id)).not.toContain('repeat');
    }
  });
});

describe('a miss RAISES the floor — GDD §6.3’s bite', () => {
  it('leaves the lightest legal call at the weight that just beat the lifter', () => {
    const missed = take(openedMeet(), 'dumped');
    expect(missed.phase).toBe('attempt-select');
    const decision = decisionOf(missed);

    // The floor IS the missed weight.
    expect(decision.previousOutcome).toBe('no-lift');
    expect(decision.floorKg).toBe(decision.previousWeightKg);
    expect(decision.floorRaisedByMiss).toBe(true);
    expect(decision.floorText).toBe(MEET_COPY.SELECT_FLOOR_RAISED);
    expect(decision.bankedKg).toBeNull();
  });

  it('is strictly higher than the floor the lifter had before the attempt', () => {
    // The sentence §6.3 actually makes: "a miss does not lower the floor — it
    // RAISES it". Stated as a comparison against the floor that existed before
    // the attempt was taken, so it cannot pass by the floor merely being some
    // number.
    const beforeAnyAttempt = stepMeetDay(createMeetDay(previewContext()), {
      kind: 'confirm-weigh-in',
    });
    const floorBefore = lightestCallableWeightIgnoringTheCard('squat', MEET_LOCAL.rules);
    const contextBefore = currentAttemptContext(beforeAnyAttempt.meet);
    expect(contextBefore?.minimumWeight).toBe(floorBefore);

    const missed = take(stepMeetDay(beforeAnyAttempt, { kind: 'confirm-openers' }), 'dumped');
    const floorAfter = decisionOf(missed).floorKg;
    expect(floorAfter).toBeGreaterThan(floorBefore);
  });

  it('cannot be retreated from — every option is at or above the missed weight', () => {
    const missed = take(openedMeet(), 'dumped');
    const decision = decisionOf(missed);
    expect(decision.options.length).toBeGreaterThanOrEqual(2);
    for (const option of decision.options) {
      expect(option.weightKg, option.id).toBeGreaterThanOrEqual(decision.previousWeightKg ?? 0);
    }
    // ...and there is no legal weight between the bar and the missed one.
    const step = MEET_LOCAL.rules.declarationIncrement;
    const previous = decision.previousWeightKg ?? 0;
    for (let weight = MEET_LOCAL.rules.barAndCollarsWeight.squat; weight < previous; weight += step) {
      const after = stepMeetDay(missed, { kind: 'declare', weightKg: weight });
      expect(after.phase, `${weight} should not be callable after missing ${previous}`).toBe(
        'attempt-select',
      );
    }
  });

  it('says the OPPOSITE thing after a make', () => {
    // The contrast is what makes the raised-floor line mean anything: after a
    // good lift the floor goes UP too, but for the opposite reason, and the
    // screen must not say a miss raised it.
    const made = take(openedMeet(), 'perfect');
    const decision = decisionOf(made);
    expect(decision.previousOutcome).toBe('good');
    expect(decision.floorRaisedByMiss).toBe(false);
    expect(decision.floorText).toBe(MEET_COPY.SELECT_FLOOR_AFTER_MAKE);
    expect(decision.floorKg).toBeGreaterThan(decision.previousWeightKg ?? 0);
    expect(decision.bankedKg).toBe(decision.previousWeightKg);
  });

  it('warns when the next attempt is the one that bombs the lift', () => {
    const first = take(openedMeet(), 'dumped');
    const second = take(chooseById(first, 'repeat'), 'dumped');
    const decision = decisionOf(second);
    expect(decision.attemptNumber).toBe(ATTEMPTS_PER_LIFT);
    expect(decision.isLastAttempt).toBe(true);
    expect(decision.bombRisk).toBe(true);
    expect(decision.bombWarningText).toBe(MEET_COPY.OPTION_BOMB_WARNING);

    // ...and does NOT warn when something is banked.
    const banked = take(openedMeet(), 'perfect');
    const secondBanked = take(chooseById(banked, 'small'), 'dumped');
    const safe = decisionOf(secondBanked);
    expect(safe.attemptNumber).toBe(ATTEMPTS_PER_LIFT);
    expect(safe.isLastAttempt).toBe(true);
    expect(safe.bombRisk).toBe(false);
    expect(safe.bombWarningText).toBeNull();
  });
});

describe('the two choices GDD §6.3 names', () => {
  it('after a make: a small increase and a strictly bigger one', () => {
    const made = take(openedMeet(), 'perfect');
    const decision = decisionOf(made);
    const small = decision.options.find((option) => option.id === 'small');
    const big = decision.options.find((option) => option.id === 'big');
    expect(small).toBeDefined();
    expect(big).toBeDefined();
    expect(big?.weightKg ?? 0).toBeGreaterThan(small?.weightKg ?? 0);
    expect(small?.deltaKg ?? 0).toBeGreaterThan(0);
  });

  it('after a miss: repeat, and a strictly heavier one', () => {
    const missed = take(openedMeet(), 'dumped');
    const decision = decisionOf(missed);
    const repeat = decision.options.find((option) => option.id === 'repeat');
    const past = decision.options.find((option) => option.id === 'big');
    expect(repeat?.weightKg).toBe(decision.previousWeightKg);
    expect(past?.weightKg ?? 0).toBeGreaterThan(repeat?.weightKg ?? 0);
    expect(past?.why).toBe(MEET_COPY.OPTION_PUSH_PAST_WHY);
  });

  it('never offers three, so the choice stays a choice between two things', () => {
    for (const seen of [everyDecisionIn(ALL_GOOD), everyDecisionIn(MISS_FIRST, () => 'repeat')]) {
      expect(seen.length).toBeGreaterThan(0);
      for (const { decision } of seen) {
        expect(decision.options.length).toBe(2);
      }
    }
  });

  it('flags an option that would put a competition PR on the bar', () => {
    // GDD §6.3's "a PR on the line". The lifter's best squat on record is
    // `MEET_PREVIEW.PREVIOUS_BEST_BY_LIFT_KG.squat`; a jump past it is the one
    // that carries the PR.
    const seen = everyDecisionIn(ALL_GOOD, () => 'big');
    const squatDecisions = seen.filter((entry) => entry.decision.lift === 'squat');
    expect(squatDecisions.length).toBeGreaterThan(0);
    const best = MEET_PREVIEW.PREVIOUS_BEST_BY_LIFT_KG.squat;
    for (const { decision } of squatDecisions) {
      for (const option of decision.options) {
        expect(option.isPrAttempt, `${option.id} @ ${option.weightKg} vs best ${best}`).toBe(
          option.weightKg > best,
        );
      }
    }
    // Non-vacuity: at least one option really is a PR attempt on this path.
    expect(
      squatDecisions.some((entry) => entry.decision.options.some((option) => option.isPrAttempt)),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GDD §6.2 — the attempt loop and the three-light call
// ---------------------------------------------------------------------------

describe('the judging model reads the rep (GDD §6.2 step 4)', () => {
  const CONFIG = { kind: 'squat' as const, loadRatio: 0.9, seed: 4242 };

  it('scores a clean lift as obvious and a marginal one as arguable', () => {
    const clean = judgingMargin(playRep(CONFIG, 'perfect'));
    const marginal = judgingMargin(playRep(CONFIG, 'marginal'));
    expect(clean).toBeGreaterThanOrEqual(MEET_TUNING.UNANIMOUS_MARGIN);
    expect(marginal).toBeLessThanOrEqual(MEET_TUNING.SPLIT_MARGIN);
    expect(clean).toBeGreaterThan(marginal);
  });

  it('scores a high squat as arguable and a stalled bar as not', () => {
    const high = playRep(CONFIG, 'high');
    const stalled = playRep(CONFIG, 'stalled');
    expect(high.outcome).toBe('miss');
    expect(high.missReason).toBe('no-depth');
    expect(stalled.outcome).toBe('miss');
    expect(stalled.missReason).toBe('stalled');

    // The lifter who called depth and missed it narrowly gets a beat and can
    // get a 2-1. The lifter whose bar came back down does not.
    expect(judgingMargin(high)).toBeLessThan(MEET_TUNING.DELIBERATION_MARGIN);
    expect(judgingMargin(high)).toBeGreaterThan(0);
    expect(judgingMargin(stalled)).toBe(1);
    expect(deliberates(judgingMargin(stalled))).toBe(false);
  });

  it('is not a constant — the styles give materially different answers', () => {
    // The check that the margin is MEASURED. A model that returned one number
    // would satisfy every bound above that happened to bracket it.
    //
    // Three distinct values from five styles, not five: `perfect` and `dumped`
    // both score 1 and SHOULD — a deep fast lift and a squat that never bent
    // are each unarguable, in opposite directions. That is the model agreeing
    // with itself, not a collapse.
    const margins = (['perfect', 'marginal', 'high', 'stalled', 'dumped'] as const).map((style) =>
      judgingMargin(playRep(CONFIG, style)),
    );
    expect(new Set(margins).size).toBeGreaterThanOrEqual(3);
    expect(Math.min(...margins)).toBeLessThan(MEET_TUNING.SPLIT_MARGIN);
    expect(Math.max(...margins)).toBeGreaterThan(MEET_TUNING.DELIBERATION_MARGIN);
  });

  it('doubts a grind more than a lift that went up fast', () => {
    // Both hit depth perfectly; only one of them ground. The doubt has to come
    // from the ascent, so a heavier bar on the same input scores lower.
    const fast = playRep({ kind: 'squat', loadRatio: 0.7, seed: 99 }, 'perfect');
    const ground = playRep({ kind: 'squat', loadRatio: 1.02, seed: 99 }, 'perfect');
    expect(ground.stallTicks).toBeGreaterThan(fast.stallTicks);
    expect(judgingMargin(ground)).toBeLessThan(judgingMargin(fast));
  });
});

describe('the three lights (GDD §6.2 step 4)', () => {
  const SEEDS = Array.from({ length: 200 }, (_unused, i) => i * 7919 + 13);
  const MARGINS = Array.from({ length: 21 }, (_unused, i) => i / 20);

  it('always give the majority to the mechanic’s own verdict', () => {
    // The refusal at the heart of the model: the panel dramatises the player's
    // input, it never overturns it. A made lift turned red on a die roll is the
    // "punishes you for showing up" failure of GDD §12.3 arriving through the
    // judges.
    let checked = 0;
    for (const seed of SEEDS) {
      for (const margin of MARGINS) {
        expect(isGoodLift(judgePanelFor(true, margin, seed))).toBe(true);
        expect(isGoodLift(judgePanelFor(false, margin, seed))).toBe(false);
        checked += 2;
      }
    }
    expect(checked).toBe(SEEDS.length * MARGINS.length * 2);
  });

  it('are always unanimous above the unanimous margin', () => {
    for (const seed of SEEDS) {
      for (const margin of [MEET_TUNING.UNANIMOUS_MARGIN, 0.8, 0.99, 1]) {
        expect(isSplitDecision(judgePanelFor(true, margin, seed)), `${seed}/${margin}`).toBe(false);
      }
    }
  });

  it('always split at or below the split margin', () => {
    for (const seed of SEEDS) {
      for (const margin of [0, MEET_TUNING.SPLIT_MARGIN / 2, MEET_TUNING.SPLIT_MARGIN]) {
        expect(isSplitDecision(judgePanelFor(true, margin, seed)), `${seed}/${margin}`).toBe(true);
      }
    }
  });

  it('interpolate in between — some seeds split and some do not', () => {
    // Non-vacuity for the two bounds above: without this a `dissentChance` that
    // returned a constant 1 or a constant 0 would pass one of them and the
    // other's band would never be reached.
    const middle = (MEET_TUNING.SPLIT_MARGIN + MEET_TUNING.UNANIMOUS_MARGIN) / 2;
    const splits = SEEDS.filter((seed) => isSplitDecision(judgePanelFor(true, middle, seed)));
    expect(splits.length).toBeGreaterThan(0);
    expect(splits.length).toBeLessThan(SEEDS.length);
  });

  it('put the dissenting referee in every seat over enough attempts', () => {
    // A model that always reddened the head referee would be a tell.
    const seats = new Set<number>();
    for (const seed of SEEDS) {
      const panel = judgePanelFor(true, 0, seed);
      panel.forEach((light, seat) => {
        if (light === 'red') seats.add(seat);
      });
    }
    expect(seats.size).toBe(3);
  });

  it('are deterministic — the same attempt judges the same way twice', () => {
    for (const seed of SEEDS.slice(0, 20)) {
      expect(judgePanelFor(true, 0.3, seed)).toEqual(judgePanelFor(true, 0.3, seed));
    }
  });

  it('let a deliberation end unanimously AND let one end split', () => {
    // The behavioural form of "the beat is not a tell". Across the sweep, both
    // outcomes must actually occur after a deliberation.
    let deliberatedAndUnanimous = 0;
    let deliberatedAndSplit = 0;
    for (const seed of SEEDS) {
      for (const margin of MARGINS) {
        if (!deliberates(margin)) continue;
        if (isSplitDecision(judgePanelFor(true, margin, seed))) deliberatedAndSplit += 1;
        else deliberatedAndUnanimous += 1;
      }
    }
    expect(deliberatedAndSplit).toBeGreaterThan(0);
    expect(deliberatedAndUnanimous).toBeGreaterThan(0);
  });

  it('seed a whole meet distinctly, so nine attempts are not one attempt', () => {
    const seeds = new Set<number>();
    for (const lift of LIFT_ORDER) {
      for (const attemptNumber of [1, 2, 3] as const) {
        seeds.add(judgeSeedFor(MEET_PREVIEW.DAY, lift, attemptNumber));
      }
    }
    expect(seeds.size).toBe(LIFT_ORDER.length * ATTEMPTS_PER_LIFT);
  });
});

describe('the feedback cue (GDD §6.2 step 5)', () => {
  const CONFIG = { kind: 'squat' as const, loadRatio: 0.9, seed: 4242 };

  it('names what actually happened, and differs by outcome', () => {
    const lines = (['perfect', 'marginal', 'high', 'stalled'] as const).map((style) => {
      const resolution = playRep(CONFIG, style);
      return feedbackTextFor(resolution, judgingMargin(resolution));
    });
    expect(new Set(lines).size).toBe(lines.length);
    expect(lines[2]).toBe(MEET_COPY.FEEDBACK_DEPTH_HIGH);
    expect(lines[3]).toBe(MEET_COPY.FEEDBACK_STALLED);
  });

  it('carries no number — GDD §3.4 / §12.3 allow a cue, never a meter', () => {
    for (const style of ['perfect', 'marginal', 'high', 'stalled'] as const) {
      const resolution = playRep(CONFIG, style);
      const line = feedbackTextFor(resolution, judgingMargin(resolution));
      expect(line, style).not.toMatch(/\d/);
    }
  });
});

// ---------------------------------------------------------------------------
// GDD §6.2 step 3 — readiness reaches the attempt and leaves no trace
// ---------------------------------------------------------------------------

describe('readiness silently adjusts the timing window (GDD §6.2 step 3)', () => {
  function tiredLedger(): FatigueState {
    let state: FatigueState = EMPTY_FATIGUE_STATE;
    for (const day of [MEET_PREVIEW.DAY - 2, MEET_PREVIEW.DAY - 1]) {
      state = recordSession(
        state,
        { day, lift: 'squat', topRpe: 10, workSets: 8, repsPerSet: 5 },
        LUCKIEST_ROLLS,
      ).state;
    }
    return state;
  }

  it('reaches the mechanic — a tired lifter gets a narrower window', () => {
    const rested = openedMeet({ ...previewContext(), fatigue: EMPTY_FATIGUE_STATE });
    const tired = openedMeet({ ...previewContext(), fatigue: tiredLedger() });
    const base = LIFT_TUNING.DEPTH_WINDOW_MS.squat;
    const restedWindow = adjustedTimingWindowMs(base, attemptConfigFor(rested).feel!);
    const tiredWindow = adjustedTimingWindowMs(base, attemptConfigFor(tired).feel!);
    expect(tiredWindow).toBeLessThan(restedWindow);
  });

  it('tightens as a meet goes on, so a third deadlift is not an opening squat', () => {
    const opened = openedMeet();
    const early = attemptConfigFor(opened);
    let late = opened;
    for (let i = 0; i < 2; i += 1) {
      late = take(late, 'perfect');
      late = chooseById(late, 'small');
    }
    const lateConfig = attemptConfigFor(late);
    expect(lateConfig.moment?.workSetsCompleted ?? 0).toBeGreaterThan(
      early.moment?.workSetsCompleted ?? 0,
    );
    const base = LIFT_TUNING.DEPTH_WINDOW_MS.squat;
    expect(adjustedTimingWindowMs(base, lateConfig.feel!, lateConfig.moment)).toBeLessThan(
      adjustedTimingWindowMs(base, early.feel!, early.moment),
    );
  });

  it('SILENTLY — no fatigue number reaches anything a screen can render', () => {
    // The information-flow form of GDD §12.3's "no visible fatigue meter". Two
    // meets differing ONLY in the hidden ledger must be byte-identical in
    // everything a component is handed. A grep for the word "fatigue" would
    // pass whatever the code did; this cannot.
    const rested = openedMeet({ ...previewContext(), fatigue: EMPTY_FATIGUE_STATE });
    const tired = openedMeet({ ...previewContext(), fatigue: tiredLedger() });
    const renderable = (state: MeetDayState): string => {
      const { context, ...rest } = state;
      const { fatigue: _hidden, ...visibleContext } = context;
      return JSON.stringify({ ...rest, context: visibleContext });
    };
    expect(renderable(rested)).toBe(renderable(tired));
    // ...and the ledgers really were different, so this is not comparing a
    // thing with itself.
    expect(JSON.stringify(rested.context.fatigue)).not.toBe(JSON.stringify(tired.context.fatigue));
  });
});

// ---------------------------------------------------------------------------
// GDD §6.3 — bombing out
// ---------------------------------------------------------------------------

describe('bombing out (GDD §6.3)', () => {
  function bombedSquat(): MeetDayState {
    const first = take(openedMeet(), 'dumped');
    const second = take(chooseById(first, 'repeat'), 'dumped');
    return take(chooseById(second, 'repeat'), 'dumped');
  }

  it('ends the meet on the lift it happened on', () => {
    const state = bombedSquat();
    expect(state.phase).toBe('bombed');
    expect(state.meet.phase.kind).toBe('complete');
    if (state.meet.phase.kind !== 'complete') throw new Error('unreachable');
    expect(state.meet.phase.outcome.kind).toBe('bombed-out');
    if (state.meet.phase.outcome.kind !== 'bombed-out') throw new Error('unreachable');
    expect(state.meet.phase.outcome.bombedLift).toBe('squat');
    expect(state.attempts.length).toBe(ATTEMPTS_PER_LIFT);
    for (const attempt of state.attempts) {
      expect(attempt.good).toBe(false);
    }
  });

  it('does NOT continue to the bench', () => {
    // The failure mode a "phase === 'bombed'" assertion alone would miss: the
    // engine ending the meet while the loop kept asking for attempts.
    const state = bombedSquat();
    expect(state.live).toBeNull();
    expect(attemptDecisionFor(state.meet, state.context.previousBestByLiftKg)).toBeNull();
    for (const event of [
      { kind: 'declare' as const, weightKg: 100 },
      { kind: 'walkout-done' as const },
      { kind: 'deliberation-done' as const },
      { kind: 'verdict-done' as const },
      { kind: 'confirm-openers' as const },
    ]) {
      const after = stepMeetDay(state, event);
      expect(after.phase, JSON.stringify(event)).toBe('bombed');
      expect(after.live).toBeNull();
    }
    expect(state.meet.lifts.bench.status).toBe('not-contested');
    expect(state.meet.lifts.deadlift.status).toBe('not-contested');
  });

  it('has NO total — which is not a total of zero', () => {
    const state = bombedSquat();
    expect(finalMeetTotal(state.meet)).toBeNull();
  });

  it('is reached the same way from a bench bomb, on a later lift', () => {
    // A bomb-out that only worked on the first lift would be a special case
    // dressed as a rule.
    const state = playMeet((lift) => (lift === 'bench' ? 'dumped' : 'perfect'), () => 'repeat');
    expect(state.phase).toBe('bombed');
    if (state.meet.phase.kind !== 'complete') throw new Error('unreachable');
    if (state.meet.phase.outcome.kind !== 'bombed-out') throw new Error('unreachable');
    expect(state.meet.phase.outcome.bombedLift).toBe('bench');
    expect(state.meet.lifts.squat.status).toBe('complete');
    expect(state.meet.lifts.squat.best).not.toBeNull();
    expect(state.meet.lifts.deadlift.status).toBe('not-contested');
  });

  it('is not reachable by two misses and a make', () => {
    // The positive control on the whole path: rescuing the lift on the third
    // attempt must NOT bomb, or "bombed" would just mean "missed something".
    const first = take(openedMeet(), 'dumped');
    const second = take(chooseById(first, 'repeat'), 'dumped');
    const third = take(chooseById(second, 'repeat'), 'perfect');
    expect(third.phase).not.toBe('bombed');
    expect(third.meet.lifts.squat.status).toBe('complete');
    expect(third.meet.lifts.squat.best).not.toBeNull();
  });

  it('still reports its attempts to the server', () => {
    const state = bombedSquat();
    const proposal = meetResultProposal(state);
    expect(proposal).not.toBeNull();
    const card = proposal?.report.card;
    if (card?.unit !== 'kg') throw new Error('the shipped meet is a kilogram meet');
    expect(card.kilogramAttempts.length).toBe(ATTEMPTS_PER_LIFT);
    expect(card.kilogramAttempts.every((attempt) => !attempt.good)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The machine's shape
// ---------------------------------------------------------------------------

describe('the meet-day machine', () => {
  it('walks weigh-in -> openers -> walkout -> lift -> deliberation -> verdict', () => {
    let state = createMeetDay(previewContext());
    expect(state.phase).toBe('weigh-in');
    state = stepMeetDay(state, { kind: 'confirm-weigh-in' });
    expect(state.phase).toBe('openers');
    state = stepMeetDay(state, { kind: 'confirm-openers' });
    expect(state.phase).toBe('walkout');
    state = stepMeetDay(state, { kind: 'walkout-done' });
    expect(state.phase).toBe('lift');
    const resolution = playRep(attemptConfigFor(state), 'perfect');
    state = stepMeetDay(state, { kind: 'lift-resolved', resolution });
    expect(state.phase).toBe('deliberation');
    state = stepMeetDay(state, { kind: 'deliberation-done' });
    expect(state.phase).toBe('verdict');
    state = stepMeetDay(state, { kind: 'verdict-done' });
    expect(state.phase).toBe('attempt-select');
  });

  it('never asks for an attempt-selection before an opener', () => {
    // Openers are declared at weigh-in (GDD §6.1), so the first attempt of each
    // lift goes straight onto the bar. A selection screen there would be asking
    // the lifter to choose a weight they already chose.
    const seen = everyDecisionIn(ALL_GOOD);
    expect(seen.length).toBe(LIFT_ORDER.length * (ATTEMPTS_PER_LIFT - 1));
    for (const { decision } of seen) {
      expect(decision.attemptNumber).not.toBe(1);
    }
  });

  it('takes the declared opener of each lift onto the bar as that lift starts', () => {
    let state = openedMeet();
    const openers = state.openersKg;
    const seenOpeners: number[] = [];
    let guard = 0;
    while (state.phase !== 'recap' && state.phase !== 'bombed' && guard < 64) {
      guard += 1;
      if (state.phase === 'attempt-select') {
        state = chooseById(state, 'small');
        continue;
      }
      const live = state.live;
      if (live === null) break;
      if (live.attemptNumber === 1) seenOpeners.push(live.weightKg);
      state = take(state, 'perfect');
    }
    expect(seenOpeners).toEqual(LIFT_ORDER.map((lift) => openers[lift]));
  });

  it('ignores an event that does not apply to the phase', () => {
    const fresh = createMeetDay(previewContext());
    for (const event of [
      { kind: 'walkout-done' as const },
      { kind: 'deliberation-done' as const },
      { kind: 'verdict-done' as const },
      { kind: 'declare' as const, weightKg: 200 },
      { kind: 'confirm-openers' as const },
    ]) {
      expect(stepMeetDay(fresh, event)).toEqual(fresh);
    }
  });

  it('refuses to build a meet for a lifter with no e1RM to open from', () => {
    expect(() =>
      createMeetDay({ ...previewContext(), bestE1rmKg: { squat: 0, bench: 120, deadlift: 220 } }),
    ).toThrow(RangeError);
  });

  it('replays identically — no clock and no randomness', () => {
    const a = playMeet(ALL_GOOD);
    const b = playMeet(ALL_GOOD);
    expect(JSON.stringify(a.attempts)).toBe(JSON.stringify(b.attempts));
    expect(finalMeetTotal(a.meet)).toBe(finalMeetTotal(b.meet));
  });
});

// ---------------------------------------------------------------------------
// GDD §6.5 — the recap
// ---------------------------------------------------------------------------

/**
 * A stand-in for the server's answer about a finished meet.
 *
 * `bestByLiftKg` IS READ OFF THE MEET rather than typed in, because it is the
 * one field here a wrong constant could make a whole call-out test vacuous: a
 * fabricated best that happens to sit under the fabricated previous best would
 * report FIRST for a lift that really did beat one, on every path, silently.
 * The two `previousBest*` defaults are the preview lifter's history, so a test
 * that wants a lifter with NO history has to say so — which is the case GDD
 * §6.5's defect lived in, and it is spelt out at the call site rather than being
 * the default nobody notices.
 */
function confirmedFor(meet: MeetState, overrides: Partial<{
  previousBestTotalKg: number | null;
  previousBestByLiftKg: Record<LiftKind, number | null>;
  isTotalPr: boolean;
  liftPrs: Record<LiftKind, boolean>;
  place: number | null;
  fieldSize: number;
}> = {}) {
  const totalKg = finalMeetTotal(meet);
  const bestByLiftKg: Record<LiftKind, number | null> = {
    squat: meet.lifts.squat.best,
    bench: meet.lifts.bench.best,
    deadlift: meet.lifts.deadlift.best,
  };
  return {
    totalKg,
    previousBestTotalKg:
      'previousBestTotalKg' in overrides
        ? (overrides.previousBestTotalKg ?? null)
        : MEET_PREVIEW.PREVIOUS_BEST_TOTAL_KG,
    isTotalPr: overrides.isTotalPr ?? false,
    liftPrs: overrides.liftPrs ?? { squat: false, bench: false, deadlift: false },
    bestByLiftKg,
    previousBestByLiftKg:
      overrides.previousBestByLiftKg ?? { ...MEET_PREVIEW.PREVIOUS_BEST_BY_LIFT_KG },
    placing: { place: overrides.place ?? 4, fieldSize: overrides.fieldSize ?? 16 },
  };
}

/** A lifter with no competition history at all: their first meet. */
const NO_HISTORY_BY_LIFT: Record<LiftKind, number | null> = {
  squat: null,
  bench: null,
  deadlift: null,
};

describe('the recap (GDD §6.5)', () => {
  it('shows every attempt, with the ones that stood and the ones that did not', () => {
    const state = playMeet(MISS_FIRST, () => 'repeat');
    expect(state.phase).toBe('recap');
    const built = buildMeetRecap(state, confirmedFor(state.meet));
    expect(built.ok).toBe(true);
    if (!built.ok) throw new Error(built.error.message);

    expect(built.recap.rows.length).toBe(LIFT_ORDER.length);
    let cells = 0;
    for (const row of built.recap.rows) {
      const taken = row.attempts.filter((attempt) => attempt !== null);
      expect(taken.length).toBe(ATTEMPTS_PER_LIFT);
      cells += taken.length;
      // The first attempt of every lift was missed on this path.
      expect(row.attempts[0]?.good).toBe(false);
      expect(row.attempts[1]?.good).toBe(true);
    }
    expect(cells).toBe(LIFT_ORDER.length * ATTEMPTS_PER_LIFT);
  });

  it('reads its total, DOTS and place off the card it hands off', () => {
    // GDD §6.5's card is the growth lever; a recap that printed different
    // numbers from the card beside it would be the one thing that cannot happen.
    const state = playMeet(ALL_GOOD);
    const built = buildMeetRecap(state, confirmedFor(state.meet, { place: 3 }));
    expect(built.ok).toBe(true);
    if (!built.ok) throw new Error(built.error.message);
    expect(built.recap.totalText).toBe(built.recap.card.summary[0].value);
    expect(built.recap.dotsText).toBe(built.recap.card.summary[1].value);
    expect(built.recap.placeText).toBe(built.recap.card.summary[2].value);
    expect(built.recap.placeText).toBe('3');
    expect(built.recap.card.totalKg).toBe(finalMeetTotal(state.meet));
  });

  it('REFUSES to assemble when the server total and the card disagree', () => {
    const state = playMeet(ALL_GOOD);
    const honest = confirmedFor(state.meet);
    const lying = { ...honest, totalKg: (honest.totalKg ?? 0) + 25 };
    expect(buildMeetRecap(state, honest).ok).toBe(true);
    const built = buildMeetRecap(state, lying);
    expect(built.ok).toBe(false);
    if (built.ok) throw new Error('unreachable');
    expect(built.error.code).toBe('TOTAL_DISAGREES_WITH_CARD');
  });

  it('calls out a competition PR, a first total, and neither', () => {
    const state = playMeet(ALL_GOOD);
    const pr = buildMeetRecap(state, confirmedFor(state.meet, { isTotalPr: true }));
    const first = buildMeetRecap(
      state,
      confirmedFor(state.meet, { isTotalPr: true, previousBestTotalKg: null }),
    );
    const neither = buildMeetRecap(state, confirmedFor(state.meet, { isTotalPr: false }));
    if (!pr.ok || !first.ok || !neither.ok) throw new Error('unreachable');
    expect(pr.recap.prText).toBe(MEET_COPY.RECAP_PR_TOTAL);
    expect(first.recap.prText).toBe(MEET_COPY.RECAP_FIRST_TOTAL);
    expect(first.recap.isFirstTotal).toBe(true);
    expect(neither.recap.prText).toBe(MEET_COPY.RECAP_NO_PR);
    expect(neither.recap.isFirstTotal).toBe(false);
  });

  it('marks a per-lift competition PR on the row it belongs to', () => {
    const state = playMeet(ALL_GOOD);
    const built = buildMeetRecap(
      state,
      confirmedFor(state.meet, { liftPrs: { squat: true, bench: false, deadlift: true } }),
    );
    if (!built.ok) throw new Error('unreachable');
    expect(built.recap.rows.map((row) => row.isPr)).toEqual([true, false, true]);
  });

  it('lands the Total on the card’s own text, not a rounded count-up', () => {
    // A competition total is a half-kilo number. The count-up shows whole kilos
    // while it is MOVING, and must land on `formatWeight`'s output — the exact
    // string the shareable card prints. A recap that finished on `613` for a
    // 612.5 kg meet would be wrong on the one screen whose whole job is that
    // number, and wrong in a way a screenshot shows and a bound does not.
    const state = playMeet(ALL_GOOD);
    const built = buildMeetRecap(state, confirmedFor(state.meet, { isTotalPr: true }));
    if (!built.ok) throw new Error(built.error.message);
    const recap = built.recap;
    const total = recap.totalKg ?? 0;
    // Non-vacuity: this meet really does total a half kilo, so a rounding bug
    // has something to round.
    expect(total).not.toBe(Math.round(total));

    expect(countedTotalText(recap, total)).toBe(recap.totalText);
    expect(recap.totalText).toBe(formatWeight(total));
    expect(countedTotalText(recap, total)).not.toBe(String(Math.round(total)));

    // Mid-count it reads whole kilos, and they climb.
    const start = recap.previousBestTotalKg ?? 0;
    const midway = start + (total - start) / 2;
    expect(countedTotalText(recap, midway)).toBe(String(Math.round(midway)));
    expect(Number(countedTotalText(recap, midway))).toBeLessThan(total);
  });

  it('prints the bar with the unit the MEET is run in, not one the screen typed', () => {
    // `AttemptView.tsx` printed `${formatWeight(live.weightKg)} kg` — a suffix
    // typed in a component, over a number that component cannot know the unit
    // of. `POUND_MEET_RULES` is exported, validates, and runs a full meet, so
    // that screen was lying to a player on a pound platform: 442.5 lb rendered
    // as "442.5 kg", 2.2x wrong, on the one line of the one screen showing what
    // is on the bar.
    //
    // A DISPLAY DEFECT, NOT A PROGRESSION ONE, and fixing it takes none of GDD
    // §11's three ways out: the engine still runs the pound meet and
    // `applyMeetResult` still refuses to record it.
    const kg = openedMeet();
    expect(kg.phase).toBe('walkout');
    expect(meetLoadingRules(kg.meet).unit).toBe('kg');
    expect(liveAttemptWeightText(kg)).toBe(`${formatWeight(kg.live?.weightKg ?? 0)} kg`);

    const poundMeet: MeetDefinition = { ...MEET_LOCAL, id: 'pound-open-2026', rules: POUND_MEET_RULES };
    const lb = openedMeet({ ...previewContext(), meet: poundMeet });
    expect(meetLoadingRules(lb.meet).unit).toBe('lb');
    expect(liveAttemptWeightText(lb)).toBe(`${formatWeight(lb.live?.weightKg ?? 0)} lb`);
    // THE DISCRIMINATOR: the two screens differ ONLY in the suffix, so a fix that
    // reached for the magnitude instead of the unit would fail here. (The openers
    // are suggested off the same kilogram e1RMs in both meets, which is a
    // separate open question and not this line's to answer.)
    expect(liveAttemptWeightText(lb)).not.toBe(liveAttemptWeightText(kg));
    expect(liveAttemptWeightText(lb).replace(' lb', '')).toBe(
      liveAttemptWeightText(kg).replace(' kg', ''),
    );

    // Nothing to print before there is an attempt on the bar.
    expect(liveAttemptWeightText(createMeetDay(previewContext()))).toBe('');
    // And the labels are exhaustive over the units a meet can be run in, so a
    // third one cannot be added to `meet.ts` without a label being chosen.
    expect(Object.keys(MEET_COPY.UNIT_LABEL).sort()).toEqual(['kg', 'lb']);
  });

  it('prints no total at all for a bombed lifter, whatever the counter says', () => {
    const state = playMeet((lift) => (lift === 'squat' ? 'dumped' : 'perfect'), () => 'repeat');
    const built = buildMeetRecap(state, {
      totalKg: null,
      previousBestTotalKg: MEET_PREVIEW.PREVIOUS_BEST_TOTAL_KG,
      isTotalPr: false,
      liftPrs: { squat: false, bench: false, deadlift: false },
      bestByLiftKg: { squat: null, bench: state.meet.lifts.bench.best, deadlift: null },
      previousBestByLiftKg: { ...MEET_PREVIEW.PREVIOUS_BEST_BY_LIFT_KG },
      placing: { place: null, fieldSize: MEET_LOCAL.ghostTotalsKg.length + 1 },
    });
    if (!built.ok) throw new Error(built.error.message);
    for (const counted of [0, 100, 600, Number.NaN]) {
      expect(countedTotalText(built.recap, counted)).toBe(built.recap.totalText);
      expect(countedTotalText(built.recap, counted)).not.toMatch(/\d/);
    }
  });

  it('gives a bombed lifter a card with no total, no DOTS and DQ in the place cell', () => {
    const state = playMeet((lift) => (lift === 'squat' ? 'dumped' : 'perfect'), () => 'repeat');
    expect(state.phase).toBe('bombed');
    const built = buildMeetRecap(state, {
      totalKg: null,
      previousBestTotalKg: MEET_PREVIEW.PREVIOUS_BEST_TOTAL_KG,
      isTotalPr: false,
      liftPrs: { squat: false, bench: false, deadlift: false },
      bestByLiftKg: { squat: null, bench: state.meet.lifts.bench.best, deadlift: null },
      previousBestByLiftKg: { ...MEET_PREVIEW.PREVIOUS_BEST_BY_LIFT_KG },
      // A bombed lifter does not place, and this is what `meetServer.ts`
      // actually returns for one.
      placing: { place: null, fieldSize: MEET_LOCAL.ghostTotalsKg.length + 1 },
    });
    expect(built.ok).toBe(true);
    if (!built.ok) throw new Error(built.error.message);
    expect(built.recap.totalKg).toBeNull();
    expect(built.recap.card.totalKg).toBeNull();
    expect(built.recap.placeText).toBe('DQ');
    expect(built.recap.bombedLift).toBe('squat');
    expect(built.recap.rows[0]?.bombed).toBe(true);
    expect(built.recap.rows[0]?.bestKg).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// GDD §6.5 — "PR" means one thing, across §6.3's screen and the recap
// ---------------------------------------------------------------------------
//
// WHAT THE DEFECT WAS, so a reader can tell what these tests are for. A first
// meet chose nine attempts with no PR call-out anywhere — `isPrAttempt` needs a
// record to beat and a fresh lifter has none — and then printed "PR" against all
// three lifts on the recap that followed, because `liftPrs` reads a null
// previous best as beaten. Both computations were right; one word carried two
// facts. GDD §6.5 ruled the split lands on the DISPLAY, not on the arithmetic.
//
// THE MEETS BELOW ARE PLAYED AND THEN RECORDED THROUGH THE REAL SERVER. Nothing
// here hands `buildMeetRecap` a hand-written `liftPrs`: `applyMeetResult` is
// asked, so a change to ITS null handling reaches these assertions rather than
// stopping at `meetServer.test.ts`. That is why this block is not written
// against `confirmedFor`, which is a fixture and would absorb exactly that.

/** One meet, played to its ending, with every §6.3 option it offered on the way. */
function playWatchingSelection(
  context: MeetDayContext,
  choose: (lift: LiftKind, attemptNumber: number) => 'repeat' | 'small' | 'big' = () => 'small',
): { options: AttemptOption[]; state: MeetDayState } {
  const options: AttemptOption[] = [];
  let state = openedMeet(context);
  let guard = 0;
  while (state.phase !== 'recap' && state.phase !== 'bombed' && guard < 64) {
    guard += 1;
    if (state.phase === 'attempt-select') {
      const decision = decisionOf(state);
      options.push(...decision.options);
      state = chooseOrFallBack(state, choose(decision.lift, decision.attemptNumber));
      continue;
    }
    const live = state.live;
    if (live === null) break;
    state = take(state, 'perfect');
  }
  return { options, state };
}

/** The lifter the preview describes, with their competition history removed. */
function firstMeetContext(meetId?: string): MeetDayContext {
  const base = previewContext();
  return {
    ...base,
    ...(meetId === undefined ? {} : { meet: { ...base.meet, id: meetId } }),
    previousBestTotalKg: null,
    previousBestByLiftKg: NO_HISTORY_BY_LIFT,
  };
}

/**
 * Record a played meet through the real server and build the recap for it.
 *
 * The meet DEFINITION is the one the state was played under, so the id on the
 * proposal and the id the server checks are the same object rather than two
 * that could drift — `applyMeetResult` refuses a mismatch, and a test that hit
 * that refusal would look like a call-out failure.
 */
function recapThroughTheServer(
  state: MeetDayState,
  record: ServerRecord,
  proposalId: string,
): { recap: MeetRecap; applied: AppliedMeetResult } {
  const proposal = meetResultProposal(state);
  if (proposal === null) throw new Error('the played meet produced no proposal');
  const applied = applyMeetResult(record, state.context.day, state.context.meet, proposal, proposalId);
  if (!applied.ok) throw new Error(applied.error.message);
  const built = buildMeetRecap(state, applied.value);
  if (!built.ok) throw new Error(built.error.message);
  return { recap: built.recap, applied: applied.value };
}

/** A stored meet, so a lifter can walk onto the platform holding numbers. */
function recordHolding(bestByLift: Record<LiftKind, number | null>, totalKg: number): ServerRecord {
  return {
    ...newServerRecord(0),
    totalKg,
    meets: [
      {
        meetId: 'an-earlier-meet',
        meetDayIndex: 1,
        totalKg,
        bestByLift,
        bodyweightKg: MEET_ENTRY.bodyweight.kilograms,
      },
    ],
  };
}

const CALL_OUT_TEXT = { pr: MEET_COPY.RECAP_PR_LIFT, first: MEET_COPY.RECAP_FIRST_LIFT } as const;

describe('the per-lift call-out on the recap (GDD §6.5)', () => {
  it('[the-pr-word-needs-a-record-to-beat] says FIRST with no record to beat, and PR only where one was beaten', () => {
    // ---- the lifter's first meet, played and recorded for real ------------
    const played = playWatchingSelection(firstMeetContext());
    expect(played.state.phase, 'the first meet reached its recap').toBe('recap');
    const first = recapThroughTheServer(played.state, newServerRecord(0), 'callout-first');

    // THE WORDS THE BOARD PRINTS, FIRST, because they are what the player reads
    // and because the two mutants this test is witnessed against land here from
    // opposite directions: a single-state call-out prints three PRs, and a
    // `liftPrs` that refuses a null previous best prints three nothings.
    const firstWords = first.recap.rows.map((row) => row.callOut?.text ?? null);
    expect(firstWords, 'the three words a first meet prints beside its lifts').toEqual([
      CALL_OUT_TEXT.first,
      CALL_OUT_TEXT.first,
      CALL_OUT_TEXT.first,
    ]);
    expect(
      firstWords.filter((word) => word === CALL_OUT_TEXT.pr).length,
      'lifts a first meet calls a PR — the defect called three',
    ).toBe(0);
    expect(first.recap.rows.map((row) => row.callOut?.kind ?? null)).toEqual([
      'first',
      'first',
      'first',
    ]);

    // The SERVER's answer is unchanged and stays unchanged: a first-ever
    // competition lift IS the best on record. That is the retrospective half,
    // this piece did not touch it, and GDD §7.2's cut-in still reads it.
    expect(first.applied.liftPrs).toEqual({ squat: true, bench: true, deadlift: true });
    expect(first.recap.rows.map((row) => row.isPr)).toEqual([true, true, true]);

    // THE CROSS-SCREEN HALF, ON THE SAME PLAYED MEET. §6.3's screen flagged no
    // option as a PR attempt, because this lifter had nothing to beat. The two
    // screens now say the same thing about the same meet, and the count of
    // options scanned says the sweep had something to look at.
    expect(played.options.length, 'options §6.3 offered across the first meet').toBe(12);
    expect(
      played.options.filter((option) => option.isPrAttempt).length,
      'PR-flagged cards on a first meet',
    ).toBe(0);
    expect(
      played.options.filter((option) => option.prNote !== null).length,
      'cards carrying §6.3’s PR sentence on a first meet',
    ).toBe(0);

    // ---- the same meet, by a lifter who walked in holding numbers ---------
    // One below, one exactly equal, one above — so the three lifts take all
    // three answers and no branch is reached three times.
    const made = first.applied.bestByLiftKg;
    const squatKg = made.squat ?? 0;
    const benchKg = made.bench ?? 0;
    const deadliftKg = made.deadlift ?? 0;
    const held: Record<LiftKind, number | null> = {
      squat: squatKg - 5,
      bench: benchKg,
      deadlift: deadliftKg + 5,
    };
    const again = playWatchingSelection(firstMeetContext('local-open-second'));
    const second = recapThroughTheServer(
      again.state,
      recordHolding(held, (held.squat ?? 0) + (held.bench ?? 0) + (held.deadlift ?? 0)),
      'callout-second',
    );
    // The meet replayed identically, so `held` really is one below, one level
    // with and one above what this lifter put on the board.
    expect(second.applied.bestByLiftKg).toEqual(made);
    const secondWords = second.recap.rows.map((row) => row.callOut?.text ?? null);
    expect(secondWords, `made ${JSON.stringify(made)} against held ${JSON.stringify(held)}`).toEqual([
      CALL_OUT_TEXT.pr,
      null,
      null,
    ]);
    expect(
      secondWords.filter((word) => word === CALL_OUT_TEXT.first).length,
      'lifts a lifter with a record is told are their first',
    ).toBe(0);
    // EQUALLING A RECORD IS NOT BEATING IT, spelt out rather than left inside
    // the array above: the bench matched to the kilo and got no call-out.
    expect(held.bench).toBe(made.bench);
    expect(second.recap.rows[1]?.isPr).toBe(false);
    expect(second.recap.rows[1]?.callOut).toBeNull();
  });

  it('draws a call-out exactly when the server calls the lift a best', () => {
    // The invariant that keeps `isPr` and `callOut` from drifting apart: GDD
    // §7.2's cut-in beat reads the first, the board prints the second, and a
    // state where one fires without the other is a screen celebrating a record
    // it does not name, or naming one it does not celebrate.
    let rows = 0;
    let agreed = 0;
    const legs: { record: ServerRecord; id: string }[] = [
      { record: newServerRecord(0), id: 'agree-fresh' },
      { record: recordHolding({ squat: 500, bench: 500, deadlift: 500 }, 1500), id: 'agree-unbeatable' },
      { record: recordHolding({ squat: 1, bench: null, deadlift: 1 }, 300), id: 'agree-mixed' },
    ];
    for (const leg of legs) {
      const played = playWatchingSelection(firstMeetContext(leg.id));
      const { recap } = recapThroughTheServer(played.state, leg.record, leg.id);
      for (const row of recap.rows) {
        rows += 1;
        if ((row.callOut !== null) === row.isPr) agreed += 1;
        expect(row.callOut !== null, `${leg.id} ${row.lift}: callOut against isPr`).toBe(row.isPr);
      }
    }
    expect(rows, 'recap rows compared').toBe(9);
    expect(agreed, 'rows where the call-out and the server agreed').toBe(9);
  });

  it('prints nothing beside a lift with no good attempt on it', () => {
    // A lift with no good attempt is not a first and not a PR, whatever the
    // lifter holds — the empty case neither branch above reaches. A bomb-out
    // ENDS THE MEET, so all three rows are that case here: the squat has three
    // misses and the other two were never contested at all.
    const state = playMeet((lift) => (lift === 'squat' ? 'dumped' : 'perfect'), () => 'repeat');
    expect(state.phase).toBe('bombed');
    const bombed = recapThroughTheServer(state, newServerRecord(0), 'callout-bombed');
    expect(bombed.applied.bombedLift).toBe('squat');
    expect(bombed.applied.bestByLiftKg).toEqual({ squat: null, bench: null, deadlift: null });
    expect(bombed.recap.rows.map((row) => row.callOut)).toEqual([null, null, null]);
    expect(bombed.recap.rows.map((row) => row.isPr)).toEqual([false, false, false]);

    // THE POSITIVE CONTROL, on the same fresh record, because "no call-outs"
    // read on its own is also what a build with the feature deleted returns.
    // The same lifter who totals gets three.
    const totalled = playWatchingSelection(firstMeetContext('local-open-control'));
    const control = recapThroughTheServer(totalled.state, newServerRecord(0), 'callout-control');
    expect(control.recap.rows.filter((row) => row.callOut !== null).length).toBe(3);
  });

  it('is the same predicate §6.3 paints its gold border from', () => {
    // `beatsPreviousBest` over the grid of (weight, previous best) the surfaces
    // can present it with, including the null column that is this piece's whole
    // subject. The oracle is in words rather than a second copy of the
    // expression: a PR needs a number to beat, and has to exceed it.
    const weights = [0, 100, 199.5, 200, 200.5, 300];
    const bests: (number | null)[] = [null, 0, 200];
    let asked = 0;
    let trues = 0;
    for (const weight of weights) {
      for (const best of bests) {
        asked += 1;
        const expected = best !== null && weight > best;
        if (expected) trues += 1;
        expect(beatsPreviousBest(weight, best), `${weight} vs ${String(best)}`).toBe(expected);
      }
    }
    expect(asked, 'pairs swept').toBe(18);
    // 5 of the 6 weights beat a held 0 (a bar-weight 0 does not beat itself),
    // 2 of the 6 beat a held 200, and none of the 6 beats a null.
    expect(trues, 'pairs the predicate calls a PR').toBe(7);
    expect(beatsPreviousBest(200, 200)).toBe(false);
    expect(beatsPreviousBest(200.5, 200)).toBe(true);
    // The null column is uniformly false — the half `liftPrs` reads the other
    // way round, and the disagreement this piece is about.
    expect(weights.every((weight) => !beatsPreviousBest(weight, null))).toBe(true);
  });

  it('takes the server’s answer instead of re-deriving it', () => {
    // CLIENT IS A RENDERER. `liftCallOutFor` is handed `isPr` and does not
    // recompute it: a caller that says "not a best" gets no call-out even where
    // the kilograms would say otherwise, and a caller that says "a best" gets
    // one even where they would not. Both directions, because a helper that
    // quietly second-guessed the server is the shape a THIRD meaning arrives in.
    expect(liftCallOutFor(false, 300, 200)).toBeNull();
    expect(liftCallOutFor(true, 100, 200)?.kind).toBe('first');
    expect(liftCallOutFor(true, 300, 200)?.kind).toBe('pr');
    expect(liftCallOutFor(true, 300, null)?.kind).toBe('first');
    expect(liftCallOutFor(true, null, null)?.kind).toBe('first');
    expect(liftCallOutFor(true, null, 200)?.kind).toBe('first');
    // And the words are the tuning module's, not this test's.
    expect(liftCallOutFor(true, 300, 200)?.text).toBe(MEET_COPY.RECAP_PR_LIFT);
    expect(liftCallOutFor(true, 300, null)?.text).toBe(MEET_COPY.RECAP_FIRST_LIFT);
    expect(MEET_COPY.RECAP_PR_LIFT).not.toBe(MEET_COPY.RECAP_FIRST_LIFT);
  });

  it('does not put a call-out on the shareable card, which is a federation sheet', () => {
    // GDD §6.5: the card is "formatted like a real federation result sheet",
    // and a result sheet records weights rather than editorial. So the third
    // surface the §6.5 ruling names carries NO per-lift PR fact at all, which
    // is why reconciling the word did not have to reach it.
    //
    // Pinned so that adding one becomes a deliberate edit that comes back to
    // this ruling rather than a fourth place the word appears. Measured on a
    // card built for a lifter with no history — the case that used to print PR
    // three times on the recap beside it.
    const played = playWatchingSelection(firstMeetContext());
    const { recap } = recapThroughTheServer(played.state, newServerRecord(0), 'callout-card');
    const card = recap.card;
    const cardText = [
      ...card.rows.flatMap((row) => [row.label, row.bestText, ...row.attempts.map((cell) => cell.text)]),
      ...card.summary.flatMap((cell) => [cell.label, cell.value]),
    ];
    expect(cardText.length, 'card cells scanned').toBe(21);
    expect(
      cardText.filter((cell) => cell === CALL_OUT_TEXT.pr || cell === CALL_OUT_TEXT.first),
      'card cells carrying a PR or FIRST call-out',
    ).toEqual([]);
    // ...and the recap beside it does carry them, so the scan above is not
    // measuring a card that had nothing on it in the first place.
    expect(recap.rows.filter((row) => row.callOut !== null).length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// The report that goes on the wire
// ---------------------------------------------------------------------------

describe('what the client reports', () => {
  it('carries the card and nothing that could be a total', () => {
    const state = playMeet(ALL_GOOD);
    const proposal = meetResultProposal(state);
    expect(proposal).not.toBeNull();
    if (proposal === null) throw new Error('unreachable');
    expect(Object.keys(proposal.report).sort()).toEqual(['bodyweight', 'card', 'meetId']);
    const serialised = JSON.stringify(proposal).toLowerCase();
    expect(serialised).not.toContain('total');
    const card = proposal.report.card;
    if (card.unit !== 'kg') throw new Error('the shipped meet is a kilogram meet');
    expect(Object.keys(card).sort()).toEqual(['kilogramAttempts', 'unit']);
    for (const attempt of card.kilogramAttempts) {
      // `weight`, not `weightKg`. The row makes no unit claim; the card does.
      expect(Object.keys(attempt).sort()).toEqual(['attemptNumber', 'good', 'lift', 'weight']);
    }
  });

  it('takes the card’s unit off the meet the weights were declared into', () => {
    // FORWARDED, NOT STAMPED, the same way the bodyweight is. If this function
    // typed `'kg'` here, `meetServer.ts`'s cross-check would be comparing one
    // hard-coded literal against another and would pass for every meet.
    //
    // The pound half is the one that bites: the loop runs a pound meet end to
    // end (`meet.ts` exports the rules and `MeetDefinition.rules` takes them),
    // and the card that comes out has to SAY so, or the server is back to
    // reading nine pound numbers as kilograms.
    const kgState = playMeet(ALL_GOOD);
    expect(kgState.context.meet.rules.unit).toBe('kg');
    expect(meetResultCard(kgState).unit).toBe('kg');

    const poundMeet: MeetDefinition = { ...MEET_LOCAL, id: 'pound-open-2026', rules: POUND_MEET_RULES };
    const poundState = playMeet(ALL_GOOD, () => 'small', { ...previewContext(), meet: poundMeet });
    expect(poundState.context.meet.rules.unit).toBe('lb');
    const poundCard = meetResultCard(poundState);
    expect(poundCard.unit).toBe('lb');
    if (poundCard.unit !== 'lb') throw new Error('unreachable');
    expect(poundCard.poundAttempts.length).toBeGreaterThan(0);
    // And the rows are the same nine numbers either way — nothing about the
    // weights themselves tells the units apart, which is why the tag exists.
    expect(poundCard.poundAttempts.map((a) => a.weight)).toEqual(
      meetAttemptReports(poundState).map((a) => a.weight),
    );
  });

  it('is null while the meet is still running', () => {
    expect(meetResultProposal(createMeetDay(previewContext()))).toBeNull();
    expect(meetResultProposal(openedMeet())).toBeNull();
    expect(meetResultProposal(take(openedMeet(), 'perfect'))).toBeNull();
  });

  it('reports exactly what was on the bar and what the lights said', () => {
    const state = playMeet(MISS_FIRST, () => 'repeat');
    const reports = meetAttemptReports(state);
    expect(reports.length).toBe(state.attempts.length);
    reports.forEach((report, index) => {
      const attempt = state.attempts[index];
      expect(report.weight).toBe(attempt?.weightKg);
      expect(report.good).toBe(attempt?.good);
      expect(report.good).toBe(isGoodLift(attempt?.lights ?? ['red', 'red', 'red']));
    });
  });
});

// ---------------------------------------------------------------------------
// The preview route
// ---------------------------------------------------------------------------

describe('the ?meet= preview beats', () => {
  it('each land on the phase they name', () => {
    const expected: Record<string, string> = {
      'weigh-in': 'weigh-in',
      openers: 'openers',
      walkout: 'walkout',
      'walkout-third': 'walkout',
      // The two mid-motion photographs of the third attempt. Same state as
      // `walkout-third`; what differs is only which instant of the walk-out's
      // choreography is held (`holdWalkoutAtMs`).
      'walkout-unrack': 'walkout',
      'walkout-step': 'walkout',
      lift: 'lift',
      deliberation: 'deliberation',
      'verdict-good': 'verdict',
      // A GOOD LIFT ON AN URGENT ATTEMPT — the only moment that reaches
      // CROWD.URGENT_CHEER_RISE_PX, which had no preview and so had never been
      // drawn to a screen. Same phase as the calm one on purpose: what differs
      // is the attempt's stakes, not the beat.
      'verdict-good-urgent': 'verdict',
      'verdict-split': 'verdict',
      'verdict-no-lift': 'verdict',
      'verdict-split-red': 'verdict',
      'select-after-make': 'attempt-select',
      'select-after-miss': 'attempt-select',
      bombed: 'bombed',
      recap: 'recap',
      'recap-card': 'recap',
    };
    // Every moment the module declares is in the table, so a new beat cannot be
    // added and silently go unchecked.
    expect(Object.keys(expected).sort()).toEqual([...MEET_MOMENTS].sort());
    for (const [moment, phase] of Object.entries(expected)) {
      const state = previewStateFor({ moment: moment as never });
      expect(state.phase, moment).toBe(phase);
    }
  });

  it('show what they claim to show, not just the right phase', () => {
    // A capture harness that photographed three copies of the same screen has
    // already happened once in this project. These are the semantic checks.
    const good = previewStateFor({ moment: 'verdict-good' });
    const split = previewStateFor({ moment: 'verdict-split' });
    const noLift = previewStateFor({ moment: 'verdict-no-lift' });
    expect(good.call?.split).toBe(false);
    expect(good.call?.good).toBe(true);
    expect(split.call?.split).toBe(true);
    expect(split.call?.good).toBe(true);
    expect(noLift.call?.good).toBe(false);
    expect(noLift.call?.split).toBe(false);
    // The one that proves the deliberation beat is not a tell: a split panel
    // whose majority is RED, reached the same way a split white one is.
    const splitRed = previewStateFor({ moment: 'verdict-split-red' });
    expect(splitRed.call?.good).toBe(false);
    expect(splitRed.call?.split).toBe(true);
    expect(splitRed.call?.deliberated).toBe(true);

    const deliberation = previewStateFor({ moment: 'deliberation' });
    expect(deliberation.call?.deliberated).toBe(true);

    const third = previewStateFor({ moment: 'walkout-third' });
    expect(third.live?.attemptNumber).toBe(ATTEMPTS_PER_LIFT);
    expect(third.live?.bombRisk).toBe(true);
    const opener = previewStateFor({ moment: 'walkout' });
    expect(opener.live?.attemptNumber).toBe(1);
    expect(third.live?.walkoutMs ?? 0).toBeGreaterThan(opener.live?.walkoutMs ?? 0);

    const afterMake = previewStateFor({ moment: 'select-after-make' });
    const afterMiss = previewStateFor({ moment: 'select-after-miss' });
    expect(decisionOf(afterMake).floorRaisedByMiss).toBe(false);
    expect(decisionOf(afterMiss).floorRaisedByMiss).toBe(true);
  });

  it('reach the bomb-out through the engine’s own rule', () => {
    const bombed = previewStateFor({ moment: 'bombed' });
    if (bombed.meet.phase.kind !== 'complete') throw new Error('unreachable');
    expect(bombed.meet.phase.outcome.kind).toBe('bombed-out');
  });

  it('reach the recap with a real total', () => {
    const recap = previewStateFor({ moment: 'recap' });
    const total = finalMeetTotal(recap.meet);
    expect(total).not.toBeNull();
    expect(total ?? 0).toBeGreaterThan(0);
  });
});

describe('the meet engine stays the authority', () => {
  it('reads its floor straight off currentAttemptContext', () => {
    // The property the whole §6.3 screen leans on: the number the screen shouts
    // and the number the engine enforces are the SAME value, not two that agree
    // today.
    for (const seen of [everyDecisionIn(ALL_GOOD), everyDecisionIn(MISS_FIRST, () => 'repeat')]) {
      expect(seen.length).toBeGreaterThan(0);
      for (const { decision, state } of seen) {
        const context = currentAttemptContext(state.meet);
        expect(context?.minimumWeight).toBe(decision.floorKg);
        expect(context?.mayRepeatWeight).toBe(decision.floorRaisedByMiss);
      }
    }
  });

  it('declares every attempt on the meet’s own rules', () => {
    const state = openedMeet();
    expect(meetLoadingRules(state.meet)).toEqual(MEET_LOCAL.rules);
  });

  it('never lets the loop decide a lift is good', () => {
    // `judgeAttempt` reports the ENGINE's reading of the panel it built, so a
    // model that decided "good" separately from the lights would show up here.
    for (const style of ['perfect', 'marginal', 'high', 'stalled'] as const) {
      const resolution = playRep({ kind: 'squat', loadRatio: 0.9, seed: 777 }, style);
      const call = judgeAttempt(resolution, 12345);
      expect(call.good).toBe(isGoodLift(call.lights));
      expect(call.split).toBe(isSplitDecision(call.lights));
      expect(call.good).toBe(resolution.outcome !== 'miss');
    }
  });
});
