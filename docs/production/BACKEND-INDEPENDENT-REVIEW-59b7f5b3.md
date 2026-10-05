# Independent backend review — 59b7f5b3

Reviewed artifact: `Bthornton1994/three-white-lights`, commit `59b7f5b3a84a7d3876a0f04dae1804ba554df019`, tree `943c5a9c29cd1adf88b5951d9c0557fa776c4ba4`.

This is a fresh, read-only code/security review of the requested backend, migration, Edge wrapper/bundle and focused tests. It does not issue a production, art, feel or GDD acceptance PASS. No product code or fixture was edited. The independent probe was written outside the repository.

## Findings

### P1 — A retry can acknowledge a committed request with the account state from before it

**Inferred from the actual SQL plus documented PostgreSQL semantics; not reproduced using two database connections.**

Affected code: `supabase/migrations/20260930193634_twl_authoritative_accounts.sql:23–35`, especially the separate account SELECT at line 30 and receipt SELECT at line 32; `src/production/handler.ts:92–94` and `54–58`.

`twl_read_account` has no volatility declaration, so PostgreSQL treats it as VOLATILE. Such functions obtain a fresh snapshot for each query inside the function. The account and its matching receipt therefore need not describe the same committed version. [Primary PostgreSQL documentation](https://www.postgresql.org/docs/18/xfunc-volatility.html).

Concrete interleaving:

1. Account is at revision N and the original mutation is in flight.
2. Its retry starts `twl_read_account`; line 30 reads state N and revision N.
3. The original request commits state N+1 and its receipt together.
4. Line 32 now reads that new receipt.
5. The handler takes the duplicate path, skips mutation/commit, and returns HTTP 200 with the original acknowledgement ID but a wire reconstructed from state N.

The receipt contains no applied revision that would let the handler detect this mismatch. The native cache can then settle the proposal against the old facts. This is an acknowledgement/read-consistency defect, not a demonstrated cross-account disclosure or a failure of the commit transaction's atomic update/receipt insertion.

The commit RPC's row lock correctly serializes the write decision and receipt insertion. It does not protect this read path. The existing concurrent CAS test explicitly uses PGlite's single serialized connection and cannot exercise this read/commit interleaving.

Bounded correction: read account, matching receipt and database time within one SELECT snapshot, or hold the account row lock across both reads and obtain time after any lock wait. Verify with a deterministic two-connection PostgreSQL test that commits the original mutation between the retry's two reads. Do not call the existing PGlite CAS test a substitute for that test.

### P2 — A late response at the same revision can move the server day backward

**Measured in an independent scratch probe.**

Affected code: `src/production/client.ts:130–132`, `141` and `162`.

The client rejects only an incoming revision strictly below its current revision. Bootstrap responses can share a revision while carrying different database timestamps and accrued facility read models. A later-arriving older response at that revision overwrites the newer opening and resets the monotonic clock anchor.

Concrete sequence: keep one account at revision 7; hold an opening sampled at 02:59 UTC; accept another sampled at 03:01 UTC; then deliver the held response. The older response succeeds and both the reported and projected account day revert by one.

Actual probe output:

```json
{"probe":"same-revision stale HTTP response across UTC 03:00","acceptedOlderResponse":true,"databaseRevision":7,"newerDay":20726,"revertedDay":20725,"newerProjectedDay":20726,"revertedProjectedDay":20725}
```

Command run:

```sh
node --import ./web/node_modules/tsx/dist/loader.mjs /workspace/scratch/4fc55cb00998/backend-final-probe.mjs
```

The probe used the actual production client and server opening functions, mocked HTTP delivery only, and did not change the device wall clock. The server's mutation-day validation still refuses the obsolete day; the observed harm is rollback of the account read model and possible legitimate-save refusal around rollover. The epoch guards do prevent responses and token refreshes from a previous account reviving that account.

Bounded correction: order same-revision openings by `serverNowMs` as well as revision and retain the newer opening when an old response arrives; preserve any valid acknowledgement independently of whether its opening is adopted. Add a same-account out-of-order rollover regression alongside the existing account-switch tests.

## Validation actually run

```sh
npm --prefix web run test:unit:web -- web/tests/production-repository.test.ts web/tests/production-replay.test.ts web/tests/production-client.test.ts --reporter=verbose
```

Actual footer: `Test Files 3 passed (3)`; `Tests 29 passed (29)`; `Duration 2.86s`.

```sh
npm test -- src/production/server.test.ts --reporter=verbose
```

Actual footer: `Test Files 1 passed (1)`; `Tests 3 passed (3)`; `Duration 1.15s`.

```sh
node supabase/bundle-api.mjs --check
```

Actual output:

```json
{"checked":true,"inputs":56,"bytes":231339,"sha256":"6a3f64d04e4608efda8dbc860524ef0ecdbd2d8916f5e0b7109d4f87f40081a1"}
```

Both strict typechecks exited 0 without diagnostic output:

```sh
./web/node_modules/.bin/tsc --noEmit --project src/production/tsconfig.json
./web/node_modules/.bin/tsc --noEmit --project supabase/tsconfig.json
```

The focused tests meaningfully cover browser-role denial in the actual migration, account separation, payload-bound receipts, CAS, rollback on receipt failure, real native replay for the three training lifts and nine meet attempts, forged inputs/results, original meet acknowledgement IDs, server-time purse credit/spending, corrupted saves, account-switch/token races and lower-revision response rejection. They pass despite the two findings above.

## Inspection conclusions and limits

- The Edge wrapper establishes identity through live Auth `/auth/v1/user`, validates a UUID, rejects anonymous users, and supplies that identity to the repository. The handler does not accept a client account ID.
- The SQL uses SECURITY INVOKER, empty search paths, RLS, and explicit browser-role table/RPC revocations. Service-role grants are explicit. This was inspected and exercised locally; the review did not inspect a deployed project's effective grants, policies, migration application or credential configuration.
- Training/meet evidence reconstructs native prescribed configuration, physics, execution quality and judges before producing the proposal. The reviewed saved-account API exposes no raw replacement, reset or advance command. Device clock hints do not choose the mutation day.
- The facility purse supplies Career's whole Gym Bucks balance; native training and meet application carry the wallet through without a cash payout. The tests exercise earning from elapsed database time and spending from that same purse. The changed record and browser opening are deeply sealed.
- Actual JWT verification at a deployed gateway, the real Auth service, PostgREST transport, multi-connection PostgreSQL concurrency, load limits under live traffic, and positive live saved-account browser play were not exercised in this review.
- VISION, GDD's authority/day-boundary requirements, CLAUDE's critic/architecture doctrine and the authority route table were read. The often-cited §7.5 route table is in `src/game/progression.ts`; GDD cross-references it. Those documents support a read-only backend review, not an automated art or human-feel ruling.
- `node tools/evidence.mjs suite --verify` exited 1: `STALE: suite.txt describes 5571227a, and code changed since: (unavailable). Regenerate before grading.` It also reported uncommitted restored code and old shot provenance. No claim here relies on that stale full-suite/artifact evidence. Overall acceptance remains unverifiable from that bundle.

## Exact artifact binding

GitHub's commit API confirmed the supplied commit's tree. A recursive, non-truncated tree response was compared with local Git blob hashes for 78 inspected/configuration files, including all 56 native bundle inputs. All 77 code, test, configuration and CLAUDE/VISION/GDD files matched the published tree. Local `AGENTS.md` had a different blob hash; published `AGENTS.md` was separately fetched/read and its applicable instructions agree. The shared checkout HEAD (`151899755052ed533a7921ae9d58cf17047822f2`) is not used as the reviewed artifact identity.

| Reviewed file | Published/matching local Git blob |
| --- | --- |
| `src/production/client.ts` | `e20fea90b58ac746eee285a888b266d6d1a8d847` |
| `src/production/handler.ts` | `6790e21bb17ac22258079e1920ca91010eddd5b7` |
| `src/production/server.ts` | `5685eb64348fb6a0b33fef7ffb5e107dd4de2a18` |
| `src/production/evidenceReplay.ts` | `690e11a6d1da3a03d3b75ce52aac4b80710d2975` |
| `src/production/liftEvidence.ts` | `8003d05c5152365a08123ebf85e26768ea09131a` |
| `src/production/clock.ts` | `6860740f90d233970cff0b493f6c98af65c656e5` |
| `src/production/productionTuning.ts` | `aefe441e81f30e9e3d15c13c62358df3ac6d55ec` |
| `src/production/contracts.ts` | `1a0dffcd260d6e00ad88eea65a97f3b0e2bba12f` |
| `supabase/migrations/20260930193634_twl_authoritative_accounts.sql` | `7075d92b9f555c56506ba2f2aa10a42e006b4713` |
| `supabase/functions/twl-api/index.ts` | `fa260fd37906281b5c5a15fbf88063b632852988` |
| `supabase/functions/twl-api/domain.js` | `e693ca05a79775e65fe5cfc76dedb8677192b7cb` |
| `web/tests/production-repository.test.ts` | `664c4d0242716312bab0f0cb53f1e2273e580f54` |
| `web/tests/production-replay.test.ts` | `f29b7631f04f5c40b469f2238eec68fde722ab14` |
| `web/tests/production-client.test.ts` | `bd033cd8520609fe3c86cb89214e6edbe3fdf7fb` |
| `src/production/server.test.ts` | `e116d13f0f504b291ca10cd885e53461a9c2ca3f` |

The review findings apply to these frozen bytes. Any correction requires a new bundle check and focused verification before this review can be used to discuss the revised artifact.
