/**
 * memberRig.test.ts — grades VL-3's rig against the clip table and the
 * registered `FLOOR_MEMBER_MOTION_*` knobs: every clip has exactly the
 * frames the table asks for, nothing is NaN, the walk's planted foot holds
 * one world x through each stance under the runtime's uniform advance, the
 * cycle closes, the root travels the stride, the clip edges the runtime cuts
 * along meet within tolerance, and the baked artefacts on disk are the
 * rig's — not a stale bake of an earlier author.
 *
 * MUTATION WITNESSES, recorded at declaration time as CLAUDE.md asks (each
 * mutant planted in `memberRig.ts`, the named assertion watched go red, the
 * source restored and confirmed byte-identical):
 *
 *   1. `plants the stance foot: its ball keeps one world x through each
 *      stance under uniform advance`. Mutant: in `retimedSamples`, replace
 *      `return times;` with `return times.map((_, k) => t0 + (k / count) *
 *      (t1 - t0));` (sampling the authored gait at equal times instead of
 *      solving the foot). Red at `expected 8.207942427808518 to be less
 *      than or equal to 0.25` — the largest ball drift across a stance, in
 *      canvas px, without the solve. The same mutant leaves `sizes the
 *      authored swing to the runtime's stride` green, because the stride
 *      is a property of the contact pose and not of the sampling; the two
 *      checks are independent and are meant to be. It also reddens the
 *      metadata-on-disk check (the bake would differ) and, at −1.12 px, the
 *      swing-foot clearance's lower bound — recorded because it says that
 *      bound sits close to the authored swing, not because it was aimed at.
 *
 *   2. `solves the root height so the planted sole sits on the ground
 *      line`. Mutant: in `segmentFrames`, `const y = groundLineY() -
 *      sole.lowestY;` → `const y = groundLineY() - sole.lowestY - 1;`.
 *      Red at `expected 251 to be close to 252, received difference is 1`,
 *      and the same difference on `idle#0` and `bench-setup#0` in the two
 *      stand checks.
 *
 *   Measured 2026-09-08 on the rig at the commit that adds this file; the
 *   source hash before and after each plant was identical (sha256
 *   1ce6fc0b70ca0457…). Re-run at art round 2 (rig e4441c720715b61b…):
 *   mutant 1 reads `expected 8.207942427808518 to be less than or equal to
 *   0.25` still, and now also reddens `retimes the standing transitions`
 *   at `walk-to-wait: expected 7.401341383456099 to be less than or equal
 *   to 0.25`, because the transitions share the solver; mutant 2 reads
 *   `expected 251 to be close to 252` on the walk, `idle#0` and
 *   `bench-setup#0` as before.
 *
 *   ART ROUND 2 WITNESSES, planted in `memberPuppet.ts` (880504e5c343ad9d…)
 *   unless said otherwise, each restored and hash-checked:
 *
 *   3. `retimes the standing transitions like the walk: uniform root
 *      advance, the planted ball at one world x`. Mutant: `retime: true`
 *      → `retime: false` in `walkToWaitSegment`'s plant. Red at
 *      `walk-to-wait#1: expected 17.842517630090953 to be close to
 *      10.348217267792458` — round 1's non-uniform advance, back.
 *
 *   4. `holds the pelvis at one canvas point across each dissolve edge`.
 *      Mutant: `LYING_ROOT` x 180 → 170. Red at `bench-setup →
 *      bench-mount: pelvis gap 10.00 px: expected 10.000640815792945 to
 *      be less than or equal to 6`; the thirds check reddens too, because
 *      the total shrank under the same largest move.
 *
 *   5. `spreads the hips' travel to the bench … in near-equal thirds`.
 *      Mutant: `SEATED.nearThigh` 55 → 75 (round 1's sit-back). Red at
 *      `expected 29.16013218665239 to be less than or equal to
 *      23.041948445880895`.
 *
 *   6. `breathes once per cycle …`. Mutant: the half-way key's inhale 1 →
 *      `KEY_HALF` in `standingSegment`. Red at `expected 0.5999999999999943
 *      to be close to 1.2`.
 *
 *   7. `measured the dissolve overlap at bake time above the registered
 *      floor`. Mutant, in `member-motion-measurements.json`: the first
 *      `"iou": 0.33…` → `0.13…`. Red at `bench-setup>bench-mount: expected
 *      0.1318443966979532 to be greater than or equal to 0.3`. A data
 *      mutant, so it proves the pin reads the file and not that the bake
 *      measures correctly; the bake's IoU was checked against an
 *      independent reimplementation (same 5869 / 17686) at the same commit.
 *
 *   Every art-round-2 mutant also reddens the metadata-on-disk check, as
 *   it must: a re-posed puppet is a different bake.
 *
 * What these do NOT cover, stated so nobody reads them as more: the
 * witnesses prove the checks bite on the frames the rig authors. The domain
 * is the clip table's frame counts, which is every frame the runtime can
 * draw, so a pose the runtime never draws is not a pose this file grades;
 * but a defect that only shows BETWEEN two baked frames — a runtime
 * crossfade between clips — is the runtime's to test, not the rig's. The
 * phone-size breath pin and the dissolve IoU pin read numbers the BAKE
 * measured off pixels and wrote beside the sheets; this file re-derives
 * neither, so a bake that measured wrongly and wrote a passing number is
 * invisible here — `--check` byte-identity and the scratch reimplementation
 * are what stand behind those two numbers, not this file.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { EMPIRE_TUNING } from './empireTuning';
import {
  MEMBER_MOTION_CANVAS_PX,
  MEMBER_MOTION_CLIP_SPECS,
  MEMBER_MOTION_CLIPS,
  MEMBER_MOTION_DISSOLVE_EDGES,
  MEMBER_MOTION_PRODUCTION_TYPES,
  MEMBER_MOTION_TRANSITIONS,
  memberMotionDissolveEdge,
  memberMotionStripStem,
  type MemberMotionClip,
} from './memberMotionClips';
import { FOOT_FLAT, PUPPETS, WALK_SEGMENT } from './memberPuppet';
import {
  authoredStridePx,
  footFlatDegrees,
  framePoint,
  groundLineY,
  memberRigClip,
  memberRigClips,
  memberRigMetadata,
  memberRigStridePx,
  plantedWorldX,
  poseAt,
  restDegrees,
  twoBoneDegrees,
  type RigFrame,
} from './memberRig';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', '..');
const ART_DIR = path.join(ROOT, 'public', 'empire-art');
const SHEET_DIR = path.join(ROOT, 'docs', 'design', 'living-gym-world', 'vl-3');

const CLIPS = memberRigClips();
const WALK = CLIPS.walk.frames;

const last = (clip: MemberMotionClip): RigFrame => {
  const frame = CLIPS[clip].frames[CLIPS[clip].frames.length - 1];
  if (frame === undefined) throw new Error(`${clip} has no frames`);
  return frame;
};
const first = (clip: MemberMotionClip): RigFrame => {
  const frame = CLIPS[clip].frames[0];
  if (frame === undefined) throw new Error(`${clip} has no frames`);
  return frame;
};

/** Every number reachable in a frame, for the NaN sweep. */
function numbersOf(value: unknown, out: number[] = []): number[] {
  if (typeof value === 'number') out.push(value);
  else if (Array.isArray(value)) for (const each of value) numbersOf(each, out);
  else if (value !== null && typeof value === 'object') for (const each of Object.values(value)) numbersOf(each, out);
  return out;
}

