# Art method — integer-grid export (PR #69)

Production sprites are **not** drawn by `scripts/build_sprites.py`.

## Source masters (kept separate)

1. Imagine-drawn sheets live in `art-source/*.jpg`.
2. Each cell is chroma-keyed, cropped, then **padded** (no resample) to the
   next multiple of 320.
3. **NEAREST** down to a true **320×320** master (`art-source/masters-320/`).
   The factor is always an integer (1 or 2).
4. Masters are median-cut quantized (no dither) with **binary alpha**.

## Production export

`scripts/index_drawn_sprites.py`:

- Native 80×80 = **NEAREST** 320→80 (factor **4** only)
- Runtime 320×320 = **NEAREST** 80→320 (factor **4** only)
- Title/platform: pad so dimensions divide the native grid, then NEAREST

**No BOX, bilinear, bicubic, Lanczos, antialiasing, or fractional scales**
on the production path.

## Comparison-only

BOX 320→80 (then NEAREST 4×) is written under
`evidence/visual-after/nearest-vs-box/` and `native-80-box/`. It is not shipped
as `public/sprites/`.

## Browser

`.title-art`, `.stage-bg`, `.stage-lifter`, `.lift-card img` use
`image-rendering: pixelated` (`-moz-crisp-edges` first). Computed style in
Chromium is `pixelated`.

Pose tables, `feel.ts`, `visualEffort`, and gameplay were not touched.
