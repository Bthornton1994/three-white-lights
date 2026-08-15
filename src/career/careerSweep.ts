/**
 * careerSweep.ts — the inputs the career eligibility measurement runs on, and
 * the two controls it is measured against.
 *
 * Pure: zero React, zero side effects, zero I/O, no clock, no `Math.random`.
 * Every sequence below is a pure function of a seed written down here.
 *
 * ===========================================================================
 * WHY A MODULE AND NOT A HELPER IN THE TEST
 * ===========================================================================
 * The same reason `src/game/streakSweep.ts` exists, and that file says it at
 * length: a measurement whose inputs are not written down is an anecdote. The
 * streak measurement was first published with its seeds unstated and could not
 * afterwards be reproduced by anyone, including its author. So the grid, the
 * seeds, the distribution and the window live here as named constants, and
 * `eligibility.test.ts` measures through them.
 *
 * Registered in `src/tuning/audit.ts` as `data`, not `feel`, and deliberately
 * absent from `src/tuning/index.ts`: turning a seed does not change the game,
 * only which careers the property is checked on. A playtester has no business
 * in this file.
 *
 * ===========================================================================
 * THE PROPERTY, AND THE TWO AXES IT IS MEASURED ON
 * ===========================================================================
 * GDD §12.3 refuses "an injury or setback that punishes a player for showing up
 * daily", and CLAUDE.md turns that into a comparison between two lifters
 * identical except that one did more. For a career calendar the two readings of
 * "more" are different questions and both are measured:
 *
 *   AXIS A — STRENGTH. Two lifters whose best Total differs. The stronger one
 *   must qualify for a superset of the meets, never a smaller set. Exhaustive
 *   over a grid, so it is a proof over the grid rather than a sample.
 *
 *   AXIS B — ATTENDANCE, THROUGH QUALIFICATION. Two careers identical except
 *   that one lifter competed at one extra meet. The lifter who competed more
 *   must qualify for a superset at the same later day. Sampled from seeds,
 *   because the space of careers is not enumerable.
 *
 *   AXIS C — ATTENDANCE, THROUGH ENTRY. The same two careers, asked what they
 *   may enter rather than what they qualify for. Entering a dated meet spends
 *   it, so the lifter who competed more does hold a shorter list — and the
 *   property is that the difference is exactly the meets they went to and
 *   nothing else. See the block on `ENTRY_VARIANTS` for why this axis needs its
 *   own evaluation lag, and `eligibility.test.ts` for the counts.
 *
 * WHY B AND C ARE TWO AXES AND NOT ONE, since they run on the same fixture:
 * they read different functions. `qualifiedMeets` filters on the federation and
 * the Total, and never looks at `enteredMeetIds`; `enterableMeets` filters
 * through `entryVerdict`, which does. A break in either one leaves the other
 * green, which `eligibility.test.ts` measures rather than asserts.
 *
 * A ZERO WITH NO CONTROL BESIDE IT IS A ZERO ABOUT NOTHING, so each axis ships
 * with a rule that breaks it, and the test pins the control's non-zero count
 * next to the shipped zero. Every control is a design somebody could plausibly
 * have written, which is what makes them worth keeping:
 *
 *   - `highest-tier-band` — a lifter may only enter the top tier they qualify
 *     for, which is a real anti-sandbagging idea and which makes getting
 *     stronger take meets away.
 *   - `latest-total-wins` — qualification reads the last total instead of the
 *     best, which is how a "current form" system would naturally be written and
 *     which makes a bad meet day cost a lifter meets they had already earned.
 *   - `entry-cooldown` — a mandatory rest after a meet, which is the most
 *     plausible of them because real federations do impose one, and which
 *     charges the lifter who competed more with a lockout the lifter who stayed
 *     home does not pay.
 *   - `worlds-cooldown-*` — that same rest charged after the annual
 *     championship and after nothing else. Three of them, pointed at the
 *     calendar's first, second and third worlds meets, because which of those
 *     three a simulated career can be standing on is the whole question this
 *     round was about.
 *   - `worlds-reset-*` — the annual result taken as the lifter's ranking total
 *     instead of their best. Three again, and the middle one NOW BITES: see the
 *     block above `ENTRY_VARIANTS`. It used to measure zero with 27.5 kg of
 *     daylight, because the unbounded totals generator had taken every career
 *     far past the 650 kg bar by the time a worlds meet came round. Bounding the
 *     generator closed that gap and the control started firing without a line of
 *     it being edited — which is the same lesson as the `DELAYED_FORM_*` block's,
 *     read from the other direction: a control's zero can be a fact about the
 *     fixture rather than about the rule, and only a fixture change tells you
 *     which it was.
 */

import { nextRandom, seedState } from '../game/prng';
import { addDays, type StreakDay } from '../game/streak';
import { CAREER_TUNING, type CareerFederationId, type CareerMeetTier } from './careerTuning';
import { entryTier, tierIndex, tiersLowestFirst } from './federation';
import {
  careerMeetFor,
  qualifyingTotalKgFor,
  scheduledMeets,
  seasonAnchorDay,
  tierSeriesStartDay,
  type CareerMeet,
} from './calendar';
import {
  canEnter,
  careerRecordAfterMeet,
  enterableMeets,
  meetsQualifyingTotal,
  newCareerLifter,
  qualifiesFor,
  type CareerLifter,
} from './eligibility';

// ---------------------------------------------------------------------------
// Axis A — strength
// ---------------------------------------------------------------------------

/**
 * The grid of best Totals the strength axis is swept over, and the calendar
 * window the comparison is made in.
 *
 * `null` — a lifter who has never competed — is the bottom of the grid and is
 * included as a value rather than tested separately: it is the state every
 * career starts in and the one place a `>=` comparison has nothing to compare.
 *
 * The step is 2.5 kg because that is the smallest weight a competition bar can
 * move by (`MIN_ATTEMPT_INCREMENT_KG` in `src/game/meet.ts`), so it is the
 * finest grid a real total can land on. The ceiling is comfortably past the
 * heaviest total the sport has seen, so the grid covers every qualifying total
 * this game could reasonably ship and a long way either side.
 */
export const STRENGTH_SWEEP = Object.freeze({
  MIN_TOTAL_KG: 0,
  MAX_TOTAL_KG: 1000,
  STEP_KG: 2.5,
  /** Days after the season anchor the comparison window opens. */
  WINDOW_START_OFFSET_DAYS: 0,
  /** How long that window is. A year, so every tier occurs in it. */
  WINDOW_DAYS: 364,
  /** Whose calendar. Any federation gives the same shape; one is swept. */
  FEDERATION: 'meridian' as CareerFederationId,
});

/**
 * Every best Total on the grid, lowest first, with `null` at the bottom.
 *
 * Ordered so that index order is total order: `i < j` implies the value at `i`
 * is a smaller total than the value at `j`, with `null` — no total at all —
 * below every number.
 */
export function strengthGrid(): readonly (number | null)[] {
  const totals: (number | null)[] = [null];
  const steps = Math.round(
    (STRENGTH_SWEEP.MAX_TOTAL_KG - STRENGTH_SWEEP.MIN_TOTAL_KG) / STRENGTH_SWEEP.STEP_KG,
  );
  for (let index = 0; index <= steps; index += 1) {
    totals.push(STRENGTH_SWEEP.MIN_TOTAL_KG + index * STRENGTH_SWEEP.STEP_KG);
  }
  return totals;
}

// ---------------------------------------------------------------------------
// Axis B — attendance
// ---------------------------------------------------------------------------

/**
 * The careers the attendance axes are sampled from.
 *
 * A career here is a list of meet totals, one per meet the lifter attends, in
 * calendar order. The comparison is a career against the same career with one
 * meet removed, which is the single-superset shape `streakSweep.ts` uses for
 * training days: everything else about the two lifters is identical.
 *
 * The sequence of totals is deliberately two-sided. A distribution that only
 * ever went up would make the latest-total control produce zero violations and
 * the whole comparison would report a clean bill for a rule that is broken — an
 * empty domain reproduced in the one place it would not be noticed.
 * `BAD_DAY_SHARE` and `BAD_DAY_MAX_SHARE` are what keep it non-empty, and the
 * test pins how many descents the sweep actually produced rather than trusting
 * this comment.
 *
 * NOTE WHICH LAYER IS TWO-SIDED, BECAUSE THE GENERATOR HAS TWO NOW. Capability
 * only climbs; what a lifter puts up on the day is capability less a bad-day
 * share, so the TOTALS go down and up while the strength behind them does not.
 * `seededCareerTotals` carries the argument for splitting them. The property
 * the controls need is a property of the totals, and it is unchanged.
 *
 * ===========================================================================
 * HOW DEEP A CAREER THIS RUNS ON, AND WHERE THAT DEPTH CAME FROM
 * ===========================================================================
 * The first version of this block held the simulation at 14 meets, by giving
 * the lifter a self-imposed 28-day rest between meets. That rest was invented
 * here and it was the load-bearing parameter in the whole measurement: a
 * current-form rule that switched on after a lifter's 16th meet was invisible,
 * because no lifter in the sweep ever had a 16th meet. That rule is now three
 * controls rather than a sentence — `delayed-form-inside`,
 * `delayed-form-past-visible` and `delayed-form-past-the-edge` below — and
 * `eligibility.test.ts` runs it on both sides of the depth this file reaches.
 *
 * The second version fixed that and left the same hole one axis over. It ran
 * for one calendar period, and the single worlds meet a period holds falls six
 * days after the anchor with three meet days in front of it — so the most a
 * lifter could be holding when it came round was 380 + 3 x 20 = 440 kg against
 * a 650 kg bar. Every career in the sweep was 77 to 82 meets deep and none of
 * them entered a worlds meet, so a rule keyed to the top tier was as invisible
 * as the 16th-meet rule had been. That hole is now three controls —
 * `worlds-reset-first`, `worlds-reset-second` and `worlds-reset-third` — and
 * closing it cost a longer simulation rather than a denser one.
 *
 * So the four numbers that decide the depth are read off the shipped calendar
 * instead of chosen here, and `eligibility.test.ts` asserts each of them
 * against `CAREER_TUNING` and `scheduledMeets` rather than against this
 * comment:
 *
 *   - `MIN_DAYS_BETWEEN_MEETS` is 1, the calendar's own resolution, which is to
 *     say this file imposes no rest at all. What limits attendance is then the
 *     schedule and the qualifying totals, both of which are the game's.
 *   - `CALENDAR_PERIOD_DAYS` is 364. For the shipped cadences — 7, 14, 91 and
 *     364 days — that is the exact period of the calendar: every cadence
 *     divides it, so the pattern of meet days repeats from there. It is also
 *     `CAREER_TUNING.HORIZON_DAYS`, the span a calendar screen draws.
 *   - `CALENDAR_PERIODS` is 2, and it is the number this round moved. One
 *     period is the shortest simulation that shows a whole calendar; two is the
 *     shortest that shows a REACHABLE worlds meet, because the first occurrence
 *     of an annual series is six days after the anchor and the second is 370.
 *     `SIMULATION_DAYS` is their product, 728 days.
 *   - `MEETS_PER_CAREER` is 171, the number of meets two periods hold, which is
 *     the ceiling on a career the simulation can produce: one meet a day at
 *     most, and every meet distinct.
 *
 * WHAT DEPTH STILL DOES NOT REACH, stated because a widened domain invites the
 * assumption that it is now complete, and pinned as controls rather than as
 * this sentence. There are three edges and they are not all at the far end:
 *
 *   - A rule keyed to a lifter's 168th meet. The deepest career here is 167.
 *     `delayed-form-past-the-edge` is that edge as a measured zero, and the
 *     count of careers deep enough to reach it is pinned at 0 beside it.
 *   - A rule keyed to the THIRD occurrence of the annual series, on day 734.
 *     Two periods hold two of them, at days 6 and 370.
 *     `worlds-cooldown-third` is that edge as a measured zero.
 *   - A rule keyed to the FIRST occurrence, on day 6. That one is inside the
 *     calendar and outside every career, because no lifter can hold 650 kg six
 *     days in. `worlds-cooldown-first` is that as a measured zero too, and it
 *     is the sharper half of the pair: an edge can sit in the middle of a
 *     domain as well as at its end, and a reader counting worlds meets on the
 *     calendar would have assumed both were reachable.
 *
 * AND ONE BLIND SPOT THAT WAS NOT AN EDGE AT ALL, KEPT HERE BECAUSE BOUNDING
 * THE GENERATOR CLOSED IT AND THE BEFORE-AND-AFTER IS THE POINT. The
 * qualification axis used to see the worlds-keyed record rule nowhere in this
 * fixture, and the reason was a margin of 27.5 kg: the lowest total anybody put
 * up at a competitive worlds meet was 677.5 against a top qualifying total of
 * 650, so a rule that rewrote their record with it still left them clearing
 * every bar on the ladder. That paragraph warned it was "a fact about these 24
 * seeded careers and the shipped qualifying totals, not a theorem", and that
 * the margin could move with nothing here having to change.
 *
 * It moved. Under the bounded generator the lowest total put up at a
 * competitive worlds meet was 632.5 kg — 17.5 kg BELOW the bar rather than 27.5
 * above it — because a career now plateaus somewhere in
 * `[POTENTIAL_MIN_KG, POTENTIAL_MAX_KG]` instead of climbing out of the
 * ladder's range, and a bad day at the plateau lands under the top gate.
 * `worlds-reset-second` reports a non-zero, and `eligibility.test.ts` pins it
 * with the margin beside it.
 *
 * IT MOVED AGAIN WHEN `MAX_GAIN_KG` WENT TO 20, AND THE SIGN DID NOT. The
 * lowest worlds-day total is now 640 kg, so the margin is -10 kg rather than
 * -17.5. The reason is a different one, which is why it is recorded rather than
 * just re-pinned: a slower career is not at its plateau by the time the day-370
 * meet comes round, so the totals put up there are near the 650 kg bar from
 * BELOW rather than a haircut off a plateau above it. Same conclusion, thinner
 * margin, different cause.
 *
 * The general form, which is worth more than either number: A CONTROL
 * REPORTING ZERO IS EVIDENCE ABOUT THE RULE ONLY IF THE FIXTURE CAN REACH THE
 * CASE, and whether it can is a property of the fixture that nothing in the
 * control's own file tracks. Two of this module's zeros were fixture facts
 * wearing the costume of rule facts, and both were found by changing the
 * fixture rather than by reading the checks.
 *
 * A finite domain has an edge wherever it is drawn; what changed is where, and
 * that every edge is now a number a test pins rather than a sentence.
 */