/** The lowest sole point (largest canvas y) of a walker foot in a frame. */
function lowestSoleY(frame: RigFrame, foot: string): number {
  const part = PUPPETS[frame.puppet].parts.find((p) => p.name === foot);
  if (part?.sole === undefined) throw new Error(`${foot} has no sole`);
  return Math.max(framePoint(frame, foot, part.sole.heel).y, framePoint(frame, foot, part.sole.ball).y);
}

/** Smallest difference between two absolute angles, degrees, so 180 and −180 are the same direction. */
function angleGap(a: number, b: number): number {
  const raw = (((a - b) % 360) + 540) % 360;
  return Math.abs(raw - 180);
}

/** Largest angle difference over the parts both frames share, degrees. */
function largestAngleGap(a: RigFrame, b: RigFrame): { readonly part: string; readonly gap: number } {
  let worst = { part: '', gap: 0 };
  for (const [part, angle] of Object.entries(a.angles)) {
    const other = b.angles[part];
    if (other === undefined) continue;
    const gap = angleGap(angle, other);
    if (gap > worst.gap) worst = { part, gap };
  }
  return worst;
}

describe('memberRig: the clip table', () => {
  it('produces exactly the frames MEMBER_MOTION_CLIP_SPECS asks for, set-equal over the clip list', () => {
    expect(Object.keys(CLIPS).sort()).toEqual([...MEMBER_MOTION_CLIPS].sort());
    let total = 0;
    for (const clip of MEMBER_MOTION_CLIPS) {
      expect(CLIPS[clip].frames.length, clip).toBe(MEMBER_MOTION_CLIP_SPECS[clip].frames);
      CLIPS[clip].frames.forEach((frame, i) => {
        expect(frame.index).toBe(i);
        expect(frame.clip).toBe(clip);
      });
      total += CLIPS[clip].frames.length;
    }
    // Ten clips: 16 + 12 + 12 + 4 + 4 + 5 + 3 + 12 + 3 + 5. The bench split
    // (art round 2) moved three presser frames out of each eight-frame
    // bench clip into mount and dismount, so the total is unchanged.
    expect(MEMBER_MOTION_CLIPS.length).toBe(10);
    expect(total).toBe(76);
  });

  it('has no NaN and no infinity anywhere in any frame', () => {
    let counted = 0;
    for (const clip of MEMBER_MOTION_CLIPS) {
      for (const frame of CLIPS[clip].frames) {
        for (const n of numbersOf(frame)) {
          expect(Number.isFinite(n), `${clip}#${frame.index}`).toBe(true);
          counted += 1;
        }
      }
    }
    // Non-vacuity: the sweep saw real numbers. Placements, angles, sole
    // points, advances, bar centres and boxes over 76 frames.
    expect(counted).toBeGreaterThan(76 * 40);
  });

  it('draws every part of the frame’s puppet exactly once, in the puppet’s draw order', () => {
    for (const clip of MEMBER_MOTION_CLIPS) {
      for (const frame of CLIPS[clip].frames) {
        expect(frame.placements.map((p) => p.part)).toEqual(PUPPETS[frame.puppet].parts.map((p) => p.name));
      }
    }
  });
});

