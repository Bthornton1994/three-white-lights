/**
 * cutInGate.ts — THE CUT-IN GATE (GDD §7.2).
 *
 * PURE MODULE (CLAUDE.md, "Pure logic is separate from UI"): zero React
 * imports, zero side effects, zero I/O, no clock, no `Math.random`, explicit
 * return types on every export. The caller owns the state and passes it back
 * in, exactly as `prng.ts` and `meet.ts` do, so a session replays identically
 * from its seed and a server could run this same code over the same inputs.
 *
 * ===========================================================================
 * 1. WHAT THIS FILE IS, AND WHAT IT DELIBERATELY IS NOT
 * ===========================================================================
 *
 * GDD §7.2 describes two separable things and this file is only one of them.
 *
 *   THE ART — "hand-drawn anime-style cut-in shots". §7.2 also says to "cut art
 *   entirely from the early prototypes... Placeholder rectangles until meet day
 *   is proven to land", and GDD §11 records the working assumption this run
 *   applies: cut-in ART STAYS UNBUILT. Nothing here draws a face. What the
 *   overlay shows is `cutInArt.ts`'s own cut-in-shaped composition — a ground,
 *   two rules, a well and ONE line of Tier 3 caption — around the placeholder
 *   Tier 3 DRAWING `src/licensing/partners.ts` already holds, read through
 *   §7.3's surface witness. It is not the shop panel `renderPanels.ts` draws:
 *   GDD §7.2 rules on that by name, and `cutInArt.ts` says why.
 *
 *   THE GATE — "Scarcity is the entire mechanic. Cut-ins work because they
 *   interrupt. Firing one on every set turns a 60-second daily session into a
 *   2-second tax that players resent by day 4." That is this file, and it is
 *   the half that has to exist before any art is worth commissioning, because
 *   it is the half that decides whether the art is welcome.
 *
 * ===========================================================================
 * 2. THE RULES, AND WHERE EACH ONE IS ENFORCED
 * ===========================================================================
 *
 *   (a) NO MORE THAN ONE PER SESSION. §7.2's "hard gate", and GDD §12.3's
 *       refusal condition: "Cut-ins firing more than once per session". THE
 *       GATE REFUSES THE SECOND ONE. It is not a convention the callers keep —
 *       `requestCutIn` counts what it has fired and hands back
 *       `'session-cap-reached'` to anybody who asks again, including a caller
 *       written next year that has never read this comment.
 *
 *   (b) IDEALLY NOT EVERY SESSION. Weaker than (a), and §7.2 says so with the
 *       word "ideally". Implemented as `CUT_IN_TUNING.SESSION_ALLOWANCE`, a
 *       rate per moment, rolled once per session from the session's seed.
 *       WHETHER THE RATES ARE RIGHT IS A PLAYTEST JUDGEMENT AND IS NOT
 *       VERIFIED HERE (CLAUDE.md, "What You Cannot Do").
 *
 *   (c) ALWAYS SKIPPABLE. A TAP goes through `tapDismissCutIn`, which asks
 *       `canDismissAt` and accepts from the first frame because
 *       `DISMISS_ENABLED_AFTER_MS` is 0; the auto-dismiss goes through
 *       `dismissCutIn` and answers to `HOLD_MS` instead. Dismissing does NOT
 *       give the session's slot back — a skipped cut-in has still fired.
 *
 *   (d) TIER 3 CONTENT COMES FROM THE IDENTITY TABLE. A `LiveCutIn` carries an
 *       identity id and a Tier 3 slot, never art. `cutInArt.ts` turns that into
 *       pixels through `tier3Of(entry, slot, 'cut-in')`, which is §7.3's
 *       witness path — so a licensed portrait later is a row in `partners.ts`
 *       and nothing here changes.
 *
 * ===========================================================================
 * 3. WHAT "A SESSION" MEANS — A MEET IS ONE
 * ===========================================================================
 *
 * §7.2 says "no more than one per session" and does not define session, which
 * matters because two of its four firing moments happen at a meet and the other
 * two happen in the daily loop. The reading this module applies, and which is
 * now written into §7.2 of the GDD rather than left here:
 *
 *   A SESSION IS ONE SITTING OF ONE MODE. One daily training session (§3.2) is
 *   a session. ONE MEET (§6) IS ALSO A SESSION — the whole meet, weigh-in to
 *   recap, not one attempt and not one lift.
 *
 * That is the reading that makes the rule mean anything: a meet is nine
 * attempts, three of them thirds, with a recap and possibly a bomb-out at the
 * end. Counting each attempt as a session would permit four cut-ins in ten
 * minutes, which is precisely the "2-second tax" §7.2 is written against.
 *
 * The gate does not decide this for itself — `sessionId` is the caller's, and
 * the caller opens one session per meet and one per training day. What the gate
 * guarantees is that whatever the caller calls a session gets one cut-in.
 *
 * ===========================================================================
 * 4. THE TWO CONTESTS, AND WHICH RULE ACTUALLY DECIDES EACH
 * ===========================================================================
 *
 * Two different contests exist here and they are resolved by two different
 * rules. Conflating them is the easiest way to misread this file.
 *
 *   SAME INSTANT — resolved by `CUT_IN_MOMENT_PRIORITY`. A caller hands
 *   `requestCutIn` EVERY beat that is true right now, and the highest-priority
 *   qualifying one that its rate allows is the one that fires.
 *
 *   THIS CONTEST DOES NOT HAPPEN IN THE APP AS BUILT, and the file says so
 *   rather than implying otherwise. Each of the four beat KINDS maps to exactly
 *   one moment, and every one of the five call sites offers beats of a single
 *   kind, so `momentsFor` returns at most one moment on every request the app
 *   can make and the ranking never breaks a tie. It is kept as a DECLARED
 *   INVARIANT — see `CUT_IN_MOMENT_PRIORITY` for the argument — and
 *   `cutInWiring.test.ts`'s "THE PRIORITY ORDER DECIDES NOTHING TODAY, AND
 *   HERE IS THE READING THAT SAYS SO" goes red the day a call site starts
 *   offering two kinds at once, which is the day the ranking starts mattering.
 *
 *   ACROSS TIME — resolved by ARRIVAL. The cap is a count, so under it the
 *   first beat to ask and be allowed takes the session's only slot, whatever
 *   its priority. THIS is the contest that happens, on every meet.
 *
 * ---------------------------------------------------------------------------
 * THE ONE DISQUALIFIER, AND WHY IT IS NOT LOOKAHEAD
 * ---------------------------------------------------------------------------
 *
 * Arrival order used to cost §7.2's "somber counterpart" half the meets it
 * exists for, by construction rather than by tuning:
 *
 *   `meetDay.ts`: `bombRisk = attemptNumber === ATTEMPTS_PER_LIFT && banked === null`
 *
 * A lift bombs when all three of its attempts miss, so EVERY bomb-out is
 * preceded by that lift's own third-attempt walk-out, and that walk-out always
 * carries `bombRisk`. First-come therefore meant that whenever a meet's rates
 * allowed the walk-out, the bomb-out that followed was refused for the cap —
 * and the player saw `'LAST ONE'` over the attempt that ended the meet and
 * nothing over the end of the meet.
 *
 * So a walk-out WHILE ITS OWN LIFT CAN STILL BOMB is not a firing moment. The
 * beat carries `bombRisk` and `claimedMomentFor` returns `null` for it.
 *
 * THAT IS NOT THE LOOKAHEAD THIS FILE REFUSES. Lookahead is holding the slot
 * open for a moment that MIGHT arrive, and a gate that guesses wrong holds it
 * for one that never comes. This is neither a hold nor a guess:
 *
 *   - "Can this lift still bomb?" is a PRESENT FACT about attempts already
 *     taken. The walk-out screen has held it all along and picks its copy and
 *     its beat length from it.
 *   - It is a DISQUALIFIER, not a trigger. A `bombRisk` beat can only ever
 *     produce a refusal, so no firing moment §7.2 does not list can come of it.
 *   - Nothing is held. The slot is not reserved; it is simply not spent on this
 *     beat, and the very next qualifying beat — the bomb-out, or a later lift's
 *     third attempt, or the recap's PR — may take it.
 *
 * WHAT IT COSTS, STATED RATHER THAN GLOSSED. A third attempt with nothing
 * banked is the most loaded walk-out in the piece, and it is now the one
 * walk-out that can never carry a cut-in. That is the trade §7.2's ranking
 * already implies — the bomb-out outranks the walk-out — paid across time
 * instead of at one instant. If a playtest says the dread beat should have won,
 * the fix is to delete these three lines, not to move a rate.
 *
 * WHAT IT DOES NOT CLOSE, AND THIS IS A REAL RESIDUAL. A bomb-out can still be
 * starved by a DIFFERENT lift's third-attempt walk-out: bank a squat opener,
 * fire the cut-in on the squat's third, then bomb the bench, and the bomb-out
 * is refused for the cap. Closing that would mean disqualifying a walk-out
 * whenever ANY lift could still bomb, which at the squat's third attempt is
 * always — the bench and the deadlift have not started — so it would delete
 * §7.2's first firing moment everywhere except a deadlift third with something
 * banked. That is a redesign of which beats fire, not a fix, and it is refused
 * here rather than done quietly. GDD §11 records both halves.
 *
 * THE OTHER ARRIVAL COST IS UNCHANGED AND STILL LIVE. In a TRAINING session a
 * coach beat fires during the sets and a PR fires at close-out, so whenever
 * both are allowed the coach line wins and the PR is refused — even though the
 * PR outranks it. The only lever is `SESSION_ALLOWANCE['coach-heavy-set']`,
 * which is set low for exactly this reason.
 *
 * ===========================================================================
 * 5. WHAT THIS FILE CANNOT DO
 * ===========================================================================
 *
 *  - IT CANNOT STOP A CALLER OPENING A SECOND SESSION. `openCutInSession` is a
 *    constructor; calling it twice for one sitting produces two sessions with
 *    one slot each. The gate is pure and holds nothing between calls, so it
 *    cannot tell. What guards it is `cutInLedger.ts`, which keys one session on
 *    `sessionId` for the life of the process and hands the SAME state back to a
 *    second caller — including a `CutInHost` that has been un-mounted and
 *    re-mounted, which `AppShell`'s surface ternary does on every trip out of a
 *    meet and back. `cutInLedger.test.ts` is the check; it is a real unit test
 *    and not a source scan.
 *  - ONE OF ITS THREE PR SUB-MOMENTS IS REACHED BY NO SCREEN. §7.2's second
 *    firing moment is "PR moments (new e1RM, new total, QUALIFYING FOR A HIGHER
 *    TIER)", and `CUT_IN_RECORD_KINDS` carries all three; `momentFor` fires on
 *    all three and `cutInGate.test.ts` exercises all three. But `RecapView`
 *    offers `total` and `e1rm`, `CloseOutView` offers `e1rm`, and NOTHING
 *    OFFERS `tier`. It is reachable only from a test.
 *
 *    UNBUILT RATHER THAN MISSING. Tier qualification is a fact about a lifter's
 *    standing across meets and needs GDD §6.1's Career calendar, which a human
 *    has explicitly deferred; building it here would be this piece inventing a
 *    progression system to have something to interrupt about. The kind stays in
 *    the union because §7.2 names three and a union that named two would make
 *    the document and the code disagree silently — which is the failure this
 *    §5 exists to write down rather than repeat.
 *
 *    IT WAS DISCLOSED NOWHERE UNTIL IT WAS PUT HERE, and the check that should
 *    have caught it could not: `cutInWiring.test.ts`'s "covers all four of the
 *    gate's beat kinds" iterated `kind:` and was satisfied by ANY `record`
 *    beat, whichever of the three sub-kinds it carried. It now pins the
 *    sub-kinds too, and goes red the day a screen starts offering `tier` — at
 *    which point this paragraph is deleted along with it.
 *    @guarantee tier-pr-is-reached-by-no-screen
 *  - IT CANNOT SAY THE RATES ARE RIGHT. Nothing in this repository can. GDD
 *    §12.1 is explicit that this is the part of the job that was never
 *    automatable.
 *  - A CUT-IN TOUCHES NOTHING. There is no field here that reaches Total, e1RM,
 *    training pace or meet performance, and there must never be: GDD §8.1 and
 *    §12.3. A cut-in is a picture that interrupts.
 */

