# Art-direction concept draft — concept-fable-20260916

**CONCEPT ONLY · DO_NOT_MERGE · not visual approval · not production-ready**

Owner-requested Fable 5.1 one-shot art-direction draft for *Three White Lights:
Iron & Amber Arcade*, produced after Independent QA returned `DO_NOT_MERGE` /
`INTERNAL_PIPELINE_CEILING: YES` on PR #70 (`50b07c89`). It is a brief for a
**human pixel artist**. It contains no production sprites and changes nothing
the game loads. Project state stays `ARTIST_REQUIRED`.

Start with `CONCEPT_REPORT.md` — it lists what was actually created versus
merely specified, and gives the proceed/stop recommendation.

## Contents

| File / folder | Item | Created or specified |
| --- | --- | --- |
| `CONCEPT_REPORT.md` | honesty fields, judgment, recommendation | created |
| `MODEL_SHEET.md` | 1–2: locked face, hair, beard, clothing, proportions, silhouette, expression set, identity anchors | specified (documented model sheet) |
| `POSES.md` | 3, 5, 6: squat/bench/deadlift key poses, deadlift setup→lockout sequence, bench 3/4 composition, one stage camera | specified |
| `EFFORT_CONTRAST.md` | 4: light vs max — seven channels | specified |
| `CARDS_AND_TITLE.md` | 7–8: separate 52→104 card compositions with measured runtime sizes; title concept with computed safe zones | specified (+ diagrams created) |
| `PIXEL_RULES.md` | 9: cluster, outline, dither, lighting, weight/contact, animation rules | specified |
| `PRODUCTION_SPEC.md` + `production-frame-list.csv` | 10: exact 320×320 package contract, 94-row frame list, delivery layout, acceptance | specified; CSV created |
| `palette/` | proposed v2 palette: JSON (source of truth), GPL, swatch sheet | created |
| `templates/` | lattice guide, proportion diagram, three card composition diagrams, two title safe-zone diagrams | created (guides and box diagrams, not art) |
| `reference-ai/` | five AI-generated, banner-stamped concept references + notes on what is wrong in each | created (AI images; direction only; do not trace) |
| `baseline/` | screenshot of the live 1280×800 attempts screen showing the measured 52 px top clip | created (evidence) |
| `tools/` | `make_concept_artifacts.py` (regenerates palette/templates/stamps), `preview_harness.py` (renders a package at real runtime sizes), `validate_package.py` (hygiene validator for the spec) | created, run |

## Hard rules honoured

- No files under `arcade/public/sprites/` or `arcade/art-source/` changed.
- No gameplay, judging, timing, scoring, or `feel.ts` changes.
- No `build_sprites.py`, no procedural primitives, no image-generation output as
  production art. Generated images live only in `reference-ai/`, stamped.
- Athlete remains the fictional Reed Hale; no likeness, borrowed asset, trace,
  or licensed character.
- `npm test` (53/53 + `check_sprites.py`) still passes on this branch; the app
  runs from the prior sprites.
