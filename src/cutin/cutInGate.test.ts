/**
 * cutInGate.test.ts — the checks that have to go red when the gate breaks.
 *
 * THE STANDARD THIS FILE IS WRITTEN TO. This run has repeatedly turned up
 * checks that could not fail if the thing they named were broken. Every
 * assertion below was written by BREAKING THE CODE FIRST and confirming a named
 * test went red; the four breakages are listed in the piece's report.
 *
 * Two rules follow from that and are worth stating because they are what stops
 * a green suite meaning nothing:
 *
 *   1. NO EXPECTATION IS DERIVED FROM THE CONSTANT THE CODE READS. The cap is
 *      asserted to be 1, spelled `1`, not `CUT_IN_TUNING.MAX_PER_SESSION`.
 *      GDD §7.2's four moments are spelled out one at a time. A test that read
 *      the same table as the code would stay green through any edit to it,
 *      which is the exact shape of blindness this file exists not to have.
 *   2. EVERY SWEEP IS BOUNDED ON BOTH SIDES. "Some sessions fire" and "not
 *      every session fires" are two assertions, because a gate that never fires
 *      passes the second one on its own and is just as broken.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { auditSource, codeOnly, formatFindings, withoutComments } from '../tuning/audit';
import {
  CUT_IN_MOMENTS,
  CUT_IN_MOMENT_PRIORITY,
  CUT_IN_RECORD_KINDS,
  CUT_IN_REFUSALS,
  canDismissAt,
  cutInAutoDismissMs,
  cutInExpiredAt,
  cutInSessionId,
  cutInSessionSeed,
  dismissCutIn,
  identityForMoment,
  isCutInMoment,
  momentFor,
  momentsFor,
  openCutInSession,
  requestCutIn,
  tapDismissCutIn,
  type CutInBeat,
  type CutInMoment,
  type CutInSessionState,
} from './cutInGate';
import { CUT_IN_ART, CUT_IN_COPY, CUT_IN_TUNING } from './cutInTuning';

const HERE = path.dirname(fileURLToPath(import.meta.url));

function source(file: string): string {
  return readFileSync(path.join(HERE, file), 'utf8');
}

// ---------------------------------------------------------------------------
// Fixtures. Spelled out rather than built from the module's own tables.
// ---------------------------------------------------------------------------

/** GDD §6.2: three attempts per lift. Passed in so a beat reads off the sport. */
const ATTEMPTS_PER_LIFT = 3;

/**
 * A third attempt WITH SOMETHING ALREADY BANKED on this lift. The lift cannot
 * bomb from here, so no bomb-out beat is coming and the walk-out may take the
 * slot. `bombRisk` is `meetDay.ts`'s own field, spelled out rather than derived.
 */
const THIRD_ATTEMPT_WALKOUT: CutInBeat = {
  kind: 'meet-walkout',
  attemptNumber: 3,
  attemptsPerLift: ATTEMPTS_PER_LIFT,
  bombRisk: false,
};

/**
 * The same attempt with NOTHING banked — `meetDay.ts`:
 * `bombRisk = attemptNumber === ATTEMPTS_PER_LIFT && banked === null`.
 * A miss here ends the meet, so this walk-out is the one that must not spend
 * the slot.
 */
const THIRD_ATTEMPT_WALKOUT_NOTHING_BANKED: CutInBeat = {
  kind: 'meet-walkout',
  attemptNumber: 3,
  attemptsPerLift: ATTEMPTS_PER_LIFT,
  bombRisk: true,
};

const OPENER_WALKOUT: CutInBeat = {
  kind: 'meet-walkout',
  attemptNumber: 1,
  attemptsPerLift: ATTEMPTS_PER_LIFT,
  bombRisk: false,
};

const SECOND_ATTEMPT_WALKOUT: CutInBeat = {
  kind: 'meet-walkout',
  attemptNumber: 2,
  attemptsPerLift: ATTEMPTS_PER_LIFT,
  bombRisk: false,
};

const NEW_E1RM: CutInBeat = { kind: 'record', record: 'e1rm', achieved: true };
const NEW_TOTAL: CutInBeat = { kind: 'record', record: 'total', achieved: true };
const NEW_TIER: CutInBeat = { kind: 'record', record: 'tier', achieved: true };
const NO_E1RM_RECORD: CutInBeat = { kind: 'record', record: 'e1rm', achieved: false };

const BOMBED_OUT: CutInBeat = { kind: 'meet-over', bombedOut: true };
const MEET_FINISHED_CLEAN: CutInBeat = { kind: 'meet-over', bombedOut: false };

/**
 * A near-maximal top set and an ordinary one. The two ratios are HARD-CODED so
 * that the pair straddles `COACH_HEAVY_SET_LOAD_RATIO` without reading it —
 * `the heavy-set threshold sits between the two probes` below is what keeps
 * that straddle honest if somebody moves the constant.
 */
const HEAVY_TOP_SET: CutInBeat = { kind: 'work-set', loadRatio: 0.99, isTopSet: true };
const LIGHT_TOP_SET: CutInBeat = { kind: 'work-set', loadRatio: 0.6, isTopSet: true };
const HEAVY_BACK_OFF_SET: CutInBeat = { kind: 'work-set', loadRatio: 0.99, isTopSet: false };

/** How far to search for a seed whose rates let a moment through. */
const SEED_SEARCH_LIMIT = 5000;

/**
 * A session whose §7.2 rates allow every named moment.
 *
 * Found by SEARCHING REAL SEEDS rather than by hand-building a state, so these
 * tests run through `openCutInSession` and its roll exactly as the app does. A
 * moment whose rate were 0 would make this throw, which is the right failure:
 * a moment that can never be allowed cannot be tested for firing either.
 */
function sessionAllowing(
  moments: readonly CutInMoment[],
  sessionId: string = 'a-sitting',
): CutInSessionState {
  for (let seed = 0; seed < SEED_SEARCH_LIMIT; seed += 1) {
    const state = openCutInSession({ sessionId, seed });
    if (moments.every((moment) => state.allowed[moment])) return state;
  }
  throw new Error(`no seed under ${SEED_SEARCH_LIMIT} allows ${moments.join(', ')}`);
}

