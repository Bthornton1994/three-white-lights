// rivContract.mjs — does this .riv expose what the athlete binding writes?
//
//   node tools/rivContract.mjs <file.riv>                 diff the file against the rig contract, all lifts
//   node tools/rivContract.mjs <file.riv> --artboard squat  only the named lift artboard(s) (repeatable)
//   node tools/rivContract.mjs --manifest                  print the contract itself as JSON
//
// THE VALIDATION COMMAND THE RIVE EDITOR HANDOFF NAMES. A ViewModel property
// the runtime cannot find is a silent no-op on both platforms, and a bound
// ViewModel with no running state machine draws a graphic the writes never
// reach (measured on the runtime spike's first real-asset probe: status
// `bound`, zero changed pixels). So before an asset is eligible for the
// player path it is run through this, and it must print `satisfied: true`
// and exit 0. Every lift artboard the stages select (`rigLiftArtboards()`)
// must exist, carry a state machine of the same name, and expose — on ITS
// OWN default ViewModel — every path in `rigInputSpec()` with the right type
// and, for enums, every value the binding can write. The report is JSON on
// stdout; a one-line verdict goes to stderr. Exit 0 only when satisfied.
//
// ONE TRUTH, LOADED AT RUN TIME. The spec and the diff live in TypeScript
// (`src/art/athleteRig.ts`, `src/art/rivContract.ts`) beside the binding
// that writes the same list, so this command cannot drift from the stages.
// No bundler is installed here, so those modules are loaded through the
// `typescript` package's own `transpileModule`, hooked into CommonJS
// resolution for `.ts` files for the duration of the load. The `.riv`
// itself is read by `tools/rivSchema.mjs` (headless engine, self-hosted
// wasm). `src/art/rivContract.test.ts` drives this file as a subprocess.
//
// It declares no dev-server URL and drives nothing.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readRivSchemaFile } from './rivSchema.mjs';

const require = createRequire(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Load the TypeScript contract modules through `typescript.transpileModule`.
 * The hook is installed only for this call, then restored, so nothing else
 * in the process sees a `.ts` loader it did not ask for.
 */
function loadContract() {
  const ts = require('typescript');
  const Module = require('node:module');
  const extensions = Module._extensions;
  const previous = extensions['.ts'];
  extensions['.ts'] = (module, filename) => {
    const source = readFileSync(filename, 'utf8');
    const { outputText } = ts.transpileModule(source, {
      fileName: filename,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    });
    module._compile(outputText, filename);
  };
  try {
    const contract = require(path.join(REPO_ROOT, 'src/art/rivContract.ts'));
    const rig = require(path.join(REPO_ROOT, 'src/art/athleteRig.ts'));
    return {
      diffRivContract: contract.diffRivContract,
      rigManifest: contract.rigManifest,
      rigInputSpec: rig.rigInputSpec,
      rigLiftArtboards: rig.rigLiftArtboards,
    };
  } finally {
    if (previous === undefined) delete extensions['.ts'];
    else extensions['.ts'] = previous;
  }
}

function usage() {
  process.stderr.write('usage: node tools/rivContract.mjs <file.riv> [--artboard <name>]... | --manifest\n');
  process.exit(2);
}

const argv = process.argv.slice(2);
const argument = argv[0];
if (argument === undefined) usage();
// `--artboard squat` (repeatable): validate only the named lift artboards.
// The v1 athlete is squat-only by ruling; the default — every lift — is the
// bar for production eligibility across all three.
const requestedArtboards = [];
for (let i = 1; i < argv.length; i += 1) {
  if (argv[i] === '--artboard' && argv[i + 1] !== undefined) {
    requestedArtboards.push(argv[i + 1]);
    i += 1;
  } else {
    usage();
  }
}

const { diffRivContract, rigManifest, rigInputSpec, rigLiftArtboards } = loadContract();

if (argument === '--manifest') {
  process.stdout.write(`${JSON.stringify(rigManifest(), null, 2)}\n`);
  process.exit(0);
}

const schema = await readRivSchemaFile(argument);
if (!schema.valid) {
  process.stdout.write(`${JSON.stringify(schema, null, 2)}\n`);
  process.stderr.write(`NOT A RIVE FILE: ${schema.reason}\n`);
  process.exit(1);
}

const known = rigLiftArtboards();
for (const name of requestedArtboards) {
  if (!known.includes(name)) {
    process.stderr.write(`unknown lift artboard "${name}" — the stages select one of: ${known.join(', ')}\n`);
    process.exit(2);
  }
}
const artboards = requestedArtboards.length > 0 ? requestedArtboards : known;
const diff = diffRivContract(schema, rigInputSpec(), { artboards });
process.stdout.write(`${JSON.stringify(diff, null, 2)}\n`);

const lines = [];
for (const a of diff.artboards) {
  const state = !a.present
    ? 'ABSENT'
    : !a.stateMachine
      ? `no state machine named "${a.artboard}"`
      : a.viewModel === null
        ? 'no default ViewModel'
        : a.satisfied
          ? `ok (${a.viewModel})`
          : `${a.missing.length} missing, ${a.wrongType.length} wrong type, ${a.missingEnumValues.length} enum gaps on ${a.viewModel}`;
  lines.push(`  ${a.artboard}: ${state}`);
}
process.stderr.write(`${diff.satisfied ? 'SATISFIED' : 'NOT SATISFIED'} — ${argument}\n${lines.join('\n')}\n`);
process.exit(diff.satisfied ? 0 : 1);
