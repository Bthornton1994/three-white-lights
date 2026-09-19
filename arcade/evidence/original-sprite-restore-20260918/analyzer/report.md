# TWL development analysis — f4b529a8-2026-09-19T05-33-27-651Z

**Overall:** 🔴 FAIL · human approval required: **yes** · generated 2026-09-19T05:33:27.652Z

| Layer | SHA |
|---|---|
| Artifact under judgment (target) | `f4b529a8612dd3da374fa654c16cabe82f85d864` |
| Presentation reference | `1151569c40c77485ab9e9299e5db0db022437a8a` |
| Mechanics authority | `288db32c06232bb0fb65ce7236a0614c698a6920` |
| Served page declares | `288db32c06232bb0fb65ce7236a0614c698a6920` at http://127.0.0.1:34545 |
| Provider | twl-development-analysis 0.2.0 (deterministic-rules, node v22.23.2, playwright 1.56.1, browser 141.0.7390.37) |

## Attempt matrix

**🔴 FAIL** — The multi-attempt matrix did not verify cleanly; see flags.

| Case | held before input | first press | judgment | probe | overflow | grounded | frame mismatch |
|---|---|---|---|---|---|---|---|
| `phone-squat-a1` | false | true | judging | judging | false | true | 0/155 |
| `phone-squat-a2` | false | true | judging | judging | false | true | 0/167 |
| `phone-squat-a3` | false | true | judging | judging | false | true | 0/180 |
| `phone-bench-a1` | false | true | judging | judging | false | true | 0/242 |
| `phone-bench-a2` | false | true | judging | judging | false | true | 0/345 |
| `phone-bench-a3` | false | true | judging | judging | false | true | 0/365 |
| `phone-deadlift-a1` | false | true | judging | judging | false | true | 0/250 |
| `phone-deadlift-a2` | false | true | judging | judging | false | true | 0/148 |
| `phone-deadlift-a3` | false | true | judging | judging | false | true | 0/218 |
| `desktop-squat-a1` | false | true | play | judging | false | true | 128/157 |
| `desktop-bench-a1` | false | true | play | judging | false | true | 223/244 |
| `desktop-deadlift-a1` | false | true | play | judging | false | true | 216/252 |

## Decisions

| Analyzer | Verdict | Confidence | Flags | Key metrics | Human approval |
|---|---|---|---|---|---|
| `source-identity` | ✅ PASS | 0.99 | – | targetSha=f4b529a8612dd3da374fa654c16cabe82f85d864, worktreeHead=f4b529a8612dd3da374fa654c16cabe82f85d864, spriteFilesChangedVsReference=0, npmCiExit=0, buildExit=0 | no |
| `served-identity` | ✅ PASS | 0.98 | – | servedUrl=http://127.0.0.1:34545, servedScriptSha256=efe975b9f7456e5a7416c4df26f4e03cae384396c0f0719efa27f2e2006cc156, freshBuildScriptSha256=efe975b9f7456e5a7416c4df26f4e03cae384396c0f0719efa27f2e2006cc156, servedSpritesChecked=52, servedSpritesDifferFromWorktree=0, servedSpritesDifferFromReference=0 | no |
| `existing-tests` | ✅ PASS | 0.95 | – | exit:npm test=0 | no |
| `mechanics-frame-parity` | 🔴 FAIL | 0.97 | `PHASE_PATH_MISMATCH:desktop-squat-a1` `RESOLUTION_MISMATCH:desktop-squat-a1` `PHASE_PATH_MISMATCH:desktop-bench-a1` `RESOLUTION_MISMATCH:desktop-bench-a1` `INPUT_PLAN_DIVERGED:desktop-bench-a1` `PHASE_PATH_MISMATCH:desktop-deadlift-a1` `RESOLUTION_MISMATCH:desktop-deadlift-a1` `FRAME_PARITY_MISMATCH` `PROMPT_PARITY_MISMATCH` `COMMAND_PARITY_MISMATCH` | tracesCompared=12, framesCompared=2723, frameMismatchFraction=0.2071, framesComparedExcludingLeakedTraces=2723, frameMismatchFractionExcludingLeakedTraces=0.2071, numericMismatchFraction=0 | no |
| `attempt-matrix` | 🔴 FAIL | 0.85 | `ATTEMPT_MATRIX_NOT_18` `CASE_MISSING:desktop-squat-a2` `CASE_MISSING:desktop-squat-a3` `CASE_MISSING:desktop-bench-a2` `CASE_MISSING:desktop-bench-a3` `CASE_MISSING:desktop-deadlift-a2` `CASE_MISSING:desktop-deadlift-a3` `FRAME_PARITY_MISMATCH:desktop-squat-a1` `FRAME_PARITY_MISMATCH:desktop-bench-a1` `FRAME_PARITY_MISMATCH:desktop-deadlift-a1` `FRAME_PARITY_MISMATCH` | attemptsPerLift=3, caseCount=12, traceCount=12, expectedCaseCount=18, heldLeaks=0, firstPressRejected=0 | no |
| `sprite-grounding` | 🔴 FAIL | 0.90 | `STILL_IMAGE_ANIMATION:desktop-squat-a1` `HOLE_FRAME_MISSING:desktop-squat-a1` `STILL_IMAGE_ANIMATION:desktop-bench-a1` `HOLE_FRAME_MISSING:desktop-bench-a1` `STILL_IMAGE_ANIMATION:desktop-deadlift-a1` | anchorRowsChecked=48, anchorRowsMismatched=0, framesWithFringe=0, framesOver48Colors=0, stageBeats=73, beatsWithoutSpriteStage=0 | yes |
| `design-intent` | 🟡 REVIEW | 0.80 | `DESKTOP_GUTTERS_WIDE` | beats=80, depthGaugeSightings=0, timingLaneSightings=0, illustratedStillSightings=0, twoTapPromptSightings=0, beatsWithHorizontalOverflow=0 | yes |
| `preview-regression` | 🟡 REVIEW | 0.75 | `EVIDENCE_PIXEL_DRIFT:title-390` `EVIDENCE_PIXEL_DRIFT:title-1280` `EVIDENCE_PIXEL_DRIFT:select-390` | committedPairsCompared=10, committedStructuralDrift=0, committedPixelDrift=3, committedFreshMissing=0, referenceSha=1151569c40c77485ab9e9299e5db0db022437a8a, tokenDriftVsReference=none | yes |
| `document-contract-conflict` | 🟡 REVIEW | 0.99 | `DOCUMENT_CONTRACT_CONFLICT` `IRON_AMBER_DOC_ABSENT_AT_TARGET` | brief=preserve the real Session A career-mode mechanics / use the career-mode sprite athlete / present it inside the Iron & Amber visual system / keep the athlete grounded on the platform / use responsive full-stage composition / use nearest-neighbor rendering / reject raw centered sprite tiles, giant gutters, floating athletes, still-image animation, and two-tap timing demos | yes |
| `flow` | ⚪ ABSTAIN | 0.00 | `NOT_IMPLEMENTED` | plannedMeasurements=screen graph coverage, dead ends, return paths, time-to-first-input | yes |
| `balance` | ⚪ ABSTAIN | 0.00 | `NOT_IMPLEMENTED` | plannedMeasurements=make/miss rates per lift and load ratio across seeds, opener suggestions vs e1RM | yes |
| `input-fairness` | ⚪ ABSTAIN | 0.00 | `NOT_IMPLEMENTED` | plannedMeasurements=cue window widths vs fatigue, press/hold latency budget, keyboard vs pointer parity | yes |
| `progression` | ⚪ ABSTAIN | 0.00 | `NOT_IMPLEMENTED` | plannedMeasurements=e1RM and streak deltas per outcome, server-authoritative boundary checks | yes |
| `playtest` | ⚪ ABSTAIN | 0.00 | `NOT_IMPLEMENTED` `HUMAN_PLAYTEST_REQUIRED` | plannedMeasurements=feel, pacing, tension; cannot be established by tooling | yes |

