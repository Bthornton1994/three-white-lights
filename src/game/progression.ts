/**
 * progression.ts — the server-authoritative progression boundary (GDD §9.2).
 *
 * PURE MODULE (CLAUDE.md "Pure logic is separate from UI"): zero React imports,
 * zero side effects, zero I/O, no clock, no randomness, explicit return types on
 * every export. `progression.test.ts` scans this file's own source for `Date`,
 * `Math.random` and `fetch` so the claim is checked rather than asserted.
 *
 * THERE IS NO BACKEND AND THIS FILE IS NOT ONE. It contains no network calls, no
 * Supabase client and no promises. What it contains is the *shape* of the seam:
 * the types and transitions that make client-authoritative progression writes
 * fail `tsc`, so the day a real Edge Function lands nothing has to be unwound.
 *
 * ===========================================================================
 * 1. WHAT THIS MODULE CLAIMS, AND THE ONE SENTENCE IT REDUCES TO
 * ===========================================================================
 *
 * **The client proposes inputs. The server publishes outputs. Nothing here lets
 * an output be authored locally.**
 *
 * "Inputs" are what the player did: this set at this weight for these reps at
 * this RPE; this attempt got these lights; this SKU was purchased. "Outputs" are
 * what the numbers became: the Total, the e1RM, the streak, the balance. Every
 * report type below is an allowlist of inputs, and `tsc` fails if an output ever
 * appears on one (§5). Every output type below is either opaque or branded, and
 * `tsc` fails if a locally computed number is used as one (§3, §4).
 *
 * That is the whole design. The rest is mechanism.
 *
 * ===========================================================================
 * 2. WHY OPACITY FOR THE CONTAINER AND BRANDS FOR THE SCALARS
 * ===========================================================================
 *
 * The obvious construction — brand the state object, `ProgressionFacts & { [S]:
 * 'server' }` — DOES NOT WORK, and it is worth writing down why so nobody
 * "simplifies" this file back into it. Object spread preserves a symbol-keyed
 * brand, so:
 *
 *     const forged: ConfirmedFacts = { ...serverTruth, totalKg: 900 };
 *
 * typechecks. That is precisely the optimistic-update idiom, which means an
 * object brand fails at the one line it exists to stop. (`progression.test.ts`
 * pins this: it builds the same spread against the real `ProgressionSnapshot`
 * and shows the tamper is inert.)
 *
 * So server truth is carried by `ProgressionSnapshot`, whose single property
 * lives under a module-private `unique symbol` (the idiom `meet.ts` uses for its
 * loading rules). A caller cannot name the key, so a caller cannot build one,
 * and spreading one and adding fields produces an object whose extra fields no
 * reader ever looks at.
 *
 * THE SECOND HALF OF THAT SENTENCE IS THE LOAD-BEARING HALF, and reading it as
 * the first half is how this file shipped a live forgery. A spread DOES produce
 * a value of the type — symbols are copied. What it cannot do is change what a
 * reader sees, because every read goes through the symbol. "Inert", not
 * "unconstructible".
 *
 * ONE PROPERTY, NOT ONE PROPERTY PLUS SOME. `InFlightProposal` was written as
 * `{ proposalId; proposal; projection; [BRAND]: true }` — the object-brand shape
 * this paragraph rejects, wearing the opaque shape's symbol — and the spread
 * above went straight through it. It now carries its contents under the symbol
 * like the snapshot does. §6 has the reproduction and the residual.
 *
 * Scalars are branded rather than opaque because a renderer has to be able to
 * print them and do arithmetic on them. `Confirmed<T>` is constrained to
 * `T extends number` on purpose — it must never be reached for as an object
 * brand, because of the hole above.
 *
 * ===========================================================================
 * 3. CONFIRMED vs. PROJECTED — THE STRUCTURAL DISTINCTION
 * ===========================================================================
 *
 * Two disjoint brands over `number`:
 *
 *   - `Confirmed<T>`  — came out of a server response. There is exactly one
 *     mint, the module-private `confirm()`, and it is not exported. A plain
 *     `number` is not assignable to it.
 *
 *     THIS USED TO READ "minted in exactly one place in this file, inside
 *     `receiveProgressionSnapshot`", AND THAT SENTENCE WAS FALSE. `confirm()` is
 *     called four times across three functions — `decodeBestByLift`,
 *     `decodeMeet` and `receiveProgressionSnapshot`. The guarantee the sentence
 *     was reaching for does hold, and is worth stating accurately: all three are
 *     module-private, and the two decoders are reachable only from
 *     `receiveProgressionSnapshot`, so every confirmed number in the app still
 *     comes through one door. One door, several hinges — not one call site.
 *   - `Projected<T>`  — computed locally, optimistically, for display.
 *     `projectedKg` and `projectedCount` are exported, because projecting is
 *     something the client is *supposed* to do.
 *
 * Neither is assignable to the other, and neither is assignable from `number`.
 * Both are assignable *to* `number`, so formatting and comparison still work.
 *
 * `ConfirmedTotalKg` is additionally a `dots.ts` `OfficialTotalKg`, which means a
 * confirmed total can be scored and a projected one cannot: `dotsScore` will not
 * take a `ProjectedKg`. A provisional number cannot reach a leaderboard.
 *
 * ===========================================================================
 * 4. THE CACHE IS A CACHE (CLAUDE.md "Client is a renderer")
 * ===========================================================================
 *
 * `ProgressionCache` has four states and every non-empty one carries the last
 * `ProgressionSnapshot` the server actually sent:
 *
 *   empty      — nothing has been read yet. There is no truth to render and no
 *                change that can be proposed against it.
 *   confirmed  — local state equals the last snapshot.
 *   pending    — a proposal is in flight. The snapshot is unchanged; the
 *                optimistic view sits *beside* it as a `ProgressionProjection`,
 *                never merged into it.
 *   stale      — the transport believes truth has moved on (reconnect, rejected
 *                proposal, revision from elsewhere). The snapshot is still the
 *                best known truth and is still rendered, flagged.
 *
 * The projection is never promoted. There is no `commitProjection`, and a
 * server snapshot *replaces* the projection rather than merging with it.
 *
 * WHY THERE IS NONE IS A RULE ABOUT THIS FILE, NOT AN IMPOSSIBILITY, and the
 * sentence that used to be here claimed the stronger thing: "there cannot be
 * one: promoting would require minting a `ProgressionSnapshot`, and the only
 * mint takes a wire envelope". In-module there certainly can be one —
 * `SNAPSHOT_CONTENTS` and `confirm()` are both in scope, so a function written
 * here could fold a projection into a fresh snapshot without a single cast. What
 * actually stops it is `progression.test.ts`: the export surface is pinned with
 * `toEqual`, so any new export fails a test, and the `[SNAPSHOT_CONTENTS]:`
 * writes in this file are counted, so a second construction fails another.
 * OUTSIDE this module it is impossible, because the symbol is private — which is
 * the claim that was true all along and the one worth making.
 *
 * Reads for rendering go through `readTotalKg` and friends, which return a
 * discriminated `ProgressionReading`. A renderer therefore cannot show a
 * projected number without having handled the `'projected'` branch — the
 * provisionality is in the type, not in a convention about opacity or italics.
 *
 * THAT SENTENCE IS ONLY WORTH SOMETHING IF A RENDERER ACTUALLY GOES THROUGH IT,
 * and for several rounds none did: every `read*` above had zero non-test callers
 * while the daily loop's close-out rendered numbers it had computed itself. A
 * boundary with a write half and no read half is a write-only cache, and the
 * screen it feeds is client-authoritative however well the writes are fenced.
 * The consumers now exist and are named here so the claim can be checked rather
 * than believed: `sessionClient.ts` turns a cache into what the daily session
 * loop knows, `CloseOutView.tsx` renders the three branches differently, and
 * `sessionClient.test.ts` drives a server that DISAGREES with the client's
 * projection and asserts the server's number is what comes out.
 *
 * ---------------------------------------------------------------------------
 * 4.1 A PROJECTION MAY ONLY CLAIM WHAT ITS PROPOSAL CAN MOVE (GDD §2, §3.2, §6.4)
 * ---------------------------------------------------------------------------
 *
 * `ProposalReach` (§5(b)) says a training session moves `bestE1rmKg` and a meet
 * moves `totalKg`. That is a statement about what the SERVER will do. For a
 * while it said nothing at all about the optimistic layer, and the gap was
 * exactly the one GDD §3.2 cares about: a `record-training-session` paired with
 * a projection carrying `totalKg` constructed cleanly, so a session close-out
 * screen could tick a Total up on a Tuesday and no type here objected.
 *
 * §3.2 is explicit that it must not — "the number that moves at the close-out is
 * e1RM, never Total" — because a Total is the sum of best successful COMPETITION
 * attempts and there were no attempts today. A projection is what a screen
 * renders, so a rule about what the daily loop may show is a rule about what a
 * projection may claim.
 *
 * So `proposeChange` is generic in the proposal's kind, and its projection
 * parameter is `ProjectionWithinReach<K>`: every projection field whose fact is
 * outside `ProposalReach[K]` is narrowed to `null` (or to an all-`null` record).
 * `{ ...emptyProjection(), totalKg: projectedKg(645) }` fails `tsc` against a
 * training session and compiles against a meet result. The two exported
 * assertions `A_TRAINING_SESSION_PROJECTION_CANNOT_CLAIM_A_TOTAL` and
 * `A_MEET_RESULT_PROJECTION_CAN_CLAIM_A_TOTAL` pin both directions, because a
 * guard that refuses everything satisfies the prohibition perfectly and breaks
 * the product.
 *
 * TWO CONSEQUENCES WORTH KNOWING BEFORE YOU HIT THEM:
 *
 *   - A VALUE TYPED `ProgressionProjection` IS NO LONGER PROPOSABLE. It might
 *     claim a Total, so it only fits a kind that may move one. Build the
 *     projection at the call site from `emptyProjection()`, which returns the
 *     narrower `UnclaimedProjection` and therefore fits every kind.
 *   - AN UNNARROWED PROPOSAL MAY CLAIM NOTHING. When `K` is the whole kind union
 *     — a dispatcher holding a `ProgressionProposal` — the reach used is the
 *     INTERSECTION of every kind's, which is currently empty, so only
 *     `emptyProjection()` fits. That is the sound reading: a caller that does not
 *     know which proposal it is holding does not know what it may claim, and
 *     narrowing with a `switch` restores the full projection.
 *
 * The runtime half is `PROJECTION_EXCEEDS_REACH`, returned by `proposeChange`
 * for the same pairing forced past the compiler. It reads `factsMovedBy`, i.e.
 * `PROPOSAL_REACH_TABLE`, while the type reads `ProposalReach` — and the table is
 * typed against the map, so it can name FEWER facts but never more. The runtime
 * refusal is therefore never laxer than the compile-time one.
 *
 * ===========================================================================
 * 5. THE PAY-TO-WIN LINE, EXPRESSED IN THE TYPES (GDD §8.1, §12.3)
 * ===========================================================================
 *
 * `PROTECTED_CONCERNS` is the §8.1 list: Total, e1RM, meet results. Training
 * pace is the fourth §8.1 concern and is NOT on it, because it is not a stored
 * fact — see (d) for why it used to be, and what holds that line now. Four
 * mechanisms keep purchases off the list, all of them compile-time:
 *
 *  (a) THE CATALOGUE ALLOWLIST. `ENTITLEMENT_EFFECT_KINDS` is the complete list
 *      of things anything purchasable may do. `ENTITLEMENT_EFFECTS_ARE_EXACTLY_
 *      THE_ALLOWLIST` asserts the `EntitlementEffect` union is exactly that
 *      list, so adding an `'e1rm-boost'` variant fails `tsc` until it is written
 *      into the allowlist directly under this paragraph.
 *
 *  (b) THE REACH MAPS. `ProposalReach` and `EntitlementReach` declare which
 *      facts each proposal kind and each entitlement effect may move.
 *      `PURCHASES_CANNOT_REACH_PROTECTED_CONCERNS` and
 *      `ENTITLEMENTS_CANNOT_REACH_PROTECTED_CONCERNS` assert those reaches are
 *      disjoint from `PROTECTED_CONCERNS`. Widening either map to include
 *      `'bestE1rmKg'` fails at the assertion.
 *
 *      A DISJOINTNESS ASSERTION IS WORTH WHAT ITS OPERANDS ARE WORTH, and a
 *      reach map can stop being worth anything in two different ways. Each has
 *      its own guard, and they are easy to mistake for each other:
 *
 *        - EMPTY. Disjointness over `never` is vacuously true, so each reach is
 *          paired with `..._REACH_IS_NOT_VACUOUS`, which fails if the reach
 *          collapses to nothing.
 *
 *        - STALE. A reach is a hand-written union of string literals, so it can
 *          also drift off the facts entirely. Rename `ConfirmedFacts.totalKg`:
 *          the allowlist forces `PROGRESSION_FACT_KEYS` to follow and
 *          `PROTECTED_CONCERNS_NAME_REAL_FACTS` forces `PROTECTED_CONCERNS` to
 *          follow, but `ProposalReach` would still say `'totalKg'` and would
 *          still compile — now naming a field that does not exist, and now
 *          disjoint from `PROTECTED_CONCERNS` BY SPELLING. The guard passes for
 *          the wrong reason, and the stale row sits there to be copied into the
 *          next `'purchase'`-tagged kind. NON-VACUITY CANNOT SEE THIS: a drifted
 *          union is still non-empty; it just refers to nothing.
 *          `PROPOSAL_REACH_NAMES_REAL_FACTS` and
 *          `ENTITLEMENT_REACH_NAMES_REAL_FACTS` are what fail instead.
 *
 *        - UNBOUND ON THE OTHER SIDE. Both guards above are about the LEFT
 *          operand. THE RIGHT ONE WAS NEVER BOUND AT ALL, and its default was
 *          `unprotected`. `PROTECTED_CONCERNS` was a hand-written list, so a
 *          fact nobody added to it was fair game for a purchase, silently, and
 *          no assertion in this file was looking at the fact set.
 *
 *          That was live, not theoretical, and it was proved by execution before
 *          this was written: adding `simSessionsPerDay: ConfirmedCount` to
 *          `ConfirmedFacts`, widening `PROGRESSION_FACT_KEYS` to match, and
 *          naming it on the `'redeem-entitlement'` row of `ProposalReach`
 *          compiled clean and passed all 1104 tests. A purchase that buys extra
 *          Sim sessions per day — training pace — with every guard in this file
 *          green. That is GDD §12.3's first refusal condition.
 *
 *          `FACT_PROTECTION` is the fix, and it is `PROPOSAL_ORIGIN_BY_KIND`'s
 *          mechanism one operand over: an exhaustive `Readonly<Record<
 *          ProgressionFactKey, 'protected' | 'open'>>`, so a new fact cannot be
 *          added without answering the §8.1 question out loud, with
 *          `PROTECTED_CONCERNS` DERIVED from it rather than listed beside it.
 *          There is no default any more. `PROTECTED_CONCERNS_ARE_NOT_VACUOUS` is
 *          the non-vacuity half, which this operand had never had.
 *
 *          AND ANSWERING `'open'` IS NOT FREE, or the map would only move the
 *          escape one line — the author of a purchasable pace fact would just
 *          declare it open. Two cross-checks price that answer, in the same
 *          shape as `MONEY_ON_THE_WIRE_IS_DECLARED_A_PURCHASE`. They PRICE it
 *          rather than forbid it, and §6 states the route that still gets
 *          through and what fails on it:
 *
 *            · `OPEN_FACTS_ARE_EXACTLY_WHAT_A_PURCHASE_MAY_REACH` binds the open
 *              set to `EntitlementReach`, both directions. Declaring a fact open
 *              without also writing it into the purchase catalogue fails; writing
 *              it in means stating in the catalogue which purchased effect moves
 *              it, which is a confession rather than a smuggle. This one has no
 *              vocabulary in it and is the load-bearing half.
 *            · `NO_OPEN_FACT_NAMES_PERFORMANCE` reads the fact's own NAME against
 *              `PERFORMANCE_FACT_VOCABULARY`. `simSessionsPerDay` contains
 *              `session` and `perday`, so it cannot be open under that name. IT
 *              IS A FLOOR AND IT IS DIRECTIONAL — a fact named `x7` satisfies it
 *              perfectly — which is why it is second, and why
 *              `PERFORMANCE_NAMED_FACTS_ARE_NOT_VACUOUS` exists to prove the scan
 *              can still see the facts that do name performance.
 *
 *      All of these are mutation-tested in both directions — a purchasable pace
 *      fact is rejected, an ordinary cosmetic fact is accepted — and
 *      `progression.test.ts` re-checks the proposal side and the protection map
 *      at runtime, because a type-level assertion that gets deleted is invisible
 *      to `npm test`.
 *
 *      WHICH KINDS COUNT AS PURCHASES IS DERIVED, NOT LISTED. The reach check is
 *      only worth what its subject is worth, and its subject used to be a
 *      hand-written union of two kind names — correct for the kinds on it, blind
 *      to every kind added later. `PROPOSAL_ORIGIN_BY_KIND` now tags every
 *      proposal kind `'earned'` or `'purchase'` (exhaustively — a new kind
 *      cannot skip it), `PurchasableProposalKind` is computed from that map, and
 *      `MONEY_ON_THE_WIRE_IS_DECLARED_A_PURCHASE` cross-checks the tag against
 *      the report's own field names via `PURCHASE_EVIDENCE_KEYS`, so a kind
 *      whose payload carries a SKU, a receipt or a currency cannot be tagged
 *      `'earned'` to slip past. A new purchase-originated kind is checked
 *      against `PROTECTED_CONCERNS` whether or not its author read this file.
 *
 *  (c) NO EFFECT TO CLAIM. `RedeemEntitlementReport` carries a SKU and a
 *      receipt. It has no `effect` field and its key allowlist forbids one, so
 *      the client cannot tell the server what a purchase does — the server
 *      resolves the SKU against the catalogue. A client that cannot name an
 *      effect cannot name a forbidden one.
 *
 *  (d) NOTHING TO SELL. This module exports no multiplier, no bonus, no
 *      "training pace" figure and no function that takes an `Entitlement` and
 *      returns anything at all. One session per day is the loop, and there is no
 *      lever, priced or free.
 *
 *      `NOTHING_MOVES_TRAINING_PACE` USED TO BE ASSERTED HERE AND HAS BEEN
 *      REMOVED, BECAUSE IT COULD NOT FAIL. It read `AreDisjoint<ProposalReach[
 *      ProgressionProposalKind], 'trainingPace'>`. But
 *      `PROPOSAL_REACH_NAMES_REAL_FACTS` already forces every reach value to be
 *      a `ProgressionFactKey`, and `'trainingPace'` was deliberately not one —
 *      so the intersection was `never` unconditionally, for every edit short of
 *      adding a `ConfirmedFacts` field spelled exactly `trainingPace`. Its
 *      runtime twin was tautological for the same reason. `'trainingPace'` sat
 *      in `PROTECTED_CONCERNS` solely to give it an operand, and every other
 *      check then had to route around that entry: `Exclude<ProtectedConcern,
 *      'trainingPace'>` in the module, `if (concern === 'trainingPace')
 *      continue` in the test. A protected concern every guard has to skip is
 *      scaffolding, and this paragraph presented it as an enforcement.
 *
 *      WHAT REPLACES IT: `NO_FACT_MEANS_TRAINING_PACE`, up with the facts. The
 *      §8.1 promise is that pace has no lever at all, which is a statement about
 *      the FACT SET rather than about one spelling — so it is asserted over the
 *      fact set: no `ProgressionFactKey` may name pace, under any name in
 *      `PERFORMANCE_FACT_VOCABULARY.pace`. It is empty today and it fails the
 *      moment a pace fact appears, which is exactly the `simSessionsPerDay`
 *      mutant in (b) that the old assertion could not see.
 *
 *      A PACE FACT WAS NOT INVENTED TO GIVE IT SOMETHING TO GUARD. That is how
 *      the old assertion got here, and GDD §8.1 does not describe stored pace
 *      state to model — it says pace is skill- and consistency-driven. Adding a
 *      `simSessionsPerDay` field so a guard had a target would have been
 *      inventing design to satisfy a check, one level further down.
 *
 * Recovery Days are the one purchasable thing with a functional effect (GDD
 * §4.2, §8.2), and `'streak'` is deliberately NOT protected here for that
 * reason. Their fence is `streak.ts`'s own allowlist, which this file couples to
 * rather than duplicates: `STREAK_WIRE_MATCHES_THE_STREAK_ALLOWLIST` asserts the
 * wire shape is exactly `STREAK_FACT_KEYS`, so a new streak field cannot slip
 * across this boundary without failing `tsc` here as well as there.
 *
 * The Recovery Day *balance* likewise lives only in `StreakState`. There is no
 * `recoveryDays` in `ConfirmedWallet`, on purpose: two ledgers for one
 * consumable is two truths, and the one in `streak.ts` is the one with the
 * guardrails on it.
 *
 * ===========================================================================
 * 6. WHAT THIS DOES NOT CLOSE — stated plainly, because a comment that
 *    overstates its guarantees is worse than no comment
 * ===========================================================================
 *
 *  - A CAST DEFEATS ALL OF IT. `x as ConfirmedTotalKg` compiles, exactly as a
 *    cast defeats `dots.ts`'s brands and `meet.ts`'s opaque rules. None of this
 *    is tamper resistance. It closes the writes that used to typecheck and look
 *    innocent in a diff.
 *
 *  - THE MINT HAS TO EXIST. `receiveProgressionSnapshot` turns plain JSON into
 *    server truth, and nothing in a type system can check that the JSON came
 *    off the wire rather than out of a literal. What the mint buys is that the
 *    claim is now a single greppable call whose name is the assertion, instead
 *    of an assignment anywhere in the app. Fixtures in tests go through it too,
 *    which is the point: there is one door.
 *
 *  - THERE IS NO SERVER, SO NOTHING IS VERIFIED. `record-meet-result` carries
 *    the judges' lights as *evidence*. With a real Edge Function the lights
 *    should be re-resolved server-side from the input trace, and this report
 *    type will get narrower, not wider. Today it is the client's word.
 *
 *  - A `ConfirmedFacts` VALUE CAN BE ASSEMBLED BY HAND, up to a point. Its
 *    scalars are branded, so a total or an e1RM still cannot be invented, but
 *    `streak` is a plain `StreakState` and object brands do not work (§2). It
 *    goes nowhere: no exported function in this module accepts a
 *    `ConfirmedFacts`, and the only route into the cache is a
 *    `ProgressionSnapshot`. Stated because it is exactly the sort of thing that
 *    looks closed and is not — `progression.test.ts` pins the export surface so
 *    a future function that accepts one has to be added deliberately.
 *
 *  - THE REACH MAPS ARE A DECLARATION, NOT AN ENFORCEMENT. No code here can
 *    stop an Edge Function that does not exist from touching a fact it should
 *    not. Their teeth are that widening one fails the compile, so the
 *    declaration a future function is written against cannot drift quietly.
 *
 *  - THE PROJECTION GUARD (§4.1) CHECKS FIELDS, NOT NUMBERS. It stops a training
 *    session from claiming a `totalKg` at all. It cannot stop a renderer from
 *    projecting a nonsense e1RM, labelling an e1RM "Total" on screen, or adding
 *    three projected e1RMs together and printing the sum. The first is a
 *    plausibility question no type answers; the last two happen in a component
 *    this module cannot see. What it closes is the shape that used to typecheck
 *    and look innocent: a Total in the projection object of a Tuesday session.
 *
 *  - THE PAIRING IS SEALED. THE CACHE STATE AROUND IT IS NOT, AND THAT IS THREE
 *    OF FIVE CHECKS, NOT FIVE. `ProgressionCache` is a transparent union, so a
 *    caller holding a snapshot can always write `{ status: 'pending', snapshot,
 *    inFlight }` by hand. What it costs them is the `inFlight`, and the exact
 *    strength of that fence has now been overstated here twice, so it is written
 *    out in full.
 *
 *    THE VERSION OF THIS PARAGRAPH THAT SAID "IT IS CLOSED — a caller cannot name
 *    the key, so it cannot build the `inFlight`, so it cannot build the `pending`
 *    state, all five checks included" WAS FALSE, and false by the exact mechanism
 *    §2 above documents. `InFlightProposal` was `{ proposalId; proposal;
 *    projection; [PAIRING_CHECKED]: true }` — a PARTLY TRANSPARENT object with a
 *    symbol bolted on, which is the shape §2 says does not work, not the
 *    `ProgressionSnapshot` shape it claimed to copy. And a caller did not have to
 *    build one from nothing, because `inFlightProposal()` handed one out:
 *
 *        const real = inFlightProposal(pending)!;
 *        const forged: ProgressionCache = {
 *          status: 'pending',
 *          snapshot,
 *          inFlight: { ...real, projection: { ...emptyProjection(),
 *                                             totalKg: projectedKg(645) } },
 *        };
 *        readTotalKg(forged);   // { kind: 'projected', value: 645 }
 *
 *    No cast, no `as`, no `any`; `tsc --noEmit` clean. A PROJECTED TOTAL OF 645 ON
 *    A `record-training-session` — the one shape GDD §3.2 forbids and the whole
 *    §4.1 apparatus exists to make a compile error. The brand had narrowed the
 *    escape from "any caller" to "any caller who has ever called `proposeChange`",
 *    which is every consumer of this module, and this paragraph called that
 *    closed.
 *
 *    WHAT IT IS NOW, IN TWO PARTS.
 *
 *    (i) The checked triple lives UNDER the symbol: `InFlightProposal` has
 *    exactly one property, `[PAIRING_CHECKED]: CheckedPairing`, pinned by
 *    `AN_IN_FLIGHT_PROPOSAL_HAS_NO_STRING_KEY`. There is no string-keyed field
 *    left for a spread to overwrite.
 *
 *    (ii) `inFlightProposal()` no longer hands out the branded object. It
 *    returns an `InFlightProposalView` — a plain `{ proposalId, proposal,
 *    projection }` read model, built fresh per call, carrying no symbol. A
 *    screen reads out everything it needs; nothing can be handed back in.
 *
 *    So the exploit as written no longer even reaches the spread: `real` is a
 *    view, and a view is not assignable to `inFlight`. Taking the other route —
 *    narrowing the union to get a genuine `InFlightProposal` and spreading THAT
 *    in a fresh literal — is `TS2353` on the `projection:` line, because there is
 *    no such property to specify.
 *
 *    AND THE CLAIM STOPS THERE, because "cannot be built" would be the same
 *    overclaim a third time. Spread copies symbols, so with `real` obtained by
 *    narrowing:
 *
 *        const loose = { ...real, projection: aTotalItMayNotClaim };
 *        const forged: ProgressionCache = { status: 'pending', snapshot, inFlight: loose };
 *
 *    still compiles — assigning through a variable defeats excess-property
 *    checking, and always will. It is INERT: every reader goes through
 *    `pairing()`, so the added field is never looked at, and `readTotalKg(forged)`
 *    returns the CONFIRMED 630 rather than the planted 645. Run, not reasoned
 *    about, and pinned by a RUNTIME test rather than a `@ts-expect-error`, so
 *    reopening the hole fails `npm test` and not only `npm run typecheck`. That
 *    inertness is what §2 actually promises about the snapshot idiom — not
 *    "cannot be built", but "cannot be built into anything a reader sees" — and it
 *    is the promise made here.
 *
 *    STILL OPEN: A CHECKED PAIRING CAN BE REUSED. The union is transparent, so
 *    `if (cache.status === 'pending')` still yields a real `InFlightProposal`, and
 *    it can be re-attached to a different snapshot or to a cache that was stale.
 *    That gets past the two checks that are properties of the CACHE — the
 *    in-flight limit and the stale-cache rule. Verified by execution:
 *    `proposeChange` on a stale cache returns `CACHE_IS_STALE`, and the
 *    hand-assembled reuse renders the projection anyway.
 *
 *    It does NOT get past the three that are properties of the PAIRING —
 *    `validateProposal`, `validateProjection` and `projectionExceedsReach` —
 *    because the triple is welded under one symbol and taking it apart needs a
 *    cast. So a reused pairing always carries a proposal and a projection that
 *    passed the reach check together: a training session still cannot show a
 *    Total. Three of five is the true number, and the three that hold are the
 *    three GDD §3.2 turns on.
 *
 *    Closing the other two means making `ProgressionCache` itself opaque, which
 *    costs every reader its `switch (cache.status)` and every renderer its
 *    ability to pattern-match the state it is drawing. That is a real trade and
 *    it is not made here — stated, rather than rounded up to a guarantee.
 *
 *    (An earlier paragraph here also gave a FALSE REASON for leaving the whole
 *    thing open: that closing it "would mean making `ProgressionCache` generic in
 *    a proposal kind, and every reader generic with it". It did not; no generics
 *    were needed anywhere and `readTotalKg` and friends are untouched.)
 *
 *  - A PURCHASE CAN STILL BE MISLABELLED, IN TWO SHAPES, AND THE SECOND ONE IS
 *    NOT THE ONE PEOPLE EXPECT. `PROPOSAL_ORIGIN_BY_KIND` forces every kind to
 *    declare a provenance, and the payload cross-check catches the obvious lie —
 *    a report with a `sku`, a `receipt` or a `currency` on it cannot be called
 *    `'earned'`. Two shapes get past it:
 *
 *      1. NO MONEY UNDER ANY NAME. A purchase-originated kind whose report names
 *         none of the evidence keys —
 *         `{ kind: 'redeem-promo-code'; report: { code: string } }` tagged
 *         `'earned'` — escapes, because "money caused this" is a fact about the
 *         world and the only evidence in scope is the payload's field names.
 *         Widening `PURCHASE_EVIDENCE_KEYS` is how that net gets tighter.
 *
 *      2. MONEY ONE LEVEL DOWN. `MoneyCarryingProposalKind` reads
 *         `keyof ReportFor<K>`, and `keyof` IS TOP LEVEL ONLY. A store envelope
 *         shaped `{ transaction: { productId: string; receipt: string } }`
 *         carries a receipt the check cannot see, and so would a `sku` added to
 *         an element of `sets` on an existing earned report. The check reads the
 *         outermost object and stops. It is not made recursive here because a
 *         recursive `keyof` over report types that contain arrays and branded
 *         strings costs more legibility than the case has so far been worth —
 *         but that is a judgement, not a guarantee, and the residual is real.
 *         `progression.test.ts` covers the reports that exist TODAY at runtime:
 *         it walks every exported `*_REPORT_KEYS` allowlist, nested ones
 *         included, and fails if an earned report names an evidence key. A new
 *         nesting still has to be wired into that walk.
 *
 *    Both residuals are one deliberate shape in a diff whose surrounding comment
 *    says not to, rather than the previous residual, which was any addition at
 *    all, silently.
 *
 *  - A FACT CAN STILL BE DECLARED `'open'` IF IT IS ALSO RENAMED PAST THE
 *    VOCABULARY, and this is the pay-to-win residual that survives §5(b).
 *    `FACT_PROTECTION` removes the silent default and the two cross-checks price
 *    the `'open'` answer, but they do not make it impossible. Four coordinated
 *    edits get through: a fact named so as not to say what it is
 *    (`simRunsAllowed`, not `simSessionsPerDay`), declared `'open'`, named on a
 *    purchase's row in `ProposalReach`, and written into
 *    `EntitlementReach.convenience` so the two purchase maps still agree.
 *    `NO_OPEN_FACT_NAMES_PERFORMANCE` and `NO_FACT_MEANS_TRAINING_PACE` read
 *    names and a bland name defeats both; `OPEN_FACTS_ARE_EXACTLY_WHAT_A_
 *    PURCHASE_MAY_REACH` is satisfied by the fourth edit. THIS WAS RUN, not
 *    reasoned about: it compiles clean.
 *
 *    What fails on it is `progression.test.ts`'s pinned open set, which asserts
 *    `OPEN_FACTS` is exactly `['streak', 'wallet']`. That is a test expectation
 *    rather than a type-level assertion on purpose: the same claim in the type
 *    system would also refuse a legitimately open fact — GDD §8.3A's cosmetics
 *    business will plausibly want one — and a guard that refuses the product is
 *    satisfied best by a worse artifact.
 *
 *    So the honest statement of the line is: a purchase reaching a protected
 *    fact is a compile error; a purchase reaching a NEW fact is a failing test
 *    with a paragraph attached. Not the same strength, and worth saying so
 *    rather than rounding the second up to the first.
 *
 *  - THE VOCABULARY IS A JUDGEMENT. `PERFORMANCE_FACT_VOCABULARY` is a list
 *    someone wrote, and both scans built on it inherit that. It is a floor under
 *    the honest mistake — a fact named for what it does — not a net under a
 *    determined one, and `PERFORMANCE_NAMED_FACTS_ARE_NOT_VACUOUS` only proves
 *    the scan still sees SOME fact, not that it sees the right ones.
 *
 *  - THIS MODULE CONSTRAINS ITSELF. It cannot stop a consumer reading a
 *    confirmed e1RM and multiplying it by a cosmetic's price. That would be the
 *    consumer's violation and no type here can see it.
 *
 * ===========================================================================
 * 7. THE UNIT SWEEP — EVERY NUMBER THAT REACHES A PERMANENT FACT, FROM ANY
 *    MODE, AND WHAT PROVES ITS UNIT
 * ===========================================================================
 *
 * WHY THIS IS HERE AND NOT IN A SERVER MODULE. `meetServer.ts` has carried a
 * table like this for two rounds and it was honestly scoped: "no number reaches
 * permanent progression ON THIS PATH with an unproven unit". THE SCOPING IS WHAT
 * LET THE FOURTH FIELD SURVIVE. `TrainingSetReport.weightKg` was thirty lines
 * above `MeetAttemptReport` in THIS file, on the other mode's path, and every
 * sweep for three rounds ran down the meet pipeline and stopped.
 *
 * So the sweep lives with `ConfirmedFacts`, which is the thing being protected,
 * and it is over the FACT SET rather than over a path. `progression.test.ts`
 * fails if a `ProgressionFactKey`, a `ConfirmedMeetResultKey`, a `StreakFactKey`
 * or a `WalletCurrency` is not named below, so the table cannot go stale by
 * something new being added beside it.
 *
 * AND THAT WAS STILL NOT ENOUGH, WHICH IS THE POINT OF THIS PARAGRAPH. Sweeping
 * the fact set closed the fourth FIELD and left a fifth ROUTE into a field the
 * table already listed as proven: `newServerRecord()` seeds `bestE1rmKg` from an
 * in-tree constant, on every account, and no report is involved, so
 * `readKilogramSets` never saw it. The old 7.1 entry named the seed and then
 * ranked it as "a different class ... named here rather than fenced", which is
 * what a sweep organised by field rather than by ROUTE produces: the field was
 * checked, so the field looked done.
 *
 * The sweep is therefore over both. For every mass fact: which routes write it,
 * and what proves the unit on each. 7.4 states the resulting claim in a form
 * that can be falsified, and names what would falsify it.
 *
 * AND THE ROUTE HALF IS NOW DERIVED RATHER THAN COUNTED, which is 7.5. The fact
 * half has been mechanical for several rounds; the route half was a hand-written
 * list, and a hand-written list of routes is the thing this section has got
 * wrong in every round it has existed. 7.5 is a table the suite reconstructs
 * from the type checker and compares both ways.
 *
 * ---------------------------------------------------------------------------
 * 7.1 MASSES — the only fields where "unit" means kilograms or pounds
 * ---------------------------------------------------------------------------
 *
 *   `totalKg` (protected, monotone, meet only)
 *       PROVEN. `readTotal(replayed).unit === 'kg'`, where `replayed` is a card
 *       whose DECLARED unit was checked against `meet.rules.unit`
 *       (`replayMeetCard`) for a `meet` whose id was checked against the
 *       report's (`MEET_ID_MISMATCH`). Strongest chain in the tree: the
 *       comparison is against server-owned data, not a constant.
 *
 *   `bestE1rmKg[squat|bench|deadlift]` (protected, monotone, training only)
 *       TWO ROUTES IN, AND BOTH ARE NOW PROVEN. This field is the only one in
 *       the table a number can reach without riding a report, which is how the
 *       second route survived a round after the first was closed.
 *
 *       ROUTE 1 — A SESSION IS RECORDED. Proven, and weaker than the total's.
 *       `sessionServer.ts` `readKilogramSets` refuses a `TrainingCardReport`
 *       whose declared unit is not `'kg'`, before `bestE1rmFromSets` and before
 *       the streak. The comparison is against a CONSTANT
 *       (`PROGRESSION_E1RM_UNIT`), because a session has no server-owned
 *       definition to check against — it is authored by the client, not drawn
 *       from a catalogue. So the question asked is "did you say kg?", not "does
 *       what you say match what this is".
 *
 *       ROUTE 2 — THE ACCOUNT IS CREATED. `newServerRecord()` seeds all three,
 *       on every account, and the seed is a permanent FLOOR rather than a
 *       starting guess, because `nextBestE1rm` is monotone: no honest session
 *       lowers it, so it never stops deriving. Proven as of this round, and by a
 *       STRONGER check than route 1's, for a reason worth stating rather than
 *       glossing. The seed is `SESSION_TUNING.STARTING_E1RM`, a
 *       `StartingE1rmSeed` — the fourth tagged pair on this boundary, arms
 *       `kilograms` / `pounds` — and because it is a LITERAL IN THIS BUILD
 *       rather than JSON from a client, "is this the kilogram arm?" can be asked
 *       by `tsc` and is: `PROVEN_STARTING_E1RM` in `sessionServer.ts`. A seed
 *       declared in any other unit does not reach a runtime refusal; it fails to
 *       build, at every read site. `A_STARTING_E1RM_CAN_DECLARE_A_UNIT_THIS_
 *       RECORD_REFUSES` is the non-vacuity control, so deleting the `'lb'` arm
 *       does not quietly make the narrow trivial.
 *
 *       WHAT NEITHER ROUTE PROVES is the magnitudes — see 7.3(b), which now
 *       covers both.
 *
 *       AND IT CROSSES INTO THE OTHER MODE. `meetServer.ts`'s `meetDayFacts` is
 *       the one function that carries a training number into meet day, and its
 *       fallback parameter is now `KilogramStartingE1rm` — the narrowed arm — so
 *       the caller has to have narrowed before it can call, and no runtime
 *       refusal path is needed on a function a lifter's meet depends on.
 *
 *   `meets[n].totalKg`, `meets[n].bestByLift[lift]` (protected)
 *       PROVEN, same chain as `totalKg`: both are read off the replayed
 *       `MeetState` built from the checked card.
 *
 *   `meets[n].bodyweightKg` (protected)
 *       PROVEN. A `BodyweightReading` declared at the source
 *       (`MeetEntry.bodyweight`) and forwarded rather than stamped; tag AND
 *       payload checked in `meetServer.ts` (`UNSUPPORTED_MEET_UNIT`,
 *       `MALFORMED_READING`). `MeetDayContext.entry` is a `KilogramMeetEntry`,
 *       so a pound-weighed lifter does not compile into a meet at all.
 *
 * ---------------------------------------------------------------------------
 * 7.2 NOT MASSES — and stated rather than skipped, because "it is not a weight"
 *     is exactly the reasoning that left `weightKg` alone for three rounds
 * ---------------------------------------------------------------------------
 *
 *   `meets[n].meetDayIndex`, `streak.lastTrainedDay`
 *       DAY INDICES. The unit is "civil days since an epoch the server owns"
 *       (GDD §4.1), and it is proven by construction: `asStreakDay` is the one
 *       mint, `decodeStreak` refuses a non-integer, and the day is resolved by
 *       the server rather than taken off the device — `deviceWallClock` is
 *       documented a HINT and is not read by `applyTrainingSession`.
 *
 *   `streak.currentStreak`, `streak.longestStreak`,
 *   `streak.recoveryDayBalance`, `streak.armedRecoveryDays`
 *       COUNTS. Unit is "one day" / "one Recovery Day"; `isCount` proves
 *       whole-and-non-negative and `streak.ts` owns the invariants between them.
 *       Nothing here is a mass.
 *
 *   `streak.recoveryDayProtectionEnabled`,
 *   `streak.hasBankedFirstRecoveryDaySave`
 *       BOOLEANS. No unit to prove; `decodeStreak` checks the type.
 *
 *   `wallet.gymBucks`, `wallet.chalk`
 *       COUNTS, and the unit is THE KEY: `WALLET_CURRENCIES` is the closed list,
 *       `ConfirmedWallet` is `Record<WalletCurrency, ConfirmedCount>`, so a
 *       balance cannot exist without naming which currency it is in. This is the
 *       tagged-pair property already, arrived at from the other direction.
 *
 *   `meets[n].meetId`, `revision`, `acknowledgedProposalId`
 *       IDENTIFIERS AND A COUNTER. Not quantities.
 *
 * ---------------------------------------------------------------------------
 * 7.3 WHAT IS STILL UNPROVEN, AND HOW REACHABLE IT IS
 * ---------------------------------------------------------------------------
 *
 *   (a) THE `meet` ARGUMENT TO `applyMeetResult` IS SUPPLIED BY THE CALLER. The
 *       id check makes it CLAIM to be the reported meet; nothing makes it BE
 *       one, because that function has no catalogue to look one up in. Closes
 *       when the Edge Function resolves `meetId` against its own table. The
 *       single highest-value thing left on the meet path.
 *
 *   (b) A DECLARED UNIT CAN BE A LIE SOMEBODY TYPED, AND THAT IS NOW THE WHOLE
 *       OF WHAT IS LEFT ON THE UNIT QUESTION. `{ unit: 'kg', kilograms: 203.7 }`
 *       over a pound scale, `{ unit: 'kg', kilogramSets: [...] }` over a pound
 *       bar, `{ unit: 'kg', kilograms: { squat: 397, … } }` over a pound seed.
 *       Every check on this boundary is about a field that MEANS something
 *       rather than one that means nothing; none of it is tamper resistance, and
 *       there is no server to re-derive against.
 *
 *       THE SEED'S VERSION OF THIS IS DIFFERENT IN REACH AND THE SAME IN KIND,
 *       and the difference is worth having on the page. The three sent readings
 *       can be lied to by any client that can post JSON. The seed can only be
 *       lied to by an edit to this repository, which means it arrives through a
 *       diff and a review rather than over a network. That makes it far less
 *       REACHABLE and no better PROVEN — and the reachable half is exactly the
 *       edit GDD §11 is currently asking a human to make, so "it needs a commit"
 *       is not much comfort.
 *       WHAT IT IS NOT is caught by the test suite. Retuning the seed magnitudes
 *       does turn several `sessionServer.test.ts` assertions red — but they pin
 *       the arithmetic 180/120/220 produce and go red for a legitimate retune
 *       too, and not one of them mentions a unit. A change detector is not a
 *       unit check and is not counted as one here.
 *       No plausibility band was invented to close it. A bound on "how strong
 *       may a new lifter be" is a game-feel guess, and GDD §11 already records
 *       what a guessed constant standing in for a check bought last time
 *       (`HUMAN_INPUT_BUDGET_MS` propping up a session-length floor).
 *
 *   (c) `ServerRecord` IS A PLAIN INTERFACE AND CAN BE BUILT BY HAND, AND
 *       **THREE** PLACES DO IT OUTSIDE THE TWO SERVER FUNCTIONS.
 *
 *       THIS ENTRY SAID "THE TWO PLACES THAT DO IT" FOR A ROUND, AND THERE WERE
 *       THREE. The missing one — `sessionPreview.ts`'s `recordBeforeSession()` —
 *       sat in the same file as one that WAS named, twelve lines from the import
 *       that gave it `ServerRecord`. A hand-maintained count is what produced
 *       that, so the count is no longer hand-maintained: 7.5 is the table, and
 *       `progression.test.ts` derives the real set from the SYNTAX TREE and fails
 *       if the two disagree in either direction.
 *
 *       THE EXEMPTION IS STATED PER SITE, because it is not the same reason for
 *       all three and the single sentence that used to cover them — "both exist
 *       BECAUSE the server functions cannot produce what they photograph" — is
 *       FALSE of the third. That sentence reading as though it covered a site it
 *       did not is exactly how the site stayed unnamed, so the weakest of the
 *       three is spelled out rather than folded in.
 *
 *       (i) `meetPreview.ts` `previewServerRecord()` — spreads
 *           `newServerRecord()` and writes `totalKg` plus a COMPLETE,
 *           HAND-BUILT `MeetResultWire` into `meets[]`. That is not one field
 *           slipping past one check: it is all four of the meet path's checks at
 *           once — `MEET_ID_MISMATCH`, `replayMeetCard`'s `card.unit ===
 *           meet.rules.unit`, the bodyweight's tag and the bodyweight's payload
 *           — because it never calls `applyMeetResult` at all. Every number in
 *           it comes from `MEET_PREVIEW` and `MEET_ENTRY`.
 *           EXEMPT BECAUSE THE SERVER FUNCTION CANNOT PRODUCE IT: the fixture
 *           needs a prior meet under a DIFFERENT id, which `applyMeetResult`
 *           would need a whole second scripted meet to mint.
 *
 *       (ii) `sessionPreview.ts` `cacheAfterServer()` — writes `best +
 *            SESSION_BOUNDARY_PREVIEW.SERVER_DRIFT_KG` into `bestE1rmKg`, added
 *            to the e1RM `applyTrainingSession` actually computed, so the
 *            `close-out-server-wins` beat has a server answer the client did not
 *            predict.
 *            EXEMPT BECAUSE THE SERVER FUNCTION CANNOT PRODUCE IT: the beat IS
 *            an answer that disagrees with the client, and a correct server
 *            running the same monotone `nextBestE1rm` cannot send one.
 *
 *       (iii) `sessionPreview.ts` `recordBeforeSession()` — the one this entry
 *             missed. It writes `SESSION_PREVIEW.BEST_E1RM_KG` (a bare `200`
 *             with its unit in the identifier) into `bestE1rmKg`, and
 *             `SESSION_PREVIEW.STREAK_BEFORE` into the streak. The e1RM goes
 *             `snapshotWireFor` → `receiveSnapshot` → `ConfirmedFacts.bestE1rmKg`
 *             — a `ConfirmedKg` on the `'protected'` row, the same field, brand
 *             and protection as the seed and the card.
 *             ITS EXEMPTION IS WEAKER AND IS NOT THE SENTENCE ABOVE, which is
 *             the point of writing it out. `applyTrainingSession` CAN produce a
 *             record with `bestE1rmKg` at 200 and an eleven-day streak; that is
 *             its job. What it cannot do is produce one CHEAPLY or STABLY: it
 *             would take eleven scripted days to build, it would not land on a
 *             round number, and the figure the screenshot then shows would move
 *             with every retune of the loading ladder or the per-session gain
 *             cap. A photographed beat exists to be COMPARED ACROSS BUILDS, so
 *             a pinned number is the feature. That is a fixture argument, not a
 *             "the server cannot do this" argument, and it is deliberately not
 *             dressed up as one.
 *
 *       WHY NONE OF THE THREE IS FENCED, decided rather than defaulted. All are
 *       DEBUG ONLY, and that is checkable rather than asserted: `App.tsx`
 *       returns `null` for `search` when there is no `window`, so on a device
 *       the branch is dead; `shellRoute.ts` says `entryRoute` is the only
 *       reader, it runs once at launch, and no `ShellIntent` produces a `debug`
 *       route, so on web it needs a hand-typed query string; and nothing
 *       persists — `useMeetDay.ts` holds the stand-in record in a ref that dies
 *       with the tab, and a session preview's cache is rebuilt from scratch on
 *       every call. Fencing them would delete the three fixtures that
 *       demonstrate this boundary working, to guard a path no player reaches.
 *       So: named accurately, not fenced.
 *
 *       What would change that, for any of the three: becoming reachable from a
 *       `ShellIntent`, or anything persisting a record built this way. For (iii)
 *       specifically there is a fourth trigger — if `SESSION_PREVIEW`'s
 *       magnitudes ever stop being debug-only and seed a real account, it is the
 *       seed's problem and takes the seed's answer (a `StartingE1rmSeed`).
 *
 *   (d) `MeetDefinition.ghostTotalsKg` IS A BARE `number[]`. It reaches no
 *       stored field (`MeetResultWire` has no placing) but it is what a proven
 *       kilogram total is RANKED against, so pound ghosts print a wrong placing.
 *       Placeholder data a backend replaces wholesale (GDD §6.6).
 *
 *   (e) THE HIDDEN FATIGUE LEDGER carries no mass at all, by design rather than
 *       by luck: `fatigueRecordFor` builds a `SessionRecord` from RPE, set count
 *       and rep count and has NO weight field, and `fatigue.ts`'s comment says
 *       why (strain is a function of RPE, sets and reps). It is also not a
 *       `ConfirmedFacts` member and has no `ProgressionSnapshotWire` field. So
 *       there is nothing here to prove — which is worth writing down, because
 *       "nothing to prove" and "nobody looked" read the same in a diff.
 *
 *   (f) THE SEED'S UNIT IS NO LONGER ON THIS LIST, and what replaced it is
 *       smaller. This entry used to read "`SESSION_TUNING.STARTING_E1RM_KG`, per
 *       7.1 — in-tree server-side placeholder", ranked as a lesser class than
 *       the four fields the boundary had fixed. That ranking was wrong twice
 *       over: the number reaches the SAME field with the SAME brand and the SAME
 *       protection as the one `readKilogramSets` was built to fence, and being
 *       server-authored placeholder data is not a distinguishing property —
 *       `MeetEntry.bodyweight` is in-tree placeholder data too and was given a
 *       unit tag anyway, "so the refusal has a fact to check rather than a
 *       literal" (GDD §11). The same argument had already been made and rejected
 *       here once.
 *       The seed is now `StartingE1rmSeed` and its declared unit is proven at
 *       COMPILE time (7.1, route 2). What remains is its magnitudes, which is
 *       (b) and is filed there.
 *
 * ---------------------------------------------------------------------------
 * 7.4 SO WHAT IS LEFT ON THE UNIT QUESTION, STATED AS A CLAIM THAT CAN BE
 *     FALSIFIED
 * ---------------------------------------------------------------------------
 *
 * THE CLAIM: every number that reaches a `ConfirmedFacts` mass field — the
 * total, the three per-lift e1RMs, each stored meet's total, per-lift bests and
 * bodyweight — arrives past a check on a UNIT FIELD it carries, by every route
 * that exists in non-test code. SIX routes, all named above and all enumerated
 * mechanically in 7.5: a meet card, a bodyweight reading, a training card, the
 * account seed, and the THREE preview builders in (c) which reach no stored
 * field. This said "Five routes ... the two preview builders" for a round, and
 * the count was wrong because it was written by hand.
 *
 * WHAT WOULD FALSIFY IT, concretely, so this is not a claim that survives by
 * being unfalsifiable:
 *
 *   - A SEVENTH ROUTE. Another construction site of `ServerRecord`, or a new
 *     writer of `bestE1rmKg` / `totalKg` that is neither a server function nor a
 *     preview. THIS ENTRY USED TO END "`progression.test.ts` cannot see this
 *     one; a grep can, and that is what has found it both times so far" — and
 *     by the time it was read again a grep had found it five times out of six.
 *     It can see it now: 7.5 is a table, the suite derives the same set from the
 *     TYPE CHECKER, and a construction site added anywhere under `src/` without
 *     a row here fails. The residual is named in 7.5 rather than here.
 *   - A NEW MASS FACT. `progression.test.ts` fails if a `ProgressionFactKey`,
 *     `ConfirmedMeetResultKey`, `StreakFactKey` or `WalletCurrency` is not named
 *     in 7.1 or 7.2, so a fact added beside these cannot go unlisted — but the
 *     test cannot tell whether the paragraph written for it is TRUE.
 *   - A MAGNITUDE THAT DOES NOT MATCH ITS TAG. Not falsification of the claim —
 *     the claim is about units being CHECKED, not about numbers being HONEST —
 *     but it is the failure a reader is most likely to think this covers, and it
 *     is (b), open, on all four readings.
 *
 * "Nothing is left" is NOT the claim. The claim is that every route now asks the
 * question; (a) and (b) are what asking it does not buy.
 *
 * ---------------------------------------------------------------------------
 * 7.5 THE ROUTE TABLE — DERIVED, NOT COUNTED
 * ---------------------------------------------------------------------------
 *
 * WHY THIS EXISTS. Six rounds of this section ended with a human finding one
 * more route, and five of the six were found by a GREP. The tests above are over
 * the FACT SET, so they fail when a fact goes unlisted and are blind to a new
 * construction site. That blindness is what the sweep note in `7.4` used to
 * admit and then leave standing.
 *
 * `progression.test.ts` now builds a `ts.Program` over every `.ts`/`.tsx` file
 * under `src/` and asks the TYPE CHECKER, not a regular expression, for every
 * object literal that is a `ServerRecord` or a `ProgressionSnapshotWire` — by
 * contextual type (an annotation, a `satisfies`, a cast, an argument position,
 * an array element) OR by being structurally assignable to one (a literal in a
 * function whose return type is inferred, which no annotation-scan can see). It
 * compares that set, two ways, against the rows below. A construction site
 * added without a row fails; a row whose site is deleted fails.
 *
 * COMMENTS CANNOT INFLATE IT, which is the property the `[SNAPSHOT_CONTENTS]:`
 * count in that file spells out and got wrong once: the found side comes from a
 * parsed syntax tree, in which comments do not exist at all, and the declared
 * side is THIS COMMENT. The two sides are made of different material, so a
 * sentence about a route cannot stand in for one and — the direction that
 * matters — deleting a route cannot be masked by adding prose about it.
 *
 * `n` IS AN OCCURRENCE COUNT, not a flag, for the reason `REVIEWABLE_CITATIONS`
 * carries one: a row names a FUNCTION, and a second literal added inside a
 * function that already has a row would otherwise be invisible.
 *
 *   | kind    | file                          | site                 | n |
 *   |---------|-------------------------------|----------------------|---|
 *   | record  | src/game/sessionServer.ts     | newServerRecord      | 1 |
 *   | record  | src/game/sessionServer.ts     | applyTrainingSession | 1 |
 *   | record  | src/game/meetServer.ts        | applyMeetResult      | 1 |
 *   | record  | src/game/meetPreview.ts       | previewServerRecord  | 1 |
 *   | record  | src/session/sessionPreview.ts | recordBeforeSession  | 1 |
 *   | record  | src/session/sessionPreview.ts | cacheAfterServer     | 1 |
 *   | wire    | src/game/sessionServer.ts     | snapshotWireFor      | 1 |
 *   | receive | src/game/sessionClient.ts     | receiveSnapshot      | 1 |
 *   | receive | src/meet/useMeetDay.ts        | useMeetDay           | 2 |
 *
 * WHAT EACH KIND IS. `record` is a hand-built `ServerRecord` — the first three
 * are the server functions of 7.1, the last three are the debug previews of
 * 7.3(c). `wire` is the response body: ONE producer, so `bestE1rmKg` and
 * `totalKg` leave the server through a single function. `receive` is the client
 * door, `receiveProgressionSnapshot`, whose callers are pinned because it is the
 * only mint of a `ProgressionSnapshot` and a fourth caller would be a fourth
 * place local state can be replaced by something claiming to be truth.
 *
 * TEST FILES ARE OUT, DELIBERATELY, and the exclusion is worth the sentence.
 * `meetServer.test.ts` and `sessionClient.test.ts` build a dozen records between
 * them and every new fixture adds another; pinning those would make this table
 * churn on work that has nothing to do with it, and a table that goes red every
 * week is a table people fix by editing the number. The scan still FINDS them —
 * `progression.test.ts` asserts it finds several, so the exclusion is a ruling
 * on a set that exists rather than a filter that quietly matches nothing — and
 * a test fixture reaches no player, persists nothing, and is read by the same
 * reviewer as the assertion beside it.
 *
 * WHAT STILL SLIPS, stated rather than left to be found for a seventh time. A
 * record assembled WITHOUT AN OBJECT LITERAL — `Object.assign({}, rec, { … })`,
 * `structuredClone`, a reflective helper returning `unknown` — has no node for
 * the checker to type, so the scan cannot see it. That is closed by a second,
 * cruder test rather than argued away: no shipped module that can reach
 * `ServerRecord` may contain `Object.assign(`, `structuredClone(` or
 * `as unknown as`, and today none does. A file that imports nothing from this
 * boundary cannot obtain a record to clone, so the two together are the whole
 * surface — but that last step is an ARGUMENT, not a check, and it is the one
 * place a seventh route could still enter without a test noticing.
 */

