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

  /** Seconds in a minute. Arithmetic, not a knob. Used to label the 30-minute watched QA step. */
  SECONDS_PER_MINUTE: 60,

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
   * `Date.now()` is milliseconds; every real-time-derived gap in
   * `src/shell/AppShell.tsx`'s `GymHost` divides or multiplies by this to
   * move between milliseconds and seconds. Structural, not a knob — this is
   * a units conversion, not a game-feel value, and it has one correct value.
   */
  MILLISECONDS_PER_SECOND: 1000,

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

  /**
   * How often, in real seconds, the gym surface re-reads the wall clock while
   * it is the one on screen — the interval `AppShell.tsx`'s `GymHost`
   * dispatches a real-elapsed-time catch-up on, in addition to the one
   * dispatched on mount and on every transition back onto the surface.
   *
   * A GAME-FEEL VALUE (CLAUDE.md's "Game Feel Values Must Be Tunable"), tuned
   * here as a single named knob rather than scattered as a magic number at
   * the `setInterval` call site. Picked short enough that a real Playwright
   * wait of a few real seconds can observe the purse and clock move without
   * pressing anything — `tools/verify-floor-reachability.mjs`'s
   * "open gym, no presses, bucks/clock have moved" claim needs a real wait on
   * the order of this constant, not the offline cap — and long enough that it
   * is not a busy-poll. Not validated by playtest; say so rather than assert
   * the value is right, per CLAUDE.md's own rule for exactly this situation.
   */
  WALL_CLOCK_TICK_INTERVAL_SECONDS: 5,

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

  /**
   * Stage E.2 sporting-result → reputation formula. Read by `sportingReputation.ts`.
   *
   * Shipped band is SPORT-HEAVY (human ruling): worlds kindScale 16 so a
   * Worlds title without a Total PR (384) crosses regional recruit (200)
   * and the first sponsor tier (250), and a Worlds title plus PR (640)
   * crosses national recruit (600). Both stay under legendary (1500) and
   * REPUTATION_MAX (5000). Local win plus PR (40) stays under club recruit
   * (50). Conservative (worlds 8: title 192, title+PR 320) was investigated
   * and discarded — a Worlds title that cannot hire a regional NPC is not
   * institutionally meaningful. Do not treat that band as the shipped
   * recommendation.
   *
   * Last place and a one-person category pay zero placing points. Check-in
   * reputation is not a cap on sporting credit; see E-REP-01 in
   * `sportingReputation.ts`.
   *
   * `kindScale` is the GDD §6.1 ladder the current meet model actually has.
   * There is no extra prestige table: invented opponent rank would be fake.
   */
  SPORTING_REPUTATION: Object.freeze({
    meetKinds: Object.freeze(['local', 'regional', 'nationals', 'worlds'] as const),
    qualifyRungs: Object.freeze(['regional', 'nationals', 'worlds'] as const),
    kindScale: Object.freeze({
      local: 1,
      regional: 2,
      nationals: 4,
      worlds: 16,
    } as const),
    placingUnit: 24,
    totalPrUnit: 16,
    qualifyUnit: 16,
    copy: Object.freeze({
      noTotal: 'No total posted',
      placing: 'Placed {place} of {field} in category at a {kind} meet',
      totalPr: 'Raised published best total at a {kind} meet',
      qualified: 'Newly qualified for {rung}',
    } as const),
  }),

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
   * Dev-only AWAY (offline) time steps, in seconds: one hour, eight hours,
   * three days. Stage D2.2 split the QA instrument from watched time: these
   * grains dispatch `mode: 'offline'` and are labelled "+Nh away" / "+Nd away".
   * They are NOT one hour of online garage income. `OFFLINE_EARNINGS_FRACTION`
   * still applies. Not part of the game.
   */
  LADDER_DEV_TIME_STEPS_SECONDS: Object.freeze([3600, 28800, 259200] as const),

  /**
   * Dev-only WATCHED (online) time steps, in seconds: thirty minutes and one
   * hour. Dispatch `mode: 'online'` and are labelled "+Nm watched" /
   * "+Nh watched". The garage listed rate is paid in full. Not part of the
   * game. Does not change production economy, the offline fraction, or the cap.
   */
  LADDER_DEV_WATCHED_TIME_STEPS_SECONDS: Object.freeze([1800, 3600] as const),

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
   *
   * S4g retuned `mats` from 200 to 10, and the reason is a measured
   * reachability gap, not a reprice of the band. `mats` is the cheapest row
   * on this table and, with `wrist-wraps`, one of only two items whose
   * `SESSION_EQUIPMENT_MIN_RUNG` is `garage` — so it is the cold-garage
   * player's earliest-reachable stage-2 buy, the first step of §5.13's
   * "direct placement" loop (drag equipment onto the floor grid) once
   * something is actually ownable. At 200 against the garage's own
   * `LADDER_INCOME_GYM_BUCKS_PER_HOUR` of 60, affording it needed a
   * 200 / 60 = 3.33-hour live watch — every phone dump since Playtest 2
   * named this specific buy as the one a cold-garage player could not reach
   * inside a real session, with the dev skip-row
   * (`LADDER_DEV_TIME_STEPS_SECONDS`) the only faster route, and that row is
   * explicitly labelled "not part of the game" in `GymScreen.tsx`'s own
   * header rather than a legitimate buy path.
   *
   * PROVISIONAL — a game-feel/UX threshold (CLAUDE.md, "Game Feel Values
   * Must Be Tunable"), unverified by playtest. Derived rather than picked
   * freely, the same way `DUST_REPAIR_COST_GYM_BUCKS` derives from a real
   * rate rather than a round number: ten minutes is the target length of a
   * short live watch, so the new price is exactly what the garage's own
   * listed rate affords inside that window —
   * `LADDER_INCOME_GYM_BUCKS_PER_HOUR.garage x (10 / 60) = 60 x (10 / 60) =
   * 10`. The exact target length (ten minutes rather than five or fifteen)
   * is the feel choice this file's own rule says a human tunes by hand
   * later; the arithmetic that turns a chosen length into a price is not.
   * `wrist-wraps`, the garage's other item, is untouched at 400 and stays a
   * multi-session goal rather than a first buy — only `mats` moved, because
   * only `mats` was the reported blocker, and `LADDER_INCOME_GYM_BUCKS_PER_HOUR.
   * garage` (60) is out of scope for this round: it is the closed S4e
   * online-tick-rate pin, not a lever this retune touches.
   */
  SESSION_EQUIPMENT_COST_GYM_BUCKS: Object.freeze({
    bike: 1600,
    treadmill: 6500,
    rower: 12000,
    sled: 18000,
    dumbbells: 1200,
    cables: 9000,
    machines: 22000,
    // 10 — S4g, see the block comment above for the derivation.
    mats: 10,
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
  // §5 (v2) stage 3 — members: types and satisfaction. Read by `members.ts`.
  //
  // GDD §5.11's third stage, unpaused as a NAMED EXCEPTION (§5.13) scoped to
  // exactly what the presentation layer's Phase 2 needs: member types with
  // their attraction/pay/quirk, and a satisfaction function driven by
  // crowding, equipment condition (an INPUT PARAMETER here, not computed —
  // see `members.ts` header §2) and equipment fit. Stage 4 (staffing,
  // maintenance, condition decay itself, the failure state) is NOT built by
  // this section; every number below stops at the satisfaction/reputation
  // boundary stage 3 owns.
  //
  // EVERY NUMBER BELOW IS A FIRST-PASS PROPOSAL, NOT A TUNED VALUE — same
  // disclaimer as the rest of this file, repeated because these have had zero
  // review of any kind, not even the stage-1/stage-2 gate playtest. Flagged
  // for human review in the piece's own report.
  // -------------------------------------------------------------------------

  /**
   * GDD §5.6's five member types, verbatim from its table. Structural: a type
   * is a vocabulary token this module and the presentation layer share, not a
   * feel value.
   */
  MEMBER_TYPES: Object.freeze([
    'casual',
    'bodybuilder',
    'powerlifter',
    'athlete',
    'serious-lifter',
  ] as const),

  /**
   * §5.6's "Pays" column, given real numbers: relative tier only in the GDD
   * (Casual low; Bodybuilder/Powerlifter medium; Athlete/Serious Lifter
   * high), denominated here in Gym Bucks per day at full satisfaction.
   *
   * GROUNDING, STATED HONESTLY RATHER THAN CLAIMED PRECISE: these are NOT a
   * decomposition of `LADDER_INCOME_GYM_BUCKS_PER_HOUR` into per-member dues —
   * that rate is stage 1's single abstracted passive-income number for a whole
   * rung (rent, upsells, informal clients, everything lumped together, "a
   * business you have not yet decomposed"), and reconciling it against a real
   * member roster is stage 4 wiring this piece does not do. What is grounded
   * here is order of magnitude only: `garage`'s 60 Gym Bucks/hour is close to
   * one low-tier member's whole DAY of dues, which reads as "a couple of
   * informal clients" the way §5.1's table describes the garage. A tuner
   * revisiting this number should feel free to move it independently of the
   * ladder rates; the two are not mechanically linked.
   */
  MEMBER_DUES_GYM_BUCKS_PER_DAY: Object.freeze({
    casual: 60,
    bodybuilder: 130,
    powerlifter: 130,
    athlete: 220,
    'serious-lifter': 220,
  }),

  /**
   * The floor a member's dues fall to as satisfaction approaches zero, as a
   * fraction of `MEMBER_DUES_GYM_BUCKS_PER_DAY`. A present but unhappy member
   * still pays something rather than a literal zero; `memberDuesGymBucks`
   * interpolates linearly between this floor (satisfaction 0) and the full
   * rate (satisfaction 1). A budget: the design promise is "dues degrade
   * gracefully, not to zero", and this is the number that promise is kept at.
   */
  MEMBER_DUES_SATISFACTION_FLOOR: 0.2,

  /**
   * §5.4's Barbell group has no ownable state in this codebase (only four of
   * five §5.4 equipment groups are implemented — see `members.ts` header §3)
   * and the fixed four powerlifting sessions treat a working barbell setup as
   * always present. This table is each type's affinity to that ALWAYS-TRUE
   * baseline, applied unconditionally to every gym regardless of what is
   * actually owned. It cannot currently distinguish one gym from another —
   * that is the model's real limitation, stated rather than hidden — but it
   * is what lets `equipmentFitScore` read Powerlifter as the type a bare
   * garage is structurally biased toward, which is the correct answer for a
   * bar-plates-and-a-bench gym even though no Barbell item is measured here.
   */
  MEMBER_TYPE_BARBELL_AFFINITY: Object.freeze({
    casual: 0.05,
    bodybuilder: 0.05,
    powerlifter: 0.5,
    athlete: 0.05,
    'serious-lifter': 0.3,
  }),

  /**
   * §5.6's "Attracted by" column, at item resolution rather than group
   * resolution, over the four §5.4 groups that DO have ownable state
   * (`SESSION_EQUIPMENT_ITEMS`) — never the Barbell group (see the affinity
   * table above). A missing item for a type is an implicit zero, read through
   * `?? 0` at every lookup, the same convention `SESSION_EQUIPMENT_CAPABILITY`
   * and `SUPPORT_ITEM_AMPLIFIER` already use for a sparse per-item table.
   * `equipmentFitScore` normalises this against each type's own reachable
   * maximum, so raw magnitudes here only need to be internally ordered
   * within one type — they do not need to compare across types.
   */
  MEMBER_TYPE_ITEM_AFFINITY: Object.freeze({
    casual: Object.freeze({
      bike: 0.4,
      treadmill: 0.4,
      rower: 0.3,
      machines: 0.4,
      mats: 0.2,
    }),
    bodybuilder: Object.freeze({
      dumbbells: 0.6,
      cables: 0.6,
      machines: 0.5,
    }),
    powerlifter: Object.freeze({
      'specialty-bars': 0.7,
    }),
    athlete: Object.freeze({
      sled: 0.7,
      bike: 0.3,
      treadmill: 0.3,
      rower: 0.3,
    }),
    'serious-lifter': Object.freeze({
      dumbbells: 0.3,
      cables: 0.3,
      machines: 0.3,
      bike: 0.2,
      treadmill: 0.2,
      rower: 0.2,
      sled: 0.2,
      mats: 0.3,
      'foam-rollers': 0.3,
      sauna: 0.3,
      'specialty-bars': 0.3,
      belts: 0.2,
      sleeves: 0.2,
      'wrist-wraps': 0.2,
    }),
  }),

  /**
   * How steeply crowding hurts each type's satisfaction — §5.6's "Casual:
   * leaves fastest when crowded" quirk, made comparable across types. Higher
   * is more sensitive (satisfaction falls off faster as the equipment-to-
   * member ratio worsens); the curve itself is `crowdingSatisfactionMultiplier`.
   */
  MEMBER_TYPE_CROWDING_SENSITIVITY: Object.freeze({
    casual: 1.4,
    bodybuilder: 0.7,
    powerlifter: 0.7,
    athlete: 0.8,
    'serious-lifter': 0.5,
  }),

  /**
   * The floor the crowding multiplier falls to however crowded the gym gets.
   * A budget guard in the `RESIDUAL_CARRY_MULTIPLIER_FLOOR` spirit: crowding
   * may hurt satisfaction badly and may not zero it outright, which keeps a
   * hopelessly overcrowded gym a bad decision rather than a impossible one.
   */
  MEMBER_CROWDING_SATISFACTION_FLOOR: 0.3,

  /**
   * How much one member of a type counts toward the crowding load the REST of
   * the roster feels — §5.6's "Bodybuilder: occupies equipment for a long
   * time" quirk, made mechanical: a roster with more bodybuilders is more
   * crowded than the same headcount of any other type, at the same equipment
   * count. 1.0 is the baseline one-member-one-slot reading every other type
   * uses.
   */
  MEMBER_TYPE_CROWDING_LOAD_WEIGHT: Object.freeze({
    casual: 1,
    bodybuilder: 1.6,
    powerlifter: 1,
    athlete: 1,
    'serious-lifter': 1,
  }),

  /**
   * §5.6: "Reputation is earned mostly by powerlifter and serious-lifter
   * members." Reputation points contributed per member of a type, per day,
   * before `reputationFromMembers` sums a roster. Stage E's sporting
   * contributor is a separate per-result function in `sportingReputation.ts`;
   * it is not an argument of `reputationFromMembers`. See `members.ts` header §4.
   */
  MEMBER_TYPE_REPUTATION_PER_MEMBER_PER_DAY: Object.freeze({
    casual: 0,
    bodybuilder: 0.02,
    powerlifter: 0.15,
    athlete: 0.02,
    'serious-lifter': 0.15,
  }),

  /**
   * How close two types' equipment-fit scores must be for
   * `equipmentBiasedMemberTypes` to report both as the equipment set's bias,
   * rather than only the single highest. A budget: the design promise is
   * "near-ties read as a mixed-use gym", and this is the number that promise
   * is kept at.
   */
  MEMBER_EQUIPMENT_BIAS_TIE_TOLERANCE: 0.02,

  // -------------------------------------------------------------------------
  // §5.13 presentation Phase 1 — the floor grid and placement. Read by
  // `floor.ts`. GDD §5.13's build order step 1: "Grid + placement alone. No
  // members, no final art." Nobody has played this — GDD §5.13's own
  // grounding check states both tables below are first-pass proposals,
  // reasoned from real-world footprint intuition and NOT tuned. Units are
  // abstract grid tiles, not a literal foot conversion.
  // -------------------------------------------------------------------------

  /** Supported orientations in degrees, shared by placement, saves, and scene readers. */
  FLOOR_ROTATIONS: Object.freeze([0, 90, 180, 270] as const),
  FLOOR_LAYOUT_INITIAL_REVISION: 0,
  FLOOR_SAVE_SCHEMA_VERSION: 2,
  FLOOR_SAVE_LEGACY_SCHEMA_VERSION: 1,
  /** Purchased rack body; the opening kit remains the separate fixed-layout seed below. */
  FLOOR_SQUAT_RACK_FOOTPRINT: Object.freeze({ width: 3, height: 4 }),

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
   * GDD §5.13's PLAYTEST 2 ruling, gap 1: the Barbell-group starting baseline
   * (`LADDER_STARTING_EQUIPMENT` — "a bar, some plates, a bench") as the
   * DEFAULT opening layout from the moment a gym exists. Stage C.1b made
   * those three items player-positionable layout state (`FloorState.
   * furniture`); this table is the seed and the footprint source, not a
   * claim that the items cannot move. Read by `floor.ts`.
   *
   * ONE ARRANGEMENT FOR EVERY RUNG, NOT A TABLE PER RUNG — the judgement call
   * this piece's own report names and reasons about. Every rung's grid
   * (`FLOOR_GRID_SIZE`) is a strict superset of the garage's — the smallest,
   * 8x6 — in BOTH dimensions, so a small always-fits corner layout sized to
   * the smallest rung needs no per-rung table and no runtime resizing.
   * `floor.test.ts` drives the containment claim against every rung, not only
   * the garage, so a future rung shrinking below the garage would redden it
   * rather than silently clipping the furniture off-grid.
   *
   * Positions are hand-placed to be pairwise non-overlapping and to fit
   * inside the garage's 8x6 grid with room to spare: power-bar (0,0)-(1,3),
   * comp-plates (1,0)-(3,2), flat-bench (3,0)-(5,4) — five tiles wide, four
   * tall, against an 8x6 floor.
   *
   * Keyed by exactly `LADDER_STARTING_EQUIPMENT`, not the wider
   * `LADDER_EQUIPMENT_ITEMS`: only the baseline owned on opening day seeds
   * this layout. The purchased squat rack has its own placeable footprint
   * in `FLOOR_SQUAT_RACK_FOOTPRINT` and enters storage after purchase.
   */
  FLOOR_FIXED_FURNITURE_LAYOUT: Object.freeze({
    'power-bar': Object.freeze({
      position: Object.freeze({ x: 0, y: 0 }),
      footprint: Object.freeze({ width: 1, height: 3 }),
    }),
    'comp-plates': Object.freeze({
      position: Object.freeze({ x: 1, y: 0 }),
      footprint: Object.freeze({ width: 2, height: 2 }),
    }),
    'flat-bench': Object.freeze({
      position: Object.freeze({ x: 3, y: 0 }),
      footprint: Object.freeze({ width: 2, height: 4 }),
    }),
  }),

  /**
   * Fallback pixels per grid tile when the gym stage has not been measured
   * yet (`onLayout` has not fired). Stage C.1b sizes the live tile from the
   * available stage so a garage fills the viewport rather than sitting in a
   * 28px corner; this constant is the pre-measure fallback only, not the
   * displayed size after layout. Read by `FloorGrid.tsx` only.
   */
  FLOOR_TILE_PIXELS: 28,

  /**
   * Upper bound on a live tile, in pixels, after the gym stage is measured.
   * Stops a desktop viewport from blowing an 8x6 garage into unreadable
   * sprites. Read by `FloorGrid.tsx` only.
   */
  FLOOR_TILE_PIXELS_MAX: 72,

  /**
   * Inset, in pixels, reserved on every edge of the gym stage before the
   * tile size is chosen so the grid does not kiss the HUD/dock. Read by
   * `FloorGrid.tsx` only.
   */
  FLOOR_STAGE_PADDING_PIXELS: 8,

  /**
   * Presentation only: `condition` (0–1) shown as a whole percent. Does not
   * change wear, income, or any failure threshold.
   */
  CONDITION_PERCENT_SCALE: 100,

  /** Border thickness, in pixels, of the floor grid's own outer frame. Read by `FloorGrid.tsx` only. */
  FLOOR_GRID_BORDER_WIDTH_PIXELS: 1,

  /**
   * GDD §5.13's PLAYTEST 2 ruling, gap 3: line thickness, in pixels, of the
   * grid's own internal tile boundaries — the lines that make a floor read as
   * a grid of discrete cells rather than one solid rectangle. Read by
   * `FloorGrid.tsx` only.
   */
  FLOOR_GRID_LINE_WIDTH_PIXELS: 1,

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

  /**
   * GDD §5.13's PLAYTEST 3 ruling on the furniture/session-item overlap gap:
   * how long, in milliseconds, a refused drop's "can't place here" outline
   * and message stay visible on the fixed-furniture cell that refused it,
   * before clearing on their own. A felt duration — long enough to register
   * as an answer to the gesture that just ended, short enough not to still be
   * showing on the next unrelated drag — not tuned or played, the same
   * first-pass-proposal status this file's other `_MS`/pixel knobs carry.
   * Read by `FloorGrid.tsx` only.
   */
  FLOOR_OVERLAP_REFUSAL_FLASH_MS: 1200,

  /**
   * Border thickness, in pixels, of the "can't place here" outline drawn on
   * a fixed-furniture cell while `FLOOR_OVERLAP_REFUSAL_FLASH_MS` is
   * running — thicker than the resting `FLOOR_ITEM_BORDER_WIDTH_PIXELS` so
   * the refusal reads as a distinct state, not a slightly-different resting
   * one. Read by `FloorGrid.tsx` only.
   */
  FLOOR_OVERLAP_REFUSAL_OUTLINE_WIDTH_PIXELS: 4,

  // -------------------------------------------------------------------------
  // §5.13 presentation Phase 2 — ambient members: "ambient members at fixed
  // positions, static or idle-animated, from real count/type data." Provisional,
  // exactly as the FLOOR_* block above says of itself: reasoned from a
  // "garage sparse, warehouse populated" intuition and NOT tuned or played.
  // -------------------------------------------------------------------------

  /**
   * How many ambient bodies `floor.ts`'s `ambientMemberRoster` draws at each
   * rung — a first-pass proposal, not tuned or played, in the same spirit as
   * `FLOOR_GRID_SIZE` above: garage sparse ("no members, nobody knows you"
   * per §5.1's own ladder table), warehouse populated. Strictly increasing;
   * `floor.test.ts` drives that directly rather than trusting this sentence.
   * Chosen small enough that every rung's grid, minus
   * `FLOOR_FIXED_FURNITURE_LAYOUT`'s footprint, has generous room to spare —
   * `floor.test.ts` also drives that no rung's count exceeds the candidate
   * cells `ambientMemberRoster` can actually offer.
   */
  AMBIENT_MEMBER_COUNT_BY_RUNG: Object.freeze({
    garage: 3,
    'storage-unit': 8,
    'strip-mall-unit': 18,
    warehouse: 40,
  }),

  /**
   * The footprint one ambient body occupies for placement purposes, in
   * tiles — a legibility/placement knob like `FLOOR_TRAY_ITEM_MIN_TILES`
   * above, not game math. A single tile is the simplest static-body size for
   * this phase; Phase 4's real pixel-art pass may need a wider or taller
   * footprint once real sprites exist. Read by `floor.ts`'s
   * `ambientMemberRoster` only.
   */
  AMBIENT_MEMBER_FOOTPRINT_TILES: Object.freeze({ width: 1, height: 1 }),

  /**
   * `ambientMemberRoster`'s placement stride, in scanned candidate cells —
   * how many candidate positions it skips between chosen ones on its first
   * pass, so members spread across a room instead of clustering into the
   * grid's top-left corner. A felt spacing knob, not tuned or played, in the
   * same class as `FLOOR_OVERLAP_REFUSAL_FLASH_MS`'s "first-pass-proposal"
   * status. Must be at least 1 (a stride of 0 is not a stride); `floor.test.ts`
   * drives that every rung still reaches its full `AMBIENT_MEMBER_COUNT_BY_RUNG`
   * count at this stride, via the documented fallback pass.
   */
  AMBIENT_MEMBER_PLACEMENT_STRIDE: 3,

  // -------------------------------------------------------------------------
  // §5.13 presentation Phase 2, PLAYTEST 4 — a real device playtest found the
  // three ambient members reading as "small teal chips on a teal grid... extra
  // tiles, not a population" rather than as people. Root cause, verified by
  // hand rather than guessed: on the exact state every new gym opens in —
  // zero session equipment owned — `equipmentBiasedMemberTypes([])` returns a
  // single type, `'powerlifter'`, so every member in the roster maps to the
  // SAME `AMBIENT_MEMBER_PALETTE` colour, and that colour
  // (`AMBIENT_MEMBER_PALETTE[MEMBER_TYPES.indexOf('powerlifter')]`,
  // `'lightseagreen'`) sits in the same teal/cyan hue family as
  // `FLOOR_BACKGROUND_COLOR` (`'darkslategray'`) — so every opening-day
  // member reads as the same colour as the floor itself. The player's own
  // menu named three fixes and asked for any/all: contrast (fixed by
  // replacing `AMBIENT_MEMBER_PALETTE`'s values, in `FloorGrid.tsx`, not
  // here, since it stays a local named-colour-keyword table by the same
  // precedent `PLACEHOLDER_PALETTE` sets), a distinct silhouette instead of a
  // plain circle, and a tiny idle motion. The seven knobs below are the
  // sizing/timing constants the second and third need — first-pass
  // proposals, not tuned or played, the same status every other knob in this
  // block already carries. Read by `FloorGrid.tsx` only.
  //
  // Phase 4 note: the head/body sizing knobs this ruling added were retired
  // with the placeholder body itself — the member is a sprite from
  // `floorSprites.ts` now, and its proportions are pixel data rather than
  // fractions. The bob knobs below survive unchanged; the bob rides on top of
  // the sprite exactly as it rode on top of the placeholder.
  // -------------------------------------------------------------------------

  /**
   * How far, in pixels, an ambient member's idle bob displaces it vertically
   * at the top of its cycle — a couple of pixels, deliberately small: this is
   * meant to read as "not a frozen photograph," not as pathing or movement
   * between grid cells (Phase 3's job, explicitly out of scope here). The
   * base `left`/`top` position drawn from `member.position` is never touched;
   * this is an additive transform on top of it, the same pattern the drag
   * preview's own `dragOffset` already uses.
   */
  AMBIENT_MEMBER_BOB_AMPLITUDE_PIXELS: 2,

  /**
   * Duration, in milliseconds, of ONE HALF of an idle bob's cycle (rest to
   * peak, or peak to rest) — the full up-and-down cycle is twice this. A felt
   * timing knob, not tuned or played, in the same class as
   * `FLOOR_OVERLAP_REFUSAL_FLASH_MS`'s "first-pass-proposal" status.
   */
  AMBIENT_MEMBER_BOB_HALF_CYCLE_MS: 900,

  /**
   * How many distinct stagger "lanes" an ambient member's bob start-delay is
   * drawn from, keyed by the member's own roster index modulo this count —
   * so a 3-member garage and a 40-member warehouse both get a small, fixed
   * number of out-of-phase groups rather than either all bobbing in lockstep
   * (one lane) or needing one distinct delay per member (an unbounded, and
   * for a warehouse, pointless, table). Lockstep reads as one mechanism;
   * staggered reads as individuals, which is the whole point of this round.
   */
  AMBIENT_MEMBER_BOB_STAGGER_LANES: 4,

  /** The delay, in milliseconds, between one stagger lane's bob start and the next's — `lane * this` is a given member's own start delay. */
  AMBIENT_MEMBER_BOB_STAGGER_STEP_MS: 150,

  // -------------------------------------------------------------------------
  // §5.13 presentation Phase 3 — the floor simulation: "real pathing, queuing,
  // use, and visible reaction." Read by `floorSim.ts` only — the render
  // half's own knobs are a separate block at the end of this record.
  //
  // PROVISIONAL, in exactly the sense `FLOOR_GRID_SIZE` and
  // `AMBIENT_MEMBER_COUNT_BY_RUNG` already claim for themselves: every number
  // below is reasoned from an intuition about how a gym floor reads, and NONE
  // of it has been tuned or played. Phase 3's gate is a human watching the
  // gym run; until that has happened these are first-pass proposals.
  //
  // THE UNIT OF TIME HERE IS A SIM TICK, NOT A SECOND AND NOT A FRAME. The
  // sim advances one tick per `stepFloorSim` call and holds no clock of its
  // own (`floorSim.ts` is pure — no `Date.now`, no `Math.random`), so what a
  // tick is worth in wall time is the renderer's decision, not this file's.
  // A tuner moving these should decide the tick rate first: every `_TICKS`
  // knob below is denominated in it.
  // -------------------------------------------------------------------------

  /**
   * How far along its current tile-to-tile step a walking member advances per
   * tick, as a fraction of one tile. At 0.34 a member crosses a tile in three
   * ticks, which is the pace this piece proposes for "walking, not gliding."
   *
   * MUST STAY AT OR BELOW 1: `floorSim.ts` advances at most one cell per
   * tick, so a value above 1 would silently discard the surplus rather than
   * move faster. `floorSim.test.ts` pins that bound rather than trusting this
   * sentence.
   */
  FLOOR_SIM_STEP_PROGRESS_PER_TICK: 0.34,

  /**
   * How much a single member's own walking speed may differ from the base
   * rate above, as a fraction of it — a member's seeded jitter is drawn
   * deterministically from its index and the sim seed and lands somewhere in
   * `[1 - this, 1 + this]`. Zero would make every member move in lockstep,
   * which is the Phase 2 defect ("one mechanism moving") one layer out.
   * Must stay strictly below 1 so no member's speed can reach zero.
   */
  FLOOR_SIM_SPEED_JITTER_FRACTION: 0.25,

  /**
   * How many ticks one member of each §5.6 type occupies a piece of equipment
   * for, before it stops and walks away. Ordered from §5.6's own table rather
   * than invented: Bodybuilder is the longest because "occupies equipment for
   * a long time" is that row's stated quirk, Casual the shortest.
   *
   * DELIBERATELY A SEPARATE TABLE FROM `MEMBER_TYPE_CROWDING_LOAD_WEIGHT`,
   * which encodes the same quirk on the satisfaction axis. Reusing that one
   * here was considered and refused: it would couple two different feels —
   * how crowded a gym FEELS and how long a body is visibly parked on a
   * machine — to one number, so a playtester fixing the look would move the
   * economy. Two knobs, seeded from the same design row, is the honest shape.
   */
  FLOOR_SIM_USE_TICKS_BY_TYPE: Object.freeze({
    casual: 18,
    bodybuilder: 42,
    powerlifter: 30,
    athlete: 22,
    'serious-lifter': 34,
  }),

  /**
   * How many ticks of seeded spread sit on top of the per-type duration above
   * — one use lasts `base + (a seeded value in [0, this))`, so two members of
   * the same type on the same machine do not finish together. Zero makes
   * every use of a type identical in length, which reads mechanical.
   */
  FLOOR_SIM_USE_TICKS_SPREAD: 12,

  /**
   * The most members that may be waiting for one station at once, the queue's
   * head included. A station already holding this many claimants is not
   * offered to a member choosing where to go, so a queue can never grow
   * without bound and a floor with more members than queue capacity leaves
   * the surplus walking rather than stacked invisibly on one tile.
   */
  FLOOR_SIM_QUEUE_MAX_LENGTH: 3,

  /**
   * How many tiles of extra perceived distance each member already waiting at
   * a station adds, when a member is choosing where to go. This is the whole
   * of "members prefer a free machine to a busy one" — at 4, one waiting body
   * makes a station read as four tiles further away than it is. Zero would
   * make every member pile onto the nearest station regardless of the queue.
   */
  FLOOR_SIM_QUEUE_AVERSION_TILES: 4,

  /**
   * How many tiles of perceived distance a station is worth being pulled
   * CLOSER by a member's full affinity for it — the §5.6 "Attracted by"
   * column read straight off `MEMBER_TYPE_ITEM_AFFINITY` /
   * `MEMBER_TYPE_BARBELL_AFFINITY`, so a powerlifter walks past the bikes to
   * reach the bar.
   *
   * THIS IS A CEILING THE TABLES DO NOT REACH, and the number that matters to a
   * tuner is the realised one. The largest affinity either table publishes is
   * 0.7, so at 10 the most attractive station a member can meet reads 7 tiles
   * nearer, not ten — which is most of a garage and a small part of a
   * warehouse; that asymmetry is deliberate and is one of the things a playtest
   * should judge. This sentence used to claim ten and was wrong by 43%;
   * `floorSim.test.ts` derives the 7 from both tables and reads it back out of
   * this comment, so raising an affinity reddens rather than quietly making the
   * sentence wrong a second time.
   */
  FLOOR_SIM_AFFINITY_PULL_TILES: 10,

  /**
   * How many tiles of seeded noise sit on a member's perceived distance to a
   * station, breaking ties so members of the same type standing near each
   * other do not all choose the same machine. Zero collapses a roster of one
   * type into a single conga line, which is the lockstep defect again.
   */
  FLOOR_SIM_TARGET_NOISE_TILES: 3,

  /**
   * How many ticks the transient `interrupted` state holds — GDD §5.13's
   * "holding a short fixed beat with a visible reaction cue... then always
   * resolving back into seeking." Long enough for a reaction bubble to
   * register, short enough that the member is not standing still while the
   * player waits. Must be at or above 1: a beat of zero ticks is not a beat,
   * and `floorSim.test.ts` pins that.
   */
  FLOOR_SIM_INTERRUPTED_BEAT_TICKS: 8,

  /**
   * How many ticks a member spends walking away from a station it has
   * finished with, before it starts looking for the next one. This is the
   * `leaving` arm of §5.13's own four-state machine, and it exists so a
   * finished member visibly steps off the equipment instead of teleporting
   * into its next approach. Must be at or above 1.
   */
  FLOOR_SIM_LEAVING_TICKS: 6,

  /**
   * How many ticks a Competition Bench Bay seat stays unavailable after a
   * lifter finishes, while plates are changed. This is the stock changeover
   * D2.1B made explicit: it is not the lifter's set, and it is not the
   * member `leaving` walk. Session equipment has none. Throughput replaces
   * this duration with `STATION_THROUGHPUT_CHANGEOVER_TICKS`. Must be at or
   * above 1 — a changeover of zero ticks is not a beat, and the plate tree
   * would have nothing to shorten.
   */
  FLOOR_SIM_STATION_CHANGEOVER_TICKS: 18,


  /**
   * How many ticks a member with nowhere to go holds one wander direction
   * before drawing another. A gym with no reachable equipment (an empty
   * garage before anything is placed, or a member walled off from every
   * station) leaves its members walking rather than frozen; this is how long
   * each leg of that walk is. At 1 the walk reads as jitter; at a large value
   * it reads as marching into a wall and stopping.
   */
  FLOOR_SIM_WANDER_HOLD_TICKS: 5,

  /**
   * A GUARD, NOT A FEEL VALUE. The most grid cells one route search may visit
   * before `floorSim.ts` refuses. The largest registered floor is the
   * warehouse's 40x28 = 1120 cells, so this leaves headroom of more than
   * three times over; it exists so a future rung with an enormous grid fails
   * loudly here rather than making a frame drop somewhere a player notices.
   */
  FLOOR_SIM_ROUTE_VISIT_BUDGET: 4096,

  /**
   * A GUARD, NOT A FEEL VALUE. The most ticks one `runFloorSim` call may
   * advance. A sweep asking for more than this has almost certainly
   * multiplied two horizons together by mistake, and a pure function that
   * quietly runs for a minute is worse than one that refuses.
   */
  FLOOR_SIM_MAX_RUN_TICKS: 20000,

  // -------------------------------------------------------------------------
  // §5.13 presentation Phase 3 — the RENDER half of the floor simulation.
  // Read by `FloorGrid.tsx` only; `floorSim.ts` reads none of them, and that
  // split is the point. The block above is denominated in SIM TICKS and knows
  // nothing about wall time or pixels; this block is what turns a tick into a
  // millisecond and a tile into a pixel, which is the renderer's decision and
  // not the machine's.
  //
  // PROVISIONAL, in exactly the sense the two blocks above claim for
  // themselves: every number here is a first-pass proposal reasoned from an
  // intuition about how a gym floor reads, and NONE of it has been tuned or
  // played. Phase 3's gate is a human watching the gym run.
  // -------------------------------------------------------------------------

  /**
   * How long, in milliseconds, one sim tick lasts on screen — the rate
   * `FloorGrid.tsx` calls `stepFloorSim` at.
   *
   * THIS IS THE KNOB A TUNER MOVES FIRST, because every `_TICKS` entry in the
   * block above is denominated in it: at 120 ms a member crosses a tile in
   * about a third of a second (`FLOOR_SIM_STEP_PROGRESS_PER_TICK` is 0.34, so
   * three ticks a tile), a bodybuilder's 42-tick set runs about five seconds,
   * and the interrupted beat's 8 ticks reads as just under a second. Halving
   * this speeds the whole gym up without changing any behaviour.
   */
  FLOOR_SIM_TICK_INTERVAL_MS: 120,

  /**
   * How long, in milliseconds, the renderer takes to slide a member from the
   * position one tick put it at to the position the next tick puts it at.
   *
   * At the shipped value this equals `FLOOR_SIM_TICK_INTERVAL_MS`, which is
   * what makes a walk continuous rather than a sequence of hops — the tween
   * for tick N is still running when tick N+1 replaces it. A tuner who wants
   * a snappier, more stepped read shortens this WITHOUT touching the tick
   * rate; a value above the tick interval makes a member permanently lag the
   * cell the sim thinks it is on, which is a look rather than a bug but is
   * worth knowing before turning it up.
   */
  FLOOR_SIM_MOVE_TWEEN_MS: 120,

  /**
   * The seed `FloorGrid.tsx` opens its sim with.
   *
   * `floorSim.ts` is deterministic and takes every choice from this seed, so
   * this number is what decides which member walks where on a given floor.
   * It is a knob rather than a structural constant because turning it is how
   * a playtester asks "is this floor boring or is this seed boring" — and it
   * is a fixed value rather than a clock read because a screen that reshuffles
   * its gym on every launch cannot be reported as a repeatable defect.
   */
  FLOOR_SIM_RENDER_SEED: 1,

  /**
   * Stage G.1 — living floor-member service history. The shipped window is 5,
   * accepted at 390×844 for scan density and memory (not because it is the
   * middle candidate). 3 and 8 remain so tests can compare bounds without
   * retuning the live card.
   */
  LIVING_MEMBER_SERVICE_HISTORY_WINDOWS: Object.freeze([3, 5, 8] as const),
  LIVING_MEMBER_SERVICE_HISTORY_WINDOW: 5,
  /** Wait-label buckets on member cards, in floor-sim ticks. */
  LIVING_MEMBER_WAIT_SHORT_MAX_TICKS: 15,
  LIVING_MEMBER_WAIT_LONG_MIN_TICKS: 40,
  /**
   * Stage G.1C — upper wait band. Garage service study (same roster, seed,
   * layout, 1000-tick budget): stock mean 116.59 / matched second wait 128;
   * Throughput mean 86.36 / matched second wait 95; Capacity mean 52.52 /
   * max 94. Candidates 80 and 90 still mapped 95 and 128 to the same phrase.
   * 100 is the lowest candidate that keeps 95 in "long wait" (not short),
   * puts 128 in "very long wait", and leaves Capacity's whole distribution
   * below the upper tail.
   */
  LIVING_MEMBER_WAIT_VERY_LONG_MIN_TICKS: 100,

  /**
   * Stage G.2A — living-member recent-service meaning. Mechanical scores are
   * derived from `ServiceVisitRecord` fields only. Label mins are presentation
   * bands on those scores, the same class as the G.1C wait-copy thresholds:
   * they name the card, they are not a second wait formula.
   *
   * `waitDecayTicks` is an e-folding constant: wait = exp(-ticks / 110).
   * It is not a half-life. 110 is distinct from the copy thresholds
   * 15 / 40 / 100 so a copy edit cannot silently retune the curve.
   *
   * G.2A closed at 255de8a5 after the Expo 390×844 experience replay.
   * G.2B is authorized as retention-pressure truth on top of this block
   * (`LIVING_MEMBER_RETENTION`). This block's numbers stay frozen.
   */
  LIVING_MEMBER_EXPERIENCE: Object.freeze({
    waitDecayTicks: 110,
    trainingStockScore: 0.82,
    trainingQualityScore: 1,
    reliabilityInterrupted: 0.55,
    waitEasyMin: 0.7,
    waitManageableMin: 0.5,
    waitStrainedMin: 0.38,
    trainingExcellentMin: 0.95,
    trainingSolidMin: 0.78,
    reliabilitySteadyMin: 0.95,
    reliabilityUnevenMin: 0.7,
    overallGoodMin: 0.78,
    overallMixedMin: 0.62,
    overallRoughMin: 0.45,
  }),

  /**
   * Stage G.2B — living-member retention pressure. Formed pressure is
   * `1 - composite` on [0, 1]: a normalized strain index, not a chance of
   * leaving. Label mins are presentation bands on that index, the same
   * class as G.2A overall bands: they name the card, they are not a
   * hazard function.
   *
   * watchingMin 0.22 / strainedMin 0.42 / atRiskMin 0.55 were chosen so
   * Garage Capacity mean (~0.20) reads Stable, Stock/Quality/Throughput
   * Mixed (~0.29–0.36) read Watching, severe Rough (~0.46) reads Strained,
   * and Poor (composite below 0.45) reads At risk — still a membership
   * concern, not a departure. G.2C owns actual leave/arrive.
   *
   * The shipped mapping is type-blind. Casual wait-tolerance and Serious
   * Lifter relief are compared in livingMemberRetention.test.ts and are
   * not applied here.
   */
  LIVING_MEMBER_RETENTION: Object.freeze({
    watchingMin: 0.22,
    strainedMin: 0.42,
    atRiskMin: 0.55,
  }),

  /**
   * as a fraction of the smaller of its footprint's two rendered dimensions.
   */
  FLOOR_SIM_CUE_DIAMETER_FRACTION: 0.5,

  /**
   * Stage D2.2 plate-loading overlay. Drawn from `FloorSimState.changeovers`
   * remaining ticks (same job at stock 18 and plate-tree 6). Geometry is
   * fractions of the bench footprint. Disc count is how many plate discs
   * travel from the stack to the bar sleeve. `discSizeFraction` is of the
   * bench's shorter side in tiles. Not a parallel timer.
   */
  FLOOR_PLATE_LOADING: Object.freeze({
    discCount: 3,
    sourceXFraction: 0.2,
    sleeveXFraction: 0.72,
    railYFraction: 0.22,
    stackSpreadFraction: 0.12,
    discSizeFraction: 0.45,
  }),

  /** The gap, in pixels, between the top of a member's head and the bottom of its state cue. */
  FLOOR_SIM_CUE_GAP_PIXELS: 2,

  /**
   * How much larger the cue is drawn while a member is `interrupted`, as a
   * multiple of the resting diameter above.
   *
   * GDD §5.13's own pathing-interruption ruling asks for "a visible reaction
   * cue (RCT's thought-bubble pattern)", and a reaction that is the same size
   * as the four resting cues is a colour change rather than a reaction. This
   * is the knob that decides how loud the beat is.
   */
  FLOOR_SIM_INTERRUPTED_CUE_SCALE: 1.6,

  /**
   * The opacity a member is drawn at while it is `leaving` — stepping away
   * from a machine it has finished with. Below 1 so "done here" reads as a
   * fade rather than needing its own colour; well above 0 so a leaving member
   * is still a body on the floor and not a disappearance.
   */
  FLOOR_SIM_LEAVING_OPACITY: 0.55,

  /**
   * GDD §5.13's P4b ruling ("actually using the machines"): how far a
   * `using` member's DRAWN position is pulled from its sim use cell toward
   * its station's own anchor (the station box's centre, adjusted for the
   * member's footprint), as a fraction per station-use class. 0 draws the
   * member on its use cell exactly (the pre-P4b read the human called
   * "people near equipment"); 1 draws it centred on the station. RENDERER
   * ONLY — `floorSim.ts`'s use-cell model is untouched and the sim never
   * sees these numbers; `FloorGrid.tsx` applies them the way the walk tween
   * is applied, as a pure draw offset. Bench is full centring (the body lies
   * ON the bench); bar stops just short of centre (under the bar, not
   * swallowed by it); generic leans into the machine face. Provisional feel
   * values, like everything in this block — a phone pass judges them.
   *
   * A recorded residual, pointed at from `opsSled` in `floorSprites.ts`:
   * the sled sprite parks its sled body at the native row where the `bar`
   * bias above puts a TOP-approach using member, so that composite reads as
   * hands on a loaded sled. A side approach lands the member lower on the
   * track, where it clips the push posts rather than the sled body —
   * accepted rather than chased with per-approach art. Two consequences for
   * whoever tunes here: retuning `bar` moves the drawn member while the
   * sled's park row stays authored against the current value, so re-check
   * the sled composite after a change; and the side-approach read has not
   * been judged on a device.
   */
  FLOOR_SIM_USING_ANCHOR_BIAS: Object.freeze({
    bench: 1,
    bar: 0.7,
    generic: 0.55,
  }),

  /**
   * The border width, in pixels, of the two outlines this layer draws over
   * things rather than as things: a station being walked to or used, and the
   * ring held around a member that is stranded with no route to any station.
   * Thicker than `FLOOR_ITEM_BORDER_WIDTH_PIXELS` so a highlight reads as a
   * highlight and not as the chip's own resting edge.
   */
  FLOOR_SIM_HIGHLIGHT_BORDER_WIDTH_PIXELS: 3,

  /**
   * The stacking order a member is drawn at. Above the placed-equipment chips
   * (which draw at 1) so a member walking past a machine is not swallowed by
   * it, and below `FLOOR_DRAGGING_Z_INDEX` so a chip being dragged still
   * passes over everything.
   */
  FLOOR_SIM_MEMBER_Z_INDEX: 3,

  /** The stacking order a station highlight is drawn at — over the chip it outlines, under the members. */
  FLOOR_SIM_STATION_HIGHLIGHT_Z_INDEX: 2,

  // -------------------------------------------------------------------------
  // GDD §5.13 presentation Phase 4 — the 16-bit art pass. Read by
  // `floorSprites.ts` (the index-grid sprite data and its palette resolution)
  // and `FloorGrid.tsx` (frame selection). Every entry here is provisional in
  // exactly the sense the FLOOR_* block above claims for itself: reasoned, not
  // tuned, not played — colours especially, since the gate for this phase is a
  // human on a real phone judging whether the floor reads as the same game as
  // the lift screen.
  // -------------------------------------------------------------------------

  /**
   * The native pixel grid one floor tile is drawn at. Sprites are authored at
   * this resolution and integer-upscaled to `FLOOR_TILE_PIXELS` before they
   * are encoded, so the drawn image is byte-exact pixels rather than a
   * browser's smoothing of a smaller one. `floorSprites.test.ts` drives the
   * divisibility claim (`FLOOR_TILE_PIXELS` is a whole multiple of this)
   * rather than trusting this comment.
   */
  FLOOR_SPRITE_NATIVE_PIXELS_PER_TILE: 14,

  /**
   * How many sim ticks one walk frame is held before the two-frame cycle
   * flips. At the shipped `FLOOR_SIM_TICK_INTERVAL_MS` of 120 this is a step
   * cadence of roughly four frames a second, the register a small walking
   * figure of this era animates at. A frame-duration feel value, named here
   * per CLAUDE.md's tunability rule.
   */
  FLOOR_SPRITE_WALK_FRAME_TICKS: 2,

  /**
   * How many sim ticks one rep-cycle frame is held before a `using` member's
   * two-frame working animation flips. GDD §5.13's P4b ruling asks for a rep
   * cycle FASTER than the walk, so this sits below
   * `FLOOR_SPRITE_WALK_FRAME_TICKS` — at the shipped tick interval of 120ms
   * this is a frame flip every 120ms. The honest half, stated rather than
   * asserted away: whether that reads as a stick figure vigorously working a
   * set or as a 28px body vibrating has not been judged on a phone, and a
   * flip this fast is exactly the kind of value that can land either way.
   * This knob is the single thing a tuner moves to find out — 2 restores the
   * walk cycle's cadence ratio, 3 halves it again — and no component
   * arithmetic needs touching. Deterministic from the sim tick and the
   * member index, like the walk cycle — no clock, no dice.
   *
   * P4c held this at 1 after inspecting the frames rather than the device,
   * and left the doubt open with numbers on it. Measured a/b frame
   * difference per class on the shipped maps: bench 52 native pixels, bar
   * 32-36, generic 7. The generic pair's 7 are one contiguous arm (a
   * two-pixel reach retraction plus its hand cap), which is a small coherent
   * pump rather than scattered toggling — so the frame inspection produced
   * no concrete flicker finding, and retuning on none would be a guess. For
   * the next phone pass: if usage still reads frantic, generic is the class
   * to watch, and 2 is the first value to try.
   */
  FLOOR_SPRITE_REP_FRAME_TICKS: 1,

  /**
   * The shared body colours every member sprite resolves through, as plain
   * RGB components. One key light, upper-left, is baked into the sprite maps
   * themselves (lit columns left, shade columns right); these are the paint.
   * SKIN_SHADE is a hue-shifted step of SKIN rather than a darkened copy of
   * it, the discipline the lift screen's own palette sets.
   */
  FLOOR_SPRITE_BODY_PALETTE: Object.freeze({
    OUTLINE: Object.freeze([24, 20, 28]),
    SKIN: Object.freeze([222, 166, 128]),
    SKIN_SHADE: Object.freeze([173, 111, 84]),
    HAIR: Object.freeze([58, 42, 38]),
    PANTS: Object.freeze([64, 60, 78]),
    PANTS_SHADE: Object.freeze([46, 43, 58]),
    SHOE: Object.freeze([40, 36, 44]),
    ACCENT: Object.freeze([232, 228, 216]),
  }),

  /**
   * Each member type's outfit, as RGB components — the top's lit colour and
   * its shade step. The type mix being readable is a Phase 2 guarantee, so
   * these five are chosen apart in hue (orange tee, magenta tank, red
   * singlet, gold vest, violet hoodie) and none is in the floor's own
   * blue-grey family. `floorSprites.test.ts` drives the pairwise-distinctness
   * claim on the rendered sprites rather than trusting this list.
   *
   * A doubt recorded rather than resolved: the powerlifter's red
   * ([200, 60, 52]) and the gear palette's competition-plate red below
   * ([178, 56, 48], with its [128, 38, 34] shade) are a near-collision —
   * deliberately both red, since a red singlet and red discs are the sport's
   * own colours, and separated in the composite by nothing but the one-pixel
   * outline ring. Legible in the desk-scale composites this was checked in;
   * whether a powerlifter benching under red plates smears into one red mass
   * at phone scale is unjudged, and per §5.13's stanza the last device
   * pass's silence about it is not a yes. The tuning fix, if a phone pass
   * asks for it, is nudging either hue here — both are knobs.
   */
  FLOOR_SPRITE_OUTFIT_PALETTE: Object.freeze({
    casual: Object.freeze({ top: Object.freeze([226, 128, 60]), shade: Object.freeze([178, 90, 40]) }),
    bodybuilder: Object.freeze({ top: Object.freeze([206, 66, 118]), shade: Object.freeze([156, 42, 88]) }),
    powerlifter: Object.freeze({ top: Object.freeze([200, 60, 52]), shade: Object.freeze([148, 38, 36]) }),
    athlete: Object.freeze({ top: Object.freeze([232, 190, 70]), shade: Object.freeze([180, 140, 44]) }),
    'serious-lifter': Object.freeze({ top: Object.freeze([140, 96, 196]), shade: Object.freeze([100, 64, 150]) }),
  }),

  /**
   * The equipment colours, as RGB components: a three-step steel ramp, a
   * two-step rubber, red competition-plate paint, bench upholstery and a
   * wood ramp for the platform pieces. Ramps are short on purpose — a chip a
   * few tiles across carries two or three values and an outline, not a
   * gradient.
   */
  FLOOR_SPRITE_GEAR_PALETTE: Object.freeze({
    STEEL_LIGHT: Object.freeze([176, 182, 198]),
    STEEL_MID: Object.freeze([120, 126, 144]),
    STEEL_DARK: Object.freeze([70, 74, 90]),
    RUBBER: Object.freeze([56, 52, 60]),
    RUBBER_DARK: Object.freeze([38, 34, 44]),
    PAD: Object.freeze([168, 60, 66]),
    PAD_SHADE: Object.freeze([120, 40, 48]),
    WOOD: Object.freeze([180, 140, 92]),
    WOOD_SHADE: Object.freeze([138, 102, 64]),
    PLATE: Object.freeze([178, 56, 48]),
    PLATE_SHADE: Object.freeze([128, 38, 34]),
  }),

  /**
   * The floor texture's own four tones, as RGB components: a base, a slightly
   * different alternate so tiles read in a checker, a darker seam drawn along
   * each tile's far edges, and a sparse lighter fleck. All four sit close
   * together and low in value on purpose — the bodies are the read, and the
   * lift screen's environment palette holds its floor down the same way.
   */
  FLOOR_SPRITE_FLOOR_PALETTE: Object.freeze({
    BASE: Object.freeze([58, 64, 66]),
    ALT: Object.freeze([53, 58, 61]),
    SEAM: Object.freeze([44, 49, 52]),
    FLECK: Object.freeze([67, 74, 75]),
  }),

  /**
   * Font size, in pixels, of the small identifying labels drawn over the
   * floor's sprites — the fixed-furniture "(fixed)" captions, a placed
   * item's name and remove control, and the tray chips' names. The platform
   * default (~14px) buried the sprites under their own captions on the first
   * composed screenshot; this holds the words to a caption register while
   * the pixels carry the read. Provisional, like every knob in this block.
   */
  FLOOR_SPRITE_LABEL_FONT_SIZE: 8,

  /**
   * Every how-many-th tile of the floor texture carries a fleck mark — a
   * sparseness divisor in the same class as `AMBIENT_MEMBER_PLACEMENT_STRIDE`.
   * Small is busy, large is flat.
   */
  FLOOR_SPRITE_FLECK_STRIDE: 3,

  // -------------------------------------------------------------------------
  // §5.11 stage 4 — staffing, maintenance, equipment condition, recoverable
  // failure (§5.6/§5.7, unpaused by the ruling recorded in docs/GDD.md §5.13).
  // Read by `management.ts` and nothing else. Every value here is provisional
  // in exactly the sense this file's own header claims: legible and
  // self-consistent, judged by nobody. `management.test.ts` re-derives the
  // consistency inequalities from these values rather than restating them.
  // -------------------------------------------------------------------------

  /**
   * The manager quality ladder, worst first — §5.7's quality axis as a closed
   * vocabulary, deterministic like every hire in this directory (no draw, no
   * pull, no rarity: GDD §12.3's no-gacha rule applied to staffing). 'novice'
   * deliberately reuses the NPC tier token so the census carries one row.
   */
  MANAGER_TIERS: Object.freeze(['novice', 'steady', 'veteran'] as const),

  /**
   * Flat published hire cost per tier, in Gym Bucks, quoted before the
   * decision — §5.7's staffing tradeoff priced: the cheap manager is cheap.
   */
  MANAGER_HIRE_COST_GYM_BUCKS: Object.freeze({
    novice: 150,
    steady: 600,
    veteran: 2000,
  }),

  /**
   * Ongoing wage per tier, in Gym Bucks per banked hour of gym operation.
   * Keyed to banked seconds — the same capped quantity income accrues on — so
   * absence beyond the offline horizon costs no wage, exactly as it earns no
   * income. A wage on wall-clock hours would charge the player for being
   * away, which the §5.13 stage-4 ruling forbids.
   */
  MANAGER_WAGE_GYM_BUCKS_PER_BANKED_HOUR: Object.freeze({
    novice: 2,
    steady: 5,
    veteran: 9,
  }),

  /**
   * The condition below which a manager of each tier repairs an item on its
   * own at a check-in, billing the gym the published repair cost — §5.7's
   * "a good manager can handle routine repairs autonomously; a bad one
   * won't". The novice's zero is that sentence's second half: no condition
   * is ever below zero, so the cheapest manager repairs nothing, which is
   * how "the cheap manager is cheap, and it costs you later" gets its later.
   */
  MANAGER_AUTO_REPAIR_CONDITION: Object.freeze({
    novice: 0,
    steady: 0.35,
    veteran: 0.75,
  }),

  /**
   * Condition lost per banked hour of gym operation, per item. Wear is keyed
   * to banked seconds — the clock the player's own check-ins advance and the
   * cap discards absence out of — so time away beyond the offline horizon
   * wears nothing, and the same seconds that pay income are the seconds that
   * wear the equipment. At 0.002 an unrepaired item runs from new to fully
   * worn in 500 banked hours, about six weeks of daily 12-hour banking.
   */
  EQUIPMENT_WEAR_PER_BANKED_HOUR: 0.002,

  /**
   * The floor of the condition income multiplier, so a fully worn gym still
   * earns — §5.7's auto-deduction bounded away from a dead loop. A budget
   * with a measured lower bound, not a free knob: an extra banked hour pays
   * at least `rate x fraction x floor` and costs at most its own wear bill,
   * the top wage, and a tail of depressed future income bounded by
   * `rate x fraction x (1 - floor)` — the multiplier gap is at most
   * `(1 - floor) x wear` per extra hour and lasts at most `1 / wear` hours,
   * so the wear rate cancels out of the tail. Below the bound the tail
   * outweighs the hour and a player who checks in more can end poorer:
   * measured at 0.4, the engagement sweep reads 130 net-lower readings, the
   * exact shape CLAUDE.md's never-punish rule refuses. `management.test.ts`
   * pins the inequality; at 0.75 it holds with margin and the sweep is zero.
   */
  CONDITION_INCOME_MULTIPLIER_FLOOR: 0.75,

  /**
   * Gym Bucks to restore one full point of one item's condition, so a repair
   * cost is computable before the decision — §5.7's failure rule depends on
   * the cost having been shown. Cost of a repair = (1 - condition) times
   * this, scrubbed.
   */
  REPAIR_COST_GYM_BUCKS_PER_CONDITION_POINT: 400,

  /**
   * Below this many Gym Bucks, a repair's quoted cost is treated as dust and
   * the screen shows "nothing to repair" instead of a live repair control.
   *
   * PROVISIONAL — a game-feel/UX threshold (CLAUDE.md, "Game Feel Values
   * Must Be Tunable"), unverified by playtest. Needed because condition now
   * decays continuously with real wall-clock operation (the "kill the mint"
   * round): a freshly repaired item's cost is exactly 0 only for the instant
   * after the repair lands, and the very next real tick already wears it a
   * measurable float amount, so `cost === 0` almost never holds and a player
   * sees a live "repair for 0.000048" control that reads as broken.
   *
   * Derived from the real per-tick wear rather than picked freely: one
   * `WALL_CLOCK_TICK_INTERVAL_SECONDS` tick of operation wears
   * `EQUIPMENT_WEAR_PER_BANKED_HOUR x (WALL_CLOCK_TICK_INTERVAL_SECONDS /
   * SECONDS_PER_HOUR)` condition points, which costs that times
   * `REPAIR_COST_GYM_BUCKS_PER_CONDITION_POINT` to repair — at the shipped
   * values, 0.002 x (5 / 3600) x 400 ~= 0.0011 Gym Bucks per online tick.
   * 0.01 is about nine of those ticks (~45 real seconds), which is comfortable
   * margin against flicker on a single tick while staying two to four orders
   * of magnitude below any real repair price (`repairCostGymBucks` runs from
   * single digits to hundreds of Gym Bucks on the garage's own equipment
   * list). The exact multiple of a tick is a feel choice, not a derived
   * necessity, and is exactly the kind of number this file's own rule says a
   * human tunes by hand later.
   */
  DUST_REPAIR_COST_GYM_BUCKS: 0.01,

  /**
   * The fraction of the raw accrual a dormant (failed) gym still earns.
   * §5.7 says a failed location's income stops, and it also says failure is
   * recoverable rather than a permanent loss; on the single-gym ladder — the
   * stage-4 scope, portfolio excluded — those two sentences collide, because
   * the ladder is the one money source and a dormant gym with literally zero
   * income and an empty purse could not fund the recovery repairs from any
   * state, ever. This value resolves the collision in recoverability's
   * favour: dormancy collapses income to a crawl instead of a hard zero, so
   * the recovery quote is reachable from every state. Strictly above zero
   * (the recoverability rail) and strictly below the condition multiplier's
   * floor (dormancy is worse than the worst live gym) — both derived in
   * `management.test.ts`. Flagged in the module header as a derivation the
   * GDD's own §5.7 wording underdetermines, for a human to re-rule.
   */
  DORMANT_INCOME_MULTIPLIER: 0.1,

  /**
   * The condition that decides WHICH item a maintenance review names — the
   * worst-conditioned one — and the line `wornItems` and `warningSignsVisible`
   * read for the display surface. It no longer decides WHETHER a review is
   * raised; the two ordinal knobs below do that. See `management.ts` header
   * §3a for the §5.13/§5.7 ruling that split those two questions apart.
   */
  MAINTENANCE_PROMPT_CONDITION: 0.5,

  /**
   * The check-in index at which the gym raises its FIRST standing repair
   * order, counted in `ManagedGym.checkInsTaken`.
   *
   * PROVISIONAL — a game-feel value, to be tuned by hand (CLAUDE.md, "Game
   * Feel Values Must Be Tunable"). Nothing has playtested it. At 4, with the
   * garage banking a 12-hour horizon a day, the first review lands on a gym
   * at roughly 0.90 condition and quotes a repair of about 40 Gym Bucks —
   * cheap enough that declining it is a choice rather than a wall.
   *
   * It must be at or above 1: at 0 a freshly created gym would show a repair
   * order on equipment that has never been used, and `repairEquipment` would
   * refuse it as `already-sound`. `management.test.ts` pins that floor.
   */
  MAINTENANCE_ORDER_FIRST_CHECK_IN: 4,

  /**
   * Check-ins between one standing repair order and the next — the review
   * cadence. Orders open at `MAINTENANCE_ORDER_FIRST_CHECK_IN`, then every
   * `MAINTENANCE_ORDER_STRIDE` check-ins after it, and at no other check-in.
   *
   * PROVISIONAL, same as the knob above, and the reason it is an ORDINAL
   * rather than a condition is a ruling and a measurement rather than taste:
   * §5.7's clarification says low condition may SHOW a repair prompt and may
   * not advance a strike, and a review whose arrival is keyed to the check-in
   * INDEX cannot carry a wear difference into the strike ledger, because
   * enlarging a gap changes gap lengths and never the number of check-ins.
   * `management.ts` header §3a has the derivation and §3b the measurement.
   *
   * Must be at or above 1 — at 0 the cadence has no period and the modulo
   * that reads it is undefined. `management.test.ts` pins that floor too.
   */
  MAINTENANCE_ORDER_STRIDE: 4,

  /**
   * The condition below which the 'diligent' simulated-player policy repairs
   * an item when it can afford to. A model-of-a-player parameter the module
   * branches on, named here so the sweep's policies carry no bare number.
   * Deliberately below `MAINTENANCE_PROMPT_CONDITION`: the diligent model
   * lets condition reach the prompt line before its own sweep-up threshold,
   * so the prompt's repair arm is produced by a run rather than only by a
   * hand-built fixture.
   */
  REPAIR_POLICY_CONDITION: 0.45,

  /**
   * Prompt dismissals that do not count toward failure — §5.7's "ignoring an
   * in-session maintenance prompt more than once" as a value: the first
   * dismissal is free, every one after it is a counted decision.
   */
  MAINTENANCE_PROMPT_FREE_DISMISSALS: 1,

  /**
   * Counted bad decisions at which the warning state becomes visible — the
   * phase a screen must show before failure, so no failure arrives unwarned.
   */
  FAILURE_WARNING_STRIKES: 2,

  /**
   * Counted bad decisions at which the gym fails and goes dormant. Strictly
   * above the warning threshold, which `management.test.ts` derives.
   *
   * Provisional, and it moved with the §5.13 wear-basis ruling. The failure
   * ledger used to be unbounded — every refusal of a standing repair order
   * counted again — so any threshold was reachable by waiting. Under the
   * per-order ledger (`management.ts` header §3) a gym that never repairs can
   * refuse at most one order per owned item, which is
   * `LADDER_STARTING_EQUIPMENT.length` = 3 at the garage. A threshold of 4
   * would put pure neglect structurally out of reach of failure, which
   * contradicts §5.7's own list of failure drivers.
   *
   * THAT SENTENCE USED TO END "`management.test.ts` pins the relation rather
   * than the number", AND IT WAS FALSE — kept as a correction rather than
   * deleted, because the failure mode is this codebase's most repeated one.
   * The only relation asserted anywhere was `FAILURE_STRIKES >
   * FAILURE_WARNING_STRIKES`. A threshold of 4 would have reddened the suite,
   * but by accident, in a fixture indexing `items[FAILURE_STRIKES - 1]` —
   * which is a different check noticing, not this claim being checked.
   *
   * It is pinned now, in `management.test.ts`'s `pure neglect can reach
   * failure`, in both halves: the arithmetic relation against
   * `ownedItemsOf`'s real length, and the behaviour the relation exists for —
   * refusing every owned item's standing order once reaches `'failed'`, and
   * restating all of them adds nothing, so the item count really is the
   * ceiling.
   */
  FAILURE_STRIKES: 3,

  /**
   * There is deliberately NO dormancy entry slump here. It shipped at 0.25
   * for one round and the never-punish sweep measured it: a condition cliff
   * at the failure boundary is a money cost whose arrival time engagement
   * moves, so a gym that banked more operation paid it earlier. The
   * derivation, the counts and the control that keeps the removed mechanism
   * runnable are in `management.ts`'s header §4 — do not re-add a value here
   * without reading it.
   */

  /**
   * The condition every item must be restored to before a dormant gym can
   * come back online — §5.7's "a real repair investment" as a value the
   * recovery quote is computed from.
   */
  RECOVERY_CONDITION_MIN: 0.8,

  /**
   * S4h — GymScreen.tsx's own chrome, on the same terms as every other
   * screen-layout knob in this file: an untuned placeholder, legible and
   * self-consistent, not a value anybody has judged.
   *
   * WHY THIS BLOCK EXISTS AT ALL, rather than a bare number written into the
   * component: `src/tuning/audit.ts` classifies every `.tsx` file as a
   * `renderer` and refuses to let ANY file outside `SOURCE_RULES` hold a
   * named constant, `.tsx` included by that rule's own text — so a chrome
   * value belongs here on exactly the same terms `FLOOR_TILE_PIXELS` and
   * `FLOOR_GRID_BORDER_WIDTH_PIXELS` already do, not because GymScreen.tsx's
   * button chrome is "feel" in the animation-timing sense.
   *
   * The finding this round closes: a real phone playtest reported the screen
   * as non-interactive — every one of GymScreen.tsx's thirteen `Pressable`
   * elements shipped with no `style`, no `accessibilityRole`, and no
   * `cursor`, which is a known iOS Safari click-delegation gap for a
   * non-natively-interactive element. These sizes are what makes a control
   * visibly a control; `MIN_HEIGHT_PIXELS` is the Apple Human Interface
   * Guidelines' 44pt minimum tap target, the one number here with a real
   * external reference rather than a made-up round figure.
   */
  GYM_SCREEN_BUTTON_PADDING_VERTICAL_PIXELS: 10,
  GYM_SCREEN_BUTTON_PADDING_HORIZONTAL_PIXELS: 16,
  GYM_SCREEN_BUTTON_BORDER_RADIUS_PIXELS: 8,
  GYM_SCREEN_BUTTON_BORDER_WIDTH_PIXELS: 1,
  GYM_SCREEN_BUTTON_MIN_HEIGHT_PIXELS: 44,
  /**
   * The disabled-but-visible shortfall control's opacity (S4h Fix 2, the
   * buy-session row's unaffordable-but-reached arm) — how much dimmer than a
   * live control it reads. A fraction rather than a colour, so the same
   * enabled/disabled colour pair can express either state.
   */
  GYM_SCREEN_DISABLED_OPACITY: 0.5,

  /**
   * S4i — how much room `GymScreen.tsx`'s own `ScrollView` box reserves at
   * its bottom edge so its scrollport frame never extends under
   * `src/shell/AppShell.tsx`'s absolutely-positioned `BACK TO TRAINING` /
   * `shell-leave-gym` nav pill, at ANY scroll position — not only at
   * max-scroll, which is what `contentContainerStyle` padding alone would
   * buy and why this is a `marginBottom` on the box itself instead. A real
   * iPhone Safari playtest found the pill covering slot 2's
   * `stretching-yoga` and `rest` week-slot buttons; this is that clearance.
   *
   * THE NUMBER, AND WHERE IT CAME FROM. 82 = `NAV_BOTTOM_INSET` (44) +
   * `NAV_HEIGHT` (38), both read directly out of `src/shell/shellTuning.ts`
   * at the time this constant was written — NOT imported: `src/empire/`'s
   * own import fence (`empireCore.test.ts`, walked and pinned) permits
   * imports only from within this directory, so `src/shell/` cannot be a
   * live dependency here. This is therefore a CROSS-SESSION, READ-ONLY
   * OBSERVATION of another session's file, not a coupling — the same shape
   * as this file's own frozen `WALLET_CURRENCIES` and `FATIGUE_TUNING`
   * references. STATED PLAINLY: if Session A changes `NAV_BOTTOM_INSET` or
   * `NAV_HEIGHT`, this constant silently drifts out of sync with the real
   * pill footprint until someone notices the mismatch on a device and
   * re-derives it by hand. Nothing here re-checks the two source numbers
   * automatically.
   *
   * CLASSIFICATION AND CONFIDENCE. `'knob'`, same as every other
   * `GYM_SCREEN_*` layout value in this block — a UI clearance amount, not a
   * domain-correctness number, and PROVISIONAL: it is sized to exactly
   * cover the pill's own box with zero margin of its own, un-playtested
   * beyond the geometry check `tools/verify-floor-reachability.mjs` runs
   * under Chromium. CLAUDE.md's "Game Feel Values Must Be Tunable" applies
   * — this is the tunable version, not an asserted-correct one.
   */
  GYM_SCREEN_LEAVE_PILL_CLEARANCE_PIXELS: 82,

  // -------------------------------------------------------------------------
  // GDD §5.14 Stage B — the economy pacing simulator. `pacing.ts`.
  // -------------------------------------------------------------------------

  /**
   * Stage B's own fixed sampling grid, in seconds: ten simulated minutes, one
   * hour, day 1, day 3, day 7 — the five horizons CLAUDE.md's brief for this
   * round names by name. `pacing.ts`'s `pacingCheckInSchedule` reads this
   * once and forces a check-in at every mark at or under the run's own
   * horizon into EVERY simulated player's schedule, regardless of that
   * policy's own natural cadence, so a reading exists at exactly these five
   * real-elapsed-time marks for every check-in policy the sweep drives —
   * without this, a policy whose natural cadence never lands on, say, the
   * 10-minute or 1-hour mark (`once-a-day`, `few-times-a-day`, `sporadic`)
   * would have no reading to report there at all.
   *
   * NOT A FELT TUNING NUMBER AND NOT A BRANCH POINT: nothing in this
   * directory ever compares a caller-supplied quantity against one of these
   * five numbers. They are read whole, as gap targets folded into the same
   * schedule `ladderCheckIn`/`managedCheckIn`/`gymCheckIn` already take a
   * plain list of check-in seconds for — the identical shape
   * `LADDER_DEV_TIME_STEPS_SECONDS` already carries in this file, and for the
   * same reason: a sampling grain fed whole to a real check-in call, not a
   * threshold anything is measured against. Classified `structural` rather
   * than `knob`: moving one of these changes what question the simulator
   * answers, not how easy or hard the game is.
   */
  PACING_REPORT_HORIZONS_SECONDS: Object.freeze([600, 3600, 86400, 259200, 604800] as const),

  // -------------------------------------------------------------------------
  // GDD §5.14 Stage C — station-tap management. `FloorGrid.tsx`, `stationView.ts`.
  // -------------------------------------------------------------------------

  /**
   * The tap/drag disambiguation threshold, in pixels: a release whose total
   * accumulated movement (`PanResponderGestureState.dx`/`.dy`, via
   * `Math.hypot`) is at or under this is read as a TAP — selecting the
   * station under the finger rather than attempting a placement — and
   * anything past it is read as the drag `FloorGrid.tsx` already handled
   * before this round.
   *
   * SIZED AGAINST THE REAL DRAGS THIS DIRECTORY'S OWN BROWSER TOOL DRIVES,
   * NOT GUESSED: `tools/verify-floor-reachability.mjs`'s `dragBox` always
   * moves the pointer by at least `FLOOR_TILE_PIXELS * 0.25` (its smallest
   * targeted move, section 4's second drag) before release, several tiles in
   * the common case — so this threshold sits at a quarter of one tile,
   * comfortably under every real drag that tool drives and comfortably over
   * the few pixels of wobble a real finger's own touch-down has, without
   * having watched a real finger do it. PROVISIONAL, per CLAUDE.md's "Game
   * Feel Values Must Be Tunable": this is the tunable version, not a
   * playtested one.
   *
   * 7 = `FLOOR_TILE_PIXELS` (28) × 0.25, written as the literal because this
   * object cannot reference its own other keys while it is being built. Not
   * independently re-derived by a test — if `FLOOR_TILE_PIXELS` moves, this
   * value does not move with it, which is a real drift risk stated rather
   * than hidden.
   */
  STATION_TAP_MAX_DRAG_PIXELS: 7,

  /** The contextual station panel's own inner padding, on every edge. */
  FLOOR_STATION_PANEL_PADDING_PIXELS: 10,

  /**
   * The contextual station panel's outer border width — visually distinct
   * from `FLOOR_ITEM_BORDER_WIDTH_PIXELS`'s thin chip edges, since the panel
   * is a whole surface rather than a floor chip.
   */
  FLOOR_STATION_PANEL_BORDER_WIDTH_PIXELS: 2,

  /** Vertical gap between the panel and the grid/tray it sits below. */
  FLOOR_STATION_PANEL_MARGIN_TOP_PIXELS: 8,

  // -------------------------------------------------------------------------
  // GDD §5.14 Stage D / §5.15 Living Gym — Quality / Capacity / Throughput
  // -------------------------------------------------------------------------

  /**
   * The three station-upgrade axes Stage D proves as distinct mechanisms.
   * Order is the station panel's order: experience, then space, then speed.
   */
  STATION_UPGRADE_AXES: Object.freeze(['quality', 'capacity', 'throughput'] as const),

  /**
   * Stage D.1 slice: the one functional station the opening garage can
   * assemble. Equipment SKUs are not stations. Session equipment and a
   * future squat-rack stay at stock. Not a catalog expansion.
   */
  STATION_UPGRADE_SLICE: Object.freeze(['competition-bench-bay'] as const),

  /**
   * First-pass Gym Bucks cost of one axis on a stock slice station.
   * Quality 120 is closed (verdict B). Capacity 180 is the 3-hour garage
   * expansion at 60/hour. Throughput 30 is D2.1B's opening-agency price:
   * 30 watched minutes, the first action that addresses the visible queue.
   * They are not a retune of existing equipment SKUs.
   */
  STATION_UPGRADE_COST_GYM_BUCKS: Object.freeze({
    quality: 120,
    capacity: 180,
    throughput: 30,
  }),

  /** Stage D is one upgrade per axis. Not a tree. */
  STATION_UPGRADE_LEVEL_MAX: 1,

  /**
   * Extra simultaneous slots one capacity level adds. Stock is 1; a purchased
   * capacity level makes 1 + this. Stage D.1 realises those slots as a
   * second physical bench footprint adjacent to the primary, not as two
   * approach cells around one bench. A garage that cannot fit the second
   * bench is refused (`no-second-position`) rather than silently clamped.
   */
  STATION_CAPACITY_BONUS_SLOTS: 1,

  /**
   * Ticks a plate-tree bay holds a seat empty between users. Strictly below
   * `FLOOR_SIM_STATION_CHANGEOVER_TICKS` so the tree shortens loading, strictly
   * above 0 so a changeover still exists. The lifter's set
   * (`FLOOR_SIM_USE_TICKS_BY_TYPE`) is unchanged. D2.1B: this is Throughput's
   * mechanism, replacing the old use-duration factor.
   */
  STATION_THROUGHPUT_CHANGEOVER_TICKS: 6,

  /**
   * Training-experience value of one completed use at a stock station. Quality
   * does not change this station's slots or duration; it changes this number.
   * Not Gym Bucks. Not Career e1RM.
   */
  STATION_STOCK_TRAINING_EXPERIENCE: 1,

  /**
   * Training-experience value of one completed use at a Quality-upgraded
   * station. Distinct from stock so the Stage D experiment can see Quality
   * without looking at queue length. Stage E's reputation loop reads this;
   * Stage D's own causal reader is the affinity bonus below.
   */
  STATION_QUALITY_TRAINING_EXPERIENCE: 2,

  /**
   * Extra affinity a Quality-upgraded slice station adds on top of the
   * published type tables. Dimensionless, same unit as
   * `MEMBER_TYPE_BARBELL_AFFINITY`. Quality does not add a seat and does
   * not shorten a hold; it makes the station more appealing, so demand
   * shifts onto it when another station is available. D2 may retune the
   * magnitude. Zero would make Quality a paint-only axis.
   */
  STATION_QUALITY_AFFINITY_BONUS: 0.25,
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
  SECONDS_PER_MINUTE: 'structural',
  SECONDS_PER_DAY: 'structural',
  PRECISION_DECIMALS: 'structural',

  TICK_SECONDS: 'structural',
  MILLISECONDS_PER_SECOND: 'structural',
  CHECK_IN_TARGET_SECONDS_MIN: 'budget',
  CHECK_IN_TARGET_SECONDS_MAX: 'budget',
  OFFLINE_EARNINGS_NO_PUNISH_HOURS: 'budget',
  OFFLINE_EARNINGS_CAP_HOURS: 'knob',
  OFFLINE_EARNINGS_FRACTION: 'knob',
  WALL_CLOCK_TICK_INTERVAL_SECONDS: 'knob',

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
  SPORTING_REPUTATION: 'knob',
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
  LADDER_DEV_WATCHED_TIME_STEPS_SECONDS: 'knob',

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

  MEMBER_TYPES: 'structural',
  MEMBER_DUES_GYM_BUCKS_PER_DAY: 'knob',
  MEMBER_DUES_SATISFACTION_FLOOR: 'budget',
  MEMBER_TYPE_BARBELL_AFFINITY: 'knob',
  MEMBER_TYPE_ITEM_AFFINITY: 'knob',
  MEMBER_TYPE_CROWDING_SENSITIVITY: 'knob',
  MEMBER_CROWDING_SATISFACTION_FLOOR: 'budget',
  MEMBER_TYPE_CROWDING_LOAD_WEIGHT: 'knob',
  MEMBER_TYPE_REPUTATION_PER_MEMBER_PER_DAY: 'knob',
  MEMBER_EQUIPMENT_BIAS_TIE_TOLERANCE: 'budget',

  FLOOR_ROTATIONS: 'structural',
  FLOOR_LAYOUT_INITIAL_REVISION: 'structural',
  FLOOR_SAVE_SCHEMA_VERSION: 'structural',
  FLOOR_SAVE_LEGACY_SCHEMA_VERSION: 'structural',
  FLOOR_SQUAT_RACK_FOOTPRINT: 'knob',
  FLOOR_GRID_SIZE: 'knob',
  SESSION_EQUIPMENT_FOOTPRINT: 'knob',
  FLOOR_FIXED_FURNITURE_LAYOUT: 'knob',
  FLOOR_TILE_PIXELS: 'knob',
  FLOOR_TILE_PIXELS_MAX: 'knob',
  FLOOR_STAGE_PADDING_PIXELS: 'knob',
  CONDITION_PERCENT_SCALE: 'knob',
  FLOOR_GRID_BORDER_WIDTH_PIXELS: 'knob',
  FLOOR_GRID_LINE_WIDTH_PIXELS: 'knob',
  FLOOR_ITEM_BORDER_WIDTH_PIXELS: 'knob',
  FLOOR_TRAY_ITEM_MARGIN_PIXELS: 'knob',
  FLOOR_DRAGGING_Z_INDEX: 'knob',
  FLOOR_TRAY_ITEM_MIN_TILES: 'knob',
  FLOOR_OVERLAP_REFUSAL_FLASH_MS: 'knob',
  FLOOR_OVERLAP_REFUSAL_OUTLINE_WIDTH_PIXELS: 'knob',

  AMBIENT_MEMBER_COUNT_BY_RUNG: 'knob',
  AMBIENT_MEMBER_FOOTPRINT_TILES: 'knob',
  AMBIENT_MEMBER_PLACEMENT_STRIDE: 'knob',
  AMBIENT_MEMBER_BOB_AMPLITUDE_PIXELS: 'knob',
  AMBIENT_MEMBER_BOB_HALF_CYCLE_MS: 'knob',
  AMBIENT_MEMBER_BOB_STAGGER_LANES: 'knob',
  AMBIENT_MEMBER_BOB_STAGGER_STEP_MS: 'knob',

  FLOOR_SIM_STEP_PROGRESS_PER_TICK: 'knob',
  FLOOR_SIM_SPEED_JITTER_FRACTION: 'knob',
  FLOOR_SIM_USE_TICKS_BY_TYPE: 'knob',
  FLOOR_SIM_USE_TICKS_SPREAD: 'knob',
  FLOOR_SIM_QUEUE_MAX_LENGTH: 'knob',
  FLOOR_SIM_QUEUE_AVERSION_TILES: 'knob',
  FLOOR_SIM_AFFINITY_PULL_TILES: 'knob',
  FLOOR_SIM_TARGET_NOISE_TILES: 'knob',
  FLOOR_SIM_INTERRUPTED_BEAT_TICKS: 'knob',
  FLOOR_SIM_LEAVING_TICKS: 'knob',
  FLOOR_SIM_STATION_CHANGEOVER_TICKS: 'knob',
  FLOOR_SIM_WANDER_HOLD_TICKS: 'knob',
  FLOOR_SIM_ROUTE_VISIT_BUDGET: 'budget',
  FLOOR_SIM_MAX_RUN_TICKS: 'budget',

  FLOOR_SIM_TICK_INTERVAL_MS: 'knob',
  FLOOR_SIM_MOVE_TWEEN_MS: 'knob',
  FLOOR_SIM_RENDER_SEED: 'knob',
  LIVING_MEMBER_SERVICE_HISTORY_WINDOWS: 'knob',
  LIVING_MEMBER_SERVICE_HISTORY_WINDOW: 'knob',
  LIVING_MEMBER_WAIT_SHORT_MAX_TICKS: 'knob',
  LIVING_MEMBER_WAIT_LONG_MIN_TICKS: 'knob',
  LIVING_MEMBER_WAIT_VERY_LONG_MIN_TICKS: 'knob',
  LIVING_MEMBER_EXPERIENCE: 'knob',
  LIVING_MEMBER_RETENTION: 'knob',
  FLOOR_SIM_CUE_DIAMETER_FRACTION: 'knob',
  FLOOR_PLATE_LOADING: 'knob',
  FLOOR_SIM_CUE_GAP_PIXELS: 'knob',
  FLOOR_SIM_INTERRUPTED_CUE_SCALE: 'knob',
  FLOOR_SIM_LEAVING_OPACITY: 'knob',
  FLOOR_SIM_USING_ANCHOR_BIAS: 'knob',
  FLOOR_SIM_HIGHLIGHT_BORDER_WIDTH_PIXELS: 'knob',
  FLOOR_SIM_MEMBER_Z_INDEX: 'knob',
  FLOOR_SIM_STATION_HIGHLIGHT_Z_INDEX: 'knob',

  FLOOR_SPRITE_NATIVE_PIXELS_PER_TILE: 'knob',
  FLOOR_SPRITE_WALK_FRAME_TICKS: 'knob',
  FLOOR_SPRITE_REP_FRAME_TICKS: 'knob',
  FLOOR_SPRITE_BODY_PALETTE: 'knob',
  FLOOR_SPRITE_OUTFIT_PALETTE: 'knob',
  FLOOR_SPRITE_GEAR_PALETTE: 'knob',
  FLOOR_SPRITE_FLOOR_PALETTE: 'knob',
  FLOOR_SPRITE_LABEL_FONT_SIZE: 'knob',
  FLOOR_SPRITE_FLECK_STRIDE: 'knob',

  MANAGER_TIERS: 'structural',
  MANAGER_HIRE_COST_GYM_BUCKS: 'knob',
  MANAGER_WAGE_GYM_BUCKS_PER_BANKED_HOUR: 'knob',
  MANAGER_AUTO_REPAIR_CONDITION: 'knob',
  EQUIPMENT_WEAR_PER_BANKED_HOUR: 'knob',
  CONDITION_INCOME_MULTIPLIER_FLOOR: 'budget',
  REPAIR_COST_GYM_BUCKS_PER_CONDITION_POINT: 'knob',
  DUST_REPAIR_COST_GYM_BUCKS: 'knob',
  DORMANT_INCOME_MULTIPLIER: 'budget',
  MAINTENANCE_PROMPT_CONDITION: 'knob',
  MAINTENANCE_ORDER_FIRST_CHECK_IN: 'knob',
  MAINTENANCE_ORDER_STRIDE: 'knob',
  REPAIR_POLICY_CONDITION: 'knob',
  MAINTENANCE_PROMPT_FREE_DISMISSALS: 'budget',
  FAILURE_WARNING_STRIKES: 'budget',
  FAILURE_STRIKES: 'budget',
  RECOVERY_CONDITION_MIN: 'budget',

  GYM_SCREEN_BUTTON_PADDING_VERTICAL_PIXELS: 'knob',
  GYM_SCREEN_BUTTON_PADDING_HORIZONTAL_PIXELS: 'knob',
  GYM_SCREEN_BUTTON_BORDER_RADIUS_PIXELS: 'knob',
  GYM_SCREEN_BUTTON_BORDER_WIDTH_PIXELS: 'knob',
  GYM_SCREEN_BUTTON_MIN_HEIGHT_PIXELS: 'knob',
  GYM_SCREEN_DISABLED_OPACITY: 'knob',
  GYM_SCREEN_LEAVE_PILL_CLEARANCE_PIXELS: 'knob',

  PACING_REPORT_HORIZONS_SECONDS: 'structural',

  STATION_TAP_MAX_DRAG_PIXELS: 'knob',
  FLOOR_STATION_PANEL_PADDING_PIXELS: 'knob',
  FLOOR_STATION_PANEL_BORDER_WIDTH_PIXELS: 'knob',
  FLOOR_STATION_PANEL_MARGIN_TOP_PIXELS: 'knob',

  STATION_UPGRADE_AXES: 'structural',
  STATION_UPGRADE_SLICE: 'structural',
  STATION_UPGRADE_COST_GYM_BUCKS: 'knob',
  STATION_UPGRADE_LEVEL_MAX: 'budget',
  STATION_CAPACITY_BONUS_SLOTS: 'budget',
  STATION_THROUGHPUT_CHANGEOVER_TICKS: 'knob',
  STATION_STOCK_TRAINING_EXPERIENCE: 'knob',
  STATION_QUALITY_TRAINING_EXPERIENCE: 'knob',
  STATION_QUALITY_AFFINITY_BONUS: 'knob',
} as const satisfies Readonly<Record<keyof typeof EMPIRE_TUNING, EmpireTuningClass>>);
