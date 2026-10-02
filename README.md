# Three White Lights

A powerlifting sports game: build a lifter, train squat, bench, and deadlift, grow a gym, and enter an authentic nine-attempt meet. The production browser interface follows the [Iron & Amber reference](docs/design/IRON-AND-AMBER-REFERENCE.md).

## Run the browser game

Use Node 22.13 or newer.

```sh
npm --prefix web ci
npm --prefix web run dev
```

Open `http://localhost:5173`. The browser package reuses the existing pure training, progression, career, meet, and facility rules. It does not require Expo or CanvasKit to load.

```sh
npm --prefix web run typecheck
npm --prefix web run test:domain
npm --prefix web run test:unit:web
npm --prefix web run build
npm --prefix web run test:browser
```

The browser check starts the built preview, drives normal controls at phone and desktop sizes, and records screenshots and a JSON report under `.gauntlet/shots/production-web/`. To test an existing server, set `BROWSER_BASE_URL`.

## Saved accounts and practice

Practice is an explicit disposable game. It keeps a lifter and gym for the current app run, never writes account progression, and resets on reload. Signing in opens the account's confirmed state rather than importing practice currency or results.

Saved accounts require the production backend. Set public browser configuration `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` before building. A publishable key is also supported. Service role keys belong only on the server. Missing configuration produces an explicit unavailable account screen; it never silently saves account progress locally.

See [production operations](docs/production/OPERATIONS.md) for deployment, persistence, and release checks.

## The game

- Gym: inspect equipment, collect earned income, and work toward a larger space.
- Build: move owned equipment on a validated floor grid. Purchases go to storage before placement.
- Shop: prices, ownership, room requirements, and affordability come from the facility rules.
- Staff: compare hiring costs, wages, and repair thresholds before hiring a manager.
- Train: answer three readiness questions, choose an effort target, complete live sets, and save the session. Training moves estimated one-rep max, not competition Total.
- Career: create a lifter, choose a fictional federation, and enter meets through the calendar and qualifying gates.
- Meet: declare openers and complete squat, bench, and deadlift in order, with three nondecreasing attempts each, commands, and three-light judging. Export the result sheet as a PNG.

Use pointer, touch, Space, or Enter for the live lift control. Losing focus or switching tabs pauses the lift and releases the grip. Visible cues accompany the control; a fatigue meter is never shown.

## Native app and design authority

The original React Native and Expo application remains at the repository root. Its commands and frozen mechanics are separate from the browser package:

```sh
npm ci
npm test
npm run typecheck
npx expo start
```

[VISION.md](VISION.md) defines the product purpose, [docs/GDD.md](docs/GDD.md) governs gameplay, and [CLAUDE.md](CLAUDE.md) governs engineering and review. The browser release preserves the accepted lift engines and meet rules. Automated checks do not establish physical-device feel, haptics, or human pacing acceptance. The existing A0 physical-device QA and A2 human playtest requirements remain open.
