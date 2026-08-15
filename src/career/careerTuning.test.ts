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
  it('is GDD §6.1’s, with §6.6’s summit split in two, in its order', () => {
    expect([...MEET_TIER_ORDER]).toEqual([
      'local',
      'regional',
      'nationals',
      'campaign-worlds',
      'competitive-worlds',
    ]);
  });

  it('splits async and sync where GDD §6.6 splits it, which is not one cut', () => {
    // BOTH 2026-08-14 RULINGS ARE IN THIS ROW, and neither alone produces it.
    // The first moved regional across — "the boundary is now drawn between the
    // entry tier and every tier above it" — so local is the only async rung of
    // the original four. The second put an async tier back at the TOP, because
    // a campaign summit that waits on other players being awake is not a
    // campaign summit. So the modes do not partition the ladder into a low half
    // and a high half, and a reader who assumes they do gets this row wrong.
    //
    // The previous version of this check pinned regional as `async`, which had
    // been true and had been overruled. It is the pin, not the map, that let
    // that survive: a test asserting a stale value is how a stale value stops
    // looking stale.
    expect(MEET_TIER_ORDER.map((tier) => TIER_SCHEDULING[tier])).toEqual([
      'async',
      'sync',
      'sync',
      'async',
      'sync',
    ]);
    // GDD §6.6's table, read the other way: exactly two async tiers, and they
    // are the entry tier and the campaign summit.
    expect(MEET_TIER_ORDER.filter((tier) => TIER_SCHEDULING[tier] === 'async')).toEqual([
      'local',
      'campaign-worlds',
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
    expect(gated).toEqual([400, 550, 600, 650]);
    for (let index = 1; index < gated.length; index += 1) {
      expect(gated[index] as number).toBeGreaterThan(gated[index - 1] as number);
    }
    // Only the entry tier is open. A second open tier would make the ladder a
    // ladder with a hole in it.
    expect(
      MEET_TIER_ORDER.filter((tier) => CAREER_TUNING.QUALIFYING_TOTAL_KG[tier] === null),
    ).toEqual(['local']);
  });

  it('puts the campaign summit strictly between nationals and the competitive one', () => {
    // GDD §6.6's Q1 ruling, as the two inequalities it actually states:
    // separate qualifying totals, campaign lower. The `toEqual` above pins the
    // literals; this pins the RELATION, so it stays the check even if a tuner
    // moves all four numbers at once.
    const nationals = CAREER_TUNING.QUALIFYING_TOTAL_KG.nationals as number;
    const campaign = CAREER_TUNING.QUALIFYING_TOTAL_KG['campaign-worlds'] as number;
    const competitive = CAREER_TUNING.QUALIFYING_TOTAL_KG['competitive-worlds'] as number;
    expect(campaign).toBeGreaterThan(nationals);
    expect(campaign).toBeLessThan(competitive);
    // Competitive worlds keeps the researched number and this piece did not
    // move it. `docs/research/qualifying-totals.md` derives 650 as P75 of the
    // real nationals field, and §6.6's Q1 ruling assigns that figure to this
    // tier by name.
    expect(competitive).toBe(650);
  });

  it('sets the campaign gate by the rule its block states, not by a literal', () => {
    // WHY THIS IS A RULE AND NOT A PIN. The campaign sweep measured candidates
    // across the admissible band and reachability barely moved — 575, 600 and
    // 625 reach a summit inside the first year on 192, 192 and 184 of 192 arcs,
    // re-taken after the totals generator was bounded and previously 178, 176
    // and 175. A measurement that cannot discriminate cannot choose, so the
    // number is the MIDPOINT of its two neighbours and the block says so. The
    // gate did not move when the fixture under it did, which is the thing a
    // stated rule buys over a measured one.
    //
    // What this reddens on is the thing that makes 600 arbitrary: a tuner
    // moving nationals' 550 or competitive's 650 and leaving this alone. A pin
    // at `600` would stay green through exactly that edit.
    const nationals = CAREER_TUNING.QUALIFYING_TOTAL_KG.nationals as number;
    const competitive = CAREER_TUNING.QUALIFYING_TOTAL_KG['competitive-worlds'] as number;
    expect(CAREER_TUNING.QUALIFYING_TOTAL_KG['campaign-worlds']).toBe((nationals + competitive) / 2);
    // And it lands on the competition grid, because a qualifying total a bar
    // cannot be loaded to is a qualifying total nobody can make exactly.
    expect(((CAREER_TUNING.QUALIFYING_TOTAL_KG['campaign-worlds'] as number) * 10) % 25).toBe(0);
  });
});

describe('the schedule constants', () => {
  it('are whole weeks, so nothing drifts across a leap year', () => {
    for (const tier of MEET_TIER_ORDER) {
      expect(CAREER_TUNING.CADENCE_DAYS[tier] % DAYS_PER_WEEK).toBe(0);
    }
  });

  it('put the five tiers on five different weekdays, which is the no-collision argument', () => {
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
    expect(residues).toEqual([0, 3, 5, 2, 6]);
    expect(new Set(residues).size).toBe(MEET_TIER_ORDER.length);
    // AND HOW MUCH ROOM IS LEFT, which is the thing a sixth tier runs out of.
    // There are seven weekdays and five are now taken, so the no-collision
    // argument survives one more tier and no more. Pinned so the wall is a red
    // rather than a discovery, and pinned as the arithmetic rather than as `2`
    // so it follows the ladder's length.
    expect(DAYS_PER_WEEK - MEET_TIER_ORDER.length).toBe(2);
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
    expect(drawn.length).toBe(19);
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
