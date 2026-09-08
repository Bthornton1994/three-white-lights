/**
 * memberMotionClips.ts — VL-3's shared vocabulary: which production motion
 * clips exist, how many authored frames each carries, what drives each, and
 * how a baked frame strip is named. Claude Code Session B owns it (CLAUDE.md,
 * "VL-3").
 *
 * Pure module (CLAUDE.md, "Pure logic is separate from UI"): zero React, zero
 * I/O, no clock, no pixels. It imports only the tuning knobs it re-expresses.
 *
 * WHY THIS FILE IS SEPARATE FROM `memberRig.ts` AND `memberMotion.ts`. VL-3
 * builds three things in parallel: the rig that AUTHORS the frames (part
 * atlas, keyframes, foot planting — `memberRig.ts`), the bake that writes
 * them to disk (`tools/bake-member-motion.mjs`), and the runtime that PLAYS
 * them (`memberMotion.ts`, `FloorGrid.tsx`). They meet on this table and on
 * nothing else: the rig must produce exactly `frames` poses per clip, the
 * bake must write exactly one strip per clip named by `memberMotionStripStem`,
 * and the runtime must advance a clip by its `drive` and `periodMs` and walk
 * only the edges in `MEMBER_MOTION_TRANSITIONS`. A clip added here is a
 * compile error everywhere until all three sides carry it (`satisfies`
 * over the closed list), which is the point.
 *
 * THE FRAME CANVAS IS THE PAINTINGS' CANVAS. Every baked frame is
 * `MEMBER_MOTION_CANVAS_PX` square with the feet point at the bottom
 * centre, exactly as the two-keypose paintings under `public/empire-art/`
 * are cropped, so `FloorGrid.tsx`'s body box (`FLOOR_MEMBER_DRAW_SCALE_TILES`
 * tiles a side, feet at its bottom centre) draws a baked frame with the same
 * geometry it draws a painting. A strip is `frames` canvases side by side,
 * one file per clip per member type, authored facing right; the left facing
 * is a horizontal mirror applied by the renderer, never a second file.
 *
 * WHAT "DISTANCE" AND "TIME" MEAN. A distance-driven clip advances one full
 * cycle per `memberMotionStrideTiles()` of feet travel on screen — the same
 * rule VL-2's `memberAnimation.ts` states for its two-frame walk, kept
 * because it is what plants the feet whatever the frame rate. A time-driven
 * clip advances one full cycle per `periodMs` of the renderer's own frame
 * clock. A clip that does not loop holds its last frame when its cycle ends
 * and the runtime takes the next edge.
 */

import { EMPIRE_TUNING } from './empireTuning';

/** Everything a production member can be drawn doing. The runtime never draws outside this list. */
export const MEMBER_MOTION_CLIPS = Object.freeze([
  /** The gait cycle: two steps, sixteen poses, contact → down → passing → up on each leg. */
  'walk',
  /** Standing with nowhere to be: breathing and a slow weight shift. */
  'idle',
  /** Standing in a line: breathing, a weight shift, the stance squared toward the station. */
  'wait',
  /** The last step settling into a stand. */
  'walk-to-wait',
  /** The first step out of a stand. */
  'wait-to-walk',
  /** Sit on the bench edge, lie back, reach the racked bar, unrack. */
  'bench-setup',
  /** One press: lockout, controlled descent, bottom, drive. */
  'bench-press',
  /** Rerack, sit up, stand. */
  'bench-finish',
] as const);
export type MemberMotionClip = (typeof MEMBER_MOTION_CLIPS)[number];

/** What advances a clip's phase: tiles the feet moved on screen, or milliseconds of the frame clock. */
export type MemberMotionDrive = 'distance' | 'time';

export interface MemberMotionClipSpec {
  /** Authored poses in the strip. The rig produces exactly this many; the bake writes exactly this many. */
  readonly frames: number;
  readonly drive: MemberMotionDrive;
  /** One full cycle, for a time-driven clip. Null for a distance-driven one. */
  readonly periodMs: number | null;
  /** Whether the clip cycles or holds its last frame. */
  readonly loop: boolean;
}

/**
 * The clip table. Frame counts are the authored pose counts VL-3's brief
 * asks to be reported per clip; periods re-express the registered feel knobs
 * where one exists so a playtester tunes one number.
 */
