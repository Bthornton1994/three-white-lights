/**
 * streak.ts — Daily streak tracking and Recovery Days (GDD §4).
 *
 * PURE MODULE (CLAUDE.md "Pure logic is separate from UI"):
 * zero React imports, zero side effects, zero I/O, explicit return types on
 * every export. In particular there is **no clock read anywhere in this file** —
 * no `Date`, no `Date.now`, no `performance.now` — and no randomness. The
 * current day is always a parameter. `streak.test.ts` asserts that by scanning
 * this file's own source, so the claim is checked rather than asserted.
 *
 * Every transition returns a new state; no input is mutated.
 *
 * ===========================================================================
 * 1. WHAT A "DAY" IS — STATE THE ASSUMPTION, DO NOT LEAVE IT IMPLICIT
 * ===========================================================================
 *
 * A day here is a **local civil day in the player's home timezone**, and the
 * boundary sits at `STREAK_DAY_BOUNDARY.ROLLOVER_HOUR_LOCAL` (03:00 by default)
 * rather than at midnight, so a lifter who finishes a late session at 00:40
 * still gets credit for the training day they think they are in.
 *
 * It is represented as `StreakDay`: a branded integer count of civil days since
 * 1970-01-01, computed with the standard `days_from_civil` algorithm. Civil-day
 * arithmetic rather than `Math.floor(ms / 86_400_000)` is deliberate — a day
 * that is 23 or 25 hours long because of a daylight-saving transition is still
 * exactly one day, and epoch-millisecond division gets that wrong twice a year.
 *
 * THE TIMEZONE ITSELF IS NOT THIS MODULE'S BUSINESS AND IT NEVER LEARNS IT.
 * The caller resolves "now" to a local wall-clock date-time and converts:
 *
 *     streakDayFromLocalWallClock({ year, month, day, hour })
 *
 * WHAT THAT DOES NOT SOLVE, said plainly because it is a real hole and nothing
 * here closes it: which timezone is "local" must be an account property that
 * the *server* resolves, not the device's current zone. If the device decides,
 * a player flying east loses a day and a player who changes their phone's
 * timezone by hand can manufacture an extra one. This module cannot see any of
 * that and does not pretend to — it is stated here so the caller owns it
 * knowingly. There is no anti-abuse check in this file.
 *
 * ===========================================================================
 * 1b. SIGNUP DAY — THE DAY THE CLOCK STARTS, STATED RATHER THAN IMPLIED
 * ===========================================================================
 *
 * `StreakState.signupDay` IS THE DAY THE ACCOUNT WAS CREATED. Not the first
 * session, not the first app open, not the day a migration ran: account
 * creation, which is the first day on which the player could possibly have a
 * gap at all. It is written once, by whatever creates the account, and never
 * moves again.
 *
 * IT IS REQUIRED AND IT IS NOT NULLABLE, and that is a decision with a reason
 * rather than an oversight about legacy accounts. Every absence in this module
 * is measured from an anchor day (`absenceAnchorDay`): the last TRAINED day if
 * there is one, and the signup day if there is not. A state with no anchor has
 * no absence, and a player with no absence is never charged for idle days — the
 * exact asymmetry §6 exists to delete. So an optional signup day would leave
 * the defect live for every account that had not been backfilled, which at the
 * moment of the change is all of them. The type refuses to express that.
 *
 * WHAT A MIGRATION MUST DO, since accounts created before this field existed do
 * not carry one: the server backfills it from the account's creation timestamp,
 * resolved to a local civil day the same way every other day here is. Where
 * that timestamp is genuinely unrecoverable, the honest backfill is the day the
 * migration runs, and the reason it is safe is worth stating: monotonicity is a
 * property of two POSSIBLE FUTURES from the same state, and both of them share
 * whatever anchor the state carries. Days before the backfill are history, not
 * a choice anyone can still make differently, so making them free costs nothing.
 * Backfilling to a day AFTER `lastTrainedDay` is meaningless rather than unsafe
 * — the trained day wins the anchor — but it is still wrong, and
 * `adoptSignupDay` refuses it rather than storing a lie.
 *
 * ===========================================================================
 * 2. THE STREAK
 * ===========================================================================
 *
 * Daily, with a free grace period (GDD §4.1, §4.4). An absence of up to
 * `RECOVERY_DAY_GUARDRAILS.FREE_GRACE_GAP_DAYS` missed days keeps the run alive
 * at no cost and with nothing to answer. A longer one ends the run unless
 * Recovery Days armed ahead of time cover the days past the grace.
 *
 * AN ABSENCE IS MEASURED FROM THE ANCHOR DAY, WHICH MAY BE THE SIGNUP DAY. A
 * lifter who has never trained is not outside the system: their idle days are
 * counted from `signupDay` and charged exactly as a lifter's inside a run are.
 * See §1b for what that field is and §6 for the measurement that forced it.
 *
 * `currentStreak` counts **trained days** in the live run. A Recovery Day keeps
 * the run alive across an absence; it does not add to the count. That is a
 * design decision with a reason, and the reason is the pay-to-win line:
 * `STREAK_MILESTONE_DAYS` marks 7 / 30 / 100 days, so if covered days counted
 * toward the streak they would buy their way to the milestones. They do not
 * count, so reaching a milestone always costs the full number of real training
 * days. `streak.test.ts` checks that.
 *
 * SINCE GDD §4.2's OPTION 1 RULING A MILESTONE PAYS NOTHING AT ALL, which makes
 * the paragraph above belt and braces rather than the only guard — and the
 * belt matters, because a milestone is reached by training and a grant whose
 * arrival day a lifter's own training can move is measured to reopen the
 * monotonicity defect (see `STREAK_MILESTONE_DAYS`).
 *
 * ===========================================================================
 * 3. RECOVERY DAYS: ARMED AHEAD, REVEALED ON RETURN (GDD §4.2, §4.3)
 * ===========================================================================
 *
 * The flavour is load-bearing and the naming in this file follows it
 * throughout: a missed day is reframed as legitimate training wisdom, not as
 * failure. The audience this is aimed at often misses a day *because* they are
 * training intelligently — deloading, sleeping off a bad week, letting a tweak
 * settle. There is no type, field, constant, error code or message in this
 * module called a token, a freeze, a shield or a streak-save.
 *
 * AUTO-PROTECT IS THE DEFAULT STATE, NOT A PER-MISS ACTION. This is the human
 * ruling recorded in GDD §4.2/§4.4, and it is enforced by the shape of the API
 * rather than by a comment:
 *
 *   - `recordTrainingDay` **arms** the window: `entitlementArmed` is set at the
 *     end of every session (or cleared if the player has turned protection
 *     off), and the entitlement snapshot it leaves behind is what the next
 *     absence draws on.
 *   - `createStreakState` arms a new account the same way, because the signup
 *     day is an anchor like any other and the absence that follows it is
 *     chargeable like any other. A new lifter is protected from the moment the
 *     account exists, not from their first session.
 *   - the missed days themselves consume what is armed. `absenceOutcome` is a
 *     pure function of `(lastTrainedDay, entitlement, entitlementArmed, today)`,
 *     so an absence costs and covers exactly the same thing whether the player
 *     opens the app during it, once at the end of it, or never.
 *   - `openDay` is a pure read model. It reports the save as
 *     `'gap-covered-by-recovery-days'`. It changes nothing, and there is
 *     nothing for it to change.
 *   - there is no `acceptRecoveryDayOffer`, no `declineRecoveryDayOffer`, no
 *     `RecoveryDayOffer` and no pending-decision error code. `streak.test.ts`
 *     scans this file's source for those names, so the manual path cannot come
 *     back by accident.
 *
 * WHAT REPLACED THE PROMPT. The "phew" moment of GDD §4.2 is now a **return
 * visit reveal**: the player comes back, opens the app, and is told that their
 * run is intact and what held it. That is news, not a decision, and it lands
 * on the same screen the old prompt did.
 *
 * WHERE THE REAL CHOICE LIVES NOW. `recoveryDayProtectionEnabled` is a
 * settings toggle (default `RECOVERY_DAY_PROTECTION.DEFAULT_ENABLED`). A player
 * who would rather take the broken streak deliberately turns it off, and then
 * **no covered day is ever spent for them** — `setRecoveryDayProtection`
 * clears `entitlementArmed` on the spot, and an absence past the grace ends the
 * run with the window untouched. `streak.test.ts` proves that with a spend
 * comparison rather than asserting it in prose.
 *
 * THE FREE GRACE SURVIVES THE TOGGLE, and it is enforced by the arithmetic
 * rather than by a branch: the disarmed case resolves through the same
 * `resolveEntitlement` call against an EMPTY window, so an absence of zero
 * chargeable days still covers and still consumes nothing. A short-circuit to
 * "declined means broken" ends a run for a one-day miss, which is what
 * `RECOVERY_DAY_GUARDRAILS.FREE_GRACE_GAP_DAYS` refuses in as many words.
 *
 * ARMING HAPPENS WHEN YOU TRAIN, AND NOWHERE ELSE. That is the whole of the
 * rule, and it is what makes the outcome independent of app-opening:
 *
 *   - NOTHING CAN CREDIT COVERAGE AT ALL any more. GDD §4.2's Option 1 ruling
 *     deleted `grantRecoveryDays`, the hold cap and the earning table with it,
 *     so the question "can a Recovery Day arriving mid-absence arm it?" no
 *     longer has anything to ask about — and `streak.test.ts` asserts that no
 *     exported name matches /grant|credit|buy|purchase/. What can still change
 *     mid-absence is the CALENDAR, and it changes identically whether or not
 *     anybody looks.
 *   - turning protection ON mid-absence does not arm it either; it applies from
 *     the next session (`appliesToTheAbsenceInProgress` says so, so a UI can
 *     tell the player rather than leaving them to discover it).
 *   - turning protection OFF is immediate, because that direction can only ever
 *     end a run early. It can never rescue one, so it cannot make the outcome
 *     depend on when it was done.
 *
 * THE REJECTED ALTERNATIVE, named because it is the obvious one: let a grant
 * re-arm whenever nothing chargeable has accrued yet. It was refused because
 * the GDD §4.2 Gym Empire drop lands on a *check-in* — so a Recovery Day
 * arriving that way would arm only for a player who opened the app during their
 * absence, which is exactly the defect this rework exists to delete.
 *
 * THE FIRST SAVE (GDD §4.3). The first absence a player ever has *banked* by a
 * Recovery Day carries `isFirstRecoveryDaySave` on the opening, so the UI can
 * show the explanation alongside the reveal. The flag is consumed by the
 * training day that banks the save, not by the opening that displays it, so:
 *   - closing the app without training re-shows the explanation next time
 *     (correct: nothing has been banked yet);
 *   - an absence nothing could have covered does NOT burn the moment;
 *   - a gap the free grace covers does not burn it either — nothing was spent,
 *     so there is no save to explain.
 *
 * ===========================================================================
 * 4. THE PAY-TO-WIN LINE, EXPRESSED IN THE TYPES (GDD §8.1, §12.3)
 * ===========================================================================
 *
 * COVERAGE IS NOT PURCHASABLE TODAY. GDD §4.2's Option 1 ruling replaced the
 * purchasable Recovery Day with a window entitlement every account has on the
 * same terms, and GDD §8.3E's Extra Covered Day — the product that would make
 * it purchasable again — is PROPOSED AND NOT RULED. So this module exports
 * nothing that can add coverage to a state, and `streak.test.ts` checks that
 * rather than trusting it.
 *
 * THE FOUR MECHANISMS BELOW ARE KEPT ANYWAY, because §8.3E may yet be ruled in
 * and because they are what makes "it only protects a streak" checkable rather
 * than promised. All four are mechanical:
 *
 *  (a) THE STATE ALLOWLIST. `STREAK_FACT_KEYS` is the complete list of fields
 *      `StreakState` may have. `RECOVERY_DAY_REACH_IS_STREAK_ONLY` is a
 *      compile-time assertion that `keyof StreakState` is *exactly* that list.
 *      Adding a field — `totalBonusKg`, `e1rmMultiplier`, `extraSessions`,
 *      anything, under any name — fails `tsc` until it is added to the
 *      allowlist, which is a visible edit sitting directly under this
 *      paragraph. A blocklist of forbidden names would be guessable around; an
 *      allowlist is not. It is exact in both directions, so a field that is
 *      *removed* has to be removed from the list too.
 *
 *  (b) THE OUTCOME ALLOWLIST. `RECOVERY_DAY_OUTCOME_KEYS` does the same for
 *      `RecoveryDaySave`, the only thing a spent Recovery Day ever reports.
 *      Every field on it is a streak fact or a description of the spend itself.
 *
 *  (c) NO PROVENANCE TO BRANCH ON. `RecoveryDaySource` exists on the *grant*
 *      existed on the deleted grant path for receipts and analytics and was
 *      thrown away immediately. THERE IS NO GRANT PATH AT ALL NOW, so the
 *      property got stronger again rather than going away: `recordTrainingDay
 *      (state, day)` is still the only function that can draw on coverage and
 *      it has no parameter that could carry a provenance, and there is nothing
 *      that could put one on a state either. The one field that names a
 *      provenance — `EntitlementState.purchasedDaysLeft`, which
 *      `streakEntitlement.afterSession` spends AFTER the granted entitlement —
 *      is unreachable from here and pinned at zero by `streak.test.ts`, which
 *      names the exception rather than scanning around it.
 *
 *  (d) NOTHING TO SELL. This module exports no streak multiplier, no
 *      streak-derived load bonus, no "training pace" figure and no session
 *      allowance. `recordTrainingDay` takes a day and nothing else — it cannot
 *      be handed a Recovery Day, and there is no argument by which one could
 *      influence what a session is worth. A streak here is a count of days and
 *      the milestone schedule that pays out Recovery Days. It feeds nothing
 *      else in this file.
 *
 * WHAT (a)-(d) DO NOT PROVE, stated rather than glossed: they constrain this
 * module. They cannot stop a *consumer* reading `currentStreak` and multiplying
 * a load by it. That would be the consumer's violation, and no type in this
 * file can prevent it — only a critic reading that consumer can.
 *
 * Currency prices are also not here, and there is nothing here to price.
 * `migrateFromRecoveryDayBalance` reports what an old account was holding and
 * converts it to exactly nothing mechanical, precisely so the compensation is
 * settled in a currency this module does not know about. Putting a price in
 * this file would put a currency balance in the same module as the streak,
 * which is the coupling worth avoiding.
 *
 * ===========================================================================
 * 5. GUARDRAILS (GDD §4.2)
 * ===========================================================================
 *
 * THEY LIVE IN TWO FILES NOW, and the split follows the Option 1 ruling: the
 * grace is the one part of coverage that is a pure function of the absence, so
 * it stayed here; everything that depends on a window went to
 * `streakEntitlement.ts`.
 *
 *   - `RECOVERY_DAY_GUARDRAILS.FREE_GRACE_GAP_DAYS` — how much of an ABSENCE is
 *     covered for nothing (GDD §4.4), drawing on nothing at all. Not a
 *     guardrail on coverage so much as the reason most absences never reach it.
 *   - `RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW` — how many covered days
 *     every account has in every window. The replacement for the hold cap AND
 *     for the earning table at once: everybody has this many, always, and
 *     nothing carries over.
 *   - `RECOVERY_ENTITLEMENT.MAX_COVERED_DAYS_PER_ABSENCE` — how many covered
 *     days one absence may draw, even when the window has more left. The direct
 *     heir of the consecutive-use limit.
 *
 * THREE NUMBERS, THREE JOBS. `FREE_GRACE_GAP_DAYS` is a length of absence that
 * is free; `COVERED_DAYS_PER_WINDOW` is a RATE; `MAX_COVERED_DAYS_PER_ABSENCE`
 * is a per-absence CEILING. All three are 2 today by coincidence of tuning and
 * are deliberately not one constant — and NO ORDERING BETWEEN THEM IS ASSUMED,
 * because the ceiling composes with the rate by `min`. `streak.test.ts` reads
 * both source blocks and asserts each is a bare numeric literal, because no
 * behavioural test can tell a build where one is *written as* another.
 *
 * AN ABSENCE IS THE UNIT, AND THERE IS NO SMALLER ONE. An absence is everything
 * since the ANCHOR DAY — the last TRAINED day, or the signup day for a lifter
 * who has not trained yet (§1b). Nothing is committed part-way through one: the
 * balance does not move, no marker is written, and there is no per-gap
 * bookkeeping that could re-arm the grace or the consecutive-use allowance.
 * The whole thing is one subtraction:
 *
 *     daysMissed = today - absenceAnchorDay - 1
 *     chargeable = max(0, daysMissed - FREE_GRACE_GAP_DAYS)
 *     available  = armed ? coveredDaysAvailable(entitlement, windowOf(today)) : 0
 *     covered   <=>  chargeable <= min(available, MAX_COVERED_DAYS_PER_ABSENCE)
 *     consumed   =  covered ? chargeable : available
 *
 * so the longest survivable absence is `LONGEST_REPAIRABLE_ABSENCE_DAYS` =
 * `FREE_GRACE_GAP_DAYS + min(COVERED_DAYS_PER_WINDOW,
 * MAX_COVERED_DAYS_PER_ABSENCE)` days — four at today's values, and a week away
 * ends the run. That ceiling holds at every point in every window, and it holds
 * however often the app is opened during the absence
 * **because opening the app is not an input to the formula above**. The
 * previous implementation needed a paragraph and a table to defend the same
 * sentence; this one cannot express the alternative.
 *
 * AN ABSENCE IS CHARGED WHETHER OR NOT IT SAVED ANYTHING. Coverage is still
 * all-or-nothing — a run either survives an absence or it does not, and there
 * is no half-saved run — but the CHARGE is not. An absence that outran what was
 * armed consumes everything the window had anyway: it was committed to holding
 * that absence open, it failed, and it is gone. What is different from the
 * stock this rule was written for is the BLAST RADIUS — "everything" is bounded
 * by one window's entitlement and is restored at the next boundary regardless
 * of what happened, where a stock's burn left a permanent difference.
 *
 * THIS REVERSES A RULE THAT USED TO BE HERE, and the reversal is measured
 * rather than preferred. The previous revision said "an absence that ends the
 * run debits nothing", which is kinder to read and is the direct cause of a
 * hard-constraint violation: see §6. In one sentence — if a doomed absence is
 * free, then training one extra day inside a doomed absence splits it into two
 * shorter ones that are NOT free, and the player who trained more pays more.
 *
 * IT IS ALSO WHAT THE PRECEDENT GDD §12.2 NAMES ACTUALLY DOES. A Duolingo
 * streak freeze is consumed by the day it covers, not by whether the streak
 * survived the week; the "spend nothing on a lost cause" rule was this
 * codebase's own invention and not the model it was measured against.
 *
 * THE DEBIT IS STILL TAKEN IN EXACTLY ONE PLACE: `recordTrainingDay`, the
 * training day that ends the absence. `settleBrokenStreak` records the end of a
 * run and moves no entitlement, so the commitment survives a settle and the
 * debit cannot depend on which day anybody opened the app.
 * A player who never comes back is never charged, because nothing ever ends
 * their absence.
 *
 * WHY THE DEBIT IS EVERYTHING THE WINDOW HAD AND NOT `min(chargeable,
 * available)`, which would be gentler and reads more naturally. `chargeable`
 * grows with every day the player stays away, so a debit that depended on it
 * would depend on WHEN the absence was resolved, and §6's first invariant would
 * be gone. What the window has is a pure function of the calendar, so a debit
 * equal to it is the same number whether the player returns tomorrow or in a
 * year.
 *
 * IT IS ALSO THE ONLY CONSUMPTION THAT IS IDEMPOTENT UNDER SPLITTING, which is
 * the half that survived the Option 1 rework and is measured: dropping the burn
 * gives 1051 violating pairs at 60 days and 673 at 100, against 0 with it —
 * worse than the stock design it replaced. The covered branch charges
 * `max(0, len - grace)`, which is subadditive, so splitting can only consume
 * less; the doomed branch has no such arithmetic and needs "take everything
 * left" instead, because the second piece of a split then finds nothing.
 *
 * WHAT IS *NOT* GUARDED, said plainly because the opposite would be a claim
 * this file cannot back:
 *
 *   - THE GRACE HAS NO CONSECUTIVE LIMIT AND NO COOLDOWN ACROSS ABSENCES. It is
 *     spent once per absence and refilled by a trained day, so a player who
 *     trains one day in every `FREE_GRACE_GAP_DAYS + 1` holds a streak alive
 *     forever on 33% attendance, spending nothing. That is the accepted price
 *     of the GDD §4.4 ruling — a short miss basically never breaks a streak —
 *     and it is deliberately not mitigated here. If playtesting says it needs
 *     stopping, the honest fixes are lowering `FREE_GRACE_GAP_DAYS` or adding a
 *     new named guardrail, not a tweak buried in a call site.
 *   - NOR IS THERE A COOLDOWN BETWEEN SPENDS. A player who alternates
 *     `FREE_GRACE_GAP_DAYS + 1` idle days with one trained day draws a covered
 *     day for every such absence until the WINDOW is empty, because each
 *     trained day re-arms. `streak.test.ts` demonstrates that pattern draining
 *     a full window rather than leaving it as prose. The only thing bounding it
 *     is the rate — `COVERED_DAYS_PER_WINDOW` per `WINDOW_DAYS` days.
 *   - COVERAGE ARRIVING DURING AN ABSENCE DOES NOT COVER IT. Nothing can arrive
 *     any more — there is no grant path — so the only thing that changes
 *     mid-absence is the window turning over, and a later window's entitlement
 *     does not reach back into an absence that is resolving in an earlier one.
 *     See
 *     §3: arming happens when you train. This is the visible cost of making the
 *     outcome independent of app-opening, and it is stated on the read model
 *     (`DayOpening` reports what is armed, not what is held) rather than left
 *     for a player to discover. It is also how the Duolingo-style armed-ahead
 *     model GDD §12.2 points at behaves, so it is a cost the bar already pays.
 *
 * ===========================================================================
 * 6. NEVER PUNISH DAILY ENGAGEMENT (CLAUDE.md, GDD §3.5, §12.3)
 * ===========================================================================
 *
 * WHAT HOLDS, and is tested:
 *
 *   - THE OUTCOME DOES NOT DEPEND ON WHEN THE PLAYER LOOKS. For a fixed
 *     training history and a fixed armed state, the final streak, the final
 *     entitlement and the number of covered days consumed are IDENTICAL whether
 *     the player opens the app the next day, three days later, ten days later,
 *     every single day, or not until the end. `streak.test.ts` asserts that
 *     directly, by full state equality, over a sweep of opening schedules and
 *     exhaustively over every calendar of a fixed length. This is the invariant
 *     the manual prompt broke and the whole reason for the first rework, and it
 *     is the one a WINDOW-based entitlement is most capable of giving away:
 *     `coveredDaysAvailable` reads the window off the DAY, never off a visit.
 *   - AN ABSENCE IS CHARGED WHETHER IT SAVED THE RUN OR NOT, AND FOR A FIXED
 *     AMOUNT EITHER WAY. See §5. This is the rule that used to say the
 *     opposite; §5 says why it had to turn round and why it survived the move
 *     off the stock.
 *   - LOCALLY. Across a grid of run lengths and window states, training today
 *     dominates skipping today on every field that matters: streak up by one,
 *     longest streak no lower, coverage no lower, runway no worse.
 *   - GLOBALLY, WITH PROTECTION OFF. Over ALL 2^10 ten-day histories, turning
 *     any skipped day into a trained day never lowers `currentStreak`,
 *     `longestStreak` or the covered days left in the window. Exhaustive, not
 *     sampled.
 *   - EVERYWHERE. `recordTrainingDay` cannot reduce the window below what the
 *     *absence it closes* costs, and can never reduce it at all when nothing
 *     was missed. Showing up is never itself a charge.
 *   - AGAINST A COMPARATOR WHO SPENT NOTHING. A player who has drawn any number
 *     of covered days never ends on a lower streak than a player who trained a
 *     subset of the same days and drew none. This is structural rather than
 *     lucky: a covered day only ever extends a run backwards across an absence,
 *     so the spender's run contains the comparator's.
 *
 *   - MONOTONICITY IN THE TRAINED SET, over every calendar of 8 TO 16 DAYS —
 *     exhaustive, every single-day superset of every calendar — AND over the
 *     seeded sweeps at 40, 60, 80 and 100 days, on `currentStreak` AND on
 *     `longestStreak` AND on the worst deficit. Training one MORE day never
 *     lowers either field.
 *
 *     THE SAMPLED HALF IS NEW AND IT IS WHY THIS MODULE WAS REWORKED A THIRD
 *     TIME. Under the Recovery Day stock this bullet had to stop at 16 days:
 *     the sampled sweeps read 13 / 122 / 142 / 74 violating pairs at 40 / 60 /
 *     80 / 100, with lifetime-best inversions of 14 / 150 / 276 / 221 and a
 *     worst deficit reaching 189 at 400 days. They are zero on all three now.
 *     `MONOTONICITY_MEASUREMENT`, `SAMPLED_MEASUREMENT` and `RESIDUE_GROWTH` in
 *     `streak.test.ts` carry the before-numbers beside the after-numbers, so
 *     the change is a measurement rather than a claim.
 *
 * HOW IT WAS CLOSED, in the order the three parts matter:
 *
 *   (1) THE ANCHOR. Idle days before a run existed used to be free, because
 *       `daysMissedBefore` returned 0 with no `lastTrainedDay` to measure from.
 *       They are now measured from `signupDay` (Section 1b) and charged like
 *       any other idle days. This is GDD 4.2's "charge both sides".
 *   (2) THE DOOMED ABSENCE. An absence that outran what was armed used to be
 *       free. It is now charged everything the window had (Section 5).
 *   (3) THE STOCK ITSELF. (1) and (2) closed the property exhaustively to 16
 *       days and left a residue past it. GDD 4.2's Option 1 ruling replaced the
 *       stock with a rolling entitlement, which is what closed the rest.
 *
 * WHY (1) AND (2) ARE THE SAME FIX SEEN TWICE. Adding a trained day always
 * SPLITS one absence into two shorter ones. Splitting can only reduce the total
 * charge — `max(0, a-G) + max(0, b-G) <= max(0, a+b+1-G)` — so a charge that is
 * levied on EVERY absence is automatically monotone. Every free case is a hole
 * in that argument, because splitting a free absence into charged ones creates
 * charge out of nothing. There were exactly two free cases: the absence before
 * a run existed, and the absence that killed one. Both are now charged, and the
 * argument closes.
 *
 * NEITHER OF THEM WORKS ALONE, and that is measured rather than reasoned. At
 * the tunables this file ships, over every 13-day calendar and its single-day
 * supersets: the defect was 36 violating pairs, worst deficit 3. The anchor
 * alone leaves 32 pairs. The doomed-absence charge alone leaves 24. Together
 * they leave 0.
 *
 * WHERE THAT ARGUMENT STOPPED BEING A PROOF, AND IT IS EXACTLY WHERE THE
 * RESIDUE USED TO LIVE. `max(0, len - G)` is the charge on a COVERED absence. A
 * DOOMED absence is charged everything available, which is not a function of
 * the absence length at all. Under a STOCK that quantity was what the lifter
 * happened to be HOLDING, so the subadditivity above said nothing about the
 * doomed branch and the debit was INCREASING IN WEALTH — training one more day
 * is a way of being wealthier, because a spared save leaves a Recovery Day in
 * the bank and an earlier milestone puts one there. The lifter who trained more
 * walked into a doomed absence holding more, lost more, and died at a later
 * absence the lazier lifter survived.
 *
 * WHY THE ENTITLEMENT ESCAPES IT, AND IT IS ONE SENTENCE: an entitlement is the
 * same number for everybody at the start of every window, so there is nothing
 * for a debit to be proportional to. Two lifters who differ inside a window
 * RE-CONVERGE at its boundary, which a stock never did, because the income that
 * refilled a stock was paid once per lifetime. `streak.test.ts` measures both
 * halves of that directly over the 60-day sweep: every confiscation is bounded
 * by one window's entitlement, and the two lifters hold identical coverage at
 * every window boundary past both of them.
 *
 * THE BURN SURVIVED THE REDESIGN, AND THAT IS THE FINDING THAT MATTERS MOST.
 * It is tempting to drop it along with the stock — it is the rule whose
 * wealth-dependence caused the defect, and it reads as harsh. Measured,
 * dropping it is WORSE THAN THE DESIGN IT REPLACES: 1051 violating pairs at 60
 * days and 673 at 100, against 0 with it. The doomed branch has no subadditive
 * arithmetic to lean on, so its consumption has to be idempotent under
 * splitting instead, and "take everything left in the window" is the only thing
 * that is. What changed is the blast radius, not the rule.
 *
 * NO GRANT OF COVERED DAYS MAY BE KEYED TO ANYTHING THE LIFTER DOES. This is
 * the second thing the verification changed about the ruling and it is a
 * constraint on every future earning table, season pass and reward: a grant
 * whose ARRIVAL DAY a lifter's own training can move reopens the defect.
 * Measured in `streakEntitlement.test.ts` as negative controls — a covered day
 * granted at a streak length gives 54 violating pairs at 100 days, one granted
 * every N sessions gives 1156, and one granted on a FIXED CALENDAR DAY gives 0
 * across six schedules including one landing exactly on a window boundary.
 * `STREAK_MILESTONE_DAYS` is the direct consequence: a milestone is a moment,
 * not a payout.
 *
 * TWO DIAGNOSES THIS FILE PUBLISHED AND RETRACTED, kept because the wrong turns
 * are the useful part:
 *
 *   - "THE MANUAL PROMPT." Deleting the prompt was run as a clean test and the
 *     constructive inversion family did not move by a single day. What the
 *     prompt actually caused was a different residue — a player who opened the
 *     app mid-absence paid for part of an absence that ended the run anyway —
 *     and that one is gone in the strong sense: the whole outcome is a function
 *     of the calendar, so nothing is left for app-opening to change.
 *   - "MILESTONE INCOME, PAID ONCE PER LIFETIME AND TIMED BY THE STREAK", on
 *     the strength of one counterfactual: empty `STREAK_MILESTONE_DAYS` and the
 *     60-day sweep goes to 0. The counterfactual was real; the conclusion did
 *     not follow, because milestone income was THE ONLY INCOME the sweep had
 *     after the signup grant, so emptying it switched off income rather than
 *     income timing. Two counterfactuals that separate them both refuted it:
 *     income credited on FIXED CALENDAR DAYS still gave 81 violating pairs at
 *     60 days, and a balance topped to the hold cap every day — a stock that
 *     can never run out — gave 194, MORE than the 122 the shipped economy gave.
 *     Neither counterfactual can be run against this engine any more, because
 *     all three are variations on a stock; `streak.test.ts` keeps their results
 *     as pinned history and measures the replacement mechanism instead.
 *
 * WHAT IS STILL NOT PROVEN, said plainly because the opposite would be a claim
 * this file cannot back. The exhaustive half is a proof for calendars of 16
 * days or fewer. Everything past that is sampling plus an adversarial
 * hill-climb, and the last defect this module had was a 23-day calendar —
 * inside neither. `streakEntitlement.test.ts` is aimed at every failure class
 * known to have occurred here and finds none; it will find the next one only if
 * the next one resembles the last two.
 *
 * AND THE VERIFICATION IS PINNED TO THIS FILE, which it was not when it was
 * taken. That battery grades a twenty-line REFERENCE COMPOSITION of the grace
 * and the entitlement, not this module — so if the two diverged, every attack
 * in it would be a statement about a program nobody ships.
 * `streakEntitlement.test.ts`'s "the shipped engine is the composition this
 * battery graded" drives both over the same calendars and asserts identical
 * `currentStreak`, `longestStreak` and consumption, byte for byte, with a
 * negative control proving the comparator can see a rule change.
 *
 * A TRAP FOR ANYONE MEASURING THIS. `currentStreak` is only true as of the last
 * day someone called `openDay` on the state. A run that has already died sits
 * there at full length until `settleBrokenStreak` records the fact, so a state
 * nobody has opened since the last session reports a streak the player does not
 * have. That staleness is a *reading* artefact, not a behavioural one — the run
 * died on the day the calendar says it died — but comparing two states settled
 * to different days gets the answer wrong in BOTH directions.
 * `streak.test.ts` pins one pair that reads as a violation and is not one, and
 * one that reads as fine and is a real one. Settle both, then compare.
 *
 * ===========================================================================
 * 7. DELIBERATE NON-GOALS
 * ===========================================================================
 *
 *   - Persistence, serialisation and the server round-trip. `StreakState` is a
 *     plain JSON-safe object on purpose (the `StreakDay` brand is erased at
 *     runtime), so an Edge Function can store and rehydrate it, but no storage
 *     code lives here. CLAUDE.md: streak mutations are server-authoritative;
 *     this module is the pure transition function that server runs.
 *   - Achievement and reward bookkeeping of every kind. GDD §4.2's Option 1
 *     ruling deleted the earning table, so there is nothing here to credit and
 *     no de-duplication to do. Streak milestones are the exception this module
 *     still owns, and it MARKS each one once per lifetime off `longestStreak`
 *     while paying nothing for it.
 *   - The Gym Empire passive drop (GDD §4.2). It was a chance to drop a
 *     Recovery Day and there are no Recovery Days to drop; this module is
 *     deterministic and never rolls.
 *   - Reminders, notifications, copy and localisation. `DayOpening` is the read
 *     model a UI renders; the words are the UI's.
 *   - Anything to do with what the player actually lifted. `recordTrainingDay`
 *     does not know or care.
 */

