/**
 * MeetScreen — meet day, GDD §6.1 through §6.5, end to end.
 *
 * ```
 * Weigh-in (§6.1)
 *   -> Openers, pre-filled from e1RM (§6.1)
 *   -> per attempt: bar loads + walk-out (§6.2.1)
 *                -> the rep, on the existing mechanic (§6.2.2-3)
 *                -> judges deliberate, three lights, feedback cue (§6.2.4-5)
 *                -> the next attempt is chosen (§6.3)
 *   -> recap and the shareable card (§6.5), or the bomb-out beat (§6.3)
 * ```
 *
 * ---------------------------------------------------------------------------
 * THIS FILE IS A ROUTER, NOT A SCREEN
 * ---------------------------------------------------------------------------
 * It reads `state.phase` and renders one of eight views. It computes nothing:
 * no weight, no legality, no lights, no total, no placing. CLAUDE.md forbids
 * deriving game state inside a `.tsx` file, and the whole of meet day's logic
 * is in `src/game/meetDay.ts` with the rules of the sport in `src/game/meet.ts`
 * behind it.
 *
 * The one branch that is not a phase is the card: `shareableResultCard`
 * attaches the flight to the recap's `ResultCard` (GDD §6.5 / §6.6) and
 * `ResultCardScreen` takes that card and nothing else. Ranking stays in
 * `meetBoard.ts`; this file still computes no Total and no place.
 *
 * ---------------------------------------------------------------------------
 * THE WHOLE MEET IS ONE CUT-IN SESSION (GDD §7.2)
 * ---------------------------------------------------------------------------
 * §7.2 caps cut-ins at "no more than one per session" and does not define
 * session. `src/cutin/cutInGate.ts` §3 rules that A MEET IS ONE — weigh-in to
 * recap, not one attempt and not one lift — and this is where that ruling is
 * applied: `CutInHost` wraps the entire router, so the three third-attempt
 * walk-outs, the recap and the bomb-out are all competing for a single slot
 * rather than getting one each. Counting an attempt as a session would allow
 * four cut-ins in ten minutes, which is the tax §7.2 is written against.
 *
 * The router still computes nothing: the session id and the seed are
 * `cutInGate.ts`'s functions of the meet day.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ResultCardScreen } from '../card/ResultCardScreen';
import { CutInHost } from '../cutin/CutInHost';
import { cutInSessionId, cutInSessionSeed } from '../cutin/cutInGate';
import { meetLoadingRules } from '../game/meet';
import { MEET_COPY } from '../game/meetTuning';
import { WEIGHT_CLASSES_KG, lifterCategoryText, weightClassString } from '../game/resultCard';
import { shareableResultCard } from '../game/resultFlight';
import {
  attemptDecisionFor,
  boardFor,
  flightOnDeckText,
  lastAttempt,
  stageLoadRatio,
  stakesForDecision,
  weighInFor,
  type MeetDayState,
} from '../game/meetDay';
import type { LiftResolution } from '../game/lift';
import { AttemptSelectView } from './AttemptSelectView';
import { AttemptView } from './AttemptView';
import { BombOutView } from './BombOutView';
import { MEET_PALETTE } from './meetPalette';
import { preloadMeetSound } from './meetSound';
import { OpenersView } from './OpenersView';
import { RecapView } from './RecapView';
import { useMeetDay } from './useMeetDay';
import type { MeetServerPort } from '../game/meetClient';
import { VerdictView } from './VerdictView';
import { WalkoutView } from './WalkoutView';
import { WeighInView } from './WeighInView';
import { MEET_LAYOUT, type KilogramMeetEntry, type MeetDefinition } from '../game/meetTuning';

const L = MEET_LAYOUT;

export interface MeetScreenProps {
  /**
   * THE APP'S CONNECTION TO THE SERVER. Required, exactly as `SessionScreen`'s
   * is, and required is the point.
   *
   * ---------------------------------------------------------------------------
   * IT USED NOT TO EXIST, AND THAT WAS THE DEFECT
   * ---------------------------------------------------------------------------
   * `AppShell` gave `SessionScreen` a `serverPort` and gave this screen no port,
   * no record and no cache, so `useMeetDay` built a `ServerRecord` of its own on
   * mount and meet day played a lifter who had never trained a day: the signup
   * seed's openers on day 1 and on day 400, FIRST TOTAL after every meet, and
   * GDD §6.3's PR attempt permanently impossible. `meetClient.ts`'s header has
   * the full account.
   *
   * REQUIRED RATHER THAN OPTIONAL-WITH-A-DEFAULT, on the same reasoning
   * `AppShell.search` is required: an optional port would let `<MeetScreen />`
   * typecheck and silently reopen the hole, and a default value would BE the
   * fabricated lifter. `tsc` now says `Property 'serverPort' is missing`.
   *
   * On the capture path this is the preview's own stand-in server, which arrives
   * with the frozen frame rather than beside it — see `shellRoute.ts`'s
   * `MeetEntry.serverPort`.
   */
  readonly serverPort: MeetServerPort;
  /**
   * WHICH MEET IS BEING LIFTED. Required on the port's own reasoning: an
   * optional meet with a default would let this screen conjure `MEET_LOCAL`
   * and silently reopen the one ungated door Sprint 1c deletes. The router
   * hands the meet the player entered from the Career calendar
   * (`careerMeet.ts`'s adapter); the capture path hands its own fixture.
   */
  readonly meet: MeetDefinition;
  /**
   * Who walks onto this platform. Career Meet supplies the profile-derived
   * entry. Omitted, the hook uses the `MEET_ENTRY` fixture (tests and debug).
   */
  readonly entry?: KilogramMeetEntry | undefined;
  /**
   * DEBUG ONLY. Freezes the loop on one scripted beat instead of running a
   * played meet (see `meetPreview.ts`). Nothing in the played app passes this;
   * it arrives from the `?meet=` query string and exists so the renderer can be
   * photographed at moments a headless browser cannot reach.
   */
  readonly preview?: MeetDayState | undefined;
  /** DEBUG ONLY. Opens straight onto the shareable card. */
  readonly showCard?: boolean | undefined;
  /**
   * DEBUG ONLY. Holds the walk-out's choreography at one instant instead of
   * running its clock, so the capture can photograph the beat mid-unrack and
   * mid-step-back rather than only after it has settled. Nothing in the played
   * app passes this; it arrives from `?meet=` beside `preview`, and
   * `meetPreview.ts`'s `holdWalkoutAtMs` decides it.
   */
  readonly holdWalkoutAtMs?: number | null | undefined;
  /**
   * Where the lifter goes when the meet is over.
   *
   * SUPPLIED BY THE ROUTER, because this file is a renderer and all routing in
   * the app lives in `src/shell/`. Omitted, the buttons restart the meet — which
   * is honest for a harness but is NOT what "BACK TO TRAINING" means, so the
   * played build passes one. The real destination is the Career calendar's, and
   * that piece is out of this one's scope (GDD §6.1).
   */
  readonly onLeave?: (() => void) | undefined;
  /**
   * Reports which beat of GDD §6 the meet is on, for the shell's chrome gate.
   *
   * ROUTING INFORMATION, not state. §6.5's recap and the result card behind it
   * have no way out of their own — `onSeeCard` is the recap's only action — so
   * the shell draws the way back, and it must not draw one over a live attempt.
   * It may not derive the beat either: meet-day state belongs to `meetDay.ts`.
   * This screen tells it, and tells it nothing else.
   *
   * §6.3's bomb-out is deliberately excluded by the shell (`SHELL_NAV`): that
   * beat draws its own way out, through `onLeave` above.
   */
  readonly onPhase?: ((phase: MeetDayState['phase']) => void) | undefined;
  /**
   * Reports whether a GDD §7.2 cut-in is on screen, for the shell's chrome gate.
   *
   * The same kind of thing as `onPhase` and forwarded straight to `CutInHost`,
   * which owns the answer. The shell's pill is a sibling of this whole screen
   * and paints above the overlay, so a tap meant to dismiss an interrupt would
   * navigate instead — see `shellAffordanceFor`.
   */
  readonly onCutIn?: ((live: boolean) => void) | undefined;
  /**
   * `window.location.search`, for the `?cutin=` debug route only.
   *
   * Passed down rather than read here, so `App.tsx` stays the one platform edge.
   * Omitted, `CutInHost` falls back to its own read, which is what a standalone
   * render wants.
   */
  readonly cutInSearch?: string | null | undefined;
}

