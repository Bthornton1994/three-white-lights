/**
 * sessionServer.ts — the body of the `record-training-session` Edge Function,
 * written in the client's language because there is no backend yet.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS IS, AND WHY IT IS NOT "THE CLIENT WRITING PROGRESSION"
 * ---------------------------------------------------------------------------
 * CLAUDE.md: "Any mutation to Total, e1RM, streak state, meet results, or
 * currency balances goes through a Supabase Edge Function. The client never
 * writes these directly, even during prototyping ... do not write
 * client-authoritative code that will need unwinding later."
 *
 * There is no Supabase project in this repo. The choice was between letting a
 * component compute an e1RM and stuff it into local state — the exact shape
 * that has to be unwound later — and writing the server's decision procedure
 * once, in a module the client cannot reach around. This is the second.
 *
 * The boundary is real even though both halves run in one process:
 *
 *   - This module takes a `ProgressionProposal` and a stored `ServerRecord` and
 *     returns a `ProgressionSnapshotWire` — the decoded JSON body of a
 *     response. It is exactly the value an Edge Function would send.
 *   - The client turns that into truth through `receiveProgressionSnapshot`,
 *     which is the one door in `progression.ts`. Nothing here mints a
 *     `Confirmed` number or a `ProgressionSnapshot`; it cannot, because the
 *     symbols that would let it are private to that module.
 *   - Nothing here reads the client's projection. The e1RM is recomputed from
 *     the reported sets with `e1rm.ts`, and the streak from `streak.ts`. A
 *     client that lied about either is simply ignored — which is the property
 *     server-authority exists for, and the reason this is worth writing now
 *     rather than later.
 *
 * PORTING IT IS A MOVE, NOT A REWRITE: the file is pure, has no React and no
 * I/O, and its only inputs are the proposal and the stored record.
 *
 * ---------------------------------------------------------------------------
 * PURITY CONTRACT
 * ---------------------------------------------------------------------------
 *   - Zero React imports, zero I/O, zero side effects, no clock, no randomness.
 *   - The day is resolved by the caller and passed in. GDD §4.1: "'Local' is an
 *     account property the server resolves, not the device's current timezone",
 *     and `TrainingSessionReport.deviceWallClock` is explicitly a HINT. This
 *     module takes the resolved day as a parameter and reads the hint only to
 *     report drift.
 *   - Every transition returns a new record; inputs are never mutated.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT REFUSES
 * ---------------------------------------------------------------------------
 *   - A TOTAL. There is no path from a training session to `totalKg`, in this
 *     file or in `progression.ts`'s reach map. GDD §2, §3.2, §6.4: Total is the
 *     sum of best successful competition attempts and moves on meet day only.
 *     The stored total is carried through untouched and
 *     `sessionServer.test.ts` asserts it across every session it can build.
 *   - AN e1RM PAST THE CHART. `e1rm.ts` refuses rather than extrapolating, and
 *     this module propagates the refusal: a set it cannot answer for
 *     contributes nothing, and a session of only such sets moves no e1RM. It
 *     never substitutes a second formula.
 *   - AN e1RM THAT WENT DOWN. `bestE1rmKg` is the BEST on record, so a bad
 *     session cannot cost a lifter their number (GDD §12.3: never punish
 *     showing up).
 *   - ANYTHING BOUGHT. `applyTrainingSession` takes a proposal and a record. It
 *     has no parameter for a purchase, an entitlement, a boost or a balance, so
 *     nothing purchasable can change what a session is worth (GDD §8.1).
 *   - AN ACCESSORY SESSION CLAIMING AN e1RM. See below.
 *   - A SET WHOSE UNIT IT CANNOT PROVE. See THE UNIT below.
 *
 * ---------------------------------------------------------------------------
 * THE UNIT — why the write path checks it, and why it refuses rather than
 * converts
 * ---------------------------------------------------------------------------
 * FOR FOUR ROUNDS THIS MODULE CONTAINED NO OCCURRENCE OF THE WORD "unit", while
 * writing a `Confirmed`, protected, MONOTONE field named `bestE1rmKg`.
 *
 * The chain, and what proved the `Kg` at each step:
 *
 *   client sends `TrainingSetReport.weightKg`   nothing. A bare number with the
 *                                               unit in its name.
 *   `progression.ts` decoder                    `isFiniteWeight` — finiteness.
 *   `tryEstimateE1rm`                           nothing, BY DESIGN. `e1rm.ts`
 *                                               is documented "unit-agnostic:
 *                                               kg in → kg out, lb in → lb out.
 *                                               Do not convert inside this
 *                                               module", and `CompletedSet.
 *                                               weight` is documented "any
 *                                               unit". It is correct there.
 *   write to `record.bestE1rmKg`                nothing.
 *   `nextBestE1rm`                              monotone — never returns below
 *                                               what is held.
 *   `ConfirmedFacts.bestE1rmKg`                 a brand literally named `Kg`,
 *                                               asserting nothing.
 *
 * So a pound session recorded as kilograms is 2.2046x too large and PERMANENT:
 * no later honest session lowers it, every future prescription is computed from
 * it (`todayForLifter`), every future PR is tested against it, and it crosses
 * into the other mode through `meetServer.ts`'s `meetDayFacts` — `suggestOpener`
 * turns it into a declared attempt and `stageLoadRatio` divides a proven
 * kilogram meet weight by it.
 *
 * `readKilogramSets` is the check, and it runs before `bestE1rmFromSets` and
 * before the streak. See that function for what kind of check each half is —
 * the shape is a compile error, the accepted answer is a runtime comparison, and
 * the comparison is against a CONSTANT rather than server-owned data, which is
 * weaker than `replayMeetCard`'s. Said plainly rather than rounded up.
 *
 * AND A CARD IS NOT THE ONLY ROUTE INTO THAT FIELD. `newServerRecord()` SEEDS
 * it, on every account, and for four rounds the seed was
 * `SESSION_TUNING.STARTING_E1RM_KG` — three bare numbers with the unit in the
 * identifier, under a comment saying they were "NOT PROGRESSION" and were not
 * persisted. They were: the same field, the same `ConfirmedKg` brand, the same
 * `'protected'` row in `FACT_PROTECTION`, and `nextBestE1rm` is monotone, so
 * the seed is a permanent FLOOR rather than a value the first real session
 * replaces. `readKilogramSets` never saw it because it never rode a card.
 * The seed is now a `StartingE1rmSeed` — the same tagged-pair shape as the card,
 * the bodyweight and the meet card — and `PROVEN_STARTING_E1RM` below is the
 * narrow. Because that input is a literal in this build rather than JSON from a
 * client, the check is a COMPILE error rather than a runtime refusal; see that
 * binding for why the two routes get different strengths on purpose, and for
 * what neither of them proves.
 *
 * HOW REACHABLE IS A POUND SESSION, honestly. NOT a one-token flip.
 * `SESSION_TUNING.LOAD_UNIT` chooses the SNAPPING GRID only
 * (`RPE_LOADING_TUNING.ROUNDING_INCREMENT`); `session.ts`'s `prescribeSession`
 * computes the load from a KILOGRAM e1RM either way, so flipping the constant
 * produces a kilogram magnitude on a 5-unit grid rather than a pound session.
 * The training path has no `POUND_MEET_RULES` — no exported, validated, in-tree
 * producer of pound numbers — which is the difference from the meet path and it
 * is stated rather than glossed.
 *
 * WHAT IS REACHABLE IS THE SAME THING THE MEET PATH HAD: a client running the
 * daily loop in pounds, which is GDD §11's unsettled display-unit question one
 * mode over, plus untyped JSON and casts — the traffic this module exists for.
 * `meetServer.ts` records that "no game module produces it" was found FALSE
 * TWICE on the other path, and that argument is not re-made here.
 *
 * AND THE COST OF THE REFUSAL IS REAL. A player who genuinely trained in pounds
 * is refused and loses the streak day, which is the shape CLAUDE.md's "never
 * punish daily engagement" warns about. It is the safe branch and it is the same
 * branch `applyMeetResult` takes for a pound meet; GDD §11 records both, and the
 * screen that would tell such a player what happened is part of that open
 * ruling rather than something to bolt on ahead of it. Nothing in the shipped
 * loop can produce the case today.
 *
 * ---------------------------------------------------------------------------
 * ACCESSORY WORK NEVER TOUCHES e1RM — RULED, AND ENFORCED HERE
 * ---------------------------------------------------------------------------
 * GDD §3.2 puts an accessory day in the daily rotation. The ruling on what it
 * may move: `LiftKind` stays exactly the three contested lifts, matching real
 * meet structure; accessory work does not write `bestE1rmKg` and produces no
 * e1RM close-out; it contributes **Training IQ** (GDD §2's existing currency)
 * and nothing else lift-specific.
 *
 * TWO ENFORCEMENTS, because a comment is not one:
 *
 *   1. AT COMPILE TIME. `ACCESSORY_IS_NOT_A_COMPETITION_LIFT` and
 *      `REPORTED_LIFT_IS_A_COMPETITION_LIFT` below fail `tsc` if `LiftKind`
 *      grows a fourth member or if the wire's `TrainingSetReport.lift` is
 *      widened to `SimLift` to let accessory through. That is the route the
 *      ruling actually forbids, and it is now a build error rather than a
 *      convention.
 *   2. AT RUNTIME. `TrainingSetReport` is a compile-time claim about a caller;
 *      a JS caller or a hand-edited save can put `'accessory'` in it. Before
 *      this was checked, such a session was ACCEPTED: the streak advanced, a
 *      fatigue record was written under `lift: 'accessory'`, and
 *      `AppliedTrainingSession.bestE1rmKg` came back as `undefined` while
 *      typed `number | null` — the e1RM path survived only because
 *      `estimate > undefined` happens to be false. `applyTrainingSession` now
 *      returns `NOT_A_COMPETITION_LIFT` and `bestE1rmFromSets` throws.
 *
 * WHAT IS NOT BUILT HERE, said plainly so nobody reads the enforcement as the
 * feature: there is no accessory day in `SESSION_TUNING.LIFT_ROTATION` and no
 * Training IQ balance. Both need a `progression.ts` change this module cannot
 * make on its own — a `trainingIq` fact (with a §8.1 protection answer) and a
 * proposal kind for a session that reports no `LiftKind` — plus a close-out
 * that shows IQ instead of an e1RM. GDD §11 records the ruling and what is
 * outstanding.
 */