## Blockers

- mechanics-frame-parity: PHASE_PATH_MISMATCH:desktop-squat-a1, RESOLUTION_MISMATCH:desktop-squat-a1, PHASE_PATH_MISMATCH:desktop-bench-a1, RESOLUTION_MISMATCH:desktop-bench-a1, INPUT_PLAN_DIVERGED:desktop-bench-a1, PHASE_PATH_MISMATCH:desktop-deadlift-a1, RESOLUTION_MISMATCH:desktop-deadlift-a1, FRAME_PARITY_MISMATCH, PROMPT_PARITY_MISMATCH, COMMAND_PARITY_MISMATCH
- attempt-matrix: ATTEMPT_MATRIX_NOT_18, CASE_MISSING:desktop-squat-a2, CASE_MISSING:desktop-squat-a3, CASE_MISSING:desktop-bench-a2, CASE_MISSING:desktop-bench-a3, CASE_MISSING:desktop-deadlift-a2, CASE_MISSING:desktop-deadlift-a3, FRAME_PARITY_MISMATCH:desktop-squat-a1, FRAME_PARITY_MISMATCH:desktop-bench-a1, FRAME_PARITY_MISMATCH:desktop-deadlift-a1, FRAME_PARITY_MISMATCH
- sprite-grounding: STILL_IMAGE_ANIMATION:desktop-squat-a1, HOLE_FRAME_MISSING:desktop-squat-a1, STILL_IMAGE_ANIMATION:desktop-bench-a1, HOLE_FRAME_MISSING:desktop-bench-a1, STILL_IMAGE_ANIMATION:desktop-deadlift-a1

## Details

### source-identity — ✅ PASS (confidence 0.99)

Mechanics files match both the pinned hashes and the authority commit; sprite art is unchanged from the reference.


| Metric | Value |
|---|---|
| targetSha | f4b529a8612dd3da374fa654c16cabe82f85d864 |
| worktreeHead | f4b529a8612dd3da374fa654c16cabe82f85d864 |
| authority.src/game/lift.ts | 4dc74947ffc64f1af36da92c01a7cfb53d3f021b802cba31f67c3ecdcb24e417 |
| authority.src/game/liftTuning.ts | ef920d59eecdb5ac698f7515a1efe4af1c7ee0e38f9079f7f9cd6deace441f2a |
| target.arcade/src/game/lift.ts | 4dc74947ffc64f1af36da92c01a7cfb53d3f021b802cba31f67c3ecdcb24e417 |
| target.arcade/src/game/liftTuning.ts | ef920d59eecdb5ac698f7515a1efe4af1c7ee0e38f9079f7f9cd6deace441f2a |
| target.arcade/src/feel.ts | b26c21b520d17a8e87e6abac17661fc219870a2320a376b5b1b1adfe0bc2425c |
| edition.MECHANICS_SHA | 288db32c06232bb0fb65ce7236a0614c698a6920 |
| edition.BASE_SHA | 1151569c40c77485ab9e9299e5db0db022437a8a |
| edition.PREVIEW_BUILD | original-sprite-restore-20260918 |
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
- git: `diff 1151569c40c77485ab9e9299e5db0db022437a8a..f4b529a8612dd3da374fa654c16cabe82f85d864 -- arcade/public/sprites`

### served-identity — ✅ PASS (confidence 0.98)

The served page is this run's fresh build and every screen declares the configured mechanics and base SHAs.


| Metric | Value |
|---|---|
| servedUrl | http://127.0.0.1:34545 |
| servedScriptSha256 | efe975b9f7456e5a7416c4df26f4e03cae384396c0f0719efa27f2e2006cc156 |
| freshBuildScriptSha256 | efe975b9f7456e5a7416c4df26f4e03cae384396c0f0719efa27f2e2006cc156 |
| servedSpritesChecked | 52 |
| servedSpritesDifferFromWorktree | 0 |
| servedSpritesDifferFromReference | 0 |
| beats | 80 |
| beatsMissingServedSha | 0 |
| beatsWithMismatchedServedSha | 0 |
| beatsWithWrongVisualShell | 0 |
| previewBuild | original-sprite-restore-20260918 |
| servedPort | 34545 |
| provenance.targetSha | f4b529a8612dd3da374fa654c16cabe82f85d864 |
| provenance.port | 34545 |

Evidence:

- url: `http://127.0.0.1:34545` (sha256 a38116a593da) — index.html
- url: `http://127.0.0.1:34545/__provenance.json` — analysis-server provenance

