/**
 * OwnerPlaytestScreen — the owner's play route to the athlete stage BEFORE
 * any gate flip. Dev only: reached solely through
 * `?dev-rive-spike=1&dev-mode=owner-playtest` under `__DEV__` (web address
 * bar, or the scheme link on a development build — ADR-001 §7).
 *
 * What it is: the REAL `AppShell` — Create Your Lifter, the check-in, the
 * session, the sets, the close-out, exactly as a player reaches them —
 * rendered under `AthleteStageOverrideContext = 'athlete'`, so the training
 * squat's stage draws the athlete arm while `ATHLETE_RIG.TRAINING_STAGE`
 * stays `'schematic'`. The shell is handed the same URL read the platform
 * edge gives it (`window.location.search` on web, null on native), so
 * `resolveEntry` decides the route exactly as in `App.tsx` — the two dev
 * keys have no arm there and resolve to the player's default route, and the
 * four debug query strings keep working inside this route on a dev build.
 *
 * What it refuses: with `ATHLETE_RIV_IS_PLACEHOLDER` true the stage arm is
 * `athlete-asset-missing` (`trainingStageSelect.ts`) — an explicit panel on
 * the set screen, not the schematic, not a diagnostic file. So this route is
 * live today and shows the owner exactly where the athlete is not.
 *
 * The strip at the top says what this is, cannot be tapped (pointer events
 * off), and is the only pixel this file adds to the shell.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { LIFT_PALETTE } from '../../lift/liftPalette';
import { AthleteStageOverrideContext } from '../../session/athleteStageOverride';
import { AppShell } from '../../shell/AppShell';
import { SPIKE_LAYOUT } from '../riveRuntimeSpike/spikeTuning';

// The one platform read, identical to `App.tsx`'s: `window` exists on web only.
function locationSearch(): string | null {
  if (typeof window === 'undefined') return null;
  return window.location.search;
}

export function OwnerPlaytestScreen(): React.ReactElement {
  return (
    <AthleteStageOverrideContext.Provider value="athlete">
      <View style={styles.container} testID="dev-owner-playtest">
        <AppShell search={locationSearch()} />
        <View style={styles.strip} pointerEvents="none" testID="dev-owner-playtest-strip">
          <Text style={styles.stripText}>OWNER PLAYTEST — DEV ROUTE — athlete stage on the real session; TRAINING_STAGE unflipped</Text>
        </View>
      </View>
    </AthleteStageOverrideContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LIFT_PALETTE.BACKDROP,
  },
  strip: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    paddingHorizontal: SPIKE_LAYOUT.PADDING_HORIZONTAL,
    paddingVertical: SPIKE_LAYOUT.HEADING_GAP,
    backgroundColor: LIFT_PALETTE.BACKDROP,
    opacity: SPIKE_LAYOUT.OWNER_STRIP_OPACITY,
  },
  stripText: {
    color: LIFT_PALETTE.TEXT,
    fontSize: SPIKE_LAYOUT.STATUS_SIZE,
  },
});
