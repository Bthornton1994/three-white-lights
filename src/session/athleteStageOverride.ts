/**
 * athleteStageOverride — the ONE way to draw the athlete stage on the
 * player path without flipping `ATHLETE_RIG.TRAINING_STAGE`.
 *
 * Production provides nothing: the context's default is `null`, so
 * `TrainingLiftStage` reads the gate value exactly as before. The only
 * provider in the tree is the dev-only owner-playtest surface
 * (`src/dev/athleteAcceptance/OwnerPlaytestScreen.tsx`), reached solely
 * through `?dev-rive-spike=1&dev-mode=owner-playtest` under `__DEV__` — the
 * same gate every dev surface sits behind. `src/session/trainingStageGate.
 * test.ts` pins that no module outside `src/dev/` provides it.
 *
 * Why a context and not a second tuning value: a value in `spriteTuning.ts`
 * is the production gate by another name. A provider that can only mount
 * inside the dev route cannot ship to a player, and the selector
 * (`trainingStageSelect.ts`) still fails closed when the asset is absent.
 */
import { createContext } from 'react';

import type { TrainingStageKind } from '../art/spriteTuning';

export const AthleteStageOverrideContext = createContext<TrainingStageKind | null>(null);