### existing-tests — ✅ PASS (confidence 0.95)

The target's node tests, sprite QA and vitest parity suite all exited 0 in this run.


| Metric | Value |
|---|---|
| exit:npm test | 0 |

Evidence:

- command: `npm test` — exit 0 in 5178 ms

### mechanics-frame-parity — 🔴 FAIL (confidence 0.97)

The rendered lift did not track the frozen mechanics everywhere; see flags.

Flags: `PHASE_PATH_MISMATCH:desktop-squat-a1`, `RESOLUTION_MISMATCH:desktop-squat-a1`, `PHASE_PATH_MISMATCH:desktop-bench-a1`, `RESOLUTION_MISMATCH:desktop-bench-a1`, `INPUT_PLAN_DIVERGED:desktop-bench-a1`, `PHASE_PATH_MISMATCH:desktop-deadlift-a1`, `RESOLUTION_MISMATCH:desktop-deadlift-a1`, `FRAME_PARITY_MISMATCH`, `PROMPT_PARITY_MISMATCH`, `COMMAND_PARITY_MISMATCH`

| Metric | Value |
|---|---|
| phone-squat-a1.samples | 155 |
| phone-squat-a1.heldBeforeFirstInput | false |
| phone-squat-a1.firstPressFrame | 29 |
| phone-squat-a1.firstMotionFrame | 29 |
| phone-squat-a1.firstPressAccepted | true |
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
| phone-squat-a2.firstPressAccepted | true |
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
| phone-squat-a3.firstPressAccepted | true |
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
| phone-bench-a1.firstPressAccepted | true |
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
| phone-bench-a2.firstPressAccepted | true |
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
| phone-bench-a3.firstPressAccepted | true |
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
| phone-deadlift-a1.firstPressAccepted | true |
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
| phone-deadlift-a2.firstPressAccepted | true |
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
| phone-deadlift-a3.firstPressAccepted | true |
| phone-deadlift-a3.browserPhasePath | BRACE>ASCENT |
| phone-deadlift-a3.probePhasePath | BRACE>ASCENT |
| phone-deadlift-a3.browserEnd | judging |
| phone-deadlift-a3.probeEnd | judging |
| phone-deadlift-a3.inputPlanMatch | true |
| phone-deadlift-a3.frameMismatchFraction | 0 |
| phone-deadlift-a3.numericMismatchFraction | 0 |
| phone-deadlift-a3.laggedFraction | 0 |
| desktop-squat-a1.samples | 277 |
| desktop-squat-a1.heldBeforeFirstInput | false |
| desktop-squat-a1.firstPressFrame | 29 |
| desktop-squat-a1.firstMotionFrame | – |
| desktop-squat-a1.firstPressAccepted | true |
| desktop-squat-a1.browserPhasePath | BRACE |
| desktop-squat-a1.probePhasePath | BRACE>DESCENT>HOLE>ASCENT>LOCKOUT |
| desktop-squat-a1.browserEnd | play |
| desktop-squat-a1.probeEnd | judging |
| desktop-squat-a1.inputPlanMatch | true |
| desktop-squat-a1.frameMismatchFraction | 0.8089 |
| desktop-squat-a1.numericMismatchFraction | 0 |
| desktop-squat-a1.laggedFraction | 0.0064 |
| desktop-bench-a1.samples | 364 |
| desktop-bench-a1.heldBeforeFirstInput | false |
| desktop-bench-a1.firstPressFrame | 21 |
| desktop-bench-a1.firstMotionFrame | – |
| desktop-bench-a1.firstPressAccepted | true |
| desktop-bench-a1.browserPhasePath | BRACE |
| desktop-bench-a1.probePhasePath | BRACE>DESCENT>HOLE>ASCENT>LOCKOUT |
| desktop-bench-a1.browserEnd | play |
| desktop-bench-a1.probeEnd | judging |
| desktop-bench-a1.inputPlanMatch | false |
| desktop-bench-a1.frameMismatchFraction | 0.9098 |
| desktop-bench-a1.numericMismatchFraction | 0 |
| desktop-bench-a1.laggedFraction | 0.0041 |
| desktop-deadlift-a1.samples | 372 |
| desktop-deadlift-a1.heldBeforeFirstInput | false |
| desktop-deadlift-a1.firstPressFrame | 36 |
| desktop-deadlift-a1.firstMotionFrame | – |
| desktop-deadlift-a1.firstPressAccepted | true |
| desktop-deadlift-a1.browserPhasePath | BRACE |
| desktop-deadlift-a1.probePhasePath | BRACE>ASCENT>LOCKOUT |
| desktop-deadlift-a1.browserEnd | play |
| desktop-deadlift-a1.probeEnd | judging |
| desktop-deadlift-a1.inputPlanMatch | true |
| desktop-deadlift-a1.frameMismatchFraction | 0.8532 |
| desktop-deadlift-a1.numericMismatchFraction | 0 |
| desktop-deadlift-a1.laggedFraction | 0.004 |
| tracesCompared | 12 |
| framesCompared | 2723 |
| frameMismatchFraction | 0.2071 |
| framesComparedExcludingLeakedTraces | 2723 |
| frameMismatchFractionExcludingLeakedTraces | 0.2071 |
| numericMismatchFraction | 0 |
| promptMismatchFraction | 0.2071 |
| commandMismatchFraction | 0.0375 |
| renderLaggedFraction | 0.0011 |
| oracleChecked | 3083 |
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
- json: `trace:desktop-squat-a1` — 157 play frames compared
- json: `trace:desktop-bench-a1` — 244 play frames compared
- json: `trace:desktop-deadlift-a1` — 252 play frames compared

### attempt-matrix — 🔴 FAIL (confidence 0.85)

The multi-attempt matrix did not verify cleanly; see flags.

Flags: `ATTEMPT_MATRIX_NOT_18`, `CASE_MISSING:desktop-squat-a2`, `CASE_MISSING:desktop-squat-a3`, `CASE_MISSING:desktop-bench-a2`, `CASE_MISSING:desktop-bench-a3`, `CASE_MISSING:desktop-deadlift-a2`, `CASE_MISSING:desktop-deadlift-a3`, `FRAME_PARITY_MISMATCH:desktop-squat-a1`, `FRAME_PARITY_MISMATCH:desktop-bench-a1`, `FRAME_PARITY_MISMATCH:desktop-deadlift-a1`, `FRAME_PARITY_MISMATCH`

