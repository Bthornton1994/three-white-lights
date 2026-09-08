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
import ts from 'typescript';
import { execSync } from 'node:child_process';

import { codeOnly } from '../../tuning/audit';

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

// ---------------------------------------------------------------------------
// THE HOOK, EXECUTED — not only pinned as source.
// ---------------------------------------------------------------------------
// `devRoute.ts` imports `react-native`, which vitest cannot parse. So the
// module is transpiled here with the `typescript` package and evaluated with
// three stand-ins: a `react` whose `useState`/`useEffect` are a minimal
// render loop, a `react-native` whose `Linking` records every call and whose
// `Platform.OS` the test chooses, and the REAL `./devRouteQuery`. `__DEV__` is
// a parameter of the evaluation, so both worlds run in one process. What this
// buys over the source pins above: the production build (`__DEV__` false) is
// SHOWN to return 'app' for the exact query on both platforms and to make no
// Linking call — and a bundler that never defined `__DEV__` at all fails
// closed the same way.

type Route = 'pending' | 'spike' | 'app';
interface LinkingLog {
  readonly getInitialURL: number;
  readonly addEventListener: number;
  readonly removed: number;
}
interface Harness {
  /** Render the hook once (initial state), run its effects, and return the route. */
  mount(webSearch: string | null): Route;
  /** The route after every pending state update has been applied. */
  route(): Route;
  /** Resolve the pending `getInitialURL()` promise with this URL. */
  deliverInitial(url: string | null): Promise<void>;
  /** Fire a later `url` event through the registered listener, if any. */
  emitUrl(url: string): void;
  unmount(): void;
  readonly linking: LinkingLog;
}

function evaluateHook(dev: boolean | undefined, platform: 'web' | 'android' | 'ios'): Harness {
  const source = read('src/dev/riveRuntimeSpike/devRoute.ts');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });

  // --- the react stand-in: one hook instance, state by call order ---------
  let states: unknown[] = [];
  let cursor = 0;
  let effects: (() => void | (() => void))[] = [];
  let cleanups: (() => void)[] = [];
  let mounted = false;
  let lastRoute: Route = 'app';
  let renderFn: (() => Route) | null = null;
  const rerender = (): void => {
    if (!mounted || renderFn === null) return;
    cursor = 0;
    effects = [];
    lastRoute = renderFn();
  };
  const react = {
    useState<T>(init: T | (() => T)): [T, (next: T | ((prev: T) => T)) => void] {
      const index = cursor;
      cursor += 1;
      if (index >= states.length) states.push(typeof init === 'function' ? (init as () => T)() : init);
      const setter = (next: T | ((prev: T) => T)): void => {
        const prev = states[index] as T;
        const value = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        if (Object.is(value, prev)) return;
        states[index] = value;
        rerender();
      };
      return [states[index] as T, setter];
    },
    useEffect(effect: () => void | (() => void)): void {
      effects.push(effect);
    },
  };

  // --- the react-native stand-in --------------------------------------------
  const log = { getInitialURL: 0, addEventListener: 0, removed: 0 };
  let resolveInitial: ((url: string | null) => void) | null = null;
  let listener: ((event: { url: string }) => void) | null = null;
  const reactNative = {
    Platform: { OS: platform },
    Linking: {
      getInitialURL(): Promise<string | null> {
        log.getInitialURL += 1;
        return new Promise((resolve) => {
          resolveInitial = resolve;
        });
      },
      addEventListener(_type: 'url', handler: (event: { url: string }) => void): { remove(): void } {
        log.addEventListener += 1;
        listener = handler;
        return {
          remove(): void {
            log.removed += 1;
            listener = null;
          },
        };
      },
    },
  };

  const localRequire = (specifier: string): unknown => {
    if (specifier === 'react') return react;
    if (specifier === 'react-native') return reactNative;
    if (specifier === './devRouteQuery') return { devRiveSpikeRequestedBy };
    throw new Error(`devRoute.ts imported something this harness does not provide: ${specifier}`);
  };
  const module = { exports: {} as { useDevRiveSpikeRoute?: (webSearch: string | null) => Route } };
  // `__DEV__` is a free identifier in the transpiled module; it is bound here
  // as a parameter so `undefined` (a bundler that forgot the define) is a case.
  const evaluate = new Function('require', 'module', 'exports', '__DEV__', outputText) as (
    r: typeof localRequire,
    m: typeof module,
    e: typeof module.exports,
    d: boolean | undefined,
  ) => void;
  evaluate(localRequire, module, module.exports, dev);
  const hook = module.exports.useDevRiveSpikeRoute;
  if (hook === undefined) throw new Error('devRoute.ts did not export useDevRiveSpikeRoute');

  return {
    mount(webSearch) {
      mounted = true;
      states = [];
      cleanups = [];
      renderFn = () => hook(webSearch);
      rerender();
      for (const effect of effects) {
        const cleanup = effect();
        if (typeof cleanup === 'function') cleanups.push(cleanup);
      }
      return lastRoute;
    },
    route: () => lastRoute,
    async deliverInitial(url) {
      if (resolveInitial === null) throw new Error('getInitialURL was never called');
      resolveInitial(url);
      await Promise.resolve();
      await Promise.resolve();
    },
    emitUrl(url) {
      if (listener !== null) listener({ url });
    },
    unmount() {
      for (const cleanup of cleanups) cleanup();
      mounted = false;
    },
    linking: log,
  };
}

