/**
 * memberRig.ts — VL-3's skeleton over the cut-out puppet: forward
 * kinematics over `memberPuppet.ts`'s parts, two-bone IK for the presser's
 * arms onto the bar, keyframe interpolation, FOOT PLANTING for the walk,
 * and the per-frame metadata the bake and the proof tools read. Claude
 * Code Session B owns it (CLAUDE.md, "VL-3").
 *
 * Pure module (CLAUDE.md, "Pure logic is separate from UI"): zero React,
 * zero I/O, no pixels, no clock. It imports the clip table it must satisfy,
 * the authored drawings it poses, and the knobs it grades them with.
 *
 * WHAT A FRAME IS. For every clip in `MEMBER_MOTION_CLIPS` and every frame
 * `MEMBER_MOTION_CLIP_SPECS[clip].frames` asks for, `memberRigClip` returns
 * where each part's pivot lands on the `MEMBER_MOTION_CANVAS_PX` canvas and
 * by how much it is rotated about it — draw order back to front — plus
 * the planted sole, the root advance, the bar centre and a body box. The
 * bake rasterises exactly that; nothing about a pose is decided in the
 * tool.
 *
 * HOW THE FEET ARE PLANTED, because it is the one part of this file that is
 * a rule rather than arithmetic. The runtime advances a walking body by
 * `memberMotionStrideTiles()` per cycle and picks the frame from that
 * distance, so the feet stay put on the floor only if the stance foot's
 * CANVAS x retreats by exactly one sixteenth of the stride between
 * consecutive frames. The gait is authored as joint angles over a
 * continuous cycle; the rig does not sample it at sixteen equal times but
 * SOLVES the sample time of each frame (bisection,
 * `FLOOR_MEMBER_MOTION_RETIME_ITERATIONS` steps) so the stance foot's ball
 * sits where the uniform advance needs it. The stride is therefore not
 * authored either: it is twice the distance between the feet at contact,
 * and `memberRig.test.ts` pins it against the runtime's stride within
 * `FLOOR_MEMBER_MOTION_STRIDE_TOLERANCE_PX`. The root's height is solved
 * the same way — the planted foot's lowest sole point on the ground line
 * — so the walk's bounce emerges from the leg chain (contact low, passing
 * high) instead of being drawn over it.
 *
 * Its limit, stated because the solve cannot see it: the stance foot's
 * ball is what is planted, so a heel-strike frame whose toe is lifted
 * rolls onto the ball over the next frame and the HEEL moves forward by
 * the sole's length times (1 − cos of the lift) — under half a pixel at
 * the authored eight degrees. The test measures the ball, which is what
 * the runtime keeps still; the heel's roll is authored, not a defect, and
 * is reported by `memberRigMetadata` rather than hidden.
 *
 * ANGLES. Absolute degrees on screen for the authored right facing: 0 is
 * straight down, positive turns a bone's distal end toward +x, so 90 is
 * forward, 180 up, 270 back. A part is rotated by (authored − rest) where
 * rest is read from its pivot → tip in the source painting. The rotation
 * that carries a vector (dx, dy) by φ is (dx cos φ + dy sin φ,
 * −dx sin φ + dy cos φ), which takes straight down (0, 1) to (sin φ,
 * cos φ) — forward at φ = 90° — and is the one convention every function
 * here uses.
 */

import { EMPIRE_TUNING } from './empireTuning';
import {
  MEMBER_MOTION_CANVAS_PX,
  MEMBER_MOTION_CLIP_SPECS,
  MEMBER_MOTION_CLIPS,
  memberMotionStrideTiles,
  type MemberMotionClip,
} from './memberMotionClips';
import {
  BENCH_DISMOUNT_SEGMENT,
  BENCH_MOUNT_SEGMENT,
  BENCH_PRESS_SEGMENT,
  HALF_TURN_DEGREES,
  PUPPETS,
  WALK_SEGMENT,
  benchFinishSegment,
  benchSetupSegment,
  standingSegment,
  waitToWalkSegment,
  walkToWaitSegment,
  type Puppet,
  type PuppetBreath,
  type PuppetEase,
  type PuppetKey,
  type PuppetPart,
  type PuppetPointTuple,
  type PuppetSegment,
} from './memberPuppet';

