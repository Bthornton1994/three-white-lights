# SF-TWL-GYM-EMPIRE-UX-02 — design diagnosis

**Aligns** with GDD §2.4 / §5.14 / §5.15 Living Gym Doctrine. Presentation reset only. Economy, SKUs, Session A, and frozen lift math are unchanged.

Owner Bryant product-rejected HEAD `ea58acef` (A6-4-only chrome). That SHA is **REJECTED / NOT ACCEPT**. Bryant then **approved** visual direction **A × C IRON & AMBER**. This packet is a layout / IA / hierarchy reset plus chrome toward that look — not a restyle of the same editor, and not a claim that art fidelity is done.

Factory disk `software-factory/design/gym-empire-ux-02/` is **not mounted** in this Cloud (standing order and LOCKED product bar were not on disk). Diagnosis is from GDD + the live Gym Empire tree + the attached A×C mockup description.

## Layout failures (void / letterbox)

1. **Unset document root.** Expo web does not paint `html`/`body`/`#root`. Browser default is white. Any gap around the RN tree is a white void — not a gym.
2. **Centered board island.** `floorgrid-scroll-y` centers an 8×6 garage whose live tile is width-first. Leftover stage must be the same room, not a contrasting gap.
3. **GymScreen root reserved leave-pill clearance** for BACK TO TRAINING — unused band under the dock. Overlay HUD/dock; consume clearance on the floor so inspect/tray sit above the dock.
4. **HUD + dock ate layout** instead of overlaying a full-bleed stage.

## State / hierarchy failures

1. **Equal chrome.** Play / Shop / Staff / More as the same pills. Build FAB must not be an equal dock peer. BACK TO TRAINING must not be a shell peer over the gym.
2. **Editor on Play.** Grid, sprite labels, purple bay bars, gold selection boxes, tile instructions.
3. **Metric wall.** HUD stacked every number. Causal HUD is identity + purse + what/why/next from real state.
4. **Developer already gated (A6-4).** Keep that. Do not treat it as the product reset.

## A × C IRON & AMBER (approved look — first playable slice)

Warm garage institution: charcoal surfaces, amber CTAs, ivory text, three white referee lights as identity. Athletic heading weight. Inspect and Build on the real floor. Valid placement reads green; invalid stays crimson. Shop/Staff remain sheets over the gym.

**Not claimed done (HUMAN_REQUIRED):** HD illustrated isometric garage, brick/steel/wood scene lighting, stencil webfont, new member/equipment anatomy art. Current floor/members/equipment remain Stage 4 index sprites. Do not grade visual fidelity as accepted from this Cloud.

Playable-slice chrome toward that look (still not art-accepted): wood-tuned floor PNG on the board in Play; sienna brick surround in leftover stage; occupancy editor boxes Build-only; Build FAB hidden on Shop/Staff/More and stacked under a real inspect sheet (FAB lives inside the floor at highlight z-index so FloorGrid can cover it without GymScreen learning inspect state); athletic uppercase tracking on headings/dock/FAB; inspect/member sheets overlay the gym as a dock-cleared bottom card so Play taps show real station/member state without covering the room; Shop/Staff/More charcoal sheets over the gym with charcoal/amber cards and ivory player copy.

## Reset (this packet)

- Paint html/body/#root warm iron; sienna brick leftover around a wood board; overlay HUD/dock/action card.
- Sparse HUD: referee lights + location + purse + reputation. Causal now/next on a Play action card from real management / roster state.
- Build-only grid, labels, place copy, gold/black editor boxes, occupancy outlines. Play inspects without editor chrome; worn stations may show an amber inspect cue from real condition. Exit Build → Play with no residue (existing fade).
- Weighted IA: Gym (Play) home with amber active; Shop/Staff charcoal sheets over the gym; Build FAB on Play/Build only; More = settings including leave-gym; Developer explicit route only.
- Inspect panels use charcoal/amber/ivory, not prototype blue.

Soft feel remains **HUMAN_REQUIRED**. Empire Ready **NO**. Draft only. **NO MERGE**.
