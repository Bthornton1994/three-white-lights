/**
 * management.ts — GDD §5 (v2) stage 4: staffing, maintenance, equipment
 * condition, recoverable failure. §5.6/§5.7's settled design, unpaused by the
 * ruling recorded in `docs/GDD.md` §5.13, with portfolio explicitly excluded —
 * this module manages the one gym the ladder runs, and a manager is an
 * optional hire for it, exactly as that ruling states.
 *
 * Pure module (CLAUDE.md, "Pure logic is separate from UI"): zero React, zero
 * side effects, zero I/O, no clock reading, no randomness. Its imports are
 * `./empireCore` (for `refuseWith`, the directory's one throw gate),
 * `./empireTuning`, `./ladder` and `./sessions` (the equipment vocabulary and
 * the composed stage-2 state, composed whole rather than re-implemented) and
 * `./production` (`scrubPrecision`).
 *
 * ===========================================================================
 * 1. Wear is keyed to banked seconds — the derivation, and why not wall time
 * ===========================================================================
 *
 * §5.7 says condition "decays continuously and auto-deducts from income as it
 * falls — no player action is required", and the same section's hard rule says
 * nothing here may punish the player for being away. The §5.13 stage-4 ruling
 * reconciles them: decay is keyed to the gym's own advanced time — the clock
 * the player advances — and not to wall-clock absence.
 *
 * In the ladder's machinery the quantity that fits that sentence exactly is
 * the banked seconds of `ladderCheckIn`'s accrual: the part of a gap the
 * offline cap pays income on. So each item loses
 * `EQUIPMENT_WEAR_PER_BANKED_HOUR` per banked hour, and:
 *
 *   - absence beyond the offline horizon wears nothing, exactly as it earns
 *     nothing — a player away a month returns to a gym worn by at most one
 *     horizon more, not a month more;
 *   - the seconds that wear the equipment are the same seconds that paid
 *     income for operating it, so wear is use, not neglect of a timer;
 *   - below the horizon, banked seconds are exactly additive under splitting
 *     a gap (ladder.ts §4), so an extra check-in inside the horizon changes
 *     no wear at all.
 *
 * The limit, stated because the sweep is scoped by it: inside the catch-up
 * horizon a longer gap banks more seconds, so it earns more and wears more.
 * That is the offline cap's own design — time inside the horizon is paid
 * operation, not absence — and the named catcher for the boundary is the
 * pure-absence family in `management.test.ts`'s sweep: histories identical
 * except for extra absence beyond the horizon are byte-identical in
 * condition, income deducted and failure progression, pinned at zero
 * mismatches against a wall-clock-wear control pinned non-zero.
 *
 * The limit has a size as well as a name.
 * `EXPECTED_SWEEP.families.withinHorizon.all` pins what "wears more" costs on
 * the swept domain: of 34560 compared readings, 14860 have the more-absent run
 * at strictly lower mean condition, 25839 have it ahead on cumulative income
 * deducted, and 421 have it net-lower in money. The paragraph above is the
 * DESIGN ARGUMENT for the wear basis; those numbers are its price, and header
 * §3c decomposes the 421 into the reported terms it is made of.
 *
 * THE WEAR BASIS WAS RE-RULED AND IT DID NOT MOVE. `docs/GDD.md` §5.13's
 * wear-basis ruling kept condition and income OPERATION-keyed and named
 * member-use / `crowdingLoad` as a better key than banked hours, with the GDD
 * and the code to change together if the key moved. It has not moved, and the
 * reason is a measurement rather than a preference:
 *
 *   - `ManagedGym` holds no member roster. `members.ts`'s `crowdingLoad` takes
 *     a caller-supplied roster and an equipment count and returns a
 *     DIMENSIONLESS RATIO — a weighted headcount over an equipment count. It
 *     is a rate multiplier, not a clock. Nothing in stage 4 composes stage 3,
 *     and `runManagedGym` never buys equipment, so a roster would have to be
 *     invented for this module rather than read from it.
 *   - With a fixed roster and a fixed equipment count — which is what this
 *     module's own domain has — usage-keyed wear is
 *     `WEAR_PER_BANKED_HOUR x bankedHours x crowdingLoad(roster, items)`, and
 *     `crowdingLoad` is then a CONSTANT. That is the same clock with a
 *     different name and a constant in front of it, so the KEY does not
 *     change: wear stays proportional to banked hours either way, and the
 *     GDD sentence a rename would satisfy is satisfied already.
 *
 * THE SENTENCE THAT USED TO FINISH THAT BULLET WAS FALSE, AND IT IS CORRECTED
 * HERE RATHER THAN DELETED. It read: "every family in `management.test.ts`
 * would report the same structure, because a positive constant multiplier
 * changes no comparison the sweep makes." A constant multiplier preserves the
 * ORDERING of two runs' condition at each index. It does not preserve a
 * THRESHOLD CROSSING, and most of what the sweep counts is crossings —
 * `MANAGER_AUTO_REPAIR_CONDITION`, `REPAIR_POLICY_CONDITION`,
 * `RECOVERY_CONDITION_MIN`, and the income multiplier that rescales the whole
 * purse.
 *
 * Measured rather than argued, by doubling `EQUIPMENT_WEAR_PER_BANKED_HOUR`
 * from 0.002 to 0.004 and re-running the whole battery:
 *
 *   - on `withinHorizonConditionGatedControl` — the sweep as it stood when
 *     that sentence was written — `failureMismatches` goes 310 -> 615,
 *     `variantPhaseWorse` 186 -> 321, `matchedTraceFailureMismatches`
 *     124 -> 179 and `variantNetLower` 923 -> 1416;
 *   - on the shipped `withinHorizon` family the three failure counters stay
 *     at zero at 0.004 — but `conditionMismatches` goes 15070 -> 13080 and
 *     `variantNetLower` 421 -> 53.
 *
 * So the multiplier moves five of the fourteen counters on the shipped family
 * and every failure counter on the control. What survives of the argument is
 * the narrower claim above — a constant factor does not change the wear KEY —
 * and that is all it ever supported.
 *
 * THE SENTENCE THAT USED TO EXPLAIN THAT SECOND BULLET WAS FALSE, AND THE
 * PROBE THAT PRODUCED IT HAD STOPPED SHORT OF THE REGION WHERE IT BREAKS. It
 * read: "the three failure counters stay at zero, because the ordinal review's
 * index-invariance is structural and has nothing to do with the wear rate."
 * The measurement in front of it is a reading at one point on the knob axis;
 * the clause after "because" is a claim about the whole axis, and 0.004 is
 * short of where the axis turns — 7 x 12 x 0.004 = 0.336, leaving condition at
 * 0.664 and the maintenance-prompt line of 0.5 uncrossed.
 *
 * Re-run past it, every number below measured on this tree at the same
 * battery, `withinHorizon.all`:
 *
 *     wear    failureMismatches   phaseWorse   matchedTrace   netLower
 *     0.002                   0            0              0        421
 *     0.004                   0            0              0         53
 *     0.0045                  0            0              0         62
 *     0.005                   0            0              0        319
 *     0.0055                 32            0              0        471
 *     0.006                 128            0              0        435
 *     0.007                 256            0              0        561
 *     0.008                   0            0              0        879
 *     0.010                   0            0              0        902
 *     0.020                   0            0              0       2312
 *
 * So `failureMismatches` leaves zero between 0.005 and 0.0055, peaks, and
 * returns to zero by 0.008 — a threshold crossing rather than a trend, which
 * is why a single doubling found nothing and read as structure. Every non-zero
 * reading is `'cheapskate'` and no other policy, on every row.
 *
 * WHAT IS ACTUALLY STRUCTURAL, stated in the mechanism's own terms and no
 * wider. `reviewsOfferedMismatches` is 0 at every wear rate in that table.
 * Header §3a's derivation is about `orderOpensAt`, and it holds exactly as
 * written: enlarging a gap changes gap lengths and not the number of check-ins
 * taken, so the review series is index-invariant whatever the wear rate. What
 * the deleted sentence did was generalise that from the REVIEW CADENCE to the
 * whole failure path, and the failure path has a second entrance the cadence
 * says nothing about: `'cheapskate'`'s hire is gated on `warningSignsVisible`,
 * whose second disjunct reads worn equipment.
 *
 * Attributed by a counterfactual rather than by co-occurrence: at 0.006, with
 * that model's gate swapped to `countedWarningVisible` and nothing else
 * changed, `withinHorizon.failureMismatches` goes 128 -> 0.
 *
 * The named catcher for the knob is `management.test.ts`'s `STRIKE_PATH_MARGIN`
 * and the two checks that read it — `keeps the worn disjunct off the strike
 * path by a derived margin, and states its size`, and the directed drive beside
 * it. Header §3e has the inequality and its size. It is a derived bound rather
 * than a re-measurement, so it is conservative on purpose: it reddens at
 * 0.00463 while the sweep above first moves between 0.005 and 0.0055.
 *
 * So a usage key here would be a GDD edit and a rename for no change of key.
 * What would make it a real difference is a roster that MOVES with the
 * schedule, which is stage 3's `memberSatisfaction` wired into stage 4 — a
 * piece that does not exist and is not this round's. Recorded as the reason
 * rather than as a preference, and stated with its own limit: this argument is
 * about the domain this module has today, and it stops being true the moment a
 * live roster arrives.
 *
 * ===========================================================================
 * 2. Where the income deduction applies, and which multiplier moment
 * ===========================================================================
 *
 * §5.7's auto-deduction is applied at the one real income path stage 2 has:
 * `gymCheckIn`'s accrual. The choice is a multiplier, not a flat charge — a
 * flat per-check-in charge is a charge on showing up, which is the shape
 * `management.test.ts`'s `'visit-fee-control'` exists to hold up as the
 * counter-example, and it is pinned punishing there. A multiplier on the
 * accrual keeps income monotone in banked seconds instead.
 * `managedCheckIn` composes `gymCheckIn` whole (the stage-2 precedent:
 * compose, do not re-implement), then subtracts the deducted part of the raw
 * accrual from the settled purse.
 *
 * The multiplier is read after the gap's wear is applied — the end-of-gap
 * condition. What is driven rather than argued: `splitting a sub-horizon gap
 * leaves condition byte-identical and pays at least as much` runs a real gap
 * both ways and reads the purse. What is NOT driven, and is stated as
 * reasoning rather than as a measurement: that the start-of-gap multiplier
 * would pay strictly less on a split. No wiring implements that variant, so
 * nothing here has measured it, and a reader should treat the direction as
 * the reason the code is written this way and not as a checked claim.
 *
 * The multiplier's floor (`CONDITION_INCOME_MULTIPLIER_FLOOR`) keeps a fully
 * worn gym earning. The consistency the tuning must hold for engagement to
 * stay unpunished is derived and pinned in `management.test.ts`: a banked
 * hour at the floor multiplier still out-earns the top wage rate plus its own
 * wear's full repair cost, at the lowest rung's income rate.
 *
 * ===========================================================================
 * 3. Failure reads the decision ledger, and a refusal is counted ONCE
 * ===========================================================================
 *
 * §5.7, confirmed as settled design: failure is driven by accumulated bad
 * decisions made while actively engaged — repeatedly hiring the cheapest
 * manager despite visible warnings, ignoring the in-session maintenance
 * prompt more than once, actively declining a repair whose cost was shown —
 * and not by elapsed time.
 *
 * Here that is structural rather than promised: `failurePhase` is a pure
 * function of `ManagedGym.strikes.length`, and the three functions that
 * append a strike are the three §5.7 decision shapes (`hireManager`,
 * `respondToPrompt`, `declineRepair`). `managedCheckIn` reads no strike and
 * writes no strike, so no quantity of elapsed, banked or discarded seconds
 * moves the failure state. The warning phase (`'warned'`) becomes visible at
 * `FAILURE_WARNING_STRIKES`, before failure at `FAILURE_STRIKES`, so no
 * failure arrives unwarned; every strike record carries the cost or warning
 * that was on screen when the decision was taken.
 *
 * ---------------------------------------------------------------------------
 * 3a. The standing repair order — what the §5.13 wear-basis ruling changed
 * ---------------------------------------------------------------------------
 *
 * The first implementation counted a strike PER REFUSAL. Low condition gated
 * the maintenance prompt, the prompt was where refusals were taken, and every
 * firing of it was a fresh chance to accrue a strike — so a player who checked
 * in more often was asked more often and struck more often, and §5.13's ruling
 * named that the defect however the strike itself was gated.
 *
 * The ledger is keyed to the ORDER now, not to the asking. Each owned item
 * carries one standing repair order. Refusing it — by declining the shown
 * repair, or by ignoring the prompt past the free allowance — appends exactly
 * one strike and puts the item in `ManagedGym.neglected`. Every later refusal
 * of that same order is the same standing decision restated: `declineRepair`
 * still returns `'declined'`, the prompt is still SHOWN (§5.7's clarification
 * allows condition exactly that), and nothing is appended. The order closes
 * when the item is REPAIRED — by the player, by the prompt, by the manager, or
 * by a recovery investment — and the next refusal of the fresh order is a new
 * decision, because the player did something constructive in between.
 *
 * `countedWarningVisible` is the other half. The cheap-hire strike used to be
 * gated on `warningSignsVisible`, which reads worn equipment; that put a
 * condition term on the strike path. It reads the failure phase now, which is
 * a pure function of the ledger. `warningSignsVisible` survives as the DISPLAY
 * read and as a player model's trigger.
 *
 * `FAILURE_STRIKES` moved 4 -> 3 with this, and the reason is arithmetic
 * rather than taste: a gym that never repairs can refuse at most one order
 * per owned item, which is three at the garage, so a threshold of four would
 * put pure neglect structurally out of reach of failure.
 * `management.test.ts`'s `pure neglect can reach failure` pins both the
 * relation and the behaviour behind it.
 *
 * AND THE ORDER IS RAISED ON THE CHECK-IN ORDINAL, WHICH IS WHAT THIS ROUND
 * CHANGED. The per-order ledger above decided what a refusal is WORTH. It left
 * WHEN a refusal is possible keyed to equipment condition — `maintenancePrompt`
 * returned `'quiet'` until something was worn below
 * `MAINTENANCE_PROMPT_CONDITION`, and `declineRepair` refused as
 * `'not-offered'` above the same line — so a run that banked more operation
 * inside the offline horizon crossed that line at an EARLIER CHECK-IN and its
 * player met the decision sooner. That was the whole of the remaining
 * within-horizon residual, and §5.7's clarification forbids it in as many
 * words: low condition may SHOW a repair prompt; it may not advance a strike.
 *
 * The gym raises a standing repair order at check-in
 * `MAINTENANCE_ORDER_FIRST_CHECK_IN` and every `MAINTENANCE_ORDER_STRIDE`
 * check-ins after it, and at no other check-in. `orderOpensAt` is a pure
 * function of `ManagedGym.checkInsTaken` and those two knobs. Condition still
 * chooses WHICH item the review names — the worst-conditioned one whose order
 * is unanswered — because naming an item is not advancing a strike, and
 * `promptOver` is the one place that choice is made.
 *
 * Why an ordinal closes it, in the mechanism's own terms rather than as a
 * claim about every edit: the within-horizon family enlarges a GAP. Enlarging
 * a gap changes when check-ins happen and never how many have happened, so
 * `checkInsTaken` at index `i` is `i + 1` in both runs of every pair, and the
 * review lands on the same indices. That is measured rather than asserted —
 * `the review series is byte-identical under ANY enlargement of a gap` drives
 * 160 enlargements up to a year long and compares the reported `reviewOffered`
 * series, and 15 of the same 160 move it under the control gate.
 *
 * ---------------------------------------------------------------------------
 * 3b. What that closed, what it cost, and the half of §5.7 it does NOT close
 * ---------------------------------------------------------------------------
 *
 * MEASURED, and stated against the bar rather than against a summary. §5.13
 * asked for within-horizon failure progression to read ZERO on the six-policy
 * sweep, matched-trace included. IT NOW DOES. The numbers, all from
 * `management.test.ts`:
 *
 *   - within horizon, per index: `failureMismatches` 0, `variantPhaseWorse`
 *     0, `matchedTraceFailureMismatches` 0 — on the family and on each of the
 *     six `byPolicy` rows. The number those zeros are zeros against is
 *     `withinHorizonConditionGatedControl`: the removed condition gate driven
 *     over the same 864 pairs, the same six policies and the same comparator,
 *     reading 310 / 186 / 124. That control reproduces the previous round's
 *     shipped row exactly, which is what says it is the removed code path
 *     rather than a sketch of it, and the test asserts those four numbers.
 *   - the matched-trace clause is not satisfied by an empty population: 848 of
 *     the 864 pairs realize byte-identical decision traces. The 16 that do not
 *     are enumerated rather than left as a remainder — `hire-veteran` and
 *     `prompt-repair`, both `'delegating'`, both PURSE-timed, neither able to
 *     append a strike.
 *   - within-horizon money fell 923 -> 421, and header §3c decomposes all 421.
 *
 * WHAT IT COST, AND THE PREDICTION IT REFUTED. The round that specified this
 * change predicted `engagement.variantPhaseWorse` would RISE from 730 as the
 * price. It FELL, to 524, and `failureMismatches` fell 1187 -> 909, both read
 * against `engagementConditionGatedControl` on the same grids. Recorded
 * because it was not the predicted direction and a builder's prediction is not
 * evidence about a measurement.
 *
 * THE HALF OF §5.7'S CLARIFICATION THAT WAS WITHDRAWN RATHER THAN CLOSED.
 * This block used to route an open conflict to a human. The ruling came back
 * and it went the other way from the shape a builder would have guessed: the
 * sentence was DELETED from the design document, not the code changed to meet
 * it. Recorded in full because the numbers it generated are still measured
 * here and a reader who finds them needs to know what they are evidence of.
 *
 * §5.7's clarification used to have two sentences. The first — low condition
 * may not advance a strike — is closed, and `withinHorizon` reads 0 / 0 / 0
 * against the condition-gated control's 310 / 186 / 124. The second asked for
 * "the same strikes on the same calendar" for two histories differing only in
 * check-in frequency, and the engagement family measures exactly that at 909
 * and 524. It was 1187 and 730 before this round and has never been zero.
 *
 * THE RULING: THE SECOND SENTENCE DOES NOT FOLLOW FROM THE FIRST AND FIGHTS
 * IT. A counted decision requires a check-in to take it, so more visits means
 * more chances to answer or refuse — which is what a counted decision IS. The
 * two ways to force the totals equal are both worse than the gap: strikes
 * accruing while the player is away, which breaks the first sentence outright,
 * or shown refusals that do not count, which changes what a review costs and
 * makes the displayed price untrue. A model that checks in more, refuses more
 * and collects more strikes is the mechanic working; a gym that fails because
 * the clock ran is the forbidden thing. They are not the same reading and the
 * document no longer asks for them to be flattened together.
 *
 * SO 909 AND 524 ARE WHAT THE WITHDRAWN SENTENCE WOULD HAVE MEASURED, AND NOT
 * A SHIPPED VIOLATION. They stay measured, because a number that stops being
 * a bar is still the cheapest way to notice the mechanism moving.
 *
 * What §12.3 asks instead, and what enforces it: the player who shows up more
 * must not end WORSE on phase, failure, money or condition under a fair
 * policy. The catcher is `engagementEagerTurnaroundControl` — the player model
 * this build removed, kept runnable, differing on one axis. Thirteen of its
 * fifteen counters are byte-identical to the shipped family; the two that move
 * are money, pinned at 36 and 21 as the numbers the shipped zeros are zero
 * against. `management.test.ts`'s `the withdrawn equal-strike sentence's
 * numbers are kept as measurements, and §12.3's actual bar has its catcher`
 * is where both halves are asserted.
 *
 * The mechanism note that used to carry this block's argument is kept, because
 * it is why the ruling went this way: the two comparators pull opposite ways —
 * the within-horizon family compares PER INDEX and the more-absent run is
 * later at every index; the engagement family compares AT SHARED TIMES and the
 * more-engaged run has more check-ins. The split is almost total: `review`
 * pins 908 of the 909 mismatches and all 524 phase-worse readings on pairs
 * whose review counts diverged, with the single remaining pair named.
 *
 * ---------------------------------------------------------------------------
 * 3d. The money route into the ledger, and the ONE thing it moved
 * ---------------------------------------------------------------------------
 *
 * The ordinal closes the wear route into the strike ledger. It does not close
 * the PURSE route, and that is worth naming because the purse still differs
 * between two runs at the same index: `hireManager` refuses on insufficient
 * funds, `repairEquipment` returns `not-enough-gym-bucks` so a review answered
 * with `'repair'` comes back `repair-refused` and leaves the order open, and
 * `'redemptive'`'s recovery repairs are purse-gated.
 *
 * Measured, on the within-horizon domain: the route moves DECISIONS on 16 of
 * 864 pairs and STRIKES on none. On the engagement domain it moves strikes on
 * exactly one pair — the single `review`-matched offender, whose traces match
 * and whose failure mismatch is 1. So the route is real, it is instrumented,
 * and its size is one reading in 29520.
 *
 * IT DID MOVE ONE THING, AND THE FIX IS A MODEL CHANGE RATHER THAN AN ENGINE
 * ONE. Keying the review to the ordinal makes a run that checks in more often
 * go round the failure/recovery cycle more often per unit of calendar. The
 * `'redemptive'` model used to shed ANY manager on the way back from dormancy;
 * `recoveryRequirement` only ever blocks on a manager whose hire was a counted
 * cheap hire, so that dismissal was unrequired — and an unrequired dismissal
 * destroys the hire's whole asset value with no refund while the comeback pays
 * for a fresh one. Under the ordinal that unrequired spend became an
 * engagement charge: `engagement.variantNetLower` measured 36 readings across
 * 15 pairs where the more-engaged player was poorer, against 0 before, and 15
 * of those were still poorer at the end of the run.
 *
 * The model now sheds exactly the manager the engine blocks recovery on, and
 * `engagement.variantNetLower` is 0 on all six policies again. The attribution
 * is a measurement and not an argument: the counterfactual was run, and the
 * entire 36 was carried by the `decisionSpend` term on `'redemptive'` alone.
 * The old model is kept runnable as the `'eager-turnaround-control'` wiring
 * and pinned at 36 — the number the shipped zero is a zero against — and
 * `management.test.ts` asserts that the control varies that ONE axis, by
 * pinning its failure, review and condition counters equal to the shipped
 * row's.
 *
 * Its own limit, stated because the fix is on the model side of the line: this
 * says the shipped `'redemptive'` model does not lose money to engagement. It
 * does NOT say no player model could. A model that spends on a cycle the
 * ordinal accelerates would measure the same way, and the named catcher for
 * that is this family plus `hiringNet`, both of which read `netPosition`
 * rather than any particular model's intentions.
 *
 * ---------------------------------------------------------------------------
 * 3c. The money residual, decomposed into reported terms
 * ---------------------------------------------------------------------------
 *
 * The round before last priced the within-horizon money residual against ONE
 * hypothesis — the dormancy crawl arriving early — and reported 297 readings
 * that hypothesis did not cover as "unexplained". §5.13 ruled that unexplained
 * is not a landing state. It is not one: `decomposes every within-horizon
 * net-lower reading into its reported terms` splits each deficit into the six
 * reported quantities it is algebraically made of and pins the identity's
 * closing error at ZERO, so nothing is absorbed.
 *
 * The residual is 421 readings on 13 pairs now, down from 923 on 87, and the
 * interesting part is not the size but that it collapsed onto ONE player
 * model. Every one of the 421 is `'delegating'`, and the carriers are:
 *
 *   - 196 the manager's AUTONOMOUS REPAIRS. A veteran repairs below 0.75, the
 *     run that banked more operation wore past that line more often, so it
 *     was billed for more repairs;
 *   - 195 the WAGE. `MANAGER_WAGE_GYM_BUCKS_PER_BANKED_HOUR` is charged per
 *     BANKED hour, so a run that banked more paid its manager strictly more;
 *   - 30 the standing REPAIR BILL itself;
 *   - ZERO the income, decision-spend and manager-asset terms.
 *
 * All three carriers are operation-keyed spends, which is exactly what
 * `docs/GDD.md` §5.13's first bullet keeps operation-keyed: the gym ran, so it
 * wore, so it cost. The four models that used to contribute — `negligent` 281,
 * `cheapskate` 289, `redemptive` 56, all downstream of a review arriving a
 * check-in early, and `delegating`'s own 297 wage readings — are now either
 * zero or the wage term above.
 *
 * Every one of those numbers is a magnitude comparison rather than a
 * co-occurrence: the carrier is the largest of six signed terms that sum to
 * the deficit exactly, and `maxDeficitGymBucks` is 105.32.
 *
 * ---------------------------------------------------------------------------
 * 3e. The two condition reads still on the strike path, and what holds them off
 * ---------------------------------------------------------------------------
 *
 * §3a took the review cadence off condition and §3d priced the purse route.
 * Neither of those is the whole of the path a strike travels, and two
 * condition reads survive on it. Both are inert at the shipped tuning by a
 * MARGIN rather than by construction, which is a weaker thing than the rest of
 * this header claims and is why they get their own section with their own
 * catchers. Each is written in CLAUDE.md's three parts: what the mechanism
 * gives, the route past it named concretely, and the check that covers that
 * route named specifically enough to run.
 *
 * FIRST: `'cheapskate'`'s hire gate.
 *
 * WHAT THE MECHANISM GIVES. `countedWarningVisible` decides whether a cheap
 * hire COUNTS, and it reads the strike ledger's phase and nothing else. That is
 * the guarantee §3a's `countedWarningVisible` paragraph states, and it is
 * exactly as strong as it says.
 *
 * THE ROUTE PAST IT. `countedWarningVisible` does not decide WHEN the hire
 * happens. `runManagedGym`'s `'cheapskate'` model still triggers on
 * `warningSignsVisible`, whose second disjunct is `wornItems(state).length > 0`
 * — a condition read, sitting one step upstream of a decision that appends a
 * strike. The route is a wear rate large enough to cross
 * `MAINTENANCE_PROMPT_CONDITION` before the ledger reaches
 * `FAILURE_WARNING_STRIKES`; §1's table has it measured, at 128
 * `withinHorizon.failureMismatches` at 0.006 and 0 with the gate swapped.
 *
 * THE CHECK THAT COVERS IT, and the size of the margin it holds.
 * `management.test.ts`'s `STRIKE_PATH_MARGIN` derives, from five knobs and
 * `offlineBankingHorizonSeconds`, the least condition any item can be at the
 * first check-in whose hire read can see a warning phase. A counted refusal is
 * possible at a review and nowhere else, so the earliest a run reaches the
 * warning phase one refusal at a time is the review numbered
 * `FAILURE_WARNING_STRIKES` — check-in 8 at the shipped ordinal knobs — and the
 * hire block reads its predicate before that check-in's refusal is taken, so
 * check-in 9 is the first read that can see it. A check-in wears at most
 * `EQUIPMENT_WEAR_PER_BANKED_HOUR` times the offline horizon, which is 0.024,
 * so no item is below 0.784 there: 0.284 above the 0.5 prompt line, and the
 * margin closes at a wear rate of 0.00463 against a shipped 0.002.
 *
 * ITS LIMIT, stated because the arithmetic is one-directional. The inequality
 * is SUFFICIENT for the disjunct ordering on the strike-producing path. It is
 * not a proof that the sweep's failure counters stay at zero for every knob
 * setting, and it says nothing about the purse route of §3d or about the
 * second read below. A knob move can redden the sweep with the inequality
 * comfortably satisfied — and, in the other direction, the bound is
 * conservative: it reddens at 0.00463 where the sweep first moves between
 * 0.005 and 0.0055.
 *
 * SECOND: the manager's autonomous repair re-arming a refused order.
 *
 * WHAT THE MECHANISM GIVES. A refusal is charged once per standing repair
 * order (§3a), and an order closes when the item is repaired.
 *
 * THE ROUTE PAST IT. One of the four things that can repair an item is the
 * manager's autonomous routine repair in `checkInWithWearBasis`, and that loop
 * is gated on `itemCondition(next, item) < threshold` and on the purse. It
 * calls `withOrderClosed`, so a condition comparison decides whether the item's
 * next refusal is a fresh counted decision or a restatement that appends
 * nothing. That is a condition read deciding COUNTABILITY, and §3a's derivation
 * does not reach it: that derivation is about `orderOpensAt`, which is a pure
 * function of the check-in ordinal, while this is a comparison against a worn
 * value.
 *
 * THE CHECK THAT COVERS IT. `ManagedCheckIn.autoRepairsReopeningRefusedOrders`
 * counts the route being taken, `ManagedRunCensus` totals it per run, and the
 * sweep's domain census pins it in two forms: 182 across the whole battery and
 * 0 on the shipped wiring. The 182 is what says the counter is not measuring an
 * empty domain, and where it sits is the useful part — every one of the 182 is
 * `'wall-clock-wear-control'`, the wiring that wears on elapsed time and
 * therefore wears fastest. So this route's entrance is wear-rate-sensitive in
 * the same way the first one is, and the two are one finding seen twice.
 *
 * ITS LIMIT. Those two numbers are a statement about THIS domain — three seeds,
 * that gap menu, that grid, these six models of a player — and not a structural
 * absolute. A seventh model that repairs some items and refuses others keeps a
 * gym alive past the check-in at which pure refusal takes it dormant, and wear
 * continues while it does, so a steady manager's 0.35 threshold becomes
 * reachable. Nothing here forbids that; what is here is a count that moves off
 * zero when it happens, in a census a reader signs.
 *
 * ---------------------------------------------------------------------------
 * 3f. RETRACTED: an escape probe reported at 6 / 6 / 0 that reproduces at
 * 0 / 0 / 0, filed rather than deleted
 * ---------------------------------------------------------------------------
 *
 * A round before this one reported, in this header, that raising
 * `MAINTENANCE_PROMPT_CONDITION` to 0.999 — an escape probe of the shipped
 * ordinal path, asking whether the failure counters really are independent of
 * where the prompt line sits — moved the within-horizon failure counters to
 * 6 / 6 / 0. The next round re-ran it, measured 0 / 0 / 0, could not account
 * for the difference, and DELETED the sentence. That left no record anywhere
 * in the tree of either the claim or the failed reproduction.
 *
 * Deletion is the wrong disposition and this module already knows it: §4 keeps
 * a superseded slump figure as history with its verb in the past tense, and
 * `management.test.ts` keeps the reasoning for a constant it removed. A number
 * that was published and will not reproduce is worth more written down than
 * gone, because gone reads as never claimed.
 *
 * Re-taken here, on this tree, at the same probe value:
 * `MAINTENANCE_PROMPT_CONDITION` at 0.999, everything else at the shipped
 * tuning, `withinHorizon.all` reads `failureMismatches` 0,
 * `variantPhaseWorse` 0, `matchedTraceFailureMismatches` 0, and 0 on each of
 * the six policies. `withinHorizonConditionGatedControl` reads 0 / 0 / 0 too,
 * which is its own reading rather than a copy: at 0.999 the condition gate is
 * open at every check-in, so it stops discriminating and both runs of a pair
 * get a review at every index.
 *
 * HOW TO RE-TAKE IT, because nothing in the suite holds this. Neither this
 * probe nor §1's wear-rate table is a wiring: both are source edits to
 * `empireTuning.ts` followed by a re-run of the sweep, so no test goes red if
 * either drifts. The one part of §1's table that IS held is the knob margin,
 * by `management.test.ts`'s `STRIKE_PATH_MARGIN` — and it is held as an
 * inequality over the knobs rather than as a re-measurement, which is a
 * different claim and is described as one at §3e's first half.
 *
 * WHAT THE RETRACTION DOES AND DOES NOT SAY. It says the 6 / 6 / 0 does not
 * reproduce against this tree at the probe value it names, twice, by two
 * different rounds. It does not say the original measurement was fabricated or
 * that it was wrong when taken — the ledger, the review gate and the strike
 * threshold all moved between then and now, so the engine it was taken against
 * is no longer here to re-run. The figure has no standing as evidence and is
 * kept as the record of a claim, which is a different thing from a result.
 *
 * ===========================================================================
 * 4. Dormancy: income collapses, and what "keeps degrading" is read to mean
 * ===========================================================================
 *
 * A failed gym is dormant: the income multiplier drops to
 * `DORMANT_INCOME_MULTIPLIER` — a crawl, not a hard zero, because on the
 * single-gym ladder a literal zero plus an empty purse makes §5.7's own
 * recoverability clause arithmetically false (the ladder is the one money
 * source; that constant's comment carries the full derivation, and it is
 * flagged for human re-ruling rather than silently resolved). No wage is
 * charged and no manager auto-repairs while dormant. §5.6's "members leave"
 * surfaces through `memberConditionInput`, the real value stage 3's
 * `memberSatisfaction` declared as its stage-4 input.
 *
 * That last sentence understates what dormancy does to that channel, and the
 * gap is disclosed here in the same register as the two refusals below rather
 * than left for a reader to find. `memberConditionInput` is `meanCondition`,
 * and dormancy applies no wear, so mean condition is CONSTANT for the whole
 * of dormancy: the input stage 3 reads does not move once the gym has failed.
 * §5.6's members therefore leave at whatever rate the condition at the moment
 * of failure implies, and not one member faster for the gym having been
 * dormant a long time. Whether that is right is a design question and this
 * module does not answer it — it is recorded because "members leave" reads
 * like a live channel and here it is an inert one. Nothing in this file
 * measures it either: `members.ts` is not imported, no sweep drives
 * `memberSatisfaction`, and the only check pointed at this function is the
 * directed equality with `meanCondition`. A future ruling that wants dormant
 * attrition needs a key that is neither wall-clock nor check-in-keyed, which
 * is the same open problem the two refusals below name.
 *
 * §5.7's sentence "condition keeps degrading" has NO condition implementation
 * here, and that is a measured derivation rather than an oversight. Two
 * candidates were built and both were refused by measurement:
 *
 *   - ongoing dormant wear per banked second. A dormant gym hosts no
 *     operation for use-keyed wear to be about, and the charge lands on
 *     visits: more check-ins at a dormant gym would raise its repair bill
 *     with no offsetting income, which the never-punish rule refuses.
 *   - a one-off entry slump, applied when the strike count crosses the
 *     failure line. This shipped at 0.25 for one round and the sweep
 *     measured it: a slump is a discrete money cliff (slump x items x
 *     `REPAIR_COST_GYM_BUCKS_PER_CONDITION_POINT`) whose ARRIVAL TIME is
 *     engagement-sensitive, because a run that banked more operation reaches
 *     the failing decision a check-in earlier. Measured on THIS tree by the
 *     live control rather than carried over from a mutation taken under the
 *     old ledger: at 0.25 the `engagementSlumpControl` family reads 238
 *     net-lower readings against the shipped engagement family's 0. Both
 *     tallies are pinned in full in `management.test.ts`'s
 *     `EXPECTED_SWEEP.families`, per policy as well as in total.
 *
 *     ITS WITHIN-HORIZON HALF NOW MEASURES NOTHING, and that is declared
 *     rather than left as a control quietly agreeing with the ship.
 *     `withinHorizonSlumpControl` reads 421 net-lower readings, which is the
 *     shipped family's number exactly. Under the ordinal review both runs of
 *     a within-horizon pair cross the failure line at the same INDEX, so the
 *     slump fires at the same index on both and cancels out of a per-index
 *     comparison. It used to read 1016 against a shipped 923, and it did so
 *     because the crossing itself moved with wear — the mechanism header §3a
 *     removed. The engagement half is where that control still bites, and
 *     `management.test.ts` asserts the EQUALITY on the within-horizon half
 *     rather than a bound, so a change that makes the slump matter there
 *     again reddens and gets read.
 *
 *     The earlier mutation figures — 130 against 0 on engagement, 983 against
 *     890 within horizon, matched-trace 337 -> 368 — were taken with the
 *     per-refusal ledger and `FAILURE_STRIKES: 4`. They are HISTORY and cannot
 *     be re-derived from this tree; the live control above is what a reader
 *     should read the shipped rows against.
 *
 *     Why the repair is removal and not a smaller number, stated in the
 *     mechanism's own terms rather than as a claim about every edit: the
 *     cliff is a FIXED cost and the income that pulls it forward is
 *     PROPORTIONAL to the extra banked span, so for a span small enough the
 *     income is smaller than any positive cliff. The sweep cannot see that
 *     directly, because its gap menu is coarse: measured at 0.20, 0.15, 0.10
 *     and 0.05 the same families read zero, so on THAT domain there was
 *     headroom. A §12.3 property held by a margin that exists only because
 *     nobody sampled between two menu entries is the "domain empty where it
 *     matters" shape, which is why the shipped value is not "just under the
 *     measured boundary".
 *
 *     THAT SWEEP OF SMALLER SLUMPS HAS NOT BEEN RE-TAKEN, and its verb is past
 *     tense for that reason. It ran when the within-horizon family covered
 *     three policies of six and the ledger counted every refusal, so "the same
 *     families read zero" is a statement about a battery that no longer
 *     exists. The conclusion it supports (removal rather than a smaller
 *     number) does not rest on it, because the FIXED-cost-versus-PROPORTIONAL-
 *     income argument above is arithmetic and not a sample. Recorded as an
 *     untaken measurement rather than deleted.
 *
 * So dormancy costs the income crawl and the recovery bar
 * (`RECOVERY_CONDITION_MIN`, well above the maintenance-prompt line, so a
 * comeback buys repairs the player would not otherwise owe yet) and nothing
 * else. The removed mechanism is kept runnable as the
 * `'failure-slump-control'` wiring, whose counts `management.test.ts` pins
 * NON-ZERO on both domains — the number the shipped engagement zero is a zero
 * against, and the number the shipped within-horizon figure is smaller than.
 * The §5.13 ruling's other removed mechanism, the per-refusal strike ledger,
 * is kept runnable the same way as `'repeat-strike-control'`. If a human wants
 * dormant rot back, it needs a key that is neither wall-clock, nor
 * check-in-keyed, nor a discrete cliff at a decision boundary, and no such
 * key exists in this machinery — flagged for re-ruling rather than silently
 * resolved.
 *
 * Recovery is §5.7's shape: a real repair investment (every item restored to
 * `RECOVERY_CONDITION_MIN`, quoted before the decision) plus staffing
 * turnaround (a manager whose hire was a counted cheap-hire strike must be
 * gone). `recoverGym` clears the active strikes and the gym is back online;
 * the asset is not lost.
 */

