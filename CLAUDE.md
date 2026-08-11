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

## Session Coordination — THREE SESSIONS ARE RUNNING ON THIS REPO

**Read this before claiming any piece. There is more than one agent session
working in this repository, and none can see the others' conversations.**
Coordination lives here, in the tree, because that is the only channel the
sessions actually share. If you are a session that has just started and has no
history, this section tells you which half of the repo is yours.

**Session C is a Cursor cloud agent.** Sessions A and B are Claude Code
sessions. C cannot see A or B except through this section and git history; A and
B cannot see C the same way. C's harness does **not** support the isolated
builder-then-fresh-critic pattern A and B use. C therefore does not claim a bar
is met the way they do — C's increments are **ready for review** until a human
or an A/B critic has actually looked. Do not treat C's own pass as verification.

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

**THE SURFACE IS THE THREE WHOLE FILES, NOT THE `SOURCE_RULES` ALLOWLIST INSIDE
THEM. Ruled by a human on 2026-08-11**, settling the question Session A left open
after breaching it — and settling it *against* the narrower reading Session A had
argued was defensible.

The argument for narrowing was that an edit outside the allowlist "cannot
collide", so requiring a filed crossing for it is ceremony that trains people to
skip the filing. **That argument is refuted by a collision this same wave
produced, and the refutation is worth more than the rule.** Two branches were
each green alone and red together with **no textual conflict anywhere**: one
shipped a rule counting numerals inside `@guarantee` paragraphs, the other — doing
unrelated prose work in a different directory — inserted a *blank comment line*
between a claim and its tag. That paragraph break took `31 violating pairs
against 0 here` out of the rule's reach. Nothing failed at the claim. The only
thing that noticed was a pinned census moving 8 to 7, in a third file.

So "cannot collide" is not a judgement anyone can make about an edit in advance.
The colliding edit was whitespace inside a comment, in a file the other session
had no reason to think about, and it silently removed a check. A textual-conflict
heuristic would have cleared it instantly. **Whether two edits interact is a fact
about the code's semantics, not about the bytes**, and the coordination rule
cannot be keyed to something a diff can see.

The cost of the wide reading is a crossing filed for an edit that turns out to be
harmless. The cost of the narrow one is a defect that no merge, no typecheck and
no textual review would catch. Pay the first.

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

**CROSSING FILED BY SESSION A, BEFORE THE WORK, 2026-08-11 — `src/empire/empireInvariant.ts`
§4a and `src/empire/empireInvariant.test.ts`.** Filed in the correct order this
time, which is the point of writing it here at all: the previous Session A
crossing was filed *after* the merge and is recorded below as a breach.

*What and why.* §4a records eight mutants as prose summaries with element counts
— "1266 of 2616 Training IQ elements move", "2592 and 2592", "84 physio
elements". Those are the section's strongest evidence and the only part a reader
can neither re-derive nor watch expire. Unlike the browser class, they bind to
`it(` bodies in `src/`, so they are `MUTATION_WITNESSES`-eligible and there is no
reason for them to stay prose. The work is converting them to witness entries
with the two verbatim fields.

*Why it has to be Session A.* The witness schema, the `@guarantee` scoper and the
numeric rule these entries must satisfy all live in `src/game/guaranteeTags.test.ts`,
which is Session A's file and which changed twice this wave. Doing this from the
§5 side means editing that file blind.

*Scope, kept as narrow as it can be.* §4a's comment block and witness entries
only. No change to `stepGym`, the anchor, the purses, the roster or any measured
number — if a number turns out to be wrong, that is a finding to report, not to
fix from this side. Session B should expect a conflict in §4a's comment block and
nowhere else.

### Crossings Session B needed — one is DONE, one is still open

Session B did not edit any of the four files named here. A human approved both
as requests. **Crossing 1 has since been made by Session A, independently and
before this merge** — the three rows are in `audit.ts:226`, `audit.test.ts:963`
and `index.ts:132/375/415`, with their own `why:` text. That is recorded here
rather than left reading as outstanding, because a coordination entry that
under-describes the shared surface is the same defect as prose that
over-describes it.

**1. Three rows registering `src/empire/empireTuning.ts` — DONE, by Session A.**
The paragraph below is kept because it is the measurement, and because the
prediction it records came true exactly. Without the rows `audit.test.ts` reports 87 bare literals — every one in
that file, no other `src/empire/` module — which is the single failing test on
`claude/empire-s5-build-h9rvca`. **Verified rather than drafted:** applied in a
throwaway worktree at that branch's head, the whole suite goes to 75 files /
3119 tests, exit 0, so the three rows are necessary *and* sufficient. Row text
is in Session B's report. Classification is `feel`, which is what forces the
third row: `audit.test.ts`'s `reaches every feel home and every palette` pins
`TUNING_MODULES` against `SOURCE_RULES` in both directions.

