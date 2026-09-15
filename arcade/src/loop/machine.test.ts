import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  afterJudging,
  backToLiftSelect,
  chooseLift,
  continueAfterOutcome,
  finishTiming,
  initialState,
  recordTap,
  startTiming,
  startWalkout,
} from "./machine.ts";
import { cuesForLift, sequenceDurationMs } from "./timing.ts";

describe("arcade loop machine", () => {
  it("starts on the title screen", () => {
    assert.equal(initialState().screen, "title");
  });

  it("runs lift → attempts → walkout → timing → judging → success", () => {
    let state = chooseLift(initialState(), "bench");
    assert.equal(state.screen, "attempts");
    assert.equal(state.lift, "bench");
    state = startWalkout(state);
    assert.equal(state.screen, "walkout");
    state = startTiming(state);
    const duration = sequenceDurationMs("bench");
    const cues = cuesForLift("bench", 0);
    cues.forEach((cue, i) => {
      state = recordTap(state, i, cue.center * duration);
    });
    state = finishTiming(state);
    assert.equal(state.screen, "judging");
    assert.equal(state.lastOutcome?.made, true);
    state = afterJudging(state);
    assert.equal(state.screen, "success");
  });

  it("uses lift-specific cues, never squat labels on bench or deadlift", () => {
    const squat = cuesForLift("squat", 0).map((c) => c.id);
    const bench = cuesForLift("bench", 0).map((c) => c.id);
    const dead = cuesForLift("deadlift", 0).map((c) => c.id);
    assert.deepEqual(squat, ["depth", "drive"]);
    assert.deepEqual(bench, ["pause", "press"]);
    assert.deepEqual(dead, ["pull", "lock"]);
  });

  it("bombs after three misses and writes a zero total", () => {
    const storage = memoryStorage();
    let state = chooseLift(initialState(storage), "deadlift");
    for (let i = 0; i < 3; i += 1) {
      state = startWalkout(state);
      state = startTiming(state);
      state = finishTiming(state);
      state = afterJudging(state);
      assert.equal(state.screen, "failure");
      state = continueAfterOutcome(state, storage);
    }
    assert.equal(state.screen, "bomb");
    assert.equal(state.meet?.bombed, true);
    assert.equal(state.meet?.totalKg, 0);
  });

  it("returns to lift select without leftover meet state", () => {
    const next = backToLiftSelect();
    assert.equal(next.screen, "lift");
    assert.equal(next.meet, null);
  });
});

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key: string) {
      return data.get(key) ?? null;
    },
    key() {
      return null;
    },
    removeItem(key: string) {
      data.delete(key);
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    },
  };
}
