# Shared-project backend rollout — 2026-10-01

## Owner decision

The owner authorized finishing the live backend rollout in the existing Supabase project: “If we can make it work no issue with one project then do it and make sure its correct. Also continue and Finish the backend roll out.” This selects the shared-project saved-account implementation for the private beta, resolving the earlier local-first/deferred-Supabase question for this rollout. It does not change the accepted native mechanics, authorize a public launch, or supply human A2 acceptance.

## Deployed state

| Item | Verified result |
| --- | --- |
| Project | `qbvmtgaphvpwpwemplje`, existing shared VA project |
| Migration | `20260930193634_twl_authoritative_accounts.sql` applied as `twl_authoritative_accounts` |
| Account storage | `public.twl_accounts` and `public.twl_request_receipts`; RLS enabled, browser roles have no direct table/RPC access |
| API | `twl-api` version 3, ACTIVE, gateway JWT verification **enabled** |
| Identity | Fresh Auth `/user` lookup on every API request; account ID derived from the authenticated user |
| Beta admission | Server-controlled `app_metadata.twl_access = 'closed-beta'`; client metadata cannot grant admission |
| Owner | Existing confirmed owner account enrolled; unrelated shared Auth metadata preserved |
| Current keys | Modern publishable/secret defaults supported; privileged keys remain server-only, legacy fallback supported |
| Frontend | Sign-in-only invited-account UI; local build configured with this project's public URL/publishable key |
| Temporary verifier | Version 10 contains only the retired handler and immutable protocol constants; unauthenticated POST independently observed returning **410** |

`TWL_ALLOWED_ORIGINS` is exactly:

```text
http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173
```

Each origin passed a genuine OPTIONS request without a JWT or API key. An unapproved origin was refused without a permissive CORS header. No hosted TWL frontend was found in repository deployment statuses or the connected Vercel team. No public frontend domain was invented or allowed. Shared global Auth settings, Site URL, redirect allowlist, and the unrelated `qa-step2a-golden-path` function were left unchanged. Sign-in uses the existing account password flow; the beta UI does not offer self-registration or depend on another app's email redirect.

The project shares Auth, infrastructure, and capacity. TWL's tested admission and account boundaries isolate game saves at the application/database permission layers; they do not claim separate-project infrastructure isolation. The new migration is additive and does not alter unrelated shared tables/functions, including the pre-existing Software Factory `twl_prepare_proof_*` routines.

## Live proof

The [final redacted result](evidence/live-rollout-final-20261001.json), run `6eaa2f2c-7398-4a0f-9256-6908107b6f19`, passed **44 of 44 checks** against the real deployed API, Auth service, and PostgreSQL RPCs. The [dashboard capture](evidence/live-rollout-final-20261001.jpg) was taken after removing the operator-key header.

- Three disposable confirmed Auth users exercised two invited accounts and one uninvited account. No confirmation email was sent.
- Real password sign-in, refresh, and a second independent password sign-in succeeded.
- A native training session persisted across the new sign-in. All nine native meet attempts were replayed, acknowledged, persisted, and recovered through bootstrap.
- Duplicate requests did not double-save or double-award. Conflicting payload IDs and stale revisions were refused.
- Two simultaneous HTTP updates at the same revision produced one success and one conflict, with exactly one revision increment.
- The second account began with separate state and could not change the first account's saved state. Caller-selected account IDs and client clock changes were refused.
- Actual anonymous/authenticated REST requests to both tables and all three RPCs returned permission-denied errors. Uninvited client metadata could not grant TWL access.
- Removing server enrollment immediately blocked an already-issued JWT through the fresh Auth lookup. This is enrollment revocation, not a claim that Auth sign-out instantly invalidates access JWTs.
- Cleanup deleted all three disposable users. Independent SQL then confirmed nine Auth users, nine shared profiles, zero marked test users, zero TWL test account rows/receipts, and one enrolled owner.

The earlier [40-check result](evidence/live-rollout-20261001.json) and [capture](evidence/live-rollout-20261001.jpg) remain historical evidence. The final run adds four credential-free origin preflights; the earlier capture has not been rewritten to claim them.

[Independent SQL cleanup/permission results](evidence/live-rollout-cleanup-20261001.json) and the [exact read-only query](evidence/live-rollout-cleanup-20261001.sql) are retained. Before/after migration and initial live proof, non-`twl_` public relation and function fingerprints matched (`f1278e9940f2130f495c36b27b61f752`, `5bca307c9758143f36e088d1afd54790`). The shared Auth metadata fingerprint excluding only `twl_access` matched before/after owner enrollment (`5121591ef6624e702670cc2955553172`). These fingerprints are scoped catalog/metadata evidence, not a claim to hash every shared data row. No owner's email or account UUID is published here.

## Source and review binding

The staging source was reconstructed from PR #89 head `1954674cf30cd14c0e63887628ed6cdd0df516c1`. All 487 selected unchanged source/config/assets were copied only after matching their Git blob SHA. This avoided the old local checkout's missing Git objects, absent origin, and unrelated dirty/deleted files. The published changes are handpicked additions/edits against that exact remote parent.

