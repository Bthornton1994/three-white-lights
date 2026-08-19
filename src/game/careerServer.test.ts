import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  CAREER_BOUNDARY_SWEEP,
  boundaryMeetPlans,
  type BoundaryMeetPlan,
} from '../career/careerSweep';
import { CAREER_TUNING } from '../career/careerTuning';
import { entryVerdict, newCareerLifter } from '../career/eligibility';
import { seasonAnchorDay, upcomingMeets } from '../career/calendar';
import {
  applyFederationChoice,
  careerCalendarFor,
  careerLifterFor,
  careerMeetOutcome,
} from './careerServer';
import {
  careerCalendarFromCache,
  careerLifterFromCache,
  federationFromCache,
} from './careerClient';
import { LIFT_ORDER, type LiftKind } from './meet';
import { applyMeetResult } from './meetServer';
import { MEET_ENTRY, MEET_LOCAL, type MeetDefinition } from './meetTuning';
import {
  applyServerSnapshot,
  asMeetId,
  emptyProgressionCache,
  receiveProgressionSnapshot,
  type MeetAttemptReport,
  type ProgressionCache,
  type ProposalOfKind,
} from './progression';
import { newServerRecord, snapshotWireFor, type ServerRecord } from './sessionServer';
import { asStreakDay } from './streak';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.join(HERE, '..');

/** Signup day for every fixture. Day 0, before every sweep meet day. */
const SIGNUP_DAY = 0;

/** The civil-day index every eligibility comparison is taken on. */
function comparisonDay(): number {
  return seasonAnchorDay() + CAREER_BOUNDARY_SWEEP.COMPARISON_DAY_OFFSET;
}

// ---------------------------------------------------------------------------
// Driving the real write path: plans -> cards -> applyMeetResult
// ---------------------------------------------------------------------------

/** The meet definition one boundary-sweep meet is recorded against. */
function sweepMeetDef(seed: number, meetIndex: number): MeetDefinition {
  return { ...MEET_LOCAL, id: `boundary-sweep-${seed}-${meetIndex}` };
}

/**
 * A legal card for one plan: ascending attempts on every lift, every attempt
 * good — except a bombed meet, which is three misses at the squat opener and
 * NOTHING AFTER, because GDD §6.2's bomb-out ends the meet: the engine refuses
 * a bench attempt reported after the third squat miss, so the honest card of a
 * bombed lifter simply stops.
 */
function cardFor(plan: BoundaryMeetPlan): MeetAttemptReport[] {
  if (plan.bombed) {
    return ([1, 2, 3] as const).map((attemptNumber) => ({
      lift: 'squat' as const,
      attemptNumber,
      weight: plan.openersKg.squat,
      good: false,
    }));
  }
  const out: MeetAttemptReport[] = [];
  for (const lift of LIFT_ORDER) {
    const opener = plan.openersKg[lift];
    ([1, 2, 3] as const).forEach((attemptNumber, index) => {
      out.push({
        lift,
        attemptNumber,
        weight: opener + index * CAREER_BOUNDARY_SWEEP.JUMP_KG,
        good: true,
      });
    });
  }
  return out;
}

function proposalFor(def: MeetDefinition, plan: BoundaryMeetPlan): ProposalOfKind<'record-meet-result'> {
  return {
    kind: 'record-meet-result',
    report: {
      meetId: asMeetId(def.id),
      bodyweight: MEET_ENTRY.bodyweight,
      card: { unit: 'kg', kilogramAttempts: cardFor(plan) },
    },
  };
}

/**
 * Play one seeded career through the shipped write path, optionally sitting
 * one meet out. `skipIndex` is the meet the lifter stays home from; every
 * other meet is identical between the two histories, which is the pair shape
 * GDD §12.3's property is stated over.
 */
