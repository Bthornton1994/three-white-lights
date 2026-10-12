import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { alphaStats, composeStage, diffPng, downscaleNearest, lifterRegionMismatch, newPng } from "../src/png.ts";

function fill(png: ReturnType<typeof newPng>, x: number, y: number, w: number, h: number, rgba: [number, number, number, number]): void {
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) {
      const i = (yy * png.width + xx) * 4;
      png.data[i] = rgba[0];
      png.data[i + 1] = rgba[1];
      png.data[i + 2] = rgba[2];
      png.data[i + 3] = rgba[3];
    }
  }
}

describe("alpha measurement", () => {
  it("finds the opaque bbox, contact row and foot centre", () => {
    const png = newPng(64, 64);
    fill(png, 10, 20, 20, 30, [200, 100, 50, 255]);
    const s = alphaStats(png);
    assert.equal(s.minX, 10);
    assert.equal(s.maxX, 29);
    assert.equal(s.minY, 20);
    assert.equal(s.maxY, 49);
    assert.equal(s.semiTransparent, 0);
    assert.equal(s.colors, 1);
    assert.equal(s.footCenterX, 19.5);
  });

  it("counts fringe pixels", () => {
    const png = newPng(8, 8);
    fill(png, 0, 0, 2, 2, [1, 2, 3, 128]);
    assert.equal(alphaStats(png).semiTransparent, 4);
  });
});

describe("stage composition", () => {
  it("places the lifter at the requested offset over a cover-scaled platform", () => {
    const platform = newPng(640, 360);
    fill(platform, 0, 0, 640, 360, [10, 20, 30, 255]);
    const lifter = newPng(32, 32);
    fill(lifter, 4, 28, 24, 4, [250, 240, 230, 255]);
    const out = composeStage(platform, lifter, 64, 64, 0, 30);
    const at = (x: number, y: number) => Array.from(out.data.subarray((y * 64 + x) * 4, (y * 64 + x) * 4 + 3));
    assert.deepEqual(at(10, 61), [250, 240, 230]);
    assert.deepEqual(at(10, 10), [10, 20, 30]);
    assert.equal(lifterRegionMismatch(out, out, lifter, 0, 30).mismatch, 0);
    const moved = composeStage(platform, lifter, 64, 64, 0, 20);
    assert.ok(lifterRegionMismatch(moved, out, lifter, 0, 30).mismatch > 0);
  });

  it("diffs and downscales", () => {
    const a = newPng(4, 4);
    const b = newPng(4, 4);
    fill(a, 0, 0, 4, 4, [0, 0, 0, 255]);
    fill(b, 0, 0, 4, 4, [0, 0, 0, 255]);
    fill(b, 0, 0, 2, 2, [255, 255, 255, 255]);
    const d = diffPng(a, b);
    assert.equal(d.mismatchFraction, 0.25);
    const big = newPng(8, 8);
    fill(big, 0, 0, 8, 8, [7, 7, 7, 255]);
    const small = downscaleNearest(big, 2);
    assert.equal(small.width, 4);
    assert.equal(small.data[0], 7);
  });
});
