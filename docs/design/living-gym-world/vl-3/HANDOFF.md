# VL-3 Round 2C — Fable handoff packet

**Nothing in this document is a pass.** It exists to hand a human — Bryant,
or Fable — the evidence needed to judge VISUAL, WORLD LEGIBILITY, ANIMATION
FEEL, SOFT-FEEL and OWNER PLAYTEST, the five gates this round may **not**
close. Everything below is a measurement or a plain description of a
screenshot I opened and looked at, never a verdict on feel. §12.1 stays open.

Assembled under CLAUDE.md's ART FREEZE. `src/empire/memberPuppet.ts`,
`memberRig.ts`, `tools/bake-member-motion.mjs` and `public/empire-art/**` are
byte-identical to the round 2B tree. No re-bake, no repaint, no silhouette
change, no new dissolve, no scale change.

Round 2C tree: `claude/empire-s5-visual-lane`. Round 2B's packet is superseded
by this one; where a number below is carried forward from 2B rather than
re-measured, it says so.

---

## What round 2C closed, so Fable does not spend time on it

Round 2B's packet named seven residuals, two of which were technical defects
a builder had spotted but not adjudicated. Both are now diagnosed and fixed,
and two runtime defects nobody had named were found underneath them.

**1. The raw floating point in the HUD is gone.** `177.83999999999997`,
`0.249999`, `0.166666` and (in this round's own first capture)
`gym bucks: 0.233333` now read `177.92`, `0.250`, `0.167`, `0.23`. Formatted
at the presentation boundary only — no accrual, wear, income, wallet or tick
arithmetic was touched. The class turned out to be about thirty display
sites across three files, not the three witnessed values.

**2. The two red-and-white circular objects at the head of the empty bench
are identified, and they were a renderer bug.** They are the Stage D2.2
plate-loading changeover discs — `crimson` disc, `white` hole — armed
correctly by the sim on the exact `using` → `leaving` transition the capture
caught. The baked bench and plate-stack PNGs were opened and are clean, so
the art candidate was eliminated by looking rather than by argument. Under
Play every element's `zIndex` is its own projected screen depth, ordinarily
in the hundreds; the discs kept a Build-only ordinal constant of 2 and lost
every comparison against their own bench's chip, which painted over their
lower halves. That is exactly the flat-bottomed crescent shape in
`handoff/2c-bench-dismount-before.png`. `handoff/2c-bench-dismount-fixed.png`
is the same moment after the fix, with both discs whole.

**A question for Fable that the fix creates rather than answers:** the discs
are now fully visible, and at phone scale they read as two red dots resting
on a bench rather than as weight plates being loaded onto a sleeve. Whether
that is the right visual language for a changeover is an art question, not a
z-order question, and this round did not touch it.

**3. A member leaving a bench no longer walks backwards.** The facing rule
refused to mirror the body on any frame of `bench-dismount` and on all but
the last frame of `bench-finish`. Driven at 60 Hz through the shipped camera,
a member leaving to the left was drawn travelling left at 1.755 px per frame
while still facing right for **62 consecutive frames**. The rig says the
refusal was unjustified there: all three `bench-dismount` frames plant no
foot at all, every bench clip authors zero root advance, and `bench-finish`
f3 is where the plant hands over and the authored sole already jumps
186.19 px to 140.34 px in a 256 px canvas.

**4. A member walking to a queue no longer faces the wrong way, and this one
was not in anybody's list.** Found by reading the raw trace after (3) landed
rather than by trusting the pass it produced. A `queuing` member is handed
the *station's* side, and the runtime took that side at once — including
while the member was still crossing the floor toward the queue. At 375x812
tick 65 the facing flipped to `left` on the first frame of the walk while the
drawn point was moving **right** at 1.89 px per frame, and kept moving right
for seven more frames.

Measured across both viewports, before → after (3) → after (4):

| | 62-frame witness | after (3) | after (4) |
|---|---|---|---|
| longest facing/travel disagreement | 62 frames | 11 and 5 | **3 and 2** (bar 11–13) |
| stances whose travel disagrees with their own facing | — | 1 of 7 | **0 of 8, 0 of 7** |
| worst horizontal foot-drift stance | — | 0.9219 tiles | **0.1473 tiles** |

`facingStable` now **PASSES** at both viewports. The motion proof went 13/16
to **14/16**.

---

## The one instrument still red, and why it is now an ART question

`walkFootPlanted` / `noSkate` still FAIL. **The tolerance was not widened and
no class of motion was excluded to move them.** What the instrument gained is
a decomposition, reported beside the verdict and read by no verdict, that
says where the remaining number comes from — and the answer is that both
parts are art-side.

**Part one: the strip's own frame count.** The walk's authored sole retreats
in 16 equal steps while the drawn point moves continuously between them, so a
foot measured off the SHOWN frame necessarily saws by up to
`strideTiles / 16` = **0.06886 tiles** with the body perfectly planted. The
instrument's tolerance is 0.05 tiles — *below* that floor. **No runtime
change can reach it, and no amount of animation polish can either; only a
strip with more frames can.**

**Part two: the depth axis, unchanged from round 2B.** `floorSim.ts` walks
members on a four-neighbour grid, so they regularly walk toward and away from
the camera, and the art has only a side-view gait.

Re-measuring the same stances against the sole each stance's own phase
implies removes the quantisation term and nothing else. Four runs, both
viewports, consistent every time:

| stance population | shown | with quantisation removed |
|---|---|---|
| net dy exactly 0 — walking along a row | 0.0612–0.0693 | **0.0204–0.0489, all under the 0.05 tolerance** |
| net dy non-zero but under net dx — turning a corner | 0.1158–0.2798 | 0.1239–0.2675, **barely moved** |

So: with the strip's discreteness taken out, a member walking straight along
a row is planted **within tolerance**. Everything left over is a body being
drawn with a side-view gait while it travels partly toward or away from the
camera. That is residual (C) below, and it is Fable's call, not a runtime
defect.

---

## What Fable is being asked to judge

Fable should **not** spend time finding pathing bugs, raw floating point in
the HUD, facing-direction bugs, or stale renderer props. Those are closed
above, with the numbers to check them by.

1. **Can the existing cut-out-puppet representation reach production
   quality?** The runtime now drives it correctly — ten clips, legal
   transitions only, planted within tolerance on the axis the art supports.
   If it still does not read as a person, that is the representation, not
   the machinery.

2. **Does the side-view → three-quarter bench transition invalidate the
   current representation?** Measured intersection-over-union at the bench
   dissolve is **33.2%** (41.8% ignoring the bar), carried forward from art
   round two and unchanged (art frozen). The two poses being cross-faded are
   recognisably different silhouettes.

3. **Do we need authored toward/away-camera motion because the world pathing
   is visibly two-dimensional?** This is now the single largest measured
   contributor to the remaining foot-planting number. 9–10 of every 17
   stances in a played run are depth-axis, with drift up to **0.80 tiles**
   that no horizontal formula can even judge. The sim is Grok's and is
   correct; the gap is that no toward/away gait exists.

4. **Are members too small for the current pose language to read at phone
   scale?** At 390x844 a member is roughly 15–25 px tall. Breathing and
   head-nod measure **29.1%** of body pixels changed between idle frames 0
   and 6 at 74 px — real in the source, and I could not read it at play size.

5. **Is the correct next move (A) one finite final polish pass, or (B)
   replacement of the character representation?** Nothing in this round
   answers that, and nothing in it should be read as leaning either way.

---

## The exact owner-playable command

```
cd <repo>
npx vite --config vite.owner.config.ts --port 5174 --strictPort
```

then open:

```
http://localhost:5174/owner-playtest.html?scenario=capacity
```

Re-driven this round against this exact command and URL:
`tools/verify-owner-route.mjs --url http://localhost:5174` returned **16/16
green** at 390x844, exit 0.

The in-app played path — what a player reaches through the shell, no query
string — is `http://localhost:8084` via `bash tools/dev-web.sh`, then tap
`shell-open-gym`. That is a **different** route from the owner scenario
above, and it is the one `capture-living-world.mjs` and
`capture-motion-proof.mjs` drive.

## Images

Round 2C captures are prefixed `2c-`; the `handoff-` set is round 2B's and is
kept for comparison. All are from the running app, not the bake sheets, and
all were opened and looked at before being described.

| File | What it is |
|---|---|
| `handoff/2c-bench-dismount-before.png` | The z-order defect: two flat-bottomed crimson crescents at the head of the empty bench. HUD reads `gym bucks: 0.233333` |
| `handoff/2c-bench-dismount-fixed.png` | Same moment, fixed: both discs whole. HUD reads `gym bucks: 0.23`, `earning 60.00 gym bucks per hour` |
| `handoff/2c-capacity-before.png` / `-after.png` | The capacity moment. After: two benches, `2 on the machine`, `1 waiting`, `3 on the floor`, `gym bucks: 177.92` |
| `handoff/2c-capacity-strip.png` | The same purchase as a filmstrip |
| `handoff/2c-lifecycle-seeking.png`, `2c-lifecycle-strip.png` | The played lifecycle: seeking → queuing → using → leaving → queuing |
| `handoff/2c-play-surface-using.png` | The in-app Play surface with a member on the bench |
| `handoff/2c-bench-press.png`, `2c-walking.png` | Press and walk samples |
| `handoff/handoff-*.png` | Round 2B's set, unchanged |

## What I actually saw, in plain language

**`2c-capacity-after.png`.** The purchase reads at a glance as a *floor*
change — there are visibly two benches where there was one, and the counters
underneath agree (`2 on the machine`, `1 waiting`). What I could not read
from the still is which two of the four figures are the ones training: one
member is clearly lying on the right bench, and the second is a small
standing-or-lying shape near the left bench that I could not resolve. The
capacity *moment* lands; the per-member legibility inside it does not.

**`2c-bench-dismount-fixed.png`.** The two discs are now complete circles
sitting at the head of the bench. They are unambiguous and they are also, at
this scale, two red dots — see the question raised in item 2 above.

**`2c-bench-press.png` and `2c-walking.png`.** Same finding as round 2B, not
re-litigated: at play size I can tell "person on a bench" from "person
standing", and I cannot reliably tell setup from mount from press.

---

## Residuals

**(A) Side-view to three-quarter puppet swap at the bench dissolve.**
Unchanged, art frozen. IoU **33.2%** (41.8% ignoring the bar), carried
forward from art round two. Fable question 2.

**(B) Breathing and head-nod subtlety at phone size.** Unchanged, art frozen.
**29.1%** of body pixels changed between idle frames 0 and 6 at 74 px,
against 0.0% before that art pass. Real in the source, not readable at play
size. Fable question 4.

**(C) Foot planting — RE-MEASURED THIS ROUND, and the runtime half is now
closed.** See "The one instrument still red" above for the full
decomposition. In short: with the strip's 16-frame quantisation removed,
every pure-horizontal stance is planted within tolerance; the residue is the
depth axis, which needs authored toward/away gait art. `walkFootPlanted` and
`noSkate` remain FAIL and are **not** claimed as passing. Fable question 3.

**(D) Root drift — STILL NOT MEASURED.** No instrument in this tool set
computes a cumulative root-position error over a long session distinct from
the per-stance drift under (C) and the per-change-event `noFamilySnap` check,
which passed cleanly at both viewports again this round. If "root drift"
means something more specific, it needs its own instrument. Stated honestly
rather than answered with an adjacent number.

**(E) Scale / perspective pop — measured, within bound.** `scaleContinuous`
passed both viewports again this round.

**(F) Station and bar alignment — passed cleanly again.** `stationAttached`
green both viewports.

**(G) Anything that still reads as a cut-out puppet rather than a living
person.** The two concrete items round 2B filed here — the raw floating point
and the unidentified red/white shapes — are both closed above, which is what
the round was for. What remains under (G) is the thing only a human can
answer, and it is Fable question 1.

## What this round did NOT do

No re-bake. No repaint, silhouette change, aesthetic recolour, new dissolve,
scale change, room redesign, or UI redesign. No mechanics change — Grok's
`floorSim.ts` is byte-identical to the accepted `b1561aa1`. No renderer
collision offset, hidden body, or z-order trick masking an overlap: the
plate-disc z-order change fixes a disc being occluded by its own bench and
touches nothing about member positions.

No claim of VISUAL, WORLD LEGIBILITY, ANIMATION FEEL, SOFT-FEEL, OWNER
PLAYTEST or NATIVE PERFORMANCE. All of those are Bryant's, or the next human
phone replay's, to close. Every number here was measured this round on the
tree it names — re-run the tools yourself if this document is more than a few
commits old.