const EXACT_WEB = '?dev-rive-spike=1';
const EXACT_DEEP_LINK = 'threewhitelights://?dev-rive-spike=1';
const LAUNCHER = 'exp+app://expo-development-client/?url=http%3A%2F%2F192.168.1.2%3A8081%3Fdev-rive-spike%3D1';
const MALFORMED = ['?dev-rive-spike=0', '?dev-rive-spike=true', '?dev-rive-spike', '?dev-rive-spike=1x', '?DEV-RIVE-SPIKE=1', '?dev-rive-spike=1%20', ''];

describe('useDevRiveSpikeRoute, executed under both __DEV__ worlds', () => {
  it('a production build returns the app for the exact query on web and never touches Linking', () => {
    const h = evaluateHook(false, 'web');
    expect(h.mount(EXACT_WEB)).toBe('app');
    expect(h.linking).toEqual({ getInitialURL: 0, addEventListener: 0, removed: 0 });
  });

  it('a production build returns the app on native, before and after a deep link, and installs no listener', async () => {
    const h = evaluateHook(false, 'android');
    expect(h.mount(null)).toBe('app');
    expect(h.linking.getInitialURL, 'no initial-URL read').toBe(0);
    expect(h.linking.addEventListener, 'no listener').toBe(0);
    h.emitUrl(EXACT_DEEP_LINK);
    expect(h.route()).toBe('app');
  });

  it('a bundle whose __DEV__ was never defined fails closed to the app on both platforms', () => {
    expect(evaluateHook(undefined, 'web').mount(EXACT_WEB)).toBe('app');
    const native = evaluateHook(undefined, 'android');
    expect(native.mount(null)).toBe('app');
    expect(native.linking.getInitialURL).toBe(0);
  });

  it('a dev build on web opens the spike for the exact query and nothing else, synchronously, with no Linking call', () => {
    expect(evaluateHook(true, 'web').mount(EXACT_WEB)).toBe('spike');
    for (const search of MALFORMED) {
      expect(evaluateHook(true, 'web').mount(search), JSON.stringify(search)).toBe('app');
    }
    expect(evaluateHook(true, 'web').mount(null)).toBe('app');
    expect(evaluateHook(true, 'web').mount(LAUNCHER)).toBe('app');
    const h = evaluateHook(true, 'web');
    h.mount(EXACT_WEB);
    expect(h.linking).toEqual({ getInitialURL: 0, addEventListener: 0, removed: 0 });
  });

  it('a dev build on native is pending until the launch URL resolves, then the app for a plain launch and the launcher URL', async () => {
    for (const url of [null, 'threewhitelights://', LAUNCHER, 'threewhitelights://?dev-rive-spike=0']) {
      const h = evaluateHook(true, 'android');
      expect(h.mount(null), 'before the launch URL resolves').toBe('pending');
      expect(h.linking.getInitialURL).toBe(1);
      expect(h.linking.addEventListener).toBe(1);
      await h.deliverInitial(url);
      expect(h.route(), JSON.stringify(url)).toBe('app');
    }
  });

  it('a dev build on native opens the spike for the exact deep link — at launch, or delivered later to a running app', async () => {
    const atLaunch = evaluateHook(true, 'ios');
    atLaunch.mount(null);
    await atLaunch.deliverInitial(EXACT_DEEP_LINK);
    expect(atLaunch.route()).toBe('spike');

    const later = evaluateHook(true, 'android');
    later.mount(null);
    await later.deliverInitial(null);
    expect(later.route()).toBe('app');
    later.emitUrl(LAUNCHER);
    expect(later.route(), 'the launcher URL is not a request').toBe('app');
    later.emitUrl(EXACT_DEEP_LINK);
    expect(later.route()).toBe('spike');
    // A later event cannot take the spike away, and unmount removes the listener.
    later.emitUrl('threewhitelights://');
    expect(later.route()).toBe('spike');
    later.unmount();
    expect(later.linking.removed).toBe(1);
  });

  it('an unmount before the launch URL resolves leaves the route alone and removes the listener', async () => {
    const h = evaluateHook(true, 'android');
    h.mount(null);
    h.unmount();
    await h.deliverInitial(EXACT_DEEP_LINK);
    expect(h.route(), 'the stale resolution is ignored').toBe('pending');
    expect(h.linking.removed).toBe(1);
  });
});

