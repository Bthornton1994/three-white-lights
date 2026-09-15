# Visual self-critique — integer-grid NEAREST export

**Self-assessment: ISSUES_REMAIN.** Not MERGE_OK. Independent QA owns the
SNES/Genesis sports A/B.

Parent of this integer-grid pass: `28da52c090f46b70eda3ec1f64d1fb9549105b34`.
`feel.ts`, pose tables, judging, timing, scoring, and `visualEffort` (0.96)
were not touched. CSS only gained `-moz-crisp-edges` next to existing
`pixelated`.

## Recommendation: NEAREST (production)

Same 320×320 master, two 80×80 exports (factor 4):

| | NEAREST | BOX |
|---|---|---|
| Clusters | Harder, stair-step, keeps master palette pixels | Softer, averaged, new in-between colors |
| Silhouette | Slightly noisier edge | Slightly fuller mass |
| Hands / bar / plates | Speckled but 1:1 with the master | Blended discs |
| 4× inspection | Chunkier SNES-like blocks | Muddy blocks |
| In-app 390 / desktop | Same poses; difference is small at card size | Same |

**Ship NEAREST.** It is the only method that preserves authored pixels from the
320 master. BOX hides those clusters behind a fractional average — the opposite
of this pass. The comparison does **not** make the 80px package look
hand-pixelled.

The **320×320 master** is still the better picture. Runtime PNGs are 80
NEAREST-upscaled to 320 so the engine’s native grid is 80. That upsample cannot
invent clusters the 80 grid dropped.

## Residual defects

1. 80×80 is still a downsample of Imagine JPEG “pixel-style” art, not a
   hand-authored 80 lattice.
2. Squat hole: thighs/shins/hands/bar read, but packed and posterized.
3. Bench 3/4 is the weakest lift at 80; the 320 master is clearer.
4. Deadlift hinge vs lockout stay distinct; lockout still blocky.
5. Title may retain a faint wordmark. HTML copy is the real title.
6. Identity drift on some idle/miss cells (beard/hairline).
7. Using the 320 master at runtime would look better than 80×4. That is a
   separate packaging choice, not a reason to pick BOX.

## Checks

- `check_sprites.py` ok: binary alpha, no chroma, ≤48/≤64, light≠max,
  silhouette Δ ≥900 on 01/03/06, deadlift 06 ≠ 01.
- Chromium computed `image-rendering: pixelated` on title, lift-card, stage.
- Arcade tests 52/52. Workspace `test:arcade` 45/45.
