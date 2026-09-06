/**
 * floorSprites.test.ts — GDD §5.13 presentation Phase 4's checkable half.
 *
 * What a unit suite can and cannot establish about an art pass, stated up
 * front. It CAN establish that every sprite the screen draws is exactly the
 * index grid its author wrote (the PNG bytes are decoded back here with an
 * independent little reader and compared pixel for pixel), that the five
 * member types render pairwise-differently in real colour, that the walk
 * frames animate, that the mirror is exact, and that every table is keyed by
 * the registered vocabularies in both directions. Whether the result reads
 * as the same game as the lift screen is the phase's own gate and belongs to
 * a human on a phone — nothing here claims it.
 *
 * DISTINCTNESS IS ASSERTED AS FLOORS, NOT EXACT PINS, AND THAT IS A CHOICE
 * WITH A REASON. This directory's house rule prefers pinned counts, and the
 * structural facts here (dimensions, key sets, byte-equality of PNG and
 * grid, palette-index validity) are pinned exactly. The pixel-difference
 * numbers between two sprites are not, because the sprite maps are the
 * hand-tuned feel surface of this piece — CLAUDE.md expects roughly thirty
 * later tuning passes over exactly this data, and an exact pin on every
 * pairwise diff would turn each retouch into a census edit that teaches
 * people to update numbers without reading them. The floors are set well
 * below the measured values (recorded beside each) so they catch collapse
 * (two types becoming the same sprite), which is the defect class Phase 2's
 * gate was passed on.
 */

import { describe, expect, it } from 'vitest';

import { EMPIRE_TUNING } from './empireTuning';
import {
  FLOOR_SPRITE_FACINGS,
  FLOOR_SPRITE_GRIDS,
  FLOOR_SPRITE_PALETTES,
  FLOOR_SPRITE_POSES,
  FLOOR_SPRITE_URIS,
  FLOOR_STATION_USE_CLASS,
  FLOOR_STATION_USE_CLASSES,
  type FixedFurnitureItem,
  type FloorSpriteGrid,
} from './floorSprites';
import { type MemberType } from './members';

const T = EMPIRE_TUNING;
const NATIVE = T.FLOOR_SPRITE_NATIVE_PIXELS_PER_TILE;
const SCALE = T.FLOOR_TILE_PIXELS / NATIVE;
const TYPES = T.MEMBER_TYPES;

// ---------------------------------------------------------------------------
// A small, independent PNG reader for exactly the subset the encoder writes:
// 8-bit indexed colour, filter 0 rows, stored (uncompressed) deflate blocks.
// Written here rather than imported so the test does not grade the encoder
// with the encoder.
// ---------------------------------------------------------------------------

interface DecodedPng {
  readonly w: number;
  readonly h: number;
  readonly bitDepth: number;
  readonly colourType: number;
  readonly paletteEntries: number;
  readonly transparentFirst: boolean;
  readonly pixels: readonly number[];
  readonly crcOk: boolean;
  readonly adlerOk: boolean;
}

const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) === 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table.push(c >>> 0);
  }
  return table;
})();

function crc32(bytes: readonly number[]): number {
  let c = 0xffffffff;
  for (const b of bytes) c = (CRC_TABLE[(c ^ b) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function decodeBase64(text: string): number[] {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of text) {
    if (ch === String.fromCharCode(0x3d)) break;
    const value = alphabet.indexOf(ch);
    expect(value, `base64 character ${ch}`).toBeGreaterThanOrEqual(0);
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >>> bits) & 0xff);
    }
  }
  return out;
}

function readU32(bytes: readonly number[], at: number): number {
  return (
    (((bytes[at] ?? 0) << 24) | ((bytes[at + 1] ?? 0) << 16) | ((bytes[at + 2] ?? 0) << 8) | (bytes[at + 3] ?? 0)) >>> 0
  );
}

