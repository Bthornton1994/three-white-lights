# CLAUDE.md — Powerlifting Game

## Source of Truth

`docs/GDD.md` is the authoritative design document. Read it before proposing any
feature work. If a request conflicts with the GDD, say so explicitly and ask
whether to change the design or the request — do not silently pick one.

If a design decision genuinely needs to change, update `docs/GDD.md` in the same
commit as the code. The doc and the code never diverge.

## Run Mode

**MODE: Gauntlet Loop (one-shot build)**

The project is built broadly in a single long unattended run, not in human-paced
phases. See GDD §12. The build prompt is `BUILD_PROMPT_CLAUDE.md`.

Under this mode:

- Builders and critics are separate subagents. A builder never grades its own work.
- Critics receive the goal, the bar (GDD §12.2), the refusal conditions
  (GDD §12.3), and the actual artifact — never the builder's reasoning or summary.
- Critics inspect real output: rendered pixels, the running app, actual test
  results.
- No fixed round count. Loop until the output wins its bar or the run is stopped.
- The lead agent chooses the decomposition. This file and the GDD supply the
  *what* and the *bar*, not the route.

If switching to human-paced phased building instead, replace this section with
the phase gates in GDD §10.

## Subagent Roles

Two subagent definitions live in `.claude/agents/`. Use them; do not improvise
roles that blur the line between building and grading.

- **`builder`** — full tool access. Implements one piece. Never grades.
- **`critic`** — read-only tool allowlist (no Write, no Edit, no destructive
  Bash). Judges one piece against its bar and reports the single biggest
  remaining gap. Does not fix what it finds.

The read-only restriction is load-bearing. A critic that can edit becomes a
second builder, and the independent judgment the method depends on disappears.

Each critic is spawned fresh. It receives the goal, the bar, the refusal
conditions, and the artifact — never the builder's transcript.

## Game Feel Values Must Be Tunable

Timing windows, animation curves, haptic patterns, and difficulty thresholds are
tuned by hand after the run, across roughly 30 iterations, by actual playtesting.

Keep every such value as a named constant in one place. Never scatter them as
magic numbers across components. When a task depends on game feel, build the
tunable version and say so — do not assert the values are right.

## A Comment That Asserts a Guarantee Must Have a Test That Fails Without It

If a comment or docstring says the code guarantees something — *"this cannot
happen"*, *"calling it early, late or never leaves the player in the same
place"*, *"nothing else paints in here"*, *"every number here is derived"* —
then there must be a test that goes red if the guarantee stops holding. Prose is
not a check, and a reader cannot tell the difference by looking.

This is not a style preference. It has now failed **seven times** in this
codebase; the fifth was found inside the comment that had just been rewritten to
fix the fourth, the sixth one file away from where the fifth was fixed, and the
seventh in a fix's own verification oracle:

- a scrim constant *"registered, documented and read by no pixel"*;
- a dismiss window whose stated causation nothing on the app's route consulted;
- a crowd-window equality described as failing *"in both directions"* that could
  not fail upward;
- `settleBrokenStreak` promising *"it cannot change any outcome"* while the
  order it ran in decided 11 versus 1;
- and, in the corrected version of that same docstring, *"the doomed burn is the
  armed amount"* — the precise arithmetic that had been measured at 3 / 23 / 1
  violating pairs and rejected as a §12.3 breach one commit earlier;
- and a docstring saying the store's refusal copy was keyed by
  `StreakBreakReason` when it had been keyed on `entitlementArmed` for a round.

Every one was true-sounding, none could be reddened, and each survived a round.
The pattern is not carelessness — it is that a sentence written while the code
was true keeps its confident tone after the code moves.

**What to do about it.** Tag the claim and let a scan resolve it, the way
`src/art/spriteMarks.test.ts`'s `@ours` and `lifterSprite.test.ts`'s `@ref` tags
already work: scanned tree-wide, resolved against real measured values, with an
untagged-value ban and a non-vacuity guard. Converge on that machinery rather
than growing a third dialect.

