# Pixel-cluster and lighting rules

**CONCEPT ONLY. DO_NOT_MERGE.** These are the craft rules the human pixel artist
works to. They are the difference between "readable, 320, chroma-free" (hygiene,
which PR #70 already reached) and SNES/Genesis sports-game craft (which it did
not).

## 1. Grid

- Author at **160 × 160** (stage) and **52 × 52** (cards). One art pixel = one
  lattice cell. Export nearest-neighbour ×2 → 320 / 104. Never draw at 320;
  never resample.
- `templates/master-320-lattice-guide.png` carries the ground line (lattice
  152), shadow rows (150–158), the standing head-top line (26), the low-bar
  line (50), the 3/4 bar span (13–147) and the desktop clip band.
- Binary alpha. No anti-aliasing against transparency. Anti-alias only
  *inside* the sprite between two palette colours, and only where a diagonal
  edge is longer than 6 px.

## 2. Light

- **Key:** platform lamp, upper-left, ~45° down. Lit planes face up-left.
- **Fill:** none. Shadow planes go straight to the ramp's shadow step.
- **Rim:** 1 px warm rim (AMB2 on singlet edges, SKIN4 on skin) on the
  *upper-left* silhouette edge only, and only on the standing frames where the
  lamp is directly overhead. No rim on the bench (the lamp is behind the rack).
- **Shadow hue:** every ramp's shadow step is shifted cool (violet). Straight
  darkening is the number-one tell of "modern pastiche" versus 16-bit craft.
  The v2 palette bakes the shift in; do not add colours outside it.
- **Cast shadows:** bar casts a 1 px SKIN0 line on the traps (squat) or the
  chest (bench pause). Beard casts nothing. Chin casts 1 px SKIN0 on the neck.

## 3. Clusters

- Minimum meaningful cluster on skin: **2 × 2** at 160 lattice. Single pixels
  are allowed only as: eye catch (WRAP1), bar specular (BAR3), buckle glint
  (AMB2), sweat (WRAP1), chalk specks (CHALK).
- Three tones max across a limb width; two on a card.
- **No pillow shading** (concentric rings following the outline). Shade by
  plane: a forearm is a top plane (SKIN3), a side plane (SKIN2), an under plane
  (SKIN1), a contact pixel (SKIN0).
- **No banding**: parallel 1 px stripes of successive ramp steps along an edge.
  If two tones run parallel for more than 4 px, break one with a plane change.
- **Dither:** none on the body. Allowed only as a 2 × 2 checker on the plate
  faces (RED1/RED0) to suggest the machined rim, and on the brick backdrop.
- **Outlines:** selective. Dark OUT outline against the background where the
  sprite meets the transparent edge on the *shadow* side; on the lit side the
  outline is the ramp's darkest step (SKIN0, SING0), not OUT. Interior lines
  (arm against torso) use the darker adjacent ramp step, never OUT, never
  black.
- **Sub-pixel motion:** limbs move in whole lattice pixels; the bar bow and
  1 px tilts are the only fine motion.

## 4. Faces at three sizes

| Size | What survives | What you drop |
| --- | --- | --- |
| 160 lattice (stage) | Brow, eyes with white, nose shadow, mouth, beard shape with 2 texture px, shaved-side band | Nothing; this is the full MODEL_SHEET §3 |
| 52 lattice (card) | Brow, eye px, nose px, beard mass, hair wedge | Eye whites (use 1 px), ears, mouth on NEUTRAL |
| 273 / 400 on screen | Same as 160 — but the browser scales non-integer, so 1 px features may become 1 or 2 px | Do not compensate; Cursor fixes scaling later |

Rule: the beard is a *mass with a silhouette*, not a line. If the beard is
drawn as a 1 px outline it vanishes at 273 px and identity fails.

## 5. Weight and contact

- Bar deforms; bodies compress. A max bar bows 2–3 px at the sleeves; the
  shoulders under it drop 1 px; the shoes flatten 1 px. Nothing else in the
  image bends.
- Plates: near stack 36 px (40 on the bench), far 30 px, hub BAR1, 1 px BAR2
  highlight at 10 o'clock, RED0 at 4–5 o'clock. Plate face is flat colour with
  the optional 2 × 2 checker rim; no radial gradients.
- Feet are always fully in contact with the ground line (rows 148–152) except
  on the deadlift-max drop frame (plates bounce; feet stay).
- Chalk appears only where hands or the bar touched.

## 6. Animation readability

- Every frame must read as a *pose* on its own — no "in-between" frames that
  make sense only in sequence. The runtime maps progress → frame index and can
  hold any frame.
- Light: even spacing. Max: cluster frames 3–5 near the sticking point
  (`EFFORT_CONTRAST.md` channel 3).
- The bar path is a straight vertical line in squat and deadlift, a shallow
  J on the bench (toward the face on the way up). Draw the path first, then
  the body around it.
- Head stays at one x in squat/deadlift frames (no side-to-side bob); it
  travels only in y.

## 7. What "SNES/Genesis sports-game craft" means for the A/B

Independent QA will compare frames against real 16-bit sports/fighting sprites
(GDD §12.2). The properties they will look for, in order:

1. Silhouette identity at 25 % size (squint test).
2. Plane-based shading with hue-shifted shadows.
3. Deliberate clusters — no orphan pixels, no noise, no soft edges.
4. Weight: deformation and contact, not just plate colour.
5. A face that is one specific man in every frame.
6. Environment that supports rather than competes (irregular brick, dark
   band behind the lights, clean platform).

Readable / 320 / pixelated / chroma-free / light ≠ max silhouettes remain
*hygiene*, not PASS (`ACCEPTANCE_CHECKLIST`).