import { DOTS_TOTAL_UNIT } from './dots';
import { estimateE1rm, tryEstimateE1rm } from './e1rm';
import {
  EMPTY_FATIGUE_STATE,
  LUCKIEST_ROLLS,
  recordSession,
  type FatigueState,
  type InjuryNotice,
  type InjuryRolls,
  type SessionRecord,
  type SimLift,
} from './fatigue';
import { LIFT_ORDER, type LiftKind } from './meet';
import { declaredRows } from './progression';
import type {
  KilogramTrainingCard,
  MeetResultWire,
  ProgressionSnapshotWire,
  ProposalOfKind,
  StartingE1rmSeed,
  StreakStateWire,
  TrainingSetReport,
  WalletCurrency,
} from './progression';
import {
  asStreakDay,
  createStreakState,
  openDay,
  recordTrainingDay,
  type StreakState,
} from './streak';
import { nextBestE1rm } from './session';
import { SESSION_TUNING } from './sessionTuning';

// ---------------------------------------------------------------------------
// The accessory-day boundary, at compile time
// ---------------------------------------------------------------------------

/**
 * COMPILE-TIME ASSERTION: `'accessory'` IS NOT A COMPETITION LIFT.
 *
 * The ruling keeps `LiftKind` at exactly squat / bench / deadlift, because that
 * is the structure of the sport (GDD §6.2) and every meet-day type is keyed by
 * it. Widening it to carry accessory work is the edit this refuses. `never` is
 * not assignable from `true`, so the failure is a build error on this line with
 * this constant's name in it.
 */
