/**
 * meet.ts — Meet-day engine.
 *
 * A pure, deterministic state machine for one lifter's meet (GDD §6).
 *
 * PURITY CONTRACT (CLAUDE.md "Pure logic is separate from UI"):
 *   - Zero React imports, zero I/O, zero side effects.
 *   - No clock reads and no randomness. Judging is an *input*: the caller hands
 *     the engine the three lights that came up. Whatever decides those lights
 *     (the Arcade bar-path mechanic, a seeded NPC sim, a replay) lives outside
 *     this module so the engine stays replayable and testable.
 *   - Every transition returns a new state; inputs are never mutated, and every
 *     array or object the caller hands in is COPIED before it is stored, so a
 *     caller mutating its own object afterwards cannot reach into meet state.
 *
 * SPORT RULES MODELLED (CLAUDE.md "Domain Correctness", GDD §6.2/§6.4):
 *   - Lift order is squat -> bench -> deadlift, three attempts each.
 *   - A lift is judged by three referees; a majority (2 of 3 white) is a good
 *     lift.
 *   - Total = sum of the best *successful* attempt in each of the three lifts.
 *   - Bombing out (no successful attempt on a lift) means NO TOTAL, and per
 *     GDD §6.3 it ends the meet.
 *   - Within a lift the bar weight never decreases (see the conflict note
 *     below). After a good lift it must go UP by at least the federation's
 *     minimum increase; after a no-lift it may be repeated exactly.
 *   - An attempt weight has to clear TWO separate gates, which are two
 *     different kinds of thing and are never collapsed into one number:
 *       (1) PHYSICS — the bar floor. Nothing lighter than the bar and collars
 *           can be on the platform. `MeetLoadingRules.barAndCollarsWeight`,
 *           default 25. `WEIGHT_BELOW_BAR`.
 *       (2) RULE — the declaration grid. Which numbers a lifter is allowed to
 *           call at all, measured from zero.
 *           `MeetLoadingRules.declarationIncrement`, default 2.5.
 *           `WEIGHT_NOT_DECLARABLE`.
 *     These were ONE field in the first version of this module, which made every
 *     refusal of e.g. 201 kg claim the bar could not be loaded to it. That was
 *     false: an IPF-standard plate set loads 201 kg without difficulty. 201 is
 *     refused because it is not a legal declaration.
 *
 *     A third gate sat between them in the second version — a "plate grid", one
 *     `loadableIncrement` that the load above the bar had to be a whole number
 *     of. IT HAS BEEN REMOVED. It told the same class of lie in the opposite
 *     direction; see WHY THERE IS NO PLATE GATE, below. The bar floor is the
 *     only statement about equipment this engine still makes, and it is the only
 *     one it can make truthfully without a plate inventory it does not have.
 *
 * ---------------------------------------------------------------------------
 * SOURCING — WHAT IS CITED HERE AND WHAT IS NOT
 * ---------------------------------------------------------------------------
 * No primary federation rulebook was reachable from the environment this module
 * was written in — the IPF, USAPL and USPA sites refuse the request as a matter
 * of egress policy. Nothing below is presented as a quotation of a rulebook,
 * and no number here should be read as "the IPF says so".
 *
 * What WAS actually retrieved, and re-verified byte-for-byte on 2026-07-31, is
 * OpenLifter, the open-source meet software published by the OpenPowerlifting
 * project and used to run real competitions —
 * https://gitlab.com/openpowerlifting/openlifter (HTTP 200 on the raw endpoint
 * for both files below):
 *
 *   - `src/reducers/meetReducer.ts`:
 *       `const defaultBarAndCollarsWeightKg = 25; // Assuming metal 2.5kg collars.`
 *       `const defaultBarAndCollarsWeightLbs = 45; // Assuming plastic collars.`
 *       ...with `squatBarAndCollarsWeightKg`, `benchBarAndCollarsWeightKg` and
 *       `deadliftBarAndCollarsWeightKg` all defaulting to it. That is the source
 *       of MIN_LOADABLE_WEIGHT_KG and of the decision to make the bar weight
 *       per-lift and federation-configurable.
 *
 *       Its two default plate arrays, quoted here because they are what killed
 *       the plate gate:
 *         `// Default kg plates, allowing for increments of 0.5kg.`
 *         `defaultPlatesKg` — pairCount 8 of 25; pairCount 1 of each of 20, 15,
 *         10, 5, 2.5, 1.25, 1, 0.75, 0.5 and 0.25; pairCount 0 of 50, 2 and 1.5.
 *         `// Default lbs plates, allowing for increments of 1lb.`
 *         `defaultPlatesLbs` — pairCount 8 of 45; pairCount 2 of 10; pairCount 2
 *         of 0.5; pairCount 1 of each of 25, 5, 2.5 and 1.25; pairCount 0 of
 *         100, 55 and 35.
 *
 *   - `src/components/lifting/AttemptInput.tsx` (`validate()`): a weight lower
 *     than a previous attempt is an ERROR ("Disallow this weight if it's a
 *     decrease from a previous attempt"); repeating a weight already lifted
 *     successfully is an ERROR; and the last check before returning is
 *     `if (asNumber % 2.5 !== 0) return "warning";` — a WARNING, not an error,
 *     applied to the DECLARED NUMBER measured from zero, not from the bar. It
 *     carries no "record attempt" flag at all.
 *
 * WHAT THAT DOES AND DOES NOT SUPPORT:
 *   - CITED: 25 kg / 45 lb of bar and collars, per lift, configurable.
 *   - CITED: real meet software treats a declaration that is not a multiple of
 *     2.5 as anomalous — but flags it rather than refusing it, and measures the
 *     multiple from zero. `DECLARATION_INCREMENT_KG` is anchored at zero for
 *     that reason. Note that the modulo is applied to `asNumber`, the number as
 *     DISPLAYED, not to a kg value: at a pound meet the 2.5 grid is 2.5 lb, not
 *     2.5 kg. That is what makes this module unit-agnostic rather than metric
 *     with a conversion layer, and it is why `POUND_MEET_RULES` exists.
 *   - NOT SUPPORTED, and this is the correction that removed the plate gate:
 *     that a real kit's loadable weights are the multiples of its smallest pair.
 *     `defaultPlatesLbs` above stocks 0.5, 1.25 and 2.5 lb discs at once, so its
 *     smallest pair step is 1 lb but 2.5 lb steps are equally loadable, and
 *     3 lb — a multiple of 1 — is NOT loadable at all (there are only two 0.5 lb
 *     pairs). Neither 1 nor 2.5 generates that set. See WHY THERE IS NO PLATE
 *     GATE below.
 *   - UNCITED: that any federation's rulebook *requires* declarations to be
 *     multiples of 2.5 kg. OpenLifter's warning is consistent with it but does
 *     not establish it, and OpenLifter is meet-director tooling that has to
 *     accept record attempts, unit conversions and data corrections, so its
 *     permissiveness is a UI posture rather than a claim about the rules.
 *   - UNCITED: the 2.5 kg minimum increase between attempts. Project review
 *     adjudicated it in this engine's favour on the reasoning that the IPF's
 *     automatic-increment provision (a lifter who submits nothing inside the
 *     one-minute allowance is granted +2.5 kg) only makes sense if 2.5 kg is
 *     the standard progression. That reasoning was NOT verifiable here against
 *     a primary rulebook and is recorded as an adjudication, not a citation.
 *   - UNCITED: which discs any particular federation certifies for competition.
 *     Equipment-approval lists live on federation sites, which are unreachable.
 *
 * OpenLifter is in any case a secondary source — one project's reading of the
 * rules, not the rules. Every value below is a tunable federation setting on
 * `MeetLoadingRules`, not a verified rulebook constant.
 *
 * ---------------------------------------------------------------------------
 * WHY THERE IS NO PLATE GATE — REMOVED FEATURE, `loadableIncrement`
 * ---------------------------------------------------------------------------
 * The second version of this module carried a third gate: `loadableIncrement`,
 * one number, with loadable weights modelled as
 *
 *     bar + k x loadableIncrement,  k a non-negative integer
 *
 * i.e. the lattice generated by the smallest plate pair. That is only sound when
 * every disc in the kit is a whole multiple of the smallest disc, and REAL KITS
 * ARE NOT LIKE THAT — including the one in the file cited above.
 *
 * Take `defaultPlatesLbs` on its own 45 lb bar. Pair steps available (twice each
 * disc, times its pairCount): 90 x8, 50, 20 x2, 10, 5, 2.5, 1 x2.
 *   - 47.5 lb is loadable: one 1.25 lb disc per side. The old model computed
 *     47.5 - 45 = 2.5, found it off the 1 lb grid, and answered "there is no way
 *     to load 47.5". That is the module's own headline bug — "telling a player
 *     that 201 kg cannot be loaded is a false statement about the equipment" —
 *     reintroduced in another unit.
 *   - 48 lb is NOT loadable: 3 lb above the bar needs three 0.5 lb pairs and the
 *     kit holds two. A lattice on 1 lb says it is fine. So the model was wrong
 *     in BOTH directions at once, on the very kit it cited.
 *   - The blast radius reached configuration: `validateMeetRules` rejected the
 *     faithful pound set (bar 45, plate step 1, declaration step 2.5) as
 *     INVALID_MEET_RULES, because 2.5 is not a whole number of 1s. The engine
 *     could not be configured to run a pound meet as its own source describes
 *     one.
 *
 * The honest fix is one of two things, and this module takes the second.
 *
 *   (a) Model the reachable set from the actual denominations and pair counts.
 *       Correct, and genuinely a subset-sum over the inventory — not a grid, not
 *       a semigroup either, because the counts are finite. It needs a plate
 *       inventory type, a reachability search, and a rounding search that can
 *       fail. That is a plate-math module. It is not attempt validation, and
 *       plate inventory is already a declared non-goal here.
 *   (b) STOP CLAIMING TO KNOW. An engine with no inventory cannot say what the
 *       plates can make, so it no longer says anything about them.
 *
 * WHAT THE ENGINE NO LONGER CLAIMS TO KNOW, said plainly: given a weight at or
 * above the bar, THIS MODULE HAS NO OPINION ON WHETHER THE PLATES CAN MAKE IT.
 * It does not know the denominations, it does not know how many pairs of each
 * the meet owns, and it will not guess. `WEIGHT_NOT_LOADABLE` is gone; no error
 * it can return is a claim about discs; no message it can return contains the
 * words "cannot be loaded". A bar-load display, a plate rack, or a loading crew
 * screen must compute from a real inventory, which lives outside this module —
 * it must NOT read a rule field off `MeetLoadingRules` and treat it as a grid,
 * because that is exactly the wrong answer this section exists to delete.
 *
 * What survives is the one physical fact the engine does hold: the bar and
 * collars weigh what the meet says they weigh, and nothing lighter can be on the
 * platform. That gate stays.
 *
 * Note what this did NOT cost, for the rule sets the old code accepted. It
 * required the declaration grid to be a whole number of plate steps and the bar
 * to sit on the plate grid; under those two conditions "on the declaration grid
 * and at or above the bar" already implied "on the plate grid", so the set of
 * weights `declareAttempt` accepts is UNCHANGED for every configuration that
 * used to be valid. What changed is that refusals now name a true reason, and
 * that configurations the old code wrongly rejected now run.
 * ---------------------------------------------------------------------------
 *
 * ---------------------------------------------------------------------------
 * DESIGN CONFLICT — NEEDS A HUMAN DECISION. NOT RESOLVED HERE.
 * ---------------------------------------------------------------------------
 * CLAUDE.md ("Domain Correctness") says: "attempts may not go down in weight
 * within a lift."
 *
 * GDD §6.3 ("Attempt Selection — The Real Tension") says: after a miss the
 * player chooses between "repeat the weight (use the last attempt)" vs "drop
 * down (guaranteed banked total, no PR)."
 *
 * These contradict each other. Real-sport rules side with CLAUDE.md: within a
 * lift a lifter's bar weight may be repeated after a miss but never lowered.
 * This engine therefore enforces the NON-DECREASING rule as a hard invariant
 * (`WEIGHT_DECREASED`), which is why `AttemptStrategy` has no "drop down"
 * option.
 *
 * The GDD is the authoritative document, so this is flagged rather than
 * silently reworded. A human must pick one of:
 *   (a) Reword GDD §6.3's post-miss choice to the real-sport pair —
 *       "repeat the weight" vs "take a smaller jump on the next attempt" —
 *       which preserves the intended tension (bank the total vs chase the PR)
 *       without breaking the rules of the sport; or
 *   (b) Keep a literal "drop down" as a deliberate arcade divergence, in which
 *       case this invariant must be relaxed here and real lifters will notice.
 * Do not resolve this by editing code alone; docs/GDD.md and the engine must
 * end up agreeing.
 * ---------------------------------------------------------------------------
 *
 * ---------------------------------------------------------------------------
 * REMOVED FEATURE — `recordAttempt`. Read before re-adding it.
 * ---------------------------------------------------------------------------
 * An earlier version of this module took a per-attempt `recordAttempt` boolean
 * that dropped BOTH the declaration granularity and the minimum increase to
 * 0.5 kg, measured from the lifter's own previous attempt. Nothing validated
 * the flag, so its only effect was to switch two invariants off on request:
 * `declare 200 good` then `declare 201 recordAttempt: true` was accepted, and
 * 201 went into the total.
 *
 * It has been removed rather than repaired, for two reasons:
 *
 *   1. The rule it claimed to implement is anchored to the wrong thing. Review
 *      reports that the fine discs exist so a lifter can call a weight above a
 *      STANDING RECORD, not above whatever they personally just lifted. That
 *      correction could not be confirmed here against a primary rulebook (see
 *      the sourcing note) — so this module does not assert the corrected rule
 *      either. It stops implementing a rule it cannot state truthfully. For
 *      what it is worth, the retrieved meet software (OpenLifter) carries no
 *      per-attempt record flag at all.
 *   2. Even with the anchor corrected, this engine cannot check it. A record
 *      attempt's legality depends on a standing record in a specific
 *      federation, division, weight class and age group. This module holds one
 *      lifter's card and none of that context, and the GDD does not model
 *      records anywhere (§6.4 scores a meet by Total and DOTS; §6.5's "PR
 *      call-outs" are the player's own bests, computed elsewhere). Taking a
 *      caller-supplied `recordToBeat` would move the fabrication up one level,
 *      not remove it.
 *
 * Federation records are therefore an explicit NON-GOAL (below). A federation
 * that really does let attempts be called on the half-kilo says so once, for
 * the whole meet, in `MeetLoadingRules.declarationIncrement`. It is never a
 * per-attempt claim, and nothing a caller passes to `declareAttempt` can loosen
 * a rule.
 * ---------------------------------------------------------------------------
 *
 * ---------------------------------------------------------------------------
 * WHY THE RULES CARRY A SEAL — AND EXACTLY WHAT IT IS WORTH
 * ---------------------------------------------------------------------------
 * `MeetLoadingRules` is fixed for the whole meet at `createMeet`. That used to
 * be prose rather than an invariant: `MeetState` is a transparent object, so
 *
 *     declareAttempt(
 *       { ...state, rules: { ...state.rules, declarationIncrement: 0.5 } },
 *       { weight: 200.5 },
 *     )
 *
 * type-checked in strict mode with no cast and was accepted. The per-attempt
 * escape hatch had not disappeared; it had moved up one level.
 *
 * `SealedMeetRules` closes that. `createMeet` folds the rule values into a
 * `seal`, and every entry point that lets a rule decide an outcome
 * (`declareAttempt`, `suggestNextAttempt`) recomputes it and refuses on a
 * mismatch with `MEET_RULES_TAMPERED`. The spread above still type-checks — a
 * spread copies the old seal verbatim, and no type can stop that — but it is
 * now REJECTED at runtime, which is the property the prose was claiming.
 *
 * What the seal is NOT: it is not a security boundary and is not claimed to be
 * one. The fold is plain arithmetic, right here in the source, over a handful
 * of numbers; a caller determined to forge a seal can reimplement it in a
 * dozen lines. `sealMeetRules` is deliberately not exported so that forging is
 * a deliberate act rather than an accident, and that is the whole claim: the
 * ORDINARY mutation — the one that type-checks and looks innocent in a diff —
 * does not work. Real tamper-resistance belongs on the server, per CLAUDE.md
 * "Server-authoritative progression"; this is the client-side half.
 *
 * `currentAttemptContext` deliberately does NOT check the seal: it is a
 * read-model that cannot fail, and callers use it to render. Hand it tampered
 * rules and it will report the numbers those rules imply — but nothing it
 * returns can get past `declareAttempt`, which does check.
 * ---------------------------------------------------------------------------
 *
 * DELIBERATE NON-GOALS (so their absence is not mistaken for an error):
 *   - Federation, national or world RECORDS of any kind: no record table, no
 *     record-attempt validation, no record call-outs. See the note above.
 *   - Multi-lifter flights, attempt (bar-loading) order within a flight, and
 *     live placing — GDD §6.6. This engine is one lifter's card.
 *   - Attempt-card changes at the scoring table (feds allow a limited number of
 *     weight changes on a declared attempt). The UI should collect the final
 *     declaration before calling `declareAttempt`.
 *   - Out-of-competition fourth attempts: they do not affect the total and are
 *     not modelled.
 *   - Plate math of any kind: denominations, pair counts, which discs go on the
 *     bar and in what order. Not modelled, not approximated, not guessed. See
 *     WHY THERE IS NO PLATE GATE above.
 *   - Timing of the one-minute clock: this module holds no clock (see purity).
 *   - DOTS/Wilks scoring and e1RM live in their own modules and are not
 *     imported here.
 *
 * WHERE THE REMAINING GATES ARE WRONG — BOTH DIRECTIONS. The engine decides one
 * question, "may this number be called at this point in this meet", with a bar
 * floor and a uniform declaration grid. Both ways that can disagree with a real
 * meet are listed here so neither reads as an oversight:
 *
 *   OVER-PERMISSIVE (accepts what a real meet would not):
 *   - It will accept, and `suggestNextAttempt` will suggest, a weight the meet's
 *     actual plate kit cannot make. With no inventory there is no other option.
 *     For the two retrieved kits this costs nothing until the bar runs out of
 *     plates: enumerating the subset sums of `defaultPlatesKg` gives every
 *     multiple of 2.5 kg from 25 up to its 537.5 kg capacity, and
 *     `defaultPlatesLbs` gives every multiple of 2.5 lb from 45 up to 872.5 of
 *     its 874.5 lb capacity, with no gaps in either. Past capacity, and on any
 *     sparse kit, it breaks at once: with only 45 lb discs on hand the engine
 *     still accepts 47.5.
 *   - It has no view of attempt-card change limits, of the clock, or of anything
 *     else that makes a declaration late rather than illegal.
 *
 *   UNDER-PERMISSIVE (refuses what a real meet would allow):
 *   - The declaration grid is ONE uniform step anchored at zero, for the whole
 *     meet. A federation whose real rule is not that shape — finer steps for a
 *     record attempt, a different step in the final round, or steps measured
 *     from the bar rather than from zero — has calls refused here that it would
 *     allow. Records are their own non-goal above; for the rest, set
 *     `declarationIncrement` to the finest step the meet ever permits and accept
 *     the over-permissiveness instead.
 *   - `minIncrement` is likewise one number for the whole meet, so a federation
 *     with a smaller required jump on the third attempt loses that.
 *   - When the bar and collars do not themselves sit on the declaration grid,
 *     the lightest legal call is heavier than the empty bar (`minimumAttemptWeight`).
 *     That is the grid rule, not a claim that the bar cannot be put on the rack.
 */