**A TAG THAT RESOLVES IS NOT A TAG THAT BITES, and this is measured.** The
first enforcement pass covered **19 of 185** claims — about a tenth — and then
mutation-tested 8 of those 19. **Two named a test that stayed green when the
guarantee was broken**: one exercised the calendar but never a purchase, the
other started from a full window so clearing the entitlement was invisible. Both
tags resolved perfectly. So the tag is a pointer, and a pointer to a test that
cannot fail is the same defect one level out. The 11 unverified tags carry no
evidence at all.

**So a tag must survive a mutation check WHEN IT IS DECLARED, not merely name a
test that passes.** A bare pass is not evidence — a quarter of the sample that
was actually checked failed exactly that bar. Break the guarantee, watch the
named test go red, restore, and **record the witness in `MUTATION_WITNESSES`** —
the verbatim text the mutant replaced and the verbatim assertion that reddened,
both required to resolve uniquely, with the assertion required to sit inside the
named test's body, so a witness expires the moment either is edited away. Do it
at declaration time, when the code is already in your head and it costs two
copy-pastes on top of a mutation you already ran; a bar that costs an hour per tag stops being
met, which is how the backlog got here.

**The existing backlog is tracked debt, not a mass audit.** Close a tag's
evidence gap when its module is next touched. Deliberately not a sweep: the two
that were proven vacuous were fixed immediately because they were proven, and
the rest are unproven rather than known-broken. Do not let that distinction blur
in either direction — an unverified tag is not evidence, and it is also not a
known defect.

**AN ORACLE CAN BE INDEPENDENT IN FORM AND SHARE ITS SUBJECT'S BLIND SPOT IN
FACT, and that is the seventh instance.** A fix routed on when a break was
*recorded*; `settleBrokenStreak` refuses a null `lastTrainedDay`, so a
never-trained lifter never has one recorded while their signup absence still
runs out on a definite day. The check written to catch that read the same fact,
so it was green — differently shaped, identically blind. Writing a second
implementation is not enough; ask what fact both of them read, and probe the
region where that fact is unavailable rather than reviewing the two for
resemblance.

**And be honest about the limit.** No scan can decide which prose asserts a
guarantee, so any mechanism here is necessarily partial. The current scoping
rule keys on a run of capitalised absolutes, which is this codebase's house
style for a load-bearing sentence — so a **lower-case** guarantee walks past it,
and the fifth defect's own sentence was lower-case and got caught only because
its paragraph happened to open with a capitalised absolute. That is luck, and it
is recorded as luck. State in the code what
its scoping rule catches and what it therefore cannot, and say what fraction of
existing claims it covers. A narrow honest ban beats a broad one that has to be
suppressed everywhere; a partial mechanism that declares its coverage beats one
that implies completeness. What is not acceptable is a guarantee in prose with
nothing behind it and no note saying so.

## Architecture Rules

### Pure logic is separate from UI

All game math lives in dedicated pure TypeScript modules:

- Zero React imports
- Zero side effects
- Zero direct I/O
- Every exported function has unit tests

This includes: e1RM calculation, RPE→%1RM tables, fatigue state transitions,
attempt resolution, DOTS scoring.

Never inline game math into a component. If you find yourself computing a load or
a fatigue modifier inside a `.tsx` file, stop and move it to a pure TypeScript
module.

### Server-authoritative progression

Any mutation to Total, e1RM, streak state, meet results, or currency balances
goes through a Supabase Edge Function. The client never writes these directly,
even during prototyping. (Not applicable in Prototype 1 — no backend yet — but do
not write client-authoritative code that will need unwinding later.)

### Client is a renderer

Local state is a cache of server truth, not the truth itself.

## Domain Correctness

These are checkable by real powerlifters and must be correct, not approximated:

- **RPE → %1RM**: use a standard reps-in-reserve chart (Tuchscherer-style). Do
  not invent values.