function decodePngUri(uri: string): DecodedPng {
  expect(uri.startsWith('data:image/png;base64,')).toBe(true);
  const bytes = decodeBase64(uri.slice('data:image/png;base64,'.length));
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  expect(bytes.slice(0, 8)).toEqual(signature);

  let at = 8;
  let w = 0;
  let h = 0;
  let bitDepth = 0;
  let colourType = 0;
  let paletteEntries = 0;
  let transparentFirst = false;
  let idat: number[] = [];
  let crcOk = true;
  while (at < bytes.length) {
    const length = readU32(bytes, at);
    const type = String.fromCharCode(
      bytes[at + 4] ?? 0,
      bytes[at + 5] ?? 0,
      bytes[at + 6] ?? 0,
      bytes[at + 7] ?? 0,
    );
    const body = bytes.slice(at + 8, at + 8 + length);
    const declaredCrc = readU32(bytes, at + 8 + length);
    if (crc32([...bytes.slice(at + 4, at + 8), ...body]) !== declaredCrc) crcOk = false;
    if (type === 'IHDR') {
      w = readU32(body, 0);
      h = readU32(body, 4);
      bitDepth = body[8] ?? 0;
      colourType = body[9] ?? 0;
    } else if (type === 'PLTE') {
      paletteEntries = body.length / 3;
    } else if (type === 'tRNS') {
      transparentFirst = body.length >= 1 && body[0] === 0;
    } else if (type === 'IDAT') {
      idat = idat.concat(body);
    }
    at += 12 + length;
  }

  // The zlib stream: stored blocks only in this encoder's output.
  const raw: number[] = [];
  let i = 2;
  let final = 0;
  while (final === 0 && i < idat.length - 4) {
    const header = idat[i] ?? 0;
    final = header & 1;
    expect((header >>> 1) & 0x03, 'stored deflate block').toBe(0);
    const len = (idat[i + 1] ?? 0) | ((idat[i + 2] ?? 0) << 8);
    const nlen = (idat[i + 3] ?? 0) | ((idat[i + 4] ?? 0) << 8);
    expect((len ^ 0xffff) & 0xffff).toBe(nlen);
    for (let k = 0; k < len; k += 1) raw.push(idat[i + 5 + k] ?? 0);
    i += 5 + len;
  }
  let s1 = 1;
  let s2 = 0;
  for (const b of raw) {
    s1 = (s1 + b) % 65521;
    s2 = (s2 + s1) % 65521;
  }
  const adlerOk = (((s2 << 16) | s1) >>> 0) === readU32(idat, i);

  const pixels: number[] = [];
  for (let y = 0; y < h; y += 1) {
    expect(raw[y * (w + 1)], 'row filter byte').toBe(0);
    for (let x = 0; x < w; x += 1) pixels.push(raw[y * (w + 1) + 1 + x] ?? 0);
  }
  return { w, h, bitDepth, colourType, paletteEntries, transparentFirst, pixels, crcOk, adlerOk };
}

function upscaledData(grid: FloorSpriteGrid, factor: number): number[] {
  const out: number[] = [];
  for (let y = 0; y < grid.h * factor; y += 1) {
    for (let x = 0; x < grid.w * factor; x += 1) {
      out.push(grid.data[Math.floor(y / factor) * grid.w + Math.floor(x / factor)] ?? 0);
    }
  }
  return out;
}

function differingPixels(a: FloorSpriteGrid, b: FloorSpriteGrid): number {
  expect(a.w).toBe(b.w);
  expect(a.h).toBe(b.h);
  let moved = 0;
  for (let i = 0; i < a.data.length; i += 1) if (a.data[i] !== b.data[i]) moved += 1;
  return moved;
}

/** Pixel difference after resolving each grid through its own type's palette — colour-level, not index-level. */
function differingColours(
  a: FloorSpriteGrid,
  paletteA: readonly (readonly number[])[],
  b: FloorSpriteGrid,
  paletteB: readonly (readonly number[])[],
): number {
  let moved = 0;
  for (let i = 0; i < a.data.length; i += 1) {
    const ia = a.data[i] ?? 0;
    const ib = b.data[i] ?? 0;
    const ca = ia === 0 ? null : (paletteA[ia - 1] ?? null);
    const cb = ib === 0 ? null : (paletteB[ib - 1] ?? null);
    if (ca === null || cb === null) {
      if (ca !== cb) moved += 1;
      continue;
    }
    if (ca[0] !== cb[0] || ca[1] !== cb[1] || ca[2] !== cb[2]) moved += 1;
  }
  return moved;
}

// ---------------------------------------------------------------------------

