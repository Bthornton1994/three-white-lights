#!/usr/bin/env node
/**
 * Generates the live progress page from .gauntlet/state.json.
 *
 * Kept data-driven so updating the page mid-run is a JSON edit plus one
 * command, rather than hand-editing markup while builders are in flight.
 *
 * Usage: node tools/progress.mjs [out.html]
 */
import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = process.argv[2] ?? path.join(ROOT, '.gauntlet', 'progress.html');
const state = JSON.parse(await readFile(path.join(ROOT, '.gauntlet', 'state.json'), 'utf8'));

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Inline screenshots so the page stays self-contained under the artifact CSP.
//
// RECURSIVE, because capture sequences nest (`L1-maximal/stage/05-losing.png`).
// A flat readdir here silently rendered no image for any piece whose evidence
// pointed into a subdirectory, while the page still claimed the piece had
// evidence — the picture just quietly vanished. Walking the tree fixes that,
// and the missing-evidence warning below makes the next such mismatch loud
// instead of invisible.
const shotsDir = path.join(ROOT, '.gauntlet', 'shots');
const shots = new Map();
const shotAges = new Map();
async function collectShots(dir, prefix = '') {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return; // no shots yet
  }
  for (const e of entries) {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      await collectShots(full, rel);
      continue;
    }
    if (!e.name.endsWith('.png')) continue;
    const buf = await readFile(full);
    if (buf.length < 900_000) {
      shots.set(rel, `data:image/png;base64,${buf.toString('base64')}`);
      shotAges.set(rel, (await stat(full)).mtime);
    }
  }
}
await collectShots(shotsDir);

// A piece's standing is shown as a judges' decision, because that is what it
// is: three lights, majority carries. Grey = not yet called. Hollow = the
// reference needed to make the call cannot be reached.
const DECISION = {
  passed: { lights: ['w', 'w', 'w'], label: 'Good lift', tone: 'good' },
  majority: { lights: ['w', 'w', 'r'], label: 'Good lift — majority', tone: 'good' },
  failed: { lights: ['r', 'r', 'r'], label: 'No lift — sent back', tone: 'bad' },
  building: { lights: ['p', 'p', 'p'], label: 'On the platform', tone: 'active' },
  ungraded: { lights: ['o', 'o', 'o'], label: 'Lifted — no decision given', tone: 'warn' },
  pending: { lights: ['o', 'o', 'o'], label: 'Not yet called', tone: 'idle' },
  unverifiable: { lights: ['h', 'h', 'h'], label: 'Cannot be judged here', tone: 'warn' },
};

const counts = state.pieces.reduce((a, p) => ((a[p.status] = (a[p.status] ?? 0) + 1), a), {});
const judged = (counts.passed ?? 0) + (counts.majority ?? 0);
const unjudgeable = state.pieces.filter((p) => p.verifiable === false).length;

const lightsHtml = (status) =>
  (DECISION[status] ?? DECISION.pending).lights.map((l) => `<i class="lt lt-${l}"></i>`).join('');

/**
 * Pieces whose `evidence` names a screenshot that was not found. Collected so
 * the page can SAY so: a card that silently drops its picture looks identical
 * to a card that never claimed one, which is how a piece went several rounds
 * showing no rendered output while its note described some.
 */
const missingEvidence = [];

const pieceRow = (p) => {
  const d = DECISION[p.status] ?? DECISION.pending;
  const shot = p.evidence && shots.get(p.evidence);
  if (p.evidence && !shot) missingEvidence.push(`${p.id} → ${p.evidence}`);
  const shotAge = p.evidence && shotAges.get(p.evidence);
  return `<article class="piece" data-tone="${d.tone}">
  <header class="piece-h">
    <span class="pid">${esc(p.id)}</span>
    <h3>${esc(p.name)}</h3>
    <span class="lights" title="${esc(d.label)}" aria-label="${esc(d.label)}">${lightsHtml(p.status)}</span>
  </header>
  <p class="bar"><span class="eyebrow">Bar</span>${esc(p.bar)}</p>
  ${p.note ? `<p class="note">${esc(p.note)}</p>` : ''}
  <p class="verdict">${esc(d.label)}${p.verifiable === false ? ' · reference unreachable' : ''}</p>
  ${shot ? `<img class="shot" src="${shot}" alt="Rendered output for ${esc(p.name)}" loading="lazy">
  <p class="shot-cap">${esc(p.evidence)} · captured ${esc(shotAge ? shotAge.toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : 'unknown')}</p>` : ''}
  ${p.evidence && !shot ? `<p class="shot-cap warn">evidence named but not found on disk: ${esc(p.evidence)}</p>` : ''}
</article>`;
};

