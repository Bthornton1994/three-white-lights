/**
 * Tests for the adapter between a live rep and the sprite system.
 *
 * This is the only part of the renderer that can be tested without a canvas, so
 * it is where the renderer's checkable claims live:
 *
 *   - a played rep lands on the AUTHORED drawings, not on a continuum
 *   - a maximal grind draws a genuinely uglier lifter than a light rep, which
 *     is GDD §12.2's "does a maximal attempt animate *heavier* than a light
 *     one" reduced to the half a test can answer
 *   - the bar-path plot's geometry stays inside its panel and does not collide
 *     with the sprite
 *   - the cue ring meets its target at exactly the tick the input grades
 *     'perfect', rather than approximately
 *
 * WHAT IS NOT TESTED HERE, said plainly: whether any of it looks right. That
 * needs rendered pixels and a person.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  LIFT_PHASES,
  braceTicks,
  createLift,
  descentRate,
  runLift,
  type LiftState,
  type ScriptedInput,
} from '../game/lift';
import { LIFT_TUNING, LOAD_PRESETS, TICK_MS } from '../game/liftTuning';
import { QUANTISE, RESOLUTION, STRAIN } from '../art/spriteTuning';
import { BAR_AND_COLLARS_KG } from '../art/plates';
import {
  bodyPixelDiff,
  headBox,
  renderLifterFrame,
  unionRect,
  type LifterFrameSpec,
} from '../art/lifterSprite';
import {
  SPRITE_BOX,
  barGlyphColour,
  commandHit,
  grindReadout,
  stallBand,
  cuePulse,
  cueRing,
  hitFlash,
  stageArmed,
  stageShake,
  directionFor,
  drawnKindFor,
  frameKey,
  liftFrameSpec,
  liveStrain,
  totalKgFor,
  traceAlpha,
  tracePoints,
  traceX,
  traceY,
} from './liftFrame';
import { LIFT_PALETTE } from './liftPalette';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const L = LIFT_TUNING.LAYOUT;
const DEMO_KG = LIFT_TUNING.DEMO.BEST_SINGLE_KG;

// ---------------------------------------------------------------------------
// Harness — reuses the real mechanic, so what is measured is what is drawn.
// ---------------------------------------------------------------------------

function scriptFor(load: number, drive: boolean): ScriptedInput[] {
  const press = braceTicks(load, 'squat') + 1;
  const release = press + Math.round(LIFT_TUNING.DEPTH_IDEAL.squat / descentRate(load, 'squat'));
  const script: ScriptedInput[] = [
    { tick: press, kind: 'press' },
    { tick: release, kind: 'release' },
  ];
  if (!drive) return script;
  const probe = runLift({ kind: 'squat', loadRatio: load, seed: 4 }, script);
  for (const state of probe.history) {
    if (state.events.some((e) => e.kind === 'drive-cue-open')) {
      const ideal = state.activeCue?.idealTick;
      if (ideal !== undefined) script.push({ tick: ideal, kind: 'press' });
      break;
    }
  }
  return script;
}

function rep(load: number, drive: boolean = true): readonly LiftState[] {
  return runLift({ kind: 'squat', loadRatio: load, seed: 4 }, scriptFor(load, drive)).history;
}

// ---------------------------------------------------------------------------
// Strain
// ---------------------------------------------------------------------------

describe('liveStrain', () => {
  it('stays in range for every state a rep can be in', () => {
    for (const load of [0.4, 0.75, 1.0, 1.05]) {
      for (const state of rep(load)) {
        const s = liveStrain(state);
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(1);
      }
    }
  });

  it('draws a losing bar as more strained than a winning one', () => {
    // Held at one real ascent state and varied ONLY in net force, so the
    // comparison isolates the struggle term instead of picking up the phase
    // weighting's dependence on height. The canned animation has no way to
    // express this at all; a played rep does.
    const base = rep(LOAD_PRESETS.MAXIMAL, false).find((s) => s.phase === 'ASCENT');
    expect(base).toBeDefined();
    if (base === undefined) return;
    const winning = liveStrain({ ...base, netForce: LIFT_TUNING.STRUGGLE_FULL_DEFICIT });
    const losing = liveStrain({ ...base, netForce: -LIFT_TUNING.STRUGGLE_FULL_DEFICIT });
    expect(losing).toBeGreaterThan(winning);
  });

  it('reaches a real deficit during an undriven limit attempt', () => {
    // Without this the test above would be a statement about a term nothing
    // ever exercises. A rep that is losing has to actually happen.
    const worst = rep(LOAD_PRESETS.MAXIMAL, false)
      .filter((s) => s.phase === 'ASCENT')
      .reduce((m, s) => Math.min(m, s.netForce), Infinity);
    expect(worst).toBeLessThan(0);
    const drawn = rep(LOAD_PRESETS.MAXIMAL, false)
      .filter((s) => s.phase === 'ASCENT')
      .map((s) => liftFrameSpec(s, DEMO_KG).strainLevel);
    expect(Math.max(...drawn)).toBe(STRAIN.LEVELS - 1);
  });

  it('rises with load at the same point in the rep', () => {
    const atHole = (load: number): number => {
      const state = rep(load).find((s) => s.phase === 'HOLE');
      expect(state, `no hole at load ${load}`).toBeDefined();
      return state === undefined ? 0 : liveStrain(state);
    };
    expect(atHole(LOAD_PRESETS.MAXIMAL)).toBeGreaterThan(atHole(LOAD_PRESETS.LIGHT));
  });
});

describe('directionFor', () => {
  it('answers for every phase, and turns around at the reversal', () => {
    for (const phase of LIFT_PHASES) {
      expect(['DESCENT', 'ASCENT']).toContain(directionFor(phase));
    }
    expect(directionFor('DESCENT')).toBe('DESCENT');
    expect(directionFor('HOLE')).toBe('DESCENT');
    expect(directionFor('ASCENT')).toBe('ASCENT');
    expect(directionFor('LOCKOUT')).toBe('ASCENT');
  });
});

describe('totalKgFor', () => {
  it('never draws less than an empty bar', () => {
    expect(totalKgFor(0, DEMO_KG)).toBeGreaterThanOrEqual(BAR_AND_COLLARS_KG);
    expect(totalKgFor(0.01, DEMO_KG)).toBeGreaterThanOrEqual(BAR_AND_COLLARS_KG);
  });

  it('rounds to a weight a platform could plausibly show', () => {
    const step = LIFT_TUNING.DEMO.ROUND_TO_KG;
    for (const ratio of [0.55, 0.62, 0.75, 0.881, 1.0]) {
      const kg = totalKgFor(ratio, DEMO_KG);
      expect(Math.abs(kg / step - Math.round(kg / step))).toBeLessThan(Number.EPSILON * kg + 1e-9);
    }
  });

  it('is monotone in load', () => {
    let previous = -Infinity;
    for (let ratio = 0.4; ratio <= 1.05; ratio += 0.05) {
      const kg = totalKgFor(ratio, DEMO_KG);
      expect(kg).toBeGreaterThanOrEqual(previous);
      previous = kg;
    }
  });
});

// ---------------------------------------------------------------------------
// The drawing
// ---------------------------------------------------------------------------

describe('liftFrameSpec', () => {
  it('lands on the authored depth steps, not on a continuum', () => {
    // GDD §7.1: a 16-bit game ships a finite sheet. If a played rep produced a
    // new depth every tick it would read as a modern engine wearing sprites —
    // and the image cache would never hit.
    const depths = new Set<number>();
    for (const state of rep(LOAD_PRESETS.MAXIMAL)) {
      const spec = liftFrameSpec(state, DEMO_KG);
      depths.add(spec.depth);
      expect(Number.isFinite(spec.depth * QUANTISE.DEPTH_STEPS)).toBe(true);
      expect(Math.abs(spec.depth * QUANTISE.DEPTH_STEPS - Math.round(spec.depth * QUANTISE.DEPTH_STEPS)))
        .toBeLessThan(1e-9);
    }
    expect(depths.size).toBeLessThanOrEqual(QUANTISE.DEPTH_STEPS + 1);
    // ...and it must still be an animation, not one held pose.
    expect(depths.size).toBeGreaterThan(2);
  });

  it('keeps every drawn field finite and inside the ranges the sprite allows', () => {
    for (const load of [0.4, 0.88, 1.05]) {
      for (const state of rep(load, false)) {
        const spec = liftFrameSpec(state, DEMO_KG);
        expect(spec.strainLevel).toBeGreaterThanOrEqual(0);
        expect(spec.strainLevel).toBeLessThan(STRAIN.LEVELS);
        expect(spec.pitchLevel ?? 0).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(spec.barLateralPx)).toBe(true);
        expect(Number.isFinite(spec.barTiltDeg)).toBe(true);
        expect(Number.isFinite(spec.barBendPx)).toBe(true);
        expect(spec.barKg).toBe(BAR_AND_COLLARS_KG);
      }
    }
  });

  it('draws a maximal grind uglier than a light rep', () => {
    // The half of GDD §12.2's sprite bar that is checkable without reference
    // art: a limit attempt must reach drawings a warm-up never touches.
    const peak = (load: number, drive: boolean) => {
      let strain = 0;
      let pitch = 0;
      for (const state of rep(load, drive)) {
        const spec = liftFrameSpec(state, DEMO_KG);
        strain = Math.max(strain, spec.strainLevel);
        pitch = Math.max(pitch, spec.pitchLevel ?? 0);
      }
      return { strain, pitch };
    };
    const light = peak(LOAD_PRESETS.LIGHT, true);
    const maximal = peak(LOAD_PRESETS.MAXIMAL, false);
    expect(maximal.strain).toBeGreaterThan(light.strain);
    expect(maximal.pitch).toBeGreaterThan(light.pitch);
    expect(maximal.strain).toBe(STRAIN.LEVELS - 1);
  });
});

// ---------------------------------------------------------------------------
// THE BRACE — the frame the screen opens on, and the only beat with no motion
//
// Every other heaviness cue the lift has is a MOTION cue: the stall, the
// forward drift, the shake, the tilt, the whip, the tick counts. All of them
// are identically zero in a still frame. The brace is a still frame, it is the
// first thing the player sees, and `lift.ts` holds it for up to
// BRACE_TIMEOUT_TICKS. So it is the one beat where the BODY has to carry the
// weight by itself, and the one place a "the two reps differ" test can pass on
// the barbell alone while the lifter is the same drawing at every load.
//
// Hence the shape of the assertions below, which follows `body-load.png`:
//
//   - measured on the LIFTER palette bank only, so the plate stacks — the
//     loudest difference between a 120 kg brace and a 220 kg one — cannot
//     contribute a single pixel;
//   - with the barbell held IDENTICAL on both sides, because the hands are
//     drawn from the bar's bend, tilt and shake and the hands ARE body bank.
//     Let the bend differ and the sleeve droop moves the hands, and the body
//     diff is measuring the bar again by the back door;
//   - with the head box masked out, so neither the grimace nor the flushed
//     face can carry the number;
//   - and as COUNTS with floors, because "something changed" is worth nothing.
// ---------------------------------------------------------------------------

/**
 * Floors for the braced body, light against maximal.
 *
 * Measured at this tuning, head masked: 41 silhouette / 215 changed of 1255
 * body px. Before the phase weighting was fixed: 0 and 0 — not "small", the
 * literally identical drawing, since both loads floored onto strain rung 0 and
 * rung 0 is the authored pose untouched.
 *
 * The floors sit well above zero so a single stray pixel cannot satisfy them,
 * and well below the measured values so a hand pass has room.
 */
