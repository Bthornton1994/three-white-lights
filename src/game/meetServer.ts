/**
 * meetServer.ts — the body of the `record-meet-result` Edge Function, written
 * in the client's language because there is no backend yet.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS IS, AND WHY IT IS NOT "THE CLIENT WRITING A TOTAL"
 * ---------------------------------------------------------------------------
 * CLAUDE.md: "Any mutation to Total, e1RM, streak state, meet results, or
 * currency balances goes through a Supabase Edge Function. The client never
 * writes these directly, even during prototyping ... do not write
 * client-authoritative code that will need unwinding later."
 *
 * `sessionServer.ts` set the precedent for the daily loop and this is the same
 * shape for meet day. The boundary is real even though both halves run in one
 * process:
 *
 *   - This module takes a `ProgressionProposal` and a stored `ServerRecord` and
 *     returns a `ProgressionSnapshotWire` — the decoded JSON body of a
 *     response. It is exactly the value an Edge Function would send.
 *   - The client turns that into truth through `receiveProgressionSnapshot`,
 *     which is the one door in `progression.ts`. Nothing here mints a
 *     `Confirmed` number; it cannot, because the symbols that would let it are
 *     private to that module.
 *   - NOTHING HERE READS A TOTAL OFF THE CLIENT, because there is no total on
 *     the wire to read: `MeetResultReport` carries the CARD and the bodyweight
 *     and its allowlist forbids a `totalKg`. The total is recomputed
 *     by REPLAYING the reported attempts through `meet.ts` — the same engine
 *     the client played on, applying the same non-decreasing invariant, the
 *     same three-attempt limit and the same bomb-out rule. A client that
 *     reported an illegal card is refused rather than scored.
 *
 * PORTING IT IS A MOVE, NOT A REWRITE: the file is pure, has no React and no
 * I/O, and its only inputs are the proposal, the meet definition and the stored
 * record.
 *
 * ---------------------------------------------------------------------------
 * PURITY CONTRACT
 * ---------------------------------------------------------------------------
 *   - Zero React imports, zero I/O, zero side effects, no clock, no randomness.
 *   - The day is resolved by the caller and passed in, per GDD §4.1.
 *   - Every transition returns a new record; inputs are never mutated.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT MOVES, AND WHAT IT REFUSES TO MOVE
 * ---------------------------------------------------------------------------
 * MOVES:
 *   - `totalKg`, and this is the only function in the codebase that does. GDD
 *     §2: Total grows by "Meet results only — the sum of best successful
 *     attempt per lift (§6.4). It does not move between meets."
 *     MONOTONE: `ConfirmedFacts.totalKg` is the BEST competition total on
 *     record, so a worse meet cannot cost a lifter the number they already
 *     have, and a bomb-out cannot erase one. That is the same "never punish
 *     showing up" clause (GDD §12.3) that makes `bestE1rmKg` monotone in
 *     `sessionServer.ts`.
 *   - `meets`, which gains one `MeetResultWire` for this meet.
 *
 * REFUSES:
 *   - AN e1RM. `record.bestE1rmKg` is carried through UNTOUCHED and
 *     `meetServer.test.ts` asserts it across every meet it can build.
 *
 *     THIS IS A NARROWING OF WHAT THE REACH MAP PERMITS, AND IT IS DELIBERATE.
 *     `ProposalReach['record-meet-result']` is `'totalKg' | 'meets' |
 *     'bestE1rmKg' | 'wallet'`, so moving an e1RM here would type-check. The
 *     GDD does not ask for it: §2's table grows e1RM from "Sim mode training,
 *     session by session", and §6.4 gives a meet result a Total, a DOTS score,
 *     Career progression and Gym Empire reputation — not an e1RM. Widening
 *     that is a design decision with a real argument on both sides (a made
 *     third attempt IS a true single) and it is not this piece's to take
 *     quietly. If it is ever taken, it belongs in one place: here, with the
 *     chart-backwards estimate `e1rm.ts` already owns, and never as an
 *     incremental tick on a meet SCREEN.
 *   - THE STREAK. `record.streak` is carried through untouched. A meet is not a
 *     training session and `streak.ts`'s `recordTrainingDay` is
 *     `sessionServer.ts`'s to call. GDD §4.4's free grace covers the gap a meet
 *     day makes, so this does not cost a run — see the note on `applyMeetResult`
 *     for the open question that leaves.
 *   - THE WALLET. Carried through untouched. GDD §6.4's "result feeds ... Gym
 *     Empire (reputation)" is the Gym Empire piece's, and reputation is not a
 *     wallet currency.
 *   - ANYTHING BOUGHT. `applyMeetResult` takes a record, a day, a meet
 *     definition, a proposal and an id. It has no parameter for a purchase, an
 *     entitlement, a boost or a balance, so nothing purchasable can change what
 *     a meet is worth (GDD §8.1, §12.3).
 *   - ANY NUMBER WHOSE UNIT IT CANNOT PROVE. See THE UNIT below. This is the
 *     LAST place a unit exists on this path: `MeetResultWire` has no unit field
 *     for anything, so a pound number that gets past here is a bare number named
 *     `totalKg` or `bodyweightKg` forever, and `record.totalKg` is MONOTONE — a
 *     total banked in the wrong unit can never be walked back by a later honest
 *     meet, and it poisons `previousBestByLift`, every future `isTotalPr`, the
 *     placing and the DOTS numerator permanently.
 *
 * ---------------------------------------------------------------------------
 * THE UNIT — why the write path checks it, and why it refuses rather than
 * converts
 * ---------------------------------------------------------------------------
 * `meet.ts` runs a meet in EITHER unit and says so: `MeetLoadingRules.unit` is
 * required, `POUND_MEET_RULES` is exported and validates, and `MeetDefinition.
 * rules` takes whatever it is handed — so `replayMeetCard`'s `createMeet(meet.
 * rules)` will happily replay a pound meet through the front door, no cast
 * needed.
 *
 * `dots.ts` and `resultCard.ts` already refuse a reading that is not in
 * kilograms. Both of those are READ paths, and both run AFTER this function: by
 * the time `buildResultCard` says `UNSUPPORTED_MEET_UNIT`, the pound number is
 * already in `record.totalKg` and in `record.meets[n].totalKg`, and it has
 * already been ranked against `MeetDefinition.ghostTotalsKg` (a kg field). A
 * refusal that fires downstream of the write is not a defence of the write.
 *
 * NEITHER OF THEM WOULD HAVE FIRED ON THE BODYWEIGHT AT ALL. Both refuse on the
 * TOTAL's unit; the bodyweight reaches `evaluateMeetDots` and `weightClassString`
 * as a bare number, and a lifter entered at 203.7 lb sits inside
 * `DOTS_BODYWEIGHT_DOMAIN_KG` (40–210 male), so it would not have been clamped
 * either. The kilogram meet with the pound lifter is the case where every
 * downstream refusal in the tree stays silent, which is why the check has to be
 * on the number rather than on the meet.
 *
 * So the reading's unit is checked HERE, before `nextTotalKg` and before the
 * `MeetResultWire` is built, and `totalKg` is taken off the CHECKED reading
 * rather than from `finalMeetTotal(state)` — which is `readTotal(state).total`
 * with the unit thrown away. There is deliberately no expression left in this
 * file that produces a total without having looked at its unit first.
 *
 * WHY REFUSE RATHER THAN CONVERT, given `kilogramsFromPounds` exists and is
 * exact: the same reason `dots.ts` gives, and it is stronger here. A meet result
 * is TWO numbers in two independently-chosen units — the total, which arrives
 * from `meet.ts` with `meet.rules.unit` attached, and the bodyweight, which
 * arrives from the lifter's entry with its own. Converting one while trusting
 * the other replaces a 2.2x overstatement with a different wrong number, written
 * permanently, by a module that now claims to handle units. A caller running a
 * pound meet converts the whole entry at the call site — both numbers, with
 * `kilogramsFromPounds`, in one visible place — and records the converted meet.
 * Same posture as `e1rm.ts` past the RPE chart: refuse, and name the remedy.
 *
 * AND THE REMEDY IS NOW ENFORCED ON BOTH HALVES, which it was not. The paragraph
 * above shipped for a round while only the total was checked, and that made the
 * refusal's own advice into a trap: a caller who did exactly what it said —
 * converted the attempts, ran the meet under `DEFAULT_MEET_RULES`, and forgot
 * the bodyweight — passed the check cleanly and produced precisely the outcome
 * this header said it refused to create. `MeetResultReport.bodyweight` is a
 * `BodyweightReading` now (`dots.ts`), so that caller is refused too:
 * `UNSUPPORTED_MEET_UNIT`, before the replay, before anything is written.
 *
 * ---------------------------------------------------------------------------
 * THE MEET ARGUMENT — and why the total's check used to be worth less than it
 * looked
 * ---------------------------------------------------------------------------
 * `reading.unit` comes from `readTotal(state)`, `state` comes from
 * `createMeet(meet.rules)`, and `meet` is an argument the caller passes in BESIDE
 * the proposal. So for two rounds the sentence "the reading is the form of this
 * number that still knows its unit" was true of the reading and false of the
 * NINE NUMBERS THE READING IS COMPUTED FROM: the unit was a label taken off one
 * argument and used to vouch for the contents of another.
 *
 * That is not a hypothetical. This file's own positive control replays 405 / 425
 * / 442.5 / 265 / 275 / 280 / 500 / 525 / 545 as a legal KILOGRAM meet totalling
 * 1267.5 — nine pound-shaped numbers, every one of them a legal kilogram call,
 * because 2.5 lb and 2.5 kg are the same grid spacing. Essentially every legal
 * pound card is a legal kilogram card. A client playing in lb whose submission
 * reached a server that looked the definition up by `meetId` and found a
 * kilogram meet passed the bodyweight's check (kg, declared, true) and the
 * total's check (`meet.rules.unit === 'kg'`) and banked a 2.2x total, with no
 * cast and no typed lie anywhere.
 *
 * TWO CHECKS CLOSE IT, AND THEY ONLY WORK AS A PAIR:
 *
 *   - `meet.id === proposal.report.meetId`, so the definition supplying the unit
 *     is at least CLAIMING to be the meet being reported. Nothing tied the two
 *     arguments together before this; `report.meetId` went to the duplicate
 *     check and onto the wire, and the definition went to the replay.
 *   - `card.unit === meet.rules.unit`, in `replayMeetCard`, before a single
 *     attempt is declared. This one is STRICTLY STRONGER THAN THE BODYWEIGHT'S,
 *     because it compares the client's claim against SERVER-OWNED DATA rather
 *     than against a constant: the bodyweight's check asks "did you say kg?",
 *     this one asks "does what you say match what this meet is".
 *
 * `MeetResultReport.card` is a `MeetCardReport` — the same tagged-pair shape as
 * `BodyweightReading`, with `kilogramAttempts` and `poundAttempts` on the two
 * arms — so the nine numbers cannot be reached without narrowing on a unit. The
 * unit is at CARD grain rather than per attempt because a meet is run under one
 * `MeetLoadingRules` and `meet.ts` says so; the reasoning is written out on the
 * type.
 *
 * THE THREE CHECKS ARE NOT THE SAME KIND OF CHECK, and the differences are worth
 * a paragraph, because rounding them all up to "compile error" is how the last
 * two rounds of this defect survived.
 *
 *   - THE TOTAL'S is a runtime string comparison against a reading, and it has
 *     to be: `MeetTotalReading.unit` is typed `string` on purpose so an unknown
 *     unit fails safe.
 *   - THE BODYWEIGHT'S is a discriminated narrow, so the kilogram field does not
 *     exist until the check has run — delete the `if` and `tsc` fails at the
 *     `MeetResultWire` rather than a test going quiet.
 *   - THE CARD'S is a runtime comparison of two facts, and deleting it is a
 *     TEST failure, not a compile error. What IS a compile error is reaching the
 *     attempt weights at all without naming a unit: there is no field on
 *     `MeetCardReport` that yields attempts from both arms, exactly as there is
 *     no `value` on `BodyweightReading`. The shape forces the question to be
 *     asked; the check decides the answer.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT CANNOT CHECK, SAID PLAINLY
 * ---------------------------------------------------------------------------
 * (1) WHETHER THE LIGHTS WERE REAL. `MeetAttemptReport.good` is the client's
 * word, and `progression.ts` says so where the type is defined: "with a real
 * Edge Function the lights should be re-resolved server-side and this type gets
 * narrower. It is the client's word today because there is nobody else to ask."
 *
 * So this module re-derives the ARITHMETIC and the RULES and takes the client's
 * word for the VERDICT. That is a real gap and it is the one a leaderboard
 * would be cheated through; it closes when the rep itself is resolved
 * server-side, not by anything that could be written here.
 *
 * (2) WHETHER A DECLARED UNIT IS TRUE. This entry (2) USED TO SAY THE
 * BODYWEIGHT'S UNIT WAS UNCHECKABLE, "because no module produces it". That was
 * the open hole and it is closed: `MeetResultReport.bodyweight` is a
 * `BodyweightReading`, `meetTuning.ts`'s `MeetEntry` declares which unit the
 * lifter weighed in under, `meetDay.ts` forwards it rather than stamping one,
 * and `applyMeetResult` refuses the pound arm with the same
 * `UNSUPPORTED_MEET_UNIT` before the replay.
 *
 * WHAT IS LEFT IS SMALLER AND IS NOT THE SAME THING. A caller can still write
 * `{ unit: 'kg', kilograms: 203.7 }` over a number that came off a pound scale,
 * exactly as it can write `unit: 'kg'` on a hand-built `TotalReading`. That is a
 * lie somebody has to type, not a field that quietly means nothing, and nothing
 * in this file is tamper-resistance — see (1).
 *
 * (3) WHETHER THE ATTEMPT WEIGHTS ARE THE UNIT THEIR MEET CLAIMS — CLOSED, and
 * this entry has now been wrong in both directions, so it says exactly what the
 * mechanism is. It first claimed such a card was "refused as illegal (below the
 * bar, off the declaration grid)", which the positive control disproves. It then
 * claimed the case was unreachable because `meetDay.ts` reads the weights back
 * out of the played `MeetState` rather than authoring them — TRUE of today's
 * client, and an argument about the client made in the one module whose purpose
 * is not trusting the client. It is the same shape of argument (`dots.ts`: "no
 * game module produces it") that was found false one round earlier.
 *
 * What closes it is not an argument: the card declares its unit
 * (`MeetCardReport`), `applyMeetResult` binds the definition to the report
 * (`MEET_ID_MISMATCH`), and `replayMeetCard` refuses a card whose unit is not
 * the meet's (`UNSUPPORTED_MEET_UNIT`) before a single attempt is declared. See
 * THE MEET ARGUMENT above.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS PROVEN, AND WHAT IS STILL TAKEN ON TRUST — the whole write path, in
 * one place, because the last three rounds each found the next unproven field
 * beside the one just fixed
 * ---------------------------------------------------------------------------
 * EVERY NUMBER `MeetResultWire` CARRIES, and where its unit comes from:
 *
 *   - `totalKg` — PROVEN. `readTotal(state).unit === 'kg'`, where `state` is the
 *     replay of a card whose declared unit was checked against `meet.rules.unit`
 *     for a `meet` whose id was checked against the report's.
 *   - `bestByLift` — PROVEN, by the same chain. These are `state.lifts[l].best`,
 *     computed by the engine from the same checked card.
 *   - `bodyweightKg` — PROVEN. Declared at the source (`MeetEntry.bodyweight`),
 *     forwarded rather than stamped, tag AND payload checked here.
 *   - `meetDayIndex` — not a weight. Server-resolved (GDD §4.1).
 *
 * SO NO NUMBER REACHES PERMANENT PROGRESSION ON THIS PATH WITH AN UNPROVEN UNIT.
 * That is the claim. What is still taken on trust, named so the next reader does
 * not have to find it:
 *
 *   (a) THE `meet` ARGUMENT IS STILL SUPPLIED BY THE CALLER. The id check makes
 *       it claim to be the reported meet; nothing makes it BE the reported meet,
 *       because this function has no catalogue to look one up in. A caller can
 *       hand over a definition with a matching `id` and invented `rules`. This is
 *       (2)'s class — a lie somebody types — and it closes when the Edge Function
 *       resolves `meetId` against its own table instead of taking a definition as
 *       an argument. That is one signature change, and it is the single highest-
 *       value thing left on this path.
 *   (b) `MeetDefinition.ghostTotalsKg` IS A BARE `number[]` NAMED `Kg`. It does
 *       not reach permanent progression — `MeetResultWire` has no placing — but
 *       it is what `placingFor` compares a proven kilogram total against, so a
 *       definition with pound ghosts prints a wrong placing on a card. Today its
 *       only warrant is that it sits on a definition whose `rules.unit` this
 *       function has refused unless it says `kg`, which is precisely the strength
 *       the total's check used to have and no more. Named rather than fixed
 *       because ghosts are placeholder data that a backend replaces wholesale
 *       (GDD §6.6), and giving placeholder data a reading would be building the
 *       fence around the thing being thrown away.
 *   (c) `MeetDayAttempt.weightKg` — the meet-day LOOP's own row type, not this
 *       wire — is a bare number named `Kg`, and `AttemptView.tsx` prints it with
 *       a hardcoded "kg" suffix. On a pound meet that screen lies. It is a
 *       display defect rather than a progression one (nothing on that path is
 *       recorded except through the card, which is checked), and it is GDD §11's
 *       open pound-meet ruling: option (a) there deletes the case entirely.
 *   (d) THE LIGHTS. See (1). Unchanged and unrelated to units.
 */