import {
  MAX_COVERED_DAYS_ONE_ABSENCE_MAY_DRAW,
  RECOVERY_ENTITLEMENT,
  afterSession,
  coveredDaysAvailable,
  freshEntitlement,
  resolveEntitlement,
  windowIndexOf,
  type EntitlementState,
} from './streakEntitlement';

// ---------------------------------------------------------------------------
// Tunable constants
//
// CLAUDE.md "Game Feel Values Must Be Tunable": every hand-tuned number lives
// here, named, in one place. NONE of these are playtested. They are plausible
// starting values inside the ranges GDD §4.2 gives, and they are expected to
// move.
// ---------------------------------------------------------------------------

/** Where the day boundary sits. See §1 of the header. */
export const STREAK_DAY_BOUNDARY = {
  /**
   * Local hour at which a new streak day begins, 0-23. Whole hours only — a
   * half-past boundary would need this to be minutes and every caller to pass
   * them.
   *
   * 3 rather than 0 so a session finished at 00:40 counts for the day the
   * lifter believes they are in. UNTUNED.
   */
  ROLLOVER_HOUR_LOCAL: 3,

  /**
   * Hours in a civil day, for validating a caller's wall-clock hour.
   *
   * NOT A TUNABLE — it is what "hour" means. It lives beside the rollover so
   * the one place that reads an hour has one place to read its bounds from.
   */
  HOURS_PER_DAY: 24,
} as const;