export const ATTENDANCE_SWEEP = Object.freeze({
  SEEDS: Object.freeze([
    20260812, 913377, 4242, 60103, 771, 1, 99991, 314159, 2718281, 17, 555555, 8675309,
    31, 4096, 123456789, 7, 202601, 88, 65537, 1048576, 999, 24601, 5150, 42424242,
  ]),
  /**
   * How many totals are drawn per career, and the deepest career the simulation
   * can produce. Read off the calendar: 105 local, 52 regional, 8 nationals,
   * 4 campaign summits and 2 competitive ones across the two periods the
   * simulation runs for.
   */
  MEETS_PER_CAREER: 171,
  /** The first meet's total, in kg. Below the regional bar, so it can climb through it. */
  FIRST_TOTAL_KG: 380,
  /**
   * The most a single meet may add to a lifter's CAPABILITY, in kg, and it is
   * reached only at the very first meet.
   *
   * The gain is `draw x MAX_GAIN_KG x headroom^GAIN_DECAY_EXPONENT`, and
   * headroom is 1 exactly once — at the opening total, before anything has been
   * gained. So `FIRST_TOTAL_KG + n x MAX_GAIN_KG` is still a strict upper bound
   * on what a lifter can be holding after `n` meets, which is the arithmetic
   * `eligibility.test.ts` uses to prove the day-6 worlds meet unreachable, and
   * that proof survives every value below unchanged.
   *
   * ===========================================================================
   * 20, PROVISIONAL — PENDING PLAYTEST. RULED BY A HUMAN, 2026-08-15.
   * ===========================================================================
   * It was 70, and the block that shipped 70 said in its own words that 70 was
   * wrong: "a 70 kg jump on a 380 kg opening total is 18% in one meet, and no
   * lifter does that … bounding the RANGE and bounding the RATE are two axes;
   * this block moves the first and leaves the second where it found it." This
   * is that second axis, moved.
   *
   * PROVISIONAL in the same sense as GDD §6.3's PR-attempt wording and §6.2's
   * crowd-reaction beat: it ships, and it is explicitly awaiting a human verdict
   * from real play. What is settled is the DIRECTION and the shape of the trade.
   * What is NOT settled is where inside the band a campaign should sit, because
   * that is a felt question about pacing and nobody has played a career. Do not
   * read the table below as saying 20 is right; it says what each candidate
   * costs.
   *
   * ===========================================================================
   * THE MEASUREMENT THE RULING WAS MADE ON
   * ===========================================================================
   * Greedy arcs against the real calendar — the same rule `simulateSeason` and
   * `simulateCampaignArc` use, every meet the engine says can be entered, taken
   * — run from the season anchor at `FIRST_TOTAL_KG` until the lifter puts up
   * the campaign summit's 600 kg gate. All 24 seeds reach it at every rate, so
   * no row is a median over a truncated population.
   *
   *   gain   meets: median (range)   days: median   years   slowest career
   *   ----   --------------------    ------------   -----   --------------
   *     70     12 (8-28)                       56    0.15         0.33 yr
   *     35     25 (17-51)                     105    0.29         0.63 yr
   *     20     41 (31-87)                     187    0.51         1.08 yr  <- shipped
   *     12     69 (51-154)                    315    0.87         1.93 yr
   *      8     98 (80-227)                    462    1.27         2.85 yr
   *      5    159 (127-365)                   745    2.05         4.59 yr
   *
   * ===========================================================================
   * WHY 20 AND NOT ONE OF THE OTHERS — THE REASONING, WHICH A FUTURE TUNER
   * MOVING THIS KNOB NEEDS MORE THAN THE NUMBER
   * ===========================================================================
   *   - 20 puts the median campaign near six months simulated and 41 meets,
   *     with the slowest seed at 1.08 years — a tail a player might actually
   *     finish.
   *   - It sits CLEARLY ABOVE THE ~12 kg POINT WHERE THE CALENDAR BECOMES THE
   *     BINDING CONSTRAINT rather than strength. Below that a lifter is waiting
   *     for meets to exist rather than waiting to get stronger, which is a
   *     different problem from slow progress and a worse one: playing well does
   *     not shorten it.
   *   - 12 IS THE MORE REALISTIC CANDIDATE AND IS THE ONE TO TRY NEXT IF 20
   *     PLAYS TOO FAST. Its near-two-year tail is what needs a human verdict
   *     before it can be taken on realism grounds alone.
   *   - The absolute tail spread is the second deciding fact. The
   *     slowest-to-median ratio is ~2.2x at every rate, so the RATIO decides
   *     nothing — but that same ratio is 0.33 yr at gain 70 and 4.59 yr at gain
   *     5. A rate slow enough to feel like real training makes an unlucky seed's
   *     campaign a multi-year affair, which is a retention question rather than
   *     a realism one.
   *
   * ===========================================================================
   * WHAT THIS DOES NOT FIX, STATED SO NOBODY READS IT AS MORE
   * ===========================================================================
   * 20 kg on a 380 kg opening total is still 5% in one meet, and that is the
   * value at the very first meet only — headroom decays it from there. This is a
   * fixture for measuring monotonicity and reachability, not a model of
   * training. What the move buys is that every count keyed to where a total sits
   * relative to a qualifying gate is now taken over a career whose PACE is
   * within sight of the sport rather than five times it.
   */
  MAX_GAIN_KG: 20,
  /** How often a meet is a bad day. */
  BAD_DAY_SHARE: 0.35,
  /**
   * How much of a lifter's capability a bad day can cost, as a share of it.
   *
   * REPLACES A FLAT `MAX_LOSS_KG` OF 70. An absolute 70 kg bad day is 18% of a
   * 380 kg opening total and 8% of an 880 kg plateau, so one constant meant two
   * different things at the two ends of a career. A share means one thing
   * everywhere, and it is what keeps a plateau a band rather than a line: the
   * noise stays proportional to the lifter it is noise about, so totals go on
   * interleaving with the qualifying gates instead of settling above them.
   *
   * PROVISIONAL, AND WITH NO CITATION BEHIND IT — unlike the two potential
   * bounds below, which have one. 8% is a game-feel value nobody has playtested
   * and it is on the CONSERVATIVE side of what real data shows: the only
   * measurement available here is `docs/research/qualifying-totals.md` §1.2,
   * whose median (P10 - minimum) drop at the gated tier is 155.0 kg, roughly a
   * quarter of a 600 kg total. That is a tail rather than a typical day, so it
   * does not set this number — but it does say which way an error in it runs.
   */
  BAD_DAY_MAX_SHARE: 0.08,
  /**
   * The weakest ceiling a simulated career may be given, in kg.
   *
   * ===========================================================================
   * WHY A CEILING AT ALL, AND WHY ONE PER LIFTER
   * ===========================================================================
   * The generator this replaces was an unbounded two-sided random walk of
   * +/- 70 kg a meet. Over the sweep's real 728-day window it reached a peak
   * total of 3020 kg — roughly two and a half times the heaviest total any
   * human has recorded — and its median meet total was 1107.5 kg. A walk that
   * gets there is not modelling the sport at any depth, so a percentile taken
   * deep into that distribution was about nothing, and every check keyed to
   * where a total sat relative to a qualifying gate had stopped meaning what it
   * said by the time a career was forty meets old.
   *
   * ONE GLOBAL CEILING WAS CONSIDERED AND REJECTED. A hard clamp piles arcs up
   * at exactly the ceiling, which is its own unrealism and makes any percentile
   * near the top degenerate — the same failure moved to a different part of the
   * distribution. So the ceiling is drawn per career, once, at creation, from
   * `[POTENTIAL_MIN_KG, POTENTIAL_MAX_KG]`, and it is approached rather than
   * reached: see `GAIN_DECAY_EXPONENT`. Different seeds plateau in different
   * places, which is also closer to the sport than one number everybody shares.
   *
   * ===========================================================================
   * WHERE 625 COMES FROM — A STRUCTURAL REQUIREMENT, CHECKED AGAINST REAL DATA
   * ===========================================================================
   * The floor is set by a rule rather than by taste, and `eligibility.test.ts`
   * asserts the RULE rather than the literal: it sits strictly between the
   * campaign summit's qualifying total and the competitive summit's. Both halves
   * are load-bearing and they pull in opposite directions:
   *
   *   - ABOVE the campaign gate (600), because GDD §6.6's R1 — "every simulated
   *     arc enters a campaign summit" — is a statement about the CALENDAR. A
   *     fixture holding lifters who can never clear that gate would turn R1 into
   *     a statement about strength without anybody editing it, which is the
   *     silent change of subject this repository keeps recording.
   *   - BELOW the competitive gate (650), because the top of the ladder has to
   *     go on refusing somebody. `eligibility.test.ts` pins `worldsEntries`
   *     under the seed count for exactly that reason. A band whose floor cleared
   *     650 would take every career to the top rung and quietly empty that
   *     check — a new rule making an old one vacuous, which CLAUDE.md requires
   *     be looked for rather than discovered.
   *
   * The midpoint of the two is 625, which is the same stated-rule shape the
   * campaign gate itself uses (`careerTuning.ts`: 600 is the midpoint of
   * nationals' 550 and competitive worlds' 650).
   *
   * AND IT IS NOT ONLY A MIDPOINT. `docs/research/qualifying-totals.md` §3.1's
   * raw men's Open table puts the `nationals` cell — P10 of the real, gated
   * national-championship field — at 627.5 kg for the 83 kg class and 630.0 kg
   * for the 93 kg class. So the weakest career this fixture can produce plateaus
   * within 2.5 kg of what the weakest lifter in a real national field totals,
   * which is a defensible floor for "a career that went as far as it was going
   * to go".
   */
  POTENTIAL_MIN_KG: 625,
  /**
   * The strongest ceiling a simulated career may be given, in kg.
   *
   * Grounded on the top end of the same derived table, cited rather than
   * invented. `docs/research/qualifying-totals.md` §3.1's raw men's Open
   * `worlds` row — the total reached by the strongest 25% of that class's real
   * nationals field, which is §3.6's quota method — runs from 537.5 kg at the
   * 59 kg class to 902.5 kg at 120+. 900 sits just under the strongest
   * designated cell in the whole table, and a long way under the single heaviest
   * total anywhere in the underlying data, which is 1153.5 kg — the `maxKg` of
   * raw men's 120+ at `local` in `qualifying-totals-derived-raw.json`.
   *
   * READ THE CAVEAT THAT COMES WITH THAT TABLE RATHER THAN JUST ITS NUMBERS.
   * Its §1.1 and §1.2 say plainly that no percentile of a competition field
   * recovers a published qualifying standard, and the `worlds` row carries the
   * mixed-method marker. What is borrowed here is not a standard — it is the
   * SCALE of real elite totals, which is what an upper bound on a simulated
   * career wants and is the one thing those cells are unambiguously evidence of.
   *
   * PROVISIONAL as a game-feel value, in the sense that where inside the real
   * elite range this fixture's strongest career should land is a judgement
   * nobody has playtested. What is NOT provisional is that it belongs inside
   * that range rather than at three times it.
   */
  POTENTIAL_MAX_KG: 900,
  /**
   * How sharply a lifter's gains fall off as they close on their own ceiling.
   *
   * The gain per meet is `draw x MAX_GAIN_KG x headroom^this`, where headroom is
   * the fraction of the lifter's opening-to-potential span still unclaimed. At 1
   * that is a plain exponential approach; above 1 the last stretch is slower
   * still, which is the shape real progression has — a novice adds more in a
   * year than an established lifter adds in five.
   *
   * A SOFT ASYMPTOTE RATHER THAN A CLAMP IS THE WHOLE POINT. Nothing here ever
   * equals a potential, so no two careers pile up on one number and the
   * per-career peaks stay spread across the band instead of stacking on its top.
   *
   * 1.5 WAS MEASURED AGAINST 1 AND 2 RATHER THAN CHOSEN, on the 24 shipped seeds
   * at `MEETS_PER_CAREER` meets, and the discriminator was the FASTEST arc
   * rather than the distribution — every candidate bounds the range about
   * equally well. At `MAX_GAIN_KG` 70, which is what that choice was made on:
   *
   *   exponent 1    peak 892.5   fewest meets to 600 kg: 6   careers never reaching 650: 2
   *   exponent 1.5  peak 882.5   fewest meets to 600 kg: 8   careers never reaching 650: 2
   *   exponent 2    peak 855     fewest meets to 600 kg: 9   careers never reaching 650: 4
   *
   * At 1 the bounded generator would let a lucky career reach the campaign gate
   * FASTER than the unbounded one it replaces — a regression on the rate axis
   * dressed as a fix on the range axis. At 2 the weakest careers stop reaching
   * their own ceiling inside the run, and the observed minimum peak falls to
   * 617.5 against a 625 floor, which makes the floor stop being something a
   * reader can see in the output. 1.5 is the one that does neither, and it is
   * still a game-feel value nobody has playtested.
   *
   * ===========================================================================
   * THAT ARGUMENT DOES NOT SURVIVE `MAX_GAIN_KG` GOING TO 20, AND THIS BLOCK IS
   * REPORTING THAT RATHER THAN REPAIRING IT
   * ===========================================================================
   * Re-taken on the same seeds at the shipped gain of 20:
   *
   *   exponent 1    peak 877.5   min peak 627.5   fewest meets to 600 kg: 26   never reaching 650: 2
   *   exponent 1.5  peak 825     min peak 615     fewest meets to 600 kg: 31   never reaching 650: 4
   *   exponent 2    peak 780     min peak 597.5   fewest meets to 600 kg: 36   never reaching 650: 7
   *
   * The SECOND half of the argument above — that a minimum peak under the 625
   * floor makes the floor invisible in the output — is exactly what the SHIPPED
   * exponent now does: 615 against a 625 floor, which is further under it than
   * the 617.5 that ruled exponent 2 out. Read literally, the stated rule would
   * now pick exponent 1.
   *
   * IT IS DELIBERATELY NOT PICKED HERE. The ruling that moved `MAX_GAIN_KG` was
   * about one knob, and turning a second one in the same change is how
   * `PHASE_DAYS` and `CADENCE_DAYS` each took the other's credit — a mistake
   * this file already records twice. The first half of the argument also no
   * longer bites the way it did: at gain 20 no exponent lets a career reach the
   * gate faster than the unbounded generator did, because the fastest arc at
   * exponent 1 is 26 meets against the old fixture's 6. So the choice between 1
   * and 1.5 is genuinely open again and it is a human's, not a builder's.
   *
   * What the minimum peak of 615 actually means is that at gain 20 a career no
   * longer closes on its own ceiling inside 167 meets — the closest any career
   * gets to its drawn potential is 12.5 kg, where it used to be 2.5.
   * `eligibility.test.ts` pins that gap rather than bounding it.
   */
  GAIN_DECAY_EXPONENT: 1.5,
  /** Totals land on the competition grid. */
  ROUNDING_KG: 2.5,
  /**
   * The period of the shipped calendar, in days.
   *
   * Every cadence divides it — 364 = 52 x 7 = 26 x 14 = 4 x 91 = 1 x 364 — so
   * the pattern of meet days repeats from here, and it is the span
   * `CAREER_TUNING.HORIZON_DAYS` draws. `eligibility.test.ts` asserts both
   * rather than trusting this sentence.
   */
  CALENDAR_PERIOD_DAYS: 364,
  /**
   * How many of those periods a simulated career runs for.
   *
   * Two, and the reason is the annual tier. A worlds meet asks for 650 kg; the
   * first one a period holds falls on day 6 with three meet days in front of
   * it, so the most a lifter can be holding is
   * `FIRST_TOTAL_KG + 3 x MAX_GAIN_KG` = 440. The second falls on day 370, by
   * which point 16 of the 24 careers are past the bar. One period is a
   * simulation with an empty worlds column; two is the shortest one without.
   *
   * SIXTEEN AND NOT TWENTY-TWO SINCE `MAX_GAIN_KG` WENT TO 20, and the reason
   * the count matters is that it is what keeps the column non-empty. The
   * argument for two periods is unchanged and the margin on it is thinner: a
   * slower lifter is 640 to 745 kg on the day-370 meet rather than 632.5 to
   * 862.5, so two thirds of the fixture clears the top gate there instead of
   * eleven twelfths. `eligibility.test.ts` pins both the 16 and the eight
   * misses, split by which of them are refused by their own ceiling and which
   * are merely not there yet.
   *
   * Nothing about the calendar resets at the boundary and this is worth being
   * explicit about, because a day anchor has cost this repository two waves.
   * There is one anchor, `CAREER_TUNING.SEASON_ANCHOR`, and each tier's series
   * is an arithmetic progression running forward from it. A "period" is a
   * description of how that progression repeats, not a thing the calendar is
   * re-anchored to, so day 364 is an ordinary day that happens to be a local
   * meet day and day 370 is an ordinary day that happens to be a worlds one.
   * `calendar.test.ts` holds the ten-year weekday check that says so.
   */
  CALENDAR_PERIODS: 2,
  /** How long the simulated career runs, from the season anchor. Their product. */
  SIMULATION_DAYS: 728,
  /**
   * The fewest days the simulated lifter leaves between two meets.
   *
   * One day, which is the finest the calendar can be read at, so the harness
   * adds no rest of its own. See the header for the 28 this replaces and for
   * what that 28 was hiding. The number itself did not go away: it is
   * `ENTRY_COOLDOWN_DAYS` below, where a self-imposed rest belongs — as the
   * control that shows axis C can see a lockout, rather than as the thing
   * deciding how much of the game the sweep looks at.
   */
  MIN_DAYS_BETWEEN_MEETS: 1,
  /** How long after the last meet both lifters are compared, on axis B. */
  EVALUATION_LAG_DAYS: 7,
  /**
   * The same lag for axis C, and it has to be zero.
   *
   * Axis C's subject is the entry gate, and the one meet the two lifters differ
   * on is the meet at the moment they differ. At any positive lag that meet is
   * already behind the window — `entryVerdict` refuses it to both of them as
   * `MEET_HAS_PASSED` — so `enteredMeetIds` decides nothing and the axis
   * measures the same thing axis B does. Measured rather than argued: at the
   * shipped lag of 7 the number of pairs whose enterable lists differ at all
   * because of an entry is 0, and at 0 it is the whole depth of the sweep.
   * `eligibility.test.ts` pins both.
   */
  ENTRY_EVALUATION_LAG_DAYS: 0,
  /**
   * How long the `entry-cooldown` control locks a lifter out after a meet.
   *
   * 28 days, which is the rest the first version of this sweep gave every
   * lifter as a fixture parameter. As a control it is doing the job that
   * parameter should never have been doing: standing in for a design that
   * charges a lifter for having competed, so the axis has something non-zero to
   * be zero against.
   */
  ENTRY_COOLDOWN_DAYS: 28,
  /**
   * The three meet counts the delayed current-form control is measured at, and
   * they are the edge of this domain written down as numbers.
   *
   * A current-form rule does not have to switch on at a lifter's first meet. A
   * designer who wanted new lifters protected would delay it — "your last total
   * counts once you are established" — and that delay is what made the old
   * 14-meet fixture useless: the same rule, delayed past 15, was invisible.
   *
   * ===========================================================================
   * THE THIRD POINT WAS DELETED AS DOMINATED, AND SLOWING `MAX_GAIN_KG` BROUGHT
   * IT BACK. THE DELETION SAID IT WOULD, AND IT WAS RIGHT ABOUT THAT AND WRONG
   * ABOUT WHY.
   * ===========================================================================
   * `DELAYED_FORM_PAST_VISIBLE` names the meet count at which the rule FIRES in
   * some careers and the axis still reports nothing — "invisible, not
   * unreachable", which is a different zero from "the rule never ran".
   *
   * It was deleted when the totals generator was bounded, because on that
   * fixture the region did not exist: re-run at every n from 0 to 170, the
   * violating count was non-zero at all 169 values of n at which the rule fired
   * in any career and zero at exactly the two where it fired in none. A constant
   * equal to another constant, measuring the same zero for the same reason, is a
   * check that can no longer speak, so it went — with the note that "if a future
   * generator, tuning or calendar reopens it … the third point comes back, and
   * the way to find out is the scan described above rather than an assumption
   * that it is still closed."
   *
   * THE SCAN WAS RE-RUN AT `MAX_GAIN_KG` 20, AT EVERY n FROM 0 TO 167, AND THE
   * REGION IS THREE POINTS WIDE:
   *
   *   n     violating   worst   careers deep enough to fire
   *   ---   ---------   -----   --------------------------
   *   163         164       1   24     <- DELAYED_FORM_INSIDE
   *   164           0       0   20     <- DELAYED_FORM_PAST_VISIBLE
   *   165           0       0   16
   *   166           0       0    8
   *   167           0       0    0     <- DELAYED_FORM_PAST_THE_EDGE
   *
   * There are NO interior gaps: every n from 0 to 162 reports a non-zero, so the
   * silent-but-firing region is exactly {164, 165, 166} and it is at the top.
   *
   * THE PREDICTED CAUSE WAS NOT THE ACTUAL CAUSE, WHICH IS THE PART WORTH
   * KEEPING. The deletion expected the region to reopen if careers started
   * outgrowing the top qualifying total again — a rule with nothing left to take
   * away. That is not what happened. Careers still interleave with the gates;
   * what changed is the POPULATION at the deepest meet counts. A slower lifter
   * enters fewer gated meets, so seasons are 164 to 167 meets long rather than
   * 168 to 169, and at n = 164, 165 and 166 the rule fires in 20, 16 and 8
   * careers rather than in all 24. Firing needs the total put up at the (n+1)-th
   * meet to sit under a bar the lifter's own best has cleared; with a handful of
   * careers reaching that depth, no one of them happens to have a bad enough
   * last meet.
   *
   * So a "fires but invisible" region can be produced by the fixture running out
   * of SUBJECTS as easily as by the rule running out of TEETH, and the two are
   * indistinguishable from the zero. That is a stronger version of the same
   * lesson the block above `ENTRY_VARIANTS` records.
   *
   * WHAT OF THAT SCAN IS PINNED AND WHAT IS NOT. The three points below are
   * pinned in `eligibility.test.ts` with `firesIn` beside each, and their
   * relationship to the season lengths is asserted rather than typed. The 163
   * interior points are not pinned by anything. If a fixture change reopens a
   * gap in the MIDDLE of the range, nothing in this file will notice; re-run the
   * scan rather than assuming this paragraph still holds.
   *
   * THIS BLOCK HAS NOW HAD ITS EDGE MOVE UNDER IT FOUR TIMES WITHOUT ANYBODY
   * EDITING THE RULE, which is the reason it is written at this length. At one
   * calendar period the pair was 81 and 82; two periods moved the deepest career
   * to 165 and the same pair went to zero and zero. Splitting the summit into
   * two tiers moved every later meet's INDEX by one to four and took the pinned
   * pair at 100/101 two zeros' worth of daylight away from the edge it named.
   * Bounding the generator removed the middle point altogether. Slowing the gain
   * rate put it back, three points wide, for a reason nobody had predicted.
   * Nothing about the rule changed on any of the four occasions.
   *
   * Where the rule can bite at all is arithmetic about this population rather
   * than a property of the calendar, so it is measured rather than reasoned
   * about. `latestTotalAfter(n)` differs from the shipped fold at exactly one
   * moment — the lifter's (n+1)-th meet, where the diligent lifter has switched
   * to current form and the one who skipped a meet has not — so it can only show
   * up when the total put up AT that meet sits below a qualifying bar the
   * lifter's own best has already cleared.
   *
   * The three points are therefore:
   *
   *   - `DELAYED_FORM_INSIDE` at 163, the deepest meet count at which the rule
   *     bites at all. It fires in all 24 careers there and the axis reports 164
   *     violating pairs.
   *   - `DELAYED_FORM_PAST_VISIBLE` at 164, one meet further. The rule fires in
   *     20 of the 24 careers and the axis reports nothing: invisible, not
   *     unreachable.
   *   - `DELAYED_FORM_PAST_THE_EDGE` at 167, the deepest career. The rule fires
   *     in none of them, because firing needs a 168th meet and nothing here has
   *     one. Unreachable, not invisible.
   *
   * One measured non-zero and two zeros with different reasons counted beside
   * them. `eligibility.test.ts` pins how many careers reach each rule's
   * switch-on point, so both kinds of zero are a count rather than this
   * paragraph.
   */
  DELAYED_FORM_INSIDE: 163,
  DELAYED_FORM_PAST_VISIBLE: 164,
  DELAYED_FORM_PAST_THE_EDGE: 167,
  /**
   * Which occurrence of the annual series each tier-keyed control fires at,
   * counted from the first one the calendar holds.
   *
   * These three are the tier axis of the same edge `DELAYED_FORM_*` draws on
   * the meet-count axis, and they are numbered from zero because that is how
   * `tierOccurrenceOf` counts: occurrence 0 is the worlds meet on day 6,
   * occurrence 1 is the one on day 370, occurrence 2 would be day 734.
   *
   * The middle one is inside the domain. The outer two are its edges, and they
   * are edges for different reasons — the first is inside the calendar and
   * outside every career, the third is outside the simulation altogether.
   * `RECORD_VARIANTS` and `ENTRY_VARIANTS` each carry all three, and the two
   * tables disagree about the middle one: the entry axis reports it and the
   * qualification axis cannot. That disagreement is the measurement worth
   * having, and `eligibility.test.ts` pins both halves of it.
   */
  WORLDS_OCCURRENCE_FIRST: 0,
  WORLDS_OCCURRENCE_SECOND: 1,
  WORLDS_OCCURRENCE_THIRD: 2,
  /**
   * The top qualifying total any tier asks for, mirrored from `careerTuning.ts`
   * as the number the worlds measurements are taken against.
   *
   * Mirrored rather than imported so that a tuner who moves the worlds bar gets
   * a red here — `eligibility.test.ts` asserts the two agree — instead of a
   * measurement that silently follows the bar under a comment that no longer
   * describes it.
   */
  TOP_QUALIFYING_TOTAL_KG: 650,
  /** The window the comparison is made over, from the evaluation day. */
  WINDOW_DAYS: 364,
  FEDERATION: 'meridian' as CareerFederationId,
});

