# Mechanics comparison — Iron & Amber Sport Arcade

**Status:** DRAFT / DO_NOT_MERGE. Not SNES craft. Not a merge gate.

## 1. Authoritative source

| Item | Value |
| --- | --- |
| Commit | `288db32c06232bb0fb65ce7236a0614c698a6920` |
| PR | [#59](https://github.com/Bthornton1994/three-white-lights/pull/59) `grok/session-a-career-loop-v1-01` |
| Freeze | A0 PLAYABLE SPORT CLOSED 2026-09-02, baseline runtime `39400d97` |
| `src/game/lift.ts` SHA-256 | `4dc74947ffc64f1af36da92c01a7cfb53d3f021b802cba31f67c3ecdcb24e417` |
| `src/game/liftTuning.ts` SHA-256 | `ef920d59eecdb5ac698f7515a1efe4af1c7ee0e38f9079f7f9cd6deace441f2a` |
| Clock | `TICK_HZ = 60`, `TICK_MS = 1000/60` (`src/art/spriteTuning.ts`) |
| Input | `{ kind: 'press' \| 'release' }` — hold/tap, not two amber windows |

Vendored byte-identical into this app. The arcade driver calls `createLift` / `stepLift` / `liftPresentation` / `meet.suggestOpener` / `meetDay.judgeAttempt`. It does not retune `lift.ts`.

## 2. What PR #76 arcade actually is (do not merge)

PR #76 (`45b99e90`, layout-only on the two-tap demo) is **not** the commercial arcade.

| | Two-tap arcade (`arcade/src/loop`) | A0 freeze (`src/game/lift.ts`) |
| --- | --- | --- |
| Input | Two taps in fixed amber windows | Continuous press/release |
| Squat | DEPTH at progress 0.42, DRIVE at 0.78, sequence 2220 ms | BRACE → DESCENT (hold) → depth judgment → HOLE → sticking-point DRIVE → grind → LOCKOUT |
| Bench | Two windows (pause / press) | Hold to control descent, chest pause, **unpredictable press command**, continuous tap grind, bar-speed/strain |
| Deadlift | Two windows (pull / lock) | Floor pull, continuous effort, lockout, **unpredictable down command**, hold, early-release failure |
| Fatigue | `hiddenFatigue` shrinks window ms | `SessionFeel` tightens windows + capacity. No visible meter |
| Judging | Lights from tap grades | `judgeAttempt(resolution, seed)` — majority matches mechanic make/miss |
| Load | `FEEL.OPENER_PCT` local table | `suggestOpener` / `ATTEMPT_JUMP_FRACTION` / 2.5 kg grid |
| Outcome | Both windows good | `LiftResolution.outcome` good-lift / grind / miss + missReason |

`feel.ts` SHA-256 `b26c21b520d17a8e87e6abac17661fc219870a2320a376b5b1b1adfe0bc2425c` is **left untouched** so the two-tap demo can still be compared. The commercial loop no longer reads its timing windows.

## 3. Visual layer

Iron & Amber from PR #74 / #75:

- Title / lift-select / results: Fable stills + revised bench
- Play: existing 6-frame sheets, **indexed from `liftPresentation`** (`phase`, `barHeight`, `depth`, `strain`, `grindIntensity`, command flags)
- Squat DEPTH gauge reads `presentation.depth`, not the two-tap progress clock
- Strain / grind only change lighting

The visual layer does not invent a second physics.

## 4. Proof

1. This report names commit `288db32c`.
2. `src/arcade/sport/parity.test.ts` — presentation phase/outcome/load/depth match `LiftState`; A0 history digests `143:202d21c756e1ddf0` / `163:fa82901b439b9c70`; `stepPlay` ≡ `stepLift`.
3. `src/game/a0LiftFreeze.test.ts` — 7/7 green against the vendored freeze.
4. Playable squat, bench, deadlift in the illustrated shell (hold/tap pad).
5. Tests: legal depth / high / buried; bench pause + press command + mash; deadlift lockout + down command; three attempts + bomb + results; judging majority.

PRs #69–#76 are not modified. This is a new isolated draft branch only.
