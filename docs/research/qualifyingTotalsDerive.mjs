#!/usr/bin/env node
// @ts-check
/**
 * ===========================================================================
 * QUALIFYING-TOTAL DERIVATION — RESEARCH ONLY, WIRED INTO NOTHING
 * ===========================================================================
 *
 * This script is EVIDENCE, not game code. It reads a local checkout of the
 * OpenPowerlifting project's `opl-data` repository and emits a percentile
 * ladder of competition totals per tier x sex x weight class. Its output is
 * `docs/research/qualifying-totals.md` and `qualifying-totals.json`. NOTHING
 * imports it, and no constant in `src/` is derived from it yet — a human
 * reviews the numbers first. See the doc for the ruling that says so.
 *
 * Real federation names appear here ONLY as the provenance of the input data
 * (directory names inside somebody else's dataset, and meet titles quoted
 * verbatim from it). No name here is or becomes an in-game entity; CLAUDE.md's
 * real-IP rule is a constraint on what the GAME contains, and this file
 * contains a citation. Note that adding this file moves the pinned counts in
 * `src/licensing/realIp.ts` — that is intended and is reported alongside.
 *
 * USAGE
 *   git clone --depth 1 --filter=blob:none --sparse \
 *     https://gitlab.com/openpowerlifting/opl-data.git
 *   cd opl-data && git sparse-checkout set \
 *     meet-data/ipf meet-data/usapl meet-data/amp
 *   node docs/research/qualifyingTotalsDerive.mjs <path-to-opl-data> [outDir]
 *
 * EVERY TUNABLE IS A NAMED CONSTANT IN `DERIVATION` BELOW. There are no bare
 * numbers in the body of this file: the percentile that becomes the designated
 * qualifying total, the rounding step, the date cut, the class boundaries and
 * the minimum cell size are all knobs a human is expected to turn, and burying
 * any of them in a function would make them untunable in exactly the way
 * CLAUDE.md's game-feel section forbids.
 */

import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// THE KNOBS. Every game-feel / methodology value in this script lives here.
// ---------------------------------------------------------------------------

