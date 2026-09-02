/**
 * d2Consequence.test.ts — Stage D2.2 consequence-boundary source trace.
 *
 * D2-CONSEQUENCE-01 is a fact about composition, not a price. This file
 * traces the played-floor quantities a human can see (completions, queue,
 * wait, changeover, training experience, utilization) into Gym Bucks, dues,
 * satisfaction, and reputation — or records that no such consumer exists.
 *
 * It does not start reputation, persistent NPCs, or Portfolio. It does not
 * retune Q / C / T.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { tsFilesUnder } from './directoryWalk.test';
import { EMPIRE_TUNING } from './empireTuning';
import { accrueLadderGymBucks, ladderIncomeRatePerHour } from './ladder';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const T = EMPIRE_TUNING;

function shippedSource(name: string): string {
  return readFileSync(path.join(HERE, name), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(
    /\/\/.*$/gm,
    '',
  );
}

function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/** The sentence D2.2 records. Kept here so a rewrite without a matching GDD edit is red. */
const D2_CONSEQUENCE_01 =
  'Quality / Capacity / Throughput have truthful physical mechanisms, but the current played floor does not yet convert service quality into a durable member/business outcome.';

describe('D2-CONSEQUENCE-01 — played floor does not fund the institution', () => {
  it('records the boundary sentence', () => {
    expect(D2_CONSEQUENCE_01).toContain('does not yet convert service quality');
    const gdd = readFileSync(path.join(HERE, '..', '..', 'docs', 'GDD.md'), 'utf8');
    expect(gdd.includes(D2_CONSEQUENCE_01)).toBe(true);
    expect(gdd.includes('D2-CONSEQUENCE-01')).toBe(true);
    expect(gdd.includes('D2 — PARTIAL BY DESIGN / CONSEQUENCE BOUNDARY REACHED')).toBe(true);
    expect(gdd.includes('D2-OPENING-01')).toBe(true);
    expect(gdd).toMatch(/D2-OPENING-01[\s\S]{0,400}PARTIAL \/ DOWNSTREAM-DEPENDENT/);
  });

  it('keeps Q/C/T prices, changeover ticks, garage rate, and offline fraction frozen', () => {
    expect(T.STATION_UPGRADE_COST_GYM_BUCKS.quality).toBe(120);
    expect(T.STATION_UPGRADE_COST_GYM_BUCKS.capacity).toBe(180);
    expect(T.STATION_UPGRADE_COST_GYM_BUCKS.throughput).toBe(30);
    expect(T.FLOOR_SIM_STATION_CHANGEOVER_TICKS).toBe(18);
    expect(T.STATION_THROUGHPUT_CHANGEOVER_TICKS).toBe(6);
    expect(T.STATION_QUALITY_AFFINITY_BONUS).toBe(0.25);
    expect(T.LADDER_INCOME_GYM_BUCKS_PER_HOUR.garage).toBe(60);
    expect(T.OFFLINE_EARNINGS_FRACTION).toBe(0.5);
  });

  it('pays Gym Bucks from the ladder rung rate and elapsed mode, not the floor sim', () => {
    const ladder = shippedSource('ladder.ts');
    const sessions = shippedSource('sessions.ts');
    const management = shippedSource('management.ts');
    const production = shippedSource('production.ts');
    const floorSim = shippedSource('floorSim.ts');
    const floorGrid = shippedSource('FloorGrid.tsx');

    expect(ladder).toMatch(/ladderIncomeRatePerHour\(state\.rung\)/);
    expect(ladder).toMatch(/accrueLadderGymBucks\(/);
    expect(management).toMatch(/from '\.\/sessions'/);
    expect(management.includes("from './members'")).toBe(false);
    expect(management.includes("from './floorSim'")).toBe(false);
    expect(sessions.includes("from './floorSim'")).toBe(false);
    expect(sessions.includes("from './members'")).toBe(false);
    expect(production.includes("from './floorSim'")).toBe(false);
    expect(floorSim.includes('ladderIncomeRatePerHour')).toBe(false);
    expect(floorSim.includes('accrueLadderGymBucks')).toBe(false);
    expect(floorGrid.includes('ladderIncomeRatePerHour')).toBe(false);
    expect(floorGrid.includes('accrueLadderGymBucks')).toBe(false);

    const floorWords = /changeovers|queueCount|waitDuration|completions|utilization|memberSatisfaction|memberDues|reputationFromMembers/;
    expect(floorWords.test(ladder)).toBe(false);
    expect(floorWords.test(production)).toBe(false);

    const hour = T.SECONDS_PER_HOUR;
    const rate = ladderIncomeRatePerHour('garage');
    const watched = accrueLadderGymBucks(rate, hour, undefined, 'online');
    const away = accrueLadderGymBucks(rate, hour, undefined, 'offline');
    expect(watched.gymBucks).toBeCloseTo(rate, 5);
    expect(away.gymBucks).toBeCloseTo(rate * T.OFFLINE_EARNINGS_FRACTION, 5);
  });

  it('finds member dues, satisfaction, and reputation as pure functions with no live-floor consumer', () => {
    const members = shippedSource('members.ts');
    expect(members).toMatch(/export function memberDuesGymBucks/);
    expect(members).toMatch(/export function memberSatisfaction/);
    expect(members).toMatch(/export function reputationFromMembers/);

    const root = HERE;
    const shipped = tsFilesUnder(root, 'without-tests');
    const callers: string[] = [];
    for (const name of shipped) {
      if (name === 'members.ts') continue;
      const code = codeOnly(readFileSync(path.join(root, name), 'utf8'));
      if (
        code.includes('memberSatisfaction(') ||
        code.includes('memberDuesGymBucks(') ||
        code.includes('reputationFromMembers(')
      ) {
        callers.push(name);
      }
    }
    expect(callers).toEqual([]);
  });

  it('does not let floor wait, completions, or changeover history write Gym Bucks', () => {
    const floorSim = shippedSource('floorSim.ts');
    const floorGrid = shippedSource('FloorGrid.tsx');
    expect(floorSim).toMatch(/changeovers/);
    expect(floorGrid).toMatch(/sim\.changeovers/);
    expect(floorSim.includes('gymBucks')).toBe(false);
    expect(floorGrid.includes('gymBucks +')).toBe(false);
    expect(floorGrid.includes('gymBucks:')).toBe(false);
  });
});
