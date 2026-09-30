import { build } from '../web/node_modules/esbuild/lib/main.js';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const outputPath = resolve(root, 'supabase/functions/twl-api/domain.js');
const manifestPath = resolve(root, 'supabase/functions/twl-api/domain.manifest.json');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const result = await build({ absWorkingDir: root, entryPoints: ['src/production/edgeEntry.ts'], bundle: true, format: 'esm', platform: 'neutral', target: 'es2022', minify: true, legalComments: 'inline', write: false, metafile: true });
const bytes = result.outputFiles[0].contents;
const sources = {};
for (const path of Object.keys(result.metafile.inputs).sort()) sources[path] = hash(await readFile(resolve(root, path)));
const bundler = JSON.parse(await readFile(resolve(root, 'web/node_modules/esbuild/package.json'), 'utf8')).version;
const manifest = `${JSON.stringify({ format: 1, bundler, artifactSha256: hash(bytes), sources }, null, 2)}\n`;
const check = process.argv.includes('--check');
if (check) {
  if (Buffer.compare(Buffer.from(bytes), await readFile(outputPath)) !== 0) throw new Error('The Edge Function bundle is stale. Run node supabase/bundle-api.mjs.');
  if (await readFile(manifestPath, 'utf8') !== manifest) throw new Error('The Edge Function source manifest is stale. Run node supabase/bundle-api.mjs.');
} else {
  await writeFile(outputPath, bytes); await writeFile(manifestPath, manifest);
}
console.log(JSON.stringify({ checked: check, inputs: Object.keys(sources).length, bytes: bytes.length, sha256: hash(bytes) }));
