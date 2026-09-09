# VL-3 Round 2B — Fable handoff packet

**Nothing in this document is a pass.** It exists to hand a human (Bryant, or
whoever plays it next) the evidence needed to judge VISUAL, WORLD
LEGIBILITY, ANIMATION FEEL, SOFT-FEEL and OWNER PLAYTEST — the five gates
CLAUDE.md's VL-3 ROUND 2B entry says this round may **not** close. Everything
below is a measurement or a plain description of a screenshot, never a
verdict on feel. §12.1 stays open.

This packet was assembled by a builder working under CLAUDE.md's ART FREEZE
(`src/empire/memberPuppet.ts`, `memberRig.ts`, `tools/bake-member-motion.mjs`,
`public/empire-art/**` untouched, no re-bake) and the round's technical
convergence scope (instrument scoping + evidence only, no mechanics
changes). Tree: `claude/vl3-evidence-2b`, built on top of the merged runtime
and instruments rounds.

## The exact owner-playable command, confirmed working from a clean shell

```
cd <repo>
npx vite --config vite.owner.config.ts --port 5174 --strictPort
```

then open (or headless-navigate to):

```
http://localhost:5174/owner-playtest.html?scenario=capacity
```

Confirmed this round: `tools/verify-owner-route.mjs --url http://localhost:5174 --both`
returned 16/16 verdicts green at both 390x844 and 375x812 against this exact
command and URL, on the clean committed tree at `4bb6862180f24c5da5c287bab2b08cc55bae9dfc`
(the commit stamped in `docs/design/living-gym-world/vl-3/owner-route-notes.json`).
The in-app played path (what a player reaches through the shell, no query
string) is `http://localhost:8084` reached via `bash tools/dev-web.sh`, then
tap `shell-open-gym` — that is a **different** route from the owner scenario
above and is what `tools/capture-living-world.mjs` and
`tools/capture-motion-proof.mjs` drive.

## Images in this packet

All captured from the running app this round (not the bake sheets), at
390x844 unless noted. Read with the Read tool by the builder before writing
the descriptions below — not assumed from filenames.