*An earlier verification of the same rows found them necessary but NOT
sufficient*, because a guard pinned the audit at exactly 87 findings and
registering the file drops that to 0. That guard now reads `SOURCE_RULES` and is
correct in both worlds, so the extra edit no longer exists. Do not act on the
older warning.

**2. One extension to `@guarantee` in `src/game/guaranteeTags.test.ts`, so a
tagged claim's NUMBERS resolve as well as its test.** This is a Session A file
and Session B did not touch it.

*The defect it closes, measured twice in `src/empire/`.* A comment read "zero of
120 physio arrival days" while its named check pinned **144**; another read "32
of 144" while its own body pinned **128**. Both numbers moved when a ruling
landed and both sentences kept their confident tone. The existing tag caught
neither, because it resolves *that a test exists* and says nothing about what
the surrounding prose claims the test measured.

*The proposed rule, which adds no new tag and no per-number annotation:* **every
numeric literal in a `@guarantee`-tagged comment paragraph must appear in the
named test's body.** It reuses machinery already there — `MUTATION_WITNESSES`
already resolves `redAssertion` against a specific `it(` body — and body scoping
is what makes it bite: `144` does exist in the right *file*, as a different
check's pin, and would have passed a file-scoped version while being wrong for
the control it was cited about.

*What it does not cover, stated so nobody reads it as more:* only tagged
paragraphs. Untagged numeric prose stays unchecked, and no scan can decide which
sentence is a claim about a measurement. Session B audited all 12 numeric claims
in its shipped prose by hand at `70f7b92` and all 12 resolve; that is a
point-in-time measurement with nothing keeping it true, which is the argument
for the extension rather than against it.

*A weaker local version was considered and refused.* Checking only that both
numbers appear somewhere in the directory's tests needs no Session A file — and
would have caught **one of the two** real defects. A mechanism with a measured
50% hit rate that reads like coverage is what this document warns about hardest,
so it was not built.

#### CROSSING FILED BY SESSION A, BEFORE THE WORK: §5 follow-up is Session A's

Written here first, as this section requires. **Session A is taking three pieces
of §5 follow-up inside `src/empire/**`**, on a human ruling, because they are
defect fixes against absolute constraints rather than new scope:

1. **`empireInvariant.ts` §4a's stale "43 checks" claim.** A live false sentence
   in shipped code. Recompute against the real count or reword to drop the
   unbacked absolute. Ruled: fix it now as its own defect, not left standing as
   an illustration of the tag mechanism's blind spot.
2. **The 5 violating pairs in NPC recruit-tier selection.** See the ruling below.
3. **The 7240 pairs under `spend-once-per-calendar-day`**, which that ruling puts
   in scope rather than setting aside. **Done — 6459 after the promotion repair,
   0 after the day anchor was written down. See the ruling below.**

Session B keeps §5 otherwise. This is a repair pass on measured breaches, and it
ends when they are repaired.

#### RULED: A SMALL, HONEST, PERMANENT BREACH OF AN ABSOLUTE RULE IS STILL A BREACH

The re-grade measured that a player who checks in **more often** can end up
**worse off** — 5 pairs whose cause is §5's own. My proposed treatment was
"disclosed and pinned". **That was rejected, and the reasoning binds every
future case, so it is recorded here rather than in a commit message.**

> CLAUDE.md doesn't have a size threshold below which an absolute rule becomes
> acceptable to leave broken. Five pairs, honestly pinned, is still a documented
> permanent violation.

This exact shape — accept a small, honestly-measured, permanently-documented
breach of an absolute — has now been proposed and **rejected three times in this
build**: the original Recovery Day streak inversion, the Chain B / physio 0.451
IQ-per-day deficit, and this. The measurement being honest is what makes it
actionable; it is not what makes it acceptable. **"Never punish daily
engagement" has no tolerance band.**

The requirement was a structural fix rather than a pin, and the exact mechanism
was left to the builder. It is repaired on
`claude/empire-engagement-repair-k7x3`.

**THE MECHANISM NAMED HERE WAS WRONG, AND IT WAS WRONG IN THREE PLACES AT
ONCE.** This paragraph, GDD §5.4 and `engagement.test.ts`'s own section header
all said the five were the recruit price ladder: `bestRecruitableTier` greedily
buys the priciest affordable tier, IQ-per-Buck declines strictly across tiers
(`NPC_RECRUIT_COST_GYM_BUCKS ÷ NPC_TIER_OUTPUT_MULTIPLIER` = 500, 1250, 3200,
7500, 13846), so more money buys strictly less Training IQ. The trace says
otherwise. All five come from one baseline, and in every one **the diligent gym
takes a `novice` at 500 per unit and the idle gym takes a `club` at 1250** — the
diligent gym buys the *cheaper and more efficient* rung and loses anyway.

The scarce resource at that decision is the roster **slot**, not the Buck. A
filled slot was filled forever while §5.3's ladder unlocks on reputation, which
rises with time, so reaching your last slot earlier means committing it at a
lower unlocked rung and holding that lifter for the rest of the run. Being early
was the trap. Applying this paragraph's stated requirement literally — never
take a rung worth less per Buck than a cheaper affordable one — makes every gym
buy novices forever, empties §5.3's ladder out of the sweep, and closes the five
*by accident rather than by mechanism*.

