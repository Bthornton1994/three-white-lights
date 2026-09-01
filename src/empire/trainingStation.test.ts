/**
 * trainingStation.test.ts — GDD §5.18 Stage D.1: equipment is not a station.
 *
 * Geometry of the Competition Bench Bay: completeness, the adjacent second
 * bench, honest refusal when the garage cannot fit it, and the opening
 * layout's free cell at (5,0).
 */

import { describe, expect, it } from 'vitest';

import { EMPIRE_TUNING } from './empireTuning';
import { createFloorState, type FloorState } from './floor';
import {
  COMPETITION_BENCH_BAY,
  COMPETITION_BENCH_BAY_PRIMARY,
  COMPETITION_BENCH_BAY_REQUIRED,
  TRAINING_STATION_KINDS,
  bayOccupiedCells,
  capacityRealizesOn,
  competitionBenchBay,
  isCompetitionBenchBayComponent,
  overlapsBayExpansion,
} from './trainingStation';

const OWNED = Object.freeze([...EMPIRE_TUNING.LADDER_STARTING_EQUIPMENT]);

describe('trainingStation.ts — Competition Bench Bay', () => {
  it('the Stage D.1 slice is exactly one functional station, matching the tuning table', () => {
    expect([...TRAINING_STATION_KINDS]).toEqual(['competition-bench-bay']);
    expect([...EMPIRE_TUNING.STATION_UPGRADE_SLICE]).toEqual([...TRAINING_STATION_KINDS]);
    expect([...COMPETITION_BENCH_BAY_REQUIRED]).toEqual([...EMPIRE_TUNING.LADDER_STARTING_EQUIPMENT]);
    expect(COMPETITION_BENCH_BAY_PRIMARY).toBe('flat-bench');
    expect(isCompetitionBenchBayComponent('flat-bench')).toBe(true);
    expect(isCompetitionBenchBayComponent('power-bar')).toBe(true);
    expect(isCompetitionBenchBayComponent('comp-plates')).toBe(true);
    expect(isCompetitionBenchBayComponent('squat-rack')).toBe(false);
    expect(isCompetitionBenchBayComponent('mats')).toBe(false);
  });

  it('the opening garage assembles one complete bay occupying the primary 2×4', () => {
    const bay = competitionBenchBay(createFloorState('garage'), OWNED, 0);
    expect(bay.kind).toBe(COMPETITION_BENCH_BAY);
    expect(bay.complete).toBe(true);
    expect(bay.missing).toEqual([]);
    expect(bay.primary).toEqual({
      position: { x: 3, y: 0 },
      footprint: { width: 2, height: 4 },
      source: 'primary',
    });
    expect(bay.benches).toHaveLength(1);
    expect(bay.expansion).toBeNull();
    expect(bayOccupiedCells(bay)).toBe(8);
  });

  it('Capacity on the opening garage realises a second bench at (5,0), not a second approach cell', () => {
    const bay = competitionBenchBay(createFloorState('garage'), OWNED, 1);
    expect(bay.complete).toBe(true);
    expect(bay.benches).toHaveLength(2);
    expect(bay.expansion).toEqual({
      position: { x: 5, y: 0 },
      footprint: { width: 2, height: 4 },
      source: 'expansion',
    });
    expect(bayOccupiedCells(bay)).toBe(16);
  });

  it('an unplaced required piece makes the bay incomplete and unusable', () => {
    const opening = createFloorState('garage');
    const incomplete: FloorState = Object.freeze({
      ...opening,
      furniture: Object.freeze({
        'flat-bench': opening.furniture['flat-bench'],
        'power-bar': opening.furniture['power-bar'],
      }),
    });
    const bay = competitionBenchBay(incomplete, OWNED, 1);
    expect(bay.complete).toBe(false);
    expect(bay.missing).toEqual(['comp-plates']);
    expect(bay.benches).toEqual([]);
    expect(bay.expansion).toBeNull();
    expect(bay.primary).not.toBeNull();
    expect(bayOccupiedCells(bay)).toBe(0);
  });

  it('a boxed primary has no adjacent 2×4, so Capacity cannot realise a second bench', () => {
    const opening = createFloorState('garage');
    const boxed: FloorState = Object.freeze({
      ...opening,
      furniture: Object.freeze({
        'flat-bench': Object.freeze({ x: 6, y: 2 }),
        'power-bar': Object.freeze({ x: 5, y: 2 }),
        'comp-plates': Object.freeze({ x: 6, y: 0 }),
      }),
    });
    const stock = competitionBenchBay(boxed, OWNED, 0);
    expect(stock.complete).toBe(true);
    expect(stock.benches).toHaveLength(1);
    const capacity = competitionBenchBay(boxed, OWNED, 1);
    expect(capacity.complete).toBe(true);
    expect(capacity.expansion).toBeNull();
    expect(capacity.benches).toHaveLength(1);
    expect(bayOccupiedCells(capacity)).toBe(8);
    expect(capacityRealizesOn(boxed, OWNED)).toBe(false);
    expect(capacityRealizesOn(opening, OWNED)).toBe(true);
  });

  it('overlapsBayExpansion is true only for the realised second bench', () => {
    const stock = competitionBenchBay(createFloorState('garage'), OWNED, 0);
    expect(overlapsBayExpansion({ x: 5, y: 0 }, { width: 2, height: 4 }, stock)).toBe(false);
    const capacity = competitionBenchBay(createFloorState('garage'), OWNED, 1);
    expect(overlapsBayExpansion({ x: 5, y: 0 }, { width: 2, height: 4 }, capacity)).toBe(true);
    expect(overlapsBayExpansion({ x: 0, y: 4 }, { width: 1, height: 1 }, capacity)).toBe(false);
  });
});