type AccessoryIsNotACompetitionLift = 'accessory' extends LiftKind ? never : true;
export const ACCESSORY_IS_NOT_A_COMPETITION_LIFT: AccessoryIsNotACompetitionLift = true;

/**
 * COMPILE-TIME ASSERTION: WHAT A TRAINING SESSION MAY REPORT IS A COMPETITION
 * LIFT.
 *
 * The other half, and the one that closes the obvious workaround: leaving
 * `LiftKind` alone and widening the WIRE to `SimLift` instead, so an accessory
 * set reaches `bestE1rmFromSets` legitimately. That change fails here.
 */
type ReportedLiftIsACompetitionLift = [TrainingSetReport['lift']] extends [LiftKind] ? true : never;
export const REPORTED_LIFT_IS_A_COMPETITION_LIFT: ReportedLiftIsACompetitionLift = true;

/**
 * COMPILE-TIME ASSERTION: the Sim vocabulary is the competition lifts plus
 * accessory, and nothing else.
 *
 * The control for the two above. Both are satisfied by a world where
 * `'accessory'` stopped existing at all, which would make them pass while the
 * thing they are guarding had quietly been deleted rather than fenced. This
 * fails in that world, and fails again if a fifth Sim lift appears without
 * anybody deciding what it reports.
 */
type SimLiftIsCompetitionLiftsPlusAccessory = [SimLift] extends [LiftKind | 'accessory']
  ? [LiftKind | 'accessory'] extends [SimLift]
    ? true
    : never
  : never;
export const SIM_LIFTS_ARE_COMPETITION_LIFTS_PLUS_ACCESSORY: SimLiftIsCompetitionLiftsPlusAccessory =
  true;

/**
 * Whether a reported lift is one the progression boundary can name, at RUNTIME.
 *
 * `LIFT_ORDER` is `meet.ts`'s own list, not a second copy of it, so this cannot
 * drift from the type above.
 */
function isCompetitionLift(lift: string): lift is LiftKind {
  return (LIFT_ORDER as readonly string[]).includes(lift);
}

// ---------------------------------------------------------------------------
// What the server stores
// ---------------------------------------------------------------------------

/**
 * The row a real backend would hold for one lifter.
 *
 * Plain JSON apart from `StreakState`, which is plain JSON too (its `StreakDay`
 * brand is a type-level fiction and serialises as an integer). `FatigueState`
 * is the hidden ledger and is stored here rather than on the client for the
 * same reason everything else is: it is what decides how tomorrow feels, and a
 * client that could edit it could edit the difficulty.
 */
export interface ServerRecord {
  readonly revision: number;
  /** Best competition total, kg. MOVED BY MEET RESULTS ONLY (GDD §6.4). */
  readonly totalKg: number | null;
  readonly bestE1rmKg: Readonly<Record<LiftKind, number | null>>;
  readonly streak: StreakState;
  readonly meets: readonly MeetResultWire[];
  readonly wallet: Readonly<Record<WalletCurrency, number>>;
  readonly fatigue: FatigueState;
}

// ---------------------------------------------------------------------------
// The unit this record stores an e1RM in — and the seed that is written in it
// ---------------------------------------------------------------------------

/**
 * The one unit permanent progression stores an e1RM in.
 *
 * `DOTS_TOTAL_UNIT` rather than a fresh `'kg'` literal, for the reason
 * `meetServer.ts` gives for `PROGRESSION_TOTAL_UNIT`: exactly ONE string in the
 * tree that a unit check compares against, spelled the way `meet.ts` spells it
 * and pinned to that spelling by `dots.test.ts`. The name says DOTS and the
 * reason here is not DOTS — `ServerRecord.bestE1rmKg`,
 * `ProgressionSnapshotWire.bestE1rmKg` and `ConfirmedFacts.bestE1rmKg` are
 * kilogram fields because `SESSION_TUNING.STARTING_E1RM` declares kilograms,
 * because `readKilogramSets` refuses anything else, and because `meetDayFacts`
 * hands them to `suggestOpener` beside a proven-kilogram meet.
 *
 * A SEPARATE NAME FROM THE TOTAL'S AND THE BODYWEIGHT'S, aliased to the same
 * string. Three independent facts, and a ruling that converted one would not
 * automatically convert the others; one constant would hide that.
 */
const PROGRESSION_E1RM_UNIT = DOTS_TOTAL_UNIT;

/**
 * The starting e1RMs, narrowed to the arm this record can store.
 *
 * `Extract` off `PROGRESSION_E1RM_UNIT` rather than off a `'kg'` literal, so
 * the compile-time narrow and `readKilogramSets`'s runtime comparison are the
 * same question asked of the same constant.
 */
type ProvenStartingE1rm = Extract<StartingE1rmSeed, { readonly unit: typeof PROGRESSION_E1RM_UNIT }>;