import { refuseWith } from './empireCore';
import { type LadderAccrual, type LadderEquipmentItem } from './ladder';
import { scrubPrecision } from './production';
import {
  type GymState,
  type SessionEquipmentItem,
  createGymState,
  gymCheckIn,
  requireGymState,
  withLadder,
} from './sessions';
import { EMPIRE_TUNING } from './empireTuning';

// ---------------------------------------------------------------------------
// Vocabulary, derived from the tuning block rather than restated
// ---------------------------------------------------------------------------

/** A manager quality tier, worst first — §5.7's quality axis. */
export type ManagerTier = (typeof EMPIRE_TUNING.MANAGER_TIERS)[number];

/** Any item that carries a condition: the Barbell group and the stage-2 items. */
export type ManagedEquipmentItem = LadderEquipmentItem | SessionEquipmentItem;

/** Condition per owned item, each in [0, 1]. Exactly the owned items, no more. */
export type ConditionByItem = Readonly<Partial<Record<ManagedEquipmentItem, number>>>;

/** The failure machine's phases, in order of trouble. Derived, not stored. */
export const FAILURE_PHASES = Object.freeze(['sound', 'warned', 'failed'] as const);

export type FailurePhase = (typeof FAILURE_PHASES)[number];

/** §5.7's three counted decision shapes. Nothing else may append a strike. */
export const COUNTED_DECISIONS = Object.freeze([
  'cheapest-hire-under-warning',
  'prompt-dismissed-again',
  'repair-declined',
] as const);

