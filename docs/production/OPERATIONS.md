# Production operations

## Scope and authority

This integration aligns with VISION's powerlifting sports universe, GDD §2.1's career, §5's facility rules, §6's authentic meet, and §9.2's server authority, with constraints: preserve the accepted A0 lift engines and A1 meet rules, keep the two domain layers separate, and do not fabricate human feel acceptance. The owner's current request to use the made Iron & Amber mockups selects the binding visual reference added in PR44. VISION and GDD are not rewritten to manufacture acceptance.

The browser is a separate application package at `web/`, using pure modules from `src/`. The native entry point and game tuning remain intact. `src/facility/` carries the newer PR55 facility reducers; the browser does not import the older native facility UI. `src/facility/ladderView.ts` extracts the exact pure reducers from that branch's JSX module.

## Build and hosting

Node 22.13+ and `npm --prefix web ci` produce the locked browser runtime. `npm --prefix web run build` writes `web/dist`. Netlify's checked-in configuration sets base `web`, command `npm run build`, and publish directory `dist`. Navigation uses fragment identifiers. Missing assets must return a real 404; no broad fallback redirect is needed.

Only public authentication configuration belongs in the browser build. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` or the supported publishable-key alias. Never expose a service role key. Publish a build only after its client configuration matches the deployed authenticated backend.

A missing backend can be used for explicit disposable practice. It is not a verified saved-account release. The unavailable account state is visible, and no practice save is promoted into an account.

## Persistence

An authenticated server must own athlete identity, totals, estimated one-rep max, streak, meet history, protected currencies, and facility income. Clients propose allowed actions. They do not submit a replacement server record or advance the production clock.

The server must validate JWTs and account ownership, use its own clock, serialize account revisions atomically, and retain idempotent receipts. Repeating a request must return its prior outcome or refuse a conflicting payload. A second browser tab must not overwrite a newer revision.

The implementation is `src/production/`, with the authenticated entry point at `supabase/functions/twl-api/index.ts`. Its checked-in `domain.js` is generated from the existing pure rules. `node supabase/bundle-api.mjs --check` verifies that artifact against its manifest and source inputs. The migration at `supabase/migrations/20260930193634_twl_authoritative_accounts.sql` adds only the `twl_*` account tables and RPCs. Direct anonymous and authenticated table/RPC access is denied; the handler resolves the user through Auth before calling the service-role RPCs.

In the shared project, every request also requires current server-controlled `app_metadata.twl_access = 'closed-beta'`. A client-editable `user_metadata` value or stale JWT claim cannot enroll an account. The browser offers invited-account sign-in only. Enrollment applies only the `twl_access` key through Auth Admin, preserving other apps' metadata. The wrapper supports Supabase's current publishable/secret default keys and legacy fallback; modern secret keys are sent only as `apikey` on server-side RPCs.

The read RPC returns state, revision and a matching receipt from one SQL statement. Commits lock the account row, check the expected revision, and write the new account and payload-bound receipt in one transaction. The account day rolls over at 03:00 UTC, and accepted browser responses preserve a monotonic server-time estimate. Training and meets use native replay evidence. Facility earnings and spending use one purse, including its fractional balance.

For the private rollout, first inspect and apply the additive migration to the owner-designated project `qbvmtgaphvpwpwemplje`. Set `TWL_ALLOWED_ORIGINS` to the exact approved frontend origins, retain JWT verification, and deploy `twl-api` from the verified wrapper and bundle. The hosted function reads Supabase's server-side environment; those privileged keys must never enter the frontend build. Then build the frontend with that project's public URL/key and verify real sign-in, reload, saves, retries and account isolation through the deployed endpoint. Keep access internal until the closed-beta release gates are met.

The owner-authorized shared-project backend rollout completed on 2026-10-01; [the deployment report](LIVE-ROLLOUT-20261001.md) records 44 passing live checks, the enrolled owner, exact local development/preview origins, and independent cleanup. Global shared Auth URLs/settings were preserved. Before hosting the frontend, add its actual approved origin explicitly and rebuild using the public project configuration. Do not permit `*` or a guessed domain.

`supabase/verification/` contains supervised operator sources, not functions to leave deployed. The live verifier accepts only an exact server credential, creates disposable no-email test users, and attempts cleanup in `finally`. The enrollment operator verifies an existing confirmed target and updates only TWL admission. Deploy them only for the reviewed operation, preserve redacted results, verify cleanup independently in SQL, then replace the operator endpoint with `retired.ts`. Confirm a credential-free POST returns 410 and fetch the deployed source to verify no privileged handler remains. No server credential, personal target identifier, password, or local `.env` belongs in evidence or Git.

A failed save remains visibly unconfirmed. Training and meet screens offer deliberate retry. A local result is never displayed as a confirmed competition record before the authoritative response.

## Verification

The production workflow runs the existing pure suite and native typecheck, then strict browser typecheck, focused input adapter tests, portable boundary checks, a production build, and Chromium flow checks. Browser evidence includes the actual rendered screens, hit-tested controls at 390×844, input cancellation/resume, navigation, build placement, disposable practice reset, auth failure handling, and missing-asset checks.

Run `npm --prefix web run typecheck:test` for the test adapters and `npm --prefix web run test:unit:web` for replay, client lifecycle, SQL permissions, atomic rollback and persistence checks. `node scripts/production-account-browser.mjs` starts its HTTP fixture, Vite and Chromium together and exercises the real browser client, handler, native replay and SQL RPCs. Only Auth identities/tokens are fixtures. Its report under `.gauntlet/evidence/production/account-browser/` records source hashes and actual acknowledgements; it does not establish live Supabase availability or multi-connection database behavior. `node scripts/production-inspector-browser.mjs` checks cached equipment recovery and short-phone placement controls. Set `BROWSER_EXECUTABLE_PATH` if Chromium is not in Playwright's default cache.

An art-incomplete functional report does not satisfy the production browser gate. Restore the original PNGs from GitHub without substitutions, then rerun the built-app check with zero missing assets and capture fresh evidence for the visual review. Do not merge while a required CI or artifact gate is red.

Review the exact commit being released. A fresh read-only critic must inspect the rendered artifact against `docs/design/iron-and-amber-reference.jpeg`; builder explanations and green tests are not visual acceptance.

Physical phone touch and haptic feel cannot be established by Chromium. The existing device and A2 human playtest gates remain explicit release QA requirements. Never mark them passed from automated evidence.

## Rollback

Keep the previous deployed source revision and backend compatibility. Revert the browser deployment to a verified prior revision if the runtime breaks. Do not reset a player's account, wipe receipts, or downgrade a save schema to roll back presentation. Database migrations must be additive and preserve existing player records.