import type { BodyweightReading, OfficialTotalKg } from './dots';
import type { LiftKind } from './meet';
import { LIFT_ORDER } from './meet';
import type { LocalWallClock, StreakDay, StreakFactKey, StreakState } from './streak';
import { asStreakDay } from './streak';

// ---------------------------------------------------------------------------
// Policy constants. Every knob this module has, in one block, per CLAUDE.md
// "Game Feel Values Must Be Tunable". None of these are feel values — there is
// no animation here — but they are the numbers a human would reach for when the
// sync behaviour is wrong, and they must not be buried in the transitions.
// ---------------------------------------------------------------------------

export const PROGRESSION_CACHE_POLICY = {
  /**
   * How many proposals may be in flight at once. One keeps the state machine
   * honest: a second optimistic projection layered on an unconfirmed first is a
   * local fiction two deep, and unwinding it when the first is rejected is
   * where sync bugs live. Raising this means `pending` has to hold a queue.
   */
  MAX_IN_FLIGHT_PROPOSALS: 1,
  /**
   * Whether a change may be proposed while the cache is `stale`. False: a
   * projection computed against truth we already believe is out of date is
   * worse than a spinner. Flip it if playtesting shows the offline path needs
   * it — the transition is written to read this, not to hard-code it.
   */
  ACCEPT_PROPOSALS_WHILE_STALE: false,
  /**
   * Whether a snapshot carrying the revision we already hold is accepted as a
   * refresh. True: a re-fetch that lands unchanged is normal, and treating it
   * as an error would make retries noisy. A LOWER revision is always refused.
   */
  ACCEPT_REPEATED_REVISION: true,
  /** The revision a freshly created account starts at. */
  FIRST_REVISION: 0,
} as const;

