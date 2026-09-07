/**
 * The production athlete `.riv`, by `require()` so Metro bundles it
 * (`metro.config.js` registers the extension; `src/art/riv.d.ts` types it).
 *
 * THERE IS NO PRODUCTION ATHLETE YET. This points at the dev spike's
 * deliberately-invalid placeholder so the two stages COMPILE and the swap line
 * in `TrainingLiftStage.tsx` is real when the asset arrives — and so that if
 * anyone mounts `AthleteStage` before then, both runtimes reject the file
 * loudly (`MalformedFile`) rather than drawing a fourth placeholder body.
 * Replace the path, not the stages, when `assets/athlete/squat.riv` exists.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const ATHLETE_RIV_ASSET: number = require('../../assets/dev/rive-spike.riv');