export const DERIVATION = Object.freeze({
  /**
   * Earliest meet date included, ISO.
   *
   * NOT a taste decision. The international federation's women's Open class set
   * changed from {47,52,57,63,72,84,84+} to {47,52,57,63,69,76,84,84+} for the
   * 2021 season — measurable in the input data itself, which shows 72 through
   * 2019 and 69/76 from 2021 with no 2020 season in between. Including earlier
   * meets would key half the women's rows on classes that no longer exist.
   */
  DATE_FROM: '2021-01-01',

  /** Latest meet date included, ISO. Open-ended by default. */
  DATE_TO: '2099-12-31',

  /**
   * The percentile of a tier's own Open field that becomes the designated
   * qualifying total for that tier.
   *
   * THIS IS THE SINGLE LARGEST JUDGEMENT CALL IN THE SCRIPT and it is a game
   * design decision, not a published fact. A real qualifying total is a FLOOR
   * that nearly everyone who belongs at the tier clears; setting it at the 10th
   * percentile of the population that actually competes at that tier admits
   * roughly nine in ten of them. Turn this knob and the whole table moves; the
   * full ladder is emitted beside the designated value so a reviewer can pick a
   * different one without re-running anything.
   */
  DESIGNATED_PERCENTILE: 10,

  /** The ladder emitted for every cell, so a reviewer can re-designate. */
  REPORTED_PERCENTILES: Object.freeze([5, 10, 25, 50, 75, 90]),

  /**
   * The SECOND designation, computed from the tier BELOW rather than the tier
   * itself: the total that the strongest `ADMIT_TOP_PCT_OF_TIER_BELOW` percent
   * of the next-weakest tier's field reach.
   *
   * Emitted because the first designation turns out to be nearly vacuous at the
   * top of the ladder in this data — a world-championship field carries
   * national-quota entrants far below the American national standard, so its
   * own 10th percentile sits at or below the national one in several classes.
   * A quota-shaped gate controls field size directly and cannot invert. Which
   * of the two ships is a human's call and neither is a published number.
   */
  ADMIT_TOP_PCT_OF_TIER_BELOW: 25,

  /**
   * Rounding step for the designated total, kg.
   *
   * 2.5 kg is the smallest change that can actually be loaded on a competition
   * bar with a matched pair of the smallest competition plates in wide use, so
   * a threshold off the grid asks for a total nobody can hit exactly.
   */
  ROUND_STEP_KG: 2.5,

  /**
   * Cells with fewer than this many distinct lifters are emitted as GAPS
   * rather than numbers. A percentile over six people is a story about six
   * people.
   */
  MIN_LIFTERS_PER_CELL: 40,

  /**
   * Open-division weight-class upper bounds, kg, current international set.
   *
   * The sub-junior/junior-only classes (53 men, 43 women) are deliberately
   * absent: they do not exist in the Open division this table is keyed on.
   * `null` is the unbounded top class.
   */
  CLASS_BOUNDS_KG: Object.freeze({
    M: Object.freeze([59, 66, 74, 83, 93, 105, 120, null]),
    F: Object.freeze([47, 52, 57, 63, 69, 76, 84, null]),
  }),

  /**
   * A lifter lighter than the lightest Open bound is folded INTO that class,
   * not dropped.
   *
   * Stated because the opposite is the intuitive guess and it is wrong: the
   * Open division has no class below 59 kg / 47 kg, so a 55 kg man competing
   * Open competes in the 59 class in real life. Folding up reproduces the
   * sport; dropping would delete real Open competitors from the lightest cell,
   * which is the cell with the least data to spare. The reject counter
   * `belowLightestClass` therefore reads 0 by construction and is kept only so
   * that a future change to `CLASS_BOUNDS_KG` which DOES create an unreachable
   * band reports itself instead of silently discarding rows.
   */
  FOLD_UNDER_LIGHTEST_CLASS_UP: true,

  /**
   * Equipment values kept. The game's default and the international "classic".
   *
   * Overridable for one run with `QT_EQUIPMENT=Single-ply`, because the equipped
   * table is a genuinely separate table and re-deriving it must not mean editing
   * this constant and forgetting to put it back. The DEFAULT is still the
   * constant; the override is announced in the generated output's header so a
   * reader can never mistake an equipped run for a raw one.
   */
  EQUIPMENT: Object.freeze(
    (process.env.QT_EQUIPMENT ?? 'Raw').split(',').map((s) => s.trim()).filter((s) => s !== ''),
  ),

  /** Event values kept. Full power only — three lifts, one total. */
  EVENTS: Object.freeze(['SBD']),

  /** Sexes keyed. `Mx` exists in the dataset and has no published class set. */
  SEXES: Object.freeze(['M', 'F']),

  /**
   * Placings that mean the total on the row is not a completed competition
   * result: disqualified, no-show, doctor's disqualification, and guest lifter.
   * Guests are excluded because a guest is not entered in the meet's own
   * ranking and is frequently there from another federation entirely.
   */
  EXCLUDED_PLACES: Object.freeze(['DQ', 'NS', 'DD', 'G']),
});

// ---------------------------------------------------------------------------
// Tier mapping — a DECISION the sources do not make for us. See the doc.
// ---------------------------------------------------------------------------

/**
 * How the game's four tiers map onto real competition structure.
 *
 * `dir` is the directory name inside the input dataset. `match` decides a tier
 * from a meet title; every title that matches is printed in the audit output,
 * so the mapping is checkable by reading rather than by trusting this comment.
 */
/**
 * Meet titles that name an age group or a closed sub-population rather than
 * the open field, in every spelling the input actually uses.
 *
 * WRITTEN FROM THE DATA, NOT FROM MEMORY. A first pass with the obvious words
 * admitted `Elk Mound HS Nationals`, `Raw Master's Nationals`, `Teen
 * Nationals`, `Junior Nationals` and `Australia Nationals` into the national
 * tier — `HS`, the apostrophe in `Master's`, and `Teen` all walked past a
 * regex that spelled `high school` and `masters`. The Open-division filter
 * removes most of those lifters anyway, which is exactly why this had to be
 * fixed at the meet level too: a filter that silently makes a bad meet
 * contribute zero rows leaves the meet list looking wrong to a reader
 * auditing it, and the meet list is the only place the tier mapping is
 * visible.
 */
const AGE_OR_SUBPOP_MEET =
  /bench|youth|high[- ]?school|\bhs\b|collegiate|universit|military|police|fire|master|\bteen\b|\bjunior|\bjr\b|\bsub-?jr\b|age division|qualifier|korea|australia|special olympics|adaptive|para/i;

