# V2-S2b — the gym view: sessions and equipment, the stage-2 gate's instrument

Repo worktree `/home/user/wt-s2b`, branch `claude/v2-s2b-view`, base `c8db0b7`.
Read in full, in order: `/home/user/wt-s2b/CLAUDE.md` (the v2 coordination
entry, the E37–E39 `.tsx`-arrival lessons, and *The Form That Survived*),
`docs/GDD.md` §5 (v2) — §5.4, §5.5, §5.11 stage 2 and the stage-1 gate record
— and this brief.

## What exists, so you extend rather than rediscover

`src/empire/ladderView.tsx` is the stage-1 gate's instrument, still the shape
to copy: render-only, imports no react (the `react-jsx` transform supplies it
ambiently, so the fence holds unwidened), every displayed quantity computed
by a pure function, the reducer lives OUTSIDE this directory in
`ladder-dev.tsx` at the repo root. `sessions.ts`'s composed surface —
`createGymState`, `gymCheckIn`, `buySessionEquipment`,
`buyLadderEquipment`/`moveUpLadder` (inherited), `resolveWeek`,
`weeklyAttributeEffects`, `requireWeekAllocation`, `trainingWeekShape`,
`availableActivities` — is what the view composes. Read `sessions.ts`'s
header in full before touching anything; it states the crown-invariant design
and the fatigue-seam contract you must not violate from a view.

## The deliverable

Extend `ladderView.tsx` (or add a sibling `gymView.tsx` that supersedes it as
the dev mount's root — your call, argue it in the report) into a playable
view of the FULL stage-1+2 loop: check in, watch ladder accrual land, buy
Barbell AND the new equipment groups, relocate, and — the new part — set a
weekly allocation across the three flexible slots and see the week resolve:
which slots trained, which rested, which asked for equipment you don't have
(named, per `resolveWeek`'s `unequipped` arm), and the attribute effects that
landed.

**No new game logic in the view.** Every number comes from `sessions.ts`. If
you need a helper (e.g. "how many seconds until the next week boundary"),
that helper lives in `sessions.ts`, exported, the same move `ladder.ts` made
for `ladderCheckInAfter`/`ladderDevTimeSteps`.

## The play-through's bar — write it INTO the view's header, stated as the
## question the gate answers, same form `ladderView.tsx` already uses

Two questions, and they are not generic — they are what stage 2 was built to
answer, and the human ruled the build should proceed exactly to test them:

1. **Does the new equipment close the felt emptiness of the strip-mall→
   warehouse stretch?** The stage-1 play-through measured that stretch as
   ~38 consecutive check-ins with nothing to buy after the rack — a decision-
   density problem, not a pacing one. Stage 2's items were priced against
   that measured band. The view must let a human FEEL whether purchases now
   land inside that stretch, not just confirm they exist in the tuning table.
2. **Does weekly session allocation read as a real recurring decision, or
   another flat number?** The allocation happens once per week, repeatedly,
   for the life of a save — so the view must make WHICH WEEK it is and
   WHETHER THE PLAYER HAS ALREADY ALLOCATED THIS WEEK legible at a glance, or
   the human cannot judge whether it's a decision or a chore.

State both verbatim (or near it) in the module header's opening paragraph,
the way `ladderView.tsx`'s header names its own gate question. That is not
decoration — it is what makes the render test's own header honest about what
it covers and what only the human can judge, per the house rule this
directory already follows.

## The dev time control, extended

Stage 1's control (+1h / +8h / +3d) stays. Add a control that advances to the
NEXT WEEK BOUNDARY in one press — a human trying to feel "is this a weekly
decision" needs to jump between allocation points without grinding every
intermediate check-in. Compute the boundary from `trainingWeekShape()` /
`EMPIRE_TUNING`, not by hand. Keep every control visibly labelled as dev-only,
per S1b's convention.

## The arrival — this file is not new to the walk, so most of this is bookkeeping now

Unlike S1b, `.tsx` is no longer the first arrival — the censuses already have
rows for `ladderView.tsx`. Extending it (or adding a sibling) still moves
counts: string census (new visible copy — sign every chunk into
`SIGNED_JSX_TEXT_CHUNKS` as an EXACT LIST, the S1b precedent, not a count),
instrument B (new component export invoked, its element tree walked),
instrument A if any new prop type introduces a string position, the channel
census if any new callback axis appears, and the magic-number audit (zero
bare literals — every number through `sessions.ts`/`ladder.ts`/
`EMPIRE_TUNING`, including any new dev-control increments). If you add a
SIBLING file rather than extending `ladderView.tsx`, it is a second `.tsx`
arrival and gets the full E38 treatment (walk, fence row, all censuses) —
say which you chose and why in the report.

## The render test

Same standard as S1b: compare displayed QUANTITIES to the pure functions'
outputs for the same state — money, rates, costs, the week index, EACH
SLOT'S resolved outcome (including the `unequipped` arm's named requirement),
and the attribute-effect numbers. Presence is not the bar; the quantity is.

## Do NOT

- No new logic in the view; no reimplemented transitions.
- No new npm dependencies.
- No person-shaped or real-name copy.
- No `src/shell/**` wiring, no route — this is still a dev-served view.
- Do not touch stage-1's play-through-ruled decisions (equipment travels;
  the accepted decision-density gap) — those are settled, not reopened.

Everything else per CLAUDE.md: hard exclusions unchanged (`src/game/**`
read-only, `src/shell/**`, `tools/**`, `vitest.config.ts`, `tsconfig.json`,
`src/tuning/**`, etc.), commit after every coherent step, mutants planted
alone and restored byte-identical, `TREE_WIDE` discipline (guarantees route
the bump, method notes reword and disclose), 600000 ms timeouts, `-t` filters
to iterate, the streakEntitlement EXHAUSTIVE flake is not yours.

Setup:
```
git -C /home/user/three-white-lights worktree add /home/user/wt-s2b -b claude/v2-s2b-view c8db0b7
ln -s /home/user/three-white-lights/node_modules /home/user/wt-s2b/node_modules
```
Delete `V2S2B_BRIEF.md` from the worktree root before your final commit.

## Report

Which file structure you chose (extend vs. sibling) and why. The two gate
questions as they appear in the module header, verbatim. The week-boundary
dev control and its derivation. Every signed census row, by census. The
render test's quantity comparisons, including the `unequipped` arm. Every
mutation with its catcher. Suite + tsc exit codes. The one-command serve
path, reconfirmed. The single biggest thing you did not finish, in the
mechanism's own terms.
