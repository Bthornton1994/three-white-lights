/**
 * Plate loading — VISUAL ONLY.
 *
 * ---------------------------------------------------------------------------
 * SCOPE, READ THIS BEFORE USING ANY EXPORT
 * ---------------------------------------------------------------------------
 * This module answers one question: "what discs do I draw on the sleeve for a
 * bar of N kg?" It is not, and must never become, an authority on what a meet
 * can legally load. The meet engine (`src/game/meet.ts`) deliberately does not
 * model plate inventory, and this module deliberately assumes an infinite
 * supply of every denomination. If a caller ever needs to know whether a weight
 * is *loadable*, that is a meet-engine question and answering it from here
 * would put two disagreeing answers in the codebase.
 *
 * Consequence, stated plainly: `visualPlateStack(213)` will happily return a
 * stack that no real platform could produce. That is correct behaviour for a
 * renderer and wrong behaviour for a rules engine.
 *
 * ---------------------------------------------------------------------------
 * SOURCES
 * ---------------------------------------------------------------------------
 * Denominations and colours: OpenLifter `src/reducers/meetReducer.ts` +
 * `src/constants/plateColors.ts`, fetched HTTP 200 from
 * https://gitlab.com/openpowerlifting/openlifter/-/raw/main/... See the header
 * of `palette.ts` for the full provenance note and for what could NOT be
 * verified (the IPF rulebook PDF is 403 through this sandbox's proxy).
 *
 * Diameters: NOTHING IN THIS FILE HAS A VERIFIED DIAMETER, and the per-entry
 * flag says so. OpenLifter, the one source that could actually be read from
 * here, records denominations and colours; it does not record disc geometry.
 * Every federation rulebook PDF is HTTP 403 through this sandbox's proxy, and
 * retrying is not going to change that.
 *
 * So the flag distinguishes the two grades of unverified rather than pretending
 * one of them is sourced:
 *   COMMON_LADDER — the 450 / 450 / 400 / 325 / 228 / 190 / 160 mm ladder for
 *     25 / 20 / 15 / 10 / 5 / 2.5 / 1.25 kg, which is what plate vendors and
 *     secondary guides publish as the IWF/IPF calibrated set. Widely agreed on,
 *     never read from the rules by us.
 *   ESTIMATED — our own number. The sub-1.25 kg change discs. They are drawn
 *     2-4 px tall regardless, so the estimate is visually inconsequential, but
 *     it is an estimate.
 *
 * An earlier revision of this file marked the first group `diameterSourced:
 * true` while this header said the opposite. The header was right.
 *
 * Bar + collars default to 25 kg (20 kg bar, 2.5 kg collars), matching
 * OpenLifter's `defaultBarAndCollarsWeightKg = 25`.
 */

import { PX_PER_METRE, BAR } from './spriteTuning';
import { RAMPS, type Ramp } from './palette';

export type PlateHue = 'RED' | 'BLUE' | 'YELLOW' | 'GREEN' | 'BLACK';

/**
 * How much is known about a diameter. There is no `SOURCED` member, because
 * nothing here is sourced — see the header. Adding one would require actually
 * reading a rulebook, which this sandbox cannot do.
 */
export type DiameterProvenance = 'COMMON_LADDER' | 'ESTIMATED';

export interface PlateSpec {
  readonly kg: number;
  readonly hue: PlateHue;
  readonly diameterMm: number;
  readonly diameterProvenance: DiameterProvenance;
}

/**
 * Denominations, heaviest first. Colours are OpenLifter's defaults, unchanged.
 * Denominations OpenLifter ships with `pairCount: 0` (50, 2, 1.5) are omitted:
 * they exist in its picker but are not on a default platform, and a 50 kg disc
 * on a game sprite would misrepresent what a meet looks like.
 */
export const PLATE_SPECS: readonly PlateSpec[] = [
  { kg: 25, hue: 'RED', diameterMm: 450, diameterProvenance: 'COMMON_LADDER' },
  { kg: 20, hue: 'BLUE', diameterMm: 450, diameterProvenance: 'COMMON_LADDER' },
  { kg: 15, hue: 'YELLOW', diameterMm: 400, diameterProvenance: 'COMMON_LADDER' },
  { kg: 10, hue: 'GREEN', diameterMm: 325, diameterProvenance: 'COMMON_LADDER' },
  { kg: 5, hue: 'BLACK', diameterMm: 228, diameterProvenance: 'COMMON_LADDER' },
  { kg: 2.5, hue: 'BLACK', diameterMm: 190, diameterProvenance: 'COMMON_LADDER' },
  { kg: 1.25, hue: 'BLACK', diameterMm: 160, diameterProvenance: 'COMMON_LADDER' },
  { kg: 1, hue: 'BLUE', diameterMm: 140, diameterProvenance: 'ESTIMATED' },
  { kg: 0.75, hue: 'RED', diameterMm: 130, diameterProvenance: 'ESTIMATED' },
  { kg: 0.5, hue: 'GREEN', diameterMm: 120, diameterProvenance: 'ESTIMATED' },
  { kg: 0.25, hue: 'BLUE', diameterMm: 110, diameterProvenance: 'ESTIMATED' },
];

export const PLATE_HUE_RAMPS: Record<PlateHue, Ramp> = {
  RED: RAMPS.PLATE_RED,
  BLUE: RAMPS.PLATE_BLUE,
  YELLOW: RAMPS.PLATE_YELLOW,
  GREEN: RAMPS.PLATE_GREEN,
  BLACK: RAMPS.PLATE_BLACK,
};

