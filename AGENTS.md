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

