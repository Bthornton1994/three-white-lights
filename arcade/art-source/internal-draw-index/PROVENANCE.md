# Provenance — internal draw-then-index sprint (2026-09-16)

**Athlete:** Reed Hale. Entirely fictional. Not a likeness of any real person,
licensed character, or borrowed sprite. Slam Masters / Punch-Out / NBA Jam were
quality-bar references only and were not copied, traced, or reproduced.

**Commercial grant:** Original pixel work in this folder and the exported
`arcade/public/sprites/` package may be used in Three White Lights / StageForge
portfolio products.

## Pipeline (mandatory)

1. **Draw** — 2D pixel clusters on a 160×160 lattice: ASCII identity tiles
   (face / hair / beard / shoes / hands), scanline polygons, octagon cluster
   stamps. Poses are authored joint tables, not a 3D mesh pack.
2. **Inspect** — each hero frame viewed at 320 and at card scale; face stamps
   are applied *after* silhouette outline so hairline and beard cannot be eaten.
3. **Index** — nearest-color snap to the locked palette in `palette.json`,
   binary alpha, no magenta key. 160 nearest-neighbor 2× → 320 masters.
4. **Cards** — separate 52×52 compositions, 2× → 104. Not downsampled stage
   masters.

## Tools

- Python 3 + Pillow (pixel placement, nearest-neighbor scale, palette index)
- Image inspection of PNG masters
- No Imagine, no procedural mesh pack, no direct AI sprite-sheet generation,
  no Grok-generated pixels as finals

## Author

Cursor cloud agent, internal zero-budget sprint authorized 2026-09-16 by
Bryant Thornton. One bounded sprint. Independent QA owns the SNES/Genesis
craft call on the integrated SHA.