// ---------------------------------------------------------------------------
// Type-level helpers. These carry the boundary; they emit no code.
// ---------------------------------------------------------------------------

/**
 * `true` when `keyof T` is EXACTLY `Keys` — neither a field missing from the
 * allowlist nor a stale allowlist entry. Tuple-wrapped so the unions do not
 * distribute. Same shape as `streak.ts`'s, deliberately: this file adds a
 * fourth idiom to the codebase only where it has to, and key-exactness already
 * has one.
 */
type KeysAreExactly<T, Keys extends string> = [Exclude<keyof T, Keys>] extends [never]
  ? [Exclude<Keys, keyof T>] extends [never]
    ? true
    : never
  : never;

/** `true` when the two unions are the same set. */
type UnionIsExactly<A, B> = [Exclude<A, B>] extends [never]
  ? [Exclude<B, A>] extends [never]
    ? true
    : never
  : never;

/**
 * Every key of every member of a union.
 *
 * `keyof` a union is the INTERSECTION of its members' keys, which for a
 * discriminated union is usually just the discriminant — so `KeysAreExactly`
 * applied to one checks almost nothing. This distributes, so an allowlist
 * asserted against it covers both arms.
 */
type EveryArmKey<T> = T extends unknown ? keyof T : never;

/** The fields of one arm of a `unit`-tagged reading, other than the tag. */
type ArmPayloadKeys<T, U extends string> = Exclude<keyof Extract<T, { readonly unit: U }>, 'unit'>;

/**
 * `true` when a `unit`-tagged reading's arms can be told apart BY FIELD NAME, so
 * that its numbers are unreachable without a narrow on the unit.
 *
 * Written out rather than composed from `AreDisjoint` and `IsNonEmptyUnion`
 * because those return `true | never` and `never extends true` is TRUE — a
 * composition over them would pass exactly when its operands failed. The
 * operands are combined here instead of the results.
 *
 * Three claims, in order: the two arms share no payload field; the kilogram arm
 * has one; the pound arm has one. The last two are the non-vacuity half — an arm
 * emptied to `{ unit: 'lb' }` is disjoint from everything and proves nothing.
 */
type ArmsAreTellableApart<T> = [Extract<ArmPayloadKeys<T, 'kg'>, ArmPayloadKeys<T, 'lb'>>] extends [never]
  ? [ArmPayloadKeys<T, 'kg'>] extends [never]
    ? never
    : [ArmPayloadKeys<T, 'lb'>] extends [never]
      ? never
      : true
  : never;

/**
 * `true` unless `T` is `any`.
 *
 * The `0 extends 1 & T` idiom, which is the only way to ask the question: `1 &
 * any` collapses to `any`, and `0 extends any` is true, while `1 & X` for every
 * other `X` is either `1` or `never` and `0` extends neither. Every other check
 * in this file is defeated by an `any` rather than failing on one, so the one
 * place `any` can enter — a `TypeScript` predicate that narrows to `any[]` —
 * gets its own assertion. See `declaredRows`.
 */
type IsNotAny<T> = [0] extends [1 & T] ? never : true;

/** `true` when `A` is a subset of `B`. */
type IsSubsetOf<A, B> = [Exclude<A, B>] extends [never] ? true : never;

/**
 * `true` when `A` is assignable to `B`. `IsSubsetOf` is the same question for
 * unions of string literals; this one is for object shapes, where `Exclude`
 * would answer something else entirely. Tuple-wrapped for the same reason.
 */
type IsSubtypeOf<A, B> = [A] extends [B] ? true : never;

/** `true` when the two unions share no member. Vacuously true for `never`. */
type AreDisjoint<A, B> = [Extract<A, B>] extends [never] ? true : never;

/**
 * `true` when the union has NO member.
 *
 * The opposite polarity to `IsNonEmptyUnion`, and the two are not
 * interchangeable dressing on the same idea. A non-vacuity guard exists because
 * emptiness would make some OTHER check pass over nothing; this one is itself
 * the claim, and emptiness is what it asserts. It therefore fails by gaining a
 * member rather than by losing one, which is the shape a "there is no such thing
 * in this codebase" promise actually has. `NO_FACT_MEANS_TRAINING_PACE` is the
 * only user, and §5(d) of the header says why that promise is written this way
 * round rather than as a disjointness check against one hard-coded spelling.
 */
type IsEmptyUnion<A> = [A] extends [never] ? true : never;

/**
 * The members of `Words` that appear as a substring of `S`.
 *
 * `Words extends string` is there to distribute over the union rather than to
 * constrain it — without it the check would ask whether `S` contains the whole
 * union at once, which is never true and would make every scan built on this
 * silently empty. Pair any use with a non-vacuity assertion on the result for
 * exactly that reason.
 */
type WordsMatching<S extends string, Words extends string> = Words extends string
  ? S extends `${string}${Words}${string}`
    ? Words
    : never
  : never;

/**
 * `true` when the union has at least one member. Pairs with `AreDisjoint` so a
 * disjointness assertion cannot pass by having nothing left to compare.
 *
 * IT COVERS ONE DELETION, NOT EVERY DELETION, and the difference matters: a
 * reach emptied to `never` fails here, but a reach whose names have drifted off
 * the facts — the case a rename produces — does not. That union is still
 * non-empty; it just refers to nothing. Binding the names to `ProgressionFactKey`
 * is a separate assertion (`..._NAMES_REAL_FACTS`), and neither implies the
 * other. See §5(b) of the header.
 */
type IsNonEmptyUnion<A> = [A] extends [never] ? never : true;

// ---------------------------------------------------------------------------
// Marks: confirmed, and projected
// ---------------------------------------------------------------------------

/** Type-level only. Declared, never defined; emits no code. */
declare const SERVER_CONFIRMED: unique symbol;
/** Type-level only. Declared, never defined; emits no code. */
declare const CLIENT_PROJECTED: unique symbol;

/**
 * A number the server sent. Nominal: a plain `number` is not assignable to it,
 * so a locally computed total, e1RM or balance cannot be stored, compared
 * against a qualifying threshold, or scored.
 *
 * CONSTRAINED TO `number` ON PURPOSE. Branding an object is not a boundary —
 * see §2 of the header — and the constraint stops a future edit from reaching
 * for `Confirmed<SomeObject>` and getting a guarantee that is not there.
 *
 * There is exactly one mint, `confirm()`, and it is not exported — which is the
 * difference between this brand and `dots.ts`'s `officialTotalKg`. It has
 * several call sites, all private and all inside the decode path behind
 * `receiveProgressionSnapshot`; see §3 of the header for why that distinction is
 * spelled out rather than rounded to "one place".
 */
export type Confirmed<T extends number> = T & { readonly [SERVER_CONFIRMED]: 'server-confirmed' };

/**
 * A number the client worked out itself, for optimistic display. Disjoint from
 * `Confirmed`, so it cannot be stored as truth, and — because it is not an
 * `OfficialTotalKg` — cannot be scored by `dots.ts` either.
 */
export type Projected<T extends number> = T & { readonly [CLIENT_PROJECTED]: 'client-projected' };

/** A server-confirmed weight in kilograms. */
export type ConfirmedKg = Confirmed<number>;
/** A server-confirmed whole count: streak days, currency balances. */
export type ConfirmedCount = Confirmed<number>;
/**
 * A server-confirmed competition total. Also a `dots.ts` `OfficialTotalKg`, so
 * it can go straight into `dotsScore` — and a projected total cannot.
 */
export type ConfirmedTotalKg = Confirmed<OfficialTotalKg>;

/** A locally projected weight in kilograms. Provisional. */
export type ProjectedKg = Projected<number>;
/** A locally projected whole count. Provisional. */
export type ProjectedCount = Projected<number>;

/**
 * Wraps a locally computed weight as a projection.
 *
 * @throws {RangeError} if it is not a finite, positive number.
 */
export function projectedKg(value: number): ProjectedKg {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`progression: a projected weight must be finite and positive, received ${value}`);
  }
  return value as ProjectedKg;
}

/**
 * Wraps a locally computed count as a projection.
 *
 * @throws {RangeError} if it is not a safe non-negative integer.
 */
export function projectedCount(value: number): ProjectedCount {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`progression: a projected count must be a non-negative whole number, received ${value}`);
  }
  return value as ProjectedCount;
}

/**
 * The single confirming mint. MODULE-PRIVATE and not exported: every confirmed
 * number in the app traces back through here.
 *
 * It is called from `decodeBestByLift`, `decodeMeet` and
 * `receiveProgressionSnapshot` — three private functions, of which only the last
 * is exported and the other two are reachable only from it. So there are several
 * call sites and still one door.
 */
function confirm<T extends number>(value: T): Confirmed<T> {
  return value as Confirmed<T>;
}

// ---------------------------------------------------------------------------
// Identifiers
// ---------------------------------------------------------------------------

declare const MEET_ID_BRAND: unique symbol;
declare const PROPOSAL_ID_BRAND: unique symbol;
declare const REVISION_BRAND: unique symbol;

/** Server-assigned identity of a meet. */
export type MeetId = string & { readonly [MEET_ID_BRAND]: 'meet-id' };
/**
 * Client-assigned identity of one proposal, so a response can be matched to the
 * request that caused it. Client-minted deliberately: an id is not truth, it is
 * an idempotency key.
 */
export type ProposalId = string & { readonly [PROPOSAL_ID_BRAND]: 'proposal-id' };
/**
 * The server's version counter for a lifter's progression row. Monotonic. The
 * cache refuses to move backwards over it.
 */
export type ServerRevision = number & { readonly [REVISION_BRAND]: 'server-revision' };

/** @throws {RangeError} on an empty or blank id. */
export function asMeetId(value: string): MeetId {
  if (value.trim().length === 0) {
    throw new RangeError('progression: a meet id must not be blank');
  }
  return value as MeetId;
}

/** @throws {RangeError} on an empty or blank id. */
export function asProposalId(value: string): ProposalId {
  if (value.trim().length === 0) {
    throw new RangeError('progression: a proposal id must not be blank');
  }
  return value as ProposalId;
}

/** @throws {RangeError} unless it is a safe non-negative integer. */
export function asServerRevision(value: number): ServerRevision {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`progression: a server revision must be a non-negative whole number, received ${value}`);
  }
  return value as ServerRevision;
}

// ---------------------------------------------------------------------------
// The facts, and the allowlist that fences them in
// ---------------------------------------------------------------------------

/**
 * THE COMPLETE SET OF FIELDS SERVER-OWNED PROGRESSION MAY HAVE.
 *
 * Same mechanism as `STREAK_FACT_KEYS` in `streak.ts`, one level up: adding a
 * field to `ConfirmedFacts` fails `tsc` until it is added here.
 *
 * THE §8.1 QUESTION ("can this be bought?") IS ASKED IN `FACT_PROTECTION` BELOW,
 * not here. This comment used to claim it was asked here, and it was not asked
 * anywhere — being on this list said nothing about whether a purchase could move
 * the fact, and the default was that one could. Widening this list is now only
 * half an edit: the other half is answering the question, and the compiler will
 * not let the two be separated.
 *
 * Exported as a runtime array so a critic can compare it against a live object's
 * keys without reading a line of logic. `progression.test.ts` does exactly that.
 */
export const PROGRESSION_FACT_KEYS = ['totalKg', 'bestE1rmKg', 'streak', 'meets', 'wallet'] as const;

export type ProgressionFactKey = (typeof PROGRESSION_FACT_KEYS)[number];

/**
 * WHAT A FACT'S NAME HAS TO SAY BEFORE IT MAY BE BOUGHT, in one place.
 *
 * A blocklist, and blocklists are the weaker instrument — this file says so
 * where it uses one. It is here because the stronger instrument below
 * (`FACT_PROTECTION`) can be *answered wrongly*, and the only evidence about a
 * fact that is independent of the answer is the fact's own name. Same shape as
 * `PURCHASE_EVIDENCE_KEYS`, which reads report field names to cross-check a
 * hand-declared origin, and the same standing: a floor, not a decision
 * procedure.
 *
 * Matched case-insensitively against `Lowercase<ProgressionFactKey>` as a
 * SUBSTRING, so `simSessionsPerDay` is caught by `session` and by `perday`
 * without anyone having to have predicted that exact name.
 *
 * `PERFORMANCE_NAMED_FACTS_ARE_NOT_VACUOUS` is what proves this list can still
 * see the facts it is aimed at. Without it a typo here would empty every scan
 * built on it and nothing would say so.
 */
