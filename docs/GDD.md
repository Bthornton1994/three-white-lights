# Powerlifting Game — Game Design Document

**Status:** Pre-prototype
**Stack:** React Native + Expo, TypeScript, Reanimated 4, Skia, Supabase
**Last updated:** 2026-09-02 (A0 PLAYABLE SPORT CLOSED. Baseline runtime
`39400d97`. Squat / bench C3 / deadlift accepted and frozen. Three-Lift
Identity Test PASS. Physical glass smoke is A0-DEVICE-01 release QA debt,
not a design blocker. A1 Authentic Meet is authorized. No lift runtime
change in the mint commit. No merge to main.) Earlier: 2026-09-01 (§6.2 — C3 surplus compression minted as the
accepted bench feel after ordinary-bench phone replay. Human verbatim:
"Yes this feels good lets move on." Constants frozen. No A1–A7 start, no
Session B touch, no merge to main.) Earlier: 2026-09-01 (§13 — Powerlifting Sports Universe Doctrine
filed. North star in `VISION.md`. The daily-habit one-line pitch is demoted
from product identity and kept as the retention mechanism. A0–A7 recorded as
directional sequencing, not present authorization. Lift production
untouched; Session B's §5 ownership untouched.) Earlier: 2026-08-05 (§7.2 — the cut-in's "no Tier 2 at all" cost is
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

**Product identity is §13.** `VISION.md` is the concise north star. Feature
work after the current lift gate is judged against the Powerlifting Sports
Universe Doctrine. That doctrine does not replace this section's build-order
rule, §10's prototype gates, or Session B's ownership of §5.

---

## 1. Core Concept

A powerlifting game with four interlocking modes sharing one persistent lifter.
Casual players enter through fast arcade/idle loops; real lifters find genuine
depth in training simulation and meet-day tension.

**North star:** Three White Lights is the definitive powerlifting sports game:
build a lifter, master the three lifts, navigate a living competitive career,
and chase totals, records, championships, and a legacy in a world that
remembers every platform moment.

**Shorthand:** Build a lifter. Enter the sport. Leave a legacy.

**The daily habit loop is retained, not the identity.** The previous one-line
pitch was "Duolingo's daily habit loop applied to a powerlifting career, with
a competitive meet as the payoff." That loop remains the retention mechanism
(§3, §4, §12.2 daily-session bar). It is no longer the product identity.
The Powerlifting Sports Universe Doctrine is §13. The concise north star is
`VISION.md`.

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
   Career mode; the daily loop is a game, not a training log. This pillar is
   retention, not identity — see §13.
5. **The world remembers.** Results, records, rivals, and titles persist.
   Presentation frames authentic events; it does not invent them.

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

See §5. Passive Gym Bucks + Training IQ generation, cosmetic sink, monetization
on-ramp.

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

One session per day, one competition lift. The day's **programmed** lift follows
the squat → bench → deadlift rotation; the player may choose a different
competition lift on the check-in before the session starts. That choice does not
add a screen in front of the first question — the three readiness taps stay on
the first paint, with today's lift offered as chips above them, defaulting to
the rotation. Accessory day is still not a fourth `LiftKind` (see the ruling
below).

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
is **worse than the design it replaces** — 561 / 1051 / 710 / 673 violating pairs
at 40 / 60 / 80 / 100 days, against 0 with it. The doomed branch has no
subadditive arithmetic to lean on, so its consumption must be *idempotent under
splitting* instead, and "take everything left in the window" is the only thing
that is. What changed is the blast radius: everything left is bounded by one
window's entitlement and is restored at the boundary regardless of what happened.

The row was re-taken when it turned out nothing in the repository re-derived it;
it reproduced, and §4.4 records both that and why publishing only its 60- and
100-day cells was misleading.

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
| a doomed absence consumes nothing (RULE 2 dropped) | **561 / 1051 / 710 / 673 at 40 / 60 / 80 / 100** | 20 |
| a covered day granted at a streak length | 54 at 100 days | 19 |
| a covered day granted every N sessions | 1156 at 100 days | 54 |
| **a covered day BOUGHT with a currency training earns** | **105 / 305 / 733 / 785 at 40 / 60 / 80 / 100** | **54** |
| the adversarial search, pointed at the broken variant | finds one | — |

**The first row was re-taken, because it was the one figure in this document
that nothing in the repository re-derived.** It had been published as "1051 at
60 days and 673 at 100" and restated in three source files; the 60-day half was
carried by a comment inside a test and the 100-day half was pinned by no
assertion anywhere in `src`. Re-run at the parameters
`src/game/streakSweep.ts` already declared — same seeds, same schedule count,
same attendance distribution — **it reproduced exactly**. It is now
`DOOMED_BURN_COUNTERFACTUAL` in that file and every cell is re-derived on each
run by `[dropping-the-doomed-burn-measures-worse]`.

**Two cells were the wrong two to publish, and that is the finding worth
keeping.** The row is not monotone in calendar length — 100 days reads *lower*
than 60 — so quoting those two alone suggests the broken variant heals as the
calendar grows. It does not. Its lifetime-best inversions rise at every step,
495 / 628 / 716 / 943, and its worst deficit does not shrink. A live run can
recover a broken streak later in a long calendar, which is what makes the
frequency row wobble; a lifetime best cannot be un-lost, which is why CLAUDE.md
calls that the half that does not heal. The whole row is published here now for
that reason.

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

## 5. Gym Empire Specification

### 5.1 Loop

Time passes → resources generate → spend to expand → expand generates more.
Check-in is 30–60 seconds: collect, queue an upgrade, maybe assign an NPC.

Standard offline-earnings cap so it rewards check-ins without punishing a
10-hour gap.

**A suspended tab is "offline" in this section's sense — ruled 2026-08-18, and
the cap applies to it.** The question arose because the shell's floor adapter
(`src/shell/empireFloor.ts`) simulated away-time at full online rate with no
bound: a device whose clock jumped — a backgrounded tab, a clock correction, a
laptop lid — owed one synchronous check-in per ten seconds of the whole gap.
Measured at `ef1a3f2` on an idle box (a phone is roughly three times worse):
24 h away = 160 ms of blocked main thread, 72 h = 505 ms, 1 week = 1.31 s,
1 month = 6.7 s, 1 year = **97.2 s** — and a year paid 141.7M Gym Bucks against
~2,700 for a day, so the unbounded loop was a violation of this section's own
cap wearing a performance costume, and the freeze fired at the worst moment:
the tap that opens GYM EMPIRE.

**Option B is the chosen repair: the catch-up is capped at the design's own
`OFFLINE_EARNINGS_CAP_HOURS`, and time beyond the cap is acknowledged, not
simulated.** Each advance simulates at most the cap's worth of check-ins at the
full online rate; the remainder of the absence earns nothing and is reported.
The rejected alternative was paying the remainder as one long discounted step
through `OFFLINE_EARNINGS_FRACTION` — that knob is deliberately not on this
path. Consequences, all measured in `src/shell/empireFloor.test.ts`:

- **The cap rewards the check-in, which is this section's first sentence made
  mechanical.** Two players away 24 hours: the one who looked once at hour 12
  has both halves run in full; the one who never looked has the second half
  forfeited. The extra look earns MORE — strict path-independence is broken in
  exactly and only that direction, swept with the punishing direction pinned at
  zero and the strictly-ahead count pinned non-zero beside it. Below the cap,
  path-independence holds unchanged.
- **The freeze is bounded at the cap's own cost.** Re-measured at the same
  ladder on the capped adapter: every jump from 24 hours to 1 year owes the
  same 4,320 steps (≈70–105 ms idle), because the synchronous work a jump can
  demand is now a constant of the tuning, not of the absence.
- **The away summary is a number and a state, not new feature scope.** The
  ruling that lifted the gate authorizes exposing the idle layer's cap, not
  designing new UI: the floor exposes the forfeited span and the fact the cap
  bit, and the Empire screen draws them as one more row (`AWAY PAST THE CAP
  (SECONDS)`), with no new interactions, buttons, animations or dismissal
  logic.

**The cap is per gap, and that is ruled as designed — 2026-08-18, no further
work.** Option B clamps each advance at the cap's worth of the wall time since
the *previous* advance, so a background tab whose timer happens to fire now and
then has each gap simulated in full and earns a full-rate window per gap, where
a tab that never fired would have everything past one cap forfeited. That
asymmetry was previously stated as a design property and left open; the ruling
closes it, on the bound that makes it safe: what any pattern of gaps can earn
is bounded above by wall time itself. Simulated gym time never exceeds elapsed
open time — each advance adds at most the wall span it covers, and
`src/shell/empireFloor.test.ts` walks the forfeit reading (`openSeconds −
gymSeconds`, the away row's own number) from zero with falls pinned to the
empty list — so the ceiling on a backgrounded tab is exactly what an
always-watching player earns at the full online rate, and there is no rate
above that to exploit.

**The chrome-band promise on the Empire floor stays FLAGGED, not pinned —
ruled 2026-08-18, held until after the L1 phone re-test.** The overlap fix
happens to restore `SHELL_LAYOUT`'s "bottom sixth is empty" band on this
screen, and the fix's own browser check pins only pill-disjointness — one
claim, one check. Whether the band itself deserves a hard assertion here is a
judgement about how the screen reads on a real device, so it waits for the
same human hands the L1 re-test needs, and is pinned then only if that person
says it is worth enforcing. Recorded so nobody pins it early on the reasoning
that a flagged promise is an unfinished one — this one is deliberately held.

- **Gym Bucks** (soft currency) — base passive income
- **Training IQ trickle** — keeps Idle connected to Sim progression
- **NPC lifters** — each generates Bucks/IQ based on tier and tenure

### 5.3 NPC Lifters — Flavor Only

**Explicit design decision: no gacha.** No random pulls, no rarity chasing.

- Recruited via flat Gym Bucks cost or reputation threshold. What you see is what
  you get.
- Output scales deterministically with gym tier + tenure/loyalty, not luck
- Customization (name, appearance, singlet) is the collection hook
- "Legendary lifter" tier exists but unlocks via reputation milestones, never
  paid pulls

Rationale: gacha mechanics would draw predatory-monetization criticism from
exactly the community whose word-of-mouth the game depends on.

### 5.4 Expansion Axes

| Axis | Detail | Cross-mode hook |
|---|---|---|
| Equipment tiers | Bare bar → comp plates → specialty bars → monolift | Unlocks Sim-mode accessory options |
| Space | More racks, platforms, NPC slots | Raises passive ceiling |
| Staff | Coaches, spotters, physio | Physio reduces Sim injury duration |
| Reputation | Attracts higher-tier NPCs, sponsorships | Sponsor money feeds Career economy |

**"Monolift" stays, and this is the ruling rather than an oversight.** A critic
raised it as a possible §12.3 real-mark exposure and correctly declined to decide
it, because §12.3's bar there is a legal judgement and not a measurable pattern —
which is exactly the class of question this document sends to a human. Ruled by a
human, on this reasoning:

- It is **generic across federation rulebooks**, where it names a piece of
  equipment rather than a maker, in the same way "power rack" or "deadlift bar"
  does.
- The word originated as a product name and is still claimed as a mark by at
  least one manufacturer. That is the genuine ambiguity, and it is why the term
  is **recorded here rather than left to be re-litigated** the next time somebody
  greps for brand risk.
- **No manufacturer is attached to it anywhere in the code.** The shipped value is
  a bare equipment noun in a tier ladder — no logo, no wordmark, no maker, no
  licensing slot. The §12.3 hazard the document is actually built around is
  shipping a real *identity*: a name, logo, likeness or wordmark presented as a
  real party's. Nothing here does that.

So this is not the licensing system's business and it does not go through §7.3's
partner unlock. If a lawyer later disagrees, the fix is a rename of one string in
one tier table and this table's cell — cheap, and much cheaper than the
alternative of the term drifting into copy where it would read as an endorsement.
**Do not "fix" it back to a generic on the initiative of a scan; the scan cannot
see what was weighed here.**

**The gym keeps two books, and which one a rung is bought from is decided by what
that rung reaches — RULED.** A rung whose output reaches Sim progression, or gates
something that does — physio, space, spotter — and NPC recruitment are bought out
of **wall-clock-earned** Gym Bucks. Equipment, coaches and cosmetics are bought
out of the balance §8.3B's timer skips accelerate. This is §8.2's "Extra Covered
Days from non-training-gated Chalk only" applied to this section: §5.4 says staff
levels cost Gym Bucks and does not say *which* Gym Bucks, and the difference is
the whole of §8.1 here.

*It is a measurement, not a preference.* Composed over a calendar and compared
element-wise by wall-clock day — an aggregate will not do, per §4.4 — a single
book gives **104 of 2616** physio readings moved and **36 of 132** physio arrival
days moved, every one of them EARLIER, plus **822 of 2616** Training IQ readings
moved. Two books give **0** on all three, with the single-book engine kept
runnable beside them as the control so the zeros are zeros against something.
(Those three were 84 / 2616, 32 / 128 and 1488 / 2616 before §5.3's promotion
path landed; the control moved with the engine and is still non-zero on all
three, which is what it is there for.)
Earlier physio is a shorter setback is restored training pace, which is exactly
what §8.3B calls the credibility line.

*What a skip still buys, so the ruling is not read as wider than it is:* the build
finishes now, the lifter is on the floor now, and the accelerated economy pays
now. What it cannot buy is the next rung of a ladder that reaches Sim
progression sooner.

**And the wall-clock book is itself a purse per capability, because two books
were not enough — RULED.** Every empire output that reaches Sim progression or
gates something that does — the Training IQ trickle, the physio hook, roster
slots, reputation — has a fund of its own, and a purchase may only be made from
the fund its own output names: §5.4's space and spotter rungs from the
roster-slot fund, §5.4's physio rung from the physio fund, §5.3's recruits from
the Training IQ fund. Each fund fills at the gym's baseline wall-clock line, so
nothing fills more slowly than it did. What a player gives up is the ability to
**concentrate**: you cannot save your recruiting money and pour it into physio,
and you cannot skip a physio level to buy a lifter sooner. Each ladder advances
on its own takings, on the wall clock, at the price the table publishes.

*Why a third book, since two had just been ruled in.* While those four purchases
shared one balance, the order they were offered in decided which of them got the
money — and that order moved with how often the player opened the app. A player
who checked in **more** could end with a **lower** Training IQ trickle than one
who checked in less: **2954 of 24576** exhaustively enumerated pairs, 25772 days
paid less, worst deficit 0.451 IQ/day. That is §12.3's "punishes a player for
showing up", reached through the economy rather than through the streak.

*It is a property of the composition, not of one imagined player, and that was
the measurement that forced this ruling rather than a smaller one.* §5 specifies
costs, ceilings and outputs and never says when a player spends, so the count was
re-taken under five distinct spending models. Every one was non-zero on at least
one domain — 2954 / 2751 / 3427 rotating, fixed-order and costliest-first;
10122 spending once a day. With a fund each, all of those are **0**, on every
domain measured: the 24576-pair window, a 114688-pair enumerated grid, seeded
20/40/60/100-day sweeps, and the extra-trained-day comparison. The single-purse
engine is kept runnable beside them and pinned at its 2954, so the zeros are
zeros against something. (Spending once a day took a second ruling of its own —
the anchor below — and is 0 on all six now.)

*What the split does not fix, and what turned out to be TWO different defects
entirely.* Spending once per calendar day measured **7245** after the third-book
ruling, split **7240** where an extra check-in moved the day's *decision moment*
and **5** where it did not. The 5 were §5.3's roster; the rest were the
specification of the policy itself, and both are repaired below.

**The 5 were §5.3's, and the diagnosis this document carried for several waves
was wrong — RULED and repaired.** It said they were the recruit price ladder:
cost per unit of output rises strictly across the tiers (500 / 1250 / 3200 /
7500 / 13846), so a gym holding more money buys strictly less Training IQ per
Buck. Traced on the shipped engine, all five come from one baseline and none of
them is that. In every one the diligent gym takes a `novice` at 500 Bucks per
unit and the idle gym takes a `club` at 1250 — *the diligent gym buys the
cheaper, more efficient rung and still loses*, because the scarce thing at that
decision is the roster **slot**, not the Buck.

What they were: **a filled roster slot was filled forever, while §5.3's ladder
unlocks on reputation, which rises with time.** The diligent gym reaches its last
free slot at reputation 48.8 — `club` opens at 50 — and commits it to a
`novice`; the idle gym reaches the same slot six check-ins later at 59.2 and
commits it to a `club`. Being early was the trap, and no arrangement of purses or
prices reaches it, because neither is what moved.

**The repair: a slot's occupant may be moved up to a tier the gym has since
unlocked, for the price difference** — at capacity only, out of the recruit's own
wall-clock purse, instantly, keeping the lifter's identity. Two quantities
telescope, and the second was found by measurement after the first alone left
2318 violating pairs at a worst deficit of 0.000032 IQ/day: the price
(`recruitCost(to) − recruitCost(from)`) and the timer
(`recruitSeconds(to) − recruitSeconds(from)`, added to both clock stamps). So a
slot holding tier T has paid `recruitCost(T)` and carries `recruitSeconds(T)`
from the moment it was first committed, **by every route and in any number of
steps** — 60 + 240 + 1500 is `regional`'s 1800 and 500 + 1500 + 6000 is its 8000.
There is no promotion timer to sell: a promotion raises the Training IQ trickle,
so a timer on it would be a third §8.3B-sellable timer sitting on a
progression-reaching output.

**RULED PERMANENT §5.3 DESIGN, by a human, on 2026-08-11.** Promotion entered
this document on a repair brief, and a mechanic that arrives as a bug fix
deserves to be either ratified or replaced rather than left looking incidental.
It is ratified: a slot's occupant rising to a tier the gym has since unlocked is
how §5.3's roster works, not a patch on how it works. Three alternatives were on
the table and all three are rejected, with the reason recorded because the reason
is the useful part:

- **A refundable slot** — sell the occupant back, re-hire at the higher tier.
  Rejected because it prices a *reversal* rather than an *upgrade*, and a refund
  rate is a tuning dial that decides how much being early costs. Any rate below
  full makes early commitment a penalty again at a smaller magnitude, and full
  refund makes the slot free to churn, which deletes the commitment §5.3's
  scarcity is built on. Promotion's price difference has neither degree of
  freedom: it telescopes, so the total is the same by every route.
- **A wider roster** — more slots, so committing one is not scarce. Rejected
  because it does not close the defect, it dilutes it. With N slots the same trap
  fires on the last one, and the measurement is a monotonicity property, not a
  magnitude: one violating pair is a §12.3 breach at any roster size. It also
  spends the scarcity that makes recruitment a decision at all.
- **A reputation gate that does not move** — unlock tiers on something other than
  elapsed time. Rejected because the gate rising with time is not the bug; it is
  the §5.2 progression the game is about. Keying the ladder to anything the
  lifter *does* runs straight into CLAUDE.md's rule that no grant may be keyed to
  the player's own activity, and keying it to nothing makes tier a purchase,
  which is the pay-to-win line.

A fourth was raised and is **not** a live alternative: accepting the one-way door
and re-pricing the ladder. The existing measurement already refutes it — in all
five original pairs the diligent gym buys the **cheaper** `novice` at 500 and
loses to a `club` at 1250, so the scarce thing at that decision is provably the
slot and not the Buck. No price schedule reaches a defect that price is not the
lever for.

**What ratification costs, stated so it is not discovered later.** Promotion is
now load-bearing in two places rather than one: the 5 pairs the ruling was
originally taken on, and **824** violating pairs of 24576 at the day anchor
specified afterwards (§5.4's anchor section). A future change that removes
promotion must re-measure both, and `'one-way-door'` is kept runnable beside the
shipped engine precisely so that stays cheap.

Measured on the same 24576-pair window, `'one-way-door'` being the engine without
the repair and kept runnable beside it:

| arm | one-way-door | shipped |
|---|---|---|
| extra check-in moves the day's decision moment (8064 pairs) | 7240 | **6459** |
| extra check-in does not (16512 pairs) | 5 | **0** |

*And the 6459 were the simulated player's decision moment, proved rather than
asserted.* The counterfactual varies the decision rule and nothing else: the
extra check-in is still taken — it collects, it accrues into every purse, it
earns reputation — but the day's spending anchor is held at the less-engaged
player's own. All 24576 pairs give **0** violating while 7263 of the 8064 still
*move*. Same engine, same money, same schedule; the only thing removed is the
extra check-in's power to defer that day's purchase.

**AND THAT WAS THE DIAGNOSIS, NOT THE FIX — RULED AND REPAIRED. A specification
that is anti-monotone in engagement by construction is a §12.3 breach however
honestly its count is pinned.** "Spends once a calendar day" never said WHICH
check-in of the day, and the unstated half was carrying all 6459. Written down
as `EMPIRE_DAY_SPENDING_ANCHORS`, the readings of that sentence measure, on the
identical 24576-pair window and the shipped engine:

| day anchor | shipped | single purse |
|---|---|---|
| **first affordable check-in, per purse** — shipped | **0** | 2887 |
| first affordable check-in, one trip for the whole gym | 31 | 2878 |
| first attended check-in | 1951 | 3104 |
| last attended check-in — the old specification | 6459 | 3908 |

*Why the old one could not be zero, and it is structural rather than a tuning
accident.* Adding a check-in can only move the day's **last** one later or leave
it. Money accrues on the wall clock and a purchase converts money into a
wall-clock timer, so a later purchase starts a later build and finishes later.
The extra check-in's only effect on the decision was to defer it.

*Why moving the anchor earlier is not enough on its own, measured because it is
the obvious next guess and it is wrong.* At the first **attended** check-in the
gym shops with less money accrued and commits to a rung it would otherwise have
skipped, or to nothing at all: **1951** violating pairs at a worst deficit of
0.263 IQ/day, twenty-six times the deferring anchor's worst deficit. Offering
the trip again when it could buy nothing repairs that and reaches **31**. All 31
are one shape: the extra check-in becomes the day's earliest, the gym shops
there, the roster purse holds 460 Gym Bucks against a 500 `novice` and buys
nothing, and the day is over for it because some *other* purse could afford its
rung. **One purse's affordability closed every purse's day.**

*What ships is the same sentence at the grain the third-book ruling already
chose.* Each purse buys at most once a calendar day, at the first check-in of
that day it can afford its next rung; a purse that can afford nothing waits.

*The zero is a measurement, not a construction, and this paragraph claimed
otherwise for a wave.* It used to close: adding a check-in can only make a
purse's first affordable moment **earlier** or leave it, because money and
reputation accrue on the wall clock and a check-in only reads them sooner — *so
the day a rung lands is monotone in attendance, purse by purse.* The premise is
true. The conclusion does not follow from it, and both halves of that are
measured rather than argued:

- **The premise is true in a violating engine.** It talks about the anchor, the
  per-purse split and wall-clock accrual. The roster's promotion path touches
  none of the three, and `'one-way-door'` — same anchor, same purses, same
  accrual, one parameter different — is **824** violating pairs of 24576. Every
  word of the premise is true of that engine, so the premise is not what makes
  this one safe.
- **It is about *when* a rung lands and says nothing about *which*.** Two of the
  four purses hold two ladders — space and spotter share the roster-slot purse,
  coach and equipment share the Gym Bucks one — the spending loop takes the
  first startable offer and stops, and the axis rotation advances once per
  attended calendar day under this anchor. So an extra check-in on an
  otherwise-empty day permanently shifts which ladder a two-ladder purse is
  offered first. Measured on the 24576-pair window: in **3334** pairs the
  more-engaged gym starts a *different axis* at the same position in its rung
  order, every one of them inside the roster purse, and the traced shape is the
  dearer 1000 spotter rung where the less-engaged gym took the cheaper 800 space
  one. That is the mechanism the first-attended-check-in anchor was rejected for
  at 1951 pairs, confined to the two-ladder purses rather than removed.

*So what stands is the domains it was measured on — and two of the five this
paragraph used to list were not measurements of the anchor at all.* The
day-granularity policy is the only one that reads the anchor; the day-4 sweep
and the 60/100-day sweep were both taken at the default per-check-in policy,
which carries the anchor's name and asks it nothing. Before this correction the
longest horizon the shipped day anchor had ever been measured at was **40 days,
on 623 pairs from 6 seeded histories**. The claim is now the rows of
`ANCHOR_DOMAINS` in `src/empire/engagement.test.ts` — one generated test each,
every row asserting that its runs actually put questions to the anchor:

| domain | anchors run | shipped | first-affordable | first-attended | last-attended |
|---|---|---|---|---|---|
| the 24576-pair window | 4 | **0** | 31 | 1951 | 6459 |
| the same window at day 4 (2304 pairs) | 4 | **0** | 0 | 0 | 456 |
| coarse grid, whole (114688 pairs) | 1 | **0** | — | — | — |
| seeded 20 days (644 pairs) | 4 | **0** | 4 | 8 | 60 |
| seeded 40 days (623 pairs) | 4 | **0** | 0 | 2 | 34 |
| seeded 60 days (650 pairs) | 4 | **0** | 1 | 3 | 64 |
| seeded 100 days (556 pairs) | 4 | **0** | 0 | 2 | 4 |
| the whole-day reading (24576 pairs) | 1 | **0** | — | — | — |

The 60- and 100-day rows are new and they came out zero; had they not, that
would have outranked everything else on this page. No argument here rules out a
longer horizon, a denser cadence or a different axis order — and the rung-swap
mechanism above is the specific reason that caveat is not boilerplate.

*The anchor is not what makes the engine safe on its own, and the right-hand
column above is the measurement of that rather than a claim.* Under one pooled
wall-clock balance every one of the four anchors is non-zero, 2887 to 3908. The
purses removed the residue and the anchor is what makes them reachable in order;
either alone is a violating engine.

*And §5.3's promotion path is load-bearing at the new anchor too*, which is
worth writing down because a respecification can quietly remove a repair's
subject. `'one-way-door'` — a filled slot filled forever — is **824** violating
pairs of 24576 at the shipped anchor, against the 5 the ruling was taken on.

*An unplayed balance consequence.* A gym that can move a filled slot up reaches a
larger roster subtotal sooner, so `TRAINING_IQ_DAILY_CEILING` binds on 1573 days
of the composed grid where it bound on 468. The safety property holds either way.
Whether an idle layer that spends more of its time at the budget *plays* better
is a playtest question this document cannot settle.

*And a tuning consequence a human should rule on separately:* because each fund
fills at the full baseline line, total wall-clock income is roughly **three times**
what it was, and physio now arrives on day 4 rather than day 7 at full
attendance. Splitting the line into shares instead was tried and pushed physio
past the measured window entirely. The safety property holds either way; which
one *plays* better is a playtest question this document cannot settle.

**The physio gate is exempt from the reputation gate, and that is the same rule
rather than an exception to it.** No expansion axis whose output reaches Sim
progression may be gated on reputation, because `REPUTATION_PER_CHECK_IN` makes
reputation player-keyed — so a reputation gate on physio would put the wall-clock
day a Sim setback shortens under the player's own schedule, which is §4.4's shape
with a gate where the currency usually is. The ban is enforced **by reach, naming
no axis**, so an axis that later acquires a progression-reaching output is caught
by the same rule rather than needing a new one.

**The earned path is measured too, and this paragraph said the opposite for
several waves after it stopped being true.** The chain is check-ins → reputation
→ sponsor Gym Bucks → the wall-clock day a physio level arrives. It is not
purchasable, so it is not §8.1, but "more engagement only ever helps" is the
argument §4.4 records as a reason to measure rather than a substitute for
measuring — so it was measured, by varying the **training schedule** and holding
the purchase fixed, which is the opposite independent variable to every sweep
above.

Result, on the gym the player actually has: the physio half is **0 later
arrivals of 24576** exhaustively enumerated pairs, worst deficit 0 days, and the
extra-trained-day comparison is byte-identical at **0 of 1800** elements. The
Training IQ half was **not** zero — 2954 of 24576, worst deficit 0.451 IQ/day —
and that measurement is what forced the third-book ruling above; it is 0 now.
Beside them, non-zero on purpose: re-connecting the chain by funding the ladder
from the accelerated purse gives **263 later physio arrivals**, so the zeros are
zeros against something.

*Kept as a correction rather than a silent edit, because the failure is the
interesting part.* This paragraph read "still unmeasured … no evidence either
way" while the sweep that closed it was already in the tree and pinned, and the
same §5.4 section contradicted itself thirty lines apart. CLAUDE.md's opening
rule is that a sentence written while the code was true keeps its confident tone
after the code moves; the sentence here was written one wave before the
measurement existed and was not revisited when it arrived.

### 5.5 Social Layer

- Gym leaderboards (regional / global) by reputation or combined lifter totals
- Visit friends' gyms — browse, leave encouragement. No real-time infra needed.
- Weekly rival gym comparison (AI or real player), small reward for beating them

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

**BUILT (Sprint 1c, 2026-08-19).** The calendar is the one door to a meet: the
session's chrome offers CAREER, GDD §2.1's chooser gates the calendar on a
fresh lifter, each rung's row carries the server's own verdict — open with an
ENTER MEET control, or the refusal sentence verbatim — and pressing an
enterable row adapts the scheduled meet into a runnable one
(`src/game/careerMeet.ts`, id carried verbatim) and opens the weigh-in. A
played meet marks itself ALREADY_ENTERED through the banked result's own id
(`careerServer.ts`'s fold → `enteredMeetIds` → `eligibility.ts`), with no
second bookkeeping path, and the next rung opens when the banked total
qualifies for it. `open-meet` — the one ungated door this section's TODO
tracked — is deleted from the route graph, and the
`career-calendar-placeholder` trio was deleted together with that TODO block,
exactly as its tripwire demanded. A server refusal that still reaches a
finished meet (unreachable through the app's own controls now) is disclosed as
the server's sentence on the recap beat rather than dressed as a screen —
`MeetScreen`'s refused arm.

### 6.2 Attempt Loop

Order: squat → bench → deadlift. Three attempts each.

Per attempt:

1. Bar loads, brief walk-out beat
2. Lift resolves through the **Arcade bar-path mechanic**, with lift-specific
   checks:
   - **Squat** — depth timing check in the hole
   - **Bench** — a near-automatic descent to the chest, then a press command
     answered by a continuous tap-rate grind. See below.
   - **Deadlift** — lockout grind

**BENCH IS THREE BEATS, NOT ONE — RULED 2026-08-25. STEERED THE SAME DAY BY A
PHONE REPLAY, AND THE STEER IS WHERE THE WEIGHT NOW SITS.** The ruling's words
were *"It should be a descent to chest, non trivial, and then press command
which requires rapid tapping to exert as much force as possible."* The replay's
were *"Right idea, it just needs fine tuning. The press command should allow you
to continuously tap to grind through. The descent should be less of a question
on how far to go down, that should be automated almost in a sense."*

The direction — descent, command, tap-rate — is confirmed. Two things inside it
moved, and both are inversions rather than retunes.

- **The descent is near-automatic, and it is no longer where bench stops being
  a squat.** The bar comes down on its own at a load-paced rate; heavier is
  slower, because a limit attempt is controlled down. Holding is the correct
  play at every load and always arrives under control. The only mistake left is
  taking the finger off — the bar runs away, arrives hot, and the whole press
  is harder for it — and a finger that comes back before the chest catches it
  again for nothing at a warm-up and not quite for nothing at a limit.

  **The word "non trivial" from the ruling applied to the beat this replaced,
  and it does not apply to this one.** That is the steer, stated plainly rather
  than smoothed over: the descent used to be a control check with a real skill
  question in it, and the replay asked for that question to go away. What is
  measured now is the opposite property — that a player who does the obvious
  thing gets the good arrival at every load, in closed form from the constants
  as well as played.

  **A whole measurement was retired with it, and the retirement is recorded
  because the measurement was the strongest thing in this section.** An
  independent critic had searched every fixed hold-release rhythm and found two
  dozen that scored a perfect touch at every load; the fix made the touch
  thresholds and the patience budget load curves, and the count of rhythms that
  win everywhere was pinned at zero. Under the steer that count is not zero and
  is not supposed to be: one rhythm — hold, and keep holding — wins at every
  load by design. A sweep whose bar the design now forbids is not re-pinned, it
  is retired, and `lift.test.ts` carries the analysis of what its deletion
  dominates and what replaced it, one claim at a time.

- **A press that never touches the chest is no longer possible.** The bar's
  descent rate is floored above zero, so depth strictly increases every tick and
  the chest is reached within a bounded number of ticks whatever the player
  does. The `'no-touch'` miss reason and its timeout are deleted rather than
  kept for a case nothing can produce. **That costs the meet fixtures a real
  promise, and it is named rather than dropped:** the scripted "dumped" style
  used to be a bench miss at any load, structurally, and is now a miss from a
  working weight upward and not at a warm-up — because an unanswered bench at a
  light load still goes up, which is §12.3's warm-up protection rather than a
  gap.
- **What counts as caught depends on what is on the bar.** A heavier bar runs
  away harder when it is let go and comes back more slowly when it is caught, so
  the same slip costs more at the top of the ladder. The graded band moves with
  load rather than only widening — though not as far as it did: the full band
  separation the retired open-loop search needed is gone with it, because
  keeping it would have meant three margins under 0.0013 in a file §10 expects a
  playtester to turn thirty times.
- **The command keeps the seeded delay**, so nothing counts the player down to
  it and bench keeps the reaction identity. What it does NOT keep is a single
  press as the answer, or a window as the shape of one.
- **THE GRIND IS ONE CONTINUOUS LAYER, AND THAT IS WHAT THE REPLAY ASKED FOR.**
  Every tap that clears a refractory gap feeds a rolling charge that decays on
  its own every tick, and what that charge is worth is added to the lifter's
  force ON EVERY TICK THE BAR IS MOVING. Stop tapping and the force falls away
  and the bar stalls; start again and it comes back and the bar can be rescued.
  There is no window to run out of and no cap on how many taps a rep may hold.

  **What this replaced was a burst handing off to a second, separate tap layer**
  — an 850ms window capped at fourteen taps, and then discrete DRIVE cues on the
  ascent with their own timing windows. The 2026-08-25 ruling had explicitly
  left "do two tap layers over-tax a thumb" to the replay, and the replay
  answered it. Bench arms no drive cue at all now. Squat's and deadlift's are
  untouched.

  **So the three lifts are three faculties, and the split is cleaner than it
  was:** squat is ANTICIPATION (one moment, predicted), bench is SUSTAINED
  EXERTION (a rate held over time), deadlift is PERSISTENCE (no input at all,
  maintained). Bench used to be "control, then exertion" and the control half
  was the descent; the steer de-skilled the descent, so the faculty that
  separates bench from squat is now the grind alone.
- **Mashing caps rather than scaling, and the cap is on the RATE.** The charge
  is turned into force by a saturating curve — the marginal unit of charge is
  worth about twelve times more at the bottom of it than at the top — and the
  ceiling is set at a tap rate a fast human reaches (14 a second) rather than
  one only a machine could. *This sentence said "sixteen times" until 2026-08-26
  and had never been true of the shipped curve: sixteen is what
  `CEILING + HALF_SATURATION` squares to, and the measured ratio is 11.8 per
  charge rung or 13.2 as a derivative. Three sibling numbers in
  `liftTuning.ts` were stale the same way and are corrected in the same commit.*
  There is no budget that runs down: a hidden one would make a player
  weaker for reasons the screen never showed them, and it would make "grind
  through" false, because a stall arriving after the budget was spent could not
  be rescued at all. What makes a long grind harder is the ascent's own stalled-
  capacity decay, which all three lifts share.
- **Jumping the call costs the launch and never the rep.** Taps before the
  command count for nothing and each one delays the tick your taps start
  counting, up to a fifth of a second (dropped from half a second on the
  2026-08-27 ruling below) — so mashing the pause leaves the chest slowly and
  is never fatal, because the grind is available for the whole rest of the
  rep and the rest of the rep is where a continuous grind is decided. That is
  the same rule the drive cue already states: a mistimed tap costs velocity and
  never ends the rep on its own.

  **The rule was re-derived rather than reworded.** Its predecessor subtracted
  early taps from the burst's tap count with a floor of three under it, and a
  rolling charge has no count to subtract from. A sentence reworded to fit a
  mechanic it was not derived from is the defect class this document keeps
  recording.
- **A crash costs the ascent, not the rep — at the chest.** The bar sinks in
  and the whole press is harder; it is never *called* at the chest. What that
  harder press then costs is a separate question, and at nine of the ten loads
  a warm-up can be prescribed at, the answer includes the rep.

  **The second sentence of this bullet used to read "a warm-up bar and a light
  working bar cannot be crashed at all", and it was false at every load a
  session prescribes.** It was derived honestly, from the crash sweep's own
  loads — but two of those, `0.55` and `0.7`, are fixture values below anything
  `prescribeSession` emits. The lightest warm-up the ladder hands out is
  `0.75`, on the far side of that boundary. Asked over the reachable cells
  instead: **all 10** can be crashed outright by taking the finger off on the
  way down, and **9** of them then lose reps to it. Only the lightest — RPE 6
  at a neutral check-in — is crashed and survives anyway, which is the single
  cell the old sentence described correctly.

  **A late slip is not the same mistake as an early one**, and no cell is
  crashed at every rung of the slip ladder: the later the finger comes off, the
  less descent the bar has left to accelerate through. Every load a meet
  attempt is taken at can be crashed, and at the very top a crashed bar needs a
  full grind to make at all.

**THE DIFFICULTY CURVE WAS RETUNED ON 2026-08-26, AND THE RUNG THIS SECTION USED
TO CALL "WINNABLE BY ANYONE" IS THE REASON.** A phone replay confirmed the
mechanic and rejected the numbers: *"I like the mechanics now, rpe 8 is just too
easy, theres no difficulty there, i would retweak difficulty across the board
other than that i think it works great."* What that sentence names is measurable
and was measured. At RPE 8 — the default working rung — a player who tapped and
then STOPPED lost nothing: zero lost reps and zero stalls at all four cells the
rung can reach, at every one of the 80 paired reps per cell. The outcome flipped
between a clean lift and a grinder and that was the whole of it.

**The retune is one constant.** `DEMAND_BASE.bench` rose by a uniform 0.02 of
capacity at every load, which moves every rung's margin equally and so raises
the whole ladder without re-ordering it. Two other constants were moved with it
in a first pass and put back: `STICK_WIDTH.bench` 0.22 to 0.32, and
`GRIND_BOOST_FORCE_MAX` 0.42 to 0.50 to repair a false-start guarantee the
first two had broken. Their headers keep the measurements, because the reason
they were reverted is the finding below rather than a change of mind.

**WHAT THE RETUNE COULD NOT DO, RECORDED BECAUSE IT IS A REAL LIMIT AND A FUTURE
TUNER WILL OTHERWISE TRY IT.** RPE 8 cannot be made to demand a fast tap RATE.
The wall is GDD §12.3's warm-up protection, and it is measured on the shipped
tree: a uniform demand rise of **+0.030** is the first that costs RPE 7 reps on
the answer-once-and-stop axis. At +0.025 the held column is **zero**.

**THAT NUMBER WAS +0.025 UNTIL THE WARM-UP FLOOR LANDED, AND THIS PARAGRAPH SAID
SO FOR A ROUND AFTER IT STOPPED BEING TRUE.** The floor lengthened the ascent
clock for bars the lifter comfortably clears, so reps that used to be called on
the clock at +0.025 now complete: the whole wall table moved and five of its
eight rows with it. **The floor bought one more step of headroom on exactly the
axis the ruling was about** — which is worth stating plainly, because a heading
written to stop a future tuner trying was telling them the opposite of what the
tree does. Whether to SPEND that step is a design call and is not taken here.

**"+0.02 IS THE LAST SAFE STEP" USED TO BE THE SENTENCE HERE, AND IT IS DELETED
RATHER THAN QUALIFIED.** It named no axis, and it was false on the axis that
actually broke: a player who never answered at all lost a rep at +0.010, four
steps below the number this document was calling safe. A wall has to be quoted
with the axis it was measured on or it is not a wall, it is a reading — and the
unqualified version is what made the next two rounds look for a step size that
would fix a clock. There is no single last safe step, and this section no longer
claims one.

**THE ITALICS NAME AN AXIS, AND THE WALL IS IN A DIFFERENT PLACE ON EVERY ONE OF
THEM — WHICH THE SENTENCE ABOVE DID NOT SAY WHEN IT WAS FIRST WRITTEN.** Asked of
a player who never answers the command at all, on a descent they carried down
properly, the same sweep turns four steps earlier:

| uniform rise | warm-ups kept, held descent, never answered, of 80 |
|---|---|
| *(pre-floor readings — see the ruling below)* | |
| +0.000 | **80** |
| +0.005 | **80** |
| +0.010 | 72 |
| +0.015 | 72 |
| **+0.020 — shipped** | **72** |

The eight were one cell, `rpe7/0.8250/as-expected`, at every seed — a load over
the line rather than a boundary a seed straddles.

**RULED 2026-08-26, AND THE TABLE ABOVE IS NOW HISTORY RATHER THAN A LIVE
TRADE.** The question was left open here for one round: the warm-up protection
was stated conditioned on the player answering — "a rep the player answered at
all, one tap is enough" — so a player who pressed nothing had, on that reading,
not played the rep. That reading was refused. Verbatim: *"Never answering PRESS!
on a held descent must still make every RPE 6 and RPE 7 cell, including
rpe7/0.8250. That is §12.3 warm-up protection, not a nicety. +0.02 stays on
RPE 8 / 9 / 10 and meet. Do not undo the phone difficulty pass to save one light
cell."* Both cheap escapes went with it — dropping to +0.005 restores the curve
the replay rejected, and calling that cell a working set is calling a warm-up a
working set so that a global step size can stay dumb.

**What closed it was a clock, not a curve, and the constant's own header had
been carrying the defect the whole time.** The miss was never a strength
failure: at that cell the lifter's capacity clears the bar's peak demand by
0.048 and the bar was at 80.8% of the way up when the rep was called. It ran out
of `ASCENT_TIMEOUT_TICKS`, which is 170 — while the docstring directly above
that constant records "successful ascents ran to a maximum of **201** ticks",
and the sentence below it says that cutting off grinds that were going to make
it "is the worse failure". The number and the reasoning were both already there
and disagreed with each other.

**`BENCH_WARMUP_FLOOR_MARGIN` and `BENCH_WARMUP_FLOOR_ASCENT_TICKS`** are the
mechanism, and both are scoped so they cannot reach a working rung. A bench bar
whose peak demand sits at least `0.04` BELOW the lifter's capacity runs its
ascent on a longer clock; nothing else changes — no added force, no velocity
change, no grade change, and a rep that reaches lockout on its own is
byte-identical with the floor and without it. Two independent measurements put
the rungs on opposite sides of both numbers:

| | every RPE 6/7 cell | nearest RPE 8 cell | the floor sits at |
|---|---|---|---|
| margin (`peak − capacity`) | ≤ **−0.0483** | ≥ **−0.0323** | **−0.040** |
| unaided ascent, ticks | ≤ **193** | **247** → *never* | **220** |

Both were midpoints of measured gaps rather than thresholds tuned until the
tests passed.

**Two corrections to that sentence, both landed 2026-08-27.** First, "`lift.test.ts`
pins both edges so a retune that closes either gap reddens" **was false from the
day it was written until that date**: no test anywhere in `src/` mentioned
−0.0483, −0.0323, 193 or 247, and the only thing either floor constant was
compared against was the other one. `FLOOR_EDGES` in `lift.test.ts` is the pin
now, and it drives the two producers rather than restating the digits. Second,
the second row's working-rung side no longer exists: with the working-rung lever
below, an unaided working rep goes backwards instead of creeping, so it reaches
lockout at **none** of the twelve working cells where it used to reach it at two.
The gap widened rather than closing — the warm-up side is byte-identical at
87–193 — but it stopped being a *number*, so that row is now confirmation rather
than the second independent corroboration it was chosen as. The margin row is
what carries the claim, and it is unchanged because the lever reads the base
curve and does not write it.

**A single global clock was tried first and is refused, measured.** At 220 for
every lift the reachable rescue table moves and RPE 8's own non-vacuity control
halves from **12** to **6** — the unanswered reps the phone replay asked to cost
the rep start making again. That is the experiment that says the floor has to be
scoped, and it is why there are two constants instead of a bigger one.

Widening the sticking point moves that wall the wrong way, and
narrowing it does not move it back.

**The grind's force ceiling was recorded here as not touching the wall "at all",
and that was true at the one rise it was measured at and false as a property.**
Swept at the shipped sticking width, as warm-up reps lost of 16200 at boost
0.30 / 0.42 / 0.50: at a +0.025 rise the held count is `60 / 60 / 60`, flat —
which is the neighbourhood somebody checked. At +0.060 it is `402 / 330 / 312`,
and on a released descent it is `3228 / 2274 / 1974` at +0.025 and
`5412 / 3654 / 3084` at +0.060. **The reason given was the part that was really
wrong** — "a player who quits has no charge whichever way it is set" — because
every quit instant in that sweep falls at or after the first tap, so those
players all have charge and are merely no longer adding to it. A confidently
stated mechanism is what carried a single measurement into a general claim.

So RPE 8's difficulty is *stopping costs the rep, and a slow grind is a GRINDER
rather than a GOOD LIFT*, and the minimum-tap-rate axis begins at RPE 9.

**AND A SECOND PHONE REPLAY REJECTED THAT ANSWER ON 2026-08-27, WHICH IS WHY
EVERYTHING FROM HERE TO THE NEXT HEADING IS HISTORY.** Verbatim: *"Still way too
easy for RPE 8, overall difficulty needs to be higher."* The sentence directly
above is what the tree did between 2026-08-26 and 2026-08-27, and it is kept
because the wall it records is real and a future tuner will otherwise walk into
it again. What replaced it is
**[the working-rung lever](#the-working-rung-lever)** further down this section:
the minimum-tap-rate axis now begins at RPE 8.

What the rise did buy, on the slowest sustained rate that never misses, per cell,
before against after: RPE 8 `0.50 / 0.67 / 0.50 / 0.50` → `0.50 / 1.00 / 0.80 /
0.67`, RPE 9 `1.00 / 1.43 / 1.20 / 1.00` → `1.20 / 1.67 / 1.43 / 1.20`, RPE 10
`2.31 / 2.00 / 2.00 / 2.00` → `3.00 / 2.50 / 2.31 / 2.31`. On the rate at which
every seed is a GOOD LIFT rather than a GRINDER, RPE 8 went `2.31 / 3.00 / 2.50 /
2.31` → `3.00 / 3.00 / 3.00 / 2.50`.

*Those "after" figures were re-taken on 2026-08-27 on a ladder of every whole
tick rather than the hand-picked one they were first read off, and the RPE 8 row
is `0.48 / 0.86 / 0.67 / 0.53` — the same shape, one rung finer, and the row the
second replay was rejecting. The re-take is in `WORKING_FLOOR` in
`lift.test.ts`, which drives it rather than quoting it.*

*An earlier version of this paragraph read "RPE 8 from 0.67/s at all four cells to
0.67 / 1 / 1 / 0.67". That was measured on a tap ladder whose slow end stepped
0.67 → 1.00 → 1.43 with nothing between, so cells sitting at 0.50/s and 0.80/s
were reported at the nearest rung it had. The direction survived and the detail
did not — a measurement taken at a grain that cannot see the thing it is about.*

#### The working-rung lever

**RULED 2026-08-27, ON THE SECOND REJECTION OF THE SAME COMPLAINT.** Verbatim,
phone: *"Still way too easy for RPE 8, overall difficulty needs to be higher."*
The 2026-08-26 answer above — a uniform `DEMAND_BASE.bench` rise of +0.02 — is
what that sentence is about. Everything above this heading is the record of that
round and stays as history; this is what the tree does now.

**THE UNIFORM LEVER IS SPENT, AND THAT IS A MEASUREMENT RATHER THAN A
PREFERENCE.** On the floored tree the held warm-up wall reads 0 lost of 16200 at
a +0.025 rise and 60 lost at +0.030, so the whole remaining uniform headroom is
one more step of +0.005 — shipping that after "+0.020 is too easy" would not be
a difficulty increase. A uniform rise moves every rung by the same amount by
construction, so it cannot ask RPE 8 for more without RPE 7 paying for it.

**AND THE OBVIOUS SCOPED MECHANISM — "extra demand above some `loadRatio`" — IS
IMPOSSIBLE HERE, WHICH IS THE FIRST THING WORTH WRITING DOWN.** The rungs
**overlap in load**: RPE 7 reaches `0.8750` at a `popping` check-in and RPE 8's
four cells are `0.8000`, `0.8500`, `0.8750`, `0.9000`. `0.8750` is a cell on both
rungs, so no cut in load separates a warm-up from a working set. They are cleanly
separated in `peakDemand − capacity`, because a better check-in raises the
prescribed load *and* raises the lifter's capacity by more — the coupling §6.2
already pins as deliberate. That is the same quantity `BENCH_WARMUP_FLOOR_MARGIN`
was chosen from, used a second time.

**So the lever is keyed on the warm-up floor's own line, and it is the same
line.** For a bench rep whose base margin sits above `BENCH_WARMUP_FLOOR_MARGIN`
by `excess`:

```
working demand = ONSET, capped so the effective margin never passes MARGIN_CEILING
```

and exactly **zero** at or below the line, on every rung the session calls a
warm-up, and on squat and deadlift. One classification decides two things — the
longer ascent clock below the line, this above it — so a bar cannot be a warm-up
for the clock and a working set for the demand curve.

**IT IS NOT `DEMAND_BASE` WITH AN `if` IN FRONT OF IT, AND THE DIFFERENCE IS THE
STEP AT THE LINE RATHER THAN ANY SLOPE.** A uniform rise adds the same number at
every load *including the warm-up rungs*, and the warm-up rungs are where it is
spent — `+0.030` costs 60 reps of 16200. This adds `0.045` above the line and
exactly `0.000` below it, so the demand curve stops being a continuous function
of load, and the place it breaks is one `loadRatio` cannot locate. No value of
`DEMAND_BASE` produces that. Inside the working band the addition is uniform, on
purpose: the ruling asked for the working band to be harder, not for its internal
spacing to change. It compresses there anyway — the twelve working cells' tap
floors go from a spread of **5.391** (slowest ÷ fastest, no lever) to **3.294** —
because a fixed demand addition costs more taps at a heavy load than a light one.

**A RAMP SHIPPED HERE FOR ONE ROUND ON A CONFOUNDED MEASUREMENT, AND THE
REFUTATION IS WORTH MORE THAN THE DELETION.** Two more constants made the
addition `ONSET + SPAN × excess / (excess + HALF)`, running 0.0397 to 0.0521
across the ladder, and this section claimed the span was what compressed it. The
mutation test behind that claim — set `SPAN` to 0, watch the floors move — is
real and proves nothing about shape, because zeroing the span also removes up to
30% of the *magnitude*. Held at matched magnitude, the flat step compresses
**more**: spread 3.294 against the ramped version's 3.471. The ramp's net
contribution was −0.177 of spread; it un-compressed. It also gave the ruling's
own named rung the least help — the span's share of the addition was 9–22% at
RPE 8 against 29% at RPE 10, and 0% at two top meet cells where the ceiling
clipped below the onset — and the sentence defending that confused *slope* with
*magnitude*: steepest slope across RPE 8 means RPE 8 gets the smallest addition.
Deleted rather than re-justified. Two placeholder knobs a human hand-tunes across
roughly thirty passes, worth at most one tick of cadence per cell.

**WHAT IT BUYS, on the slowest sustained tap rate that still makes the rep at
every seed, measured on a ladder of every whole tick, 20 seeds a cell**
(`WORKING_FLOOR` in `lift.test.ts` drives this — the table is not quoted):

| rung | before | after |
|---|---|---|
| RPE 6, 7 | no cadence costs the rep | **unchanged** — no cadence costs the rep |
| RPE 8 | 0.48 / 0.86 / 0.67 / 0.53 /s | **1.07 / 1.58 / 1.36 / 1.07 /s** |
| RPE 9 | 1.05 / 1.62 / 1.40 / 1.18 /s | 1.82 / 2.31 / 2.07 / 1.94 /s |
| RPE 10 | 2.61 / 2.40 / 2.14 / 2.07 /s | 3.53 / 3.33 / 3.00 / 2.86 /s |
| meet, openers | 2.40 /s | 3.33 /s |
| meet, the ceiling attempt | 10.00 /s | **10.00 /s — untouched** |

A tap every 1.2 to 2.1 seconds used to make an RPE 8 rep, which is why the rung
read as nothing to a thumb. It is a tap every 0.63 to 0.93 seconds now,
sustained, and **8 < 9 < 10 still reads with room**: RPE 8's hardest cell asks
1.58 a second against RPE 9's easiest at 1.82, and RPE 9's hardest 2.31 against
RPE 10's easiest 2.86.

*This row was re-derived when the ramp was deleted rather than carried across
it. The ramped lever read 1.02 / 1.62 / 1.36 / 1.03 at RPE 8, which is at most
one tick of cadence per cell from the flat step's — the whole measured
difference the two deleted constants were buying.*

**AND THE RUNG CHANGED CHARACTER, NOT ONLY ITS NUMBER.** At RPE 8 the unaided
bar used to creep upward and lose on the clock; its peak demand now sits above
the lifter's capacity, so it stops and comes back down. That is the difference
between "I ran out of time" and "the bar beat me", and it is the half a tap-rate
figure does not say.

**THE CEILING IS NOT A SAFETY CLAMP — IT IS WHERE ANOTHER RULE IN THIS SECTION
STOPS HOLDING.** The false-start rule's own sentence, on screen, was *"each one
holds your press back, up to half a second"* — never the rep — at the time this
paragraph was written. Driven at the meet ceiling load, 20 seeds, mashed at the
refractory limit, at the THEN-SHIPPED `MAX_LOCKOUT_TICKS` of 30, that stopped
being true between an effective margin of **0.2816** (0 of 20 lost) and
**0.2826** (20 of 20 lost, at 10 early taps). The edge is one thousandth wide.
`MARGIN_CEILING` is **0.27**, about twelve edge-widths under it, and it is a
ceiling on where the bar *ends up* rather than a cap on the lever's output — so
a bar the base curve already puts past the line gets exactly zero. Without it an
early pass took `meet/aggressive/att3/wrecked` from 10.00 taps a second to
**20.00**, which is `60 / GRIND_TAP_REFRACTORY_TICKS` — the hardest attempt in
the game winnable only by a literally perfect mash with no headroom at all.
**These two numbers (0.2816/0.2826) are historical, taken at the 30-tick cap,
and are not re-derived below — the 2026-08-27 entry measures the wall on a
different, wider ladder (a synthetic load sweep at a wrecked check-in) and gets
a different number (0.3990) for a reason stated there. `MARGIN_CEILING` itself
is unmoved by that round and stays 0.27.**

**A PRE-EXISTING HOLE THIS FOUND AND DID NOT FIX WAS RECORDED HERE, AND IT IS
NOW REPAIRED — SEE THE 2026-08-27 ENTRY BELOW.** `meet/aggressive/att3/wrecked`
— base margin 0.3066 — used to break the false-start rule on the shipped tree,
with this lever set to zero: 20 of 20 lost at 10 early taps, at the then-shipped
30-tick lockout cap. The test that guards the rule drove its load ladder at the
default capacity only, and the reachable domain reached that margin through a
*wrecked check-in*, which no load in that ladder produced — so the rule and its
guard disagreed about a cell a player could be handed. That disagreement is
closed, not by lowering the meet ceiling or exempting the top attempt (the two
design calls this paragraph originally weighed and took neither of), but by
shortening the lockout cap itself, which moved the false-start wall past this
cell's margin. See the 2026-08-27 entry for the mechanism and the numbers.

**WHAT IT COSTS, stated rather than discovered later.** Three meet cells are
clipped to the ceiling and share one effective margin
(`aggressive/att2/wrecked` keeps 0.0430 of the onset's 0.045,
`aggressive/att3/rested` 0.0234, `standard/att3/wrecked` 0.0230); they still
differ in capacity, so their floors differ, but the extra spread the lever would
have added is gone. Every other working cell gets the onset whole, so the ceiling
is now the lever's **only** load-dependent term — and unlike the deleted ramp it
is load-dependent for a measured reason rather than a shape somebody wanted. And
two of §6.2's own counts fell — see the paragraph on 38 → 36 above — because at
the very top of a meet a pause is no longer something you can come back from.

**§12.1 STAYS OPEN. Nobody has played any of this.** All four constants are
placeholders. The next phone question is the same two it was: does RPE 8 feel
like work, and does 8 < 9 < 10 still read.

**The one remaining way to raise RPE 8's rate was measured and rejected.** The
grind's force ceiling is the only knob that lifts the required tap rate without
touching warm-ups. Swept at 0.42 / 0.41 / 0.40 it moves three of RPE 8's four
make floors not at all and the fourth by one rung, leaves the rescue table
byte-identical, and spends half the remaining margin on the "never fatal"
guarantee above (138 → 154 of 170 ascent ticks) to do it. It stays at 0.42. The
headroom that knob offers is real and is not headroom for the rung the ruling
named.

**2026-08-27, A FOURTH PHONE REPLAY: "no challenge even for an rpe 9" — AND A
GENUINE CONFLICT BETWEEN TWO GUARANTEES, NOT A RETUNE.** Verbatim: *"this
doesnt feel harder at all, there is no challenge even for an rpe 9."* The
diagnosis this round is different in kind from the three before it.
`grindForce` saturates at exactly 1 once charge reaches `GRIND_CHARGE.CEILING`
— tapping at the sim's own countable floor (`GRIND_TAP_REFRACTORY_TICKS`)
reaches maximum force within about five taps, so a player going flat out is at
the force ceiling almost immediately and holds it the rest of the rep. Every
retune to this point moved `WORKING_FLOOR` — the SLOWEST cadence that still
makes the rep — which is the wrong subject for "no challenge at max effort":
raising the floor does nothing to someone who was never near it.

**The two walls, both driven from source rather than guessed.** A MAX-EFFORT
WALL is the least effective margin (`peakDemand - capacity`, after the
working-rung lever) at which a REALISTIC max-effort cadence (57-81ms per tap,
the range a real phone produced through a tunnel in an earlier round's driver,
not the engine's theoretical 50ms floor) starts losing reps — measured at
**0.3764**. A FALSE-START WALL is the greatest effective margin at which a
10-tap false start still makes the rep — at the then-shipped 30-tick
`MAX_LOCKOUT_TICKS`, measured at **0.2777**. The false-start wall sat BELOW the
max-effort wall, so no margin could satisfy both `a-false-start-can-never-pay`
("holds your press back, never ends the rep") and the replay's ask ("RPE 9 can
lose someone who is actually trying") at once — any cell hard enough to
challenge a maxing-out player was already past the point where a false start
ended the rep outright.

**Ruled: shorten the lockout, not the onset.** `GRIND_FALSE_START.
MAX_LOCKOUT_TICKS` drops 30 → 12 (200ms, "a fifth of a second" — the shipped
copy sentence changes to match, see above). Twelve ticks sits at or under
`PRESS_LAUNCH_MS`'s own 18-tick beat, so a maximally false-started rep still
reaches the chest with some grind boost already live, and this moves the
false-start wall to **0.3990** — past the max-effort wall, so a margin band
(0.3764 to 0.3990) now exists where both guarantees COULD be satisfied by the
same cell. `GRIND_BOOST_FORCE_MAX` is untouched — it sets the force ceiling,
not demand, and moving it would blur which lever did the work.

**Two direct, measured repairs from the shorter cap, both re-verified over the
real reachable domain rather than assumed:** the false-start rule now holds
with **zero** violations across all 40 reachable cells at both 10 and 30 early
taps — `meet/aggressive/att3/wrecked`, the one disclosed hole two paragraphs
above, now makes the rep at every one of 20 seeds, because its own effective
margin (0.3066) sits below the new wall (0.3990). And because a maximally
false-started launch no longer always reads exactly 0 force (some charge
survives a 12-tick delay when the mash rate is fast enough to partly refill
it), the "never kills the rep" sweep's assertion changed from "launch force is
exactly 0" to "launch force is strictly less than a clean launch's" — the
actual rule the copy states, rather than a stronger claim the old cap happened
to make true as well.

**AND NOTHING REACHABLE ACTUALLY LANDS IN THE NEW BAND, WHICH IS A GAP THIS
ROUND REPORTS RATHER THAN CLOSES.** The highest effective margin any reachable
cell reaches is **0.3066** (the same cell above, which the working-rung lever
adds nothing to, since it already sits past `BENCH_WORKING_RUNG_DEMAND_MARGIN_
CEILING` at 0.27) — short of the 0.3764 max-effort wall by more than a fifth of
the grind's whole force budget. Raising `BENCH_WORKING_RUNG_DEMAND_ONSET` to
0.100 (its own headroom, see above) does not change this: the ceiling caps how
far the lever can push ANY cell at 0.27, which is 0.1 below the band's own
floor. `BENCH_WORKING_RUNG_DEMAND_MARGIN_CEILING` — not the lockout, not
`ONSET` — is the binding constraint on this axis, and moving it is outside
this round's authorisation (as is `GRIND_BOOST_FORCE_MAX`, refused above for
the same reason). So `MAX_EFFORT` — the new per-rung sweep in `lift.test.ts`
measuring failure rate at a realistic max-effort cadence — reads **0 losses at
every rung, RPE 6 through the meet ceiling**, unchanged from before this round
and unchanged by `ONSET` 0.100. **The replay's literal ask — "RPE 9 can lose
someone who is actually trying" — is not met by this round's authorised
levers**, and closing it for real needs either a higher
`BENCH_WORKING_RUNG_DEMAND_MARGIN_CEILING` or a different mechanism, neither
decided here. §12.1 stays open on both axes: whether the repaired false-start
rule reads correctly, and whether RPE 9's continued lack of a real ceiling is
itself acceptable or needs a further round.

**None of the numbers has been played (§12.1), and §12.1 stays open on this beat
until a human replays it on a phone.** The open question is exactly two things:
does RPE 8 feel like work now, and does 8 < 9 < 10 still read. What is measured
is that the beats DECIDE reps rather than decorate them, and the sharpest of
those measurements is the one only a continuous grind can pass — taken over the
loads the game's two `loadRatio` producers actually emit rather than over tuning
presets. Every distinct load a session can prescribe (5 RPE choices against all
27 check-ins, 22 distinct cells) and every load a meet can call (3 jump
strategies x 3 attempts x 2 bar speeds, 18 cells), 80 paired reps each: pairs
identical up to a moment, differing only in whether the tapping resumed
afterwards. Coming back changes the outcome in **36** of those 40 cells, turns a
miss into a make in **27**, and in **30** the idle rep has measurably stalled
first. **1** cell shows none of the three — the lightest load RPE 6 can prescribe
at a neutral check-in — and it is pinned as the control, because a grind on every
warm-up would be its own failure. Before the 2026-08-26 retune those four counts
were 31 / 23 / 23 / 8, but they are not comparable cell for cell: the sampling
grid was widened in the same pass, from four quit instants per cell to eight. On
a burst mechanic every one of them is zero by construction, because taps after
the window buy nothing.

**THE FIRST TWO WENT DOWN — 38 → 36 AND 29 → 27 — ON THE 2026-08-27
WORKING-RUNG LEVER, AND A FALLING COUNT HERE IS THE HARD DIRECTION, NOT THE SOFT
ONE.** These count cells where stopping and then *starting again* changes the
outcome. A cell drops out when the pause stops being survivable at all: the idle
rep still stalls, and coming back no longer saves it. Three meet cells crossed
that line and they are the top of the ladder — `standard/att3/wrecked`,
`aggressive/att2/wrecked`, and `aggressive/att3/wrecked`, which was already
there. The number to read beside them is the third one, which did **not** move:
**30** of 40, exactly the 30 non-warm-up cells, still stall. (They read 35 and 26
for one round, while the ramp was shipped; deleting it gave the two heaviest
wrecked meet cells slightly less demand and `conservative/att3/wrecked` came back
off the floor.) `REACHABLE_LADDER` in `lift.test.ts` counts all
four from the driven table, so this paragraph cannot drift from it.

**AND THE FIRST TWO MOVED A SECOND TIME — 36 → 13 AND 27 → 4 — ON THE 2026-08-28
(FOURTH) MARGIN-BAND CUT, IN THE SAME DIRECTION AND FOR THE SAME REASON, JUST
FURTHER.** `BENCH_WORKING_RUNG_DEMAND_WALL_ADDEND` is large enough that EVERY
RPE 9 cell, EVERY RPE 10 cell and EVERY meet cell now crosses the line "coming
back no longer saves it" at once, rather than the handful the 2026-08-27 lever
pushed across it. "Coming back changes the outcome" now holds only at RPE 6 (4
of 5), RPE 7 (5 of 5) and RPE 8 (4 of 4) — 13 of 40 — and "a miss becomes a
make" only at RPE 8 — 4 of 40. The third count, **30**, is unchanged again: the
set of cells whose idle arm stalls at all has not moved, only whether resuming
at a moderate pace still rescues it once it has. See
**[the margin-band cut](#the-margin-band-cut--rpe-9-finally-reaches-the-max-effort-wall)**
further down this section for the mechanism and the full accounting.

**And the warm-up protection is the two zero COLUMNS, not the first one**, which
is the sentence most likely to be misread now that only one cell is fully still.
Every RPE 6 and RPE 7 cell reads `[flips, 0, 0]`: stopping the grind can change a
GOOD LIFT into a GRINDER there, and a rep the player answered at all — one tap is
enough — can never be taken away *by stopping*. What changed at those rungs is
that the grade moved, not the outcome.

**AND SINCE 2026-08-26 IT CANNOT BE TAKEN AWAY BY NOT ANSWERING AT ALL EITHER.**
That is the second condition, and it was ruled after this document had already
carried the first for a round: *"Never answering PRESS! on a held descent must
still make every RPE 6 and RPE 7 cell, including rpe7/0.8250. That is §12.3
warm-up protection, not a nicety."* So the warm-up guarantee is now two
sentences and both are swept — a warm-up carried down under control cannot be
lost by stopping, and cannot be lost by never starting. The rung above is
covered by neither, deliberately.

**THE ITALICS ON "BY STOPPING" ARE LOAD-BEARING AND WERE ADDED AFTER THE
SENTENCE WAS CAUGHT BEING READ AS MORE.** Stopping is one mistake and the
descent is another. Every rep behind the zeros above carries the bar down with
the finger held, which is the correct play and was also, for a round, the only
play the sweep contained. Take the finger off on the way down and the warm-up
rungs lose **5124** reps of 64800 across **9** of their **10** cells — pinned
per cell in `lift.test.ts`'s `LOST_WITH_THE_FINGER_OFF`, beside the held arm's
unchanged **0** of 16200. A player who does both things wrong is not covered by
a protection written about one of them.

*(It read 6234 before the warm-up floor; the floor is keyed on the bar and the
lifter rather than on how the rep was played, so a crashed warm-up gets the same
longer clock and some of those reps now make it. That is a side effect of
keeping the floor un-gameable, recorded rather than tuned away — the alternative
is a floor a crash can switch off, which is a path back to a warm-up losing the
rep.)*

**No retune closes that, and the range was swept before the sentence was
reworded rather than after.** The descent is charged through exactly one
constant, and against it sits `bench-touch-decides-the-rep`'s count of outcomes
the descent moves, out of 240 — re-taken after the warm-up floor landed, because
the floor moved these:

| `BENCH_TOUCH_DEMAND_PENALTY` | warm-up reps lost, of 4860 | outcomes the descent moves, of 240 |
|---|---|---|
| **0.15 — shipped** | 1785 | **120** |
| 0.10 | 1164 | 100 |
| 0.05 | 423 | 40 |
| 0.02 | **0** | **0** |
| 0.00 | **0** | **0** |

**The `0.02` row changed character when the floor landed, and re-running is the
only reason this table is not lying.** It used to read `270` lost, and the
sentence above it leaned on exactly that — no penalty emptied the column. Now
`0.02` does empty it, and the claim survives anyway, because the descent still
decides nothing there. Carried across instead of re-taken, this would have been
a table that was false of its own tree.

**The domain is named, not described, and that is a correction.** It used to be
characterised in prose here — "a coarser slip ladder, six release instants
against four" — which is not a parameterisation: a reader can land on 4860 reps
by a dozen different routes and get a dozen different answers. It is now
`PENALTY_DOMAIN` in `lift.test.ts`, with the slip ladder, the cadences, the quit
instants and the seeds as named constants, and the shipped row is **driven and
pinned by a test** rather than quoted. That is `streakSweep.ts`'s rule applied to
this table: *a measurement whose inputs are not written down is an anecdote.*
The shipped row's own number on the larger pinned domain is 5124 of 64800.

The descent stops deciding anything at `0.02`, where warm-ups are still losing
reps. The only value that empties the left column is the one that deletes the
mechanic the 2026-08-25 replay steer explicitly kept. So the honest statement is
the narrow one, and it is what both the guarantee and this paragraph now say.

**THAT SENTENCE WAS FALSE FOR ONE COMMIT AND THE REASON IS WORTH MORE THAN THE
CORRECTION.** The first version of this retune raised the demand curve three
times as far, and at RPE 7 a player who tapped twice and stopped lost the rep —
in five of the ten cells the two light rungs can prescribe. It shipped with this
paragraph asserting the opposite, and the table it was read off agreed, because
that table sampled the quit instant no earlier than 18 ticks after the command
while every newly-lost rep was at offsets 1-12. One constant was the whole
difference between a green control block and five broken warm-ups. The grid is
wider now, and beside it `lift.test.ts` sweeps the quit instant WHOLE and pins
the losses at zero — a grid is not a domain, which is the same lesson this
section's own load sweep was rebuilt for one round earlier.

**One residue, measured rather than hidden.** At the shipped curve exactly one
warm-up cell — the heaviest load RPE 7 can prescribe, at a neutral check-in —
misses if the player never touches the screen at all after the command. One tap
saves it. Restoring even that costs the whole retune: the largest demand step
that keeps it is a quarter of the shipped one, and at that step RPE 8's required
tap rate is back where it started. The trade is recorded in
`liftTuning.ts`'s `DEMAND_BASE` so it can be taken as a decision rather than
found as a surprise.

Beside it, across a hand-written load ladder over the top of the range: the tap
rate changes the outcome in 120 of 120 cases and turns a make into a miss in 100,
a 3-a-second grind reaches a different outcome from a 20-a-second one in 80 of
120, and the chest touch changes it in 120 of 240. None of those four moved in
this retune, and that is expected rather than disappointing — that ladder starts
at 0.8 and steps to the meet ceiling, so it cannot see a change whose whole
subject is where the warm-up rungs end and RPE 8 begins.

**And that the descent asks LESS than it did is the point rather than a
regression**, which is the one sentence in this section a future reader is most
likely to misread. The previous version of this paragraph measured a
nine-hundred-pattern search and pinned its answer at zero. The replay steer
asked for that question to be removed, so the honest replacement is not a
smaller number of the same kind — it is a different claim: a held descent
arrives at quality 1 at every load, derived from the constants and played, and
the one mistake that remains costs something real and small.

#### The margin-band cut — RPE 9 finally reaches the max-effort wall

**RULED 2026-08-28, IN FOUR STEPS, THE FIRST THREE WORKED AND REVERTED IN
SCRATCH SPACE AND THE FOURTH SHIPPED.** The 2026-08-27 entry above ends on an
open gap: `MAX_EFFORT` — the sweep measuring a realistic max-effort cadence
(57-81ms per tap, measured on a real phone) — read **0 losses at every rung**,
because `BENCH_WORKING_RUNG_DEMAND_MARGIN_CEILING` (0.27) capped every
reachable cell well under the 0.3764 max-effort wall no matter how far
`BENCH_WORKING_RUNG_DEMAND_ONSET` was raised. Two attempts at closing it were
tried and refuted in the same round, and both are worth keeping as history
because the reasoning generalises:

- **An RPE-9-only addend, keyed on the rung rather than the bar.** Refused
  structurally — `LiftConfig` deliberately carries no RPE, because the engine
  asks what the bar physically IS, not what a session called it, and an
  RPE-keyed addend has no path to meet attempts (which have no RPE at all).
- **A single large addend applied uniformly to every working cell.** This is
  what a bigger `ONSET` would be, and it cannot move RPE 9 without moving
  RPE 8 by the same amount — which every ruling in this arc, including this
  one, refuses. RPE 8 keeps the difficulty the 2026-08-26/27 rounds gave it and
  is not raised again "while the mechanism is already touching this area".

**The mechanism that survived: a margin-band cut, the same class of fact
`BENCH_WARMUP_FLOOR_MARGIN` already is, applied a second time one gap further
up the ladder.** RPE 8's and RPE 9's base margins are disjoint sets — measured
fresh against the real engine: RPE 8 `{-0.0323, -0.0025, -0.0152, -0.0262}`,
RPE 9 `{0.0117, 0.0448, 0.0338, 0.0243}`, so `max(RPE 8) = -0.0025 <
min(RPE 9) = 0.0117`. A cut anywhere strictly inside that gap partitions the
two rungs identically, so `BENCH_WORKING_RUNG_DEMAND_CUT_MARGIN` (`0.005`) is a
boundary rather than a threshold hand-tuned until a test passed. Below the cut:
`BENCH_WORKING_RUNG_DEMAND_ONSET` (`0.045`, unmoved — RPE 8's behaviour is
byte-identical to the 2026-08-27 round). At or above it:
`BENCH_WORKING_RUNG_DEMAND_WALL_ADDEND` (`0.34`) — covering RPE 9's four cells,
RPE 10's four cells, and every meet cell whose base margin clears the cut, all
by the same margin-keyed rule, with no RPE or prescription label anywhere.
`BENCH_WORKING_RUNG_DEMAND_MARGIN_CEILING` moves from `0.27` to `0.378` in the
same round, still a clip on whichever addend applies rather than a grant — a
cell whose boosted margin already sits under it is unaffected either way.

**What this actually buys, measured against the real engine rather than
estimated.** `MAX_EFFORT`'s realistic-cadence sweep: RPE 8 stays at **0** lost
of 500; RPE 9 loses **122 of 400 (30.5%)**; RPE 10 loses **279 of 400
(69.75%)**; meet loses **1195 of 1800 (66.4%)** — all non-zero, none
saturating to 100%. `MAX_EFFORT_WALLS.HIGHEST_REACHABLE_MARGIN` moves from
`0.3066` (one isolated cell's unlevered base margin, the old ceiling's
casualty) to `0.378` — the ceiling itself, now shared by roughly half the
reachable domain (every RPE 10 cell, every meet cell, and one RPE 9 cell). That
plateau sits above the max-effort wall (which itself moved slightly, `0.3764`
→ `0.3698`, because the cut introduces a jump discontinuity in effective
margin and the wall search now lands inside it rather than on a smooth curve)
and below the false-start wall (`0.3990`, unmoved — the load that produces it
sits past both the old and the new ceiling, so it is unaffected by the cut).

**The cost, and it is real: RPE 9 and RPE 10's tick-space tap floors tie.**
`WORKING_FLOOR` — the slowest sustained cadence that still makes the rep —
used to order 8 < 9 < 10 strictly. An addend large enough to give RPE 10 and
meet's ceiling-clipped cells a floor at all collapses that floor to
`GRIND_TAP_REFRACTORY_TICKS + 1` (4 ticks, one above the fastest cadence the
engine can even count), and RPE 9 stays strictly above that floor only while
its own realistic-cadence loss is still exactly 0 — which holds up to an
addend of roughly `0.303`. Loss turns non-zero around `0.32`, already inside
the tie. **The two asks this arc has chased — "RPE 9 loses to a realistic
max-effort player" and "RPE 9's tick-space floor stays strictly below RPE
10's" — are mutually exclusive past that point, at this ceiling.** RPE 9 and
RPE 10 (and every meet cell) now read the identical 4-tick floor.

**Ruled: ship it, and accept the tie as the cost of putting RPE 9 on the wall
rather than a defect to chase further.** The phone complaint that opened this
whole arc was mashers finding no challenge at RPE 9 specifically; `MAX_EFFORT`
reading `RPE 8 = 0 < RPE 9 ≈ 30% < RPE 10/meet (not 100%)` is the ladder a
player actually feels, and it is worth the 9-vs-10 tie in raw tick space. The
old strict `WORKING_FLOOR` ordering requirement is **replaced**, not silently
dropped, by the `MAX_EFFORT` ordering above — that is what carries the "9
easier than 10" fact for the working rungs above the cut from here on.
**Raising RPE 10's demand to reopen a tick-space gap between RPE 9 and RPE 10
is refused, by name, in advance:** it either flattens the `MAX_EFFORT` ladder
this addend exists to create, or pushes RPE 10/meet toward total saturation,
both already refused elsewhere in this section.

**Still binding, unchanged and re-verified against the shipped mechanism:**
`BENCH_WARMUP_FLOOR_MARGIN` and `BENCH_WARMUP_FLOOR_ASCENT_TICKS` are
untouched — RPE ≤ 7 unanswered on a held descent still makes every cell, zero
taps, every seed; RPE 8+ unanswered still loses. The false-start guarantee
(`a-false-start-can-never-pay`) re-pins at **0 of 40** reachable cells at the
shipped 12-tick lockout, against the new cut, addend and ceiling together.
Squat and deadlift are byte-identical.

**§12.1 STAYS OPEN. Nobody has played any of this.** `BENCH_WORKING_RUNG_
DEMAND_CUT_MARGIN` and `BENCH_WORKING_RUNG_DEMAND_WALL_ADDEND` are both
unplayed placeholders, same as every other constant in this arc. The next
phone question is the same two it has been since the last replay, plus a
third the tie itself raises: does RPE 8 feel like work, does 8 < 9 < 10/meet
still read as an escalating ladder given the tie is in raw tick space rather
than felt difficulty, and does the RPE 9-vs-RPE 10 tie register as "similar"
or as a seam.

#### The 2026-08-29 retune — RPE 8 raised, RPE 9's mash-risk withdrawn

**A phone replay of the margin-band cut above answered the tie question, and
it was not "similar" or "a seam" — it was two separate complaints at two
separate rungs.** Verbatim: *"8 is still WAY too easy. 9 is next to
impossible. Not a feel-bar close."* Not a rejection of the mechanism (the
margin-band cut, the two-addend split, the ceiling as a clip are all
confirmed and not reopened) — a magnitude replay, in opposite directions on
the two constants the cut introduced.

**Diagnosis: RPE 9's 4-tick `WORKING_FLOOR` — not its 30.5% `MAX_EFFORT`
aggregate — was the actual complaint.** A 4-tick floor (one tick above
`GRIND_TAP_REFRACTORY_TICKS`, the fastest cadence the engine can even count)
asks for a tap roughly every 67ms sustained; a real thumb at or above that
rate loses outright, which reads as "impossible" regardless of what the
400-draw realistic-cadence aggregate says about the average player.

**Ruled 2026-08-29: raise `BENCH_WORKING_RUNG_DEMAND_ONSET`, lower
`BENCH_WORKING_RUNG_DEMAND_WALL_ADDEND`, and withdraw RPE 9's mash-risk as the
deliberate cost of clearing its floor — not an unresolved gap.**

**RPE 8 — `BENCH_WORKING_RUNG_DEMAND_ONSET`, `0.045` → `0.15`, named directly
rather than searched for.** The phone said "WAY too easy," not "a bit easy,"
and a swept `0.09` (which gives 1.82-2.31 taps/s) is the exact rate the OLD,
pre-arc RPE 9 sat at before this whole run of retunes began — a rate that had
already read as "no challenge" once, under a different rung. `0.15` is shipped
directly. Measured fresh against the real engine, `WORKING_FLOOR`'s RPE 8 row
(taps a second, `reachableSessionCells()` order):

| | 2026-08-27 (`0.045`) | 2026-08-29 (`0.15`) |
|---|---|---|
| `rpe8/0.8000/slower-than-expected` | 1.07 | **3.00** |
| `rpe8/0.8500/as-expected` | 1.58 | **3.33** |
| `rpe8/0.8750/crisp` | 1.36 | **3.16** |
| `rpe8/0.9000/popping` | 1.07 | **3.00** |

RPE 8's realistic-cadence (`MAX_EFFORT`) loss rate stays exactly **0 of 500**
— a harder floor, not a rep put out of reach. RPE 8 stays strictly easier than
RPE 9 in tick space with a wide margin (fastest RPE 8 floor 18 ticks against
slowest RPE 9 floor 6 ticks), so the `0.09` fallback the ruling authorised
never fired.

**RPE 9/10/meet — `BENCH_WORKING_RUNG_DEMAND_WALL_ADDEND`, `0.34` → `0.30`,
clearing RPE 9's floor and deliberately losing its realistic-cadence risk.**
`WORKING_FLOOR`'s RPE 9 cells move from a uniform 4 ticks to `6, 5, 5, 6` —
clear of the refractory band at all four cells — while RPE 10 and every meet
cell stay at exactly 4 ticks (their base margins sit closer to
`BENCH_WORKING_RUNG_DEMAND_MARGIN_CEILING`, unchanged at `0.378`, and still
clip there at the lower addend). `MAX_EFFORT`'s realistic-cadence sweep:

| rung | 2026-08-28 (FOURTH), addend `0.34` | 2026-08-29, addend `0.30` |
|---|---|---|
| RPE 8 | 0 of 500 | 0 of 500 |
| RPE 9 | 122 of 400 (30.5%) | **0 of 400** |
| RPE 10 | 279 of 400 (69.75%) | 252 of 400 (63.0%) |
| meet | 1195 of 1800 (66.4%) | 1195 of 1800 (66.4%, unchanged) |

RPE 9 returning to **0 of 400 is the ruled, deliberate outcome of this
round**, not a regression to fix in a future one: the arc measured that "RPE 9
clear of the 4-tick floor" and "RPE 9 has a non-zero realistic-cadence loss
rate" cannot both hold once `WALL_ADDEND` climbs back past roughly `0.318`
(see below), and the ruling chose the floor. `MAX_EFFORT_WALLS.
HIGHEST_REACHABLE_MARGIN` stays `0.378` — RPE 10 and meet still clip there —
but membership in that ceiling-clipped set falls from 22 of 40 reachable
cells to 21, because the one RPE 9 cell that used to clip
(`session/rpe9/0.8750/as-expected`) no longer does at the lower addend, which
is exactly why its floor cleared.

**The `0.318`-vs-`0.320` boundary, re-measured directly against the live
engine this round rather than carried from an earlier round's uncommitted
sweep:**

| `WALL_ADDEND` | RPE 9 `WORKING_FLOOR` | RPE 9 `MAX_EFFORT` (of 400) |
|---|---|---|
| `0.318` | `[5, 4, 4, 5]` — two cells already back on the floor | 0 |
| `0.320` | `[5, 4, 4, 5]` — same two cells | 2 |

The floor re-collapses onto two of RPE 9's four cells at `0.318` while the
realistic-cadence loss rate is still a heavily-sampled zero — the floor breaks
*before* the aggregate notices anything — and only at `0.320` does the
aggregate turn non-zero, by which point the same two cells are already back on
the refractory floor. Creeping `WALL_ADDEND` back up toward that window in a
future round to "get a little more RPE 9 mash-risk" silently reopens the
refractory-floor problem this round exists to close, before it buys back any
measurable risk. The shipped `0.30` sits `0.018` clear of where the floor
starts breaking, not at the edge of it.

**RPE 9 easier than RPE 10 in tick space is now expected and allowed, not a
gap to close.** The 2026-08-28 (FOURTH) tie was the addend forcing both rungs
onto the same ceiling-clipped floor, not a fact about the rungs themselves —
RPE 9's base margins sit below RPE 10's, so the same lower addend naturally
separates them again once neither is pinned to the ceiling. **Putting
mash-risk back onto RPE 9 by raising this addend after its floor has cleared
is closed by this ruling, not a goal to still chase.** A future round that
wants either the tie or RPE 9's realistic-cadence risk back needs a new phone
sentence asking for it, not a reopening of this one.

**Still binding, re-verified against both retuned constants together:**
`BENCH_WARMUP_FLOOR_MARGIN` and `BENCH_WARMUP_FLOOR_ASCENT_TICKS` are
untouched — RPE ≤ 7 unanswered on a held descent still makes every cell, zero
taps, every seed; RPE 8+ unanswered still loses. The false-start guarantee
(`a-false-start-can-never-pay`) re-pins at **0 of 40** reachable cells at the
shipped 12-tick lockout. Squat and deadlift are byte-identical.
`BENCH_WORKING_RUNG_DEMAND_CUT_MARGIN` (`0.005`) and
`BENCH_WORKING_RUNG_DEMAND_MARGIN_CEILING` (`0.378`) did not move.

**A real, measured side effect worth naming: RPE 8's rescue profile
changed shape, not just its floor.** `REACHABLE_RESCUE`'s four RPE 8 rows move
from a mixed partial-rescue picture (`[160,100,60]`, `[160,120,100]`,
`[160,100,100]`, `[160,100,100]`) to a uniform `[160,160,160]` at every cell —
an idle (never-tapped) RPE 8 rep now always misses, and resuming at a moderate
cadence after a stall always saves it, rather than sometimes.
`TOUCH_SWEEP.SOFT_VS_CRASH_FLIPS` (how often a crashed touch flips the
outcome, across a fixed load/cadence sweep) moves `100` → `120` — the lower
`WALL_ADDEND` pulls some of the sweep's heavier cells back off the
realistic max-effort wall, where the 2026-08-28 (FOURTH) cut had pushed them
into miss-or-miss regardless of the touch.

**§12.1 STAYS OPEN. Nobody has played this retune.** `BENCH_WORKING_RUNG_
DEMAND_ONSET` (`0.15`) and `BENCH_WORKING_RUNG_DEMAND_WALL_ADDEND` (`0.30`)
are both unplayed placeholders, flagged as knobs the same way every prior
constant in this arc was. The next phone question is narrower than it has
been: does RPE 8 now read as a real grind rather than a cutscene, and does
RPE 9 read as beatable rather than a wall, with RPE 8 < RPE 9 < RPE 10/meet
still an escalating ladder.

#### The 2026-08-29 (fourth ruling) retune — closing the ONSET/WALL_ADDEND dead zone

**A prior round's fine-grained search, independently re-verified against the
real engine before this round began, found a genuine `~0.0035`-wide dead
zone rather than a structural wall.** At `ONSET: 0.20`, `WALL_ADDEND >=
~0.1955` was needed for `min(RPE 8 floor) > max(RPE 9 floor)` (strict
RPE-8-vs-RPE-9 separation), while `WALL_ADDEND <= ~0.1920` was needed for
`min(RPE 10 floor) >= 7` — two boundaries pointing opposite directions with
nothing between them. RPE 9's own `>= 7` floor and the RPE-9-vs-RPE-10
ordering held cleanly across the whole searched range; only this one
boundary conflicted.

**Ruled: spend the gap on `ONSET`, held below the un-shipped `0.20`, with
`WALL_ADDEND` fixed at the RPE-10-safe `0.192` — not by raising `WALL_ADDEND`
toward the RPE-8 side, which was already shown to fail RPE 10's floor.**
`WORKING_FLOOR <= 6` is structurally impossible on the session ladder (the
eleventh ruling in this arc), which pins RPE 10's hardest cell and rules
that side out.

**`ONSET` fell `0.15` → `0.195`**, a narrow probe rather than a broad
re-search, targeted only at buying one extra tick of separation between RPE
8's hardest floor and RPE 9's easiest at the fixed `WALL_ADDEND`:

| `ONSET` | RPE 8 `WORKING_FLOOR` | min |
|---|---|---|
| `0.20` (never shipped) | 16, 12, 14, 15 | 12 — TIES RPE 9's easiest floor (12) |
| `0.199` | 16, 13, 14, 15 | 13 — clears |
| `0.1995` | 16, 12, 14, 15 | 12 — still ties |
| **`0.195` (shipped)** | **16, 13, 14, 16** | **13 — clears, chosen with real clearance under the razor-thin `~0.0005` boundary between `0.199` and `0.1995`** |

**`WALL_ADDEND` fell `0.30` → `0.192`**, the fixed value this round's Step 1
held constant while `ONSET` was the one being probed. Full session
`WORKING_FLOOR` census, ticks between taps, `reachableSessionCells()` order:

| rung | 2026-08-29 (`ONSET` 0.15 / `WALL_ADDEND` 0.30) | NOW (`ONSET` 0.195 / `WALL_ADDEND` 0.192) |
|---|---|---|
| RPE 6, 7 | unchanged — no cadence costs the rep | unchanged |
| RPE 8 | 20, 18, 19, 20 (3.00-3.33 taps/s) | **16, 13, 14, 16 (3.75-4.62 taps/s)** |
| RPE 9 | 6, 5, 5, 6 | **12, 10, 10, 11** |
| RPE 10 | 4, 4, 4, 4 (uniform, ceiling-clipped) | **7, 7, 8, 8 (no longer uniform, off the ceiling)** |

All six of this round's Step 1 stop conditions hold, driven directly against
the real engine rather than estimated:

- RPE 8's `MAX_EFFORT.REALISTIC_LOST` stays exactly **0 of 400**.
- RPE 8's `WORKING_FLOOR` (13-16 ticks) is strictly harder than the arc's
  `20/18/19/20` baseline at every cell.
- All four RPE 9 session cells read **`>= 7`** (10, 10, 11, 12).
- All four RPE 10 session cells read **`>= 7`** (7, 7, 8, 8).
- `min(RPE 8) = 13 > max(RPE 9) = 12`, **strict**.
- `min(RPE 9) = 10 > max(RPE 10) = 8`, **strict** — the 9-easier-than-10
  ordering the 2026-08-29 ruling named as expected and allowed, preserved.

**RPE 9 and RPE 10's `MAX_EFFORT` realistic-cadence loss rates both land at 0
of 400** (RPE 10 down from 252; RPE 9 stayed at 0) as the lower `WALL_ADDEND`
pulls both rungs' boosted margins clear of the max-effort wall (`0.3668` →
`0.3759`, re-driven) — the same mechanism that breaks RPE 10's
ceiling-clipped uniformity. Meet's aggregate falls from 1195 to **423 of
1800**, and `MAX_EFFORT_WALLS.HIGHEST_REACHABLE_MARGIN` stays `0.378` but its
membership shrinks from 21 of 40 reachable cells to **7 of 40, every survivor
now a meet cell** — no session cell clips the ceiling any more.

**The 18-cell meet census, re-measured at this round's `WALL_ADDEND` rather
than assumed unchanged — it lands at different numbers than the thirteenth
ruling's own census, since `WALL_ADDEND` itself is different this round:**

| | att1 | att2 | att3 |
|---|---|---|---|
| conservative, rested | 7 | 6 | 5 |
| standard, rested | 7 | 5 | 4 |
| aggressive, rested | 7 | 4 | 4 |
| conservative, wrecked | 5 | 4 | 4 |
| standard, wrecked | 5 | 4 | 4 |
| aggressive, wrecked | 5 | 4 | **4** |

This is a census, not a bar — the thirteenth 2026-08-29 ruling ("DROP THE
17-MEET-CELLS BAR") already withdrew any pass/fail requirement on the 17
non-exception cells, and this round does not reopen it. Every cell reads
`>= 4`, one tick above `GRIND_TAP_REFRACTORY_TICKS`.

**The `meet/aggressive/att3/wrecked` exception — the second 2026-08-29
ruling's pinned wrecked third — stays at 4, not the 6 a stale reading of this
arc's own history would suggest.** That cell read 6 ticks back in
2026-08-27, before the margin-band cut existed at all. The 2026-08-28
(FOURTH) cut raised the ceiling, cleared this cell's base margin (`0.3066`),
and dropped its floor to 4 — where it has independently re-verified to stay,
unmoved, through every `WALL_ADDEND` this arc has shipped since (`0.34`,
`0.30`, and this round's `0.192`).

**Still binding, re-verified against both retuned constants together:**
`BENCH_WARMUP_FLOOR_MARGIN`/`BENCH_WARMUP_FLOOR_ASCENT_TICKS` are
byte-identical. The false-start guarantee (`a-false-start-can-never-pay`)
re-pins at **0 of 40** reachable cells at the shipped 12-tick lockout. Squat
and deadlift are byte-identical (`lift.ts` itself has zero diff this round —
only the two `liftTuning.ts` constants moved).
`BENCH_WORKING_RUNG_DEMAND_CUT_MARGIN` (`0.005`) and
`BENCH_WORKING_RUNG_DEMAND_MARGIN_CEILING` (`0.378`) did not move.

**§12.1 STAYS OPEN. Nobody has played this retune.** `BENCH_WORKING_RUNG_
DEMAND_ONSET` (`0.195`) and `BENCH_WORKING_RUNG_DEMAND_WALL_ADDEND` (`0.192`)
are both unplayed placeholders, the same as every constant in this arc. This
round is not minting bench off this retune regardless of outcome — that
decision stays with the human.

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

#### The 2026-08-31 round — a third addend for RPE 9 alone, and the wall it hit

**The ruling this responds to** ("THE TWO-KNOB SEARCH HAS PROVEN A
STRUCTURAL WALL — ONE NARROW THIRD LEVER, FOR RPE 9 ONLY", CLAUDE.md). Six
rounds of phone replay against the two-addend model above found that sharing
one addend (`WALL_ADDEND`) between RPE 9 and RPE 10 was itself the blocker:
RPE 10's own `WORKING_FLOOR >= 7` floor pins `WALL_ADDEND`'s usable range so
tightly (measured this round at roughly `0.0005` wide around `0.192`) that
RPE 9 cannot be pushed into a visibly harder band inside it. The ruling
authorised exactly one new, narrowly-scoped addend, `BENCH_WORKING_RUNG_
DEMAND_MIDDLE_ADDEND`, whose entire purpose is moving RPE 9 without moving
RPE 8, RPE 10 or meet.

**The mechanism: a third band, cut by the same kind of fact as the first.**
`benchWorkingRungDemand` now selects among three addends by the bar's own
base margin (`peakDemand - capacity` on the base curve, fixed before the rep
starts — never by an RPE label, which `LiftConfig` still does not carry):

    band(baseMargin) = baseMargin <  CUT_MARGIN       ? 'onset'
                      : baseMargin <  WALL_CUT_MARGIN  ? 'middle'
                      :                                  'wall'
    addend(band)      = onset -> ONSET, middle -> MIDDLE_ADDEND, wall -> WALL_ADDEND
    working(excess)    = min(addend(band), max(0, MARGIN_CEILING - baseMargin))

**Why the new cut is structurally selective, measured rather than assumed.**
RPE 9's and RPE 10's base margins are disjoint sets, driven directly against
the live engine at the shipped tuning:

    RPE 9    { 0.0117, 0.0448, 0.0338, 0.0243 }   max = 0.0448
    RPE 10   { 0.1048, 0.0938, 0.0843, 0.0764 }   min = 0.0764

`BENCH_WORKING_RUNG_DEMAND_WALL_CUT_MARGIN` sits at `0.06`, the midpoint of
that `0.0316`-wide gap. Meet's lightest reachable cell (the opener, either
feel) reads a base margin of `0.0938` — inside RPE 10's own set, nowhere near
the gap — so meet cannot be reached by the new band regardless of where
inside the gap the cut sits. `lift.test.ts`'s "the middle band reaches RPE 9
alone" test drives this directly: every RPE 9 cell's base margin is checked
against both cuts, every RPE 8 and RPE 10/meet cell's demand is checked to
read *exactly* its own band's named constant (not merely "close to it"), and
a planted mutation moving either cut is confirmed to redden the test.

**The magnitude search hit a second, narrower wall the ruling did not
anticipate, and this round reports it rather than forcing a value past it.**
A pre-existing, unrelated invariant — "the [synthetic max-effort/false-start]
ladder never falls" (`lift.test.ts`, predating this round, not named in the
ruling's stop conditions) — requires the three addends to be non-decreasing
as load rises, or the wall-derivation methodology `MAX_EFFORT_WALLS` depends
on stops being meaningful. Since `WALL_ADDEND` cannot move at all (raising it
by even `0.0005` drops an RPE 10 cell below the eleventh ruling's `>= 7`
floor — reconfirmed this round), that invariant caps `MIDDLE_ADDEND` at
roughly `0.2013` regardless of where `WALL_CUT_MARGIN` is placed inside the
gap (tried at `0.05`, `0.06` and `0.07`; the ceiling did not move materially).
A capped `MIDDLE_ADDEND` caps RPE 9's achievable floor at roughly 9-11
ticks — almost exactly the "10-12" neighbourhood the ruling asks RPE 8 to
move INTO, so there is no pair of `(ONSET, MIDDLE_ADDEND)` that both lands
RPE 8 in that neighbourhood and keeps a real (more than one tick) gap above a
floor-capped RPE 9.

**What shipped: `ONSET: 0.199` (essentially unmoved from the pre-round
`0.195`), `MIDDLE_ADDEND: 0.20`, `WALL_ADDEND` unchanged at `0.192`.** Full
session `WORKING_FLOOR` census, ticks between taps:

| rung | before this round | after (shipped) |
|---|---|---|
| RPE 6, 7 | unchanged | unchanged |
| RPE 8 | 16, 13, 14, 16 | **16, 13, 14, 15** |
| RPE 9 | 12, 10, 10, 11 | **11, 9, 10, 11** |
| RPE 10 | 7, 7, 8, 8 | **7, 7, 8, 8 (byte-identical, as intended)** |

`min(RPE 8) = 13 > max(RPE 9) = 11`, a clean, strict 2-tick gap, and RPE 9 is
measurably harder than before it. **This does not meet the ruling's full
ask** — RPE 8 has not moved toward "10-12", because doing so (measured:
`ONSET: 0.207` gives RPE 8 `12, 12, 13, 14` against RPE 9's `9, 9, 10, 11`,
a minimum gap of one tick) reopens exactly the "one-tick technicality" item 9
of the ruling refuses. The false-start guarantee re-pins at 0 of 40
reachable cells at the shipped 12-tick lockout; `REACHABLE_RESCUE` moves at
exactly one cell (`session/rpe9/0.8750/as-expected`, `[160,160,160] ->
[100,100,160]`); squat and deadlift stay byte-identical; the 18-cell meet
census is unchanged, including the `meet/aggressive/att3/wrecked` exception,
because the new band structurally cannot reach any meet cell.

**Superseded on 2026-09-01 — see the next subsection.** The
ladder-monotonicity invariant this round treated as a hard constraint was
measured and found to be a proxy, and replacing it with a direct behavioural
one moved RPE 8 three ticks. The account above is kept as the record of what
was true and believed at the time, not as a live description of the tree.

**§12.1 stays open, and this round is explicitly NOT minting bench for a
phone replay — the human decides whether to authorise touching
`WALL_ADDEND` despite the RPE 10 floor cost, relaxing the ladder-monotonicity
invariant's tolerance, or a different mechanism than a third additive band.**
`BENCH_WORKING_RUNG_DEMAND_CUT_MARGIN` (`0.005`) and `BENCH_WORKING_RUNG_
DEMAND_MARGIN_CEILING` (`0.378`) did not move. Every constant here is an
unplayed placeholder, the same as every other value in this arc.

#### The 2026-09-01 round — the ladder invariant was a proxy, and replacing it moved RPE 8

**The ruling this responds to** ("PROTECT MONOTONIC DIFFICULTY, NOT A PROXY
SCALAR", CLAUDE.md). The round above reported being stopped by a pre-existing
assertion that the *effective demand margin* — an intermediate scalar — never
decreases as load rises along a synthetic ladder. The ruling accepted the
three-band mechanism, refused to delete or epsilon that assertion, and asked a
sharper question instead: is it protecting a real gameplay property, or is it
an analytical proxy that went over-strong once the demand curve was
deliberately made piecewise?

**The permanent invariant is behavioural and is not negotiable: holding lifter
state and player-input model fixed, adding weight must never make the bench rep
easier.** Whether the scalar itself must be monotone was the open question, and
it was settled by measurement rather than argument.

**Why the scalar necessarily falls, which is arithmetic and not a defect.**
Each band contributes a flat addend, so a bar crossing up into a band with a
*smaller* addend loses that difference at the same instant its own base margin
rises by one load step. On this ladder a step is worth about `0.0093` of base
margin, so the scalar starts falling once `MIDDLE_ADDEND` exceeds
`WALL_ADDEND` (`0.192`) by more than that — at roughly `0.2013`, which is
exactly the cap the previous round hit.

**The measurement, over the same domain (`0.80 → 1.05` in `0.005` steps, 51
rungs, the same fixed wrecked check-in), driving real reps at every rung
rather than reading the scalar.** Four arms: the sustainable cadence floor, the
realistic max-effort loss rate over the phone-derived 57–81 ms cadence, the
perfect-cadence arm, and the false-start arm. Where the two part company:

| `MIDDLE_ADDEND` | effective margin at the band boundary | real behaviour |
|---|---|---|
| `0.2013` | stops rising — the old assertion's edge | nothing eases |
| `0.205` | falls `0.0037` | nothing eases |
| **`0.214` (shipped)** | falls `0.0127` | nothing eases; floor `8 → 8` |
| `0.2202` | falls `0.0189` | nothing eases |
| `0.2205` | falls `0.0192` | **floor `7 → 8` — a heavier bar plays easier** |

So the scalar put the wall roughly `0.019` of addend below where the game
actually puts it. **This is Outcome A in the ruling's own terms**: the scalar
assertion was over-constraining, so it was **replaced** by the direct
behavioural invariant — not loosened, not given a tolerance. The new check
asserts, at *every* probed cadence rather than only at the floor, that a
heavier rung never makes a rep the rung below it missed. It is
`@guarantee`-tagged (`a-heavier-bench-is-never-easier`) and mutation-checked at
both band boundaries.

**An honesty note that belongs in the design record.** Three of the four arms
the ruling asked for are *silent* at the band boundaries — the realistic,
perfect and false-start arms all read a flat zero there, because their first
losses land far heavier up the ladder. Only the cadence arm can see the
question at all. They are still measured and pinned, but they are not what
carries the invariant, and three green arms flanking one real one must not be
read as corroboration.

**What the wall derivation lost, and what replaced it.** The deleted assertion
was also standing in for the claim that `MAX_EFFORT_WALLS`' two walls are the
*least* margin at which each arm loses — true of the first losing rung in load
order only when the margin is monotone. That is now taken directly as the
minimum over losing rungs, which is the definition itself and needs no
monotonicity premise.

**What shipped: `ONSET: 0.199 → 0.22`, `MIDDLE_ADDEND: 0.20 → 0.214`,
`WALL_ADDEND` unchanged at `0.192`.** Full session `WORKING_FLOOR` census,
ticks between taps (lower is harder), with taps/second beside it:

| rung | before this round | after (shipped) | taps/s before → after |
|---|---|---|---|
| RPE 6, 7 | unchanged | unchanged | never costs a rep at any cadence |
| RPE 8 | 16, 13, 14, 15 | **13, 11, 12, 13** | 3.75–4.62 → 4.62–5.45 |
| RPE 9 | 11, 9, 10, 11 | **10, 9, 9, 10** | 5.45–6.00 → 6.00–6.67 |
| RPE 10 | 7, 7, 8, 8 | **7, 7, 8, 8 (unchanged)** | 7.50–8.57 |

Every RPE 8 cell moves by two or three ticks, against the previous round's one
cell by one tick. **The cost, stated plainly: the RPE 8 → RPE 9 separation
falls from two ticks to one** (`min(RPE 8) = 11` against `max(RPE 9) = 10`);
RPE 9 → RPE 10 stays at one (`9` against `8`). Both are strict. The trade was
taken in this direction on the ruling's own item 1 — the cleaner two-tick gap
"does not substitute for moving RPE 8 into the intended feel region."

**The binding constraint is no longer the ladder — it is the rungs' own
internal spread.** With the proxy gone, `ONSET` stops where `min(RPE 8)` would
tie `max(RPE 9)` (between `0.223` and `0.2235`) and `MIDDLE_ADDEND` stops where
`min(RPE 9)` would tie `max(RPE 10)` (between `0.218` and `0.2185`). RPE 9's
four cells never all sit at one tick value: the cell that would have to move
last is still at 10 when the first has already fallen to 8. That is why RPE 8
lands one tick short of the ruling's `~12/10/10/11` target rather than on it,
and it is a property of the rung rather than of either constant.

**Everything else re-measured rather than assumed carried.** The false-start
guarantee re-pins at 0 of 40 reachable cells at the unchanged 12-tick lockout.
Both `MAX_EFFORT_WALLS` walls (`0.3759`, `0.3990`) and
`HIGHEST_REACHABLE_MARGIN` (`0.378`) are unchanged. `MAX_EFFORT.REALISTIC_LOST`
is unchanged, RPE 8 still exactly 0. The 18-cell meet census is unchanged,
including the `meet/aggressive/att3/wrecked` exception, because neither moved
band structurally reaches a meet cell. `REACHABLE_RESCUE` moves at exactly two
RPE 9 cells. Squat and deadlift stay byte-identical.

**§12.1 stays open and this round does not mint for a phone replay.**
`BENCH_WORKING_RUNG_DEMAND_CUT_MARGIN` (`0.005`),
`BENCH_WORKING_RUNG_DEMAND_WALL_CUT_MARGIN` (`0.06`) and
`BENCH_WORKING_RUNG_DEMAND_MARGIN_CEILING` (`0.378`) did not move. Both retuned
values are unplayed placeholders, the same as every other value in this arc.

#### The 2026-09-01 round — C3 surplus compression, minted as accepted bench feel

**The three-band addends placed the thresholds. They could not write the
sentence the human asked for on a committed thumb.** A 2026-09-01 investigation
measured why: at ordinary 70 ms the grind is already on the flat top of
`grindForce` before the bar leaves the chest, mash surplus at the stick is
larger than the floor-to-mash force gap, and raising demand eats the floor
before mash becomes a fight. ONSET / MIDDLE / WALL stay frozen at `0.22` /
`0.214` / `0.192`. No fourth addend.

**A strong surplus-compression prototype was built in isolation and rejected
for magnitude, not for the family.** `c8=0.35 / c9=0.20 / c10=1` overshot:
phone RPE 9 ~2.64 s against unchanged RPE 10 ~2.30 s. On screen, 9 was the
fight and 10 was the relief. History, not a candidate.

**A monotonic search then found CASE A — a region that orders 8 < 9 < 10
without touching RPE 10.** Floor force is derivable, not a free knob. Two
kinds: stick break-even, and `floorCadence` (mean `grindForce` at that cell's
working-floor metronome). One-global-compress hits exist in both. Three phone
candidates, not shipped until played:

| candidate | 70 ms ascent ticks (RPE 8 / 9 / 10) |
|---|---|
| C1 `breakEven / c8=0.65 / c9=0.70` | 86.3 / 93.9 / 101.9 |
| C2 `floorCadence / c=0.50` global | 88.4 / 94.8 / 101.9 |
| C3 `floorCadence / c=0.55` global | 85.7 / 92.6 / 101.9 |

**The human played LIVE, C1, C2, and C3 on a real ordinary bench session and
chose C3.** Live at ~71 ms: RPE 8 good-lift ~1.66 s, RPE 9 grinder ~1.87 s,
RPE 10 grinder ~2.30 s — 8 still flew. C3: RPE 8 grinder ×2 ~1.85 s, RPE 9
grinder ~2.13 s, RPE 10 grinder ~2.33 s. RPE 8 no longer flies. 9 is clearly
harder than 8. 10 remains the hardest rung. Zero misses. Zero inversions.

**What shipped, then minted 2026-09-01.** On bench ASCENT only:

    useful = force                                    if force <= floor
           = floor + (force - floor) * 0.55           otherwise

`floor` is the charge-cycle mean of `grindForce` at a frozen pre-C3
working-floor metronome (`meanGrindForceAtGap`): gap 11 below a base-margin
cut of `0.025`, gap 8 above it and still inside the middle addend band. Wall,
warm-up, squat and deadlift are identity (`compress` is not consulted). The
search's measured floors `0.626` / `0.741` are not copied as literals.

**The extra floor-gap cut is required because ordinary RPE 8 at starting e1RM
sits in the middle addend band** (`baseMargin` 0.0052, 0.0002 above
`CUT_MARGIN` 0.005). Keying the metronome off the addend band alone gave that
cell gap 8 and 70 ms stayed a good-lift. Sharing gap 11 across the whole
middle band inverted RPE 9 past unchanged RPE 10. The cut sits in the
measured ordinary RPE 8 / RPE 9 gap and chooses only which frozen metronome
the compressor reads. It is not a fourth addend and not an RPE field on
`LiftConfig`.

**Truthful pips ship in the same piece.** `grindProgress` previously lit raw
`grindForce`, so a mashed RPE 8 rail read nearly full while the bar received
~0.83 useful. The pip COUNT now reads the same useful force the ascent
multiplies. The kick still flashes on a counted tap. No second meter, no
player-facing "compression" number.

**Production 70 ms census, ordinary 120 kg, jitter ±8 ms, 16 seeds:**

| rung | 40 ms | 70 ms | 100 ms |
|---|---|---|---|
| RPE 8 | grind 80.0 t, useful 0.833, pips 12.0 | grind 85.4 t, useful 0.806, pips 11.3 | grind 105.0 t |
| RPE 9 | grind 86.0 t, useful 0.885, pips 12.0 | grind 92.1 t, useful 0.858, pips 12.0 | grind 116.0 t |
| RPE 10 | grind 90.0 t, useful = raw, pips 14.0 | grind 101.9 t, useful = raw, pips 13.4 | grind 167.0 t, stall 3.0 |

Make 100% and grind 100% on every working rung at 40 / 70 / 100 ms. 8 < 9 <
10 at committed ~70 ms. Fast-48-then-stop now misses RPE 8 and RPE 9
(intentional: continued effort is required). 40 ms is not a better outcome
class than 70 ms. RPE 10 is identity.

**Session `WORKING_FLOOR`, re-driven, ticks between taps:**

| rung | before C3 | after C3 |
|---|---|---|
| RPE 6, 7 | 240 | 240 |
| RPE 8 | 13, 11, 12, 13 | **13, 10, 11, 12** |
| RPE 9 | 10, 9, 9, 10 | **9, 9, 9, 9** |
| RPE 10 | 7, 7, 8, 8 | **7, 7, 8, 8 (unchanged)** |

`min(RPE 8) = 10 > max(RPE 9) = 9 > max(RPE 10) = 8`. RPE 10's `>= 7` stop
condition holds. Meet census unchanged (`7,6,5,7,5,4,7,4,4,5,4,4,5,4,4,5,4,4`).
RPE 8 `MAX_EFFORT` still 0. False-start still 0 of 40. Squat and deadlift
byte-identical. `REACHABLE_RESCUE` RPE 9 rows move (a moderate resumption
rescues less of a compressed middle band): coming-back-helps 18 → 17, a-rep
is-saved 9 → 8. RPE 8 still saturates; RPE 10 and meet stay identity.

**§12.1 CLOSED FOR THIS BENCH GRIND, 2026-09-01.** Final ordinary-bench
phone replay of production C3. Human verbatim: "Yes this feels good lets
move on." C3 is the accepted bench feel. Constants frozen. Do not copy
0.35 / 0.20. Do not ship C1 or C2. Do not start a stall mechanic or a
quality window. The additive bands have done their job. This mint does
not retune squat or deadlift, does not start A1–A7, does not implement
Career, does not touch Session B, and does not merge `main`.

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

**RECONCILED: THE SPLIT IS ON THE DISPLAY, NOT ON THE ARITHMETIC.** Neither
computation was wrong, so neither moved. `liftPrs` is *retrospective* — is this
the best on record now — and answers yes for a first-ever lift. `isPrAttempt` is
*prospective* — will this weight beat your record — and answers no when there is
no record. Both facts are true of the same lift at the same moment, and printing
one word for both is what made the app contradict itself.

The per-lift call-out therefore gains a second state, which is the shape the
**total** has had all along: `MEET_COPY.RECAP_FIRST_TOTAL` has never called a
first-ever total a PR, it calls it a FIRST. Per lift there is now
`MEET_COPY.RECAP_PR_LIFT` for a record beaten and `MEET_COPY.RECAP_FIRST_LIFT`
for a record set from nothing.

- **`meetDay.ts`'s `beatsPreviousBest` is the one predicate the word is printed
  from.** §6.3's gold border, its PR sentence, the walk-out's extra hold and the
  recap's call-out all read it, so the meaning of "PR" cannot move on one screen
  without moving on the others. It replaces three inline copies of the same
  expression, none of which the recap consulted.
- **`AppliedMeetResult` now hands out `previousBestByLiftKg`**, the per-lift twin
  of `previousBestTotalKg`. The total could already tell a FIRST from a PR
  because it had the number it was measured against; the lifts could not, and
  that absence *is* the defect rather than a consequence of it.
- **Nothing about attempt selection changed.** `isPrAttempt` was never wrong.

**WHICH WORD IS PENDING PLAYTEST, exactly as §6.3's two wording options above
are.** What is settled is structural: a lift with no record behind it does not
get called a PR. `RECAP_FIRST_LIFT` ships as `'FIRST'`, chosen to sit under
`RECAP_FIRST_TOTAL` without repeating the lift's own name, which is already on
the row — a placeholder, not a ruling. The two states also share one visual
treatment, which is what the total already does for FIRST TOTAL and COMPETITION
PR; splitting them by colour as well as by word is the same felt question and is
deferred with it. Overturning either is a normal outcome, not a regression.

**THE SHAREABLE CARD CARRIES NO PR FACT AT ALL, AND THAT IS THE RIGHT ANSWER
RATHER THAN AN OVERSIGHT.** The third surface this ruling named turned out not
to be a surface: `resultCard.ts`'s `LiftRow` has no PR field and `src/card/`
prints no such word, because a federation result sheet records weights and does
not editorialise — which is exactly what the paragraph below asks the card to
look like. So there was no third meaning to reconcile there. It is now pinned
rather than left as a happy accident: a card is built for a lifter with no
history, its cells are counted and scanned, and none may carry either call-out
while the recap beside it carries three. **A future PR mark on the card is a
deliberate edit that comes back to this ruling** and uses these two states, not
a third word.

**WHAT A PLAYER CAN ACTUALLY REACH, WHICH SHARPENS WHY THIS MATTERED.** §6.1's
Career calendar does not exist, so the second meet of an app run is refused as
already recorded and draws the placeholder rather than a recap. **The only recap
a player reaches today is the first meet's** — which is precisely the meet that
was printing PR against all three lifts. The browser check therefore reads the
FIRST state on the played arm and the PR state on the scripted lifter behind
`?meet=recap`, and labels which arm each came from.

**Shareable result card** formatted like a real federation result sheet. Real
lifters already post meet results on social media as a habit — if the card looks
legitimate, this is the strongest organic growth lever in the game. Treat it as a
feature, not a nice-to-have.

### 6.6 Async vs. Sync

**RULED BY A HUMAN, 2026-08-14: THE SPLIT MOVED. REGIONAL IS NOW SYNCHRONOUS.**
The previous split put local *and regional* on the async side; regional has
moved across, and the boundary is now drawn between the entry tier and every
tier above it. The superseded text is kept at the end of this section, because a
ruling is only legible against what it replaced.

**Local meets — asynchronous, and NPC fields only:**

- **No other real players in the field.** Not ghost data from real lifters, not
  past player results — NPCs. Local is where a player learns the meet, and it is
  deliberately the one tier where nobody else's performance is in the room.
- Runs on the player's schedule, offline-friendly, low infra cost
- Weekly/biweekly cadence keeps Career progression steady

**Regional / Nationals / Worlds — synchronous, with other real players:**

- **Pooled by geographic region**, mirroring how real federations structure
  qualification: you compete against the people you would actually have to get
  past to move up.
- Scheduled live windows (e.g., a 48-hour "meet weekend")
- Real **flight structure**: lifters grouped into flights of ~10–15, attempts
  resolve in turn order, live leaderboard feed
- Architecturally this is **turn-based with a live feed**, not real-time
  simultaneous netcode. Players submit attempt + weight within a turn window;
  server resolves order and broadcasts. Supabase realtime channels are
  sufficient. Do not build custom netcode.
- Entry gated by qualifying total earned at the tier below
- Quarterly Nationals, annual Worlds — scarcity keeps them special

**What this ruling costs, stated rather than discovered later.** Regional was
the async tier that carried "the majority of play" in the old split. Moving it
to sync means the first tier above the tutorial tier now needs live
infrastructure, a population, and a region to pool it by — none of which the
build currently has. The two open questions below are the load-bearing ones and
are **deliberately unresolved**; they are recorded as questions because guessing
either would be a design decision made by an implementer.

#### ANSWERED 2026-08-15 — REGION IS DERIVED FROM THE FEDERATION

**Region is a structural property of the federation, not of the device or the
player.** `CareerLifter` already carries `federationId` — verified, it is one of
three `CAREER_LIFTER_KEYS` — so a lifter's region follows from the fed they
compete under, fixed at career creation.

**This dissolves the question rather than answering it.** The concern below was
that region is a *new data dimension* with no field to carry it. It is not: no
new identity dimension, no location field, no geolocation dependency, and
nothing extra to ask a player for. `src/career/federation.ts` gains a region
property; `CareerLifter` gains nothing.

**Rejected, with reasons, because both are the obvious first guesses:**

- **Device location.** Introduces a real-world dependency into a game that
  currently has none, and breaks in ordinary cases rather than exotic ones — a
  VPN, travel, or playing offline all move or remove it. A competitive bracket
  that changes because someone got on a plane is not a bracket.
- **Player-picked at signup.** Invites **region-shopping**: pick the weakest
  pool and qualify against it. That is precisely the competitive-integrity hole
  synchronous meets are most exposed to, and it would be introduced
  deliberately, at the one point where the game asks a player to choose.

Federation-derived is **non-gameable in the way that matters**: changing region
means changing federation, which is a career-level decision with its own costs
and its own ruleset, not a dropdown.

**What it settles for the qualifying-total research.** The third key is
federation-derived rather than free, so a regional standard varies with the fed
rather than with wherever a player happens to be. The open point that remains is
narrower than it was: whether a percentile-derived standard is still meaningful
once cut by federation as well as sex and weight class.

#### ANSWERED 2026-08-15 — SPARSE REGIONS POOL UPWARD

**Below a minimum viable field size, the meet merges into the next-larger
scope.** Sparse regional pools into multi-region; sparse multi-region pools into
the national field. **The meet resolves at whichever scope first clears the
minimum.**

**MINIMUM FIELD SIZE IS A TUNABLE CONSTANT AND A PLAYTEST VALUE.** It is not
derivable from anything this document knows — it is a feel question about how
small a field can be before placing in it stops meaning anything. It goes in a
registered tuning home with the rest, and per this project's standing rule the
tunable version gets built and the number gets called provisional rather than
asserted.

**Rejected, with reasons:**

- **Cancel the meet.** Punishes a player for a *population* problem they cannot
  influence, and locks them out of a progression tier for reasons entirely
  outside their control. A player who qualified and then cannot compete has
  been failed by the game, not by their training.
- **Pad the field with bots.** Makes placement meaningless in the one mode where
  **placement is the whole point.** Local is already the NPC tier by design;
  importing NPCs into the competitive tiers erases the distinction the first
  ruling drew, and does it invisibly.

**REQUIREMENT: POOLING MUST BE VISIBLE TO THE PLAYER, NEVER SILENT.** Something
in the shape of *"Your regional field merged into the Northeast bracket — 14
lifters."* A silently larger field reads as a bug when the entrant count does
not match what a player expected, and a player who cannot see why they are
facing different people has no way to tell a merge from a fault. The copy is
tunable; the visibility is not optional.

That requirement is the same principle this document already applies to streak
coverage — every consumption is **reported, never silent** — arriving in a
different subsystem.

#### OPEN — geographic region is a NEW DATA DIMENSION and nothing carries it

`CareerLifter` has no location field. Where a region comes from is undecided:
device locale, explicit player selection at signup, an inferred value, or
something else. Each has different consequences for privacy, for players who
travel, and for a player who wants to compete somewhere they do not live.

**It also collides with work already done.** The qualifying-total research in
`docs/research/qualifying-totals.md` derives its table keyed by **sex and weight
class**, on a human ruling. Region is a third key, and the interaction is not
obvious: whether a regional qualifying total is the same number everywhere,
whether it varies by the pooled population's strength, and whether a
percentile-derived standard even survives being cut three ways are all open. The
research already flags every regional cell as derived from an **open-entry
population**, which is exactly the tier this ruling has now made competitive —
so that caveat became more load-bearing, not less.

Do not infer any of this from the ruling. It says regional is sync and pooled by
region; it does not say where region comes from.

#### OPEN — sparse-population regions, which must be answered BEFORE the sync work

Worlds pools globally and Nationals pools a country, so both have a plausible
population. **A regional sync meet may not have enough concurrent players to
fill a flight** — near-certainly true at launch, and permanently true for
regions that stay thin.

The candidate answers are genuinely different games: fall back to NPCs to pad a
flight (which reintroduces the thing local is defined by *not* having), merge
sparse regions (which weakens the "people you'd actually have to beat" premise
the pooling exists for), wait for a quorum before the window opens (which can
strand a player who qualified), or something else.

**This is named as a pre-condition rather than an implementation detail on
purpose.** Every one of those answers changes what the flight, the leaderboard
and the qualifying gate mean, so discovering it during the build means building
it twice.

#### RULED 2026-08-14, SECOND RULING: THE SUMMIT IS TWO TIERS, NOT ONE

**Campaign has its own worlds-tier summit, distinct from the synchronous PvP
worlds.** The reason is recorded because it constrains every later decision
here: **a sync-only top tier leaves a solo player's career with no reachable
ceiling.** The ladder would stop until enough real players are concurrently
online in that player's region — which at launch may be never, and for a thin
region may be never at all. A campaign needs a summit to strive toward that
does not depend on who else is awake.

The full structure after both rulings:

| tier | mode | field | reachable |
|---|---|---|---|
| **Local** | async | NPC only | always |
| **Regional** | sync | real players, region-pooled | when the region has a population |
| **Nationals** | sync | real players, region-pooled | when the region has a population |
| **Campaign worlds** | async | NPC field | **always — this is the point of it** |
| **Competitive worlds** | sync PvP | real players | the separate, harder ceiling |

"Always reachable" is a design REQUIREMENT of the campaign summit, not a
description of what the build currently does. It was measurably false when this
ruling landed; **the campaign side of it is now built and measured** — see the
interaction note at the end of this section, which carries the re-taken numbers
and the requirement they were taken against.

#### OPEN — do the two worlds tiers share a qualifying total?

Shared makes the campaign summit a **rehearsal** for the competitive one: same
bar, different room, and clearing it in campaign tells you precisely what you
would need against people. Separate makes them **genuinely different
achievements**, and lets the competitive ceiling sit higher than any solo player
would be asked to reach.

Answered below — separate, campaign lower — and **built**. `MEET_TIER_ORDER` is
now a five-member list with `campaign-worlds` and `competitive-worlds` as
distinct tiers rather than one `worlds` carrying a discriminator;
`careerTuning.ts`'s tier block holds the argument for that encoding and for what
the order between two summits does and does not claim.

It also decides which worlds the sourcing research describes. The derived table
in `docs/research/qualifying-totals.md` sets its worlds row by **P75 of the
nationals field**, chosen because P10 of the actual worlds field lands on quota
entrants and inverted the ladder in four cells. That is a competitive-population
number by construction. Whether it is also the right number for an NPC-fielded
campaign summit is exactly this question, and nobody has answered it.

#### OPEN — does a campaign lifter carry into competitive play as the same character?

**This one decides what the game fundamentally is**, which is why it is recorded
rather than inferred. One continuous career that eventually meets real
opponents, versus two modes that share a stat screen, are different products
with different retention shapes, different fairness problems, and different
answers to "what am I building toward".

It also reaches further into the codebase than it looks. `CareerLifter` carries
`bestTotalKg` and `enteredMeetIds` as a single identity; a two-track answer
means either two of those or a discriminator on one. And GDD §8's no-pay-to-win
line becomes sharper the moment a campaign-built lifter enters a PvP field —
anything purchasable that touched that lifter's Total is now affecting a real
opponent's result, which is the same rule under much more load.

#### ANSWERED 2026-08-14 — Q1: SEPARATE THRESHOLDS, CAMPAIGN LOWER

Shared thresholds were rejected on the ground that they make the campaign summit
a rehearsal and leave one ceiling meaning nothing.

**The 650 kg figure belongs to COMPETITIVE worlds.** It is P75 of the real
nationals field — a competitive-population number by construction, exactly as
`docs/research/qualifying-totals.md` says of it. That assignment is now settled
rather than assumed, and the research's worlds row should be read as describing
the competitive tier and no other.

**Campaign worlds needs its own number, derived to a different requirement.**
Not a percentile of any real population: **a pacing decision, measured against
what the simulation actually produces across a full career arc** — reachable by
a solo player who plays the campaign well, on the campaign's own timeline. The
sweep already holds that data.

**This is also the proper fix for the unreachable-worlds finding**, rather than
a workaround for it. The campaign summit gets a threshold *and a calendar
position* that make it genuinely reachable; competitive worlds keeps the harder
real-derived number. The measurement below stops being a violation because the
design moved to meet it, not because the measurement was re-scoped.

#### ANSWERED 2026-08-14 — Q2: ONE CONTINUOUS CAREER. THE CAMPAIGN LIFTER *IS* THE PvP LIFTER

Two tracks were acknowledged as safer and cleaner and **rejected anyway**: the
career arc this design is built around collapses if the character a player
invested in stops at the campaign's edge. One lifter, one career, eventually
facing real people.

**THE CONSEQUENCE, RECORDED AT THE RULING RATHER THAN DISCOVERED LATER: shared
identity makes GDD §8's no-pay-to-win line the most consequential rule in the
codebase.** The failure mode changes category. It was *"a player cheated
themselves"* — bad, contained, and in principle refundable. It becomes **"a
player's purchase changed a real opponent's result"**, which is unrecoverable
after ship: the opponent's meet is over, their placing is wrong, and no patch
returns it.

**The rule does not change. The BAR does.** Anything touching Total's provenance
now needs the treatment `src/empire/` received — not *"no purchasable path was
found"*, but **a structural argument that one cannot exist**, with adversarial
rounds behind it. That is recorded as a standing requirement in `CLAUDE.md`'s
Hard Design Constraints, not as a note here, because it binds every future piece
rather than this section.

#### WHAT THESE ANSWERS UNBLOCK, AND WHAT THEY DO NOT

**Unblocked** — campaign-side work, which no longer waits on anything:

- Deriving the campaign worlds qualifying total from sweep data, as a pacing
  measurement rather than a population percentile.
- Giving the campaign summit a calendar position that makes it reachable.
- The tier model itself: `MEET_TIER_ORDER` is currently four members pinned by
  `toEqual`, and `QUALIFYING_TOTAL_KG` holds one `worlds`. Both now need to
  distinguish the two summits.
- `CareerLifter` stays **one identity** — Q2 removes the discriminator question
  entirely, which simplifies rather than complicates the spine.

**Still blocked**, on the first ruling's open questions, which are untouched by
these answers: everything on the synchronous side. Regional and nationals are
sync and region-pooled, and both *where a region comes from* and *what happens
to a sparse region* remain open. Do not build sync PvP against a guess at
either.

#### HOW THESE RULINGS INTERACT WITH WORK ALREADY MEASURED

**The campaign summit's "always reachable" requirement WAS FALSE in the shipped
calendar, and it is now built and measured.** The finding as first taken: over
one 364-day season from the anchor, worlds meets are **scheduled 24 times**
across the sweep's 24 seeded careers and **entered 0 times**, while those
lifters go far past the 650 kg gate. Neither half of the obvious explanation
holds — the meets exist and the lifters are strong enough. Worlds falls on day 6
of the season, when a lifter is still around 380 kg, and by the time they clear
the gate that year's summit is long past.

Before the second ruling that was read as a **vacuity finding** — a sweep
measuring a property across the tier ladder with an empty domain at the top.
After it, it was also a **design violation**.

**THAT VACUITY READING WAS WRONG, AND THE ERROR IS RECORDED RATHER THAN
QUIETLY DROPPED BECAUSE IT REACHED THIS DOCUMENT.** The sweep does not run one
year. `ATTENDANCE_SWEEP.SIMULATION_DAYS` is **728** — two calendar periods,
widened by `eca47a3` — and over its real window worlds is **scheduled 48 times
and enterable 23**. The domain was never empty. Re-measured independently on the
tracked tree, both windows:

| window | worlds sched / enterable | nationals | peak total |
|---|---|---|---|
| 364 days | 24 / **0** | 96 / 60 | 1687.5 kg |
| **728 days (the real one)** | 48 / **23** | 192 / 156 | **3020 kg** |

**THE 728-DAY PEAK IN THAT ROW WAS WRONG AND IS CORRECTED ABOVE — it read
2905 kg.** Re-measured at `c6e2e31`, on a tree where `src/career/` and
`src/game/prng.ts` are byte-identical to `6d3442d`, the peak over the sweep's
own 24 seeded careers is **3020 kg**, at the deepest career's last meet on
day-offset 728 exactly. 2905 is the peak of that same generator truncated at
**165** draws rather than the 171 `MEETS_PER_CAREER` actually draws, and 2957.5
is what a `< 728` window gives instead of `<= 728`. Nothing about the code
changed between the two readings; the window did. The other three cells of that
row reproduce exactly.

**AND THE GENERATOR THAT PRODUCED THAT ROW HAS SINCE BEEN BOUNDED**, so the row
is history rather than a description of the tree. A human ruled the unbounded
walk out — 3020 kg is roughly two and a half times the heaviest total any human
has recorded, so any percentile taken deep into that distribution was about
nothing. `ATTENDANCE_SWEEP` now draws a **ceiling per career** and decays gains
toward it, and the same four measurements read:

| window | worlds sched / enterable | nationals | peak total |
|---|---|---|---|
| 364 days | 24 / **0** | 96 / **72** | **860 kg** |
| **728 days (the real one)** | 48 / **22** | 192 / **168** | **882.5 kg** |

Median meet total fell from 1107.5 kg to 720 kg over the 728-day window. Both
the ceiling band and the decay shape are **provisional game-feel values**;
`careerSweep.ts`'s `POTENTIAL_MIN_KG` and `POTENTIAL_MAX_KG` carry the argument
for where the band sits, the citation it is grounded in, and what it costs.

**Worlds enterable fell from 23 to 22, and that is the fix working rather than a
regression.** Two of the 24 seeds now draw a ceiling under the 650 kg bar and
never qualify for the top tier at all. The old fixture had every career climb
clear of every gate, which left the top of the ladder refusing nobody.

**What survives is the part the rulings act on:** worlds is unreachable in a
lifter's **first year**, because it falls on day 6 when nobody can hold the
gate. That is real, it is what the campaign summit fixes, and it is a statement
about the first season rather than about the sweep.

**Why the wrong numbers were produced, since the cause matters more than the
correction.** The probe was run on a checkout that had silently rewound to a
commit predating `eca47a3`, where `SIMULATION_DAYS` was 364 and the totals
generator was different. Every reading was internally consistent and correct
about that tree — which is why nothing looked wrong. The reported peak of
**870 kg** and nationals figure of **14 of 96** came from there and are false of
this tree; they are stated here so anyone who saw them can discard them by name.
`CLAUDE.md`'s "A TREE THAT REWOUND UNDER YOU" section is the general form.

#### BUILT AND MEASURED — the campaign summit's threshold, calendar and reach

The tier ladder is five members. Campaign worlds asks **600 kg** — the midpoint
of nationals' 550 and competitive worlds' 650, chosen by a stated rule rather
than by a percentile, and **provisional**: it is a game-feel value nobody has
playtested. **It did not move when the totals generator was bounded, and it has
not moved at the slower gain rate either**, which was checked rather than
assumed both times: a gate set by a rule about its neighbours does not depend on
the distribution underneath it, and 600 keeps R1 at 192 of 192 arcs. What HAS
changed is that the band measurement is no longer flat — see the re-take below.
Competitive worlds keeps 650, which the Q1 ruling assigns to it.
Campaign worlds runs **semi-annually** at a phase late in the season;
competitive worlds keeps its annual series.

**The reachability requirement, in the numbers it was derived to.** A "campaign
arc" is the greedy career the sweep already simulates — every meet the lifter is
eligible for, taken — run from its own signup day for two calendar periods. The
sweep is 24 seeds x 8 signup days = **192 arcs**, and the requirement is:

- **R1, an absolute:** every arc enters a campaign summit. Measured **192 of
  192**.
- **R2b, the clause that bites:** every signup day, taken on its own, gets most
  of its 24 arcs to a summit inside their first year. Worst signup day **15 of
  24**, against a bar of 12.
- **R2, pacing, in two halves with two horizons and two jobs.** **R2m, the
  middle:** the **median** arc reaches a summit inside the calendar year — 364
  days — measured **290**, with 74 days of margin. **R2t, the tail:** **nine
  arcs in ten** reach one inside **546 days**, measured **191 of 192** against a
  bar of 173. Both hold. **Neither pins an arc count**, which is the whole
  change; see the re-derivation below.

**THOSE THREE HAVE NOW BEEN RE-TAKEN TWICE, AND THE SECOND RE-TAKE BROKE ONE OF
THEM.** They were 19 of 24, 176 of 192 and 198 days under the unbounded totals
generator; 24 of 24, 192 of 192 and 154 days once it was bounded; and 15 of 24,
158 of 192 and 290 days since a human ruled `MAX_GAIN_KG` down from 70 kg a meet
to 20 on 2026-08-15. The calendar did not change on either occasion. **158 of 192
is still what the first year measures — it is simply no longer what R2 asks
for**, and it is pinned as a census beside the two clauses that are.

**That ruling is provisional and pending playtest**, in the same manner as
§6.3's PR-attempt wording and §6.2's crowd-reaction beat. At 20 the median
simulated campaign reaches the 600 kg gate in 41 meets and 187 days, with the
slowest seed at 1.08 years; at the old 70 it was 12 meets and 56 days. The full
six-candidate table it was chosen from, and the reasoning for 20 over the more
realistic 12, live beside the constant in `src/career/careerSweep.ts` rather
than being copied here, so the two cannot drift.

#### RULED 2026-08-15: THE GAIN RATE STAYS AND R2 IS RE-DERIVED

**158 of 192 arcs inside the first year, at a 290-day median, IS ACCEPTABLE at
`MAX_GAIN_KG` 20.** R2 was left failing rather than re-pinned when the rate
moved, on the grounds that a requirement adjusted to fit the measurement that
just broke it is a pin nudged until green. The ruling agrees with the diagnosis
and takes the other branch: **the pace is fine and the requirement was never a
requirement.** That bar had been read off three fixtures in turn — 176, then
192, then 158 — without once being derived from what a campaign ought to feel
like.

**Re-stating it as "82% of arcs" would have been the same defect wearing a
percent sign**, because 158/192 is 82.3%. The test of a re-derivation is whether
the reason for the number survives the fixture changing, so R2's two horizons are
now composed out of design constants and its one remaining free number is
labelled a design position rather than dressed up as a derivation.

- **R2m's horizon is the calendar's own period.** §6.6 says a campaign is a
  year-scale thing; the median is what "the typical player" means; and the year
  a lifter actually gets is 52 whole weeks, because every cadence in this
  calendar is a whole number of weeks so nothing drifts across a leap year. It
  is 364 rather than 365 for that reason and not for safety — no arc arrives on
  day 365, so the two select the same arcs on this fixture.
- **R2t's horizon is a year to climb plus one summit cadence to wait: 546.** The
  cadence block sets 182 by an explicit worst-case argument — a lifter who
  clears the gate the day after a summit waits up to one cadence for the next —
  so one cadence is, in the design's own words, the most the **calendar** may
  add to somebody who has already qualified. An arc outside 546 is therefore
  slow for a reason the calendar cannot supply: its lifter was still climbing.
  A second derivation lands on the same number — the arc window less one cadence
  — which reads R2t as R1 with a margin.
- **R2t's floor of nine in ten is a DESIGN POSITION, not a derivation, and the
  code says so.** The design states a year, a cadence and an absolute; it states
  **no tolerance for how large the slow tail may be**, and none can be recovered
  from the potential band without inventing a line. What *is* derived is the band
  the fraction sits in: **not 100%**, because `POTENTIAL_MIN_KG` sits 25 kg above
  the gate on purpose and the design therefore guarantees lifters who creep to it
  — the one arc outside 546 belongs to the weakest seed the band can draw, at
  627.5 kg; and **above 84.4%**, because the calendar this section calls a design
  violation already gets 162 of 192 inside that ceiling, and a bar a design
  violation clears is a bar about nothing.

**Why R2 needed two horizons rather than a count and a median at one.** With
every arc reaching a summit, "the median is inside the year" *is* "at least 97 of
192 are inside the year". So at the year horizon a floor below half is implied by
R2b and a floor above half implies R2m: the year is occupied in both directions
and a second clause there could only restate the first.

**Each half catches one of the two broken calendars and neither catches both**,
which is the evidence they are two clauses rather than one written twice.
`annual-late`'s median is 449 days and it fails R2m while clearing R2t at 191 of
192; `annual-at-the-competitive-phase`'s median is 324 days and it clears R2m
while failing R2t at 162. That split is the same "opposite ends of the season"
the controls have always shown, now visible in the requirement itself.

**What was never in doubt:** R1 and R2b both held throughout, so the summit is
reachable for every arc and no signup day is locked out.

Read all three as measurements of the **ceiling** of campaign pace, not its
middle — `simulateCampaignArc` takes every meet the lifter is eligible for, and
a real player misses meets.

**Two findings from that measurement are worth recording in the design document,
because both correct something this section previously implied.**

First, **R1 stated over the whole population separates almost nothing, and how
little depends on the fixture rather than on the design.** The unfixed calendar
took **191** of the same 192 arcs to a summit — one arc of separation. Under the
bounded generator **all four calendars took 192 of 192**, so R1 separated
nothing at all. At the slower gain rate both annual controls are back at **191**,
so the separation is back to one arc. It is kept as an absolute because it is
stated as one here and a documented breach of an absolute has been refused three
times in this build; one arc must not be read as evidence that a calendar is
repaired. What separates a repaired calendar from a broken one is the
per-signup-day form — **15 of 24** against **0 of 24**, and that gap is the one
statistic here that has been non-zero on all three fixtures. "Always reachable"
is a claim about every player, and an average hides exactly the failure it was
written about.

Second, **the cadence is the reachability fix and the calendar position is not**,
which is the opposite of what "a threshold *and* a calendar position" invites a
reader to assume. Measured on all four corners of the two-knob square: at the
shipped semi-annual cadence the OLD day-six phase reaches 192 of 192 with a
worst signup day of **14 against the shipped calendar's 15**. That pair has read
18/19, then 24/24, then 14/15 across the three fixtures, and on the reachability
clause the phase contributes almost nothing on any of them. What the phase buys
is legibility — at day six the first summit a new lifter is ever shown is one
**no** seed can enter, 0 of 24 against 10 of 24. **That second number was 24 of
24 before the gain rate was slowed, and the fall is a real cost:** the first
summit an anchor-signup lifter is shown falls on day 177, and the median career
now needs 187 days to put up the 600 kg it asks for, so over half of them watch
it go past. The phase still buys legibility; it buys less of it.

**And the threshold was never the cause — but the claim that the measurement
CANNOT SEE the threshold has expired.** Re-taken on the bounded generator,
575 / 600 / 625 reached a summit inside the first year on 192 / 192 / 184 of 192
arcs, which is flat enough that only a stated rule could choose. At the slower
gain rate the same three read **184 / 158 / 112**, which is a real spread. 600
still stands by the midpoint rule, and a tuner picking inside the band now has a
pacing measurement to weigh against that rule — which of the two should decide
is open. Note also that 625 fails **R1**: only 184 of 192 arcs reach a summit at
all, because `POTENTIAL_MIN_KG` is 625 and a lifter whose ceiling is 625 cannot
reliably clear a 625 gate.

**That sentence used to end "rather than R2", and the re-derivation made it
false — re-measured rather than reasoned about.** At a 625 gate the three
clauses now read: R1 fails at 184 of 192; **R2m passes** with a 336-day median;
**R2t fails** at 168 of 192 against its bar of 173. So the threshold breaks two
of the three, and R2t is the half that sees it. That is worth recording for its
own sake: R2t was derived to bound the tail of a **calendar**, and it turns out
to bite on a **threshold** change as well, which no other pacing clause here
does. The same probe at 575 / 600 / 625 gives medians of 267 / 290 / 336 and
tail counts of 192 / 191 / 168.

**And it exposes R2m's domain, which is stated here rather than left to be
found.** `medianDaysToFirstSummit` is the median over the arcs that reached a
summit **at all**, not over all 192 — a calendar that took two arcs to a summit
quickly and stranded the rest would post an excellent median. **R1 is what makes
R2m a statement about the whole population**, and on any arm where R1 fails, R2m
must be read as conditional. The 625 row above is exactly that case.

Both unfixed calendars stay runnable as controls with their numbers pinned, and
they fail at **opposite ends of the season** — the old phase locks out the player
who signs up on the anchor, the new phase with an annual cadence locks out the
player who signs up late.

**Nationals is thin, and is reported as thin rather than quietly folded in.**
Over the campaign sweep's arcs it is **entered 1243 times of 1536 offered**, or
81% — it was 1328 of 1536 (86%) under the unbounded generator and 1447 of 1536
(94%) once that was bounded, so the slower gain rate has taken it to the lowest
of the three. On the one-year-from-the-anchor window the original finding was
taken on it is **48 of 96**, previously 72 of 96 and 60 of 96 before that.
Neither number is a health claim about the tier, and every one of those moves is
the fixture rather than the tier: what decides the ratio is how much of the run
a lifter spends under the 550 kg nationals bar, and a slower lifter spends more
of it there. Nationals is a synchronous PvP tier now, and what a simulated solo
lifter does with it says nothing about what a real field will.

**Still held:** everything on the synchronous side. Regional and nationals are
sync and region-pooled; the campaign work above builds none of that.

---

**SUPERSEDED — the split as it stood before 2026-08-14**, kept for legibility:

> **Local / regional meets — asynchronous (majority of play):** attempts resolve
> against ghost data (past player results or seeded NPCs); runs on the player's
> schedule, offline-friendly, low infra cost; weekly/biweekly cadence keeps
> Career progression steady.
>
> **Nationals / Worlds — synchronous (rare, seasonal):** … entry gated by
> qualifying total earned in async meets.

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

### 10.0 BETA SCOPE — RULED 2026-08-19

A human defined the beta target, answering the four scope questions directly:

- **Platform: web/PWA first.** A URL opened on a phone — the same surface every
  playtest and every browser check in this run has used. Native builds come
  after beta, not before.
- **Campaign-only.** The full career ladder against NPC fields, through the
  campaign worlds summit. Synchronous PvP (regional / nationals / competitive
  worlds with real players) is **post-beta**; competitive worlds appears as the
  visible, locked harder ceiling. Every sync ruling in §6.6 stands and waits.
- **Local-first persistence.** Device-local, schema-versioned, behind the
  existing server boundary, shaped so Supabase later is a transport swap and
  not an unwinding — §8's server-authoritative rule deferred, not repealed.
- **Monetization is out of beta entirely**, per this document's own "no
  monetization before retention" rule.

The sprint plan that executes this lives in CLAUDE.md's coordination section,
because it allocates work across sessions. The working assumption that gated
Career, Arcade and cut-in art is superseded for **Career** by this scope (the
campaign ladder IS the beta); Arcade and cut-in art remain out unless ruled in.

**Powerlifting Sports Universe sequence (A0–A7) is recorded in §13.** A0
PLAYABLE SPORT is CLOSED (2026-09-02, runtime `39400d97`). A1 Authentic
Meet is authorized by that ruling. This section does not replace the
prototype questions below, and it does not authorize A2–A7.

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

      **THE GATE IS NOW OPEN. HUMAN PLAYTEST VERDICT, 2026-08-12: THE SQUAT IS
      FUN.** Multiple people played the MVP on a mobile browser and enjoyed it.
      This is the first verdict in this build on the one bar no critic here
      could ever grade, and it is recorded as a finding rather than a chat note
      because everything above turns on it. L1's status moves from "craft bar
      passed, feel unverified, reference unreachable" to **PLAYTESTED
      POSITIVE**.

      **WHAT IT VALIDATES, EXACTLY.** The core lift mechanic — the squat's
      press-and-hold input, its timing windows, its feel. Nothing else. The
      still-open feel questions are NOT covered by it and remain their own
      separate playtest items: the crowd-reaction beat, and the PR-attempt
      wording where §6.3 currently ships one of two recorded options with a
      playtester's ruling named as the way it gets settled. A positive verdict
      on the mechanic is not a verdict on the copy around it.

      **TWO FINDINGS CAME BACK WITH IT, and they are different in kind.**

      1. *An environment defect, fixed — but the FIRST fix was on a screen no
         player can open, and that is worth more than the fix.* Pressing on a
         mobile browser triggered the browser's own text-selection gesture — the
         surface highlighted and selection handles appeared. The squat's input
         IS a press-and-hold, so the one gesture the mechanic is built on is
         exactly the one a browser reads as "select this".

         **What shipped first was `PRESS_NOT_SELECT` in
         `src/lift/LiftScreen.tsx`, and `AppShell` mounts that screen only
         behind `route.surface === 'replay'`, which `shellRoute.ts` builds with
         `source: 'debug'`.** So a fix for a defect a human reported was declared
         on the one lift surface a player cannot reach, while `SetView` (§3.2's
         daily set) and `AttemptView` (§6.2's meet attempt) carried none of it.
         The source guard was green the whole time, because it named
         `LiftScreen.tsx` and was correct about the file it was actually reading.

         **It was also in the wrong PLACE on that screen**, which the move
         surfaced: `user-select` inherits and `touch-action` does not. A single
         object on the pressed element put the selection half on the Skia
         `<canvas>` — where `caretRangeFromPoint` returns CANVAS at offset 0 and
         Blink will not start a selection at all — and never reached the prompt
         text a thumb rests on.

         The fix now lives in `src/lift/pressGuard.ts` as two objects split by
         whether they inherit: `PRESS_NOT_SELECT` (`userSelect`,
         `WebkitTouchCallout`) on the screen root, `PRESS_NOT_TAKEN`
         (`touchAction`) on the pressed element. All three screens apply both.
         `src/lift/liftInput.test.ts` no longer names files: it discovers every
         `<LiftStage>` in the repository, climbs to the enclosing `Pressable`,
         resolves the spread to an import from `pressGuard.ts` so a same-named
         local shim fails, and pins the surface count at 3 with their testIDs.

         **Verified in a real browser on the surfaces a player reaches**, by
         `tools/verify-lift-press.mjs`: 77 checks, 6 named skips, both played
         arms read with the address bar asserted empty. At React Native Web's
         default `touch-action: manipulation` the session surface produced
         `pointercancel=1` at both 200px and a 20px finger drift — the browser
         taking the descent away mid-rep — and 0 with the fix, with the forced
         `manipulation` and forced `none` controls firing in the same run so the
         zero is a zero against something.

         **What the browser check CANNOT say**, stated because the report came
         from a phone: it is headless desktop Chromium with touch emulation.
         `-webkit-touch-callout` is not implemented by Blink and is a named
         SKIP on every arm, covered only by the source scan. And a selection
         cannot begin on a canvas in this engine, so whether iOS WebKit does
         something on a replaced element that produced the reported symptom is
         **not settled**. The `touch-action` half is measured end to end; the
         `user-select` half is not, on the surface the report named.
      2. *A design question, OPEN.* Players were unclear how to perform the
         down-and-back-up motion. That is the mechanic not communicating itself
         on first contact, and it needs design — an onboarding beat, a visual
         cue, an input affordance — not a tuning number. **It is deliberately
         not being answered from inside this build**, because it is game feel
         and §12.1 puts that with a human.

      **AND THE TWO ARE ENTANGLED, WHICH IS WHY THE ORDER MATTERS.** Some of the
      "confusing" feedback may have been people fighting the browser rather than
      the mechanic. So (1) is fixed first and (2) is re-tested with the same
      players before anything is designed for it: the honest next measurement is
      whether the clarity complaint shrinks, holds, or is confirmed.

      **THE RE-TEST MUST BE ON A REAL PHONE, AND THAT IS A GATE THIS RUN CANNOT
      LIFT ITSELF.** The first fix was verified green by a source scan reading a
      screen no player can open; the second is verified by a real browser driving
      the surfaces a player does reach. Neither is a phone. The reported symptom
      was a selection starting under a press on the stage, and the one engine
      available here provably cannot produce that on a canvas — so the defect as
      described is either about the copy beside the stage, or about WebKit
      behaviour nothing in this repository can observe. Until someone presses it
      on the device the report came from, "fixed" means "the input is no longer
      taken away from the app, measured", not "the thing the playtester saw is
      gone".

      **WHAT THIS DOES NOT YET CLEAR.** Extending the mechanic to bench and
      deadlift is now *justified rather than premature* — but it is held until
      the re-test, so the signal on whether L1 is solid is clean before the
      mechanic is copied into two more lifts.
      This sits next to a real tension the run does not resolve for itself:
      §12.1 says a Gauntlet Loop run collapses phase gates into critic bars,
      and this run has already built Prototype-3-tier content — meet day,
      result cards, the licensing system — under exactly that reading, without
      waiting for retention data. Cut-in art (§7.2, "cut art entirely from the
      early prototypes... until meet day is proven to land") is the same shape
      of question one level down: §12.2 defines a critic bar for cut-ins, which
      argues for attempting them; §7.2 argues against building the art at all
      yet. Recorded rather than silently resolved either way. Until ruled,
      the working assumption this run is applying: Gym Empire, Career, Arcade
      and cut-in *art* stay unbuilt; grading and closing what already exists
      continues without waiting on this answer.

- [x] **RULED 2026-08-14: THE GATE IS LIFTED FOR THE IDLE LAYER SPECIFICALLY,
      AND FOR NOTHING ELSE.** A human's ruling, recorded here in full rather
      than silently amended, because the reasoning binds the next case.

      **The reasoning.** The gate's stated condition — the lift mechanic proven
      fun — was met by the 2026-08-12 playtest verdict recorded above. What
      remained shut was a phase-gate *assumption* whose premise expired when
      §5's logic landed and was verified. **A gate held shut past its own
      justification is the stale-prose pattern this session corrected four
      separate times**, and this instance was holding a verified subsystem inert
      behind a screen that overclaimed what it showed.

      **Authorised by that ruling, and no more than this:** wire `stepGym` and
      `accrueProduction` so the Empire screen shows real advancing state, and
      fix the round-trip defect that discards the player's session state.

      **Still gated, unchanged:** new §5 feature work beyond that wiring,
      monetization surfaces of any kind, Career, Arcade, and cut-in *art*. The
      lift is for the idle layer specifically; it is not a general reopening,
      and the paragraph at the end of the L1 entry above still governs
      everything it names.

      **Two seams this ruling does NOT open**, because it did not mention them
      and they carry their own constraints: the empire→`progression.ts` pooled
      wallet, which CLAUDE.md holds as a deliberately serialised piece whose
      first mover inherits the §8.3E tender concession; and `src/empire/**`
      itself, which is Session B's and which the wiring reads rather than edits.

      The original question is kept below as it was written, because the ruling
      is only legible against it.

      ---

      **GDD §5's idle loop is BUILT, TESTED AND MEASURED, and no player can
      reach any of it. That outcome was nobody's decision, and it needs a real
      ruling rather than continuing as a residue.** Flagged by a human on
      2026-08-14 after an Empire shell grading surfaced it as a side effect.

      **The facts, each checkable.** `src/empire/` exports `stepGym`,
      `runEmpire`, `accrueProduction`, `beginRecruitment`, `startExpansion` and
      `skipExpansion`, with §5's engagement property measured at 0 violating
      pairs across 24576 and non-zero controls kept runnable beside it. A
      player-reachable `EmpireScreen` exists and is checked by a browser
      instrument that presses its way onto the floor. **That screen calls
      `createEmpireState()` once, in a `useState` initialiser, and nothing ever
      steps it** — so there is no device, no day and no length of play on which
      it shows anything other than `0 / 0 / 0 / bare-bar`. The floor is a window
      onto a subsystem nothing can drive.

      **How it happened, which is the part worth ruling on.** Three decisions
      that were each correct alone: the working assumption below says Gym
      Empire stays unbuilt pending the §12.1-versus-§10 question; a human
      separately ruled that Session B builds the §5 loop, because §5's
      invariants had no subject until its loop existed; and Session C wired a
      render-only shell slice to what Session B had shipped. Nobody chose the
      result, and nobody would have chosen it if asked directly.

      **Note which gate is actually shut, because it is not the obvious one.**
      CLAUDE.md's non-negotiable — *"Do not build Gym Empire before the lift
      mechanic is proven fun"* — is **OPEN**: the 2026-08-12 playtest verdict
      above says so in as many words. What still blocks is the unruled §12.1
      tension and its conservative working assumption, which was written before
      §5's logic existed and is now preventing the *exposure* of something
      already built rather than preventing anyone from building it.

      **The shapes a ruling could take, none preferred here.** (a) Leave the
      logic dark and unwire or relabel the screen, so the app stops advertising
      a mode it cannot play — cheapest, and honest. (b) Keep the static floor
      as a deliberate placeholder, with its permanence stated on the screen
      rather than discoverable only by mutation. (c) Lift the gate for the idle
      layer specifically, on the grounds that its own precondition has been met,
      and let the loop reach a player. **What must not happen is (d): the
      question staying implicit while more surface accretes around it**, which
      is the path the run is currently on by default.

      Not urgent. Ruled before it recurs on its own, rather than after.

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

- [x] **A forward clock jump on the Empire floor is an unbounded synchronous
      loop, and the fix is a §5.1 design choice rather than a performance
      patch.** `advanceEmpireFloor` in `src/shell/empireFloor.ts` clamps a
      BACKWARDS clock — a system clock that steps back leaves the gym where it
      was — and says so in its own docstring. It put no bound on a forward one:
      `owed` was a function of elapsed wall time with nothing above it, and the
      catch-up loop runs inside a React state updater. Measured at `3ed3956`,
      one jumped reading handed to a fresh floor: 1 hour = 360 steps / 27 ms,
      1 day = 8,640 / 284 ms, 1 week = 60,480 / 2,196 ms, 30 days = 259,200 /
      11,103 ms — so a device-clock jump of a year is roughly two minutes of
      blocked main thread. A 2026-08-16 ruling held it open as a §5.1 question
      rather than letting a bound arrive as a side effect of another piece,
      because the two plausible bounds are not equivalent to a player.
      **CLOSED, 2026-08-18, by the ruling §5.1 now records**: a suspended tab
      is offline in §5.1's sense, Option B — cap the catch-up at
      `OFFLINE_EARNINGS_CAP_HOURS`, acknowledge the rest, no
      `OFFLINE_EARNINGS_FRACTION` on this path — and the away summary is a
      number and a state. The restated §12.3 property, the capped sweeps, the
      re-taken freeze ladder (4,320 steps whatever the jump) and the away row's
      class guards are in `empireFloor.ts` / `empireFloor.test.ts`.
      Worth keeping about how it survived as long as it did: it was the sibling
      branch of a guard that was written, tested and documented for one
      direction only — the shape CLAUDE.md records as "the next thing to look
      at is the branch immediately below it".

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

---

## 13. Powerlifting Sports Universe Doctrine

**Ruled 2026-09-01. Documentation of product identity.** A0 PLAYABLE SPORT
is CLOSED as of 2026-09-02 (baseline runtime `39400d97`). A1 Authentic
Meet is authorized by that same ruling. This section does not retune
lifts, does not implement Career, and does not change Session B's
ownership of §5. The concise north star is `VISION.md`.

### 13.0 North star

Three White Lights is the definitive powerlifting sports game: build a
lifter, master the three lifts, navigate a living competitive career, and
chase totals, records, championships, and a legacy in a world that remembers
every platform moment.

**Shorthand:** Build a lifter. Enter the sport. Leave a legacy.

**Category ambition.** Category-defining for powerlifting in the same sense
the leading basketball and American-football sports simulators are for those
sports. Named comparators: NBA 2K, Madden. Those names describe the
ambition. They are not a license to copy proprietary systems, UI,
terminology, assets, currencies, monetization, or an annual-release model.

**Retention, demoted from identity.** The daily habit loop (§3, §4, §12.2)
is preserved as a retention mechanism. It is no longer the product pitch.
A player who only ever trains and never enters the sport has not played
this game; they have used the practice tool.

### 13.1 The player is not in a vacuum

The long-term game contains a persistent competition ecosystem:

lifter → training → meet → results → rankings / records / qualification →
rivals / opportunities → next training decision → future meet → career
history → legacy.

Important events are remembered. A total that only exists on the recap
screen is not a career. A rival who is not produced by results is not a
rival.

### 13.2 One statistical universe

**Permanent rule.** Player results and simulated NPC results inhabit the
same statistical and regulatory universe.

NPC simulation may be cheaper internally. It may not use a different
meaning for:

- Total
- DOTS
- weight class
- records
- qualifying totals
- attempt legality
- meet placing

A believable player performance must remain believable relative to NPC
performance. A fake statistical universe — one set of meanings for the
player and another for the field — is an anti-pattern, not a performance
optimization. §2's Total rule (meet results only) and §6.4's attempt
structure are the player-side of this universe; NPC totals must be
readable against the same definitions.

### 13.3 Sporting hierarchy

| Layer | What it is | What it is not |
|---|---|---|
| **THE LIFT ENGINE** | The atomic gameplay layer. If the lift is not the sport, nothing else is. | A minigame attached to a career sim. |
| **MY LIFTER** | Persistent athlete identity — the body, the class, the history. | A session token. |
| **CAREER** | Training context that feeds the next meet. | An infinite chore list. |
| **POWERLIFTING UNIVERSE** | Rankings, rivals, records, qualification, a living field. | A leaderboard pasted on at the end. |
| **MEET DAY** | The emotional payoff. The platform moment the world remembers. | A results screen with extra animation. |
| **GYM EMPIRE** | A supporting off-platform ecosystem. | The product identity. |

Gym Empire remains **§5, owned by Session B**. This doctrine does not
claim it, rewrite it, or wire it. It names the layer so later feature
work cannot quietly promote the idle loop into the sport.

### 13.4 Emergent story

Prefer stories produced by game state:

- repeated rivals
- record chases
- close placings
- bomb-outs
- qualification
- weight-class moves
- championship rematches

over mandatory scripted narrative.

Presentation may frame an authentic event. It must not manufacture
importance the game state does not support. A cut-in, a broadcast line, or
a rival speech that the results cannot justify has failed this section
even if it looks expensive.

### 13.5 Career memory

The long-term game requires a Career Ledger — or an equivalent persistent
history — capable of supporting:

- training milestones
- competition attempts
- meet results
- placings
- records
- qualifications
- rankings
- rival meetings
- titles
- career milestones

**This piece does not architect the persistence implementation.** It
records the requirement. Schema, storage, and the `progression.ts` seam
are later, serialized work, and they stay off this diff.

### 13.6 Permanent design tests

Every later Session A feature is judged against these. A piece that cannot
answer them is not done, even if it is green.

**SPORT TEST.** Is the lift still the atomic gameplay layer? If a player
could skip the platform and still "play the game," this fails.

**PLAYER TEST.** Does the athlete persist as an identity — body, class,
history — rather than as a session token that resets when the app closes?

**WORLD TEST.** Does the player exist inside a competition ecosystem that
produces rankings, rivals, records, and future opportunities from results,
or in a vacuum with a score?

**MEMORY TEST.** Can the career remember the events §13.5 names, or does
the last recap screen replace the last one?

**STORY TEST.** Is any story this piece tells produced by game state, or
did presentation invent the stakes?

**BROADCAST TEST.** Does presentation frame an authentic sporting event,
or manufacture importance the state does not support?

**STATISTICAL-UNIVERSE TEST.** Would the same Total, DOTS, class, record,
qualifying total, attempt legality, and placing mean the same thing if an
NPC produced them?

**INFINITE-PROGRESSION TEST.** Can a long career keep producing new
sporting questions — records, rivals, qualification, weight-class moves,
rematches — without a mandatory prestige reset or a meaningless daily
chore as the only loop?

**POWERLIFTER-CREDIBILITY TEST.** Would a competitive lifter believe this
is their sport — rules, attempts, totals, the platform — rather than a
generic RPG wearing a barbell?

**LEGACY TEST.** Can a career leave a record that outlasts a single meet:
titles, records, rivalries, a history the world still knows?

### 13.7 Session A sequence

Directional product sequencing, **not authorization to build these stages
now**:

| Stage | Name | What it is |
|---|---|---|
| **A0** | Playable sport | The lift engine, proven. CLOSED 2026-09-02 at `39400d97`. |
| **A1** | Authentic Meet | Meet day as the sport's emotional payoff, not a results overlay. Current work. |
| **A2** | My Lifter | Persistent athlete identity. |
| **A3** | Career Calendar | Training context and the meet calendar that gives it somewhere to go. |
| **A4** | Powerlifting Universe v1 | Rankings, records, qualification, a living field. |
| **A5** | Rivalries / Legacy | Repeated opponents and a career the world remembers. |
| **A6** | Broadcast depth | Presentation that frames authentic events. |
| **A7** | Social competition | Real people in the same universe, not a second game. |

**A0 is CLOSED.** Do not reopen accepted squat / bench C3 / deadlift
mechanics without new human evidence, an explicit ruling, a targeted
change, and a replay. A1 is authorized by the 2026-09-02 ruling; do not
start A2–A7 from this section. Do not treat this table as a sprint plan;
the sprint plan lives in CLAUDE.md. Physical-device touch smoke is
release QA debt (`A0-DEVICE-01`), not an A0 design blocker.

### 13.8 Anti-patterns

Permanent refusals, including and in addition to §8 and CLAUDE.md's hard
design constraints:

- no pay-to-win strength
- no random-card power economy
- no mandatory prestige reset
- no meaningless daily chore design
- no generic RPG attributes without gameplay meaning
- no scripted rivalry unsupported by results
- no spectacle unsupported by sporting stakes
- no fake statistical universe
- no copying proprietary systems, UI, terminology, assets, currencies,
  monetization, or annual-release models from the named sports-sim
  comparators
- no licensed federation claims without rights — player-facing federation
  identity stays fictional until a human rules otherwise with rights in
  hand; structural citation of real rules remains the existing §12.3 split

### 13.9 Current work is not derailed

C3 surplus compression is the accepted bench feel (minted 2026-09-01 after
ordinary-bench phone replay). A0 PLAYABLE SPORT is CLOSED (2026-09-02)
at baseline runtime `39400d97`: squat, bench C3, and deadlift are
accepted and frozen. Physical-device touch smoke is A0-DEVICE-01 release
QA debt, not a design blocker. A1 Authentic Meet is the current Session A
task. This doctrine still does not retune lifts, implement Career, or
touch Session B.

This doctrine still governs **what comes after** and **how future features
are judged**. A2–A7 are not authorized from this section.
