import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

function appPath(rel: string): string {
  for (const root of ["src", "src/arcade"]) {
    const candidate = `${root}/${rel}`;
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`missing ${rel}`);
}

describe("illustrated shell keeps title/select/results; play uses arcade frames", () => {
  it("ArcadeApp keeps illustrated title, lift cards, results, and share", () => {
    const arcade = readFileSync(appPath("ui/ArcadeApp.tsx"), "utf8");
    assert.equal(arcade.includes("from \"./SpriteStage"), false);
    assert.equal(arcade.includes("SCENE.title"), false);
    assert.equal(arcade.includes("LIFT_CARD"), false);
    assert.match(arcade, /IllustratedMeetStage/);
    assert.match(arcade, /IllustratedTitleArt/);
    assert.match(arcade, /IllustratedLiftCardArt/);
    assert.match(arcade, /downloadResultsCard/);
    assert.match(arcade, /data-visual-shell="illustrated"/);
    assert.match(arcade, /walkoutProgress/);
  });

  it("IllustratedArt play stage drives the athlete with frameSrcFor", () => {
    const art = readFileSync(appPath("ui/IllustratedArt.tsx"), "utf8");
    assert.match(art, /frameSrcFor/);
    assert.match(art, /usesArcadeFrames/);
    assert.match(art, /illustrated-athlete/);
    assert.match(art, /SquatDepthGauge/);
    assert.match(art, /data-squat-depth-phase/);
    assert.match(art, /IllustratedLiftCardArt/);
    assert.match(art, /TITLE_STILL/);
    assert.match(art, /className="stage-slot"/);
    assert.match(art, /squat-depth-legend/);
    assert.match(art, /squat-depth-band/);
    assert.equal(/showDepthGauge[\s\S]*?screen === "results"/.test(art), false);
    assert.match(
      art,
      /lift === "squat" &&\s*animated &&\s*\(screen === "walkout" \|\| screen === "timing" \|\| screen === "play" \|\| screen === "judging"\)/,
    );
  });

  it("meet play reserves a stage slot and keeps the depth gauge beside the lifter", () => {
    const arcade = readFileSync(appPath("ui/ArcadeApp.tsx"), "utf8");
    const css = readFileSync(appPath("styles.css"), "utf8");
    assert.match(arcade, /meet-play-screen/);
    assert.match(css, /--meet-stage-slot/);
    assert.match(css, /\.illustrated-animated-stage \.stage-slot/);
    assert.match(css, /grid-column: 3/);
    assert.match(css, /\.meet-play-screen \.stage-wrap\.illustrated-timing-wrap/);
    assert.equal(/\.squat-depth-gauge \{[\s\S]*?top: 40px/.test(css), false);
    assert.match(css, /squat-depth-legend/);
    assert.match(css, /squat-depth-band/);
  });

  it("share card may composite existing stills but does not invent art", () => {
    const share = readFileSync(appPath("ui/share.ts"), "utf8");
    assert.match(share, /SHARE_BACKDROP/);
    assert.match(share, /downloadResultsCard/);
    assert.equal(share.includes("/sprites/"), false);
  });
});