# PLAYABLE_REPORT — illustrated direct-use, full loop

**Status:** `DIRECT_USE_VISUAL_LIMITED` · **DO_NOT_MERGE** · not production-ready
**Parent / PR #73 head:** `d49add8390cedac38ddd4b37d769398cecfe9eb9`
**Branch:** `cursor/illustrated-direct-use-playable-20260916`
**Fable SoT:** `e9916eef091bd4ccce915e536902b8e739059e92`
**feel.ts SHA256:** `b26c21b520d17a8e87e6abac17661fc219870a2320a376b5b1b1adfe0bc2425c` (unchanged)

No new art was generated. No tracing, lattice, or AI edit. PR #70 sprites are not requested on illustrated screens.

## Revised bench (verified on disk, not prompt text)

| | SHA-256 | Git blob |
| --- | --- | --- |
| `arcade/art-direction/illustrated-direct-use/assets/bench-revised-20260916.png` | `6ded9e1d74512e42527a3e1e4d86d915d210f8326a07b331c34973c4ab99548b` | `012219995d6e82a80d98608204fa40bfbae5b701` |
| Size | 1233×1275 PNG | 2,233,476 bytes |

Not selected: `assets/not-selected/bench-racked-20260916.png`. `AI-REF-02` is preserved and **not loaded** on bench screens.

## What this tip finishes

Playable illustrated demo: title → lift select → attempts → walkout → timing → judging → success/failure → transition → bomb → results → share/download.

Every meet screen reuses an approved still with a visible “illustrated still” caption. Camera pan/zoom/lighting/vignette only. Stills are not animation.

Share/download composites existing `AI-REF-05` + `AI-REF-01` under the paper sheet. Numbers still come from `resolveAttempt` / `scoreMeet`.

## Checks

- arcade `npm test` **69/69** + `check_sprites.py` + illustrated hash lock
- workspace `npm run test:arcade` **68/68**
- `git diff` vs SoT / PR #73 head on `feel.ts`, `loop/`, `math/` is empty
- Chromium 390×844 dsf=2 and 1280×800: overflowX false, pageerror [], no `/sprites/` requests, no `AI-REF-02`, no `bench-racked`
- Desktop results actions (Share / Download PNG / Another lift) all visible (bottom y=717 of 800)
- Phone title `object-fit: contain` letterbox, `AI-REF-05` 390×405 art box
- Bench lift-select and bench timing `data-illustrated-file=bench-revised-20260916.png`

Evidence: `evidence/playable/`.

## Remaining limitations (honest)

- Rights/likeness still **BLOCKED**.
- No dedicated select cards, timing frames, success/fail/bomb/results illustrations.
- Phone title is still a letterboxed landscape still.
- Camera pan on diptychs is not a lift sequence.
- Imagine/Fable stills are concept-stamped. Not SNES production art.
- Independent QA is not claimed on this SHA.

DIRECT_USE_VISUAL_LIMITED
