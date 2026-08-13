import { describe, expect, it } from 'vitest';

import { REAL_IP_WATCHLIST } from '../licensing/realIp';
import {
  CAREER_COPY,
  CAREER_FEDERATIONS,
  CAREER_TUNING,
  MEET_TIER_ORDER,
  TIER_SCHEDULING,
} from './careerTuning';
import { ENTRY_REFUSAL_REASONS } from './eligibility';

const DAYS_PER_WEEK = 7;

describe('the tier ladder', () => {
  it('is GDD §6.1’s, in its order', () => {
    expect([...MEET_TIER_ORDER]).toEqual(['local', 'regional', 'nationals', 'worlds']);
  });

  it('splits async and sync where GDD §6.6 splits it', () => {
    expect(MEET_TIER_ORDER.map((tier) => TIER_SCHEDULING[tier])).toEqual([
      'async',
      'async',
      'sync',
      'sync',
    ]);
  });

  it('opens on a tier that asks for nothing', () => {
    // GDD §2: a Total is null until the first meet, so a gated entry tier is a
    // career nobody can start. Putting a number on `local` reddens this.
    const [entry] = MEET_TIER_ORDER;
    expect(CAREER_TUNING.QUALIFYING_TOTAL_KG[entry]).toBeNull();
  });

  it('asks for strictly more the higher up it goes', () => {
    const gated: number[] = [];
    for (const tier of MEET_TIER_ORDER) {
      const total = CAREER_TUNING.QUALIFYING_TOTAL_KG[tier];
      if (total !== null) gated.push(total);
    }
    expect(gated).toEqual([400, 550, 650]);
    for (let index = 1; index < gated.length; index += 1) {
      expect(gated[index] as number).toBeGreaterThan(gated[index - 1] as number);
    }
    // Only the entry tier is open. A second open tier would make the ladder a
    // ladder with a hole in it.
    expect(
      MEET_TIER_ORDER.filter((tier) => CAREER_TUNING.QUALIFYING_TOTAL_KG[tier] === null),
    ).toEqual(['local']);
  });
});

describe('the schedule constants', () => {
  it('are whole weeks, so nothing drifts across a leap year', () => {
    for (const tier of MEET_TIER_ORDER) {
      expect(CAREER_TUNING.CADENCE_DAYS[tier] % DAYS_PER_WEEK).toBe(0);
    }
  });

  it('put the four tiers on four different weekdays, which is the no-collision argument', () => {
    // The general form of what `calendar.test.ts` measures over a decade. Every
    // cadence is a whole number of weeks, so a tier's meets all fall on the
    // weekday its phase picks; four phases that differ modulo seven therefore
    // never coincide, at any horizon rather than only at a swept one.
    //
    // These two checks are NOT the same check as the decade census, and the
    // difference is which subject they read: this one reads the tuning
    // constants and would stay green if the generator ignored `PHASE_DAYS`
    // altogether, and the census reads the generator and would stay green if a
    // future tuner accepted collisions. Neither dominates the other.
    const residues = MEET_TIER_ORDER.map((tier) => CAREER_TUNING.PHASE_DAYS[tier] % DAYS_PER_WEEK);
    expect(residues).toEqual([0, 3, 5, 6]);
    expect(new Set(residues).size).toBe(MEET_TIER_ORDER.length);
  });

  it('keep every phase inside its own cadence', () => {
    for (const tier of MEET_TIER_ORDER) {
      expect(CAREER_TUNING.PHASE_DAYS[tier]).toBeGreaterThanOrEqual(0);
      expect(CAREER_TUNING.PHASE_DAYS[tier]).toBeLessThan(CAREER_TUNING.CADENCE_DAYS[tier]);
    }
  });

  it('leave a horizon long enough to show every tier once', () => {
    // A calendar screen that could not show a worlds would make the top of the
    // ladder invisible. Shortening HORIZON_DAYS below the slowest cadence
    // reddens this.
    for (const tier of MEET_TIER_ORDER) {
      expect(CAREER_TUNING.HORIZON_DAYS).toBeGreaterThanOrEqual(CAREER_TUNING.CADENCE_DAYS[tier]);
    }
  });

  it('anchor a real calendar date', () => {
    expect(CAREER_TUNING.SEASON_ANCHOR).toEqual({ year: 2026, month: 1, day: 3 });
  });

  it('are frozen', () => {
    expect(Object.isFrozen(CAREER_TUNING)).toBe(true);
    expect(Object.isFrozen(CAREER_TUNING.QUALIFYING_TOTAL_KG)).toBe(true);
    expect(Object.isFrozen(CAREER_FEDERATIONS)).toBe(true);
  });
});

