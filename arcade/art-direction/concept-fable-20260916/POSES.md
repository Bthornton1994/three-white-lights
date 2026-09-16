# Key poses, deadlift sequence, bench 3/4 composition

**CONCEPT ONLY. DO_NOT_MERGE.** Coordinates are 160-lattice px (master = ×2),
origin top-left, ground line y 152. Values are starting points for the artist,
not hard limits — anchors and identity rules in `MODEL_SHEET.md` are the hard
limits. Per-frame beats are in `production-frame-list.csv`.

## 0. One camera for the whole stage

- 3/4 front, lifter turned ~35° so his **right side is nearer the viewer**
  (viewer-left). Camera height at his chest, slight downward tilt (~10°) so
  the platform top is visible and squat depth reads.
- Same camera for idle, squat, deadlift, success, miss. Bench uses the same
  *side* of the lifter (see §3) so the near/far plate logic never flips.
- Bar: 2 px thick (BAR1 body, BAR2 top edge, BAR0 underside), 3 px sleeves.
  Foreshortened span x 13..147 (134 px). Near plates 36 px diameter, far
  plates 30 px. Plate thickness incl. gap: near 4 px, far 3 px. Collars 5 px
  BAR1/BAR2.
- Ground shadow: SHAD ellipse under the feet, rows 150–158, width = stance + 8.
  For bench: under the bench feet.

The current live layout clips the top 26 lattice rows (52 master px) on the
1280×800 attempts screen (`baseline/desktop-1280x800-attempts-clip.png`,
measured). Standing frames keep the head-top at y ≥ 26 so they survive the
current CSS; success fists may go above that — success does not render on the
attempts screen. Cursor should still fix the layout at integration.

## 1. Squat — key poses

| Frame | State | Bar centre y | Hips y | Torso lean | Beat |
| --- | --- | --- | --- | --- | --- |
| 1 | setup | 50 (low-bar, rear delts) | 98 | 0° | Standing, elbows down and back, hands just outside shoulders, chest up, BRACE face on max |
| 2 | descend | ~70 | ~114 | 20° | Hips back and down together; knees travel forward and *out*; bar stays over mid-foot |
| 3 | hole | ~96 | ~128 | 35° | Hip crease below knee-top (knee-top ≈ y 122); shins ~15° forward; bar over mid-foot |
| 4 | drive | ~80 | ~116 | 30° | Hips and chest rise together; knees pushing out (widest knee frame) |
| 5 | almost | ~54 | ~100 | 8° | Lean resolving |
| 6 | lockout | 50 | 98 | 0° | Standing, knees locked, EXHALE |

Depth rule: frame 3 must show the hip-crease pixel row *below* the knee-top
pixel row. At 273 px stage that is a 3–4 screen-pixel difference — draw it
bigger than feels natural (hips y 128 vs knee-top y 122).

## 2. Deadlift — setup → lockout sequence

The audit's key failure: the lockout was weak and read as a rewind of the
setup. The fix is geometric, not decorative — six frames, four different
torso angles, one straight bar path.

| Frame | State | Bar centre y | Hips y | Shoulders y | Torso from vertical | Knees |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | setup | 134 (plate radius 18 on the floor) | 104 | 78 | ~55° | Bent, shins to the bar |
| 2 | break | 132 | 102 | 76 | ~55° (**unchanged**) | Extending — the floor breaks with the legs |
| 3 | knee | 122 | 96 | 68 | ~40° | Shins vertical |
| 4 | mid | 112 | 92 | 60 | ~20° | Hips coming through |
| 5 | almost | 108 | 96 | 54 | ~5° | Soft |
| 6 | lockout | 106 | 98 | 50 | 0°, shoulders 2 px *behind* the bar | Locked |

Rules that make it a lockout and not a setup:

- Bar path is a straight vertical line at x 80 in every frame. A bar that moves
  toward the body and back (a hitch) is forbidden — QA checks for it.
- Frame 6 vs frame 1 differ by: bar y 134→106, head y 56→26, hips 104→98,
  torso 55°→0°, plates hanging *above* the floor (bottom at y 124) with a 28 px
  gap to the ground. The silhouette delta is large by construction
  (`validate_package.py` requires ≥ 2500 changed master px).