function runCareer(seed: number, skipIndex: number | null): ServerRecord {
  let record = newServerRecord(SIGNUP_DAY);
  for (const plan of boundaryMeetPlans(seed)) {
    if (plan.meetIndex === skipIndex) continue;
    const def = sweepMeetDef(seed, plan.meetIndex);
    const applied = applyMeetResult(record, plan.day, def, proposalFor(def, plan), `sweep-${seed}-${plan.meetIndex}`);
    if (!applied.ok) throw new Error(`sweep seed ${seed} meet ${plan.meetIndex}: ${applied.error.message}`);
    record = applied.value.record;
  }
  return record;
}

function allSeeds(): readonly number[] {
  return Array.from({ length: CAREER_BOUNDARY_SWEEP.SEEDS }, (_, seed) => seed);
}

/** A cache holding one record's snapshot, through the one door. */
function cacheFor(record: ServerRecord): ProgressionCache {
  const received = receiveProgressionSnapshot(snapshotWireFor(record, null));
  if (!received.ok) throw new Error(received.error.message);
  const applied = applyServerSnapshot(emptyProgressionCache(), received.value);
  if (!applied.ok) throw new Error(applied.error.message);
  return applied.value;
}

// ---------------------------------------------------------------------------
// The fold: the career record IS the meets on the row
// ---------------------------------------------------------------------------

