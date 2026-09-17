# TWL development analysis — ext-3x3-4522ff42

**Overall:** 🟡 REVIEW · human approval required: **yes** · generated 2026-09-17T23:34:25.464Z

| Layer | SHA |
|---|---|
| Artifact under judgment (target) | `4522ff42a2eaa705c8036c52c8907288e7fe5ae7` |
| Presentation reference | `1151569c40c77485ab9e9299e5db0db022437a8a` |
| Mechanics authority | `288db32c06232bb0fb65ce7236a0614c698a6920` |
| Served page declares | `288db32c06232bb0fb65ce7236a0614c698a6920` at http://127.0.0.1:42585 |
| Provider | twl-development-analysis 0.1.0 (deterministic-rules, node v22.22.2, playwright 1.56.1, browser 141.0.7390.37) |

## Decisions

| Analyzer | Verdict | Confidence | Flags | Key metrics | Human approval |
|---|---|---|---|---|---|
| `source-identity` | ✅ PASS | 0.99 | – | targetSha=4522ff42a2eaa705c8036c52c8907288e7fe5ae7, spriteFilesChangedVsReference=0, npmCiExit=0, buildExit=0 | no |
| `served-identity` | ✅ PASS | 0.98 | – | servedUrl=http://127.0.0.1:42585, servedScriptSha256=b538467d1044fea474493d3db9c2c4422454a701fc405c0f037ec15883238b3f, freshBuildScriptSha256=b538467d1044fea474493d3db9c2c4422454a701fc405c0f037ec15883238b3f, servedSpritesChecked=52, servedSpritesDifferFromWorktree=0, servedSpritesDifferFromReference=0 | no |
| `existing-tests` | ✅ PASS | 0.95 | – | exit:npm test=0 | no |
| `mechanics-frame-parity` | ✅ PASS | 0.97 | – | tracesCompared=18, framesCompared=4140, frameMismatchFraction=0, framesComparedExcludingLeakedTraces=4140, frameMismatchFractionExcludingLeakedTraces=0, numericMismatchFraction=0 | no |
| `sprite-grounding` | ✅ PASS | 0.90 | – | anchorRowsChecked=48, anchorRowsMismatched=0, framesWithFringe=0, framesOver48Colors=0, stageBeats=128, beatsWithoutSpriteStage=0 | yes |
| `design-intent` | 🟡 REVIEW | 0.80 | `DISPLAY_FONT_NOT_LOADED:phone` `DESKTOP_GUTTERS_WIDE` `CANDIDATE_BANNER_RENDERED` `PAGE_ERRORS` | beats=138, depthGaugeSightings=0, timingLaneSightings=0, illustratedStillSightings=0, twoTapPromptSightings=0, beatsWithHorizontalOverflow=0 | yes |
| `preview-regression` | 🟡 REVIEW | 0.75 | `EVIDENCE_PIXEL_DRIFT:title-390` `EVIDENCE_PIXEL_DRIFT:select-390` `TITLE_DRIFT_VS_REFERENCE:phone` | committedPairsCompared=10, committedStructuralDrift=0, committedPixelDrift=2, committedFreshMissing=0, referenceSha=1151569c40c77485ab9e9299e5db0db022437a8a, tokenDriftVsReference=none | yes |
| `document-contract-conflict` | 🟡 REVIEW | 0.99 | `DOCUMENT_CONTRACT_CONFLICT` `IRON_AMBER_DOC_ABSENT_AT_TARGET` | brief=preserve the real Session A career-mode mechanics / use the career-mode sprite athlete / present it inside the Iron & Amber visual system / keep the athlete grounded on the platform / use responsive full-stage composition / use nearest-neighbor rendering / reject raw centered sprite tiles, giant gutters, floating athletes, still-image animation, and two-tap timing demos | yes |
| `flow` | ⚪ ABSTAIN | 0.00 | `NOT_IMPLEMENTED` | plannedMeasurements=screen graph coverage, dead ends, return paths, time-to-first-input | yes |
| `balance` | ⚪ ABSTAIN | 0.00 | `NOT_IMPLEMENTED` | plannedMeasurements=make/miss rates per lift and load ratio across seeds, opener suggestions vs e1RM | yes |
| `input-fairness` | ⚪ ABSTAIN | 0.00 | `NOT_IMPLEMENTED` | plannedMeasurements=cue window widths vs fatigue, press/hold latency budget, keyboard vs pointer parity | yes |
| `progression` | ⚪ ABSTAIN | 0.00 | `NOT_IMPLEMENTED` | plannedMeasurements=e1RM and streak deltas per outcome, server-authoritative boundary checks | yes |
| `playtest` | ⚪ ABSTAIN | 0.00 | `NOT_IMPLEMENTED` `HUMAN_PLAYTEST_REQUIRED` | plannedMeasurements=feel, pacing, tension; cannot be established by tooling | yes |

## Details

### source-identity — ✅ PASS (confidence 0.99)

Mechanics files match both the pinned hashes and the authority commit; sprite art is unchanged from the reference.


| Metric | Value |
|---|---|
| targetSha | 4522ff42a2eaa705c8036c52c8907288e7fe5ae7 |
| authority.src/game/lift.ts | 4dc74947ffc64f1af36da92c01a7cfb53d3f021b802cba31f67c3ecdcb24e417 |
| authority.src/game/liftTuning.ts | ef920d59eecdb5ac698f7515a1efe4af1c7ee0e38f9079f7f9cd6deace441f2a |
| target.arcade/src/game/lift.ts | 4dc74947ffc64f1af36da92c01a7cfb53d3f021b802cba31f67c3ecdcb24e417 |
| target.arcade/src/game/liftTuning.ts | ef920d59eecdb5ac698f7515a1efe4af1c7ee0e38f9079f7f9cd6deace441f2a |
| target.arcade/src/feel.ts | b26c21b520d17a8e87e6abac17661fc219870a2320a376b5b1b1adfe0bc2425c |
| edition.MECHANICS_SHA | 288db32c06232bb0fb65ce7236a0614c698a6920 |
| edition.BASE_SHA | 1151569c40c77485ab9e9299e5db0db022437a8a |
| edition.PREVIEW_BUILD | sprite-sport-20260917 |
| edition.PRODUCTION_READY | false |
| spriteFilesChangedVsReference | 0 |
| npmCiExit | 0 |
| buildExit | 0 |

Evidence:

- git: `288db32c06232bb0fb65ce7236a0614c698a6920:src/game/lift.ts` (sha256 4dc74947ffc6)
- git: `288db32c06232bb0fb65ce7236a0614c698a6920:src/game/liftTuning.ts` (sha256 ef920d59eecd)
- file: `arcade/src/game/lift.ts` (sha256 4dc74947ffc6)
- file: `arcade/src/game/liftTuning.ts` (sha256 ef920d59eecd)
- file: `arcade/src/feel.ts` (sha256 b26c21b520d1)
- file: `arcade/src/sprites/edition.ts`
- git: `diff 1151569c40c77485ab9e9299e5db0db022437a8a..4522ff42a2eaa705c8036c52c8907288e7fe5ae7 -- arcade/public/sprites`

### served-identity — ✅ PASS (confidence 0.98)

The served page is this run's fresh build and every screen declares the configured mechanics and base SHAs.


| Metric | Value |
|---|---|
| servedUrl | http://127.0.0.1:42585 |
| servedScriptSha256 | b538467d1044fea474493d3db9c2c4422454a701fc405c0f037ec15883238b3f |
| freshBuildScriptSha256 | b538467d1044fea474493d3db9c2c4422454a701fc405c0f037ec15883238b3f |
| servedSpritesChecked | 52 |
| servedSpritesDifferFromWorktree | 0 |
| servedSpritesDifferFromReference | 0 |
| beats | 138 |
| beatsMissingServedSha | 0 |
| beatsWithMismatchedServedSha | 0 |
| beatsWithWrongVisualShell | 0 |
| previewBuild | sprite-sport-20260917 |

Evidence:

- url: `http://127.0.0.1:42585` (sha256 fa9881467745) — index.html

### existing-tests — ✅ PASS (confidence 0.95)

The target's node tests, sprite QA and vitest parity suite all exited 0 in this run.


| Metric | Value |
|---|---|
| exit:npm test | 0 |

Evidence:

- command: `npm test` — exit 0 in 4310 ms

### mechanics-frame-parity — ✅ PASS (confidence 0.97)

Rendered frames, phases, prompts and commands match the frozen mechanics frame for frame under an identical input schedule.


| Metric | Value |
|---|---|
| phone-squat-a1.samples | 155 |
| phone-squat-a1.heldBeforeFirstInput | false |
| phone-squat-a1.firstPressFrame | 29 |
| phone-squat-a1.firstMotionFrame | 29 |
| phone-squat-a1.browserPhasePath | BRACE>DESCENT>HOLE>ASCENT>LOCKOUT |
| phone-squat-a1.probePhasePath | BRACE>DESCENT>HOLE>ASCENT>LOCKOUT |
| phone-squat-a1.browserEnd | judging |
| phone-squat-a1.probeEnd | judging |
| phone-squat-a1.inputPlanMatch | true |
| phone-squat-a1.frameMismatchFraction | 0 |
| phone-squat-a1.numericMismatchFraction | 0 |
| phone-squat-a1.laggedFraction | 0 |
| phone-squat-a2.samples | 167 |
| phone-squat-a2.heldBeforeFirstInput | false |
| phone-squat-a2.firstPressFrame | 31 |
| phone-squat-a2.firstMotionFrame | 31 |
| phone-squat-a2.browserPhasePath | BRACE>DESCENT>HOLE>ASCENT>LOCKOUT |
| phone-squat-a2.probePhasePath | BRACE>DESCENT>HOLE>ASCENT>LOCKOUT |
| phone-squat-a2.browserEnd | judging |
| phone-squat-a2.probeEnd | judging |
| phone-squat-a2.inputPlanMatch | true |
| phone-squat-a2.frameMismatchFraction | 0 |
| phone-squat-a2.numericMismatchFraction | 0 |
| phone-squat-a2.laggedFraction | 0 |
| phone-squat-a3.samples | 180 |
| phone-squat-a3.heldBeforeFirstInput | false |
| phone-squat-a3.firstPressFrame | 32 |
| phone-squat-a3.firstMotionFrame | 32 |
| phone-squat-a3.browserPhasePath | BRACE>DESCENT>HOLE>ASCENT>LOCKOUT |
| phone-squat-a3.probePhasePath | BRACE>DESCENT>HOLE>ASCENT>LOCKOUT |
| phone-squat-a3.browserEnd | judging |
| phone-squat-a3.probeEnd | judging |
| phone-squat-a3.inputPlanMatch | true |
| phone-squat-a3.frameMismatchFraction | 0 |
| phone-squat-a3.numericMismatchFraction | 0 |
| phone-squat-a3.laggedFraction | 0 |
| phone-bench-a1.samples | 242 |
| phone-bench-a1.heldBeforeFirstInput | false |
| phone-bench-a1.firstPressFrame | 21 |
| phone-bench-a1.firstMotionFrame | 21 |
| phone-bench-a1.browserPhasePath | BRACE>DESCENT>HOLE>ASCENT>LOCKOUT |
| phone-bench-a1.probePhasePath | BRACE>DESCENT>HOLE>ASCENT>LOCKOUT |
| phone-bench-a1.browserEnd | judging |
| phone-bench-a1.probeEnd | judging |
| phone-bench-a1.inputPlanMatch | true |
| phone-bench-a1.frameMismatchFraction | 0 |
| phone-bench-a1.numericMismatchFraction | 0 |
| phone-bench-a1.laggedFraction | 0 |
| phone-bench-a2.samples | 345 |
| phone-bench-a2.heldBeforeFirstInput | false |
| phone-bench-a2.firstPressFrame | 23 |
| phone-bench-a2.firstMotionFrame | 23 |
| phone-bench-a2.browserPhasePath | BRACE>DESCENT>HOLE>ASCENT>LOCKOUT |
| phone-bench-a2.probePhasePath | BRACE>DESCENT>HOLE>ASCENT>LOCKOUT |
| phone-bench-a2.browserEnd | judging |
| phone-bench-a2.probeEnd | judging |
| phone-bench-a2.inputPlanMatch | true |
| phone-bench-a2.frameMismatchFraction | 0 |
| phone-bench-a2.numericMismatchFraction | 0 |
| phone-bench-a2.laggedFraction | 0 |
| phone-bench-a3.samples | 365 |
| phone-bench-a3.heldBeforeFirstInput | false |
| phone-bench-a3.firstPressFrame | 24 |
| phone-bench-a3.firstMotionFrame | 25 |
| phone-bench-a3.browserPhasePath | BRACE>DESCENT>HOLE>ASCENT>LOCKOUT |
| phone-bench-a3.probePhasePath | BRACE>DESCENT>HOLE>ASCENT>LOCKOUT |
| phone-bench-a3.browserEnd | judging |
| phone-bench-a3.probeEnd | judging |
| phone-bench-a3.inputPlanMatch | true |
| phone-bench-a3.frameMismatchFraction | 0 |
| phone-bench-a3.numericMismatchFraction | 0 |
| phone-bench-a3.laggedFraction | 0 |
| phone-deadlift-a1.samples | 250 |
| phone-deadlift-a1.heldBeforeFirstInput | false |
| phone-deadlift-a1.firstPressFrame | 36 |
| phone-deadlift-a1.firstMotionFrame | 36 |
| phone-deadlift-a1.browserPhasePath | BRACE>ASCENT>LOCKOUT |
| phone-deadlift-a1.probePhasePath | BRACE>ASCENT>LOCKOUT |
| phone-deadlift-a1.browserEnd | judging |
| phone-deadlift-a1.probeEnd | judging |
| phone-deadlift-a1.inputPlanMatch | true |
| phone-deadlift-a1.frameMismatchFraction | 0 |
| phone-deadlift-a1.numericMismatchFraction | 0 |
| phone-deadlift-a1.laggedFraction | 0 |
| phone-deadlift-a2.samples | 148 |
| phone-deadlift-a2.heldBeforeFirstInput | false |
| phone-deadlift-a2.firstPressFrame | 38 |
| phone-deadlift-a2.firstMotionFrame | 38 |
| phone-deadlift-a2.browserPhasePath | BRACE>ASCENT |
| phone-deadlift-a2.probePhasePath | BRACE>ASCENT |
| phone-deadlift-a2.browserEnd | judging |
| phone-deadlift-a2.probeEnd | judging |
| phone-deadlift-a2.inputPlanMatch | true |
| phone-deadlift-a2.frameMismatchFraction | 0 |
| phone-deadlift-a2.numericMismatchFraction | 0 |
| phone-deadlift-a2.laggedFraction | 0 |
| phone-deadlift-a3.samples | 218 |
| phone-deadlift-a3.heldBeforeFirstInput | false |
| phone-deadlift-a3.firstPressFrame | 41 |
| phone-deadlift-a3.firstMotionFrame | 41 |
| phone-deadlift-a3.browserPhasePath | BRACE>ASCENT |
| phone-deadlift-a3.probePhasePath | BRACE>ASCENT |
| phone-deadlift-a3.browserEnd | judging |
| phone-deadlift-a3.probeEnd | judging |
| phone-deadlift-a3.inputPlanMatch | true |
| phone-deadlift-a3.frameMismatchFraction | 0 |
| phone-deadlift-a3.numericMismatchFraction | 0 |
| phone-deadlift-a3.laggedFraction | 0 |
| desktop-squat-a1.samples | 155 |
| desktop-squat-a1.heldBeforeFirstInput | false |
| desktop-squat-a1.firstPressFrame | 29 |
| desktop-squat-a1.firstMotionFrame | 29 |
| desktop-squat-a1.browserPhasePath | BRACE>DESCENT>HOLE>ASCENT>LOCKOUT |
| desktop-squat-a1.probePhasePath | BRACE>DESCENT>HOLE>ASCENT>LOCKOUT |
| desktop-squat-a1.browserEnd | judging |
| desktop-squat-a1.probeEnd | judging |
| desktop-squat-a1.inputPlanMatch | true |
| desktop-squat-a1.frameMismatchFraction | 0 |
| desktop-squat-a1.numericMismatchFraction | 0 |
| desktop-squat-a1.laggedFraction | 0 |
| desktop-squat-a2.samples | 167 |
| desktop-squat-a2.heldBeforeFirstInput | false |
| desktop-squat-a2.firstPressFrame | 31 |
| desktop-squat-a2.firstMotionFrame | 31 |
| desktop-squat-a2.browserPhasePath | BRACE>DESCENT>HOLE>ASCENT>LOCKOUT |
| desktop-squat-a2.probePhasePath | BRACE>DESCENT>HOLE>ASCENT>LOCKOUT |
| desktop-squat-a2.browserEnd | judging |
| desktop-squat-a2.probeEnd | judging |
| desktop-squat-a2.inputPlanMatch | true |
| desktop-squat-a2.frameMismatchFraction | 0 |
| desktop-squat-a2.numericMismatchFraction | 0 |
| desktop-squat-a2.laggedFraction | 0 |
| desktop-squat-a3.samples | 180 |
| desktop-squat-a3.heldBeforeFirstInput | false |
| desktop-squat-a3.firstPressFrame | 32 |
| desktop-squat-a3.firstMotionFrame | 32 |
| desktop-squat-a3.browserPhasePath | BRACE>DESCENT>HOLE>ASCENT>LOCKOUT |
| desktop-squat-a3.probePhasePath | BRACE>DESCENT>HOLE>ASCENT>LOCKOUT |
| desktop-squat-a3.browserEnd | judging |
| desktop-squat-a3.probeEnd | judging |
| desktop-squat-a3.inputPlanMatch | true |
| desktop-squat-a3.frameMismatchFraction | 0 |
| desktop-squat-a3.numericMismatchFraction | 0 |
| desktop-squat-a3.laggedFraction | 0 |
| desktop-bench-a1.samples | 242 |
| desktop-bench-a1.heldBeforeFirstInput | false |
| desktop-bench-a1.firstPressFrame | 21 |
| desktop-bench-a1.firstMotionFrame | 21 |
| desktop-bench-a1.browserPhasePath | BRACE>DESCENT>HOLE>ASCENT>LOCKOUT |
| desktop-bench-a1.probePhasePath | BRACE>DESCENT>HOLE>ASCENT>LOCKOUT |
| desktop-bench-a1.browserEnd | judging |
| desktop-bench-a1.probeEnd | judging |
| desktop-bench-a1.inputPlanMatch | true |
| desktop-bench-a1.frameMismatchFraction | 0 |
| desktop-bench-a1.numericMismatchFraction | 0 |
| desktop-bench-a1.laggedFraction | 0 |
| desktop-bench-a2.samples | 345 |
| desktop-bench-a2.heldBeforeFirstInput | false |
| desktop-bench-a2.firstPressFrame | 23 |
| desktop-bench-a2.firstMotionFrame | 23 |
| desktop-bench-a2.browserPhasePath | BRACE>DESCENT>HOLE>ASCENT>LOCKOUT |
| desktop-bench-a2.probePhasePath | BRACE>DESCENT>HOLE>ASCENT>LOCKOUT |
| desktop-bench-a2.browserEnd | judging |
| desktop-bench-a2.probeEnd | judging |
| desktop-bench-a2.inputPlanMatch | true |
| desktop-bench-a2.frameMismatchFraction | 0 |
| desktop-bench-a2.numericMismatchFraction | 0 |
| desktop-bench-a2.laggedFraction | 0 |
| desktop-bench-a3.samples | 365 |
| desktop-bench-a3.heldBeforeFirstInput | false |
| desktop-bench-a3.firstPressFrame | 24 |
| desktop-bench-a3.firstMotionFrame | 25 |
| desktop-bench-a3.browserPhasePath | BRACE>DESCENT>HOLE>ASCENT>LOCKOUT |
| desktop-bench-a3.probePhasePath | BRACE>DESCENT>HOLE>ASCENT>LOCKOUT |
| desktop-bench-a3.browserEnd | judging |
| desktop-bench-a3.probeEnd | judging |
| desktop-bench-a3.inputPlanMatch | true |
| desktop-bench-a3.frameMismatchFraction | 0 |
| desktop-bench-a3.numericMismatchFraction | 0 |
| desktop-bench-a3.laggedFraction | 0 |
| desktop-deadlift-a1.samples | 250 |
| desktop-deadlift-a1.heldBeforeFirstInput | false |
| desktop-deadlift-a1.firstPressFrame | 36 |
| desktop-deadlift-a1.firstMotionFrame | 36 |
| desktop-deadlift-a1.browserPhasePath | BRACE>ASCENT>LOCKOUT |
| desktop-deadlift-a1.probePhasePath | BRACE>ASCENT>LOCKOUT |
| desktop-deadlift-a1.browserEnd | judging |
| desktop-deadlift-a1.probeEnd | judging |
| desktop-deadlift-a1.inputPlanMatch | true |
| desktop-deadlift-a1.frameMismatchFraction | 0 |
| desktop-deadlift-a1.numericMismatchFraction | 0 |
| desktop-deadlift-a1.laggedFraction | 0 |
| desktop-deadlift-a2.samples | 148 |
| desktop-deadlift-a2.heldBeforeFirstInput | false |
| desktop-deadlift-a2.firstPressFrame | 38 |
| desktop-deadlift-a2.firstMotionFrame | 38 |
| desktop-deadlift-a2.browserPhasePath | BRACE>ASCENT |
| desktop-deadlift-a2.probePhasePath | BRACE>ASCENT |
| desktop-deadlift-a2.browserEnd | judging |
| desktop-deadlift-a2.probeEnd | judging |
| desktop-deadlift-a2.inputPlanMatch | true |
| desktop-deadlift-a2.frameMismatchFraction | 0 |
| desktop-deadlift-a2.numericMismatchFraction | 0 |
| desktop-deadlift-a2.laggedFraction | 0 |
| desktop-deadlift-a3.samples | 218 |
| desktop-deadlift-a3.heldBeforeFirstInput | false |
| desktop-deadlift-a3.firstPressFrame | 41 |
| desktop-deadlift-a3.firstMotionFrame | 41 |
| desktop-deadlift-a3.browserPhasePath | BRACE>ASCENT |
| desktop-deadlift-a3.probePhasePath | BRACE>ASCENT |
| desktop-deadlift-a3.browserEnd | judging |
| desktop-deadlift-a3.probeEnd | judging |
| desktop-deadlift-a3.inputPlanMatch | true |
| desktop-deadlift-a3.frameMismatchFraction | 0 |
| desktop-deadlift-a3.numericMismatchFraction | 0 |
| desktop-deadlift-a3.laggedFraction | 0 |
| tracesCompared | 18 |
| framesCompared | 4140 |
| frameMismatchFraction | 0 |
| framesComparedExcludingLeakedTraces | 4140 |
| frameMismatchFractionExcludingLeakedTraces | 0 |
| numericMismatchFraction | 0 |
| promptMismatchFraction | 0 |
| commandMismatchFraction | 0 |
| renderLaggedFraction | 0 |
| oracleChecked | 4140 |
| oracleMismatchFraction | 0 |