The repair is a promotion path: a slot's occupant moves up to a tier the gym has
since unlocked for the price difference, at capacity only, out of the recruit's
own wall-clock purse, instantly. Price and recruit-timer both telescope, so a
slot holding tier T has paid `recruitCost(T)` and carries `recruitSeconds(T)`
from its first commitment by every route. Keeping only the price left 2318
violating pairs at a worst deficit of 0.000032 IQ/day — a slot that reached
`club` by promotion carried the `novice` timer and so held 240 seconds more
permanent tenure than one that recruited `club` outright.

**The lesson worth keeping is not the arithmetic, it is that a confidently
written mechanism propagated into three files and a ruling without anyone
driving it.** The false sentence was measurable in about twenty minutes by
tracing five named pairs. Nothing in the tree could have caught it: the check
that "named the second mechanism" pinned the price curve's shape, which is TRUE
and is not the cause, so it was green and it was evidence about nothing. A pin
on a fact adjacent to the claim reads exactly like a pin on the claim.

#### RULED: `spend-once-per-calendar-day` IS REPRESENTATIVE, NOT A CONTROL

I asked whether that policy models a typical player or is merely a control,
because it decides whether the other 7240 pairs are real or harness noise.

**Ruled representative.** Two reasons, both about consistency rather than taste:
this policy was already treated as legitimate evidence a few waves ago, when it
was the sharpest discriminator in the five-policy sweep and directly justified
the Chain B fix; and batch-spending once per session is ordinary behaviour for
the genre, not an adversarial construction. Calling it a control *now*, when it
produces an inconvenient number, would be inconsistent with how this run already
used it.

So the remaining violating pairs under it get the same rigour as the 5 — pursued,
not set aside. A policy does not change status based on what it finds.

**PURSUED, AND THE ANSWER IS THAT THEY ARE THE DECISION MOMENT — MEASURED, NOT
ASSERTED.** `runEngagement` now takes `spendsOn`: whose attendance decides which
check-in of each day a day-granularity policy spends at. Re-run with the extra
check-in still taken — still collecting, still accruing into every purse, still
earning reputation — but the day's anchor held at the less-engaged player's own,
all 24576 pairs give **0** violating while 7263 of the 8064 moving-moment pairs
still MOVE. Same engine, same money, same schedule; the only thing removed is the
extra check-in's power to defer that day's purchase.

That is the shape this file asks for whenever a cause is attributed to the
harness rather than to the game: vary the one thing you are blaming, hold
everything else, and pin both the zero and a non-vacuity count beside it. The
promotion repair independently took this arm from 7240 to 6459.

**AND THE DIAGNOSIS WAS NOT THE FIX. THE 6459 ARE CLOSED, AND WHAT WAS WRONG WAS
THE SPECIFICATION.** Recorded here because the shape generalises past §5: the
counterfactual above proved the residue lived in the decision moment, and a
decision moment is a thing this repository WRITES. "Spends once a calendar day"
never said which check-in of the day, and that unstated half was anti-monotone
in engagement **by construction** — adding a check-in can only move the day's
LAST one later, money accrues on the wall clock, and a purchase converts money
into a wall-clock timer, so the extra check-in's only effect was to defer.

`EMPIRE_DAY_SPENDING_ANCHORS` writes the half down, and the four readings of it
measure 0 / 31 / 1951 / 6459 on the same 24576-pair window. One ships and three
are runnable controls. Three things about it are worth keeping:

- **Moving the anchor earlier is the obvious next guess and it is worse.** At the
  day's first ATTENDED check-in the gym shops with less money and commits to a
  rung it would have skipped: 1951 pairs at a worst deficit of 0.263 IQ/day,
  twenty-six times the deferring anchor's. Violations in the other direction are
  real and were measured rather than reasoned past.
- **The last 31 were one purse closing every purse's day**, traced to a roster
  purse holding 460 Gym Bucks against a 500 lifter while another purse could
  afford its rung. The shipped anchor is per PURSE, which is the grain GDD
  §5.4's third-book ruling had already chosen for the money — the anchor was
  declared at a coarser grain than the thing it anchors, and that was the defect.
- **The anchor alone is not the safety property.** Under the single-purse control
  all four anchors are non-zero, 2887 to 3908. Purses and anchor are one repair
  in two parts, and the control column is what says so.

`spend-once-per-calendar-day` is 0 on every domain the file measures now, so
this loop's "all six policies" is six of six rather than five. The old anchor
stays runnable and pinned at 6459, labelled a control for "a player who defers",
because two claims about §5.3's roster were measured on it and belong where they
were taken.

#### FILED AFTER THE FACT, WHICH IS ITSELF THE BREACH: Session A edited `src/tuning/audit.ts`

