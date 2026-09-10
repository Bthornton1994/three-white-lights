/**
 * athletePlatesRuntime.test.ts — the shared plates List adapter against the
 * shipped `assets/athlete/athlete-01.riv`, through the same `@rive-app/canvas`
 * engine the web stage runs (via `tools/rivSchema.mjs`'s loader).
 *
 * Proves empty / short / oversized lists normalize to eight PlateSlot items
 * and that all sixteen logical writes are independent. Does not mount the
 * player path or flip the placeholder flag.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  ATHLETE_PLATE_SLOT,
  ATHLETE_PLATES_LIST,
  applyAthletePlatesList,
  plateLogicalPaths,
  platesListItemAt,
  type PlateSlotAccess,
  type PlatesListLike,
} from './athletePlatesList';
import { ATHLETE_RIG } from './spriteTuning';
import { readRivSchemaFile } from '../../tools/rivSchema.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ATHLETE_RIV = path.join(REPO, 'assets', 'athlete', 'athlete-01.riv');
const require = createRequire(import.meta.url);

type RuntimeSlot = {
  viewModelName: string;
  boolean: (name: string) => { value: boolean } | null;
  number: (name: string) => { value: number } | null;
};

describe('athlete plates List on shipped athlete-01.riv', () => {
  let list: PlatesListLike;
  let createSlot: () => unknown | null;
  let access: PlateSlotAccess;

  beforeAll(async () => {
    const schema = await readRivSchemaFile(ATHLETE_RIV);
    expect(schema.valid).toBe(true);
    if (!schema.valid) return;
    expect(schema.viewModels.Athlete?.[ATHLETE_PLATES_LIST]?.type).toBe('list');
    expect(schema.viewModels.Athlete?.[ATHLETE_PLATES_LIST]?.itemRef).toBe(ATHLETE_PLATE_SLOT);

    const canvas = require('@rive-app/canvas');
    const { RuntimeLoader, ViewModel } = canvas;
    const rc = await RuntimeLoader.awaitInstance();
    const bytes = new Uint8Array(readFileSync(ATHLETE_RIV));
    const file = await rc.load(bytes, new rc.CustomFileAssetLoader({ loadContents: () => true }), false);
    expect(file).toBeTruthy();
    const artboard = file.artboardByName('squat');
    const athleteVm = new ViewModel(file.defaultArtboardViewModel(artboard));
    const instance = athleteVm.defaultInstance();
    list = instance.list(ATHLETE_PLATES_LIST) as PlatesListLike;
    expect(list).toBeTruthy();

    const plateVm = new ViewModel(file.viewModelByName(ATHLETE_PLATE_SLOT));
    createSlot = () => plateVm.instance();
    access = {
      viewModelName: (item) => (item as RuntimeSlot).viewModelName ?? null,
      writeOn: (item, value) => {
        const prop = (item as RuntimeSlot).boolean('on');
        if (!prop) return false;
        prop.value = value;
        return true;
      },
      writeSize: (item, value) => {
        const prop = (item as RuntimeSlot).number('size');
        if (!prop) return false;
        prop.value = value;
        return true;
      },
    };
  }, 30_000);

  it('names sixteen logical paths', () => {
    expect(plateLogicalPaths()).toHaveLength(16);
  });

  it('normalizes an oversized authored list to eight PlateSlot items and writes independently', () => {
    expect(list.length).toBeGreaterThan(ATHLETE_RIG.PLATE_SLOTS_PER_SIDE);
    const values = Array.from({ length: 8 }, (_, i) => ({
      on: i % 2 === 0,
      size: 20 + i,
    }));
    const result = applyAthletePlatesList(list, createSlot, values, access);
    expect(result).toEqual({ ok: true, length: 8, written: 16 });
    expect(list.length).toBe(8);
    for (let i = 0; i < 8; i += 1) {
      const item = platesListItemAt(list, i) as RuntimeSlot;
      expect(item.viewModelName).toBe(ATHLETE_PLATE_SLOT);
      expect(item.boolean('on')!.value).toBe(values[i]!.on);
      expect(item.number('size')!.value).toBe(values[i]!.size);
    }
  });

  it('rebuilds from an empty list via ViewModel.instance() and keeps writes independent', () => {
    while (list.length > 0) list.removeInstanceAt(list.length - 1);
    expect(list.length).toBe(0);

    const values = Array.from({ length: 8 }, (_, i) => ({
      on: i === 3,
      size: 30 + i,
    }));
    const result = applyAthletePlatesList(list, createSlot, values, access);
    expect(result.ok).toBe(true);
    expect(result.written).toBe(16);
    expect(list.length).toBe(8);

    values[3] = { on: false, size: 77 };
    values[5] = { on: true, size: 88 };
    const second = applyAthletePlatesList(list, () => {
      throw new Error('length already 8 — factory must not run');
    }, values, access);
    expect(second.ok).toBe(true);
    for (let i = 0; i < 8; i += 1) {
      const item = platesListItemAt(list, i) as RuntimeSlot;
      expect(item.boolean('on')!.value, `plates/${i}/on`).toBe(values[i]!.on);
      expect(item.number('size')!.value, `plates/${i}/size`).toBe(values[i]!.size);
    }
  });

  it('extends a short list with fresh PlateSlot instances', () => {
    while (list.length > 3) list.removeInstanceAt(list.length - 1);
    expect(list.length).toBe(3);
    const values = Array.from({ length: 8 }, (_, i) => ({ on: true, size: 40 + i }));
    const result = applyAthletePlatesList(list, createSlot, values, access);
    expect(result.ok).toBe(true);
    expect(list.length).toBe(8);
    for (let i = 0; i < 8; i += 1) {
      const item = platesListItemAt(list, i) as RuntimeSlot;
      expect(item.viewModelName).toBe(ATHLETE_PLATE_SLOT);
    }
  });
});
