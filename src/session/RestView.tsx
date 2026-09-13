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
 *
 * ---------------------------------------------------------------------------
 * THE COACH REACTION IS OFFERED HERE, AND THIS IS THE ONLY BEAT IT COULD BE
 * ---------------------------------------------------------------------------
 * GDD §7.2's fourth firing moment is "coach reactions on a heavy set". The rest
 * beat is where it belongs because it is the first moment AFTER a set that is
 * not a live rep: an interrupt during `SetView` would cost the player the rep
 * it was reacting to, which is the opposite of a reward.
 *
 * The screen reports the LOAD, not a verdict. `src/cutin/cutInGate.ts` holds
 * what counts as heavy (`COACH_HEAVY_SET_LOAD_RATIO`), the one-per-session cap
 * and the rate. That rate is the lowest of the four on purpose, and the reason
 * is this beat's POSITION rather than its importance: it arrives before the
 * close-out's PR and would otherwise take the session's only slot from it. See
 * `cutInGate.ts` §4.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SESSION_COPY, SESSION_LAYOUT } from '../game/sessionTuning';
import { useOfferCutIn } from '../cutin/CutInHost';
import { SESSION_PALETTE } from './sessionPalette';
import { IronAmberCard, IronAmberRoom } from './IronAmberRoom';

const L = SESSION_LAYOUT;

export interface RestViewProps {
  /** 1-based number of the set about to start. */
  readonly nextSet: number;
  readonly workSets: number;
  readonly weightKg: number;
  /**
   * `weightKg / e1RM` for the set just finished — `SessionPlan.loadRatio`,
   * unchanged. Reported to the cut-in gate and drawn nowhere: GDD §3.4 and
   * §12.3 forbid a visible fatigue meter, and a load percentage on the rest
   * screen is one keystroke from being read as one.
   */
  readonly loadRatio: number;
  readonly onBeginSet: () => void;
}

export function RestView({
  nextSet,
  workSets,
  weightKg,
  loadRatio,
  onBeginSet,
}: RestViewProps): React.ReactElement {
  // GDD §7.2's fourth firing moment, offered. Every set of this session's plan
  // is at the same load, so each work set IS a top set — there are no back-off
  // sets in the daily loop today. `isTopSet` is still passed rather than
  // assumed, so the day one exists the gate already refuses it.
  useOfferCutIn([{ kind: 'work-set', loadRatio, isTopSet: true }]);

  return (
    <Pressable
      style={styles.press}
      onPress={onBeginSet}
      accessibilityRole="button"
      accessibilityLabel={SESSION_COPY.REST_PROMPT}
      testID="session-rest"
    >
      <IronAmberRoom gymTestID="iron-amber-rest-gym" brand={false} scroll={false}>
        <IronAmberCard>
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
        </IronAmberCard>
      </IronAmberRoom>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: {
    flex: 1,
  },
  prompt: {
    color: SESSION_PALETTE.AMBER,
    fontSize: L.HEADLINE_FONT,
    fontWeight: '700',
    letterSpacing: L.LETTER_SPACING,
    textAlign: 'center',
  },
  pips: {
    flexDirection: 'row',
    gap: L.PIP_GAP,
    paddingVertical: L.ROW_GAP,
    justifyContent: 'center',
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
    textAlign: 'center',
  },
  weight: {
    color: SESSION_PALETTE.TEXT,
    fontSize: L.PLAN_FONT,
    textAlign: 'center',
  },
});
