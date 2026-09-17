# ANIMATED_INTEGRATION — illustrated shell + existing arcade frames

**Status:** `ILLUSTRATED_SHELL_ANIMATED_FRAMES` · **DO_NOT_MERGE** · not production-ready · not SNES craft
**Base / PR #74 SHA:** `414b563896b6f415b9a4ec17644d57602072fc59`
**Branch:** `cursor/illustrated-animated-arcade-20260916`
**feel.ts SHA256:** `b26c21b520d17a8e87e6abac17661fc219870a2320a376b5b1b1adfe0bc2425c` (unchanged)

## Asset inspection (before animation)

PR #74 illustrated sources are:

| Asset | States | Usable as lift animation? |
| --- | --- | --- |
| AI-REF-05 title | 1 still | No — title/results chrome only |
| AI-REF-01 model sheet | sheet, not frames | No |
| AI-REF-04 squat diptych | light vs max hole | No sequence |
| AI-REF-03 deadlift diptych | setup vs lockout in one image | Two-panel still, not frames |
| bench-revised-20260916.png | 1 mid-press still | No sequence |
| arcade/public/sprites/{squat,bench,deadlift}[-max]/frame-01..06 | 6 action frames / lift | Yes — existing compatible runtime |

No new art was generated. Fable stills were not sliced, traced, or AI-edited.

## What this tip does

Title, lift-select (including revised bench), results, and share stay on the
PR #74 illustrated shell.

Walkout and the lift sequence play the existing arcade sprite runtime inside
that shell: lift-specific sheets, deadlift `frame-06` lockout, visual-only
walkout clock. Timing, judging, scoring, streak, and `feel.ts` are unchanged.

## P1 squat depth (this tip)

Squat `frame-03` is a real below-parallel hole (silhouette y0 60→119, height
258→199 on the 320 master). Mapping holds that frame through the DEPTH cue
(`progress` 0.42–0.58). Walkout stays `frame-01`. Judging holds `frame-06`.
Success frames appear only after judging.

A compact on-stage **DEPTH** gauge sits beside the lifter during
walkout/timing/judging. It is never in the results panel. Target band is
legal below-parallel depth, not the tap-timing lane. Bench and deadlift
are unchanged and have no gauge.

Evidence: `evidence/squat-depth/` (phone 390×844 + desk 1280×800 stand /
descent / hole / ascent / lockout, live Good-lift, `phone-squat-depth.webm`).
Live play cycled all six squat frames and depth 0→1→0; two in-window taps
still scored a good lift.

## Remaining limitations

- Pixel arcade frames and painterly Fable stills are two visual languages.
  Title/select/results are illustrated; the athlete during play is arcade frames.
- Six frames per lift is a short cycle, not SNES/Genesis sports craft.
- Phone title is still a letterboxed landscape still.
- No dedicated illustrated walkout / success / miss sequences exist.
