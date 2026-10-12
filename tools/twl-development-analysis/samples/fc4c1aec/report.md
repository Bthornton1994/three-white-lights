# TWL development analysis — offline-1789683816639

**Overall:** 🔴 FAIL · human approval required: **yes** · generated 2026-09-17T22:23:36.639Z

| Layer | SHA |
|---|---|
| Artifact under judgment (target) | `fc4c1aec06f0f079b851bb703f69ee67140b4f85` |
| Presentation reference | `1151569c40c77485ab9e9299e5db0db022437a8a` |
| Mechanics authority | `288db32c06232bb0fb65ce7236a0614c698a6920` |
| Served page declares | `288db32c06232bb0fb65ce7236a0614c698a6920` at http://127.0.0.1:37121 |
| Provider | twl-development-analysis 0.1.0 (deterministic-rules, node v22.22.2, playwright –, browser –) |

## Decisions

| Analyzer | Verdict | Confidence | Flags | Key metrics | Human approval |
|---|---|---|---|---|---|
| `source-identity` | ✅ PASS | 0.99 | – | targetSha=fc4c1aec06f0f079b851bb703f69ee67140b4f85, spriteFilesChangedVsReference=0, npmCiExit=0, buildExit=0 | no |
| `served-identity` | ✅ PASS | 0.98 | – | servedUrl=http://127.0.0.1:37121, servedScriptSha256=18a333c722b2bcd0f8abbd1878ac8e3f07cc69575ce9372e96e90ddb1091d0ed, freshBuildScriptSha256=18a333c722b2bcd0f8abbd1878ac8e3f07cc69575ce9372e96e90ddb1091d0ed, servedSpritesChecked=52, servedSpritesDifferFromWorktree=0, servedSpritesDifferFromReference=0 | no |
| `existing-tests` | ✅ PASS | 0.95 | – | exit:npm test=0 | no |
| `mechanics-frame-parity` | 🔴 FAIL | 0.97 | `INPUT_HELD_STATE_LEAK:phone-squat-a2` `PHASE_PATH_MISMATCH:phone-squat-a2` `INPUT_HELD_STATE_LEAK:phone-squat-a3` `PHASE_PATH_MISMATCH:phone-squat-a3` `FRAME_PARITY_MISMATCH` `PROMPT_PARITY_MISMATCH` | tracesCompared=6, framesCompared=1153, frameMismatchFraction=0.248, framesComparedExcludingLeakedTraces=802, frameMismatchFractionExcludingLeakedTraces=0, numericMismatchFraction=0 | no |
| `sprite-grounding` | ✅ PASS | 0.90 | – | anchorRowsChecked=48, anchorRowsMismatched=0, framesWithFringe=0, framesOver48Colors=0, stageBeats=39, beatsWithoutSpriteStage=0 | yes |
| `design-intent` | 🟡 REVIEW | 0.80 | `DESKTOP_GUTTERS_WIDE` `CANDIDATE_BANNER_RENDERED` `PAGE_ERRORS` | beats=44, depthGaugeSightings=0, timingLaneSightings=0, illustratedStillSightings=0, twoTapPromptSightings=0, beatsWithHorizontalOverflow=0 | yes |
| `preview-regression` | 🟡 REVIEW | 0.75 | `TITLE_DRIFT_VS_REFERENCE:phone` | committedPairsCompared=10, committedStructuralDrift=0, committedPixelDrift=0, committedFreshMissing=0, referenceSha=1151569c40c77485ab9e9299e5db0db022437a8a, tokenDriftVsReference=none | yes |
| `document-contract-conflict` | 🟡 REVIEW | 0.99 | `DOCUMENT_CONTRACT_CONFLICT` `IRON_AMBER_DOC_ABSENT_AT_TARGET` | brief=preserve the real Session A career-mode mechanics / use the career-mode sprite athlete / present it inside the Iron & Amber visual system / keep the athlete grounded on the platform / use responsive full-stage composition / use nearest-neighbor rendering / reject raw centered sprite tiles, giant gutters, floating athletes, still-image animation, and two-tap timing demos | yes |
| `flow` | ⚪ ABSTAIN | 0.00 | `NOT_IMPLEMENTED` | plannedMeasurements=screen graph coverage, dead ends, return paths, time-to-first-input | yes |
| `balance` | ⚪ ABSTAIN | 0.00 | `NOT_IMPLEMENTED` | plannedMeasurements=make/miss rates per lift and load ratio across seeds, opener suggestions vs e1RM | yes |
| `input-fairness` | ⚪ ABSTAIN | 0.00 | `NOT_IMPLEMENTED` | plannedMeasurements=cue window widths vs fatigue, press/hold latency budget, keyboard vs pointer parity | yes |
| `progression` | ⚪ ABSTAIN | 0.00 | `NOT_IMPLEMENTED` | plannedMeasurements=e1RM and streak deltas per outcome, server-authoritative boundary checks | yes |
| `playtest` | ⚪ ABSTAIN | 0.00 | `NOT_IMPLEMENTED` `HUMAN_PLAYTEST_REQUIRED` | plannedMeasurements=feel, pacing, tension; cannot be established by tooling | yes |

