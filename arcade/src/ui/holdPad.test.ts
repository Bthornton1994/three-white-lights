import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { createHoldPad, HOLD_RELEASE_EVENTS, type HoldInput } from "./holdPad.ts";

/** A pad wired like ArcadeApp: live only on the play screen, inputs recorded in order. */
function harness(target: EventTarget | null = new EventTarget()) {
  let screen: "walkout" | "play" | "judging" | "success" | "transition" | "title" = "walkout";
  const inputs: HoldInput[] = [];
  const pad = createHoldPad({ isLive: () => screen === "play", onInput: (k) => inputs.push(k), target });
  const goTo = (next: typeof screen): void => {
    screen = next;
    pad.screenChanged();
  };
  return { pad, inputs, goTo, target, screenOf: () => screen };
}

describe("hold pad regression: a lift that resolves while held must not swallow the next attempt's first press", () => {
  it("1. attempt 1: the first press is accepted and tracked as held", () => {
    const h = harness();
    h.goTo("play");
    assert.equal(h.pad.down(), "press");
    assert.equal(h.pad.held, true);
    assert.deepEqual(h.inputs, ["press"]);
  });

  it("2. the lift resolves while the pointer remains down: the hold is forgotten without a stray input", () => {
    const h = harness();
    h.goTo("play");
    h.pad.down();
    h.goTo("judging"); // resolvePlay: screen leaves play while the finger is still down
    assert.equal(h.pad.held, false);
    assert.deepEqual(h.inputs, ["press"]);
    // The finger comes up later on the judging screen: no input reaches the sim.
    h.target!.dispatchEvent(new Event("pointerup"));
    assert.equal(h.pad.held, false);
    assert.deepEqual(h.inputs, ["press"]);
  });

  it("3./4. attempt 2 begins and its first valid press is accepted", () => {
    const h = harness();
    h.goTo("play");
    h.pad.down();
    h.goTo("judging");
    h.goTo("success");
    h.goTo("transition");
    h.goTo("walkout");
    h.goTo("play"); // attempt 2
    assert.equal(h.pad.held, false, "data-held must be false before the new attempt");
    assert.equal(h.pad.down(), "press", "first valid press of attempt 2 must be accepted");
    assert.deepEqual(h.inputs, ["press", "press"]);
  });

  it("the global pointerup alone also fixes the leak when no screen-change notification arrives", () => {
    let screen = "play";
    const inputs: HoldInput[] = [];
    const target = new EventTarget();
    const pad = createHoldPad({ isLive: () => screen === "play", onInput: (k) => inputs.push(k), target });
    pad.down();
    screen = "judging"; // pad unmounts; nobody calls screenChanged
    target.dispatchEvent(new Event("pointerup"));
    assert.equal(pad.held, false);
    screen = "play";
    assert.equal(pad.down(), "press");
    assert.deepEqual(inputs, ["press", "press"]);
  });

  it("5a. pointerup while live queues exactly one release and clears held", () => {
    const h = harness();
    h.goTo("play");
    h.pad.down();
    h.target!.dispatchEvent(new Event("pointerup"));
    assert.equal(h.pad.held, false);
    assert.deepEqual(h.inputs, ["press", "release"]);
    // A second pointerup (pad handler + window handler both fire on a real tap) is a no-op.
    h.target!.dispatchEvent(new Event("pointerup"));
    assert.deepEqual(h.inputs, ["press", "release"]);
  });

  it("5b. pointercancel while live releases like pointerup", () => {
    const h = harness();
    h.goTo("play");
    h.pad.down();
    h.target!.dispatchEvent(new Event("pointercancel"));
    assert.equal(h.pad.held, false);
    assert.deepEqual(h.inputs, ["press", "release"]);
  });

  it("5c. reset to title forgets the hold", () => {
    const h = harness();
    h.goTo("play");
    h.pad.down();
    h.goTo("title");
    assert.equal(h.pad.held, false);
    h.goTo("play");
    assert.equal(h.pad.down(), "press");
  });

  it("5d. unmount cleanup detaches the global listeners and forgets the hold", () => {
    const h = harness();
    h.goTo("play");
    h.pad.down();
    h.pad.dispose();
    assert.equal(h.pad.held, false);
    h.target!.dispatchEvent(new Event("pointerup"));
    assert.deepEqual(h.inputs, ["press"], "no input after dispose");
    assert.equal(h.pad.down(), null, "a disposed pad accepts nothing");
    h.pad.dispose(); // idempotent
  });
});

describe("hold pad keeps the original input model", () => {
  it("ignores a press while already held and a release while not held", () => {
    const h = harness();
    h.goTo("play");
    assert.equal(h.pad.down(), "press");
    assert.equal(h.pad.down(), null);
    assert.equal(h.pad.up(), "release");
    assert.equal(h.pad.up(), null);
    assert.deepEqual(h.inputs, ["press", "release"]);
  });

  it("queues nothing when the lift is not live", () => {
    const h = harness();
    assert.equal(h.pad.down(), null);
    assert.equal(h.pad.held, false);
    assert.deepEqual(h.inputs, []);
  });

  it("works without a global target", () => {
    const h = harness(null);
    h.goTo("play");
    assert.equal(h.pad.down(), "press");
    assert.equal(h.pad.up(), "release");
  });

  it("listens to exactly pointerup and pointercancel", () => {
    assert.deepEqual([...HOLD_RELEASE_EVENTS], ["pointerup", "pointercancel"]);
  });
});

describe("ArcadeApp wiring", () => {
  const app = readFileSync("src/ui/ArcadeApp.tsx", "utf8");

  it("drives the pad through the controller with window as the release target", () => {
    assert.match(app, /createHoldPad\(\{/);
    assert.match(app, /target: window/);
    assert.equal(app.includes("heldRef"), false, "the leaking ref is gone");
  });

  it("forgets the hold when the sim leaves play, when play starts, and on any screen change", () => {
    assert.match(app, /if \(next\.screen !== "play"\) padRef\.current\?\.screenChanged\(\);/);
    assert.match(app, /padRef\.current\?\.screenChanged\(\);\s*setState\(\(s\) => startPlay\(s\)\)/);
    assert.match(app, /padRef\.current\?\.screenChanged\(\);\s*\}, \[state\.screen, state\.currentAttempt\]\)/);
  });

  it("releases on keyup regardless of screen and disposes on unmount", () => {
    assert.match(app, /pad\.dispose\(\);/);
    assert.match(app, /data-held=\{padRef\.current\?\.held \? "true" : "false"\}/);
  });
});