describe('the vocabularies and dimensions agree with the registered tables', () => {
  it('scales the tile evenly: the drawn tile is a whole multiple of the native one', () => {
    expect(T.FLOOR_TILE_PIXELS % NATIVE).toBe(0);
    expect(SCALE).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(SCALE)).toBe(true);
  });

  it('keys every table by exactly the registered vocabulary, in both directions', () => {
    expect(Object.keys(FLOOR_SPRITE_GRIDS.member).sort()).toEqual([...TYPES].sort());
    expect(Object.keys(FLOOR_SPRITE_URIS.member).sort()).toEqual([...TYPES].sort());
    for (const type of TYPES) {
      expect(Object.keys(FLOOR_SPRITE_GRIDS.member[type]).sort()).toEqual(
        [...FLOOR_SPRITE_POSES].sort(),
      );
      for (const pose of FLOOR_SPRITE_POSES) {
        expect(Object.keys(FLOOR_SPRITE_GRIDS.member[type][pose]).sort()).toEqual(
          [...FLOOR_SPRITE_FACINGS].sort(),
        );
      }
    }
    expect(Object.keys(FLOOR_SPRITE_GRIDS.session).sort()).toEqual(
      [...T.SESSION_EQUIPMENT_ITEMS].sort(),
    );
    expect(Object.keys(FLOOR_SPRITE_GRIDS.fixed).sort()).toEqual(
      Object.keys(T.FLOOR_FIXED_FURNITURE_LAYOUT).sort(),
    );
    expect(Object.keys(FLOOR_SPRITE_GRIDS.floor).sort()).toEqual([...T.LADDER_RUNGS].sort());
  });

  it('draws every member at one native tile, every item at its registered footprint, every floor at its rung grid', () => {
    for (const type of TYPES) {
      for (const pose of FLOOR_SPRITE_POSES) {
        for (const facing of FLOOR_SPRITE_FACINGS) {
          const grid = FLOOR_SPRITE_GRIDS.member[type][pose][facing];
          expect(grid.w).toBe(NATIVE);
          expect(grid.h).toBe(NATIVE);
        }
      }
    }
    for (const item of T.SESSION_EQUIPMENT_ITEMS) {
      const footprint = T.SESSION_EQUIPMENT_FOOTPRINT[item];
      const grid = FLOOR_SPRITE_GRIDS.session[item];
      expect(grid.w, item).toBe(footprint.width * NATIVE);
      expect(grid.h, item).toBe(footprint.height * NATIVE);
    }
    for (const item of Object.keys(T.FLOOR_FIXED_FURNITURE_LAYOUT) as FixedFurnitureItem[]) {
      const footprint = T.FLOOR_FIXED_FURNITURE_LAYOUT[item].footprint;
      const grid = FLOOR_SPRITE_GRIDS.fixed[item];
      expect(grid.w, item).toBe(footprint.width * NATIVE);
      expect(grid.h, item).toBe(footprint.height * NATIVE);
    }
    for (const rung of T.LADDER_RUNGS) {
      const size = T.FLOOR_GRID_SIZE[rung];
      const grid = FLOOR_SPRITE_GRIDS.floor[rung];
      expect(grid.w, rung).toBe(size.width * NATIVE);
      expect(grid.h, rung).toBe(size.height * NATIVE);
    }
  });

  it('holds every index inside the one shared palette, and the legend matches it', () => {
    const paletteSize = FLOOR_SPRITE_PALETTES.base.length;
    expect(FLOOR_SPRITE_PALETTES.legend.length).toBe(paletteSize);
    for (const type of TYPES) {
      expect(FLOOR_SPRITE_PALETTES.byType[type].length).toBe(paletteSize);
    }
    const everyGrid: FloorSpriteGrid[] = [];
    for (const type of TYPES)
      for (const pose of FLOOR_SPRITE_POSES)
        for (const facing of FLOOR_SPRITE_FACINGS)
          everyGrid.push(FLOOR_SPRITE_GRIDS.member[type][pose][facing]);
    for (const item of T.SESSION_EQUIPMENT_ITEMS) everyGrid.push(FLOOR_SPRITE_GRIDS.session[item]);
    for (const item of Object.keys(T.FLOOR_FIXED_FURNITURE_LAYOUT) as FixedFurnitureItem[])
      everyGrid.push(FLOOR_SPRITE_GRIDS.fixed[item]);
    for (const item of Object.keys(
      FLOOR_SPRITE_GRIDS.fixedOccupied,
    ) as (keyof typeof FLOOR_SPRITE_GRIDS.fixedOccupied)[]) {
      everyGrid.push(FLOOR_SPRITE_GRIDS.fixedOccupied[item]);
    }
    for (const rung of T.LADDER_RUNGS) everyGrid.push(FLOOR_SPRITE_GRIDS.floor[rung]);
    everyGrid.push(FLOOR_SPRITE_GRIDS.bay.qualityBench);
    everyGrid.push(FLOOR_SPRITE_GRIDS.bay.plateTree);
    // 90 member grids (5 types x 9 poses x 2 facings, P4b's six using poses
    // included) + 14 session + 3 fixed + 1 occupied variant + 4 floors.
    // Pinned so an empty walk cannot make the loop below a pass over
    // nothing. 61 -> 111 with P4b, 111 -> 112 with P4c's occupied power-bar.
    // 112 -> 114: Stage D.1b quality bench + plate tree.
    expect(everyGrid.length).toBe(114);
    let inspected = 0;
    for (const grid of everyGrid) {
      for (const index of grid.data) {
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThanOrEqual(paletteSize);
      }
      inspected += grid.data.length;
    }
    expect(inspected).toBeGreaterThan(0);
  });
});