| File | What it's a capture of |
|---|---|
| `handoff/handoff-owner-view-relief.png` | Best owner-view capture: after the Capacity purchase, two members using two benches, 0 waiting |
| `handoff/handoff-play-surface-390x844.png` | The in-app Play surface (shell path, `capture-living-world.mjs`'s `using` frame) |
| `handoff/handoff-bench-01-setup.png` .. `-04-dismount.png` | Bench MOUNT/DISMOUNT sequence: setup, mount, press, dismount, in play order |
| `handoff/handoff-idle-wait.png` | An idle/wait sample |
| `handoff/handoff-walking.png` | A walking sample |
| `handoff/handoff-capacity-before.png` / `-after.png` | Capacity upgrade before/after pair |

## What I actually saw, in plain language

**`handoff-bench-01-setup.png` / `-02-mount.png` / `-03-press.png`.** At the
in-game scale (the member sprite is roughly 15-25px tall in a 390px-wide
frame), these three frames look **nearly identical to my eye** — a small
figure on a flat bench, arms raised, same silhouette, same framing. I could
not confidently tell setup from mount from press by looking at these three
screenshots side by side without the HUD/clip label. This matches — and adds
a data point to — residual B below: whatever is different between these
poses is real (the sheets show distinct poses at full art resolution, see
`sheet-dissolve.png` described below) but does not read at phone scale in a
static frame.

**`handoff-bench-04-dismount.png`.** This one IS legible: the bench is now
empty, the HUD's machine count drops from "1 on the machine" to "0 on the
machine" and "waiting" rises from 2 to 3, and two standing figures appear
near where the bench occupant was. I also see **two small red-and-white
circular shapes sitting at the head of the empty bench** that do not appear
in the setup/mount/press frames. I did not investigate what these are (out
of scope — no `src/empire/**` edits this round); flagging it in residual G
as something a human reviewer should look at, because it reads as either a
dropped prop or a rendering artifact and I cannot tell which from a
screenshot.

**`handoff-idle-wait.png` / `handoff-walking.png`.** Same observation as the
bench sequence: at phone scale, a standing "wait" pose and a "walking" pose
are both small enough that I cannot confidently distinguish a walk cycle in
progress from a standing idle by eye in a single frame. The walking capture
does show a figure with legs slightly more separated / mid-stride relative
to the standing figures beside it, which is the one visual tell I could
actually point to.

**`handoff-capacity-before.png` / `-after.png`.** This pair reads clearly.
Before: one bench, one member using it, gym bucks 357.84. After: **two
benches side by side**, "2 on the machine" (was 1), gym bucks 177.99 (the
180 charge, visibly deducted). This is the single most legible state change
in the whole packet — a human reviewer does not need any HUD text to see
that a second bench appeared.

**`handoff-owner-view-relief.png`.** Two members using two side-by-side
benches, 0 waiting, one member still standing/walking nearby. I also notice
the gym bucks readout shows `177.83999999999997` — raw floating-point
precision, unrounded, in player-facing HUD text. The same thing appears in
`handoff-play-surface-390x844.png` (`0.166666`) and
`handoff-bench-01-setup.png` (`0.249999`). This is not a puppet/animation
issue but it is a real, repeated, player-visible rough edge I saw across
three separate independent captures and am reporting under residual G rather
than silently passing over. There is also a black band at the bottom of this
capture below the "BACK TO TRAINING" pill — looks like unused viewport space
at 390x844 rather than a content bug, but I did not measure it.

**`sheet-dissolve.png` (pre-existing, at full art resolution — I re-opened
it this round rather than trusting the cited percentages).** At full
resolution the dissolve frames show two visibly different leg renderings
cross-fading: a sharp, saturated-skin-tone leg pose in front (the side-view
BENCH-SETUP/BENCH-MOUNT pose) and a greyed-out, semi-transparent leg pose
behind it at a **visibly different angle and stance width** (the
three-quarter pose it is dissolving toward). The two silhouettes do not
align — this is a directly visible confirmation of residual A's IoU numbers,
not just a percentage in a table.

**`sheet-phone-idle.png` (pre-existing, re-opened this round).** IDLE 0 vs
IDLE 6, and WAIT 0 vs WAIT 6, at the cited 74px scale: I can see a very
subtle head/chin angle difference between the two idle frames if I look
closely, and a similarly subtle difference between the two wait frames. It
is genuinely subtle at this size, consistent with residual B being recorded
as "intentionally subtle; whether it reads on a phone is a human call"
rather than as a defect.

## Residuals A-G

**(A) Side-view to three-quarter puppet swap at the bench dissolve.**
Measured intersection-over-union **33.2%** (41.8% ignoring the bar) —
unchanged this round (art frozen). Confirmed visually above: the two poses
being cross-faded are recognizably different silhouettes, not a smooth
continuation of the same pose. Not re-measured this round (no art change);
cited from the merged art round two work.

**(B) Breathing and head-nod subtlety at phone size.** Measured **29.1%** of
body pixels changed between idle frames 0 and 6 at 74px (against 0.0% before
that art pass) — unchanged this round. Confirmed visually above as
genuinely subtle at that scale. Extends beyond breathing/nod: the
setup/mount/press bench sequence and the idle/walk pair above show the same
general "distinct-in-source, hard-to-read-at-phone-scale" pattern, which is
a broader instance of the same finding rather than a separate one.

**(C) Foot skating — measured this round, both the depth-axis exclusion and
the real residual behind it.** `tools/capture-motion-proof.mjs`'s
`walkFootPlanted`/`noSkate` was scoped this round to stances whose net
travel is predominantly horizontal, because `floorSim.ts` walks members on a
four-neighbour grid and the art has only a side-view walk cycle — no
toward/away-camera gait exists, so a depth-axis stance (net vertical travel
larger than net horizontal travel) cannot be judged by a horizontal-only
foot-planting formula. Final run at `26bed31db70d994ac1d87afb02efdf0069c60450`
(clean tree, localhost:8084, 90s budget):

  - 390x844: 9 of 17 stances excluded as depth-axis, max drift among them
    (unjudged) **0.7583 tiles**. Of the 8 surviving horizontal stances, max
    drift **0.8605 tiles** against the 0.05-tile tolerance — still FAIL.
  - 375x812: 10 of 17 stances excluded as depth-axis, max drift among them
    **0.6804 tiles**. Of the 7 surviving horizontal stances, max drift
    **0.0698 tiles** against 0.05 — still FAIL, narrowly.
  - An earlier run this round (`a2cdd571`, mid-development) showed the same
    shape with different exact numbers (390x844: 8/19 depth-axis excluded,
    max 0.6919 tiles unjudged; 11 horizontal stances, max drift 0.1791
    tiles) — the live browser sim is not frame-identical run to run, but the
    pattern (large depth-axis drift correctly excluded, a smaller but
    still-over-tolerance horizontal residual remaining) reproduces every
    time it was run.

  **The remaining horizontal-axis residual is real, not a scoping artifact,
  traced directly to trace rows (not inferred):** during the
  `bench-dismount` -> `bench-finish` "leaving" settle glide, the drawn point
  moves steadily in one screen direction (e.g. `drawnX` rising ~195px to
  ~262px over roughly 20 frames, confirmed by reading the raw trace JSON) while
  the member's stated `facing` stays `left` throughout. `facingStable`
  measures the same mechanism directly: longest disagreement run fell from
  **62 frames to 16-17 frames** once the derived motion floor excluded true
  noise (see below), but 16-17 still exceeds N=13-14 (the
  `FLOOR_MEMBER_GAIT_TRANSITION_MS` hysteresis window). This is a real,
  sustained (~270-330ms), measured mismatch between visible travel direction
  and stated facing during one specific transition, not sub-pixel jitter and
  not a coordinate-system artefact. It is a `src/empire/**` runtime finding
  (`memberMotion.ts`'s facing rule around `bench-dismount`/`bench-finish`)
  and is **not fixed this round** — the art/runtime freeze applies, and this
  piece's scope was the instrument, not the mechanic. Full numbers and the
  scoping derivation are in `tools/capture-motion-proof.mjs`'s own header and
  in this round's builder report; the still-red evidence bundle itself is
  kept in scratch, not committed, per this round's "never commit a red
  record as evidence" rule — see
  `docs/design/living-gym-world/vl-3/motion/STALE.md` for exactly why the
  committed `motion/` bundle in this directory does NOT reflect the current
  tree.

**(D) Root drift — NOT MEASURED this round.** No instrument in this round's
tool set computes a dedicated "cumulative root position error over a long
session" metric distinct from the per-stance drift already reported under
(C) and the per-change-event `noFamilySnap` check (which passed cleanly,
0 illegal frame resets, both viewports, this round). If "root drift" means
something more specific than those two, it needs its own instrument; stating
this honestly rather than repurposing an adjacent number to answer a
question it wasn't measuring.

**(E) Scale / perspective pop — measured, within bound.** Final run,
`scaleContinuous` TRACE half (the painted scale, not the stale `data-scale`
DOM attribute): max |Δscale| per frame **0.0080** (both viewports) against a
derived bound of **0.0357** tiles/frame (`SETTLE_FRAME_BOUND_TILES ×
(1/FLOOR_CAMERA_BACK_SCALE − 1)/rows`). Comfortably under the bound — no
visible "pop" in scale should be present; a human should confirm this reads
as smooth on a phone, not just in the number.

**(F) Station and bar alignment — measured, `stationAttached` passed
cleanly.** Final run: offset spread during `bench-press` **0.0000 tiles**
against a 0.05-tile tolerance (both viewports — the drawn point is locked
exactly to the bench's centre-relative offset while pressing); 0 growth
violations over the tolerance during `bench-setup` (54-55 frames), 0 shrink
violations during `bench-finish` (55-56 frames). This is the strongest
"green" number in the whole motion instrument this round.

**(G) Anything that still reads as a cut-out puppet rather than a living
person, including my own eyes on the captures.** At phone scale the members
are small enough (roughly 15-25px tall) that I could not, from a single
static screenshot, confidently read individual limbs, a face, or a specific
pose beyond "person standing" or "person on a bench." That is consistent
with — not new evidence beyond — residual B. Two things I noticed that are
NOT puppet/art issues but are real and repeated: (1) the gym bucks HUD
displays raw floating-point values without rounding
(`0.249999`, `0.166666`, `177.83999999999997`), seen across three
independent captures; (2) two small red/white circular shapes appear at the
empty bench immediately after dismount in `handoff-bench-04-dismount.png`
that I could not identify from a screenshot alone. Both are named here for a
human to look at directly rather than adjudicated by a builder who cannot
play it.

## What this round did NOT do

No `src/empire/**` edit. No re-bake. No aesthetic recolour, silhouette
change, or new dissolve trick. No claim of VISUAL, WORLD LEGIBILITY,
ANIMATION FEEL, SOFT-FEEL, OWNER PLAYTEST, or NATIVE PERFORMANCE — all of
those are Bryant's (or the next human phone replay's) to close. Every number
in this document was measured this round against the tree at
`26bed31db70d994ac1d87afb02efdf0069c60450` (or an earlier commit on this same
branch, named explicitly where cited) — re-run the tools yourself if this
document is more than a few commits old.
