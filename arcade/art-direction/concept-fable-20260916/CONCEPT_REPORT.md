# CONCEPT_REPORT — art-direction concept draft, concept-fable-20260916

| Field | Value |
| --- | --- |
| status | **CONCEPT ONLY · DO_NOT_MERGE** |
| requested_model | `claude-fable-5-1` |
| actual_model | Claude Fable 5.1 (Cursor cloud agent; self-reported from the runtime identity — not independently verifiable from inside the run) |
| PLANNER_ESCALATION | owner-requested Fable art-direction one-shot |
| base tip | `50b07c894436fd9fbebe0843e5f1aa9532191db0` (PR #70 tip; PR #69 tip `1151569c` is its parent chain) |
| branch | `cursor/art-direction-concept-fable-20260916-3694` |
| project state | unchanged: `ARTIST_REQUIRED`, `INTERNAL_PIPELINE_CEILING: YES`, `keep_draft`, `do_not_merge` |
| production claim | **none**. Not visual approval. Not production-ready. |
| live game | still loads `arcade/public/sprites/` from PR #70; `npm test` 53/53 + `check_sprites.py` ok; `npm run build` ok on this branch |

## 1. Paths

Concept folder: `arcade/art-direction/concept-fable-20260916/`

| Deliverable (from the request) | Path |
| --- | --- |
| 1 Character model sheet | `MODEL_SHEET.md` (documented); `reference-ai/AI-REF-01-MODEL-SHEET.png` (AI, labelled, direction only) |
| 2 Locked face / hair / beard / clothing / palette / proportions / silhouette | `MODEL_SHEET.md` §2–§7; `templates/proportion-guide-160.png`; `palette/` |
| 3 Squat / bench / deadlift key poses | `POSES.md` §1–§3; `production-frame-list.csv` |
| 4 Light vs max contrast plan | `EFFORT_CONTRAST.md`; `reference-ai/AI-REF-04-SQUAT-HOLE-LIGHT-VS-MAX.png` |
| 5 Deadlift setup→lockout sequence | `POSES.md` §2; `reference-ai/AI-REF-03-DEADLIFT-SETUP-LOCKOUT-MAX.png` |
| 6 Bench 3/4 composition | `POSES.md` §3; `reference-ai/AI-REF-02-BENCH-THREE-QUARTER.png` |
| 7 Separate mobile card compositions (~104 px) | `CARDS_AND_TITLE.md` §1–§2; `templates/card-52-composition-{squat,bench,deadlift}.png` |
| 8 Title-screen concept | `CARDS_AND_TITLE.md` §3; `templates/title-{portrait,wide}-safe-zone.png`; `reference-ai/AI-REF-05-TITLE-SCREEN.png` |
| 9 Pixel-cluster and lighting rules | `PIXEL_RULES.md` |
| 10 Exact production asset spec | `PRODUCTION_SPEC.md`; `production-frame-list.csv`; `tools/validate_package.py`; `tools/preview_harness.py` |
| Measured baseline evidence | `baseline/desktop-1280x800-attempts-clip.png` |
| Regeneration | `tools/make_concept_artifacts.py --ai-src <dir with ai-ref-*.png>` |

## 2. Proposed palette and grid

**Palette:** `palette/iron-amber-v2.json` — 64 named entries in hue-shifted
ramps (skin 5 + flush 3, hair 3, singlet 4, amber 4, knee 3, wraps/chalk 3,
shoes 2, bar 4, six IPF plate colours with 2–3 steps each, bench/rack 4, wood 3,
outline 2, mouth 1, scene-only 8). Budgets: ≤ 40 per stage frame, ≤ 16 per
card, ≤ 64 per scene, binary alpha, zero off-palette. Exported as `.gpl` for
Aseprite/LibreSprite/Pixelorama/GIMP/Krita and as a swatch sheet. It is a
proposal; the artist may revise the JSON with reasons.

**Grid:** author at 160 × 160 (stage) and 52 × 52 (cards); export nearest ×2 to
320 × 320 and 104 × 104, matching the existing runtime contract with no code
change. Anchors in master px: ground y 304, shadow rows 300–316, standing
head-top ≥ 52 (survives the measured desktop clip), low-bar y 100, bar span
x 26..294 at a 35° 3/4 camera. Title safe zones computed for the live CSS:
portrait x 100..907 / y 188..1532; wide x 518..1273 / y 126..882 (narrow
because a ≥ 860 px portrait tablet still receives `title-wide.png`).

Measured runtime geometry that the grid is built on (running app at
`50b07c89`, Playwright, this run): stage lifter 273 px at 390×844 and 400 px at
1280×800 (both non-integer scales of 320); cards 104 px at 390×844 (1:1) and
190 px at 1280×800 (1.827×, smears); attempts screen at 1280×800 clips the top
65 CSS px = top 52 master px of the lifter.

## 3. Production frame list

`production-frame-list.csv`: 94 rows, 20 sheets — `idle` 4; `squat`,
`squat-max`, `bench`, `bench-max`, `deadlift`, `deadlift-max` 6 each (36);
`success-{lift}` and `success-{lift}-max` 4 each (24); `miss-{lift}` and
`miss-{lift}-max` 4 each (24); `cards/{lift}-{light,max}` (6). Plus scenes
`title.png` 1008×1792, `title-wide.png` 1792×1008, `platform.png` 1280×720,
`model-sheet.png`. Each row carries a key beat. Per-lift outcome sheets are a
`sheets.ts` table change at integration (presentation only).

## 4. What was actually created vs merely specified

**Actually created (files exist, were run or viewed in this run):**

- Nine documents (`README`, `CONCEPT_REPORT`, `MODEL_SHEET`, `POSES`,
  `EFFORT_CONTRAST`, `CARDS_AND_TITLE`, `PIXEL_RULES`, `PRODUCTION_SPEC`,
  `reference-ai/README`).
- Palette files: JSON, GPL, swatch PNG.
- Seven template/diagram PNGs: lattice guide, proportion guide, three card
  composition box diagrams, two title safe-zone diagrams. These are guides and
  labelled boxes. **They are not sprites and are not meant to look like art.**
- Five AI-generated concept references, banner-stamped "AI-GENERATED CONCEPT
  REFERENCE · NOT PRODUCTION ART · DO NOT TRACE", 256-colour quantised, with a
  per-image list of what is wrong in each (`reference-ai/README.md`).
- Three rerunnable tools. `validate_package.py` was run against the live
  `arcade/public/sprites/`: it correctly fails it (old palette; shared outcome
  sheets) and passes its lattice check (the live package really is a 2×
  lattice). `preview_harness.py` was run against the live package (60 sheets,
  written to `/tmp`, one inspected). `make_concept_artifacts.py` produced every
  file in `palette/`, `templates/`, `reference-ai/`.
- One measured baseline screenshot of the live desktop clip.
- Runtime measurements listed in §2.

**Merely specified (no pixel of it exists):**

- The model sheet page itself, every one of the 88 stage frames, the 6 cards,
  the title masters, the platform backdrop. All pose coordinates in `POSES.md`
  are untested by drawing; expect the artist to move them ±10 % once a real
  frame exists.
- The face. `MODEL_SHEET.md` §3 is a pixel-row recipe, but no one has drawn it
  and checked that it is *one specific man* at 160 and at 52.
- The Cursor-side integration changes (`sheets.ts` outcome table, integer card
  scaling, stage clip fix, title media query). Listed, not made.

**Not done, deliberately:** no procedural or generated pixels were placed under
any path the game loads, in `art-source/`, or anywhere presented as art. No
text description here is being passed off as finished pixel art.

## 5. Honest judgment — can this draft reach the SNES/Genesis sports-game bar?

The brief cannot reach the bar; only an artist's hands can. The question is
whether the brief is sufficient and pointed the right way.

**What it fixes at the root.** Every ISSUES_REMAIN finding in the audit maps to
a geometric or checkable rule here, not to a decorative one: clustered bodies →
plane shading, cluster minimums, hue-shifted ramps (`PIXEL_RULES.md`); unreadable
cards → separately composed crops with a 10 px head and edge-cropped bar at 52
lattice, plus the finding that desktop cards smear at 1.827× regardless of art;
bench identity → a lying head specified as a rotated head with explicit
placement and a near-plate overlap rule; shared miss sheet → 48 per-lift,
per-effort outcome frames and a validator that refuses shared sheets; desktop
clip → measured, drawn on the template, head-top anchored under it; weak
deadlift lockout → six torso angles, a straight bar path, and a silhouette-delta
gate; "does not animate heavier" → seven channels, three of them animation, not
plate colour.

**Where it is genuinely uncertain.**

1. *Scale choice.* A 126 px lifter on a 160 lattice is Super Punch-Out!!
   opponent scale, larger than most SNES/Genesis sports sprites. It suits a
   single-lifter stage and the existing 320 runtime contract, but an artist
   used to 32–64 px sprites needs to be comfortable at that density. The A/B
   reference set should be chosen at matching scale.
2. *Runtime scaling.* Even perfect pixel art is shown at 0.853× / 1.25× on the
   stage and 1.827× on desktop cards. A fair craft A/B needs Cursor's integer
   scaling fix first, or QA must judge the 320/104 exports directly and treat
   on-screen smear as a layout defect.
3. *52-lattice cards are marginal by nature.* The crop strategy is the right
   call and the diagrams are concrete, but no card has been drawn. If the squat
   card cannot identify the lift in one second when drawn, the honest next move
   is the larger card layout (option B in the asset manifest), not more effort
   on the 52 grid.
4. *Untested coordinates.* Pose tables are first-principles numbers from the
   proportion model, not from drawing. They are starting points.
5. *AI references are a liability if misused.* Three of five contain anatomical
   errors (documented). Their value is camera and mood; their risk is that
   someone treats them as the design. The banner and README mitigate; they do
   not eliminate the risk.
6. *Volume.* 94 art files is a real commission. The gating suggestion (model
   sheet + squat light 6 + squat light card first) is what makes the risk
   bounded.

**Judgment:** the direction is right and the brief is specific enough that a
competent 16-bit sports-sprite artist could reach the bar working from it. It is
*not* evidence that the bar will be reached, and nothing in this package should
be shown to QA as art.

## 6. Recommendation

**PROCEED — to a human pixel artist, using this brief, gated.**

- Gate 1 (paid sample, per `STATE.json` sourcing): model sheet page + squat
  light frames 1–6 + squat light card, delivered in the `PRODUCTION_SPEC.md`
  layout, run through `validate_package.py` and `preview_harness.py`, owner
  visual review. If the card fails the one-second test at 104 px, switch to
  the larger-card layout plan before drawing more cards.
- Gate 2: bench and deadlift light sheets + cards; bench-lying-head and
  deadlift-lockout checks at 273 px.
- Gate 3: max sheets (seven channels), outcome sheets, scenes.
- Then Cursor integration (out of scope here), then Independent QA on the
  integrated SHA against the acceptance checklist.

Do **not** run another internal generator or draw-then-index sprint expecting a
craft PASS; the audit already established that ceiling and this package does
not reopen it.

## 7. Checks performed in this run

- Read: audit report, internal sprint brief, artist brief, asset manifest,
  acceptance checklist, `STATE.json`, `arcade/README.md`, `CURSOR_QA.md`,
  `EVIDENCE.md`, `PROVENANCE.md`, `palette.json`, `frame-index.csv`,
  `sheets.ts`, `SpriteStage.tsx`, `styles.css`, `check_sprites.py`,
  GDD §7.1 and §12 table, VISION "visual identity must communicate weight".
- Inspected: PR #70 contact sheets (320 heroes, 104 cards, light vs max,
  deadlift max strip), model sheet, live miss/success sheets, title-wide,
  browser captures at 390×844 and 1280×800.
- Ran: `npm install`, `npm test` (53/53 + sprite QA) before and after adding
  the folder, `npm run build`, Vite dev server + Playwright measurements of
  card/stage/title geometry at both viewports, all three tools.
- Not done: no human playtest, no craft A/B against real 16-bit sprites (no
  sprite exists to compare), no artist review of the coordinates.

## 8. Alignment note (AGENTS.md classification)

**Aligns with constraints.** VISION "The visual identity must communicate
weight"; GDD §7.1 (16-bit base style, weight must animate), §12.2 bar and
§12.3 refusal conditions; CLAUDE.md hard constraints untouched (no fatigue bar
introduced; no gameplay change). The 160-lattice/320-export choice keeps the
GDD §7.1 "fixed internal resolution, nearest-neighbour" rule; the non-integer
runtime scaling is flagged as a violation of that rule to fix at integration.
No change to `VISION.md` or `docs/GDD.md` is proposed.