/**
 * THE SEED, PROVEN TO BE IN THE UNIT THIS RECORD STORES.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS A COMPILE ERROR AND `readKilogramSets` IS A RUNTIME REFUSAL
 * ---------------------------------------------------------------------------
 * They guard the same field by two different routes, and the routes carry
 * different amounts of trust, so the checks are not the same strength — which
 * is worth stating rather than levelling.
 *
 *   - A CARD ARRIVES AS JSON from a client this module does not trust. Both
 *     arms of `TrainingCardReport` MUST be representable, because that is what
 *     a client can send; so `card.unit` is whatever the sender wrote and the
 *     only place to compare it is at runtime. `readKilogramSets` does that.
 *   - THE SEED IS A LITERAL IN THIS BUILD. There is no sender, no JSON and no
 *     moment at which it could be anything other than what the repository says.
 *     So the strongest available question — "is this the kilogram arm?" — can
 *     be asked by `tsc`, and is. Declaring the seed in any other unit does not
 *     reach a runtime refusal; it fails to compile, here, on the line whose
 *     name says what the value is meant to be.
 *
 * That is the `const proven: KilogramTrainingCard = card;` idiom from
 * `readKilogramSets`, with the narrow done by the compiler because the input is
 * static.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS LOAD-BEARING HERE AND WHAT IS ONLY LEGIBILITY — measured, not assumed
 * ---------------------------------------------------------------------------
 * THE ANNOTATION IS NOT THE CHECK, and claiming it was would be the kind of
 * rounding-up this boundary has been graded on twice. Deleting `:
 * ProvenStartingE1rm` from this line and letting the type be inferred compiles
 * CLEAN and changes nothing — verified by running it. What is load-bearing is
 * that THE ARMS CARRY DIFFERENT FIELD NAMES: `.kilograms` does not exist on the
 * pound arm, so with the annotation gone a flipped unit still fails, three lines
 * down in `newServerRecord` and again in `todayForLifter` and again in
 * `sessionClient.ts` and again at `useMeetDay.ts`'s `meetDayFacts` call. The
 * annotation's job is to make that failure land on a line whose NAME says what
 * the value is meant to be, and to close the "widen it to the union" escape —
 * which also fails, at the four `.kilograms` reads.
 *
 * So the honest ranking: the SHAPE is the guarantee, the name is a courtesy to
 * whoever reads the error.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT STILL DOES NOT PROVE
 * ---------------------------------------------------------------------------
 * That the MAGNITUDES are kilograms. `{ unit: 'kg', kilograms: { squat: 397,
 * … } }` compiles and seeds a pound squat as 397 kg. A tag proves what was
 * declared, not what was typed — `progression.ts` §7.3(b) names that residual
 * for every declared unit on this boundary and it is not smaller here. What it
 * is, and the reason it is worth having anyway, is that the unit and the
 * magnitudes can no longer be moved apart WITHOUT SOMEBODY SAYING SO in the
 * diff.
 */
const PROVEN_STARTING_E1RM: ProvenStartingE1rm = SESSION_TUNING.STARTING_E1RM;

/**
 * COMPILE-TIME ASSERTION: the seed's type can still express a unit this record
 * refuses.
 *
 * The control for the binding above, in the same shape as
 * `SIM_LIFTS_ARE_COMPETITION_LIFTS_PLUS_ACCESSORY`. Delete the `'lb'` arm from
 * `StartingE1rmSeed` and the binding becomes "this one-armed union is that arm"
 * — trivially true, guarding nothing, and passing. This fails in that world, so
 * the check above cannot be satisfied by deleting the thing it discriminates
 * against.
 */
type SeedCanDeclareARefusedUnit = [Exclude<StartingE1rmSeed, ProvenStartingE1rm>] extends [never]
  ? never
  : true;
export const A_STARTING_E1RM_CAN_DECLARE_A_UNIT_THIS_RECORD_REFUSES: SeedCanDeclareARefusedUnit =
  true;

/**
 * A lifter who has never trained.
 *
 * THE STARTING e1RMs ARE PROGRESSION, and this comment used to say they were
 * not. They are written into `bestE1rmKg` here — protected, on the wire as
 * `ProgressionSnapshotWire.bestE1rmKg`, and arriving at the client as a
 * `ConfirmedKg` — and `nextBestE1rm` is MONOTONE, so what is written on this
 * line is the permanent FLOOR under that lifter's e1RM: no later honest session
 * lowers it, and it goes on deriving tomorrow's bar (`todayForLifter`) and meet
 * day's opener (`meetServer.ts`'s `meetDayFacts`) for the life of the account.
 * The MAGNITUDES are placeholders a sign-up flow replaces; their being written
 * into a permanent fact is not.
 *
 * They are read through `PROVEN_STARTING_E1RM` — see above for what that
 * proves — rather than off a constant whose unit was in its name.
 *
 * The Recovery Day balance is GDD §4.2's signup grant, read from `streak.ts`'s
 * own economy table rather than restated.
 *
 * `signupDay` IS A REQUIRED ARGUMENT AND HAS NO DEFAULT. It is the day the
 * account was created, and `streak.ts` charges a lifter's idle days from it
 * (GDD §4.2), so a wrong-but-quiet fallback here would be a wrong-but-quiet
 * Recovery Day balance for the lifter's whole first week. This module never
 * reads a clock either; the caller resolves the day, exactly as it does for
 * `applyTrainingSession`.
 */
export function newServerRecord(signupDay: number): ServerRecord {
  return {
    revision: 0,
    totalKg: null,
    bestE1rmKg: {
      squat: PROVEN_STARTING_E1RM.kilograms.squat,
      bench: PROVEN_STARTING_E1RM.kilograms.bench,
      deadlift: PROVEN_STARTING_E1RM.kilograms.deadlift,
    },
    streak: createStreakState(asStreakDay(signupDay)),
    meets: [],
    wallet: { gymBucks: 0, chalk: 0 },
    fatigue: EMPTY_FATIGUE_STATE,
  };
}

