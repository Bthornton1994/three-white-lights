/**
 * CloseOutView — GDD §3.2's "e1RM updated, streak incremented, feedback shown".
 *
 * ---------------------------------------------------------------------------
 * EVERY NUMBER ON THIS SCREEN COMES OUT OF THE PROGRESSION CACHE
 * ---------------------------------------------------------------------------
 * This screen used to render `closeOut.newBestE1rmKg` and `closeOut.streakAfter`
 * — figures the client computed at close-out time and never looked at again.
 * They agreed with the server only because the server stand-in imported the
 * client's own `nextBestE1rm`; the first real Edge Function that returned
 * anything else would have been ignored here, on screen, for ever.
 *
 * It now renders a `CloseOutReadings` (`sessionClient.ts`), which is what
 * `progression.ts`'s `readBestE1rmKg` and `readStreakDays` say. `closeOut` is
 * still here, because what the SESSION did — the reps, the bar-speed line, the
 * lift — is the session's to report. What the RECORD now is, is the cache's.
 * Where the two disagree the cache wins.
 *
 * ---------------------------------------------------------------------------
 * FOUR CERTAINTIES, AND THE SCREEN SAYS WHICH ONE IT HAS
 * ---------------------------------------------------------------------------
 * A `ProgressionReading` is `confirmed`, `projected`, `stale` or `unknown`, and
 * a renderer cannot get at the number without narrowing. That is only worth
 * something if the four look different, so:
 *
 *   confirmed  full weight, no caption. The server said so.
 *   projected  dimmed to `SESSION_BOUNDARY.PROJECTED_OPACITY`, captioned SAVING.
 *              It is the client's guess and the screen does not pretend
 *              otherwise. When the response lands the number comes up to full
 *              over `CONFIRM_SETTLE_MS` — and if the server's figure is not the
 *              client's, the one that settles is the server's.
 *   stale      full weight, captioned NOT SYNCED. Still the best known truth
 *              (`progression.ts` keeps rendering it), flagged as possibly behind.
 *   unknown    an em dash. NEVER a zero: nothing has been read yet, and a zero
 *              is a claim.
 *
 * ---------------------------------------------------------------------------
 * THREE PAYOFFS, NOT TWO (GDD §3.2, ruled)
 * ---------------------------------------------------------------------------
 * A confirmed e1RM, an e1RM still in flight, and NO e1RM AT ALL — accessory day,
 * which pays Training IQ and moves no lift's estimate, because `LiftKind` is the
 * meet and stays three members. The third is a first-class branch: it renders a
 * Training IQ row and no e1RM row. It does not fall back to the previous best,
 * which would show a lifter a number they did not earn today — the same class of
 * lie as showing a projection as confirmed.
 *
 * ---------------------------------------------------------------------------
 * THE NUMBER THAT MOVES HERE IS e1RM. THERE IS NO TOTAL ON THIS SCREEN.
 * ---------------------------------------------------------------------------
 * GDD §3.2: "It must not show a Total that ticked up, an 'estimated Total', or a
 * projected competition total, because Total is the sum of best successful
 * *competition* attempts (§6.4) and there were no attempts today."
 *
 * Enforced four deep and none of the four is this comment: `SessionCloseOut` has
 * no total field, `session.test.ts` serialises it and fails on the word,
 * `ProjectionWithinReach<'record-training-session'>` makes a projected Total a
 * COMPILE error in `progression.ts`, and the only reads reaching this file are
 * `readBestE1rmKg` and `readStreakDays` by way of `CloseOutReadings` — the
 * session loop never calls `readTotalKg` at all.
 *
 * ---------------------------------------------------------------------------
 * ONE RESIDUAL, STATED RATHER THAN GLOSSED
 * ---------------------------------------------------------------------------
 * `headline` and `subhead` are still the CLIENT's call, taken at close-out time
 * from the client's own PR prediction. The NUMBER and its gold are re-derived
 * against the reading, so if the server disagrees the figure and the colour
 * follow the server — but the words above them can still read "NEW e1RM" over a
 * number that did not turn out to be one. Fixing that means moving close-out
 * copy selection out of `session.ts`, which is a design question rather than a
 * wiring bug; it is logged in GDD §11.
 *
 * ---------------------------------------------------------------------------
 * THE e1RM PR IS OFFERED TO THE CUT-IN GATE, AND IT DECIDES
 * ---------------------------------------------------------------------------
 * GDD §7.2's second firing moment is "PR moments (new e1RM, new total,
 * qualifying for a higher tier)", and the daily loop's share of that is the
 * e1RM. This file reports it as a beat to `useOfferCutIn` and decides nothing:
 * `src/cutin/cutInGate.ts` applies §7.2's one-per-session cap (§12.3's refusal
 * condition) and the day's scarcity rate. That rate is not decoration here —
 * `session.test.ts` measures a PR on 30 of 30 sessions at today's tuning, so
 * without it this screen would interrupt a player EVERY DAY.
 *
 * IT REPORTS `isPr`, WHICH IS THE READING'S AND NOT THE CLOSE-OUT'S. Same rule
 * as the gold on the number above it: if the server disagrees with the client's
 * prediction, the cut-in follows the server. A cut-in celebrating a record the
 * screen below it does not show would be the same class of lie as showing a
 * projection as confirmed.
 *
 * There is still no cut-in ART (§7.2, GDD §11): what mounts is `cutInArt.ts`'s
 * own composition around the placeholder Tier 3 DRAWING the licensing table
 * already holds, read through §7.3's surface witness. It is not the shop panel:
 * GDD §7.2 rules on that by name.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import {
  SESSION_BOUNDARY,
  SESSION_BOUNDARY_COPY,
  SESSION_COPY,
  SESSION_LAYOUT,
  SESSION_TUNING,
} from '../game/sessionTuning';
import type { CloseOutReadings } from '../game/sessionClient';
import type { ProgressionReading } from '../game/progression';
import type { SessionCloseOut } from '../game/session';
import { useOfferCutIn } from '../cutin/CutInHost';
import { SESSION_PALETTE } from './sessionPalette';

const L = SESSION_LAYOUT;

/** How sure a rendered number is. `ProgressionReading`'s discriminant. */
type Certainty = ProgressionReading<never, never>['kind'];