export const PERFORMANCE_FACT_VOCABULARY = {
  /**
   * Words meaning HOW FAST OR HOW OFTEN the game may be played. GDD §8.1: "Sim
   * training pace ... 100% skill- and consistency-driven". No fact may name any
   * of these at all — protected or not — because the promise is that pace has no
   * lever, not that its lever is expensive. `NO_FACT_MEANS_TRAINING_PACE`.
   */
  pace: ['pace', 'session', 'perday', 'daily', 'rate', 'cooldown', 'tempo', 'energy', 'stamina'],
  /**
   * Words meaning A NUMBER THE LIFTER IS JUDGED BY. A fact may name one of these
   * — `totalKg` and `bestE1rmKg` do, and must — but it may not then be declared
   * `'open'`. `NO_OPEN_FACT_NAMES_PERFORMANCE`.
   *
   * `'level'` is deliberately absent: GDD §5 makes Gym Empire levels an idle
   * layer with purchasable timer skips, so a `gymLevel` fact would be a
   * legitimate open one and banning the word would refuse real design.
   */
  performance: ['total', 'e1rm', '1rm', 'bonus', 'boost', 'multiplier', 'strength', 'score', 'dots', 'xp'],
} as const;

type PaceWord = (typeof PERFORMANCE_FACT_VOCABULARY.pace)[number];
type PerformanceWord = PaceWord | (typeof PERFORMANCE_FACT_VOCABULARY.performance)[number];

/** The fact keys whose own name contains one of `Words`. */
type FactsNaming<Words extends string> = {
  [F in ProgressionFactKey]: [WordsMatching<Lowercase<F>, Words>] extends [never] ? never : F;
}[ProgressionFactKey];

/** Facts whose name means training pace. Empty, and asserted to stay empty. */
type PaceNamedFactKey = FactsNaming<PaceWord>;

/** Facts whose name means performance. `'totalKg' | 'bestE1rmKg'` today. */
type PerformanceNamedFactKey = FactsNaming<PerformanceWord>;

/**
 * COMPILE-TIME ASSERTION (GDD §8.1, §12.3): THERE IS NO TRAINING-PACE FACT.
 *
 * This replaces `NOTHING_MOVES_TRAINING_PACE`, which could not fail. That one
 * read `AreDisjoint<ProposalReach[ProgressionProposalKind], 'trainingPace'>`,
 * and `PROPOSAL_REACH_NAMES_REAL_FACTS` already forces every reach value to be a
 * `ProgressionFactKey` while `'trainingPace'` was deliberately not one — so the
 * intersection was `never` for every edit short of adding a `ConfirmedFacts`
 * field spelled exactly `trainingPace`. See §5(d) of the header.
 *
 * The promise §8.1 makes is that pace has no lever, priced or free. That is a
 * statement about the FACT SET, so it is asserted over the fact set: nothing the
 * server owns may name pace, under any of the names in
 * `PERFORMANCE_FACT_VOCABULARY.pace`. It is empty today and it FAILS the moment
 * a pace fact appears — which is precisely the mutant §5(b) describes.
 *
 * NOTE THE POLARITY. This is `IsEmptyUnion`, not `IsNonEmptyUnion`: emptiness is
 * the claim rather than a hazard to the claim. Its own hazard — a scan that
 * matches nothing because the vocabulary drifted — is covered by
 * `PERFORMANCE_NAMED_FACTS_ARE_NOT_VACUOUS` below, over the superset.
 */
export const NO_FACT_MEANS_TRAINING_PACE: IsEmptyUnion<PaceNamedFactKey> = true;

/**
 * THE CONTROL FOR THE SCAN ABOVE, and it is load-bearing. `NO_FACT_MEANS_
 * TRAINING_PACE` passes over an empty set by design, so on its own it would also
 * pass if `WordsMatching` stopped matching anything — a distribution bug, a
 * gutted vocabulary, a renamed intrinsic. This fails in that world, because the
 * facts that DO name performance are still there to be found.
 */
export const PERFORMANCE_NAMED_FACTS_ARE_NOT_VACUOUS: IsNonEmptyUnion<PerformanceNamedFactKey> = true;

/**
 * Whether a fact may be moved by something bought. Two answers, both spelled
 * out, neither of them a default.
 */
export const FACT_PROTECTION_KINDS = ['protected', 'open'] as const;

export type FactProtection = (typeof FACT_PROTECTION_KINDS)[number];

/**
 * THE §8.1 ANSWER FOR EVERY FACT. The one place "can this be bought?" is written
 * down.
 *
 * THIS USED TO BE A HAND-WRITTEN LIST of protected names, and a list has a
 * DEFAULT: a fact that nobody added to it was unprotected, silently. That was
 * live, not theoretical — see §5(b) of the header for the mutant that shipped a
 * purchasable `simSessionsPerDay` past a clean `tsc` and all 1104 tests.
 *
 * Exhaustive by construction, exactly as `PROPOSAL_ORIGIN_BY_KIND` is one
 * operand over: `satisfies Readonly<Record<ProgressionFactKey, FactProtection>>`
 * rejects a missing fact and an unknown one, and `FACT_PROTECTION_COVERS_EVERY_
 * FACT` pins the same thing again in case a future edit drops the `satisfies`.
 * `PROTECTED_CONCERNS` is DERIVED from this map, so there is nothing left to
 * forget to edit.
 *
 * ANSWER FOR A NEW FACT HERE. `'open'` means a purchase may move it, and only
 * two things in the design qualify: Recovery Days move a streak (GDD §4.2, §8.2)
 * and buying Chalk moves a balance by definition. Fencing those is `streak.ts`'s
 * job and it does it; the line this module holds is the one about
 * *performance*. Everything else is `'protected'` — and `'open'` is not a free
 * answer, because `OPEN_FACTS_ARE_EXACTLY_WHAT_A_PURCHASE_MAY_REACH` makes it
 * cost an entry in the purchase catalogue and `NO_OPEN_FACT_NAMES_PERFORMANCE`
 * makes it cost a name that does not say performance.
 */
export const FACT_PROTECTION = {
  totalKg: 'protected',
  bestE1rmKg: 'protected',
  streak: 'open',
  meets: 'protected',
  wallet: 'open',
} as const satisfies Readonly<Record<ProgressionFactKey, FactProtection>>;

/**
 * COMPILE-TIME ASSERTION. Exhaustiveness in one direction and staleness in the
 * other: a new fact with no row here fails, and a row here naming a fact that
 * was renamed away fails too.
 *
 * IT REPLACES `PROTECTED_CONCERNS_NAME_REAL_FACTS`, which did the staleness half
 * for a hand-written list. With `PROTECTED_CONCERNS` derived from these keys,
 * that assertion had become a tautology — a protected concern could not fail to
 * be a real fact — and a tautology kept for continuity is the defect this round
 * is about. This one can still fail.
 */
export const FACT_PROTECTION_COVERS_EVERY_FACT: KeysAreExactly<
  typeof FACT_PROTECTION,
  ProgressionFactKey
> = true;

/**
 * The §8.1 / §12.3 line, as a set — DERIVED from `FACT_PROTECTION`, not listed
 * beside it.
 *
 * `'trainingPace'` IS NO LONGER A MEMBER, and that is a deliberate removal
 * rather than a consequence of the derivation. It was never a fact; it sat in
 * the old list purely to give `NOTHING_MOVES_TRAINING_PACE` an operand, and
 * every other check then had to route around it — `Exclude<ProtectedConcern,
 * 'trainingPace'>` here, an `if (concern === 'trainingPace') continue` in the
 * test. A protected concern that every guard has to skip is scaffolding.
 * `NO_FACT_MEANS_TRAINING_PACE` above is what holds that line now, and unlike
 * its predecessor it can fail. §5(d) of the header has the full argument.
 */
export type ProtectedConcern = {
  [F in ProgressionFactKey]: (typeof FACT_PROTECTION)[F] extends 'protected' ? F : never;
}[ProgressionFactKey];

/** The complement: facts a purchase is allowed to move. */
export type OpenFactKey = {
  [F in ProgressionFactKey]: (typeof FACT_PROTECTION)[F] extends 'open' ? F : never;
}[ProgressionFactKey];

function isProtectedFact(fact: ProgressionFactKey): fact is ProtectedConcern {
  return FACT_PROTECTION[fact] === 'protected';
}

function isOpenFact(fact: ProgressionFactKey): fact is OpenFactKey {
  return FACT_PROTECTION[fact] === 'open';
}

/**
 * The protected set at runtime, for the tests and for anything that wants to
 * render the line. Derived by walking `PROGRESSION_FACT_KEYS` and reading the
 * same map the type reads, so it is total over the facts by construction.
 *
 * The same caveat `PURCHASABLE_PROPOSAL_KINDS` carries applies: `tsc` cannot
 * check a type predicate's body against the conditional type it mirrors, so
 * `progression.test.ts` cross-checks both arrays against the map directly.
 */
export const PROTECTED_CONCERNS: readonly ProtectedConcern[] = PROGRESSION_FACT_KEYS.filter(isProtectedFact);

/** The other half of the partition, exported so a test can check it is one. */
export const OPEN_FACTS: readonly OpenFactKey[] = PROGRESSION_FACT_KEYS.filter(isOpenFact);

/**
 * THE NON-VACUITY GUARD THAT WAS MISSING ENTIRELY, on the operand that never had
 * one.
 *
 * `PURCHASES_CANNOT_REACH_PROTECTED_CONCERNS` and `ENTITLEMENTS_CANNOT_REACH_
 * PROTECTED_CONCERNS` are `AreDisjoint`, which is vacuously true over `never`.
 * Four rounds of hardening put both a non-vacuity guard and a real-facts binding
 * on the REACH side of those assertions and left the `ProtectedConcern` side
 * with neither. Mark every fact `'open'` and both checks would have gone on
 * passing over nothing; this fails instead.
 */
export const PROTECTED_CONCERNS_ARE_NOT_VACUOUS: IsNonEmptyUnion<ProtectedConcern> = true;

/**
 * COMPILE-TIME ASSERTION: NO FACT DECLARED `'open'` NAMES PERFORMANCE.
 *
 * The second of the two things that price an `'open'` answer, and the one that
 * survives an author who is willing to edit two maps. `simSessionsPerDay`
 * declared `'open'` fails here whatever else it is wired into, because its name
 * contains `session` and `perday`.
 *
 * IT IS A FLOOR AND IT IS DIRECTIONAL — a fact named `x7` satisfies it
 * perfectly, and a codebase that named everything opaquely would satisfy it
 * best. That is why it is the second check and not the first: the load-bearing
 * one is `OPEN_FACTS_ARE_EXACTLY_WHAT_A_PURCHASE_MAY_REACH`, which has no
 * vocabulary in it at all. Stated rather than glossed, because a directional
 * bound presented as a guarantee is how the assertion this replaces got here.
 */
export const NO_OPEN_FACT_NAMES_PERFORMANCE: AreDisjoint<OpenFactKey, PerformanceNamedFactKey> = true;

/** The currencies a wallet holds (GDD §8.2). */
export const WALLET_CURRENCIES = ['gymBucks', 'chalk'] as const;

export type WalletCurrency = (typeof WALLET_CURRENCIES)[number];

/**
 * Balances, server-confirmed.
 *
 * RECOVERY DAYS ARE NOT HERE. Their ledger is `StreakState.recoveryDayBalance`
 * and duplicating it would create a second truth for one consumable — the one
 * with the hold cap and the consecutive-use limit on it is the real one.
 */
export type ConfirmedWallet = Readonly<Record<WalletCurrency, ConfirmedCount>>;

/**
 * One meet on the record.
 *
 * `totalKg` is `null` for a bomb-out and that is NOT a total of zero — the same
 * distinction `meet.ts` and `dots.ts` hold. A lifter who bombed does not place;
 * they do not place *last*.
 */
export interface ConfirmedMeetResult {
  readonly meetId: MeetId;
  /** Civil-day index of the meet, as the server resolved it. */
  readonly meetDayIndex: number;
  /** The official total, or `null` for a bomb-out. */
  readonly totalKg: ConfirmedTotalKg | null;
  /** Best good lift per lift; `null` where a lift was bombed. */
  readonly bestByLift: Readonly<Record<LiftKind, ConfirmedKg | null>>;
  /**
   * Bodyweight at weigh-in, in kg. Needed to score DOTS off a stored result.
   *
   * `ConfirmedKg`, like every other number on this type. It was a bare `number`
   * sitting beside a `ConfirmedTotalKg`, which made it the one scalar on server
   * truth that a locally computed number was assignable to — the asymmetry was
   * the defect, in one line. The kilogram unit is proven upstream, by
   * `meetServer.ts`'s refusal, before the wire this decodes is ever built.
   */
  readonly bodyweightKg: ConfirmedKg;
}

export const CONFIRMED_MEET_RESULT_KEYS = [
  'meetId',
  'meetDayIndex',
  'totalKg',
  'bestByLift',
  'bodyweightKg',
] as const;

export type ConfirmedMeetResultKey = (typeof CONFIRMED_MEET_RESULT_KEYS)[number];

export const MEET_RESULT_IS_EXACTLY_ITS_ALLOWLIST: KeysAreExactly<
  ConfirmedMeetResult,
  ConfirmedMeetResultKey
> = true;

/**
 * Everything the server owns about one lifter's progression, as read out of a
 * snapshot. Deeply frozen; every scalar is branded `Confirmed`.
 */
export interface ConfirmedFacts {
  /** Best competition total on record, or `null` before the first meet. */
  readonly totalKg: ConfirmedTotalKg | null;
  /** Best e1RM per lift, or `null` where the lift has never been trained. */
  readonly bestE1rmKg: Readonly<Record<LiftKind, ConfirmedKg | null>>;
  /** The streak system's state, owned and fenced by `streak.ts`. */
  readonly streak: StreakState;
  /** Meets on the record, oldest first. */
  readonly meets: readonly ConfirmedMeetResult[];
  /** Currency balances. Recovery Days are in `streak`, not here. */
  readonly wallet: ConfirmedWallet;
}

/**
 * COMPILE-TIME ASSERTION, not documentation. Add `e1rmMultiplier` (or anything
 * else, under any name) to `ConfirmedFacts` and `tsc --noEmit` fails here until
 * `PROGRESSION_FACT_KEYS` is widened.
 */
export const PROGRESSION_FACTS_ARE_EXACTLY_THE_ALLOWLIST: KeysAreExactly<
  ConfirmedFacts,
  ProgressionFactKey
> = true;

// ---------------------------------------------------------------------------
// The catalogue: what anything purchasable is allowed to do (GDD §8.1, §8.3)
// ---------------------------------------------------------------------------

/**
 * THE COMPLETE SET OF THINGS A PURCHASE MAY DO. Adding a kind here is the edit
 * that has to be argued for; `ENTITLEMENT_EFFECTS_ARE_EXACTLY_THE_ALLOWLIST`
 * makes it impossible to add one to the union without adding it here.
 */
export const ENTITLEMENT_EFFECT_KINDS = ['cosmetic', 'convenience', 'currency', 'recovery-day'] as const;

export type EntitlementEffectKind = (typeof ENTITLEMENT_EFFECT_KINDS)[number];

/** Cosmetic slots from GDD §8.3A. Pure flavour, zero stat impact. */
export const COSMETIC_SLOTS = [
  'singlet',
  'chalk-vfx',
  'bar-skin',
  'plate-skin',
  'gym-decor',
  'lifter-appearance',
  'coach-voice-pack',
  'meet-entrance',
] as const;

export type CosmeticSlot = (typeof COSMETIC_SLOTS)[number];

/**
 * Convenience grants from GDD §8.3B.
 *
 * THERE IS NO SIM-SESSION SKIP AND THERE MUST NEVER BE ONE: "Never speed up
 * Sim-mode training progression. That is the credibility line." Gym Empire build
 * timers are idle-layer scaffolding and are fair game; a training session is
 * not.
 */
export const CONVENIENCE_GRANTS = ['gym-empire-timer-skip', 'extra-save-slot'] as const;

export type ConvenienceGrant = (typeof CONVENIENCE_GRANTS)[number];

/** What one purchasable thing does. */
export type EntitlementEffect =
  | { readonly kind: 'cosmetic'; readonly slot: CosmeticSlot }
  | { readonly kind: 'convenience'; readonly grant: ConvenienceGrant }
  | { readonly kind: 'currency'; readonly currency: WalletCurrency; readonly amount: number }
  /** GDD §4.2 / §8.2 — the one functional purchase, fenced by `streak.ts`. */
  | { readonly kind: 'recovery-day'; readonly count: number };

/**
 * COMPILE-TIME ASSERTION. Adding an `{ kind: 'e1rm-boost' }` variant to
 * `EntitlementEffect` fails here until `'e1rm-boost'` is written into
 * `ENTITLEMENT_EFFECT_KINDS` above — a visible edit in a file whose header
 * explains why it must not happen.
 */
export const ENTITLEMENT_EFFECTS_ARE_EXACTLY_THE_ALLOWLIST: UnionIsExactly<
  EntitlementEffect['kind'],
  EntitlementEffectKind
> = true;

/** A catalogue entry: a SKU and what it grants. */
export interface Entitlement {
  readonly sku: string;
  readonly effect: EntitlementEffect;
}

/**
 * Which progression facts each entitlement effect may move. `never` means "no
 * progression fact at all" — a singlet changes nothing the server owns here.
 *
 * THESE STRINGS ARE FACT NAMES AND `ENTITLEMENT_REACH_NAMES_REAL_FACTS` BINDS
 * THEM TO THE REAL ONES. Written as free literals they would be bound to
 * nothing, and a renamed fact would leave this map naming a field that no longer
 * exists — see §5(b) of the header for why that is worse than it sounds.
 */
export interface EntitlementReach {
  readonly cosmetic: never;
  readonly convenience: never;
  readonly currency: 'wallet';
  readonly 'recovery-day': 'streak';
}

/** The union of everything any purchase can reach. */
export type AnyEntitlementReach = EntitlementReach[EntitlementEffectKind];

/**
 * COMPILE-TIME ASSERTION (GDD §8.1, §12.3): nothing purchasable touches Total,
 * e1RM, meet results or training pace.
 */
export const ENTITLEMENTS_CANNOT_REACH_PROTECTED_CONCERNS: AreDisjoint<
  AnyEntitlementReach,
  ProtectedConcern
> = true;

/**
 * The second half of the guard above. A disjointness assertion over an empty
 * union passes for free, so this fails if `EntitlementReach` is ever emptied —
 * which is how a check stops being able to fail without anyone noticing.
 */
export const ENTITLEMENT_REACH_IS_NOT_VACUOUS: IsNonEmptyUnion<AnyEntitlementReach> = true;

/**
 * The THIRD half, and the one that was missing: the reach must name facts that
 * exist. Non-vacuity above catches a reach emptied to `never`; it cannot catch a
 * reach that still has members which no longer mean anything. Rename
 * `ConfirmedFacts.streak` and this map would go on saying `'streak'`, go on
 * compiling, and go on being disjoint from `PROTECTED_CONCERNS` — by spelling,
 * which is not a guarantee about anything.
 *
 * Exactly what `PROTECTED_CONCERNS_NAME_REAL_FACTS` does for the other operand
 * of the same assertion, applied here so both sides are bound.
 */
export const ENTITLEMENT_REACH_NAMES_REAL_FACTS: IsSubsetOf<
  AnyEntitlementReach,
  ProgressionFactKey
> = true;

/**
 * COMPILE-TIME ASSERTION, AND THE PRICE OF ANSWERING `'open'` (GDD §8.1, §12.3).
 *
 * `FACT_PROTECTION` forces every fact to declare whether it can be bought, which
 * closes the silent default — but on its own it would only move the escape one
 * line, because the author of a purchasable pace fact can simply write
 * `'open'`. This is what that answer then costs: THE OPEN SET AND THE PURCHASE
 * CATALOGUE'S REACH MUST BE THE SAME SET.
 *
 * `UnionIsExactly` because it has to fail in both directions:
 *
 *   - A FACT DECLARED OPEN THAT NO PURCHASE REACHES. The left side gains a
 *     member. This is the mutant's remaining route: declaring `simSessionsPerDay`
 *     `'open'` to duck `PURCHASES_CANNOT_REACH_PROTECTED_CONCERNS` fails here
 *     unless it is also written into `EntitlementReach` — into the map that says
 *     what money buys, under the entitlement effect that buys it, which is a
 *     confession rather than a smuggle. There is no effect kind that could
 *     plausibly own it either, and inventing one fails
 *     `ENTITLEMENT_EFFECTS_ARE_EXACTLY_THE_ALLOWLIST` first.
 *   - A PURCHASE REACHING A FACT NOT DECLARED OPEN. The right side gains a
 *     member. Also caught by the disjointness checks, and deliberately caught
 *     twice: these two maps are the only two statements in the file about what a
 *     purchase does, and two statements that disagree are no statement at all.
 *
 * NOTHING HERE IS SATISFIED BY DOING LESS. Gutting `EntitlementReach` empties
 * the right side and fails; marking every fact protected empties the left side
 * and fails. There is no vocabulary in it, so unlike
 * `NO_OPEN_FACT_NAMES_PERFORMANCE` it cannot be dodged by choosing a duller
 * name.
 *
 * It also makes `AnyPurchaseReach ⊆ OpenFactKey` a theorem rather than a third
 * assertion: the reach is bound to real facts, the facts partition into open and
 * protected, and the purchase reach is disjoint from protected. A separate
 * assertion for it would be one that cannot fail, which is the thing this round
 * is removing rather than adding.
 */
export const OPEN_FACTS_ARE_EXACTLY_WHAT_A_PURCHASE_MAY_REACH: UnionIsExactly<
  OpenFactKey,
  AnyEntitlementReach
> = true;

// ---------------------------------------------------------------------------
// Proposals: what the client may ask for. Inputs only.
// ---------------------------------------------------------------------------

export const PROGRESSION_PROPOSAL_KINDS = [
  'record-training-session',
  'set-recovery-day-protection',
  'record-meet-result',
  'redeem-entitlement',
  'spend-currency',
] as const;

export type ProgressionProposalKind = (typeof PROGRESSION_PROPOSAL_KINDS)[number];

/**
 * One set as it was actually performed. INPUTS ONLY: there is no `e1rmKg` here
 * and the key allowlist below forbids one. The server derives e1RM from these
 * four numbers with `e1rm.ts`, which is the only way two parts of the app can
 * be guaranteed to report the same number for the same set.
 *
 * The client may of course *estimate* the same set locally and show it — that is
 * what `ProgressionProjection` is for. What it may not do is send the answer.
 *
 * THE WEIGHT IS `weight`, NOT `weightKg`, AND THAT RENAME IS THE POINT — the
 * same rename `MeetAttemptReport` got one round earlier, for the same reason and
 * on the same evidence. It was a bare `number` with a unit in its NAME and
 * nothing behind the name, sitting thirty lines above the meet row that had just
 * been fixed, in the same list of untrusted wire reports, under the same
 * allowlist idiom.
 *
 * WHERE IT WENT. `sessionServer.ts` fed it to `tryEstimateE1rm`, which is
 * documented UNIT-AGNOSTIC ("kg in → kg out, lb in → lb out. Do not convert
 * inside this module") and therefore proves nothing; the answer became
 * `record.bestE1rmKg`, which `nextBestE1rm` keeps MONOTONE, and then
 * `ConfirmedFacts.bestE1rmKg` — a `ConfirmedKg`, a `PROGRESSION_FACT_KEYS`
 * member, `'protected'` in `FACT_PROTECTION`. Nothing on that path looked at a
 * unit: `sessionServer.ts` contained no occurrence of the word.
 *
 * A row does not carry a unit because a row is not the grain a unit has. One
 * session is one prescription under one `SESSION_TUNING.LOAD_UNIT`, which is
 * where the loop already keeps the answer, so the unit rides on the CARD
 * (`TrainingCardReport` below), once. Five per-row units would be five facts
 * where there is one, four of them redundant and every one of them free to
 * disagree with the others.
 */
