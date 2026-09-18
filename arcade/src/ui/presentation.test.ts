import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

function src(rel: string): string {
  for (const root of ["src", "src/arcade"]) {
    const candidate = `${root}/${rel}`;
    if (existsSync(candidate)) return readFileSync(candidate, "utf8");
  }
  throw new Error(`missing ${rel}`);
}

describe("sprite stage presentation", () => {
  it("drives active lifts with SpriteStage, not Fable stills or a DEPTH rail", () => {
    const app = src("ui/ArcadeApp.tsx");
    const stage = src("ui/SpriteStage.tsx");
    const css = src("styles.css");
    assert.match(app, /from "\.\/SpriteStage/);
    assert.match(app, /data-visual-shell="sprite-stage"/);
    assert.equal(app.includes("IllustratedMeetStage"), false);
    assert.equal(app.includes("IllustratedTitleArt"), false);
    assert.equal(app.includes("TimingLane"), false);
    assert.equal(app.includes("squat-depth-gauge"), false);
    assert.match(stage, /data-sprite-stage="true"/);
    assert.match(stage, /STAGE\.width/);
    assert.match(stage, /placeAnchor/);
    assert.match(css, /\.sprite-world/);
    assert.match(css, /width: 320px/);
    assert.match(css, /width: 960px/);
  });

  it("keeps Iron & Amber chrome and the hold pad, without a player-facing candidate banner", () => {
    const app = src("ui/ArcadeApp.tsx");
    const css = src("styles.css");
    assert.match(app, /Step onto the platform/);
    assert.match(app, /hold-pad/);
    assert.equal(app.includes("edition-banner"), false);
    assert.equal(app.includes("data-edition-banner"), false);
    assert.match(css, /--color-amber: #d4892a/);
    assert.match(css, /--font-display: "Barlow Condensed"/);
    assert.match(css, /\.edition-banner \{[\s\S]*?display: none/);
  });
});
