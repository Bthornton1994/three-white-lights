# Visual self-critique — Iron & Amber Arcade sprite pass

**Verdict: ISSUES_REMAIN.** This pass cannot self-certify a SNES/Genesis sports A/B (GDD §12.2 / §7.1). It removes the agreed defects (fringe, chroma, noisy title) and keeps lift-specific silhouettes. An independent critic confirmed the bar is still lost: heads/bodies remain simpler than Slam Masters / Street Fighter II sheets, and a maximal attempt still uses the same six poses as a light one.

## What changed

Replaced the 384px anti-aliased illustration package with authored 80×80 indexed sprites (4× nearest-neighbor). Title and platform are PNG scenes, not grainy JPEGs. `src/feel.ts` and judging were not touched.

## Before / after

| Artifact | Before (PR #66 `5ed7dba`) | After |
|---|---|---|
| Title scene | `visual-before/title.jpg` | `visual-after/title.png` |
| Platform | `visual-before/platform.jpg` | `visual-after/platform.png` |
| Success chroma | `visual-before/composites/sprites-success-frame-01-on-iron.png` | `visual-after/composites/success-01-on-iron.png` |
| Squat hole | `visual-before/sprites/squat/frame-03.png` | `visual-after/sprites/squat/frame-03.png` |
| Bench pause | `visual-before/sprites/bench/frame-03.png` | `visual-after/sprites/bench/frame-03.png` |
| Deadlift setup / lock | `visual-before/sprites/deadlift/frame-01.png` + `frame-06.png` | `visual-after/sprites/deadlift/frame-01.png` + `frame-06.png` |
| Three-lift read | lift-select cards on #66 tip | `visual-after/three-lift-silhouettes.png` |
| In-app title 390×844 | `visual-before/title-screen.png` | `visual-after/app-title.png` |
| In-app lift select | `visual-before/lift-select.png` | `visual-after/app-lift-select.png` |
| In-app squat / bench / deadlift | `visual-before/squat-success.png` | `app-attempts-squat.png`, `app-attempts-bench.png`, `app-attempts-deadlift.png` |

## Honest gaps vs the bar

- **Craft, not pastiche — but not Slam Masters / NBA Jam either.** Hard pixels and a 16–32 color ramp beat the old AA illustration. Faces, hands, and plate stacks are still blocky. A blind A/B against Saturday Night Slam Masters or Super Punch-Out still loses on mass and costume detail.
- **Weight is posed, not animated.** Hole / pause / lock frames read as the right lifts. They do not yet read as a *maximal* attempt versus a light one. That remains a human playtest + art pass.
- **Title is clean, not rich.** Film-grain spotlight and JPEG ringing are gone. The brick + dither wash + taped platform is readable at phone scale, but it is a simple stage, not a Genesis title backdrop.
- **One lifter, three lifts.** Distinct squat (bar on back, depth), bench (supine + rack), deadlift (floor hinge vs hip lockout). Idle / success / miss no longer spray magenta chalk.

## Checks performed

- Binary alpha, zero magenta/purple chroma, ≤48 unique colors per frame (`scripts/check_sprites.py`).
- Deadlift frame 06 ≠ frame 01.
- 44 unit tests, including PNG scene paths.
- No edits to Session B, StageForge, Loadout, or `src/feel.ts`.