- **e1RM**: **Epley**, and only Epley: `1RM = weight × (1 + reps/30)`. Not
  "Epley or Brzycki" — one formula, so two parts of the app can never report
  different numbers for the same set. Brzycki is not a fallback and must not
  appear in the codebase, under any name.
  Where the published RPE chart covers a set, the estimate is the chart read
  backwards, because that is the curve loads are prescribed from and using
  anything else would make a lifter's e1RM drift every time they hit their
  target exactly. Past the chart's coverage the app **refuses** rather than
  extrapolating: Epley cannot be joined onto the top of the chart without the
  curve stepping down, and a second formula is banned. So Epley is the one
  rep-max formula the codebase may ever reach for, not a curve the player-facing
  path currently runs through — say that plainly rather than claiming it is
  applied everywhere.
  Note that Epley is a *rep-max* formula: it reads `reps` as reps to failure. A
  submaximal set must be converted to its rep-max equivalent first, via the RPE
  chart above (reps + reps in reserve), before Epley is applied. Applying Epley
  directly to an RPE-targeted set under-reports e1RM and is a bug.
- **DOTS / Wilks**: use the published coefficients. Do not homebrew.
- **Meet structure**: squat → bench → deadlift, three attempts each, total is the
  sum of best successful attempt per lift, attempts may not go down in weight
  within a lift.

Fatigue and injury are deliberately *not* in this category — they are game-feel
abstractions (GDD §3.1) and should behave plausibly rather than simulate
physiology.

## Hard Design Constraints

- **No pay-to-win, ever.** Nothing purchasable may affect Total, e1RM, training
  pace, or meet performance. If a proposed feature touches this line, refuse and
  explain.
- **No gacha.** NPC recruitment is deterministic — flat cost or reputation
  threshold. No random pulls, no rarity tiers behind currency.
- **No fatigue bar.** Fatigue surfaces through bar-speed cues, timing window
  width, and readiness feedback — never as a visible meter.