/**
 * The ceiling one career is drawn, in kg. A pure function of the seed.
 *
 * Exported because a bound nobody can read is a bound nobody can check:
 * `eligibility.test.ts` asserts every total this seed produces sits at or under
 * it, at every depth, which is what makes "bounded" a measurement rather than a
 * claim in this comment.
 *
 * The draw is the FIRST thing taken from the seed's stream, before any meet, so
 * a career's ceiling is fixed at creation and does not depend on how deep the
 * caller asks the career to run. That is what keeps `seededCareerTotals(s, 200)`
 * a prefix-extension of `seededCareerTotals(s, 171)`, which the two sweeps rely
 * on: axis B draws 171 and axis D draws 200 from the same seeds and they are
 * meant to be the same lifters.
 */
export function careerPotentialKg(seed: number): number {
  const draw = nextRandom(seedState(seed));
  const span = ATTENDANCE_SWEEP.POTENTIAL_MAX_KG - ATTENDANCE_SWEEP.POTENTIAL_MIN_KG;
  return (
    Math.round(
      (ATTENDANCE_SWEEP.POTENTIAL_MIN_KG + draw.value * span) / ATTENDANCE_SWEEP.ROUNDING_KG,
    ) * ATTENDANCE_SWEEP.ROUNDING_KG
  );
}

