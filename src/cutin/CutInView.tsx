/**
 * CutInView.tsx — the interrupt, on screen.
 *
 * A THIN LAYER. It decides nothing: whether a cut-in fires is `cutInGate.ts`'s,
 * what it shows is `cutInArt.ts` (identity caption through §7.3) plus the
 * owned Iron & Amber still, and how long it lasts is `CutInHost.tsx`'s
 * timer. Its LAYOUT numbers are all `CUT_IN_LAYOUT`'s; the one number it takes
 * from anywhere else is `CUT_IN_TUNING.ENTER_MS`, the arrival duration, which
 * lives with the gate's other timings because it is a beat and not a box. What
 * is left here is one full-screen `Pressable`, an Iron & Amber still, and two
 * lines of type.
 *
 * ---------------------------------------------------------------------------
 * THE WHOLE SCREEN IS THE DISMISS TARGET
 * ---------------------------------------------------------------------------
 * GDD §7.2: "Always skippable — tap to dismiss. Daily players will see these
 * hundreds of times." So there is no close button in a corner and no minimum
 * hold: the `Pressable` is `absoluteFill` and its `onPress` IS the dismiss
 * handler. `cutInWiring.test.ts` reads this file and fails if the press handler
 * stops being the dismiss handler.
 *
 * WHERE THE FIRST-FRAME TAP IS ACTUALLY DECIDED, which is NOT here. This header
 * used to say `CUT_IN_TUNING.DISMISS_ENABLED_AFTER_MS` is zero "so the first
 * frame accepts a tap", and that causation was false: nothing on the route from
 * this `onPress` to the gate consulted a clock, so the first frame accepted a
 * tap because NO window was implemented, and setting the constant to 300 —
 * which `cutInTuning.ts` invites in writing — would have reddened two unit tests
 * and changed the behaviour of the app not at all. The window is now real and it
 * is the HOST's: `CutInHost.dismissByTap` measures the beat and asks
 * `tapDismissCutIn`, so the zero is what makes the first frame dismissible and
 * moving it is a change to what a player can do.
 *
 * The skip hint is PRINTED rather than implied, for the same "hundreds of
 * times" reason: a player who does not know the screen is tappable waits it
 * out, which is the tax the rule exists to remove.
 *
 * ---------------------------------------------------------------------------
 * THE PICTURE IS AN IRON & AMBER STILL, NOT A 16-BIT PORTRAIT
 * ---------------------------------------------------------------------------
 * A-VIS-03: the interrupt must leave 16-bit portrait language and sit in the
 * same stills system as check-in / briefing / the live set. GDD §7.1 remains
 * documented (owner ruling A-DES-01) and is not rewritten here. `renderCutIn`
 * still composes the Tier 3 grid for the table witness (GDD §7.2 / §7.3);
 * this view does not mount that grid, does not nearest-neighbour upscale it,
 * and does not draw the placeholder face as the interrupt.
 *
 * Identity copy still comes through `tier3Of(entry, live.slot, CUT_IN_SURFACE)`
 * — the same §7.3 door — so a licensed caption later is still a row in
 * `partners.ts`. The still file is `CUT_IN_ART.STILL`: owned JPEGs under
 * `assets/iron-amber/`, no third-party marks.
 *
 * It used to mount `renderPanel`, which is the character-select / shop
 * composition. THAT WAS A §7.3 DEFECT. GDD §7.2 rules on the shop panel by
 * name. This file still does not mount it.
 *
 * ---------------------------------------------------------------------------
 * THE SCRIM IS A SEPARATE LAYER FROM THE ARRIVAL
 * ---------------------------------------------------------------------------
 * `CUT_IN_LAYOUT.SCRIM_OPACITY` says how much of the screen behind is left
 * visible. It used to sit on the same node the arrival animation drives, which
 * applies `opacity` last and therefore won — so the constant was registered,
 * documented and read by no pixel. It is its own absolutely-positioned layer
 * now. `tools/capture-cutin.mjs` measures it on real frames: an overlay that
 * had gone opaque again would leave zero blended pixels behind it.
 *
 * THE PIXELS ARE IN THE REPOSITORY. `.gauntlet/shots/cutin/` is committed — ten
 * PNGs and `frames.json` — so a reader who goes looking for the evidence finds
 * it in a fresh checkout instead of being told to take it themselves. This
 * sentence has been wrong twice in opposite directions: it first claimed the
 * screen "has now been photographed" while `.gauntlet/shots/` was gitignored and
 * the directory existed on one machine, then went on denying the pictures were
 * here after `.gitignore` was amended to keep them. What is there now:
 *
 *     .gauntlet/shots/cutin/baseline-no-cutin.png     `?cutin=nonsense`, no overlay
 *     .gauntlet/shots/cutin/<moment>.png              one frozen frame per §7.2 moment
 *     .gauntlet/shots/cutin/live-mid-hold.png         the timer running
 *     .gauntlet/shots/cutin/live-after-auto-dismiss.png
 *     .gauntlet/shots/cutin/live-after-tap.png        a CORNER tap, not the centre
 *     .gauntlet/shots/cutin/played-*.png              the two played `?meet=` paths
 *     .gauntlet/shots/cutin/frames.json               every measurement below
 *
 * TO REGENERATE THEM, with the instrument that is also in the repo:
 *
 *     npx expo start --web        # then, against whatever port it prints
 *     node tools/capture-cutin.mjs --url http://localhost:8081
 *
 * That run measures what a source scan cannot — the four corners hit-tested with
 * `elementFromPoint`, whether the overlay is above the screen it interrupts, and
 * how many pixels survive `SCRIM_OPACITY` — writes the answers into
 * `frames.json`, and exits non-zero if any of it is wrong. `cutInWiring.test.ts`
 * fails if the directory this paragraph names stops being in the tree, so the
 * sentence cannot go stale a third time without something going red.
 *
 * WHAT THE PICTURES STILL DO NOT SETTLE. Whether it READS as an interrupt is a
 * playtest judgement (GDD §12.1): no critic can judge a beat it cannot feel, and
 * a screenshot is not a feeling. That is the whole of it now — this paragraph
 * used to add that the frames could not date themselves, which was true when it
 * was written and stopped being true in the same wave: `frames.json` now
 * carries `capturedFrom` (commit, branch, clean/dirty) and an `instrument`
 * digest of the tools that produced it, the same way
 * `.gauntlet/shots/shell/route.json` does, and `tools/evidence.mjs --verify`
 * fails on a record that is missing either, was captured dirty, stamps a commit
 * with code changes since, or reports its own run as red.
 */

