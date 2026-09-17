import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nextSessionStreak, readSessionStreak, writeSessionStreak } from "./streak.ts";

describe("session streak", () => {
  it("increments after a made meet and resets after a bomb", () => {
    assert.equal(nextSessionStreak(2, false, true), 3);
    assert.equal(nextSessionStreak(2, true, false), 0);
  });

  it("round-trips through storage", () => {
    const data = new Map<string, string>();
    const storage = {
      getItem(key: string) {
        return data.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        data.set(key, value);
      },
    };
    writeSessionStreak(storage, 4);
    assert.equal(readSessionStreak(storage), 4);
  });
});