describe('the spike is not reachable through the shell, and nothing in a player surface points at it', () => {
  it("resolveEntry has no arm for the query — it is the same launch as no query at all", async () => {
    const { resolveEntry } = await import('../../shell/shellRoute');
    expect(resolveEntry(EXACT_WEB)).toEqual(resolveEntry(null));
    expect(resolveEntry(EXACT_WEB)).toEqual(resolveEntry(''));
    expect(resolveEntry(EXACT_WEB).route.source).not.toBe('debug');
    // NON-VACUITY: resolveEntry does route on a query it knows.
    expect(resolveEntry('?meet=recap').route.surface).toBe('meet');
  });

  it('no player-facing module under src/ names the spike, its query, or its screen — the only mount is App.tsx', () => {
    const files = execSync('git ls-files -- "src/**/*.ts" "src/**/*.tsx" App.tsx', { cwd: REPO, encoding: 'utf8' })
      .split('\n')
      .filter((f) => f.length > 0 && !f.startsWith('src/dev/'));
    // Two views, per the scan discipline in athleteRig.test.ts: import
    // SPECIFIERS are string literals, so they are read from the raw source;
    // a mount or a hook call is an IDENTIFIER, so it is read from the
    // code-only view (comments and strings blanked) — a header comment that
    // cites the spike as precedent, or a registry row naming its tuning
    // file, is prose and not a route.
    const importers: string[] = [];
    const users: string[] = [];
    for (const file of files) {
      const raw = read(file);
      if (/from '[^']*riveRuntimeSpike[^']*'/.test(raw)) importers.push(file);
      if (/RiveRuntimeSpikeScreen|useDevRiveSpikeRoute|RiveSpikeStage/.test(codeOnly(raw))) users.push(file);
    }
    // App.tsx is the one legitimate site; the rule that it is the ONLY one is
    // what keeps a "debug menu" button out of the shell.
    expect(importers).toEqual(['App.tsx']);
    expect(users).toEqual(['App.tsx']);
    // The prose mentions exist (the stage headers cite the spike) — so the
    // code-only view is what made this pass, not an empty tree.
    expect(files.filter((f) => /riveRuntimeSpike/.test(read(f))).length).toBeGreaterThan(1);
    // NON-VACUITY: the walk saw the shell and the session views.
    expect(files.some((f) => f.startsWith('src/shell/'))).toBe(true);
    expect(files.some((f) => f.startsWith('src/session/'))).toBe(true);
    expect(files.length).toBeGreaterThan(100);
  });

  it('the diagnostic assets cannot become a production route: no non-dev module requires a dev .riv, and the stage gate is closed', () => {
    const files = execSync('git ls-files -- "src/**/*.ts" "src/**/*.tsx"', { cwd: REPO, encoding: 'utf8' })
      .split('\n')
      .filter((f) => f.length > 0 && !f.startsWith('src/dev/') && !/\.test\.tsx?$/.test(f));
    // A LOAD, not a mention: `require('…/assets/dev/<x>.riv')` is how Metro
    // bundles an asset; `src/licensing/realIp.ts` names the same files in its
    // unreadable-binary census and loads nothing.
    const devAssetLoaders = files.filter((f) => /require\(\s*['"][^'"]*assets\/dev\/[a-z_-]+\.riv['"]\s*\)/.test(read(f)));
    const devAssetMentions = files.filter((f) => /assets\/dev\/[a-z_-]+\.riv/.test(read(f)));
    // `athleteAsset.ts` points at the deliberately-invalid placeholder so the
    // stages compile and reject it loudly — the one allowed load, and the
    // stage that reads it is behind `ATHLETE_RIG.TRAINING_STAGE` (pinned closed
    // by trainingStageGate.test.ts). No other module loads a dev .riv.
    expect(devAssetLoaders).toEqual(['src/session/athleteAsset.ts']);
    expect(devAssetMentions.sort()).toEqual(['src/licensing/realIp.ts', 'src/session/athleteAsset.ts']);
    expect(read('src/session/athleteAsset.ts')).toContain('rive-spike.riv');
    expect(read('src/session/athleteAsset.ts')).not.toMatch(/quick_start|rewards/);
  });
});
