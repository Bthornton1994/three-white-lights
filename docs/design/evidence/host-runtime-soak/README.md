# Host-runtime soak — HOST-RUNTIME SOAK, not ATHLETE PERFORMANCE

**What this is:** the record of `probe-host-runtime-soak.mjs` beside it, driven
in a real Chromium (Playwright, 390×844, DPR 2) against a server started by
`tools/dev-web.sh` (a `--clear` restart), on the production web host path the
athlete stage will run on — `@rive-app/react-canvas` on the self-hosted engine,
mounted by React under the app's own routing — with the licensed diagnostic
asset (`assets/dev/quick_start.riv`, one bound number written at 60 Hz).
`soak.json` is the machine record; the PNGs are the page at the baseline,
after the resizes, and inside the remount phase. Run: 3 min 55 s wall clock
(`startedAt` → `finishedAt` in the record), on the tree that landed it.

**What it is not:** anything about an athlete. One bound number on a health
bar says nothing about how a forty-three-input rig paces; that measurement
waits for the asset and `node tools/athleteAccept.mjs --web`. It is also not
a device: headless Chromium on a 4-core sandbox, no GPU, no thermal envelope.

## The numbers

| Phase | What was done | What was read |
| --- | --- | --- |
| A baseline | spike route, bound | mounted in 1.08 s (warm bundle); 300 rAF frames in 5 s at 16.67 ms mean / 16.8 max, **0 over 33 ms**; heap 194.7 MB; canvas 1; canvas moving (6,813 px changed in 450 ms); window/document listeners 18 / 28; 0 page errors |
| B sustained | 90.1 s of 60 Hz ViewModel writes, nine 10 s pacing windows, heap sampled each | **5,399 frames, 1 over 33 ms (33.4 ms, in the first window), 0 over 50 ms**; heap 196.9 → 191.7 MB, least-squares slope **−39 kB/s** (GC noise around a flat line, not growth); canvas still moving at the end; status still `bound`; 0 errors |
| C resize | 375×812 ⇄ 390×844, six times, 2 s pacing each | canvas backing store follows (686×640 ⇄ 716×640 px; 343 ⇄ 358 CSS px wide), still one canvas, **0 frames over 33 ms** in any step, canvas moving after each; 0 errors |
| D visibility | (1) another tab in front for 5 s, back; (2) CDP `Page.setWebLifecycleState` frozen 5 s → active, with `visibilitychange`/`freeze`/`resume` listeners installed first | **NOT ACHIEVED IN HEADLESS CHROMIUM** — the page read `visible` behind the other tab, and the freeze command was accepted but the page recorded **no** lifecycle event. Recovery pacing after both was clean (180 frames, 0 over 33 ms) and the canvas kept moving, which only says the page never stopped. A backgrounded tab is a device / headed-browser question and is reported as one, not claimed. |
| E stall | three deliberate 800 ms busy loops on the main thread | worst gap 783 ms each time (the stall itself), then **133 frames at 16.67 ms mean with 0 over 33 ms** — full recovery, no lingering catch-up; canvas moving after each; status `bound`; 0 errors |
| F route cycles | 12 × (player path → spike route) | shell in ~0.9–1.0 s, spike remount in ~0.9–1.0 s each; the spike absent from the shell every time; **one canvas after every mount**; window listeners 18 → 18, document 28 → 28 across all twelve; heap 340 MB after the first (the cold bundle) then ~203 MB flat, one transient 502 MB reading at cycle 10 that the next cycle did not carry; pacing after the last cycle 180 frames, 0 over 33 ms; 0 errors |
| G in-page remount | `?dev-mode=spike-cycle`: the stage unmounted for 300 ms and remounted through a React key every 2.5 s, for 60 s | **24 remounts observed; never more than one canvas**; heap 202.7 → 202.9 MB (slope +7.8 kB/s over twelve 5 s windows — flat); listeners 18 → 18 / 28 → 28; **1 frame over 33 ms (33.3 ms) in 60 s**, at a remount instant; status `bound` in every window; canvas moving at the end; 0 errors |
| H player path | `/` with no flag | the spike absent, address bar empty, 0 errors |

Console across the whole run: the React DevTools install hint and Chromium's
`willReadFrequently` hint for the probe's own `getImageData` — nothing from
the runtime.

## What it says, and what it cannot

The host survives what a phone does to a page, on this asset: sustained
writes at 60 Hz with a flat heap, resizes without a second canvas, a stalled
main thread recovered in one frame, twelve navigations and twenty-four React
unmount/remount cycles with no listener growth and no canvas leak. It cannot
say the athlete will pace — that is one number against forty-three — and it
could not put the page in the background: both transitions this environment
offers left the document `visible`, so backgrounding is owed to a headed
browser or the device.

Reproduce: `tools/dev-web.sh`, then
`OUT_DIR=<dir> BASE_URL=http://localhost:8081 node docs/design/evidence/host-runtime-soak/probe-host-runtime-soak.mjs`.
