# Art method — pass 4 lockout / cards / title (PR #69)

Stage production remains **320×320 masters**. Not 80×4.

## What this pass changed

1. **Deadlift lockout** re-authored from the identity lock as a standing
   finish (knees locked, hips through, bar at mid-thigh, head in frame).
   Setup hinge stays frame-01. Silhouette Δ(01,06) = **31774** px
   (gate ≥ 2500). Opaque bbox: setup h=179 y=139..318; lockout h=307 y=12..319.
2. **Title** is two quantized scene masters, no wordmark:
   - `title.png` 1008×1792 (phone)
   - `title-wide.png` 1792×1008 (desktop ≥860px)
3. **Idle / success / miss** re-drawn from the same identity lock.
4. **Squat and bench 320 masters were not regenerated.**
5. **Lift cards** no longer 96×84. Each card shows Light | Max from the
   320 masters (hole / pause / lockout). Phone 162×104 CSS; desktop 190×190.

## Source

Imagine draw-then-index, identity lock `426f1eb0`, integer-grid 320 export
(`import_pass4.py`). Magenta keyed, binary alpha, ≤48 sprite colors.

## Honest limit

This is still Imagine-indexed illustration, not hand-authored SNES pixels.
Independent QA owns the sports-craft call. If this still fails Slam Masters /
NBA Jam quality, the next source should be a human pixel artist in Aseprite
(true 320 lattice), not another generator pass.
