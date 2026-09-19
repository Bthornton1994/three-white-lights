# Integer scale fallback evidence — `77e3cd072b1aa6fee7bf0c168f5a0b5a4fcb2f04`

PR #82 analyzer (`342f5db`) against this candidate. `--attempts-per-lift 3`. Fresh worktree, ephemeral port (not 8080/8081).

Overall: **REVIEW** (standing document-contract + honest `DESKTOP_GUTTERS_WIDE` 0.50 at 1280×800 + expected pixel drift vs PR #81 committed shots). No FAIL.

| Viewport | Scale | Canvas CSS | Clip | Contact Y |
|---|---|---|---|---|
| 390×844 | 1× | 320 | none | 318 |
| 1280×800 | 2× | 640 | none | 318 |
| 1280×1000 | 2× | 640 | none | 318 |
| 1440×900 | 2× | 640 | none | 318 |
| 1280×1200 | 3× | 960 | none | 318 |

3× only when min-height is 1120 so the 960 cell and stacked HUD both fit. 1280×800 gutter 0.50 is REVIEW vs analyzer 0.45 — not a threshold edit.

18/18 cases: held=false, first press accepted, 4140/4140 frames matched, 0 overflow, 0 console errors, 0 ungrounded.
