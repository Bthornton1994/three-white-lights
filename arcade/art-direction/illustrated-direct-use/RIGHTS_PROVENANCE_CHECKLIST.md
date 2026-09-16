# Rights / provenance checklist — Fable concept files

**Production classification: BLOCKED** until every row below is documented
with an owner sign-off. This scaffold is not a license grant.

Existing safeguards are **preserved**. Do not delete, rewrite, or cover:

- Red banner stamps on `reference-ai/AI-REF-0{1-5}-*.png`
- `arcade/art-direction/concept-fable-20260916/reference-ai/README.md`
  (do-not-trace, not-production-art, likeness warning)
- `arcade/art-direction/concept-fable-20260916/README.md` and `CONCEPT_REPORT.md`
- `arcade/art-source/internal-draw-index/PROVENANCE.md` (PR #70 sprite package)

## Checklist

| Topic | Status | What is known | What is unknown |
| --- | --- | --- | --- |
| **Provider** | PARTIAL | Files were produced in the Fable 5.1 concept run (PR #71) via Cursor's image-generation tool from text prompts written for that draft. `CONCEPT_REPORT.md` records requested model `claude-fable-5-1` / self-reported Claude Fable 5.1. Prompts described an original fictional character (Reed Hale). | Exact provider legal entity, model-card URL, and whether Cursor vs a downstream image model is the licensor. **UNKNOWN pending provider identification in writing.** |
| **Usage rights (internal playable proof)** | OWNER-AUTHORIZED (this draft only) | Bryant authorized 2026-09-16 PT: direct hi-res use of *existing* Fable images in this isolated draft PR for a four-screen proof. Not a merge, not a deploy, not a production classification. | Whether that authorization extends past this draft PR. **UNKNOWN.** |
| **Usage rights (ship in a store build / production)** | **UNKNOWN — BLOCKED** | None documented. Concept README still says not production art. | Commercial use, app-store distribution, paid distribution. |
| **Redistribution rights** | **UNKNOWN — BLOCKED** | Files are already in this git repository on draft PR #71. This PR copies them at runtime for local/dev serving without modifying bytes. | Right to redistribute the bitmaps outside this repo, in marketing, or in a binary. Third-party model ToS on output redistribution. |
| **Likeness review** | **UNKNOWN — BLOCKED** | Concept README: "Do not treat any face here as Reed Hale's face." AI faces can resemble real people by accident. Athlete is specified as fictional Reed Hale; no real athlete was named as a reference. Banners remain on the files. Owner-revised bench stills (`bench-revised-20260916.png` and the unused racked candidate) carry the same concept-reference banner and are **not** a likeness clearance. | No documented human likeness pass on the five stills or the revised bench. Faces in AI-REF-01 and the lift stills are **not** cleared. |
| **Training-data / output-term compliance** | **UNKNOWN — BLOCKED** | Prompts claimed original character; no licensed sprite was supplied as a reference image (`reference-ai/README.md`). | Provider terms on using generated images as shipped game art. |
| **Trace / conversion prohibition** | PRESERVED | Direct display is the authorized path. Tracing, downsampling, indexing, lattice conversion, masks, and stamps remain forbidden. | — |
| **Attribution / banner** | PRESERVED | Files stay banner-stamped. UI also shows a draft classification banner. | Whether a shipped edition would require different credit. Not in scope until rights clear. |
| **PR #70 sprite provenance** | PRESERVED (unchanged) | Internal draw-then-index package; fictional Reed Hale; commercial grant claimed only for that pixel work. | Unrelated to Fable stills; do not conflate the two grants. |

## Gate

A later owner may reclassify **only** after:

1. Provider named and terms attached (link or excerpt, not a paraphrase).
2. Usage rights for the intended surface (dev proof vs production binary) stated.
3. Redistribution rights stated.
4. Likeness review signed (pass or fail) on all five stills.
5. Independent QA on the integrated SHA.

Until then: **not production-ready**. Verdicts in `DIRECT_USE_REPORT.md` cannot
override this gate.
