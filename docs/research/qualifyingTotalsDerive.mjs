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
 * `docs/research/qualifying-totals-derived-*.md` / `.json`. NOTHING imports it,
 * and no constant in `src/` is derived from it yet — a human reviews the
 * numbers first. See the doc for the ruling that says so.
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
 *
 *   # 1. regenerate the committed artifacts (raw, then equipped)
 *   node docs/research/qualifyingTotalsDerive.mjs <path-to-opl-data>
 *   QT_EQUIPMENT=Single-ply node docs/research/qualifyingTotalsDerive.mjs <path>
 *
 *   # 2. verify that every tagged number in the deliverable still holds
 *   node docs/research/qualifyingTotalsDerive.mjs <path> --check-doc
 *   QT_EQUIPMENT=Single-ply node docs/research/qualifyingTotalsDerive.mjs <path> --check-doc
 *
 *   # 3. the rejected worlds designations, runnable, into a scratch directory
 *   QT_WORLDS_METHOD=tier-field-percentile \
 *     node docs/research/qualifyingTotalsDerive.mjs <path> /tmp/qt-p10
 *
 * EXIT CODES. 0 all checks passed. 2 usage. 3 a structural check on the emitted
 * table failed (see `structuralChecks`). 4 the deliverable disagrees with a
 * freshly computed number (see `checkDoc`). A non-zero exit is the whole point:
 * a number that is printed and never compared is the failure mode CLAUDE.md
 * calls "measured, carried, displayed, never compared", and every headline
 * number in the deliverable is tagged so that this script can compare it.
 *
 * EVERY METHODOLOGY VALUE IS A NAMED CONSTANT IN `DERIVATION` BELOW — the
 * percentile that becomes the designated qualifying total, the per-tier choice
 * of designation, the quota fraction, the rounding step, the date cut, the class
 * boundaries and the minimum cell size. They are knobs a human is expected to
 * turn, and burying any of them in a function would make them untunable in
 * exactly the way CLAUDE.md's game-feel section forbids. (Scale factors inside
 * formatting helpers — `Math.round(x * 10) / 10` for a one-decimal report — are
 * not methodology and are not in that block. An earlier version of this header
 * claimed "no bare numbers in the body of this file", which was never true of
 * the formatting code and had nothing behind it.)
 */

import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// THE KNOBS. Every methodology value in this script lives here.
// ---------------------------------------------------------------------------

/**
 * The designation rules a tier's number can be computed by.
 *
 * `TIER_FIELD_PERCENTILE` — the Nth percentile of the tier's own field.
 * `TRIMMED_TIER_FIELD_PERCENTILE` — the same, after removing everyone in the
 *   tier's field who does not clear the tier below's gate. MEASURED AND
 *   REJECTED; kept runnable so the rejection can be re-checked rather than
 *   believed. See `qualifying-totals.md` §3.6.
 * `TIER_BELOW_QUOTA` — the total reached by the strongest
 *   `ADMIT_TOP_PCT_OF_TIER_BELOW` percent of the tier below's field.
 */
export const DESIGNATION_METHODS = Object.freeze({
  TIER_FIELD_PERCENTILE: 'tier-field-percentile',
  TRIMMED_TIER_FIELD_PERCENTILE: 'trimmed-tier-field-percentile',
  TIER_BELOW_QUOTA: 'tier-below-quota',
});

/**
 * How entry to a tier's field is controlled in the real sport. THIS IS THE
 * DECISION THAT DECIDES WHAT A PERCENTILE OF THAT FIELD CAN MEAN, and it is why
 * the shipped table is mixed-method.
 *
 * `open`  — anybody may enter. A percentile of this field describes who showed
 *           up. It is not a standard and nothing had to be cleared to be in it.
 * `gated` — entry requires a published qualifying total earned at an earlier
 *           meet. The field is filtered by a standard, though NOT by the total
 *           recorded at the meet itself (see `leftTailShape`, which measures
 *           that the filtering is invisible in this data).
 * `quota` — entry is by national allocation. The field is the world's best PLUS
 *           one or two entrants from every federation holding a place, so its
 *           low percentiles measure the smallest allocation rather than a
 *           standard.
 */
export const ENTRY_REGIMES = Object.freeze({ OPEN: 'open', GATED: 'gated', QUOTA: 'quota' });

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
   * The percentile of a tier's own Open field that becomes that tier's
   * designated qualifying total, where `TIER_FIELD_PERCENTILE` is the method.
   *
   * A real qualifying total is a FLOOR that nearly everyone who belongs at the
   * tier clears; setting it at the 10th percentile of the population that
   * actually competes at that tier admits roughly nine in ten of them.
   *
   * NOTE WHAT THAT LAST SENTENCE IS AND IS NOT. "Nine in ten of the tier's own
   * field clears it" is ARITHMETIC — a P10 gate is cleared by ~90% of the
   * population it was taken from, whatever the numbers are, and
   * `structuralChecks` asserts exactly that identity so it can never be
   * mistaken for a finding. The informative measurement is what fraction of the
   * TIER BELOW clears it, which is `clearedByTierBelowPct`.
   */
  DESIGNATED_PERCENTILE: 10,

  /** The ladder emitted for every cell, so a reviewer can re-designate. */
  REPORTED_PERCENTILES: Object.freeze([5, 10, 25, 50, 75, 90]),

  /**
   * Extra percentiles of the worlds field reported side by side with the
   * shipped worlds designation, so "show the numbers both ways" is a column
   * rather than a paragraph.
   */
  WORLDS_ALTERNATIVE_PERCENTILES: Object.freeze([10, 25, 50]),

  /**
   * The quota designation: the total that the strongest
   * `ADMIT_TOP_PCT_OF_TIER_BELOW` percent of the next-weakest tier's field
   * reach. Equivalently the P(100 - this) of the tier below.
   */
  ADMIT_TOP_PCT_OF_TIER_BELOW: 25,

  /**
   * WHICH DESIGNATION EACH TIER'S NUMBER IS COMPUTED BY. The table is
   * MIXED-METHOD and this is where the mixing is declared; every emitted row
   * carries its own `method` field and every emitted table marks the cells, so
   * the declaration travels with the numbers instead of living in a preamble.
   *
   * `worlds` is the odd one out and the reason is measured, not stylistic. Its
   * field is a `quota` population: 82 of the 1191 lifters in it total less than
   * their own class's nationals gate, that contaminated band is 2-14% of each
   * cell, and a P10 estimator therefore lands INSIDE it. The consequence is not
   * cosmetic — under a uniform P10 the worlds gate came out at or below the
   * nationals gate in four cells, which in a game whose tiers are a ladder is
   * the ladder inverting. Full working in `qualifying-totals.md` §3.6.
   *
   * Overridable for one run with `QT_WORLDS_METHOD=` one of
   * `DESIGNATION_METHODS`, so the rejected designations stay runnable and the
   * monotonicity check can be watched to FAIL rather than trusted to bite.
   */
  TIER_DESIGNATION: Object.freeze({
    local: DESIGNATION_METHODS.TIER_FIELD_PERCENTILE,
    regional: DESIGNATION_METHODS.TIER_FIELD_PERCENTILE,
    nationals: DESIGNATION_METHODS.TIER_FIELD_PERCENTILE,
    worlds: process.env.QT_WORLDS_METHOD ?? DESIGNATION_METHODS.TIER_BELOW_QUOTA,
  }),

  /** How entry to each tier's field is controlled. See `ENTRY_REGIMES`. */
  TIER_ENTRY_REGIME: Object.freeze({
    local: ENTRY_REGIMES.OPEN,
    regional: ENTRY_REGIMES.OPEN,
    nationals: ENTRY_REGIMES.GATED,
    worlds: ENTRY_REGIMES.QUOTA,
  }),

  /**
   * THE LADDER PROPERTY, AS A CONSTRAINT RATHER THAN AN OBSERVATION.
   *
   * With this on, a table whose designated column falls (or fails to rise) from
   * one tier to the next in any cell is a FAILED RUN — exit 3, cells named. It
   * is not repaired: raising the low cell to meet the one below it converts an
   * inversion into a TIE, and a tie is a gate that does nothing, which is the
   * defect wearing a clean shirt. `ladderReport` computes what a repair WOULD
   * move — for the shipped table and for the counterfactual one — and both are
   * emitted so the cost of the constraint is visible, but nothing applies it.
   *
   * WHAT CAN ACTUALLY FAIL THIS, so it is not mistaken for a stronger check than
   * it is: of the 48 tier-to-tier comparisons, the 16 at the nationals -> worlds
   * edge are guaranteed by construction while `worlds` uses `TIER_BELOW_QUOTA`
   * and `100 - ADMIT_TOP_PCT_OF_TIER_BELOW > DESIGNATED_PERCENTILE` — the same
   * population, a higher percentile, and flooring is monotone. The other 32 are
   * genuinely measured. Set `QT_WORLDS_METHOD=tier-field-percentile` and this
   * check fires with four named cells.
   */
  LADDER_MUST_BE_MONOTONE_ACROSS_TIERS: true,

  /**
   * Rounding step for the designated total, kg.
   *
   * 2.5 kg is the smallest change that can actually be loaded on a competition
   * bar with a matched pair of the smallest competition plates in wide use, so
   * a threshold off the grid asks for a total nobody can hit exactly.
   */
  ROUND_STEP_KG: 2.5,

  /**
   * Cells whose SOURCE POPULATION has fewer than this many distinct lifters are
   * emitted as GAPS rather than numbers. A percentile over six people is a story
   * about six people.
   *
   * "Source population" rather than "the cell" matters under the mixed method: a
   * `TIER_BELOW_QUOTA` cell is computed from the tier below, so it is the tier
   * below that has to be big enough, and the emitted `sourceLifters` says which
   * population the number was taken from.
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

  /**
   * A delegation this size or smaller in one cell is counted as a SMALL
   * delegation for the contamination diagnostic. Reported against its own base
   * rate over the whole field, because "67% of the sub-standard entrants come
   * from small delegations" means nothing until you know that 54% of ALL
   * entrants do.
   */
  SMALL_DELEGATION_MAX_ENTRANTS: 2,
});

