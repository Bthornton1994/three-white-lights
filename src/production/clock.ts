import { streakDayFromLocalWallClock } from '../game/streak';
/** UTC account timezone with the native 03:00 rollover. */
export function utcAccountDay(serverNowMs: number): number {
  if (!Number.isSafeInteger(serverNowMs) || serverNowMs < 0) throw new RangeError('Server clock must be an integer UTC timestamp.');
  const date = new Date(serverNowMs);
  return streakDayFromLocalWallClock({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), hour: date.getUTCHours() });
}
