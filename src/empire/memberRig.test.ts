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
 *   1ce6fc0b70ca0457…).
 *
 * What these do NOT cover, stated so nobody reads them as more: the
 * witnesses prove the checks bite on the walk's sixteen frames. The domain
 * is the clip table's frame counts, which is every frame the runtime can
 * draw, so a pose the runtime never draws is not a pose this file grades;
 * but a defect that only shows BETWEEN two baked frames — a runtime
 * crossfade between clips — is the runtime's to test, not the rig's.
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
  MEMBER_MOTION_PRODUCTION_TYPES,
  MEMBER_MOTION_TRANSITIONS,
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

  it('meets across every edge the runtime cuts along', () => {
    // The end of the outgoing clip against the start of the incoming one,
    // for every edge in the table whose two ends are drawn by the same
    // puppet. Bench-setup → bench-press and bench-press → bench-finish are
    // presser to presser; walk-to-wait → wait and wait-to-walk → walk are
    // walker to walker. The edges INTO a looping clip from a looping clip
    // (wait ↔ idle) compare first frame to first frame, because the runtime
    // may cut at any phase and the two stands share a shape.
    let checked = 0;
    for (const [from, to] of MEMBER_MOTION_TRANSITIONS) {
      const outgoing = MEMBER_MOTION_CLIP_SPECS[from].loop ? first(from) : last(from);
      const incoming = first(to);
      meets(outgoing, incoming, `${from} → ${to}`);
      checked += 1;
    }
    expect(checked).toBe(MEMBER_MOTION_TRANSITIONS.length);
    expect(checked).toBe(14);
  });

  it('starts walk-to-wait from the walk’s contact pose and ends wait-to-walk on it', () => {
    meets(first('walk-to-wait'), first('walk'), 'walk-to-wait[0] vs walk[0]');
    meets(last('wait-to-walk'), first('walk'), 'wait-to-walk[last] vs walk[0]');
  });

  it('starts bench-finish where bench-press starts and ends it where idle starts', () => {
    meets(first('bench-finish'), first('bench-press'), 'bench-finish[0] vs bench-press[0]');
    meets(last('bench-finish'), first('idle'), 'bench-finish[last] vs idle[0]');
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

  it('breathes: the torso pitches back by the breath knob a quarter of the way through an idle', () => {
    const rest = first('idle');
    const peak = CLIPS.idle.frames[3];
    if (peak === undefined) throw new Error('no frame');
    const torsoRise = (peak.angles.torso ?? 0) - (rest.angles.torso ?? 0);
    // Breath plus half the idle's sway (the lean peaks at the same key).
    const sway = EMPIRE_TUNING.FLOOR_MEMBER_WAIT_SWAY_DEGREES * EMPIRE_TUNING.FLOOR_MEMBER_MOTION_IDLE_SWAY_FRACTION;
    expect(torsoRise).toBeCloseTo(EMPIRE_TUNING.FLOOR_MEMBER_MOTION_BREATH_DEGREES + sway, 6);
  });

  it('reports the standing transitions’ root advance for the runtime to apply', () => {
    // The body walks over its planted foot as it stops, and off it as it
    // starts; a runtime that holds the anchor still through these 220 ms
    // clips lets the feet slide by exactly these amounts (canvas px).
    expect(last('walk-to-wait').rootAdvance).toBeGreaterThan(20);
    expect(last('walk-to-wait').rootAdvance).toBeLessThan(60);
    expect(last('wait-to-walk').rootAdvance).toBeGreaterThan(20);
    expect(last('wait-to-walk').rootAdvance).toBeLessThan(60);
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
    for (const clip of ['bench-setup', 'bench-press', 'bench-finish'] as const) {
      for (const frame of CLIPS[clip].frames) {
        if (frame.puppet !== 'presser') continue;
        expect(frame.root).toEqual({ x: PUPPETS.presser.rootPivot[0], y: PUPPETS.presser.rootPivot[1] });
        expect(frame.rootAdvance).toBe(0);
      }
    }
  });

  it('brings the walker’s lying pelvis to the presser’s, so the dissolve is at one place', () => {
    const setup = CLIPS['bench-setup'].frames;
    const lying = setup[4];
    const racked = setup[5];
    if (lying === undefined || racked === undefined) throw new Error('no frames');
    expect(lying.puppet).toBe('walker');
    expect(racked.puppet).toBe('presser');
    expect(Math.abs(lying.root.x - racked.root.x)).toBeLessThanOrEqual(EMPIRE_TUNING.FLOOR_MEMBER_MOTION_ROOT_TOLERANCE_PX);
    expect(Math.abs(lying.root.y - racked.root.y)).toBeLessThanOrEqual(EMPIRE_TUNING.FLOOR_MEMBER_MOTION_ROOT_TOLERANCE_PX);
    // Lying flat: torso pointing back along the bench.
    expect(lying.angles.torso).toBe(270);
  });

  it('plants the feet through the sit and the stand, and only there', () => {
    const planted = (clip: MemberMotionClip): (string | null)[] => CLIPS[clip].frames.map((frame) => frame.plantedFoot);
    expect(planted('bench-setup')).toEqual(['nearFoot', 'nearFoot', 'nearFoot', null, null, null, null, null]);
    expect(planted('bench-finish')).toEqual([null, null, null, null, null, 'nearFoot', 'nearFoot', 'nearFoot']);
    for (const clip of ['bench-setup', 'bench-finish'] as const) {
      for (const frame of CLIPS[clip].frames) {
        if (frame.plantedFoot === null) continue;
        expect(lowestSoleY(frame, frame.plantedFoot), `${clip}#${frame.index}`).toBeCloseTo(groundLineY(), 6);
        expect(plantedWorldX(frame), `${clip}#${frame.index}`).toBeCloseTo(plantedWorldX(CLIPS[clip].frames[clip === 'bench-setup' ? 0 : 7] as RigFrame) as number, 6);
      }
    }
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
    expect(strips).toBe(8);
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
    expect(meta.clips.walk.length).toBe(16);
    expect(meta.clips['bench-press'].every((frame) => frame.barCentre !== null)).toBe(true);
    expect(meta.clips.walk.every((frame) => frame.barCentre === null && frame.plantedSole !== null)).toBe(true);
  });
});