- Lockout tells: chin up, shoulders pulled back so the chevron faces the camera
  square-on, arms straight and long, bar resting on the upper thigh, hips
  *through* (belt buckle 1 px in front of the shoulder line). EXHALE (light) or
  STRAIN (max) face.
- Grip: light = double overhand (both palms toward the body: knuckles face the
  camera on both hands). Max = mixed grip — the near hand palm-forward, so its
  fingers face the camera. This is real powerlifting language and reads at
  273 px.

## 3. Bench — 3/4 composition

The audit's failure: an upright face pasted on a lying body, and the bench
did not read as a bench.

Camera: from the **lifter's right side**, turned ~30° toward his feet, elevated
~30°. Head at upper-left, feet at lower-right. The bench, the bar, and the
lifter's spine are three diagonals; the plates are two vertical ellipses of
different sizes.

| Element | Lattice placement (lockout frame) |
| --- | --- |
| Rack uprights | x 14–18 and 22–26, y 40–128, STEEL0/STEEL1; J-hooks at y 70 |
| Far plate stack | centre (30, 70), 28 px diameter, partly behind the head and upright |
| Head (lying) | centre (48, 88): forehead toward upper-left, chin toward the ceiling (up and right), eyes rolled up toward the bar. Hair wedge pressed flat against the pad; beard points up. Draw it as a head rotated ~80°, **not** an upright face. |
| Bar | from (30, 70) to (126, 96) — diagonal, foreshortened; BAR2 highlight on the upper edge |
| Hands | (58, 76) and (100, 88); wraps WRAP1; thumbs around |
| Chest / arch | shoulders on the pad at y 96, chest peak at y 90, lower back off the pad 2 px |
| Bench pad | top surface (36, 100) → (124, 122), PAD1 top, PAD0 side, 6 px thick |
| Near plate stack | centre (118, 100), 40 px diameter, in front of the hips; RED1 mass, RED2 rim upper-left, RED0 lower-right, BAR1 hub |
| Feet | flat, (112, 148) and (136, 150); shoes SHOE0 |
| Bench feet / frame | STEEL0 to the ground line; shadow ellipse under them |

Frame beats (bar centre y at the hands, lockout = 0):

| Frame | Light | Max |
| --- | --- | --- |
| 1 setup | arms locked, arch, eyes on bar | bar bows 1 px at the sleeves, arch 1 px higher, 4 RED per side |
| 2 lower | bar −10, elbows 45° tuck | slow, elbows tucked harder, FLUSH1 |
| 3 pause | bar on the chest, motionless, feet driving | bar sinks 1 px into the singlet, FLUSH2, 1 px neck-vein lines |
| 4 press / sticking | bar −7 | bar 2 px off the chest, tilted 1 px (near end lower), elbows flare, STRAIN |
| 5 almost / grind | bar −3, slight flare | bar half-way, bow resolving, eyes shut |
| 6 lockout | arms straight | arms straight, bar straight, EXHALE |

The near plate stack **must** overlap the hips and the pad. That overlap is the
depth cue that makes it a bench and not a floor press.

`reference-ai/AI-REF-02-BENCH-THREE-QUARTER.png` shows the *camera and depth
idea* only. Its hand positions and bar placement are anatomically wrong (the
hands are not symmetric over the chest) and its hair colour drifts. Use it for
the diagonal composition and plate sizing, nothing else.

## 4. Idle, success, miss — per lift

Idle (4 frames): stand, inhale (shoulders +1, chest +1), exhale, glance right
toward the bar. Chalk-rub on frame 3 (hands meet at the belt).

Success and miss are **per lift and per effort** (24 + 24 frames). The audit
found a shared miss sheet that showed a green-plate deadlift hinge after a max
squat miss; that cannot pass identity or effort verdicts. Beats are in the CSV;
the principle: a success or miss starts from the last frame of the lift it
follows (bar on back / bar racked / bar on the floor) and the plate load
matches the effort.
