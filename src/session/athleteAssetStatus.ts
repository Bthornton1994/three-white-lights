/**
 * athleteAssetStatus — whether the production athlete has arrived, as a
 * module with NO `require` in it, so the player-path stage can read the
 * flag without pulling the dev placeholder `.riv` into the player bundle.
 * `athleteAsset.ts` (the `require` of the file itself) re-exports this so
 * there is one definition; `athleteAsset.test.ts` pins the flag here to the
 * `require` path there and the path to the file on disk.
 *
 * WHEN `assets/athlete/athlete-01.riv` LANDS (intake step 4, `docs/design/
 * ATHLETE-ASSET-PIPELINE.md` §12a): flip this to `false` IN THE SAME COMMIT
 * that repoints `athleteAsset.ts`. While true, every athlete arm fails
 * closed — the acceptance harness reports `ASSET_MISSING`, and the training
 * stage draws `athlete-asset-missing` (`trainingStageSelect.ts`), never the
 * schematic and never a diagnostic file.
 */

/** True while `athleteAsset.ts` points at the placeholder, not `assets/athlete/athlete-01.riv`. */
export const ATHLETE_RIV_IS_PLACEHOLDER = true;