// ---------------------------------------------------------------------------
// Tunable constants
//
// CLAUDE.md "Game Feel Values Must Be Tunable": every number that gets tuned by
// hand lives here as a named export, never inline at a call site.
//
// Weights are unit-agnostic numbers. The defaults below are kg values matching
// the metric defaults in the retrieved OpenLifter source (GDD §11 leaves the
// display-unit default open); an lb-based federation swaps in its own
// `MeetLoadingRules` — OpenLifter's lb default for the same field is 45.
// ---------------------------------------------------------------------------

/** Three attempts per lift. Structural rule of the sport, not a tuning knob. */
export const ATTEMPTS_PER_LIFT = 3;

/** Referees on the panel. Structural. */
export const JUDGE_COUNT = 3;

/** White lights needed for a good lift — a majority of three. Structural. */
export const JUDGES_REQUIRED_FOR_GOOD_LIFT = 2;

/**
 * The competition bar itself, with nothing on it.
 * DERIVED, NOT CITED: the retrieved source gives only the bar-and-collars total
 * (25) and says it assumes 2.5 kg metal collars. 20 is what is left over.
 */
export const COMPETITION_BAR_WEIGHT_KG = 20;

/** Both collars together — 2.5 kg each, per that same comment. */
export const COLLAR_PAIR_WEIGHT_KG = 5;

