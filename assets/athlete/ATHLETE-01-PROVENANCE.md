# `athlete-01` provenance

Status: `SATISFIED` — desktop Rive MCP authoring on the owner machine against
Early Access file `athlete-01` (file id `2567995`). Native vector artwork,
group hierarchy, continuous `barHeight` pose binds, and a runtime-exportable
`Athlete.plates` **List** of eight `PlateSlot` items (`on` boolean, `size`
number) are in the committed `.riv` / `.rev`. The 43 logical inputs in
`docs/design/athlete-rig-manifest.json` remain unchanged; stages resolve
`plates/<i>/{on,size}` through indexed List access after normalizing the
exported list to exactly 8 items.

SHA-256: `6cb55f0cd0619de743f7ee3dfc605d758c33561c42560288dbf63d8296a145d5`

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
| Rig manifest | `docs/design/athlete-rig-manifest.json` | present; **43 inputs** unchanged |
| Contract print | `node tools/rivContract.mjs --manifest` | exit **0** |
| Reference sheet | `assets/athlete/athlete-01-reference-sheet.png` | present |
| Runtime export | `assets/athlete/athlete-01.riv` | **present** (11400 bytes) |
| Editor backup | `assets/athlete/athlete-01.rev` | **present** (40524 bytes) |
| Intake | `node tools/athleteIntake.mjs --dir assets/athlete` | exit **0** after this hash (room plate still a step-0 note) |
| Contract vs `.riv` | `node tools/rivContract.mjs assets/athlete/athlete-01.riv --artboard squat` | exit **0** `SATISFIED` |
| Empty room plate | `assets/iron-amber/squat-room-side.jpg` | **missing** (intake step 0 note only) |

### Exact contract result (2026-09-10 List route)

```
node tools/rivContract.mjs assets/athlete/athlete-01.riv --artboard squat
→ artboard squat present, state machine squat present, default ViewModel Athlete
→ Athlete.plates: { type: "list", itemRef: "PlateSlot" }
→ PlateSlot: on boolean, size number
→ missing: [] / wrongType: [] / missingEnumValues: [] / extra: []
→ satisfied: true
exit 0
```

Runtime probe on the same bytes: authored List length may export larger than
8 (measured 24); stages call `normalizePlatesListLength` to trim/add to
exactly 8 `PlateSlot` items. Indexed `instanceAt(i).boolean('on')` /
`.number('size')` writes are independent across all 16 logical paths. Path
grammar `boolean('plates/0/on')` remains null — stages never rely on it.

### Exact intake result after this provenance hash write

```
step 0 note: room plate assets/iron-amber/squat-room-side.jpg is not there yet
steps 1–3: provenance present, SHA-256 matches, rivContract --artboard squat exit 0
exit 0
```

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
- Replaced nested / flat plate authoring with **`Athlete.plates` as a native
  List of `PlateSlot`**, removed unused `_plates_*` properties, and exported
  `.riv` / `.rev` for runtime (account had export entitlement on this desktop
  session).

## Remaining failures (exact — nothing fabricated past these)

1. **`capture_artboard` returns a blank frame** even after adding opaque
   shapes with non-zero path width/height; computed width/height stay 0.
   Host also logs `No WebGL support. Image mesh will not be drawn.` Visual
   QA could not be pixel-verified via MCP capture.
2. **No Bone create API** in the connected Rive MCP toolset; IK/bone weights
   from the handoff §6 plan were not applied. Pose uses group transforms +
   `barHeight` converters.
3. **State machine cleanup incomplete.** `squat` still contains leftover
   duplicate failure animation states / unconditional transitions from the
   prior prototype; Entry was pointed at `squat_motion`, but the full
   layered pose/effort/grind/cue/resolution plan with conditioned
   `outcome` / `missReason` branches was not finished.
4. **Room plate** `assets/iron-amber/squat-room-side.jpg` still missing
   (intake step 0 note only).
5. **Historical note:** nested `PlateSlots` ViewModels created through MCP
   did not survive `.riv` export; the List route above is the replacement
   that does.

## Acceptance boundary

Mechanical contract / intake: **SATISFIED** for squat artboard + List plates.

Still owed before production acceptance: Human VISUAL / ANIMATION /
SOFT-FEEL + OWNER PLAYTEST; room plate composition; flip of
`ATHLETE_RIG.TRAINING_STAGE` (not done in this pass); placeholder flag and
`athleteAsset.ts` unchanged.