## Blockers

- mechanics-frame-parity: INPUT_HELD_STATE_LEAK:phone-squat-a2, PHASE_PATH_MISMATCH:phone-squat-a2, INPUT_HELD_STATE_LEAK:phone-squat-a3, PHASE_PATH_MISMATCH:phone-squat-a3, FRAME_PARITY_MISMATCH, PROMPT_PARITY_MISMATCH

## Details

### source-identity — ✅ PASS (confidence 0.99)

Mechanics files match both the pinned hashes and the authority commit; sprite art is unchanged from the reference.


| Metric | Value |
|---|---|
| targetSha | fc4c1aec06f0f079b851bb703f69ee67140b4f85 |
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
- git: `diff 1151569c40c77485ab9e9299e5db0db022437a8a..fc4c1aec06f0f079b851bb703f69ee67140b4f85 -- arcade/public/sprites`

### served-identity — ✅ PASS (confidence 0.98)

The served page is this run's fresh build and every screen declares the configured mechanics and base SHAs.


| Metric | Value |
|---|---|
| servedUrl | http://127.0.0.1:37121 |
| servedScriptSha256 | 18a333c722b2bcd0f8abbd1878ac8e3f07cc69575ce9372e96e90ddb1091d0ed |
| freshBuildScriptSha256 | 18a333c722b2bcd0f8abbd1878ac8e3f07cc69575ce9372e96e90ddb1091d0ed |
| servedSpritesChecked | 52 |
| servedSpritesDifferFromWorktree | 0 |
| servedSpritesDifferFromReference | 0 |
| beats | 44 |
| beatsMissingServedSha | 0 |
| beatsWithMismatchedServedSha | 0 |
| beatsWithWrongVisualShell | 0 |
| previewBuild | sprite-sport-20260917 |

Evidence:

- url: `http://127.0.0.1:37121` (sha256 a50e63d4955e) — index.html

### existing-tests — ✅ PASS (confidence 0.95)

The target's node tests, sprite QA and vitest parity suite all exited 0 in this run.


| Metric | Value |
|---|---|
| exit:npm test | 0 |

Evidence:

- command: `npm test` — exit 0 in 4475 ms

### mechanics-frame-parity — 🔴 FAIL (confidence 0.97)

The hold pad's held flag survives a lift that resolves while the finger is down, so the next attempt's first press is swallowed; later attempts then diverge from the mechanics mirror.

Flags: `INPUT_HELD_STATE_LEAK:phone-squat-a2`, `PHASE_PATH_MISMATCH:phone-squat-a2`, `INPUT_HELD_STATE_LEAK:phone-squat-a3`, `PHASE_PATH_MISMATCH:phone-squat-a3`, `FRAME_PARITY_MISMATCH`, `PROMPT_PARITY_MISMATCH`

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
| phone-squat-a2.samples | 195 |
| phone-squat-a2.heldBeforeFirstInput | true |
| phone-squat-a2.firstPressFrame | 31 |
| phone-squat-a2.firstMotionFrame | 123 |
| phone-squat-a2.browserPhasePath | BRACE>DESCENT |
| phone-squat-a2.probePhasePath | BRACE>DESCENT>HOLE>ASCENT>LOCKOUT |
| phone-squat-a2.browserEnd | judging |
| phone-squat-a2.probeEnd | judging |
| phone-squat-a2.inputPlanMatch | true |
| phone-squat-a2.frameMismatchFraction | 0.8107 |
| phone-squat-a2.numericMismatchFraction | 0 |
| phone-squat-a2.laggedFraction | 0.0059 |
| phone-squat-a3.samples | 206 |
| phone-squat-a3.heldBeforeFirstInput | true |
| phone-squat-a3.firstPressFrame | 32 |
| phone-squat-a3.firstMotionFrame | 129 |
| phone-squat-a3.browserPhasePath | BRACE>DESCENT |
| phone-squat-a3.probePhasePath | BRACE>DESCENT>HOLE>ASCENT>LOCKOUT |
| phone-squat-a3.browserEnd | judging |
| phone-squat-a3.probeEnd | judging |
| phone-squat-a3.inputPlanMatch | true |
| phone-squat-a3.frameMismatchFraction | 0.8187 |
| phone-squat-a3.numericMismatchFraction | 0 |
| phone-squat-a3.laggedFraction | 0.0055 |
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
| tracesCompared | 6 |
| framesCompared | 1153 |
| frameMismatchFraction | 0.248 |
| framesComparedExcludingLeakedTraces | 802 |
| frameMismatchFractionExcludingLeakedTraces | 0 |
| numericMismatchFraction | 0 |
| promptMismatchFraction | 0.248 |
| commandMismatchFraction | 0 |
| renderLaggedFraction | 0.0017 |
| oracleChecked | 1203 |
| oracleMismatchFraction | 0 |

