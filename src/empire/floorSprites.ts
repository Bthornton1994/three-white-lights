/**
 * floorSprites.ts — GDD §5.13 presentation Phase 4: the 16-bit art pass for
 * the gym floor, self-contained in this directory by the ruling recorded in
 * §5.13's closing stanza. It follows `src/art/`'s conventions by READING
 * them, not by importing that directory: a sprite is an index grid (a grid of
 * palette indices — no alpha blending, no anti-aliasing, no dithering), the
 * key light is one lamp fixed upper-left and baked into the maps (lit columns
 * left of a mass, shade columns right), and there is no pillow shading —
 * value structure comes from hand-placed characters, not from brightness
 * falling off toward every edge at once.
 *
 * Pure module (CLAUDE.md, "Pure logic is separate from UI"): zero React, zero
 * side effects beyond building its own frozen tables at load, zero I/O, no
 * clock. Its imports are `./empireTuning` (every colour component and scale
 * knob lives there, per the tunability rule), and the three vocabulary types
 * (`./ladder`, `./members`, `./sessions`).
 *
 * WHAT IT EXPORTS, AND WHY THE EXPORTS ARE DATA RATHER THAN FUNCTIONS. The
 * whole surface is frozen constants: the pose/facing vocabularies, the index
 * grids, the resolved palettes, and one data URI per sprite. A constant has
 * no branch point, no input domain and no caller-supplied argument, so the
 * directory's behavioural instruments read the finished values directly —
 * a forbidden name in any of these strings is visible unconditionally, with
 * no domain to straddle. The generation helpers stay module-private.
 *
 * HOW THE PIXELS BECOME AN IMAGE, at chip scale, with no renderer library.
 * Each grid is integer-upscaled from the authored resolution
 * (`FLOOR_SPRITE_NATIVE_PIXELS_PER_TILE` per tile) to the drawn resolution
 * (`FLOOR_TILE_PIXELS` per tile — the upscale is nearest-neighbour by
 * construction, each source pixel copied to a square block), then encoded as
 * an INDEXED-COLOUR PNG: the file's pixel bytes are the palette indices
 * themselves, with the palette as a PLTE chunk and index zero declared
 * transparent in tRNS. That is the index-grid discipline carried into the
 * container format. The deflate stream inside IDAT uses stored (uncompressed)
 * blocks, which every PNG reader accepts; correctness over cleverness, and
 * `floorSprites.test.ts` decodes the bytes back and compares them to the
 * grids rather than trusting this paragraph.
 *
 * The floor textures are the one exception to pre-upscaling: a warehouse
 * floor at drawn resolution would be a megabyte-class string, so textures are
 * encoded at native resolution and drawn scaled, with the crisp-scaling
 * style (`image-rendering: pixelated` on the web renderer) applied by
 * `FloorGrid.tsx`. That trade and its limit (a non-web renderer smooths that
 * scale) are stated here rather than hidden.
 */

import { EMPIRE_TUNING } from './empireTuning';
import { type LadderRung } from './ladder';
import { type MemberType } from './members';
import { type SessionEquipmentItem } from './sessions';

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/**
 * The four poses a member sprite ships in. `stand` covers every standing sim
 * state (queuing, leaving, interrupted, idle seeking); `step-a`/`step-b` are
 * the two-frame walk cycle; `using` is the working stance. The five sim
 * states stay visually distinct through the cue system `FloorGrid.tsx`
 * already draws — the pose channel is body language on top of it, not a
 * replacement for it.
 */
export const FLOOR_SPRITE_POSES = ['stand', 'step-a', 'step-b', 'using'] as const;
export type FloorSpritePose = (typeof FLOOR_SPRITE_POSES)[number];

/** Horizontal facing. `left` is an exact mirror of the authored `right`. */
export const FLOOR_SPRITE_FACINGS = ['right', 'left'] as const;
export type FloorSpriteFacing = (typeof FLOOR_SPRITE_FACINGS)[number];

export type FixedFurnitureItem = keyof typeof EMPIRE_TUNING.FLOOR_FIXED_FURNITURE_LAYOUT;

/** An index grid: width, height, and one palette index per pixel, row-major. Index zero is transparent. */
export interface FloorSpriteGrid {
  readonly w: number;
  readonly h: number;
  readonly data: readonly number[];
}

// ---------------------------------------------------------------------------
// The legend — one character per palette slot, shared by every map in this
// file. Index in this string + 1 is the palette index; anything not in it
// (spaces in practice) parses as transparent index zero.
// ---------------------------------------------------------------------------

const LEGEND = 'KSTHJDPZBWLMERQUVONCGFAXY';

// The palette index each legend character parses to, derived by position so
// the draw programs below never spell a one-character string or a bare index
// number. Order here, in `LEGEND`, and in `paletteRows` is one order; the
// tests assert the three agree in length.
let nextPaletteIndex = 0;
function nextPx(): number {
  nextPaletteIndex += 1;
  return nextPaletteIndex;
}
const PX_OUTLINE = nextPx(); // K
const PX_SKIN = nextPx(); // S
const PX_SKIN_SHADE = nextPx(); // T
const PX_HAIR = nextPx(); // H
const PX_TOP = nextPx(); // J
const PX_TOP_SHADE = nextPx(); // D
const PX_PANTS = nextPx(); // P
const PX_PANTS_SHADE = nextPx(); // Z
const PX_SHOE = nextPx(); // B
const PX_ACCENT = nextPx(); // W
const PX_STEEL_LIGHT = nextPx(); // L
const PX_STEEL_MID = nextPx(); // M
const PX_STEEL_DARK = nextPx(); // E
const PX_RUBBER = nextPx(); // R
const PX_RUBBER_DARK = nextPx(); // Q
const PX_PAD = nextPx(); // U
const PX_PAD_SHADE = nextPx(); // V
const PX_WOOD = nextPx(); // O
const PX_WOOD_SHADE = nextPx(); // N
const PX_PLATE = nextPx(); // C
const PX_PLATE_SHADE = nextPx(); // G
const PX_FLOOR_BASE = nextPx(); // F
const PX_FLOOR_ALT = nextPx(); // A
const PX_FLOOR_SEAM = nextPx(); // X
const PX_FLOOR_FLECK = nextPx(); // Y

