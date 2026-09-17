import { describe, expect, it } from "vitest";
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
} from "./machine";
import { cuesForLift, sequenceDurationMs } from "./timing";

describe("arcade loop machine", () => {
  it("starts on the title screen", () => {
    expect(initialState().screen).toBe("title");
  });

  it("runs lift → attempts → walkout → timing → judging → success", () => {
    let state = chooseLift(initialState(), "bench");
    expect(state.screen).toBe("attempts");
    state = startWalkout(state);
    expect(state.screen).toBe("walkout");
    state = startTiming(state);
    const duration = sequenceDurationMs("bench");
    const cues = cuesForLift("bench", 0);
    cues.forEach((cue, i) => {
      state = recordTap(state, i, cue.center * duration);
    });
    state = finishTiming(state);
    expect(state.screen).toBe("judging");
    expect(state.lastOutcome?.made).toBe(true);
    state = afterJudging(state);
    expect(state.screen).toBe("success");
  });

  it("bombs after three misses and does not write a career total", () => {
    let state = chooseLift(initialState(), "deadlift");
    for (let i = 0; i < 3; i += 1) {
      state = startWalkout(state);
      state = startTiming(state);
      state = finishTiming(state);
      state = afterJudging(state);
      expect(state.screen).toBe("failure");
      state = continueAfterOutcome(state);
    }
    expect(state.screen).toBe("bomb");
    expect(state.meet?.bombed).toBe(true);
    expect(state.meet?.totalKg).toBe(0);
  });

  it("returns to lift select without leftover meet state", () => {
    const next = backToLiftSelect();
    expect(next.screen).toBe("lift");
    expect(next.meet).toBeNull();
  });
});
