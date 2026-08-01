/**
 * sampleCards.ts — two finished meets, for the screenshot harness and the
 * inspection screen.
 *
 * PURE, and deliberately built by RUNNING THE MEET ENGINE rather than by
 * hand-writing a state object. Every attempt below goes through
 * `declareAttempt` / `resolveAttempt`, so a fixture that broke a competition
 * rule — an attempt going down inside a lift, a fourth attempt, lifts out of
 * order — would throw here instead of quietly producing a card that looks fine
 * and is wrong.
 *
 * The lifters, the federation and the meet are INVENTED. GDD §11 still has
 * "invented feds, or is there licensing value in real ones (USAPL, USPA, NPL)?"
 * open, so nothing here uses a real federation's name or a real lifter's.
 */

import {
  buildResultCard,
  type ResultCard,
  type ResultCardInput,
  type ResultCardMeetInput,
} from '../game/resultCard';
import {
  createMeet,
  declareAttempt,
  resolveAttempt,
  type JudgePanel,
  type MeetState,
} from '../game/meet';

const GOOD: JudgePanel = ['white', 'white', 'white'];
const SPLIT: JudgePanel = ['white', 'red', 'white'];
const NO_LIFT: JudgePanel = ['red', 'red', 'red'];

function take(state: MeetState, weight: number, lights: JudgePanel): MeetState {
  const declared = declareAttempt(state, { weight });
  if (!declared.ok) throw new Error(`sampleCards: declare ${weight} — ${declared.error.message}`);
  const judged = resolveAttempt(declared.value, { lights });
  if (!judged.ok) throw new Error(`sampleCards: resolve ${weight} — ${judged.error.message}`);
  return judged.value;
}

function runMeet(attempts: readonly (readonly [number, JudgePanel])[]): MeetState {
  return attempts.reduce<MeetState>((state, [weight, lights]) => take(state, weight, lights), createMeet());
}

function build(input: ResultCardInput): ResultCard {
  const result = buildResultCard(input);
  if (!result.ok) throw new Error(`sampleCards: ${result.error.code} — ${result.error.message}`);
  return result.card;
}

const MEET: ResultCardMeetInput = {
  federation: 'Irongate',
  name: 'National Championships',
  dateIso: '2026-02-14',
  town: 'Sheffield',
  country: 'England',
};

/**
 * A strong meet: nine attempts taken, one missed third on the squat, a split
 * decision on a bench third, a 755 kg total and a win.
 */
export const STRONG_MEET_CARD: ResultCard = build({
  meet: MEET,
  lifter: {
    name: 'Marcus Vale',
    sex: 'male',
    bodyweightKg: 92.4,
    division: 'Open',
    equipment: 'Raw',
  },
  state: runMeet([
    [250, GOOD],
    [265, GOOD],
    [275, NO_LIFT],
    [160, GOOD],
    [170, GOOD],
    [177.5, SPLIT],
    [280, GOOD],
    [300, GOOD],
    [312.5, GOOD],
  ]),
  placing: 1,
});

/**
 * A bomb-out on the bench, after a squat that was going well.
 *
 * `totalOnTheBoard` is 145 kg at the moment the meet ends, which is exactly the
 * plausible-looking number a card must NOT print. There is no total, no DOTS
 * and no placing — the place column reads DQ.
 */
export const BOMBED_MEET_CARD: ResultCard = build({
  meet: MEET,
  lifter: {
    name: 'Dana Whitmore',
    sex: 'female',
    bodyweightKg: 68.2,
    division: 'Open',
    equipment: 'Raw',
  },
  state: runMeet([
    [137.5, GOOD],
    [145, GOOD],
    [152.5, NO_LIFT],
    [75, NO_LIFT],
    [75, NO_LIFT],
    [77.5, NO_LIFT],
  ]),
});

export const SAMPLE_CARDS: readonly { readonly id: string; readonly card: ResultCard }[] = [
  { id: 'strong', card: STRONG_MEET_CARD },
  { id: 'bombed', card: BOMBED_MEET_CARD },
];