/**
 * The lightest thing that can be on the platform: bar plus collars, no plates.
 * Nothing below this can be declared, and no suggestion may fall under it.
 * Matches OpenLifter's `defaultBarAndCollarsWeightKg = 25` (see sourcing note).
 */
export const MIN_LOADABLE_WEIGHT_KG = COMPETITION_BAR_WEIGHT_KG + COLLAR_PAIR_WEIGHT_KG;

/**
 * Smallest legal increase between two attempts on the same lift.
 *
 * UNCITED as a rulebook value — see the sourcing note. Adjudicated by project
 * review on the automatic-increment argument, not read out of a rulebook here.
 * Distinct from `DECLARATION_INCREMENT_KG`: this is how far the bar must MOVE,
 * that is which numbers may be CALLED. They happen to coincide at 2.5 under the
 * defaults, which is why `INSUFFICIENT_INCREASE` cannot fire under
 * `DEFAULT_MEET_RULES` — see that constant's note.
 */
export const MIN_ATTEMPT_INCREMENT_KG = 2.5;

/**
 * RULE, NOT PHYSICS. Granularity an attempt may be DECLARED on, measured from
 * zero rather than from the bar.
 *
 * A competition bar loads to 201 kg without difficulty. 201 is refused because a
 * lifter may not call it, and `WEIGHT_NOT_DECLARABLE` says so in as many words.
 * The engine does not, and cannot, check the second half of that sentence — see
 * WHY THERE IS NO PLATE GATE. It refuses 201 on the rule alone.
 *
 * PARTIALLY CITED: real meet software flags `declared % 2.5 !== 0` as anomalous
 * and measures the multiple from zero, which fixes both the value and the
 * anchoring. That it is a hard rule in any federation's book is UNCITED here —
 * no rulebook was reachable. Federations that allow finer calls set
 * `MeetLoadingRules.declarationIncrement`.
 */
export const DECLARATION_INCREMENT_KG = 2.5;

// --- Pound defaults. --------------------------------------------------------
//
// Weights in this module are unit-agnostic numbers, so a pound meet is not a
// conversion layer — it is a different `MeetLoadingRules`. These exist because
// the sourcing note's second citation applies its 2.5 modulo to the DISPLAYED
// number, which means a pound meet declares on 2.5 lb, and because the previous
// version of this module could not be configured to run one at all.

/**
 * CITED: `const defaultBarAndCollarsWeightLbs = 45; // Assuming plastic collars.`
 */
export const POUND_BAR_AND_COLLARS_LB = 45;

/**
 * Declaration grid at a pound meet.
 *
 * PARTIALLY CITED, exactly as `DECLARATION_INCREMENT_KG` is: the retrieved
 * `asNumber % 2.5 !== 0` check runs on the number as displayed, so under pound
 * display it is a 2.5 lb grid. No rulebook confirming that was reachable.
 */
export const POUND_DECLARATION_INCREMENT_LB = 2.5;

/**
 * Minimum increase between attempts at a pound meet.
 *
 * UNCITED. Carried over from `MIN_ATTEMPT_INCREMENT_KG` by analogy so the two
 * rule sets have the same shape, NOT retrieved and not adjudicated. Real pound
 * meets commonly work in 5 lb jumps; nothing here establishes either number, and
 * a federation that knows its own rule should set `minIncrement` directly.
 */
export const POUND_MIN_ATTEMPT_INCREMENT_LB = 2.5;

/** Float slop tolerated when comparing weights. */
export const WEIGHT_EPSILON = 1e-6;

/** Decimal places weights are normalised to, to keep float math tidy. */
export const WEIGHT_DECIMAL_PLACES = 3;

/**
 * Seal-fold parameters. NOT game-feel values and not tuning knobs — they only
 * have to be fixed, so that the same rules always fold to the same seal. Named
 * rather than inline because unexplained magic numbers in a hash read as cargo
 * cult.
 *
 * THE MODULUS IS LOAD-BEARING ARITHMETIC, not a round number. JavaScript has no
 * integers: every intermediate of the fold has to land under 2^53 or the low
 * bits are silently rounded away and the mixing degrades. The largest value the
 * fold ever computes is
 *
 *     (MODULUS - 1) * PRIME + (MODULUS - 1)
 *
 * because `sealMeetRules` reduces each field into [0, MODULUS) before adding it.
 * At MODULUS = 2^28 that is 4,503,708,075,294,719 — a bit over half of
 * 2^53 = 9,007,199,254,740,992, so every intermediate is exact and the fold is
 * true modular arithmetic.
 *
 * 2^29 is the first power of two that does NOT fit (9,007,416,150,589,440,
 * just past 2^53), which is why this is 2^28 and not something rounder. An
 * earlier version used 2^31 with a comment claiming the same exactness; that was
 * simply false — 2^31 * PRIME is about 3.6e16, four times over 2^53 — so that
 * fold was losing its low bits on every round. It still discriminated every
 * field, so this is a strengthening, not a bug fix.
 */
const RULES_SEAL_BASIS = 2166136261;
const RULES_SEAL_PRIME = 16777619;
const RULES_SEAL_MODULUS = 2 ** 28;
/**
 * Stand-in for a non-finite rule value, so the fold always yields a number.
 * Must be in [0, RULES_SEAL_MODULUS) like every other folded value, so that the
 * seal stays non-negative and the bound above holds.
 */
const RULES_SEAL_NON_FINITE = 1;

/**
 * Suggested jump for the next attempt, as a fraction of the previous attempt's
 * weight (GDD §6.3: conservative "lock in the total" vs aggressive "chase it").
 *
 * Per-lift because bench jumps are conventionally smaller than squat/deadlift
 * jumps. UNTUNED: these are plausible meet-day progressions, not playtested
 * values. Expect them to move.
 */
export const ATTEMPT_JUMP_FRACTION: Readonly<
  Record<LiftKind, Readonly<Record<ProgressiveAttemptStrategy, number>>>
