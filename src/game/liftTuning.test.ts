/**
 * Guards on the lift mechanic's tuning file.
 *
 * `liftTuning.ts` is the one place a playtester edits, and GDD §12.1 budgets
 * roughly 30 hand passes over it. Everything below is a rule a hand pass could
 * plausibly break without breaking anything that looks related:
 *
 *   - a threshold ordering that silently makes a state unreachable
 *   - a force balance where nothing can ever stall, or nothing can ever be
 *     driven through, so the mechanic has no sticking point at all
 *   - copy that no longer covers its table
 *   - a feel value that has been written into a component instead of here
 *
 * NONE OF THESE SAY THE VALUES ARE RIGHT. No test can. They say the values are
 * still self-consistent, and that the mechanic still has the shape the file
 * claims it has.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  LIFT_COPY,
  LIFT_TUNING,
  LOAD_PRESETS,
  LOAD_RANGE,
  STICK_HEIGHT_FRAC,
  STICK_WIDTH,
  TICK_HZ,
  TICK_MS,
  byLoad,
  clampLoadRatio,
  loadT,
  type HapticStyle,
} from './liftTuning';
import {
  STICK,
  STRAIN,
  TICK_MS as ART_TICK_MS,
  TICK_HZ as ART_TICK_HZ,
} from '../art/spriteTuning';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// The coupling to the sprite system, made visible
// ---------------------------------------------------------------------------

describe('shared facts', () => {
  it('runs on the same clock as the sprite animation', () => {
    expect(TICK_MS).toBe(ART_TICK_MS);
    expect(TICK_HZ).toBe(ART_TICK_HZ);
    expect(TICK_MS).toBeCloseTo(1000 / TICK_HZ, 9);
  });

  it('puts the mechanical sticking point where the sprite draws one', () => {
    // If these ever disagree the bar stalls at one height and the lifter is
    // drawn fighting at another, which is the kind of incoherence that is
    // invisible in either file on its own.
    expect(STICK_HEIGHT_FRAC).toBe(STICK.HEIGHT_FRAC);
    expect(STICK_WIDTH).toBe(STICK.WIDTH);
    expect(STICK_HEIGHT_FRAC).toBeGreaterThan(0);
    expect(STICK_HEIGHT_FRAC).toBeLessThan(1);
  });

  it('draws a played rep from the same strain model as the canned one', () => {
    // These numbers are written down twice — here and in `spriteTuning.ts` —
    // following this file's convention for the art values it restates. The
    // convention is only safe while they agree: the canned animation is the
    // inspection harness the sprite sheet is JUDGED from (see
    // `tools/sprites.mjs`), so a value that drifts on one side makes the
    // contact sheet stop describing the app, and neither file looks wrong on
    // its own. Exactly the failure `BRACE_SETTLE_DEPTH` was pulled out for.
    expect(LIFT_TUNING.STRAIN_FROM_LOAD).toEqual(STRAIN.FROM_LOAD);
    for (const [key, value] of Object.entries(LIFT_TUNING.STRAIN_PHASE_WEIGHT)) {
      expect(STRAIN.PHASE_WEIGHT, `phase weight ${key}`).toHaveProperty(key, value);
    }
    // ...and the scan is not vacuous: the live table has to have entries.
    expect(Object.keys(LIFT_TUNING.STRAIN_PHASE_WEIGHT).length).toBeGreaterThan(0);
  });

  it('never draws the brace heavier than the top of the descent it leads into', () => {
    // The brace is the top of the descent, held still. Weighted above
    // DESCENT_TOP it makes the lifter strain standing and then loosen on the
    // first moving tick. `liftFrame.test.ts` measures the drawn consequence on
    // played reps; this is the ordering that guarantees it at every load.
    const w = LIFT_TUNING.STRAIN_PHASE_WEIGHT;
    expect(w.BRACE).toBeLessThanOrEqual(w.DESCENT_TOP);
    expect(w.DESCENT_TOP).toBeLessThan(w.DESCENT_BOTTOM);
  });

  it('shares the load curve rather than restating it', () => {
    expect(loadT(LOAD_RANGE.MIN)).toBe(0);
    expect(loadT(LOAD_RANGE.MAX)).toBe(1);
    expect(clampLoadRatio(0)).toBe(LOAD_RANGE.MIN);
    expect(clampLoadRatio(99)).toBe(LOAD_RANGE.MAX);
    let previous = -Infinity;
    for (let r = LOAD_RANGE.MIN; r <= LOAD_RANGE.MAX; r += 0.01) {
      const t = loadT(r);
      expect(t).toBeGreaterThanOrEqual(previous);
      previous = t;
    }
  });
});

// ---------------------------------------------------------------------------
// Immutability
// ---------------------------------------------------------------------------

describe('immutability', () => {
  it('freezes the tuning block and its nested tables', () => {
    expect(Object.isFrozen(LIFT_TUNING)).toBe(true);
    expect(Object.isFrozen(LIFT_TUNING.HAPTICS)).toBe(true);
    expect(Object.isFrozen(LIFT_TUNING.FEEDBACK)).toBe(true);
    expect(Object.isFrozen(LIFT_TUNING.STRAIN_PHASE_WEIGHT)).toBe(true);
    expect(Object.isFrozen(LIFT_COPY)).toBe(true);
    for (const p of Object.values(LIFT_TUNING.HAPTICS)) {
      expect(Object.isFrozen(p)).toBe(true);
      expect(Object.isFrozen(p.beats)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Orderings that keep states reachable
// ---------------------------------------------------------------------------

describe('depth thresholds', () => {
  it('leaves room between illegal, ideal and buried', () => {
    expect(LIFT_TUNING.DEPTH_LEGAL).toBeGreaterThan(0);
    expect(LIFT_TUNING.DEPTH_LEGAL).toBeLessThan(LIFT_TUNING.DEPTH_IDEAL);
    expect(LIFT_TUNING.DEPTH_IDEAL).toBeLessThan(LIFT_TUNING.DEPTH_COLLAPSE);
  });

  it('never lets the late edge of the depth window be an instant bury', () => {
    // The early edge is handled in `lift.ts` by clamping the window to the
    // legal range — see `depthWindowHalfTicks`, and the played-rep test in
    // `lift.test.ts` that measures it. The LATE edge has no such clamp, so it
    // is checked here: releasing at the far end of the window must still leave
    // the lifter above the point of collapse.
    for (const load of Object.values(LOAD_PRESETS)) {
      const rate = byLoad(LIFT_TUNING.DESCENT_DEPTH_PER_TICK, clampLoadRatio(load));
      const halfWindowDepth = (LIFT_TUNING.DEPTH_WINDOW_MS / 2 / TICK_MS) * rate;
      expect(LIFT_TUNING.DEPTH_IDEAL + halfWindowDepth, `load ${load}`).toBeLessThan(
        LIFT_TUNING.DEPTH_COLLAPSE,
      );
    }
  });

  it('leaves at least a couple of ticks between legal depth and the ideal one', () => {
    // If these were the same depth the window would collapse to nothing at
    // every load and the depth beat would become a single-frame check.
    for (const load of Object.values(LOAD_PRESETS)) {
      const rate = byLoad(LIFT_TUNING.DESCENT_DEPTH_PER_TICK, clampLoadRatio(load));
      const ticks = (LIFT_TUNING.DEPTH_IDEAL - LIFT_TUNING.DEPTH_LEGAL) / rate;
      expect(ticks, `load ${load}`).toBeGreaterThan(2);
    }
  });
});

describe('the force balance', () => {
  const demandPeak = (load: number): number =>
    byLoad(LIFT_TUNING.DEMAND_BASE, clampLoadRatio(load)) +
    byLoad(LIFT_TUNING.DEMAND_STICK_GAIN, clampLoadRatio(load));

  it('gives a limit attempt a sticking point the lifter cannot hold', () => {
    // Without this there is no grind, the drive input does nothing, and the
    // mechanic is a cutscene with a button on it.
    expect(demandPeak(LOAD_PRESETS.MAXIMAL)).toBeGreaterThan(LIFT_TUNING.LIFTER_CAPACITY);
  });

  it('leaves a warm-up with no sticking point at all', () => {
    expect(demandPeak(LOAD_PRESETS.WARMUP)).toBeLessThan(LIFT_TUNING.LIFTER_CAPACITY);
  });

  it('makes a full-quality drive enough to clear the worst deficit', () => {
    // The other half of the same coin: if the boost cannot cover the deficit at
    // the top of the load range, a maximal attempt is unwinnable however it is
    // played, and the timing input is decoration.
    const worstDeficit = demandPeak(LOAD_RANGE.MAX) - LIFT_TUNING.LIFTER_CAPACITY;
    expect(LIFT_TUNING.DRIVE_BOOST_FORCE_MAX).toBeGreaterThan(worstDeficit);
  });

  it('arms the drive cue below the sticking point, not after it', () => {
    expect(LIFT_TUNING.DRIVE_ARM_HEIGHT).toBeLessThan(STICK_HEIGHT_FRAC);
    expect(LIFT_TUNING.DRIVE_ARM_HEIGHT).toBeGreaterThan(0);
  });

  it('keeps the stall-decay trigger below the grind threshold', () => {
    // Merging these two produced a death spiral: a bar driven well enough to
    // creep was charged decay for the ticks the velocity lag took to catch up,
    // which lowered its target, which charged more decay.
    expect(LIFT_TUNING.STALL_DECAY_VELOCITY).toBeLessThan(LIFT_TUNING.GRIND_STALL_VELOCITY);
    expect(LIFT_TUNING.STALL_DECAY_VELOCITY).toBeGreaterThan(0);
  });

  it('cannot decay the lifter to a standstill', () => {
    expect(LIFT_TUNING.STALL_CAPACITY_DECAY_MAX).toBeLessThan(LIFT_TUNING.LIFTER_CAPACITY);
    expect(LIFT_TUNING.STALL_CAPACITY_DECAY_PER_TICK).toBeGreaterThan(0);
  });

  it('keeps the velocity model inside sane bounds', () => {
    expect(LIFT_TUNING.VELOCITY_RESPONSE).toBeGreaterThan(0);
    expect(LIFT_TUNING.VELOCITY_RESPONSE).toBeLessThanOrEqual(1);
    expect(LIFT_TUNING.VELOCITY_PER_NET_FORCE).toBeGreaterThan(0);
    expect(LIFT_TUNING.MAX_RISE_VELOCITY).toBeGreaterThan(0);
    expect(LIFT_TUNING.MAX_SINK_VELOCITY).toBeGreaterThan(0);
    // A full ascent must not be possible in fewer ticks than the eye can read.
    expect(1 / LIFT_TUNING.MAX_RISE_VELOCITY).toBeGreaterThan(TICK_HZ / 4);
  });

  it('gives the collapse rule room to fire before the timeout does', () => {
    const ticksToCollapse =
      LIFT_TUNING.ASCENT_COLLAPSE_DROP / LIFT_TUNING.MAX_SINK_VELOCITY;
    expect(ticksToCollapse).toBeLessThan(LIFT_TUNING.ASCENT_TIMEOUT_TICKS);
    expect(LIFT_TUNING.ASCENT_COLLAPSE_DROP).toBeGreaterThan(0);
  });
});

describe('windows', () => {
  it('are positive and at least a few ticks wide', () => {
    for (const ms of [LIFT_TUNING.DEPTH_WINDOW_MS, LIFT_TUNING.DRIVE_WINDOW_MS]) {
      expect(ms).toBeGreaterThan(0);
      // Narrower than about four ticks and the window cannot be hit reliably at
      // 60 Hz even before fatigue tightens it.
      expect(ms / TICK_MS).toBeGreaterThan(4);
    }
  });

  it('keep a perfect band that is neither the whole window nor nothing', () => {
    expect(LIFT_TUNING.PERFECT_BAND_FRACTION).toBeGreaterThan(0);
    expect(LIFT_TUNING.PERFECT_BAND_FRACTION).toBeLessThan(1);
  });

  it('open the drive cue after arming, not before it', () => {
    expect(LIFT_TUNING.DRIVE_IDEAL_LEAD_MS).toBeGreaterThan(LIFT_TUNING.DRIVE_WINDOW_MS / 2);
  });

  it('keeps the drive a decision rather than a rate', () => {
    expect(LIFT_TUNING.DRIVE_ATTEMPTS_PER_REP).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(LIFT_TUNING.DRIVE_ATTEMPTS_PER_REP)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Haptics and copy
// ---------------------------------------------------------------------------

const KNOWN_STYLES: readonly HapticStyle[] = [
  'selection',
  'light',
  'medium',
  'heavy',
  'rigid',
  'soft',
  'success',
  'warning',
  'error',
];

describe('haptics', () => {
  it('has at least one beat per pattern, with a known style', () => {
    for (const [name, p] of Object.entries(LIFT_TUNING.HAPTICS)) {
      expect(p.beats.length, name).toBeGreaterThan(0);
      for (const beat of p.beats) {
        expect(KNOWN_STYLES, `${name} style`).toContain(beat.style);
        expect(beat.delayMs, `${name} delay`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('orders the beats of each pattern forward in time', () => {
    for (const [name, p] of Object.entries(LIFT_TUNING.HAPTICS)) {
      let previous = -Infinity;
      for (const beat of p.beats) {
        expect(beat.delayMs, name).toBeGreaterThanOrEqual(previous);
        previous = beat.delayMs;
      }
    }
  });

  it('gives a perfect drive a bigger pattern than a scruffy one', () => {
    // Not a claim that it feels better. A claim that the two are distinguishable
    // at all, which a table that had drifted into using one pattern for both
    // would not be.
    expect(LIFT_TUNING.HAPTICS.DRIVE_PERFECT.beats.length).toBeGreaterThan(
      LIFT_TUNING.HAPTICS.DRIVE_LOOSE.beats.length,
    );
  });

  it('pulses the stall on a period the ear and hand can separate', () => {
    expect(LIFT_TUNING.STALL_PULSE_PERIOD_TICKS).toBeGreaterThan(1);
    expect(LIFT_TUNING.STALL_PULSE_PERIOD_TICKS * TICK_MS).toBeGreaterThan(50);
  });
});

describe('presentation feel', () => {
  it('has positive durations and a legible cue ring', () => {
    const f = LIFT_TUNING.FEEDBACK;
    expect(f.CUE_RING_OUTER_R).toBeGreaterThan(f.CUE_RING_INNER_R);
    expect(f.CUE_RING_INNER_R).toBeGreaterThan(0);
    expect(f.CUE_RING_STROKE).toBeGreaterThan(0);
    for (const ms of [
      f.CUE_PULSE_MS,
      f.HIT_FLASH_MS,
      f.SHAKE_PERIOD_MS,
      f.OUTCOME_FADE_MS,
      f.LIGHT_REVEAL_STAGGER_MS,
    ]) {
      expect(ms).toBeGreaterThan(0);
    }
    expect(f.TRACE_MAX_POINTS).toBeGreaterThan(1);
    expect(f.TRACE_MIN_ALPHA).toBeGreaterThanOrEqual(0);
    expect(f.TRACE_MIN_ALPHA).toBeLessThan(1);
  });

  it('keeps the sprite on an integer nearest-neighbour scale (GDD §7.1)', () => {
    // A fractional upscale produces uneven pixel sizes and is the single most
    // common way pixel art gets ruined in a mobile app.
    expect(Number.isInteger(LIFT_TUNING.FEEDBACK.SPRITE_SCALE)).toBe(true);
    expect(LIFT_TUNING.FEEDBACK.SPRITE_SCALE).toBeGreaterThanOrEqual(1);
  });
});

describe('copy', () => {
  it('says something for every prompt', () => {
    for (const [key, value] of Object.entries(LIFT_COPY.PROMPT)) {
      expect(value.length, key).toBeGreaterThan(0);
    }
  });

  it('never puts a number in the copy the player reads', () => {
    // A percentage or a level in this table is how a fatigue meter gets shipped
    // by accident (GDD §3.4, §12.3).
    const all = JSON.stringify(LIFT_COPY);
    expect(all).not.toMatch(/\d/);
  });
});

// ---------------------------------------------------------------------------
// THE MAGIC-NUMBER SCAN — THIS ONE IS LOCAL AND IS NOT THE AUTHORITY
//
// CLAUDE.md: "Never scatter them as magic numbers across components."
//
// `src/tuning/audit.ts` is the tree-wide enforcement of that rule and it is
// STRICTER than what follows: it understands regex literals and template
// interpolations, and it does not treat a bare `2` in a property-value
// position as structural. What is kept here is what it does NOT do — the
// dead-knob sweep over `LIFT_TUNING`'s own keys, and the structural fence that
// keeps a base window width out of the renderer. Those are about this file's
// contents, not about the tree, so they belong beside this file.
//
// The numeric scan below is therefore redundant but not wrong. It is left in
// place because a second, independently written scan over the same directory
// is cheap insurance against a bug in the first one.
// ---------------------------------------------------------------------------

/** Strip comments and string literals so only real code is scanned. */
function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/`(?:\\.|[^`\\])*`/g, '``');
}

/**
 * Numeric literals that are structure rather than feel.
 *
 * 0, 1 and 2 are indices, halves, and the identity of a multiplier. Anything
 * else in these files is a value somebody would want to turn by hand, and it
 * belongs in `LIFT_TUNING`.
 */
const STRUCTURAL = new Set(['0', '1', '2']);

/**
 * THE LEADING-DOT HOLE, and why the pattern is two alternatives.
 *
 * This used to be `(?<![\w.$])\d+(?:\.\d+)?`, which requires a literal to start
 * with a DIGIT. JavaScript does not: `x * .5` and `{ gain: .35 }` are perfectly
 * ordinary, and the lookbehind then rejected the `5` outright because the
 * character before it is a `.`. So the single most natural way to write a
 * fractional feel value walked straight through the scan.
 *
 * The `\.\d+` alternative closes it. Order matters and it is second: at a
 * position inside `1.5` the first alternative matches the whole literal and
 * consumes the fraction, so a normal decimal is still reported once, as
 * `1.5`, rather than twice. Member access cannot be caught by the new branch —
 * an identifier may not start with a digit, so `pose.hipY` has nothing for
 * `\.\d+` to match, and `arr[0].x` is covered by the lookbehind.
 */
const NUMERIC_LITERAL = /(?<![\w.$])(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?/gi;

function magicNumbersIn(source: string): string[] {
  const code = codeOnly(source);
  const found: string[] = [];
  for (const match of code.matchAll(NUMERIC_LITERAL)) {
    const literal = match[0];
    if (STRUCTURAL.has(literal)) continue;
    found.push(literal);
  }
  return found;
}

function sourcesUnder(dir: string, extensions: readonly string[]): { file: string; source: string }[] {
  const out: { file: string; source: string }[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry);
    if (entry.endsWith('.test.ts') || entry.endsWith('.test.tsx')) continue;
    if (extensions.some((e) => entry.endsWith(e))) {
      out.push({ file: full, source: readFileSync(full, 'utf8') });
    }
  }
  return out;
}

/**
 * Tuning keys that nothing in `sources` READS.
 *
 * Through `codeOnly`, which is the whole point and which it did not used to do.
 * The scan used to substring-match the raw file text, so a key MENTIONED IN A
 * COMMENT counted as read — and a comment naming a tuning value is exactly
 * where one ends up after the code that read it is deleted, which is the shape
 * of dead knob this test exists to catch. These files are dense with comments
 * naming their own constants, so the hole was not theoretical.
 */
function deadKeys(keys: readonly string[], sources: readonly string[]): string[] {
  const code = sources.map(codeOnly).join('\n');
  return keys.filter((key) => !code.includes(key));
}

describe('no feel value lives outside this file', () => {
  it('keeps the mechanic itself free of bare numbers', () => {
    const source = readFileSync(path.join(HERE, 'lift.ts'), 'utf8');
    expect(magicNumbersIn(source)).toEqual([]);
  });

  it('keeps every lift component and adapter free of bare numbers', () => {
    const liftDir = path.join(HERE, '..', 'lift');
    const files = sourcesUnder(liftDir, ['.ts', '.tsx']);
    // If this ever finds nothing, the rule is being enforced against an empty
    // set and the test is worthless. The renderer must exist.
    expect(files.length).toBeGreaterThan(0);
    for (const { file, source } of files) {
      expect(magicNumbersIn(source), path.basename(file)).toEqual([]);
    }
  });

  it('has no dead knob: every tuning value is read by something', () => {
    // A constant nobody reads is worse than a magic number. A playtester turns
    // it, nothing happens, and they lose trust in the whole file. This caught
    // five: SHAKE_MAX_PX, SHAKE_PERIOD_MS, HIT_FLASH_MS, CUE_PULSE_MS and
    // LIGHT_REVEAL_STAGGER_MS were all declared and none was wired up.
    //
    // See `deadKeys` for why the scan goes through `codeOnly`.
    const sources = [
      ...sourcesUnder(HERE, ['.ts']),
      ...sourcesUnder(path.join(HERE, '..', 'lift'), ['.ts', '.tsx']),
    ]
      .filter((f) => !f.file.endsWith('liftTuning.ts'))
      .map((f) => f.source);
    expect(sources.length).toBeGreaterThan(0);

    const keys: string[] = [
      ...Object.keys(LIFT_TUNING),
      ...Object.keys(LIFT_TUNING.FEEDBACK),
      ...Object.keys(LIFT_TUNING.LAYOUT),
      ...Object.keys(LIFT_TUNING.DEMO),
      // Nested one level down, and previously unchecked entirely — which is how
      // a phase weighting nothing reads could have been added without anything
      // noticing. `codeOnly` strips the `'BRACE'`/`'HOLE'` phase-name strings,
      // so what remains is the `w.BRACE` style access in `liveStrain`.
      ...Object.keys(LIFT_TUNING.STRAIN_PHASE_WEIGHT),
    ];
    const dead = deadKeys(keys, sources);
    expect(dead, `unused tuning values: ${dead.join(', ')}`).toEqual([]);
  });

  it('would call a knob dead if its only mention were a comment', () => {
    // The dead-knob scan, run against sources built to defeat it. Without
    // `codeOnly` the first two cases come back clean and the guard is a
    // rubber stamp on any constant whose reader has been deleted.
    expect(deadKeys(['GHOST_KNOB'], ['// GHOST_KNOB used to scale the shake'])).toEqual([
      'GHOST_KNOB',
    ]);
    expect(deadKeys(['GHOST_KNOB'], ['/* see GHOST_KNOB */ const x = 1;'])).toEqual(['GHOST_KNOB']);
    expect(deadKeys(['GHOST_KNOB'], ["const label = 'GHOST_KNOB';"])).toEqual(['GHOST_KNOB']);
    // ...and a real read still counts as read, or the guard would fail on
    // everything and say nothing.
    expect(deadKeys(['GHOST_KNOB'], ['const a = LIFT_TUNING.GHOST_KNOB;'])).toEqual([]);
  });

  it('keeps the base window widths out of the renderer (GDD §3.4, §12.3)', () => {
    // A FATIGUE METER BY THE BACK DOOR, closed structurally.
    //
    // `CueWindow.widthMs` is the window AFTER fatigue has narrowed it. A
    // component that divided it by `LIFT_TUNING.DRIVE_WINDOW_MS` would have a
    // 0..1 fatigue ratio, and a 0..1 ratio one `<View style={{width}}>` away
    // from being the meter §12.3 refuses. The adjusted width cannot be hidden —
    // `(closeTick - idealTick) * TICK_MS * 2` reconstructs it, and the tick
    // bounds are what the cue ring is drawn from — so the DENOMINATOR is what
    // gets kept away instead.
    //
    // Nothing under `src/lift/` has any use for a base width: the ring is sized
    // from `cueProgress`, which is already normalised. So mentioning one at all
    // is the tell.
    const files = sourcesUnder(path.join(HERE, '..', 'lift'), ['.ts', '.tsx']);
    expect(files.length).toBeGreaterThan(0);
    for (const { file, source } of files) {
      const code = codeOnly(source);
      for (const base of ['DEPTH_WINDOW_MS', 'DRIVE_WINDOW_MS']) {
        expect(code, `${path.basename(file)} reads ${base}`).not.toContain(base);
      }
    }
    // ...and the scan is not vacuous: it does find them where they belong.
    expect(codeOnly(readFileSync(path.join(HERE, 'lift.ts'), 'utf8'))).toContain(
      'DRIVE_WINDOW_MS',
    );
  });

  it('actually detects a bare number, so the scan is not vacuous', () => {
    expect(magicNumbersIn('const windowMs = 240;')).toEqual(['240']);
    expect(magicNumbersIn('const scale = 0.85;')).toEqual(['0.85']);
    // THE LEADING-DOT HOLE, pinned. Every one of these walked through the old
    // pattern untouched, which made `x * .5` the safe way to smuggle a feel
    // value into a component.
    expect(magicNumbersIn('const scale = .85;')).toEqual(['.85']);
    expect(magicNumbersIn('const half = x * .5;')).toEqual(['.5']);
    expect(magicNumbersIn('const o = { gain: .35, drop: .1 };')).toEqual(['.35', '.1']);
    // ...and a normal decimal is still reported once, whole, not split in two.
    expect(magicNumbersIn('const a = 1.5;')).toEqual(['1.5']);
    expect(magicNumbersIn('const a = 10.25e-3;')).toEqual(['10.25e-3']);
    // ...and does not trip over the things it is meant to allow.
    expect(magicNumbersIn('const half = x / 2; const first = list[0];')).toEqual([]);
    expect(magicNumbersIn('// tuned to 240ms by hand')).toEqual([]);
    expect(magicNumbersIn('// half the window: .5 of it')).toEqual([]);
    expect(magicNumbersIn("const label = 'DRIVE 240';")).toEqual([]);
    expect(magicNumbersIn('const a = LIFT_TUNING.DEPTH_WINDOW_MS;')).toEqual([]);
    expect(magicNumbersIn('const y = pose.hipY - state.barForwardPx;')).toEqual([]);
  });

});
