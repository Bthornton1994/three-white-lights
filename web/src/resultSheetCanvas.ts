import { FLIGHT_LIFT_GROUPS, sheetColumnHeading, type ResultCard } from '../../src/game/resultCard';
import { RESULT_SHEET_LAYOUT } from './gameplayTuning';
import { RESULT_SHEET_PALETTE } from './gameplayPalette';
import { SHEET_COLUMNS, sheetHeading, sheetValue, type SheetStatus } from './resultSheetModel';

export async function resultPng(card: ResultCard, status: SheetStatus): Promise<Blob> {
  const sheet = RESULT_SHEET_LAYOUT;
  const palette = RESULT_SHEET_PALETTE;
  const canvas = document.createElement('canvas');
  canvas.width = sheet.width; canvas.height = sheet.height;
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('This browser could not create the result image.');
  ctx.fillStyle = palette.paper; ctx.fillRect(0, 0, sheet.width, sheet.height);
  ctx.fillStyle = palette.ink; ctx.textAlign = 'center';
  ctx.font = sheet.mastheadFont; ctx.fillText(card.meet.federation, sheet.width / 2, sheet.mastheadY, sheet.width - 2 * sheet.margin);
  ctx.font = sheet.meetFont; ctx.fillText(card.meet.name, sheet.width / 2, sheet.meetY, sheet.width - 2 * sheet.margin);
  ctx.font = sheet.metaFont; ctx.fillStyle = palette.muted; ctx.textAlign = 'left'; ctx.fillText(card.meet.dateText, sheet.margin, sheet.metaY);
  ctx.textAlign = 'right'; ctx.fillText(card.meet.locationText, sheet.width - sheet.margin, sheet.metaY, sheet.width / 2);
  const line = (y: number, heavy = false) => { ctx.strokeStyle = palette.rule; ctx.lineWidth = heavy ? sheet.heavyRule : sheet.fineRule; ctx.beginPath(); ctx.moveTo(sheet.margin, y); ctx.lineTo(sheet.width - sheet.margin, y); ctx.stroke(); };
  line(sheet.metaY + sheet.metaHeavyRuleOffset, true); line(sheet.metaY + sheet.metaFineRuleOffset);
  ctx.textAlign = 'left'; ctx.fillStyle = palette.ink; ctx.font = sheet.categoryFont; ctx.fillText('FLIGHT RESULTS', sheet.margin, sheet.categoryY);
  ctx.textAlign = 'right'; ctx.fillStyle = palette.muted; ctx.font = sheet.categoryDetailFont; ctx.fillText(`YOUR CATEGORY · ${card.lifter.categoryText} / KG`, sheet.width - sheet.margin, sheet.categoryY, (sheet.width - 2 * sheet.margin) / 2);
  const totalWidth = sheet.columns.reduce((sum, width) => sum + width, 0);
  const scale = (sheet.width - 2 * sheet.margin) / totalWidth;
  const xs: number[] = [sheet.margin];
  sheet.columns.forEach((width) => xs.push((xs[xs.length - 1] ?? sheet.margin) + width * scale));
  const cell = (text: string, col: number, y: number, bold: boolean, left = false) => {
    const x = xs[col] ?? sheet.margin;
    const width = ((sheet.columns[col] ?? sheet.fallbackWidth) * scale);
    ctx.textAlign = left ? 'left' : 'center';
    ctx.fillStyle = palette.ink; ctx.font = bold ? sheet.boldCellFont : sheet.cellFont;
    ctx.fillText(text, left ? x + sheet.cellPadding : x + width / 2, y, width - sheet.rowPadding);
  };
  ctx.fillStyle = palette.heading; ctx.fillRect(sheet.margin, sheet.tableY, sheet.width - 2 * sheet.margin, sheet.headerHeight);
  const headings = SHEET_COLUMNS;
  for (let col = 0; col < headings.length; col += 1) {
    const id = headings[col];
    if (!id) continue;
    const isAttemptOrBest = id !== 'lot' && FLIGHT_LIFT_GROUPS.some((group) => [...group.attempts, group.bestId].includes(id));
    cell(sheetHeading(id), col, sheet.tableY + (isAttemptOrBest ? sheet.columnHeadingOffset : sheet.regularHeadingOffset), true, id === 'lifter');
  }
  FLIGHT_LIFT_GROUPS.forEach((group) => {
    const start = xs[SHEET_COLUMNS.indexOf(group.attempts[0])] ?? sheet.margin;
    const end = xs[SHEET_COLUMNS.indexOf(group.bestId) + 1] ?? start;
    ctx.textAlign = 'center'; ctx.font = sheet.groupFont;
    ctx.fillText(sheetColumnHeading(group.headingId).toUpperCase(), (start + end) / 2, sheet.tableY + sheet.groupHeadingOffset);
  });
  line(sheet.tableY, true); line(sheet.tableY + sheet.headerHeight, true);
  card.field.forEach((row, rowIndex) => {
    const y = sheet.tableY + sheet.headerHeight + rowIndex * sheet.rowHeight;
    if (rowIndex % 2 === 1) { ctx.fillStyle = palette.alternateRow; ctx.fillRect(sheet.margin, y, sheet.width - 2 * sheet.margin, sheet.rowHeight); }
    headings.forEach((id, col) => cell(sheetValue(row, id), col, y + sheet.rowTextOffset, id === 'total', id === 'lifter'));
    line(y + sheet.rowHeight);
  });
  const bottom = sheet.tableY + sheet.headerHeight + card.field.length * sheet.rowHeight;
  [...FLIGHT_LIFT_GROUPS.map((group) => SHEET_COLUMNS.indexOf(group.attempts[0])), SHEET_COLUMNS.indexOf('total')].forEach((col) => { const x = xs[col] ?? sheet.margin; ctx.beginPath(); ctx.moveTo(x, sheet.tableY); ctx.lineTo(x, bottom); ctx.stroke(); });
  ctx.fillStyle = palette.muted; ctx.font = sheet.noteFont; ctx.textAlign = 'left'; ctx.fillText('Negative attempts indicate a no lift. Total is the sum of the best successful attempt in each lift.', sheet.margin, bottom + sheet.noteOffset);
  line(sheet.footerY - sheet.footerRuleOffset); ctx.font = sheet.footerFont; ctx.fillText('THREE WHITE LIGHTS · GAME COMPETITION', sheet.margin, sheet.footerY);
  ctx.textAlign = 'right'; ctx.fillText(status === 'practice' ? 'PRACTICE RESULT' : status === 'unconfirmed' ? 'UNCONFIRMED RESULT' : 'RECORDED RESULT', sheet.width - sheet.margin, sheet.footerY);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('The result image could not be exported.')), 'image/png'));
}