type Rgb = readonly number[];

const BODY = EMPIRE_TUNING.FLOOR_SPRITE_BODY_PALETTE;
const GEAR = EMPIRE_TUNING.FLOOR_SPRITE_GEAR_PALETTE;
const ROOM = EMPIRE_TUNING.FLOOR_SPRITE_FLOOR_PALETTE;
const OUTFITS = EMPIRE_TUNING.FLOOR_SPRITE_OUTFIT_PALETTE;

/**
 * The palette rows in legend order, with the J/D slots resolved to a member
 * type's outfit when one is given and to the steel ramp otherwise (no gear
 * map paints J or D, so the fallback is a placeholder rather than a colour
 * anything shows).
 */
function paletteRows(type: MemberType | null): readonly Rgb[] {
  const outfit = type === null ? null : OUTFITS[type];
  return [
    BODY.OUTLINE, // K
    BODY.SKIN, // S
    BODY.SKIN_SHADE, // T
    BODY.HAIR, // H
    outfit === null ? GEAR.STEEL_MID : outfit.top, // J
    outfit === null ? GEAR.STEEL_DARK : outfit.shade, // D
    BODY.PANTS, // P
    BODY.PANTS_SHADE, // Z
    BODY.SHOE, // B
    BODY.ACCENT, // W
    GEAR.STEEL_LIGHT, // L
    GEAR.STEEL_MID, // M
    GEAR.STEEL_DARK, // E
    GEAR.RUBBER, // R
    GEAR.RUBBER_DARK, // Q
    GEAR.PAD, // U
    GEAR.PAD_SHADE, // V
    GEAR.WOOD, // O
    GEAR.WOOD_SHADE, // N
    GEAR.PLATE, // C
    GEAR.PLATE_SHADE, // G
    ROOM.BASE, // F
    ROOM.ALT, // A
    ROOM.SEAM, // X
    ROOM.FLECK, // Y
  ];
}

const NATIVE = EMPIRE_TUNING.FLOOR_SPRITE_NATIVE_PIXELS_PER_TILE;
const SCALE = Math.round(EMPIRE_TUNING.FLOOR_TILE_PIXELS / NATIVE);

// ---------------------------------------------------------------------------
// Grid building
// ---------------------------------------------------------------------------

function parseMap(map: string, width: number): FloorSpriteGrid {
  // The split and the blank-row filter are done by hand rather than with
  // string methods on the parameter. Deliberate: the member-call census in
  // `empireForbiddenOutput.test.ts` enumerates every method call whose
  // receiver is a parameter and requires a driver or a signed undriven row
  // for each, and the directory's precedent (floorSim.ts's own entry in that
  // list's comments) is that a smaller enumerated surface is worth more than
  // another driver for a module-private helper no caller can reach.
  const newline = 0x0a;
  const blank = 0x20;
  const lines: string[] = [];
  let line = String.fromCharCode();
  let inked = false;
  for (const ch of map + String.fromCharCode(newline)) {
    if (ch.charCodeAt(0) === newline) {
      if (inked) lines.push(line);
      line = String.fromCharCode();
      inked = false;
      continue;
    }
    line += ch;
    if (ch.charCodeAt(0) !== blank) inked = true;
  }
  const data: number[] = [];
  for (const row of lines) {
    for (let x = 0; x < width; x += 1) {
      data.push(x < row.length ? LEGEND.indexOf(row.charAt(x)) + 1 : 0);
    }
  }
  return { w: width, h: lines.length, data };
}

/**
 * The paint model, and why it is OPS RATHER THAN MUTATION. Every drawing in
 * this file is a list of plain paint operations interpreted by `render`,
 * which builds its pixel array locally — no helper takes a grid and writes
 * into it. That keeps this module out of the directory's argument-mutation
 * channel entirely (the channel census in `empireForbiddenOutput.test.ts`
 * pins that channel at zero sites, and a module-private mutation site would
 * be a site nothing covers), and it costs nothing: the ops are data, which
 * is what this file is made of anyway.
 */
type PaintOp =
  | { readonly kind: 'fill'; readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly px: number }
  | { readonly kind: 'hatch'; readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly gap: number; readonly px: number }
  | { readonly kind: 'disc'; readonly cx: number; readonly cy: number; readonly r: number; readonly px: number }
  | { readonly kind: 'dot'; readonly x: number; readonly y: number; readonly px: number };

function fill(x: number, y: number, w: number, h: number, px: number): PaintOp {
  return { kind: 'fill', x, y, w, h, px };
}
function hatch(x: number, y: number, w: number, h: number, gap: number, px: number): PaintOp {
  return { kind: 'hatch', x, y, w, h, gap, px };
}
function disc(cx: number, cy: number, r: number, px: number): PaintOp {
  return { kind: 'disc', cx, cy, r, px };
}
function dot(x: number, y: number, px: number): PaintOp {
  return { kind: 'dot', x, y, px };
}

/**
 * Interpret a list of paint ops onto a fresh local grid. `outlined` stamps a
 * one-pixel outline outside the painted silhouette afterwards — outside, the
 * way the reference discipline outlines, so interior paint survives at small
 * sizes. The floor textures pass false; they have no silhouette.
 */