import { nextRandom, seedState } from '../game/prng';
import type { Tier3Slot } from '../licensing/tiers';
import { CUT_IN_ART, CUT_IN_TUNING } from './cutInTuning';

// ---------------------------------------------------------------------------
// The firing moments
// ---------------------------------------------------------------------------

/**
 * GDD §7.2's "Where they fire", verbatim and complete:
 *
 *   - Third-attempt walkout at a meet
 *   - PR moments (new e1RM, new total, qualifying for a higher tier)
 *   - Bombing out — the somber counterpart
 *   - Coach reactions on a heavy set
 *
 * THIS LIST DECIDES WHETHER ANYTHING FIRES AT ALL, which makes it exactly the
 * shape of list that can be emptied while a suite stays green. It is not one
 * here: `momentFor` re-checks membership at runtime through `isCutInMoment`, so
 * an empty list refuses every beat, and `cutInGate.test.ts` spells all four ids
 * and the count out by hand rather than reading them back off this constant.
 */
export const CUT_IN_MOMENTS = [
  'third-attempt-walkout',
  'personal-record',
  'bomb-out',
  'coach-heavy-set',
] as const;

export type CutInMoment = (typeof CUT_IN_MOMENTS)[number];

/** Runtime membership. The reason emptying the list above stops every fire. */
export function isCutInMoment(value: string): value is CutInMoment {
  return (CUT_IN_MOMENTS as readonly string[]).includes(value);
}

