/**
 * TRAINING-FIT-02 TWL BO product honesty fence (Session A only).
 *
 * Canonical bar path:
 *   design/session-a-training-fit-02/00-twl-bo-product-bar.md
 * Plus PX:
 *   design/session-a-training-fit-02/01-visual-rework-diagnosis.md
 *   design/session-a-training-fit-02/02-screen-03-impl-contract.md
 *   design/session-a-training-fit-02/03-developer-packet.md
 *
 * Those files are now in-tree. This suite requires them and fail-closes on
 * the filed bar: V1–V8, DO_NOT_MERGE, no check-in, Session A only. It does not
 * invent extra MUST text. GDD §3.2 / §3.4 / §12.3 still pin:
 *
 *   - no subjective check-in
 *   - empty history is forming, not fabricated fatigue
 *   - close-out moves e1RM, never Total
 *   - no visible fatigue meter
 *   - no product PASS / ACCEPT / FEEL_PASS claim
 *   - Session B / Gym Empire stay out of `src/session/`
 *
 * Soft feel remains CLOSED fail on the #43 lineage. Tech green ≠ BO PASS.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { FATIGUE_COPY, HISTORY_READINESS_KIND_ORDER } from '../game/fatigue';
import { SESSION_COPY } from '../game/sessionTuning';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');

const BO_BAR = 'design/session-a-training-fit-02/00-twl-bo-product-bar.md';
const PX_PACKETS = [
  'design/session-a-training-fit-02/01-visual-rework-diagnosis.md',
  'design/session-a-training-fit-02/02-screen-03-impl-contract.md',
  'design/session-a-training-fit-02/03-developer-packet.md',
] as const;

function readRepo(rel: string): string {
  return readFileSync(path.join(REPO, rel), 'utf8');
}

function sessionSources(): { file: string; source: string }[] {
  return readdirSync(HERE)
    .filter((name) => name.endsWith('.ts') || name.endsWith('.tsx'))
    .filter((name) => !name.endsWith('.test.ts') && !name.endsWith('.test.tsx'))
    .map((name) => ({ file: name, source: readFileSync(path.join(HERE, name), 'utf8') }));
}

function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/`(?:\\.|[^`\\])*`/g, '``');
}

describe('TRAINING-FIT-02 BO honesty fence', () => {
  it('requires the BO bar and PX 01–03 in-tree and cited', () => {
    expect(existsSync(path.join(REPO, BO_BAR))).toBe(true);
    for (const packet of PX_PACKETS) {
      expect(existsSync(path.join(REPO, packet))).toBe(true);
    }
    const palette = readRepo('src/session/sessionPalette.ts');
    expect(palette).toContain(BO_BAR);
    for (const packet of PX_PACKETS) {
      expect(palette).toContain(packet);
    }
  });

  it('does not claim product PASS, ACCEPT, or FEEL_PASS', () => {
    const gdd = readRepo('docs/GDD.md');
    const fit02 = gdd.slice(
      gdd.indexOf('SF-TWL-SESSION-A-TRAINING-FIT-02'),
      gdd.indexOf('One session per day, one competition lift'),
    );
    expect(fit02.length).toBeGreaterThan(200);
    expect(fit02).not.toMatch(/\bACCEPTED\b/);
    expect(fit02).not.toMatch(/\bPRODUCT PASS\b/);
    expect(fit02).not.toMatch(/\bFEEL_PASS\b/);
    const comments = sessionSources()
      .map((s) => s.source)
      .join('\n');
    expect(comments).not.toMatch(/\bBO_PASS\b/);
    expect(comments).not.toMatch(/\bPRODUCT_PASS\b/);
    expect(comments).not.toMatch(/TRAINING-FIT-02 is ACCEPTED/);
    expect(comments).not.toMatch(/Implementation Verified vs Screen 03 = YES/);
  });

  it('binds the landed BO bar and Screen 03 contract fail-closed', () => {
    const bar = readRepo(BO_BAR);
    expect(bar).toMatch(/DO_NOT_MERGE/);
    expect(bar).toMatch(/check-in/i);
    expect(bar).toMatch(/Session A only/);
    expect(bar).toMatch(/feel Ready/);
    expect(bar).toMatch(/Session B bleed/);
    expect(bar).not.toMatch(/\bFEEL_PASS\b/);
    const diagnosis = readRepo(PX_PACKETS[0]);
    expect(diagnosis).toMatch(/FEEL_FAIL/);
    expect(diagnosis).toMatch(/facility-first/i);
    expect(diagnosis).toMatch(/DO_NOT_MERGE/);
    const contract = readRepo(PX_PACKETS[1]);
    for (const reject of ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8'] as const) {
      expect(contract).toMatch(new RegExp(`\\b${reject}\\b`));
    }
    expect(contract).toMatch(/check-in/);
    expect(contract).toMatch(/overflowX/);
    const developer = readRepo(PX_PACKETS[2]);
    expect(developer).toMatch(/DO_NOT_MERGE/);
    expect(developer).toMatch(/Implementation Verified vs Screen 03 = NO/);
    expect(developer).not.toMatch(/Implementation Verified vs Screen 03 = YES/);
    const hasHex = /#[0-9A-Fa-f]{3,8}/.test([bar, diagnosis, contract, developer].join('\n'));
    if (hasHex) {
      const palette = readRepo('src/session/sessionPalette.ts');
      expect(palette).toMatch(/IRON_AMBER/);
    }
  });

  it('GDD §3.2 still records facility-first, no check-in, e1RM never Total', () => {
    const gdd = readRepo('docs/GDD.md');
    expect(gdd).toMatch(/facility-first/);
    expect(gdd).toMatch(/subjective three-tap readiness check-in/);
    expect(gdd).toMatch(/close-out still moves \*\*e1RM, never Total\*\*/);
    expect(gdd).toMatch(/THREE WHITE LIGHTS/);
    expect(gdd).toMatch(/GYM EMPIRE \/ CAREER/);
  });

  it('briefing screens do not render sleep / soreness / motivation', () => {
    const briefing = readFileSync(path.join(HERE, 'BriefingView.tsx'), 'utf8');
    const code = codeOnly(briefing);
    expect(code).not.toMatch(/CHECK_IN_QUESTION/);
    expect(code).not.toMatch(/CHECK_IN_ANSWER/);
    expect(briefing).not.toMatch(/session-check-in/);
    expect(briefing).not.toMatch(/check-in-sleep-/);
    expect(SESSION_COPY.CHECK_IN_QUESTION.sleep).toBe('SLEEP');
    expect(briefing).not.toContain(SESSION_COPY.CHECK_IN_QUESTION.sleep);
    expect(briefing).not.toContain(SESSION_COPY.CHECK_IN_QUESTION.soreness);
    expect(briefing).not.toContain(SESSION_COPY.CHECK_IN_QUESTION.motivation);
  });

  it('close-out player copy never says Total', () => {
    expect(SESSION_COPY.CLOSE_OUT_PR_HEADLINE).toMatch(/e1RM/);
    expect(SESSION_COPY.CLOSE_OUT_PR_HEADLINE).not.toMatch(/total/i);
    expect(SESSION_COPY.CLOSE_OUT_HELD_HEADLINE).not.toMatch(/total/i);
    expect(SESSION_COPY.CLOSE_OUT_E1RM_LABEL).toBe('e1RM');
    expect(SESSION_COPY.CLOSE_OUT_E1RM_LABEL).not.toMatch(/total/i);
    const closeOut = codeOnly(readFileSync(path.join(HERE, 'CloseOutView.tsx'), 'utf8'));
    expect(closeOut).toMatch(/outlookHeadline/);
    expect(closeOut).toMatch(/nextAction/);
    expect(closeOut).not.toMatch(/readTotalKg/);
  });

  it('empty history is forming copy, not a fabricated fresh or fatigue claim', () => {
    expect(FATIGUE_COPY.HISTORY_READINESS_HEADLINE.forming).toBe('Readiness forming');
    expect(FATIGUE_COPY.HISTORY_READINESS_DETAIL.forming).toMatch(/Train to give the next session/);
    for (const kind of HISTORY_READINESS_KIND_ORDER) {
      expect(FATIGUE_COPY.HISTORY_READINESS_HEADLINE[kind]).not.toMatch(/\d/);
      expect(FATIGUE_COPY.HISTORY_READINESS_DETAIL[kind]).not.toMatch(/%/);
      expect(FATIGUE_COPY.HISTORY_READINESS_HEADLINE[kind]).not.toMatch(/meter/i);
    }
  });

  it('session screens do not import Gym Empire or a Session B dock', () => {
    for (const { file, source } of sessionSources()) {
      expect(source, file).not.toMatch(/from ['"]\.\.\/empire\//);
      expect(source, file).not.toMatch(/from ['"][^'"]*GymScreen/);
      expect(source, file).not.toMatch(/floorgrid-scroll-y/);
    }
  });

  it('session chrome has an amber TRAIN location peer, not a Session B dock', () => {
    const shell = readRepo('src/shell/AppShell.tsx');
    expect(shell).toMatch(/shell-train-here/);
    expect(shell).toMatch(/TRAIN_NAV_LABEL/);
    expect(shell).toMatch(/navTrainingHere/);
    expect(codeOnly(shell)).not.toMatch(/navigate\([^)]*train/i);
    const briefing = readFileSync(path.join(HERE, 'BriefingView.tsx'), 'utf8');
    expect(briefing).not.toMatch(/shell-train-here/);
    expect(briefing).not.toMatch(/GYM\/SHOP\/STAFF/);
  });

  it('training chrome is facility-first: stage layer + lights + overlay, no check-in host', () => {
    const briefing = readFileSync(path.join(HERE, 'BriefingView.tsx'), 'utf8');
    expect(briefing).toMatch(/TrainingStagePreview/);
    expect(briefing).toMatch(/session-lights/);
    expect(briefing).toMatch(/session-briefing-overlay/);
    expect(briefing).toMatch(/session-start-lift/);
    expect(briefing).toMatch(/session-readiness-card/);
    expect(briefing).toMatch(/BRAND_MARK/);
    const stage = readFileSync(path.join(HERE, 'TrainingStagePreview.tsx'), 'utf8');
    expect(stage).toMatch(/liftStageScene/);
    expect(codeOnly(stage)).not.toMatch(/isometric/);
  });
});
