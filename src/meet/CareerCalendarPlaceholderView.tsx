/**
 * CareerCalendarPlaceholderView — TEMPORARY SCAFFOLDING. DELETE WITH GDD §6.1.
 *
 * One line and nothing else. `careerCalendarPlaceholder.ts` has the whole
 * account of why it exists, what pins it to the document, and what the bound on
 * it does and does not catch. Read that file, not this one.
 *
 * IT TAKES NO PROPS, AND THAT IS THE BOUND RATHER THAN AN ECONOMY. Nothing can
 * be handed to it, so no caller can feed it a date, an eligibility verdict or a
 * meet history to draw. `careerCalendarPlaceholder.test.ts` asserts the empty
 * parameter list textually, because adding an OPTIONAL prop would not break
 * assignability and a type-level check alone would miss it.
 *
 * THE WAY OUT IS THE SHELL'S. This renders on the `'recap'` beat, which is the
 * one beat in `SHELL_NAV.MEET_PHASES`, so BACK TO TRAINING is already painted
 * over it — the same route the real recap uses. A second button here would be
 * two identical affordances on one screen.
 *
 * Every number is `MEET_LAYOUT`'s and every colour `MEET_PALETTE`'s. Nothing is
 * declared here: `src/tuning/audit.ts` allows no `.tsx` file to hold a constant,
 * and a scaffold is not a reason to start.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { MEET_LAYOUT } from '../game/meetTuning';
import { CAREER_CALENDAR_PLACEHOLDER_COPY } from './careerCalendarPlaceholder';
import { MEET_PALETTE } from './meetPalette';

const L = MEET_LAYOUT;

export function CareerCalendarPlaceholderView(): React.ReactElement {
  return (
    <View style={styles.root} testID="meet-recap-placeholder">
      <Text style={styles.line}>{CAREER_CALENDAR_PLACEHOLDER_COPY.LINE}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: L.SCREEN_PAD,
  },
  line: {
    color: MEET_PALETTE.TEXT_DIM,
    fontSize: L.SUBHEAD_FONT,
    textAlign: 'center',
  },
});
