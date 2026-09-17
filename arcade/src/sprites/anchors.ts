/**
 * Per-frame visible-pixel anchors measured from existing PNG alpha.
 * Not new art. Contact is the bottom-weighted opaque footprint.
 */
export type FrameAnchor = {
  minX: number; minY: number; maxX: number; maxY: number;
  boxW: number; boxH: number; contactX: number; contactY: number;
};

export const STAGE = {
  width: 320,
  height: 320,
  contactX: 160,
  contactY: 318,
} as const;

export const ANCHORS = {
  squat: [
    { minX: 39, minY: 60, maxX: 279, maxY: 317, boxW: 241, boxH: 258, contactX: 128, contactY: 317 },
    { minX: 38, minY: 102, maxX: 280, maxY: 317, boxW: 243, boxH: 216, contactX: 122, contactY: 317 },
    { minX: 36, minY: 119, maxX: 282, maxY: 317, boxW: 247, boxH: 199, contactX: 118, contactY: 317 },
    { minX: 35, minY: 86, maxX: 283, maxY: 317, boxW: 249, boxH: 232, contactX: 119, contactY: 317 },
    { minX: 39, minY: 91, maxX: 279, maxY: 317, boxW: 241, boxH: 227, contactX: 133, contactY: 317 },
    { minX: 38, minY: 68, maxX: 281, maxY: 317, boxW: 244, boxH: 250, contactX: 134, contactY: 317 },
  ] as const satisfies readonly FrameAnchor[],
  squatMax: [
    { minX: 27, minY: 67, maxX: 292, maxY: 319, boxW: 266, boxH: 253, contactX: 66, contactY: 319 },
    { minX: 28, minY: 80, maxX: 291, maxY: 319, boxW: 264, boxH: 240, contactX: 106, contactY: 319 },
    { minX: 23, minY: 81, maxX: 295, maxY: 319, boxW: 273, boxH: 239, contactX: 166, contactY: 319 },
    { minX: 27, minY: 70, maxX: 291, maxY: 317, boxW: 265, boxH: 248, contactX: 110, contactY: 317 },
    { minX: 32, minY: 67, maxX: 287, maxY: 317, boxW: 256, boxH: 251, contactX: 113, contactY: 317 },
    { minX: 28, minY: 67, maxX: 291, maxY: 317, boxW: 264, boxH: 251, contactX: 108, contactY: 317 },
  ] as const satisfies readonly FrameAnchor[],
  bench: [
    { minX: 21, minY: 66, maxX: 297, maxY: 317, boxW: 277, boxH: 252, contactX: 193, contactY: 317 },
    { minX: 22, minY: 66, maxX: 296, maxY: 317, boxW: 275, boxH: 252, contactX: 192, contactY: 317 },
    { minX: 23, minY: 66, maxX: 296, maxY: 317, boxW: 274, boxH: 252, contactX: 195, contactY: 317 },
    { minX: 20, minY: 63, maxX: 298, maxY: 317, boxW: 279, boxH: 255, contactX: 194, contactY: 317 },
    { minX: 24, minY: 62, maxX: 294, maxY: 317, boxW: 271, boxH: 256, contactX: 191, contactY: 317 },
    { minX: 23, minY: 63, maxX: 296, maxY: 317, boxW: 274, boxH: 255, contactX: 193, contactY: 317 },
  ] as const satisfies readonly FrameAnchor[],
  benchMax: [
    { minX: 22, minY: 94, maxX: 299, maxY: 316, boxW: 278, boxH: 223, contactX: 138, contactY: 316 },
    { minX: 19, minY: 76, maxX: 297, maxY: 319, boxW: 279, boxH: 244, contactX: 181, contactY: 319 },
    { minX: 19, minY: 125, maxX: 298, maxY: 317, boxW: 280, boxH: 193, contactX: 163, contactY: 317 },
    { minX: 26, minY: 73, maxX: 292, maxY: 317, boxW: 267, boxH: 245, contactX: 160, contactY: 317 },
    { minX: 45, minY: 82, maxX: 274, maxY: 317, boxW: 230, boxH: 236, contactX: 190, contactY: 317 },
    { minX: 20, minY: 98, maxX: 297, maxY: 317, boxW: 278, boxH: 220, contactX: 164, contactY: 317 },
  ] as const satisfies readonly FrameAnchor[],
  deadlift: [
    { minX: 54, minY: 139, maxX: 267, maxY: 317, boxW: 214, boxH: 179, contactX: 124, contactY: 317 },
    { minX: 47, minY: 115, maxX: 269, maxY: 317, boxW: 223, boxH: 203, contactX: 156, contactY: 317 },
    { minX: 59, minY: 31, maxX: 260, maxY: 319, boxW: 202, boxH: 289, contactX: 161, contactY: 319 },
    { minX: 51, minY: 111, maxX: 269, maxY: 317, boxW: 219, boxH: 207, contactX: 147, contactY: 317 },
    { minX: 46, minY: 110, maxX: 271, maxY: 317, boxW: 226, boxH: 208, contactX: 154, contactY: 317 },
    { minX: 10, minY: 12, maxX: 309, maxY: 318, boxW: 300, boxH: 307, contactX: 131, contactY: 318 },
  ] as const satisfies readonly FrameAnchor[],
  deadliftMax: [
    { minX: 52, minY: 144, maxX: 268, maxY: 317, boxW: 217, boxH: 174, contactX: 118, contactY: 317 },
    { minX: 42, minY: 119, maxX: 276, maxY: 317, boxW: 235, boxH: 199, contactX: 152, contactY: 317 },
    { minX: 48, minY: 30, maxX: 268, maxY: 319, boxW: 221, boxH: 290, contactX: 159, contactY: 319 },
    { minX: 48, minY: 126, maxX: 272, maxY: 317, boxW: 225, boxH: 192, contactX: 146, contactY: 317 },
    { minX: 42, minY: 119, maxX: 275, maxY: 317, boxW: 234, boxH: 199, contactX: 145, contactY: 317 },
    { minX: 4, minY: 10, maxX: 315, maxY: 318, boxW: 312, boxH: 309, contactX: 121, contactY: 318 },
  ] as const satisfies readonly FrameAnchor[],
  idle: [
    { minX: 59, minY: 103, maxX: 260, maxY: 318, boxW: 202, boxH: 216, contactX: 145, contactY: 318 },
    { minX: 58, minY: 103, maxX: 261, maxY: 318, boxW: 204, boxH: 216, contactX: 141, contactY: 318 },
    { minX: 60, minY: 103, maxX: 259, maxY: 318, boxW: 200, boxH: 216, contactX: 143, contactY: 318 },
    { minX: 59, minY: 103, maxX: 260, maxY: 318, boxW: 202, boxH: 216, contactX: 142, contactY: 318 },
  ] as const satisfies readonly FrameAnchor[],
  success: [
    { minX: 54, minY: 2, maxX: 264, maxY: 317, boxW: 211, boxH: 316, contactX: 154, contactY: 317 },
    { minX: 89, minY: 106, maxX: 230, maxY: 318, boxW: 142, boxH: 213, contactX: 156, contactY: 318 },
    { minX: 51, minY: 5, maxX: 268, maxY: 317, boxW: 218, boxH: 313, contactX: 145, contactY: 317 },
    { minX: 89, minY: 107, maxX: 230, maxY: 318, boxW: 142, boxH: 212, contactX: 155, contactY: 318 },
  ] as const satisfies readonly FrameAnchor[],
  miss: [
    { minX: 54, minY: 126, maxX: 265, maxY: 318, boxW: 212, boxH: 193, contactX: 153, contactY: 318 },
    { minX: 53, minY: 127, maxX: 266, maxY: 318, boxW: 214, boxH: 192, contactX: 152, contactY: 318 },
    { minX: 54, minY: 130, maxX: 265, maxY: 318, boxW: 212, boxH: 189, contactX: 152, contactY: 318 },
    { minX: 53, minY: 130, maxX: 266, maxY: 318, boxW: 214, boxH: 189, contactX: 152, contactY: 318 },
  ] as const satisfies readonly FrameAnchor[],
} as const;

