# Hold-pad state leak fix — evidence

Fresh browser evidence for the fix in `src/ui/holdPad.ts` / `src/ui/ArcadeApp.tsx`,
captured with the read-only development analyzer from PR #80
(`tools/twl-development-analysis`, commit `05de0cad`), extended to play
**every lift for three attempts on both viewports** (390×844 and 1280×800).
The analyzer's fake clock steps 16 ms per frame; inputs are real pointer
events on the hold pad at the sim ticks the A0 freeze scripts prescribe.

- `parity.json` — per-trace parity against the mechanics mirror (phase path,
  frame, depth, bar height, prompt, press/lockout commands), `data-held` at
  every brace beat, outcomes, grounding proofs, and both analyzer runs'
  decisions.
- `report-3x3.md` — the extended run's full decision report.
- `shots/` — brace, outcome and results screenshots for all 18 attempts.

Reproduce: check out this branch, then from PR #80's package run
`npm run analyze -- --target <this sha> --keep-worktree --insecure-fonts`
(standard plan) and, for the 3×3 plan, the extended runner kept under that
package's `out/` directory as described in the PR.

Deadlift attempts 2 and 3 end in a miss in the browser **and** in the
mechanics mirror with identical phase paths: that is the frozen sim's
verdict on the scripted heavier pulls, not the pad.