/**
 * Markers attached to every emitted cell that needs a caveat carried with it,
 * in the generated tables AND in the deliverable's hand-written ones.
 *
 * These exist because a caveat explained in one section is a caveat that gets
 * separated from the data the first time somebody copies a table out. The
 * legend is emitted under every table that uses one.
 */
export const CELL_MARKERS = Object.freeze({
  OPEN_POPULATION: '†',
  QUOTA_METHOD: '‡',
});

/** One line of legend per marker, emitted under every table that carries it. */
export const MARKER_LEGEND = Object.freeze({
  [CELL_MARKERS.OPEN_POPULATION]:
    'DERIVED FROM AN UNGATED POPULATION. Entry to these meets is open — anybody may '
    + 'enter, nothing had to be cleared to be in this field. The number describes what '
    + 'the people who showed up totalled. IT IS NOT A QUALIFYING STANDARD and no lifter '
    + 'in it had to meet one. See qualifying-totals.md §4.2 (regional) and §4.7 (local).',
  [CELL_MARKERS.QUOTA_METHOD]:
    'MIXED METHOD: this cell is NOT the same statistic as the unmarked ones. It is the '
    + 'total reached by the strongest 25% of the tier BELOW, not a percentile of this '
    + "tier's own field, because this tier's field is filled by national quota rather "
    + 'than by standard. See qualifying-totals.md §3.6.',
});

// ---------------------------------------------------------------------------
// Tier mapping — a DECISION the sources do not make for us. See the doc.
// ---------------------------------------------------------------------------

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

/**
 * How the game's four tiers map onto real competition structure.
 *
 * `dirs` are directory names inside the input dataset. `include` decides a tier
 * from a meet title; every title that matches is printed in the audit output,
 * so the mapping is checkable by reading rather than by trusting this comment.
 */
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

/** Tier order, weakest first. Used for the clearance column and the ladder. */
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

/** One decimal, for report columns. Not a methodology value. */
function d1(x) {
  return x === null || x === undefined ? null : Math.round(x * 10) / 10;
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

/** The class names of a sex, in ascending order, `84+` style for the top one. */
export function classNamesFor(sex) {
  const bounds = DERIVATION.CLASS_BOUNDS_KG[sex];
  return bounds.map((b, i) => (b === null ? `${bounds[i - 1]}+` : String(b)));
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
  /** @type {Map<string, {tier:string,sex:string,cls:string,name:string,total:number,country:string}>} */
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
  let countryPresent = 0;
  let countryAbsent = 0;

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

        // The delegation a lifter represents. Present on the international
        // meets, which is where it is needed: it is the evidence for the claim
        // that the worlds field's low tail is quota rather than standard. Held
        // in memory only — no country, name or delegation reaches any output.
        const country = (r.Country ?? '').trim();
        if (tier === 'worlds') { if (country === '') countryAbsent += 1; else countryPresent += 1; }

        // One row per lifter per tier per class, keeping their best. The game's
        // gate reads a lifter's BEST total, so the population this threshold is
        // computed over has to be lifters rather than performances — otherwise
        // whoever competes most often votes most often.
        const key = `${tier}|${r.Sex}|${cls}|${name}`;
        const prev = best.get(key);
        if (prev === undefined || total > prev.total) {
          best.set(key, { tier, sex: r.Sex, cls, name, total, country });
        }
        const audit = meetAudit.get(meetKey);
        if (audit !== undefined) audit.kept += 1;
      }
    }
  }

  return {
    best, rejects, meetsScanned, rowsScanned, latestMeetDate, meetAudit,
    countryPresent, countryAbsent,
  };
}

// ---------------------------------------------------------------------------
// The table
// ---------------------------------------------------------------------------

/** Every kept record folded into sorted total arrays, keyed `tier|sex|class`. */
export function cellsOf(best) {
  /** @type {Map<string, number[]>} */
  const cells = new Map();
  for (const rec of best.values()) {
    const key = `${rec.tier}|${rec.sex}|${rec.cls}`;
    const arr = cells.get(key);
    if (arr === undefined) cells.set(key, [rec.total]);
    else arr.push(rec.total);
  }
  for (const arr of cells.values()) arr.sort((a, b) => a - b);
  return cells;
}

/**
 * The designated total for one cell under one method, plus which population it
 * came from — because under a mixed method "n" is ambiguous and a table that
 * prints one number for it is lying half the time.
 *
 * Returns `{ kg, sourceTier, sourceLifters, note }` with `kg === null` when the
 * source population is below `MIN_LIFTERS_PER_CELL`.
 */
function designate(method, { own, below, belowTier, belowGateKg }) {
  const enough = (arr) => arr.length >= DERIVATION.MIN_LIFTERS_PER_CELL;
  if (method === DESIGNATION_METHODS.TIER_FIELD_PERCENTILE) {
    return {
      kg: enough(own) ? roundToStep(percentile(own, DERIVATION.DESIGNATED_PERCENTILE), DERIVATION.ROUND_STEP_KG) : null,
      sourceTier: 'self',
      sourceLifters: own.length,
    };
  }
  if (method === DESIGNATION_METHODS.TIER_BELOW_QUOTA) {
    return {
      kg: enough(below)
        ? roundToStep(percentile(below, 100 - DERIVATION.ADMIT_TOP_PCT_OF_TIER_BELOW), DERIVATION.ROUND_STEP_KG)
        : null,
      sourceTier: belowTier,
      sourceLifters: below.length,
    };
  }
  if (method === DESIGNATION_METHODS.TRIMMED_TIER_FIELD_PERCENTILE) {
    const trimmed = belowGateKg === null ? [] : own.filter((t) => t >= belowGateKg);
    return {
      kg: enough(trimmed) ? roundToStep(percentile(trimmed, DERIVATION.DESIGNATED_PERCENTILE), DERIVATION.ROUND_STEP_KG) : null,
      sourceTier: 'self-trimmed',
      sourceLifters: trimmed.length,
    };
  }
  throw new Error(`unknown designation method: ${method}`);
}