const blockerHtml = (b) => `<section class="blocker">
  <span class="eyebrow warn">${esc(b.severity)} · blocker</span>
  <h3>${esc(b.title)}</h3>
  <p>${esc(b.body)}</p>
  <p class="consequence"><strong>What it costs:</strong> ${esc(b.consequence)}</p>
</section>`;

const capHtml = (c) => `<li class="cap ${c.ok ? 'ok' : 'no'}">
  <span class="dot"></span>
  <span class="cap-n">${esc(c.name)}</span>
  <span class="cap-d">${esc(c.detail)}</span>
</li>`;

const html = `<title>${esc(state.run.title)} — build status</title>
<style>
  :root {
    --ground: #0e1116; --surface: #161a21; --surface-2: #1d222b; --line: #262d38;
    --ink: #eef2f7; --ink-2: #a3aebd; --ink-3: #6d7887;
    --white-light: #f4f7fa; --no-lift: #d6453f; --unlit: #39414e; --active: #e0c341;
    --accent: #4f86c6;
    --radius: 10px;
  }
  @media (prefers-color-scheme: light) {
    :root {
      --ground: #f2f4f7; --surface: #ffffff; --surface-2: #f7f9fb; --line: #dde3ea;
      --ink: #131820; --ink-2: #4d5865; --ink-3: #78838f;
      --white-light: #2b333d; --unlit: #c6ced8; --accent: #2f6098;
    }
  }
  :root[data-theme="dark"] {
    --ground: #0e1116; --surface: #161a21; --surface-2: #1d222b; --line: #262d38;
    --ink: #eef2f7; --ink-2: #a3aebd; --ink-3: #6d7887;
    --white-light: #f4f7fa; --unlit: #39414e; --accent: #4f86c6;
  }
  :root[data-theme="light"] {
    --ground: #f2f4f7; --surface: #ffffff; --surface-2: #f7f9fb; --line: #dde3ea;
    --ink: #131820; --ink-2: #4d5865; --ink-3: #78838f;
    --white-light: #2b333d; --unlit: #c6ced8; --accent: #2f6098;
  }

  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--ground); color: var(--ink);
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.5; -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 44rem; margin: 0 auto; padding: 1.25rem 1rem 4rem; display: flex; flex-direction: column; gap: 1.5rem; }

  .eyebrow {
    display: block; font-size: .6875rem; letter-spacing: .12em; text-transform: uppercase;
    font-weight: 700; color: var(--ink-3); margin-bottom: .25rem;
  }
  .eyebrow.warn { color: var(--no-lift); }

  header.run h1 {
    margin: .15rem 0 .2rem; font-size: clamp(1.6rem, 6vw, 2.1rem); font-weight: 800;
    letter-spacing: -.02em; text-wrap: balance;
  }
  header.run .sub { margin: 0; color: var(--ink-2); font-size: .95rem; }

  .scoreboard {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: .5rem;
    background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: .875rem;
  }
  .sb { display: flex; flex-direction: column; gap: .15rem; }
  .sb b {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 1.5rem; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1.1;
  }
  .sb span { font-size: .6875rem; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); }

  .shot-cap {
    margin: .35rem 0 0; font-size: .6875rem; color: var(--ink-3);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    overflow-wrap: anywhere;
  }
  .shot-cap.warn { color: var(--no-lift); }

  .lights { display: inline-flex; gap: .28rem; margin-left: auto; flex: 0 0 auto; }
  .lt { width: .68rem; height: .68rem; border-radius: 50%; display: block; border: 1.5px solid transparent; }
  .lt-w { background: var(--white-light); }
  .lt-r { background: var(--no-lift); }
  .lt-o { background: var(--unlit); }
  .lt-h { background: transparent; border-color: var(--unlit); }
  .lt-p { background: var(--active); animation: breathe 1.6s ease-in-out infinite; }
  .lt-p:nth-child(2) { animation-delay: .2s; }
  .lt-p:nth-child(3) { animation-delay: .4s; }
  @keyframes breathe { 0%, 100% { opacity: .3; } 50% { opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { .lt-p { animation: none; opacity: .8; } }

  .blocker {
    background: var(--surface); border: 1px solid var(--line); border-left: 3px solid var(--no-lift);
    border-radius: var(--radius); padding: 1rem;
  }
  .blocker h3 { margin: .1rem 0 .5rem; font-size: 1.05rem; letter-spacing: -.01em; text-wrap: balance; }
  .blocker p { margin: 0 0 .6rem; color: var(--ink-2); font-size: .9rem; }
  .blocker p:last-child { margin-bottom: 0; }
  .consequence { color: var(--ink-2); }
  .consequence strong { color: var(--ink); }

  .caps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: .1rem; }
  .cap { display: grid; grid-template-columns: auto auto 1fr; align-items: baseline; gap: .5rem; padding: .4rem 0; border-bottom: 1px solid var(--line); font-size: .875rem; }
  .cap:last-child { border-bottom: 0; }
  .cap .dot { width: .5rem; height: .5rem; border-radius: 50%; align-self: center; }
  .cap.ok .dot { background: var(--white-light); }
  .cap.no .dot { background: var(--no-lift); }
  .cap-n { font-weight: 600; }
  .cap-d { color: var(--ink-3); font-size: .8125rem; text-align: right; }

  .piece {
    background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius);
    padding: .875rem 1rem; display: flex; flex-direction: column; gap: .45rem;
  }
  .piece[data-tone="active"] { border-color: color-mix(in oklab, var(--active) 45%, var(--line)); }
  .piece[data-tone="bad"] { border-left: 3px solid var(--no-lift); }
  .piece-h { display: flex; align-items: center; gap: .55rem; }
  .piece-h h3 { margin: 0; font-size: 1rem; font-weight: 650; letter-spacing: -.01em; }
  .pid {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: .6875rem; font-weight: 700; color: var(--accent);
    background: var(--surface-2); border: 1px solid var(--line);
    padding: .1rem .35rem; border-radius: 4px; letter-spacing: .04em;
  }
  .bar, .note, .verdict { margin: 0; font-size: .85rem; color: var(--ink-2); }
  .note { color: var(--ink-3); }
  .verdict {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: .75rem; color: var(--ink-3); letter-spacing: .02em;
  }
  .shot {
    max-width: 100%; width: 170px; border: 1px solid var(--line); border-radius: 6px;
    image-rendering: pixelated; align-self: flex-start; margin-top: .3rem;
  }

  h2.sec { margin: 0 0 -.5rem; font-size: .8125rem; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-3); font-weight: 700; }
  .pieces { display: flex; flex-direction: column; gap: .6rem; }
  footer { color: var(--ink-3); font-size: .78rem; border-top: 1px solid var(--line); padding-top: .9rem; }
  footer code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
</style>

<div class="wrap">
  <header class="run">
    <span class="eyebrow">Wave ${esc(state.run.wave)} · ${esc(state.run.waveName)}</span>
    <h1>${esc(state.run.title)}</h1>
    <p class="sub">${esc(state.run.subtitle)} · updated ${esc(new Date().toISOString().replace('T', ' ').slice(0, 16))} UTC</p>
  </header>

  <div class="scoreboard">
    <div class="sb"><b>${judged}/${state.pieces.length}</b><span>Called good</span></div>
    <div class="sb"><b>${counts.building ?? 0}</b><span>On platform</span></div>
    <div class="sb"><b>${unjudgeable}</b><span>Unjudgeable here</span></div>
  </div>

  ${state.blockers.map(blockerHtml).join('\n')}

  <section>
    <h2 class="sec">Run capabilities</h2>
    <ul class="caps">${state.capabilities.map(capHtml).join('')}</ul>
  </section>

  <section>
    <h2 class="sec">Pieces</h2>
    <div class="pieces">${state.pieces.map(pieceRow).join('\n')}</div>
  </section>

  <footer>
    Three lights per piece, read like a judges' panel — majority carries. Hollow lights mean the
    reference needed to make the call cannot be reached from this sandbox, so the bar is reported
    unverifiable rather than passed. Regenerate with <code>node tools/progress.mjs</code>.
  </footer>
</div>
`;

await writeFile(out, html, 'utf8');
console.log(`wrote ${out} (${(html.length / 1024).toFixed(1)} kB, ${shots.size} screenshot(s) inlined)`);
