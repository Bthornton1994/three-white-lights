# Iron & Amber owned art — provenance

**Status:** Session B original assets for the C1b home/play floor
**Slice:** `grok/session-b-iron-amber-art-01` (art-02 on the same PR)
**Ownership:** generated in this workspace with Imagine (`imagine_text_to_image` / `imagine_image_to_image`). Hot-pink generation keys were flood-filled to alpha locally with Pillow. Member tokens were cropped to an opaque bounding box and feet-anchored on a square canvas. Not scraped, not hotlinked, not copied from another game.

## Loading path

Files live in `public/empire-art/*.png`. Expo web serves them at `/empire-art/<stem>.png`. `src/empire/ironAmberArt.ts` maps gameplay keys onto those URIs.

**Play composition (GymScreen):** `gymscreen-facility-scene` → live occupancy/interactions (`FloorGrid` play overlay: occupancy cards + live member/furniture sprites from sim state) → HUD/dock. Atmosphere PNGs are empty rooms — no baked lifters. FloorGrid does not paint the room.

**Build:** same atmosphere, with FloorGrid's orthographic `floor-plane`, placement grid, HD furniture/session sprites, and tray as the interaction layer.

The import fence is unchanged: FloorGrid still cannot `require()` a PNG.

## Files

| File | Role | Source |
| --- | --- | --- |
| `floor-garage.png` | Garage atmosphere, empty of lifters | image-to-image from the approved Iron & Amber mockup, people removed |
| `floor-storage-unit.png` | Storage-unit atmosphere | owned variant, people removed |
| `floor-strip-mall-unit.png` | Strip-mall atmosphere | owned variant, people removed |
| `floor-warehouse.png` | Warehouse atmosphere | owned variant, people removed |
| `floor-plane.png` | Build-only orthographic rubber floor inside the placement grid | top-down Imagine, so cells and footprints share one rectangle |
| `eq-flat-bench.png` | Opening bench | text-to-image, pink-keyed to alpha |
| `eq-quality-bench.png` | Quality-upgraded bench | text-to-image, keyed to alpha |
| `eq-power-bar.png` | Power bar / rack | text-to-image, pink-keyed to alpha |
| `eq-comp-plates.png` | Bumper plates | text-to-image, keyed to alpha |
| `eq-plate-tree.png` | Throughput plate tree | text-to-image, pink-keyed to alpha |
| `session-*.png` | Session-equipment chips (Build tray + placed) | text-to-image, keyed to alpha |
| `member-*-right/left.png` | Member types (live sim tokens) | text-to-image + flip |
| `member-walk-a/b-*.png` | Two-frame walk | text-to-image + image-to-image + flip |
| `member-using-bench-a/b-*.png` | Two-frame bench press | text-to-image + image-to-image + flip |
| `member-using-bar-a/b-*.png` | Two-frame bar work | text-to-image + image-to-image + flip |
| `member-motion-powerlifter-<clip>.png` (walk, idle, wait, walk-to-wait, wait-to-walk, bench-setup, bench-mount, bench-press, bench-dismount, bench-finish) | VL-3 production motion strips: one 256 px frame per authored pose, side by side, feet at the bottom centre, authored facing right | derived from `member-walk-a-right.png` and `member-using-bench-a-right.png` by `tools/bake-member-motion.mjs` — a cut-out puppet (`src/empire/memberPuppet.ts`) posed by `src/empire/memberRig.ts`; the bench painting's tank quantile-matched onto the walker's tee at bake time (art round 2); no new generated pixels |

## Screenshot evidence (architectural proof, not Visual PASS)

Captured from the running Gym Empire at 390×844 and 375×812. Copies live in `docs/design/iron-amber-art-01/`.

| Shot | What it shows |
| --- | --- |
| `390x844-play.png` / `375x812-play.png` | Empty-room garage atmosphere. Live occupancy cards. Live member tokens from sim. Compact HUD, BUILD FAB, dock. No placement grid. Clock parent opacity 0. |
| `390x844-build.png` / `375x812-build.png` | Same atmosphere + orthographic floor-plane filling the grid + 7×5 grid + HD furniture/session sprites + tray. No occupancy. No FAB. |
| `*-build-place.png` | Placement interaction: grid cells sit on the floor-plane rectangle. |

## Residuals (not Visual PASS)

- Some rung atmospheres still include architectural equipment (racks, benches) that can double-draw against live furniture sprites.
- Live member tokens are 28px-tile footprints on a full-bleed painting, so they read as tokens, not as illustrated characters in the room.
- Session-sauna still includes a posed figure as product art.
- Occupancy overlay sits on the bottom of the floor and can cover tokens there.
- TRAIN remains Session A `shell-leave-gym`.