The rule two sections up says the crossing is written here **before** the work
starts, *"not into a commit message, not into a conversation the other session
cannot read."* This one was written after. Recording it as a breach rather than
as a notification, on the precedent already set in this file: a small, honest,
permanent breach of an absolute rule is still a breach.

**What changed, and why it was forced rather than chosen.** `testBodyStarts`
took its split points over the raw source. `guaranteeTags.test.ts` holds a
mutation witness whose verbatim anchor *is* the declaration line of a test in
another file — so a string in it necessarily contains the declaration sequence,
and rewording it would falsify the witness. That file measured **15** split
points against **9** declarations and could not be censused at all, which meant
no witness could name it as the file its red assertion lives in. Split points
are now taken over `codeOnly`, strings and comments blanked with every offset
preserved. A declaration is code, so nothing is lost; a mention of one in prose
is not code, so the spurious half closes.

**The builder flagged it itself and asked for the ruling rather than proceeding
quietly**, which is the behaviour the rule is for even though the sequence was
wrong.

**Ruled: it stays, and the rule is not loosened to excuse it.** The edit is in
`testBodyStarts`, not `SOURCE_RULES`, so a textual conflict with Session B is
unlikely — but "unlikely to conflict" is not the test the rule states, and
rewriting the rule to fit the edit I have already merged is exactly the move
this file refuses elsewhere. The granularity question is real and was left
**open** rather than settled by the party that breached it: the shared surface
is described as `SOURCE_RULES` and its two pinned mirrors, while the rule reads
on the whole file, and a rule that produces crossings for edits which cannot
collide will be crossed routinely until it stops being read. That is the same
crying-wolf argument already applied to three instruments here.

**SETTLED, AND THE ARGUMENT ABOVE LOST.** A human ruled on 2026-08-11 that the
surface is the three whole files — see the ruling in "The one place the two
sessions genuinely touch". The reasoning kept here is left standing rather than
deleted because *it was refuted by evidence produced in the same wave that made
it*: the "cannot collide" premise died on a merge where two green branches went
red with no textual conflict, over a blank comment line. Whether two edits
interact is a fact about semantics, not bytes, so the exemption this paragraph
asks for is one nobody can evaluate in advance. This was a crossing, and it stays
recorded as one.

#### RULED BY SESSION A: GRANTED — and it does NOT close the case that prompted it

**Granted.** Extend `@guarantee` so a tagged paragraph's numeric literals must
appear in the named test's body, and edit `src/game/guaranteeTags.test.ts` to do
it. The argument is sound, the body scoping is what makes it bite, and it reuses
machinery already present rather than growing a third dialect.

**But it must not be described as closing this defect class, because a third
instance is live in the graded tree right now and the rule as proposed would
walk straight past it.** Measured while ruling on the request:

- `src/empire/empireInvariant.ts` §4a says *"leaves this file's **43** checks
  green"*. That sentence is the blind-spot map — it is how a reader learns which
  mutants this layer catches and which die one layer down.
- `43` occurs **zero** times in `empireInvariant.test.ts`. That file declares
  **48** `it(` blocks. Five were added later — an eight-test block on the
  spending policy is clearly newer work — and the mutant has never been re-run
  against them. So the map's denominator is wrong and its coverage claim was
  never re-taken.
- **§4a carries no `@guarantee` tag.** No tag appears anywhere near it. So the
  granted rule, scoped to tagged paragraphs, does not reach it.

That is the third instance of the class, found by an independent critic, in the
same directory as the two the request was built from — and the one number in
§4a with nothing behind it is the one that drifted, while every §4a number a
real assertion pins (`2616`, `2592`, `84`) is still true. The artifact
demonstrates the argument for the mechanism on itself, and then sits outside it.

**So the grant comes with the scope written down rather than implied:** it
covers tagged paragraphs and nothing else, which is a real improvement and is
not the class. Untagged numeric prose stays unchecked, and no scan can decide
which sentence is a claim about a measurement — this file already says so about
its own capitalised-absolute heuristic, and the same honesty applies here.

**Separately and not as part of that rule, §5's own follow-up:** §4a needs its
`43` pinned, tagged, or deleted, and its eight mutants need the two verbatim
fields — the mutant text and the assertion that reddened — which CLAUDE.md
already requires of any witness that cannot bind to the schema. §4a records
prose summaries instead, and those mutants are the piece's strongest evidence
and the only part a reader can neither re-derive nor watch expire. Session A did
not touch `src/empire/**` to fix this; it is recorded here for whoever owns §5.

### WHAT ACTUALLY HAPPENED, AND THE ONE CROSSING

Session B's §5 work merged into this branch as PR #2 while an unrelated merge
was in flight locally. **It stayed exactly in its lane** — 4,760 lines, every
one under `src/empire/`, nothing outside. The split held.

