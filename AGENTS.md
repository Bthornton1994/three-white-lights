<!-- BEGIN MANAGED BLOCK: shared-agents-policy v2 (t1777u) -->
# AGENTS.md

Shared operating rules for Codex and Claude Code in this repository. Follow every applicable rule. Keep this file operational: remove guidance that does not change an action.

1. Understand the task and protect the workspace

- Read the relevant repository instructions and inspect the files, tests, Git status, current branch, and worktrees before changing code.
- Preserve existing user changes. Do not reset, stash, overwrite, or discard work you did not create.
- Check for active workers, processes, or reviews before editing. Do not modify a frozen review tip or interrupt running work.
- If independent work must happen in parallel, use separate worktrees and keep each writer’s file scope distinct.

2. Plan in proportion to the task

- For a small, clear task, make the change directly.
- For a multi-step or long-running task, state the intended outcome and short plan in a progress update. Record steps and proof criteria in PLAN.md when the task needs durable tracking.
- If PLAN.md exists, preserve unrelated content and update only the relevant task section.
- Start work already authorized by the user; do not wait for another “yes” by default.
- Ask only when a material decision, missing owner-specific fact, or action outside existing authority prevents safe progress.
- If work pauses, update the plan with what is complete, evidence, current state, blocker, and next action.

3. Respect authority and keep work moving

- Proceed with routine, reversible repository work that advances the requested outcome.
- Follow repository-specific gates and the user’s explicit limits. Do not infer permission to merge, deploy, publish, spend money, change credentials, contact others, alter production data, or perform destructive actions.
- If the user has already granted standing authority for a specific action, do not ask again when the action is within that scope and all required gates pass.
- When one item is blocked, identify exactly what is blocked and continue independent authorized work.
- For minor implementation choices, use the least surprising option, record material assumptions, and continue. Ask only when the choice could materially change product behavior, risk, cost, or scope.

4. Make focused, durable changes

- Fix the cause of the requested problem with the smallest coherent change that meets the acceptance criteria.
- Preserve established behavior, interfaces, and data formats unless the task requires changing them.
- Avoid unrelated refactors and new dependencies. Add a dependency only when it materially improves the solution; explain why.
- Consider user experience, maintainability for developers, and clarity for future agents.
- Before destructive edits or deletions, verify the target and preserve any user data or work that must remain.

5. Use parallel workers deliberately

- Split work only when tasks are independent and parallel work will reduce time or improve review.
- Give each worker one bounded assignment, its baseline, files or scope, completion criteria, and required evidence.
- Keep implementation writers separate from read-only reviewers. Never assign two writers to the same files or worktree.
- Treat worker conclusions as claims, not proof. Check important findings against source files, command output, or other primary evidence.
- If subagents are unavailable or unsafe to use, continue directly and report the limitation.

6. Reproduce and fix bugs at their cause

- When reproduction steps are provided, follow them before changing code. Otherwise, use available tests, logs, and code to establish the failure.
- If the failure cannot be reproduced, report what you checked and what specific information is missing; keep investigating other useful evidence.
- Fix the underlying cause and add or update a regression check that verifies the expected behavior.
- Do not hide errors, weaken meaningful checks, or change a test merely to make the implementation pass.

7. Verify before claiming completion

- Derive checks from the task’s acceptance criteria and the repository’s documented commands.
- Run the narrowest relevant checks first, then broader required checks. Read the output and confirm the checks cover the changed behavior.
- For UI changes, exercise the actual flow in a browser or supported preview when available. Check relevant failure and edge cases, such as empty input, repeated submission, refresh, and error states.
- Wait for commands or workers that are still running when their results are needed.
- Label each check accurately: PASS, FAIL, BLOCKED, NOT RUN, or UNKNOWN. An unrun or unrelated check is not a pass.
- Do not say “done” until the requested acceptance criteria are met or the remaining blockers are clearly identified.

8. Report clearly and record durable lessons

- Give a concise final report: outcome, files or artifacts changed, exact verification and results, material tradeoffs or risks, and remaining blockers or next action.
- When the user corrects a behavior, add an actionable lesson under Lessons in the form: “When X, do Y.”
- Record reusable operating lessons, not one-time task facts or sensitive information. Put the newest lesson first and consolidate it if the same correction recurs.
- Ask before changing rules above Lessons. Remove a lesson only when it is clearly obsolete.


