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

import { describe, expect, it } from 'vitest';

import {
  LIFT_PHASES,
  braceTicks,
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
  cuePulse,
  cueRing,
  hitFlash,
  stageShake,
  directionFor,
  frameKey,
  liftFrameSpec,
  liveStrain,
  totalKgFor,
  traceAlpha,
  tracePoints,
  traceX,
  traceY,
} from './liftFrame';

const L = LIFT_TUNING.LAYOUT;
const DEMO_KG = LIFT_TUNING.DEMO.BEST_SINGLE_KG;

// ---------------------------------------------------------------------------
// Harness — reuses the real mechanic, so what is measured is what is drawn.
// ---------------------------------------------------------------------------

function scriptFor(load: number, drive: boolean): ScriptedInput[] {
  const press = braceTicks(load) + 1;
  const release = press + Math.round(LIFT_TUNING.DEPTH_IDEAL / descentRate(load));
  const script: ScriptedInput[] = [
    { tick: press, kind: 'press' },
    { tick: release, kind: 'release' },
  ];
  if (!drive) return script;
  const probe = runLift({ loadRatio: load, seed: 4 }, script);
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
  return runLift({ loadRatio: load, seed: 4 }, scriptFor(load, drive)).history;
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
