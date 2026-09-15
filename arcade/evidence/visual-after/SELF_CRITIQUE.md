# Visual self-critique — integer-grid 320 master production

**Self-assessment: ISSUES_REMAIN.** Not MERGE_OK. Independent QA owns the
SNES/Genesis sports A/B.

Parent of this integer-grid pass: `f987db66f4904eed0e0f617790d69fecb0254676`
(which still shipped 80 NEAREST-upsampled to 320). That upsample is what
smashed thighs / hands / plates. This commit ships the 320 master instead.

`feel.ts`, pose tables, judging, timing, scoring, and `visualEffort` (0.96)
were not touched. CSS already had `-moz-crisp-edges` + `pixelated`.

## Recommendation: 320 MASTER (production)

Same 320×320 master, two 80×80 exports (factor 4), plus the master itself:

| | 320 master | NEAREST 80 ×4 | BOX 80 ×4 |
|---|---|---|---|
| Clusters | Authored 320 pixels kept | Stair-step, 16× area loss | Averaged, new in-between colors |
| Silhouette | Readable athlete | Noisy / packed | Slightly fuller mush |
| Hands / bar / plates | Discs and fingers still count | Speckled 1:1 with 80 grid | Blended discs |
| 4× inspection | The picture | Chunkier SNES-like blocks of a worse picture | Muddy blocks of a worse picture |
| In-app 390 / desktop | Lift cards and walkout readable | Cards collapse to blobs | Same blobs, slightly softer |

**Ship the 320 master.** It is the only integer-grid path that preserves
authored clusters. Between the two 80 methods, NEAREST is less dishonest than
BOX (it does not invent colors), but **the 80 comparison does not make the
package look hand-pixelled.** Using that A/B to pick a winner at 80 hides the
real defect: 80 is the wrong native grid for this art.

Title/platform stay NEAREST integer-pad (factors 8 and 6). BOX title is
comparison-only.

Chromium computed `image-rendering: pixelated` on `.title-art`,
`.lift-card img`, `.stage-bg`, `.stage-lifter` at 390×844 and 1280×800.

## Residual defects

1. 320 masters are still indexed Imagine JPEGs, not a hand-authored SNES
   lattice. Palette is posterized; outlines are not 16-bit sports-clean.
2. Squat hole: thighs / shins / hands / bar / plates read at 320; packed and
   still “painted then indexed.”
3. Bench 3/4 is the weakest lift identity; chest / arm / bar read, but the
   bench furniture is noisy.
4. Deadlift hinge vs lockout stay distinct; lockout is blocky.
5. Title may retain a faint “POWER LIFTING” wordmark. HTML copy is the real
   title.
6. Identity drift on some idle/miss cells (beard/hairline).
7. Lift-select cards are 96×84. Even the 320 master is then CSS-downscaled;
   `pixelated` keeps chunks, but this is not a dedicated 80 UI icon.
8. Light vs max is a separate sheet, not a weight-of-the-bar read at card size.

## Checks

- `check_sprites.py` ok: binary alpha, no chroma, ≤48/≤64, light≠max,
  silhouette Δ ≥900 on 01/03/06, deadlift 06 ≠ 01.
- Palette report: 57 production files, 0 fails (`nearest-vs-box/PALETTE_ALPHA.md`).
- Arcade tests 52/52. Workspace `test:arcade` 45/45.
