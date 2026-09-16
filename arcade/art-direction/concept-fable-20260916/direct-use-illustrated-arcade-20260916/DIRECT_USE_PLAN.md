# Fable Direct-Use Illustrated Arcade — feasibility plan (2026-09-16)

**PLAN ONLY · DO_NOT_MERGE · nothing under `arcade/src/` or `arcade/public/` was changed.**
Not visual approval. Not production-ready. The five Fable concept files are the visual source of truth
and are unaltered on disk. What the browser paints from them is resampled and tinted (§1), and the
captures in `mockups/shots/` are labelled derivatives kept as evidence, exactly like `arcade/evidence/`.

## 0. Verdict

```
ARCADE VISUAL LANE: BLOCKED (recorded state)
```

- **Can the format preserve the Fable concept's quality?** Partially. The pixels shown are the files'
  own pixels; identity, plates, bar bow, strain face and chalk survive because nothing is redrawn. But
  every screen except the desktop title renders at a non-integer scale through bilinear filtering, the
  phone timing stage must choose between a large lifter with the plates cropped off or the whole load in
  frame at about 0.62×, and the bench still is small on phones. Independent critics graded the first
  mockup pass **partial**; the defects they could verify are fixed in the second pass or recorded in §6.
- **Does it keep the existing gameplay loop?** Yes, with caveats. `machine.ts`, `timing.ts`, `math/*`
  and every existing `feel.ts` value stay byte-identical; the mock reproduces the real cue centres,
  windows and lane geometry. The caveats are presentation code the build must touch (§5) and one
  proposal, the camera-timing proxy, that must stay pinned to the graded cue centres (§3.4).
