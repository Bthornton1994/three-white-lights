# DIRECT_USE_REPORT — Iron & Amber Illustrated Arcade

**Draft PR:** https://github.com/Bthornton1994/three-white-lights/pull/73
**Labels:** `ILLUSTRATED_DIRECT_USE`, `DO_NOT_MERGE`
**Branch:** `cursor/illustrated-direct-use-8271`
**Fable SoT (CoS):** `e9916eef091bd4ccce915e536902b8e739059e92` (PR #71)
**Proof tip:** this follow-up commit on `cursor/illustrated-direct-use-8271` (exact SHA in PR #73 body)
**feel.ts SHA256:** `b26c21b520d17a8e87e6abac17661fc219870a2320a376b5b1b1adfe0bc2425c` (identical to SoT)

## What this is

Owner-authorized **docs-first decision + isolated four-screen proof**. Direct display of existing Fable concept stills, plus one owner-revised bench still stored **outside** the Fable SoT folder. Not a GDD rewrite. Not a merge. Not production-ready. Independent QA is **not** claimed on this tip.

## Alignment

- **Aligns with constraints:** VISION weight/readability; GDD §2.3 arcade loop; no fatigue bar; gameplay untouched.
- **Conflicts (recorded, not silently patched):** GDD §7.1 16-bit SNES/Genesis remains the production sprite bar. This edition is a separately named overlay. Independent QA compares against PR #71 stills (and the owner-revised bench on bench select/timing), not PR #72.
- **Silent:** using Fable concept stills as full-screen backdrops rather than artist-only direction.

`VISION.md` / `docs/GDD.md` were not edited.

## Follow-up (owner-revised bench + phone title)

Owner miss on the first tip: Bryant’s revised bench PNGs were not integrated. This tip wires **image 1 (mid-press)** only.

| Item | Value |
| --- | --- |
| Selected asset | `arcade/art-direction/illustrated-direct-use/assets/bench-revised-20260916.png` |
| SHA256 | `6ded9e1d74512e42527a3e1e4d86d915d210f8326a07b331c34973c4ab99548b` |
| Size | 1233×1275 |
| Why selected | Mid-press; bar over mid-lower chest; both hands on the bar. CoS preferred. Fewer critical grip failures. |
| Not selected | `assets/not-selected/bench-racked-20260916.png` SHA256 `c718bca6b06d24b87c3c900d83e019618bd2b37878bcd42020bf66816cd20d65` — racked pose; mangled viewer-right hand. Not clearly better for select+timing. |
| Fable original | `AI-REF-02-BENCH-THREE-QUARTER.png` SHA256 `0e4410b6dc472bd423bdb551cce7497978c062fb55e9148896c7bf8fabe923b7` — **untouched**. Not loaded on bench select or bench timing. Runtime bundle does not contain the `AI-REF-02-BENCH-THREE-QUARTER` string. |
| Title fix | Phone uses `object-fit: contain` in an upper letterbox (Ken Burns off). Desktop may still cover. |

No new art was generated. Bytes are copies of the owner attachments. `reference-ai/` was not overwritten.

## Proof screens (inspected in-browser at 390×844 and 1280×800)

| Screen | File | Result |
| --- | --- | --- |
| Title | `AI-REF-05` | Wired. **Phone lockup now reads “THREE WHITE LIGHTS”** (contain / letterbox; no `ITE LIG` cover-crop). Still a landscape still with hallucinated PRESS START in the bitmap. LIMITED chip. Desktop cover + Ken Burns still shows the full lockup. |
| Lift select | squat `AI-REF-04`, **bench `bench-revised-20260916.png`**, deadlift `AI-REF-03` | Wired. Bench card `data-illustrated-file="bench-revised-20260916.png"`; network `GET /illustrated/direct-use/bench-revised-20260916.png`. **No `AI-REF-02` request.** No dedicated select cards. LIMITED chips. |
| Results | backdrop `AI-REF-05` + `AI-REF-01` contain | **No dedicated card art.** Federation sheet is the existing `ResultsCard`. Share PNG unchanged. LIMITED chip. Desktop 800px still clips Share/Another lift. Not recaptured this follow-up. |
| Timing (deadlift, original designated) | `AI-REF-03` diptych, contain + HUD | Still the original four-screen designated capture. Evidence files `*-timing.png` unchanged. |
| **Timing (bench, this follow-up)** | **`bench-revised-20260916.png` contain** | Wired. `data-illustrated-file="bench-revised-20260916.png"`. **No `AI-REF-02` request.** Not a frame sequence. LIMITED chip. |

Attempts / walkout / judging / outcome now reuse approved stills with an illustrated-still caption (see `PLAYABLE_REPORT.md` on the playable follow-up branch). PR #70 sprites are not requested on illustrated screens.


## Browser evidence (this tip)

Captured from `vite preview` at `http://127.0.0.1:4174/` after `npm run build`. CSS-pixel screenshots. Console errors: 0. Network filter `AI-REF-02`: **no requests**.

| File | Viewport | What it shows |
| --- | --- | --- |
| `evidence/390x844-title.png` | 390×844 | Title lockup fully readable; letterboxed landscape still |
| `evidence/390x844-lift.png` | 390×844 | Lift select; bench card is revised mid-press |
| `evidence/390x844-lift-bench-card.png` | 390×844 | Bench card crop only (`bench-revised-20260916.png`) |
| `evidence/390x844-timing-bench.png` | 390×844 | Bench timing; revised still, contain |
| `evidence/1280x800-title.png` | 1280×800 | Title lockup fully readable |
| `evidence/1280x800-lift.png` | 1280×800 | Three cards; bench is revised mid-press, not AI-REF-02 |
| `evidence/1280x800-timing-bench.png` | 1280×800 | Bench timing; revised still, contain |

Original deadlift timing + results captures remain: `390x844-timing.png`, `1280x800-timing.png`, `*-results.png`.

## Rights gate

**BLOCKED.** Provider entity, production usage, redistribution, and likeness review are UNKNOWN. Banner stamps and concept README were not removed. The owner-revised bench stills carry the same concept-reference banner and are **not** a likeness or production clearance. See `RIGHTS_PROVENANCE_CHECKLIST.md`.

## Checks actually performed

- Inventoried SoT files at `e9916eef`. Five `reference-ai` stills left byte-identical. Revised bench stored under `illustrated-direct-use/assets/` only.
- `git diff e9916eef -- arcade/src/feel.ts arcade/src/loop arcade/src/math` empty. `reference-ai/` not modified.
- `npm test` 63/63 + sprite QA + illustrated hash check (5 Fable stills + revised bench). `npm run build` ok. Dist copy of revised bench SHA256 matches.
- Playwright at 390×844 and 1280×800: title, lift select, `/?proof=timing&lift=bench`. DOM `data-illustrated-file` + img `src` + network. No `AI-REF-02`. No `bench-racked`. Console errors 0.
- Independent critic on the **first** tip viewed eight evidence PNGs and recommended LIMITED (biggest gap then: 390 title crop). This follow-up does **not** claim that critic or Independent QA re-ran. CoS seats Independent QA after this SHA is confirmed.

## What remains (honest gaps)

- Rights/likeness sign-off on Fable stills **and** the revised bench before any production classification.
- Live session without `?proof=` freeze: title → lift → attempts → walkout → timing taps → judging → card. Confirm scoring unchanged in play.
- No dedicated select cards, no per-frame timing sheets, no dedicated results-card illustration.
- Phone title is readable but still a letterboxed landscape still (empty band between lockup and HUD). Untuned.
- Mixed PR #70 sprite presentation on screens outside the four-screen proof.
- Feel values remain **untuned**. `prefers-reduced-motion` camera hold not recaptured this tip.
- Do not compare this proof to PR #72 conversion output. Do not merge.
- Independent QA is not cleared on this SHA.

DIRECT_USE_VISUAL_LIMITED
