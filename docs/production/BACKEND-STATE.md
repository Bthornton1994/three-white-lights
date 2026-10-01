# Authoritative backend state

This implementation aligns with VISION's career memory and GDD §9.2 server authority, §5 facility economy, §6 meet rules, and §8.2 currencies. It preserves the accepted native lift engines and scoring rules.

The owned implementation is `src/production/`, the additive `twl_*` migration, and `supabase/functions/twl-api/`. Auth verifies the user before service-role RPC access. Anonymous and signed-in browser roles cannot read or mutate the account tables or execute their RPCs directly. Clients submit allowed actions and native input evidence; they cannot replace progression or advance the clock.

Account commits combine a revision comparison and payload-bound receipt in one transaction. Reusing an ID with different content is refused. The read RPC obtains account state, revision and receipt in one SQL statement. Days roll over at 03:00 UTC. Facility accrual uses database time, and the browser preserves a monotonic estimate when late responses arrive.

Training evidence captures readiness/RPE at explicit Start and ordered input events for every rep. Meet evidence covers the real native attempts and server-owned entry baseline. Both are replayed through native engines before applying native progression. This proves consistency of legal simulated inputs and their outcomes; it does not prove a human performed them.

The facility purse is the spendable Gym Bucks authority, including its fractional balance. Native record wallets mirror its whole displayed balance. Existing training/meet reducers do not award Gym Bucks; no new training reward was invented. An executed SQL integration covers accepted training, server-time idle earnings, a facility purchase, and an exact retry without a second spend.

Focused checks have passed: 3 native production tests, 31 browser backend tests, strict production/edge/test TypeScript, and exact generated-bundle checking. Backend tests execute PGlite 0.5.8 with the real migration, role grants, RPCs, handler, client lifecycle and native replay. PGlite uses one connection; it does not establish PostgreSQL multi-connection contention behavior. No standalone PostgreSQL process was available for that regression.

One actual browser run played all 15 training reps through the real client, handler and SQL RPCs. It received revision 2 and the original native acknowledgement, persisted one session, and restored `Session logged.` after a fresh authenticated bootstrap. Its final selector failed because Training intentionally removes the global footer. The corrected full two-account browser capture is still pending after an execution-runtime disconnection; a completed nine-attempt saved meet, final reload and account isolation must be reported from its actual result.

The user-designated Supabase project is `qbvmtgaphvpwpwemplje`. Control-plane health was available, but the read-only database clock/table probe terminated with a connection timeout. No live migration, function deployment or hosted saved-account verification is claimed. Missing original art was also observed in the local account run; functional saves do not establish the art release gate or physical-device/haptic acceptance.

Rerun `node scripts/production-account-browser.mjs` with `BROWSER_EXECUTABLE_PATH` when needed. Its fixture, Vite and Chromium run as children of one parent process, and its report under `.gauntlet/evidence/production/account-browser/` binds source/instrument hashes and acknowledgements. Auth identities/tokens alone are fixtures. Before a live rollout, follow `OPERATIONS.md`, use only the public key in the browser, configure exact allowed origins, and obtain a fresh independent review of the published artifact.
