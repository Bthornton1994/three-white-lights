import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveAttempt, scoreMeet } from "../math/score.ts";
import {
  drawResultsCard,
  judgeLightGlyphs,
  lightGlyph,
  shareAttemptRight,
  shareCardRows,
  type ShareCanvas,
  type ShareDrawContext,
} from "./share.ts";

function sampleMeet() {
  const made = resolveAttempt({
    attempt: 1,
    weightKg: 162.5,
    e1rmKg: 180,
    grades: ["great", "great"],
    fatigue: 0,
  });
  const miss = resolveAttempt({
    attempt: 2,
    weightKg: 172.5,
    e1rmKg: 180,
    grades: ["miss", "miss"],
    fatigue: 0,
  });
  const saved = resolveAttempt({
    attempt: 3,
    weightKg: 180,
    e1rmKg: 180,
    grades: ["good", "good"],
    fatigue: 0.2,
  });
  return scoreMeet("squat", 180, [162.5, 172.5, 180], [made, miss, saved], 0.2, 1);
}

function recordingCanvas(): { canvas: ShareCanvas; texts: string[] } {
  const texts: string[] = [];
  const ctx: ShareDrawContext = {
    fillStyle: "",
    font: "",
    fillRect() {
      return;
    },
    fillText(text: string) {
      texts.push(text);
    },
    measureText(text: string) {
      return { width: text.length * 10 };
    },
  };
  return {
    texts,
    canvas: {
      width: 0,
      height: 0,
      getContext(id: "2d") {
        return id === "2d" ? ctx : null;
      },
    },
  };
}

describe("share card output path", () => {
  it("encodes white and red judge-light glyphs", () => {
    assert.equal(lightGlyph("white"), "○");
    assert.equal(lightGlyph("red"), "●");
    assert.equal(lightGlyph("off"), "·");
    assert.equal(judgeLightGlyphs(["white", "white", "red"]), "○ ○ ●");
  });

  it("puts judge-light glyphs on each attempt row", () => {
    const meet = sampleMeet();
    const a1 = meet.outcomes[0];
    const a2 = meet.outcomes[1];
    assert.ok(a1 && a2);
    assert.match(shareAttemptRight(a1), /○ ○ ○/);
    assert.match(shareAttemptRight(a2), /● ● ●/);
    const rows = shareCardRows(meet);
    const attemptRows = rows.filter(([left]) => left.startsWith("A"));
    assert.equal(attemptRows.length, 3);
    for (const [, right] of attemptRows) {
      assert.match(right, /[○●]/);
    }
  });

  it("draws those glyphs through the PNG canvas path", () => {
    const meet = sampleMeet();
    const { canvas, texts } = recordingCanvas();
    const drawn = drawResultsCard(meet, canvas);
    assert.equal(drawn, canvas);
    assert.equal(drawn.width, 1080);
    assert.equal(drawn.height, 1350);
    const joined = texts.join("\n");
    assert.match(joined, /○ ○ ○/);
    assert.match(joined, /● ● ●/);
    assert.match(joined, /○ ○ ●/);
    assert.ok(texts.includes("IRON & AMBER ARCADE"));
    assert.ok(texts.includes("A1"));
    assert.ok(texts.includes("A2"));
    assert.ok(texts.includes("A3"));
  });
});