const FLOOR_BRACE_SILHOUETTE = 20;
const FLOOR_BRACE_CHANGED = 120;

/** Weight drawn on the bar for both sides of a brace comparison. */
const BRACE_COMPARE_KG = 250;

describe('the braced body answers to the load, not only the bar', () => {
  /** The last braced tick: set, loaded, nothing asked for yet. */
  const braceState = (load: number): LiftState => {
    const braced = rep(load, false).filter((s) => s.phase === 'BRACE');
    const last = braced[braced.length - 1];
    if (last === undefined) throw new Error(`no braced tick at load ${load}`);
    return last;
  };

  /**
   * The braced drawing with the barbell normalised away: same weight, same
   * bend, same tilt, same shake on both sides. What is left that can still
   * differ is the lifter.
   */
  const braceSpec = (load: number): LifterFrameSpec => ({
    ...liftFrameSpec(braceState(load), BRACE_COMPARE_KG),
    barBendPx: 0,
    barTiltDeg: 0,
    barLateralPx: 0,
  });

  it('leaves the lifter as the ONLY thing that differs between the two braces', () => {
    // If this fails, every count below is measuring something other than the
    // body and the floors are worthless.
    const { strainLevel: lightStrain, ...light } = braceSpec(LOAD_PRESETS.LIGHT);
    const { strainLevel: maxStrain, ...maximal } = braceSpec(LOAD_PRESETS.MAXIMAL);
    expect(maximal).toEqual(light);
    expect(maxStrain).toBeGreaterThan(lightStrain);
  });

  it('draws a light brace unstrained — the untouched authored pose', () => {
    // The other half of the claim. A change that makes every brace look heavy
    // has traded one flat frame for another.
    expect(braceSpec(LOAD_PRESETS.WARMUP).strainLevel).toBe(0);
    expect(braceSpec(LOAD_PRESETS.LIGHT).strainLevel).toBe(0);
  });

  it('changes a counted number of BODY pixels between a light brace and a maximal one', () => {
    const light = renderLifterFrame(braceSpec(LOAD_PRESETS.LIGHT));
    const maximal = renderLifterFrame(braceSpec(LOAD_PRESETS.MAXIMAL));
    const box = unionRect(headBox(light.pose), headBox(maximal.pose));
    const noHead = bodyPixelDiff(light.grid, maximal.grid, box);

    expect(noHead.bodyArea).toBeGreaterThan(500);
    expect(noHead.silhouette).toBeGreaterThan(FLOOR_BRACE_SILHOUETTE);
    expect(noHead.changed).toBeGreaterThan(FLOOR_BRACE_CHANGED);
  });

  it('does the same at the load the app actually opens on', () => {
    // LOAD_PRESETS.HEAVY is `LiftScreen`'s default attempt. A fix that only
    // reached a true limit single would leave the opening frame of the default
    // rep drawn exactly like a warm-up, which is the gap, unclosed.
    expect(LIFT_TUNING.DEMO.LOAD_CHOICES[LIFT_TUNING.DEMO.DEFAULT_LOAD_INDEX]).toBe(
      LOAD_PRESETS.HEAVY,
    );
    const light = renderLifterFrame(braceSpec(LOAD_PRESETS.LIGHT));
    const heavy = renderLifterFrame(braceSpec(LOAD_PRESETS.HEAVY));
    const box = unionRect(headBox(light.pose), headBox(heavy.pose));
    const noHead = bodyPixelDiff(light.grid, heavy.grid, box);

    expect(noHead.silhouette).toBeGreaterThan(FLOOR_BRACE_SILHOUETTE);
    expect(noHead.changed).toBeGreaterThan(FLOOR_BRACE_CHANGED);
  });

  it('never relaxes when the bar starts moving', () => {
    // The regression a naive one-number fix introduces: raise the brace's
    // weighting past the top of the descent's and the lifter is drawn straining
    // while standing still, then loosening on the first tick of the eccentric.
    for (const [name, load] of Object.entries(LOAD_PRESETS)) {
      const history = rep(load, false);
      const braced = liftFrameSpec(braceState(load), BRACE_COMPARE_KG).strainLevel;
      const first = history.find((s) => s.phase === 'DESCENT');
      expect(first, `no descent at ${name}`).toBeDefined();
      if (first === undefined) continue;
      const moving = liftFrameSpec(first, BRACE_COMPARE_KG).strainLevel;
      expect(braced, `${name}: brace ${braced} -> descent ${moving}`).toBeLessThanOrEqual(moving);
    }
  });

  it('measures the body and only the body, at the brace', () => {
    // The blind-by-construction check on the check. Two braces that differ ONLY
    // by 150 kg of plates must read as zero body change — otherwise every count
    // above could be the plate stacks.
    const spec = braceSpec(LOAD_PRESETS.MAXIMAL);
    const lightBar = renderLifterFrame({ ...spec, totalKg: 100 });
    const heavyBar = renderLifterFrame({ ...spec, totalKg: 250 });
    const diff = bodyPixelDiff(lightBar.grid, heavyBar.grid);
    expect(diff.bodyArea).toBeGreaterThan(500);
    expect(diff.changed).toBe(0);
    expect(diff.silhouette).toBe(0);
  });
});

describe('frameKey', () => {
  it('separates any two different drawings', () => {
    const base = liftFrameSpec(rep(LOAD_PRESETS.MAXIMAL)[0] as LiftState, DEMO_KG);
    const key = frameKey(base);
    const fields = [
      'kind',
      'depth',
      'direction',
      'strainLevel',
      'pitchLevel',
      'barLateralPx',
      'barTiltDeg',
      'barBendPx',
      'chalkMotes',
      'totalKg',
    ] as const;
    for (const field of fields) {
      const current = base[field];
      const changed = {
        ...base,
        [field]: typeof current === 'number' ? current + 1 : 'ASCENT',
      };
      expect(frameKey(changed), `field ${field} does not reach the key`).not.toBe(key);
    }
  });

  it('collapses a rep to far fewer drawings than it has ticks', () => {
    // The runtime half of the sheet: if this were one key per tick the sprite
    // would be rasterised sixty times a second for no reason.
    const history = rep(LOAD_PRESETS.MAXIMAL);
    const keys = new Set(history.map((s) => frameKey(liftFrameSpec(s, DEMO_KG))));
    expect(history.length).toBeGreaterThan(0);
    expect(keys.size).toBeLessThan(history.length / 2);
  });
});

