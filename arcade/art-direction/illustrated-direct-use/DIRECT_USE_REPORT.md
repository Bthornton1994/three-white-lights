# DIRECT_USE_REPORT — Iron & Amber Illustrated Arcade

**Draft PR:** https://github.com/Bthornton1994/three-white-lights/pull/73
**Labels:** `ILLUSTRATED_DIRECT_USE`, `DO_NOT_MERGE`
**Branch:** `cursor/illustrated-direct-use-8271`
**Fable SoT (CoS):** `e9916eef091bd4ccce915e536902b8e739059e92` (PR #71)
**This tip:** `d6e09030b13e0b83596604022c9f9bd7898f4bd2`
**feel.ts SHA256:** `b26c21b520d17a8e87e6abac17661fc219870a2320a376b5b1b1adfe0bc2425c` (identical to SoT)

## What this is

Owner-authorized **docs-first decision + isolated four-screen proof**. Direct display of existing Fable concept stills. Not a GDD rewrite. Not a merge. Not production-ready.

## Alignment

- **Aligns with constraints:** VISION weight/readability; GDD §2.3 arcade loop; no fatigue bar; gameplay untouched.
- **Conflicts (recorded, not silently patched):** GDD §7.1 16-bit SNES/Genesis remains the production sprite bar. This edition is a separately named overlay. Independent QA compares against PR #71 stills, not PR #72.
- **Silent:** using Fable concept stills as full-screen backdrops rather than artist-only direction.

`VISION.md` / `docs/GDD.md` were not edited.

## Proof screens (inspected in-browser at 390×844 and 1280×800)

| Screen | Fable file | Result |
| --- | --- | --- |
| Title | `AI-REF-05` | Wired. Desktop reads as the SoT title still. Phone cover-crop wrecks the lockup (`ITE LIG`). Hallucinated PRESS START remains in the bitmap. LIMITED chip added. |
| Lift select | squat `AI-REF-04`, bench `AI-REF-02`, deadlift `AI-REF-03` | Wired. Distinct stills. No dedicated select cards. LIMITED chips. |
| Results | backdrop `AI-REF-05` + `AI-REF-01` contain | **No dedicated card art.** Federation sheet is the existing `ResultsCard`. Share PNG unchanged. LIMITED chip. Desktop 800px clips Share/Another lift. |
| Timing (deadlift) | `AI-REF-03` diptych, contain + HUD | Wired. Not a frame sequence. Squat/bench stills are mapped but were not the designated capture. |

Attempts / walkout / judging / outcome still use the pre-existing PR #70 sprite package on this tip (mixed presentation; out of four-screen scope).

## Rights gate

**BLOCKED.** Provider entity, production usage, redistribution, and likeness review are UNKNOWN. Banner stamps and concept README were not removed. See `RIGHTS_PROVENANCE_CHECKLIST.md`.

## Checks actually performed

- Inventoried SoT files at `e9916eef`. Five `reference-ai` stills; no prior direct-use harness; templates/swatches/baseline not used as art.
- `git diff` vs SoT: `feel.ts`, `src/loop`, `src/math` empty. `npm test` 61/61 + sprite QA + illustrated hash check. `npm run build` ok.
- Playwright: four screens at 390×844 and 1280×800; title CTA click-through to lift select; console errors 0.
- Independent critic viewed the eight evidence PNGs vs AI-REF-01..05. GDD §12.3: no hit. Recommended token: LIMITED. Biggest gap: 390 title is not a fair display of AI-REF-05.

## What remains for Independent QA

- Live session without `?proof=` freeze: title → lift → attempts → walkout → timing taps → judging → card. Confirm scoring unchanged in play.
- Squat and bench timing stills (only deadlift was captured).
- `prefers-reduced-motion` camera hold. Feel values remain **untuned**.
- Rights/likeness sign-off on all five stills before any production classification.
- Do not compare this proof to PR #72 conversion output. Do not merge.

DIRECT_USE_VISUAL_LIMITED