describe('memberRig: the walk', () => {
  const stanceRuns = (): { readonly foot: string; readonly frames: readonly RigFrame[] }[] => {
    const runs: { foot: string; frames: RigFrame[] }[] = [];
    for (const frame of WALK) {
      const last = runs[runs.length - 1];
      if (frame.plantedFoot === null) continue;
      if (last !== undefined && last.foot === frame.plantedFoot) last.frames.push(frame);
      else runs.push({ foot: frame.plantedFoot, frames: [frame] });
    }
    return runs;
  };

  it('plants the stance foot: its ball keeps one world x through each stance under uniform advance', () => {
    const runs = stanceRuns();
    // Two stances of eight frames each, one per foot — the non-vacuity pin.
    expect(runs.map((run) => [run.foot, run.frames.length])).toEqual([
      ['nearFoot', 8],
      ['farFoot', 8],
    ]);
    let worst = 0;
    for (const run of runs) {
      const xs = run.frames.map((frame) => plantedWorldX(frame));
      for (const x of xs) expect(x).not.toBeNull();
      const world = xs as number[];
      const drift = Math.max(...world) - Math.min(...world);
      worst = Math.max(worst, drift);
    }
    expect(worst).toBeLessThanOrEqual(EMPIRE_TUNING.FLOOR_MEMBER_MOTION_FOOT_DRIFT_TOLERANCE_PX);
  });

  it('advances the root uniformly, one sixteenth of the stride per frame', () => {
    const step = authoredStridePx() / WALK.length;
    WALK.forEach((frame, i) => {
      expect(frame.rootAdvance).toBeCloseTo(i * step, 6);
    });
  });

  it('sizes the authored swing to the runtime’s stride', () => {
    const stride = authoredStridePx();
    expect(Math.abs(stride - memberRigStridePx())).toBeLessThanOrEqual(EMPIRE_TUNING.FLOOR_MEMBER_MOTION_STRIDE_TOLERANCE_PX);
    // The runtime's number is 1.1 tiles × 256 / 1.6 = 176; the authored gait lands at 176.3.
    expect(memberRigStridePx()).toBeCloseTo(176, 6);
    expect(stride).toBeGreaterThan(175);
    expect(stride).toBeLessThan(178);
    const last = WALK[WALK.length - 1];
    if (last === undefined) throw new Error('no frames');
    expect(last.rootAdvance + stride / WALK.length).toBeCloseTo(stride, 6);
  });

  it('closes the cycle: the pose at t = 1 is the pose at t = 0, and the second step mirrors the first', () => {
    const start = poseAt(WALK_SEGMENT, 0);
    const end = poseAt(WALK_SEGMENT, 1);
    for (const [part, angle] of Object.entries(start.angles)) expect(end.angles[part], part).toBeCloseTo(angle, 9);
    const first = WALK[0];
    const half = WALK[8];
    if (first === undefined || half === undefined) throw new Error('no frames');
    for (const [near, far] of PUPPETS.walker.mirror) {
      expect(half.angles[far], `${near}→${far}`).toBeCloseTo(first.angles[near] ?? Number.NaN, 6);
      expect(half.angles[near], `${far}→${near}`).toBeCloseTo(first.angles[far] ?? Number.NaN, 6);
    }
    expect(half.root.y).toBeCloseTo(first.root.y, 6);
  });

  it('solves the root height so the planted sole sits on the ground line', () => {
    for (const frame of WALK) {
      if (frame.plantedFoot === null) throw new Error(`walk frame ${frame.index} plants nothing`);
      expect(lowestSoleY(frame, frame.plantedFoot)).toBeCloseTo(groundLineY(), 6);
    }
    expect(groundLineY()).toBe(MEMBER_MOTION_CANVAS_PX - EMPIRE_TUNING.FLOOR_MEMBER_MOTION_GROUND_INSET_PX);
  });

  it('keeps the swing foot above the floor at every frame', () => {
    let deepest = Number.NEGATIVE_INFINITY;
    for (const frame of WALK) {
      const swing = frame.plantedFoot === 'nearFoot' ? 'farFoot' : 'nearFoot';
      // Canvas y grows downward: a foot below the line has a LARGER y.
      const penetration = lowestSoleY(frame, swing) - groundLineY();
      deepest = Math.max(deepest, penetration);
    }
    expect(deepest).toBeLessThanOrEqual(-EMPIRE_TUNING.FLOOR_MEMBER_MOTION_SWING_CLEARANCE_MIN_PX);
    // The swing foot does come down: at the contact frames both feet are on the line.
    expect(deepest).toBeGreaterThan(-1);
  });

  it('bounces from the leg chain, inside the registered ceiling', () => {
    const ys = WALK.map((frame) => frame.root.y);
    const bounce = Math.max(...ys) - Math.min(...ys);
    expect(bounce).toBeLessThanOrEqual(EMPIRE_TUNING.FLOOR_MEMBER_MOTION_GAIT_BOUNCE_MAX_PX);
    // Measured 5.5 px at the authored swing: lowest at contact, highest near passing.
    expect(bounce).toBeGreaterThan(3);
    expect(bounce).toBeLessThan(8);
    const lowest = ys.indexOf(Math.max(...ys));
    const highest = ys.indexOf(Math.min(...ys));
    expect([0, 8]).toContain(lowest);
    expect([3, 4, 5, 11, 12, 13]).toContain(highest);
  });

  it('pins the root x at the canvas centre in every body-frame frame', () => {
    for (const clip of ['walk', 'idle', 'wait', 'walk-to-wait', 'wait-to-walk'] as const) {
      for (const frame of CLIPS[clip].frames) expect(frame.root.x, `${clip}#${frame.index}`).toBe(MEMBER_MOTION_CANVAS_PX / 2);
    }
  });
});