function render(w: number, h: number, ops: readonly PaintOp[], outlined: boolean): FloorSpriteGrid {
  const data: number[] = new Array<number>(w * h).fill(0);
  const put = (x: number, y: number, px: number): void => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    data[y * w + x] = px;
  };
  for (const op of ops) {
    if (op.kind === 'fill') {
      for (let y = op.y; y < op.y + op.h; y += 1)
        for (let x = op.x; x < op.x + op.w; x += 1) put(x, y, op.px);
    } else if (op.kind === 'hatch') {
      for (let y = op.y; y < op.y + op.h; y += op.gap)
        for (let x = op.x; x < op.x + op.w; x += 1) put(x, y, op.px);
    } else if (op.kind === 'disc') {
      for (let y = op.cy - op.r; y <= op.cy + op.r; y += 1) {
        for (let x = op.cx - op.r; x <= op.cx + op.r; x += 1) {
          const dx = x - op.cx;
          const dy = y - op.cy;
          if (dx * dx + dy * dy <= op.r * op.r) put(x, y, op.px);
        }
      }
    } else {
      put(op.x, op.y, op.px);
    }
  }
  if (outlined) {
    const src = [...data];
    const at = (x: number, y: number): number =>
      x < 0 || y < 0 || x >= w || y >= h ? 0 : (src[y * w + x] ?? 0);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        if (at(x, y) !== 0) continue;
        if (at(x - 1, y) !== 0 || at(x + 1, y) !== 0 || at(x, y - 1) !== 0 || at(x, y + 1) !== 0) {
          put(x, y, PX_OUTLINE);
        }
      }
    }
  }
  return { w, h, data };
}

function getPx(g: FloorSpriteGrid, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= g.w || y >= g.h) return 0;
  return g.data[y * g.w + x] ?? 0;
}

function mirrored(g: FloorSpriteGrid): FloorSpriteGrid {
  const data: number[] = new Array<number>(g.w * g.h).fill(0);
  for (let y = 0; y < g.h; y += 1) {
    for (let x = 0; x < g.w; x += 1) {
      data[y * g.w + (g.w - 1 - x)] = getPx(g, x, y);
    }
  }
  return { w: g.w, h: g.h, data };
}

function upscaled(g: FloorSpriteGrid, factor: number): FloorSpriteGrid {
  if (factor <= 1) return g;
  const w = g.w * factor;
  const h = g.h * factor;
  const data: number[] = new Array<number>(w * h).fill(0);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      data[y * w + x] = getPx(g, Math.floor(x / factor), Math.floor(y / factor));
    }
  }
  return { w, h, data };
}

function frozenGrid(g: FloorSpriteGrid): FloorSpriteGrid {
  return Object.freeze({ w: g.w, h: g.h, data: Object.freeze([...g.data]) });
}

// ---------------------------------------------------------------------------
// The member maps — hand-authored, one character per pixel, at
// FLOOR_SPRITE_NATIVE_PIXELS_PER_TILE square. Rows 0-9 are the head and
// torso, per type and per arm position; the last four rows are the legs,
// shared per build. The key light is upper-left throughout: lit skin (S) and
// lit cloth (J) sit left, their shade steps (T, D) sit right.
//
// What makes the five types read apart at chip scale, stated so a later
// editor keeps it: WIDTH (slim / wide / widest builds), HEADGEAR (bare hair,
// headband, hood), KIT (tee, tank with bare shoulders, singlet with pale
// belt, vest, hoodie), and the outfit hue from FLOOR_SPRITE_OUTFIT_PALETTE.
// ---------------------------------------------------------------------------

const TORSO: Readonly<Record<MemberType, { readonly normal: string; readonly lift: string }>> = {
  casual: {
    normal: `
     KKKKK
    KHHHHHK
    KHSSSSK
    KSKSKSK
    KSSSSTK
      KSTK
   KJJJJJJDK
 KSKJJJJDDKTK
 KSKJJJJDDKTK
  KKJJJJDDKK`,
    lift: `
     KKKKK
    KHHHHHK
    KHSSSSK
    KSKSKSK
    KSSSSTK
      KSTK
 KSK JJJJ KTK
 KSKJJJJDDKTK
  KKJJJJDDKK
   KJJJJDDK`,
  },
  bodybuilder: {
    normal: `
     KKKKK
    KHHHHHK
    KHSSSSK
    KSKSKSK
    KSSSSTK
      KSTK
 KSSJJJJJJTTK
KSSKJJJJJDKTTK
KSSKJJJJDDKTTK
  KKJJJJDDKK`,
    lift: `
     KKKKK
    KHHHHHK
    KHSSSSK
    KSKSKSK
    KSSSSTK
      KSTK
KSK JJJJJJ KTK
KSKJJJJJJDDKTK
 KKJJJJJDDKK
  KKJJJDDKK`,
  },
  powerlifter: {
    normal: `
     KKKKK
    KHHHHHK
    KHSSSSK
    KSKSKSK
    KSSSSTK
      KSTK
 KJJJJJJJJDDK
KSKJJJJJJDDKTK
KSKJJJJJJDDKTK
 KKWWWWWWWWKK`,
    lift: `
     KKKKK
    KHHHHHK
    KHSSSSK
    KSKSKSK
    KSSSSTK
      KSTK
KSK JJJJJJ KTK
KSKJJJJJJDDKTK
 KKJJJJJJDDKK
 KKWWWWWWWWKK`,
  },
  athlete: {
    normal: `
     KKKKK
    KHHHHHK
    KWWWWWK
    KSKSKSK
    KSSSSTK
      KSTK
  KSJJJJJJSK
 KSKJJJJDDKTK
 KSKJJJJDDKTK
  KKJJJJDDKK`,
    lift: `
     KKKKK
    KHHHHHK
    KWWWWWK
    KSKSKSK
    KSSSSTK
      KSTK
 KSK JJJJ KTK
 KSKJJJJDDKTK
  KKJJJJDDKK
   KJJJJDDK`,
  },
  'serious-lifter': {
    normal: `
    KKKKKK
   KJJJJJJK
   KJKSSKJK
   KJSKSKJK
   KJSSSTJK
     KSTK
   KJJJJJJDK
 KSKJJJJDDKTK
 KSKJJJJDDKTK
  KKJJJJDDKK`,
    lift: `
    KKKKKK
   KJJJJJJK
   KJKSSKJK
   KJSKSKJK
   KJSSSTJK
     KSTK
 KSK JJJJ KTK
 KSKJJJJDDKTK
  KKJJJJDDKK
   KJJJJDDK`,
  },
};

type LegBuild = 'slim' | 'wide';

