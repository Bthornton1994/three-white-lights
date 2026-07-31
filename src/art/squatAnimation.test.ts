import { describe, expect, it } from 'vitest';
import {
  DEPTH_STEPS,
  REP_PHASES,
  ascentRisePerTick,
  ascentShapeVariation,
  ascentTickFraction,
  ascentVelocity,
  buildSquatRep,
  longestAscentPoseRunTicks,
  longestStall,
  normalisedAscentProfile,
  peakBendPx,
  peakForwardDeviationPx,
  peakLateralDeviationPx,
  phaseTickCounts,
  type RepPhase,
  type SquatRep,
} from './squatAnimation';
import { BEND, LOAD_PRESETS, LOAD_RANGE, STICK, loadT } from './spriteTuning';

const light = buildSquatRep(LOAD_PRESETS.LIGHT);
const maximal = buildSquatRep(LOAD_PRESETS.MAXIMAL);

/** A load sweep across the whole modelled range, for monotonicity checks. */
const SWEEP: readonly number[] = Array.from({ length: 15 }, (_, i) =>
  Number((LOAD_RANGE.MIN + (i * (LOAD_RANGE.MAX - LOAD_RANGE.MIN)) / 14).toFixed(4)),
);

function assertNonDecreasing(label: string, metric: (rep: SquatRep) => number): void {
  let prev = -Infinity;
  for (const ratio of SWEEP) {
    const value = metric(buildSquatRep(ratio));
    expect(value, `${label} fell at loadRatio ${ratio}`).toBeGreaterThanOrEqual(prev - 1e-9);
    prev = value;
  }
}

// ---------------------------------------------------------------------------
// Frame data is well formed
// ---------------------------------------------------------------------------

describe('frame data well-formedness', () => {
  const reps = [light, maximal, buildSquatRep(0.4), buildSquatRep(1.05)];

  it('accounts for every tick exactly once', () => {
    for (const rep of reps) {
      const held = rep.frames.reduce((sum, f) => sum + f.holdTicks, 0);
      expect(held, `ratio ${rep.loadRatio}`).toBe(rep.totalTicks);
      expect(rep.samples).toHaveLength(rep.totalTicks);
    }
  });

  it('lays frames end to end with no gap and no overlap', () => {
    for (const rep of reps) {
      let cursor = 0;
      rep.frames.forEach((f, i) => {
        expect(f.index).toBe(i);
        expect(f.startTick, `ratio ${rep.loadRatio} frame ${i}`).toBe(cursor);
        expect(f.holdTicks).toBeGreaterThanOrEqual(1);
        expect(Number.isInteger(f.holdTicks)).toBe(true);
        cursor += f.holdTicks;
      });
      expect(cursor).toBe(rep.totalTicks);
    }
  });

  it('runs the phases once each, in order', () => {
    for (const rep of reps) {
      const order: RepPhase[] = [];
      for (const s of rep.samples) {
        if (order[order.length - 1] !== s.phase) order.push(s.phase);
      }
      expect(order, `ratio ${rep.loadRatio}`).toEqual([...REP_PHASES]);
    }
  });

  it('agrees with its own declared phase tick counts', () => {
    for (const rep of reps) {
      const counted: Record<string, number> = {};
      for (const s of rep.samples) counted[s.phase] = (counted[s.phase] ?? 0) + 1;
      for (const phase of REP_PHASES) {
        expect(counted[phase], `${phase} at ratio ${rep.loadRatio}`).toBe(rep.phaseTicks[phase]);
      }
      expect(phaseTickCounts(rep.loadRatio)).toEqual(rep.phaseTicks);
    }
  });

  it('keeps depth in range, starts standing, reaches the hole, ends standing', () => {
    for (const rep of reps) {
      for (const s of rep.samples) {
        expect(s.depth).toBeGreaterThanOrEqual(0);
        expect(s.depth).toBeLessThanOrEqual(1);
        expect(s.barHeight).toBeCloseTo(1 - s.depth, 12);
      }
      expect(rep.samples[0]?.depth).toBe(0);
      expect(rep.samples[rep.samples.length - 1]?.depth).toBe(0);
      expect(Math.max(...rep.samples.map((s) => s.depth))).toBe(1);
    }
  });

  it('quantises every drawn pose onto the authored depth grid', () => {
    for (const rep of reps) {
      for (const f of rep.frames) {
        const step = f.poseDepth * DEPTH_STEPS;
        expect(Math.abs(step - Math.round(step)), `frame ${f.index}`).toBeLessThan(1e-9);
        expect(f.poseDepth).toBeGreaterThanOrEqual(0);
        expect(f.poseDepth).toBeLessThanOrEqual(1);
      }
    }
  });

  it('faces the right way in each phase', () => {
    for (const rep of reps) {
      for (const s of rep.samples) {
        const expected = s.phase === 'ASCENT' || s.phase === 'LOCKOUT' ? 'ASCENT' : 'DESCENT';
        expect(s.direction, `${s.phase} tick ${s.tick}`).toBe(expected);
      }
    }
  });

  it('is deterministic', () => {
    expect(buildSquatRep(0.83).frames).toEqual(buildSquatRep(0.83).frames);
  });

  it('clamps loads outside the modelled range instead of extrapolating', () => {
    expect(buildSquatRep(0.05).totalTicks).toBe(buildSquatRep(LOAD_RANGE.MIN).totalTicks);
    expect(buildSquatRep(3).totalTicks).toBe(buildSquatRep(LOAD_RANGE.MAX).totalTicks);
  });
});

