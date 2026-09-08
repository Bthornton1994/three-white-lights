/**
 * The production athlete `.riv`, by `require()` so Metro bundles it
 * (`metro.config.js` registers the extension; `src/art/riv.d.ts` types it).
 *
 * THERE IS NO PRODUCTION ATHLETE YET. This points at the dev spike's
 * deliberately-invalid placeholder so the two stages COMPILE and the swap line
 * in `TrainingLiftStage.tsx` is real when the asset arrives — and so that if
 * anyone mounts `AthleteStage` before then, both runtimes reject the file
 * loudly (`MalformedFile`) rather than drawing a fourth placeholder body.
 *
 * WHEN `assets/athlete/athlete-01.riv` LANDS (intake step 4, `docs/design/
 * ATHLETE-ASSET-PIPELINE.md` §12a): repoint the `require` at it and flip
 * `ATHLETE_RIV_IS_PLACEHOLDER` to `false` IN THE SAME COMMIT. The acceptance
 * harness (`src/dev/athleteAcceptance/`) reads the flag and reports
 * `ASSET_MISSING` instead of mounting a stage on a file that is not an
 * athlete; `athleteAsset.test.ts` pins the flag to the path and the path to
 * the file on disk, so neither can move alone.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const ATHLETE_RIV_ASSET: number = require('../../assets/dev/rive-spike.riv');

/** True while `ATHLETE_RIV_ASSET` is the placeholder, not `assets/athlete/athlete-01.riv`. */
export const ATHLETE_RIV_IS_PLACEHOLDER = true;
