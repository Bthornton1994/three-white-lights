/**
 * `.riv` is not a Metro asset extension by default — `metro.config.js`
 * registers it so `require('./athlete.riv')` resolves to an opaque asset id
 * the same way `src/jpg.d.ts` already does for `.jpg`. See
 * `docs/design/ADR-001-athlete-animation-architecture.md` §7's Expo build
 * implications.
 *
 * IT LIVES UNDER `src/art/`, NOT BESIDE `src/jpg.d.ts`, ON PURPOSE. An
 * ambient `declare module` is global wherever it sits, and the athlete's
 * `.riv` is an art-pipeline asset — but the deciding reason is measured:
 * `src/game/streakEntitlement.test.ts`'s directory walk pushes root-level
 * `src/*.d.ts` files and then reads each filename as a top-level DIRECTORY,
 * while its oracle filters `isDirectory()`. `src/jpg.d.ts` already trips
 * that assertion on the branch this was built from; a second root-level
 * declaration would be a second instance of somebody else's defect rather
 * than a fix. Recorded here so nobody "tidies" this file back to the root.
 *
 * The runtime spike itself does NOT use this path — no legally-usable `.riv`
 * binary is obtainable in this environment (see the spike's own header) — but
 * a real bundled athlete asset will, so the declaration and the metro config
 * change are shipped now rather than left for whoever adds the first one.
 */
declare module '*.riv' {
  const assetId: number;
  export default assetId;
}