Evidence:

- json: `trace:phone-squat-a1` — 155 play frames compared
- json: `trace:phone-squat-a2` — 169 play frames compared
- json: `trace:phone-squat-a3` — 182 play frames compared
- json: `trace:phone-bench-a1` — 242 play frames compared
- json: `trace:phone-deadlift-a1` — 250 play frames compared
- json: `trace:desktop-squat-a1` — 155 play frames compared

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
| stageBeats | 39 |
| beatsWithoutSpriteStage | 0 |
| beatsMissingWorldY | 0 |
| beatsNotGrounded | 0 |
| beatsAnchorArithmeticBroken | 0 |
| beatsCanvasSizeWrong | 0 |
| canvasProofs | 39 |
| canvasProofsFailed | 0 |
| canvasLifterProofsFailed | 0 |
| canvasProofsMissing | 0 |
| canvasWorstMismatchFraction | 0 |
| phone-squat-a1.distinctFrames | 6 |
| phone-squat-a1.frameJumpsWithinPhase | 0 |
| phone-squat-a1.groundLineValues | 318 |
| phone-squat-a1.frameAtMaxDepth | 2 |
| phone-squat-a1.footDriftPx | 16.2 |
| phone-squat-a2.distinctFrames | 3 |
| phone-squat-a2.frameJumpsWithinPhase | 0 |
| phone-squat-a2.groundLineValues | 318 |
| phone-squat-a2.frameAtMaxDepth | 2 |
| phone-squat-a2.footDriftPx | 15.8 |
| phone-squat-a3.distinctFrames | 3 |
| phone-squat-a3.frameJumpsWithinPhase | 0 |
| phone-squat-a3.groundLineValues | 318 |
| phone-squat-a3.frameAtMaxDepth | 2 |
| phone-squat-a3.footDriftPx | 15.8 |
| phone-bench-a1.distinctFrames | 6 |
| phone-bench-a1.frameJumpsWithinPhase | 0 |
| phone-bench-a1.groundLineValues | 318 |
| phone-bench-a1.frameAtMaxDepth | 2 |
| phone-bench-a1.footDriftPx | 4.3 |
| phone-deadlift-a1.distinctFrames | 6 |
| phone-deadlift-a1.frameJumpsWithinPhase | 0 |
| phone-deadlift-a1.groundLineValues | 318 |
| phone-deadlift-a1.footDriftPx | 35.8 |
| desktop-squat-a1.distinctFrames | 6 |
| desktop-squat-a1.frameJumpsWithinPhase | 0 |
| desktop-squat-a1.groundLineValues | 318 |
| desktop-squat-a1.frameAtMaxDepth | 2 |
| desktop-squat-a1.footDriftPx | 16.2 |
| tracesAnalysed | 6 |

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
- canvas: `evidence/phone-12-squat-judging.canvas.png` — phone-12-squat-judging: squat stage mismatch 0, lifter pixels off 0/20237, scale 1
- canvas: `evidence/phone-13-squat-outcome.canvas.png` — phone-13-squat-outcome: miss stage mismatch 0, lifter pixels off 0/15404, scale 1
- canvas: `evidence/phone-14-squat-transition.canvas.png` — phone-14-squat-transition: squat-max stage mismatch 0, lifter pixels off 0/22886, scale 1
- canvas: `evidence/phone-15-squat-walkout.canvas.png` — phone-15-squat-walkout: squat-max stage mismatch 0, lifter pixels off 0/22886, scale 1
- canvas: `evidence/phone-16-squat-brace.canvas.png` — phone-16-squat-brace: squat-max stage mismatch 0, lifter pixels off 0/22886, scale 1
- canvas: `evidence/phone-17-squat-judging.canvas.png` — phone-17-squat-judging: squat-max stage mismatch 0, lifter pixels off 0/23830, scale 1
- canvas: `evidence/phone-18-squat-outcome.canvas.png` — phone-18-squat-outcome: miss stage mismatch 0, lifter pixels off 0/15404, scale 1
- canvas: `evidence/phone-20-bench-attempts.canvas.png` — phone-20-bench-attempts: bench stage mismatch 0, lifter pixels off 0/33990, scale 1
- canvas: `evidence/phone-21-bench-walkout.canvas.png` — phone-21-bench-walkout: bench stage mismatch 0, lifter pixels off 0/33990, scale 1
- canvas: `evidence/phone-22-bench-brace.canvas.png` — phone-22-bench-brace: bench stage mismatch 0, lifter pixels off 0/33990, scale 1
- canvas: `evidence/phone-23-bench-hole.canvas.png` — phone-23-bench-hole: bench stage mismatch 0, lifter pixels off 0/32969, scale 1
- canvas: `evidence/phone-24-bench-press.canvas.png` — phone-24-bench-press: bench stage mismatch 0, lifter pixels off 0/32969, scale 1
- canvas: `evidence/phone-25-bench-ascent.canvas.png` — phone-25-bench-ascent: bench stage mismatch 0, lifter pixels off 0/34152, scale 1
- canvas: `evidence/phone-26-bench-judging.canvas.png` — phone-26-bench-judging: bench stage mismatch 0, lifter pixels off 0/34633, scale 1
- canvas: `evidence/phone-27-bench-outcome.canvas.png` — phone-27-bench-outcome: success stage mismatch 0, lifter pixels off 0/27053, scale 1
- canvas: `evidence/phone-28-deadlift-attempts.canvas.png` — phone-28-deadlift-attempts: deadlift stage mismatch 0, lifter pixels off 0/17342, scale 1
- canvas: `evidence/phone-29-deadlift-walkout.canvas.png` — phone-29-deadlift-walkout: deadlift stage mismatch 0, lifter pixels off 0/17342, scale 1
- canvas: `evidence/phone-30-deadlift-brace.canvas.png` — phone-30-deadlift-brace: deadlift stage mismatch 0, lifter pixels off 0/17342, scale 1
- canvas: `evidence/phone-31-deadlift-ascent.canvas.png` — phone-31-deadlift-ascent: deadlift stage mismatch 0, lifter pixels off 0/17342, scale 1
- canvas: `evidence/phone-32-deadlift-lock.canvas.png` — phone-32-deadlift-lock: deadlift stage mismatch 0, lifter pixels off 0/28732, scale 1
- canvas: `evidence/phone-33-deadlift-judging.canvas.png` — phone-33-deadlift-judging: deadlift stage mismatch 0, lifter pixels off 0/28732, scale 1
- canvas: `evidence/phone-34-deadlift-outcome.canvas.png` — phone-34-deadlift-outcome: success stage mismatch 0, lifter pixels off 0/27053, scale 1
- canvas: `evidence/desktop-02-squat-attempts.canvas.png` — desktop-02-squat-attempts: squat stage mismatch 0, lifter pixels off 0/20381, scale 1
- canvas: `evidence/desktop-03-squat-walkout.canvas.png` — desktop-03-squat-walkout: squat stage mismatch 0, lifter pixels off 0/20381, scale 1
- canvas: `evidence/desktop-04-squat-brace.canvas.png` — desktop-04-squat-brace: squat stage mismatch 0, lifter pixels off 0/20381, scale 1
- canvas: `evidence/desktop-05-squat-hole.canvas.png` — desktop-05-squat-hole: squat stage mismatch 0, lifter pixels off 0/18746, scale 1
- canvas: `evidence/desktop-06-squat-ascent.canvas.png` — desktop-06-squat-ascent: squat stage mismatch 0, lifter pixels off 0/18746, scale 1
- canvas: `evidence/desktop-07-squat-judging.canvas.png` — desktop-07-squat-judging: squat stage mismatch 0, lifter pixels off 0/20237, scale 1
- canvas: `evidence/desktop-08-squat-outcome.canvas.png` — desktop-08-squat-outcome: success stage mismatch 0, lifter pixels off 0/27053, scale 1

