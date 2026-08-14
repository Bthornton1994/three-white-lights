/**
 * EmpireScreen — GDD §5 Gym Empire floor, first shell slice (Session C).
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS SCREEN IS, SO NOBODY HAS TO RUN A MUTATION TO FIND OUT
 * ---------------------------------------------------------------------------
 * A STATIC OPENING-DAY RENDER. It calls `createEmpireState()` once, on mount,
 * and paints four of that object's fields. Nothing steps it: there is no tick,
 * no accrual, no collect, no press of any kind on this surface, and no timer.
 * Open it on day one and on day four hundred and it draws the same four
 * readings, because they are the constructor's own constants — zero Gym Bucks,
 * zero reputation, an empty roster, the opening equipment rung.
 *
 * THAT IS DELIBERATE AND IT IS THE GDD's CALL, NOT AN UNFINISHED EDGE. §11
 * records the working assumption this run applies: Gym Empire, Career, Arcade
 * and cut-in art stay unbuilt while the gate waits on a human. §5's loop lives
 * in `src/empire/` as pure logic with its own suite; wiring it into a screen is
 * the thing that gate holds. So this file is the door and the nameplate, and
 * the room behind it is deliberately not furnished yet.
 *
 * It also does not write Total, e1RM, streak, or the pooled wallet in
 * `progression.ts` — that seam stays deferred per CLAUDE.md Session
 * Coordination. No game math is computed here.
 *
 * ---------------------------------------------------------------------------
 * THE ONE THING WORTH GUARANTEEING ABOUT A SCREEN THAT DOES NOTHING
 * ---------------------------------------------------------------------------
 * EVERY READING DRAWN BELOW — every row carrying a testID and a value — IS FED
 * BY `createEmpireState()`, and CANNOT be fed by a constant typed into this
 * file or lifted out of `shellTuning.ts`.
 * `@guarantee every-drawn-empire-reading-comes-from-the-pure-state`
 *
 * That is the whole of what separates this from a mock-up, and it is worth
 * stating precisely because nothing else can see it: the values are constructor
 * constants, so a hardcoded floor renders the SAME PIXELS and satisfies any
 * assertion on the drawn numbers. Provenance is the only discriminator there
 * is, and it is checked by a scan rather than by a reader — the tag above names
 * it, and `MUTATION_WITNESSES` carries the mutant that reddens it.
 *
 * Tunable chrome lives in `shellTuning.ts` (copy + layout). Colour is
 * `LIFT_PALETTE`, same room as the rest of the shell. No constants in this
 * `.tsx` — `src/tuning/audit.ts` allows none.
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { LIFT_PALETTE } from '../lift/liftPalette';
import { SHELL_COPY, SHELL_LAYOUT, type EmpirePhase } from './shellTuning';
import { createEmpireState, type EmpireState } from '../empire/empireCore';

const L = SHELL_LAYOUT;
const C = SHELL_COPY;

export interface EmpireScreenProps {
  /** Reports the Empire beat so the shell can draw leave chrome. */
  readonly onPhase?: (phase: EmpirePhase) => void;
}

export function EmpireScreen({ onPhase }: EmpireScreenProps): React.ReactElement {
  // Opening-day gym from pure logic. Local display cache only — not server
  // truth, and not a progression write. Held in state rather than recomputed so
  // a re-render cannot hand the rows a second object; nothing ever replaces it,
  // which is why there is no setter.
  const [state] = useState<EmpireState>(() => createEmpireState());

  useEffect(() => {
    onPhase?.('floor');
  }, [onPhase]);

  return (
    <View style={styles.root} testID="empire-screen">
      <Text style={styles.title} testID="empire-title">
        {C.EMPIRE_TITLE}
      </Text>
      <Text style={styles.lead}>{C.EMPIRE_LEAD}</Text>

      <View style={styles.stats} testID="empire-stats">
        <Stat label={C.EMPIRE_STAT_BUCKS} value={String(state.gymBucks)} testID="empire-stat-bucks" />
        <Stat label={C.EMPIRE_STAT_REP} value={String(state.reputation)} testID="empire-stat-rep" />
        <Stat
          label={C.EMPIRE_STAT_ROSTER}
          value={String(state.roster.length)}
          testID="empire-stat-roster"
        />
        <Stat
          label={C.EMPIRE_STAT_EQUIPMENT}
          value={state.axes.equipment}
          testID="empire-stat-equipment"
        />
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
  stats: {
    marginTop: L.EMPIRE_PAD_TOP,
    gap: L.EMPIRE_STAT_GAP,
  },
  stat: {
    borderWidth: L.NAV_BORDER,
    borderColor: LIFT_PALETTE.PANEL_EDGE,
    backgroundColor: LIFT_PALETTE.PANEL,
    borderRadius: L.NAV_RADIUS,
    paddingHorizontal: L.NAV_PAD_H,
    paddingVertical: L.EMPIRE_STAT_GAP,
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
