# Original sprite restore — evidence

**DO_NOT_MERGE. Not a visual PASS. Independent QA owns craft / MERGE_OK.**

Analyzed SHA (code): `f4b529a8612dd3da374fa654c16cabe82f85d864`  
Base: PR #81 `b80d6a0527eafb6c93afc43f63aad71c509fd277`  
Analyzer: PR #82 `342f5db903cb9ac93c494eda9d188257c4b91d1c`  
Command:

```
cd tools/twl-development-analysis
PLAYWRIGHT_BROWSERS_PATH=/tmp/pw-browsers npm run analyze -- \
  --target f4b529a8612dd3da374fa654c16cabe82f85d864 \
  --attempts-per-lift 3 \
  --out /tmp/twl-original-sprite-restore \
  --chromium /tmp/pw-browsers/chromium-1194/chrome-linux/chrome \
  --work-dir /tmp/twl-original-sprite-restore-wt \
  --insecure-fonts --keep-worktree
```

Playwright 1.56.1 · Chromium 141 `/tmp/pw-browsers/chromium-1194/chrome-linux/chrome`  
Port: ephemeral `34545` (never 8080/8081)

## What this branch is

Presentation-only restore of the **PR #81 / PR #79 sprite stage**, with the
player-facing `DO_NOT_MERGE` banner removed. It is **not** another 3× overlay
or height-gated 2× fallback (PRs #85 / #86). Mechanics, frames, anchors,
sheets, SpriteStage, and hold-pad controller are byte-identical to PR #81.

Changed runtime files:

- `arcade/src/ui/ArcadeApp.tsx` — banner DOM node removed
- `arcade/src/styles.css` — `.edition-banner { display: none }` belt; sprite-world 320/640 unchanged
- `arcade/src/sprites/edition.ts` — `PREVIEW_BUILD` label only
- `arcade/src/ui/presentation.test.ts` — locks original scale, no banner, protected hashes

## Protected-file hashes (match PR #81)

| File | SHA-256 |
|---|---|
| `arcade/src/feel.ts` | `b26c21b520d17a8e87e6abac17661fc219870a2320a376b5b1b1adfe0bc2425c` |
| `arcade/src/game/lift.ts` | `4dc74947ffc64f1af36da92c01a7cfb53d3f021b802cba31f67c3ecdcb24e417` |
| `arcade/src/game/liftTuning.ts` | `ef920d59eecdb5ac698f7515a1efe4af1c7ee0e38f9079f7f9cd6deace441f2a` |
| `arcade/src/ui/holdPad.ts` | `23d9440670e8694769cc13daf139b7ad9510e5e636895d26230b8cc7570693a2` |
| `arcade/src/sport/frames.ts` | `f7ccdbdc5f402ebd2028e0ca3254e7014b2f0d19f4142fcc9f86249476a0ee66` |
| `arcade/src/sprites/sheets.ts` | `16b5c1e1c87551b3fc910572ddca7d87555595818319c9b1393a61fd4a6029de` |
| `arcade/src/sprites/anchors.ts` | `971da821caf858a7f6c67485167ac868442b05ac3b896b16b76fcb62afc9039c` |
| `arcade/src/ui/SpriteStage.tsx` | `afd6978f5f2ba1a006924f31a234d874d4ddb489f91eb26c825ae0423e727f48` |
| sprite PNGs | 69 files, unchanged vs PR #81 / PR #69 |

## Tests (target worktree)

- `cd arcade && npm test` — 76 node tests pass, sprite QA ok, sport vitest 20/20
- `npm run build` — ok
- `python3 scripts/check_sprites.py` — ok (via npm test)

## Analyzer overall: FAIL (do not convert to PASS)

Phone 9/9 attempts completed, grounded, contactY 318, no overflow, no console errors, no held leak.

Desktop 1280×800 could not complete a lift under the analyzer's `mouse.down` on `.hold-pad` boundingBox (no auto-scroll). The original 2× stage is 640 CSS px; the stacked HUD/hold-pad sits at **y=795–867** in an 800 px window (scrollHeight 929). Pad center is below the fold, so the scripted hold never leaves BRACE. That is why desktop a2/a3 cases are missing (12/18). **Feel / lift / holdPad were not retuned.**

This is the original PR #81 stacked layout, not a new regression from 3× overlay. A human can scroll; the analyzer cannot. Overlay HUD (PR #85) and compact HUD (PR #86) were rejected as product direction and are not in this branch.

### Pad geometry (live, post-walkout, no banner)

| Viewport | canvas CSS | pad y–bottom | in view | scrollHeight |
|---|---|---|---|---|
| 390×844 | 320×320 | 668–740 | yes | 844 |
| 1280×800 | 640×640 | 795–867 | **no** | 929 |

### Layer verdicts

| Analyzer | Verdict | Flags |
|---|---|---|
| source-identity | PASS | — |
| served-identity | PASS | — |
| existing-tests | PASS | — |
| mechanics-frame-parity | FAIL | desktop lifts stayed BRACE |
| attempt-matrix | FAIL | 12/18; desktop a2/a3 missing; heldLeaks=0 |
| sprite-grounding | FAIL | desktop still-image (never left brace) |
| design-intent | REVIEW | `DESKTOP_GUTTERS_WIDE` (0.50). Banner **gone**. Overflow 0. Phone width frac 0.821. Desktop height frac 0.80. |
| preview-regression | REVIEW | pixel drift vs committed PR #81 shots that still had the banner. Title vs PR #69 live capture meanAbsDiff **0.0011** (no TITLE_DRIFT). |
| document-contract-conflict | REVIEW | Iron & Amber vs GDD §7.1 vs brief. Documents **not** edited. |
| flow / balance / input-fairness / progression / playtest | ABSTAIN | not implemented |

## Owner-reference comparison

Owner stills in `owner-reference/` (lift selection, squat hole/outcome, deadlift outcome/results) show a **full-bleed overlay HUD** and a large athlete filling the viewport. That is the PR #69-era illustrated/full-bleed look.

This restore is the **PR #79 SpriteStage** product: 320×320 integer cell, 1× phone / 2× desktop, athlete grounded on `platform.png` (contactY 318), Light/Max lift cards, Iron & Amber type, outcome with the athlete still on stage above the result copy.

Matches owner stills in:

- Distinct Squat / Bench / Deadlift identity
- Light and Max sprite previews on lift cards
- Real hole / pause / floor-pull / lockout frames on phone
- Good-lift and no-lift copy with the athlete still visible
- Results card (weight / execution / streak / total)
- No DEPTH rail, no two-tap lane, no illustrated still shell, no candidate banner

Does not match owner stills in:

- Athlete scale (320/640 cell vs full-bleed overlay)
- HUD stacked under the stage vs painted on the scene
- Desktop iron gutters (0.50) vs a scene that fills the monitor
- Outcome as a panel under the canvas, not a “WHITE LIGHTS / GOOD LIFT” stamp on the athlete

Those gaps are the standing design conflict (brief wants full-stage composition; SpriteStage cell is 320; 3× clips at 800 px). This branch does **not** pick a side by changing scale or overlaying the HUD.

## Not done / not claimed

- No visual PASS, no MERGE_OK, no SNES-craft self-certification
- PRs #79–#86, `main`, and existing branches were not modified
- GDD and Iron & Amber reference were not edited
- No new art, no sprite recuts, no two-tap demo
