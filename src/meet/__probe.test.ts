import { describe, expect, it } from 'vitest';

import { blitOver, renderGymScene } from '../art/gymScene';
import { GYM_LIFT_STAGE } from '../art/gymTuning';
import { renderLifterFrame } from '../art/lifterSprite';
import { BAR_AND_COLLARS_KG } from '../art/plates';
import type { IndexGrid } from '../art/raster';
import { LOAD_PRESETS, QUANTISE } from '../art/spriteTuning';
import { hallBraceFrame, hallLifterFrame, hallScene, hallPlateCount } from './meetHall';

const HEAVY_KG = 240;
const LOAD = LOAD_PRESETS.MAXIMAL;

function compose(spec: ReturnType<typeof hallLifterFrame>, rise: number, dx = 0): IndexGrid {
  const scene = renderGymScene(hallScene(rise));
  const { grid } = renderLifterFrame(spec);
  return blitOver(scene, grid, GYM_LIFT_STAGE.SPRITE_X + dx, GYM_LIFT_STAGE.SPRITE_Y);
}

function diff(a: IndexGrid, b: IndexGrid): number {
  let n = 0;
  for (let i = 0; i < a.data.length; i += 1) if (a.data[i] !== b.data[i]) n += 1;
  return n;
}

describe('probe', () => {
  it('measures channels', () => {
    const base = hallLifterFrame(LOAD, HEAVY_KG, BAR_AND_COLLARS_KG);
    const brace = hallBraceFrame(LOAD);
    const b0 = compose(base, 0);
    const lines: string[] = [];
    lines.push(`plates=${hallPlateCount(HEAVY_KG, BAR_AND_COLLARS_KG)}`);
    lines.push(
      `base: depth=${base.depth} strain=${base.strainLevel} pitch=${base.pitchLevel} lat=${base.barLateralPx} tilt=${base.barTiltDeg} bend=${base.barBendPx} motes=${base.chalkMotes}`,
    );
    lines.push(`braceDepth=${brace.poseDepth} depthSteps=${QUANTISE.DEPTH_STEPS}`);
    for (const steps of [1, 2]) {
      const d = Math.min(1, Math.max(0, (Math.round(base.depth * QUANTISE.DEPTH_STEPS) + steps) / QUANTISE.DEPTH_STEPS));
      lines.push(`depth +${steps} step -> ${d.toFixed(4)} : ${diff(b0, compose({ ...base, depth: d }, 0))} px`);
    }
    for (const dp of [1, 2, 3]) {
      lines.push(`pitchLevel +${dp}: ${diff(b0, compose({ ...base, pitchLevel: base.pitchLevel + dp }, 0))} px`);
    }
    for (const t of [1, 2]) {
      lines.push(`tilt +${t}deg: ${diff(b0, compose({ ...base, barTiltDeg: base.barTiltDeg + t }, 0))} px`);
    }
    for (const l of [1, 2]) {
      lines.push(`lateral +${l}px: ${diff(b0, compose({ ...base, barLateralPx: base.barLateralPx + l }, 0))} px`);
    }
    for (const m of [0.25, 0.5, 1, 1.5]) {
      lines.push(`bend +${m}px: ${diff(b0, compose({ ...base, barBendPx: base.barBendPx + m }, 0))} px`);
    }
    for (const s of [1]) {
      lines.push(`strain +${s}: ${diff(b0, compose({ ...base, strainLevel: base.strainLevel + s }, 0))} px`);
    }
    for (const mo of [1, 3, 7]) {
      lines.push(`chalkMotes ${mo}: ${diff(b0, compose({ ...base, chalkMotes: mo }, 0))} px`);
    }
    for (const dx of [1, 2]) {
      lines.push(`bodyDx ${dx}: ${diff(b0, compose(base, 0, dx))} px`);
    }
    const r5 = compose(base, 5);
    for (const r of [4, 5, 6, 7, 8, 9, 10]) {
      lines.push(`rise ${r} vs 0: ${diff(b0, compose(base, r))} px ; vs 5: ${diff(r5, compose(base, r))} px`);
    }
    // eslint-disable-next-line no-console
    console.log('\n' + lines.join('\n'));
    expect(lines.length).toBeGreaterThan(0);
  });
});