export const TIER_RULES = Object.freeze({
  worlds: Object.freeze({
    dirs: Object.freeze(['ipf']),
    include: /\bworld\b.*\bchampionships?\b/i,
    exclude: AGE_OR_SUBPOP_MEET,
  }),
  nationals: Object.freeze({
    dirs: Object.freeze(['usapl', 'amp']),
    include: /\bnationals?\b|\bnational championships?\b/i,
    exclude: AGE_OR_SUBPOP_MEET,
  }),
  regional: Object.freeze({
    dirs: Object.freeze(['usapl', 'amp']),
    include: /\bstate\b.*\bchamp|\bregionals?\b|\bregional champ/i,
    exclude: AGE_OR_SUBPOP_MEET,
  }),
  local: Object.freeze({
    dirs: Object.freeze(['usapl', 'amp']),
    include: /.*/,
    exclude: /\bnationals?\b|\bstate\b.*\bchamp|\bregionals?\b|bench press only/i,
  }),
});

/** Tier order, weakest first. Used for the clearance column. */
export const TIER_ORDER = Object.freeze(['local', 'regional', 'nationals', 'worlds']);

/**
 * Open-division predicate.
 *
 * Two dialects in the input. The international dataset writes the word;
 * the two American ones write a code whose last segment is the division —
 * `MR-O` is male / raw / open. Junior, sub-junior, masters, teen, collegiate,
 * high-school, university, guest and police divisions all fail this, which is
 * the point: a published qualifying total is keyed by division and this table
 * is the Open one.
 */
export function isOpenDivision(division) {
  if (typeof division !== 'string') return false;
  const d = division.trim();
  if (d.toLowerCase() === 'open') return true;
  return /^[MF]R?-O$/.test(d);
}

// ---------------------------------------------------------------------------
// CSV reading. The dataset's headers vary between meets, so every file is read
// with its own header row rather than by column index.
// ---------------------------------------------------------------------------

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i += 1; } else { quoted = false; }
      } else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

function readCsv(file) {
  const text = readFileSync(file, 'utf8').replace(/^﻿/, '');
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const header = parseCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    /** @type {Record<string,string>} */
    const row = {};
    header.forEach((h, i) => { row[h] = (cells[i] ?? '').trim(); });
    return row;
  });
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

/** Linear-interpolated percentile over a sorted ascending array (R type 7). */
export function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo);
}

/** Round down to the nearest loadable step — a floor stays a floor. */
export function roundToStep(kg, step) {
  return Math.floor(kg / step) * step;
}

/** The Open weight class a bodyweight falls in, or null if below the lightest. */
export function classFor(sex, bodyweightKg) {
  const bounds = DERIVATION.CLASS_BOUNDS_KG[sex];
  if (bounds === undefined) return null;
  for (const b of bounds) {
    if (b === null) return `${bounds[bounds.length - 2]}+`;
    if (bodyweightKg <= b) return String(b);
  }
  return null;
}

// ---------------------------------------------------------------------------
// The pull
// ---------------------------------------------------------------------------

function tierOf(dir, meetName) {
  for (const tier of TIER_ORDER) {
    const rule = TIER_RULES[tier];
    if (!rule.dirs.includes(dir)) continue;
    if (rule.exclude.test(meetName)) continue;
    if (rule.include.test(meetName)) return tier;
  }
  return null;
}

