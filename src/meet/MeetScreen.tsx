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
 * The one branch that is not a phase is the card: `MeetRecap.card` is a built
 * `ResultCard` and `ResultCardScreen` takes one and nothing else, so the
 * hand-off GDD §6.5 asks for is a state flag here and no new rendering at all.
 */

import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ResultCardScreen } from '../card/ResultCardScreen';
import { meetLoadingRules } from '../game/meet';
import { MEET_COPY } from '../game/meetTuning';
import { WEIGHT_CLASSES_KG, lifterCategoryText, weightClassString } from '../game/resultCard';
import {
  attemptDecisionFor,
  lastAttempt,
  weighInFor,
  type MeetDayState,
} from '../game/meetDay';
import type { LiftResolution } from '../game/lift';
import { AttemptSelectView } from './AttemptSelectView';
import { AttemptView } from './AttemptView';
import { BombOutView } from './BombOutView';
import { MEET_PALETTE } from './meetPalette';
import { OpenersView } from './OpenersView';
import { RecapView } from './RecapView';
import { useMeetDay } from './useMeetDay';
import { VerdictView } from './VerdictView';
import { WalkoutView } from './WalkoutView';
import { WeighInView } from './WeighInView';
import { MEET_LAYOUT } from '../game/meetTuning';

const L = MEET_LAYOUT;

export interface MeetScreenProps {
  /**
   * DEBUG ONLY. Freezes the loop on one scripted beat instead of running a
   * played meet (see `meetPreview.ts`). Nothing in the played app passes this;
   * it arrives from the `?meet=` query string and exists so the renderer can be
   * photographed at moments a headless browser cannot reach.
   */
  readonly preview?: MeetDayState | undefined;
  /** DEBUG ONLY. Opens straight onto the shareable card. */
  readonly showCard?: boolean | undefined;
}

export function MeetScreen({ preview, showCard = false }: MeetScreenProps = {}): React.ReactElement {
  const loop = useMeetDay(preview, preview !== undefined);
  const { dispatch, restart } = loop;
  const state = preview ?? loop.state;
  const [cardOpen, setCardOpen] = useState(showCard);

  const onResolved = useCallback(
    (resolution: LiftResolution) => dispatch({ kind: 'lift-resolved', resolution }),
    [dispatch],
  );
  const onSeeCard = useCallback(() => setCardOpen(true), []);

  const entry = state.context.entry;
  const classes = WEIGHT_CLASSES_KG[entry.sex];
  const weighIn = weighInFor(entry, classes);
  const categoryText = lifterCategoryText({
    sex: entry.sex,
    division: entry.division,
    equipment: entry.equipment,
    weightClassText: weightClassString(entry.bodyweightKg, classes),
  });
  const decision = attemptDecisionFor(state.meet, state.context.previousBestByLiftKg);
  const judged = lastAttempt(state);
  const recap = loop.recap;

  if (cardOpen && recap !== null) {
    return <ResultCardScreen card={recap.card} />;
  }

  return (
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
          onChoose={(weightKg) => dispatch({ kind: 'declare', weightKg })}
        />
      ) : null}

      {state.phase === 'walkout' && state.live !== null ? (
        <WalkoutView
          attempt={state.live}
          liftLabel={MEET_COPY.LIFT_LABEL[state.live.lift]}
          barAndCollarsKg={meetLoadingRules(state.meet).barAndCollarsWeight[state.live.lift]}
        />
      ) : null}

      {state.phase === 'lift' ? <AttemptView state={state} onResolved={onResolved} /> : null}

      {(state.phase === 'deliberation' || state.phase === 'verdict') && judged !== null ? (
        <VerdictView
          attempt={judged}
          liftLabel={MEET_COPY.LIFT_LABEL[judged.lift]}
          revealed={state.phase === 'verdict'}
        />
      ) : null}

      {state.phase === 'bombed' ? (
        <BombOutView
          bombedLift={bombedLiftOf(state)}
          attempts={state.attempts}
          onDone={restart}
        />
      ) : null}

      {state.phase === 'recap' ? (
        recap === null ? (
          <View style={styles.waiting} testID="meet-recap-waiting">
            <Text style={styles.waitingText}>{MEET_COPY.RECAP_EYEBROW}</Text>
          </View>
        ) : (
          <RecapView recap={recap} attempts={state.attempts} onSeeCard={onSeeCard} />
        )
      ) : null}
    </View>
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
    backgroundColor: MEET_PALETTE.BACKDROP,
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
