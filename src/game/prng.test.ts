import { describe, expect, it } from 'vitest';
import { nextRandom, seedState } from './prng';

describe('nextRandom', () => {
  it('is a pure function of its state', () => {
    expect(nextRandom(7)).toEqual(nextRandom(7));
    expect(nextRandom(7).value).not.toBe(nextRandom(8).value);
  });

  it('stays in [0, 1) and does not collapse to a constant', () => {
    let state = 0;
    const values: number[] = [];
    for (let i = 0; i < 5000; i += 1) {
      const draw = nextRandom(state);
      state = draw.state;
      values.push(draw.value);
    }
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    // A generator stuck in a short cycle would pass "in range" and fail here.
    expect(new Set(values).size).toBeGreaterThan(values.length / 2);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    expect(mean).toBeGreaterThan(0.45);
    expect(mean).toBeLessThan(0.55);
  });

  it('spreads roughly evenly across the unit interval', () => {
    // Coarse, on purpose: this is a check that the generator is not biased into
    // one corner, not a statistical certification.
    const buckets = new Array<number>(10).fill(0);
    let state = seedState(12345);
    const draws = 20000;
    for (let i = 0; i < draws; i += 1) {
      const d = nextRandom(state);
      state = d.state;
      const index = Math.min(buckets.length - 1, Math.floor(d.value * buckets.length));
      buckets[index] = (buckets[index] ?? 0) + 1;
    }
    for (const count of buckets) {
      expect(count).toBeGreaterThan((draws / buckets.length) * 0.85);
      expect(count).toBeLessThan((draws / buckets.length) * 1.15);
    }
  });
});

describe('seedState', () => {
  it('normalises any finite seed to an unsigned 32-bit state', () => {
    for (const seed of [0, 1, -1, 2 ** 31, -(2 ** 31), 1.9, 4294967297]) {
      const state = seedState(seed);
      expect(Number.isInteger(state)).toBe(true);
      expect(state).toBeGreaterThanOrEqual(0);
      expect(state).toBeLessThan(2 ** 32);
    }
  });

  it('keeps different seeds different', () => {
    expect(seedState(1)).not.toBe(seedState(2));
    expect(nextRandom(seedState(1)).value).not.toBe(nextRandom(seedState(2)).value);
  });
});
