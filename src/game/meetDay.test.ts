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
  liveAttemptWeightText,
  meetAttemptReports,
  meetResultCard,
  meetResultProposal,
  stepMeetDay,
  suggestedOpeners,
  weighInFor,
  type AttemptDecision,
  type MeetDayContext,
  type MeetDayState,
} from './meetDay';
import {
  MEET_COPY,
  MEET_ENTRY,
  MEET_LOCAL,
  MEET_PREVIEW,
  MEET_TUNING,
  type MeetDefinition,
} from './meetTuning';
import {
  MEET_MOMENTS,
  playMeet,
  playRep,
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
  const CONFIG = { loadRatio: 0.9, seed: 4242 };

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
    const fast = playRep({ loadRatio: 0.7, seed: 99 }, 'perfect');
    const ground = playRep({ loadRatio: 1.02, seed: 99 }, 'perfect');
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
  const CONFIG = { loadRatio: 0.9, seed: 4242 };

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
    const base = LIFT_TUNING.DEPTH_WINDOW_MS;
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
    const base = LIFT_TUNING.DEPTH_WINDOW_MS;
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

function confirmedFor(meet: MeetState, overrides: Partial<{
  previousBestTotalKg: number | null;
  isTotalPr: boolean;
  liftPrs: Record<LiftKind, boolean>;
  place: number | null;
  fieldSize: number;
}> = {}) {
  const totalKg = finalMeetTotal(meet);
  return {
    totalKg,
    previousBestTotalKg:
      'previousBestTotalKg' in overrides
        ? (overrides.previousBestTotalKg ?? null)
        : MEET_PREVIEW.PREVIOUS_BEST_TOTAL_KG,
    isTotalPr: overrides.isTotalPr ?? false,
    liftPrs: overrides.liftPrs ?? { squat: false, bench: false, deadlift: false },
    placing: { place: overrides.place ?? 4, fieldSize: overrides.fieldSize ?? 16 },
  };
}

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
      const resolution = playRep({ loadRatio: 0.9, seed: 777 }, style);
      const call = judgeAttempt(resolution, 12345);
      expect(call.good).toBe(isGoodLift(call.lights));
      expect(call.split).toBe(isSplitDecision(call.lights));
      expect(call.good).toBe(resolution.outcome !== 'miss');
    }
  });
});
