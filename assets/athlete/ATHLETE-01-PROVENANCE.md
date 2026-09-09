# `athlete-01` provenance

Status: `RIVE_EXPORT_PENDING` — the authored Rive file is saved in the
authenticated editor, but this account's runtime (`.riv`) and backup (`.rev`)
exports are gated behind a Rive plan upgrade. This record is intentionally
not an acceptance attestation until those bytes are available.

SHA-256: `PENDING_RIVE_RUNTIME_EXPORT`

License: The reference captures were supplied by Bryant Thornton for this
project. Redistribution and production rights for the source captures have
not been independently verified. They are used only as visual references and
are not embedded in the runtime asset.

Author: Codex Work Mode, authored 2026-09-09 in the authenticated Rive editor
and local reference-board pass, using the supplied captures, project source
package, and rig manifest.

Marks: The supplied captures visibly contain gym/equipment details and
apparel markings. Their ownership and clearance are not independently
verified. No claim is made that the current native Rive prototype reproduces
those details or any person's likeness.

Editor source: Rive file `athlete-01`, file id `2567995`,
https://editor.rive.app/file/untitled/2567995. The editable `.rev` export is
pending the same account entitlement as the `.riv` export.

## Authored scope

- Artboard: `squat`, 1152 × 1728.
- Default ViewModel: `Athlete`, with the exact 43-input contract from
  `docs/design/athlete-rig-manifest.json`.
- State machine: `squat`; continuous motion timeline `squat_motion`; authored
  `grind`, `failure_no_depth`, `failure_buried`, `failure_stalled`,
  `failure_timeout`, and `failure_dropped` states/timelines.
- Native vector layers include the persistent bar, collars, plates, rack,
  athlete mass, cues, and resolution layers. The authored motion keeps the
  bar/equipment persistent and keys the continuous bar path rather than using
  pose-image swaps.

## Visual-reference correction

The earlier flat-vector reference board and companion placeholder athlete
renders were withdrawn because they did not match the supplied cinematic
captures. `athlete-01-reference-sheet.png` is now a contact sheet made from
the supplied `IMG_1127.jpeg`, `IMG_1129.jpeg`, and `IMG_1130.jpeg` squat
captures. It is a reference board only, not a Rive runtime export.

The current native Rive artwork is a structural rig prototype. Because the
editor's runtime renderer was unavailable in this session and image import
was not stable, visual parity with the supplied captures is not confirmed.

## Acceptance boundary

The corrected reference sheet is supplied beside this record as a source
artifact. It does not satisfy the production visual gate by itself. The
`.riv` and `.rev` bytes still need to be exported, the SHA-256 above replaced
with the actual runtime hash, `node tools/rivContract.mjs ... --artboard
squat` run against the real `.riv`, and the repository's remaining device and
human visual gates completed. Production acceptance is not claimed here.
