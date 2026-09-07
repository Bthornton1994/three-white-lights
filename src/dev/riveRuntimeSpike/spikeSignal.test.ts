import { describe, expect, it } from 'vitest';

import { SPIKE_SIGNAL_FIELDS, spikeSignalAt } from './spikeSignal';

describe('spikeSignalAt', () => {
  it('is pure — the same instant always produces the same frame', () => {
    expect(spikeSignalAt(12345)).toEqual(spikeSignalAt(12345));
  });

  it('holds every field inside its promised range across a full sweep', () => {
    // NON-VACUITY: a sweep that never advances would satisfy every range
    // check trivially. 4000 distinct millisecond samples over ~2 periods.
    const samples = Array.from({ length: 4000 }, (_, i) => spikeSignalAt(i));
    expect(new Set(samples.map((s) => s.repProgress.toFixed(4))).size).toBeGreaterThan(
      100,
    );

    for (const s of samples) {
      expect(s.repProgress).toBeGreaterThanOrEqual(0);
      expect(s.repProgress).toBeLessThanOrEqual(1);
      expect(s.barHeight).toBeGreaterThanOrEqual(0);
      expect(s.barHeight).toBeLessThanOrEqual(1);
      expect(s.barVelocity).toBeGreaterThanOrEqual(-1);
      expect(s.barVelocity).toBeLessThanOrEqual(1);
      expect(s.strain).toBeGreaterThanOrEqual(0);
      expect(s.strain).toBeLessThanOrEqual(1);
      expect(s.grindIntensity).toBeGreaterThanOrEqual(0);
      expect(s.grindIntensity).toBeLessThanOrEqual(1);
    }
  });

  it('grind is non-zero only near the top of the rep, mirroring LiftPresentation.grind', () => {
    const samples = Array.from({ length: 1800 }, (_, i) => spikeSignalAt(i));
    const grinding = samples.filter((s) => s.grindIntensity > 0);
    const idle = samples.filter((s) => s.grindIntensity === 0);
    // MOVES, not merely valid: both populations must be non-empty or this
    // assertion is checking nothing.
    expect(grinding.length).toBeGreaterThan(0);
    expect(idle.length).toBeGreaterThan(0);
    for (const s of grinding) {
      expect(s.repProgress).toBeGreaterThan(0.7);
    }
  });

  it('velocity crosses zero — the rep both rises and falls', () => {
    const samples = Array.from({ length: 1800 }, (_, i) => spikeSignalAt(i));
    expect(Math.max(...samples.map((s) => s.barVelocity))).toBeGreaterThan(0.5);
    expect(Math.min(...samples.map((s) => s.barVelocity))).toBeLessThan(-0.5);
  });

  it('SPIKE_SIGNAL_FIELDS names exactly the fields spikeSignalAt returns', () => {
    const frame = spikeSignalAt(0);
    expect(new Set(SPIKE_SIGNAL_FIELDS)).toEqual(new Set(Object.keys(frame)));
  });
});
