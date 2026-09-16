# Decision — Iron & Amber Illustrated Arcade

**Status:** owner-authorized draft path · **DO_NOT_MERGE** · **not production-ready**
**Authorized:** 2026-09-16 PT by Bryant
**Branch rule:** new isolated branch only. Do not push to PRs #69, #70, #71, or #72.

## 1. Product edition

**Name:** Iron & Amber Illustrated Arcade

This is a separately named visual edition of the existing arcade loop
(*Three White Lights: Iron & Amber Arcade*). It is a presentation overlay.
It is not a new game, not a GDD rewrite, and not a production visual lock.

## 2. Vision / GDD classification (AGENTS.md)

| Document | Reading |
| --- | --- |
| VISION — "The visual identity must communicate weight" | **Aligns with constraints.** Hi-res illustrated stills are used so mass, plates, strain, and hall lighting remain readable. |
| VISION — "The lift comes first" | **Aligns.** Gameplay loop, `feel.ts`, judging, timing, and scoring are unchanged. |
| GDD §2.3 Arcade | **Aligns.** Same choose-lift → attempts → timing → card loop. |
| GDD §3.4 no fatigue bar | **Aligns.** No fatigue meter is introduced. |
| GDD §7.1 Base style — 16-bit SNES / Genesis | **Conflicts as a production art bar.** This edition does **not** replace §7.1. The 16-bit sprite bar remains the production pixel-art target. This PR is an owner-authorized, non-production illustrated overlay that Independent QA compares against Fable PR #71 stills, not against SNES sprites and not against PR #72. |
| GDD §7.2 anime cut-ins | **Vision / GDD are silent** on using Fable concept stills as full-screen backdrops. This edition is not a cut-in system. |
| CLAUDE.md hard constraints | **Aligns.** No pay-to-win, no gacha, no fatigue bar, no forced ads. |

`VISION.md` and `docs/GDD.md` are **not** edited in this path. The conflict with
§7.1 is recorded here instead of silently rewriting the governing docs.

## 3. Visual source of truth

- Fable concept PR #71 @ `e9916eef091bd4ccce915e536902b8e739059e92` is the
  approved visual source of truth (strongest work so far).
- Files live in `arcade/art-direction/concept-fable-20260916/`, especially
  `reference-ai/AI-REF-0{1-5}-*.png`.
- Owner-revised bench stills for the PR #73 follow-up live under
  `illustrated-direct-use/assets/` (versioned; not written into `reference-ai/`).
  Bench select and bench timing load only `bench-revised-20260916.png`.
- `FABLE_PRESERVATION_FAILED`, if it appears on other branches, names a
  **sprite extraction** failure. It does not mean the Fable concept is unusable.
- PR #72 (`44fa0652495cea0c92c0d4e14f1c5c10fc6d6cc6`) is a technical
  prototype only. Masks, stamps, posterization, and 160→320 lattice conversion
  are **not** the quality target. Do not optimize toward that look.

## 4. What this edition may do

Direct high-resolution illustrated assets are allowed.

Approved motion (presentation only):

- responsive composition (`object-fit` / `object-position` per viewport)
- camera pan / zoom (Ken Burns / progress-driven camera)
- lighting overlays
- vignette
- UI animation
- timing-lane / needle effects already in the arcade HUD

Full sprite-frame animation is **not** mandatory for this edition.

## 5. What this edition must not do

- Generate new art (no image-generation tool, no new concept stills).
- Procedural body construction, geometric masks, ASCII / stamp figures.
- Posterization or 160→320 lattice conversion of Fable files.
- Convert Fable images into sprite sheets.
- Use PR #72 converted pixels as the visual target.
- Use `templates/` lattice guides, card box diagrams, palette swatches, or
  the baseline screenshot as in-game art. Those are diagrams / evidence, not
  illustrated assets.
- Alter PRs #69–#72 or push to those branches.
- Merge or deploy.
- Call the result production-ready.
- Remove or weaken existing provenance, provider-term, or likeness safeguards
  (`arcade/art-source/internal-draw-index/PROVENANCE.md`,
  `concept-fable-20260916/reference-ai/README.md`, banner stamps on the PNGs).
- Change `arcade/src/feel.ts` or any judging / timing / scoring module.

## 6. Gameplay loop

Unchanged:

1. Title → lift select → three attempts → walkout → timing → judging →
   success/failure → transition / bomb → results card.
2. Hidden fatigue still has no meter; it still shrinks timing windows.
3. Shareable federation-style card remains a real scored card, not a cosmetic
   fake.

Screens **outside** the four-screen proof (attempts, walkout, judging, outcome,
bomb) may still show the pre-existing PR #70 sprite package that already ships
on this tip. That mixed presentation is documented as a gap, not silently
papered over.

## 7. Production classification

Fable files are **blocked from production classification** until provider, usage
rights, redistribution rights, and likeness review are documented.

See `RIGHTS_PROVENANCE_CHECKLIST.md`. Unknowns are marked UNKNOWN. Filling
them with guesses is forbidden.

## 8. Proof scope

Wire **only existing Fable images** into a playable proof for:

1. Title screen
2. Lift selection
3. Results card
4. One timing screen

If a dedicated asset is missing, the screen is marked LIMITED or skipped with
documentation. Do not invent replacements.

## 9. Independent QA

Independent QA compares this proof against **Fable concept PR #71**, not
against failed PR #72 output. Feel remains owned by human playtesting.
This path is not a craft PASS on the GDD §12.2 16-bit sprite bar.