export type CountedDecision = (typeof COUNTED_DECISIONS)[number];

/** One counted decision, with what the screen showed when it was taken. */
export interface CountedDecisionRecord {
  readonly decision: CountedDecision;
  /** The gym clock second of the check-in the decision was taken at. */
  readonly atSeconds: number;
  /** The cost that was shown before the decision — §5.7's "told the cost of". */
  readonly shownCostGymBucks: number;
}

/** The hired manager, if any. `hiredUnderWarning` is what recovery must undo. */
export interface ManagerState {
  readonly tier: ManagerTier;
  readonly hiredUnderWarning: boolean;
}

/** The whole of stage 4's state, composed onto stage 2's `GymState`. */
export interface ManagedGym {
  readonly gym: GymState;
  readonly condition: ConditionByItem;
  readonly manager: ManagerState | null;
  /** The active failure ledger. Cleared by recovery, counted by `failurePhase`. */
  readonly strikes: readonly CountedDecisionRecord[];
  /**
   * The items whose STANDING REPAIR ORDER has already been answered with a
   * refusal — header §3's ledger. An item enters this list when a decline or
   * an ignore is counted against it, and leaves it when the item is repaired
   * (by the player, the prompt, the manager, or a recovery investment) or when
   * recovery clears the ledger. A refusal of an item already in this list is
   * the same standing decision restated, not a new one, so it counts nothing.
   */
  readonly neglected: readonly ManagedEquipmentItem[];
  /** Prompt dismissals taken so far, against the free allowance. */
  readonly promptDismissals: number;
  /**
   * Check-ins this gym has taken, ever — the ORDINAL the standing repair
   * order's cadence is read off (`orderOpensAt`). Header §3a.
   *
   * What the code guarantees, in the mechanism's own terms: `checkInsTaken`
   * is incremented in exactly one expression, in `checkInWithWearBasis`, and
   * every other function in this module carries it forward through an object
   * spread. So a decision cannot advance the review cadence, and `recoverGym`
   * — which resets `promptDismissals` — does not reset this.
   *
   * Its limit, stated because no type reaches past it: `ManagedGym` is a
   * plain interface and a caller can build one with any value it likes, which
   * is what `management.test.ts`'s fixtures do on purpose.
   * `requireManagedGym` refuses a non-integer or a negative one and nothing
   * more. The named catcher for the guarantee above is
   * `only a check-in advances the review ordinal`, which drives every
   * non-check-in export on this module and reads the field back.
   */
  readonly checkInsTaken: number;
  /** Recoveries completed — reported, so a comeback is visible in the state. */
  readonly recoveries: number;
}

