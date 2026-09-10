/**
 * The EMPTY side-on room plate the athlete rig composites onto
 * (`docs/design/ATHLETE-SOURCE-PACKAGE.md` §8): 1152 × 1728, the same size as
 * the artboard, no lifter in it.
 *
 * Present at `assets/iron-amber/squat-room-side.jpg`. The three painted squat
 * scenes (`squat-brace.jpg`, `squat-hole.jpg`, `squat-drive.jpg`) each have a
 * lifter in them and are refused by name in `tools/athleteIntake.mjs` step 0;
 * a crop of one behind the athlete is exactly what the 2026-09-08 room ruling
 * forbids, so this module never `require`s one of those. `roomAsset.test.ts`
 * pins the flag to the file on disk and refuses any painted scene here.
 */
export const ROOM_ASSET_PATH = 'assets/iron-amber/squat-room-side.jpg';

/** The plate's bundled asset id. */
// Metro resolves the static require; vitest pins the specifier and the flag.
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const ROOM_ASSET: number = require('../../assets/iron-amber/squat-room-side.jpg');

export const ROOM_ASSET_IS_MISSING = false;
