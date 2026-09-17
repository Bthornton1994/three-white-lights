import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const FEEL_SHA256 = "b26c21b520d17a8e87e6abac17661fc219870a2320a376b5b1b1adfe0bc2425c";

function feelPath(): string {
  for (const candidate of ["src/feel.ts", "src/arcade/feel.ts"]) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error("feel.ts missing");
}

describe("illustrated edition safeguards", () => {
  it("leaves feel.ts byte-identical to the Fable SoT tip", () => {
    const digest = createHash("sha256").update(readFileSync(feelPath())).digest("hex");
    assert.equal(digest, FEEL_SHA256);
  });
});