import {
  LIFT_ORDER,
  createMeet,
  declareAttempt,
  isMeetComplete,
  readTotal,
  resolveAttempt,
  type JudgePanel,
  type LiftKind,
  type MeetState,
  type MeetWeightUnit,
} from './meet';
// `finalMeetTotal` is deliberately NOT imported. It is `readTotal(state).total`
// with the unit discarded, and this module must not hold a total that has
// forgotten what it is measured in — see THE UNIT in the header.
import { DOTS_TOTAL_UNIT } from './dots';
import { declaredRows } from './progression';
import type {
  MeetResultWire,
  ProgressionSnapshotWire,
  ProposalOfKind,
} from './progression';
import { snapshotWireFor, type ServerRecord } from './sessionServer';
import type { MeetDefinition } from './meetTuning';

// ---------------------------------------------------------------------------
// Replaying a reported card
// ---------------------------------------------------------------------------

/**
 * The lights the server replays an attempt with.
 *
 * Unanimous either way, on purpose: the panel is COSMETIC to the total. GDD
 * §6.4 scores a meet by the best successful attempt per lift and `meet.ts`
 * decides success by majority, so a 2-1 and a 3-0 produce the same number. The
 * report carries the decision (`good`), not the lights, and inventing a split
 * here would be inventing a fact rather than recomputing one.
 */
