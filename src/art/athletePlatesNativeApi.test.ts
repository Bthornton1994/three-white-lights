/**
 * athletePlatesNativeApi.test.ts — pins the native List factory against the
 * installed `@rive-app/react-native` typings.
 *
 * Vitest cannot execute Nitro HybridObjects (no Android/iOS runtime here).
 * The repository's standing pattern for native-only surfaces is a source +
 * type-definition pin (`riveSpikeTypes.test.ts`, `athleteComposedStage.test.ts`).
 * This file does the same for plates: it proves the API the stage calls is
 * declared by the pinned package, and that the stage calls it — not that a
 * device ran it.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { ATHLETE_PLATE_SLOT, ATHLETE_PLATES_LIST } from './athletePlatesList';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const require = createRequire(import.meta.url);

const NATIVE_STAGE = path.join(REPO, 'src', 'session', 'AthleteStage.native.tsx');
const VIEW_MODEL_DTS = path.join(
  REPO,
  'node_modules',
  '@rive-app',
  'react-native',
  'lib',
  'typescript',
  'src',
  'specs',
  'ViewModel.nitro.d.ts',
);
const RIVE_FILE_DTS = path.join(
  REPO,
  'node_modules',
  '@rive-app',
  'react-native',
  'lib',
  'typescript',
  'src',
  'specs',
  'RiveFile.nitro.d.ts',
);

describe('pinned @rive-app/react-native List factory API', () => {
  it('records the installed package version and declares the sync + async blank factories', () => {
    const pkg = require('@rive-app/react-native/package.json') as { version: string };
    expect(pkg.version).toBe('0.4.20');

    const viewModel = readFileSync(VIEW_MODEL_DTS, 'utf8');
    expect(viewModel).toContain('readonly modelName: string');
    expect(viewModel).toContain('createInstance(): ViewModelInstance | undefined');
    expect(viewModel).toContain('createBlankInstanceAsync(): Promise<ViewModelInstance | undefined>');
    expect(viewModel).toContain('listProperty(path: string): ViewModelListProperty | undefined');
    expect(viewModel).toContain('getInstanceAt(index: number): ViewModelInstance | undefined');
    expect(viewModel).toContain('addInstance(instance: ViewModelInstance): void');
    expect(viewModel).toContain('removeInstanceAt(index: number): void');

    const riveFile = readFileSync(RIVE_FILE_DTS, 'utf8');
    expect(riveFile).toContain('viewModelByName(name: string): ViewModel | undefined');
    expect(riveFile).toContain('viewModelByNameAsync(name: string');
  });

  it('the native stage uses viewModelByName + modelName + createInstance for PlateSlot', () => {
    const source = readFileSync(NATIVE_STAGE, 'utf8');
    expect(source).toContain('applyAthletePlatesList');
    expect(source).toContain('listProperty(ATHLETE_PLATES_LIST)');
    expect(source).toContain('viewModelByName(ATHLETE_PLATE_SLOT)');
    expect(source).toContain('model.modelName !== ATHLETE_PLATE_SLOT');
    expect(source).toContain('model.createInstance()');
    // Must not invent path-grammar aliases the runtime does not bind.
    expect(source).not.toMatch(/booleanProperty\(\s*['"`]plates\//);
    expect(source).not.toMatch(/numberProperty\(\s*['"`]plates\//);
    expect(ATHLETE_PLATES_LIST).toBe('plates');
    expect(ATHLETE_PLATE_SLOT).toBe('PlateSlot');
  });

  it('fails closed in source when on/size accessors are missing on a list item', () => {
    const source = readFileSync(NATIVE_STAGE, 'utf8');
    expect(source).toContain('booleanProperty(PLATE_SLOT_ON)');
    expect(source).toContain('numberProperty(PLATE_SLOT_SIZE)');
    expect(source).toContain("throw new Error(`athlete plates List write failed:");
  });
});