/**
 * WHICH MOMENT WINS WHEN TWO ARE TRUE AT THE SAME INSTANT.
 *
 * ===========================================================================
 * IT SELECTS NOTHING IN THE APP AS BUILT, AND IT IS KEPT ANYWAY. READ THIS
 * BEFORE TRUSTING THE RANKING TO BE DOING WORK.
 * ===========================================================================
 *
 * Each of the four beat KINDS maps to exactly one moment, and all five call
 * sites offer beats of a single kind, so `momentsFor` returns a one-element
 * array on every request the app can make and the `find` below never has a
 * second candidate to skip. Every priority test in `cutInGate.test.ts` builds a
 * beat array no caller can produce, and that block says so in its own name.
 *
 * KEPT RATHER THAN DELETED, for three reasons and not for sentiment:
 *
 *   1. `momentsFor` has to return SOME order. Without this it would return the
 *      caller's, and "the order the caller lists its beats in does not decide"
 *      — a property this suite asserts — would quietly become false. The day a
 *      screen offers two kinds at once, that would be a silent behaviour
 *      change instead of a decision somebody made.
 *   2. GDD §7.2 declares the ranking in prose. Deleting the code would leave
 *      the document with no implementation and the next reader re-deriving it.
 *   3. It is what a future deferral window would be measured against.
 *
 * WHAT IT IS NOT: it is not what protects the bomb-out. Priority settles one
 * INSTANT; the bomb-out loses ACROSS TIME, and §4's disqualifier is what fixed
 * that. A reader who assumes "bomb-out is ranked first, so a bomb-out wins" has
 * misread this constant — that was true of the ranking and false of the app for
 * as long as both existed.
 *
 * The ranking, highest first, and the argument for each step:
 *
 *   bomb-out              Terminal and unrepeatable. Nothing later in that meet
 *                         exists, so its only competitor is a simultaneous one,
 *                         and §7.2 calls it "the somber counterpart" — the beat
 *                         that carries the tone the whole feature exists for.
 *                         It must not lose to a coach line.
 *   third-attempt-walkout §7.2 lists it first and §12.2 grades the piece on it
 *                         ("Real powerlifting broadcast footage — a
 *                         third-attempt walkout"). It is also the beat that
 *                         carries DREAD, which the payoff beats do not.
 *   personal-record       A record is a larger and rarer fact than a heavy
 *                         single, and §7.2 names three kinds of it.
 *   coach-heavy-set       Last because it is by far the most frequent trigger,
 *                         and because it is the one moment that is flavour
 *                         rather than a fact about the lifter's record.
 *
 * A PERMUTATION OF `CUT_IN_MOMENTS`, NOT A SUBSET. A moment missing from here
 * would be a moment that can never be selected — the same silent-empty-list
 * failure one level down — so `cutInGate.test.ts` checks both directions.
 */
