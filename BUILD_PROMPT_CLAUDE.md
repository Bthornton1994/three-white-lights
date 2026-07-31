# BUILD_PROMPT_CLAUDE.md

## Preflight

**1. Place the files.**

```
CLAUDE.md                      # repo root
docs/GDD.md
.claude/agents/builder.md
.claude/agents/critic.md
```

Confirm with `/agents` that both subagents are registered before starting.

**2. Permissions.** An unattended run will stall on approval prompts. You'll want
permissions relaxed — but do it in a container or a throwaway worktree, not on
your main machine with your real credentials sitting around. Bypassing
permissions means an agent can run arbitrary commands for hours while you sleep.
That is a real risk, not a formality.

**3. Network access.** Critics compare rendered output against real 16-bit sprite
work, real federation result sheets, and real meet footage (GDD §12.2). Confirm
`WebSearch` and `WebFetch` actually work, or pre-download references into
`docs/reference/` and repoint the bars at local files.

**4. Worktrees.** Parallel builders on one branch will collide. Have the lead
agent use git worktrees per builder.

**5. Verify critic independence.** Spawn two builders in parallel, have each
write a random token to its own scratch file, then spawn a critic and ask whether
it can see either. If it can, the critics aren't independent and the loop quietly
degrades into self-grading. Five minutes now saves nine hours.

**Optional — hooks.** This is Claude Code's real edge for this run. A `PreToolUse`
hook can block writes that introduce a banned pattern, so §12.3's refusal
conditions are enforced mechanically rather than trusted to a critic's memory.
Worth wiring for at least the cheapest checks: a visible fatigue meter, any
random-roll NPC recruitment, any purchasable item touching Total or e1RM.

---

## The prompt

Paste this and leave it alone. Resist adding architecture, file layouts, or a
task list — the lead agent decides the route.

```
Build the powerlifting game specified in docs/GDD.md. Read it fully first,
along with CLAUDE.md.

React Native + Expo, TypeScript. 16-bit SNES/Genesis pixel art, all assets
generated in code or as sprite data — no placeholder stock art.

Run this as a Gauntlet Loop. Break the goal into the smallest pieces that can be
improved and judged independently — you decide the decomposition.

For each piece: dispatch the builder subagent to build it, then a fresh critic
subagent to grade it. Never let a builder grade its own work, and never pass a
builder's transcript or summary to its critic.

The bars are in GDD §12.2. Critics inspect the real artifact — rendered pixels,
the running app, actual test results — and compare blind against the bar where
possible. When ours loses, take the single biggest gap the critic names and send
it to a builder. Keep looping. No fixed round count.

If a critic cannot retrieve its reference material, it reports the bar as
unverifiable. It does not pass the work on reasoning alone.

GDD §12.3 lists hard refusal conditions. Critics enforce them regardless of how
good the work otherwise looks.

Every game-feel value — timing windows, animation curves, haptic patterns — must
be a named constant in one place. These get tuned by hand afterward. Do not bury
them.

Use git worktrees so parallel builders don't collide.

Run a fresh critic as a smoothing pass at the end of each wave, inspecting the
whole artifact for coherence across separately-improved pieces.

Maintain a live progress page I can open on my phone, updated as you work —
screenshots, test results, current bar status per piece.

Think hard about the decomposition before you start.
```

---

## During and after

**Watch, don't steer.** Open the progress page. Mid-run corrections collapse the
loop back into human-paced iteration, which is the thing you were trying to skip.

**Stop when you like it,** not when it finishes. Against bars this high there is
almost always another gap to close.

**Then do the part that was never automatable.** Put the build in front of real
lifters and non-lifters. Tune timing windows and haptics by hand until grinding a
heavy squat out of the hole is satisfying on its own. Budget ~30 iterations.
This is not a failure of the run.