// ---------------------------------------------------------------------------
// Lookups and quotes — every cost computable before the decision (§5.7)
// ---------------------------------------------------------------------------

/** Refuse a tier off the ladder. Loud on a cast-in value. */
function requireManagerTier(tier: ManagerTier): ManagerTier {
  if (!EMPIRE_TUNING.MANAGER_TIERS.includes(tier)) {
    refuseWith(`${String(tier)} is not a manager tier`);
  }
  return tier;
}

/** The flat published hire cost of `tier`. Quote this before charging it. */
export function managerHireCostGymBucks(tier: ManagerTier): number {
  requireManagerTier(tier);
  const cost = EMPIRE_TUNING.MANAGER_HIRE_COST_GYM_BUCKS[tier];
  if (!Number.isFinite(cost) || cost < 0) {
    refuseWith(`${String(tier)} has no published hire cost`);
  }
  return cost;
}

/** `tier`'s wage in Gym Bucks per banked hour of operation. */
export function managerWageRatePerBankedHour(tier: ManagerTier): number {
  requireManagerTier(tier);
  const rate = EMPIRE_TUNING.MANAGER_WAGE_GYM_BUCKS_PER_BANKED_HOUR[tier];
  if (!Number.isFinite(rate) || rate < 0) {
    refuseWith(`${String(tier)} has no published wage rate`);
  }
  return rate;
}

/** The condition below which a manager of `tier` repairs on its own. */
export function managerAutoRepairCondition(tier: ManagerTier): number {
  requireManagerTier(tier);
  const threshold = EMPIRE_TUNING.MANAGER_AUTO_REPAIR_CONDITION[tier];
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    refuseWith(`${String(tier)} has no auto-repair threshold inside [0, 1]`);
  }
  return threshold;
}

/** Every item `gym` owns, in the fixed ladder-then-session order. */
export function ownedItemsOf(gym: GymState): readonly ManagedEquipmentItem[] {
  return Object.freeze([...gym.ladder.equipment, ...gym.sessionEquipment]);
}

/** `item`'s condition in `state`. Refuses an item the gym does not own. */
export function itemCondition(state: ManagedGym, item: ManagedEquipmentItem): number {
  const condition = state.condition[item];
  if (condition === undefined) {
    refuseWith(`${String(item)} is not an owned item with a condition`);
  }
  return condition;
}

/** Mean condition across the owned items. 1 for a gym that owns nothing. */
export function meanCondition(state: ManagedGym): number {
  const items = ownedItemsOf(state.gym);
  if (items.length === 0) return 1;
  let sum = 0;
  for (const item of items) sum += itemCondition(state, item);
  return scrubPrecision(sum / items.length);
}

/** The phase the strike count puts the gym in. Derived, so it can not drift. */
export function failurePhase(state: ManagedGym): FailurePhase {
  if (state.strikes.length >= EMPIRE_TUNING.FAILURE_STRIKES) return 'failed';
  if (state.strikes.length >= EMPIRE_TUNING.FAILURE_WARNING_STRIKES) return 'warned';
  return 'sound';
}

/**
 * The multiplier the next accrual is paid at: the dormancy crawl while
 * failed (see `DORMANT_INCOME_MULTIPLIER`'s own comment for the §5.7
 * recoverability derivation), otherwise the floor plus the condition-scaled
 * remainder — §5.7's auto-deduction as one number a screen can show beside
 * the equipment.
 */
export function conditionIncomeMultiplier(state: ManagedGym): number {
  if (failurePhase(state) === 'failed') return EMPIRE_TUNING.DORMANT_INCOME_MULTIPLIER;
  const floor = EMPIRE_TUNING.CONDITION_INCOME_MULTIPLIER_FLOOR;
  return scrubPrecision(floor + (1 - floor) * meanCondition(state));
}

/**
 * The [0, 1] value stage 3 declared as its condition input — feed this to
 * `memberSatisfaction`'s `conditionMultiplier`, which `members.ts` header §2
 * says stage 4 supplies. Raw mean condition, not the income multiplier: what
 * members feel is the state of the equipment, not the economy's mercy floor.
 */
export function memberConditionInput(state: ManagedGym): number {
  return meanCondition(state);
}

/**
 * What a hired manager is worth in a POSITION comparison: the published hire
 * cost while employed, zero otherwise. `ManagedReading.netPosition` adds it
 * for the same reason it subtracts the repair bill — so a run cannot look
 * richer for having spent later. Its limit, stated because no arithmetic here
 * reaches it: a manager is not resellable and carries an ongoing wage, so this
 * is a comparison term and not a liquidation value. The wage needs no term of
 * its own because it is charged per banked hour and the tuning inequality
 * `management.test.ts` pins keeps it below the income those same hours earn.
 */
export function managerAssetValueGymBucks(state: ManagedGym): number {
  return state.manager === null ? 0 : managerHireCostGymBucks(state.manager.tier);
}

/** The shown cost of restoring `item` to full condition. */
export function repairCostGymBucks(state: ManagedGym, item: ManagedEquipmentItem): number {
  const condition = itemCondition(state, item);
  return scrubPrecision(
    (1 - condition) * EMPIRE_TUNING.REPAIR_COST_GYM_BUCKS_PER_CONDITION_POINT,
  );
}

/** The shown cost of restoring every owned item to full condition. */
export function fullRepairCostGymBucks(state: ManagedGym): number {
  let total = 0;
  for (const item of ownedItemsOf(state.gym)) {
    total += repairCostGymBucks(state, item);
  }
  return scrubPrecision(total);
}

/**
 * The shown cost of the recovery repair investment. The recovery minimum
 * decides WHICH items must be repaired (those below it); the one repair
 * instrument restores an item to full, so the quoted cost is the real cost
 * of the path the player can actually take, not a to-the-minimum figure no
 * function charges.
 */
export function recoveryRepairCostGymBucks(state: ManagedGym): number {
  let total = 0;
  for (const item of ownedItemsOf(state.gym)) {
    if (itemCondition(state, item) < EMPIRE_TUNING.RECOVERY_CONDITION_MIN) {
      total += repairCostGymBucks(state, item);
    }
  }
  return scrubPrecision(total);
}

/** Items worn below the maintenance-prompt line, in the fixed item order. */
export function wornItems(state: ManagedGym): readonly ManagedEquipmentItem[] {
  return Object.freeze(
    ownedItemsOf(state.gym).filter(
      (item) => itemCondition(state, item) < EMPIRE_TUNING.MAINTENANCE_PROMPT_CONDITION,
    ),
  );
}

/**
 * True when `item`'s standing repair order has already been refused.
 *
 * An index loop and not `state.neglected.includes(item)`, deliberately, and
 * for the reason `runManagedGym`'s own loop gives: a member call on a
 * caller-supplied array is an enumerated site `empireForbiddenOutput.test.ts`
 * has to drive or declare undriven, and this directory's precedent is that a
 * smaller enumerated surface is worth more than another driver. The same
 * applies to the two writers below.
 */
export function isNeglected(state: ManagedGym, item: ManagedEquipmentItem): boolean {
  for (let at = 0; at < state.neglected.length; at += 1) {
    if (state.neglected[at] === item) return true;
  }
  return false;
}

/**
 * Worn items whose standing repair order has NOT yet been refused.
 *
 * Its consumer moved with the ordinal review: the SHIPPED gate picks its pool
 * from the owned items, not the worn ones, so this function is now read only
 * by the `'condition'` control gate and by a screen that wants the display
 * list. It is kept exported for the second of those, and because it is what
 * `management.test.ts` reads to assert a fixture really has every order
 * refused — but a reader should not take it for the shipped review's pool.
 */
export function unansweredItems(state: ManagedGym): readonly ManagedEquipmentItem[] {
  return Object.freeze(wornItems(state).filter((item) => !isNeglected(state, item)));
}

/** The in-session maintenance prompt, or quiet. Reported before it is decided. */
export type MaintenancePrompt =
  | { readonly kind: 'quiet' }
  | {
      readonly kind: 'offered';
      /** The worst-conditioned owned item; ties keep the earlier item in order. */
      readonly item: ManagedEquipmentItem;
      readonly repairCostGymBucks: number;
      /** Whether dismissing this prompt would be a counted decision. */
      readonly dismissalWouldCount: boolean;
      /**
       * Whether this item's standing repair order has already been refused —
       * the prompt is still SHOWN (§5.7: low condition may show a prompt), and
       * refusing it again adds nothing to the ledger.
       */
      readonly alreadyRefused: boolean;
    };

/**
 * The check-in index at or after `state.checkInsTaken` at which a standing
 * repair order is open — the review cadence, read off the ORDINAL and off
 * nothing else.
 *
 * Orders open at `MAINTENANCE_ORDER_FIRST_CHECK_IN` and then every
 * `MAINTENANCE_ORDER_STRIDE` check-ins. So `checkInsTaken < orderOpensAt(state)`
 * is the quiet predicate: it is false exactly at a check-in the cadence lands
 * on, and true at every other.
 *
 * A pure function of `state.checkInsTaken` and two tuning knobs. It reads no
 * condition, no purse, no clock and no strike, which is header §3a's whole
 * point — and a reader can check that by looking at this body rather than by
 * trusting the sentence.
 */
export function orderOpensAt(state: ManagedGym): number {
  const first = EMPIRE_TUNING.MAINTENANCE_ORDER_FIRST_CHECK_IN;
  const stride = EMPIRE_TUNING.MAINTENANCE_ORDER_STRIDE;
  const taken = state.checkInsTaken;
  if (taken <= first) return first;
  return first + Math.ceil((taken - first) / stride) * stride;
}

/**
 * What this check-in's maintenance review says, with the cost shown — the
 * §5.7 requirement that a failure-feeding decision had its cost on screen.
 *
 * WHETHER a review is raised is the ordinal above and nothing else. WHICH item
 * it names is condition: the worst-conditioned owned item whose standing
 * repair order is still unanswered, and when every order has been refused, the
 * worst owned item anyway, with `alreadyRefused` and `dismissalWouldCount`
 * both false. The review keeps SHOWING either way, which is what §5.7's
 * clarification allows condition to do.
 *
 * That split is the §5.13 wear-basis ruling applied to this function. The
 * previous implementation returned `'quiet'` when nothing was worn, which put
 * a condition crossing on the path to every counted decision; header §3a has
 * the measurement.
 */
export function maintenancePrompt(state: ManagedGym): MaintenancePrompt {
  return maintenancePromptUnder(state, SHIPPED_REVIEW_GATE);
}

/**
 * The gates a maintenance review can be raised under. Only the first ships.
 *
 * `'condition'` is the mechanism this round REPLACED — a review raised when
 * an item fell below `MAINTENANCE_PROMPT_CONDITION`, which put a wear
 * crossing on the path to every counted decision. It is kept runnable as the
 * `'condition-gated-prompt-control'` wiring, and `management.test.ts` pins its
 * within-horizon failure counters non-zero beside the shipped zeros — the
 * numbers the zeros are zeros against, in `src/game/streak.test.ts`'s shape.
 */
type ReviewGate = 'ordinal' | 'condition';

/** The gate the game ships. `runManagedGym`'s control is the only other reader. */
const SHIPPED_REVIEW_GATE: ReviewGate = 'ordinal';

function maintenancePromptUnder(state: ManagedGym, gate: ReviewGate): MaintenancePrompt {
  if (gate === 'condition') {
    const worn = wornItems(state);
    if (worn.length === 0) return Object.freeze({ kind: 'quiet' });
    return promptOver(state, worn, unansweredItems(state));
  }
  if (state.checkInsTaken < orderOpensAt(state)) return Object.freeze({ kind: 'quiet' });
  const owned = ownedItemsOf(state.gym);
  if (owned.length === 0) return Object.freeze({ kind: 'quiet' });
  return promptOver(
    state,
    owned,
    owned.filter((item) => !isNeglected(state, item)),
  );
}

/**
 * Name the worst-conditioned item of `unanswered`, or of `all` when every
 * standing order has already been refused. The one place condition decides
 * WHICH item a review names, shared by both gates so they cannot drift.
 */
function promptOver(
  state: ManagedGym,
  all: readonly ManagedEquipmentItem[],
  unanswered: readonly ManagedEquipmentItem[],
): MaintenancePrompt {
  const pool = unanswered.length > 0 ? unanswered : all;
  let worst = pool[0] as ManagedEquipmentItem;
  for (const item of pool) {
    if (itemCondition(state, item) < itemCondition(state, worst)) worst = item;
  }
  const alreadyRefused = isNeglected(state, worst);
  return Object.freeze({
    kind: 'offered',
    item: worst,
    repairCostGymBucks: repairCostGymBucks(state, worst),
    dismissalWouldCount:
      !alreadyRefused &&
      state.promptDismissals >= EMPIRE_TUNING.MAINTENANCE_PROMPT_FREE_DISMISSALS,
    alreadyRefused,
  });
}

/** The visible warning surface — what "despite visible warning signs" reads. */
export interface WarningSigns {
  readonly phase: FailurePhase;
  readonly strikeCount: number;
  readonly strikesUntilFailure: number;
  readonly wornItems: readonly ManagedEquipmentItem[];
}

/** The warning state a screen must be able to show before failure. */
export function warningSigns(state: ManagedGym): WarningSigns {
  return Object.freeze({
    phase: failurePhase(state),
    strikeCount: state.strikes.length,
    strikesUntilFailure: Math.max(0, EMPIRE_TUNING.FAILURE_STRIKES - state.strikes.length),
    wornItems: wornItems(state),
  });
}

/**
 * Whether any warning surface is showing at all — worn equipment or a
 * non-sound phase. This is a DISPLAY read and a player model's trigger; it is
 * NOT what the cheap-hire strike is keyed on. `countedWarningVisible` below is.
 *
 * Being a model's trigger is not free, and header §3e is the reckoning: the
 * `'cheapskate'` model triggers its strike-producing hire on this predicate,
 * so the `wornItems` disjunct sits one step upstream of a counted decision. It
 * is inert at the shipped tuning by a derived margin — 0.284 condition points,
 * closing at a wear rate of 0.00463 — and `management.test.ts`'s
 * `STRIKE_PATH_MARGIN` is the check that holds it there.
 */
