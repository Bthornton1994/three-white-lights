# Visual polish evidence — `a599b11e80fdfdfa82982feb1e46405e727fb475`

Isolated presentation branch cut from PR #81 (`b80d6a0527eafb6c93afc43f63aad71c509fd277`).
PR #82 analyzer (`342f5db903cb9ac93c494eda9d188257c4b91d1c`) against this candidate.

## Analyzer command

```
cd tools/twl-development-analysis

npm run analyze -- \
  --target a599b11e80fdfdfa82982feb1e46405e727fb475 \
  --attempts-per-lift 3 \
  --keep-worktree \
  --insecure-fonts \
  --out /tmp/twl-visual-evidence-20260918 \
  --chromium /tmp/pw-browsers/chromium-1194/chrome-linux/chrome \
  --work-dir /tmp/twl-visual-analysis-wt
```

Run id `a599b11e-2026-09-18T19-28-38-303Z`. Fresh worktree, Chromium 141, ephemeral port `41469` (not 8080/8081).

Overall: **REVIEW** (standing document-contract + expected pixel drift vs PR #81 committed shots). No FAIL.

| Flag | PR #81 | This candidate |
|---|---|---|
| `DESKTOP_GUTTERS_WIDE` | 0.50 | **0.25** |
| `CANDIDATE_BANNER_RENDERED` | painted | **absent** (`editionBanner=null`) |
| `TITLE_DRIFT_VS_REFERENCE:phone` | 0.1154 | **0.0019** vs PR #69 (`referenceTitle.phone.meanAbsDiff`) |

18/18 cases: `held=false`, first press accepted, 4140/4140 frames matched, 0 overflow, 0 console errors, 0 ungrounded cases. Deadlift a2/a3 misses match frozen mechanics (4).

## Shots in this pack

Phone 390×844:

- `phone-title.png` — Iron & Amber title, career-mode lede, no candidate banner
- `phone-lift.png` — lift select
- `phone-squat-brace.png` — grounded squat brace
- `phone-squat-outcome.png` — squat make

Desktop 1280×800:

- `desktop-title.png` — Iron & Amber title-wide, no candidate banner
- `desktop-squat-brace.png` — integer 3× (960 CSS) gym, HUD overlay, athlete on the platform
- `desktop-squat-outcome.png` — squat make
- `desktop-deadlift-lock.png` — deadlift lockout; ~53 source px ceiling clip at 3× is documented in `docs/design/SPRITE-STAGE-CONTRACT-20260918.md`

Full analyzer report: `analyzer-report.md`. Attempt matrix: `cases-summary.json`.