const REPLAY_GOOD: JudgePanel = ['white', 'white', 'white'];
const REPLAY_NO_LIFT: JudgePanel = ['red', 'red', 'red'];

/**
 * The one unit permanent progression stores a total in.
 *
 * `DOTS_TOTAL_UNIT` rather than a fresh `'kg'` literal, and the name is worth a
 * sentence because it says DOTS while the reason here is not DOTS.
 * `MeetResultWire.totalKg`, `ServerRecord.totalKg` and
 * `MeetDefinition.ghostTotalsKg` are kilogram fields by their names and by the
 * ghost numbers actually in them; DOTS is only the loudest of the things that
 * would go wrong. Reusing the constant means there is exactly ONE string in the
 * tree that a unit check compares against, spelled the way `meet.ts` spells it
 * and pinned to that spelling by `dots.test.ts` — a second literal here could
 * drift from `MeetWeightUnit` without anything noticing. `resultCard.ts` reuses
 * it the same way, for the same non-DOTS reasons.
 */
const PROGRESSION_TOTAL_UNIT = DOTS_TOTAL_UNIT;

/**
 * The one unit permanent progression stores a BODYWEIGHT in.
 *
 * The same string as `PROGRESSION_TOTAL_UNIT` and a separate name on purpose,
 * because they are two independent facts rather than one fact spelled twice —
 * OpenPowerlifting's checker says it in one sentence ("international meets often
 * do weigh-in in pounds, but lifting in kilos, so keep those separate") and
 * `dots.ts` quotes it. A ruling that converted one of these would not
 * automatically convert the other, and a single constant would hide that.
 *
 * Aliased off `DOTS_TOTAL_UNIT` for the reason above it: one string in the tree
 * that a unit check compares against.
 */