/**
 * One career's meet totals, in calendar order.
 *
 * Deterministic in the seed. The first total is fixed so that every career
 * starts below the regional bar and can climb through it; what makes the
 * sequences differ after that is the ceiling the seed drew and the run of good
 * and bad days it gets on the way to it.
 *
 * ===========================================================================
 * TWO LAYERS, AND SEPARATING THEM IS THE FIX
 * ===========================================================================
 * The generator this replaces was ONE layer: a total that a bad day pushed
 * permanently down and a good day pushed permanently up, +/- 70 kg, forever, with
 * nothing bounding either direction. Two things were wrong with that and only
 * one of them was the runaway peak.
 *
 *   CAPABILITY — what the lifter can do — climbs and only climbs, by a gain
 *   that decays as they close on their own ceiling. Strictly increasing,
 *   strictly below `careerPotentialKg(seed)`, and never equal to it.
 *
 *   THE DAY — what they actually put on the board — is capability on a good day
 *   and capability less up to `BAD_DAY_MAX_SHARE` of it on a bad one.
 *
 * A bad meet is a bad DAY in this sport, not a loss of strength: a lifter who
 * goes eight-for-nine at one meet and three-for-nine at the next has not got
 * weaker, and `docs/research/qualifying-totals.md` §1.2 is a measurement of
 * exactly that gap in real data. The old single layer said otherwise, and the
 * cost of saying it was a walk with no fixed point.
 *
 * ===========================================================================
 * THE BOUND IS PROVABLE, NOT SAMPLED, AND HERE IS THE PROOF
 * ===========================================================================
 * Write `P` for the drawn potential and `c` for capability. One meet's gain is
 * `draw x MAX_GAIN_KG x ((P - c) / (P - FIRST_TOTAL_KG))^GAIN_DECAY_EXPONENT`
 * with `draw` in [0, 1) and the base in [0, 1], so the gain is at most
 * `MAX_GAIN_KG x (P - c) / (P - FIRST_TOTAL_KG)`. Since
 * `MAX_GAIN_KG < POTENTIAL_MIN_KG - FIRST_TOTAL_KG <= P - FIRST_TOTAL_KG`
 * (20 against 245 at the shipped values, and it was 70 against 245 before the
 * gain rate was slowed — the premise got looser, not tighter), that is strictly
 * less than `P - c`. So `c` rises and never reaches `P`, at any depth, for any
 * seed.
 *
 * Rounding cannot break it either: `P` is on the `ROUNDING_KG` grid by
 * construction, and rounding a value strictly below a grid point to that grid
 * cannot land above it. A bad day only subtracts. Hence EVERY total is at most
 * that career's potential, and therefore at most `POTENTIAL_MAX_KG`.
 *
 * WHAT `eligibility.test.ts` ACTUALLY ASSERTS, stated precisely rather than as
 * "it checks the proof", because the two are not the same and the difference is
 * where a reader would otherwise be misled:
 *
 *   - Every total sits at or under its OWN career's drawn potential, over every
 *     seed at `MEETS_PER_CAREER` depth, with the number of totals checked pinned
 *     and the tightest observed gap pinned too — so the bound is not passing by
 *     being generous.
 *   - Every drawn potential sits inside the band and lands on the rounding grid,
 *     which is the second half of the rounding argument above.
 *   - `MAX_GAIN_KG < POTENTIAL_MIN_KG - FIRST_TOTAL_KG`, the constant inequality
 *     the proof rests on, so a tuner who raises the gain past the band's own span
 *     gets a red rather than a generator that has quietly stopped being bounded.
 *
 * The strict inequality on CAPABILITY is NOT asserted and cannot be, because
 * capability never leaves this function — only the rounded total does. The tests
 * bound the thing a caller can see; the strictness above is an argument about
 * the thing they cannot.
 */
export function seededCareerTotals(seed: number, meets: number): readonly number[] {
  const totals: number[] = [];
  const potentialKg = careerPotentialKg(seed);
  const span = potentialKg - ATTENDANCE_SWEEP.FIRST_TOTAL_KG;
  // The potential draw is the head of the stream; the meet draws follow it.
  let state = nextRandom(seedState(seed)).state;
  let capability: number = ATTENDANCE_SWEEP.FIRST_TOTAL_KG;
  for (let index = 0; index < meets; index += 1) {
    const badDraw = nextRandom(state);
    state = badDraw.state;
    const gainDraw = nextRandom(state);
    state = gainDraw.state;
    const dayDraw = nextRandom(state);
    state = dayDraw.state;

    const headroom = Math.max(0, (potentialKg - capability) / span);
    capability +=
      gainDraw.value * ATTENDANCE_SWEEP.MAX_GAIN_KG * headroom ** ATTENDANCE_SWEEP.GAIN_DECAY_EXPONENT;

    const isBadDay = badDraw.value < ATTENDANCE_SWEEP.BAD_DAY_SHARE;
    const onTheDay = isBadDay
      ? capability * (1 - dayDraw.value * ATTENDANCE_SWEEP.BAD_DAY_MAX_SHARE)
      : capability;
    totals.push(
      Math.max(0, Math.round(onTheDay / ATTENDANCE_SWEEP.ROUNDING_KG) * ATTENDANCE_SWEEP.ROUNDING_KG),
    );
  }
  return totals;
}

/** How many of a total sequence are lower than the one before. */
export function badDayCount(totals: readonly number[]): number {
  let count = 0;
  for (let index = 1; index < totals.length; index += 1) {
    const previous = totals[index - 1];
    const current = totals[index];
    if (previous !== undefined && current !== undefined && current < previous) count += 1;
  }
  return count;
}

// ---------------------------------------------------------------------------
// The controls
// ---------------------------------------------------------------------------

/**
 * Which qualification rule a sweep runs under.
 *
 * `shipped` is `qualifiesFor` itself, imported rather than restated, so a
 * control can never be compared against a copy of the engine that has drifted
 * from the engine.
 */
export type QualificationVariant = 'shipped' | 'highest-tier-band';

/**
 * A control, not a design. Under `highest-tier-band` a lifter qualifies only
 * for the highest tier their total clears — the shape an anti-sandbagging rule
 * takes when somebody writes one — so crossing a qualifying total takes the
 * tiers below it away.
 */
export const QUALIFICATION_VARIANTS: Readonly<
  Record<QualificationVariant, (lifter: CareerLifter, meet: CareerMeet) => boolean>
> = Object.freeze({
  shipped: qualifiesFor,
  'highest-tier-band': (lifter, meet) => {
    if (!qualifiesFor(lifter, meet)) return false;
    return meet.tier === highestQualifiedTier(lifter.bestTotalKg);
  },
});

/** The top tier a total clears, or the entry tier when it clears nothing. */
export function highestQualifiedTier(bestTotalKg: number | null): CareerMeetTier {
  let highest: CareerMeetTier = entryTier();
  for (const tier of tiersLowestFirst()) {
    if (meetsQualifyingTotal(bestTotalKg, qualifyingTotalKgFor(tier))) highest = tier;
  }
  return highest;
}

/** Which rule turns a meet result into a career record. */
export type RecordVariant =
  | 'shipped'
  | 'latest-total-wins'
  | 'delayed-form-inside'
  | 'delayed-form-past-visible'
  | 'delayed-form-past-the-edge'
  | 'worlds-reset-first'
  | 'worlds-reset-second'
  | 'worlds-reset-third';

/**
 * What a record rule is handed about the meet it is folding in.
 *
 * The first three arguments are `careerRecordAfterMeet`'s own, in its own
 * order, so `shipped` below stays that function itself rather than a wrapper
 * around it — a control measured against a copy of the engine is measured
 * against something that can drift from the engine. The two after them are what
 * a tier-keyed or date-keyed control needs and the shipped rule ignores;
 * TypeScript lets a three-parameter function stand in for a five-parameter type,
 * so adding them costs the `shipped` entry nothing.
 */
export type RecordFold = (
  lifter: CareerLifter,
  meetId: string,
  totalKg: number,
  tier: CareerMeetTier,
  day: StreakDay,
) => CareerLifter;

/**
 * Which occurrence of a tier's series a meet day is, counted from zero at the
 * first one the calendar holds.
 *
 * Derived from `CAREER_TUNING` through `calendar.ts` rather than from a table
 * here, so a tuner who moves a phase or a cadence moves this with it. A day
 * that is not one of the tier's meet days gives a non-integer, which is what
 * the `worlds-reset-*` controls test for.
 */
export function tierOccurrenceOf(tier: CareerMeetTier, day: StreakDay): number {
  return (day - tierSeriesStartDay(tier)) / CAREER_TUNING.CADENCE_DAYS[tier];
}

/**
 * A career that remembers the last total instead of the best, once the lifter
 * has `afterMeets` of them on record.
 *
 * `afterMeets` of zero is the plain current-form rule. Anything higher is the
 * same rule with a grace period, which is the shape that walked past this sweep
 * while its careers were 14 meets long.
 */
function latestTotalAfter(afterMeets: number): RecordFold {
  return (lifter, meetId, totalKg) => {
    const entered = lifter.enteredMeetIds.includes(meetId)
      ? lifter.enteredMeetIds
      : [...lifter.enteredMeetIds, meetId];
    if (lifter.enteredMeetIds.length < afterMeets) return careerRecordAfterMeet(lifter, meetId, totalKg);
    return { federationId: lifter.federationId, bestTotalKg: totalKg, enteredMeetIds: entered };
  };
}

/**
 * A career whose record is overwritten by whatever was put up at one nominated
 * occurrence of the worlds series, instead of taking the better of the two.
 *
 * The design somebody would write for this is "your world result is your
 * ranking total", and it is a plausible one: an annual championship is the meet
 * a federation would rank you off. It is also exactly the shape GDD §12.3
 * refuses, and it needs no memory beyond the meet being folded — a lifter who
 * turns up at worlds and has a bad day forgets every total above it, while the
 * lifter who stayed home keeps theirs.
 *
 * `occurrence` counts from zero at the first worlds meet the calendar holds, so
 * the three entries below are the same rule pointed at three different days.
 * The one thing they hold apart is which of those days a simulated lifter can
 * actually be standing on.
 */