describe('bench frame adapter', () => {
  it('tags a bench rep as bench and keys the concentric on height', () => {
    const state = createLift({ kind: 'bench', loadRatio: 1, seed: 1 });
    const drawn = liftFrameSpec(state, DEMO_KG);
    expect(drawn.kind).toBe('bench');
    expect(drawn.height).toBe(1);
    const chest = { ...drawn, height: 0 };
    const lock = { ...drawn, height: 1 };
    expect(frameKey(chest)).not.toBe(frameKey(lock));
    // Depth is squat's channel. A bench drawing that still keyed on it would
    // freeze the bar on the chest for the whole concentric — HOLE and ASCENT
    // both hold depth at 1.
    expect(frameKey({ ...chest, depth: 0 })).toBe(frameKey(chest));
  });

  it('draws that spec as a press, not as a squat', () => {
    const squat = renderLifterFrame(
      liftFrameSpec(createLift({ kind: 'squat', loadRatio: 1, seed: 1 }), DEMO_KG),
    );
    const bench = renderLifterFrame(
      liftFrameSpec(createLift({ kind: 'bench', loadRatio: 1, seed: 1 }), DEMO_KG),
    );
    expect(bodyPixelDiff(squat.grid, bench.grid).silhouette).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Bar-path plot geometry
// ---------------------------------------------------------------------------

describe('the bar-path plot', () => {
  it('maps height to the panel, top to bottom, monotonically', () => {
    expect(traceY(L.TRACE_H_MAX)).toBeCloseTo(L.TRACE_TOP, 6);
    expect(traceY(L.TRACE_H_MIN)).toBeCloseTo(L.TRACE_BOTTOM, 6);
    let previous = Infinity;
    for (let h = L.TRACE_H_MIN; h <= L.TRACE_H_MAX; h += 0.01) {
      const y = traceY(h);
      expect(y).toBeLessThanOrEqual(previous);
      previous = y;
      expect(y).toBeGreaterThanOrEqual(L.TRACE_TOP);
      expect(y).toBeLessThanOrEqual(L.TRACE_BOTTOM);
    }
  });

  it('puts a bar with no drift on the plumb line', () => {
    expect(traceX(0)).toBeCloseTo(L.TRACE_X + L.TRACE_W / 2, 6);
  });

  it('keeps every point of a real rep inside the panel', () => {
    for (const load of [0.4, 0.88, 1.05]) {
      for (const state of rep(load, false)) {
        const x = traceX(state.barForwardPx);
        expect(x, `load ${load}`).toBeGreaterThanOrEqual(L.TRACE_X);
        expect(x, `load ${load}`).toBeLessThanOrEqual(L.TRACE_X + L.TRACE_W);
        const y = traceY(state.height);
        expect(y).toBeGreaterThanOrEqual(L.TRACE_TOP);
        expect(y).toBeLessThanOrEqual(L.TRACE_BOTTOM);
      }
    }
  });

  it('caps the trace and keeps the most recent points', () => {
    const history = rep(LOAD_PRESETS.MAXIMAL, false);
    const points = tracePoints(history);
    expect(points.length).toBeLessThanOrEqual(LIFT_TUNING.FEEDBACK.TRACE_MAX_POINTS);
    const last = points[points.length - 1];
    const lastState = history[history.length - 1];
    expect(last).toBeDefined();
    expect(lastState).toBeDefined();
    if (last === undefined || lastState === undefined) return;
    expect(last.x).toBeCloseTo(traceX(lastState.barForwardPx), 6);
    expect(last.y).toBeCloseTo(traceY(lastState.height), 6);
  });

  it('fades from the tuned floor up to full', () => {
    const n = 10;
    expect(traceAlpha(0, n)).toBeCloseTo(LIFT_TUNING.FEEDBACK.TRACE_MIN_ALPHA, 6);
    expect(traceAlpha(n - 1, n)).toBeCloseTo(1, 6);
    expect(traceAlpha(0, 1)).toBe(1);
    let previous = -Infinity;
    for (let i = 0; i < n; i += 1) {
      const a = traceAlpha(i, n);
      expect(a).toBeGreaterThan(previous);
      previous = a;
    }
  });

  it('drifts a maximal rep further off the plumb line than a light one', () => {
    const spread = (load: number): number => {
      const xs = rep(load, false).map((s) => traceX(s.barForwardPx));
      return Math.max(...xs) - Math.min(...xs);
    };
    expect(spread(LOAD_PRESETS.MAXIMAL)).toBeGreaterThan(spread(LOAD_PRESETS.LIGHT));
    // ...and by enough to see on a phone, not by a fraction of a point.
    expect(spread(LOAD_PRESETS.MAXIMAL)).toBeGreaterThan(LIFT_TUNING.FEEDBACK.TRACE_WIDTH * 2);
  });
});

describe('stage layout', () => {
  it('fits the sprite and the plot inside the stage without overlapping', () => {
    expect(SPRITE_BOX.w).toBe(RESOLUTION.CELL_W * LIFT_TUNING.FEEDBACK.SPRITE_SCALE);
    expect(SPRITE_BOX.h).toBe(RESOLUTION.CELL_H * LIFT_TUNING.FEEDBACK.SPRITE_SCALE);
    expect(SPRITE_BOX.x).toBeGreaterThanOrEqual(0);
    expect(SPRITE_BOX.y).toBeGreaterThanOrEqual(0);
    expect(SPRITE_BOX.x + SPRITE_BOX.w).toBeLessThanOrEqual(L.STAGE_W);
    expect(SPRITE_BOX.y + SPRITE_BOX.h).toBeLessThanOrEqual(L.STAGE_H);
    // The plot must not be drawn under the barbell.
    expect(L.TRACE_X).toBeGreaterThanOrEqual(SPRITE_BOX.x + SPRITE_BOX.w);
    expect(L.TRACE_X + L.TRACE_W).toBeLessThanOrEqual(L.STAGE_W);
    expect(L.TRACE_BOTTOM).toBeLessThanOrEqual(L.STAGE_H);
  });

  it('keeps the cue ring on screen at its widest', () => {
    const r = LIFT_TUNING.FEEDBACK.CUE_RING_OUTER_R;
    expect(L.CUE_X - r).toBeGreaterThanOrEqual(0);
    expect(L.CUE_Y - r).toBeGreaterThanOrEqual(0);
    expect(L.CUE_X + r).toBeLessThanOrEqual(L.STAGE_W);
    expect(L.CUE_Y + r).toBeLessThanOrEqual(L.STAGE_H);
  });
});

// ---------------------------------------------------------------------------
// The cue ring
// ---------------------------------------------------------------------------

describe('motion driven by the rep', () => {
  it('shakes the platform only while the bar is losing, and never off screen', () => {
    const winning = rep(LOAD_PRESETS.LIGHT, true);
    for (const state of winning) {
      const shake = stageShake(state);
      expect(Math.abs(shake.dx), 'a light rep must not shake').toBe(0);
      expect(Math.abs(shake.dy)).toBe(0);
    }
    const losing = rep(LOAD_PRESETS.MAXIMAL, false);
    let peak = 0;
    for (const state of losing) {
      const shake = stageShake(state);
      peak = Math.max(peak, Math.abs(shake.dx));
      expect(Math.abs(shake.dx)).toBeLessThanOrEqual(LIFT_TUNING.FEEDBACK.SHAKE_MAX_PX);
      expect(Math.abs(shake.dy)).toBeLessThanOrEqual(LIFT_TUNING.FEEDBACK.SHAKE_MAX_PX);
      if (state.phase !== 'ASCENT' || state.netForce >= 0) {
        expect(Math.abs(shake.dx)).toBe(0);
      }
    }
    expect(peak, 'a beaten bar must actually shake').toBeGreaterThan(0);
  });

  it('reverses the shake direction within a cycle, so it is a shake not a lean', () => {
    const losing = rep(LOAD_PRESETS.MAXIMAL, false).filter(
      (s) => s.phase === 'ASCENT' && s.netForce < 0,
    );
    const xs = losing.map((s) => stageShake(s).dx);
    expect(Math.max(...xs)).toBeGreaterThan(0);
    expect(Math.min(...xs)).toBeLessThan(0);
  });

  it('flashes on the tick an input lands and fades over the tuned window', () => {
    const history = rep(LOAD_PRESETS.MAXIMAL, true);
    const atInput = history.findIndex((s) => s.timings.length > 0);
    expect(atInput).toBeGreaterThanOrEqual(0);
    const at = history[atInput];
    expect(at).toBeDefined();
    if (at === undefined) return;
    expect(hitFlash(at)).toBeCloseTo(1, 6);
    const flashTicks = LIFT_TUNING.FEEDBACK.HIT_FLASH_MS / TICK_MS;
    const later = history[atInput + Math.ceil(flashTicks) + 1];
    if (later !== undefined && later.timings.length === at.timings.length) {
      expect(hitFlash(later)).toBe(0);
    }
    // Nothing has landed yet at the start of a rep.
    const first = history[0];
    expect(first).toBeDefined();
    if (first !== undefined) expect(hitFlash(first)).toBe(0);
  });

  it('pulses the cue ring across the full 0..1 range, on its tuned period', () => {
    const periodTicks = LIFT_TUNING.FEEDBACK.CUE_PULSE_MS / TICK_MS;
    const values: number[] = [];
    for (let tick = 0; tick < Math.ceil(periodTicks) * 2; tick += 1) {
      const v = cuePulse(tick);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      values.push(v);
    }
    expect(Math.max(...values)).toBeGreaterThan(0.9);
    expect(Math.min(...values)).toBeLessThan(0.1);
    // Periodic, not a ramp.
    expect(cuePulse(0)).toBeCloseTo(cuePulse(periodTicks), 6);
  });
});

describe('cueRing', () => {
  it('is absent when no cue is up', () => {
    expect(cueRing(null)).toBeNull();
  });

  it('meets its target ring at exactly the ideal moment', () => {
    // Not approximately. "The ring lands on the target" and "the input grades
    // perfect" have to be the same instant or the cue is lying about itself.
    const atIdeal = cueRing(1);
    expect(atIdeal).not.toBeNull();
    if (atIdeal === null) return;
    expect(atIdeal.radius).toBeCloseTo(atIdeal.targetRadius, 9);
    expect(atIdeal.inPerfectBand).toBe(true);
  });

  it('shrinks from the outer radius to the inner one across the window', () => {
    const f = LIFT_TUNING.FEEDBACK;
    expect(cueRing(0)?.radius).toBeCloseTo(f.CUE_RING_OUTER_R, 9);
    expect(cueRing(2)?.radius).toBeCloseTo(f.CUE_RING_INNER_R, 9);
    let previous = Infinity;
    for (let p = 0; p <= 2; p += 0.05) {
      const r = cueRing(p)?.radius ?? 0;
      expect(r).toBeLessThanOrEqual(previous);
      previous = r;
    }
  });

  it('marks the perfect band, and only the perfect band', () => {
    const band = LIFT_TUNING.PERFECT_BAND_FRACTION;
    expect(cueRing(1 - band / 2)?.inPerfectBand).toBe(true);
    expect(cueRing(1 + band / 2)?.inPerfectBand).toBe(true);
    expect(cueRing(1 - band * 2)?.inPerfectBand).toBe(false);
    expect(cueRing(1 + band * 2)?.inPerfectBand).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The deadlift's borrowed drawing (GDD §6.2's third lift, with no third figure)
// ---------------------------------------------------------------------------

describe('a deadlift is drawn with the squat figure, on purpose', () => {
  /** A deadlift driven up and held at the lockout. */
  function deadliftHistory(load: number): readonly LiftState[] {
    const config = { kind: 'deadlift' as const, loadRatio: load, seed: 4 };
    let script: ScriptedInput[] = [{ tick: braceTicks(load, 'deadlift') + 1, kind: 'press' }];
    for (let i = 0; i < 8; i += 1) {
      const opens = runLift(config, script).history.filter((state) =>
        state.events.some((event) => event.kind === 'drive-cue-open'),
      );
      const cue = opens[opens.length - 1]?.activeCue ?? null;
      if (cue === null) break;
      if (script.some((input) => input.tick === cue.idealTick)) break;
      script = [
        ...script,
        { tick: cue.idealTick - 1, kind: 'release' },
        { tick: cue.idealTick, kind: 'press' },
      ];
    }
    return runLift(config, script).history;
  }

  it('borrows the kind named in the tuning file, not a literal buried here', () => {
    // THE FALLBACK IS A DECLARATION, NOT A COINCIDENCE. There is no deadlift
    // figure — building one was out of the phase model's scope — so a deadlift
    // renders as the squat. What this pins is that the borrowing goes through
    // `LIFT_TUNING.DEADLIFT_ART_FALLBACK_KIND`, so the day a third figure
    // exists there is one constant to change and this test names it.
    const state = createLift({ kind: 'deadlift', loadRatio: 0.9, seed: 4 });
    expect(drawnKindFor(state)).toBe(LIFT_TUNING.DEADLIFT_ART_FALLBACK_KIND);
    expect(liftFrameSpec(state, DEMO_KG).kind).toBe(LIFT_TUNING.DEADLIFT_ART_FALLBACK_KIND);
    // The other two are drawn as themselves, which is what makes this a fact
    // about the deadlift rather than about the adapter.
    for (const kind of ['squat', 'bench'] as const) {
      expect(drawnKindFor(createLift({ kind, loadRatio: 0.9, seed: 4 }))).toBe(kind);
    }
  });

  it('folds the figure over at the floor and stands it up as the bar rises', () => {
    // THE ONE THING THE BORROWED DRAWING GETS RIGHT, and it was a sentence in a
    // comment until this test existed. `lift.ts` derives a deadlift's `depth`
    // as `1 - height`, so the squat figure's pose tracks the bar: doubled over
    // when the bar is on the ground, upright at lockout.
    //
    // What it gets WRONG is not testable here and is not claimed: the bar is
    // drawn on the lifter's back rather than in their hands. That is tracked
    // debt for an art piece.
    const history = deadliftHistory(0.9);
    const first = history[0];
    expect(first, 'no history').toBeDefined();
    if (first === undefined) return;
    // On the floor: fully folded.
    expect(liftFrameSpec(first, DEMO_KG).depth).toBe(1);

    const lockedOut = history.find((state) => state.phase === 'LOCKOUT');
    expect(lockedOut, 'the pull never locked out').toBeDefined();
    if (lockedOut === undefined) return;
    // At lockout: standing.
    expect(liftFrameSpec(lockedOut, DEMO_KG).depth).toBe(0);

    // ...and it is monotone in between rather than jumping between the two,
    // which is what makes it a pose that TRACKS the bar rather than two poses.
    // Counts, not bounds: an empty ascent would pass a monotonicity loop.
    const ascent = history.filter((state) => state.phase === 'ASCENT');
    expect(ascent.length, 'no ascent frames to check').toBeGreaterThan(10);
    let previous = Infinity;
    for (const state of ascent) {
      const depth = liftFrameSpec(state, DEMO_KG).depth;
      expect(depth, `tick ${state.tick}`).toBeLessThanOrEqual(previous);
      previous = depth;
    }
    expect(previous, 'the figure never stood up').toBeLessThan(1);
  });

  it('gives a deadlift a cache key that names the drawing it borrowed', () => {
    // `frameKey` folds the borrowed kind in, which is correct — two frames that
    // draw identically SHOULD share an image. This pins that the borrowing is
    // what makes them share, rather than a deadlift silently keying as
    // something the renderer cannot draw.
    const spec = liftFrameSpec(createLift({ kind: 'deadlift', loadRatio: 0.9, seed: 4 }), DEMO_KG);
    expect(frameKey(spec).startsWith(`${LIFT_TUNING.DEADLIFT_ART_FALLBACK_KIND}|`)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// THE COMMAND BEAT ON STAGE (GDD §6.2, ruled 2026-08-25)
//
// Phone playtest 4 measured the press command's whole stimulus inventory on the
// platform the beta ships to and found one live channel — a header text colour
// — with the stage pixel-static across the command. These are the checks on the
// stage half of the replacement. What they CANNOT say is whether any of it
// reads in the hand; that is a human on a phone, and it is the gate.
// ---------------------------------------------------------------------------

const SC = LIFT_TUNING.FEEDBACK.STAGE_COMMAND;

/**
 * A DRIVEN BENCH REP, THREE PASSES, BECAUSE NEITHER BEAT'S TICK IS KNOWABLE IN
 * ADVANCE.
 *
 * The chest arrives when the fed bar gets there, and the command fires at a
 * tick drawn from the rep's seed on the first tick of HOLE — which is itself a
 * function of how the descent was played. So the script is built by running the
 * real mechanic and reading the ticks off it, the same two-pass idiom
 * `scriptFor` and `deadliftHistory` already use for drive cues.
 *
 * `taps` are dispatched one press EDGE per counted tap, spaced by
 * `spacingTicks` — the refractory the mechanic itself declares, by default, so
 * a tap this harness sends is a tap the mechanic can count. `spacingTicks` is
 * an argument since the 2026-08-25 replay steer because the readout is a RATE
 * readout now: two reps with the same number of taps and different spacings
 * have to light the row to different heights, and there is no way to ask that
 * question with a fixed gap.
 *
 * THE DESCENT SCRIPT STILL FEEDS AND EASES, and after the replay steer that is
 * a SLIP-AND-CATCH pattern rather than a lowering technique — the finger comes
 * off, the bar runs away, the finger comes back. Kept as it is: what these
 * tests need is a bench rep that reaches the chest and a bar whose approach
 * heat MOVES, and a slipped descent gives both where a held one gives a
 * constant. `lift.test.ts` is where the descent itself is graded.
 */
function benchHistory(
  load: number,
  {
    taps = 0,
    feed = 11,
    ease = 26,
    seed = 4,
    spacingTicks = LIFT_TUNING.GRIND_TAP_REFRACTORY_TICKS as number,
  }: {
    taps?: number;
    feed?: number;
    ease?: number;
    seed?: number;
    spacingTicks?: number;
  } = {},
): readonly LiftState[] {
  const config = { kind: 'bench' as const, loadRatio: load, seed };
  const start = braceTicks(load, 'bench') + 1;
  const feeding: ScriptedInput[] = [{ tick: start, kind: 'press' }];
  let t = start;
  for (let i = 0; i < 12; i += 1) {
    t += feed;
    feeding.push({ tick: t, kind: 'release' });
    t += ease;
    feeding.push({ tick: t, kind: 'press' });
  }
  // Pass 1 — where does the bar reach the chest? Everything scheduled after
  // that would land inside HOLE, where a press is a grind tap rather than a
  // hold, so the descent script is truncated there.
  const touched = runLift(config, feeding).history.find((s) => s.phase === 'HOLE');
  const holeAt = touched?.tick ?? Infinity;
  const descent = feeding.filter((input) => input.tick < holeAt);
  // The finger comes off at the touch, so every tap below is a real EDGE.
  const settled: ScriptedInput[] =
    holeAt === Infinity ? descent : [...descent, { tick: holeAt, kind: 'release' }];
  if (taps <= 0) return runLift(config, settled).history;

  // Pass 2 — when does the command fire? It is scheduled on the first tick of
  // HOLE from the seed, so it is only readable once the descent is fixed.
  const commanded = runLift(config, settled).history.find((s) => s.pressCommandTick !== null);
  const commandAt = commanded?.pressCommandTick ?? null;
  if (commandAt === null) return runLift(config, settled).history;
  const script = [...settled];
  const spacing = spacingTicks;
  // THE FIRST TAP IS ONE TICK AFTER THE CALL, NOT ON IT. A tap dispatched on
  // the command's own tick is counted by the same `stepLift` call that fires
  // the command, so the readout's very first frame would already show one pip
  // and the row would have no zero state to move away from. No human reacts
  // inside one tick either.
  for (let i = 0; i < taps; i += 1) {
    const at = commandAt + 1 + i * spacing;
    script.push({ tick: at, kind: 'press' });
    script.push({ tick: at + 1, kind: 'release' });
  }
  return runLift(config, script).history;
}

/** The deadlift harness above, lifted out so the down command can be reached. */
function deadliftToTheDownCall(load: number): readonly LiftState[] {
  const config = { kind: 'deadlift' as const, loadRatio: load, seed: 4 };
  let script: ScriptedInput[] = [{ tick: braceTicks(load, 'deadlift') + 1, kind: 'press' }];
  for (let i = 0; i < 8; i += 1) {
    const opens = runLift(config, script).history.filter((state) =>
      state.events.some((event) => event.kind === 'drive-cue-open'),
    );
    const cue = opens[opens.length - 1]?.activeCue ?? null;
    if (cue === null) break;
    if (script.some((input) => input.tick === cue.idealTick)) break;
    script = [
      ...script,
      { tick: cue.idealTick - 1, kind: 'release' },
      { tick: cue.idealTick, kind: 'press' },
    ];
  }
  return runLift(config, script).history;
}

describe('the command hit', () => {
  it('paints the stage on the tick the press command fires [the-command-is-not-a-dead-channel-on-stage]', () => {
    const history = benchHistory(LOAD_PRESETS.HEAVY, { taps: 6 });
    // THE DOMAIN THIS READING IS TAKEN OVER, pinned as a count. A hand-built
    // state would show a wash just as happily as a played one; what makes the
    // two ticks below comparable to phone playtest 4's is that they come out of
    // a rep that braced, fed a bar to the chest, waited and was tapped.
    expect(history.length, 'ticks of played bench rep behind this reading').toBeGreaterThan(120);
    const commanded = history.find((s) => s.pressCommandTick !== null);
    expect(commanded, 'the rep never reached the chest').toBeDefined();
    const at = commanded?.pressCommandTick ?? null;
    expect(at, 'no command was ever scheduled').not.toBeNull();
    if (at === null) return;

    const before = history.find((s) => s.tick === at - 1);
    const on = history.find((s) => s.tick === at);
    expect(before, 'no state one tick before the command').toBeDefined();
    expect(on, 'no state on the command tick').toBeDefined();
    if (before === undefined || on === undefined) return;

    // THE MEASUREMENT PHONE PLAYTEST 4 TOOK, INVERTED. It read the renderer's
    // own cache key at command minus 1 and the command tick and found them
    // byte-identical. This reads the stage layer at the same two ticks and
    // requires them to differ, in the direction of something being drawn.
    expect(commandHit(before), 'the wash starts before the command').toBeNull();
    const hit = commandHit(on);
    expect(hit, 'the command tick draws nothing').not.toBeNull();
    if (hit === null) return;
    expect(hit.command).toBe('press');
    expect(hit.washAlpha).toBeGreaterThan(0);
    expect(hit.washAlpha).toBe(SC.FLASH_PEAK_ALPHA.press);
    expect(hit.ringRadius).toBe(SC.RING_MIN_R);
  });

  it('holds for its declared duration and then stops, counts pinned', () => {
    const history = benchHistory(LOAD_PRESETS.HEAVY, { taps: 6 });
    const at = history.find((s) => s.pressCommandTick !== null)?.pressCommandTick ?? null;
    expect(at).not.toBeNull();
    if (at === null) return;
    const lit = history.filter((s) => s.tick >= at && commandHit(s) !== null);
    // EXACT, NOT A BOUND. The wash lives for `FLASH_MS` and the sim is
    // `TICK_MS` per tick, so the number of ticks it covers is arithmetic. A
    // bound would be satisfied by a hit that never went out.
    const wanted = Math.ceil(SC.FLASH_MS.press / TICK_MS);
    expect(lit.length).toBe(wanted);
    // ...and it is a DECAY rather than a step: the ring is further out and the
    // wash is fainter at the end of it than at the start.
    const first = commandHit(lit[0] as LiftState);
    const last = commandHit(lit[lit.length - 1] as LiftState);
    expect(first).not.toBeNull();
    expect(last).not.toBeNull();
    if (first === null || last === null) return;
    expect(last.washAlpha).toBeLessThan(first.washAlpha);
    expect(last.ringRadius).toBeGreaterThan(first.ringRadius);
  });

  it('covers the deadlift down call through the same predicate', () => {
    // THE SECOND MEASURED GAP, AND IT IS CLOSED BY CONSTRUCTION RATHER THAN BY
    // A SECOND FUNCTION. `commandHit` reads whichever command tick the lift
    // has, so a deadlift that reaches its down call gets the same treatment
    // without a deadlift-shaped branch anybody could forget to add.
    const history = deadliftToTheDownCall(0.9);
    const at = history.find((s) => s.downCommandTick !== null)?.downCommandTick ?? null;
    expect(at, 'the pull never reached a lockout').not.toBeNull();
    if (at === null) return;
    const before = history.find((s) => s.tick === at - 1);
    const on = history.find((s) => s.tick === at);
    expect(commandHit(before as LiftState)).toBeNull();
    const hit = commandHit(on as LiftState);
    expect(hit).not.toBeNull();
    expect(hit?.command).toBe('down');
    expect(hit?.washAlpha).toBe(SC.FLASH_PEAK_ALPHA.down);
  });

  it('never paints on a squat, which has no command at all', () => {
    // THE ZERO'S NON-ZERO CONTROLS ARE THE THREE TESTS ABOVE, taken by the same
    // function in the same file. A `commandHit` that always returned null would
    // pass this and fail those.
    const history = rep(0.9);
    expect(history.length, 'no squat history to check').toBeGreaterThan(60);
    const painted = history.filter((s) => commandHit(s) !== null);
    expect(painted.length).toBe(0);
  });
});

describe('the armed wait', () => {
  it('carries no information about when the command is due [the-armed-wait-tells-nobody-when-the-command-is-due]', () => {
    const history = benchHistory(LOAD_PRESETS.HEAVY);
    // THE DOMAIN, pinned as a count: the wait this pair is drawn out of is a
    // real seeded pause of real length, not one tick somebody constructed.
    const wait = history.filter((s) => s.phase === 'HOLE');
    expect(wait.length, 'wait ticks this pair is drawn from').toBeGreaterThan(24);
    const waiting = history.find((s) => s.phase === 'HOLE' && stageArmed(s) !== null);
    expect(waiting, 'the rep never reached a wait').toBeDefined();
    if (waiting === undefined) return;

    // TWO STATES DIFFERING IN EXACTLY ONE FIELD, both with the command still in
    // the future. If the armed treatment ever grew a term in the scheduled
    // tick — a ring that filled toward the call, a pulse that quickened — these
    // two would stop agreeing. That is the whole no-countdown identity, and it
    // is the one thing about this layer a scan can hold.
    const soon: LiftState = { ...waiting, pressCommandTick: waiting.tick + 5 };
    const late: LiftState = { ...waiting, pressCommandTick: waiting.tick + 90 };
    expect(stageArmed(soon)).not.toBeNull();
    expect(stageArmed(soon)).toBe(stageArmed(late));
    // ...and the SEED cannot reach it either, which is the same claim by the
    // route the delay is actually drawn through.
    const otherSeed: LiftState = { ...waiting, config: { ...waiting.config, seed: 99 } };
    expect(stageArmed(otherSeed)).toBe(stageArmed(waiting));
  });

  it('is live through the whole wait and out the moment the call lands', () => {
    const history = benchHistory(LOAD_PRESETS.HEAVY, { taps: 6 });
    const at = history.find((s) => s.pressCommandTick !== null)?.pressCommandTick ?? null;
    expect(at).not.toBeNull();
    if (at === null) return;
    const hole = history.filter((s) => s.phase === 'HOLE');
    const armedBefore = hole.filter((s) => s.tick < at && stageArmed(s) !== null);
    const armedAfter = hole.filter((s) => s.tick >= at && stageArmed(s) !== null);
    // Counts, not bounds: an empty wait would satisfy "nothing was armed after
    // the call" trivially, so the before-count is pinned as the domain.
    expect(armedBefore.length).toBe(hole.filter((s) => s.tick < at).length);
    expect(armedBefore.length).toBeGreaterThan(10);
    expect(armedAfter.length).toBe(0);
    // It breathes rather than sitting at one value — the wait is the thing
    // playtest 4 measured as motionless.
    const alphas = new Set(armedBefore.map((s) => stageArmed(s)));
    expect(alphas.size).toBeGreaterThan(5);
    for (const alpha of alphas) {
      expect(alpha).toBeGreaterThanOrEqual(SC.ARMED_MIN_ALPHA);
      expect(alpha).toBeLessThanOrEqual(SC.ARMED_MAX_ALPHA);
    }
  });

  it('arms the deadlift lockout hold and nothing on a squat', () => {
    const deadlift = deadliftToTheDownCall(0.9);
    const at = deadlift.find((s) => s.downCommandTick !== null)?.downCommandTick ?? null;
    expect(at).not.toBeNull();
    if (at === null) return;
    const held = deadlift.filter((s) => s.phase === 'LOCKOUT' && s.tick < at);
    expect(held.length, 'no hold to check').toBeGreaterThan(10);
    expect(held.every((s) => stageArmed(s) !== null)).toBe(true);
    expect(deadlift.filter((s) => s.tick >= at && stageArmed(s) !== null).length).toBe(0);
    expect(rep(0.9).filter((s) => stageArmed(s) !== null).length).toBe(0);
  });
});

describe('the grind readout', () => {
  it('follows the tap rate up and back down, never past the row [the-grind-readout-moves-with-the-rate]', () => {
    // ---------------------------------------------------------------------
    // FACT 3 OF THE PROGRESSION RULE IS THE WHOLE TEST HERE, AND THE 2026-08-25
    // REPLAY STEER IS WHY IT HAD TO BE REWRITTEN.
    //
    // The row used to be one pip per counted tap out of a per-rep cap, so
    // "it moves" meant "it rises". A continuous grind has no cap and a running
    // tap total rises forever — a row keyed to one would fill up and STAY
    // full while the player quietly stopped tapping, which is a readout on
    // screen reading nothing. So the assertion is not "it rises": it is that
    // it rises while taps land AND falls once they stop.
    // ---------------------------------------------------------------------
    const units = LIFT_TUNING.FEEDBACK.STAGE_COMMAND.GRIND_READOUT_UNITS;
    const asked = 6;
    const history = benchHistory(LOAD_PRESETS.HEAVY, { taps: asked });
    const open = history.map((s) => grindReadout(s)).filter((r) => r !== null);
    expect(open.length, 'the grind never went live').toBeGreaterThan(10);

    // FACT 2 — it is never invalid: the row is `GRIND_READOUT_UNITS` long, and
    // the lit count is inside it and agrees with the pips actually drawn.
    for (const readout of open) {
      expect(readout.pips.length).toBe(units);
      expect(readout.lit).toBeGreaterThanOrEqual(0);
      expect(readout.lit).toBeLessThanOrEqual(units);
      expect(readout.pips.filter((p) => p.lit).length).toBe(readout.lit);
    }

    // FACT 3 — IT MOVES, BOTH WAYS. A hardcoded row satisfies neither, and a
    // row keyed to a running total satisfies only the first half.
    const lit = open.map((r) => r.lit);
    const peak = Math.max(...lit);
    const peakAt = lit.indexOf(peak);
    expect(lit[0], 'the row started lit').toBe(0);
    expect(peak, 'the row never lit at all').toBeGreaterThan(1);
    expect(peakAt, 'the row peaked on its first frame').toBeGreaterThan(0);
    const after = lit.slice(peakAt);
    expect(Math.min(...after), `the row never fell from its peak of ${peak}`).toBeLessThan(peak);
    // ...and it really did fall because the TAPS stopped, not because the row
    // was truncated: the tap total is still rising at the peak and flat after.
    expect(new Set(lit).size, `only ${new Set(lit).size} distinct row states`).toBeGreaterThan(3);
  });

  it('rises higher for a faster rate than for a slower one', () => {
    // THE DIRECTION THE MOVEMENT TEST ABOVE DOES NOT CARRY. A row that rose
    // and fell on a timer rather than on the player's rate would satisfy every
    // assertion above, so the discriminator is two rates on the same rep.
    const fast = benchHistory(LOAD_PRESETS.HEAVY, { taps: 10 })
      .map((s) => grindReadout(s))
      .filter((r) => r !== null);
    const slow = benchHistory(LOAD_PRESETS.HEAVY, { taps: 10, spacingTicks: 14 })
      .map((s) => grindReadout(s))
      .filter((r) => r !== null);
    expect(fast.length, 'the fast rep never went live').toBeGreaterThan(10);
    expect(slow.length, 'the slow rep never went live').toBeGreaterThan(10);
    expect(Math.max(...fast.map((r) => r.lit))).toBeGreaterThan(
      Math.max(...slow.map((r) => r.lit)),
    );
  });

  it('draws nothing before the command and nothing on the other two lifts', () => {
    const history = benchHistory(LOAD_PRESETS.HEAVY, { taps: 5 });
    const at = history.find((s) => s.pressCommandTick !== null)?.pressCommandTick ?? null;
    expect(at).not.toBeNull();
    if (at === null) return;
    expect(history.filter((s) => s.tick < at && grindReadout(s) !== null).length).toBe(0);
    expect(rep(0.9).filter((s) => grindReadout(s) !== null).length).toBe(0);
    expect(deadliftToTheDownCall(0.9).filter((s) => grindReadout(s) !== null).length).toBe(0);
  });

  it('keeps the row on the stage and clear of the bar-path panel', () => {
    const history = benchHistory(LOAD_PRESETS.HEAVY, { taps: 3 });
    const readout = history.map((s) => grindReadout(s)).find((r) => r !== null);
    expect(readout, 'no readout to measure').toBeDefined();
    if (readout === undefined) return;
    expect(readout.tray.x).toBeGreaterThan(0);
    expect(readout.tray.y).toBeGreaterThan(0);
    expect(readout.tray.x + readout.tray.w).toBeLessThan(L.TRACE_X);
    expect(readout.tray.y + readout.tray.h).toBeLessThan(L.SPRITE_Y);
    // Every pip is inside its own tray, so the plate really is what a pixel
    // count inside `tray` is counting against.
    for (const pip of readout.pips) {
      expect(pip.x).toBeGreaterThanOrEqual(readout.tray.x);
      expect(pip.x + pip.w).toBeLessThanOrEqual(readout.tray.x + readout.tray.w);
      expect(pip.y).toBeGreaterThanOrEqual(readout.tray.y);
      expect(pip.y + pip.h).toBeLessThanOrEqual(readout.tray.y + readout.tray.h);
    }
  });

  it('flashes the rail once per COUNTED tap and nowhere near the tray', () => {
    // -----------------------------------------------------------------------
    // THE RATE CHANNEL THE PIP ROW CANNOT CARRY, AND THE ONE MEASUREMENT
    // CONSTRAINT ON IT.
    //
    // `lit` is a LEVEL: it rises and falls honestly and it still draws as a bar
    // filling to the right, which is the grammar of a counter. `kick` is the
    // evidence that a tap LANDED, so the visible flashing rate is the tap rate.
    // What this pins is that it is keyed to the counted tap and that it is
    // drawn where `verify-lift-press.mjs`'s lit-pip count cannot see it.
    // -----------------------------------------------------------------------
    const spacing = 9;
    const history = benchHistory(LOAD_PRESETS.HEAVY, { taps: 6, spacingTicks: spacing });
    const live = history.map((s) => grindReadout(s)).filter((r) => r !== null);
    expect(live.length, 'the grind never went live').toBeGreaterThan(10);

    // GEOMETRY: outside the tray, off the sprite cell, clear of the plot.
    const first = live[0];
    expect(first, 'no readout to measure').toBeDefined();
    if (first === undefined) return;
    expect(first.rail.y, 'the rail overlaps the tray the pip count is taken in')
      .toBeGreaterThanOrEqual(first.tray.y + first.tray.h);
    expect(first.rail.y + first.rail.h).toBeLessThan(L.SPRITE_Y);
    expect(first.rail.x + first.rail.w).toBeLessThan(L.TRACE_X);
    expect(first.rail.x).toBe(first.tray.x);

    // FACT 3: it moves, and it moves at the TAP rate rather than on a timer.
    // A kick that decayed from one event, or one hardcoded on, would give a
    // single peak; six taps `spacing` ticks apart give six — or fewer, if the
    // rep itself ends before the last one lands, which is what happens here
    // since the 2026-08-28 (FOURTH) margin-band cut.
    //
    // 6 -> 5. `LOAD_PRESETS.HEAVY` (0.88) is played here at DEFAULT capacity
    // (`benchHistory` passes no `feel`), and its base margin now clears
    // `BENCH_WORKING_RUNG_DEMAND_CUT_MARGIN`, so this rep takes
    // `BENCH_WORKING_RUNG_DEMAND_WALL_ADDEND` (clipped by the raised ceiling)
    // in place of the old `ONSET` — a much larger boosted demand than before.
    // The ascent still runs long enough to register five of the six scripted
    // taps as live-frame kicks; the sixth lands after the rep has already
    // resolved (a miss, at this much harder margin), so it produces no live
    // `grindReadout` frame to count. This is a real consequence of the new
    // mechanism, not a narrowed sweep — `live.length` (43) is unchanged.
    const kicks = live.map((r) => r.kick);
    const peaks = kicks.filter((k, i) => k === 1).length;
    expect(peaks, `full-strength kicks over ${live.length} live frames`).toBe(5);
    expect(Math.min(...kicks), 'the rail never went dark between taps').toBe(0);
    // ...and it is the COUNTED tap, not the dispatched one: a rep tapped inside
    // the refractory floor lands more presses and cannot land more kicks.
    const mashed = benchHistory(LOAD_PRESETS.HEAVY, { taps: 6, spacingTicks: 1 })
      .map((s) => grindReadout(s))
      .filter((r) => r !== null);
    const mashedPeaks = mashed.filter((r) => r.kick === 1).length;
    expect(mashedPeaks, 'six presses one tick apart were all counted').toBeLessThan(6);
  });
});

describe('the stall band', () => {
  /**
   * A bench rep that stops tapping mid-ascent, at a load its own reachable-cell
   * table says can stall. Deliberately `LOAD_PRESETS.MAXIMAL`: the sweep in
   * `lift.test.ts` pins that the lighter rungs do NOT stall, and a band with no
   * stall behind it is a test with an empty domain.
   */
  const stalledRep = (): readonly LiftState[] =>
    benchHistory(LOAD_PRESETS.MAXIMAL, { taps: 3, spacingTicks: 4 });

  it('draws while the bar is losing and on no other lift', () => {
    const history = stalledRep();
    const banded = history.filter((s) => stallBand(s) !== null);
    // -----------------------------------------------------------------------
    // THE ORACLE HERE IS RANKS AND COUNTS, NOT THE MECHANIC'S OWN CONSTANT —
    // AND ITS FIRST VERSION WAS SELF-REFERENTIAL, MEASURED RATHER THAN
    // SUSPECTED. It asserted `state.velocity < LIFT_TUNING.GRIND_STALL_VELOCITY`
    // per banded frame: the exact comparison `stallBand` makes, against the
    // exact constant it makes it with, so the two could only ever move
    // together. An independent critic drove the vacuity: `GRIND_STALL_VELOCITY
    // -> 1000` bands EVERY ascent frame — a permanently-lit urgency cue, the
    // §3.4 meter shape — and this test stayed green; only the witness pair one
    // test down caught it. That is the "oracle that mirrors its subject" row
    // of CLAUDE.md's vacuity table, one comparison at a time.
    //
    // What replaces it reads the DRIVEN HISTORY and never the constant:
    //   - both populations are exact-pinned, so a band that never draws AND a
    //     band that always draws are both red (a rep is a pure function of
    //     (config, seed, inputs), so exact pins are safe);
    //   - the fastest-moving ascent frames must be UNBANDED, by rank — a bar
    //     demonstrably moving is not stalled whatever the threshold is;
    //   - and every banded velocity sits strictly below every unbanded one, so
    //     the band keys on being SLOW rather than on some other fact that
    //     happens to correlate on this seed.
    // Re-driven against the measured mutant while writing this: every ascent
    // frame bands, the exact pins redden first, and the file reads
    // 3 failed | 56 passed (59) — with this test among the three, which is the
    // whole repair. (That mutant read "24 of 24" when it was taken; the ascent
    // is 21 frames long now — see the note below.)
    //
    // THE BANDED COUNT WAS 18 AND IS 17 SINCE THE 2026-08-26 BENCH DIFFICULTY
    // RETUNE, RE-DERIVED RATHER THAN ACCOMMODATED, AND IT MOVED TWICE. This rep
    // is a maximal bench that taps three times and then stops; it MISSED before
    // the retune and MISSES after, so nothing about what the test is looking at
    // changed. What moved is that a harder demand curve kills the bar sooner:
    // the whole ascent went 24 frames -> 21 at the first, over-large retune
    // (banded 18 -> 15) and sits at 23 now that the demand rise was cut to a
    // third of it (banded 17). The UNBANDED count is 6 in all three worlds —
    // the bar leaves the chest with the same three taps behind it every time,
    // and it is the dying half that got shorter.
    //
    // THAT IT MOVED TWICE WHILE BOTH RANK CHECKS BELOW MOVED NEITHER TIME is
    // the reason both kinds of check are in this test rather than one. An exact
    // count tracks the tuning and has to be re-taken with it; a rank holds
    // across every tuning that keeps the band meaning what it says.
    //
    // -------------------------------------------------------------------
    // 17 -> 15 AGAIN ON THE 2026-08-28 (FOURTH) MARGIN-BAND CUT, FOR THE SAME
    // REASON AS BOTH EARLIER MOVES: THE DEMAND CURVE AT THIS LOAD GOT HARDER
    // -------------------------------------------------------------------
    // `LOAD_PRESETS.MAXIMAL` (1.0) at default capacity now clears
    // `BENCH_WORKING_RUNG_DEMAND_CUT_MARGIN` by a wide margin, so this rep
    // takes `BENCH_WORKING_RUNG_DEMAND_WALL_ADDEND` (clipped to the raised
    // ceiling, 0.378) in place of the old `ONSET` (0.045, itself already
    // clipped by the old 0.27 ceiling) — a large jump in boosted demand. The
    // rep still MISSES, as it did in every prior world, but this time the
    // UNBANDED count moves too — 6 -> 5, measured rather than assumed to hold
    // at 6 the way it did across the first two moves. The much larger boosted
    // demand shortens the moving (unbanded) portion of the ascent as well as
    // the stalled (banded) portion, unlike either prior retune, which only
    // ever shortened the dying half. Re-measured against the real engine
    // rather than pattern-matched to the earlier note this replaces.
    // -----------------------------------------------------------------------
    const ascent = history.filter((s) => s.phase === 'ASCENT');
    const unbanded = ascent.filter((s) => stallBand(s) === null);
    expect(banded.length, 'banded frames of the driven rep').toBe(15);
    expect(unbanded.length, 'moving ascent frames of the driven rep').toBe(5);
    const fastestFirst = [...ascent].sort((a, b) => b.velocity - a.velocity);
    const topQuartile = fastestFirst.slice(0, Math.floor(ascent.length / 4));
    expect(
      topQuartile.filter((s) => stallBand(s) !== null).length,
      'banded frames among the ascent frames that are demonstrably MOVING fastest',
    ).toBe(0);
    expect(Math.max(...banded.map((s) => s.velocity))).toBeLessThan(
      Math.min(...unbanded.map((s) => s.velocity)),
    );
    // Every banded frame is an ASCENT frame of a bench rep...
    for (const state of banded) {
      expect(state.phase).toBe('ASCENT');
    }
    // ...and it never draws on the beat where the bar is motionless BY DESIGN.
    expect(history.filter((s) => s.phase === 'HOLE' && stallBand(s) !== null).length).toBe(0);
    // The other two lifts have no grind to rescue, so they never get a band —
    // both of them stall in the ordinary way and neither draws one.
    expect(rep(0.9).filter((s) => stallBand(s) !== null).length).toBe(0);
    expect(deadliftToTheDownCall(0.9).filter((s) => stallBand(s) !== null).length).toBe(0);
  });

  it('goes out the tick the bar moves again, at an unchanged stall total [the-stall-band-is-live-and-not-an-accumulator]', () => {
    // -----------------------------------------------------------------------
    // THE WITNESS'S OWN PAIR. `stallTicks` and `stallCapacityLoss` only ever
    // RISE, so a band keyed to either would come on at the first stalled tick
    // and stay on through the rescue and the lockout — a cue that has stopped
    // reading. These two states differ in `velocity` and in nothing else.
    // -----------------------------------------------------------------------
    const history = stalledRep();
    // THE DOMAIN, PINNED AS A COUNT: this pair is drawn out of a real stall of
    // real length, on a rep that really stopped, rather than out of one tick
    // somebody constructed. A stall this rep did not have would leave the pair
    // below comparing two states of a bar that was never losing.
    const stalledFrames = history.filter((s) => stallBand(s) !== null);
    // AN EXACT COUNT, NOT A BOUND — the rep is a pure function of its inputs,
    // and a bound is what let the first version of the test above stay green
    // while its subject changed shape underneath it. 17 -> 15 on the
    // 2026-08-28 (FOURTH) margin-band cut, same domain and same reason as the
    // sibling test above — see its header rather than restating it here.
    expect(stalledFrames.length, 'stalled frames this pair is drawn from').toBe(15);
    const stalledAt = stalledFrames[0];
    expect(stalledAt, 'the bar never stalled').toBeDefined();
    if (stalledAt === undefined) return;
    expect(stalledAt.stallTicks, 'no stalled ticks to hold fixed').toBeGreaterThan(0);
    const moving: LiftState = {
      ...stalledAt,
      velocity: LIFT_TUNING.GRIND_STALL_VELOCITY,
    };
    expect(moving.stallTicks).toBe(stalledAt.stallTicks);
    expect(moving.stallCapacityLoss).toBe(stalledAt.stallCapacityLoss);
    expect(stallBand(stalledAt)).not.toBeNull();
    expect(stallBand(moving), 'the band survived the bar moving again').toBeNull();
  });

  it('never blinks fully off, and pulses rather than sitting at one alpha', () => {
    const bands = stalledRep()
      .map((s) => stallBand(s))
      .filter((b) => b !== null);
    // Exact for the reason the pair test's count is: a bound is not a domain.
    // 17 -> 15 on the 2026-08-28 (FOURTH) margin-band cut — see 'draws while
    // the bar is losing and on no other lift', above, for the mechanism.
    expect(bands.length, 'no band to measure').toBe(15);
    const alphas = bands.map((b) => b.alpha);
    // A floor, because a frame at alpha 0 is indistinguishable from a stage
    // that draws no stall at all — which is what the browser check reads.
    const floor =
      SC.STALL_MIN_ALPHA * SC.STALL_PULSE_FLOOR;
    for (const alpha of alphas) {
      expect(alpha).toBeGreaterThanOrEqual(floor);
      expect(alpha).toBeLessThanOrEqual(SC.STALL_MAX_ALPHA);
    }
    expect(new Set(alphas).size, 'the band sat at one alpha').toBeGreaterThan(2);
  });

  it('is drawn at the stage edges and cannot reach the pip tray', () => {
    // WHY THIS IS PINNED RATHER THAN LEFT TO THE DRAWING. The browser check
    // reads the stall out of the stage's TOP STRIP and the readout out of the
    // TRAY, and if those two regions overlapped each measurement would be
    // reading the other's subject.
    const band = stalledRep()
      .map((s) => stallBand(s))
      .find((b) => b !== null);
    const readout = benchHistory(LOAD_PRESETS.HEAVY, { taps: 3 })
      .map((s) => grindReadout(s))
      .find((r) => r !== null);
    expect(band, 'no band to measure').toBeDefined();
    expect(readout, 'no readout to measure').toBeDefined();
    if (band === undefined || readout === undefined) return;
    const depth = band.band.strokeWidth;
    expect(band.band.x).toBe(depth / 2);
    expect(band.band.x + band.band.w).toBe(L.STAGE_W - depth / 2);
    expect(band.band.y + band.band.h).toBe(L.STAGE_H - depth / 2);
    // The tray sits inside every edge of the band by a real margin.
    expect(readout.tray.y, 'the top edge band reaches the tray').toBeGreaterThan(depth);
    expect(readout.tray.x).toBeGreaterThan(depth);
    expect(readout.tray.x + readout.tray.w).toBeLessThan(L.STAGE_W - depth);
    expect(readout.rail.y + readout.rail.h).toBeLessThan(L.STAGE_H - depth);
  });
});

describe('the bar glyph reads how the bar is arriving', () => {
  it('is steel on the two lifts with no chest to arrive at', () => {
    expect(rep(0.9).every((s) => barGlyphColour(s) === LIFT_PALETTE.BAR_STEEL)).toBe(true);
    expect(
      deadliftToTheDownCall(0.9).every((s) => barGlyphColour(s) === LIFT_PALETTE.BAR_STEEL),
    ).toBe(true);
  });

  it('moves across its bands within one bench descent', () => {
    // THE THIRD FACT AGAIN. A glyph pinned to one colour would satisfy "it is
    // one of the three approach colours" at every tick; what says the read
    // model reaches the drawing is that the colour CHANGES as the bar is fed
    // and braked, inside a single rep.
    const descent = benchHistory(LOAD_PRESETS.HEAVY).filter((s) => s.phase === 'DESCENT');
    expect(descent.length, 'no descent to read').toBeGreaterThan(20);
    const colours = new Set(descent.map((s) => barGlyphColour(s)));
    expect(colours.has(LIFT_PALETTE.BAR_STEEL)).toBe(false);
    // ALL THREE BANDS INSIDE ONE FED-AND-BRAKED DESCENT, which is the strongest
    // form of "it moves" available here: a fed bar runs hot, the brake brings
    // it back to calm, and the drawing follows. Pinned at three rather than
    // "more than one" so a band that stopped being reachable is red.
    expect(colours.size).toBe(3);
    expect(colours.has(LIFT_PALETTE.BAR_CRASHING)).toBe(true);
    expect(colours.has(LIFT_PALETTE.BAR_RUNNING_AWAY)).toBe(true);
    expect(colours.has(LIFT_PALETTE.BAR_UNDER_CONTROL)).toBe(true);
  });

  it('cannot reach the mechanic, so its bands decide a colour and never an outcome', () => {
    // THE SEPARATION, AS A STRUCTURAL FACT RATHER THAN A SWEEP. The two band
    // edges live in the FEEDBACK block and the drawing reads them; if `lift.ts`
    // ever read either name, a colour choice would have become a grading input
    // and this goes red. Names, not values — a value could coincide.
    const mechanic = readFileSync(path.join(HERE, '..', 'game', 'lift.ts'), 'utf8');
    for (const name of ['BAR_RUNAWAY_AT', 'BAR_CRASH_AT', 'barGlyphColour']) {
      expect(mechanic.includes(name), `lift.ts reads ${name}`).toBe(false);
    }
    // ...and the scan is pointed at a file it really opened.
    expect(mechanic.length).toBeGreaterThan(1000);
    expect(mechanic.includes('touchQualityFor')).toBe(true);
  });
});
