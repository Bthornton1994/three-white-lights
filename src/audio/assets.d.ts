/**
 * Metro bundles a `.wav` the same way it bundles a `.png`: the import resolves
 * to an opaque asset id, which is what `expo-audio`'s `AudioSource` takes as
 * `assetId`. TypeScript needs telling.
 *
 * The files themselves are generated — `tools/sound.mjs` renders them from
 * `MEET_SOUND` — and checked against a fresh render by `meetSound.test.ts`.
 */
declare module '*.wav' {
  const assetId: number;
  export default assetId;
}
