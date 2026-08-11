/**
 * CAREER_TUNING — every number GDD §2.1 and §6.1 ask for, in one place.
 *
 * ---------------------------------------------------------------------------
 * Nothing here has been played. Read this before trusting a value.
 * ---------------------------------------------------------------------------
 * GDD §12.1 is explicit that a one-shot run delivers a tunable artifact and
 * that feel tuning happens afterwards, by hand, with people playing. Every
 * magnitude below is an untuned placeholder chosen to be legible and
 * internally consistent, not a value anybody has judged. The claim made for
 * them is weaker than "good", and it is the whole claim:
 *
 *   1. The ladder is not degenerate. Each tier up the local -> regional ->
 *      nationals -> worlds ladder asks for a bigger total, sits further apart
 *      on the calendar, and is reachable from the tier below it.
 *   2. The block is self-consistent. `careerTuning.test.ts` re-derives every
 *      ordering and every reachability relation from the values themselves
 *      rather than restating them here.
 *
 * Neither is a claim about feel, and neither is a claim that a qualifying
 * total is the number a real federation would print. See the classification
 * `design-table` below, which exists to say exactly that.
 *
 * ---------------------------------------------------------------------------
 * Why this file exists
 * ---------------------------------------------------------------------------
 * CLAUDE.md, "Game Feel Values Must Be Tunable": keep every such value as a
 * named constant in one place, never scattered as magic numbers across
 * components. This is that place for GDD §2.1 and §6.1, and it is the whole of
 * that place: `src/tuning/audit.ts` classifies every unregistered file as a
 * `renderer`, so a bare number anywhere else under `src/career/` fails the
 * suite by name, line and literal. `careerCore.test.ts` runs that same audit
 * over this directory from inside this piece's own suite, so the rule bites
 * here before it bites in the tree-wide run.
 *
 * Later Career pieces read this file and do not edit it, the way pieces E1-E5
 * read `src/empire/empireTuning.ts`.
 *
 * ---------------------------------------------------------------------------
 * Every entry is classified, and the classification is a value, not a comment
 * ---------------------------------------------------------------------------
 * `CAREER_TUNING_CLASSIFICATION` below gives every key of `CAREER_TUNING` one
 * of five classes. It is total by `satisfies`, so a key added without a class
 * is a compile error, and `careerTuning.test.ts` checks the two key sets both
 * ways.
 *
 *   - `knob`         — a playtester turns this freely.
 *   - `budget`       — a design budget GDD §6.6 states in prose. Moving it
 *                      changes what the design promises, so move it with a
 *                      reason.
 *   - `refusal`      — a GDD §12.3 refusal condition wearing a constant's
 *                      clothes. Do not turn it.
 *   - `structural`   — a unit or a vocabulary. Changing one does not make the
 *                      game easier, it makes it wrong or a different game.
 *   - `design-table` — a table SHAPED LIKE published domain data that is not
 *                      published domain data. The fifth class exists because
 *                      of one entry, `QUALIFYING_TOTAL_KG_BY_TIER`, and
 *                      because the mistake it guards against is specific:
 *                      CLAUDE.md's "Domain Correctness" section lists RPE,
 *                      Epley and DOTS as things a real powerlifter can check
 *                      and that must therefore not be homebrewed. A qualifying
 *                      total looks like it belongs on that list and does not —
 *                      it is a difficulty knob wearing a rulebook's clothes.
 *                      Every `design-table` entry carries the phrase "not a
 *                      published standard" in the docstring above it, and
 *                      `careerTuning.test.ts` reads this file's own source to
 *                      check that. What that check can do is notice the
 *                      sentence being deleted; it cannot notice the sentence
 *                      becoming untrue, and no scan can.
 *
 * ---------------------------------------------------------------------------
 * What is deliberately not here
 * ---------------------------------------------------------------------------
 *   - DOTS coefficients, the RPE chart and Epley's divisor. Those are
 *     published domain data and they live in `src/game/dots.ts`,
 *     `src/game/rpe.ts` and `src/game/e1rm.ts`. Nothing in `src/career/`
 *     restates one, and nothing here derives a score.
 *   - The qualifying-total PREDICATE. `meetsQualifyingTotal` is
 *     `src/game/progression.ts`'s, it takes a server-confirmed total by type,
 *     and `src/career/` must not import it. `careerCore.ts` takes the gate as
 *     a parameter; see its header.
 *   - Meet-day pacing, judging thresholds, the walk-out beat. Those are
 *     `MEET_TUNING` in `src/game/meetTuning.ts`. This file holds the calendar,
 *     not the meet.
 *   - Bodyweight classes. A meet has them (`dots.ts` carries the published
 *     lists) and this calendar deliberately does not qualify by them; see
 *     `QUALIFYING_TOTAL_KG_BY_TIER`.
 *   - A real federation name. Every name in `FEDERATIONS` is invented. GDD
 *     §12.3 refuses a real, named athlete, brand or company in any string or
 *     code path, and §2.1's "pick a federation" is the player-facing kind of
 *     name that condition is about rather than a structural citation of a body
 *     whose published rule is being implemented. `careerCore.test.ts` runs
 *     `src/licensing/realIp.ts`'s watchlist over every string in this
 *     directory, and pins the invented names exactly so a fifth one is a
 *     decision somebody signs. That check cannot tell a real name from an
 *     invented one — that is the human, name-by-name pass §12.3 asks for on
 *     every piece — but it makes a watched name arriving loud instead of
 *     quiet.
 *
 * Purity: zero React, zero side effects, zero I/O, no clock, no randomness,
 * no imports at all. It is a leaf so every later Career piece can read it
 * without any of them importing each other.
 */

