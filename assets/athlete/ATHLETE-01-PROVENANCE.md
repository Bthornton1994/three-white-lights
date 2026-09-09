# `athlete-01` provenance

Status: `RIVE_EXPORT_PENDING` — the authored Rive file is saved in the
authenticated editor, but this account's runtime (`.riv`) and backup (`.rev`)
exports are gated behind a Rive plan upgrade. This record is intentionally
not an acceptance attestation until those bytes are available.

SHA-256: `PENDING_RIVE_RUNTIME_EXPORT`

License: Original deterministic vector artwork authored for the Three White
Lights project; no third-party image, font, logo, or likeness was imported.

Author: Codex Work Mode, authored 2026-09-09 in the authenticated Rive editor
and local SVG/PNG/JPEG production pass, from the project-owned athlete source
package and rig manifest.

Marks: No real federation, sponsor, apparel, equipment, or brand mark appears;
the athlete is fictional and gender-neutral, with no real person's likeness.

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

## Acceptance boundary

The reference sheet and empty side-on room plate are supplied as deterministic
vector renders beside this record. They are technical source artifacts until
the `.riv` and `.rev` bytes are exported, the SHA-256 above is replaced with
the actual runtime hash, `node tools/rivContract.mjs ... --artboard squat`
passes, and the repository's remaining device and human visual gates are run.