> = {
  squat: { conservative: 0.02, standard: 0.035, aggressive: 0.055 },
  bench: { conservative: 0.015, standard: 0.025, aggressive: 0.04 },
  deadlift: { conservative: 0.02, standard: 0.04, aggressive: 0.06 },
};

/**
 * Suggested opener as a fraction of the lifter's current one-rep max estimate
 * (GDD §6.1: "opening attempts pre-filled from current Sim-mode e1RM data as a
 * suggested safe opener").
 *
 * The e1RM number is passed IN as a plain number — this module does not import
 * the e1RM module. UNTUNED.
 */
export const OPENER_FRACTION_OF_1RM: Readonly<Record<LiftKind, number>> = {
  squat: 0.9,
  bench: 0.9,
  deadlift: 0.9,
};

// ---------------------------------------------------------------------------
// Core domain types
// ---------------------------------------------------------------------------

export type LiftKind = 'squat' | 'bench' | 'deadlift';

/** Squat -> bench -> deadlift. Structural rule of the sport. */
export const LIFT_ORDER = ['squat', 'bench', 'deadlift'] as const satisfies readonly LiftKind[];

export type AttemptNumber = 1 | 2 | 3;

export const ATTEMPT_NUMBERS = [1, 2, 3] as const satisfies readonly AttemptNumber[];

export type JudgeLight = 'white' | 'red';

/** The three-light panel, head referee first. */
export type JudgePanel = readonly [JudgeLight, JudgeLight, JudgeLight];

export type AttemptOutcome = 'good' | 'no-lift';

interface AttemptIdentity {
  readonly lift: LiftKind;
  readonly attemptNumber: AttemptNumber;
}

/** Declared and on the platform, not yet judged. */
export interface DeclaredAttempt extends AttemptIdentity {
  readonly status: 'declared';
  readonly weight: number;
}

/** Taken and judged. */
export interface JudgedAttempt extends AttemptIdentity {
  readonly status: AttemptOutcome;
  readonly weight: number;
  readonly lights: JudgePanel;
  readonly whiteLights: number;
  /** True when all three referees agreed (3 white or 3 red). */
  readonly unanimous: boolean;
}

/** Forfeited without taking the bar. Carries no weight. */
export interface PassedAttempt extends AttemptIdentity {
  readonly status: 'passed';
}

/** An attempt that is finished with, one way or another. */
export type CompletedAttempt = JudgedAttempt | PassedAttempt;

export type Attempt = DeclaredAttempt | CompletedAttempt;

export type LiftStatus =
  /** Not reached yet. */
  | 'upcoming'
  /** Currently being contested. */
  | 'in-progress'
  /** Finished with at least one good lift. */
  | 'complete'
  /** Finished with no good lift — no total, meet over (GDD §6.3). */
  | 'bombed'
  /** Never contested because the meet ended on an earlier lift. */
  | 'not-contested';

export interface LiftProgress {
  readonly lift: LiftKind;
  /** Finished attempts in order. The in-flight declaration lives on the phase. */
  readonly attempts: readonly CompletedAttempt[];
  readonly status: LiftStatus;
  /** Best successful weight on this lift, or null if none yet. */
  readonly best: number | null;
}

/**
 * Federation-configurable loading rules. Fixed for the whole meet at
 * `createMeet` — see the seal note at the top of this file for how that is
 * enforced rather than merely asserted. Deliberately has no per-attempt escape
 * hatch: if a rule can be relaxed, it is relaxed for every attempt of the meet,
 * visibly, in one place.
 *
 * The knobs are different KINDS of thing — one measurement, two rules. Do not
 * merge them, and do not add a plate field: see WHY THERE IS NO PLATE GATE.
 */
export interface MeetLoadingRules {
  /**
   * PHYSICS. Weight of the bar and collars with no plates, per lift. Per-lift
   * because some meets run a different bar for one of the three (OpenLifter
   * carries `squat`/`bench`/`deadliftBarAndCollarsWeightKg` separately).
   *
   * The ONLY equipment fact this module holds. It is the physical floor, NOT
   * necessarily the minimum declarable weight: if it does not itself sit on the
   * declaration grid, the lightest legal call is heavier than the empty bar.
   * `minimumAttemptWeight` returns that; this field is what
   * `barAndCollarsWeight()` returns.
   */
  readonly barAndCollarsWeight: Readonly<Record<LiftKind, number>>;
  /**
   * RULE. Minimum legal increase between attempts on the same lift — how far
   * the bar must MOVE, not which numbers may be called.
   */
  readonly minIncrement: number;
  /**
   * RULE. Granularity an attempt may be declared on, measured from zero.
   * Default 2.5. Attempt validation reads THIS.
   *
   * It is a rule about numbers, not about discs. Nothing here describes the
   * plate kit, and a plate-rack renderer must not read it as though it did.
   */
  readonly declarationIncrement: number;
}

/**
 * NOTE ON `INSUFFICIENT_INCREASE`: under these defaults `minIncrement` and
 * `declarationIncrement` are both 2.5, so the next legal call after a good 200
 * is 202.5 either way and `INSUFFICIENT_INCREASE` cannot fire — 201 is refused
 * one gate earlier, as `WEIGHT_NOT_DECLARABLE`. That is correct, not dead code:
 * the two rules genuinely coincide at 2.5/2.5. The error exists for a
 * federation that declares on a finer grid than it requires between attempts
 * (`declarationIncrement: 0.5, minIncrement: 2.5`), and the tests exercise it
 * with exactly those rules.
 */
export const DEFAULT_MEET_RULES: MeetLoadingRules = {
  barAndCollarsWeight: {
    squat: MIN_LOADABLE_WEIGHT_KG,
    bench: MIN_LOADABLE_WEIGHT_KG,
    deadlift: MIN_LOADABLE_WEIGHT_KG,
  },
  minIncrement: MIN_ATTEMPT_INCREMENT_KG,
  declarationIncrement: DECLARATION_INCREMENT_KG,
};

/**
 * The same meet run in pounds, transcribed from the retrieved pound defaults.
 *
 * This configuration is the one the previous version of this module REJECTED as
 * INVALID_MEET_RULES — it declared on 2.5 while the pound kit's smallest pair is
 * 1 lb, and 2.5 is not a whole number of 1s. There is no such cross-check any
 * more, because there is nothing to cross-check against, so it runs.
 */
export const POUND_MEET_RULES: MeetLoadingRules = {
  barAndCollarsWeight: {
    squat: POUND_BAR_AND_COLLARS_LB,
    bench: POUND_BAR_AND_COLLARS_LB,
    deadlift: POUND_BAR_AND_COLLARS_LB,
  },
  minIncrement: POUND_MIN_ATTEMPT_INCREMENT_LB,
  declarationIncrement: POUND_DECLARATION_INCREMENT_LB,
};

declare const MEET_RULES_SEAL: unique symbol;

/**
 * Opaque tag proving a `MeetLoadingRules` came out of `createMeet` unchanged.
 * Branded so it cannot be produced by accident; see the seal note at the top of
 * this file for what that does and does not buy.
 */
export type MeetRulesSeal = number & { readonly [MEET_RULES_SEAL]: 'meet-rules' };

/** The rules as they live inside `MeetState`: sealed at `createMeet`. */
export interface SealedMeetRules extends MeetLoadingRules {
  readonly seal: MeetRulesSeal;
}

interface MeetOutcomeBase {
  /** Best good lift per lift; null where a lift was bombed or never contested. */
  readonly bestByLift: Readonly<Record<LiftKind, number | null>>;
  /**
   * Sum of the bests actually achieved. On a completed meet this equals
   * `total`; on a bomb-out it is what was on the board when it ended, which is
   * NOT a total (see `TotalReading`).
   */
  readonly totalOnTheBoard: number;
  /** Every finished attempt, in the order they happened. */
  readonly attempts: readonly CompletedAttempt[];
}

export interface CompletedMeetOutcome extends MeetOutcomeBase {
  readonly kind: 'total';
  /** Sum of the best successful attempt in each of the three lifts. */
  readonly total: number;
  readonly bombedLift: null;
}

/**
 * No total. A lifter who bombs a lift does not place; `totalOnTheBoard` exists
 * only so the recap can show what was up when it happened.
 */
export interface BombedMeetOutcome extends MeetOutcomeBase {
  readonly kind: 'bombed-out';
  readonly total: null;
  readonly bombedLift: LiftKind;
}

export type MeetOutcome = CompletedMeetOutcome | BombedMeetOutcome;

export type MeetPhase =
  /** Waiting for the lifter to declare the weight for this attempt. */
  | { readonly kind: 'awaiting-declaration'; readonly lift: LiftKind; readonly attemptNumber: AttemptNumber }
  /** Weight declared, bar loaded, waiting on the lights. */
  | { readonly kind: 'attempt-declared'; readonly attempt: DeclaredAttempt }
  /** Meet over — either a total or a bomb-out. */
  | { readonly kind: 'complete'; readonly outcome: MeetOutcome };

export interface MeetState {
  readonly rules: SealedMeetRules;
  readonly phase: MeetPhase;
  readonly lifts: Readonly<Record<LiftKind, LiftProgress>>;
}