export const MEMBER_MOTION_CLIP_SPECS: Readonly<Record<MemberMotionClip, MemberMotionClipSpec>> =
  Object.freeze({
    walk: Object.freeze({ frames: EMPIRE_TUNING.FLOOR_MEMBER_MOTION_FRAMES.walk, drive: 'distance', periodMs: null, loop: true }),
    idle: Object.freeze({
      frames: EMPIRE_TUNING.FLOOR_MEMBER_MOTION_FRAMES.idle,
      drive: 'time',
      periodMs: EMPIRE_TUNING.FLOOR_MEMBER_IDLE_BREATH_PERIOD_MS,
      loop: true,
    }),
    wait: Object.freeze({
      frames: EMPIRE_TUNING.FLOOR_MEMBER_MOTION_FRAMES.wait,
      drive: 'time',
      periodMs: EMPIRE_TUNING.FLOOR_MEMBER_WAIT_SWAY_PERIOD_MS,
      loop: true,
    }),
    'walk-to-wait': Object.freeze({
      frames: EMPIRE_TUNING.FLOOR_MEMBER_MOTION_FRAMES['walk-to-wait'],
      drive: 'time',
      periodMs: EMPIRE_TUNING.FLOOR_MEMBER_GAIT_TRANSITION_MS,
      loop: false,
    }),
    'wait-to-walk': Object.freeze({
      frames: EMPIRE_TUNING.FLOOR_MEMBER_MOTION_FRAMES['wait-to-walk'],
      drive: 'time',
      periodMs: EMPIRE_TUNING.FLOOR_MEMBER_GAIT_TRANSITION_MS,
      loop: false,
    }),
    'bench-setup': Object.freeze({
      frames: EMPIRE_TUNING.FLOOR_MEMBER_MOTION_FRAMES['bench-setup'],
      drive: 'time',
      periodMs: EMPIRE_TUNING.FLOOR_MEMBER_BENCH_SETUP_MS,
      loop: false,
    }),
    'bench-press': Object.freeze({
      frames: EMPIRE_TUNING.FLOOR_MEMBER_MOTION_FRAMES['bench-press'],
      drive: 'time',
      periodMs: EMPIRE_TUNING.FLOOR_MEMBER_REP_PERIOD_MS,
      loop: true,
    }),
    'bench-finish': Object.freeze({
      frames: EMPIRE_TUNING.FLOOR_MEMBER_MOTION_FRAMES['bench-finish'],
      drive: 'time',
      periodMs: EMPIRE_TUNING.FLOOR_MEMBER_BENCH_SETUP_MS,
      loop: false,
    }),
  } satisfies Record<MemberMotionClip, MemberMotionClipSpec>);

/**
 * The edges a body may take between clips, as `from → to`. A clip change the
 * runtime wants that is not an edge here is routed through the transition
 * clips (walk ↔ wait through `walk-to-wait` / `wait-to-walk`, the bench
 * through setup and finish); `memberMotion.ts` asserts every change it makes
 * is on this list, and the motion proof reads the same list off the trace.
 */
export const MEMBER_MOTION_TRANSITIONS: readonly (readonly [MemberMotionClip, MemberMotionClip])[] =
  Object.freeze([
    ['walk', 'walk-to-wait'],
    ['walk-to-wait', 'wait'],
    ['walk-to-wait', 'idle'],
    ['wait', 'wait-to-walk'],
    ['idle', 'wait-to-walk'],
    ['wait-to-walk', 'walk'],
    ['wait', 'idle'],
    ['idle', 'wait'],
    ['wait', 'bench-setup'],
    ['idle', 'bench-setup'],
    ['bench-setup', 'bench-press'],
    ['bench-press', 'bench-finish'],
    ['bench-finish', 'idle'],
    ['bench-finish', 'wait-to-walk'],
  ] as const);

/** Whether `from → to` is an edge of `MEMBER_MOTION_TRANSITIONS`. */
export function memberMotionTransitionAllowed(from: MemberMotionClip, to: MemberMotionClip): boolean {
  if (from === to) return true;
  return MEMBER_MOTION_TRANSITIONS.some(([a, b]) => a === from && b === to);
}

/** Every baked frame is this many pixels square, feet at the bottom centre — the paintings' own canvas. */
export const MEMBER_MOTION_CANVAS_PX: number = EMPIRE_TUNING.FLOOR_MEMBER_MOTION_CANVAS_PX;

/**
 * The member types drawn through the production pipeline. One identity for
 * VL-3's vertical slice — the brief's "one production-quality member is more
 * valuable than forty polished placeholders" — chosen as the type the garage
 * roster gives its third member (`member:n1:2`, the one the living-world
 * capture follows). Widening this list is data; the strips must exist on
 * disk for every type named here, which `ironAmberArt.test.ts` joins.
 */
export const MEMBER_MOTION_PRODUCTION_TYPES = Object.freeze(['powerlifter'] as const);
export type MemberMotionProductionType = (typeof MEMBER_MOTION_PRODUCTION_TYPES)[number];

/** Whether a member type is drawn through the production pipeline. */
export function memberMotionProductionType(type: string): type is MemberMotionProductionType {
  for (const each of MEMBER_MOTION_PRODUCTION_TYPES) if (each === type) return true;
  return false;
}

/**
 * The file stem of a clip's strip for a member type: `member-motion-<type>-<clip>`.
 * `ironAmberArt.ts` turns a stem into a served URI; the bake writes the file.
 */
export function memberMotionStripStem(type: MemberMotionProductionType, clip: MemberMotionClip): string {
  return `member-motion-${type}-${clip}`;
}

/**
 * The gait's stride in tiles: how far the feet travel on screen per full
 * walk cycle. VL-2 registered it as a knob before any rig existed; the rig's
 * authored leg swing is sized to it (see `memberRig.ts`), so one number
 * governs both the frames and the phase that plays them.
 */
export function memberMotionStrideTiles(): number {
  return EMPIRE_TUNING.FLOOR_MEMBER_STRIDE_TILES;
}
