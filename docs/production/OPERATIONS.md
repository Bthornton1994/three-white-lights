# Production operations

## Scope and authority

This integration aligns with VISION's powerlifting sports universe, GDD §2.1's career, §5's facility rules, §6's authentic meet, and §7.5's server authority, with constraints: preserve the accepted A0 lift engines and A1 meet rules, keep the two domain layers separate, and do not fabricate human feel acceptance. The owner's current request to use the made Iron & Amber mockups selects the binding visual reference added in PR44. VISION and GDD are not rewritten to manufacture acceptance.

The browser is a separate application package at `web/`, using pure modules from `src/`. The native entry point and game tuning remain intact. `src/facility/` carries the newer PR55 facility reducers; the browser does not import the older native facility UI. `src/facility/ladderView.ts` extracts the exact pure reducers from that branch's JSX module.

## Build and hosting

Node 22.13+ and `npm --prefix web ci` produce the locked browser runtime. `npm --prefix web run build` writes `web/dist`. Netlify's checked-in configuration sets base `web`, command `npm run build`, and publish directory `dist`. Navigation uses fragment identifiers. Missing assets must return a real 404; no broad fallback redirect is needed.

Only public authentication configuration belongs in the browser build. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` or the supported publishable-key alias. Never expose a service role key. Publish a build only after its client configuration matches the deployed authenticated backend.

A missing backend can be used for explicit disposable practice. It is not a verified saved-account release. The unavailable account state is visible, and no practice save is promoted into an account.

## Persistence

An authenticated server must own athlete identity, totals, estimated one-rep max, streak, meet history, protected currencies, and facility income. Clients propose allowed actions. They do not submit a replacement server record or advance the production clock.

The server must validate JWTs and account ownership, use its own clock, serialize account revisions atomically, and retain idempotent receipts. Repeating a request must return its prior outcome or refuse a conflicting payload. A second browser tab must not overwrite a newer revision.

A failed save remains visibly unconfirmed. Training and meet screens offer deliberate retry. A local result is never displayed as a confirmed competition record before the authoritative response.

## Verification

The production workflow runs the existing pure suite and native typecheck, then strict browser typecheck, focused input adapter tests, portable boundary checks, a production build, and Chromium flow checks. Browser evidence includes the actual rendered screens, hit-tested controls at 390×844, input cancellation/resume, navigation, build placement, disposable practice reset, auth failure handling, and missing-asset checks.

Review the exact commit being released. A fresh read-only critic must inspect the rendered artifact against `docs/design/iron-and-amber-reference.jpeg`; builder explanations and green tests are not visual acceptance.

Physical phone touch and haptic feel cannot be established by Chromium. The existing device and A2 human playtest gates remain explicit release QA requirements. Never mark them passed from automated evidence.

## Rollback

Keep the previous deployed source revision and backend compatibility. Revert the browser deployment to a verified prior revision if the runtime breaks. Do not reset a player's account, wipe receipts, or downgrade a save schema to roll back presentation. Database migrations must be additive and preserve existing player records.