/**
 * Counts a number from wherever it currently is to `to` over `durationMs`.
 *
 * React state rather than Reanimated, because the thing being animated is TEXT
 * CONTENT: Reanimated animates style properties on the UI thread and cannot
 * rewrite a `<Text>`'s children without a helper this project does not depend
 * on. A once-per-session count over `CLOSE_OUT_E1RM_COUNT_MS` is not a per-frame
 * cost worth a dependency.
 *
 * `from` SEEDS THE FIRST FRAME AND IS THEN NOT READ AGAIN. Every later run
 * starts at whatever is on screen, so when a projected number is corrected by
 * the server the display travels from the figure the player was looking at to
 * the one that is true — instead of snapping back to the old best and counting
 * up a second time.
 *
 * A zero duration lands on `to` immediately, which is what an ordinary day
 * wants: the number did not move, so nothing should appear to move.
 */
function useCountUp(from: number, to: number, durationMs: number, delayMs: number): number {
  const [value, setValue] = useState(durationMs <= 0 ? to : from);
  const shown = useRef<number>(durationMs <= 0 ? to : from);
  const frame = useRef<number>(0);
  useEffect(() => {
    if (durationMs <= 0) {
      shown.current = to;
      setValue(to);
      return undefined;
    }
    const begin = shown.current;
    if (begin === to) return undefined;
    const start = Date.now() + delayMs;
    const tick = (): void => {
      const elapsed = Date.now() - start;
      const t = elapsed <= 0 ? 0 : Math.min(1, elapsed / durationMs);
      const next = begin + (to - begin) * t;
      shown.current = next;
      setValue(next);
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [to, durationMs, delayMs]);
  return value;
}

/** A row that fades in on its own beat, so the close-out assembles. */
function Row({
  index,
  children,
}: {
  readonly index: number;
  readonly children: React.ReactNode;
}): React.ReactElement {
  const shown = useSharedValue(0);
  useEffect(() => {
    shown.value = withDelay(
      index * SESSION_TUNING.CLOSE_OUT_ROW_STAGGER_MS,
      withTiming(1, { duration: SESSION_TUNING.CLOSE_OUT_ROW_FADE_MS }),
    );
  }, [index, shown]);
  const style = useAnimatedStyle(() => ({ opacity: shown.value }));
  return <Animated.View style={[styles.row, style]}>{children}</Animated.View>;
}

/** The caption under a number, or a blank line where there is nothing to say. */
function tagTextFor(certainty: Certainty): string {
  switch (certainty) {
    case 'projected':
      return SESSION_BOUNDARY_COPY.PROJECTED_TAG;
    case 'stale':
      return SESSION_BOUNDARY_COPY.STALE_TAG;
    default:
      return ' ';
  }
}

/**
 * Wraps a number in how sure it is.
 *
 * The caption is always mounted — a single space where there is nothing to say —
 * so the row does not jump when a number settles. The dimming is the
 * load-bearing half; the caption names what the dimming already showed.
 */
function Provisional({
  certainty,
  tagTestID,
  label,
  children,
}: {
  readonly certainty: Certainty;
  readonly tagTestID: string;
  /**
   * The stat's own label, drawn between the number and the caption and NOT
   * dimmed with it — "DAY STREAK" is not provisional, the count is. Omitted
   * where the row already puts its label above the number.
   */
  readonly label?: string;
  readonly children: React.ReactNode;
}): React.ReactElement {
  const tag = tagTextFor(certainty);
  const target = certainty === 'projected' ? SESSION_BOUNDARY.PROJECTED_OPACITY : 1;
  const tagTarget = tag.trim().length === 0 ? 0 : 1;
  const weight = useSharedValue(target);
  const tagShown = useSharedValue(tagTarget);
  useEffect(() => {
    weight.value = withTiming(target, { duration: SESSION_BOUNDARY.CONFIRM_SETTLE_MS });
  }, [target, weight]);
  useEffect(() => {
    tagShown.value = withTiming(tagTarget, { duration: SESSION_BOUNDARY.TAG_FADE_MS });
  }, [tagTarget, tagShown]);
  const numberStyle = useAnimatedStyle(() => ({ opacity: weight.value }));
  const tagStyle = useAnimatedStyle(() => ({ opacity: tagShown.value }));
  const tagColour = certainty === 'stale' ? SESSION_PALETTE.UNSYNCED : SESSION_PALETTE.PROVISIONAL;
  return (
    <View style={styles.provisional}>
      <Animated.View style={numberStyle}>{children}</Animated.View>
      {label === undefined ? null : <Text style={styles.statLabel}>{label}</Text>}
      <Animated.View style={tagStyle}>
        <Text style={[styles.tag, { color: tagColour }]} testID={tagTestID}>
          {tag}
        </Text>
      </Animated.View>
    </View>
  );
}

export interface CloseOutViewProps {
  readonly closeOut: SessionCloseOut;
  /** What the record now says, read back through the progression boundary. */
  readonly readings: CloseOutReadings;
  readonly onDone: () => void;
  readonly onRetry: () => void;
}

export function CloseOutView({
  closeOut,
  readings,
  onDone,
  onRetry,
}: CloseOutViewProps): React.ReactElement {
  const payoff = readings.payoff;
  const e1rm = payoff.kind === 'e1rm' ? payoff : null;
  // PR-NESS IS THE READING'S, NOT THE CLOSE-OUT'S. `closeOut.isPr` is what the
  // client predicted; this is what the record actually did.
  const isPr = e1rm !== null && e1rm.isPr;

  // GDD §7.2's PR moment, offered. An ordinary day reports `achieved: false`
  // and the gate refuses it — the qualification is the gate's, not a condition
  // on this call.
  useOfferCutIn([{ kind: 'record', record: 'e1rm', achieved: isPr }]);

  const shownE1rm = useCountUp(
    e1rm?.countFromKg ?? 0,
    e1rm?.valueKg ?? e1rm?.countFromKg ?? 0,
    isPr ? SESSION_TUNING.CLOSE_OUT_E1RM_COUNT_MS : 0,
    SESSION_TUNING.CLOSE_OUT_ROW_STAGGER_MS,
  );

  const streakValue = readings.streakValue;
  const pop = useSharedValue(1);
  useEffect(() => {
    if (streakValue === null || streakValue === closeOut.streakBefore) return;
    pop.value = withDelay(
      SESSION_TUNING.CLOSE_OUT_ROW_STAGGER_MS * SESSION_TUNING.CLOSE_OUT_ROW_ORDER.STREAK,
      withSequence(
        withTiming(SESSION_TUNING.CLOSE_OUT_STREAK_POP_SCALE, {
          duration: SESSION_TUNING.CLOSE_OUT_STREAK_POP_MS / 2,
        }),
        withTiming(1, { duration: SESSION_TUNING.CLOSE_OUT_STREAK_POP_MS / 2 }),
      ),
    );
  }, [pop, streakValue, closeOut.streakBefore]);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  const headlineColour = isPr
    ? SESSION_PALETTE.PR
    : closeOut.canPropose
      ? SESSION_PALETTE.TEXT
      : SESSION_PALETTE.MISS;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      testID="session-close-out"
    >
      <Row index={SESSION_TUNING.CLOSE_OUT_ROW_ORDER.CALL}>
        <Text style={[styles.headline, { color: headlineColour }]} testID="close-out-headline">
          {closeOut.headline}
        </Text>
        <Text style={styles.subhead} testID="close-out-subhead">
          {closeOut.subhead}
        </Text>
      </Row>

      <Row index={SESSION_TUNING.CLOSE_OUT_ROW_ORDER.OUTLOOK}>
        <Text style={styles.statLabel}>{SESSION_COPY.CLOSE_OUT_OUTLOOK_LABEL}</Text>
        <Text style={styles.outlookHeadline} testID="close-out-outlook">
          {closeOut.outlookHeadline}
        </Text>
        {closeOut.outlookDetail === '' ? null : (
          <Text style={styles.feedback} testID="close-out-outlook-detail">
            {closeOut.outlookDetail}
          </Text>
        )}
      </Row>

      {e1rm !== null && e1rm.valueKg !== null ? (
        <Row index={SESSION_TUNING.CLOSE_OUT_ROW_ORDER.E1RM}>
          {/*
            WHICH LIFT THE NUMBER BELONGS TO, ON THE ELEMENT RATHER THAN IN THE
            COPY. `tools/verify-shell-route.mjs` reads this to know which of meet
            day's three openers the e1RM beside it should have decided; without
            it that tool would have to parse `LIFT_LABEL` out of the copy table,
            and a copy edit could turn a wrong opener into a right one. The
            screen renders the label exactly as before.
          */}
          <Text style={styles.statLabel} testID={`close-out-e1rm-lift-${e1rm.lift}`}>
            {`${SESSION_COPY.LIFT_LABEL[e1rm.lift]} ${SESSION_COPY.CLOSE_OUT_E1RM_LABEL}`}
          </Text>
          <Provisional certainty={e1rm.reading.kind} tagTestID="close-out-e1rm-tag">
            <View style={styles.numberRow}>
              <Text
                style={[styles.bigNumber, isPr ? styles.bigNumberPr : null]}
                testID="close-out-e1rm"
              >
                {shownE1rm.toFixed(SESSION_TUNING.E1RM_DISPLAY_DECIMALS)}
              </Text>
              <Text style={styles.unit}>kg</Text>
            </View>
          </Provisional>
        </Row>
      ) : null}

      {payoff.kind === 'training-iq' ? (
        <Row index={SESSION_TUNING.CLOSE_OUT_ROW_ORDER.E1RM}>
          <Text style={styles.statLabel}>{SESSION_BOUNDARY_COPY.ACCESSORY_LABEL}</Text>
          <Text style={styles.stat} testID="close-out-training-iq">
            {payoff.pointsGained === null
              ? SESSION_BOUNDARY_COPY.UNKNOWN_VALUE
              : `${payoff.pointsGained}`}
          </Text>
          <Text style={styles.feedback} testID="close-out-accessory-note">
            {SESSION_BOUNDARY_COPY.ACCESSORY_NOTE}
          </Text>
        </Row>
      ) : null}

      <View style={styles.divider} />

      <Row index={SESSION_TUNING.CLOSE_OUT_ROW_ORDER.STREAK}>
        <Provisional
          certainty={readings.streakDays.kind}
          tagTestID="close-out-streak-tag"
          label={SESSION_COPY.CLOSE_OUT_STREAK_LABEL}
        >
          <Animated.View style={popStyle}>
            <Text style={styles.stat} testID="close-out-streak">
              {streakValue === null ? SESSION_BOUNDARY_COPY.UNKNOWN_VALUE : `${streakValue}`}
            </Text>
          </Animated.View>
        </Provisional>
      </Row>

      <Row index={SESSION_TUNING.CLOSE_OUT_ROW_ORDER.REPS}>
        <Text style={styles.stat} testID="close-out-reps">
          {`${closeOut.goodReps} / ${closeOut.prescribedReps}`}
        </Text>
        <Text style={styles.statLabel}>{SESSION_COPY.CLOSE_OUT_REPS_LABEL}</Text>
        <Text style={styles.feedback} testID="close-out-feedback">
          {closeOut.barSpeedText}
        </Text>
      </Row>

      <Row index={SESSION_TUNING.CLOSE_OUT_ROW_ORDER.NEXT}>
        <Text style={styles.statLabel}>{SESSION_COPY.CLOSE_OUT_NEXT_LABEL}</Text>
        <Text style={styles.outlookHeadline} testID="close-out-next">
          {closeOut.nextAction.headline}
        </Text>
        {closeOut.nextAction.detail === '' ? null : (
          <Text style={styles.feedback} testID="close-out-next-detail">
            {closeOut.nextAction.detail}
          </Text>
        )}
      </Row>

      <Pressable
        style={styles.action}
        accessibilityRole="button"
        onPress={closeOut.canPropose ? onDone : onRetry}
        testID="close-out-action"
      >
        <Text style={styles.actionLabel}>
          {closeOut.canPropose ? SESSION_COPY.CLOSE_OUT_DONE : SESSION_COPY.CLOSE_OUT_RETRY}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    maxWidth: '100%',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: L.SCREEN_PAD,
    paddingBottom: L.NAV_CLEARANCE,
    gap: L.STAT_ROW_GAP,
  },
  row: {
    alignItems: 'center',
    gap: L.ROW_GAP / 2,
    width: '100%',
  },
  provisional: {
    alignItems: 'center',
    gap: L.ROW_GAP / 2,
  },
  tag: {
    fontSize: L.LABEL_FONT,
    letterSpacing: L.LETTER_SPACING,
  },
  headline: {
    color: SESSION_PALETTE.TEXT,
    fontSize: L.HEADLINE_FONT,
    fontWeight: '800',
    letterSpacing: L.LETTER_SPACING,
    textTransform: 'uppercase',
    textAlign: 'center',
    width: '100%',
    flexShrink: 1,
  },
  subhead: {
    color: SESSION_PALETTE.TEXT_DIM,
    fontSize: L.SUBHEAD_FONT,
    textAlign: 'center',
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: L.ROW_GAP / 2,
  },
  bigNumber: {
    color: SESSION_PALETTE.TEXT,
    fontSize: L.BIG_NUMBER_FONT,
    fontWeight: '700',
  },
  bigNumberPr: {
    color: SESSION_PALETTE.PR,
  },
  unit: {
    color: SESSION_PALETTE.TEXT_DIM,
    fontSize: L.UNIT_FONT,
    paddingBottom: L.ROW_GAP,
  },
  divider: {
    height: L.DIVIDER_HEIGHT,
    alignSelf: 'stretch',
    backgroundColor: SESSION_PALETTE.DIVIDER,
  },
  stat: {
    color: SESSION_PALETTE.TEXT,
    fontSize: L.STAT_FONT,
    fontWeight: '700',
  },
  statLabel: {
    color: SESSION_PALETTE.TEXT_DIM,
    fontSize: L.LABEL_FONT,
    letterSpacing: L.LETTER_SPACING,
  },
  feedback: {
    color: SESSION_PALETTE.TEXT_DIM,
    fontSize: L.SUBHEAD_FONT,
    textAlign: 'center',
    width: '100%',
    flexShrink: 1,
  },
  outlookHeadline: {
    color: SESSION_PALETTE.TEXT,
    fontSize: L.MODIFIER_FONT,
    fontWeight: '700',
    textAlign: 'center',
    width: '100%',
    flexShrink: 1,
  },
  action: {
    alignSelf: 'stretch',
    height: L.BUTTON_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: L.BUTTON_RADIUS,
    backgroundColor: SESSION_PALETTE.ACTION,
  },
  actionLabel: {
    color: SESSION_PALETTE.ACTION_TEXT,
    fontSize: L.BUTTON_FONT,
    fontWeight: '800',
    letterSpacing: L.LETTER_SPACING,
    textTransform: 'uppercase',
  },
});