/** GDD §4.2 "Guardrails". */
export const RECOVERY_DAY_GUARDRAILS = {
  /**
   * FREE GRACE: how much of an ABSENCE is covered WITHOUT DRAWING ANYTHING.
   *
   * An absence is everything since the last TRAINED day. Its first
   * FREE_GRACE_GAP_DAYS days keep the run alive, draw no covered day and move
   * no entitlement. Only the days BEYOND them are chargeable
   * (`chargeableDaysBefore`), and those are what the entitlement pays for.
   *
   * IT APPLIES EVEN WITH PROTECTION TURNED OFF. The settings toggle declines
   * *drawing on the entitlement*; the grace draws nothing, so there is nothing
   * in it to decline. GDD §4.4's ruling stands on its own.
   *
   * IT IS ALSO THE ONLY PART OF COVERAGE THAT IS A PURE FUNCTION OF THE
   * ABSENCE, which is why it is the one part never implicated in any of the
   * monotonicity defects this module has had. Everything stateful now lives in
   * `streakEntitlement.ts`, behind the property that file is verified against.
   *
   * UNTUNED. 2 means "miss a weekend and nothing happens to you". Raising it
   * makes streaks harder to lose; lowering it to 0 restores the pre-§4.4
   * economics exactly.
   *
   * WHAT THIS COSTS, stated rather than discovered later: a player who trains
   * one day in every FREE_GRACE_GAP_DAYS + 1 can hold a streak alive forever
   * without ever drawing on the entitlement. That is the accepted price of the
   * GDD §4.4 ruling and there is deliberately no limit on how many absences may
   * be graced.
   */
  FREE_GRACE_GAP_DAYS: 2,
} as const;

