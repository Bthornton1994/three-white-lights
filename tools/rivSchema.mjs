// rivSchema.mjs — read what a `.riv` actually exposes, headlessly, in Node.
//
// WHAT THIS IS FOR. A Rive ViewModel property that the runtime cannot find is
// a SILENT no-op on both platforms — `numberProperty('barHeight')` returns
// null on native and `vmi.number('barHeight')` returns null on web, and the
// stage writes to nothing while the athlete stands still. `src/art/athleteRig.ts`
// derives the list of paths the athlete `.riv` must expose (`rigInputSpec()`);
// this module reads the list a given `.riv` DOES expose, so
// `src/art/rivContract.ts` can diff the two before an asset is ever mounted.
// That diff is the handoff check for any authored athlete asset
// (`docs/design/ATHLETE-ASSET-PIPELINE.md` §11).
//
// HOW IT RUNS WITHOUT A BROWSER. `@rive-app/canvas` is the web engine the
// web stage runs — a wasm module behind a small JS glue that expects a DOM.
// Two shims (a `document.createElement` that yields no context, and an empty
// `Image` class) are what the vendor's own type generator installs to run this
// same engine in Node; nothing here renders, so no canvas is ever needed. The
// wasm is handed to the loader as a `data:` URL built from the package's own
// `rive.wasm`, because the engine's default is to fetch it from a CDN this
// environment blocks (and which GDD §10.0's PWA must not depend on either —
// the web stage self-hosts the same file through Metro for the same reason).
//
// WHAT IT DOES NOT DO. It does not judge the asset. It does not know which
// ViewModel a stage will bind to except by the engine's own default
// (`defaultArtboardViewModel` of the default artboard) — the same answer
// `useViewModel(rive, { useDefault: true })` gives on web. Images and fonts
// referenced by the file are claimed and never decoded (decoding goes through
// render paths that stall without WebGL — measured upstream). It declares no
// dev-server URL and drives nothing.
//
// CLI: `node tools/rivSchema.mjs <file.riv>` prints the schema as JSON and
// exits 1 if the bytes are not a loadable Rive file.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);

/** The four bytes every Rive runtime file opens with. */
export const RIV_MAGIC = 'RIVE';

/** The engine resolves `load()` with null for unparseable bytes; it never rejects. This is the wait on it. */
const LOAD_TIMEOUT_MS = 20_000;

export function isRivMagic(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (u8.length < RIV_MAGIC.length) return false;
  for (let i = 0; i < RIV_MAGIC.length; i += 1) {
    if (u8[i] !== RIV_MAGIC.charCodeAt(i)) return false;
  }
  return true;
}

function installDomShims() {
  const g = globalThis;
  if (g.document === undefined) {
    g.document = { createElement: () => ({ getContext: () => null }) };
  }
  if (g.Image === undefined) {
    g.Image = class {};
  }
}

let runtimePromise = null;

/**
 * One engine per process. The engine prints "No WebGL support" through
 * `console.log` on initialisation; that line is routed to stderr for the
 * duration of the init so a CLI caller's stdout stays valid JSON.
 */
function runtime() {
  if (runtimePromise === null) {
    runtimePromise = (async () => {
      installDomShims();
      const canvas = require('@rive-app/canvas');
      const { RuntimeLoader, ViewModel } = canvas;
      const wasm = readFileSync(require.resolve('@rive-app/canvas/rive.wasm'));
      RuntimeLoader.setWasmUrl(`data:application/wasm;base64,${wasm.toString('base64')}`);
      RuntimeLoader.setWasmFallbackUrl(null);
      const log = console.log;
      const warn = console.warn;
      console.log = (...args) => process.stderr.write(`${args.join(' ')}\n`);
      console.warn = console.log;
      try {
        const rc = await RuntimeLoader.awaitInstance();
        return { rc, ViewModel };
      } finally {
        console.log = log;
        console.warn = warn;
      }
    })();
  }
  return runtimePromise;
}

