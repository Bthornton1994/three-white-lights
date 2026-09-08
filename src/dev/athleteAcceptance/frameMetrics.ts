/**
 * frameMetrics — the performance numbers the acceptance harness reports,
 * as pure reducers so the arithmetic is tested here and the browser only
 * supplies raw samples (`tools/athleteAccept.mjs` loads this module through
 * the traces tool's TypeScript loader; there is no second copy of the
 * formula in the tool).
 *
 * What these measure, exactly, and what they do not:
 *   - `frameMetricsFrom` takes requestAnimationFrame gaps in ms. Mean FPS is
 *     1000 / mean gap. p95 is the nearest-rank percentile over the sorted
 *     gaps. `over33ms` counts gaps above two 60 Hz frames — a dropped frame.
 *   - `memoryTrendFrom` takes `performance.memory.usedJSHeapSize` samples
 *     with timestamps and returns the start/end/delta in MB and a slope in
 *     MB per minute from a least-squares fit, so a leak reads as a slope and
 *     GC noise does not.
 *   - The Rive runtime's own advance/draw cost is NOT here: `@rive-app/
 *     react-canvas` does not expose it. The harness records main-thread long
 *     tasks (PerformanceObserver `longtask`) beside the gaps, which is the
 *     closest honest proxy; ADR-001 §7 says so.
 */

export interface FrameMetrics {
  readonly frames: number;
  readonly meanMs: number;
  readonly meanFps: number;
  readonly p95Ms: number;
  readonly worstMs: number;
  readonly over33ms: number;
}

export interface MemorySample {
  readonly tMs: number;
  readonly bytes: number;
}

export interface MemoryTrend {
  readonly samples: number;
  readonly startMb: number;
  readonly endMb: number;
  readonly deltaMb: number;
  readonly slopeMbPerMin: number;
}

import { ACCEPTANCE_METRICS } from '../riveRuntimeSpike/spikeTuning';

const { DROPPED_FRAME_MS, BYTES_PER_MB, MS_PER_SECOND, MS_PER_MINUTE, P95, ROUND } = ACCEPTANCE_METRICS;

function round2(value: number): number {
  return Math.round(value * ROUND) / ROUND;
}

/** Nearest-rank percentile of an ascending array; p in [0, 1]. */
export function percentile(sortedAscending: readonly number[], p: number): number {
  if (sortedAscending.length === 0) throw new RangeError('percentile of nothing');
  if (!(p >= 0 && p <= 1)) throw new RangeError(`p must be in [0, 1], got ${p}`);
  const rank = Math.min(sortedAscending.length - 1, Math.max(0, Math.ceil(p * sortedAscending.length) - 1));
  return sortedAscending[rank]!;
}

export function frameMetricsFrom(gapsMs: readonly number[]): FrameMetrics {
  if (gapsMs.length === 0) throw new RangeError('frameMetricsFrom: no frames');
  for (const gap of gapsMs) {
    if (!Number.isFinite(gap) || gap <= 0) throw new RangeError(`frameMetricsFrom: bad gap ${gap}`);
  }
  const sorted = [...gapsMs].sort((a, b) => a - b);
  const meanMs = gapsMs.reduce((a, b) => a + b, 0) / gapsMs.length;
  return {
    frames: gapsMs.length,
    meanMs: round2(meanMs),
    meanFps: round2(MS_PER_SECOND / meanMs),
    p95Ms: round2(percentile(sorted, P95)),
    worstMs: round2(sorted[sorted.length - 1]!),
    over33ms: gapsMs.filter((g) => g > DROPPED_FRAME_MS).length,
  };
}

export function memoryTrendFrom(samples: readonly MemorySample[]): MemoryTrend | null {
  if (samples.length < 2) return null;
  const n = samples.length;
  const t0 = samples[0]!.tMs;
  const xs = samples.map((s) => (s.tMs - t0) / MS_PER_MINUTE);
  const ys = samples.map((s) => s.bytes / BYTES_PER_MB);
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    num += (xs[i]! - xMean) * (ys[i]! - yMean);
    den += (xs[i]! - xMean) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  return {
    samples: n,
    startMb: round2(ys[0]!),
    endMb: round2(ys[n - 1]!),
    deltaMb: round2(ys[n - 1]! - ys[0]!),
    slopeMbPerMin: round2(slope),
  };
}
