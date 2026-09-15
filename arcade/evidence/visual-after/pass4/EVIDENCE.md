# Pass-4 evidence vs `04ab61ca910ff1376e1082221781690733594451`

Self-assessment: **ISSUES_REMAIN**. Not visual PASS. Not MERGE_OK.
Independent QA owns SNES/Genesis sports craft, stage quality, card quality,
and effort-state A/B.

Art+presentation SHA this evidence describes: `10132d72a59a1c0e4d47c9ff68c4df9cbd950d34`.
This file is the evidence package for that tip.

## Viewport captures

| Check | Path | Result |
|---|---|---|
| Title 390×844 | `app-title.png` | `currentSrc=/sprites/title.png` 1008×1792, box 390×844, `object-fit:cover` `object-position:50% 42%`, pixelated. HTML title is “Three White Lights”. No overflowX. |
| Title 1280×800 | `desktop-title.png` | `currentSrc=/sprites/title-wide.png` 1792×1008, box 1280×800, `object-position:50% 50%`, pixelated. Headroom, no 04ab61c bust-crop. |
| Lift-select 390 | `app-lift-select.png` | All three cards in frame. OverflowX false. |
| Lift-select 1280 | `desktop-lift-select.png` | 3-column. OverflowX false. |
| Squat card 390 | `cards/lift-card-0.png` + `cards-rendered-390.png` | Light **and** Max, CSS **162×104** each |
| Bench card 390 | `cards/lift-card-1.png` | Light **and** Max, 162×104 |
| Deadlift card 390 | `cards/lift-card-2.png` | Light **and** Max **lockout** (frame-06), 162×104 |
| Same cards desktop | `cards/desktop-lift-card-0..2.png` + `cards-rendered-desktop.png` | CSS **190×190** each, 3-column |
| Stage 320 masters | `stage-320-masters-strip.png` | Native 320 hole / pause / setup / lockout L+M |
| Squat stage L/M | `inapp-squat-light-vs-max.png` | frame-03 light vs squat-max/frame-03 |
| Bench stage L/M | `inapp-bench-light-vs-max.png` | frame-03 light vs bench-max/frame-03 |
| DL setup vs lockout | `inapp-setup-vs-lockout.png` | frame-01 hinge vs frame-06 stand |
| DL lockout L/M | `inapp-lockout-light-vs-max.png` | more plates / mass on max |
| DL lockout desktop | `desktop-lockout-deadlift.png` | no CSS head crop; lifter `min(42vw, 400px)` |

Before/after vs 04ab61c: `before-after-title-390.png`, `before-after-title-desktop.png`, `before-after-lift-select-390.png`, `before-after-lift-select-desktop.png`, `before-after-deadlift-lockout.png`.

## Cards no longer smear / collapse / hide max

`04ab61c` CSS: `.lift-card img { width:96px; height:84px }` and a **single** light frame (squat/bench 03, deadlift **01**). Max sheets were never shown on the select screen.

Now (Chromium computed, this smoke):

| Viewport | Art CSS box | Sources on **each** card | `image-rendering` |
|---|---|---|---|
| 390×844 | **162×104** (was 96×84) | Light **and** Max 320 masters | pixelated |
| 1280×800 | **190×190** | Light **and** Max 320 masters | pixelated |

Measured `CARD BOXES`:

```
squat     light /sprites/squat/frame-03.png          162×104
squat     max   /sprites/squat-max/frame-03.png      162×104
bench     light /sprites/bench/frame-03.png          162×104
bench     max   /sprites/bench-max/frame-03.png      162×104
deadlift  light /sprites/deadlift/frame-06.png       162×104
deadlift  max   /sprites/deadlift-max/frame-06.png   162×104
```

Desktop same six sources at 190×190. Deadlift cards use **lockout** (frame-06), not setup (frame-01). Tests assert `light !== max` bytes.

OverflowX false at both viewports. All three cards visible at 390×844.

## Deadlift lockout ≠ setup rewind

Opaque bbox on production 320 masters:

| Frame | size | bbox (l,t,r,b) | h | y-span |
|---|---|---|---|---|
| setup `deadlift/frame-01.png` | 320×320 | (54, 139, 268, 318) | **179** | 139..318 (hinge, low) |
| lockout `deadlift/frame-06.png` | 320×320 | (10, 12, 310, 319) | **307** | 12..319 (standing, head near top) |
| lockout max `deadlift-max/frame-06.png` | 320×320 | (4, 10, 316, 319) | **309** | 10..319 |

Silhouette Δ(01, 06) = **31774** px (gate ≥ 2500). Light vs max lockout Δ = 11782 px (gate ≥ 900).

`frameSrcFor` judged deadlift at progress=1 is still `frame-06.png`. In-app swap of `.stage-lifter` to frame-06 shows the standing finish; setup swap shows the hinge. Head is in the 320 frame (y0=12 of 320). Desktop lockout uses the same master, CSS width `min(42vw, 400px)`.

## Title identity / desktop crop

| | 04ab61c | pass 4 |
|---|---|---|
| Phone master | 640×896 with painted POWER LIFTING | `title.png` 1008×1792, no letters |
| Desktop | same 4:3 sliced by `object-fit:cover` | `title-wide.png` 1792×1008 via `<picture min-width:860px>` |
| `currentSrc` 390 | (old title.png) | `/sprites/title.png` natural 1008×1792 |
| `currentSrc` 1280 | (old title.png) | `/sprites/title-wide.png` natural 1792×1008 |

HTML is the title (“Three White Lights”). Art has no federated wordmark.

## Palette / chroma / alpha

`PALETTE_ALPHA.md` — 59 production files, **0 fails**. Binary alpha (semi=0), magenta=0, sprites ≤48 colors, title/platform ≤64.

`python3 arcade/scripts/check_sprites.py` → `sprite QA ok` (includes lockout≠setup and light≠max silhouette gates).

## Browser smoke (this run)

- 390×844 dsf=2 and 1280×800.
- overflowX **false** on title, lift-select, attempts, walkout at both viewports.
- pageerror **[]**.
- `image-rendering: pixelated` on `.title-art`, `.lift-card-art img`, `.stage-bg`, `.stage-lifter`.
- Title text: “Three White Lights” / “IRON & AMBER ARCADE”. Lift-select text includes LIGHT and MAX on squat, bench, and deadlift.

## Tests

| Suite | Result |
|---|---|
| `arcade/` `npm test` (includes `check_sprites.py`) | **53/53** pass |
| workspace `npm run test:arcade` | **46/46** pass |

## Unchanged gameplay (diff vs `04ab61c` is empty)

`arcade/src/feel.ts`, `arcade/src/loop/`, `arcade/src/math/`, `arcade/src/ui/share.ts`, `arcade/src/SpriteStage.tsx`, pose tables in `build_sprites.py`.
`visualEffort` / `VISUAL.MAX_LOAD_RATIO 0.96` unchanged. Judging, timing windows, scoring, two-good-lights rule not touched.

PRs #63, #66, #67, #68 not modified by this branch.

## Residual visual defects (why ISSUES_REMAIN)

1. Still Imagine-indexed illustration, not hand-pixelled SNES clusters. Palette posterizes. Method is near its ceiling.
2. Bench 3/4 320 masters were **not** regenerated this pass; still the weakest lift.
3. Phone cards at 104px are readable vs 84px but are not a native SNES card grid.
4. Identity is closer, not model-sheet locked; hairline/beard still drift.
5. Deadlift 06 is a dedicated lockout overlay on a 2×3 pull sheet — 05→06 can hitch scale.
6. Stage CSS ~304–400px on a 320 master is near-native; 104px cards still downsample the 320 lattice.

If Independent QA still rejects Slam Masters / NBA Jam craft, **stop generating**. Commission a human pixel artist in Aseprite on a true 320 lattice (or native 80) with a model sheet. Another Imagine or geometric pass will not clear that bar.