Evidence:

- json: `trace:phone-squat-a1` — 155 play frames compared
- json: `trace:phone-squat-a2` — 167 play frames compared
- json: `trace:phone-squat-a3` — 180 play frames compared
- json: `trace:phone-bench-a1` — 242 play frames compared
- json: `trace:phone-bench-a2` — 345 play frames compared
- json: `trace:phone-bench-a3` — 365 play frames compared
- json: `trace:phone-deadlift-a1` — 250 play frames compared
- json: `trace:phone-deadlift-a2` — 148 play frames compared
- json: `trace:phone-deadlift-a3` — 218 play frames compared
- json: `trace:desktop-squat-a1` — 155 play frames compared
- json: `trace:desktop-squat-a2` — 167 play frames compared
- json: `trace:desktop-squat-a3` — 180 play frames compared
- json: `trace:desktop-bench-a1` — 242 play frames compared
- json: `trace:desktop-bench-a2` — 345 play frames compared
- json: `trace:desktop-bench-a3` — 365 play frames compared
- json: `trace:desktop-deadlift-a1` — 250 play frames compared
- json: `trace:desktop-deadlift-a2` — 148 play frames compared
- json: `trace:desktop-deadlift-a3` — 218 play frames compared

### sprite-grounding — ✅ PASS (confidence 0.90)

