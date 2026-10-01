import {
  ATTEMPT_GRID_HEADINGS, FLIGHT_LIFT_GROUPS, flightAttemptView,
  flightBestText, flightColumnHeading, type ResultCardFlightRow, type ResultSheetColumnId,
} from '../../src/game/resultCard';

export type SheetStatus = 'recorded' | 'practice' | 'unconfirmed';
export type WebSheetColumnId = ResultSheetColumnId | 'lot';

/** A flight includes multiple bodyweights; its placing is not a weight-class ranking. */
export const SHEET_FLIGHT_SCOPE = 'ALL WEIGHT CLASSES · RANKED BY TOTAL';

/** One column model shared by the on-screen sheet and the downloadable PNG. */
export const SHEET_COLUMNS: readonly WebSheetColumnId[] = [
  'place', 'lot', 'lifter', 'bodyweight',
  ...FLIGHT_LIFT_GROUPS.flatMap((group) => [...group.attempts, group.bestId]),
  'total', 'dots',
];

export function sheetValue(row: ResultCardFlightRow, id: WebSheetColumnId): string {
  if (id === 'lot') return row.lotText;
  const attempt = flightAttemptView(row, id);
  if (attempt !== null) return attempt.signedText || '—';
  const best = flightBestText(row, id);
  if (best !== null) return best;
  switch (id) {
    case 'place': return row.placeText;
    case 'lifter': return row.name;
    case 'bodyweight': return row.bodyweightText;
    case 'total': return row.totalText;
    case 'dots': return row.dotsText;
    default: return '—';
  }
}

export function sheetHeading(id: WebSheetColumnId): string {
  if (id === 'lot') return 'Lot';
  if (FLIGHT_LIFT_GROUPS.some((group) => group.bestId === id)) return ATTEMPT_GRID_HEADINGS.best;
  return flightColumnHeading(id);
}
