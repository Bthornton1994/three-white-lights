# `athlete-01` provenance

Status: `SATISFIED` (mechanical contract + intake) — desktop Rive MCP authoring
on the owner machine against Early Access file `athlete-01` (file id
`2567995`). Native editable vector artwork, group hierarchy, continuous
`barHeight` pose binds, conditioned miss transitions, and a runtime-exportable
`Athlete.plates` **List** of eight `PlateSlot` items (`on` boolean, `size`
number) are in the committed `.riv` / `.rev`. The 43 logical inputs in
`docs/design/athlete-rig-manifest.json` remain unchanged; stages resolve
`plates/<i>/{on,size}` through indexed List access after normalizing the
exported list to exactly 8 items.

SHA-256: `6ced27441964cf5d489ee7083e3062f181ff75a3b2ac306bb53b6cbe12f69b26`

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
| Reference sheet | `assets/athlete/athlete-01-reference-sheet.png` | present |
| Runtime export | `assets/athlete/athlete-01.riv` | **present** (14859 bytes) |
| Editor backup | `assets/athlete/athlete-01.rev` | **present** (42952 bytes) |
| Intake | `node tools/athleteIntake.mjs --dir assets/athlete` | exit **0** after this hash (room plate still a step-0 note) |
| Contract vs `.riv` | `node tools/rivContract.mjs assets/athlete/athlete-01.riv --artboard squat` | exit **0** `SATISFIED` |
| Empty room plate | `assets/iron-amber/squat-room-side.jpg` | **missing** (intake step 0 note only) |

### Exact contract result (2026-09-10 production authoring pass)

```
node tools/rivContract.mjs assets/athlete/athlete-01.riv --artboard squat
→ artboard squat present, state machine squat present, default ViewModel Athlete
→ Athlete.plates: { type: "list", itemRef: "PlateSlot" }
→ PlateSlot: on boolean, size number
→ missing: [] / wrongType: [] / missingEnumValues: [] / extra: []
→ satisfied: true
exit 0
```

### Exact intake result after this provenance hash write

```
step 0 note: room plate assets/iron-amber/squat-room-side.jpg is not there yet
steps 1–3: provenance present, SHA-256 matches, rivContract --artboard squat exit 0
exit 0
```

## Completed in the editor (this run)

- Opened Early Access file `athlete-01` via Rive MCP (`session_info` OK;
  file id `2567995`).
- Preserved artboard `squat` (1152×1728), state machine `squat`, enums
  `LiftKind` / `PhaseKind` / `EffortBandKind` / `OutcomeKind` /
  `MissReasonKind`, and the full 43-input Athlete contract (plates as native
  List of `PlateSlot`).
- Positioned production layers on canvas: `room` at (576,864), `rack` at
  (576,1000) so J-cups sit on the lockout line, `root` mid-foot at
  (576,1400).
- Offset limb/spine/arm/hand group nodes for lockout coherence; added missing
  far-side native vectors (`forearm_far_mesh`, `hand_far_mesh`,
  `knee_sleeve_far`, `tattoo_forearm_far`, `wrist_wrap_far`) plus parametric
  Iron & Amber room/floor fills.
- Bound continuous pose drivers from `barHeight` (pelvis y, torso lean, thigh
  rot, shin rot, foot dorsi, bar_root y) and grind tremor from
  `grindIntensity`; deleted orange visibility probes.
- Conditioned miss transitions on `complete` + `outcome=miss` +
  `missReason` (`no-depth` / `buried` / `stalled` / `timeout` / `dropped`)
  and return-to-`squat_motion` when `complete=false`.
- `simulateStateMachine` over brace→descent→depth→hole→ascent/grind→lockout
  stayed on `squat_motion` (1 transition: Entry→squat_motion) — continuous
  sequence preserved; pose remains `barHeight`-driven.
- Exported `.riv` (14859 bytes) and `.rev` (42952 bytes, embed_assets true).
  Account had export entitlement on this desktop session.

## Remaining failures (exact — nothing fabricated past these)

1. **`capture_artboard` returns a blank/black frame** even after canvas
   placement, opaque parametric room fills (1152×1728), and a blue
   `#ff0000ff` capture background. Shape `computedwidth`/`computedheight`
   stay `0` in MCP property queries. Host also logs
   `No WebGL support. Image mesh will not be drawn.` Visual QA could not be
   pixel-verified via MCP capture.
2. **No Bone create API** in the connected Rive MCP toolset; IK/bone weights
   from the handoff §6 plan were not applied. Pose uses group transforms +
   `barHeight` / `grindIntensity` converters.
3. **State machine leftover duplicate states remain** (extra `grind` /
   `failure_dropped` animation states from the prior prototype). Entry and
   continuous pose path are correct; full layered
   pose/effort/grind/cue/resolution plan with dedicated additive layers was
   not finished. Enum-driven miss simulation via
   `simulateStateMachine` warns
   `simulating this property type is not supported` for non-number inputs, so
   miss-branch playback could not be headlessly confirmed (conditions are
   authored in the SM graph).
4. **Room plate** `assets/iron-amber/squat-room-side.jpg` still missing
   (intake step 0 note only).
5. **`move_agent_to_root`** for `C:\Users\Bthor\three-white-lights` failed
   with `Cannot create migration handle for unknown agent` — work continued
   via absolute paths on branch `codex/athlete-01-rive-authoring`.

## Acceptance boundary

Mechanical contract / intake: **SATISFIED** for squat artboard + List plates.

Still owed before production acceptance: Human VISUAL / ANIMATION /
SOFT-FEEL + OWNER PLAYTEST; room plate composition; flip of
`ATHLETE_RIG.TRAINING_STAGE` (not done in this pass); placeholder flag and
`athleteAsset.ts` unchanged.