Anchors match the PNG alpha, every stage frame sits on the shared contact line, the live canvas equals the anchored composition, and play traces animate continuously.


| Metric | Value |
|---|---|
| stage.contactY | 318 |
| stage.size | 320x320 |
| anchorRowsChecked | 48 |
| anchorRowsMismatched | 0 |
| framesWithFringe | 0 |
| framesOver48Colors | 0 |
| stageBeats | 128 |
| beatsWithoutSpriteStage | 0 |
| beatsMissingWorldY | 0 |
| beatsNotGrounded | 0 |
| beatsAnchorArithmeticBroken | 0 |
| beatsCanvasSizeWrong | 0 |
| canvasProofs | 128 |
| canvasProofsFailed | 0 |
| canvasLifterProofsFailed | 0 |
| canvasProofsMissing | 0 |
| canvasWorstMismatchFraction | 0 |
| phone-squat-a1.distinctFrames | 6 |
| phone-squat-a1.frameJumpsWithinPhase | 0 |
| phone-squat-a1.groundLineValues | 318 |
| phone-squat-a1.frameAtMaxDepth | 2 |
| phone-squat-a1.footDriftPx | 16.2 |
| phone-squat-a2.distinctFrames | 6 |
| phone-squat-a2.frameJumpsWithinPhase | 0 |
| phone-squat-a2.groundLineValues | 318 |
| phone-squat-a2.frameAtMaxDepth | 2 |
| phone-squat-a2.footDriftPx | 16.2 |
| phone-squat-a3.distinctFrames | 6 |
| phone-squat-a3.frameJumpsWithinPhase | 0 |
| phone-squat-a3.groundLineValues | 318 |
| phone-squat-a3.frameAtMaxDepth | 2 |
| phone-squat-a3.footDriftPx | 16.2 |
| phone-bench-a1.distinctFrames | 6 |
| phone-bench-a1.frameJumpsWithinPhase | 0 |
| phone-bench-a1.groundLineValues | 318 |
| phone-bench-a1.frameAtMaxDepth | 2 |
| phone-bench-a1.footDriftPx | 4.3 |
| phone-bench-a2.distinctFrames | 6 |
| phone-bench-a2.frameJumpsWithinPhase | 0 |
| phone-bench-a2.groundLineValues | 318 |
| phone-bench-a2.frameAtMaxDepth | 2 |
| phone-bench-a2.footDriftPx | 4.3 |
| phone-bench-a3.distinctFrames | 6 |
| phone-bench-a3.frameJumpsWithinPhase | 0 |
| phone-bench-a3.groundLineValues | 318 |
| phone-bench-a3.frameAtMaxDepth | 2 |
| phone-bench-a3.footDriftPx | 4.3 |
| phone-deadlift-a1.distinctFrames | 6 |
| phone-deadlift-a1.frameJumpsWithinPhase | 0 |
| phone-deadlift-a1.groundLineValues | 318 |
| phone-deadlift-a1.footDriftPx | 35.8 |
| phone-deadlift-a2.distinctFrames | 3 |
| phone-deadlift-a2.frameJumpsWithinPhase | 0 |
| phone-deadlift-a2.groundLineValues | 318 |
| phone-deadlift-a2.footDriftPx | 33.4 |
| phone-deadlift-a3.distinctFrames | 5 |
| phone-deadlift-a3.frameJumpsWithinPhase | 0 |
| phone-deadlift-a3.groundLineValues | 318 |
| phone-deadlift-a3.footDriftPx | 33.4 |
| desktop-squat-a1.distinctFrames | 6 |
| desktop-squat-a1.frameJumpsWithinPhase | 0 |
| desktop-squat-a1.groundLineValues | 318 |
| desktop-squat-a1.frameAtMaxDepth | 2 |
| desktop-squat-a1.footDriftPx | 16.2 |
| desktop-squat-a2.distinctFrames | 6 |
| desktop-squat-a2.frameJumpsWithinPhase | 0 |
| desktop-squat-a2.groundLineValues | 318 |
| desktop-squat-a2.frameAtMaxDepth | 2 |
| desktop-squat-a2.footDriftPx | 16.2 |
| desktop-squat-a3.distinctFrames | 6 |
| desktop-squat-a3.frameJumpsWithinPhase | 0 |
| desktop-squat-a3.groundLineValues | 318 |
| desktop-squat-a3.frameAtMaxDepth | 2 |
| desktop-squat-a3.footDriftPx | 16.2 |
| desktop-bench-a1.distinctFrames | 6 |
| desktop-bench-a1.frameJumpsWithinPhase | 0 |
| desktop-bench-a1.groundLineValues | 318 |
| desktop-bench-a1.frameAtMaxDepth | 2 |
| desktop-bench-a1.footDriftPx | 4.3 |
| desktop-bench-a2.distinctFrames | 6 |
| desktop-bench-a2.frameJumpsWithinPhase | 0 |
| desktop-bench-a2.groundLineValues | 318 |
| desktop-bench-a2.frameAtMaxDepth | 2 |
| desktop-bench-a2.footDriftPx | 4.3 |
| desktop-bench-a3.distinctFrames | 6 |
| desktop-bench-a3.frameJumpsWithinPhase | 0 |
| desktop-bench-a3.groundLineValues | 318 |
| desktop-bench-a3.frameAtMaxDepth | 2 |
| desktop-bench-a3.footDriftPx | 4.3 |
| desktop-deadlift-a1.distinctFrames | 6 |
| desktop-deadlift-a1.frameJumpsWithinPhase | 0 |
| desktop-deadlift-a1.groundLineValues | 318 |
| desktop-deadlift-a1.footDriftPx | 35.8 |
| desktop-deadlift-a2.distinctFrames | 3 |
| desktop-deadlift-a2.frameJumpsWithinPhase | 0 |
| desktop-deadlift-a2.groundLineValues | 318 |
| desktop-deadlift-a2.footDriftPx | 33.4 |
| desktop-deadlift-a3.distinctFrames | 5 |
| desktop-deadlift-a3.frameJumpsWithinPhase | 0 |
| desktop-deadlift-a3.groundLineValues | 318 |
| desktop-deadlift-a3.footDriftPx | 33.4 |
| tracesAnalysed | 18 |

Evidence:

