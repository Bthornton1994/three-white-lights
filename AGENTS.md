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

## Engineering quality layer

For substantial software work, use pstack as an optional Cursor engineering-quality layer when it is installed. Upstream: `https://github.com/cursor/plugins/tree/main/pstack`.

pstack is subordinate to `VISION.md`, `docs/GDD.md`, `CLAUDE.md`, human game-feel/playtest requirements, release rules, and explicit authority boundaries. Its autonomy defaults never authorize a merge, deployment, live economy or progression change, external publication, account or permission change, or other consequential action that this repository has not already authorized.

When using Cursor, prefer `/poteto-mode` for non-trivial engineering work and use pstack's adversarial review, eval, verification-skill, prototype, and decision-trail workflows when they fit the task. When using Claude Code, Codex, or another runtime, apply the equivalent disciplines without pretending Cursor-only commands exist: model the domain before coding, keep validation at boundaries, make operations idempotent, reproduce defects when practical, sequence changes into verifiable units, verify the real artifact rather than only CI, compare competing designs where appropriate, and independently challenge consequential changes.

Automated verification does not replace required human playtesting or game-feel judgment. Do not vendor the whole pstack plugin into this repository by default. Install it through Cursor so the plugin can evolve upstream while these repository-local governance rules remain stable.
