# Iron & Amber owned art — provenance

**Status:** Session B original assets for the C1b home/play floor
**Slice:** `grok/session-b-iron-amber-art-01`
**Ownership:** generated in this workspace with Imagine (`imagine_text_to_image` / `imagine_image_to_image`). Hot-pink generation keys were flood-filled to alpha locally with Pillow. Member tokens were cropped to an opaque bounding box and feet-anchored on a square canvas. Not scraped, not hotlinked, not copied from another game.

## Loading path

Files live in `public/empire-art/*.png`. Expo web serves them at `/empire-art/<stem>.png`. `src/empire/ironAmberArt.ts` maps gameplay keys onto those URIs.

**Play composition (GymScreen):** `gymscreen-facility-scene` → occupancy/interactions (`FloorGrid` play overlay) → HUD/dock. The atmosphere PNG is the gameplay-rendered scene. FloorGrid does not paint the garage.

**Build:** same atmosphere, with FloorGrid's placement grid, furniture sprites, and tray as the interaction layer.

The import fence is unchanged: FloorGrid still cannot `require()` a PNG.

## Files

| File | Role | Source |
| --- | --- | --- |
| `floor-garage.png` | Play/Build facility atmosphere | image-to-image from the approved Iron & Amber mockup, UI/people removed |
| `eq-flat-bench.png` | Opening bench (Build) | text-to-image, pink-keyed to alpha |
| `eq-quality-bench.png` | Quality-upgraded bench (Build) | text-to-image, keyed to alpha |
| `eq-power-bar.png` | Power bar / rack (Build) | text-to-image, pink-keyed to alpha |
| `eq-comp-plates.png` | Bumper plates (Build) | text-to-image, keyed to alpha |
| `eq-plate-tree.png` | Throughput plate tree (Build) | text-to-image, pink-keyed to alpha |
| `member-*-right/left.png` | Member types (Build tokens) | text-to-image + flip |
| `member-walk-a/b-*.png` | Two-frame walk (Build) | text-to-image + image-to-image + flip |
| `member-using-bench-a/b-*.png` | Two-frame bench press (Build) | text-to-image + image-to-image + flip |
| `member-using-bar-a/b-*.png` | Two-frame bar work (Build) | text-to-image + image-to-image + flip |

## Screenshot evidence (proves the architectural change, not Visual PASS)

Captured from the running Gym Empire at 390×844 and 375×812. Copies live in `docs/design/iron-amber-art-01/`.

| Shot | What it shows |
| --- | --- |
| `390x844-play.png` / `375x812-play.png` | Illustrated garage fills `gymscreen-stage`. Occupancy cards, compact HUD, BUILD FAB, GYM/BUILD/SHOP/STAFF/MORE dock. No placement grid. No furniture sprites. Clock/accelerated parent opacity 0. Caption 1×1. |
| `390x844-build.png` / `375x812-build.png` | Same atmosphere, plus 7×5 placement grid, HD bench/bar/plates, member tokens, inventory tray. No occupancy. No FAB. |

Facility art covers the stage (390×625 / 375×593). Play `floorgrid-fixed-sprite-flat-bench` is absent. TRAIN remains Session A `shell-leave-gym`.

## Residuals (not Visual PASS)

- Every ladder rung reuses the garage atmosphere.
- Session-equipment chips still draw Phase 4 pixel tables on Build when no owned HD file exists.
- Play hides member/furniture sprites, thought-bubble cues, diagnostics, clock, accelerated, and internal captions. Occupancy cards remain the player-facing floor read.
- Occupancy overlay still covers the top of the painted scene; cards themselves are compact HUD chrome, not painted into the garage.
- Grid and HD sprites on Build are not aligned to the painted floor marks.
- Unused leftover `FLOOR_BACKGROUND_COLOR` in FloorGrid.
- TRAIN remains Session A `shell-leave-gym`.