const PROGRESSION_BODYWEIGHT_UNIT = DOTS_TOTAL_UNIT;

/**
 * The other unit a meet can be run in, named so the refusals can talk about it.
 *
 * NOT a unit this module stores anything in — it is the arm of a reading that
 * gets refused, and it exists as a constant for the same reason
 * `PROGRESSION_TOTAL_UNIT` does: one spelling in the tree, bound to `meet.ts`'s
 * union by `satisfies` so a renamed unit is a compile error here rather than a
 * comparison that silently stops matching.
 *
 * `satisfies` rather than an annotation on purpose: an annotation would widen it
 * to `MeetWeightUnit` and stop it narrowing a tagged reading, which is the one
 * thing it is for.
 */
const POUND_UNIT = 'lb' satisfies MeetWeightUnit;

export type MeetServerErrorCode =
  /** The reported attempts are not a legal meet card. */
  | 'MEET_REPLAY_REFUSED'
  /** The replay ran out of attempts before the meet finished. */
  | 'MEET_INCOMPLETE'
  /** More attempts were reported than the meet had room for. */
  | 'MEET_OVERRUN'
  /** This lifter already has a result for this meet. */
  | 'MEET_ALREADY_RECORDED'
  /**
   * THE REPORT AND THE MEET DEFINITION ARE NOT ABOUT THE SAME MEET.
   *
   * The definition is what supplies the loading rules the card is replayed
   * against and the unit every check below is measured in, and it arrives as a
   * SEPARATE ARGUMENT from the report that names the meet. Until this code
   * existed nothing tied the two together: `proposal.report.meetId` was used for
   * the duplicate check and written onto the wire, while the replay, the unit
   * and the placing all ran against whatever `MeetDefinition` the caller
   * happened to pass. See THE MEET ARGUMENT in the header.
   */
  | 'MEET_ID_MISMATCH'
  /**
   * A UNIT-TAGGED READING WITH NO NUMBER UNDER ITS TAG.
   *
   * `{ "unit": "kg" }`, or `{ "unit": "kg", "pounds": 203.7 }`, or `{ "unit":
   * "kg", "poundAttempts": [...] }`. Each of these narrows perfectly — the tag
   * is one of the two `tsc` knows — and then the field the narrow entitles you
   * to read is `undefined`. This is NOT `UNSUPPORTED_MEET_UNIT`: the unit is
   * supported and correctly declared; there is simply nothing in the envelope,
   * and the remedy is to fix the sender rather than to convert an entry.
   *
   * IT IS A SEPARATE CODE FOR THAT REASON. `UNSUPPORTED_MEET_UNIT` names one
   * remedy ("convert the whole entry at the call site") and it is the wrong
   * advice here.
   *
   * REACHABLE ONLY FROM UNTYPED JSON OR A CAST, which is exactly the traffic
   * this module exists for. It shipped live on the bodyweight for a round: the
   * tag was checked and the payload was not, so `bodyweightKg: undefined` was
   * written into a `MeetResultWire` with `ok: true`.
   */
  | 'MALFORMED_READING'
  /**
   * A NUMBER WHOSE UNIT THIS RECORD CANNOT STORE. Two of them reach this
   * function and this one code covers both, because it is one refusal — this
   * entry is in the wrong unit for this pipeline:
   *
   *   - the TOTAL, when the meet was not run in kilograms; and
   *   - the BODYWEIGHT, when the lifter was not weighed in kilograms.
   *
   * ONE CODE RATHER THAN TWO, and the message says which number it was. Two
   * codes would suggest two problems with two remedies, and there is one of
   * each: convert the whole entry at the call site, or do not record it. It was
   * exactly the appearance of a per-number remedy that made the total-only
   * version of this check dangerous — a caller who converted the attempts and
   * left the bodyweight alone passed it.
   *
   * See THE UNIT in the header for why this refuses instead of converting.
   *
   * SPELLED THE SAME AS `ResultCardErrorCode['UNSUPPORTED_MEET_UNIT']` ON
   * PURPOSE. It is one refusal — this meet is in the wrong unit for this
   * pipeline — reached at two different points in it, and giving it two names
   * would make the write path's version look like a different problem.
   */
  | 'UNSUPPORTED_MEET_UNIT'
  /** The reported day is not one this record can move to. */
  | 'BAD_DAY';

export interface MeetServerError {
  readonly code: MeetServerErrorCode;
  readonly message: string;
}

export type MeetServerResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: MeetServerError };