function worldsResetAt(occurrence: number): RecordFold {
  return (lifter, meetId, totalKg, tier, day) => {
    if (tier !== 'competitive-worlds' || tierOccurrenceOf('competitive-worlds', day) !== occurrence) {
      return careerRecordAfterMeet(lifter, meetId, totalKg);
    }
    const entered = lifter.enteredMeetIds.includes(meetId)
      ? lifter.enteredMeetIds
      : [...lifter.enteredMeetIds, meetId];
    return { federationId: lifter.federationId, bestTotalKg: totalKg, enteredMeetIds: entered };
  };
}

/**
 * The second control, its three delayed forms, and the three tier-keyed ones.
 * Under `latest-total-wins` the career remembers the last total instead of the
 * best, which is how a "current form" gate reads, and a bad meet day then costs
 * a lifter meets they had already qualified for.
 *
 * The three delayed entries are the same rule switched on part way through a
 * career, at the meet counts `ATTENDANCE_SWEEP` names. They are what turns the
 * edge of this domain into pinned numbers rather than a sentence somebody
 * measured once: one is the deepest point that bites, one is a point where the
 * rule fires and the axis cannot see it, and one is past every career.
 *
 * The three `worlds-reset-*` entries do the same job on the tier axis, which is
 * the axis the one-period version of this sweep was blind on. Their zeros and
 * their non-zero sit in `eligibility.test.ts` beside each other, so a reader
 * can see which of the calendar's worlds meets a career here reaches and which
 * two it does not.
 */
export const RECORD_VARIANTS: Readonly<Record<RecordVariant, RecordFold>> = Object.freeze({
  shipped: careerRecordAfterMeet,
  'latest-total-wins': latestTotalAfter(0),
  'delayed-form-inside': latestTotalAfter(ATTENDANCE_SWEEP.DELAYED_FORM_INSIDE),
  'delayed-form-past-visible': latestTotalAfter(ATTENDANCE_SWEEP.DELAYED_FORM_PAST_VISIBLE),
  'delayed-form-past-the-edge': latestTotalAfter(ATTENDANCE_SWEEP.DELAYED_FORM_PAST_THE_EDGE),
  'worlds-reset-first': worldsResetAt(ATTENDANCE_SWEEP.WORLDS_OCCURRENCE_FIRST),
  'worlds-reset-second': worldsResetAt(ATTENDANCE_SWEEP.WORLDS_OCCURRENCE_SECOND),
  'worlds-reset-third': worldsResetAt(ATTENDANCE_SWEEP.WORLDS_OCCURRENCE_THIRD),
});

// ---------------------------------------------------------------------------
// The simulated career the attendance axis compares
// ---------------------------------------------------------------------------

/** One meet in a simulated season: where it sat, which rung it was, and what was put up at it. */
export interface SeasonMeet {
  readonly day: StreakDay;
  readonly meetId: string;
  readonly tier: CareerMeetTier;
  readonly totalKg: number;
}

/**
 * One season on the shipped calendar, as a fixture both arms of the attendance
 * axis are measured against.
 *
 * The schedule is greedy and simple: walk the days from the season anchor, and
 * on each day take the first meet the engine says can be entered, provided
 * `MIN_DAYS_BETWEEN_MEETS` have passed since the last. Entry is decided by
 * `canEnter` itself rather than by a rule restated here, so the fixture cannot
 * drift from the engine it is a fixture for.
 *
 * At the shipped `MIN_DAYS_BETWEEN_MEETS` of 1 this is the most competitive
 * career the game will sell a player: every meet they are eligible for, taken.
 * That is the lifter GDD §12.3's "never punish daily engagement" is about, so
 * it is the one the property is measured on.
 *
 * A season is a pure function of its seed, so both record variants measure
 * against exactly the same one. That is what isolates the axis: two lifters
 * compared on it differ in which meets of one fixed season they attended and in
 * nothing else — not in the dates, not in the totals, not in the calendar.
 */
export function simulateSeason(seed: number): readonly SeasonMeet[] {
  const totals = seededCareerTotals(seed, ATTENDANCE_SWEEP.MEETS_PER_CAREER);
  const anchor = seasonAnchorDay();
  const lastDay = addDays(anchor, ATTENDANCE_SWEEP.SIMULATION_DAYS);
  let lifter: CareerLifter = newCareerLifter(ATTENDANCE_SWEEP.FEDERATION);
  const season: SeasonMeet[] = [];
  let lastMeetDay: number | null = null;
  for (let day = anchor; day <= lastDay; day = addDays(day, 1)) {
    if (lastMeetDay !== null && day - lastMeetDay < ATTENDANCE_SWEEP.MIN_DAYS_BETWEEN_MEETS) continue;
    const meet = scheduledMeets(ATTENDANCE_SWEEP.FEDERATION, day, day).find((candidate) =>
      canEnter(lifter, candidate, day),
    );
    if (meet === undefined) continue;
    const totalKg = totals[season.length];
    if (totalKg === undefined) {
      throw new RangeError(
        `career: a season ran past MEETS_PER_CAREER (${ATTENDANCE_SWEEP.MEETS_PER_CAREER}) meets`,
      );
    }
    lifter = careerRecordAfterMeet(lifter, meet.id, totalKg);
    season.push({ day, meetId: meet.id, tier: meet.tier, totalKg });
    lastMeetDay = day;
  }
  return season;
}

/**
 * The day of the last meet on the record of a lifter who competed at the
 * season's meets up to and including `throughIndex`, skipping `skipIndex`, or
 * `null` if that leaves them with no meets at all.
 *
 * Kept beside the fold rather than derived from a `CareerLifter`, because a
 * `CareerLifter` does not carry a date and must not start carrying one to suit
 * a control: `CAREER_LIFTER_KEYS` is the fence, and widening it to fit a sweep
 * would be the sweep deciding what eligibility may read.
 */
export function lastEnteredDayOf(
  season: readonly SeasonMeet[],
  throughIndex: number,
  skipIndex: number | null,
): StreakDay | null {
  for (let index = Math.min(throughIndex, season.length - 1); index >= 0; index -= 1) {
    if (index === skipIndex) continue;
    const meet = season[index];
    if (meet !== undefined) return meet.day;
  }
  return null;
}

/**
 * Every day of one tier the lifter has on their record, in calendar order.
 *
 * The tier-keyed entry controls need "when did you last go to a worlds meet",
 * which no `CareerLifter` carries and none may start carrying: widening
 * `CAREER_LIFTER_KEYS` to suit a control would be the sweep deciding what
 * eligibility may read. It is derived from the season beside the fold, the way
 * `lastEnteredDayOf` already is.
 */
export function enteredDaysOfTier(
  season: readonly SeasonMeet[],
  throughIndex: number,
  skipIndex: number | null,
  tier: CareerMeetTier,
): readonly StreakDay[] {
  const days: StreakDay[] = [];
  for (let index = 0; index <= Math.min(throughIndex, season.length - 1); index += 1) {
    if (index === skipIndex) continue;
    const meet = season[index];
    if (meet !== undefined && meet.tier === tier) days.push(meet.day);
  }
  return days;
}

/**
 * What a lifter's entry list is asked from: the day, how long ago they last
 * competed, and which worlds meets are on their record.
 *
 * The last two are what the shipped rule does not read and a rest-based design
 * would have to. Handing them to every variant keeps the arms taking one input
 * each rather than several different ones.
 */
export interface EntryContext {
  readonly today: StreakDay;
  readonly lastEnteredDay: StreakDay | null;
  readonly worldsDaysEntered: readonly StreakDay[];
}

/** Which entry rule a sweep runs under. */
export type EntryVariant =
  | 'shipped'
  | 'entry-cooldown'
  | 'worlds-cooldown-first'
  | 'worlds-cooldown-second'
  | 'worlds-cooldown-third';

/**
 * An entry rule, as a filter of the list the engine itself produced.
 *
 * EVERY CONTROL HERE IS A LOCKOUT, so every one of them is expressible as a
 * filter and `shipped` is the identity. That shape is deliberate and it is what
 * makes the arms comparable: they run on one `enterableMeets` call per lifter
 * per moment rather than one each, which is what lets five arms cost roughly
 * what one used to. A control that ADDED a meet would need a different shape,
 * and there is not one — a design that hands a lifter a meet they are not
 * eligible for is not a §12.3 hazard.
 */
export type EntryFilter = (
  base: readonly CareerMeet[],
  context: EntryContext,
) => readonly CareerMeet[];

/** A lockout of `days` running from `from`, applied to the engine's own list. */
function lockedOutUntil(
  base: readonly CareerMeet[],
  from: StreakDay | null,
  days: number,
): readonly CareerMeet[] {
  if (from === null) return base;
  const clearOn = addDays(from, days);
  return base.filter((meet) => meet.day > clearOn);
}

/**
 * The entry-side controls.
 *
 * Under `entry-cooldown` a lifter may not enter anything for
 * `ENTRY_COOLDOWN_DAYS` after any meet. It is the most plausible of the
 * controls this module measures against — real federations impose rest, and a
 * game would call it recovery — and it is exactly the shape GDD §12.3 refuses:
 * the lifter who competed at one more meet starts their lockout later, so the
 * calendar in front of them is shorter than the calendar in front of the lifter
 * who stayed home.
 *
 * The three `worlds-cooldown-*` entries are the same rest charged after one
 * nominated occurrence of the annual series and after nothing else, which is
 * the more likely design of the two: a fortnight off after a world championship
 * reads as respect for the athlete rather than as a tax. It is the same tax.
 *
 * WHY THE TIER-KEYED CONTROLS WERE PUT ON THIS AXIS AND NOT ON THE RECORD AXIS,
 * AND WHY THAT REASON HAS SINCE EXPIRED. Measured both times, not chosen.
 *
 * The reason as it stood: a worlds-keyed RECORD rule was invisible to the
 * qualification axis at any depth the fixture reached, because `bestTotalKg` is
 * non-decreasing under the shipped fold, the top qualifying total is 650 kg, and
 * the lowest total anybody put up AT a worlds meet was 677.5 kg — so a rule that
 * rewrote their record with it still left them clearing every bar on the ladder.
 *
 * Bounding the totals generator moved that number to 632.5 kg, 17.5 kg UNDER the
 * bar, because careers now plateau inside a band that straddles the top of the
 * ladder rather than climbing out of it; slowing `MAX_GAIN_KG` to 20 moved it
 * again, to 640 kg and a margin of -10, because a slower career is still
 * climbing towards the bar on the day rather than sitting above it.
 * `worlds-reset-second` reports a non-zero on the record axis today, and
 * `eligibility.test.ts` pins the minimum, the bar and the count of careers whose
 * record the rule really does rewrite.
 *
 * The tier-keyed lockouts stay here anyway, and now for a reason that does not
 * depend on the fixture: the enterable list has no ceiling of that kind at all.
 * A lockout takes meets off a lifter whatever they are holding, so the entry
 * axis can see one at any strength, which was always the durable half of the
 * argument and is the half that survives.
 */
export const ENTRY_VARIANTS: Readonly<Record<EntryVariant, EntryFilter>> = Object.freeze({
  shipped: (base) => base,
  'entry-cooldown': (base, context) =>
    lockedOutUntil(base, context.lastEnteredDay, ATTENDANCE_SWEEP.ENTRY_COOLDOWN_DAYS),
  'worlds-cooldown-first': (base, context) =>
    lockedOutUntil(
      base,
      worldsDayAtOccurrence(context, ATTENDANCE_SWEEP.WORLDS_OCCURRENCE_FIRST),
      ATTENDANCE_SWEEP.ENTRY_COOLDOWN_DAYS,
    ),
  'worlds-cooldown-second': (base, context) =>
    lockedOutUntil(
      base,
      worldsDayAtOccurrence(context, ATTENDANCE_SWEEP.WORLDS_OCCURRENCE_SECOND),
      ATTENDANCE_SWEEP.ENTRY_COOLDOWN_DAYS,
    ),
  'worlds-cooldown-third': (base, context) =>
    lockedOutUntil(
      base,
      worldsDayAtOccurrence(context, ATTENDANCE_SWEEP.WORLDS_OCCURRENCE_THIRD),
      ATTENDANCE_SWEEP.ENTRY_COOLDOWN_DAYS,
    ),
});

/** The day of the nominated worlds occurrence on this lifter's record, if they went. */
function worldsDayAtOccurrence(context: EntryContext, occurrence: number): StreakDay | null {
  return (
    context.worldsDaysEntered.find((day) => tierOccurrenceOf('competitive-worlds', day) === occurrence) ?? null
  );
}

/** The list the engine gives, which every entry arm filters. */
export function shippedEntryList(
  lifter: CareerLifter,
  context: EntryContext,
): readonly CareerMeet[] {
  return enterableMeets(lifter, context.today, ATTENDANCE_SWEEP.WINDOW_DAYS);
}