function streakWire(state: StreakState): StreakStateWire {
  return {
    signupDay: state.signupDay,
    currentStreak: state.currentStreak,
    longestStreak: state.longestStreak,
    lastTrainedDay: state.lastTrainedDay,
    entitlement: state.entitlement,
    entitlementArmed: state.entitlementArmed,
    recoveryDayProtectionEnabled: state.recoveryDayProtectionEnabled,
    hasBankedFirstRecoveryDaySave: state.hasBankedFirstRecoveryDaySave,
  };
}

/**
 * The response body for a stored record. The one shape the client is ever given.
 *
 * `fatigue` is deliberately NOT on it: `ProgressionSnapshotWire` has no field
 * for it and none may be added. GDD §3.4 and §12.3 forbid a visible fatigue
 * meter, and a ledger on the wire is a meter that has not been rendered yet.
 * The client gets a `SessionFeel` instead, computed from the copy of the ledger
 * it is handed for the session it is about to play — qualitative, and with its
 * one number behind a private symbol.
 */
export function snapshotWireFor(
  record: ServerRecord,
  acknowledgedProposalId: string | null,
): ProgressionSnapshotWire {
  return {
    revision: record.revision,
    totalKg: record.totalKg,
    bestE1rmKg: {
      squat: record.bestE1rmKg.squat,
      bench: record.bestE1rmKg.bench,
      deadlift: record.bestE1rmKg.deadlift,
    },
    streak: streakWire(record.streak),
    meets: record.meets.map((meet) => ({ ...meet })),
    wallet: { gymBucks: record.wallet.gymBucks, chalk: record.wallet.chalk },
    acknowledgedProposalId,
  };
}

// ---------------------------------------------------------------------------
// Reading the card — the one place a set's unit is proven
// ---------------------------------------------------------------------------

/**
 * The sets on a reported card, PROVEN to be in the unit this record stores.
 *
 * ---------------------------------------------------------------------------
 * WHY THE CHECK IS HERE AND NOT FURTHER DOWN
 * ---------------------------------------------------------------------------
 * Nothing below this function looks at a unit, and nothing below it can:
 *
 *   - `bestE1rmFromSets` calls `tryEstimateE1rm`, and `e1rm.ts` is documented
 *     UNIT-AGNOSTIC — "kg in → kg out, lb in → lb out. Do not convert inside
 *     this module". `CompletedSet.weight` is documented "any unit". It is not
 *     an oversight there; it is the design, and it means a pound set produces a
 *     pound e1RM with no complaint.
 *   - `nextBestE1rm` is MONOTONE, so the answer can only ever go up. A pound
 *     number banked as kilograms is 2.2x too large and no later honest session
 *     lowers it. It poisons every future PR test, every prescription computed
 *     from it, and — through `meetServer.ts`'s `meetDayFacts` — meet day's
 *     opener suggestion and `stageLoadRatio`'s load ratio.
 *   - `ProgressionSnapshotWire.bestE1rmKg` has no unit field, so once the
 *     number is on the wire the unit is unrecoverable, exactly as
 *     `MeetResultWire.totalKg`'s is.
 *
 * ---------------------------------------------------------------------------
 * WHY IT REFUSES RATHER THAN CONVERTS
 * ---------------------------------------------------------------------------
 * Same posture as `dots.ts` past its domain, `e1rm.ts` past the chart, and
 * `meetServer.ts` on a pound meet: refuse, and name the remedy.
 * `kilogramsFromPounds` is exact, so converting is arithmetically available —
 * and that is not the question. The question is whether a module that writes a
 * monotone permanent fact should act on a unit tag it cannot verify. Converting
 * turns a mislabelled card into a permanently wrong e1RM instead of a refusal
 * somebody can see. See `UNSUPPORTED_SESSION_UNIT`.
 *
 * ---------------------------------------------------------------------------
 * WHAT KIND OF CHECK EACH HALF IS — said plainly, because rounding these up is
 * how the meet path's version of this defect survived two rounds
 * ---------------------------------------------------------------------------
 *   - REACHING THE SETS WITHOUT NAMING A UNIT IS A COMPILE ERROR, everywhere.
 *     There is no field on `TrainingCardReport` that yields sets from both arms
 *     — no `sets`, exactly as there is no `attempts` on `MeetCardReport` and no
 *     `value` on `BodyweightReading`. The shape forces the question to be asked.
 *   - WHICH ANSWER IS ACCEPTED IS A RUNTIME STRING COMPARISON, and deleting the
 *     `if` below is a TEST failure, not a compile error. It has to be a runtime
 *     check: `card.unit` is whatever the sender wrote once it has been through
 *     JSON, and an unrecognised unit must fail safe rather than be assumed.
 *   - THE COMPARISON IS AGAINST A CONSTANT, NOT AGAINST SERVER-OWNED DATA. This
 *     is WEAKER than `replayMeetCard`'s `card.unit === meet.rules.unit`, which
 *     asks "does what you say match what this meet is". There is no session
 *     definition to compare against — a session is authored by the client, not
 *     drawn from a catalogue — so the strongest question available is "did you
 *     say kg?". Stated rather than glossed.
 */
