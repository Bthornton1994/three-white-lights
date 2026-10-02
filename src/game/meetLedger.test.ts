import { describe, expect, it } from 'vitest';

import { appendLedger, lastEventOfKind, lightsKey, reconstructBests } from './meetLedger';

describe('meetLedger', () => {
  it('is append-only and reconstructs bests from attempts', () => {
    let events = appendLedger([], {
      kind: 'weigh-in',
      bodyweightKg: 92.4,
      weightClassText: '93',
    });
    events = appendLedger(events, {
      kind: 'attempt',
      lift: 'squat',
      attemptNumber: 1,
      weightKg: 160,
      good: true,
      lights: ['white', 'white', 'white'],
    });
    events = appendLedger(events, {
      kind: 'attempt',
      lift: 'squat',
      attemptNumber: 2,
      weightKg: 170,
      good: false,
      lights: ['red', 'red', 'white'],
    });
    events = appendLedger(events, { kind: 'best', lift: 'squat', kg: 160 });
    events = appendLedger(events, { kind: 'total', kg: 160 });
    events = appendLedger(events, { kind: 'placing', place: 4, fieldSize: 6 });

    expect(lastEventOfKind(events, 'weigh-in')?.bodyweightKg).toBe(92.4);
    expect(lastEventOfKind(events, 'total')?.kg).toBe(160);
    expect(lastEventOfKind(events, 'placing')?.place).toBe(4);
    expect(reconstructBests(events).squat).toBe(160);
    expect(reconstructBests(events).bench).toBeNull();
    expect(lightsKey(['red', 'red', 'white'])).toBe('RRW');
  });

  it('a bomb-out is a fact, not a zero Total', () => {
    const events = appendLedger(
      [{ kind: 'total', kg: null }],
      { kind: 'bomb-out', lift: 'squat' },
    );
    expect(lastEventOfKind(events, 'total')?.kg).toBeNull();
    expect(lastEventOfKind(events, 'bomb-out')?.lift).toBe('squat');
  });
});
