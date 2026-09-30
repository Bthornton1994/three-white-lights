/** Install the committed locks in disposable tooling directories for Work Mode. */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmod, copyFile, lstat, mkdir, readFile, readlink, symlink, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = fileURLToPath(new URL('..', import.meta.url));
const tooling = path.resolve(repository, '../tooling');
const browserPin = Object.freeze({
  version: '151.0.7922.34',
  md5: '792047b3c2625d7d4b0fc7c4fc67d7ad',
  bytes: 120231126,
});

async function command(program, args, cwd = repository) {
  await new Promise((resolve, reject) => {
    const child = spawn(program, args, { cwd, env: process.env, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`${program} exited with ${code ?? signal}`)));
  });
}

async function linkDependencies(source, destination) {
  let existing;
  try { existing = await lstat(destination); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (existing && !existing.isSymbolicLink()) throw new Error(`Refusing to replace a real directory: ${destination}`);
  const relative = path.relative(path.dirname(destination), source);
  if (existing && await readlink(destination) === relative) return;
  if (existing) await unlink(destination);
  await symlink(relative, destination, 'dir');
}

for (const [name, packageDirectory] of [['native', repository], ['web', path.join(repository, 'web')]]) {
  const install = path.join(tooling, `exact-${name}`);
  await mkdir(install, { recursive: true });
  for (const file of ['package.json', 'package-lock.json']) await copyFile(path.join(packageDirectory, file), path.join(install, file));
  await command('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund', '--fetch-retries=1', '--fetch-timeout=20000'], install);
  await linkDependencies(path.join(install, 'node_modules'), path.join(packageDirectory, 'node_modules'));
}

if (process.argv.includes('--browser')) {
  const manifest = JSON.parse(await readFile(path.join(tooling, 'exact-web/node_modules/playwright-core/browsers.json'), 'utf8'));
  const chromium = manifest.browsers.find(browser => browser.name === 'chromium');
  if (chromium?.browserVersion !== browserPin.version) throw new Error('The committed Playwright browser pin changed; review the browser archive pin before installation');
  const directory = path.join(tooling, 'browser-manual');
  const archive = path.join(directory, 'chrome-headless-shell-linux64.zip');
  await mkdir(directory, { recursive: true });
  const url = `https://storage.googleapis.com/chrome-for-testing-public/${browserPin.version}/linux64/chrome-headless-shell-linux64.zip`;
  await command('curl', ['--fail', '--location', '--retry', '1', '--connect-timeout', '20', '--max-time', '180', '--output', archive, url]);
  const bytes = await readFile(archive);
  if (bytes.length !== browserPin.bytes || createHash('md5').update(bytes).digest('hex') !== browserPin.md5) throw new Error('The official Chromium archive does not match the reviewed bytes');
  await command('python3', ['-c', 'import sys,zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])', archive, directory]);
  const executable = path.join(directory, 'chrome-headless-shell-linux64/chrome-headless-shell');
  await chmod(executable, 0o755);
  await command(executable, ['--version']);
  await writeFile(path.join(directory, 'verification-browser.json'), JSON.stringify({ executable, version: browserPin.version, url, archiveMd5: browserPin.md5 }, null, 2) + '\n');
  console.log(`BROWSER_EXECUTABLE_PATH=${executable}`);
}