| Metric | Value |
|---|---|
| attemptsPerLift | 3 |
| caseCount | 12 |
| traceCount | 12 |
| expectedCaseCount | 18 |
| phone-squat-a1.targetSha | f4b529a8612dd3da374fa654c16cabe82f85d864 |
| phone-squat-a1.servedSha | 288db32c06232bb0fb65ce7236a0614c698a6920 |
| phone-squat-a1.viewport | phone |
| phone-squat-a1.lift | squat |
| phone-squat-a1.attempt | 1 |
| phone-squat-a1.heldBeforeFirstInput | false |
| phone-squat-a1.firstPressAccepted | true |
| phone-squat-a1.finalJudgment | judging |
| phone-squat-a1.probeJudgment | judging |
| phone-squat-a1.mechanicsPhasePath | BRACE>DESCENT>HOLE>ASCENT>LOCKOUT |
| phone-squat-a1.probePhasePath | BRACE>DESCENT>HOLE>ASCENT>LOCKOUT |
| phone-squat-a1.inputEvents | 29:press,81:release,116:press |
| phone-squat-a1.horizontalOverflow | false |
| phone-squat-a1.consoleErrors | 0 |
| phone-squat-a1.grounded | true |
| phone-squat-a1.frameMismatch | 0 |
| phone-squat-a1.framesCompared | 155 |
| phone-squat-a1.missMatchesMechanics | – |
| phone-squat-a2.targetSha | f4b529a8612dd3da374fa654c16cabe82f85d864 |
| phone-squat-a2.servedSha | 288db32c06232bb0fb65ce7236a0614c698a6920 |
| phone-squat-a2.viewport | phone |
| phone-squat-a2.lift | squat |
| phone-squat-a2.attempt | 2 |
| phone-squat-a2.heldBeforeFirstInput | false |
| phone-squat-a2.firstPressAccepted | true |
| phone-squat-a2.finalJudgment | judging |
| phone-squat-a2.probeJudgment | judging |
| phone-squat-a2.mechanicsPhasePath | BRACE>DESCENT>HOLE>ASCENT>LOCKOUT |
| phone-squat-a2.probePhasePath | BRACE>DESCENT>HOLE>ASCENT>LOCKOUT |
| phone-squat-a2.inputEvents | 31:press,86:release,123:press |
| phone-squat-a2.horizontalOverflow | false |
| phone-squat-a2.consoleErrors | 0 |
| phone-squat-a2.grounded | true |
| phone-squat-a2.frameMismatch | 0 |
| phone-squat-a2.framesCompared | 167 |
| phone-squat-a2.missMatchesMechanics | – |
| phone-squat-a3.targetSha | f4b529a8612dd3da374fa654c16cabe82f85d864 |
| phone-squat-a3.servedSha | 288db32c06232bb0fb65ce7236a0614c698a6920 |
| phone-squat-a3.viewport | phone |
| phone-squat-a3.lift | squat |
| phone-squat-a3.attempt | 3 |
| phone-squat-a3.heldBeforeFirstInput | false |
| phone-squat-a3.firstPressAccepted | true |
| phone-squat-a3.finalJudgment | judging |
| phone-squat-a3.probeJudgment | judging |
| phone-squat-a3.mechanicsPhasePath | BRACE>DESCENT>HOLE>ASCENT>LOCKOUT |
| phone-squat-a3.probePhasePath | BRACE>DESCENT>HOLE>ASCENT>LOCKOUT |
| phone-squat-a3.inputEvents | 32:press,90:release,129:press |
| phone-squat-a3.horizontalOverflow | false |
| phone-squat-a3.consoleErrors | 0 |
| phone-squat-a3.grounded | true |
| phone-squat-a3.frameMismatch | 0 |
| phone-squat-a3.framesCompared | 180 |
| phone-squat-a3.missMatchesMechanics | – |
| phone-bench-a1.targetSha | f4b529a8612dd3da374fa654c16cabe82f85d864 |
| phone-bench-a1.servedSha | 288db32c06232bb0fb65ce7236a0614c698a6920 |
| phone-bench-a1.viewport | phone |
| phone-bench-a1.lift | bench |
| phone-bench-a1.attempt | 1 |
| phone-bench-a1.heldBeforeFirstInput | false |
| phone-bench-a1.firstPressAccepted | true |
| phone-bench-a1.finalJudgment | judging |
| phone-bench-a1.probeJudgment | judging |
| phone-bench-a1.mechanicsPhasePath | BRACE>DESCENT>HOLE>ASCENT>LOCKOUT |
| phone-bench-a1.probePhasePath | BRACE>DESCENT>HOLE>ASCENT>LOCKOUT |
| phone-bench-a1.inputEvents | 21:press,133:release,135:press,136:release,138:press,139:release,141:press,142:release,144:press,145:release,147:press,148:release,151:press,152:release,154:press,155:release,157:press,158:release,160:press,161:release,163:press,164:release,166:press,167:release,169:press,170:release,172:press,173:release,176:press,177:release,179:press,180:release,182:press,183:release,185:press,186:release,188:press,189:release,191:press,192:release,194:press,195:release,197:press,198:release,201:press,202:release,204:press,205:release,207:press,208:release,210:press,211:release,213:press,214:release,216:press,217:release,219:press,220:release,222:press,223:release,226:press,227:release,229:press,230:release,232:press,233:release,235:press,236:release,238:press,239:release,241:press,242:release |
| phone-bench-a1.horizontalOverflow | false |
| phone-bench-a1.consoleErrors | 0 |
| phone-bench-a1.grounded | true |
| phone-bench-a1.frameMismatch | 0 |
| phone-bench-a1.framesCompared | 242 |
| phone-bench-a1.missMatchesMechanics | – |
| phone-bench-a2.targetSha | f4b529a8612dd3da374fa654c16cabe82f85d864 |
| phone-bench-a2.servedSha | 288db32c06232bb0fb65ce7236a0614c698a6920 |
| phone-bench-a2.viewport | phone |
| phone-bench-a2.lift | bench |
| phone-bench-a2.attempt | 2 |
| phone-bench-a2.heldBeforeFirstInput | false |
| phone-bench-a2.firstPressAccepted | true |
| phone-bench-a2.finalJudgment | judging |
| phone-bench-a2.probeJudgment | judging |
| phone-bench-a2.mechanicsPhasePath | BRACE>DESCENT>HOLE>ASCENT>LOCKOUT |
| phone-bench-a2.probePhasePath | BRACE>DESCENT>HOLE>ASCENT>LOCKOUT |
| phone-bench-a2.inputEvents | 23:press,194:release,196:press,197:release,199:press,201:release,203:press,204:release,206:press,207:release,209:press,210:release,212:press,213:release,215:press,216:release,218:press,219:release,221:press,222:release,224:press,226:release,228:press,229:release,231:press,232:release,234:press,235:release,237:press,238:release,240:press,241:release,243:press,244:release,246:press,247:release,249:press,251:release,253:press,254:release,256:press,257:release,259:press,260:release,262:press,263:release,265:press,266:release,268:press,269:release,271:press,272:release,274:press,276:release,278:press,279:release,281:press,282:release,284:press,285:release,287:press,288:release,290:press,291:release,293:press,294:release,296:press,297:release,299:press,301:release,303:press,304:release,306:press,307:release,309:press,310:release,312:press,313:release,315:press,316:release,318:press,319:release,321:press,322:release,324:press,326:release,328:press,329:release,331:press,332:release,334:press,335:release,337:press,338:release,340:press,341:release,343:press,344:release |
| phone-bench-a2.horizontalOverflow | false |
| phone-bench-a2.consoleErrors | 0 |
| phone-bench-a2.grounded | true |
| phone-bench-a2.frameMismatch | 0 |
| phone-bench-a2.framesCompared | 345 |
| phone-bench-a2.missMatchesMechanics | – |
| phone-bench-a3.targetSha | f4b529a8612dd3da374fa654c16cabe82f85d864 |
| phone-bench-a3.servedSha | 288db32c06232bb0fb65ce7236a0614c698a6920 |
| phone-bench-a3.viewport | phone |
| phone-bench-a3.lift | bench |
| phone-bench-a3.attempt | 3 |
| phone-bench-a3.heldBeforeFirstInput | false |
| phone-bench-a3.firstPressAccepted | true |
| phone-bench-a3.finalJudgment | judging |
| phone-bench-a3.probeJudgment | judging |
| phone-bench-a3.mechanicsPhasePath | BRACE>DESCENT>HOLE>ASCENT>LOCKOUT |
| phone-bench-a3.probePhasePath | BRACE>DESCENT>HOLE>ASCENT>LOCKOUT |
| phone-bench-a3.inputEvents | 24:press,198:release,201:press,202:release,204:press,205:release,207:press,208:release,210:press,211:release,213:press,214:release,216:press,217:release,219:press,220:release,222:press,223:release,226:press,227:release,229:press,230:release,232:press,233:release,235:press,236:release,238:press,239:release,241:press,242:release,244:press,245:release,247:press,248:release,251:press,252:release,254:press,255:release,257:press,258:release,260:press,261:release,263:press,264:release,266:press,267:release,269:press,270:release,272:press,273:release,276:press,277:release,279:press,280:release,282:press,283:release,285:press,286:release,288:press,289:release,291:press,292:release,294:press,295:release,297:press,298:release,301:press,302:release,304:press,305:release,307:press,308:release,310:press,311:release,313:press,314:release,316:press,317:release,319:press,320:release,322:press,323:release,326:press,327:release,329:press,330:release,332:press,333:release,335:press,336:release,338:press,339:release,341:press,342:release,344:press,345:release,347:press,348:release,351:press,352:release,354:press,355:release,357:press,358:release,360:press,361:release,363:press,364:release |
| phone-bench-a3.horizontalOverflow | false |
| phone-bench-a3.consoleErrors | 0 |
| phone-bench-a3.grounded | true |
| phone-bench-a3.frameMismatch | 0 |
| phone-bench-a3.framesCompared | 365 |
| phone-bench-a3.missMatchesMechanics | – |
| phone-deadlift-a1.targetSha | f4b529a8612dd3da374fa654c16cabe82f85d864 |
| phone-deadlift-a1.servedSha | 288db32c06232bb0fb65ce7236a0614c698a6920 |
| phone-deadlift-a1.viewport | phone |
| phone-deadlift-a1.lift | deadlift |
| phone-deadlift-a1.attempt | 1 |
| phone-deadlift-a1.heldBeforeFirstInput | false |
| phone-deadlift-a1.firstPressAccepted | true |
| phone-deadlift-a1.finalJudgment | judging |
| phone-deadlift-a1.probeJudgment | judging |
| phone-deadlift-a1.mechanicsPhasePath | BRACE>ASCENT>LOCKOUT |
| phone-deadlift-a1.probePhasePath | BRACE>ASCENT>LOCKOUT |
| phone-deadlift-a1.inputEvents | 36:press |
| phone-deadlift-a1.horizontalOverflow | false |
| phone-deadlift-a1.consoleErrors | 0 |
| phone-deadlift-a1.grounded | true |
| phone-deadlift-a1.frameMismatch | 0 |
| phone-deadlift-a1.framesCompared | 250 |
| phone-deadlift-a1.missMatchesMechanics | – |
| phone-deadlift-a2.targetSha | f4b529a8612dd3da374fa654c16cabe82f85d864 |
| phone-deadlift-a2.servedSha | 288db32c06232bb0fb65ce7236a0614c698a6920 |
| phone-deadlift-a2.viewport | phone |
| phone-deadlift-a2.lift | deadlift |
| phone-deadlift-a2.attempt | 2 |
| phone-deadlift-a2.heldBeforeFirstInput | false |
| phone-deadlift-a2.firstPressAccepted | true |
| phone-deadlift-a2.finalJudgment | judging |
| phone-deadlift-a2.probeJudgment | judging |
| phone-deadlift-a2.mechanicsPhasePath | BRACE>ASCENT |
| phone-deadlift-a2.probePhasePath | BRACE>ASCENT |
| phone-deadlift-a2.inputEvents | 38:press |
| phone-deadlift-a2.horizontalOverflow | false |
| phone-deadlift-a2.consoleErrors | 0 |
| phone-deadlift-a2.grounded | true |
| phone-deadlift-a2.frameMismatch | 0 |
| phone-deadlift-a2.framesCompared | 148 |
| phone-deadlift-a2.missMatchesMechanics | true |
| phone-deadlift-a2.deadliftMissClassified | mechanics |
| phone-deadlift-a3.targetSha | f4b529a8612dd3da374fa654c16cabe82f85d864 |
| phone-deadlift-a3.servedSha | 288db32c06232bb0fb65ce7236a0614c698a6920 |
| phone-deadlift-a3.viewport | phone |
| phone-deadlift-a3.lift | deadlift |
| phone-deadlift-a3.attempt | 3 |
| phone-deadlift-a3.heldBeforeFirstInput | false |
| phone-deadlift-a3.firstPressAccepted | true |
| phone-deadlift-a3.finalJudgment | judging |
| phone-deadlift-a3.probeJudgment | judging |
| phone-deadlift-a3.mechanicsPhasePath | BRACE>ASCENT |
| phone-deadlift-a3.probePhasePath | BRACE>ASCENT |
| phone-deadlift-a3.inputEvents | 41:press,158:release,159:press |
| phone-deadlift-a3.horizontalOverflow | false |
| phone-deadlift-a3.consoleErrors | 0 |
| phone-deadlift-a3.grounded | true |
| phone-deadlift-a3.frameMismatch | 0 |
| phone-deadlift-a3.framesCompared | 218 |
| phone-deadlift-a3.missMatchesMechanics | true |
| phone-deadlift-a3.deadliftMissClassified | mechanics |
| desktop-squat-a1.targetSha | f4b529a8612dd3da374fa654c16cabe82f85d864 |
| desktop-squat-a1.servedSha | 288db32c06232bb0fb65ce7236a0614c698a6920 |
| desktop-squat-a1.viewport | desktop |
| desktop-squat-a1.lift | squat |
| desktop-squat-a1.attempt | 1 |
| desktop-squat-a1.heldBeforeFirstInput | false |
| desktop-squat-a1.firstPressAccepted | true |
| desktop-squat-a1.finalJudgment | play |
| desktop-squat-a1.probeJudgment | judging |
| desktop-squat-a1.mechanicsPhasePath | BRACE |
| desktop-squat-a1.probePhasePath | BRACE>DESCENT>HOLE>ASCENT>LOCKOUT |
| desktop-squat-a1.inputEvents | 29:press,81:release,116:press |
| desktop-squat-a1.horizontalOverflow | false |
| desktop-squat-a1.consoleErrors | 0 |
| desktop-squat-a1.grounded | true |
| desktop-squat-a1.frameMismatch | 128 |
| desktop-squat-a1.framesCompared | 157 |
| desktop-squat-a1.missMatchesMechanics | – |
| desktop-bench-a1.targetSha | f4b529a8612dd3da374fa654c16cabe82f85d864 |
| desktop-bench-a1.servedSha | 288db32c06232bb0fb65ce7236a0614c698a6920 |
| desktop-bench-a1.viewport | desktop |
| desktop-bench-a1.lift | bench |
| desktop-bench-a1.attempt | 1 |
| desktop-bench-a1.heldBeforeFirstInput | false |
| desktop-bench-a1.firstPressAccepted | true |
| desktop-bench-a1.finalJudgment | play |
| desktop-bench-a1.probeJudgment | judging |
| desktop-bench-a1.mechanicsPhasePath | BRACE |
| desktop-bench-a1.probePhasePath | BRACE>DESCENT>HOLE>ASCENT>LOCKOUT |
| desktop-bench-a1.inputEvents | 21:press,133:release,135:press,136:release,138:press,139:release,141:press,142:release,144:press,145:release,147:press,148:release,151:press,152:release,154:press,155:release,157:press,158:release,160:press,161:release,163:press,164:release,166:press,167:release,169:press,170:release,172:press,173:release,176:press,177:release,179:press,180:release,182:press,183:release,185:press,186:release,188:press,189:release,191:press,192:release,194:press,195:release,197:press,198:release,201:press,202:release,204:press,205:release,207:press,208:release,210:press,211:release,213:press,214:release,216:press,217:release,219:press,220:release,222:press,223:release,226:press,227:release,229:press,230:release,232:press,233:release,235:press,236:release,238:press,239:release,241:press,242:release,244:press,245:release,247:press,248:release,251:press,252:release,254:press,255:release,257:press,258:release,260:press,261:release,263:press,264:release,266:press,267:release,269:press,270:release,272:press,273:release,276:press,277:release,279:press,280:release,282:press,283:release,285:press,286:release,288:press,289:release,291:press,292:release,294:press,295:release,297:press,298:release,301:press,302:release,304:press,305:release,307:press,308:release,310:press,311:release,313:press,314:release,316:press,317:release,319:press,320:release,322:press,323:release,326:press,327:release,329:press,330:release,332:press,333:release,335:press,336:release,338:press,339:release,341:press,342:release,344:press,345:release,347:press,348:release,351:press,352:release,354:press,355:release,357:press,358:release,360:press,361:release,363:press |
| desktop-bench-a1.horizontalOverflow | false |
| desktop-bench-a1.consoleErrors | 0 |
| desktop-bench-a1.grounded | true |
| desktop-bench-a1.frameMismatch | 223 |
| desktop-bench-a1.framesCompared | 244 |
| desktop-bench-a1.missMatchesMechanics | – |
| desktop-deadlift-a1.targetSha | f4b529a8612dd3da374fa654c16cabe82f85d864 |
| desktop-deadlift-a1.servedSha | 288db32c06232bb0fb65ce7236a0614c698a6920 |
| desktop-deadlift-a1.viewport | desktop |
| desktop-deadlift-a1.lift | deadlift |
| desktop-deadlift-a1.attempt | 1 |
| desktop-deadlift-a1.heldBeforeFirstInput | false |
| desktop-deadlift-a1.firstPressAccepted | true |
| desktop-deadlift-a1.finalJudgment | play |
| desktop-deadlift-a1.probeJudgment | judging |
| desktop-deadlift-a1.mechanicsPhasePath | BRACE |
| desktop-deadlift-a1.probePhasePath | BRACE>ASCENT>LOCKOUT |
| desktop-deadlift-a1.inputEvents | 36:press |
| desktop-deadlift-a1.horizontalOverflow | false |
| desktop-deadlift-a1.consoleErrors | 0 |
| desktop-deadlift-a1.grounded | true |
| desktop-deadlift-a1.frameMismatch | 216 |
| desktop-deadlift-a1.framesCompared | 252 |
| desktop-deadlift-a1.missMatchesMechanics | – |
| heldLeaks | 0 |
| firstPressRejected | 0 |
| overflowCases | 0 |
| consoleErrorEvents | 0 |
| ungroundedCases | 0 |
| framesCompared | 2723 |
| frameMismatchTotal | 567 |
| deadliftMissMatchesMechanics | 2 |
| deadliftMissMisclassified | 0 |
| holdPad.controllerPresent | true |
| holdPad.hasPointerUp | true |
| holdPad.hasPointerCancel | true |
| holdPad.hasScreenChanged | true |
| holdPad.hasDispose | true |
| holdPad.hasResetClear | true |

