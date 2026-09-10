/**
 * athleteAssetStatus — whether the production athlete has arrived, as a
 * module with NO `require` in it, so the player-path stage can read the
 * flag without pulling the dev placeholder `.riv` into the player bundle.
 * `athleteAsset.ts` (the `require` of the file itself) re-exports this so
 * there is one definition; `athleteAsset.test.ts` pins the flag here to the
 * `require` path there and the path to the file on disk.
 *
 * WHEN `assets/athlete/athlete-01.riv` LANDS for player mount (intake step 4
 * complete + human VISUAL grade): flip this to `false` IN THE SAME COMMIT
 * that repoints `athleteAsset.ts`. Authored bytes may exist under
 * `assets/athlete/` for contract / intake / WebGL QA while this flag stays
 * true — that is "authored but unmounted", not a missing file. While true,
 * every athlete arm fails closed — the acceptance harness reports
 * `ASSET_MISSING` when the require still points at the placeholder, and the
 * training stage draws `athlete-asset-missing` (`trainingStageSelect.ts`)
 * when the athlete arm is selected without a real require, never the
 * schematic and never a diagnostic file.
 */

/** True while `athleteAsset.ts` points at the placeholder, not `assets/athlete/athlete-01.riv`. */
export const ATHLETE_RIV_IS_PLACEHOLDER = true;