export function warningSignsVisible(state: ManagedGym): boolean {
  return failurePhase(state) !== 'sound' || wornItems(state).length > 0;
}

/**
 * The warning the cheap-hire strike is keyed on: the failure ledger's own
 * phase, and nothing about condition.
 *
 * The §5.13 wear-basis ruling and §5.7's clarification say low condition may
 * SHOW a repair prompt and may not advance a strike. Worn equipment is a
 * condition read, so keying the counted hire on `warningSignsVisible` put a
 * condition term on the strike path: a run that banked more operation crossed
 * the prompt line at an earlier check-in and had its cheap hire counted there.
 * The phase is a pure function of the strike ledger (`failurePhase`), so this
 * predicate reads decisions only.
 */
export function countedWarningVisible(state: ManagedGym): boolean {
  return failurePhase(state) !== 'sound';
}

/** What recovery needs right now, with the remaining repair cost quoted. */
export type RecoveryRequirement =
  | { readonly kind: 'not-dormant' }
  | { readonly kind: 'ready' }
  | {
      readonly kind: 'blocked';
      readonly equipmentBelowMinimum: boolean;
      readonly managerHiredUnderWarning: boolean;
      readonly repairCostRemainingGymBucks: number;
    };

/** The recovery quote — §5.7's comeback, costed before it is attempted. */
export function recoveryRequirement(state: ManagedGym): RecoveryRequirement {
  if (failurePhase(state) !== 'failed') return Object.freeze({ kind: 'not-dormant' });
  const repairCostRemaining = recoveryRepairCostGymBucks(state);
  const equipmentBelowMinimum = repairCostRemaining > 0;
  const managerHiredUnderWarning = state.manager?.hiredUnderWarning === true;
  if (!equipmentBelowMinimum && !managerHiredUnderWarning) {
    return Object.freeze({ kind: 'ready' });
  }
  return Object.freeze({
    kind: 'blocked',
    equipmentBelowMinimum,
    managerHiredUnderWarning,
    repairCostRemainingGymBucks: repairCostRemaining,
  });
}

// ---------------------------------------------------------------------------
// State construction and validation
// ---------------------------------------------------------------------------

/** Every owned item at condition 1, in canonical order. */
function fullConditionFor(gym: GymState): ConditionByItem {
  const condition: Partial<Record<ManagedEquipmentItem, number>> = {};
  for (const item of ownedItemsOf(gym)) condition[item] = 1;
  return Object.freeze(condition);
}

/** The opening state: stage 2's opening gym, everything new, nobody hired. */
export function createManagedGym(): ManagedGym {
  const gym = createGymState();
  return Object.freeze({
    gym,
    condition: fullConditionFor(gym),
    manager: null,
    strikes: Object.freeze([]),
    neglected: Object.freeze([]),
    promptDismissals: 0,
    checkInsTaken: 0,
    recoveries: 0,
  });
}

/** Refuse a malformed state, and hand a well-formed one back unchanged. */
export function requireManagedGym(state: ManagedGym): ManagedGym {
  requireGymState(state.gym);
  const owned = ownedItemsOf(state.gym);
  const conditionKeys = Object.keys(state.condition);
  if (conditionKeys.length !== owned.length) {
    refuseWith(
      `the condition map holds ${conditionKeys.length} items and the gym owns ${owned.length}`,
    );
  }
  for (const item of owned) {
    const condition = state.condition[item];
    if (condition === undefined) {
      refuseWith(`${String(item)} is owned and carries no condition`);
    }
    if (!Number.isFinite(condition) || condition < 0 || condition > 1) {
      refuseWith(`${String(item)}'s condition must be inside [0, 1], received ${condition}`);
    }
  }
  if (state.manager !== null) requireManagerTier(state.manager.tier);
  const seenNeglected = new Set<string>();
  for (const item of state.neglected) {
    if (state.condition[item] === undefined) {
      refuseWith(`${String(item)} carries a refused repair order and is not owned`);
    }
    if (seenNeglected.has(item)) {
      refuseWith(`${String(item)} carries two refused repair orders`);
    }
    seenNeglected.add(item);
  }
  if (!Number.isInteger(state.promptDismissals) || state.promptDismissals < 0) {
    refuseWith(
      `prompt dismissals must be a whole number at or above zero, received ${state.promptDismissals}`,
    );
  }
  if (!Number.isInteger(state.checkInsTaken) || state.checkInsTaken < 0) {
    refuseWith(
      `check-ins taken must be a whole number at or above zero, received ${state.checkInsTaken}`,
    );
  }
  if (!Number.isInteger(state.recoveries) || state.recoveries < 0) {
    refuseWith(`recoveries must be a whole number at or above zero, received ${state.recoveries}`);
  }
  let previousAt = 0;
  for (const record of state.strikes) {
    if (!COUNTED_DECISIONS.includes(record.decision)) {
      refuseWith(`${String(record.decision)} is not a counted decision`);
    }
    if (!Number.isFinite(record.atSeconds) || record.atSeconds < previousAt) {
      refuseWith(`strike times must be non-decreasing, received ${record.atSeconds}`);
    }
    previousAt = record.atSeconds;
    if (!Number.isFinite(record.shownCostGymBucks) || record.shownCostGymBucks < 0) {
      refuseWith(
        `a shown cost must be finite and at or above zero, received ${record.shownCostGymBucks}`,
      );
    }
  }
  return state;
}

/**
 * Re-seat this module's state on an updated `GymState` — the seam for a
 * caller that bought equipment through `sessions.ts`: known items keep their
 * condition, newly owned items arrive at condition 1. Refuses a gym that no
 * longer owns an item the condition map knows, because nothing sells.
 */
export function withUpdatedGym(state: ManagedGym, gym: GymState): ManagedGym {
  requireManagedGym(state);
  requireGymState(gym);
  const owned = ownedItemsOf(gym);
  const known = new Set<string>(Object.keys(state.condition));
  for (const item of known) {
    if (!owned.includes(item as ManagedEquipmentItem)) {
      refuseWith(`${item} carries a condition and is no longer owned`);
    }
  }
  const condition: Partial<Record<ManagedEquipmentItem, number>> = {};
  for (const item of owned) {
    condition[item] = state.condition[item] ?? 1;
  }
  return Object.freeze({ ...state, gym, condition: Object.freeze(condition) });
}

// ---------------------------------------------------------------------------
// The strike writer — one function, called by the three §5.7 decision shapes
// ---------------------------------------------------------------------------

/**
 * Append a counted decision. The single writer of `strikes` outside
 * `recoverGym`'s clear, so header §3's claim is one code path rather than a
 * convention — and it touches condition NOWHERE, which is header §4's
 * measured derivation: a condition cliff at a decision boundary is a money
 * cost whose arrival time engagement moves.
 */
function countDecision(
  state: ManagedGym,
  decision: CountedDecision,
  atSeconds: number,
  shownCostGymBucks: number,
): ManagedGym {
  return Object.freeze({
    ...state,
    strikes: Object.freeze([
      ...state.strikes,
      Object.freeze({ decision, atSeconds, shownCostGymBucks }),
    ]),
  });
}

/**
 * The strike ledgers the composed run can be driven under. Only the first
 * ships. `'per-refusal'` is the pre-ruling behaviour kept runnable as the
 * `'repeat-strike-control'` wiring — every refusal of an already-refused
 * standing order counted again, so a prompt that fired more often because the
 * player visited more often piled more strikes. Header §3 has the numbers.
 */
type StrikeLedger = 'per-order' | 'per-refusal';

/** The shipped ledger. `runManagedGym`'s control is the only other reader. */
const SHIPPED_STRIKE_LEDGER: StrikeLedger = 'per-order';

/** Record `item`'s standing repair order as refused. Idempotent by construction. */
function withOrderRefused(state: ManagedGym, item: ManagedEquipmentItem): ManagedGym {
  if (isNeglected(state, item)) return state;
  return Object.freeze({ ...state, neglected: Object.freeze([...state.neglected, item]) });
}

/**
 * Close `item`'s standing repair order — the item was actually repaired, so a
 * later refusal of the NEXT order on it is a new decision rather than the same
 * one restated. The one place a refused order ever leaves the ledger outside
 * `recoverGym`'s clear.
 */
function withOrderClosed(state: ManagedGym, item: ManagedEquipmentItem): ManagedGym {
  if (!isNeglected(state, item)) return state;
  const kept: ManagedEquipmentItem[] = [];
  for (let at = 0; at < state.neglected.length; at += 1) {
    const held = state.neglected[at] as ManagedEquipmentItem;
    if (held !== item) kept.push(held);
  }
  return Object.freeze({ ...state, neglected: Object.freeze(kept) });
}

/**
 * The removed entry slump, kept as the control's instrument only: every item
 * loses `slumpCondition`, clamped at zero. Reachable through
 * `runManagedGym`'s `'failure-slump-control'` wiring and through nothing a
 * screen would call — header §4 has the measurement that removed it.
 */
function withFailureSlumpForControl(state: ManagedGym, slumpCondition: number): ManagedGym {
  const condition: Partial<Record<ManagedEquipmentItem, number>> = {};
  for (const item of ownedItemsOf(state.gym)) {
    condition[item] = scrubPrecision(Math.max(0, itemCondition(state, item) - slumpCondition));
  }
  return Object.freeze({ ...state, condition: Object.freeze(condition) });
}

// ---------------------------------------------------------------------------
// The check-in — wear, income at the condition multiplier, wage, auto-repair
// ---------------------------------------------------------------------------

/** One manager auto-repair, reported: which item and what the gym was billed. */
export interface AutoRepairReport {
  readonly item: ManagedEquipmentItem;
  readonly costGymBucks: number;
}

/** Everything one managed check-in did. Reported, never silent. */
export interface ManagedCheckIn {
  readonly state: ManagedGym;
  /** The ladder's own accrual record for the gap, unmodified. */
  readonly accrual: LadderAccrual;
  /** The multiplier the accrual was paid at, read after the gap's wear. */
  readonly incomeMultiplier: number;
  /** What the purse kept of the raw accrual. */
  readonly incomePaidGymBucks: number;
  /** What condition took off the raw accrual — §5.7's auto-deduction. */
  readonly incomeDeductedGymBucks: number;
  /** Mean condition lost to this gap's wear. Zero while dormant. */
  readonly meanConditionWear: number;
  readonly wagePaidGymBucks: number;
  /** Wage due that the purse did not cover. Reported, not silently forgiven. */
  readonly wageShortfallGymBucks: number;
  readonly autoRepairs: readonly AutoRepairReport[];
  /** What the autonomous repairs above cost in total. Reported, never silent. */
  readonly autoRepairSpendGymBucks: number;
  /**
   * How many of the autonomous repairs above closed a standing order that had
   * already been REFUSED — the count header §3e is about, reported so its size
   * is a measured number rather than an argument. See that section: this is a
   * condition read on the countability path that §3a's ordinal derivation does
   * not cover, and this field is what the sweep's domain census pins.
   */
  readonly autoRepairsReopeningRefusedOrders: number;
}

/** A purse write on the composed state, through the ladder it composes. */
function withPurse(state: ManagedGym, gymBucks: number): ManagedGym {
  return Object.freeze({
    ...state,
    gym: withLadder(
      state.gym,
      Object.freeze({ ...state.gym.ladder, gymBucks: scrubPrecision(gymBucks) }),
    ),
  });
}

/** Wear every item by `wearSeconds` of operation, clamped at zero. */
function withWear(state: ManagedGym, wearSeconds: number): ManagedGym {
  if (wearSeconds === 0) return state;
  const wear =
    EMPIRE_TUNING.EQUIPMENT_WEAR_PER_BANKED_HOUR *
    (wearSeconds / EMPIRE_TUNING.SECONDS_PER_HOUR);
  const condition: Partial<Record<ManagedEquipmentItem, number>> = {};
  for (const item of ownedItemsOf(state.gym)) {
    condition[item] = scrubPrecision(Math.max(0, itemCondition(state, item) - wear));
  }
  return Object.freeze({ ...state, condition: Object.freeze(condition) });
}

/**
 * The shipped check-in, and the one place stage 4 touches the income path.
 * Header §§1-2 give the derivation: wear by the gap's banked seconds, then
 * income at the post-wear multiplier, then wage per banked hour, then the
 * manager's autonomous routine repairs — each reported.
 *
 * The private wear-basis seam is what the run's wall-clock-wear control
 * reaches through; this export is pinned to the banked reading.
 */
export function managedCheckIn(state: ManagedGym, atSeconds: number): ManagedCheckIn {
  return checkInWithWearBasis(state, atSeconds, 'banked-operation');
}

/** The wear bases the composed run can drive. Only the first ships. */
type WearBasis = 'banked-operation' | 'wall-clock-elapsed';