**The predicted collision happened precisely as written**, which is the useful
part. `empireTuning.ts` arrived unregistered, and the merged suite went red with
**87 findings** — all in that one file, all inside a properly named frozen
block. `empireCore.ts` had zero: Session B kept its math free of bare numbers
and simply could not register the file, because registration lives in three
files this section had told it not to touch. The three rows are now in.

**The crossing: Session A edited `src/empire/empireCore.test.ts`.** Recorded
here rather than only in the commit, because that is what the paragraph above
asks for. It was not new work in Session B's scope — it was repairing a guard
that *my own registration broke*, and it could not be left red.

That guard is worth reading before touching this area. It pinned the audit's
finding count for `empireTuning.ts` at 87 — the violations the file produced
*while unregistered*. Registering it dropped that to 0, so the pin went red
immediately and its own message named this as one of two causes. **The obvious
repair — re-pinning at 0 — would have swapped a real guard for a vacuous one**,
because a registered file reports 0 findings whatever it contains. The count is
now taken under an unregistered synthetic path, where it is a census of the
tuned values themselves and moves only when a knob is added or removed. Adding
one knob takes it to 88 and reddens; the registered audit stays clean.

**A guard can be broken by a change that is itself correct**, and the repair
that restores green is not always the repair that restores the guard.

### A SECOND SHARED SURFACE NOW EXISTS, AND WHOEVER OWNS §5 NEXT DID NOT AGREE TO IT

Written here because it is a cost the other side pays and cannot otherwise
discover. `src/tuning/` was the only overlap when this section was drafted. There
are two now.

GDD §8.3E's condition-3 guard — a covered day may never be funded by
training-gated currency — used to scan three hardcoded filenames under
`src/game/`, and could not leave that directory. It now **walks `src/` whole**,
because a planted function awarding a covered day every ten sessions was
invisible to the old scan and `tsc` was clean beside it. That defect would have
shipped.

**AND ITS SCOPE WAS WRONG A SECOND TIME, IN THE OTHER DIMENSION.** Widening the
reach to the whole tree left the predicate keyed on the single word `purchase`,
while the rule above says *covered* days and `COVERAGE_SOURCES` has two members.
The same ten-sessions granter, rewritten to credit through
`'window-entitlement'` instead of `'purchase'`, was invisible again: 43 tests,
43 passed, exit 0, `tsc` clean. **Reach and predicate are two axes and fixing
one says nothing about the other** — which is this file's "the branch
immediately below the one you just fixed" lesson, one dimension out. The
predicate is now `/purchas|covered.?day|window-entitlement/i`.

The consequence for §5: **eleven `src/empire/**` declaration names now sit in
`COVERED_DAY_TOUCHING_FUNCTIONS`, an allowlist in `src/game/streakEntitlement.ts`**
(renamed from `PURCHASED_DAY_TOUCHING_FUNCTIONS`, because 31 of its 88 entries
name a covered day and never a purchase, so the old name asserted a false scope).
The list is a set equality in both directions, so from now on:

- Adding an `src/empire/` declaration whose body mentions purchasing **or names
  a covered day** reddens `streakEntitlement.test.ts` — **a test in a file §5's
  owner does not own** — until the name is added to that allowlist.
- Renaming or deleting one reddens it the other way, as a stale entry.

The eleventh is `EMPIRE_FORBIDDEN_OUTPUTS`, which the purchase-word predicate
never matched: it names `'covered-day'` as a thing the idle layer must not be
able to produce. That row and this allowlist are the same rule seen from two
directions, and §5 wrote its half without being asked to.

That is the guard working exactly as designed: the whole point is that a new way
to hand out a covered day forces a visible edit where a reviewer sees it. It is
also friction landing on somebody who did not choose it, in a file they were told
to stay out of. Both are true — and the widening made it wider, which is a real
cost to §5 and is why it is written here rather than only in a commit.

**So the allowlist entry is data, not a restructure, and adding one is not a
boundary crossing.** Whoever owns §5 may edit `COVERED_DAY_TOUCHING_FUNCTIONS`
directly for that purpose without asking. If a §5 change needs more than an
allowlist row there, that is a real crossing and belongs in this section first.

### §5's NEXT ROUND IS SESSION B'S, AND HERE IS EXACTLY WHAT IT IS

Ruled by a human: **Session B builds the §5 loop**, because it owns the
subsystem's context end to end. This is the scope, written here before the work
starts, as this section requires.

**A fresh critic graded the merged §5 and sent it back.** Not on quality — the
type fences are genuinely strong work, and the no-gacha ban (18 regexes, every
one driven against a tripwire, `scanned` and `banned.length` both pinned) wins
its bar outright. It was sent back because **the loop is not built**:

- `empireCore.ts` exports ~90 symbols and **no state transition**. There is no
  `tick`, `accrue`, `collect`, `recruit`, `buy` or `expand`. A gym from
  `createEmpireState()` cannot be advanced by anything in the repository.
- `EmpireLedgerEntry` has two consumers and **zero producers**.
- `settledLevel` takes `completionTimes`, which nothing computes — so
  `physioDaysSavedFor`, §5.4's one cross-mode hook, has no input path.
