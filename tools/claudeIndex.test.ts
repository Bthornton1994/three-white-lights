/**
 * claudeIndex.test.ts — the standing-section index in CLAUDE.md, pinned.
 *
 * Why this file is in tools/ and not in src/: guaranteeTags.test.ts walks
 * src/ for its tree-wide census. A new src test whose comments trip that
 * scan would move TREE_WIDE, which is a Session A file this piece must not
 * touch. vitest.config.ts already includes the tools test glob; this is the
 * same home as verifyMarker.test.ts, a repo-meta check rather than game math.
 *
 * The claim this grades: every ## heading in CLAUDE.md except the index
 * heading itself appears as a table row, and every table row is one of those
 * headings. ### headings are out of scope on purpose — they are the live
 * coordination log and change every wave.
 *
 * What each check would go red on is written beside it. Empty-equals-empty
 * cannot pass: the live file must have more than ten standing sections, a
 * planted extra heading is missing from the extracted index, and deleting a
 * row breaks set equality.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const CLAUDE_MD = path.join(REPO_ROOT, 'CLAUDE.md');

/** An ATX ## heading. ### is excluded by the negative lookahead. */
const STANDING_HEADING = /^## (?!#)(.+)$/;
const INDEX_ROW = /^\| \[([^\]]+)\]\([^)]+\) \|/;

const INDEX_HEADING = 'Index';

function standingHeadings(source: string): string[] {
  const found: string[] = [];
  for (const line of source.split(/\r?\n/)) {
    const match = STANDING_HEADING.exec(line);
    if (match === null) continue;
    const title = match[1] ?? '';
    if (title === INDEX_HEADING) continue;
    found.push(title);
  }
  return found;
}

function indexSection(source: string): string {
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex((line) => line === `## ${INDEX_HEADING}`);
  if (start < 0) {
    throw new Error('CLAUDE.md has no ## Index section');
  }
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (STANDING_HEADING.test(lines[i] ?? '')) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join('\n');
}

function indexRows(source: string): string[] {
  const rows: string[] = [];
  for (const line of indexSection(source).split(/\r?\n/)) {
    const match = INDEX_ROW.exec(line);
    if (match !== null) rows.push(match[1] ?? '');
  }
  return rows;
}

describe('the CLAUDE.md index lists every standing section', () => {
  const source = readFileSync(CLAUDE_MD, 'utf8');
  const headings = standingHeadings(source);
  const rows = indexRows(source);

  it('has an Index heading that is not listed in the table', () => {
    expect(source.includes(`## ${INDEX_HEADING}`), 'the index section is missing').toBe(
      true,
    );
    expect(rows, 'the index listed itself').not.toContain(INDEX_HEADING);
    expect(headings, 'Index leaked into the standing inventory').not.toContain(
      INDEX_HEADING,
    );
  });

  it('matches the live ## headings in both directions', () => {
    expect(rows, 'index rows vs live headings').toEqual(headings);
  });

  it('is not an empty list matching an empty list', () => {
    expect(headings.length, 'too few standing sections to be a real census').toBeGreaterThan(
      10,
    );
    expect(rows.length).toBe(headings.length);
  });

  it('ignores ### headings, which are the dated coordination log', () => {
    const planted = `${source}\n### Planted Dated Claim\n`;
    expect(standingHeadings(planted)).toEqual(headings);
    expect(indexRows(planted)).toEqual(rows);
  });

  it('goes red when a standing heading is added and the table is not', () => {
    const planted = `${source}\n## Planted Section\n`;
    expect(standingHeadings(planted)).toContain('Planted Section');
    expect(indexRows(planted)).not.toContain('Planted Section');
    expect(indexRows(planted)).not.toEqual(standingHeadings(planted));
  });

  it('goes red when a table row is deleted', () => {
    const lines = source.split(/\r?\n/);
    const rowAt = lines.findIndex((line) => INDEX_ROW.test(line));
    expect(rowAt, 'no index row to delete').toBeGreaterThan(-1);
    const stripped = [...lines.slice(0, rowAt), ...lines.slice(rowAt + 1)].join('\n');
    const strippedRows = indexRows(stripped);
    expect(strippedRows.length, 'deleting a row did not shrink the table').toBe(
      rows.length - 1,
    );
    expect(strippedRows).not.toEqual(standingHeadings(stripped));
  });
});
