/**
 * Arcade-only Iron & Amber sprite palette.
 * New package — do not import legacy gym/lifter sprite palettes.
 * Packed as 0xAABBGGRR for the pixel buffer.
 */

function rgb(r: number, g: number, b: number): number {
  return 0xff000000 | (b << 16) | (g << 8) | r;
}

export const ARCADE_PALETTE = {
  void: rgb(8, 6, 10),
  espresso: rgb(20, 14, 10),
  ink: rgb(28, 18, 14),
  charcoal: rgb(42, 33, 28),
  iron: rgb(74, 67, 60),
  steel: rgb(122, 115, 104),
  chalk: rgb(232, 220, 200),
  paper: rgb(243, 234, 216),
  amber: rgb(224, 160, 64),
  amberDeep: rgb(184, 106, 30),
  ember: rgb(138, 58, 20),
  singlet: rgb(196, 90, 40),
  singletShade: rgb(138, 58, 24),
  skin: rgb(196, 146, 106),
  skinShade: rgb(138, 90, 58),
  hair: rgb(42, 24, 16),
  belt: rgb(58, 42, 32),
  chalkCloud: rgb(216, 208, 192),
  plateRed: rgb(196, 40, 40),
  plateBlue: rgb(42, 74, 168),
  plateYellow: rgb(212, 176, 32),
  plateGreen: rgb(42, 138, 58),
  plateWhite: rgb(232, 224, 212),
  plateBlack: rgb(26, 26, 26),
  bar: rgb(200, 192, 180),
  barShade: rgb(122, 116, 104),
  lightWhite: rgb(244, 240, 232),
  lightRed: rgb(200, 32, 32),
  lightOff: rgb(58, 48, 40),
  lightHousing: rgb(26, 20, 16),
  benchPad: rgb(74, 32, 24),
  rack: rgb(90, 83, 76),
  floor: rgb(58, 44, 34),
  floorLine: rgb(106, 74, 40),
  crowd: rgb(36, 24, 16),
} as const;

export function cssHex(color: number): string {
  const r = color & 0xff;
  const g = (color >> 8) & 0xff;
  const b = (color >> 16) & 0xff;
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/** IPF-style plate colors by denomination. */
export function plateColor(kg: number): number {
  if (kg >= 25) {
    return ARCADE_PALETTE.plateRed;
  }
  if (kg >= 20) {
    return ARCADE_PALETTE.plateBlue;
  }
  if (kg >= 15) {
    return ARCADE_PALETTE.plateYellow;
  }
  if (kg >= 10) {
    return ARCADE_PALETTE.plateGreen;
  }
  if (kg >= 5) {
    return ARCADE_PALETTE.plateWhite;
  }
  if (kg >= 2.5) {
    return ARCADE_PALETTE.plateBlack;
  }
  return ARCADE_PALETTE.steel;
}
