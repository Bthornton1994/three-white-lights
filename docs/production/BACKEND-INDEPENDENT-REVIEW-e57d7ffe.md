# Independent backend review of e57d7ffe

## Scope and artifact binding

This is a read-only code/security review of `Bthornton1994/three-white-lights` commit `e57d7ffe35a3b1041303ea482c20435f92af0797`, tree `3081579dc8d22174df7caca031366ffb9f1d37d5`. GitHub's immutable commit and non-truncated recursive tree were retrieved before code review. The production modules, Edge wrapper, migration, focused test source/configuration and all 56 native bundle inputs were compared with their published blobs. Native inputs also matched the SHA-256 values in the bundle manifest. No product or test source was edited.

A later evidence-only supplement was checked separately: commit `62ab44f55b1c6ad877dc56e3608f2f73196343ad`, tree `4ad5c3443d0d3f80d563366b873b7a9b3b282339`. Relevant runtime/backend/test/bundle blobs are unchanged from e57d7ffe. This review does not extend to future modifications or establish GDD, art, physical feel, deployment, or production acceptance.

The prior independent review `docs/production/BACKEND-INDEPENDENT-REVIEW-59b7f5b3.md` was used only to identify the two defect definitions. Current source and actual evidence were inspected independently, under the VISION authority boundaries, GDD time/progression requirements, the native §7.5 route table, and CLAUDE critic doctrine.

## Current findings

No additional confirmed code/security blocker was found within this bounded review. This is not an overall PASS.

The two previously identified defects are corrected in the reviewed source:

| Prior defect | Current code and observed result | Remaining proof limit |
| --- | --- | --- |
| P1: separate VOLATILE account/receipt reads could combine revision N with a receipt from N+1 | Migration lines 23–33 implement `twl_read_account` as one SQL SELECT with account and receipt joins. Both persisted values therefore belong to one statement's MVCC snapshot. Commit lines 69–98 serialize the revision decision and receipt insertion under the same account row lock and transaction. | The focused PGlite test inspects the actual SQL function and performs real reads/commits. It is one connection; it does not execute the original two-connection race on hosted PostgreSQL. The correction follows from the single-statement code, rather than a claimed concurrency stress pass. |
| P2: an equal-revision late response could move the client time/day backward | Client lines 130–138 reject lower revisions and older equal-revision time/day, while retaining the monotonic server-time estimate for accepted responses. Lines 161 and 168 expose the projected UTC day from that same anchor. | Network suspension and physical-device monotonic-clock behavior were not tested. The committed rollover test primarily exercises bootstrap/opening ordering; the independent acknowledgement probe below adds a real client/handler retry path. |

The independent acknowledgement probe used the actual production client, handler and native federation mutation, with simulated Auth and repository transport. It held the first acknowledgement after one commit, loaded the same revision at the next UTC day, then delivered the old acknowledgement. The client rejected it without changing the newer day. Retrying the identical request ID and payload recovered the original native proposal acknowledgement with no second commit, even though `expectedRevision` advanced from 7 to 8. This confirms the intended distinction between proposal identity and transport concurrency state.

Observed probe output:

```json
{"probe":"delayed native acknowledgement across UTC rollover and unchanged retry","originalResponseRejected":true,"newerDay":20726,"retainedDay":20726,"acknowledgedProposalId":"rollover-retry","commitCount":1,"revision":8,"originalExpectedRevision":7,"retryExpectedRevision":8,"boundary":"actual client and handler; Auth and repository simulated; no PostgreSQL concurrency claim"}
```

The probe instrument was written outside the repository; its SHA-256 was `2b5db928f256e3676499514f02930f61a9f2dc009a46a6152e009f991ec7f7ad`. Rejecting an otherwise successful late response may leave the native flow waiting for a deliberate retry; this probe demonstrates safe receipt recovery, not acceptance of the old response.

## Authority and receipt inspection

The Edge wrapper establishes the user ID through the bearer token's live Auth `/auth/v1/user` response, rejects anonymous/invalid identities, and constructs SQL calls from that identity. The handler does not take an owner from the request body. Service credentials stay in the Edge wrapper. Both tables have RLS enabled and no browser policies; table/RPC permissions are explicitly revoked from public, anon and authenticated and granted to service_role.

The migration's account update and receipt insertion are one transaction; a failed receipt constraint rolls back the revision update. The handler hashes canonical `{kind,payload}`, excluding expected revision, and rejects reuse of a request ID with a different payload. Stored receipts retain acknowledgement identity, while replayed responses use current coherent state plus the original native proposal acknowledgement. This preserves successful retries after lost responses without granting arbitrary state replacement.

The inspected mutation allowlist exposes no raw reset, account replacement, or client advance-clock command. Database time drives the UTC 03:00 boundary and facility accrual. Client device date does not choose an accepted progression day. Lift evidence is checked against authoritative kind, seed, load and moment, then replayed through native physics, session prescription, meet ordering and judges. Client success flags, e1RM, total and purse are not directly committed. The native facility purse is projected into the one record wallet, and server/client record views are deeply sealed.

These statements are code findings and local-test observations. They do not prove deployed environment configuration, live JWT gateway behavior, or service-key handling in an external deployment.

## Focused evidence actually inspected