export interface TrainingSetReport {
  readonly lift: LiftKind;
  readonly weight: number;
  readonly reps: number;
  readonly rpe: number;
}

export const TRAINING_SET_REPORT_KEYS = ['lift', 'weight', 'reps', 'rpe'] as const;

export const TRAINING_SET_REPORT_IS_EXACTLY_ITS_ALLOWLIST: KeysAreExactly<
  TrainingSetReport,
  (typeof TRAINING_SET_REPORT_KEYS)[number]
> = true;

/**
 * THE SESSION'S SETS, WITH THE UNIT THEY WERE LIFTED IN. One tag for the whole
 * session, because a session is one prescription and a prescription is one unit.
 *
 * WHY THIS EXISTS. `TrainingSessionReport` used to carry `sets: readonly
 * TrainingSetReport[]` and each row a `weightKg`. Nothing anywhere proved that
 * `Kg` — not the decoder (`isFiniteWeight` is finiteness, not unit), not the
 * estimator (`e1rm.ts` is unit-agnostic BY DESIGN and says so), not the write
 * (`sessionServer.ts` had no occurrence of "unit" in it at all). The number
 * reached `ConfirmedFacts.bestE1rmKg` — protected, branded `ConfirmedKg`, and
 * monotone, so a session banked in the wrong unit could never be walked back by
 * a later honest one. It is also what `meetServer.ts`'s `meetDayFacts` hands to
 * meet day, where `suggestOpener` turns it into a declared attempt and
 * `stageLoadRatio` divides a proven-kilogram meet weight by it.
 *
 * THE SHAPE IS `MeetCardReport`'S AND `BodyweightReading`'S, DELIBERATELY:
 *
 *   - A TAGGED PAIR RATHER THAN A BRAND, because the consumer that has to be
 *     convinced is a SERVER and the value reaches it as JSON. A brand is erased
 *     by `JSON.stringify`; a `unit` field is not.
 *   - THE ARMS CARRY DIFFERENT FIELD NAMES, so the rows cannot be reached
 *     without narrowing on the unit first. There is no `sets` field on this
 *     type — a field reachable from both arms would put the hole straight back,
 *     which is exactly what `sets` was.
 *
 * WHAT THAT BUYS AND WHAT IT DOES NOT. Reaching the weights WITHOUT NAMING A
 * UNIT is a compile error, everywhere, because no such expression exists.
 * Whether the unit named is the TRUE one is a runtime refusal in
 * `sessionServer.ts` (`UNSUPPORTED_SESSION_UNIT`) and not a compile-time
 * property, because both arms are representable — as they must be, since this
 * is what an untrusted client sends.
 *
 * `'lb'` IS REPRESENTABLE FOR THAT REASON. Narrowing this to the kilogram arm
 * would move the refusal to `tsc` on the client, which is the half of the system
 * this file exists because it does not trust.
 */
export type TrainingCardReport =
  /** Lifted in kilograms. The only unit permanent progression can store. */
  | { readonly unit: 'kg'; readonly kilogramSets: readonly TrainingSetReport[] }
  /** Lifted in pounds. Carried so it can be REFUSED by name, not converted. */
  | { readonly unit: 'lb'; readonly poundSets: readonly TrainingSetReport[] };

/**
 * The arm of `TrainingCardReport` whose numbers a kilogram consumer may use.
 *
 * Named rather than written out at each use so "these weights have been proven
 * to be kilograms" is one type with one spelling, and `Extract` rather than a
 * second literal so it cannot drift from the union. `KilogramMeetCard` and
 * `dots.ts`'s `KilogramBodyweight` are the same construction for the other two
 * numbers on this boundary.
 */
export type KilogramTrainingCard = Extract<TrainingCardReport, { readonly unit: 'kg' }>;

/**
 * Every field name either arm of a training card can put on the wire.
 *
 * ONE ALLOWLIST FOR BOTH ARMS, via `EveryArmKey`, for the reason
 * `MEET_CARD_REPORT_KEYS` gives: `keyof` a union is the INTERSECTION of its
 * members' keys, so a per-type `KeysAreExactly` would silently check almost
 * nothing.
 *
 * IT ENDS IN `_REPORT_KEYS` ON PURPOSE. `progression.test.ts` finds the nested
 * allowlists by scanning this module's exports for that suffix; a name outside
 * the convention would be checked by nothing.
 */
export const TRAINING_CARD_REPORT_KEYS = ['unit', 'kilogramSets', 'poundSets'] as const;

export const TRAINING_CARD_REPORT_IS_EXACTLY_ITS_ALLOWLIST: UnionIsExactly<
  EveryArmKey<TrainingCardReport>,
  (typeof TRAINING_CARD_REPORT_KEYS)[number]
> = true;

/**
 * One attempt as the judges called it.
 *
 * See §6 of the header: with a real Edge Function the lights should be
 * re-resolved server-side and this type gets narrower. It is the client's word
 * today because there is nobody else to ask.
 *
 * THE WEIGHT IS `weight`, NOT `weightKg`, AND THAT RENAME IS THE POINT. It was
 * `weightKg`: a bare `number` with a unit in its NAME and nothing behind the
 * name — the same defect the bodyweight had one field up, nine times over. And
 * these nine are the numbers that BECOME the total, so they are the ones that
 * end up in `record.totalKg` permanently and monotonically.
 *
 * A row does not carry a unit because a row is not the grain a unit has. A meet
 * is run under one `MeetLoadingRules` and `meet.ts` says so in as many words —
 * "It is deliberately ONE unit for the whole meet". The unit therefore rides on
 * the CARD (`MeetCardReport` below), once, where the domain actually puts it.
 * Nine per-row units would be nine facts where there is one, eight of them
 * redundant and every one of them free to disagree with the others; and a card
 * whose squats were kg and whose bench was lb would make "attempts may not go
 * down in weight within a lift" (CLAUDE.md, meet structure) a comparison between
 * two different scales. A shape that can express a state the sport cannot is a
 * shape somebody has to write a refusal for.
 */
export interface MeetAttemptReport {
  readonly lift: LiftKind;
  readonly attemptNumber: 1 | 2 | 3;
  readonly weight: number;
  readonly good: boolean;
}

export const MEET_ATTEMPT_REPORT_KEYS = ['lift', 'attemptNumber', 'weight', 'good'] as const;

export const MEET_ATTEMPT_REPORT_IS_EXACTLY_ITS_ALLOWLIST: KeysAreExactly<
  MeetAttemptReport,
  (typeof MEET_ATTEMPT_REPORT_KEYS)[number]
> = true;

/**
 * THE NINE NUMBERS, WITH THE UNIT THEY WERE LIFTED IN. One tag for the whole
 * card, because a card is one meet and a meet is one unit.
 *
 * WHY THIS EXISTS. `MeetResultReport` used to carry `attempts: readonly
 * MeetAttemptReport[]` and each row a `weightKg`. Nothing anywhere proved that
 * `Kg`. `meetServer.ts` replayed those numbers through `createMeet(meet.rules)`
 * and then checked `readTotal(state).unit` — but that unit is stamped by the
 * MEET DEFINITION the caller passed in beside the report, so the check was a
 * label read off one argument being used to vouch for the numbers in another.
 * `meetServer.test.ts`'s own positive control shows what that costs: 405 / 425 /
 * 442.5 / 265 / 275 / 280 / 500 / 525 / 545 is a legal POUND card and a legal
 * KILOGRAM card, because pound calls land on 2.5 lb and kilogram calls on 2.5
 * kg. Essentially every legal pound card is a legal kilogram card. A client
 * playing in lb against a server that looked the definition up and found a kg
 * meet banked a total 2.2x too large — and `nextTotalKg` is monotone, so no
 * later honest meet can ever walk it back.
 *
 * THE SHAPE IS `BodyweightReading`'S, DELIBERATELY, AND FOR ITS REASONS:
 *
 *   - A TAGGED PAIR RATHER THAN A BRAND, because the consumer that has to be
 *     convinced is a SERVER and the value reaches it as JSON. A brand is erased
 *     by `JSON.stringify`; a `unit` field is not.
 *   - THE ARMS CARRY DIFFERENT FIELD NAMES, so the nine numbers cannot be
 *     reached without narrowing on the unit first. There is no `attempts` field
 *     on this type — a field reachable from both arms would put the hole
 *     straight back, which is exactly what `attempts` was.
 *
 * WHAT THAT BUYS AND WHAT IT DOES NOT, because the last two rounds of this both
 * overclaimed: reaching the weights WITHOUT NAMING A UNIT is now a compile
 * error, everywhere, because no such expression exists. Whether the unit named
 * is the TRUE one is a runtime refusal in `meetServer.ts` (`applyMeetResult`
 * compares it against `meet.rules.unit`, which is server-owned data rather than
 * a constant) and not a compile-time property, because both arms are
 * representable — as they must be, since this is what an untrusted client sends.
 *
 * `'lb'` IS REPRESENTABLE FOR THAT REASON. Narrowing this to the kilogram arm
 * would move the refusal to `tsc` on the client, which is the half of the system
 * this file exists because it does not trust.
 *
 * IT LIVES HERE RATHER THAN BESIDE `BodyweightReading` IN `dots.ts` for one
 * mechanical reason: `dots.ts` imports nothing, and an attempt row names
 * `LiftKind`.
 */
export type MeetCardReport =
  /** Lifted in kilograms. The only unit permanent progression can store. */
  | { readonly unit: 'kg'; readonly kilogramAttempts: readonly MeetAttemptReport[] }
  /** Lifted in pounds. Carried so it can be REFUSED by name, not converted. */
  | { readonly unit: 'lb'; readonly poundAttempts: readonly MeetAttemptReport[] };

/**
 * The arm of `MeetCardReport` whose numbers a kilogram consumer may use.
 *
 * Named rather than written out at each use so "these weights have been proven
 * to be kilograms" is one type with one spelling, and `Extract` rather than a
 * second literal so it cannot drift from the union. `dots.ts`'s
 * `KilogramBodyweight` is the same construction for the other number.
 */
export type KilogramMeetCard = Extract<MeetCardReport, { readonly unit: 'kg' }>;

/**
 * Every field name either arm of a card can put on the wire.
 *
 * ONE ALLOWLIST FOR BOTH ARMS. `keyof` a union is the INTERSECTION of its
 * members' keys — for this type, just `'unit'` — so a per-type `KeysAreExactly`
 * would silently check almost nothing. `EveryArmKey` distributes instead, and
 * the assertion below therefore fails if either arm gains, loses or renames a
 * field.
 */
export const MEET_CARD_REPORT_KEYS = ['unit', 'kilogramAttempts', 'poundAttempts'] as const;

export const MEET_CARD_REPORT_IS_EXACTLY_ITS_ALLOWLIST: UnionIsExactly<
  EveryArmKey<MeetCardReport>,
  (typeof MEET_CARD_REPORT_KEYS)[number]
> = true;

/**
 * COMPILE-TIME ASSERTION, AND THE ONE THE WHOLE UNIT BOUNDARY RESTS ON: a
 * unit-tagged reading on this wire cannot have its numbers read without
 * narrowing on its unit.
 *
 * Round 2 gave `BodyweightReading` two arms with different field names and said,
 * correctly, that this made deleting `meetServer.ts`'s check a compile error.
 * NOTHING ASSERTED IT. Rename `pounds` to `kilograms` on the pound arm — one
 * word, in a diff that looks like a tidy-up — and the property evaporates while
 * every test stays green, because `bodyweight.kilograms` now type-checks against
 * an unnarrowed union.
 *
 * So it is asserted, over every reading on this wire rather than over the one
 * that happened to be built last. That is what makes this a statement about the
 * SHAPE instead of about a field: a third unit-tagged reading gets one line here
 * and inherits the guarantee.
 *
 * THE THIRD LINE IS NOW WRITTEN, AND IT IS THE OTHER MODE'S. For a round this
 * paragraph described a slot nobody had filled while `TrainingSetReport.weightKg`
 * sat thirty lines above `MeetAttemptReport` — a bare number with a unit in its
 * name, on the path to `ConfirmedFacts.bestE1rmKg`, which is protected and
 * monotone. The sentence was right about the mechanism and the mechanism was
 * unused.
 *
 * BOTH HALVES ARE CHECKED. Disjoint arms is the claim; two arms that both have
 * payload fields is what stops it passing vacuously, since an arm emptied to
 * `{ unit: 'lb' }` is trivially disjoint from everything and carries no number
 * to protect.
 */
export const A_MEET_CARD_CANNOT_BE_READ_WITHOUT_ITS_UNIT: ArmsAreTellableApart<MeetCardReport> = true;

export const A_BODYWEIGHT_CANNOT_BE_READ_WITHOUT_ITS_UNIT: ArmsAreTellableApart<BodyweightReading> = true;

export const A_TRAINING_CARD_CANNOT_BE_READ_WITHOUT_ITS_UNIT: ArmsAreTellableApart<TrainingCardReport> =
  true;

/**
 * THE STARTING e1RMs, WITH THE UNIT THEY ARE EXPRESSED IN — the fourth tagged
 * pair on this boundary, and the only one that is not a report.
 *
 * ---------------------------------------------------------------------------
 * WHY THE TYPE IS HERE AND THE VALUE IS IN `sessionTuning.ts`
 * ---------------------------------------------------------------------------
 * The type lived beside the constant for a round, on the argument that a unit is
 * declared at the authoring site. That argument is about the VALUE and it still
 * holds: `SESSION_TUNING.STARTING_E1RM` is still authored in `sessionTuning.ts`,
 * still under `satisfies StartingE1rmSeed`, still with the paragraph explaining
 * what it reaches. Only the type moved.
 *
 * WHAT THE OLD PLACEMENT COST is the line directly below this comment.
 * `ArmsAreTellableApart` is module-private, so the seed was the ONE tagged pair
 * on this wire with no assertion that its arms can be told apart — the property
 * `sessionServer.ts` correctly calls "the guarantee", stated in prose and
 * enforced by nothing. The concrete edit that exposed it: add a convenience
 * field reachable from both arms (`perLift`, say, so `STARTING_E1RM.perLift[lift]`
 * works without a switch — the natural edit for anyone answering GDD §11), and
 * `tsc` passes, all four read sites pass, and the only thing standing is a
 * runtime `Object.keys` pin on the shipped VALUE, which cannot see a field added
 * to the TYPE and populated only on the pound arm.
 *
 * The cost the old placement named — an `import type` in `meetServer.ts` — is
 * erased at build and is now one import FEWER, because `meetServer.ts` already
 * imports from this module and no longer needs a second line for the seed.
 *
 * ---------------------------------------------------------------------------
 * WHY IT IS A TAGGED PAIR AND NOT THREE BARE NUMBERS UNDER A `_KG` NAME
 * ---------------------------------------------------------------------------
 * It used to be `STARTING_E1RM_KG: { squat: 180, bench: 120, deadlift: 220 }` —
 * three numbers whose unit lived in the identifier — under a comment calling it
 * "PLACEHOLDER DATA, NOT PROGRESSION. Nothing here is persisted and nothing
 * derives from it once the server has a real number." BOTH CLAUSES WERE FALSE:
 * `newServerRecord()` assigns them straight into `ConfirmedFacts.bestE1rmKg`
 * (§7.1, route 2), and `nextBestE1rm` is MONOTONE, so the seed is a permanent
 * FLOOR rather than a starting guess.
 *
 * THE EDIT THIS SHAPE EXISTS TO CATCH: GDD §11's display-unit question is open.
 * If the answer is "the loop loads in pounds", the first edit is `LOAD_UNIT:
 * 'lb'`, which `sessionProposal` forwards onto the card, so the server refuses
 * the session loudly, as designed. THE SECOND, NATURAL EDIT is the three
 * magnitudes — and with the unit in the identifier that seeded a kilogram field
 * with pound numbers silently, with every guard in the tree green.
 *
 * WHAT IT PROVES AND WHAT IT DOES NOT: a tag proves what was DECLARED, not what
 * was TYPED. `{ unit: 'kg', kilograms: { squat: 397, … } }` compiles and is 2.2x
 * wrong; that is §7.3(b) and it is open here exactly as it is for the other
 * three readings. What this shape buys is that the unit and the magnitudes can
 * no longer drift apart WITHOUT SOMEBODY SAYING SO in the diff.
 *
 * The `'lb'` arm exists so a pound seed can be REFUSED BY NAME rather than
 * converted, matching `dots.ts` past its domain, `e1rm.ts` past the chart and
 * both servers on a pound card. It is not the answer to §11 and does not take
 * one: `KILOGRAMS_PER_POUND` is right there and nothing calls it.
 */
export type StartingE1rmSeed =
  /** Expressed in kilograms. The only unit permanent progression can store. */
  | { readonly unit: 'kg'; readonly kilograms: Readonly<Record<LiftKind, number>> }
  /** Expressed in pounds. Carried so it can be REFUSED by name, not converted. */
  | { readonly unit: 'lb'; readonly pounds: Readonly<Record<LiftKind, number>> };

/**
 * The arm of `StartingE1rmSeed` a kilogram consumer may read.
 *
 * `Extract` rather than a second literal so it cannot drift from the union,
 * exactly as `KilogramTrainingCard`, `KilogramMeetCard` and `KilogramBodyweight`
 * are built. `sessionServer.ts` binds the seed to this type at module scope, so
 * a seed declared in any other unit is a BUILD error rather than a runtime
 * refusal — see that module for why a compile-time check is available for a
 * literal in the build and is not available for a card that arrives as JSON.
 */
export type KilogramStartingE1rm = Extract<StartingE1rmSeed, { readonly unit: 'kg' }>;

/**
 * THE FOURTH LINE, AND THE ONE THAT WAS MISSING.
 *
 * `sessionServer.ts` says of the seed, correctly, that "THE ANNOTATION IS NOT
 * THE CHECK ... what is load-bearing is that THE ARMS CARRY DIFFERENT FIELD
 * NAMES ... the SHAPE is the guarantee". Until this line existed, the property
 * named as the guarantee was the one enforced by convention: three of the four
 * tagged pairs on this boundary had an `ArmsAreTellableApart` assertion and the
 * seed had a paragraph. It typechecked and was non-vacuous the whole time; the
 * only reason it was not written is that the type was declared in another
 * module and this helper is module-private. So the type moved.
 *
 * `sessionServer.test.ts` reads this at runtime, the way it already reads
 * `A_STARTING_E1RM_CAN_DECLARE_A_UNIT_THIS_RECORD_REFUSES`, so it cannot be
 * deleted as an unused export without a test going red.
 */
export const A_STARTING_E1RM_SEED_CANNOT_BE_READ_WITHOUT_ITS_UNIT: ArmsAreTellableApart<StartingE1rmSeed> =
  true;

/**
 * A finished daily session.
 *
 * `deviceWallClock` is a HINT, not an authority. GDD §4.1: "'Local' is an
 * account property the server resolves, not the device's current timezone —
 * otherwise a player flying east loses a day and a player who changes their
 * phone clock manufactures one." The server resolves which streak day this is;
 * this field exists so it can notice drift, not so it can be trusted.
 *
 * THE ONE NUMBER ON THIS REPORT TRAVELS WITH ITS UNIT. `sets` was a bare
 * `readonly TrainingSetReport[]` and each row a `weightKg`; it is now a
 * `TrainingCardReport`, the same tagged-pair shape the meet card and the
 * bodyweight use, and `A_TRAINING_CARD_CANNOT_BE_READ_WITHOUT_ITS_UNIT` asserts
 * the property that makes the tag load-bearing. A second number added here has
 * one line to copy and a failing assertion if it does not.
 */
export interface TrainingSessionReport {
  readonly deviceWallClock: LocalWallClock;
  /**
   * THE SETS, WITH THE UNIT THEY WERE LIFTED IN. See `TrainingCardReport`.
   *
   * `sessionServer.ts` refuses the pound arm (`UNSUPPORTED_SESSION_UNIT`)
   * before `bestE1rmFromSets` runs and before the streak moves.
   */
  readonly card: TrainingCardReport;
}

export const TRAINING_SESSION_REPORT_KEYS = ['deviceWallClock', 'card'] as const;

export const TRAINING_SESSION_REPORT_IS_EXACTLY_ITS_ALLOWLIST: KeysAreExactly<
  TrainingSessionReport,
  (typeof TRAINING_SESSION_REPORT_KEYS)[number]
> = true;

/**
 * The player changed the Recovery Day protection setting (GDD §4.2).
 *
 * THE ONLY RECOVERY-DAY PROPOSAL THERE IS, since auto-protection replaced the
 * accept/decline prompt. There is nothing for a client to ask the server to
 * spend: a save is decided by the calendar and applied by the session that ends
 * the absence, so the only thing left for the player to say is whether they want
 * protection at all.
 *
 * `deviceWallClock` is a hint, exactly as on a training session — the server
 * resolves the day (GDD §4.1).
 */
export interface SetRecoveryDayProtectionReport {
  readonly deviceWallClock: LocalWallClock;
  readonly protectionEnabled: boolean;
}

export const SET_RECOVERY_DAY_PROTECTION_REPORT_KEYS = ['deviceWallClock', 'protectionEnabled'] as const;

export const SET_RECOVERY_DAY_PROTECTION_REPORT_IS_EXACTLY_ITS_ALLOWLIST: KeysAreExactly<
  SetRecoveryDayProtectionReport,
  (typeof SET_RECOVERY_DAY_PROTECTION_REPORT_KEYS)[number]
> = true;

/**
 * A finished meet. INPUTS ONLY: the card and the bodyweight. There is no
 * `totalKg` and the allowlist forbids one — GDD §6.4's "total = sum of best
 * successful attempt per lift" is a server computation, and a client that could
 * send a total could send any total.
 *
 * EVERY NUMBER ON THIS REPORT NOW TRAVELS WITH ITS UNIT, and that is a property
 * of the type rather than of the fields that happened to get fixed: three
 * separate rounds closed `totalKg`, then `bodyweightKg`, then the nine attempt
 * weights, each after a critic found the next bare `Kg` beside the one just
 * fixed. What is left is two fields, both tagged, and
 * `A_MEET_CARD_CANNOT_BE_READ_WITHOUT_ITS_UNIT` /
 * `A_BODYWEIGHT_CANNOT_BE_READ_WITHOUT_ITS_UNIT` assert the property that makes
 * a tag load-bearing, so a fourth number added here has one line to copy and a
 * failing assertion if it does not.
 *
 * THE BODYWEIGHT CARRIES ITS UNIT, and the field is `bodyweight` rather than
 * `bodyweightKg` because the old name was the whole defect: it was a bare
 * `number` with `Kg` in it and nothing behind the name, and 203.7 lb is a
 * perfectly ordinary kilogram bodyweight as far as every check downstream was
 * concerned (`DOTS_BODYWEIGHT_DOMAIN_KG` runs to 210). It was written straight
 * into `MeetResultWire` by `meetServer.ts`, three lines under a hard refusal of
 * a total whose unit could not be proven. A caller who took that refusal's own
 * named remedy — "convert the whole entry at the call site" — and converted only
 * the attempts passed the total's check cleanly and banked a 2.2x wrong
 * bodyweight.
 *
 * `BodyweightReading` is `dots.ts`'s and is a tagged pair rather than a brand
 * BECAUSE THIS IS A WIRE TYPE. A brand is erased by `JSON.stringify`, so a real
 * Edge Function would receive a bare number and would have proven nothing; a
 * `unit` field is the half of the check that survives the transport. See the
 * type's own comment for the rest of the argument.
 *
 * The union is deliberately WIDE here — `'lb'` is representable — because this
 * is what an untrusted client sends. `meetServer.ts` refuses the pound arm
 * (`UNSUPPORTED_MEET_UNIT`) before anything is written. Narrowing it to the
 * kilogram arm HERE would move the refusal to `tsc` on the client, which is the
 * half of the system this file exists because it does not trust.
 */