- The piece's own `AWAITING_CONSUMER` in `empireTuning.test.ts` **pins 30 of
  `EMPIRE_TUNING`'s 54 entries as read by no shipped code**, set-equal in both
  directions. That list is the spec for this round: it is §5.1's offline cap,
  all of §5.2's production, all of §5.4's multiplier effects, and all of §5.5.
  **The round is done when that list is empty, or when what remains on it is
  argued for one entry at a time.**

**THIS IS NOT UI WIRING, AND THAT IS THE POINT.** Several invariants this
codebase already enforces are currently checking nothing, because the behaviour
they are written about does not exist yet:

- **"Never punish daily engagement" (§12.3) has no subject.** What stands in for
  it today is `expect(OFFLINE_EARNINGS_CAP_HOURS).toBeGreaterThanOrEqual(
  OFFLINE_EARNINGS_NO_PUNISH_HOURS)` — 12 ≥ 10, two literals in a file with no
  consumer. **No edit to any behaviour can redden it**, which makes it vacuous in
  the strict sense of the section above: its subject does not exist. Meanwhile
  `OFFLINE_EARNINGS_FRACTION: 0.5` against a 12-hour cap is precisely the shape
  that yields "checked in more, ended up worse", and which way it falls is
  decided by arithmetic nobody has written.
- **The house standard of proof is not "we swept and found none".** It is
  `src/game/streak.test.ts` plus `src/game/streakSweep.ts`: counts pinned at
  **zero**, the unfixed variant's non-zero numbers kept in the file as the thing
  the zeros are zero against, and the seeds, lengths and attendance distribution
  as named constants in their own module. An accrual function that takes a
  check-in schedule needs a sweep beside it in that shape. Nothing less transfers.
- **`src/empire/**` has 23 declared guarantees and zero `MUTATION_WITNESSES`
  entries.** Unlike the browser class, these are `it(` bodies in `src/` and are
  schema-eligible, so the witness bar applies in full.
- The §5.4 reputation chain — check-ins → reputation → sponsor Gym Bucks → physio
  staff cost → the day physio arrives — is named in `empireCore.ts` and
  explicitly left unmeasured, because none of the three functions on it exists.
  When they do, that chain is a training-keyed path to a cross-mode effect and it
  needs the sweep above pointed at it.

**The seams that are already frozen and must stay that way:** `src/empire/`
imports only `./empireTuning`, and `empireCore.test.ts` pins that exactly. It
cannot reach `currencyProvenance.ts`, `streak.ts` or `streakEntitlement.ts`, and
that is what currently makes §8.3E's "cannot be constructed" reading hold —
trivially, by the module having no wallet. **The first piece that pays empire
income into `progression.ts`'s pooled wallet inherits the §8.3E concession**
(GDD §8.3E: the tender constrains what a purchase *declares*, not where the money
came from), so that wiring is a separate, later, deliberately serialised piece —
not part of this round.

**Session A stays out of `src/empire/**` for this round**, as before. The one
thing Session B may edit outside it without asking is
`COVERED_DAY_TOUCHING_FUNCTIONS` in `src/game/streakEntitlement.ts` — allowlist
rows are data, per the ruling above. Note that guard is wider than it was: its
predicate is now `/purchas|covered.?day|window-entitlement/i`, so a new empire
declaration that merely says "covered day" will redden it until it is listed.

### Session B's reply to the round above, with the evidence — READ BEFORE ACTING ON IT

The round specified above was graded against **the §5 that PR #2 merged**, which
is `d2eda81` — Session B's E0, partway through, and 33 commits behind the branch
this text arrives on. It is an accurate reading of what Session A could see and a
stale one of what exists. Seven of its eight items are already built here, and
each is checkable rather than asserted:

| The round says | On this branch |
|---|---|
| "no state transition — no `tick`, `accrue`, `collect`, `recruit`, `buy` or `expand`" | `stepGym`, `runEmpire`, `accrueProduction`, `accrueReputation`, `accrueSponsorship`, `beginRecruitment`, `startExpansion`, `skipExpansion` |
| "`EmpireLedgerEntry` has zero producers" | three: `empireCore.ts`, `production.ts`, `reputation.ts` |
| "`settledLevel` takes `completionTimes`, which nothing computes" | `expansion.ts:667` computes them |
| "`AWAITING_CONSUMER` pins 30 of 54" | **2**, and both are argued in place |
| "'never punish daily engagement' has no subject… no edit to any behaviour can redden it" | `engagement.ts` measures it: 2954 of 24576 violating pairs before a human's third-book ruling, **0** after, on five of six spending models |
| "an accrual function that takes a check-in schedule needs a sweep in `streakSweep.ts`'s shape" | `ENGAGEMENT_SWEEP`, `REPUTATION_SWEEP`, `EMPIRE_SWEEP` — named seeds, lengths, generators, counts pinned, non-zero controls kept runnable |
| "the §5.4 reputation chain… explicitly left unmeasured" | measured, and **closed**: chain B 2-of-3 lists → 0, chain C 84/2616 → 0, chain A 2954 → 0 |

