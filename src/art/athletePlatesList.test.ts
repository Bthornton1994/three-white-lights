/**
 * athletePlatesList.test.ts — pure List adapter grammar, normalize, and
 * fail-closed independent writes through `applyAthletePlatesList`.
 *
 * Runtime behaviour against the shipped `.riv` lives in
 * `athletePlatesRuntime.test.ts`.
 */
import { describe, expect, it } from 'vitest';

import {
  ATHLETE_PLATE_SLOT,
  ATHLETE_PLATES_LIST,
  applyAthletePlatesList,
  normalizePlatesListLength,
  parsePlatePath,
  plateLogicalPaths,
  platesListItemAt,
  type PlateSlotAccess,
  type PlateSlotValues,
  type PlatesListLike,
} from './athletePlatesList';
import { ATHLETE_RIG } from './spriteTuning';

type FakeSlot = {
  viewModelName: string;
  on: boolean;
  size: number;
  onWritable: boolean;
  sizeWritable: boolean;
};

function fakeList(initial: FakeSlot[]): PlatesListLike & { items: FakeSlot[] } {
  const items = [...initial];
  return {
    items,
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
      items.push(instance as FakeSlot);
    },
  };
}

function slot(partial: Partial<FakeSlot> = {}): FakeSlot {
  return {
    viewModelName: ATHLETE_PLATE_SLOT,
    on: false,
    size: 0,
    onWritable: true,
    sizeWritable: true,
    ...partial,
  };
}

const access: PlateSlotAccess = {
  viewModelName: (item) => (item as FakeSlot).viewModelName,
  writeOn: (item, value) => {
    const s = item as FakeSlot;
    if (!s.onWritable) return false;
    s.on = value;
    return true;
  },
  writeSize: (item, value) => {
    const s = item as FakeSlot;
    if (!s.sizeWritable) return false;
    s.size = value;
    return true;
  },
};

function eightSlots(seed = 0): PlateSlotValues[] {
  return Array.from({ length: ATHLETE_RIG.PLATE_SLOTS_PER_SIDE }, (_, i) => ({
    on: (i + seed) % 2 === 0,
    size: 10 + i + seed,
  }));
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
    expect(plateLogicalPaths()).toHaveLength(2 * ATHLETE_RIG.PLATE_SLOTS_PER_SIDE);
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
    const list = fakeList(Array.from({ length: 24 }, () => slot()));
    const result = normalizePlatesListLength(list, ATHLETE_RIG.PLATE_SLOTS_PER_SIDE, () => {
      throw new Error('should not add');
    });
    expect(result).toEqual({ ok: true, length: 8 });
    expect(list.length).toBe(8);
  });

  it('extends a short list with fresh slots', () => {
    const list = fakeList([slot({ size: 1 }), slot({ size: 2 })]);
    let n = 0;
    const result = normalizePlatesListLength(list, ATHLETE_RIG.PLATE_SLOTS_PER_SIDE, () => {
      n += 1;
      return slot({ size: 100 + n });
    });
    expect(result).toEqual({ ok: true, length: 8 });
    expect(n).toBe(6);
    expect((platesListItemAt(list, 7) as FakeSlot).size).toBe(106);
  });

  it('fills an empty list to exactly eight', () => {
    const list = fakeList([]);
    let n = 0;
    const result = normalizePlatesListLength(list, ATHLETE_RIG.PLATE_SLOTS_PER_SIDE, () => {
      n += 1;
      return slot({ size: n });
    });
    expect(result).toEqual({ ok: true, length: 8 });
    expect(n).toBe(8);
  });

  it('stops when the factory cannot supply a missing slot', () => {
    const list = fakeList([slot()]);
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

describe('applyAthletePlatesList', () => {
  it('writes all sixteen logical paths independently through the adapter', () => {
    const list = fakeList([]);
    const values = eightSlots(0);
    const result = applyAthletePlatesList(list, () => slot(), values, access);
    expect(result).toEqual({ ok: true, length: 8, written: 16 });
    for (let i = 0; i < 8; i += 1) {
      const item = platesListItemAt(list, i) as FakeSlot;
      expect(item.on).toBe(values[i]!.on);
      expect(item.size).toBe(values[i]!.size);
    }

    const flipped = eightSlots(1);
    flipped[3] = { on: true, size: 99 };
    const second = applyAthletePlatesList(list, () => {
      throw new Error('should not need factory when length is already 8');
    }, flipped, access);
    expect(second.ok).toBe(true);
    expect(second.written).toBe(16);
    for (let i = 0; i < 8; i += 1) {
      const item = platesListItemAt(list, i) as FakeSlot;
      expect(item.on, `plates/${i}/on`).toBe(flipped[i]!.on);
      expect(item.size, `plates/${i}/size`).toBe(flipped[i]!.size);
    }
    expect((platesListItemAt(list, 3) as FakeSlot).size).toBe(99);
    expect((platesListItemAt(list, 2) as FakeSlot).size).toBe(flipped[2]!.size);
  });

  it('normalizes oversized lists then writes independently', () => {
    const list = fakeList(Array.from({ length: 24 }, (_, i) => slot({ size: i })));
    const values = eightSlots(2);
    const result = applyAthletePlatesList(list, () => {
      throw new Error('trim only');
    }, values, access);
    expect(result.ok).toBe(true);
    expect(list.length).toBe(8);
    expect((platesListItemAt(list, 0) as FakeSlot).size).toBe(values[0]!.size);
  });

  it('fails closed when the factory is missing on a short list', () => {
    const list = fakeList([slot()]);
    const result = applyAthletePlatesList(list, () => null, eightSlots(), access);
    expect(result.ok).toBe(false);
    expect(result.written).toBe(0);
    expect(result.reason).toContain('PlateSlot factory');
  });

  it('fails closed when an item has the wrong ViewModel type', () => {
    const list = fakeList(Array.from({ length: 8 }, () => slot({ viewModelName: 'Other' })));
    const result = applyAthletePlatesList(list, () => slot(), eightSlots(), access);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('expected PlateSlot');
    expect(result.written).toBe(0);
  });

  it('fails closed when on or size is not writable', () => {
    const list = fakeList(Array.from({ length: 8 }, (_, i) => slot({ onWritable: i !== 4 })));
    const result = applyAthletePlatesList(list, () => slot(), eightSlots(), access);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('plates[4].on not writable');
    expect(result.written).toBe(8);
  });

  it('fails closed when the list is missing', () => {
    const result = applyAthletePlatesList(null, () => slot(), eightSlots(), access);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('plates list missing');
  });
});