/** The five classes an entry can carry. There is no sixth and no "probably". */
export const CAREER_TUNING_CLASSES = [
  'knob',
  'budget',
  'refusal',
  'structural',
  'design-table',
] as const;

export type CareerTuningClass = (typeof CAREER_TUNING_CLASSES)[number];

export const CAREER_TUNING = Object.freeze({
  // -------------------------------------------------------------------------
  // Vocabulary (structural)
  //
  // The words GDD §2.1 and §6.1 use, as values. Every type in `careerCore.ts`
  // is derived from one of these rather than hand-written beside it, so a
  // fifth tier is one edit and not two.
  // -------------------------------------------------------------------------

  /**
   * The tier ladder, in GDD §6.1's own order and words: "select a meet from
   * the Career calendar (local -> regional -> nationals -> worlds), gated by
   * qualifying totals".
   *
   * Order is load-bearing rather than cosmetic: `careerTierRank` is this
   * array's index, and every ordering assertion in this piece — qualifying
   * totals rising, meets sitting further apart, a nationals slot outranking a
   * local one — is stated against that rank.
   */
  MEET_TIERS: Object.freeze(['local', 'regional', 'nationals', 'worlds'] as const),

  /**
   * GDD §2.1's equipment axis: "pick a federation (raw / equipped / tested /
   * untested)". Two of those four words are the equipment division and two are
   * the drug-testing policy, so the sentence is two axes rather than one
   * four-way choice, and they are two arrays here for that reason.
   */
  EQUIPMENT_DIVISIONS: Object.freeze(['raw', 'equipped'] as const),

  /** GDD §2.1's testing axis, the other half of that sentence. */
  TESTING_POLICIES: Object.freeze(['tested', 'untested'] as const),

  /**
   * The two categories a qualifying total is published against.
   *
   * Named for the competition category rather than for sex because the meet
   * already uses the word "division" for the age/experience division —
   * `MEET_ENTRY.division` in `src/game/meetTuning.ts` is `'Open'` — and two
   * meanings of one word one screen apart is the defect GDD §6.5 records
   * about the word "PR".
   *
   * Mapping one of these to `dots.ts`'s `DotsSex` is the wiring piece's job.
   * `src/career/` does not import `dots.ts` and computes no score.
   */
  QUALIFYING_CATEGORIES: Object.freeze(['mens', 'womens'] as const),

  /**
   * The federations §2.1 lets a player pick between. All four are invented.
   *
   * Four rather than three or ten: the four rows are exactly the four
   * combinations of `EQUIPMENT_DIVISIONS` x `TESTING_POLICIES`, so §2.1's
   * sentence is covered once each and no combination is missing.
   * `careerTuning.test.ts` derives that cover from the two arrays instead of
   * counting to four here.
   *
   * `meetPrefix` is the word a meet's name is built from, so
   * "Cragmoor Barbell Federation" runs the "Cragmoor Open". It is a separate
   * field rather than the first word of `name` because a federation whose
   * meets are named after something other than its first word is an ordinary
   * thing and splitting it later would be a data migration.
   *
   * On the first row specifically: `MEET_LOCAL` in `src/game/meetTuning.ts`
   * already ships `federation: 'Cragmoor Barbell Federation'` and
   * `name: 'Cragmoor Open'`, invented there on purpose — its own comment cites
   * GDD §11 leaving real-federation licensing open. This row is the same two
   * strings so the one meet the prototype ships has a home on the ladder
   * rather than belonging to a federation the Career screen has never heard
   * of. Nothing imports across that seam; `careerCore.test.ts` reads
   * `meetTuning.ts` as text and pins both strings, so a rename on either side
   * is red rather than a quiet divergence.
   */
  FEDERATIONS: Object.freeze([
    {
      id: 'cragmoor-barbell-federation',
      name: 'Cragmoor Barbell Federation',
      meetPrefix: 'Cragmoor',
      equipment: 'raw',
      testing: 'tested',
    },
    {
      id: 'tarnwick-powerlifting-union',
      name: 'Tarnwick Powerlifting Union',
      meetPrefix: 'Tarnwick',
      equipment: 'raw',
      testing: 'untested',
    },
    {
      id: 'sablecoast-strength-alliance',
      name: 'Sablecoast Strength Alliance',
      meetPrefix: 'Sablecoast',
      equipment: 'equipped',
      testing: 'tested',
    },
    {
      id: 'orrenford-barbell-league',
      name: 'Orrenford Barbell League',
      meetPrefix: 'Orrenford',
      equipment: 'equipped',
      testing: 'untested',
    },
  ] as const),

  /**
   * What a meet at each tier is called, after the federation's `meetPrefix`.
   *
   * Generic competition descriptors, deliberately: "Open" and "National
   * Championships" are what the events are, not what anybody has named them.
   * The `local` entry is `'Open'` so that the first row of `FEDERATIONS`
   * produces "Cragmoor Open", which is the name `MEET_LOCAL` already ships.
   */
  MEET_TITLE_BY_TIER: Object.freeze({
    local: 'Open',
    regional: 'Regional Championships',
    nationals: 'National Championships',
    worlds: 'World Championships',
  }),

  // -------------------------------------------------------------------------
  // Qualification
  // -------------------------------------------------------------------------

  /**
   * The total, in kilograms, a lifter must already have to enter a tier.
   * `null` is an open tier: no qualifying total, anybody may enter.
   *
   * A DESIGN TABLE AND NOT A PUBLISHED STANDARD. Real federations publish
   * qualifying totals per weight class, per age division, per equipment
   * division and per year, and they differ between federations by more than
   * the numbers below differ between tiers. Nothing here is transcribed from
   * one and nothing here should be read as one. It is classified
   * `design-table` for that reason and it is the only entry in this file that
   * is: CLAUDE.md's "Domain Correctness" list — RPE, Epley, DOTS, meet
   * structure — is the set of things a real powerlifter can check against a
   * source, and a qualifying total is not on it. It is a difficulty threshold,
   * which GDD §12.1 says is tuned by hand by playing.
   *
   * What is deliberately missing, said rather than implied: bodyweight. A real
   * qualifying schedule is a grid of class x category, so a 47 kg lifter and a
   * 120 kg lifter are asked for very different totals. This table asks both
   * for the same one. That is a simplification a human may replace, and the
   * shape of the replacement is a third key on the record rather than a change
   * to anything that reads it — `qualifyingTotalKgFor` is the one reader.
   *
   * The magnitudes are placeholders sitting deliberately inside the range
   * `MEET_LOCAL.ghostTotalsKg` already spans (380 to 632.5 kg on a men's
   * field), so the ladder is reachable from the one meet the prototype ships
   * rather than being a wall.
   */
  QUALIFYING_TOTAL_KG_BY_TIER: Object.freeze({
    local: Object.freeze({ mens: null, womens: null }),
    regional: Object.freeze({ mens: 450, womens: 260 }),
    nationals: Object.freeze({ mens: 570, womens: 340 }),
    worlds: Object.freeze({ mens: 680, womens: 415 }),
  }),

  // -------------------------------------------------------------------------
  // Calendar cadence
  //
  // GDD §6.6 states all four of these in prose: "Weekly/biweekly cadence keeps
  // Career progression steady" for local and regional, and "Quarterly
  // Nationals, annual Worlds — scarcity keeps them special".
  // -------------------------------------------------------------------------

  /**
   * How many days apart two meets of the same tier sit, per tier.
   *
   * Whole weeks on purpose: a meet is a weekend, and an interval that is not a
   * multiple of seven walks a fixture through the working week. 91 is thirteen
   * weeks — §6.6's "quarterly" — and 364 is fifty-two, its "annual".
   *
   * A knob a playtester turns freely, with one thing that is not a knob: the
   * ORDER. Nationals must not come round more often than regionals, or §6.6's
   * "scarcity keeps them special" is a sentence with nothing behind it, and
   * `careerTuning.test.ts` derives that ordering from the tier rank rather
   * than restating it here.
   */
  MEET_INTERVAL_DAYS_BY_TIER: Object.freeze({
    local: 7,
    regional: 14,
    nationals: 91,
    worlds: 364,
  }),

  /**
   * The day index the first meet of each tier sits on, counted from the
   * career's day zero.
   *
   * Day indices rather than dates, everywhere in this piece: `src/career/`
   * reads no clock and constructs no `Date`, so turning an index into the
   * `YYYY-MM-DD` string `MeetDefinition.dateIso` wants is the caller's job and
   * the epoch lives with the caller. A pure module that invents a date invents
   * a timezone with it.
   *
   * The four are distinct so day zero is not four meets at once, and each is
   * at least a week out so a new lifter is not asked to pick a meet on the day
   * they make an account.
   */
  FIRST_MEET_DAY_BY_TIER: Object.freeze({
    local: 7,
    regional: 21,
    nationals: 49,
    worlds: 168,
  }),

  /**
   * How far ahead of today a meet becomes visible and selectable, in days.
   *
   * Wide enough that the first worlds slot (day 168, above) is on screen for
   * most of the run-up to it, and narrow enough that the calendar is a
   * shortlist rather than a decade. A knob, and the one most likely to move
   * once somebody sees the screen: it decides how many rows a player scrolls.
   */
  CALENDAR_VISIBLE_DAYS_AHEAD: 120,

  /**
   * The minimum number of days between two meets the same lifter enters.
   *
   * GDD §6.6's biweekly cadence as a rule rather than as a comment. A lifter
   * who competed on Saturday does not compete again on Sunday, and a calendar
   * that let them would make the local tier a grind rather than a fixture.
   *
   * Classified `budget` and keyed to CALENDAR DAYS BETWEEN MEETS, which is the
   * part worth reading twice. GDD §4.4 measured what happens when a
   * restriction is keyed to something the player does daily: a covered day
   * granted on a fixed calendar day gives 0 violating pairs, one granted every
   * N sessions gives 1156 at 100 days. This gap reads a meet entry and
   * nothing else — not sessions, not streak length, not check-ins — and the
   * structural half of that claim is `CareerLifter`'s field list, pinned in
   * `careerCore.test.ts` so a training-shaped field arriving on it is red.
   * A playtester may make this ten days. Nobody may make it ten sessions.
   */
  MIN_DAYS_BETWEEN_ENTERED_MEETS: 14,

  /**
   * The most slots one call to `buildCareerCalendar` may produce.
   *
   * Not a knob and not a design budget — a guard on a loop whose length is an
   * argument. A caller that asks for a thousand-year horizon gets a
   * `RangeError` naming this constant rather than an array nothing can draw.
   * Raise it if a screen ever needs more; it is not a balance value.
   */
  CALENDAR_MAX_SLOTS: 512,
});

/**
 * The class of every entry above, as a value a test can walk.
 *
 * Total by `satisfies`, so an entry added to `CAREER_TUNING` without a class
 * is a compile error rather than an unclassified number in a file whose whole
 * job is that there are none of those.
 */
export const CAREER_TUNING_CLASSIFICATION = Object.freeze({
  MEET_TIERS: 'structural',
  EQUIPMENT_DIVISIONS: 'structural',
  TESTING_POLICIES: 'structural',
  QUALIFYING_CATEGORIES: 'structural',
  FEDERATIONS: 'structural',
  MEET_TITLE_BY_TIER: 'structural',

  QUALIFYING_TOTAL_KG_BY_TIER: 'design-table',

  MEET_INTERVAL_DAYS_BY_TIER: 'knob',
  FIRST_MEET_DAY_BY_TIER: 'knob',
  CALENDAR_VISIBLE_DAYS_AHEAD: 'knob',
  MIN_DAYS_BETWEEN_ENTERED_MEETS: 'budget',
  CALENDAR_MAX_SLOTS: 'structural',
} as const satisfies Readonly<Record<keyof typeof CAREER_TUNING, CareerTuningClass>>);
