/**
 * EmpireScreen — GDD §5 Gym Empire floor.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS SCREEN IS, SO NOBODY HAS TO RUN A MUTATION TO FIND OUT
 * ---------------------------------------------------------------------------
 * A LIVE READ OF A RUNNING GYM. It opens an `EmpireFloor` when the surface is
 * first mounted and re-reads it on a timer while it is the surface on screen.
 * The gym behind it is advanced by `src/empire/`'s own `stepGym`, and the
 * "since check-in" row is `src/empire/`'s own `accrueProduction` asked one gap
 * early. Open it now and open it a minute later and it draws different numbers,
 * because the gym is a minute older.
 *
 * IT USED TO BE A STATIC OPENING-DAY RENDER — `createEmpireState()` once, four
 * constructor constants, nothing stepping it — because GDD §11 gated §5's
 * surface work on a human ruling. That ruling landed on 2026-08-14 and
 * authorised exactly this: wire `stepGym` and `accrueProduction` so the floor
 * shows real advancing state. It authorised nothing else, which is why there is
 * still no control on this screen: no collect, no recruit, no expansion, no
 * timer skip, no purchase of any kind.
 *
 * ---------------------------------------------------------------------------
 * THE ARITHMETIC IS NOT HERE, AND THE CLOCK IS THE ONLY PLATFORM READ
 * ---------------------------------------------------------------------------
 * This file computes nothing. `empireFloor.ts` holds the schedule and calls
 * §5's functions; the two effects below hand it `Date.now()` and it hands back
 * an object whose fields are drawn. CLAUDE.md's "never inline game math into a
 * component" is why, and the split is checked rather than promised —
 * `shellWiring.test.ts` traces every drawn row back to `createEmpireState()`
 * through the import graph.
 *
 * It does not write Total, e1RM, streak, or the pooled wallet in
 * `progression.ts` — that seam stays deferred per CLAUDE.md Session
 * Coordination, and GDD §11's ruling explicitly did not open it. Gym Bucks
 * accrued here stay here, and nothing survives a reload.
 *
 * ---------------------------------------------------------------------------
 * THE ONE THING WORTH GUARANTEEING ABOUT A SCREEN OF NUMBERS
 * ---------------------------------------------------------------------------
 * EVERY READING DRAWN BELOW — every row carrying a testID and a value — IS FED
 * BY `createEmpireState()`, reached through `empireFloor.ts`, and CANNOT be fed
 * by a constant typed into this file or lifted out of `shellTuning.ts`.
 * `@guarantee every-drawn-empire-reading-comes-from-the-pure-state`
 *
 * That was the whole of what separated the old floor from a mock-up, and it is
 * still worth stating now that the numbers move: a local counter incremented by
 * the same timer would ALSO produce a rising number, on a screen with no empire
 * call behind it, and no assertion on a rendered value could tell the two
 * apart. Provenance is the discriminator; the tag above names it, and
 * `MUTATION_WITNESSES` carries the mutant that reddens it.
 *
 * ---------------------------------------------------------------------------
 * AND WHICH ROW DRAWS WHICH READING, WHICH IS A SECOND CLAIM AND NOT THAT ONE
 * ---------------------------------------------------------------------------
 * Provenance says a row's value came out of the gym. It says nothing about
 * which field of the gym, so `readings.gymBucks` under the reputation label
 * traces perfectly and is false — and the reputation reading, which is the axis
 * gating the NPC ladder and the sponsor line, would then be recomputed on
 * every refresh and painted nowhere. Each row below is bound to the field its
 * label names, as a set equality in both directions over the pairs a scan reads
 * out of this file, so a swapped row, a second row drawing a field already
 * drawn, and a deleted row are each named in a failure.
 * `@guarantee each-empire-row-draws-the-reading-its-label-names`
 *
 * Tunable chrome and the check-in cadence live in `shellTuning.ts`. Colour is
 * `LIFT_PALETTE`, same room as the rest of the shell. No constants in this
 * `.tsx` — `src/tuning/audit.ts` allows none.
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { LIFT_PALETTE } from '../lift/liftPalette';
import { EMPIRE_FLOOR, SHELL_COPY, SHELL_LAYOUT, type EmpirePhase } from './shellTuning';
import {
  advanceEmpireFloor,
  empireFloorReadings,
  openEmpireFloor,
  type EmpireFloor,
} from './empireFloor';

const L = SHELL_LAYOUT;
const C = SHELL_COPY;

export interface EmpireScreenProps {
  /** Reports the Empire beat so the shell can draw leave chrome. */
  readonly onPhase?: (phase: EmpirePhase) => void;
  /**
   * Is this the surface the player is looking at?
   *
   * The shell keeps this screen MOUNTED while the player is back on the daily
   * session, so the gym they opened is still theirs when they come back — see
   * `AppShell.tsx`'s `PERSISTENT_SURFACES`. Two things follow, and both are the
   * reason this prop exists rather than a nicety:
   *
   *   - the refresh timer is not run while nobody is looking, and the floor is
   *     brought up to date the moment it is looked at again. Nothing is lost by
   *     that, because `advanceEmpireFloor` is a function of elapsed time rather
   *     than of how often it was called;
   *   - the beat is re-reported on the way back in. The shell forgets the
   *     destination's beat on every navigation (a stale beat flashes chrome over
   *     the wrong screen), and a screen that never un-mounted would otherwise
   *     never say 'floor' again — leaving the player on a floor with no way off
   *     it.
   */
  readonly active?: boolean;
}

