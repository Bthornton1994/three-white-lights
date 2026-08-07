# Three White Lights

A powerlifting game. React Native + Expo, TypeScript, 16-bit pixel art generated
in code — no image assets are checked in, every sprite and room is drawn by a
pure function.

`docs/GDD.md` is the source of truth for design. `CLAUDE.md` is the build
contract. This file is only how to run it.

---

## Run it

You need **Node 22+** and npm. The branch is `claude/agent-config-setup-m2r6ny`.

```bash
git clone https://github.com/bthornton1994/three-white-lights.git
cd three-white-lights
git checkout claude/agent-config-setup-m2r6ny
npm install
bash tools/dev-web.sh          # serves on http://localhost:8081
```

Then open **http://localhost:8081** and narrow the window to a phone shape —
390 × 844 points is what everything was designed and screenshotted against.
Chrome's device toolbar (`⌘⇧M` / `Ctrl+Shift+M`) set to iPhone 14 is the
closest match.

`npm run web` also works, but prefer `tools/dev-web.sh`: it copies the CanvasKit
WASM binary into `public/` so Skia does not have to fetch it from a CDN, and it
passes `--clear` so Metro cannot serve a stale bundle from its transform cache.
That second one has bitten this project before — restarting the server alone is
*not* enough to pick up a source change.

### On a phone

```bash
npx expo start        # scan the QR code with Expo Go
```

**This path has never been run.** See "What has actually been exercised" below
before trusting it.

---

## The loop, and what to press

The app opens straight onto the readiness check-in — no splash, no home screen.
That is deliberate (GDD §3.2).

1. **Check-in** — three taps: sleep, soreness, motivation.
2. **Briefing** — the prescribed lift and load. Pick an RPE target.
3. **Sets and rest** — tap and hold to descend, release at depth, drive out of
   the hole. A session is 5 × 3 and runs about a minute.
4. **Close-out** — the number that moves is **e1RM**, never Total.
5. **`MEET DAY`** — a control on the check-in, briefing and close-out. Press it.
6. **The meet** — weigh-in, declare openers, then squat → bench → deadlift,
   three attempts each. Attempts never go down. Three-light judging.
7. **Recap → result card**, then `BACK TO TRAINING`.

No control is drawn over a live set, a live attempt, or a cut-in, on purpose — a
mis-tap there costs a rep, an attempt, or the tap that was meant to skip the
interrupt.

### Debug routes

These drive the screenshot harness. They are not reachable in play.

| URL | What it opens |
|---|---|
| `?meet=live` | a playable meet from the start |
| `?meet=walkout-third` | one frozen meet beat (`tools/capture-meet.mjs` lists them) |
| `?session=close-out-accessory` | one frozen session beat |
| `?replay=0.95&moment=hole` | the lift mechanic alone, at a given load |
| `?cutin=personal-record` | one frozen cut-in over the daily session (`tools/capture-cutin.mjs` lists the moments); add `&live=1` to let its auto-dismiss timer run |

`?meet=nonsense` boots the daily session rather than a broken screen, and
`?cutin=nonsense` is inert in the same way.

---

## What has actually been exercised

Being precise about this, because the gap between "it is built" and "it has been
run" is where the surprises live.

**Verified on the running app, in a real browser:**

- The full loop, end to end — 47 checks, including reaching meet day in one
  press with no URL typed, and no surface being a dead end.
- The session boundary — 27 checks, including that a server value the client did
  not predict is what ends up on screen.
- The lift, the sprites, the gym and the result card, as decoded pixels.

**Never run, at all:**

- **Anything on a physical device or simulator.** Every screenshot and every
  check in this project came from headless Chromium against the Expo *web*
  build. iOS and Android have not been opened once.
- **`expo-audio`.** The seven meet-day sounds are synthesised, byte-pinned to
  their recipes, and confirmed to decode in the browser — but the native audio
  path has never executed.
- **Haptics.** `src/lift/haptics.ts` returns a no-op when `Platform.OS === 'web'`,
  so every haptic in the game is unfired so far by construction. The patterns
  exist and are unit-tested; nobody has felt one.

**Not built yet:** Career mode, Arcade mode, Gym Empire and anime cut-ins are
zero files. Meet entry is one ungated door to one local meet — GDD §6.1's
calendar and qualifying-total gate do not exist.

**Untuned:** every timing window, judging threshold, crowd value, haptic pattern
and sound recipe is a placeholder that says so in its own header. GDD §12.1
budgets roughly 30 hand-tuning passes, by playing it. None have happened.

---

## Checks

```bash
npm test                 # 2654 tests across 63 files
npm run typecheck        # tsc --noEmit, strict, no `any`
```

Two of those suites are audits that run on every test pass and fail the build:
`src/tuning/audit.ts` refuses a magic number outside a registered constants
module, and `src/licensing/realIp.ts` refuses a real brand or athlete name in
anything that can reach a screen.

### Screenshots and the progress page

`.gauntlet/` is gitignored, so none of it arrives with a clone. Regenerate:

```bash
bash tools/dev-web.sh
node tools/capture-session.mjs --live     # the daily loop
node tools/capture-meet.mjs --live        # meet day
node tools/verify-shell-route.mjs         # the loop is connected
node tools/verify-session-boundary.mjs    # the server wins on screen
node tools/sprites.mjs                    # sprite sheets, no browser needed
node tools/gym.mjs                        # the room, no browser needed
node tools/progress.mjs                   # build .gauntlet/progress.html
```

`.gauntlet/progress.html` is a single self-contained file — open it in a browser
or send it to a phone. It carries the status report, every piece's state, and
the screenshots inline.
