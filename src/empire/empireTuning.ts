/**
 * EMPIRE_TUNING — every number GDD §5 (Gym Empire) asks for, in one place.
 *
 * ---------------------------------------------------------------------------
 * Nothing here has been played. Read this before trusting a value.
 * ---------------------------------------------------------------------------
 * GDD §12.1 is explicit that a one-shot run delivers a tunable artifact and
 * that feel tuning happens afterwards, by hand, with people playing — roughly
 * 30 passes. Every magnitude below is an untuned placeholder chosen to be
 * legible and internally consistent, not a value anybody has judged. The claim
 * made for them is weaker than "good", and it is the whole claim:
 *
 *   1. The ladders are not degenerate. Each tier of each axis costs more, pays
 *      more and is reachable; no tier is dominated by the one below it.
 *   2. The block is self-consistent. `empireTuning.test.ts` re-derives every
 *      ordering, every ceiling and every reachability relation from the values
 *      themselves rather than restating them here.
 *
 * Neither is a claim about feel.
 *
 * ---------------------------------------------------------------------------
 * Why this file exists
 * ---------------------------------------------------------------------------
 * CLAUDE.md, "Game Feel Values Must Be Tunable": keep every such value as a
 * named constant in one place, never scattered as magic numbers across
 * components. This is that place for GDD §5, and it is the whole of that place:
 * `src/tuning/audit.ts` classifies every unregistered file as a `renderer`, so
 * a bare number anywhere else under `src/empire/` fails the suite by name, line
 * and literal. `empireCore.test.ts` runs that same audit over this directory
 * from inside this piece's own suite, so the rule bites here before it bites in
 * the tree-wide run.
 *
 * Pieces E1-E5 read this file and do not edit it. One tuning block shared by
 * five parallel builders is a merge magnet, which is the argument
 * `src/tuning/index.ts` already makes for keeping tuning beside its mechanic
 * rather than in a single physical file.
 *
 * ---------------------------------------------------------------------------
 * Every entry is classified, and the classification is a value, not a comment
 * ---------------------------------------------------------------------------
 * `EMPIRE_TUNING_CLASSIFICATION` below gives every key of `EMPIRE_TUNING` one
 * of four classes. It is a total `Record`, so a key added without a class is a
 * compile error, and `empireTuning.test.ts` checks the two key sets both ways.
 *
 *   - `knob`       — a playtester turns this freely. Most of the file.
 *   - `budget`     — a design budget GDD §5 states in prose. Moving it changes
 *                    what the design promises, so move it with a reason.
 *   - `refusal`    — a GDD §12.3 refusal condition wearing a constant's
 *                    clothes. Do not turn it; a critic sends the work back for
 *                    the behaviour it encodes regardless of how good everything
 *                    else looks.
 *   - `structural` — a unit, a vocabulary or a piece of arithmetic. Not feel.
 *                    Changing one does not make the game easier, it makes it
 *                    wrong or it makes it a different game.
 *
 * The class to be suspicious of when reviewing an addition is `structural`,
 * for the reason `src/tuning/audit.ts` gives about `local`: it is where a feel
 * value would hide if one were going to.
 *
 * ---------------------------------------------------------------------------
 * What is deliberately not here
 * ---------------------------------------------------------------------------
 *   - The fatigue model's own constants, including the floor a physio may
 *     shorten a setback to. That is `FATIGUE_TUNING` in `src/game/fatigue.ts`
 *     and this file does not restate one of them. `PHYSIO_MAX_DAYS_SAVED`
 *     below is bounded against it by a test that imports the real block.
 *   - The wallet, the tender vocabulary and the covered-day price. Those are
 *     `src/game/progression.ts` and `src/game/currencyProvenance.ts`. GDD §8.3E
 *     prices coverage; the empire prices nothing that touches it, and
 *     `empireCore.ts` makes that structural rather than incidental.
 *   - Any name. No lifter name, gym name, sponsor name, federation name or
 *     equipment brand appears in this file. The tier and axis identifiers below
 *     are generic English nouns taken from GDD §5.3 and §5.4's own tables.
 *     GDD §12.3 refuses a real, named athlete, brand or company in any string
 *     or code path, and the licensing system carries fictional placeholders
 *     until a human unlocks a specific real partner.
 *
 *     That sentence was prose with nothing behind it for a round. It now has
 *     two scans behind it, in `empireCore.test.ts`, and they are honest about
 *     what they are: one pins every space-free single-quoted literal in this
 *     directory exactly, so a new vocabulary token is a decision somebody
 *     signs; the other bans a `Capitalised Capitalised` pair anywhere, which is
 *     the shape a person's name takes inside a message. NEITHER CAN TELL A REAL
 *     NAME FROM AN INVENTED ONE — that is the human, name-by-name pass §12.3
 *     asks for on every piece. What they do is make a name arriving visible
 *     instead of quiet.
 *
 *     Read "inside a message" as a claim that had to be earned. For a round the
 *     second scan looked only at single-quoted literals, and every runtime
 *     message `empireCore.ts` writes is a TEMPLATE literal — so it read no
 *     message at all, and a real name appended to a fault string was invisible
 *     to both halves and moved neither count. It now collects single-quoted,
 *     double-quoted and template text, counts each group separately, and pins
 *     that the fault messages really are in the domain. What it still cannot
 *     see: a name assembled at runtime from parts, and any string in a file
 *     outside this directory.
 *
 *     One term here was flagged for a human ruling, and the flag overstated its
 *     own case in the alarming direction. The sentence is corrected rather than
 *     deleted, because the half it got wrong is the more useful half.
 *
 *     `'monolift'`, in `EQUIPMENT_TIERS`, is transcribed verbatim from GDD
 *     §5.4's own table and is the standard generic term for the rack type
 *     across federation rulebooks. It does originate as a specific inventor's
 *     product name. What the flag then said — that it "is claimed as a mark by
 *     at least one manufacturer" — was written with no search behind it, and a
 *     search points the other way. Run twice from different angles for this
 *     note: the plain word is what a dozen unrelated strength-equipment makers
 *     sell a product under, on their own storefronts, in the United States and
 *     in Europe, as whole racks and as bolt-on attachments; the single
 *     registered mark that surfaced anywhere near it is a different, two-word
 *     string held by one maker, and a registration on a neighbouring string is
 *     evidence the plain word was not available to register rather than
 *     evidence somebody holds it. Wide unrelated commercial use with no
 *     registration on the term itself is what genericisation looks like.
 *
 *     Under CLAUDE.md's ruled naming bar that is an accept: the bar refuses a
 *     famous mark, a coined name from a creative work, or a hit in a confusable
 *     sector, and a generic noun many sellers use for one kind of rack is none
 *     of the three. It stays. No maker's name and no wordmark is written here,
 *     which is the other half of why the term is safe in this file — what is
 *     transcribed is the rack type, not a brand.
 *
 *     The limit, since this is a search and not a clearance: no search proves a
 *     negative, and CLAUDE.md's own record is that an agent's name search has
 *     been wrong in both directions inside one paragraph. This term belongs in
 *     the attorney pass that section recommends over the whole set of names at
 *     once. What changed here is that the sentence says what was measured
 *     instead of a worry nobody had checked.
 *
 * Purity: zero React, zero side effects, zero I/O, no clock, no randomness,
 * no imports at all. It is a leaf so that every later piece can read it without
 * any of them having to import each other.
 */

/** The four classes an entry can carry. There is no fifth and no "probably". */
export const EMPIRE_TUNING_CLASSES = ['knob', 'budget', 'refusal', 'structural'] as const;

export type EmpireTuningClass = (typeof EMPIRE_TUNING_CLASSES)[number];

