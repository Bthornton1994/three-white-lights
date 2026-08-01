# Powerlifting Game — Game Design Document

**Status:** Pre-prototype
**Stack:** React Native + Expo, TypeScript, Reanimated 3, Skia, Supabase
**Last updated:** 2026-08-01 (§4.1/§4.2/§4.4 — the free grace is per absence, not
per gap; the longest repairable absence no longer depends on how often the app is
opened)

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

All four feed one persistent lifter and two shared stats.

### Shared Progression Currencies

| Stat | What it is | How it grows |
|---|---|---|
| **Total** | Raw strength (kg/lbs). The vanity/status number. | Sim mode primarily, Arcade secondarily |
| **Training IQ** | How *well* you train. Skill/knowledge stat. | Good Sim decisions, Gym Empire passive trickle |

The split creates the core tension: strong-but-dumb (high Total, low IQ →
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
Feeds Total and *technique points* (spent on bar-path efficiency, which reduces
injury risk in Sim). The Arcade input mechanic is the same mechanic used in meet
day — building it well pays off twice.

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
streak unless Recovery Days are spent on the days past the grace. See §4.4 for
the ruling that introduced this and what it costs.

**The grace is per absence, not per gap.** An absence is everything since the
last *trained* day. The grace covers the first few days of one, and a Recovery
Day spent partway through does not hand the player a fresh grace window for the
days after it — only a real session does. So the longest absence a run can
survive is the same number whether the player checks in every day of their
holiday and pays each time or answers one prompt on the day they get back.

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
threshold.** An absence inside the grace costs nothing, moves no balance, and
produces no prompt — there is no decision to make when nothing is being spent.
Recovery Days are what buys a *longer* absence: vacation, illness. They remain a
finite consumable, earned and purchased exactly as below; there are simply far
fewer occasions to spend one. Only the days past the grace are charged, so an
absence one day longer than the grace costs one Recovery Day, not the whole
absence.

The grace is charged against the **absence**, not against each uncovered gap
inside it (§4.1). A player who pays a day at a time from inside a holiday is
charged for exactly the same days as one who pays once on the way back, and pays
the same total.

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
  That ceiling holds at every balance up to the hold cap **and however often
  the player opens the app during the absence**, because the grace is spent
  once per absence (§4.1) and the consecutive-use counter only climbs until a
  real session resets it. Paying in instalments from inside a holiday buys
  nothing that paying once on the way back does not.
- **Manual use, not auto-apply.** Prompt the player: *"Use a Recovery Day to save
  your streak?"* The agency and the small "phew" moment are the point. This is a
  rule about *spending*; the free grace of §4.4 spends nothing and so has no
  prompt to skip. The player is still told the gap was covered.
- **The free grace is separate from the consecutive-use limit** and stays a
  separate tunable, even where the two happen to hold the same value. One is how
  much absence is free; the other is how many Recovery Days may be spent in a
  row before a real session has to happen.

**Coverage is all-or-nothing.** A token offer only appears when the tokens held
can cover the *entire* gap. Covering four days of a seven-day absence would take
the player's tokens and still break the run, so partial coverage does not exist.
The grace paying for part of a gap is not partial coverage: the offer still
keeps the run alive across all of it, or does not appear.

What all-or-nothing does *not* promise is that a token can never be wasted. A
player who opens the app mid-absence, accepts a save, and then stays away past
what their balance covers ends poorer than one who never opened it and never saw
the prompt. Every yes was a genuine save at the moment it was taken — declining
would have ended the run there and then — so this is the price of an option, not
a penalty for showing up, and the *streak* outcome is identical either way.

### 4.3 First-Break Tutorial Moment

The first time a player would break their streak, auto-offer a token with
explanation. Let them *feel* the save before they understand the system.

**The trigger is an absence past the free-grace threshold, not any miss.** Since
§4.4 a short miss costs nothing, so there is no save to explain and no moment to
teach — firing the tutorial there would explain a system the player has not
touched. At today's tuning that means a **3+ day absence**, since the grace
covers the first two days of one and the first prompt of an absence therefore
cannot arrive sooner.

"Auto-offer" means the prompt appears unasked — it does not mean the token is
spent for them. §4.2's manual use still applies, and the tutorial fires at the
first break the player can actually be *saved* from. A first break that nothing
could have covered does not burn the moment.

The Duolingo streak-freeze precedent this section is built on still holds: the
save has to be *felt* once before it is understood. What §4.4 changed is which
break is worth spending that moment on.

### 4.4 Free Grace for Short Gaps — Ruled

**Status: decided. Short gaps are covered for free; Recovery Days are spent only
on longer ones.**

**The defect this settles.** Tokens are finite, and only a *live* streak can be
offered one. Those two facts together meant a player who accepts every offer
could end on a **shorter** streak than the same player who trained one day
fewer. The extra session keeps alive a run the lazier history had already lost,
so the diligent player is offered a token sooner, spends it on a run that dies
later anyway, and has nothing left for a longer run afterwards. Idle days
*before* a run exists were free; idle days *inside* a live run cost tokens, and
an extra training day converted the first kind into the second. That breaks the
"never punish daily engagement" line in §12.3.

**The ruling.** The first **free-grace threshold** days of an absence are covered
without touching the Recovery Day balance. Recovery Days remain a finite
currency, earned and purchasable per §4.2 and §8.2, but they now buy coverage
only for longer absences — vacation, illness — and only for the days past the
grace.

**The grace belongs to the absence, not to each gap inside it.** A Recovery Day
spent partway through an absence covers the days it pays for and nothing more;
it does not restart the grace for the days that follow. Only a training day
does that. This is what makes the §4.2 ceiling — grace plus consecutive-use
limit, four days today — the answer regardless of how often the player opens the
app. See "the walk-back correction" below for what this replaced.

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
survive, at the same streak, for the same number of Recovery Days.
`src/game/streak.test.ts` builds that table under both behaviours and asserts
every cell matches, at every balance from empty to the hold cap. Levelling
*upward* instead was rejected outright — it would have made seven days saveable.

**What the grace bought, measured over every 13-day calendar** (pairs differing
by one trained day, where the player who trained more ends strictly lower):

| | before §4.4 | first implementation | with the grace per absence |
|---|---|---|---|
| opening the app every day | 1948 | 0 | 24 |
| opening only on training days | 4250 | 36 | 36 |
| worst deficit | 6 | 3 | 3 |

**The middle column's zero was bought by the defect above, and it is the number
that needs explaining, not the 24.** While a spend re-armed the grace, a player
whose day was opened every day could hold a run across eight days where one who
reappeared at the end got four; that extra coverage papered over the inversions
this counts. Removing the bonus brought 24 of them back. The right-hand column
under "opening only on training days" is unchanged at 36 — that player never had
a mid-absence spend to re-arm anything — which is the check that the fix brought
the daily model into line with the returning one rather than the reverse.

**It is an improvement on 1948, not a fix.** Two more days of calendar and the
counts climb again — 210 and 384 at 15 days, worst deficit 5. The asymmetry is
inherent to a finite consumable spent to keep a live run alive: the grace
removes every instance built out of absences shorter than the threshold, which
is most of them. The deficit still has no ceiling — it is the length of the run
that dies, so 37 trained days ending on 37 against 38 ending on 18 still exists.
`src/game/streak.test.ts` pins both calendar lengths so the improvement and its
limit stay on the record together.

What still holds, and is what the design leans on:

- On a player's own calendar, **saying yes is never worse than saying no.** The
  prompt in §4.2 can never be the wrong answer to itself.
- A player who used tokens never ends below one who trained fewer days and used
  **none**. Tokens only ever extend a run; they never subtract from the count.
- Spending on the long-gap path preserves the streak **exactly**. A Recovery Day
  protects a run; it never partially resets one.
- **Opening the app during an absence is neutral.** It cannot shorten the
  absence a player survives and cannot raise the price of surviving it. The one
  thing it changes is that a player who cannot afford the whole absence may
  spend part of their balance on a run that dies anyway — see §4.2's note on
  all-or-nothing coverage.

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

**Scarcity is the entire mechanic.** Cut-ins work because they interrupt. Firing
one on every set turns a 60-second daily session into a 2-second tax that players
resent by day 4.

- Hard gate: no more than one per session, ideally not every session
- Always skippable — tap to dismiss. Daily players will see these hundreds of
  times.

**Cut-ins also resolve the tone problem.** Retro sprites read playful, which is
right for the casual funnel but risks undercutting meet-day tension. A hand-drawn
shot of a lifter's face under a maximal attempt carries intensity that cute
sprites cannot. This is the solution to "does meet day feel serious enough."

**Cut art entirely from the early prototypes.** Cut-in art is the most expensive
asset class in this plan and is completely orthogonal to whether the game is fun.
Placeholder rectangles until meet day is proven to land.

---

## 8. Monetization

### 8.1 Hard Rule

**Never sell power.** Sim training pace, e1RM growth, and meet-day performance
are 100% skill- and consistency-driven. Any whiff of pay-to-lift-more ends
credibility with the community the game depends on. This is a design constraint,
not a guideline.

### 8.2 Currencies

| Currency | Type | Earned | Spent on |
|---|---|---|---|
| **Gym Bucks** | Soft | Idle mode, check-ins, achievements | Cosmetics, gym decor, minor convenience |
| **Chalk** | Premium | Purchased; small trickle from rewarded ads / rare achievements | Cosmetics, timer skips, Recovery Days at premium rate |
| **Recovery Days** | Functional | Earned or bought | Streak saves (see §4.2) |

### 8.3 Revenue Pillars

**A. Cosmetics (primary, safest)**

- Singlet designs, chalk VFX, bar/plate skins, gym decor themes, lifter appearance
- Potential apparel brand partnerships (Rogue, SBD, A7) as a later play
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
| Animation | Reanimated 3 | Gesture/timing-driven lift animation |
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

- [ ] Weight units: default to lbs or kg? Per-user toggle presumably, but which
      is the default and does it vary by locale?
- [ ] Does Arcade mode use the *same* difficulty tuning as meet day, or is meet
      day deliberately tighter?
- [ ] How many NPC lifters is the right roster size before it becomes management
      overhead?
- [ ] Ads: in or out? Decide from Prototype 2 retention data.
- [ ] Federation flavor — invented feds, or is there licensing value in real ones
      (USAPL, USPA, NPL)?
- [ ] Equipped lifting: a mode, a cosmetic layer, or out of scope for v1?

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