export function buildTable(best) {
  const cells = cellsOf(best);
  const out = [];
  /** @type {Map<string, object>} */
  const byKey = new Map();

  // Tier order matters now: a `TIER_BELOW_QUOTA` or trimmed cell reads the tier
  // below's designated gate, so the tier below has to be built first.
  for (const tier of TIER_ORDER) {
    const i = TIER_ORDER.indexOf(tier);
    const belowTier = i > 0 ? TIER_ORDER[i - 1] : null;
    for (const sex of DERIVATION.SEXES) {
      for (const cls of classNamesFor(sex)) {
        const own = cells.get(`${tier}|${sex}|${cls}`) ?? [];
        const below = belowTier === null ? [] : (cells.get(`${belowTier}|${sex}|${cls}`) ?? []);
        const belowRow = belowTier === null ? null : byKey.get(`${belowTier}|${sex}|${cls}`);
        const belowGateKg = belowRow ? belowRow.designatedKg : null;
        const n = own.length;
        /** @type {Record<string, number|null>} */
        const ladder = {};
        for (const p of DERIVATION.REPORTED_PERCENTILES) {
          ladder[`p${p}`] = n === 0 ? null : d1(percentile(own, p));
        }

        const method = DERIVATION.TIER_DESIGNATION[tier];
        const args = { own, below, belowTier, belowGateKg };
        const chosen = designate(method, args);

        // Every candidate, always, so "the numbers both ways" is a column in
        // the generated artifact rather than a thing somebody has to re-run to
        // see. `alt*` are never used as the designated value.
        const alt = {};
        for (const p of DERIVATION.WORLDS_ALTERNATIVE_PERCENTILES) {
          alt[`altOwnFieldP${p}Kg`] = n >= DERIVATION.MIN_LIFTERS_PER_CELL
            ? roundToStep(percentile(own, p), DERIVATION.ROUND_STEP_KG) : null;
        }
        const altQuota = designate(DESIGNATION_METHODS.TIER_BELOW_QUOTA, args);
        const altTrimmed = designate(DESIGNATION_METHODS.TRIMMED_TIER_FIELD_PERCENTILE, args);

        const regime = DERIVATION.TIER_ENTRY_REGIME[tier];
        // THE MARKER FOLLOWS THE POPULATION THE NUMBER CAME FROM, not the tier
        // the number is FOR. Under a mixed method those differ: a quota cell at
        // `worlds` is computed from the nationals field, so it inherits that
        // field's entry regime and not its own tier's. Getting this backwards
        // would mark the one cell in the table that is NOT open-population and
        // leave the ones that are unmarked.
        const sourceTier = chosen.sourceTier === 'self' || chosen.sourceTier === 'self-trimmed'
          ? tier : chosen.sourceTier;
        const sourceRegime = DERIVATION.TIER_ENTRY_REGIME[sourceTier];
        const markers = [];
        if (sourceRegime === ENTRY_REGIMES.OPEN) markers.push(CELL_MARKERS.OPEN_POPULATION);
        if (method === DESIGNATION_METHODS.TIER_BELOW_QUOTA) markers.push(CELL_MARKERS.QUOTA_METHOD);

        const row = {
          tier,
          sex,
          weightClassKg: cls,
          lifters: n,
          // --- what the number IS, and what it is NOT ------------------------
          method,
          entryRegime: regime,
          sourceEntryRegime: sourceRegime,
          /**
           * MACHINE-READABLE CAVEAT. `false` means the number describes an open
           * field — who turned up — and no lifter in it had to clear anything.
           * A consumer that gates on a cell with `isQualifyingStandard: false`
           * is asserting something the data does not support.
           */
          isQualifyingStandard: sourceRegime !== ENTRY_REGIMES.OPEN,
          openEntryPopulation: sourceRegime === ENTRY_REGIMES.OPEN,
          markers: markers.join(''),
          populationCaveat: markers.map((m) => MARKER_LEGEND[m]).join(' '),
          // --- the designated value -----------------------------------------
          designatedKg: chosen.kg,
          designatedFromTier: chosen.sourceTier === 'self' ? tier : chosen.sourceTier,
          sourceLifters: chosen.sourceLifters,
          sufficient: chosen.kg !== null,
          // --- alternatives, always computed --------------------------------
          ...alt,
          altQuotaKg: altQuota.kg,
          altQuotaFromLifters: altQuota.sourceLifters,
          altTrimmedP10Kg: altTrimmed.kg,
          altTrimmedLifters: altTrimmed.sourceLifters,
          // --- the raw shape of the cell ------------------------------------
          minKg: n === 0 ? null : own[0],
          maxKg: n === 0 ? null : own[n - 1],
          ...ladder,
          tierBelow: belowTier,
          tierBelowLifters: below.length,
        };

        // Clearance. What fraction of the TIER BELOW already clears this gate is
        // the informative one — a gate everybody below clears is decoration.
        // What fraction of the tier's OWN field clears it is arithmetic for a
        // percentile method, and `structuralChecks` pins it as such so nobody
        // reads it as evidence.
        const clearedBelow = (kg) => (kg === null || below.length === 0
          ? null : d1((below.filter((t) => t >= kg).length / below.length) * 100));
        row.clearedByTierBelowPct = clearedBelow(row.designatedKg);
        // ...and the same measure for every candidate designation, so the
        // "both ways" comparison is data rather than a second script.
        for (const p of DERIVATION.WORLDS_ALTERNATIVE_PERCENTILES) {
          row[`clearanceOfOwnP${p}Pct`] = clearedBelow(row[`altOwnFieldP${p}Kg`]);
        }
        row.clearanceOfQuotaPct = clearedBelow(row.altQuotaKg);
        row.clearanceOfTrimmedPct = clearedBelow(row.altTrimmedP10Kg);
        row.clearedByOwnFieldPct = row.designatedKg === null || n === 0
          ? null : d1((own.filter((t) => t >= row.designatedKg).length / n) * 100);
        // How much of this cell's own field totals less than the gate of the
        // tier below it. This is the CONTAMINATION measurement: where it is
        // larger than `DESIGNATED_PERCENTILE`, a P10 of this field is a
        // percentile taken inside the contaminated band.
        row.belowTierBelowGateCount = belowGateKg === null ? null : own.filter((t) => t < belowGateKg).length;
        row.belowTierBelowGatePct = belowGateKg === null || n === 0
          ? null : d1((row.belowTierBelowGateCount / n) * 100);

        byKey.set(`${tier}|${sex}|${cls}`, row);
        out.push(row);
      }
    }
  }

  return out;
}

/**
 * Two consistency checks on the designated column, reported as COUNTS with the
 * offending cells named.
 *
 * A published qualifying-total table is monotone in both directions — heavier
 * classes ask for more, higher tiers ask for more — and a percentile taken from
 * a finite sample is not, so the count is the honest measure of how much
 * hand-smoothing the table still needs. The tier direction is a CONSTRAINT (see
 * `LADDER_MUST_BE_MONOTONE_ACROSS_TIERS`); the class direction is measured and
 * reported, because its violations here are one rounding step wide.
 */
export function ladderReport(rows, options = {}) {
  const kgOf = options.kgOf ?? ((r) => r.designatedKg);
  const methodOf = options.methodOf ?? ((r) => r.method);
  const byKey = new Map(rows.map((r) => [`${r.tier}|${r.sex}|${r.weightClassKg}`, r]));
  const acrossTiers = [];
  const repairMoves = [];
  let tierComparisons = 0;
  let tierComparisonsGuaranteed = 0;
  let tierComparisonsStrict = 0;
  let worstDeficitKg = 0;
  let ties = 0;

  for (let i = 1; i < TIER_ORDER.length; i += 1) {
    for (const sex of DERIVATION.SEXES) {
      for (const cls of classNamesFor(sex)) {
        const hi = byKey.get(`${TIER_ORDER[i]}|${sex}|${cls}`);
        const lo = byKey.get(`${TIER_ORDER[i - 1]}|${sex}|${cls}`);
        if (!hi || !lo) continue;
        const hiKg = kgOf(hi);
        const loKg = kgOf(lo);
        if (hiKg === null || loKg === null) continue;
        tierComparisons += 1;
        // Guaranteed when the higher tier is a quota of the SAME population the
        // lower tier takes its percentile from, at a higher percentile.
        if (
          methodOf(hi) === DESIGNATION_METHODS.TIER_BELOW_QUOTA
          && hi.designatedFromTier === lo.tier
          && methodOf(lo) === DESIGNATION_METHODS.TIER_FIELD_PERCENTILE
          && 100 - DERIVATION.ADMIT_TOP_PCT_OF_TIER_BELOW > DERIVATION.DESIGNATED_PERCENTILE
        ) tierComparisonsGuaranteed += 1;
        if (hiKg > loKg) tierComparisonsStrict += 1;
        if (hiKg === loKg) ties += 1;
        if (hiKg <= loKg) {
          // The markers travel into the INVERSION LIST too, not only into the
          // tables. A list of offending cells is data about those cells, and it
          // is read by exactly the person who most needs to know that half of
          // them describe an open field.
          acrossTiers.push(`${sex} ${cls}: ${TIER_ORDER[i - 1]} ${loKg}${lo.markers} -> ${TIER_ORDER[i]} ${hiKg}${hi.markers}`);
          worstDeficitKg = Math.max(worstDeficitKg, loKg - hiKg);
        }
        // What a monotone REPAIR pass would move. Computed, never applied: see
        // LADDER_MUST_BE_MONOTONE_ACROSS_TIERS. Note that a TIE is already
        // monotone, so a repair does not touch it — the gate that does nothing
        // survives the repair, which is half the argument against repairing.
        if (hiKg < loKg) {
          repairMoves.push({
            cell: `${TIER_ORDER[i]} ${sex} ${cls}`,
            fromKg: hiKg,
            toKg: loKg,
            deltaKg: d1(loKg - hiKg),
            becomesTieWith: `${TIER_ORDER[i - 1]} ${sex} ${cls}`,
          });
        }
      }
    }
  }

  return {
    acrossTiers,
    repairMoves,
    tierComparisons,
    tierComparisonsGuaranteed,
    tierComparisonsStrict,
    tierTies: ties,
    worstDeficitKg: d1(worstDeficitKg),
  };
}

export function consistency(rows) {
  const byKey = new Map(rows.map((r) => [`${r.tier}|${r.sex}|${r.weightClassKg}`, r]));
  const ladder = ladderReport(rows);
  const acrossClasses = [];
  let classComparisons = 0;

  for (const tier of TIER_ORDER) {
    for (const sex of DERIVATION.SEXES) {
      const names = classNamesFor(sex);
      for (let c = 1; c < names.length; c += 1) {
        const hi = byKey.get(`${tier}|${sex}|${names[c]}`);
        const lo = byKey.get(`${tier}|${sex}|${names[c - 1]}`);
        if (!hi || !lo || hi.designatedKg === null || lo.designatedKg === null) continue;
        classComparisons += 1;
        if (hi.designatedKg < lo.designatedKg) {
          acrossClasses.push(`${tier} ${sex}: ${names[c - 1]} ${lo.designatedKg}${lo.markers} -> ${names[c]} ${hi.designatedKg}${hi.markers}`);
        }
      }
    }
  }

  return { ...ladder, acrossClasses, classComparisons };
}