/**
 * The closed grammar of a tuning value: a number, a string, a readonly array
 * of these, or a readonly plain record of these. Nothing else.
 *
 * Why a grammar and not a wider walk. The leaf census in
 * `empireForbiddenOutput.test.ts` enumerates this block by recursing through
 * `Object.entries`, and a `Map`'s payload lives in internal slots rather than
 * own properties — so `Object.entries(map)` is `[]`, and a knob parked inside
 * one was invisible to the census, to `hiddenTuningKeys` (which reads
 * own-property descriptors, and an internal slot is not a descriptor), and to
 * the walk's own catch-all throw (a `Map` is an object, so the object arm
 * accepts it and walks zero entries). Measured at the base of this round: the
 * Map planted, `tsc` exit 0, the census green at 100 leaves, the new number
 * filed nowhere. That was the census's second enumeration gap in three rounds
 * — descriptors, then internal slots — and each repair had declared its
 * successor, which is CLAUDE.md's signal to change the instrument rather than
 * widen the scan: the space of container types is open-ended, and a walk
 * grows one arm per round forever.
 *
 * The `satisfies` below makes the enumeration question a compile question.
 * What it guarantees, in the mechanism's own terms: every entry's inferred
 * type must be assignable to this union, and a `Map`, `Set`, `Date`, function,
 * promise or any other class instance is not — such types carry members
 * (`get`, `then`, `getTime`) that no arm of the union admits, and a class
 * instance type has no implicit index signature to satisfy the record arm. So
 * an honest author adding one gets `tsc` exit 2 at the declaration, with the
 * entry named in the error. Booleans and nulls are refused the same way,
 * which also closes the leaf walk's throw arm to honest authors.
 *
 * Its limit, stated because no type reaches past it: an assertion erases the
 * container — `Object.freeze(new Map(...)) as unknown as Readonly<Record<
 * string, number>>` compiles, exactly as every brand in `empireCore.ts` can be
 * laundered. Two named catchers cover that route: the runtime internal-slot
 * read beside the hidden-keys pin in `empireForbiddenOutput.test.ts` (`files
 * or exempts every numeric leaf...`) reads the real values with `instanceof`
 * and `typeof`, which no type-level assertion can dress up; and
 * `src/game/progression.test.ts`'s reflective-assembly census pins every
 * `as unknown as` / `as any as` in the project's non-test files both ways, so
 * the two common launder spellings are a signed row before they are anything
 * else. The runtime read is the catcher for the class; the cast census is a
 * tripwire for its usual spellings, not a closure over them.
 *
 * What the grammar does not see, so the sentence above is not read wider than
 * it is: a getter whose declared type fits the union looks like a plain
 * property here. That is the descriptor route, and it stays covered where it
 * was covered — `hiddenTuningKeys` for non-enumerable and symbol keys, and
 * `Object.entries` itself reads through an enumerable getter, so the census
 * sees the value it returns.
 *
 * The record arm is an interface rather than `Readonly<Record<...>>` because
 * a type alias may not reference itself through an eagerly-expanded mapped
 * type (TS2456); an interface's index signature resolves lazily and says the
 * same thing.
 *
 * Deliberately not exported: instrument A in `empireForbiddenOutput.test.ts`
 * walks this module's export surface at type level and pins what it finds, and
 * exporting a recursive union with a bare `string` member would move those
 * pins for no coverage gain — nothing outside this file needs the type,
 * because the `satisfies` below is its whole job.
 */
interface EmpireTuningRecord {
  readonly [key: string]: EmpireTuningValue;
}

type EmpireTuningValue = number | string | readonly EmpireTuningValue[] | EmpireTuningRecord;

