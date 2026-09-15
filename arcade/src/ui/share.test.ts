import { describe, expect, it } from "vitest";
import { paintElement } from "./share";

describe("results card share snapshot", () => {
  it("exports a DOM layout painter instead of a truncated innerText dump", () => {
    expect(typeof paintElement).toBe("function");
    const src = paintElement.toString();
    expect(src).toContain("getBoundingClientRect");
    expect(src.includes("slice(0, 48)")).toBe(false);
  });
});
