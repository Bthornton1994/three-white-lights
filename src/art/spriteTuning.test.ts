/**
 * Guards on the tuning file itself.
 *
 * `spriteTuning.ts` is the one place a playtester edits, and CLAUDE.md commits
 * to roughly 30 hand passes over it. Everything below is a rule that a hand
 * pass could plausibly break without breaking anything that looks related:
 * a table that no longer has one entry per level, a duplicated constant that
 * has drifted out of step with its twin, a mote count larger than the mote
 * table. None of them are assertions that the values are *right* — no test can
 * say that — only that they are still self-consistent.
 */

import { describe, expect, it } from 'vitest';
import {
  BAR_PATH,
  BRACE_SETTLE_DEPTH,
  CHALK,
  LOAD_PRESETS,
  LOAD_RANGE,
  PITCH,
  QUANTISE,
  SHADING,
  SPRITE_TUNING,
  STICK,
  STRAIN,
  byLoad,
  clampLoadRatio,
  loadT,
  ticksByLoad,
} from './spriteTuning';
import {
  POSE_DEPTH_ANCHORS,
  RIG_GEOMETRY,
  strainForLevel,
  strainLevel,
  pitchForLevel,
  pitchLevelForDriftPx,
} from './rig';
import { BEND_QUANTUM_PX, DEPTH_STEPS, TILT_QUANTUM_DEG } from './squatAnimation';

