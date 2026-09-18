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
**REVIEW** until an owner edits the documents. This branch must not retire that
flag by rewriting GDD or the Iron & Amber reference.

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
Desktop capture is 1280×800. Analyzer `desktopGutterReviewFraction` is 0.45.
That threshold is **not** edited in this branch.

| CSS scale | Canvas CSS | Gutter `1 - w/1280` | Visible source y in 800px (flex-end) |
|---|---|---|---|
| 2× | 640 | **0.50** (REVIEW) | 0–320, no clip |
| 3× | 960 | **0.25** | 53–320 (~53 px ceiling clipped) |
| 4× | 1280 | 0 | 120–320 (lockout / success heads lost) |

2× cannot satisfy 0.45 without stretching or a non-integer scale. 4× fills the
viewport width but clips ~120 source pixels — squat lockout `minY≈60`,
deadlift lockout `minY=31`, success `minY=2`. PR #85 used **3× at ≥1100px**
and accepted the ceiling clip as the trade against the gutter line.

This slice **falls back to 2× when height < 960** so the complete cell stays
on screen. The 0.50 gutter at 1280×800 is therefore a standing REVIEW, not a
threshold edit. Stretching the 320 cell to 1280×800 would be a non-uniform
scale and is still rejected.

## Desktop scale fallback (this slice — not a document ruling)

Status: **presentation CSS only.** This does not edit GDD, the Iron & Amber
reference, analyzer thresholds, or feel.

PR #85 used 3× at `≥1100px` regardless of height. At 1280×800 the 960 CSS
cell is taller than the viewport, so overflow-hidden overlay clipped ~53
source px of ceiling — enough to take bar/head off deadlift lockout.

This slice:

| Viewport | Scale | Canvas CSS | Gutter `1 - w/W` | Clip |
|---|---|---|---|---|
| 390×844 | 1× | 320 | n/a (phone) | none |
| 1280×800 | **2×** | 640 | **0.50** (REVIEW vs 0.45) | none |
| 1440×900 | **2×** | 640 | 0.556 | none |
| 1280×1000 | **3×** | 960 | 0.25 | none (960 ≤ 1000) |

3× is gated on `min-width: 1100px` **and** `min-height: 960px` so the complete
320×320 cell fits. 2× is the fallback when 3× would crop. No non-integer
scale, no stretch, no smoothing, no analyzer-threshold edit.

The wider gutter at 1280×800 is an honest **REVIEW** tradeoff against clipping
the lift. Independent QA may later accept 2× gutters, raise the 0.45 line, or
choose a taller capture — this branch does none of those.

HUD/hold-pad stack below the stage so they cannot cover feet. Vertical scroll
is allowed when chrome does not fit; horizontal overflow is not.

## Title vs PR #69

PR #69 is the sprite/shell ancestry (`BASE_SHA`), not the copy lock. Phone
title treatment is Iron & Amber `title.png` / `title-wide.png`, Barlow
Condensed, career-mode lede (“Brace, grind, lockout”). The player-facing
candidate banner is gone so the 390×844 title uses the full viewport. The
illustrated letterboxed title is not used. Pixel delta versus a PR #69
screenshot that still said “Timing is the sport” is expected and is not a
reason to retune the title toward that old copy.

## Non-goals of this branch

No changes to `feel.ts`, `lift.ts`, `liftTuning.ts`, hold-pad controller,
frame maps, or sprite sheets.