function checkInWithWearBasis(
  state: ManagedGym,
  atSeconds: number,
  basis: WearBasis,
): ManagedCheckIn {
  requireManagedGym(state);
  const dormant = failurePhase(state) === 'failed';
  const checkedIn = gymCheckIn(state.gym, atSeconds);
  const accrual = checkedIn.accrual;
  // The ordinal advances here and nowhere else — one writer, so header §3a's
  // "keyed to the check-in index" is a code path rather than a convention.
  let next: ManagedGym = Object.freeze({
    ...state,
    gym: checkedIn.state,
    checkInsTaken: state.checkInsTaken + 1,
  });

  // Wear first — §2 of the header says why the multiplier reads after it.
  // Dormancy applies no wear at all; §4 of the header is the derivation.
  const wearSeconds = dormant
    ? 0
    : basis === 'banked-operation'
      ? accrual.secondsBanked
      : accrual.secondsElapsed;
  const meanBefore = meanCondition(next);
  next = withWear(next, wearSeconds);
  const meanConditionWear = scrubPrecision(meanBefore - meanCondition(next));

  // Income at the post-wear multiplier: the purse was credited the raw
  // accrual by `gymCheckIn`; the deducted share comes back off it here.
  const incomeMultiplier = conditionIncomeMultiplier(next);
  const incomeDeducted = scrubPrecision(accrual.gymBucks * (1 - incomeMultiplier));
  const incomePaid = scrubPrecision(accrual.gymBucks - incomeDeducted);
  next = withPurse(next, next.gym.ladder.gymBucks - incomeDeducted);

  // Wage per banked hour, dormancy excepted, shortfall reported.
  let wagePaid = 0;
  let wageShortfall = 0;
  if (next.manager !== null && !dormant) {
    const due = scrubPrecision(
      managerWageRatePerBankedHour(next.manager.tier) *
        (accrual.secondsBanked / EMPIRE_TUNING.SECONDS_PER_HOUR),
    );
    wagePaid = Math.min(next.gym.ladder.gymBucks, due);
    wageShortfall = scrubPrecision(due - wagePaid);
    next = withPurse(next, next.gym.ladder.gymBucks - wagePaid);
  }

  // The manager's autonomous routine repairs — §5.7's good-manager function,
  // billed to the gym at the published rate, item order fixed.
  const autoRepairs: AutoRepairReport[] = [];
  let autoRepairsReopening = 0;
  if (next.manager !== null && !dormant) {
    const threshold = managerAutoRepairCondition(next.manager.tier);
    for (const item of ownedItemsOf(next.gym)) {
      if (itemCondition(next, item) >= threshold) continue;
      const cost = repairCostGymBucks(next, item);
      if (next.gym.ladder.gymBucks < cost) continue;
      next = withPurse(next, next.gym.ladder.gymBucks - cost);
      next = Object.freeze({
        ...next,
        condition: Object.freeze({ ...next.condition, [item]: 1 }),
      });
      // A manager's repair closes the standing order exactly as the player's
      // own does — the order is answered by the repair, not by who paid.
      //
      // Counted before the close, because after it the fact is gone: this is
      // the one place a CONDITION comparison decides whether a later refusal
      // is countable, and header §3e states its limit and names this count as
      // the catcher.
      if (isNeglected(next, item)) autoRepairsReopening += 1;
      next = withOrderClosed(next, item);
      autoRepairs.push(Object.freeze({ item, costGymBucks: cost }));
    }
  }

  return Object.freeze({
    state: next,
    accrual,
    incomeMultiplier,
    incomePaidGymBucks: incomePaid,
    incomeDeductedGymBucks: incomeDeducted,
    meanConditionWear,
    wagePaidGymBucks: wagePaid,
    wageShortfallGymBucks: wageShortfall,
    autoRepairs: Object.freeze(autoRepairs),
    autoRepairSpendGymBucks: scrubPrecision(
      autoRepairs.reduce((sum, report) => sum + report.costGymBucks, 0),
    ),
    autoRepairsReopeningRefusedOrders: autoRepairsReopening,
  });
}

// ---------------------------------------------------------------------------
// The decisions — §5.7's shapes, each with a shown cost and loud refusals
// ---------------------------------------------------------------------------

/** Repairing an item: it lands, or the refusal says why, state unchanged. */
export type RepairResult =
  | {
      readonly kind: 'repaired';
      readonly state: ManagedGym;
      readonly item: ManagedEquipmentItem;
      readonly cost: number;
    }
  | {
      readonly kind: 'refused';
      readonly state: ManagedGym;
      readonly item: ManagedEquipmentItem;
      readonly cost: number;
      readonly reason: 'not-owned' | 'already-sound' | 'not-enough-gym-bucks';
    };

/**
 * The explicit repair decision: spend the gym's own settled money to restore
 * `item` to full condition, at the quoted cost. Allowed while dormant — it is
 * the recovery investment's instrument.
 */
export function repairEquipment(state: ManagedGym, item: ManagedEquipmentItem): RepairResult {
  requireManagedGym(state);
  if (state.condition[item] === undefined) {
    return Object.freeze({ kind: 'refused', state, item, cost: 0, reason: 'not-owned' });
  }
  const cost = repairCostGymBucks(state, item);
  if (cost === 0) {
    return Object.freeze({ kind: 'refused', state, item, cost, reason: 'already-sound' });
  }
  if (state.gym.ladder.gymBucks < cost) {
    return Object.freeze({ kind: 'refused', state, item, cost, reason: 'not-enough-gym-bucks' });
  }
  const paid = withPurse(state, state.gym.ladder.gymBucks - cost);
  const restored: ManagedGym = Object.freeze({
    ...paid,
    condition: Object.freeze({ ...paid.condition, [item]: 1 }),
  });
  return Object.freeze({
    kind: 'repaired',
    // The repair closes the standing order, so the NEXT refusal of this item is
    // a new decision rather than the same one restated — header §3.
    state: withOrderClosed(restored, item),
    item,
    cost,
  });
}

/** Declining a shown repair: counted, or refused because nothing was offered. */
export type DeclineRepairResult =
  | {
      readonly kind: 'declined';
      readonly state: ManagedGym;
      readonly item: ManagedEquipmentItem;
      readonly shownCost: number;
      /** Whether this decline appended a strike — false when it restates one. */
      readonly counted: boolean;
    }
  | {
      readonly kind: 'refused';
      readonly state: ManagedGym;
      readonly item: ManagedEquipmentItem;
      readonly reason: 'not-owned' | 'not-offered';
    };

/**
 * §5.7's third counted shape: actively declining a repair whose cost was
 * shown. A decline is meaningful when the repair was on offer — the item worn
 * below the prompt line — so a decline of a sound item is a refusal, not a
 * strike. `atSeconds` stamps the record; pass the gym clock's current mark.
 */
export function declineRepair(
  state: ManagedGym,
  item: ManagedEquipmentItem,
  atSeconds: number,
): DeclineRepairResult {
  return declineRepairUnder(state, item, atSeconds, SHIPPED_STRIKE_LEDGER, SHIPPED_REVIEW_GATE);
}

function declineRepairUnder(
  state: ManagedGym,
  item: ManagedEquipmentItem,
  atSeconds: number,
  ledger: StrikeLedger,
  gate: ReviewGate,
): DeclineRepairResult {
  requireManagedGym(state);
  if (state.condition[item] === undefined) {
    return Object.freeze({ kind: 'refused', state, item, reason: 'not-owned' });
  }
  // The same ORDINAL gate `maintenancePrompt` reads, and for the same reason:
  // a decline is meaningful when a standing repair order is open, and whether
  // one is open is a function of the check-in index. This used to compare the
  // item's condition against `MAINTENANCE_PROMPT_CONDITION`, which is the
  // condition-to-strike chain §5.7's clarification forbids — header §3a. The
  // old comparison is the control gate, run by nothing a screen would call.
  const closed =
    gate === 'condition'
      ? itemCondition(state, item) >= EMPIRE_TUNING.MAINTENANCE_PROMPT_CONDITION
      : state.checkInsTaken < orderOpensAt(state);
  if (closed) {
    return Object.freeze({ kind: 'refused', state, item, reason: 'not-offered' });
  }
  const shownCost = repairCostGymBucks(state, item);
  // Header §3: a decline of an order that has already been refused is the same
  // standing decision restated. The prompt is still shown and the decline is
  // still allowed; it appends nothing.
  const counted = ledger === 'per-refusal' || !isNeglected(state, item);
  if (!counted) {
    return Object.freeze({ kind: 'declined', state, item, shownCost, counted: false });
  }
  const struck = countDecision(state, 'repair-declined', atSeconds, shownCost);
  return Object.freeze({
    kind: 'declined',
    state: withOrderRefused(struck, item),
    item,
    shownCost,
    counted: true,
  });
}

/** Answering the maintenance prompt: repair the worst item, or dismiss it. */
export type PromptResponse = 'repair' | 'dismiss';

export type PromptResult =
  | { readonly kind: 'no-prompt'; readonly state: ManagedGym }
  | {
      readonly kind: 'repaired';
      readonly state: ManagedGym;
      readonly item: ManagedEquipmentItem;
      readonly cost: number;
    }
  | {
      readonly kind: 'repair-refused';
      readonly state: ManagedGym;
      readonly item: ManagedEquipmentItem;
      readonly cost: number;
      /**
       * `'already-sound'` is reachable because the review is raised on the
       * ORDINAL rather than on wear: a state whose named item is at full
       * condition has nothing to buy. Every composed run reaches the first
       * review after at least one check-in has banked operation, so the arm
       * belongs to hand-built states — `management.test.ts` drives it there
       * and the arm census counts it.
       */
      readonly reason: 'not-enough-gym-bucks' | 'already-sound';
    }
  | {
      readonly kind: 'dismissed';
      readonly state: ManagedGym;
      readonly item: ManagedEquipmentItem;
      readonly shownCost: number;
      /** Whether this dismissal was a counted decision — past the free one. */
      readonly counted: boolean;
    };

/**
 * §5.7's second counted shape: the in-session maintenance prompt, answered.
 * The first `MAINTENANCE_PROMPT_FREE_DISMISSALS` dismissals mark nothing;
 * each one after is a counted decision carrying the cost that was shown.
 */
export function respondToPrompt(
  state: ManagedGym,
  response: PromptResponse,
  atSeconds: number,
): PromptResult {
  return respondToPromptUnder(
    state,
    response,
    atSeconds,
    SHIPPED_STRIKE_LEDGER,
    SHIPPED_REVIEW_GATE,
  );
}

function respondToPromptUnder(
  state: ManagedGym,
  response: PromptResponse,
  atSeconds: number,
  ledger: StrikeLedger,
  gate: ReviewGate,
): PromptResult {
  requireManagedGym(state);
  const prompt = maintenancePromptUnder(state, gate);
  if (prompt.kind === 'quiet') return Object.freeze({ kind: 'no-prompt', state });
  if (response === 'repair') {
    const outcome = repairEquipment(state, prompt.item);
    if (outcome.kind === 'repaired') {
      return Object.freeze({
        kind: 'repaired',
        state: outcome.state,
        item: outcome.item,
        cost: outcome.cost,
      });
    }
    return Object.freeze({
      kind: 'repair-refused',
      state,
      item: prompt.item,
      cost: prompt.repairCostGymBucks,
      reason: outcome.reason === 'already-sound' ? 'already-sound' : 'not-enough-gym-bucks',
    });
  }
  const counted =
    ledger === 'per-refusal'
      ? state.promptDismissals >= EMPIRE_TUNING.MAINTENANCE_PROMPT_FREE_DISMISSALS
      : prompt.dismissalWouldCount;
  const dismissed: ManagedGym = Object.freeze({
    ...state,
    promptDismissals: state.promptDismissals + 1,
  });
  return Object.freeze({
    kind: 'dismissed',
    state: counted
      ? withOrderRefused(
          countDecision(dismissed, 'prompt-dismissed-again', atSeconds, prompt.repairCostGymBucks),
          prompt.item,
        )
      : dismissed,
    item: prompt.item,
    shownCost: prompt.repairCostGymBucks,
    counted,
  });
}

/** Hiring: it lands (counted if cheap-under-warning), or the refusal says why. */
export type HireResult =
  | {
      readonly kind: 'hired';
      readonly state: ManagedGym;
      readonly tier: ManagerTier;
      readonly cost: number;
      /** §5.7's first counted shape: the cheapest tier, warnings showing. */
      readonly countedAsStrike: boolean;
    }
  | {
      readonly kind: 'refused';
      readonly state: ManagedGym;
      readonly tier: ManagerTier;
      readonly cost: number;
      readonly reason: 'already-staffed' | 'not-enough-gym-bucks';
    };

/**
 * Hire a manager at `tier`, at the published cost. Hiring the cheapest tier
 * while warning signs show is §5.7's first counted decision shape, and the
 * hire itself is flagged so recovery can require the turnaround.
 */
export function hireManager(state: ManagedGym, tier: ManagerTier, atSeconds: number): HireResult {
  requireManagedGym(state);
  const cost = managerHireCostGymBucks(tier);
  if (state.manager !== null) {
    return Object.freeze({ kind: 'refused', state, tier, cost, reason: 'already-staffed' });
  }
  if (state.gym.ladder.gymBucks < cost) {
    return Object.freeze({ kind: 'refused', state, tier, cost, reason: 'not-enough-gym-bucks' });
  }
  const cheapestTier = EMPIRE_TUNING.MANAGER_TIERS[0];
  const countedAsStrike = tier === cheapestTier && countedWarningVisible(state);
  let next = withPurse(state, state.gym.ladder.gymBucks - cost);
  next = Object.freeze({
    ...next,
    manager: Object.freeze({ tier, hiredUnderWarning: countedAsStrike }),
  });
  if (countedAsStrike) {
    next = countDecision(next, 'cheapest-hire-under-warning', atSeconds, cost);
  }
  return Object.freeze({ kind: 'hired', state: next, tier, cost, countedAsStrike });
}

/** Letting the manager go. Free, and the staffing half of a turnaround. */
export type DismissManagerResult =
  | { readonly kind: 'dismissed'; readonly state: ManagedGym; readonly tier: ManagerTier }
  | { readonly kind: 'refused'; readonly state: ManagedGym; readonly reason: 'no-manager' };

export function dismissManager(state: ManagedGym): DismissManagerResult {
  requireManagedGym(state);
  if (state.manager === null) {
    return Object.freeze({ kind: 'refused', state, reason: 'no-manager' });
  }
  return Object.freeze({
    kind: 'dismissed',
    state: Object.freeze({ ...state, manager: null }),
    tier: state.manager.tier,
  });
}

/** Recovery: back online, or the refusal names the first unmet requirement. */
export type RecoveryResult =
  | { readonly kind: 'recovered'; readonly state: ManagedGym }
  | {
      readonly kind: 'refused';
      readonly state: ManagedGym;
      readonly reason:
        | 'not-dormant'
        | 'equipment-below-recovery-minimum'
        | 'manager-hired-under-warning';
    };

/**
 * §5.7's comeback: a dormant gym whose equipment has been restored to the
 * recovery minimum and whose counted-cheap hire is gone comes back online.
 * The active strikes clear, the free-dismissal allowance resets, and the
 * recovery is counted so the comeback is visible in the state.
 */
export function recoverGym(state: ManagedGym): RecoveryResult {
  requireManagedGym(state);
  const requirement = recoveryRequirement(state);
  if (requirement.kind === 'not-dormant') {
    return Object.freeze({ kind: 'refused', state, reason: 'not-dormant' });
  }
  if (requirement.kind === 'blocked') {
    return Object.freeze({
      kind: 'refused',
      state,
      reason: requirement.equipmentBelowMinimum
        ? 'equipment-below-recovery-minimum'
        : 'manager-hired-under-warning',
    });
  }
  return Object.freeze({
    kind: 'recovered',
    state: Object.freeze({
      ...state,
      strikes: Object.freeze([]),
      neglected: Object.freeze([]),
      promptDismissals: 0,
      recoveries: state.recoveries + 1,
    }),
  });
}

