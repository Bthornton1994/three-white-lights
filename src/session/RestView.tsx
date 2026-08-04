/**
 * RestView — the beat between work sets.
 *
 * The only pause in the loop that exists for pacing rather than for reading
 * something, which is why it is TAPPABLE THROUGH. GDD §12.2 measures this
 * against a best-in-class daily-habit app and says ours "must not be slower or
 * flabbier"; a rest beat a player cannot skip is the definition of flab. It
 * ends on its own after `SET_REST_MS` or on a tap, whichever comes first.
 *
 * It shows how far through the session the player is, because that is the one
 * thing they cannot see while a rep is on screen.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SESSION_COPY, SESSION_LAYOUT } from '../game/sessionTuning';
import { SESSION_PALETTE } from './sessionPalette';

const L = SESSION_LAYOUT;

export interface RestViewProps {
  /** 1-based number of the set about to start. */
  readonly nextSet: number;
  readonly workSets: number;
  readonly weightKg: number;
  readonly onBeginSet: () => void;
}

export function RestView({
  nextSet,
  workSets,
  weightKg,
  onBeginSet,
}: RestViewProps): React.ReactElement {
  return (
    <Pressable
      style={styles.root}
      onPress={onBeginSet}
      accessibilityRole="button"
      testID="session-rest"
    >
      <Text style={styles.prompt}>{SESSION_COPY.REST_PROMPT}</Text>
      <View style={styles.pips} testID="session-set-pips">
        {Array.from({ length: workSets }, (_unused, index) => (
          <View
            key={index}
            style={[
              styles.pip,
              index < nextSet - 1 ? styles.pipDone : styles.pipTodo,
            ]}
          />
        ))}
      </View>
      <Text style={styles.next} testID="session-next-set">
        {`${SESSION_COPY.REST_NEXT} · ${SESSION_COPY.SET_LABEL} ${nextSet} ${SESSION_COPY.SET_OF} ${workSets}`}
      </Text>
      <Text style={styles.weight}>{`${weightKg} kg`}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: L.ROW_GAP,
  },
  prompt: {
    color: SESSION_PALETTE.TEXT,
    fontSize: L.HEADLINE_FONT,
    fontWeight: '700',
    letterSpacing: L.LETTER_SPACING,
  },
  pips: {
    flexDirection: 'row',
    gap: L.PIP_GAP,
    paddingVertical: L.ROW_GAP,
  },
  pip: {
    width: L.PIP_SIZE * 2,
    height: L.PIP_SIZE,
    borderRadius: L.PIP_SIZE / 2,
  },
  pipDone: { backgroundColor: SESSION_PALETTE.PIP_DONE },
  pipTodo: { backgroundColor: SESSION_PALETTE.PIP_TODO },
  next: {
    color: SESSION_PALETTE.TEXT_DIM,
    fontSize: L.PROMPT_FONT,
    letterSpacing: L.LETTER_SPACING,
  },
  weight: {
    color: SESSION_PALETTE.TEXT_DIM,
    fontSize: L.PLAN_FONT,
  },
});
