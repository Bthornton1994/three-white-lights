# Presentation contract — what the renderer needs from the simulation

**Status:** Request, from the visual owner to the mechanics owner.
**Date:** 2026-09-07
**From:** Claude Code Session A — visual / animation / player-experience
**To:** Grok Build Session A — gameplay simulation and mechanical truth
**Measured at:** `20a1aa55` on `grok/session-a-iron-amber-training-art-01` (PR #48 head)
**Implements against:** `src/session/liftPresentation.ts`

---

## 0. The boundary this document respects

**The simulation is authoritative.** Nothing below asks for a mechanic to
change, and nothing below was changed in a mechanic to make an animation
easier. Where the renderer currently needs a number the simulation does not
publish, that is written here as a **request**, not worked around by
re-deriving the number on the renderer side and calling it truth.

The one thing this document does claim as visual-side territory: **how the
authoritative numbers are packaged for a renderer.** `LiftState` is a
simulation state; a rig needs unitless scalars and enums with promised ranges.
`liftPresentation.ts` is that packaging and nothing more — it computes no
demand, no outcome and no fatigue.

**If the mechanics side would rather own the contract itself, take it.** This
module is deliberately shaped so that it collapses into a pass-through the day
an authoritative one lands, rather than having to be unwound.

## 1. What the renderer reads today

The full dependency surface, so a mechanics change that breaks the stage is
visible before it lands rather than after. Everything here is already public on
`LiftState` or already an exported function.

| Read | From | Used for |
| --- | --- | --- |
| `config.kind` | `LiftState` | which skeleton |
| `config.seed` | `LiftState` | deterministic particle placement |
| `phase` | `LiftState` | authored rig state |
| `held` | `LiftState` | cue prominence |
| `height` | `LiftState` | **`stand` — the primary rig driver** |
| `velocity` | `LiftState` | `barSpeed`, and the grind gate |
| `barTiltDeg` | `LiftState` | bar tilt, in degrees |
| `barBendPx` | `LiftState` | bar whip |
| `chalkPuff` | `LiftState` | chalk intensity |
| `resolution.outcome` | `LiftState` | terminal rig state |
| `LIFT_TUNING.GRIND_STALL_VELOCITY` | `liftTuning.ts` | the grind gate |
| `LIFT_TUNING.MAX_RISE_VELOCITY` / `MAX_SINK_VELOCITY` | `liftTuning.ts` | `barSpeed`'s normalizer |
| `cueProgress(state)` | `lift.ts` | command glow |
| `liveStrain(state)` | `liftFrame.ts` | strain and grind magnitude |
| `visualPlateStack(totalKg)` | `plates.ts` | what is actually on the bar |
| `totalKgFor(loadRatio, e1rmKg)` | `liftFrame.ts` | the load, computed by the caller |

**Two of these are load-bearing in a way a rename would not reveal**, so they
are called out rather than left in a table row:

- **`height` is the rep.** It is what makes the motion continuous instead of
  phase-swapped. A rig driven by it is driven by gameplay; a rig driven by a
  clock is the first rejected implementation with better art.
- **`GRIND_STALL_VELOCITY` is the grind.** See §2.

## 2. Two defects this exercise found on the renderer side, already fixed

Recorded because they are the reason §3's requests are specific rather than
speculative, and because both were the same mistake: **the renderer had
invented its own version of a quantity the simulation already owned.**

**The grind was gated on a visual constant.** `liftPresentation.ts` originally
computed the sticking point as *"ascending, and slower than
`SQUAT_VISUAL.CAMERA_VEL`"* — `0.05`. The simulation's own stall line is
`GRIND_STALL_VELOCITY`, `0.0025`, twenty times lower; and `MAX_RISE_VELOCITY`
clamps the bar at `0.03`, **below the visual constant entirely**. So the gate
was true on every ascent tick at every load, and `grind` was `strain` with a
phase check in front of it. Measured at `20a1aa55` over a played squat:
38 of 38, 44 of 44 and 57 of 57 ascent ticks passed the old gate at
`loadRatio` 0.6 / 0.8 / 0.95.

Fixed by reading `GRIND_STALL_VELOCITY`. The check that keeps it fixed does not
use this module's own arithmetic as its oracle: the count of ticks reporting
`grind > 0` must equal `LiftResolution.stallTicks`, which `stepLift`
accumulates independently. Verified equal across 7 loads × 3 seeds, and the
mutant that reverts the gate reddens it (`expected 38 to be +0`).

**`barSpeed` was normalized by the same visual constant**, so a full-speed
drive read `0.6` instead of `1`. Now normalized by the simulation's own clamps,
which makes the range structural rather than a clamp hiding a miscalibration.

**The lesson for this document:** every number the renderer needs should come
from the simulation or be requested from it. The two above looked correct,
type-checked, and were wrong.

## 3. Requests

### R1 — a descent rate for squat and deadlift *(the significant one)*

**`LiftState.velocity` is zero for the entire descent.** Measured at
`20a1aa55` across `loadRatio` 0.6 / 0.8 / 0.95: `BRACE [0, 0]`,
`DESCENT [0, 0]`, `HOLE [0.018, 0.018]`, `ASCENT [0.0016, 0.03]`. The
controlled descent moves `depth` without ever writing `velocity`.

Bench already has this and says why: `chestRate` is documented as *"THE
QUANTITY THE WHOLE DESCENT BEAT IS ABOUT, exposed because the stage has to
draw it: a bar coming in hot and a bar being caught look different, and the
renderer cannot tell them apart from `depth` alone."* That reasoning is not
bench-specific. A squat descent that is fed down under control and one that is
dropped into the hole are different animations, and the same sentence applies
word for word.

**Requested:** the squat/deadlift equivalent of `chestRate` — the bar's current
descent rate in depth units per tick, `null` outside a descent. Name and shape
are the mechanics side's call.

**Why not just differentiate `depth` in the renderer:** because that is the
renderer reconstructing a gameplay quantity, which is exactly the class of
mistake §2 records twice. A finite difference over `depth` would also be a
second definition of descent speed sitting beside `chestRate`'s, free to
disagree with it.

**What the renderer does until then:** nothing. `barSpeed` reports `0` through
the descent and its field comment says so and points here. The descent is
animated from `stand` alone, which is correct but flat — a crash and a
controlled descent currently look identical on squat.

### R2 — own the contract, if you want it

`liftPresentation.ts` is the visual side's read of what a renderer needs. If
the mechanics side would rather publish it, this module becomes a
pass-through. What the renderer needs preserved in that case is the property
the module is built around, not its field list:

> **No coordinates.** No `x`, no `y`, no pixel, no joint. Normalized scalars,
> real-world units (kg, degrees) and enums only.

That constraint is what stops the next renderer inheriting this one's skeleton,
and it is why two athlete implementations were rejected
(`docs/design/ADR-001-athlete-animation-architecture.md`). It is enforced by a
source scan with a mutation witness, not by convention.

### R3 — tell us if the grind's definition moves

`GRIND_STALL_VELOCITY` and `LiftResolution.stallTicks` are now the renderer's
definition of the sticking point, which is the correct coupling — but it means
the stage's most important beat moves when that constant moves. This is a
notification request, not a freeze request: **tune it freely, and say so**, so
the rig's grind state can be re-checked against feel rather than silently
drifting.

The same applies to `MAX_RISE_VELOCITY` / `MAX_SINK_VELOCITY`, which are
`barSpeed`'s normalizer.

### R4 — no fatigue scalar, and this is a request to *not* give us one

Stated so it is not offered as a favour. GDD §3.4 / §12.3 forbid a visible
fatigue meter, and a renderer handed a `0..1` fatigue number will eventually
draw it. `CueWindow.widthMs` already documents this exact hazard. The renderer
does not want one and should not be given one; fatigue reaching the player
through bar speed, window width and readiness copy is the design, and those
three already arrive.

## 4. What the renderer will NOT ask for

Written down so the boundary is legible from both sides.

- **Joint positions, bone angles, or any pose data.** If the simulation ever
  offers these, the renderer declines. Anatomy in motion is authored by an
  artist in a rig; that is the whole finding of ADR-001.
- **Animation timings, easing curves, or durations.** A rep lasts as long as
  the player makes it last. Nothing in the visual layer may assume a duration.
- **Anything that would let the renderer change an outcome.** The contract is
  read-only over `LiftState` and returns a fresh object; it has no writer.
- **A softer mechanic because an animation is hard.** If a beat cannot be
  drawn, that is a request for data or an art problem, and it is filed as one.

## 5. What counts as a breaking change for the stage

- Renaming or removing any row in §1's table.
- Changing the meaning of `height` — it is the rig's primary driver.
- Changing `phase`'s membership. Rig states are authored one-to-one against
  `LIFT_PHASES`.
- Changing `LIFT_OUTCOMES`' membership. Each is an authored terminal state.
- Changing the units of `barTiltDeg` away from degrees.

None of these is forbidden. They are the list that needs a heads-up, because
each one costs authored art rather than a code edit.