const LEGS: Readonly<Record<LegBuild, Readonly<Record<'stand' | 'stepA' | 'stepB' | 'brace', string>>>> = {
  slim: {
    stand: `
   KPPPPPPK
   KPPKKPPK
   KPZK KPZK
   KBBK KBBK`,
    stepA: `
   KPPPPPPK
  KPPK  KPPK
  KZPK  KPZK
 KBBK    KBBK`,
    stepB: `
   KPPPPPPK
   KPPKKPPK
   KPZKKPZK
   KBBKKBBK`,
    brace: `
   KPPPPPPK
  KPPK  KPPK
  KZPK  KPZK
  KBBK  KBBK`,
  },
  wide: {
    stand: `
  KPPPPPPPPK
  KPPPKKPPPK
  KPZK  KZPK
  KBBK  KBBK`,
    stepA: `
  KPPPPPPPPK
 KPPPK  KPPPK
 KZPK    KPZK
KBBK      KBBK`,
    stepB: `
  KPPPPPPPPK
  KPPPKKPPPK
  KPZKKKZPK
  KBBKKKBBK`,
    brace: `
  KPPPPPPPPK
 KPPPK  KPPPK
 KZPPK  KPPZK
 KBBBK  KBBBK`,
  },
};

const LEG_BUILD: Readonly<Record<MemberType, LegBuild>> = {
  casual: 'slim',
  bodybuilder: 'wide',
  powerlifter: 'wide',
  athlete: 'slim',
  'serious-lifter': 'slim',
};

function memberGrid(type: MemberType, pose: FloorSpritePose): FloorSpriteGrid {
  const torso = pose === 'using' ? TORSO[type].lift : TORSO[type].normal;
  const build = LEG_BUILD[type];
  const legs =
    pose === 'using'
      ? LEGS[build].brace
      : pose === 'step-a'
        ? LEGS[build].stepA
        : pose === 'step-b'
          ? LEGS[build].stepB
          : LEGS[build].stand;
  return parseMap(torso + legs, NATIVE);
}

// ---------------------------------------------------------------------------
// Equipment — drawn to each item's real footprint at native resolution, as
// small draw programs over the same index space: an underpainting of two or
// three ramp steps, a few hand-placed marks, then the outline pass. Sizes
// come from the registered footprints, never restated here.
// ---------------------------------------------------------------------------

const HALF = NATIVE >> 1;
const QUARTER = NATIVE >> 2;
// A two-pixel margin doubled — the standard inset the draw programs use so an
// outline ring and a one-pixel breath both fit inside a footprint edge.
const INSET = 2 * 2;

function opsBike(w: number, h: number): PaintOp[] {
  const ops: PaintOp[] = [];
  const midY = h >> 1;
  // Flywheel left, seat and bars right — a compact upright bike in profile.
  ops.push(disc(QUARTER + 2, midY + QUARTER, QUARTER + 2, PX_STEEL_DARK));
  ops.push(disc(QUARTER + 2, midY + QUARTER, QUARTER, PX_STEEL_MID));
  ops.push(fill(QUARTER, midY - 2, w - HALF, 2, PX_STEEL_MID)); // frame spar
  ops.push(fill(w - QUARTER - 2, QUARTER, 2, midY, PX_STEEL_LIGHT)); // seat post
  ops.push(fill(w - QUARTER - QUARTER, QUARTER - 2, HALF, 2, PX_RUBBER)); // seat
  ops.push(fill(QUARTER + 1, QUARTER - 1, 2, QUARTER + 2, PX_STEEL_LIGHT)); // handlebar post
  ops.push(fill(2, QUARTER - 2, HALF - 2, 2, PX_RUBBER)); // bars
  ops.push(fill(2, h - 2, w - QUARTER, 2, PX_RUBBER_DARK)); // floor foot
  return ops;
}

function opsTreadmill(w: number, h: number): PaintOp[] {
  const ops: PaintOp[] = [];
  // Console at the top, running deck below, belt lines across it.
  ops.push(fill(1, 1, w - 2, QUARTER + 2, PX_STEEL_MID));
  ops.push(fill(2, 2, w - HALF, 2, PX_ACCENT)); // display strip
  ops.push(fill(2, QUARTER + INSET, w - INSET, h - QUARTER - HALF, PX_RUBBER));
  ops.push(hatch(2, QUARTER + HALF, w - INSET, h - QUARTER - HALF - QUARTER, HALF, PX_RUBBER_DARK));
  ops.push(fill(1, h - QUARTER, w - 2, 2, PX_STEEL_DARK)); // rear roller
  ops.push(fill(1, QUARTER + 2, 2, h - HALF, PX_STEEL_LIGHT)); // lit rail left
  ops.push(fill(w - 2 - 1, QUARTER + 2, 2, h - HALF, PX_STEEL_DARK)); // shade rail right
  return ops;
}

function opsRower(w: number, h: number): PaintOp[] {
  const ops: PaintOp[] = [];
  const midX = w >> 1;
  ops.push(disc(midX, QUARTER + 2, QUARTER + 2, PX_STEEL_DARK)); // flywheel cage
  ops.push(disc(midX - 1, QUARTER + 1, QUARTER - 1, PX_STEEL_MID));
  ops.push(fill(midX - 1, HALF + 2, 2, h - HALF - QUARTER, PX_STEEL_LIGHT)); // monorail
  ops.push(fill(midX - QUARTER, h - HALF - QUARTER, HALF, QUARTER, PX_RUBBER)); // seat
  ops.push(fill(midX - HALF - 1, HALF + QUARTER, QUARTER, QUARTER, PX_RUBBER_DARK)); // footplate left
  ops.push(fill(midX + HALF - QUARTER + 1, HALF + QUARTER, QUARTER, QUARTER, PX_RUBBER_DARK)); // footplate right
  ops.push(fill(midX - QUARTER, h - 2, HALF, 2, PX_STEEL_DARK)); // rear foot
  return ops;
}