// ---------------------------------------------------------------------------
// Errors and results
// ---------------------------------------------------------------------------

export type MeetErrorCode =
  | 'MEET_COMPLETE'
  | 'ATTEMPT_ALREADY_DECLARED'
  | 'NO_ATTEMPT_DECLARED'
  | 'ATTEMPT_ALREADY_RESOLVED'
  | 'WRONG_LIFT'
  | 'WRONG_ATTEMPT_NUMBER'
  | 'TOO_MANY_ATTEMPTS'
  | 'INVALID_WEIGHT'
  /**
   * PHYSICS: lighter than the bar and collars. The only refusal in this union
   * that is a statement about equipment, and the only one the engine can make
   * truthfully without a plate inventory.
   */
  | 'WEIGHT_BELOW_BAR'
  /**
   * RULE: not a weight a lifter may call. Says NOTHING about whether the plates
   * could make it — the engine does not know that and must never imply it.
   * Telling a player that 201 kg "cannot be loaded" is a false statement about
   * the equipment, and so is telling them 47.5 lb cannot.
   */
  | 'WEIGHT_NOT_DECLARABLE'
  | 'WEIGHT_DECREASED'
  | 'REPEAT_AFTER_GOOD_LIFT'
  | 'INSUFFICIENT_INCREASE'
  | 'INVALID_JUDGING_PANEL'
  | 'INVALID_MEET_RULES'
  /** The meet's rules object was altered after `createMeet` sealed it. */
  | 'MEET_RULES_TAMPERED'
  | 'NO_PREVIOUS_ATTEMPT';

export interface MeetError {
  readonly code: MeetErrorCode;
  /** Plain-language reason, safe to surface to the player. */
  readonly message: string;
}

export type Result<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: MeetError };

function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

function fail<T>(code: MeetErrorCode, message: string): Result<T> {
  return { ok: false, error: { code, message } };
}

// ---------------------------------------------------------------------------
// Weight helpers
// ---------------------------------------------------------------------------

/** Trims float noise so 2.5-increment arithmetic compares cleanly. */
function normalizeWeight(weight: number): number {
  const factor = 10 ** WEIGHT_DECIMAL_PLACES;
  return Math.round(weight * factor) / factor;
}

export type RoundingMode = 'nearest' | 'up' | 'down';

/**
 * Snaps a weight to a whole number of `increment`s, measured from zero. Pure
 * grid arithmetic: it knows nothing about bars, plates or federations, and the
 * caller decides which grid it is snapping to.
 */
export function roundToIncrement(weight: number, increment: number, mode: RoundingMode = 'nearest'): number {
  const steps = weight / increment;
  const rounded =
    mode === 'up'
      ? Math.ceil(steps - WEIGHT_EPSILON)
      : mode === 'down'
        ? Math.floor(steps + WEIGHT_EPSILON)
        : Math.round(steps);
  return normalizeWeight(rounded * increment);
}

/** True when `weight` is a whole number of `increment`s from zero. */
export function isOnIncrementGrid(weight: number, increment: number): boolean {
  if (!Number.isFinite(weight) || !Number.isFinite(increment) || increment <= 0) return false;
  const steps = weight / increment;
  return Math.abs(steps - Math.round(steps)) * increment < WEIGHT_EPSILON;
}

function isAtLeast(weight: number, minimum: number): boolean {
  return weight >= minimum - WEIGHT_EPSILON;
}

function isSameWeight(a: number, b: number): boolean {
  return Math.abs(a - b) < WEIGHT_EPSILON;
}

// --- The two gates, one function each. --------------------------------------

/**
 * PHYSICS. The weight of the empty loaded bar for this lift. Nothing lighter
 * can be on the platform. Not necessarily a legal declaration — see
 * `minimumAttemptWeight`.
 *
 * This is the whole of what the module knows about equipment. There is
 * deliberately no `isLoadableAttemptWeight`: above this floor the engine has no
 * opinion on what the plates can make. See WHY THERE IS NO PLATE GATE.
 */
export function barAndCollarsWeight(lift: LiftKind, rules: MeetLoadingRules = DEFAULT_MEET_RULES): number {
  return rules.barAndCollarsWeight[lift];
}

/**
 * RULE. May a lifter call this number at all? A whole number of
 * `declarationIncrement`s measured FROM ZERO (the anchoring real meet software
 * uses). Says nothing about whether the bar could take it.
 */
export function isDeclarableWeight(weight: number, rules: MeetLoadingRules = DEFAULT_MEET_RULES): boolean {
  return isOnIncrementGrid(weight, rules.declarationIncrement);
}

/**
 * Both gates: at or above the bar, and on the declaration grid. This is exactly
 * the weight test `declareAttempt` applies; what it adds on top is the
 * progression rules, which need a meet in progress rather than just a number.
 */
export function isLegalAttemptWeight(
  weight: number,
  lift: LiftKind,
  rules: MeetLoadingRules = DEFAULT_MEET_RULES,
): boolean {
  if (!Number.isFinite(weight) || weight <= 0) return false;
  return isAtLeast(weight, barAndCollarsWeight(lift, rules)) && isDeclarableWeight(weight, rules);
}

/**
 * The lightest legal call for this lift: the bar and collars rounded up onto the
 * declaration grid. Equals the bar itself whenever the bar sits on that grid,
 * which it does under the defaults (25 is a multiple of 2.5, and so is 45).
 */
export function minimumAttemptWeight(lift: LiftKind, rules: MeetLoadingRules = DEFAULT_MEET_RULES): number {
  return roundToIncrement(barAndCollarsWeight(lift, rules), rules.declarationIncrement, 'up');
}

/**
 * Snaps a weight to something a lifter may actually declare: on the declaration
 * grid, and never below `minimumAttemptWeight`. This is what every suggestion
 * in this module goes through.
 */
export function roundToLegalAttemptWeight(
  weight: number,
  lift: LiftKind,
  rules: MeetLoadingRules = DEFAULT_MEET_RULES,
  mode: RoundingMode = 'nearest',
): number {
  const floor = minimumAttemptWeight(lift, rules);
  if (!Number.isFinite(weight) || weight <= floor + WEIGHT_EPSILON) return normalizeWeight(floor);
  return normalizeWeight(Math.max(roundToIncrement(weight, rules.declarationIncrement, mode), floor));
}

/**
 * The tail of a `WEIGHT_NOT_DECLARABLE` message: which numbers the lifter could
 * have called instead. This replaces the sentence the old message ended on ("the
 * bar loads to 201 without trouble"), which was the engine asserting something
 * about equipment it has no way to know. Steering the player to a legal call is
 * the useful half of that sentence, and it is true.
 */
function nearestLegalCallsHint(weight: number, lift: LiftKind, rules: MeetLoadingRules): string {
  const below = roundToLegalAttemptWeight(weight, lift, rules, 'down');
  const above = roundToLegalAttemptWeight(weight, lift, rules, 'up');
  if (isSameWeight(below, above)) return `The lightest legal call is ${above}.`;
  return `The nearest legal calls are ${below} and ${above}.`;
}

/**
 * Are these rules usable at all? Nonsense configuration must fail loudly at the
 * point of use rather than quietly disabling a check.
 *
 * This checks that every number is positive and finite, AND NOTHING ELSE. In
 * particular it no longer cross-checks the declaration grid against a plate
 * grid. That check was the visible blast radius of the removed plate gate: it
 * rejected the pound configuration transcribed straight out of this module's own
 * source (bar 45, plate step 1, declaration step 2.5) because 2.5 is not a whole
 * number of 1s — while the pound kit loads every multiple of 2.5 lb in range. A
 * validator that rejects a real meet is worse than no validator.
 *
 * There is no relationship left to enforce between the three fields. The bar
 * need not sit on the declaration grid (`minimumAttemptWeight` handles that),
 * and `minIncrement` need not be a multiple of `declarationIncrement`
 * (`roundToLegalAttemptWeight` rounds the required jump up onto the grid).
 */
export function validateMeetRules(rules: MeetLoadingRules): MeetError | null {
  if (!Number.isFinite(rules.declarationIncrement) || rules.declarationIncrement <= 0) {
    return { code: 'INVALID_MEET_RULES', message: 'The declaration increment must be a positive number.' };
  }
  if (!Number.isFinite(rules.minIncrement) || rules.minIncrement <= 0) {
    return { code: 'INVALID_MEET_RULES', message: 'The minimum attempt increase must be a positive number.' };
  }
  for (const lift of LIFT_ORDER) {
    const barWeight = rules.barAndCollarsWeight[lift];
    if (!Number.isFinite(barWeight) || barWeight <= 0) {
      return {
        code: 'INVALID_MEET_RULES',
        message: `The ${lift} bar and collars must weigh a positive number.`,
      };
    }
  }
  return null;
}

/**
 * Folds the rule values into a seal. Deterministic, total, and DELIBERATELY NOT
 * EXPORTED — see the seal note at the top of this file for exactly how much
 * that is worth (it stops the accidental spread, not a determined forger).
 */