describe('memberRig: the stands and the transitions', () => {
  const tolerance = EMPIRE_TUNING.FLOOR_MEMBER_MOTION_POSE_TOLERANCE_DEGREES;
  const rootTolerance = EMPIRE_TUNING.FLOOR_MEMBER_MOTION_ROOT_TOLERANCE_PX;

  const meets = (from: RigFrame, to: RigFrame, label: string): void => {
    expect(from.puppet, label).toBe(to.puppet);
    const worst = largestAngleGap(from, to);
    expect(worst.gap, `${label}: ${worst.part} differs by ${worst.gap.toFixed(2)}°`).toBeLessThanOrEqual(tolerance);
    expect(Math.hypot(from.root.x - to.root.x, from.root.y - to.root.y), `${label}: root`).toBeLessThanOrEqual(rootTolerance);
  };

  it('meets across every HARD-CUT edge the runtime cuts along, and the two dissolve edges are the only ones that change puppet', () => {
    // The end of the outgoing clip against the start of the incoming one,
    // for every edge in the table except the two dissolves. The edges INTO
    // a looping clip from a looping clip (wait ↔ idle) compare first frame
    // to first frame, because the runtime may cut at any phase and the two
    // stands share a shape. Bench-mount → bench-press and bench-press →
    // bench-dismount are presser to presser at lockout.
    let checked = 0;
    let dissolves = 0;
    for (const [from, to] of MEMBER_MOTION_TRANSITIONS) {
      const outgoing = MEMBER_MOTION_CLIP_SPECS[from].loop ? first(from) : last(from);
      const incoming = first(to);
      if (memberMotionDissolveEdge(from, to)) {
        expect(outgoing.puppet, `${from} → ${to}`).not.toBe(incoming.puppet);
        dissolves += 1;
        continue;
      }
      meets(outgoing, incoming, `${from} → ${to}`);
      checked += 1;
    }
    expect(checked + dissolves).toBe(MEMBER_MOTION_TRANSITIONS.length);
    expect(checked).toBe(14);
    expect(dissolves).toBe(2);
    expect(dissolves).toBe(MEMBER_MOTION_DISSOLVE_EDGES.length);
  });

  it('retimes the standing transitions like the walk: uniform root advance, the planted ball at one world x', () => {
    for (const clip of ['walk-to-wait', 'wait-to-walk'] as const) {
      const frames = CLIPS[clip].frames;
      const cycle = CLIPS[clip].cycleAdvancePx;
      expect(cycle, clip).toBeGreaterThan(20);
      expect(cycle, clip).toBeLessThan(60);
      const step = cycle / (frames.length - 1);
      frames.forEach((frame, i) => {
        expect(frame.rootAdvance, `${clip}#${i}`).toBeCloseTo(i * step, 6);
        expect(frame.root.x, `${clip}#${i}`).toBe(MEMBER_MOTION_CANVAS_PX / 2);
      });
      const xs = frames.map((frame) => plantedWorldX(frame));
      for (const x of xs) expect(x).not.toBeNull();
      const world = xs as number[];
      const drift = Math.max(...world) - Math.min(...world);
      expect(drift, clip).toBeLessThanOrEqual(EMPIRE_TUNING.FLOOR_MEMBER_MOTION_FOOT_DRIFT_TOLERANCE_PX);
      // The last frame IS the end pose (t = 1), not a step short of it. The
      // bisection lands a hair below 1 where the retreat curve goes flat.
      const end = frames[frames.length - 1];
      if (end === undefined) throw new Error('no frames');
      expect(end.time).toBeCloseTo(1, 6);
      expect(end.rootAdvance).toBeCloseTo(cycle, 9);
    }
  });

  it('reports cycleAdvancePx per clip: the stride for the walk, the total for the transitions, zero for stands and the bench', () => {
    expect(CLIPS.walk.cycleAdvancePx).toBeCloseTo(authoredStridePx(), 9);
    for (const clip of ['idle', 'wait', 'bench-setup', 'bench-mount', 'bench-press', 'bench-dismount', 'bench-finish'] as const) {
      expect(CLIPS[clip].cycleAdvancePx, clip).toBe(0);
    }
    expect(CLIPS['walk-to-wait'].cycleAdvancePx).toBeCloseTo(last('walk-to-wait').rootAdvance, 9);
    expect(CLIPS['wait-to-walk'].cycleAdvancePx).toBeCloseTo(last('wait-to-walk').rootAdvance, 9);
    // Non-vacuity: the two totals are the measured 31.0 and 47.2 canvas px
    // (the body walks over its planted foot as it stops, and off it as it starts).
    expect(CLIPS['walk-to-wait'].cycleAdvancePx).toBeGreaterThan(30);
    expect(CLIPS['walk-to-wait'].cycleAdvancePx).toBeLessThan(32);
    expect(CLIPS['wait-to-walk'].cycleAdvancePx).toBeGreaterThan(46);
    expect(CLIPS['wait-to-walk'].cycleAdvancePx).toBeLessThan(48);
  });

  it('starts walk-to-wait from the walk’s contact pose and ends wait-to-walk on it', () => {
    meets(first('walk-to-wait'), first('walk'), 'walk-to-wait[0] vs walk[0]');
    meets(last('wait-to-walk'), first('walk'), 'wait-to-walk[last] vs walk[0]');
  });

  it('starts bench-dismount where bench-press starts, ends bench-mount there too, and ends bench-finish where idle starts', () => {
    meets(first('bench-dismount'), first('bench-press'), 'bench-dismount[0] vs bench-press[0]');
    meets(last('bench-mount'), first('bench-press'), 'bench-mount[last] vs bench-press[0]');
    meets(last('bench-finish'), first('idle'), 'bench-finish[last] vs idle[0]');
    meets(first('bench-setup'), first('idle'), 'bench-setup[0] vs idle[0]');
  });

  it('keeps both feet on the ground line through a stand, and the far foot behind the near one', () => {
    for (const clip of ['idle', 'wait'] as const) {
      for (const frame of CLIPS[clip].frames) {
        expect(lowestSoleY(frame, 'nearFoot'), `${clip}#${frame.index}`).toBeCloseTo(groundLineY(), 6);
        expect(lowestSoleY(frame, 'farFoot'), `${clip}#${frame.index}`).toBeCloseTo(groundLineY(), 3);
        expect(frame.rootAdvance).toBe(0);
      }
    }
    // The wait squares the feet wider than the idle.
    const idle = first('idle');
    const wait = first('wait');
    const spread = (frame: RigFrame): number => (frame.angles.nearThigh ?? 0) - (frame.angles.farThigh ?? 0);
    expect(spread(wait)).toBeGreaterThan(spread(idle));
    expect(spread(idle)).toBe(2 * EMPIRE_TUNING.FLOOR_MEMBER_MOTION_STANCE_DEGREES.idle);
    expect(spread(wait)).toBe(2 * EMPIRE_TUNING.FLOOR_MEMBER_MOTION_STANCE_DEGREES.wait);
  });

  it('breathes once per cycle: torso, chin and shoulders at the knobs’ full amplitude half way round, and rest at frame 0', () => {
    const rest = first('idle');
    const peak = CLIPS.idle.frames[6];
    const quarter = CLIPS.idle.frames[3];
    if (peak === undefined || quarter === undefined) throw new Error('no frame');
    const breath = EMPIRE_TUNING.FLOOR_MEMBER_MOTION_BREATH_DEGREES;
    const nod = EMPIRE_TUNING.FLOOR_MEMBER_MOTION_BREATH_NOD_DEGREES;
    const shoulder = EMPIRE_TUNING.FLOOR_MEMBER_MOTION_BREATH_SHOULDER_DEGREES;
    // Half way round: the full inhale, no sway (the sway crosses zero there).
    expect((peak.angles.torso ?? 0) - (rest.angles.torso ?? 0)).toBeCloseTo(breath, 6);
    expect((peak.angles.head ?? 0) - (rest.angles.head ?? 0)).toBeCloseTo(breath + nod, 6);
    expect((rest.angles.nearUpperArm ?? 0) - (peak.angles.nearUpperArm ?? 0)).toBeCloseTo(shoulder, 6);
    expect((rest.angles.farUpperArm ?? 0) - (peak.angles.farUpperArm ?? 0)).toBeCloseTo(shoulder, 6);
    // A quarter of the way: half the inhale plus the full sway of the idle.
    const sway = EMPIRE_TUNING.FLOOR_MEMBER_WAIT_SWAY_DEGREES * EMPIRE_TUNING.FLOOR_MEMBER_MOTION_IDLE_SWAY_FRACTION;
    expect((quarter.angles.torso ?? 0) - (rest.angles.torso ?? 0)).toBeCloseTo(breath / 2 + sway, 6);
    // Frames 0 and 6 are no longer the same pose (round 1's were byte-identical).
    expect(largestAngleGap(rest, peak).gap).toBeGreaterThan(1);
    // The wait's sway is the larger of the two.
    const waitQuarter = CLIPS.wait.frames[3];
    if (waitQuarter === undefined) throw new Error('no frame');
    const waitLean = (waitQuarter.angles.torso ?? 0) - (first('wait').angles.torso ?? 0) - breath / 2;
    expect(waitLean).toBeCloseTo(EMPIRE_TUNING.FLOOR_MEMBER_WAIT_SWAY_DEGREES, 6);
    expect(waitLean).toBeGreaterThan(sway);
  });
});