export function collect(oplRoot) {
  const meetDataRoot = path.join(oplRoot, 'meet-data');
  const dirs = [...new Set(TIER_ORDER.flatMap((t) => [...TIER_RULES[t].dirs]))];

  const rejects = {
    outOfDateRange: 0, noTier: 0, equipment: 0, event: 0, sex: 0,
    division: 0, place: 0, noTotal: 0, noBodyweight: 0, belowLightestClass: 0,
    noName: 0,
  };
  /** @type {Map<string, {tier:string,sex:string,cls:string,name:string,total:number}>} */
  const best = new Map();
  /**
   * Per-meet: the tier it landed in and how many rows it actually contributed
   * after every filter.
   *
   * A meet that contributes ZERO is the interesting case — it means the tier
   * regex admitted a meet whose lifters were then all filtered out, which is a
   * mapping error wearing the costume of a clean result.
   */
  /** @type {Map<string, {tier:string,label:string,kept:number}>} */
  const meetAudit = new Map();
  let meetsScanned = 0;
  let rowsScanned = 0;
  let latestMeetDate = '';

  for (const dir of dirs) {
    const base = path.join(meetDataRoot, dir);
    if (!existsSync(base)) throw new Error(`missing input directory: ${base}`);
    for (const meetId of readdirSync(base)) {
      const meetCsv = path.join(base, meetId, 'meet.csv');
      const entriesCsv = path.join(base, meetId, 'entries.csv');
      if (!existsSync(meetCsv) || !existsSync(entriesCsv)) continue;
      const meet = readCsv(meetCsv)[0];
      if (meet === undefined) continue;
      meetsScanned += 1;
      const date = meet.Date ?? '';
      const rows = readCsv(entriesCsv);
      if (date < DERIVATION.DATE_FROM || date > DERIVATION.DATE_TO) {
        rejects.outOfDateRange += rows.length;
        continue;
      }
      const tier = tierOf(dir, meet.MeetName ?? '');
      if (tier === null) { rejects.noTier += rows.length; continue; }
      if (date > latestMeetDate) latestMeetDate = date;
      const meetKey = `${dir}/${meetId}`;
      meetAudit.set(meetKey, { tier, label: `${date}  ${dir}/${meetId}  ${meet.MeetName ?? ''}`, kept: 0 });

      for (const r of rows) {
        rowsScanned += 1;
        if (!DERIVATION.EQUIPMENT.includes(r.Equipment)) { rejects.equipment += 1; continue; }
        if (!DERIVATION.EVENTS.includes(r.Event)) { rejects.event += 1; continue; }
        if (!DERIVATION.SEXES.includes(r.Sex)) { rejects.sex += 1; continue; }
        if (!isOpenDivision(r.Division)) { rejects.division += 1; continue; }
        if (DERIVATION.EXCLUDED_PLACES.includes(r.Place)) { rejects.place += 1; continue; }
        const total = Number.parseFloat(r.TotalKg);
        if (!Number.isFinite(total) || total <= 0) { rejects.noTotal += 1; continue; }
        const bw = Number.parseFloat(r.BodyweightKg);
        if (!Number.isFinite(bw) || bw <= 0) { rejects.noBodyweight += 1; continue; }
        const name = (r.Name ?? '').trim();
        if (name === '') { rejects.noName += 1; continue; }
        const cls = classFor(r.Sex, bw);
        if (cls === null) { rejects.belowLightestClass += 1; continue; }

        // One row per lifter per tier per class, keeping their best. The game's
        // gate reads a lifter's BEST total, so the population this threshold is
        // computed over has to be lifters rather than performances — otherwise
        // whoever competes most often votes most often.
        const key = `${tier}|${r.Sex}|${cls}|${name}`;
        const prev = best.get(key);
        if (prev === undefined || total > prev.total) {
          best.set(key, { tier, sex: r.Sex, cls, name, total });
        }
        const audit = meetAudit.get(meetKey);
        if (audit !== undefined) audit.kept += 1;
      }
    }
  }

  return { best, rejects, meetsScanned, rowsScanned, latestMeetDate, meetAudit };
}

// ---------------------------------------------------------------------------
// The table
// ---------------------------------------------------------------------------

