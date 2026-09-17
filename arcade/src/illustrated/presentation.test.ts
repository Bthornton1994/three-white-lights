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

describe("illustrated presentation has no silent sprite fallback", () => {
  it("ArcadeApp does not import or render SpriteStage", () => {
    const arcade = readFileSync(appPath("ui/ArcadeApp.tsx"), "utf8");
    assert.equal(arcade.includes("SpriteStage"), false);
    assert.equal(arcade.includes("/sprites/"), false);
    assert.equal(arcade.includes("frameSrcFor"), false);
    assert.equal(arcade.includes("SCENE.platform"), false);
    assert.match(arcade, /IllustratedMeetStage/);
    assert.match(arcade, /downloadResultsCard/);
    assert.match(arcade, /data-legacy-sprites="false"/);
  });

  it("IllustratedArt meet stage always labels the still as not animation", () => {
    const art = readFileSync(appPath("ui/IllustratedArt.tsx"), "utf8");
    assert.equal(art.includes("SpriteStage"), false);
    assert.equal(art.includes("/sprites/"), false);
    assert.match(art, /illustrated-still-caption/);
    assert.match(art, /captionForScreen/);
  });

  it("share card may composite existing stills but does not invent art", () => {
    const share = readFileSync(appPath("ui/share.ts"), "utf8");
    assert.match(share, /SHARE_BACKDROP/);
    assert.match(share, /downloadResultsCard/);
    assert.equal(share.includes("/sprites/"), false);
  });
});