- file: `arcade/src/sprites/anchors.ts` — anchor table vs measured PNG alpha
- canvas: `evidence/phone-02-squat-attempts.canvas.png` — phone-02-squat-attempts: squat stage mismatch 0, lifter pixels off 0/20381, scale 1
- canvas: `evidence/phone-03-squat-walkout.canvas.png` — phone-03-squat-walkout: squat stage mismatch 0, lifter pixels off 0/20381, scale 1
- canvas: `evidence/phone-04-squat-brace.canvas.png` — phone-04-squat-brace: squat stage mismatch 0, lifter pixels off 0/20381, scale 1
- canvas: `evidence/phone-05-squat-hole.canvas.png` — phone-05-squat-hole: squat stage mismatch 0, lifter pixels off 0/18746, scale 1
- canvas: `evidence/phone-06-squat-ascent.canvas.png` — phone-06-squat-ascent: squat stage mismatch 0, lifter pixels off 0/18746, scale 1
- canvas: `evidence/phone-07-squat-judging.canvas.png` — phone-07-squat-judging: squat stage mismatch 0, lifter pixels off 0/20237, scale 1
- canvas: `evidence/phone-08-squat-outcome.canvas.png` — phone-08-squat-outcome: success stage mismatch 0, lifter pixels off 0/27053, scale 1
- canvas: `evidence/phone-09-squat-transition.canvas.png` — phone-09-squat-transition: squat stage mismatch 0, lifter pixels off 0/20381, scale 1
- canvas: `evidence/phone-10-squat-walkout.canvas.png` — phone-10-squat-walkout: squat stage mismatch 0, lifter pixels off 0/20381, scale 1
- canvas: `evidence/phone-11-squat-brace.canvas.png` — phone-11-squat-brace: squat stage mismatch 0, lifter pixels off 0/20381, scale 1
- canvas: `evidence/phone-12-squat-hole.canvas.png` — phone-12-squat-hole: squat stage mismatch 0, lifter pixels off 0/18746, scale 1
- canvas: `evidence/phone-13-squat-ascent.canvas.png` — phone-13-squat-ascent: squat stage mismatch 0, lifter pixels off 0/18746, scale 1
- canvas: `evidence/phone-14-squat-judging.canvas.png` — phone-14-squat-judging: squat stage mismatch 0, lifter pixels off 0/20237, scale 1
- canvas: `evidence/phone-15-squat-outcome.canvas.png` — phone-15-squat-outcome: success stage mismatch 0, lifter pixels off 0/27053, scale 1
- canvas: `evidence/phone-16-squat-transition.canvas.png` — phone-16-squat-transition: squat-max stage mismatch 0, lifter pixels off 0/22886, scale 1
- canvas: `evidence/phone-17-squat-walkout.canvas.png` — phone-17-squat-walkout: squat-max stage mismatch 0, lifter pixels off 0/22886, scale 1
- canvas: `evidence/phone-18-squat-brace.canvas.png` — phone-18-squat-brace: squat-max stage mismatch 0, lifter pixels off 0/22886, scale 1
- canvas: `evidence/phone-19-squat-hole.canvas.png` — phone-19-squat-hole: squat-max stage mismatch 0, lifter pixels off 0/23772, scale 1
- canvas: `evidence/phone-20-squat-ascent.canvas.png` — phone-20-squat-ascent: squat-max stage mismatch 0, lifter pixels off 0/23772, scale 1
- canvas: `evidence/phone-21-squat-judging.canvas.png` — phone-21-squat-judging: squat-max stage mismatch 0, lifter pixels off 0/23830, scale 1
- canvas: `evidence/phone-22-squat-outcome.canvas.png` — phone-22-squat-outcome: success stage mismatch 0, lifter pixels off 0/27053, scale 1
- canvas: `evidence/phone-24-bench-attempts.canvas.png` — phone-24-bench-attempts: bench stage mismatch 0, lifter pixels off 0/33990, scale 1
- canvas: `evidence/phone-25-bench-walkout.canvas.png` — phone-25-bench-walkout: bench stage mismatch 0, lifter pixels off 0/33990, scale 1
- canvas: `evidence/phone-26-bench-brace.canvas.png` — phone-26-bench-brace: bench stage mismatch 0, lifter pixels off 0/33990, scale 1
- canvas: `evidence/phone-27-bench-hole.canvas.png` — phone-27-bench-hole: bench stage mismatch 0, lifter pixels off 0/32969, scale 1
- canvas: `evidence/phone-28-bench-press.canvas.png` — phone-28-bench-press: bench stage mismatch 0, lifter pixels off 0/32969, scale 1
- canvas: `evidence/phone-29-bench-ascent.canvas.png` — phone-29-bench-ascent: bench stage mismatch 0, lifter pixels off 0/34152, scale 1
- canvas: `evidence/phone-30-bench-judging.canvas.png` — phone-30-bench-judging: bench stage mismatch 0, lifter pixels off 0/34633, scale 1
- canvas: `evidence/phone-31-bench-outcome.canvas.png` — phone-31-bench-outcome: success stage mismatch 0, lifter pixels off 0/27053, scale 1
- canvas: `evidence/phone-32-bench-transition.canvas.png` — phone-32-bench-transition: bench stage mismatch 0, lifter pixels off 0/33990, scale 1
- canvas: `evidence/phone-33-bench-walkout.canvas.png` — phone-33-bench-walkout: bench stage mismatch 0, lifter pixels off 0/33990, scale 1
- canvas: `evidence/phone-34-bench-brace.canvas.png` — phone-34-bench-brace: bench stage mismatch 0, lifter pixels off 0/33990, scale 1
- canvas: `evidence/phone-35-bench-hole.canvas.png` — phone-35-bench-hole: bench stage mismatch 0, lifter pixels off 0/32969, scale 1
- canvas: `evidence/phone-36-bench-press.canvas.png` — phone-36-bench-press: bench stage mismatch 0, lifter pixels off 0/32969, scale 1
- canvas: `evidence/phone-37-bench-ascent.canvas.png` — phone-37-bench-ascent: bench stage mismatch 0, lifter pixels off 0/34152, scale 1
- canvas: `evidence/phone-38-bench-judging.canvas.png` — phone-38-bench-judging: bench stage mismatch 0, lifter pixels off 0/34633, scale 1
- canvas: `evidence/phone-39-bench-outcome.canvas.png` — phone-39-bench-outcome: success stage mismatch 0, lifter pixels off 0/27053, scale 1
- canvas: `evidence/phone-40-bench-transition.canvas.png` — phone-40-bench-transition: bench-max stage mismatch 0, lifter pixels off 0/29079, scale 1
- canvas: `evidence/phone-41-bench-walkout.canvas.png` — phone-41-bench-walkout: bench-max stage mismatch 0, lifter pixels off 0/29079, scale 1
- canvas: `evidence/phone-42-bench-brace.canvas.png` — phone-42-bench-brace: bench-max stage mismatch 0, lifter pixels off 0/29079, scale 1
- canvas: `evidence/phone-43-bench-hole.canvas.png` — phone-43-bench-hole: bench-max stage mismatch 0, lifter pixels off 0/30833, scale 1
- canvas: `evidence/phone-44-bench-press.canvas.png` — phone-44-bench-press: bench-max stage mismatch 0, lifter pixels off 0/30833, scale 1
- canvas: `evidence/phone-45-bench-ascent.canvas.png` — phone-45-bench-ascent: bench-max stage mismatch 0, lifter pixels off 0/32063, scale 1
- canvas: `evidence/phone-46-bench-judging.canvas.png` — phone-46-bench-judging: bench-max stage mismatch 0, lifter pixels off 0/31733, scale 1
- canvas: `evidence/phone-47-bench-outcome.canvas.png` — phone-47-bench-outcome: success stage mismatch 0, lifter pixels off 0/27053, scale 1
- canvas: `evidence/phone-49-deadlift-attempts.canvas.png` — phone-49-deadlift-attempts: deadlift stage mismatch 0, lifter pixels off 0/17342, scale 1
- canvas: `evidence/phone-50-deadlift-walkout.canvas.png` — phone-50-deadlift-walkout: deadlift stage mismatch 0, lifter pixels off 0/17342, scale 1
- canvas: `evidence/phone-51-deadlift-brace.canvas.png` — phone-51-deadlift-brace: deadlift stage mismatch 0, lifter pixels off 0/17342, scale 1
- canvas: `evidence/phone-52-deadlift-ascent.canvas.png` — phone-52-deadlift-ascent: deadlift stage mismatch 0, lifter pixels off 0/17342, scale 1
- canvas: `evidence/phone-53-deadlift-lock.canvas.png` — phone-53-deadlift-lock: deadlift stage mismatch 0, lifter pixels off 0/28732, scale 1
- canvas: `evidence/phone-54-deadlift-judging.canvas.png` — phone-54-deadlift-judging: deadlift stage mismatch 0, lifter pixels off 0/28732, scale 1
- canvas: `evidence/phone-55-deadlift-outcome.canvas.png` — phone-55-deadlift-outcome: success stage mismatch 0, lifter pixels off 0/27053, scale 1
- canvas: `evidence/phone-56-deadlift-transition.canvas.png` — phone-56-deadlift-transition: deadlift stage mismatch 0, lifter pixels off 0/17342, scale 1
- canvas: `evidence/phone-57-deadlift-walkout.canvas.png` — phone-57-deadlift-walkout: deadlift stage mismatch 0, lifter pixels off 0/17342, scale 1
- canvas: `evidence/phone-58-deadlift-brace.canvas.png` — phone-58-deadlift-brace: deadlift stage mismatch 0, lifter pixels off 0/17342, scale 1
- canvas: `evidence/phone-59-deadlift-ascent.canvas.png` — phone-59-deadlift-ascent: deadlift stage mismatch 0, lifter pixels off 0/17342, scale 1
- canvas: `evidence/phone-60-deadlift-judging.canvas.png` — phone-60-deadlift-judging: deadlift stage mismatch 0, lifter pixels off 0/28732, scale 1
- canvas: `evidence/phone-61-deadlift-outcome.canvas.png` — phone-61-deadlift-outcome: miss stage mismatch 0, lifter pixels off 0/15404, scale 1
- canvas: `evidence/phone-62-deadlift-transition.canvas.png` — phone-62-deadlift-transition: deadlift-max stage mismatch 0, lifter pixels off 0/19275, scale 1
- canvas: `evidence/phone-63-deadlift-walkout.canvas.png` — phone-63-deadlift-walkout: deadlift-max stage mismatch 0, lifter pixels off 0/19275, scale 1
- canvas: `evidence/phone-64-deadlift-brace.canvas.png` — phone-64-deadlift-brace: deadlift-max stage mismatch 0, lifter pixels off 0/19275, scale 1
- canvas: `evidence/phone-65-deadlift-ascent.canvas.png` — phone-65-deadlift-ascent: deadlift-max stage mismatch 0, lifter pixels off 0/19275, scale 1
- canvas: `evidence/phone-66-deadlift-judging.canvas.png` — phone-66-deadlift-judging: deadlift-max stage mismatch 0, lifter pixels off 0/33670, scale 1
- canvas: `evidence/phone-67-deadlift-outcome.canvas.png` — phone-67-deadlift-outcome: miss stage mismatch 0, lifter pixels off 0/15404, scale 1
- canvas: `evidence/desktop-02-squat-attempts.canvas.png` — desktop-02-squat-attempts: squat stage mismatch 0, lifter pixels off 0/20381, scale 1
- canvas: `evidence/desktop-03-squat-walkout.canvas.png` — desktop-03-squat-walkout: squat stage mismatch 0, lifter pixels off 0/20381, scale 1
- canvas: `evidence/desktop-04-squat-brace.canvas.png` — desktop-04-squat-brace: squat stage mismatch 0, lifter pixels off 0/20381, scale 1
- canvas: `evidence/desktop-05-squat-hole.canvas.png` — desktop-05-squat-hole: squat stage mismatch 0, lifter pixels off 0/18746, scale 1
- canvas: `evidence/desktop-06-squat-ascent.canvas.png` — desktop-06-squat-ascent: squat stage mismatch 0, lifter pixels off 0/18746, scale 1
- canvas: `evidence/desktop-07-squat-judging.canvas.png` — desktop-07-squat-judging: squat stage mismatch 0, lifter pixels off 0/20237, scale 1
- canvas: `evidence/desktop-08-squat-outcome.canvas.png` — desktop-08-squat-outcome: success stage mismatch 0, lifter pixels off 0/27053, scale 1
- canvas: `evidence/desktop-09-squat-transition.canvas.png` — desktop-09-squat-transition: squat stage mismatch 0, lifter pixels off 0/20381, scale 1
- canvas: `evidence/desktop-10-squat-walkout.canvas.png` — desktop-10-squat-walkout: squat stage mismatch 0, lifter pixels off 0/20381, scale 1
- canvas: `evidence/desktop-11-squat-brace.canvas.png` — desktop-11-squat-brace: squat stage mismatch 0, lifter pixels off 0/20381, scale 1
- canvas: `evidence/desktop-12-squat-hole.canvas.png` — desktop-12-squat-hole: squat stage mismatch 0, lifter pixels off 0/18746, scale 1
- canvas: `evidence/desktop-13-squat-ascent.canvas.png` — desktop-13-squat-ascent: squat stage mismatch 0, lifter pixels off 0/18746, scale 1
- canvas: `evidence/desktop-14-squat-judging.canvas.png` — desktop-14-squat-judging: squat stage mismatch 0, lifter pixels off 0/20237, scale 1
- canvas: `evidence/desktop-15-squat-outcome.canvas.png` — desktop-15-squat-outcome: success stage mismatch 0, lifter pixels off 0/27053, scale 1
- canvas: `evidence/desktop-16-squat-transition.canvas.png` — desktop-16-squat-transition: squat-max stage mismatch 0, lifter pixels off 0/22886, scale 1
- canvas: `evidence/desktop-17-squat-walkout.canvas.png` — desktop-17-squat-walkout: squat-max stage mismatch 0, lifter pixels off 0/22886, scale 1
- canvas: `evidence/desktop-18-squat-brace.canvas.png` — desktop-18-squat-brace: squat-max stage mismatch 0, lifter pixels off 0/22886, scale 1
- canvas: `evidence/desktop-19-squat-hole.canvas.png` — desktop-19-squat-hole: squat-max stage mismatch 0, lifter pixels off 0/23772, scale 1
- canvas: `evidence/desktop-20-squat-ascent.canvas.png` — desktop-20-squat-ascent: squat-max stage mismatch 0, lifter pixels off 0/23772, scale 1
- canvas: `evidence/desktop-21-squat-judging.canvas.png` — desktop-21-squat-judging: squat-max stage mismatch 0, lifter pixels off 0/23830, scale 1
- canvas: `evidence/desktop-22-squat-outcome.canvas.png` — desktop-22-squat-outcome: success stage mismatch 0, lifter pixels off 0/27053, scale 1
- canvas: `evidence/desktop-24-bench-attempts.canvas.png` — desktop-24-bench-attempts: bench stage mismatch 0, lifter pixels off 0/33990, scale 1
- canvas: `evidence/desktop-25-bench-walkout.canvas.png` — desktop-25-bench-walkout: bench stage mismatch 0, lifter pixels off 0/33990, scale 1
- canvas: `evidence/desktop-26-bench-brace.canvas.png` — desktop-26-bench-brace: bench stage mismatch 0, lifter pixels off 0/33990, scale 1
- canvas: `evidence/desktop-27-bench-hole.canvas.png` — desktop-27-bench-hole: bench stage mismatch 0, lifter pixels off 0/32969, scale 1
- canvas: `evidence/desktop-28-bench-press.canvas.png` — desktop-28-bench-press: bench stage mismatch 0, lifter pixels off 0/32969, scale 1
- canvas: `evidence/desktop-29-bench-ascent.canvas.png` — desktop-29-bench-ascent: bench stage mismatch 0, lifter pixels off 0/34152, scale 1
- canvas: `evidence/desktop-30-bench-judging.canvas.png` — desktop-30-bench-judging: bench stage mismatch 0, lifter pixels off 0/34633, scale 1
- canvas: `evidence/desktop-31-bench-outcome.canvas.png` — desktop-31-bench-outcome: success stage mismatch 0, lifter pixels off 0/27053, scale 1
- canvas: `evidence/desktop-32-bench-transition.canvas.png` — desktop-32-bench-transition: bench stage mismatch 0, lifter pixels off 0/33990, scale 1
- canvas: `evidence/desktop-33-bench-walkout.canvas.png` — desktop-33-bench-walkout: bench stage mismatch 0, lifter pixels off 0/33990, scale 1
- canvas: `evidence/desktop-34-bench-brace.canvas.png` — desktop-34-bench-brace: bench stage mismatch 0, lifter pixels off 0/33990, scale 1
- canvas: `evidence/desktop-35-bench-hole.canvas.png` — desktop-35-bench-hole: bench stage mismatch 0, lifter pixels off 0/32969, scale 1
- canvas: `evidence/desktop-36-bench-press.canvas.png` — desktop-36-bench-press: bench stage mismatch 0, lifter pixels off 0/32969, scale 1
- canvas: `evidence/desktop-37-bench-ascent.canvas.png` — desktop-37-bench-ascent: bench stage mismatch 0, lifter pixels off 0/34152, scale 1
- canvas: `evidence/desktop-38-bench-judging.canvas.png` — desktop-38-bench-judging: bench stage mismatch 0, lifter pixels off 0/34633, scale 1
- canvas: `evidence/desktop-39-bench-outcome.canvas.png` — desktop-39-bench-outcome: success stage mismatch 0, lifter pixels off 0/27053, scale 1
- canvas: `evidence/desktop-40-bench-transition.canvas.png` — desktop-40-bench-transition: bench-max stage mismatch 0, lifter pixels off 0/29079, scale 1
- canvas: `evidence/desktop-41-bench-walkout.canvas.png` — desktop-41-bench-walkout: bench-max stage mismatch 0, lifter pixels off 0/29079, scale 1
- canvas: `evidence/desktop-42-bench-brace.canvas.png` — desktop-42-bench-brace: bench-max stage mismatch 0, lifter pixels off 0/29079, scale 1
- canvas: `evidence/desktop-43-bench-hole.canvas.png` — desktop-43-bench-hole: bench-max stage mismatch 0, lifter pixels off 0/30833, scale 1
- canvas: `evidence/desktop-44-bench-press.canvas.png` — desktop-44-bench-press: bench-max stage mismatch 0, lifter pixels off 0/30833, scale 1
- canvas: `evidence/desktop-45-bench-ascent.canvas.png` — desktop-45-bench-ascent: bench-max stage mismatch 0, lifter pixels off 0/32063, scale 1
- canvas: `evidence/desktop-46-bench-judging.canvas.png` — desktop-46-bench-judging: bench-max stage mismatch 0, lifter pixels off 0/31733, scale 1
- canvas: `evidence/desktop-47-bench-outcome.canvas.png` — desktop-47-bench-outcome: success stage mismatch 0, lifter pixels off 0/27053, scale 1
- canvas: `evidence/desktop-49-deadlift-attempts.canvas.png` — desktop-49-deadlift-attempts: deadlift stage mismatch 0, lifter pixels off 0/17342, scale 1
- canvas: `evidence/desktop-50-deadlift-walkout.canvas.png` — desktop-50-deadlift-walkout: deadlift stage mismatch 0, lifter pixels off 0/17342, scale 1
- canvas: `evidence/desktop-51-deadlift-brace.canvas.png` — desktop-51-deadlift-brace: deadlift stage mismatch 0, lifter pixels off 0/17342, scale 1
- canvas: `evidence/desktop-52-deadlift-ascent.canvas.png` — desktop-52-deadlift-ascent: deadlift stage mismatch 0, lifter pixels off 0/17342, scale 1
- canvas: `evidence/desktop-53-deadlift-lock.canvas.png` — desktop-53-deadlift-lock: deadlift stage mismatch 0, lifter pixels off 0/28732, scale 1
- canvas: `evidence/desktop-54-deadlift-judging.canvas.png` — desktop-54-deadlift-judging: deadlift stage mismatch 0, lifter pixels off 0/28732, scale 1
- canvas: `evidence/desktop-55-deadlift-outcome.canvas.png` — desktop-55-deadlift-outcome: success stage mismatch 0, lifter pixels off 0/27053, scale 1
- canvas: `evidence/desktop-56-deadlift-transition.canvas.png` — desktop-56-deadlift-transition: deadlift stage mismatch 0, lifter pixels off 0/17342, scale 1
- canvas: `evidence/desktop-57-deadlift-walkout.canvas.png` — desktop-57-deadlift-walkout: deadlift stage mismatch 0, lifter pixels off 0/17342, scale 1
- canvas: `evidence/desktop-58-deadlift-brace.canvas.png` — desktop-58-deadlift-brace: deadlift stage mismatch 0, lifter pixels off 0/17342, scale 1
- canvas: `evidence/desktop-59-deadlift-ascent.canvas.png` — desktop-59-deadlift-ascent: deadlift stage mismatch 0, lifter pixels off 0/17342, scale 1
- canvas: `evidence/desktop-60-deadlift-judging.canvas.png` — desktop-60-deadlift-judging: deadlift stage mismatch 0, lifter pixels off 0/28732, scale 1
- canvas: `evidence/desktop-61-deadlift-outcome.canvas.png` — desktop-61-deadlift-outcome: miss stage mismatch 0, lifter pixels off 0/15404, scale 1
- canvas: `evidence/desktop-62-deadlift-transition.canvas.png` — desktop-62-deadlift-transition: deadlift-max stage mismatch 0, lifter pixels off 0/19275, scale 1
- canvas: `evidence/desktop-63-deadlift-walkout.canvas.png` — desktop-63-deadlift-walkout: deadlift-max stage mismatch 0, lifter pixels off 0/19275, scale 1
- canvas: `evidence/desktop-64-deadlift-brace.canvas.png` — desktop-64-deadlift-brace: deadlift-max stage mismatch 0, lifter pixels off 0/19275, scale 1
- canvas: `evidence/desktop-65-deadlift-ascent.canvas.png` — desktop-65-deadlift-ascent: deadlift-max stage mismatch 0, lifter pixels off 0/19275, scale 1
- canvas: `evidence/desktop-66-deadlift-judging.canvas.png` — desktop-66-deadlift-judging: deadlift-max stage mismatch 0, lifter pixels off 0/33670, scale 1
- canvas: `evidence/desktop-67-deadlift-outcome.canvas.png` — desktop-67-deadlift-outcome: miss stage mismatch 0, lifter pixels off 0/15404, scale 1

