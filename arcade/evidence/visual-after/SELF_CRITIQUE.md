# Visual self-critique — draw-then-index pass on `79f2baa`

**Self-assessment: ISSUES_REMAIN.** This pass cannot self-certify MERGE_OK or a
Slam Masters / Super Punch-Out / NBA Jam A/B. Independent QA owns the bar.

Parent tip: `79f2baace7e811ecb1e8840aacb6a8a659fd6b6a`. `arcade/src/`, `feel.ts`,
pose tables, judging, timing, scoring, and `visualEffort` (0.96) were not touched.

## Art method

Imagine-drawn 16-bit sports sheets → chroma key → integer-index to 80×80 → 4×
nearest. Documented in `arcade/evidence/art-source/ART_METHOD.md`.
`build_sprites.py` did **not** produce this package.

## What a still image shows

High-res working sheets (`art-source/*.jpg`) read as pixel-art sports drawings:
squat walkout/hole/lockout, deadlift floor vs lockout, supine bench, light vs
max plate color and grind. Indexed 80×80 runtime frames keep those silhouettes
but smear cluster density.

| Shot | Read |
|---|---|
| Squat hole light | Bar on the back, heels down, split thighs |
| Squat hole max | Deeper, red stack, grimace |
| Bench pause | Supine on a pad, not a standing squat |
| Deadlift 01 vs 06 | Floor hinge vs standing lockout |
| Title | Spotlight hall + loaded lifter; a faint wordmark may remain |

## Residual issues (do not treat as pass)

1. **80×80 is a downsample, not a hand-pixel grid.** Imagine emits ~1k JPEG
   "pixel-style" drawings. Integer indexing cannot recover clusters that were
   never authored on an 80×80 lattice. Phone-size 4× frames look posterized.
2. **Identity drift.** Some idle/miss cells grow a beard or shift the hairline.
3. **Title wordmark.** Imagine kept painting "POWER LIFTING" into the scene
   after two removal edits. HTML copy is still the real title.
4. **Bench 3/4 remains the weakest lift** at 80×80 even though the working
   sheet is clearly supine.
5. **JPEG chroma.** The key is a pink field, not exact `#FF00FF`. Fringe is
   forced to binary alpha; some edge pixels are sacrificed.
6. **This workflow cannot honestly claim SNES sports craft at the runtime
   size.** The working sheets are the closest this stack gets. Independent QA
   should judge both the working JPEGs and the indexed 80×80 package.

## Checks

- `scripts/check_sprites.py`: binary alpha, no chroma, ≤48 colors, light≠max,
  silhouette delta ≥ 900 on frames 01/03/06, deadlift 06 ≠ 01.
- Pose tables and `visualEffort` unchanged.