/**
 * THE COUNTERFACTUAL: what the ladder does if `worlds` keeps the uniform
 * percentile designation instead of the quota one.
 *
 * Computed inside the shipped run rather than by re-running the script with the
 * knob flipped, for one reason: every number the deliverable prints has to be
 * re-derivable by ONE command against the pinned dataset. A number quoted from
 * a second run with a different environment variable is a number `--check-doc`
 * cannot see.
 */
export function counterfactualOwnFieldLadder(rows) {
  return ladderReport(rows, {
    kgOf: (r) => (r.tier === 'worlds' ? r.altOwnFieldP10Kg : r.designatedKg),
    methodOf: (r) => (r.tier === 'worlds' ? DESIGNATION_METHODS.TIER_FIELD_PERCENTILE : r.method),
  });
}

/**
 * The evidence behind the worlds-tier method choice, recomputed every run.
 *
 * `contamination` — per cell, how much of the worlds field totals less than the
 *   nationals gate. Compare against `DESIGNATED_PERCENTILE`: where the band is
 *   wider than the percentile, the percentile is inside it.
 * `smallDelegation` — the share of sub-gate entrants from delegations of
 *   `SMALL_DELEGATION_MAX_ENTRANTS` or fewer in that cell, AND the same share
 *   over the whole field as the base rate it has to be read against.
 */
export function worldsDiagnostics(best, rows) {
  const byKey = new Map(rows.map((r) => [`${r.tier}|${r.sex}|${r.weightClassKg}`, r]));
  const perCell = new Map();
  for (const rec of best.values()) {
    if (rec.tier !== 'worlds') continue;
    const key = `${rec.sex}|${rec.cls}`;
    if (!perCell.has(key)) perCell.set(key, []);
    perCell.get(key).push(rec);
  }

  let fieldTotal = 0;
  let fieldSmall = 0;
  let belowTotal = 0;
  let belowSmall = 0;
  const contamination = [];
  for (const [key, recs] of perCell) {
    const [sex, cls] = key.split('|');
    const byCountry = new Map();
    for (const r of recs) byCountry.set(r.country, (byCountry.get(r.country) ?? 0) + 1);
    const natRow = byKey.get(`nationals|${sex}|${cls}`);
    const gate = natRow ? natRow.designatedKg : null;
    let below = 0;
    for (const r of recs) {
      const small = (byCountry.get(r.country) ?? 0) <= DERIVATION.SMALL_DELEGATION_MAX_ENTRANTS;
      fieldTotal += 1;
      if (small) fieldSmall += 1;
      if (gate !== null && r.total < gate) {
        below += 1; belowTotal += 1;
        if (small) belowSmall += 1;
      }
    }
    const worldsRow = byKey.get(`worlds|${sex}|${cls}`);
    const ownP10 = worldsRow ? worldsRow.altOwnFieldP10Kg : null;
    const belowPct = gate === null ? null : d1((below / recs.length) * 100);
    contamination.push({
      sex,
      weightClassKg: cls,
      lifters: recs.length,
      delegations: byCountry.size,
      tierBelowGateKg: gate,
      belowGate: gate === null ? null : below,
      belowGatePct: belowPct,
      /**
       * The two booleans whose agreement is the diagnosis.
       *
       * `contaminatedBeyondPercentile` — the band of this field that sits below
       * the tier-below gate is WIDER than the percentile being taken, so a P10
       * of this field is a percentile taken inside that band.
       * `invertsUnderOwnFieldP10` — the P10 designation of this cell came out at
       * or below the tier-below gate, i.e. the ladder inverted here.
       *
       * If the first predicts the second the diagnosis is mechanical rather than
       * a story. The agreement count is in `contaminationPredictsInversion`.
       */
      contaminatedBeyondPercentile: belowPct === null ? null : belowPct > DERIVATION.DESIGNATED_PERCENTILE,
      invertsUnderOwnFieldP10: gate === null || ownP10 === null ? null : ownP10 <= gate,
      ownFieldP10Kg: ownP10,
    });
  }
  contamination.sort((a, b) => (a.sex === b.sex
    ? classNamesFor(a.sex).indexOf(a.weightClassKg) - classNamesFor(b.sex).indexOf(b.weightClassKg)
    : a.sex.localeCompare(b.sex)));

  const measured = contamination.filter((c) => c.belowGatePct !== null);
  const paired = contamination.filter((c) => c.contaminatedBeyondPercentile !== null && c.invertsUnderOwnFieldP10 !== null);
  return {
    contamination,
    fieldLifters: fieldTotal,
    belowGateLifters: belowTotal,
    contaminationMinPct: measured.length === 0 ? null : Math.min(...measured.map((c) => c.belowGatePct)),
    contaminationMaxPct: measured.length === 0 ? null : Math.max(...measured.map((c) => c.belowGatePct)),
    cellsContaminatedBeyondPercentile: paired.filter((c) => c.contaminatedBeyondPercentile).length,
    cellsInvertingUnderOwnFieldP10: paired.filter((c) => c.invertsUnderOwnFieldP10).length,
    contaminationPredictsInversion: paired.filter((c) => c.contaminatedBeyondPercentile === c.invertsUnderOwnFieldP10).length,
    cellsPaired: paired.length,
    smallDelegation: {
      maxEntrants: DERIVATION.SMALL_DELEGATION_MAX_ENTRANTS,
      belowGateSharePct: belowTotal === 0 ? null : d1((belowSmall / belowTotal) * 100),
      wholeFieldSharePct: fieldTotal === 0 ? null : d1((fieldSmall / fieldTotal) * 100),
    },
  };
}

/**
 * LEFT-TAIL SHAPE, per tier: the median over cells of (P10 - min).
 *
 * Written for a hypothesis that it REFUTED, which is why it stays in the
 * script. If a gated tier's field were filtered by the published standard, its
 * minimum would sit just under its gate and this number would be small. It is
 * not: the gated tier's median drop is larger than the quota tier's. The reason
 * is that a lifter qualifies at an EARLIER meet and the total recorded AT the
 * meet is a performance on the day — so no percentile of any of these fields
 * recovers a published standard, and the doc says so rather than implying the
 * gated tier's number is more authoritative than it is.
 */
export function leftTailShape(best) {
  const cells = cellsOf(best);
  const out = {};
  for (const tier of TIER_ORDER) {
    const drops = [];
    for (const sex of DERIVATION.SEXES) {
      for (const cls of classNamesFor(sex)) {
        const arr = cells.get(`${tier}|${sex}|${cls}`) ?? [];
        if (arr.length < DERIVATION.MIN_LIFTERS_PER_CELL) continue;
        drops.push(percentile(arr, DERIVATION.DESIGNATED_PERCENTILE) - arr[0]);
      }
    }
    drops.sort((a, b) => a - b);
    out[tier] = {
      cells: drops.length,
      medianDropKg: drops.length === 0 ? null : d1(drops[Math.floor(drops.length / 2)]),
      maxDropKg: drops.length === 0 ? null : d1(drops[drops.length - 1]),
    };
  }
  return out;
}

// ---------------------------------------------------------------------------
// CLAIMS — the bridge between a number in the prose and a number in the data
// ---------------------------------------------------------------------------

/**
 * Every number the deliverable is allowed to state, keyed.
 *
 * The deliverable tags each of its headline numbers with `<!--@<slug>:<key>-->`
 * and `--check-doc` resolves the tag against this map. A tag whose key is not
 * here is a FAILURE, not a skip, so a typo cannot pass quietly; a number with no
 * tag is simply unchecked, and `checkDoc` reports how many of those there are
 * rather than implying it covers them.
 *
 * `<slug>` is the equipment slug of the run, so the equipped section's numbers
 * are checked by the equipped run and skipped (and counted) by the raw one.
 */