// ---------------------------------------------------------------------------
// The load response
// ---------------------------------------------------------------------------

describe('load moves the timing', () => {
  it('is monotone in load across the whole range', () => {
    assertNonDecreasing('total ticks', (r) => r.totalTicks);
    assertNonDecreasing('ascent ticks', (r) => r.phaseTicks.ASCENT);
    assertNonDecreasing('brace ticks', (r) => r.phaseTicks.BRACE);
    assertNonDecreasing('hole ticks', (r) => r.phaseTicks.HOLE);
  });

  it('makes a maximal rep take much longer than a light one', () => {
    expect(maximal.totalTicks).toBeGreaterThan(light.totalTicks * 1.5);
  });

  it('shifts the balance of the rep toward the concentric', () => {
    // A light rep spends proportionally more of itself coming down. A limit
    // attempt spends it coming up. This is a share, so duration cancels out.
    expect(ascentTickFraction(maximal)).toBeGreaterThan(ascentTickFraction(light) * 1.15);
    assertNonDecreasing('ascent share', ascentTickFraction);
  });
});

describe('load changes the SHAPE of the ascent, not just its length', () => {
  it('is not merely a slowed-down copy: the normalised profiles differ', () => {
    // THE test for the bar's central claim. Both profiles run 0 -> 1 over the
    // same normalised time, so if the maximal rep were the light rep played
    // slower, these two curves would be identical everywhere. They are not.
    const a = normalisedAscentProfile(light, 64);
    const b = normalisedAscentProfile(maximal, 64);
    expect(a).toHaveLength(64);
    expect(b).toHaveLength(64);
    let maxDiff = 0;
    for (let i = 0; i < 64; i += 1) maxDiff = Math.max(maxDiff, Math.abs((a[i] ?? 0) - (b[i] ?? 0)));
    expect(maxDiff).toBeGreaterThan(0.15);
  });

  it('rises at nearly constant speed when light and very unevenly when maximal', () => {
    // Coefficient of variation of the step sizes, measured in normalised time.
    expect(ascentShapeVariation(light)).toBeLessThan(0.15);
    expect(ascentShapeVariation(maximal)).toBeGreaterThan(0.4);
    expect(ascentShapeVariation(maximal)).toBeGreaterThan(ascentShapeVariation(light) * 4);
  });

  it('reports the same shape variation however finely it is sampled', () => {
    // The measure has to be about shape, not about the sample count, or the
    // previous assertion proves nothing.
    const coarse = ascentShapeVariation(maximal, 32);
    const fine = ascentShapeVariation(maximal, 128);
    expect(Math.abs(coarse - fine)).toBeLessThan(0.1);
  });

  it('never lets the bar travel backwards during the concentric', () => {
    for (const ratio of SWEEP) {
      for (const rise of ascentRisePerTick(buildSquatRep(ratio))) {
        expect(rise, `ratio ${ratio}`).toBeGreaterThanOrEqual(-1e-9);
      }
    }
  });
});

describe('the sticking point', () => {
  it('notches the velocity model at the authored height and nowhere else', () => {
    const at = (h: number): number => ascentVelocity(h, LOAD_PRESETS.MAXIMAL);
    expect(at(STICK.HEIGHT_FRAC)).toBeLessThan(at(0));
    expect(at(STICK.HEIGHT_FRAC)).toBeLessThan(at(1));
    // Sampled search: the minimum of v(h) must actually be at the authored spot.
    let argmin = 0;
    for (let i = 0; i <= 200; i += 1) {
      const h = i / 200;
      if (at(h) < at(argmin)) argmin = h;
    }
    expect(Math.abs(argmin - STICK.HEIGHT_FRAC)).toBeLessThan(0.02);
  });

  it('stalls a maximal attempt and does not stall a light one', () => {
    expect(longestStall(light).ticks).toBe(0);
    expect(longestStall(maximal).ticks).toBeGreaterThanOrEqual(10);
  });

  it('puts the stall a third of the way up, where a squat actually stalls', () => {
    expect(longestStall(maximal).atHeight).toBeGreaterThan(STICK.HEIGHT_FRAC - 0.15);
    expect(longestStall(maximal).atHeight).toBeLessThan(STICK.HEIGHT_FRAC + 0.15);
  });

  it('holds the bar at one drawn height for far longer under load', () => {
    // The drawing-level statement of the grind: the bar sits at one authored
    // depth step while the lifter fights it.
    expect(longestAscentPoseRunTicks(maximal)).toBeGreaterThan(
      longestAscentPoseRunTicks(light) * 3,
    );
    assertNonDecreasing('ticks at one bar height', longestAscentPoseRunTicks);
  });

  it('grows the stall monotonically with load', () => {
    assertNonDecreasing('stall ticks', (r) => longestStall(r).ticks);
  });
});

