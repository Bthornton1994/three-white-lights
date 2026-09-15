# Art method — draw-then-index (PR #69)

Production sprites in `arcade/public/sprites/` are **not** drawn by
`scripts/build_sprites.py`. That script remains as unused geometric tooling.

## Source

1. Canonical identity is an Imagine pixel-art still of an original powerlifter
   (high-and-tight hair, black singlet, amber chest chevron, belt, knee sleeves,
   lifting shoes). Path: `identity.jpg`.
2. Each action is an Imagine sheet edit-chained from that identity against a
   layout guide (`2x3-layout-guide.png` / `2x2-layout-guide.png`):
   - squat / squat-max / bench / bench-max / deadlift / deadlift-max (`2×3`)
   - idle / success / miss (`2×2`)
   - plates (`2×3`)
   - title and platform as full scenes
3. Imagine writes JPEG. The field is hot-pink, not exact `#FF00FF`.

## Index / export

`scripts/index_drawn_sprites.py`:

1. chroma-key the pink/magenta JPEG field
2. split the grid
3. crop the subject
4. integer BOX snap, then nearest into **80×80**
5. median-cut quantize (no dither), binary alpha, strip leftover chroma
6. nearest-neighbor **4×** to the 320×320 runtime frames

Native 80×80 frames: `art-source/native-80/`.
Runtime frames keep the existing paths under `public/sprites/`.

Pose tables, `feel.ts`, `visualEffort`, and `arcade/src/` are untouched.