export function placeAnchor(anchor: FrameAnchor): { x: number; y: number } {
  return {
    x: 0,
    y: Math.round(STAGE.contactY - anchor.contactY),
  };
}

export function contactWorld(anchor: FrameAnchor): { x: number; y: number } {
  const dest = placeAnchor(anchor);
  return { x: dest.x + anchor.contactX, y: dest.y + anchor.contactY };
}

const SRC_KEY: Record<string, keyof typeof ANCHORS> = {
  squat: "squat",
  "squat-max": "squatMax",
  bench: "bench",
  "bench-max": "benchMax",
  deadlift: "deadlift",
  "deadlift-max": "deadliftMax",
  idle: "idle",
  success: "success",
  miss: "miss",
};

export function anchorFromSrc(src: string): FrameAnchor {
  const match = src.match(/\/sprites\/([a-z-]+)\/frame-(\d+)/);
  const fallback = ANCHORS.squat[0];
  if (!match || !fallback) return { minX: 0, minY: 0, maxX: 319, maxY: 317, boxW: 320, boxH: 318, contactX: 160, contactY: 317 };
  const key = SRC_KEY[match[1] ?? ""];
  const list = key ? ANCHORS[key] : ANCHORS.squat;
  const index = Math.max(0, Number.parseInt(match[2] ?? "1", 10) - 1);
  return list[Math.min(list.length - 1, index)] ?? fallback;
}