/**
 * Rebuild a meet from the card a client reported.
 *
 * EVERY RULE OF THE SPORT IS APPLIED HERE, by `meet.ts`, because this is
 * `declareAttempt` and `resolveAttempt` and nothing else. A card whose attempts
 * go down in weight, repeat after a good lift, exceed three on a lift, arrive
 * out of order, or continue past a bomb-out is REFUSED — the engine returns the
 * refusal and this function passes it on with the attempt's coordinates
 * attached.
 *
 * The `lift` and `attemptNumber` guards on `declareAttempt` are what make "out
 * of order" refusable rather than silently reinterpreted: the engine rejects a
 * declaration whose coordinates are not the ones on deck.
 *
 * ---------------------------------------------------------------------------
 * AND THE UNIT IS CHECKED FIRST, BECAUSE THIS IS THE LINE WHERE THE NUMBERS MEET
 * THE RULES
 * ---------------------------------------------------------------------------
 * `createMeet(meet.rules)` decides what these numbers MEAN — the bar weight they
 * are added to, the grid they must land on, and the unit `readTotal` stamps on
 * the total that comes out the far end. Replaying a card against rules in a
 * different unit is not a conversion and not an approximation: it is reading
 * 442.5 lb as 442.5 kg, and it succeeds, because 2.5 lb calls and 2.5 kg calls
 * land on the same grid. Essentially every legal pound card is a legal kilogram
 * card, so nothing later in the pipeline can notice.
 *
 * THAT IS WHY THE CHECK IS HERE RATHER THAN ONLY IN `applyMeetResult`. Every
 * caller that replays gets it, including the tests that replay directly, and the
 * refusal names the two facts that disagree instead of naming a constant.
 *
 * THE ARM IS READ THROUGH THE NARROW. `MeetCardReport` has no field carrying
 * attempts that is reachable from both arms, so there is no expression anywhere
 * in this module that produces the nine numbers without having named a unit.
 * Deleting the equality check below leaves that property intact and is a test
 * failure rather than a compile error — said plainly, because the version of
 * this claim that rounded it up to "compile error" is what let the last two
 * rounds of this defect through.
 */
export function replayMeetCard(
  meet: MeetDefinition,
  // Widened by `| undefined` on purpose: a request body can simply not have
  // this field, and a server whose first act on a malformed body is to throw is
  // a server that has told the caller nothing. Typed code cannot pass one.
  card: ProposalOfKind<'record-meet-result'>['report']['card'] | undefined,
): MeetServerResult<MeetState> {
  if (card === undefined) {
    return {
      ok: false,
      error: {
        code: 'MALFORMED_READING',
        message: 'meetServer: this report carries no card, so there are no attempts to replay.',
      },
    };
  }
  if (card.unit !== meet.rules.unit) {
    return {
      ok: false,
      error: {
        code: 'UNSUPPORTED_MEET_UNIT',
        message:
          `meetServer: this card says its attempt weights are in ${JSON.stringify(card.unit)} and ` +
          `${JSON.stringify(meet.id)} is run in ${JSON.stringify(meet.rules.unit)}. Replaying it ` +
          'would read every weight on it as the other unit — which SUCCEEDS, because a 2.5 lb ' +
          'call and a 2.5 kg call land on the same declaration grid, so the replay, the total, ' +
          'the placing and the stored result would all be silently wrong by the conversion ' +
          'factor. This does NOT convert for you: run the meet under rules in the unit it was ' +
          'lifted in, or convert the whole entry at the call site with kilogramsFromPounds — ' +
          'the attempts AND the bodyweight — and record the converted meet.',
      },
    };
  }
  // THROUGH THE NARROW, NOT THROUGH A SHARED FIELD. The `undefined` arm is
  // unreachable in typed code and is where a unit off untyped JSON lands;
  // `declaredRows` is for a tag with nothing under it. Both are refused rather
  // than iterated, because `for (const x of undefined)` throws and a server that
  // throws on a malformed body has told the caller nothing.
  //
  // `declaredRows` RATHER THAN AN INLINE `Array.isArray` BOUND TO AN ANNOTATION.
  // `Array.isArray` narrows a READONLY array to `any[]`, and until this line was
  // a call the only thing putting the element type back was an annotation on the
  // `const` — deletable in a tidy-up, silently, past CLAUDE.md's `any` ban. The
  // repair now lives in the helper's RETURN TYPE, which `progression.ts` asserts
  // is not `any` (`A_DECLARED_ROW_IS_NEVER_ANY`).
  const declared =
    card.unit === PROGRESSION_TOTAL_UNIT
      ? card.kilogramAttempts
      : card.unit === POUND_UNIT
        ? card.poundAttempts
        : undefined;
  const attempts = declaredRows(declared);
  if (attempts === null) {
    return {
      ok: false,
      error: {
        code: 'MALFORMED_READING',
        message:
          `meetServer: this card declares ${JSON.stringify(card.unit)} and carries no list of ` +
          'attempts under that unit. A declared unit with nothing under it is not a card, and ' +
          'guessing which field was meant is how a pound list gets read as a kilogram one.',
      },
    };
  }
  let state = createMeet(meet.rules);
  for (const attempt of attempts) {
    if (isMeetComplete(state)) {
      return {
        ok: false,
        error: {
          code: 'MEET_OVERRUN',
          message:
            `meetServer: the meet was already over when attempt ${attempt.attemptNumber} ` +
            `on the ${attempt.lift} was reported.`,
        },
      };
    }
    const declared = declareAttempt(state, {
      lift: attempt.lift,
      attemptNumber: attempt.attemptNumber,
      weight: attempt.weight,
    });
    if (!declared.ok) {
      return {
        ok: false,
        error: {
          code: 'MEET_REPLAY_REFUSED',
          message:
            `meetServer: attempt ${attempt.attemptNumber} on the ${attempt.lift} ` +
            `at ${attempt.weight} is not a legal call — ${declared.error.message}`,
        },
      };
    }
    const resolved = resolveAttempt(declared.value, {
      lift: attempt.lift,
      attemptNumber: attempt.attemptNumber,
      lights: attempt.good ? REPLAY_GOOD : REPLAY_NO_LIFT,
    });
    if (!resolved.ok) {
      return {
        ok: false,
        error: {
          code: 'MEET_REPLAY_REFUSED',
          message:
            `meetServer: attempt ${attempt.attemptNumber} on the ${attempt.lift} ` +
            `could not be judged — ${resolved.error.message}`,
        },
      };
    }
    state = resolved.value;
  }
  if (!isMeetComplete(state)) {
    return {
      ok: false,
      error: {
        code: 'MEET_INCOMPLETE',
        message: 'meetServer: the reported attempts do not finish the meet, so there is no result to record.',
      },
    };
  }
  return { ok: true, value: state };
}

