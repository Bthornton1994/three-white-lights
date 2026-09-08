# ADR-001 — Athlete animation architecture

**Status:** **PROVISIONAL — RIVE LEADING CANDIDATE.** Not FINAL. Not merged.
**What closes it, exactly:** the web spike (§7) rendering a real `.riv` whose
ViewModel takes the `rigInputPaths()` set (`src/art/athleteRig.ts`) at 60 Hz
without dropped frames on the beta's own target (web/PWA, GDD §10.0). That
one artefact is the gate, and it is `ASSET_PIPELINE_BLOCKED` from this
environment (§9). Native stays a device-build gate behind it. Options B and C
are not reopened unless that web spike, with a real asset, fails — and if it
does, §4 is re-run against the same criterion rather than re-argued.
**Date:** 2026-09-07; amended the same day against the modern runtime (§4a).
**Decision owner:** Claude Code Session A — visual / animation / player-experience
**Measured at:** `20a1aa55` (PR #48 head) for §2–§4 and §8; `55f86007` plus the
visual branch's working tree for §4a, §5a, §6 and §7.

**Why "provisional" is in the title line.** The first draft of this ADR
evaluated `rive-react-native@9.8.5` — Rive's LEGACY React Native package — and
its two-runtime finding was measured against it. The human ruling of
2026-09-07 refused to freeze a decision on the legacy package and required the
evaluation to be re-done against Rive's current recommended runtime,
`@rive-app/react-native` (Nitro-based), with a dev-only runtime spike before any
production athlete work. §4a is that re-evaluation, §7 is the spike, and the
decision stands at *leading candidate* until a developer with a device or a
simulator closes the native half of §7 that this environment cannot run.

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
| Rive (legacy) | `rive-react-native@9.8.5` — evaluated in the first draft, **not installed** | npm registry |
| Rive (modern, native) | `@rive-app/react-native@0.4.20` + `react-native-nitro-modules@0.35.10` — **installed on the visual branch for §7** | `package.json`, npm registry |
| Rive (modern, web) | `@rive-app/react-canvas@4.34.1` → `@rive-app/canvas@2.42.0` — installed likewise | `package.json`, npm registry |
| 3D stack | **absent** — no `expo-gl`, no `three`, no R3F | `package.json` |
| Beta target | **web / PWA** | GDD §10.0 |

Two measurements decided more than any opinion:

- **`rive-react-native@9.8.5` ships zero web files.** Checked by unpacking the
  published tarball and filtering the file list: no web entry point exists.
  Web requires the separate `@rive-app/react-canvas@4.34.1`, a different
  package with a different API. **Rive on this product is two runtimes, and
  the beta's own target is the second one.** This finding survives the move
  to the modern package unchanged — see §4a criterion 9 — and is not
  minimised there.
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

## 4a. The modern runtime, evaluated — `@rive-app/react-native`, not the legacy package

Every row is measured from the published package artifacts (tarballs unpacked
from the npm registry, the installed `node_modules`, and this repository's own
build tooling) — never from a docs page remembered. Where a criterion cannot be
measured from a Linux sandbox with no Xcode, no Android SDK and no device, the
row says so rather than inferring a pass.

| # | Criterion | Finding | How it was measured |
| --- | --- | --- | --- |
| 1 | Expo SDK 57 | **Compatible at every layer this environment can reach.** README requires Expo SDK 53+. `npm install` resolved against `expo ~57.0.9` with no peer conflict. `expo-doctor` reports no new finding (its three failures pre-exist and are network/peer issues unrelated to Rive — verified with the packages stashed). `npx expo prebuild --platform android --no-install` **succeeded**, exit 0, with neither package needing a config plugin (neither ships one — measured: no `app.plugin.js`, no `expo-module.config.json`). | `npm install`, `npx expo-doctor` before/after, prebuild log |
| 2 | React Native 0.86 | **Compatible.** README requires RN 0.78+ (0.80+ for readable Android errors); peer `react-native: *`. Installed clean against `0.86.2`. | package.json peers, install |
| 3 | Nitro dependency | **A hard peer, pinned to a one-minor window: `react-native-nitro-modules >=0.35.10 <0.36`**, while the registry's latest is `0.37.1`. Both packages must move together; an `expo install --fix` that bumps Nitro past 0.36 breaks the peer. Nitro is JSI-based and requires the New Architecture — which the generated Android project turns on by default: `newArchEnabled=true`, `hermesEnabled=true` (read from the prebuilt `gradle.properties`). Expo's own autolinker lists both `@rive-app/react-native` and `react-native-nitro-modules` as linkable on **android and ios** (11 RN-CLI-style native deps, these two among them). **Expo Go cannot load them** — a development build is mandatory (the package's own README says so; not measurable here beyond that). | package.json peers, `npm view`, prebuild output, `npx expo-modules-autolinking react-native-config --platform android/ios --json` |
| 4 | iOS requirements | iOS 15.1+, Xcode 16.4+. `RNRive.podspec` depends on `RiveRuntime` **6.23.1**, pinned in the package's `runtimeVersions.ios` and overridable via `Podfile.properties.json` or an inline config plugin. **NOT EXECUTABLE HERE** — no macOS, no Xcode, ever, on this Linux host. | podspec, package.json `runtimeVersions`, README |
| 5 | Android requirements | SDK 24 (7.0)+, JDK 17+, CMake/NDK for Nitro's C++ (Windows `MAX_PATH` caveat in the README). Android runtime pinned **11.9.1**. Prebuild generated a valid project; **compilation NOT EXECUTABLE HERE** — Java and Gradle are present, the Android SDK/NDK and any emulator are not. | prebuild, `gradle.properties`, README |
| 6 | Data Binding / ViewModel | **First-class and the recommended path.** `useViewModelInstance(riveFile, { async: true })`, `useRiveNumber/String/Boolean/Enum/Color/Trigger/List`, and a `ViewModelInstance` Nitro HybridObject whose `numberProperty(path)` returns a `ViewModelNumberProperty` with **synchronous `set(value)`**, `getValueAsync()`, `addListener()`. The features table marks state-machine inputs, text runs and Rive events **Deprecated** in favour of data binding. `<RiveView file={…} dataBind={instance} />` binds it. | `lib/typescript/src/specs/ViewModel.nitro.d.ts`, README features table |
| 7 | Local `.riv` loading | **Works through the same mechanism as this app's `.jpg` plates.** `useRiveFile` accepts `number \| {uri} \| string \| ArrayBuffer`; a `require('./x.riv')` asset id is resolved via `Image.resolveAssetSource` inside the hook (read from `useRiveFile.ts`). One prerequisite this repo lacked: `.riv` is **not** in Expo's default `assetExts` (measured) — `metro.config.js` now adds it, and `src/art/riv.d.ts` types the import. | hook source, `getDefaultConfig().resolver.assetExts` |
| 8 | Performance implications | Native: the write path is a synchronous JSI call per property (`set`), no promise per frame — the shape a 60 Hz feed wants; the renderer is Rive's own (the only option; "Renderer options" is ❌ in the features table). Web: the engine is `rive.js` 450 KB + `rive.wasm` 1.89 MB (a `rive_fallback.wasm` of the same size is only fetched on failure). Installed payload: 3.1 MB native package, 1.6 MB Nitro, 4.9 MB canvas. Frame pacing natively is **unmeasured here**; web pacing under a 60 Hz write loop is §7's measurement. | `du`, `ls`, type surface |
| 9 | Web / PWA counterpart | **Still a second runtime, and the beta's target.** `@rive-app/react-canvas@4.34.1` wraps `@rive-app/canvas@2.42.0`. Its default engine loading fetches `rive.wasm` from **unpkg (fallback jsdelivr)** at runtime — measured here as `HTTP 000` (connection refused by the egress proxy) for both `unpkg.com/@rive-app/canvas@2.42.0/rive.wasm` and `cdn.jsdelivr.net/npm/@rive-app/canvas@2.42.0/rive.wasm`, so under the default the runtime never initialises in this environment — and a PWA must not depend on a third-party CDN to draw its athlete regardless, so the engine is self-hosted (`RuntimeLoader.setWasmUrl`, fallback disabled), exactly as `tools/dev-web.sh` already self-hosts Skia's `canvaskit.wasm`. One signal of direction, recorded as direction and not as a shipped fact: `@rive-app/react-native@0.5.0-beta.3` declares `@rive-app/canvas ^2.39.0` as a peer — the vendor is converging the two. | package tarballs, `rive.js` string scan, `runtimeLoader.d.ts`, `npm view` |
| 10 | API divergence, native vs web | **Same concepts, different surface, but the hooks are nearly isomorphic.** File load: `useRiveFile(input)` vs `useRive({ src })`. Mount: `<RiveView file dataBind />` vs `<RiveComponent />` from `useRive`. Instance: `useViewModelInstance(riveFile, {async:true})` vs `useViewModel(rive) → useViewModelInstance(vm, {useDefault, rive})`. A number: `instance.numberProperty(p).set(v)` / `getValueAsync()` / `addListener` vs `instance.number(p).value` getter/setter. **Hooks:** `useRiveNumber(path, instance) → {value, setValue, error}` vs `useViewModelInstanceNumber(path, instance) → {value, setValue}` — same call shape, different name. Errors: `RiveErrorType` enum via `onError` vs `onLoadError` event. **Asset resolution:** the native hook resolves a `require()`d id through `Image.resolveAssetSource` internally; `react-native-web`'s `Image` has no such static (measured: `Image.default.resolveAssetSource is not a function` at runtime on the first bundle that built), so the web stage resolves both the `.riv` and the wasm through `expo-asset`'s `Asset.fromModule(id).uri`, which is cross-platform and already a dependency. | both type surfaces, read side by side; the web runtime error |
| 11 | Adapter code to keep the contract common | **Measured in the spike, not estimated: two platform files of ~60 lines each, a 40-line shared types module, and a 3-line `.d.ts` — zero translation layer.** React Native's platform-suffix resolution does the split (`RiveSpikeStage.native.tsx` / `.web.tsx`); Metro was observed choosing `.web.tsx` for the web bundle, so the Nitro-bearing native file is provably absent from the web graph. Each file talks to its own runtime in that runtime's own shape; what they share is the outer contract (`LiftPresentation` in production; a synthetic feed in the spike). | `src/dev/riveRuntimeSpike/`, Metro's transform error naming the `.web.tsx` file |

**The two-runtime cost has not gone away and this section does not pretend it
has.** What the modern runtime changes is its *shape*: the concepts (file,
artboard, state machine, ViewModel, typed properties) and the hook signatures
are close enough that the adapters are thin. What it does not change: two
engines to keep version-aligned against one `.riv` schema, two error surfaces,
a native package pinned to a one-minor Nitro window, and a web engine that has
to be self-hosted. Those are real, and §6 costs them.

## 5. Decision

**Rive (Option A) is the LEADING CANDIDATE for the production athlete
architecture. PROVISIONAL, not FINAL.** The selection reasoning below is
unchanged by the modern-runtime evaluation; what §4a adds is that the modern
package is compatible at every layer this environment can reach and that its
adapter cost is small and measured. What it cannot add is a native run.

**What would flip this decision, stated before the spike so it cannot be
moved afterwards:** the native runtime failing to build or to bind a ViewModel
on a real device or simulator (§7's unexecuted half); the Nitro peer window
proving unmaintainable across an Expo SDK upgrade; or web frame pacing under a
60 Hz write stream reading as unfit for a phone browser once a real `.riv`
exists. If any of those lands, this ADR reopens at §4 and Options B and C are
compared again — not patched around.

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

## 5a. Native / web adapter architecture

Measured in the spike (§7) and intended for the production stage unchanged in
shape:

```
LiftState (Grok, authoritative)
   └─ liftPresentation(state, totalKg, prior)  ── src/game/liftPresentation.ts, FROZEN at 20bda71d
            │  the mechanics lane's contract: barHeight, barVelocity (Δheight, prior REQUIRED),
            │  motionSampleValid, integratorVelocity, strain, grindIntensity, effortBand,
            │  load.discs, command, outcome / missReason / lockedOut / complete, …
            │
            └─ athleteRigInputsFrom(view)  ── src/art/athleteRig.ts, visual lane
                     │  rename + unit conversion + one list unrolled into fixed slots;
                     │  re-derives NOTHING (@guarantee the-rig-binding-invents-no-mechanical-fact)
                     │
                     ├─► AthleteStage.native.tsx   @rive-app/react-native
                     │      prior = priorFromHistory(history, state)
                     │      useRiveFile(ATHLETE_RIV_ASSET) · useViewModelInstance(file, { async: true })
                     │      instance.numberProperty('barHeight').set(i.barHeight)   ← sync JSI write, per tick
                     │      <RiveView file dataBind autoPlay onError />
                     │
                     └─► AthleteStage.web.tsx      @rive-app/react-canvas
                            useRive({ src }) · useViewModel · useViewModelInstance
                            vmi.number('barHeight').value = i.barHeight        ← sync setter, per tick
                            <RiveComponent />
```

Both stages exist and typecheck at this SHA and are MOUNTED NOWHERE — the
swap is one line in `TrainingLiftStage.tsx` and waits on a real `.riv`
(§9). The spike (§7) is the same shape with a synthetic feed; the production
stage differs only in what it feeds.

Five rules the spike established, each for a measured reason:

1. **The split is by file suffix, not by `Platform.select`.** Metro resolves
   the bare specifier per platform *before* walking the module graph, which is
   the only thing that keeps `react-native-nitro-modules` (native-only) out of
   the web bundle. A runtime `Platform.select` over two `require()`s would pull
   both graphs into both bundles.
2. **`tsc` gets a scoped `.d.ts`, never `moduleSuffixes`.** The tsconfig
   option re-routes third-party packages' internal relative imports too;
   measured against `expo-audio` it turned a mechanics-lane file red. Recorded
   in CLAUDE.md so it is not re-tried.
3. **`require()` takes a string literal.** Metro collects dependencies
   statically and refuses `require(someConstant)` — the first probe of the
   spike died on exactly that, and `riveSpikeTypes.test.ts` now pins both
   stages to the literal.
4. **The web engine is self-hosted.** `wasm` is a Metro asset extension here
   so `@rive-app/canvas/rive.wasm` is served by the bundler and
   `RuntimeLoader.setWasmUrl` points at it, fallback disabled.
5. **Asset URIs on web come from `expo-asset`, not `Image.resolveAssetSource`.**
   `react-native-web` does not implement that static (measured); the native
   Rive hook uses it internally and needs nothing from the caller, so the
   asymmetry is the caller's on web only.

The per-property write is the one place the two runtimes differ in *kind*
(a Nitro HybridObject method vs a hook's setter), and it stays inside each
platform file rather than being abstracted — an abstraction over two calls is
more code than the two calls.

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

### Exact Expo build implications, from the measurements in §4a

1. **A development build is mandatory for native.** Expo Go cannot load Nitro
   modules; the native lift stage is tested with `npx expo run:ios` /
   `run:android` or an EAS dev client. Web (`expo start --web`) is unaffected.
2. **`react-native-nitro-modules` is an explicit dependency, pinned inside
   `>=0.35.10 <0.36`.** Do not let a dependency-fixer bump it past 0.36 without
   bumping `@rive-app/react-native` to a release that widens the window.
3. **New Architecture on** — the default in this Expo 57 project (measured in
   the prebuilt `gradle.properties`). No opt-in needed; do not opt out.
4. **`metro.config.js` now exists** (it did not before), adding `riv` and
   `wasm` to `assetExts`. Every other asset type this project uses was already
   in Expo's default list; these two were not.
5. **iOS:** Xcode 16.4+, deployment target 15.1+; CocoaPods pulls
   `RiveRuntime` 6.23.1 (overridable via `Podfile.properties.json`).
6. **Android:** SDK 24+, JDK 17, CMake/NDK build of Nitro's C++ and Rive's;
   runtime 11.9.1 (overridable via `gradle.properties`).
7. **Web/PWA:** `rive.wasm` (1.89 MB) ships with the app and is precached by
   the PWA, never fetched from unpkg/jsdelivr. The dev server serves it through
   Metro as an asset; a production `expo export` emits it the same way.
8. **No config plugin** for either package — nothing to add to `app.json`
   plugins. (Prebuild will, separately, write `android.package` into
   `app.json` and rewrite the `android`/`ios` npm scripts to `expo run:*`; that
   is prebuild's doing, not Rive's, and was reverted after the measurement.)
9. **`tsconfig.json` stays as it is.** No `moduleSuffixes` (see §5a rule 2).
10. **Bundle-size delta on web:** +450 KB JS, +1.89 MB wasm, plus the
    `react-canvas` wrapper (72 KB installed). Native adds ~3.1 MB of package
    plus the runtime binaries CocoaPods/Gradle fetch at build time.

## 7. The runtime spike — what was executed here, what was not, and what it measured

**Implementation:** `src/dev/riveRuntimeSpike/` — `RiveRuntimeSpikeScreen.tsx`,
`RiveSpikeStage.native.tsx`, `RiveSpikeStage.web.tsx`, `RiveSpikeStage.d.ts`,
`riveSpikeTypes.ts`, `spikeSignal.ts` (a pure, tested synthetic feed of
`repProgress`, `barHeight`, `barVelocity`, `strain`, `grindIntensity` — the
SHAPE of a rep's values, fed by nothing in `src/game/**`), `spikeTuning.ts`
(registered `local`). Mounted by `App.tsx` **only when `__DEV__` is true AND
the URL carries `?dev-rive-spike=1`** — a query string `shellRoute.ts` has no
arm for. It is not an athlete, it is not presented as one, and it is removable
by deleting that directory and one branch in `App.tsx`.

**The asset is REAL as of 2026-09-08, and that changes what the spike can
prove.** The first run of this spike had only a deliberately invalid
placeholder, on the finding that no legally usable `.riv` was obtainable:
the egress policy allowlists package registries; `cdn.rive.app` answers
`CONNECT tunnel failed, response 403`; and no npm-published Rive package
bundles a `.riv` (zero across six tarballs, checked). Both facts still hold.
The conclusion did not: this sandbox's git path to the source host is open,
and the vendor's own React Native runtime repository is MIT with its example
assets committed in-tree. `assets/dev/quick_start.riv` — the vendor's
quick-start health bar, one ViewModel number `health` — is the spike's asset
now, with the licence text, upstream commit, path and SHA-256 in
`assets/dev/THIRD-PARTY-RIVE-ASSETS.md`. The placeholder stays as the
error-path fixture. `tools/rivSchema.mjs` reads either headlessly, which is
how the "one number" claim above was established rather than assumed.

### Executed here (Linux, web via Chromium, no native toolchain)

| Verification target | Result |
| --- | --- |
| Native runtime installs cleanly | **YES** — `npm install` clean against RN 0.86.2 / React 19.2.3 / Expo 57; **zero new `npm audit` advisories** (19 before, the identical 19 after, diffed by package). |
| Expo development build works | **PARTIAL** — `expo prebuild --platform android` succeeds (exit 0, `newArchEnabled=true`); Expo's autolinker links both packages on android and ios. Compilation and a running dev client: **not executable here**. |
| iOS path | **NOT EXECUTABLE HERE** (no macOS/Xcode). Requirements recorded in §4a row 4. |
| Android path | **NOT EXECUTABLE HERE** beyond prebuild + autolinking (no SDK/NDK/emulator). |
| Web/PWA counterpart | **EXECUTED** — see the probe record below. |
| Same presentation state feeds both runtimes | **YES, structurally** — one `spikeSignal.ts` feed, two platform stages, one shared signature pinned three ways; the web stage's binding calls run every frame in the browser, against a real file. |
| Data Binding / ViewModel numeric updates | **MEASURED on web, on a real `.riv` (2026-09-08).** The bound number moves the shape: two canvas readbacks 450 ms apart differ in 5,918 px (max channel delta 255), the readout going `100` → `14` and the bar's fill and colour with it. AND the finding that came first: with no state machine named, the instance binds, the status reads `bound`, and **0 px change** — data binding drives a state machine, so the stages now name theirs and the contract diff checks for one. |
| Continuous high-frequency values | **The 60 Hz write loop ran in the browser against a drawing scene**; frame pacing below. One number on this file — the forty-two-input rig is not yet measured. |
| Responsive sizing | Not measured — a fixed 320 dp stage. Deferred to the production stage. |
| Load/unload lifecycle | **EXECUTED** — mount, load attempt, status transition, unmount on navigation away; no page errors on the player path. |
| Frame pacing | **MEASURED on web while a real graphic follows the writes** — below. |
| Memory | **SAMPLED on web** (Chromium `performance.memory`, 10 s window) — below. |
| Latency | Not meaningfully measurable without a rendered property. Deferred. |
| Failure / error behavior | **EXECUTED** on the first run (the invalid placeholder): the load failure is caught and shown on the dev screen's status line; the app does not crash; the player path is untouched. The placeholder stays as the error-path fixture `tools/rivSchema.mjs` refuses. |

### The probe record

Taken from `docs/design/evidence/rive-spike/probe.json` (Chromium via
Playwright, 390×844 @2x, against `tools/dev-web.sh`'s server after a `--clear`
restart so the bundle is the shipped source, not a cached one). Numbers are
the record's, not rounded from memory. **This is the real-asset record of
2026-09-08;** the placeholder run it replaces is summarised beneath it.

| Measurement | Value | Reading |
| --- | --- | --- |
| Spike route mounted | **13757 ms** after navigation (cold: first bundle after `--clear`) | The dev screen and its canvas exist; the bundle built with the native file excluded. |
| Status settled | 13773 ms — `bound — writing health at 60fps` | A real file loaded, its default ViewModel bound, the write loop running. |
| Scene motion | canvas 716×640, **5918 of 458240 px changed** across 450 ms, max channel delta 255 | **The graphic follows the writes.** `HEALTH 100` and a full green bar, then `HEALTH 14` and a short red bar — the file's own state machine reading the bound number. |
| Canvases on the page | 1 | `RiveComponent` mounted its canvas. |
| Page errors (uncaught) | 0 | Nothing thrown to the app. |
| rAF pacing, 5 s, under the 60 Hz write loop, scene drawing | 300 frames — mean 16.67 ms, p50 16.7, p95 16.7, max 16.8; frames over 33 ms: 0 | The write loop, React and a live Rive scene together do not disturb the frame cadence. One bound number — the rig's forty-two are not yet measured. |
| JS heap, 10 s sample | 192.3 MB → 194.7 MB (Δ +2.35 MB); the two earlier runs of the same probe read −5.44 MB and −0.02 MB | Garbage-collector noise around a flat line across three runs, not a trend. A longer soak is a device question. |
| Player path (`/`, no flag) | shell in 1013 ms; `app-shell` present: True; `dev-rive-spike` present: **False**; address bar: `""`; page errors: 0 | **The spike is not on the player path.** |
| Wrong flag value (`?dev-rive-spike=0`) | opens the spike: **False** | The gate needs the exact value, not the key. |

**The finding this round, from the first real-asset run:** the same probe
read `bound`, one canvas, perfect pacing — and **0 changed pixels**, the
health readout sitting on the file's authored `16`. The console said why:
no state machine was specified, so the artboard's first linear animation
played instead. Data binding drives a state machine; a bound ViewModel
with none running is a graphic the writes never reach. Naming the state
machine took the count to 14970 on the second run, and the singular
`stateMachine` parameter (the plural is deprecated) to the record above.
"Bound" is not "driven" — the production stages now name their state
machine by lift, and `src/art/rivContract.ts` checks that each lift's
artboard carries one of the same name.

**The placeholder run this replaces (2026-09-07):** mounted 12686 ms;
status `error: load: loaderror — The file failed to load` after console
`Bad header` — the engine initialised and correctly refused the invalid
bytes; pacing 300 frames mean 16.67 / max 16.8 / 0 over 33 ms while drawing
nothing; heap Δ +358 KB; player path clean. Its three earlier attempts each
changed the code: Metro refusing `require(constant)` (fixed — string
literal, pinned by `riveSpikeTypes.test.ts`); `react-native-web` having no
`Image.resolveAssetSource` (fixed — `expo-asset`, now in
`src/session/riveWebEngine.ts`); the status line printing `[object Object]`
for a Rive `onLoadError` event (fixed — the event's fields).

### Not executed here, and what closes it

A developer with a Mac or an Android SDK runs, from the visual branch:

```
npx expo run:ios      # or: npx expo run:android
# open the app with the dev flag — on native, there is no URL bar, so
# temporarily return true from isDevRiveSpikeRequested() in App.tsx
```

and reports: build success, the dev screen's status line, and whether the
health bar moves at 60 Hz the way the web record shows. That closes §4a
rows 4, 5 and the native half of 6–8, and it is the gate between "leading
candidate" and "final".

**PASS / FAIL after the spike, stated separately by platform:**

- **Web: TECHNICAL PASS on a real asset** — install, resolution, bundling
  with the native file excluded, mount, engine from a self-hosted wasm, a
  real `.riv` loaded and its ViewModel bound, a state machine driven by a
  60 Hz write with the graphic following it at an undisturbed frame
  cadence, error handling, player-path isolation. Not measured: the rig's
  forty-two inputs (this file has one), responsive sizing, a long soak.
- **Native: UNVERIFIED.** Everything measurable without a toolchain passed
  (install, prebuild, autolinking, types). Nothing requiring one was run.
- **Overall: Rive stays LEADING CANDIDATE. Not FINAL.** The status line's
  closing condition is unchanged — a real `.riv` whose ViewModel takes the
  `rigInputPaths()` set at 60 Hz without dropped frames. This round proved
  the mechanism on a real scene with one input; the athlete asset is what
  proves it on the rig's set, and none exists (§9).

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
  than kept. The frozen contract agrees from the other side — its doc §9 lists
  face, hand and cloth instructions as things it "will not include" — and
  `src/art/athleteRig.ts`'s header carries the visual-lane reasoning.

**The removal is deferred, not skipped.** `SquatScene` stays until a Rive stage
can replace it, because deleting the only working stage before its replacement
exists would leave the training path with nothing to draw. It is marked, not
polished, and it is not the target.

### What the played path actually draws today, stated plainly

Traced through `SetView.tsx` -> `TrainingLiftStage.tsx` at the SHA above,
rather than inferred from the PR description. **All three rejected or legacy
presentations are simultaneously live**, and the reader of this ADR should not
come away thinking the squat rig replaced anything:

| Surface | Draws | Which architecture |
| --- | --- | --- |
| Daily session — squat | `SquatScene` | rejection #2, the Skia primitive rig |
| Daily session — bench | `StillPlateStage` | **rejection #1**, phase-swapped JPEG stills |
| Daily session — deadlift | `StillPlateStage` | **rejection #1**, same |
| Meet Day — all three | `src/lift/LiftStage.tsx` | the legacy sprite stage |

`StillPlateStage` selects one of three `.jpg` files per lift from
`ironAmberPlateFor(kind, phase, height)`. That is the phase-swap by
construction: three poses, chosen by a threshold on `height`, with nothing
between them.

This is the state `docs/design/IRON-AND-AMBER-REFERENCE.md` names when it says
a visual implementation is not complete while the legacy composition remains
the primary experience — so **no VISUAL gate is claimed on any lift surface**,
squat included.

## 9. Blocked

**`ASSET_PIPELINE_BLOCKED`** — the full report, with the missing asset, the
required format, the required authoring tool and the ownership need, is
`docs/design/ATHLETE-ASSET-PIPELINE.md` §2.

No production character artwork exists, and none can be authored from this
environment under any of the three options. This is a real blocker on the
athlete, and it is **not** a reason to ship a fourth placeholder body — the
product standard explicitly refuses one.

Non-blocked work proceeds and is done: the binding to the mechanics lane's
frozen contract (`src/art/athleteRig.ts`, consuming
`src/game/liftPresentation.ts` at `20bda71d`), the unmounted production
stage pair (`src/session/AthleteStage.native.tsx` / `.web.tsx`), the pipeline specification
(`docs/design/ATHLETE-ASSET-PIPELINE.md`), the data request to the
mechanics owner (`docs/design/PRESENTATION-CONTRACT-REQUEST.md`), and the
runtime spike (§7).

**The second, smaller asset gap — the spike's own test `.riv` — is CLOSED
as of 2026-09-08.** It is `assets/dev/quick_start.riv` (MIT; provenance in
`assets/dev/THIRD-PARTY-RIVE-ASSETS.md`), a real articulated graphic with a
ViewModel number the spike drives at 60 Hz; §7's second run is the
measurement. It is not the athlete and closes nothing about the athlete.
What it settled beyond the spike: a legally usable `.riv` IS obtainable from
this environment (over the git path to the vendor's MIT repositories), so
"no asset can reach here" is no longer a reason for anything.
