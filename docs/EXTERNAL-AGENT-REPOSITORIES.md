# External agent and tooling references

This is a review record, not an install manifest. It was added on 2026-09-03 to record the Printing Press discussion and its relevance to Three White Lights.

## Review rule

- The source post and linked repositories are references only. No CLI binary, generated adapter, MCP server, credential, hosted service, external data source, or website-derived code is enabled by this record.
- The repository's existing authorities remain in force: VISION.md for durable purpose and boundaries, docs/GDD.md for current game design, and CLAUDE.md plus AGENTS.md for implementation and agent execution.
- Future adoption requires a capability-specific review, source revision and license pin, dependency and side-effect inspection, least privilege, a disposable read-only smoke test, measured comparison, and the applicable project gates.

## Printing Press references

The [source post and visible replies](https://x.com/exm7777/status/2095256458107773331) present a workflow for narrow agent-oriented CLIs and discuss generating a CLI from a website or API where one does not already exist.

The linked [CLI Printing Press generator](https://github.com/mvanhorn/cli-printing-press) and [published CLI library](https://github.com/mvanhorn/printing-press-library) document potentially useful patterns such as concise machine-readable output, compact field selection, structured errors or exit codes, dry runs, local or offline data where appropriate, and explicit live or local source selection.

The claim that CLIs universally use a fraction of MCP tokens is not established for this repository. A valid comparison must include discovery and help parsing, argument construction, serialization, output parsing, retries, recovery turns, authentication, latency, maintenance, and side-effect risk.

## Three White Lights disposition

This change adds review guidance only. Three White Lights does not adopt Printing Press, a generated CLI, an MCP server, or any other external agent-tooling runtime.

A future development adapter may be considered for local repository inspection, build and test verification, evidence collection, or narrowly scoped research. It must remain read-only by default and replaceable behind a repository-owned contract.

No external tool or untrusted retrieved content may:

- become a source of game-design or product truth;
- alter VISION.md, docs/GDD.md, RPE tables, e1RM formulas, DOTS coefficients, attempt rules, judging, or refusal conditions without an explicitly approved design change;
- mutate Total, e1RM, streaks, currency, meet results, progression, or release state;
- bypass builder and critic separation, critic read-only restrictions, or the human-playtesting requirement for game feel;
- authorize external communication, credential use, publication, purchase, deployment, or merge.

## Verification record

- [x] Capability boundary is documented.
- [x] CLI and MCP performance claims are labeled unverified pending end-to-end measurements.
- [x] Source links and the required license, dependency, and side-effect review are recorded.
- [x] No runtime dependency, credential, external integration, gameplay logic, UI, scoring, or progression change was made.
- [x] No merge or deployment was performed.
