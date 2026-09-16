# Light-effort vs max-effort contrast plan

**CONCEPT ONLY. DO_NOT_MERGE.**

The runtime picks the `-max` sheet when `weight / e1RM ≥ 0.96`
(`arcade/src/sprites/sheets.ts`, `VISUAL.MAX_LOAD_RATIO`). So "light" is
*anything moving well up to ~95 %* and "max" is *a true limit attempt*. Light is
not "easy"; it is "in control". Max is "might not make it".

The audit's finding: light vs max read on plates and a strain face, but the max
attempt did not *animate heavier*. GDD §7.1: "a maximal squat must not animate
like a light one." Plate colour alone is hygiene. The following seven channels
must all change, and the artist should be able to point to each one in every
max frame.

## The seven channels

| # | Channel | Light | Max |
| --- | --- | --- | --- |
| 1 | **Load** | 1 RED + 1 BLU per side + collar (reads as competition plates, correct IPF colours) | 4 RED per side + collar; the near stack is 16 px thick and starts to hide the hip |
| 2 | **Bar** | Straight in every frame | Bows: 1 px at the sleeves in setup, 2–3 px in break/hole/sticking, straightens by lockout. The bow is the single most legible weight cue at 273 px |
| 3 | **Time budget** (same 6 frames, different spacing) | Even spacing through the range | Frames 3–5 sit within ~10 px of each other around the sticking point; frames 1–2 and 6 carry the big moves. The lift *stalls* on screen |
| 4 | **Body geometry** | Neutral: knees track out, torso angle from `POSES.md`, neck visible | Torso +5° more lean, knees cave 1 px then correct, traps swallow the neck (neck rows become trap), stance 2 px wider, shoulders rounded 1 px under the bar |
| 5 | **Face** | NEUTRAL → BRACE → EXHALE | BRACE → STRAIN (FLUSH from frame 3) → STRAIN at lockout, eyes shut on the grind frame |
| 6 | **Particles / contact** | None | Chalk puff 3–5 px at the hands on break (deadlift) or at the back on the hole (squat); 1 px sweat at the temple on the grind frame; shoes flatten 1 px (toes spread) |
| 7 | **Ground** | Shadow ellipse stance + 8 | Shadow ellipse stance + 12 and 1 row taller — the weight is pressing down |

Channels 2, 3, 4 are the *animation* answer. Channels 1, 5, 6, 7 are the
*frame* answer. A max sheet that only changes 1 and 5 is the failed PR #70
state.

## Per-lift specifics

**Squat**
- Light hole: bar y 96, torso 35°. Max hole: bar y 96 (same depth — depth is
  judged, never fake it shallower), torso 40°, bar bows 2 px, knees 1 px in.
- Max sticking frame (4): bar y ~90, *not* ~80. The audit's light/max squat
  differed by plates and strain but the bar moved the same distance per frame.

**Bench**
- Max pause: bar sinks 1 px into the singlet; 1 px BAR0 shadow under the bar
  on the chest. Max sticking: bar tilted 1 px (near end lower) — uneven lockout
  is the classic max-bench tell.
- Light has no spotter. Max has a spotter's *hands only* entering from the top
  edge on miss frame 2 (SKIN2/WRAP1, 6 × 4 px each). Never a whole spotter.

**Deadlift**
- Grip flips: light double overhand, max mixed (see `POSES.md` §2).
- Max break: hips rise 2 px before the bar leaves the floor (frame 2), which
  is what a heavy pull looks like. Light: hips and bar leave together.
- Max sticking at the knee, upper back rounds 1 px. Bar path still straight;
  no hitch.

## Cards

Cards must carry channels 1, 2, 5 at 52 lattice: red stack vs red+blue, 1 px
bar bow vs straight, STRAIN/FLUSH head vs NEUTRAL. Channel 4 is optional on
cards (shoulders 1 px rounder on max). See `CARDS_AND_TITLE.md`.

## What this plan cannot claim

Whether the max sheet *feels* heavy is a human playtest call, and frame timing
is driven by `feel.ts` progress → frame index, which this package does not
touch. The artist delivers the seven channels; the feel owner decides whether
frame spacing (channel 3) needs a runtime curve later.

Reference (AI, direction only, do not trace):
`reference-ai/AI-REF-04-SQUAT-HOLE-LIGHT-VS-MAX.png` shows channels 1, 2, 5, 6
side by side. Both panels are slightly above depth; do not copy the depth.
