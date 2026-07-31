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

## Code Conventions

- TypeScript strict mode, no `any`
- Prefer pure functions and explicit return types in game-math modules
- Reanimated 3 for animation; Skia for bar-path and rep rendering
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