export interface MeetResultReport {
  readonly meetId: MeetId;
  readonly bodyweight: BodyweightReading;
  /**
   * THE ATTEMPTS, WITH THE UNIT THEY WERE LIFTED IN. This field was `attempts:
   * readonly MeetAttemptReport[]`, and it was the last bare-unit number on this
   * path — the one that actually becomes `record.totalKg`. See `MeetCardReport`.
   *
   * BOTH NUMBERS ON THIS REPORT NOW TRAVEL WITH THEIR UNIT, and they are still
   * two independent facts: a lifter can weigh in on one scale and lift on
   * another. `meetServer.ts` refuses each on its own terms and does not convert
   * either.
   */
  readonly card: MeetCardReport;
}

export const MEET_RESULT_REPORT_KEYS = ['meetId', 'bodyweight', 'card'] as const;

export const MEET_RESULT_REPORT_IS_EXACTLY_ITS_ALLOWLIST: KeysAreExactly<
  MeetResultReport,
  (typeof MEET_RESULT_REPORT_KEYS)[number]
> = true;

/**
 * A purchase to credit.
 *
 * NO `effect` FIELD, and the allowlist forbids one — see (c) in §5 of the
 * header. The server resolves the SKU against its own catalogue. A client that
 * cannot name an effect cannot name a forbidden one.
 */
export interface RedeemEntitlementReport {
  readonly sku: string;
  /** Store receipt, verified server-side. Opaque to this module. */
  readonly receipt: string;
}

export const REDEEM_ENTITLEMENT_REPORT_KEYS = ['sku', 'receipt'] as const;

export const REDEEM_ENTITLEMENT_REPORT_IS_EXACTLY_ITS_ALLOWLIST: KeysAreExactly<
  RedeemEntitlementReport,
  (typeof REDEEM_ENTITLEMENT_REPORT_KEYS)[number]
> = true;

/** Spending soft or premium currency. */
export interface SpendCurrencyReport {
  readonly currency: WalletCurrency;
  readonly amount: number;
  /** What it is being spent on. A SKU, resolved server-side. */
  readonly sku: string;
}

export const SPEND_CURRENCY_REPORT_KEYS = ['currency', 'amount', 'sku'] as const;

export const SPEND_CURRENCY_REPORT_IS_EXACTLY_ITS_ALLOWLIST: KeysAreExactly<
  SpendCurrencyReport,
  (typeof SPEND_CURRENCY_REPORT_KEYS)[number]
> = true;

/** Everything the client may ask the server to change. */
export type ProgressionProposal =
  | { readonly kind: 'record-training-session'; readonly report: TrainingSessionReport }
  | { readonly kind: 'set-recovery-day-protection'; readonly report: SetRecoveryDayProtectionReport }
  | { readonly kind: 'record-meet-result'; readonly report: MeetResultReport }
  | { readonly kind: 'redeem-entitlement'; readonly report: RedeemEntitlementReport }
  | { readonly kind: 'spend-currency'; readonly report: SpendCurrencyReport };

export const PROPOSAL_KINDS_ARE_EXACTLY_THE_ALLOWLIST: UnionIsExactly<
  ProgressionProposal['kind'],
  ProgressionProposalKind
> = true;

/**
 * One member of the union, by kind. For a caller that knows which proposal it is
 * building — which is every caller that also wants to project something, since
 * `proposeChange` binds the projection to the kind (§4.1 of the header).
 *
 * NOT usable as `proposeChange`'s parameter type: it is a conditional type and
 * `tsc` will not infer `K` from one. It is here for annotating the values that
 * get passed in.
 */
export type ProposalOfKind<K extends ProgressionProposalKind> = Extract<
  ProgressionProposal,
  { readonly kind: K }
>;

/**
 * WHICH FACTS THE SERVER MAY MOVE IN RESPONSE TO EACH PROPOSAL.
 *
 * A declaration, not an enforcement — see §6 of the header. Its teeth are the
 * assertions below it and the runtime table `factsMovedBy`, which is typed
 * against it: the table cannot list a fact the map does not allow, and widening
 * the map to allow one fails the disjointness assertion.
 *
 * THESE STRINGS ARE FACT NAMES AND `PROPOSAL_REACH_NAMES_REAL_FACTS` BINDS THEM
 * TO THE REAL ONES. This map is the operand of the §12.3 disjointness check
 * below; written as free literals it would be bound to nothing, and a renamed
 * fact would leave a row here naming a field that no longer exists while the
 * check went on passing. See §5(b) of the header.
 *
 * `'totalKg'` APPEARS ON EXACTLY ONE ROW, AND IT IS NOT THE TRAINING ONE. A
 * training session moves `bestE1rmKg`; a meet moves `totalKg`. The row below
 * used to claim both, which contradicted the two places that define what a Total
 * is — `ConfirmedFacts.totalKg` ("best competition total on record, or `null`
 * before the first meet") and `dots.ts`'s `OfficialTotalKg` — and GDD §6.4,
 * "Total = sum of best successful attempt per lift". A number that does not
 * exist until the first meet and is by construction a competition result cannot
 * be moved by a Tuesday. GDD §2 has been corrected to match §6.4 rather than the
 * other way round, and §3.2 now records the consequence for the daily loop: the
 * number that moves after a session is e1RM, never Total.
 * `ONLY_A_MEET_RESULT_MOVES_TOTAL` below is what makes putting it back fail
 * `tsc` instead of just reading oddly.
 */
export interface ProposalReach {
  readonly 'record-training-session': 'bestE1rmKg' | 'streak' | 'wallet';
  readonly 'set-recovery-day-protection': 'streak';
  readonly 'record-meet-result': 'totalKg' | 'meets' | 'bestE1rmKg' | 'wallet';
  readonly 'redeem-entitlement': 'wallet' | 'streak';
  readonly 'spend-currency': 'wallet' | 'streak';
}

export const PROPOSAL_REACH_COVERS_EVERY_KIND: KeysAreExactly<
  ProposalReach,
  ProgressionProposalKind
> = true;

/**
 * AND THE VALUES ARE REAL FACTS, not just strings that look like them. Indexing
 * by the whole kind union covers every row at once, so a stale name anywhere in
 * the map fails here.
 *
 * This is the binding that makes `PURCHASES_CANNOT_REACH_PROTECTED_CONCERNS`
 * mean what it says. Without it, renaming a fact leaves this map naming the old
 * one, and the disjointness check keeps passing because two dead spellings
 * cannot collide — the failure mode `PROTECTED_CONCERNS_NAME_REAL_FACTS` already
 * closes on the other operand, and the one non-vacuity cannot see, because a
 * drifted union is still non-empty.
 *
 * It also subsumes `NOTHING_MOVES_TRAINING_PACE` at the type level, since
 * `'trainingPace'` is deliberately not a fact key: a reach that named it now
 * fails twice. That assertion stays, because it is the one that says out loud
 * WHICH promise is being kept, and a §12.3 line should fail by name.
 */
export const PROPOSAL_REACH_NAMES_REAL_FACTS: IsSubsetOf<
  ProposalReach[ProgressionProposalKind],
  ProgressionFactKey
> = true;

/**
 * The proposal kinds whose reach includes a given fact — the reach map read
 * column-wise instead of row-wise, so a question like "what can move Total?" is
 * asked of the map rather than answered by reading it.
 */
type KindsReaching<F extends ProgressionFactKey> = {
  [K in ProgressionProposalKind]: F extends ProposalReach[K] ? K : never;
}[ProgressionProposalKind];

/**
 * COMPILE-TIME ASSERTION (GDD §6.4, §2): A TOTAL IS SET AT A MEET AND NOWHERE
 * ELSE.
 *
 * `UnionIsExactly` rather than a subset check, deliberately — this has to fail
 * in BOTH directions, and a subset check only fails in one:
 *
 *   - WIDER. Add `'totalKg'` back to `'record-training-session'` (or to any
 *     future kind) and the left side gains a member. That is the regression this
 *     exists to stop: a training session cannot move a competition total.
 *   - NARROWER. Drop `'totalKg'` from `'record-meet-result'` and the left side
 *     empties. That is the failure a `not.toContain`-shaped guard passes for
 *     free, because a reach map that moves NOTHING satisfies every prohibition
 *     perfectly. A meet must still move the Total or the design has no way to
 *     set one at all.
 *
 * The right-hand side is a free literal, which is on purpose and is safe here:
 * renaming the kind fails this line loudly instead of leaving it stale, because
 * the left side is derived from `ProgressionProposalKind` and would no longer
 * match. Contrast the reach VALUES, which are bound to `ProgressionFactKey` by
 * `PROPOSAL_REACH_NAMES_REAL_FACTS` for exactly that reason.
 *
 * `progression.test.ts` re-checks the same claim at runtime against the reach
 * table, because this line is a type and `npm test` cannot see types.
 */
export const ONLY_A_MEET_RESULT_MOVES_TOTAL: UnionIsExactly<
  KindsReaching<'totalKg'>,
  'record-meet-result'
> = true;

// ---------------------------------------------------------------------------
// Provenance: which proposals money can originate (GDD §8.1, §12.3)
//
// THIS USED TO BE A HAND-WRITTEN LIST — `type PurchasableProposalKind =
// 'redeem-entitlement' | 'spend-currency'` — and that is the bug this block
// exists to close. A list is correct for the kinds someone remembered to write
// on it and blind to every kind added afterwards: a `'buy-total-boost'` proposal
// reaching `'totalKg'` compiled cleanly and passed the whole suite, because
// neither the assertion nor the test derived its subject from anything. It was
// verified to escape before this was written, not assumed to.
//
// So provenance is now DECLARED PER KIND and the purchasable set is DERIVED.
// Adding a proposal kind forces an origin for it (the map is exhaustive over
// `ProgressionProposalKind`); declaring that origin `'purchase'` puts the kind
// into `PurchasableProposalKind` automatically, and its reach is checked from
// then on whether or not anyone remembered this file existed.
// ---------------------------------------------------------------------------

/** Where a proposal comes from. `'purchase'` means money — real or in-app. */
export const PROPOSAL_ORIGIN_KINDS = ['earned', 'purchase'] as const;

export type ProposalOrigin = (typeof PROPOSAL_ORIGIN_KINDS)[number];

/**
 * THE ORIGIN OF EVERY PROPOSAL KIND. The one place provenance is written down.
 *
 * Exhaustive by construction: `satisfies Readonly<Record<ProgressionProposalKind,
 * ProposalOrigin>>` rejects a missing kind and an unknown one, and
 * `PROPOSAL_ORIGIN_COVERS_EVERY_KIND` pins the same thing again in case a future
 * edit drops the `satisfies`. Adding a proposal kind and forgetting this map was
 * mutation-tested: it fails here (TS1360, naming the missing kind), at
 * `PROPOSAL_ORIGIN_COVERS_EVERY_KIND`, and again at the derivation below.
 *
 * `as const` and the `satisfies` clause each keep the values at their literal
 * types on their own — checked, rather than assumed: dropping either one alone
 * still compiles and still derives correctly. Dropping BOTH widens the values to
 * `string`, which collapses `PurchasableProposalKind` to `never` and is caught by
 * `PURCHASABLE_KINDS_ARE_NOT_VACUOUS` and `MONEY_ON_THE_WIRE_IS_DECLARED_A_
 * PURCHASE`. So they are belt and braces for each other, not one load-bearing
 * incantation.
 *
 * ANSWER THE §8.1 QUESTION HERE. A new kind is `'earned'` only if no money — not
 * a store purchase, not a currency spend — can be what causes the client to send
 * it. If money can, it is `'purchase'`, and its row in `ProposalReach` above must
 * then stay clear of `PROTECTED_CONCERNS` or the compile fails.
 */
export const PROPOSAL_ORIGIN_BY_KIND = {
  'record-training-session': 'earned',
  'set-recovery-day-protection': 'earned',
  'record-meet-result': 'earned',
  'redeem-entitlement': 'purchase',
  'spend-currency': 'purchase',
} as const satisfies Readonly<Record<ProgressionProposalKind, ProposalOrigin>>;

export const PROPOSAL_ORIGIN_COVERS_EVERY_KIND: KeysAreExactly<
  typeof PROPOSAL_ORIGIN_BY_KIND,
  ProgressionProposalKind
> = true;

/**
 * The proposal kinds a purchase can originate — DERIVED from the map above, not
 * listed. There is no edit that adds a purchase-originated kind and leaves this
 * union behind, because this union is not a thing anyone can forget to edit.
 */
export type PurchasableProposalKind = {
  [K in ProgressionProposalKind]: (typeof PROPOSAL_ORIGIN_BY_KIND)[K] extends 'purchase' ? K : never;
}[ProgressionProposalKind];

/**
 * The same set, at runtime, for the tests and for any renderer that wants to
 * badge a purchase. Derived by walking `PROGRESSION_PROPOSAL_KINDS` and reading
 * the same map the type reads, so it is total over the kinds by construction.
 *
 * WHAT THE PREDICATE DOES AND DOES NOT PROVE: `tsc` cannot check a type
 * predicate's body against the conditional type it mirrors, so a *deliberately
 * wrong* predicate here would drift from `PurchasableProposalKind`. What it
 * cannot do is miss a new kind — it iterates the allowlist — and
 * `progression.test.ts` cross-checks the array against the map directly, so the
 * drift a compiler cannot see is the one a test does.
 */
function isPurchaseOriginated(kind: ProgressionProposalKind): kind is PurchasableProposalKind {
  return PROPOSAL_ORIGIN_BY_KIND[kind] === 'purchase';
}

export const PURCHASABLE_PROPOSAL_KINDS: readonly PurchasableProposalKind[] =
  PROGRESSION_PROPOSAL_KINDS.filter(isPurchaseOriginated);

/**
 * The other half of the derivation: a tag can be got wrong on purpose, so the
 * shape of the payload gets a vote too.
 *
 * These are the field names that mean a transaction. A report carrying one of
 * them is money on the wire — you cannot buy a thing without naming the thing
 * (`sku`), and you cannot pay for it without a store receipt or a currency. No
 * earned report carries any of them, and `progression.test.ts` checks both
 * directions of that against the real report allowlists — every exported one,
 * including the nested `TRAINING_SET_REPORT_KEYS`, `MEET_CARD_REPORT_KEYS` and
 * `MEET_ATTEMPT_REPORT_KEYS` that the type-level check below cannot reach.
 */
export const PURCHASE_EVIDENCE_KEYS = ['sku', 'receipt', 'currency'] as const;

type PurchaseEvidenceKey = (typeof PURCHASE_EVIDENCE_KEYS)[number];

type ReportFor<K extends ProgressionProposalKind> = Extract<ProgressionProposal, { readonly kind: K }>['report'];

/** The kinds whose report names money, read off the report types themselves. */
export type MoneyCarryingProposalKind = {
  [K in ProgressionProposalKind]: [Extract<keyof ReportFor<K>, PurchaseEvidenceKey>] extends [never] ? never : K;
}[ProgressionProposalKind];

/**
 * COMPILE-TIME ASSERTION: anything that carries money on the wire is declared a
 * purchase. This is what stops the origin map from being a formality. Tagging a
 * `{ kind: 'buy-total-boost'; report: { sku; receipt } }` as `'earned'` to duck
 * the reach check fails here instead — mutation-tested, and it is the only error
 * that mutant produces.
 *
 * THE DIAGNOSTIC IS UNHELPFUL AND THAT IS WORTH KNOWING BEFORE YOU HIT IT: like
 * every assertion in this file it reads `Type 'true' is not assignable to type
 * 'never'`, at this line, naming neither the kind nor the field that gave it
 * away. The line number is the whole message. That is the cost of doing this
 * with conditional types instead of a lint rule.
 *
 * It is a floor, not a decision procedure — see §6 of the header for the two
 * cases it does not see, one of which is that `keyof` stops at the top level of
 * the report and money can be nested one object deeper.
 */
export const MONEY_ON_THE_WIRE_IS_DECLARED_A_PURCHASE: IsSubsetOf<
  MoneyCarryingProposalKind,
  PurchasableProposalKind
> = true;

/**
 * The non-vacuity half of the assertion above: a subset assertion over an empty
 * set passes for free, so this fails if `PURCHASE_EVIDENCE_KEYS` is ever emptied,
 * renamed past the reports, or the report types stop naming money.
 */
export const MONEY_CARRYING_KINDS_ARE_NOT_VACUOUS: IsNonEmptyUnion<MoneyCarryingProposalKind> = true;

/** Everything any purchase-originated proposal may move. */
export type AnyPurchaseReach = ProposalReach[PurchasableProposalKind];

/**
 * COMPILE-TIME ASSERTION (GDD §8.1, §12.3). Add `'bestE1rmKg'` to
 * `'redeem-entitlement'` above and this line stops compiling — and so does
 * adding a NEW `'purchase'`-origin kind whose reach names a protected concern,
 * which is the part a hand-written union of kinds could not do.
 */
export const PURCHASES_CANNOT_REACH_PROTECTED_CONCERNS: AreDisjoint<
  AnyPurchaseReach,
  ProtectedConcern
> = true;

/** The non-vacuity half. See `ENTITLEMENT_REACH_IS_NOT_VACUOUS`. */
export const PURCHASE_REACH_IS_NOT_VACUOUS: IsNonEmptyUnion<AnyPurchaseReach> = true;

/**
 * And the non-vacuity half one level up, because the reach is now derived from a
 * derived set. If the origin map's values widen, or the conditional above is
 * mistyped, `PurchasableProposalKind` silently becomes `never` and every check
 * built on it passes over nothing. This fails instead.
 */
export const PURCHASABLE_KINDS_ARE_NOT_VACUOUS: IsNonEmptyUnion<PurchasableProposalKind> = true;

// `NOTHING_MOVES_TRAINING_PACE` used to sit here, asserting `AreDisjoint<
// ProposalReach[ProgressionProposalKind], 'trainingPace'>`. It could not fail:
// `PROPOSAL_REACH_NAMES_REAL_FACTS` already forces every reach value to be a
// `ProgressionFactKey` and `'trainingPace'` was deliberately not one, so the
// intersection was `never` regardless of what any row said. The promise it named
// is now held by `NO_FACT_MEANS_TRAINING_PACE`, up with the facts, where it can
// fail. §5(d) of the header has the argument.

/**
 * Which facts a proposal of this kind may move. Typed against `ProposalReach`,
 * so this table cannot name a fact the map does not permit.
 *
 * IT CAN STILL NAME FEWER. The element type is a union, not a tuple, so a row
 * that drops a fact the map allows compiles cleanly — which is why the runtime
 * half of `ONLY_A_MEET_RESULT_MOVES_TOTAL` in `progression.test.ts` checks that
 * `'record-meet-result'` still moves `'totalKg'` here, and not only that
 * `'record-training-session'` does not.
 */
const PROPOSAL_REACH_TABLE: { readonly [K in ProgressionProposalKind]: readonly ProposalReach[K][] } = {
  'record-training-session': ['bestE1rmKg', 'streak', 'wallet'],
  'set-recovery-day-protection': ['streak'],
  'record-meet-result': ['totalKg', 'meets', 'bestE1rmKg', 'wallet'],
  'redeem-entitlement': ['wallet', 'streak'],
  'spend-currency': ['wallet', 'streak'],
};

/** The facts a proposal of this kind is declared to move. */
export function factsMovedBy<K extends ProgressionProposalKind>(kind: K): readonly ProposalReach[K][] {
  return PROPOSAL_REACH_TABLE[kind];
}

// ---------------------------------------------------------------------------
// Errors and results
// ---------------------------------------------------------------------------

export type ProgressionErrorCode =
  /** The wire payload was malformed: wrong shape, bad number, impossible value. */
  | 'INVALID_SNAPSHOT'
  /** A snapshot older than the one already held. Out-of-order response. */
  | 'SNAPSHOT_BEHIND'
  /** Nothing has been read from the server yet; there is no truth to change. */
  | 'NO_CONFIRMED_TRUTH'
  /** `PROGRESSION_CACHE_POLICY.MAX_IN_FLIGHT_PROPOSALS` would be exceeded. */
  | 'PROPOSAL_ALREADY_IN_FLIGHT'
  /** No proposal in flight, or a different one, so there is nothing to resolve. */
  | 'NO_MATCHING_PROPOSAL'
  /** The cache is stale and `ACCEPT_PROPOSALS_WHILE_STALE` is off. */
  | 'CACHE_IS_STALE'
  /** The optimistic projection was malformed. */
  | 'INVALID_PROJECTION'
  /**
   * The projection claimed a fact this proposal kind cannot move — a training
   * session projecting a Total, say. The runtime half of §4.1; the compile-time
   * half is `ProjectionWithinReach`, and reaching this code means something got
   * past it (a cast, a JS caller, JSON).
   */
  | 'PROJECTION_EXCEEDS_REACH'
  /** The proposal's own payload was malformed. */
  | 'INVALID_PROPOSAL';

export interface ProgressionError {
  readonly code: ProgressionErrorCode;
  /** Plain language. Developer-facing; leaks no internals. */
  readonly message: string;
}

export type ProgressionResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ProgressionError };

function ok<T>(value: T): ProgressionResult<T> {
  return { ok: true, value };
}

function fail<T>(code: ProgressionErrorCode, message: string): ProgressionResult<T> {
  return { ok: false, error: { code, message } };
}

// ---------------------------------------------------------------------------
// The wire: the decoded JSON body of an Edge Function response
// ---------------------------------------------------------------------------

/**
 * `StreakState` as plain JSON.
 *
 * `STREAK_WIRE_MATCHES_THE_STREAK_ALLOWLIST` asserts these keys are exactly
 * `streak.ts`'s own `STREAK_FACT_KEYS`, so a new streak field cannot cross this
 * boundary without failing `tsc` here as well as passing the allowlist there.
 * That coupling is deliberate: two allowlists that agree are one boundary, and
 * two that drift are none.
 */
export interface StreakStateWire {
  readonly currentStreak: number;
  readonly longestStreak: number;
  readonly lastTrainedDay: number | null;
  readonly armedRecoveryDays: number | null;
  readonly recoveryDayBalance: number;
  readonly recoveryDayProtectionEnabled: boolean;
  readonly hasBankedFirstRecoveryDaySave: boolean;
}

export const STREAK_WIRE_MATCHES_THE_STREAK_ALLOWLIST: KeysAreExactly<
  StreakStateWire,
  StreakFactKey
> = true;

/** One stored meet result, as plain JSON. */
export interface MeetResultWire {
  readonly meetId: string;
  readonly meetDayIndex: number;
  readonly totalKg: number | null;
  readonly bestByLift: Readonly<Record<LiftKind, number | null>>;
  readonly bodyweightKg: number;
}

/**
 * The decoded body of a progression response.
 *
 * Plain numbers, because that is what JSON is. Turning them into `Confirmed`
 * ones is what `receiveProgressionSnapshot` is for, and it is the only place in
 * the codebase where that happens.
 */
