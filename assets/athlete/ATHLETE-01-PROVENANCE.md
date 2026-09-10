# `athlete-01` provenance

Status: **NO-GO for production visual acceptance.** Mechanical contract +
intake remain satisfiable after this pass; visual / bone / WebGL / native
gates do not.

SHA-256: `395fb526a1d4f636c863c7cb7cbf07462422138883e3e043e9929972e4563d51`

License: Owned for this project’s redistribution of the authored Rive
runtime/editor siblings committed here. Reference captures remain
owner-supplied visual reference only and are not embedded in the `.riv`.

Artist: Cursor desktop Agent on the owner machine (local Rive MCP → Early
Access file `athlete-01`, id `2567995`), PR #60 branch
`codex/athlete-01-rive-authoring`, 2026-09-10 production-quality attempt.

Marks: No real federation wordmark, shoe/apparel brand, sponsor mark, or
claimed likeness of a real lifter is attested in the native vector layers
authored in this pass (stylized side-on vector silhouette + wardrobe marks;
not a photoreal tattooed likeness of the reference sheet).

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
| Runtime export | `assets/athlete/athlete-01.riv` | **present** (13026 bytes) |
| Editor backup | `assets/athlete/athlete-01.rev` | **present** (43282 bytes) |
| Intake | `node tools/athleteIntake.mjs --dir assets/athlete` | exit **0** after this hash |
| Contract vs `.riv` | `node tools/rivContract.mjs assets/athlete/athlete-01.riv --artboard squat` | exit **0** `SATISFIED` |
| Empty room plate | `assets/iron-amber/squat-room-side.jpg` | **present** 1152×1728 empty side-on procedural plate (not a painted lifter scene) |

### Exact contract result

```
node tools/rivContract.mjs assets/athlete/athlete-01.riv --artboard squat
→ artboard squat present, state machine squat present, default ViewModel Athlete
→ Athlete.plates: list / PlateSlot
→ missing: [] / wrongType: [] / missingEnumValues: [] / extra: []
→ satisfied: true
exit 0
```

## Completed in the editor (this run)

- Deleted the old front-facing geometric mannequin shapes that dominated the
  prior capture (RoomBackground / Torso / Thigh* / Arm* / Plate* probe set).
- Authored additional native parametric vectors under the side-on hierarchy:
  head/beard/hair, torso/singlet/belt, thigh/shin/knee sleeve/shoe, arm/hand/
  wrist wrap, tattoo mass marks, bar/plates, rack uprights/J-cups, room wall/
  floor/window glow/pendant.
- Cleaned state machine `squat` Layer 1: removed duplicate `grind` states and
  extra `failure_dropped` orphans; kept one state per missReason
  (`no-depth` / `buried` / `stalled` / `timeout` / `dropped`) with
  `complete`+`outcome`+`missReason` conditions and return-to-`squat_motion`
  when `complete=false` (including dropped).
- Exported `.riv` / `.rev`; preserved Athlete ViewModel, 43 logical inputs,
  and `plates` List of PlateSlot.
- Added empty room plate `assets/iron-amber/squat-room-side.jpg` at 1152×1728
  (procedural empty Iron & Amber side room — no athlete/bar/plates painted).

## Remaining failures (exact — nothing fabricated past these)

1. **Production visual quality NO-GO.** MCP `capture_artboard` after the
   mannequin deletion returns a solid black frame even for a bright probe
   ellipse on the artboard (`backgroundColor` `#ff0000ff` / `#ff1a120e`).
   Host still reports `No WebGL support. Image mesh will not be drawn.` There
   is **no valid WebGL2 pixel evidence** that the new side-on vectors match
   the reference sheet’s realistic tattooed powerlifter.
2. **Bone / IK / weighted mesh not authored.** MCP exposes `mesh_rigging_tool`
   bind/autoWeight but **no Bone create API** (`component_editor` is
   Component instances only; scripting reference has no `rive/bone`). Pose
   remains group transforms + existing `barHeight` / `grindIntensity`
   converters.
3. **Failure animations are still stub timelines** (1.0s named linear anims).
   Distinct missReason branches exist in the SM graph; pixel-distinct failure
   poses were not verified (capture broken).
4. **Native device/runtime** still unavailable here (`adb` / emulator /
   `ANDROID_HOME` / `EXPO_TOKEN` absent). Do not infer native List PASS from
   web canvas tests.
5. **Reference-sheet fidelity** (muscular anatomy, readable tattoos, cinematic
   Iron & Amber depth) is not met by the current vector silhouette. Source
   package §12 still correctly classifies illustrator-grade drawings as
   blocked without an asset author.

## Acceptance boundary

Mechanical contract / intake / room plate size gate: **SATISFIED**.

Still owed before production acceptance: human VISUAL / ANIMATION / SOFT-FEEL;
WebGL2 captures at brace/depth/hole/grind/lockout + five misses; bone/IK/
weights; native runtime; OWNER PLAYTEST. `ATHLETE_RIG.TRAINING_STAGE`,
placeholder gate, and player mount were **not** flipped.
