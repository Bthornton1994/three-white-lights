/**
 * replayRoute.ts — the debug query string, parsed.
 *
 * `?replay=<loadRatio>&moment=<id>` freezes the screen on one beat of a
 * scripted rep (see `liftReplay.ts`). It exists so the screenshot harness can
 * photograph the REAL component at a moment a wall clock cannot reliably reach,
 * and for no other reason.
 *
 * REFUSES ANYTHING IT DOES NOT RECOGNISE. An unparseable load, a load outside
 * the range the mechanic models, or a moment that is not in `CAPTURE_MOMENTS`
 * all return null and the app boots normally. A debug route that silently
 * half-applies is worse than one that is not there.
 *
 * PURE. Zero React, zero I/O — it is handed a string, not `window`.
 */

import { LOAD_RANGE } from '../game/liftTuning';
import { CAPTURE_MOMENTS, type CaptureMomentId, type ReplayRequest } from './liftReplay';

/** Query-string keys. Named so the harness and the app cannot disagree. */
export const REPLAY_PARAM = 'replay';
export const MOMENT_PARAM = 'moment';

function isCaptureMoment(value: string): value is CaptureMomentId {
  return (CAPTURE_MOMENTS as readonly string[]).includes(value);
}

/**
 * A replay request, or null if this query string is not asking for one.
 *
 * @param search a `location.search`-shaped string, with or without its '?'.
 */
export function replayRequestFrom(search: string): ReplayRequest | null {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return null;
  }

  const rawLoad = params.get(REPLAY_PARAM);
  const rawMoment = params.get(MOMENT_PARAM);
  if (rawLoad === null || rawMoment === null) return null;

  const loadRatio = Number(rawLoad);
  if (!Number.isFinite(loadRatio)) return null;
  // Outside the modelled range the mechanic would clamp, and the shot would be
  // labelled with a load it was not taken at. Refuse instead.
  if (loadRatio < LOAD_RANGE.MIN || loadRatio > LOAD_RANGE.MAX) return null;
  if (!isCaptureMoment(rawMoment)) return null;

  return { loadRatio, moment: rawMoment };
}