export const RECOVERY_DAY_PROTECTION = {
  /**
   * Whether a new lifter is protected by default.
   *
   * TRUE, and that is the human ruling rather than a tuning choice: holding at
   * least one Recovery Day means protected, with no arming step before each
   * individual miss and no prompt during an absence. A player who would rather
   * decline protection and take a broken streak on purpose turns it off in
   * settings (`setRecoveryDayProtection`), which is where the real choice lives
   * now.
   *
   * Flipping this to `false` would ship an opt-in protection model, which is
   * not what §4.2 says. It is a constant so that the default is stated once and
   * read by `createStreakState` rather than written into it.
   */
  DEFAULT_ENABLED: true,
} as const;

/**
 * The longest absence a live run can survive: the free grace plus every
 * Recovery Day the consecutive-use guardrail permits.
 *
 * DERIVED, NOT TUNED — there is nothing to hand-tune here, and it is a `const`
 * rather than prose so the two things it is composed of cannot drift away from
 * the sentence that describes them. Move either guardrail and this moves with
 * it. Assumes a full window; below that what the window has left binds first
 * and the absence a player can actually survive is shorter.
 *
 * It is a property of the ABSENCE and of nothing else, so it holds whatever the
 * player does or does not do while they are away.
 */
export const LONGEST_REPAIRABLE_ABSENCE_DAYS: number =
  RECOVERY_DAY_GUARDRAILS.FREE_GRACE_GAP_DAYS + MAX_COVERED_DAYS_ONE_ABSENCE_MAY_DRAW;

/**
 * Streak lengths worth telling the player about (GDD §4.2: "Milestone streaks
 * (7 / 30 / 100 days)").
 *
 * THEY PAY NOTHING, AND THAT IS THE POINT RATHER THAN AN OMISSION. Under the
 * Recovery Day stock a milestone paid one Recovery Day, and the arrival of that
 * payout is what the residue was first — wrongly — blamed on. The real cause
 * was the doomed-absence debit being proportional to holdings (GDD §4.4), but
 * the investigation left behind a measurement that rules this out permanently:
 *
 *     A COVERED DAY GRANTED AT A STREAK LENGTH GIVES 54 VIOLATING PAIRS AND
 *     239 LIFETIME-BEST INVERSIONS AT 100 DAYS. Granted on a fixed calendar
 *     day instead: 0.
 *
 * So a milestone may be a moment, a badge, a bit of copy and a cosmetic. It may
 * NOT hand out covered days, because a milestone is reached by training and a
 * grant whose arrival day the lifter's training can move reopens the defect.
 * `streakEntitlement.test.ts` keeps that as a negative control, and
 * `streak.test.ts` asserts directly that crossing a milestone leaves the
 * entitlement untouched — so re-adding the payout fails a test rather than a
 * playtest.
 *
 * Eligibility is still READ OFF `longestStreak`, so `milestonesReached` is
 * once per lifetime and there is no ledger to keep in sync.
 */
export const STREAK_MILESTONE_DAYS: readonly number[] = [7, 30, 100];

// ---------------------------------------------------------------------------
// Days
// ---------------------------------------------------------------------------

declare const STREAK_DAY_BRAND: unique symbol;

/**
 * A local civil day, as an integer count of days since 1970-01-01.
 *
 * Branded so a raw `number` cannot be passed where a day is expected: the only
 * ways in are `streakDayFromCivilDate`, `streakDayFromLocalWallClock` and the
 * explicit `asStreakDay`. That is how "this module never reads a clock" is kept
 * true — resolving *when now is* happens outside, deliberately, in code that
 * knows which timezone the account is anchored to.
 *
 * The brand is a type-level fiction; at runtime a `StreakDay` is a plain
 * integer and serialises as one.
 */
export type StreakDay = number & { readonly [STREAK_DAY_BRAND]: 'streak-day' };

/** A calendar date, with `month` 1-12 and `day` 1-31. */
export interface CivilDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

/** A local calendar date plus the local hour, 0-23. */
export interface LocalWallClock extends CivilDate {
  readonly hour: number;
}

/**
 * Wraps an integer as a `StreakDay`.
 *
 * @throws {RangeError} if it is not a safe integer.
 */
export function asStreakDay(value: number): StreakDay {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`streak: a day must be a safe integer day index, received ${value}`);
  }
  return value as StreakDay;
}

/** Day arithmetic that keeps the brand. */
export function addDays(day: StreakDay, delta: number): StreakDay {
  if (!Number.isSafeInteger(delta)) {
    throw new RangeError(`streak: day offset must be a safe integer, received ${delta}`);
  }
  return asStreakDay(day + delta);
}

/** `later - earlier`, in whole civil days. Negative if the order is reversed. */
export function daysBetween(earlier: StreakDay, later: StreakDay): number {
  return later - earlier;
}

/**
 * `days_from_civil` (Howard Hinnant's civil-calendar algorithm), proleptic
 * Gregorian, 1970-01-01 => 0. Pure integer arithmetic — no `Date`, so no
 * chance of a host timezone leaking in.
 */
function daysFromCivil(year: number, month: number, day: number): number {
  const y = year - (month <= 2 ? 1 : 0);
  const era = Math.floor(y / 400);
  const yearOfEra = y - era * 400;
  const dayOfYear = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146097 + dayOfEra - 719468;
}

/** Inverse of `daysFromCivil`. */
function civilFromDays(index: number): CivilDate {
  const z = index + 719468;
  const era = Math.floor(z / 146097);
  const dayOfEra = z - era * 146097;
  const yearOfEra = Math.floor(
    (dayOfEra - Math.floor(dayOfEra / 1460) + Math.floor(dayOfEra / 36524) - Math.floor(dayOfEra / 146096)) / 365,
  );
  const y = yearOfEra + era * 400;
  const dayOfYear = dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const mp = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp + (mp < 10 ? 3 : -9);
  return { year: y + (month <= 2 ? 1 : 0), month, day };
}

/**
 * Converts a local calendar date to a `StreakDay`. Rejects dates that do not
 * exist (2026-02-30, month 13) by round-tripping the result.
 *
 * Applies NO rollover-hour adjustment — this is "which civil day is this
 * date". Use `streakDayFromLocalWallClock` for "which streak day is this
 * moment in".
 *
 * @throws {RangeError} on a non-integer or non-existent date.
 */
export function streakDayFromCivilDate(date: CivilDate): StreakDay {
  const { year, month, day } = date;
  if (!Number.isSafeInteger(year) || !Number.isSafeInteger(month) || !Number.isSafeInteger(day)) {
    throw new RangeError(
      `streak: a civil date must have whole-number year, month and day, received ${year}-${month}-${day}`,
    );
  }
  const index = daysFromCivil(year, month, day);
  const roundTrip = civilFromDays(index);
  if (roundTrip.year !== year || roundTrip.month !== month || roundTrip.day !== day) {
    throw new RangeError(`streak: ${year}-${month}-${day} is not a real calendar date`);
  }
  return asStreakDay(index);
}

/** The calendar date a `StreakDay` refers to. */
export function civilDateFromStreakDay(day: StreakDay): CivilDate {
  return civilFromDays(day);
}

/**
 * THE ENTRY POINT A RUNNING APP OR SERVER SHOULD USE. Converts a local
 * wall-clock moment to the streak day it falls in, applying
 * `STREAK_DAY_BOUNDARY.ROLLOVER_HOUR_LOCAL`: anything before that hour belongs
 * to the previous streak day.
 *
 * The caller supplies the local date and hour, which is where the timezone
 * decision lives. See §1 of the header for what that does and does not solve.
 *
 * @throws {RangeError} on a non-existent date or an hour outside 0-23.
 */
export function streakDayFromLocalWallClock(now: LocalWallClock): StreakDay {
  if (
    !Number.isSafeInteger(now.hour) ||
    now.hour < 0 ||
    now.hour >= STREAK_DAY_BOUNDARY.HOURS_PER_DAY
  ) {
    throw new RangeError(`streak: local hour must be a whole number 0-23, received ${now.hour}`);
  }
  const civilDay = streakDayFromCivilDate(now);
  return now.hour < STREAK_DAY_BOUNDARY.ROLLOVER_HOUR_LOCAL ? addDays(civilDay, -1) : civilDay;
}

// ---------------------------------------------------------------------------
// State — and the allowlist that fences in what a Recovery Day can reach
// ---------------------------------------------------------------------------

/**
 * THE COMPLETE SET OF FIELDS `StreakState` MAY HAVE.
 *
 * This is the pay-to-win boundary, mechanised. See §4 of the header. If a
 * Recovery Day — earned, granted or bought — could touch Total, e1RM, training
 * pace or meet performance, that effect would have to be persisted somewhere,
 * and the only thing this module persists is a `StreakState`. Extending it
 * requires extending this list, in this file, under this comment.
 *
 * Exported as a runtime array so a critic can check the live object's keys
 * against it without reading a single line of logic; `streak.test.ts` does
 * exactly that.
 */
export const STREAK_FACT_KEYS = [
  'signupDay',
  'currentStreak',
  'longestStreak',
  'lastTrainedDay',
  'entitlement',
  'entitlementArmed',
  'recoveryDayProtectionEnabled',
  'hasBankedFirstRecoveryDaySave',
] as const;

export type StreakFactKey = (typeof STREAK_FACT_KEYS)[number];

/**
 * `true` when `keyof T` is EXACTLY `Keys` — neither a field missing from the
 * allowlist nor a stale allowlist entry. Tuple-wrapped so the unions do not
 * distribute.
 */
type KeysAreExactly<T, Keys extends string> = [Exclude<keyof T, Keys>] extends [never]
  ? [Exclude<Keys, keyof T>] extends [never]
    ? true
    : never
  : never;