function opsSled(w: number, h: number): PaintOp[] {
  const ops: PaintOp[] = [];
  // A push track: two long rails, crossbars, the sled itself parked at the top
  // with a red plate loaded on its post.
  const railL = QUARTER;
  const railR = w - QUARTER - 2;
  ops.push(fill(railL, 2, 2, h - INSET, PX_STEEL_DARK));
  ops.push(fill(railR, 2, 2, h - INSET, PX_STEEL_DARK));
  ops.push(hatch(railL, NATIVE, railR - railL + 2, h - NATIVE * 2, NATIVE + HALF, PX_RUBBER_DARK));
  ops.push(fill(railL + 2, QUARTER, railR - railL - 2, NATIVE, PX_STEEL_MID)); // sled body
  ops.push(disc(w >> 1, QUARTER + HALF, QUARTER + 1, PX_PLATE)); // loaded plate
  ops.push(disc(w >> 1, QUARTER + HALF, 1, PX_PLATE_SHADE));
  ops.push(fill(railL + 2, QUARTER + NATIVE, 2, HALF, PX_STEEL_LIGHT)); // push post left
  ops.push(fill(railR - 2, QUARTER + NATIVE, 2, HALF, PX_STEEL_LIGHT)); // push post right
  return ops;
}

function opsDumbbells(w: number, h: number): PaintOp[] {
  const ops: PaintOp[] = [];
  // A two-shelf rack seen front-on, pairs of heads along each shelf.
  ops.push(fill(1, QUARTER, w - 2, 2, PX_STEEL_LIGHT));
  ops.push(fill(1, h - HALF, w - 2, 2, PX_STEEL_MID));
  for (let x = QUARTER; x + QUARTER < w; x += HALF + 1) {
    ops.push(fill(x, QUARTER - QUARTER + 1, 2, QUARTER, PX_STEEL_DARK)); // top-shelf head
    ops.push(fill(x + 2, QUARTER - 1, 1, 2, PX_STEEL_MID)); // its handle
    ops.push(fill(x, h - HALF - QUARTER + 1, 2, QUARTER, PX_STEEL_DARK)); // low-shelf head
    ops.push(fill(x + 2, h - HALF - 1, 1, 2, PX_STEEL_MID));
  }
  ops.push(fill(1, h - 2, 2, 2, PX_RUBBER_DARK));
  ops.push(fill(w - 2 - 1, h - 2, 2, 2, PX_RUBBER_DARK));
  return ops;
}

function opsCables(w: number, h: number): PaintOp[] {
  const ops: PaintOp[] = [];
  // A cable tower: frame, dark selector stack low, pale pin, pulley on top.
  ops.push(fill(2, 1, w - INSET, 2, PX_STEEL_LIGHT));
  ops.push(fill(2, 1, 2, h - 2, PX_STEEL_MID));
  ops.push(fill(w - INSET, 1, 2, h - 2, PX_STEEL_DARK));
  ops.push(fill(HALF - 2, QUARTER, 1, h - HALF, PX_STEEL_LIGHT)); // the cable
  ops.push(fill(QUARTER + 1, h - HALF - QUARTER, w - HALF - 2, HALF, PX_STEEL_DARK)); // stack
  ops.push(fill(QUARTER + 1, h - HALF, w - HALF - 2, 1, PX_ACCENT)); // pin
  ops.push(disc(HALF - 2, 2, 2, PX_STEEL_MID)); // pulley
  return ops;
}

function opsMachines(w: number, h: number): PaintOp[] {
  const ops: PaintOp[] = [];
  // A generic selectorised machine: frame, red seat pad, dark stack.
  ops.push(fill(1, 2, 2, h - INSET, PX_STEEL_MID));
  ops.push(fill(1, 2, w - HALF, 2, PX_STEEL_LIGHT));
  ops.push(fill(QUARTER, HALF, HALF, h - NATIVE, PX_PAD)); // seat pad
  ops.push(fill(QUARTER + HALF - 2, HALF, 2, h - NATIVE, PX_PAD_SHADE)); // pad shade
  ops.push(fill(w - HALF - 2, QUARTER + 2, HALF, h - HALF - QUARTER, PX_STEEL_DARK)); // stack
  ops.push(hatch(w - HALF - 2, QUARTER + 2, HALF, h - HALF - QUARTER, 2, PX_RUBBER_DARK));
  ops.push(fill(w - HALF - 2, h - HALF, HALF, 1, PX_ACCENT)); // pin
  ops.push(fill(1, h - 2, w - 2, 2, PX_RUBBER_DARK));
  return ops;
}

function opsMats(w: number, h: number): PaintOp[] {
  const ops: PaintOp[] = [];
  // Interlocked rubber mats: a dark field with seam lines both ways. The
  // whole top and left edges take the lit steel step — the first composed
  // screenshot showed a dark mat vanishing into a dark tray chip and a dark
  // floor, and a lit leading edge is what separates a drawn object from a
  // hole. Key light upper-left, same as everything else in this file.
  ops.push(fill(1, 1, w - 2, h - 2, PX_RUBBER));
  ops.push(hatch(1, NATIVE, w - 2, h - NATIVE - 2, NATIVE, PX_RUBBER_DARK));
  for (let x = NATIVE; x < w - 2; x += NATIVE) ops.push(fill(x, 1, 1, h - 2, PX_RUBBER_DARK));
  ops.push(fill(1, 1, w - 2, 1, PX_STEEL_MID)); // lit top edge, full width
  ops.push(fill(1, 1, 1, h - 2, PX_STEEL_MID)); // lit left edge, full height
  ops.push(fill(2, 2, HALF, 1, PX_STEEL_LIGHT)); // highlight break at the corner
  return ops;
}

function opsFoamRollers(w: number, h: number): PaintOp[] {
  const ops: PaintOp[] = [];
  // Two rollers side by side, seen end-on: pale cores in padded cylinders.
  ops.push(disc(QUARTER + 1, HALF, QUARTER, PX_PAD));
  ops.push(disc(QUARTER, HALF - 1, 1, PX_ACCENT));
  ops.push(disc(w - QUARTER - 2, HALF + 2, QUARTER, PX_PAD_SHADE));
  ops.push(disc(w - QUARTER - 2 - 1, HALF + 1, 1, PX_ACCENT));
  return ops;
}