export const CUT_IN_MOMENT_PRIORITY: readonly CutInMoment[] = Object.freeze([
  'bomb-out',
  'third-attempt-walkout',
  'personal-record',
  'coach-heavy-set',
]);

/**
 * §7.2's three kinds of PR moment: "new e1RM, new total, qualifying for a
 * higher tier".
 *
 * Named rather than collapsed into a boolean so a beat says WHICH record it is,
 * which is what a later copy pass will want and what makes a caller passing the
 * wrong one visible.
 */
export const CUT_IN_RECORD_KINDS = ['e1rm', 'total', 'tier'] as const;

export type CutInRecordKind = (typeof CUT_IN_RECORD_KINDS)[number];

// ---------------------------------------------------------------------------
// Beats
// ---------------------------------------------------------------------------

/**
 * SOMETHING THAT JUST HAPPENED, described in facts rather than in verdicts.
 *
 * A beat is NOT a moment. The caller reports what the loop did — "this is
 * attempt 3 of 3", "the meet ended and the lifter bombed", "this top set was at
 * 0.94 of the lifter's estimate" — and the GATE decides whether that is one of
 * §7.2's four. That direction is load-bearing: a caller that handed over a
 * moment id would be a caller that could fire a cut-in on any beat it liked,
 * and "make the gate fire on a non-qualifying beat" would then be an edit to
 * the caller rather than to anything a test in this file can see.
 */
