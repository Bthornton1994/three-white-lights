# Gate 1 production-art sample

One-time owner exception to INTERNAL_PIPELINE_CEILING. This folder is the
authored sample, not a docs-only brief.

See `HONESTY.md` and `PROVENANCE.md`.

```bash
cd arcade/art-source/gate1-sample/author
python3 export_sample.py
python3 check_gate1.py
python3 integrate_public.py
cd arcade/art-direction/concept-fable-20260916
python3 tools/preview_harness.py ../../art-source/gate1-sample/package/sprites /tmp/gate1-previews
```

Live app loads `arcade/public/sprites/`. Presentation-only changes:
per-lift miss/success paths in `sheets.ts`, integer nearest-neighbour stage
(320) and cards (104 / 208). `feel.ts` is not touched.
