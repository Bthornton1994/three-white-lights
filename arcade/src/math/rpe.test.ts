import { describe, expect, it } from "vitest";
import { impliedRpeFromPercent, loadFromE1rm, percentOf1rm } from "./rpe";

describe("Tuchscherer RPE chart", () => {
  it("uses published singles", () => {
    expect(percentOf1rm(1, 10)).toBe(100);
    expect(percentOf1rm(1, 9)).toBe(95.5);
    expect(percentOf1rm(1, 8)).toBe(92.2);
    expect(percentOf1rm(1, 7)).toBe(89.2);
    expect(percentOf1rm(1, 6)).toBe(86.3);
  });

  it("uses published five-rep row", () => {
    expect(percentOf1rm(5, 10)).toBe(86.3);
    expect(percentOf1rm(5, 8)).toBe(81.1);
    expect(percentOf1rm(5, 6)).toBe(76.2);
  });

  it("loads an RPE 8 single from e1RM", () => {
    expect(loadFromE1rm(200, 1, 8)).toBeCloseTo(184.4, 5);
  });

  it("implies RPE 9 from 95.5%", () => {
    expect(impliedRpeFromPercent(95.5)).toBe(9);
  });
});