describe('the federations', () => {
  it('are one per ruleset, covering all four combinations exactly once', () => {
    expect(CAREER_FEDERATIONS).toHaveLength(4);
    const rulesets = CAREER_FEDERATIONS.map(
      (federation) => `${federation.ruleset.equipment}/${federation.ruleset.testing}`,
    ).sort();
    expect(rulesets).toEqual([
      'equipped/tested',
      'equipped/untested',
      'raw/tested',
      'raw/untested',
    ]);
  });

  it('have unique ids and unique names', () => {
    expect(new Set(CAREER_FEDERATIONS.map((federation) => federation.id)).size).toBe(4);
    expect(new Set(CAREER_FEDERATIONS.map((federation) => federation.name)).size).toBe(4);
  });

  it('carry no real federation, brand or athlete name', () => {
    // GDD §12.3, the refusal condition that cannot be patched after release.
    // The list is READ from `realIp.ts` rather than copied, so a name added to
    // the watchlist is checked here without anybody remembering to. The
    // tree-wide scan in realIp.test.ts covers these strings too, through the
    // tuning registry — this is the same question asked where the names are
    // declared, and it survives the registry row being removed.
    expect(REAL_IP_WATCHLIST.length).toBeGreaterThan(50);
    const drawn = [
      ...CAREER_FEDERATIONS.map((federation) => federation.name),
      ...Object.values(CAREER_COPY.TIER_MEET_NAME),
      ...Object.values(CAREER_COPY.TIER_LABEL),
      ...Object.values(CAREER_COPY.ENTRY_REFUSAL),
      CAREER_COPY.NO_QUALIFYING_TOTAL_NEEDED,
    ];
    expect(drawn.length).toBe(17);
    const hits = drawn.flatMap((text) =>
      REAL_IP_WATCHLIST.filter((entry) => text.toLowerCase().includes(entry.name.toLowerCase())).map(
        (entry) => `${entry.name} in "${text}"`,
      ),
    );
    expect(hits).toEqual([]);
  });
});

describe('the copy', () => {
  it('has a label and a meet name for every tier', () => {
    for (const tier of MEET_TIER_ORDER) {
      expect(CAREER_COPY.TIER_LABEL[tier]).toBeTruthy();
      expect(CAREER_COPY.TIER_MEET_NAME[tier]).toBeTruthy();
    }
    expect(new Set(Object.values(CAREER_COPY.TIER_MEET_NAME)).size).toBe(MEET_TIER_ORDER.length);
  });

  it('has a distinct sentence for every refusal', () => {
    // A screen that showed one refusal's sentence under another's verdict would
    // be telling a player something untrue about their own career, so the four
    // are required to be four.
    const sentences = ENTRY_REFUSAL_REASONS.map((reason) => CAREER_COPY.ENTRY_REFUSAL[reason]);
    expect(sentences).toHaveLength(4);
    expect(new Set(sentences).size).toBe(4);
    expect(Object.keys(CAREER_COPY.ENTRY_REFUSAL).sort()).toEqual([...ENTRY_REFUSAL_REASONS].sort());
  });
});