// ---------------------------------------------------------------------------
// Placing (GDD §6.5 "placing in field", §6.6 ghost data)
// ---------------------------------------------------------------------------

export interface MeetPlacing {
  /** 1-based. `null` for a lifter with no total — a bomb-out does not place. */
  readonly place: number | null;
  /** The ghosts plus this lifter. */
  readonly fieldSize: number;
}

/**
 * Where the lifter finished.
 *
 * A LIFTER WITH NO TOTAL DOES NOT PLACE, and this returns `null` rather than
 * last. `resultCard.ts` refuses outright to build a card that pairs a numeric
 * placing with a missing total (`PLACING_WITHOUT_TOTAL`), so a `0` or a
 * `fieldSize` here would be caught downstream — but it would be caught as a
 * crash rather than as the honest answer, and the honest answer is that a
 * bombed lifter is absent from the board.
 *
 * Ties: a lifter equal with a ghost places AHEAD of it. Real federations break
 * a tie on bodyweight and the lighter lifter wins; the ghosts carry no
 * bodyweight, so this is the convention rather than the rule, and it is stated
 * rather than hidden.
 */
export function placingFor(totalKg: number | null, ghostTotalsKg: readonly number[]): MeetPlacing {
  const fieldSize = ghostTotalsKg.length + 1;
  if (totalKg === null) return { place: null, fieldSize };
  let ahead = 0;
  for (const ghost of ghostTotalsKg) {
    if (ghost > totalKg) ahead += 1;
  }
  return { place: ahead + 1, fieldSize };
}

// ---------------------------------------------------------------------------
// The Edge Function itself
// ---------------------------------------------------------------------------

export interface AppliedMeetResult {
  readonly record: ServerRecord;
  readonly wire: ProgressionSnapshotWire;
  /** The meet as the engine replayed it. What the recap and the card read. */
  readonly meet: MeetState;
  /**
   * This meet's total, kg, or null on a bomb-out. NOT the best on record.
   *
   * The `Kg` is now load-bearing rather than aspirational: `applyMeetResult`
   * refuses a meet that is not run in kilograms AND a card that does not say it
   * was lifted in the unit that meet runs in, so there is no path by which an
   * `AppliedMeetResult` exists carrying a total in another unit.
   */
  readonly totalKg: number | null;
  /** The best on record BEFORE this meet, kg, or null. */
  readonly previousBestTotalKg: number | null;
  /** True when this meet raised the best total on record. */
  readonly isTotalPr: boolean;
  readonly bestByLiftKg: Readonly<Record<LiftKind, number | null>>;
  /** Per lift: true when this meet beat the best competition lift on record. */
  readonly liftPrs: Readonly<Record<LiftKind, boolean>>;
  readonly placing: MeetPlacing;
  readonly bombedLift: LiftKind | null;
}

/**
 * The best competition lift on record, per lift, from the meets already stored.
 *
 * COMPETITION bests, not e1RM. GDD §6.5's "PR call-outs" on a meet recap are
 * about the platform, and an e1RM PR is the daily loop's payoff (§3.2).
 */
export function previousBestByLift(record: ServerRecord): Readonly<Record<LiftKind, number | null>> {
  const out: Record<LiftKind, number | null> = { squat: null, bench: null, deadlift: null };
  for (const meet of record.meets) {
    for (const lift of LIFT_ORDER) {
      const best = meet.bestByLift[lift];
      if (best === null) continue;
      const held = out[lift];
      if (held === null || best > held) out[lift] = best;
    }
  }
  return out;
}

/**
 * Record a meet result. THE ONLY WAY A TOTAL MOVES.
 *
 * @param record the lifter's stored row.
 * @param day the streak day the SERVER resolved (GDD §4.1). Stored on the meet
 *   result so a recap can order a lifter's meets; it does NOT touch the streak.
 *
 * REFUSES, BEFORE ANYTHING IS WRITTEN — see THE UNIT and THE MEET ARGUMENT in
 * the header:
 *
 *   - a report whose `meetId` is not this definition's (`MEET_ID_MISMATCH`);
 *   - a card whose declared unit is not the unit this meet is run in, a meet not
 *     run in kilograms, and a lifter not weighed in kilograms
 *     (`UNSUPPORTED_MEET_UNIT` for all three — one code, one remedy);
 *   - a reading that declares a unit and carries no number under it
 *     (`MALFORMED_READING`), which is what arrives from a hand-written JSON body.
 *
 * A CALLER MUST HANDLE THIS LIKE ANY OTHER REFUSAL. `useMeetDay.ts` now KEEPS a
 * failed `applyMeetResult` (`MeetDayLoop.submissionError`) rather than dropping
 * it, and does not retry — a refusal here is a pure function of inputs that do
 * not change while the meet sits in recap, so retrying would recompute the same
 * answer forever. What it still does NOT do is SHOW it: there is no recap and no
 * explanation, which is the right thing for an impossible case and the wrong
 * thing for a player who just finished nine attempts. That is a UI question, not
 * this module's, it is GDD §11's open pound-meet ruling, and it is named here so
 * whoever adds the second meet definition finds it written down.
 *
 * AN OPEN QUESTION THIS LEAVES, stated rather than discovered later: a meet day
 * is not a trained day, so a player who competes instead of training does not
 * increment their streak. GDD §4.4's free grace absorbs a gap that short, so
 * today this costs nobody a run — but if meets ever become frequent enough that
 * it can, the answer is a design decision (does competing count as training?)
 * and belongs in §4, not in a quiet call to `recordTrainingDay` from here.
 */