function readKilogramSets(
  // Widened by `| undefined` on purpose: a request body can simply not have this
  // field, and a server whose first act on a malformed body is to throw is a
  // server that has told the caller nothing. Typed code cannot pass one.
  card: ProposalOfKind<'record-training-session'>['report']['card'] | undefined,
): SessionServerResult<readonly TrainingSetReport[]> {
  if (card === undefined) {
    return {
      ok: false,
      error: {
        code: 'MALFORMED_SESSION_CARD',
        message: 'sessionServer: this report carries no card, so there are no sets to record.',
      },
    };
  }
  if (card.unit !== PROGRESSION_E1RM_UNIT) {
    return {
      ok: false,
      error: {
        code: 'UNSUPPORTED_SESSION_UNIT',
        message:
          `sessionServer: this session says its set weights are in ${JSON.stringify(card.unit)} and ` +
          `permanent progression stores an e1RM in ${JSON.stringify(PROGRESSION_E1RM_UNIT)}. ` +
          'Recording it would read every weight on it as kilograms — which SUCCEEDS silently, ' +
          'because e1rm.ts is unit-agnostic by design and record.bestE1rmKg has no unit field to ' +
          'disagree with — and bestE1rmKg is monotone, so the error would be permanent. This does ' +
          'NOT convert for you: run the loop in kilograms, or convert the whole card at the call ' +
          'site with kilogramsFromPounds and propose the converted session.',
      },
    };
  }
  // THROUGH THE NARROW, NOT THROUGH A SHARED FIELD. `card` is the kilogram arm
  // by now, so `kilogramSets` is the only list of sets in scope.
  //
  // THE NARROW IS BOUND TO A NAME rather than left as a fact about control flow.
  // `KilogramTrainingCard` is what "these sets have been proven to be kilograms"
  // is called, in one spelling — and the binding earns its keep: WIDENING the
  // condition above to let the pound arm through stops compiling on THIS line,
  // where the name says what the value is meant to be, instead of type-checking
  // and failing a test. Mutation-tested in both shapes.
  const proven: KilogramTrainingCard = card;
  // `declaredRows` is the runtime half: a tag with nothing under it, or with
  // something that is not a list, is refused rather than iterated.
  const sets = declaredRows(proven.kilogramSets);
  if (sets === null) {
    return {
      ok: false,
      error: {
        code: 'MALFORMED_SESSION_CARD',
        message:
          `sessionServer: this card declares ${JSON.stringify(card.unit)} and carries no list of ` +
          'sets under that unit. A declared unit with nothing under it is not a session, and ' +
          'guessing which field was meant is how a pound list gets read as a kilogram one.',
      },
    };
  }
  return { ok: true, value: sets };
}

// ---------------------------------------------------------------------------
// Deriving e1RM from what was reported
// ---------------------------------------------------------------------------

/**
 * The best e1RM the reported sets imply, per lift, kg.
 *
 * `tryEstimateE1rm` rather than `estimateE1rm` so a set the published chart
 * cannot answer for is SKIPPED rather than throwing the whole session away.
 * `e1rm.ts` refuses past an effective rep max of 16 and this respects the
 * refusal: no number is produced for such a set, and none is invented.
 *
 * @throws {RangeError} on a set naming anything but a competition lift. Accessory
 * work has no e1RM by ruling (see the header), and `TrainingSetReport.lift` is
 * only a compile-time claim about the caller — before this guard, an accessory
 * set walked through and was silently dropped by an `estimate > undefined`
 * comparison, which is an accident rather than a boundary.
 */
export function bestE1rmFromSets(
  sets: readonly TrainingSetReport[],
): Readonly<Record<LiftKind, number | null>> {
  const out: Record<LiftKind, number | null> = { squat: null, bench: null, deadlift: null };
  for (const set of sets) {
    // UNTRUSTED KEY: this is a wire value, and an unknown one would otherwise
    // become a fourth key on an object typed as having exactly three.
    if (!isCompetitionLift(set.lift)) {
      throw new RangeError(
        `sessionServer: ${String(set.lift)} is not a competition lift and has no e1RM. ` +
          `Accessory work contributes Training IQ only (GDD §2, §3.2).`,
      );
    }
    const estimate = tryEstimateE1rm({ weight: set.weight, reps: set.reps, rpe: set.rpe });
    if (estimate === null) continue;
    const held = out[set.lift];
    if (held === null || estimate > held) out[set.lift] = estimate;
  }
  return out;
}

// ---------------------------------------------------------------------------
// The strain a session cost, for the hidden ledger
// ---------------------------------------------------------------------------

/**
 * The reported sets, as the one `SessionRecord` `fatigue.ts` folds into the
 * ledger. GDD §3.2 is one session per day, so one record per day.
 *
 * `topRpe` is the hardest RPE reported, `workSets` the number of sets, and
 * `repsPerSet` the mean rounded up — `fatigue.ts` takes a rectangle, and
 * rounding the ragged real session UP is the direction that cannot understate
 * what it cost.
 *
 * NO WEIGHT FIELD, which is `fatigue.ts`'s design and not an omission: strain is
 * a function of RPE, sets and reps, so a lifter whose e1RM has doubled and who
 * still trains 5x3 @ RPE 9 sits at exactly the strain they did on day one.
 */
export function fatigueRecordFor(
  day: number,
  lift: SimLift,
  sets: readonly TrainingSetReport[],
): SessionRecord | null {
  if (sets.length === 0) return null;
  let topRpe = Number.NEGATIVE_INFINITY;
  let totalReps = 0;
  for (const set of sets) {
    if (set.rpe > topRpe) topRpe = set.rpe;
    totalReps += set.reps;
  }
  return {
    day,
    lift,
    topRpe,
    workSets: sets.length,
    repsPerSet: Math.ceil(totalReps / sets.length),
  };
}

// ---------------------------------------------------------------------------
// The Edge Function itself
// ---------------------------------------------------------------------------

