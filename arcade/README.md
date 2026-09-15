# Three White Lights: Iron & Amber Arcade

Separate **web-first sprite arcade** edition. This package does not replace
Session A training, Meet Day presentation, Gym Empire, StageForge, or Loadout.

Title (exact): **Three White Lights: Iron & Amber Arcade**

## Loop

1. Choose squat, bench, or deadlift
2. Choose three attempts (weights may not decrease)
3. Timing / skill sequence (lift-specific)
4. Automatic RPE and hidden-fatigue consequences (no fatigue bar)
5. Score weight, execution, streak, and total
6. Shareable federation-style results card

Sprites in `public/sprites/` are a new Iron & Amber arcade package. Do not import
legacy `src/art/**` sprites from other branches. Squat, bench, and deadlift have
distinct sheets — there is no squat fallback.

## Run

```bash
cd arcade
npm install
npm test
npm run dev
```

Playable path: title → lift select → attempts → walkout → timing → judging →
success/failure → transition → results card.

Game-feel values live in `src/feel.ts` and are **untuned** pending human playtesting.

## Evidence

Browser captures from this agent's local run live in `arcade/evidence/`.
They are proof of a playable loop, **not visual approval**.

Cursor QA: see [`CURSOR_QA.md`](CURSOR_QA.md).

## Known defects

- Two in-window good taps now keep a 2-white majority. Feel values in `src/feel.ts` are still **untuned**.
- Deadlift frame 6 is a standing hip lockout, not a setup rewind. Mid-pull head stays in-canvas.
- Sprite package was replaced with authored 16-bit frames (binary alpha, no magenta key). This is **not** a SNES sports A/B pass — faces, mass, and grind still need a human art pass.
- Title/platform are indexed PNGs (no JPEG grain). Spotlight dither is clean, not film grain; it is still simpler than a Genesis title backdrop.

## Out of scope

Manual check-in, staff, shop, build mode, gym economy, accounts, multiplayer,
Rive, 3D assets, StageForge adapter work, full progression, ads, app-store
submission, complex server infrastructure.