### design-intent — 🟡 REVIEW (confidence 0.80)

The served build departs from the brief or needs a human look; see flags.

Flags: `DISPLAY_FONT_NOT_LOADED:phone`, `DESKTOP_GUTTERS_WIDE`, `CANDIDATE_BANNER_RENDERED`, `PAGE_ERRORS`

| Metric | Value |
|---|---|
| beats | 138 |
| phone.token.--color-iron | #14110f |
| phone.token.--color-ink | #f4efe4 |
| phone.token.--color-amber | #d4892a |
| phone.token.--color-paper | #f3e6c8 |
| phone.token.--color-red-light | #b83228 |
| phone.token.--color-white-light | #f7f3ea |
| phone.displayFontLoaded | false |
| desktop.token.--color-iron | #14110f |
| desktop.token.--color-ink | #f4efe4 |
| desktop.token.--color-amber | #d4892a |
| desktop.token.--color-paper | #f3e6c8 |
| desktop.token.--color-red-light | #b83228 |
| desktop.token.--color-white-light | #f7f3ea |
| desktop.displayFontLoaded | true |
| depthGaugeSightings | 0 |
| timingLaneSightings | 0 |
| illustratedStillSightings | 0 |
| twoTapPromptSightings | 0 |
| beatsWithHorizontalOverflow | 0 |
| stageBeats | 128 |
| stageBeatsNotCanvas | 0 |
| stageBeatsNotPixelated | 0 |
| stageBeatsNonIntegerScale | 0 |
| phoneMinStageWidthFraction | 0.821 |
| desktopMinStageHeightFraction | 0.8 |
| desktopMaxGutterFraction | 0.5 |
| stageWrapNarrowerThanViewport | 0 |
| playBeatsWithoutThreeLights | 0 |
| playBeatsWithoutHud | 0 |
| phoneFlowMissingBeats | none |
| editionBanner | A0 squat/bench/deadlift mechanics · sprite stage · DO_NOT_MERGE · not SNES craft |
| legacySpritesAttr | true |
| pageErrors | 6 |
| liftsPlayed | squat,bench,deadlift |

