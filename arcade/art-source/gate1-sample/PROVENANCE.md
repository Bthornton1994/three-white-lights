# Provenance — Gate 1 production-art sample (2026-09-16)

**Athlete:** Reed Hale. Entirely fictional. Not a likeness of any real person,
licensed character, or borrowed sprite. Slam Masters / Punch-Out / NBA Jam were
quality-bar references only and were not copied, traced, or reproduced.

**Direction only:** `arcade/art-direction/concept-fable-20260916/` (Fable
concept, PR #71 tip `e9916eef`). Concept AI refs are stamped NOT PRODUCTION ART
and were not traced.

**Commercial grant:** Original pixel work in this folder and the exported
`arcade/public/sprites/` sample may be used in Three White Lights / StageForge
portfolio products.

## How the pixels were made

1. Author 160×160 (stage) and 52×52 (cards) lattices as named-palette pixels.
2. Face, hands, shoes, chevron, belt, wraps are explicit stamps (one character).
3. Body volumes are construction masks, then scanline-posterized into 3-tone
   planes. They are not the finished figure.
4. Each export is nearest-neighbour ×2 → 320 / 104, then inspected as a PNG
   and refined (z-order, rim, plate stacks, arm thickness, face contrast).
5. Title / platform authored at half-res (504×896, 896×504, 640×360) then ×2.

## Tools

- Python 3 + Pillow (pixel placement, nearest-neighbour scale, OpenRaster zip)
- PNG inspection of masters
- No `build_sprites.py`, no Imagine, no unedited AI image as final art,
  no 80×80 downscale pipeline

## Editable source

- `author/reed.py`, `author/pixel_engine.py` — the authored stamps and poses
- `lattice-160/`, `lattice-52/` — native PNGs
- `source/*.ora` — OpenRaster layer stacks (Krita / Pixelorama / GIMP)
- `source/layers/` — per-layer PNGs

## Author

Cursor cloud agent. One-time owner exception to INTERNAL_PIPELINE_CEILING.
Independent QA owns the SNES/Genesis craft call on the integrated SHA.
