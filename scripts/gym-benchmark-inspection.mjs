/** Official store media, fetched for research only. Never copied to runtime art. */
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const output = '.gauntlet/shots/gym-empire/benchmarks';
await mkdir(output, { recursive: true });
const report = { inspectedAt: new Date().toISOString(), scope: 'Official store metadata, screenshots and a bounded trailer excerpt; not a competitor playtest.', sources: [], media: [], failures: [] };
async function json(url) { const response = await fetch(url, { signal: AbortSignal.timeout(20_000) }); if (!response.ok) throw new Error('HTTP ' + response.status); const value = await response.json(); report.sources.push(url); return value; }
async function image(url, file) {
  const host = new URL(url).hostname;
  if (!host.endsWith('.steamstatic.com') && !host.endsWith('.mzstatic.com')) throw new Error('Unapproved official media origin.');
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) }); if (!response.ok) throw new Error('HTTP ' + response.status);
  const bytes = Buffer.from(await response.arrayBuffer()); if (bytes.length > 8_000_000) throw new Error('Screenshot exceeds research size budget.');
  await writeFile(output + '/' + file, bytes); report.media.push({ file, url, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
try {
  const steam = (await json('https://store.steampowered.com/api/appdetails?appids=756300&l=english'))['756300'].data;
  await writeFile(output + '/steam-metadata.json', JSON.stringify(steam, null, 2));
  for (const [index, screenshot] of steam.screenshots.slice(0, 3).entries()) await image(screenshot.path_full, `gym-empire-${index}.jpg`);
  const trailer = steam.movies?.[0]?.mp4?.['480'] ?? steam.movies?.[0]?.webm?.['480'];
  if (trailer && new URL(trailer).hostname.endsWith('.steamstatic.com')) {
    try { execFileSync('ffmpeg', ['-y','-ss','5','-i',trailer,'-t','10','-vf','fps=1/2','-frames:v','5',output + '/gym-empire-trailer-%02d.jpg'], { timeout: 45_000, stdio: 'pipe', maxBuffer: 2_000_000 }); report.media.push({ file: 'gym-empire-trailer-01..05.jpg', url: trailer, excerpt: '5–15 seconds, five frames; motion inspection remains frame sampling.' }); }
    catch (error) { report.failures.push({ task: 'Steam trailer', error: error.message.slice(0,300) }); }
  }
} catch (error) { report.failures.push({ task: 'Steam official media', error: error.message }); }
try {
  const apple = (await json('https://itunes.apple.com/lookup?id=1478629374&country=us')).results[0];
  await writeFile(output + '/app-store-metadata.json', JSON.stringify(apple, null, 2));
  for (const [index,url] of (apple.screenshotUrls?.length ? apple.screenshotUrls : apple.ipadScreenshotUrls).slice(0,3).entries()) await image(url, `idle-fitness-${index}.jpg`);
} catch (error) { report.failures.push({ task: 'App Store official media', error: error.message }); }
await writeFile(output + '/report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ sources: report.sources.length, media: report.media.length, failures: report.failures }));