Evidence:

- screenshot: `evidence/phone-00-none-title.png` — phone title
- screenshot: `evidence/desktop-00-none-title.png` — desktop title

### preview-regression — 🟡 REVIEW (confidence 0.75)

The fresh preview drifted from committed evidence or the reference, or a comparison could not run; see flags.

Flags: `EVIDENCE_PIXEL_DRIFT:title-390`, `EVIDENCE_PIXEL_DRIFT:select-390`, `TITLE_DRIFT_VS_REFERENCE:phone`

| Metric | Value |
|---|---|
| pixel.title-390.meanAbsDiff | 0.0654 |
| pixel.title-390.sizeMatch | true |
| pixel.title-1280.meanAbsDiff | 0.0218 |
| pixel.title-1280.sizeMatch | true |
| pixel.select-390.meanAbsDiff | 0.0605 |
| pixel.select-390.sizeMatch | true |
| pixel.squat-brace-390.meanAbsDiff | 0.1579 |
| pixel.squat-brace-390.sizeMatch | true |
| pixel.squat-brace-390.stageAlignedMeanAbsDiff | 0 |
| pixel.squat-brace-390.stageAlignedOffsetY | 4 |
| pixel.squat-brace-1280.meanAbsDiff | 0.148 |
| pixel.squat-brace-1280.sizeMatch | true |
| pixel.squat-brace-1280.stageAlignedMeanAbsDiff | 0.0019 |
| pixel.squat-brace-1280.stageAlignedOffsetY | 157 |
| pixel.squat-hole-390.meanAbsDiff | 0.1256 |
| pixel.squat-hole-390.sizeMatch | true |
| pixel.squat-hole-390.stageAlignedMeanAbsDiff | 0 |
| pixel.squat-hole-390.stageAlignedOffsetY | 4 |
| pixel.bench-brace-390.meanAbsDiff | 0.1588 |
| pixel.bench-brace-390.sizeMatch | true |
| pixel.bench-brace-390.stageAlignedMeanAbsDiff | 0 |
| pixel.bench-brace-390.stageAlignedOffsetY | 4 |
| pixel.bench-press-390.meanAbsDiff | 0.1293 |
| pixel.bench-press-390.sizeMatch | true |
| pixel.bench-press-390.stageAlignedMeanAbsDiff | 0 |
| pixel.bench-press-390.stageAlignedOffsetY | 4 |
| pixel.deadlift-brace-390.meanAbsDiff | 0.1579 |
| pixel.deadlift-brace-390.sizeMatch | true |
| pixel.deadlift-brace-390.stageAlignedMeanAbsDiff | 0 |
| pixel.deadlift-brace-390.stageAlignedOffsetY | 4 |
| pixel.deadlift-lock-390.meanAbsDiff | 0.1003 |
| pixel.deadlift-lock-390.sizeMatch | true |
| pixel.deadlift-lock-390.stageAlignedMeanAbsDiff | 0 |
| pixel.deadlift-lock-390.stageAlignedOffsetY | 4 |
| committedPairsCompared | 10 |
| committedStructuralDrift | 0 |
| committedPixelDrift | 2 |
| committedFreshMissing | 0 |
| referenceSha | 1151569c40c77485ab9e9299e5db0db022437a8a |
| tokenDriftVsReference | none |
| spritesComparedVsReference | 52 |
| spritesDifferingVsReference | 0 |
| referenceTitle.phone.meanAbsDiff | 0.1079 |
| referenceTitle.desktop.meanAbsDiff | 0.0961 |

