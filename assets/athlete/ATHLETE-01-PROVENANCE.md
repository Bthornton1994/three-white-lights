# `athlete-01` provenance

Status: `EXPORTED_NOT_SATISFIED` — desktop Rive MCP authoring ran on the
owner machine against Early Access file `athlete-01` (file id `2567995`).
Native vector artwork, group hierarchy, continuous `barHeight` pose binds,
`.riv`, and `.rev` were produced. The 43-input contract is **not** fully
satisfied: nested `plates/0..7/{on,size}` does not survive `.riv` export
(see Failures).

SHA-256: `d735e08fb95d4b5549e047e4697883aabcb9e91789a4aea9678e6047f35495e3`

License: Owned for this project’s redistribution of the authored Rive
runtime/editor siblings committed here. Reference captures remain
owner-supplied visual reference only and are not embedded in the `.riv`.

Artist: Cursor desktop Agent on the owner machine (local Rive MCP → Early
Access), PR #60 branch `codex/athlete-01-rive-authoring`, 2026-09-10.

Marks: No real federation wordmark, shoe/apparel brand, sponsor mark, or
claimed likeness of a real lifter is attested in the native vector layers
authored in this pass (fictional tattooed male powerlifter silhouette in
Iron & Amber light; face is mass/beard silhouette only).

Editor source: `assets/athlete/athlete-01.rev` (exported sibling of
`athlete-01.riv`). Cloud editor file remains
https://editor.rive.app/file/athlete-01/2567995.

## Inspected repository contract (this run)

| Artifact | Path | Result |
| --- | --- | --- |
| Source package | `docs/design/ATHLETE-SOURCE-PACKAGE.md` | present |
| Authoring handoff | `docs/design/RIVE-AUTHORING-HANDOFF.md` | present |
| Rig manifest | `docs/design/athlete-rig-manifest.json` | present; **43 inputs** |
| Contract print | `node tools/rivContract.mjs --manifest` | exit **0** |
| Reference sheet | `assets/athlete/athlete-01-reference-sheet.png` | present |
| Runtime export | `assets/athlete/athlete-01.riv` | **present** (10948 bytes) |
| Editor backup | `assets/athlete/athlete-01.rev` | **present** (39772 bytes) |
| Intake | `node tools/athleteIntake.mjs --dir assets/athlete` | exit **1** after provenance update expected **1** until contract SATISFIED (hash now matches) |
| Contract vs `.riv` | `node tools/rivContract.mjs assets/athlete/athlete-01.riv --artboard squat` | exit **1** `NOT SATISFIED` — 16 missing `plates/<i>/on|size` |
| Empty room plate | `assets/iron-amber/squat-room-side.jpg` | **missing** (intake step 0 note only) |

### Exact contract result (2026-09-10 desktop MCP run)

```
node tools/rivContract.mjs assets/athlete/athlete-01.riv --artboard squat
→ artboard squat present, state machine squat present, default ViewModel Athlete
→ missing: plates/0/on … plates/7/size (16 paths)
→ extra: plates/on, plates/size, _plates_list_legacy, _platesBank_unused/…
→ satisfied: false
exit 1
```

Schema probe: exported ViewModels are only `Athlete` and `PlateSlot`.
`Athlete.plates` resolves as `viewModel` → `PlateSlot` (so `plates/on` and
`plates/size` appear), not `plates → PlateSlots → 0..7 → PlateSlot`.

### Exact intake result before this provenance hash write

```
step 0 note: room plate assets/iron-amber/squat-room-side.jpg is not there yet
INTAKE_REJECTED: PROVENANCE_HASH_MISMATCH — step 1
  ATHLETE-01-PROVENANCE.md names pending_rive_runtime_export
  athlete-01.riv is d735e08fb95d4b5549e047e4697883aabcb9e91789a4aea9678e6047f35495e3
exit 1
```

After this file’s `SHA-256` line matches the `.riv`, intake advances to
contract step 2 and still rejects on `NOT SATISFIED`.

## Completed in the editor (this run)

- Opened Early Access file `athlete-01` via Rive MCP (`session_info` OK).
- Preserved artboard `squat` (1152×1728), state machine `squat`, enums
  `LiftKind` / `PhaseKind` / `EffortBandKind` / `OutcomeKind` / `MissReasonKind`,
  and the non-plate Athlete inputs from the 43-input manifest.
- Built native editable vector layers (no image sequence / pose swap):
  Iron & Amber room, rack + J-cups, tattooed male powerlifter masses
  (singlet, belt, knee sleeve, shoes, hair/beard mass, tattoo overlays),
  bar/collars/plates, chalk.
- Built transform group hierarchy under `root` (feet, pelvis/spine/chest,
  limbs, `bar_root` / sleeves) — **Bone objects could not be created**
  (no MCP bone-create tool; `mesh_rigging_tool` binds existing bones only).
- Bound `barHeight` through formula converters to continuous pose drivers
  (`bar_root.y`, `pelvis.y`, torso lean, thigh rotation).
- Hid legacy geometric prototype shapes (opacity 0; not deleted).
- Exported `athlete-01.riv` and `athlete-01.rev` successfully (account had
  export entitlement on this desktop session).

## Failures (exact — nothing fabricated past these)

1. **Nested `PlateSlots` does not export.** ViewModels created through
   MCP `viewmodel_editor.createViewModels` (including `PlateSlots` /
   `AthleteContract` / `PlateBank`) do **not** appear in
   `get_scripting_reference` `Data {…}` and are **absent** from
   `viewModelCount()` in the exported `.riv`. Binding an MCP-created VM as
   the artboard default exported `defaultViewModel: null`. Self-nesting
   `PlateSlot → PlateSlot` for slots `0..7` is rejected by the editor
   (“recursive viewmodel reference”). Therefore the host paths
   `plates/0/on` … `plates/7/size` cannot be satisfied by export from this
   MCP session.
2. **`capture_artboard` returns a blank frame** even after adding opaque
   shapes with non-zero path width/height; computed width/height stay 0.
   Host also logs `No WebGL support. Image mesh will not be drawn.` Visual
   QA could not be pixel-verified via MCP capture.
3. **No Bone create API** in the connected Rive MCP toolset; IK/bone weights
   from the handoff §6 plan were not applied. Pose uses group transforms +
   `barHeight` converters.
4. **State machine cleanup incomplete.** `squat` still contains leftover
   duplicate failure animation states / unconditional transitions from the
   prior prototype; Entry was pointed at `squat_motion`, but the full
   layered pose/effort/grind/cue/resolution plan with conditioned
   `outcome` / `missReason` branches was not finished.
5. **Room plate** `assets/iron-amber/squat-room-side.jpg` still missing
   (intake step 0 note only).
6. **Contract / intake mechanical gates** still fail closed on (1).

## Acceptance boundary

No production acceptance. Next unblock for contract SATISFIED:

1. In Early Access UI (or a future MCP that registers nested VMs into
   exportable `Data`), author `PlateSlots` with properties `0`…`7` each a
   `PlateSlot`, set `Athlete.plates` → `PlateSlots`, re-export `.riv`/`.rev`.
2. Re-run intake + `rivContract … --artboard squat` to exit 0.
3. Human VISUAL / ANIMATION / SOFT-FEEL + OWNER PLAYTEST remain owed.
