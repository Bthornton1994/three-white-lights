/**
 * LiftScreen — the playable rep.
 *
 * GDD §10 Prototype 1: "One lift. Timing/bar-path mechanic only. No
 * progression, no meta, no art, no backend." This is that, with the sprite
 * system already in the repo standing in for "no art".
 *
 * ---------------------------------------------------------------------------
 * THE WHOLE INTERACTION IS ONE TOUCH
 * ---------------------------------------------------------------------------
 * Press and hold to descend. Release at depth. Tap to drive through the
 * sticking point. That is the entire control scheme, and it is
 * deliberately the thing GDD §12.1 names — "pressing the screen to grind out a
 * squat" — rather than a set of buttons.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS FILE IS AND IS NOT ALLOWED TO KNOW
 * ---------------------------------------------------------------------------
 * It renders `LiftState` and forwards touches. It does not decide anything: no
 * window is computed here, no outcome is judged here, no load is calculated
 * here. CLAUDE.md: "If you find yourself computing a load or a fatigue modifier
 * inside a .tsx file, stop and move it to a pure TypeScript module."
 *
 * NO FATIGUE METER (GDD §3.4, §12.3). Nothing on this screen displays a fatigue
 * level, a readiness score or a risk percentage, and there is no number here
 * derived from one. Fatigue is felt as a narrower cue ring and a slower bar,
 * which is the whole of what §3.4 permits.
 *
 * NOTHING HERE IS PURCHASABLE. The load selector is the player choosing how
 * heavy to go, which is GDD §3.3's RPE choice in prototype form. There is no
 * currency, no boost, and no input that can be bought (GDD §8.1).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import {
  LIFT_COPY,
  LIFT_TUNING,
} from '../game/liftTuning';
import { promptFor, type LiftOutcome, type LiftState } from '../game/lift';
import { LIFT_PALETTE } from './liftPalette';
import { LiftStage } from './LiftStage';
import { totalKgFor } from './liftFrame';
import { PRESS_NOT_SELECT, PRESS_NOT_TAKEN, SUPPRESS_CONTEXT_MENU } from './pressGuard';
import {
  captureFrameFor,
  replayProbeJson,
  type CaptureFrame,
  type ReplayRequest,
} from './liftReplay';
import { useLiftLoop } from './useLiftLoop';

const L = LIFT_TUNING.LAYOUT;
const DEMO = LIFT_TUNING.DEMO;

const OUTCOME_COLOUR: Record<LiftOutcome, string> = {
  'good-lift': LIFT_PALETTE.GOOD,
  grind: LIFT_PALETTE.GRIND,
  miss: LIFT_PALETTE.MISS,
};

/**
 * One judging light.
 *
 * Reanimated (CLAUDE.md and GDD §9.1, "Reanimated 4 for animation") rather than the sim
 * clock, because this is the only motion on the screen that is NOT part of the
 * rep: the rep has already resolved by the time it plays. Everything that
 * belongs to the lift itself is driven by `stepLift` so it cannot drift out of
 * step with the bar; a light coming up afterwards has nothing to stay in step
 * with.
 */