### design-intent — 🟡 REVIEW (confidence 0.80)

The served build departs from the brief or needs a human look; see flags.

Flags: `DESKTOP_GUTTERS_WIDE`, `CANDIDATE_BANNER_RENDERED`, `PAGE_ERRORS`

| Metric | Value |
|---|---|
| beats | 44 |
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
| stageBeats | 39 |
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
| pageErrors | 1 |
| liftsPlayed | squat,bench,deadlift |

Evidence:

- screenshot: `evidence/phone-00-none-title.png` — phone title
- screenshot: `evidence/desktop-00-none-title.png` — desktop title

### preview-regression — 🟡 REVIEW (confidence 0.75)

The fresh preview drifted from committed evidence or the reference, or a comparison could not run; see flags.

Flags: `TITLE_DRIFT_VS_REFERENCE:phone`

| Metric | Value |
|---|---|
| pixel.title-390.meanAbsDiff | 0.0468 |
| pixel.title-390.sizeMatch | true |
| pixel.title-1280.meanAbsDiff | 0.0218 |
| pixel.title-1280.sizeMatch | true |
| pixel.select-390.meanAbsDiff | 0.0581 |
| pixel.select-390.sizeMatch | true |
| pixel.squat-brace-390.meanAbsDiff | 0.1585 |
| pixel.squat-brace-390.sizeMatch | true |
| pixel.squat-brace-390.stageAlignedMeanAbsDiff | 0 |
| pixel.squat-brace-390.stageAlignedOffsetY | 4 |
| pixel.squat-brace-1280.meanAbsDiff | 0.148 |
| pixel.squat-brace-1280.sizeMatch | true |
| pixel.squat-brace-1280.stageAlignedMeanAbsDiff | 0.0019 |
| pixel.squat-brace-1280.stageAlignedOffsetY | 157 |
| pixel.squat-hole-390.meanAbsDiff | 0.1254 |
| pixel.squat-hole-390.sizeMatch | true |
| pixel.squat-hole-390.stageAlignedMeanAbsDiff | 0 |
| pixel.squat-hole-390.stageAlignedOffsetY | 4 |
| pixel.bench-brace-390.meanAbsDiff | 0.1592 |
| pixel.bench-brace-390.sizeMatch | true |
| pixel.bench-brace-390.stageAlignedMeanAbsDiff | 0 |
| pixel.bench-brace-390.stageAlignedOffsetY | 4 |
| pixel.bench-press-390.meanAbsDiff | 0.1306 |
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
| committedPixelDrift | 0 |
| committedFreshMissing | 0 |
| referenceSha | 1151569c40c77485ab9e9299e5db0db022437a8a |
| tokenDriftVsReference | none |
| spritesComparedVsReference | 52 |
| spritesDifferingVsReference | 0 |
| referenceTitle.phone.meanAbsDiff | 0.1154 |
| referenceTitle.desktop.meanAbsDiff | 0.0961 |