function sealMeetRules(rules: MeetLoadingRules): MeetRulesSeal {
  const factor = 10 ** WEIGHT_DECIMAL_PLACES;
  const fields: readonly number[] = [
    rules.barAndCollarsWeight.squat,
    rules.barAndCollarsWeight.bench,
    rules.barAndCollarsWeight.deadlift,
    rules.minIncrement,
    rules.declarationIncrement,
  ];
  // Every value is reduced into [0, RULES_SEAL_MODULUS) BEFORE it is folded in.
  // That is what makes the bound in the seal-parameter note hold: the largest
  // intermediate is (MODULUS - 1) * PRIME + (MODULUS - 1), which is under 2^53,
  // so no step of this loop loses a bit. A rule value large enough to be
  // inexact on its own still folds deterministically, which is all the seal
  // needs. Reducing also keeps `seal` non-negative throughout, so there is no
  // sign to correct at the end.
  let seal = RULES_SEAL_BASIS % RULES_SEAL_MODULUS;
  for (const field of fields) {
    const scaled = Number.isFinite(field) ? Math.round(field * factor) : RULES_SEAL_NON_FINITE;
    const value = ((scaled % RULES_SEAL_MODULUS) + RULES_SEAL_MODULUS) % RULES_SEAL_MODULUS;
    seal = (seal * RULES_SEAL_PRIME + value) % RULES_SEAL_MODULUS;
  }
  return seal as MeetRulesSeal;
}

/**
 * Has this meet's rules object been altered since `createMeet` sealed it?
 * Returns the error to report, or null if the seal still matches.
 */
export function checkMeetRulesSeal(rules: SealedMeetRules): MeetError | null {
  if (rules.seal === sealMeetRules(rules)) return null;
  return {
    code: 'MEET_RULES_TAMPERED',
    message:
      'The meet’s loading rules were changed after the meet started. Rules are fixed for the whole meet at ' +
      'createMeet; start a new meet instead of editing them mid-card.',
  };
}

/**
 * Defensive copy plus seal: meet state must not alias a caller-owned rules
 * object, and must be able to tell later if someone swapped one in.
 */
function copyAndSealRules(rules: MeetLoadingRules): SealedMeetRules {
  const copied: MeetLoadingRules = {
    barAndCollarsWeight: {
      squat: rules.barAndCollarsWeight.squat,
      bench: rules.barAndCollarsWeight.bench,
      deadlift: rules.barAndCollarsWeight.deadlift,
    },
    minIncrement: rules.minIncrement,
    declarationIncrement: rules.declarationIncrement,
  };
  return { ...copied, seal: sealMeetRules(copied) };
}

// ---------------------------------------------------------------------------
// Judging
// ---------------------------------------------------------------------------

export function isValidJudgePanel(lights: JudgePanel): boolean {
  if (!Array.isArray(lights) || lights.length !== JUDGE_COUNT) return false;
  return lights.every((light) => light === 'white' || light === 'red');
}

/** Defensive copy: a judged attempt must not alias the caller's array. */
function copyJudgePanel(lights: JudgePanel): JudgePanel {
  return [lights[0], lights[1], lights[2]];
}

export function countWhiteLights(lights: JudgePanel): number {
  return lights.reduce<number>((count, light) => (light === 'white' ? count + 1 : count), 0);
}

/** Majority of three carries: two white lights is a good lift. */
export function isGoodLift(lights: JudgePanel): boolean {
  return countWhiteLights(lights) >= JUDGES_REQUIRED_FOR_GOOD_LIFT;
}

/**
 * A split panel — the "judges deliberating" beat in GDD §6.2 is for these.
 * Structural (any non-unanimous panel), so there is no threshold to tune.
 */
export function isSplitDecision(lights: JudgePanel): boolean {
  const white = countWhiteLights(lights);
  return white !== 0 && white !== JUDGE_COUNT;
}

// ---------------------------------------------------------------------------
// Reading a meet
// ---------------------------------------------------------------------------

/** Best successful attempt on a lift, or null if there is none. */
export function bestSuccessfulAttempt(progress: LiftProgress): number | null {
  let best: number | null = null;
  for (const attempt of progress.attempts) {
    if (attempt.status !== 'good') continue;
    if (best === null || attempt.weight > best) best = attempt.weight;
  }
  return best;
}

/** The last attempt on this lift that actually had a bar weight. */
function lastWeighedAttempt(progress: LiftProgress): JudgedAttempt | null {
  for (let i = progress.attempts.length - 1; i >= 0; i -= 1) {
    const attempt = progress.attempts[i];
    if (attempt !== undefined && attempt.status !== 'passed') return attempt;
  }
  return null;
}

function findCompletedAttempt(
  state: MeetState,
  lift: LiftKind,
  attemptNumber: AttemptNumber,
): CompletedAttempt | undefined {
  return state.lifts[lift].attempts.find((attempt) => attempt.attemptNumber === attemptNumber);
}

/** Every finished attempt across the meet, in the order they happened. */
export function allCompletedAttempts(state: MeetState): readonly CompletedAttempt[] {
  return LIFT_ORDER.flatMap((lift) => state.lifts[lift].attempts);
}

/**
 * What the lifter is allowed to declare right now, and why.
 * Returns null when no declaration is pending.
 */
export interface AttemptContext {
  readonly lift: LiftKind;
  readonly attemptNumber: AttemptNumber;
  /** Weight of the last attempt taken on this lift, or null for the opener. */
  readonly previousWeight: number | null;
  readonly previousOutcome: AttemptOutcome | null;
  /** Repeating the exact weight is legal only after a no-lift. */
  readonly mayRepeatWeight: boolean;
  /**
   * Lowest legal declaration. On the opener that is `minimumAttemptWeight`
   * (normally the bar and collars); after a no-lift it is the repeat weight;
   * after a good lift it is the minimum increase. Never null — there is always
   * a floor.
   */
  readonly minimumWeight: number;
  /**
   * If the lifter goes UP at all, this is the smallest legal weight. Anything
   * between the previous attempt and this is not a legal jump, even after a
   * miss where the previous weight itself may be repeated. Null on the opener,
   * where there is nothing to increase from.
   */
  readonly minimumIncreaseWeight: number | null;
}

export function currentAttemptContext(state: MeetState): AttemptContext | null {
  if (state.phase.kind !== 'awaiting-declaration') return null;
  const { lift, attemptNumber } = state.phase;
  const previous = lastWeighedAttempt(state.lifts[lift]);
  if (previous === null) {
    return {
      lift,
      attemptNumber,
      previousWeight: null,
      previousOutcome: null,
      mayRepeatWeight: false,
      minimumWeight: minimumAttemptWeight(lift, state.rules),
      minimumIncreaseWeight: null,
    };
  }
  const mayRepeatWeight = previous.status === 'no-lift';
  // Rounded up onto the DECLARATION grid, not the plate grid: the number handed
  // to the UI has to be one the lifter may actually call, and `declareAttempt`
  // would refuse a merely-loadable one.
  const minimumIncreaseWeight = roundToLegalAttemptWeight(
    previous.weight + state.rules.minIncrement,
    lift,
    state.rules,
    'up',
  );
  return {
    lift,
    attemptNumber,
    previousWeight: previous.weight,
    previousOutcome: previous.status,
    mayRepeatWeight,
    minimumWeight: mayRepeatWeight ? previous.weight : minimumIncreaseWeight,
    minimumIncreaseWeight,
  };
}

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

function initialLiftProgress(lift: LiftKind): LiftProgress {
  return {
    lift,
    attempts: [],
    status: lift === LIFT_ORDER[0] ? 'in-progress' : 'upcoming',
    best: null,
  };
}

/**
 * Start a meet. The rules handed in are copied and sealed here and are fixed
 * for the whole meet: nothing downstream can relax one, and an altered rules
 * object is refused with `MEET_RULES_TAMPERED` rather than honoured.
 *
 * Nonsense rules are NOT rejected here — `createMeet` has no way to report an
 * error and a throwing constructor would break the Result discipline. They are
 * caught at the point of use, by `validateMeetRules`, with a message.
 */
export function createMeet(rules: MeetLoadingRules = DEFAULT_MEET_RULES): MeetState {
  return {
    rules: copyAndSealRules(rules),
    phase: { kind: 'awaiting-declaration', lift: LIFT_ORDER[0], attemptNumber: 1 },
    lifts: {
      squat: initialLiftProgress('squat'),
      bench: initialLiftProgress('bench'),
      deadlift: initialLiftProgress('deadlift'),
    },
  };
}

function nextLiftAfter(lift: LiftKind): LiftKind | null {
  const index = LIFT_ORDER.indexOf(lift);
  return LIFT_ORDER[index + 1] ?? null;
}

function nextAttemptNumber(attemptNumber: AttemptNumber): AttemptNumber | null {
  if (attemptNumber === 1) return 2;
  if (attemptNumber === 2) return 3;
  return null;
}

function withLift(state: MeetState, lift: LiftKind, progress: LiftProgress): MeetState {
  return { ...state, lifts: { ...state.lifts, [lift]: progress } };
}

