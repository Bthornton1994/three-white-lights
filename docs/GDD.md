# Powerlifting Game — Game Design Document

**Status:** Pre-prototype
**Stack:** React Native + Expo, TypeScript, Reanimated 4, Skia, Supabase
**Last updated:** 2026-09-05 (CAREER-EMPIRE-REP-01 IN PROGRESS — sporting
ledger on `GymViewState` composed with G.2E at points. Prior
`EmpireState.reputation` phrase names this composed v2 reading. G2-ATHLETE-SEASON-01 FROZEN at
`9720ea48f34e1f2670088f1c129026d54668776e` (factory freeze; human feel
gate not run — not CLOSED). G.2E FROZEN at
`cf98f4dedbb572850667bd191692779a195caa50` (factory freeze; human feel
gate not run — not CLOSED). G.2D CLOSED / FROZEN at
`28611af74dd6479bfad58763ebba72db5942307c`.
Earlier: 2026-09-05 (G.2E IN PROGRESS — member-side living-member
reputation ledger and reputation-gated high-paying vacancy arrival.
G.2D CLOSED / FROZEN at `28611af74dd6479bfad58763ebba72db5942307c`.
Earlier: 2026-09-05 (G.2D P1 — a played leave stamped on the
settle-window start still occupies the open GymHost tick, so production
`gymViewReduce` occupancy is not `[mark, mark)`. Unsettled-window dues
are time-weighted presence, not the active roster at the settle mark.
Earlier: 2026-09-05 (G.2D P1 — unsettled-window dues occupancy is
time-weighted presence, not the active roster at the settle mark. A G.2C2
leave inside the window still pays the gym-clock stub it was active;
a member who already left before the window does not pay. Joins already
pro-rated from `joinedAtSeconds`. Earlier: 2026-08-05 (§7.2 — the cut-in's "no Tier 2 at all" cost is
**two costs, not one**. It was stated as an identification cost only; the surface
also loses `tier2.shortName`, which is the panel's remedy for a name too wide for
it, and the cut-in's substitute — wrap, then overflow, then widen the grid —
spends the interrupt's on-screen upscale instead. Nothing about the ruling
changes; the trade is now written down in full. Alongside it, in code only: the
prose in four files still told its reader the cut-in mounts the shop panel two
rounds after §7.2 ruled that it does not, and `cutInWiring.test.ts` now reads
COMMENTS as well as code and fails on that claim, with the historical note that
explains the change deliberately left green. The set of files that may claim a
sitting is derived from the TYPE CHECKER rather than from the JSX spelling
`<CutInHost`, which an aliased import walked straight past into §12.3's refusal
condition. Earlier: 2026-08-04 — §12.2 — **"test file" is now a DERIVED set, not a
regular expression's opinion.** Both route guards skipped test files, and the
skip was justified by an argument — "a fixture reaches no player, persists
nothing, and is read by the same reviewer as the assertion beside it". That
argument is true of the files vitest runs and the exemption is *necessary* for
them (banning `as unknown as` in the files that prove the ban is circular). It
was not true of the set the filter named. `progression.test.ts` said
`/\.test\.tsx?$/`; `vitest.config.ts` includes only `.test.ts` under `src/`;
nothing asserted the two were the same set and **they were not**. Every
`*.test.tsx` anywhere, and every `*.test.ts` outside `src/`, was compiled by the
project, dropped from the reflective sweep, discarded from the §7.5 route table
as a "fixture", dropped by `src/tuning/audit.ts`'s magic-number auditor on the
identical regex — and **run by nothing**, so there was no assertion beside it and
no reviewer. It would also *bundle*: no `metro.config.js` exists, so Expo's
default `sourceExts` resolves `./seed` to `seed.test.tsx`. Proved by execution:
`src/card/seed.test.tsx` holding a fully annotated `const seeded: ServerRecord =
{ ...newServerRecord(), totalKg: 900 }` type-checked clean and left the suite
green at the counts it had without the file — 57 files, 2437 tests. **The fix is
not a narrower regex** (`/\.test\.ts$/` would leave such a file swept, still
unexecuted and still importable); it is **two assertions**: the set the sweep
drops is asserted equal, both ways, to the set vitest runs — asked of vitest via
its own config loader and `globTestSpecifications()`, not restated from its
globs — and no file the sweep covers may resolve an import to one it drops, with
the edges coming from the type checker rather than a hand-written list of import
constructs. Same move the root set already made when it collapsed "compiles into
this app" and "this scan sees it" into `tsconfig.json`'s file list. Also this
round: the reflective sweep's exemption table pins the **matched line** as well
as the count, so a swap inside one file can no longer hold the count still; and
`as any as` joins the three text patterns — the one escape worth taking, being
the same shape as the `as unknown as` row already running, with the other five
deliberately left as a stated bound. §7.5 gains a residual naming the three
filters whose justification is still an argument rather than an enumeration:
`node_modules`, declaration files, and the two target type names themselves.
Earlier the same day: §12.2 — the CRUDER of the two route guards is no
longer scoped either, and the residual it covers is stated as a bound rather
than as closure. The literal sweep cannot see a record assembled without an
object literal, which is what a three-pattern text check exists for; that check
ran over a computed candidate set whose implementation walked top-level
`ImportDeclaration` / `ExportDeclaration` nodes and therefore missed
`await import()` and bare `export * from` — this repository's own idioms, six
and fourteen occurrences respectively. On a file using either, **the two checks
composed to zero**: nothing for the checker to type and nothing to grep. Proved
by execution on `cardEntry.tsx`'s own dynamic-import template — a Total off the
query string reaching the cache as confirmed truth, `tsc` clean, all 2437 tests
green. The scoping is DELETED rather than taught more constructs: the guard's
purpose is preventing under-scoping, and every round of this piece has been a
scope error one construct further out. It now runs over every non-test file the
project compiles, with the one live occurrence in the tree excused by file,
idiom and count in a table pinned both ways. "Closed by a second, cruder test"
is gone with it — three string patterns cannot close an unbounded class, and
§7.5 residual 1 now names what walks past them. Also: the frame enumeration
covers accessors, constructors and class static blocks, applying the principle
that added `PropertyDeclaration`; and the disk cross-check matches `.mts` /
`.cts`, the one extension that would have fallen out of both the project list
and the walk. Earlier the same day: §12.2 — the derived route table has the
WHOLE PROJECT as its root set, not `src/`. The sweep it replaced was rooted at a
hand-walked `src/`, and this repository's TypeScript is not all under `src/`:
`App.tsx` and `index.ts` sit at the root and imports point into `src/` and never
out, so a fully annotated `const seeded: ServerRecord = { ...newServerRecord(),
totalKg: 900 }` appended to `App.tsx` type-checked clean, passed the whole suite,
and added no row. The correct file list was being computed two lines above the
wrong one and discarded — `tsconfig.json`'s own `parsed.fileNames` — and the scan
is now rooted in it, with `App.tsx` and `index.ts` anchored BY NAME so a future
narrowing goes red. Neither entry point holds a route today; widening the sweep
added no row, so the table was right and the check was not. §7.5's residual list
no longer claims closure and the one row that covered two `useMeetDay` sites is
now two. Earlier: §11/§12.2 — the ROUTE
half of the unit sweep is now DERIVED rather than hand-counted. Six rounds of §7 ended with a human finding one
more construction site and five of the six were found by a grep; the sixth,
`sessionPreview.ts`'s `recordBeforeSession()`, is now named, and §7.5 is a table
`progression.test.ts` reconstructs from the TYPE CHECKER and compares both ways —
an unlisted site goes red, a stale row goes red. The seed's type moved beside its
three siblings so the `ArmsAreTellableApart` assertion it was missing could be
written. §12.2 records a proposed two-clause restatement of the unit bar,
explicitly NOT TAKEN. Magnitudes remain unproven and no plausibility band was
invented. Earlier the same day: §11 — the unit refusal now covers the ACCOUNT
SEED, which is a second route into a field the sweep had already marked proven
rather than a fifth field. `SESSION_TUNING.STARTING_E1RM_KG` went straight into
protected, monotone `bestE1rmKg` on every account, with its unit in the
identifier and a comment claiming it was "NOT PROGRESSION" and not persisted —
both false. It is now a tagged `StartingE1rmSeed` whose declared unit is checked
at COMPILE time, which is stronger than the card's runtime check because the
seed is a literal in the build rather than JSON from a client. The magnitudes
are still unproven and that is said out loud. No §11 ruling is taken: the point
is to make the pound edit safe to make, not to make it. Earlier the same day:
§11 — the write-path unit refusal now covers the
BODYWEIGHT as well as the total. The total's half shipped first and left the
sharper hole open: a caller who took its own named remedy, converted the
attempts, and ran a legal kilogram meet passed the check cleanly while
`MeetResultReport.bodyweightKg` — a bare number — was written into permanent
progression 2.2x too heavy, inside the published DOTS domain, flagged by
nothing. The report's bodyweight now carries its unit and the meet-day context
takes a kilogram entry. Still no ruling on whether pound meets ship. Earlier the
same day: §11 — the pound-meet refusal now guards the WRITE
path: `applyMeetResult` was recording a pound total into permanent progression
before either read-side refusal could fire, and `MeetResultWire` has no unit
field to recover the unit from once it is there. Also §11 — a Tier 1 colorway
has to be a bank-0 ramp
and three of four partner colorways were not, so §7.3's "the base sprite needs
no change at all" holds only for a partner whose colours bank 0 already has;
logged as a decision for a human rather than answered. Also §11 — an accessory
day's close-out honoured the "no e1RM" ruling in its numbers and not in its
words, and the sentence claiming the beat was "photographed" named an artifact
that is gitignored and therefore never in the repository. Earlier the same day:
a pound meet's total used to reach DOTS as
if it were kilograms and print 806.45 against a truth of ~365.8; the unit now
travels with the total and DOTS refuses rather than converting. Whether pound
meets ship at all is logged as an open question, not answered. Earlier the same
day: §2/§2.3/§3.2 — Total is set by meet results only
and does not move between meets; the stat Sim mode grows daily is e1RM. §6.4 was
correct as written and is unchanged; §2's currency table was the mislabel.
Previously 2026-08-01: §4.2/§4.4 — the Recovery Day prompt must disclose
how long the save lasts, so the wasted-spend residual is an option with a stated
expiry rather than one sold blind. Earlier the same day: §4.1/§4.2/§4.3/§4.4 —
free grace for short gaps; the grace is charged per absence, not per gap, so the
longest repairable absence no longer depends on how often the app is opened)

---

## 0. Read This First

This document is the single source of truth for design decisions. If code
contradicts this document, the document is right and the code is a bug — or the
document needs an explicit update commit. Do not silently diverge.

**Build order is non-negotiable.** See §9. Do not build Gym Empire before the
lift mechanic is proven fun. Do not build monetization before retention is
validated.

---

## 1. Core Concept

A powerlifting game with four interlocking modes sharing one persistent lifter.
Casual players enter through fast arcade/idle loops; real lifters find genuine
depth in training simulation and meet-day tension.

**One-line pitch:** Duolingo's daily habit loop applied to a powerlifting career,
with a competitive meet as the payoff.

### Design Pillars

1. **The lift must feel good.** Every other system is scaffolding around the
   moment of grinding a heavy rep. If that moment isn't satisfying, nothing else
   matters.
2. **Authenticity is the moat.** Real RPE, real e1RM math, real DOTS scoring,
   real meet structure. The competitive powerlifting community will notice
   details and will punish fakery.
3. **Never sell power.** Cosmetics, convenience, and time-savers only. Zero
   pay-to-win. This is a hard rule, not a preference.
4. **Daily, not weekly.** Sessions are 60–90 seconds. Real training arcs live in
   Career mode; the daily loop is a game, not a training log.

---

## 2. The Four Modes

All four feed one persistent lifter and the shared numbers below.

### Shared Progression Currencies

| Stat | What it is | How it grows |
|---|---|---|
| **e1RM** | Estimated 1RM, per lift (kg/lbs). The number training moves. | Sim mode training, session by session |
| **Total** | Competition total (kg/lbs). The vanity/status number. | **Meet results only** — the sum of best successful attempt per lift (§6.4). It does not move between meets. |
| **Training IQ** | How *well* you train. Skill/knowledge stat. | Good Sim decisions, Gym Empire passive trickle |

**Total is not a training stat, and this row used to say it was.** An earlier
version of this table read "Sim mode primarily, Arcade secondarily" for Total,
which contradicted §6.4 — a number that is `null` until the first meet and is by
construction an official competition result cannot be moved by a training
session. §6.4 is correct as written and is unchanged; the mislabel was here. The
stat that grows daily is **e1RM**, which is what Sim mode was always actually
moving. DOTS stays computed from the competition Total and from nothing else.

That is also the point rather than an inconvenience: Total only updating on meet
day is what makes meet day carry weight.

The split creates the core tension: strong-but-dumb (high e1RM, low IQ →
plateaus, more injury setbacks) vs. smart-but-weaker (slower growth, higher
long-term ceiling).

### 2.1 Career / RPG — The Spine

Create a lifter, pick a federation (raw / equipped / tested / untested), run
training blocks, enter meets. This is where players start and where the
long-arc narrative lives.

### 2.2 Sim Mode — The Daily Habit Engine

**This is the retention core.** See §3 for full spec.

### 2.3 Arcade — The Hook

Timing-based lift mini-games. Fast, dopamine-driven, accessible to non-lifters.
Feeds *technique points* (spent on bar-path efficiency, which reduces injury risk
in Sim). The Arcade input mechanic is the same mechanic used in meet day —
building it well pays off twice.

**Arcade does not move Total either.** This line also read "Feeds Total" and is
corrected for the same reason as the table above: Total is set at meets (§6.4).
What Arcade contributes *besides* technique points is deliberately left open here
— the ruling that corrected the table settled Sim mode, not Arcade — so treat it
as an open question rather than reading e1RM into this row by analogy.

### 2.4 Gym Empire — The Idle Layer

See §5 for the full spec, §5.14 for the tycoon-depth direction and its staged
plan, and §5.15 for the Living Gym Doctrine (the quality bar later stages
must meet). A wall-clock idle loop, run as a real management sim — staffing,
equipment condition, capacity and throughput, reputation — around the one gym
the lifter actually trains at. Pays Gym Bucks and a small Training IQ trickle;
never buys Total, e1RM, training pace, or meet performance (§8.1). This line
previously read "passive generation, cosmetic sink, monetization on-ramp,"
which undersold what §5 already specified even before §5.14 existed;
corrected for the reason §5.0 gives for replacing v1 outright — a summary
that stops matching its own section is worse than no summary.

---

## 3. Sim Mode Specification

### 3.1 Design Philosophy

Fatigue and injury are a **game-feel abstraction that behaves plausibly**, not a
rigorous sports-science model. Real physiology is slow and forgiving of missed
days — the opposite of a daily habit loop. Behave realistically; don't simulate
literally.

**Exception:** e1RM and DOTS math should be genuinely correct. Those are visible,
checkable, and community-recognized.

### 3.2 Daily Session Loop

```
Open app
  → Readiness check-in (5 sec, 3 taps: sleep / soreness / motivation)
  → Modifier applied and surfaced ("Feeling primed +5%" / "Grinding today")
  → One lift-focused session (60–90 sec, timing-based sets)
  → e1RM updated, streak incremented, feedback shown
  → Done
```

One lift per day (squat day, bench day, deadlift day, accessory day on rotation).

**Accessory day pays Training IQ, and nothing lift-specific — RULED.** The
competition lifts are exactly three, because that is the meet (§6.2), so
`LiftKind` stays a three-member type: squat, bench, deadlift. Accessory day does
**not** widen it, does **not** write `bestE1rmKg`, and does **not** get an e1RM
close-out — there is no fourth lift for it to have a one-rep max in.

What it pays instead is **Training IQ**, the §2 currency that already exists for
exactly this: how *well* you train, grown by good Sim decisions. Accessory work
is the part of training that makes you a better lifter without directly moving a
competition lift's number, so the currency and the fiction agree.

This is a boundary, not a convention: an accessory session that emits an e1RM is
a bug, and the code enforces that rather than documenting it.

**The number that moves at the close-out is e1RM — never Total.** This is a
constraint on whoever builds this loop, not a note. The session's payoff beat
shows the lifter's e1RM for the lift they just trained, or a session e1RM PR
where they set one. It must not show a Total that ticked up, an "estimated
Total", or a projected competition total, because Total is the sum of best
successful *competition* attempts (§6.4) and there were no attempts today.

Total updates on meet day and on no other day. Resist the pull to surface it
daily because it is the bigger, more satisfying number: the whole reason meet day
lands is that it is the only thing that moves that number. A daily Total tick
spends the payoff §6 is built to deliver.

### 3.3 RPE-Driven Loading

Player selects **RPE target (6–10)**, not raw weight. Game calculates load from
current e1RM. This single choice is what makes the mode feel real rather than
arbitrary.

Use a standard RPE→%1RM table (Tuchscherer-style reps-in-reserve chart). Do not
homebrew this — lifters know these numbers.

### 3.4 Fatigue

Hidden stat. **Never display a fatigue bar** — surface it through feel:

- Bar-speed cues ("that rep looked slower than expected")
- Readiness check-in shifting what a given RPE actually feels like
- Missed reps becoming more likely as fatigue accumulates
- Tighter input timing windows when fatigued; more forgiving when primed

Fatigue operates on a **same-day / next-day horizon**, not multi-week arcs. Push
too hard today → tomorrow's session starts harder. Multi-week arcs belong to
Career mode.

#### Required of this module: couple the nudge to training stimulus — RULED

**This is a stated requirement for whoever builds fatigue/progression properly,
not a suggestion.** It is recorded here because the daily loop was built first
and cannot satisfy it alone.

Session-over-session growth — the readiness "nudge" that decides how much heavier
today's bar is than the e1RM it was prescribed from — **must scale with RPE and
effort history. It must not stay a flat constant.** Growth is earned by training
stimulus; it is not a reward for opening the app and tapping *good / fresh /
fired up*.

What the daily loop ships today, and why that is knowingly incomplete: the nudge
is a flat percentage keyed only to the three check-in taps, which nothing
verifies against the fatigue ledger. Measured over 30 sessions with every set hit
exactly on target, a 200 kg e1RM becomes **200.00 kg** at neutral and **770.65 kg**
at primed, with a PR reported on **30 of 30** sessions. The optimal play is
therefore the lightest rung plus a primed tap — the easiest possible session
paying the maximum reward.

**`e1rm.ts` is correct and is not the defect.** Its chart-cancellation property —
a set hit exactly on target reports exactly the e1RM it was prescribed from — is
the round-trip guarantee the whole domain layer rests on, and it must be left
untouched. The gap is upstream of it: nothing yet decides how much stimulus
*earns* a heavier prescription. Do not "fix" the curve by paying higher RPE rungs
more; that is the two-parts-disagree failure CLAUDE.md's one-formula rule exists
to prevent, and it is a separate open question below.

Until this module exists, the daily loop's growth curve is not a shipping
progression model and must not be tuned as though it were.

### 3.5 Injury Setbacks

- Rare, short (2–3 day debuffs), always framed as recoverable
- Soft consequence, not stat loss: *"Tweaked lower back — squat volume reduced
  40% for 3 days"*
- Never punish daily engagement itself. A player who shows up every day should
  never feel the game punished them for showing up.
- Physio staff in Gym Empire reduces setback duration (cross-mode hook)

---

## 4. Streaks & Tokens

### 4.1 Streak

Daily, with a short free grace. A gap of up to the **free-grace threshold**
keeps a run alive at no cost and with nothing to answer; a longer one breaks the
streak unless Recovery Days armed at the last session cover the days past the
grace. See §4.4 for the ruling that introduced the grace and what it costs, and
§4.2 for the ruling that made protection automatic.

**The grace is per absence, not per gap.** An absence is everything since the
**anchor day** — the last *trained* day, or the **signup day** for a lifter who
has not trained yet (§4.2) — and it is resolved as one thing: the grace covers
its first few days and Recovery Days cover the rest. Only a real session starts
a new one. So the longest absence a run can survive is the same number whether
the player checks in every day of their holiday or is not seen until they get
back — and so is the price.

**The day boundary is 03:00 local, not midnight.** A lifter who finishes a late
session at 00:40 gets credit for the day they believe they are in. "Local" is an
account property the server resolves, not the device's current timezone —
otherwise a player flying east loses a day and a player who changes their phone
clock manufactures one.

**The streak counts trained days only.** A Recovery Day keeps a run alive across
a gap; it does not add to the count. This is not a detail, it is what keeps the
free-path economy honest: milestone streaks pay out Recovery Days, so if bought
days counted toward the streak, Recovery Days would buy the currency that buys
Recovery Days. Reaching a milestone always costs the full number of real
sessions.

### 4.2 Streak Tokens

Flavored as **"Recovery Days"** rather than pure streak insurance. This reframes
a missed day as legitimate training wisdom rather than failure — important for
the hardcore audience, who often miss days *because* they train intelligently.

**Spending (since §4.4): only on the days of an absence beyond the free-grace
threshold.** An absence inside the grace costs nothing and moves no balance.
Recovery Days are what buys a *longer* absence: vacation, illness. They remain a
finite consumable, earned and purchased exactly as below; there are simply far
fewer occasions to spend one. Only the days past the grace are charged, so an
absence one day longer than the grace costs one Recovery Day, not the whole
absence.

The grace is charged against the **absence**, not against each uncovered gap
inside it (§4.1). Since the whole absence is resolved in one subtraction there
is no smaller unit for it to be charged against.

#### Auto-protect, armed ahead — RULED

**Status: decided. Holding at least one Recovery Day means protected.**

Protection is a **state, not a per-miss action.** There is no arming step before
each individual miss, no prompt during an absence, and nothing to answer on the
way back. Recovery Days are armed by **training**: whatever the player holds at
the end of a session covers the absence that follows it, and the missed days
themselves consume it.

**A settings toggle is where the real choice now lives.** A player who would
rather decline protection and take a broken streak deliberately turns it off,
and then no Recovery Day of theirs is ever spent. Turning it *off* applies
immediately, including to an absence already in progress — that direction can
only end a run early, never rescue one. Turning it *on* applies from the next
session, because arming mid-absence would let a toggle resurrect a run the
calendar had already ended.

**A Recovery Day that arrives during an absence does not cover it.** Buying or
earning one mid-absence tops up the balance and arms the *next* absence. This is
the visible cost of the ruling, and it is the price of the invariant below: the
Gym Empire drop of the earning table lands on a check-in, so a grant that armed
would make coverage depend on whether the player opened the app while away.

**How it is enforced, since it was ruled here and contradicted in code for a
round.** `StreakState` carries two entitlements. `entitlement` is the LIVE
balance — what the lifter holds, what a screen shows, and what
`applySettledCoveredDayPurchase` raises. `armedEntitlement` is the snapshot the
absence in progress resolves against, written by a session and by nothing else.
Only a session arms.

*What that closed.* `absenceOutcome` used to resolve against the live field, so
a settled §8.3E purchase applied on the return day rescued a doomed run — but
only if nothing had recorded the break first, because settling moves the anchor
back to the signup day and makes the absence longer. Ten-day run, window
drained, three days missed: final streak **11** if the store opened before the
client settled and **1** if it settled first. Same calendar, same money. That is
the §12.3 refusal in its plainest form — a player whose client settles on launch
punished relative to one who ignored the app.

**A doomed absence still consumes everything the window holds LIVE, including a
covered day bought during it — and RULE 2 below words that as "the armed
count", which is the same number only while nothing can arrive mid-absence.**
The two came apart when §8.3E was ruled in, and charging the armed count instead
was built and measured: letting a mid-absence purchase survive the absence means
an extra trained day can *split* the absence and spend a covered day the whole
absence would have taken. **3** violating pairs on `real-money` at 40 days, **23**
lifetime-best inversions on the free calendar grant, and **1** in the *frozen*
control where both lifters buy on identical days — which is the proof it is the
rule and not the schedule. So the two halves read different fields on purpose:
whether the run **survives** is decided by what was armed, what a doomed absence
**costs** is everything live.

#### The same-day purchase-timing rule — INTENTIONAL, not a residual

**A covered day bought BEFORE a session on the same day is armed by that
session. One bought AFTER it arms at the next session.** This used to be
recorded here as a residual; a human has ruled it an intentional rule, and it is
written down as one so that it cannot later be "fixed" into symmetry by somebody
who reads it as an accident.

It is this ruling read literally rather than an exception to it. Only a session
arms; a purchase that lands after a session has landed *during the absence that
session started*, and this section's own sentence — "a Recovery Day that arrives
during an absence does not cover it" — is exactly what then applies to it. Making
the two orders symmetric means either arming outside a session (which lets a
purchase rescue a run the calendar has ended) or refusing to arm a purchase that
was in the window when the session ran (which would make a session's arming
depend on where the day's coverage came from).

**What it costs, stated:** the clock time of a purchase is observable. It is
**not** an app-opening dependence — the player chose when to spend money, and
the two orders are two different player actions rather than one action seen from
two clients. `streak.test.ts` pins both orders ("A PURCHASE BEFORE A SESSION AND
ONE AFTER IT DIFFER"), so the documented rule is enforced rather than described.

#### The store may not sell into an already-doomed absence — RULED IN

This section used to name two honest fixes for the second half of the old
residual — a covered day bought before the session that closes a doomed absence
is burned by that absence — and say neither belonged in `streak.ts`. **A human
has ruled the server-side refusal in, and it is built.**

`applySettledCoveredDayPurchase` refuses an order applied on a day whose absence
has already ended the run, with a distinct code (`ABSENCE_ALREADY_DOOMED`, not
`INVALID_PURCHASE` — the order is well formed and the money is good; what is
wrong is the moment) and a player-facing sentence. **A refusal, never a greyed-out
button**: a store that silently disables the control tells the player nothing and
generates the support ticket.

- **The predicate is the absence's own arithmetic.** `absenceOutcome(state,
  day).protectionHolds` — the identical call `recordTrainingDay` branches on to
  decide whether the run survived. Not a re-derivation from `daysMissed` and the
  grace, which would be a second implementation of the coverage rule that agrees
  with the first only until one of them is edited.
- **The message keys on `entitlementArmed`, not on `StreakBreakReason`.**
  `breakReasonFor` is ordered hardest-constraint-first, so which reason an absence
  reports depends on its *length* — and a nightly `settleBrokenStreak` makes the
  same absence longer. Keying the copy to the reason gives two different
  explanations for the same money on the same calendar, decided by whether a
  background job ran. That is the 11-versus-1 defect in the text rather than in
  the state, and it was caught by mutation before it shipped.
- **Both directions are swept**, exhaustively, over every calendar of 10 days in
  three state shapes and at six placements against the window boundary, probed
  out past that boundary — **589 824** store decisions, asserting the store sells
  *exactly* when the absence holds. The false-positive half is the load-bearing
  one: "refuses a doomed absence" is satisfied perfectly by a store that refuses
  everything. Non-vacuity is pinned exactly: **71 912** sellable, **517 912**
  refused.
- **It does not make the covers/burn asymmetry moot.** A covered day bought while
  an absence is still salvageable, carried into one that then goes doomed, is
  still burned — so the two halves still read different fields for the reason
  above. Measured, not assumed.

#### Completing a sale re-validates against settled state — RULED IN

`settleBrokenStreak` nulls `lastTrainedDay`, dropping the anchor to the signup
day; the armed snapshot refills at a window boundary. So on a day where a
boundary has revived an absence, an unsettled state reports a live run and a
settled one reports a signup-anchored absence. **This was measured at 1 pair in
900, documented, and pinned rather than fixed.** A human ruled it in:

> A completed purchase must never be inconsistent with what settled state would
> authorize at that moment. An unsettled client's store verdict may render stale,
> but sale completion must always re-validate against live settled state before
> finalizing.

**Rendering and finalising are now different things.** A stale offer on screen is
acceptable — the client's state is a cache. `applySettledCoveredDayPurchase`
settles first, through `settledStateAsOf`, and then asks the same
`absenceOutcome(...).protectionHolds` call it always asked. **No coverage
arithmetic was re-derived**: the walk offers each day to `settleBrokenStreak` and
keeps what that returns.

- **A single settle at the completion day does not close it**, and this is pinned
  rather than left as a note. On the revival day the absence *holds*, so
  `settleBrokenStreak` reports `NOTHING_TO_SETTLE` and the revived run walks
  straight through. The walk finds the break on the day it actually happened.
- **Four refusal sentences, three codes, and the client says which one it is
  owed.** `ABSENCE_ALREADY_DOOMED` means *your screen said no and so do we*;
  `ABSENCE_ENDED_BEFORE_OFFER` means *your screen was drawn over a run that had
  already ended — refresh*; `ABSENCE_ENDED_AFTER_OFFER` means *your screen was
  right and the run ended between it and this order*.

  **The copy is keyed to what the client reports it drew, and to the day it drew
  it** — `SettledCoveredDayPurchase.renderedOffer`, carried on the order and
  never re-derived here. The **decision** is settled state's alone and is
  app-open invariant, which is what §12.3 is about; only the sentence tracks the
  screen.

  **A claim this document used to make here has been deleted as false.** It read:
  *"a client whose screen already said 'refused' never produces the tap, so no
  single player can ever be given two explanations for one refusal."* Both halves
  are wrong. A refused screen can produce a tap — a queued order, a retried
  order, a second device — and a player with two devices has two screens. What
  replaces it is narrower and is enforced rather than argued:

  > **Every refusal sentence is a true statement about the screen the tap came
  > from.** A player who taps from two screens gets two sentences because they
  > had two screens, and each is true of its own.

  Two ordinary cases broke the old claim, and both are now reproductions in
  `streak.test.ts` rather than notes:

  - **The window-boundary revival.** One device, one state, no background job.
    The armed snapshot refills at a boundary, so an unchanged state reads DOOMED
    on the last day of a window and COVERED on the first day of the next. The old
    code told that player *"your break was already recorded while you were
    away"* — nothing had recorded anything, and their state was byte-identical to
    the server's. The module is handed one state and cannot see a second device
    or a nightly job, so it no longer claims one; the sentence now names only the
    order of events the walk actually found.
  - **The 03:00 rollover.** `ROLLOVER_HOUR_LOCAL` puts a tap at 02:50 and a
    settlement at 03:10 on two different streak days. The refusal was computed at
    the **completion** day, so a client legitimately offered the sale on day *D*
    was told, on *D+1*, that the offer *"should never have been on screen"* —
    the routing exactly inverted, reachable with no second device and no stale
    state. That case has its own code and its own sentence now.

- **The sweep gained the render-day axis it was missing.**
  `DOOMED_SALE_SWEEP.RENDER_DAY_LAGS` varies the gap between the day the screen
  was drawn and the day the order lands. Every probe used to pass the *same* day
  to both, so the axis was not in the domain at all — the same
  hardcoded-fixture hazard as the intra-day ordering defect, one axis over.
  `ABSENCE_ENDED_AFTER_OFFER` is **unreachable at lag 0**, which is why roughly
  six hundred thousand store decisions could be green over an inverted routing.
- **One predicate, asked at two horizons.** Which of the two "you were offered
  it" sentences a client gets is decided by asking *would this sale have been
  authorised on the day the screen was drawn?* — the identical
  settle-then-`protectionHolds` question the completion day is decided by, asked
  at the render day instead. Nothing new is derived; the difference between the
  two answers is the whole content of the split.

  **The first version of this fix used a different predicate and was wrong**,
  which is recorded rather than quietly replaced. It compared the day the settle
  walk *recorded* a break against the render day. `settleBrokenStreak` refuses a
  state whose `lastTrainedDay` is null, so a lifter who has **never trained**
  never has a break recorded at any horizon — while their signup absence still
  runs out of coverage on a definite day. They read as "it ended earlier"
  forever, so a player whose coverage ran out the day *after* their screen was
  drawn was told the screen had been wrong. Measured at **6** of the day-pairs a
  fresh account can produce in its first 40 days.
- **The oracle for which sentence stopped mirroring the implementation — twice.**
  It first read `holds ? 'ABSENCE_SETTLED_WHILE_AWAY' : 'ABSENCE_ALREADY_DOOMED'`
  off the same call the subject made, character for character. Its replacement
  was independent in *form* and still shared the subject's blind spot, because
  both asked whether a break had been **recorded** — that is how the never-trained
  hole above stayed green. The oracle now settles a twin **by hand**, with the
  test's own loop over the real `settleBrokenStreak`, and reads the **absence**
  rather than the recording. Two computations can be independent in shape and
  dependent in the fact they read; only the second kind of independence counts.
- **The doomed-sale sweep cannot reach the never-trained case**, and that is
  stated rather than papered over: its probes start at the end of a 10-day
  calendar, so the first days after signup — where a fresh account's coverage
  runs out — are outside its horizon. The case has its own named regression test
  instead of the sweep being multiplied to reach it.
- **The module does not de-duplicate orders, and this is a ruling.** A settled
  order carries no idempotency key and `StreakState` holds no order ledger:
  such a ledger is unbounded, grows with what the player has bought, and would
  put a purchase-shaped quantity inside the state every monotonicity sweep
  compares byte-for-byte. **The caller — the Edge Function that settled the
  order — owns de-duplication**, because it owns the order-id namespace and is
  the only party that can tell a retry from a second purchase. A refusal costs
  nothing and can be retried freely; an accepted order applied twice credits
  twice, and that is the caller's bug. Written down in
  `applySettledCoveredDayPurchase`'s docstring, where a caller will meet it.
- **The old sweep could not express the case at all.** Anchored at signup, all
  98 304 store decisions contained **zero** probes where a raw state and a
  nightly-settled one disagreed: a covered absence only survives
  `LONGEST_REPAIRABLE_ABSENCE_DAYS` past the last session, and with a 10-day
  calendar starting at signup that can never reach day 30. So the domain that was
  meant to be checking the store had exactly one answer to the question the
  ruling asked. `DOOMED_SALE_SWEEP.CALENDAR_START_OFFSETS` adds the six
  placements — derived from `WINDOW_DAYS` and `LONGEST_REPAIRABLE_ABSENCE_DAYS`,
  and re-derived in the test — where a still-covered absence can straddle the
  boundary.
- **The two states still disagree, and that is the anti-vacuity guard.** Across
  the extended sweep, raw and nightly-settled states disagree about the absence on
  **1 984** probes, pinned exactly. Completion divergence across those same
  probes is **0**. A sweep where the first number fell to zero would make the
  second meaningless.
- **The day-sweep's spend equality is unconditional again.** It had been weakened
  to "wherever the store made the same decision" with the exception count pinned
  at 1. `STORE_VERDICT_DIVERGENCE.PAIRS_IN_THIS_SWEEP` is now **0**, the equality
  has nothing conditioning it, and the counter is kept — pinned at zero — so the
  gap reopening is a red test rather than a silence.
- **It never reached the state, even before.** Every full-state equality across
  opening schedules held throughout; what differed was how many orders the store
  took and therefore the spend. That is the difference between a store defect and
  a §12.3 monotonicity defect, and it is worth being exact about which this was.

**The invariant this buys, which is the point of the whole rule:** for a fixed
training history and a fixed armed state, the final streak, the final balance
and the number of Recovery Days consumed are **identical** whether the player
opens the app the next day, three days later, ten days later, every day, or
never until they come back. `src/game/streak.test.ts` asserts that directly, by
full state equality, over a sweep of opening schedules and exhaustively over
every calendar of a fixed length. Nothing about the outcome depends on when they
look.

**And it now varies the order WITHIN a day, which is what it was missing.**
Every harness in the repository fixed the safe intra-day order — buy, then open,
then train — so the sweep named for this hazard varied only *which days* the app
was opened and was green for a reason unrelated to the property. It now sweeps
purchase-before-settle, settle-before-purchase and never-settle over every
combination of run length, balance, absence length and armed state, at two
purchase dates, and asserts full state equality across all three. That is the
assertion whose absence hid the 11-versus-1 defect above.

**What replaced the prompt is the return-visit reveal** (§4.3).

**Earning (free path):**

| Source | Reward |
|---|---|
| Signup grant | 2–3 tokens |
| Milestone streaks (7 / 30 / 100 days) | 1 token each, **once per lifetime** |
| Achievements (first meet, first PR, first block) | 1 token |
| Gym Empire passive rewards | small chance |

The rows above are unchanged by §4.4 — what changed is how often the balance is
drawn down, not how it fills. If the free path now feels too generous because
Recovery Days are rarely spent, the lever is the grace threshold, not this
table.

**Milestones pay once per lifetime, not once per run.** Eligibility is read off
the player's *best ever* streak, so a milestone is paid exactly when they first
reach it. The alternative — re-arming milestones when a run ends — makes
deliberately breaking your streak the best free income in the game: reach 7,
break, repeat pays a token every seven sessions, while an unbroken run pays
nothing between day 7 and day 30. That is the "punishes you for showing up"
failure of §12.3 arriving through the economy instead of through the streak.

What lifetime-once costs, stated rather than glossed: **a player past a 100-day
best has no streak-based free income left.** Their free path is the other rows
of this table. If those turn out too thin in playtesting, the fix belongs there,
not in re-arming milestones.

**Buying:** small bundles, impulse-tier pricing. Also purchasable with Gym Bucks
at an unfavorable rate (gives grinders a non-cash path).

**Guardrails:**

- Hold cap of 3–5 tokens.
- Limit consecutive uses. This, not the hold cap, is what stops a long absence
  being bought back. It bounds the *chargeable* days of an absence, so the
  longest repairable absence is the grace threshold plus the consecutive-use
  limit — **four days at today's tuning, and a week away ends the run.**
  That ceiling holds at every balance up to the hold cap, and it no longer needs
  the qualifier "however often the player opens the app": since auto-protect,
  app-opening is not an input to the arithmetic at all. An absence of N days
  costs `max(0, N − grace)` and survives iff that is at most what was armed.
- **Auto-apply, not manual use.** Ruled above. The player holds Recovery Days;
  the missed days spend them. There is no prompt, no accept and no decline —
  the settings toggle is the whole of the choice.
- **The free grace is separate from the consecutive-use limit** and stays a
  separate tunable, even where the two happen to hold the same value. One is how
  much absence is free; the other is how many Recovery Days may be spent on one
  absence before a real session has to happen. The two are both 2 today, so no
  behavioural test can tell a build where one is *written as* the other; the
  test that guards this reads the source.

#### No free absences — RULED

**Status: decided. There are two ways an absence used to cost nothing. Both are
now charged. They are two rules, not one, and each has its own player-visible
cost.**

**Why this is one heading and two rules.** Adding a trained day always SPLITS
one absence into two shorter ones, and splitting can only reduce the total
charge — *unless one of the pieces was free*, in which case the split creates a
charge out of nothing and the lifter who trained more pays more. So every free
absence is a hole in "never punish daily engagement" (§12.3). There were exactly
two, and closing one without the other closes about a tenth of the defect:
measured over every 13-day calendar, the anchor alone leaves **32** violating
pairs and the doomed-absence charge alone leaves **24**, against **0** for both.
§4.4 has the full table.

**That argument covers calendars up to 16 days and does not extend past them,
and the reason is RULE 2 below.** "Splitting can only reduce the total charge"
is arithmetic about a charge that depends on the ABSENCE — the days past the
grace. Rule 2's charge depends on what the lifter is HOLDING. It works, and it
works because taking the whole armed count drains the bank, so the second half
of a split absence finds nothing left to take. The same property makes the
charge proportional to wealth, and training more is a way of being wealthier.
§4.4's "what is left" records what that costs, measured; it is the price of the
closure rather than a defect in it, and no arithmetic on Rule 2's amount
separates the two halves — both alternatives were measured and are recorded
there.

---

**RULE 1 — Idle days before the first session are charged, anchored at a new
state field: `signupDay`.**

**Signup day is account creation.** Not the first session, not the first app
open, not the day a migration ran: the day the account came into existence,
which is the first day on which a lifter could possibly have a gap at all. It is
written once and never moves. `src/game/streak.ts` states the definition
explicitly rather than leaving it to be inferred from a field name.

**It is the anchor an absence is measured from until the first session replaces
it.** A lifter who has never trained is not outside the streak system: their
idle days count from the signup day and are charged exactly as a lifter's inside
a run are. The signup grant is therefore **armed from the moment the account
exists**, not from the first session.

*The cost:* a lifter who creates an account and does not train for longer than
the §4.2 ceiling **loses the signup grant** to that absence. Onboarding copy has
to say so. This is the charge that "buys nothing", and it was refused in an
earlier draft of §4.4 on exactly that ground — the ruling overrides that
refusal, because the alternative is a hole in a §12.3 refusal condition.

**Migration.** Accounts created before the field existed do not carry a signup
day. The server backfills it from the account's creation timestamp; where that is
unrecoverable the honest backfill is the day the migration runs, which is safe
because monotonicity is a property of two possible *futures* from the same state
and both share whatever anchor the state carries. The field is **required and
non-nullable** so that an un-backfilled account cannot silently keep the old
free-lunch behaviour.

---

**RULE 2 — An absence that outran what was armed consumes it anyway.**

Coverage is still all-or-nothing — a run either survives an absence or it does
not, and there is no half-saved run — but the **charge** is not. Recovery Days
armed against an absence were committed to holding it open; if it outran them,
they failed and they are gone.

**The amount is the armed count**, which is fixed the moment the last session
ended. It deliberately is not "the days past the grace", because that number
grows for as long as the lifter stays away, and a charge that grew with it would
make the outcome depend on when they came back — which would give away the
invariant §4.2 exists for. Capping it at the consecutive-use limit instead was
measured and does **not** close the defect: two absences may each cost the cap,
so splitting a long one still costs more than leaving it whole.

*Re-measured, with numbers this time.* Capping the debit at the consecutive-use
limit reopens the exhaustive defect at 14, 15 and 16 days — **8, 36 and 124**
violating pairs against **0** today — and makes the longer sweeps worse as well:
**51** violating pairs at 40 days against 13, and **149** at 60 against 122.
Charging `min(days past the grace, armed count)` instead is measurably identical
to today's rule on the whole sampled population. The rule as written is the best
of the three, and what it costs is in §4.4.

*This reverses the previous rule*, which read "an absence that ends the run
debits nothing, and the player keeps every Recovery Day because none of them
bought anything". That sentence is the direct cause of a §12.3 violation, and
the reversal is a measurement rather than a preference.

*The cost:* a lifter whose run dies **loses the Recovery Days that were armed
against the absence that killed it**. This is what the Duolingo streak-freeze
precedent §12.2 names already does — a freeze is consumed by the day it covers,
not by whether the week ended well — so it is a cost the bar already pays.

**The debit happens in exactly one place: the session that ends the absence.**
Settling a broken streak records the end of a run and moves no balance, so a
lifter who never comes back is never charged, and no amount of opening the app
can change what is owed.

---

**Both consumptions are reported, never silent — and that is enforced, not
promised.** Every event that reduces the balance is announced twice: the read
model says what the next session will cost *before* it costs it, and the session
that takes it reports what it took. `src/game/streak.test.ts` drives every
12-day calendar at every balance under both settling behaviours and asserts that
no balance ever moves by more than the outcome reports, that a save and a loss
are never both reported for one absence, and that **both** named events —
signup-grant expiry and dead-run consumption — actually occur in the sweep. The
announcement side is an exhaustive switch over the read model's cases, so a new
screen state cannot be added with a silent consumption behind it.

**The residual the prompt used to carry is gone.** Under the manual prompt, a
player who opened the app mid-absence, accepted a save, and then stayed away
past what their balance covered ended poorer than one who never looked. That was
the price of tying the spend to the day the player opens the app, and removing
the prompt removed it: there is now nothing for app-opening to change.

---

#### Coverage is a rolling entitlement, not a balance — RULED (Option 1)

**Status: decided. Recovery Days stop being a stock the lifter holds. Coverage
is `COVERED_DAYS_PER_WINDOW` covered days in every `WINDOW_DAYS` window,
anchored at the signup day.** `src/game/streakEntitlement.ts` is the whole
mechanic; §4.4 has the verification the ruling was conditional on.

> **IMPLEMENTATION STATUS — WIRED.** The mechanic is built, verified and **live
> in `src/game/streak.ts`**. The behaviour that ships is the entitlement's, and
> the residue this block used to warn about — 13 / 122 / 142 / 74 violating
> pairs at 40 / 60 / 80 / 100 days, lifetime-best inversions of 14 / 150 / 276 /
> 221, a worst deficit reaching 189 at 400 — is **zero on all three at every
> pinned length**, measured through the real engine.
>
> **What the wiring did**, item by item, because this block used to be a list of
> what it still had to do: `recoveryDayBalance` and `armedRecoveryDays` are
> replaced on `StreakState` by an entitlement snapshot plus an armed flag;
> `grantRecoveryDays`, the hold cap and the §4.2 earning table are gone;
> `DayOpening` and `RecoveryDaySave` report covered days; the state-shape change
> went through `StreakStateWire` in `progression.ts` under the same
> `KeysAreExactly` coupling `signupDay` did, with field-by-field validation; and
> `migrateFromRecoveryDayBalance` converts an account that holds a balance,
> returning the held count as **compensation for the caller to settle in
> another currency** rather than carrying it forward. Both invariants came
> through and are asserted rather than promised: app-opening purity by full JSON
> state equality across five opening schedules, and "reported, never silent"
> over every 12-day calendar at every window state.
>
> **THREE THINGS THE WIRING FOUND, none of which was in the plan above:**
>
> 1. **The free grace does not survive a declined protection unless it is
>    written to.** The first wiring short-circuited to "nothing armed means the
>    absence is not covered", which ended a run on a one-day miss for any lifter
>    who had turned protection off — and reset a live streak on a *consecutive*
>    session, since a zero-day absence is also "not covered" under that
>    short-circuit. §4.4's ruling is the opposite and the fix is to resolve the
>    disarmed case against an **empty window** rather than to skip the
>    resolution, so "the grace draws nothing, so there is nothing in it to
>    decline" falls out of the arithmetic.
> 2. **A state that holds coverage with none of it armed is now
>    unrepresentable**, because `entitlementArmed` is a boolean and what an
>    absence may draw is the window itself. That case had a test; it is recorded
>    as removed rather than quietly re-pointed.
> 3. **The verification battery grades a reference composition, not the engine.**
>    `streakEntitlement.test.ts`'s `drive()` re-implements the streak
>    bookkeeping around the entitlement in twenty lines, so every attack in it
>    was a statement about a program nobody ships. The two are now **pinned
>    byte-identical** on the battery's own calendars, with a negative control
>    proving the comparator can see a rule change. The pin is what makes the
>    table below transfer; without it the ruling rests on nothing.
>
> **What the pin does not cover, stated rather than assumed:** `streak.ts` reads
> `RECOVERY_ENTITLEMENT` as a module constant, so it can only be driven at the
> shipped tuning. The battery's window-length and entitlement-size grids and its
> negative controls remain `drive`-only, and they reach the shipped engine only
> through the shipped tuning being one point in each grid — which
> `streak.test.ts` asserts directly.
>
> **The purchase path used to be on that list and no longer is.** When §8.3E was
> ruled in, `drive()` grew a purchase and the pin did not, which would have made
> §8.3E's table a statement about the reference composition rather than about the
> shipped game — the exact defect item 3 above records, arriving a second time
> through a new door. The pin now runs both engines with purchased days in the
> field, on both the calendar-funded and the training-funded day pattern, and
> asserts that buying changed some outcome so the agreement is not agreement
> about nothing.
>
> **A FOURTH THING, FOUND AFTER THE PURCHASE WENT LIVE: the currency that funds
> a purchase is inside this ruling's scope, and the wiring did not know it.** The
> rule this whole block exists to hold is that no covered day may arrive on a day
> the lifter's own training decides. A purchase funded by achievement Chalk does
> exactly that, one hop out, and every guard here stayed green — because none of
> them looks at money. Measured, it does not merely worsen the property, it
> **creates** the violations: 105 / 305 / 733 / 785 violating pairs at 40 / 60 /
> 80 / 100 against **0** at zero purchases. §8.2 and §8.3E carry the fix; the
> part that belongs here is that the mechanic's own invariant is only as strong
> as the provenance of what buys into it, and `SettledCoveredDayPurchase.tender`
> is now typed so training-funded money cannot compile into this engine.
>
> **AND A FIFTH, FOUND BY THE PURCHASES RATHER THAN BY A SWEEP: a coverage
> snapshot is stale at a window boundary.** `coveredDaysLeftInWindow` reports
> what was left in the window the lifter's *last event* fell in, so comparing two
> lifters whose last events fall in different windows compares a September
> balance against an October one. It was invisible for as long as nothing could
> put a number in `purchasedDaysLeft` — the free counter refills to the same
> value every window, so the stale figure and the fresh one were equal. With a
> purchase in the field the protection-declined sweep failed at "2 against 5".
> Both protection-declined sweeps now compare what a **day** has available, the
> exhaustive one is run at a second signup anchor that puts a window boundary
> *inside* its ten-day calendar, and the staleness itself is pinned in both
> directions so neither the workaround nor the reason for it can be deleted
> quietly.

**Why.** RULE 2 above debits a doomed absence the whole armed holding, which is
what makes splitting a doomed absence cost the same as leaving it whole — and it
is therefore what makes the exhaustive sweep clean. The same rule makes the
debit **proportional to wealth**, and training one more day is a way of being
wealthy at the wrong moment. Deleting the wealth deletes the wealth-dependence.
An entitlement is the same number for everybody at the start of every window, so
there is nothing for a debit to be proportional to, and two lifters who differ
inside a window **re-converge at its boundary** — which a stock never did,
because the income that refilled it was paid once per lifetime.

**RULE 2 IS KEPT, AND THAT IS THE FINDING THAT MATTERS MOST HERE.** It is
tempting to drop the burn along with the stock: it is the rule whose
wealth-dependence caused the defect, and it reads as harsh. Measured, dropping it
is **worse than the design it replaces** — 1051 violating pairs at 60 days and
673 at 100, against 0 with it. The doomed branch has no subadditive arithmetic to
lean on, so its consumption must be *idempotent under splitting* instead, and
"take everything left in the window" is the only thing that is. What changed is
the blast radius: everything left is bounded by one window's entitlement and is
restored at the boundary regardless of what happened.

**What a lifter sees.** Two covered days a month, the same for everyone, no
balance to hoard and nothing to lose by using them. The ceiling §4.2 already
promises is unchanged — grace plus the per-absence cap, four days — because
`MAX_COVERED_DAYS_PER_ABSENCE` survives as the direct heir of the consecutive-use
limit. A week away still ends a run, at any entitlement and at any price.

*The cost, stated rather than discovered:* unused entitlement **does not carry
over**. A lifter who trains every day all month gets nothing to keep at the end
of it. That is the point — carrying over is what a stock is — but store and
onboarding copy have to say it plainly, and so does the reveal screen.

### 4.3 The First-Save Reveal

The first time a Recovery Day actually saves a player's streak, tell them — with
the explanation. Let them *feel* the save before they understand the system.

**It is news, not a decision.** Since §4.2's auto-protect ruling the save has
already happened, on the days it was needed. The player comes back, opens the
app, and the screen says what held their run: how many days they missed, how
many the grace covered for free, how many Recovery Days are holding the rest,
and what they will have left. That is the "phew" beat, moved from the moment of
choosing to the moment of finding out. No timer, nothing to answer, and training
is never blocked behind it.

**The trigger is an absence past the free-grace threshold, not any miss.** A
short miss costs nothing, so there is no save to explain and no moment to teach
— firing the reveal there would explain a system the player has not touched. At
today's tuning that means a **3+ day absence**, since the grace covers the first
two days of one.

**The explanation is consumed by the session that banks the save, not by the
screen that shows it.** So closing the app without training re-shows it, a
break nothing could have covered does not burn it, and a grace-covered absence
does not either.

The Duolingo streak-freeze precedent this section is built on now holds
straightforwardly rather than by analogy: the freeze is armed ahead, consumed by
the missed day, and reported afterwards, which is exactly the shape §4.2 now
specifies.

#### The payoff beat rendered the loss — FIXED, and recorded because it shipped

**On the exact beat this section calls the payoff, the daily loop told the
player their run was gone.** A lifter on a ten-day streak who missed three days
and came back — the first time a Recovery Day actually saves a streak, which is
the moment this section exists for — saw **1** under `DAY STREAK`, with the
celebratory pop, and then watched it snap to 11 about 558 ms later when the
server answered. `LOCAL_SERVER_LATENCY_MS` is 550, so that is half a second of
wrong number on screen, not a sub-frame race. It is §12.3's "never punish daily
engagement" breaking in the one place the player was supposed to feel rescued.

**The cause was one mapping implemented twice.** `DayOpening ->
streakIfTrainedToday` existed as a chained ternary in `sessionServer.ts` naming
three opening kinds and a *shorter* one in `sessionClient.ts` naming two, each
ending in `: 1`. `'gap-covered-by-recovery-days'` fell through the client's
chain, and the client's is the copy that reaches the screen — the server's
correct twin, `todayForLifter`, has no caller on the app's route at all.

**The fix is one function, not two that agree.** `streak.ts` exports
`streakIfTrainedToday(opening)`; both `todayForLifter` and `todayFromCache`
render it. It is an exhaustive `switch` with a `never` fallthrough, so an eighth
`DayOpening` kind is a compile error rather than a silent `1` — which is
precisely how this shipped, since the fall-through arm was never written for the
kind that ended up using it.

**A second, smaller instance of the same defect was fixed with it.**
`'day-in-past'` carried no `currentStreak`, so it fell through to `1` too: a
lifter on a live run whose device clock moved backwards — skew, or a westward
timezone change — was shown `1`. It is reachable in the shipped app, because the
day comes from the device wall clock. It now answers "the number does not move",
which is what `recordTrainingDay` actually does, since it refuses that day.

**Why nothing caught it, which is the part worth keeping.** Every fixture in
`sessionClient.test.ts` set `lastTrainedDay` to *yesterday*, so the covered-gap
opening was never generated and its check could not have failed — CLAUDE.md's
**empty domain** vacuity shape exactly. Nothing in the suite renders. And all
103 browser checks play a day-1 lifter with no absence, where the fall-through
to `1` is *coincidentally correct*. The replacement sweep
(`streak.test.ts`, `[one-streak-mapping]`) grades every opening against what
`recordTrainingDay` really does and pins per-kind counts rather than bounds:
6532 / 15360 / 13824 / 8832 / 900 / 632 / 15360 openings across the seven kinds,
with **900** covered gaps and **11778** day-in-past openings on runs longer than
one day — the cases where the old `: 1` was a genuinely different number.
Parameters and counts live in `streakSweep.ts`'s `ONE_MAPPING_SWEEP`.

#### What the reveal still needs — NOT BUILT, and scoped here rather than guessed

The number is now right. **The reveal this section describes still does not
exist**, and the payload it needs is computed correctly and then dropped. Written
down so the next builder starts from the shape rather than rediscovering it.

`openDay`'s `'gap-covered-by-recovery-days'` already carries everything the
paragraph above asks for — `daysMissed`, `daysCoveredFreeByGrace`,
`recoveryDaysHolding`, `balanceIfBankedToday`, `lastDayStreakCanBeSaved`,
`isFirstRecoveryDaySave`. Two halves are missing, and they are **not** the same
size:

- **The read half is small and needs no boundary change.** `todayFromCache`
  already calls `openDay` on cached state, so the payload is available on the
  client today; it reads none of it and `TodayFromCache` has no field to hold it.
  Adding one is a named type, a second exhaustive `switch` over `DayOpening`, and
  a field.
- **The write half is a boundary decision, not a field.** `recordTrainingDay`
  returns a populated `RecoveryDaySave`; `applyTrainingSession` drops it and
  `localSessionServer.recordTrainingSession` returns only the snapshot. Carrying
  it to the client means either a new fact on `ProgressionSnapshotWire` — which
  models *idempotent state*, and a save is a *one-time event*, so it does not
  fit — or a third output on `SessionServerPort`, which `sessionClient.ts`'s
  header explicitly forbids ("There is no third output and no accessor for the
  row"). That is a design call, not an edit.

Neither was built, deliberately: a field with no reader is the
"registered, documented and read by no pixel" failure this codebase has already
had, and the reveal screen itself is a feature and a human's call.

**A browser check would not currently catch a regression here, and this is the
third copy of the same blind spot.** `sessionPreview.ts`'s `previewContext()`
hardcodes `streakIfTrainedToday: SESSION_PREVIEW.STREAK_BEFORE + 1` instead of
routing through `sessionContextFrom`, so every `?session=` moment — and therefore
`verify-session-boundary.mjs` and `capture-session.mjs` — bypasses the mapping
entirely. Its `recordBeforeSession()` also sets `lastTrainedDay` to *yesterday*,
the same empty domain the unit fixtures had. A check that would bite must drive
the real `useSession` route from a **seeded** row, which the local stand-in
supports (`LocalSessionServerOptions.record`) but no debug route reaches.

### 4.4 Free Grace for Short Gaps — Ruled

**Status: decided. Short gaps are covered for free; Recovery Days are spent only
on longer ones.**

**The defect this settles — and this section's history of getting its cause
wrong is below, kept on purpose.** A player could end on a **shorter** streak
than the same player who trained one day fewer, which breaks the "never punish
daily engagement" line in §12.3. The grace ruled here removed most instances of
it. It did not remove the cause; the signup-day ruling in §4.2 did, and what
that cause actually was is recorded under "THE CAUSE, CORRECTED A THIRD TIME"
below rather than here, because the explanation this paragraph used to carry —
"idle days before a run exist are free, idle days inside a live run cost tokens"
— was **half right**, and the missing half was worth nine tenths of the defect.

**The ruling.** The first **free-grace threshold** days of an absence are covered
without touching the Recovery Day balance. Recovery Days remain a finite
currency, earned and purchasable per §4.2 and §8.2, but they now buy coverage
only for longer absences — vacation, illness — and only for the days past the
grace.

**The grace belongs to the absence, not to each gap inside it.** Since §4.2's
auto-protect ruling this is structural rather than maintained: an absence is
resolved in one subtraction, from the last *trained* day, so there is no
part-way marker for a grace to be recomputed from and no way for a spend to
re-arm one. Only a training day starts a new absence. This is what makes the
§4.2 ceiling — grace plus consecutive-use limit, four days today — the answer
regardless of how often the player opens the app. See "the walk-back correction"
below for what this replaced.

**The accepted cost, stated rather than discovered later:** a short miss
basically never breaks a streak, and a player who trains one day in every
(grace + 1) can hold a run open indefinitely without spending anything. That is
intended. If it turns out to be too generous in playtesting, the lever is the
grace threshold, not a new penalty.

**The walk-back correction.** The first implementation of this ruling moved the
coverage marker to the end of each covered gap and recomputed the grace from
*there*, which re-armed it on every spend. The consequence was that the longest
survivable absence depended on the player's app-opening habits: `(grace + 1) ×
consecutive-use limit + grace` days — **8** at today's tuning — for a player who
checked in during their absence and paid each time, against **4** for the same
absence answered once on the way back. A week away was survivable by the first
route, which contradicts the guardrail in §4.2.

That is fixed, and fixed **downward to 4**, because 4 is the number §4.2 already
promises and the point of the consecutive-use limit is that a week away is not
buyable. The two routes now produce the identical table: the same absences
survive, at the same streak, for the same number of Recovery Days, ending on the
same balance. `src/game/streak.test.ts` builds that table under both behaviours
and asserts every cell matches, at every balance from empty to the hold cap.
Levelling *upward* instead was rejected outright — it would have made seven days
saveable. Since §4.2's auto-protect ruling this class of bug is no longer
expressible: there is no per-gap marker to recompute a grace from.

**What the grace bought, measured over every 13-day calendar** (pairs differing
by one trained day, where the player who trained more ends strictly lower):

| | before §4.4 | first implementation | grace per absence | auto-protect | no free absences (today) |
|---|---|---|---|---|---|
| opening the app every day | 1948 | 0 | 24 | 36 | **0** |
| opening only on training days | 4250 | 36 | 36 | 36 | **0** |
| worst deficit | 6 | 3 | 3 | 3 | **0** |

*The worst-deficit row counts only pairs where both lifters spent the same
number of Recovery Days, which is a narrower question than the rows above it.
Measured without that filter the auto-protect column's worst deficit is 5, not
6. The narrower figure is kept because it is what the earlier columns were taken
with, and changing a comparator mid-table is how a before/after stops meaning
anything.*

**The two lower numbers in the middle columns were both bought by spending
Recovery Days that did not buy anything.** The 0 came from a spend re-arming the
grace; the 24 came from the manual prompt letting a daily player pay for an
absence a day at a time and then break anyway. Both are cases of the daily model
and the returning model disagreeing, which is the defect, not the fix. Under
auto-protect they cannot disagree, and under the signup-day ruling there is
nothing left for them to disagree about.

**The count is not a target.** A build in which Recovery Days protected nothing
at all would score 0 here too, which is why the right-hand column needs the
company of the ruling that produced it: Recovery Days are still a finite
consumable, still spent, still capped and still sold (§8.2). The alternative fix
— *cover gaps but never debit* — also measured 0 and was **rejected** for
exactly that reason: it would have made the earning table and the hold cap
decorative.

**THE CAUSE, CORRECTED A THIRD TIME AND THIS TIME MEASURED FROM BOTH SIDES.**
This section has been wrong about the cause twice, in opposite directions, and
the sequence is kept rather than tidied away because the wrong turns are the
useful part:

1. It first called the asymmetry "inherent to a finite consumable spent to keep
   a live run alive."
2. That was retracted as false, on the grounds that Duolingo's streak freeze is
   such a consumable and has no such residue *because* it is armed ahead and
   consumed by the missed day. The cause was reassigned to §4.2's **manual
   prompt**.
3. The prompt was deleted and replaced by exactly that armed-ahead model as a
   clean test of (2). **The family did not move at all** — 37 trained days
   against 38, the same spend on both sides, on an engine with no prompt in it.
   So (2) was wrong, and this section went on recording it as the cause.
4. **The cause is two kinds of FREE absence,** and neither of them is the
   prompt:
   - idle days **before a run existed** cost nothing, because there was no
     anchor to measure them from;
   - an absence that **outran what was armed** cost nothing, because coverage
     and charge were both all-or-nothing.

   Adding one trained day always *splits* one absence into two shorter ones, and
   splitting can only reduce the total charge — unless one of the pieces was
   free, in which case the split creates charge out of nothing. That is the
   whole mechanism, and it has exactly two instances.

**The ruling.** Both free cases are now charged: idle days are anchored at the
**signup day** (§4.2), and a doomed absence consumes what was armed against it
(§4.2). Recovery Days stay a finite consumable, which is the half of the problem
the rejected alternative would have given away.

**Neither half works alone, measured.** Over every 13-day calendar: the signup
anchor alone leaves **32** violating pairs; charging doomed absences alone
leaves **24**; the two together leave **0**. That is why §4.2 carries both, and
it is the finding that mattered most in this piece — the mechanism as first
diagnosed would have closed less than a tenth of the defect.

**What the fix is worth, measured the way the defect was measured — and every
input is in the repository.** `src/game/streakSweep.ts` holds the seeds, the
calendar lengths and the attendance distribution these numbers were taken on,
as named constants and a deterministic generator, so anything below can be
re-derived without asking anyone what parameters were used. That file exists
because the first version of this measurement was published with its seeds
unstated and could not afterwards be reproduced by anyone, including the person
who took it.

Exhaustively, over every calendar of 8 to 16 days and every single-day superset
of each:

| length | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|
| violating pairs, before | 0 | 0 | 0 | 2 | 10 | 36 | 124 | 384 | 1096 |
| violating pairs, after | 0 | 0 | 0 | **0** | **0** | **0** | **0** | **0** | **0** |
| worst deficit, before | 0 | 0 | 0 | 1 | 2 | 3 | 4 | 5 | 5 |
| lifetime-best inversions, before | 0 | 0 | 0 | 0 | 1 | 5 | 19 | 66 | 211 |
| lifetime-best inversions, after | 0 | 0 | 0 | **0** | **0** | **0** | **0** | **0** | **0** |

The lifetime-best row above is **only true at these lengths**, and until this
round nobody had checked it anywhere else — the sampled sweeps below compared
`currentStreak` alone. It is not zero at 40 days.

Sampled, 400 schedules per seed against every single-day superset, violating
pairs per seed:

| | seed 1 | seed 2 | seed 3 | seed 4 | seed 5 |
|---|---|---|---|---|---|
| 40 days, before | 100 | 148 | 116 | 121 | 178 |
| 40 days, after | **0** | **0** | 11 | 2 | **0** |
| 60 days, before | 203 | 299 | 235 | 236 | 296 |
| 60 days, after | **33** | **21** | **33** | **23** | **12** |
| 80 days | 68 | 0 | 15 | 32 | 27 |
| 100 days | 26 | 21 | 0 | 0 | 27 |

And the same sweeps counting `longestStreak` inversions — the lifetime best,
which the exhaustive table above reports as zero everywhere and which nobody had
measured on these lengths at all:

| | seed 1 | seed 2 | seed 3 | seed 4 | seed 5 |
|---|---|---|---|---|---|
| 40 days | 3 | 0 | 11 | 0 | 0 |
| 60 days | 32 | 35 | 24 | 31 | 28 |
| 80 days | 121 | 24 | 38 | 54 | 39 |
| 100 days | 57 | 53 | 36 | 30 | 45 |

The constructive family that produced "37 trained days end on 37, 38 end on 18"
now ends both lifters on 18, with the lifter who trained more holding the higher
lifetime best, at every run length from 8 to 1000.

**What is left — THE CAUSE, CORRECTED A FOURTH TIME, and this time from a trace
rather than from a counterfactual.** Across all five seeds at 40 days, 13
violating pairs remain, and at 60 days 122.

*What this section used to say, and why it was wrong.* It said the cause was
**streak-milestone income, paid once per lifetime and timed by the streak** — the
lifter who trains more banks a Recovery Day earlier and loses it to a doomed
absence the lazier lifter reaches with the payout still ahead of them. That was
read off one counterfactual: switch milestone income off, and the sweep is 0 at
40 and 60 days at every seed. The counterfactual is real and still passes.
**The conclusion does not follow from it**, because milestone income is the only
income the sweep has after the signup grant, so switching it off switches off
income rather than income *timing*. Two counterfactuals that do separate them
both refute it:

| counterfactual at 60 days | violating pairs |
|---|---|
| no income at all after signup (the published one) | **0** |
| income restored on **fixed calendar days**, arrival identical for both lifters | **81** |
| balance topped to the hold cap every day, so the stock **can never run out** | **194** |
| the shipped economy, for comparison | 122 |

So it is neither the streak-keyed timing of the income nor the scarcity of the
stock. Note the third row: an *inexhaustible* stock is worse than the real one.

*What the trace shows instead.* **Rule 2's debit is the whole armed count, so it
is increasing in how much the lifter holds** — and training one more day is a way
of holding more at a given calendar day, either because the extra day spared
them a save or because it carried them to a milestone sooner. The lifter who
trained more walks into a doomed absence richer, loses more, and dies at a later
absence the lazier lifter survives. Where a milestone is involved the loss is
permanent, because milestones are paid once per lifetime and the confiscated one
is never re-earned.

*It is not the free-absence shape.* No charge is created: in **110 of the 122**
pairs at 60 days the two lifters spend exactly the same number of Recovery Days
in total. The same budget is committed at a different moment, and the doomed
branch buys nothing with it. This is an allocation failure, not a free lunch,
which is why the fixes aimed at the old diagnosis do not close it.

*Reproduced by hand, in 23 days.* `src/game/streak.test.ts` builds the case out
of the named guardrails: one extra trained day turns a final streak of **8 into
1** and a lifetime best of **8 into 7**. It is longer than the 16-day exhaustive
proof and shorter than the 40-day sweep, which is exactly why nothing caught it —
a new lifter could hit it in their first month.

**The lifetime best is inverted too, and nobody had measured it past 16 days.**
The exhaustive sweep counts `longestStreak` inversions and the table above pins
them at zero. The 40- and 60-day sweeps only ever compared `currentStreak`.
Counted now: **14** inversions at 40 days, **150** at 60, **276** at 80, **221**
at 100. This is the more serious half. A `currentStreak` deficit heals — train
again and the run rebuilds — and a lifetime best does not; and because milestones
are paid off `longestStreak`, a lifter whose best is inverted has permanently
lost the income attached to the streak they were not credited with.

**Does it grow without bound? No — the frequency saturates, the magnitude does
not.** A streak game is played for years, so the trend matters more than the
count at any one length. Swept through the same generator at 80 and 100 days
(`RESIDUE_SWEEP` in `src/game/streakSweep.ts`), with the pair count as the
denominator:

| calendar length | 40 | 60 | 80 | 100 | 150* | 200* | 300* | 400* |
|---|---|---|---|---|---|---|---|---|
| violating pairs | 13 | 122 | 142 | 74 | 100 | 117 | 82 | 36 |
| pairs compared | 36,820 | 53,872 | 72,680 | 91,091 | 135,294 | 180,170 | 272,880 | 365,504 |
| rate | 3.5e-4 | 2.3e-3 | 2.0e-3 | 8.1e-4 | 7.4e-4 | 6.5e-4 | 3.0e-4 | 9.9e-5 |
| worst deficit | 13 | 14 | 25 | 19 | 61 | 86 | 82 | **189** |
| lifetime-best inversions | 14 | 150 | 276 | 221 | — | 908 | — | 847 |

*\* measured off the same generator but **not pinned** by any test, because the
longer lengths cost more suite time than they are worth. 40 through 100 are
pinned.*

The rate does not climb. The **worst deficit does**: at 400 days the lazier
lifter ended on a streak of 189 and the lifter who trained one more day ended on
0. The deficit is bounded by the streak that was there to lose, and that grows
with the calendar — so the chance of being hit saturates at roughly one pair in
a thousand while the cost of being hit scales with how long you have played.

**That one has not been ruled on, and the ruling it needs has changed.** Both
fixes this section used to offer — paying milestones on a schedule that is not
the streak, or protecting income from a doomed absence — are aimed at the
diagnosis retracted above, and the first of them is **measured not to work**
(the fixed-calendar-day row of the table: 81 pairs). What the measurements point
at is a tension rather than a bug: a doomed-absence debit that drains the bank is
what makes splitting a doomed absence free, and a debit that drains the bank is
necessarily proportional to what the lifter holds. Both alternatives to the
amount were measured and are recorded in §4.2. Escaping the tension means
coverage that is not funded from a stock at all — which is a decision about what
§8.2 sells, and belongs to a human.

**Where that left the bar, under the stock design.** "Never punishes daily
engagement" was met over every calendar length this repository can search
exhaustively — 8 to 16 days, both fields — and was **not** met past it. On the
sampled sweeps it failed at every length from 40 days up, on `currentStreak` and
on `longestStreak` both. It was real, measured, bounded in frequency, unbounded
in magnitude, and named rather than rounded up.

**Where it leaves the bar now that the entitlement is WIRED (§4.2's status
block).** The tables above are the STOCK's numbers and are kept as the thing the
zeros below are zero against. Re-measured through `src/game/streak.ts` with the
entitlement live, on the same generator, the same seeds and the same comparator:

| | 40 days | 60 days | 80 days | 100 days |
|---|---|---|---|---|
| violating pairs, stock | 13 | 122 | 142 | 74 |
| violating pairs, entitlement | **0** | **0** | **0** | **0** |
| lifetime-best inversions, stock | 14 | 150 | 276 | 221 |
| lifetime-best inversions, entitlement | **0** | **0** | **0** | **0** |
| worst deficit, stock | 13 | 14 | 25 | 19 |
| worst deficit, entitlement | **0** | **0** | **0** | **0** |

The exhaustive 8-to-16-day table is unchanged at zero on both fields, and the
constructive family that produced "37 trained days end on 37, 38 end on 18" now
ends both lifters level at every run length from 8 to 1000.

**And the two hand-built cases, because a table of zeros is the easiest thing in
the world to get by accident.** The 23-day case that reproduced the residue by
hand — one extra trained day turning a streak of 8 into 1 and a lifetime best of
8 into 7 — is level at 1 and 7. **Which way it levelled is worth reading:** the
LAZIER lifter lost their eight-day run rather than the diligent one keeping
theirs. The entitlement is stricter there, not more generous. What went away is
the asymmetry, and the traced cause with it — the two confiscations used to
differ, because the diligent lifter was richer when the doomed absence landed,
and they are now equal.

**What the extra trained day can still change, measured rather than claimed to
be nothing.** Over the 60-day sweep, 6,462 of 53,872 pairs confiscate different
TOTALS: one extra day splits an absence, and a split can move which window a
doomed absence resolves in. The difference is bounded by one window's
entitlement and is erased at the next boundary, which is the whole of the fix —
under the stock the difference was whatever had been hoarded and it was
permanent, because a confiscated milestone payout was never re-earned.

---

**THE REPLACEMENT, AND THE VERIFICATION IT WAS RULED IN ON.** §4.2's Option 1
ruling replaces the stock with a rolling entitlement. A zero is the easiest
number in the world to get by accident, and this section has now published two
"this closes it" claims that died under later tracing — the first because the
sweep compared `currentStreak` only, the second because the one counterfactual
available could not separate a cause from its vehicle. So the replacement is not
reported as a count. It is reported as a battery aimed at the failure classes
those two produced, with the parameters in `ENTITLEMENT_VERIFICATION`
(`src/game/streakSweep.ts`) and the runs in `src/game/streakEntitlement.test.ts`.

| attack | result |
|---|---|
| exhaustive, every calendar of 8–16 days, both fields | **0** |
| sampled 40 / 60 / 80 / 100 days, `currentStreak` | **0** |
| sampled 40 / 60 / 80 / 100 days, **lifetime best** | **0** |
| 200 and 400 days, worst deficit as well as count | **0** |
| five fixed attendance rates (0.1–0.95) the seeded generator does not reach | **0** |
| six window lengths (1, 7, 13, 30, 31, 365) | **0** |
| five entitlement sizes (0, 1, 2, 3, 5), per-absence cap above and below | **0** |
| free grant path, three fixed calendar schedules, one on a window boundary | **0** |
| **purchase path, calendar-funded, 40 / 60 / 80 / 100 days, purchased days populated** | **0** |
| **purchase path, achievement-funded but with the purchase schedule FROZEN** | **0** |
| adversarial hill-climb, random restarts, largest deficit reachable | **0** |

**And the negative controls, which run first and must be non-zero**, because a
battery that only ever prints zero cannot distinguish a property that holds from
a harness that is not looking:

| control | violating pairs | worst deficit |
|---|---|---|
| a doomed absence consumes nothing (RULE 2 dropped) | 1051 at 60 days, 673 at 100 | 20 |
| a covered day granted at a streak length | 54 at 100 days | 19 |
| a covered day granted every N sessions | 1156 at 100 days | 54 |
| **a covered day BOUGHT with a currency training earns** | **105 / 305 / 733 / 785 at 40 / 60 / 80 / 100** | **54** |
| the adversarial search, pointed at the broken variant | finds one | — |

**The fourth control is new, and it is the one §8.3E is conditional on.** It is
matched against the frozen row above: same purse, same price, same rule, same
seeds, and a bit-identical lazy member. The only difference is whether the
diligent lifter's purchase days are frozen from the lazy run or recomputed from
their own training. **The lifter who buys MORE is the one who is beaten more
often** — 509,581 covered days bought against 504,316 at 100 days — which rules
out "they simply had a smaller bank", the artifact that made an earlier,
unmatched cut of this measurement read the wrong way round. §8.3E has the full
table and the consequence for §8.2's Chalk row.

**The two things the battery changed about the ruling.** Neither was in the
ruling as written, and both are load-bearing:

1. **RULE 2 has to survive the redesign.** Dropping the burn is worse than the
   stock it replaces. §4.2 says why the doomed branch needs an idempotent
   consumption rather than a subadditive one.
2. **The earning and purchase paths are constrained, not free.** Any grant of
   covered days whose arrival day the lifter's own training can move reopens the
   defect, and the season-pass tier shape is the worst offender measured. §8.3C
   and §8.3E carry the consequence.

**And the third, which the WIRING added and which is a fact about this table
rather than about the design.** Everything above grades `drive()` — a twenty-line
reference composition of the free grace and the entitlement inside
`streakEntitlement.test.ts`, not `src/game/streak.ts`. Until the wiring landed
nothing checked that the two agreed, so every row of both tables was a statement
about a program nobody ships. They are now **pinned byte-identical** on
`currentStreak`, `longestStreak` and consumption across every calendar of 8 to 13
days, 60 schedules per seed at each sampled length, the 200- and 400-day
horizons, all five fixed attendance rates and nine hand-built shapes a Bernoulli
generator does not produce — with a negative control that proves the comparator
can see a rule change. **The pin is what makes these tables mean anything about
the shipped game**, and it only covers the shipped tuning: the grid rows, the
purchase rows and the negative controls are `drive`-only and reach the engine
solely through the shipped tuning being a point in each grid.

**What this is still not.** It is a property about single-day supersets over
sampled and exhaustive calendars, plus a hill-climb. It is not a proof. The
exhaustive half is a proof for calendars of 16 days or fewer, which is precisely
the range that hid the last defect — a 23-day hand-built case. The honest
statement is that the battery is aimed at every failure class known to have
occurred on this module, that it finds none, and that it will find the next one
only if the next one resembles the last two.

**It also used to stop at ONE WINDOW, and that was the more serious of the two
limits.** `WINDOW_DAYS` is 30 and every exhaustive fixture anchors the signup
day at day 0, so 8-to-16-day calendars lived entirely inside window 0: the only
proof-grade sweep in the repository never saw the refill, never saw two lifters
re-converge at a boundary, and never saw a purchased day expire. It proved the
property for the sub-mechanism that was never in doubt.

*Closed, and here are the numbers.* The same judge, the same calendars, at
`MONOTONICITY_SWEEP.BOUNDARY_CROSSING_WINDOW_DAYS` = **7**, where every calendar
straddles at least one boundary and the longest straddles two — run twice, once
with no purchases and once with covered days bought on fixed calendar days so
that a purchased day is credited in one window and expires in the next.

| L | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|
| pairs, each arm | 1 024 | 2 304 | 5 120 | 11 264 | 24 576 | 53 248 | 114 688 | 245 760 | 524 288 |
| consumed, no purchases | 452 | 1 264 | 3 344 | 8 512 | 20 988 | 50 368 | 118 352 | 277 888 | 644 288 |
| consumed, with purchases | 500 | 1 392 | 3 700 | 9 480 | 23 836 | 58 648 | 141 236 | 326 236 | 750 632 |
| violating pairs, both arms | **0** | **0** | **0** | **0** | **0** | **0** | **0** | **0** | **0** |

Zero on `currentStreak`, on lifetime best and on both worst deficits, over
**982 272 pairs per arm**. The first cut of the purchase arm was **vacuous** and
said so by accident: funded through `coveredDayPurchaseDays`, a sixteen-day
calendar accrues one Chalk against a price of three and buys nothing, so both
arms reported byte-identical consumption. The fixed buy days
(`BOUNDARY_CROSSING_PURCHASE_DAYS`) are what make the third row differ from the
second, and the test asserts that it does.

**The with-purchases row dropped when the doomed-sale refusal landed** — its
total fell from 1 414 748 to 1 315 660 — and it dropped for the reason the
refusal exists. Some of those fixed buy days fall inside an absence that has
already ended the run; the store will not sell into one, so those covered days
are never bought and never burned. The no-purchase row is unchanged, which is
what says the drop is the store rule and not a change to the absence rule. Both
arms stay at zero violating pairs.

This is `drive`-only — `streak.ts` reads `RECOVERY_ENTITLEMENT` as a module
constant and cannot be driven at another window length — so it reaches the
shipped engine only through the pin.

What holds, and is what the design leans on:

- **Opening the app during an absence is exactly neutral.** Not "neutral except
  for a disclosed spend" — neutral. Same streak, same balance, same consumption,
  whenever they look and however often. This is the invariant §4.2 records and
  `src/game/streak.test.ts` asserts by full state equality, including with
  grants landing mid-absence.
- **An absence costs a fixed amount, decided before it began.** Whether it saved
  the run or not, the charge is set by what was armed at the last session, so it
  cannot grow while the player is away.
- **Training a superset of another lifter's days never ends below them** —
  exhaustively, over every eleven-day calendar at every balance up to the hold
  cap.
- A save preserves the streak **exactly**. A Recovery Day protects a run; it
  never partially resets one.
- With protection declined in settings, one more trained day never lowers the
  streak, the best streak or the balance — exhaustively, over every ten-day
  calendar.

---

## 5. Gym Empire Specification (v2)

**Status:** Design, ready for implementation scoping. Replaces the shipped §5
entirely at the data-model level. **Written** after the v1 screen was reviewed
and found to be a different game from the one intended. All design questions
from the prior draft are resolved (§5.12).

**Implementation status.** `src/empire/` currently implements the PRIOR §5 —
v1: one gym that levels up, subsections 5.1 Loop / 5.2 Production / 5.3 NPC
Lifters / 5.4 Expansion Axes / 5.5 Social Layer — preserved verbatim in git
history at `c7b4835`. Code and comments citing "§5.1"–"§5.5" refer to that
spec. Stages land per §5.11; each stage replaces the v1 modules it supersedes,
and the v1 invariant sweeps stay green until the module they measure is
replaced.

**Stage 1 PASSED its gate** (played 2026-08-19, via the dev view at
`ladder-dev.html`). Rulings from the play-through: equipment travels with a
relocation and the space is what is abandoned (recorded at the flag in
`ladder.ts`); the warehouse jump's measured emptiness — decision density
falling to zero after the last purchase, ~38 pure-collection check-ins — is
ACCEPTED rather than tuned away, because it is the exact gap stages 2–3 are
designed to fill and a cost trim now would be thrown away when they land. The
skeleton was confirmed as the intended game: the relocation press and the
rack purchase are the two moments where design intent became legible
consequence.

### 5.0 Why this replaces rather than extends

The shipped §5 models **one gym that levels up**: one equipment ladder, one
roster, one reputation number, one income stream. Every invariant, sweep and
census in `src/empire/` is written against that shape.

This spec models **a business you grow**: you start with almost nothing, you
acquire and outgrow locations, you eventually hold several at once, and the
place you train is a place you own and built.

`EmpireState`'s shape does not survive that change. What survives is listed in
§5.10 — and it is a lot, including every safety guarantee and the entire
verification methodology.

**Non-goal for v1 of this spec:** anything social. Friends training with you is
explicitly deferred (see §5.9). Nothing in the core loop may depend on it.

### 5.1 The shape: a ladder that becomes a portfolio

Both, in sequence. This is the answer to "progression or portfolio" — it is a
ladder first, and the ladder's top rung lets you keep the lower ones by
switching what "moving up" means.

**Phase 1 — The Ladder (early game).** You **outgrow** locations. Each move is
a full relocation: you leave the old place behind.

| Rung | Location | Feel |
|---|---|---|
| 1 | **Garage** | A bar, some plates, a bench. No members. Nobody knows you. |
| 2 | **Storage Unit** | Space for a rack. Two or three people pay you to train here. |
| 3 | **Strip-Mall Unit** | A real address. Real members. Real rent. |
| 4 | **Warehouse** | Room to specialise. This is where the game opens up. |

The ladder is **linear and one-way**. You do not run a garage and a warehouse
simultaneously in phase 1 — you move, and the old space is gone.

**Phase 2 — The Portfolio (mid/late game).** At the Warehouse rung, the rule
changes: **you stop moving and start acquiring.** The Warehouse becomes your
**Home Gym** — permanently — and further locations are bought *in addition*.

Acquired locations are managed, not inhabited: they generate income, hold
members, and carry their own equipment, but **your lifter does not train
there** (see §5.3). They also require real decisions (see §5.7) — they are not
set-and-collect.

This split is the point. It keeps early game intimate and legible — one place,
your place — and lets the late game be an empire without ever making the
player choose which of eight gyms to walk into.

### 5.2 The two things a gym produces

Every location produces two distinct outputs, and the tension between them is
the core decision.

**Money** — from members paying dues. Scales with member count, which scales
with space and equipment quality. This is the business layer.

**Capability** — what your lifter can *do* there. Determined entirely by what
equipment is present. This only applies to your Home Gym.

A commercial-grade cardio bank is excellent for money (members love it) and
irrelevant to a powerlifter's total. A monolift is the reverse. **Every
purchase is simultaneously a business decision and a training decision, and
the optimal answer to each is usually a different piece of equipment.**

That's the game.

### 5.3 Where your lifter trains

**Always the Home Gym.** Never an acquired location.

This is a deliberate simplification with real payoff:

- It avoids a "which gym today?" menu that would be tedious daily friction.
- It makes the Home Gym's equipment loadout personal and load-bearing — you
  built this room, and it's the room you lift in.
- It cleanly separates the two layers: **Home Gym = capability + income.
  Acquired locations = income only, managed remotely.**

Acquired locations still matter enormously — they fund the Home Gym, and
neglecting them has real consequences (see §5.7).

### 5.4 Equipment: capability gates activity

Equipment is grouped by what it unlocks, not by a single quality ladder.

| Group | Example items | Unlocks |
|---|---|---|
| **Barbell** | bar, plates, rack, platform, monolift | Squat / Bench / Deadlift — the competition lifts |
| **Accessory** | dumbbells, cables, machines | Hypertrophy work (folded into the flexible pool — §5.5) |
| **Conditioning** | bike, rower, sled, treadmill | Cardio |
| **Recovery** | mats, bands, foam rollers, sauna | Mobility / stretching / yoga |
| **Support** | chalk bowl, belts, sleeves, specialty bars | Modifiers to the above |

Each item carries three numbers: **cost**, **member appeal** (money), and
**capability** (what it unlocks or improves). A fourth applies to every item
regardless of type: **condition**, which decays over time (see §5.7).

**Design rule:** no single item should be best at both money and capability.
If an item is the top money choice *and* the top training choice, its numbers
are wrong.

### 5.5 Sessions: a guaranteed base plus a real choice

**Four powerlifting sessions per week are fixed and guaranteed** — they do not
compete with anything else for a slot. This means total growth never stalls
because a player forgot to program strength work; the core loop of "get
stronger" always has a home.

**Beyond those four, the player allocates 3 additional sessions per week** —
7 total, matching a real training week — across cardio, hypertrophy,
stretching, yoga, and other recovery modalities. These affect:

| Activity | Requires | Primary effect |
|---|---|---|
| **Cardio** | Conditioning equipment | Raises recovery rate — fatigue clears faster between sessions |
| **Hypertrophy** | Accessory equipment | Raises the *ceiling* e1RM can grow toward. Slow, compounding — folded into the flexible pool rather than kept as a separate fixed track. |
| **Stretching / Yoga** | Recovery equipment | Reduces injury risk; improves technique quality at depth |
| **Other recovery modalities** | Recovery equipment, higher tiers | Compounding, slower effects — detail TBD |

Three sessions across four-plus competing uses is the actual allocation
puzzle: a player chasing a faster total-growth ceiling trades off against
recovery capacity and injury risk, and there's rarely room to do all of it in
one week.

**Constraint carried forward from the current build, non-negotiable:** none of
this may be purchasable. Accelerated or purchased currency must never buy a
training outcome — the wall-clock/accelerated funding split applies unchanged
(see §5.10).

### 5.6 Members: not a number

Members are the business layer's life, and they push back.

**They generate income.** Dues scale with count and satisfaction.

**They have satisfaction**, driven by: equipment-to-member ratio (crowding),
equipment **condition** (see §5.7 — a decayed gym repels members before it
fails outright), and whether the gym has what they came for. Unhappy members
leave, and leaving is visible — the count drops and you have to find out why.
This relationship is identical at the Home Gym — the player's constant
presence does not soften it. A neglected Home Gym loses members exactly as an
acquired location would.

**They have types**, and the mix is a consequence of what you built:

| Type | Attracted by | Pays | Quirk |
|---|---|---|---|
| **Casual** | Cardio, machines, clean space | Low, reliable | Leaves fastest when crowded |
| **Bodybuilder** | Dumbbells, cables, mirrors | Medium | Occupies equipment for a long time |
| **Powerlifter** | Racks, platforms, specialty bars | Medium | Raises gym **reputation** fastest |
| **Athlete** | Conditioning, open space, sleds | High | Seasonal — leaves and returns |
| **Serious Lifter** | A bit of everything, good condition | High | Slow to arrive, very slow to leave |

**Reputation** is earned mostly by powerlifter and serious-lifter members, and
by your own competition results. It gates: what sponsorship deals you're
offered, which locations you can acquire, and the arrival rate of the
high-paying member types.

**Design intent:** the member mix should be a *readable consequence* of your
equipment choices, so a player looking at their roster can tell what kind of
gym they've accidentally built.

### 5.7 Active management: staffing, maintenance, and failure

This is the section that makes acquired locations a real system rather than a
number that goes up. It is also the section with a hard constraint that
overrides convenience: **nothing here may punish the player for being away.**
That rule is absolute elsewhere in this build (CLAUDE.md, Hard Design
Constraints) and applies here with full force.

**Staffing.** Acquired locations need a manager — you are not there. Managers
are hired, not generated:

- **Cost** to hire, and an ongoing wage.
- **Quality**, which affects how well the location runs unattended: a bad
  manager lets condition decay faster and mishandles member complaints; a good
  manager actively maintains satisfaction and flags problems.
- The Home Gym **never needs a manager** — you run it yourself, in person.

Staffing is a genuine tradeoff: the cheap manager is cheap, and it costs you
later.

**Maintenance and condition decay.** Every piece of equipment, everywhere
including the Home Gym, has a **condition** that decays continuously and
**auto-deducts from income** as it falls — no player action is required for
decay to happen or to matter.

Reversing it requires an explicit **repair decision**: spend money to restore
condition. At acquired locations, a good manager can handle routine repairs
autonomously (see Staffing); a bad one won't, and it piles up.

**Failure — and the rule that shapes it.** A location can fail. This is real,
and it's the stakes this whole system exists to create. But it must fail for
the right reason.

**Failure is driven by accumulated bad *decisions* made while the player was
actively engaged with that location — never by elapsed time or by the player
simply not opening the app.** Concretely: repeatedly hiring the cheapest
available manager despite visible warning signs, ignoring an in-session
maintenance prompt more than once, or actively declining a repair you were
shown and told the cost of. A location does not decay toward failure on a
background clock while you're gone; it decays toward failure because of
choices you made and were told the consequences of.

**Confirmed.** Active decisions only, never elapsed time — this is settled
design, not a proposal.

**THE TWO SENTENCES ABOVE ARE SEPARATE MECHANISMS, AND CONFLATING THEM WAS A
MEASURED DEFECT.** Condition decays with operation; failure accrues from
decisions. The first implementation chained them — low condition gated the
maintenance prompt, the prompt was where strikes arrived, so wear fed failure
— and because wear was keyed to banked operation, absence and check-in
frequency both leaked into failure progression through that chain. Measured
inside the catch-up horizon on a six-policy sweep: 1022 failure-progression
mismatches, 155 of them on runs whose decision traces were identical. Ruled:
**low condition may SHOW a repair prompt; it may not advance a strike or
dormancy.** A strike comes only from a decision the player was shown and made
— a declined or ignored repair, the cheapest-manager pattern, the other named
shapes — taken while the player was present. Failure is never a background
clock and never "you did not open the app". Condition and income still move
with operation, because a gym that ran wore its equipment and a gym that
idled did not; that is one clock, not a second one.

**WHAT THE MAINTENANCE PROMPT ACTUALLY IS, AFTER THE CHAIN BREAK — a design
detail that changed, recorded here rather than left in the code.** The prompt
is no longer a low-condition alarm. It is a **scheduled maintenance review**:
the gym raises one standing repair order every N check-ins, whatever the
equipment's condition, and condition decides only **which** item the review
names and what the repair costs. That is what "low condition may show a
prompt, and may not advance a strike" turned into once the strike path had to
be free of wear: an alarm that fires when wear crosses a line is a wear
crossing on the path to every counted decision, and no ledger rule removes it.
A player who answers the review keeps a sound gym and never accrues a strike;
a player who refuses one accrues exactly one, per order, until the item is
repaired. `src/empire/management.ts` header §3a has the derivation and the
measurement.

**THE EQUAL-STRIKE SENTENCE IS WITHDRAWN, BY HUMAN RULING. The first
sentence stands and is met; the second was never implied by it and pulled
against it.** An earlier draft of this clarification also asked that "two
histories differing only in how often the player checked in must produce the
same strikes on the same calendar". That is deleted rather than deferred, and
the reasoning is recorded because the numbers it generated are still in the
tree.

*What is actually required, and is met.* Failure is counted decisions taken
while the player is present — never a background clock, never absence.
Measured inside the catch-up horizon on the six-policy sweep: **0 / 0 / 0**,
matched-trace included, against the condition-gated model's **310 / 186 /
124** kept runnable as `condition-gated-prompt-control`. Ranking inside the
maintenance pool does not leak wear into whether a refusal counts, because
countability reads `unanswered.length > 0` — a count, not a condition.

*Why equal strikes does not follow from it, and fights it.* A strike needs a
check-in to take it, so more visits means more chances to answer or refuse;
that is the definition of a counted decision, not a defect in one. Forcing
the two totals equal buys it exactly two ways, and both are worse: phantom
strikes accruing while the player is away, which breaks the first sentence
outright, or extra refusals that are shown and then do not count, which
changes what a review costs and makes the shown price a lie. **A cheapskate
who checks in more, refuses more, and collects more strikes is the mechanic
working. An idle gym failing because the clock ran is the thing that is
forbidden.** Those are different, and this document is not to flatten them
again.

*The 909 and 524 are kept as what the withdrawn sentence WOULD have measured,
and are not a shipped violation.* The engagement family reads 909
failure-progression mismatches and 524 phase-worse readings. They fell from
the condition-gated model's 1187 and 730 — the review ordinal improved them
rather than costing them, which was not the direction the round that
specified it predicted.

*§12.3 still applies, and it is the bar that was met rather than a softer
one.* The player who shows up more must not end **worse** — phase, failure,
money or condition — under a fair policy. The catcher is
`engagementEagerTurnaroundControl`: the player model this build removed, kept
runnable, differing from the shipped model on one axis. Thirteen of its
fifteen counters are byte-identical to the shipped family; only the two money
counters move, and they are pinned at **36** (`variantNetLower`) and **21**
(`matchedTraceNetLower`) as the unfixed-path numbers the shipped zeros are
zero against. Do not upgrade "same strike count" back into a refusal
condition.

**Failure is recoverable.** A failed location goes dormant — income stops,
condition keeps degrading, members leave — but the asset itself isn't gone. A
sufficient recovery effort (staffing turnaround, a real repair investment)
brings it back online. This keeps the stakes real without creating a
permanent, un-appealable loss from what could still be a single bad stretch of
decisions.

### 5.7A The loop is genuinely idle: real wall-clock time, one clock, no mint — REWRITE, BY HUMAN RULING, SUPERSEDING PART OF §5.7 ABOVE AS WRITTEN

**This section replaces the "open up for the day" mechanism §5.7 above was
written against.** A human played the shipped build and named the defect
directly: *"Why are there taps? ... 'open up for the day' causes a 12-hour
shift. That is the bug."* The design direction that followed, also verbatim in
substance: Gym Empire takes direct inspiration from and mimics
**Idle Fitness Gym Tycoon** — a real, published mobile game, named here as a structural
citation to the mechanic being borrowed (wall-clock idle accrual with an
offline cap, no purchasable bypass of that cap, no gacha, no forced ads) and
not as an endorsement, a license, or a claim about that game's specific
numbers, art, or copy, none of which this build reproduces. Differences by
design: this build renders in the sprite-based Nintendo-nostalgia style
already set for the lift screen and meet-day cut-ins (§7), and the subject is
powerlifting, not general fitness. This citation names the source rather than
dressing it up, in the same structural register `src/career/flight.ts`'s
header uses for the real federation rulebook it implements — see that file's
own citation for the house style. **This name is never shown to a player.**
Every string a player can read in `src/empire/` is grepped for it as part of
this round's own verification, and the grep returns nothing.

**The mechanism, restated so it cannot be read as three coincidentally
agreeing systems.** Before this ruling, the only thing that ever advanced the
gym's clock was a tap — "open up for the day" — and every tap minted a flat,
fixed block of hours regardless of how much real time had actually passed.
That is a check-in-to-earn shape, and it is exactly what a human player
correctly called a bug. **There is now exactly one mechanism**: the gym's
clock advances only by genuinely elapsed real wall-clock time, capped and
fractioned precisely as this document's existing offline-earnings rules
always specified (§5.10's aggregate cap, unchanged in its own arithmetic —
this is not a new economic model, it is the existing one finally driven
honestly rather than by a mint). That one real-time reading is then reused
for three things that used to be described as separate:

- **Money** — production accrues on real elapsed time, capped at the offline
  horizon exactly as §5.10 states.
- **Equipment wear** — condition decays with the same real elapsed operation
  that paid the income, which is what makes "the gym ran, so it wore, so it
  cost" a single sentence about a single clock rather than two rules that
  happen to move together.
- **The maintenance-review cadence** (§5.7's "standing repair order") — WHEN
  the review is next raised is now also read off the same real elapsed time,
  not off how many times a player happened to tap a button.

**What this costs, disclosed here because the design doc is the place a
disagreement with an engineering trade-off gets ruled on, not buried in a
code comment.** Making the review cadence real-time-keyed necessarily makes
it sensitive to how long a real gap between two check-ins was — and that is
new tension with §5.7's own sentence, a few paragraphs above, that failure
must never move "by elapsed time or by the player simply not opening the
app." Measured (`src/empire/management.ts`'s header §3g, `management.test.ts`'s
`EXPECTED_SWEEP.families`): a genuinely long absence — a gap already at or
past the offline cap, made longer — still cannot move a review, a strike, or
a failure phase by any amount, on any player-behaviour model; that half of
the never-punish sentence holds without qualification. What changed is
narrower and still real: a SHORT gap, still under the offline cap, enlarged
by a few hours, can now shift which check-in the review lands on, because
real seconds bank in full below the cap — the same thing money and wear
already did. That reopened a failure-progression channel a prior round had
closed to exactly zero (`withinHorizon.all.failureMismatches` moved from 0 to
1401 across the swept battery). **This is recorded as an open engineering
trade-off this round did not have the authority to resolve on its own**, not
as a defect quietly accepted: cadence keyed to real time is what "one clock"
requires, and the sentence above is what it costs. A future round revisiting
this needs to either accept the trade-off explicitly, or find a mechanism
that keys cadence to real elapsed time without letting short-gap size affect
where a review lands — neither is a small change, and this document should
not claim more than what is currently true.

**Taps that remain, restated as a closed list.** Buy equipment. Place it on
the floor. Repair an item. Hire or dismiss a manager. Answer a maintenance
review (repair it, or decline it — both are real decisions with a shown
cost). Recover a dormant gym. Relocate up the ladder. Every one of these is a
decision the player takes and is shown the consequence of before taking it,
per §5.7's own "told the cost of" standard.

**Taps that are gone, restated as a closed list of one:** anything that mints
or advances the clock. There is no control anywhere in Gym Empire whose only
effect is to make time pass faster or to credit a block of banked operation
on press. **Watching the floor is the game** — GDD §5.13's floor simulation,
already built, is the primary experience of an open gym: equipment in use,
members moving, condition and money changing in front of the player without
a tap, exactly as the reference genre plays. The taps above are the economic
layer built on top of that floor, not a replacement for watching it run.

**§5.7's failure rule is now trivially true in one direction it was not
provably true in before.** Since no tap anywhere mints or advances the clock,
no tap can trigger the failure machinery except the three named decision
shapes §5.7 already lists (a declined repair, a repeated dismissal, a
cheap-hire-under-warning) — there is no fourth kind of press left that could
smuggle in a clock advance disguised as something else.

**Explicit refusal conditions, naming the specific route rather than trusting
the general rule to cover it by implication — every one of these is CLAUDE.md's
existing Hard Design Constraints, restated here for this subsystem because
the check-in-to-earn genre this build now resembles is exactly where these
constraints are most commonly violated in the wild, and a reader of this
section should not have to infer the coverage:**

- **No purchasable extension or bypass of the offline-earnings cap, ever.**
  Nothing purchasable may lengthen the offline-banking horizon, multiply
  earnings past what real elapsed time already produced, or otherwise let
  money buy a faster or bigger accrual than the real clock alone would give.
  This is "nothing purchasable may affect training pace" (CLAUDE.md, no
  pay-to-win) read to already forbid the single most common monetisation
  pattern in this exact genre — an IAP that removes or extends the offline
  cap — and it is written explicitly here so it is never treated as an
  open question by a later round.
- **No gacha, restated for this subsystem.** NPC and manager recruitment stay
  deterministic — flat cost or a reputation threshold — with no random pull
  and no rarity tier behind currency, exactly as CLAUDE.md's existing rule
  already requires tree-wide.
- **No forced ads, restated for this subsystem.** Any ad path this loop ever
  grows is rewarded-only, per CLAUDE.md's existing rule, and specifically:
  no ad may be the only way to clear the offline cap or to unlock a tap this
  section lists as gone.

### 5.8 Sponsorships

Reputation unlocks equipment-manufacturer sponsorships. A sponsor provides
discounted or free equipment of their type, in exchange for their branding
appearing in your gym.

**All manufacturers are fictional.** This is not a stylistic choice — the
project has a hard rule against real brand names in shipped source
(`realIp.ts`, and the naming work that produced Cragmoor and Orrenford). Real
manufacturer names require actual licensing agreements and are a business
conversation, not a design one.

**Architecture requirement:** the sponsor system must be data-driven such that
a fictional manufacturer could be swapped for a licensed real one by changing
data, never code. That keeps the door open without betting on it.

Sponsors should have personality — a boutique Scandinavian-feeling brand whose
bars are excellent and expensive, a bulk commercial supplier whose machines
members love and lifters don't, a scrappy domestic brand with great value and
inconsistent quality. Choosing a sponsor should feel like choosing an identity
for your gym.

### 5.9 Deferred: social

Friends training in your gym is **explicitly out of scope** for this spec.

It requires real accounts, shared state, and a backend that does not exist
(V1 is still "shaped for Edge Functions," unbuilt).

**Design constraint so it can arrive later without a rewrite:** the Home Gym
must be able to hold a list of *present lifters* that is not the member roster
— NPCs today, real friends later. Nothing in the core loop may read that list
as required input.

### 5.10 What survives from the shipped §5

This is a data-model replacement, not a bonfire. Carried forward intact:

**All safety guarantees.** The wall-clock/accelerated funding split, the
"never sell power" constraint, currency provenance, the rule that purchased
currency cannot buy training progression. These are properties of *how value
flows*, not of how many gyms exist, and they apply with more force here — a
portfolio generating income is a bigger attack surface than a single gym.

**The offline-earnings cap, now aggregate.** The cap and fraction apply once,
across the whole portfolio, via a single wall-clock timer rather than one per
location — fed by *summed* production across everything owned. This is a
genuine simplification with a real bonus: the existing capped-catch-up
implementation, already adversarially hardened across many rounds, is reused
almost unchanged. It only needs to read a portfolio-wide production sum
instead of one gym's rate — the mechanism itself doesn't need to be rebuilt or
re-proven from scratch.

**The economic primitives.** Production accrual, tier-based output scaling,
deterministic recruitment cost.

**The entire verification methodology.** The domain-family rules, the
witness/domain principle, Form That Survived, the isolation discipline, the
grammar-over-reflection reformulation. None of it is tied to one gym. All of
it applies to the new model, and it is the reason a rebuild is cheaper than
the original build was.

**What does not survive:** `EmpireState`'s shape. It models one gym's stats.
This needs a portfolio of locations each with their own state, a Home Gym
concept, and a member/staffing/maintenance simulation that doesn't currently
exist.

### 5.11 Build order

Deliberately sequenced so each stage is playable before the next begins — the
failure this spec exists to correct was building a large system that was never
playable at any point.

1. **The ladder, minimal.** Four rungs, relocation, money accumulating, one
   equipment group. Playable: you can move up.
2. **Sessions and equipment groups.** Capability gating, the fixed four plus
   the flexible pool, attribute effects wired into the existing fatigue model.
   Playable: the training/business tension exists.
3. **Members with types and satisfaction.** The business layer becomes a
   simulation rather than a rate. Playable: your gym has a character.
4. **The portfolio, with staffing and maintenance.** Acquisition, per-location
   management, condition decay, the failure state. Playable: it's an empire,
   and it has real stakes.
5. **Sponsorships.** Fictional manufacturers, reputation gating, identity.

**Gate between each stage: it must be playable, and a human must have played
it.** That is the specific thing that went wrong the first time — five rounds
of grading a screen nobody could play.

**RULED, AFTER THE FIRST REAL DEVICE PLAYTEST: "PLAYABLE" WAS BEING SATISFIED
MECHANICALLY BUT NOT PRESENTATIONALLY, AND THE GATE DID NOT CATCH IT.** Stages
1–2b were built and gated against a render-only view (`ladderView.tsx`'s
`GymView`, later ported to a genuine native `GymScreen.tsx`) that is correct —
every number on screen is a real read of `ladder.ts`/`sessions.ts`, every
interaction dispatches a real action, and it has been driven end to end on a
real phone via `AppShell.tsx`'s new `'gym'` surface. It is also, in the
playtester's own words, "a settings page" rather than a mode — no sprites, no
gym scene, nothing a player would recognize as belonging to this game rather
than to a debug harness. **The stage gate's own text — "playable, and a human
must have played it" — does not distinguish those two things, and this is the
first time the distinction mattered enough to be visible.** A gate that checks
"can a human operate this" is not the same gate as "does a human recognize
this as the game," and §5.11 was silently treating the first as proof of the
second.

**Standing until this is addressed: no further §5 logic work lands on top of
the current build.** Everything through stage 2b (ladder, equipment, sessions,
the staffing/maintenance groundwork already in `empireCore.ts`) is complete and
heavily verified at the logic layer — that verification is real and stands.
What does not stand is treating any of it as shippable, or treating stage 3
onward as clear to start, while the presentation layer is unbuilt. The next
piece is the presentation layer itself — sprites, a real gym scene, whatever
makes this read as a mode rather than a settings page — scoped and built as
its own deliverable, not folded silently into whichever logic stage comes
next. Until that piece exists and has itself been played by a human, no
further §5 stage may be graded "playable" on mechanical correctness alone;
the stage-gate playtest going forward has to answer the presentation question
explicitly, not just "did the controls work."

### 5.12 Design questions — all resolved

All open items from the prior draft are settled:

- **Hypertrophy:** folded into the 3-session flexible pool (§5.5).
- **Flexible sessions:** 3, beyond the fixed 4 — 7 total (§5.5).
- **Failure-state trigger:** confirmed as active decisions only, never
  elapsed time (§5.7).
- **Failure severity:** recoverable, not permanent (§5.7).
- **Home Gym decay/satisfaction:** identical relationship to an acquired
  location; player presence does not soften it (§5.6).

No open design questions remain. This spec is ready to move to implementation
scoping.

### 5.13 Presentation layer (RCT-style floor sim) — PHASES 1, 2 AND 3 BUILT
### AND GATED IN ON A REAL PHONE. PHASE 4 (16-BIT ART) IS IN BUILD.

Submitted in response to the 5.11 ruling above: a spatial floor the player
builds into, populated by NPCs with visible state, in the direction of
RollerCoaster Tycoon rather than a settings page. Confirmed scope: **direct
placement** (drag equipment onto a floor grid — layout is a real decision) and
**real member behavior** (members walk, queue, use equipment, visibly react —
not ambient population density). `src/art/gymScene.ts`'s existing rendering
is a passive camera-only parallax backdrop built for a different job and is
not reused here in any load-bearing way. Needed: a grid-based floor
representation, placement mechanics (drag/validate/move/remove/persist),
equipment sprites, member sprites with pathing and a visible state machine,
and a real pan/zoom camera over the grid.

**Hard constraint, unchanged from every other piece of §5: this is
presentation, not a second source of truth.** It reads owned equipment,
member count/type, and satisfaction from the real economic state and may
*display* consequences of it; it does not maintain its own copy of anything
progression-affecting.

**Build order, gated exactly like §5.11 itself — the discipline this section
exists because it wasn't applied here the first time:**

1. Grid + placement alone. No members, no final art. Gate: does placing
   things feel good?
2. Ambient members at fixed positions, static or idle-animated, from real
   count/type data. Gate: does the gym read as populated and alive?
3. Real pathing, queuing, use, and visible reaction. Gate: does watching the
   gym run feel like the reference, or like members-shaped set dressing?
4. Real pixel-art pass, once 1–3 have proven the system worth finishing.

Art direction: 16-bit, Nintendo-adjacent — the existing style set for the
lift screen and meet-day cut-ins, extended to a new surface, not a new
decision. Phases 1–2 build against placeholder shapes; committing final art
to a layout system that might still change shape wastes budget on a moving
target.

**GROUNDING CHECK AGAINST THE REAL TREE, DONE BEFORE ANY OF THIS IS BUILT,
BECAUSE THE SUBMITTED SPEC DESCRIBES SEVERAL THINGS AS ALREADY-COMPUTED THAT
ARE NOT YET CODE.** `src/empire/` was read, not assumed, before writing the
proposals below:

- **Member types, satisfaction, and equipment condition are §5.6/§5.7 design
  prose only — stage 3 and stage 4 of §5.11's own build order, both paused by
  this section's ruling above.** `grep -rn "satisfaction\|MemberType" src/
  empire/` finds nothing. Phase 1 (grid + placement, reading only
  `sessions.ts`'s real `GymState.sessionEquipment`) needs none of this and can
  proceed. **Phases 2 and 3 as written cannot** — "members appear at fixed
  positions based on real count/type data" and "visible reaction states tied
  to the existing satisfaction mechanic" both name state that does not exist
  in code yet. This is the one item that needs a human ruling before Phase 2
  is scoped, not something this section can resolve by itself: it would mean
  either building stage 3's member/satisfaction logic now, as a named
  exception to the pause because Phase 2 of an approved piece structurally
  depends on it, or holding Phase 2 until stage 3 is separately unpaused.
  Recorded here rather than decided here.
- **The Barbell equipment group — the competition lifts, GDD's own first row
  of §5.4's table — has no ownable state in code.** `SESSION_ACTIVITY_GROUPS`
  in `empireTuning.ts` is `['conditioning', 'accessory', 'recovery',
  'support']`, four groups, not five; the fixed four powerlifting sessions
  never gate on owned equipment, so a bar/rack/platform is assumed always
  present rather than purchased. A floor built purely from real ownership
  state has no barbell equipment to place at all under the current model.
- **No `condition` field exists on any equipment item.** §5.4's own table
  names it as one of four numbers every item carries; it is stage-4 (§5.7,
  also paused) and does not exist in `SESSION_EQUIPMENT_ITEMS`'s tuning today.
- **`GymState.sessionEquipment` (`sessions.ts:554`) is a flat, position-less
  list that refuses a duplicate item outright** (`requireSessionEquipment`
  raises `"... is held twice"`). Phase 1 needs a real state addition — at
  minimum a position per owned item — and if placing two of the same item is
  wanted, that is an economic-model change (what a purchase means), not a
  presentation one, and needs to be named as its own decision rather than
  folded into "add positions."
- **"Sprint 2's schema-versioned persistence work," named in the submitted
  spec as where layout data should live, does not exist anywhere in this
  repository.** `grep -rn "schemaVersion\|Sprint" docs/GDD.md CLAUDE.md
  src/empire/ src/game/` finds no such system. Either this refers to
  something outside this repo's visibility, or it has not been built yet —
  flagged rather than guessed at.

**The three items the submitted spec explicitly asked Session B to propose,
answered here for review — none are built yet, all are provisional:**

- **Grid dimensions per location**, reasoned from real-world footprint
  intuition and scaled to the equipment cumulatively unlockable by that rung
  (2 items at garage, 6 at storage-unit, 13 at strip-mall-unit, 14 at
  warehouse, `SESSION_EQUIPMENT_MIN_RUNG` counted directly): **garage 8×6**,
  **storage-unit 12×9**, **strip-mall-unit 22×16**, **warehouse 40×28**, in
  abstract grid tiles rather than a literal foot conversion. Proposal only —
  not tuned, not played.
- **The layout-to-satisfaction formula.** Proposed as a multiplier on top of
  §5.6's existing satisfaction drivers rather than a new independent term, so
  it composes with that formula once stage 3 exists rather than competing
  with it: for each placed item, a placement-quality score in [0, 1] from (a)
  whether its spacing/clearance requirement is met and (b) path-distance from
  the floor's entry point, tapering rather than linear so a large warehouse
  isn't punished for its own size; aggregate to a single multiplier applied to
  the crowding/condition-driven satisfaction inputs. This can be designed now
  but not wired in until stage 3's satisfaction mechanic is real code to
  multiply against.
- **The pathing-interruption fallback**, when a member's target equipment is
  moved or removed mid-approach or mid-use. The spec frames this as a binary
  (re-target silently vs. abandon-and-react); proposed instead as a single
  additional transient sub-state inside the existing seeking → queuing →
  using → leaving machine: **interrupted**, entered whenever a target
  vanishes, holding a short fixed beat with a visible reaction cue (RCT's
  thought-bubble pattern), then always resolving back into **seeking**. This
  satisfies both stated requirements at once — never freezes or paths into
  empty space, and the interruption is legible rather than silent — without
  inventing a permanent fifth state or a real behavioral fork.

**RULED: stage 3 is unpaused as a named exception, scoped to Phase 2's actual
dependency.** Checked before ruling rather than assumed: the pause on stage
3/4 was pure sequencing, not an unsettled data model — §5.12 already states
"all design questions are resolved... none open," naming the §5.6/§5.7 items
specifically, and §5.7's failure state already has its enforcement mechanism
named (the never-punish sweep transfer). So building stage 3 now is executing
already-settled design early, not deciding anything new. The exception is
scoped to **stage 3 only** (members with types and satisfaction) — the
specific thing Phase 2 needs. Stage 4 (portfolio, staffing, maintenance,
failure) stays paused; nothing in the presentation build order through Phase
3 needs it.

**Status:** Phase 1 (grid + placement, no members) and stage 3 (members +
satisfaction, pure logic) may both proceed now, in parallel — neither depends
on the other. Phase 2 (which needs both) waits until Phase 1 has been played
by a human, per this section's own gate.

### PLAYTEST 2 — PHASE 1'S OWN GATE, RUN, AND NOT PASSED

The first real device playtest (recorded above, under §5.11) covered
Crossing 6's mechanics and found no presentation layer at all. This is the
second: the same player, on the real app, played Phase 1 itself — the grid
and placement work this section specified — through the same `GYM EMPIRE`
entry point. **Verdict: not a defect report, and not a pass.** The engine is
correct — every number and refusal the player saw matches what `floor.ts`
and `sessions.ts` actually compute, confirmed by reading the shipped code
rather than assumed — and the gate question this section asks, "does
placing things feel good?", cannot be answered yes to an empty rectangle.

**What the player saw:** a solid-colored box with no tile lines, captioned
"floor (garage) — 8x6 tiles, 0 placed, 0 unplaced," under a long shop/session
text dump, with an empty tray inviting a drag it cannot receive.

**Four concrete gaps, traced to real causes rather than guessed at:**

1. **Opening day has nothing to place.** A new gym's `sessionEquipment` is
   `[]` and `floor.ts` places only `SESSION_EQUIPMENT_ITEMS` — the stage-2
   items. The three rows that read as "owned" in the shop (power-bar,
   comp-plates, flat-bench) are Barbell-group items, and this section's own
   grounding check flagged before Phase 1 was built that **the Barbell group
   has no ownable state in this codebase at all** — it is the always-present
   baseline the fixed four sessions assume, never purchased, never a
   `SESSION_EQUIPMENT_ITEMS` member. So those rows were never going to be
   draggable, and nothing else is ownable on day one either: starting Gym
   Bucks is 0 until the player uses the dev clock-skip controls, so even the
   cheapest garage-legal buys (mats, wrist-wraps) are unreachable on a
   genuinely cold start.
2. **The drag prompt is a dead control** when the tray is empty — "drag onto
   the floor above" with nothing in the tray to drag.
3. **The grid does not read as a grid.** `FloorGrid.tsx` draws one solid
   `darkslategray` rectangle at `8 tiles × 6 tiles × 28px`; it never paints
   the tile boundaries the grid concept depends on.
4. **The floor is buried.** It sits below the full shop and week-allocator
   text, which is what a returning player needs but is not what a first
   frame should lead with.

**Ruled: Phase 1's gate is NOT met, and Phase 2 does not start.** This is the
same standing rule §5.11 already states, applied to its own next stage: a
mechanically-correct build that a human cannot recognize as a game does not
clear the gate that exists specifically to catch that. The fix stays inside
`src/empire/` (`floor.ts`, `FloorGrid.tsx`, `GymScreen.tsx`'s layout) —
presentation only, no new crossing, no change to the economy engine's real
numbers.

**The fix for gap 1, decided here because it is a presentation call rather
than a repeat of the original grounding question:** render the Barbell
group's always-present baseline as fixed, non-draggable floor furniture —
a bar/rack/bench occupying set positions from the moment a gym exists, drawn
but not part of `FloorState.placements` since there is no ownership or
position data for them to attach to. This closes gap 1 (a garage never
opens visually empty) and gap 3 (a floor with real objects on it reads as a
floor) without touching Gym Bucks, starting inventory, or anything
`sessions.ts`/`ladder.ts` compute — it is a rendering decision about
already-true state (the fixed four sessions already assume this equipment
exists), not a new grant. Gaps 2 and 4 are fixed directly: the drag prompt
is suppressed (or replaced with an explicit empty-state message) when the
tray is empty, tile boundaries are drawn, and the floor moves above the
shop/allocator text rather than below it.

**PLAYTEST 3, same opening frame, on a real phone: all four named gaps
confirmed closed, and the fix itself created two new small ones.** Fixed
furniture, real grid lines, the honest empty-tray message, and the
floor-above-shop order all read correctly on the device. What the fix
introduced, found only because it was played rather than only re-tested by
the driven check that already passed:

1. **The empty-tray message pointed the wrong direction.** "Buy equipment
   above" was correct before gap 4's reorder and wrong after it — the shop is
   now below the floor, not above. A directional word tied to render order is
   exactly the kind of thing that breaks silently the next time the order
   changes without anyone touching the string; dropped rather than corrected
   to "below" for that reason.
2. **"Nothing owned yet" read as a claim about the whole gym**, on a screen
   already showing three `(fixed)` items on the grid and the same three rows
   `owned` in the shop list. The word was accurate about its actual subject
   (`FloorGridProps.owned` is session equipment only) and false-reading about
   what the player was looking at. Reworded to name session equipment
   explicitly rather than say "owned" unqualified.
3. **The `0 placed, 0 unplaced` caption ignored the three visible fixed
   pieces**, correct about the placement table and confusing beside a floor
   that is not, in fact, empty. The caption now also states the fixed count.

All three are string-only fixes in `FloorGrid.tsx`, no logic change. The
furniture/session-item overlap gap named at gap 1's ruling above is still
open and was not exercised this pass (wallet was 0; no session item was
bought to drag).

**THE FURNITURE/SESSION-ITEM OVERLAP GAP IS RULED AND CLOSED.** Asked
concretely rather than left as a named-but-abstract gap: dragging a session
item onto a fixed-furniture cell was accepted silently, both at the data
layer (`placeFloorItem`'s overlap check never knew `fixedFloorFurniture`'s
table existed) and visually (the session item's opaque chip painted
directly over the fixed item's, since it rendered later in the tree with a
higher resting z-index — no refusal, no warning, no way to tell from the
screen alone that anything unusual had happened).

**The ruling: refuse the overlap, and refuse it in `FloorGrid.tsx`'s drop
handler, not in `placeFloorItem`/`FloorState`.** `floor.ts` gained one new
pure export, `overlapsFixedFurniture(position, footprint, fixed)` — the
same geometry `requireFloorState` already applies between two session
items, applied against the fixed-furniture table instead, taken as a plain
parameter and never threaded into `FloorState`. `FloorGrid.tsx`'s
`releaseAt` calls it before ever dispatching `floor-place`; on a hit, the
drop is dropped (nothing dispatched, so the dragged item snaps back to
wherever it came from) and the targeted fixed row shows a "can't place
here" message with a highlighted outline for
`FLOOR_OVERLAP_REFUSAL_FLASH_MS` (a new tunable, alongside the outline's
own border-width knob). `placeFloorItem`, `removeFloorItem` and
`FloorState` stay exactly as blind to fixed furniture as `fixedFloorFurniture`'s
own header already said — a `FloorState` built directly, or `placeFloorItem`
called directly the way `floor.test.ts` and `ladderView.tsx`'s own
reducer-level tests do, can still record an overlapping session item. What
closed is the one route a player can actually reach.

**Grepped, not assumed, that the drop handler is the only route.**
Every `placeFloorItem` call site in the tree was enumerated: `floor.test.ts`
and `empireForbiddenOutput.test.ts` drive it directly as pure-logic tests,
and `ladderView.tsx`'s shared reducer calls it inside its `floor-place`
case — but nothing in the shipped app ever dispatches a `floor-place` action
except `FloorGrid.tsx`'s own `releaseAt` (the only production call site,
confirmed by grep). `GymView`, the DOM stage-1/2 dev harness in the same
file, predates the floor entirely and has no floor-related rendering at
all. So refusing inside `FloorGrid.tsx` covers the whole reachable surface
without widening the reducer or touching the pure module's own contract.

**Regression coverage, at both the layer that changed and the layer that
didn't.** `floor.test.ts` drives `overlapsFixedFurniture` directly against
the real registered layout — a footprint sharing a cell with each of the
three fixed rows individually (so a predicate that only checked the first
row in the table can't pass by accident), a footprint merely touching an
edge (legal, the same boundary `placeFloorItem`'s own overlap check already
draws), a footprint entirely clear, and the vacuous case of an empty fixed
list. `tools/verify-floor-reachability.mjs` gained a browser-driven gap-6
check, run before its existing place/move/remove sequence (which now
targets a cell clear of every fixed row instead of the one it used to
share with power-bar): drag mats onto power-bar's cell, and assert the drop
is refused, mats stays in the tray, no `floorgrid-placed-*` chip exists
anywhere, and power-bar's own fixed-furniture chip is still drawn at that
cell. Independently re-verified cold-boot: 18/18, including that check.

**PHASE 1'S GATE IS MET, PER PLAYTEST 3 — RULED.** Playtest 3 is what this
section's own build order names as the trigger: a human, on a real device,
playing Phase 1 (grid + placement alone, no members, no final art). It
found two gaps the Playtest 2 fix had introduced and confirmed the
original four closed; both new gaps, plus the separately-named furniture/
session-item overlap gap, are fixed and independently re-verified above.
No further human pass has been run since, and none is required to record
this: the gate's own question — "does placing things feel good?" — was
answered on a real phone, against the shipped build, and the answer was
not "no," it was "close, then closed." **Phase 2 may proceed.**

**PHASE 2 IS BUILT AND ITS GATE IS MET — AMBIENT MEMBERS, FROM REAL COUNT/TYPE
DATA, JUDGED BY A HUMAN ON A REAL PHONE.** This section's own Phase 2 gate is
"does the gym read as populated and alive?", and that is a question for a human
on a real device, the same standard Phase 1 was held to. It was asked twice and
answered on the second pass — PLAYTEST 4 found the first build unreadable as
people and PLAYTEST 4b, after the fix, got a felt yes. Both are recorded at the
end of this section, in the order they happened, because the first one is what
makes the second one mean anything.

Three new entries in `empireTuning.ts`, all provisional in the exact sense
`FLOOR_GRID_SIZE`'s own comment already claims for itself — reasoned from
intuition, not tuned or played: `AMBIENT_MEMBER_COUNT_BY_RUNG` (garage 3,
storage-unit 8, strip-mall-unit 18, warehouse 40 — strictly increasing,
"garage sparse, warehouse populated"), `AMBIENT_MEMBER_FOOTPRINT_TILES` (a
1x1 placeholder body), and `AMBIENT_MEMBER_PLACEMENT_STRIDE` (3, a spacing
knob so bodies do not cluster in one corner of a big room). All three are
classified `knob` in `EMPIRE_TUNING_CLASSIFICATION`.

`floor.ts` gained one new pure export, `ambientMemberRoster(rung,
barbellOwned, sessionOwned)` — same pattern as `fixedFloorFurniture` above: a
plain read model, computed fresh on every call, never a `FloorState`, never
stored. Count is read off the new table by rung alone (no equipment-count
scaling in this first pass, though the signature already has room for one
later). Type mix is `equipmentBiasedMemberTypes(sessionOwned)` — GDD §5.6's
own function, not a second formula — cycled round-robin across whatever it
returns; the stated limit is that round-robin weights every biased type
equally and does not favour the first one, which is a design call for later.
Positions are chosen from the rung's own grid, scanned row-major and filtered
through `overlapsFixedFurniture` so no member is drawn standing on a fixed
furniture chip, with a stride-then-fallback scan so bodies spread across a
big room instead of packing the top-left corner. The stated limit, in the
function's own header: it avoids the FIXED Barbell furniture only, not a
player's own placed session equipment, because that state is mutable and this
function deliberately takes no `FloorState` — reading it would be a step
toward Phase 3's real pathing/reaction machinery, not a static Phase 2 body.
And, in the words the ruling that scoped this piece asked for: **if a later,
separately-serialised piece puts reputation on this screen's state, this
derivation can grow to use it; it must not grow to use it in this phase.**

Rendered in `FloorGrid.tsx` as simple placeholder circles, one small named
colour palette per member type (distinct from the session-equipment and
fixed-furniture palettes so the three visual classes read apart), each
carrying a `floorgrid-ambient-<index>` testID and a small
`floorgrid-ambient-caption` text reporting the count — not draggable, not
collidable with `placeFloorItem`'s overlap check, dispatching nothing.
`tools/verify-floor-reachability.mjs` gained a browser-driven check that on a
cold garage gym, reached the same way every other claim in that file already
is (press GYM EMPIRE, scroll to the floor, no debug query string), at least
one `floorgrid-ambient-*` body is actually drawn with a non-zero bounding
box — Presence is not visibility, so the check reads a real box, not just
attachment. It does not drive the warehouse case in the browser, since
reaching one requires a long grind through the dev clock-skip controls; a
unit test in `floor.test.ts` already drives the count-scales-by-rung claim
(a real `warehouse.length > garage.length` comparison, not two independent
pins) and that division of labour is stated here rather than left implicit.

Test coverage in `floor.test.ts`: the three tuning tables (keyed correctly,
strictly increasing, every rung has enough free grid cells for its own
registered count); `ambientMemberRoster` is deterministic (called twice on
the same inputs, byte-identical), returns exactly the registered count per
rung, every position fits inside the rung's own grid, no position overlaps
fixed furniture, the type mix is checked against the real
`equipmentBiasedMemberTypes` output rather than only a count, a different
owned-equipment set changes the mix, and an unregistered rung refuses loudly
rather than drawing nothing.

**PLAYTEST 4 — PHASE 2's OWN GATE, RUN ON THE STATE EVERY NEW PLAYER ACTUALLY
OPENS IN.** The same player, on a real phone, opened a fresh gym (garage, 0
Gym Bucks, no session equipment owned — opening day, not a played-in state)
and found the three ambient members reading as "small teal chips on a teal
grid... same colour family as the floor, static, no idle motion, no facing,
no body... extra tiles, not a population." Not a defect in the count or the
type mix — both were re-read from the shipped code and confirmed correct —
but a defect in what the count and type mix were drawn AS.

**Root cause, traced rather than guessed.** `equipmentBiasedMemberTypes([])`
— the exact call `ambientMemberRoster` makes on a garage's real
`sessionOwned` on day one, since nothing is owned yet — returns a single
type, `'powerlifter'`, computed by hand from `MEMBER_TYPE_BARBELL_AFFINITY`/
`MEMBER_TYPE_ITEM_AFFINITY` at the empty-equipment baseline (powerlifter
≈0.4167 against `MEMBER_EQUIPMENT_BIAS_TIE_TOLERANCE`'s 0.02 band; nothing
else clears it). Round-robin over a length-one list maps every roster index
to that one type, so all three garage-day members get the same colour — and
that colour, `AMBIENT_MEMBER_PALETTE[MEMBER_TYPES.indexOf('powerlifter')]` =
`'lightseagreen'`, is itself a dark cyan/teal, the same hue family as
`FLOOR_BACKGROUND_COLOR` (`'darkslategray'`). Every new gym's opening frame
drew three identically-coloured teal circles on a teal floor, which is
exactly what the player saw — and this is not a rare state, it is what EVERY
new player's first garage looks like, since opening day always has zero
owned session equipment.

**The fix: all three of the player's own named directions, built together
rather than singly.** (1) *Contrast* — `AMBIENT_MEMBER_PALETTE` replaced with
five colours with no teal/cyan/dark-slate-gray component (`'orange'`,
`'gold'`, `'hotpink'`, `'chartreuse'`, `'tomato'`), so a repeated single type
reads against the floor regardless of which type an empty inventory biases
toward. (2) *A distinct silhouette* — each member is now a two-part
placeholder body, a small circular "head" (a fixed neutral shade, `'white'`)
over a wider, shorter rounded-rect "body" (coloured by type), in place of the
one plain circle, within the same outer footprint. (3) *A tiny idle motion* —
each member now bobs a couple of pixels vertically on a continuous loop,
staggered per roster index across a small number of lanes so members read as
individuals rather than one mechanism moving in lockstep, and touches nothing
but its own additive `translateY` — `member.position`, the type mix, and the
count are all exactly as before. Every new sizing/timing value (head
diameter, body width/height fractions, corner radius, bob amplitude, bob
half-cycle duration, stagger lane count, stagger step) is a new named
`EMPIRE_TUNING` entry, classified `knob` — first-pass proposals, not tuned or
played, the same status every other rendering/timing knob in this section
already carries.

**What this round closed, written before the verdict existed.** The diagnosed
defect —
the colour-family collision on the single-type-on-empty-inventory state, the
plain-circle shape, and the zero motion, all three named by the player — is
fixed and verified: `tsc --noEmit` clean, the whole `src/empire` suite green,
and `tools/verify-floor-reachability.mjs` still passes every one of its
claims on a cold garage, including the three Phase 2 ambient-member claims
(real non-zero bounding boxes, no fourth body drawn, the caption reporting
the real count). This round closes the one concrete, diagnosed defect that made
"yes" impossible to answer on the last pass. Whether it earns a "yes" was left
to the next human phone pass — which is PLAYTEST 4b, below.

**PLAYTEST 4b — PHASE 2's GATE IS MET. RULED, ON A FELT YES FROM A HUMAN ON A
REAL PHONE.** Same player, same opening-day garage, after the contrast /
silhouette / bob fix above. Reached the way this section already requires:
cold launch, no query string, press GYM EMPIRE, scroll to the floor — a real
phone in a mobile browser over a public tunnel, not a dev harness. State on
screen matched opening day exactly: week 0, garage, 0 Gym Bucks, clock at
zero, the three fixed furniture pieces labelled, and the caption reading
3 member(s) around the gym.

The gate was asked in the form that actually tests it — **with the caption
covered**, so the tokens had to carry the read on their own rather than being
explained by a line of text under them. The verbatim answer: *"Yes they read
as people."*

That is the same standard Phase 1 was held to: a felt yes on a real device
against the shipped placeholder, not a suite pass. So the PLAYTEST 4 defect —
teal-on-teal, plain circle, zero motion — is closed **in the thing the player
actually saw**, which is a stronger claim than the unit tests alone could
support and the only one that settles this gate. **Phase 3 may proceed.**

Its gate, stated now so the next round is built against it rather than toward
it: real pathing, queuing, equipment use, and visible reaction — and the
question is *does watching the gym run feel like the reference, or like
members-shaped set dressing?* Phase 4 stays gated on 1-3.

**THREE THINGS THIS VERDICT IS NOT, and they bound it tightly.** It is not a
Phase 3 verdict: no pathing, queuing, use or reaction was on that screen to
judge. It is not a check of any rung above garage — storage-unit, strip-mall
and warehouse counts (8 / 18 / 40) have still never been seen by a human. And
it is not a claim that three same-colour tokens are the finished population
mix; that sameness is the empty-inventory powerlifter bias diagnosed under
PLAYTEST 4, correctly reproduced, not a new defect. The relaying session also
ran neither the suite nor `verify-floor-reachability.mjs` against this pass —
the verification those cover was done separately and is recorded above.

**A SENTENCE THE PLAYER SAID BEFORE THE VERDICT, WHICH CONSTRAINS WHAT COMES
NEXT MORE THAN THE VERDICT DOES.** They first asked, in their own words,
whether this was wireframing rather than the graphics. They were told phases
1-2 are placeholder shapes and the 16-bit pass is Phase 4, accepted that, and
only then answered the people question. So the yes is a yes *about
placeholders*, and reading it as permission to start drawing would ignore the
question they asked first. Three consequences, recorded as rules rather than
as advice:

- **Phase 4 art does not start here.** This pass is not a request for sprites.
- **Placeholder shapes stay through Phase 3** — head-and-body tokens, named-
  colour furniture chips, grid lines. The reason is the one this section's
  build order already gives: committing final art to a layout that may still
  change spends budget on a moving target, and Phase 3 moves the layout by
  construction, since bodies that path and queue do not stay where they were
  placed.
- **The bob, footprint and palette knobs are not retuned** until a later pass
  names a feel problem in them. The player did not say too subtle or too
  jittery. They said people. Tuning a knob that just passed its gate, on no
  reported complaint, is how a passing value gets lost.

**PHASE 3 IS BUILT — THE SIM AND ITS RENDER, IN TWO SEPARATELY GRADED HALVES.**
`floorSim.ts` is the machine: a deterministic reducer over §5.13's own
`seeking → queuing → using → leaving` with the transient `interrupted`, pure,
pixel-ignorant, no clock and no dice. It was graded by a critic that had not
seen its builder's report, and that pass found a branch which had not merely
escaped the arm census but **had no subject** — the route-lost transition wrote
`seeking` onto a member already seeking, so a census keyed on state *change*
could not see it, and instrumenting it directly measured it at 0 of 66,240
observations. Its sibling was the real defect: a member sealed away from every
station wandered forever inside four tiles while both liveness instruments
stayed green, because `longestStill` stays low precisely *because* the member
keeps moving. A player makes that pocket by dragging two items. `route-blocked`
is now a third interruption cause carrying a visible reaction, evidenced by a
sealed-pocket sweep against an unsealed control differing by one row: 720
stranded observations against 0, 8 reactions against 0, 0 claims against 20.
Four further gaps closed in the same round, including a queue cell that could
be another station's *use* cell — 18 collisions across 92 stations, two bodies
on one tile, in the phase whose entire gate is legibility.

`FloorGrid.tsx` is the render half, built by a different builder so the sim's
author did not grade its own renderer. It steps the reducer on a tunable
interval, lerps `cell → next` by `progress` and tweens the result so a walk is
continuous rather than three hops per tile, and gives the five states distinct
cues with the machine in use outlined on the floor. **The sim is byte-identical
to its reviewed state** — a render round quietly changing sim behaviour is how
a reviewed piece stops being the reviewed piece.

The motion claims are stated against a real non-advancing control rather than
against an argument about one, because a check that a member is *drawn* at a
position is true of a freeze-frame. The control is a player action, not a test
hook: holding a drag open suspends the tick. Running read `[3, 4, 1]` distinct
horizontal positions over 40 ticks; the control read `[1, 1, 1]` over 0. The
control's *vertical* reading is `[3, 3, 3]` and is kept beside it, because
Phase 2's idle bob keeps running while the sim does not — which is exactly why
the horizontal axis is the asserted one. Two of the harness's own checks were
found wrong by that control failing rather than by anyone reading code, and one
of them was vacuous: it passed on a frozen mutant because it, too, was
measuring the bob.

**PLAYTEST 5 — PHASE 3's GATE IS MET. RULED, ON A FELT YES FROM A HUMAN ON A
REAL PHONE.** Same player, same opening-day garage, reached the way this
section requires: cold launch, no query string, press GYM EMPIRE, scroll to the
floor, on a real phone in a mobile browser over a public tunnel. On screen at
tick 120: the garage 8x6, three fixed pieces, three members, and the chrome
reading `1 seeking, 0 queuing, 2 using, 0 leaving` with the machines in use
outlined and the seeking copy reading "walking to a machine". Placeholders
throughout, as ruled.

The verbatim answer: *"The people move around and the queueing works."*

That is a felt yes on a real device against the shipped placeholder — the same
standard Playtest 3 set for placement and Playtest 4b for people, and the only
standard that settles this gate. Two details are worth keeping. The walking is
**across the grid**, not the Phase 2 idle bob, which is the distinction the
whole render half was built to make legible. And **the queuing verdict came
from the play, not from the freeze-frame**: the readout quoted above happens to
show 0 in queue at that instant, and the player watched queuing happen anyway.
A section that spends this many words on why presence is not motion should not
then read its own gate off a single frame.

**Phase 4 may proceed. It has not started, and nothing here starts it.**

**FOUR THINGS THIS VERDICT IS NOT.** It is not a request for sprites — the
player had already asked whether this was wireframing and been told the 16-bit
pass is Phase 4; that is still true and this sitting did not ask for it. It is
not a pass on any rung above garage: storage-unit, strip-mall and warehouse
have still never been watched by a human, and the sim's behaviour at 40 members
on a warehouse floor is unjudged. It is not a verdict on the interruption cue,
the stranded ring, or the `route-blocked` copy — the player named none of them
as a problem *or* as a yes, so none of them is gated by this line and none may
be recorded as blessed by it. And it is not a suite result: 34 browser claims
and 812 unit tests are the reason the thing was watchable, and a human watching
it is the reason the gate is met.

**PLACEHOLDERS STAY FOR NOW, AND THIS IS THE SENTENCE THAT SAYS SO RATHER THAN
LETTING SILENCE IMPLY OTHERWISE.** Phase 4 being unlocked is not Phase 4 being
started. The build order gates art on 1-3 having proven the system worth
finishing; they now have, so the gate is open — but the 16-bit pass begins when
somebody actually calls for it, not automatically because the phase before it
closed. Until then the floor keeps head-and-body tokens, named-colour furniture
chips and grid lines, and the bob, footprint, palette and affinity knobs stay
where they are, because no pass has named a feel problem in any of them.

**PHASE 4 WAS THEN CALLED FOR BY THE HUMAN, AND IS IN BUILD.** One structural
decision, recorded before the work rather than discovered in a diff: the floor's
sprites land **self-contained in `src/empire/`**, following `src/art/`'s
conventions by reading them — the index-grid rasteriser discipline, one key
light, no pillow shading, hand-placed marks over an underpainting — but not by
importing that directory. Two reasons. `src/empire/`'s import fence ("imports
nothing outside this directory except its own tuning") is the pinned property
that makes the two-session split safe, and the other session is actively
working in `src/art/` right now, so a live import edge would couple this
screen's render to files changing under it. The cost is a smaller duplicated
rasteriser rather than a shared one; the identity requirement is that the floor
reads as the same game as the lift screen, which is a style question the next
phone pass judges, not a code-sharing question. The gate for this phase is the
build order's own: the art is done when the floor reads as the finished game's
floor, judged by a human on a real phone, same as every gate before it.

**PHASE 4's FIRST ITERATION SHIPPED, AND A HUMAN LOOKED AT IT — A DIRECTION
PASS WITH A NAMED GAP, NOT A GATE PASS.** What shipped: every placeholder
replaced by real pixels — members, fixed furniture, all fourteen session items
to their real footprints, tray and placed chips, and a drawn floor texture —
as indexed-colour PNGs whose pixel bytes are the palette indices themselves,
built by a pure module with no renderer library taken, and decode-tested back
against the authored grids. The sim stayed byte-identical throughout. The
build's own history is part of the record: the builder that authored it and
the small builder sent after its two named polish edits each died mid-round
(a session limit; then a hang whose transcript kept a moving mtime over a
frozen byte count — the looks-alive shape the liveness rules warn about), and
both trees were recovered by measurement rather than assumption: two lagging
census pins read off their own failure values, one flaky test budget widened
120s to 300s with its 62s solo timing recorded, and one of the two owed
polish edits discovered to be already done. The mats sprite's contrast fix —
a two-tone checker whose values straddle the floor's luminance from both
sides — is the other, and it shipped.

The human's verdict on a real phone, verbatim: *"Really cool. We want to see
them actually using the machines, interacting with the machines almost
stickfigure RPG style in a sense of simplicity."*

The first sentence is a direction pass on the sprites and the motion. The
second names the gap precisely, and the screenshot behind it (garage, tick 88,
one member per state, flat-bench green-highlighted) shows why: the logic runs,
but the read is **people near equipment, not people on equipment**. A `using`
member differs from a standing one by a pinned pixel count and a highlight and
a bob — none of which is a body engaged with a machine. That is the next
round's scope — the round is named **P4b**, which is how code and tool comments
cite it — and it is presentation only: per-station-class using poses at
stick-figure simplicity (a bench-class, a bar/rack-class, a generic — two or
three templates beat one generic torso), a renderer-side draw bias toward the
station anchor while `using` so the body meets the furniture instead of
floating beside a green box, and a short rep-cycle animation in `using`,
faster than the walk, replacing the pulse bob as the "working a set" read.
`floorSim.ts` stays byte-identical by construction — the sim's use-cell model
does not move — so every Phase 3 sweep and history is untouched. Explicitly
out, from the verdict's own register: importing `src/art/`'s rig, or any
fidelity chase — the whole point of "stickfigure RPG style" is that
simplicity is what reads.

The check for the next phone pass, written down now so it is asked rather
than reconstructed: **place a bench centrally, watch a member path → queue →
use — does it read as interaction, not occupancy?** Until that pass, Phase 4
remains in build and no gate is claimed.

**P4b's PHONE FINDING — THE HEADLINE CHECK IS ANSWERED, AND THE REMAINDER IS
USAGE TUNING.** Same player, real phone, P4b at `d626a00`, verbatim: *"This
works, the equipment usage needs to be fine tuned but the concept is there and
works!"* The check above was asked as written — bench central, path → queue →
use — and the answer is interaction, not occupancy. Classification, so a later
reader takes exactly what was given: a direction pass on P4b's job (bodies on
machines, three pose classes, station coupling), with the named remainder
being how the usage READS — feel and readability in the stick-figure register
— not the sim loop, not the coupling, and not a request for `src/art/`'s rig
or a fidelity chase. **The Phase 4 art gate is NOT closed by this line**; that
close is the human's to say, later, in their own words.

The player did not separately name the rep cadence, the bar frame-b arm read,
the mats checker, or the walk-to-new-machine behaviour. **Silence is not a yes
on any of them** — they stay recorded builder doubts at their sites, not this
sitting's findings. The fine-tune round (P4c) works the usage read: pose ↔
furniture fit per class (silhouette, overlap with pad and bar, feet against
the slab), cadence only through its named knob, and per-class distinctness
preserved — with `floorSim.ts` byte-identical and Phase 3's walking/queueing
untouched, same as every presentation round before it.

**P4c's PHONE VERDICT, AND §5.13's PRESENTATION WORK HOLDS HERE.** Same
player, real phone, P4c at `9ccd405` — the composite-driven round: the
double-bar fix with the occupied-sprite swap, the sled repark, the painted
bar-frame arms, the `under` op with its executed-mutant catcher. On a screen
showing two members using machines (bench occupied, the lying figure along
the pad; power-bar occupied) and one queuing, the verdict, verbatim: *"this
is fine for now."*

Classified so a later reader takes exactly what was given. It is an
acceptance of the current state — not a defect report, and none of the six
recorded look-fors (the picked-up-vs-vanished read, sled side-approach,
bench figure scale, the generic 7px pump, powerlifter-red-on-plate-red, the
hooded bar read) was named a problem. It is also **not the Phase 4 art gate
closing**: "for now" reserves exactly the refinement it declines to ask for
today, and the standing rule is that the gate closes in the human's own
words, later, if they choose. The six look-fors stay recorded doubts at
their sites, unjudged individually; silence is not a yes on any of them.

**What "fine for now" means operationally: §5.13 stops here until a human
names the next thing.** No further polish rounds, no knob tuning, no new
poses — the failure mode this section's own history warns about is an agent
continuing to improve the familiar surface because it is well-guarded, and a
"for now" from the person who owns the gate is the signal to hold, not a gap
to fill. One truthfulness fix rode out with this record rather than waiting:
the screen chrome in the player's own screenshot still read "no members, no
final art yet" over three members training on finished sprites — flagged
stale by the Playtest 4 pass, false twice over by this one. The caption now
says what the screen shows. Everything else holds at `9ccd405`'s state.

**§5.11 STAGE 4 IS UNPAUSED — RULED BY THE HUMAN, FILED BEFORE THE WORK, AND
NARROWER THAN THE PAUSED LIST.** The scope, in the ruling's own words:
staffing, maintenance, equipment condition, recoverable failure — the settled
design of §5.6/§5.7, still absent from the tree. **Portfolio is not in the
ruling's enumeration and stays paused.** That boundary is recorded here
because the stage-4 list this section paused was "portfolio, staffing,
maintenance, failure", and an unpause that names four things and omits one is
a decision, not an oversight. The consequence for staffing on a single-gym
ladder: a manager is an OPTIONAL hire for the gym you run — the §5.7
good-manager function, routine repairs handled autonomously for a wage — and
the Home Gym never *needs* one, exactly as §5.7 states. Staffing's full
subject (locations run unattended) arrives with portfolio, later, if ruled.

Build shape, same as every §5 piece: **pure logic first in `src/empire/`**,
then the minimal surfacing that makes it playable on the garage floor —
condition visible where the equipment is, the repair decision offerable, the
cost shown before it is declined. `floorSim.ts` stays byte-identical unless a
named presentation hook is genuinely required, and that hook is named in this
section before it is taken. No wallet/Total/e1RM/streak writes. No Phase 4
art polish, no retuning of sprites, cadence, poses, or the six unjudged
look-fors — the "fine for now" hold on presentation stands; stage 4 surfacing
is new information on the screen, not refinement of what is there.

The constraint that shapes everything here is §5.7's own, and it gets the
house's standard of proof: **failure accrues only from active in-session
decisions the player was shown the cost of, never from elapsed time.**
Condition decay is keyed to the gym's own advanced time — the clock the
player advances — never to wall-clock absence. The check is the transfer this
section promised when v2 landed: two histories identical except that one has
MORE absence must never differ in condition, in income deducted, or in
failure progression, swept in `streakSweep.ts`'s shape with counts pinned at
zero and the non-zero control kept runnable. Gate when built: a phone pass on
the garage floor, relayed as always.

**THE WEAR-BASIS RULING, TAKEN ON THE MEASUREMENTS AND NOT ON AN ARGUMENT.**
Stage 4's logic shipped at `5db6aa7` with its sweep honestly reporting that
beyond the horizon everything is zero and inside it all three GDD nouns
differ. Four options went to a human — keep banked wear, key to check-ins,
key to decisions only, or scope "absence" to beyond-horizon. **The ruling
rejects the cheap ones by name:** the 890 is not to be pinned, and scoping
"absence" to beyond-horizon is not an acceptable substitute for a fix. Keying
wear to check-in count is refused too — it would make wear a per-visit
charge, the exact shape the visit-fee control is pinned punishing — and so is
deleting continuous decay. Instead the ruling splits §5.7's two sentences
(see §5.7's own clarification, added in the same commit):

- **Condition and income stay operation-keyed.** Banked hours, or better,
  member-use / `crowdingLoad` — the same idea either way: the gym running
  wears things, and idling the clock without operation does not invent a
  second clock. Offline earnings still mean the gym ran. If the key moves
  from banked hours to usage, the GDD and the code change together.
- **Failure breaks its chain to condition.** Low condition may show a repair
  prompt; it may not advance a strike or dormancy because the player was away
  or because they checked in more often. Within-horizon failure progression
  goes to **zero** on the six-policy sweep, matched-trace included, with the
  unfixed non-zero kept runnable as the control — the shape `engagement.ts`'s
  own repair already uses.
- **Income deducted must not punish showing up.** A diligent player may not
  finish poorer for more visits once repair timing is fair. The 297 readings
  explained by neither the per-check-in nor the accumulated crawl are to be
  **isolated, not shipped as an argument**.

All three GDD nouns get re-pinned across all six policies, with attribution
that computes magnitude rather than co-occurrence, and controls that actually
punish. **S4b — the garage-floor surfacing — waits until the failure sweep
reads zeros and no income reading punishes engagement.** A prompt on the
floor implementing the chain just forbidden would ship the defect into the
one surface a player touches. Presentation hold unchanged; portfolio still
paused.

**THE WEAR-BASIS RULING'S FAILURE BULLET IS MET, AND THE ROUTE WAS NOT THE ONE
THE PREVIOUS ROUND ARGUED WAS AVAILABLE.** Within-horizon failure progression
reads **0 / 0 / 0** — symmetric mismatches, phase-worse readings and
matched-trace mismatches — on the family and on each of the six policies. The
unfixed non-zero is kept runnable exactly as this ruling asks: the removed
condition-gated review runs as a control over the same 864 pairs and reproduces
the previous round's shipped row exactly, **310 / 186 / 124**, with 923
net-lower money readings.

The route is the one the previous round's module header had enumerated and
then closed the search past: **the standing repair order is raised on the
check-in ORDINAL** rather than on equipment condition. Enlarging a gap changes
gap lengths and never the number of check-ins, so the review lands on the same
indices in both runs of a within-horizon pair — driven over 160 enlargements up
to a year long, byte-identical every time, against 15 of the same 160 that move
it under the control gate. §5.7's clarification above records what that made
the prompt into, and the half of that clarification it does not close.

**Three prices, all measured and none of them hidden.** Within-horizon money
fell 923 → 421 and collapsed onto one player model, carried entirely by the
manager's wage, the manager's autonomous repairs and the standing repair bill
— all operation-keyed spends this ruling's first bullet keeps operation-keyed
on purpose. The `repeat-strike` and `failure-slump` controls now measure
nothing on the within-horizon domain, because both of the differences they
used to expose came from the crossing that moved; their engagement halves
still bite, and the dead halves are pinned as equalities so a change that
revives them is read rather than silently absorbed. And the ordinal made a
player model's unrequired manager dismissal into an engagement charge — 36
net-lower readings where there had been zero — which was fixed on the model
side, with the old model kept runnable as a control pinned at 36.

**AND THE ZEROS HOLD BY A KNOB MARGIN, WHICH THE PARAGRAPH ABOVE DID NOT SAY.**
Recorded because "within-horizon failure progression reads 0 / 0 / 0" reads as a
structural result and is one only in part. The review cadence's index-invariance
is structural — the review series is byte-identical under every enlargement at
every wear rate tried. The failure *counters* are not: the `'cheapskate'` model
triggers its strike-producing hire on the display predicate, whose second
disjunct reads worn equipment, so a fast enough wear rate puts a condition
crossing back in front of the ledger's own. Measured on the shipped battery by
moving `EQUIPMENT_WEAR_PER_BANKED_HOUR` alone: `withinHorizon.failureMismatches`
is 0 at 0.002, 0.004, 0.0045 and 0.005; **32 at 0.0055, 128 at 0.006, 256 at
0.007**; and 0 again at 0.008, 0.01 and 0.02, where both runs of a pair cross on
the same index. Every non-zero reading is `'cheapskate'`, and swapping that
model's gate to the ledger-only predicate at 0.006 takes the 128 to 0.

The shipped wear rate is 0.002 and the margin closes at **0.00463** — a factor
of 2.3. That relation is now asserted rather than assumed:
`management.test.ts`'s `STRIKE_PATH_MARGIN` derives it from the wear rate, the
offline horizon, the two ordinal knobs, the warning threshold and the prompt
condition, and reddens before the sweep does. A tuning pass that raises wear
past that line gets a red line naming the relation instead of a silently broken
GDD bullet. **The bullet is met at the shipped tuning, and it is a tuning
statement rather than a structural one.**

**S4b WAS THEN UNBLOCKED BY A HUMAN, AND IT IS BUILT.** The paragraph that used
to sit here said S4b stayed blocked because the engagement strike counters are
non-zero and §5.7 wanted a human to rule on whether that mattered. The ruling is
the one recorded in §5.7's own clarification above, landed in the same commit
this paragraph outlived: the equal-strike sentence is **withdrawn**, so non-zero
engagement strike counters are the mechanic working rather than a bar being
missed, and the condition that was actually holding S4b — the failure sweep
reading zeros within the horizon, and no income reading punishing engagement —
was already met. A human then ruled S4b unblocked directly. Recorded here rather
than left as a stale "not unblocked", because a document that says a piece is
blocked while the piece ships is the same defect as a comment that outlives its
code.

**What S4b surfaced, and where.** `src/empire/GymScreen.tsx` — the real React
Native screen already reachable from the shell's `GYM EMPIRE` pill — gained one
`gymscreen-management` section directly under the floor, because that is where
the equipment is. It shows the failure phase and the counted-decision ledger
(every strike drawn with the price that was on screen when it was taken), mean
and per-item equipment condition with the income multiplier beside it, the
standing repair order with its named item and its quoted cost, three answers to
it (repair, leave it, decline), the three manager tiers with hire cost, wage and
auto-repair threshold, hire and dismiss, and the dormant readout with its costed
way back out. `GymViewState.gym` became `GymViewState.managed`, a `ManagedGym`,
so there is one `GymState` on the screen and repairs spend the purse the ladder
fills. Every number is a call into `management.ts`; the screen computes nothing.

**Two costs, measured rather than absorbed.** The condition income multiplier now
applies on the played path, so the garage's first relocation is affordable at the
**eighth** `+3d` dev check-in rather than the seventh — 2459.52 Gym Bucks at the
seventh against a 2500 move. That is §5.7's auto-deduction doing its job and it
is pinned in `ladderView.test.ts` rather than tuned away. And the whole
decline → dormancy → repair → reopen arc is now reachable by pressing controls,
which means a player can put their own gym into a failure state; the way out is
quoted before any of it is spent.

**AND THE COPY BROKE IT WHILE THE CODE DID NOT, WHICH IS THE ONE FAILURE MODE
THIS SECTION'S OWN CHECKS ARE BLIND TO.** For a round the line over the
standing review read *"leaving this one unanswered counts against the gym"* and
*"you can leave this one unanswered for free; the next one counts"*. Leaving a
review unanswered writes nothing: `promptDismissals` moves in exactly one
expression, on a non-repair response to `respondToPrompt`, so the counter those
two sentences were about advances on a press of "not now" and on nothing else.
The screen was therefore telling a player that inaction is punished — this
section's forbidden reverse chain, asserted in prose, on the one surface a
player touches, while every behavioural sweep behind it read zero. The lines
name the press now ("not now" is free once, "decline the repair" counts, and
"only a press moves the ledger; leaving this open does not"), and the check
behind them was replaced: it used to compare the drawn branch against
`prompt.dismissalWouldCount`, the same flag the screen branched on, which is an
oracle restating its subject. `GymScreen.test.ts`'s
`the review's own sentence is true of the mechanic` drives the three forks
instead — walk the clock past three reviews unanswered (ledger stays empty),
press "not now" (free once, counted after), press "decline the repair" (counted
at once) — and reads the ledger back. A second line under the equipment
condition readout had the same shape: it labelled two condition-keyed lists as
the review's own pool and drew "nothing"/"none" directly above an open review
naming an item at condition ~0.9. It now names what the lists are and says
plainly that the review is raised by the check-in count rather than by them.

**The constraint this round was most at risk of breaking, and the check that
covers it.** §5.7's clarification forbids the reverse chain — absence, elapsed
time, or low condition, by itself, advancing a strike or dormancy. The screen
shows a review whenever the check-in ordinal raises one and never advances
anything by showing it. `tools/verify-floor-reachability.mjs`'s claim 9c drives
the clock control repeatedly with no decision and reads phase, counted-decision
count, drawn strike-row count and the ledger's lead sentence back off the DOM,
with 9b (condition really moves under the same presses) and 9g (the ledger
really can move, three declines put three rows on it) as the non-vacuity on
either side of it.

**AND THE FIRST VERSION OF THAT CHECK WAS MUTATION-TESTED AGAINST A THRESHOLD
TUNED TO ITS OWN DOMAIN, WHICH IS THE DEFECT ONE LEVEL OUT FROM THE ONE IT WAS
WATCHING FOR.** Recorded rather than replaced, because the witness the
paragraph used to carry — `phase sound -> failed, strikes 0 -> 10` — resolved
perfectly and said nothing about the region the game's own machinery branches
in. 9c reused `S4B_MAX_CLOCK_PRESSES`, a bound its own comment derives from the
review cadence, and covered equipment condition ~0.958 down to ~0.67. Every
condition-keyed read on the failure path compares against
`MAINTENANCE_PROMPT_CONDITION`, which is **0.5**, so `wornItems()` was empty at
every point of that band and a mutant keyed at the game's line could not fire
inside it. Measured on the shipped tree rather than argued: a strike appended
on `wornItems(next).length > 0` inside `checkInWithWearBasis` — low condition
alone, the exact chain this section forbids — left that version of the tool
**PASSING at exit 0, 0 failing claims of 66**, with 9c reporting "0 counted
decisions" while the app implemented the forbidden chain. The same mutant
against the rewritten check reads `phase sound -> failed, strikes 0 -> 4` and
exits 1.

*The re-recorded witness, with its domain.* 9c derives its press budget from
the crossing rather than from the cadence, reading the per-press wear off the
check-in cost line ("wore the gym down by 0.024") and the threshold off the
condition watch-list line ("under 0.5 condition:"), both from the drawn DOM
rather than transcribed from `empireTuning.ts`. Measured on the shipped tuning
it drives **22 presses**, taking condition **0.958 -> 0.43** — the 0.5 line
inside the band, not above it — and a second claim reads the watch-list line
back and fails unless the list has really stopped saying "nothing" (it names
`power-bar, comp-plates, flat-bench, mats`). So the domain is **a condition
band containing `MAINTENANCE_PROMPT_CONDITION`**, and the limit belongs in the
same currency: a strike path keyed **below 0.43**, or on a rung this run never
reaches, or on a manager on staff (9f hires after this block rather than
before), or on a check-in index past the budget the crossing implies, is still
outside what 9c can see.

*A separate claim, checked and refuted rather than carried forward.* A critic
derived that flipping `SHIPPED_REVIEW_GATE` from `'ordinal'` back to
`'condition'` — restoring the mechanism this section names as the measured
defect — would leave **all** of section 9 green. Run: it does not. The flip
turns **three 9g claims red and the run exits 1**, because the condition gate
never raises a third countable order inside `S4B_MAX_REVIEW_ROUNDS` and the gym
never reaches dormancy. What the critic was right about is narrower and is the
part above: **9c itself is byte-identical under the flip**, reporting the same
`0.958 -> 0.67` and the same zeros, and 9g's failure message names a
throughput problem rather than the gate — a different check noticing by
accident is not that check working.

**Gate: unrun.** No human has played S4b on a phone. Everything above is a
suite result and a driven browser check, which §5.11's own standing rule says is
not the same thing as a gate pass.
---

### 5.14 The idle-tycoon depth pass — human-directed redirection, staged

By explicit human ruling, delivered as a full product-direction brief citing
*Idle Fitness Gym Tycoon* as the primary mechanical reference (a real
published mobile game, cited the same structural way §5.7A already cites it —
for its interaction grammar, never its art, copy, or numbers, and never
player-facing). The ruling's own stated reasoning: §5 as specified through
§5.13 is "directionally correct, but too thin for the opportunity" — a menu
of numbers rather than a place the player watches and manages — and the
stronger shape is *"powerlifting career game on top, actual idle gym tycoon
underneath, meet day as the payoff,"* not four disconnected modes. This
section records that redirection, reconciles it against what §5.0–§5.13
actually specify and what `src/empire/` actually ships today, and lays out a
staged plan — because the ruling's own §22 asks for exactly that: *"do not
overbuild content before the system works... prefer a small but complete
vertical slice."* This document's own history is the sharper version of the
same lesson — §5.0 replaced v1 wholesale because a large system was built
before any of it was played; §5.14 exists so that does not happen twice at a
larger scale.

**Nothing here weakens a standing hard constraint.** Every rule the ruling
itself names — no purchasable effect on Total/e1RM/training pace/meet
performance (§8.1), no gacha/random-chance recruitment (§5.3, §12.3), no
visible fatigue meter (§3.4), no forced/interstitial ads (§8.3D), no
elapsed-time-punishing setback (§3.5, §5.7), fictional-only naming for every
new facility/staff/NPC archetype (§7.3), server-authoritative mutation once
wired to real progression (§9.2) — restates rather than revises §5's own
existing text. Where the ruling's vocabulary and this document's differ (its
"Quality/Capacity/Throughput" reads as a naming of what §5.2's "Money vs.
Capability" split and §5.4's condition/capability model already do, seen from
the station's side rather than the item's), §5.2 and §5.4 remain the
authoritative model; §5.14 extends them, it does not replace them the way
§5.0 replaced v1.

**What the ruling asks for that already exists, verified by a from-source
audit rather than assumed — build on this, do not rebuild it:**

- **A real capacity-limited queue/throughput simulation already exists**, in
  `floorSim.ts`, and it is not a stub: one member per station, a FIFO queue
  *recomputed every tick* from the members themselves (no stored queue
  table), deterministic tie-breaks, three named interruption causes, a
  bounded liveness guarantee, and a stranded/wander fallback for a member
  sealed off from every reachable station. This is precisely the mechanism
  the ruling's §2/§8 (*"identify the bottleneck," "8 athletes waiting, 2
  racks"*) describes wanting — it is built, pure, tested, and its Phase 3
  gate is **met** (§5.13, "the people move around and the queueing works,"
  verbatim). What is missing is not the simulation; it is a station-level
  *upgrade axis* that changes its parameters (below), and a UI that lets a
  player read and act on a bottleneck rather than only watch one.
- **The rendering is top-down/orthogonal, not isometric — and that already
  cleared its own human gate.** §5.13 never specifies isometric; the ruling's
  own §5 hedges the same way (*"isometric or similarly readable perspective
  compatible with the existing visual identity"*). A top-down grid with
  16-bit sprites is that existing, played, gated identity (§5.13 Phases 1–3;
  §7.1's fixed-resolution nearest-neighbor pipeline). **Lead scoping call:**
  this stays top-down. Rebuilding the projection would restart Phase 1–3's
  playtest history for a change nothing in the ruling requires by name, and
  §5.13's own Phase-4 direction verdict (*"stickfigure RPG style...
  simplicity"*) already asked for restraint over fidelity once — an
  isometric rebuild pulls the opposite way. Overrulable, same as every
  scoping call in this document.
- **Named, one-way facility tiers already exist** — `ladder.ts`'s Garage →
  Storage Unit → Strip-Mall Unit → Warehouse (§5.1) — matching the ruling's
  §11 ask in shape if not yet in count. Naming beyond Warehouse is new work
  (below).
- **A real staff mechanic exists** (§5.7, `management.ts`): hire cost, an
  ongoing wage drawn per banked operating hour, and a tier-gated auto-repair
  threshold. Thin against the ruling's staff-role list (§7) but real, not a
  percentage multiplier with no subject.
- **Fictional-only naming, the identity tier system, and the real-name
  refusal condition** (§7.3, §12.3) already bind every new facility, staff
  archetype, or NPC name §5.14 or a later round adds. Nothing new needed
  here beyond following the existing rule — search every invented name
  before adoption, against the sector-refusal bar CLAUDE.md's own trademark
  history for `src/career/` recorded (strength/fitness/supplements/apparel/
  coaching/games sectors and any famous mark refused; small out-of-sector
  hits accepted with the hits recorded).

**What is genuinely missing — the real staged work:**

1. **Station-tap management.** `GymScreen.tsx` today is one long scrolling
   list (`gymscreen-root`, every subsystem in document order) — S4i's own
   round just finished clearing its bottom edge of the shell's nav pill, on
   exactly that screen shape. The ruling's §3/§14 ("tapping a station should
   produce a compact management surface rather than replacing the entire
   game with a spreadsheet") is real, unbuilt UX work, buildable on top of
   what `floor.ts`/`management.ts` already hold without new simulation.
2. **A Quality/Capacity/Throughput axis per station**, extending §5.4's flat
   equipment-unlock model into a per-item upgrade ladder, with Capacity
   specifically required to raise `floorSim.ts`'s current hardcoded
   one-member-per-station cap — the one place this touches the simulation's
   own core rather than only its presentation. Scope this to two or three
   station types first (the ruling's own §22: *"prefer several meaningful
   station types... over dozens of shallow entries"*); Barbell — squat,
   bench, deadlift, the sessions the lifter's own career runs on and the
   only equipment group already wired to the shipped ladder — is the
   candidate with the most existing floor presence and the highest
   powerlifting-authenticity payoff (ruling §4: *"generic fitness content
   should not dominate"*). Overrulable; a human may prefer a different
   first station.
3. **A day-1/hour-1/day-N economy pacing simulator (ruling §19) does not
   exist and should.** What exists — `engagement.ts`, `empireInvariant.ts`,
   `empireSweep.test.ts` — proves a monotonicity invariant (more engagement
   never produces a worse outcome), pinning violation *counts*, not
   progression pacing. `ladderView.tsx`'s own header already names the real
   gap: *"whether the four income magnitudes pace well... is the gate's open
   question"* — stated, untested. This is pure logic, zero UI risk, zero
   crossing risk, and its output should inform whether (2)'s upgrade curve
   is sane *before* it is built into a screen — so it is sequenced first
   among the new-code stages below, not last.
4. **Career ↔ Empire reinforcement (ruling §12) does not exist in code at
   all today**, beyond the one sanctioned physio-days hook (§3.5,
   `physioDaysSavedFor`, read-only from `src/game/fatigue.ts`). §6.4 already
   specifies the missing half as a standing (never-built) contract — *"Result
   feeds Career progression (qualifying totals) and Gym Empire
   (reputation)"* — so this is not a new design decision, it is an
   unimplemented one. It is also the single largest cross-session
   architecture item in this ruling: a real meet-result-to-reputation feed
   needs a seam across `src/career/`/`src/game/` and `src/empire/` that does
   not exist. **Following the precedent CLAUDE.md already set for the
   progression-wallet wiring** ("ruled out until the tuning registry is
   verified complete," recorded rather than attempted early), this is
   deferred as its own later, deliberately serialised, explicitly authorised
   crossing — built as a pure function of a meet result on the Empire side
   first (ready, not yet wired), with the actual cross-directory wiring
   requiring its own sign-off when the rest of this plan has landed. Trophy
   *display* inside the gym (presentation-only, reads a result the way
   `floor.ts` reads ownership) is lower-risk and can move earlier once (1)
   exists.
5. **Portfolio (multiple acquired locations beyond the Home Gym) stays
   paused per §5.11's own gate discipline until unpaused by a human.** The
   ruling's monumental-expansion fantasy ("own the greatest powerlifting gym
   on Earth") and its named tier list running past a single Warehouse both
   read as wanting more than one gym. **Reading this ruling as that
   unpause** — it is explicit about wanting scale the current four-rung
   ladder alone cannot produce — but recorded as an interpretation rather
   than silently assumed, since §5.11 requires a human ruling specifically
   to lift this pause and the ruling itself does not use the word
   "portfolio." Sequenced last: everything above should exist and be played
   on one gym before multiplying the loop.
6. **NPC individuality/tenure beyond a type-and-tenure multiplier.**
   `members.ts` is a pure, stateless satisfaction function today — no
   roster, no arrival/departure, no history, and its equipment-condition
   input is hardcoded to `1` everywhere because nothing yet produces a real
   value. The ruling's *"that lifter has been with my gym since the
   garage"* needs an actual roster with persistence, which is new state, not
   a new formula — the largest data-model change on this list after
   Career↔Empire wiring.

**Staged build order — each stage gated exactly as §5.11/§5.13 already gate
every stage of this spec: it must be playable, and a human must have played
it before the next stage starts.** Order, and why it is this order rather
than the ruling's own §1–§23 sequence:

- **Stage A (this section).** Reconcile the ruling against the shipped spec;
  fix two stale entries this reconciliation surfaced (§2.4's undersold
  one-liner; §11's stale "nothing a player can reach" framing, corrected
  above rather than silently left).
- **Stage B.** The economy pacing simulator (item 3) — pure logic, no
  screen, informs every later number.
- **Stage C.** Station-tap management (item 1), built against the existing
  floor/management data with no new simulation. **Closed** by human play of
  C.1d at `460f794a` — Empire now feels like a primitive gym-management
  game rather than controls around an animation. Carry-forward debts
  (C-DEBT-01..04) do not reopen it. C.2 simulator fidelity is recorded in
  §5.16. Stage D is recorded in §5.17. Stage D.1 is recorded in §5.18.
  Stage D human-close is `ff8721a`. D2 is CLOSED — PARTIAL BY DESIGN /
  CONSEQUENCE BOUNDARY REACHED — by human play of `83a8ed4` at Chromium
  390×844. Stage E is CLOSED at `b91a84c19fcf561051ec0d651aeda31addd3e882`.
  Career/Meet → Empire persistent reputation wiring, Portfolio, and
  persistent NPC roster remain blocked.
- **Stage D.** Quality/Capacity/Throughput on Barbell first (item 2),
  touching `floorSim.ts`'s capacity constant — the one piece of this pass
  that changes the simulation's own core rather than its surface, so it
  gets its own dedicated build-and-critic round rather than riding with (C).
  The mechanism proof is §5.17. The physical abstraction is corrected in
  §5.18: equipment is not a training station.
- **Stage E.** CLOSED at `b91a84c19fcf561051ec0d651aeda31addd3e882` —
  sporting reputation foundation accepted; wiring still blocked. Career-side
  of the reputation feed (item 4), built and proven as a pure function
  first. Closing Stage E does not authorize Career/Meet →
  `EmpireState.reputation`, Portfolio (F), or NPC roster/tenure (G).
- **Stage F.** Portfolio unpause (item 5) — multiple acquired locations,
  remote management, full unattended staffing.
- **Stage G.** NPC roster/tenure depth (item 6). **G.1 CLOSED** at
  `c27f714c40e3ad7139eaec84ed340f1255c602ea` — living member identity +
  service outcome foundation accepted (targeted Expo 390×844 replay of
  G.1C). **G.2A CLOSED** at
  `255de8a5cf32b99429bbe864b0dcd01f5201da56` — living member
  satisfaction truth foundation accepted (targeted Expo 390×844
  experience replay on that HEAD). G.2A.1 closed calibration
  terminology (`waitDecayTicks` is an e-folding constant, not a
  half-life) and pinned the real Garage / synthetic tables; the shipped
  wait formula remains `exp(-ticks / 110)`. Independently verified
  mint `ba8561bfd11e9e2a5062923d4054b59e0976dcc0` (docs/comment only;
  no product-runtime change). **G.2B CLOSED** (COMMON / type-blind
  retention-pressure foundation). **G.2C1 CLOSED / FROZEN** at
  `c8776cadcb57ef6f16acabe4f962858c6b2dac0a` — persistent stay
  response from accepted G.2B pressure; eligibility is not removal.
  **G.2C2 CLOSED / FROZEN** at
  `1493f43807753eda3654c428e4234702a7da45f4` — actual living-member
  departure after eligibility plus one further strain-qualifying
  service observation.   **G.2C3 CLOSED / FROZEN** at
  `2b0f52bdcd94004400937e450c8db12727ca74ca` — vacancy arrival /
  population replenishment plus P1 honest Watching/neutral writer proof.
  **G.2D CLOSED / FROZEN** at
  `28611af74dd6479bfad58763ebba72db5942307c` — living-member dues
  from accepted G.2A experience, clock-settled on the roster ledger and
  credited onto the spendable Gym Bucks purse (added to frozen D2
  facility income). P1: unsettled-window occupancy is time-weighted
  presence (in-window leaves still pay the active stub; a played leave
  on the open settle mark occupies the GymHost tick). **G.2E FROZEN** at
  `cf98f4dedbb572850667bd191692779a195caa50` (factory freeze; human feel
  gate not run — not CLOSED) — member-side reputation from that same
  occupancy, plus reputation-gated high-paying vacancy arrival.
  **G2-ATHLETE-SEASON-01 IN PROGRESS** — shared gym-clock Athlete
  leave/return. Career → Empire reputation, Portfolio, and NpcLifter
  merge stay blocked.

### Human Stage C rejection at `f097695b`

The human personally played the build and found:

- the gym was visually subordinate to textual UI;
- equipment placement did not work reliably;
- starting Barbell equipment could not be rearranged;
- members were not interactive;
- Empire felt like a text/debug screen with a video playing in it.

Therefore Stage C remained open. Automated checks at that SHA correctly proved mechanical paths (buy, repair, hire, fail, recover) but did not prove game feel. Those historical checks are not rewritten as failures.

### C.1b direction

The human ruling authorized, and C.1b implemented:

- a viewport-first Empire screen (HUD + gym stage + bottom dock);
- explicit Build mode;
- deterministic tap-to-place (tap a piece, then tap a tile);
- movable starting Barbell layout state;
- transient member inspection;
- Shop / Staff / More as secondary drawers over the gym.

C.1b is **not** human-approved. It remains pending the human gate.

### C.1c

C.1c closes implementation defects and contract misses from the C.1b handoff before the second human playtest: already-placed equipment must move on the tap-select → tap-tile path even while the simulator occupies it; recovery re-placement uses that same Build path; the Shop is a visual equipment-card drawer; Staff is player-facing rather than diagnostic; the 9c verifier no longer extrapolates a huge press budget from a tiny overwritten wear sample.

C.1c is **not** human-approved. Stage C stayed open for a second playtest. C.2 / Stage D were not started.

### Human Stage C rejection at `47f27b39`

The human personally played C.1c and found:

- the floor and dock were visible;
- the station card on the power bar worked and felt substantially more game-like;
- Shop was a real catalog;
- first move of the power bar worked;
- **second move of the same power bar failed repeatedly**;
- tapping visible lifters did not reliably open a member card;
- an invalid placement refused without understandable feedback;
- Staff remained too text-heavy;
- the simulation was visible, but interaction with what is visible was unreliable.

Therefore C.1c improved the product but did not close Stage C.

Engineering conclusion: Stage C interaction verification must prove that visible pixels and interactive hit regions are the same spatial object, not merely that an independently-addressable testID can be clicked. A testID-driven harness can target an invisible helper even when a human clicking the drawn sprite cannot.

### C.1d

C.1d makes the visible game object the interactive object: one member body, one station root, two explicit Build phases (select, then place). Drag is not the canonical path. Invalid placement states a player-facing reason and keeps the piece selected. `460f794a` is the accepted Stage C implementation. C.2 / Stage D are not started by C.1d itself.

**Explicitly not reopened by this section:** §5.13 Phase 4's art gate, which
stands exactly where its own text leaves it — *"holds/stops here until a
human names the next thing"* — this ruling's emphasis on mechanical depth
(its own §22 lists visual customization under *improve*, not under *build
first*) reads as leaving that gate closed for now, not as the human naming
the next art round; if that reading is wrong, say so and it reopens. Nor
does this section touch S4b's own still-unrun gate, S4f's condition-vs-review
split, S4g/S4h/S4i's device fixes, or the 1401 within-horizon trade-off — all
stand exactly as their own sections already record them.

**The one thing this section cannot do, stated because the ruling itself
asked for it to be checked honestly rather than assumed:** the whole-game
gate — *"proven fun,"* the lift mechanic, Sim Mode and meet day — is still
shut, per §11's own text, corrected above only to say Gym Empire's *own* feel
has since been played repeatedly, not that the lift has. This section adds
staged work inside an already-overridden mode; it does not and cannot lift
that gate, and no critic on any stage below may claim otherwise.

### Human Stage C acceptance at `460f794a`

The human personally played C.1d at `460f794a`. Stage C passes.

Accepted product statement:

> Empire now feels like a primitive gym-management game rather than controls around an animation.

Human evidence:

- a visible moving member opened `Powerlifter` / `Leaving`;
- a visible member using a station opened `Powerlifter` / `Training on Flat bench`;
- visible equipment opened contextual station information (`Power bar`, `Idle`, condition, move / close);
- Build mode was discoverable;
- Competition plates were selected and moved, then selected again and moved a second time — the C.1b/C.1c second-move failure did not reproduce;
- a Flat bench occupied by a member could be picked up into `Moving: Flat bench`;
- Shop remained a catalog over the live gym;
- Staff remained a drawer over the live gym;
- mode switching remained stable.

This closes the architectural Stage C human gate. Do not phrase Stage C as pending another playtest. The whole-game gate in §11 remains shut; this close is Empire Stage C only.

### Stage C carry-forward

Closing Stage C does not mean the remaining defects do not exist. These are debts, not reopeners.

**C-DEBT-01 — real thumb verification.** The accepted replay was Chromium rather than literal touchscreen input. The mobile layout has automated coverage. A real-thumb smoke test remains required before a production/mobile release gate. Do not reopen Stage C solely for this.

**C-DEBT-02 — buy → place human verification.** The human could not test purchase → Build → placement because the live purse was roughly 2–5 Gym Bucks and the cheapest relevant SKU was 350 / already owned. Automated coverage exists. Future human verification of this path needs an explicit funded QA fixture or deterministic test state. Do not modify production prices or earnings merely to make the test convenient.

**C-DEBT-03 — occupied-station move completion.** The human successfully selected an occupied Flat bench for movement, proving the old pointer/hit issue is gone. The human cancelled rather than completing the relocation. Completing that occupied move (select occupied station → place on a legal tile, member simulation remains valid) is verified by the human-surface coordinate harness. It does not reopen Stage C.

**C-DEBT-04 — invalid placement feedback.** Overlap placement was refused correctly but appeared silent: the reason sat on the grid under the Cancel chrome. Carry-forward UX only: selection stays active; the attempted cells outline; the banner shows `Space occupied` / `Doesn't fit here` / `Outside the gym`. Placement mechanics are unchanged. Fixed as isolated presentation work alongside C.2. Desktop and mobile-sized viewports both show the banner reason and the attempted-cell outline. Does not reopen Stage C.

C.2 simulator fidelity follows this Stage C close. Stage D is not started by C-DEBT-04. The Living Gym Doctrine (§5.15) does not authorize Stage D during C.2.

### 5.15 The Living Gym Doctrine

Human product-direction ruling, GDD-only, recorded against Session B head
`460f794a`. This section did not change the C.1d implementation and did not
itself close Stage C. A subsequent human play of `460f794a` closed Stage C
(acceptance record above). This section does **not** start C.2 or Stage D.
It does **not** reopen §5.13 Phase 4's art gate, unpause Portfolio
(§5.11 / §5.14 Stage F), or authorize persistent NPCs before Stage G. It
defines the quality bar later Empire stages must meet.

Idle Fitness Gym Tycoon and similar idle-gym games remain useful interaction
references. They are **not the quality ceiling**. Three White Lights Empire
must deliberately exceed the weaknesses common to the category rather than
reproduce them with powerlifting artwork.

The long-term fantasy is:

> I started lifting in a rough garage and built one of the greatest
> powerlifting institutions in the world.

The player is not primarily building an idle money machine. The player is
building a **living powerlifting institution**.

The core causal loop is:

member mix → training intentions → station demand → queues / utilization /
wear → training experience → member outcomes → retention / reputation →
future member mix.

The player's interventions are layout, equipment, station capability,
staffing, maintenance, scheduling, specialization, and facility expansion.

Gym Bucks are fuel for this system. Gym Bucks are not the final objective of
the system.

#### Five permanent Empire design tests

Every major Empire mechanic must be reviewed against these five questions.

**1. The world test.** Can the important consequence be understood by looking
at the gym? Examples: a queue is physically visible; a station with high
utilization visibly stays busy; added capacity physically appears; a moved
station actually moves; wear is visible; a member waiting for equipment
visibly waits for that equipment; a throughput improvement visibly increases
turnover. The world should communicate system state before prose does.
Diagnostic numbers may exist underneath. They are not the primary game
interface.

This is the same interaction ruling Stage C already made permanent at C.1d:
visible member = interactive member; visible station = interactive station;
visible floor = build surface. Future systems attach to the physical world.
Do not create a parallel menu-only simulation that turns Empire back into a
spreadsheet.

**2. The agency test.** Does an important bottleneck permit multiple
legitimate responses? A good bottleneck must not always reduce to "buy the
next upgrade." Possible response classes include: change layout; increase
capacity; increase throughput; improve quality; change staffing; change
scheduling; change specialization; accept the bottleneck as a deliberate
strategic tradeoff. Not every problem needs every answer. Meaningful
problems should not have one mandatory button.

**3. The infinite money test.** If Gym Bucks were unlimited, would this still
be an interesting management problem? Empire must contain meaningful
non-money constraints. Legitimate examples: physical space; station
capacity; time; movement/flow; staff attention; equipment condition; member
fit; peak-hour demand; scheduling conflicts; reputation; specialization
tradeoffs. Do not invent arbitrary currencies merely to simulate depth. If
unlimited Gym Bucks solves almost everything, Empire is too shallow.

**4. The no-guide test.** Can a reasonable player understand the tradeoff
without reading an optimal-build guide? Avoid false choice, deliberately bad
purchases, strictly dominated upgrades, opaque multipliers, and giant
upgrade trees whose real challenge is discovering the one mathematically
correct route. The gym itself should help teach the consequences of the
player's decisions.

**5. The institution test.** Does the mechanic reinforce the fantasy of
building a real powerlifting institution? If a major system could be moved
unchanged into an airport tycoon, a supermarket idle game, a theme-park
clicker, or a generic factory idle game, examine whether it is sufficiently
connected to powerlifting. The generic economic skeleton may be shared. The
decisions and consequences should not be generic.

#### Members are not money particles

Long-term member simulation must not treat NPCs as anonymous tokens walking
toward revenue generators. Members should eventually enter the gym with
training intentions. Example: Powerlifter A (squat rack → specialty bar →
accessory station → recovery); Powerlifter B (competition bench → dumbbells
→ cables). A member's path through the gym should interact with the facility
the player has actually built. That creates meaningful consequences: queue,
rerouting, waiting, incomplete training, better or worse training
experience, attraction to certain gym identities, eventual retention /
reputation consequences.

Do not implement persistent NPCs before the planned NPC stage (Stage G).
This doctrine defines what that future system must become.

#### Stations are not cash machines

A station's purpose is to satisfy training demand. Revenue is a consequence
of running a valuable gym. Do not reduce stations to "purchase object →
object produces Gym Bucks/sec." Later station depth should answer: who wants
this; how many can use it; how long does use take; what happens when demand
exceeds capacity; how reliable is it; what kind of gym does owning it help
create.

#### Quality / Capacity / Throughput

Stage D remains the first vertical slice of this doctrine. The three axes
must be causally distinct. §5.2 and §5.4 remain the authoritative economic
model; this names the station-side axes Stage D will cut, it does not
replace those sections.

**Quality** changes training value / attractiveness / member experience. It
must not simply be another income multiplier. Possible visible consequences:
stronger appeal to certain member types; better experience/outcomes;
stronger contribution to reputation; visual equipment improvement. Quality
must not increase the Career player's e1RM, Total, or meet performance
(§8.1).

**Capacity** changes simultaneous usable slots. Capacity should physically
manifest (another rack, another bench position, another platform, additional
warm-up area). It consumes space where appropriate. Capacity should actually
alter queue behavior in `floorSim`.

**Throughput** changes how quickly users complete the station cycle.
Possible causes: better organization, plate storage, assistance, improved
station design, reduced handover time. It should shorten real
service/transition time in the simulation. It must not be a detached
`income x1.2` scalar.

#### Multiple solutions to bottlenecks

Example: a competition bench develops a long queue. Potential future
responses may include: add bench capacity; improve turnover; change layout;
improve staffing; change schedule; create another training zone;
intentionally remain a specialized high-demand gym and accept the wait. No
one solution should automatically dominate all others. This is one of the
main ways Three White Lights must exceed shallow idle-game progression.

#### Gym identity should emerge

The player should not simply click "Choose specialization: +25% powerlifting
revenue." Gym identity should emerge from what the player builds and
operates. Examples may eventually include: serious competition-prep gym;
technical-development gym; high-volume strength club; highly coached small
facility; broad strength facility; recovery-rich performance gym. The system
should infer that identity from equipment mix, member mix, staff, layout,
training demand, outcomes, and operating decisions.

Do not implement this inference during Stage C or C.2.

#### Facility progression unlocks decisions

The facility ladder (Garage → Storage Unit → Strip-Mall Unit → Warehouse)
must not become "same loop → bigger floor → larger numbers." Each step
should increasingly unlock new kinds of management decisions.

Broad long-term intent:

- **Garage:** learn the physical gym; placement; queues; basic equipment.
- **Storage Unit:** stronger staffing/maintenance tradeoffs; meaningful
  capacity choices.
- **Strip-Mall:** specialization; larger member mix; scheduling; stronger
  local reputation.
- **Warehouse:** multiple training areas; serious club operations; major
  competitive/reputation systems.

Exact implementation remains subject to future human rulings.

#### Offline time is not failure

The player should never feel punished for sleeping, working, or leaving the
app (§5.7). Long-term offline return should become a causal report.
Preferred eventual form:

WHILE YOU WERE AWAY

- 42 training sessions completed
- 248 Gym Bucks earned
- Competition bench was busiest
- Average bench wait increased
- 2 stations need maintenance
- Gym remained operational

The return screen should create the next interesting decision. It should not
exist merely to display a pile of currency or sell an ad multiplier.

#### Staff automates chores, not strategy

Staff progression should eventually transform repeated manual operations
into policies. Early: the player manually handles maintenance. Later: the
player establishes rules / delegates. Example policy shape: "Repair
equipment below 65% unless reserves would fall below 500 Gym Bucks." The
player's strategic decision remains. The repetitive click disappears. Do not
reduce staff to passive generic `+X% income`.

#### No deliberately bad upgrades

Do not ship choices whose only purpose is to punish a player who did not
consult a guide. At the same decision tier, avoid equipment/options that are
strictly dominated across all meaningful dimensions. A choice may be worse
economically if it is better in space, member fit, throughput, quality,
specialization, maintenance, or another meaningful axis. Tradeoffs are good.
Trap choices are not.

#### Major progression should be visible

If the player spends heavily on a meaningful station improvement, the game
world should acknowledge it. The consequence may be a new sprite / equipment
state, additional capacity, a different footprint, a changed queue, changed
member behavior, changed staff interaction, or a changed use animation.
Avoid upgrades whose only observable result is `1.44 → 1.51` on a hidden or
abstract multiplier.

#### Money must eventually stop being the only problem

Empire should remain interesting after cash becomes abundant. Long-term
strategic constraints include space, utilization, member mix, reputation,
staffing, scheduling, specialization, competitive outcomes, layout, and
equipment reliability. This is why reputation must not become merely another
spendable currency. It should change what kind of gym the world believes the
player operates and who therefore wants to join it.

#### Competition is the unique payoff

Generic gym tycoons do not have Three White Lights' central advantage: the
gym can produce competitive lifters. Long-term causal loop: gym decisions →
member development → competition participation → outcomes → gym reputation
→ member demand → new management problems. This must remain separated from
the Career player's own progression. Empire may not purchase player e1RM,
player Total, Career training pace, or meet success (§8.1).

#### Portfolio remains last

Do not multiply shallow gyms. Build one living gym first. Portfolio remains
paused until one facility demonstrates meaningful member behavior, visible
bottlenecks, multiple management responses, station depth, reputation,
useful staff delegation, and durable strategic play. Only then reconsider
operating multiple locations. This is not an unpause of §5.11 Stage F.

#### Development sequence under this doctrine

Current sequence remains:

Stage C human close (done at `460f794a`) → C.2 simulator fidelity (done,
§5.16) → Stage D Q/C/T (done, §5.17) → Stage D.1 training-station semantics
(done, §5.18) → Stage D.1b world legibility (done, human-close of Stage D
at `ff8721a`) → D2 CLOSED — PARTIAL BY DESIGN / CONSEQUENCE BOUNDARY
REACHED (human play of `83a8ed4` at Chromium 390×844) → Stage E CLOSED at
`b91a84c19fcf561051ec0d651aeda31addd3e882` (sporting reputation foundation
accepted; Career/Meet → EmpireState.reputation wiring still blocked) →
persistent NPC roster / tenure (Stage G, still blocked) → deeper staff
policy → portfolio only after explicit human unpause.

The doctrine does not authorize implementing future stages early. It defines
their quality bar. C.2 is recorded in §5.16. Stage D is recorded in §5.17.
Stage D.1 / D.1b are recorded in §5.18. D2 is recorded in the D2 ruling
under §5.18 and is CLOSED at `83a8ed4`. D2.1A is CONFIRMED AND FIXED at
`0ded7fe`. D2.1B is recorded immediately after D2.1A. D2.2 is recorded
immediately after D2.1B. Stage E is recorded immediately after the D2 mint
and is CLOSED at `b91a84c19fcf561051ec0d651aeda31addd3e882`.

### 5.16 Stage C.2 — simulator fidelity (online vs offline in aggregate pacing)

C.2 is a simulator-fidelity correction. It is not a balance pass. It is not
Stage D. No Gym Bucks rates, equipment costs, facility costs, offline
fraction, offline cap, wear rates, repair costs, manager wages, hire costs,
auto-repair thresholds, failure thresholds, Q/C/T, reputation, or member
persistence were changed.

**The defect.** `accrueLadderGymBucks` / `ladderCheckIn` / `gymCheckIn` /
`managedCheckIn` already distinguished `'online'` from `'offline'`.
`pacingCheckInSchedule` already tagged `'watcher'` `'online'` and every
other policy `'offline'`. `runPacingLadder` already forwarded `entry.mode`
into `ladderCheckIn`, so the relocate-instantly Garage → Storage / Warehouse
numbers were already mode-aware. `runLadder` and `runManagedGym` did not
accept a mode and always called check-in at the `'offline'` default, so
`runPacingLadderRealistic('watcher')` and every `runPacingManagedGym('watcher')`
measured a watching player at the offline fraction.

**The correction.** Optional `mode: EarningsMode = 'offline'` on `runLadder`
and `runManagedGym`. Pacing wrappers take `schedule[0]?.mode ?? 'offline'`
and pass it through. Accrual, cap, wear, wages, repair, and failure still
go through the existing functions. One economic truth.

**Relocate-instantly (already mode-aware; unchanged by C.2).**

| Policy | Garage → Storage | Garage → Warehouse |
|---|---|---|
| watcher | 1.74d | 10.42d |
| few-times-a-day | 3.50d | 21.00d |
| once-a-day | 7.00d | 43.00d |
| sporadic | 3.83d | 21.33d |

The ~22-day warehouse target remains closer to few-times-a-day / sporadic
than to once daily. That is a measurement, not a retune.

**Realistic `runLadder` (`cheapest-affordable-first`) at 7d — watcher was the contaminated cell.**

| Policy | Old aggregate rating | 7d rung | 7d Gym Bucks |
|---|---|---|---|
| watcher | offline (wrong) | storage-unit | 8660.04 |
| watcher | online (corrected) | strip-mall-unit | 40573.80 |
| few-times-a-day | offline (already correct) | storage-unit | 8600.00 |
| once-a-day | offline (already correct) | storage-unit | 50.00 |
| sporadic | offline (already correct) | storage-unit | 7880.00 |

**Management 7d, watcher — reconstructed old contamination vs corrected online.** Wear/condition/failure timing match because those axes key off banked seconds, not the money multiplier. Net position roughly doubles, as the 0.5 offline fraction predicts, minus flat hire/repair cash.

| Policy | Mode | 7d netPosition | phase | meanCondition | hires | failedAt |
|---|---|---|---|---|---|---|
| hands-off | offline (old) | 4375.97 | sound | 0.637 | 0 | — |
| hands-off | online (corrected) | 9187.27 | sound | 0.637 | 0 | — |
| diligent | offline (old) | 4563.75 | sound | 0.974 | 0 | — |
| diligent | online (corrected) | 9562.84 | sound | 0.974 | 0 | — |
| cheapskate | offline (old) | 1657.03 | failed | 0.896 | 1 | 34561 |
| cheapskate | online (corrected) | 3438.36 | failed | 0.896 | 1 | 34561 |

**Novice / cheapskate, re-measured, not retuned.** Hire cost 150 Gym Bucks. Wage 2 Gym Bucks per banked hour. Auto-repair threshold 0 (never fires). Cheapskate never pays off vs hands-off inside 7d in any of the four cadences. Watcher, few-times-a-day, and sporadic still fail with a hired novice by day 7; once-a-day does not hire and does not fail inside 7d. Leave the tuning decision for D2.

C.2 does not start Stage D / the Living Gym Q-C-T vertical slice.

### 5.17 Stage D — Living Gym Quality / Capacity / Throughput vertical slice

Stage D is a mechanism proof, not a balance pass. D2 tunes it. No facility
pacing, offline fraction, offline cap, manager wages, hire costs, novice
threshold, general wear, failure thresholds, or full-economy rates were
changed. C.2's measured numbers in §5.16 are unchanged. Reputation, persistent
NPCs, and Portfolio stay paused.

**The problem.** A garage with only the flat bench on the floor and three
powerlifters wanting it is an obvious bottleneck: one simultaneous seat,
members arriving, a standing queue. The player can see the queue on the floor
and can respond on three distinct axes, or can leave the queue standing.

**The slice.** Only the three starting Barbell pieces — power-bar,
comp-plates, flat-bench — can be upgraded. Session equipment and squat-rack
stay at stock. One upgrade per axis (`STATION_UPGRADE_LEVEL_MAX` 1). New
prices, not a retune of existing SKUs: Quality 120 / Capacity 180 /
Throughput 150 Gym Bucks.

**Where the state lives.** `GymViewState.capability`, not `ManagedGym`. Wear,
wages, repair and failure stay on `ManagedGym` and were not re-keyed. Stock
capability is the empty map — Stage C's machine, unaltered, until a purchase.

**The three mechanisms, in the real sim, not as income multipliers.**

- **Quality — Competition pads / Aggressive knurl / Tight tolerances.**
  Training-experience value of a completed use goes from
  `STATION_STOCK_TRAINING_EXPERIENCE` 1 to
  `STATION_QUALITY_TRAINING_EXPERIENCE` 2. Members treat a Quality station as
  more appealing: `stationQualityAffinityBonus` adds
  `STATION_QUALITY_AFFINITY_BONUS` (0.25) inside `affinityFor`, so demand
  shifts onto the upgraded piece when another station is available. Does not
  add a simultaneous slot. Does not shorten `FLOOR_SIM_USE_TICKS_BY_TYPE`.
  Does not credit Gym Bucks. Does not raise the Career player's e1RM, Total,
  or meet performance (§8.1). The goldenrod rest-edge on the chip is the
  world cue; members walking there more is the living-gym cue. Stage E's
  reputation loop can read the experience value later; Stage D does not fake
  that loop.
- **Capacity — Second position.** `stationCapacitySlots` becomes 2. The
  floor sim assigns that many approach-cell use slots and seats two members
  at once. Extra standing pads draw on those cells (`floorgrid-capacity-pad-*`).
  A boxed-in station that cannot realise a second approach cell is refused
  (`no-second-position`) rather than silently clamped. Consumes approach
  space, not a new furniture SKU.
- **Throughput — Plate tree / Collar kit.** `stationUseTicksFactor` becomes
  `STATION_THROUGHPUT_USE_TICKS_FACTOR` 0.65 on the real use-tick duration.
  One slot remains one slot. The darkkhaki mark on the chip is the world cue.
  Members cycle the same seat faster.

**Deterministic bottleneck experiment.** Garage, only the flat bench placed,
three powerlifters, seed 1, 240 ticks. Standing `queuing` counted, not
`seeking`. Same demand, four capability maps.

| Axis | slots | completions | maxQueue | maxUsing | meanUseTicks | experience |
|---|---|---|---|---|---|---|
| stock | 1 | 5 | 2 | 1 | 35.8 | 5 |
| Quality | 1 | 5 | 2 | 1 | 35.8 | 10 |
| Capacity | 2 | 8 | 1 | 2 | 35.125 | 8 |
| Throughput | 1 | 8 | 2 | 1 | 24.25 | 8 |

Quality is identical to stock on every physical number in the one-station
bottleneck (there is no other station to prefer) and doubles experience.
On a two-station garage (far bench at (6,0), near bar at (0,3), seed 1,
240 ticks), Quality on the bench inverts demand: stock 205 bench-target
ticks / 5 completions vs 440 bar-target ticks / 6 completions; Quality 440
bench-target ticks / 6 completions vs 205 bar-target ticks / 5 completions.
No extra seat, no shorter hold. Capacity adds a
real second seat, cuts the standing queue, and does not apply the 0.65
factor (the 35.125 vs 35.8 drift is start-tick hash spread, not a
throughput change). Throughput shortens real service time without adding a
seat. Completions rose under both Capacity and Throughput, by different
physical means. The three axes do not collapse to one "better station"
scalar.

**World presentation.** Numbers exist in the station panel. The consequence
is on the floor: extra pads, goldenrod rest-edge, darkkhaki mark, occupancy
line (`occupantCount`), members cycling and preferring the nicer station.
Panel copy is the physical thing, not Q=1/C=1/T=1: "Competition pads —
better training experience (120)". Power-bar Quality is "Aggressive knurl";
plates Quality is "Tight tolerances"; bar Throughput is "Collar kit".

**D-DEBT — stored / unplaced equipment currently wears.** Reproduced, not
shipped. `ManagedGym` has no `FloorState`. `withWear` keys `ownedItemsOf`.
Unplaced session mats wear identically to the placed flat bench over the
same check-in. That contradicts the Living Gym Doctrine (a piece in storage
is not being used). The smallest correction is to wear placed-and-used
items, not owned items. Not shipped in D: a wear-path change would
contaminate C.2's measured wear/failure timing and this round's Q/C/T
proof. D2's first explicit balance verdict should include it.

**What Stage D did not do.** Did not retune C.2. Did not "fix" the novice
manager. Did not start reputation, persistent NPCs, or Portfolio. Did not
touch Session A (`src/career`, `src/lift`, `src/game`, `src/shell`,
`src/art`). Quality does not raise Career strength.

Stage D's mechanism proof stands. A design review found the physical
abstraction wrong: Stage D treated power-bar / comp-plates / flat-bench as
independent member-service stations. They are equipment. Stage D.1 (§5.18)
retargets Q/C/T onto the Competition Bench Bay without reverting the
distinct-axis proof.

### 5.18 Stage D.1 — equipment is not a training station

Stage D.1 is a semantic correction of Stage D, not a revert, not D2, and not
a catalog. Q/C/T remain three distinct mechanisms. They now attach to a
functional training station, not to a piece of equipment.

**The defect.** Stage D keyed `StationCapabilityState` per
`LadderEquipmentItem`. Members pathing to competition plates or a power bar
as if each were a training destination is not a credible powerlifting gym.
Capacity 2 then meant two approach cells around one physical bench. That is
mathematically distinct from Throughput. It is not a second bench.

**Equipment ≠ training station.** Equipment is a physical thing the gym
owns (a bar, plates, a bench surface). A training station / bay is a
functional place a member trains. Future stations named here and not built:
Squat Rack, Deadlift Platform, Combo Rack, Warm-up Bench, Accessory
Station, Recovery Area.

**The first functional station.** Competition Bench Bay. Assembled
deterministically from the opening garage's required starting equipment:

- power-bar
- comp-plates
- flat-bench (primary surface)

All three must be on the floor or the bay is incomplete: members cannot
train there, and anyone targeting it interrupts with `target-removed`.
Component equipment stays owned and movable. Tapping the primary surface of
a complete bay is tapping the station; tapping the bar or plates is
inspecting equipment. No crafting UX.

**Where the state lives.** Still `GymViewState.capability`. Keys are now
`TrainingStationKind` (`competition-bench-bay`), not SKUs. Stock is still
the empty map. `ManagedGym` is still untouched. Costs, max level,
experience, affinity, and throughput factor are unchanged: Quality 120 /
Capacity 180 / Throughput 150; `STATION_UPGRADE_LEVEL_MAX` 1; experience
1 → 2; affinity bonus 0.25; throughput factor 0.65. C.2 economy is
unchanged.

**The three mechanisms, retargeted.**

- **Quality — Competition pads.** A property of the bay. May be painted on
  its equipment (better bench surface, competition bar, calibrated plates)
  but members demand the nicer BAY, not "tighter plates" as an activity.
  Same one bay, same capacity, same service duration. Training-experience
  1 → 2. Affinity bonus 0.25. Does not credit Gym Bucks. Does not raise
  Career e1RM / Total / meet performance (§8.1). Goldenrod rest-edge on the
  bay is the world cue.
- **Capacity — Second bench.** A second actual 2×4 bench position,
  orthogonally adjacent to the primary (right, down, left, up — in that
  search order). Opening garage realises it at (5,0). It occupies eight
  more floor cells, has its own use position, and seats a second member
  simultaneously. Not two cells around one bench. If the current layout
  cannot fit the second 2×4, Capacity refuses (`no-second-position`) rather
  than silently clamping. Space is a strategic constraint. The world cue
  is a second bench sprite labelled "second bench", not a capacity pad.
- **Throughput — Plate tree.** The same bay, the same footprints, shorter
  real service / handover (`STATION_THROUGHPUT_USE_TICKS_FACTOR` 0.65).
  Does not add a bench. Does not change Quality. Darkkhaki mark on the
  bay is the world cue.

**Deterministic bottleneck experiment.** Opening garage, complete
Competition Bench Bay, three powerlifters, seed 1, 240 ticks. Standing
`queuing` counted, not `seeking`. Same demand, four capability maps.

| Axis | bays | positions | cells | completions | maxQueue | maxUsing | meanUseTicks | experience | demand |
|---|---|---|---|---|---|---|---|---|---|
| stock | 1 | 1 | 8 | 6 | 2 | 1 | 35.67 | 6 | 679 |
| Quality | 1 | 1 | 8 | 6 | 2 | 1 | 35.67 | 12 | 679 |
| Capacity | 2 | 2 | 16 | 9 | 1 | 2 | 37.11 | 9 | 657 |
| Throughput | 1 | 1 | 8 | 9 | 2 | 1 | 23.00 | 9 | 663 |

Quality matches stock on every physical number (there is no other station
to prefer in this fixture) and doubles experience. Capacity adds a real
second bench, doubles occupied cells, raises peak occupancy to 2, cuts the
standing queue, and does not apply the 0.65 factor (the 37.11 vs 35.67
drift is start-tick hash spread, not a throughput change). Throughput
shortens real service time without adding a bench. Completions rose under
both Capacity and Throughput, by different physical means.

**Quality appeal, two-station garage.** Opening garage plus specialty-bars
at (7,3), three powerlifters, seed 1, 240 ticks. Powerlifter published
affinity is 0.5 on the bay and 0.7 on specialty-bars; Quality's +0.25
inverts that.

| Map | bay ticks | bay completions | bars ticks | bars completions |
|---|---|---|---|---|
| stock | 205 | 5 | 445 | 5 |
| Quality | 440 | 6 | 212 | 4 |

No extra seat. No shorter hold. Members walk to the nicer bay.

**World presentation.** Tap equipment (bar, plates, incomplete bench) →
inspect / move / condition. Tap the complete bay's primary surface or the
second bench → station operation / queue / Q/C/T. Do not collapse these.
Panel copy is the physical fitting, not Q=1/C=1/T=1: "Competition pads —
better training experience (120)"; "Second bench — two can train at once
(180)"; "Plate tree — faster plate changes (30)". Refuse copy is "Place the
bay first" / "No room for a second bench".

**D-DEBT — stored / unplaced equipment currently wears.** Kept visible,
not stealth-fixed. `ManagedGym` still has no `FloorState`. Unplaced
session mats still wear identically to the placed flat bench over the same
check-in. The corrected station model did not by itself give wear a
placed-and-used seam: wear still keyed `ownedItemsOf`. D2 closed that as
D2-TRUTH-01A (`placedOwnedItems` / optional `inService`). D2-TRUTH-01B
(utilization-sensitive wear) remains deferred.

**Cloud-scope cleanup.** Stage D added a `dev` script to `package.json` and
excluded App Builder files from `tsconfig.json` so a cloud sandbox would
typecheck. Those were not repository-level requirements. Reverted to the
834dbbf7 contents: no `dev` script; `tsconfig.json` excludes only
`node_modules`, `dist`, `.expo`. Cloud-only files stay outside tracked
project configuration.

**What Stage D.1 did not do.** Did not start D2. Did not start reputation,
persistent NPCs, or Portfolio. Did not retune C.2. Did not build the rest
of the station catalog. Did not touch Session A. Did not silently fix
D-DEBT.

Stage D.1 implementation is complete.

**Stage D.1b — world legibility + interaction close.** Human playtest of
D.1 found the architecture sound and the Living Gym gate still open:
Capacity was physically legible; Quality and Throughput were primarily
panel/marker legible; occupied-station tapping was frictional; panel
selection required an explicit close; Capacity's spatial refusal was
reactive rather than preflight-visible.

Correction, presentation and interaction only. Q/C/T numbers, C.2
economy, and the D.1 station model are unchanged. Opening purse and
stored/unplaced wear remain deferred (D2).

- **Quality.** The Competition Bench Bay's benches swap to a
  competition-spec pad (black leather, chrome rails, heavier feet). The
  goldenrod corner mark remains a secondary cue. Same one bay, same
  capacity, same service duration. Experience 1→2, affinity +0.25.
- **Throughput.** A plate-tree fitting is drawn on the same bay, no extra
  collision, no extra seat. The 0.65 use-duration factor is still the
  sim. The darkkhaki corner mark remains a secondary cue.
- **Occupied bay.** The visible "bench bay" / "second bench" world labels
  are explicit station tap targets stacked above members. Member bodies
  still select the member.
- **Panel.** Sits in document flow below the floor, not as an absolute
  overlay. A single tap on another visible world object selects it. No
  full-screen backdrop.
- **Capacity preflight.** When a second 2×4 cannot fit, the station panel
  shows "No room for a second bench" instead of a live purchase. The
  reducer still refuses `no-second-position` if invoked.

Stage D.1b implementation is complete.

**Stage D human Living Gym gate = PASS at `ff8721a`.** Human play of D.1b
in Chromium 390×844 accepted Quality (competition-spec pad, still one bay /
one position / same duration), Capacity (real second bench, spatial
consequence, boxed preflight), Throughput (visible plate tree, shorter
turnover), and interaction (occupied bay inspectable, one tap between
station/equipment/member, no close-first ritual). Do not reopen D.1b merely
because later balance changes numbers.

**Stage D2 — Living Gym balance verdict (PARTIAL).** Authorized at
`ff8721a`. A verdict, not a tuning mandate. Reputation, persistent NPCs,
and Portfolio were not started.

*D2-TRUTH-01A — stored / unplaced wear (CLOSED).* Defect: `ManagedGym` wear keyed
owned equipment, so unplaced session mats wore like actively used kit.
Correction: `floor.ts#placedOwnedItems` derives owned ∩ placed. `withWear` /
`managedCheckIn` take optional `inService`. Omitted = all owned (C.2 /
`runManagedGym` unchanged). The played composition (`advanceGymClock`)
passes `placedOwnedItems`. FloorState is not copied onto ManagedGym. No
mats special-case: an unplaced bench and an unplaced mat are the same kind
of absence. Owned ≠ placed ≠ used; this seam is owned ∩ placed. Live
FloorSim utilization is not the wear key (React-local, does not run during
offline banked gaps).

C.2 numbers did not move. Opening kit is placed by `createFloorState`, so
the C.2 path and the opening played path wear the same set. Old vs
corrected C.2 7d ONLINE (hands-off / diligent / cheapskate) is identical:

- hands-off: net 9187.27, condition 0.637, phase sound, hires 0
- diligent: net 9562.84, condition 0.974, phase sound, hires 0
- cheapskate: net 3438.36, condition 0.896, phase failed, hires 1, failedAt 34561

Played-path difference: buying mats (or pulling a bench to the tray)
without placing it no longer wears that item. That was the false semantic.

*D2-UI-DEBT-01 — occupancy panel vs world.* After Capacity the panel could
read "2 training, 1 waiting" while one body sat on one bench. Cause:
`stationOperationView` counted `state==='using'` with no seat cap; the
floor lights `member.cell ∈ useCells`. Capacity rebuilds geometry without
stepping the sim, so leftover users at a blocked cell still counted.
Fix: optional `seats` (`useCells`) on `stationOperationView`; unique per
seat, same snapshot. FloorGrid passes the selected station's `useCells`.
Capacity slot algebra, routePlan, and upgradeStation were not changed.
Simulator stepping was not delayed to hide the discrepancy.

*Time to first meaningful decision* (C.2 `runPacingManagedGym` hands-off,
opening purse 0, garage 60/h):

| cadence | mats 10 | Quality 120 | Throughput 150 | Capacity 180 | novice hire 150 |
| --- | --- | --- | --- | --- | --- |
| watcher | 0.007d (~10 min) | 0.083d (2h) | 0.104d | 0.125d (3h) | 0.104d |
| few-times-a-day | 0.042d | 0.250d | 0.250d | 0.500d | 0.250d |
| once-a-day | 0.042d | 1.000d (purse 387.65) | 1.000d | 1.000d | 1.000d |
| sporadic | 0.021d | 0.604d | 0.604d | 0.604d | 0.604d |

Cheapest alternative action is mats at 10 Gym Bucks (ten-minute live
watch). Layout rearrange is free. Q/C/T are a 2–3 hour live watch or the
first once-a-day check-in. The More-drawer +3d is a labeled **dev skip**
(12h banked = 360 GB), not production time. Opening is not "wait for
currency" if mats/layout count; it is wait-for-currency for the first
Q/C/T axis unless the player watches ~2h or checks in the next day.
D2 does **not** grant opening purse, does **not** cut SKU prices, does
**not** make one axis free. Mats already is the budgeted first
intervention. Layout is the free first action.

3d / 7d hands-off purse (C.2, unchanged): watcher 4236 / 9623; few-times
2118 / 4821; once-a-day 1096 / 2488; sporadic 2117 / 4817.

*Q/C/T non-domination.* Opening 3-powerlifter fixture (seed 1, 240 ticks)
is unchanged from §5.18: STOCK 6/2/1/6, QUALITY 6/2/1/12, CAPACITY 9/1/2/9,
THROUGHPUT 9/2/1/9. Completions-only, Throughput looks strictly better
(same 9 completions, 150 vs 180, no extra cells). That is not the only
outcome.

- Capacity is the rational choice when the floor can fit a second 2×4,
  queue pressure is the felt bottleneck, and two simultaneous users
  matter. Boxed layouts refuse `no-second-position`; rearranging restores
  it. That is the honest Capacity region.
- Throughput is the rational choice when space is tight, one seat is
  acceptable, and turnover is the felt bottleneck. It never adds a
  position.
- Quality does not add completions or seats on the opening fixture. It
  doubles experience (6→12) and, when another station exists, pulls
  demand onto the bay (5→6 bay completions, 205→440 bay target ticks).
- Neither C nor T is mandatory: the player can accept the queue.

*Quality durable consequence.* Present-tense: experience 1→2, affinity
+0.25, demand shift onto the upgraded bay. It does not add Gym Bucks,
capacity, or duration, and it does not raise Career e1RM / Total / meet
performance. Verdict **B**: mechanically sound, strategically incomplete
until the authorized reputation / member-outcome seam. Not dominated as
a present-tense "better training" buy; not yet a rational long-horizon
investment. Do not invent a Gym Bucks multiplier. Do not start
reputation here.

*Infinite money.* Unlimited Gym Bucks does not collapse the slice to a
single button. Capacity still faces space/layout. Throughput still does
not add simultaneous positions. Quality still faces preference context.
Buying Q+C+T on the one slice station is possible on an unboxed garage —
acceptable as the first rung only. Later station specialization is the
bar that must create real tradeoffs. Stated rather than hidden.

*Agency.* Current legitimate responses to the opening bench bottleneck:
accept the queue; rearrange layout; Quality; Capacity; Throughput; buy
and place mats; inspect / repair. Staff (novice manager) is a current
control but not a useful policy in 7d (below). Q/C/T are not merely three
purchase buttons: Capacity can be refused by the floor; Throughput and
Quality stay available when Capacity is boxed.

*No-guide.* Player-visible causal sentences, demonstrated by the world
after D.1b:

- Capacity: "People are waiting. I add another bench. Two people can train."
- Throughput: "One bench turns over slowly. I add loading organization.
  People clear it faster."
- Quality: "Members prefer / have a better experience on this competition
  setup."

*Price sensitivity.* Current prices Quality 120 / Throughput 150 /
Capacity 180 are **unchanged**. Mechanism-level distinction exists
without equalizing ROI. Throughput being cheaper than Capacity while
matching opening-fixture completions is acceptable because Capacity
costs space and buys simultaneous users. Quality is a different good.
Do not require equal payback.

*Manager / maintenance.* After wear truth, C.2 manager numbers are
unchanged (no floor on that path). Novice hire 150, auto-repair
threshold 0, never pays off vs hands-off inside 7 days, can still fail
(`failedAt` 34561). The role is supposed to solve unattended wear and
standing repair. It does not, at novice. D2 does **not** buff the
manager and does **not** convert staff into a percentage multiplier.
Reported as a D2 staff-policy failure, deferred rather than patched.

*Facility pacing.* Q/C/T now compete with the 2500 storage-unit move.
Watcher 7d ~9600 still affords relocation and the three axes. Do not
force the old ~22-day Warehouse target; do not retune facility prices
this round. Facility-first, Q/C/T-first, and mixed remain player
choices.

*Constants changed.* None of: Q/C/T prices, earnings, offline fraction /
cap, facility prices, wear *rate*, repair costs, manager wages / hire
cost, failure thresholds, member affinities, service durations,
experience reward, opening purse. Production candidates shipped: wear
in-service seam; occupancy same-snapshot seats; More-drawer **reset gym**
(labeled not-part-of-the-game, starts a new opening garage).

*§5.15 permanent tests.*

- WORLD: PASS. Queues, second bench, plate tree, competition pad, wear,
  and occupancy are on the floor. Occupancy panel now reads the same
  snapshot as the floor.
- AGENCY: PASS for the opening bottleneck's available responses;
  PARTIAL for Quality's long-horizon reason-to-exist.
- INFINITE MONEY: PARTIAL. Space/layout still constrain Capacity;
  Q+C+T-on-one-station is a checklist at this rung.
- NO-GUIDE: PASS. D.1b made each axis's sentence visible.
- INSTITUTION: PARTIAL. A living gym exists. Reputation, tenure, and
  durable member outcomes are explicitly not this stage.

Overall D2: **PARTIAL**. Ship the truth correction and the occupancy
read. Keep current Q/C/T numbers. Do not start reputation.

Human play windows (production economy, More-drawer +1h / +8h / +3d,
reset gym):

- QUEUE-PRESSURE: opening garage, Capacity when a second bench fits.
- TURNOVER-PRESSURE: boxed layout (Capacity preflight refuses),
  Throughput.
- EXPERIENCE / PREFERENCE: Quality on the bay.

Await the human management verdict. Do not start D3 / reputation /
persistent NPCs / Portfolio.

**D2 remains OPEN.** Human play of `b7c09b3` at Chromium 390×844 found
Throughput obviously preferable whenever both axes were legal: Capacity
drew a second bench but did not visibly serve the second waiter within
the observation window. Quality verdict **B confirmed**. Opening agency
is a separate recorded failure (D2-OPENING-01). Do not mark D2 closed.

*D2-TRUTH-01A — unplaced-equipment wear.* CLOSED in D2 (`placedOwnedItems`
/ optional `inService`). Owned ∩ placed. Not utilization-sensitive.

*D2-TRUTH-01B — utilization-sensitive wear.* DEFERRED. Do not widen wear
to owned ∩ placed ∩ actually-used in this piece.

*D2-OPENING-01.* The opening garage presents a bench-capacity problem
(queue visible, purse ~0) before the player can act on that problem.
Mats at 10 GB is not the decision the visible bottleneck is asking for.
D2.1B addresses this by making Throughput the first queue-response at
30 GB (30 watched minutes at 60/hour). Capacity stays 180 (3 watched
hours). Quality stays 120 and closed. Human opening-economy replay is
the remaining verdict; do not mark D2 closed.

*QUALITY VERDICT B CONFIRMED BY HUMAN.* Physical meaning readable
(competition pad). No compelling present-tense reason to spend 120 in
the one-station opening gym. Durable payoff awaits the authorized
reputation / member-outcome seam. Quality 120, experience 1→2, affinity
+0.25. No Gym Bucks multiplier. Do not reopen Quality in D2.1.

Novice manager remains a known failed 7d policy. Not buffed.

**Stage D2.1A — live Capacity transition.** Authorized at `b7c09b3`.
Correctness, not a retune. Q/C/T prices, Throughput 0.65, arrivals,
queue aversion, use durations, and facility size are unchanged.

The D.1 Capacity proof constructed the sim WITH Capacity already active
(cold). The played path is: stock FloorSim with 1 using / 2 waiting, then
`capability` flips, then the same component-local members continue
against a newly-derived two-seat plan. FloorGrid does not recreate
FloorSim on a capability change (only on rung change). `applyInterruptions`
does not fire: station identity and `position` stay the primary.

Opening-garage measurement (seed 1, three powerlifters):

- Stock useCells `[(5,0)]`. Capacity expansion lands at `(5,0)` and
  eats that approach. After: useCells `[(2,2), (7,0)]`, queue cells
  move from the east of the bay to the west.
- Unfixed live upgrade: displaced user snapped onto the NEW seat
  `(7,0)`; the queue head walked to the far rebuilt primary approach
  `(2,2)`. Dual occupancy at **31 ticks**. Next 240 ticks: completions
  6 (same as stock), dual occupancy 57, empty-seat-while-wait 183,
  mean using 1.02. Cold Capacity from tick 0: completions 9, dual
  occupancy 132, dualAt 11. The D.1 proof did not cover the played
  transition.
- Fix, local replan, not a gym reset: a using member whose cell is
  now blocked relocates onto the first walkable use cell (the primary
  approach), so they keep the original bench; remaining seats stay in
  `useCells` order for the FIFO queue. No member recreation, no
  teleport of the room, no queue clear.
- Fixed live upgrade: dual occupancy at **4 ticks** (~0.5 s at the
  shipped 120 ms tick), queue falls at 4 ticks, the second user is
  the waiting member (index 1), both bodies stand on use cells,
  occupancy never exceeds 2, no interruptions. Next 240 ticks:
  completions 8 (beats stock 6), dual occupancy 116, maxUsing 2.
  Cold-from-tick-zero Capacity is unchanged (completions 9,
  maxUsing 2).

Regression: `stationCapability.test.ts` "stock queue → buy Capacity
live → second seat becomes occupied", kept beside the cold-from-tick-zero
Capacity fixture. They prove different things.

D2.1A does not retune Capacity 180 / Throughput 150. C-vs-T strategic
balance and opening agency are D2.1B, after human replay of this
transition. Do not start reputation.

**Stage D2.1A human replay — CONFIRMED AND FIXED at `0ded7fe`.**
Human at 390×844: second bench appeared immediately, original user stayed,
waiting lifter sat, two simultaneous users, queue 2→1, ~4 seconds. No
presentation snap worth fixing. Capacity live-transition is closed.
Do not reopen it.

**Stage D2.1B — Throughput changeover + opening agency.** Authorized
after that replay. Throughput at 0.65 use-shortening was not a real
alternative: after ~26s the panel still read "In use by Powerlifter, 2
waiting". Copy said "faster changeovers"; the implementation shortened
the set and did not affect the current user. There was no explicit
station-turnover interval. Occupancy-from-previous-snapshot is 1 tick;
leaving is the member walking away and does not hold the seat.

Design matrix (chosen **B**):

| Option | Mechanism | Visibility | Opening | Why |
|---|---|---|---|---|
| A keep 0.65 use-shortening | shorter sets | closed 1+2 loop | price-only | copy was a lie; live buy ignores current user |
| **B explicit changeover** | stock 18 ticks / plate tree 6; set duration unchanged | empty bench + "Loading plates" | T=30 is first queue action | honest plate-tree sentence |
| C derive from leaving/walk | distort walking | unbelievable | n/a | leaving is the body leaving, not plates |

Old mechanism: `stationUseTicksFactor` 0.65 on `useTicksFor` at use
entry. New: `FloorSimState.changeovers` per seat. Stock
`FLOOR_SIM_STATION_CHANGEOVER_TICKS` 18 (~2.16s). Plate tree
`STATION_THROUGHPUT_CHANGEOVER_TICKS` 6 (~0.72s). `stationUseTicksFactor`
always 1. Live buy: current set untouched; in-flight changeover capped
at the new duration; next completion uses the new duration. Renderer
has no parallel timer. Panel: "Loading plates, N waiting". Highlight
`floorsim-loading-training-competition-bench-bay` (darkkhaki).

Prices: Quality 120 closed. Capacity 180 = 3 watched hours. Throughput
30 = 30 watched minutes. +1h QA helper affords T, not C. Buying T
delays C by 30 minutes. Floor-space cost of Capacity's 8 extra cells
is mostly future option value on the opening garage (33 free cells;
mats 3×3 can go elsewhere). Boxed layout still refuses Capacity and
leaves Throughput legal.

Measured 240-tick opening garage (seed 1, 3 powerlifters, 120ms tick):

| | completions | maxUsing | dualUsingTicks | loadingTicks | waitingPersonTicks |
|---|---|---|---|---|---|
| stock | 4 | 1 | 0 | 72 | 540 |
| plate tree | 5 | 1 | 0 | 30 | 495 |
| Capacity | 5 | 2 | 72 | 78 | 448 |

C vs T at this horizon is not completions (both 5). Capacity is the
second body. Throughput is shorter loading (72→30) and lower wait.
Do not claim T beats C on completions. Live T: current timer −1;
next changeover arms at 6; in-flight 18 capped to 6.

D2 remains OPEN. Quality verdict B confirmed. D2-TRUTH-01A closed.
D2-TRUTH-01B deferred. Novice manager unchanged. Do not start D3 /
reputation / persistent NPCs / Portfolio.

RECORD CORRECTION (written in D2.2, applying to this SHA's QA helper):
the `+1h` control dispatched `advance-clock` with no `mode`, so
`advanceGymClock` defaulted to `'offline'` and `OFFLINE_EARNINGS_FRACTION`
0.5 applied. One hour from reset paid ~30 Gym Bucks — one hour away — not
one hour of watched garage income at 60/hour. The sentence above that
"+1h QA helper affords T" is true of the *away* helper at T=30, and must
not be read as a watched-hour claim. D2.2 splits the instrument.

---

**Stage D2.2 — balance closeout / consequence boundary.** Authorized after
human play of `aefa31d5` at Chromium 390×844. Not a Capacity-vs-Throughput
price search. Q/C/T prices stay Quality 120 / Capacity 180 / Throughput 30.
Stock changeover 18 ticks / plate-tree 6 ticks stay until a human judges
the loading duration *after* the world presentation is truthful.

*QA clock diagnosis.* GymScreen `+1h` → `advance-clock` with no mode →
`advanceGymClock` default `'offline'` → `OFFLINE_EARNINGS_FRACTION` 0.5.
So the old helper meant one hour of offline elapsed time, not one hour of
watched online operation. Garage 60/hour, offline fraction 0.5, offline
cap, and production accrual are unchanged. The QA instrument is not part
of the game.

New QA labels and modes (exact, from `ladderDevTimeSteps`):

| label | seconds | mode |
|---|---|---|
| +30m watched | 1800 | online |
| +1h watched | 3600 | online |
| +1h away | 3600 | offline |
| +8h away | 28800 | offline |
| +3d away | 259200 | offline |

The week-boundary jump remains away (offline). Reset gym is unchanged.

*D2-CONSEQUENCE-01.* Quality / Capacity / Throughput have truthful physical mechanisms, but the current played floor does not yet convert service quality into a durable member/business outcome.

Source trace (not inferred):

- Gym Bucks on the played path are the frozen D2 facility lump
  (`ladderIncomeRatePerHour(rung)` × banked seconds × online/offline
  fraction, via `advanceGymClock` → `managedCheckIn` → `gymCheckIn` →
  `ladderCheckIn` → `accrueLadderGymBucks`) plus living-member dues
  (`applyLivingMemberDues` ledger delta, credited onto `ladder.gymBucks`
  in the same `advanceGymClock`). FloorSim completions, queue length, wait,
  changeover duration, station training experience, and station utilization
  are not inputs to that rate.
- `memberSatisfaction` and `reputationFromMembers` exist as pure functions
  in `members.ts` and still have no shipped callers outside that file.
  `management.ts` does not import `members.ts`. G.2D's `livingMemberDues.ts`
  is the one shipped caller of `memberDuesGymBucks` / `memberBaseDuesGymBucks`.
  Living dues settle onto `LivingMemberRoster.dues` and the production clock
  path credits that ledger onto `ladder.gymBucks` on top of the D2 facility
  lump. This is not a D2 rate retune. FloorSim completions, queue, wait,
  changeover, and utilization are still not inputs to the spendable
  ladder rate.

Consequences of that graph, not of prices:

- Quality can improve experience / affinity and has no durable played outcome.
- Throughput can shorten real loading; the wait reduction has no durable
  played outcome.
- Capacity has the strongest immediate human consequence because a second
  physical training position is itself visible.

A price can change WHEN a player buys a mechanism. A price cannot create a
missing downstream consequence. At the current graph: lowering Throughput
risks a compulsory starter; raising it makes saving for Capacity more
rational; lowering Capacity makes Capacity more dominant; raising Capacity
can manufacture delay but does not make Throughput's service-quality
improvement matter more to the institution. No further Q/C/T balance search
until the next authorized member-outcome consumer exists. Do not implement
reputation in this piece.

*World-truth: plate loading.* With the station panel closed, an active
changeover must read as plates being changed from the floor. The overlay
reads `FloorSimState.changeovers` remaining ticks against the station's
total (`stationChangeoverTicks`). Visible remaining=total..1 maps onto
progress 0..1 (`(total - remaining) / (total - 1)` when total > 1), so the
last drawn frame puts every disc on the sleeve. Remaining 0 is not drawn.
No parallel presentation timer. Stock and plate-tree share the same
disc-travel job; the tree is the same job faster. No loader NPC, no staff
system. Panel copy "Loading plates" remains supporting confirmation. 18 / 6
remain human-open until this presentation is played — the prior complaint
was that loading was not visible, not that 2.16 seconds was categorically
the wrong duration.

*Incidental, already in this closeout, not expanded:* member / station /
equipment detail panels are `ScrollView`s with `maxHeight` (the same
min-height × garage-height cap the facility drawers already use) so an
open panel cannot grow through `gymscreen-dock` into `shell-leave-gym`.
Floor-reachability 13j is the existing evidence. Do not grow that change.

*D2-OPENING-01 — PARTIAL / DOWNSTREAM-DEPENDENT.* Not closed. The player
now reaches a queue-relevant purchase sooner than before. At the first
relevant affordability band, Throughput is the only live queue-response
button. Saving toward Capacity is economically possible but is represented
as inaction, and the service-quality benefit Throughput creates does not
yet feed a durable member/business consequence. This cannot be honestly
solved by another arbitrary price movement.

*Quality verdict B — frozen.* 120, experience 1→2, affinity +0.25. Physical
meaning readable; strategic consequence incomplete. Evidence for the same
consequence boundary, not a separate anomaly. Do not touch it.

*Capacity D2.1A — remains CLOSED.* Live purchase → second bench → waiter
occupies it → two simultaneous users → visible queue reduction. Do not
reopen.

*Wear / manager debts unchanged.* D2-TRUTH-01A CLOSED. D2-TRUTH-01B
utilization-sensitive wear DEFERRED. Novice manager: known later
staff-policy debt. No work on either.

**Candidate D2 permanent-test verdict — D2 — PARTIAL BY DESIGN / CONSEQUENCE BOUNDARY REACHED.** Do not mark D2 closed before human approval.

PASS:

- Quality mechanism truth
- Capacity mechanism truth
- Throughput mechanism truth
- Capacity live transition
- distinct physical Q/C/T identities
- space refusal
- simulator/world synchronization
- stored/unplaced wear truth
- truthful changeover semantics

PARTIAL (one missing consumer: durable member outcomes):

- opening agency
- Quality strategic payoff
- Throughput strategic payoff
- infinite-money depth
- institution consequences

Do not disguise those partials with price changes. Do not start reputation
until a human explicitly closes D2 and authorizes the next stage.

**Stage D2 human close — CLOSED at `83a8ed4`.** Human world-truth gate at
Chromium 390×844 passed. Permanent ruling:

**D2 CLOSED — PARTIAL BY DESIGN / CONSEQUENCE BOUNDARY REACHED.**

Human findings (station panel closed first):

- Stock changeover: crimson competition-plate discs travel stack → sleeve;
  the floor independently reads as plates being changed; visible loading
  ~2.1 seconds; the final visible frame places every disc on the sleeve;
  remaining=0 removes the loading layer.
- Throughput: bought with the labelled `+1h watched` helper; same three
  discs, same physical loading path, same sleeve; ~0.7 seconds; human read
  is "same loading job faster", not a different or magical effect.
- QA clock: `+1h watched` paid ~+59.97 Gym Bucks; `+1h away` paid ~+29.97.
  Production garage rate remains 60/hour. Offline fraction remains 0.5.

No Capacity-vs-Throughput ROI retest was required.

PASS:

- Quality mechanism truth
- Capacity mechanism truth
- Throughput mechanism truth
- Capacity live transition
- distinct physical Q/C/T identities
- Capacity spatial refusal
- simulator/world synchronization
- stored/unplaced wear truth
- truthful plate-changeover semantics
- closed-panel plate-loading legibility
- watched/away QA-clock truth

PARTIAL / CARRY FORWARD:

- D2-OPENING-01 — PARTIAL / DOWNSTREAM-DEPENDENT
- Quality strategic payoff — PARTIAL
- Throughput strategic payoff — PARTIAL
- Infinite-money depth — PARTIAL
- Institutional consequences — PARTIAL
- D2-TRUTH-01B — DEFERRED
- Novice-manager policy — DEFERRED

D2-CONSEQUENCE-01 remains authoritative. D2 closed because this boundary is
now proven, not because a downstream member/business consequence appeared.
Frozen at mint: Quality 120 / Capacity 180 / Throughput 30; Quality
experience 1→2 and affinity +0.25; stock changeover 18 / plate-tree 6;
garage 60/hour; offline fraction 0.5; Capacity live-transition; plate-loading
path and geometry; QA watched/away modes; panel ScrollView/maxHeight
reachability correction. No further Q/C/T tuning is authorized before a
real downstream consumer exists.

**STAGE E CLOSED — SPORTING REPUTATION FOUNDATION ACCEPTED / WIRING STILL
BLOCKED.** Closed at `b91a84c19fcf561051ec0d651aeda31addd3e882`. Persistent
NPC roster/tenure (Stage G) and Portfolio remain blocked. The
cross-directory Career→Empire wiring remains a later explicit crossing.
Closing Stage E does not authorize any of them.

#### Stage E — reputation feed foundation (pure function; wiring blocked)

**STAGE E CLOSED — SPORTING REPUTATION FOUNDATION ACCEPTED / WIRING STILL
BLOCKED.** Closed at `b91a84c19fcf561051ec0d651aeda31addd3e882`. The
accepted runtime is the Empire-owned pure calculator
`sportingReputationFromResult`. Closing Stage E does not authorize a
Career or Meet result writing `EmpireState.reputation`.

Reputation is the institution's sporting credibility, not another currency
bar. Stage E built the Career-result → Empire reputation calculator as a
pure Empire-owned function. It does not import Career UI, mutate Career
state, write `EmpireState.reputation`, start a persistent NPC roster, or
open Portfolio.

**Input contract** (neutral result shape; the later crossing composes
already-decided facts from several modules — there is no single current
Meet result object that already carries all of these):

- `kind` — GDD §6.1 ladder: local / regional / nationals / worlds
- `outcome` — `'total'` or `'bombed-out'`. No numerical Total. game/meet
  owns posted-total vs bomb-out.
- `placement` — on a posted total only: `place` and `categoryFieldSize`.
  `categoryFieldSize` is the number of competitors in the same award
  category the place is in. A flight is not an award category
  (`src/career/flight.ts`). The crossing owns deriving this from Career's
  category-aware result sheet.
- `isTotalPr` — this meet raised the published best total (result/record
  comparison, not a kg scalar)
- `newlyQualifiedFor` — one new standing (`regional` / `nationals` /
  `worlds`) or null, matching `tierUnlockBetween`'s single `to` tier.
  No stacked rungs. No `local` qualification. Runtime value is `null`
  or a string that is already a qualify rung — arrays, objects, numbers,
  and booleans are refused even when they stringify into a valid rung
  (`String(['regional']) === 'regional'`). The rung must strictly
  outrank the meet kind (Career eligibility already requires
  qualification before a non-local entry):

  - local: regional | nationals | worlds | null
  - regional: nationals | worlds | null
  - nationals: worlds | null
  - worlds: null only

  Jumps (local → nationals or worlds; regional → worlds) are allowed
  because one Total may cross several thresholds and `tierUnlockBetween`
  reports the resulting top `to` tier. A result may not newly qualify
  for its own meet tier or a lower one.

**Refused or deferred** (the current meet model cannot supply them truthfully,
or they would give an existing quantity a second meaning):

- entering a meet, completing nine attempts, opening the app, a streak
- Total kilograms as a reputation scalar (Total already means Total)
- DOTS, e1RM, per-lift PRs as extra gym credit
- fictional opponent prestige, federation rank, hidden performance score
- Gym Bucks, Training IQ, member satisfaction (those stay other axes)

**Two contributors, two grains:**

- sporting: per-result event delta, `sportingReputationFromResult`
- members: per-day rate, existing `reputationFromMembers` (member
  reputation only; no competition-result bonus argument)

Stage E does not add those grains together. A later accounting boundary
may compose an integrated member delta over a defined period with a
sporting event delta once both operands share a grain.

**Placing share:** first of N>1 → full placing unit; last of N>1 → 0;
one-person category → 0. Beating nobody is not a placing accomplishment.
PR and qualification remain independent terms.

**E-REP-01 CHECK-IN REPUTATION SEMANTIC DEBT.** The consumed model still
awards 2 reputation per check-in (730 per year of daily check-ins). That
is inherited activity reputation and has not been reconciled with sporting
credibility. Stage E does not retune `REPUTATION_PER_CHECK_IN`. The Stage E
mint leaves E-REP-01 open: closure does not claim that inherited activity
reputation is now semantically correct. World-level sporting credit is not
held below that inherited source. Check-in reputation is not a cap on
sporting credit.

**Shipped calibration is SPORT-HEAVY** (human ruling). kindScale local 1 /
regional 2 / nationals 4 / worlds 16. placingUnit 24, totalPrUnit 16,
qualifyUnit 16. Reachable title-only versus extras (first of 16 in
category):

- local win 24; +PR 40; +qualify regional 56; +PR +qualify regional 72
- regional title 48; +qualify nationals 112; +PR +qualify nationals 144
- nationals title 96; +qualify worlds 352; +PR +qualify worlds 416
- worlds title 384; +PR 640
- 12 local titles 288

A Worlds title without a Total PR (384) crosses regional recruit (200)
and the first sponsor tier (250). Worlds + PR (640) crosses national
recruit (600). Both stay under legendary (1500) and REPUTATION_MAX
(5000). Local + PR (40) stays under club recruit (50). Conservative
(worlds 8: title 192, title+PR 320) was investigated and discarded — a
Worlds title that cannot hire a regional NPC is not institutionally
meaningful, and is not the shipped recommendation.

**Evidence obligation** (presentation later): when reputation is eventually
wired, the player must be able to tell why it changed. Each sporting term
carries a reason `kind` and a `text` line. No unexplained +REP toast.

**D2-CONSEQUENCE-01 remains true of Quality / Capacity / Throughput.** Those
axes have truthful physical mechanisms, but they still do not write
`ladder.gymBucks`. G.2D living dues do credit the spendable purse on clock
settle, added to the frozen D2 facility lump. That is not a Q/C/T write
and not a D2 rate retune. Stage E does not implement member-side reputation.

**Wiring remains blocked.** Career/Meet result → Empire persistent reputation
state is a later explicit crossing.

#### Stage G.1 — Living Member Identity + Service Outcome Foundation

**STAGE G.1 CLOSED — LIVING MEMBER IDENTITY + SERVICE OUTCOME FOUNDATION
ACCEPTED.** Closed at `c27f714c40e3ad7139eaec84ed340f1255c602ea` by the
targeted Expo 390×844 player-surface replay of G.1C, under the pre-stated
close standard. **G.2A CLOSED** at
`255de8a5cf32b99429bbe864b0dcd01f5201da56`. Historical G.1 / G.1A /
G.1B / G.1C notes below stay as they were.

G.1A identity/service architecture is accepted. G.1B closed pre-human
authority at `8fc4fcbf9d36f829252d35d0e642c5cc3482cce2`. Human gate at
`7c25074e770896428bcfda6f41787fb13b52f167` (390×844 Expo player surface)
produced:

| Leg | Verdict |
|---|---|
| IDENTITY | PARTIAL — persistence real; opening Garage members were three numbered Powerlifters |
| MEMORY | PASS |
| QUALITY | PASS |
| CAPACITY | HUMAN INCONCLUSIVE |
| THROUGHPUT | FAILED PLAYER LEGIBILITY — 95 and 128 ticks both read "long wait" |
| PERSISTENCE | PASS |
| N=5 | ACCEPTED |

**Targeted G.1C replay at `c27f714c` (Chromium 390×844 Expo player surface):**

| Leg | Verdict |
|---|---|
| IDENTITY PRESENTATION | PASS — Nia / Omar / Wren lead the card and the selected-floor cue; Nia was found by name after Back to Training → Gym Empire and after Garage → Storage Unit |
| THROUGHPUT PRESENTATION | PASS — Omar stock history filled with `very long wait`; after Plate tree those rows rolled off to five `long wait` visits |
| CAPACITY | PASS — second bench drawn and serving; Omar stock `very long wait` became `long wait`; Wren's newest visits reached `waited a while` |
| N=5 | PASS — five history rows still scan at 390×844; not retuned |

G.1C is a **presentation translation** correction on that HEAD. It does not
redesign LivingMemberRoster authority, gym-local ids, relocation
reconciliation, memberId observation routing, true `queueWaitTicks`, FloorSim
observations, bounded history, or offline behaviour. Historical G.1 / G.1A /
G.1B notes below stay as they were.

**Three populations stay separate:**

| Population | Module | Persistent? | On played floor? |
|---|---|---|---|
| `MemberType` / `MemberRoster` | `members.ts` | No | Via `ambientMemberRoster()` placement geometry only on the played G.1 path |
| `NpcLifter` | `empireCore.ts` | Yes (idle roster) | Not on floor |
| Living floor members | `livingMembers.ts` | Yes | Yes — `GymViewState.livingMembers` |

**Identity authority (G.1A, current):**

- `GymMemberId` is **gym-local**: `member:n{identityNonce}:{ordinal}`. Facility
  rung is **not** part of identity.
- Facility **relocation** preserves every existing member exactly: `id`,
  `displayName`, `type`, `joinedAtSeconds`, `recentVisits`. Larger facilities
  deterministically **append** new members only
  (`reconcileLivingMemberRosterOnRelocation`); a destination that would require
  fewer members is refused.
- Existing `LivingGymMember.type` is **frozen** during G.1 — equipment purchases
  may change what *new* members would attract, not retag people already on the
  floor.
- `FloorSim` receives authoritative `memberId` + `type` from
  `GymViewState.livingMembers` (`livingPopulation`). `ambientMemberRoster()`
  supplies placement geometry only on the played G.1 path — not member identity
  or type.
- Service observations carry `memberId`; `applyServiceObservations` resolves by
  id and refuses unknown id / type mismatch.
- `queueWaitTicks` means **true queue-cell-arrival → use-start wait**
  (`queueArrivedAt` preserved), not claim-to-use approach time.

**Shipped in G.1 / G.1A:**

- `livingMembers.ts` — `LivingMemberRoster`, `ServiceVisitRecord`,
  `applyServiceObservations`, player-facing tenure / wait / training-experience
  copy. IDs are deterministic from `identityNonce` + ordinal — no
  `Math.random`, no gacha.
- `floorSim.ts` — `stepFloorSimWithObservations` emits observations when a
  member leaves `using` (completed or interrupted), carrying `memberId`,
  `queueWaitTicks`, and `stationTrainingExperience`.
- `ladderView.tsx` / `FloorGrid.tsx` / `GymScreen.tsx` — `livingMembers` on
  `GymViewState`, `apply-living-member-observations` reducer arm, member
  panel shows short id, tenure, and recent service (`no recent service yet`
  when empty).
- `empireTuning.ts` — `LIVING_MEMBER_SERVICE_HISTORY_WINDOWS` candidates [3, 5,
  8]; **shipped window 5** (human-accepted — see G.1C).

**Service-history window (G.1B measurement, G.1C ruling):** Measured roll-off
shows the first good visit is visible immediately at all three candidate
windows; complete bad-history roll-off requires **N** subsequent good visits.
**N = 5 is accepted.** Five rows fit and scan at 390×844; one new good visit
is visible immediately; N=3 would feel too disposable; N=8 would crowd the
card before later member UI. The flatness of five identical "long wait" rows
was a wait-copy granularity failure, not a history-length failure. Do not
retune N.

**G.1C wait copy (presentation only):** Player-facing wait labels remain a
function of `queueWaitTicks` alone — no upgrade name, no Q/C/T ownership, no
fake baseline, no raw ticks as primary UX.

| ticks | label |
|---|---|
| 0 | no wait |
| 1…15 (`SHORT_MAX`) | short wait |
| 16…39 | waited a while |
| 40…99 (`LONG_MIN` … `VERY_LONG_MIN − 1`) | long wait |
| ≥ 100 (`VERY_LONG_MIN`) | very long wait |

`SHORT_MAX = 15` and `LONG_MIN = 40` are unchanged. `VERY_LONG_MIN = 100`
was chosen from the Garage service study (same roster, seed, one-bench
layout, 1000-tick budget):

| condition | n | min | median | mean | p75 | p90 | max |
|---|---|---|---|---|---|---|---|
| stock | 17 | 0 | 132 | 116.59 | 133 | 134 | 134 |
| Quality | 17 | 0 | 132 | 116.59 | 133 | 134 | 134 |
| Capacity | 25 | 0 | 49 | 52.52 | 65 | 93 | 94 |
| Throughput | 22 | 0 | 94 | 86.36 | 96 | 100 | 101 |

Matched `member:n1:0` second completion: stock 128 / Throughput 95.
Candidates 80 and 90 still mapped both to the same phrase. 100 is the
lowest candidate that keeps 95 in "long wait" (not short) and 128 in
"very long wait", with Capacity's whole distribution below the upper tail.
Throughput changeover remains 18 → 6; set duration unchanged.

**G.1C display names (presentation identity only):** `LivingGymMember` carries
a stored `displayName` from a 64-entry curated given-name pool (warehouse
max is 40). Assigned once at creation from the member ordinal; relocation,
observations, Q/C/T purchases, session-equipment changes, navigation, and
offline clock do not rename anyone. New arrivals on expansion get the next
ordinal's name. Names never enter FloorSim, station choice, dues, reputation,
retention, Training IQ, Career, or meet results. Member cards lead with the
given name, then type, then `member N`. The floor does not float names over
every sprite — only the selected member may show a compact name cue.

**Explicitly NOT built (later G stages):**

- No `reputationFromMembers`, `memberSatisfaction`, or dues wiring.
- No retention / departure.
- No offline-fabricated service visits — advancing the gym clock offline does
  not append history.
- No Career/Meet → `EmpireState.reputation` path (Stage E wiring still
  blocked).
- No Q/C/T retune — D2 mint frozen (Quality 120 / Capacity 180 / Throughput
  30; garage 60/hour; offline fraction 0.5).

**What G.1 proves mechanically:** Quality raises completed-use training
experience; Capacity lowers average queue wait; Throughput shortens changeover
(18 → 6 on the competition bench) so at least one stable `memberId` completes
training with strictly lower `queueWaitTicks` than stock on the same roster,
seed, garage, one-bench layout, and tick budget — all measured from real sim
observations matched by `memberId`, not aggregate proxies or array index. That
is causality truth for the player-facing member card, not yet institution
consequences.

**Human gate:** landed at `c27f714c`. Identity presentation, Throughput
copy, and Capacity consequence all passed on the played 390×844 surface.
Closing G.1 does not wire satisfaction / dues / reputation. G.2A derives
recent-service meaning from that history and is closed below. G.2B is
authorized as retention-pressure truth on top of that meaning; G.2C
arrivals/departures, G.2D dues, and G.2E member-side reputation stay
blocked.

#### Stage G.2A — Living Member Satisfaction Truth Foundation

**STAGE G.2A CLOSED — LIVING MEMBER SATISFACTION TRUTH FOUNDATION
ACCEPTED.** Closed at `255de8a5cf32b99429bbe864b0dcd01f5201da56` by the
targeted Expo 390×844 experience replay on that HEAD. No product-code
change from the architecture / G.2A.1 calibration. Independently
verified: mint `ba8561bfd11e9e2a5062923d4054b59e0976dcc0` is one
commit over that HEAD and changes only this document plus four
comment-only lines in `empireTuning.ts`. G.2B is authorized as the
retention-pressure foundation below. G.2C and after stay blocked.

The first human playtest accepted the core semantics (Wren WAIT Rough /
TRAINING Solid / SERVICE Steady / overall Mixed) and left five
translation legs unplayed. The targeted replay on the same SHA closed
those legs:

| Leg | Verdict |
|---|---|
| Service-history truth | PASS (first playtest) |
| Mixed experience readability | PASS (first playtest) — Wren WAIT Rough / TRAINING Solid / SERVICE Steady / overall Mixed |
| Stock training calibration | PASS (first playtest) |
| Wait differentiation | PASS (first playtest) |
| Overall label coherence | PASS, provisionally (first playtest) |
| Reliability baseline | PASS (first playtest) |
| Zero-history presentation | PASS — Omar `RECENT EXPERIENCE Still forming` with no Good/Mixed/Rough claim, first session still in progress |
| Quality translation | PASS — Nia TRAINING Solid → Excellent after Competition pads only; WAIT stayed a wait story (Manageable → Rough); overall Good → Mixed |
| Throughput translation | PASS — Wren WAIT Rough → Strained after Plate tree only; TRAINING Solid; overall Mixed; reason "very long" → "long"; no Throughput bonus line |
| Capacity translation | PASS — second bench drawn and serving; Omar WAIT Strained → Manageable after Second bench only; TRAINING Solid; newest visit reached `waited a while` |
| Interrupted-service translation | PASS — Nia SERVICE Steady → Uneven; `One session was interrupted.`; visit row ending `interrupted`; TRAINING remained Solid |

G.2A derives what recent service **means** to a living member. It does not
start churn, dues, reputation writes, or Gym Bucks changes.

**Audit of the existing member domain (at `fee6d636`):**

| Item | Verdict |
|---|---|
| `queueWaitTicks` / `recentVisits` / `trainingExperience` / `outcome` | REAL + CONSUMED by G.2A |
| `memberSatisfaction` crowding × fit × conditionMultiplier | LEGACY / PROXY; superseded for living-floor service |
| `crowdingLoad` | REAL BUT UNWIRED on the played floor; kept for attraction / aggregate / future offline models |
| `equipmentFitScore` | SEMANTIC MISMATCH for recent service (attraction / mix, not yesterday's session) — G2-FIT-01 |
| `memberDuesGymBucks` / `reputationFromMembers` | REAL BUT UNWIRED; G.2A does not call them |
| `itemCondition` / `stationConditionView` | REAL at gym/item grain; MISSING at service-observation grain — G2-CONDITION-01 |
| FloorSim observation condition field | MISSING |
| type-specific satisfaction interpretation | NOT BUILT — G2-TYPE-01; common service-experience truth first |

**Condition-at-service:** deferred. Observations name a station but do not
snapshot `itemCondition` at use time. No fake 1.0 and no gym-wide mean.
G2-CONDITION-01, G2-FIT-01, and G2-TYPE-01 stay open.

**Wait curve (compared, then frozen):** bounded linear (scale 180),
hyperbolic (scale 90), exponential decay `exp(-ticks / 110)` against the
G.1 Garage means. The 110 is `waitDecayTicks`, an e-folding decay
constant, not a half-life. A true half-life of 110 would be
`exp(-ln(2) * ticks / 110)` and was compared; the shipped formula stays
`exp(-ticks / 110)`. Exponential 110 won: 95 > 128, Capacity wait
clearly above Throughput, Throughput above stock, Quality wait identical
to stock, no step at copy thresholds 15 / 40 / 100.

**Training map (G.2A.1 compared 0.75 / 0.82 / 0.90 with Quality held at
1):** stock experience 1 → 0.82 (Solid); Quality 2 → 1.0 (Excellent).
0.75 maps stock training to Thin and turns Capacity Garage Mixed; 0.90
shrinks the Quality gap to 0.10. 0.82 kept: stock is a working gym,
Quality is meaningfully better, Quality does not erase a severe wait,
Capacity / Throughput do not gain training score.

**Reliability:** interrupted visits exist only for mid-use yank
(player-moved/removed station). Scored 0.55, not zero.

**Composite (G.2A.1 re-evaluated against actual overall bands: Good ≥
0.78, Mixed ≥ 0.62, Rough ≥ 0.45):** arithmetic mean rejected — five
interruptions score Good. Bottleneck-sensitive mean rejected — Quality
Garage overall Rough hides Excellent training, and Throughput's wait
improvement does not survive as a label. Geometric mean of the three
equal-weight component averages is shipped. Recency is the N=5 window;
no extra decay.

**G.2A.1 fixture authority:** living-member scores use the N=5 remembered
window on the 1000-tick Garage fixtures, not G.1 all-observation means.
Exact tables live in `livingMemberExperience.test.ts`.

**Player card:** RECENT EXPERIENCE label + WAIT / TRAINING / SERVICE
components + reason line, above the five visit rows.

**Still blocked after G.2A:** member
departures, dues writes, reputation writes, Career/Meet → Empire
reputation, Portfolio, NpcLifter merge, Q/C/T retune, E-REP-01.
G2-CONDITION-01, G2-FIT-01, and G2-TYPE-01 stay open. G.2B
retention-pressure is authorized separately below; it does not close
those debts and does not start G.2C.

#### Stage G.2B — Living Member Retention Pressure Foundation

**STAGE G.2B CLOSED — COMMON / TYPE-BLIND RETENTION PRESSURE
FOUNDATION.** Human authorization and the stay-risk verdict closed
this stage. Type-specific behavior is handled downstream at G.2C1
rather than rewriting G.2A/G.2B truth. G.2C arrivals/departures, G.2D
dues, G.2E member-side reputation, Career/Meet → Empire reputation,
Portfolio, and NpcLifter merge stay blocked. No member leaves in G.2B.
No new member arrives except the already-accepted G.1 facility-expansion
behavior.

**Current authority:**

| Item | Status |
|---|---|
| G.1 | CLOSED at `c27f714c` |
| G.2A | CLOSED at `255de8a5`; mint `ba8561bf` |
| G.2B | CLOSED — COMMON / type-blind |
| G.2C1 | CLOSED / FROZEN at `c8776cadcb57ef6f16acabe4f962858c6b2dac0a`. No roster deletion in G.2C1. |
| G.2C2 | CLOSED / FROZEN at `1493f43807753eda3654c428e4234702a7da45f4`. Actual departure after eligibility plus one new strain-qualifying observation. |
| G.2C3 | CLOSED / FROZEN at `2b0f52bdcd94004400937e450c8db12727ca74ca`. Vacancy arrival after attraction-qualifying service. No reputation gating. |
| G2-CONDITION-01 | OPEN — service-level condition attribution missing |
| G2-FIT-01 | OPEN — equipment fit is attraction, not recent service |
| G2-TYPE-01 | OPEN — no type-specific **satisfaction** interpretation |
| G2-ATHLETE-SEASON-01 | FROZEN at `9720ea48f34e1f2670088f1c129026d54668776e` (factory freeze; human feel gate not run — not CLOSED). |
| G2-DUES-PURSE-01 | CLOSED — living dues credit the spendable ladder purse on clock settle; D2 facility income stays additive |
| G.2C | G.2C1 frozen. G.2C2 frozen. G.2C3 frozen. Reputation-gated high-paying rates remain G.2E. |
| G.2D | CLOSED / FROZEN at `28611af74dd6479bfad58763ebba72db5942307c`. Living-member dues from G.2A experience. P1 occupancy is time-weighted presence including open-mark production leaves; purse composition in this slice. |
| G.2E | FROZEN at `cf98f4dedbb572850667bd191692779a195caa50` (factory freeze; human feel gate not run — not CLOSED). Member-side institutional reputation from living occupancy; high-paying (Athlete, Serious Lifter) vacancy arrival gated on credited living-member reputation. |
| Career → Empire reputation | CAREER-EMPIRE-REP-01 IN PROGRESS — `GymViewState.sportingReputation` composed with G.2E at points. Literal v1 `EmpireState.reputation` stays unwritten. |
| Portfolio | BLOCKED |

**Proven causal chain:** physical gym decision → real FloorSim service
→ persistent N=5 member history → explainable `LivingMemberExperience`
→ deterministic retention pressure.

G.2B consumes accepted G.2A truth. It does not rebuild satisfaction.
It does not recompute service quality from equipment ownership,
aggregate crowding, facility size, upgrade names, member count, or
current station configuration.

**Product target:** "Nia is starting to question whether this gym is
working for her, and I can see why." Not "Nia has a 34% chance to
quit today." Pressure is membership strain / willingness-to-stay
concern. It is not a probability, daily hazard, countdown, churn
roll, or departure event. The formed `pressure` field is a normalized
index on `[0, 1]`, not a percent chance of leaving. Player copy has
no `%`.

**Common mapping (compared, then shipped):** linear inverse
`pressure = 1 - composite`. Convex `(1 - composite)^2` compressed
Capacity vs Stock in the played band. Logistic
`1 / (1 + exp(8 * (e - 0.535)))` is centered at the Mixed/Rough
midpoint 0.535 with k = 8 and does not hit 0 at experience 1. Linear
is monotone, continuous through Good/Mixed/Rough/Poor presentation
bands, and hits 0 at experience 1 / 1 at experience 0. Complexity
was not added to justify the module. G.2B's value is the semantic
boundary: experience truth → membership consequence input.

**Forming:** G.2A empty history → experience `forming` → retention
`forming`, `pressure` `null`, label `Still forming`. No Stable /
Watching / Strained / At risk claim before there is experience
evidence.

**Membership labels** (bands on pressure, independent of experience
labels): Stable if pressure < 0.22; Watching if < 0.42; Strained if
< 0.55; else At risk. Detail card only; no always-on floor warning
icon; no countdown.

**Type model:** COMMON ships. The function is type-blind. MemberType
does not alter G.2A WAIT / TRAINING / SERVICE / overall experience.
NARROW GDD-backed response (Casual extra strain from accepted WAIT,
Serious Lifter lower pressure at the same experience, no Bodybuilder /
Powerlifter / Athlete G.2B modifier) is compared in
`livingMemberRetention.test.ts` and is not applied **inside G.2B**.
G.2C1 consumes the common signal and applies that narrow response at
the stay-state boundary. That comparison does **not** close G2-TYPE-01:
that debt is type-specific **satisfaction interpretation**, a different
domain from retention response.

**GDD type-quirk reading used here:**

| Type | GDD quirk | G.2B |
|---|---|---|
| Casual | Leaves fastest when crowded | Retention-relevant, but only via accepted WAIT if a type layer ships later. Not `crowdingLoad`. Not shipped. |
| Bodybuilder | Occupies equipment for a long time | Upstream occupancy. No retention modifier. |
| Powerlifter | Raises gym reputation fastest | Reputation. No retention modifier. |
| Athlete | Seasonal — leaves and returns | Deferred as G2-ATHLETE-SEASON-01. Belongs to G.2C. |
| Serious Lifter | Slow to arrive, very slow to leave | Retention-relevant tolerance only, if a type layer ships later. Must not rewrite G.2A labels. Not shipped. |

**Old crowding-sensitivity verdict:** `MEMBER_TYPE_CROWDING_SENSITIVITY`
(casual 1.4 / bodybuilder 0.7 / powerlifter 0.7 / athlete 0.8 /
serious-lifter 0.5) was built for aggregate crowding × fit ×
condition. G.2B does not import or read it, nor `memberSatisfaction`,
`crowdingLoad`, `crowdingSatisfactionMultiplier`, `equipmentFitScore`,
`memberDuesGymBucks`, or `reputationFromMembers`.

**Fences:** no roster mutation, no departure, no dues, no Empire
reputation write, no Career import, no Portfolio, no NpcLifter merge,
no RNG, no `Date.now`, no leave probability. G.2A constants frozen.
Q/C/T frozen (Quality 120 / Capacity 180 / Throughput 30; stock
changeover 18; Throughput 6; garage 60/hour; offline fraction 0.5).
N=5 frozen. Offline clock advance and relocation without a new
service observation leave pressure unchanged. Pressure is derived,
not persisted.

**Player card:** `MEMBERSHIP` line + reason, under recent experience,
on the member detail card only.

**Still blocked:** G.2C arrivals/departures + tenure continuity,
G.2D member dues accounting, G.2E member-side institutional
reputation, Career/Meet → Empire reputation, Portfolio, NpcLifter
merge.

#### Stage G.2C1 — Persistent Stay-Response Foundation

**STAGE G.2C1 CLOSED / FROZEN** at
`c8776cadcb57ef6f16acabe4f962858c6b2dac0a`. This slice turns
repeated accepted G.2B pressure evaluations into a persistent member
response. It does not calculate satisfaction, does not reinterpret
pressure as probability, and does not remove a roster row. Actual
member removal is G.2C2. G.2C3 vacancy arrival is a later slice. G.2D and G.2E
stay blocked.

**Proven causal chain:** physical gym decision → real FloorSim service
→ persistent N=5 member history → G.2A experience → G.2B type-blind
retention pressure → G.2C1 `stayState`.

**Statuses:** `forming` → `staying` → `unsettled` → `considering-exit`
→ `departure-eligible`. Forming is uncertainty, not a stay claim.
`departure-eligible` is a persistent flag, not a departure. G.2C2
consumes that flag; this stage does not delete the row.

**Confirmation rule:** majority of the same five-visit memory window
G.2A ships: `floor(5 / 2) + 1 = 3` consecutive qualifying observations
in the same direction. Neutral evidence breaks the pending streak.
Shortest path from Staying to departure eligibility is nine qualifying
service observations, not three. Sustained Stable service recovers one
state at a time and never returns to forming.

Stock Garage already produces Watching pressure (~0.364). Casual+wait
therefore cannot advance one state every visit; without the majority
rule a default Casual would have been departure-eligible after three
visits.

**Type treatment is the G.2C1 response boundary only.** G.2B remains
COMMON / type-blind. Type does not rewrite WAIT / TRAINING / SERVICE /
overall experience or the pressure index. The classifier is
`livingMemberStayEvidence`; G.2C2 and G.2C3 consume that same function.

| Type | G.2C1 response |
|---|---|
| Casual | May accumulate strain from Watching only when accepted G.2B reasons include wait. Not `crowdingLoad`. |
| Bodybuilder | Common service path. Occupancy is upstream. |
| Powerlifter | Common service path. Reputation is later. |
| Athlete | Common service path. Seasonality remains G2-ATHLETE-SEASON-01 / G.2C. |
| Serious Lifter | Accumulates strain only at At risk. “Very slow to leave” is response tolerance, not a G.2A/G.2B rewrite. |

**Idempotence:** replaying the latest identical service observation is
a full roster no-op. An older tick is refused. Conflicting facts for
the same member/tick fail closed.

**Fences:** no roster mutation, no departure, no random roll, no wall
clock, no leave percentage, no countdown, no dues, no Empire reputation
write, no Career import, no Portfolio, no NpcLifter merge. No
player-facing departure copy. No speculative “departure eligible”
helpers — only the persistent state, the shared evidence classifier,
and transition machinery `livingMembers.ts` actually consumes.

#### Stage G.2C2 — Actual Living-Member Departure Execution

**STAGE G.2C2 CLOSED / FROZEN** at
`1493f43807753eda3654c428e4234702a7da45f4`. This is the first slice allowed
to remove a living member from the active gym roster. It is not a
churn-system rewrite. Arrivals, arrival rates, dues, reputation,
percentages, probabilities, random rolls, countdowns, wall-clock churn,
Athlete seasonality, Career/Meet reputation, Portfolio, and NpcLifter
merging stay blocked except for the G.2C3 vacancy-arrival slice that
follows.

**Eligibility vs actual departure:** G.2C1 reaching `departure-eligible`
does not delete the member. The member stays on the active roster.
Subsequent accepted service observations still pass G.2A → G.2B →
G.2C1. If sustained Stable evidence recovers them out of
`departure-eligible`, no departure occurs. If, while already eligible,
a newly accepted service observation is itself strain-qualifying under
the frozen G.2C1 type-response classifier (`livingMemberStayEvidence`
on that visit’s own G.2A → G.2B reading), the member departs after
that observation is accepted. G.2C1 stay continues to use G.2B of the
N=5 window, so leftover window strain cannot turn a Stable visit into
a leave.

- shortest all-adverse path to eligibility = 9 observations
- earliest all-adverse actual departure = 10 observations

There is no new counter, countdown, probability, random roll, or
elapsed-time hazard. Neutral service while eligible does not itself
cause departure. The tenth observation is the first new
strain-confirming service event after G.2C1 has already established
eligibility.

**Archive / idempotence:** a departed member is removed from
`LivingMemberRoster.members` and stored on `departures`. Exact replay
of the departure-causing observation is a full roster no-op. Same
departed member + same tick + conflicting facts fail closed, including
a type mismatch against the archived snapshot (`memberType` is not
added to G.2A visit history). A later observation for a departed
member fails closed. No silent resurrection. No returning members.

**Identity:** `nextOrdinal` is a monotonic allocator. Departed IDs are
never reused. Relocation expansion mints from `nextOrdinal`, not from
active `members.length`. Display names stay assigned once at creation.
Existing active members keep identity, type, displayName,
joinedAtSeconds, history, and stayState.

**FloorSim:** `reconcileFloorSimPopulation` drops simulator bodies
whose `memberId` is no longer active, preserves survivors (cell,
queue/use, timers, target), reindexes the sim-local index space, and
produces no observation. Unknown/new IDs through this seam fail closed.
`createFloorSimState` may represent an active population smaller than
the facility's ambient placement count; it may not exceed that count.

**Selection:** FloorGrid selection is keyed by `memberId`. If someone
before the selected member leaves, the selected member stays selected.
If the selected member leaves, the card closes. Sprites are keyed by
`memberId`.

**Player-facing:** a last-departure notice names the member and the
accepted G.2B reason. No %, no countdown, no “3 visits left,” no
upgrade-ownership guess, no raw crowdingLoad.

**Still blocked after G.2C2 freeze:** G.2D, G.2E, Athlete
seasonality (G2-ATHLETE-SEASON-01), dues, reputation, Career → Empire
reputation, Portfolio, NpcLifter merge. G.2C3 vacancy arrival is the
next authorised slice.

#### Stage G.2C3 — Vacancy Arrival / Population Replenishment

**STAGE G.2C3 CLOSED / FROZEN** at
`2b0f52bdcd94004400937e450c8db12727ca74ca` (includes P1 honest
Watching/neutral writer proof). After G.2C2 the
active roster can sit below the facility ambient cap. G.1 relocation
still appends when the destination cap is larger. This slice is the
first allowed to mint a new living member at the *current* rung into a
vacancy. It is not a reputation-gated arrival-rate rewrite, not dues,
and not Athlete seasonality.

**Why this stage, and not G.2D / G.2E:** GDD §5.6 says members leave
and the count drops, and that reputation later gates "the arrival rate
of the high-paying member types." G.2C2 made leaving real. Without a
vacancy fill, the gym only shrinks until the next relocation. G.2D
(dues) and G.2E (member-side reputation) stay blocked; reputation-gated
high-paying rates are deferred with G.2E rather than invented here.
G2-ATHLETE-SEASON-01 stays open.

**Vacancy vs actual arrival:** a G.2C2 departure that opens a slot does
not mint a replacement. The observation that executes a departure does
not also arrive. If, while a vacancy exists (`members.length` below
`AMBIENT_MEMBER_COUNT_BY_RUNG[rung]`), a newly accepted service
observation from a remaining member is itself attraction-qualifying
under the frozen G.2C1 type-response classifier
(`livingMemberStayEvidence` on that visit's own G.2A → G.2B reading),
one new member may mint after that observation is accepted.

There is no new counter, countdown, probability, random roll, or
elapsed-time hazard. Offline clock advance does not mint. Neutral or
strained service does not fill a vacancy. Arrivals never exceed the
ambient cap. Departed ordinals are never reused (`nextOrdinal`).

**Type treatment is the G.2C3 arrival-rate boundary only.** G.2B remains
COMMON / type-blind. Type of the new member is `equipmentBiasedMemberTypes`
cycled from the current active count — GDD §5.6's mix-as-consequence-of-
equipment, the same function G.1 creation and relocation already use.
The serving observation's evidence is classified for attraction:

| Arriving type | G.2C3 attraction |
|---|---|
| Casual | May join on recovery or formed-neutral evidence (faster to arrive). |
| Bodybuilder | Common recovery path. Occupancy is upstream. |
| Powerlifter | Common recovery path. Reputation is later (G.2E). |
| Athlete | Common recovery path. Seasonality remains G2-ATHLETE-SEASON-01. |
| Serious Lifter | Joins only on recovery (slow to arrive). |

If attraction is not met, the vacancy stays. The next type is not
substituted.

**Archive / idempotence:** a G.2C3 arrival is appended to
`LivingMemberRoster.members` and stored on `arrivals`. Exact replay of
the attracting observation is a full roster no-op. Same-tick conflicts
on the serving member still fail closed. Invalid join-clock context
fails closed.

**FloorSim:** `reconcileFloorSimPopulation` mints a seeking body for a
newly active `memberId`, preserves survivors, reindexes, and still
refuses a population larger than the facility ambient placement count.
Type mismatch on a surviving identity still fails closed.

**Player-facing:** a last-arrival notice names the member. No %, no
countdown, no dues figure, no reputation claim, no upgrade-ownership
guess.

**Still blocked after G.2C3 freeze:** G.2E member-side reputation (including
reputation-gated high-paying arrival rates), Athlete seasonality
(G2-ATHLETE-SEASON-01), Career → Empire reputation, Portfolio,
NpcLifter merge. G.2D dues accounting is the next authorised slice.

#### Stage G.2D — Living Member Dues Accounting

**STAGE G.2D CLOSED / FROZEN** at
`28611af74dd6479bfad58763ebba72db5942307c`. This is the first
slice allowed to turn living-member presence and accepted G.2A recent-
service meaning into Gym Bucks dues, and to credit those dues as spendable
Gym Bucks income. It is not a reputation write, not a D2 facility-rate
retune, and not Athlete seasonality.

**GDD citation:** §5.6 Members: "They generate income. Dues scale with
count and satisfaction." Count is time-weighted occupancy of the
living roster during the unsettled window — active members plus
in-window G.2C2 departure stubs. Satisfaction is accepted G.2A
composite when experience is formed.
Forming is not a fake score, so forming members pay the published type
base (`memberBaseDuesGymBucks`) rather than `memberDuesGymBucks` with
an invented 0 or 1. Old crowding × fit × condition `memberSatisfaction`
is not an input. `crowdingLoad` is not an input.

**Why this stage, and not G.2E:** G.2C3 made vacancy fill real, so the
gym can hold a living population again. Dues are the income consequence
of that population. Reputation-gated high-paying arrival rates, and
member-side institutional reputation, stay G.2E.

**Proven causal chain:** physical gym decision → real FloorSim service
→ persistent N=5 member history → G.2A experience → type × formed
composite (or forming base) → clock-settled dues ledger.

**Settlement grain:** gym-clock seconds, not FloorSim ticks and not a
per-visit cash-out. `applyLivingMemberDues` is the one ledger writer.
`gymViewReduce` clock advance is the production caller and the purse
composer. Service observations do not credit dues.
`advanceLivingMemberTenure` remains a membership no-op and does not
settle.

**Occupancy during the settle window:** dues are time-weighted presence
over `[dues.settledAtSeconds, toSeconds)`. Active members pay through
the mark, each pro-rated from `joinedAtSeconds` if they joined during
the window. A G.2C2 leave during the window still pays for the stub it
was active — `[max(from, joinedAtSeconds), until)` — using the
gym-clock occupancy mark stamped at leave (`duesLeftAtSeconds`), not
FloorSim ticks. A stamp strictly before the window start pays nothing.
A stamp strictly inside the window is used as-is. A stamp on the
window start is the production observation path: `gymViewReduce` stamps
`collectedAt`, which equals `dues.settledAtSeconds` after every clock
settle, so the exclusive end would otherwise be `[mark, mark)`. That
open mark still occupies the GymHost tick
(`WALL_CLOCK_TICK_INTERVAL_SECONDS`), clipped to the settle window —
the tick the leave occurred in, not the whole following skip. A later
window after that stub is archived pays nothing. A leave with no
gym-clock mark does not invent occupancy, including from an arrival
join clock. Service observations still do not credit dues.

**Idempotence / fail-closed:** exact replay of an already-settled mark
is a full roster no-op. An earlier mark refuses. A non-finite or
negative mark refuses. Same `from`/`to` with a conflicting amount
refuses. Invalid join-clock on a paying member refuses.

**Purse G2-DUES-PURSE-01 CLOSED as composition, not a D2 retune:** living
dues are accounted on `LivingMemberRoster.dues` (`creditedGymBucks`,
settlement archive). The production clock path credits each settlement's
delta onto `ladder.gymBucks`, added to the frozen D2 facility lump
(garage 60/hour and the offline banking policy). Replay of an already-
settled mark is a ledger and purse identity no-op. Replacing or retuning
that facility lump is still a pacing decision this slice does not take.

**Player-facing:** member detail card `DUES` line shows the current
daily rate. The HUD Gym Bucks figure includes settled dues. No %, no
countdown, no reputation claim, no upgrade-ownership guess.

**Fences:** no `reputationFromMembers`, no `memberSatisfaction`, no
Career import, no Portfolio, no NpcLifter merge, no RNG, no `Date.now`,
no leave probability. G.2A/G.2B/G.2C1–C3 frozen. Q/C/T frozen. No
G.2E high-paying arrival rates.

**Still blocked after G.2D freeze:** Athlete seasonality
(G2-ATHLETE-SEASON-01), Career → Empire reputation, Portfolio,
NpcLifter merge. G.2E member-side reputation is the next authorised slice.

#### Stage G.2E — Member-Side Institutional Reputation

**STAGE G.2E FROZEN** at
`cf98f4dedbb572850667bd191692779a195caa50` (factory freeze; human feel
gate not run — not CLOSED). This was the first slice allowed to turn
living-member occupancy into institutional reputation, and to gate the
arrival of high-paying member types on that credited number. It is not
Career/Meet → `EmpireState.reputation`, not a check-in retune, not
Athlete seasonality, and not a pay-to-win purchase.

**GDD citation:** §5.6 Members: "Reputation is earned mostly by
powerlifter and serious-lifter members, and by your own competition
results. It gates: what sponsorship deals you're offered, which
locations you can acquire, and the arrival rate of the high-paying
member types." This slice implements the members half as a gym-clock
rate from living occupancy, and the high-paying arrival-rate gate.
Sponsorships, location acquisition, and competition-result wiring stay
blocked.

**Why this stage, and not Career → Empire:** Stage E already built the
sporting calculator as a pure function. Closing it did not authorize a
Career or Meet result writing `EmpireState.reputation`. G.2E is the
living-roster contributor and the arrival gate that G.2C3 deferred.
Check-in reputation (E-REP-01) is not retuned.

**Proven causal chain:** physical gym decision → real FloorSim service
→ persistent N=5 member history → G.2C2/C3 occupancy → gym-clock
settlement of published type reputation rates → credited living-member
reputation → high-paying vacancy arrival may proceed.

**Settlement grain:** gym-clock seconds, the same occupancy G.2D ships.
`applyLivingMemberReputation` is the one ledger writer. `gymViewReduce`
clock advance is the production caller. Service observations do not
credit reputation. Occupancy stamps stay on `duesLeftAtSeconds`. Type
rate is `memberReputationPerDay` — not `reputationFromMembers` on an
aggregate `MemberRoster`, not old crowding × fit `memberSatisfaction`,
and not a G.2A composite scale. Forming members still occupy, so they
still contribute their published type rate. Casual's published rate is
0. Powerlifter and Serious Lifter raise reputation fastest.

**Occupancy during the settle window:** identical to G.2D. Time-weighted
presence over `[reputation.settledAtSeconds, toSeconds)`. Joins
pro-rate from `joinedAtSeconds`. A G.2C2 leave during the window still
contributes the stub it was active, including a played leave on the
open settle mark occupying the GymHost tick.

**Idempotence / fail-closed:** exact replay of an already-settled mark
is a full roster no-op. An earlier mark refuses. A non-finite or
negative mark refuses. Same `from`/`to` with a conflicting amount
refuses. Invalid join-clock on a contributing member refuses.

**High-paying arrival gate:** Athlete and Serious Lifter are §5.6
Pays=High (`HIGH_PAYING_MEMBER_TYPES`). Vacancy fill still uses G.2C3
evidence rules (Casual faster; Serious Lifter recovery-only; Bodybuilder
and Powerlifter common recovery). High-paying types additionally require
`reputation.creditedReputation >= HIGH_PAYING_MEMBER_ARRIVAL_REPUTATION_THRESHOLD`.
If the gate is not met, the vacancy stays. The next type is not
substituted. The threshold is a first-pass knob scaled to published
per-member-per-day rates (opening Garage is three powerlifters at
0.45/day, so 1 is a bit over two days of stock occupancy), not
`NPC_RECRUIT_REPUTATION_THRESHOLD.club`. Feel is unproven.

**Player-facing:** member detail card `REP` line shows the current daily
type rate. No %, no countdown, no Career claim, no upgrade-ownership
guess. Evidence of *why the gym total moved* (Stage E's reason-bearing
toast) is presentation later; this slice names the daily rate.

**Fences:** no `reputationFromMembers` on an aggregate roster, no
`memberSatisfaction`, no Career import, no Portfolio, no NpcLifter
merge, no RNG, no `Date.now`, no leave probability. No write of
`EmpireState.reputation`. G.2A/G.2B/G.2C1–C3/G.2D frozen. Q/C/T frozen.
E-REP-01 stays open.

**Still blocked after G.2E freeze:** Career → Empire reputation,
Portfolio, NpcLifter merge. G2-ATHLETE-SEASON-01 is the next authorised
slice.

#### G2-ATHLETE-SEASON-01 — Athlete Seasonal Leave / Return

**G2-ATHLETE-SEASON-01 FROZEN** at
`9720ea48f34e1f2670088f1c129026d54668776e` (factory freeze; human feel
gate not run — not CLOSED). This is the first
slice allowed to make Athlete seasonality real: an Athlete on the living
roster leaves the floor for a deterministic shared gym-clock in-season
window, holds their roster slot while away, pays no dues and credits no
reputation while away, and returns as the same `LivingGymMember`. It is
not a G.2C2 departure, not a G.2C3 arrival, not Career/Meet →
`EmpireState.reputation`, not Portfolio, not NpcLifter merge, and not a
pay-to-win purchase. It is not a new Stage G.2F.

**GDD citation:** §5.6 Athlete quirk "Seasonal — leaves and returns."
Leaving is visible — the count drops and you have to find out why.

**Why this slice, and not a churn rewrite:** G.2C1–C3 already own
service-evidence leave and vacancy fill. Seasonality is orthogonal.
G.2D and G.2E already settle occupancy on the gym clock. This slice
composes over those frozen writers. G.2C named the debt; the
implementation sits after G.2E because it consumes that clock.

**G.2E memorial:** G.2E is FROZEN at
`cf98f4dedbb572850667bd191692779a195caa50` (factory freeze). Feel is
unproven. Writing CLOSED would overclaim.

**Event class:** a third class. A season leave is not archived on
`departures`. A season return is not archived on `arrivals`. G.2C2's
"no returning members" applies to *departed* identities and stays true.
`nextOrdinal` is not consumed on return.

**Proven causal chain:** shared gym-clock week index → in-season start
boundary → every active Athlete moves to `season.onLeave` (seat
reserved) → in-season end boundary → the same identity returns to
`members`.

**Settlement grain:** gym-clock seconds. `applyLivingMemberSeason` is
the one season-ledger writer. `settleLivingMemberClock` orchestrates
dues, reputation, then season at each boundary that would actually move
a member. Service observations do not leave or return anyone. Offline
clock advance uses the same arm. `advanceLivingMemberTenure` stays a
membership no-op.

**Calendar:** `ATHLETE_SEASON` knobs (`cycleWeeks` 6, `inSeasonWeeks` 2,
`firstInSeasonWeek` 4). Phase is a function of `trainingWeekIndexAt`.
Event-at-boundary, not a state predicate: an Athlete minted mid-season
stays until the next in-season start. First-pass knobs; feel unproven.

**Occupancy while away:** on-leave rows are absent from `members`, so
FloorSim, dues, and reputation see them as not present. Stubs with
`leftAtSeconds <=` window start are omitted — the open GymHost tick
rule stays for played G.2C2 leaves, not calendar boundaries. With no
Athletes, the orchestrator is today's two ledger calls.

**Capacity:** `vacancyCount` and relocation appends use
`active + onLeave`. C3 type-cycle index uses that same occupied count.
Return cannot exceed the ambient cap.

**Idempotence / fail-closed:** exact replay of an already-settled mark
is a roster no-op. An earlier mark refuses. Non-finite refuses. Dues
and reputation ledgers must share a settle mark. `onLeave` holds only
Athletes, never an active or departed id.

**Player-facing:** one FloorGrid line — "<Name> is away for the season."
or "<Name> is back from the season." No percent, countdown, return
week, or dues figure. Ambient count already drops with FloorSim
population.

**Fences:** no `reputationFromMembers`, no `memberSatisfaction`, no
Career import, no Portfolio, no NpcLifter merge, no RNG, no `Date.now`,
no leave probability. G.2A/G.2B/G.2C1–C3/G.2D/G.2E frozen. Q/C/T
frozen. No rewrite of stay / departure / arrival / dues / reputation
module bodies.

**Still blocked:** Career → Empire reputation, Portfolio, NpcLifter
merge. Feel of the 6 / 2 / 4 week cadence is unproven.
CAREER-EMPIRE-REP-01 is the next authorised slice.

#### CAREER-EMPIRE-REP-01 — Career/Meet → Empire Reputation (Stage E's deferred crossing)

**CAREER-EMPIRE-REP-01 IN PROGRESS.** This is Stage E's deferred
crossing: a played meet result may credit Empire sporting reputation.
It is not a write of literal v1 `EmpireState.reputation`. It is not
Portfolio, not NpcLifter merge, not an E-REP-01 retune, and not a
pay-to-win purchase. It is not a new Stage G.2F.

**GDD citation:** §5.6 Members: "Reputation is earned mostly by
powerlifter and serious-lifter members, and by your own competition
results." G.2E shipped the members half. This slice ships the
competition-results half as a sporting ledger on the played gym tree.

**§5.10 memorial:** "What does not survive: `EmpireState`'s shape."
Prior entries that said Career/Meet → `EmpireState.reputation` named
the crossing, not the v1 field. That phrase now resolves to this
composed v2 reading: `GymViewState.sportingReputation` plus
`institutionalReputation` over the frozen G.2E member ledger. The
literal v1 field stays unwritten.

**Why this slice, and not a v1 write:** `EmpireState` is off the played
path. The played gym is `GymViewState`. G.2E already stores member
reputation on that tree. Stage E named a later accounting boundary that may compose once both
halves share a grain. Both halves are now credited points. Writing v1
cannot compose with G.2E.

**Proven causal chain:** played meet → server `RecordedMeet` →
`MeetScreen.onRecorded` → `AppShell` → `credit-sporting-result` →
Stage E `sportingReputationFromResult` → sporting ledger →
`institutionalReputation` (members points + sporting points).

**Write path:** `GymViewState.sportingReputation` via
`creditSportingResult`. Adapter reads `totalKg` only as null/non-null,
adopts server `isTotalPr` unchanged, and maps
`placing.fieldSize` to Stage E `categoryFieldSize`. Kind comes from
`SPORTING_REPUTATION.playedMeetKindById`. `newlyQualifiedFor` is passed
as null (Career standing is not on the played path). Unknown `meetId`
fails closed. Replay of the same `meetId` is a state identity no-op.

**Grain:** credited reputation points, stamped on the gym clock
(`LadderState.collectedAt`). Member half is
`LivingMemberReputationLedger.creditedReputation`. Sporting half is
`SportingReputationLedger.creditedReputation`. Composer adds points to
points and clamps at `REPUTATION_MAX` on read. The composed number is
not stored. A rate is not added to an event delta.

**Idempotence / fail-closed:** same `meetId` returns the gym state by
identity. Unknown meet id records `not-creditable` and leaves the
ledger identical. A stamp earlier than the last sporting entry refuses.
Malformed facts refuse.

**Player-facing:** diagnostics line in the existing `more` drawer
(`gymscreen-reputation`). No toast. Feel unproven. Player-facing
"why reputation moved" copy is REP-EVIDENCE-01.

**G.2E gate:** high-paying vacancy arrival still reads member-only
`creditedReputation`. Sporting credit does not mint Athlete or Serious
Lifter.

**Fences:** Stage E calculator byte-identical. Every `livingMember*.ts`
byte-identical. `empireCore.ts` / `reputation.ts` byte-identical. No
`src/game/**` edit. `MeetScreen.tsx` is one optional prop and one
effect. No new numeric tuning literal. E-REP-01 stays open.

**Residuals:** REP-GRAIN-01 — the halves share a unit and were
calibrated against different ladders (threshold 1; powerlifter
0.15/day; local title 24). Any later consumer must be calibrated
against the composed reading before it reads it. REP-EVIDENCE-01 —
player-facing evidence copy is not this slice.

**Still blocked:** Portfolio, NpcLifter merge, G.2E gate on the
composed reading, Career calendar / `newlyQualifiedFor`, server write,
E-REP-01, feel Ready.

---

## 6. Meet Day

The emotional centerpiece. Deserves the most design care and polish budget.

### 6.1 Pre-Meet

- Select a meet from the Career calendar (local → regional → nationals → worlds),
  gated by qualifying totals
- Weigh-in beat: pick weight class, water-cut flavor text if cutting close.
  Flavor only — no dieting mechanic.
- Opening attempts pre-filled from current Sim-mode e1RM data as a suggested
  safe opener. Player can override.

**TODO — `career-calendar-placeholder`. Tracked scaffolding, to be deleted when
this section is actually built.** There is no calendar yet, so there is one
ungated door to the one local meet that exists, and a player who opens it a
second time in an app run has their result refused as already recorded (§11 has
the measurement: 612.5 kg banked under `local-open-2026`, the second meet
refused). That left a blank recap. A **minimal placeholder screen** now stands in
its place — one line, reading "Meet complete — results saved to your last recorded meet. Career calendar coming soon.",
with the shell's existing BACK TO TRAINING as the way out.

It is a **stopgap ruled by a human, not a design**, and it deliberately does not
schedule, date, or check eligibility for anything. It lives in
`src/meet/careerCalendarPlaceholder.ts` and
`src/meet/CareerCalendarPlaceholderView.tsx`.
`src/meet/careerCalendarPlaceholder.test.ts` pins the id above in **both** this
document and that module, so deleting either end reddens the suite, and bounds
what the placeholder is allowed to do so a later pass cannot grow it into real
calendar logic while leaving the "temporary" label on. **When the Career calendar
lands, delete all three files and this block together.**

### 6.2 Attempt Loop

Order: squat → bench → deadlift. Three attempts each.

Per attempt:

1. Bar loads, brief walk-out beat
2. Lift resolves through the **Arcade bar-path mechanic**, with lift-specific
   checks:
   - **Squat** — depth timing check in the hole
   - **Bench** — press-timing / bar-speed check off the chest
   - **Deadlift** — lockout grind
3. Sim-mode readiness/fatigue silently adjusts the timing window width
4. Three-light judging call (red/white), with a brief "judges deliberating" beat
   on close calls
5. Depth cue or bar-speed replay clip as feedback

**A BEAT MAY ONLY BE LENGTHENED WHERE SOMETHING IS PLAYING IN IT — THE FIRST TWO
RULES ARE SETTLED; THE THIRD IS PENDING PLAYTEST.** The measurement below is
fact. The three rules under it began as a builder's reading of that fact, headed
"RULED", which claimed an authority no agent in this run has. A human has since
ruled on them, and the outcome splits.
Steps 1 and 4 both escalate on the attempts the meet turns on: a third, a PR, or
one with a bomb on it is held longer than an opener (`walkoutMs` and
`deliberationMs` in `src/game/meetDay.ts`). That is only worth anything if the
extra time carries something, and for six waves it did not: the walk-out's frame
loop stopped at the end of its choreography while the beat ran on for up to
2,680 ms more, so **every millisecond of the escalation §12.2 judges was a
static raster over a decayed sound cue** — 48% of a third-attempt beat with
nothing banked, 56% at a PR. The lever `meetTuning.ts` told a future tuner to
turn only made the frozen frame longer.

Three rules follow. **The first two are SETTLED** — ruled sound, and kept because
reverting either reopens a real defect. **The third is DEFERRED TO PLAYTEST**, and
the distinction matters, so it is spelled out under the rule itself:

- **The walk-out's tail is two named windows**, not a remainder: a BRACE, where
  the loaded bar works under a braced lifter and the hall's standing wave
  carries further back through the building, and a HUSH, where nothing moves and
  the room is quiet before the bar does. `MEET_TUNING.WALKOUT_TAIL` owns both.
  A tail too short to brace in is all hush, which is what an opener is.
- **The brace reads nothing about the LIFTER.** Its amplitude is constant: not
  readiness, not fatigue, not load, not the seed. A brace that varied with
  readiness is §3.4's meter with the numerals filed off, and §12.3 refuses one.

  **Corrected after a critic measured it: the first wording of this rule said
  "amplitude and tempo are constants: not readiness, not load, NOT THE ATTEMPT
  NUMBER", and the tempo half was false when it was written.** The brace period
  is `braceMs / round(braceMs / BRACE_CYCLE_MS)` and `braceMs` derives from
  `walkoutMs(attemptNumber, …)`, so `walkout.ts` tabulates 410 ms on a third,
  405 with a bomb on it, 387 at a PR with a bomb, and **620 ms on a first
  attempt above a PR** — a 60% swing, keyed to the attempt. The file asserted
  the guarantee 255 lines above its own contradicting table, and the test cited
  as evidence built every arm at the same `beatMs`, so the one axis that reaches
  the brace was held constant by construction: an empty domain inside the
  evidence for a §12.3 claim.

  **This is not a §12.3 violation and the rule survives in substance.** Tempo
  tracks the attempt's *stakes* — a number printed on the screen the player just
  left — and not the lifter's readiness; `walkout.ts` imports nothing from
  `fatigue.ts` and `bracePhaseAt(ms, plan)` has no path to a readiness value.
  What was wrong was the sentence, not the code. The rule now claims only what
  §12.3 actually requires and what the tests can redden.
- **Anticipation escalates in DURATION; news escalates in INTENSITY.**
  **— PENDING PLAYTEST. NOT RULED, AND NOT RULEABLE FROM A DESCRIPTION.** The
  walk-out and the wait for the lights are waiting, and waiting is the content,
  so they get longer. The hold AFTER the call is not: the player already knows,
  and every millisecond added there is a frame they are waiting to leave — the
  same defect one screen later. `verdictMs()` therefore takes no attempt
  information. What a reaction may escalate is loudness, and it does:
  `CROWD.URGENT_CHEER_RISE_PX` takes the hall further up on a lift the meet
  turned on.

  **Why this one is deferred rather than decided, and why the deferral names
  PLAYTEST rather than a person.** Whether a meet-deciding third deserves a
  longer look at three white lights is a question about how the beat *feels* in
  the hand. It is not measurable from the artifact and it is not settleable by
  reading a description of it — not by a builder, not by a critic, and not by
  the lead agent reasoning carefully. The builder's own doubt was correct and is
  recorded rather than resolved. Real broadcasts do linger on a big third, which
  is the strongest argument against the rule as written.

  So the code follows this rule today and the tests pin it, but **it is the one
  entry in this section a playtest is expected to overturn**, and overturning it
  is a normal outcome rather than a defect. Do not treat the pins as evidence
  the question is closed; they hold a placeholder shape steady so a tuner has
  something definite to react against.

None of the numbers has been played (§12.1). What is settled here is the shape
of the first two rules; the third is a placeholder held steady for a tuner.

### 6.3 Attempt Selection — The Real Tension

**Attempts within a lift never decrease.** This is the competition rule, not a
difficulty choice: once a weight is taken, the next attempt on that lift either
repeats it or goes up. There is no dropping down, so every attempt decision is
a one-way ratchet — which is exactly where the tension comes from.

After a **make**: a small increase (lock in a bigger total, low miss risk) vs. a
big one (higher miss risk). The floor is already banked; the question is how much
of the remaining attempt to spend.

**"A PR on the line" is a property of a WEIGHT, not of the big card, and the
screen now says it where it is true.** The sentence above used to be attached to
the big option unconditionally, and the code followed: `MEET_COPY.OPTION_BIG_WHY`
was the static string "A PR on the line. Higher risk.", printed on every big card
whatever the lifter's record was. `AttemptOption.isPrAttempt` — the flag the gold
`CARD_PR_EDGE` border is painted from — is `weightKg > previousBestKg` with a
non-null best, and `meetServer.ts`'s `previousBestByLift` answers all-null while
the lifter has no meets on record. So **on a player's first meet the flag was
false on every card and the sentence printed on six of the twelve**, in the same
sitting whose recap calls all three lifts a competition PR (a first-ever lift
beats a null best, so `liftPrs` is true where `isPrAttempt` is false). The app
said a lift both was and was not a PR, one screen apart. It was not only a
first-meet defect either: an opener or a second attempt below the lifter's best
is a non-PR big card too, and most of them are.

The claim is now `MEET_COPY.OPTION_PR_NOTE`, carried on
`AttemptOption.prNote`, which `attemptDecisionFor` fills from the same expression
`isPrAttempt` is read from. It can therefore land on **whichever** option crosses
the best — the small jump, or the repeat of a weight that just beat the lifter —
and the sentence and the border are one decision rendered twice rather than two
that can disagree. `src/meet/AttemptSelectView.test.ts` pins the agreement over
whole meets on both arms; `tools/verify-shell-route.mjs` reads the pair off both
meets a player opened, in a browser, because a node suite cannot see a border.

**The gold border was, until this was written, drawn by nothing a player could
reach.** The app has one meet, no career calendar (§6.1's TODO) and no persistence
across a reload, so a lifter's first meet is the only meet with a fresh record —
and a PR attempt needs a record to beat. The second meet of an app run is where
one first appears, which is why the browser check drives both.

**WHICH WORDS CARRY IT IS PENDING PLAYTEST, AND BOTH OPTIONS STAY LIVE.** What
is settled above is *structural* — the sentence and the border are one decision,
so the screen cannot say "PR" while the border disagrees in either direction.
That does not settle the copy, and the shipped strings are a placeholder rather
than a ruling. Deferred for the same reason as §6.2's crowd-reaction rule: this
is a felt question about what makes an attempt choice tense, and no agent —
builder, critic, or lead reasoning from a description — can resolve it validly.

- **Option A, shipped.** `OPTION_BIG_WHY` describes the jump; a separate
  `OPTION_PR_NOTE` lands on whichever card actually crosses the best. The PR
  call-out goes where the PR is, and the big card stays honest on a first meet.
- **Option B, not built.** One conditional `why` on the big card, worded
  differently when a PR is and is not on the line, with no separate note. One
  sentence per card, and the big card keeps the strongest line when it earns it.

Neither is a defect. The defect was the sentence being unconditional, and that
is fixed either way. A playtester picks between these two by feel, and is
expected to — overturning Option A is a normal outcome, not a regression.

After a **miss**: **repeat vs. increase**. Repeating is the safe play — the same
weight, a second chance at banking it, nothing gained beyond what was already
on the bar. Increasing after a miss is the aggressive one: it concedes the
missed weight is not coming back and reaches past it, which either rescues the
lift outright or spends the last attempt for nothing.

The bite is that a miss does not lower the floor — it *raises* it. A lifter who
misses their opener cannot retreat to something safe; the lightest thing they
can still take is the weight that just beat them.

**Bombing out** (missing all three on a lift) ends the meet with zero on that
lift. This is real and feared in the actual sport. Give it a distinct, somber
moment — narratively honest, not a generic game-over screen, and not punitive.

### 6.4 Scoring

- Total = sum of best successful attempt per lift
- **DOTS** (or Wilks) for cross-weight-class leaderboard comparison. Use the
  correct published formula. Do not homebrew.
- Result feeds Career progression (qualifying totals) and Gym Empire (reputation)

### 6.5 Post-Meet

Recap screen: attempt-by-attempt breakdown, PR call-outs, DOTS score, placing in
field.

**"PR" MEANS TWO DIFFERENT THINGS ONE SCREEN APART. RULED: RECONCILE IT AS ITS
OWN PIECE, NOT AS A PATCH.** `meetServer.ts`'s `liftPrs` treats a null previous
best as beaten, so a first-ever lift *is* a competition PR. §6.3's `isPrAttempt`
requires a non-null best to exceed, so with no record there is no PR to attempt.
Both readings are defensible alone — your first competition squat is your best
competition squat, and it is also not a weight that beat anything — but shipped
together a first meet selects attempts with no PR call-out anywhere and then
prints **PR** against all three lifts on the recap that follows.

The §6.3 work above deliberately did **not** touch this. Which meaning wins is a
decision about what the word promises a player; it lands on the recap, the
shareable result card and the selection screen at once, and changing one of them
inside a change about another is how this document's own history says a *third*
meaning gets created. So the divergence is recorded here and in the tests' own
headers — visible to the next reader rather than rediscovered — and the
reconciliation is scheduled as a piece of its own.

**Shareable result card** formatted like a real federation result sheet. Real
lifters already post meet results on social media as a habit — if the card looks
legitimate, this is the strongest organic growth lever in the game. Treat it as a
feature, not a nice-to-have.

### 6.6 Async vs. Sync

**Local / regional meets — asynchronous (majority of play):**

- Attempts resolve against ghost data (past player results or seeded NPCs)
- Runs on the player's schedule, offline-friendly, low infra cost
- Weekly/biweekly cadence keeps Career progression steady

**Nationals / Worlds — synchronous (rare, seasonal):**

- Scheduled live windows (e.g., a 48-hour "meet weekend")
- Real **flight structure**: lifters grouped into flights of ~10–15, attempts
  resolve in turn order, live leaderboard feed
- Architecturally this is **turn-based with a live feed**, not real-time
  simultaneous netcode. Players submit attempt + weight within a turn window;
  server resolves order and broadcasts. Supabase realtime channels are
  sufficient. Do not build custom netcode.
- Entry gated by qualifying total earned in async meets
- Quarterly Nationals, annual Worlds — scarcity keeps them special

---

## 7. Art Direction

### 7.1 Base Style — 16-bit SNES / Genesis Era

Pixel art, but **not** Game Boy monochrome. The 4-shade palette actively fights
the core mechanic: bar speed, sticking points, and depth cues all need contrast
to read. Competition plates are also color-coded by weight in the real sport —
that is free visual language and should not be thrown away.

16-bit gives enough palette for chalk, singlets, and plate colors, enough frames
for weighty bar-path animation, and enough sprite detail to show strain in a
lifter's body.

Reference feel: heavy, deliberate character sprites in the vein of 16-bit arcade
sports and fighting games. Weight is the whole point — a maximal squat must not
animate like a light one.

**Practical constraint:** pick a fixed internal resolution early and use
nearest-neighbor scaling throughout. Retrofitting this later is painful.

### 7.2 Anime Cut-ins

Hand-drawn anime-style cut-in shots for high-intensity moments. Strong 16-bit-era
precedent; this is a proven pairing, not a novel gamble.

**Where they fire:**

- Third-attempt walkout at a meet
- PR moments (new e1RM, new total, qualifying for a higher tier)
- Bombing out — the somber counterpart
- Coach reactions on a heavy set (ties to the coach voice-pack cosmetic)

**The third PR sub-moment is reached by no screen, and this is where a reader
starting from the source of truth has to be told.** "New e1RM" fires from the
daily close-out and from the recap; "new total" fires from the recap. **"Qualifying
for a higher tier" fires from nowhere** — `cutInGate.ts` accepts the beat and
would fire on it, and no screen in the app can offer it, because tier
qualification is a fact about a lifter's standing across meets and that needs
§6.1's Career calendar, which a human has explicitly deferred. So the moment is
**unbuilt rather than missing**. The disclosure already lives in `cutInGate.ts`
§5 and `RecapView.tsx`, and `cutInWiring.test.ts`'s "THE THIRD PR SUB-MOMENT IS
REACHED BY NO SCREEN" goes red the day one of them starts offering it. Listing
the three flat here, with §11 recording every *other* cut-in residual, left this
one the single gap a reader could not find from the document. **Do not build tier
qualification to close it** — it is downstream of the Career calendar, not of
this section.

**The calendar's standing math now exists and this paragraph still holds, which
is worth saying rather than leaving a reader to check.** `src/career/` computes
standing across meets and reports a tier crossing as `tierUnlockBetween`, but it
is pure logic imported by no screen, so the moment is still offered by nothing
and the pinned check is still green. What the calendar did change is that the
beat now has a definite first firing, and it lands on a lifter's first ever
total — logged in §11 as a playtest question, next to §6.3's PR-border wording.

**Cut-ins are Tier 3 surfaces.** See §7.3 — this is where a licensed portrait or
wordmark would live, never on the base sprite.

**Scarcity is the entire mechanic.** Cut-ins work because they interrupt. Firing
one on every set turns a 60-second daily session into a 2-second tax that players
resent by day 4.

- Hard gate: no more than one per session, ideally not every session
- Always skippable — tap to dismiss. Daily players will see these hundreds of
  times.

**"Session" means one sitting of one mode, and a meet is one — RULED.** The rule
above did not say, and two of the four firing moments happen at a meet. One daily
training session (§3.2) is a session. **One whole meet (§6) — weigh-in to recap —
is also one session**, not one attempt and not one lift. That is the reading that
makes the cap mean anything: a meet is nine attempts, three of them thirds, plus
a recap and possibly a bomb-out, so counting an attempt as a session would permit
four cut-ins in ten minutes, which is exactly the tax this section is written
against. Consequences of the ruling, stated rather than discovered later:

- A meet and a training session on the same day are two sittings and get one
  cut-in each.
- Inside one meet, the first qualifying beat takes the slot. A meet that fires
  the squat's third-attempt walkout will refuse the total-PR and bomb-out
  cut-ins that follow. See the open question in §11.
- **The cap is per sitting, not per screen mount.** The count lives in
  `src/cutin/cutInLedger.ts` for the life of the process, because the app
  un-mounts the host in ordinary play — leaving a meet and opening one again on
  the same day, or flipping to the result card. A count that lived in the
  component would come back at zero under the same session id and the sitting
  would get a second cut-in, which this section forbids and §12.3 refuses. It
  still does not survive a reload; a server-side counter is the real fix (§9.2).

**A third-attempt walkout while that lift can still bomb is not a firing
moment — RULED.** A lift bombs by missing all three, so every bomb-out is
preceded by that lift's own third attempt with nothing banked. Under a
first-come cap that walkout spent the slot the bomb-out was about to need, and
at the starting rates that cost roughly **half of all bomb-outs** the beat this
section calls "the somber counterpart" — the player was instead interrupted with
"LAST ONE" over the attempt that ended the meet. The gate therefore refuses a
walkout beat that carries `bombRisk`. This is a *disqualifier* on a present fact
(`meetDay.ts` already computes it from banked attempts), not lookahead: it can
only ever produce a refusal, and it holds nothing back — the next qualifying
beat may take the slot immediately. **The cost is that the loudest walkout in
the game never carries a cut-in**, and whether that is the right trade is a
playtest question, logged in §11.

**The gate is a module, not a convention.** `src/cutin/cutInGate.ts` owns the cap
and refuses the second request itself, so a caller written later cannot spend a
second cut-in by not knowing the rule. Screens report *beats* — "this is attempt
3 of 3", "the meet ended with a bomb-out" — and the gate decides whether that is
one of the four moments above. "Ideally not every session" is a per-moment rate
(`CUT_IN_TUNING.SESSION_ALLOWANCE`) rolled once per sitting; **the rates are a
starting point and have never been played** (§12.1).

**Priority among simultaneous moments**, highest first: bombing out (terminal and
unrepeatable), third-attempt walkout (§12.2 grades the piece on it), PR, coach
reaction (the most frequent and the least load-bearing). This settles beats that
are true *at the same instant*. Across time the cap is a count, so an earlier
beat wins regardless of rank.

**That ranking currently decides nothing, and the code says so.** Every screen
offers beats of a single kind and each kind maps to one moment, so no request the
app can make produces two candidates. It is kept as a declared invariant — it is
what makes `momentsFor` return a defined order rather than the caller's, and it
is what a future deferral window would be measured against — and a test reads the
real call sites and fails the day one of them starts offering two kinds at once.
Ruled in §11. **It is not what protects the bomb-out**: the bomb-out loses across
time, not at an instant, and the walkout disqualifier above is what fixed that.

**Cut-ins also resolve the tone problem.** Retro sprites read playful, which is
right for the casual funnel but risks undercutting meet-day tension. A hand-drawn
shot of a lifter's face under a maximal attempt carries intensity that cute
sprites cannot. This is the solution to "does meet day feel serious enough."

**Cut art entirely from the early prototypes.** Cut-in art is the most expensive
asset class in this plan and is completely orthogonal to whether the game is fun.
Placeholder rectangles until meet day is proven to land.

**The gate is not the art, and the gate ships first.** Everything above about
scarcity, skippability and where cut-ins fire is *mechanism*, and it is what
decides whether the art will be welcome when it arrives. It is built
(`src/cutin/`); the art is not, per §11's working assumption. What mounts today
is the placeholder Tier 3 *drawing* the identity table already holds (§7.3), read
through the same surface witness a licensed portrait would be — so the art pass,
when it happens, is a row in the identity table and not a rewiring.

**The cut-in composes its own frame; it does not mount the shop panel — RULED.**
The sentence above said "panel" and meant it: `renderCutIn` called
`renderPanels.ts`'s `renderPanel`, which is the character-select and shop
composition. That draws all three tiers at once *on purpose* — art, Tier 3
caption, Tier 2 name tag, Tier 1 colorway strip, and, with no sponsored offer to
name, the **Tier 1 build label**. Right for a shelf a player is choosing from.
On the interrupt beat it printed the partner's name twice — caption and name tag
are the same string for every identity the gate can reach — with `COMPACT BUILD`
underneath. **And that was a §7.3 failure rather than an ugly frame**: `build` is
required on every identity row and every build label is non-empty, so *no row of
the table could remove that line*; only editing a render path could, which made
the promise in the paragraph above false as written. The fix is not a second
renderer. `cutInArt.ts` reads `tier3Of(entry, slot, 'cut-in')` — the same
witness, the same `drawArt` stamp — and lays the drawing and **one** line of
identity text onto a cut-in-shaped grid (`CUT_IN_PANEL`).

**The one line is the Tier 3 caption, not the Tier 2 name tag — RULED.** §7.3
gives Tier 2 the identifying, and this is the one surface where that yields,
because the caption is a field of the *same* `Tier3Content` as the drawing: it
follows the slot. `CUT_IN_ART.SLOT` is per-moment precisely so a later pass can
lead a beat with a wordmark or a product instead of a portrait, and the caption
moves with that while a name tag would not. Two identity sources on one surface
with nothing making them agree is how the doubled name reached the screen in the
first place. **The cost is that a cut-in carries no Tier 2 at all**, and it is
two costs rather than one. A beat led by the `product` slot identifies by picture
and product line rather than by person; and **the cut-in also loses
`tier2.shortName`**, which is the panel's remedy for a name too wide for it. The
substitute is wrapping to `CUT_IN_PANEL.CAPTION_LINES`, then visible overflow,
then a grid that widens to hold it — and a wider grid takes a smaller whole-number
upscale on the phone, so a very long licensed caption costs the interrupt SIZE
where it would only have cost the shelf a shorter string. Neither surface
truncates a licensed mark; that part is deliberate on both. A trade nobody has
seen with real art on it, logged in §11.

### 7.3 The Identity Tier System

How a lifter — fictional or, later, real and licensed — is identified on screen.
This is an **architecture pattern**, and it exists so that adding a real partner
later is a data change rather than an art rebuild.

**No real identity is populated today.** Every entry in this system is a
fictional placeholder until a human explicitly unlocks a named partner against a
real licensing agreement (see CLAUDE.md and §12.3). The tiers describe where a
real identity *would* go, not where one is.

| Tier | Surface | Carries | Never carries |
|---|---|---|---|
| **1** | The base sprite | Build, colorway, icon-mark | Wordmark text, face |
| **2** | The name tag | The actual identification | — |
| **3** | High-fidelity art | Portrait, real wordmark, product photography | — |

**Tier 1 — the base sprite.** Build, colorway and an abstract icon-mark only. No
wordmark text and no face. **This is what already exists**, and it is deliberate
rather than a limitation: at 16-bit sprite scale a wordmark is unreadable and a
face is a smear, so neither was ever load-bearing. The consequence worth stating
is that the base sprite needs **no change at all** to support a licensed athlete
— a real lifter's sprite is a build and a colorway, exactly like a fictional
one's.

**Tier 2 — the name tag.** The name tag does the identifying, and always has in
this genre — that is how 16-bit sports games shipped rosters, and how the result
card already identifies a lifter today. Because identification is a **string**,
it works for a real name the moment one is licensed, with no art dependency at
all. Tier 2 is the whole reason Tier 1 can stay generic.

**Tier 3 — the high-fidelity surface.** Portrait art, a real wordmark, product
photography. It lives on **cut-ins (§7.2), character select, the shop screen, and
the result card (§6.5)** — surfaces that are large, static and deliberate, where
detail reads and a mark can be reproduced faithfully enough to satisfy a brand
guideline.

**Tier 3 never appears on the base sprite.** That separation is the load-bearing
part of the pattern, for two reasons. Artistically, a licensed wordmark rendered
into a 30-pixel figure is both illegible and a brand-guideline violation.
Practically, it means the sprite pipeline never has to know a partner exists — so
losing a licensing deal removes rows from a table and swaps some Tier 3 art,
rather than forcing a re-render of every animation frame.

---

## 8. Monetization

### 8.1 Hard Rule

**Never sell power.** Sim training pace, e1RM growth, and meet-day performance
are 100% skill- and consistency-driven. Any whiff of pay-to-lift-more ends
credibility with the community the game depends on. This is a design constraint,
not a guideline.

**A sponsor does not buy a stat.** The rule holds identically when the money
comes from a brand rather than a player, and this is where it will actually be
tested — a paying partner has leverage a player does not. Any branded or
sponsored consumable is **cosmetic and flavor-only, mechanically identical to the
fictional item it reskins**. A branded chalk is the existing chalk with different
art. A sponsored recovery product does not shorten a setback by an hour.
Placement buys visibility and nothing else.

This is not only ethics, it is the same credibility argument one layer down: a
community that would punish pay-to-win will punish sponsor-to-win faster, because
it reads as the game having been bought. **If a partner asks for a stat effect,
that is a refusal, not a negotiation** — and it is cheaper to have said so in
this document before the conversation than during it.

**No real identity ships un-unlocked.** See §7.3 and §12.3. The licensing system
carries fictional placeholders only until a human unlocks a specific real partner
against an actual agreement.

### 8.2 Currencies

| Currency | Type | Earned | Spent on |
|---|---|---|---|
| **Gym Bucks** | Soft | Idle mode, check-ins, achievements | Cosmetics, gym decor, minor convenience |
| **Chalk** | Premium | Purchased; small trickle from rewarded ads, from **calendar-dated** events, from the season pass **by week** — and from **achievements** and **pass tiers** (see the restriction below) | Cosmetics, timer skips, **Extra Covered Days** at premium rate — the last of these from **non-training-gated Chalk only** |
| ~~Recovery Days~~ | — | — | **Removed by §4.2's Option 1 ruling.** Coverage is a rolling entitlement now, not a held balance. |

**CHALK EARNED BY TRAINING MAY NOT BUY AN EXTRA COVERED DAY. IT MAY BUY
EVERYTHING ELSE.** The restriction is on the *mechanism*, not on the currency,
and the distinction is the whole of this section.

*The hazard, and it is a measurement rather than an argument.* Achievements are
reached by playing, and Chalk buys Extra Covered Days — so a lifter who buys as
soon as they can afford one has a **covered-day arrival their own training
moves**, which is the defect §4.4 traces, one hop further out than the rule that
closed it. §8.3C already re-keyed the season pass so it pays covered days **by
week, never by tier**; that closes the one-hop path and says nothing at all
about the two-hop one, because the pass also pays **Chalk** and a tier unlocks
by playing. Measured on the shipped mechanic with the purchase path live: a
covered day funded by achievement-earned Chalk gives **105 / 305 / 733 / 785
violating pairs at 40 / 60 / 80 / 100 days, worst deficit 54**, against **0** for
the same purse funded on the calendar and **0** for no purchase at all. §8.3E has
the matched design and the full table.

*The fix that was tried first, and rejected.* An earlier revision of this row
deleted the achievement trickle outright — Chalk could no longer be earned by
anything training reaches. That closes the hazard and costs far more than the
hazard is worth: it deletes a whole free-earning path from the game to protect
one purchase. **A human rejected it as too broad.**

**So the restriction is scoped to the purchase.** Achievement-earned and
pass-tier-earned Chalk are ordinary Chalk. They buy singlets, chalk VFX, gym
decor, timer skips and every other thing on the "Spent on" column. The one thing
they may not do is fund a **§8.3E Extra Covered Day**, which accepts only Chalk
from a **non-training-gated source** — a rewarded ad, a calendar-dated event, a
by-week pass payout, Chalk bought with money, or direct real-money purchase.

**AND IT IS ENFORCED IN THE TYPE SYSTEM, NOT BY A VALIDATION.**
`src/game/currencyProvenance.ts` gives every tender an **arrival** — how its
units reach a player's hands — and gates on the arrival rather than on the
tender, so `'chalk-achievement'` and `'chalk-season-pass-tier'` are the *same
row* and closing one closes both by construction.
`SettledCoveredDayPurchase.tender` is the derived non-training-gated subset, so
training-funded money is a **compile error** rather than a runtime branch; the
runtime refuses it as well, with its own error code, for the callers TypeScript
never sees. §8.3E's "how condition 3 is enforced" has the full escalation.

*The general rule this leaves behind, which binds every future earning table:* a
currency that buys coverage **is** coverage, so the safe shapes for Chalk that
may fund coverage are a **rewarded ad** (the player chooses when, and one extra
trained day does not move it) and a **calendar-dated event** — "week 3 of the
season", "the first of the month". The unsafe shape is anything counted in
sessions, streak days or unlocked tiers. Chalk of that shape may still be
*earned*; it simply cannot be *tendered* here.

*What is enforceable in code today and what is not, said plainly.* Nothing in the
codebase pays Chalk yet, so there is still no earning table for a test to fail
against. What exists now is stronger than the negative control that used to be
the only thing here: the tender list itself is written down, every member
declares an arrival, and the day an earning table ships it has to name which
tender it pays — a table that pays `'chalk-achievement'` is fine, and a purchase
funded from it does not compile. The negative control is kept as well, and now
fails if the training-keyed shape ever stops violating.

**What replaced the Recovery Day, and why the replacement is not just the same
thing renamed.** A Recovery Day was a *stock*: bought, banked, carried
indefinitely, and — because a doomed absence took the whole holding —
proportional to how much a lifter happened to have. That proportionality is the
defect §4.4 traces. The **Extra Covered Day** is a *rate widening*: it adds one
covered day **to the window it is bought in and expires with that window**.

*Corrected twice, and the second correction is a **retraction**.* This paragraph
used to say a **bankable** purchased day — one that accumulates across windows —
"is monotone-safe too: 0 violating pairs across three purchase schedules
including ten purchases and a front-loaded block". **That claim is withdrawn.**
Those three schedules were fixed calendar days, which is the arm where the
*expiring* product is also zero, so the measurement was never evidence about
banking at all — it was evidence about calendar funding, taken at zero real
purchases. Under the actual purchase flow a bankable day shows the same kind of
violation as an expiring one: **77 / 275 / 696 / 681** violating pairs at 40 / 60
/ 80 / 100 on the training-funded arm, worst deficit 14 against the expiring
product's 54. A difference in severity, not in kind. (Full population, as with
the expiring table; the committed test runs at
`COVERED_DAY_PURCHASE_SWEEP.SCHEDULES_PER_SEED` and measures 31 / 86 / 150 / 422,
worst deficit 5 — the same finding at a smaller population.)

**What survives, and it is the useful half.** Bankable is clean exactly where
expiring is clean and violates exactly where expiring violates, so switching the
product **buys no safety and costs none**, and the choice stays a pricing and
feel decision. **The burn is what keeps a calendar-funded purchase safe, not the
expiry** — a doomed absence takes everything available including whatever was
banked, so two lifters holding different amounts are both left on zero and the
entitlement refreshes them identically at the next boundary. What keeps a
purchase safe against *training-funded* money is not the burn and not the
expiry: it is the tender restriction above.

**RULED IN, WITH CONDITIONS — see §8.3E.** §4.2's Option 1 ruling removed a
currency; what a player may buy instead was written here as a proposal with its
measurements attached, and a human has since ruled it in subject to three
conditions on provenance, on the invariants and on what may award a purchased
day. All three are discharged in §8.3E. The expiring-versus-bankable question is
still open and is still a product decision rather than a safety one.

### 8.3 Revenue Pillars

**A. Cosmetics (primary, safest)**

- Singlet designs, chalk VFX, bar/plate skins, gym decor themes, lifter appearance
- **Apparel and equipment brand partnerships as a later play.** Deliberately
  unnamed here. An earlier draft of this line listed three real companies as
  examples; they are removed, because §12.3 now forbids a real brand name in any
  asset, string, config or code path, and a design document that names candidate
  partners while stating that rule is the document arguing with itself. The
  category is the plan; the names arrive with the agreements. Routed through the
  §7.3 tier system when they do.
- Coach personality/voice packs for session commentary — pure flavor, zero stat impact
- Meet-day entrance animations — public-facing vanity, high willingness-to-pay

**B. Convenience / time-savers (careful)**

- Gym Empire build and recruit timer skips
- Extra save slots for multiple lifters/careers
- **Never** speed up Sim-mode training progression. That is the credibility line.

**C. Season pass — "Meet Cycle"**

12-week seasons mirroring real competition prep cycles. Free track + premium
track. Cosmetic rewards, Chalk, Extra Covered Days.

**The pass pays covered days BY WEEK, NEVER BY TIER, and that is a measurement
rather than a preference.** A pass tier normally unlocks by playing, and a
covered day granted on a tier is a grant whose arrival day the lifter's own
training decides — which is exactly the shape §4.4 traces as the defect. Measured
on the shipped mechanic at 100 days: a grant keyed to session count gives **1156
violating pairs, worst deficit 54**; keyed to the streak, **54 pairs and 239
lifetime-best inversions**; landed on a fixed calendar day, **0**. So "week 3 of
the season" is safe and "tier 4" is not. `streakEntitlement.test.ts` pins all
three, the two bad ones as negative controls, so a future earning table that keys
off progress fails a test rather than a playtest.

**AND THE SAME HAZARD REACHES THE PASS'S CHALK, WHICH THE RULE AS WRITTEN DID
NOT.** The paragraph above was written about the reward this track calls a
*covered day*. This track also pays *Chalk*, and Chalk buys Extra Covered Days
(§8.2) — so **Chalk on a tier is coverage on a tier, two hops instead of one**,
and the by-week rule protected only the direct grant. That gap was real: measured
with the purchase path live, a covered day funded by tier-earned Chalk gives
**105 / 305 / 733 / 785 violating pairs at 40 / 60 / 80 / 100 days**, against
**0** for the identical purse paid out on the calendar.

**But the two rewards are closed differently, and the difference is the point.**

- **Covered days are paid by week, never by tier.** A covered day on a tier is
  the hazard directly; there is nothing to scope, so the reward moves.
- **Chalk may sit on a tier.** It is spendable on cosmetics, timer skips and
  everything else, and forbidding it would delete a reward to protect one
  purchase — the too-broad fix §8.2 records as rejected. What tier Chalk may not
  do is **fund an Extra Covered Day**, and that is enforced where the purchase
  is rather than where the payout is: the tender is
  `'chalk-season-pass-tier'`, its arrival is `'session-count'`, and
  `SettledCoveredDayPurchase` does not accept it. It is the same table row as
  achievement Chalk, so the pass path and the achievement path are closed by one
  edit rather than by two rules that can drift apart — which is exactly how this
  gap opened in the first place.
- **Cosmetics may sit on tiers**, unchanged, because a singlet does not buy
  protection.

The general form of the rule is in §8.2: *a currency that buys coverage is
coverage* — enforced at the point of purchase, so the currency stays spendable
everywhere else.

**D. Ads (optional, decide after playtesting)**

Rewarded-only. Never interstitial or forced — forced ads in a daily-habit app
will tank retention. Consider skipping entirely if pass + cosmetics perform.

**E. Extra Covered Days — RULED IN, WITH CONDITIONS**

**THE TENDER CONSTRAINS WHAT A PURCHASE DECLARES, NOT WHERE THE MONEY CAME
FROM — and the difference is a real hole, recorded rather than glossed.**
`NonTrainingGatedTender` makes an illegal *declaration* fail to typecheck. It
cannot make illegal *funding* unrepresentable, because the wallet does not
remember: `WALLET_CURRENCIES` is `['gymBucks', 'chalk']` and `ConfirmedWallet`
is one pooled count per currency, so a caller may pass `chalk-purchased` while
the balance it draws on was in fact filled by achievements. Nothing in the type
system or in the runtime guard can tell.

Closing it needs provenance on the *balance* — chalk held as separate
non-training-gated and training-gated sub-balances, with the purchase debiting
only the former. That is a server accounting change, it touches §8.2's currency
model rather than §4.2's coverage model, and it is **not built**. Until it is,
the guarantee is exactly: *the app cannot construct a training-gated covered-day
purchase*, and not *a training-gated currency cannot end up paying for one*.


The purchase path that replaces the Recovery Day, ruled in subject to three
conditions: that a purchased day is provenance-tracked as a genuinely distinct
source, that the §4.4 invariants still hold with purchased days *actually
flowing through the field* rather than structurally present and zeroed, and that
a purchased day is never grantable, earnable or awarded by any in-game action —
enforced, not merely true by the current absence of a code path.

**The product.** One Extra Covered Day widens the current window's entitlement
by one. Flat price in Chalk, or a small bundle at a flat price. It expires at the
end of the window it was bought in. `streak.applySettledCoveredDayPurchase` is
the only way it reaches the mechanic; it takes a **settled order**, so no game
event can call it, and it refuses a backdated one.

**And it refuses to sell during an already-doomed absence** — a human's ruling,
built, with the predicate, the copy rule, the two-directional sweep and the one
known app-open sensitivity all in §4.2 under "The store may not sell into an
already-doomed absence". The short version: a covered day cannot arm the absence
it arrives in, so on a doomed absence the sale is protection the player cannot
receive, and because the doomed burn takes what is live the next session then
eats the day they just bought. Sold a save that cannot save, then billed for it.

**The same-day purchase-timing rule** — bought before a session, armed by that
session; bought after, armed at the next — is likewise an intentional rule now
rather than a residual, and §4.2 carries it.

**Checked against the three rules it has to satisfy:**

- **No pay-to-win (§8.1, §12.3).** It buys *protection*, never *progress* —
  the same category the Recovery Day was carefully kept in, where a save holds a
  run open and never adds to `currentStreak`. A covered day cannot add to a
  streak either: it decides whether an absence ends a run, and nothing else. And
  the per-absence ceiling is out of money's reach by construction — buying ten
  covered days still does not make a five-day absence survivable, because
  `MAX_COVERED_DAYS_PER_ABSENCE` caps what one absence may draw regardless of
  what the window holds. Asserted twice: against the entitlement in isolation,
  and **end to end through the shipped engine**, where the second was needed
  because the first fixture held no purchased days and a mutant that raised the
  draw for anyone holding one left it green.
- **No gacha (§12.3).** Flat price, fixed quantity, no pull, no rarity. The
  quantity is on the order and there is no randomness anywhere in the module.
- **Never punish daily engagement (§12.3).** Measured, and the measurement
  changed the design — see the table below.

#### The measurement, and the condition it failed

**A purchase is safe when the calendar decides the day it lands on, and unsafe
when the lifter's training does.** Three matched arms, one purse, one price, one
rule, a bit-identical lazy member; the only difference is what the *diligent*
lifter's purchase schedule is computed from.

| arm | how Chalk arrives | 40 | 60 | 80 | 100 | worst deficit |
|---|---|---|---|---|---|---|
| **calendar** | on the calendar only | **0** | **0** | **0** | **0** | **0** |
| **frozen** | on achievements, purchase days frozen from the lazy run | **0** | **0** | **0** | **0** | **0** |
| **responsive** | on achievements, recomputed from own training | 105 | 305 | 733 | 785 | **54** |

Violating pairs on `currentStreak`; the lifetime-best row runs 47 / 154 / 349 /
480 on the responsive arm and **0** on the other two. Five seeds, 400 schedules
per seed, every single-day superset — 36,820 to 91,091 pairs per cell. The
committed tests run at 150 schedules per seed for suite time
(`COVERED_DAY_PURCHASE_SWEEP.SCHEDULES_PER_SEED`) and measure 59 / 108 / 203 /
484, which is the same finding at a smaller population.

**The matching is what makes this readable, and an earlier unmatched cut of it
read the wrong way round.** That version compared "buy every 7 days" against
"buy when affordable" and found the training-keyed model looking *better* — an
artifact, because the calendar model also bought roughly twice as many covered
days and a bigger bank hides violations for reasons unrelated to keying. Here
the two arms buy 12,338 covered days on the lazy side in both, and **the
diligent lifter in the responsive arm buys MORE than in the frozen arm — 509,581
against 504,316 — and is beaten more often.** The extra day they earned by
training is what beats them.

**Every one of those 785 violations is created rather than merely uncaught.**
With no purchase at all the same population measures zero, so the ratio of
"violations added to violations removed" is not 2.3 or any other number — the
denominator is empty. A training-keyed purchase on this engine can only add.

#### The consequence: the tender carries a provenance

The first consequence drawn from the table above was to delete the achievement
trickle from §8.2's Chalk row. **A human rejected that as too broad**, and the
rejection is right: it removes a free-earning path from the whole game to close
one purchase.

**What ships instead is a restriction scoped to the mechanism.** A tender for an
Extra Covered Day must come from a **non-training-gated source**.
Achievement-earned and pass-tier-earned Chalk stay fully valid for cosmetics,
timer skips and everything else — and are not a tender here.

**It is structural, not a validation, and that distinction is the human's bar.**
`src/game/currencyProvenance.ts`:

- every tender declares an **arrival** — `'player-chosen'`, `'calendar'` or
  `'session-count'` — and the gating is looked up **from the arrival**, so
  `'chalk-achievement'` and `'chalk-season-pass-tier'` are one row and closing
  one closes both by construction rather than by two checks that can drift;
- `NonTrainingGatedTender` is a **derived** subset — a mapped filter over the
  gating table, never a second hand-written list — and
  `SettledCoveredDayPurchase.tender` is declared as it, so a training-funded
  tender **does not compile**. The compiler's own verdict:
  `error TS2322: Type '"chalk-achievement"' is not assignable to type 'NonTrainingGatedTender'.`
- the runtime refuses it anyway, with a **distinct** error code
  (`TRAINING_FUNDED_TENDER`, not `INVALID_PURCHASE`), because a settled order
  arrives as JSON from an Edge Function and JSON does not typecheck — and
  because "your Chalk is invalid" is a lie about a balance that is valid
  everywhere else;
- the only edit that widens the subset is re-tagging `'session-count'` in
  `ARRIVAL_GATING`, which is one word, in a table with this measurement printed
  above it, and it fails `currencyProvenance.test.ts` and
  `streakEntitlement.test.ts` together.

**And `'chalk'` is no longer a tender at all.** It was the shipped one until this
round, and it was the defect in miniature: "Chalk" was never an answer to "where
did this money come from", and a map asserting that Chalk arrives by
"calendar-or-payment" was a true-sounding claim about a currency made where the
fact lives on the individual units.

#### The sweep, re-run with the restriction in place

Every tender the purchase will accept, at every horizon, with the diligent
member of each pair **recomputing their own purchase days from their own
training** — the strong treatment, not the frozen control. Five seeds,
`COVERED_DAY_PURCHASE_SWEEP.SCHEDULES_PER_SEED` schedules per seed, every
single-day superset.

| tender | arrival | gating | 40 | 60 | 80 | 100 |
|---|---|---|---|---|---|---|
| `real-money` | player-chosen | non-training-gated | **0** | **0** | **0** | **0** |
| `chalk-purchased` | player-chosen | non-training-gated | **0** | **0** | **0** | **0** |
| `chalk-rewarded-ad` | player-chosen | non-training-gated | **0** | **0** | **0** | **0** |
| `chalk-calendar-event` | calendar | non-training-gated | **0** | **0** | **0** | **0** |
| `chalk-season-pass-week` | calendar | non-training-gated | **0** | **0** | **0** | **0** |
| `chalk-achievement` | session-count | **training-gated — refused** | 59 | 108 | 203 | 484 |
| `chalk-season-pass-tier` | session-count | **training-gated — refused** | 59 | 108 | 203 | 484 |

Zero on `currentStreak` **and** on lifetime best, with covered days actually
bought and `purchasedDaysLeft` actually populated in every clean row — a sweep
that bought nothing would report the same zeros and mean nothing.

**The two bottom rows are the negative control and they are unreachable through
the shipped entry point.** They are measured through `streakEntitlement`
directly, because `applySettledCoveredDayPurchase` will not accept those tenders
at all. Keeping them measured is deliberate: a restriction whose justification
nobody re-derives is a restriction somebody eventually relaxes, and these are
the numbers that say what relaxing it costs. They run at the committed
population (150 schedules per seed); the full-population figures are the 105 /
305 / 733 / 785 in the table above.

**A clean row is not the evidence, and saying so is the point.** The five clean
rows are clean *by construction* — a calendar or player-chosen arrival returns
the identical purchase-day list whether it is computed from the lazy schedule or
the diligent one — and the construction is asserted **on the purchase-day list
itself**, not on the outcomes downstream of it: for every legal tender, at every
length, over every pair in the population, adding a trained day must leave the
list byte-identical.

*That assertion exists because a weaker one was tried and measured to be too
weak.* The first version compared the two treatments' aggregate verdicts. A
mutation giving a calendar tender a tiny training sensitivity — one extra Chalk
on the lifter's 60th session — moved **2362 of 34338** purchase-day lists at 100
days, produced **zero** violations at all four lengths, and left every aggregate
in the verdict identical. The sweep was green and the verdict comparison was
green. Only the day-list assertion goes red, and it goes red on the sensitivity
rather than on the day a sensitivity happens to matter. "Empirically clean at the
lengths we happened to test" is what hid this defect twice; the day-list
assertion is what makes this round's claim a different kind of claim.

**And the line is checked from both sides.** Every legal tender is clean, *and*
every banned tender actually violates. The first alone is satisfied by a
restriction that banned far too much — which is the fix that was rejected.

#### Expiring or bankable — still the human's call, and still not a safety one

An expiring consumable is a weaker product than a bankable one: a lifter who
buys a covered day and then does not miss a day has spent money on nothing. That
is honest, and it may also be bad.

**Both were measured again with the purchase path live, and they behave the
same.** A bankable Extra Covered Day — accumulating across windows, never
expiring — is clean on exactly the funding the expiring one is clean on
(non-training-gated tenders, and the frozen treatment of a training-gated one: 0
everywhere) and violates on exactly the funding it violates on (a training-gated
tender, recomputed: 77 / 275 / 696 / 681). Its worst deficit is *smaller* — 14
against 54 — which is a difference in severity, not in kind. So switching the
product buys no safety and costs none, and the choice stays a pricing and feel
decision. The shipped module expires, because that is the conservative default
until somebody rules; switching it is a small change to `creditCoveredDays` and
the test that models the alternative already exists.

**§8.2 used to record the opposite, and that claim is withdrawn there too.** The
"bankable is monotone-safe, 0 violating pairs" line was measured at fixed
calendar purchase days with no real purchase flow, so it was never evidence about
banking. It is corrected in §8.2 rather than left standing beside this
paragraph — two sections disagreeing about one measurement is how the first
version of this got believed.

**One thing the switch WOULD change, and it is worth knowing before choosing.**
Under the expiring product the split between the free counter and the bought one
is provably **unobservable** — `(b, p)` and `(b + p, 0)` behave identically
forever, because both counters reset together at a window boundary, which is
what lets a purchase be provenance-tracked without the provenance being a
mechanic. Under a bankable day the bought counter survives a boundary and the
split becomes observable. That does not make it unsafe — it is measured — but it
does mean the pay-to-win argument would need re-reading rather than re-citing.

The one option to be careful with is letting the purchase **name the window it
applies to**. "Choose when it applies" is a decision taken *during* an absence,
which is the app-opening dependence §4.2 spent a whole rework deleting. **Not
attempted, and not recommended without measuring it first.** What ships instead
is that a purchase applies to the window its own day falls in, and backdating is
refused rather than clamped.

#### How condition 3 is enforced

"Nothing awards a purchased day" is held by **four** guards, because
mutation-testing each one found a hole the others left. Note that guard 1 is
deliberately **wider than this heading**: it polices grants of *coverage*, of
which a purchase is one source and the free rolling window is the other — see
its own paragraph for why the narrower scope was a measured defect.

1. **A declaration allowlist keyed to the field, not the vocabulary**
   (`COVERED_DAY_TOUCHING_FUNCTIONS`). Every top-level declaration **anywhere
   under `src/`** that so much as names a covered day has to be on it, exact in
   both directions — 88 entries across 7 files. The blocklist it replaces —
   banning names containing *grant*, *credit*, *buy* — could not catch
   `markStreakMilestone` handing one out, because that mutant uses none of those
   words. This one does.

   **Its scope has been wrong twice, and both times the fix was measured rather
   than argued.** It first read a hardcoded list of three filenames joined
   against `src/game/`, so a module in any other directory was unreachable by
   construction; a granter planted in `src/shell/appServer.ts` was invisible.
   Widening the *reach* to the whole tree left the *predicate* keyed on the
   single word `purchase` — and this section is about condition 3, but
   §12.3's actual rule is that no grant of **covered** days may be keyed to
   training. `COVERAGE_SOURCES` has two members. A function crediting coverage
   through `'window-entitlement'` every ten sessions contains no form of the
   word "purchase", and with it in the tree `streakEntitlement.test.ts` ran
   **43 tests, 43 passed, exit 0** with `tsc --noEmit` clean. That is the shape
   §4.4 measures at **1156 violating pairs**.

   The predicate is now `/purchas|covered.?day|window-entitlement/i`. Four
   candidates were measured on the tree and all four are pinned in the test:
   narrow (the counter or the source literal) 18 declarations / 3 files;
   purchase-word-only 57 / 7; credit-path tokens 58 / 7; shipped 88 / 7.

   **The credit-path option is the one worth knowing about**, because it catches
   the planted granter and therefore looks like the fix. It is blind to the
   sibling — a widener that keys `COVERED_DAYS_PER_WINDOW` to a session count
   calls nothing on the credit path — which is the rejected narrow predicate's
   failure repeating one level out: a list of tokens somebody thought of, walked
   around by a mutant using a token they did not.

   **What the file-level pin could not have found, recorded because it is the
   uncomfortable part:** widening from the purchase word to the covered day
   added 31 declarations and **not one file**. The hole was entirely inside
   modules the scan was already reading, so the pinned file set was green
   throughout. A pin is only as wide as the axis it is taken on.

   *`currencyProvenance.ts` joined the scan with the tender fix:* it decides who
   may buy, which is where the laundered path went, and the streak modules never
   see an achievement.

   **The known residual, stated rather than left for a reader to find:** every
   predicate here is a *textual* match on a declaration body, so an aliased
   import (`import { creditCoveredDays as credit }`) defeats all four — the
   import sits above the first declaration and is in no declaration's body.
   Closing that needs a type-aware pass, which this scan is not. It is pinned as
   a red line so nobody concludes otherwise by accident.
2. **A behavioural sweep of the whole export surface.** Every exported function,
   called every way it can be called, starting from a state that *holds*
   purchased days, must never return one more than it was given.
3. **An exact arithmetic on the one exempt entry point.** Guards 1 and 2 both let
   `applySettledCoveredDayPurchase` do as it likes — one because it is on the
   list, the other because it is skipped. A training-keyed bonus written *inside*
   it (`purchase.coveredDays + (currentStreak >= 7 ? 1 : 0)`) passed all 175
   tests in both files. That is a covered day awarded for a streak, arriving
   through the one door left open. It now fails: the coverage a purchase adds
   equals what the order says, across states differing in streak length, armed
   state and absence length.
4. **A provenance on the tender, in the type.** Guards 1 to 3 all police what
   *awards* a purchased day, and the hazard did not award one — it awarded
   **Chalk**, and the player bought the covered day themselves. All three guards
   were green while that shipped. `SettledCoveredDayPurchase.tender` is now a
   derived non-training-gated subset, so achievement Chalk is a compile error and
   not a code path; the runtime refuses it with its own code for the JSON callers
   `tsc` never sees; and the gating hangs off the **arrival**, so the achievement
   path and the season-pass-tier path are one row rather than two rules.

**Also revised: the free earning path is narrower than it looked, not gone.**
§4.2's old table paid Recovery Days at signup, at streak milestones, for
achievements and from Gym Empire drops. Milestones and achievements are
progress-keyed, so they cannot pay **covered days** at all. They *can* pay
**Chalk** — an earlier revision of this line said they could not, and that was
the too-broad fix a human rejected. What that Chalk cannot do is fund an Extra
Covered Day. So what a free player gets is the entitlement itself, plus whatever
§8.3C pays by week, plus Chalk from every progress-keyed source spendable on
everything except this one purchase — more than the old free path gave a lapsed
lifter, and less than it gave a diligent one. Whether that is the right trade is
a human's call.

### 8.4 Pricing Anchor

Price cosmetics above typical hypercasual ($2.99–$7.99, not $0.99). This audience
already spends real money on singlets, belts, sleeves, and gym memberships —
premium cosmetic pricing reads as normal to them.

---

## 9. Technical Architecture

### 9.1 Stack

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | React Native + Expo | All TypeScript, all text files — fully agent-workable |
| Animation | Reanimated 4 | Gesture/timing-driven lift animation |
| Rendering | Skia | Bar-path visuals, rep animation |
| Haptics | Expo Haptics | Critical to lift feel — budget real iteration time here |
| Backend | Supabase (Postgres, Auth, Realtime, Edge Functions) | Realtime handles sync flights without custom netcode |

**Why not Unity:** Unity's real work lives in the editor — scenes, prefabs,
inspector wiring, binary assets. An AI coding agent can write C# but cannot drag
components or tune curves, and editor-state reconciliation becomes the bottleneck.
React Native keeps 100% of the project in agent-editable text.

### 9.2 Architecture Rules

- **Server-authoritative progression from day one**, even in prototypes.
  Leaderboards get cheated the moment they matter; retrofitting anti-cheat is
  miserable. All Total/e1RM/meet-result mutations go through Edge Functions.
- **Pure logic separated from UI.** All game math (e1RM, RPE tables, fatigue,
  attempt resolution, DOTS) lives in pure TypeScript modules with unit tests and
  zero React imports.
- **Client is a renderer**, not a source of truth.

### 9.3 Structure

Deliberately unspecified. Choose whatever organization fits, subject to two
constraints above: game math is pure and separately testable, and progression
mutations are server-authoritative.

Keep this document at `docs/GDD.md`.

---

## 10. Build Sequence

> **Two execution modes.** This section describes the *human-paced* build, where
> each phase gates spend on the next. If running a Gauntlet Loop one-shot (§12),
> the phases collapse — the agent builds broadly and the gates become critic bars
> instead of calendar checkpoints. The questions below still matter either way;
> what changes is who answers them and when. Read §12.1 before choosing.

**Do not skip ahead.** Each prototype answers one question. If the answer is no,
stop and fix it before adding content.

### Prototype 1 — Does the lift feel good? (2–4 weeks, throwaway)

One lift. Timing/bar-path mechanic only. No progression, no meta, no art, no
backend.

**Question:** Does grinding a heavy squat out of the hole feel satisfying in
complete isolation?

**Test:** 10–20 people, roughly half real lifters, half not.

**Reality check:** expect ~30 iterations of tweaking timing windows, animation
curves, and haptic patterns by feel. This cannot be reasoned into correctness —
it has to be played. Budget for it.

**If this fails, the project stops.** No amount of Gym Empire or season pass
structure rescues an unsatisfying core input.

### Prototype 2 — Do people come back? (4–6 weeks)

Add readiness check-in → daily session → e1RM progression → streak counter. Still
ugly. Still no other modes.

**Question:** Do people open it on day 3? Day 7?

**Test:** 50–100 users, closed.

**Rough viability signals:** D1 ≥ 35–40%, D7 ≥ 15–20%. Below that, the loop needs
rework — not more content.

### Prototype 3 — Does the payoff land? (4–6 weeks)

Async local meets only. Attempt selection, judging, recap, shareable card.

**Question:** Does meet day feel tense? Do result cards get shared unprompted?

### Then, and only then

Gym Empire → Career calendar → Arcade as standalone mode → monetization → sync
Nationals/Worlds events.

All of that is content and infrastructure layered on a loop already proven to
work.

---

## 11. Open Questions

- [ ] **Gym Empire, Career and Arcade are gated on human playtesting that has
      not happened, and this run cannot lift the gate itself.** §10's "Then, and
      only then" sentence puts all three after the loop is proven; CLAUDE.md
      names one of the three explicitly and calls it non-negotiable — "Do not
      build Gym Empire before the lift mechanic is proven fun." "Proven fun"
      is a human-playtesting claim, not a critic-bar one: CLAUDE.md's own "What
      You Cannot Do" section says a critic cannot judge whether the lift feels
      good, only whether it is built correctly. L1 passed its craft bar; every
      critic on it was explicit that feel itself stayed unverified. So the gate
      is still shut, by the letter of the document that states it, regardless
      of how much else has been built.
      This sits next to a real tension the run does not resolve for itself:
      §12.1 says a Gauntlet Loop run collapses phase gates into critic bars,
      and this run has already built Prototype-3-tier content — meet day,
      result cards, the licensing system — under exactly that reading, without
      waiting for retention data. Cut-in art (§7.2, "cut art entirely from the
      early prototypes... until meet day is proven to land") is the same shape
      of question one level down: §12.2 defines a critic bar for cut-ins, which
      argues for attempting them; §7.2 argues against building the art at all
      yet. Recorded rather than silently resolved either way.

      **GYM EMPIRE IS NOW BUILT, AND THIS ENTRY SAID IT WAS NOT FOR THE WHOLE OF
      THAT BUILD.** §5.1–§5.5 shipped as `src/empire/` — ten modules, merged.
      The sentence that stood here read "the working assumption this run is
      applying: Gym Empire, Career, Arcade and cut-in *art* stay unbuilt", and
      it went on reading that way while eleven pieces of §5 were written against
      it. Corrected here rather than deleted, because the failure is the same one
      §5 spent a wave fixing inside its own modules: a sentence written while it
      was true keeps its confident tone after the code moves, and this one sat
      in the document CLAUDE.md makes authoritative.

      **The gate was not lifted by evidence. It was overridden by a human**, who
      instructed the parallel session to build §5 and recorded the assignment in
      CLAUDE.md's Session Coordination section. That distinction is the whole of
      what this entry should now say: nothing here demonstrates the lift mechanic
      is proven fun, and no critic on this run has claimed otherwise.

      **What was built is the shape the gate's intent survives.** §5 is pure
      logic — zero React, no shell route, no component, nothing a player can
      reach. "Do not build Gym Empire before the lift is proven fun" is a rule
      about shipping an idle layer that competes with the lift for attention; a
      tested pure-math library that no screen imports does not do that. Whether
      that reading is the right one is still a human's call, and it is written
      down so the call can be made on what happened rather than on a summary.

      **Career, Arcade and cut-in *art* remain unbuilt**, and the playtesting
      question above remains genuinely open for all three. Grading and closing
      what already exists continues without waiting on this answer.

      **And the presentation layer has since been played, repeatedly, on a
      real device — which this entry also did not say.** The paragraph above
      was written when §5 was "pure logic — zero React, no shell route, no
      component, nothing a player can reach." That stopped being true at
      Crossing 6 (shell wiring) and has moved further since: §5.13's Phases
      1–4 each cleared a human-playtest gate on a real device (quoted
      verbatim in that section), and — not reflected anywhere else in this
      document — a further run of real-device playtests, recorded in
      CLAUDE.md as S4c through S4i, found and closed a check-in tap nobody
      needed, an offline-versus-watched accrual-rate bug, an unreachable
      first purchase, an untappable screen, and a shell overlay covering real
      controls, each re-verified on the same device after its fix. None of
      that lifts the gate this entry is about — "proven fun" names the lift
      mechanic, Sim Mode and meet day, and nothing above touches it; that
      stays unproven, by design, because nobody has judged it. What actually
      changed is narrower and real: Gym Empire's own feel, as a screen a
      thumb presses, has now been checked against a person holding a phone
      more than once — a different, stronger claim than "pure logic, nothing
      reachable," and one worth recording here rather than leaving for a
      reader to reconstruct from git history, for the same reason this entry
      gives for correcting rather than deleting its own stale sentence above.

- [x] **The licensing screen is not a "mode", so the shell does not have to
      reach it — lead scoping call, overrulable.** A critic grading N1 flagged
      that `LicensingScreen` renders, has tests, and is reachable only at
      `licensing.html?panel=shop` via its own entry bundle, which makes
      `shellRoute.ts`'s comment that a third shell intent "would mean a surface
      that does not exist yet" false as written. The comment is being
      corrected. But §2 names the four modes — Career, Sim, Arcade, Gym
      Empire — and a shop screen is none of them, so N1's bar ("reach every
      mode without a debug URL") is not violated by the licensing surface
      living on a separate bundle. Its purpose is B1's bar instead: fictional
      entries exercising all three identity tiers end to end. **Recorded rather
      than left implicit, because it is a judgement about what a bar covers and
      a human may disagree.** If the shop becomes a player-facing surface with
      an economy behind it, this flips and the shell owns a third intent.

- [ ] Weight units: default to lbs or kg? Per-user toggle presumably, but which
      is the default and does it vary by locale? **This question is about
      *display*.** What unit a meet is *run* in is a separate one, and the build
      has partly ruled it — see "Pound meets run but do not score" below.
- [ ] Does Arcade mode use the *same* difficulty tuning as meet day, or is meet
      day deliberately tighter?
- [ ] How many NPC lifters is the right roster size before it becomes management
      overhead?
- [ ] Ads: in or out? Decide from Prototype 2 retention data.
- [ ] Federation flavor — invented feds, or is there licensing value in real ones
      (USAPL, USPA, NPL)?
- [ ] Equipped lifting: a mode, a cosmetic layer, or out of scope for v1?

**Raised by the build. These are §3 conflicts rather than unknowns — where the
code diverges from this document it is doing so knowingly rather than quietly.
Four are ruled, three are open.** (The count itself was stale at "two and two"
for three entries; corrected here rather than left as decoration.)

- [x] **Meet day played a different lifter from the one you had just trained —
      FIXED, and it made one refusal reachable that had never fired.** §6.1 says
      "opening attempts pre-filled from current Sim-mode e1RM data". They were
      not. `useMeetDay` built a `ServerRecord` of its own on mount, so meet day
      read a lifter with no history at all: the signup seed's openers on day 1
      and on day 400, `totalKg` always `null` so §6.5's recap said FIRST TOTAL
      after every meet a player would ever lift, `meets` always empty so §6.3's
      `isPrAttempt` — **the thing this document calls "The Real Tension"** — was
      dead code in the shipped app. Every unit test was green throughout and had
      to be: the pure modules were all correct, and what was wrong was which
      lifter they were called about. Both hooks now reach one `ServerRecord`
      behind one port (`appSessionPort() === appMeetPort()`).

      **Measured before and after, in a browser, on the shipped route with no
      query string:** a real session is played with a mouse, the e1RM is read off
      the close-out, DONE is pressed, MEET DAY is pressed, the weigh-in is
      confirmed, and the drawn opener is compared. Before: close-out 124.6 kg,
      opener implied 110.0 kg, opener drawn **107.5 kg** — which is 0.9 × the
      120 kg signup seed. After: **110.0 kg**.

      **What this made reachable, stated because it costs a player something.**
      `MEET_ALREADY_RECORDED` guards against banking one meet twice and could
      not fire while the row was rebuilt per mount. It fires now, on the **second
      meet of an app run**, and the verdict is correct — `MEET_LOCAL` is a single
      dated event and competing at it twice is exactly what the guard is for. But
      §6.1 enters a meet from a **Career calendar gated by qualifying totals**,
      and Career mode is unbuilt, so today there is one ungated door to that one
      meet. A player who opens it a second time plays nine attempts and gets no
      recap. They are not stranded — the beat is still `recap`, so the shell
      draws BACK TO TRAINING over it — but it is a blank screen with a way out.
      **The fix belongs to the calendar, not to the meet loop**, and inventing an
      entry gate here would be inventing the calendar. Recorded rather than
      papered over.

- [x] **Session-over-session growth is not coupled to training stimulus —
      RULED, and deferred by decision rather than by oversight.** The readiness
      nudge is a flat constant keyed only to the three check-in taps, so a primed
      tap is free, unverified and strictly dominant: 200 kg → 770.65 kg over 30
      sessions, a PR on 30 of 30. **`e1rm.ts` and its cancellation property are
      correct and stay untouched — that is not the bug.** The gap is that nothing
      yet decides how much stimulus *earns* a heavier prescription, and the fix
      belongs to the fatigue/progression module, which does not exist yet.
      Building a stopgap in the daily loop would be work thrown away plus a
      constant someone later has to unpick, so it is deliberately **not** fixed
      now. The requirement is written into **§3.4** as a stated condition on that
      module: the nudge must scale with RPE and effort history. Until then the
      loop's growth curve is not a shipping progression model and must not be
      tuned as one. The tests that cover it pin **actual** behaviour with a
      pointer to §3.4, so the gap is visible in the suite rather than implied.

- [ ] **The cut-in cap is first-come across time. The same-lift bomb-out case is
      now closed by a disqualifier; the cross-lift case is not.** §7.2 caps
      cut-ins at one per session and the gate enforces it as a count, so the
      first qualifying beat to arrive takes the slot regardless of the priority
      order §7.2 declares.

      **What was fixed, and why the previous entry here was wrong.** This entry
      used to say that a lifter could bomb out and see no bomb-out cut-in, and
      that the only alternative — "hold the slot back if a higher-ranked moment
      might still arrive" — needed lookahead the gate cannot have. **The second
      half was false, and it foreclosed the fix.** `meetDay.ts` sets
      `bombRisk = attemptNumber === ATTEMPTS_PER_LIFT && banked === null`, so a
      lift can only bomb by missing all three and **every bomb-out is preceded
      by that lift's own third-attempt walkout carrying `bombRisk`**. That is a
      *present fact about attempts already taken*, not a forecast, and
      `WalkoutView` was already holding it to pick its copy. Passing it to the
      gate adds no firing moment either — as a **disqualifier** it can only ever
      produce a refusal. So: a third-attempt walkout **while its own lift can
      still bomb is not a firing moment**, and the bomb-out beat is no longer
      starved by the walkout that caused it. At the old tuning
      (`third-attempt-walkout` at 0.5) that was **half of all bomb-outs** losing
      §7.2's "somber counterpart" and instead being interrupted by `'LAST ONE'`
      over the attempt that ended the meet. Pinned by a named test, "A MEET THAT
      BOMBS SHOWS THE BOMB-OUT CUT-IN", and photographed on the played path by
      `tools/capture-cutin.mjs` (`?meet=walkout-third` shows none;
      `?meet=bombed` shows one).

      **What is still open, stated so it is not mistaken for closed.** Two
      things:

      1. **A *different* lift's third attempt can still spend the slot.** Bank a
         squat opener, fire the cut-in on the squat's third, bomb the bench, and
         the bomb-out meets a spent slot. Closing this would mean disqualifying
         a walkout whenever **any** lift could still bomb — which at the squat's
         third attempt is always true, because the bench and the deadlift have
         not started — so it would delete §7.2's first firing moment everywhere
         except a deadlift third with something banked. That is a redesign of
         which beats fire, not a fix, and it is **refused rather than done
         quietly**. Pinned by "THE RESIDUAL, PINNED: ANOTHER LIFT'S THIRD
         ATTEMPT CAN STILL TAKE THE SLOT".
      2. **In a training session a coach reaction fires during the sets and
         takes the slot from the close-out's PR.** Unchanged. The only lever is
         `SESSION_ALLOWANCE['coach-heavy-set']`, which is set lowest for exactly
         this reason.

      **The cost of the fix is real and a human should rule on it.** A third
      attempt with nothing banked is the most loaded walkout in the piece — the
      one that reads "NOTHING BANKED. THIS IS THE LIFT." — and it is now the one
      walkout that can never carry a cut-in. The copy, the crowd and the longer
      beat are unchanged; only the interrupt is gone. Whether the dread beat or
      the somber one should have won **is a feel question only playing a meet can
      answer** (§12.1). If the answer is the walkout, the fix is to delete the
      disqualifier, not to move a rate — a rate cannot buy back a slot that has
      already been spent.

- [ ] **A lifter's FIRST EVER TOTAL unlocks a tier, so §7.2's third PR
      sub-moment may be the first cut-in a player ever sees. PENDING PLAYTEST,
      alongside §6.3's PR-border wording and §6.2's crowd-reaction rule** — the
      same class of question as those two, deferred for the same reason: it is
      about what a beat *feels* like arriving first, and no builder, critic or
      lead reasoning from a description can settle it.

      **The mechanism, which is not a defect and should not be re-flagged as
      one.** `careerTuning.ts`'s `QUALIFYING_TOTAL_KG_BY_TIER.local` is
      `{ mens: null, womens: null }`, because a local meet is the sport's entry
      point and gates nothing — that part is domain-correct and stays. The
      consequence is that `careerStanding` returns `qualifiedTier: 'local'` for
      any lifter with a single posted result, so `tierUnlockBetween(nothing,
      local)` returns `{ kind: 'tier-unlocked', from: null, to: 'local' }`. On a
      first meet that beat is true in the same sitting as "new e1RM" and "new
      total", which are also both true for the first time — and under the
      first-come cap directly above, whichever is offered first takes the slot.

      **Why it is logged rather than fixed.** The C1 builder flagged it in its
      own report — *"may be exactly the wrong first cut-in, and it is a design
      call I made by construction rather than by ruling"* — which is the right
      call: qualifying for the tier everyone starts at is the weakest of the
      three PR sub-moments, and spending a player's first cut-in on it is a
      choice nobody made deliberately.

      **It is not live, and that is what makes this cheap to decide later.**
      `src/career/` is wired to no screen, so §7.2's "the third PR sub-moment is
      reached by no screen" still holds and `cutInWiring.test.ts`'s check on it
      is still green. The three options, so the ruling is a pick rather than a
      design round:

      1. **Floor the unlock at `regional`** — treat qualifying for `local` as
         the starting state rather than an unlock. One arm of
         `tierUnlockBetween`, or one `careerTuning.ts` entry naming the floor.
      2. **Keep it**, and let the first total carry the loudest beat the game
         has. Defensible: a first total *is* the biggest moment in a new
         lifter's career, whatever the tier is called.
      3. **Rank it below "new total"** in `CUT_IN_MOMENT_PRIORITY`, so a first
         meet's recap fires the total-PR and the tier unlock waits for
         `regional`. Note this only helps if the priority order is consulted —
         see the entry directly above, where the cap is first-come and the
         priority order selects nothing in production.

      Whoever wires `src/career/` to a screen inherits this; the wiring piece
      should not pick by default the way this one did.

- [x] **`CUT_IN_MOMENT_PRIORITY` selects nothing in production, and is kept
      anyway — RULED.** §7.2 declares a ranking for moments that are true at the
      same instant. It has never broken a tie in the shipped app and does not
      now: each of the four beat *kinds* maps to exactly one moment, and all
      five call sites offer beats of a single kind, so `momentsFor` returns a
      one-element array on every request the app can make. **The ruling: keep
      the constant, and make the inertness explicit rather than implied.** Three
      reasons. `momentsFor` has to return *some* order, and without the ranking
      it would return the caller's — so "the order the caller lists its beats in
      does not decide" would quietly become false the day a screen offered two
      kinds. The ranking is declared in this document, and deleting the code
      would leave the prose with no implementation. And it is what a future
      deferral window would be measured against. What was **not** acceptable was
      the previous state, where a suite full of priority tests implied the
      ranking was doing work: that block is now named "DECLARED, AND
      UNREACHABLE IN PRODUCTION", and `cutInWiring.test.ts`'s "THE PRIORITY
      ORDER DECIDES NOTHING TODAY, AND HERE IS THE READING THAT SAYS SO" reads
      the real call sites and goes red the day one of them offers two kinds at
      once — which is the day somebody should look at the ranking on purpose.
      **Note that the ranking is not what protects the bomb-out**: priority
      settles one instant, the bomb-out lost across time, and the disqualifier
      above is what fixed it.

- [ ] **A cut-in carries no Tier 2, and a `product`-led beat would identify by
      product line rather than by person.** §7.2's ruling above keeps exactly one
      identity string on the interrupt and makes it the Tier 3 **caption**,
      because the caption is a field of the same `Tier3Content` as the drawing
      and therefore follows `CUT_IN_ART.SLOT`. Today all four moments lead with
      `portrait`, whose caption is the person's name, so the question is
      dormant. It stops being dormant the moment a beat is given a different
      lead: the `product` slot's caption in the placeholder table is
      "Vondrak Signature Singlet", and a cut-in showing a singlet under that
      line names an item where the old panel would have named a lifter. Two ways
      out if a human dislikes it — put the name tag back as a second line, which
      re-introduces the doubling this was written against on every
      `portrait`-led beat, or keep the beats portrait-led and treat a
      product-led cut-in as an advert that belongs on a different screen
      (§8.3A). **Nobody has seen either with real art on it**, which is why this
      is logged rather than settled.

- [ ] **The RPE choice is degenerate on reward.** §3.3 says picking an RPE target
      is "what makes the mode feel real rather than arbitrary." It is not, as
      built: load goes out as `e1RM × chart(reps, rpe) × (1 + nudge)` and the
      estimate comes back as `weight / chart(reps, rpe)`, so the chart cancels
      and **every rung reports the same e1RM**. Measured on a primed day, RPE 6
      gives 209.6 kg and RPE 10 gives 208.8 kg — the *heavier* rung pays
      fractionally less, from rounding. A player optimising for e1RM should
      always take the lowest rung.
      That cancellation is `e1rm.ts`'s central property and **must not be fixed
      by paying higher rungs more** — that is exactly the two-parts-disagree
      failure CLAUDE.md's one-formula rule exists to prevent.
      The identified fix, not built: an **AMRAP top set**. An extra rep is worth
      +4.7% at 100% of e1RM and +3.1% at 76% using only the published chart, so a
      harder rung genuinely pays more without breaking anything. It was left out
      because it adds a decision beat and makes session length unbounded at the
      bottom of the ladder — and session length is one of the three things §12.2
      judges this piece on.
      Until this is ruled on, the rungs differ in **fatigue, injury exposure and
      timing-window width** but not in reward, and §3.3's claim is stronger than
      the code earns.

- [x] **Accessory day has no lift it can name — RULED.** §3.2 puts an accessory
      day in the rotation and `meet.ts`'s `LiftKind` is squat/bench/deadlift.
      **The ruling: `LiftKind` stays exactly three members, matching real meet
      structure. Accessory day does not write `bestE1rmKg` and produces no e1RM
      close-out. It contributes Training IQ (§2's existing currency) and nothing
      else lift-specific.**
      Built against that ruling: the refusals. `sessionServer.ts` fences the
      boundary at compile time — `ACCESSORY_IS_NOT_A_COMPETITION_LIFT`,
      `REPORTED_LIFT_IS_A_COMPETITION_LIFT` and a non-vacuity control — so
      widening `LiftKind`, or widening the wire's `TrainingSetReport.lift` to
      `SimLift` to sneak accessory through, is a build error. And at runtime,
      `NOT_A_COMPETITION_LIFT`, so a hand-edited save or a JSON body naming
      accessory is refused whole. Before this, such a session was **accepted**:
      the streak advanced, a fatigue row was written under `lift: 'accessory'`,
      and `AppliedTrainingSession.bestE1rmKg` came back `undefined` while typed
      `number | null` — the e1RM path survived only because `estimate >
      undefined` happens to be false.
      **Still outstanding, and why `SESSION_TUNING.LIFT_ROTATION` is still three
      lifts:** an accessory day cannot yet be *recorded*. `progression.ts` needs
      a `trainingIq` fact and a proposal kind for a session that reports no
      `LiftKind`. Adding a fourth rotation entry before those exist would put a
      session on screen that the server refuses.
      **The close-out's half of it is built.** `sessionClient.ts`'s
      `CloseOutPayoff` is a three-way discrimination — a confirmed e1RM, one
      still in flight, and `'training-iq'` — and `CloseOutView` renders the third
      as a Training IQ row with NO e1RM row and an em dash where the points will
      go, because there is no `trainingIq` fact for it to read yet.
      `SessionCloseOut.payoff` is a real `SessionPayoff` field, so the branch is
      selected off the close-out's own discriminant rather than off a tag stapled
      on by the preview; `asAccessoryCloseOut` is the one door to it until the
      rotation can produce an accessory day.
      **The WORDS were the last thing to honour this ruling, and for several
      rounds they did not.** The numbers were right — no `bestE1rmKg` write, no
      e1RM node — while `SESSION_COPY` held three close-out headlines, none of
      them accessory, chosen by the client's PR prediction alone. On a primed
      readiness that renders a screen headed **"NEW e1RM"**, subheaded "You beat
      your best estimate on this lift", over a Training IQ row with no number in
      it. A screen headed "NEW e1RM" is an e1RM close-out whatever the digits do.
      `closeOutCopyFor` now picks the words from the same field the numbers
      branch on, and `CLOSE_OUT_ACCESSORY_HEADLINE` is the fourth headline.
      Recorded here rather than only in a commit because of **why it survived**:
      the single fixture demonstrating accessory day was scripted on the one
      readiness band that arithmetically cannot produce a PR, while every other
      close-out beat used the primed one — a demonstration pointed away from the
      case where it fails.
      **How to see it:** open `?session=close-out-accessory` in the running app,
      or capture the whole loop with `node tools/capture-session.mjs`, which
      writes one PNG per beat. `.gauntlet/shots/` is **gitignored**, so no
      screenshot is in the repository and a bare "photographed" claim in a
      committed document could never be self-supporting — which is what this
      sentence used to be. What *is* committed, and does not depend on anybody
      having run a browser: `sessionPreview.test.ts` asserts the headline on that
      exact beat, and asserts by construction that the readiness the beat is
      built on would have produced a PR on a competition lift.
      **One live question inside that work:** §8.1 forbids selling training
      pace, and `progression.ts` answers "can this be bought?" per fact. Training
      IQ is "how *well* you train" and shapes long-run growth, so the answer
      reads as `protected` — but the name `trainingIq` slips past
      `PERFORMANCE_FACT_VOCABULARY.pace`, which is a **name**-based floor
      containing no word it matches. A fact that means pace without naming it is
      precisely what that floor cannot see, so whoever adds it must answer §8.1
      deliberately rather than let the scan answer by silence.

- [ ] **A played session is faster than §3.2's floor, and that is not treated as
      a defect.** §3.2 budgets 60–90 s. Measured by `session.test.ts`, playing
      every rep of the shipped 5 × 3 through the real lift mechanic with a
      cue-obedient player: **54.3 s at RPE 6, 55.6 s at RPE 7, 57.8 s at RPE 8,
      58.3 s at RPE 9, 60.3 s at RPE 10** — machine time only, so four of the
      five rungs land under the floor.
      The suite asserts the **ceiling only**. §12.2 judges this piece against a
      best-in-class daily-habit app on "time-to-first-input, session length, and
      whether the close-out moment lands", and the bar is that ours "must not be
      slower or flabbier" — a session that finishes early wins that bar rather
      than failing it. A `>= 60_000` assertion did exist, and it passed only
      because `SESSION_TUNING.HUMAN_INPUT_BUDGET_MS` — a guess that no shipping
      code reads — was added to the measurement first. Propping a floor up with a
      guessed constant is not a check, so the floor is gone and the divergence is
      recorded here.
      What needs deciding is whether 60 s is a floor at all, or whether §3.2
      means "60–90 s **including** the player's own reading and tapping" — in
      which case there is no divergence, because with that allowance the ladder
      runs 63.3–69.3 s. Until it is answered, the code is faster than the
      document and says so out loud.

**Raised by the build, and this one is a §6.4 decision the document never made.
The code has taken the safe branch and needs a ruling to take any other.**

- [ ] **Pound meets run but do not score.** `meet.ts` exports `POUND_MEET_RULES`
      — a 45 lb bar, calls on 2.5 lb — and runs a full meet on it. It used to
      hand the resulting total to DOTS as though it were kilograms: a 1267.5 lb
      total printed **806.45 DOTS against a truth of ~365.8**, 2.2x wrong,
      formatted to two decimals, above the 700 the suite's own plausibility band
      says no human result reaches, and marked by nothing.
      The engine now records which unit a meet is run in
      (`MeetLoadingRules.unit`, required, on every `TotalReading`), and `dots.ts`
      **refuses** a total it cannot prove is kilograms rather than converting
      one. §6.4 says "use the correct published formula, do not homebrew" — DOTS
      is published in kg only, so scoring a pound total is homebrewing by
      arithmetic. Refusal follows `e1rm.ts`'s precedent (refuse past the chart
      rather than extrapolate) and CLAUDE.md's endorsement of it.
      **Refusal rather than automatic conversion is deliberate and is the part
      that needs ruling.** lb→kg is exact by definition, so the module could
      convert the total — but a DOTS score needs the **bodyweight** in kg too,
      and that number comes from the lifter profile, not from the meet.
      Converting one axis while trusting the other trades a 2.2x overstatement
      for a roughly 2.2x understatement. OpenPowerlifting's own checker carries
      the same warning: "international meets often do weigh-in in pounds, but
      lifting in kilos, so keep those separate."
      `buildResultCard` refuses a pound meet outright (`UNSUPPORTED_MEET_UNIT`)
      because every column on that sheet — weight class, bodyweight, DOTS — is a
      kilogram column.
      **The refusal now reaches the WRITE path too, and that is a change of
      substance rather than of coverage.** Both refusals above are reads, and
      both run *after* the total has been recorded: `applyMeetResult` is the one
      function in the codebase that moves Total, and it used to take
      `finalMeetTotal(state)` — the reading with its unit discarded — straight
      into `record.totalKg`, into `MeetResultWire.totalKg` (which has no unit
      field, so the unit is unrecoverable once it is there), and into
      `placingFor` against a kilogram ghost field. A card that refuses to print
      is not a defence of a number already banked. `applyMeetResult` now checks
      the reading's unit before anything is written and returns
      `UNSUPPORTED_MEET_UNIT`, spelled the same as `resultCard.ts`'s because it
      is one refusal reached at two points in one pipeline. It does not convert,
      for the reason above: a meet result is the total *and* the bodyweight, and
      those are two independent facts in two independently-chosen units.
      **AND THE BODYWEIGHT IS NOW CHECKED TOO, which is the half that mattered
      more.** For a round the write path hard-refused the number it could check
      and silently accepted the one it could not, three lines apart in the same
      object literal — and that made the refusal's own advice into a trap. A
      caller who did exactly what it said, converted the *attempts*, and ran the
      meet under kilogram rules passed the total's check cleanly and banked a
      bodyweight 2.2x too heavy. Nothing downstream would have caught it: 92.4 kg
      entered as 203.7 lb sits **inside** the published DOTS bodyweight domain
      (40–210 kg male), so it is not clamped, not out of domain, and not refused
      by `dots.ts` or `resultCard.ts` — both of those refuse on the *total's*
      unit. The consequence was a permanently wrong DOTS denominator and a lifter
      filed in the heaviest weight class.
      `MeetResultReport.bodyweight` is now a `BodyweightReading` — a tagged
      `{ unit, kilograms | pounds }` pair rather than a branded number, because
      the consumer that has to be convinced is a **server** and a brand does not
      survive JSON. Its two arms carry different field names, so a kilogram
      number cannot be reached without narrowing on the unit: deleting the check
      in `meetServer.ts` is a compile error rather than a quiet test. The unit is
      *declared at the source* (`MeetEntry.bodyweight`) and forwarded, not
      stamped on the way past, and `MeetDayContext.entry` is a
      `KilogramMeetEntry`, so a pound-weighed lifter does not compile into a meet
      at all. What remains unclosed and is named as such: a caller can still
      write `{ unit: 'kg', … }` over a pound number, which is a lie somebody has
      to type, not a field that means nothing.
      **AND THE NINE ATTEMPT WEIGHTS ARE NOW CHECKED TOO, which is the third and
      last field on this path.** For two rounds the total's unit came off
      `readTotal(state)`, `state` came off `createMeet(meet.rules)`, and `meet`
      was an argument the caller passed *beside* the report — so the unit was a
      **label taken off one argument and used to vouch for the nine numbers in
      another**, and nothing tied the two together. The suite's own positive
      control shows the cost: `405 / 425 / 442.5 / 265 / 275 / 280 / 500 / 525 /
      545` is a legal **pound** card and a legal **kilogram** card, because 2.5 lb
      and 2.5 kg are the same grid spacing. Essentially every legal pound card is
      a legal kilogram card. A client playing in lb whose submission reached a
      server that resolved the definition by `meetId` and found a kilogram meet
      passed the bodyweight's check and the total's check and banked a 2.2x
      total — with no cast and no typed lie — and `nextTotalKg` is monotone, so
      it could never be walked back.
      Three things close it. `MeetResultReport.card` is a `MeetCardReport`, the
      same tagged-pair shape as the bodyweight (`kilogramAttempts` /
      `poundAttempts`, different field names on the two arms), so the weights
      cannot be reached without narrowing on a unit; the unit sits at **card**
      grain rather than per attempt, because a meet is run under one
      `MeetLoadingRules` and a card whose squats were kg and whose bench was lb
      would make the non-decreasing-attempts rule a comparison between two
      scales. `applyMeetResult` refuses unless `meet.id === report.meetId`, so
      the definition supplying the unit is the meet being reported.
      `replayMeetCard` refuses unless `card.unit === meet.rules.unit` — a check
      **strictly stronger** than the other two, because it compares the client's
      claim against server-owned data rather than against a constant.
      `MeetAttemptReport.weightKg` is now `weight`: the row makes no unit claim
      at all, which is the honest shape when the claim belongs one level up.
      A fourth check closes a hole *inside* the third round's own work: the
      bodyweight's tag was validated and its payload was not, so `{"unit":"kg"}`
      wrote `bodyweightKg: undefined` into a stored result with `ok: true`. Both
      readings now refuse a tag with nothing under it (`MALFORMED_READING`, a
      separate code because the remedy is to fix the sender, not to convert an
      entry).
      **What is still taken on trust, named rather than left to be found:** the
      `meet` argument is supplied by the caller, so the id check makes it *claim*
      to be the reported meet and nothing makes it *be* one — `applyMeetResult`
      has no catalogue to look one up in. That closes when the Edge Function
      resolves `meetId` against its own table instead of taking a definition as
      an argument, and it is the highest-value thing left on this path. Also
      named in the module: `MeetDefinition.ghostTotalsKg` is still a bare
      `number[]` (placeholder data a backend replaces, and it reaches no stored
      field), and `MeetDayAttempt.weightKg` — the meet-day loop's own row, not
      the wire — is a bare number that `AttemptView.tsx` prints with a hardcoded
      "kg", which on a pound meet is a lying screen and is ruling (a)'s to delete.
      **None of that takes the ruling below.** The code still refuses; it now
      refuses every number instead of one.
      **Three ways out, none taken:** (a) rule that the game only ever runs kg
      meets and lbs is a display skin, in which case `POUND_MEET_RULES` should go
      and §11's display question answers this by itself; (b) rule that pound
      meets ship, and give the lifter profile a unit so both axes can be
      converted at one boundary — the conversion constant is already there
      (`KILOGRAMS_PER_POUND`); (c) rule that pound meets ship without DOTS, and
      decide what the result card prints in the DOTS column for one.
      *(The lifter profile that (b) asks for now HAS a unit —
      `MeetEntry.bodyweight` — but nothing converts with it and nothing is meant
      to. It was added so the refusal has a fact to check rather than a literal;
      it makes (b) cheaper to take and does not take it. The one line (b) would
      widen is `KilogramMeetEntry`.)*
      **What the code does today is none of the three — it is stricter than (c).**
      A pound meet runs end to end on the platform and then cannot be recorded at
      all: no Total, no stored result, no placing, no card, no score. That is the
      safe branch and it is deliberate, but it is not a shippable answer, because
      a player who took nine attempts is still told nothing. `useMeetDay.ts` now
      **keeps** the refusal (`MeetDayLoop.submissionError`) instead of dropping
      it on the floor inside `setCache`, and says at the site which refusals
      exist and why there is no retry — the meet is marked submitted *before* the
      call on purpose, because every refusal is a pure function of inputs that do
      not change while the meet sits in recap, so retrying would recompute the
      same answer once per render forever. **Nothing renders it.** That is a
      screen, and the screen is part of this ruling rather than something to bolt
      on ahead of it. Ruling (a) makes the refusal unreachable and is the
      cheapest exit; (b) and (c) each need a conversion boundary *and* a screen
      for the failure. Until it is ruled, `POUND_MEET_RULES` is a configuration
      the engine supports and progression will not accept.
      **AND THE SAME REFUSAL NOW EXISTS IN SIM MODE, which is where this
      question actually lives.** The fourth bare-unit *field* on the
      progression boundary was `TrainingSetReport.weightKg` — the daily loop's
      set row, thirty lines above the meet attempt row in the same file, on the
      path to `ConfirmedFacts.bestE1rmKg`, which is protected and **monotone**.
      Nothing proved the `Kg`: the decoder checks finiteness, `e1rm.ts` is
      documented **unit-agnostic by design** ("kg in → kg out, lb in → lb out"),
      and `sessionServer.ts` contained no occurrence of the word *unit* at all.
      A pound session recorded as kilograms is 2.2046x too large, permanent, and
      crosses into meet day through `meetDayFacts` → `suggestOpener`.
      The sets now ride on a `TrainingCardReport` — the third unit-tagged
      reading, arms `kilogramSets` / `poundSets`, so the rows are unreachable
      without narrowing on a unit — the row is `weight` rather than `weightKg`,
      and `applyTrainingSession` refuses a non-kg card (`UNSUPPORTED_SESSION_
      UNIT`) before the e1RM is derived and before the streak moves.
      **Reachability is NOT the same as the meet's, and the difference is
      stated rather than glossed.** There is no `POUND_MEET_RULES` for training:
      `SESSION_TUNING.LOAD_UNIT` chooses the snapping grid only, because
      `prescribeSession` computes the load from a kilogram e1RM either way, so
      flipping it yields a kilogram magnitude on a 5 lb grid rather than a pound
      session. What is reachable is the same live hazard the meet path had — a
      client running the daily loop in pounds, i.e. the display-unit question
      above, one mode over — plus untyped JSON and casts. The argument that "no
      game module produces it" was found false twice on the meet path and is
      not re-made.
      **The cost lands on the same open ruling.** A lifter who genuinely
      trained in pounds is refused and loses the streak day, which is the shape
      §12.3's "never punish daily engagement" warns about, and there is no
      screen for it — exactly as there is none for the refused pound meet. The
      three ways out above cover both modes: (a) makes both refusals
      unreachable, (b) and (c) each need a conversion boundary and a screen. A
      per-user display unit that reaches the *loading* path would make the
      training refusal live, so answering the display question above without
      answering this one is not possible.
      **AND THERE WAS A FIFTH NUMBER, WHICH IS NOT A FIFTH FIELD — IT IS A
      SECOND ROUTE INTO THE FOURTH.** `progression.ts` §7 had closed the training
      *card*, and a sweep of every `ServerRecord` construction site found the
      same defect arriving into the same field by a different door.
      `SESSION_TUNING.STARTING_E1RM_KG` was `{ squat: 180, bench: 120, deadlift:
      220 }` — three bare numbers with the unit in the identifier — and
      `newServerRecord()` assigned them straight into `record.bestE1rmKg`, on
      every account. From there: `snapshotWireFor` → `receiveProgressionSnapshot`
      → `ConfirmedFacts.bestE1rmKg`, a `ConfirmedKg`, protected. The same field,
      brand and protection as the number the card check was built to fence;
      `readKilogramSets` never saw it because it never rode a card.
      **Its own comment was false in the direction that invited the edit.** It
      read "PLACEHOLDER DATA, NOT PROGRESSION. Nothing here is persisted and
      nothing derives from it once the server has a real number." Both clauses
      were wrong. It *is* written into the progression field and it *does* go on
      the wire; and `nextBestE1rm` is **monotone**, so the seed is a permanent
      **floor** rather than a starting guess — a lifter whose true squat e1RM is
      150 kg carries 180 forever, and no honest session lowers it. The identical
      claim sat client-side in `sessionClient.ts`. Both are corrected.
      **Why this mattered for the ruling below rather than only for tidiness.**
      If the display question is answered "the loop loads in pounds", the first
      edit is `LOAD_UNIT: 'lb'`, which `sessionProposal` forwards onto the card,
      so the session is refused loudly, as designed. The **second, natural** edit
      was these three magnitudes — and that seeded a kilogram field with pound
      numbers **silently**, with every guard green and monotonicity making it
      unwalkable back. The point of fixing it is to make the pound edit *safe to
      make*; it does not make it.
      **The fix is the precedent this document already set.** The seed is now a
      `StartingE1rmSeed` — `{ unit: 'kg', kilograms }` / `{ unit: 'lb', pounds }`,
      the fourth tagged pair, arms with different field names — exactly the
      argument recorded below for `MeetEntry.bodyweight`: in-tree placeholder data
      got a unit tag anyway, "so the refusal has a fact to check rather than a
      literal". **And its check is *stronger* than the card's, for a reason that
      is about the input and not about effort:** a card arrives as JSON from a
      client, so both arms must be representable and the check must be at
      runtime; the seed is a literal in the build, so `tsc` can ask the question,
      and does. Flipping the unit without converting the magnitudes fails
      `satisfies StartingE1rmSeed` at the constant; flipping it *and* converting
      fails the narrow in `sessionServer.ts`; widening the narrow fails at the
      reads, because `.kilograms` does not exist on the pound arm. None of those
      is a test failure.
      The cross-mode signature carries it too: `meetDayFacts`, the one function
      that takes a training number into meet day, took
      `fallbackE1rmKg: Readonly<Record<LiftKind, number>>` and now takes the
      narrowed `KilogramStartingE1rm`.
      **What is NOT closed, stated plainly:** the magnitudes. `{ unit: 'kg',
      kilograms: { squat: 397, … } }` compiles and is 2.2x wrong. A tag proves
      what was *declared*, not what was *typed* — the same residual this document
      already names for the bodyweight and the two cards. No plausibility band was
      invented to pretend otherwise, because a guessed constant standing in for a
      check is what the `HUMAN_INPUT_BUDGET_MS` entry above records going wrong
      once already.
      **One display defect was fixed and it takes none of the three.**
      `AttemptView.tsx` printed `` `${formatWeight(live.weightKg)} kg` `` — a
      hardcoded suffix over a number the screen cannot know the unit of — so on
      a pound meet the one line showing what is on the bar was wrong by 2.2x. It
      now renders `meetDay.ts`'s `liveAttemptWeightText`, which reads
      `meetLoadingRules(state.meet).unit`. The engine still runs the pound meet
      and progression still refuses to record it; only the screen stopped lying
      while that is true.
      **AND THERE WAS A SIXTH ROUTE, WHICH IS THE LAST INTERESTING FACT ABOUT
      THIS ENTRY — NOT BECAUSE IT WAS BAD, BUT BECAUSE OF HOW IT WAS FOUND.**
      `sessionPreview.ts`'s `recordBeforeSession()` builds a `ServerRecord` and
      writes `SESSION_PREVIEW.BEST_E1RM_KG` — a bare `200` with its unit in the
      identifier — into `bestE1rmKg`, from there to `ConfirmedFacts.bestE1rmKg`,
      a `ConfirmedKg` on the `'protected'` row. `progression.ts` §7 named *two*
      hand-built records and there were *three*; §7.4 said "Five routes" and
      there were six. Its constant carried the **same sentence** the seed's did
      one round earlier — "NOT PROGRESSION. Nothing here is persisted…" — of
      which clauses 2 and 3 are true and clause 1 is false in the identical
      technical sense.
      **The route itself is small: debug-only, persisting nothing, unreachable
      without a hand-typed query string. What is not small is that six rounds in
      a row ended this way, and five of the six were found by a grep** — a human
      typing `: ServerRecord` and reading the hits. The fact half of §7's sweep
      had been mechanical for rounds; the ROUTE half was a hand-written list, and
      a hand-written list of routes is what this section has got wrong every
      round it has existed.
      **So the enumeration is now derived.** §7.5 is a table of every place a
      `ServerRecord` or a `ProgressionSnapshotWire` is built and every caller of
      the client's snapshot door, and `progression.test.ts` reconstructs the same
      set by building a `ts.Program` over **every file the project compiles** —
      `parsed.fileNames` from `tsconfig.json`, cross-checked against a walk of
      the repository so a narrowed `include` cannot shrink it — and asking the
      **type checker**, not a regular expression, for every object literal that
      is one of those types, by contextual type *or* by structural
      assignability. It compares the two sets **both ways**: a construction site
      added **anywhere the project compiles** without a row goes red, and a row
      whose site is deleted goes red. Counts
      are per row, so a second literal inside a function that already has a row
      is caught too. The declared side is a comment and the found side is a
      parsed syntax tree, so prose about a route can neither create one nor
      cover for one that was deleted.
      Test fixtures are excluded, deliberately and with the exclusion asserted to
      be non-empty: `meetServer.test.ts` and `sessionClient.test.ts` build a
      dozen records between them, a pin over those would go red on every new
      fixture, and a table that goes red weekly is one people fix by editing the
      number.
      **And "test fixture" is a derived set, not a regular expression's
      opinion** — that was the last scope in this piece justified by an argument
      instead of by enumeration, and it was wrong by exactly the files nothing
      runs. The set the sweep drops is asserted equal, in both directions, to the
      set vitest actually collects (asked of vitest, not restated from its
      globs), and no file the sweep covers may resolve an import to one it drops.
      Before that, a `*.test.tsx` anywhere in the compiled tree was invisible to
      the route table, to the reflective sweep, to the magic-number auditor and
      to the test runner at once, while bundling normally.
      **What still slips, named rather than left for a seventh round:** a record
      assembled with no object literal — `Object.assign`, `structuredClone`, a
      cast through `unknown` — has no node for the checker to type. A second,
      cruder test looks for those three as literal text.
      **That second test was itself scoped, and the scoping was the defect.** It
      ran over a computed candidate set — "a file is a candidate if it declares a
      target type or if any symbol it imports from a repository module has a type
      that reaches one" — implemented as a walk of top-level `ImportDeclaration`
      and `ExportDeclaration` nodes with a non-empty clause. That is not what
      "imports" means in this repository: `await import()` is a call expression
      inside a function body, which is how everything downstream of the Skia WASM
      boot is loaded (`index.ts`, `cardEntry.tsx`, `licensingEntry.tsx` hold six
      between them), and bare `export * from` has no export clause at all
      (`src/art/index.ts` is fourteen). **On a file using either, the two checks
      composed to zero** — the literal sweep is blind to a no-literal assembly by
      construction, and the guard that exists to cover that never looked at the
      file. Proved by execution: six lines on `cardEntry.tsx`'s own dynamic-import
      template, taking a Total off the query string through `Object.assign`,
      `snapshotWireFor` and the pinned `receiveSnapshot` into the cache as
      confirmed truth, type-checked clean and passed all 2437 tests.
      **The fix was to delete the scoping, not to teach it more constructs.** The
      guard's whole purpose is preventing under-scoping, so scoping it was
      self-defeating, and every round of this piece has been a scope error one
      construct further out — another hand-rolled predicate would have reopened
      at the next unusual import form. It now runs over **every non-test file the
      project compiles**, with the one pre-existing occurrence in the repository
      excused by file, idiom and count in a table pinned both ways. The type walk
      that computed the candidate set is deleted, so the sweep also got cheaper.
      **What is left is stated as a bound rather than as closure**, which is the
      other half of that round. "Closed by a second, cruder test" was over-strong:
      a handful of string patterns cannot close an unbounded class. §7.5 residual
      1 names what walks past them — a hand-written `class Forged`, `JSON.parse(s)
      as ServerRecord` off an `any`, `Object.fromEntries(…) as ServerRecord`,
      `Object.create`, `Reflect.set`, an aliased `Object.assign` — and notes that
      comment stripping is textual, so a `//` inside a string literal blanks the
      rest of its line. A seventh escape, `x as any as ServerRecord`, has since
      been **taken** and is the fourth pattern: it is the same shape as the
      `as unknown as` row already running, `noImplicitAny` is on repo-wide, and it
      excused nothing. The other six stay listed rather than chased — adding
      patterns one per round is how a bounded instrument comes to be read as a
      closure. A residual honestly bounded is worth more than one falsely closed.
      The exemption table that excuses live occurrences now pins the **matched
      line** as well as the file, idiom and count, so deleting one excused
      occurrence and adding a different one in the same file no longer stays
      green on an unchanged count.
      **The preview builders are still not fenced, and the reason is now stated
      per site.** Two of the three exist because the server functions cannot
      produce what they photograph. The third does not: `applyTrainingSession`
      *can* produce an eleven-day streak and a 200 kg e1RM — that is its job — it
      just cannot produce them cheaply or on a round number, and a photographed
      beat exists to be compared across builds. That is a fixture argument, and
      it is written down as one instead of being folded under a sentence that
      covered the other two.
      **The seed's type moved and gained the assertion it was missing.**
      `StartingE1rmSeed` now lives in `progression.ts` beside the three report
      pairs, so `A_STARTING_E1RM_SEED_CANNOT_BE_READ_WITHOUT_ITS_UNIT` can be
      written. It was the only one of the four tagged pairs on this boundary with
      no `ArmsAreTellableApart` line, which meant the property `sessionServer.ts`
      correctly calls "the guarantee" — the arms carry different field names —
      was held by convention. The edit it now catches: add a convenience field
      reachable from both arms (`perLift`, so `STARTING_E1RM.perLift[lift]` works
      without a switch) and, before this line, `tsc` passed and every read site
      passed. The **value** is still authored in `sessionTuning.ts`, so the
      "declare the unit at the authoring site" argument is intact.
      **No §11 ruling is taken by any of this**, and the magnitudes are still
      unproven. No plausibility band was invented for them: the RPE chart is
      unit-invariant, the plate grid gives a rounding increment rather than a
      validity range, DOTS carries coefficients rather than a domain, and the
      inter-lift ordering survives a 2.2x seed intact — so a bound on "how strong
      may a new lifter be" would be a guess wearing a check's clothes, which is
      what the `HUMAN_INPUT_BUDGET_MS` entry above records going wrong once.
- [ ] **Who owns the close-out's WORDS when the server disagrees with the
      client?** The daily loop's payoff beat now reads its numbers back through
      the progression boundary, so a server answer the client did not predict is
      what appears: the figure, and the PR gold with it, follow the confirmed
      reading rather than `SessionCloseOut.isPr`.
      The **headline and subhead do not.** They are chosen inside `session.ts`'s
      `closeOutCopyFor` at close-out time — from the payoff kind and, on an e1RM
      day, the client's own PR prediction — and never revisited. So a server that
      comes back below the previous best leaves "NEW e1RM" sitting over a number
      that turned out not to be one — the screen's words and its digits
      disagreeing about the same event.
      (The *accessory* half of this is no longer part of the question: the payoff
      kind is a field on the close-out and the copy is selected from it, so an
      accessory day cannot be headed "NEW e1RM" whatever the PR flag says. What
      remains open is only the server-disagreement case, which is about the first
      real Edge Function.)
      This is a **design question, not a wiring bug**, which is why it is here
      rather than fixed. Three ways out, none obviously right: re-derive the copy
      in the boundary read model (a second place choosing close-out copy — the
      "two parts of the app disagree" shape this codebase spends most of its
      guards preventing); make the session machine take the reading (the pure
      loop then depends on the cache, and `closeOutFrom` stops being a function
      of the session); or hold the headline until the response lands (honest, but
      it costs the payoff beat its immediacy, and GDD §12.2 judges this piece on
      exactly that).
      Today's behaviour is the first-listed *residual*, stated in
      `CloseOutView.tsx`'s header: numbers server-authoritative, words client-
      authoritative. It is only visible when a real Edge Function disagrees, which
      no shipped one does yet — `sessionServer.ts` and the client run the same
      `nextBestE1rm` — so it is a question about the first real backend, not about
      the prototype.

- [ ] **Does the hidden fatigue ledger belong on the client at all?** GDD §3.4
      and §12.3 forbid a visible fatigue meter, and `ProgressionSnapshotWire`
      excludes fatigue on the stated grounds that "a ledger on the wire is a
      meter that has not been rendered yet". But `sessionFeel` — which produces
      every one of §3.4's four channels — runs on the client and takes the
      ledger, so something has to cross.
      What crosses today is a `SessionBrief`: **one field**, pruned to the
      same-day/next-day horizon §3.4 describes, with the one scalar downstream of
      it (`burden`) already behind a module-private symbol. Nothing renders a
      number off it and `sessionWiring.test.ts` fails if any screen names the
      ledger.
      **The residual is real and is a scan rather than a type.**
      `SessionContext.fatigue` is a readable `FatigueState`, so a future `.tsx`
      could count `context.fatigue.sessions` and draw a bar off it; only a test
      stops that. Closing it properly is one of: make the field opaque the way
      `SessionFeel`'s internals are; or move `sessionFeel` server-side, which
      means the readiness check-in becomes part of a session-start request and
      the loop gains a round trip before its first work set — a cost GDD §12.2's
      time-to-first-input bar would have to be measured against.

- [ ] **§7.3's "the base sprite needs no change at all" holds only for a partner
      whose colours bank 0 already has, and today that is four hues.** A Tier 1
      colorway is three indices into the LIFTER bank, because that is the bank
      `lifterSprite.ts`'s `isBodyIndex` counts as the athlete: a colorway built
      out of any other bank makes the singlet **barbell** as far as
      `bodyPixelDiff`, the silhouette measure and the phone-scale readability
      bounds are concerned. Three of the four fictional partner colorways were
      built that way — out of the plate ramps and `CHROME_HI` — and the only
      Tier 1 colour check resolved indices through the RESULT SHEET's palette,
      which accepts every index in every bank, so nothing could fail.
      Fixed, and `spriteKit.ts`'s `colorwayProblems` now asks the sprite's own
      question. **What the fix exposed is the open part.** Bank 0 has sixteen
      slots and most are spoken for — five skin, two hair, one outline, one
      transparent — leaving the SINGLET ramp (navy), the GEAR ramp (slate), HAIR
      (a warm plum, borrowed) and CHALK. That is the whole Tier 1 palette, so
      `halberd-chalk` cannot be the brand's green and `vondrak-plum` cannot be
      her crimson, while both hues exist happily at Tier 3 where the sheet
      palette carries the full plate ramps.
      So the decision, for a human: **spend bank-0 slots on kit hues, or accept
      that a licensed athlete's sprite wears an approximation of their colours.**
      The first costs slots in a 16-colour bank that was budgeted like hardware
      and is an edit to `palette.ts`; the second is cheap and means Tier 1 and
      Tier 3 can disagree about what a partner wears. Neither is obviously right
      and neither should be decided by whichever builder next touches a colorway.
      §7.3's sentence should be amended to whichever is chosen; it currently
      reads as unconditional and is not.
      A second, smaller residual with it: `wearColorway` recolours the INDEX GRID
      a rendered frame comes back as, because the index-to-RGBA step lives in
      `src/art/`. The hardware-accurate shape is a colorway parameter on that
      step — the grid keeps saying `SINGLET_MID` and the palette decides what
      `SINGLET_MID` looks like — which is what a 16-bit palette swap actually
      was, and which keeps "is this pixel the singlet?" answerable downstream.

---

## 12. Gauntlet Loop Execution

Method reference: https://somethingbig.ai/gauntlet-loop

### 12.1 What a One-Shot Run Can and Cannot Do

A Gauntlet Loop can plausibly produce, unattended: a working daily loop, correct
lifting math, a full meet-day flow with attempt selection and judging, a
functioning Gym Empire idle layer, and sprite art that survives blind comparison
against real 16-bit reference.

It cannot tell you whether pressing the screen to grind out a squat **feels
good.** No critic — however harsh, however fresh its context — can judge haptic
timing it cannot feel. That gap does not close with more loops.

**Therefore:** the one-shot run's job is to deliver a playable, tunable artifact
with every game-feel value exposed as a named constant in one place. Feel tuning
happens afterward, by hand, with real people playing. Plan for roughly 30
iterations on timing windows, animation curves, and haptic patterns. That work is
not a failure of the run; it is the part of the job that was never automatable.

Everything else in §10's phase gates can be collapsed into the run.

### 12.2 The Bars

The bar is the most important part of the method. Vague bars produce vague work.
Each piece below gets its own builder and its own **separate critic with fresh
context** that inspects the real output — rendered pixels, running app, actual
test results — never a summary written by the builder.

| Piece | Bar the critic compares against |
|---|---|
| **Lifter sprites & animation** | Real 16-bit sprite work from SNES/Genesis-era sports and fighting games. Blind A/B: does ours read as authentic 16-bit craft, or as modern pixel-art pastiche? Specifically judge whether a maximal attempt animates *heavier* than a light one. |
| **Gym / environment art** | Same era, same blind A/B. Judge readability at phone scale, not just fidelity. |
| **Meet-day tension** | Real powerlifting broadcast footage — a third-attempt walkout. Does our sequence produce comparable dread and anticipation? Judge pacing and sound, not sprite count. |
| **Result card** | Real federation result sheets. Blind A/B: would a competitive lifter believe ours is real? This is the organic-growth lever; it must survive scrutiny from people who read these weekly. |
| **Daily session loop** | A best-in-class daily-habit app session (Duolingo). Judge time-to-first-input, session length, and whether the close-out moment lands. Ours must not be slower or flabbier. |
| **Lifting math** | Published RPE charts, e1RM formulas, and DOTS coefficients. This bar is binary and testable — the critic verifies against source values, not vibes. No blind A/B needed. |
| **Anime cut-ins** | 16-bit-era cut-in art. Judge intensity, not polish. A cut-in that reads cute has failed. |
| **Cross-mode coherence** | The four modes must feel like one game. This is the smoothing-pass critic — run it fresh at the end of each wave, inspecting the whole artifact. |

#### Proposed revision to one sub-bar — **NOT TAKEN.** A bar is the human's to set.

The unit half of cross-mode coherence has been run as: *"no number may be
written into permanent progression whose unit the server has not proven."* Seven
rounds have been graded against it. It is recorded here, unchanged and still
authoritative, together with a revision a critic proposed and a builder's
assessment of it — CLAUDE.md says a conflict with this document gets stated
rather than silently resolved, and changing a bar mid-run without a human is the
same move as grading your own work.

**The proposal:** split it into two clauses, both checkable.

> *(i) every number reaching a `ConfirmedFacts` mass field arrives past a check
> on a unit field it carries, and (ii) the set of routes that writes one is
> enumerated in a table a test fails on.*

**Why it is worth considering.** The bar as written cannot be discharged, and
not because the work is unfinished. "The server has not proven" is a claim over
an *unenumerated* set — every route that exists — so no amount of evidence
closes it and no evidence can falsify it either. Six rounds in a row ended with
a human finding one more route, which is what an unenumerable bar looks like
from the inside: each round's work was correct and each round's *claim* was too
strong, because the claim quantified over a set nobody could produce. Clause
(ii) makes the set producible, so the claim becomes falsifiable, which is the
property §12.4's method actually needs.

**Three corrections a builder would want made before it were taken.** A critic
reviewing the first two endorsed both, and supplied the wording for (i) that is
quoted below. The third is new and was found by breaking the pin the first two
describe.

1. **Clause (ii) needs to name both directions.** "A table a test fails on" is
   satisfied by a table that only ever grows, and a table that only grows fills
   with rulings about deleted code until the live rows are unskimmable. The pin
   fails on an unlisted site *and* on a listed site that no longer exists, and
   it is the second half that keeps the first half readable.
2. **Clause (i) flattens checks of different strength.** A comparison against
   server-owned data (`card.unit === meet.rules.unit`) and a comparison against
   an in-tree constant (`PROGRESSION_E1RM_UNIT`) and a compile-time narrow on a
   literal are not the same guarantee, and §7.1 is careful to say which is
   which. If the clause is taken it should read "*past a check the table names,
   with the strength of that check stated*", or a future round will report four
   green ticks over three different things.
3. **Clause (ii) also needs to say what the test's SCOPE must be.** "A table a
   test fails on" is satisfied by a test that scans less than the codebase, and
   that is not hypothetical: the round after the pin was built, its scan was
   rooted at `src/`, and `App.tsx` — the app's entry point, at the repo root,
   reachable from nothing under `src/` — could hold an annotated `ServerRecord`
   with the whole suite green. The table was complete; the instrument reading it
   was not, and every non-vacuity check inside it passed because they all asked
   about files the scan already had. If the clause is taken it should require
   the enumeration to be over *the project's own file list*, with at least one
   file outside the main source directory named in the check by hand — which is
   the shape `src/tuning/audit.test.ts` already uses ("walks the whole
   repository, not just src/", anchored on `App.tsx`, `index.ts`,
   `vitest.config.ts`).

**What neither clause touches, and what a human may want a third clause for:**
whether a declared unit is *true*. `{ unit: 'kg', kilograms: { squat: 397 } }`
satisfies (i) and (ii) and is 2.2x wrong. That is not a gap in the restatement —
it is genuinely out of reach without a server to re-derive against — but it is
the failure most readers assume this bar covers, so it is worth saying in the
bar rather than only in the code.

### 12.3 Constraints the Critics Must Enforce

These are refusal conditions, not preferences. A critic finding any of these
sends the work back regardless of how good it otherwise looks:

- Anything purchasable that affects Total, e1RM, training pace, or meet
  performance (§8.1)
- Random-chance NPC recruitment of any kind (§5.3)
- A visible fatigue meter (§3.4)
- Forced or interstitial ads (§8.3D)
- An injury or setback that punishes a player for showing up daily (§3.5)
- Homebrewed RPE, e1RM, or DOTS values (§9 domain correctness)
- Cut-ins firing more than once per session (§7.2)
- **Any real, named athlete, brand, or company identity** — name, logo,
  likeness, or wordmark — hardcoded into any asset, string, config, or code path
  (§7.3, §8.1)
- **A branded or sponsored item with any mechanical effect** its fictional
  equivalent does not have (§8.1)

**The real-IP condition is checked on every piece, not just the licensing one.**
It is listed here rather than in the licensing piece's own bar precisely because
a real mark can arrive anywhere — a placeholder lifter name in a test fixture, a
gym poster in the environment art, a plate brand on a sprite, a sample result
card. Every critic sweeps it the same way it sweeps the fatigue meter, and the
answer is a name-by-name statement of what was searched, not "looks fine".

Two properties make this condition different from the others, and both argue for
checking it constantly rather than once:

- **It is legal exposure, not taste.** Shipping an unlicensed real mark is a
  different category of mistake from shipping an ugly one, and unlike the others
  it cannot be walked back by a patch once it is in a store build.
- **It arrives by accident.** Nobody will deliberately hardcode a real brand.
  It gets in as a "realistic" placeholder name a builder reached for because a
  real one was the first thing that came to mind — which is exactly the sort of
  thing a fresh critic catches and an author does not.

### 12.4 Run Discipline

- **No fixed round count.** Loop until output wins its bar or the run is stopped
  by hand.
- **Builder never grades itself.** Critics spawn fresh, receive the goal, the
  bar, the constraints, and the artifact — never the builder's reasoning.
- **Live progress page.** The lead agent maintains a simple HTML page or
  `workbench.md` showing work evolving over time — screenshots, test results,
  clips. Check it from a phone rather than interrupting the run.
- **Smoothing pass** at the end of each major wave: one fresh agent inspects the
  whole artifact and reconciles inconsistencies between separately-improved
  pieces. Its job is coherence, not redesign.
- **Do not prescribe decomposition.** The lead agent decides how to split the
  goal. This document supplies the *what* and the *bar*; the route is the agent's
  to choose.