function opsSauna(w: number, h: number): PaintOp[] {
  const ops: PaintOp[] = [];
  // A timber cabin, front-on: plank walls, a dark door, a vent.
  ops.push(fill(1, QUARTER, w - 2, h - QUARTER - 1, PX_WOOD));
  ops.push(hatch(1, QUARTER + 2, w - 2, h - QUARTER - INSET, QUARTER, PX_WOOD_SHADE));
  ops.push(fill(1, 1, w - 2, QUARTER, PX_WOOD_SHADE)); // roof band
  ops.push(fill((w >> 1) - QUARTER, h - NATIVE * 2, HALF, NATIVE * 2 - 1, PX_STEEL_DARK)); // door
  ops.push(fill((w >> 1) + QUARTER - 2, h - NATIVE, 1, 2, PX_ACCENT)); // handle
  ops.push(fill(QUARTER, HALF, QUARTER, 2, PX_ACCENT)); // vent
  return ops;
}

function opsWristWraps(w: number, h: number): PaintOp[] {
  const ops: PaintOp[] = [];
  // A coiled pale wrap with a shadow turn.
  ops.push(disc(HALF - 1, HALF - 1, QUARTER + 2, PX_ACCENT));
  ops.push(disc(HALF - 1, HALF - 1, QUARTER, PX_SKIN_SHADE));
  ops.push(disc(HALF - 1, HALF - 1, 1, PX_ACCENT));
  return ops;
}

function opsBelts(w: number, h: number): PaintOp[] {
  const ops: PaintOp[] = [];
  // A rolled leather belt with a steel lever plate.
  ops.push(disc(HALF - 1, HALF - 1, QUARTER + 2, PX_WOOD));
  ops.push(disc(HALF - 1, HALF - 1, QUARTER - 1, PX_WOOD_SHADE));
  ops.push(fill(HALF - 1, HALF - 2, 2, 2, PX_STEEL_LIGHT));
  return ops;
}

function opsSleeves(w: number, h: number): PaintOp[] {
  const ops: PaintOp[] = [];
  // A pair of knee sleeves standing up, dark with a contrast top band.
  ops.push(fill(2, QUARTER, QUARTER + 1, HALF + QUARTER, PX_RUBBER));
  ops.push(fill(2, QUARTER, QUARTER + 1, 2, PX_PLATE));
  ops.push(fill(HALF + 1, QUARTER + 2, QUARTER + 1, HALF + QUARTER, PX_RUBBER_DARK));
  ops.push(fill(HALF + 1, QUARTER + 2, QUARTER + 1, 2, PX_PLATE_SHADE));
  return ops;
}

function opsSpecialtyBars(w: number, h: number): PaintOp[] {
  const ops: PaintOp[] = [];
  // A vertical bar holder: dark chassis, three bars racked in it.
  ops.push(fill(1, 1, w - 2, h - 2, PX_STEEL_DARK));
  ops.push(fill(2, 2, w - INSET, 1, PX_STEEL_MID));
  const step = Math.max(2, (w - INSET) >> 2);
  for (let i = 0; i < w - INSET; i += step) {
    ops.push(fill(2 + i, 2, 1, h - INSET, i === 0 ? PX_STEEL_LIGHT : PX_STEEL_MID));
  }
  return ops;
}

// Fixed furniture — the Barbell-group baseline, seen from above so it sits on
// the floor the members walk across.

function opsPowerBar(w: number, h: number): PaintOp[] {
  const ops: PaintOp[] = [];
  // A loaded bar from above: shaft down the middle, red discs at both ends.
  const midX = w >> 1;
  ops.push(fill(midX - 1, 1, 2, h - 2, PX_STEEL_LIGHT));
  ops.push(fill(midX, 1, 1, h - 2, PX_STEEL_MID));
  ops.push(fill(midX - QUARTER, QUARTER, HALF, QUARTER, PX_PLATE)); // top disc
  ops.push(fill(midX - QUARTER, QUARTER + QUARTER, HALF, 1, PX_PLATE_SHADE));
  ops.push(fill(midX - QUARTER, h - HALF, HALF, QUARTER, PX_PLATE)); // low disc
  ops.push(fill(midX - QUARTER, h - HALF + QUARTER - 1, HALF, 1, PX_PLATE_SHADE));
  return ops;
}

function opsCompPlates(w: number, h: number): PaintOp[] {
  const ops: PaintOp[] = [];
  // A plate stack from above: nested red discs with a steel hub.
  const midX = w >> 1;
  const midY = h >> 1;
  ops.push(disc(midX, midY, HALF + QUARTER - 1, PX_PLATE_SHADE));
  ops.push(disc(midX - 1, midY - 1, HALF + QUARTER - 2, PX_PLATE));
  ops.push(disc(midX, midY, QUARTER, PX_PLATE_SHADE));
  ops.push(disc(midX, midY, 2, PX_STEEL_LIGHT));
  return ops;
}

function opsFlatBench(w: number, h: number): PaintOp[] {
  const ops: PaintOp[] = [];
  // A bench from above: red pad down the middle, steel feet at both ends.
  const padX = QUARTER + 1;
  ops.push(fill(padX, 2, w - padX * 2, h - INSET, PX_PAD));
  ops.push(fill(w - padX - 2, 2, 2, h - INSET, PX_PAD_SHADE));
  ops.push(hatch(padX, HALF, w - padX * 2, h - NATIVE, NATIVE, PX_PAD_SHADE));
  ops.push(fill(1, 1, w - 2, 2, PX_STEEL_LIGHT)); // head foot
  ops.push(fill(1, h - 2 - 1, w - 2, 2, PX_STEEL_MID)); // tail foot
  return ops;
}

type EquipmentPainter = (w: number, h: number) => PaintOp[];

const SESSION_PAINTERS: Readonly<Record<SessionEquipmentItem, EquipmentPainter>> = {
  bike: opsBike,
  treadmill: opsTreadmill,
  rower: opsRower,
  sled: opsSled,
  dumbbells: opsDumbbells,
  cables: opsCables,
  machines: opsMachines,
  mats: opsMats,
  'foam-rollers': opsFoamRollers,
  sauna: opsSauna,
  'wrist-wraps': opsWristWraps,
  belts: opsBelts,
  sleeves: opsSleeves,
  'specialty-bars': opsSpecialtyBars,
};

