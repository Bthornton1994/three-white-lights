# `athlete-01` provenance

Status: `RIVE_MCP_UNREACHABLE` — this Cloud Agent run cannot author or
export the production Rive asset. Official Rive MCP is a localhost bridge
to the Rive Early Access desktop Editor (`http://127.0.0.1:9791/mcp`). That
server is not present in this remote environment, so no native vector
rebuild, contract-preserving edit, `.riv` export, or `.rev` export was
performed. No fabricated runtime or editor bytes were committed.

SHA-256: `PENDING_RIVE_RUNTIME_EXPORT`

License: The reference captures were supplied by Bryant Thornton for this
project. Redistribution and production rights for the source captures have
not been independently verified. They are used only as visual references and
are not embedded in the runtime asset.

Author: Cursor Cloud Agent (`bc-61cb68cc-219c-415c-9336-e13c4f4cd5ca`),
continuing the PR #60 handoff on 2026-09-10. Prior editor authoring remains
attributed to the Codex Work Mode pass of 2026-09-09.

Marks: The supplied captures visibly contain gym/equipment details and
apparel markings. Their ownership and clearance are not independently
verified. No claim is made that any native Rive artwork in the open editor
file reproduces those details or any person's likeness. This run produced
no new artwork bytes.

Editor source: Prior authenticated editor file remains
`athlete-01`, file id `2567995`,
https://editor.rive.app/file/untitled/2567995. The editable `.rev` sibling
was not exported in this run. Official Rive docs require the Early Access
desktop app on the same machine as the MCP client; Cloud Agents do not
inherit that localhost bridge.

## Inspected repository contract (this run)

Located and inspected on branch `codex/athlete-01-rive-authoring` (PR #60):

| Artifact | Path | Result |
| --- | --- | --- |
| Source package | `docs/design/ATHLETE-SOURCE-PACKAGE.md` | present |
| Authoring handoff | `docs/design/RIVE-AUTHORING-HANDOFF.md` | present |
| Rig manifest | `docs/design/athlete-rig-manifest.json` | present; **43 inputs** |
| Contract print | `node tools/rivContract.mjs --manifest` | exit **0**; 43 inputs |
| Reference sheet | `assets/athlete/athlete-01-reference-sheet.png` | present |
| Intake | `node tools/athleteIntake.mjs --dir assets/athlete` | exit **2** |
| Contract vs `.riv` | `node tools/rivContract.mjs assets/athlete/athlete-01.riv --artboard squat` | exit **1** (`ENOENT`) |
| Runtime export | `assets/athlete/athlete-01.riv` | **missing** |
| Editor backup | `assets/athlete/athlete-01.rev` | **missing** |
| Empty room plate | `assets/iron-amber/squat-room-side.jpg` | **missing** (intake step 0 note) |

Exact intake stdout (2026-09-10T14:41:54Z, reconfirmed after `npm install`):

```
step 0 note: room plate assets/iron-amber/squat-room-side.jpg is not there yet — the rig can be validated, the composite cannot be graded (source package §8)
INTAKE_WAITING: ASSET_MISSING — assets/athlete/athlete-01.riv is not there yet
```

Exact Rive MCP probe from this Cloud Agent VM:

```
curl -sS -m 3 http://127.0.0.1:9791/mcp
→ curl: (7) Failed to connect to 127.0.0.1 port 9791 after 0 ms: Couldn't connect to server
port 9791 not listening
```

Dynamic MCP catalog for this run contained no `rive` / Rive namespace
(available namespaces: cursor, cursor-cloud, cursor-subscriptions, Github,
Gmail, Granola, Notion, Ramp, Supabase, Vercel).

## Authored scope (prior editor claim — unverified by this run)

The previous PR record claimed, in the authenticated editor only:

- Artboard: `squat`, 1152 × 1728.
- Default ViewModel: `Athlete`, with the exact 43-input contract from
  `docs/design/athlete-rig-manifest.json`.
- State machine: `squat`; continuous motion timeline `squat_motion`; authored
  `grind`, `failure_no_depth`, `failure_buried`, `failure_stalled`,
  `failure_timeout`, and `failure_dropped` states/timelines.

This Cloud Agent could not open, inspect, rebuild, or export that editor
file through Rive MCP. The continuous squat sequence
brace → descent → depth → hole → reversal → drive → grind → lockout → failure
was therefore not visually rebuilt or mechanically re-validated against a
`.riv` in this run.

## Visual / design note (not resolved here)

`docs/design/ATHLETE-SOURCE-PACKAGE.md` still specifies a gender-neutral,
face-not-authored-at-v1 silhouette with no likeness. The PR #60 brief and
supplied captures ask for a coherent realistic tattooed male powerlifter in
the Iron & Amber gym. That design tension remains open; it was not silently
resolved by fabricating art.

## Prior authoring attempt (retained)

On 2026-09-09, a layered vector SVG was uploaded through the Rive Assets
panel. The editor crashed before the asset appeared. A second upload using a
minimal three-shape SVG produced the same crash. After recovery, the Assets
panel was still empty. The editor diagnostics reported WebGL2 unavailable,
CPU fallback, and worker renderer creation failure. The Publish menu still
showed `Upgrade` for both runtime and library export. No `.riv` or `.rev`
bytes were produced by that attempt.

## Acceptance boundary

No production acceptance is claimed. Required before acceptance:

1. Run authoring from a **desktop** Cursor session on the same machine as
   Rive Early Access with MCP `http://127.0.0.1:9791/mcp` connected and
   `athlete-01` open.
2. Rebuild native editable vector artwork + rig; preserve the exact 43-input
   `Athlete` contract and continuous squat / failure state machine plan.
3. Export `assets/athlete/athlete-01.riv` and `assets/athlete/athlete-01.rev`
   (account must have `.riv` / `.rev` export entitlement — prior editor
   showed `Upgrade`).
4. Replace `SHA-256:` above with the actual `.riv` hash.
5. Re-run:
   - `node tools/athleteIntake.mjs --dir assets/athlete`
   - `node tools/rivContract.mjs assets/athlete/athlete-01.riv --artboard squat`
6. Complete remaining device / human visual gates (intake steps 4–8).