describe('careerLifterFor derives the career record from the stored row', () => {
  it('starts where newCareerLifter starts, for a lifter with no meets', () => {
    const record = newServerRecord(SIGNUP_DAY);
    expect(careerLifterFor(record)).toEqual(newCareerLifter(record.federation.id));
  });

  it('agrees with the stored best total on every record the write path can reach [the-career-record-is-the-meets-on-the-row]', () => {
    // THE TWO COMPUTATIONS OF ONE FACT, PINNED EQUAL. `record.totalKg` is
    // `nextTotalKg`'s monotone best; the fold's best is `careerRecordAfterMeet`
    // applied meet by meet. If either side ever stops being max-over-meets —
    // a latest-not-best regression on either module — this is the line that
    // says so, over every record the sweep reaches including every proper
    // prefix and every sat-out variant.
    let recordsChecked = 0;
    let bombedMeetsSeen = 0;
    let recordsWithATotal = 0;
    for (const seed of allSeeds()) {
      const skips: (number | null)[] = [null];
      for (let skip = 0; skip < CAREER_BOUNDARY_SWEEP.MEETS_PER_CAREER; skip += 1) skips.push(skip);
      for (const skip of skips) {
        const record = runCareer(seed, skip);
        const lifter = careerLifterFor(record);
        expect(lifter.bestTotalKg, `seed ${seed} skip ${String(skip)}`).toBe(record.totalKg);
        expect(lifter.federationId).toBe(record.federation.id);
        // The entered list IS the meets list: same ids, same order, no
        // duplicates — a bombed meet included, which is what the null arm of
        // `careerRecordAfterMeet` exists for.
        expect(lifter.enteredMeetIds).toEqual(record.meets.map((meet) => meet.meetId));
        expect(new Set(lifter.enteredMeetIds).size).toBe(lifter.enteredMeetIds.length);
        recordsChecked += 1;
        bombedMeetsSeen += record.meets.filter((meet) => meet.totalKg === null).length;
        if (record.totalKg !== null) recordsWithATotal += 1;
      }
    }
    // NON-VACUITY, AS COUNTS. The equality above passes over an empty domain,
    // a bomb-out-free domain, and a domain that never banked a total; these
    // pins say the sweep saw all three shapes. Measured, not derived.
    expect(recordsChecked).toBe(112);
    expect(bombedMeetsSeen).toBe(102);
    expect(recordsWithATotal).toBe(112);
  });

  it('spends the entry on a bomb-out and banks no total from it', () => {
    // The null arm, isolated: one meet, bombed. The entry is on the record —
    // `entryVerdict` would refuse a re-entry — and the best total is exactly
    // what it was, which is GDD §12.3's floor: the worst possible meet day
    // cannot lower the number qualification reads.
    const seed = 0;
    const plan: BoundaryMeetPlan = { ...boundaryMeetPlans(seed)[0]!, bombed: true };
    const def = sweepMeetDef(seed, plan.meetIndex);
    const applied = applyMeetResult(
      newServerRecord(SIGNUP_DAY),
      plan.day,
      def,
      proposalFor(def, plan),
      'bomb-fixture',
    );
    if (!applied.ok) throw new Error(applied.error.message);
    expect(applied.value.totalKg, 'the meet itself banked no total').toBeNull();
    const lifter = careerLifterFor(applied.value.record);
    expect(lifter.enteredMeetIds).toEqual([def.id]);
    expect(lifter.bestTotalKg).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// GDD §12.3 through the real boundary: one extra completed meet never shrinks
// the career
// ---------------------------------------------------------------------------

describe('a lifter who competed one more time, measured through the write path', () => {
  it('never ends with a lower best total, and the sweep saw the total actually move', () => {
    let pairs = 0;
    let pairsWhereTheExtraMeetRaisedIt = 0;
    const violations: string[] = [];
    for (const seed of allSeeds()) {
      const baseline = careerLifterFor(runCareer(seed, null));
      for (let skip = 0; skip < CAREER_BOUNDARY_SWEEP.MEETS_PER_CAREER; skip += 1) {
        const satOut = careerLifterFor(runCareer(seed, skip));
        pairs += 1;
        const more = baseline.bestTotalKg;
        const fewer = satOut.bestTotalKg;
        if (more === null && fewer !== null) violations.push(`seed ${seed} skip ${skip}: total vanished`);
        if (more !== null && fewer !== null && more < fewer) {
          violations.push(`seed ${seed} skip ${skip}: ${more} < ${fewer}`);
        }
        if ((more ?? 0) > (fewer ?? 0)) pairsWhereTheExtraMeetRaisedIt += 1;
      }
    }
    expect(violations).toEqual([]);
    // Non-vacuity: the counts are measured, and the second one is what says
    // the comparison had a domain — in some pairs the skipped meet WAS the
    // career best, so skipping it genuinely lowered the sat-out lifter.
    expect(pairs).toBe(96);
    expect(pairsWhereTheExtraMeetRaisedIt).toBe(16);
  });

  it('never turns an open calendar entry into a refusal, on the read model a screen draws', () => {
    // THE ELIGIBILITY HALF, measured on `careerCalendarFor` itself rather than
    // on the math underneath it: for two histories identical except one extra
    // completed meet, every entry the sat-out lifter may enter, the lifter who
    // competed may enter too. The exhaustive per-axis version of this lives in
    // `eligibility.test.ts`; what is new here is the SUBJECT — records the
    // shipped write path produced, read back through the shipped read model.
    //
    // The sweep's meet ids are not calendar ids, so ALREADY_ENTERED cannot be
    // the discriminator in this comparison; what moves between the two views
    // is the qualifying total, which is exactly the §12.3 surface. Entry
    // spending on the lifter's own record is eligibility.test.ts axis C's
    // measured ground and is not re-measured here.
    let entriesCompared = 0;
    let entriesOnlyTheExtraMeetOpened = 0;
    const violations: string[] = [];
    for (const seed of allSeeds()) {
      const baselineView = careerCalendarFor(
        careerLifterFor(runCareer(seed, null)),
        comparisonDay(),
        CAREER_BOUNDARY_SWEEP.COMPARISON_HORIZON_DAYS,
      );
      const baselineOpen = new Set(
        baselineView.entries.filter((entry) => entry.verdict.kind === 'open').map((entry) => entry.meet.id),
      );
      for (let skip = 0; skip < CAREER_BOUNDARY_SWEEP.MEETS_PER_CAREER; skip += 1) {
        const satOutView = careerCalendarFor(
          careerLifterFor(runCareer(seed, skip)),
          comparisonDay(),
          CAREER_BOUNDARY_SWEEP.COMPARISON_HORIZON_DAYS,
        );
        for (const entry of satOutView.entries) {
          entriesCompared += 1;
          if (entry.verdict.kind === 'open' && !baselineOpen.has(entry.meet.id)) {
            violations.push(`seed ${seed} skip ${skip}: ${entry.meet.id} closed by competing more`);
          }
          if (entry.verdict.kind !== 'open' && baselineOpen.has(entry.meet.id)) {
            entriesOnlyTheExtraMeetOpened += 1;
          }
        }
      }
    }
    expect(violations).toEqual([]);
    // Non-vacuity: the second count is the meets the EXTRA meet's total
    // unlocked — the domain where the property could have failed and did not.
    expect(entriesCompared).toBe(8160);
    expect(entriesOnlyTheExtraMeetOpened).toBe(42);
  });

  it('refuses a replayed completion and moves nothing — the duplicate is pinned, not papered over', () => {
    // Idempotence at the boundary: the same meetId a second time. What a
    // duplicate completion returns is the refusal below; the record is not on
    // it, so there is nothing for a confused caller to adopt.
    for (const seed of allSeeds()) {
      const plans = boundaryMeetPlans(seed);
      const first = plans[0]!;
      const def = sweepMeetDef(seed, first.meetIndex);
      const record = runCareer(seed, null);
      const replay = applyMeetResult(record, first.day, def, proposalFor(def, first), `replay-${seed}`);
      expect(replay.ok).toBe(false);
      if (replay.ok) throw new Error('unreachable');
      expect(replay.error.code).toBe('MEET_ALREADY_RECORDED');
      // And the career read model is exactly what it was: the refusal happened
      // before anything moved, and the fold reads a row the refusal never
      // touched.
      expect(careerLifterFor(record)).toEqual(careerLifterFor(record));
      expect(careerLifterFor(record).enteredMeetIds.filter((id) => id === def.id)).toHaveLength(1);
    }
  });
});

// ---------------------------------------------------------------------------
// What one result did to the career — the recap's data
// ---------------------------------------------------------------------------

describe('careerMeetOutcome', () => {
  it('agrees with the write path about what a best total is, on every applied meet', () => {
    // `AppliedMeetResult.isTotalPr` and `career.isCareerBestTotal` are two
    // reads of one number. This drives every sweep meet through the real path
    // and pins them equal, plus the after-total against the stored one — so
    // the recap's career line cannot disagree with the total the row banked.
    let meetsApplied = 0;
    let careerBests = 0;
    let unlocks = 0;
    for (const seed of allSeeds()) {
      let record = newServerRecord(SIGNUP_DAY);
      for (const plan of boundaryMeetPlans(seed)) {
        const def = sweepMeetDef(seed, plan.meetIndex);
        const applied = applyMeetResult(record, plan.day, def, proposalFor(def, plan), `outcome-${seed}-${plan.meetIndex}`);
        if (!applied.ok) throw new Error(applied.error.message);
        expect(applied.value.career.isCareerBestTotal).toBe(applied.value.isTotalPr);
        expect(applied.value.career.bestTotalKgAfter).toBe(applied.value.record.totalKg);
        expect(applied.value.career.bestTotalKgBefore).toBe(record.totalKg);
        meetsApplied += 1;
        if (applied.value.career.isCareerBestTotal) careerBests += 1;
        unlocks += applied.value.career.newlyQualifiedTiers.length;
        record = applied.value.record;
      }
    }
    // Non-vacuity: meets were applied, some were career bests and some were
    // not, and tiers were genuinely unlocked along the way.
    expect(meetsApplied).toBe(96);
    expect(careerBests).toBe(34);
    expect(unlocks).toBe(32);
  });

  it('reports a first total as a career best and a bomb-out as nothing', () => {
    const fresh = newCareerLifter('meridian');
    const first = careerMeetOutcome(fresh, 'meet-a', 400);
    expect(first.isCareerBestTotal).toBe(true);
    expect(first.bestTotalKgBefore).toBeNull();
    expect(first.bestTotalKgAfter).toBe(400);
    // 400 is the regional gate: an open tier is not "newly qualified" — the
    // lifter could always enter it — so the unlock list is the gated tiers the
    // total newly clears.
    expect(first.newlyQualifiedTiers).toEqual(['regional']);

    const bombed = careerMeetOutcome(fresh, 'meet-b', null);
    expect(bombed.isCareerBestTotal).toBe(false);
    expect(bombed.bestTotalKgAfter).toBeNull();
    expect(bombed.newlyQualifiedTiers).toEqual([]);
  });

  it('unlocks the whole ladder at the top gate, and nothing twice', () => {
    const strong = careerMeetOutcome(newCareerLifter('meridian'), 'meet-c', 650);
    expect(strong.newlyQualifiedTiers).toEqual([
      'regional',
      'nationals',
      'campaign-worlds',
      'competitive-worlds',
    ]);
    const alreadyThere = careerMeetOutcome(
      { federationId: 'meridian', bestTotalKg: 650, enteredMeetIds: ['meet-c'] },
      'meet-d',
      655,
    );
    expect(alreadyThere.isCareerBestTotal).toBe(true);
    expect(alreadyThere.newlyQualifiedTiers).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The calendar read model
// ---------------------------------------------------------------------------

describe('careerCalendarFor', () => {
  it('carries one verdict per upcoming meet, and it is eligibility.ts own answer', () => {
    const lifter = careerLifterFor(runCareer(3, null));
    const view = careerCalendarFor(lifter, comparisonDay());
    const today = asStreakDay(comparisonDay());
    expect(view.today).toBe(today);
    expect(view.lifter).toBe(lifter);
    const scheduled = upcomingMeets(lifter.federationId, today);
    expect(view.entries.map((entry) => entry.meet)).toEqual([...scheduled]);
    for (const entry of view.entries) {
      expect(entry.verdict).toEqual(entryVerdict(lifter, entry.meet, today));
    }
    // Non-vacuity: the year holds meets, and this lifter's verdicts split —
    // some open, some refused — so the comparison sweep above had both kinds
    // to compare.
    expect(view.entries.length).toBe(85);
    expect(view.entries.some((entry) => entry.verdict.kind === 'open')).toBe(true);
    expect(view.entries.some((entry) => entry.verdict.kind === 'refused')).toBe(true);
  });

  it('refuses a day that is not a day index', () => {
    expect(() => careerCalendarFor(newCareerLifter('meridian'), 0.5)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// choose-federation
// ---------------------------------------------------------------------------

const CHOOSE_IRONLINE: ProposalOfKind<'choose-federation'> = {
  kind: 'choose-federation',
  report: { federationId: 'ironline' },
};

describe('applyFederationChoice', () => {
  it('records the choice once: id set, chosen set, revision moved, wire decodable', () => {
    const before = newServerRecord(SIGNUP_DAY);
    expect(before.federation).toEqual({ id: CAREER_TUNING.DEFAULT_FEDERATION_ID, chosen: false });
    const applied = applyFederationChoice(before, CHOOSE_IRONLINE, 'choice-1');
    if (!applied.ok) throw new Error(applied.error.message);
    expect(applied.value.federationId).toBe('ironline');
    expect(applied.value.record.federation).toEqual({ id: 'ironline', chosen: true });
    expect(applied.value.record.revision).toBe(before.revision + 1);
    // The wire is the one shape a client is given, and it decodes through the
    // one door with the choice on it.
    const received = receiveProgressionSnapshot(applied.value.wire);
    if (!received.ok) throw new Error(received.error.message);
    expect(applied.value.wire.federation).toEqual({ id: 'ironline', chosen: true });
    expect(applied.value.wire.acknowledgedProposalId).toBe('choice-1');
  });

  it('touches nothing else on the row — every other fact is the same object', () => {
    const before = newServerRecord(SIGNUP_DAY);
    const applied = applyFederationChoice(before, CHOOSE_IRONLINE, 'choice-2');
    if (!applied.ok) throw new Error(applied.error.message);
    const after = applied.value.record;
    expect(after.totalKg).toBe(before.totalKg);
    expect(after.bestE1rmKg).toBe(before.bestE1rmKg);
    expect(after.streak).toBe(before.streak);
    expect(after.meets).toBe(before.meets);
    expect(after.wallet).toBe(before.wallet);
    expect(after.fatigue).toBe(before.fatigue);
  });

  it('refuses an id the game does not hold, before anything moves', () => {
    const applied = applyFederationChoice(
      newServerRecord(SIGNUP_DAY),
      { kind: 'choose-federation', report: { federationId: 'ipf' } },
      'choice-3',
    );
    expect(applied.ok).toBe(false);
    if (applied.ok) throw new Error('unreachable');
    expect(applied.error.code).toBe('UNKNOWN_FEDERATION');
    expect(applied.error.message).toContain('"ipf"');
  });

  it('refuses a second choice — the pick is handed out once [a-federation-is-chosen-once]', () => {
    const first = applyFederationChoice(newServerRecord(SIGNUP_DAY), CHOOSE_IRONLINE, 'choice-4');
    if (!first.ok) throw new Error(first.error.message);
    const second = applyFederationChoice(
      first.value.record,
      { kind: 'choose-federation', report: { federationId: 'grandhall' } },
      'choice-5',
    );
    expect(second.ok).toBe(false);
    if (second.ok) throw new Error('unreachable');
    expect(second.error.code).toBe('FEDERATION_ALREADY_CHOSEN');
    // Even the same id again: the choice is spent, not idempotent — a second
    // proposal is a client defect and the refusal names it.
    const again = applyFederationChoice(first.value.record, CHOOSE_IRONLINE, 'choice-6');
    expect(again.ok).toBe(false);
    if (again.ok) throw new Error('unreachable');
    expect(again.error.code).toBe('FEDERATION_ALREADY_CHOSEN');
  });

  it('refuses moving banked results to another federation, and allows confirming the one they were lifted under', () => {
    // A Sprint 1a lifter can bank a meet under the seeded default before any
    // choosing screen exists. Their results belong to that calendar: a
    // DIFFERENT federation is refused, the SAME one may still be confirmed —
    // so they are not stranded outside the 1b screen forever.
    const withResults = runCareer(1, null);
    expect(withResults.meets.length).toBeGreaterThan(0);
    expect(withResults.federation.chosen).toBe(false);

    const moved = applyFederationChoice(withResults, CHOOSE_IRONLINE, 'choice-7');
    expect(moved.ok).toBe(false);
    if (moved.ok) throw new Error('unreachable');
    expect(moved.error.code).toBe('FEDERATION_LOCKED_BY_RESULTS');

    const confirmed = applyFederationChoice(
      withResults,
      { kind: 'choose-federation', report: { federationId: withResults.federation.id } },
      'choice-8',
    );
    if (!confirmed.ok) throw new Error(confirmed.error.message);
    expect(confirmed.value.record.federation).toEqual({ id: withResults.federation.id, chosen: true });
    // And the career record read off the confirmed row is untouched.
    expect(careerLifterFor(confirmed.value.record)).toEqual(careerLifterFor(withResults));
  });

  it('seals the record a federation choice produces, every nested object included', () => {
    // §7.5's `record` row for this module — the runtime half of the route
    // table's seal claim, in the shape every other row's witness takes.
    const applied = applyFederationChoice(newServerRecord(SIGNUP_DAY), CHOOSE_IRONLINE, 'choice-9');
    if (!applied.ok) throw new Error(applied.error.message);
    const record = applied.value.record;
    expect(Object.isFrozen(record), 'the record itself').toBe(true);
    expect(Object.isFrozen(record.bestE1rmKg), 'bestE1rmKg').toBe(true);
    expect(Object.isFrozen(record.streak), 'streak').toBe(true);
    expect(Object.isFrozen(record.wallet), 'wallet').toBe(true);
    expect(Object.isFrozen(record.meets), 'the meets array').toBe(true);
    expect(Object.isFrozen(record.fatigue), 'fatigue').toBe(true);
    expect(Object.isFrozen(record.federation), 'federation').toBe(true);
    const loose: { id: string } = record.federation;
    expect(() => {
      loose.id = 'grandhall';
    }).toThrow(TypeError);
    expect(record.federation.id, 'the choice did not move').toBe('ironline');
  });
});

// ---------------------------------------------------------------------------
// The client half reads the same fold
// ---------------------------------------------------------------------------

describe('careerClient reads the career out of the cache', () => {
  it('hands back the same lifter the server would derive from the same row', () => {
    const record = runCareer(2, null);
    const cache = cacheFor(record);
    expect(federationFromCache(cache)).toEqual(record.federation);
    expect(careerLifterFromCache(cache)).toEqual(careerLifterFor(record));
    const view = careerCalendarFromCache(cache, comparisonDay());
    expect(view).not.toBeNull();
    expect(view?.entries).toEqual(
      careerCalendarFor(careerLifterFor(record), comparisonDay()).entries,
    );
  });

  it('answers null before the first snapshot, rather than inventing a career', () => {
    expect(federationFromCache(emptyProgressionCache())).toBeNull();
    expect(careerLifterFromCache(emptyProgressionCache())).toBeNull();
    expect(careerCalendarFromCache(emptyProgressionCache(), comparisonDay())).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// One path, as a scan over the shipped tree
// ---------------------------------------------------------------------------

/**
 * Shipped `.ts`/`.tsx` files under `src/` whose CODE (comments and strings
 * blanked) references any of `names`. Test files and declaration files are
 * out: the claim is about what ships, and this very file references every name
 * in the list.
 */
function shippedFilesReferencing(names: readonly string[]): readonly string[] {
  const hits: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name)) continue;
      if (/\.test\.tsx?$/.test(entry.name) || /\.d\.tsx?$/.test(entry.name)) continue;
      const code = stripCommentsAndStrings(readFileSync(full, 'utf8'));
      if (names.some((name) => code.includes(name))) {
        hits.push(path.relative(SRC_ROOT, full).split(path.sep).join('/'));
      }
    }
  };
  walk(SRC_ROOT);
  return [...hits].sort();
}

function stripCommentsAndStrings(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}

describe('the career record has one writer, scanned rather than promised', () => {
  it('only careerServer.ts reaches the career transitions from outside src/career', () => {
    // The one-path claim as a set equality over the shipped tree: the career
    // module's own transitions (`careerRecordAfterMeet`, `newCareerLifter`)
    // are reached from exactly the files below. A screen or a hook that
    // started folding its own career record — the `useMeetDay` defect, one
    // subsystem over — appears in this list and reddens it. The construction
    // side (nobody builds a `ServerRecord` outside the route table) is
    // `progression.test.ts` §7.5's, derived from the type checker; this scan
    // is the career-shaped half it cannot see.
    const referencing = shippedFilesReferencing(['careerRecordAfterMeet', 'newCareerLifter']);
    expect(referencing).toEqual([
      'career/careerSweep.ts',
      'career/eligibility.ts',
      'game/careerServer.ts',
    ]);
  });

  it('the scan sees every spelling it must, driven against plants', () => {
    // Non-vacuity for the matcher, both ways: it sees a bare call and an
    // import, and it does NOT see a mention inside a comment or a string —
    // so prose about the fold cannot satisfy or trip the set above.
    expect(stripCommentsAndStrings("const l = careerRecordAfterMeet(a, 'x', 1);")).toContain(
      'careerRecordAfterMeet',
    );
    expect(
      stripCommentsAndStrings("import { newCareerLifter } from '../career/eligibility';"),
    ).toContain('newCareerLifter');
    expect(stripCommentsAndStrings('// careerRecordAfterMeet in prose')).not.toContain(
      'careerRecordAfterMeet',
    );
    expect(stripCommentsAndStrings("const s = 'careerRecordAfterMeet';")).not.toContain(
      'careerRecordAfterMeet',
    );
  });
});