/** A session whose rates hold the named moment back. */
function sessionHoldingBack(moment: CutInMoment, sessionId: string = 'a-sitting'): CutInSessionState {
  for (let seed = 0; seed < SEED_SEARCH_LIMIT; seed += 1) {
    const state = openCutInSession({ sessionId, seed });
    if (!state.allowed[moment]) return state;
  }
  throw new Error(`no seed under ${SEED_SEARCH_LIMIT} holds back ${moment}`);
}

function firedMoment(state: CutInSessionState, beats: readonly CutInBeat[]): CutInMoment | null {
  const decision = requestCutIn(state, beats);
  return decision.outcome.kind === 'fire' ? decision.outcome.live.moment : null;
}

// ---------------------------------------------------------------------------
// GDD §7.2's four firing moments
// ---------------------------------------------------------------------------

describe('the firing moments are GDD §7.2’s four, and the list is load-bearing', () => {
  it('CUT_IN_MOMENTS is exactly the four §7.2 names, spelled out here by hand', () => {
    // The four bullets under "Where they fire", transcribed. NOT read back off
    // the module: this is the assertion that fails when somebody empties the
    // list, and it can only do that by carrying its own copy of the answer.
    expect([...CUT_IN_MOMENTS].sort()).toEqual(
      ['bomb-out', 'coach-heavy-set', 'personal-record', 'third-attempt-walkout'].sort(),
    );
    expect(CUT_IN_MOMENTS.length).toBe(4);
  });

  it('names the three kinds of PR moment §7.2 lists', () => {
    // "PR moments (new e1RM, new total, qualifying for a higher tier)".
    expect([...CUT_IN_RECORD_KINDS].sort()).toEqual(['e1rm', 'tier', 'total']);
  });

  it('EVERY ONE OF THE FOUR CAN ACTUALLY FIRE', () => {
    // The behavioural twin of the list assertion above, and the one that makes
    // emptying `CUT_IN_MOMENTS` red twice. Each moment gets its own session,
    // because one session only has one slot.
    const cases: readonly (readonly [CutInMoment, CutInBeat])[] = [
      ['third-attempt-walkout', THIRD_ATTEMPT_WALKOUT],
      ['personal-record', NEW_E1RM],
      ['bomb-out', BOMBED_OUT],
      ['coach-heavy-set', HEAVY_TOP_SET],
    ];
    expect(cases.length).toBe(4);
    for (const [moment, beat] of cases) {
      const state = sessionAllowing([moment], `sitting-${moment}`);
      expect(firedMoment(state, [beat]), moment).toBe(moment);
    }
  });

  it('fires on each of the three PR kinds, not only on the first', () => {
    for (const beat of [NEW_E1RM, NEW_TOTAL, NEW_TIER]) {
      const state = sessionAllowing(['personal-record'], `sitting-${beat.kind}`);
      expect(firedMoment(state, [beat]), JSON.stringify(beat)).toBe('personal-record');
    }
  });

  it('isCutInMoment refuses a string that is not one', () => {
    expect(isCutInMoment('bomb-out')).toBe(true);
    expect(isCutInMoment('third-attempt-walkout')).toBe(true);
    expect(isCutInMoment('warm-up')).toBe(false);
    expect(isCutInMoment('')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Qualification: the gate does not fire on a beat that is not one of the four
// ---------------------------------------------------------------------------

describe('THE GATE DOES NOT FIRE ON A NON-QUALIFYING BEAT', () => {
  it('an opener walk-out is not a firing moment — §7.2 says THIRD attempt', () => {
    expect(momentFor(OPENER_WALKOUT)).toBeNull();
    const state = sessionAllowing(['third-attempt-walkout']);
    expect(firedMoment(state, [OPENER_WALKOUT])).toBeNull();
  });

  it('a second attempt is not a firing moment either', () => {
    expect(momentFor(SECOND_ATTEMPT_WALKOUT)).toBeNull();
    const state = sessionAllowing(['third-attempt-walkout']);
    expect(firedMoment(state, [SECOND_ATTEMPT_WALKOUT])).toBeNull();
  });

  it('A THIRD ATTEMPT WITH NOTHING BANKED IS NOT A FIRING MOMENT — a bomb-out is still live', () => {
    // The disqualifier. `cutInGate.ts` §4: this is the one walk-out that is
    // always immediately followed by a bomb-out or by nothing, so it may not
    // spend the slot §7.2's "somber counterpart" is about to need.
    expect(momentFor(THIRD_ATTEMPT_WALKOUT_NOTHING_BANKED)).toBeNull();
    const state = sessionAllowing(['third-attempt-walkout']);
    expect(firedMoment(state, [THIRD_ATTEMPT_WALKOUT_NOTHING_BANKED])).toBeNull();
  });

  it('...and the same attempt WITH something banked still is one', () => {
    // Non-vacuity for the test above, and the half that says the disqualifier
    // did not simply delete §7.2's first firing moment. The two beats differ in
    // exactly one field, so if this pair ever both returned null the walk-out
    // moment would be unreachable and the assertion above would mean nothing.
    expect(THIRD_ATTEMPT_WALKOUT.kind).toBe('meet-walkout');
    expect(momentFor(THIRD_ATTEMPT_WALKOUT)).toBe('third-attempt-walkout');
    const state = sessionAllowing(['third-attempt-walkout']);
    expect(firedMoment(state, [THIRD_ATTEMPT_WALKOUT])).toBe('third-attempt-walkout');
  });

  it('a record that was NOT achieved is not a PR moment', () => {
    expect(momentFor(NO_E1RM_RECORD)).toBeNull();
    const state = sessionAllowing(['personal-record']);
    expect(firedMoment(state, [NO_E1RM_RECORD])).toBeNull();
  });

  it('a meet that finished with a total is not a bomb-out', () => {
    expect(momentFor(MEET_FINISHED_CLEAN)).toBeNull();
    const state = sessionAllowing(['bomb-out']);
    expect(firedMoment(state, [MEET_FINISHED_CLEAN])).toBeNull();
  });

  it('an ordinary top set draws no coach reaction', () => {
    expect(momentFor(LIGHT_TOP_SET)).toBeNull();
    const state = sessionAllowing(['coach-heavy-set']);
    expect(firedMoment(state, [LIGHT_TOP_SET])).toBeNull();
  });

  it('a heavy BACK-OFF set draws none either — only the top set can', () => {
    expect(momentFor(HEAVY_BACK_OFF_SET)).toBeNull();
    const state = sessionAllowing(['coach-heavy-set']);
    expect(firedMoment(state, [HEAVY_BACK_OFF_SET])).toBeNull();
  });

  it('the heavy-set threshold sits between the two probes above', () => {
    // Non-vacuity for the pair of `work-set` tests: if somebody moved the
    // threshold outside this band, one of those two tests would be asserting
    // nothing and this says so directly rather than letting it pass quietly.
    expect(CUT_IN_TUNING.COACH_HEAVY_SET_LOAD_RATIO).toBeGreaterThan(0.6);
    expect(CUT_IN_TUNING.COACH_HEAVY_SET_LOAD_RATIO).toBeLessThanOrEqual(0.99);
  });

  it('a request with no beats at all refuses, and says why', () => {
    const state = sessionAllowing(['bomb-out']);
    const decision = requestCutIn(state, []);
    expect(decision.outcome.kind).toBe('refused');
    if (decision.outcome.kind === 'refused') {
      expect(decision.outcome.reason).toBe('no-qualifying-moment');
      expect(decision.outcome.moment).toBeNull();
    }
    expect(decision.state.firedCount).toBe(0);
  });

  it('a refused beat does not spend the session’s slot', () => {
    // Otherwise "the gate refused" and "the gate fired" would cost the same,
    // and a session full of openers would silently use up its one cut-in.
    let state = sessionAllowing(['third-attempt-walkout']);
    for (const beat of [OPENER_WALKOUT, SECOND_ATTEMPT_WALKOUT, LIGHT_TOP_SET]) {
      state = requestCutIn(state, [beat]).state;
    }
    expect(state.firedCount).toBe(0);
    expect(firedMoment(state, [THIRD_ATTEMPT_WALKOUT])).toBe('third-attempt-walkout');
  });
});

// ---------------------------------------------------------------------------
// THE HARD CAP — GDD §7.2, and §12.3's refusal condition
// ---------------------------------------------------------------------------

describe('THE HARD CAP: no more than one cut-in per session', () => {
  it('the cap is one — GDD §7.2 "no more than one per session"', () => {
    // Spelled `1`. §12.3 lists "cut-ins firing more than once per session" as a
    // refusal condition, so this is a transcription of the document, not a
    // reading of the code.
    expect(CUT_IN_TUNING.MAX_PER_SESSION).toBe(1);
  });

  it('THE GATE REFUSES THE SECOND CUT-IN OF A SESSION', () => {
    // The whole piece, in one test. A session that has fired refuses the next
    // qualifying beat — a DIFFERENT moment, higher priority, allowed by its own
    // rate — and refuses it for the cap rather than for anything softer.
    const state = sessionAllowing(['personal-record', 'bomb-out']);

    const first = requestCutIn(state, [NEW_E1RM]);
    expect(first.outcome.kind).toBe('fire');
    expect(first.state.firedCount).toBe(1);

    const second = requestCutIn(first.state, [BOMBED_OUT]);
    expect(second.outcome.kind).toBe('refused');
    if (second.outcome.kind === 'refused') {
      expect(second.outcome.reason).toBe('session-cap-reached');
      // It still names what it turned away, so the refusal is legible.
      expect(second.outcome.moment).toBe('bomb-out');
    }
    expect(second.state.firedCount).toBe(1);
    expect(second.state.firedMoment).toBe('personal-record');
  });

  it('A HUNDRED QUALIFYING BEATS IN ONE SESSION PRODUCE EXACTLY ONE CUT-IN', () => {
    // The caller here is deliberately hostile: it asks on every beat of a long
    // meet, with every moment true, and never checks the answer. §7.2's rule is
    // the gate's to keep, not the caller's.
    const REQUESTS = 100;
    const EVERY_BEAT: readonly CutInBeat[] = [
      THIRD_ATTEMPT_WALKOUT,
      NEW_E1RM,
      NEW_TOTAL,
      NEW_TIER,
      BOMBED_OUT,
      HEAVY_TOP_SET,
    ];
    let state = sessionAllowing([...CUT_IN_MOMENTS]);
    let fires = 0;
    for (let i = 0; i < REQUESTS; i += 1) {
      const decision = requestCutIn(state, EVERY_BEAT);
      if (decision.outcome.kind === 'fire') fires += 1;
      state = decision.state;
      // Dismissing between requests, because a player would: a skipped cut-in
      // must not buy another one.
      state = dismissCutIn(state);
    }
    expect(fires).toBe(1);
    expect(state.firedCount).toBe(1);
  });

  it('dismissing does NOT refund the slot', () => {
    const state = sessionAllowing(['personal-record', 'bomb-out']);
    const fired = requestCutIn(state, [NEW_E1RM]).state;
    const dismissed = dismissCutIn(fired);

    expect(dismissed.live).toBeNull();
    expect(dismissed.firedCount).toBe(1);

    const after = requestCutIn(dismissed, [BOMBED_OUT]);
    expect(after.outcome.kind).toBe('refused');
    if (after.outcome.kind === 'refused') expect(after.outcome.reason).toBe('session-cap-reached');
  });

  it('a NEW session gets its own slot — the cap is per sitting, not per app run', () => {
    const meet = sessionAllowing(['bomb-out'], 'meet-1');
    expect(requestCutIn(meet, [BOMBED_OUT]).outcome.kind).toBe('fire');

    const nextDay = sessionAllowing(['personal-record'], 'day-2');
    expect(nextDay.firedCount).toBe(0);
    expect(requestCutIn(nextDay, [NEW_E1RM]).outcome.kind).toBe('fire');
  });

  it('every refusal reason is one of the three named ones', () => {
    expect([...CUT_IN_REFUSALS].sort()).toEqual([
      'held-back-for-scarcity',
      'no-qualifying-moment',
      'session-cap-reached',
    ]);
  });
});

// ---------------------------------------------------------------------------
// "Ideally not every session" — GDD §7.2's soft rule
// ---------------------------------------------------------------------------

describe('scarcity: "ideally not every session" (GDD §7.2)', () => {
  it('DOES NOT FIRE IN EVERY SESSION, AND DOES FIRE IN SOME', () => {
    // Both bounds. A gate that never fired would pass the upper bound alone,
    // and a gate with the rate turned up to 1 would pass the lower bound alone.
    const SESSIONS = 400;
    let fired = 0;
    for (let seed = 0; seed < SESSIONS; seed += 1) {
      const state = openCutInSession({ sessionId: `day-${seed}`, seed });
      if (requestCutIn(state, [NEW_E1RM]).outcome.kind === 'fire') fired += 1;
    }
    expect(fired).toBeGreaterThan(0);
    expect(fired).toBeLessThan(SESSIONS);
  });

  it('THE PR-EVERY-SESSION WORLD STILL SEES A MINORITY OF CUT-INS', () => {
    // `src/game/session.test.ts` measures a PR on 30 of 30 sessions at today's
    // tuning, and records that GDD §7.2 calls scarcity "the entire mechanic"
    // while "at today's tuning there is none". This is what the gate does with
    // that world: thirty consecutive days, a PR every one of them, one session
    // per day.
    const DAYS = 30;
    let cutIns = 0;
    for (let day = 0; day < DAYS; day += 1) {
      const state = openCutInSession({ sessionId: `day-${day}`, seed: day });
      if (requestCutIn(state, [NEW_E1RM]).outcome.kind === 'fire') cutIns += 1;
    }
    expect(cutIns).toBeGreaterThan(0);
    // Strictly fewer than half, so "a PR every day" does not read as "a cut-in
    // most days". Whether the right number is nearer 3 or nearer 14 is a
    // playtest judgement and this only pins the side of the line.
    expect(cutIns).toBeLessThan(DAYS / 2);
  });

  it('a held-back moment stays held back however many times it is offered', () => {
    // The roll is per session, not per request. Otherwise a session with many
    // candidate beats fires almost surely and the rate means nothing.
    const state = sessionHoldingBack('personal-record');
    for (let i = 0; i < 50; i += 1) {
      const decision = requestCutIn(state, [NEW_E1RM]);
      expect(decision.outcome.kind).toBe('refused');
      if (decision.outcome.kind === 'refused') {
        expect(decision.outcome.reason).toBe('held-back-for-scarcity');
        expect(decision.outcome.moment).toBe('personal-record');
      }
      expect(decision.state.firedCount).toBe(0);
    }
  });

  it('holding one moment back does not hold back the others', () => {
    // The allowance is per moment. A session that will not show a coach line
    // can still show a bomb-out.
    let state = openCutInSession({ sessionId: 'mixed', seed: 0 });
    for (let seed = 0; seed < SEED_SEARCH_LIMIT; seed += 1) {
      const candidate = openCutInSession({ sessionId: 'mixed', seed });
      if (!candidate.allowed['coach-heavy-set'] && candidate.allowed['bomb-out']) {
        state = candidate;
        break;
      }
    }
    expect(state.allowed['coach-heavy-set']).toBe(false);
    expect(firedMoment(state, [HEAVY_TOP_SET])).toBeNull();
    expect(firedMoment(state, [BOMBED_OUT])).toBe('bomb-out');
  });

  it('the same session id and seed always decide the same way', () => {
    const a = openCutInSession({ sessionId: 'replay', seed: 12345 });
    const b = openCutInSession({ sessionId: 'replay', seed: 12345 });
    expect(a.allowed).toEqual(b.allowed);
    expect(firedMoment(a, [NEW_E1RM])).toBe(firedMoment(b, [NEW_E1RM]));
  });

  it('every moment has a rate, and none is outside [0, 1]', () => {
    for (const moment of ['bomb-out', 'coach-heavy-set', 'personal-record', 'third-attempt-walkout']) {
      const rate = CUT_IN_TUNING.SESSION_ALLOWANCE[moment as CutInMoment];
      expect(rate, moment).toBeGreaterThanOrEqual(0);
      expect(rate, moment).toBeLessThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// Priority
// ---------------------------------------------------------------------------

/**
 * PRIORITY — AND EVERY TEST IN THIS BLOCK EXERCISES A PATH NO CALL SITE CAN
 * REACH.
 *
 * Said in the block's own name rather than left for a reader to work out. Each
 * of the four beat KINDS maps to exactly one moment, and all five call sites
 * offer beats of a single kind, so `momentsFor` returns a one-element array on
 * every request the app can make and the ranking never breaks a tie. The
 * multi-beat arrays below are constructed here and nowhere else.
 *
 * The ranking is kept anyway — `CUT_IN_MOMENT_PRIORITY`'s own comment argues
 * why — and the claim that it is unreachable is not left as prose either:
 * `cutInWiring.test.ts`'s "THE PRIORITY ORDER DECIDES NOTHING TODAY" reads the
 * real call sites and goes red the day one of them offers two kinds at once.
 * That is the day the tests below stop being hypothetical.
 */
describe('priority among simultaneous moments — DECLARED, AND UNREACHABLE IN PRODUCTION', () => {
  it('the priority list is a permutation of the four moments', () => {
    // Not a subset: a moment missing here could never be selected, which is the
    // empty-list failure one level down.
    expect([...CUT_IN_MOMENT_PRIORITY].sort()).toEqual(
      ['bomb-out', 'coach-heavy-set', 'personal-record', 'third-attempt-walkout'].sort(),
    );
    expect(new Set(CUT_IN_MOMENT_PRIORITY).size).toBe(4);
  });

  it('a third-attempt walk-out that is also a PR attempt fires the walk-out', () => {
    // The normal case at a meet, not the edge case.
    const state = sessionAllowing(['third-attempt-walkout', 'personal-record']);
    expect(firedMoment(state, [THIRD_ATTEMPT_WALKOUT, NEW_TOTAL])).toBe('third-attempt-walkout');
  });

  it('a bomb-out outranks everything', () => {
    const state = sessionAllowing([...CUT_IN_MOMENTS]);
    expect(firedMoment(state, [HEAVY_TOP_SET, NEW_E1RM, THIRD_ATTEMPT_WALKOUT, BOMBED_OUT])).toBe(
      'bomb-out',
    );
  });

  it('a PR outranks a coach reaction', () => {
    const state = sessionAllowing(['personal-record', 'coach-heavy-set']);
    expect(firedMoment(state, [HEAVY_TOP_SET, NEW_E1RM])).toBe('personal-record');
  });

  it('the order the caller lists its beats in does not decide', () => {
    const forward = sessionAllowing([...CUT_IN_MOMENTS], 'forward');
    const backward = sessionAllowing([...CUT_IN_MOMENTS], 'backward');
    const beats = [HEAVY_TOP_SET, NEW_E1RM, THIRD_ATTEMPT_WALKOUT, BOMBED_OUT];
    expect(firedMoment(forward, beats)).toBe(firedMoment(backward, [...beats].reverse()));
  });

  it('momentsFor de-duplicates and returns priority order', () => {
    expect(momentsFor([NEW_E1RM, NEW_TOTAL, NEW_TIER])).toEqual(['personal-record']);
    expect(momentsFor([HEAVY_TOP_SET, THIRD_ATTEMPT_WALKOUT, NEW_E1RM])).toEqual([
      'third-attempt-walkout',
      'personal-record',
      'coach-heavy-set',
    ]);
    expect(momentsFor([OPENER_WALKOUT, LIGHT_TOP_SET])).toEqual([]);
  });

  it('a held-back top moment lets the next one through', () => {
    // The allowance holds back a MOMENT, not the session's slot.
    let state = openCutInSession({ sessionId: 'partial', seed: 0 });
    for (let seed = 0; seed < SEED_SEARCH_LIMIT; seed += 1) {
      const candidate = openCutInSession({ sessionId: 'partial', seed });
      if (!candidate.allowed['third-attempt-walkout'] && candidate.allowed['personal-record']) {
        state = candidate;
        break;
      }
    }
    expect(state.allowed['third-attempt-walkout']).toBe(false);
    expect(firedMoment(state, [THIRD_ATTEMPT_WALKOUT, NEW_TOTAL])).toBe('personal-record');
  });

  it('ACROSS TIME THE EARLIER BEAT TAKES THE SLOT, WHATEVER ITS PRIORITY', () => {
    // Stated as a test because it is the piece's biggest live consequence and a
    // reader should not have to take the header's word for it.
    //
    // THIS IS NOW THE RESIDUAL CASE AND NOT THE COMMON ONE. The walk-out here
    // has something banked on its own lift, so it is a DIFFERENT lift that
    // bombs later — the squat's third fires, the bench bombs, and the bomb-out
    // meets a spent slot. The same-lift case, which is the one that used to
    // cost half of all bomb-outs their beat, is closed by the disqualifier and
    // is pinned below by "A MEET THAT BOMBS SHOWS THE BOMB-OUT CUT-IN".
    const state = sessionAllowing(['third-attempt-walkout', 'bomb-out'], 'one-meet');
    const walkout = requestCutIn(state, [THIRD_ATTEMPT_WALKOUT]);
    expect(walkout.outcome.kind).toBe('fire');

    const bomb = requestCutIn(dismissCutIn(walkout.state), [BOMBED_OUT]);
    expect(bomb.outcome.kind).toBe('refused');
    if (bomb.outcome.kind === 'refused') expect(bomb.outcome.reason).toBe('session-cap-reached');
  });
});

// ---------------------------------------------------------------------------
// THE BEAT THAT USED TO LOSE — GDD §7.2's "somber counterpart"
// ---------------------------------------------------------------------------

describe('a bomb-out is not starved by its own lift’s walk-out', () => {
  /**
   * THE BEATS ONE BOMBED LIFT REPORTS, IN THE ORDER THE LOOP REPORTS THEM.
   *
   * `MeetScreen` mounts `WalkoutView` before each attempt and `BombOutView`
   * after the third miss, and each mount offers once. Transcribed here by hand
   * rather than driven through `meetDay.ts`: this file tests the GATE, and a
   * test that imported the engine would go red for reasons that are not the
   * gate's. The one fact it borrows is spelled out in the fixtures above —
   * `bombRisk` is true on the third attempt when nothing is banked, which is
   * `meetDay.ts`'s own definition and the reason a bomb-out always has one of
   * these in front of it.
   */
  const A_LIFT_THAT_BOMBS: readonly (readonly CutInBeat[])[] = [
    [OPENER_WALKOUT],
    [SECOND_ATTEMPT_WALKOUT],
    [THIRD_ATTEMPT_WALKOUT_NOTHING_BANKED],
    [BOMBED_OUT],
  ];

  it('A MEET THAT BOMBS SHOWS THE BOMB-OUT CUT-IN', () => {
    // THE TEST THE WHOLE DISQUALIFIER EXISTS FOR. The session's rates allow
    // BOTH the walk-out and the bomb-out — which is the world in which this
    // used to fail — and the meet plays its three misses in order.
    //
    // Before the disqualifier the third walk-out fired first, the meet showed
    // 'LAST ONE' over the attempt that ended it, and this bomb-out was refused
    // for the cap. Deleting the `bombRisk` branch in `claimedMomentFor` puts
    // that back and turns this red.
    let state = sessionAllowing(['third-attempt-walkout', 'bomb-out'], 'a-meet-that-bombs');
    const fired: string[] = [];
    for (const beats of A_LIFT_THAT_BOMBS) {
      const decision = requestCutIn(state, beats);
      if (decision.outcome.kind === 'fire') fired.push(decision.outcome.live.moment);
      state = dismissCutIn(decision.state);
    }

    // One cut-in, and it is the one §7.2 calls the somber counterpart. Spelled
    // out rather than read off `CUT_IN_MOMENT_PRIORITY` or `firedMoment`.
    expect(fired).toEqual(['bomb-out']);
    expect(state.firedMoment).toBe('bomb-out');
    expect(state.firedCount).toBe(1);
  });

  it('the walk-out that ended the meet did not print its line over it', () => {
    // The other half of the same fact, stated as the player would experience
    // it: the third attempt that ends a meet carries no cut-in at all, so
    // 'LAST ONE' is never the last thing a bombed meet interrupts with.
    const state = sessionAllowing(['third-attempt-walkout', 'bomb-out'], 'a-meet-that-bombs');
    expect(state.allowed['third-attempt-walkout']).toBe(true);
    expect(firedMoment(state, [THIRD_ATTEMPT_WALKOUT_NOTHING_BANKED])).toBeNull();
  });

  it('EVERY SEEDED MEET THAT BOMBS SHOWS THE BOMB-OUT, ON EVERY SEED', () => {
    // Over real rolled sessions rather than one hand-picked seed.
    //
    // THE UPPER BOUND USED TO BE `toBeLessThanOrEqual(MEETS)` AND COULD NOT
    // FAIL. The cap is one per session and there are `MEETS` sessions, so no
    // version of this gate — working, broken, or deleted — could produce more.
    // It read as the sweep's second bound and was decoration.
    //
    // WHAT IS TRUE AND IS NOT FREE: `SESSION_ALLOWANCE['bomb-out']` is 1 and
    // `rollAllowances` compares a draw in [0, 1) against it, so a bomb-out beat
    // is allowed in EVERY sitting on EVERY seed. So the honest number is not a
    // bound at all — it is `MEETS`, exactly, and it is spelled as a count.
    //
    // Turning the bomb-out rate down turns this red, and that is the intended
    // behaviour rather than a nuisance: `tools/verify-cutin-cap.mjs` leans on
    // the same fact to promise a qualifying beat on any day, and the two should
    // stop being true together rather than one at a time.
    const MEETS = 200;
    let bombOuts = 0;
    let anythingElse = 0;
    const wrong: string[] = [];
    for (let seed = 0; seed < MEETS; seed += 1) {
      let state = openCutInSession({ sessionId: `meet-${seed}`, seed });
      for (const beats of A_LIFT_THAT_BOMBS) {
        const decision = requestCutIn(state, beats);
        if (decision.outcome.kind === 'fire') {
          if (decision.outcome.live.moment === 'bomb-out') bombOuts += 1;
          else {
            anythingElse += 1;
            wrong.push(`seed ${seed}: ${decision.outcome.live.moment}`);
          }
        }
        state = dismissCutIn(decision.state);
      }
    }
    // The property: no meet that bombs its first lift spends its slot on
    // anything else. Named, with the seeds, so a reopening says which.
    expect(wrong.slice(0, 10).join(' | ')).toBe('');
    expect(anythingElse).toBe(0);
    // COUNTS, NOT BOUNDS (CLAUDE.md). Every one of the 200 fires, and it fires
    // the bomb-out.
    expect(bombOuts).toBe(MEETS);
  });

  it('THE RESIDUAL, PINNED: ANOTHER LIFT’S THIRD ATTEMPT CAN STILL TAKE THE SLOT', () => {
    // Recorded as behaviour rather than left in a comment, because it is the
    // half of the starvation that is NOT closed and a reader should be able to
    // see it. Squat: three attempts, an opener banked, so its third qualifies
    // and fires. Bench: nothing banked, three misses, bomb-out — refused.
    //
    // Closing this would mean disqualifying a walk-out whenever ANY lift could
    // still bomb, which at the squat's third is always, so it would delete
    // §7.2's first firing moment everywhere but a deadlift third. GDD §11.
    let state = sessionAllowing(['third-attempt-walkout', 'bomb-out'], 'squat-then-bench');
    const squatThird = requestCutIn(state, [THIRD_ATTEMPT_WALKOUT]);
    expect(squatThird.outcome.kind).toBe('fire');
    state = dismissCutIn(squatThird.state);

    const bomb = requestCutIn(state, [BOMBED_OUT]);
    expect(bomb.outcome.kind).toBe('refused');
    if (bomb.outcome.kind === 'refused') {
      expect(bomb.outcome.reason).toBe('session-cap-reached');
      expect(bomb.outcome.moment).toBe('bomb-out');
    }
  });
});

// ---------------------------------------------------------------------------
// SKIPPABILITY — GDD §7.2 "Always skippable — tap to dismiss"
// ---------------------------------------------------------------------------

describe('SKIPPABILITY: always, and from the first frame', () => {
  it('A DISMISSED CUT-IN LEAVES THE SCREEN', () => {
    const state = sessionAllowing(['bomb-out']);
    const fired = requestCutIn(state, [BOMBED_OUT]);
    expect(fired.outcome.kind).toBe('fire');
    expect(fired.state.live).not.toBeNull();

    const dismissed = dismissCutIn(fired.state);
    expect(dismissed.live).toBeNull();
  });

  it('A CUT-IN IS DISMISSIBLE ON ITS FIRST FRAME', () => {
    // §7.2: "Always skippable... Daily players will see these hundreds of
    // times." Zero is spelled out here, so raising the constant to buy a
    // "don't eat the previous screen's tap" window turns this red and makes
    // somebody argue for it.
    expect(canDismissAt(0)).toBe(true);
    expect(CUT_IN_TUNING.DISMISS_ENABLED_AFTER_MS).toBe(0);
  });

  it('stays dismissible for the whole hold, and past it', () => {
    for (const elapsed of [0, 1, 100, 1000, 100000]) {
      expect(canDismissAt(elapsed), `${elapsed}ms`).toBe(true);
    }
  });

  it('THE TAP ROUTE READS THE WINDOW — whatever the window is set to', () => {
    // WHY THIS IS NOT A RESTATEMENT OF `canDismissAt`. Until this round nothing
    // outside this file called that function: `CutInView`'s `onPress` went
    // straight to the host's ungated `dismiss`, so setting
    // `DISMISS_ENABLED_AFTER_MS` to 300 — which `cutInTuning.ts` invites in
    // writing — reddened two unit tests and changed the app not at all. The tap
    // now goes through `tapDismissCutIn`, and this is the assertion that goes
    // red if it stops consulting the clock.
    //
    // READ OFF THE CONSTANT, NOT OFF ITS VALUE, so the pair still means
    // something after a playtest moves it. The window is 0 today, so the "one
    // millisecond early" probe is a NEGATIVE elapsed — which cannot happen from
    // the host's `Date.now()` arithmetic and is exactly why the pin has to be
    // written this way rather than with a plausible-looking 150.
    const fired = requestCutIn(sessionAllowing(['bomb-out']), [BOMBED_OUT]);
    expect(fired.outcome.kind).toBe('fire');
    const live = fired.state;
    expect(live.live).not.toBeNull();

    const tooEarly = CUT_IN_TUNING.DISMISS_ENABLED_AFTER_MS - 1;
    expect(tapDismissCutIn(live, tooEarly), 'the tap window is not being read').toBe(live);
    expect(tapDismissCutIn(live, tooEarly).live, 'a refused tap took the cut-in down').not.toBeNull();

    const onTime = CUT_IN_TUNING.DISMISS_ENABLED_AFTER_MS;
    expect(tapDismissCutIn(live, onTime).live, 'an accepted tap left it up').toBeNull();
    // And it does not refund the slot, exactly like `dismissCutIn`.
    expect(tapDismissCutIn(live, onTime).firedCount).toBe(live.firedCount);
  });

  it('dismissing when nothing is live changes nothing', () => {
    const state = sessionAllowing(['bomb-out']);
    expect(dismissCutIn(state)).toBe(state);
  });

  it('leaves on its own too, so it is never a modal dialog', () => {
    // TWO HARD-CODED PROBES THAT STRADDLE THE HOLD, not a reading of it. This
    // line used to be `expect(cutInExpiredAt(CUT_IN_TUNING.HOLD_MS)).toBe(true)`
    // — which reduces to `HOLD_MS >= HOLD_MS` and is true for every value the
    // constant could ever take, including a hold of zero. The straddle below is
    // the same idiom this file already uses for the heavy-set threshold, and it
    // goes red for a `cutInExpiredAt` that fires too early OR too late.
    const WHILE_IT_IS_STILL_HOLDING_MS = 1500;
    const PAST_ANY_HOLD_THIS_PIECE_CLAIMS_MS = 2400;
    expect(cutInExpiredAt(0)).toBe(false);
    expect(cutInExpiredAt(WHILE_IT_IS_STILL_HOLDING_MS)).toBe(false);
    expect(cutInExpiredAt(PAST_ANY_HOLD_THIS_PIECE_CLAIMS_MS)).toBe(true);
    // Non-vacuity for the pair: if a playtest moves the hold outside the band,
    // this says so directly instead of letting one of the probes assert nothing.
    expect(CUT_IN_TUNING.HOLD_MS).toBeGreaterThan(WHILE_IT_IS_STILL_HOLDING_MS);
    expect(CUT_IN_TUNING.HOLD_MS).toBeLessThanOrEqual(PAST_ANY_HOLD_THIS_PIECE_CLAIMS_MS);
    // The interrupt is short. §7.2 calls a bad one "a 2-second tax", so this
    // pins the whole beat under three seconds until a playtest says otherwise.
    //
    // ONE FUNCTION FOR THE WHOLE BEAT. These three lines read `cutInTotalMs()`
    // until this round, which was `cutInAutoDismissMs()` plus an `EXIT_MS`
    // nothing performed — and these were its only callers anywhere, so setting
    // that constant to 0 left the suite green and moved no pixel. The arrival
    // plus the hold IS the beat: the overlay un-mounts on the tick the timer
    // fires.
    const A_BAD_INTERRUPT_IS_A_TWO_SECOND_TAX_MS = 3000;
    expect(cutInAutoDismissMs()).toBeLessThan(A_BAD_INTERRUPT_IS_A_TWO_SECOND_TAX_MS);
    expect(cutInAutoDismissMs()).toBeGreaterThan(CUT_IN_TUNING.HOLD_MS);
    // ...and it is longer than the hold by exactly the arrival, which is the
    // only animation the beat has.
    expect(cutInAutoDismissMs() - CUT_IN_TUNING.HOLD_MS).toBe(CUT_IN_TUNING.ENTER_MS);
  });
});

// ---------------------------------------------------------------------------
// One sitting, named — GDD §7.2 as read in the module header §3
// ---------------------------------------------------------------------------

describe('a sitting has one name and one seed', () => {
  it('A MEET AND A TRAINING DAY ARE DIFFERENT SITTINGS ON THE SAME DAY', () => {
    // The §3 ruling, as behaviour. If these collided, a player who trained and
    // then competed on one day would be sharing a single cut-in between two
    // sittings — or, worse, the host would treat the meet as a continuation of
    // the morning's session and refuse everything.
    const day = 42;
    expect(cutInSessionId('training', day)).not.toBe(cutInSessionId('meet', day));
    expect(cutInSessionSeed('training', day)).not.toBe(cutInSessionSeed('meet', day));
  });

  it('gives every day of a year its own id and seed', () => {
    const ids = new Set<string>();
    const seeds = new Set<number>();
    const DAYS = 365;
    for (let day = 0; day < DAYS; day += 1) {
      for (const kind of ['training', 'meet'] as const) {
        ids.add(cutInSessionId(kind, day));
        seeds.add(cutInSessionSeed(kind, day));
      }
    }
    expect(ids.size).toBe(DAYS * 2);
    expect(seeds.size).toBe(DAYS * 2);
  });

  it('CONSECUTIVE DAYS DO NOT RHYME', () => {
    // Two days in a row deciding identically would read as a pattern. Not a
    // proof of independence — it is one generator — but it catches a stride
    // that shares a factor with the moment stride, which is the way this
    // actually goes wrong.
    const DAYS = 200;
    let sameAsYesterday = 0;
    let previous = JSON.stringify(
      openCutInSession({
        sessionId: cutInSessionId('training', 0),
        seed: cutInSessionSeed('training', 0),
      }).allowed,
    );
    for (let day = 1; day < DAYS; day += 1) {
      const current = JSON.stringify(
        openCutInSession({
          sessionId: cutInSessionId('training', day),
          seed: cutInSessionSeed('training', day),
        }).allowed,
      );
      if (current === previous) sameAsYesterday += 1;
      previous = current;
    }
    expect(sameAsYesterday).toBeGreaterThan(0);
    expect(sameAsYesterday).toBeLessThan(DAYS / 2);
  });
});

// ---------------------------------------------------------------------------
// What a cut-in carries, and what it must never carry
// ---------------------------------------------------------------------------

describe('a cut-in is cosmetic — GDD §8.1, §12.3', () => {
  it('carries an identity id and a Tier 3 slot, and no game state at all', () => {
    const state = sessionAllowing(['personal-record']);
    const decision = requestCutIn(state, [NEW_E1RM]);
    expect(decision.outcome.kind).toBe('fire');
    if (decision.outcome.kind !== 'fire') return;

    expect(Object.keys(decision.outcome.live).sort()).toEqual(['identityId', 'moment', 'slot']);

    // Nothing anywhere in the fired session state may name a number the player
    // earns. §12.3 refuses "anything purchasable that affects Total, e1RM,
    // training pace, or meet performance", and a cosmetic that could carry one
    // is the first step to a cosmetic that does.
    const serialised = JSON.stringify(decision.state);
    for (const forbidden of ['total', 'e1rm', 'Kg', 'weight', 'streak', 'points', 'currency']) {
      expect(serialised.toLowerCase(), forbidden).not.toContain(forbidden.toLowerCase());
    }
  });

  it('gives the coach beat a different face from the lifter’s', () => {
    const state = openCutInSession({ sessionId: 'faces', seed: 1 });
    expect(identityForMoment(state, 'coach-heavy-set')).toBe(state.coachIdentityId);
    expect(identityForMoment(state, 'personal-record')).toBe(state.lifterIdentityId);
    expect(state.coachIdentityId).not.toBe(state.lifterIdentityId);
  });

  it('lets the caller name the identity, and defaults when it does not', () => {
    const named = openCutInSession({
      sessionId: 'named',
      seed: 1,
      lifterIdentityId: 'ninebar-athletic',
      coachIdentityId: 'halberd-grip',
    });
    expect(named.lifterIdentityId).toBe('ninebar-athletic');
    expect(named.coachIdentityId).toBe('halberd-grip');

    const defaulted = openCutInSession({ sessionId: 'defaulted', seed: 1 });
    expect(defaulted.lifterIdentityId).toBe(CUT_IN_ART.DEFAULT_IDENTITY_ID);
    expect(defaulted.coachIdentityId).toBe(CUT_IN_ART.COACH_IDENTITY_ID);
  });

  it('every moment has a Tier 3 slot and a line of copy', () => {
    for (const moment of ['bomb-out', 'coach-heavy-set', 'personal-record', 'third-attempt-walkout']) {
      expect(CUT_IN_ART.SLOT[moment as CutInMoment], moment).toBeDefined();
      expect(CUT_IN_COPY.LINE[moment as CutInMoment]?.length, moment).toBeGreaterThan(0);
    }
    expect(CUT_IN_COPY.SKIP_HINT.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Purity, and that the tests reach every export
// ---------------------------------------------------------------------------

describe('the gate is a pure module (CLAUDE.md architecture rules)', () => {
  const GATE = source('cutInGate.ts');
  /**
   * The path `audit.ts` resolves its rule from. Repository-relative, because
   * `ruleFor` keys its allowlist that way and a bare filename would fall
   * through to the default `renderer` rule by accident rather than on purpose —
   * which is the right rule here, but arrived at for the wrong reason.
   */
  const GATE_PATH = 'src/cutin/cutInGate.ts';
  /**
   * Comments and strings blanked, offsets preserved. `src/tuning/audit.ts`'s
   * stripper rather than a second one: the header below discusses `Math.random`
   * in prose precisely to say the module does not call it, and a scan that
   * could not tell those apart would have to choose between a false positive
   * and deleting the sentence.
   */
  const GATE_CODE = codeOnly(GATE);

  it('the stripper can see the difference between prose and a call', () => {
    expect(codeOnly('// Math.random() is banned\n')).not.toMatch(/Math\.random/);
    expect(codeOnly('const x = Math.random();')).toMatch(/Math\.random/);
  });

  it('imports no React and reads no clock or dice of its own', () => {
    expect(GATE_CODE).not.toMatch(/from\s+'react/);
    expect(GATE_CODE).not.toMatch(/react-native/);
    expect(GATE_CODE).not.toMatch(/Math\.random/);
    expect(GATE_CODE).not.toMatch(/Date\.now/);
    expect(GATE_CODE).not.toMatch(/new Date\(/);
  });

  it('holds no bare number of its own — every knob is in cutInTuning', () => {
    // The magic-number audit checks this over the whole tree; this is the local
    // statement of it, so the gate's own violation is named by the gate's own
    // suite rather than by a file three directories away.
    //
    // IT USED TO BE TWO `toMatch`ES ON THE RAW SOURCE — `/cutInTuning/` and
    // `/CUT_IN_TUNING\./` — and BOTH WERE SATISFIED BY A COMMENT. The header
    // discusses `CUT_IN_TUNING.SESSION_ALLOWANCE` in prose, so adding
    // `const x = 42;` to the gate left this green: the test named the property
    // and checked a different one, which is worse than no test because the next
    // reader stops looking.
    //
    // SO IT ASKS `audit.ts` — the same scanner `src/tuning/audit.test.ts` runs
    // over the tree, not a second dialect of it (CLAUDE.md). The control comes
    // first: the scanner has to be shown finding a bare number in THIS FILE'S
    // OWN TEXT before its silence is read as an answer.
    //
    // The control's literal is DISTINCTIVE on purpose. It used to be `42`, and
    // a mutant that added `const x = 42;` to the gate made the CONTROL fail
    // ("expected ['42','42'] to equal ['42']") instead of the property — the
    // test went red for the right reason with the wrong message, which is half
    // a check by this repository's own rule.
    const CONTROL_LITERAL = '4242.7';
    expect(
      auditSource(GATE_PATH, `${GATE}\nconst aBareNumber = ${CONTROL_LITERAL};\n`).map((f) => f.text),
      'the audit no longer sees a bare number in this file, so its silence means nothing',
    ).toContain(CONTROL_LITERAL);
    // A COUNT, NOT A BOUND: the empty string is "no findings", and a reopening
    // prints the literal and the declaration it hid in rather than a bare false.
    expect(formatFindings(auditSource(GATE_PATH, GATE))).toBe('');
    // ...and the knobs really do come from the tuning module, read off the CODE
    // rather than off the prose that talks about it. The import PATH is a
    // string literal, which `codeOnly` blanks along with the comments, so that
    // half reads `withoutComments` — comments gone, string contents kept.
    expect(withoutComments(GATE)).toMatch(/from '\.\/cutInTuning'/);
    expect(GATE_CODE).toMatch(/CUT_IN_TUNING\./);
  });

  it('has a test for every exported function', () => {
    // CLAUDE.md: "Every exported function has unit tests." Checked by reading
    // this file's own text for each exported name, so a new export that nobody
    // exercised turns this red.
    const exported = [...GATE.matchAll(/export function (\w+)/g)].map((m) => m[1]);
    expect(exported.length).toBeGreaterThan(0);
    const self = source('cutInGate.test.ts');
    for (const name of exported) {
      expect(self.includes(`${name ?? ''}(`), `${name ?? ''} has no test`).toBe(true);
    }
  });
});