export interface ProgressionSnapshotWire {
  readonly revision: number;
  readonly totalKg: number | null;
  readonly bestE1rmKg: Readonly<Record<LiftKind, number | null>>;
  readonly streak: StreakStateWire;
  readonly meets: readonly MeetResultWire[];
  readonly wallet: Readonly<Record<WalletCurrency, number>>;
  /**
   * The proposal this response settles, if any. `null` for a plain read or for
   * a change that originated elsewhere (another device, a scheduled job).
   */
  readonly acknowledgedProposalId: string | null;
}

// ---------------------------------------------------------------------------
// Server truth: opaque, and mintable in exactly one place
// ---------------------------------------------------------------------------

/**
 * The key the snapshot's contents actually live under. Module-private and a
 * symbol, so `ProgressionSnapshot` has no property a caller can name, spread
 * over, or overwrite.
 */
const SNAPSHOT_CONTENTS: unique symbol = Symbol('progression.snapshot');

interface SnapshotContents {
  readonly revision: ServerRevision;
  readonly facts: ConfirmedFacts;
  readonly acknowledgedProposalId: ProposalId | null;
}

/**
 * SERVER TRUTH. Opaque: exactly one property, under a key this module does not
 * export, so the only way to obtain one without a cast is `receiveProgression
 * Snapshot`. Read it with `snapshotFacts`, `snapshotRevision` and
 * `snapshotAcknowledges`.
 *
 * Why opaque rather than branded: see §2 of the header. A branded object can be
 * spread-and-overridden back into itself, which is the exact shape of an
 * optimistic update.
 */
export interface ProgressionSnapshot {
  readonly [SNAPSHOT_CONTENTS]: SnapshotContents;
}

/**
 * Recursively freezes a value this module just built. Walks symbol keys as well
 * as string ones — the snapshot's whole payload lives under a symbol, so a
 * string-only walk would freeze the shell and leave the facts writable.
 *
 * Freezing is not a side effect in the sense CLAUDE.md forbids: it touches only
 * objects this function's caller just constructed, never an input.
 */
function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  const keys: readonly (string | symbol)[] = [
    ...Object.getOwnPropertyNames(value),
    ...Object.getOwnPropertySymbols(value),
  ];
  for (const key of keys) {
    deepFreeze((value as Record<string | symbol, unknown>)[key]);
  }
  return Object.freeze(value);
}

function contents(snapshot: ProgressionSnapshot): SnapshotContents {
  return snapshot[SNAPSHOT_CONTENTS];
}

/** The revision this snapshot carries. */
export function snapshotRevision(snapshot: ProgressionSnapshot): ServerRevision {
  return contents(snapshot).revision;
}

/**
 * The facts. Deeply frozen at mint, so the object handed back cannot be edited
 * through — the reason `meet.ts` copies its rules on the way out, achieved once
 * instead of on every read.
 */
export function snapshotFacts(snapshot: ProgressionSnapshot): ConfirmedFacts {
  return contents(snapshot).facts;
}

/** Whether this snapshot settles the given proposal. */
export function snapshotAcknowledges(snapshot: ProgressionSnapshot, proposalId: ProposalId): boolean {
  return contents(snapshot).acknowledgedProposalId === proposalId;
}