export function claims(rows, meta) {
  /** @type {Record<string, number|string|null>} */
  const c = {};
  const put = (k, v) => { c[k] = v === undefined ? null : v; };

  put('meta.meetsScanned', meta.meetsScanned);
  put('meta.rowsScanned', meta.rowsScanned);
  put('meta.recordsKept', meta.kept);
  put('meta.latestMeetDate', meta.latestMeetDate);
  put('meta.datasetCommit', meta.datasetCommit);
  for (const [k, v] of Object.entries(meta.rejects)) put(`filter.${k}`, v);
  for (const t of TIER_ORDER) {
    put(`meets.${t}`, meta.meetsPerTier[t]);
    put(`meets.${t}.zeroContribution`, meta.emptyMeetsPerTier[t]);
  }

  for (const r of rows) {
    const k = `cell.${r.tier}.${r.sex}.${r.weightClassKg}`;
    put(`${k}.designated`, r.designatedKg);
    put(`${k}.n`, r.lifters);
    put(`${k}.sourceN`, r.sourceLifters);
    put(`${k}.min`, d1(r.minKg));
    put(`${k}.max`, d1(r.maxKg));
    put(`${k}.clearance`, r.clearedByTierBelowPct);
    put(`${k}.ownClearance`, r.clearedByOwnFieldPct);
    put(`${k}.quota`, r.altQuotaKg);
    put(`${k}.trimmed`, r.altTrimmedP10Kg);
    put(`${k}.trimmedN`, r.altTrimmedLifters);
    put(`${k}.contaminationPct`, r.belowTierBelowGatePct);
    for (const p of DERIVATION.REPORTED_PERCENTILES) put(`${k}.p${p}`, r[`p${p}`]);
    for (const p of DERIVATION.WORLDS_ALTERNATIVE_PERCENTILES) put(`${k}.ownP${p}`, r[`altOwnFieldP${p}Kg`]);
  }

  const cons = meta.consistency;
  put('count.cells', rows.length);
  put('count.cellsWithNumber', rows.filter((r) => r.designatedKg !== null).length);
  put('count.gaps', rows.filter((r) => r.designatedKg === null).length);
  put('count.tierInversions', cons.acrossTiers.length);
  put('count.classInversions', cons.acrossClasses.length);
  put('count.tierComparisons', cons.tierComparisons);
  put('count.tierComparisonsGuaranteed', cons.tierComparisonsGuaranteed);
  put('count.tierComparisonsNotGuaranteed', cons.tierComparisons - cons.tierComparisonsGuaranteed);
  put('count.tierComparisonsStrict', cons.tierComparisonsStrict);
  put('count.classComparisons', cons.classComparisons);
  put('count.monotoneRepairMoves', cons.repairMoves.length);

  // The counterfactual ladder — the same cells with the worlds tier designated
  // the old way, so the deliverable can state what changed without quoting a
  // second run this checker cannot see.
  const cf = meta.counterfactualOwnP10;
  put('counterfactual.ownP10.tierInversions', cf.acrossTiers.length);
  put('counterfactual.ownP10.tierTies', cf.tierTies);
  put('counterfactual.ownP10.repairMoves', cf.repairMoves.length);
  put('counterfactual.ownP10.worstDeficitKg', cf.worstDeficitKg);
  put('counterfactual.ownP10.tierComparisons', cf.tierComparisons);
  put('counterfactual.ownP10.tierComparisonsGuaranteed', cf.tierComparisonsGuaranteed);

  for (const t of TIER_ORDER) {
    const vals = rows.filter((r) => r.tier === t && r.clearedByTierBelowPct !== null)
      .map((r) => r.clearedByTierBelowPct);
    put(`clearance.${t}.min`, vals.length === 0 ? null : Math.min(...vals));
    put(`clearance.${t}.max`, vals.length === 0 ? null : Math.max(...vals));
    put(`clearance.${t}.cells`, vals.length);
  }

  const w = meta.worlds;
  put('worlds.fieldLifters', w.fieldLifters);
  put('worlds.belowGateLifters', w.belowGateLifters);
  put('worlds.contaminationMinPct', w.contaminationMinPct);
  put('worlds.contaminationMaxPct', w.contaminationMaxPct);
  put('worlds.smallDelegationBelowGatePct', w.smallDelegation.belowGateSharePct);
  put('worlds.smallDelegationBaseRatePct', w.smallDelegation.wholeFieldSharePct);
  // THE SELECTIVITY SPREAD of every candidate worlds designation: the range,
  // across the 15 cells, of the fraction of the NATIONALS field it excludes.
  // This is the tiebreaker between the two surviving candidates and it has to
  // be a computed claim rather than a sentence, because "uniform" and "varies
  // threefold" are exactly the kind of words that drift away from their data.
  const worldsRows = rows.filter((r) => r.tier === 'worlds');
  const spread = (field) => {
    const vals = worldsRows.map((r) => r[field]).filter((v) => v !== null && v !== undefined);
    return vals.length === 0 ? [null, null, 0] : [Math.min(...vals), Math.max(...vals), vals.length];
  };
  for (const [name, field] of [
    ['ownP10', 'clearanceOfOwnP10Pct'], ['ownP25', 'clearanceOfOwnP25Pct'],
    ['ownP50', 'clearanceOfOwnP50Pct'], ['trimmed', 'clearanceOfTrimmedPct'],
    ['quota', 'clearanceOfQuotaPct'],
  ]) {
    const [lo, hi, n] = spread(field);
    put(`worlds.selectivity.${name}.min`, lo);
    put(`worlds.selectivity.${name}.max`, hi);
    put(`worlds.selectivity.${name}.cells`, n);
  }
  put('worlds.cellsContaminatedBeyondPercentile', w.cellsContaminatedBeyondPercentile);
  put('worlds.cellsInvertingUnderOwnFieldP10', w.cellsInvertingUnderOwnFieldP10);
  put('worlds.contaminationPredictsInversion', w.contaminationPredictsInversion);
  put('worlds.cellsPaired', w.cellsPaired);
  for (const t of TIER_ORDER) put(`leftTail.${t}.medianDropKg`, meta.leftTail[t].medianDropKg);

  return c;
}

// ---------------------------------------------------------------------------
// STRUCTURAL CHECKS — things that must hold of ANY dataset, not of this one
// ---------------------------------------------------------------------------

/**
 * Every check is a predicate with a comparison. A number this script prints and
 * never compares is the defect CLAUDE.md names; these are the comparisons.
 *
 * Each returns `{ name, ok, domain, detail }`. `main` exits 3 if any `ok` is
 * false. A check whose `domain` is 0 reports **EMPTY**, never PASS: a predicate
 * over an empty set is true and says nothing, and the two must not print the
 * same word. `QT_WORLDS_METHOD=tier-field-percentile` empties the quota check
 * and that is what EMPTY is for.
 */