/** Everything the streak system knows about one lifter. JSON-safe. */
export interface StreakState {
  /**
   * THE DAY THE ACCOUNT WAS CREATED (§1b of the header).
   *
   * Not the first session, not the first app open, not the day a migration ran:
   * account creation, which is the first day on which this lifter could
   * possibly have a gap. Written once and never moved.
   *
   * It is the ANCHOR every absence is measured from until the first training
   * day replaces it (`absenceAnchorDay`), which is what makes idle days before
   * a run cost the same as idle days inside one. REQUIRED AND NON-NULLABLE on
   * purpose: an absent signup day means no anchor, no absence and no charge,
   * which is precisely the asymmetry §6 exists to delete. Migration of accounts
   * that predate the field is `adoptSignupDay`'s job, and §1b says what value
   * it should be given.
   */
  readonly signupDay: StreakDay;
  /**
   * TRAINED days in the live run. Recovery Days keep a run alive but never add
   * to this — see §2 of the header for why that is the pay-to-win-safe choice.
   */
  readonly currentStreak: number;
  /**
   * Best `currentStreak` ever reached. Survives a break, and doubles as the
   * milestone ledger: milestone `m` has been paid iff `longestStreak >= m`.
   */
  readonly longestStreak: number;
  /** Last day the player trained. Null when there is no live run. */
  readonly lastTrainedDay: StreakDay | null;
  /**
   * THE ENTITLEMENT AS OF THE LAST SESSION — what coverage is funded from.
   *
   * Replaces `armedRecoveryDays` and `recoveryDayBalance`, which were a stock,
   * and the reason is the whole of GDD §4.2's Option 1 ruling: a doomed absence
   * consumes everything available, so a debit against a STOCK was proportional
   * to how much the lifter had hoarded, and training more is a way of hoarding.
   * An entitlement is the same number for everybody at the start of every
   * window, so there is nothing to be proportional to.
   *
   * IT IS A SNAPSHOT TAKEN AT A SESSION, not a live figure. Nothing that
   * happens while the lifter is away changes it, which is what keeps an
   * absence's outcome a pure function of the calendar. The one thing that
   * "changes" without a session is the window turning over, and that is a pure
   * function of the calendar too — `coveredDaysAvailable` reads it off the day,
   * not off a visit.
   *
   * `purchasedDaysLeft` IS ALWAYS ZERO IN EVERY SHIPPED PATH. GDD §8.3E's Extra
   * Covered Day is PROPOSED AND NOT RULED, so this module exports nothing that
   * can credit one; the field exists because `streakEntitlement.ts` is verified
   * with it. `streak.test.ts` asserts no exported function can make it
   * non-zero, so "the purchase path is not implemented" is checked rather than
   * promised.
   */
  readonly entitlement: EntitlementState;
  /**
   * Whether that entitlement is ARMED for the absence in progress — i.e.
   * whether protection was on at the last session (or at signup).
   *
   * SEPARATE FROM THE SETTING BELOW, and the separation is load-bearing.
   * Turning protection ON mid-absence must not rescue a run the calendar has
   * already ended, so the setting takes effect at the next session and this
   * flag is what an absence actually reads. Turning it OFF clears this
   * immediately, because that direction can only ever end a run early.
   *
   * WHY THIS IS A FLAG AND NOT A NULLABLE ENTITLEMENT. Making the entitlement
   * itself null when protection is off would lose the window snapshot, and
   * restoring it at the next session would hand out a FULL window — so
   * off-then-on would be a free refill. The entitlement is always present; only
   * whether it is armed changes.
   */
  readonly entitlementArmed: boolean;
  /**
   * GDD §4.2's settings toggle. `true` (the default) means every session arms
   * whatever is held, so holding at least one Recovery Day means protected.
   * `false` means the player has chosen to take broken streaks deliberately,
   * and no Recovery Day of theirs is ever spent.
   */
  readonly recoveryDayProtectionEnabled: boolean;
  /** Set once a Recovery Day save has been banked (GDD §4.3's teaching moment). */
  readonly hasBankedFirstRecoveryDaySave: boolean;
}

/**
 * COMPILE-TIME ASSERTION, not documentation: `StreakState`'s fields are exactly
 * `STREAK_FACT_KEYS`. Add `e1rmBonus` (or anything else, under any name) to the
 * state and `tsc --noEmit` fails here until the allowlist above is widened —
 * and remove a field without removing its allowlist entry and it fails too.
 */
export const RECOVERY_DAY_REACH_IS_STREAK_ONLY: KeysAreExactly<StreakState, StreakFactKey> = true;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type StreakErrorCode =
  /** The day given is before a day already accounted for. Clock skew or a bug. */
  | 'DAY_IN_PAST'
  /** A training day was already recorded for this day. */
  | 'ALREADY_TRAINED_TODAY'
  /** The run is intact or covered; there is nothing to settle. */
  | 'NOTHING_TO_SETTLE'
  /** Grant amount was not a positive whole number. */
  | 'INVALID_GRANT'
  /** A migration tried to set a signup day later than a recorded session. */
  | 'SIGNUP_DAY_AFTER_TRAINING';

export interface StreakError {
  readonly code: StreakErrorCode;
  /** Plain language. Some of these are developer errors; none leak internals. */
  readonly message: string;
}

export type StreakResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: StreakError };

function ok<T>(value: T): StreakResult<T> {
  return { ok: true, value };
}

function fail<T>(code: StreakErrorCode, message: string): StreakResult<T> {
  return { ok: false, error: { code, message } };
}

// ---------------------------------------------------------------------------
// Reading a streak
// ---------------------------------------------------------------------------

/**
 * A fresh lifter on `signupDay`: no run, a full window entitlement, and
 * protection on by default (`RECOVERY_DAY_PROTECTION.DEFAULT_ENABLED`).
 *
 * `signupDay` IS ACCOUNT CREATION and the caller owns resolving it — this
 * module never reads a clock (§1 of the header). It is also the ORIGIN OF THE
 * ENTITLEMENT WINDOW GRID (`windowIndexOf`), so a lifter's windows are anchored
 * to their own account rather than to a shared calendar month. That is
 * deliberate: a shared grid would give every player in the world a refresh on
 * the same day, and a lifter who signed up on the 30th would get a one-day
 * first window.
 *
 * IT IS ARMED HERE, WHICH IT USED NOT TO BE. The old version of this function
 * left a new lifter unprotected until their first session, which made the days
 * before that session free — and free days are what an extra trained day turns
 * into charged ones (§6). The signup day is an anchor like any other, so the
 * absence after it is chargeable like any other, so the entitlement is armed
 * against it like any other.
 *
 * WHAT THAT COSTS, stated rather than discovered: a lifter who creates an
 * account and then does not train for longer than
 * `LONGEST_REPAIRABLE_ABSENCE_DAYS` spends their first window's entitlement on
 * that absence. Unlike the old signup grant they do not lose it permanently —
 * the next window restores it — which is the single most visible improvement
 * the Option 1 ruling buys a new player.
 */
export function createStreakState(signupDay: StreakDay): StreakState {
  return {
    signupDay: asStreakDay(signupDay),
    currentStreak: 0,
    longestStreak: 0,
    lastTrainedDay: null,
    entitlement: freshEntitlement(RECOVERY_ENTITLEMENT, 0),
    entitlementArmed: RECOVERY_DAY_PROTECTION.DEFAULT_ENABLED,
    recoveryDayProtectionEnabled: RECOVERY_DAY_PROTECTION.DEFAULT_ENABLED,
    hasBankedFirstRecoveryDaySave: false,
  };
}

/**
 * The entitlement window a day falls in, for this lifter.
 *
 * Anchored at `signupDay`, so it is a fixed grid that nothing the lifter does
 * can shift — which is what the monotonicity property needs, because two
 * possible futures from the same state must share the same grid.
 */
export function entitlementWindowFor(state: StreakState, day: StreakDay): number {
  return windowIndexOf(RECOVERY_ENTITLEMENT, state.signupDay, day);
}

/**
 * Covered days this lifter can draw on as of `day`, protection included.
 *
 * 0 when protection was off at their last session, because nothing was armed.
 * The full window entitlement once the window has turned over, whether or not
 * anybody opened the app to see it.
 */
export function coveredDaysArmed(state: StreakState, day: StreakDay): number {
  if (!state.entitlementArmed) return 0;
  return coveredDaysAvailable(RECOVERY_ENTITLEMENT, state.entitlement, entitlementWindowFor(state, day));
}

/**
 * Covered days left in the window this state's snapshot belongs to, ignoring
 * both the calendar and the protection setting.
 *
 * THE DIRECT HEIR OF `recoveryDayBalance`, and it is what a screen shows as
 * "2 left this month". It deliberately does NOT take a day: it reports the
 * snapshot, not what a given day would resolve to. `coveredDaysArmed` is the
 * one that answers "what can this absence actually draw", and it is the one
 * every decision in this file reads — a reader who confuses the two will
 * conclude a lifter has nothing left when their window has in fact turned over.
 */
export function coveredDaysLeftInWindow(state: StreakState): number {
  return Math.max(0, state.entitlement.coveredDaysLeft) + Math.max(0, state.entitlement.purchasedDaysLeft);
}

/**
 * MIGRATION ONLY: writes a signup day onto a state that was built before the
 * field existed.
 *
 * There is deliberately no other way to move it. §1b says what value belongs
 * here (account creation, or the migration day if that is unrecoverable) and
 * why a later day is safe for monotonicity but still wrong.
 *
 * It refuses a day after `lastTrainedDay`, because a signup day after a session
 * is not a fact about anything — the trained day would win the anchor and the
 * stored value would be a lie nobody ever reads.
 *
 * @throws never. Errors come back as a `StreakResult`.
 */
export function adoptSignupDay(state: StreakState, signupDay: StreakDay): StreakResult<StreakState> {
  if (state.lastTrainedDay !== null && signupDay > state.lastTrainedDay) {
    return fail(
      'SIGNUP_DAY_AFTER_TRAINING',
      'An account cannot have been created after a session was recorded on it.',
    );
  }
  return ok({ ...state, signupDay: asStreakDay(signupDay) });
}

/**
 * THE DAY EVERY ABSENCE IS MEASURED FROM: the last TRAINED day if there is one,
 * and `signupDay` if there is not.
 *
 * ONE FUNCTION, SO THERE IS ONE ANSWER. Before the signup-day rework this
 * choice was made inline in `daysMissedBefore` and the "no live run" branch
 * returned 0 days missed, which made every idle day before a lifter's first
 * session free. §6 of the header has the measurement that cost.
 *
 * A state whose run has ENDED has `lastTrainedDay: null` and therefore anchors
 * at the signup day too. That is not a special case and it changes nothing: the
 * absence measured from the signup day is at least as long as the one measured
 * from the day the run died, so it is doomed either way, and `settleBrokenStreak`
 * has already zeroed what it could have cost.
 */
export function absenceAnchorDay(state: StreakState): StreakDay {
  return state.lastTrainedDay ?? state.signupDay;
}

/**
 * Days between `absenceAnchorDay` and `today` that the player did not train. 0
 * when the run is intact (trained today, or today is the very next day) and 0
 * on the anchor day itself.
 *
 * MEASURED FROM THE ANCHOR AND NOTHING ELSE. There is no coverage marker to
 * measure from, because nothing is committed part-way through an absence. That
 * is what removed the old "does a spend re-arm the grace?" question rather than
 * answering it.
 */
export function daysMissedBefore(state: StreakState, today: StreakDay): number {
  return Math.max(0, daysBetween(absenceAnchorDay(state), today) - 1);
}

/**
 * How many days of an absence of `gapDays` days a Recovery Day has to be spent
 * on: everything past `RECOVERY_DAY_GUARDRAILS.FREE_GRACE_GAP_DAYS`.
 *
 * The grace is charged against the absence as a whole, and there is no state in
 * which part of it has already been used up, so this needs the absence length
 * and nothing else.
 */