export const EMPIRE_TUNING = Object.freeze({
  // -------------------------------------------------------------------------
  // Units and arithmetic (structural)
  //
  // Here so no other entry has to be written in a mixed unit and so no
  // consumer needs a bare conversion. A duration in this file is in seconds
  // unless its name says otherwise.
  // -------------------------------------------------------------------------

  /** Seconds in an hour. Arithmetic, not a knob. */
  SECONDS_PER_HOUR: 3600,

  /** Seconds in a day. Arithmetic, not a knob. */
  SECONDS_PER_DAY: 86400,

  /**
   * Decimal places production arithmetic is scrubbed to, so IEEE-754 noise
   * does not make two equal accruals compare unequal. Not a feel value; it is
   * here because the brief for this module is that it holds every literal.
   */
  PRECISION_DECIMALS: 6,

  // -------------------------------------------------------------------------
  // §5.1 Loop
  //
  // "Time passes -> resources generate -> spend to expand -> expand generates
  // more. Check-in is 30-60 seconds: collect, queue an upgrade, maybe assign
  // an NPC. Standard offline-earnings cap so it rewards check-ins without
  // punishing a 10-hour gap."
  // -------------------------------------------------------------------------

  /**
   * The quantum production accrues in.
   *
   * Structural rather than a knob: the loop is a pure function of elapsed
   * seconds, and quantising it is what makes two clients that ask at slightly
   * different moments agree. One second is fine enough that no screen can see
   * the step and coarse enough that a ten-hour gap is a whole number of ticks.
   */
  TICK_SECONDS: 1,

  /**
   * The check-in the loop is designed around, in seconds. GDD §5.1 states the
   * range in prose, so these two are that sentence as a value.
   *
   * A budget rather than a knob: this is the piece's equivalent of the session
   * loop's 60-90 s window. Widening it is a design change, not a tuning pass.
   *
   * UNCONSUMED, said plainly rather than deferred. This docstring used to say
   * "it is what a later piece measures a scripted check-in against"; eleven
   * modules landed and none does, because nothing in `src/empire/` models how
   * long a check-in takes — the composition steps a gym at a check-in and never
   * asks what the check-in cost the player in seconds. So these two are a
   * design budget with no reader, they are the only two entries on
   * `AWAITING_CONSUMER` in `empireTuning.test.ts`, and that list pins the fact
   * in both directions: an unconsumed entry missing from it fails, and a listed
   * entry that has since been wired fails too. Giving them a consumer means
   * building the scripted check-in §5.1 describes, which is a piece rather than
   * a line.
   */
  CHECK_IN_TARGET_SECONDS_MIN: 30,
  CHECK_IN_TARGET_SECONDS_MAX: 60,

  /**
   * The gap GDD §5.1 says the cap must not punish, in hours.
   *
   * A budget, and the only reason `OFFLINE_EARNINGS_CAP_HOURS` has a floor
   * under it at all. A player who sleeps eight hours and commutes two must
   * come back to a full bank; the cap exists to reward the check-in after
   * that, not to charge for the sleep. CLAUDE.md's "never punish daily
   * engagement" is the rule this serves.
   */
  OFFLINE_EARNINGS_NO_PUNISH_HOURS: 10,

  /**
   * How much offline time banks at all, in hours. Accrual past this is
   * discarded rather than deferred.
   *
   * Set above `OFFLINE_EARNINGS_NO_PUNISH_HOURS` on purpose, and
   * `empireTuning.test.ts` fails if it ever drops below it.
   */
  OFFLINE_EARNINGS_CAP_HOURS: 12,

  /**
   * Share of the online rate that accrues while away, as a fraction. Below 1
   * so a check-in is worth making and above 0 so a gap is not a loss.
   *
   * This applies to the Gym Bucks economy. It does not apply to the Training
   * IQ trickle, and the reason is structural rather than a matter of taste:
   * see `TRAINING_IQ_BASE_PER_DAY` and `empireCore.ts`'s clock split.
   */
  OFFLINE_EARNINGS_FRACTION: 0.5,

  // -------------------------------------------------------------------------
  // §5.2 Production
  //
  // "Gym Bucks (soft currency) — base passive income. Training IQ trickle —
  // keeps Idle connected to Sim progression. NPC lifters — each generates
  // Bucks/IQ based on tier and tenure."
  // -------------------------------------------------------------------------

  /** Base passive Gym Bucks per hour, before any axis multiplier. */
  GYM_BUCKS_BASE_PER_HOUR: 120,

  /** Gym Bucks per hour from one roster lifter at tier multiplier 1, loyalty 1. */
  NPC_GYM_BUCKS_PER_HOUR_BASE: 40,

  /**
   * The Training IQ trickle, per calendar day, before any roster contribution.
   *
   * A knob, with one constraint on it that is not a matter of taste. Training
   * IQ is GDD §2's stat for how well you train, and §2 gives it a growth rate
   * and a long-term ceiling — so it reaches Sim training pace, and GDD §8.1
   * and §12.3 refuse anything purchasable that affects training pace. A
   * playtester may turn this number. What no edit to this file can do is make
   * the trickle respond to a purchase: `empireCore.ts` types the trickle
   * against an un-accelerated clock, so a bought timer skip is not the sort of
   * thing that can be handed to it.
   *
   * Note the open ruling this sits next to. `sessionTuning.ts` records that
   * whether Training IQ counts as training pace under §8.1 "has to be answered
   * rather than assumed". This piece takes the conservative side — it treats
   * the trickle as progression-reaching — because the conservative side is the
   * one that is cheap to relax later and expensive to add later.
   */
  TRAINING_IQ_BASE_PER_DAY: 1,

  /**
   * Training IQ per calendar day from one roster lifter, at tier multiplier 1
   * and loyalty 1.
   *
   * Same standing as the entry above: a knob whose reachability by a purchase
   * is closed in the type system rather than here.
   */
  NPC_TRAINING_IQ_PER_DAY_BASE: 0.25,

  /**
   * Most Training IQ one calendar day of idle may pay, however large the gym.
   *
   * A budget. GDD §2 lists two sources for Training IQ — good Sim decisions
   * and the Gym Empire trickle — and an idle layer with no ceiling eventually
   * makes the second one the whole stat, which would put §2's core tension
   * (strong-but-dumb against smart-but-weaker) behind an idle timer instead of
   * behind training decisions. Where the ceiling belongs is a balance question
   * nobody has played; that it exists is not.
   */
  TRAINING_IQ_DAILY_CEILING: 6,

  // -------------------------------------------------------------------------
  // §5.3 NPC lifters — flavour only, and explicitly no gacha
  //
  // "Recruited via flat Gym Bucks cost or reputation threshold. What you see is
  // what you get. Output scales deterministically with gym tier + tenure/
  // loyalty, not luck."
  //
  // Every table in this section is keyed by tier and read by index, and there
  // is no seed, no weight and no distribution anywhere in this file.
  // Random-chance recruitment of any kind is a GDD §12.3 refusal condition;
  // `empireCore.test.ts` bans the language of randomness from the whole
  // directory rather than trusting this paragraph. When that sentence was
  // written the scan banned `weightedPick` and not the bare words `seed`,
  // `weight` or `distribution`, so two thirds of it was unbacked; all three are
  // banned now, and every pattern in that list is driven against a string it
  // should trip so a dead regex reports itself.
  // -------------------------------------------------------------------------

  /**
   * The recruitment ladder, weakest first.
   *
   * Structural: the order is load-bearing. Cost, reputation threshold, recruit
   * time and output multiplier are all required to be monotone along it, so
   * reordering this list is not a tuning pass, it is a different design.
   *
   * The top rung is GDD §5.3's "legendary lifter" tier, which "exists but
   * unlocks via reputation milestones, never paid pulls". It is priced like
   * every other rung and gated by a reputation threshold no amount of currency
   * moves.
   */
  NPC_TIERS: Object.freeze(['novice', 'club', 'regional', 'national', 'legendary'] as const),

  /** Output multiplier per tier, applied to both the Bucks and the IQ base. */
  NPC_TIER_OUTPUT_MULTIPLIER: Object.freeze({
    novice: 1,
    club: 1.6,
    regional: 2.5,
    national: 4,
    legendary: 6.5,
  }),

  /**
   * Flat Gym Bucks price per tier. Flat, published, and the same for every
   * player on every day — which is GDD §5.3's "what you see is what you get".
   * The magnitudes are knobs; the shape is not.
   */
  NPC_RECRUIT_COST_GYM_BUCKS: Object.freeze({
    novice: 500,
    club: 2000,
    regional: 8000,
    national: 30000,
    legendary: 90000,
  }),

  /**
   * Reputation a gym must hold before a tier may be recruited at all.
   *
   * The first rung is 0 so a brand-new gym can recruit on day one, and the top
   * rung is the §5.3 milestone. Every threshold is required to be reachable —
   * that is, no greater than `REPUTATION_MAX` — or the tier is dead content.
   */
  NPC_RECRUIT_REPUTATION_THRESHOLD: Object.freeze({
    novice: 0,
    club: 50,
    regional: 200,
    national: 600,
    legendary: 1500,
  }),

  /**
   * How long a recruit takes to arrive, in seconds. This is one of the two
   * timers GDD §8.3B sells a skip for, and the more delicate of the two: a
   * recruited lifter pays Training IQ, so an accelerated recruit is the exact
   * shape of the two-hop hazard §8.1 refuses. `empireCore.ts` splits the clock
   * rather than restricting the sale.
   */
  NPC_RECRUIT_SECONDS: Object.freeze({
    novice: 60,
    club: 300,
    regional: 1800,
    national: 7200,
    legendary: 21600,
  }),

  /** Days of tenure at which a lifter's loyalty multiplier reaches its ceiling. */
  NPC_TENURE_DAYS_TO_FULL_LOYALTY: 30,

  /** Loyalty multiplier on the day a lifter joins. Below 1: tenure is the reward. */
  NPC_LOYALTY_MIN_MULTIPLIER: 0.8,

  /**
   * The loyalty ceiling. Nothing about tenure pays past this, so a lifter
   * recruited a year ago and one recruited a month ago are worth the same and
   * the roster stays a live decision rather than an archive.
   */
  NPC_LOYALTY_MAX_MULTIPLIER: 1.5,

  /**
   * Shape of the tenure curve, as an exponent on normalised tenure. Below 1
   * front-loads the payoff, so the first week of a new lifter is felt.
   */
  NPC_LOYALTY_CURVE_EXPONENT: 0.6,

  /** Roster slots a gym starts with, before any expansion. */
  ROSTER_SLOTS_BASE: 2,

  /** Extra roster slots per level of the §5.4 space axis. */
  ROSTER_SLOTS_PER_SPACE_LEVEL: 2,

  /** Extra roster slots per level of spotter staff — §5.4's "more racks, platforms, NPC slots". */
  ROSTER_SLOTS_PER_SPOTTER_LEVEL: 1,

  /**
   * The hard roster ceiling.
   *
   * A budget, and pinned in two directions by `empireTuning.test.ts`: it must
   * be reachable by a fully built gym, or the top of both ladders pays
   * nothing, and it must be above `ROSTER_SLOTS_BASE`, or every expansion on
   * either axis is already capped at level zero.
   */
  ROSTER_SLOTS_MAX: 16,

  // -------------------------------------------------------------------------
  // §5.4 Expansion axes: equipment, space, staff, reputation
  // -------------------------------------------------------------------------

  /**
   * GDD §5.4's equipment ladder, verbatim from its table: "Bare bar -> comp
   * plates -> specialty bars -> monolift". Generic equipment nouns; no
   * manufacturer is named here or anywhere in this piece.
   *
   * Structural for the same reason as `NPC_TIERS`: the order is the ladder.
   */
  EQUIPMENT_TIERS: Object.freeze([
    'bare-bar',
    'comp-plates',
    'specialty-bars',
    'monolift',
  ] as const),

  /**
   * Price of each equipment tier in Gym Bucks. The first is 0 because a gym
   * opens with a bare bar; the rest are strictly increasing.
   */
  EQUIPMENT_TIER_COST_GYM_BUCKS: Object.freeze({
    'bare-bar': 0,
    'comp-plates': 1500,
    'specialty-bars': 9000,
    monolift: 45000,
  }),

  /**
   * Gym Bucks multiplier from the equipment tier. The first is 1 because it is
   * the baseline the rest are measured against.
   *
   * Deliberately a Bucks multiplier and not an IQ one. GDD §5.4 gives this
   * axis the cross-mode hook "unlocks Sim-mode accessory options", which is an
   * unlock, not a rate — and a rate here would be a purchasable build timer
   * feeding a progression-reaching output.
   */
  EQUIPMENT_TIER_BUCKS_MULTIPLIER: Object.freeze({
    'bare-bar': 1,
    'comp-plates': 1.35,
    'specialty-bars': 1.8,
    monolift: 2.4,
  }),

  /** Highest space level. Level 0 is the room a gym opens in. */
  SPACE_LEVEL_MAX: 5,

  /** Price of each space level in Gym Bucks, level 1 first. Strictly increasing. */
  SPACE_LEVEL_COST_GYM_BUCKS: Object.freeze([800, 3200, 12000, 40000, 120000] as const),

  /**
   * GDD §5.4's "raises passive ceiling", by space level, level 0 first. Index 0
   * is 1 because it is the baseline. Length is `SPACE_LEVEL_MAX` plus the
   * baseline, which `empireTuning.test.ts` re-derives rather than trusting.
   */
  SPACE_PASSIVE_CEILING_MULTIPLIER: Object.freeze([1, 1.3, 1.7, 2.2, 2.8, 3.5] as const),

  /**
   * GDD §5.4's staff roles: "Coaches, spotters, physio". Structural — each has
   * its own effect below and adding a fourth is a design change.
   */
  STAFF_ROLES: Object.freeze(['coach', 'spotter', 'physio'] as const),

  /**
   * Highest level per staff role. Physio stops at 1 for a reason that is not
   * balance: see `PHYSIO_MAX_DAYS_SAVED`.
   */
  STAFF_LEVEL_MAX: Object.freeze({ coach: 4, spotter: 4, physio: 1 }),

  /** Price of each staff level in Gym Bucks, level 1 first, per role. */
  STAFF_LEVEL_COST_GYM_BUCKS: Object.freeze({
    coach: Object.freeze([1200, 4800, 16000, 52000] as const),
    spotter: Object.freeze([1000, 4000, 13000, 42000] as const),
    physio: Object.freeze([6000] as const),
  }),

  /**
   * Gym Bucks multiplier a coach adds per level, as a fraction.
   *
   * A coach pays Bucks and not Training IQ, and that is a §8.1 decision rather
   * than a flavour one: staff levels are bought and their build timers are
   * skippable, so a coach paying IQ would be a purchase reaching training pace
   * in two hops.
   */
  STAFF_COACH_BUCKS_MULTIPLIER_PER_LEVEL: 0.12,

  /**
   * Days of Sim setback a physio removes, per physio level. GDD §5.4: "Physio
   * reduces Sim injury duration".
   *
   * A refusal-condition constant, on three counts, and the reason it is not a
   * knob is measured rather than argued:
   *
   *   1. `src/game/fatigue.ts` refuses a `physioDaysSaved` that is not a whole
   *      number at or above zero, so a fractional value here throws at the
   *      seam rather than rounding.
   *   2. The hook may shorten and must not erase. `fatigue.ts` clamps at
   *      `INJURY_MIN_DURATION_DAYS_AFTER_PHYSIO`, and that clamp is the second
   *      line here rather than the first: this table is bounded against the
   *      SHORTEST setback the fatigue model can roll, so the shortest setback
   *      lands at or above the floor without the clamp having to catch it.
   *   3. Injury duration is training pace by another name, so a purchased
   *      staff-build skip that made physio arrive sooner would sell training
   *      pace in two hops. That path is closed in `empireCore.ts` by the clock
   *      split, not by this number — but turning this number up is how someone
   *      would make the closed path worth attacking.
   */
  PHYSIO_DAYS_SAVED_PER_STAFF_LEVEL: 1,

  /**
   * Ceiling on days saved across every physio level combined.
   *
   * Bounded against `FATIGUE_TUNING` by `empireTuning.test.ts`, which imports
   * the real block, and bounded against the SHORTEST setback rather than the
   * longest: at `INJURY_DURATION_DAYS_MIN` minus
   * `INJURY_MIN_DURATION_DAYS_AFTER_PHYSIO` the empire never asks the fatigue
   * model to clamp, so the clamp stays a second line instead of being the
   * thing that keeps a setback from vanishing. It may also not be zero,
   * because a hook that saves nothing is dead content dressed as a cross-mode
   * feature. Both directions are pinned, so this entry is red if either side
   * moves — which is what forces `STAFF_LEVEL_MAX.physio` down to one level
   * at the shipped fatigue tuning.
   */
  PHYSIO_MAX_DAYS_SAVED: 1,

  /** The reputation scale's top. Every threshold in this file must fit under it. */
  REPUTATION_MAX: 5000,

  /** Reputation earned per check-in. GDD §5.1 makes the check-in the loop. */
  REPUTATION_PER_CHECK_IN: 2,

  /** Reputation earned per roster lifter per day of tenure. */
  REPUTATION_PER_NPC_TENURE_DAY: 0.5,

  /**
   * Reputation tier boundaries, lowest first. Index 0 is 0 so a new gym is in
   * tier 0 rather than in no tier, and the top boundary is `REPUTATION_MAX` so
   * the scale ends where the tiers do.
   */
  REPUTATION_TIER_THRESHOLDS: Object.freeze([0, 250, 1000, 2500, 5000] as const),

  /**
   * GDD §5.4's "sponsorships ... Sponsor money feeds Career economy", per day,
   * by reputation tier index.
   *
   * Denominated in Gym Bucks and in nothing else. A sponsor may not pay Chalk
   * here: Chalk buys GDD §8.3E Extra Covered Days, empire income is keyed to
   * the check-in and is therefore training-gated in the §4.4 sense, and a
   * training-gated route into coverage is the laundered path that section
   * traces. `empireCore.ts` makes Chalk something the empire has no word for
   * rather than something it happens not to pay.
   */
  SPONSOR_GYM_BUCKS_PER_DAY_BY_REPUTATION_TIER: Object.freeze([0, 250, 900, 2600, 7000] as const),

  /** Seconds the first level of any axis takes to build. */
  BUILD_SECONDS_BASE: 120,

  /** Multiplier on the build time for each level above the first. */
  BUILD_SECONDS_GROWTH_PER_LEVEL: 2.4,

  /**
   * Ceiling on any one build timer, in seconds.
   *
   * A budget, and currently slack — the longest timer the tables above can
   * produce is well under it, so it never binds today. It stays as a guard in
   * the same spirit as `FATIGUE_TUNING.INJURY_MAX_CHANCE_PER_SESSION`: a tuner
   * who raises the growth rate should not be able to ship a day-long wait by
   * accident. `empireTuning.test.ts` re-derives the longest timer and fails if
   * this ever drops under it, so the guard cannot silently start truncating
   * the ladder instead of guarding it.
   */
  BUILD_SECONDS_MAX: 86400,

  /**
   * Seconds one GDD §8.3B timer-skip grant removes from a running timer.
   *
   * A knob on the convenience, and the value that makes the §8.1 question
   * concrete. What it may accelerate is decided in `empireCore.ts` by a type,
   * not here by a magnitude: an accelerant declares how it arrived, an output
   * declares what it feeds, and a purchased accelerant applied to an output
   * that feeds training pace does not compile.
   */
  TIMER_SKIP_SECONDS_PER_GRANT: 3600,

  // -------------------------------------------------------------------------
  // §5.5 Social layer
  //
  // "Gym leaderboards (regional / global) by reputation or combined lifter
  // totals. Visit friends' gyms — browse, leave encouragement. Weekly rival gym
  // comparison (AI or real player), small reward for beating them."
  // -------------------------------------------------------------------------

  /** The two leaderboard scopes GDD §5.5 names. Structural: a scope is a screen. */
  LEADERBOARD_SCOPES: Object.freeze(['regional', 'global'] as const),

  /**
   * How many gyms one bracket holds, per scope. Both are above 1 — a bracket
   * of one is a mirror, not a leaderboard — and `empireTuning.test.ts` pins
   * that rather than leaving it to this sentence.
   */
  LEADERBOARD_BRACKET_SIZE: Object.freeze({ regional: 50, global: 100 }),

  /**
   * The rival comparison period, in calendar days. GDD §5.5 says weekly, and
   * the unit is the point rather than the magnitude.
   *
   * A refusal-condition constant, and the refusal is about the unit. GDD §8.3C
   * measured this exact shape on the streak mechanic: a reward keyed to a
   * fixed calendar period gives 0 violating pairs, one keyed to session count
   * gives 1156 at 100 days, one keyed to streak length gives 54. So a period
   * counted in days is safe because both members of a monotonicity pair reach
   * it on the same day whatever their training did, and the same period
   * counted in sessions, streak days or unlocked tiers is the defect GDD §4.4
   * traces. A playtester may make it ten days. Nobody may make it ten
   * sessions.
   */
  RIVAL_COMPARISON_PERIOD_DAYS: 7,

  /**
   * GDD §5.5's "small reward for beating them", in Gym Bucks.
   *
   * Denominated in Gym Bucks for the reason
   * `SPONSOR_GYM_BUCKS_PER_DAY_BY_REPUTATION_TIER` gives, and it matters more
   * here: this payout is keyed to an outcome rather than to a date, so if it
   * were denominated in anything that funds coverage it would be a
   * player-moved arrival day for a covered day. Gym Bucks buy cosmetics, decor
   * and the expansion axes above, and no path exists from them to a §8.3E
   * purchase.
   */
  RIVAL_REWARD_GYM_BUCKS: 2500,

  /** Friend gyms one player may visit per day. GDD §5.5: browse and encourage. */
  FRIEND_VISITS_PER_DAY: 10,

  /** Gym Bucks the visited gym's owner receives per encouragement. */
  ENCOURAGEMENT_REWARD_GYM_BUCKS: 50,

  // -------------------------------------------------------------------------
  // §5 (v2) stage 1 — the ladder. Read by `ladder.ts` and by nothing else.
  //
  // GDD §5.11's first stage: four rungs, one-way relocation, money under the
  // aggregate offline cap, and one equipment group (Barbell — §5.4's
  // competition-lift group). The v1 entries above keep their consumers until
  // the stage that replaces them lands; nothing below is read by a v1 module.
  //
  // Stage-1 scope note, so nobody adds the missing §5.4 numbers here early:
  // member appeal and condition are stages 3-4 and have no consumer yet, so
  // they are deliberately absent rather than parked as dead knobs.
  // -------------------------------------------------------------------------

  /**
   * GDD §5.1's ladder, bottom rung first, verbatim from its table: Garage ->
   * Storage Unit -> Strip-Mall Unit -> Warehouse.
   *
   * Structural: the order is the ladder, exactly as `NPC_TIERS` above. The
   * ladder is linear and one-way — `ladder.ts` encodes that by holding ONE
   * rung in state, so two phase-1 locations are unrepresentable rather than
   * merely unvisited.
   */
  LADDER_RUNGS: Object.freeze([
    'garage',
    'storage-unit',
    'strip-mall-unit',
    'warehouse',
  ] as const),

  /**
   * The shown cost of relocating TO each rung above the first, in Gym Bucks.
   *
   * Keyed by destination — the garage is where the game opens and is not a
   * destination, which is why it has no row rather than a zero. Relocation is
   * a player decision with this cost shown before it is charged (§5.7's rule
   * applied at stage 1: nothing here moves on elapsed time).
   */
  LADDER_MOVE_COST_GYM_BUCKS: Object.freeze({
    'storage-unit': 2500,
    'strip-mall-unit': 18000,
    warehouse: 120000,
  }),

  /**
   * Gym Bucks per hour a location produces at each rung, before the offline
   * model discounts a gap.
   *
   * A rate, in the same class as `GYM_BUCKS_BASE_PER_HOUR`. The garage row is
   * small but positive on purpose: §5.1's table says "No members. Nobody knows
   * you.", and a literal zero would make the first move unaffordable forever —
   * read it as the first few informal clients, and treat the magnitude as an
   * untuned placeholder for the stage gate to judge. `ladder.ts` accrues from
   * a SUM of these so stage 4's portfolio changes the input, not the
   * mechanism (GDD §5.10).
   */
  LADDER_INCOME_GYM_BUCKS_PER_HOUR: Object.freeze({
    garage: 60,
    'storage-unit': 240,
    'strip-mall-unit': 900,
    warehouse: 3000,
  }),

  /**
   * The three competition lifts, in meet order (GDD §6.2: squat -> bench ->
   * deadlift). Structural — capability reporting is stated in this order.
   */
  LADDER_LIFTS: Object.freeze(['squat', 'bench', 'deadlift'] as const),

  /**
   * Stage 1's one equipment group: §5.4's Barbell row, as generic nouns. No
   * manufacturer, no brand, no wordmark — the §12.3 rule, and the same
   * vocabulary discipline as `EQUIPMENT_TIERS` above.
   *
   * Four items and not the whole §5.4 example list, because stage 1 uses cost
   * and a capability flag only: an item that gates no lift and carries no
   * member-appeal number yet would be dead content. The monolift and the
   * platform arrive with the stages that give improvement and appeal meaning.
   */
  LADDER_EQUIPMENT_ITEMS: Object.freeze([
    'power-bar',
    'comp-plates',
    'flat-bench',
    'squat-rack',
  ] as const),

  /**
   * What the garage opens with — §5.1's "A bar, some plates, a bench."
   * Structural; must be a subset of `LADDER_EQUIPMENT_ITEMS`.
   */
  LADDER_STARTING_EQUIPMENT: Object.freeze(['power-bar', 'comp-plates', 'flat-bench'] as const),

  /**
   * Flat price of each item in Gym Bucks. Flat and published, like every price
   * in this file — no draw, no roll. The three starting items carry prices so
   * a hand-built state without one prices the buy-back; the rack is the one
   * stage-1 decision money and capability compete over.
   */
  LADDER_EQUIPMENT_COST_GYM_BUCKS: Object.freeze({
    'power-bar': 350,
    'comp-plates': 700,
    'flat-bench': 250,
    'squat-rack': 1500,
  }),

  /**
   * The lowest rung at which each item fits in the space, keyed by item.
   *
   * Structural, from §5.1's own feel column: the garage holds a bar, plates
   * and a bench; "Space for a rack" is the Storage Unit's line, so the rack
   * needs rung 2. This is what makes moving up a capability decision and not
   * only an income one.
   */
  LADDER_EQUIPMENT_MIN_RUNG: Object.freeze({
    'power-bar': 'garage',
    'comp-plates': 'garage',
    'flat-bench': 'garage',
    'squat-rack': 'storage-unit',
  }),

  /**
   * Which items each competition lift needs before it is available — §5.4's
   * "capability gates activity", at stage-1 resolution (a flag, not a grade).
   *
   * Structural. Squat needs the rack, bench needs the bench, deadlift is bar
   * and plates off the floor; so a fresh garage benches and deadlifts, and
   * squats only after the move and the rack — which is the stage-1 tension.
   */
  LADDER_LIFT_REQUIREMENTS: Object.freeze({
    squat: Object.freeze(['power-bar', 'comp-plates', 'squat-rack'] as const),
    bench: Object.freeze(['power-bar', 'comp-plates', 'flat-bench'] as const),
    deadlift: Object.freeze(['power-bar', 'comp-plates'] as const),
  }),

  /**
   * The dev-only time steps of the stage-1 ladder view, in seconds: one hour,
   * eight hours, three days. `ladder.ts`'s `ladderDevTimeSteps` labels them and
   * `ladderView.tsx`'s visibly-marked dev control feeds them to the shipped
   * accrual functions, so the §5.11 stage-gate human can feel the pacing
   * without waiting a real week. Each step must be a positive whole multiple
   * of `TICK_SECONDS`, which `ladderDevTimeSteps` refuses loudly rather than
   * trusting. Knobs: the gate's open question is the income magnitudes, and
   * the sampling grain a human judges them at is tuned with the same hand.
   */
  LADDER_DEV_TIME_STEPS_SECONDS: Object.freeze([3600, 28800, 259200] as const),

  // -------------------------------------------------------------------------
  // §5 (v2) stage 2 — sessions and equipment groups. Read by `sessions.ts`.
  //
  // GDD §5.11's second stage: the remaining §5.4 equipment groups
  // (Conditioning, Recovery, Accessory, Support), §5.5's sessions model (four
  // powerlifting sessions fixed and guaranteed, three flexible sessions
  // allocated), and the attribute effects as pure outputs. Each item below
  // carries COST and CAPABILITY only — §5.4's member-appeal number and the
  // condition number are stages 3 and 4, and parking them here now would be
  // dead knobs with no consumer, the exact thing the stage-1 scope note above
  // refuses.
  //
  // THE DESIGN TARGET THESE PRICES SERVE, from the stage-1 gate record: the
  // strip-mall -> warehouse stretch (income 900/h, relocation 120 000) was
  // measured at ~38 pure-collection check-ins after the rack, and the human
  // ruled the cost stays and stage 2 fills the gap. So most items here have
  // `strip-mall-unit` as their lowest rung and prices spread from 2 400 to
  // 28 000: at the gate's own twice-daily cadence the strip-mall rung banks
  // 10 800 Gym Bucks a day (12 h banked per gap, halved by
  // `OFFLINE_EARNINGS_FRACTION`), so under an eager buyer a purchase lands
  // roughly every one to three days across the stretch instead of none, and
  // every arrival re-opens the weekly allocation question because a new group
  // unlocks a new activity. `sessions.test.ts` pins the resulting purchase-day
  // list at that cadence rather than trusting this sentence. All magnitudes
  // are untuned placeholders in the sense the header of this file states.
  // -------------------------------------------------------------------------

  /**
   * The remaining §5.4 equipment groups, verbatim from its table. Stage 1's
   * Barbell group lives on the ladder (`LADDER_EQUIPMENT_ITEMS`); these four
   * are the groups the flexible sessions draw on. Structural: a group is a
   * capability gate, and adding one is a design change.
   */
  SESSION_ACTIVITY_GROUPS: Object.freeze([
    'conditioning',
    'accessory',
    'recovery',
    'support',
  ] as const),

  /**
   * Every stage-2 item, in the fixed order state lists them in. Generic
   * equipment nouns taken from GDD §5.4's own example rows — no manufacturer,
   * no brand, no wordmark (§12.3), same discipline as `EQUIPMENT_TIERS`.
   *
   * §5.4's "chalk bowl" example is deliberately NOT shipped, and the reason is
   * structural rather than taste: `EMPIRE_FORBIDDEN_OUTPUTS` names `'chalk'`
   * as a currency this directory must have no word for, and instrument B in
   * `empireForbiddenOutput.test.ts` refuses any produced string CONTAINING a
   * forbidden name — an item token carrying the currency's name inside it is
   * exactly the laundering shape that containment scan exists to stop, and it
   * caught this one on arrival (76 findings). Wrist wraps are the same
   * generic support-gear class and carry no banned substring.
   */
  SESSION_EQUIPMENT_ITEMS: Object.freeze([
    'bike',
    'treadmill',
    'rower',
    'sled',
    'dumbbells',
    'cables',
    'machines',
    'mats',
    'foam-rollers',
    'sauna',
    'wrist-wraps',
    'belts',
    'sleeves',
    'specialty-bars',
  ] as const),

  /** Which §5.4 group each item belongs to. Structural: the gate reads it. */
  SESSION_EQUIPMENT_GROUP: Object.freeze({
    bike: 'conditioning',
    treadmill: 'conditioning',
    rower: 'conditioning',
    sled: 'conditioning',
    dumbbells: 'accessory',
    cables: 'accessory',
    machines: 'accessory',
    mats: 'recovery',
    'foam-rollers': 'recovery',
    sauna: 'recovery',
    'wrist-wraps': 'support',
    belts: 'support',
    sleeves: 'support',
    'specialty-bars': 'support',
  }),

  /**
   * Flat published price per item in Gym Bucks — no draw, no roll, like every
   * price in this file. The band note at the top of this section is the
   * pricing argument; the strip-mall rows are the stage-2 decisions the gate
   * asked for, and the two garage rows plus four storage rows give the earlier
   * rungs one small decision each without eating the jump-3 band.
   */
  SESSION_EQUIPMENT_COST_GYM_BUCKS: Object.freeze({
    bike: 1600,
    treadmill: 6500,
    rower: 12000,
    sled: 18000,
    dumbbells: 1200,
    cables: 9000,
    machines: 22000,
    mats: 200,
    'foam-rollers': 500,
    sauna: 28000,
    'wrist-wraps': 400,
    belts: 900,
    sleeves: 2400,
    'specialty-bars': 16000,
  }),

  /**
   * The lowest rung whose space fits each item, same reading as
   * `LADDER_EQUIPMENT_MIN_RUNG`: mats and a chalk bowl fit anywhere, a bike or
   * dumbbells need the storage unit's room, the big machines need a real
   * address, and a sled track needs the warehouse floor. Structural — this
   * table is what makes moving up a capability decision.
   */
  SESSION_EQUIPMENT_MIN_RUNG: Object.freeze({
    bike: 'storage-unit',
    treadmill: 'strip-mall-unit',
    rower: 'strip-mall-unit',
    sled: 'warehouse',
    dumbbells: 'storage-unit',
    cables: 'strip-mall-unit',
    machines: 'strip-mall-unit',
    mats: 'garage',
    'foam-rollers': 'storage-unit',
    sauna: 'strip-mall-unit',
    'wrist-wraps': 'garage',
    belts: 'storage-unit',
    sleeves: 'strip-mall-unit',
    'specialty-bars': 'strip-mall-unit',
  }),

  /**
   * Capability grade per activity-group item — §5.4's "what it unlocks or
   * improves" at stage-2 resolution. The first item of a group unlocks its
   * activity; every item's grade adds to how much a session of that activity
   * moves the attribute outputs, so the second and third item of a group are
   * real purchases rather than dead stock. Support items are deliberately
   * absent: they are modifiers, and their tables are the two below.
   */
  SESSION_EQUIPMENT_CAPABILITY: Object.freeze({
    bike: 1,
    treadmill: 1,
    rower: 1.5,
    sled: 2,
    dumbbells: 1,
    cables: 1.5,
    machines: 2,
    mats: 1,
    'foam-rollers': 1,
    sauna: 2,
  }),

  /**
   * §5.4's Support row: "Modifiers to the above". Which attribute channel each
   * support item amplifies. A support item never generates an effect on its
   * own — it multiplies what the sessions earned, so a belt with zero
   * stretching sessions behind it moves nothing, which `sessions.test.ts`
   * drives rather than trusts. Structural: the channel is the design.
   */
  SUPPORT_ITEM_CHANNEL: Object.freeze({
    'wrist-wraps': 'technique-quality',
    belts: 'injury-risk',
    sleeves: 'injury-risk',
    'specialty-bars': 'ceiling-growth',
  }),

  /**
   * How much each support item amplifies its channel's earned effect, as a
   * fraction added to the multiplier (0.12 reads: the earned reduction or
   * bonus is 12% larger while the item is owned).
   */
  SUPPORT_ITEM_AMPLIFIER: Object.freeze({
    'wrist-wraps': 0.15,
    belts: 0.12,
    sleeves: 0.08,
    'specialty-bars': 0.2,
  }),

  /**
   * §5.5's guaranteed base: "Four powerlifting sessions per week are fixed and
   * guaranteed — they do not compete with anything else for a slot."
   *
   * A budget, and one with a structural echo: `sessions.ts` gives the week
   * type NO field for these — `WeekAllocation` is a tuple of exactly the
   * flexible slots — so reallocating a powerlifting session has no spelling in
   * the type at all. This number exists so the guarantee is a value a screen
   * can print and a test can sum to §5.5's "7 total", not so anything can
   * allocate against it.
   */
  FIXED_POWERLIFTING_SESSIONS_PER_WEEK: 4,

  /**
   * §5.5's real choice: "the player allocates 3 additional sessions per week".
   *
   * A budget. The `WeekAllocation` tuple in `sessions.ts` has exactly this
   * many slots, and `sessions.test.ts` pins that the type and this number
   * agree — so turning it is a design change that fails loudly until the type
   * moves with it, not a tuning pass.
   */
  FLEXIBLE_SESSIONS_PER_WEEK: 3,

  /**
   * Days in a training week. Structural arithmetic like `SECONDS_PER_DAY`; it
   * is also the §5.5 sentence "7 total, matching a real training week" — the
   * fixed four plus the flexible three fill one session per day.
   */
  DAYS_PER_TRAINING_WEEK: 7,

  /**
   * §5.5's flexible activities, verbatim from its table (stretching and yoga
   * share a row there and share a slot kind here). Structural: each is an
   * attribute channel and a capability gate.
   */
  FLEXIBLE_ACTIVITIES: Object.freeze([
    'cardio',
    'hypertrophy',
    'stretching-yoga',
    'other-recovery',
  ] as const),

  /**
   * Which equipment group each activity requires — §5.4/§5.5's "capability
   * gates activity". `other-recovery` needs the recovery group AND one of
   * `ADVANCED_RECOVERY_ITEMS` (§5.5: "Recovery equipment, higher tiers").
   */
  SESSION_ACTIVITY_EQUIPMENT_GROUP: Object.freeze({
    cardio: 'conditioning',
    hypertrophy: 'accessory',
    'stretching-yoga': 'recovery',
    'other-recovery': 'recovery',
  }),

  /**
   * The higher-tier recovery items §5.5's fourth row asks for. Structural, and
   * required by `sessions.test.ts` to be a subset of the recovery group.
   */
  ADVANCED_RECOVERY_ITEMS: Object.freeze(['sauna'] as const),

  /**
   * How much one cardio session, per point of conditioning grade, shrinks the
   * fraction of fatigue residual that survives a night. A rate in multiplier
   * space; the floor it accumulates towards is
   * `RESIDUAL_CARRY_MULTIPLIER_FLOOR`.
   */
  CARDIO_RESIDUAL_CARRY_REDUCTION_PER_GRADE_SESSION: 0.015,

  /**
   * The same channel's slower sibling for `other-recovery` — §5.5 marks that
   * row "Compounding, slower effects — detail TBD", so stage 2 gives it a
   * smaller contribution to the same recovery-rate channel and leaves the TBD
   * detail to the stage that designs it.
   */
  OTHER_RECOVERY_RESIDUAL_CARRY_REDUCTION_PER_GRADE_SESSION: 0.008,

  /**
   * The lowest the residual-carry multiplier may go, however the sessions and
   * grades multiply out. A budget guard in the `BUILD_SECONDS_MAX` spirit:
   * slack at the shipped values (the best reachable build lands above it,
   * which `sessions.test.ts` re-derives), present so a tuner turning the rate
   * up cannot ship a build where sleep stops mattering.
   */
  RESIDUAL_CARRY_MULTIPLIER_FLOOR: 0.7,

  /**
   * How much one stretching/yoga session, per point of recovery grade, shrinks
   * the per-session injury chance, as a fraction of it removed.
   */
  STRETCHING_INJURY_REDUCTION_PER_GRADE_SESSION: 0.025,

  /**
   * The lowest the injury-chance multiplier may go. A budget guard, slack at
   * the shipped values and re-derived by test: allocation may shrink injury
   * risk and may not erase it — an injury that cannot happen makes the
   * fatigue model's whole injury arm dead content, the same one-directional
   * rule `PHYSIO_MAX_DAYS_SAVED` states for duration.
   */
  INJURY_CHANCE_MULTIPLIER_FLOOR: 0.6,

  /**
   * Technique quality earned per stretching/yoga session per point of recovery
   * grade — §5.5's "improves technique quality at depth", as an additive bonus
   * the meet-day depth check can consume through the seam contract.
   */
  STRETCHING_TECHNIQUE_BONUS_PER_GRADE_SESSION: 0.012,

  /** Ceiling on the technique bonus. A budget guard, slack at shipped values. */
  TECHNIQUE_QUALITY_BONUS_MAX: 0.2,

  /**
   * e1RM-ceiling growth per hypertrophy session per point of accessory grade,
   * as a fraction of the ceiling per week. §5.5 asks for "Slow, compounding":
   * the weekly value compounds multiplicatively across weeks in
   * `composedCeilingGrowth`, and the fully built, fully allocated week earns
   * about 0.29% — noticeable over a training block, invisible in a session.
   */
  HYPERTROPHY_CEILING_GROWTH_PER_GRADE_SESSION: 0.00015,

  /** Ceiling on one week's ceiling growth. A budget guard, slack as shipped. */
  CEILING_GROWTH_PER_WEEK_MAX: 0.003,

  // -------------------------------------------------------------------------
  // §5.13 presentation Phase 1 — the floor grid and placement. Read by
  // `floor.ts`. GDD §5.13's build order step 1: "Grid + placement alone. No
  // members, no final art." Nobody has played this — GDD §5.13's own
  // grounding check states both tables below are first-pass proposals,
  // reasoned from real-world footprint intuition and NOT tuned. Units are
  // abstract grid tiles, not a literal foot conversion.
  // -------------------------------------------------------------------------

  /**
   * The floor grid a player builds into at each ladder rung, width x height
   * in tiles — GDD §5.13's own proposal, reasoned from real-world footprint
   * intuition and scaled to the equipment cumulatively unlockable by that
   * rung: garage 8x6, storage-unit 12x9, strip-mall-unit 22x16, warehouse
   * 40x28. Keyed by exactly `LADDER_RUNGS`; `floor.test.ts` drives both
   * directions.
   */
  FLOOR_GRID_SIZE: Object.freeze({
    garage: Object.freeze({ width: 8, height: 6 }),
    'storage-unit': Object.freeze({ width: 12, height: 9 }),
    'strip-mall-unit': Object.freeze({ width: 22, height: 16 }),
    warehouse: Object.freeze({ width: 40, height: 28 }),
  }),

  /**
   * Each stage-2 item's footprint on the floor, width x height in tiles — a
   * first-pass proposal grounded in real-world size intuition ("a mat is
   * small and flat, a sauna or a sled track needs real room"), not tuned or
   * played. Keyed by exactly `SESSION_EQUIPMENT_ITEMS`; `floor.test.ts`
   * drives both directions and also drives that every footprint fits inside
   * the grid of the item's own `SESSION_EQUIPMENT_MIN_RUNG` rather than
   * trusting this prose.
   */
  SESSION_EQUIPMENT_FOOTPRINT: Object.freeze({
    bike: Object.freeze({ width: 2, height: 2 }),
    treadmill: Object.freeze({ width: 2, height: 4 }),
    rower: Object.freeze({ width: 2, height: 5 }),
    sled: Object.freeze({ width: 3, height: 12 }),
    dumbbells: Object.freeze({ width: 3, height: 2 }),
    cables: Object.freeze({ width: 2, height: 3 }),
    machines: Object.freeze({ width: 3, height: 3 }),
    mats: Object.freeze({ width: 3, height: 3 }),
    'foam-rollers': Object.freeze({ width: 1, height: 1 }),
    sauna: Object.freeze({ width: 4, height: 4 }),
    'wrist-wraps': Object.freeze({ width: 1, height: 1 }),
    belts: Object.freeze({ width: 1, height: 1 }),
    sleeves: Object.freeze({ width: 1, height: 1 }),
    'specialty-bars': Object.freeze({ width: 1, height: 3 }),
  }),

  /**
   * Pixels per grid tile the floor renders at — a rendering/legibility knob,
   * not game math, but a felt one (spacing, tap-target size, how fiddly a
   * drag reads), so it lives here rather than as a magic number in
   * `FloorGrid.tsx`. Read by `FloorGrid.tsx` only.
   */
  FLOOR_TILE_PIXELS: 28,

  /** Border thickness, in pixels, of the floor grid's own outer frame. Read by `FloorGrid.tsx` only. */
  FLOOR_GRID_BORDER_WIDTH_PIXELS: 1,

  /** Border thickness, in pixels, around every placed or tray equipment chip. Read by `FloorGrid.tsx` only. */
  FLOOR_ITEM_BORDER_WIDTH_PIXELS: 2,

  /** Gap, in pixels, between adjacent chips in the unplaced-equipment tray. Read by `FloorGrid.tsx` only. */
  FLOOR_TRAY_ITEM_MARGIN_PIXELS: 4,

  /** Stacking order an in-flight drag renders at, above every resting chip. Read by `FloorGrid.tsx` only. */
  FLOOR_DRAGGING_Z_INDEX: 10,

  /**
   * The smallest a tray chip is ever drawn, in tiles, for an item whose real
   * footprint is smaller than this on one or both axes (support items are
   * mostly 1x1) — a legibility floor so a tray chip stays a real tap target,
   * never the item's real placed size. Read by `FloorGrid.tsx` only.
   */
  FLOOR_TRAY_ITEM_MIN_TILES: 2,
} satisfies EmpireTuningRecord);