describe('the members read as drawn figures, apart from each other, and animate', () => {
  it('gives every member sprite an outline, real paint, and open corners', () => {
    for (const type of TYPES) {
      for (const pose of FLOOR_SPRITE_POSES) {
        const grid = FLOOR_SPRITE_GRIDS.member[type][pose].right;
        const distinct = new Set(grid.data.filter((index) => index !== 0));
        // The outline index is 1 — first legend slot — by construction.
        expect(distinct.has(1), `${type} ${pose} carries no outline`).toBe(true);
        // A figure, not a blob: at least outline + skin + top + one more.
        expect(distinct.size, `${type} ${pose}`).toBeGreaterThanOrEqual(4);
        const opaque = grid.data.filter((index) => index !== 0).length;
        // Measured 103-149 opaque pixels across the shipped maps (re-measured
        // when the bench pose was rotated along the slab; the range recorded
        // before that, 84-101, was stale even for poses that round did not
        // touch). The floor catches a map going missing, not a retouch.
        expect(opaque, `${type} ${pose}`).toBeGreaterThanOrEqual(60);
        // Both top corners open, so the sprite sits on the floor texture
        // rather than stamping a card over it. The bottom corners are not
        // pinned: the wide build's stride frame legitimately plants a foot
        // at the sprite edge.
        expect(grid.data[0]).toBe(0);
        expect(grid.data[grid.w - 1]).toBe(0);
      }
    }
  });

  it('mirrors left facing exactly, for every type and pose', () => {
    let checked = 0;
    for (const type of TYPES) {
      for (const pose of FLOOR_SPRITE_POSES) {
        const right = FLOOR_SPRITE_GRIDS.member[type][pose].right;
        const left = FLOOR_SPRITE_GRIDS.member[type][pose].left;
        for (let y = 0; y < right.h; y += 1) {
          for (let x = 0; x < right.w; x += 1) {
            expect(left.data[y * left.w + (left.w - 1 - x)]).toBe(right.data[y * right.w + x]);
          }
        }
        checked += 1;
      }
    }
    expect(checked).toBe(TYPES.length * FLOOR_SPRITE_POSES.length);
  });

  it('animates: the walk frames differ, every rep cycle pumps, and the three using classes read apart', () => {
    // P4b's checkable half, per class and per type. Every floor is 4 — the
    // collapse catch this file's header explains — with the measured values
    // recorded beside the loop rather than pinned, per the same header.
    let repPairs = 0;
    for (const type of TYPES) {
      const stand = FLOOR_SPRITE_GRIDS.member[type].stand.right;
      const stepA = FLOOR_SPRITE_GRIDS.member[type]['step-a'].right;
      const stepB = FLOOR_SPRITE_GRIDS.member[type]['step-b'].right;
      // Measured 22-32 differing pixels per pair on the shipped maps
      // (re-measured with the along-slab bench pose; 8-24 before that was
      // stale); the floor of 4 catches two frames collapsing into one.
      expect(differingPixels(stepA, stepB), `${type} walk`).toBeGreaterThanOrEqual(4);
      expect(differingPixels(stand, stepA), `${type} stand/step`).toBeGreaterThanOrEqual(4);
      for (const useClass of FLOOR_STATION_USE_CLASSES) {
        const frameA = FLOOR_SPRITE_GRIDS.member[type][`using-${useClass}-a`].right;
        const frameB = FLOOR_SPRITE_GRIDS.member[type][`using-${useClass}-b`].right;
        // The rep cycle: the two frames of one class differ (measured 7-52
        // per pair on the shipped maps, the 52 being the rotated bench), and
        // the working body differs from standing (measured 31-134).
        expect(differingPixels(frameA, frameB), `${type} ${useClass} rep`).toBeGreaterThanOrEqual(4);
        expect(differingPixels(stand, frameA), `${type} stand/${useClass}`).toBeGreaterThanOrEqual(4);
        repPairs += 1;
      }
      // The three classes read apart from each other, frame a against frame
      // a (measured 25-150 per pair; re-measured for P4c's bar-pose repaint
      // — 33-151 before it) — a bench body is not a bar body is not a
      // machine-face body, which is the whole point of P4b's templates.
      const benchA = FLOOR_SPRITE_GRIDS.member[type]['using-bench-a'].right;
      const barA = FLOOR_SPRITE_GRIDS.member[type]['using-bar-a'].right;
      const genericA = FLOOR_SPRITE_GRIDS.member[type]['using-generic-a'].right;
      expect(differingPixels(benchA, barA), `${type} bench/bar`).toBeGreaterThanOrEqual(4);
      expect(differingPixels(benchA, genericA), `${type} bench/generic`).toBeGreaterThanOrEqual(4);
      expect(differingPixels(barA, genericA), `${type} bar/generic`).toBeGreaterThanOrEqual(4);
    }
    // Counts, not bounds: every (type, class) rep pair really was compared.
    expect(repPairs).toBe(TYPES.length * FLOOR_STATION_USE_CLASSES.length);
  });

  it('lies the bench-class pose along the slab: the shipped flat bench is taller than it is wide', () => {
    // The named catcher for `opsUsingBench`'s orientation decision. The bench
    // figure is authored head-up, feet-down, along a pad `opsFlatBench` draws
    // running vertically — a choice derived from the shipped 2x4 footprint,
    // not from anything the pose can see at render time. A future flat bench
    // turned wider than tall reddens here, so the pose gets a rotated variant
    // instead of the crosswise-lying read coming back silently (which is
    // exactly how the first version of the pose shipped: authored horizontal
    // against a vertical pad, with nothing to say so).
    const footprint = T.FLOOR_FIXED_FURNITURE_LAYOUT['flat-bench'].footprint;
    expect(footprint.height).toBeGreaterThan(footprint.width);
  });

  it('P4c: the lockout bar passes behind the head — under-paint, never through it', () => {
    // The named catcher for the `under` paint-op's one job (`opsUsingBar`'s
    // frame-a lockout bar, which crosses the head's own rows and must paint
    // only where the base figure left the canvas transparent). Built against
    // a measured survival, not a feared one: the mutant — the op's only call
    // site, verbatim
    //   `ops.push(under(2, 1, NATIVE - INSET, 1, PX_STEEL_LIGHT));`
    // swapped to
    //   `ops.push(fill(2, 1, NATIVE - INSET, 1, PX_STEEL_LIGHT));`
    // — is exactly the steel-through-the-hair defect P4c opened to remove,
    // and with it planted this file ran 15/15 GREEN (measured this round):
    // the decode test moves in lockstep with the grids it re-encodes, every
    // distinctness floor GAINS pixels under the mutant, and the corner pin
    // sits outside the bar's span. With this test present the same mutant
    // reddens on the steel-through-the-head assertion below, naming the type
    // and the column (first failure: `casual using-bar-a: bar steel through
    // the head at x=4`), for every one of the five types.
    //
    // The head span is DERIVED, not hand-listed: row 1 of the type's own
    // `stand` sprite is head paint alone (crown outline plus hair, hood or
    // headband — the normal and lift torsos share their six head rows), and
    // nothing the bar overlay legitimately paints may touch those columns:
    // the under-fill defers to occupied pixels, and the hand dots and end
    // plates all sit outside every head span. So on the bar row the
    // using-bar-a pixel must EQUAL the stand pixel at every head column —
    // steel there is the defect, and any other overwrite is an erased head.
    const legend = FLOOR_SPRITE_PALETTES.legend;
    const steel = ['L', 'M', 'E'].map((ch) => legend.indexOf(ch) + 1);
    for (const index of steel) expect(index).toBeGreaterThan(0);
    const barRow = 1; // opsUsingBar's lockout bar row: under(2, 1, ...)
    let headColumnsChecked = 0;
    const typesWithBarSteelBesideHead: string[] = [];
    for (const type of TYPES) {
      const barA = FLOOR_SPRITE_GRIDS.member[type]['using-bar-a'].right;
      const stand = FLOOR_SPRITE_GRIDS.member[type].stand.right;
      const headXs: number[] = [];
      for (let x = 0; x < stand.w; x += 1) {
        if ((stand.data[barRow * stand.w + x] ?? 0) !== 0) headXs.push(x);
      }
      // Non-vacuity: the head really crosses the bar row for every type.
      // Measured spans on the shipped maps: 7 columns for the four
      // bare/banded heads, 8 for the hood; the floor catches an empty walk.
      expect(headXs.length, `${type}: no head paint on the bar row`).toBeGreaterThanOrEqual(4);
      for (const x of headXs) {
        const pixel = barA.data[barRow * barA.w + x] ?? 0;
        expect(
          steel.includes(pixel),
          `${type} using-bar-a: bar steel through the head at x=${x} — the lockout bar must pass BEHIND the head`,
        ).toBe(false);
        expect(
          pixel,
          `${type} using-bar-a: head pixel overwritten on the bar row at x=${x}`,
        ).toBe(stand.data[barRow * stand.w + x]);
        headColumnsChecked += 1;
      }
      let steelBesideHead = false;
      for (let x = 0; x < barA.w; x += 1) {
        const pixel = barA.data[barRow * barA.w + x] ?? 0;
        if (!steel.includes(pixel)) continue;
        expect(headXs.includes(x), `${type}: steel inside the head span at x=${x}`).toBe(false);
        steelBesideHead = true;
      }
      if (steelBesideHead) typesWithBarSteelBesideHead.push(type);
    }
    // Measured: 36 head columns over the five types; a floor rather than a
    // pin, per this file's header, so a head retouch is not a census edit.
    expect(headColumnsChecked).toBeGreaterThanOrEqual(TYPES.length * 4);
    // Four of the five types show bar steel beside the head on the shipped
    // maps (all but `serious-lifter`, whose hood spans the whole under-fill
    // range, so its bar reads through the end plates and hands alone —
    // recorded rather than asserted away). The floor of one catches the bar
    // op being deleted outright, which no equality above would notice.
    expect(typesWithBarSteelBesideHead.length).toBeGreaterThanOrEqual(1);
  });

  it('maps every station to a use class, totally and in both directions, and uses all three classes', () => {
    expect(Object.keys(FLOOR_STATION_USE_CLASS.session).sort()).toEqual(
      [...T.SESSION_EQUIPMENT_ITEMS].sort(),
    );
    expect(Object.keys(FLOOR_STATION_USE_CLASS.fixed).sort()).toEqual(
      Object.keys(T.FLOOR_FIXED_FURNITURE_LAYOUT).sort(),
    );
    const assigned = new Set<string>([
      ...Object.values(FLOOR_STATION_USE_CLASS.session),
      ...Object.values(FLOOR_STATION_USE_CLASS.fixed),
    ]);
    for (const value of assigned) {
      expect([...FLOOR_STATION_USE_CLASSES]).toContain(value);
    }
    // The cold garage's three fixed stations alone span all three classes —
    // bench (flat-bench), bar (power-bar) and generic (comp-plates) — so the
    // very first floor a player sees already shows three different bodies at
    // work. Pinned as a set equality so a re-mapping that collapses the cold
    // floor to two classes is red here rather than discovered on a phone.
    expect([...new Set(Object.values(FLOOR_STATION_USE_CLASS.fixed))].sort()).toEqual(
      [...FLOOR_STATION_USE_CLASSES].sort(),
    );
  });

  it('renders the five types pairwise-differently in real colour, in every pose', () => {
    // The Phase 2 guarantee this piece must not lose: a casual must not look
    // like a powerlifter. Compared through each type's own palette, so a
    // silhouette difference AND an outfit-hue difference both count, and two
    // types that shared both would fail whatever their maps said.
    let pairs = 0;
    for (const pose of FLOOR_SPRITE_POSES) {
      for (let a = 0; a < TYPES.length; a += 1) {
        for (let b = a + 1; b < TYPES.length; b += 1) {
          const typeA = TYPES[a] as MemberType;
          const typeB = TYPES[b] as MemberType;
          const moved = differingColours(
            FLOOR_SPRITE_GRIDS.member[typeA][pose].right,
            FLOOR_SPRITE_PALETTES.byType[typeA],
            FLOOR_SPRITE_GRIDS.member[typeB][pose].right,
            FLOOR_SPRITE_PALETTES.byType[typeB],
          );
          // Measured 17-101 on the shipped maps. The 17 is every type pair
          // at the two bench poses, and it is structural rather than a thin
          // margin: the bench grid is one map shared by all five types, so
          // the only pixels that can differ are the outfit-slot ones (17 of
          // them), which is exactly the "type identity rides the outfit
          // palette" trade `opsUsingBench`'s own comment states. The floor
          // catches collapse.
          expect(moved, `${typeA} vs ${typeB} at ${pose}`).toBeGreaterThanOrEqual(12);
          pairs += 1;
        }
      }
    }
    expect(pairs).toBe(FLOOR_SPRITE_POSES.length * ((TYPES.length * (TYPES.length - 1)) / 2));
  });

  it('keeps the five outfit hues apart as colours, not only as table rows', () => {
    const tops = TYPES.map((type) => T.FLOOR_SPRITE_OUTFIT_PALETTE[type].top);
    for (let a = 0; a < tops.length; a += 1) {
      for (let b = a + 1; b < tops.length; b += 1) {
        const [ra, ga, ba] = [tops[a]?.[0] ?? 0, tops[a]?.[1] ?? 0, tops[a]?.[2] ?? 0];
        const [rb, gb, bb] = [tops[b]?.[0] ?? 0, tops[b]?.[1] ?? 0, tops[b]?.[2] ?? 0];
        const apart = Math.abs(ra - rb) + Math.abs(ga - gb) + Math.abs(ba - bb);
        expect(apart, `${TYPES[a]} vs ${TYPES[b]}`).toBeGreaterThanOrEqual(60);
      }
    }
  });
});