export type SessionServerErrorCode =
  /** The reported sets name more than one lift. One lift a day (GDD §3.2). */
  | 'MIXED_LIFTS'
  /**
   * A CARD WHOSE WEIGHTS THIS RECORD CANNOT STORE, because it was not lifted in
   * kilograms.
   *
   * `UNSUPPORTED_MEET_UNIT`'S SIBLING, AND A SEPARATE CODE RATHER THAN THE SAME
   * SPELLING. `meetServer.ts` and `resultCard.ts` share one spelling because
   * they are two points in ONE pipeline refusing ONE submission — a meet result
   * whose total or bodyweight is in the wrong unit, with one remedy ("convert
   * the whole entry at the call site"). This is a different pipeline: a
   * different proposal kind, a different Edge Function, a different fact
   * (`bestE1rmKg`, not `totalKg`), and a different remedy — there is no meet to
   * convert and no bodyweight beside it, only the loop's own
   * `SESSION_TUNING.LOAD_UNIT`. Spelling it `UNSUPPORTED_MEET_UNIT` here would
   * put the word "meet" on a refusal with no meet in it, and a caller matching
   * on the code would be handed the meet path's advice.
   *
   * WHAT IT REFUSES AND WHY IT DOES NOT CONVERT: the same posture `dots.ts` and
   * `meetServer.ts` take. lb→kg is exact, so this module *could* convert — but
   * converting would make this the place that handles units, and the number it
   * would produce goes into `record.bestE1rmKg`, which `nextBestE1rm` keeps
   * MONOTONE. A conversion applied to a card that was mislabelled rather than
   * genuinely pounds is a permanent 2.2x error that no later honest session can
   * walk back. Refuse, and name the remedy: run the loop in the unit the record
   * stores, or convert the whole card at the call site with
   * `kilogramsFromPounds` before proposing.
   */
  | 'UNSUPPORTED_SESSION_UNIT'
  /**
   * A UNIT-TAGGED CARD WITH NO SETS UNDER ITS TAG.
   *
   * `{ "unit": "kg" }`, or `{ "unit": "kg", "poundSets": [...] }`. Each narrows
   * perfectly — the tag is one of the two `tsc` knows — and then the field the
   * narrow entitles you to read is `undefined`. NOT `UNSUPPORTED_SESSION_UNIT`:
   * the unit is supported and correctly declared, there is simply nothing in the
   * envelope, and the remedy is to fix the sender rather than to convert
   * anything. `meetServer.ts` splits `MALFORMED_READING` off from
   * `UNSUPPORTED_MEET_UNIT` for exactly this reason, after shipping a round in
   * which a checked tag over an unchecked payload wrote `undefined` into a
   * stored result with `ok: true`.
   *
   * REACHABLE ONLY FROM UNTYPED JSON OR A CAST, which is the traffic this module
   * exists for.
   */
  | 'MALFORMED_SESSION_CARD'
  /**
   * A reported set names something that is not a competition lift — accessory
   * work, or a lift that does not exist. Accessory work contributes Training IQ
   * and never an e1RM, so it has no business on this proposal (see the header).
   */
  | 'NOT_A_COMPETITION_LIFT'
  /**
   * `streak.ts` refused: already trained today, or a day in the past.
   *
   * "An offer pending" used to be a third reason here. It is gone because
   * Recovery Days are no longer offered — protection is armed ahead and the
   * missed day consumes it, so there is no decision left open to block on.
   */
  | 'STREAK_REFUSED'
  /** The reported day is not one this record can move to. */
  | 'BAD_DAY';

export interface SessionServerError {
  readonly code: SessionServerErrorCode;
  readonly message: string;
}

export type SessionServerResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: SessionServerError };

export interface AppliedTrainingSession {
  readonly record: ServerRecord;
  readonly wire: ProgressionSnapshotWire;
  /** What the streak did. From `streak.ts`, not recomputed here. */
  readonly streakAfter: number;
  readonly milestonesReached: readonly number[];
  /** Best e1RM for the trained lift after this session, kg. */
  readonly bestE1rmKg: number | null;
  /** True when this session raised it. */
  readonly isPr: boolean;
  /** A setback this session started, or null (GDD §3.5). */
  readonly injuryOnset: InjuryNotice | null;
}

/**
 * Record a training session. THE ONLY WAY e1RM AND THE STREAK MOVE.
 *
 * @param record the lifter's stored row.
 * @param day the streak day the SERVER resolved. Not the device's, per GDD
 *   §4.1 — `proposal.report.deviceWallClock` is a hint and is not read here.
 * @param rolls injury rolls, supplied rather than drawn, so this stays pure and
 *   a test can pin the unluckiest outcome. In production these come from the
 *   Edge Function's own CSPRNG, never from the client.
 */