- **No forced ads.** Rewarded-only, if ads ship at all.
- **Never punish daily engagement.** Injury setbacks are short, soft, and
  recoverable. A player who shows up every day must never feel penalized for it.

  This is checkable, and it is checked. In the streak system it means: **for two
  training histories identical except that one has an extra trained day, the
  player who trained more must never end on a lower streak.** Do not weaken the
  pins below into bounds — a bound lets the defect grow back quietly.

  `src/game/streak.test.ts` measures it exhaustively over
  every calendar of 8–16 days *and* on seeded 40 / 60 / 80 / 100-day sweeps, on
  `currentStreak`, on `longestStreak` and on the worst deficit, and pins the
  counts at **zero on all three**. The stock's numbers — 13 / 122 / 142 / 74
  violating pairs, 14 / 150 / 276 / 221 lifetime-best inversions, worst deficit
  189 at 400 days — stay in the file as the thing the zeros are zero against.
  Do not weaken those pins into bounds.

  **Coverage is a rolling entitlement, not a stock.** GDD §4.2 Option 1;
  `src/game/streakEntitlement.ts`, wired into `streak.ts`.
  `COVERED_DAYS_PER_WINDOW` covered days in every `WINDOW_DAYS` window, anchored
  at signup, nothing carrying over. There is no hold cap, no earning table and
  no balance to hoard — because a balance you hold is a quantity training can
  make you rich in at the wrong moment, which was the defect.

  **Coverage is armed by a session, and an absence resolves against the
  snapshot, not the balance.** `StreakState.entitlement` is the live balance,
  which `applySettledCoveredDayPurchase` raises; `StreakState.armedEntitlement`
  is what an absence may draw, and only `recordTrainingDay` and
  `createStreakState` write it. Whether a run *survives* reads the armed
  snapshot; what a doomed absence *costs* reads the live one, and that asymmetry
  is load-bearing rather than an oversight — charging the doomed burn against
  the armed count instead measures 3 / 23 / 1 violating pairs, including one in
  a control where both lifters buy on identical days, which is a §12.3 breach.

  **A store verdict may render stale; a completed sale may not.** Finalising
  re-validates through `settledStateAsOf`, which walks every day from the
  absence anchor to today, offers each to the real `settleBrokenStreak`, and
  keeps the first thing it records — then asks the same `protectionHolds` call
  the refusal always asked. A single settle **at the completion day is
  measurably not enough**: on a revival day the absence still holds, so that
  settle records `NOTHING_TO_SETTLE` and the revived run walks straight
  through. Only the walk finds the break where it happened. With this in place
  the store-verdict exception count is **zero** and the open-day spend equality
  is unconditional again; the counter stays pinned at zero so a reopening is
  red rather than silent. **The refusal copy is keyed to
  `SettledCoveredDayPurchase.renderedOffer`** — an input, never re-derived — and
  the enforced claim is *"every refusal sentence is true of the screen the tap
  came from"*. It is **not** "no player is ever given two explanations", which
  was false and is deleted: two devices can each get a sentence true of
  themselves, and what is invariant is the DECISION, not the wording.

  Without the snapshot, a purchase during an absence retroactively rescued a run
  `openDay` had already called broken, and *which way it went depended on
  whether anything had called `settleBrokenStreak` first* — 11 versus 1 on the
  same calendar, the same money and the same day. A client settling on launch
  would have punished the player who opened the app. Nothing caught it because
  every fixture hardcoded the safe intra-day order, and the purity test aimed at
  exactly that hazard varied only *which days* the app was opened, never the
  *order within a day*.

  Three rules keep the property, and all three read as harsh if you meet them
  alone:

  - **`StreakState.signupDay` (account creation) anchors an absence** until the
    first trained day replaces it. Idle days before a lifter's first session are
    charged like any others. Required and non-nullable: an absent signup day is
    an unanchored, uncharged, free window, which is the defect.
  - **A doomed absence still consumes everything left in the window.** This is
    the rule whose wealth-dependence caused the residue, and **dropping it is
    worse than the stock it replaces** — 1051 violating pairs at 60 days, 673 at
    100, against 0. The doomed branch has no subadditive arithmetic available,
    so its consumption must be *idempotent under splitting*, and "take
    everything left" is the only thing that is. What the entitlement changed is
    the blast radius: bounded by one window, restored at the next boundary.
  - **No grant of covered days may be keyed to anything the lifter does — and
    that covers INDIRECT paths, not only direct grants.** Currency earned via
    training frequency and later spent on protection is keyed to the lifter's
    training just as much as a grant handed straight to them. The rule as first
    enforced caught only direct grants, and a laundered path walked past it: an
    achievement pays Chalk, Chalk buys a covered day, and the covered day's
    arrival is back under the player's training schedule with a currency in
    between. A season-pass tier that unlocks by playing is the same shape one
    hop further out — a tier every N sessions is an achievement every N
    sessions.

    **The restriction is scoped to the mechanism, not to the currency.**
    Achievement-earned and pass-tier-earned Chalk stay fully valid for
    cosmetics, timer skips and everything else. What they may not do is fund
    the GDD §8.3E Extra Covered Day, which accepts only currency from a
    non-training-gated source — calendar-earned Chalk, direct real-money
    purchase, or equivalent. Training-funded currency must be **structurally
    unable** to reach that purchase, not merely observed not to at the horizons
    someone happened to sweep.

    **"Structurally unable" has two readings and the rule means both.** One is
    *the purchase cannot be constructed* — a training-gated tender is a type
    error, which is where `currencyProvenance.ts` puts it. The other is *the
    purchase day cannot move with training*, and no type gives you that: a
    perfectly legal tender could acquire a training sensitivity without a single
    type changing. The distinction is not theoretical. A builder wrote a check
    it believed covered the second, and mutation-testing its own check found a
    legal tender given one extra unit on the lifter's 60th session **moved 2362
    of 34338 purchase-day lists at 100 days, produced zero violations, and left
    every aggregate in the comparison identical** — sweep green, verdict green,
    claim false. The second reading needs an assertion on the purchase-day list
    itself: for every legal tender, at every length, adding a trained day leaves
    the list byte-identical.

    Measured on the shipped engine, matched purse and price, with only the
    diligent lifter's buying schedule recomputed from their own training: a
    covered day funded by achievement-earned Chalk gives **105 / 305 / 733 /
    785** violating pairs at 40 / 60 / 80 / 100 days, worst deficit 54, against
    **0** for the same purse funded on the calendar. The zero-purchase baseline
    is also 0, so these are not violations made worse by a purchase — they are
    violations *created* by one. `purchasedDaysLeft` is live;
    `applySettledCoveredDayPurchase` is its only writer.
    Measured: a covered day granted at a streak length gives 54 violating pairs
    at 100 days; granted every N sessions, 1156; granted on a fixed calendar
    day, 0. This binds every future earning table, season pass and reward —
    GDD §8.3C's pass tiers were the worst offender in the document until they
    were re-keyed to the week. Milestones therefore mark, and pay nothing.

  Every consumption is **reported, never silent**, enforced rather than
  promised: the read model announces what the next session will cost before it
  costs it, the session reports what it took, and the suite drives every 12-day
  calendar at every window state asserting that coverage never moves further
  than what was reported. The announcement side is an exhaustive switch over the
  read model's cases, so a new screen state cannot ship with a silent debit
  behind it. Note the reading that balances is *what the day has available in
  its window regardless of arming* — not the live snapshot (stale at a boundary) and
  not the armed count (zero for a player who declined protection, which made
  every one of their sessions read as a silent credit).

  **The verification is pinned to the shipped engine.**
  `streakEntitlement.test.ts`'s battery grades a reference composition of grace
  and entitlement; it and `src/game/streak.ts` are asserted byte-identical on
  the battery's own calendars, at the shipped tuning. Without that pin the
  battery transfers to nothing.

  `src/game/streakSweep.ts` holds the parameters of the sampled test: the seeds,
  the calendar lengths and the attendance distribution, as named constants and a
  deterministic generator, with `ENTITLEMENT_VERIFICATION` holding the battery's
  own parameters. That file exists because the first version of this measurement
  was reported with its seeds unstated and could not afterwards be reproduced by
  anyone — six plausible parameterisations gave six different numbers. A
  measurement whose inputs are not written down is an anecdote. If you take a
  new one, put its parameters there and re-derive the counts in GDD §4.4 rather
  than sampling at a call site.

  **Kept as history, because a retracted diagnosis is worth more than a deleted
  one:** an earlier version of this section blamed milestone-income *timing*.
  That was measured false — income paid on fixed calendar days, arriving
  identically for both lifters, still gave 81 violating pairs at 60 days, and a
  stock that could never run out gave 194, *more* than the shipped 122. The
  counterfactual behind the claim only ever showed income was *involved*,
  because milestone income was the only income the sweep had. Those
  counterfactuals can no longer be run against this engine — all three are
  variations on a stock — and their results stand as pinned history.