export function chargeableGapDays(gapDays: number): number {
  return Math.max(0, gapDays - RECOVERY_DAY_GUARDRAILS.FREE_GRACE_GAP_DAYS);
}

/**
 * The Recovery Days an absence ending on `today` costs this state. 0 for an
 * absence the grace covers outright, and 0 when there is no absence at all.
 *
 * THE ONE FUNCTION EVERY DECISION READS. `absenceOutcome`, `openDay`,
 * `recordTrainingDay` and `settleBrokenStreak` all ask this rather than each
 * subtracting a grace of their own, so "free" means the same thing on the
 * reveal screen, in the read model and in the transition.
 */
export function chargeableDaysBefore(state: StreakState, today: StreakDay): number {
  return chargeableGapDays(daysMissedBefore(state, today));
}

/**
 * How many chargeable days this state can actually pay for as of `today`: what
 * is armed, capped by what one absence may draw.
 *
 * READS THE ENTITLEMENT, NOT A BALANCE. That single choice is what makes an
 * absence's fate independent of everything that happens during it, and it is
 * now also what makes the fate independent of how much the lifter has hoarded —
 * because there is nothing to hoard.
 */
export function armedGapDays(state: StreakState, today: StreakDay): number {
  return Math.max(0, Math.min(coveredDaysArmed(state, today), RECOVERY_ENTITLEMENT.MAX_COVERED_DAYS_PER_ABSENCE));
}

/**
 * How many consecutive missed days this state can survive, resolving on
 * `today`: the free grace plus whatever the entitlement can pay for.
 *
 * An absence this long or shorter keeps the run alive. A longer one ends it.
 */
export function coverableGapDays(state: StreakState, today: StreakDay): number {
  return RECOVERY_DAY_GUARDRAILS.FREE_GRACE_GAP_DAYS + armedGapDays(state, today);
}

/** Last day the player can train without missing anything. Null with no run. */
export function streakDeadlineDay(state: StreakState): StreakDay | null {
  const { lastTrainedDay } = state;
  return lastTrainedDay === null ? null : addDays(lastTrainedDay, 1);
}

/**
 * Last day on which this run can still be alive — "train by here or it ends".
 * Equals `streakDeadlineDay` when nothing is armed. Null with no run.
 *
 * FIXED FOR THE WHOLE ABSENCE. It is computed from the last trained day and the
 * Recovery Days armed there, neither of which moves while the player is away,
 * so reminder copy built on it cannot change its mind halfway through.
 */
export function lastDayStreakCanBeSaved(state: StreakState, today: StreakDay): StreakDay | null {
  const deadline = streakDeadlineDay(state);
  return deadline === null ? null : addDays(deadline, coverableGapDays(state, today));
}

// ---------------------------------------------------------------------------
// The absence: the one place the whole rule lives
// ---------------------------------------------------------------------------

/** Why a run ended. */
export type StreakBreakReason =
  /**
   * More chargeable days than `MAX_COVERED_DAYS_PER_ABSENCE` could ever cover,
   * whatever the window holds. The heir of the consecutive-use limit.
   */
  | 'absence-longer-than-consecutive-limit'
  /** The player turned Recovery Day protection off (GDD §4.2's toggle). */
  | 'recovery-day-protection-declined'
  /** Fewer Recovery Days were armed than the chargeable days needed. */
  | 'not-enough-recovery-days-armed';

/**
 * What the absence ending on `today` does to this run — the complete answer,
 * derived from `(lastTrainedDay, armedRecoveryDays, today)` and NOTHING ELSE.
 *
 * That parameter list is the invariant this rework exists for, so it is worth
 * naming what is *not* in it: the day the player opened the app, how many times
 * they opened it, whether they opened it at all, and any Recovery Day that
 * arrived after their last session.
 */
export interface AbsenceOutcome {
  /** Days since the last trained day that the player did not train. */
  readonly daysMissed: number;
  /**
   * The missed days themselves, ascending — but only when protection holds,
   * where the count is bounded by `LONGEST_REPAIRABLE_ABSENCE_DAYS`. An absence
   * that ended the run can be arbitrarily long and covers nothing, so there is
   * nothing to enumerate and this is empty.
   */
  readonly coveredDays: readonly StreakDay[];
  /** How many of them the free grace covers for nothing (GDD §4.4). */
  readonly daysCoveredFreeByGrace: number;
  /**
   * Covered days holding the run open across this absence. 0 when the absence
   * outlived what was armed — nothing is holding a run that has ended.
   */
  readonly recoveryDaysHolding: number;
  /**
   * Covered days this absence COSTS, whether or not it saved anything.
   *
   * Equal to `recoveryDaysHolding` while the run is alive, and to EVERYTHING
   * LEFT IN THE WINDOW once it is not (GDD §4.2 RULE 2, carried into the
   * entitlement). The burn is kept because it is the only consumption that is
   * idempotent under splitting an absence, and dropping it measures 1051
   * violating pairs at 60 days — worse than the stock design it replaced.
   *
   * FIXED FOR THE WHOLE ABSENCE IN BOTH CASES, which is what keeps the outcome
   * independent of when anybody looks. Debited by the training day that ends
   * the absence, and by nothing else.
   */
  readonly recoveryDaysConsumed: number;
  /** True when the run is still alive as of `today`. */
  readonly protectionHolds: boolean;
  /** Why it is not, when it is not. Null while the run is alive. */
  readonly breakReason: StreakBreakReason | null;
}

/**
 * Resolves the absence ending on `today`.
 *
 * PURE, TOTAL AND IDEMPOTENT IN THE WAY THAT MATTERS: calling it on day X and
 * again on day Y > X gives the same answer for day Y as calling it on day Y
 * alone, because the first call changed nothing there was to change.
 */
export function absenceOutcome(state: StreakState, today: StreakDay): AbsenceOutcome {
  const anchor = absenceAnchorDay(state);
  const daysMissed = daysMissedBefore(state, today);
  const chargeable = chargeableGapDays(daysMissed);
  const daysCoveredFreeByGrace = daysMissed - chargeable;

  // THE ONE PLACE COVERAGE IS DECIDED, and it is a pure function of
  // (anchor, entitlement snapshot, today). Not of the balance, because there is
  // no balance; not of the day anybody opened the app, because that is not a
  // parameter here and cannot become one.
  //
  // DECLINING PROTECTION ZEROES WHAT IS AVAILABLE; IT DOES NOT SKIP THE
  // RESOLUTION. That distinction is the whole of GDD §4.4's ruling that the free
  // grace survives the settings toggle: the toggle declines DRAWING on the
  // entitlement, and the grace draws nothing, so there is nothing in it to
  // decline. Running the disarmed case through the same `resolveEntitlement`
  // call with an empty window makes that fall out of the arithmetic —
  // `chargeable <= 0` still covers, and `consumed` is still 0 — instead of
  // depending on a second branch that has to remember to say so. An earlier
  // revision short-circuited to `holds = false` when nothing was armed, which
  // ended a run for a one-day miss and reset the streak on a lifter who had
  // trained the day before.
  const window = entitlementWindowFor(state, today);
  const armedEntitlement: EntitlementState = state.entitlementArmed
    ? state.entitlement
    : { windowIndex: window, coveredDaysLeft: 0, purchasedDaysLeft: 0 };
  const outcome = resolveEntitlement(RECOVERY_ENTITLEMENT, armedEntitlement, window, chargeable);
  const holds = outcome.covers;

  if (!holds) {
    return {
      daysMissed,
      coveredDays: [],
      daysCoveredFreeByGrace,
      recoveryDaysHolding: 0,
      // Everything left in the window, not `chargeable`: `chargeable` grows for
      // as long as the lifter stays away, and a debit that grew with it would
      // make the outcome depend on when the absence was resolved. What is left
      // in the window does not move while they are away. See §5.
      recoveryDaysConsumed: outcome.consumed,
      protectionHolds: false,
      breakReason: breakReasonFor(state, chargeable),
    };
  }

  const coveredDays: StreakDay[] = [];
  for (let offset = 1; offset <= daysMissed; offset += 1) {
    coveredDays.push(addDays(anchor, offset));
  }
  return {
    daysMissed,
    coveredDays,
    daysCoveredFreeByGrace,
    recoveryDaysHolding: chargeable,
    recoveryDaysConsumed: chargeable,
    protectionHolds: true,
    breakReason: null,
  };
}

/**
 * Why an absence with `chargeable` chargeable days could not be held open.
 *
 * ORDERED HARDEST CONSTRAINT FIRST, so that
 * `'recovery-day-protection-declined'` is reported only where turning
 * protection back on would actually have changed the outcome. A UI that says
 * "you could have kept this" when nothing could have kept it is worse than one
 * that says nothing.
 *
 * Every input is a `StreakState` field, so the reason is as independent of
 * app-opening as the outcome it explains.
 */
function breakReasonFor(state: StreakState, chargeable: number): StreakBreakReason {
  if (chargeable > RECOVERY_ENTITLEMENT.MAX_COVERED_DAYS_PER_ABSENCE) {
    return 'absence-longer-than-consecutive-limit';
  }
  if (!state.entitlementArmed) return 'recovery-day-protection-declined';
  return 'not-enough-recovery-days-armed';
}

// ---------------------------------------------------------------------------
// The read model a screen renders
// ---------------------------------------------------------------------------

/**
 * What the player should be shown when they open the app on `today`.
 *
 * A PURE READ MODEL: `openDay` mutates nothing, and — since the rework — there
 * is nothing it could usefully mutate. `'streak-broken'` means "this run ended
 * while you were away"; the state still holds the finished run until
 * `recordTrainingDay` or `settleBrokenStreak` writes the fact down, and writing
 * it down cannot change what happened.
 */
