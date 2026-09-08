/**
 * The dev-mode key: parsed by the pure module, pinned as source on the hook
 * (which imports `react-native` and cannot be parsed by vitest — the same
 * split `devRoute.ts` / `devRouteQuery.ts` uses, for the same reason).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { DEV_MODE_QUERY_KEY, DEV_MODES, devModeRequestedBy } from './devModeQuery';
import { devRiveSpikeRequestedBy } from './devRouteQuery';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (name: string): string => readFileSync(path.join(HERE, name), 'utf8');

describe('devModeRequestedBy — the second key on the spike route', () => {
  it('reads the exact mode from a search string or a full scheme URL', () => {
    expect(devModeRequestedBy('?dev-rive-spike=1&dev-mode=athlete-accept')).toBe('athlete-accept');
    expect(devModeRequestedBy('threewhitelights://?dev-rive-spike=1&dev-mode=athlete-accept')).toBe('athlete-accept');
    expect(devModeRequestedBy('threewhitelights://x/y?dev-mode=athlete-accept&dev-rive-spike=1#f')).toBe('athlete-accept');
    expect(DEV_MODE_QUERY_KEY).toBe('dev-mode');
    expect([...DEV_MODES]).toEqual(['athlete-accept', 'spike-cycle']);
    expect(devModeRequestedBy('?dev-rive-spike=1&dev-mode=spike-cycle')).toBe('spike-cycle');
  });

  it('refuses every other value, a bare key, and no query', () => {
    for (const bad of ['?dev-mode=spike', '?dev-mode=athlete-accept-x', '?dev-mode=ATHLETE-ACCEPT', '?dev-mode', '?dev-mode=', 'threewhitelights://', '', '?dev-rive-spike=1']) {
      expect(devModeRequestedBy(bad), JSON.stringify(bad)).toBeNull();
    }
    expect(devModeRequestedBy(null)).toBeNull();
    expect(devModeRequestedBy(undefined)).toBeNull();
  });

  it('opens nothing on its own: the mode is only read once the spike route is already decided', () => {
    // The gate is the spike key; `dev-mode` alone is not a request the app
    // ever sees (App.tsx reads only `devRiveSpikeRequestedBy`).
    expect(devRiveSpikeRequestedBy('?dev-mode=athlete-accept')).toBe(false);
    expect(devModeRequestedBy('?dev-mode=athlete-accept')).toBe('athlete-accept');
    const app = readFileSync(path.resolve(HERE, '..', '..', '..', 'App.tsx'), 'utf8');
    expect(app).not.toContain('dev-mode');
    expect(app).not.toContain('useDevMode');
  });
});

describe('useDevMode — pinned as source', () => {
  const hook = read('devMode.ts');
  it('guards every Linking call on __DEV__ and reads the pure parser', () => {
    expect(hook).toContain("from './devModeQuery'");
    expect(hook).not.toContain('URLSearchParams');
    expect(hook).toMatch(/function initialMode[\s\S]*?if \(!__DEV__\) return null;/);
    expect(hook).toMatch(/useEffect\(\(\) => \{\s*if \(!__DEV__\) return undefined;/);
    const code = hook.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code.match(/Linking\.(getInitialURL|addEventListener)/g)?.length).toBe(2);
  });

  it('is called only by the spike screen, which only mounts on the spike route', () => {
    const screen = read('RiveRuntimeSpikeScreen.tsx');
    expect(screen).toContain('useDevMode(');
    expect(screen).toContain("=== 'athlete-accept'");
    expect(screen).toContain('<AthleteAcceptanceScreen');
    // The cycle mode remounts through a React `key` and never renders a second stage.
    expect(screen).toContain("=== 'spike-cycle'");
    expect(screen.match(/<RiveSpikeStage /g)?.length, 'one stage element').toBe(1);
    expect(screen).toContain('<RiveSpikeStage key={cycle}');
  });
});
