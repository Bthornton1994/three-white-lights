/**
 * The shareable surface is a printed scoresheet (GDD §6.5 / §12.2 Result
 * card bar), not a nearest-neighbour 16-bit trophy. These pins fail if that
 * presentation is silently swapped back for the sprite-era grid.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  CARD_LABELS,
  CARD_SCREEN,
  FOOTER,
  PAPER,
  PAPER_PAGE_H,
  PAPER_SCALE,
  paperFlightInnerWidth,
  paperSheetHeight,
} from './cardTuning';
import { SHEET, SHEET_CSS, sheetCss } from './sheetPalette';
import { codeOnly } from '../tuning/audit';

const VIEW = codeOnly(readFileSync(path.join(__dirname, 'ResultCardView.tsx'), 'utf8'));
const SCREEN = codeOnly(readFileSync(path.join(__dirname, 'ResultCardScreen.tsx'), 'utf8'));

describe('the shareable sheet is a printed scoresheet', () => {
  it('authors a packed row wider than a phone and scales it to 390', () => {
    expect(CARD_SCREEN.PHONE_W).toBe(390);
    expect(PAPER.W).toBeGreaterThan(CARD_SCREEN.PHONE_W);
    expect(PAPER.W).toBe(paperFlightInnerWidth() + 2 * PAPER.PAD_X);
    expect(PAPER.FLIGHT.ATTEMPT_COLS).toBe(9);
    expect(PAPER.FLIGHT.ATTEMPTS_PER_LIFT).toBe(3);
    expect(PAPER_SCALE).toBe(CARD_SCREEN.PHONE_W / PAPER.W);
    expect(paperSheetHeight(6)).toBeGreaterThan(PAPER.FLIGHT.HEAD_H + 6 * PAPER.FLIGHT.ROW_H);
    expect(paperSheetHeight(6)).toBeLessThan(PAPER_PAGE_H);
    expect(SCREEN).toContain('paperSheetHeight');
    expect(SCREEN).toContain('PAPER_PAGE_H');
  });

  it('sets type large enough to read as a sheet, not as a sprite caption', () => {
    expect(PAPER.MEET_SIZE).toBeGreaterThanOrEqual(16);
    expect(PAPER.FLIGHT.NAME_SIZE).toBeGreaterThanOrEqual(11);
    expect(PAPER.FLIGHT.BEST_SIZE).toBeGreaterThanOrEqual(12);
    expect(PAPER.FLIGHT.ATTEMPT_SIZE).toBeGreaterThanOrEqual(10);
    expect(PAPER.FLIGHT.META_SIZE).toBeGreaterThanOrEqual(11);
    expect(PAPER.FED_SIZE).toBeGreaterThanOrEqual(11);
  });

  it('gives Place, Lot, names, and Weight a column that can hold the heading on one line', () => {
    expect(PAPER.FLIGHT.PLACE_W).toBeGreaterThanOrEqual(32);
    expect(PAPER.FLIGHT.LOT_W).toBeGreaterThanOrEqual(24);
    expect(PAPER.FLIGHT.NAME_W).toBeGreaterThanOrEqual(88);
    expect(PAPER.FLIGHT.WEIGHT_W).toBeGreaterThanOrEqual(40);
    expect(PAPER.FLIGHT.TOTAL_W).toBeGreaterThanOrEqual(52);
    expect(PAPER.FLIGHT.DOTS_W).toBeGreaterThanOrEqual(48);
    expect(PAPER.FLIGHT.HEAD_H).toBeGreaterThanOrEqual(20);
    expect(VIEW).toContain('numberOfLines={1}');
    expect(VIEW).toContain('flexShrink: 0');
  });

  it('does not nearest-neighbour a 16-bit grid or draw a cartoon bar', () => {
    expect(VIEW).not.toContain('@shopify/react-native-skia');
    expect(VIEW).not.toContain('FilterMode');
    expect(VIEW).not.toContain('renderResultCard');
    expect(VIEW).not.toContain('../art/plates');
    expect(VIEW).not.toContain('Canvas');
    expect(VIEW).not.toContain('BARBELL');
  });

  it('does not put a hall behind the sheet', () => {
    expect(SCREEN).not.toContain('<MeetHallView');
    expect(SCREEN).not.toContain('<MeetBookendRoom');
    expect(VIEW).not.toContain('<MeetHallView');
  });

  it('prints the facts a federation sheet carries', () => {
    for (const token of [
      'card.meet.federation',
      'card.meet.name',
      'card.meet.dateText',
      'card.lifter.categoryText',
      'card.field',
      'flightColumnHeading',
      'RESULT_FLIGHT_TABLE_COLUMNS',
      'FLIGHT_LIFT_GROUPS',
      'CARD_LABELS.DOCUMENT_KIND',
      'CARD_LABELS.FED_MARK',
      'CARD_LABELS.LOT',
      'CARD_LABELS.WEIGHTS_IN',
      'CARD_LABELS.REFEREE_1_NAME',
    ]) {
      expect(VIEW, token).toContain(token);
    }
    expect(CARD_LABELS.DOCUMENT_KIND).toBe('RESULTS');
    expect(CARD_LABELS.FED_MARK).toBe('NBF');
    expect(CARD_LABELS.LOT).toBe('Lot');
    expect(FOOTER.WORDMARK).toBe('THREE WHITE LIGHTS');
    expect(VIEW).not.toContain('FOOTER.WORDMARK');
  });

  it('is the sheet, not a game share-card around the sheet', () => {
    expect(SCREEN).not.toContain('MEET COMPLETE');
    expect(SCREEN).not.toContain('Share your result');
    expect(SCREEN).not.toContain('MEET_PALETTE');
    expect(SCREEN).toContain('SHEET_CSS.PAPER');
    expect(SCREEN).toContain('CARD_SCREEN.LEAVE_CLEARANCE');
  });

  it('prints the flight, so place is a rank in a field', () => {
    expect(VIEW).toContain('card.field');
    expect(VIEW).toContain('flightColumnHeading');
    expect(VIEW).toContain('RESULT_FLIGHT_TABLE_COLUMNS');
    expect(VIEW).toContain('FlightRowView');
    expect(VIEW).toContain('flightAttemptView');
    expect(VIEW).toContain('row.lotText');
    expect(VIEW).not.toContain('playerRow');
    expect(VIEW).not.toContain('ScoreCell');
    expect(VIEW).not.toContain('LiftBestCell');
    expect(VIEW).not.toContain('LiftAttemptStack');
    expect(VIEW).not.toContain('ClassRowView');
    expect(VIEW).not.toContain('AttemptRowView');
    expect(VIEW).not.toContain('flightBestText');
  });

  it('draws a full-height scoresheet grid so peer kilos do not run together', () => {
    expect(PAPER.FLIGHT.CELL_RULE).toBeGreaterThanOrEqual(2);
    expect(VIEW).toContain('borderRightWidth');
    expect(VIEW).toContain('attemptColLiftEnd');
    expect(VIEW).toContain('attemptColGroupEnd');
    expect(VIEW).toContain('isLiftGroupEnd');
    expect(VIEW).toContain('headCell');
    expect(VIEW).not.toContain('LiftAttemptStack');
  });

  it('prints each lift as grouped 1/2/3 cells in the placing row, misses struck', () => {
    expect(VIEW).toContain('flightAttemptView');
    expect(VIEW).toContain('FLIGHT_LIFT_GROUPS');
    expect(VIEW).toContain('struckThrough');
    expect(VIEW).toContain('textDecorationLine');
    expect(VIEW).not.toContain('signedAttemptText');
    expect(VIEW).not.toContain('NOLIFT_LIGHT');
    expect(VIEW).not.toContain('GOOD_LIGHT');
    expect(VIEW).not.toContain('LiftAttemptStack');
    expect(PAPER.FLIGHT.ATTEMPT_COL_W).toBeGreaterThanOrEqual(30);
    expect(PAPER.FLIGHT.ATTEMPT_ROW_H).toBeLessThanOrEqual(28);
  });

  it('hugs the filled flight, with no unused form pad and no winner wash', () => {
    expect(VIEW).not.toContain('flex: 1');
    expect(VIEW).not.toContain('pageFill');
    expect(VIEW).not.toContain('EmptyRow');
    expect(VIEW).not.toContain('blankBand');
    expect(VIEW).not.toContain('playerRow');
    expect(VIEW).toContain('odd ? styles.rowOdd : styles.rowEven');
    expect(VIEW).toContain('flightLifterName');
    expect(VIEW).toContain('paperSheetHeight');
    expect(SCREEN).toContain('flex: 1');
    expect(PAPER.FLIGHT.ROW_H).toBeGreaterThanOrEqual(20);
    expect(PAPER.FLIGHT.ROW_H).toBeLessThanOrEqual(28);
  });

  it('prints named officials, not blank signature seats', () => {
    expect(CARD_LABELS.REFEREE_1_NAME).toMatch(/[A-Z]/);
    expect(CARD_LABELS.REFEREE_2_NAME).toMatch(/[A-Z]/);
    expect(CARD_LABELS.REFEREE_3_NAME).toMatch(/[A-Z]/);
    expect(CARD_LABELS.SECRETARY_NAME).toMatch(/[A-Z]/);
    expect(VIEW).toContain('CARD_LABELS.REFEREE_1_NAME');
    expect(VIEW).toContain('CARD_LABELS.SECRETARY_NAME');
  });
});

describe('paper ink comes from the sheet bank', () => {
  it('expands every named slot to a seven-character hex', () => {
    for (const [name, css] of Object.entries(SHEET_CSS)) {
      const index = SHEET[name as keyof typeof SHEET];
      expect(css, name).toBe(sheetCss(index));
      expect(css).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('refuses an unallocated index rather than printing black', () => {
    expect(() => sheetCss(4096)).toThrow(/unallocated/);
  });
});
