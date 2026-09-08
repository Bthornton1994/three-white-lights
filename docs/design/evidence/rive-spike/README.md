# Rive runtime spike — browser evidence

**What this is:** the record of ADR-001 §7's dev-only runtime spike driven in a
real Chromium (Playwright, 390×844, DPR 2) against the Expo web dev server
started by `tools/dev-web.sh` (a `--clear` restart before every take, so the
bundle is the shipped source). `probe.json` is the machine record;
`spike-route.png` and `spike-route-later.png` are the spike route 450 ms
apart; `player-path.png` is the shell with no flag; `probe-rive-spike.mjs`
is the script that produced all of them.

**What this is not:** a GDD §12.2 evidence bundle. It is not listed in
`tools/evidence.mjs`'s `REQUIRED_SHOT_RECORDS` and `--verify` does not check
it — on purpose, so a spike measurement never reads as a graded piece. It
proves the RUNTIME wiring on a real graphic, not the athlete; there is no
athlete in it.

**Measured at:** the tree of commit `6ac60fab` plus the state-machine fix
and the singular `stateMachine` parameter that the commit carrying this
record ships (the record lives in that commit, which is what stamps it).
Environment: Linux sandbox, 4 cores, no native toolchain — the WEB half of
§7 only. Asset: `assets/dev/quick_start.riv`, the vendor's MIT quick-start
health bar (`assets/dev/THIRD-PARTY-RIVE-ASSETS.md`), one ViewModel number
`health`, driven at 60 Hz by the synthetic feed's `barHeight` × 100.

## Three runs, in order, and what each one changed

The record on disk is the third. The first two are part of its provenance
because each changed the code, and the difference between them is the
finding of this round.

| Run | Status line | Changed pixels / 458,240, 450 ms apart | What it meant |
| --- | --- | --- | --- |
| 1 | `bound — writing health at 60fps` | **0** (max channel delta 0) | The real file loaded, a ViewModel instance bound, the write loop ran — and nothing on screen answered. Console: *"No `stateMachine` was specified, so the artboard's first linear animation is playing by default."* Data binding drives a state machine; none was running. **"Bound" is not "driven."** The frame read the file's authored default, `16`. |
| 2 | same | **14,970** (max delta 255) | `stateMachines: 'State Machine 1'` named on the web stage (and `stateMachineName` on native). The bar drains and refills with the feed. One deprecation warning: use the singular `stateMachine`. |
| 3 — the record | same | **5,918** (max delta 255) | The singular parameter on both web stages. No runtime warnings. The count differs from run 2 because the two samples land at a different phase of the 1800 ms synthetic rep — non-zero is the claim, the magnitude is where in the rep the shutter fell. |

Run 1 is why the pixel count exists in the probe and why
`src/art/rivContract.ts` now checks that each artboard the stage selects
carries a state machine of the same name. It is also why the production
stages name their state machine — they had the same omission.

## The numbers (run 3)

- Spike route mounted in **13,757 ms** (cold, first bundle after `--clear`);
  status settled at 13,773 ms reading `bound — writing health at 60fps`;
  1 canvas; 0 uncaught page errors; address bar `?dev-rive-spike=1`.
- **Scene motion:** canvas 716×640 (458,240 px, all opaque); two
  `getImageData` readbacks 450 ms apart differ in **5,918 px**, max channel
  delta **255**. The frames show it: `HEALTH 100`, a full green bar, then
  `HEALTH 14`, a short red bar — the file's own state machine reading the
  bound number for the fill, the readout and the colour.
- rAF pacing for 5 s with the 60 Hz ViewModel write loop running AND the
  scene drawing: **300 frames, mean 16.67 ms, p50 16.7, p95 16.7, max 16.8,
  0 frames over 33 ms.** The placeholder run's "floor" number, now with a
  graphic under it.
- JS heap over 10 s: 192.3 MB → 194.7 MB (Δ +2.35 MB). Runs 1 and 2 read
  −5.44 MB and −0.02 MB on the same window — the three together are
  garbage-collector noise around a flat line, not a trend. A longer soak
  is a device question.
- Console: one Chromium hint about `willReadFrequently` on the readback
  canvas — the probe's own `getImageData`, not the app. No Rive warnings.
- Player path (`/`): `app-shell` present, `dev-rive-spike` **absent**, shell
  in 1,013 ms, address bar empty, 0 page errors. `?dev-rive-spike=0` opens
  the spike: **False**.

## What it proves and what it does not

Proves, on web: the modern runtime's web counterpart installs, bundles with
the native (Nitro) file excluded, mounts, initialises its engine from a
Metro-served wasm, loads a REAL `.riv`, binds its default ViewModel, and —
with its state machine named — draws a graphic that follows a continuous
60 Hz ViewModel write without disturbing the frame cadence, while the
player path stays untouched.

Does not prove: anything about an athlete (this is a health bar), the
native half (no toolchain here), how a rig with forty-two inputs paces
(this file has one), or responsive sizing (a fixed 320 dp stage). See
ADR-001 §7 and §9.
