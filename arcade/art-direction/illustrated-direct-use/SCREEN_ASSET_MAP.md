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
| Title | `AI-REF-05` as the full-bleed still | **WIRED** | No portrait `title.png` (1008×1792) and no `title-wide.png` (1792×1008). One 1280×754 landscape still is used at both 390×844 and 1280×800 via `object-fit: cover` + camera. Phone crop is severe. Hallucinated poster copy remains in the bitmap. |
| Lift selection | `AI-REF-04` squat, `AI-REF-02` bench, `AI-REF-03` deadlift as one still per lift. Backdrop: `AI-REF-05`. | **WIRED / LIMITED** | No dedicated lift-select cards (no 52-lattice crops, no separate light/max pair files). Squat and deadlift stills are diptychs, not single-pose select cards. No Fable `platform.png`. |
| Results card | Backdrop `AI-REF-05`. Card portrait region: `AI-REF-01` displayed **contain** (whole sheet, not a masked head crop). | **LIMITED** | **No dedicated results-card illustration exists.** Federation sheet layout stays the existing `ResultsCard`. Share PNG is unchanged (no Fable composite). |
| One timing screen | Designated proof: **deadlift** using `AI-REF-03`. Camera pans setup → lockout with progress. Squat (`AI-REF-04`) and bench (`AI-REF-02`) stills are also wired so those lifts do not fall back to PR #70 sprites on the timing screen. | **WIRED / LIMITED** | No per-frame timing sheets. Squat diptych is light-vs-max, not a descent sequence. Bench is a single still (zoom only). |

## Not wired (and why)

| File / class | Why it is out |
| --- | --- |
| `templates/*.png` | Guides and labelled boxes. Concept README: not art. |
| `palette/iron-amber-v2-swatches.png` | Palette sheet, not a scene. |
| `baseline/desktop-1280x800-attempts-clip.png` | Screenshot of the old loop, not Fable concept art. |
| Any PR #72 sprite / lattice export | Wrong quality target. Not present on this tip. |
| New generated images | Forbidden. |

## Screens outside proof scope

Attempts, walkout, judging, success, failure, transition, and bomb still render
the pre-existing `arcade/public/sprites/` package from the PR #70 parent chain
that this tip already ships. That is mixed presentation, recorded as a gap.
