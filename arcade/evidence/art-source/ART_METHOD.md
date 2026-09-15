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

- **Production `public/sprites` = the 320×320 master** (integer-grid, binary
  alpha, ≤48 colors). The engine already loads 320×320 PNGs.
- Native 80×80 = **NEAREST** 320→80 (factor **4** only) — evidence only
- BOX 320→80 (then NEAREST 4×) — comparison only, never shipped
- Title/platform: pad so dimensions divide the native grid, then NEAREST
  (title pad 1280×1792 → 160×224 factor 8; platform 1920×1080 → 320×180 factor 6)

**No BOX, bilinear, bicubic, Lanczos, antialiasing, or fractional scales**
on the production path.

Shipping the 80-grid upsample as the runtime PNG throws away authored
clusters. Stage CSS size is `min(78vw, 420px)` with `image-rendering:
pixelated`, so the 320 master is near-native on phone and a small integer-ish
upscale on desktop.

## Comparison-only

BOX 320→80 and NEAREST 80 live under
`evidence/visual-after/nearest-vs-box/` and `native-80-box/`.
`art-source/native-80/` is the NEAREST 80 evidence grid.
`art-source/masters-320/` is the source of production.

## Browser

`.title-art`, `.stage-bg`, `.stage-lifter`, `.lift-card img` use
`image-rendering: pixelated` (`-moz-crisp-edges` first). Computed style in
Chromium is `pixelated` on title, lift-card, stage background, and lifter.

Pose tables, `feel.ts`, `visualEffort` (0.96), and gameplay were not touched.
