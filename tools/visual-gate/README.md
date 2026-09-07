# Visual-gate harness (verification only)

Isolated tooling for independent verification of Session A / Session B visual
candidates. **Does not edit product code.**

## Rules

- Pin exact SHAs. Never mix evidence across commits.
- If Grok reports a newer SHA, start a new pass id rather than appending.
- Allowed contents on `cursor/twl-visual-gate-harness-01`: schemas, capture
  wrappers that call existing `tools/*` scripts, and verification reports under
  `docs/verification/`.
- Forbidden: `src/session/**`, `src/empire/**`, lift mechanics, economy, or any
  product behavior change.

## Pass layout

Evidence records should validate against `evidence.schema.json`.
