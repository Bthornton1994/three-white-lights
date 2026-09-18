# TWL development analysis

Read-only development tooling for Three White Lights. It builds an exact
target SHA in a throwaway worktree, plays the real lift loop in headless
Chromium under a stepped fake clock, and emits **typed decisions** about
whether the build is still the intended game:

- the frozen Session A mechanics (`createLift` / `stepLift`) are the ones
  driving what is on screen;
- the career-mode sprite athlete is grounded on the platform inside the
  Iron & Amber shell at an integer, nearest-neighbour scale;
- the presentation has not drifted into a two-tap timing demo, a
  still-image shell, a DEPTH gauge, a raw centred tile, or a floating athlete;
- the served page is a fresh build of the declared sources, never a stale
  preview.

It is **not** part of the game. Nothing under `tools/twl-development-analysis/`
is imported by `arcade/` or any runtime; the package has its own manifest and
is ignored by every game bundle. It never edits the target, never writes to a
branch, never calls an external model, and never reads or requests API keys.

## Decisions

Every analyzer returns exactly one `Decision`:

| Field | Meaning |
|---|---|
| `verdict` | `PASS`, `REVIEW`, `FAIL` or `ABSTAIN`. Silence is never a pass: an analyzer with nothing to inspect returns `FAIL` (evidence that should exist is missing) or `ABSTAIN` (not implemented / deliberately skipped). |
| `confidence` | 0..1, how completely the evidence supports the verdict. Never a feel claim. |
| `flags` | Typed reasons, e.g. `INPUT_HELD_STATE_LEAK:phone-squat-a2`. Any non-PASS verdict carries at least one. |
| `metrics` | The numbers the verdict rests on. |
| `evidence` | References to screenshots, canvases, files, git objects, commands. |
| `source` | Target SHA, presentation reference SHA, mechanics authority SHA, and the SHA the served page itself declares. |
| `provider` | `twl-development-analysis <version>`, engine `deterministic-rules`, Node, Playwright and Chromium versions. No TypeSafe/Jev call is made in this slice; the provider field is where one would be recorded. |
| `humanApprovalRequired` | `true` for every visual or feel judgment. Tooling can measure composition; it cannot approve craft. |

The run verdict folds all decisions with `FAIL > REVIEW > ABSTAIN > PASS`.
The standing `document-contract-conflict` decision is always `REVIEW`, so
the run can never be better than `REVIEW` until the owner reconciles the
design documents.

## Analyzers

| id | What it measures |
|---|---|
| `source-identity` | `arcade/src/game/lift.ts` and `liftTuning.ts` hash-verified on every run against **both** the pinned SHA-256 values and the authority commit read from git; `feel.ts` pinned; sprite sheets byte-identical to the presentation reference; edition constants name the same commits; build succeeded. |
| `served-identity` | Served script hash equals this run's fresh `dist/`; bundle contains both commit pins; served sprites equal worktree and reference; every rendered screen declares the configured mechanics and base SHAs and the `sprite-stage` shell. Rejects stale previews and mismatched served SHAs. |
| `existing-tests` | The target's own `npm test` (node tests, sprite QA, vitest parity). |
| `mechanics-frame-parity` | The browser trace (16 ms fake-clock frames) versus the mechanics probe's mirror of the same input schedule through the target's own `stepPlay` and frame mapping: phase path, per-frame phase/frame/depth/bar height, prompts, press and lockout commands. A frame oracle asks the target's own mapping which frame the DOM's state should show. Detects a held flag that leaks across attempts and whether a deadlift miss matches the frozen sim. |
| `attempt-matrix` | One row per viewport × lift × attempt. Records target/served SHA, input events, phase/frame traces, `data-held` before the first input, first-press acceptance, judgment, console errors, overflow, grounding and parity. `--attempts-per-lift 3` requires all 18 cases. |
| `sprite-grounding` | Anchor table equals measured PNG alpha; every stage frame reports the shared contact line (318); the live canvas equals the anchored composition of platform + frame pixel for pixel; play traces animate through distinct frames without jumps, show the hole frame at maximal depth, keep the ground line fixed, and bound foot drift. |
| `design-intent` | Iron & Amber tokens and type, canvas athlete (no `<img>` still), `image-rendering: pixelated`, integer scale, phone stage width and desktop stage height fractions, gutter fraction, no horizontal overflow, three lights, honest HUD, no DEPTH gauge / timing lane / two-tap copy, flow coverage, page errors, candidate banner. |
| `preview-regression` | A fresh build compared to the evidence the candidate committed (structure exact, pixels with scroll-aligned stage comparison) and to the presentation reference captured from its own worktree (tokens, sprites, title). |
| `document-contract-conflict` | Standing `REVIEW`: the Iron & Amber reference, GDD §7.1 and the product brief disagree about sprites as the primary art direction. Reads the documents at the authority, PR #44 and the target and reports their hashes. Never picks a side. |
| `flow`, `balance`, `input-fairness`, `progression`, `playtest` | Registered now, `ABSTAIN` until implemented, so the report shows them rather than omitting them. |