describe('bar path', () => {
  it('drifts forward much further under a maximal load', () => {
    expect(peakForwardDeviationPx(maximal)).toBeGreaterThan(peakForwardDeviationPx(light) * 3);
    assertNonDecreasing('peak forward drift', peakForwardDeviationPx);
  });

  it('peaks the forward drift during the concentric, near the sticking point', () => {
    const peak = peakForwardDeviationPx(maximal);
    const at = maximal.samples.find((s) => Math.abs(s.barForwardPx - peak) < 1e-9);
    expect(at).toBeDefined();
    expect(at?.phase).toBe('ASCENT');
    expect(Math.abs((at?.barHeight ?? 0) - STICK.HEIGHT_FRAC)).toBeLessThan(0.2);
  });

  it('shakes the bar sideways only when it is heavy', () => {
    expect(peakLateralDeviationPx(light)).toBeLessThan(0.5);
    expect(peakLateralDeviationPx(maximal)).toBeGreaterThan(1);
    assertNonDecreasing('peak lateral drift', peakLateralDeviationPx);
  });

  it('confines the shake and the tilt to the concentric', () => {
    for (const s of maximal.samples) {
      if (s.phase === 'ASCENT') continue;
      expect(s.barLateralPx, `${s.phase} tick ${s.tick}`).toBe(0);
      expect(s.barTiltDeg, `${s.phase} tick ${s.tick}`).toBe(0);
    }
  });
});

describe('bar whip', () => {
  it('bends the sleeves further under load, monotonically', () => {
    expect(peakBendPx(maximal)).toBeGreaterThan(peakBendPx(light) * 2.5);
    assertNonDecreasing('peak bend', peakBendPx);
  });

  it('keeps bend non-negative and inside the drawable ceiling', () => {
    for (const ratio of SWEEP) {
      for (const s of buildSquatRep(ratio).samples) {
        expect(s.barBendPx).toBeGreaterThanOrEqual(0);
        expect(s.barBendPx).toBeLessThanOrEqual(BEND.MAX_PX);
      }
    }
  });

  it('does not let a phase boundary fake a heavy bar', () => {
    // Regression: before the acceleration was smoothed, the one-tick velocity
    // discontinuity at DESCENT -> HOLE spiked the whip term and a light rep bent
    // its bar 3.8 px, almost as far as a maximal one.
    expect(peakBendPx(light)).toBeLessThan(1.5);
  });
});

describe('strain', () => {
  it('rises with load and peaks in the hole or on the grind', () => {
    const peak = (rep: SquatRep): number => Math.max(...rep.samples.map((s) => s.strain));
    expect(peak(maximal)).toBeGreaterThan(peak(light) * 3);
    assertNonDecreasing('peak strain', peak);

    const worst = maximal.samples.reduce((a, b) => (b.strain > a.strain ? b : a));
    expect(['HOLE', 'ASCENT']).toContain(worst.phase);
  });

  it('drives the drawing, so a still frame differs by load with no clock involved', () => {
    const lightLevels = new Set(light.frames.map((f) => f.strainLevel));
    const maxLevels = new Set(maximal.frames.map((f) => f.strainLevel));
    expect(Math.max(...maxLevels)).toBeGreaterThan(Math.max(...lightLevels));
  });

  it('stays inside the quantised level range', () => {
    for (const ratio of SWEEP) {
      for (const f of buildSquatRep(ratio).frames) {
        expect(f.strainLevel).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(f.strainLevel)).toBe(true);
      }
    }
  });
});

describe('load curve', () => {
  it('is monotone and clamped', () => {
    expect(loadT(LOAD_RANGE.MIN)).toBe(0);
    expect(loadT(LOAD_RANGE.MAX)).toBe(1);
    expect(loadT(0)).toBe(0);
    expect(loadT(5)).toBe(1);
    let prev = -1;
    for (let r = 0.3; r <= 1.1; r += 0.01) {
      const t = loadT(r);
      expect(t).toBeGreaterThanOrEqual(prev);
      prev = t;
    }
  });

  it('puts a named MAXIMAL attempt below the MAXIMAL endpoint, as documented', () => {
    // The endpoints are headroom above a 1.0 attempt. If this ever becomes 1.0,
    // the comment in spriteTuning.ts about LOAD_RANGE is wrong.
    expect(loadT(LOAD_PRESETS.MAXIMAL)).toBeGreaterThan(0.8);
    expect(loadT(LOAD_PRESETS.MAXIMAL)).toBeLessThan(1);
  });
});