Evidence:

- json: `case:phone-squat-a1` — phone squat a1
- json: `case:phone-squat-a2` — phone squat a2
- json: `case:phone-squat-a3` — phone squat a3
- json: `case:phone-bench-a1` — phone bench a1
- json: `case:phone-bench-a2` — phone bench a2
- json: `case:phone-bench-a3` — phone bench a3
- json: `case:phone-deadlift-a1` — phone deadlift a1
- json: `case:phone-deadlift-a2` — phone deadlift a2
- json: `case:phone-deadlift-a3` — phone deadlift a3
- json: `case:desktop-squat-a1` — desktop squat a1
- json: `case:desktop-bench-a1` — desktop bench a1
- json: `case:desktop-deadlift-a1` — desktop deadlift a1

### sprite-grounding — 🔴 FAIL (confidence 0.90)

Grounding or continuity evidence is incomplete or contradicted; see flags.

Flags: `STILL_IMAGE_ANIMATION:desktop-squat-a1`, `HOLE_FRAME_MISSING:desktop-squat-a1`, `STILL_IMAGE_ANIMATION:desktop-bench-a1`, `HOLE_FRAME_MISSING:desktop-bench-a1`, `STILL_IMAGE_ANIMATION:desktop-deadlift-a1`

| Metric | Value |
|---|---|
| stage.contactY | 318 |
| stage.size | 320x320 |
| anchorRowsChecked | 48 |
| anchorRowsMismatched | 0 |
| framesWithFringe | 0 |
| framesOver48Colors | 0 |
| stageBeats | 73 |
| beatsWithoutSpriteStage | 0 |
| beatsMissingWorldY | 0 |
| beatsNotGrounded | 0 |
| beatsAnchorArithmeticBroken | 0 |
| beatsCanvasSizeWrong | 0 |
| canvasProofs | 73 |
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
| desktop-squat-a1.distinctFrames | 1 |
| desktop-squat-a1.frameJumpsWithinPhase | 0 |
| desktop-squat-a1.groundLineValues | 318 |
| desktop-squat-a1.frameAtMaxDepth | 0 |
| desktop-squat-a1.footDriftPx | 0 |
| desktop-bench-a1.distinctFrames | 1 |
| desktop-bench-a1.frameJumpsWithinPhase | 0 |
| desktop-bench-a1.groundLineValues | 318 |
| desktop-bench-a1.frameAtMaxDepth | 0 |
| desktop-bench-a1.footDriftPx | 0 |
| desktop-deadlift-a1.distinctFrames | 1 |
| desktop-deadlift-a1.frameJumpsWithinPhase | 0 |
| desktop-deadlift-a1.groundLineValues | 318 |
| desktop-deadlift-a1.footDriftPx | 0 |
| tracesAnalysed | 12 |

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
- canvas: `evidence/desktop-05-bench-attempts.canvas.png` — desktop-05-bench-attempts: bench stage mismatch 0, lifter pixels off 0/33990, scale 1
- canvas: `evidence/desktop-06-bench-walkout.canvas.png` — desktop-06-bench-walkout: bench stage mismatch 0, lifter pixels off 0/33990, scale 1
- canvas: `evidence/desktop-07-bench-brace.canvas.png` — desktop-07-bench-brace: bench stage mismatch 0, lifter pixels off 0/33990, scale 1
- canvas: `evidence/desktop-08-deadlift-attempts.canvas.png` — desktop-08-deadlift-attempts: deadlift stage mismatch 0, lifter pixels off 0/17342, scale 1
- canvas: `evidence/desktop-09-deadlift-walkout.canvas.png` — desktop-09-deadlift-walkout: deadlift stage mismatch 0, lifter pixels off 0/17342, scale 1
- canvas: `evidence/desktop-10-deadlift-brace.canvas.png` — desktop-10-deadlift-brace: deadlift stage mismatch 0, lifter pixels off 0/17342, scale 1