describe('memberRig: the bench', () => {
  it('draws the lockout as the painting’s own pose: every presser part at its rest angle, the bar unmoved', () => {
    const lockout = CLIPS['bench-press'].frames[0];
    if (lockout === undefined) throw new Error('no frame');
    expect(lockout.puppet).toBe('presser');
    for (const part of PUPPETS.presser.parts) {
      if (part.free === true) continue;
      expect(angleGap(lockout.angles[part.name] ?? Number.NaN, restDegrees(part)), part.name).toBeLessThan(0.001);
    }
    const bar = PUPPETS.presser.parts.find((p) => p.free === true);
    if (bar === undefined) throw new Error('no bar');
    expect(lockout.barCentre).toEqual({ x: (bar.pivot[0] + bar.tip[0]) / 2, y: (bar.pivot[1] + bar.tip[1]) / 2 });
  });

  it('lowers the bar to the chest and drives it back, hands on the grips throughout', () => {
    const frames = CLIPS['bench-press'].frames;
    const ys = frames.map((frame) => frame.barCentre?.y ?? Number.NaN);
    const lockoutY = ys[0] ?? Number.NaN;
    const bottomY = Math.max(...ys);
    expect(bottomY - lockoutY).toBeGreaterThan(25);
    expect(bottomY - lockoutY).toBeLessThan(45);
    // Descends then ascends: one local maximum.
    let turns = 0;
    for (let i = 1; i < ys.length - 1; i += 1) {
      const a = ys[i - 1] ?? 0;
      const b = ys[i] ?? 0;
      const c = ys[i + 1] ?? 0;
      if (b > a && b >= c) turns += 1;
    }
    expect(turns).toBe(1);
    // Every hand reaches its grip: the IK's fore tip lands on the bar's grip point.
    for (const frame of frames) {
      for (const chain of PUPPETS.presser.ik ?? []) {
        const fore = PUPPETS.presser.parts.find((p) => p.name === chain.fore);
        if (fore === undefined) throw new Error(chain.fore);
        const hand = framePoint(frame, chain.fore, fore.tip);
        const grip = framePoint(frame, chain.target.part, chain.target.point);
        expect(Math.hypot(hand.x - grip.x, hand.y - grip.y), `${chain.fore} #${frame.index}`).toBeLessThan(0.01);
      }
    }
  });

  it('keeps the presser’s body block still: the root and the pelvis never move', () => {
    for (const clip of ['bench-mount', 'bench-press', 'bench-dismount'] as const) {
      for (const frame of CLIPS[clip].frames) {
        expect(frame.puppet, `${clip}#${frame.index}`).toBe('presser');
        expect(frame.root).toEqual({ x: PUPPETS.presser.rootPivot[0], y: PUPPETS.presser.rootPivot[1] });
        expect(frame.rootAdvance).toBe(0);
      }
    }
    for (const clip of ['bench-setup', 'bench-finish'] as const) {
      for (const frame of CLIPS[clip].frames) expect(frame.puppet, `${clip}#${frame.index}`).toBe('walker');
    }
  });

  it('mounts from the racked bar to lockout and dismounts back: the two clips are each other reversed', () => {
    const mount = CLIPS['bench-mount'].frames;
    const dismount = CLIPS['bench-dismount'].frames;
    expect(mount.length).toBe(3);
    expect(dismount.length).toBe(3);
    mount.forEach((frame, i) => {
      const mirror = dismount[dismount.length - 1 - i];
      if (mirror === undefined) throw new Error('no frame');
      expect(frame.barCentre?.x).toBeCloseTo(mirror.barCentre?.x ?? Number.NaN, 9);
      expect(frame.barCentre?.y).toBeCloseTo(mirror.barCentre?.y ?? Number.NaN, 9);
    });
    // The racked bar sits back toward the head and lower than lockout; the mount lifts it up and forward.
    const racked = mount[0]?.barCentre;
    const lockout = mount[2]?.barCentre;
    if (racked === undefined || racked === null || lockout === undefined || lockout === null) throw new Error('no bar');
    expect(racked.x).toBeLessThan(lockout.x);
    expect(racked.y).toBeGreaterThan(lockout.y);
    expect(Math.hypot(racked.x - lockout.x, racked.y - lockout.y)).toBeGreaterThan(10);
  });

  it('holds the pelvis at one canvas point across each dissolve edge, walker to presser and back', () => {
    let checked = 0;
    for (const [from, to] of MEMBER_MOTION_DISSOLVE_EDGES) {
      const outgoing = last(from);
      const incoming = first(to);
      expect(new Set([outgoing.puppet, incoming.puppet]), `${from} → ${to}`).toEqual(new Set(['walker', 'presser']));
      const gap = Math.hypot(outgoing.root.x - incoming.root.x, outgoing.root.y - incoming.root.y);
      expect(gap, `${from} → ${to}: pelvis gap ${gap.toFixed(2)} px`).toBeLessThanOrEqual(EMPIRE_TUNING.FLOOR_MEMBER_MOTION_ROOT_TOLERANCE_PX);
      // Measured 0.11 px after the round-2 posing; the solve puts the lying
      // walker's hips within a pixel of the presser painting's own pelvis.
      expect(gap).toBeLessThan(1);
      checked += 1;
    }
    expect(checked).toBe(2);
  });

  it('poses the lying walker on the presser’s body line: torso rising toward a head on the left, hands up at the bar', () => {
    const lying = last('bench-setup');
    expect(first('bench-finish').angles).toEqual(lying.angles);
    // The presser's pelvis → neck line is about 248°; a flat side-view back would be 270°.
    expect(lying.angles.torso).toBeGreaterThan(240);
    expect(lying.angles.torso).toBeLessThan(256);
    const crown = framePoint(lying, 'head', [128, 9]);
    expect(crown.x).toBeLessThan(lying.root.x - 60);
    expect(crown.y).toBeLessThan(lying.root.y);
    const neck = framePoint(lying, 'torso', [124, 44]);
    const nearHand = framePoint(lying, 'nearForearm', [170, 126]);
    expect(nearHand.y).toBeLessThan(neck.y - 40);
    // Knees up, feet under the pelvis: the near ankle within 20 px of the hips in x.
    const ankle = framePoint(lying, 'nearShin', [148, 212]);
    expect(Math.abs(ankle.x - lying.root.x)).toBeLessThan(20);
  });

  it('measured the dissolve overlap at bake time above the registered floor, both edges, and wrote it beside the sheets', () => {
    const file = path.join(SHEET_DIR, 'member-motion-measurements.json');
    expect(existsSync(file), file).toBe(true);
    const onDisk = JSON.parse(readFileSync(file, 'utf8')) as {
      readonly dissolve: Record<string, { readonly iou: number; readonly iouWithoutBar: number; readonly rootGapPx: number; readonly union: number }>;
    };
    const keys = Object.keys(onDisk.dissolve).sort();
    expect(keys).toEqual(MEMBER_MOTION_DISSOLVE_EDGES.map(([a, b]) => `${a}>${b}`).sort());
    for (const key of keys) {
      const edge = onDisk.dissolve[key];
      if (edge === undefined) throw new Error(key);
      expect(edge.iou, key).toBeGreaterThanOrEqual(EMPIRE_TUNING.FLOOR_MEMBER_MOTION_DISSOLVE_IOU_MIN);
      expect(edge.iouWithoutBar, key).toBeGreaterThanOrEqual(edge.iou);
      expect(edge.union, key).toBeGreaterThan(10000);
      expect(edge.rootGapPx, key).toBeLessThanOrEqual(EMPIRE_TUNING.FLOOR_MEMBER_MOTION_ROOT_TOLERANCE_PX);
    }
    // Round 1 measured 0.189 on this pair; a regression to that shape is red.
    expect(Math.min(...keys.map((key) => onDisk.dissolve[key]?.iou ?? 0))).toBeGreaterThan(0.25);
  });

  it('spreads the hips’ travel to the bench over the seated, lean-back and lying frames in near-equal thirds, monotone', () => {
    const setup = CLIPS['bench-setup'].frames.map((frame) => frame.root.x);
    const finish = CLIPS['bench-finish'].frames.map((frame) => frame.root.x);
    expect(setup.length).toBe(5);
    // Frames 1 → 4: step-sink, seated, lean-back, lying.
    const at = (i: number): number => {
      const x = setup[i];
      if (x === undefined) throw new Error(`no frame ${i}`);
      return x;
    };
    const moves = [at(2) - at(1), at(3) - at(2), at(4) - at(3)];
    const total = at(4) - at(1);
    expect(total).toBeGreaterThan(50);
    for (const move of moves) {
      expect(move).toBeGreaterThan(0);
      expect(move).toBeLessThanOrEqual(total / 3 + EMPIRE_TUNING.FLOOR_MEMBER_MOTION_SCOOT_SLACK_PX);
    }
    // Round 1: 53.4 then 46.0 over two frames after a 22.5 px sit-back. Now
    // three moves near 21 px each; the largest is pinned so a regression to a
    // two-frame scoot is red rather than merely over the slack.
    expect(Math.max(...moves)).toBeLessThan(24);
    // The finish is the setup reversed, frame for frame.
    expect(finish).toEqual([...setup].reverse());
    // The lying hips are the presser's pelvis; the stand is on the centre line.
    expect(setup[4]).toBe(PUPPETS.presser.rootPivot[0]);
    expect(setup[0]).toBe(MEMBER_MOTION_CANVAS_PX / 2);
  });

  it('plants a foot in every bench frame — the far foot at the stand spot, then the near foot at the seat spot — each on the ground line', () => {
    const planted = (clip: MemberMotionClip): (string | null)[] => CLIPS[clip].frames.map((frame) => frame.plantedFoot);
    expect(planted('bench-setup')).toEqual(['farFoot', 'farFoot', 'nearFoot', 'nearFoot', 'nearFoot']);
    expect(planted('bench-finish')).toEqual(['nearFoot', 'nearFoot', 'nearFoot', 'farFoot', 'farFoot']);
    for (const clip of ['bench-setup', 'bench-finish'] as const) {
      const runs = new Map<string, number[]>();
      for (const frame of CLIPS[clip].frames) {
        if (frame.plantedFoot === null) throw new Error(`${clip}#${frame.index} plants nothing`);
        expect(lowestSoleY(frame, frame.plantedFoot), `${clip}#${frame.index}`).toBeCloseTo(groundLineY(), 6);
        const x = plantedWorldX(frame);
        if (x === null) throw new Error('no sole');
        runs.set(frame.plantedFoot, [...(runs.get(frame.plantedFoot) ?? []), x]);
      }
      for (const [foot, xs] of runs) {
        expect(Math.max(...xs) - Math.min(...xs), `${clip} ${foot}`).toBeLessThanOrEqual(EMPIRE_TUNING.FLOOR_MEMBER_MOTION_FOOT_DRIFT_TOLERANCE_PX);
      }
      // The seat spot is ahead of the stand spot: the near foot steps forward to the bench.
      const stand = runs.get('farFoot') ?? [];
      const seat = runs.get('nearFoot') ?? [];
      expect(Math.min(...seat)).toBeGreaterThan(Math.max(...stand) + 30);
    }
  });

  it('states the one slide the sit still has: the far foot closes up from the stand spot to the seat spot between frames 1 and 2', () => {
    const setup = CLIPS['bench-setup'].frames;
    const farBall = (frame: RigFrame): number => {
      const foot = PUPPETS.walker.parts.find((p) => p.name === 'farFoot');
      if (foot?.sole === undefined) throw new Error('no far foot');
      return framePoint(frame, 'farFoot', foot.sole.ball).x;
    };
    const stepSink = setup[1];
    const seated = setup[2];
    if (stepSink === undefined || seated === undefined) throw new Error('no frames');
    const slide = farBall(seated) - farBall(stepSink);
    // Measured 45 px; recorded as a residual, bounded so it cannot grow into a lunge.
    expect(slide).toBeGreaterThan(30);
    expect(slide).toBeLessThan(60);
  });
});

