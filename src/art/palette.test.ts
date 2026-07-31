import { describe, expect, it } from 'vitest';
import {
  BANK_SIZE,
  EQUIPMENT_BANK,
  LIFTER_BANK,
  PAL,
  PALETTE_BANKS,
  PALETTE_INDEX_COUNT,
  PLATE_HUE_SOURCE,
  RAMPS,
  STAGE_BANK,
  chan5To8,
  chan8To5,
  colorAt,
  isAllocatedIndex,
  isTransparentIndex,
  outlineIndexForBank,
  paletteIndex,
  rgb5ToRgb8,
  type Rgb5,
} from './palette';
import { PLATE_HUE_RAMPS, PLATE_SPECS } from './plates';

/** Rec. 601 luma, good enough to order a ramp by value. */
function luma(c: Rgb5): number {
  const [r, g, b] = rgb5ToRgb8(c);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function hexToRgb5(hex: string): Rgb5 {
  const n = parseInt(hex.replace('#', ''), 16);
  return [chan8To5((n >> 16) & 0xff), chan8To5((n >> 8) & 0xff), chan8To5(n & 0xff)];
}

/** Index of the largest channel, or -1 when two channels tie for largest. */
function dominantChannel(c: Rgb5): number {
  const max = Math.max(c[0], c[1], c[2]);
  const winners = [0, 1, 2].filter((i) => c[i] === max);
  return winners.length === 1 ? (winners[0] ?? -1) : -1;
}

describe('5-bit colour space', () => {
  it('expands 5-bit channels to the full 8-bit range', () => {
    expect(chan5To8(0)).toBe(0);
    expect(chan5To8(31)).toBe(255);
    // Bit replication, not a multiply by 8: 16 must land near mid-grey, not 128
    // exactly, and 31 must reach 255 rather than 248.
    expect(chan5To8(16)).toBe(132);
  });

  it('round-trips every allocated palette colour through 8-bit and back', () => {
    for (const bank of PALETTE_BANKS) {
      for (const c of bank.colors) {
        const [r, g, b] = rgb5ToRgb8(c);
        expect([chan8To5(r), chan8To5(g), chan8To5(b)]).toEqual([c[0], c[1], c[2]]);
      }
    }
  });
});

describe('palette structure', () => {
  it('has three banks of at most 16 slots each', () => {
    expect(PALETTE_BANKS).toHaveLength(3);
    expect(PALETTE_INDEX_COUNT).toBe(48);
    for (const bank of PALETTE_BANKS) {
      expect(bank.colors.length).toBeGreaterThan(0);
      expect(bank.colors.length).toBeLessThanOrEqual(BANK_SIZE);
    }
  });

  it('fills the two character banks exactly to the hardware limit', () => {
    // 15 usable colours plus the transparent sentinel is the SNES sprite
    // palette. Fewer would be leaving the budget unspent; more is impossible.
    expect(LIFTER_BANK.colors).toHaveLength(BANK_SIZE);
    expect(EQUIPMENT_BANK.colors).toHaveLength(BANK_SIZE);
    // STAGE is deliberately thin — real environment art is a separate piece.
    expect(STAGE_BANK.colors.length).toBeLessThan(BANK_SIZE);
  });

  it('treats slot 0 of every bank as transparent', () => {
    for (let bank = 0; bank < PALETTE_BANKS.length; bank += 1) {
      expect(isTransparentIndex(paletteIndex(bank, 0))).toBe(true);
      expect(isAllocatedIndex(paletteIndex(bank, 0))).toBe(false);
    }
    expect(isTransparentIndex(PAL.SKIN_MID)).toBe(false);
  });

  it('stores every channel as an integer inside the 5-bit range', () => {
    for (const bank of PALETTE_BANKS) {
      for (const c of bank.colors) {
        for (const ch of c) {
          expect(Number.isInteger(ch)).toBe(true);
          expect(ch).toBeGreaterThanOrEqual(0);
          expect(ch).toBeLessThanOrEqual(31);
        }
      }
    }
  });

  it('never spends two slots in a bank on the same colour', () => {
    for (const bank of PALETTE_BANKS) {
      const seen = new Set<string>();
      bank.colors.forEach((c, slot) => {
        if (slot === 0) return; // sentinel; its value is never drawn
        const key = c.join(',');
        expect(seen.has(key), `${bank.name} slot ${slot} duplicates ${key}`).toBe(false);
        seen.add(key);
      });
    }
  });

  it('resolves every name in PAL to an allocated colour', () => {
    for (const [name, index] of Object.entries(PAL)) {
      expect(isAllocatedIndex(index), `${name} -> ${index}`).toBe(true);
      expect(colorAt(index)).toBeDefined();
    }
  });

  it('leaves unallocated indices undefined rather than silently valid', () => {
    // STAGE stops at slot 6; slot 7 of that bank must not resolve.
    expect(colorAt(paletteIndex(2, STAGE_BANK.colors.length))).toBeUndefined();
    expect(isAllocatedIndex(paletteIndex(2, STAGE_BANK.colors.length))).toBe(false);
  });
});

describe('ramps', () => {
  it('orders every ramp dark to light', () => {
    for (const [name, ramp] of Object.entries(RAMPS)) {
      for (let i = 1; i < ramp.length; i += 1) {
        const prev = colorAt(ramp[i - 1] ?? -1);
        const cur = colorAt(ramp[i] ?? -1);
        expect(prev, `${name}[${i - 1}]`).toBeDefined();
        expect(cur, `${name}[${i}]`).toBeDefined();
        if (prev === undefined || cur === undefined) continue;
        expect(luma(cur), `${name} step ${i}`).toBeGreaterThanOrEqual(luma(prev));
      }
    }
  });

  it('keeps each ramp inside a single palette bank', () => {
    for (const [name, ramp] of Object.entries(RAMPS)) {
      const banks = new Set(ramp.map((i) => Math.floor(i / BANK_SIZE)));
      expect(banks.size, `${name} spans banks ${[...banks].join(',')}`).toBe(1);
    }
  });

  it('shifts hue across the skin ramp instead of scaling one colour', () => {
    // A pure value ramp — identical hue at every step — is the clearest tell of
    // generated pixel art. The shadow must lean redder than the highlight.
    const shadow = colorAt(PAL.SKIN_SHADOW);
    const high = colorAt(PAL.SKIN_HI);
    expect(shadow).toBeDefined();
    expect(high).toBeDefined();
    if (shadow === undefined || high === undefined) return;
    const shadowRedBias = shadow[0] / Math.max(1, shadow[2]);
    const highRedBias = high[0] / Math.max(1, high[2]);
    expect(shadowRedBias).toBeGreaterThan(highRedBias);
  });
});

describe('outline selection', () => {
  it('outlines equipment cool and everything else warm', () => {
    expect(outlineIndexForBank(PAL.STEEL_MID)).toBe(PAL.EQ_OUTLINE);
    expect(outlineIndexForBank(PAL.PLATE_RED_LIGHT)).toBe(PAL.EQ_OUTLINE);
    expect(outlineIndexForBank(PAL.SKIN_MID)).toBe(PAL.OUTLINE);
    expect(outlineIndexForBank(PAL.SINGLET_MID)).toBe(PAL.OUTLINE);
  });

  it('keeps the equipment outline darker than the backdrop it sits against', () => {
    // The 1px gap between two discs is filled with EQ_OUTLINE. If it were not
    // darker than the backdrop, a stack of plates would stop being countable.
    const outline = colorAt(PAL.EQ_OUTLINE);
    const backdrop = colorAt(PAL.BACKDROP_DARK);
    expect(outline).toBeDefined();
    expect(backdrop).toBeDefined();
    if (outline === undefined || backdrop === undefined) return;
    expect(luma(outline)).toBeLessThan(luma(backdrop));
  });
});

describe('plate colours against their documented source', () => {
  it('keeps every plate hue on the same dominant channel as the source hex', () => {
    // Provenance: OpenLifter's PlateColors, recorded in PLATE_HUE_SOURCE. The
    // ramp entries are hand-darkened and hand-lightened for a 2-step ramp, so
    // they are not byte-identical to the source; what must survive is which
    // channel dominates, because that is what makes the plate read as "the red
    // one" to a lifter glancing at a bar.
    for (const [hue, hex] of Object.entries(PLATE_HUE_SOURCE)) {
      const source = hexToRgb5(hex);
      const ramp = PLATE_HUE_RAMPS[hue as keyof typeof PLATE_HUE_RAMPS];
      const light = colorAt(ramp[ramp.length - 1] ?? -1);
      expect(light, hue).toBeDefined();
      if (light === undefined) continue;

      if (hue === 'BLACK') {
        // #000000 has no dominant channel; ours must stay near-neutral.
        expect(Math.max(...light) - Math.min(...light)).toBeLessThanOrEqual(3);
      } else {
        expect(dominantChannel(light), `${hue} from ${hex}`).toBe(dominantChannel(source));
      }
    }
  });

  it('gives every plate hue a two-step ramp that actually steps', () => {
    for (const [hue, ramp] of Object.entries(PLATE_HUE_RAMPS)) {
      expect(ramp.length, hue).toBe(2);
      const shade = colorAt(ramp[0] ?? -1);
      const light = colorAt(ramp[1] ?? -1);
      expect(shade, hue).toBeDefined();
      expect(light, hue).toBeDefined();
      if (shade === undefined || light === undefined) continue;
      expect(luma(light) - luma(shade), hue).toBeGreaterThan(20);
    }
  });

  it('has a ramp for every denomination it can draw', () => {
    for (const spec of PLATE_SPECS) {
      expect(PLATE_HUE_RAMPS[spec.hue], `${spec.kg}kg`).toBeDefined();
    }
  });
});