export type CutInBeat =
  /** GDD §6.2 step 1, the bar-loads-and-walks-out beat. */
  | {
      readonly kind: 'meet-walkout';
      readonly attemptNumber: number;
      /** Three, in this sport. Passed in so the rule reads off the engine. */
      readonly attemptsPerLift: number;
      /**
       * CAN THIS LIFT STILL BOMB? `LiveAttempt.bombRisk` — this is the last
       * attempt on this lift and nothing is banked on it yet (`meetDay.ts`).
       *
       * A PRESENT FACT, NOT A FORECAST. It is read off the attempts already
       * taken, exactly like the copy and the beat length that the walk-out
       * screen already picks from it, and it is a DISQUALIFIER rather than a
       * trigger: it can only ever make `momentFor` return `null`, never make it
       * return a moment §7.2 does not list. See §4 of the header for why the
       * gate needs it and what it costs.
       *
       * REQUIRED, not optional. A default of `false` would let a caller omit
       * the fact and quietly get the old behaviour back, and the whole point is
       * that a walk-out cannot spend the slot the bomb-out is going to need.
       */
      readonly bombRisk: boolean;
    }
  /** A record was, or was not, set. §7.2's three kinds. */
  | {
      readonly kind: 'record';
      readonly record: CutInRecordKind;
      readonly achieved: boolean;
    }
  /** The meet finished. `bombedOut` is GDD §6.3's outcome. */
  | {
      readonly kind: 'meet-over';
      readonly bombedOut: boolean;
    }
  /** A work set in the daily loop (GDD §3.2). */
  | {
      readonly kind: 'work-set';
      /** `weight / e1RM`, the same ratio the lift mechanic strains on. */
      readonly loadRatio: number;
      /** Only the session's heaviest set can draw a reaction. */
      readonly isTopSet: boolean;
    };

/**
 * WHICH OF §7.2'S FOUR MOMENTS THIS BEAT IS, OR `null` FOR NONE.
 *
 * Every branch is a QUALIFICATION, not a translation. An opener walkout, a
 * record that was not achieved, a meet that finished cleanly and a light set
 * all return `null` — which is what "the gate does not fire on a non-qualifying
 * beat" means concretely, and what `cutInGate.test.ts` checks one beat at a
 * time.
 *
 * The final `isCutInMoment` guard is the runtime witness described on
 * `CUT_IN_MOMENTS`: emptying that list makes every branch here return `null`.
 */
export function momentFor(beat: CutInBeat): CutInMoment | null {
  const claimed = claimedMomentFor(beat);
  if (claimed === null) return null;
  return isCutInMoment(claimed) ? claimed : null;
}

function claimedMomentFor(beat: CutInBeat): string | null {
  switch (beat.kind) {
    case 'meet-walkout':
      // A THIRD attempt, and only a third. §7.2 says "third-attempt walkout";
      // an opener or a second attempt is the same screen without the stakes,
      // and firing there is the failure mode §7.2 names by name.
      if (beat.attemptNumber !== beat.attemptsPerLift) return null;
      // ...AND NOT WHILE THIS LIFT CAN STILL BOMB. The disqualifier, argued in
      // full in §4 of the header. A third attempt with nothing banked is the
      // one walk-out that is ALWAYS immediately followed by either a bomb-out
      // or nothing, so letting it take the slot is the same as deciding that
      // half of all bomb-outs get no bomb-out cut-in.
      if (beat.bombRisk) return null;
      return 'third-attempt-walkout';
    case 'record':
      // A record that was ATTEMPTED is not a record. §7.2 says "PR moments",
      // and the moment is the one where the number actually moved.
      return beat.achieved ? 'personal-record' : null;
    case 'meet-over':
      // Only a bomb-out. A meet that finished with a total gets its cut-in from
      // the `record` beat on the recap, if it earned one.
      return beat.bombedOut ? 'bomb-out' : null;
    case 'work-set':
      // Heavy, and the session's top set. A coach who reacts to a back-off set
      // is a coach nobody listens to by day 4.
      return beat.isTopSet && beat.loadRatio >= CUT_IN_TUNING.COACH_HEAVY_SET_LOAD_RATIO
        ? 'coach-heavy-set'
        : null;
  }
}

/**
 * Every moment true at this instant, in priority order and de-duplicated.
 *
 * The ordering is `CUT_IN_MOMENT_PRIORITY`'s and not the caller's, so the order
 * beats are passed in cannot decide which one fires.
 */
export function momentsFor(beats: readonly CutInBeat[]): readonly CutInMoment[] {
  const found = new Set<CutInMoment>();
  for (const beat of beats) {
    const moment = momentFor(beat);
    if (moment !== null) found.add(moment);
  }
  return CUT_IN_MOMENT_PRIORITY.filter((moment) => found.has(moment));
}

