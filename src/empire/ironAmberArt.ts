/**
 * ironAmberArt.ts — Session B owned-art adapter for the Iron & Amber gym floor.
 *
 * Pure module (CLAUDE.md, "Pure logic is separate from UI"): zero React, zero
 * I/O, zero PNG imports, zero remote URLs, zero data-URI payloads. It names
 * the static files under `/empire-art/` that Expo web serves from
 * `public/empire-art/`, and it maps gameplay keys (rung, member
 * type/pose/facing, furniture item) onto those files.
 *
 * `floor-<rung>.png` is the portrait Iron & Amber facility atmosphere
 * (espresso brick, factory windows, amber light, rubber floor, no baked
 * lifters). GymScreen draws it as `gymscreen-facility-scene`, a full-bleed
 * gameplay scene behind FloorGrid. FloorGrid is the Build-mode interaction
 * overlay plus Play occupancy/hit-testing — it does not paint the room.
 *
 * `floor-plane.png` is the orthographic rubber floor that sits INSIDE
 * `floorgrid-grid` so placement cells and equipment footprints share one
 * rectangle with the painted floor. It is a different URI function from
 * `ironAmberFloorUri`, which FloorGrid is forbidden to call.
 *
 * WHY THIS MODULE EXISTS RATHER THAN LOADING A PNG FROM FloorGrid.tsx.
 * `empireCore.test.ts`'s import fence lets FloorGrid import only `react`,
 * `react-native`, and shipped siblings in this directory. A PNG is not a
 * shipped sibling, so the floor cannot import art files. This adapter is the
 * narrow crossing: string URIs, closed lookup tables, no package imports.
 *
 * WHAT IT DOES NOT DO. It does not replace `floorSprites.ts`. It does not
 * claim Visual PASS.
 */

const ART_ROOT = '/empire-art';

const MEMBER_TYPES = [
  'casual',
  'bodybuilder',
  'powerlifter',
  'athlete',
  'serious-lifter',
] as const;

const FACINGS = ['left', 'right'] as const;

function png(stem: string): string {
  return `${ART_ROOT}/${stem}.png`;
}

function knownType(type: string): (typeof MEMBER_TYPES)[number] {
  for (const each of MEMBER_TYPES) {
    if (each === type) return each;
  }
  return 'athlete';
}

function knownFacing(facing: string): (typeof FACINGS)[number] {
  return facing === 'left' ? 'left' : 'right';
}

function memberStem(type: string, pose: string, facing: string): string {
  const side = knownFacing(facing);
  const who = knownType(type);
  if (pose === 'step-a') return `member-walk-a-${side}`;
  if (pose === 'step-b') return `member-walk-b-${side}`;
  if (pose === 'using-bench-a') return `member-using-bench-a-${side}`;
  if (pose === 'using-bench-b') return `member-using-bench-b-${side}`;
  if (pose === 'using-bar-a' || pose === 'using-generic-a') return `member-using-bar-a-${side}`;
  if (pose === 'using-bar-b' || pose === 'using-generic-b') return `member-using-bar-b-${side}`;
  return `member-${who}-${side}`;
}

const FLOOR_BY_RUNG: Readonly<Record<string, string>> = Object.freeze({
  garage: png('floor-garage'),
  'storage-unit': png('floor-storage-unit'),
  'strip-mall-unit': png('floor-strip-mall-unit'),
  warehouse: png('floor-warehouse'),
});

const FIXED_BY_ITEM: Readonly<Record<string, string>> = Object.freeze({
  'flat-bench': png('eq-flat-bench'),
  'power-bar': png('eq-power-bar'),
  'comp-plates': png('eq-comp-plates'),
});

const SESSION_BY_ITEM: Readonly<Record<string, string>> = Object.freeze({
  bike: png('session-bike'),
  treadmill: png('session-treadmill'),
  rower: png('session-rower'),
  sled: png('session-sled'),
  dumbbells: png('session-dumbbells'),
  cables: png('session-cables'),
  machines: png('session-machines'),
  mats: png('session-mats'),
  'foam-rollers': png('session-foam-rollers'),
  sauna: png('session-sauna'),
  'wrist-wraps': png('session-wrist-wraps'),
  belts: png('session-belts'),
  sleeves: png('session-sleeves'),
  'specialty-bars': png('session-specialty-bars'),
});

/** Closed list of files this adapter serves — the provenance test joins this to disk. */
export const IRON_AMBER_ART_STEMS = Object.freeze([
  'floor-garage',
  'floor-storage-unit',
  'floor-strip-mall-unit',
  'floor-warehouse',
  'floor-plane',
  'eq-flat-bench',
  'eq-quality-bench',
  'eq-power-bar',
  'eq-comp-plates',
  'eq-plate-tree',
  'session-bike',
  'session-treadmill',
  'session-rower',
  'session-sled',
  'session-dumbbells',
  'session-cables',
  'session-machines',
  'session-mats',
  'session-foam-rollers',
  'session-sauna',
  'session-wrist-wraps',
  'session-belts',
  'session-sleeves',
  'session-specialty-bars',
  'member-casual-right',
  'member-casual-left',
  'member-bodybuilder-right',
  'member-bodybuilder-left',
  'member-powerlifter-right',
  'member-powerlifter-left',
  'member-athlete-right',
  'member-athlete-left',
  'member-serious-lifter-right',
  'member-serious-lifter-left',
  'member-walk-a-right',
  'member-walk-a-left',
  'member-walk-b-right',
  'member-walk-b-left',
  'member-using-bench-a-right',
  'member-using-bench-a-left',
  'member-using-bench-b-right',
  'member-using-bench-b-left',
  'member-using-bar-a-right',
  'member-using-bar-a-left',
  'member-using-bar-b-right',
  'member-using-bar-b-left',
]);

export function ironAmberArtRoot(): string {
  return ART_ROOT;
}

export function ironAmberArtUri(stem: string): string {
  return png(stem);
}

export function ironAmberFloorUri(rung: string): string {
  const hit = FLOOR_BY_RUNG[rung];
  return hit !== undefined ? hit : png('floor-garage');
}

export function ironAmberFloorPlaneUri(): string {
  return png('floor-plane');
}

export function ironAmberMemberUri(type: string, pose: string, facing: string): string {
  return png(memberStem(type, pose, facing));
}

/**
 * VL-3: the baked motion strip of one production member type and clip —
 * `member-motion-<type>-<clip>.png`, the stem `memberMotionClips.ts`'s
 * `memberMotionStripStem` spells (this module imports nothing, so the shape
 * is repeated here and `ironAmberArt.test.ts` pins the two agree). NOT on
 * `IRON_AMBER_ART_STEMS` until the strips land from the art pass: that list
 * is joined to disk, and a stem on it with no file is red.
 */
export function ironAmberMemberMotionStripUri(type: string, clip: string): string {
  return png(`member-motion-${type}-${clip}`);
}

export function ironAmberFixedUri(item: string, quality: boolean): string | null {
  if (item === 'flat-bench' && quality) return png('eq-quality-bench');
  const hit = FIXED_BY_ITEM[item];
  return hit !== undefined ? hit : null;
}

export function ironAmberPlateTreeUri(): string {
  return png('eq-plate-tree');
}

export function ironAmberSessionUri(item: string): string | null {
  const hit = SESSION_BY_ITEM[item];
  return hit !== undefined ? hit : null;
}