- **Are full animated sprite sheets mandatory?** Under the repository's governing documents as
  written, **yes**. GDD §7.1 ("enough frames for weighty bar-path animation", "a maximal squat must not
  animate like a light one"), the GDD §12.2 sprite row ("does a maximal attempt animate heavier") and
  VISION.md ("bar speed, sticking points … not permission for weightless animation"; "bar path,
  animation … must make a maximal attempt feel heavier") all require animated lifter frames, and nothing
  carves the arcade edition out. AGENTS.md ranks VISION above the GDD and forbids rewriting either to
  fit a feature unless the owner authorises the governing change.
- Per the owner's instruction, the lane is therefore **recorded as blocked** and no substitute art is
  made. Opening it takes three explicit owner decisions, none of which this plan can make:
  1. amend GDD §7.1 **and** the §12.2 "Lifter sprites & animation" row for the arcade edition (§8);
  2. resolve the VISION.md conflict on weight and animation (§8);
  3. rescind PR #71's "NOT PRODUCTION ART · DO NOT TRACE · not Reed Hale's face" rules for these five
     files and clear provenance, provider terms and likeness (§9).

| Field | Value |
| --- | --- |
| requested_model | `claude-fable-5-1` |
| branch | `claude/fable-visual-feasibility-e0qo5i`, stacked on PR #71 head `e9916eef` |
| source of truth | `arcade/art-direction/concept-fable-20260916/reference-ai/` (five stamped PNGs, unaltered) |
| prior evidence, treated as final | `../feasibility-fable-20260916/CAPABILITY_REPORT.md` (`FABLE_PRESERVATION_FAILED` for raster conversion) |
| PRs #69–#72 | untouched; nothing merged |
| gameplay, judging, timing, scoring, `feel.ts` | untouched |
| Gamma credits | none spent |
| passes run | none of sprite-generation, matte, procedural, lattice or conversion; only CSS composition of the files |
| artefacts | `mockups/index.html`, `mockups/shoot.mjs`, `mockups/shots/*.png` (21 captures, 390×844 @2× and 1280×800 @1×, each carrying a "MOCKUP · NOT PRODUCTION ART" label) |

## 1. What "direct use" means in this plan

1. **Files, not derivatives, on disk.** Every screen references one of the five files as it exists at
   `e9916eef`. A build locks this with a sha256 test on the five files (and on the byte-identical
   copies it must place under `arcade/public/`, because `reference-ai/README.md` forbids the game from
   loading anything under `art-direction/`).
2. **Camera, not crop.** A screen shows a *source region* (x, y, w, h in file pixels) inside a viewport
   box: one uniform scale, one translation, and a clip to the region. The stamp banner (rows 0–33), the
   hallucinated title copy (`PRESS START`, `© 1994 IRONWROUGHT GAMES`, rows ≥ 645) and the seam between
   the two panels of a two-panel file (columns 636–644) are outside every region. The harness asserts
   `y ≥ 34` for all regions and `y + h ≤ 640` for the title regions at load time; a build must keep an
   equivalent test. Critics confirmed none of the 21 captures shows banner, copy, seam or sheet labels.
3. **Rendering is not lossless.** Any non-integer scale is bilinear-filtered by the browser; ambient
   backdrops are dimmed and desaturated; the spotlight is a screen-blend overlay and the strain vignette
   a red radial. Only the desktop title (1.00×) is pixel-exact. This is a stated deviation from GDD §7.1's
   "nearest-neighbor scaling throughout" (§8).
4. **Scale bounds actually used** (source px → CSS px; the harness records them):

   | Screen | Phone 390×844 | Desktop 1280×800 |
   | --- | --- | --- |
   | title | 1.25× (tall column) | 1.00× (whole art, nearest-neighbour) |
   | ambient backdrop (lift select, results): title file, dimmed | 1.25× | 1.00× |
   | lift tiles squat / bench / deadlift | 0.38× / 0.26× / 0.31× | 0.73× / 0.51× / 0.60× |
   | results face stamp | 0.59× | 0.59× |
   | timing, "load" policy (default): squat / deadlift / bench | 0.62× / 0.61× / 0.39× | 1.00–1.06× in a fixed 636×720 box (bench 1.00×) |
   | timing, "lifter" policy (rejected, kept for comparison) | 1.13–1.15× | — |

5. **Overlays are CSS, attached to the picture box** so they never paint empty margins.
6. **Motion is transform and opacity.** Camera moves animate the region; the deadlift pose change is a
   hard cut. `prefers-reduced-motion` removes camera motion and keeps the cut.
7. **No new figures.** Where a pose does not exist in the five files, the plan says so (§4) and uses
   camera, lighting and copy instead.

## 2. Inventory of the five files

The repository copies are 256-colour quantised, banner-stamped derivatives of the run's originals
(`tools/make_concept_artifacts.py`: `convert('RGB')` then `quantize(256)`, banner pasted at row 34).
The originals, if the owner still has them, differ by colour depth as well as by the 34 banner rows.

| File | Usable content | Regions (file px: x, y, w, h) | Excluded by region |
| --- | --- | --- | --- |
| `AI-REF-05-TITLE-SCREEN.png` 1280×754 | logo lockup, three judge lights (housings ≈ rows 305–355), Reed from behind walking to the platform, lamps, crowd, platform | wide `0,34,1280,606`; tall `400,288,480,352` | banner; rows ≥ 640 (hallucinated copy); on phones the lockup and sub-line |
| `AI-REF-04-SQUAT-HOLE-LIGHT-VS-MAX.png` 1280×754 | hole, light (1 red + 1 blue per side, calm, straight bar) and max (4 red, bowed bar, flushed strain, chalk) | light: wide `0,34,636,720`, load `10,150,616,500`, lifter `110,130,420,540`; max: wide `644,34,636,720`, load `644,140,636,510`, lifter `745,120,430,550`; tile `150,190,330,330` | banner; seam |
| `AI-REF-03-DEADLIFT-SETUP-LOCKOUT-MAX.png` 1280×754 | setup (hips high, chalk) and lockout (chin up, flushed); panels drawn at different scales | setup: wide `0,34,636,720`, load `0,170,636,480`; lockout: wide `644,34,636,720`, load `644,40,636,690`; tile `800,70,400,400` | banner; seam |
| `AI-REF-02-BENCH-THREE-QUARTER.png` 1024×1058 | one bench still from the lifter's right, elevated; `reference-ai/README.md` marks the hand placement anatomically wrong | wide `0,34,1024,1024`, load `20,150,990,800`; tile `240,230,470,470` | banner |
| `AI-REF-01-MODEL-SHEET.png` 1280×754 | four body views; six expression stamps in the right column | faces `1032,{40,150,266,376,486,596},150,108` | banner; body views; the FRONT/3/4/SIDE/BACK labels |

The faces differ between files (hair drifts grey in the bench still and warmer in the deadlift lockout,
as the README notes). Side by side on the lift-select screen they read as three related but not identical
men; §9 treats each as a separate likeness check.

## 3. Screen designs

### 3.1 Title screen

- **Wide (≥ 860 px):** the whole art region at 1.00×, top-anchored, nearest-neighbour. The file's own
  lockup and sub-line are the title; the runtime adds only the lede, three lights and the button. The
  copy band begins at CSS row 600, above the excluded rows. This departs from `CARDS_AND_TITLE.md` §3.1
  ("the runtime supplies all copy") and from the current app, which always renders an `<h1>`.
- **Tall (phones):** the tall column at ≤ 1.25×: lights, Reed's back, platform edge and steps. The runtime
  kicker and H1 supply the title; the lockup is not shown, so the concept's identity mark is absent on
  phones. Reed's boots are cut at row 640 because the hallucinated copy starts at 650, and a dark band
  of about 100 CSS px sits between the art and the copy block.
- **Motion:** 12 s ease-in-out push-in 1.00 → 1.06 centred on Reed's shoulders, looping; ±4 % lamp
  flicker overlay; on the button press the three DOM lights bloom, and a masked white overlay blooms the
  in-image housings (centres ≈ `545,330`, `640,330`, `735,330` file px, r ≈ 26; verify against the file).
- **Evidence:** `shots/desktop-title.png`, `shots/phone-title.png`.

### 3.2 Lift selection

- One hero tile per lift from the tile regions: 124 px on phones (0.26–0.38×), 240 px on desktop
  (0.51–0.73×). Existing `LIFT_COPY` under each tile. The current light/max thumbnail pair is dropped
  (only the squat file has both); effort is shown on the stage.
- Backdrop: the title file's art, dimmed, at 1.00× (desktop) or 1.25× (phone). The lockup shows faintly
  behind "Choose a lift" on desktop.
- The bench tile starts just under the head top and foregrounds the still with the wrong hand placement.
- **Motion:** on hover/focus the tile camera nudges 4 % toward the face over 220 ms.
- **Evidence:** `shots/phone-lift.png`, `shots/desktop-lift.png`. Critics rated the one-second lift read
  as passing on both viewports; the bench tile is the weakest.

### 3.3 Results card

- The federation sheet (`ResultsCard.tsx`) and the shared PNG (`share.ts`) stay **face-free** so the
  GDD §12.2 "Result card" bar (would a competitive lifter believe it is real?) is not touched, and
  `ShareDrawContext` keeps its `fillRect / fillText / measureText` shape.
- A 64 px expression stamp (GRIN for a made meet, EXHALE for a made meet with a missed third, SLACK for
  a bomb-out; 0.59×) sits in the app chrome beside the heading, not on the sheet. It is gated on the
  owner's face decision in §9; without it the screen is the current one over the new backdrop.
- Backdrop: the title file, dimmed. Motion: the sheet slides up 24 px over 320 ms; the lights bloom in
  sequence (`HAPTIC_MS.whiteLights` already exists for the haptic).
- **Evidence:** `shots/phone-results.png`, `shots/phone-results-bomb.png`, desktop equivalents.

### 3.4 Gameplay / timing screen (the polished one)

**Layout.** Phones keep the current stack. Desktop becomes two columns: a fixed picture box (the lift's
wide region at 1.00×, 636×720 for the two-panel files) beside the HUD, lane, button and hint.

**Phone camera policy: "load", not "lifter".** The first mockup pass held the lifter large at 1.15×
and cropped both plate stacks to slivers on every keyframe; the critics rejected it because plate count
and colour are the concept's most legible weight channel. The second pass contains the full bar span
(`load` regions) at about 0.62× (bench 0.39×): plates, bar bow, face and chalk are all in frame during
the graded windows, the lifter is smaller, and dark bands remain above and below. Both policies are
captured (`phone-timing-squat-max-p0.55.png` vs `…-cam-lifter.png`); the plan recommends "load".

**Camera keyframes.** Breakpoints are the real cue centres from `cuesForLift()` (squat 0.42/0.78, bench
0.40/0.76, deadlift 0.28/0.80), never a third hand-copied set. Desktop: the box is fixed and the hold
is a 1.06× cover push-in inside it, so the frame never contracts; phone: contain the wide region, then
the load region.

| Lift | p range | Region | Meaning |
| --- | --- | --- | --- |
| squat | 0 → 0.42 | wide → load | descend: the camera settles as the DEPTH window approaches |
| squat | 0.42 → 0.58 | load | the hole; on max a ±2 px micro-shake of the box |
| squat | 0.58 → 1 | load → wide | drive |
| bench | 0 → 0.40 / 0.40 → 0.55 / 0.55 → 1 | wide → load / load / load → wide | lower, pause, press |
| deadlift | 0 → 0.28 → 0.80 | setup wide → setup load, hold | approach, pull |
| deadlift | 0.80 | **hard cut** to lockout load | the LOCKOUT cue: the only real pose change the files allow; a cut because the two panels differ in scale |

**Lighting.** Spotlight 0.35 → 0.70 with progress to the first cue; strain vignette on max only,
0.25 → 0.75; judge lights off during timing, then the outcome. Effort selection stays `visualEffort()`
(`weight / e1RM ≥ VISUAL.MAX_LOAD_RATIO`), a presentation threshold.

**Camera-timing proxy, not a bar-speed cue.** The real fatigue cues in the loop are the copy from
`fatigue.ts` and the shrinking amber window; they are unchanged. A build may let hidden fatigue stretch
the camera's approach easing, but the arrival at the hold stays pinned to the cue centre so the camera
can never disagree with the band `TimingLane` grades against. The harness uses a linear interpolation
at fatigue 0 and demonstrates none of this; it is a proposal, playtest-owned. All new values (spotlight
and strain ranges, shake, push-in, tile nudge, sheet slide, easing) go into one `CAMERA` block in
`feel.ts`, untuned; no existing `FEEL` value changes.

**Outcome states.** No success or miss pose exists. Success: camera to wide, three white DOM lights
bloom, existing "Good lift" copy. Miss: camera holds, strain fades to grey, red lights, "No lift".
Bomb-out: the max panel dimmed. The small expression stamp appears only if the §9 face decision allows
it; the earlier idea of a larger once-per-session stamp is **dropped** (it would be a GDD §7.2 cut-in in
function without the tap-to-dismiss and scarcity rules).

**Walkout, attempts, transition.** Walkout: the title file's tall column (Reed walking out) with the
existing lift-specific copy. Attempts: the chosen lift's wide region, dimmed. Transition: the same with
the spotlight dimmed.

**Evidence:** `shots/*-timing-squat-light-p0.10.png` (descend), `…p0.42.png` (DEPTH window),
`…-timing-squat-max-p0.55.png` (max hold with strain), `…-timing-bench-light-p0.40.png` (pause),
`…-timing-deadlift-max-p0.28.png` (pull), `…-timing-deadlift-max-p0.85.png` (after the cut). HUD weights
in the captures are consistent with `visualEffort()` at the default e1RMs.

## 4. Coverage matrix

| State | Squat | Bench | Deadlift |
| --- | --- | --- | --- |
| walkout / setup with bar | absent → title back-view + copy | absent → same | present (setup panel) |
| descend / lower / pull | camera only (hole still) | camera only | camera only on setup |
| hole / pause / sticking | **present** (light and max) | camera hold on the one still | camera hold |
| drive / press / lockout | camera only | camera only | **present** (lockout panel, cut) |
| light vs max | **present** (plates, bar bow, face, chalk) | lighting only (one still, light plates) | partial (setup reads light, lockout reads max) |
| success / miss | absent → lights, camera, copy (+ stamp if allowed) | absent → same | absent → same |
| lift tile | present | present (weakest) | present |

## 5. Does the existing gameplay loop survive unchanged?

Yes. `loop/machine.ts`, `loop/timing.ts`, `math/*` and every existing `FEEL` value are untouched; none
imports a sprite. The mock reproduces `cuesForLift()`, `FEEL.WINDOW_MS`, `laneWindowPercent()` and
`VISUAL.MAX_LOAD_RATIO` exactly. What a build touches, corrected after the critics' review:

| Today | Under this plan | Gameplay? |
| --- | --- | --- |
| `SpriteStage.tsx` picks a frame by `progress` | `IllustratedStage.tsx` picks a camera region by the same `progress` and effort, from cue centres | no |
| `sprites/sheets.ts` | `scenes.ts`: the five files, regions, `visualEffort` unchanged | no |
| `ArcadeApp.tsx` | stage JSX for attempts and timing screens, title markup (H1 only on narrow), button bloom delay | no |
| `styles.css` | camera box rules, two-column desktop timing, results head | no |
| `ResultsCard.tsx`, `share.ts` | unchanged (sheet and shared PNG stay face-free) | no |
| `feel.ts` | + one `CAMERA` block; existing values untouched | no |
| `package.json` test script, `sprites/sheets.test.ts`, `scripts/check_sprites.py` | `scenes.test.ts` (region bounds, title rows ≤ 640, sha256 of the five files and their `public/` copies); sprite tests and validator retired **in the same PR** as the stage switch so there is never a dual asset path (AGENTS.md) | no |
| `machine.ts`, `timing.ts`, `math/*`, judging, scoring | unchanged | — |

## 6. Quality evidence and remaining defects

Second-pass captures are in `mockups/shots/`; scales are in §1.4. Fixed after the critics' first-pass
review: plates cropped on phone (load policy); desktop backdrops at 2.01× (now the title file at 1.00×);
desktop "push-in" that only contracted the box (now a fixed box with a 1.06× push-in and overlays on the
box); face stamp on the federation sheet (moved into the chrome); HUD weights inconsistent with
`visualEffort()`; missing mockup label; region bounds unasserted (now asserted at load).

Still true and recorded, not fixed:

- Non-integer, bilinear rendering everywhere except the desktop title; pixel texture softens at 0.26–0.73×
  on tiles and at 0.39–0.62× on phone timing.
- Phone timing shows the lifter at about 0.62× with dark bands; the bench still is 0.39× on phones.
- Phone title cuts the boots at row 640 and drops the lockup; a dark band separates art and copy.
- The bench timing screen and tile foreground a still whose hand placement the concept's own README
  calls wrong; as composed it cannot pass VISION's "credible to lifters".
- Camera motion is subtle by construction (1.00–1.06× on desktop, 0.61–0.63× on phone); lighting and
  the lane carry more of the effort read than the camera does. Whether that reads as heavy is playtest-only.
- The Google Fonts link did not resolve inside the sandbox (egress proxy), so every capture uses a
  fallback sans; the real app loads Barlow Condensed / IBM Plex Sans / Source Serif 4.

## 7. Independent critique

Four fresh, read-only critics (quality preservation; loop preservation; GDD/VISION conformance; rights
and exposure) and a judge graded the first mockup pass and the draft plan, viewing every capture and
reference file, the arcade source, and the governing documents. Judge verdict: **quality partial; loop
preserved with caveats; sprite sheets mandatory under current documents; lane blocked.**

Their ranked defects and what happened to each:

| # | Finding | Status |
| --- | --- | --- |
| 1 | Phone timing cropped the plate stacks to slivers at every keyframe | fixed (load policy), comparison capture kept |
| 2 | Governing-document conflict understated: VISION mislabelled "partially met"; §12.2 row left uncovered; nearest-neighbour rule violated; draft amendment presumed "approved" files and dropped the craft A/B | corrected in §8 |
| 3 | "Byte-for-byte, no derivatives / without loss" false for what is rendered and for the captures | retracted; §1.3, header, labelled captures |
| 4 | Desktop backdrops at 2.01× bilinear with the H2 over the strain face | fixed (title file at 1.00×) |
| 5 | Desktop "push-in" was a contracting letterbox with overlays on the margins | fixed (fixed box, 1.06×, overlays on the box) |
| 6 | Bar-speed-cue claim unproven and possibly unsafe; `feel.ts` contradiction; deadlift breakpoint drift | reframed as a pinned camera-timing proxy; `CAMERA` block; cue centres from `cuesForLift()` |
| 7 | Rights gate under-specified: provider, terms, prompt, date, PROVENANCE/RIGHTS, absent `STATE.json`, quantised masters, banner treated as croppable, three faces | expanded in §9 |
| 8 | §7.2 scarcity asserted by fiat; result-card bar unaddressed | larger stamp dropped; sheet and shared PNG face-free |
| 9 | Build-touch list undercounted; dual asset path across gates | corrected in §5 and §10 |
| 10 | Phone title boots cut, dead band, lockup dropped, bloom coordinates | recorded in §3.1 and §6; coordinates corrected |
| 11 | Bench tile crop and wrong-hands still | recorded in §3.2, §6 |
| 12 | Fallback font in captures; inconsistent HUD weights | weights fixed; font recorded |

Unverifiable by the critics with read-only tools: byte identity of the five files to `e9916eef` (the lead
verified it with git), and whether the format feels heavy (playtest only).

## 8. GDD, VISION and CLAUDE.md: the decisions the owner must make

Classification per `AGENTS.md`:

- **Conflicts with GDD §7.1** on two counts: frame animation ("enough frames for weighty bar-path
  animation", "a maximal squat must not animate like a light one") and "nearest-neighbor scaling
  throughout" (this format renders bilinear at almost every scale).
- **Conflicts with the GDD §12.2 "Lifter sprites & animation" row**, whose bar ("does a maximal attempt
  animate heavier", blind A/B against SNES/Genesis sprite craft) cannot be applied to stills.
- **Conflicts with VISION.md** "The visual identity must communicate weight" (bar speed and sticking
  points must be shown; retro style is "not permission for … weightless animation") and "The lift comes
  first" (bar path and animation must make a maximal attempt feel heavier). AGENTS.md ranks VISION above
  the GDD; a GDD edit alone cannot open the lane.
- **Conflicts with PR #71's own rules**, which the owner would be overriding: `README.md` "no
  image-generation output as production art"; `reference-ai/README.md` "do not trace, copy, downsample
  … these into sprites", "do not treat any face here as Reed Hale's face", "the live game does not load
  anything under `arcade/art-direction/`"; `CARDS_AND_TITLE.md` §3.1 "the runtime supplies all copy";
  `CONCEPT_REPORT.md` §8 "no change to VISION.md or docs/GDD.md is proposed".
- **Aligns with constraints:** GDD §2.3 (the arcade mechanic is unchanged), §7.2 (no cut-ins; the larger
  stamp was dropped), §12.2 "Result card" (the sheet and shared PNG stay face-free), §12.3 refusal
  conditions (no purchasable advantage, no gacha, no fatigue meter, no ads, no daily-engagement
  punishment, no homebrew math, no cut-in spam) and every CLAUDE.md hard constraint. The strain vignette
  is effort-driven, not a fatigue meter.
- **Vision is silent** on illustrated stills as such; it speaks only through the weight and animation
  clauses above.

**Recorded state: blocked.** If the owner opens the lane, the governing change is made in the same
commit as the first build PR and must cover all three documents, roughly:

> *GDD §7.1, arcade edition: the Iron & Amber Arcade may present each lift as illustrated stills
> composed with camera motion, lighting overlays and UI animation in place of animated sprite frames,
> rendered with smooth scaling where the scale is not an integer.*
> *GDD §12.2, "Lifter sprites & animation" row, arcade edition: the bar becomes: unaltered concept
> pixels; a max attempt that reads heavier than a light one through load, bar bow, face, chalk, camera
> timing and lighting; depth, plates and strain readable at phone scale. The blind A/B against 16-bit
> sprite craft is suspended for this edition, not deleted.*
> *VISION.md: an explicit owner statement that, for this edition, weight may be communicated without
> bar animation.*

## 9. Rights and provenance gate (owner)

Blocking independently of §8:

1. **Provenance record.** No provider, model, account, date or prompt text is recorded for
   `reference-ai/`; `STATE.json`, which the README cites, is absent from this checkout; the only
   `PROVENANCE.md` in the repo excludes AI pixels. `PRODUCTION_SPEC.md` §4 requires `PROVENANCE.md` and a
   written commercial grant (`RIGHTS.md`) for any shipped art. Purely AI-generated output may not be
   copyright-protectable, which matters most where the in-image lockup becomes the product logo.
2. **The stamp.** The red banner is the files' rights label. Cropping it by region is not the same as
   rescinding it. The owner must re-label the five files (new README, provenance record, or re-stamp)
   before they are shipped as production art.
3. **Likeness.** Three visibly different AI faces (model sheet / squat, bench, deadlift) each need a
   human likeness check, plus the six expression stamps if the §3.3 stamp is used.
4. **Masters.** The repository copies are 256-colour quantised. Pick one canonical set (originals or
   these) and commit its hashes; the regions in §2 shift by 34 rows if un-stamped originals are used.
5. **Runtime location.** The game may not load from `art-direction/`; byte-identical copies under
   `arcade/public/scenes/fable/` are covered by the same sha256 test.
6. **Hallucinated copy.** Excluded by region and by a load-time assertion in the harness; a build keeps
   the assertion as a test with the ≈10-row margin above the `PRESS START` glyphs noted.
7. **Off-repo copies.** A private claude.ai artifact from the earlier run holds banner-cropped crops of
   these files (`CAPABILITY_REPORT.md` §1.4); list it for deletion or acceptance.

## 10. Gated build plan (only if §8 and §9 are cleared)

| Gate | Scope | Proof required | Touches |
| --- | --- | --- | --- |
| 0 | owner decisions: §8 amendments (GDD §7.1, §12.2 row, VISION statement), §9 clearance, canonical masters, phone camera policy (load recommended) | written into the PR that opens Gate 1 | GDD, VISION (same commit) |
| 1 | title + lift select + results backdrop on the illustrated format; `scenes.ts` + `scenes.test.ts`; `public/scenes/fable/` copies | captures at 390×844, 1024×1366, 1280×800; sha256 and region-bounds tests green | `ArcadeApp.tsx`, `scenes.ts`, `styles.css`, `public/` |
| 2 | squat timing stage: camera keyframes from cue centres, spotlight, strain, effort split, desktop two-column; retire `public/sprites/`, `sheets.ts`, `sheets.test.ts`, `check_sprites.py` and the `package.json` test entries in this same PR | captures at p = 0.10, 0.42, 0.55, 0.78; reduced-motion capture; `npm test` green; human playtest note: does max read heavier than light? | `IllustratedStage.tsx`, `feel.ts` (`CAMERA` block only), `package.json`, `scripts/` |
| 3 | deadlift cut, bench, walkout/attempts/transition backdrops, outcome lighting; expression stamp only if §9.3 allows | captures per state | same |
| 4 | independent QA against the amended §12.2 row and VISION on the integrated SHA | QA report | — |

Every gate is presentation-only; `machine.ts`, `timing.ts`, `math/*` and the existing `FEEL` values stay
byte-identical, verified by `git diff` in each PR.

## 11. What this plan does not claim

It does not claim the format feels heavy, that a squat without a moving bar satisfies a powerlifter,
that the AI faces are usable as a character, that the bench still is credible, or that anything here is
production-ready. It shows that the four screens can be composed from the unaltered files at 0.26×–1.25×
without the pixel losses recorded in the raster-conversion report, and that doing so leaves the
gameplay loop untouched. Whether that is acceptable is the owner's call in §8 and §9; until then the
lane is blocked.

## 12. Files

| Path | What it is |
| --- | --- |
| `DIRECT_USE_PLAN.md` | this plan |
| `mockups/index.html` | composition harness: region camera with clip and load-time bounds assertion, overlays, four screens, two phone camera policies; reads `../../reference-ai/*.png` byte-for-byte |
| `mockups/shoot.mjs` | Playwright screenshot script (21 captures, two viewports) |
| `mockups/shots/` | labelled captures graded in §7; derivatives for evidence only, never assets |