/**
 * The career record of a lifter who competed at the season's meets up to and
 * including `throughIndex`, skipping the one at `skipIndex`.
 *
 * `skipIndex` of `null` is the lifter who went to all of them. The pair
 * (`null`, `i`) is two lifters identical in every respect except that one
 * competed at one more meet, which is the comparison GDD §12.3 asks for.
 *
 * Both arms run this one function; `variant` picks the fold under test, and
 * nothing else about the two lifters can differ.
 */
export function careerAfter(
  season: readonly SeasonMeet[],
  throughIndex: number,
  skipIndex: number | null,
  variant: RecordVariant,
): CareerLifter {
  const fold = RECORD_VARIANTS[variant];
  let lifter: CareerLifter = newCareerLifter(ATTENDANCE_SWEEP.FEDERATION);
  for (let index = 0; index <= throughIndex; index += 1) {
    if (index === skipIndex) continue;
    const meet = season[index];
    if (meet === undefined) break;
    lifter = fold(lifter, meet.meetId, meet.totalKg, meet.tier, meet.day);
  }
  return lifter;
}

/** One evaluation moment: the meet that just happened and every career at it. */
export interface SeasonMoment {
  readonly throughIndex: number;
  readonly meet: SeasonMeet;
  /** The lifter who went to every meet up to and including `throughIndex`. */
  readonly diligent: CareerLifter;
  /** `idle[i]` is that same lifter with the meet at index `i` skipped. */
  readonly idle: readonly CareerLifter[];
}

/**
 * Every moment of a season, with the careers the pair loop compares at each,
 * built by advancing the previous moment's careers instead of re-folding each
 * one from the start of the season.
 *
 * SAME VALUES, LESS ARITHMETIC, and the recurrence is exact rather than
 * approximate:
 *
 *   careerAfter(s, t, i)     = fold(careerAfter(s, t - 1, i), s[t])  for i < t
 *   careerAfter(s, t, t)     = careerAfter(s, t - 1, null)
 *   careerAfter(s, t, null)  = fold(careerAfter(s, t - 1, null), s[t])
 *
 * The middle line is the one worth reading twice: a lifter who skipped the meet
 * that has just happened is the same lifter as the one who had been to
 * everything a moment ago.
 *
 * WHY IT EXISTS. `careerAfter` re-folds the whole prefix per pair, so the pair
 * loop costs a cube of the season length; two calendar periods make a season
 * twice as deep as one, which is eight times the arithmetic for four times the
 * pairs. This is the same measurement over the same pairs. `eligibility.test.ts`
 * drives the two against each other over a whole triangle of moments and pins
 * how many it compared, so a divergence is a red rather than a silently faster
 * answer.
 */
export function* seasonMoments(
  season: readonly SeasonMeet[],
  variant: RecordVariant,
): Generator<SeasonMoment> {
  const fold = RECORD_VARIANTS[variant];
  let diligent: CareerLifter = newCareerLifter(ATTENDANCE_SWEEP.FEDERATION);
  const idle: CareerLifter[] = [];
  for (let throughIndex = 0; throughIndex < season.length; throughIndex += 1) {
    const meet = season[throughIndex];
    if (meet === undefined) break;
    for (let skip = 0; skip < throughIndex; skip += 1) {
      idle[skip] = fold(idle[skip] as CareerLifter, meet.meetId, meet.totalKg, meet.tier, meet.day);
    }
    idle[throughIndex] = diligent;
    diligent = fold(diligent, meet.meetId, meet.totalKg, meet.tier, meet.day);
    yield { throughIndex, meet, diligent, idle };
  }
}

/**
 * Everything `qualifiedMeets` is allowed to read about a lifter, as one string.
 *
 * The attendance axis asks the same qualification question of up to 167 lifters
 * at one moment, and most of them differ in a field qualification does not
 * read. Two lifters with the same key here are two lifters that question
 * answers identically, so a memo on this key is the same measurement with the
 * duplicates removed.
 *
 * THE KEY'S COMPLETENESS IS A CHECK, not an assumption: `eligibility.test.ts`
 * drives the whole strength grid with an empty record and with every meet in
 * the window on it, asserts the two agree, and asserts these keys agree too. An
 * `enteredMeetIds` term added to `qualifiesFor` reddens that pair before it can
 * reach this memo.
 */
export function qualificationKey(lifter: CareerLifter): string {
  return `${lifter.federationId}|${lifter.bestTotalKg}`;
}

/** How many meets of one tier a simulated season holds. */
export function seasonMeetsOfTier(
  season: readonly SeasonMeet[],
  tier: CareerMeetTier,
): readonly SeasonMeet[] {
  return season.filter((meet) => meet.tier === tier);
}

// ---------------------------------------------------------------------------
// AXIS D — the campaign summit is reachable
// ---------------------------------------------------------------------------

/**
 * The inputs GDD §6.6's "always reachable" requirement is measured on, and the
 * two calendars that requirement is measured AGAINST.
 *
 * ===========================================================================
 * WHY THIS IS A FOURTH AXIS AND NOT A COUNT INSIDE AXIS B
 * ===========================================================================
 * Axes A, B and C all ask a §12.3 monotonicity question: does doing MORE ever
 * give you LESS. This one asks a reachability question — is there a lifter who
 * can stand on the top rung at all — and the two are different enough that
 * running them through one fixture would make both worse.
 *
 * Concretely: axis B's `simulateSeason` starts every career on the season
 * anchor. That is the right fixture for a monotonicity comparison, where what
 * matters is that both arms share a calendar. It is the WRONG fixture for
 * reachability, because a summit's reachability depends on where the player
 * enters the season relative to it, and a fixture with one signup day cannot
 * see that. A campaign summit late in the season looks perfectly reachable to
 * every anchor-signup career and can still be a year away for somebody who
 * installed the game in month seven.
 *
 * So this axis sweeps SIGNUP DAY as well as seed, and its careers run for a
 * fixed span from their own signup rather than to a fixed absolute day.
 *
 * ===========================================================================
 * THE REQUIREMENT, IN NUMBERS, STATED BEFORE THE KNOBS WERE PICKED
 * ===========================================================================
 * GDD §6.6 makes "always reachable" a REQUIREMENT of the campaign summit
 * — "always — this is the point of it" — and CLAUDE.md has three times refused
 * a small, honestly measured, permanently documented breach of an absolute. So
 * the first clause is not a percentile:
 *
 *   R1 — EVERY simulated arc enters a campaign summit. All
 *        `SEEDS.length x SIGNUP_OFFSET_DAYS.length` of them, no exceptions
 *        carved out, pinned at the full count rather than bounded.
 *
 *   R2 — PACE. A campaign is a year-scale thing, so the summit has to land
 *        inside one: at least `FIRST_YEAR_ARCS_REQUIRED` of those arcs enter
 *        their first campaign summit within `FIRST_YEAR_DAYS` of signing up,
 *        and the median arc does so inside `MEDIAN_DAYS_CEILING`. This clause
 *        IS distributional and that is deliberate — a slower player taking
 *        longer is pacing, not a lockout, and R1 is what makes it not a
 *        lockout.
 *
 *   R2b — NO SIGNUP DAY IS LOCKED OUT. Every signup offset, taken on its own,
 *        gets at least `MIN_FIRST_YEAR_ARCS_PER_OFFSET` of its 24 arcs to a
 *        summit inside the first year. "Always reachable" is a claim about
 *        every player rather than about an average, and an average is exactly
 *        what hides the failure this piece was sent to fix.
 *
 *   R3 — IT IS A SUMMIT. The gate sits strictly above nationals' and strictly
 *        below competitive worlds' (§6.6's Q1 ruling: separate totals, campaign
 *        lower), and no arc enters a campaign summit off fewer than
 *        `MIN_MEETS_BEFORE_A_SUMMIT` meets — a top rung reached in a fortnight
 *        is not a top rung. Both halves are pinned.
 *
 * `eligibility.test.ts` measures all four and pins the counts. R1 and R3's
 * first half are absolutes; R2, R2b and R3's second half are the numbers a
 * playtester will move.
 *
 * ===========================================================================
 * R2 DOES NOT HOLD AT `MAX_GAIN_KG` 20, AND IT IS REPORTED RATHER THAN RE-PINNED
 * ===========================================================================
 * BOTH HALVES OF R2 MISS. On the shipped calendar at the shipped gain, 158 of
 * the 192 arcs enter a campaign summit inside their first year against a
 * `FIRST_YEAR_ARCS_REQUIRED` of 168 — short by 10 — and the median arc waits 290
 * days against a `MEDIAN_DAYS_CEILING` of 250 — over by 40.
 * `eligibility.test.ts` is RED on exactly those two assertions and on nothing
 * else in R1, R2b or R3.
 *
 * THE TWO CONSTANTS ARE DELIBERATELY NOT MOVED. A requirement adjusted to fit
 * the measurement that just broke it is a pin nudged until green, which
 * CLAUDE.md says is worse than no pin at all. What is genuinely open — and is a
 * human's call rather than a builder's — is whether the requirement was ever
 * about the game or was an artefact of a gain rate nobody had questioned:
 *
 *   - 168 was set as "seven eighths" of 192 and then re-justified by the margin
 *     it happened to have. It was 176 under the unbounded generator, rose to 192
 *     when the generator was bounded — and the block for that constant says in
 *     its own words that the rise "is not the calendar improving" — and is 158
 *     now. The requirement has never once been derived from what a campaign
 *     should feel like; it has three times been read off whatever the fixture
 *     was doing.
 *   - `MEDIAN_DAYS_CEILING` of 250 days sits between the 198-day median of the
 *     unbounded fixture and the 154-day median of the bounded one, which is to
 *     say it was set to clear both. At a rate chosen so that the median campaign
 *     is about six months, a 250-day ceiling on the median wait for the summit
 *     is asking the summit to arrive well before the campaign does.
 *
 * WHAT IS NOT IN DOUBT is that the reachability property R2 was written to
 * protect still holds: R1 is 192 of 192 and R2b clears its bar on every signup
 * day. What R2 is now measuring is PACE, at a pace that was deliberately slowed.
 *
 * R1 IS NOT THE CLAUSE THAT BITES, AND SLOWING THE GAIN RATE GAVE IT BACK ONE
 * ARC OF SEPARATING POWER. It used to separate the shipped calendar from the one
 * §6.6 called a design violation by a single arc — 192 against 191. Bounding the
 * totals generator took that to zero, and this block recorded R1 as exactly
 * vacuous. At gain 20 both annual controls fall to 191 of 192 again, so the
 * separation is back where it was: one arc.
 *
 * ONE ARC IS NOT EVIDENCE AND IT IS NOT READ AS EVIDENCE. R1 is kept as an
 * absolute because GDD §6.6 states it as one and CLAUDE.md has three times
 * refused a documented breach of an absolute. WHAT SEPARATES THE CALENDARS IS
 * R2b: the shipped calendar's worst signup day gets 15 of its 24 arcs to a
 * summit inside the first year and both annual controls' worst signup day gets
 * ZERO. An absolute stated over a whole population hid the failure; the same
 * absolute stated per signup day is the measurement, and it survives the rate
 * change with 3 arcs of margin over its bar where it used to have 12.
 *
 * AND R2b DOES NOT REACH THE PHASE, which is the same lesson one level down.
 * Both clauses are about whether a summit ARRIVES, and the cadence decides
 * that; the phase decides whether the one a new lifter is first SHOWN is one
 * they could ever enter. `anchorArcsEnteringTheirFirstOfferedSummit` is the
 * clause for that, and nothing above it would have moved when it went to zero.
 *
 * ===========================================================================
 * WHAT THE NUMBERS ARE MEASURED AGAINST — THREE CONTROLS, A FULL 2x2
 * ===========================================================================
 * The fix has two knobs, the campaign summit's cadence and its phase, and a
 * measurement that moved both at once could not say which one mattered. So
 * every corner of the square is runnable rather than described:
 *
 *   - `annual-at-the-competitive-phase` is the calendar as it stood before the
 *     summit was split: annual, six days after the anchor. This is the shape
 *     GDD §6.6 recorded as a design violation, and it is kept here so the
 *     violation has a number rather than a memory.
 *   - `annual-late` is the phase moved and the cadence left annual.
 *   - `semi-annual-at-the-competitive-phase` is the cadence moved and the phase
 *     left where it was.
 *
 * THE FOURTH CORNER WAS ADDED AFTER THE FIRST THREE LET A FALSE CLAIM STAND,
 * and the correction is the more useful half of this block. With only the two
 * one-sided controls the shipped calendar passed and both controls failed,
 * which reads as "both knobs were needed" and is what `PHASE_DAYS` claimed.
 * Both controls had moved the cadence too. Holding it: the CADENCE is the
 * reachability fix — semi-annual at the old phase takes 192 of 192 arcs to a
 * summit, worst signup day 14 against the shipped calendar's 15 — and the PHASE
 * is a legibility fix with its own statistic,
 * `anchorArcsEnteringTheirFirstOfferedSummit`, which is 0 of 24 at the old phase
 * under EITHER cadence and 10 of 24 at the shipped one.
 *
 * THAT SPLIT HAS NOW BEEN MEASURED ON THREE FIXTURES AND HAS NOT MOVED. The
 * cadence's two corners were 18 against 19 under the unbounded generator, 24
 * against 24 under the bounded one, and 14 against 15 at gain 20; the phase's
 * two are 0 under both cadences on all three. The reachability clause splits on
 * the cadence and the legibility one splits on the phase, whichever fixture it
 * is asked on, which is a good deal more than any single fixture's numbers say.
 *
 * THE LEGIBILITY STATISTIC IS WHERE THE RATE CHANGE COSTS SOMETHING REAL, and it
 * is recorded rather than absorbed: 10 of 24 rather than 24 of 24. The first
 * campaign summit the calendar shows an anchor-signup lifter falls on day 177,
 * and at gain 20 the median career needs 187 days to put up the 600 kg it asks
 * for — so slightly over half of them now watch that one go past. It is still
 * 10 against the old phase's 0, so the phase is still buying what this block
 * says it buys; it is buying less of it.
 *
 * Two knobs need four corners, or one edge takes the other's credit.
 *
 * No control changes the qualifying total. Threshold and calendar are the two
 * halves of the same defect and the controls hold the threshold still, so what
 * they measure is the calendar's contribution alone.
 *
 * ONE SIDE EFFECT OF THE FIRST CONTROL, NAMED RATHER THAN LEFT TO BE FOUND.
 * Putting the campaign summit back on the competitive summit's series puts both
 * summits on the SAME DAYS, and a lifter cannot be at two meets at once — the
 * greedy rule takes the first meet the tie-break offers, which is the campaign
 * one. So under that control the competitive tier's entries fall to zero, and
 * `eligibility.test.ts` pins the fall. That is not noise to be apologised for:
 * it is `scheduledMeets`'s same-day tie-break, which `calendar.ts` describes as
 * unreachable at the shipped phases, being reached and behaving as documented.
 */
