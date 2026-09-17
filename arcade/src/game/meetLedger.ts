/**
 * meetLedger.ts — smallest immutable Meet Day event log.
 *
 * Not A3 Career Calendar. Facts A2/A3/A4 can consume: weigh-in, attempt,
 * lights, bests, Total, placing, record, qualification, bomb-out.
 *
 * PURITY: zero React, zero I/O. Append-only; events are never rewritten.
 */

import type { AttemptNumber, JudgePanel, LiftKind } from './meet';

export type MeetLedgerEvent =
  | {
      readonly kind: 'weigh-in';
      readonly bodyweightKg: number;
      readonly weightClassText: string;
    }
  | {
      readonly kind: 'attempt';
      readonly lift: LiftKind;
      readonly attemptNumber: AttemptNumber;
      readonly weightKg: number;
      readonly good: boolean;
      readonly lights: JudgePanel;
    }
  | {
      readonly kind: 'best';
      readonly lift: LiftKind;
      readonly kg: number;
    }
  | {
      readonly kind: 'total';
      readonly kg: number | null;
    }
  | {
      readonly kind: 'placing';
      readonly place: number | null;
      readonly fieldSize: number;
    }
  | {
      readonly kind: 'record';
      readonly kg: number;
    }
  | {
      readonly kind: 'qualification';
      readonly kg: number;
    }
  | {
      readonly kind: 'bomb-out';
      readonly lift: LiftKind;
    };

export function appendLedger(
  events: readonly MeetLedgerEvent[],
  event: MeetLedgerEvent,
): readonly MeetLedgerEvent[] {
  return [...events, event];
}

export function lightsKey(lights: JudgePanel): string {
  return lights.map((light) => (light === 'white' ? 'W' : 'R')).join('');
}

export function lastEventOfKind<K extends MeetLedgerEvent['kind']>(
  events: readonly MeetLedgerEvent[],
  kind: K,
): Extract<MeetLedgerEvent, { readonly kind: K }> | null {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (event !== undefined && event.kind === kind) {
      return event as Extract<MeetLedgerEvent, { readonly kind: K }>;
    }
  }
  return null;
}

export function reconstructBests(
  events: readonly MeetLedgerEvent[],
): Readonly<Record<LiftKind, number | null>> {
  const bests: Record<LiftKind, number | null> = { squat: null, bench: null, deadlift: null };
  for (const event of events) {
    if (event.kind === 'attempt' && event.good) {
      const held = bests[event.lift];
      if (held === null || event.weightKg > held) bests[event.lift] = event.weightKg;
    }
    if (event.kind === 'best') bests[event.lift] = event.kg;
  }
  return bests;
}