function Light({
  index,
  lit,
  colour,
}: {
  readonly index: number;
  readonly lit: boolean;
  readonly colour: string;
}): React.ReactElement {
  const progress = useSharedValue(0);
  const f = LIFT_TUNING.FEEDBACK;

  useEffect(() => {
    progress.value = lit
      ? withDelay(
          index * f.LIGHT_REVEAL_STAGGER_MS,
          withTiming(1, { duration: f.OUTCOME_FADE_MS }),
        )
      : withTiming(0, { duration: f.OUTCOME_FADE_MS });
  }, [lit, index, progress, f.LIGHT_REVEAL_STAGGER_MS, f.OUTCOME_FADE_MS]);

  const animated = useAnimatedStyle(() => ({
    // Pops in slightly oversized and settles, which is what makes a light read
    // as switching on rather than fading up.
    transform: [{ scale: f.LIGHT_POP_SCALE - (f.LIGHT_POP_SCALE - 1) * progress.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.light,
        animated,
        { backgroundColor: colour, borderColor: LIFT_PALETTE.LIGHT_EDGE },
      ]}
    />
  );
}

/**
 * The three lights.
 *
 * A make is three whites, a miss is three reds, revealed one after another.
 * Real judging — split decisions, the deliberation beat, depth cameras — is
 * meet day (GDD §6.2) and belongs to that piece; this is the payoff beat the
 * isolated mechanic needs so a rep ends with something rather than trailing off.
 */
function Lights({ outcome }: { readonly outcome: LiftOutcome | null }): React.ReactElement {
  const colour =
    outcome === null
      ? LIFT_PALETTE.LIGHT_OFF
      : outcome === 'miss'
        ? LIFT_PALETTE.LIGHT_RED
        : LIFT_PALETTE.LIGHT_WHITE;
  return (
    <View style={styles.lights} testID="lift-lights">
      {[0, 1, 2].map((i) => (
        <Light key={i} index={i} lit={outcome !== null} colour={colour} />
      ))}
    </View>
  );
}

function Timings({ state }: { readonly state: LiftState }): React.ReactElement | null {
  if (state.timings.length === 0) return null;
  return (
    <View style={styles.timings}>
      {state.timings.map((t) => (
        <Text key={t.cue} style={styles.grade}>
          {`${t.cue.toUpperCase()}  ${LIFT_COPY.GRADE[t.grade]}`}
        </Text>
      ))}
    </View>
  );
}

/**
 * The off-screen record of what a captured frame ACTUALLY shows.
 *
 * Rendered only under `?replay=`. Zero-sized and fully transparent, so it
 * cannot change a single captured pixel, but present in the DOM — which is what
 * lets `tools/capture-lift.mjs` check that a sequence of shots is semantically
 * distinct rather than merely byte-distinct. A hash comparison already passed on
 * three copies of one resolved frame; this is the check that would not have.
 */
function ReplayProbe({ frame }: { readonly frame: CaptureFrame }): React.ReactElement {
  return (
    <View style={styles.probe} testID="lift-replay-probe">
      <Text testID="lift-replay-probe-json">{replayProbeJson(frame)}</Text>
    </View>
  );
}

export interface LiftScreenProps {
  /**
   * DEBUG ONLY. Freezes the screen on one beat of a scripted rep instead of
   * running the live clock (see `liftReplay.ts`). Nothing in the played app
   * passes this; it arrives from the `?replay=` query string and exists so the
   * renderer can be photographed at moments a wall clock cannot hit.
   *
   * While it is set the touch handlers and the load buttons are inert — the
   * clock is stopped, so there is nothing for them to advance. That is
   * intentional: a frozen frame that could be nudged by a stray click would not
   * be reproducible evidence.
   */
  readonly replay?: ReplayRequest | undefined;
}

export function LiftScreen({ replay }: LiftScreenProps = {}): React.ReactElement {
  const frame = useMemo(
    () => (replay === undefined ? null : captureFrameFor(replay)),
    [replay],
  );
  const replayLoadIndex = frame === null ? -1 : DEMO.LOAD_CHOICES.indexOf(frame.state.config.loadRatio);

  const [loadIndex, setLoadIndex] = useState<number>(
    replayLoadIndex < 0 ? DEMO.DEFAULT_LOAD_INDEX : replayLoadIndex,
  );
  const loadRatio = DEMO.LOAD_CHOICES[loadIndex] ?? DEMO.LOAD_CHOICES[0] ?? 1;

  const loop = useLiftLoop(
    // SQUAT ONLY. This is the standalone Prototype-1 demo harness (GDD §10),
    // not the session path — `SetView`/`repConfigFor` is what actually plays
    // a prescribed kind. A kind selector here is a separate piece if this
    // screen is ever used to demo bench.
    useMemo(() => ({ kind: 'squat' as const, loadRatio, seed: DEMO.BEST_SINGLE_KG }), []),
    frame !== null,
  );
  const { onPressIn, onPressOut, restart } = loop;
  const state = frame === null ? loop.state : frame.state;
  const history = frame === null ? loop.history : frame.history;

  const totalKg = totalKgFor(state.config.loadRatio, DEMO.BEST_SINGLE_KG);
  const resolution = state.resolution;
  const resolved = state.phase === 'RESOLVED';

  const chooseLoad = useCallback(
    (index: number) => {
      setLoadIndex(index);
      restart(DEMO.LOAD_CHOICES[index] ?? loadRatio);
    },
    [restart, loadRatio],
  );

  /**
   * One touch does both jobs: it retries a finished rep AND starts the next
   * one's descent, so a player can hold through from the retry tap.
   *
   * `restart` deliberately does not queue that press itself. It used to, and
   * the consequence was that tapping a LOAD BUTTON — which also restarts —
   * put a phantom finger on the stage: the descent began the moment the brace
   * ended, before the player had touched the lifter at all. Restarting and
   * pressing are two things, and only the stage does both.
   */
  const handlePressIn = useCallback(() => {
    if (resolved) restart(loadRatio);
    onPressIn();
  }, [resolved, restart, loadRatio, onPressIn]);

  return (
    <View style={styles.root} testID="lift-screen" {...SUPPRESS_CONTEXT_MENU}>
      {frame === null ? null : <ReplayProbe frame={frame} />}
      <Lights outcome={resolution === null ? null : resolution.outcome} />

      <View style={styles.header}>
        <Text style={styles.weight} testID="lift-weight">
          {`${totalKg} kg`}
        </Text>
        <Text
          style={[
            styles.prompt,
            resolution === null
              ? null
              : [styles.headline, { color: OUTCOME_COLOUR[resolution.outcome] }],
          ]}
          testID="lift-prompt"
        >
          {resolution === null ? promptFor(state) : resolution.headline}
        </Text>
        <Text style={styles.detail} testID="lift-detail">
          {resolution === null || resolution.detail === ''
            ? LIFT_COPY.SUBTITLE[state.config.kind]
            : resolution.detail}
        </Text>
        {/* The retry hint. Its own line so a miss can show BOTH why it failed
            and what to do next; folding them into one line dropped one or the
            other depending on the outcome. */}
        <Text style={styles.retry} testID="lift-retry">
          {resolution === null ? '' : promptFor(state)}
        </Text>
      </View>

      <Pressable
        style={styles.stage}
        onPressIn={handlePressIn}
        onPressOut={onPressOut}
        testID="lift-touch"
      >
        <LiftStage state={state} history={history} totalKg={totalKg} />
      </Pressable>

      <Timings state={state} />

      <View style={styles.loads} testID="lift-loads">
        {DEMO.LOAD_CHOICES.map((choice, index) => (
          <Pressable
            key={choice}
            onPress={() => chooseLoad(index)}
            style={[
              styles.loadButton,
              index === loadIndex ? styles.loadButtonActive : null,
            ]}
          >
            <Text style={styles.loadLabel}>
              {`${totalKgFor(choice, DEMO.BEST_SINGLE_KG)}`}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/**
 * A PRESS ON THE STAGE IS A LIFT INPUT, NOT A TEXT SELECTION.
 *
 * FROM PLAYTESTING, NOT FROM REASONING — the first human verdict this build has
 * had (GDD §12.1). On a mobile browser, pressing and holding the stage
 * triggered the browser's own selection gesture: the surface highlighted, a
 * selection handle appeared, and the press was being fought over between the
 * page and the game. The squat asks for a press-and-hold *by design* — that is
 * the descent — so the one input this mechanic is built on is exactly the one a
 * browser reads as "the user wants to select something".
 *
 * THE CONSTANTS MOVED, AND THAT MOVE IS THE POINT OF THIS PARAGRAPH. They used
 * to be declared here, as one object spread onto `styles.stage`. This screen is
 * the REPLAY HARNESS: `AppShell.tsx` mounts it behind `route.surface ===
 * 'replay'`, which `shellRoute.ts` builds with `source: 'debug'`. So the fix for
 * a defect a player reported was declared on the one lift surface a player
 * cannot open, and `SetView` and `AttemptView` — the daily set and the meet
 * attempt — carried none of it while the guard here stayed green.
 *
 * They now live in `./pressGuard`, applied identically by all three screens and
 * checked by a guard that discovers its subjects rather than naming this file.
 * The split into two objects is a fact about which properties inherit; that
 * module's header has it, and this one does not restate it.
 *
 * WHY THE HARNESS KEEPS THEM AT ALL, rather than the fix being moved to the two
 * played screens and deleted from here: this screen is pressed. `capture-lift.
 * mjs`, `verify-lift-shots.mjs` and `verify-lift-press.mjs`'s debug arm all
 * drive `lift-touch`, and the last of those compares the two arms directly —
 * with the fix removed from here, that comparison would be two unfixed surfaces
 * agreeing with each other, which is the same reading as two fixed ones.
 *
 * WHAT THIS DOES NOT FIX, stated because the playtest raised both together: the
 * separate finding that players were unclear HOW to perform the down-and-back-up
 * motion is a design question, not this. Fixing the input capture may change how
 * bad that reads — some of "confusing" may have been people fighting the
 * browser — and that is a question for a re-test, not an assumption to build on.
 */
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: LIFT_PALETTE.BACKDROP,
    alignItems: 'center',
    paddingTop: L.SCREEN_PAD,
    // The INHERITED half, on the root so it reaches the copy — see
    // `./pressGuard`. On the stage it would reach only the Skia canvas, where
    // no selection is possible in the first place.
    ...PRESS_NOT_SELECT,
  },
  /**
   * The capture probe. Absolute, zero-sized, fully transparent and clipped, so
   * it occupies no layout and draws no pixel — the shot is of the shipped
   * screen, not of a screen with a debug readout on it.
   */
  probe: {
    position: 'absolute',
    width: 0,
    height: 0,
    opacity: 0,
    overflow: 'hidden',
  },
  lights: {
    flexDirection: 'row',
    gap: L.LIGHT_GAP - L.LIGHT_R * 2,
    height: L.LIGHT_R * 2,
  },
  light: {
    width: L.LIGHT_R * 2,
    height: L.LIGHT_R * 2,
    borderRadius: L.LIGHT_R,
    borderWidth: L.LIGHT_STROKE,
  },
  header: {
    alignItems: 'center',
    gap: L.ROW_GAP / 2,
    paddingVertical: L.ROW_GAP,
  },
  weight: {
    color: LIFT_PALETTE.TEXT_DIM,
    fontSize: L.LABEL_FONT,
    letterSpacing: L.LETTER_SPACING,
  },
  prompt: {
    color: LIFT_PALETTE.TEXT,
    fontSize: L.PROMPT_FONT,
    fontWeight: '700',
    letterSpacing: L.LETTER_SPACING,
  },
  /** The resolved call. Bigger than the prompt it replaces — it is the payoff. */
  headline: {
    fontSize: L.HEADLINE_FONT,
  },
  detail: {
    color: LIFT_PALETTE.TEXT_DIM,
    fontSize: L.DETAIL_FONT,
  },
  retry: {
    color: LIFT_PALETTE.TEXT_DIM,
    fontSize: L.LABEL_FONT,
    letterSpacing: L.LETTER_SPACING,
    height: L.LABEL_FONT * 2,
  },
  stage: {
    width: L.STAGE_W,
    height: L.STAGE_H,
    // The half that does NOT inherit, so it has to be here, on the element the
    // press lands in. Spread rather than conditionally applied so the key set
    // does not depend on where this file is read from.
    ...PRESS_NOT_TAKEN,
  },
  timings: {
    flexDirection: 'row',
    gap: L.ROW_GAP * 2,
    paddingTop: L.ROW_GAP,
    height: L.GRADE_FONT * 2,
  },
  grade: {
    color: LIFT_PALETTE.TEXT_DIM,
    fontSize: L.GRADE_FONT,
    letterSpacing: L.LETTER_SPACING,
  },
  loads: {
    flexDirection: 'row',
    gap: L.ROW_GAP,
    // Pinned to the bottom of the screen rather than left floating under the
    // stage: a thumb reaching a load button must not stray into the touch area
    // the rep is played with.
    marginTop: 'auto',
    marginBottom: L.SCREEN_PAD * 2,
  },
  loadButton: {
    backgroundColor: LIFT_PALETTE.BUTTON,
    paddingVertical: L.BUTTON_PAD_V,
    paddingHorizontal: L.BUTTON_PAD_H,
    borderRadius: L.BUTTON_RADIUS,
  },
  loadButtonActive: {
    backgroundColor: LIFT_PALETTE.BUTTON_ACTIVE,
  },
  loadLabel: {
    color: LIFT_PALETTE.TEXT,
    fontSize: L.BUTTON_FONT,
    letterSpacing: L.LETTER_SPACING,
  },
});
