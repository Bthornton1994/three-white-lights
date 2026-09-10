/**
 * athletePlatesList.test.ts — pure List adapter grammar and normalize rule.
 *
 * The stages write logical `plates/<i>/on|size` through indexed List access.
 * These checks pin the parse and the exactly-8 normalize behaviour without
 * loading a Rive runtime.
 */
import { describe, expect, it } from 'vitest';

import {
  ATHLETE_PLATE_SLOT,
  ATHLETE_PLATES_LIST,
  normalizePlatesListLength,
  parsePlatePath,
  platesListItemAt,
  type PlatesListLike,
} from './athletePlatesList';
import { ATHLETE_RIG } from './spriteTuning';

function fakeList(initial: unknown[]): PlatesListLike {
  const items = [...initial];
  return {
    get length() {
      return items.length;
    },
    instanceAt(index: number) {
      return items[index];
    },
    removeInstanceAt(index: number) {
      items.splice(index, 1);
    },
    addInstance(instance: unknown) {
      items.push(instance);
    },
  };
}

describe('parsePlatePath', () => {
  it('maps the sixteen logical plate paths and rejects everything else', () => {
    for (let i = 0; i < ATHLETE_RIG.PLATE_SLOTS_PER_SIDE; i += 1) {
      expect(parsePlatePath(`plates/${i}/on`)).toEqual({ index: i, field: 'on' });
      expect(parsePlatePath(`plates/${i}/size`)).toEqual({ index: i, field: 'size' });
    }
    expect(parsePlatePath('barHeight')).toBeNull();
    expect(parsePlatePath('plates')).toBeNull();
    expect(parsePlatePath('plates/on')).toBeNull();
    expect(parsePlatePath(`plates/${ATHLETE_RIG.PLATE_SLOTS_PER_SIDE}/on`)).toBeNull();
    expect(parsePlatePath('plates/0/enabled')).toBeNull();
    expect(ATHLETE_PLATES_LIST).toBe('plates');
    expect(ATHLETE_PLATE_SLOT).toBe('PlateSlot');
  });
});

describe('normalizePlatesListLength', () => {
  it('reports missing lists', () => {
    expect(normalizePlatesListLength(null, 8, () => ({}))).toEqual({
      ok: false,
      length: 0,
      reason: 'plates list missing',
    });
  });

  it('trims an oversized list to exactly eight', () => {
    const list = fakeList(Array.from({ length: 24 }, (_, i) => ({ id: i })));
    const result = normalizePlatesListLength(list, ATHLETE_RIG.PLATE_SLOTS_PER_SIDE, () => {
      throw new Error('should not add');
    });
    expect(result).toEqual({ ok: true, length: 8 });
    expect(list.length).toBe(8);
    expect(platesListItemAt(list, 0)).toEqual({ id: 0 });
    expect(platesListItemAt(list, 7)).toEqual({ id: 7 });
  });

  it('extends a short list with fresh slots', () => {
    const list = fakeList([{ id: 'a' }, { id: 'b' }]);
    let n = 0;
    const result = normalizePlatesListLength(list, ATHLETE_RIG.PLATE_SLOTS_PER_SIDE, () => {
      n += 1;
      return { id: `new-${n}` };
    });
    expect(result).toEqual({ ok: true, length: 8 });
    expect(n).toBe(6);
    expect(platesListItemAt(list, 7)).toEqual({ id: 'new-6' });
  });

  it('stops when the factory cannot supply a missing slot', () => {
    const list = fakeList([{ id: 0 }]);
    const result = normalizePlatesListLength(list, 3, () => null);
    expect(result.ok).toBe(false);
    expect(result.length).toBe(1);
    expect(result.reason).toContain('PlateSlot factory');
  });

  it('resolves native getInstanceAt the same way as web instanceAt', () => {
    const native: PlatesListLike = {
      length: 1,
      getInstanceAt: () => ({ platform: 'native' }),
      removeInstanceAt() {},
      addInstance() {},
    };
    expect(platesListItemAt(native, 0)).toEqual({ platform: 'native' });
  });
});
