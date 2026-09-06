# TOKEN-MANIFEST — A × C IRON & AMBER

**SoT for the five published tokens.** Factory disk
`software-factory/design/gym-empire-ux-02/visual-direction/shared-assets/TOKEN-MANIFEST.md`
was **UNMOUNTED** on this Cloud (not on disk, not in GitHub, not in Notion).
This file is recreated from hexes already in playable chrome. **Do not invent
tokens.** No webfont, no SKU, no sixth colour.

Runtime empire `.tsx` still uses **named CSS only** (colour-literal scan). This
manifest maps token name → published hex → the named CSS already on GymScreen /
document root. It is documentation, not a parallel token module.

| Token | Hex | Named CSS in playable chrome | Bind |
| --- | --- | --- | --- |
| `iron.void` | `#1A1410` | html / body / `#root` in `index.ts` (`#1a1410`) | Document void. GymScreen stage is `transparent` so this shows through. |
| `iron.surface` | `#000000` | `black` | Sheets, dock, tray, button faces, FAB text, panel backing. |
| `amber.action` | `#DAA520` | `goldenrod` | BUILD FAB, dock top edge, primary CTAs, button borders. |
| `ivory.text` | `#FFFFF0` | `ivory` | Body copy, HUD brand / Garage, referee lights, floor language. |
| `ivory.muted` | `#C0C0C0` | `silver` | Disabled / muted chrome only (`GYM_SCREEN_BUTTON_DISABLED_TEXT_COLOR`). |

**Not tokens (do not promote):** `sienna` is Gym-home dock weight only;
`transparent` is the stage/floor knockout over `iron.void`; `springgreen` /
`crimson` remain Build placement validity (GDD), not palette additions;
`darkslategray` / `gray` remain disabled chrome.

**Direction ≠ verified ≠ player accept.** Soft feel **HUMAN_REQUIRED**.