## Running

```bash
cd tools/twl-development-analysis
npm install                       # playwright 1.56.1 (matches the preinstalled Chromium), pngjs, typescript
npm run analyze -- --keep-worktree              # full run: target + reference + target tests
npm run analyze -- --skip-reference --skip-tests --keep-worktree   # faster iteration
npm run analyze:bundle -- --bundle out/<run>/bundle.json --facts out/<run>/facts.json   # recompute offline
npm test                          # node:test over fixtures and synthetic pixels
npm run typecheck
```

Options: `--target <sha>`, `--reference <sha>`, `--out <dir>`, `--work-dir <dir>`,
`--chromium <path>`, `--insecure-fonts` (accept a TLS-intercepting proxy for the
two Google Fonts hosts only; off by default; needed in sandboxes with a MITM
proxy so the display font renders), `--attempts-per-lift <n>` (omit to keep the
original coverage; `3` plays squat/bench/deadlift × three attempts on both
390×844 and 1280×800 — 18 cases — and records held-state, first press, parity,
overflow, grounding and provenance on each).

Requirements: Node 22.18+ (native type stripping), network for `npm ci` in the
worktree, Chromium (Playwright's bundled revision or `/opt/pw-browsers/chromium`),
Python 3 with Pillow and numpy for the target's own `check_sprites.py`.

Outputs land in `out/<sha8>-<timestamp>/`: `decisions.json` (the `RunReport`),
`report.md`, `bundle.json` (everything the browser observed), `facts.json`
(everything static inspection and the probe observed), `cases.json` (one row
per viewport × lift × attempt), `probe.json`, `evidence/*.png` (screenshots
and raw canvas pixels), `committed-evidence/` (the candidate's own evidence
copied for comparison), `reference/` (the PR #69 capture). Worktrees live
under the OS temp directory and are removed unless `--keep-worktree` is
passed; they are detached and never touch a branch.

## How the browser capture stays deterministic

The driver installs Playwright's fake clock, pauses it, aligns it so the
walkout timer fires on a 16 ms boundary, then advances exactly 16 ms per
frame. The target's rAF loop therefore sees `dt = 16` every frame and its
60 Hz integrator ticks exactly as the probe's mirror predicts. Inputs are
issued as real pointer events on the hold pad at the sim tick the A0 freeze
scripts prescribe, filtered through the same press/release guard the pad
applies. After each frame the driver yields a macrotask so React has
committed before the DOM is read.

## Configuration

- `config/baseline.json`: owner rulings. Target, presentation reference and
  mechanics authority SHAs, pinned hashes, protected files, document clauses.
- `config/intent.json`: the product brief encoded as measurable expectations
  and analyzer tolerances. These are analysis tolerances, never game-feel
  values; game feel stays in the target's `feel.ts` and is never read as
  truth here.

## Fixtures

`fixtures/bundles/good-sprite-stage/` is a trimmed real capture of the
candidate. `fixtures/bundles/negative-*/` are derived from it by
`test/build-fixtures.ts`, one per known bad direction: two-tap timing demo,
still-image shell, DEPTH gauge, raw centred tile, floating athlete, giant
gutters, smoothed non-integer scale, stale preview, mechanics hash drift,
missing evidence, held-state leak across attempts. `npm test` asserts each
yields `FAIL` with the named flags. The held-state negative must be `FAIL`,
never `PASS` or `REVIEW`.

## Boundaries

- Never modifies gameplay, art, assets, `feel.ts`, timing, judging, scoring,
  or any PR branch. Worktrees are detached.
- Never rewrites the target's tests; it runs them and reports exit codes.
- Never calls TypeSafe/Jev or any external API; never reads API keys.
- Never merges, deploys, or opens a merge-ready PR.
- Cannot judge feel or craft. `humanApprovalRequired` is `true` on every
  visual decision and on the run as a whole.
