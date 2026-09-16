# AI-generated concept references — NOT PRODUCTION ART

Every image in this folder was produced by Cursor's image-generation tool from a
text prompt written for this concept draft, then stamped with a red banner by
`tools/make_concept_artifacts.py`. They exist to communicate *direction* (mass,
camera, composition, mood, effort contrast) to a human pixel artist.

Rules:

- **Do not trace, copy, downsample, index, or "clean up" these into sprites.**
  That would be exactly the forbidden generator-as-final workflow
  (`STATE.json: stop_generators`).
- **Do not treat any face here as Reed Hale's face.** The final face is designed
  by the human artist from `../MODEL_SHEET.md` §3. AI faces can resemble real
  people by accident; the artist owns the likeness check on their own drawing.
- Text inside the images is unreliable and partly hallucinated (see notes).
- The live game does not load anything under `arcade/art-direction/`.

## Per-image notes (what to take, what to ignore)

| File | Take | Ignore / wrong |
| --- | --- | --- |
| `AI-REF-01-MODEL-SHEET.png` | Overall mass and proportion; kit (singlet, chevron, belt, burgundy sleeves, wraps, flats); the six-expression idea | Singlet legs are too long (spec: hem at mid-thigh); buckle is not clearly amber; back view lacks the chevron logic; exact facial features are not the locked face |
| `AI-REF-02-BENCH-THREE-QUARTER.png` | Camera (from the lifter's right, toward the feet, elevated); head at upper-left, feet lower-right; near plate stack large in front of the hips, far stack small behind the head; rack at left | **Hands are anatomically wrong** (not symmetric over the chest, one near the head, one near the hips); bar is not over the chest; hair drifts to grey; do not copy any anatomy |
| `AI-REF-03-DEADLIFT-SETUP-LOCKOUT-MAX.png` | Setup vs lockout as two clearly different silhouettes; lockout tells (shoulders back, chin up, bar at thigh, flushed strain); red 25 kg stacks | No visible bar bow; mixed grip not shown; hair colour drifts warmer in the lockout panel; the two panels are not the same scale |
| `AI-REF-04-SQUAT-HOLE-LIGHT-VS-MAX.png` | Effort channels side by side: load, bar bow, face flush, chalk; same depth in both panels | Both panels are slightly above competition depth — the spec requires hip crease below knee; plate count on the light side should be 1 red + 1 blue per side |
| `AI-REF-05-TITLE-SCREEN.png` | Logo lockup with integrated white circles; three physical judge lights as the brightest element; Reed from behind with chalk handprints; amber lamps; crowd silhouettes at the edges; hero content in the upper 60 % | **"PRESS START" and "© 1994 IRONWROUGHT GAMES" are hallucinated** — not this product, not a real studio; the runtime supplies all copy. Safe zones in `../CARDS_AND_TITLE.md` §3.2 were not applied to this image |

Prompts described an original fictional character; no real athlete, licensed
character, or existing sprite was named or supplied as a reference image.
