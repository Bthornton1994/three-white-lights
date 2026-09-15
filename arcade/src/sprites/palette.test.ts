import { describe, expect, it } from "vitest";
import { ARCADE_PALETTE, cssHex, plateColor } from "./palette";
import { platesForLoad } from "./plates";

describe("arcade sprite package", () => {
  it("keeps amber distinct from espresso and singlet", () => {
    expect(ARCADE_PALETTE.amber).not.toBe(ARCADE_PALETTE.espresso);
    expect(ARCADE_PALETTE.amber).not.toBe(ARCADE_PALETTE.singlet);
    expect(cssHex(ARCADE_PALETTE.amber)).toBe("#e0a040");
  });

  it("uses IPF plate colors", () => {
    expect(plateColor(25)).toBe(ARCADE_PALETTE.plateRed);
    expect(plateColor(20)).toBe(ARCADE_PALETTE.plateBlue);
    expect(plateColor(15)).toBe(ARCADE_PALETTE.plateYellow);
  });

  it("loads a 180 kg bar as 20 + two 25s and remainder per side", () => {
    const plates = platesForLoad(180);
    expect(plates.reduce((s, n) => s + n, 0)).toBe(80);
    expect(plates[0]).toBe(25);
  });
});