// ---------------------------------------------------------------------------
// The session
// ---------------------------------------------------------------------------

/** A cut-in that is on screen right now. Carries no art — see `cutInArt.ts`. */
export interface LiveCutIn {
  readonly moment: CutInMoment;
  /** A row in `LICENSING_CATALOGUE.entries`. Fictional placeholders only. */
  readonly identityId: string;
  /** Which Tier 3 slot leads, from `CUT_IN_ART.SLOT`. */
  readonly slot: Tier3Slot;
}

/**
 * ONE SITTING'S WORTH OF GATE STATE. See §3 of the header for what a sitting is.
 *
 * IMMUTABLE, and every transition returns a new one. The count is the thing the
 * cap is enforced against and it never goes down: dismissing a cut-in does not
 * refund the session's slot, because §7.2's rule is about how many the player
 * is INTERRUPTED by, not how many are still on screen.
 */
export interface CutInSessionState {
  /** The caller's name for this sitting. One meet, or one training day. */
  readonly sessionId: string;
  /** Whose face, when the moment is the lifter's. */
  readonly lifterIdentityId: string;
  /** Whose face, when the moment is the coach's. */
  readonly coachIdentityId: string;
  /** How many cut-ins this sitting has fired. Compared against the cap. */
  readonly firedCount: number;
  /** Which moment took the slot, for the record and for the tests. */
  readonly firedMoment: CutInMoment | null;
  /** What is on screen. `null` between cut-ins and after a dismiss. */
  readonly live: LiveCutIn | null;
  /**
   * §7.2's "ideally not every session", already rolled.
   *
   * Decided ONCE, at open, so that a moment held back stays held back however
   * many times it is offered. Re-rolling per request would make a session with
   * many candidate beats fire almost surely, which is the opposite of a rate.
   */
  readonly allowed: Readonly<Record<CutInMoment, boolean>>;
}

/** Why the gate said no. Every refusal names one of these. */
export const CUT_IN_REFUSALS = [
  'no-qualifying-moment',
  'session-cap-reached',
  'held-back-for-scarcity',
] as const;

export type CutInRefusal = (typeof CUT_IN_REFUSALS)[number];

export type CutInOutcome =
  | { readonly kind: 'fire'; readonly live: LiveCutIn }
  | {
      readonly kind: 'refused';
      readonly reason: CutInRefusal;
      /** The highest-priority moment that qualified, if any did. */
      readonly moment: CutInMoment | null;
    };

export interface CutInDecision {
  readonly state: CutInSessionState;
  readonly outcome: CutInOutcome;
}

export interface OpenCutInSession {
  readonly sessionId: string;
  /**
   * The seed the per-moment rates are rolled from.
   *
   * A NUMBER THE CALLER OWNS, and deliberately not a clock read here: GDD §9.2
   * puts progression on the server, and `prng.ts` records the rule this follows
   * — "there is no `Math.random()` anywhere in the game modules and there must
   * not be: a client that can roll its own dice is a client that can roll them
   * again". A meet seeds from its meet id and a training day from its day
   * number, so the same sitting always makes the same decision.
   */
  readonly seed: number;
  /** Defaults to `CUT_IN_ART.DEFAULT_IDENTITY_ID`. */
  readonly lifterIdentityId?: string;
  /** Defaults to `CUT_IN_ART.COACH_IDENTITY_ID`. */
  readonly coachIdentityId?: string;
}

/**
 * Roll §7.2's "ideally not every session", one draw per moment.
 *
 * ONE DRAW PER MOMENT RATHER THAN ONE PER SESSION. A single shared draw would
 * make the rates NESTED — every session that allowed the rarest moment would
 * also allow all the commoner ones — and that is the wrong shape here, because
 * the moment with the lowest rate (`coach-heavy-set`) is also the one that
 * fires EARLIEST and would therefore take the slot from the PR every time it
 * was allowed. Independent draws let each rate mean what it says.
 */
function rollAllowances(seed: number): Readonly<Record<CutInMoment, boolean>> {
  const allowed: Partial<Record<CutInMoment, boolean>> = {};
  CUT_IN_MOMENTS.forEach((moment, index) => {
    const draw = nextRandom(seedState(seed + index * CUT_IN_TUNING.SEED_MOMENT_STRIDE));
    allowed[moment] = draw.value < CUT_IN_TUNING.SESSION_ALLOWANCE[moment];
  });
  // Total by construction: the loop walks `CUT_IN_MOMENTS` and the record is
  // keyed by it. The cast is the narrowing TypeScript cannot do for a built-up
  // partial, and it is the only one in this file.
  return Object.freeze(allowed as Record<CutInMoment, boolean>);
}