describe('memberRig: geometry', () => {
  it('derives the foot’s flat angle from the sole points, and the puppet agrees', () => {
    const foot = PUPPETS.walker.parts.find((p) => p.name === 'nearFoot');
    if (foot === undefined) throw new Error('no foot');
    expect(footFlatDegrees(foot)).toBeCloseTo(FOOT_FLAT, 9);
    // Rest 61.8° (ankle → toe) plus the sole's −7.8° slope.
    expect(FOOT_FLAT).toBeGreaterThan(53);
    expect(FOOT_FLAT).toBeLessThan(55);
  });

  it('two-bone IK: straight when out of reach, bent to the asked side, null at the shoulder', () => {
    const shoulder = { x: 0, y: 0 };
    const far = twoBoneDegrees(shoulder, { x: 0, y: 100 }, 30, 30, 1);
    expect(far).not.toBeNull();
    expect(far?.upper).toBeCloseTo(0, 6);
    expect(far?.fore).toBeCloseTo(0, 6);
    const bentRight = twoBoneDegrees(shoulder, { x: 0, y: 40 }, 30, 30, 1);
    const bentLeft = twoBoneDegrees(shoulder, { x: 0, y: 40 }, 30, 30, -1);
    expect(bentRight).not.toBeNull();
    expect(bentLeft).not.toBeNull();
    // Mirror images of each other about the straight-down line.
    expect(bentRight?.upper).toBeCloseTo(-(bentLeft?.upper ?? Number.NaN), 6);
    expect(Math.abs(bentRight?.upper ?? 0)).toBeGreaterThan(20);
    // The elbow lands on the asked side: +1 is the (−dy, dx) normal of the
    // shoulder → target direction, which for a straight-down reach is −x.
    const upperRad = ((bentRight?.upper ?? 0) * Math.PI) / 180;
    expect(Math.sin(upperRad)).toBeLessThan(0);
    expect(twoBoneDegrees(shoulder, shoulder, 30, 30, 1)).toBeNull();
  });
});

