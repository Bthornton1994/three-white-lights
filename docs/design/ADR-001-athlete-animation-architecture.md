# ADR-001 — Athlete animation architecture

**Status:** Proposed (Session A visual owner). Not merged. Supersedes nothing yet.
**Date:** 2026-09-07
**Decision owner:** Claude Code Session A — visual / animation / player-experience
**Measured at:** `20a1aa55` on `grok/session-a-iron-amber-training-art-01` (PR #48 head)

---

## 1. What this decides

Which production architecture draws the player-facing athlete, so that
character artwork can be authored against a known target. It does **not**
decide gameplay, and it does not change any mechanic.

## 2. Why we are choosing again

Two player-facing implementations have been rejected:

1. **AI-generated phase-swapped JPEG stills.** Discontinuous, snapped between
   poses, and the athlete was not the same athlete frame to frame.
2. **Continuous Skia procedural rig** (PR #48, current). Built from `Line`,
   `Circle`, `Rect` and `RoundedRect` primitives.

**The second attempt is the informative one, and its own PR is honest about
the split:** it *"proved that a continuous simulation-to-animation bridge is
feasible, but the player-facing athlete was visually unacceptable."*

Verified against the artifact rather than taken on the PR's word —
`SquatScene.tsx` draws the athlete as eight `Line` segments, three
`RoundedRect` masses and two `Circle` joints. That is the "collection of
capsules" the product standard names as a rejection condition.

**So the bridge succeeded and the body failed.** The bridge is continuous,
mechanic-driven and load-aware. The body is primitives.

### The root cause, stated precisely

Both rejections share one cause: **an engineer authored the athlete.** In
attempt 1 an image model authored disconnected poses; in attempt 2 TypeScript
authored anatomy as coordinates. In neither case did an artist author a body
in motion.

`squatVisual.ts` computes `leftKnee.x = mid - STANCE - KNEE_OUT * sit`. That
line is the mannequin. Re-skinning it with drawn textures while an engineer
still solves knee position produces a *textured* mannequin, which is
rejection #3 wearing better paint.

**The architecture criterion therefore is: who authors the body in motion?**
Anything that leaves anatomy-in-motion in engineering hands is disqualified,
however good the paint.

## 3. Constraints measured from the repository

Not assumed — read from the tree at the SHA above.

| Fact | Value | Source |
| --- | --- | --- |
| Expo SDK | `~57.0.9` | `package.json` |
| React Native | `0.86.2` | `package.json` |
| Workflow | **Managed** — no `ios/`, no `android/` | filesystem |
| Skia | `@shopify/react-native-skia ^2.6.2` | `package.json` |
| Reanimated | `^4.5.1` | `package.json` |
| Web | `react-native-web ^0.21.2`, **required** | `package.json`, GDD §10.0 |
| Rive | **absent** | `package.json` |
| 3D stack | **absent** — no `expo-gl`, no `three`, no R3F | `package.json` |
| Beta target | **web / PWA** | GDD §10.0 |

Two measurements decided more than any opinion:

- **`rive-react-native@9.8.5` ships zero web files.** Checked by unpacking the
  published tarball and filtering the file list: no web entry point exists.
  Web requires the separate `@rive-app/react-canvas@4.34.1`, a different
  package with a different API. **Rive on this product is two runtimes, and
  the beta's own target is the second one.**
- **No shipped CanvasKit build contains Skottie.** `Skottie` is exported by RN
  Skia's TypeScript surface, so Lottie playback looks available — but
  `canvaskit-wasm@0.41.0` has **0** `Skottie`/`MakeAnimation` symbols in
  `bin/`, `bin/full/` *and* `bin/profiling/`, and `tools/dev-web.sh` copies
  `bin/full/canvaskit.wasm`. A Lottie route would need a custom Skia wasm
  build. **Eliminated on evidence, not on taste.**

The second measurement is worth keeping: the TypeScript export existing is
exactly the kind of "mechanism confirmed, consequence assumed" trap CLAUDE.md
names. `Skottie` resolves; Skottie does not run.

## 4. Options

### Option A — Rive (skeletal / mesh 2D, state machines, data binding)

- Artist authors body, deformation and motion in the Rive editor. Engine sends
  numbers into a ViewModel. **Meets the criterion in §2.**
- Mesh + bones give load-responsive posture and real deformation.
- State machines express success / failure / grind as authored states rather
  than engine branches.
- Scales to "additional lifter appearances later" — the stated requirement.
- **Costs:** new runtime dependency; **development build required** for
  iOS/Android (managed workflow today); **two runtimes**, and web — the beta
  target — is served by the second one.

### Option B — Authored 2.5D rig on the existing Skia stack

- Zero new runtime. Works on web + iOS + Android **today**; `canvaskit.wasm`
  and the whole browser-evidence harness already exist around it.
- Skia 2.6 genuinely supports this: `Vertices` (textured triangle mesh with
  UVs), `Atlas` (batched transforms), `ImageShader` — verified present in the
  installed type surface. This is real skinned deformation, not primitives.
- **Fails the §2 criterion.** The artist supplies a parts atlas; the *engineer
  still solves the pose*. Anatomy in motion stays in TypeScript, which is what
  produced the current rejection.
- Cheapest to start, highest risk of a third rejection.

### Option C — Lightweight rigged 3D

- Meets the authorship criterion, and solves skeletal consistency outright.
- **No stack present.** Adds `expo-gl` + three/R3F, plus model, rig, skin and
  texture authoring — the heaviest pipeline of the three.
- Worst fit for **Iron & Amber**, which is an *illustrated* direction; matching
  a painted 2D room with a lit 3D character is a hard art problem, not a free
  one.
- Mobile-web memory and perf risk.
- The brief warns against choosing 3D merely because it fixes skeletons. It
  does fix skeletons. That is not sufficient here.

### Option D — Lottie / Skottie

**Eliminated on measurement** (§3): no Skottie in any shipped CanvasKit build.
Also weak at continuous parametric control — a lift is driven by a live scalar,
not a timeline, and timeline-seeking is closer in spirit to the rejected
phase-swap than it first appears.

## 5. Decision

**Adopt Option A — Rive — as the production athlete architecture, gated behind
a runtime spike (§7).**

It is the only option that moves anatomy-in-motion out of engineering, which is
the measured cause of both rejections. Option B is cheaper and would very
likely produce rejection #3 for the same reason as rejection #2. Option C fixes
authorship but at the wrong cost and against the art direction.

This is not adopted because it was suggested elsewhere; it is adopted because
§2's criterion eliminates the alternatives, and because the two costs that
should have disqualified it are containable (§6) while the cost that would
disqualify Option B is not.

### The two-runtime cost, contained rather than waved away

The containment is the **presentation contract** (§8): a pure, unitless,
renderer-agnostic model with **no coordinates in it**. Both Rive runtimes load
the same `.riv` and set the same named inputs, so the platform split is two
thin adapters over one contract:

```
gameplay (Grok, authoritative)
   └─ LiftState ──► squatPresentation()  ── pure, no pixels, no joints
                        │
                        ├─► RiveStage.native.tsx   rive-react-native
                        └─► RiveStage.web.tsx      @rive-app/react-canvas
```

React Native's platform-extension resolution handles the split natively. The
divergence is adapter-sized, not implementation-sized.

**The contract is worth building immediately because it is identical under
Options A, B and C.** Choosing wrong later costs the adapters, not the bridge.

## 6. Consequences

- A **development build** becomes the native testing path; Expo Go stops being
  sufficient for the lift surface. Must be documented before native gates are
  claimed.
- Web keeps working through `@rive-app/react-canvas`, so the existing
  Playwright/browser-evidence harness — which is web — still applies to the
  beta's own target.
- `.riv` becomes a **source-controlled binary art asset** with a real authoring
  tool behind it. This is the pipeline the product has not had.
- Two runtimes must be kept version-aligned against one `.riv` schema.

## 7. Open risks — de-risk before full commitment

Honestly held, and not verifiable from this environment:

1. **Rive web at 60fps under per-frame data-binding writes** is unverified. The
   lift writes several scalars every tick.
2. **`@rive-app/react-canvas` under `react-native-web` + Metro** is unverified.
3. Rive's modern **data-binding / ViewModel** model should be used rather than
   the deprecated input API — confirm against the runtime version actually
   installed, not against documentation of an older one.

**The spike that settles all three needs a `.riv` file, which is exactly the
asset blocker in §9.** Recorded so the sequencing is visible: the spike is
cheap, but it is not currently runnable.

## 8. What survives from PR #48

Kept — genuine, architecture-independent presentation truth:

- normalized rep position (`stand` / `sit`), driven by the mechanic's `height`
- bar height, bar velocity, tilt, flex
- strain, and grind / sticking point — though the grind's THRESHOLD does not
  survive: PR #48 gates it on `SQUAT_VISUAL.CAMERA_VEL` (`0.05`), which sits
  above the simulation's own `MAX_RISE_VELOCITY` (`0.03`), so the gate is true
  on every ascent tick and the grind is just strain. The kept thing is the
  quantity; the threshold is `GRIND_STALL_VELOCITY`'s. See
  `docs/design/PRESENTATION-CONTRACT-REQUEST.md` §2.
- command / cue state, chalk intensity
- **load-driven plate data** (`ironAmberPlates.ts`, `src/art/plates.ts`) — 80 kg
  must not be a 220 kg picture
- success / failure resolution
- one-persistent-athlete, one-persistent-bar concept
- the Iron & Amber reference docs

Removed — architecture-specific puppet:

- every joint coordinate in `squatVisual.ts` (`hip`, `leftKnee`, `rightKnee`,
  `leftShoulder`, `rightShoulder`, `leftFoot`, `rightFoot`, `head`)
- `SquatScene.tsx`'s primitive body
- canvas-space constants (`MID_X`, `FLOOR_Y`, `STANCE`, `KNEE_OUT`, `TORSO_W`)
  from the contract — they are renderer concerns
- per-particle chalk x/y/r/a — the contract carries **intensity + seed**; the
  renderer decides placement
- **`tremor` and `breath`**, which read as presentation truth and are not.
  Given `strain`, `grind` and `phase`, a shake amplitude and a breathing loop
  are things an ARTIST authors in the rig. Carrying them as engine-computed
  numbers is the rejected architecture in miniature, so they are removed rather
  than kept — see `src/session/liftPresentation.ts`'s header.

**The removal is deferred, not skipped.** `SquatScene` stays until a Rive stage
can replace it, because deleting the only working stage before its replacement
exists would leave the training path with nothing to draw. It is marked, not
polished, and it is not the target.

## 9. Blocked

**`ASSET_PIPELINE_BLOCKED`** — the full report, with the missing asset, the
required format, the required authoring tool and the ownership need, is
`docs/design/ATHLETE-ASSET-PIPELINE.md` §2.

No production character artwork exists, and none can be authored from this
environment under any of the three options. This is a real blocker on the
athlete, and it is **not** a reason to ship a fourth placeholder body — the
product standard explicitly refuses one.

Non-blocked work proceeds and is done: the presentation contract
(`src/session/liftPresentation.ts`), the pipeline specification
(`docs/design/ATHLETE-ASSET-PIPELINE.md`), and the data request to the
mechanics owner (`docs/design/PRESENTATION-CONTRACT-REQUEST.md`).