// ---------------------------------------------------------------------------
// The composed run — what the sweeps drive
// ---------------------------------------------------------------------------

/**
 * The simulated-player decision policies the composed run folds with —
 * vocabulary, not injection, exactly as `ladder.ts`'s policies are. Each is a
 * deterministic rule below; none is a game feature. 'negligent',
 * 'cheapskate' and 'redemptive' exist so the failure machine's arms are
 * produced rather than merely possible.
 */
export const MANAGEMENT_POLICIES = Object.freeze([
  'hands-off',
  'diligent',
  'negligent',
  'cheapskate',
  'delegating',
  'redemptive',
] as const);

export type ManagementPolicy = (typeof MANAGEMENT_POLICIES)[number];

/**
 * The wirings the run can be driven under. `'shipped'` is the engine; the
 * seven controls are what the sweep's zeros are zeros against, reachable
 * through `runManagedGym`'s wiring argument and through nothing a screen
 * would call:
 *
 *   - `'wall-clock-wear-control'` keys wear to elapsed seconds instead of
 *     banked ones — the decay-while-away model the §5.13 ruling forbids.
 *   - `'absence-strike-control'` fabricates a counted record per whole day
 *     the offline cap discarded from a gap — elapsed time feeding failure,
 *     §5.7 broken by construction.
 *   - `'visit-fee-control'` charges the purse a flat fee per check-in — the
 *     punishing per-event shape `engagement.ts`'s upkeep controls pin.
 *   - `'failure-slump-control'` applies the removed dormancy entry slump at
 *     the check-in whose decisions cross the failure line — the discrete
 *     money cliff header §4 measured and took out.
 *   - `'repeat-strike-control'` counts EVERY refusal instead of every standing
 *     repair order — the pre-ruling chain, where a prompt that fired more
 *     often because the player visited more often piled more strikes. This is
 *     the mechanism header §3a took out, kept runnable, and its counters are
 *     what the shipped rows are read against.
 *     It varies ONE axis and says so. The control still marks orders as
 *     refused, so `maintenancePrompt` picks the same item on both wirings and
 *     the only thing that differs is whether a refusal appends a strike. That
 *     is deliberate: a control that also changed which item was prompted would
 *     leave a difference attributable to either. Its limit, stated because the
 *     type does not carry it: it is a re-implementation of the removed rule
 *     rather than the removed code path, so it is evidence about the SHAPE.
 *     The direct evidence that the shipped path carries the per-order rule is
 *     the `decline:declined:restated` arm and
 *     `management.test.ts`'s `the failure crossing moves no condition`, both
 *     of which call the shipped `declineRepair` and read `counted`.
 *
 *     ITS WITHIN-HORIZON HALF NOW MEASURES NOTHING. Under the ordinal review
 *     both runs of a within-horizon pair take the same decisions at the same
 *     indices, so they carry the same strikes under either ledger. The
 *     engagement half still bites (1811 against the shipped 909), and the
 *     dead half is pinned as an EQUALITY rather than dropped, so a change
 *     that revives it is read.
 *   - `'condition-gated-prompt-control'` raises the maintenance review off
 *     equipment CONDITION instead of the check-in ordinal — the mechanism
 *     header §3a replaced, and the one the §5.13 ruling's within-horizon
 *     zeros are zeros against. Unlike the two above it is the removed CODE
 *     PATH rather than a re-implementation of it: `maintenancePromptUnder`
 *     and `declineRepairUnder` both take the gate, `promptOver` is shared, so
 *     the control differs from the ship in exactly the two comparisons that
 *     changed. The evidence it reproduces the removed mechanism rather than
 *     approximating it is that it returns the previous round's shipped
 *     within-horizon row exactly — 310 / 186 / 124, and 923 net-lower money
 *     readings — which `management.test.ts` asserts as four equalities.
 *   - `'eager-turnaround-control'` restores the `'redemptive'` model's blanket
 *     manager dismissal: shedding whoever presided over the failure even when
 *     `recoveryRequirement` does not ask for it. That is a MODEL control
 *     rather than an engine one — no shipped function changes under it — and
 *     it is here because the ordinal review cadence turned the model's
 *     unrequired spend into an engagement charge. Header §3d has the
 *     measurement, and `management.test.ts` pins its `variantNetLower`
 *     non-zero beside the shipped zero, along with three counters it must
 *     leave EQUAL to the shipped row so the one axis it varies is the one it
 *     claims.
 */
export const MANAGEMENT_WIRINGS = Object.freeze([
  'shipped',
  'wall-clock-wear-control',
  'absence-strike-control',
  'visit-fee-control',
  'failure-slump-control',
  'repeat-strike-control',
  'eager-turnaround-control',
  'condition-gated-prompt-control',
] as const);

export type ManagementWiringKey = (typeof MANAGEMENT_WIRINGS)[number];

/** The one wiring the game ships. */
export const SHIPPED_MANAGEMENT_WIRING: ManagementWiringKey = 'shipped';

/**
 * A wiring and the two magnitudes its controls need. Each dial is required to
 * be zero on every wiring that does not spend it, the discipline
 * `engagement.ts`'s wiring constructor sets — a control whose dial is set on
 * the shipped wiring would be a subject quietly under a control's arithmetic.
 */
export interface ManagementWiring {
  readonly key: ManagementWiringKey;
  readonly controlChargeGymBucks: number;
  readonly controlSlumpCondition: number;
}

/**
 * True for the wiring that keys wear to elapsed seconds instead of banked
 * ones — the decay-while-away model §5.13 forbids.
 */
export function wearsOnWallClock(key: ManagementWiringKey): boolean {
  return key === 'wall-clock-wear-control';
}

/**
 * True for the wiring that fabricates a counted record per whole day the
 * offline cap discarded — elapsed time feeding failure, §5.7 broken by
 * construction.
 */
export function fabricatesAbsenceStrikes(key: ManagementWiringKey): boolean {
  return key === 'absence-strike-control';
}

/** True for the wiring that charges the purse per check-in. */
export function chargesVisitFee(key: ManagementWiringKey): boolean {
  return key === 'visit-fee-control';
}

/** True for the wiring that applies the removed dormancy entry slump. */
export function slumpsOnFailure(key: ManagementWiringKey): boolean {
  return key === 'failure-slump-control';
}

/** True for the wiring that counts every refusal rather than every order. */
export function repeatsStrikes(key: ManagementWiringKey): boolean {
  return key === 'repeat-strike-control';
}

/**
 * True for the wiring under which the `'redemptive'` model sheds ANY manager
 * on the way back from dormancy, rather than only the one
 * `recoveryRequirement` blocks on. Header §3d.
 */
export function shedsAnyManager(key: ManagementWiringKey): boolean {
  return key === 'eager-turnaround-control';
}

/**
 * True for the wiring that raises a maintenance review off equipment CONDITION
 * instead of the check-in ordinal — the mechanism header §3a replaced.
 */
export function gatesReviewOnCondition(key: ManagementWiringKey): boolean {
  return key === 'condition-gated-prompt-control';
}

/** The strike ledger a wiring drives the run under. */
function ledgerOf(key: ManagementWiringKey): StrikeLedger {
  return repeatsStrikes(key) ? 'per-refusal' : SHIPPED_STRIKE_LEDGER;
}

/** The review gate a wiring drives the run under. */
function gateOf(key: ManagementWiringKey): ReviewGate {
  return gatesReviewOnCondition(key) ? 'condition' : SHIPPED_REVIEW_GATE;
}

/** Build a wiring, refusing a dial on a wiring that has nothing to turn. */
export function managementWiring(
  key: ManagementWiringKey,
  controlChargeGymBucks: number,
  controlSlumpCondition = 0,
): ManagementWiring {
  if (!MANAGEMENT_WIRINGS.includes(key)) {
    refuseWith(`${String(key)} is not a management wiring`);
  }
  if (!Number.isFinite(controlChargeGymBucks) || controlChargeGymBucks < 0) {
    refuseWith(
      `a control charge must be finite and at or above zero, received ${controlChargeGymBucks}`,
    );
  }
  if (!chargesVisitFee(key) && controlChargeGymBucks !== 0) {
    refuseWith(`the ${key} wiring charges no visit fee, so ${controlChargeGymBucks} has no meaning`);
  }
  if (chargesVisitFee(key) && controlChargeGymBucks === 0) {
    refuseWith(`the ${key} wiring charges nothing at zero, so it controls for nothing`);
  }
  if (!Number.isFinite(controlSlumpCondition) || controlSlumpCondition < 0 || controlSlumpCondition > 1) {
    refuseWith(
      `a control slump must be finite and inside [0, 1], received ${controlSlumpCondition}`,
    );
  }
  if (!slumpsOnFailure(key) && controlSlumpCondition !== 0) {
    refuseWith(`the ${key} wiring slumps nothing, so ${controlSlumpCondition} has no meaning`);
  }
  if (slumpsOnFailure(key) && controlSlumpCondition === 0) {
    refuseWith(`the ${key} wiring slumps nothing at zero, so it controls for nothing`);
  }
  return Object.freeze({ key, controlChargeGymBucks, controlSlumpCondition });
}

/** The shipped wiring, which has no dial. */
export function shippedManagementWiring(): ManagementWiring {
  return managementWiring(SHIPPED_MANAGEMENT_WIRING, 0, 0);
}

/** A decision the run's policy took, in the order taken. Kinds are closed. */
export const MANAGED_DECISION_KINDS = Object.freeze([
  'repair',
  'prompt-repair',
  'prompt-dismiss',
  'decline-repair',
  'hire-novice',
  'hire-steady',
  'hire-veteran',
  'dismiss-manager',
  'recover',
] as const);

export type ManagedDecisionKind = (typeof MANAGED_DECISION_KINDS)[number];

export interface ManagedDecisionEvent {
  readonly kind: ManagedDecisionKind;
  /** Index into the run's readings — which check-in the decision followed. */
  readonly checkIn: number;
  /** Whether it appended a strike. */
  readonly counted: boolean;
}

/** One check-in's readings — the series the never-punish sweep compares. */
export interface ManagedReading {
  readonly atSeconds: number;
  readonly secondsBanked: number;
  readonly meanCondition: number;
  readonly incomeMultiplier: number;
  readonly incomePaid: number;
  readonly incomeDeducted: number;
  readonly wagePaid: number;
  /** Gym Bucks the manager's autonomous repairs billed at this check-in. */
  readonly autoRepairSpend: number;
  /** Gym Bucks the policy's own decisions spent at this check-in. */
  readonly decisionSpend: number;
  /** Gym Bucks a control charged at this check-in. Zero on the shipped wiring. */
  readonly controlSpend: number;
  /**
   * Whether a standing repair order was OPEN at this check-in — the review
   * `maintenancePrompt` would have raised, read at the moment the check-in's
   * accrual settled and before this check-in's decisions.
   *
   * Reported rather than derived by a sweep from the cadence arithmetic,
   * because a sweep that recomputed the cadence would be grading the engine
   * against a copy of itself. `management.test.ts`'s `reviewsOfferedMismatches`
   * counter compares this field and nothing else.
   *
   * The one moment it is read at is stated because it matters: the
   * `'cheapskate'` model may hire between here and the point its policy block
   * reads the prompt, and a hire moves neither condition nor `checkInsTaken`,
   * so the two reads agree. Nothing else runs in between.
   */
  readonly reviewOffered: boolean;
  /**
   * The settled purse itself — `netPosition`'s first term, reported so the
   * decomposition can be read out of a reading rather than re-derived.
   */
  readonly settledGymBucks: number;
  /** The full repair bill — `netPosition`'s second term, same reason. */
  readonly fullRepairCost: number;
  /**
   * Settled purse, minus the full repair bill, plus the hired manager's
   * published cost — the position the monotonicity pins compare, so a run
   * cannot look richer by simply not having spent yet. Both adjustments are
   * net-neutral at the moment of the spend by construction: a repair's cost
   * equals the bill it removes, and a hire's cost equals the asset term it
   * adds. Without the second term a richer run that hires the veteran one
   * check-in earlier reads as net-worse for the readings in between, which is
   * the timed-lump-spend phasing `engagement.ts` measured and attributed to
   * the player model rather than to the design.
   *
   * All three terms are reported beside it, and
   * `management.test.ts`'s `netPosition is exactly its three reported terms`
   * pins the identity over every reading of every run the battery drove, in
   * both the per-reading and the end-of-run direction. That pin is what makes
   * a fourth term visible: adding one changes `netPosition` and moves none of
   * the three reported terms, so the identity goes red rather than the sweep
   * quietly reporting a different quantity under the same name.
   */
  readonly netPosition: number;
  /** The manager term inside `netPosition`, reported so it can be read out. */
  readonly managerAssetValue: number;
  readonly phase: FailurePhase;
  readonly strikeCount: number;
}

/** What one composed run actually did, so a zero reports its own domain. */
export interface ManagedRunCensus {
  readonly checkIns: number;
  readonly promptsOffered: number;
  /**
   * Prompts offered on an item whose standing order had already been refused
   * — the shown-but-uncountable case header §3 introduces. Non-zero is what
   * says the per-order ledger is actually suppressing repeat refusals rather
   * than the domain never producing one.
   */
  readonly promptsAlreadyRefused: number;
  readonly promptRepairs: number;
  readonly promptDismissals: number;
  readonly countedDismissals: number;
  readonly repairs: number;
  readonly declines: number;
  /** Declines that appended no strike because the order was already refused. */
  readonly uncountedDeclines: number;
  readonly autoRepairs: number;
  /**
   * Autonomous repairs that closed a standing order the player had already
   * REFUSED, so the next refusal of that item is countable again. Header §3e:
   * a condition read on the countability path, sized rather than argued.
   */
  readonly autoRepairsReopeningRefusedOrders: number;
  readonly hires: number;
  readonly managerDismissals: number;
  readonly recoveries: number;
  readonly recoveryRefusals: number;
  readonly wageShortfalls: number;
  /** Check-ins a control charged, struck or slumped on. Zero when shipped. */
  readonly controlCharges: number;
  readonly controlStrikes: number;
  readonly controlSlumps: number;
  /**
   * Refusals the repeat-strike control counted that the shipped per-order
   * ledger suppresses — the control's own effect size, so a control that
   * stopped biting reports itself instead of passing quietly.
   */
  readonly controlRepeatStrikes: number;
  /** The first reading index at which the gym was failed, or null. */
  readonly failedAtCheckIn: number | null;
}