export function EmpireScreen({ onPhase, active = true }: EmpireScreenProps): React.ReactElement {
  // GDD §5's gym, opened at the instant this surface first mounted. Local
  // display cache only — not server truth, not a progression write, and not
  // saved anywhere. `Date.now()` is the one platform read on this screen and
  // the only thing done with it is handing it to a pure module.
  const [floor, setFloor] = useState<EmpireFloor>(() => openEmpireFloor(Date.now()));

  useEffect(() => {
    if (!active) return;
    onPhase?.('floor');
  }, [onPhase, active]);

  useEffect(() => {
    if (!active) return undefined;
    // Brought up to date immediately, so a floor that was off screen while the
    // player trained does not draw a stale reading for one refresh.
    setFloor((current) => advanceEmpireFloor(current, Date.now()));
    const timer = setInterval(() => {
      setFloor((current) => advanceEmpireFloor(current, Date.now()));
    }, EMPIRE_FLOOR.REFRESH_MS);
    return () => clearInterval(timer);
  }, [active]);

  const readings = empireFloorReadings(floor);

  return (
    <View style={styles.root} testID="empire-screen">
      <Text style={styles.title} testID="empire-title">
        {C.EMPIRE_TITLE}
      </Text>
      <Text style={styles.lead}>{C.EMPIRE_LEAD}</Text>

      <View style={styles.stats} testID="empire-stats">
        <Stat label={C.EMPIRE_STAT_BUCKS} value={readings.gymBucks} testID="empire-stat-bucks" />
        <Stat
          label={C.EMPIRE_STAT_PENDING}
          value={readings.pendingGymBucks}
          testID="empire-stat-pending"
        />
        <Stat label={C.EMPIRE_STAT_REP} value={readings.reputation} testID="empire-stat-rep" />
        <Stat label={C.EMPIRE_STAT_ROSTER} value={readings.roster} testID="empire-stat-roster" />
        <Stat
          label={C.EMPIRE_STAT_EQUIPMENT}
          value={readings.equipment}
          testID="empire-stat-equipment"
        />
        <Stat label={C.EMPIRE_STAT_CLOCK} value={readings.clockSeconds} testID="empire-stat-clock" />
        <Stat label={C.EMPIRE_STAT_AWAY} value={readings.forfeitedSeconds} testID="empire-stat-away" />
      </View>
    </View>
  );
}

function Stat({
  label,
  value,
  testID,
}: {
  readonly label: string;
  readonly value: string;
  readonly testID: string;
}): React.ReactElement {
  return (
    <View style={styles.stat} testID={testID}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: LIFT_PALETTE.BACKDROP,
    paddingHorizontal: L.EMPIRE_PAD_H,
    paddingTop: L.EMPIRE_PAD_TOP,
  },
  title: {
    color: LIFT_PALETTE.TEXT,
    fontSize: L.EMPIRE_TITLE_FONT,
    fontWeight: '700',
    letterSpacing: L.EMPIRE_TITLE_TRACK,
  },
  lead: {
    marginTop: L.EMPIRE_STAT_GAP,
    color: LIFT_PALETTE.TEXT_DIM,
    fontSize: L.EMPIRE_BODY_FONT,
    lineHeight: L.EMPIRE_BODY_LINE,
  },
  // EMPIRE_STATS_TOP and EMPIRE_STAT_PAD_V, not EMPIRE_PAD_TOP and
  // EMPIRE_STAT_GAP: the column borrowed those two padding constants until the
  // seventh card (the away row) ran the column under the shell's pill and the
  // pill drew on top of it. The why and the cost live with the constants in
  // `shellTuning.ts`; the geometry — every card disjoint from the pill's
  // slop-grown touch target — is measured in `tools/verify-shell-route.mjs`.
  stats: {
    marginTop: L.EMPIRE_STATS_TOP,
    gap: L.EMPIRE_STAT_GAP,
  },
  stat: {
    borderWidth: L.NAV_BORDER,
    borderColor: LIFT_PALETTE.PANEL_EDGE,
    backgroundColor: LIFT_PALETTE.PANEL,
    borderRadius: L.NAV_RADIUS,
    paddingHorizontal: L.NAV_PAD_H,
    paddingVertical: L.EMPIRE_STAT_PAD_V,
  },
  statLabel: {
    color: LIFT_PALETTE.TEXT_DIM,
    fontSize: L.EMPIRE_STAT_LABEL_FONT,
    fontWeight: '700',
    letterSpacing: L.NAV_LETTER_SPACING,
  },
  statValue: {
    marginTop: L.NAV_BORDER,
    color: LIFT_PALETTE.TEXT,
    fontSize: L.EMPIRE_STAT_VALUE_FONT,
    fontWeight: '700',
  },
});
