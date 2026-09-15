# Visual self-critique — SNES sports craft pass on `633e5930`

**Self-assessment: ISSUES_REMAIN.** This pass cannot self-certify MERGE_OK or a Slam Masters / Super Punch-Out / NBA Jam A/B. Independent QA owns the bar and must judge the exact SHA this file ships with.

Parent tip: `633e5930a057153f2ffc1b334cb62d0c63b623c4` (PR #69). `src/feel.ts`, judging, timing windows, scoring, effort-state mapping (`visualEffort` / `MAX_LOAD_RATIO 0.96`), and share logic were not touched. Pose tables (`SQUAT_*`, `DEAD_*`, `BENCH_*`) are unchanged.

## What this pass changed (craft only)

Authored 80×80 → 4× nearest package, same frame paths and counts.

- Face stamps are the face (no blended oval underneath). High-and-tight fade, heavy brow shelf, boxer's nose, stubble, ear, strain teeth.
- Fists wrap the bar with a thumb over the far side and a knuckle row. Open hands show three fingers.
- Trap shelf so a squat bar sits in the meat: bar drawn, then lower trap wrapping under it.
- Lifting shoes with a raised heel wedge, strap, and contact shadow.
- Black singlet, thicker straps, amber side piping, chest chevron (original mark — not a licensed logo).
- Crotch split on the squat hole so thighs do not fuse into a wedge. Shins more vertical. Calf diamond + quad bulge.
- Deadlift lockout adds lat flare. Bench torso is a chest volume, not a flat rectangle.
- Draw order: far limb → torso → bar → trap wrap → fists → neck/head.
- Title: three white judge lights, spotlight, crowd bank, standing loaded max squat on the taped platform, plate tree, side light table.

Light vs max pose tables are the same as `633e5930`. Silhouette QA still requires ≥900 px delta on frames 01/03/06.

## Blind A/B (what a still image shows)

Compared in `visual-after/before-after-craft.png` (left = `633e5930`, right = this pass) and `light-vs-max.png` (top = opener, bottom = max):

| Shot | Read |
|---|---|
| Squat hole light | Bar on the back, heels down, amber knee sleeves, chevron |
| Squat hole max | Deeper, leaned, red stack, chalk, grimace — still a different body line |
| Bench pause light vs max | High bar / crushed chest + flared elbows |
| Deadlift setup vs lockout | Floor hinge vs standing lockout (frame 06 ≠ 01) |
| Title | Three white lights + loaded lifter on taped wood, not an empty brick hall |

Lift identities stay distinct (`three-lift-silhouettes.png`): squat = bar on back; bench = supine + rack; deadlift = floor hinge. Binary alpha and no magenta chroma are preserved.

Against a real SNES sports/fighting sheet (Slam Masters Haggar, Super Punch-Out Little Mac, NBA Jam): this is still **authored-in-code**. Pixel clusters are denser than the mannequin tip, but they are not a hand-pixelled sports sprite. A critic can still fail the craft A/B on mass, cloth, and face density.

## Residual issues (do not treat as pass)

1. **Craft still procedural.** Chevrons, fists, brow shelves, and trap wrap help identity; they do not equal a scanned SNES sheet.
2. **Max squat hole still packs tight at 80×80.** Depth, lean, and crotch split read; thighs can still crowd. The split is a patch, not Slam Masters clustering.
3. **Weight is posed, not timed.** Max sheets remain a different pose table. Bar-speed still comes from the untouched timing machine.
4. **Title is a better stage, not a Genesis title card.** Spotlight + hero + three white lights. No baked wordmark (copy stays HTML). Crowd is still stamp figures. A still of the loaded squat can read heavy/wide rather than fully locked standing.
5. **In-app attempts screen shows the opener (light) sheet.** Max only appears when weight / e1RM ≥ 0.96 (third attempt). Unchanged mapping.
6. **Hair silhouette is still a tight cap** at 16×12. Fade and brow help; it is not Little Mac hair density.
7. **Bench from 3/4 remains the hardest read.** Chest volume and arch help; the supine body is still a short oval on a pad.

## Before / after paths

| Artifact | Before (`633e5930`) | After |
|---|---|---|
| Squat / bench / deadlift frames | `visual-after/before-633e5930/` | `public/sprites/{lift,lift-max}/` |
| Column A/B | `before-after-craft.png` | left old / right new |
| Title + lockout A/B | `before-after-title-lockout.png` | left old / right new |
| Effort trio | `light-vs-max.png` | opener vs grind |
| In-app 390×844 | recaptured `app-*.png` after smoke | this pass |

## Why this does not meet the sports-game craft bar (self)

Slam Masters / Super Punch-Out / NBA Jam sprites were hand-clustered: cloth folds, face planes, and weight reads are painted pixel-by-pixel. This package is a constructed original lifter with a consistent silhouette language, cleaned chroma, and distinct light/max poses — closer than the mannequin tip, still authored-in-code. Independent QA must make the A/B call on the exact SHA.

## Checks performed

- `scripts/check_sprites.py`: binary alpha, no chroma, ≤48 colors/sprite, ≤64 title/platform, light≠max, silhouette delta ≥ 900 px on frames 01/03/06, deadlift 06 ≠ 01.
- 52 arcade unit tests. `visualEffort(162, 180) === "light"`, `visualEffort(180, 180) === "max"`.
- No edits to `src/feel.ts`, `src/loop/machine.ts`, `src/loop/timing.ts`, `src/math/score.ts`, `src/ui/share.ts`, or `visualEffort`.