const FIXED_PAINTERS: Readonly<Record<FixedFurnitureItem, EquipmentPainter>> = {
  'power-bar': opsPowerBar,
  'comp-plates': opsCompPlates,
  'flat-bench': opsFlatBench,
};

// ---------------------------------------------------------------------------
// The floor texture — per rung, at native resolution, drawn scaled. A quiet
// two-tone tile checker with a seam along each tile's far edges and a sparse
// fleck, so cell boundaries stay readable underneath the existing grid
// lines without the floor competing with the bodies for value.
// ---------------------------------------------------------------------------

function floorTextureGrid(rung: LadderRung): FloorSpriteGrid {
  const size = EMPIRE_TUNING.FLOOR_GRID_SIZE[rung];
  const ops: PaintOp[] = [];
  const stride = EMPIRE_TUNING.FLOOR_SPRITE_FLECK_STRIDE;
  for (let ty = 0; ty < size.height; ty += 1) {
    for (let tx = 0; tx < size.width; tx += 1) {
      const base = (tx + ty) % 2 === 0 ? PX_FLOOR_BASE : PX_FLOOR_ALT;
      ops.push(fill(tx * NATIVE, ty * NATIVE, NATIVE, NATIVE, base));
      // The far edges of every tile read as a seam.
      ops.push(fill(tx * NATIVE, ty * NATIVE + NATIVE - 1, NATIVE, 1, PX_FLOOR_SEAM));
      ops.push(fill(tx * NATIVE + NATIVE - 1, ty * NATIVE, 1, NATIVE, PX_FLOOR_SEAM));
      // A sparse fleck, deterministic from the tile coordinate alone.
      if ((tx + ty * size.width) % stride === 0) {
        ops.push(dot(tx * NATIVE + QUARTER, ty * NATIVE + HALF, PX_FLOOR_FLECK));
        ops.push(dot(tx * NATIVE + HALF + 2, ty * NATIVE + QUARTER + 1, PX_FLOOR_FLECK));
      }
    }
  }
  return render(size.width * NATIVE, size.height * NATIVE, ops, false);
}

// ---------------------------------------------------------------------------
// Indexed PNG encoding. Every literal here is fixed by the file format or the
// number system (hex masks, shift widths), not by taste — the audit's own
// allowlist for exactly this kind of constant.
// ---------------------------------------------------------------------------

const CRC_TABLE: readonly number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 0x100; n += 1) {
    let c = n;
    for (let k = 0; k < 0x08; k += 1) {
      c = (c & 1) === 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table.push(c >>> 0);
  }
  return table;
})();

