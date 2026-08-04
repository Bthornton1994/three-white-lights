/**
 * meetPlates.ts — what goes on the bar for the walkout beat.
 *
 * ---------------------------------------------------------------------------
 * THE PLATE MATH IS NOT REDONE HERE, AND IT IS NOT `meet.ts`'S EITHER
 * ---------------------------------------------------------------------------
 * `meet.ts` says this in as many words, under WHY THERE IS NO PLATE GATE:
 *
 *   "A bar-load display, a plate rack, or a loading crew screen must compute
 *   from a real inventory, which lives outside this module — it must NOT read a
 *   rule field off `MeetLoadingRules` and treat it as a grid, because that is
 *   exactly the wrong answer this section exists to delete."
 *
 * So the stack comes from `src/art/plates.ts`, which already holds the real
 * denominations (transcribed from OpenLifter's defaults, colours included) and
 * a greedy loader. This file is an ADAPTER: it asks that module what discs go
 * on, and turns each one into a rectangle at phone scale. It contains no
 * denomination, no colour rule and no loading order of its own.
 *
 * WHAT IT INHERITS, and it is worth saying rather than leaving to be found:
 * `visualPlateStack` assumes UNLIMITED discs of each denomination and is
 * explicitly "NOT a proof of loadability". A weight the real rack could not
 * make will still be drawn here. That is the same over-permissiveness
 * `meet.ts` discloses for the weights it accepts, arriving in pixels, and it
 * closes when a plate inventory exists — not before.
 *
 * PURE. Zero React, zero I/O. Geometry only, from `MEET_LAYOUT`.
 */

import { PLATE_SPECS, visualPlateStack } from '../art/plates';
import { MEET_LAYOUT } from '../game/meetTuning';
import { MEET_PLATE_COLOURS } from './meetPalette';

/** One disc, ready to draw. */
export interface PlateMark {
  readonly weightKg: number;
  /** Height in logical points, scaled from the disc's real diameter. */
  readonly heightPt: number;
  readonly colour: string;
  readonly edgeColour: string;
}

/**
 * The diameter range across every denomination the loader can use, so a disc's
 * drawn height is its real size relative to the others rather than a number
 * somebody picked. Computed once, from the specs.
 */
const DIAMETERS_MM = PLATE_SPECS.map((spec) => spec.diameterMm);
const MIN_DIAMETER_MM = Math.min(...DIAMETERS_MM);
const MAX_DIAMETER_MM = Math.max(...DIAMETERS_MM);

function heightFor(diameterMm: number): number {
  const span = MAX_DIAMETER_MM - MIN_DIAMETER_MM;
  const fraction = span <= 0 ? 1 : (diameterMm - MIN_DIAMETER_MM) / span;
  return (
    MEET_LAYOUT.PLATE_MIN_H + (MEET_LAYOUT.PLATE_MAX_H - MEET_LAYOUT.PLATE_MIN_H) * fraction
  );
}

/**
 * The discs on ONE side of the bar, inboard (heaviest) first — the order a real
 * loading crew puts them on.
 */
export function plateStackFor(totalKg: number, barAndCollarsKg: number): readonly PlateMark[] {
  const stack = visualPlateStack(totalKg, barAndCollarsKg);
  return stack.perSide.map((loaded) => {
    const colours = MEET_PLATE_COLOURS[loaded.spec.hue];
    return {
      weightKg: loaded.spec.kg,
      heightPt: heightFor(loaded.spec.diameterMm),
      colour: colours.face,
      edgeColour: colours.edge,
    };
  });
}