/**
 * THE TWO KINDS OF SITTING THIS GAME HAS TODAY. See §3 of the header.
 *
 * A daily training session (GDD §3.2) and a meet (GDD §6). Named so that the
 * ruling "a meet is a session" is a value in the code rather than a sentence in
 * a comment, and so `cutInSessionId` cannot be called with something vague.
 */
export const CUT_IN_SESSION_KINDS = ['training', 'meet'] as const;

export type CutInSessionKind = (typeof CUT_IN_SESSION_KINDS)[number];

/**
 * THE NAME OF ONE SITTING. One per training day, one per meet.
 *
 * Here rather than in the screens so that the two callers cannot spell it
 * differently, which is the accident that would give one day two slots. It is
 * also the value `CutInHost.tsx` keys its session on: the host opens a new gate
 * session only when this string changes.
 */
export function cutInSessionId(kind: CutInSessionKind, day: number): string {
  return `${kind}-${day}`;
}

/**
 * THE SEED ONE SITTING'S RATES ARE ROLLED FROM.
 *
 * A function of the day and the kind, so a training day and a meet on the same
 * day get different rolls — otherwise the two sittings would make identical
 * scarcity decisions and a player who trained and competed on one day would see
 * the pair correlate for no reason they could name.
 */
export function cutInSessionSeed(kind: CutInSessionKind, day: number): number {
  return day * CUT_IN_TUNING.SEED_DAY_STRIDE + CUT_IN_SESSION_KINDS.indexOf(kind);
}

/** Begin one sitting. See §3 of the header for what a sitting is. */
export function openCutInSession(input: OpenCutInSession): CutInSessionState {
  return Object.freeze({
    sessionId: input.sessionId,
    lifterIdentityId: input.lifterIdentityId ?? CUT_IN_ART.DEFAULT_IDENTITY_ID,
    coachIdentityId: input.coachIdentityId ?? CUT_IN_ART.COACH_IDENTITY_ID,
    firedCount: 0,
    firedMoment: null,
    live: null,
    allowed: rollAllowances(input.seed),
  });
}

/** Whose face a moment wears. The coach beat is the coach's; the rest are not. */
export function identityForMoment(state: CutInSessionState, moment: CutInMoment): string {
  return moment === 'coach-heavy-set' ? state.coachIdentityId : state.lifterIdentityId;
}

/**
 * THE GATE. Ask it whether these beats may interrupt; it answers, and hands
 * back the session state to carry forward.
 *
 * The order of the three refusals is the order they are checked in, and it is
 * chosen so the reason is the most specific true one:
 *
 *   1. NO QUALIFYING MOMENT — nothing here is one of §7.2's four. Checked first
 *      so an ordinary beat is never reported as "cap reached", which would
 *      make the cap look like it was doing work it was not.
 *   2. SESSION CAP REACHED — §7.2's hard gate and §12.3's refusal condition.
 *      THIS IS THE CHECK THE WHOLE PIECE EXISTS FOR.
 *   3. HELD BACK FOR SCARCITY — §7.2's "ideally not every session". Last,
 *      because it is the soft rule and reporting it over the hard one would
 *      hide which rule actually bit.
 */
export function requestCutIn(
  state: CutInSessionState,
  beats: readonly CutInBeat[],
): CutInDecision {
  const qualifying = momentsFor(beats);
  const top = qualifying[0] ?? null;

  if (top === null) {
    return { state, outcome: { kind: 'refused', reason: 'no-qualifying-moment', moment: null } };
  }

  // ---- GDD §7.2's hard gate, and §12.3's refusal condition ----------------
  // The gate refuses. Not the caller, not a convention, not a comment.
  if (state.firedCount >= CUT_IN_TUNING.MAX_PER_SESSION) {
    return { state, outcome: { kind: 'refused', reason: 'session-cap-reached', moment: top } };
  }

  // The highest-priority moment this session's rates actually let through. A
  // moment held back does not hold back the ones below it: the allowance is
  // per moment, and the session still has its slot.
  const permitted = qualifying.find((moment) => state.allowed[moment]) ?? null;
  if (permitted === null) {
    return { state, outcome: { kind: 'refused', reason: 'held-back-for-scarcity', moment: top } };
  }

  const live: LiveCutIn = Object.freeze({
    moment: permitted,
    identityId: identityForMoment(state, permitted),
    slot: CUT_IN_ART.SLOT[permitted],
  });

  return {
    state: Object.freeze({
      ...state,
      firedCount: state.firedCount + 1,
      firedMoment: permitted,
      live,
    }),
    outcome: { kind: 'fire', live },
  };
}