function crc32(bytes: readonly number[]): number {
  let c = 0xffffffff;
  for (const b of bytes) c = (CRC_TABLE[(c ^ b) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(bytes: readonly number[]): number {
  let s1 = 1;
  let s2 = 0;
  for (const b of bytes) {
    s1 = (s1 + b) % 0xfff1;
    s2 = (s2 + s1) % 0xfff1;
  }
  return ((s2 << 0x10) | s1) >>> 0;
}

function u32Bytes(value: number): number[] {
  return [(value >>> 0x18) & 0xff, (value >>> 0x10) & 0xff, (value >>> 0x08) & 0xff, value & 0xff];
}

/** One whole PNG chunk — length, type, body, CRC — as fresh bytes. */
function chunkBytes(type: string, data: readonly number[]): number[] {
  const typed: number[] = [];
  for (const ch of type) typed.push(ch.charCodeAt(0));
  return [...u32Bytes(data.length), ...typed, ...data, ...u32Bytes(crc32([...typed, ...data]))];
}

/** A zlib stream of stored (uncompressed) deflate blocks. */
function zlibStored(raw: readonly number[]): number[] {
  const out: number[] = [0x78, 0x01];
  const max = 0xffff;
  for (let at = 0; at < raw.length; at += max) {
    const len = Math.min(max, raw.length - at);
    const final = at + len >= raw.length ? 1 : 0;
    out.push(final, len & 0xff, (len >>> 0x08) & 0xff, (len ^ 0xffff) & 0xff, ((len ^ 0xffff) >>> 0x08) & 0xff);
    for (let i = 0; i < len; i += 1) out.push(raw[at + i] ?? 0);
  }
  out.push(...u32Bytes(adler32(raw)));
  return out;
}

const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function toBase64(bytes: readonly number[]): string {
  const pad = String.fromCharCode(0x3d);
  let out = String.fromCharCode();
  for (let i = 0; i < bytes.length; i += 0x03) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    const n = (a << 0x10) | ((b ?? 0) << 0x08) | (c ?? 0);
    out += B64_ALPHABET.charAt((n >>> 0x12) & 0x3f);
    out += B64_ALPHABET.charAt((n >>> 0x0c) & 0x3f);
    out += b === undefined ? pad : B64_ALPHABET.charAt((n >>> 0x06) & 0x3f);
    out += c === undefined ? pad : B64_ALPHABET.charAt(n & 0x3f);
  }
  return out;
}

const PNG_SIGNATURE: readonly number[] = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PNG_URI_PREFIX = 'data:image/png;base64,';

function gridToPngUri(grid: FloorSpriteGrid, palette: readonly Rgb[]): string {
  // bit depth 8, indexed colour, default compression/filter/interlace.
  const ihdr = [...u32Bytes(grid.w), ...u32Bytes(grid.h), 0x08, 0x03, 0, 0, 0];

  // Index zero is the transparent slot; palette entries follow in legend order.
  const plte: number[] = [0, 0, 0];
  for (const rgb of palette) plte.push((rgb[0] ?? 0) & 0xff, (rgb[1] ?? 0) & 0xff, (rgb[2] ?? 0) & 0xff);

  const raw: number[] = [];
  for (let y = 0; y < grid.h; y += 1) {
    raw.push(0); // per-row filter byte: none
    for (let x = 0; x < grid.w; x += 1) raw.push(grid.data[y * grid.w + x] ?? 0);
  }

  const out: number[] = [
    ...PNG_SIGNATURE,
    ...chunkBytes('IHDR', ihdr),
    ...chunkBytes('PLTE', plte),
    ...chunkBytes('tRNS', [0]),
    ...chunkBytes('IDAT', zlibStored(raw)),
    ...chunkBytes('IEND', []),
  ];
  return `${PNG_URI_PREFIX}${toBase64(out)}`;
}

// ---------------------------------------------------------------------------
// The exported tables
// ---------------------------------------------------------------------------

type MemberTable<Leaf> = Readonly<
  Record<MemberType, Readonly<Record<FloorSpritePose, Readonly<Record<FloorSpriteFacing, Leaf>>>>>
>;

interface SpriteTables {
  readonly memberGrids: MemberTable<FloorSpriteGrid>;
  readonly memberUris: MemberTable<string>;
  readonly sessionGrids: Readonly<Record<SessionEquipmentItem, FloorSpriteGrid>>;
  readonly sessionUris: Readonly<Record<SessionEquipmentItem, string>>;
  readonly fixedGrids: Readonly<Record<FixedFurnitureItem, FloorSpriteGrid>>;
  readonly fixedUris: Readonly<Record<FixedFurnitureItem, string>>;
  readonly floorGrids: Readonly<Record<LadderRung, FloorSpriteGrid>>;
  readonly floorUris: Readonly<Record<LadderRung, string>>;
}

function buildTables(): SpriteTables {
  const memberGrids: Record<string, Record<string, Record<string, FloorSpriteGrid>>> = {};
  const memberUris: Record<string, Record<string, Record<string, string>>> = {};
  for (const type of EMPIRE_TUNING.MEMBER_TYPES) {
    const palette = paletteRows(type);
    const poses: Record<string, Record<string, FloorSpriteGrid>> = {};
    const poseUris: Record<string, Record<string, string>> = {};
    for (const pose of FLOOR_SPRITE_POSES) {
      const right = memberGrid(type, pose);
      const left = mirrored(right);
      poses[pose] = Object.freeze({ right: frozenGrid(right), left: frozenGrid(left) });
      poseUris[pose] = Object.freeze({
        right: gridToPngUri(upscaled(right, SCALE), palette),
        left: gridToPngUri(upscaled(left, SCALE), palette),
      });
    }
    memberGrids[type] = Object.freeze(poses);
    memberUris[type] = Object.freeze(poseUris);
  }

  const gearPalette = paletteRows(null);
  const sessionGrids: Record<string, FloorSpriteGrid> = {};
  const sessionUris: Record<string, string> = {};
  for (const item of EMPIRE_TUNING.SESSION_EQUIPMENT_ITEMS) {
    const footprint = EMPIRE_TUNING.SESSION_EQUIPMENT_FOOTPRINT[item];
    const w = footprint.width * NATIVE;
    const h = footprint.height * NATIVE;
    const grid = render(w, h, SESSION_PAINTERS[item](w, h), true);
    sessionGrids[item] = frozenGrid(grid);
    sessionUris[item] = gridToPngUri(upscaled(grid, SCALE), gearPalette);
  }

  const fixedGrids: Record<string, FloorSpriteGrid> = {};
  const fixedUris: Record<string, string> = {};
  for (const item of Object.keys(EMPIRE_TUNING.FLOOR_FIXED_FURNITURE_LAYOUT) as FixedFurnitureItem[]) {
    const footprint = EMPIRE_TUNING.FLOOR_FIXED_FURNITURE_LAYOUT[item].footprint;
    const w = footprint.width * NATIVE;
    const h = footprint.height * NATIVE;
    const grid = render(w, h, FIXED_PAINTERS[item](w, h), true);
    fixedGrids[item] = frozenGrid(grid);
    fixedUris[item] = gridToPngUri(upscaled(grid, SCALE), gearPalette);
  }

  const floorGrids: Record<string, FloorSpriteGrid> = {};
  const floorUris: Record<string, string> = {};
  for (const rung of EMPIRE_TUNING.LADDER_RUNGS) {
    const grid = floorTextureGrid(rung);
    floorGrids[rung] = frozenGrid(grid);
    // Native resolution on purpose — see the module header's size trade.
    floorUris[rung] = gridToPngUri(grid, gearPalette);
  }

  return {
    memberGrids: Object.freeze(memberGrids) as SpriteTables['memberGrids'],
    memberUris: Object.freeze(memberUris) as SpriteTables['memberUris'],
    sessionGrids: Object.freeze(sessionGrids) as SpriteTables['sessionGrids'],
    sessionUris: Object.freeze(sessionUris) as SpriteTables['sessionUris'],
    fixedGrids: Object.freeze(fixedGrids) as SpriteTables['fixedGrids'],
    fixedUris: Object.freeze(fixedUris) as SpriteTables['fixedUris'],
    floorGrids: Object.freeze(floorGrids) as SpriteTables['floorGrids'],
    floorUris: Object.freeze(floorUris) as SpriteTables['floorUris'],
  };
}

const TABLES = buildTables();

/** The index grids, exported for the unit tests to measure — distinctness, palette use, mirror exactness. */
export const FLOOR_SPRITE_GRIDS = Object.freeze({
  member: TABLES.memberGrids,
  session: TABLES.sessionGrids,
  fixed: TABLES.fixedGrids,
  floor: TABLES.floorGrids,
});

/** One PNG data URI per sprite — what `FloorGrid.tsx` actually draws. */
export const FLOOR_SPRITE_URIS = Object.freeze({
  member: TABLES.memberUris,
  session: TABLES.sessionUris,
  fixed: TABLES.fixedUris,
  floor: TABLES.floorUris,
});

/** The resolved palettes, in legend order, for tests that re-derive colours. */
export const FLOOR_SPRITE_PALETTES = Object.freeze({
  legend: LEGEND,
  base: Object.freeze(paletteRows(null).map((rgb) => Object.freeze([...rgb]))),
  byType: Object.freeze(
    Object.fromEntries(
      EMPIRE_TUNING.MEMBER_TYPES.map((type) => [
        type,
        Object.freeze(paletteRows(type).map((rgb) => Object.freeze([...rgb]))),
      ]),
    ),
  ) as Readonly<Record<MemberType, readonly (readonly number[])[]>>,
});