Evidence:

- file: `arcade/evidence/sprite-sport` — 17 committed evidence entries
- screenshot: `evidence/phone-00-none-title.png` — vs committed committed-evidence/title-390.png: full-page meanAbsDiff 0.0468
- screenshot: `evidence/desktop-00-none-title.png` — vs committed committed-evidence/title-1280.png: full-page meanAbsDiff 0.0218
- screenshot: `evidence/phone-01-none-lift.png` — vs committed committed-evidence/select-390.png: full-page meanAbsDiff 0.0581
- screenshot: `evidence/phone-04-squat-brace.png` — vs committed committed-evidence/squat-brace-390.png: full-page meanAbsDiff 0.1585; stage region aligned at dy=4 meanAbsDiff 0
- screenshot: `evidence/desktop-04-squat-brace.png` — vs committed committed-evidence/squat-brace-1280.png: full-page meanAbsDiff 0.148; stage region aligned at dy=157 meanAbsDiff 0.0019
- screenshot: `evidence/phone-05-squat-hole.png` — vs committed committed-evidence/squat-hole-390.png: full-page meanAbsDiff 0.1254; stage region aligned at dy=4 meanAbsDiff 0
- screenshot: `evidence/phone-22-bench-brace.png` — vs committed committed-evidence/bench-brace-390.png: full-page meanAbsDiff 0.1592; stage region aligned at dy=4 meanAbsDiff 0
- screenshot: `evidence/phone-24-bench-press.png` — vs committed committed-evidence/bench-press-390.png: full-page meanAbsDiff 0.1306; stage region aligned at dy=4 meanAbsDiff 0
- screenshot: `evidence/phone-30-deadlift-brace.png` — vs committed committed-evidence/deadlift-brace-390.png: full-page meanAbsDiff 0.1579; stage region aligned at dy=4 meanAbsDiff 0
- screenshot: `evidence/phone-32-deadlift-lock.png` — vs committed committed-evidence/deadlift-lock-390.png: full-page meanAbsDiff 0.1003; stage region aligned at dy=4 meanAbsDiff 0
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