Evidence:

- file: `arcade/evidence/sprite-sport` — 17 committed evidence entries
- screenshot: `evidence/phone-00-none-title.png` — vs committed committed-evidence/title-390.png: full-page meanAbsDiff 0.0654
- screenshot: `evidence/desktop-00-none-title.png` — vs committed committed-evidence/title-1280.png: full-page meanAbsDiff 0.0218
- screenshot: `evidence/phone-01-none-lift.png` — vs committed committed-evidence/select-390.png: full-page meanAbsDiff 0.0605
- screenshot: `evidence/phone-04-squat-brace.png` — vs committed committed-evidence/squat-brace-390.png: full-page meanAbsDiff 0.1579; stage region aligned at dy=4 meanAbsDiff 0
- screenshot: `evidence/desktop-04-squat-brace.png` — vs committed committed-evidence/squat-brace-1280.png: full-page meanAbsDiff 0.148; stage region aligned at dy=157 meanAbsDiff 0.0019
- screenshot: `evidence/phone-05-squat-hole.png` — vs committed committed-evidence/squat-hole-390.png: full-page meanAbsDiff 0.1256; stage region aligned at dy=4 meanAbsDiff 0
- screenshot: `evidence/phone-26-bench-brace.png` — vs committed committed-evidence/bench-brace-390.png: full-page meanAbsDiff 0.1588; stage region aligned at dy=4 meanAbsDiff 0
- screenshot: `evidence/phone-28-bench-press.png` — vs committed committed-evidence/bench-press-390.png: full-page meanAbsDiff 0.1293; stage region aligned at dy=4 meanAbsDiff 0
- screenshot: `evidence/phone-51-deadlift-brace.png` — vs committed committed-evidence/deadlift-brace-390.png: full-page meanAbsDiff 0.1579; stage region aligned at dy=4 meanAbsDiff 0
- screenshot: `evidence/phone-53-deadlift-lock.png` — vs committed committed-evidence/deadlift-lock-390.png: full-page meanAbsDiff 0.1003; stage region aligned at dy=4 meanAbsDiff 0
- git: `1151569c40c77485ab9e9299e5db0db022437a8a` — presentation reference worktree capture
- screenshot: `reference/evidence/phone-00-none-title.png` — reference phone title
- screenshot: `reference/evidence/desktop-00-none-title.png` — reference desktop title

### document-contract-conflict — 🟡 REVIEW (confidence 0.99)

The Iron & Amber reference, GDD §7.1 and the product brief disagree about sprites as the primary art direction. Owner ruling: analyze against the brief, keep the documents unchanged, report REVIEW until the documents are reconciled.

Flags: `DOCUMENT_CONTRACT_CONFLICT`, `IRON_AMBER_DOC_ABSENT_AT_TARGET`

| Metric | Value |
|---|---|
| ironAmber.mechanics-authority.present | true |
| ironAmber.mechanics-authority.sha256 | 0fcac65e4422735ff2bf0342e7de86757685c5a5c62690fdbfd71a9761d0cf67 |
| ironAmber.mechanics-authority.clausesFound | 2 |
| ironAmber.pr-44.present | true |
| ironAmber.pr-44.sha256 | 0fcac65e4422735ff2bf0342e7de86757685c5a5c62690fdbfd71a9761d0cf67 |
| ironAmber.pr-44.clausesFound | 2 |
| ironAmber.target.present | false |
| ironAmber.target.sha256 | – |
| ironAmber.target.clausesFound | 0 |
| gdd.target.present | true |
| gdd.target.sha256 | b9398040e5105f1f2e7d592510996c15dc63b33cbaa511d95936e6b6171b605c |
| brief | preserve the real Session A career-mode mechanics / use the career-mode sprite athlete / present it inside the Iron & Amber visual system / keep the athlete grounded on the platform / use responsive full-stage composition / use nearest-neighbor rendering / reject raw centered sprite tiles, giant gutters, floating athletes, still-image animation, and two-tap timing demos |

Evidence:

- doc: `288db32c06232bb0fb65ce7236a0614c698a6920:docs/design/IRON-AND-AMBER-REFERENCE.md` (sha256 0fcac65e4422) — mechanics-authority
- doc: `c52444d407e9974209446ec1de7d127f1ce07a6a:docs/design/IRON-AND-AMBER-REFERENCE.md` (sha256 0fcac65e4422) — pr-44
- doc: `fc4c1aec06f0f079b851bb703f69ee67140b4f85:docs/design/IRON-AND-AMBER-REFERENCE.md` — target
- doc: `fc4c1aec06f0f079b851bb703f69ee67140b4f85:docs/GDD.md` (sha256 b9398040e510) — GDD §7.1 at target

### flow — ⚪ ABSTAIN (confidence 0.00)

Player flow is scheduled for a later slice and abstains rather than guessing.

Flags: `NOT_IMPLEMENTED`

| Metric | Value |
|---|---|
| plannedMeasurements | screen graph coverage, dead ends, return paths, time-to-first-input |

### balance — ⚪ ABSTAIN (confidence 0.00)

Balance is scheduled for a later slice and abstains rather than guessing.

Flags: `NOT_IMPLEMENTED`

| Metric | Value |
|---|---|
| plannedMeasurements | make/miss rates per lift and load ratio across seeds, opener suggestions vs e1RM |

### input-fairness — ⚪ ABSTAIN (confidence 0.00)

Input fairness is scheduled for a later slice and abstains rather than guessing.

Flags: `NOT_IMPLEMENTED`

| Metric | Value |
|---|---|
| plannedMeasurements | cue window widths vs fatigue, press/hold latency budget, keyboard vs pointer parity |

### progression — ⚪ ABSTAIN (confidence 0.00)

Progression is scheduled for a later slice and abstains rather than guessing.

Flags: `NOT_IMPLEMENTED`

| Metric | Value |
|---|---|
| plannedMeasurements | e1RM and streak deltas per outcome, server-authoritative boundary checks |

### playtest — ⚪ ABSTAIN (confidence 0.00)

Human playtest is scheduled for a later slice and abstains rather than guessing.

Flags: `NOT_IMPLEMENTED`, `HUMAN_PLAYTEST_REQUIRED`

| Metric | Value |
|---|---|
| plannedMeasurements | feel, pacing, tension; cannot be established by tooling |

## Commands executed

| Command | cwd | exit | ms |
|---|---|---|---|
| `/opt/node22/bin/node --disable-warning=ExperimentalWarning --import /home/user/three-white-lights/tools/twl-development-` | <worktree>/arcade | 0 | 424 |
| `/opt/node22/bin/node --disable-warning=ExperimentalWarning --import /home/user/three-white-lights/tools/twl-development-` | <worktree>/arcade | 0 | 423 |

