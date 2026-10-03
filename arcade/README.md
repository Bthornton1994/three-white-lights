# Three White Lights: Iron & Amber Arcade

Separate **web-first sprite arcade** edition. This package does not replace
Session A training, Meet Day presentation, Gym Empire, StageForge, or Loadout.

Title (exact): **Three White Lights: Iron & Amber Arcade**

## Loop

1. Choose squat, bench, or deadlift
2. Choose three attempts (weights may not decrease)
3. Timing / skill sequence (lift-specific)
4. Automatic RPE and hidden-fatigue consequences (no fatigue bar)
5. Score
6. Shareable federation-style results card

Sprites in `src/sprites/` are a new Iron & Amber arcade package. Do not import
legacy `src/art/**` sprites from other branches.

## Run

```bash
cd arcade
npm install
npm test
npm run dev
```

Game-feel values live in `src/feel.ts` and are untuned pending human playtesting.