export function applyMeetResult(
  record: ServerRecord,
  day: number,
  meet: MeetDefinition,
  proposal: ProposalOfKind<'record-meet-result'>,
  proposalId: string,
): MeetServerResult<AppliedMeetResult> {
  if (!Number.isSafeInteger(day)) {
    return { ok: false, error: { code: 'BAD_DAY', message: `meetServer: day ${day} is not a day index.` } };
  }
  if (record.meets.some((stored) => stored.meetId === proposal.report.meetId)) {
    return {
      ok: false,
      error: {
        code: 'MEET_ALREADY_RECORDED',
        message: `meetServer: this lifter already has a result for ${proposal.report.meetId}.`,
      },
    };
  }

  // THE MEET DEFINITION IS THE MEET BEING REPORTED. Checked FIRST of the three
  // unit-related checks, because it is what makes the other two mean anything.
  //
  // `meet` and `proposal` are two arguments and nothing used to tie them
  // together: the report's `meetId` went to the duplicate check above and onto
  // the wire below, while the loading rules, the unit those rules stamp on the
  // total, and the ghost field the placing is computed against all came off a
  // definition the caller supplied separately. So "this total is in kilograms"
  // rested on a label taken off an unchecked argument.
  //
  // WHAT THIS DOES NOT PROVE, said here rather than left to be found: that the
  // definition is the REAL one for that id. This function has no catalogue —
  // it is handed one definition — so a caller can still pass a `MeetDefinition`
  // whose `id` matches and whose `rules` are invented. That is the same class as
  // (2) in the header: a lie somebody has to type. It closes for good when the
  // Edge Function looks the meet up by `meetId` server-side instead of being
  // handed it, at which point this check becomes a lookup and cannot fail.
  if (meet.id !== proposal.report.meetId) {
    return {
      ok: false,
      error: {
        code: 'MEET_ID_MISMATCH',
        message:
          `meetServer: this report is for ${JSON.stringify(String(proposal.report.meetId))} and the ` +
          `meet definition supplied is ${JSON.stringify(meet.id)}. The definition is what the card ` +
          'is replayed against and what declares the unit every number here is checked in, so ' +
          'recording one meet’s card against another meet’s rules would score it under a ' +
          'declaration grid, a bar weight and a unit it was never lifted under.',
      },
    };
  }

  // THE BODYWEIGHT'S UNIT, CHECKED BEFORE THE REPLAY AND SO BEFORE ANY WRITE.
  //
  // Held in a `const` and narrowed here rather than read at the point of use, so
  // that the narrowing is what makes the use legal: `bodyweight.kilograms` does
  // not exist on the pound arm of `BodyweightReading`, so DELETING THIS CHECK IS
  // A COMPILE ERROR at the `MeetResultWire` below rather than a test that goes
  // quiet. That is the whole reason the two arms carry different field names.
  //
  // BEFORE THE REPLAY, unlike the total's check, which cannot run until the
  // engine has produced a reading. This one needs nothing from the card, so a
  // caller wired to a pound scale finds out on every meet it submits — including
  // the ones whose card was also illegal, which are exactly the submissions a
  // check placed later would report as a different problem.
  //
  // WHAT WAS HERE BEFORE WAS NOTHING. `bodyweightKg` was a bare `number` written
  // straight into `MeetResultWire` three lines under the total's refusal, and
  // 203.7 lb is inside `DOTS_BODYWEIGHT_DOMAIN_KG` (40–210 male), so it clamped
  // nowhere, refused nowhere and was flagged by nothing — it was simply a lifter
  // who now weighs 203.7 kg, forever. The refusal below names the remedy the
  // total's refusal already named; the difference is that the remedy is now
  // enforced on both halves of it instead of on the half that was checkable.
  //
  // THE TAG IS NOT THE WHOLE CHECK, and for a round it was the whole check. A
  // body of `{"unit":"kg"}` — or `{"unit":"kg","pounds":203.7}`, which is what a
  // client that got the arm wrong actually sends — passed this `if`, narrowed
  // cleanly, and wrote `bodyweightKg: undefined` into `MeetResultWire` with
  // `ok: true`. `progression.ts`'s decoder contained the damage in-tree, but
  // that is the CLIENT catching what the server let through, which is the wrong
  // way round for the one module whose purpose is not trusting the client. The
  // payload is checked below on its own line and refused as `MALFORMED_READING`,
  // which is a different problem from a wrong unit and gets a different name.
  const bodyweight = proposal.report.bodyweight;
  if (bodyweight.unit === PROGRESSION_BODYWEIGHT_UNIT && !Number.isFinite(bodyweight.kilograms)) {
    return {
      ok: false,
      error: {
        code: 'MALFORMED_READING',
        message:
          `meetServer: this bodyweight declares ${PROGRESSION_BODYWEIGHT_UNIT} and carries no ` +
          'number under that unit — BodyweightReading’s kilogram arm holds it in `kilograms`, and ' +
          'reading `undefined` off a correctly tagged envelope would write a bodyweight-shaped ' +
          'hole into a permanent meet result. Send the number under the field its unit names.',
      },
    };
  }
  if (bodyweight.unit !== PROGRESSION_BODYWEIGHT_UNIT) {
    return {
      ok: false,
      error: {
        code: 'UNSUPPORTED_MEET_UNIT',
        message:
          `meetServer: this lifter was weighed in ${JSON.stringify(bodyweight.unit)}, and a ` +
          `recorded bodyweight is a ${PROGRESSION_BODYWEIGHT_UNIT} number — MeetResultWire.` +
          'bodyweightKg and ConfirmedMeetResult.bodyweightKg are kilogram fields with nowhere to ' +
          'put a unit, and the result card reads the stored number as kilograms twice over (the ' +
          'DOTS denominator and the weight class). Writing this would store a plausible number ' +
          'that is wrong by the conversion factor, permanently and unrecoverably: 203.7 lb is ' +
          'inside the published DOTS bodyweight domain, so nothing downstream would clamp it, ' +
          'refuse it or mark it. This does NOT convert for you — the total and the bodyweight ' +
          'are separate facts in separate units and converting one while trusting the other is a ' +
          'different wrong number. Convert the whole entry at the call site with ' +
          'kilogramsFromPounds and record the converted meet.',
      },
    };
  }

  // REPLAYED FROM THE CARD, NOT FROM A BARE ARRAY. `replayMeetCard` refuses a
  // card whose declared unit is not the unit `meet.rules` runs in — the check
  // that makes the reading's unit below a fact about THESE NINE NUMBERS rather
  // than a label the definition stamped on whatever it was handed.
  const replayed = replayMeetCard(meet, proposal.report.card);
  if (!replayed.ok) return replayed;
  const state = replayed.value;

  // GDD §6.4's total, computed by the engine from the engine's own card.
  const reading = readTotal(state);

  // THE UNIT, CHECKED BEFORE ANYTHING IS WRITTEN. Everything below this line
  // treats `reading.total` as kilograms — `nextTotalKg`, `MeetResultWire.
  // totalKg`, and `placingFor` against a kg ghost field — and this is the last
  // point at which the unit still exists to be checked: `MeetResultWire` has no
  // field to carry it. Checked on the READING, which is the form of this number
  // that still knows, rather than on `meet.rules`, so the thing checked is the
  // thing written. Checked on every kind, including the two with no total, for
  // the reason `dots.ts` gives: a defect that only fires on a meet that finished
  // with a total is the worst kind to ship.
  if (reading.unit !== PROGRESSION_TOTAL_UNIT) {
    return {
      ok: false,
      error: {
        code: 'UNSUPPORTED_MEET_UNIT',
        message:
          `meetServer: this meet was run in ${JSON.stringify(reading.unit)}, and a recorded ` +
          `total is a ${PROGRESSION_TOTAL_UNIT} number — record.totalKg, MeetResultWire.totalKg ` +
          'and the meet’s ghost field are all kilogram fields, and none of them has anywhere to ' +
          'put a unit. Writing this would store a plausible number that is wrong by the ' +
          'conversion factor, permanently and unrecoverably, and every read downstream ' +
          '(dots.ts, resultCard.ts) would refuse it too late to help. This does NOT convert for ' +
          'you: a meet result is the total AND the bodyweight, and the bodyweight arrives here ' +
          'as a bare number this module cannot verify, so converting one while trusting the ' +
          'other is a different wrong number rather than a fix. Convert the whole entry at the ' +
          'call site with kilogramsFromPounds and record the converted meet.',
      },
    };
  }

  // Taken off the CHECKED reading. `null` on a bomb-out — and it is `null` there
  // rather than provisional, because `TotalReading.total` is a number only in
  // the 'final' case and `totalOnTheBoard` is a different field this never
  // reaches for.
  const totalKg = reading.total;
  const bombedLift = reading.kind === 'no-total' ? reading.bombedLift : null;

  const bestByLiftKg: Record<LiftKind, number | null> = {
    squat: state.lifts.squat.best,
    bench: state.lifts.bench.best,
    deadlift: state.lifts.deadlift.best,
  };

  const previousBestTotalKg = record.totalKg;
  const isTotalPr = totalKg !== null && (previousBestTotalKg === null || totalKg > previousBestTotalKg);
  // MONOTONE. A bomb-out cannot erase a total already on record and a worse
  // meet cannot lower one (GDD §12.3: never punish showing up).
  const nextTotalKg = isTotalPr ? totalKg : previousBestTotalKg;

  const heldByLift = previousBestByLift(record);
  const liftPrs: Record<LiftKind, boolean> = { squat: false, bench: false, deadlift: false };
  for (const lift of LIFT_ORDER) {
    const made = bestByLiftKg[lift];
    const held = heldByLift[lift];
    liftPrs[lift] = made !== null && (held === null || made > held);
  }

  const meetWire: MeetResultWire = {
    // Provably `meet.id` as well, since `MEET_ID_MISMATCH` ran. Taken off the
    // report because the report is what the duplicate check above read, and one
    // id in two places that could differ is the shape this round removed.
    meetId: proposal.report.meetId,
    meetDayIndex: day,
    // A bomb-out is null here, not zero. `progression.ts`'s decoder says so in
    // as many words and refuses a zero that means "no total".
    totalKg,
    bestByLift: bestByLiftKg,
    // OFF THE CHECKED READING, exactly as `totalKg` is. `proposal.report.
    // bodyweight` is still in scope and still a union; this reads the kilogram
    // arm, which only exists because the refusal above ran. There is
    // deliberately no expression left in this file that produces a bodyweight
    // without having looked at its unit first — AND, since `MALFORMED_READING`,
    // without having looked at whether there is a number under that unit.
    bodyweightKg: bodyweight.kilograms,
  };

  const next: ServerRecord = {
    revision: record.revision + 1,
    totalKg: nextTotalKg,
    // CARRIED THROUGH UNTOUCHED. A meet has no route to an e1RM — see the
    // header for why that is a narrowing of the reach map rather than an
    // omission.
    bestE1rmKg: record.bestE1rmKg,
    // CARRIED THROUGH UNTOUCHED. A meet is not a training day.
    streak: record.streak,
    meets: [...record.meets, meetWire],
    // CARRIED THROUGH UNTOUCHED. Nothing here pays out or charges anything.
    wallet: record.wallet,
    // CARRIED THROUGH UNTOUCHED. The hidden ledger is the daily loop's.
    fatigue: record.fatigue,
  };

  return {
    ok: true,
    value: {
      record: next,
      wire: snapshotWireFor(next, proposalId),
      meet: state,
      totalKg,
      previousBestTotalKg,
      isTotalPr,
      bestByLiftKg,
      liftPrs,
      placing: placingFor(totalKg, meet.ghostTotalsKg),
      bombedLift,
    },
  };
}

