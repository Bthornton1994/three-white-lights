/**
 * The dev route to the Rive spike: one query, both platforms, still gated on
 * `__DEV__`. The parser is pure and driven here; the hook's `__DEV__` and
 * platform guards are pinned as source, the same way `riveSpikeTypes.test.ts`
 * pins the stages, because vitest runs in node with no `__DEV__` and no
 * `Linking`.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  DEV_RIVE_SPIKE_QUERY_KEY,
  DEV_RIVE_SPIKE_QUERY_VALUE,
  devRiveSpikeRequestedBy,
} from './devRouteQuery';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const read = (rel: string): string => readFileSync(path.join(REPO, rel), 'utf8');

describe('devRiveSpikeRequestedBy — the one query, parsed the same way everywhere', () => {
  it('accepts the bare search string a browser gives and the full URL a scheme gives', () => {
    expect(devRiveSpikeRequestedBy('?dev-rive-spike=1')).toBe(true);
    expect(devRiveSpikeRequestedBy('threewhitelights://?dev-rive-spike=1')).toBe(true);
    expect(devRiveSpikeRequestedBy('threewhitelights://spike/path?x=2&dev-rive-spike=1#frag')).toBe(true);
    expect(devRiveSpikeRequestedBy(`?${DEV_RIVE_SPIKE_QUERY_KEY}=${DEV_RIVE_SPIKE_QUERY_VALUE}`)).toBe(true);
  });

  it('refuses every value but the exact one, a bare key, and no query at all', () => {
    expect(devRiveSpikeRequestedBy('?dev-rive-spike=0')).toBe(false);
    expect(devRiveSpikeRequestedBy('?dev-rive-spike=true')).toBe(false);
    expect(devRiveSpikeRequestedBy('?dev-rive-spike')).toBe(false);
    expect(devRiveSpikeRequestedBy('?dev-rive-spike=1x')).toBe(false);
    expect(devRiveSpikeRequestedBy('threewhitelights://')).toBe(false);
    expect(devRiveSpikeRequestedBy('')).toBe(false);
    expect(devRiveSpikeRequestedBy(null)).toBe(false);
    expect(devRiveSpikeRequestedBy(undefined)).toBe(false);
  });

  it("is not tripped by expo-dev-client's own launcher URL, which carries a query of its own", () => {
    const launcher =
      'exp+app://expo-development-client/?url=http%3A%2F%2F192.168.1.2%3A8081%3Fdev-rive-spike%3D1';
    expect(devRiveSpikeRequestedBy(launcher)).toBe(false);
  });

  it('agrees with the key App.tsx documents and the key the web probe types', () => {
    expect(DEV_RIVE_SPIKE_QUERY_KEY).toBe('dev-rive-spike');
    expect(DEV_RIVE_SPIKE_QUERY_VALUE).toBe('1');
    expect(read('App.tsx')).toContain('?dev-rive-spike=1');
  });
});

describe('useDevRiveSpikeRoute — both conditions, pinned as source', () => {
  const hook = read('src/dev/riveRuntimeSpike/devRoute.ts');

  it('reads its parser from the pure module rather than re-implementing it', () => {
    expect(hook).toContain("from './devRouteQuery'");
    expect(hook).not.toContain('URLSearchParams');
  });

  it('returns the app before touching Linking when __DEV__ is false, in both the initial state and the effect', () => {
    // The production path installs no listener and asks no initial URL.
    expect(hook).toMatch(/function initialRoute[\s\S]*?if \(!__DEV__\) return 'app';/);
    expect(hook).toMatch(/useEffect\(\(\) => \{\s*if \(!__DEV__\) return undefined;/);
    // Non-vacuity: Linking is actually used somewhere past those guards —
    // counted over code, since the header comment names one of the calls.
    const code = hook.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code.match(/Linking\.(getInitialURL|addEventListener)/g)?.length).toBe(2);
  });

  it('App.tsx routes through the hook and keeps no second way in', () => {
    const app = read('App.tsx');
    expect(app).toContain('useDevRiveSpikeRoute(');
    expect(app).not.toContain('isDevRiveSpikeRequested');
    expect(app.match(/^import \{ RiveRuntimeSpikeScreen \}/gm)?.length, 'one import').toBe(1);
    expect(app.match(/<RiveRuntimeSpikeScreen \/>/g)?.length, 'one mount').toBe(1);
  });
});