/**
 * The class of every entry above, as a value a test can walk.
 *
 * Total by `satisfies`, so an entry added to `EMPIRE_TUNING` without a class
 * is a compile error rather than an unclassified number in a file whose whole
 * job is that there are none of those.
 */
export const EMPIRE_TUNING_CLASSIFICATION = Object.freeze({
  SECONDS_PER_HOUR: 'structural',
  SECONDS_PER_DAY: 'structural',
  PRECISION_DECIMALS: 'structural',

  TICK_SECONDS: 'structural',
  CHECK_IN_TARGET_SECONDS_MIN: 'budget',
  CHECK_IN_TARGET_SECONDS_MAX: 'budget',
  OFFLINE_EARNINGS_NO_PUNISH_HOURS: 'budget',
  OFFLINE_EARNINGS_CAP_HOURS: 'knob',
  OFFLINE_EARNINGS_FRACTION: 'knob',

  GYM_BUCKS_BASE_PER_HOUR: 'knob',
  NPC_GYM_BUCKS_PER_HOUR_BASE: 'knob',
  TRAINING_IQ_BASE_PER_DAY: 'knob',
  NPC_TRAINING_IQ_PER_DAY_BASE: 'knob',
  TRAINING_IQ_DAILY_CEILING: 'budget',

  NPC_TIERS: 'structural',
  NPC_TIER_OUTPUT_MULTIPLIER: 'knob',
  NPC_RECRUIT_COST_GYM_BUCKS: 'knob',
  NPC_RECRUIT_REPUTATION_THRESHOLD: 'knob',
  NPC_RECRUIT_SECONDS: 'knob',
  NPC_TENURE_DAYS_TO_FULL_LOYALTY: 'knob',
  NPC_LOYALTY_MIN_MULTIPLIER: 'knob',
  NPC_LOYALTY_MAX_MULTIPLIER: 'knob',
  NPC_LOYALTY_CURVE_EXPONENT: 'knob',
  ROSTER_SLOTS_BASE: 'knob',
  ROSTER_SLOTS_PER_SPACE_LEVEL: 'knob',
  ROSTER_SLOTS_PER_SPOTTER_LEVEL: 'knob',
  ROSTER_SLOTS_MAX: 'budget',

  EQUIPMENT_TIERS: 'structural',
  EQUIPMENT_TIER_COST_GYM_BUCKS: 'knob',
  EQUIPMENT_TIER_BUCKS_MULTIPLIER: 'knob',
  SPACE_LEVEL_MAX: 'budget',
  SPACE_LEVEL_COST_GYM_BUCKS: 'knob',
  SPACE_PASSIVE_CEILING_MULTIPLIER: 'knob',
  STAFF_ROLES: 'structural',
  STAFF_LEVEL_MAX: 'budget',
  STAFF_LEVEL_COST_GYM_BUCKS: 'knob',
  STAFF_COACH_BUCKS_MULTIPLIER_PER_LEVEL: 'knob',
  PHYSIO_DAYS_SAVED_PER_STAFF_LEVEL: 'refusal',
  PHYSIO_MAX_DAYS_SAVED: 'refusal',
  REPUTATION_MAX: 'budget',
  REPUTATION_PER_CHECK_IN: 'knob',
  REPUTATION_PER_NPC_TENURE_DAY: 'knob',
  REPUTATION_TIER_THRESHOLDS: 'knob',
  SPONSOR_GYM_BUCKS_PER_DAY_BY_REPUTATION_TIER: 'knob',
  BUILD_SECONDS_BASE: 'knob',
  BUILD_SECONDS_GROWTH_PER_LEVEL: 'knob',
  BUILD_SECONDS_MAX: 'budget',
  TIMER_SKIP_SECONDS_PER_GRANT: 'knob',

  LEADERBOARD_SCOPES: 'structural',
  LEADERBOARD_BRACKET_SIZE: 'knob',
  RIVAL_COMPARISON_PERIOD_DAYS: 'refusal',
  RIVAL_REWARD_GYM_BUCKS: 'knob',
  FRIEND_VISITS_PER_DAY: 'knob',
  ENCOURAGEMENT_REWARD_GYM_BUCKS: 'knob',

  LADDER_RUNGS: 'structural',
  LADDER_MOVE_COST_GYM_BUCKS: 'knob',
  LADDER_INCOME_GYM_BUCKS_PER_HOUR: 'knob',
  LADDER_LIFTS: 'structural',
  LADDER_EQUIPMENT_ITEMS: 'structural',
  LADDER_STARTING_EQUIPMENT: 'structural',
  LADDER_EQUIPMENT_COST_GYM_BUCKS: 'knob',
  LADDER_EQUIPMENT_MIN_RUNG: 'structural',
  LADDER_LIFT_REQUIREMENTS: 'structural',
  LADDER_DEV_TIME_STEPS_SECONDS: 'knob',

  SESSION_ACTIVITY_GROUPS: 'structural',
  SESSION_EQUIPMENT_ITEMS: 'structural',
  SESSION_EQUIPMENT_GROUP: 'structural',
  SESSION_EQUIPMENT_COST_GYM_BUCKS: 'knob',
  SESSION_EQUIPMENT_MIN_RUNG: 'structural',
  SESSION_EQUIPMENT_CAPABILITY: 'knob',
  SUPPORT_ITEM_CHANNEL: 'structural',
  SUPPORT_ITEM_AMPLIFIER: 'knob',
  FIXED_POWERLIFTING_SESSIONS_PER_WEEK: 'budget',
  FLEXIBLE_SESSIONS_PER_WEEK: 'budget',
  DAYS_PER_TRAINING_WEEK: 'structural',
  FLEXIBLE_ACTIVITIES: 'structural',
  SESSION_ACTIVITY_EQUIPMENT_GROUP: 'structural',
  ADVANCED_RECOVERY_ITEMS: 'structural',
  CARDIO_RESIDUAL_CARRY_REDUCTION_PER_GRADE_SESSION: 'knob',
  OTHER_RECOVERY_RESIDUAL_CARRY_REDUCTION_PER_GRADE_SESSION: 'knob',
  RESIDUAL_CARRY_MULTIPLIER_FLOOR: 'budget',
  STRETCHING_INJURY_REDUCTION_PER_GRADE_SESSION: 'knob',
  INJURY_CHANCE_MULTIPLIER_FLOOR: 'budget',
  STRETCHING_TECHNIQUE_BONUS_PER_GRADE_SESSION: 'knob',
  TECHNIQUE_QUALITY_BONUS_MAX: 'budget',
  HYPERTROPHY_CEILING_GROWTH_PER_GRADE_SESSION: 'knob',
  CEILING_GROWTH_PER_WEEK_MAX: 'budget',

  FLOOR_GRID_SIZE: 'knob',
  SESSION_EQUIPMENT_FOOTPRINT: 'knob',
  FLOOR_TILE_PIXELS: 'knob',
  FLOOR_GRID_BORDER_WIDTH_PIXELS: 'knob',
  FLOOR_ITEM_BORDER_WIDTH_PIXELS: 'knob',
  FLOOR_TRAY_ITEM_MARGIN_PIXELS: 'knob',
  FLOOR_DRAGGING_Z_INDEX: 'knob',
  FLOOR_TRAY_ITEM_MIN_TILES: 'knob',
} as const satisfies Readonly<Record<keyof typeof EMPIRE_TUNING, EmpireTuningClass>>);
