# Gate 1 honesty report

**Branch:** `cursor/gate1-concept-to-production-sample-20260916-a382`
**Base / concept tip:** `e9916eef091bd4ccce915e536902b8e739059e92` (PR #71)
**Status:** sample integrated, KEEP DRAFT, DO_NOT_MERGE
**feel.ts:** untouched
**PRs not modified:** #69, #70, #71

## Files actually created (pixels exist)

| Deliverable | Path |
| --- | --- |
| Model sheet | `package/sprites/model-sheet.png`, `public/sprites/model-sheet.png` |
| Squat light 1–6 | `public/sprites/squat/frame-01.png` … `frame-06.png` (320×320) |
| Squat max 1–6 | `public/sprites/squat-max/` (hero is hole `frame-03`; all six authored as effort variants) |
| Deadlift setup | `public/sprites/deadlift/frame-01.png` |
| Deadlift lockout | `public/sprites/deadlift/frame-06.png` (also frames 02–05 so the sheet does not hitch to old blobs) |
| Squat lift card | `public/sprites/cards/squat-light.png`, `squat-max.png` (104×104 from 52 lattice) |
| Title treatment | `public/sprites/title.png` (1008×1792), `title-wide.png` (1792×1008) |
| Platform | `public/sprites/platform.png` (1280×720) |
| Idle | `public/sprites/idle/` |
| Squat outcomes | `success-squat`, `success-squat-max`, `miss-squat`, `miss-squat-max` |
| Lattice sources | `lattice-160/`, `lattice-52/` |
| Layered source | `source/*.ora`, `source/layers/` |
| Palette | `palette.json`, `iron-amber-v2.gpl` (Iron & Amber v2) |

## Files only specified / not Gate 1 redraws

- Bench stage sheets (`public/sprites/bench`, `bench-max`) — leftover from PR #70, still in the running app so bench stays playable
- Bench / deadlift lift-select cards other than squat — not redrawn
- Full 94-row production list (all max benches, all 48 outcome frames as original drawings)
- Human playtest of feel (`feel.ts` not touched)

## Tool-generated material

- Construction masks (oriented boxes, distance capsules) used as **volumes**, then posterized
- Plate disks (plates are round; 3-tone lighting, not a body primitive)
- Brick / wood scene fills for title and platform
- OpenRaster zip packaging
- CSS integer nearest-neighbour sizes (320 stage; cards 104 inside a 162×104
  phone box, 208 desktop — 208 is 2× integer instead of non-integer ~190)

## Manually refined pixel material

- Reed Hale face stamps (16×20) and card heads (12×12), expression set
- Kit stamps: chevron, belt, wraps, shoes, hands
- Z-order (far limbs → singlet → near limbs → bar → head)
- Silhouette rim (lit AMB2/SKIN4, shadow SKIN0 — hair kept)
- Light plate stack (red outer + blue inner) vs max (4-red)
- Arm thickness split (thinner on deadlift)
- Title rear hair wedge so the back-view reads on brick
- Deadlift setup/lockout keypoints + traps no longer stretch to the bar
- Per-frame inspection of squat strip, hole, setup/lockout, cards, title

## Known limitations (craft self-assessment)

This sample is **better than the octagon/sticker PR #70 package** on squat readability
(bar on back, depth, light vs max plate load, deadlift bar height). It still
**fails a Slam Masters / NBA Jam / Punch-Out sports-sprite A/B**:

- Faces at 273/320 still read as a dark beard mass with two eye pixels, not one
  locked portrait
- Limbs remain capsule-derived; deadlift near-arm still fights the singlet
- Deadlift lockout is standing with the bar at mid-thigh (setup ≠ lockout,
  plates on the floor at setup) but knees are not a fully locked powerlifting
  finish and the singlet still reads as a chest-box
- Title Reed-from-behind is a kit silhouette, not a fully drawn back
- Cards identify squat (bar on traps, cropped plates) but the 52 head is marginal
- Phone card *box* is 162×104 with 104px integer art inside; desktop uses 208
  (2× integer) instead of non-integer ~190
- Bench was not redrawn; mixed art languages if you leave lift-select
- Integer 320 stage / 208 desktop cards fix smear; whether that *feels* right is playtest

**Self-verdict for Independent QA:** `ISSUES_REMAIN` on visual_craft_snes_genesis.
If QA fails craft → `INTERNAL_PIPELINE_CEILING_FINAL` and stop. No second automated
art pass from this agent.

## Capability note

LibreSprite / Aseprite / Pixelorama / Krita GUIs were **not** installed in this
environment. Pixel refinement was done by inspecting exported PNGs and editing
stamps, keypoints, z-order, and rim rules, then re-exporting the 160 lattice.
That is equivalent raster authorship the agent can drive; it is **not** a
human pixel-artist session.

## In-app preview evidence

Harness: `author/capture_browser.mjs` (playwright-core + system Chrome).
Outputs: `arcade/evidence/gate1-production-sample/browser/`

| Viewport | Screens |
| --- | --- |
| 390×844 | title, lift-select, squat attempts (light + max), squat walkout, squat hole, deadlift setup, deadlift lockout, model-sheet |
| 1280×800 | same set |

Metrics (stage 320, cards 104 in a 162 box / 208 desktop) live in `METRICS.json`.
No `feel.ts` change. Walkout/timing durations are unchanged; the harness only waits.
