# Visual self-critique — SNES sports craft + light/max sheets

**Verdict: ISSUES_REMAIN.** This pass cannot self-certify a SNES/Genesis sports A/B (GDD §7.1 / §12.2). It raises constructed volume, costume, and a real light-vs-max split. An independent critic still has to lose or win the blind A/B against Slam Masters / Super Punch-Out / NBA Jam. Agents cannot certify release.

## What changed

Authored a second 6-frame sheet per lift (`squat-max`, `bench-max`, `deadlift-max`). Opener-weight frames keep green/yellow stacks and a more upright line. Maximal frames use red stacks, deeper compression, strain faces, chalk, and a slight bar bend. Limbs are banded cylinders instead of radial clay. Waist, belt, knee sleeves, and neck are drawn as breaks so the hole / hinge / bench no longer melt into one sausage.

`src/feel.ts`, judging, the timing/streak machine, and share logic were not touched. Load pick is `visualEffort(weightKg, e1rmKg)` in `sheets.ts` (`VISUAL.MAX_LOAD_RATIO = 0.96`).

Baseline for this repair is the audited tip `dd57ae89` (PR #68), snapshotted in `visual-before/`.

## Before / after

| Artifact | Before (audited tip `dd57ae89`) | After |
|---|---|---|
| Squat hole | `visual-before/sprites/squat/frame-03.png` | `visual-after/sprites/squat/frame-03.png` |
| Squat hole max | same six poses | `visual-after/sprites/squat-max/frame-03.png` |
| Bench pause | `visual-before/sprites/bench/frame-03.png` | `visual-after/sprites/bench/frame-03.png` |
| Bench pause max | same six poses | `visual-after/sprites/bench-max/frame-03.png` |
| Deadlift setup | `visual-before/sprites/deadlift/frame-01.png` | `visual-after/sprites/deadlift/frame-01.png` |
| Deadlift setup max | same six poses | `visual-after/sprites/deadlift-max/frame-01.png` |
| Light vs max trio | n/a | `visual-after/light-vs-max.png` |
| Three-lift read | `visual-before/three-lift-silhouettes.png` | `visual-after/three-lift-silhouettes.png` |
| Title / platform | `visual-before/title.png` + `platform.png` | `visual-after/title.png` + `platform.png` |
| In-app 390×844 | `visual-before/app-*.png` | `visual-after/app-*.png` |

## Honest gaps vs the bar

- **Craft moved, but it is still authored-in-code, not a hand-pixelled sports sheet.** Faces, hands, and plate hubs are readable now. They are not Slam Masters costume density or Super Punch-Out flesh modeling. A blind A/B against a real 16-bit wrestler or boxer still likely loses on mass, cloth folds, and micro-acting.
- **Weight is posed, not timed.** Max sheets are a different pose table and plate stack. Bar-speed curves and hold lengths still come from the untouched timing machine. A maximal attempt *looks* heavier. Whether it *animates* heavier in a person's hands is unverified.
- **Compressed poses still fight 80×80.** The squat hole and deadlift hinge keep a waist now, but thighs remain simple volumes. Max squat is deeper and wider, not a new drawing language.
- **Title/platform gained a crowd bank and a loaded bar.** They are still a brick wall and a taped platform, not a Genesis title backdrop.
- **Lift silhouettes stay distinct.** Squat = bar on back / depth. Bench = supine + rack. Deadlift = floor hinge vs hip lockout. Deadlift frame 06 is still a lockout, not a setup rewind.

## Checks performed

- Binary alpha, zero magenta/purple chroma, ≤48 unique colors per frame (`scripts/check_sprites.py`).
- Light and max counterparts differ on frames 01 / 03 / 06 for every lift.
- Deadlift frame 06 ≠ frame 01.
- 52 unit tests, including `visualEffort(162, 180) === "light"` and `visualEffort(180, 180) === "max"`.
- No edits to `src/feel.ts`, `src/loop/machine.ts`, `src/loop/timing.ts`, or `src/ui/share.ts`.
