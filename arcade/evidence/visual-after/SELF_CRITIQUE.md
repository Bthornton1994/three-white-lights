# Visual self-critique — pass 4 (lockout, cards, title)

**Self-assessment: ISSUES_REMAIN.** Not MERGE_OK. Independent QA owns
SNES/Genesis sports craft, stage quality, card quality, and effort-state A/B.

Parent: `04ab61ca910ff1376e1082221781690733594451`.
`feel.ts`, judging, timing, scoring, `visualEffort` 0.96, squat/bench
masters, and PRs #63 #66 #67 #68 were not modified.

## What improved

- Deadlift judged frame is a standing lockout, not a setup rewind.
  Head is in frame (bbox y=12..319, h=307 vs setup h=179). Silhouette
  Δ(01,06)=31774. Light vs max lockout are different (more plates / mass).
- Title has no “POWER LIFTING” wordmark. HTML is the title. Phone uses a
  9:16 master; desktop uses 16:9 so the head is not cropped.
- Lift cards are two-up Light | Max at 162×104 (phone) / 190×190 (desktop),
  not a 96×84 smear. Squat hole, bench pause, deadlift lockout all show.
  Max art is on the select screen.
- Idle / success / miss share the identity lock more closely.

## Residual defects

1. Still Imagine-indexed, not hand-pixelled 320 SNES clusters. Palette
   posterizes under index. This method is near its ceiling.
2. Bench 3/4 at 320 is still the weakest lift (unchanged this pass).
3. Phone cards at 104px are readable vs 84px but are not a native card grid.
4. Identity is closer, not locked to a model sheet; hairline/beard still drift.
5. Deadlift pull frames 02–05 are a new sheet; 06 is a dedicated lockout overlay
   so scale/camera can hitch 05→06.
6. Title art still has no federated wordmark by design; some viewers may want
   a painted Iron & Amber mark later (do it in type, not Imagine text).

## If craft still fails

Stop iterating Imagine. Commission original 320×320 (or 80×80) frames from a
pixel artist with a model sheet, then NEAREST-index only for palette/alpha.

## Checks (evidence run)

- `check_sprites.py` ok, including lockout≠setup silhouette ≥2500.
- Arcade tests 53/53. Workspace `test:arcade` 46/46.
- Chromium `image-rendering: pixelated` on title, cards, stage.
- No overflowX at 390 or 1280. No pageerror.
- Card boxes 162×104 (phone) and 190×190 (desktop), Light and Max on every lift.
