/**
 * a2LifterFreeze.test.ts — A2 may not retune A0 lifts, A1 competition
 * authorities, or Session B's empire tree.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { CAREER_LIFTER_KEYS } from '../career/eligibility';
import { LIFTER_PROFILE_KEYS } from './lifterProfile';
import { MEET_ENTRY, MEET_LAYOUT } from './meetTuning';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(HERE, '..', '..');
const A0 = '39400d97';
const A1_CLOSED = '3cee186c';

function gitDiffNames(against: string, ...paths: string[]): string[] {
  if (!existsSync(path.join(REPO, '.git'))) return [];
  const output = execFileSync('git', ['diff', '--name-only', against, '--', ...paths], {
    cwd: REPO,
    encoding: 'utf8',
  });
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

describe('29 a0-untouched', () => {
  it('the A0 lift runtime is unchanged against 39400d97', () => {
    expect(gitDiffNames(A0, 'src/game/lift.ts', 'src/game/liftTuning.ts', 'src/lift')).toEqual([]);
  });
});

describe('A1 competition authorities stay where A1 closed them', () => {
  it('placing, board math, and meet-day machine are unchanged since A1 closed', () => {
    expect(
      gitDiffNames(
        A1_CLOSED,
        'src/game/meet.ts',
        'src/game/meetBoard.ts',
        'src/game/meetDay.ts',
      ),
    ).toEqual([]);
  });

  it('meet server only gained copy-through of daily-loop siblings since A1 closed', () => {
    // ServerRecord grew a required training-progress field. applyMeetResult
    // must name it or tsc fails; it must not interpret it. The only authorized
    // post-A1 edit is carrying the field through untouched, same standing as
    // fatigue.
    const output = execFileSync('git', ['diff', A1_CLOSED, '--', 'src/game/meetServer.ts'], {
      cwd: REPO,
      encoding: 'utf8',
    });
    const added = output.split('\n').filter((line) => line.startsWith('+') && !line.startsWith('+++'));
    expect(added).toEqual([
      "+    // CARRIED THROUGH UNTOUCHED. Progression credit is the daily loop's.",
      '+    trainingProgressCredit: record.trainingProgressCredit,',
    ]);
  });

  it('MEET_ENTRY remains the debug/test fixture, not a produced identity', () => {
    expect(MEET_ENTRY.name).toBe('A. LIFTER');
    expect(MEET_ENTRY.lot).toBe(3);
  });
});

describe('Session B stays off-limits', () => {
  it('src/empire is untouched by this worktree against A1 closed', () => {
    expect(gitDiffNames(A1_CLOSED, 'src/empire')).toEqual([]);
  });
});

describe('authority split', () => {
  it('profile keys stay identity-only; CareerLifter stays three progression facts', () => {
    expect([...LIFTER_PROFILE_KEYS]).toEqual(['id', 'name', 'sex', 'bodyweight']);
    expect([...CAREER_LIFTER_KEYS]).toEqual(['federationId', 'bestTotalKg', 'enteredMeetIds']);
  });

  it('the player board row no longer overwrites the name with YOU', () => {
    const source = readFileSync(path.join(REPO, 'src/meet/MeetBoardView.tsx'), 'utf8');
    expect(source).toMatch(/\{row\.name\}/);
    expect(source).not.toMatch(/row\.isPlayer \? MEET_COPY\.BOARD_YOU : row\.name/);
  });

  it('Create keeps the action above a phone keyboard', () => {
    const source = readFileSync(path.join(REPO, 'src/meet/LifterScreen.tsx'), 'utf8');
    expect(source).toMatch(/KeyboardAvoidingView/);
    expect(source).toMatch(/LIFTER_KEYBOARD_CLEARANCE/);
    expect(MEET_LAYOUT.LIFTER_KEYBOARD_CLEARANCE).toBe(280);
  });
});
