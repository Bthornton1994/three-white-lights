/**
 * EmpireScreen — GDD §5 Gym Empire floor, first shell slice (Session C).
 *
 * A RENDERER. It reads `createEmpireState()` and paints opening-day balances.
 * It does not write Total, e1RM, streak, or the pooled wallet in
 * `progression.ts` — that seam stays deferred per CLAUDE.md Session
 * Coordination. No game math is computed here; every number on screen is a
 * field of the pure state object.
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
  // truth, and not a progression write.
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