export type DayOpening =
  /** No live run: a brand-new lifter, or one whose last run has ended. */
  /**
   * No live run: a brand-new lifter, or one whose last run has ended.
   *
   * IT STILL REPORTS A PENDING CONSUMPTION, and that is not decoration. A
   * lifter who has never trained is inside a chargeable absence from their
   * signup day (§1b), so the Recovery Days armed at account creation can be
   * spent by the session that ends it — and this was the one opening kind from
   * which that was invisible. "Reported, never silent" has to hold for the
   * signup-grant expiry too, not only for a run that dies.
   */
  | {
      readonly kind: 'no-active-streak';
      readonly longestStreak: number;
      /**
       * What the lifter's next session will pay for the absence they are
       * currently in. 0 while the grace still covers it.
       */
      readonly recoveryDaysCommittedToTheAbsence: number;
      /** Covered days available right now. Nothing has been taken yet. */
      readonly coveredDaysAvailable: number;
    }
  /** Already trained today. Nothing to do; nothing at risk. */
  | { readonly kind: 'already-trained-today'; readonly currentStreak: number }
  /** The run is intact and today extends it. */
  | {
      readonly kind: 'streak-alive';
      readonly currentStreak: number;
      readonly streakIfTrainedToday: number;
      readonly lastDayStreakCanBeSaved: StreakDay;
    }
  /**
   * Days were missed, the free grace covers all of them, and nothing was spent
   * (GDD §4.4). The run is alive. It is its own kind rather than folded into
   * `'streak-alive'` so a UI can say "you missed two days — covered, no
   * Recovery Day used" instead of pretending nothing happened.
   */
  | {
      readonly kind: 'gap-covered-by-grace';
      readonly currentStreak: number;
      readonly streakIfTrainedToday: number;
      readonly daysMissed: number;
      readonly lastDayStreakCanBeSaved: StreakDay;
    }
  /**
   * THE RETURN-VISIT REVEAL (GDD §4.2, §4.3). Days were missed, the grace did
   * not cover all of them, and the Recovery Days armed at the player's last
   * session are holding the run open.
   *
   * IT IS NEWS, NOT A QUESTION. There is no accept, no decline and no timer:
   * the save already happened, on the days it was needed. The screen exists so
   * the player *feels* it — which is the whole of what the old prompt was for.
   */
  | {
      readonly kind: 'gap-covered-by-recovery-days';
      readonly currentStreak: number;
      readonly streakIfTrainedToday: number;
      readonly daysMissed: number;
      /** How many of them cost nothing (GDD §4.4). */
      readonly daysCoveredFreeByGrace: number;
      /** How many Recovery Days are holding the rest. Always at least 1. */
      readonly recoveryDaysHolding: number;
      /** Covered days left in this window once today's session banks the save. */
      readonly balanceIfBankedToday: number;
      /** "Train by here." Fixed for the whole absence — see the function. */
      readonly lastDayStreakCanBeSaved: StreakDay;
      /** GDD §4.3: show the explanation the first time this ever happens. */
      readonly isFirstRecoveryDaySave: boolean;
    }
  /** The run ended while the player was away, and nothing could have held it. */
  | {
      readonly kind: 'streak-broken';
      readonly brokenRunLength: number;
      readonly daysMissed: number;
      readonly reason: StreakBreakReason;
      /**
       * Covered days available RIGHT NOW. Unchanged by the break itself — the
       * break draws nothing.
       */
      readonly coveredDaysAvailable: number;
      /**
       * What the absence will cost once the player's next session closes it:
       * the Recovery Days that were armed against it and could not hold it
       * (§5). Shown so the reveal can be honest rather than leaving the player
       * to notice a smaller number later.
       */
      readonly recoveryDaysCommittedToTheAbsence: number;
    }
  /**
   * `today` is earlier than a day already accounted for. Only reachable through
   * clock skew or a bad caller; surfaced rather than silently absorbed.
   */
  | { readonly kind: 'day-in-past'; readonly requestedDay: StreakDay; readonly lastTrainedDay: StreakDay };

export function openDay(state: StreakState, today: StreakDay): DayOpening {
  if (state.lastTrainedDay === null) {
    return {
      kind: 'no-active-streak',
      longestStreak: state.longestStreak,
      recoveryDaysCommittedToTheAbsence: absenceOutcome(state, today).recoveryDaysConsumed,
      coveredDaysAvailable: coveredDaysArmed(state, today),
    };
  }
  if (today === state.lastTrainedDay) {
    return { kind: 'already-trained-today', currentStreak: state.currentStreak };
  }
  if (today < state.lastTrainedDay) {
    return { kind: 'day-in-past', requestedDay: today, lastTrainedDay: state.lastTrainedDay };
  }

  const absence = absenceOutcome(state, today);
  if (absence.daysMissed === 0) {
    return {
      kind: 'streak-alive',
      currentStreak: state.currentStreak,
      streakIfTrainedToday: state.currentStreak + 1,
      lastDayStreakCanBeSaved: lastDayStreakCanBeSaved(state, today) ?? today,
    };
  }
  if (!absence.protectionHolds) {
    return {
      kind: 'streak-broken',
      brokenRunLength: state.currentStreak,
      daysMissed: absence.daysMissed,
      reason: absence.breakReason ?? 'not-enough-recovery-days-armed',
      coveredDaysAvailable: coveredDaysArmed(state, today),
      recoveryDaysCommittedToTheAbsence: absence.recoveryDaysConsumed,
    };
  }
  if (absence.recoveryDaysHolding === 0) {
    return {
      kind: 'gap-covered-by-grace',
      currentStreak: state.currentStreak,
      streakIfTrainedToday: state.currentStreak + 1,
      daysMissed: absence.daysMissed,
      lastDayStreakCanBeSaved: lastDayStreakCanBeSaved(state, today) ?? today,
    };
  }
  return {
    kind: 'gap-covered-by-recovery-days',
    currentStreak: state.currentStreak,
    streakIfTrainedToday: state.currentStreak + 1,
    daysMissed: absence.daysMissed,
    daysCoveredFreeByGrace: absence.daysCoveredFreeByGrace,
    recoveryDaysHolding: absence.recoveryDaysHolding,
    balanceIfBankedToday: coveredDaysArmed(state, today) - absence.recoveryDaysHolding,
    lastDayStreakCanBeSaved: lastDayStreakCanBeSaved(state, today) ?? today,
    isFirstRecoveryDaySave: !state.hasBankedFirstRecoveryDaySave,
  };
}

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

/**
 * A run that has ended, reset to "no live run". `longestStreak` survives.
 *
 * IT DRAWS NOTHING AND IT KEEPS THE ENTITLEMENT SNAPSHOT, which is not an
 * oversight. What is armed is a COMMITMENT to the absence that killed the run,
 * and §5 charges it on the training day that ends that absence — the same place
 * a covered absence is charged. Clearing it here would move the debit to
 * whichever day somebody happened to call `settleBrokenStreak`, which would
 * make the outcome depend on when the app was opened. The commitment survives
 * the settle; the debit happens once, later, and only if the player comes back.
 */
function endRun(state: StreakState): StreakState {
  return {
    ...state,
    currentStreak: 0,
    lastTrainedDay: null,
  };
}

/**
 * THE COMPLETE SET OF FIELDS `RecoveryDaySave` MAY HAVE — the second half of
 * the allowlist described in §4 of the header. This is everything spending a
 * Recovery Day reports, and every entry is a streak fact or a description of
 * the spend itself. Adding one fails `tsc` until it is listed here, and so does
 * deleting one without deleting its entry.
 */
export const RECOVERY_DAY_OUTCOME_KEYS = [
  'coveredDays',
  'daysCoveredFreeByGrace',
  'recoveryDaysSpent',
  'balanceAfter',
  'streakProtected',
  'wasFirstRecoveryDaySave',
] as const;

export type RecoveryDayOutcomeKey = (typeof RECOVERY_DAY_OUTCOME_KEYS)[number];

/**
 * What a Recovery Day save actually did. Reported by the training day that
 * banked it, and by nothing else — there is no separate "spend" entry point to
 * report from, which is the structural half of GDD §4.2's auto-protect ruling.
 *
 * NO SOURCE FIELD, AND NO WAY TO OBTAIN ONE. See (c) in §4 of the header: the
 * only function that can debit the balance is `recordTrainingDay(state, day)`,
 * which cannot be told where a Recovery Day came from, so a bought one and an
 * earned one are the same object.
 */
export interface RecoveryDaySave {
  /** The missed days now covered, ascending. The whole absence. */
  readonly coveredDays: readonly StreakDay[];
  /** How many of them the free grace covered for nothing (GDD §4.4). */
  readonly daysCoveredFreeByGrace: number;
  /** `coveredDays.length - daysCoveredFreeByGrace`. Always at least 1. */
  readonly recoveryDaysSpent: number;
  /** Covered days left in the window after this session. */
  readonly balanceAfter: number;
  /** The run that survived. Unchanged by the save — Recovery Days do not count. */
  readonly streakProtected: number;
  /** True if this was the first save this lifter has ever banked (GDD §4.3). */
  readonly wasFirstRecoveryDaySave: boolean;
}

/** Compile-time assertion, same mechanism as `RECOVERY_DAY_REACH_IS_STREAK_ONLY`. */
export const RECOVERY_DAY_OUTCOME_IS_STREAK_ONLY: KeysAreExactly<
  RecoveryDaySave,
  RecoveryDayOutcomeKey
> = true;

/** What a recorded training day did. */
export interface TrainingDayOutcome {
  readonly state: StreakState;
  readonly day: StreakDay;
  readonly streakBefore: number;
  readonly streakAfter: number;
  /** True when a previous run ended before today and nothing could hold it. */
  readonly previousRunEnded: boolean;
  /** Length of that ended run, 0 if none ended. */
  readonly endedRunLength: number;
  /** Why it ended, or null if none did. */
  readonly endedRunReason: StreakBreakReason | null;
  /**
   * The Recovery Day save this session banked, or null if there was nothing to
   * bank. THE ONLY PLACE A RECOVERY DAY IS EVER SPENT.
   */
  readonly recoveryDaySave: RecoveryDaySave | null;
  /**
   * Recovery Days this session paid for an absence that had ALREADY ended the
   * run — armed against it, unable to hold it, and spent anyway (§5).
   *
   * 0 whenever the run survived, so it and `recoveryDaySave` are never both
   * non-zero. It is reported rather than folded into the save because it is the
   * opposite kind of news: a save is "your run held", this is "your run did
   * not, and here is what it cost". A UI that stayed silent about it would show
   * a balance dropping for no visible reason.
   */
  readonly recoveryDaysLostToTheAbsence: number;
  /** Milestones reached today for the first time ever (GDD §4.2), ascending. */
  readonly milestonesReached: readonly number[];
  /**
   * ALWAYS ZERO. A milestone is a moment, not a payout — see
   * `STREAK_MILESTONE_DAYS` for the measurement that forbids paying covered
   * days at a streak length. Kept on the outcome, and pinned at zero by
   * `streak.test.ts`, so that re-adding the payout is a visible edit here and a
   * red test rather than a quiet change to an earning table.
   */
  readonly recoveryDaysGranted: number;
  readonly isNewLongestStreak: boolean;
  /**
   * Covered days armed for the NEXT absence — what this session leaves in the
   * window, or null if protection is off. GDD §4.2: arming is what a session
   * does, and there is no other arming step.
   */
  readonly armedForNextAbsence: number | null;
}

/**
 * Records that the player trained on `day`. THE ONLY WAY `currentStreak`
 * INCREASES, THE ONLY WAY A RECOVERY DAY IS SPENT, AND THE ONLY WAY ONE IS
 * ARMED.
 *
 * Takes a day and nothing else: there is no parameter for a Recovery Day, a
 * purchase, a boost or a session quality, so nothing bought can change what
 * showing up is worth (§4 of the header).
 *
 * IT NEVER REFUSES BECAUSE OF A PENDING DECISION, because there are no
 * decisions left to pend on. The old implementation returned
 * `RECOVERY_DECISION_PENDING` here to stop a caller skipping the player's
 * prompt; GDD §4.2's auto-protect ruling deleted the prompt, and the error code
 * with it. Training is never blocked by the Recovery Day system.
 */
