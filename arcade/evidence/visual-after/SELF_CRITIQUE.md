# Visual self-critique — effort states + SNES sports bar

**Self-assessment: ISSUES_REMAIN.** This pass cannot self-certify MERGE_OK or a Slam Masters / Super Punch-Out A/B. Independent QA owns the bar.

Baseline for this repair is audited tip `dd57ae89` (PR #68). Work continues on PR #69 atop the #68/#66 stack. `src/feel.ts`, judging, timing windows, scoring, and share logic were not touched.

## Blind A/B (what a still image shows)

Compared side-by-side in `visual-after/light-vs-max.png` (top = opener/light, bottom = max):

| Lift | Light read | Max read | Distinct? |
|---|---|---|---|
| Squat hole | Upright, shallow, green/yellow stack, calm face | Deep, leaned, red stack, chalk / grind ticks | Yes — different body line, not a recolor |
| Bench pause | Bar high, elbows in, small plates | Bar crushed to chest, flared elbows, red stack | Yes |
| Deadlift setup | Higher hips, steeper back | Low hinge, almost horizontal back | Yes |
| Deadlift lockout | Stacked upright | Lean-back / hyperextension, red stack | Yes |

Three-lift silhouettes stay distinct (`three-lift-silhouettes.png`): squat = bar on back / depth; bench = supine + rack; deadlift = floor hinge. Deadlift frame 06 is still a lockout, not a setup rewind. Binary alpha and no magenta chroma are preserved.

Against a real SNES sports/fighting sheet (Slam Masters Haggar, Super Punch-Out Little Mac): ours is still authored-in-code. Faces, hands, and cloth folds do not match that craft density. The A/B on *effort* is now readable. The A/B on *16-bit sports craft* is still lost.

## Residual issues (do not treat as pass)

1. **Craft still pastiche.** Banded volumes and pec/quad marks are better than the mannequin tip, but not hand-pixelled SNES sports sprites. A critic can still fail the sports-game A/B on mass and costume.
2. **Max squat hole still packs tight at 80×80.** Depth and lean read; thighs can merge toward a wedge. Waist is there; Slam Masters clustering is not.
3. **Weight is posed, not timed.** Max sheets are a different pose table. Bar-speed curves still come from the untouched timing machine. Whether a max *animates* heavier in-hand is unverified.
4. **Title/platform** gained a crowd bank and a loaded bar. Still a brick wall and a taped platform, not a Genesis title.
5. **In-app attempts screen shows the opener (light) sheet.** Max only appears when weight / e1RM ≥ 0.96 (third attempt). A reviewer who only screenshots A1 will not see the grind line.

## Before / after paths

| Artifact | Before (`dd57ae89`) | After |
|---|---|---|
| Squat hole | `visual-before/sprites/squat/frame-03.png` | `visual-after/sprites/squat/frame-03.png` + `squat-max/frame-03.png` |
| Bench pause | `visual-before/sprites/bench/frame-03.png` | `visual-after/sprites/bench/frame-03.png` + `bench-max/frame-03.png` |
| Deadlift setup / lock | `visual-before/sprites/deadlift/frame-01.png` + `frame-06.png` | light + `deadlift-max/` counterparts |
| Effort trio | n/a (same six poses) | `visual-after/light-vs-max.png` |
| Column A/B | `visual-before/` sprites | `visual-after/before-after-light-max.png` |
| In-app 390×844 | `visual-before/app-*.png` | `visual-after/app-*.png` |
| Critique | this file | this file |

## Checks performed

- `scripts/check_sprites.py`: binary alpha, no chroma, ≤48 colors, light≠max, silhouette delta ≥ 900 px on frames 01/03/06.
- 52 unit tests. Deadlift 06 ≠ 01. `visualEffort(162, 180) === "light"`, `visualEffort(180, 180) === "max"`.
- No edits to `src/feel.ts`, `src/loop/machine.ts`, `src/loop/timing.ts`, `src/math/score.ts`, or `src/ui/share.ts`.
