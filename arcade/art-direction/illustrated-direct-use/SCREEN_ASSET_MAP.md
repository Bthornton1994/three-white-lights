# Screen ↔ existing Fable file map

**CONCEPT stills only. No new art. No lattice conversion.**

Inventoried at tip `e9916eef091bd4ccce915e536902b8e739059e92`. There is **no**
prior direct-use harness in this repository. Template PNGs, palette swatches,
and the baseline screenshot are **not** illustrated assets and are not wired.

## Existing illustrated files (usable)

All five live under
`arcade/art-direction/concept-fable-20260916/reference-ai/`.
Each is banner-stamped `AI-GENERATED CONCEPT REFERENCE · NOT PRODUCTION ART · DO NOT TRACE`.
Banners are left intact (no crop-out in the file).

| File | Px | SHA256 | What it actually is |
| --- | ---: | --- | --- |
| `AI-REF-01-MODEL-SHEET.png` | 1280×754 | `b484a534dfa54764245a006bb8e9ef8ce2a78077dd25773041bd6f8f8eb59ff9` | Model sheet: front / 3/4 / side / back + expression stack |
| `AI-REF-02-BENCH-THREE-QUARTER.png` | 1024×1058 | `0e4410b6dc472bd423bdb551cce7497978c062fb55e9148896c7bf8fabe923b7` | Single bench still, 3/4 camera. Hands/bar placement are known-wrong in the concept notes. |
| `AI-REF-03-DEADLIFT-SETUP-LOCKOUT-MAX.png` | 1280×754 | `b56e379f6c18b52f5a6e8da4f3bc0cd9781645477b446741ca1444ad505c16ba` | Two-panel deadlift: setup \| lockout (max) |
| `AI-REF-04-SQUAT-HOLE-LIGHT-VS-MAX.png` | 1280×754 | `bc6e03a8a83e5bfc77f2b4961c4f93f00342fc32e1b8dea1dcfa0be465ebc64a` | Two-panel squat hole: light \| max |
| `AI-REF-05-TITLE-SCREEN.png` | 1280×754 | `1bc09ab2231eb7a91fe7289cacfea23a5ac1a1dfc94402570806b614ff299d2f` | Landscape title still. Hallucinated "PRESS START" and "© 1994 IRONWROUGHT GAMES" live in the pixels. Runtime supplies real copy. |

## Proof wiring

| Screen | File(s) | Status | Honest gap |
| --- | --- | --- | --- |
| Title | `AI-REF-05` in an upper letterbox on phone (`object-fit: contain`); cover on desktop | **WIRED / LIMITED** | No portrait master. Phone uses contain so the “THREE WHITE LIGHTS” lockup stays readable. Hallucinated PRESS START remains in the bitmap. |
| Lift selection | squat `AI-REF-04`, **bench `bench-revised-20260916.png`**, deadlift `AI-REF-03`. Backdrop: `AI-REF-05`. | **WIRED / LIMITED** | Bench select loads **only** the owner-revised mid-press still. `AI-REF-02` is not loaded on this screen. No dedicated 52-lattice cards. |
| Results card | Backdrop `AI-REF-05`. Card portrait region: `AI-REF-01` displayed **contain** (whole sheet, not a masked head crop). Share PNG composites those same stills under the paper sheet. | **WIRED / LIMITED** | **No dedicated results-card illustration exists.** Federation numbers still come from `scoreMeet`. |
| Timing | Designated original proof: **deadlift** `AI-REF-03`. **Bench timing** uses **only** `bench-revised-20260916.png`. Squat uses `AI-REF-04`. | **WIRED / LIMITED** | No per-frame timing sheets. `AI-REF-02` is not loaded on bench timing. Camera pan/zoom only. |
| Attempts | Lift still: squat `AI-REF-04`, bench revised, deadlift `AI-REF-03` | **WIRED / LIMITED** | Reused lift still. Caption: not an attempt-board scene. **No PR #70 sprites.** |
| Walkout | Same lift still | **WIRED / LIMITED** | Reused still + Ken Burns. Not a walkout cycle. **No PR #70 sprites.** |
| Judging | Lift still at lockout camera | **WIRED / LIMITED** | Not a lockout cycle. **No PR #70 sprites.** |
| Success | Lift still at lockout camera + warm lighting | **WIRED / LIMITED** | Not a celebration loop. **No PR #70 sprites.** |
| Failure | Lift still at mid-lift camera + cooler vignette | **WIRED / LIMITED** | Not a miss cycle. **No PR #70 sprites.** |
| Transition | Lift still at setup camera | **WIRED / LIMITED** | Not a plate-change scene. **No PR #70 sprites.** |
| Bomb | Title hall `AI-REF-05` reused | **WIRED / LIMITED** | No dedicated bomb art. Caption says so. **No PR #70 sprites.** |

## Not wired (and why)

| File / class | Why it is out |
| --- | --- |
| `templates/*.png` | Guides and labelled boxes. Concept README: not art. |
| `palette/iron-amber-v2-swatches.png` | Palette sheet, not a scene. |
| `baseline/desktop-1280x800-attempts-clip.png` | Screenshot of the old loop, not Fable concept art. |
| Any PR #72 sprite / lattice export | Wrong quality target. Not present on this tip. |
| New generated images | Forbidden. Owner-supplied bench revisions live under `illustrated-direct-use/assets/`, not in the Fable SoT folder. |
| `AI-REF-02` on bench select/timing/attempts/walkout | Superseded by `bench-revised-20260916.png`. Original file is preserved, not loaded on those screens. |
| `arcade/public/sprites/` on illustrated screens | Silent fallback **removed**. Sprite files remain on disk for hash tests only and are not requested by ArcadeApp. |

## Screens outside four-screen proof — now wired as still reuse

Attempts, walkout, judging, success, failure, transition, and bomb **reuse approved stills** with an `illustrated-still` caption. They are not animation. Independent QA should not treat camera pan as a frame sequence.