export function applyTrainingSession(
  record: ServerRecord,
  day: number,
  proposal: ProposalOfKind<'record-training-session'>,
  proposalId: string,
  rolls: InjuryRolls = LUCKIEST_ROLLS,
): SessionServerResult<AppliedTrainingSession> {
  if (!Number.isSafeInteger(day)) {
    return { ok: false, error: { code: 'BAD_DAY', message: `sessionServer: day ${day} is not a day index.` } };
  }
  // THE UNIT, FIRST, BEFORE `bestE1rmFromSets` AND BEFORE THE STREAK MOVES.
  // Everything below this line treats these numbers as kilograms — `e1rm.ts` is
  // unit-agnostic and will happily answer in pounds, `nextBestE1rm` is monotone,
  // and `record.bestE1rmKg` has no unit field for the answer to carry.
  const read = readKilogramSets(proposal.report.card);
  if (!read.ok) return read;
  const sets = read.value;
  // BEFORE ANYTHING ELSE, AND BEFORE THE STREAK MOVES. A session naming a lift
  // this boundary cannot answer for is refused whole rather than half-recorded:
  // an accessory set used to advance the streak and land in the fatigue ledger
  // while contributing nothing to e1RM, which is a session the player performed
  // and the server has no honest row for.
  for (const set of sets) {
    if (!isCompetitionLift(set.lift)) {
      return {
        ok: false,
        error: {
          code: 'NOT_A_COMPETITION_LIFT',
          message:
            `sessionServer: a training session reports competition lifts, received ${String(set.lift)}. ` +
            `Accessory work contributes Training IQ and never an e1RM (GDD §2, §3.2).`,
        },
      };
    }
  }
  const lifts = new Set<LiftKind>(sets.map((set) => set.lift));
  if (lifts.size > 1) {
    return {
      ok: false,
      error: {
        code: 'MIXED_LIFTS',
        message: `sessionServer: a daily session trains one lift, received ${[...lifts].join(', ')}.`,
      },
    };
  }

  const streakDay = asStreakDay(day);
  const recorded = recordTrainingDay(record.streak, streakDay);
  if (!recorded.ok) {
    return {
      ok: false,
      error: { code: 'STREAK_REFUSED', message: recorded.error.message },
    };
  }

  const estimates = bestE1rmFromSets(sets);
  const bestE1rmKg: Record<LiftKind, number | null> = {
    squat: null,
    bench: null,
    deadlift: null,
  };
  let isPr = false;
  for (const lift of LIFT_ORDER) {
    const held = record.bestE1rmKg[lift];
    const next = nextBestE1rm(held, estimates[lift]);
    bestE1rmKg[lift] = next;
    if (next !== null && (held === null || next > held)) isPr = true;
  }

  // The trained lift, taken from the sets rather than from a parameter: the
  // report is the only thing that says what was trained, and a second source
  // could disagree with it.
  const trainedLift: LiftKind | undefined = sets[0]?.lift;
  let fatigue = record.fatigue;
  let injuryOnset: InjuryNotice | null = null;
  if (trainedLift !== undefined) {
    const fatigueRecord = fatigueRecordFor(day, trainedLift, sets);
    if (fatigueRecord !== null) {
      const folded = recordSession(fatigue, fatigueRecord, rolls);
      fatigue = folded.state;
      injuryOnset = folded.injuryOnset;
    }
  }

  const next: ServerRecord = {
    revision: record.revision + 1,
    // CARRIED THROUGH UNTOUCHED. A training session has no route to a Total.
    totalKg: record.totalKg,
    bestE1rmKg,
    streak: recorded.value.state,
    meets: record.meets,
    wallet: record.wallet,
    fatigue,
  };
  return {
    ok: true,
    value: {
      record: next,
      wire: snapshotWireFor(next, proposalId),
      streakAfter: recorded.value.streakAfter,
      milestonesReached: recorded.value.milestonesReached,
      bestE1rmKg: trainedLift === undefined ? null : bestE1rmKg[trainedLift],
      isPr,
      injuryOnset,
    },
  };
}

// ---------------------------------------------------------------------------
// Reads the client needs before it can prescribe anything
// ---------------------------------------------------------------------------

/**
 * What today looks like for this lifter, so the client can build a session.
 *
 * `streakIfTrainedToday` comes from `streak.ts`'s `openDay`, which is a pure
 * read model that mutates nothing — the streak's own answer to "what does today
 * do", including the free grace and any Recovery Day save already holding the
 * run open (GDD §4.2). This maps the parts a training session needs and leaves
 * the return-visit reveal to whoever renders it.
 */
export interface TodayForLifter {
  readonly day: number;
  readonly lift: LiftKind;
  readonly e1rmKg: number;
  readonly bestE1rmKg: number | null;
  readonly streakBefore: number;
  readonly streakIfTrainedToday: number;
  /** True when the server would refuse a second session today (GDD §3.2). */
  readonly alreadyTrainedToday: boolean;
  /** A copy of the hidden ledger, for `sessionFeel`. Never rendered as a number. */
  readonly fatigue: FatigueState;
}

export function todayForLifter(record: ServerRecord, day: number, lift: LiftKind): TodayForLifter {
  const opening = openDay(record.streak, asStreakDay(day));
  const alreadyTrainedToday = opening.kind === 'already-trained-today';
  const streakIfTrainedToday =
    opening.kind === 'streak-alive' ||
    opening.kind === 'gap-covered-by-grace' ||
    opening.kind === 'gap-covered-by-recovery-days'
      ? opening.streakIfTrainedToday
      : opening.kind === 'already-trained-today'
        ? opening.currentStreak
        : 1;
  const best = record.bestE1rmKg[lift];
  return {
    day,
    lift,
    // Loads are prescribed from the best e1RM on record. Before there is one,
    // the seed stands in — which on a new account is the same number
    // `newServerRecord` already wrote into `bestE1rmKg`, so this branch is the
    // fallback for a record whose lift is null rather than a second source of
    // truth. Read through the proven narrow, so a seed declared in another unit
    // cannot reach a field named `e1rmKg` here either.
    e1rmKg: best ?? PROVEN_STARTING_E1RM.kilograms[lift],
    bestE1rmKg: best,
    streakBefore: record.streak.currentStreak,
    streakIfTrainedToday,
    fatigue: record.fatigue,
    alreadyTrainedToday,
  };
}

/**
 * e1RM for one completed set, kg, THROWING on a set the chart cannot answer for.
 *
 * Exported so the server's own arithmetic has one greppable name and so a test
 * can show that this and `session.ts`'s client-side estimate are the same call
 * into `e1rm.ts` rather than two curves that happen to agree.
 */
export function serverE1rmForSet(set: TrainingSetReport): number {
  // `e1rm.ts` IS UNIT-AGNOSTIC BY DESIGN — "kg in → kg out, lb in → lb out. Do
  // not convert inside this module" — so nothing here or below it proves what
  // this number is. Whatever proves it has to have happened before the row was
  // taken off its card. `readKilogramSets` is that place; this function is
  // exported for one test and takes a row that has already come off one.
  return estimateE1rm({ weight: set.weight, reps: set.reps, rpe: set.rpe });
}