export const CAMPAIGN_SUMMIT_SWEEP = Object.freeze({
  /**
   * How many days after the season anchor each simulated lifter signs up.
   *
   * Eight offsets stepping by 23 days, which covers one campaign cadence
   * (0..161 of 182) and — because 23 and 7 are coprime — puts the eight signups
   * on eight different weekdays, so no arm of this sweep is accidentally
   * aligned with the weekday a tier's series falls on.
   *
   * WHY THE STEP IS NOT A MULTIPLE OF SEVEN, since every cadence is: a sweep
   * whose signup days all shared a weekday would hold the phase relationship
   * between the lifter and every series FIXED, and the whole point of this
   * dimension is that a summit's reachability depends on that relationship.
   */
  SIGNUP_OFFSET_DAYS: Object.freeze([0, 23, 46, 69, 92, 115, 138, 161]),
  /**
   * How long an arc runs, from its own signup day.
   *
   * Two calendar periods, the same span axis B's careers run for, so the two
   * axes are looking at careers of the same depth. It is four campaign
   * cadences, which is what lets a control that only offers a summit annually
   * still offer two.
   */
  RUN_DAYS: 728,
  /**
   * The draw per arc, and a ceiling rather than a count.
   *
   * An arc starting mid-season can catch one more occurrence of a series than
   * one starting on the anchor, so the deepest arc is not a number this file
   * can state from the calendar the way `MEETS_PER_CAREER` is. It is drawn
   * generously and `eligibility.test.ts` pins the deepest arc actually produced
   * against it, so the slack is a measured number instead of a hope.
   */
  MEETS_PER_ARC: 200,
  /** R2's window: a campaign is a year-scale thing. */
  FIRST_YEAR_DAYS: 364,
  /**
   * R2, first half: how many of the 192 arcs must reach a campaign summit
   * inside that first year.
   *
   * 168, which is seven eighths. Not every arc, because a lifter who signs up a
   * week after a summit is held cannot reach that one however well they play,
   * and demanding otherwise would demand a summit every week.
   *
   * DELIBERATELY BELOW THE MEASUREMENT RATHER THAN EQUAL TO IT. The shipped
   * calendar measured 192 — every arc — which `eligibility.test.ts` pinned
   * exactly beside this bar. A requirement set AT its own measurement reads as a
   * requirement chosen to be met, and carries no margin to lose before it is
   * broken.
   *
   * THE MARGIN GOT BIGGER WHEN THE GENERATOR WAS BOUNDED, from 176 to 192, and
   * that is not the calendar improving. A bad meet no longer costs a lifter
   * strength they had already built, so careers climb to the gate faster and
   * more uniformly — the median wait from signup fell from 198 days to 154. This
   * fixture was always "the CEILING of campaign pace, not its middle", as
   * `simulateCampaignArc` says; bounding the generator raised the ceiling it
   * measures rather than telling anybody more about the middle.
   *
   * ===========================================================================
   * AND THE MARGIN IS GONE AT `MAX_GAIN_KG` 20. THIS BAR IS NOT MET AND IS NOT
   * MOVED.
   * ===========================================================================
   * The shipped calendar now takes 158 of 192 arcs to a summit inside their
   * first year, ten short of this number, and `eligibility.test.ts` is red on
   * that assertion. Moving 168 down to 158 would be a pin nudged until green,
   * which is the thing CLAUDE.md says is worse than having no pin.
   *
   * THE HONEST READING, FOR WHOEVER RULES ON IT. This number has been 176, then
   * 192, then 158 across three fixtures, and it has never been derived from what
   * a campaign ought to feel like — each time it was read off whatever the
   * generator was doing and then justified by the margin that left. A
   * requirement derived from a gain rate now known to be five times too fast is
   * not automatically still the right requirement, and it is also not
   * automatically wrong. What decides it is a judgement about pacing that only a
   * human playing this can make.
   *
   * WHAT DOES NOT DEPEND ON THAT RULING: R1 is 192 of 192 and R2b clears its bar
   * on every signup day, so the summit is still REACHABLE for every arc and no
   * signup day is locked out. It is R2's PACE clause alone that misses, at a
   * pace that was deliberately slowed.
   */
  FIRST_YEAR_ARCS_REQUIRED: 168,
  /**
   * R2, second half: the median arc's wait, in days from signup.
   *
   * ALSO NOT MET AT `MAX_GAIN_KG` 20, AND ALSO NOT MOVED: the median arc waits
   * 290 days against this 250. Same reasoning as the constant above, and one
   * observation a ruling would want — 250 was set between the unbounded
   * fixture's 198-day median and the bounded one's 154, which is to say it was
   * chosen to clear both rather than derived. At a gain rate picked so that the
   * median campaign reaches the gate around day 187, a 250-day ceiling on the
   * median wait for the summit ITSELF asks the summit to arrive barely two
   * months after a lifter first qualifies for it.
   */
  MEDIAN_DAYS_CEILING: 250,
  /**
   * R2b: the fewest arcs any ONE signup day may get to a summit inside the
   * first year, out of the 24 seeds that share it.
   *
   * Half. The shipped calendar's worst signup day measures 15 of 24 and both
   * annual controls' worst measure 0 of 24, so this bar sits between two numbers
   * that are not close, which is what a bar wants.
   *
   * THE SHIPPED SIDE HAS BEEN 19, THEN 24, AND IS NOW 15; THE CONTROLS' ZERO HAS
   * NOT MOVED ON ANY OF THE THREE FIXTURES. That is the whole reason this clause
   * is the one that carries the calendar's case rather than R1 or R2: the thing
   * being measured is a lockout, a lockout is a property of the calendar, and it
   * stays zero however fast or slow the lifters climb. R2 moved with the gain
   * rate and broke; this did not.
   *
   * THE MARGIN IS 3 ARCS AND THAT IS WORTH SAYING PLAINLY. It was 12 when the
   * shipped side was saturated at 24. A further slowdown — gain 12, which
   * `MAX_GAIN_KG`'s block names as the next candidate — would be expected to
   * take it lower again, and this bar is the one to watch when that ruling is
   * made, because it is the one whose failure would be a design violation rather
   * than a pacing complaint.
   */
  MIN_FIRST_YEAR_ARCS_PER_OFFSET: 12,
  /**
   * R3, second half: the fewest meets an arc may have behind it when it enters
   * its first campaign summit.
   *
   * Five. A summit a lifter walks into off two meets is a formality with a big
   * name on it.
   *
   * THE MEASURED FLOOR IS 31, AND THE HISTORY OF THAT NUMBER IS THE ARGUMENT
   * FOR WHY THE RATE AXIS HAD TO MOVE. It was 8 under an unbounded two-sided
   * walk that could add 70 kg at a single meet with no ceiling anywhere, and 9
   * when that walk was given a per-lifter ceiling with decaying gains. The block
   * recording that move said the one-meet difference was the finding: a ceiling
   * bounds where a career ENDS UP and barely touches how fast it STARTS, because
   * headroom is 1 at the opening total by construction, so "380 kg to the 600 kg
   * gate in nine meets is still not a pace any real lifter has".
   *
   * `MAX_GAIN_KG` GOING TO 20 IS THE CHANGE THAT MOVED IT, from 9 to 31. That is
   * the axis the previous two rounds could not reach, and it is the number this
   * clause was always about: the fastest arc in the whole 192 now has thirty
   * meets behind it before it stands on a summit, where it used to have eight.
   *
   * THE BAR OF 5 IS NOW A LONG WAY UNDER THE MEASUREMENT and is left where it
   * is. It is a floor on a design property — "a summit a lifter walks into off
   * two meets is a formality with a big name on it" — rather than a pacing
   * target, so a large margin is the right shape for it. `eligibility.test.ts`
   * pins the 31 exactly beside the bar, which is what moves if a future rate
   * change takes the fastest arc back down.
   */
  MIN_MEETS_BEFORE_A_SUMMIT: 5,
  FEDERATION: 'meridian' as CareerFederationId,
});

/** Which campaign-summit calendar an arc runs on. */
export type CampaignCalendarVariant =
  | 'shipped'
  | 'annual-at-the-competitive-phase'
  | 'annual-late'
  | 'semi-annual-at-the-competitive-phase';

/** A tier's series as the two numbers that generate it. */
export interface SeriesShape {
  readonly cadenceDays: number;
  readonly phaseDays: number;
}

/**
 * The four calendars the campaign summit is measured on: the shipped one and
 * the three corners of the two-knob square.
 *
 * `shipped` READS `CAREER_TUNING` rather than restating it, so a tuner who
 * moves the campaign cadence or phase moves this arm with it and the
 * measurement re-runs on what actually ships. The controls read the competitive
 * tier's own numbers for the same reason: the unfixed calendar is not a number
 * typed here, it is the annual series the competitive summit still runs on.
 *
 * THE FOURTH ARM EXISTS BECAUSE THE FIRST THREE LET A FALSE CLAIM STAND.
 * `PHASE_DAYS`' block said 177 was "the other half of the reachability fix",
 * and with the shipped arm and two controls that read as though the measurement
 * supported it: the calendar with the old phase fails and the calendar with the
 * new one passes. Both controls moved the CADENCE as well, so neither of them
 * could tell which knob mattered.
 *
 * Held apart, it is the CADENCE. This arm is the shipped cadence at the old
 * phase — a summit every 182 days starting on day six — and it takes 192 of 192
 * arcs to a summit with a worst signup day of 18 against the shipped 19. The
 * phase is very nearly free once the cadence is semi-annual, and the reason is
 * arithmetic rather than luck: a series that comes round twice a year has an
 * occurrence within 182 days of every day there is, wherever it starts.
 *
 * So a square of two knobs needs its fourth corner or one of the two edges gets
 * the other's credit. The phase's own argument survives, smaller and honest,
 * and it is in `PHASE_DAYS`' block: at the old phase the season's first summit
 * falls on day six and NOBODY can enter it, so the calendar shows every new
 * lifter a summit that is furniture. That is a legibility cost with a number
 * behind it, not a reachability one.
 */
export const CAMPAIGN_CALENDAR_VARIANTS: Readonly<Record<CampaignCalendarVariant, SeriesShape>> =
  Object.freeze({
    shipped: Object.freeze({
      cadenceDays: CAREER_TUNING.CADENCE_DAYS['campaign-worlds'],
      phaseDays: CAREER_TUNING.PHASE_DAYS['campaign-worlds'],
    }),
    'annual-at-the-competitive-phase': Object.freeze({
      cadenceDays: CAREER_TUNING.CADENCE_DAYS['competitive-worlds'],
      phaseDays: CAREER_TUNING.PHASE_DAYS['competitive-worlds'],
    }),
    'annual-late': Object.freeze({
      cadenceDays: CAREER_TUNING.CADENCE_DAYS['competitive-worlds'],
      phaseDays: CAREER_TUNING.PHASE_DAYS['campaign-worlds'],
    }),
    'semi-annual-at-the-competitive-phase': Object.freeze({
      cadenceDays: CAREER_TUNING.CADENCE_DAYS['campaign-worlds'],
      phaseDays: CAREER_TUNING.PHASE_DAYS['competitive-worlds'],
    }),
  });

