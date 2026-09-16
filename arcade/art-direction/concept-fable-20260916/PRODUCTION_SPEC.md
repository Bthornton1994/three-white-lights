# Production asset specification — future 320×320 hand-pixel package

**CONCEPT ONLY. DO_NOT_MERGE.** This is the exact contract a human pixel artist
delivers against and Independent QA audits against. Nothing here is built. The
live game keeps loading `arcade/public/sprites/` from PR #70 until an approved
package is integrated by Cursor in a separate, later change.

## 1. Canvas, grid, scaling

| Asset class | Authoring lattice | Export | Runtime read (measured) |
| --- | --- | --- | --- |
| Stage master | 160 × 160 | 320 × 320 RGBA PNG, nearest ×2 | 273 px (390×844) / 400 px (1280×800) |
| Lift card | 52 × 52 | 104 × 104 RGBA PNG, nearest ×2 | 104 px phone / 190 px desktop |
| Title portrait | 1008 × 1792 (draw at 504 × 896, ×2) | 1008 × 1792 RGBA PNG | cover, position center 42 % |
| Title wide | 1792 × 1008 (draw at 896 × 504, ×2) | 1792 × 1008 RGBA PNG | cover, center |
| Platform backdrop | 640 × 360, ×2 | 1280 × 720 RGBA PNG | cover |
| Model sheet page | free | PNG ≥ 960 wide + source | not loaded by the game |

Anchors (master px): ground line y 304; shadow rows 300–316; nothing below
row 318; standing head-top ≥ y 52; bar span x 26..294. See
`templates/master-320-lattice-guide.png`.

## 2. Palette

`palette/iron-amber-v2.json` (source of truth), `palette/iron-amber-v2.gpl`
(loads in Aseprite / LibreSprite / Pixelorama / GIMP / Krita),
`palette/iron-amber-v2-swatches.png`.

| Budget | Value |
| --- | --- |
| Colours per stage frame | ≤ 40 (runtime check allows 48; the tighter budget is the craft bar) |
| Colours per card | ≤ 16 |
| Colours per scene (title, platform) | ≤ 64 |
| Alpha | 0 or 255 only |
| Off-palette colours | 0 |
| Chroma key | none (no magenta) |

The palette is a *proposal*. If the artist needs a ramp step changed, they
change the JSON in the same delivery and say why; the validator reads the JSON.

## 3. Frame list

`production-frame-list.csv` — 94 rows: 88 stage masters + 6 cards, 20 sheets.
Columns: `sheet, lift, effort, frame, state, export_path, lattice_source,
ground_contact, key_beat`.

| Sheet | Frames | Notes |
| --- | --- | --- |
| `idle` | 4 | title / lift-select breathing loop |
| `squat`, `squat-max` | 6 + 6 | setup, descend, hole, drive/sticking, almost/grind, lockout |
| `bench`, `bench-max` | 6 + 6 | setup, lower, pause, press/sticking, almost/grind, lockout |
| `deadlift`, `deadlift-max` | 6 + 6 | setup, break, knee/sticking, mid, almost/grind, lockout |
| `success-{lift}`, `success-{lift}-max` | 6 × 4 | per lift, per effort |
| `miss-{lift}`, `miss-{lift}-max` | 6 × 4 | per lift, per effort |
| `cards/{lift}-{light,max}` | 6 | separately composed at 52 lattice |

Scenes (not in the CSV): `title.png`, `title-wide.png`, `platform.png`,
`model-sheet.png`. Remove the leftover `plates/` sheet (Imagine residue, 258
colours) at integration; plates are drawn into the frames.

**Integration note (Cursor, later, not the artist):** the runtime currently
loads one shared `success/` and one shared `miss/` sheet
(`arcade/src/sprites/sheets.ts`). Per-lift, per-effort outcome sheets require a
small table change in `sheets.ts` + `sheets.test.ts`. That is a presentation
change; judging, timing, scoring and `feel.ts` are not touched.

## 4. Delivery layout

```
package/
  lattice-160/<sheet>/frame-NN.png      160×160 originals (binary alpha)
  lattice-52/cards/<lift>-<effort>.png  52×52 originals
  sprites/                              exports laid out exactly like arcade/public/sprites/
    <sheet>/frame-NN.png                320×320
    cards/<lift>-<effort>.png           104×104
    title.png  title-wide.png  platform.png  model-sheet.png
  source/                               .aseprite / .ase / .ora / layered PSD, one file per sheet
  palette/iron-amber-v2.json            the palette actually used (may be revised from this proposal)
  PROVENANCE.md                         author, date, tools, original-work statement, no-likeness statement
  RIGHTS.md                             written commercial grant for Three White Lights / StageForge portfolio products
  frame-index.csv                       copy of production-frame-list.csv with any agreed changes
```

Frame files must have the ×2 lattice property: every 2 × 2 block of the export
is one colour. `tools/validate_package.py` checks it, which is how QA confirms
the export was not resampled or drawn at 320.

## 5. Acceptance checks the artist runs before handoff

```bash
cd arcade/art-direction/concept-fable-20260916
python3 tools/validate_package.py /path/to/package/sprites --json /tmp/report.json
python3 tools/preview_harness.py  /path/to/package/sprites /tmp/previews
```

`validate_package.py` covers hygiene only: existence, sizes, binary alpha,
palette compliance, colour budgets, lattice integrity, ground band, deadlift
setup ≠ lockout, light ≠ max, per-lift outcome sheets present. It exits 1 on
any problem. Passing it is **not** a craft verdict.

`preview_harness.py` writes each frame at 320 / 273 / 400 and each card at
104 / 190 plus a squint pass. The artist looks at those, not at the zoomed
editor canvas, before deciding a frame is done.

Human checks (artist, then owner, then Independent QA on the integrated SHA):

1. Identity anchors 1–8 (`MODEL_SHEET.md` §3) present in every frame and card.
2. Seven effort channels (`EFFORT_CONTRAST.md`) visible in every max frame.
3. Deadlift frame 6 reads as a lockout at 273 px with the caption hidden.
4. Bench reads as a bench at 273 px; the head reads as lying down.
5. Each card identifies its lift in one second at 104 px on a phone.
6. Title reads "Three White Lights" inside the safe zones on 390×844 and
   1280×800 and survives 1024×1366.
7. A/B against real 16-bit sports sprites per `PIXEL_RULES.md` §7.

## 6. What Cursor changes at integration (out of scope for the artist and for this PR)

- `sheets.ts`: per-lift outcome sheet paths; remove `plates/`.
- `styles.css`: integer card scaling on desktop (156 or 208); stage lifter
  `max-height` so the 1280×800 attempts screen stops clipping the top 52 px;
  optional integer stage scaling.
- `ArcadeApp.tsx`: title `<source media>` by aspect ratio if the wide safe
  zone is not honoured.
- `check_sprites.py`: adopt the tighter budgets from §2 if the owner agrees.

None of these touch judging, timing, scoring or `feel.ts`.

## 7. Scope estimate in art terms

88 stage frames at 160 lattice, 6 cards at 52, three scenes, one model sheet.
The three lift sheets (36 frames) and the six cards are the craft-critical
core; the 48 outcome frames are pose variants of six base poses and can be
built from the lift sheets' lockout / stall frames. A first review gate should
be: model sheet + squat light 6 + squat card light, validated and previewed,
before the remaining 80 frames are drawn.
