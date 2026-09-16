# Gate 1 in-app preview evidence

Harness: `arcade/art-source/gate1-sample/author/capture_browser.mjs`
Chrome: `/usr/local/bin/google-chrome` via playwright-core.
App: `http://127.0.0.1:5173/` (Vite). `feel.ts` untouched.

## Viewports

- `390×844` mobile
- `1280×800` desktop

## What was exercised

Title → lift-select (squat cards) → squat attempts (light stage frame-01) → raise A1 to max sheet → walkout → squat hole (frame-03) → deadlift setup (frame-01) → deadlift lockout (frame-06) → model-sheet PNG.

## Measured (see METRICS.json)

| Surface | 390×844 | 1280×800 |
| --- | --- | --- |
| Stage `.stage-lifter` | 320×320, `image-rendering: pixelated` | 320×320 |
| Squat card imgs | 104×104 inside a 162px-wide figure | 208×208 (2× integer; not non-integer 190) |
| overflowX | none | none |
| pageerrors | none | none |

Deadlift setup `src` is `deadlift/frame-01.png`. Lockout `src` is `deadlift/frame-06.png`. Squat miss routing is covered by `sheets.test.ts`, not this harness.