/**
 * Every day in `[fromDay, toDay]` a series of this shape holds a meet on.
 *
 * The same arithmetic `calendar.ts`'s `meetDaysForTier` runs, over a shape
 * given as two numbers instead of read from a tier. It exists because the
 * controls need a calendar the shipped tuning does not hold, and `CAREER_TUNING`
 * is frozen and must stay that way.
 *
 * A SECOND IMPLEMENTATION OF A THING THE ENGINE ALREADY DOES IS A DRIFT
 * HAZARD, so it is checked rather than trusted: `eligibility.test.ts` asserts
 * this function's output for the `shipped` shape is identical to
 * `meetDaysForTier('campaign-worlds', ...)` over the whole simulated span. An
 * edit to either that makes them disagree reddens there.
 */
export function seriesDays(
  shape: SeriesShape,
  fromDay: StreakDay,
  toDay: StreakDay,
): readonly StreakDay[] {
  if (toDay < fromDay) return [];
  const start = addDays(seasonAnchorDay(), shape.phaseDays);
  if (toDay < start) return [];
  const firstIndex = fromDay <= start ? 0 : Math.ceil((fromDay - start) / shape.cadenceDays);
  const days: StreakDay[] = [];
  for (let index = firstIndex; ; index += 1) {
    const day = addDays(start, index * shape.cadenceDays);
    if (day > toDay) break;
    days.push(day);
  }
  return days;
}

/**
 * The federation's whole calendar in `[fromDay, toDay]`, with the campaign
 * summit's series moved to the variant's shape.
 *
 * Every meet is built by `careerMeetFor`, the engine's own constructor, so a
 * relocated summit carries the engine's qualifying total, id and name. The ONLY
 * thing a variant changes is which days the campaign summit falls on — which is
 * what makes these controls a measurement of the calendar position rather than
 * of a second, differently gated tier.
 */
export function variantCalendar(
  variant: CampaignCalendarVariant,
  fromDay: StreakDay,
  toDay: StreakDay,
): readonly CareerMeet[] {
  const shape = CAMPAIGN_CALENDAR_VARIANTS[variant];
  const others = scheduledMeets(CAMPAIGN_SUMMIT_SWEEP.FEDERATION, fromDay, toDay).filter(
    (meet) => meet.tier !== 'campaign-worlds',
  );
  const summits = seriesDays(shape, fromDay, toDay).map((day) =>
    careerMeetFor(CAMPAIGN_SUMMIT_SWEEP.FEDERATION, 'campaign-worlds', day),
  );
  return [...others, ...summits].sort((a, b) =>
    a.day === b.day ? tierIndex(a.tier) - tierIndex(b.tier) : a.day - b.day,
  );
}

/** One simulated campaign arc: who, from when, and what they got to. */
export interface CampaignArc {
  readonly seed: number;
  /** Days after the season anchor this lifter signed up. */
  readonly signupOffsetDays: number;
  readonly meets: readonly SeasonMeet[];
  /** Days from signup to the first campaign summit entered, or `null` if none. */
  readonly daysToFirstSummit: number | null;
  /** How many meets were behind them when they entered it. */
  readonly meetsBeforeFirstSummit: number | null;
  readonly summitsEntered: number;
  /**
   * Did this lifter enter the very first campaign summit their calendar put in
   * front of them?
   *
   * The phase's own measurement, and the one the cadence cannot make for it. A
   * summit offered on the sixth day of a career is furniture: it is on the
   * calendar, it is the top of the ladder, and nobody at any seed can be strong
   * enough for it. `false` here is either that, or a lifter who was genuinely
   * too slow — which is why it is counted at the anchor-signup arms, where the
   * two are told apart by the gate-clearing count beside it.
   */
  readonly enteredFirstOfferedSummit: boolean;
  /** How many of each tier the calendar OFFERED inside this arc's window. */
  readonly offeredPerTier: Readonly<Record<CareerMeetTier, number>>;
  /** How many of each tier the lifter actually entered. */
  readonly enteredPerTier: Readonly<Record<CareerMeetTier, number>>;
}

function emptyTierTally(): Record<CareerMeetTier, number> {
  const tally = {} as Record<CareerMeetTier, number>;
  for (const tier of tiersLowestFirst()) tally[tier] = 0;
  return tally;
}

/**
 * One lifter's campaign, played greedily from their own signup day.
 *
 * The same rule `simulateSeason` uses — walk the days, take the first meet the
 * engine says can be entered — and for the same reason: at
 * `MIN_DAYS_BETWEEN_MEETS` of 1 this is the most competitive career the game
 * will sell, which is what "a solo player who plays the campaign well" means
 * when it has to be a number. Entry is decided by `canEnter` itself, so the
 * fixture cannot drift from the engine.
 *
 * WHAT IT DOES NOT MODEL, said plainly because a reader will assume otherwise:
 * a real player misses meets, and a player who misses meets climbs slower and
 * reaches the summit later than every arc here. This measures the CEILING of
 * campaign pace, not its middle. R1's "every arc reaches a summit" is therefore
 * a statement about the best case, and the honest reading of it is that a
 * calendar failing R1 is certainly unreachable rather than that one passing it
 * is certainly reachable for everybody.
 */
export function simulateCampaignArc(
  seed: number,
  signupOffsetDays: number,
  variant: CampaignCalendarVariant,
): CampaignArc {
  const totals = seededCareerTotals(seed, CAMPAIGN_SUMMIT_SWEEP.MEETS_PER_ARC);
  const signupDay = addDays(seasonAnchorDay(), signupOffsetDays);
  const lastDay = addDays(signupDay, CAMPAIGN_SUMMIT_SWEEP.RUN_DAYS);
  const calendar = variantCalendar(variant, signupDay, lastDay);
  const byDay = new Map<number, CareerMeet[]>();
  const offeredPerTier = emptyTierTally();
  for (const meet of calendar) {
    offeredPerTier[meet.tier] += 1;
    const row = byDay.get(meet.day);
    if (row === undefined) byDay.set(meet.day, [meet]);
    else row.push(meet);
  }

  let lifter: CareerLifter = newCareerLifter(CAMPAIGN_SUMMIT_SWEEP.FEDERATION);
  const meets: SeasonMeet[] = [];
  const enteredPerTier = emptyTierTally();
  let lastMeetDay: number | null = null;
  let daysToFirstSummit: number | null = null;
  let meetsBeforeFirstSummit: number | null = null;
  let summitsEntered = 0;
  for (let day = signupDay; day <= lastDay; day = addDays(day, 1)) {
    if (lastMeetDay !== null && day - lastMeetDay < ATTENDANCE_SWEEP.MIN_DAYS_BETWEEN_MEETS) continue;
    const meet = (byDay.get(day) ?? []).find((candidate) => canEnter(lifter, candidate, day));
    if (meet === undefined) continue;
    const totalKg = totals[meets.length];
    if (totalKg === undefined) {
      throw new RangeError(
        `career: an arc ran past MEETS_PER_ARC (${CAMPAIGN_SUMMIT_SWEEP.MEETS_PER_ARC}) meets`,
      );
    }
    if (meet.tier === 'campaign-worlds') {
      if (daysToFirstSummit === null) {
        daysToFirstSummit = day - signupDay;
        meetsBeforeFirstSummit = meets.length;
      }
      summitsEntered += 1;
    }
    lifter = careerRecordAfterMeet(lifter, meet.id, totalKg);
    meets.push({ day, meetId: meet.id, tier: meet.tier, totalKg });
    enteredPerTier[meet.tier] += 1;
    lastMeetDay = day;
  }
  const firstOfferedSummit = calendar.find((meet) => meet.tier === 'campaign-worlds');
  return {
    seed,
    signupOffsetDays,
    meets,
    daysToFirstSummit,
    meetsBeforeFirstSummit,
    summitsEntered,
    enteredFirstOfferedSummit:
      firstOfferedSummit !== undefined && meets.some((meet) => meet.meetId === firstOfferedSummit.id),
    offeredPerTier: Object.freeze(offeredPerTier),
    enteredPerTier: Object.freeze(enteredPerTier),
  };
}

/** Every (seed, signup day) arc of one variant, in a fixed order. */
export function campaignArcs(variant: CampaignCalendarVariant): readonly CampaignArc[] {
  const arcs: CampaignArc[] = [];
  for (const seed of ATTENDANCE_SWEEP.SEEDS) {
    for (const offset of CAMPAIGN_SUMMIT_SWEEP.SIGNUP_OFFSET_DAYS) {
      arcs.push(simulateCampaignArc(seed, offset, variant));
    }
  }
  return arcs;
}

/** What one variant's arcs add up to. Counts, never bounds. */
export interface CampaignReach {
  readonly arcs: number;
  /** Arcs that entered at least one campaign summit. R1 is this equalling `arcs`. */
  readonly arcsReachingASummit: number;
  /** Arcs that entered one within `FIRST_YEAR_DAYS` of signing up. R2. */
  readonly arcsReachingInsideAYear: number;
  /**
   * The same count cut by signup day, in `SIGNUP_OFFSET_DAYS` order. R2b.
   *
   * This is the row that tells a lockout from a slow average: a calendar can
   * take three quarters of all arcs to a summit inside a year while one signup
   * day gets none of its own there, and only the cut says so.
   */
  readonly firstYearArcsPerOffset: readonly number[];
  /** The smallest entry in the row above. R2b is this clearing its bar. */
  readonly worstOffsetFirstYearArcs: number;
  /** Days from signup to first summit, over the arcs that reached one, sorted. */
  readonly daysToFirstSummit: readonly number[];
  readonly medianDaysToFirstSummit: number | null;
  readonly worstDaysToFirstSummit: number | null;
  /** The fewest meets any arc had behind it at its first summit. R3. */
  readonly fewestMeetsBeforeASummit: number | null;
  readonly summitsEntered: number;
  readonly offeredPerTier: Readonly<Record<CareerMeetTier, number>>;
  readonly enteredPerTier: Readonly<Record<CareerMeetTier, number>>;
  /** The deepest arc, against which `MEETS_PER_ARC`'s slack is measured. */
  readonly deepestArc: number;
  /**
   * How many of the ANCHOR-SIGNUP arcs entered the first campaign summit their
   * calendar offered them. The phase's own statistic — see the field of the
   * same name on `CampaignArc`.
   */
  readonly anchorArcsEnteringTheirFirstOfferedSummit: number;
}

/** Fold one variant's arcs into the counts the requirement is read off. */
export function measureCampaignReach(variant: CampaignCalendarVariant): CampaignReach {
  const arcs = campaignArcs(variant);
  const offeredPerTier = emptyTierTally();
  const enteredPerTier = emptyTierTally();
  const reached: number[] = [];
  let arcsReachingInsideAYear = 0;
  let summitsEntered = 0;
  let fewestMeetsBeforeASummit: number | null = null;
  let deepestArc = 0;
  for (const arc of arcs) {
    for (const tier of tiersLowestFirst()) {
      offeredPerTier[tier] += arc.offeredPerTier[tier];
      enteredPerTier[tier] += arc.enteredPerTier[tier];
    }
    summitsEntered += arc.summitsEntered;
    deepestArc = Math.max(deepestArc, arc.meets.length);
    if (arc.daysToFirstSummit !== null) {
      reached.push(arc.daysToFirstSummit);
      if (arc.daysToFirstSummit <= CAMPAIGN_SUMMIT_SWEEP.FIRST_YEAR_DAYS) arcsReachingInsideAYear += 1;
    }
    if (arc.meetsBeforeFirstSummit !== null) {
      fewestMeetsBeforeASummit =
        fewestMeetsBeforeASummit === null
          ? arc.meetsBeforeFirstSummit
          : Math.min(fewestMeetsBeforeASummit, arc.meetsBeforeFirstSummit);
    }
  }
  const firstYearArcsPerOffset = CAMPAIGN_SUMMIT_SWEEP.SIGNUP_OFFSET_DAYS.map(
    (offset) =>
      arcs.filter(
        (arc) =>
          arc.signupOffsetDays === offset &&
          arc.daysToFirstSummit !== null &&
          arc.daysToFirstSummit <= CAMPAIGN_SUMMIT_SWEEP.FIRST_YEAR_DAYS,
      ).length,
  );
  const sorted = [...reached].sort((a, b) => a - b);
  return {
    arcs: arcs.length,
    arcsReachingASummit: sorted.length,
    arcsReachingInsideAYear,
    firstYearArcsPerOffset: Object.freeze(firstYearArcsPerOffset),
    worstOffsetFirstYearArcs: Math.min(...firstYearArcsPerOffset),
    daysToFirstSummit: sorted,
    medianDaysToFirstSummit: sorted.length === 0 ? null : (sorted[Math.floor(sorted.length / 2)] as number),
    worstDaysToFirstSummit: sorted.length === 0 ? null : (sorted[sorted.length - 1] as number),
    fewestMeetsBeforeASummit,
    summitsEntered,
    offeredPerTier: Object.freeze(offeredPerTier),
    enteredPerTier: Object.freeze(enteredPerTier),
    deepestArc,
    anchorArcsEnteringTheirFirstOfferedSummit: arcs.filter(
      (arc) => arc.signupOffsetDays === 0 && arc.enteredFirstOfferedSummit,
    ).length,
  };
}