describe('the equipment and the floor', () => {
  it('draws every item with an outline and more than one paint step', () => {
    const items = [
      ...T.SESSION_EQUIPMENT_ITEMS.map((item) => FLOOR_SPRITE_GRIDS.session[item]),
      ...(Object.keys(T.FLOOR_FIXED_FURNITURE_LAYOUT) as FixedFurnitureItem[]).map(
        (item) => FLOOR_SPRITE_GRIDS.fixed[item],
      ),
    ];
    expect(items.length).toBe(T.SESSION_EQUIPMENT_ITEMS.length + 3);
    for (const grid of items) {
      const distinct = new Set(grid.data.filter((index) => index !== 0));
      expect(distinct.has(1)).toBe(true);
      expect(distinct.size).toBeGreaterThanOrEqual(3);
      expect(grid.data.some((index) => index !== 0)).toBe(true);
    }
  });

  it('P4c: the occupied power-bar variant exists, differs from the resting sprite, and holds no bar paint', () => {
    // The named catcher for the double-bar fix. The resting power-bar sprite
    // is a loaded bar seen from above; the bar-class member pose draws its
    // own loaded bar; `FloorGrid.tsx` swaps the station to this variant
    // while the sim says `using`, so exactly one bar is ever drawn on that
    // cell. The checkable half here: the variant is keyed for exactly the
    // items that have one, drawn to the real footprint, visibly different
    // from the resting sprite, and contains ZERO pixels of bar steel or
    // plate paint — the four indices the resting sprite's apparatus is made
    // of, derived from the legend rather than restated as numbers.
    expect(Object.keys(FLOOR_SPRITE_GRIDS.fixedOccupied).sort()).toEqual(['power-bar']);
    expect(Object.keys(FLOOR_SPRITE_URIS.fixedOccupied).sort()).toEqual(['power-bar']);
    const occupied = FLOOR_SPRITE_GRIDS.fixedOccupied['power-bar'];
    const footprint = T.FLOOR_FIXED_FURNITURE_LAYOUT['power-bar'].footprint;
    expect(occupied.w).toBe(footprint.width * NATIVE);
    expect(occupied.h).toBe(footprint.height * NATIVE);
    const distinct = new Set(occupied.data.filter((index) => index !== 0));
    // Outline plus the rest-mark tone — a drawn ghost, not an empty grid.
    expect(distinct.has(1)).toBe(true);
    expect(distinct.size).toBeGreaterThanOrEqual(2);
    const legend = FLOOR_SPRITE_PALETTES.legend;
    const barPaint = ['L', 'M', 'C', 'G'].map((ch) => legend.indexOf(ch) + 1);
    for (const index of barPaint) {
      expect(index).toBeGreaterThan(0);
      expect(distinct.has(index), `occupied power-bar paints bar/plate index ${index}`).toBe(false);
    }
    // Visibly different from the resting sprite (measured 152 differing
    // pixels; the floor catches the swap collapsing into a copy).
    expect(differingPixels(occupied, FLOOR_SPRITE_GRIDS.fixed['power-bar'])).toBeGreaterThanOrEqual(
      40,
    );
    // And the resting sprite really does carry the apparatus this variant
    // removes — the control that keeps the zero above meaning something.
    const restingDistinct = new Set(FLOOR_SPRITE_GRIDS.fixed['power-bar'].data);
    expect(barPaint.some((index) => restingDistinct.has(index))).toBe(true);
  });

  it('Stage D.1b: Quality paints a competition-spec pad, not a recolour of the stock bench', () => {
    const stock = FLOOR_SPRITE_GRIDS.fixed['flat-bench'];
    const quality = FLOOR_SPRITE_GRIDS.bay.qualityBench;
    expect(quality.w).toBe(stock.w);
    expect(quality.h).toBe(stock.h);
    expect(differingPixels(quality, stock)).toBeGreaterThanOrEqual(80);
    const legend = FLOOR_SPRITE_PALETTES.legend;
    const rubber = legend.indexOf('R') + 1;
    const pad = legend.indexOf('U') + 1;
    let qualityRubber = 0;
    let qualityPad = 0;
    let stockPad = 0;
    for (const index of quality.data) {
      if (index === rubber) qualityRubber += 1;
      if (index === pad) qualityPad += 1;
    }
    for (const index of stock.data) {
      if (index === pad) stockPad += 1;
    }
    expect(qualityRubber).toBeGreaterThan(0);
    expect(stockPad).toBeGreaterThan(0);
    expect(qualityPad).toBe(0);
  });

  it('Stage D.1b: Throughput paints a plate tree, not a second bench and not the plate stack', () => {
    const tree = FLOOR_SPRITE_GRIDS.bay.plateTree;
    expect(tree.w).toBe(NATIVE);
    expect(tree.h).toBe(NATIVE * 2);
    const legend = FLOOR_SPRITE_PALETTES.legend;
    const plate = legend.indexOf('C') + 1;
    const steelDark = legend.indexOf('E') + 1;
    let platePixels = 0;
    let spinePixels = 0;
    for (const index of tree.data) {
      if (index === plate) platePixels += 1;
      if (index === steelDark) spinePixels += 1;
    }
    expect(platePixels).toBeGreaterThan(0);
    expect(spinePixels).toBeGreaterThan(0);
    expect(FLOOR_SPRITE_URIS.bay.plateTree).not.toBe(FLOOR_SPRITE_URIS.fixed['comp-plates']);
    expect(FLOOR_SPRITE_URIS.bay.qualityBench).not.toBe(FLOOR_SPRITE_URIS.fixed['flat-bench']);
  });

  it('paints the floor fully opaque, from exactly the four floor tones', () => {
    // The floor palette occupies the last four legend slots by construction.
    const paletteSize = FLOOR_SPRITE_PALETTES.base.length;
    const floorIndices = new Set([
      paletteSize - 3,
      paletteSize - 2,
      paletteSize - 1,
      paletteSize,
    ]);
    for (const rung of T.LADDER_RUNGS) {
      const grid = FLOOR_SPRITE_GRIDS.floor[rung];
      const seen = new Set(grid.data);
      expect(seen.has(0), `${rung} has a transparent hole`).toBe(false);
      for (const index of seen) {
        expect(floorIndices.has(index), `${rung} paints index ${index}`).toBe(true);
      }
      // All four tones actually appear — base, alternate, seam and fleck —
      // so the texture is a texture and not a flat fill wearing a palette.
      expect([...seen].sort((a, b) => a - b).length).toBe(4);
    }
  });

  it('does not bake a placement-cell stroke into the floor texture', () => {
    // H1: Play hides overlay lines; a full tile-edge seam in the PNG still
    // reads as a floor grid once the texture is stretched full-bleed.
    const paletteSize = FLOOR_SPRITE_PALETTES.base.length;
    const seamIndex = paletteSize - 1;
    for (const rung of T.LADDER_RUNGS) {
      const grid = FLOOR_SPRITE_GRIDS.floor[rung];
      const size = T.FLOOR_GRID_SIZE[rung];
      for (let ty = 1; ty < size.height; ty += 1) {
        const y = ty * NATIVE - 1;
        let seamOnRow = 0;
        for (let x = 0; x < grid.w; x += 1) {
          if (grid.data[y * grid.w + x] === seamIndex) seamOnRow += 1;
        }
        expect(seamOnRow, `${rung} horizontal tile-edge seam at y=${y}`).toBeLessThan(grid.w);
      }
      for (let tx = 1; tx < size.width; tx += 1) {
        const x = tx * NATIVE - 1;
        let seamOnCol = 0;
        for (let y = 0; y < grid.h; y += 1) {
          if (grid.data[y * grid.w + x] === seamIndex) seamOnCol += 1;
        }
        expect(seamOnCol, `${rung} vertical tile-edge seam at x=${x}`).toBeLessThan(grid.h);
      }
    }
  });
});