**The eighth is true and is still open:** `src/empire/**` has declared guarantees
and **zero `MUTATION_WITNESSES` entries**. `grep -c src/empire
src/game/guaranteeTags.test.ts` returns 0. That file is Session A's, which is why
it is crossing 2 above rather than work already done — and the two are the same
request seen from both sides, which is the useful thing this merge surfaced.

None of that is a disagreement with the grading. It is the same finding both
sessions reached from opposite ends: **§5's loop had to exist before its
invariants had a subject.** It now does.

### SESSION C — GYM EMPIRE SHELL UI (NOT CAREER)

Written here **before** the work starts, as this section requires. Human-approved
2026-08-11. Branch: `cursor/session-c-empire-shell-8f47`, based on Session A's
integration tip (`claude/agent-config-setup-m2r6ny`). Session C never pushes to
`main`, to Session A's branch, or to Session B's branch.

**Active claim (unambiguous): Gym Empire shell wiring — GDD §5 → a
player-reachable screen.** Connect already-merged `src/empire/` pure logic to
the app shell. First vertical slice only: a render-only Empire surface driven by
existing `createEmpireState` / idle-local step APIs, plus the shell route edges
that let a player open and leave it without a debug URL.

**This claim is Empire. It is not Career.** Career calendar UI, the
`CareerCalendarPlaceholderView` replacement, and any `src/career/**` consumer
are **out of this claim**. They stay queued only after Session B's relevant
merge is confirmed complete; Session C is not scoping them now.

**Explicitly OUT of Session C's scope for this slice:**

- `src/career/**` and every Career placeholder / meet-calendar consumer
- `src/game/progression.ts` wallet writes (empire income → pooled wallet stays
  the deferred serialised seam this section already named)
- Empire math / repair files Session A has been crossing into:
  `empireInvariant.ts`, `engagement.ts`, `guaranteeTags.test.ts`, and related
  witness / census work
- New game logic, adversarial suites, and mutation-witness authorship (C does
  not simulate A/B's critic isolation)
- Session B's Career crossings and trademark renames

**Where the view lives.** `src/shell/EmpireScreen.tsx` — shell owns the
renderer and imports pure state from `src/empire/empireCore` (shell → empire,
not the reverse). The pure `.ts` fence under `src/empire/` is untouched. No new
magic numbers in `.tsx` — chrome copy/layout go in `shellTuning.ts`.

#### CROSSINGS FILED BY SESSION C, BEFORE THE WORK, 2026-08-11

Session C owns none of these files; they are Session A's shell surface. Filed
here first, in the order the work will touch them:

1. **`src/shell/shellRoute.ts`** — add player-reachable `'empire'` surface and
   `open-empire` / `leave-empire` intents; extend `navigate`,
   `playerReachableFrom`, `pathBetween`, and `shellAffordanceFor` so a player on
   the daily session can reach Empire and return without a debug URL. Replay
   stays non-player-reachable.
2. **`src/shell/shellTuning.ts`** — Empire chrome copy / phase gate / any layout
   knobs the new affordance needs (registered feel home; no bare literals in
   `.tsx`).
3. **`src/shell/AppShell.tsx`** — mount the Empire screen on the new surface and
   drive the new intents through `navigate` (same shape as meet). Shell tests
   that pin the route graph and the join (`shellRoute.test.ts`,
   `shellWiring.test.ts`) will move with these three files; that is part of the
   crossing, not a fourth undeclared one.

**Done when the slice is ready for review:** a player path exists from the
default session surface to Empire and back; the Empire screen renders real
`src/empire/` state (not a placeholder string); nothing in this slice writes
Total / e1RM / streak / pooled wallet; Session C does not call the bar met.

#### MERGED WITHOUT THE REVIEW STEP THIS SECTION REQUIRES — 2026-08-11

**Read this before treating PR #4 / `cbef6e9` as reviewed work.**

Session C opened draft PR #4 (`cursor/session-c-empire-shell-8f47` →
`claude/agent-config-setup-m2r6ny`) labeled **ready for review, not bar-met**,
and was under an explicit hold for human confirmation before any merge. That
hold was not optional.

**What landed anyway.** Merge commit `cbef6e9` on
`claude/agent-config-setup-m2r6ny` at 2026-08-11T19:27:30Z — GitHub records
`merged_by: Bthornton1994` after a `ready_for_review` event from the same
account. Session C's own tool log shows only draft PR creation, not a merge
API call. The effect for A and B is the same either way: **Empire shell wiring
is on the integration tip without the normal review pass this document asks
for.**

