# Session A lift presentation contract

Grok owns **what happens**. Claude Code owns **what it looks and feels like**.

This file is the handoff. Implementation: `src/game/liftPresentation.ts`.
Do not bind a Session A renderer to `LiftState` fields Claude would have to
reinterpret. Call `liftPresentation(state, totalKg, prior?)`.

PR #48 remains **DRAFT / DO_NOT_MERGE**. The Skia squat puppet is **not** the
production visual. Do not generalize it to bench or deadlift.

## 1. Authoritative mechanical state

The sim is `createLift` / `stepLift` in `src/game/lift.ts` (A0 freeze).
Session prescription (RPE, fatigue-as-feel, load) lives in `src/game/session.ts`.
Fatigue has **no exported meter**. It already changed window width and capacity
before this contract runs. Do not reconstruct a fatigue bar.

## 2. Contract

```ts
import { liftPresentation } from '../game/liftPresentation';

const view = liftPresentation(state, totalKg, previousStateOrNull);
```

`totalKg` is the prescribed bar the session already computed (`totalKgFor`).
Pass the same number the HUD shows. The contract will not invent a different load.

## 3. Update cadence

Every sim tick. `PRESENTATION_TICK_MS` (`TICK_MS`, 1000 / `TICK_HZ`).
Call once per `stepLift`. Pass the previous `LiftState` when you have it so
`barAcceleration` is real.

## 4. Value ranges and units

| Field | Range / unit | Meaning |
| --- | --- | --- |
| `kind` | squat / bench / deadlift | Played lift |
| `phase` | BRACE DESCENT HOLE ASCENT LOCKOUT RESOLVED | Discrete region of one continuous rep |
| `barHeight` | 0..1 (may clip) | 0 = hole/floor, 1 = lockout. **Drive the rig from this**, not from phase names |
| `depth` | 0..1+ | 0 = standing, 1 = authored bottom |
| `barVelocity` | height / tick | Negative = being beaten |
| `barAcceleration` | height / tick² | 0 if `prior` omitted |
| `strain` | 0..1 | Load + phase + current deficit |
| `grindIntensity` | 0..1 | 1 on stall / reverse / lockout slip |
| `effortBand` | easy / normal / hard / grind / failing | Derived band, not an animation name |
| `load.discs` | kg, hue, diameterMm | One sleeve, heaviest inboard. Mirror it. |
| `command.cueProgress` | null or 0..n | Timing window only. Not a target ring mandate |
| `command.held` | bool | Finger down |
| `chalkPuff` | 0..1 | Mechanical puff intensity |
| `complete` | bool | `phase === RESOLVED` |
| `outcome` | good-lift / grind / miss / null | Null until resolved |

Bar pose extras (`barForwardPx`, `barLateralPx`, `barTiltDeg`, `barBendPx`) are
sim-authored millimetre-ish sprite px. Scale them in the renderer. Do not
recompute physics from them.

## 5. Lifecycle

`BRACE` → (squat/bench `DESCENT`/`HOLE`) → `ASCENT` → `LOCKOUT` → `RESOLVED`.

Deadlift never enters `DESCENT` or `HOLE`. `barHeight` still moves 0 → 1.

Failure can resolve from hole, stall, timeout, or dropped lockout. Read
`outcome` + `missReason`. Do not invent a miss.

## 6. Success / failure

- `lockedOut` — reached lockout this rep (or resolved a make).
- `complete && outcome === 'miss'` — failed. `effortBand` is `failing`.
- `outcome === 'grind'` — made it, ugly. Mechanical grind, not a facial cue.

## 7. Plate / load

`load.totalKg` is what the HUD must match. `load.discs` is `visualPlateStack`.
Do not paint a 220 kg bar on an 80 kg set. Hue is IPF colour language
(RED 25 / BLUE 20 / YELLOW 15 / GREEN 10 / BLACK change).

## 8. Read-only

Everything on `LiftPresentationState` is read-only. Claude must not write back
into `LiftState`, retune `lift.ts` / `liftTuning.ts`, or derive RPE, fatigue,
velocity, grind, success, or plate math locally.

`promptFor(state)` remains the copy source for the command line.

## 9. What this contract will not include

- Face / hand / cloth instructions
- Animation clip names
- Camera paths
- Iron & Amber palette
- Bone names
- JPEG plate ids

If it is how it looks, it stays on Claude's side.

## 10. Extension process

Claude may request a field.

1. Is it mechanical fact already in `LiftState` or load? Grok adds it here.
2. Is it visual preference (shake amplitude, glow, clip)? Grok declines.
3. Would it require changing A0/A2 frozen behaviour? Escalate. Do not silent-retune.

Open a Session A mechanics request. Do not patch `lift.ts` from a visual PR.

## Debug schematic

`src/session/SquatScene.tsx` is a **rejected** player-facing puppet. It must not
be the production athlete. If retained, debug-only. Gameplay (`src/game`) does
not import it. Bench/deadlift must not copy it.
