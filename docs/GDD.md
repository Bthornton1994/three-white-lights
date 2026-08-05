# Powerlifting Game — Game Design Document

**Status:** Pre-prototype
**Stack:** React Native + Expo, TypeScript, Reanimated 4, Skia, Supabase
**Last updated:** 2026-08-04 (§12.2 — **"test file" is now a DERIVED set, not a
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

**The invariant this buys, which is the point of the whole rule:** for a fixed
training history and a fixed armed state, the final streak, the final balance
and the number of Recovery Days consumed are **identical** whether the player
opens the app the next day, three days later, ten days later, every day, or
never until they come back. `src/game/streak.test.ts` asserts that directly, by
full state equality, over a sweep of opening schedules and exhaustively over
every calendar of a fixed length. Nothing about the outcome depends on when they
look.

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

#### Signup day, and charging both sides — RULED

**Status: decided. `StreakState` carries a `signupDay`, and idle days are
charged from it.**

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

**A doomed absence is charged too.** Coverage is still all-or-nothing — a run
either survives an absence or it does not, and there is no half-saved run — but
the *charge* is not. An absence that outran what was armed consumes the armed
Recovery Days anyway: they were committed to holding it open, they failed, and
they are gone. The amount is the **armed count**, which is fixed for the whole
absence, so it cannot depend on when the player comes back or on when anybody
opened the app.

*This reverses the previous rule, which said an absence that ends a run debits
nothing.* The reversal is a measurement, not a preference — see §4.4.

**The visible costs, stated rather than discovered:**

- A lifter who creates an account and does not train for longer than the §4.2
  ceiling loses the signup grant to that absence. Onboarding copy has to say so.
- A lifter whose run dies loses the Recovery Days that were armed against the
  absence that killed it. This is what the Duolingo streak-freeze precedent
  §12.2 names already does — a freeze is consumed by the day it covers, not by
  whether the week ended well — so it is a cost the bar already pays.
- The loss is **reported**, never silent: the training day that closes the
  absence returns it, and the break's read model shows what the next session
  will take.

**Migration.** Accounts created before the field existed do not carry a signup
day. The server backfills it from the account's creation timestamp; where that
is unrecoverable the honest backfill is the day the migration runs, which is
safe because monotonicity is a property of two possible *futures* from the same
state and both share whatever anchor the state carries. The field is **required
and non-nullable** so that an un-backfilled account cannot silently keep the old
free-lunch behaviour.

**The residual the prompt used to carry is gone.** Under the manual prompt, a
player who opened the app mid-absence, accepted a save, and then stayed away
past what their balance covered ended poorer than one who never looked. That was
the price of tying the spend to the day the player opens the app, and removing
the prompt removed it: there is now nothing for app-opening to change.

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

| | before §4.4 | first implementation | grace per absence | auto-protect | signup day (today) |
|---|---|---|---|---|---|
| opening the app every day | 1948 | 0 | 24 | 36 | **0** |
| opening only on training days | 4250 | 36 | 36 | 36 | **0** |
| worst deficit | 6 | 3 | 3 | 3 | **0** |

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

**What the fix is worth, measured the way the defect was measured.** Exhaustively
over every calendar of 8 to 16 days and every single-day superset of each: **0**
violating pairs at every length, **0** worst deficit, and **0** inversions of a
lifter's lifetime best. On a seeded sweep of 40-day calendars — 400 schedules per
seed, five written-down seeds — the seed the defect was first measured on goes
from **36 violating schedules / 100 violating pairs / worst deficit 16** to
**0**. The constructive family that produced "37 trained days end on 37, 38 end
on 18" now ends both lifters on 18, with the lifter who trained more holding the
higher lifetime best, at every run length from 8 to 1000.

**What is left, and it is a different defect.** Across all five seeds at 40 days,
13 violating pairs remain, and at 60 days more. Their cause is measured rather
than guessed: **streak-milestone income is paid once per lifetime and its arrival
is timed by the streak.** The lifter who trains more reaches a milestone earlier,
banks the Recovery Day earlier, and can lose it to a doomed absence that the
lazier lifter — whose identical payout has not arrived yet — walks away from with
the Recovery Day still in hand. Run the same sweep with milestone income
unreachable and it is 0 at 40 *and* 60 days at every seed; raise the hold cap so
no payout can ever be clipped and it does not move at all. So it is the *timing*
of the income, not the loss of it to the cap.

**That one has not been ruled on.** Both obvious fixes — paying milestones on a
schedule that is not the streak, or protecting income from a doomed absence —
change the §4.2 earning table, which is a monetisation decision rather than a
streak one.

**Where that leaves the bar.** "Never punishes daily engagement" is met over
every calendar length this repository can search exhaustively, and met on the
40-day sweep at three of five seeds. It is **not** met everywhere: the milestone
residue above is real, measured, and named rather than rounded up.

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

### 5.2 Production

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

### 6.3 Attempt Selection — The Real Tension

**Attempts within a lift never decrease.** This is the competition rule, not a
difficulty choice: once a weight is taken, the next attempt on that lift either
repeats it or goes up. There is no dropping down, so every attempt decision is
a one-way ratchet — which is exactly where the tension comes from.

After a **make**: a small increase (lock in a bigger total, low miss risk) vs. a
big one (a PR on the line, higher miss risk). The floor is already banked; the
question is how much of the remaining attempt to spend.

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
first place. **The cost is that a cut-in carries no Tier 2 at all**, so a beat
led by the `product` slot identifies by picture and product line rather than by
person — a trade nobody has seen with real art on it, logged in §11.

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
| **Chalk** | Premium | Purchased; small trickle from rewarded ads / rare achievements | Cosmetics, timer skips, Recovery Days at premium rate |
| **Recovery Days** | Functional | Earned or bought | Streak saves (see §4.2) |

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
track. Cosmetic rewards, Chalk, Recovery Days.

**D. Ads (optional, decide after playtesting)**

Rewarded-only. Never interstitial or forced — forced ads in a daily-habit app
will tank retention. Consider skipping entirely if pass + cosmetics perform.

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
      yet. Recorded rather than silently resolved either way. Until ruled,
      the working assumption this run is applying: Gym Empire, Career, Arcade
      and cut-in *art* stay unbuilt; grading and closing what already exists
      continues without waiting on this answer.

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
Two are ruled, two are open.**

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
