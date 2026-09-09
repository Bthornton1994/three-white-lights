# This bundle is stale — read before trusting it

`notes.json` / `notes.txt` / the PNGs in this directory were captured at
`c8e07e23a581b4b11f2dc83a223b100c3d1eb57e`, **before** the VL-3 runtime
round two (the trace sink) and the rig contract merged. At that commit
`window.__empireMotionTrace` did not exist, so `gaitCycle`, `walkFootPlanted`,
`noSkate`, `noFamilySnap`, `stationAttached` and `facingStable` are all in
this bundle's own `skipped` map — the tool exited **3** (missing contract),
never graded. If you are looking at `notes.json` and cannot find those
verdicts in `results[*].verdicts`, that is why: this is the SKIP-shaped run,
not a pass.

**A fresh run against the current tree (round 2B, honest-scoping fix
included — see `tools/capture-motion-proof.mjs`'s `walkFootPlanted`/
`noSkate` depth-axis scoping and `facingStable`'s derived motion floor) still
exits 1 — genuinely red, not a SKIP.** Per this round's own hard rule
("NEVER commit a red record as evidence"), that fresh run is **not**
committed here. It is kept at
`.gauntlet`-adjacent scratch space and reported directly in the round's
builder report. The numbers, so a reader does not have to take that on
faith:

- **walkFootPlanted / noSkate.** After scoping out depth-axis stances (a
  body walking toward/away from the camera on the four-neighbour grid, which
  this verdict's horizontal-only formula cannot judge — 8-10 of 17-19
  stances per run, max drift among them 0.68-0.86 tiles, reported and
  unjudged), the REMAINING horizontal-axis stances still exceed the 0.05-tile
  tolerance on most runs (max drift observed 0.07-0.86 tiles across repeated
  runs, driven by 1-2 of 7-11 stances whose net stage travel disagrees with
  the stance's own `facing`).
- **facingStable.** The longest facing/travel disagreement run fell from 62
  frames to 16-17 frames once the derived motion floor excluded true noise,
  but still exceeds N=13-14 (the `FLOOR_MEMBER_GAIT_TRANSITION_MS` hysteresis
  window) on every run measured.
- **Mechanism, traced to the actual trace rows, not inferred:** both
  failures share one root cause. During the `bench-dismount` -> `bench-finish`
  "leaving" settle glide, the drawn point moves steadily in one screen
  direction (e.g. `drawnX` rising from ~195px to ~262px over ~20 frames) while
  the member's stated `facing` stays `left` throughout — the body visibly
  glides one way while marked as facing the other, for roughly 270-330ms,
  longer than the hysteresis window this verdict allows. This is real,
  measured, sustained travel — not sub-pixel jitter, not a coordinate
  artefact — and it is a `src/empire/**` runtime finding (`memberMotion.ts`'s
  facing rule during this transition), which is frozen this round and is not
  fixed here.

This is recorded here, next to the stale bundle it corrects, rather than only
in a commit message, so a reader who opens this directory does not draw a
false "already passing" conclusion from either the old SKIP-shaped bundle or
its absence.