/**
 * Shared guard for declaring or passing: is this lift/attempt the one on deck?
 */
function checkTarget(
  state: MeetState,
  target: { readonly lift?: LiftKind; readonly attemptNumber?: AttemptNumber },
): MeetError | null {
  if (state.phase.kind === 'complete') {
    return { code: 'MEET_COMPLETE', message: 'The meet is over; no further attempts can be taken.' };
  }
  if (state.phase.kind === 'attempt-declared') {
    return {
      code: 'ATTEMPT_ALREADY_DECLARED',
      message: `Attempt ${state.phase.attempt.attemptNumber} on the ${state.phase.attempt.lift} is already declared and must be judged first.`,
    };
  }
  const { lift, attemptNumber } = state.phase;
  if (target.lift !== undefined && target.lift !== lift) {
    if (state.lifts[target.lift].attempts.length >= ATTEMPTS_PER_LIFT) {
      return {
        code: 'TOO_MANY_ATTEMPTS',
        message: `The ${target.lift} is finished; only ${ATTEMPTS_PER_LIFT} attempts are allowed per lift.`,
      };
    }
    return {
      code: 'WRONG_LIFT',
      message: `Lifts are contested in order (${LIFT_ORDER.join(' → ')}). The ${lift} is up, not the ${target.lift}.`,
    };
  }
  if (state.lifts[lift].attempts.length >= ATTEMPTS_PER_LIFT) {
    return {
      code: 'TOO_MANY_ATTEMPTS',
      message: `Only ${ATTEMPTS_PER_LIFT} attempts are allowed per lift.`,
    };
  }
  if (target.attemptNumber !== undefined && target.attemptNumber !== attemptNumber) {
    return {
      code: 'WRONG_ATTEMPT_NUMBER',
      message: `Attempt ${attemptNumber} on the ${lift} is up, not attempt ${target.attemptNumber}.`,
    };
  }
  return null;
}

export interface DeclareAttemptInput {
  /** Optional guard: rejected unless it matches the lift on deck. */
  readonly lift?: LiftKind;
  /** Optional guard: rejected unless it matches the attempt on deck. */
  readonly attemptNumber?: AttemptNumber;
  readonly weight: number;
  // NOTE: there is deliberately no flag here that loosens a loading or
  // declaration rule. See the REMOVED FEATURE note at the top of this file
  // before adding one.
}

/**
 * Declare the weight for the attempt on deck. Enforces the non-decreasing
 * invariant (see the DESIGN CONFLICT note at the top of this file) and both
 * weight gates. Nothing in `input` can switch either of them off, and nothing
 * done to `state.rules` after `createMeet` can either.
 *
 * The bar floor is checked first, so a refusal always names the most concrete
 * true reason. Every refusal below that floor is a rule about which numbers may
 * be called; none of them is a claim about what the plates can make.
 */
export function declareAttempt(state: MeetState, input: DeclareAttemptInput): Result<MeetState> {
  const targetError = checkTarget(state, input);
  if (targetError !== null) return { ok: false, error: targetError };
  if (state.phase.kind !== 'awaiting-declaration') {
    // Unreachable: checkTarget rejects every other phase. Kept for exhaustiveness.
    return fail('NO_ATTEMPT_DECLARED', 'No attempt is on deck.');
  }
  const rulesError = validateMeetRules(state.rules);
  if (rulesError !== null) return { ok: false, error: rulesError };
  const sealError = checkMeetRulesSeal(state.rules);
  if (sealError !== null) return { ok: false, error: sealError };

  const { lift, attemptNumber } = state.phase;
  const weight = input.weight;

  if (!Number.isFinite(weight) || weight <= 0) {
    return fail('INVALID_WEIGHT', 'An attempt weight must be a positive number.');
  }

  const bar = barAndCollarsWeight(lift, state.rules);
  if (!isAtLeast(weight, bar)) {
    return fail(
      'WEIGHT_BELOW_BAR',
      `The ${lift} bar and collars already weigh ${bar}; nothing lighter than that can go on the platform.`,
    );
  }
  if (!isDeclarableWeight(weight, state.rules)) {
    return fail(
      'WEIGHT_NOT_DECLARABLE',
      `Attempts are declared in steps of ${state.rules.declarationIncrement}, and ${weight} is not one of them. ` +
        nearestLegalCallsHint(weight, lift, state.rules),
    );
  }

  const context = currentAttemptContext(state);
  if (context !== null && context.previousWeight !== null) {
    const previousWeight = context.previousWeight;
    if (weight < previousWeight - WEIGHT_EPSILON) {
      return fail(
        'WEIGHT_DECREASED',
        `Attempts may not go down within a lift: ${weight} is below the previous attempt of ${previousWeight}.`,
      );
    }
    if (isSameWeight(weight, previousWeight)) {
      if (!context.mayRepeatWeight) {
        return fail(
          'REPEAT_AFTER_GOOD_LIFT',
          `A good lift at ${previousWeight} must be followed by a heavier attempt.`,
        );
      }
    } else if (context.minimumIncreaseWeight !== null && !isAtLeast(weight, context.minimumIncreaseWeight)) {
      return fail(
        'INSUFFICIENT_INCREASE',
        `The next attempt must be at least ${context.minimumIncreaseWeight}${
          context.mayRepeatWeight ? ` (or a repeat of ${previousWeight})` : ''
        }.`,
      );
    }
  }

  const attempt: DeclaredAttempt = {
    lift,
    attemptNumber,
    weight: normalizeWeight(weight),
    status: 'declared',
  };
  return ok({ ...state, phase: { kind: 'attempt-declared', attempt } });
}

export interface PassAttemptInput {
  readonly lift?: LiftKind;
  readonly attemptNumber?: AttemptNumber;
}

/**
 * Forfeit the attempt on deck without taking the bar. A passed attempt is used
 * up: it never counts toward the total, and passing all three on a lift leaves
 * the lifter with no total exactly as three misses would.
 */
export function passAttempt(state: MeetState, input: PassAttemptInput = {}): Result<MeetState> {
  const targetError = checkTarget(state, input);
  if (targetError !== null) return { ok: false, error: targetError };
  if (state.phase.kind !== 'awaiting-declaration') {
    return fail('NO_ATTEMPT_DECLARED', 'No attempt is on deck.');
  }
  const { lift, attemptNumber } = state.phase;
  const passed: PassedAttempt = { lift, attemptNumber, status: 'passed' };
  return ok(advanceAfterAttempt(state, lift, passed));
}

export interface ResolveAttemptInput {
  /** Optional guard: rejected unless it matches the declared attempt. */
  readonly lift?: LiftKind;
  /** Optional guard: rejected unless it matches the declared attempt. */
  readonly attemptNumber?: AttemptNumber;
  /** The three lights, as decided outside this module. Copied, never aliased. */
  readonly lights: JudgePanel;
}

/**
 * Apply the referees' decision to the declared attempt and move the meet on.
 * The judging outcome is an input, never rolled here — see the purity contract.
 */
export function resolveAttempt(state: MeetState, input: ResolveAttemptInput): Result<MeetState> {
  if (input.lift !== undefined && input.attemptNumber !== undefined) {
    const already = findCompletedAttempt(state, input.lift, input.attemptNumber);
    if (already !== undefined) {
      return fail(
        'ATTEMPT_ALREADY_RESOLVED',
        `Attempt ${input.attemptNumber} on the ${input.lift} has already been judged.`,
      );
    }
  }
  if (state.phase.kind === 'complete') {
    return fail('MEET_COMPLETE', 'The meet is over; no further attempts can be judged.');
  }
  if (state.phase.kind === 'awaiting-declaration') {
    return fail('NO_ATTEMPT_DECLARED', 'No attempt has been declared, so there is nothing to judge.');
  }

  const declared = state.phase.attempt;
  if (input.lift !== undefined && input.lift !== declared.lift) {
    return fail('WRONG_LIFT', `The declared attempt is on the ${declared.lift}, not the ${input.lift}.`);
  }
  if (input.attemptNumber !== undefined && input.attemptNumber !== declared.attemptNumber) {
    return fail(
      'WRONG_ATTEMPT_NUMBER',
      `The declared attempt is number ${declared.attemptNumber}, not ${input.attemptNumber}.`,
    );
  }
  if (!isValidJudgePanel(input.lights)) {
    return fail('INVALID_JUDGING_PANEL', `Judging requires exactly ${JUDGE_COUNT} red/white lights.`);
  }

  // Copied, not stored by reference: `readonly` is compile-time only, and a
  // caller that keeps and mutates its own array must not be able to rewrite a
  // judged attempt after the fact.
  const lights = copyJudgePanel(input.lights);
  const whiteLights = countWhiteLights(lights);
  const judged: JudgedAttempt = {
    lift: declared.lift,
    attemptNumber: declared.attemptNumber,
    weight: declared.weight,
    status: isGoodLift(lights) ? 'good' : 'no-lift',
    lights,
    whiteLights,
    unanimous: whiteLights === 0 || whiteLights === JUDGE_COUNT,
  };
  return ok(advanceAfterAttempt(state, declared.lift, judged));
}