### design-intent — 🟡 REVIEW (confidence 0.80)

The served build departs from the brief or needs a human look; see flags.

Flags: `DESKTOP_GUTTERS_WIDE`

| Metric | Value |
|---|---|
| beats | 80 |
| phone.token.--color-iron | #14110f |
| phone.token.--color-ink | #f4efe4 |
| phone.token.--color-amber | #d4892a |
| phone.token.--color-paper | #f3e6c8 |
| phone.token.--color-red-light | #b83228 |
| phone.token.--color-white-light | #f7f3ea |
| phone.displayFontLoaded | true |
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
| stageBeats | 73 |
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
| editionBanner | – |
| legacySpritesAttr | true |
| pageErrors | 0 |
| liftsPlayed | squat,bench,deadlift |

Evidence:

- screenshot: `evidence/phone-00-none-title.png` — phone title
- screenshot: `evidence/desktop-00-none-title.png` — desktop title

### preview-regression — 🟡 REVIEW (confidence 0.75)

The fresh preview drifted from committed evidence or the reference, or a comparison could not run; see flags.

Flags: `EVIDENCE_PIXEL_DRIFT:title-390`, `EVIDENCE_PIXEL_DRIFT:title-1280`, `EVIDENCE_PIXEL_DRIFT:select-390`

