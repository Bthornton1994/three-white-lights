import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const { chromium } = createRequire(root + '/web/package.json')('playwright');
const output = root + '/.gauntlet/evidence/production/art-cache-and-build';
const report = { startedAt: new Date().toISOString(), checks: [], pageErrors: [], sourceHashes: {}, missingOriginalArt: [], limitations: ['One equipment artwork request is deliberately blocked to test error recovery.', 'This is a functional recovery and placement check, not complete art acceptance or physical-device QA.'] };
const inputs = ['scripts/production-inspector-browser.mjs', 'web/src/Art.tsx', 'web/src/Gym.tsx', 'web/src/styles.css', 'web/src/interfaceTuning.ts', 'web/src/facilityPort.ts', 'src/facility/floor.ts'];
for (const name of inputs) report.sourceHashes[name] = createHash('sha256').update(await readFile(root + '/' + name)).digest('hex');
report.capturedFrom = { commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), workingTree: execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim() ? 'dirty' : 'clean', instrument: 'scripts/production-inspector-browser.mjs' };
for (const name of ['athlete/squat-atlas.png', 'athlete/bench-atlas.png', 'athlete/deadlift-atlas.png', 'empire-art/production-bar.png', 'empire-art/production-bench.png', 'empire-art/production-plates.png']) {
  try { await readFile(root + '/web/public/' + name); } catch (error) { if (error.code !== 'ENOENT') throw error; report.missingOriginalArt.push(name); }
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, message) { for(let n=0;n<300;n++) { if(await fn()) return; await pause(30); } throw Error(message); }
async function clickExposed(locator) {
  const point = await locator.evaluate(e => {
    const r=e.getBoundingClientRect();
    for(const y of [.5,.2,.8]) for(const x of [.5,.1,.9,.3,.7]) {
      const px=r.x+r.width*x, py=r.y+r.height*y;
      const hit=document.elementFromPoint(px,py);
      if(hit===e || e.contains(hit)) return {x:px,y:py};
    }
    return null;
  });
  assert.ok(point, 'Equipment has no exposed hit target');
  await page.mouse.click(point.x, point.y);
}
let browser; let page; let log = '';
const vite = spawn(process.execPath, [root + '/web/node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5193', '--strictPort'], { cwd: root + '/web', stdio: ['ignore', 'pipe', 'pipe'] });
for(const stream of [vite.stdout, vite.stderr]) stream.on('data', chunk => { log += chunk; });
try {
  await mkdir(output, { recursive: true });
  await until(async () => { if(vite.exitCode !== null) throw Error(log); try { return (await fetch('http://127.0.0.1:5193')).ok; } catch { return false; } }, 'Vite unavailable');
  browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined });
  page = await browser.newPage({ viewport: { width: 390, height: 667 } });
  page.on('pageerror', error => report.pageErrors.push(error.message));
  await page.route('**/empire-art/production-plates.png', route => route.abort('failed'));
  await page.goto('http://127.0.0.1:5193', { waitUntil: 'networkidle' });
  const canvas = page.locator('.inspect-panel canvas');
  const painted = async () => canvas.evaluate(c => { if(!c.width || !c.height || getComputedStyle(c).display === 'none') return false; const bytes = c.getContext('2d').getImageData(0,0,c.width,c.height).data; for(let i=3;i<bytes.length;i+=4) if(bytes[i]>16) return true; return false; });
  await until(painted, 'Initial bench did not paint');
  await clickExposed(page.getByRole('button', {name:'Inspect Competition plates', exact:true}));
  await page.locator('.inspect-panel .panel-icon span').waitFor();
  assert.equal(await canvas.isVisible(), false);
  await clickExposed(page.getByRole('button', {name:'Inspect Power bar', exact:true}));
  await until(painted, 'Cached bar did not recover after the failed texture');
  assert.equal(await page.locator('.inspect-panel .panel-icon span').count(), 0);
  report.checks.push({ name:'Equipment inspector recovers from a deliberately failed texture request to an already cached original bar texture', status:'passed' });
  await page.unroute('**/empire-art/production-plates.png');
  await page.getByRole('button', {name:'Build gym', exact:true}).click();
  await page.getByLabel('Equipment', {exact:true}).selectOption('flat-bench');
  const remove = page.getByRole('button', {name:'Return to storage', exact:true});
  await remove.waitFor();
  const hit = await remove.evaluate(e => { const r=e.getBoundingClientRect(); const nav=document.querySelector('.mobile-nav').getBoundingClientRect(); const target=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2); return {x:r.x,y:r.y,width:r.width,height:r.height,navTop:nav.y,hit:target===e || e.contains(target),scrollHeight:document.documentElement.scrollHeight,viewport:innerHeight}; });
  report.storageHit=hit;
  assert.ok(hit.height >= 44, 'Return to storage is under 44px');
  assert.ok(hit.y + hit.height <= hit.navTop, 'Return to storage is covered by navigation');
  assert.ok(hit.hit, 'Return to storage is covered');
  report.checks.push({ name:'Return to storage is initially visible and hit-tested above phone navigation at390x667', status:'passed', details:hit });
  await page.getByLabel('Column', {exact:true}).fill('8');
  await page.getByLabel('Row', {exact:true}).fill('6');
  const place = page.getByRole('button', {name:'Place item', exact:true});
  assert.equal(await place.isDisabled(), true);
  assert.match(await page.locator('.placement-validation').innerText(), /whole item/);
  await page.getByLabel('Column', {exact:true}).fill('1');
  await page.getByLabel('Row', {exact:true}).fill('1');
  assert.equal(await place.isDisabled(), true);
  assert.match(await page.locator('.placement-validation').innerText(), /overlaps/);
  await page.getByLabel('Column', {exact:true}).fill('6');
  await page.getByLabel('Row', {exact:true}).fill('3');
  assert.equal(await place.isEnabled(), true);
  await page.screenshot({path:output+'/short-phone-build.png',fullPage:true});
  await place.click();
  await page.getByRole('status').filter({hasText:'Competition bench placed.'}).waitFor();
  report.checks.push({name:'Whole footprint boundary and overlap refusals, then clear native placement acknowledgement',status:'passed'});
  assert.deepEqual(report.pageErrors, []);
  for (const name of inputs) assert.equal(createHash('sha256').update(await readFile(root + '/' + name)).digest('hex'), report.sourceHashes[name], 'A captured source changed during the check: ' + name);
  report.status=report.missingOriginalArt.length ? 'functional-passed-art-incomplete' : 'functional-passed';
} catch(error) { report.status='failed'; report.failure=error.stack; process.exitCode=1; if(page) { await page.screenshot({path:output+'/failure.png',fullPage:true}).catch(()=>{}); await writeFile(output+'/failure-body.txt', await page.locator('body').innerText()).catch(()=>{}); } }
finally { report.finishedAt=new Date().toISOString(); await writeFile(output+'/report.json', JSON.stringify(report,null,2)+'\n'); if(browser) await browser.close(); vite.kill('SIGTERM'); console.log(JSON.stringify(report)); }