- **No real identity, until a human unlocks one.** No real, named athlete,
  brand, or company identity — name, logo, likeness, or wordmark — may be
  hardcoded into any asset, string, config, or code path. The licensing system
  stays populated with **fictional placeholders only** until a human explicitly
  unlocks a specific real partner by name, once an actual licensing agreement
  exists. This is a legal exposure, not a style preference: shipping an
  unlicensed real mark is a different category of mistake from shipping an ugly
  one, and it cannot be walked back by a patch.
- **A sponsor does not buy a stat.** This is the pay-to-win rule applied to
  licensing, and it does not bend for a paying partner. Any branded or sponsored
  consumable is **cosmetic and flavor-only, mechanically identical to the
  existing fictional item it reskins**. A sponsor paying for placement buys
  visibility, never a stat effect. If a partner asks for one, that is a refusal,
  not a negotiation.

## Code Conventions

- TypeScript strict mode, no `any`
- Prefer pure functions and explicit return types in game-math modules
- Reanimated 4 for animation; Skia for bar-path and rep rendering
- Keep components small; extract logic aggressively
- Colocate tests as `*.test.ts` next to the module

## Working Style

- Prefer editing existing files over creating new ones.
- Do not create documentation files unless asked.
- Commit early, commit often, small scopes.
- Use git worktrees for parallel builders so concurrent work does not collide.
- For human-paced follow-up sessions after the run: one vertical slice at a time,
  working state at the end of each.

## What You Cannot Do

You can produce a working, playable prototype. You cannot judge whether the lift
*feels good* — that requires human playtesting. When a task depends on game feel,
build the tunable version and say so rather than asserting the values are right.

A critic grading art or feel must not claim a bar is met on reasoning alone. If
it cannot actually retrieve and view its reference, it reports the bar as
unverifiable rather than passing the work.