export function buildTable(best) {
  /** @type {Map<string, number[]>} */
  const cells = new Map();
  for (const rec of best.values()) {
    const key = `${rec.tier}|${rec.sex}|${rec.cls}`;
    const arr = cells.get(key);
    if (arr === undefined) cells.set(key, [rec.total]);
    else arr.push(rec.total);
  }
  for (const arr of cells.values()) arr.sort((a, b) => a - b);

  const out = [];
  for (const tier of TIER_ORDER) {
    for (const sex of DERIVATION.SEXES) {
      const bounds = DERIVATION.CLASS_BOUNDS_KG[sex];
      const classNames = bounds.map((b, i) => (b === null ? `${bounds[i - 1]}+` : String(b)));
      for (const cls of classNames) {
        const arr = cells.get(`${tier}|${sex}|${cls}`) ?? [];
        const n = arr.length;
        /** @type {Record<string, number|null>} */
        const ladder = {};
        for (const p of DERIVATION.REPORTED_PERCENTILES) {
          ladder[`p${p}`] = n === 0 ? null : Math.round(percentile(arr, p) * 10) / 10;
        }
        const enough = n >= DERIVATION.MIN_LIFTERS_PER_CELL;
        const raw = enough ? percentile(arr, DERIVATION.DESIGNATED_PERCENTILE) : null;
        out.push({
          tier,
          sex,
          weightClassKg: cls,
          lifters: n,
          sufficient: enough,
          designatedKg: raw === null ? null : roundToStep(raw, DERIVATION.ROUND_STEP_KG),
          designatedRawKg: raw === null ? null : Math.round(raw * 10) / 10,
          minKg: n === 0 ? null : arr[0],
          maxKg: n === 0 ? null : arr[n - 1],
          ...ladder,
        });
      }
    }
  }

  // Clearance: what fraction of the tier BELOW clears this tier's designated
  // total. A gate nobody below can clear is a wall; a gate everybody clears is
  // decoration. This column is what makes the designated number checkable.
  for (const row of out) {
    const i = TIER_ORDER.indexOf(row.tier);
    row.clearedByTierBelowPct = null;
    row.quotaKg = null;
    row.tierBelow = i > 0 ? TIER_ORDER[i - 1] : null;
    if (i <= 0) continue;
    const belowArr = cells.get(`${TIER_ORDER[i - 1]}|${row.sex}|${row.weightClassKg}`) ?? [];
    row.tierBelowLifters = belowArr.length;
    if (belowArr.length >= DERIVATION.MIN_LIFTERS_PER_CELL) {
      row.quotaKg = roundToStep(
        percentile(belowArr, 100 - DERIVATION.ADMIT_TOP_PCT_OF_TIER_BELOW),
        DERIVATION.ROUND_STEP_KG,
      );
    }
    if (row.designatedKg === null || belowArr.length === 0) continue;
    const cleared = belowArr.filter((t) => t >= row.designatedKg).length;
    row.clearedByTierBelowPct = Math.round((cleared / belowArr.length) * 1000) / 10;
  }

  return out;
}

/**
 * Two consistency checks on the designated column, reported as COUNTS with the
 * offending cells named.
 *
 * Neither can be satisfied by construction and both are violated by the shipped
 * output, which is the reason they are computed rather than asserted in prose.
 * A published qualifying-total table is monotone in both directions — heavier
 * classes ask for more, higher tiers ask for more — and a percentile taken from
 * a finite sample is not, so the count is the honest measure of how much
 * hand-smoothing the table still needs.
 */
