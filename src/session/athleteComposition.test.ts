import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { ATHLETE_COMPOSITION, ATHLETE_RIG } from '../art/spriteTuning';
import { codeOnly } from '../tuning/audit';
import { composeAthleteStage, DEFAULT_HUD_INSETS, requiredSpan, type Viewport } from './athleteComposition';

const PHONES: readonly Viewport[] = [
  { width: 375, height: 812 },
  { width: 390, height: 844 },
];
const W = ATHLETE_RIG.CANVAS_PX.WIDTH;
const H = ATHLETE_RIG.CANVAS_PX.HEIGHT;
const EPS = 1e-6;

describe('composeAthleteStage — one rect, one scale, the floor where the HUD leaves it', () => {
  it.each(PHONES.map((v) => [`${v.width}×${v.height}`, v] as const))('%s: room and rig share one frame at the canvas aspect, cover-fit, centred', (_l, viewport) => {
    const c = composeAthleteStage(viewport);
    // One rect, at the canvas's own aspect — no independent stretch of either layer.
    expect(Object.keys(c)).not.toContain('roomFrame');
    expect(Object.keys(c)).not.toContain('rigFrame');
    expect(Math.abs(c.frame.width / c.frame.height - W / H)).toBeLessThan(EPS);
    expect(Math.abs(c.frame.width - W * c.scale)).toBeLessThan(EPS);
    expect(Math.abs(c.frame.height - H * c.scale)).toBeLessThan(EPS);
    // A portrait phone is narrower than the canvas at this scale: cover, bleeding symmetrically.
    expect(c.fit).toBe('cover');
    expect(c.frame.width).toBeGreaterThan(viewport.width);
    expect(Math.abs(c.frame.x + c.frame.width / 2 - viewport.width / 2)).toBeLessThan(EPS);
    expect(Math.abs(c.cropped.left - c.cropped.right)).toBeLessThan(EPS);
    expect(c.cropped.left).toBeGreaterThan(0);
  });

  it.each(PHONES.map((v) => [`${v.width}×${v.height}`, v] as const))('%s: the required span exactly fills the band between the HUD insets; the floor sits FOOTROOM above the bottom HUD', (_l, viewport) => {
    const c = composeAthleteStage(viewport);
    const span = requiredSpan();
    expect(Math.abs(c.crownY - ATHLETE_COMPOSITION.HEADROOM_PX * c.scale - c.band.top)).toBeLessThan(EPS);
    expect(Math.abs(c.floorY + ATHLETE_COMPOSITION.FOOTROOM_PX * c.scale - c.band.bottom)).toBeLessThan(EPS);
    expect(c.band).toEqual({ top: DEFAULT_HUD_INSETS.top, bottom: viewport.height - DEFAULT_HUD_INSETS.bottom });
    // Everything the sport needs is inside the band: crown, bar at lockout, the hole, the floor.
    for (const line of [c.crownY, c.lockoutBarY, c.holeBarY, c.floorY]) {
      expect(line).toBeGreaterThanOrEqual(c.band.top - EPS);
      expect(line).toBeLessThanOrEqual(c.band.bottom + EPS);
    }
    // And the lines keep their canvas order and spacing at the one scale.
    expect(c.crownY).toBeLessThan(c.lockoutBarY);
    expect(c.lockoutBarY).toBeLessThan(c.holeBarY);
    expect(c.holeBarY).toBeLessThan(c.floorY);
    expect(Math.abs((c.floorY - c.lockoutBarY) / c.scale - (ATHLETE_COMPOSITION.FLOOR_Y - ATHLETE_COMPOSITION.LOCKOUT_BAR_Y))).toBeLessThan(EPS);
    expect(Math.abs(c.underHud.top - span.top)).toBeLessThan(EPS);
    expect(Math.abs(c.underHud.bottom - (H - span.bottom))).toBeLessThan(EPS);
    // The athlete reads at phone size: the 1010-px crown-to-floor stands over 400 viewport px tall.
    expect(c.floorY - c.crownY).toBeGreaterThan(400);
  });

  it('is a function of geometry alone — the same viewport composes identically every time, and takes no rep', () => {
    const a = composeAthleteStage({ width: 390, height: 844 });
    const b = composeAthleteStage({ width: 390, height: 844 });
    expect(a).toEqual(b);
    const code = codeOnly(readFileSync(new URL('./athleteComposition.ts', import.meta.url), 'utf8'));
    expect(code, 'viewport and hud only').toMatch(/composeAthleteStage\(viewport: Viewport, hud: HudInsets = DEFAULT_HUD_INSETS\)/);
    expect(code).not.toMatch(/\b(LiftState|LiftPresentationState|barHeight|tick|Date\.now|Math\.random)\b/);
  });

  it('a wider viewport letterboxes rather than stretches, and the span still fills the band', () => {
    const c = composeAthleteStage({ width: 1024, height: 768 }, { top: 40, bottom: 40 });
    expect(c.fit).toBe('contain');
    expect(c.frame.width).toBeLessThan(1024);
    expect(c.cropped.left).toBe(0);
    expect(c.cropped.right).toBe(0);
    expect(Math.abs(c.frame.width / c.frame.height - W / H)).toBeLessThan(EPS);
    expect(Math.abs(c.floorY + ATHLETE_COMPOSITION.FOOTROOM_PX * c.scale - c.band.bottom)).toBeLessThan(EPS);
  });

  it('custom HUD insets move the band and the frame with it; a HUD that leaves no band is refused', () => {
    const tall = composeAthleteStage({ width: 390, height: 844 }, { top: 200, bottom: 200 });
    const short = composeAthleteStage({ width: 390, height: 844 }, { top: 0, bottom: 0 });
    expect(tall.scale).toBeLessThan(short.scale);
    expect(tall.band).toEqual({ top: 200, bottom: 644 });
    expect(() => composeAthleteStage({ width: 390, height: 844 }, { top: 500, bottom: 400 })).toThrow(RangeError);
    expect(() => composeAthleteStage({ width: 0, height: 844 })).toThrow(RangeError);
    expect(() => composeAthleteStage({ width: 390, height: 844 }, { top: -1, bottom: 0 })).toThrow(RangeError);
  });

  it('the handoff document’s canvas table names the same lines this composition is built on', () => {
    const handoff = readFileSync(new URL('../../docs/design/RIVE-AUTHORING-HANDOFF.md', import.meta.url), 'utf8');
    expect(handoff).toMatch(new RegExp(`\\| Floor line \\| \\*\\*y = ${ATHLETE_COMPOSITION.FLOOR_Y}\\*\\*`));
    expect(handoff).toMatch(new RegExp(`Lockout bar line \\(\`barHeight = 1\`\\) \\| \\*\\*y = ${ATHLETE_COMPOSITION.LOCKOUT_BAR_Y}\\*\\*`));
    expect(handoff).toMatch(new RegExp(`Hole bar line \\(\`barHeight = 0\`\\) \\| \\*\\*y = ${ATHLETE_COMPOSITION.HOLE_BAR_Y}\\*\\*`));
    expect(handoff).toMatch(new RegExp(`crown at y ≈ ${ATHLETE_COMPOSITION.CROWN_Y}`));
    expect(handoff).toContain(`**${W} × ${H} px**`);
  });
});