/**
 * TAP TO DISMISS (GDD §7.2). Takes the cut-in off screen.
 *
 * IT DOES NOT REFUND THE SLOT. `firedCount` is untouched, so a player who skips
 * the cut-in does not thereby earn a second one — which is the reading §12.3's
 * refusal condition requires, since the thing being capped is the interruption.
 *
 * Idempotent: dismissing when nothing is live returns the state unchanged.
 */
export function dismissCutIn(state: CutInSessionState): CutInSessionState {
  if (state.live === null) return state;
  return Object.freeze({ ...state, live: null });
}

/**
 * IS A TAP ACCEPTED YET? Yes, from the first frame.
 *
 * §7.2: "Always skippable — tap to dismiss. Daily players will see these
 * hundreds of times." `DISMISS_ENABLED_AFTER_MS` is 0 and this function exists
 * so that the zero is a value with a name on it rather than an absence — see
 * that constant's comment for why the obvious reason to raise it is refused.
 */
export function canDismissAt(elapsedMs: number): boolean {
  return elapsedMs >= CUT_IN_TUNING.DISMISS_ENABLED_AFTER_MS;
}

/**
 * A TAP, `elapsedMs` INTO THE BEAT. The gate decides whether it counts.
 *
 * WHY THIS EXISTS AT ALL, when `dismissCutIn` was already here. It is the half
 * `DISMISS_ENABLED_AFTER_MS` was missing. That constant was registered,
 * documented, pinned by a unit test, described in `cutInTuning.ts` as "the line
 * to move" if a playtest ever asks for a short un-skippable window — and read by
 * NOTHING on the route the app actually takes: `CutInView`'s `onPress` went straight
 * to the host's `dismiss`, which consults no clock. Setting the constant to 300
 * would have turned two unit tests red and changed the behaviour of the app not
 * at all. That is the same defect `SCRIM_OPACITY` had one round earlier — a
 * tunable that reached no pixel — and CLAUDE.md's "keep every such value as a
 * named constant" is worth nothing if the constant is not the thing being read.
 *
 * SO THE TAP PATH GOES THROUGH THE GATE, like every other §7.2 decision. The
 * host holds the clock (`Date.now()` is not this module's to read) and hands the
 * elapsed time in; the gate decides. A refused tap returns the state UNCHANGED,
 * so the caller can tell the two apart by identity or by `live`.
 *
 * TODAY IT REFUSES NOTHING, because the window is zero, and that is the point:
 * the behaviour is identical and the knob is now real. `cutInGate.test.ts` reads
 * the constant rather than the number, so the pair of assertions holds for
 * whatever a playtest sets it to.
 *
 * THE AUTO-DISMISS DOES NOT COME THROUGH HERE. `HOLD_MS` is the timer's clock;
 * routing it through the tap window would let a window longer than the hold
 * strand a cut-in on screen for ever.
 */
export function tapDismissCutIn(state: CutInSessionState, elapsedMs: number): CutInSessionState {
  if (!canDismissAt(elapsedMs)) return state;
  return dismissCutIn(state);
}

/**
 * HAS THE CUT-IN OUTSTAYED ITS HOLD? It leaves on its own as well as on a tap,
 * because an interrupt that waits for permission is a modal dialog.
 *
 * `HOLD_MS` is time on screen at full weight, and nothing follows it: the
 * overlay un-mounts on the same tick. This paragraph used to end "and `EXIT_MS`
 * runs after it", which was false — see `ENTER_MS` in `cutInTuning.ts` for what
 * that constant was and why it is gone rather than wired.
 */
export function cutInExpiredAt(elapsedMs: number): boolean {
  return elapsedMs >= CUT_IN_TUNING.HOLD_MS;
}

/**
 * WHEN THE HOST SHOULD TAKE IT DOWN IF NOBODY TAPPED — the arrival plus the
 * hold, which is also THE WHOLE BEAT, enter to gone.
 *
 * ONE FUNCTION, NOT TWO. There was a `cutInTotalMs` beside this one, adding an
 * exit duration that no animation performed, and its only callers were three
 * assertions in `cutInGate.test.ts`. Two names for the length of one beat is
 * how two parts of an app come to report different numbers for the same thing.
 */
export function cutInAutoDismissMs(): number {
  return CUT_IN_TUNING.ENTER_MS + CUT_IN_TUNING.HOLD_MS;
}