import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import type { LicensingCatalogue } from '../licensing/catalogue';
import { tier3Of } from '../licensing/tiers';
import { LIFT_PALETTE } from '../lift/liftPalette';
import { SESSION_PALETTE } from '../session/sessionPalette';
import { CUT_IN_SURFACE, cutInIdentity } from './cutInArt';
import type { CutInMoment, LiveCutIn } from './cutInGate';
import { CUT_IN_ART, CUT_IN_COPY, CUT_IN_LAYOUT, CUT_IN_TUNING } from './cutInTuning';
import gymBriefing from '../../assets/iron-amber/gym-briefing.jpg';
import squatBrace from '../../assets/iron-amber/squat-brace.jpg';
import squatDrive from '../../assets/iron-amber/squat-drive.jpg';
import meetWalkThird from '../../assets/iron-amber/meet-squat-walk-third.jpg';

const L = CUT_IN_LAYOUT;

const STILL_SOURCE: Record<CutInMoment, number> = {
  'third-attempt-walkout': meetWalkThird,
  'personal-record': squatDrive,
  'bomb-out': gymBriefing,
  'coach-heavy-set': squatBrace,
};

function cutInCaption(catalogue: LicensingCatalogue, live: LiveCutIn): string {
  const entry = cutInIdentity(catalogue, live.identityId);
  return tier3Of(entry, live.slot, CUT_IN_SURFACE).caption;
}

export interface CutInViewProps {
  readonly live: LiveCutIn;
  readonly catalogue: LicensingCatalogue;
  /** Viewport width in logical points. The card sizes to it. */
  readonly availableWidth: number;
  /** GDD §7.2's "tap to dismiss". The whole screen calls this. */
  readonly onDismiss: () => void;
}

