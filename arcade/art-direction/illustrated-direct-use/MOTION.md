# Approved motion — named constants

Game-feel values for **this edition's presentation** live in
`arcade/src/illustrated/motion.ts`. They are untuned. Human playtesting owns
whether the pan/zoom/vignette feels right.

They are **not** in `arcade/src/feel.ts`. Timing windows, haptics, and scoring
weights stay where they are.

## Allowed

| Kind | Where | Notes |
| --- | --- | --- |
| Responsive composition | title, lift stills, results backdrop | Phone title uses `object-fit: contain` (letterbox). Desktop title may cover. |
| Camera pan / zoom | title Ken Burns; timing progress camera on diptychs | CSS transform / object-position. No new frames. |
| Lighting overlay | all four proof screens | CSS gradient, not a baked relight of the PNG |
| Vignette | all four proof screens | CSS radial, not a file edit |
| UI animation | buttons, lights, timing lane needle | Existing arcade HUD |
| Timing effects | timing lane + progress-driven camera | Needle and windows still come from `timing.ts` |

## Forbidden as "motion"

- Sprite-sheet playback built by slicing Fable stills
- Crossfading between posterized / lattice frames
- Masked limb swaps
- Any pixel rewrite of the source PNGs

`prefers-reduced-motion: reduce` disables Ken Burns and holds the camera still.
