/**
 * currencyProvenance.test.ts — the tests for the provenance vocabulary, and for
 * the one claim in this repository that vitest cannot grade.
 *
 * ===========================================================================
 * WHAT IS GRADED BY WHAT, BECAUSE HALF OF THIS FILE IS NOT A RUNTIME TEST
 * ===========================================================================
 *
 * The human's bar on this piece is that training-funded currency be
 * STRUCTURALLY unable to reach the Extra Covered Day purchase — not merely
 * observed not to reach it at the horizons somebody happened to sweep. A sweep
 * that comes back clean is necessary and not sufficient: that is exactly the
 * evidence that hid this defect twice.
 *
 * So the load-bearing assertion here is a `@ts-expect-error`, and it is graded
 * by `npx tsc --noEmit` rather than by vitest — vitest strips types without
 * checking them, so under vitest alone those lines are comments. If
 * `SettledCoveredDayPurchase.tender` ever widens to accept a training-gated
 * tender, `tsc` reports TS2578 "Unused '@ts-expect-error' directive" and the
 * build fails. That is the compiler's verdict, not a claim about it.
 *
 * TO CHECK THE DIRECTIVES STILL BITE (a type-level test that has gone vacuous
 * looks exactly like one that passes): in `currencyProvenance.ts` change
 * `ARRIVAL_GATING['session-count']` to `'non-training-gated'`. `tsc --noEmit`
 * must then report TS2578 on both directives below, and `vitest run` must fail
 * this file's gating tests and `streakEntitlement.test.ts`'s negative control.
 * Both were run.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  ARRIVAL_GATING,
  COVERED_DAY_TENDERS,
  CURRENCY_GATINGS,
  NON_TRAINING_GATED_TENDERS,
  TENDER_ARRIVAL,
  TENDER_ARRIVALS,
  TENDER_CURRENCIES,
  TENDER_CURRENCY,
  TENDER_GATING_IS_A_PARTITION,
  TRAINING_GATED_TENDERS,
  isCoveredDayTender,
  isNonTrainingGatedTender,
  tenderGating,
  type CoveredDayTender,
} from './currencyProvenance';
import type { SettledCoveredDayPurchase } from './streak';

// ---------------------------------------------------------------------------
// THE STRUCTURAL HALF — graded by `tsc --noEmit`, not by vitest
// ---------------------------------------------------------------------------

describe('a training-funded tender does not typecheck into a covered-day purchase', () => {
  it('accepts every non-training-gated tender, spelled out', () => {
    // THE POSITIVE CONTROL FOR THE DIRECTIVES BELOW. If `tender` were typed
    // `never` — which would also make the `@ts-expect-error`s pass — these
    // lines would not compile either. They do, so the type is a real subset
    // rather than an empty one.
    const legal: readonly SettledCoveredDayPurchase[] = [
      { orderId: 'a', coveredDays: 1, tender: 'real-money' },
      { orderId: 'b', coveredDays: 1, tender: 'chalk-purchased' },
      { orderId: 'c', coveredDays: 1, tender: 'chalk-rewarded-ad' },
      { orderId: 'd', coveredDays: 1, tender: 'chalk-calendar-event' },
      { orderId: 'e', coveredDays: 1, tender: 'chalk-season-pass-week' },
    ];
    // AND THE LIST IS THE WHOLE LIST. Spelled out above so a reader sees the
    // legal surface; cross-checked here so it cannot go stale when a tender is
    // added.
    expect(legal.map((purchase) => purchase.tender).sort()).toEqual([...NON_TRAINING_GATED_TENDERS].sort());
  });

  it('refuses achievement Chalk at compile time — GDD §8.2, the direct path', () => {
    const achievementFunded: SettledCoveredDayPurchase = {
      orderId: 'f',
      coveredDays: 1,
      // @ts-expect-error — 'chalk-achievement' is training-gated; it is real
      // money for cosmetics and not a tender for coverage. GDD §8.2, §8.3E.
      tender: 'chalk-achievement',
    };
    // The runtime refuses it as well; `streak.test.ts` drives that. Here the
    // value only has to exist so the object above is not dead code.
    expect(achievementFunded.orderId).toBe('f');
  });

  it('refuses season-pass-tier Chalk at compile time — GDD §8.3C, the loophole one hop out', () => {
    // THE SECOND PATH, AND IT IS CLOSED BY THE SAME EDIT RATHER THAN BY A
    // SECOND CHECK. `'chalk-achievement'` and `'chalk-season-pass-tier'` both
    // declare the `'session-count'` arrival, so they are one row in
    // `ARRIVAL_GATING`. There is no configuration in which one compiles and the
    // other does not — which is the property the previous fix did not have.
    const tierFunded: SettledCoveredDayPurchase = {
      orderId: 'g',
      coveredDays: 1,
      // @ts-expect-error — a tier unlocks by playing, so a tier's Chalk is
      // training-gated. A tier every N sessions is an achievement every N
      // sessions.
      tender: 'chalk-season-pass-tier',
    };
    expect(tierFunded.orderId).toBe('g');
  });

  it('and the two banned tenders are one row, not two — so closing one closed both', () => {
    // The runtime shadow of the paragraph above, and the assertion that would
    // go red if somebody replaced the derived types with two hand-written
    // lists: every tender on an arrival has that arrival's gating, with no
    // per-tender exceptions anywhere.
    for (const tender of COVERED_DAY_TENDERS) {
      expect(tenderGating(tender)).toBe(ARRIVAL_GATING[TENDER_ARRIVAL[tender]]);
    }
    const bySessionCount = COVERED_DAY_TENDERS.filter(
      (tender) => TENDER_ARRIVAL[tender] === 'session-count',
    );
    // NOT VACUOUS: there really are two of them, so "closing one closes both"
    // is about two things.
    expect(bySessionCount.length).toBeGreaterThanOrEqual(2);
    expect(bySessionCount).toContain('chalk-achievement');
    expect(bySessionCount).toContain('chalk-season-pass-tier');
    expect([...TRAINING_GATED_TENDERS].sort()).toEqual([...bySessionCount].sort());
  });
});

// ---------------------------------------------------------------------------
// The tables
// ---------------------------------------------------------------------------

describe('the provenance tables are exhaustive and cannot disagree with each other', () => {
  it('every tender declares a currency and an arrival', () => {
    expect(Object.keys(TENDER_CURRENCY).sort()).toEqual([...COVERED_DAY_TENDERS].sort());
    expect(Object.keys(TENDER_ARRIVAL).sort()).toEqual([...COVERED_DAY_TENDERS].sort());
    for (const tender of COVERED_DAY_TENDERS) {
      expect(TENDER_CURRENCIES).toContain(TENDER_CURRENCY[tender]);
      expect(TENDER_ARRIVALS).toContain(TENDER_ARRIVAL[tender]);
    }
  });

  it('every arrival declares a gating, and every gating is one of the two', () => {
    expect(Object.keys(ARRIVAL_GATING).sort()).toEqual([...TENDER_ARRIVALS].sort());
    for (const arrival of TENDER_ARRIVALS) {
      expect(CURRENCY_GATINGS).toContain(ARRIVAL_GATING[arrival]);
    }
    expect(TENDER_GATING_IS_A_PARTITION).toBe(true);
  });

  it('the two halves partition the tenders, and NEITHER half is empty', () => {
    // THE ANTI-VACUITY THAT MATTERS MOST HERE. A restriction whose banned side
    // is empty restricts nothing and passes every other test in this file; a
    // restriction whose allowed side is empty is the too-broad fix a human
    // already rejected. Both are failures, and both are failures of the same
    // shape as the ones this piece has already shipped twice.
    expect(TRAINING_GATED_TENDERS.length, 'nothing is banned, so nothing is enforced').toBeGreaterThan(0);
    expect(NON_TRAINING_GATED_TENDERS.length, 'nothing may buy, so the product is gone').toBeGreaterThan(0);
    expect([...NON_TRAINING_GATED_TENDERS, ...TRAINING_GATED_TENDERS].sort()).toEqual(
      [...COVERED_DAY_TENDERS].sort(),
    );
    for (const tender of NON_TRAINING_GATED_TENDERS) {
      expect(TRAINING_GATED_TENDERS).not.toContain(tender);
    }
  });

  it('THE RESTRICTION IS SCOPED TO THE MECHANISM AND NOT TO THE CURRENCY', () => {
    // THE RULING THIS ROUND EXISTS TO IMPLEMENT. The previous fix deleted the
    // achievement row from GDD §8.2's Chalk table, banning Chalk from being
    // earned by training at all, and a human rejected that as too broad.
    //
    // What this asserts is the shape of the narrower fix: Chalk is on BOTH
    // sides of the line. Achievement Chalk exists, is Chalk, and is refused for
    // this one purchase — while other Chalk buys it perfectly well. If somebody
    // re-applies the broad fix by deleting the training-gated Chalk tenders,
    // this test says so.
    const chalkTenders = COVERED_DAY_TENDERS.filter((tender) => TENDER_CURRENCY[tender] === 'chalk');
    const bannedChalk = chalkTenders.filter((tender) => tenderGating(tender) === 'training-gated');
    const allowedChalk = chalkTenders.filter((tender) => tenderGating(tender) === 'non-training-gated');
    expect(bannedChalk.length, 'training-earned Chalk must still EXIST — it just cannot buy this').toBeGreaterThan(0);
    expect(allowedChalk.length, 'Chalk must still be able to buy a covered day').toBeGreaterThan(0);
    // And the ban is not really a ban on a currency wearing a provenance
    // costume: the two sides share a denomination.
    for (const tender of [...bannedChalk, ...allowedChalk]) {
      expect(TENDER_CURRENCY[tender]).toBe('chalk');
    }
  });

  it('names are not what decides it — the arrival is', () => {
    // A FLOOR UNDER THE TABLE, and stated as a floor. A tender called
    // `'chalk-q7'` paid out every ten sessions satisfies this, and the thing
    // that catches THAT is having to write `'session-count'` next to it. What
    // this catches is the copy-paste error: adding `'chalk-milestone'` and
    // leaving the arrival on `'calendar'` because the line above said so.
    for (const tender of COVERED_DAY_TENDERS) {
      if (/streak|session|milestone|achiev|tier|progress|earn/i.test(tender)) {
        expect(TENDER_ARRIVAL[tender], `${tender} names something training reaches`).toBe('session-count');
        expect(tenderGating(tender)).toBe('training-gated');
      }
    }
    // AND THE SCAN IS NOT MATCHING NOTHING: some tender really does trip it.
    expect(
      COVERED_DAY_TENDERS.some((tender) => /achiev|tier/i.test(tender)),
      'no tender name trips the scan, so the loop above proves nothing',
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The runtime guard — the second line, for callers the compiler never sees
// ---------------------------------------------------------------------------

describe('the runtime predicates refuse what the type refuses', () => {
  it('agrees with the tables on every tender', () => {
    for (const tender of COVERED_DAY_TENDERS) {
      expect(isCoveredDayTender(tender)).toBe(true);
      expect(isNonTrainingGatedTender(tender)).toBe(tenderGating(tender) === 'non-training-gated');
    }
  });

  it('refuses wire garbage, including the tender this codebase used to ship', () => {
    // `'chalk'` IS IN THIS LIST DELIBERATELY. It was the shipped tender one
    // commit ago, and it is now nothing at all — because "Chalk" was never an
    // answer to "where did this money come from", and treating it as one is the
    // defect. An old client's payload gets refused rather than absorbed.
    const garbage: readonly unknown[] = [
      'chalk',
      'milestone',
      'achievement',
      '',
      null,
      undefined,
      42,
      { tender: 'chalk-purchased' },
      ['chalk-purchased'],
      'CHALK-PURCHASED',
    ];
    for (const value of garbage) {
      expect(isCoveredDayTender(value), `${String(value)} is not a tender`).toBe(false);
      expect(isNonTrainingGatedTender(value), `${String(value)} cannot fund a covered day`).toBe(false);
    }
  });

  it('is derived from the tables rather than re-listed, so it cannot drift from them', () => {
    // The value lists and the predicate are the same rule. Re-deriving both
    // here from `tenderGating` would be circular, so what is checked is that
    // the two published lists agree with the published predicate.
    for (const tender of NON_TRAINING_GATED_TENDERS) expect(isNonTrainingGatedTender(tender)).toBe(true);
    for (const tender of TRAINING_GATED_TENDERS) expect(isNonTrainingGatedTender(tender)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Purity — the module's own source is the artifact under test
// ---------------------------------------------------------------------------

describe('purity contract', () => {
  const source = readFileSync(fileURLToPath(new URL('./currencyProvenance.ts', import.meta.url)), 'utf8');
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('strips comments without destroying the code (sanity check for the scans below)', () => {
    expect(code).toContain('export const COVERED_DAY_TENDERS');
    expect(code).toContain('export function isNonTrainingGatedTender');
  });

  it('imports nothing at all — it is a leaf, and that is why two modules can share it', () => {
    // `streak.ts` and `streakSweep.ts` both read this vocabulary. If it
    // imported either of them the sweep would be measuring a cycle, and if it
    // imported anything at all `streak.test.ts`'s pure-sibling allowlist would
    // have to reason about what that import reaches. It imports nothing.
    expect(code).not.toMatch(/^\s*import\b/m);
    expect(code).not.toMatch(/\brequire\s*\(/);
  });

  it('reads no clock, rolls no dice and touches no host API', () => {
    for (const banned of [
      /\bDate\b/,
      /\bperformance\s*\./,
      /Math\s*\.\s*random/,
      /\bfetch\s*\(/,
      /\bprocess\b/,
      /\bwindow\b/,
      /\bdocument\b/,
      /\blocalStorage\b/,
    ]) {
      expect(code, `currencyProvenance.ts must not reach ${String(banned)}`).not.toMatch(banned);
    }
  });

  it('holds no numbers — this file is vocabulary, and a price here would be a mechanic', () => {
    // GDD §8.3E: the streak modules price nothing. Neither does this one. A
    // constant here would be a game-feel value outside every registered tuning
    // home, which `src/tuning/audit.ts` would report — this says it earlier and
    // with a reason attached.
    const withoutStrings = code.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""');
    expect(withoutStrings).not.toMatch(/\b\d+(\.\d+)?\b/);
  });

  it('every exported tender is a plain JSON string, because a settled order is JSON', () => {
    for (const tender of COVERED_DAY_TENDERS) {
      expect(typeof tender).toBe('string');
      expect(JSON.parse(JSON.stringify(tender)) as string).toBe(tender);
    }
    // And nothing in the list is a duplicate, which a hand-maintained list of
    // seven strings is exactly long enough to grow.
    expect(new Set<CoveredDayTender>(COVERED_DAY_TENDERS).size).toBe(COVERED_DAY_TENDERS.length);
  });
});
