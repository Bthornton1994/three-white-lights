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
    expect(PAPER.FLIGHT.ATTEMPT_FONT).toBeGreaterThanOrEqual(10);
    expect(PAPER.FLIGHT.META_SIZE).toBeGreaterThanOrEqual(10);
    expect(PAPER.FED_SIZE).toBeGreaterThanOrEqual(11);
  });

  it('gives Place and Weight a column that can hold the heading on one line', () => {
    expect(PAPER.FLIGHT.PLACE_W).toBeGreaterThanOrEqual(40);
    expect(PAPER.FLIGHT.WEIGHT_W).toBeGreaterThanOrEqual(52);
    expect(PAPER.FLIGHT.HEAD_H).toBeGreaterThanOrEqual(18);
    expect(PAPER.FLIGHT.ATTEMPT_HEAD_H).toBeGreaterThanOrEqual(24);
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
      'sheetColumnHeading',
      'ATTEMPT_GRID_HEADINGS',
      'FOOTER.WORDMARK',
      'CARD_LABELS.DOCUMENT_KIND',
    ]) {
      expect(VIEW, token).toContain(token);
    }
    expect(CARD_LABELS.DOCUMENT_KIND).toBe('RESULTS');
    expect(FOOTER.WORDMARK).toBe('THREE WHITE LIGHTS');
  });

  it('prints the flight, so place is a rank in a field', () => {
    expect(VIEW).toContain('card.field');
    expect(VIEW).toContain('row.isPlayer');
    expect(VIEW).toContain('sheetColumnHeading');
    expect(VIEW).toContain('FlightRowView');
    expect(VIEW).toContain('playerRow');
    expect(VIEW).not.toContain('ScoreCell');
  });

  it('strikes a missed attempt and colours the cell, without a plate stack', () => {
    expect(VIEW).toContain('struckThrough');
    expect(VIEW).toContain('NOLIFT_LIGHT');
    expect(VIEW).toContain('GOOD_LIGHT');
    expect(VIEW).toContain('textDecorationLine');
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