The deployed `twl-api` files were fetched back from Supabase: wrapper and domain match the reviewed source byte for byte. The checked-in Deno configuration was normalized to the deployed bytes (one redundant trailing newline removed). The domain manifest verifies all **57 inputs**, **231,901 bytes**, with the SHA below. Historical executed operator hashes below bind to [commit `3ccf1c8`](https://github.com/Bthornton1994/three-white-lights/commit/3ccf1c8d0e1e91e18e6bab7d5f22a6c0cb15e2cc), where those exact source bytes remain available; later protocol-constant normalization is not represented as another proof or enrollment execution.

| Source | SHA-256 |
| --- | --- |
| API wrapper | `7df8c30b0f77c40b7c7eb34887d0e59edce200c4ef378e67867642dab91b1ebc` |
| API domain | `0dd658d8a73bfff064b49fb91ba0b4f85b205cc1048ddcff0ab7161e293709a7` |
| Deno configuration | `86e88128d08b93c2ef2a378776f0aee04008e9aa5e33fc036f33385634be91d4` |
| Final live proof source, version 8 | `b723bedceb6346e7470c117e569040b3ee97585bddf954290c430f04d6e658cc` |
| Native proof fixtures | `d224a7e6dfef53ce37c6e7abe6c8a37e9e8f979c1f55f0b8080cb060faec4e40` |
| Historical executed owner enrollment operator | `596c1111ebaf32cc5fe2708de8851584d2d8dadd20dd3a06bc71683a68be2764` |
| Historical retired operator handler, version 9 | `cc6c3e2f0ddfc809bf8dbdb71d75dcdbbf1779f7c2444e2f74388110040c7cf0` |
| Current retired handler, version 10 | `a0f1ba5938f84c738d267d35a6c5461ebe1b2a46e0bf0364aa392dae2034ae51` |
| Current immutable operator protocol constants | `ef07645cb9cc9f2db951d089a8f511f9ed504ab1765fe05e0b40e62080448cd0` |
| Closed-beta App | `6dea776581712904f8c244326dac8279c66084ea2dbddbd13214954c4dbbaf3e` |

Independent read-only critics reviewed the additive SQL, authenticated wrapper, fresh beta admission, current key handling, operator authentication, cleanup, and minimal owner metadata update. The cleanup was corrected to attempt every known account even if discovery or an individual deletion failed. The enrollment operation was corrected to PUT only `twl_access`, preserving concurrent unrelated metadata. The final reviewer reran 22 boundary tests and found no blocker. A final tuple `as const` annotation changed TypeScript inference only; that exact source was deployed for the final proof.

Focused verification passed: root strict typecheck; strict production/edge typechecks; 22 identity/operator/key tests; 13 actual-migration SQL/HTTP tests; 70 browser unit tests; browser test typecheck; production build; generated-bundle check. The older identity-only enrollment behavior was restored temporarily for a regression check and produced six expected failures before the fixed source was restored. Tests do not assert only their own implementation.

Local Chromium exited with SIGSEGV before loading the app, so that attempt supplies no browser pass. The current PR's `production-web` workflow provisions Chromium and supplies the browser/mobile controls and art evidence; its exact-head status and the merge gate are linked from PR #89. Do not merge while either required gate is red.

The first exact-head CI run at `3ccf1c8` passed the production browser/mobile story and original-art archive. Its full suites passed 3,988 tests and reported five audit-inventory failures for the new files: tracked-text/test-file counts, the two JPG evidence captures, retained native fixture citations, and bare operator protocol values. The correction keeps the audit domain intact: it registers one immutable local protocol-constants home, replaces operator literals with the same values, and updates exact reviewed inventories. The active API and 57-input bundle remain byte for byte unchanged. Root strict typecheck and all 78 focused numeric-audit/identity/operator/key tests passed after normalization. Current full CI results are linked from the PR.

An independent critic expanded the named constants and verified all three normalized operator bodies are equivalent to their historical reviewed versions. The normalized retired handler was separately executed with environment and network access set to throw: OPTIONS returned 204, POST/GET returned 410, with zero privileged access. Only that retired handler was redeployed, as version 10; its handler/constants/configuration were fetched back and matched exactly. The proof and enrollment operators remain retired. The final non-`twl_` public catalog fingerprints were repeated after the live proof and retirement and still match the original baseline; the exact results are appended to the cleanup record. The original 44-check result and captures remain unchanged.

## Release boundary

The **live shared-project backend rollout is complete**. The frontend production build is ready for a later approved hosting target. PR #89 remains draft/unmerged; no publicly hosted frontend, public launch, physical-device touch/haptics pass, personal owner gameplay, or A2 human acceptance is claimed. Existing historical local account/art captures remain unchanged. Follow [OPERATIONS.md](OPERATIONS.md) for further deployments and additive rollback.
