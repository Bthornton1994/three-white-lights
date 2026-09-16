# Evidence — internal draw-then-index sprint

**Base tip:** `1151569c40c77485ab9e9299e5db0db022437a8a` (PR #69)  
**Pipeline:** draw-then-index (Pillow pixel clusters + ASCII identity tiles → nearest 2× 320 → palette index, binary alpha).  
**Forbidden workflows not used:** Imagine, geometric 80×4 `build_sprites.py`, AI-as-final sprites.  
**feel.ts / judging / timing / scoring:** untouched.

## Paths

| What | Path |
| --- | --- |
| Baseline from 1151569 (320 masters) | `arcade/evidence/internal-draw-index-1151569/baseline/source-320/` |
| Baseline crushed cards (320→104 nearest) | `arcade/evidence/internal-draw-index-1151569/baseline/cards-from-stage/` |
| After 320 heroes | `arcade/evidence/internal-draw-index-sprint/after/source-320/` |
| After authored 104 cards | `arcade/evidence/internal-draw-index-sprint/after/cards-104/` |
| After stage scales (~273 phone / ~400 desktop) | `arcade/evidence/internal-draw-index-sprint/after/stage-scale/` |
| Light vs max contact | `arcade/evidence/internal-draw-index-sprint/after/contact-light-vs-max.png` |
| Lift strips (hitch check) | `arcade/evidence/internal-draw-index-sprint/after/strip-*-light.png` |
| Before/after 320 | `arcade/evidence/internal-draw-index-sprint/before-after/*-320.png` |
| Before/after 104 cards | `arcade/evidence/internal-draw-index-sprint/before-after/*-card-104.png` |
| Model sheet | `arcade/art-source/internal-draw-index/model-sheet.png` |
| Palette | `arcade/art-source/internal-draw-index/palette.json` |
| Provenance | `arcade/art-source/internal-draw-index/PROVENANCE.md` |
| Title 390×844 approx | `arcade/evidence/internal-draw-index-sprint/after/title-390x844-cover-approx.png` |
| Title 1280×800 approx | `arcade/evidence/internal-draw-index-sprint/after/title-wide-1280x800-cover-approx.png` |

Browser captures of the running app:

| Viewport | Screen | Path |
| --- | --- | --- |
| 390×844 | Title | `after/browser/mobile-390x844-title.png` |
| 390×844 | Lift select (cards) | `after/browser/mobile-390x844-lift-select.png` |
| 390×844 | Lift select full | `after/browser/mobile-390x844-lift-select-full.png` |
| 390×844 | Squat attempts / stage | `after/browser/mobile-390x844-squat-attempts.png` |
| 1280×800 | Title | `after/browser/desktop-1280x800-title.png` |
| 1280×800 | Lift select | `after/browser/desktop-1280x800-lift-select.png` |

`arcade npm test`: 53/53 + `check_sprites.py` ok. `feel.ts` untouched.

## Corrections vs 1151569

- Deadlift frame-01 is a hinge; frame-06 is a standing lockout. Frames 05→06 are a small lock, not a setup rewind.
- Face/hair/beard come from one locked stamp set (Reed Hale, fictional).
- Bench is a 3/4 on a receding pad with near plate larger than far plate.
- Cards are authored 104 compositions, not downsampled 320 masters.
- No magenta chroma; binary alpha; sprite ≤48 colors.

## Honest craft ceiling

Bodies are still 2D cluster construction, not hand-tuned SNES sports pixels at Slam Masters / NBA Jam density. Independent QA owns the craft verdict. One sprint; do not weaken the bar.