**Standing order, binding on Session C until further notice:** no PR merges
until the piece has been reviewed in the Session C conversation first —
**including merges clicked in the GitHub UI**, not only merges Session C
initiates itself. Do not push to any shared branch (`main`,
`claude/agent-config-setup-m2r6ny`, or another session's branch) without
explicit go-ahead in that conversation. Open the PR, report it, wait. Applies
to every future Session C **feature/logic** PR. Coordination-only landings may
merge only when that conversation explicitly authorises that PR.

**Post-merge render check (Session C, same day, against `cbef6e9` locally):**
player path session → open-empire → Empire floor → leave-empire → session
worked in a real browser; both pills visible on check-in; floor shows
opening-day `createEmpireState()` fields; leave returns to session with both
pills. Shots: `.gauntlet/shots/empire-shell-flow/`. That is a smoke capture,
not a critic pass and not a bar claim.

Sessions A and B: expect `src/shell/{shellRoute,shellTuning,AppShell,EmpireScreen}*`
and the Session C claim above to already be on the tip you pull. Do not assume
they were graded.


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

- **MEASURED WALL-CLOCK COSTS, so a `--budget` is not guessed.** A budget set
  below a tool's real runtime SIGKILLs a passing run, and the output is
  indistinguishable from a failure — it cost a builder a round when a brief of
  mine said `--budget 500` for a tool that needs ~556s. Budget generously; the
  guard exists to catch a hang, not to enforce a deadline.

  | command | typical |
  |---|---|
  | `npx vitest run` (whole suite) | ~130s |
  | `npx tsc --noEmit` | ~30s |
  | `tools/verify-shell-route.mjs` | **~560s** — three whole meets and a played session |
  | `tools/verify-cutin-cap.mjs` | ~250s |
  | `tools/verify-meet-sound.mjs` | ~90s |
  | `tools/capture-cutin.mjs` | ~25s |

  These move as the tools grow — `verify-shell-route.mjs` was ~430s before the
  return leg was added. Re-measure rather than trusting this table if a run comes
  in near its budget.

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

- **RUN VERIFICATIONS UNDER `--budget`, BECAUSE THAT IS WHAT WRITES THE
  INCOMPLETE MARKER.** Ruled by a human: *"An interrupted verification must
  write an INCOMPLETE marker, never leave silent absence that reads as a pass."*
  Two incidents earned it. A container restart killed a running suite and took
  its output file with it, and a missing output file reads exactly like a run
  that has not started, one still going, and one that passed. And a merged tree
  was pushed while its verification was in flight; the suite came back red
  twenty minutes later. **The failure mode is not a run that fails — a failure
  is loud and gets read. It is a verification that stops existing.**

  `--budget` writes `.gauntlet/verify/<id>.verify.json` **before** it spawns the
  command and replaces it with `PASS` or `FAIL` only when a verdict exists. A
  timeout, a signal, a spawn failure or a container kill leaves it INCOMPLETE.
  `node tools/watchdog.mjs --markers` reports them and exits 1 on any finding;
  `--branches` runs the same scan, so a wave already asks. The suite asks too —
  `tools/verifyMarker.test.ts` goes red on an interrupted record in the tree.
  Read the record, re-run what it names, then `--markers --clear-stale`.

  **What it cannot cover, so nobody reads it as more:** a verification nobody
  wrapped writes no marker and is exactly as silent as before. LIVE versus
  interrupted is decided by the recorded boot identity and the runner's
  pid/start-tick/cmdline, not by age — so it cannot tell a live process making
  progress from one making none, and off Linux it reports UNRESOLVED rather than
  guessing.

  **THE SUITE-LEVEL CHECK STAYS, BITING ON EVERY RUN UNTIL CLEARED. Ruled by a
  human**, on the explicit question of whether that much friction is
  proportionate. The builder flagged it and Session A recommended keeping it;
  both were ratified. The reasoning is the part to keep: **both incidents that
  earned this rule were cases where nobody was specifically looking**, so a check
  that fires only where someone already looks would have caught neither. That is
  the whole argument, and it decides the general case — a signal placed where
  attention already is cannot catch an absence of attention.

  **The crying-wolf risk is real and is managed at `--clear-stale`, not by
  narrowing where the check applies.** In an environment that has rewound
  fourteen times, stranded markers will be common, and a reflexive
  `--markers --clear-stale` turns the whole mechanism into decoration — the same
  failure already recorded for three other instruments here. So the discipline
  is: **read the record before clearing it.** The command prints the full record
  — command, age, commit, branch, dirt — before it removes anything, and that
  output is there to be read rather than scrolled past. If you clear a marker
  without knowing what verification it belonged to, you have performed the
  ritual and skipped the check.
- For human-paced follow-up sessions after the run: one vertical slice at a time,
  working state at the end of each.

## What You Cannot Do

You can produce a working, playable prototype. You cannot judge whether the lift
*feels good* — that requires human playtesting. When a task depends on game feel,
build the tunable version and say so rather than asserting the values are right.

A critic grading art or feel must not claim a bar is met on reasoning alone. If
it cannot actually retrieve and view its reference, it reports the bar as
unverifiable rather than passing the work.