export function CutInView({
  live,
  catalogue,
  availableWidth,
  onDismiss,
}: CutInViewProps): React.ReactElement {
  const caption = React.useMemo(
    () => cutInCaption(catalogue, live),
    [catalogue, live],
  );
  const cardW = availableWidth - L.SCREEN_PAD * 2;

  // It CUTS in. A short rise rather than a fade-up, because §7.2's whole
  // argument is that the thing interrupts. `CUT_IN_TUNING.ENTER_MS`.
  const arrived = useSharedValue(0);
  React.useEffect(() => {
    arrived.value = 0;
    arrived.value = withTiming(1, { duration: CUT_IN_TUNING.ENTER_MS });
  }, [arrived, live]);
  const arrivalStyle = useAnimatedStyle(() => ({ opacity: arrived.value }));

  return (
    <Pressable
      style={StyleSheet.absoluteFill}
      onPress={onDismiss}
      accessibilityRole="button"
      accessibilityLabel={CUT_IN_COPY.SKIP_HINT}
      testID="cut-in"
    >
      <Animated.View style={[styles.root, arrivalStyle]}>
        {/*
          THE SCRIM IS ITS OWN LAYER, and it has to be. It used to be
          `opacity: L.SCRIM_OPACITY` on this same node, under the arrival
          animation's `{ opacity: arrived.value }` — which is applied last and
          therefore won, so once the enter timing completed the overlay sat at
          opacity 1 over an opaque backdrop and the registered tunable reached
          no pixel at all. Split out, the arrival animates the WHOLE overlay in
          and `SCRIM_OPACITY` decides how much of the interrupted screen shows
          through it, which is what its name has always claimed.

          Absolutely positioned, so it is out of the flex flow and takes no part
          in the `gap` or the centring, and drawn first so the panel and the
          copy sit on top of it at full weight.
        */}
        <View style={[StyleSheet.absoluteFill, styles.scrim]} testID="cut-in-scrim" />

        <View style={[styles.card, { width: cardW }]}>
          <View
            style={[styles.still, { width: cardW - L.CARD_PAD * 2, height: L.STILL_H }]}
            testID="cut-in-art"
          >
            <Image
              source={STILL_SOURCE[live.moment]}
              style={styles.stillImage}
              resizeMode="cover"
              accessible
              accessibilityRole="image"
              accessibilityLabel={caption}
              accessibilityHint={CUT_IN_ART.STILL[live.moment]}
            />
          </View>
          <Text style={styles.identity} testID="cut-in-identity">
            {caption}
          </Text>
          <Text style={styles.line} testID="cut-in-line">
            {CUT_IN_COPY.LINE[live.moment]}
          </Text>
          <Text style={styles.hint} testID="cut-in-skip-hint">
            {CUT_IN_COPY.SKIP_HINT}
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: L.ROW_GAP,
    paddingHorizontal: L.SCREEN_PAD,
  },
  /**
   * How much of the interrupted screen is left visible. NOT on `root`: the
   * arrival animation sets `opacity` on that node and would override it.
   */
  scrim: {
    backgroundColor: LIFT_PALETTE.BACKDROP,
    opacity: L.SCRIM_OPACITY,
  },
  card: {
    padding: L.CARD_PAD,
    borderRadius: L.CARD_RADIUS,
    borderWidth: L.CARD_EDGE,
    borderColor: SESSION_PALETTE.CARD_EDGE,
    backgroundColor: SESSION_PALETTE.CARD,
    gap: L.ROW_GAP,
    alignItems: 'center',
  },
  still: {
    overflow: 'hidden',
    borderRadius: L.STILL_RADIUS,
  },
  stillImage: {
    width: '100%',
    height: '100%',
  },
  identity: {
    color: SESSION_PALETTE.AMBER,
    fontSize: L.IDENTITY_FONT,
    fontWeight: '700',
    letterSpacing: L.LETTER_SPACING,
    textAlign: 'center',
  },
  line: {
    color: SESSION_PALETTE.IVORY,
    fontSize: L.LINE_FONT,
    fontWeight: '700',
    letterSpacing: L.LETTER_SPACING,
    textAlign: 'center',
  },
  hint: {
    color: SESSION_PALETTE.TEXT_DIM,
    fontSize: L.HINT_FONT,
    letterSpacing: L.LETTER_SPACING,
    opacity: L.HINT_OPACITY,
  },
});
