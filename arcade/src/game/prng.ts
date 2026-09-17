/**
 * prng.ts — mulberry32, the one seeded generator the lift mechanic uses.
 *
 * WHY THIS IS ITS OWN MODULE. `liftTuning.test.ts` scans `lift.ts` for numeric
 * literals and fails on anything that is not 0, 1 or 2, because a bare number
 * in the mechanic is a game-feel value that escaped the tuning block. The five
 * constants below are neither: they are mulberry32's published multipliers and
 * shift widths, they are not tunable in any meaningful sense, and putting them
 * in `LIFT_TUNING` next to timing windows would tell a playtester they were
 * knobs. Separating them is cheaper and more honest than carving an exception
 * into the scan.
 *
 * PURITY. No module state. `nextRandom` takes a state and returns the next one,
 * so the caller owns the sequence and a rep replays exactly from its seed.
 * There is no `Math.random()` anywhere in the game modules and there must not
 * be: GDD §9.2 puts progression on the server, and a client that can roll its
 * own dice is a client that can roll them again.
 */

/**
 * mulberry32's constants. Named so the algorithm is identifiable rather than
 * mysterious, and so nobody mistakes them for something to tune.
 */
const MULBERRY32 = Object.freeze({
  INCREMENT: 0x6d2b79f5,
  SHIFT_A: 15,
  SHIFT_B: 7,
  SHIFT_C: 14,
  ODD_MASK: 1,
  MIX_ADDEND: 61,
  /** 2^32, the divisor that maps a uint32 into [0, 1). */
  UINT32_RANGE: 4294967296,
});

export interface RandomDraw {
  /** Uniform in [0, 1). */
  readonly value: number;
  /** The state to pass to the next draw. */
  readonly state: number;
}

/**
 * One draw. A pure function of its state — the same state always yields the
 * same value and the same next state.
 */
export function nextRandom(state: number): RandomDraw {
  const next = (state + MULBERRY32.INCREMENT) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> MULBERRY32.SHIFT_A), t | MULBERRY32.ODD_MASK);
  t ^= t + Math.imul(t ^ (t >>> MULBERRY32.SHIFT_B), t | MULBERRY32.MIX_ADDEND);
  return {
    value: ((t ^ (t >>> MULBERRY32.SHIFT_C)) >>> 0) / MULBERRY32.UINT32_RANGE,
    state: next,
  };
}

/** A seed, normalised to the unsigned 32-bit state the generator runs on. */
export function seedState(seed: number): number {
  return Math.trunc(seed) >>> 0;
}