describe('memberRig: the baked artefacts on disk are this rig’s', () => {
  it('has one strip per production type per clip, frames × canvas wide and canvas tall', () => {
    let strips = 0;
    for (const type of MEMBER_MOTION_PRODUCTION_TYPES) {
      for (const clip of MEMBER_MOTION_CLIPS) {
        const file = path.join(ART_DIR, `${memberMotionStripStem(type, clip)}.png`);
        expect(existsSync(file), file).toBe(true);
        const bytes = readFileSync(file);
        expect(bytes.readUInt32BE(16), `${clip} width`).toBe(MEMBER_MOTION_CLIP_SPECS[clip].frames * MEMBER_MOTION_CANVAS_PX);
        expect(bytes.readUInt32BE(20), `${clip} height`).toBe(MEMBER_MOTION_CANVAS_PX);
        strips += 1;
      }
    }
    expect(strips).toBe(10);
  });

  it('wrote metadata that equals memberRigMetadata() today, so a stale bake is red rather than silent', () => {
    const file = path.join(SHEET_DIR, 'member-motion-metadata.json');
    expect(existsSync(file), file).toBe(true);
    const onDisk: unknown = JSON.parse(readFileSync(file, 'utf8'));
    expect(onDisk).toEqual(JSON.parse(JSON.stringify(memberRigMetadata())));
  });

  it('reports the stride in px and tiles', () => {
    const meta = memberRigMetadata();
    expect(meta.stridePx).toBeCloseTo(authoredStridePx(), 9);
    expect(meta.strideTiles).toBeCloseTo((meta.stridePx * EMPIRE_TUNING.FLOOR_MEMBER_DRAW_SCALE_TILES) / MEMBER_MOTION_CANVAS_PX, 9);
    expect(meta.strideTiles).toBeGreaterThan(1.09);
    expect(meta.strideTiles).toBeLessThan(1.11);
    expect(meta.clips.walk.frames.length).toBe(16);
    expect(meta.clips.walk.cycleAdvancePx).toBeCloseTo(meta.stridePx, 9);
    expect(meta.clips['bench-press'].frames.every((frame) => frame.barCentre !== null)).toBe(true);
    expect(meta.clips.walk.frames.every((frame) => frame.barCentre === null && frame.plantedSole !== null)).toBe(true);
    for (const clip of MEMBER_MOTION_CLIPS) {
      expect(meta.clips[clip].cycleAdvancePx, clip).toBe(CLIPS[clip].cycleAdvancePx);
      meta.clips[clip].frames.forEach((frame, i) => expect(frame.root, `${clip}#${i}`).toEqual(CLIPS[clip].frames[i]?.root));
    }
  });

  it('measured the idle breath legible at phone size: at least the registered fraction of a front-row body’s pixels move', () => {
    const file = path.join(SHEET_DIR, 'member-motion-measurements.json');
    const onDisk = JSON.parse(readFileSync(file, 'utf8')) as {
      readonly phoneIdle: {
        readonly bodyPx: number;
        readonly restFrame: number;
        readonly peakFrame: number;
        readonly bodyPixels: number;
        readonly changedPixels: number;
        readonly fraction: number;
        readonly waitFraction: number;
      };
    };
    expect(onDisk.phoneIdle.bodyPx).toBe(EMPIRE_TUNING.FLOOR_MEMBER_MOTION_PHONE_BODY_PX);
    expect(onDisk.phoneIdle.restFrame).toBe(0);
    expect(onDisk.phoneIdle.peakFrame).toBe(6);
    // Non-vacuity: a body of hundreds of pixels at 74 px tall, not an empty mask.
    expect(onDisk.phoneIdle.bodyPixels).toBeGreaterThan(500);
    expect(onDisk.phoneIdle.fraction).toBeGreaterThanOrEqual(EMPIRE_TUNING.FLOOR_MEMBER_MOTION_IDLE_BREATH_VISIBLE_FRACTION);
    expect(onDisk.phoneIdle.waitFraction).toBeGreaterThanOrEqual(EMPIRE_TUNING.FLOOR_MEMBER_MOTION_IDLE_BREATH_VISIBLE_FRACTION);
    // Round 1 measured 0 of 739: frames 0 and 6 were the same pose.
    expect(onDisk.phoneIdle.changedPixels).toBeGreaterThan(0);
  });
});