| Metric | Value |
|---|---|
| pixel.title-390.meanAbsDiff | 0.1243 |
| pixel.title-390.sizeMatch | true |
| pixel.title-1280.meanAbsDiff | 0.1004 |
| pixel.title-1280.sizeMatch | true |
| pixel.select-390.meanAbsDiff | 0.0664 |
| pixel.select-390.sizeMatch | true |
| pixel.squat-brace-390.meanAbsDiff | 0.1758 |
| pixel.squat-brace-390.sizeMatch | true |
| pixel.squat-brace-390.stageAlignedMeanAbsDiff | 0 |
| pixel.squat-brace-390.stageAlignedOffsetY | 28 |
| pixel.squat-brace-1280.meanAbsDiff | 0.05 |
| pixel.squat-brace-1280.sizeMatch | true |
| pixel.squat-brace-1280.stageAlignedMeanAbsDiff | 0 |
| pixel.squat-brace-1280.stageAlignedOffsetY | 28 |
| pixel.squat-hole-390.meanAbsDiff | 0.1425 |
| pixel.squat-hole-390.sizeMatch | true |
| pixel.squat-hole-390.stageAlignedMeanAbsDiff | 0 |
| pixel.squat-hole-390.stageAlignedOffsetY | 28 |
| pixel.bench-brace-390.meanAbsDiff | 0.1757 |
| pixel.bench-brace-390.sizeMatch | true |
| pixel.bench-brace-390.stageAlignedMeanAbsDiff | 0 |
| pixel.bench-brace-390.stageAlignedOffsetY | 28 |
| pixel.bench-press-390.meanAbsDiff | 0.1464 |
| pixel.bench-press-390.sizeMatch | true |
| pixel.bench-press-390.stageAlignedMeanAbsDiff | 0 |
| pixel.bench-press-390.stageAlignedOffsetY | 28 |
| pixel.deadlift-brace-390.meanAbsDiff | 0.1729 |
| pixel.deadlift-brace-390.sizeMatch | true |
| pixel.deadlift-brace-390.stageAlignedMeanAbsDiff | 0 |
| pixel.deadlift-brace-390.stageAlignedOffsetY | 28 |
| pixel.deadlift-lock-390.meanAbsDiff | 0.1175 |
| pixel.deadlift-lock-390.sizeMatch | true |
| pixel.deadlift-lock-390.stageAlignedMeanAbsDiff | 0 |
| pixel.deadlift-lock-390.stageAlignedOffsetY | 28 |
| committedPairsCompared | 10 |
| committedStructuralDrift | 0 |
| committedPixelDrift | 3 |
| committedFreshMissing | 0 |
| referenceSha | 1151569c40c77485ab9e9299e5db0db022437a8a |
| tokenDriftVsReference | none |
| spritesComparedVsReference | 52 |
| spritesDifferingVsReference | 0 |
| referenceTitle.phone.meanAbsDiff | 0.0011 |
| referenceTitle.desktop.meanAbsDiff | 0.0011 |

