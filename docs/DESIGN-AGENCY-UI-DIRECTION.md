# Design-agency UI direction

Status: design direction only. No gameplay or runtime implementation is included in this change.

## Product truth

Three White Lights is a powerlifting career game. The visual system must make the lift feel heavy, readable, earned, and emotionally consequential while preserving the one-lifter progression across training, career, gym, and meet-day views.

The core lift, authentic public rules, fair progression, short daily loop, and meet-day tension remain the authority. This document does not change those rules.

## Art direction

- 16-bit visual language with high readability at phone scale.
- Dense but calm information hierarchy: the player should understand the next meaningful decision immediately.
- Weight is communicated through bar speed, sticking points, plate readability, strain, timing, sound, and sparse high-intensity effects.
- Use contrast, silhouette, and motion to distinguish warm-up, routine work, grind, miss, and successful attempt.
- Reserve celebration effects for earned moments, especially meet-day outcomes and three-white-light confirmation.
- Keep the interface legible for both experienced lifters and new players learning the sport.
- Avoid generic idle-game chrome, casino-like reward presentation, pay-to-win affordances, and decorative effects that obscure the lift.

## Experience priorities

1. Open directly into the next meaningful lifting or career decision.
2. Make the current lifter, lift, attempt, load, RPE context, and consequence visible.
3. Teach unfamiliar powerlifting concepts in context instead of hiding them behind jargon.
4. Keep training, gym building, career, and meet day connected to one persistent lifter.
5. Make rest, recovery, misses, and setbacks understandable without shame.
6. Make attempt selection feel deliberate, not like a menu transaction.
7. Keep all critical interactions usable with keyboard, controller, touch, and reduced-motion preferences where supported.

## Interface principles

- One primary action per state.
- Stable navigation and clear return paths.
- Every result has an understandable cause and next step.
- Never use color alone for success, warning, miss, or judging.
- Use explicit labels for lift, weight, reps, attempt number, and judging state.
- Avoid hidden swipe-only or timing-only controls.
- Preserve readable text and touch targets at phone scale.
- Keep high-intensity animation skippable.
- Expose uncertainty when a system is an abstraction rather than a real physiological model.

## Required future review

Before implementing UI work, inspect the approved game source branch and the current stage gate. Produce a visual audit covering:

- core lift interaction
- session start and daily loop
- gym and career navigation
- meet-day attempt flow
- mobile readability
- accessibility
- controller/touch affordances
- motion and feedback
- progression comprehension

Any change affecting timing windows, bar path, RPE, scoring, progression, economy, meet rules, or player outcomes requires explicit gameplay review and human playtesting. Automated checks cannot establish game feel.

## Current implementation boundary

The current `main` branch contains project doctrine and documentation but no application source to redesign. This document therefore records the design direction without manufacturing a UI or claiming that game feel has been validated.

When an approved application branch is available, implement the smallest stage-scoped visual slice, open a draft PR, and verify it against the real artifact and human playtesting requirements.
