/**
 * The shareable surface is a printed scoresheet (GDD §6.5 / §12.2 Result
 * card bar), not a nearest-neighbour 16-bit trophy. These pins fail if that
 * presentation is silently swapped back for the sprite-era grid.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { CARD_LABELS, CARD_SCREEN, FOOTER, PAPER } from './cardTuning';
import { SHEET, SHEET_CSS, sheetCss } from './sheetPalette';
import { codeOnly } from '../tuning/audit';

const PHONE_WIDTH_PT = 390;
const VIEW = codeOnly(readFileSync(path.join(__dirname, 'ResultCardView.tsx'), 'utf8'));
const SCREEN = codeOnly(readFileSync(path.join(__dirname, 'ResultCardScreen.tsx'), 'utf8'));

describe('the shareable sheet is a printed scoresheet', () => {
  it('fits a 390-wide phone with its hairline frame', () => {
    expect(PAPER.W + 2 * CARD_SCREEN.FRAME_BORDER).toBeLessThanOrEqual(PHONE_WIDTH_PT);
  });

  it('sets type large enough to read as a sheet, not as a sprite caption', () => {
    expect(PAPER.MEET_SIZE).toBeGreaterThanOrEqual(16);
    expect(PAPER.FLIGHT.NAME_SIZE).toBeGreaterThanOrEqual(11);
    expect(PAPER.FLIGHT.BEST_SIZE).toBeGreaterThanOrEqual(12);
    expect(PAPER.FLIGHT.ATTEMPT_SIZE).toBeGreaterThanOrEqual(10);
    expect(PAPER.FLIGHT.META_SIZE).toBeGreaterThanOrEqual(11);
    expect(PAPER.FED_SIZE).toBeGreaterThanOrEqual(11);
  });

  it('gives Place, names, and Weight a column that can hold the heading on one line', () => {
    expect(PAPER.FLIGHT.PLACE_W).toBeGreaterThanOrEqual(32);
    expect(PAPER.FLIGHT.NAME_W).toBeGreaterThanOrEqual(88);
    expect(PAPER.FLIGHT.WEIGHT_W).toBeGreaterThanOrEqual(40);
    expect(PAPER.FLIGHT.HEAD_H).toBeGreaterThanOrEqual(28);
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
      'CARD_LABELS.DOCUMENT_KIND',
    ]) {
      expect(VIEW, token).toContain(token);
    }
    expect(CARD_LABELS.DOCUMENT_KIND).toBe('RESULTS');
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
    expect(VIEW).toContain('row.isPlayer');
    expect(VIEW).toContain('flightColumnHeading');
    expect(VIEW).toContain('RESULT_FLIGHT_TABLE_COLUMNS');
    expect(VIEW).toContain('FlightRowView');
    expect(VIEW).toContain('LiftAttemptStack');
    expect(VIEW).toContain('flightAttemptView');
    expect(VIEW).toContain('playerRow');
    expect(VIEW).not.toContain('ScoreCell');
    expect(VIEW).not.toContain('LiftBestCell');
  });

  it('prints each lift as three attempt cells, misses struck, not a clipped nine-column grid', () => {
    expect(VIEW).toContain('flightAttemptView');
    expect(VIEW).toContain('ATTEMPT_GRID_HEADINGS');
    expect(VIEW).toContain('LiftAttemptStack');
    expect(VIEW).toContain('struckThrough');
    expect(VIEW).not.toContain('signedAttemptText');
    expect(VIEW).not.toContain('NOLIFT_LIGHT');
    expect(VIEW).not.toContain('GOOD_LIGHT');
  });

  it('fills the capture as a page of paper, without a gold winner row', () => {
    expect(VIEW).toContain('flex: 1');
    expect(VIEW).not.toContain('pageFill');
    expect(VIEW).toContain('odd ? styles.rowOdd : styles.rowEven');
    expect(VIEW).toContain('flightLifterName');
    expect(SCREEN).toContain('flex: 1');
    expect(PAPER.FLIGHT.ROW_H).toBeGreaterThanOrEqual(40);
    expect(PAPER.FLIGHT.ROW_H).toBeLessThanOrEqual(52);
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
