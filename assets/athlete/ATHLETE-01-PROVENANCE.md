# `athlete-01` provenance

Status: **NO-GO for production visual acceptance.** Mechanical contract +
intake remain satisfiable; visual fidelity, bone/IK, WebGL2 pixel proof,
native List runtime, and full CI are not.

HEAD (this report): `a521a3ba96fa2797cbc695b90629ed657cc500fe` on
`codex/athlete-01-rive-authoring`. Asset bytes unchanged from prior export
unless a new Rive export lands.

SHA-256 (`athlete-01.riv`):
`395fb526a1d4f636c863c7cb7cbf07462422138883e3e043e9929972e4563d51`

SHA-256 (`athlete-01.rev`):
`3d3887880eaf46a8d59e2b1dd41be3f9fd893e9ae0e35388d15eb873b7e72be8`

SHA-256 (`squat-room-side.jpg`):
`5d566e961a0c24110c97bd998e39a8051a0f67a1a8e9154c2abf1397b40a4050`

License: Owned for this project’s redistribution of the authored Rive
runtime/editor siblings committed here. Reference captures remain
owner-supplied visual reference only and are not embedded in the `.riv`.

Artist: Cursor desktop Agent on the owner machine (local Rive MCP → Early
Access file `athlete-01`, id `2567995`), PR #60 branch
`codex/athlete-01-rive-authoring`.

Marks: No real federation wordmark, shoe/apparel brand, sponsor mark, or
claimed likeness of a real lifter is attested in the native vector layers
(stylized side-on vector silhouette + wardrobe marks; **not** a photoreal
tattooed likeness of the reference sheet).

Editor source: `assets/athlete/athlete-01.rev`. Cloud editor:
https://editor.rive.app/file/athlete-01/2567995.

## Inspected repository contract

| Artifact | Path | Result |
| --- | --- | --- |
| Source package | `docs/design/ATHLETE-SOURCE-PACKAGE.md` | present |
| Authoring handoff | `docs/design/RIVE-AUTHORING-HANDOFF.md` | present |
| Rig manifest | `docs/design/athlete-rig-manifest.json` | present; **43 inputs** unchanged |
| Reference sheet | `assets/athlete/athlete-01-reference-sheet.png` | present |
| Runtime export | `assets/athlete/athlete-01.riv` | present (~13026 bytes) |
| Editor backup | `assets/athlete/athlete-01.rev` | present (~43282 bytes) |
| Intake | `node tools/athleteIntake.mjs --dir assets/athlete` | exit **0** |
| Contract | `node tools/rivContract.mjs … --artboard squat` | exit **0** `SATISFIED` |
| Room plate | `assets/iron-amber/squat-room-side.jpg` | 1152×1728 empty side-on procedural plate (dimensions PASS; cinematic quality **NO-GO**) |

## Rive authoring completed (this arc)

- Side-on parametric vectors (head/beard/hair, torso/singlet/belt, limbs,
  wraps, tattoo masses, bar/plates, rack, room bands/window/pendant).
- State machine `squat` cleaned to one missReason state each
  (`no-depth` / `buried` / `stalled` / `timeout` / `dropped`) plus motion
  path; returns to `squat_motion` when `complete=false`.
- Athlete ViewModel + 43 logical inputs + `plates` List of PlateSlot preserved.
- **Bones / IK / weighted meshes: NOT authored.** MCP
  `mesh_rigging_tool` bind/autoWeight only — **no Bone create API**.
  `component_editor` adds artboard Components, not skeletal bones. Group
  transforms are **not** claimed as IK.

## Runtime capture evidence

| Path | Result |
| --- | --- |
| MCP `capture_artboard` | solid black — **not evidence** |
| `node tools/athleteWebglCapture.mjs --runtime webgl2` | WebGL2 available; Rive loads; **BLANK_FRAMES** exit 2 |
| `node tools/athleteWebglCapture.mjs --runtime canvas` | **PIXELS_PRESENT** 11/11 — see `docs/design/evidence/athlete-canvas-qa/` |

Canvas frames show a geometric side-on mannequin. They do **not** match the
reference sheet’s muscular tattooed lifter or cinematic Iron & Amber room.

## Native

**BLOCKED** — `adb` / emulator / `ANDROID_HOME` / `EXPO_TOKEN` absent.
PlateSlot List adapter + web tests remain; device List PASS is not inferred.

## Player mount

`ATHLETE_RIV_IS_PLACEHOLDER` still `true`; `ATHLETE_RIG.TRAINING_STAGE` still
`'schematic'`. Authored `.riv` may exist for intake/contract/QA without
mounting. Placeholder / no-athlete tests use isolated fixtures.

## CI triage (merge-gate shape)

Fixed without flipping mount gates:

- `athleteAsset.test.ts` — allow authored-but-unmounted `.riv`
- `athleteAccept.test.ts` — empty `--dir` for ASSET_MISSING
- `ironAmberWiring.test.ts` — `selectTrainingStageArm` wiring
- `devServerSentinel` — census `_capture-*` tools that already gate
- `realIp` `UNREADABLE_BY_THIS_AUDIT` — jpg/png/rev/riv counts for owned assets
- `athleteTraces` — regenerated after drift (`athleteTraces.mjs write`)

Left red on purpose (inherited / human-ruled; not weakened):

- `realIp` `REVIEWABLE_CITATIONS` / OpenPowerlifting code-position in
  `AppShell.tsx` / `shellWiring.test.ts` (183 vs 180 class)
- `progression.test.ts` reflective `Object.assign` exemption
- `streakEntitlement.test.ts` directory-walk / `.d.ts` class
- `localSessionServer.test.ts` method census
- `a2LifterFreeze.test.ts` historical-SHA `git diff` on shallow CI

## Acceptance boundary

| Gate | Decision |
| --- | --- |
| Mechanical contract / intake / room size | **PASS** (evidence above) |
| Production visual / reference fidelity | **NO-GO** |
| Bones / IK / weighted mesh | **NO-GO** (tooling blocker) |
| WebGL2 pixel QA | **BLOCKED** (blank frames) |
| Canvas runtime pixel QA | harness **PASS**; content still **NO-GO** vs reference |
| Native List runtime | **BLOCKED** |
| Full CI green | **NO-GO** (inherited + citation reds remain) |
| Overall production acceptance | **NO-GO** |
