import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  CHECK_IN_QUESTIONS,
  SESSION_COPY,
  SESSION_LAYOUT,
  SESSION_PROGRESSION_GUARD,
  SESSION_TUNING,
} from './sessionTuning';
import {
  CHARTED_REPS,
  RPE_CHART_COVERAGE,
  isChartedRpe,
  tryPercentOf1RM,
} from './rpe';
import { CHART_MAX_REP_MAX, tryEstimateE1rm } from './e1rm';
import { LIFT_ORDER } from './meet';
import { ascentDemand } from './lift';
import { LIFT_TUNING } from './liftTuning';
import {
  FATIGUE_TUNING,
  READINESS_BAND_ORDER,
  isFreeSession,
  type ReadinessBand,
  type ReadinessCheckIn,
} from './fatigue';
import { prescribeSession } from './session';
import { readinessCheckIn } from './fatigue';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SESSION_UI_DIR = path.resolve(HERE, '..', 'session');

// ---------------------------------------------------------------------------
// The template has to be something the published chart can answer for
// ---------------------------------------------------------------------------

describe('the prescription is inside the published chart', () => {
  it('offers only charted RPEs', () => {
    for (const rpe of SESSION_TUNING.RPE_CHOICES) {
      expect(isChartedRpe(rpe), `RPE ${rpe}`).toBe(true);
      expect(rpe).toBeGreaterThanOrEqual(RPE_CHART_COVERAGE.MIN_RPE);
      expect(rpe).toBeLessThanOrEqual(RPE_CHART_COVERAGE.MAX_RPE);
    }
    // GDD §3.3 says the choice is 6-10. Hand-written, not read back.
    expect([...SESSION_TUNING.RPE_CHOICES]).toEqual([6, 7, 8, 9, 10]);
  });

  it('every (reps, RPE) pair the loop can ask for is a real chart cell', () => {
    for (const rpe of SESSION_TUNING.RPE_CHOICES) {
      expect(tryPercentOf1RM(SESSION_TUNING.REPS_PER_SET, rpe), `${rpe}`).not.toBeNull();
    }
    expect(CHARTED_REPS).toContain(SESSION_TUNING.REPS_PER_SET);
  });

  it('every set the loop can REPORT is one e1rm.ts will answer for', () => {
    // The reported RPE is either the target or RPE 10 (failure), and the
    // reported reps are 1..REPS_PER_SET. All of those must be inside the
    // chart's coverage or the close-out would silently show nothing.
    for (const rpe of [...SESSION_TUNING.RPE_CHOICES, RPE_CHART_COVERAGE.MAX_RPE]) {
      for (let reps = 1; reps <= SESSION_TUNING.REPS_PER_SET; reps += 1) {
        const estimate = tryEstimateE1rm({ weight: 100, reps, rpe });
        expect(estimate, `${reps} @ ${rpe}`).not.toBeNull();
        expect(reps + (RPE_CHART_COVERAGE.MAX_RPE - rpe)).toBeLessThanOrEqual(CHART_MAX_REP_MAX);
      }
    }
  });

  it('opens on a choice that exists', () => {
    expect(SESSION_TUNING.DEFAULT_RPE_INDEX).toBeGreaterThanOrEqual(0);
    expect(SESSION_TUNING.DEFAULT_RPE_INDEX).toBeLessThan(SESSION_TUNING.RPE_CHOICES.length);
  });

  it('rotates lifts the progression boundary can actually name', () => {
    expect(SESSION_TUNING.LIFT_ROTATION.length).toBeGreaterThan(0);
    for (const lift of SESSION_TUNING.LIFT_ROTATION) {
      expect(LIFT_ORDER, `${lift}`).toContain(lift);
    }
    // Every competition lift gets a day, or one of them would never be trained.
    expect(new Set(SESSION_TUNING.LIFT_ROTATION).size).toBe(LIFT_ORDER.length);
  });

  it('has a starting e1RM for every lift it rotates through', () => {
    for (const lift of SESSION_TUNING.LIFT_ROTATION) {
      const start = SESSION_TUNING.STARTING_E1RM.kilograms[lift];
      expect(start, `${lift}`).toBeGreaterThan(0);
      expect(Number.isFinite(start)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// The ladder has to be felt in the mechanic, not only in the number
// ---------------------------------------------------------------------------

describe('the RPE ladder is not degenerate in the lift mechanic', () => {
  const steady = readinessCheckIn({ sleep: 'ok', soreness: 'normal', motivation: 'steady' });

  /** Peak demand at the sticking point, against a capacity of exactly 1. */
  function peakDemand(loadRatio: number): number {
    let peak = 0;
    for (let h = 0; h <= 1.0001; h += 0.005) {
      const demand = ascentDemand(h, loadRatio, 'squat');
      if (demand > peak) peak = demand;
    }
    return peak;
  }

  it('spans the load where the bar stops going up on its own', () => {
    // The whole content of GDD §3.3's "this single choice is what makes the
    // mode feel real". If every rung were below the crossing the drive input
    // would be decoration; if every rung were above it, the lightest choice
    // would be unmakeable and there would be no way back from a bad session.
    const peaks = SESSION_TUNING.RPE_CHOICES.map((rpe) =>
      peakDemand(prescribeSession(200, 'squat', rpe, steady, 1).loadRatio),
    );
    const capacity = LIFT_TUNING.LIFTER_CAPACITY;
    expect(peaks[0]).toBeLessThan(capacity);
    expect(peaks[peaks.length - 1]).toBeGreaterThan(capacity);
    for (let i = 1; i < peaks.length; i += 1) {
      expect(peaks[i]!, `rung ${i}`).toBeGreaterThan(peaks[i - 1]!);
    }
  });

  it('the readiness nudge moves the bar across that crossing too', () => {
    // A primed day at the default rung is a materially harder bar than a
    // grinding day at it — which is what makes the check-in a decision rather
    // than a label.
    const rpe = SESSION_TUNING.RPE_CHOICES[SESSION_TUNING.DEFAULT_RPE_INDEX]!;
    const primed = readinessCheckIn({ sleep: 'good', soreness: 'fresh', motivation: 'fired-up' });
    const wrecked = readinessCheckIn({ sleep: 'poor', soreness: 'sore', motivation: 'flat' });
    const hot = peakDemand(prescribeSession(200, 'squat', rpe, primed, 1).loadRatio);
    const cold = peakDemand(prescribeSession(200, 'squat', rpe, wrecked, 1).loadRatio);
    expect(hot).toBeGreaterThan(LIFT_TUNING.LIFTER_CAPACITY);
    expect(cold).toBeLessThan(LIFT_TUNING.LIFTER_CAPACITY);
  });
});

// ---------------------------------------------------------------------------
// The rungs differ where the design says they do
// ---------------------------------------------------------------------------

describe('the shipped template against the hidden fatigue model', () => {
  it('the lightest rung is a session that costs nothing — GDD §12.3’s free day', () => {
    expect(
      isFreeSession({
        day: 0,
        lift: 'squat',
        topRpe: SESSION_TUNING.RPE_CHOICES[0]!,
        workSets: SESSION_TUNING.WORK_SETS,
        repsPerSet: SESSION_TUNING.REPS_PER_SET,
      }),
    ).toBe(true);
  });

  it('the top rung is not free — a hard day has to cost something', () => {
    expect(
      isFreeSession({
        day: 0,
        lift: 'squat',
        topRpe: SESSION_TUNING.RPE_CHOICES[SESSION_TUNING.RPE_CHOICES.length - 1]!,
        workSets: SESSION_TUNING.WORK_SETS,
        repsPerSet: SESSION_TUNING.REPS_PER_SET,
      }),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Beats
// ---------------------------------------------------------------------------

describe('the beats are beats', () => {
  it('every duration is a positive finite number of milliseconds', () => {
    const durations: readonly [string, number][] = [
      ['BRIEFING_REVEAL_MS', SESSION_TUNING.BRIEFING_REVEAL_MS],
      ['REP_RESULT_HOLD_MS', SESSION_TUNING.REP_RESULT_HOLD_MS],
      ['SET_REST_MS', SESSION_TUNING.SET_REST_MS],
      ['CLOSE_OUT_ROW_FADE_MS', SESSION_TUNING.CLOSE_OUT_ROW_FADE_MS],
      ['CLOSE_OUT_ROW_STAGGER_MS', SESSION_TUNING.CLOSE_OUT_ROW_STAGGER_MS],
      ['CLOSE_OUT_E1RM_COUNT_MS', SESSION_TUNING.CLOSE_OUT_E1RM_COUNT_MS],
      ['CLOSE_OUT_STREAK_POP_MS', SESSION_TUNING.CLOSE_OUT_STREAK_POP_MS],
      ['HUMAN_INPUT_BUDGET_MS', SESSION_TUNING.HUMAN_INPUT_BUDGET_MS],
    ];
    for (const [name, value] of durations) {
      expect(Number.isFinite(value), name).toBe(true);
      expect(value, name).toBeGreaterThan(0);
    }
  });

  it('the streak pop grows rather than shrinks', () => {
    expect(SESSION_TUNING.CLOSE_OUT_STREAK_POP_SCALE).toBeGreaterThan(1);
  });

  it('the guard is a gain, not a loss', () => {
    expect(SESSION_PROGRESSION_GUARD.MAX_E1RM_GAIN_FRACTION_PER_SESSION).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------

describe('copy', () => {
  it('covers every question and every answer the check-in can produce', () => {
    expect([...CHECK_IN_QUESTIONS]).toEqual(['sleep', 'soreness', 'motivation']);
    for (const question of CHECK_IN_QUESTIONS) {
      expect(SESSION_COPY.CHECK_IN_QUESTION[question].length).toBeGreaterThan(0);
      const answers = SESSION_COPY.CHECK_IN_ANSWER[question];
      const modelAnswers = FATIGUE_TUNING.READINESS_ANSWER_SCORE[question];
      // Exactly the answers the fatigue model scores — no more, no fewer.
      expect(Object.keys(answers).sort()).toEqual(Object.keys(modelAnswers).sort());
      for (const value of Object.values(answers)) {
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });

  it('covers every lift it rotates through', () => {
    expect(SESSION_COPY.CHECK_IN_LIFT_QUESTION.length).toBeGreaterThan(0);
    for (const lift of SESSION_TUNING.LIFT_ROTATION) {
      expect(SESSION_COPY.LIFT_LABEL[lift].length).toBeGreaterThan(0);
    }
  });

  it('never puts a number in the copy the player reads', () => {
    // A percentage or a level in this table is how a fatigue meter gets shipped
    // by accident (GDD §3.4, §12.3). The surfaced "+5%" is assembled by
    // `fatigue.ts` from its own tuning, not written here.
    //
    // Only the VALUES: the key names are not read by anybody. `e1RM` is the
    // stat's name and its 1 is a letter's worth of it, so it is removed rather
    // than the scan being loosened — a copy string of "+5%" or "level 3" still
    // fails.
    const strings: string[] = [];
    const walk = (value: unknown): void => {
      if (typeof value === 'string') strings.push(value);
      else if (typeof value === 'object' && value !== null) Object.values(value).forEach(walk);
    };
    walk(SESSION_COPY);
    expect(strings.length).toBeGreaterThan(20);
    for (const value of strings) {
      expect(value.replace(/e1RM/g, 'eRM'), value).not.toMatch(/\d/);
    }
    // The positive control: the scan sees a digit when there is one.
    expect(() => {
      for (const value of [...strings, 'Feeling primed +5%']) {
        expect(value.replace(/e1RM/g, 'eRM')).not.toMatch(/\d/);
      }
    }).toThrow();
  });

  it('never names a Total — GDD §3.2', () => {
    expect(JSON.stringify(SESSION_COPY)).not.toMatch(/total/i);
  });

  it('has a headline for every readiness band, via fatigue.ts', () => {
    // The session does not restate these; this is the check that it does not
    // need to.
    //
    // WHAT THIS USED TO DO, so it does not get written that way again: it
    // looped over `READINESS_BAND_ORDER` and, in the body, asserted
    // `band.length > 0` (true of every non-empty string) and re-read the SAME
    // neutral headline N times. A band whose headline was `''` passed it, which
    // is the one thing it claimed to rule out. The fix is to reach each band
    // for real.
    //
    // Answers chosen by hand against `FATIGUE_TUNING.READINESS_BAND_MIN_SCORE`,
    // not derived from it — deriving the input from the table under test would
    // pass on any table.
    const REACHES: Readonly<Record<ReadinessBand, ReadinessCheckIn>> = {
      primed: { sleep: 'good', soreness: 'fresh', motivation: 'fired-up' },
      ready: { sleep: 'good', soreness: 'normal', motivation: 'steady' },
      steady: { sleep: 'ok', soreness: 'normal', motivation: 'steady' },
      grinding: { sleep: 'poor', soreness: 'sore', motivation: 'flat' },
    };

    const headlines = new Map<ReadinessBand, string>();
    for (const band of READINESS_BAND_ORDER) {
      const report = readinessCheckIn(REACHES[band]);
      // The fixture actually lands in the band it is filed under. Without this
      // every row could be measuring `steady` again.
      expect(report.band, `${band} is reachable`).toBe(band);
      expect(report.headline.trim(), `${band} headline`).not.toBe('');
      expect(report.label.trim(), `${band} label`).not.toBe('');
      expect(report.label.startsWith(report.headline), `${band} label`).toBe(true);
      headlines.set(band, report.headline);
    }

    // Every band was reached, and no two share a headline — a table that
    // answered the same phrase for all four would satisfy a non-empty check.
    expect(headlines.size).toBe(READINESS_BAND_ORDER.length);
    expect(new Set(headlines.values()).size).toBe(READINESS_BAND_ORDER.length);

    // GDD §3.2 gives two of the four verbatim. Hand-written from the document.
    expect(headlines.get('primed')).toBe('Feeling primed');
    expect(headlines.get('grinding')).toBe('Grinding today');

    // And the signed percentage §3.2 asks to be surfaced is on the label at the
    // ends and absent in the middle, where there is no nudge to name.
    expect(readinessCheckIn(REACHES.primed).label).toBe('Feeling primed +5%');
    expect(readinessCheckIn(REACHES.grinding).label).toBe('Grinding today -5%');
    expect(readinessCheckIn(REACHES.steady).label).toBe(
      readinessCheckIn(REACHES.steady).headline,
    );
  });
});

// ---------------------------------------------------------------------------
// THE MAGIC-NUMBER SCAN — LOCAL, AND NOT THE AUTHORITY
//
// `src/tuning/audit.ts` enforces CLAUDE.md's "never scatter them as magic
// numbers across components" over the WHOLE tree, and more strictly than this
// does: it understands regex literals and template interpolations, and it does
// not treat a bare `2` in a property-value position as structural.
//
// What is kept here is the part it does not do — the dead-knob sweep over
// `SESSION_TUNING` and `SESSION_LAYOUT`'s own keys, which is about this file's
// contents rather than about the tree. The numeric scan below is redundant,
// and left in place as a second independent opinion on the same directory.
// ---------------------------------------------------------------------------

/** Strip comments and string literals so only real code is scanned. */
function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/`(?:\\.|[^`\\])*`/g, '``');
}

/**
 * 0, 1 and 2 are indices, halves and the identity of a multiplier. Anything
 * else is a value somebody would want to turn by hand.
 *
 * Same set, and the same leading-dot-aware pattern, as `liftTuning.test.ts`.
 */
const STRUCTURAL = new Set(['0', '1', '2']);
const NUMERIC_LITERAL = /(?<![\w.$])(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?/gi;

function magicNumbersIn(source: string): string[] {
  const found: string[] = [];
  for (const match of codeOnly(source).matchAll(NUMERIC_LITERAL)) {
    if (STRUCTURAL.has(match[0])) continue;
    found.push(match[0]);
  }
  return found;
}

function sourcesUnder(dir: string): { file: string; source: string }[] {
  const out: { file: string; source: string }[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.endsWith('.test.ts') || entry.endsWith('.test.tsx')) continue;
    if (!entry.endsWith('.ts') && !entry.endsWith('.tsx')) continue;
    out.push({ file: path.join(dir, entry), source: readFileSync(path.join(dir, entry), 'utf8') });
  }
  return out;
}

describe('no feel value lives outside sessionTuning.ts', () => {
  const uiSources = sourcesUnder(SESSION_UI_DIR);
  const gameSources = [
    { file: 'session.ts', source: readFileSync(path.join(HERE, 'session.ts'), 'utf8') },
    { file: 'sessionServer.ts', source: readFileSync(path.join(HERE, 'sessionServer.ts'), 'utf8') },
  ];

  it('finds the session screens at all', () => {
    // Without this the scan below passes vacuously on an empty directory —
    // which is the shape of blind check this suite is meant not to have.
    expect(uiSources.length).toBeGreaterThanOrEqual(4);
    expect(uiSources.some((s) => s.file.endsWith('.tsx'))).toBe(true);
  });

  it('the scan can actually see a magic number', () => {
    // The positive control. A scan that matched nothing would pass every file.
    expect(magicNumbersIn('const gap = 17;')).toEqual(['17']);
    expect(magicNumbersIn('const half = .5;')).toEqual(['.5']);
    expect(magicNumbersIn('const ok = arr[0] + 1 + 2;')).toEqual([]);
    expect(magicNumbersIn('// const gap = 17;')).toEqual([]);
    expect(magicNumbersIn("const s = 'padding: 17px';")).toEqual([]);
  });

  it('the session screens contain no bare number', () => {
    for (const { file, source } of uiSources) {
      expect(magicNumbersIn(source), path.basename(file)).toEqual([]);
    }
  });

  it('the pure session modules contain no bare number', () => {
    for (const { file, source } of gameSources) {
      expect(magicNumbersIn(source), file).toEqual([]);
    }
  });

  it('the check-in drawer leaves the gym the majority of the 390×844 frame', () => {
    // Authored against SESSION_LAYOUT's own 390×844 note. The gym is the
    // majority when the docked drawer plus the pill-band clearance is less
    // than half the frame — Iron & Amber panel 03, not a full-screen form.
    const frame = 844;
    expect(
      SESSION_LAYOUT.CHECK_IN_DRAWER_MAX_HEIGHT + SESSION_LAYOUT.ROOM_FOOT_CLEARANCE,
    ).toBeLessThan(frame / 2);
  });

  it('the screens read their geometry from SESSION_LAYOUT', () => {
    const code = uiSources.map((s) => codeOnly(s.source)).join('\n');
    const used = Object.keys(SESSION_LAYOUT).filter((key) => code.includes(key));
    // Not every key has to be used by every screen, but a layout block nothing
    // reads is a dead knob.
    expect(used.length).toBeGreaterThan(0);
    const dead = Object.keys(SESSION_LAYOUT).filter((key) => !code.includes(key));
    expect(dead, 'layout keys no screen reads').toEqual([]);
  });

  it('every tuning key is read by something', () => {
    const code = [...uiSources, ...gameSources].map((s) => codeOnly(s.source)).join('\n');
    const dead = Object.keys(SESSION_TUNING).filter(
      (key) => !code.includes(key) && key !== 'HUMAN_INPUT_BUDGET_MS',
    );
    // HUMAN_INPUT_BUDGET_MS is excluded because it is deliberately consumed by
    // the suite alone — see its note. Everything else must have a caller.
    expect(dead, 'tuning keys nothing reads').toEqual([]);
  });
});
