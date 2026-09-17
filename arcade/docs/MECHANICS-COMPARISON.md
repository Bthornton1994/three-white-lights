# Mechanics comparison — Iron & Amber Sprite Sport

**Status:** DRAFT / DO_NOT_MERGE. Not SNES craft. Not a merge gate.

## 1. Authoritative sources

| Layer | Commit | Notes |
| --- | --- | --- |
| Mechanics | `288db32c06232bb0fb65ce7236a0614c698a6920` | Session A A0 freeze. `createLift` / `stepLift`. |
| Sprite presentation | `1151569c40c77485ab9e9299e5db0db022437a8a` | PR #69 last known-good web SpriteStage + 6-frame sheets |

`lift.ts` SHA-256 `4dc74947ffc64f1af36da92c01a7cfb53d3f021b802cba31f67c3ecdcb24e417`
`feel.ts` SHA-256 `b26c21b520d17a8e87e6abac17661fc219870a2320a376b5b1b1adfe0bc2425c`

This branch does **not** retune either file. Presentation only.

## 2. Why this parent

PR #76 and PR #78 are illustrated-shell / two-tap descendants. They are left untouched.

The last web commit where `ArcadeApp` drives `SpriteStage` with the existing 6-frame sheets is PR #69 `1151569`. Session A career (`288db32c`) is the mechanics freeze, React Native Meet Day, not this web sprite renderer.

## 3. What changed

- Active lifts render on a shared 320×320 integer canvas.
- Per-frame anchors measured from existing PNG alpha (feet / plates / bench base).
- Frames animate from `liftPresentation`, not two amber windows.
- No DEPTH rail. Depth stays in the mechanic + prompt.
- No Fable stills on the live lift. Title / select / results keep PR #69 Iron & Amber chrome.

PRs #69–#78 are not modified.
