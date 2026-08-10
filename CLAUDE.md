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

## Session Coordination — TWO SESSIONS ARE RUNNING ON THIS REPO

**Read this before claiming any piece. There is more than one Claude Code
session working in this repository, and neither can see the other's
conversation.** Coordination lives here, in the tree, because that is the only
channel both sessions actually share. If you are a session that has just started
and has no history, this section tells you which half of the repo is yours.

### The split

| | Session A — the main loop | Session B — the parallel scope |
|---|---|---|
| Owns | everything not listed to the right | **GDD §5 — Gym Empire, the idle layer** |
| Branch | `claude/agent-config-setup-m2r6ny` | its own `claude/*` branch, in its own worktree |
| Files | `src/game`, `src/meet`, `src/cutin`, `src/session`, `src/shell`, `src/lift`, `src/art`, `src/card`, `src/licensing`, `src/audio`, `tools/` | `src/empire/**` (new), plus the three registry rows named below |

**Neither session pushes to `main`, ever.** Both push only to their own
`claude/*` branch. Merging into `main` is a human's call, not a session's.

### Session B's scope, stated exactly

**GDD §5 in full — §5.1 Loop, §5.2 Production, §5.3 NPC Lifters, §5.4 Expansion
Axes, §5.5 Social Layer — built pure-logic-first into a new `src/empire/`
directory**, the way M1–M6 were built before V1 wired them: production curves,
the offline-earnings cap, NPC output by tier and tenure, deterministic
recruitment cost, expansion cost tables, reputation. Zero React imports, zero
side effects, unit tests per exported function (the "Pure logic is separate from
UI" rule below applies unchanged).

**Explicitly OUT of Session B's scope, because these are the collision:**

- **`src/game/progression.ts`.** The Gym Empire loop eventually has to write a
  wallet, and that write is a progression intent. Do not add one. That file is
  the single hottest file in the repository — 38 of the last 60 commits — and
  Session A has open work inside it right now. Build the empire math against a
  local type and leave the wiring to a later, serialised piece.
- **`src/game/fatigue.ts`.** §5.4's physio hook is already stubbed there
  (`physioDaysSaved`) and is a Session A file. Read the constant; do not edit it.
- **A screen or route.** `src/shell/shellRoute.ts` and `AppShell.tsx` are Session
  A's, and A has a shell grading pass queued. A render-only view under
  `src/empire/` is fine; wiring it into the shell is not.

### Why §5 is the disjoint piece, and not merely the unstarted one

"Unstarted" is cheap — most of the GDD is unstarted. What makes §5 safe to run in
parallel is that its **seams into Session A's territory were cut and frozen
before this split existed**, so Session B reads contracts instead of editing
them:

- `WALLET_CURRENCIES = ['gymBucks', 'chalk']` is already sealed in
  `progression.ts`, and `CONVENIENCE_GRANTS` already carries
  `'gym-empire-timer-skip'`. The currency Session B generates already has a name
  and a home on Session A's side.
- `FATIGUE_TUNING`'s physio floor and `physioDaysSaved` already exist as inputs.
- `src/art/gymScene.ts` is **scenery, not the idle layer** — its own header says
  "No currency, no ad path, no game math, no player state." The name collides;
  the subsystem does not.
- Every other candidate fails on a real import edge, not a hunch: Arcade (§2.3)
  needs `src/lift/` and `fatigue.ts`, and GDD §2.3 leaves its own contribution an
  open question needing a human ruling. `src/card/` and `src/licensing/` are both
  imported by `src/cutin/`, which has a grading pass queued. `src/audio/` is
  under an in-flight builder.

### The one place the two sessions genuinely touch

**`src/tuning/`.** `audit.ts`'s `SOURCE_RULES` is a closed allowlist and
`audit.test.ts` pins it exactly — *"widening it is an edit to this test"* — so a
new `src/empire/empireTuning.ts` **cannot** pass the magic-number audit without
appending a row to all three of:

1. `src/tuning/audit.ts` — the `SOURCE_RULES` entry
2. `src/tuning/audit.test.ts` — the pinned allowlist
3. `src/tuning/index.ts` — the re-export, if the block is classified `feel`

One row each, and source order is free on both sides — `SOURCE_RULES` is grouped
by classification and the test's pinned literal is `.sort()`ed before comparison
— so put each row beside the comment that explains it, not at the bottom. That is
the whole shared surface, and it is named here so a conflict is expected rather
than surprising. Session A does not edit those three files while Session B is
running unless it says so here first.

Two other tree-wide registries scan `CLAUDE.md` and `docs/GDD.md` themselves and
will see anything either session writes there: `REVIEWABLE_CITATIONS` in
`src/licensing/realIp.ts` pins **exact occurrence counts** of every real name
appearing in prose, and `tools/evidence.mjs` lists them among the files whose
change makes a bundle stale. Editing prose in those two documents is therefore a
code change with a test behind it — `src/tuning/audit.test.ts` and
`src/licensing/realIp.test.ts` (104 tests) are the pair to run after touching
either.

### If scope shifts

Session A treats `src/empire/**` as off-limits from now on and will not open a
piece there. If either session needs to cross the line, the crossing is written
into this section **before** the work starts — not into a commit message, not
into a conversation the other session cannot read.

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

This is not a style preference. It has now failed **eight times** in this
codebase; the fifth was found inside the comment that had just been rewritten to
fix the fourth, the sixth one file away from where the fifth was fixed, and the
seventh in a fix's own verification oracle and the eighth naming a test file that
does not exist:

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

## An Assertion Is Vacuous If It Cannot Fail

**A separate rule from the one above, and it needs a separate scan.** That rule
is about prose with no test behind it. This one is about a test that exists,
runs, passes, and could not have done anything else. The two look identical in a
green suite and nothing catches both.

**The definition to check against: an assertion is vacuous if no state of the
code it is meant to be checking would make it red.** Not "it passes today" —
*there is no version of the subject that fails it.*

Shapes this has actually taken here:

- **Self-referential.** `MODULE_SOURCE.includes(THE_CONSTANT)` where the module
  declares that constant from a literal — the file necessarily contains its own
  value. Caught only because renaming the id reddened a *different* direction
  and left this one green.
- **An empty domain.** A sweep whose generator never produces the failing case;
  a list-walking check that passes trivially when the list is empty; a purchase
  arm at a price that buys nothing inside the calendar length.
- **A bound the unfixed behaviour already satisfied**, or an equality that is
  one-sided by construction and cannot fail upward.
- **An oracle that mirrors its subject** — an expectation restating the
  implementation character for character, which cannot disagree with the code it
  grades.
- **A domain that cannot reach the case.** The after-offer routing was inverted
  under ~590,000 green decisions because the case is unreachable at lag 0.
- **An input that is silently absent.** A parser that reads a real value as
  missing, or a comparison against a seed the session has not yet beaten, so
  both sides are the same number.
- **A negative assertion whose two subjects are mutually exclusive by
  construction.** `!visible('meet-recap')` on the second-meet placeholder screen:
  `MeetScreen` reaches the placeholder only down the `recap === null` arm of a
  ternary, and `RecapView` requires a `MeetRecap`, so **no version of the subject
  draws both**. It reads as the strongest check in its section — a discriminator
  separating two screens — and it survived deleting the placeholder outright
  *and* forcing both to render. The tell is that the two things being held apart
  cannot co-occur regardless of what the code does; move the claim to a screen
  where they compete.
- **A textual pin whose pattern has more than one witness in the file.** The
  cut-in cap was held by three regexes over `CutInHost.tsx`'s source, one of
  them **byte-exact including the argument object**. All three survive the
  mutation that breaks the cap, because the same call appears a second time
  twenty lines below at a site the mutation does not touch. A byte-exact regex
  *feels* stronger than a loose one and is not, when the byte-exact text is
  duplicated. The tell is that the pattern's **match count** is never asserted —
  pinning counts rather than presence is the fix this file already demands of
  sweeps, and it applies to source scans identically.
- **An empty domain reproduced across every harness.** The sharpest one so far:
  a client mapping was missing a `DayOpening` kind, and the fixture that would
  have caught it set `lastTrainedDay` to yesterday — in the unit tests, in
  `sessionPreview.ts`'s hardcoded preview context, *and* in the browser
  fixtures. Three independent harnesses, blind for one reason, so adding another
  layer of checking would have added no coverage at all. When a defect survives,
  ask whether the harnesses are independent or merely numerous.

**The witness bar does not cover this.** A `MUTATION_WITNESSES` entry proves
*one* assertion in a test bites; it says nothing about the others in the same
test. So when you write a check, ask the question directly: *what edit to the
subject turns this red?* If you cannot name one, the check is decoration however
sincere its message. And give every sweep a non-vacuity guard that pins what it
actually saw — counts, not bounds — so an empty domain reports itself instead of
passing.

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

### One connection per app run, reached by every mode

**A screen that holds its own `ServerRecord` is the defect, however correct that
row is.** "Client is a renderer" did not stop this, because the client was not
rendering the wrong number — it was rendering the right number *about the wrong
lifter*. `useMeetDay` built its own record on mount while `AppShell` handed
`MeetScreen` no port, so for six waves every meet suggested openers off the
signup seed, every recap said FIRST TOTAL, and GDD §6.3's attempt tension — what
the document calls "The Real Tension" — was dead code in the shipped app.

Three things follow, each of which had already failed once:

- **A guard written for one hook — or one FIXTURE, or one ARM OF ONE `if` — must
  be applied to its sibling, mechanically.**
  `sessionWiring.test.ts` banned the six names "the bypass was made of" from
  `useSession.ts`, and `useMeetDay.ts` contained five of them, one directory
  over, for six waves. A twin guard must *read* the sibling's list, not copy it.

  **The distance keeps shrinking, and that is the finding.** Instance two was a
  directory away. Instance three was `progression.test.ts`'s seal check, which
  matched its callee by identifier *text* while the `receive` check **twelve
  lines below in the same `visit` function** resolved symbols through the
  checker and followed aliases — so a local shim spelled `sealServerValue`
  type-checked clean and left 202 guard tests green. Instance four was
  `verify-cutin-cap.mjs`'s "is it drawn" check, where the bombed arm waited out
  the app's own stagger and probed the last row, and the recap arm — **the
  `else if` directly beneath it** — waited on presence and probed the
  container, whose opacity nothing animates. It could not have reddened, and
  the frame filed beside its green line was a recap at t≈50ms of a 1240ms
  assembly.

  So: proximity is not protection, it is the *risk*. Two arms of one
  conditional read as one decision and get written as two, and the second one
  is written while the first is still fresh enough to feel already-solved. When
  you fix a check, the next thing to look at is the branch immediately below
  it.
- **`vitest.config.ts` is `environment: node`, so no cross-screen state is
  checked by the suite.** Three defects have now lived entirely in that gap. Any
  claim that a value survives a navigation needs a browser check that reads the
  quantity on both sides — the 94 existing checks crossed that exact press and
  compared opacity, hit-testing and geometry, but never a number.
- **A check that bites but fails uselessly is half a check.** An identity
  assertion here reddened with `expected { …(5) } to be { …(5) }`. The witness
  bar means reading the failure message, not just watching it go red.

### A screen a player reaches needs a check that reaches it the way a player does

**The sibling of the rule above, and it was earned the same way.** That one says
a claim about a value surviving a navigation needs a browser check reading both
sides. This one says a claim about a *screen* needs a browser check that arrives
there through the app's own controls.

`frozenMeetFor` branches on `source === 'debug'`, so the debug arm and the played
arm are literally different code. Every recap the harness had ever photographed
came down the debug arm, via `?meet=recap`. 103 checks were green and no exit had
ever been pressed on a meet a player opened. The second-meet placeholder was
worse: shipped, pinned by a node test, copy-corrected by a human ruling, and
never once drawn to a screen in the graded artifact until wave 39.

So when a check opens a screen by URL, that is a different subject from the one
the player sees, and the difference belongs in the tool's own header rather than
in whoever reads it next. If the played arm cannot be driven, the honest output
is a **named SKIPPED check**, not a quiet fallback to the debug URL that leaves
the section looking complete. Assert the address bar carries no query string at
the moment the screen is read, so the fallback cannot happen silently.

The measurement worth keeping: driving both whole meets headless was expected to
be the hard part and was not — 9/9 attempts on each across ~11 runs. A miss does
not end a meet, only three on one lift do, so meet day tolerates a robot far
better than a session does. The reachability was assumed impossible without
anyone having tried it.

### Presence is not visibility, and a harness that polls for a testID measures the wrong one

A committed screenshot came out a **flat dark rectangle** — 7KB of nothing —
filed beside a record saying that leg had reached GDD §6.3's bomb-out screen and
offered its beat. The record was detailed and internally consistent: three squat
misses, their feedback lines, thirty-six seconds. None of that is worth anything
against a blank frame, and it was found by **opening the file**, which is the
only way this class is ever found.

Then it was misdiagnosed twice, and both wrong answers are worth keeping because
each looked sufficient:

1. *"The shutter fires before the view mounts."* It does not — the exit control
   is in the DOM 2ms after the drive returns. That "fix" shipped a
   **byte-identical blank PNG with a green check claiming the photograph was of
   something.** An assertion that cannot fail is bad; one that asserts a
   falsehood is worse, and it is worse *because* it reads as coverage.
2. *"The screen renders nothing on a repeat leg."* Also wrong — and that one
   would have been a real app defect, so it was the more tempting answer.

**The app was correct and the instrument was naive.** `BombOutView` opens with
`BOMB_OUT_SILENCE_MS` of a deliberately almost-empty screen — its own header
says so and §6.3 asks for it — then fades four rows in staggered, the exit last.
The element was present, transparent, and the photograph was of a real screen at
a real moment: the silence.

So: **wait on the thing being drawn, not on the thing being mounted.** Read
effective opacity up the whole parent chain, and compute the wait from the app's
own stagger arithmetic *read from source* rather than transcribed, so a
playtester who lengthens a beat gets a tool that still waits rather than one
that quietly starts photographing the silence again.

### `MUTATION_WITNESSES` cannot hold a browser check, and that is a hole in the rule above

**Stated as an open gap rather than quietly tolerated.** The witness schema
resolves `testFile`/`redAssertion` against a vitest `it(` body and binds a
`@guarantee` tag in `src/`. Checks that live in `tools/verify-shell-route.mjs`
have no `it(` to bind to, so **none of them can be recorded** — including the
eleven mutants that produced wave 39's findings.

That makes the "record the witness at declaration time" bar unsatisfiable for
exactly the class of check this file elsewhere calls the one the run most needs:
the browser class, where three defects have now lived entirely. Until the schema
grows a `toolFile`/`redCheck` variant, a browser witness is recorded in the merge
commit that introduces it — the verbatim mutant and the verbatim check text that
reddened, same two fields, just not machine-resolvable. Do not bend the schema to
accept an unresolvable entry; a witness that cannot expire when its subject is
edited away is worse than an honest gap.

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

- **EVERY WAVE STARTS WITH `node tools/wave-start.mjs`, BEFORE ANY AGENT IS
  DISPATCHED.** Not a suggestion and not a tool to reach for when something
  looks wrong — the first command of the wave, every time.

  It asks three questions, each of which has already cost this run a round when
  it was noticed late: is `HEAD` behind or diverged from **the remote** (asked
  with `ls-remote`, because a rewind can take the tracking ref with it); is any
  unmerged `claude/*` branch stale; does the committed browser evidence still
  describe this tree.

  **The reason it is automatic rather than invoked on suspicion is the whole
  point.** The near-miss that produced it was caught because work looked stuck
  for long enough that a human noticed and asked. That is not a mechanism — it
  is a person watching a clock, and it only fires when the delay is long enough
  to be obvious. Six rewinds and five killed agents have each announced
  themselves the same way: not at all. A check that runs on schedule catches the
  next one on the next wave; a check that runs on suspicion catches it whenever
  someone happens to look.

  A non-zero exit means "look at this", not "the wave cannot start". Two of the
  three questions have legitimate non-zero answers — an in-flight agent is
  unmerged and young, evidence is stale immediately after a code change — so the
  output names which one and the reader decides.

  It is a start-of-wave snapshot, not a monitor: it cannot see a rewind that
  lands mid-wave. **Before any push that carries work worth keeping, probe the
  path with an empty commit first** and verify it round-trips with `ls-remote`.
  That habit caught the sixth rewind while holding three builder branches, at a
  cost of one throwaway commit.

- **PUSH BEFORE YOU CLEAN UP, BECAUSE CLEANUP IS WHAT MAKES A REWIND
  UNRECOVERABLE.** Rewinds are survivable because origin is ahead. Tidying is
  survivable because the tree is in git. Doing them in the wrong order is
  neither, and it is the one combination that loses work permanently.

  The near-miss: a worktree sweep found four holding uncommitted source edits
  from agents killed mid-flight — in no commit, on no branch, on no remote. They
  were committed to their own branches and pushed, and only then were the
  worktrees removed. **The next rewind landed minutes later**, took the whole
  checkout back, and those four branches on origin were the only surviving copy.
  Remove-then-push would have destroyed them with nothing to recover from.

  So: anything you are about to delete, move, or prune goes to origin first,
  even when it is somebody else's half-finished work and especially when you
  think it is litter. The verification that it is litter is itself a thing that
  can be wrong.

- **THE RATE IS NOT STABLE — THREE REWINDS LANDED IN ONE SESSION, ROUGHLY
  HOURLY.** Nine total. Plan for the next one inside the hour rather than at
  some point: keep uncommitted work to minutes, and do not let a long unpushed
  stretch accumulate because the last few hours happened to be quiet.

  **The task list reverts with everything else.** It came back showing
  pre-wave state with finished items pending again, so it is a working aid and
  never a record of what happened. The durable record is commits on origin.

- **A SUBAGENT'S REPORT OF THE TREE IS REWIND TELEMETRY, NOT ONLY A GRADING.**
  This is how the seventh rewind was caught, and it is the only new thing about
  it. `wave-start.mjs` had run clean ninety minutes earlier; the limit it hit is
  the one its own header already declares, so the check was not at fault. Local
  git was internally consistent at the old commit — log, reflog and status all
  agreed — which is what makes this class silent every single time.

  Two things disagreed with it. A push was rejected as non-fast-forward when
  there was every reason to be a descendant. And **a critic reported facts about
  the tree that contradicted mine** — it read `.git/refs/heads` directly, named
  an older commit, and reported that files merged an hour earlier did not exist.
  I was one step from reading that report as a grading of current code.

  So when an agent describes source that does not match what you believe is
  there, **the first hypothesis is that one of you is on a different tree**, not
  that it misread. Settle it with `git cat-file -t <sha>` on a commit you believe
  in: after a rewind your own recent SHA is *not a valid object name*, which is
  unambiguous in a way `git log` is not, because `git log` will happily show you
  a coherent older history.

  It cuts the other way too, and worse: **an in-flight builder in a worktree is
  pinned to whatever base it started on.** Its `git log` looks fine, it will read
  reverted code as current, and it will build a fix against a defect that is
  already fixed. After any recovery, tell every live agent the real base
  explicitly and have it rebase — an agent cannot detect this about itself.

  Recovery is `git fetch origin <branch>` then `git reset --hard <origin sha>`.
  Check whether the rewound commit is an *ancestor* of origin's tip before
  assuming loss: three of these have been truncations rather than divergences,
  and nothing was lost in any of them because origin was ahead.

- **`tools/evidence.mjs` is what wave-start's question [3] is asking, and it is
  how a critic sees a test result at all.** A critic's tool allowlist is
  read-only with no Bash, so it cannot run the suite — it reads a bundle this
  script produced by running the real commands and capturing their raw output
  verbatim, unsummarised, so a failing run looks failing.

  - `node tools/evidence.mjs <piece-id> [testPathPattern]` writes
    `.gauntlet/evidence/<piece-id>.txt`. Regenerate the piece's bundle *and*
    `suite` before dispatching a critic at it.
  - `node tools/evidence.mjs suite --verify` checks the committed bundles and the
    tracked browser records in `.gauntlet/shots/**/*.json` against the current
    tree, and reports which are stale and against which commit. This is the mode
    wave-start runs.
  - Every bundle stamps the `HEAD` it came from **and whether the tree was
    dirty**, because a bundle produced from an uncommitted tree describes code
    that is in no commit. A stale bundle has reached a critic once already; it
    was caught by luck.
  - A new tracked browser record must be added to `REQUIRED_SHOT_RECORDS` in
    that file, or it is checked by nothing. Do not commit a browser record while
    its check is red — a red record tracked as evidence is worse than an absent
    one.

- Prefer editing existing files over creating new ones.
- Do not create documentation files unless asked.
- Commit early, commit often, small scopes.
- **Push after every commit. A local commit is not a durable artifact here.**
  The checkout has silently rewound four times, and the fourth took the
  **reflog** with it: `HEAD` came back at a commit from an earlier day, the
  working tree was at wave 6 with three shipped modules simply absent, every
  branch the session had created was gone from `git branch`, and the lost
  commit's SHA was *not a valid object name* — so there was nothing local to
  recover from. The `/tmp` scratchpad rolled back on the same boundary. Origin
  was the only surviving copy. Twice now a rewind has been survivable only
  because origin happened to be ahead, and both times that was luck rather than
  design. Batching a wave's commits and pushing at the end is the habit that
  makes the next rewind expensive.

  Push with `git push -u origin <branch>`. On a network failure retry up to four
  times, backing off 2s / 4s / 8s / 16s. Never push to a branch other than the
  one this session was given, and never to `main`.
- **VERIFICATION BEFORE A PUSH IS ITS OWN COMMAND WITH ITS OWN EXIT CODE. Do not
  chain it onto the push.** A branch went to origin with two failing tests
  because the push was written as `<grep> && git push` — the grep found what it
  was looking for, so the `&&` fired, and the grep's success was never evidence
  about the suite. `&&` chains the *shell's* notion of success, which is only the
  same as yours when the left-hand command is literally the check you mean. Run
  the suite, read its exit code and its summary line, then push as a separate
  command. The two-step costs one extra round-trip and is the difference between
  a green branch and a red one on origin.
- Use git worktrees for parallel builders so concurrent work does not collide.
  Note what the fourth rewind showed about them: worktrees are **not** specially
  fragile, and they are not specially safe either — the whole machine reverted
  together, so in-flight agents died with it. Merge and push each builder's
  result as it lands instead of accumulating several and merging at the end.
- **A DEAD AGENT AND A WORKING ONE LOOK THE SAME, AND THE TASK LIST LIES IN THE
  REASSURING DIRECTION.** Five agents have now been killed mid-flight by a
  container going away. Each left its task list frozen at whatever step it had
  reached — *"Run mutants M1-M3"*, *"Wait for the mutation batch to finish"* —
  in-progress forever, because nothing survived to mark it done. Read from
  outside, that is indistinguishable from slow work, and the natural diagnosis
  is a hang: on the fifth occurrence it was reported as *"an infinite loop or
  deadlock in the test harness"* when **no process was running at all** and the
  container was sixteen minutes old.

  So do not reason about whether an agent is stuck. Measure it:
  `node tools/watchdog.mjs --branches` lists every unmerged `claude/*` branch by
  the age of its last commit and exits 1 on anything stale. **Commit age is the
  one signal that outlives the agent, the container and the notification.** Run
  it before concluding anything about a quiet agent, and run it before deciding
  a wave is finished — a finished-but-unmerged branch and a dead one look
  identical too, and both show up here.

  `node tools/watchdog.mjs --budget <seconds> -- <command>` is the other half: a
  hard wall-clock cap that SIGKILLs the whole process group. `vitest` has a
  per-test timeout and no global run cap. That guard is worth having, and it is
  worth being clear that it would **not** have caught any of the five — there
  was no process to time out. Guard both; do not let the loud one make you think
  the quiet one is covered.
- For human-paced follow-up sessions after the run: one vertical slice at a time,
  working state at the end of each.

## What You Cannot Do

You can produce a working, playable prototype. You cannot judge whether the lift
*feels good* — that requires human playtesting. When a task depends on game feel,
build the tunable version and say so rather than asserting the values are right.

A critic grading art or feel must not claim a bar is met on reasoning alone. If
it cannot actually retrieve and view its reference, it reports the bar as
unverifiable rather than passing the work.
