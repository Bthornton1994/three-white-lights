import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

function src(rel: string): string {
  for (const root of ["src", "src/arcade"]) {
    const candidate = `${root}/${rel}`;
    if (existsSync(candidate)) return readFileSync(candidate, "utf8");
  }
  throw new Error(`missing ${rel}`);
}

function bytes(rel: string): Buffer {
  for (const root of ["src", "src/arcade", "."]) {
    const candidate = join(root, rel);
    if (existsSync(candidate)) return readFileSync(candidate);
  }
  throw new Error(`missing ${rel}`);
}

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function listPngs(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...listPngs(p));
    else if (name.endsWith(".png")) out.push(p);
  }
  return out.sort();
}

/** Byte-identical to PR #81 `b80d6a0527eafb6c93afc43f63aad71c509fd277`. */
const PROTECTED_SHA256: Record<string, string> = {
  "feel.ts": "b26c21b520d17a8e87e6abac17661fc219870a2320a376b5b1b1adfe0bc2425c",
  "game/lift.ts": "4dc74947ffc64f1af36da92c01a7cfb53d3f021b802cba31f67c3ecdcb24e417",
  "game/liftTuning.ts": "ef920d59eecdb5ac698f7515a1efe4af1c7ee0e38f9079f7f9cd6deace441f2a",
  "ui/holdPad.ts": "23d9440670e8694769cc13daf139b7ad9510e5e636895d26230b8cc7570693a2",
  "sport/frames.ts": "f7ccdbdc5f402ebd2028e0ca3254e7014b2f0d19f4142fcc9f86249476a0ee66",
  "sprites/sheets.ts": "16b5c1e1c87551b3fc910572ddca7d87555595818319c9b1393a61fd4a6029de",
  "sprites/anchors.ts": "971da821caf858a7f6c67485167ac868442b05ac3b896b16b76fcb62afc9039c",
  "ui/SpriteStage.tsx": "afd6978f5f2ba1a006924f31a234d874d4ddb489f91eb26c825ae0423e727f48",
};

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
  });

  it("keeps the original PR #81 sprite scale: 1× phone, 2× desktop, no 3×/overlay/fallback", () => {
    const css = src("styles.css");
    assert.match(css, /\.sprite-world \{\s*width: 320px;\s*height: 320px;/);
    assert.match(
      css,
      /@media \(min-width: 860px\) \{\s*\.sprite-world \{\s*width: 640px;\s*height: 640px;/,
    );
    assert.equal(css.includes("960px"), false);
    assert.equal(css.includes("1120px"), false);
    assert.equal(css.includes("1119px"), false);
    assert.equal(css.includes("min-width: 1100px"), false);
    assert.equal(css.includes(":has(.sprite-world-wrap)"), false);
    assert.equal(css.includes("max-height: 100dvh"), false);
  });

  it("keeps Iron & Amber chrome and the hold pad, without a player-facing candidate banner", () => {
    const app = src("ui/ArcadeApp.tsx");
    const css = src("styles.css");
    const edition = src("sprites/edition.ts");
    assert.match(app, /Step onto the platform/);
    assert.match(app, /hold-pad/);
    assert.match(app, /LIFT_CARD\[id\]\.light/);
    assert.match(app, /LIFT_CARD\[id\]\.max/);
    assert.equal(app.includes("edition-banner"), false);
    assert.equal(app.includes("data-edition-banner"), false);
    assert.match(edition, /BANNER:/);
    assert.match(edition, /PREVIEW_BUILD: "original-sprite-restore-20260918"/);
    assert.match(css, /--color-amber: #d4892a/);
    assert.match(css, /--font-display: "Barlow Condensed"/);
    assert.match(css, /\.edition-banner \{[\s\S]*?display: none/);
  });

  it("keeps protected mechanics, stage, frames, and sprite sources byte-identical to PR #81", () => {
    for (const [rel, expected] of Object.entries(PROTECTED_SHA256)) {
      assert.equal(sha256(bytes(rel)), expected, rel);
    }
    const spriteDirs = ["public/sprites", "arcade/public/sprites"].filter((d) => existsSync(d));
    assert.ok(spriteDirs.length > 0, "sprite directory");
    const pngs = spriteDirs.flatMap(listPngs);
    assert.equal(pngs.length, 69);
  });
});
