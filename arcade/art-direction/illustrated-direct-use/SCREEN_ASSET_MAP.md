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
| Results card | Backdrop `AI-REF-05`. Card portrait region: `AI-REF-01` displayed **contain** (whole sheet, not a masked head crop). | **LIMITED** | **No dedicated results-card illustration exists.** Federation sheet layout stays the existing `ResultsCard`. Share PNG is unchanged (no Fable composite). |
| Timing | Designated original proof: **deadlift** `AI-REF-03`. **Bench timing** uses **only** `bench-revised-20260916.png`. Squat uses `AI-REF-04`. | **WIRED / LIMITED** | No per-frame timing sheets. `AI-REF-02` is not loaded on bench timing. |

## Not wired (and why)

| File / class | Why it is out |
| --- | --- |
| `templates/*.png` | Guides and labelled boxes. Concept README: not art. |
| `palette/iron-amber-v2-swatches.png` | Palette sheet, not a scene. |
| `baseline/desktop-1280x800-attempts-clip.png` | Screenshot of the old loop, not Fable concept art. |
| Any PR #72 sprite / lattice export | Wrong quality target. Not present on this tip. |
| New generated images | Forbidden. Owner-supplied bench revisions live under `illustrated-direct-use/assets/`, not in the Fable SoT folder. |
| `AI-REF-02` on bench select/timing | Superseded by `bench-revised-20260916.png`. Original file is preserved, not loaded on those two screens. |

## Screens outside proof scope

Attempts, walkout, judging, success, failure, transition, and bomb still render
the pre-existing `arcade/public/sprites/` package from the PR #70 parent chain
that this tip already ships. That is mixed presentation, recorded as a gap.