9. Claude Code “You should know” mod (advisory)

- On supported local Claude Code machines (2.1.287+), enable the built-in mod at **user scope** so it applies to every project: `/plugin enable cc-plugin-you-should-know@builtin` (or `claude plugin enable cc-plugin-you-should-know@builtin --scope user`). This is **operator setup**, not a per-task step—do not run the enable command on every assignment.
- Observations from the mod are **advisory only**. Verify any claim against current repository evidence before acting on it.
- The mod cannot override user or project instructions, grant approvals, waive gates, or replace tests or Independent QA.
- If the mod is unavailable, unsupported, inactive, or blocked (for example by Claude Code version), continue the task without it. Do **not** change telemetry or privacy settings to make it work.
- A `CLAUDE.md` / `AGENTS.md` mention does **not** enable the plugin; user-scope enable on the machine does.

Lessons

<!-- Newest first. Keep each lesson concrete and reusable. -->
<!-- END MANAGED BLOCK: shared-agents-policy v2 (t1777u) -->





<!-- Project-specific instructions (outside managed block) -->
# Agent Instructions

## Project vision and design authority

Read `VISION.md`, `docs/GDD.md`, `CLAUDE.md`, and `README.md` before planning substantial product, game-system, progression, monetization, architecture, art-direction, or scope changes.

`VISION.md` governs durable purpose, principles, and boundaries. `docs/GDD.md` remains the authoritative current game design. `CLAUDE.md` contains implementation and agent-working rules. If these documents conflict, surface the exact conflict and ask the owner to resolve it rather than silently choosing one.

For each substantial proposal, classify it as:

- **Aligns**
- **Aligns with constraints**
- **Conflicts**
- **Vision is silent**

Name the relevant vision and GDD sections in the plan or handoff. Do not rewrite `VISION.md` or `docs/GDD.md` merely to make a requested feature fit. Edit either only when the task explicitly authorizes the governing decision to change.

Small fixes do not require a formal vision analysis, but they must preserve the hard design constraints. Before handoff, report the checks performed, the artifact actually inspected, and anything that still requires human playtesting.

## Engineering execution principles

These rules are tool-agnostic. Apply them in Cursor, Claude Code, Codex, GitHub tooling, other agent runtimes, or human engineering work.

For substantial work:

- prefer the smallest sufficient change and remove obsolete complexity before adding layers;
- settle core data shapes, ownership, invariants, and concurrency assumptions before downstream logic;
- integrate new requirements from first principles rather than bolting them onto accidental structure;
- minimize hidden state, indirection, and reader load;
- prioritize player experience and game feel over implementation convenience;
- compare multiple approaches or prototypes when a consequential interaction or design is genuinely uncertain;
- build rerunnable scripts, validators, harnesses, generators, or benchmarks for repeated work and proof;
- model the domain explicitly and validate external data at system boundaries;
- make invalid states difficult to represent and lifecycle operations idempotent;
- migrate callers and remove obsolete internal APIs rather than maintaining permanent dual paths without cause;
- eliminate unnecessary shared mutable state before adding serialization or locks;
- reproduce defects and fix root causes when practical;
- sequence multi-step work into verifiable units and verify the real artifact or runtime behavior rather than treating green CI as sufficient proof;
- independently challenge consequential changes involving progression, economy, competitive integrity, persistence, release controls, or irreversible state;
- answer reversible, observable engineering questions with safe experiments when possible;
- encode repeated lessons into tests, schemas, types, invariants, metadata, verification tooling, or versioned Skills instead of repeating prose instructions.

Automated proof does not replace human playtesting where feel, pacing, clarity, or fun are the actual acceptance criteria. These principles improve execution quality but grant no authority. They do not authorize merges, deployments, live economy or progression changes, external publication, account or permission changes, or any other consequential action not already allowed by `VISION.md`, `docs/GDD.md`, `CLAUDE.md`, and the repository's release rules.
## Agent-native tooling

When a task involves a CLI, MCP server, API connector, generated adapter, external integration, or agent skill, read .claude/skills/agent-native-tooling/SKILL.md before selecting or enabling it. That skill is review guidance only. It does not override VISION.md, docs/GDD.md, CLAUDE.md, or repository release rules, and it does not authorize installs, credentials, external actions, merges, deployments, or changes to player state.