/** 20 kg bar + 2.5 kg collars, per OpenLifter's default. */
export const BAR_AND_COLLARS_KG = 25;

/** Smallest change disc; also the resolution of the greedy remainder. */
const SMALLEST_KG = 0.25;

/** Plate diameters are specified in millimetres; the sprite scale is per metre. */
const MM_PER_METRE = 1000;

/**
 * Fixed-point guard for the greedy stack.
 *
 * kg arithmetic at 0.25 resolution accumulates float error fast enough to drop
 * a change disc if `remaining >= spec.kg` is compared naively. Not a tunable:
 * anything larger than a float ulp and smaller than the smallest disc does the
 * same job.
 */
const PLATE_KG_EPSILON = 1e-9;

export interface LoadedPlate {
  readonly spec: PlateSpec;
  /** Disc height in sprite px, from the real diameter. NOT exaggerated. */
  readonly diameterPx: number;
}

export interface PlateStack {
  /** Inboard (largest) first, matching real loading order. */
  readonly perSide: readonly LoadedPlate[];
  readonly totalKg: number;
  /** Weight the discs could not account for, kg. Zero for meet weights. */
  readonly remainderKg: number;
}

/** Disc diameter in sprite pixels, at true scale. */
export function plateDiameterPx(spec: PlateSpec): number {
  return (spec.diameterMm / MM_PER_METRE) * PX_PER_METRE;
}

/**
 * Greedy per-side stack for a bar of `totalKg`, assuming unlimited discs.
 *
 * Greedy is correct here because the denomination ladder is heavily composite
 * (25/20/15/10/5/2.5/1.25 and the change discs) and because a real loader loads
 * greedily — biggest plates innermost. It is NOT a proof of loadability; see
 * the module header.
 */
export function visualPlateStack(totalKg: number, barKg: number = BAR_AND_COLLARS_KG): PlateStack {
  const perSide: LoadedPlate[] = [];
  let remaining = (totalKg - barKg) / 2;

  if (remaining <= 0) {
    return { perSide, totalKg, remainderKg: Math.max(0, totalKg - barKg) };
  }

  for (const spec of PLATE_SPECS) {
    while (remaining + PLATE_KG_EPSILON >= spec.kg) {
      perSide.push({ spec, diameterPx: plateDiameterPx(spec) });
      remaining -= spec.kg;
    }
  }

  const remainderKg = remaining < SMALLEST_KG / 2 ? 0 : remaining * 2;
  return { perSide, totalKg, remainderKg };
}

export interface SleeveSlot {
  readonly plate: LoadedPlate;
  /** Distance from bar centre to the inboard edge of the disc, px. */
  readonly dxInner: number;
  /** Drawn thickness, px. Compressed when the sleeve is crowded. */
  readonly facePx: number;
}

export interface SleeveLayout {
  readonly slots: readonly SleeveSlot[];
  /** Discs that did not fit and are not drawn. Should normally be 0. */
  readonly droppedCount: number;
  /** Pitch actually used, px. Falls to MIN when the sleeve is crowded. */
  readonly pitchPx: number;
  /** Distance from centre to the inboard edge of the collar, px. */
  readonly collarDxInner: number;
}

/** Minimum pitch before discs start being dropped. 2px = disc + no gap. */
const MIN_PITCH_PX = 2;

/**
 * Place a stack along one sleeve.
 *
 * The sleeve is BAR.SHAFT_HALF_PX .. BAR.HALF_SPAN_PX with the collar occupying
 * the outboard end. At the authored pitch of 3 px that is room for five 25s —
 * a 275 kg bar. Heavier bars compress the pitch to 2 px (room for eight, i.e.
 * 425 kg) before any disc is dropped, so the load stays countable well past
 * anything a player will lift. Compression is also a free heaviness cue: a
 * maximal bar looks densely packed, a light one has air around the discs.
 */
export function layoutSleeve(stack: PlateStack): SleeveLayout {
  const sleeveLen = BAR.HALF_SPAN_PX - BAR.SHAFT_HALF_PX;
  const available = sleeveLen - BAR.COLLAR_WIDTH_PX;
  const count = stack.perSide.length;

  let pitchPx: number = BAR.PLATE_PITCH_PX;
  if (count > 0 && count * pitchPx > available) {
    pitchPx = Math.max(MIN_PITCH_PX, Math.floor(available / count));
  }

  const fitCount = pitchPx > 0 ? Math.min(count, Math.floor(available / pitchPx)) : 0;
  // Always leave a pixel of gap: the gap is what the outline pass fills, and the
  // dark line between discs is the only thing that makes a stack countable.
  const facePx = Math.max(1, Math.min(BAR.PLATE_FACE_PX, pitchPx - 1));

  const slots: SleeveSlot[] = [];
  for (let i = 0; i < fitCount; i += 1) {
    const plate = stack.perSide[i];
    if (plate === undefined) continue;
    slots.push({ plate, dxInner: BAR.SHAFT_HALF_PX + i * pitchPx, facePx });
  }

  return {
    slots,
    droppedCount: count - fitCount,
    pitchPx,
    collarDxInner: BAR.SHAFT_HALF_PX + fitCount * pitchPx,
  };
}