function isFiniteWeight(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function isCount(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function decodeStreak(wire: StreakStateWire): ProgressionResult<StreakState> {
  const counts: readonly [string, number][] = [
    ['currentStreak', wire.currentStreak],
    ['longestStreak', wire.longestStreak],
    ['recoveryDayBalance', wire.recoveryDayBalance],
  ];
  for (const [name, value] of counts) {
    if (!isCount(value)) {
      return fail('INVALID_SNAPSHOT', `progression: streak.${name} must be a non-negative whole number`);
    }
  }
  if (wire.longestStreak < wire.currentStreak) {
    return fail('INVALID_SNAPSHOT', 'progression: streak.longestStreak cannot be below streak.currentStreak');
  }
  const flags: readonly [string, boolean][] = [
    ['recoveryDayProtectionEnabled', wire.recoveryDayProtectionEnabled],
    ['hasBankedFirstRecoveryDaySave', wire.hasBankedFirstRecoveryDaySave],
  ];
  for (const [name, value] of flags) {
    if (typeof value !== 'boolean') {
      return fail('INVALID_SNAPSHOT', `progression: streak.${name} must be a boolean`);
    }
  }
  if (wire.lastTrainedDay !== null && !Number.isSafeInteger(wire.lastTrainedDay)) {
    return fail('INVALID_SNAPSHOT', 'progression: streak.lastTrainedDay must be a whole day index or null');
  }
  // The armed count is a COUNT that may be absent, not a day index: `null` means
  // "no Recovery Day protection armed for the absence in progress" (GDD §4.2's
  // settings toggle), which is not the same as zero armed.
  if (wire.armedRecoveryDays !== null && !isCount(wire.armedRecoveryDays)) {
    return fail(
      'INVALID_SNAPSHOT',
      'progression: streak.armedRecoveryDays must be a non-negative whole number or null',
    );
  }
  if (wire.armedRecoveryDays !== null && wire.armedRecoveryDays > wire.recoveryDayBalance) {
    return fail(
      'INVALID_SNAPSHOT',
      'progression: streak.armedRecoveryDays cannot exceed streak.recoveryDayBalance',
    );
  }
  const lastTrainedDay: StreakDay | null = wire.lastTrainedDay === null ? null : asStreakDay(wire.lastTrainedDay);
  return ok({
    currentStreak: wire.currentStreak,
    longestStreak: wire.longestStreak,
    lastTrainedDay,
    armedRecoveryDays: wire.armedRecoveryDays,
    recoveryDayBalance: wire.recoveryDayBalance,
    recoveryDayProtectionEnabled: wire.recoveryDayProtectionEnabled,
    hasBankedFirstRecoveryDaySave: wire.hasBankedFirstRecoveryDaySave,
  });
}

function decodeBestByLift(
  wire: Readonly<Record<LiftKind, number | null>>,
  where: string,
): ProgressionResult<Readonly<Record<LiftKind, ConfirmedKg | null>>> {
  const out: Partial<Record<LiftKind, ConfirmedKg | null>> = {};
  for (const lift of LIFT_ORDER) {
    const value = wire[lift];
    if (value === null) {
      out[lift] = null;
      continue;
    }
    if (!isFiniteWeight(value)) {
      return fail('INVALID_SNAPSHOT', `progression: ${where}.${lift} must be a positive number or null`);
    }
    out[lift] = confirm(value);
  }
  return ok(out as Record<LiftKind, ConfirmedKg | null>);
}

function decodeMeet(wire: MeetResultWire, index: number): ProgressionResult<ConfirmedMeetResult> {
  if (wire.meetId.trim().length === 0) {
    return fail('INVALID_SNAPSHOT', `progression: meets[${index}].meetId must not be blank`);
  }
  if (!Number.isSafeInteger(wire.meetDayIndex)) {
    return fail('INVALID_SNAPSHOT', `progression: meets[${index}].meetDayIndex must be a whole day index`);
  }
  if (!isFiniteWeight(wire.bodyweightKg)) {
    return fail('INVALID_SNAPSHOT', `progression: meets[${index}].bodyweightKg must be a positive number`);
  }
  if (wire.totalKg !== null && !isFiniteWeight(wire.totalKg)) {
    return fail(
      'INVALID_SNAPSHOT',
      `progression: meets[${index}].totalKg must be a positive number or null — a bomb-out is null, not zero`,
    );
  }
  const bests = decodeBestByLift(wire.bestByLift, `meets[${index}].bestByLift`);
  if (!bests.ok) {
    return bests;
  }
  return ok({
    meetId: asMeetId(wire.meetId),
    meetDayIndex: wire.meetDayIndex,
    totalKg: wire.totalKg === null ? null : (confirm(wire.totalKg) as ConfirmedTotalKg),
    bestByLift: bests.value,
    bodyweightKg: confirm(wire.bodyweightKg),
  });
}

/**
 * THE ONE DOOR. Turns a decoded Edge Function response into server truth.
 *
 * This is the only ENTRY POINT in the codebase that yields a `Confirmed` number
 * or a `ProgressionSnapshot`. `confirm()` is called from the two private
 * decoders as well as from here, and they are reachable only through this
 * function; the `ProgressionSnapshot` itself is constructed once, below.
 * Nothing outside can do either, and that is enforced by the private symbols
 * rather than by convention. Test fixtures go through it too — one door means
 * one door.
 *
 * WHAT IT CANNOT CHECK, per §6 of the header: that the JSON came off a wire.
 * Nothing in a type system can. What it buys is that the claim is a single
 * greppable call whose name is the assertion.
 */
export function receiveProgressionSnapshot(
  wire: ProgressionSnapshotWire,
): ProgressionResult<ProgressionSnapshot> {
  if (!Number.isSafeInteger(wire.revision) || wire.revision < 0) {
    return fail('INVALID_SNAPSHOT', `progression: revision must be a non-negative whole number, received ${wire.revision}`);
  }
  if (wire.totalKg !== null && !isFiniteWeight(wire.totalKg)) {
    return fail('INVALID_SNAPSHOT', 'progression: totalKg must be a positive number or null');
  }
  const bests = decodeBestByLift(wire.bestE1rmKg, 'bestE1rmKg');
  if (!bests.ok) {
    return bests;
  }
  const streak = decodeStreak(wire.streak);
  if (!streak.ok) {
    return streak;
  }
  const meets: ConfirmedMeetResult[] = [];
  for (let index = 0; index < wire.meets.length; index += 1) {
    const meetWire = wire.meets[index];
    if (meetWire === undefined) {
      return fail('INVALID_SNAPSHOT', `progression: meets[${index}] is missing`);
    }
    const decoded = decodeMeet(meetWire, index);
    if (!decoded.ok) {
      return decoded;
    }
    meets.push(decoded.value);
  }
  const wallet: Partial<Record<WalletCurrency, ConfirmedCount>> = {};
  for (const currency of WALLET_CURRENCIES) {
    const balance = wire.wallet[currency];
    if (!isCount(balance)) {
      return fail('INVALID_SNAPSHOT', `progression: wallet.${currency} must be a non-negative whole number`);
    }
    wallet[currency] = confirm(balance);
  }
  if (wire.acknowledgedProposalId !== null && wire.acknowledgedProposalId.trim().length === 0) {
    return fail('INVALID_SNAPSHOT', 'progression: acknowledgedProposalId must be a non-blank id or null');
  }

  const facts: ConfirmedFacts = {
    totalKg: wire.totalKg === null ? null : (confirm(wire.totalKg) as ConfirmedTotalKg),
    bestE1rmKg: bests.value,
    streak: streak.value,
    meets,
    wallet: wallet as ConfirmedWallet,
  };
  const snapshot: ProgressionSnapshot = {
    [SNAPSHOT_CONTENTS]: {
      revision: asServerRevision(wire.revision),
      facts,
      acknowledgedProposalId:
        wire.acknowledgedProposalId === null ? null : asProposalId(wire.acknowledgedProposalId),
    },
  };
  return ok(deepFreeze(snapshot));
}

// ---------------------------------------------------------------------------
// Projections: the optimistic view, kept beside truth and never merged into it
// ---------------------------------------------------------------------------

/** A locally projected streak. Not a `StreakState` and not assignable to one. */
export interface ProjectedStreak {
  readonly currentStreak: ProjectedCount;
}

/**
 * What the client believes a proposal will do, for optimistic display.
 *
 * Every field is nullable, and `null` means "no local projection — render the
 * confirmed value". There is deliberately no `meets` field: a meet result is
 * never optimistic. `PROJECTION_ONLY_MIRRORS_REAL_FACTS` keeps these keys a
 * subset of `PROGRESSION_FACT_KEYS`, so a projection cannot invent a fact the
 * server does not have.
 */
export interface ProgressionProjection {
  readonly totalKg: ProjectedKg | null;
  readonly bestE1rmKg: Readonly<Record<LiftKind, ProjectedKg | null>>;
  readonly streak: ProjectedStreak | null;
  readonly wallet: Readonly<Record<WalletCurrency, ProjectedCount | null>>;
}

export const PROJECTION_KEYS = ['totalKg', 'bestE1rmKg', 'streak', 'wallet'] as const;

export type ProjectionKey = (typeof PROJECTION_KEYS)[number];

export const PROJECTION_IS_EXACTLY_ITS_ALLOWLIST: KeysAreExactly<
  ProgressionProjection,
  ProjectionKey
> = true;

export const PROJECTION_ONLY_MIRRORS_REAL_FACTS: IsSubsetOf<ProjectionKey, ProgressionFactKey> = true;

// ---------------------------------------------------------------------------
// A projection may only claim what its proposal can move (GDD §2, §3.2, §6.4).
// See §4.1 of the header for why this is the ruling applied rather than a
// separate design decision.
// ---------------------------------------------------------------------------

/**
 * A `ProgressionProjection` with every claim taken out of it: each field is
 * `null`, or a record whose every entry is `null`.
 *
 * This is the shape a projection field takes when the proposing kind may not
 * move the fact behind it, and it is also `emptyProjection`'s return type — one
 * type rather than two, so "claims nothing" means the same thing in both places.
 */
export interface UnclaimedProjection {
  readonly totalKg: null;
  readonly bestE1rmKg: Readonly<Record<LiftKind, null>>;
  readonly streak: null;
  readonly wallet: Readonly<Record<WalletCurrency, null>>;
}

/** A new projectable fact has to get an unclaimed shape too, or this fails. */
export const UNCLAIMED_PROJECTION_IS_EXACTLY_ITS_ALLOWLIST: KeysAreExactly<
  UnclaimedProjection,
  ProjectionKey
> = true;

/**
 * And claiming nothing is a legal projection: `emptyProjection()` has to keep
 * fitting everywhere a `ProgressionProjection` is wanted, including
 * `InFlightProposal`.
 */
export const AN_UNCLAIMED_PROJECTION_IS_A_PROJECTION: IsSubtypeOf<
  UnclaimedProjection,
  ProgressionProjection
> = true;

/**
 * `true` when EVERY kind in `K` may move `F`.
 *
 * `K` is a union when the caller has not narrowed its proposal, and the
 * intersection is the sound reading of that case: a dispatcher holding a bare
 * `ProgressionProposal` does not know which kind it has, so it does not know
 * what it may claim. `Exclude` over the tuple-wrapped union is the whole
 * mechanism — for a single kind it is plain membership.
 */
type EveryKindReaches<K extends ProgressionProposalKind, F extends ProgressionFactKey> = [
  Exclude<K, KindsReaching<F>>,
] extends [never]
  ? true
  : false;

/**
 * THE PROJECTION A PROPOSAL OF KIND `K` IS ALLOWED TO CARRY. Fields whose fact
 * is inside `ProposalReach[K]` keep their full type; the rest are narrowed to
 * their unclaimed shape, so a number cannot be put in them.
 *
 * This is the type that makes GDD §3.2's "the number that moves at the close-out
 * is e1RM, never Total" a compile error rather than a note: a projection
 * carrying `totalKg` does not fit a `record-training-session`.
 */
export type ProjectionWithinReach<K extends ProgressionProposalKind> = {
  readonly [F in ProjectionKey]: EveryKindReaches<K, F> extends true
    ? ProgressionProjection[F]
    : UnclaimedProjection[F];
};

/**
 * The facts a projection paired with `K` can actually put a number on — read
 * off `ProjectionWithinReach` itself rather than off the reach map, so the two
 * assertions below are about the MECHANISM and not a restatement of the map.
 *
 * A field counts as claimable when the within-reach version still admits
 * everything `ProgressionProjection` admits. Written that way rather than as
 * `... extends UnclaimedProjection[F]` on purpose: widening a field of
 * `UnclaimedProjection` back to `ProjectedKg | null` would satisfy the
 * `UnclaimedProjection`-relative form while quietly reopening the hole, and
 * fails this one.
 */
type ClaimableBy<K extends ProgressionProposalKind> = {
  [F in ProjectionKey]: [ProgressionProjection[F]] extends [ProjectionWithinReach<K>[F]] ? F : never;
}[ProjectionKey];

/**
 * COMPILE-TIME ASSERTION (GDD §3.2): A TRAINING SESSION CANNOT PROJECT A TOTAL.
 *
 * The optimistic half of `ONLY_A_MEET_RESULT_MOVES_TOTAL`, and the reason this
 * file has two assertions about Totals rather than one: that one governs what
 * the server is asked to move, this one governs what the screen is allowed to
 * show while it waits. A session's close-out beat can put an e1RM, a streak or a
 * balance on screen optimistically. It cannot put a Total there.
 */
export const A_TRAINING_SESSION_PROJECTION_CANNOT_CLAIM_A_TOTAL: UnionIsExactly<
  ClaimableBy<'record-training-session'>,
  'bestE1rmKg' | 'streak' | 'wallet'
> = true;

/**
 * COMPILE-TIME ASSERTION, AND THE POSITIVE CONTROL FOR THE ONE ABOVE. A guard
 * that narrows every field of every kind refuses the forbidden pairing
 * perfectly and also makes meet day unrenderable, so the prohibition alone is
 * satisfied better by a worse artifact. A meet result must still be able to
 * project the Total it just made.
 *
 * `'meets'` is absent because it is not a projection key at all — a meet result
 * is server truth or it is not shown (see `readMeets`).
 */
export const A_MEET_RESULT_PROJECTION_CAN_CLAIM_A_TOTAL: UnionIsExactly<
  ClaimableBy<'record-meet-result'>,
  'totalKg' | 'bestE1rmKg' | 'wallet'
> = true;

/** A projection that claims nothing. The base every projection is built from. */
export function emptyProjection(): UnclaimedProjection {
  return {
    totalKg: null,
    bestE1rmKg: { squat: null, bench: null, deadlift: null },
    streak: null,
    wallet: { gymBucks: null, chalk: null },
  };
}

function validateProjection(projection: ProgressionProjection): ProgressionError | null {
  if (projection.totalKg !== null && !isFiniteWeight(projection.totalKg)) {
    return { code: 'INVALID_PROJECTION', message: 'progression: a projected total must be finite and positive' };
  }
  for (const lift of LIFT_ORDER) {
    const value = projection.bestE1rmKg[lift];
    if (value !== null && !isFiniteWeight(value)) {
      return {
        code: 'INVALID_PROJECTION',
        message: `progression: a projected e1RM must be finite and positive (${lift})`,
      };
    }
  }
  if (projection.streak !== null && !isCount(projection.streak.currentStreak)) {
    return { code: 'INVALID_PROJECTION', message: 'progression: a projected streak must be a whole day count' };
  }
  for (const currency of WALLET_CURRENCIES) {
    const value = projection.wallet[currency];
    if (value !== null && !isCount(value)) {
      return {
        code: 'INVALID_PROJECTION',
        message: `progression: a projected balance must be a whole number (${currency})`,
      };
    }
  }
  return null;
}

/**
 * WHAT COUNTS AS CLAIMING A FACT, one row per projectable fact. `null`
 * everywhere means "render the confirmed value", so a `null` field claims
 * nothing; a record claims its fact if any single entry is non-`null`, because
 * reach is declared per fact and not per lift or per currency.
 *
 * A map rather than a chain of `if`s so that it is exhaustive: a new field on
 * `ProgressionProjection` widens `ProjectionKey` and fails `tsc` here, instead
 * of quietly becoming a fact the reach check below cannot see.
 */
const PROJECTION_CLAIMS: Readonly<Record<ProjectionKey, (projection: ProgressionProjection) => boolean>> = {
  totalKg: (projection) => projection.totalKg !== null,
  bestE1rmKg: (projection) => LIFT_ORDER.some((lift) => projection.bestE1rmKg[lift] !== null),
  streak: (projection) => projection.streak !== null,
  wallet: (projection) => WALLET_CURRENCIES.some((currency) => projection.wallet[currency] !== null),
};

/** The facts this projection puts a number on. */
function factsClaimedBy(projection: ProgressionProjection): readonly ProjectionKey[] {
  return PROJECTION_KEYS.filter((fact) => PROJECTION_CLAIMS[fact](projection));
}

/**
 * THE RUNTIME HALF OF §4.1. A projection cannot claim a fact the proposing kind
 * is not declared to move.
 *
 * `ProjectionWithinReach` already makes this a compile error, so in typed code
 * this never fires. It exists because types are erased: a cast, a JS caller or a
 * projection rebuilt from stored JSON all reach this function, and because a
 * type-level assertion is invisible to `npm test`.
 *
 * Reads `factsMovedBy` — i.e. `PROPOSAL_REACH_TABLE`, which is typed against
 * `ProposalReach` and may name fewer facts than the map allows but never more.
 * So this refusal is never laxer than the compile-time one.
 */
function projectionExceedsReach(
  proposal: ProgressionProposal,
  projection: ProgressionProjection,
): ProgressionError | null {
  const reach: readonly string[] = factsMovedBy(proposal.kind);
  for (const fact of factsClaimedBy(projection)) {
    if (!reach.includes(fact)) {
      return {
        code: 'PROJECTION_EXCEEDS_REACH',
        message: `progression: a ${proposal.kind} proposal does not move ${fact}, so its projection may not claim one`,
      };
    }
  }
  return null;
}

/**
 * The rows under a card's declared arm, or `null` when the tag has nothing —
 * or something that is not a list — under it.
 *
 * A FUNCTION RATHER THAN AN INLINE `Array.isArray`, AND THE RETURN TYPE IS THE
 * WHOLE POINT. `Array.isArray` is declared `(arg: unknown) => arg is any[]`, so
 * it narrows a `readonly T[] | undefined` to `any[]` — the narrow LOSES the
 * element type. Written inline, the only thing putting the type back was an
 * annotation on the `const`, and deleting an annotation is the exact shape of a
 * tidy-up: it compiles, every test stays green, and an `any` is loose in the two
 * modules whose whole job is not trusting their input. CLAUDE.md bans `any`
 * outright and nothing was enforcing it here.
 *
 * With the check behind a signature, the repair is the RETURN TYPE, which cannot
 * be deleted — removing it makes `tsc` infer from the body and every call site
 * that iterates typed rows fails. `A_DECLARED_ROW_IS_NEVER_ANY` below pins the
 * remaining edit (widening the signature itself) as a compile error too.
 *
 * `readonly T[] | undefined` rather than `unknown` on purpose: typed callers get
 * an ordinary narrow and only untyped JSON reaches the runtime branch.
 *
 * EXPORTED SO THERE IS ONE OF IT. The same three lines were written inline in
 * this file and again in `meetServer.ts`, each with its own annotation holding
 * the type on; three copies of a mitigation is three chances to tidy one away.
 * The two servers import this instead.
 */
export function declaredRows<T>(declared: readonly T[] | undefined): readonly T[] | null {
  return Array.isArray(declared) ? declared : null;
}

/** The rows a `MeetCardReport` arm yields, as `declaredRows` hands them back. */
type DeclaredAttemptRows = NonNullable<ReturnType<typeof declaredRows<MeetAttemptReport>>>[number];

/** The rows a `TrainingCardReport` arm yields, likewise. */
type DeclaredSetRows = NonNullable<ReturnType<typeof declaredRows<TrainingSetReport>>>[number];

/**
 * COMPILE-TIME ASSERTION: `declaredRows` HANDS BACK TYPED ROWS, NOT `any`.
 *
 * The mitigation above is only worth something while its signature says what it
 * says. Widen the return to `any[] | null` — or drop it and let the body's
 * `Array.isArray` narrow decide — and this line stops compiling, because
 * `IsNotAny` is `never` for `any` and `true` for everything else. Both readings
 * are asserted rather than one, so a helper that was fixed for the meet card and
 * loosened for the training card fails here.
 */
export const A_DECLARED_ROW_IS_NEVER_ANY: IsNotAny<DeclaredAttemptRows> &
  IsNotAny<DeclaredSetRows> = true;

function validateProposal(proposal: ProgressionProposal): ProgressionError | null {
  switch (proposal.kind) {
    case 'record-training-session': {
      // THE CARD'S UNIT, CHECKED BY VALUE, exactly as the meet card's is below:
      // `TrainingCardReport` is two literals to `tsc` and whatever the sender
      // wrote once it has been through JSON. An unrecognised unit has no arm, so
      // there is no list to read and nothing to validate — refused rather than
      // assumed to be kilograms.
      //
      // THE ARM IS READ THROUGH THE NARROW, never through a shared field, which
      // is why there is no `sets` on `TrainingCardReport` to reach for.
      // `| undefined` because a request body can simply omit the field, and
      // reading `.unit` off nothing throws where it should refuse.
      const card: TrainingCardReport | undefined = proposal.report.card;
      const declared =
        card === undefined
          ? null
          : card.unit === 'kg'
            ? card.kilogramSets
            : card.unit === 'lb'
              ? card.poundSets
              : null;
      if (declared === null) {
        return {
          code: 'INVALID_PROPOSAL',
          message:
            'progression: a reported session must say which unit it was lifted in, not ' +
            JSON.stringify(card?.unit),
        };
      }
      // SHAPE, NOT POLICY. Whether the declared unit is one permanent
      // progression can store is `sessionServer.ts`'s refusal
      // (`UNSUPPORTED_SESSION_UNIT`), because that is where the write happens
      // and a refusal upstream of the write would have to be repeated there
      // anyway. The same division the meet card gets.
      const sets = declaredRows(declared);
      if (sets === null || sets.length === 0) {
        return { code: 'INVALID_PROPOSAL', message: 'progression: a training session must report at least one set' };
      }
      for (const set of sets) {
        if (!isFiniteWeight(set.weight)) {
          return { code: 'INVALID_PROPOSAL', message: 'progression: a reported set weight must be finite and positive' };
        }
        if (!Number.isSafeInteger(set.reps) || set.reps < 1) {
          return { code: 'INVALID_PROPOSAL', message: 'progression: a reported set must have at least one rep' };
        }
        if (!Number.isFinite(set.rpe)) {
          return { code: 'INVALID_PROPOSAL', message: 'progression: a reported RPE must be a finite number' };
        }
      }
      return null;
    }
    case 'set-recovery-day-protection': {
      if (typeof proposal.report.protectionEnabled !== 'boolean') {
        return {
          code: 'INVALID_PROPOSAL',
          message: 'progression: Recovery Day protection must be set to true or false',
        };
      }
      return null;
    }
    case 'record-meet-result': {
      // THE CARD'S UNIT, CHECKED BY VALUE, for the same reason the bodyweight's
      // is below: `MeetCardReport` is two literals to `tsc` and whatever the
      // sender wrote once it has been through JSON. An unrecognised unit has no
      // arm, so there is no array to read and nothing to validate — refused
      // rather than assumed to be kilograms.
      //
      // THE ARM IS READ THROUGH THE NARROW, never through a shared field, which
      // is why there is no `attempts` on `MeetCardReport` to reach for.
      // `| undefined` because a request body can simply omit the field, and
      // reading `.unit` off nothing throws where it should refuse.
      const card: MeetCardReport | undefined = proposal.report.card;
      const declared =
        card === undefined
          ? null
          : card.unit === 'kg'
            ? card.kilogramAttempts
            : card.unit === 'lb'
              ? card.poundAttempts
              : null;
      if (declared === null) {
        return {
          code: 'INVALID_PROPOSAL',
          message:
            'progression: a reported card must say which unit it was lifted in, not ' +
            JSON.stringify(card?.unit),
        };
      }
      // A TAG WITH NOTHING UNDER IT. `{ "unit": "kg" }` narrows perfectly and
      // yields `undefined`; `{ "unit": "kg", "poundAttempts": [...] }` names the
      // wrong arm and yields the same. Both are a declared unit attached to no
      // numbers, which is not a card.
      //
      // `declaredRows` rather than an inline `Array.isArray` bound to an
      // annotation: the annotation was what kept the rows typed, and deleting an
      // annotation is a silent tidy-up. See the helper.
      const attempts = declaredRows(declared);
      if (attempts === null || attempts.length === 0) {
        return { code: 'INVALID_PROPOSAL', message: 'progression: a meet result must report at least one attempt' };
      }
      // SHAPE, NOT POLICY. This validates that the bodyweight is a usable
      // number in a unit this codebase has a name for; whether that unit is one
      // permanent progression can store is `meetServer.ts`'s refusal
      // (`UNSUPPORTED_MEET_UNIT`), because that is where the write happens and a
      // refusal upstream of the write would have to be repeated there anyway.
      //
      // THE UNIT IS CHECKED BY VALUE, not by type. `BodyweightReading` is a
      // union of two literals to `tsc`, but a proposal can arrive from JSON, or
      // through a cast, and then `unit` is whatever the sender wrote. An unknown
      // unit is refused rather than assumed: the fail-safe direction, the same
      // one `dots.ts` gives for typing `MeetTotalReading.unit` as `string`.
      const bodyweight = proposal.report.bodyweight;
      const reported =
        bodyweight.unit === 'kg'
          ? bodyweight.kilograms
          : bodyweight.unit === 'lb'
            ? bodyweight.pounds
            : null;
      if (reported === null) {
        return {
          code: 'INVALID_PROPOSAL',
          message:
            'progression: a reported bodyweight must say which unit it was weighed in, not ' +
            JSON.stringify(bodyweight.unit),
        };
      }
      if (!isFiniteWeight(reported)) {
        return { code: 'INVALID_PROPOSAL', message: 'progression: a reported bodyweight must be finite and positive' };
      }
      for (const attempt of attempts) {
        if (!isFiniteWeight(attempt.weight)) {
          return { code: 'INVALID_PROPOSAL', message: 'progression: a reported attempt weight must be finite and positive' };
        }
      }
      return null;
    }
    case 'redeem-entitlement': {
      if (proposal.report.sku.trim().length === 0 || proposal.report.receipt.trim().length === 0) {
        return { code: 'INVALID_PROPOSAL', message: 'progression: a redemption needs a SKU and a receipt' };
      }
      return null;
    }
    case 'spend-currency': {
      if (!Number.isSafeInteger(proposal.report.amount) || proposal.report.amount < 1) {
        return { code: 'INVALID_PROPOSAL', message: 'progression: a spend must be at least one unit' };
      }
      if (proposal.report.sku.trim().length === 0) {
        return { code: 'INVALID_PROPOSAL', message: 'progression: a spend needs a SKU' };
      }
      return null;
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// The cache
// ---------------------------------------------------------------------------

/** Why the cache stopped trusting itself. Never computed from a clock. */
export type StaleReason =
  /** The transport reconnected; anything could have happened while it was down. */
  | 'reconnected'
  /** A proposal came back rejected; the projection was discarded. */
  | 'proposal-rejected'
  /** The server reported a revision we have not fetched. */
  | 'server-revision-ahead'
  /** The same account is live on another device. */
  | 'signed-in-elsewhere';

/**
 * The key the checked pairing's contents actually live under. Module-private and
 * a symbol, so `InFlightProposal` has no property a caller can name, spread
 * over, or overwrite — the `SNAPSHOT_CONTENTS` idiom from §2 of the header,
 * applied at the same strength rather than half-applied.
 */
const PAIRING_CHECKED: unique symbol = Symbol('progression.pairing-checked');

/**
 * The triple `proposeChange` checked, welded together. Not exported and not
 * reachable without the symbol, so the three checks that are properties of this
 * triple — `validateProposal`, `validateProjection`, `projectionExceedsReach` —
 * cannot be undone by swapping one member out.
 */
interface CheckedPairing {
  readonly proposalId: ProposalId;
  readonly proposal: ProgressionProposal;
  readonly projection: ProgressionProjection;
}

/**
 * One proposal, in flight, with the optimistic view it justifies.
 *
 * OPAQUE: exactly one property, under a key this module does not export. Read it
 * with `inFlightProposal`, which hands back an `InFlightProposalView` rather
 * than this.
 *
 * WHY OPAQUE RATHER THAN BRANDED — and this is the second time this file has had
 * to learn it, so it is written down twice. The previous shape was
 * `{ proposalId; proposal; projection; [PAIRING_CHECKED]: true }`: a partly
 * transparent object with a symbol bolted on. §2 of the header says an object
 * brand survives a spread, and it does. `{ ...anInFlightProposal, projection:
 * somethingElse }` typechecked, cast-free, and put a projected Total on a
 * training session — the exact shape GDD §3.2 forbids. See §6 of the header for
 * the reproduction and for what is and is not closed now.
 *
 * WHAT THIS DOES NOT SAY: that a value of this type cannot be produced outside
 * the module. `const loose = { ...real, junk }` still produces one, because
 * spread copies the symbol. What it says is that the extra fields are INERT —
 * every reader goes through `pairing()`, so nothing a spread adds is ever
 * looked at. That is the guarantee §2 promises, and it is the one worth making.
 */
export interface InFlightProposal {
  readonly [PAIRING_CHECKED]: CheckedPairing;
}

/**
 * COMPILE-TIME ASSERTION: `InFlightProposal` HAS NO STRING-KEYED PROPERTY.
 *
 * This is the property that closes the forgery in §6, stated as the compiler can
 * check it rather than left to whoever reads the interface next. A spread copies
 * symbols, so `{ ...real, x }` will always produce something of this type; what
 * makes the tamper inert is that there is no string key on it for `x` to BE. Put
 * `projection` back as a plain field and this fails here, at the declaration,
 * instead of silently reopening a projected Total on a Tuesday.
 *
 * `Extract<keyof T, string>` rather than `keyof T`, because the symbol is a legal
 * and required key — it is the string side that must be empty.
 */
export const AN_IN_FLIGHT_PROPOSAL_HAS_NO_STRING_KEY: IsEmptyUnion<
  Extract<keyof InFlightProposal, string>
> = true;

/**
 * What a caller gets to see of an in-flight proposal: the contents, not the
 * container.
 *
 * Deliberately NOT an `InFlightProposal` — it carries no symbol, so it cannot be
 * put back into a `pending` cache. A one-way valve, the same shape as
 * `snapshotFacts` handing out `ConfirmedFacts` that no exported function accepts.
 */
export interface InFlightProposalView {
  readonly proposalId: ProposalId;
  readonly proposal: ProgressionProposal;
  readonly projection: ProgressionProjection;
}

function pairing(inFlight: InFlightProposal): CheckedPairing {
  return inFlight[PAIRING_CHECKED];
}

/**
 * Local state, as a cache of server truth.
 *
 * Every non-empty branch carries the snapshot. The projection in `pending` sits
 * beside it, never inside it, so there is no state in which the optimistic
 * number IS the truth — that shape is not expressible.
 */
export type ProgressionCache =
  /** Nothing read yet. Render a loading state; propose nothing. */
  | { readonly status: 'empty' }
  /** Local state equals the last snapshot. */
  | { readonly status: 'confirmed'; readonly snapshot: ProgressionSnapshot }
  /** A proposal is in flight. `snapshot` is still truth. */
  | { readonly status: 'pending'; readonly snapshot: ProgressionSnapshot; readonly inFlight: InFlightProposal }
  /** Truth may have moved on. `snapshot` is still the best we know. */
  | { readonly status: 'stale'; readonly snapshot: ProgressionSnapshot; readonly reason: StaleReason };

/** A cache that has never been filled. */
export function emptyProgressionCache(): ProgressionCache {
  return { status: 'empty' };
}

/** The snapshot behind a cache, or `null` before the first read. */
export function cachedSnapshot(cache: ProgressionCache): ProgressionSnapshot | null {
  return cache.status === 'empty' ? null : cache.snapshot;
}

/**
 * What is in flight, as a read model, or `null`.
 *
 * Returns a freshly built `InFlightProposalView` rather than the
 * `InFlightProposal` itself. A screen still gets the id to correlate a response,
 * the proposal to describe what is being saved, and the projection to render —
 * nothing legitimate is lost. What it cannot do is hand the value back in as a
 * `pending` cache's `inFlight`, because a view has no symbol on it.
 *
 * THIS FUNCTION USED TO RETURN THE BRANDED OBJECT, which is how the forgery in
 * §6 of the header got its raw material: a caller did not have to construct a
 * checked pairing, only ask for one and spread it.
 */
export function inFlightProposal(cache: ProgressionCache): InFlightProposalView | null {
  if (cache.status !== 'pending') {
    return null;
  }
  const checked = pairing(cache.inFlight);
  return { proposalId: checked.proposalId, proposal: checked.proposal, projection: checked.projection };
}

/**
 * Applies a snapshot the server sent.
 *
 * The snapshot REPLACES truth; it is never merged with a projection. If a
 * proposal is in flight and this snapshot acknowledges it, the projection is
 * discarded and the cache is confirmed. If it does not acknowledge it — the
 * server moved for some other reason, another device, a scheduled grant — the
 * proposal stays in flight on the new base, which is the honest reading: our
 * request has still not come back.
 *
 * A snapshot older than the one held is refused outright, so an out-of-order
 * response cannot walk progression backwards.
 */
export function applyServerSnapshot(
  cache: ProgressionCache,
  snapshot: ProgressionSnapshot,
): ProgressionResult<ProgressionCache> {
  const current = cachedSnapshot(cache);
  if (current !== null) {
    const held = snapshotRevision(current);
    const incoming = snapshotRevision(snapshot);
    if (incoming < held) {
      return fail(
        'SNAPSHOT_BEHIND',
        `progression: refusing a snapshot at revision ${incoming} while holding ${held}`,
      );
    }
    if (incoming === held && !PROGRESSION_CACHE_POLICY.ACCEPT_REPEATED_REVISION) {
      return fail('SNAPSHOT_BEHIND', `progression: revision ${incoming} is already held`);
    }
  }
  if (cache.status === 'pending' && !snapshotAcknowledges(snapshot, pairing(cache.inFlight).proposalId)) {
    return ok({ status: 'pending', snapshot, inFlight: cache.inFlight });
  }
  return ok({ status: 'confirmed', snapshot });
}

/**
 * Records that the client has asked the server for a change, and what it
 * believes will happen while it waits.
 *
 * This is NOT a write. It changes no fact: the snapshot is carried through
 * untouched and the projection is parked beside it. There is no transition in
 * this module that turns a projection into a snapshot.
 *
 * THE PROJECTION IS BOUND TO THE PROPOSAL'S KIND (§4.1 of the header). `K` is
 * inferred from `proposal.kind`, and `ProjectionWithinReach<K>` narrows every
 * field outside that kind's reach to `null`, so a training session cannot be
 * paired with a projected Total — GDD §3.2, in the type system rather than in
 * prose. Build the projection from `emptyProjection()` at the call site; a value
 * already typed `ProgressionProjection` fits only a kind that may move
 * everything it could be carrying.
 *
 * WHY THE PARAMETER IS `ProgressionProposal & { kind: K }` AND NOT
 * `ProposalOfKind<K>`: the latter is a conditional type (`Extract`), and `tsc`
 * cannot infer a type argument from one. The intersection puts `K` in a plain
 * property position where inference works. `& ProgressionProjection` on the
 * projection is what lets the body treat it as one while `K` is still generic —
 * for a concrete `K` it adds nothing, since `ProjectionWithinReach<K>` is
 * already a `ProgressionProjection`.
 */
export function proposeChange<K extends ProgressionProposalKind>(
  cache: ProgressionCache,
  proposalId: ProposalId,
  proposal: ProgressionProposal & { readonly kind: K },
  projection: ProjectionWithinReach<K> & ProgressionProjection,
): ProgressionResult<ProgressionCache> {
  if (cache.status === 'empty') {
    return fail(
      'NO_CONFIRMED_TRUTH',
      'progression: nothing has been read from the server, so there is nothing to propose a change to',
    );
  }
  if (cache.status === 'pending') {
    return fail(
      'PROPOSAL_ALREADY_IN_FLIGHT',
      `progression: at most ${PROGRESSION_CACHE_POLICY.MAX_IN_FLIGHT_PROPOSALS} proposal may be in flight`,
    );
  }
  if (cache.status === 'stale' && !PROGRESSION_CACHE_POLICY.ACCEPT_PROPOSALS_WHILE_STALE) {
    return fail('CACHE_IS_STALE', 'progression: refresh before proposing a change against stale truth');
  }
  const badProposal = validateProposal(proposal);
  if (badProposal !== null) {
    return { ok: false, error: badProposal };
  }
  const badProjection = validateProjection(projection);
  if (badProjection !== null) {
    return { ok: false, error: badProjection };
  }
  const overreach = projectionExceedsReach(proposal, projection);
  if (overreach !== null) {
    return { ok: false, error: overreach };
  }
  return ok({
    status: 'pending',
    snapshot: cache.snapshot,
    inFlight: { [PAIRING_CHECKED]: { proposalId, proposal, projection } },
  });
}

/**
 * The server refused, or the request failed. The projection is discarded whole —
 * never partially kept — and the cache goes stale, because a rejection means our
 * picture of truth is now in question.
 */
export function rejectProposal(
  cache: ProgressionCache,
  proposalId: ProposalId,
): ProgressionResult<ProgressionCache> {
  if (cache.status !== 'pending' || pairing(cache.inFlight).proposalId !== proposalId) {
    return fail('NO_MATCHING_PROPOSAL', `progression: no proposal ${proposalId} is in flight`);
  }
  return ok({ status: 'stale', snapshot: cache.snapshot, reason: 'proposal-rejected' });
}

/**
 * The transport says our truth may be behind. Total function: a cache that has
 * never been filled has nothing to go stale.
 */
export function markCacheStale(cache: ProgressionCache, reason: StaleReason): ProgressionCache {
  if (cache.status === 'empty') {
    return cache;
  }
  return { status: 'stale', snapshot: cache.snapshot, reason };
}

// ---------------------------------------------------------------------------
// Reading, for rendering
// ---------------------------------------------------------------------------

/**
 * A value on its way to a screen, carrying how much it can be trusted.
 *
 * A renderer cannot get at the number without narrowing, so it cannot show a
 * projected total as a final one by accident — the provisionality is in the
 * type rather than in a convention about styling it differently.
 */
export type ProgressionReading<C, P> =
  /** Nothing read from the server yet. */
  | { readonly kind: 'unknown' }
  /** Server truth, current. */
  | { readonly kind: 'confirmed'; readonly value: C }
  /** Server truth, possibly behind. Still the best known value. */
  | { readonly kind: 'stale'; readonly value: C; readonly reason: StaleReason }
  /** A local projection, with the truth it was projected from. */
  | { readonly kind: 'projected'; readonly value: P; readonly lastConfirmed: C };

function read<C, P>(
  cache: ProgressionCache,
  fromFacts: (facts: ConfirmedFacts) => C,
  fromProjection: (projection: ProgressionProjection) => P | null,
): ProgressionReading<C, P> {
  if (cache.status === 'empty') {
    return { kind: 'unknown' };
  }
  const confirmed = fromFacts(snapshotFacts(cache.snapshot));
  if (cache.status === 'stale') {
    return { kind: 'stale', value: confirmed, reason: cache.reason };
  }
  if (cache.status === 'pending') {
    const projected = fromProjection(pairing(cache.inFlight).projection);
    if (projected !== null) {
      return { kind: 'projected', value: projected, lastConfirmed: confirmed };
    }
  }
  return { kind: 'confirmed', value: confirmed };
}

/** The lifter's best competition total. `null` means no meet has produced one. */
export function readTotalKg(cache: ProgressionCache): ProgressionReading<ConfirmedTotalKg | null, ProjectedKg> {
  return read(
    cache,
    (facts) => facts.totalKg,
    (projection) => projection.totalKg,
  );
}

/** Best e1RM for one lift. */
export function readBestE1rmKg(
  cache: ProgressionCache,
  lift: LiftKind,
): ProgressionReading<ConfirmedKg | null, ProjectedKg> {
  return read(
    cache,
    (facts) => facts.bestE1rmKg[lift],
    (projection) => projection.bestE1rmKg[lift],
  );
}

/** Trained days in the live run. */
export function readStreakDays(cache: ProgressionCache): ProgressionReading<number, ProjectedCount> {
  return read(
    cache,
    (facts) => facts.streak.currentStreak,
    (projection) => (projection.streak === null ? null : projection.streak.currentStreak),
  );
}

/**
 * The whole streak state, as `streak.ts` owns it.
 *
 * WHY A WHOLE-OBJECT READ EXISTS AT ALL, when `readStreakDays` gives the number
 * a screen prints: `streak.ts`'s `openDay` answers "what does today do" — the
 * free grace, the Recovery Day offer, whether today is already trained — and it
 * takes the whole state. Without this, the one caller that needs that answer has
 * to reach around the cache for a stored row, which is exactly the bypass this
 * module exists to make unnecessary. `readStreakDays` stays: printing a number
 * should not require holding the ledger it came out of.
 *
 * THE PROJECTED BRANCH IS `never`, like `readMeets`'s and for the same reason
 * one level down. `ProgressionProjection.streak` carries `currentStreak` and
 * nothing else, so there is no projected WHOLE state to hand back — an
 * optimistic `openDay` would be running the streak rules against a state three
 * quarters of which was invented here. While a proposal is in flight this
 * therefore reads `confirmed` at the last snapshot, which is the honest answer:
 * the streak's own rules have not moved until the server says they have.
 */
export function readStreakState(cache: ProgressionCache): ProgressionReading<StreakState, never> {
  return read<StreakState, never>(
    cache,
    (facts) => facts.streak,
    () => null,
  );
}

/** One currency balance. */
export function readBalance(
  cache: ProgressionCache,
  currency: WalletCurrency,
): ProgressionReading<ConfirmedCount, ProjectedCount> {
  return read(
    cache,
    (facts) => facts.wallet[currency],
    (projection) => projection.wallet[currency],
  );
}

/**
 * Meets on the record.
 *
 * The projected branch is `never` and therefore unconstructible: a meet result
 * is server truth or it is not shown. There is no optimistic placing.
 */
export function readMeets(cache: ProgressionCache): ProgressionReading<readonly ConfirmedMeetResult[], never> {
  return read<readonly ConfirmedMeetResult[], never>(
    cache,
    (facts) => facts.meets,
    () => null,
  );
}

/** The number behind a reading, whatever its provenance. For layout, not logic. */
export function readingValue<C, P>(reading: ProgressionReading<C, P>): C | P | null {
  switch (reading.kind) {
    case 'unknown':
      return null;
    case 'confirmed':
    case 'stale':
      return reading.value;
    case 'projected':
      return reading.value;
    default:
      return null;
  }
}

/** Whether a reading is current server truth. */
export function isConfirmedReading<C, P>(
  reading: ProgressionReading<C, P>,
): reading is { readonly kind: 'confirmed'; readonly value: C } {
  return reading.kind === 'confirmed';
}

// ---------------------------------------------------------------------------
// One consumer that demands server truth, so the brand has somewhere to bite
// ---------------------------------------------------------------------------

/**
 * Whether a lifter has the qualifying total for a meet (GDD §6.1: meets are
 * "gated by qualifying totals").
 *
 * Takes a `ConfirmedTotalKg` and nothing else. A projection, a locally summed
 * board total, or `finalMeetTotal(state) ?? 0` will not typecheck here — which
 * is the point: entry to nationals is not decided by a number the phone made up.
 */
export function meetsQualifyingTotal(total: ConfirmedTotalKg, requiredKg: number): boolean {
  if (!isFiniteWeight(requiredKg)) {
    throw new RangeError(`progression: a qualifying total must be finite and positive, received ${requiredKg}`);
  }
  return total >= requiredKg;
}
