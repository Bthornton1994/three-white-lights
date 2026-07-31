import { describe, expect, it } from 'vitest';
import {
  BAR_AND_COLLARS_KG,
  PLATE_SPECS,
  layoutSleeve,
  plateDiameterPx,
  visualPlateStack,
} from './plates';
import { BAR, PX_PER_METRE } from './spriteTuning';

const kgs = (total: number): number[] =>
  visualPlateStack(total).perSide.map((p) => p.spec.kg);

describe('visual plate stack', () => {
  it('loads a real meet weight the way a real loader would', () => {
    // 250 kg: (250 - 25) / 2 = 112.5 per side = 25*4 + 10 + 2.5
    expect(kgs(250)).toEqual([25, 25, 25, 25, 10, 2.5]);
    // 100 kg: 37.5 per side = 25 + 10 + 2.5
    expect(kgs(100)).toEqual([25, 10, 2.5]);
    // 182.5 kg: 78.75 per side = 25*3 + 2.5 + 1.25
    expect(kgs(182.5)).toEqual([25, 25, 25, 2.5, 1.25]);
  });

  it('returns an empty sleeve for a bare bar and below', () => {
    expect(kgs(BAR_AND_COLLARS_KG)).toEqual([]);
    expect(kgs(10)).toEqual([]);
  });

  it('loads heaviest inboard, which is both correct and how it is drawn', () => {
    for (const total of [100, 182.5, 250, 305, 400]) {
      const stack = kgs(total);
      for (let i = 1; i < stack.length; i += 1) {
        expect(stack[i - 1] ?? 0, `${total}kg`).toBeGreaterThanOrEqual(stack[i] ?? 0);
      }
    }
  });

  it('accounts for the whole bar with no remainder on meet-legal weights', () => {
    for (let total = 27.5; total <= 400; total += 2.5) {
      const stack = visualPlateStack(total);
      const loaded =
        stack.perSide.reduce((sum, p) => sum + p.spec.kg, 0) * 2 + BAR_AND_COLLARS_KG;
      expect(stack.remainderKg, `${total}kg`).toBe(0);
      expect(loaded, `${total}kg`).toBeCloseTo(total, 6);
    }
  });

  it('handles half-kilo change weights without dropping a disc to float error', () => {
    // A total must be a multiple of 0.5 kg for the per-side half to land on the
    // 0.25 kg change-disc grid; anything finer is not loadable on a real bar
    // and this module is not the place that decides that (see the header).
    for (const total of [25.5, 26, 27, 101.5, 227.5]) {
      const stack = visualPlateStack(total);
      const loaded =
        stack.perSide.reduce((sum, p) => sum + p.spec.kg, 0) * 2 + BAR_AND_COLLARS_KG;
      expect(loaded, `${total}kg`).toBeCloseTo(total, 6);
    }
  });
});

describe('disc diameters', () => {
  it('keeps 25 and 20 the same size and everything below strictly smaller', () => {
    // The real ladder: 25 and 20 are both 450 mm; below that they step down.
    const byKg = new Map(PLATE_SPECS.map((s) => [s.kg, s.diameterMm]));
    expect(byKg.get(25)).toBe(byKg.get(20));
    const ordered = [20, 15, 10, 5, 2.5, 1.25, 1, 0.75, 0.5, 0.25];
    for (let i = 1; i < ordered.length; i += 1) {
      const prev = byKg.get(ordered[i - 1] ?? 0) ?? 0;
      const cur = byKg.get(ordered[i] ?? 0) ?? 0;
      expect(cur, `${ordered[i]}kg`).toBeLessThan(prev);
    }
  });

  it('renders a 25 kg disc at true scale, not an exaggerated one', () => {
    const spec = PLATE_SPECS[0];
    expect(spec).toBeDefined();
    if (spec === undefined) return;
    expect(spec.kg).toBe(25);
    // 450 mm at 34.29 px/m is 15.4 px. Thickness is exaggerated; diameter is not.
    expect(plateDiameterPx(spec)).toBeCloseTo(0.45 * PX_PER_METRE, 6);
    expect(plateDiameterPx(spec)).toBeGreaterThan(15);
    expect(plateDiameterPx(spec)).toBeLessThan(16);
  });

  it('marks the change-disc diameters as unsourced rather than pretending', () => {
    const sourced = PLATE_SPECS.filter((s) => s.diameterSourced).map((s) => s.kg);
    const estimated = PLATE_SPECS.filter((s) => !s.diameterSourced).map((s) => s.kg);
    expect(sourced).toEqual([25, 20, 15, 10, 5, 2.5, 1.25]);
    expect(estimated).toEqual([1, 0.75, 0.5, 0.25]);
  });
});

describe('sleeve layout', () => {
  it('fits a 250 kg bar at the authored pitch with nothing dropped', () => {
    const layout = layoutSleeve(visualPlateStack(250));
    expect(layout.slots).toHaveLength(6);
    expect(layout.droppedCount).toBe(0);
    expect(layout.pitchPx).toBe(BAR.PLATE_PITCH_PX);
    expect(layout.collarDxInner + BAR.COLLAR_WIDTH_PX).toBeLessThanOrEqual(BAR.HALF_SPAN_PX);
  });

  it('compresses the pitch rather than dropping discs when the sleeve crowds', () => {
    // 350 kg is seven discs a side; they cannot fit at pitch 3.
    const layout = layoutSleeve(visualPlateStack(350));
    expect(layout.slots.length).toBeGreaterThanOrEqual(7);
    expect(layout.droppedCount).toBe(0);
    expect(layout.pitchPx).toBeLessThan(BAR.PLATE_PITCH_PX);
  });

  it('always leaves a gap between discs, at every pitch it uses', () => {
    // The gap is what the outline pass fills; without it a stack of same-colour
    // discs is one solid block and the load stops being countable.
    for (const total of [100, 182.5, 250, 305, 350, 400]) {
      const layout = layoutSleeve(visualPlateStack(total));
      for (const slot of layout.slots) {
        expect(slot.facePx, `${total}kg`).toBeLessThan(layout.pitchPx);
        expect(slot.facePx, `${total}kg`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('keeps every disc and the collar inside the bar', () => {
    for (const total of [27.5, 100, 250, 350, 400]) {
      const layout = layoutSleeve(visualPlateStack(total));
      for (const slot of layout.slots) {
        expect(slot.dxInner, `${total}kg`).toBeGreaterThanOrEqual(BAR.SHAFT_HALF_PX);
        expect(slot.dxInner + slot.facePx, `${total}kg`).toBeLessThanOrEqual(BAR.HALF_SPAN_PX);
      }
      expect(layout.collarDxInner + BAR.COLLAR_WIDTH_PX, `${total}kg`).toBeLessThanOrEqual(
        BAR.HALF_SPAN_PX,
      );
    }
  });

  it('draws a visibly denser sleeve as the bar gets heavier', () => {
    // Plate count is the fastest read of load there is, so it must be monotone.
    let prev = -1;
    for (const total of [50, 100, 150, 200, 250, 300]) {
      const count = layoutSleeve(visualPlateStack(total)).slots.length;
      expect(count, `${total}kg`).toBeGreaterThan(prev);
      prev = count;
    }
  });
});