export type PuppetName = keyof typeof PUPPETS;

export interface RigPoint {
  readonly x: number;
  readonly y: number;
}

export interface RigBox {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** Where one part is drawn in a frame: its pivot on the canvas and its rotation about it. */
export interface PartPlacement {
  readonly part: string;
  /** Canvas px of the part's pivot. */
  readonly pivot: RigPoint;
  /** Radians, applied about the pivot with the convention in the header. */
  readonly rotation: number;
}

export interface RigFrame {
  readonly clip: MemberMotionClip;
  readonly index: number;
  readonly puppet: PuppetName;
  /** The sample time within the authored segment, 0..1. */
  readonly time: number;
  /** The virtual root (pelvis) on the canvas, as drawn. */
  readonly root: RigPoint;
  /** Back to front. */
  readonly placements: readonly PartPlacement[];
  /** Absolute degrees per rotating part after IK; free parts absent. */
  readonly angles: Readonly<Record<string, number>>;
  /** The reference foot this frame, or null when nothing is planted. */
  readonly plantedFoot: string | null;
  /** The planted foot's ball on the canvas as drawn, or null. */
  readonly plantedSole: RigPoint | null;
  /** The planted foot's heel on the canvas as drawn, or null — reported so the heel roll is visible. */
  readonly plantedHeel: RigPoint | null;
  /** How far the runtime should have advanced the body since frame 0 for the planted foot to stay put, canvas px. */
  readonly rootAdvance: number;
  /** The bar's centre (midpoint of the grips) on the canvas, or null when no bar is drawn. */
  readonly barCentre: RigPoint | null;
  /** Union of every drawn part's transformed polygon, clamped to the canvas. */
  readonly bounds: RigBox;
}

export interface RigClip {
  readonly clip: MemberMotionClip;
  readonly frames: readonly RigFrame[];
  /**
   * The root's total advance over the clip, canvas px: the walk's stride,
   * a retimed standing transition's total (its last frame's `rootAdvance`),
   * and 0 for the stands and every bench clip. A runtime driving the clip by
   * distance advances one full phase per this much drawn feet travel.
   */
  readonly cycleAdvancePx: number;
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

const DEG = Math.PI / HALF_TURN_DEGREES;

function rotate(dx: number, dy: number, radians: number): RigPoint {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return { x: dx * c + dy * s, y: -dx * s + dy * c };
}

/** Absolute degrees of the direction from → to, in the header's convention. */
export function directionDegrees(from: PuppetPointTuple, to: PuppetPointTuple): number {
  return Math.atan2(to[0] - from[0], to[1] - from[1]) / DEG;
}

/** A part's source rest angle, degrees: pivot → tip. */
export function restDegrees(part: PuppetPart): number {
  return directionDegrees(part.pivot, part.tip);
}

/** The absolute angle at which a foot's sole lies flat on the ground. */
export function footFlatDegrees(foot: PuppetPart): number {
  if (foot.sole === undefined) throw new Error(`${foot.name} has no sole`);
  const slope = Math.atan2(foot.sole.ball[1] - foot.sole.heel[1], foot.sole.ball[0] - foot.sole.heel[0]) / DEG;
  return restDegrees(foot) + slope;
}

function partByName(puppet: Puppet, name: string): PuppetPart {
  const hit = puppet.parts.find((part) => part.name === name);
  if (hit === undefined) throw new Error(`no part ${name} in ${puppet.source}`);
  return hit;
}

/** A source → canvas transform for one part: pivot on the canvas and rotation about it. */
interface Placed {
  readonly pivot: RigPoint;
  readonly rotation: number;
  readonly sourcePivot: PuppetPointTuple;
}

function apply(placed: Placed, point: PuppetPointTuple): RigPoint {
  const r = rotate(point[0] - placed.sourcePivot[0], point[1] - placed.sourcePivot[1], placed.rotation);
  return { x: placed.pivot.x + r.x, y: placed.pivot.y + r.y };
}

interface Pose {
  readonly angles: Readonly<Record<string, number>>;
  readonly offsets: Readonly<Record<string, PuppetPointTuple>>;
  readonly root: RigPoint;
}

/**
 * Forward kinematics: every part's placement for a pose, parents resolved
 * before children whatever the draw order. Free parts translate by their
 * offset and keep their rest rotation.
 */
function forward(puppet: Puppet, pose: Pose): Map<string, Placed> {
  const placed = new Map<string, Placed>();
  const rootPlaced: Placed = { pivot: pose.root, rotation: 0, sourcePivot: puppet.rootPivot };
  const resolve = (part: PuppetPart): Placed => {
    const done = placed.get(part.name);
    if (done !== undefined) return done;
    const parent = part.parent === null ? rootPlaced : resolve(partByName(puppet, part.parent));
    const at = apply(parent, part.attach);
    let out: Placed;
    if (part.free === true) {
      const offset = pose.offsets[part.name] ?? [0, 0];
      out = { pivot: { x: at.x + offset[0], y: at.y + offset[1] }, rotation: 0, sourcePivot: part.pivot };
    } else {
      const target = pose.angles[part.name] ?? restDegrees(part);
      out = { pivot: at, rotation: (target - restDegrees(part)) * DEG, sourcePivot: part.pivot };
    }
    placed.set(part.name, out);
    return out;
  };
  for (const part of puppet.parts) resolve(part);
  return placed;
}

function length(a: PuppetPointTuple, b: PuppetPointTuple): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/**
 * Two-bone IK in the header's angle convention: absolute angles for the
 * upper and fore bones from a shoulder on the canvas to a target on the
 * canvas, the elbow on the `bend` side of the shoulder → target line. A
 * target beyond reach straightens the arm toward it; a target at the
 * shoulder is left at rest.
 */
export function twoBoneDegrees(
  shoulder: RigPoint,
  target: RigPoint,
  upperLength: number,
  foreLength: number,
  bend: 1 | -1,
): { readonly upper: number; readonly fore: number } | null {
  const dx = target.x - shoulder.x;
  const dy = target.y - shoulder.y;
  const d = Math.hypot(dx, dy);
  if (d === 0) return null;
  const reach = Math.min(d, upperLength + foreLength);
  const cosA = (upperLength * upperLength + reach * reach - foreLength * foreLength) / (2 * upperLength * reach);
  const alpha = Math.acos(Math.max(-1, Math.min(1, cosA)));
  const ux = dx / d;
  const uy = dy / d;
  // Rotate the unit direction by ±alpha toward the bend side.
  const ex = ux * Math.cos(alpha) - bend * uy * Math.sin(alpha);
  const ey = uy * Math.cos(alpha) + bend * ux * Math.sin(alpha);
  const elbow = { x: shoulder.x + ex * upperLength, y: shoulder.y + ey * upperLength };
  const upper = Math.atan2(elbow.x - shoulder.x, elbow.y - shoulder.y) / DEG;
  const fore = Math.atan2(target.x - elbow.x, target.y - elbow.y) / DEG;
  return { upper, fore };
}

/** The pose with every IK chain solved onto its grip, given the free parts' placements. */
function solveIk(puppet: Puppet, pose: Pose): Pose {
  if (puppet.ik === undefined || puppet.ik.length === 0) return pose;
  const angles: Record<string, number> = { ...pose.angles };
  const placed = forward(puppet, pose);
  for (const chain of puppet.ik) {
    const upper = partByName(puppet, chain.upper);
    const fore = partByName(puppet, chain.fore);
    const holder = placed.get(chain.target.part);
    const upperPlaced = placed.get(chain.upper);
    if (holder === undefined || upperPlaced === undefined) continue;
    const target = apply(holder, chain.target.point);
    const solved = twoBoneDegrees(upperPlaced.pivot, target, length(upper.pivot, upper.tip), length(fore.pivot, fore.tip), chain.bend);
    if (solved === null) continue;
    angles[chain.upper] = solved.upper;
    angles[chain.fore] = solved.fore;
  }
  return { ...pose, angles };
}

// ---------------------------------------------------------------------------
// Keys and interpolation
// ---------------------------------------------------------------------------

function eased(u: number, ease: PuppetEase): number {
  const c = Math.max(0, Math.min(1, u));
  if (ease === 'linear') return c;
  if (ease === 'in') return c * c;
  if (ease === 'out') return 1 - (1 - c) * (1 - c);
  return c < 1 / 2 ? 2 * c * c : 1 - 2 * (1 - c) * (1 - c);
}

function swapMirror(puppet: Puppet, angles: Readonly<Record<string, number>>): Readonly<Record<string, number>> {
  const out: Record<string, number> = { ...angles };
  for (const [a, b] of puppet.mirror) {
    const va = angles[a];
    const vb = angles[b];
    if (va !== undefined) out[b] = va;
    else delete out[b];
    if (vb !== undefined) out[a] = vb;
    else delete out[a];
  }
  return out;
}

/** The segment's keys with the mirrored second half appended when asked, sorted by t. */
export function segmentKeys(segment: PuppetSegment): readonly PuppetKey[] {
  const puppet = PUPPETS[segment.puppet];
  const keys = [...segment.keys];
  if (segment.mirrorSecondHalf) {
    for (const key of segment.keys) keys.push({ ...key, t: key.t + 1 / 2, angles: swapMirror(puppet, key.angles) });
  }
  return keys.sort((a, b) => a.t - b.t);
}

function lerp(a: number, b: number, u: number): number {
  return a + (b - a) * u;
}

/** The interpolated pose of a segment at time t (0..1; a cyclic segment wraps its last key to its first). */
export function poseAt(segment: PuppetSegment, t: number): Pose {
  const keys = segmentKeys(segment);
  if (keys.length === 0) throw new Error('a segment needs keys');
  const first = keys[0] as PuppetKey;
  const last = keys[keys.length - 1] as PuppetKey;
  let from: PuppetKey = first;
  let to: PuppetKey = first;
  let span = 1;
  let local = 0;
  if (segment.cyclic) {
    const tt = ((t % 1) + 1) % 1;
    let i = keys.length - 1;
    while (i > 0 && (keys[i] as PuppetKey).t > tt) i -= 1;
    from = keys[i] as PuppetKey;
    const next = keys[i + 1];
    to = next ?? { ...first, t: 1 };
    span = to.t - from.t;
    local = tt - from.t;
  } else {
    const tt = Math.max(first.t, Math.min(last.t, t));
    let i = keys.length - 1;
    while (i > 0 && (keys[i] as PuppetKey).t > tt) i -= 1;
    from = keys[i] as PuppetKey;
    to = keys[Math.min(i + 1, keys.length - 1)] as PuppetKey;
    span = to.t - from.t;
    local = tt - from.t;
  }
  const u = span > 0 ? eased(local / span, to.ease) : 0;
  const angles: Record<string, number> = {};
  const names = new Set([...Object.keys(from.angles), ...Object.keys(to.angles)]);
  const puppet = PUPPETS[segment.puppet];
  for (const name of names) {
    const a = from.angles[name] ?? restDegrees(partByName(puppet, name));
    const b = to.angles[name] ?? restDegrees(partByName(puppet, name));
    angles[name] = lerp(a, b, u);
  }
  const offsets: Record<string, PuppetPointTuple> = {};
  const offsetNames = new Set([...Object.keys(from.offsets ?? {}), ...Object.keys(to.offsets ?? {})]);
  for (const name of offsetNames) {
    const a = from.offsets?.[name] ?? [0, 0];
    const b = to.offsets?.[name] ?? [0, 0];
    offsets[name] = [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];
  }
  return {
    angles,
    offsets,
    root: { x: lerp(from.root[0], to.root[0], u), y: lerp(from.root[1], to.root[1], u) },
  };
}

// ---------------------------------------------------------------------------
// Planting
// ---------------------------------------------------------------------------

/** The ground line: the canvas row the planted sole sits on. */
export function groundLineY(): number {
  return MEMBER_MOTION_CANVAS_PX - EMPIRE_TUNING.FLOOR_MEMBER_MOTION_GROUND_INSET_PX;
}

interface SoleRelative {
  /** The ball's x relative to the root. */
  readonly ballX: number;
  /** The lowest sole point's y relative to the root (largest y, canvas down). */
  readonly lowestY: number;
  readonly heel: RigPoint;
  readonly ball: RigPoint;
}

/** A foot's sole points relative to the root for a pose (root at the origin). */
function soleRelative(puppet: Puppet, pose: Pose, foot: string): SoleRelative {
  const part = partByName(puppet, foot);
  if (part.sole === undefined) throw new Error(`${foot} has no sole to plant`);
  const placed = forward(puppet, { ...pose, root: { x: 0, y: 0 } });
  const footPlaced = placed.get(foot);
  if (footPlaced === undefined) throw new Error(`${foot} was not placed`);
  const heel = apply(footPlaced, part.sole.heel);
  const ball = apply(footPlaced, part.sole.ball);
  return { ballX: ball.x, lowestY: Math.max(heel.y, ball.y), heel, ball };
}

/** The runtime's stride in canvas px: tiles per cycle over the body's tile size, times the canvas. */
export function memberRigStridePx(): number {
  return (memberMotionStrideTiles() * MEMBER_MOTION_CANVAS_PX) / EMPIRE_TUNING.FLOOR_MEMBER_DRAW_SCALE_TILES;
}

/**
 * The walk's stride as the authored gait produces it: twice the distance
 * between the balls of the two feet at the contact pose, canvas px. The
 * test pins this against `memberRigStridePx()`.
 */
export function authoredStridePx(): number {
  const puppet = PUPPETS[WALK_SEGMENT.puppet];
  const contact = poseAt(WALK_SEGMENT, 0);
  const near = soleRelative(puppet, contact, 'nearFoot');
  const far = soleRelative(puppet, contact, 'farFoot');
  return 2 * (near.ballX - far.ballX);
}

/**
 * Sample times for a retimed run: frame k of the run lands where the
 * reference foot's ball has retreated k × advance from its position at the
 * run's first time, found by bisection on [t0, t1]. A foot whose ball does
 * not retreat monotonically over the run makes the solve land on SOME
 * crossing, and the drift test catches the result rather than this.
 */
function retimedSamples(
  segment: PuppetSegment,
  foot: string,
  t0: number,
  t1: number,
  count: number,
  advance: number,
): number[] {
  const puppet = PUPPETS[segment.puppet];
  const ballAt = (t: number): number => soleRelative(puppet, poseAt(segment, t), foot).ballX;
  const start = ballAt(t0);
  const times: number[] = [t0];
  for (let k = 1; k < count; k += 1) {
    const want = start - k * advance;
    let lo = t0;
    let hi = t1;
    for (let i = 0; i < EMPIRE_TUNING.FLOOR_MEMBER_MOTION_RETIME_ITERATIONS; i += 1) {
      const mid = (lo + hi) / 2;
      if (ballAt(mid) > want) lo = mid;
      else hi = mid;
    }
    times.push((lo + hi) / 2);
  }
  return times;
}

// ---------------------------------------------------------------------------
// Clips
// ---------------------------------------------------------------------------

function segmentsFor(clip: MemberMotionClip): readonly PuppetSegment[] {
  const frames = MEMBER_MOTION_CLIP_SPECS[clip].frames;
  const stance = EMPIRE_TUNING.FLOOR_MEMBER_MOTION_STANCE_DEGREES;
  const breath: PuppetBreath = {
    torso: EMPIRE_TUNING.FLOOR_MEMBER_MOTION_BREATH_DEGREES,
    nod: EMPIRE_TUNING.FLOOR_MEMBER_MOTION_BREATH_NOD_DEGREES,
    shoulder: EMPIRE_TUNING.FLOOR_MEMBER_MOTION_BREATH_SHOULDER_DEGREES,
  };
  const waitSway = EMPIRE_TUNING.FLOOR_MEMBER_WAIT_SWAY_DEGREES;
  switch (clip) {
    case 'walk':
      return [WALK_SEGMENT];
    case 'idle':
      return [standingSegment(stance.idle, waitSway * EMPIRE_TUNING.FLOOR_MEMBER_MOTION_IDLE_SWAY_FRACTION, breath, frames)];
    case 'wait':
      return [standingSegment(stance.wait, waitSway, breath, frames)];
    case 'walk-to-wait':
      return [walkToWaitSegment(stance.idle, frames)];
    case 'wait-to-walk':
      return [waitToWalkSegment(stance.idle, frames)];
    case 'bench-setup':
      return [benchSetupSegment(stance.idle)];
    case 'bench-mount':
      return [BENCH_MOUNT_SEGMENT];
    case 'bench-press':
      return [BENCH_PRESS_SEGMENT];
    case 'bench-dismount':
      return [BENCH_DISMOUNT_SEGMENT];
    case 'bench-finish':
      return [benchFinishSegment(stance.idle)];
    default: {
      const never: never = clip;
      throw new Error(`unknown clip ${String(never)}`);
    }
  }
}

function boundsOf(puppet: Puppet, placed: Map<string, Placed>): RigBox {
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const part of puppet.parts) {
    const at = placed.get(part.name);
    if (at === undefined) continue;
    for (const polygon of part.polygons) {
      for (const vertex of polygon) {
        const p = apply(at, vertex);
        left = Math.min(left, p.x);
        top = Math.min(top, p.y);
        right = Math.max(right, p.x);
        bottom = Math.max(bottom, p.y);
      }
    }
  }
  const clamp = (v: number): number => Math.max(0, Math.min(MEMBER_MOTION_CANVAS_PX, v));
  return { left: clamp(left), top: clamp(top), right: clamp(right), bottom: clamp(bottom) };
}

interface SegmentFrame {
  readonly time: number;
  readonly pose: Pose;
  readonly plantedFoot: string | null;
  readonly rootAdvance: number;
}

/** Every frame of one segment: sample times, solved roots, planted feet, advances. */
function segmentFrames(segment: PuppetSegment): SegmentFrame[] {
  const puppet = PUPPETS[segment.puppet];
  const count = segment.frames[1] - segment.frames[0];
  const times: number[] = [];
  const planted: (string | null)[] = new Array<string | null>(count).fill(null);
  const advances: number[] = new Array<number>(count).fill(0);
  const rootX: number[] = new Array<number>(count).fill(0);
  const canvasCentre = MEMBER_MOTION_CANVAS_PX / 2;

  if (segment.plant !== null && segment.plant.retime) {
    // Uniform advance, sample times solved per run. The walk (cyclic): one
    // sixteenth of the stride per frame, frame k at k × that. A standing
    // transition (not cyclic): the run spans the whole segment and its
    // first and last frames ARE the end poses, so the advance is the
    // planted foot's total retreat over (frames − 1), and frame k sits at
    // k × that — the last frame at the full total.
    for (const run of segment.plant.runs) {
      const runCount = run.toFrame - run.fromFrame;
      const t0 = segment.cyclic ? run.fromFrame / count : run.fromFrame / (count - 1);
      const t1 = segment.cyclic ? run.toFrame / count : (run.toFrame - 1) / (count - 1);
      const ballAt = (t: number): number => soleRelative(puppet, poseAt(segment, t), run.foot).ballX;
      const advance = segment.cyclic ? authoredStridePx() / count : (ballAt(t0) - ballAt(t1)) / Math.max(1, runCount - 1);
      const solved = retimedSamples(segment, run.foot, t0, t1, runCount, advance);
      for (let i = 0; i < runCount; i += 1) {
        const frame = run.fromFrame + i;
        times[frame] = solved[i] ?? t0;
        planted[frame] = run.foot;
        advances[frame] = frame * advance;
        rootX[frame] = canvasCentre;
      }
    }
    for (let k = 0; k < count; k += 1) {
      if (times[k] === undefined) times[k] = segment.cyclic ? k / count : k / (count - 1);
    }
  } else {
    for (let k = 0; k < count; k += 1) times[k] = segment.cyclic ? k / count : count === 1 ? 0 : k / (count - 1);
    for (let k = 0; k < count; k += 1) rootX[k] = poseAt(segment, times[k] as number).root.x;
    if (segment.plant !== null) {
      for (const run of segment.plant.runs) {
        const rel = (k: number): number => soleRelative(puppet, poseAt(segment, times[k] as number), run.foot).ballX;
        const anchorRel = rel(run.anchorFrame);
        const anchorX = poseAt(segment, times[run.anchorFrame] as number).root.x;
        for (let k = run.fromFrame; k < run.toFrame; k += 1) {
          planted[k] = run.foot;
          const x = anchorX + (anchorRel - rel(k));
          rootX[k] = x;
          advances[k] = x - anchorX;
        }
      }
    }
  }

  const out: SegmentFrame[] = [];
  for (let k = 0; k < count; k += 1) {
    const t = times[k] ?? 0;
    const authored = poseAt(segment, t);
    const foot = planted[k] ?? null;
    const solvedX = rootX[k] ?? authored.root.x;
    let root: RigPoint;
    if (foot !== null) {
      const sole = soleRelative(puppet, authored, foot);
      const y = groundLineY() - sole.lowestY;
      root = { x: segment.frame === 'body' ? canvasCentre : solvedX, y };
    } else {
      root = { x: segment.frame === 'body' ? canvasCentre : authored.root.x, y: authored.root.y };
    }
    out.push({
      time: t,
      pose: solveIk(puppet, { ...authored, root }),
      plantedFoot: foot,
      rootAdvance: segment.frame === 'body' ? (advances[k] ?? 0) : 0,
    });
  }
  return out;
}

/** Every frame of a clip, exactly `MEMBER_MOTION_CLIP_SPECS[clip].frames` of them. */
export function memberRigClip(clip: MemberMotionClip): RigClip {
  const spec = MEMBER_MOTION_CLIP_SPECS[clip];
  const frames: RigFrame[] = [];
  let advanceBase = 0;
  for (const segment of segmentsFor(clip)) {
    const puppet = PUPPETS[segment.puppet];
    const solved = segmentFrames(segment);
    solved.forEach((frame, i) => {
      const placed = forward(puppet, frame.pose);
      const placements: PartPlacement[] = puppet.parts.map((part) => {
        const at = placed.get(part.name);
        if (at === undefined) throw new Error(`${part.name} unplaced`);
        return { part: part.name, pivot: at.pivot, rotation: at.rotation };
      });
      let plantedSole: RigPoint | null = null;
      let plantedHeel: RigPoint | null = null;
      if (frame.plantedFoot !== null) {
        const foot = partByName(puppet, frame.plantedFoot);
        const at = placed.get(frame.plantedFoot);
        if (foot.sole !== undefined && at !== undefined) {
          plantedSole = apply(at, foot.sole.ball);
          plantedHeel = apply(at, foot.sole.heel);
        }
      }
      let barCentre: RigPoint | null = null;
      const bar = puppet.parts.find((part) => part.free === true);
      if (bar !== undefined) {
        const at = placed.get(bar.name);
        if (at !== undefined) {
          const a = apply(at, bar.pivot);
          const b = apply(at, bar.tip);
          barCentre = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        }
      }
      const angles: Record<string, number> = {};
      for (const part of puppet.parts) {
        if (part.free === true) continue;
        angles[part.name] = frame.pose.angles[part.name] ?? restDegrees(part);
      }
      frames.push({
        clip,
        index: segment.frames[0] + i,
        puppet: segment.puppet,
        time: frame.time,
        root: frame.pose.root,
        placements,
        angles,
        plantedFoot: frame.plantedFoot,
        plantedSole,
        plantedHeel,
        rootAdvance: advanceBase + frame.rootAdvance,
        barCentre,
        bounds: boundsOf(puppet, placed),
      });
    });
    const lastAdvance = solved[solved.length - 1]?.rootAdvance ?? 0;
    advanceBase += lastAdvance;
  }
  if (frames.length !== spec.frames) {
    throw new Error(`${clip}: segments author ${frames.length} frames, the clip table asks for ${spec.frames}`);
  }
  return { clip, frames, cycleAdvancePx: cycleAdvanceOf(clip, frames) };
}

/**
 * The root's advance over a whole clip: the walk's stride (its last frame
 * sits one sixteenth short of the cycle, so the stride is not the last
 * frame's advance), a retimed non-cyclic clip's last-frame advance, and 0
 * for anything drawn in the world frame or with no root travel.
 */
function cycleAdvanceOf(clip: MemberMotionClip, frames: readonly RigFrame[]): number {
  const segments = segmentsFor(clip);
  const retimedCyclic = segments.some((segment) => segment.plant !== null && segment.plant.retime && segment.cyclic);
  if (retimedCyclic) return authoredStridePx();
  const last = frames[frames.length - 1];
  return last === undefined ? 0 : last.rootAdvance;
}

/** Every clip in the table. */
export function memberRigClips(): Readonly<Record<MemberMotionClip, RigClip>> {
  const out: Partial<Record<MemberMotionClip, RigClip>> = {};
  for (const clip of MEMBER_MOTION_CLIPS) out[clip] = memberRigClip(clip);
  return out as Readonly<Record<MemberMotionClip, RigClip>>;
}

// ---------------------------------------------------------------------------
// Metadata for the bake and the proof tools
// ---------------------------------------------------------------------------

export interface RigFrameMetadata {
  readonly plantedFoot: string | null;
  readonly plantedSole: RigPoint | null;
  readonly plantedHeel: RigPoint | null;
  readonly rootAdvance: number;
  readonly barCentre: RigPoint | null;
  readonly bounds: RigBox;
  readonly puppet: PuppetName;
  /** The pelvis on the canvas as drawn — what the dissolve edges hold at one point. */
  readonly root: RigPoint;
}

export interface RigClipMetadata {
  /** See `RigClip.cycleAdvancePx`. */
  readonly cycleAdvancePx: number;
  readonly frames: readonly RigFrameMetadata[];
}

export interface MemberRigMetadata {
  readonly canvasPx: number;
  readonly groundLineY: number;
  /** The walk's root travel per cycle as authored, canvas px. */
  readonly stridePx: number;
  /** The same in tiles at the body's draw scale. */
  readonly strideTiles: number;
  readonly clips: Readonly<Record<MemberMotionClip, RigClipMetadata>>;
}

export function memberRigMetadata(): MemberRigMetadata {
  const clips: Partial<Record<MemberMotionClip, RigClipMetadata>> = {};
  const all = memberRigClips();
  for (const clip of MEMBER_MOTION_CLIPS) {
    clips[clip] = {
      cycleAdvancePx: all[clip].cycleAdvancePx,
      frames: all[clip].frames.map((frame) => ({
        plantedFoot: frame.plantedFoot,
        plantedSole: frame.plantedSole,
        plantedHeel: frame.plantedHeel,
        rootAdvance: frame.rootAdvance,
        barCentre: frame.barCentre,
        bounds: frame.bounds,
        puppet: frame.puppet,
        root: frame.root,
      })),
    };
  }
  const stridePx = authoredStridePx();
  return {
    canvasPx: MEMBER_MOTION_CANVAS_PX,
    groundLineY: groundLineY(),
    stridePx,
    strideTiles: (stridePx * EMPIRE_TUNING.FLOOR_MEMBER_DRAW_SCALE_TILES) / MEMBER_MOTION_CANVAS_PX,
    clips: clips as Readonly<Record<MemberMotionClip, RigClipMetadata>>,
  };
}

/** A source point of a part, on the canvas, for a frame's placement of that part — the test's independent read of the FK. */
export function framePoint(frame: RigFrame, part: string, point: PuppetPointTuple): RigPoint {
  const placement = frame.placements.find((p) => p.part === part);
  const def = partByName(PUPPETS[frame.puppet], part);
  if (placement === undefined) throw new Error(`${part} is not placed in ${frame.clip}#${frame.index}`);
  return apply({ pivot: placement.pivot, rotation: placement.rotation, sourcePivot: def.pivot }, point);
}

/** The world x of a planted sole under the runtime's advance: its drawn x plus the root advance. */
export function plantedWorldX(frame: RigFrame): number | null {
  return frame.plantedSole === null ? null : frame.plantedSole.x + frame.rootAdvance;
}