The committed `.gauntlet/evidence/production/backend-focused-checks.json` blob is `a48411e10c37cacfcd6442fd85a663b027db2b3d`. Its six referenced log SHA-256 values were independently recomputed and matched. Logs show: bundle check exit 0; production, Edge and browser-test typechecks exit 0; 3 native server tests passed; 31 focused web tests passed. Its source reference is b246f9a rather than e57d7ffe. Comparing 81 selected source/config/lock paths between those trees found 80 identical; only the native root `package-lock.json` differs. Consequently it supports the unchanged focused code, not an exact clean-install claim for the complete later artifact.

Fresh focused executions also completed with 31 web cases in three files and 3 native cases in one file; the fresh bundle check returned SHA-256 `6a3f64d04e4608efda8dbc860524ef0ecdbd2d8916f5e0b7109d4f87f40081a1`, 56 inputs and 231339 bytes. Fresh production and Edge typechecks succeeded. A subsequent browser-test typecheck failed on an unsupported Vite `tsconfig` property, but hash rechecking showed the shared local `web/vitest.config.ts` had changed from published blob `29ab0e03db128a35c85d73840ea85200275c61cc` to unpublished `98b544dbb5f4609ba209ae869378030f11ad3af0`; local web lock bytes also changed. That result is excluded from findings about the immutable artifact. Further config-dependent local checks stopped. No independent clean immutable install reproduction is claimed.

Seven committed evidence files were missing or differed locally during initial verification. Their exact e57d7ffe blobs were fetched from GitHub before use. Uncommitted evidence was excluded.

The supplemental saved-account report blob `6842307df3a529df19bc99bff50eedd7bd3b5ae1` and source-attestation blob `0b1deb3f3f584584fd621a17ffcd8819f97876ce` were retrieved and verified. Report SHA-256 `85dbba392a199342274993f32f89ad7caf615fbb9c91e43d6a99bdbb40562679` and all 19 captured source SHA-256 values matched independently; those source blobs also match both reviewed trees. The instruments use real production bundle/handler, migration, service-role SQL RPCs, browser client and native hooks. The Auth identities/tokens are explicit loopback fixtures.

The report records 15 training reps with one persisted session and acknowledgement at revision 2, reload with a verified fixture identity and SQL revision, nine meet attempts with one persisted meet and original acknowledgement at revision 3, total 90 kg after reload, and preservation of the first account while a second account is used. The two accounts use separate fresh browser contexts: this is cross-account persistence evidence, not a same-browser sign-out/switch race. Focused client unit cases cover late responses and token refresh after account changes. The report's actual status is `account-flow-passed-art-incomplete`; recorded asset failures and explicit fixture limitations are retained.

The committed full native result `.gauntlet/evidence/production/native-full-final.json`, blob `9e25bb4154b92fa76add740b32db286f7a9168cc`, is an actual FAIL: 3971 tests, 3948 passed, 23 failed. No later complete-suite pass was verified. Evidence/art restoration additions do not turn this saved failure into an acceptance result.

## Meaningful limits and next proof

A live Supabase staging check remains necessary to establish real JWT identity, deployed RPC/RLS grants, two-connection same-user contention, and receipt recovery after interruption. It should specifically interleave account reads with a committing receipt, reuse the same proposal after a lost response, reject altered payloads under that ID, and verify atomic revision/receipt persistence. The current single-statement correction is reviewable without claiming that those live tests have already passed.

No hosted service, native device, production release configuration, physical touch/haptics, human performance, or art acceptance was exercised by this review. Overall acceptance remains unestablished.

## Published source blobs checked

| Path | Git blob SHA |
| --- | --- |
| `src/production/client.ts` | `df8ceff063a360c5fbb577c4cb4386733544cff3` |
| `src/production/clock.ts` | `6860740f90d233970cff0b493f6c98af65c656e5` |
| `src/production/contracts.ts` | `1a0dffcd260d6e00ad88eea65a97f3b0e2bba12f` |
| `src/production/evidenceReplay.ts` | `690e11a6d1da3a03d3b75ce52aac4b80710d2975` |
| `src/production/handler.ts` | `6790e21bb17ac22258079e1920ca91010eddd5b7` |
| `src/production/liftEvidence.ts` | `8003d05c5152365a08123ebf85e26768ea09131a` |
| `src/production/productionTuning.ts` | `aefe441e81f30e9e3d15c13c62358df3ac6d55ec` |
| `src/production/server.ts` | `5685eb64348fb6a0b33fef7ffb5e107dd4de2a18` |
| `src/production/server.test.ts` | `e116d13f0f504b291ca10cd885e53461a9c2ca3f` |
| `supabase/migrations/20260930193634_twl_authoritative_accounts.sql` | `190bbc602b90bd37582b5ae32becd5a6377a6757` |
| `supabase/functions/twl-api/index.ts` | `fa260fd37906281b5c5a15fbf88063b632852988` |
| `supabase/functions/twl-api/domain.js` | `e693ca05a79775e65fe5cfc76dedb8677192b7cb` |
| `supabase/functions/twl-api/domain.manifest.json` | `13163d0201f4df081d6377146ac3129451fe0840` |
| `web/tests/production-client.test.ts` | `05038afd86a487e2dc299104098906dcfda7c3e3` |
| `web/tests/production-replay.test.ts` | `f29b7631f04f5c40b469f2238eec68fde722ab14` |
| `web/tests/production-repository.test.ts` | `883355b9a7b7fdd4d13206c4e2ad2d91328c4e0d` |
