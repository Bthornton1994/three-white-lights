/**
 * The EMPTY side-on room plate the athlete rig composites onto
 * (`docs/design/ATHLETE-SOURCE-PACKAGE.md` §8): 1152 × 1728, the same size as
 * the artboard, no lifter in it.
 *
 * IT IS NOT THERE YET, and nothing stands in for it. The three painted squat
 * scenes (`squat-brace.jpg`, `squat-hole.jpg`, `squat-drive.jpg`) each have a
 * lifter in them and are refused by name in `tools/athleteIntake.mjs` step 0;
 * a crop of one behind the athlete is exactly what the 2026-09-08 room ruling
 * forbids, so this module never `require`s one. While `ROOM_ASSET` is null
 * the composed stage draws the backdrop colour under the rig and reports
 * `ROOM_ASSET_MISSING`.
 *
 * WHEN `assets/iron-amber/squat-room-side.jpg` LANDS: replace the null with
 * `require('../../assets/iron-amber/squat-room-side.jpg')` and flip
 * `ROOM_ASSET_IS_MISSING` in the same commit. `roomAsset.test.ts` pins the
 * flag to the file on disk and refuses any painted scene here.
 */
export const ROOM_ASSET_PATH = 'assets/iron-amber/squat-room-side.jpg';

/** The plate's bundled asset id, or null until it lands. */
export const ROOM_ASSET: number | null = null;

export const ROOM_ASSET_IS_MISSING = true;
