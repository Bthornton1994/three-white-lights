import { describe, expect, it } from 'vitest';

import { frameMetricsFrom, memoryTrendFrom, percentile } from './frameMetrics';

describe('frameMetricsFrom', () => {
  it('reads a steady 60 Hz run as 60 FPS with nothing dropped', () => {
    const m = frameMetricsFrom(Array.from({ length: 120 }, () => 16.67));
    expect(m).toEqual({ frames: 120, meanMs: 16.67, meanFps: 59.99, p95Ms: 16.67, worstMs: 16.67, over33ms: 0 });
  });

  it('counts every gap over 33 ms as a dropped frame and reports the worst one', () => {
    const gaps = [16, 16, 50, 16, 16, 16, 16, 16, 16, 34];
    const m = frameMetricsFrom(gaps);
    expect(m.over33ms).toBe(2);
    expect(m.worstMs).toBe(50);
    expect(m.frames).toBe(10);
    // 33 exactly is two 60 Hz frames, not a drop.
    expect(frameMetricsFrom([16, 33]).over33ms).toBe(0);
  });

  it('p95 is the nearest-rank percentile, so one outlier in twenty does not move it and one in ten does', () => {
    const twenty = [...Array.from({ length: 19 }, () => 16), 80];
    expect(frameMetricsFrom(twenty).p95Ms).toBe(16);
    const ten = [...Array.from({ length: 9 }, () => 16), 80];
    expect(frameMetricsFrom(ten).p95Ms).toBe(80);
  });

  it('mean FPS is 1000 over the mean gap', () => {
    expect(frameMetricsFrom([20, 20, 20, 20]).meanFps).toBe(50);
    expect(frameMetricsFrom([10, 30]).meanFps).toBe(50);
  });

  it('refuses an empty run and a non-positive gap rather than reporting a number', () => {
    expect(() => frameMetricsFrom([])).toThrow(RangeError);
    expect(() => frameMetricsFrom([16, 0])).toThrow(RangeError);
    expect(() => frameMetricsFrom([16, Number.NaN])).toThrow(RangeError);
  });
});

describe('percentile', () => {
  it('is nearest-rank: p=0 is the minimum, p=1 the maximum, and interior ranks round up', () => {
    const s = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentile(s, 0)).toBe(1);
    expect(percentile(s, 1)).toBe(10);
    expect(percentile(s, 0.5)).toBe(5);
    expect(percentile(s, 0.95)).toBe(10);
    expect(percentile(s, 0.9)).toBe(9);
    expect(() => percentile([], 0.5)).toThrow(RangeError);
    expect(() => percentile(s, 1.5)).toThrow(RangeError);
  });
});

describe('memoryTrendFrom', () => {
  it('needs two samples, and reads a flat heap as zero slope', () => {
    expect(memoryTrendFrom([])).toBeNull();
    expect(memoryTrendFrom([{ tMs: 0, bytes: 100 * 1024 * 1024 }])).toBeNull();
    const flat = memoryTrendFrom([
      { tMs: 0, bytes: 200 * 1024 * 1024 },
      { tMs: 30_000, bytes: 200 * 1024 * 1024 },
      { tMs: 60_000, bytes: 200 * 1024 * 1024 },
    ]);
    expect(flat).toEqual({ samples: 3, startMb: 200, endMb: 200, deltaMb: 0, slopeMbPerMin: 0 });
  });

  it('reads a leak as MB per minute from the fit, not from the endpoints alone', () => {
    // 10 MB every 30 s, sampled four times: 20 MB/min.
    const leak = memoryTrendFrom([
      { tMs: 0, bytes: 100 * 1024 * 1024 },
      { tMs: 30_000, bytes: 110 * 1024 * 1024 },
      { tMs: 60_000, bytes: 120 * 1024 * 1024 },
      { tMs: 90_000, bytes: 130 * 1024 * 1024 },
    ]);
    expect(leak?.slopeMbPerMin).toBe(20);
    expect(leak?.deltaMb).toBe(30);
    // GC noise: a single low sample in the middle barely moves the slope.
    const noisy = memoryTrendFrom([
      { tMs: 0, bytes: 200 * 1024 * 1024 },
      { tMs: 30_000, bytes: 180 * 1024 * 1024 },
      { tMs: 60_000, bytes: 200 * 1024 * 1024 },
      { tMs: 90_000, bytes: 200 * 1024 * 1024 },
    ]);
    expect(Math.abs(noisy?.slopeMbPerMin ?? 99)).toBeLessThan(5);
  });
});
