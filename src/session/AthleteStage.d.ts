/**
 * Scoped declaration for the bare specifier `./AthleteStage`, which Metro
 * resolves per platform to `AthleteStage.native.tsx` / `AthleteStage.web.tsx`
 * and `tsc` cannot. Same reasoning, measured, as
 * `src/dev/riveRuntimeSpike/RiveSpikeStage.d.ts` — a project-wide
 * `moduleSuffixes` re-routes third-party type imports and turned a mechanics
 * file red.
 */
import type { AthleteStageComponent } from './athleteStageTypes';

export declare const AthleteStage: AthleteStageComponent;
