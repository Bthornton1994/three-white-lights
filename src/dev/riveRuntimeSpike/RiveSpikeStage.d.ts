/**
 * WHY A HAND-WRITTEN `.d.ts` SITS BESIDE TWO `.tsx` FILES.
 *
 * `RiveSpikeStage.native.tsx` and `RiveSpikeStage.web.tsx` are resolved by
 * METRO per platform from the bare specifier `./RiveSpikeStage` — that is
 * the whole mechanism keeping `react-native-nitro-modules` (native-only) out
 * of the web bundle and `@rive-app/react-canvas` out of the native one.
 * `tsc --noEmit` has no platform and does not know the convention, so the
 * bare specifier fails to resolve.
 *
 * The textbook fix — `moduleSuffixes: ['.native', '.web', '']` in
 * `tsconfig.json` — was TRIED AND REVERTED, measured rather than assumed: it
 * re-routes THIRD-PARTY packages' internal relative imports too. `expo-audio`'s
 * `index.d.ts` does `export * from './ExpoAudio'`, which under that setting
 * resolved to `ExpoAudio.web.d.ts`, whose `setAudioModeAsync` takes a full
 * `AudioMode` rather than `Partial<AudioMode>` — and `src/meet/meetSound.ts`,
 * a file this spike has no business touching, went red. A project-wide
 * resolver change for one directory's benefit is the wrong blast radius.
 *
 * So the declaration lives here, scoped to this one specifier. Metro never
 * reads a `.d.ts` (it looks for `RiveSpikeStage.ts`, not `RiveSpikeStage.d.ts`),
 * and `tsc` still type-checks both `.tsx` implementations as root files —
 * each pins its export against `RiveSpikeStageComponent`, so this signature
 * and the two implementations cannot drift apart silently.
 */
import type { RiveSpikeStageComponent } from './riveSpikeTypes';

export declare const RiveSpikeStage: RiveSpikeStageComponent;