export function structuralChecks(rows, meta) {
  const checks = [];
  const add = (name, ok, domain, detail) => checks.push({
    name, ok: Boolean(ok), domain, status: !ok ? 'FAIL' : (domain === 0 ? 'EMPTY' : 'PASS'), detail,
  });

  // 1. NON-VACUITY. A table with no numbers in it satisfies every property
  //    below trivially, so the domain is pinned first.
  const withNumber = rows.filter((r) => r.designatedKg !== null);
  add(
    'the table has cells to check',
    rows.length === DERIVATION.SEXES.length * TIER_ORDER.length * classNamesFor('M').length
      && withNumber.length > 0,
    rows.length,
    `${withNumber.length} of ${rows.length} cells carry a number`,
  );

  // 2. Every cell declares its method and its population regime — the
  //    mixed-method declaration travels with the data or it is not declared.
  const undeclared = rows.filter((r) => !r.method || !r.entryRegime
    || (r.designatedKg !== null && r.markers === undefined));
  add('every cell declares its method and entry regime', undeclared.length === 0,
    rows.length, `${rows.length - undeclared.length}/${rows.length} declared`);

  // 3. Every open-population cell is marked, and no gated one is. This is the
  //    caveat-travels-with-the-data property, checked in both directions so
  //    dropping a marker AND over-marking both fail.
  const shouldMark = rows.filter((r) => r.sourceEntryRegime === ENTRY_REGIMES.OPEN);
  const marked = rows.filter((r) => r.markers.includes(CELL_MARKERS.OPEN_POPULATION));
  add('every ungated-population cell carries the marker, and only those',
    shouldMark.length === marked.length && shouldMark.every((r) => r.markers.includes(CELL_MARKERS.OPEN_POPULATION)),
    shouldMark.length,
    `${marked.length} marked, ${shouldMark.length} open-population cells`);
  add('no ungated cell claims to be a qualifying standard',
    shouldMark.every((r) => r.isQualifyingStandard === false)
    && rows.filter((r) => r.sourceEntryRegime !== ENTRY_REGIMES.OPEN).every((r) => r.isQualifyingStandard === true),
    rows.length,
    `${shouldMark.length} cells carry isQualifyingStandard: false`);

  // 4. THE LADDER. See LADDER_MUST_BE_MONOTONE_ACROSS_TIERS for what can and
  //    cannot fail this.
  const cons = meta.consistency;
  if (DERIVATION.LADDER_MUST_BE_MONOTONE_ACROSS_TIERS) {
    add('the tier ladder does not invert', cons.acrossTiers.length === 0,
      cons.tierComparisons,
      cons.acrossTiers.length === 0
        ? `${cons.tierComparisons} comparisons, ${cons.tierComparisons - cons.tierComparisonsGuaranteed} of them not guaranteed by construction`
        : `INVERTED: ${cons.acrossTiers.join('; ')}`);
    // ...and the ladder must not be flat either, which is the failure mode a
    // monotone REPAIR would have produced. A tie passes the check above.
    add('the ladder rises strictly at every step',
      cons.tierComparisonsStrict === cons.tierComparisons,
      cons.tierComparisons,
      `${cons.tierComparisonsStrict}/${cons.tierComparisons} strictly greater`);
    // The guard on the two above: a ladder check every one of whose comparisons
    // is guaranteed by construction is a green light that cannot turn red.
    // When there are NO comparisons at all — the equipped run, where only the
    // entry tier has cells — this reports EMPTY rather than FAIL, because "this
    // run had no ladder" is a true statement about that run and shouting FAIL
    // at it every time is how a check gets ignored.
    add('the ladder check has a domain that can fail',
      cons.tierComparisons === 0 || cons.tierComparisons - cons.tierComparisonsGuaranteed > 0,
      cons.tierComparisons,
      `${cons.tierComparisons - cons.tierComparisonsGuaranteed} of ${cons.tierComparisons} comparisons are not construction-guaranteed`);
  }

  // 5. THE ARITHMETIC IDENTITY, pinned so it is never read as a finding: a
  //    P-percentile gate is cleared by ~(100-P)% of the population it was taken
  //    from. Tolerance is one rounding step's worth of ties, expressed as a
  //    percentage of the smallest cell we allow.
  const ownTolerancePct = 100 / DERIVATION.MIN_LIFTERS_PER_CELL * 2;
  const pctRows = rows.filter((r) => r.method === DESIGNATION_METHODS.TIER_FIELD_PERCENTILE
    && r.clearedByOwnFieldPct !== null);
  const offenders = pctRows.filter(
    (r) => Math.abs(r.clearedByOwnFieldPct - (100 - DERIVATION.DESIGNATED_PERCENTILE)) > ownTolerancePct,
  );
  add('own-field clearance is arithmetic, not evidence', offenders.length === 0,
    pctRows.length,
    `${pctRows.length} percentile cells within ${ownTolerancePct}pp of ${100 - DERIVATION.DESIGNATED_PERCENTILE}%`);

  // 6. The designated value of a quota cell really did come from the tier
  //    below — the field that says so is data a consumer will trust.
  const quotaRows = rows.filter((r) => r.method === DESIGNATION_METHODS.TIER_BELOW_QUOTA && r.designatedKg !== null);
  add('quota cells name the population they came from',
    quotaRows.every((r) => r.designatedFromTier === r.tierBelow && r.sourceLifters === r.tierBelowLifters),
    quotaRows.length,
    `${quotaRows.length} quota cells`);

  return checks;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

function fmtKg(kg) {
  return kg === null || kg === undefined ? null : kg.toFixed(1);
}

/**
 * The text of one cell of the deliverable's shipped table: the designated
 * total, its markers, and the size of the population it was derived from.
 *
 * `sourceLifters` rather than the cell's own count, because under a mixed
 * method those are different populations and a bare `n` beside a quota number
 * would say "43 lifters" about a number computed from 47 other ones.
 */
export function shippedCellText(row) {
  if (row.sourceLifters === 0) return 'NO DATA';
  if (row.designatedKg === null) return `GAP (${row.sourceLifters})`;
  return `${fmtKg(row.designatedKg)}${row.markers} (${row.sourceLifters})`;
}

/**
 * One cell of the quota-everywhere alternative table.
 *
 * Marked by the entry regime of the tier it is COMPUTED FROM, which is the tier
 * below. Two of that table's three columns are therefore ungated: a "regional"
 * quota gate is the top quarter of the LOCAL field and a "nationals" one is the
 * top quarter of the regional field, and both of those fields are open-entry.
 * The alternative table inherits the caveat rather than escaping it.
 */
export function quotaCellText(row) {
  if (row.tierBelow === null) return '—';
  const mark = DERIVATION.TIER_ENTRY_REGIME[row.tierBelow] === ENTRY_REGIMES.OPEN
    ? CELL_MARKERS.OPEN_POPULATION : '';
  if (row.altQuotaKg === null) return `GAP (${row.altQuotaFromLifters})`;
  return `${fmtKg(row.altQuotaKg)}${mark} (${row.altQuotaFromLifters})`;
}

/**
 * One cell of the "worlds, five ways" table: a candidate gate and the share of
 * the tier below that already clears it.
 *
 * The clearance is the whole point of the table — a candidate gate is judged by
 * what it excludes from the population the player comes UP from, not by how it
 * sits inside its own field.
 */
export function candidateCellText(kg, clearedPct) {
  if (kg === null || clearedPct === null) return 'GAP';
  return `${fmtKg(kg)} / ${clearedPct}%`;
}

/**
 * The tables the deliverable carries, rendered from the computed rows.
 *
 * `--check-doc` compares the doc's table cells against these strings, so the
 * deliverable's tables cannot drift from the data without the check going red,
 * and the expected block is printed on mismatch so the fix is a paste.
 */
export function docTables(rows, meta) {
  const byKey = new Map(rows.map((r) => [`${r.tier}|${r.sex}|${r.weightClassKg}`, r]));
  /** @type {Record<string, {columns: string[], rows: {key: string, cells: string[]}[]}>} */
  const tables = {};

  for (const sex of DERIVATION.SEXES) {
    // (1) the shipped table
    tables[`shipped-${sex}`] = {
      columns: ['class kg', ...TIER_ORDER],
      rows: classNamesFor(sex).map((cls) => ({
        key: cls,
        cells: TIER_ORDER.map((t) => shippedCellText(byKey.get(`${t}|${sex}|${cls}`))),
      })),
    };

    // (2) the worlds row, every candidate designation side by side, each with
    //     the fraction of the NATIONALS field that clears it.
    tables[`worlds-methods-${sex}`] = {
      columns: ['class kg', 'nationals gate', 'own P10', 'own P25', 'own P50', 'trimmed P10', 'quota P75 (SHIPPED)'],
      rows: classNamesFor(sex).map((cls) => {
        const w = byKey.get(`worlds|${sex}|${cls}`);
        const nat = byKey.get(`nationals|${sex}|${cls}`);
        return {
          key: cls,
          cells: [
            nat.designatedKg === null ? 'GAP' : fmtKg(nat.designatedKg),
            candidateCellText(w.altOwnFieldP10Kg, w.clearanceOfOwnP10Pct),
            candidateCellText(w.altOwnFieldP25Kg, w.clearanceOfOwnP25Pct),
            candidateCellText(w.altOwnFieldP50Kg, w.clearanceOfOwnP50Pct),
            candidateCellText(w.altTrimmedP10Kg, w.clearanceOfTrimmedPct),
            candidateCellText(w.altQuotaKg, w.clearanceOfQuotaPct),
          ],
        };
      }),
    };

    // (3) the quota designation applied at every tier — the alternative table
    tables[`quota-${sex}`] = {
      columns: ['class kg', 'regional', 'nationals', 'worlds'],
      rows: classNamesFor(sex).map((cls) => ({
        key: cls,
        cells: ['regional', 'nationals', 'worlds'].map((t) => quotaCellText(byKey.get(`${t}|${sex}|${cls}`))),
      })),
    };
  }

  // (4) every cell that carries a number, for the runs where that is short
  //     enough to be a table — the equipped one. Ordered tier, sex, class.
  tables.sufficient = {
    columns: ['tier sex class', 'source lifters', 'designated kg', 'method'],
    rows: rows.filter((r) => r.designatedKg !== null).map((r) => ({
      key: `${r.tier} ${r.sex} ${r.weightClassKg}`,
      cells: [String(r.sourceLifters), `${fmtKg(r.designatedKg)}${r.markers}`, r.method],
    })),
  };

  void meta;
  return tables;
}

/** Render one table registry entry as a markdown block. */
export function renderDocTable(name, table) {
  const lines = [];
  lines.push(`<!--TABLE ${name}-->`);
  lines.push(`| ${table.columns.join(' | ')} |`);
  lines.push(`|${table.columns.map((_, i) => (i === 0 ? '---' : '---:')).join('|')}|`);
  for (const r of table.rows) lines.push(`| ${[r.key, ...r.cells].join(' | ')} |`);
  return lines.join('\n');
}

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
  lines.push(`- Designated percentile (percentile-method tiers): P${DERIVATION.DESIGNATED_PERCENTILE}, floored to ${DERIVATION.ROUND_STEP_KG} kg`);
  lines.push(`- Quota fraction (quota-method tiers): top ${DERIVATION.ADMIT_TOP_PCT_OF_TIER_BELOW}% of the tier below`);
  lines.push(`- Minimum lifters in the SOURCE population for a cell to carry a number: ${DERIVATION.MIN_LIFTERS_PER_CELL}`);
  lines.push(`- Meets scanned: ${meta.meetsScanned}; entry rows read: ${meta.rowsScanned}`);
  lines.push(`- Distinct lifter-tier-class records kept: ${meta.kept}`);
  lines.push('');
  lines.push('## THIS TABLE IS MIXED-METHOD. Every cell says which method made it.');
  lines.push('');
  lines.push('| tier | entry to that field | designation method | is it a qualifying standard? |');
  lines.push('|---|---|---|---|');
  for (const t of TIER_ORDER) {
    const regime = DERIVATION.TIER_ENTRY_REGIME[t];
    lines.push(`| ${t} | ${regime} | ${DERIVATION.TIER_DESIGNATION[t]} | ${regime === ENTRY_REGIMES.OPEN ? '**NO — describes an open field**' : 'derived, see §3.6 of the deliverable'} |`);
  }
  lines.push('');
  for (const [marker, text] of Object.entries(MARKER_LEGEND)) lines.push(`- **${marker}** ${text}`);
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
      const regime = DERIVATION.TIER_ENTRY_REGIME[tier];
      lines.push(`### ${tier} — ${sex === 'M' ? 'men' : 'women'}`);
      lines.push('');
      lines.push(`Entry regime: **${regime}**. Method: **${DERIVATION.TIER_DESIGNATION[tier]}**.`);
      if (regime === ENTRY_REGIMES.OPEN) {
        lines.push('');
        lines.push(`**${CELL_MARKERS.OPEN_POPULATION} ${MARKER_LEGEND[CELL_MARKERS.OPEN_POPULATION]}**`);
      }
      lines.push('');
      lines.push('| class kg | lifters | DESIGNATED kg | from | source n | quota-alt kg | trimmed-alt kg | P5 | P10 | P25 | P50 | P75 | P90 | min | max | % of tier below clearing | % of own field clearing | % of own field below the gate below |');
      lines.push(`|---|${'---:|'.repeat(17)}`);
      for (const r of rows.filter((x) => x.tier === tier && x.sex === sex)) {
        const dsg = r.designatedKg === null
          ? (r.sourceLifters === 0 ? 'NO DATA' : `GAP (source n=${r.sourceLifters})`)
          : `${fmtKg(r.designatedKg)}${r.markers}`;
        lines.push(`| ${r.weightClassKg} | ${r.lifters} | ${dsg} | ${r.designatedFromTier} | ${r.sourceLifters} | ${r.altQuotaKg ?? '—'} | ${r.altTrimmedP10Kg ?? '—'} | ${r.p5 ?? '—'} | ${r.p10 ?? '—'} | ${r.p25 ?? '—'} | ${r.p50 ?? '—'} | ${r.p75 ?? '—'} | ${r.p90 ?? '—'} | ${r.minKg ?? '—'} | ${r.maxKg ?? '—'} | ${r.clearedByTierBelowPct === null ? '—' : `${r.clearedByTierBelowPct}%`} | ${r.clearedByOwnFieldPct === null ? '—' : `${r.clearedByOwnFieldPct}%`} | ${r.belowTierBelowGatePct === null ? '—' : `${r.belowTierBelowGatePct}%`} |`);
      }
      lines.push('');
    }
  }

  lines.push('## Consistency of the designated column');
  lines.push('');
  lines.push(`- Tier inversions or ties (higher tier asks no more than the one below): **${meta.consistency.acrossTiers.length}** of ${meta.consistency.tierComparisons} comparisons, ${meta.consistency.tierComparisons - meta.consistency.tierComparisonsGuaranteed} of which are not guaranteed by construction`);
  for (const s of meta.consistency.acrossTiers) lines.push(`  - ${s}`);
  lines.push(`- Weight-class inversions (a heavier class asks less than the one below it): **${meta.consistency.acrossClasses.length}** of ${meta.consistency.classComparisons} comparisons`);
  for (const s of meta.consistency.acrossClasses) lines.push(`  - ${s}`);
  lines.push(`- A monotone REPAIR pass (not applied — see the knob) would move **${meta.consistency.repairMoves.length}** cells of the shipped table:`);
  for (const m of meta.consistency.repairMoves) lines.push(`  - ${m.cell}: ${m.fromKg} -> ${m.toKg} (+${m.deltaKg} kg), tying with ${m.becomesTieWith}`);
  lines.push('');
  lines.push(`### The counterfactual: the same cells with worlds designated \`${DESIGNATION_METHODS.TIER_FIELD_PERCENTILE}\``);
  lines.push('');
  lines.push(`- Tier inversions or ties: **${meta.counterfactualOwnP10.acrossTiers.length}** of ${meta.counterfactualOwnP10.tierComparisons} comparisons, ${meta.counterfactualOwnP10.tierComparisonsGuaranteed} guaranteed by construction. Worst deficit **${meta.counterfactualOwnP10.worstDeficitKg} kg**.`);
  for (const s2 of meta.counterfactualOwnP10.acrossTiers) lines.push(`  - ${s2}`);
  lines.push(`- A monotone repair would move **${meta.counterfactualOwnP10.repairMoves.length}** of them and leave **${meta.counterfactualOwnP10.tierTies}** tie(s) untouched, still gating nothing:`);
  for (const m of meta.counterfactualOwnP10.repairMoves) lines.push(`  - ${m.cell}: ${m.fromKg} -> ${m.toKg} (+${m.deltaKg} kg), tying with ${m.becomesTieWith}`);
  lines.push('');

  lines.push('## Worlds-tier diagnostics — why that tier is derived differently');
  lines.push('');
  lines.push(`| sex | class kg | lifters | delegations | nationals gate | below it | % below | wider than P${DERIVATION.DESIGNATED_PERCENTILE}? | own-P10 gate | inverts? |`);
  lines.push('|---|---|---:|---:|---:|---:|---:|---|---:|---|');
  for (const c of meta.worlds.contamination) {
    const yn = (b) => (b === null ? '—' : (b ? 'YES' : 'no'));
    lines.push(`| ${c.sex} | ${c.weightClassKg} | ${c.lifters} | ${c.delegations} | ${c.tierBelowGateKg ?? '—'} | ${c.belowGate ?? '—'} | ${c.belowGatePct === null ? '—' : `${c.belowGatePct}%`} | ${yn(c.contaminatedBeyondPercentile)} | ${c.ownFieldP10Kg ?? '—'} | ${yn(c.invertsUnderOwnFieldP10)} |`);
  }
  lines.push('');
  lines.push(`- Worlds field: ${meta.worlds.fieldLifters} lifters, ${meta.worlds.belowGateLifters} of them below their own class's nationals gate.`);
  lines.push(`- Of those, ${meta.worlds.smallDelegation.belowGateSharePct}% come from a delegation of ${meta.worlds.smallDelegation.maxEntrants} or fewer in that cell — against a base rate of ${meta.worlds.smallDelegation.wholeFieldSharePct}% over the whole worlds field.`);
  lines.push(`- The last two columns agree in **${meta.worlds.contaminationPredictsInversion} of ${meta.worlds.cellsPaired}** cells: ${meta.worlds.cellsContaminatedBeyondPercentile} cells are contaminated beyond the percentile being taken, ${meta.worlds.cellsInvertingUnderOwnFieldP10} invert under it.`);
  lines.push('');
  lines.push('## Left-tail shape — the refuted hypothesis, kept');
  lines.push('');
  lines.push('| tier | cells | median (P10 - min) kg | worst |');
  lines.push('|---|---:|---:|---:|');
  for (const t of TIER_ORDER) {
    lines.push(`| ${t} | ${meta.leftTail[t].cells} | ${meta.leftTail[t].medianDropKg ?? '—'} | ${meta.leftTail[t].maxDropKg ?? '—'} |`);
  }
  lines.push('');
  lines.push('## Structural checks');
  lines.push('');
  lines.push('`EMPTY` is not `PASS`: it means the predicate had nothing to run on.');
  lines.push('');
  lines.push('| check | result | domain | detail |');
  lines.push('|---|---|---:|---|');
  for (const ch of meta.checks) lines.push(`| ${ch.name} | ${ch.status === 'FAIL' ? '**FAIL**' : ch.status} | ${ch.domain} | ${ch.detail} |`);
  lines.push('');
  lines.push('## The tables the deliverable carries, rendered from this run');
  lines.push('');
  lines.push('`--check-doc` compares `qualifying-totals.md` against exactly these blocks.');
  lines.push('');
  for (const [name, table] of Object.entries(meta.docTables)) {
    lines.push(`### \`${name}\``);
    lines.push('');
    lines.push(renderDocTable(`${meta.slug}:${name}`, table));
    lines.push('');
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// --check-doc: the deliverable's numbers, re-derived
// ---------------------------------------------------------------------------

/**
 * How many tagged claims and how many table cells the deliverable must carry
 * for a `--check-doc` run to count as having checked anything.
 *
 * THE EMPTY-DOMAIN GUARD. Without it, deleting every tag from the document
 * makes this checker pass in silence, which is the exact shape CLAUDE.md calls
 * vacuous: a check whose domain went empty reports success. Lowering either
 * number is an edit somebody has to make deliberately.
 */
export const DOC_CHECK_FLOORS = Object.freeze({
  raw: Object.freeze({ taggedClaims: 40, tableCells: 150, tables: 6 }),
  'single-ply': Object.freeze({ taggedClaims: 3, tableCells: 5, tables: 1 }),
});

/** Strip the presentation a markdown cell may carry before comparing. */
function normaliseCell(text) {
  return text.replace(/\*/g, '').replace(/`/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Verify every tagged number and every tagged table in the deliverable.
 *
 * Returns `{ ok, checked, skipped, failures, unchecked }`. A tag naming an
 * unknown claim key FAILS rather than being skipped — a typo must not read as
 * coverage. A tag in another equipment run's namespace is skipped and counted.
 */
export function checkDoc(docText, claimMap, tables, slug) {
  const failures = [];
  let checked = 0;
  let skipped = 0;

  // (a) inline scalar claims: a number, then optional unit/emphasis, then the tag.
  // A number, optionally with thousands separators and a unit, then the tag.
  const TAG = /(-?[0-9][0-9,]*(?:\.[0-9]+)?)\s*(?:%|kg|\s)*\**\s*<!--@([a-z0-9-]+):([A-Za-z0-9_.+-]+)-->/g;
  const matches = [];
  let m;
  while ((m = TAG.exec(docText)) !== null) {
    const [, valueText, ns, key] = m;
    if (ns !== slug) { skipped += 1; continue; }
    matches.push({ valueText, key });
  }

  // (b) whole tables, cell by cell
  let tableCells = 0;
  let tablesChecked = 0;
  const TABLE = /<!--TABLE ([a-z0-9-]+):([A-Za-z0-9_-]+)-->\s*\n((?:\|.*\n?)+)/g;
  while ((m = TABLE.exec(docText)) !== null) {
    const [, ns, name, block] = m;
    if (ns !== slug) { skipped += 1; continue; }
    const table = tables[name];
    if (table === undefined) {
      failures.push(`UNKNOWN TABLE \`${ns}:${name}\` — the doc carries a table this script does not render`);
      continue;
    }
    tablesChecked += 1;
    const lines = block.trim().split('\n').filter((l) => l.trim().startsWith('|'));
    const parsed = lines.map((l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(normaliseCell));
    const header = parsed[0] ?? [];
    const body = parsed.slice(2); // header, separator, then rows
    const wantHeader = table.columns.map(normaliseCell);
    if (header.join('|') !== wantHeader.join('|')) {
      failures.push(`${ns}:${name} — column headings are \`${header.join(' | ')}\`, expected \`${wantHeader.join(' | ')}\``);
      continue;
    }
    if (body.length !== table.rows.length) {
      failures.push(`${ns}:${name} — ${body.length} rows in the doc, ${table.rows.length} computed`);
      continue;
    }
    table.rows.forEach((want, i) => {
      const got = body[i];
      const wantCells = [want.key, ...want.cells].map(normaliseCell);
      wantCells.forEach((wc, j) => {
        tableCells += 1;
        if ((got[j] ?? '') !== wc) {
          failures.push(`${ns}:${name} row ${want.key} col "${table.columns[j]}" — doc says "${got[j] ?? ''}", this run computes "${wc}"`);
        }
      });
    });
  }

  // (c) THE DOCUMENT'S CLAIM ABOUT ITS OWN COVERAGE, checked like any other.
  //
  // A sentence saying "this check resolved N claims over M cells" is exactly the
  // shape CLAUDE.md calls measured-and-never-compared, and it is the one number
  // a reader uses to decide how much the rest of the checking is worth. These
  // four keys close that: the coverage sentence is verified against what this
  // run actually did. They are self-referential and they converge — a tag's
  // presence is what is counted, not the number written inside it, so editing
  // the number does not move the count.
  const numbersInDoc = (docText.match(/(?<![\w.])[0-9]+(?:\.[0-9]+)?(?![\w])/g) ?? []).length;
  const docClaims = {
    'doc.taggedClaims': matches.filter((x) => x.key in claimMap || x.key.startsWith('doc.')).length,
    'doc.tableCells': tableCells,
    'doc.tables': tablesChecked,
    'doc.numericLiterals': numbersInDoc,
  };
  for (const { valueText, key } of matches) {
    const known = key in claimMap ? claimMap[key] : (key in docClaims ? docClaims[key] : undefined);
    if (known === undefined) {
      failures.push(`UNKNOWN CLAIM KEY \`${slug}:${key}\` — the doc cites a number this script does not compute`);
      continue;
    }
    checked += 1;
    const actual = Number.parseFloat(valueText.replace(/,/g, ''));
    if (known === null || Number.isNaN(actual) || Math.abs(Number(known) - actual) > Number.EPSILON) {
      failures.push(`${slug}:${key} — doc says ${valueText}, this run computes ${known}`);
    }
  }

  // (d) the empty-domain guard
  const floors = DOC_CHECK_FLOORS[slug] ?? { taggedClaims: 1, tableCells: 1, tables: 1 };
  if (checked < floors.taggedClaims) {
    failures.push(`ONLY ${checked} TAGGED CLAIMS RESOLVED in the \`${slug}\` namespace, floor is ${floors.taggedClaims}. Either the doc lost its tags or this check is checking nothing.`);
  }
  if (tableCells < floors.tableCells) {
    failures.push(`ONLY ${tableCells} TABLE CELLS COMPARED, floor is ${floors.tableCells}. A table lost its <!--TABLE--> marker.`);
  }
  if (tablesChecked < floors.tables) {
    failures.push(`ONLY ${tablesChecked} TABLES COMPARED, floor is ${floors.tables}.`);
  }

  return {
    ok: failures.length === 0,
    checked,
    tableCells,
    tablesChecked,
    skipped,
    failures,
    numbersInDoc,
  };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function main() {
  const argv = process.argv.slice(2);
  const flags = argv.filter((a) => a.startsWith('--'));
  const positional = argv.filter((a) => !a.startsWith('--'));
  const oplRoot = positional[0];
  const outDir = positional[1] ?? path.join(process.cwd(), 'docs', 'research');
  if (oplRoot === undefined) {
    // The dataset's real short name is in this file's header comment, where it
    // is a provenance citation. It is deliberately NOT in this string: a
    // `console.error` argument is text the program PRINTS, which is one step
    // from a screen, and `realIp.test.ts`'s "a project name moved into code
    // position in a new file" check fired on exactly this line. The guard was
    // right — the citation belongs in the comment and the usage line does not
    // need it.
    console.error('usage: node qualifyingTotalsDerive.mjs <path-to-dataset-checkout> [outDir] [--check-doc]');
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

  const slug = DERIVATION.EQUIPMENT.join('-').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const meta = {
    slug,
    datasetCommit, latestMeetDate, meetsScanned, rowsScanned,
    kept: best.size, rejects, meetsPerTier, emptyMeetsPerTier,
    consistency: consistency(rows),
    counterfactualOwnP10: counterfactualOwnFieldLadder(rows),
    worlds: worldsDiagnostics(best, rows),
    leftTail: leftTailShape(best),
    derivation: DERIVATION,
    entryRegimes: DERIVATION.TIER_ENTRY_REGIME,
    designationMethods: DERIVATION.TIER_DESIGNATION,
    markerLegend: MARKER_LEGEND,
    tierRules: Object.fromEntries(TIER_ORDER.map((t) => [t, {
      dirs: TIER_RULES[t].dirs, include: String(TIER_RULES[t].include), exclude: String(TIER_RULES[t].exclude),
    }])),
  };
  meta.checks = structuralChecks(rows, meta);
  meta.docTables = docTables(rows, meta);
  const claimMap = claims(rows, meta);

  // ---- --check-doc: compare the deliverable against this run ---------------
  if (flags.includes('--check-doc')) {
    const docPath = path.join(outDir, 'qualifying-totals.md');
    const result = checkDoc(readFileSync(docPath, 'utf8'), claimMap, meta.docTables, slug);
    console.log(`--check-doc ${docPath} [namespace ${slug}]`);
    console.log(`  tagged claims resolved: ${result.checked}   table cells compared: ${result.tableCells} in ${result.tablesChecked} tables`);
    console.log(`  tags/tables for other equipment runs, skipped here: ${result.skipped}`);
    console.log(`  numeric literals in the document: ${result.numbersInDoc} — the tagged ones above are the checked ones, the rest are prose and are NOT checked`);
    for (const f of result.failures) console.log(`  FAIL  ${f}`);
    if (!result.ok) {
      console.log('\nThe blocks this run expects (paste over the doc\'s tables):\n');
      for (const [name, table] of Object.entries(meta.docTables)) {
        console.log(renderDocTable(`${slug}:${name}`, table));
        console.log('');
      }
      process.exit(4);
    }
    console.log('  OK — every tagged number in the deliverable matches this run.');
    return;
  }

  // Equipment goes in the FILENAME, not only in the header. A generated file
  // whose name does not say which population it describes is one copy-paste
  // away from an equipped table being read as a raw one.
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, `qualifying-totals-derived-${slug}.md`), `${md(rows, meta)}\n`);
  writeFileSync(
    path.join(outDir, `qualifying-totals-derived-${slug}.json`),
    `${JSON.stringify({ meta: { ...meta, docTables: undefined }, claims: claimMap, rows }, null, 2)}\n`,
  );
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
  console.log(`designation ${JSON.stringify(DERIVATION.TIER_DESIGNATION)}`);
  const failed = meta.checks.filter((c) => !c.ok);
  for (const c of meta.checks) console.log(`  ${c.status.padEnd(5)} ${c.name} — ${c.detail} [domain ${c.domain}]`);
  console.log(`checks: ${meta.checks.filter((c) => c.status === 'PASS').length} PASS, ${meta.checks.filter((c) => c.status === 'EMPTY').length} EMPTY (ran on nothing), ${failed.length} FAIL`);
  if (failed.length > 0) {
    console.error(`${failed.length} structural check(s) FAILED — the emitted table does not satisfy its own stated properties.`);
    process.exit(3);
  }
}

if (process.argv[1] && process.argv[1].endsWith('qualifyingTotalsDerive.mjs')) main();