describe('the PNGs are exactly the grids', () => {
  it('encodes every URI as a valid indexed PNG whose pixels equal the source grid', () => {
    // Decoded with this file's own independent reader — CRCs and the zlib
    // checksum verified, dimensions read from IHDR, and every pixel byte
    // compared. Members and equipment are pre-upscaled by the tile scale;
    // floors are encoded native (the module header's stated size trade).
    const cases: { name: string; uri: string; expected: readonly number[]; w: number; h: number }[] =
      [];
    for (const type of TYPES) {
      for (const pose of FLOOR_SPRITE_POSES) {
        for (const facing of FLOOR_SPRITE_FACINGS) {
          const grid = FLOOR_SPRITE_GRIDS.member[type][pose][facing];
          cases.push({
            name: `member ${type} ${pose} ${facing}`,
            uri: FLOOR_SPRITE_URIS.member[type][pose][facing],
            expected: upscaledData(grid, SCALE),
            w: grid.w * SCALE,
            h: grid.h * SCALE,
          });
        }
      }
    }
    for (const item of T.SESSION_EQUIPMENT_ITEMS) {
      const grid = FLOOR_SPRITE_GRIDS.session[item];
      cases.push({
        name: `session ${item}`,
        uri: FLOOR_SPRITE_URIS.session[item],
        expected: upscaledData(grid, SCALE),
        w: grid.w * SCALE,
        h: grid.h * SCALE,
      });
    }
    for (const item of Object.keys(T.FLOOR_FIXED_FURNITURE_LAYOUT) as FixedFurnitureItem[]) {
      const grid = FLOOR_SPRITE_GRIDS.fixed[item];
      cases.push({
        name: `fixed ${item}`,
        uri: FLOOR_SPRITE_URIS.fixed[item],
        expected: upscaledData(grid, SCALE),
        w: grid.w * SCALE,
        h: grid.h * SCALE,
      });
    }
    for (const item of Object.keys(
      FLOOR_SPRITE_GRIDS.fixedOccupied,
    ) as (keyof typeof FLOOR_SPRITE_GRIDS.fixedOccupied)[]) {
      const grid = FLOOR_SPRITE_GRIDS.fixedOccupied[item];
      const uri = FLOOR_SPRITE_URIS.fixedOccupied[item];
      cases.push({
        name: `fixed-occupied ${item}`,
        uri,
        expected: upscaledData(grid, SCALE),
        w: grid.w * SCALE,
        h: grid.h * SCALE,
      });
    }
    for (const rung of T.LADDER_RUNGS) {
      const grid = FLOOR_SPRITE_GRIDS.floor[rung];
      cases.push({
        name: `floor ${rung}`,
        uri: FLOOR_SPRITE_URIS.floor[rung],
        expected: [...grid.data],
        w: grid.w,
        h: grid.h,
      });
    }
    cases.push({
      name: 'bay qualityBench',
      uri: FLOOR_SPRITE_URIS.bay.qualityBench,
      expected: upscaledData(FLOOR_SPRITE_GRIDS.bay.qualityBench, SCALE),
      w: FLOOR_SPRITE_GRIDS.bay.qualityBench.w * SCALE,
      h: FLOOR_SPRITE_GRIDS.bay.qualityBench.h * SCALE,
    });
    cases.push({
      name: 'bay plateTree',
      uri: FLOOR_SPRITE_URIS.bay.plateTree,
      expected: upscaledData(FLOOR_SPRITE_GRIDS.bay.plateTree, SCALE),
      w: FLOOR_SPRITE_GRIDS.bay.plateTree.w * SCALE,
      h: FLOOR_SPRITE_GRIDS.bay.plateTree.h * SCALE,
    });
    // 61 -> 111 with P4b's six using poses (90 member sprites now);
    // 111 -> 112 with P4c's occupied power-bar variant.
    // 112 -> 114: Stage D.1b quality bench + plate tree.
    expect(cases.length).toBe(114);

    for (const each of cases) {
      const decoded = decodePngUri(each.uri);
      expect(decoded.crcOk, `${each.name}: a chunk CRC disagrees`).toBe(true);
      expect(decoded.adlerOk, `${each.name}: the zlib checksum disagrees`).toBe(true);
      expect(decoded.w, each.name).toBe(each.w);
      expect(decoded.h, each.name).toBe(each.h);
      expect(decoded.bitDepth, each.name).toBe(8);
      expect(decoded.colourType, `${each.name}: not indexed colour`).toBe(3);
      expect(decoded.paletteEntries, each.name).toBe(FLOOR_SPRITE_PALETTES.base.length + 1);
      expect(decoded.transparentFirst, `${each.name}: index zero not transparent`).toBe(true);
      expect(decoded.pixels.length, each.name).toBe(each.expected.length);
      // Byte-for-byte, but reported as a count so a failure names how far
      // apart the two are instead of printing two ten-thousand-entry arrays.
      let moved = 0;
      for (let i = 0; i < each.expected.length; i += 1) {
        if (decoded.pixels[i] !== each.expected[i]) moved += 1;
      }
      expect(moved, `${each.name}: decoded pixels differ from the grid`).toBe(0);
    }
  });
});
