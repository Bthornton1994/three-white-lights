# Sprite-stage contract — owner ruling requested

Status: **proposed, not adopted.** This file does not change GDD, the Iron & Amber
reference, feel, scoring, or runtime. It records a standing document conflict
and a proposed resolution for owner review.

## The conflict (do not silently pick a side)

Three texts currently disagree about the primary art direction:

| Source | Claim |
|---|---|
| Iron & Amber reference (PR #44 / Session A) | Pixel sprites are legacy debt. Do not report a visual pass while the legacy sprite experience remains the primary surface. |
| GDD §7.1 | Base style is 16-bit SNES / Genesis-era sprites. |
| Product brief (this commercial pass) | Career-mode sprite athlete, existing frames, inside the Iron & Amber shell. Not the illustrated stills, DEPTH rail, or two-tap timing demo. |

The development analyzer (`document-contract-conflict`) is required to stay
**REVIEW** until an owner edits the documents. Tooling must not retire that
flag by rewriting GDD or the Iron & Amber reference in this branch.

## Proposed owner ruling (not applied)

For the commercial Three White Lights product now on the sprite stage:

1. **Playable surface:** existing sprite frames + Iron & Amber chrome, grounded
   on `platform.png`, Session A squat / bench / deadlift mechanics unchanged.
2. **Rejected surfaces:** illustrated stills (PRs #75/#76), DEPTH gauge,
   two-tap timing lane, generated replacement art.
3. **Documents:** leave GDD §7.1 and the Iron & Amber reference byte-identical
   until the owner publishes a reconciled art-direction paragraph. After that
   ruling, `IRON_AMBER_DOC_ABSENT_AT_TARGET` and `DOCUMENT_CONTRACT_CONFLICT`
   can be retired by an explicit document commit — not by analyzer edits.

## Desktop gutter math (why 3×, not a threshold change)

The authored sprite cell is 320×320. Analyzer integer scales are 1, 2, 3, 4.
Desktop capture is 1280×800.

| CSS scale | Canvas CSS | Gutter `1 - w/1280` | Fits 800px height without clip? |
|---|---|---|---|
| 2× | 640 | **0.50** (above the 0.45 REVIEW line) | Yes |
| 3× | 960 | **0.25** | No — 160px of the square is clipped at the top if chrome overlays |
| 4× | 1280 | 0 | No — 480px clipped; lockout/success heads lost |

2× cannot satisfy `desktopGutterReviewFraction: 0.45` without stretching or a
non-integer scale. This branch uses **3× at ≥1100px**, overlaying HUD/hold-pad
on the stage so the gym uses the viewport width, and clips ~53 source pixels
from the top of the cell (ceiling), keeping contact at the bottom. The 0.45
threshold is not edited.

## Title vs PR #69

PR #69 is the sprite/shell ancestry (`BASE_SHA`), not the copy lock. Phone title
drift against that screenshot is expected if the candidate banner is gone and
the lede says brace / grind / lockout (career-mode) instead of “Timing is the
sport.” Iron & Amber tokens, Barlow Condensed, and `title.png` remain.

## Non-goals of this branch

No changes to `feel.ts`, `lift.ts`, `liftTuning.ts`, hold-pad controller, frame
maps, or sprite sheets.