export function recordTrainingDay(state: StreakState, day: StreakDay): StreakResult<TrainingDayOutcome> {
  if (day === state.lastTrainedDay) {
    return fail('ALREADY_TRAINED_TODAY', 'Today is already logged. Your streak is safe.');
  }
  if (state.lastTrainedDay !== null && day < state.lastTrainedDay) {
    return fail(
      'DAY_IN_PAST',
      'That day has already been accounted for, so it cannot be recorded again.',
    );
  }

  const absence = absenceOutcome(state, day);
  const previousRunEnded = !absence.protectionHolds;
  const base = previousRunEnded ? endRun(state) : state;

  // THE ONE DEBIT, AND IT DOES NOT ASK WHETHER THE RUN SURVIVED (§5). A covered
  // absence costs the days past the grace; a doomed one costs everything left
  // in the window. Both figures are fixed for the whole absence, so neither can
  // depend on when the app was opened.
  const spend = absence.recoveryDaysConsumed;
  const window = entitlementWindowFor(state, day);
  const entitlementAfter = afterSession(RECOVERY_ENTITLEMENT, state.entitlement, window, spend);
  const balanceAfter = coveredDaysAvailable(RECOVERY_ENTITLEMENT, entitlementAfter, window);
  const streakAfter = base.currentStreak + 1;

  // Once per lifetime, and PAYING NOTHING. A milestone is due exactly when this
  // session pushes the streak to it for the first time ever, which
  // `longestStreak` already records — it is a moment for the UI to mark, not an
  // earning event. See `STREAK_MILESTONE_DAYS` for the measurement that forbids
  // paying covered days here: a grant whose arrival day the lifter's own
  // training can move is the defect GDD §4.4 traces.
  const milestonesReached = STREAK_MILESTONE_DAYS.filter(
    (milestone) => streakAfter >= milestone && base.longestStreak < milestone,
  );

  // ARMING. Whatever the window has left at the end of the session covers the
  // next absence, unless the player has declined protection in settings.
  const armedForNextAbsence = state.recoveryDayProtectionEnabled ? balanceAfter : null;

  const recoveryDaySave: RecoveryDaySave | null =
    !previousRunEnded && spend > 0
      ? {
          coveredDays: absence.coveredDays,
          daysCoveredFreeByGrace: absence.daysCoveredFreeByGrace,
          recoveryDaysSpent: spend,
          balanceAfter,
          streakProtected: state.currentStreak,
          wasFirstRecoveryDaySave: !state.hasBankedFirstRecoveryDaySave,
        }
      : null;

  return ok({
    state: {
      signupDay: state.signupDay,
      currentStreak: streakAfter,
      longestStreak: Math.max(base.longestStreak, streakAfter),
      lastTrainedDay: day,
      entitlement: entitlementAfter,
      entitlementArmed: state.recoveryDayProtectionEnabled,
      recoveryDayProtectionEnabled: state.recoveryDayProtectionEnabled,
      hasBankedFirstRecoveryDaySave: state.hasBankedFirstRecoveryDaySave || recoveryDaySave !== null,
    },
    day,
    streakBefore: state.currentStreak,
    streakAfter,
    previousRunEnded,
    endedRunLength: previousRunEnded ? state.currentStreak : 0,
    endedRunReason: previousRunEnded ? absence.breakReason : null,
    recoveryDaySave,
    recoveryDaysLostToTheAbsence: previousRunEnded ? spend : 0,
    milestonesReached,
    recoveryDaysGranted: 0,
    isNewLongestStreak: streakAfter > state.longestStreak,
    armedForNextAbsence,
  });
}

/** What settling a run that has already ended did. */
export interface StreakBreakOutcome {
  readonly state: StreakState;
  /** The run that ended. */
  readonly endedRunLength: number;
  readonly daysMissed: number;
  readonly reason: StreakBreakReason;
  /**
   * Covered days available afterwards. UNCHANGED by settling: the break itself
   * draws nothing. What the absence costs is debited by the session that ends
   * it (§5), so a player who never returns is never charged.
   */
  readonly balanceAfter: number;
  /**
   * What this absence WILL cost when the player's next session closes it — the
   * armed count, already committed and unable to hold the run.
   *
   * Reported so a "your streak ended" screen can be honest about the balance
   * the player is about to see, rather than showing an unchanged number now and
   * a smaller one after their next session.
   */
  readonly recoveryDaysCommittedToTheAbsence: number;
}

/**
 * Writes down a run that the calendar has already ended.
 *
 * Optional: `recordTrainingDay` settles the same break on its own. This exists
 * so a "your streak ended" screen, or a server-side nightly job, can record the
 * fact without waiting for the next session.
 *
 * IT CANNOT CHANGE ANY OUTCOME, and that is the point rather than a caveat. The
 * run ended on the day the absence outran what was armed; this only records it.
 * Calling it early, late, repeatedly or never leaves the player in exactly the
 * same place — which is why `streak.test.ts` can assert that opening the app is
 * neutral by full state equality.
 *
 * It never spends a Recovery Day, because an absence that ends a run never
 * spends one (§5 of the header).
 */
export function settleBrokenStreak(state: StreakState, today: StreakDay): StreakResult<StreakBreakOutcome> {
  // THERE IS NO RUN TO SETTLE BEFORE THE FIRST SESSION, and this guard is why
  // the signup anchor did not quietly turn every new account into a settleable
  // break. A lifter who has not trained has no run; their signup absence is
  // still charged, by the session that ends it, like everyone else's.
  if (state.lastTrainedDay === null) {
    return fail('NOTHING_TO_SETTLE', 'There is no streak running, so there is nothing to settle.');
  }
  const absence = absenceOutcome(state, today);
  if (absence.daysMissed === 0) {
    return fail('NOTHING_TO_SETTLE', 'Your streak is intact — there is nothing to settle.');
  }
  if (absence.protectionHolds) {
    return fail('NOTHING_TO_SETTLE', 'That absence is covered — your streak is intact.');
  }
  return ok({
    state: endRun(state),
    endedRunLength: state.currentStreak,
    daysMissed: absence.daysMissed,
    reason: absence.breakReason ?? 'not-enough-recovery-days-armed',
    balanceAfter: coveredDaysArmed(state, today),
    recoveryDaysCommittedToTheAbsence: absence.recoveryDaysConsumed,
  });
}

/** What changing the protection setting did. */
export interface RecoveryDayProtectionOutcome {
  readonly state: StreakState;
  readonly protectionEnabled: boolean;
  /** Covered days armed after the change, or null once protection is declined. */
  readonly armedRecoveryDays: number | null;
  /**
   * Whether the change reaches the absence the player is in right now.
   *
   * Turning protection OFF always does. Turning it ON never does — arming
   * happens at a training session — so a UI should say "armed from your next
   * session" rather than let the player assume otherwise.
   */
  readonly appliesToTheAbsenceInProgress: boolean;
}

/**
 * GDD §4.2's settings toggle: the one place a player still chooses.
 *
 * OFF IS IMMEDIATE. `armedRecoveryDays` is cleared on the spot, so a player who
 * has declined protection cannot have a Recovery Day spent for them, including
 * on an absence already in progress. That direction is safe to apply
 * immediately because it can only ever end a run early — it can never rescue
 * one, so it cannot make an outcome depend on when it was done.
 *
 * ON APPLIES FROM THE NEXT SESSION. Arming mid-absence would let a player (or a
 * check-in that dropped a Recovery Day, then a toggle) resurrect a run the
 * calendar had already ended, which is the same "the outcome depends on when
 * you act" defect this rework removed. The setting is stored immediately; only
 * the arming waits.
 *
 * Takes no day, because neither direction needs one.
 */
export function setRecoveryDayProtection(
  state: StreakState,
  enabled: boolean,
): RecoveryDayProtectionOutcome {
  // OFF disarms on the spot. ON leaves the armed flag alone — the next session
  // sets it — so turning protection on mid-absence cannot rescue a run the
  // calendar has already ended.
  //
  // THE ENTITLEMENT ITSELF IS NEVER CLEARED, and that is what stops
  // off-then-on-then-train being a free refill: a session after protection
  // returns arms whatever the window still had, not a fresh window.
  const entitlementArmed = enabled ? state.entitlementArmed : false;
  return {
    state: { ...state, recoveryDayProtectionEnabled: enabled, entitlementArmed },
    protectionEnabled: enabled,
    armedRecoveryDays: entitlementArmed ? state.entitlement.coveredDaysLeft : null,
    appliesToTheAbsenceInProgress: !enabled,
  };
}

// ---------------------------------------------------------------------------
// Migration off the Recovery Day stock
// ---------------------------------------------------------------------------

/**
 * THE SHAPE AN ACCOUNT HAD BEFORE GDD §4.2's OPTION 1 RULING.
 *
 * Kept as a type so a migration has something to name, and DELIBERATELY NOT
 * ASSIGNABLE TO `StreakState`: the new state has no balance field, so a stored
 * balance is not something the running game can express. That is the same
 * standard `signupDay` was held to — the bad case is unrepresentable rather
 * than handled — and it matters more here, because a balance that survived the
 * migration would be exactly the hoard the ruling removed.
 */
export interface LegacyStreakStateWithBalance {
  readonly signupDay: StreakDay;
  readonly currentStreak: number;
  readonly longestStreak: number;
  readonly lastTrainedDay: StreakDay | null;
  readonly armedRecoveryDays: number | null;
  readonly recoveryDayBalance: number;
  readonly recoveryDayProtectionEnabled: boolean;
  readonly hasBankedFirstRecoveryDaySave: boolean;
}

/** What migrating an account off the Recovery Day stock did. */
export interface StreakMigrationOutcome {
  readonly state: StreakState;
  /**
   * Recovery Days the account was holding. REPORTED, NEVER SILENT — a player
   * whose balance is converted has to be told, and the only way to tell them is
   * for the migration to say what it found.
   *
   * It is a number for the caller to compensate with, not a number this module
   * acts on. See `compensationOwed`.
   */
  readonly legacyRecoveryDaysHeld: number;
  /**
   * Recovery Days the caller still owes this player compensation for.
   *
   * EQUAL TO `legacyRecoveryDaysHeld`, ALWAYS, and that is a decision rather
   * than a placeholder. This module converts a held balance into exactly
   * nothing mechanical, because every way of converting it is wrong:
   *
   *   - carrying it as a stock is the defect the ruling removed;
   *   - adding it to the current window is GDD §8.3E's Extra Covered Day, which
   *     is PROPOSED AND NOT RULED, and a migration is not the place to ship an
   *     unruled product;
   *   - discarding it silently takes something a player may have paid for.
   *
   * So the migration hands the number back and the compensation is the caller's
   * to make in a currency this module does not know about — Chalk, most likely.
   * GDD §8.2 carries that as an open question with the human.
   */
  readonly compensationOwed: number;
  /**
   * True when this account gets MORE coverage immediately than it had. A lifter
   * who had drained their balance to nothing now has a full window.
   */
  readonly betterOffImmediately: boolean;
}

/**
 * MIGRATION ONLY: turns an account that holds a Recovery Day balance into one
 * that runs on the rolling entitlement.
 *
 * WHAT IT DOES TO THE BALANCE: nothing mechanical, and it says so out loud. See
 * `compensationOwed` for why every alternative is worse.
 *
 * WHAT IT DOES TO COVERAGE: gives the account the same entitlement every other
 * account has in that window — no more, no less. That is the property that
 * matters, and `streak.test.ts` asserts it directly: a migrated state and a
 * freshly created one, at the same window, are indistinguishable in everything
 * coverage reads. A migration that granted a bonus for a large old balance
 * would reintroduce exactly the wealth the ruling deleted, in the one code path
 * nobody sweeps.
 *
 * THE ARMED FLAG IS CARRIED OVER FROM THE OLD ARMED COUNT rather than defaulted
 * on. An account whose owner had declined protection stays declined; an account
 * mid-absence stays armed if it was armed. Defaulting it on would arm an
 * absence in progress, which is the "turning protection on mid-absence rescues
 * a dead run" case §3 refuses.
 *
 * @throws never. This cannot fail: every legacy state has a migration.
 */
export function migrateFromRecoveryDayBalance(
  legacy: LegacyStreakStateWithBalance,
  migrationDay: StreakDay,
): StreakMigrationOutcome {
  const window = windowIndexOf(RECOVERY_ENTITLEMENT, legacy.signupDay, migrationDay);
  const held = Math.max(0, legacy.recoveryDayBalance);
  return {
    state: {
      signupDay: legacy.signupDay,
      currentStreak: legacy.currentStreak,
      longestStreak: legacy.longestStreak,
      lastTrainedDay: legacy.lastTrainedDay,
      entitlement: freshEntitlement(RECOVERY_ENTITLEMENT, window),
      entitlementArmed: legacy.armedRecoveryDays !== null,
      recoveryDayProtectionEnabled: legacy.recoveryDayProtectionEnabled,
      hasBankedFirstRecoveryDaySave: legacy.hasBankedFirstRecoveryDaySave,
    },
    legacyRecoveryDaysHeld: held,
    compensationOwed: held,
    betterOffImmediately: held < RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW,
  };
}