Evidence:

- file: `arcade/evidence/sprite-sport` — 17 committed evidence entries
- screenshot: `evidence/phone-00-none-title.png` — vs committed committed-evidence/title-390.png: full-page meanAbsDiff 0.1243
- screenshot: `evidence/desktop-00-none-title.png` — vs committed committed-evidence/title-1280.png: full-page meanAbsDiff 0.1004
- screenshot: `evidence/phone-01-none-lift.png` — vs committed committed-evidence/select-390.png: full-page meanAbsDiff 0.0664
- screenshot: `evidence/phone-04-squat-brace.png` — vs committed committed-evidence/squat-brace-390.png: full-page meanAbsDiff 0.1758; stage region aligned at dy=28 meanAbsDiff 0
- screenshot: `evidence/desktop-04-squat-brace.png` — vs committed committed-evidence/squat-brace-1280.png: full-page meanAbsDiff 0.05; stage region aligned at dy=28 meanAbsDiff 0
- screenshot: `evidence/phone-05-squat-hole.png` — vs committed committed-evidence/squat-hole-390.png: full-page meanAbsDiff 0.1425; stage region aligned at dy=28 meanAbsDiff 0
- screenshot: `evidence/phone-26-bench-brace.png` — vs committed committed-evidence/bench-brace-390.png: full-page meanAbsDiff 0.1757; stage region aligned at dy=28 meanAbsDiff 0
- screenshot: `evidence/phone-28-bench-press.png` — vs committed committed-evidence/bench-press-390.png: full-page meanAbsDiff 0.1464; stage region aligned at dy=28 meanAbsDiff 0
- screenshot: `evidence/phone-51-deadlift-brace.png` — vs committed committed-evidence/deadlift-brace-390.png: full-page meanAbsDiff 0.1729; stage region aligned at dy=28 meanAbsDiff 0
- screenshot: `evidence/phone-53-deadlift-lock.png` — vs committed committed-evidence/deadlift-lock-390.png: full-page meanAbsDiff 0.1175; stage region aligned at dy=28 meanAbsDiff 0
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
| `npm ci --no-audit --no-fund --loglevel=error` | /tmp/twl-original-sprite-restore-wt/f4b529a8612d/arcade | 0 | 1881 |
| `npm run build` | /tmp/twl-original-sprite-restore-wt/f4b529a8612d/arcade | 0 | 6345 |
| `npm test` | /tmp/twl-original-sprite-restore-wt/f4b529a8612d/arcade | 0 | 5178 |
| `/usr/bin/node --disable-warning=ExperimentalWarning --import /tmp/twl80/tools/twl-development-analysis/src/probe/registe` | /tmp/twl-original-sprite-restore-wt/f4b529a8612d/arcade | 0 | 416 |
| `/usr/bin/node --disable-warning=ExperimentalWarning --import /tmp/twl80/tools/twl-development-analysis/src/probe/registe` | /tmp/twl-original-sprite-restore-wt/f4b529a8612d/arcade | 0 | 422 |
| `npm ci --no-audit --no-fund --loglevel=error` | /tmp/twl-original-sprite-restore-wt/1151569c40c7/arcade | 0 | 1476 |
| `npm run build` | /tmp/twl-original-sprite-restore-wt/1151569c40c7/arcade | 0 | 3823 |