// ---------------------------------------------------------------------------
// Reads the client needs before it can open a meet
// ---------------------------------------------------------------------------

/**
 * What the lifter brings to the platform, so the client can build a meet.
 *
 * `bestE1rmKg` is what GDD §6.1's suggested opener is computed from, and it is
 * the only thing a meet reads out of the training half of the game.
 */
export interface MeetDayFacts {
  readonly day: number;
  readonly bestE1rmKg: Readonly<Record<LiftKind, number>>;
  readonly previousBestTotalKg: number | null;
  readonly previousBestByLiftKg: Readonly<Record<LiftKind, number | null>>;
}

/**
 * @param fallbackE1rmKg what to prescribe from for a lift with no e1RM on
 * record yet. The caller supplies it (`SESSION_TUNING.STARTING_E1RM_KG` is the
 * onboarding placeholder `sessionServer.ts` already uses) rather than this
 * module inventing a number.
 */
export function meetDayFacts(
  record: ServerRecord,
  day: number,
  fallbackE1rmKg: Readonly<Record<LiftKind, number>>,
): MeetDayFacts {
  const bestE1rmKg: Record<LiftKind, number> = { squat: 0, bench: 0, deadlift: 0 };
  for (const lift of LIFT_ORDER) {
    bestE1rmKg[lift] = record.bestE1rmKg[lift] ?? fallbackE1rmKg[lift];
  }
  return {
    day,
    bestE1rmKg,
    previousBestTotalKg: record.totalKg,
    previousBestByLiftKg: previousBestByLift(record),
  };
}
