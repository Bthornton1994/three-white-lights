# Cursor QA handoff — Iron & Amber Arcade (Grok)

**DO_NOT_MERGE. Not visual approval. Feel is untuned.**

This is the Grok isolated arcade edition. Do **not** review or edit:

- [PR #63](https://github.com/Bthornton1994/three-white-lights/pull/63) Session A Iron & Amber training SoT
- [PR #65](https://github.com/Bthornton1994/three-white-lights/pull/65) Cursor arcade (`cursor/iron-amber-arcade-v1`)
- Session B empire, gym-management, StageForge, Loadout
- Rejected legacy sprites under `src/art/**`

Scope of this PR is **only** `arcade/` plus a root README pointer.

## Identity

| Item | Value |
|---|---|
| Product | Three White Lights: Iron & Amber Arcade |
| Branch | `grok/iron-amber-arcade` |
| Base | `main` @ `d1876f2` |
| Package | `arcade/` (standalone Vite + React + TypeScript) |
| Vision | Aligns with constraints (GDD §2.3 Arcade, §6.5 shareable card, §7.1 16-bit **for this edition only**) |
| Auth / DB | Off. Streak in `localStorage` (`ia-arcade-streak-v1`) |

## Playable path

```text
title
  → lift select (squat / bench / deadlift)
    → three attempts (weights may not decrease, 2.5 kg plates)
      → walkout
        → lift-specific timing (2 cues)
          → judging (2-of-3 white lights)
            → success or failure
              → transition (or bomb-out after 3 misses)
                → federation-style results card (share)
```

```bash
cd arcade
npm install
npm test          # 52 tests: math, loop, 2-good/2-great, sprite paths/PNG scenes,
                  # light-vs-max sheets, timing-clock reset, streak oracle (75 / 2235),
                  # share glyphs plus scripts/check_sprites.py (binary alpha, no chroma)
npm run dev       # Vite, default :5173
```

## P1 contract (this repair)

- Two in-window **good** taps = at least two white lights and a made lift.
- Two **great** taps = three white lights and a made lift.
- One valid cue + one miss = no lift.
- Visible amber band is the graded good zone. Taps outside it are early, late, or miss.
- Do **not** retune `src/feel.ts` on this pass.
- Walkout copy is lift-specific. Deadlift frame 6 is a lockout, not a setup rewind.

## Cursor code correctness (this pass)

- Timing elapsed resets to 0 in the same `startTiming` state object as the screen change.
- `continueAfterOutcome` is pure (no storage I/O). Streak persist is `persistFinishedMeet`.
- Cleared-key oracle: squat miss / miss / two-greats → **Streak 75 / Total 2235**, even if the updater runs twice.
- Share PNG rows include judge-light glyphs (`○` / `●`).
- Judging contract and `src/feel.ts` are unchanged.

## What to verify (human playtest owns feel)

1. **First screen is a title, not a form.** Copy + three white lights + "Step onto the platform".
2. **Lift art is visibly distinct.** Squat = bar on back / depth. Bench = lying on a bench. Deadlift = bar on the floor. There is no squat fallback (`arcade/src/sprites/sheets.ts` + `sheets.test.ts`).
3. **Timing is lift-specific.** Squat DEPTH·DRIVE, bench PAUSE·PRESS, deadlift PULL·LOCKOUT.
4. **Attempts cannot go down.** +/− steppers clamp; later attempts ≥ earlier.
5. **RPE is implied, not a slider.** Hidden fatigue has **no meter**. It shrinks timing windows and changes bar-speed copy.
6. **Scoring.** Weight, execution, streak, total on the HUD; DOTS + e1RM + 3×3 lights on the card.
7. **Bomb-out** is somber (three reds, total 0), not a joke game-over.
8. **Phone layout.** 390×844, no dead ends, no placeholder panels.
9. **Share card** draws a federation sheet (canvas PNG).

## Feel constants (do not scatter)

All tunable values live in [`src/feel.ts`](src/feel.ts). Current windows (playable, **not claimed correct**):

```
WINDOW_MS: squatDepth 340, squatDrive 360, benchPause 320, benchPress 340, deadliftPull 340, deadliftLock 380
GREAT_HALF_WINDOW 0.34
GOOD_HALF_WINDOW  0.88
FATIGUE_WINDOW_SHRINK 0.42
```

Agents must not pass feel. Human playtesting owns windows, haptics, and animation speed.

## Evidence (playable loop, not visual approval)

`arcade/evidence/`

| File | State |
|---|---|
| `title.png` | Title |
| `lift-select.png` | Distinct squat / bench / deadlift cards |
| `attempts-squat.png` / `attempts-bench.png` / `attempts-deadlift.png` | Attempt select |
| `bench-walkout.png` | Walkout |
| `bench-timing.png` | Timing lane |
| `squat-success.png` / `squat-outcome.png` | Good lift |
| `bench-transition.png` | Plate change / next attempt |
| `bomb-out.png` / `results-bomb.png` | Bomb-out + card |
| `results-squat.png` | Made-lift card (Weight / Execution / Streak / Total) |
| `app-builder-preview.png` + `-mobile.png` | Desktop + 390×844 smoke |

## Known defects (do not treat as pass)

- Sprite package is authored 16-bit (hard pixels, ≤32 colors, binary alpha). **Magenta chroma and silhouette fringe are removed.** Light vs max now uses separate 6-frame sheets (plates, compression, strain). This is still **below** a real SNES/Genesis sports A/B — faces, muscle mass, and grind weight need a human art pass.
- Title/platform are indexed PNGs. JPEG spotlight grain is gone. The backdrop is cleaner, not a finished Genesis title.
- Timing windows are playable after a widen from ~160 ms, **untuned**. `src/feel.ts` was not retuned on the art pass.
- Hidden-fatigue copy is honest; there is still no bar-speed animation curve beyond frame index vs progress.
- Share uses a canvas redraw of the sheet; native share sheet depends on the browser.

## Visual evidence (art pass)

Before (PR #66 visual baseline `5ed7dba`; rebased onto later #66 tip): `arcade/evidence/visual-before/`
After: `arcade/evidence/visual-after/`

Self-critique: `arcade/evidence/visual-after/SELF_CRITIQUE.md`. Visual bar is **ISSUES_REMAIN** — agents cannot self-certify the SNES sports A/B. Light vs max comparison: `visual-after/light-vs-max.png` and `before-after-light-max.png`.

## Out of scope (refuse if asked to add here)

Manual check-in, staff, shop, build mode, gym economy, accounts, multiplayer, Rive, 3D, StageForge adapter, full progression, ads, app-store, complex servers.

## Suggested Cursor QA sequence

1. `cd arcade && npm test` — judging + streak/share/timing + sprite QA.
2. `npm run dev` — play squat 2/3 makes to the card.
3. Play bench and deadlift far enough to confirm **distinct** walkout/timing poses (no squat reuse).
4. Miss all three → bomb-out card, total 0.
5. Screenshot 390×844 title, lift select, one timing, one card.
6. File notes against **this** PR only. Do not push onto #63 or #65.

Return: playable / not playable, defects, and whether feel should move in `src/feel.ts`. Do **not** merge. Do **not** claim visual approval.