export function MeetScreen({
  serverPort,
  meet,
  entry: enteredEntry,
  preview,
  showCard = false,
  holdWalkoutAtMs = null,
  onLeave,
  onPhase,
  onCutIn,
  cutInSearch,
}: MeetScreenProps): React.ReactElement {
  const loop = useMeetDay(serverPort, meet, preview, preview !== undefined, enteredEntry);
  const { dispatch, restart } = loop;
  const state = preview ?? loop.state;
  const [cardOpen, setCardOpen] = useState(showCard);

  // WARM THE CUES WHEN MEET DAY OPENS, and nowhere else.
  //
  // `preloadMeetSound` says it exists "so the first plate of the meet is not the
  // slow one", and until now nothing outside a test called it, which made that
  // sentence false. The weigh-in is the right place: it is the first screen of
  // the meet and it is several seconds and one press away from the first plate
  // landing, so every player decodes the files during a beat that is waiting for
  // them anyway. It is fire-and-forget — `playerFor` swallows a platform that
  // refuses, because sound must never take a screen down.
  useEffect(() => preloadMeetSound(), []);

  useEffect(() => {
    onPhase?.(state.phase);
  }, [onPhase, state.phase]);

  const onResolved = useCallback(
    (resolution: LiftResolution) => dispatch({ kind: 'lift-resolved', resolution }),
    [dispatch],
  );
  const onSeeCard = useCallback(() => setCardOpen(true), []);
  const leave = useCallback(() => {
    if (onLeave === undefined) restart();
    else onLeave();
  }, [onLeave, restart]);

  const entry = state.context.entry;
  const classes = WEIGHT_CLASSES_KG[entry.sex];
  const weighIn = weighInFor(entry, classes);
  const categoryText = lifterCategoryText({
    sex: entry.sex,
    division: entry.division,
    equipment: entry.equipment,
    weightClassText: weightClassString(entry.bodyweight.kilograms, classes),
  });
  const decision = attemptDecisionFor(state.meet, state.context.previousBestByLiftKg);
  const judged = lastAttempt(state);
  const recap = loop.recap;
  const board = boardFor(state);
  const onDeckName = flightOnDeckText(state);
  const stakesByOptionId =
    decision === null
      ? {}
      : Object.fromEntries(
          decision.options.map((option) => [option.id, stakesForDecision(state, decision, option)]),
        );

  if (cardOpen && recap !== null) {
    return <ResultCardScreen card={shareableResultCard(state, recap)} />;
  }

  return (
    <CutInHost
      sessionId={cutInSessionId('meet', state.context.day)}
      seed={cutInSessionSeed('meet', state.context.day)}
      search={cutInSearch}
      onLive={onCutIn}
    >
      <View style={styles.root} testID="meet-screen">
        {state.phase === 'weigh-in' ? (
          <WeighInView
            weighIn={weighIn}
            lifterName={entry.name}
            meetName={state.context.meet.name}
            federation={state.context.meet.federation}
            categoryText={categoryText}
            onConfirm={() => dispatch({ kind: 'confirm-weigh-in' })}
          />
        ) : null}

        {state.phase === 'openers' ? (
          <OpenersView
            openersKg={state.openersKg}
            overridden={state.openerOverridden}
            stepKg={meetLoadingRules(state.meet).declarationIncrement}
            onSet={(lift, weightKg) => dispatch({ kind: 'set-opener', lift, weightKg })}
            onConfirm={() => dispatch({ kind: 'confirm-openers' })}
          />
        ) : null}

        {state.phase === 'attempt-select' && decision !== null ? (
          <AttemptSelectView
            decision={decision}
            board={board}
            onDeckName={onDeckName}
            stakesByOptionId={stakesByOptionId}
            onChoose={(weightKg) => dispatch({ kind: 'declare', weightKg })}
          />
        ) : null}

        {state.phase === 'walkout' && state.live !== null ? (
          <WalkoutView
            attempt={state.live}
            liftLabel={MEET_COPY.LIFT_LABEL[state.live.lift]}
            barAndCollarsKg={meetLoadingRules(state.meet).barAndCollarsWeight[state.live.lift]}
            loadRatio={state.live.loadRatio}
            holdAtMs={holdWalkoutAtMs}
            onDeckName={onDeckName}
          />
        ) : null}

        {state.phase === 'lift' && state.live !== null ? (
          <AttemptView
            state={state}
            // THE SAME EXPRESSION THE WALK-OUT ABOVE IS HANDED, and it is here
            // rather than inside `AttemptView` because this file is the one that
            // reads `meetLoadingRules`. The attempt needs it to find out what the
            // walk-out left the hall at (see `settledCrowdRisePx`).
            barAndCollarsKg={meetLoadingRules(state.meet).barAndCollarsWeight[state.live.lift]}
            onResolved={onResolved}
          />
        ) : null}

        {(state.phase === 'deliberation' || state.phase === 'verdict') && judged !== null ? (
          <VerdictView
            attempt={judged}
            liftLabel={MEET_COPY.LIFT_LABEL[judged.lift]}
            revealed={state.phase === 'verdict'}
            barAndCollarsKg={meetLoadingRules(state.meet).barAndCollarsWeight[judged.lift]}
            loadRatio={stageLoadRatio(state.context, judged.lift, judged.weightKg)}
          />
        ) : null}

        {state.phase === 'bombed' ? (
          <BombOutView
            bombedLift={bombedLiftOf(state)}
            attempts={state.attempts}
            onDone={leave}
          />
        ) : null}

        {state.phase === 'recap' ? (
          recap === null ? (
            loop.submissionError !== null ? (
              // A REFUSED SUBMISSION IS DISCLOSED, NOT DRESSED UP. The server's
              // own sentence, verbatim — the contract every career refusal
              // already follows — with the shell's BACK TO TRAINING as the way
              // out. GDD §6.1's placeholder stood here while the calendar did
              // not exist; the calendar exists, its eligibility gate refuses a
              // re-entry BEFORE a meet is wasted on it, so any refusal that
              // still reaches this arm is a defect the player should see named
              // rather than a screen pretending otherwise.
              <View style={styles.waiting} testID="meet-refused">
                <Text style={styles.waitingText}>{loop.submissionError.message}</Text>
              </View>
            ) : (
              <View style={styles.waiting} testID="meet-recap-waiting">
                <Text style={styles.waitingText}>{MEET_COPY.RECAP_EYEBROW}</Text>
              </View>
            )
          ) : (
            <RecapView
              recap={recap}
              attempts={state.attempts}
              // The server's own account of what this result did to the career
              // (GDD §6.5, Sprint 1b). `applied` and `recap` settle together —
              // the recap is built FROM `applied` — so a drawn recap always has
              // the outcome beside it; `?? null` is for the type, not a path.
              career={loop.applied?.career ?? null}
              onSeeCard={onSeeCard}
            />
          )
        ) : null}
      </View>
    </CutInHost>
  );
}

/**
 * Which lift ended the meet, from the ENGINE's outcome rather than by counting
 * misses here. `meet.ts` decides what a bomb-out is (GDD §6.3) and this only
 * reads it.
 */
function bombedLiftOf(state: MeetDayState): 'squat' | 'bench' | 'deadlift' {
  const phase = state.meet.phase;
  if (phase.kind === 'complete' && phase.outcome.kind === 'bombed-out') {
    return phase.outcome.bombedLift;
  }
  // Unreachable: `stepMeetDay` only enters the 'bombed' phase from that outcome.
  return 'squat';
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: MEET_PALETTE.ESPRESSO,
  },
  waiting: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waitingText: {
    color: MEET_PALETTE.TEXT_DIM,
    fontSize: L.EYEBROW_FONT,
    letterSpacing: L.WIDE_LETTER_SPACING,
  },
});
