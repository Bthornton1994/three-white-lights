# Iron & Amber asset provenance

The binding reference is `docs/design/iron-and-amber-reference.jpeg`, from PR44 at `c52444d407e9974209446ec1de7d127f1ce07a6a`; Git blob `80fcaaa9ee14711776ceeaf31ca12ae61242d1d4`. The direction is warm brick, dark iron, amber light, illustrated equipment, and readable athletic typography.

The six production cutouts below were made with the built-in image-generation tool for this integration and copied unchanged from its selected outputs. Their exact generation/edit prompts, original filenames, dimensions, and recorded SHA-256 hashes are in `docs/design/art-recovery-provenance.json`. Original PNGs are preserved in commit `d457b8150ae76633fe6f6b3bd0a9eaea823b4756` and subsequent release commits.

| Production asset | Dimensions | Git blob |
| --- | --- | --- |
| `web/public/empire-art/production-bench.png` | 1254×1254 | `3d2a0b404826fd7a111fe6cbb0be08e9279823c1` |
| `web/public/empire-art/production-bar.png` | 2062×763 | `5f8257f00e3e7328bde064489adebaa9c922f920` |
| `web/public/empire-art/production-plates.png` | 1254×1254 | `8d29c8ba1657beda0697f2b420eb1fea702c8f0b` |
| `web/public/athlete/squat-atlas.png` | 1536×1024 | `a6f98c0db001b58eab6ec1e898280538a1aeb4ca` |
| `web/public/athlete/bench-atlas.png` | 1536×1024 | `af0591f871d3acd4621fb32a7afb458ef9a3c3f5` |
| `web/public/athlete/deadlift-atlas.png` | 1536×1024 | `dd93ff9e3a32607332f25d6eda97c2ab49bf9057` |

Each athlete atlas has six row-major poses in equal cells. The live renderer uses these illustrated atlases, normal canvas crops and floor alignment, with smooth display sampling. The original PNGs are not transformed. This records source identity, not a fresh visual acceptance claim.

Other source assets:

- `web/public/rooms/gym-floor.png`: generated with the same built-in tool using the actual reference. Its open floor has no baked athlete, controls, or text; placed equipment is rendered live.
- Other `web/public/rooms/*.jpg`: existing project Iron & Amber training and meet assets from PR63 (`46ae42bb3d32319586bf99851d1f20cd171c1c60`). Source notes remain in `docs/design/IRON-AMBER-TRAINING-ASSETS.md`.
- Other `web/public/empire-art/*.png`: existing facility equipment and ambient member art from `3c55622b94a6ff5c977de8ff09c0977ecfa739a8`. Chroma-keyed legacy textures are decoded at display time.
- `web/public/sprites/*`: legacy arcade athlete poses from `30686d30464ba877b7236c59c49db766fe02ad19`, retained for source continuity. The production lift renderer uses the new illustrated atlases.
- `web/public/sound/*.wav`: existing project-synthesized meet audio from PR63.
- `web/public/fonts/BarlowCondensed-*.ttf`: Regular, Bold, and ExtraBold from the official `google/fonts` repository, with SIL Open Font License checked in as `OFL.txt`.
- Application icons: the three-light mark made for this browser build and Lucide interface icons; Lucide's ISC notice is retained with dependencies.

The missing original PNGs were restored from GitHub Actions artifact `11145618613`, built from commit `e57d7ffe35a3b1041303ea482c20435f92af0797`. Every archive entry matched its tracked Git blob before restoration. The byte verification is recorded in `.gauntlet/evidence/production/original-art-restoration.json`.

Fresh full-art review remains open. Earlier functional browser records retain their actual missing-art limitations. No bitmap-content, deployed-visual, physical-device, or haptics acceptance is implied.