/** Records a finished attempt and works out what happens next. */
function advanceAfterAttempt(state: MeetState, lift: LiftKind, attempt: CompletedAttempt): MeetState {
  const previous = state.lifts[lift];
  const attempts = [...previous.attempts, attempt];
  const withAttempt: LiftProgress = { ...previous, attempts, best: null };
  const best = bestSuccessfulAttempt(withAttempt);

  const following = nextAttemptNumber(attempt.attemptNumber);
  if (attempts.length < ATTEMPTS_PER_LIFT && following !== null) {
    const progress: LiftProgress = { ...withAttempt, status: 'in-progress', best };
    return {
      ...withLift(state, lift, progress),
      phase: { kind: 'awaiting-declaration', lift, attemptNumber: following },
    };
  }

  // The lift is finished.
  if (best === null) {
    // Bombed out: no total, and per GDD §6.3 the meet ends here.
    const progress: LiftProgress = { ...withAttempt, status: 'bombed', best: null };
    const bombed = withLift(state, lift, progress);
    const remaining = LIFT_ORDER.slice(LIFT_ORDER.indexOf(lift) + 1);
    const finalState = remaining.reduce<MeetState>(
      (acc, upcoming) => withLift(acc, upcoming, { ...acc.lifts[upcoming], status: 'not-contested' }),
      bombed,
    );
    return { ...finalState, phase: { kind: 'complete', outcome: buildBombedOutcome(finalState, lift) } };
  }

  const progress: LiftProgress = { ...withAttempt, status: 'complete', best };
  const advanced = withLift(state, lift, progress);
  const next = nextLiftAfter(lift);
  if (next === null) {
    return { ...advanced, phase: { kind: 'complete', outcome: buildCompletedOutcome(advanced) } };
  }
  const started = withLift(advanced, next, { ...advanced.lifts[next], status: 'in-progress' });
  return { ...started, phase: { kind: 'awaiting-declaration', lift: next, attemptNumber: 1 } };
}

function bestByLift(state: MeetState): Readonly<Record<LiftKind, number | null>> {
  return {
    squat: state.lifts.squat.best,
    bench: state.lifts.bench.best,
    deadlift: state.lifts.deadlift.best,
  };
}

function sumBests(bests: Readonly<Record<LiftKind, number | null>>): number {
  return normalizeWeight(LIFT_ORDER.reduce<number>((sum, lift) => sum + (bests[lift] ?? 0), 0));
}

function buildCompletedOutcome(state: MeetState): CompletedMeetOutcome {
  const bests = bestByLift(state);
  const total = sumBests(bests);
  return {
    kind: 'total',
    total,
    bombedLift: null,
    bestByLift: bests,
    totalOnTheBoard: total,
    attempts: allCompletedAttempts(state),
  };
}

function buildBombedOutcome(state: MeetState, bombedLift: LiftKind): BombedMeetOutcome {
  const bests = bestByLift(state);
  return {
    kind: 'bombed-out',
    total: null,
    bombedLift,
    bestByLift: bests,
    totalOnTheBoard: sumBests(bests),
    attempts: allCompletedAttempts(state),
  };
}

// ---------------------------------------------------------------------------
// Scoring
//
// The running sum and the official total are DIFFERENT NUMBERS and are never
// returned by the same accessor. A meet with one good lift on each of the three
// lifts and a deadlift attempt still to come has a sum — it does not have a
// total. `readTotal` forces a caller to say which one it wants: `total` is a
// number only in the 'final' case, so a mid-meet sum cannot be rendered as a
// result by accident.
// ---------------------------------------------------------------------------

export type TotalReading =
  /** Still lifting. There is no total yet, only what is on the board. */
  | { readonly kind: 'in-progress'; readonly total: null; readonly totalOnTheBoard: number }
  /** Meet over with a total. This is the official number. */
  | { readonly kind: 'final'; readonly total: number; readonly totalOnTheBoard: number }
  /** Meet over with a bombed lift: NO total, which is not a total of zero. */
  | {
      readonly kind: 'no-total';
      readonly total: null;
      readonly totalOnTheBoard: number;
      readonly bombedLift: LiftKind;
    };

/** The one accessor that can tell you whether a total is final. */
export function readTotal(state: MeetState): TotalReading {
  const onTheBoard = sumBests(bestByLift(state));
  if (state.phase.kind !== 'complete') {
    return { kind: 'in-progress', total: null, totalOnTheBoard: onTheBoard };
  }
  const outcome = state.phase.outcome;
  if (outcome.kind === 'bombed-out') {
    return {
      kind: 'no-total',
      total: null,
      totalOnTheBoard: outcome.totalOnTheBoard,
      bombedLift: outcome.bombedLift,
    };
  }
  return { kind: 'final', total: outcome.total, totalOnTheBoard: outcome.totalOnTheBoard };
}

/**
 * The meet's official total = sum of the best successful attempt in each lift.
 * Null until the meet is actually over, and null forever if a lift was bombed —
 * a bombed lifter has NO total, which is not the same as a total of zero.
 * There is no way to get a provisional number out of this function.
 */
export function finalMeetTotal(state: MeetState): number | null {
  return readTotal(state).total;
}

/**
 * Sum of the bests on the board so far. PROVISIONAL while the meet is running,
 * and NOT a result: a bombed lifter can have a large number here and no total.
 * Use it for the live scoreboard, never for a placing or a shareable card.
 */
export function totalOnTheBoard(state: MeetState): number {
  return readTotal(state).totalOnTheBoard;
}

/** The finished meet's outcome, or null while it is still running. */
export function meetOutcome(state: MeetState): MeetOutcome | null {
  return state.phase.kind === 'complete' ? state.phase.outcome : null;
}

export function isMeetComplete(state: MeetState): boolean {
  return state.phase.kind === 'complete';
}

export function isBombedOut(state: MeetState): boolean {
  return state.phase.kind === 'complete' && state.phase.outcome.kind === 'bombed-out';
}

// ---------------------------------------------------------------------------
// Attempt selection (GDD §6.3)
// ---------------------------------------------------------------------------

export type ProgressiveAttemptStrategy = 'conservative' | 'standard' | 'aggressive';

/**
 * There is deliberately no "drop down" strategy — within a lift the bar never
 * goes down. See the DESIGN CONFLICT note at the top of this file.
 */
export type AttemptStrategy = ProgressiveAttemptStrategy | 'repeat';

/**
 * Suggest a legal weight for the attempt on deck. Never returns a weight the
 * engine would reject.
 */
export function suggestNextAttempt(state: MeetState, strategy: AttemptStrategy): Result<number> {
  const rulesError = validateMeetRules(state.rules);
  if (rulesError !== null) return { ok: false, error: rulesError };
  const sealError = checkMeetRulesSeal(state.rules);
  if (sealError !== null) return { ok: false, error: sealError };
  const context = currentAttemptContext(state);
  if (context === null) {
    return fail('NO_ATTEMPT_DECLARED', 'No attempt is on deck to suggest a weight for.');
  }
  if (context.previousWeight === null) {
    return fail('NO_PREVIOUS_ATTEMPT', 'This is an opening attempt; use suggestOpener instead.');
  }
  const previousWeight = context.previousWeight;

  if (strategy === 'repeat') {
    if (!context.mayRepeatWeight) {
      return fail('REPEAT_AFTER_GOOD_LIFT', `A good lift at ${previousWeight} must be followed by a heavier attempt.`);
    }
    return ok(previousWeight);
  }

  const minimum =
    context.minimumIncreaseWeight ??
    roundToLegalAttemptWeight(previousWeight + state.rules.minIncrement, context.lift, state.rules, 'up');
  const jumped = previousWeight * (1 + ATTEMPT_JUMP_FRACTION[context.lift][strategy]);
  const rounded = roundToLegalAttemptWeight(jumped, context.lift, state.rules, 'up');
  if (isAtLeast(rounded, minimum)) return ok(rounded);
  return ok(minimum);
}

/**
 * Suggested opening attempt from a one-rep-max estimate (GDD §6.1).
 * `oneRepMax` is supplied by the caller — this module does not compute e1RM.
 * Rounds down onto the declaration grid, because an opener you miss is how
 * meets go wrong, but never below `minimumAttemptWeight`: there is no such
 * thing as a lighter legal attempt.
 *
 * Takes bare rules rather than a `MeetState`, so there is no seal to check —
 * it does not read or alter a running meet.
 */
export function suggestOpener(
  lift: LiftKind,
  oneRepMax: number,
  rules: MeetLoadingRules = DEFAULT_MEET_RULES,
): Result<number> {
  const rulesError = validateMeetRules(rules);
  if (rulesError !== null) return { ok: false, error: rulesError };
  if (!Number.isFinite(oneRepMax) || oneRepMax <= 0) {
    return fail('INVALID_WEIGHT', 'A one-rep-max estimate must be a positive number.');
  }
  const target = oneRepMax * OPENER_FRACTION_OF_1RM[lift];
  return ok(roundToLegalAttemptWeight(target, lift, rules, 'down'));
}
