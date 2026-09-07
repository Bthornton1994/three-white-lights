/**
 * ironAmberArt.ts — Session B owned-art adapter for the Iron & Amber gym floor.
 *
 * Pure module (CLAUDE.md, "Pure logic is separate from UI"): zero React, zero
 * I/O, zero PNG imports, zero remote URLs, zero data-URI payloads. It names
 * the static files under `/empire-art/` that Expo web serves from
 * `public/empire-art/`, and it maps gameplay keys (rung, member
 * type/pose/facing, furniture item) onto those files.
 *
 * `floor-garage.png` is the portrait Iron & Amber facility atmosphere
 * (espresso brick, factory windows, amber light, rubber floor). GymScreen
 * draws it as `gymscreen-facility-scene`, a full-bleed gameplay scene behind
 * FloorGrid. FloorGrid is the Build-mode interaction overlay plus Play
 * occupancy/hit-testing — it does not paint the garage.
 *
 * WHY THIS MODULE EXISTS RATHER THAN LOADING A PNG FROM FloorGrid.tsx.
 * `empireCore.test.ts`'s import fence lets FloorGrid import only `react`,
 * `react-native`, and shipped siblings in this directory. A PNG is not a
 * shipped sibling, so the floor cannot import art files. This adapter is the
 * narrow crossing: string URIs, closed lookup tables, no package imports.
 *
 * WHAT IT DOES NOT DO. It does not replace `floorSprites.ts`. Session
 * equipment that has no owned HD file still draws from the Phase 4 tables.
 * It does not claim Visual PASS — remaining pixel session chips and the
 * shared garage atmosphere on every rung are named residuals.
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
  'storage-unit': png('floor-garage'),
  'strip-mall-unit': png('floor-garage'),
  warehouse: png('floor-garage'),
});

const FIXED_BY_ITEM: Readonly<Record<string, string>> = Object.freeze({
  'flat-bench': png('eq-flat-bench'),
  'power-bar': png('eq-power-bar'),
  'comp-plates': png('eq-comp-plates'),
});

/** Closed list of files this adapter serves — the provenance test joins this to disk. */
export const IRON_AMBER_ART_STEMS = Object.freeze([
  'floor-garage',
  'eq-flat-bench',
  'eq-quality-bench',
  'eq-power-bar',
  'eq-comp-plates',
  'eq-plate-tree',
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

export function ironAmberMemberUri(type: string, pose: string, facing: string): string {
  return png(memberStem(type, pose, facing));
}

export function ironAmberFixedUri(item: string, quality: boolean): string | null {
  if (item === 'flat-bench' && quality) return png('eq-quality-bench');
  const hit = FIXED_BY_ITEM[item];
  return hit !== undefined ? hit : null;
}

export function ironAmberPlateTreeUri(): string {
  return png('eq-plate-tree');
}

export function ironAmberSessionUri(_item: string): string | null {
  return null;
}