/** The engine's property type names, normalised: `enumType` becomes `enum` and carries its values. */
function describeProperty(property, instance) {
  if (property.type === 'viewModel') {
    let ref = null;
    try {
      ref = instance?.viewModel(property.name)?.viewModelName ?? null;
    } catch {
      ref = null;
    }
    return { type: 'viewModel', ref };
  }
  if (property.type === 'enumType') {
    let values = [];
    try {
      values = instance?.enum(property.name)?.values ?? [];
    } catch {
      values = [];
    }
    return { type: 'enum', values: [...values] };
  }
  return { type: property.type };
}

/**
 * Read a `.riv`'s artboards, state machines and ViewModels. Resolves to
 * `{ valid: false, reason }` for bytes the engine will not load — including
 * the deliberate placeholder in `assets/dev/rive-spike.riv`.
 */
export async function readRivSchema(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (!isRivMagic(u8)) {
    return { valid: false, reason: `not a Rive file: the first bytes are not ${RIV_MAGIC}` };
  }
  const { rc, ViewModel } = await runtime();
  const assetLoader = new rc.CustomFileAssetLoader({ loadContents: () => true });
  let timer;
  const file = await Promise.race([
    rc.load(u8, assetLoader, false),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`load() gave no answer in ${LOAD_TIMEOUT_MS} ms`)), LOAD_TIMEOUT_MS);
    }),
  ]).finally(() => clearTimeout(timer));
  if (!file) {
    return { valid: false, reason: 'the engine rejected the file (load() returned null)' };
  }

  const artboards = [];
  const stateMachines = {};
  for (let i = 0; i < file.artboardCount(); i += 1) {
    const artboard = file.artboardByIndex(i);
    artboards.push(artboard.name);
    const names = [];
    for (let j = 0; j < artboard.stateMachineCount(); j += 1) {
      names.push(artboard.stateMachineByIndex(j).name);
    }
    stateMachines[artboard.name] = names;
  }

  const viewModels = {};
  for (let i = 0; i < file.viewModelCount(); i += 1) {
    const raw = file.viewModelByIndex(i);
    const vm = new ViewModel(raw);
    let instance = null;
    try {
      instance = vm.instance();
    } catch {
      instance = null;
    }
    const properties = {};
    for (const property of vm.properties) {
      properties[property.name] = describeProperty(property, instance);
    }
    viewModels[vm.name] = properties;
  }

  // The default ViewModel of EACH artboard, not only the file's default
  // artboard: the production stages select an artboard by lift and bind that
  // artboard's default (`artboardName` on native, `artboard` + `useDefault`
  // on web), so that is the ViewModel the contract has to be checked on.
  const defaultViewModelByArtboard = {};
  for (let i = 0; i < file.artboardCount(); i += 1) {
    const artboard = file.artboardByIndex(i);
    let name = null;
    try {
      const raw = file.defaultArtboardViewModel(artboard);
      name = raw ? new ViewModel(raw).name : null;
    } catch {
      name = null;
    }
    defaultViewModelByArtboard[artboard.name] = name;
  }
  const defaultArtboard = artboards[0] ?? null;

  return {
    valid: true,
    artboards,
    defaultArtboard,
    stateMachines,
    viewModels,
    defaultViewModel: defaultArtboard === null ? null : (defaultViewModelByArtboard[defaultArtboard] ?? null),
    defaultViewModelByArtboard,
  };
}

export async function readRivSchemaFile(filePath) {
  return readRivSchema(readFileSync(filePath));
}

const isMain = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const target = process.argv[2];
  if (target === undefined) {
    process.stderr.write('usage: node tools/rivSchema.mjs <file.riv>\n');
    process.exit(2);
  }
  const schema = await readRivSchemaFile(target);
  process.stdout.write(`${JSON.stringify(schema, null, 2)}\n`);
  process.exit(schema.valid ? 0 : 1);
}