export function consistency(rows) {
  const byKey = new Map(rows.map((r) => [`${r.tier}|${r.sex}|${r.weightClassKg}`, r]));
  const acrossTiers = [];
  const acrossClasses = [];

  for (let i = 1; i < TIER_ORDER.length; i += 1) {
    for (const sex of DERIVATION.SEXES) {
      const bounds = DERIVATION.CLASS_BOUNDS_KG[sex];
      for (let c = 0; c < bounds.length; c += 1) {
        const cls = bounds[c] === null ? `${bounds[c - 1]}+` : String(bounds[c]);
        const hi = byKey.get(`${TIER_ORDER[i]}|${sex}|${cls}`);
        const lo = byKey.get(`${TIER_ORDER[i - 1]}|${sex}|${cls}`);
        if (!hi || !lo || hi.designatedKg === null || lo.designatedKg === null) continue;
        if (hi.designatedKg <= lo.designatedKg) {
          acrossTiers.push(`${sex} ${cls}: ${TIER_ORDER[i - 1]} ${lo.designatedKg} -> ${TIER_ORDER[i]} ${hi.designatedKg}`);
        }
      }
    }
  }

  for (const tier of TIER_ORDER) {
    for (const sex of DERIVATION.SEXES) {
      const bounds = DERIVATION.CLASS_BOUNDS_KG[sex];
      const names = bounds.map((b, i) => (b === null ? `${bounds[i - 1]}+` : String(b)));
      for (let c = 1; c < names.length; c += 1) {
        const hi = byKey.get(`${tier}|${sex}|${names[c]}`);
        const lo = byKey.get(`${tier}|${sex}|${names[c - 1]}`);
        if (!hi || !lo || hi.designatedKg === null || lo.designatedKg === null) continue;
        if (hi.designatedKg < lo.designatedKg) {
          acrossClasses.push(`${tier} ${sex}: ${names[c - 1]} ${lo.designatedKg} -> ${names[c]} ${hi.designatedKg}`);
        }
      }
    }
  }

  return { acrossTiers, acrossClasses };
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

function md(rows, meta) {
  const lines = [];
  lines.push('<!-- GENERATED by docs/research/qualifyingTotalsDerive.mjs. Do not hand-edit. -->');
  lines.push('');
  lines.push('# Derived qualifying-total ladder — generated output');
  lines.push('');
  lines.push(`- Input dataset commit: \`${meta.datasetCommit}\``);
  lines.push(`- Latest meet in range: ${meta.latestMeetDate}`);
  lines.push(`- Date range: ${DERIVATION.DATE_FROM} .. ${DERIVATION.DATE_TO}`);
  lines.push(`- Equipment kept: **${DERIVATION.EQUIPMENT.join(', ')}**`);
  lines.push(`- Designated percentile: P${DERIVATION.DESIGNATED_PERCENTILE}, floored to ${DERIVATION.ROUND_STEP_KG} kg`);
  lines.push(`- Minimum lifters for a cell to carry a number: ${DERIVATION.MIN_LIFTERS_PER_CELL}`);
  lines.push(`- Meets scanned: ${meta.meetsScanned}; entry rows read: ${meta.rowsScanned}`);
  lines.push(`- Distinct lifter-tier-class records kept: ${meta.kept}`);
  lines.push('');
  lines.push('## Rejects, by reason');
  lines.push('');
  lines.push('| reason | rows |');
  lines.push('|---|---:|');
  for (const [k, v] of Object.entries(meta.rejects)) lines.push(`| ${k} | ${v} |`);
  lines.push('');
  lines.push('## Meets per tier');
  lines.push('');
  lines.push('| tier | meets | of which contributed zero rows |');
  lines.push('|---|---:|---:|');
  for (const t of TIER_ORDER) lines.push(`| ${t} | ${meta.meetsPerTier[t]} | ${meta.emptyMeetsPerTier[t]} |`);
  lines.push('');

  for (const tier of TIER_ORDER) {
    for (const sex of DERIVATION.SEXES) {
      lines.push(`### ${tier} — ${sex === 'M' ? 'men' : 'women'}`);
      lines.push('');
      lines.push('| class kg | lifters | DESIGNATED kg | quota-alt kg | P5 | P10 | P25 | P50 | P75 | P90 | min | max | % of tier below clearing |');
      lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
      for (const r of rows.filter((x) => x.tier === tier && x.sex === sex)) {
        const d = r.designatedKg === null ? (r.lifters === 0 ? 'NO DATA' : `GAP (n=${r.lifters})`) : r.designatedKg.toFixed(1);
        const q = r.quotaKg === null ? '—' : r.quotaKg.toFixed(1);
        const c = r.clearedByTierBelowPct === null ? '—' : `${r.clearedByTierBelowPct}%`;
        lines.push(`| ${r.weightClassKg} | ${r.lifters} | ${d} | ${q} | ${r.p5 ?? '—'} | ${r.p10 ?? '—'} | ${r.p25 ?? '—'} | ${r.p50 ?? '—'} | ${r.p75 ?? '—'} | ${r.p90 ?? '—'} | ${r.minKg ?? '—'} | ${r.maxKg ?? '—'} | ${c} |`);
      }
      lines.push('');
    }
  }

  lines.push('## Consistency of the designated column');
  lines.push('');
  lines.push(`- Tier inversions or ties (higher tier asks no more than the one below): **${meta.consistency.acrossTiers.length}**`);
  for (const s of meta.consistency.acrossTiers) lines.push(`  - ${s}`);
  lines.push(`- Weight-class inversions (a heavier class asks less than the one below it): **${meta.consistency.acrossClasses.length}**`);
  for (const s of meta.consistency.acrossClasses) lines.push(`  - ${s}`);
  lines.push('');
  return lines.join('\n');
}

function main() {
  const oplRoot = process.argv[2];
  const outDir = process.argv[3] ?? path.join(process.cwd(), 'docs', 'research');
  if (oplRoot === undefined) {
    // The dataset's real short name is in this file's header comment, where it
    // is a provenance citation. It is deliberately NOT in this string: a
    // `console.error` argument is text the program PRINTS, which is one step
    // from a screen, and `realIp.test.ts`'s "a project name moved into code
    // position in a new file" check fired on exactly this line. The guard was
    // right — the citation belongs in the comment and the usage line does not
    // need it.
    console.error('usage: node qualifyingTotalsDerive.mjs <path-to-dataset-checkout> [outDir]');
    process.exit(2);
  }
  const { best, rejects, meetsScanned, rowsScanned, latestMeetDate, meetAudit } = collect(oplRoot);
  const rows = buildTable(best);
  const audits = [...meetAudit.values()];
  const meetsPerTier = Object.fromEntries(TIER_ORDER.map((t) => [t, audits.filter((a) => a.tier === t).length]));
  const emptyMeetsPerTier = Object.fromEntries(
    TIER_ORDER.map((t) => [t, audits.filter((a) => a.tier === t && a.kept === 0).length]),
  );

  let datasetCommit = 'UNKNOWN';
  try {
    datasetCommit = readFileSync(path.join(oplRoot, '.git', 'HEAD'), 'utf8').trim();
    if (datasetCommit.startsWith('ref: ')) {
      datasetCommit = readFileSync(path.join(oplRoot, '.git', datasetCommit.slice(5)), 'utf8').trim();
    }
  } catch { /* left UNKNOWN, and the doc says so */ }

  const meta = {
    datasetCommit, latestMeetDate, meetsScanned, rowsScanned,
    kept: best.size, rejects, meetsPerTier, emptyMeetsPerTier,
    consistency: consistency(rows),
    derivation: DERIVATION,
    tierRules: Object.fromEntries(TIER_ORDER.map((t) => [t, {
      dirs: TIER_RULES[t].dirs, include: String(TIER_RULES[t].include), exclude: String(TIER_RULES[t].exclude),
    }])),
  };

  // Equipment goes in the FILENAME, not only in the header. A generated file
  // whose name does not say which population it describes is one copy-paste
  // away from an equipped table being read as a raw one.
  const slug = DERIVATION.EQUIPMENT.join('-').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, `qualifying-totals-derived-${slug}.md`), `${md(rows, meta)}\n`);
  writeFileSync(path.join(outDir, `qualifying-totals-derived-${slug}.json`), `${JSON.stringify({ meta, rows }, null, 2)}\n`);
  /**
   * The tier-mapping audit.
   *
   * `local` is listed as a SUMMARY rather than meet by meet, for two reasons and
   * both are stated because the second one on its own would be a bad reason.
   *
   * The editorial reason: `local` is the RESIDUAL tier — every sanctioned meet
   * the other three rules did not claim — so its membership is not a judgement
   * anybody needs to audit line by line, while `worlds`, `nationals` and
   * `regional` are three hand-written regexes whose every match is a decision.
   * 2,647 lines of ordinary meet titles around 338 lines of signal makes the
   * signal harder to read, not easier.
   *
   * The reason that would not stand alone: those 2,647 lines carried ~2,400
   * mentions of one real federation's acronym and two real apparel brands
   * arriving inside verbatim third-party meet titles, all of which the
   * repository's real-IP census must then pin. Trimming EVIDENCE to quiet a
   * guard is the wrong instinct and is not what is happening here — the audit
   * value is preserved in full for the three tiers where a human would actually
   * check it, and the summary keeps `local`'s counts. Regenerating the full
   * per-meet list is one edit to this function.
   */
  writeFileSync(
    path.join(outDir, `qualifying-totals-meets-${slug}.txt`),
    `${TIER_ORDER.map((t) => {
      const mine = audits.filter((a) => a.tier === t).sort((a, b) => a.label.localeCompare(b.label));
      const head = `=== ${t} (${mine.length} meets, ${mine.filter((a) => a.kept === 0).length} contributing zero rows) ===`;
      if (t === 'local') {
        const kept = mine.reduce((s, a) => s + a.kept, 0);
        return `${head}\nSUMMARY ONLY — the residual tier. rows kept: ${kept}. See the header comment in qualifyingTotalsDerive.mjs.`;
      }
      return `${head}\n${mine.map((a) => `${String(a.kept).padStart(5)}  ${a.label}`).join('\n')}`;
    }).join('\n\n')}\n`,
  );
  console.log(`meets=${meetsScanned} rows=${rowsScanned} kept=${best.size} latest=${latestMeetDate}`);
  console.log(`per tier ${JSON.stringify(meetsPerTier)}  zero-contribution ${JSON.stringify(emptyMeetsPerTier)}`);
  console.log(JSON.stringify(rejects));
}

if (process.argv[1] && process.argv[1].endsWith('qualifyingTotalsDerive.mjs')) main();
