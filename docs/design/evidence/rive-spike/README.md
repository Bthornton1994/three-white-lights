# Rive runtime spike — browser evidence

**What this is:** the record of ADR-001 §7's dev-only runtime spike driven in a
real Chromium (Playwright, 390×844, DPR 2) against the Expo web dev server
started by `tools/dev-web.sh`. `probe.json` is the machine record;
`spike-route.png` and `player-path.png` are what the two routes looked like
at the moment they were read; `probe-rive-spike.mjs` is the script that
produced all three.

**What this is not:** a GDD §12.2 evidence bundle. It is not listed in
`tools/evidence.mjs`'s `REQUIRED_SHOT_RECORDS` and `--verify` does not check
it — on purpose, so a spike measurement never reads as a graded piece. It
proves the RUNTIME wiring, not the athlete; there is no athlete in it.

**Measured at:** HEAD `55f86007` with the spike commit's tree staged (the
record lives in that commit, which is what stamps it). Environment: Linux
sandbox, 4 cores, no native toolchain — so this is the WEB half of §7 only.

## The numbers

- Spike route: mounted in **12686 ms** (cold, first bundle after `--clear`);
  status settled at 12701 ms reading `error: load: loaderror — The file failed to load`;
  console `Bad header` then `The file failed to load` — the runtime's parser
  rejecting the deliberately-invalid placeholder AFTER the self-hosted wasm
  engine loaded; 1 canvas mounted; 0 uncaught page errors.
- rAF pacing for 5 s with the 60 Hz ViewModel write loop running:
  300 frames, mean 16.67 ms, p50 16.7, p95 16.7, max 16.8,
  0 frames over 33 ms. Nothing is drawn (placeholder asset), so this is
  a floor for the write path, not a rendering number.
- JS heap over 10 s: 191.4 MB → 191.7 MB (Δ +358 KB).
- Player path (`/`): `app-shell` present, `dev-rive-spike` **absent**, shell in
  905 ms, address bar empty, 0 page errors. `?dev-rive-spike=0`
  opens the spike: **False**.

## What it proves and what it does not

Proves: the modern runtime's web counterpart installs, bundles with the
native (Nitro) file excluded, mounts, initialises its engine from a Metro-
served wasm, attempts the load, fails on a malformed file exactly as its own
error path specifies, reports that to the screen, and leaves the player path
untouched — with a 60 Hz write loop running the whole time.

Does not prove: that a real `.riv` renders, that a ViewModel number moves a
shape, or how frames pace while it does. See ADR-001 §7 and §9 for the asset
that closes that, and for the native half nothing here could run.