describe('authored deformation tables', () => {
  it('has exactly one entry per level, in both channels', () => {
    expect(STRAIN.LEVEL_DELTAS).toHaveLength(STRAIN.LEVELS);
    expect(PITCH.LEVEL_DELTAS).toHaveLength(PITCH.LEVELS);
  });

  it('keeps level 0 undeformed, because that is what level 0 means', () => {
    for (const v of Object.values(STRAIN.LEVEL_DELTAS[0] ?? {})) expect(v).toBe(0);
    for (const v of Object.values(PITCH.LEVEL_DELTAS[0] ?? {})) expect(v).toBe(0);
  });

  it('never lets a field go backwards as the level rises', () => {
    // Strain is meant to be a ladder. A field that shrank between two rungs
    // would mean a heavier rep drawing a tidier body in that respect.
    for (const table of [STRAIN.LEVEL_DELTAS, PITCH.LEVEL_DELTAS] as const) {
      for (let i = 1; i < table.length; i += 1) {
        const prev = table[i - 1] as Record<string, number> | undefined;
        const cur = table[i] as Record<string, number> | undefined;
        if (prev === undefined || cur === undefined) continue;
        for (const key of Object.keys(cur)) {
          expect(cur[key], `${key} at level ${i}`).toBeGreaterThanOrEqual(prev[key] ?? 0);
        }
      }
    }
  });

  it('makes the top strain rung a different DRAWING, not a louder one', () => {
    // The failure this exists for: one delta vector scaled linearly, so the
    // drawing a working set reaches and the one a limit single reaches differ
    // only by a gain. The levels the animation actually produces are 1 and 3,
    // so 3 has to be more than 3x of 1 on the fields that carry the read, or
    // the whole table is a scalar in disguise.
    const one = STRAIN.LEVEL_DELTAS[1];
    const three = STRAIN.LEVEL_DELTAS[3];
    expect(one).toBeDefined();
    expect(three).toBeDefined();
    if (one === undefined || three === undefined) return;
    expect(three.ELBOW_TUCK / one.ELBOW_TUCK).toBeGreaterThan(5);
    expect(three.KNEE_VALGUS / one.KNEE_VALGUS).toBeGreaterThan(5);
    expect(three.STANCE_SPREAD / one.STANCE_SPREAD).toBeGreaterThan(5);
  });

  it('gives the top rung deltas that survive rounding into a 96x72 grid', () => {
    // Anything under a pixel is a comment, not a drawing.
    const three = STRAIN.LEVEL_DELTAS[STRAIN.LEVELS - 1];
    expect(three).toBeDefined();
    if (three === undefined) return;
    const overAPixel = Object.values(three).filter((v) => v >= 1).length;
    expect(overAPixel).toBeGreaterThanOrEqual(5);
  });

  it('scales the pitch channel to the drift the bar path actually produces', () => {
    // If FULL_PX ever stops tracking the modelled drift, the top pitch level
    // becomes unreachable and the channel quietly goes dead.
    expect(PITCH.FULL_PX).toBe(BAR_PATH.FORWARD_PX.MAXIMAL);
    expect(pitchLevelForDriftPx(BAR_PATH.FORWARD_PX.MAXIMAL)).toBe(PITCH.LEVELS - 1);
    expect(pitchLevelForDriftPx(0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// THE STRAIN LADDER ACROSS THE PHASES
//
// `PHASE_WEIGHT` decides which authored drawing a load reaches at each beat.
// Three things a hand pass can break here are invisible in the file itself and
// only show up as a wrong-looking rep:
//
//   1. The brace stops responding to load at all, so the frame the screen opens
//      on and holds is the same body at every weight.
//   2. The brace out-weighs the top of the descent, so the lifter is drawn
//      strained standing still and then RELAXES on the first tick of the
//      eccentric.
//   3. The brace weight goes so high that every load braces strained, which
//      trades one flat frame for another.
//
// The rung boundaries these are measured against are `strainLevel`'s, so the
// assertions are about DRAWINGS, not about the raw weights.
// ---------------------------------------------------------------------------

describe('the strain phase ladder', () => {
  const presets = Object.entries(LOAD_PRESETS);
  const braceRung = (load: number): number =>
    strainLevel(byLoad(STRAIN.FROM_LOAD, load) * STRAIN.PHASE_WEIGHT.BRACE);
  const descentTopRung = (load: number): number =>
    strainLevel(byLoad(STRAIN.FROM_LOAD, load) * STRAIN.PHASE_WEIGHT.DESCENT_TOP);

  it('never draws the brace heavier than the top of the descent it leads into', () => {
    // The brace IS the top of the descent, held still: the same body, the same
    // bar, the same height. A brace weighted above DESCENT_TOP means the lifter
    // loosens the instant the bar starts moving.
    expect(STRAIN.PHASE_WEIGHT.BRACE).toBeLessThanOrEqual(STRAIN.PHASE_WEIGHT.DESCENT_TOP);
    expect(STRAIN.PHASE_WEIGHT.DESCENT_TOP).toBeLessThan(STRAIN.PHASE_WEIGHT.DESCENT_BOTTOM);
  });

  it('never lets any load pop down a rung between the brace and the descent', () => {
    // The weight ordering above is sufficient for this, but this is the version
    // a viewer would actually notice, stated over the loads the game ships.
    for (const [name, load] of presets) {
      expect(braceRung(load), `${name} brace -> descent top`).toBeLessThanOrEqual(
        descentTopRung(load),
      );
    }
  });

  it('makes the braced BODY answer to load, without making every brace heavy', () => {
    // Both halves matter. A brace ladder that is flat at 0 is the gap this
    // block exists for; a brace ladder that is flat at 1 has only moved it.
    expect(braceRung(LOAD_PRESETS.WARMUP)).toBe(0);
    expect(braceRung(LOAD_PRESETS.LIGHT)).toBe(0);
    expect(braceRung(LOAD_PRESETS.MAXIMAL)).toBeGreaterThan(braceRung(LOAD_PRESETS.LIGHT));
    // The load the app opens on is not allowed to be the flat one either.
    expect(braceRung(LOAD_PRESETS.HEAVY)).toBeGreaterThan(braceRung(LOAD_PRESETS.LIGHT));
  });

  it('keeps the brace rung monotone in load', () => {
    let previous = -Infinity;
    for (let load = LOAD_RANGE.MIN; load <= LOAD_RANGE.MAX; load += 0.01) {
      const rung = braceRung(load);
      expect(rung, `load ${load.toFixed(2)}`).toBeGreaterThanOrEqual(previous);
      previous = rung;
    }
  });
});

describe('level quantisers', () => {
  it('spans 0..1 across the authored levels', () => {
    expect(strainForLevel(0)).toBe(0);
    expect(strainForLevel(STRAIN.LEVELS - 1)).toBe(1);
    expect(pitchForLevel(0)).toBe(0);
    expect(pitchForLevel(PITCH.LEVELS - 1)).toBe(1);
  });

  it('clamps rather than extrapolating', () => {
    expect(strainForLevel(-4)).toBe(0);
    expect(strainForLevel(99)).toBe(1);
    expect(pitchLevelForDriftPx(1000)).toBe(PITCH.LEVELS - 1);
    expect(pitchLevelForDriftPx(-1000)).toBe(PITCH.LEVELS - 1);
  });
});

describe('constants with more than one consumer', () => {
  it('anchors the BRACE drawing at the depth the brace phase settles to', () => {
    // These were two separate literals. Moving one and not the other made the
    // lifter snap between drawings at the top of every rep, and neither file
    // looked wrong on its own.
    const brace = POSE_DEPTH_ANCHORS.DESCENT.find((a) => a.key === 'BRACE');
    expect(brace?.depth).toBe(BRACE_SETTLE_DEPTH);
  });

  it('drives the animation quantisers from the tuning file, not from copies', () => {
    expect(DEPTH_STEPS).toBe(QUANTISE.DEPTH_STEPS);
    expect(TILT_QUANTUM_DEG).toBe(QUANTISE.TILT_QUANTUM_DEG);
    expect(BEND_QUANTUM_PX).toBe(QUANTISE.BEND_QUANTUM_PX);
  });

  it('never asks for more chalk motes than there are authored positions', () => {
    expect(CHALK.MAX_MOTES).toBeLessThanOrEqual(CHALK.MOTE_OFFSETS.length);
    expect(CHALK.MOTE_OFFSETS.length).toBeGreaterThan(0);
  });

  it('keeps every ramp-step bias in the tuning file, not among the joint coordinates', () => {
    // Three of these — head, belt, knee sleeve — used to sit in RIG_GEOMETRY,
    // which is exempted from this file on the grounds that a joint anchor
    // "cannot be moved without redrawing the pose it names". A ramp-step bias
    // moves no geometry and turns on its own, so the exemption never covered
    // it, and a tuner looking for the sleeve's darkness had to know to go
    // reading a rig file. CLAUDE.md: every such value in one named place.
    for (const key of [
      'FAR_LIMB_STEP_BIAS',
      'FAR_LEG_STEP_BIAS',
      'EDGE_STEP_DROP',
      'HEAD_STEP_BIAS',
      'BELT_STEP_BIAS',
      'KNEE_SLEEVE_STEP_BIAS',
    ]) {
      expect(SHADING, key).toHaveProperty(key);
      expect(typeof (SHADING as unknown as Record<string, unknown>)[key], key).toBe('number');
    }
    // And they are reachable from the aggregate a tuner opens, not just from a
    // named import somewhere.
    expect(SPRITE_TUNING.SHADING).toBe(SHADING);

    // Nothing of the kind has come back the other way. Walked rather than
    // spot-checked: the sleeve's bias was nested one level down, inside
    // RIG_GEOMETRY.KNEE_SLEEVE, which is exactly where a spot check misses it.
    const offenders: string[] = [];
    const walk = (node: unknown, path: string): void => {
      if (node === null || typeof node !== 'object') return;
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (/STEP_BIAS|STEP_DROP/.test(k)) offenders.push(`${path}.${k}`);
        walk(v, `${path}.${k}`);
      }
    };
    walk(RIG_GEOMETRY, 'RIG_GEOMETRY');
    expect(offenders).toEqual([]);
  });

  it('keeps the velocity floor low enough to leave the stall room to exist', () => {
    // STICK.MIN_VELOCITY was a private constant in the animation module. It is
    // a tunable because it becomes binding as DEPTH approaches 1 — which is
    // exactly the knob the file invites turning — and at that point it, not
    // DEPTH, decides how long the grind runs.
    expect(STICK.MIN_VELOCITY).toBeGreaterThan(0);
    expect(STICK.MIN_VELOCITY).toBeLessThan(1 - STICK.DEPTH.MAXIMAL);
  });
});

describe('load curve helpers', () => {
  it('clamps into the modelled range', () => {
    expect(clampLoadRatio(0)).toBe(LOAD_RANGE.MIN);
    expect(clampLoadRatio(9)).toBe(LOAD_RANGE.MAX);
    expect(clampLoadRatio(0.7)).toBe(0.7);
  });

  it('interpolates an endpoint pair between its endpoints', () => {
    const pair = { LIGHT: 10, MAXIMAL: 20 };
    expect(byLoad(pair, LOAD_RANGE.MIN)).toBe(10);
    expect(byLoad(pair, LOAD_RANGE.MAX)).toBe(20);
    expect(byLoad(pair, 0.7)).toBeCloseTo(10 + 10 * loadT(0.7), 9);
  });

  it('rounds ticks to whole frames and never below one', () => {
    expect(ticksByLoad({ LIGHT: 0.1, MAXIMAL: 0.2 }, 0.5)).toBe(1);
    expect(Number.isInteger(ticksByLoad({ LIGHT: 3.4, MAXIMAL: 9.6 }, 0.8))).toBe(true);
  });
});