/** One composed run: the end state and every series the sweeps compare. */
export interface ManagedRun {
  readonly state: ManagedGym;
  readonly wiring: ManagementWiring;
  readonly policy: ManagementPolicy;
  readonly readings: readonly ManagedReading[];
  readonly decisions: readonly ManagedDecisionEvent[];
  readonly census: ManagedRunCensus;
}

/** The decision-event kind a hire of `tier` records. A map, not a cast. */
function hireKindOf(tier: ManagerTier): ManagedDecisionKind {
  if (tier === 'novice') return 'hire-novice';
  if (tier === 'steady') return 'hire-steady';
  return 'hire-veteran';
}

/**
 * Fold a whole check-in schedule through the managed gym under a named
 * policy and wiring. Deterministic by construction: no draw, no clock read,
 * fixed item order, fixed decision order per check-in. The schedule must be
 * strictly ascending whole ticks, as `ladderCheckIn` requires.
 */
export function runManagedGym(
  checkInsSeconds: readonly number[],
  policy: ManagementPolicy,
  wiring: ManagementWiring = shippedManagementWiring(),
): ManagedRun {
  if (!MANAGEMENT_POLICIES.includes(policy)) {
    refuseWith(`${String(policy)} is not a management policy`);
  }
  // Revalidate through the constructor, so a hand-built wiring object gets
  // the same refusals (a dial on a wiring with nothing to turn, and so on).
  managementWiring(wiring.key, wiring.controlChargeGymBucks, wiring.controlSlumpCondition);

  let state = createManagedGym();
  const readings: ManagedReading[] = [];
  const decisions: ManagedDecisionEvent[] = [];
  let promptsOffered = 0;
  let promptRepairs = 0;
  let promptDismissalCount = 0;
  let countedDismissals = 0;
  let repairs = 0;
  let declines = 0;
  let uncountedDeclines = 0;
  let promptsAlreadyRefused = 0;
  let autoRepairCount = 0;
  let autoRepairsReopeningRefusedOrders = 0;
  let hires = 0;
  let managerDismissals = 0;
  let recoveries = 0;
  let recoveryRefusals = 0;
  let wageShortfalls = 0;
  let controlCharges = 0;
  let controlStrikes = 0;
  let controlSlumps = 0;
  let controlRepeatStrikes = 0;
  const ledger = ledgerOf(wiring.key);
  const gate = gateOf(wiring.key);
  let failedAtCheckIn: number | null = null;
  let previous = -1;

  // An index loop and not `checkInsSeconds.entries()`, deliberately: a member
  // call on a caller-supplied array is an enumerated site
  // `empireForbiddenOutput.test.ts` has to drive or declare undriven, and this
  // directory's own precedent is that a smaller enumerated surface is worth
  // more than another driver for something no caller can reach.
  for (let checkIn = 0; checkIn < checkInsSeconds.length; checkIn += 1) {
    const at = checkInsSeconds[checkIn] as number;
    if (at <= previous) {
      refuseWith(`check-ins must be strictly ascending, received ${at} after ${previous}`);
    }
    previous = at;

    const basis: WearBasis =
      wearsOnWallClock(wiring.key) ? 'wall-clock-elapsed' : 'banked-operation';
    const outcome = checkInWithWearBasis(state, at, basis);
    state = outcome.state;
    autoRepairCount += outcome.autoRepairs.length;
    autoRepairsReopeningRefusedOrders += outcome.autoRepairsReopeningRefusedOrders;
    if (outcome.wageShortfallGymBucks > 0) wageShortfalls += 1;

    let controlSpend = 0;
    if (chargesVisitFee(wiring.key)) {
      const charge = Math.min(state.gym.ladder.gymBucks, wiring.controlChargeGymBucks);
      if (charge > 0) {
        state = withPurse(state, state.gym.ladder.gymBucks - charge);
        controlCharges += 1;
        controlSpend = scrubPrecision(charge);
      }
    }
    // The purse mark the decision spend is measured from — everything the
    // check-in itself did has landed by here, so the difference across the
    // policy block below is exactly what the policy's decisions cost.
    const purseBeforeDecisions = state.gym.ladder.gymBucks;
    const reviewOffered = maintenancePromptUnder(state, gate).kind === 'offered';

    if (fabricatesAbsenceStrikes(wiring.key)) {
      // The control fabricates counted records off elapsed time — one per
      // whole day the offline cap discarded, so pure absence beyond the
      // horizon feeds failure directly. A decision the player did not take,
      // which is exactly the §5.7 violation it models. It reuses the decline
      // token so no control-owned vocabulary ships in the ledger's type.
      const fabricated = Math.floor(
        outcome.accrual.secondsDiscarded / EMPIRE_TUNING.SECONDS_PER_DAY,
      );
      for (let struck = 0; struck < fabricated; struck += 1) {
        state = countDecision(state, 'repair-declined', at, fullRepairCostGymBucks(state));
        controlStrikes += 1;
      }
    }

    // The policy's decisions, in one fixed order per check-in.
    const failedBeforeDecisions = failurePhase(state) === 'failed';
    if (policy !== 'hands-off') {
      const dormant = failurePhase(state) === 'failed';
      if (policy === 'redemptive' && dormant) {
        // Repair everything affordable, shed a counted hire, then recover.
        for (const item of ownedItemsOf(state.gym)) {
          const repaired = repairEquipment(state, item);
          if (repaired.kind === 'repaired') {
            state = repaired.state;
            repairs += 1;
            decisions.push(Object.freeze({ kind: 'repair', checkIn, counted: false }));
          }
        }
        // The staffing turnaround sheds exactly the manager the ENGINE blocks
        // recovery on — `recoveryRequirement`'s `manager-hired-under-warning`
        // arm, which is §5.7's turnaround requirement and nothing more.
        //
        // It used to shed ANY manager, and header §3d has the measurement that
        // changed it: an unrequired dismissal destroys the hire's whole asset
        // value with no refund, the comeback pays for a fresh one, and under
        // the ordinal review cadence a run that checked in more went round
        // that cycle more often per unit of calendar. The old model is kept
        // runnable as `'eager-turnaround-control'` rather than deleted.
        const shedManager =
          state.manager !== null &&
          (shedsAnyManager(wiring.key) || state.manager.hiredUnderWarning);
        if (shedManager) {
          const dismissed = dismissManager(state);
          if (dismissed.kind === 'dismissed') {
            state = dismissed.state;
            managerDismissals += 1;
            decisions.push(Object.freeze({ kind: 'dismiss-manager', checkIn, counted: false }));
          }
        }
        const recovered = recoverGym(state);
        if (recovered.kind === 'recovered') {
          state = recovered.state;
          recoveries += 1;
          decisions.push(Object.freeze({ kind: 'recover', checkIn, counted: false }));
          // The staffing half of §5.7's turnaround: after coming back online,
          // the redemptive player hires the middle tier so the comeback has a
          // keeper — and so the hire-steady arm is produced by a run.
          if (state.manager === null) {
            const steady = EMPIRE_TUNING.MANAGER_TIERS[1] as ManagerTier;
            const hired = hireManager(state, steady, at);
            if (hired.kind === 'hired') {
              state = hired.state;
              hires += 1;
              decisions.push(
                Object.freeze({
                  kind: hireKindOf(steady),
                  checkIn,
                  counted: hired.countedAsStrike,
                }),
              );
            }
          }
        } else {
          recoveryRefusals += 1;
        }
      } else {
        if (policy === 'delegating' && state.manager === null) {
          // The delegating player waits for the manager worth delegating to —
          // the top tier — rather than settling for whoever is affordable.
          const best = EMPIRE_TUNING.MANAGER_TIERS[
            EMPIRE_TUNING.MANAGER_TIERS.length - 1
          ] as ManagerTier;
          const tier =
            state.gym.ladder.gymBucks >= managerHireCostGymBucks(best) ? best : null;
          if (tier !== null) {
            const hired = hireManager(state, tier, at);
            if (hired.kind === 'hired') {
              state = hired.state;
              hires += 1;
              decisions.push(
                Object.freeze({
                  kind: hireKindOf(tier),
                  checkIn,
                  counted: hired.countedAsStrike,
                }),
              );
            }
          }
        }
        if (policy === 'cheapskate' && state.manager === null && warningSignsVisible(state)) {
          // The cheapskate reacts to visible trouble by hiring the cheapest
          // tier — §5.7's first counted shape, produced rather than possible.
          //
          // THE PREDICATE HERE IS THE DISPLAY READ, WHICH IS A CONDITION READ
          // ONE STEP UPSTREAM OF A STRIKE. It is deliberate — a player model
          // reacts to what a screen shows — and it is the reason header §3e
          // exists. `management.test.ts`'s `STRIKE_PATH_MARGIN` is the check
          // that keeps the worn disjunct from firing before the phase one, and
          // §1's table is what happens when the wear rate closes that margin.
          const cheapest = EMPIRE_TUNING.MANAGER_TIERS[0];
          const hired = hireManager(state, cheapest, at);
          if (hired.kind === 'hired') {
            state = hired.state;
            hires += 1;
            decisions.push(
              Object.freeze({
                kind: hireKindOf(cheapest),
                checkIn,
                counted: hired.countedAsStrike,
              }),
            );
          }
        }

        const prompt = maintenancePromptUnder(state, gate);
        if (prompt.kind === 'offered') {
          promptsOffered += 1;
          if (prompt.alreadyRefused) promptsAlreadyRefused += 1;
          if (policy === 'diligent' || policy === 'delegating') {
            const answered = respondToPromptUnder(state, 'repair', at, ledger, gate);
            if (answered.kind === 'repaired') {
              state = answered.state;
              promptRepairs += 1;
              decisions.push(Object.freeze({ kind: 'prompt-repair', checkIn, counted: false }));
            }
          } else if (policy === 'cheapskate') {
            // The active decline — §5.7's third shape, produced rather than
            // merely possible: the cheapskate is shown the worst item's cost
            // and turns it down, every prompted check-in.
            const suppressed = ledger === 'per-refusal' && isNeglected(state, prompt.item);
            const turnedDown = declineRepairUnder(state, prompt.item, at, ledger, gate);
            if (turnedDown.kind === 'declined') {
              state = turnedDown.state;
              declines += 1;
              if (!turnedDown.counted) uncountedDeclines += 1;
              if (suppressed) controlRepeatStrikes += 1;
              decisions.push(
                Object.freeze({
                  kind: 'decline-repair',
                  checkIn,
                  counted: turnedDown.counted,
                }),
              );
            }
          } else {
            const beforeDismiss = state;
            const answered = respondToPromptUnder(state, 'dismiss', at, ledger, gate);
            if (answered.kind === 'dismissed') {
              const suppressed =
                ledger === 'per-refusal' &&
                answered.counted &&
                isNeglected(beforeDismiss, answered.item);
              state = answered.state;
              promptDismissalCount += 1;
              if (answered.counted) countedDismissals += 1;
              if (suppressed) controlRepeatStrikes += 1;
              decisions.push(
                Object.freeze({ kind: 'prompt-dismiss', checkIn, counted: answered.counted }),
              );
            }
          }
        }

        if (policy === 'diligent') {
          for (const item of ownedItemsOf(state.gym)) {
            if (itemCondition(state, item) >= EMPIRE_TUNING.REPAIR_POLICY_CONDITION) continue;
            const repaired = repairEquipment(state, item);
            if (repaired.kind === 'repaired') {
              state = repaired.state;
              repairs += 1;
              decisions.push(Object.freeze({ kind: 'repair', checkIn, counted: false }));
            }
          }
        }
      }
    }

    if (
      slumpsOnFailure(wiring.key) &&
      !failedBeforeDecisions &&
      failurePhase(state) === 'failed'
    ) {
      // The removed mechanism, run as a control at the crossing it used to
      // fire on — header §4 has the measurement that took it out of the
      // shipped path.
      state = withFailureSlumpForControl(state, wiring.controlSlumpCondition);
      controlSlumps += 1;
    }

    if (failedAtCheckIn === null && failurePhase(state) === 'failed') {
      failedAtCheckIn = checkIn;
    }
    readings.push(
      Object.freeze({
        atSeconds: at,
        secondsBanked: outcome.accrual.secondsBanked,
        meanCondition: meanCondition(state),
        incomeMultiplier: outcome.incomeMultiplier,
        incomePaid: outcome.incomePaidGymBucks,
        incomeDeducted: outcome.incomeDeductedGymBucks,
        wagePaid: outcome.wagePaidGymBucks,
        autoRepairSpend: outcome.autoRepairSpendGymBucks,
        decisionSpend: scrubPrecision(purseBeforeDecisions - state.gym.ladder.gymBucks),
        controlSpend,
        reviewOffered,
        settledGymBucks: state.gym.ladder.gymBucks,
        fullRepairCost: fullRepairCostGymBucks(state),
        netPosition: scrubPrecision(
          state.gym.ladder.gymBucks -
            fullRepairCostGymBucks(state) +
            managerAssetValueGymBucks(state),
        ),
        managerAssetValue: managerAssetValueGymBucks(state),
        phase: failurePhase(state),
        strikeCount: state.strikes.length,
      }),
    );
  }

  return Object.freeze({
    state,
    wiring,
    policy,
    readings: Object.freeze(readings),
    decisions: Object.freeze(decisions),
    census: Object.freeze({
      checkIns: checkInsSeconds.length,
      promptsOffered,
      promptsAlreadyRefused,
      promptRepairs,
      promptDismissals: promptDismissalCount,
      countedDismissals,
      repairs,
      declines,
      uncountedDeclines,
      autoRepairs: autoRepairCount,
      autoRepairsReopeningRefusedOrders,
      hires,
      managerDismissals,
      recoveries,
      recoveryRefusals,
      wageShortfalls,
      controlCharges,
      controlStrikes,
      controlSlumps,
      controlRepeatStrikes,
      failedAtCheckIn,
    }),
  });
}
