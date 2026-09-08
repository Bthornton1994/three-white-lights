# The canonical athlete — source-art package for `athlete-01`

**Status: `ASSET_AUTHORING_BLOCKED` for every drawn deliverable (§12).** This
package fixes everything an illustrator needs BEFORE drawing, so the three
views, the silhouette test and the empty room plate can be authored without a
question coming back to engineering. Nothing here is a placeholder body: no
capsule anatomy, no circle joints, no mannequin, no AI pose frames, no JPEG
pose swaps — those are rejections (`docs/design/ADR-001-athlete-animation-architecture.md`
§2), and by ruling the diagnostic `.riv` exception does not extend to the
player path.

**Companion:** `docs/design/RIVE-AUTHORING-HANDOFF.md` (the rig, the state
machine, the inputs, the validation command) assumes this athlete. The
character bible it extends is `docs/design/ATHLETE-ASSET-PIPELINE.md` §3–§7.
Every mechanical number below is read from the shipped simulation and cited;
none is invented here, and none may be changed to make a drawing easier.

**Measured at:** `38d2dd9d` on `claude/session-a-visual-architecture`.

---

## 1. Identity — one athlete, `athlete-01`

| | |
| --- | --- |
| Name | `athlete-01`. No given name at v1; a name is a licensing and copy decision for a human. |
| Who | A serious lifter mid-career: capable, working, not a physique render and not a beginner. |
| Silhouette | Gender-neutral. Thick torso, heavy thighs, short-limbed against fashion canon (§2). |
| Face | Not authored at v1. Head is small at the delivered size (§9); hair close-cropped, `#24160e`. Eyes, mouth and expression are not drawn — expression is carried by posture, bracing and hands. |
| Skin | One mid tone, `#c4a07a` (the stage's `SQUAT_SKIN`), so the figure sits in the room's warm light. |
| Fictional and owned | No real lifter's likeness, record or marks. No federation wordmark. No shoe, apparel or sponsor brand anywhere on the body, bar, plates or room. |
| Squat style | **High-bar**, bar centre on the upper traps, **flat-soled shoes**, knees tracking forward over the toes. One style, fixed, because heel height and bar position set the torso angle at depth (§4) and a limb or angle that changes between poses is the mannequin defect returning as art. |

**The silhouette is the identity.** At phone size the reader has posture,
mass distribution and gear, not features. Author the black shape first (§9)
and check it before any rendering.

## 2. Proportions — fixed once, in millimetres and canvas pixels

Nominal stature **1750 mm** (pipeline §4). Canvas scale **0.577 px per mm**
(handoff §2: the 1152 × 1728 stage plate puts the floor at y = 1400 and the
lockout bar at y = 553; a 1750 mm athlete whose trap shelf carries the bar at
1468 mm fixes the scale). ~7.5 heads: head length **233 mm**.

Segment lengths, floor upward, in the side view. The sum is the stature.

| Segment | mm | canvas px | Joint height above floor at lockout (mm → canvas y) |
| --- | --- | --- | --- |
| floor → ankle joint | 80 | 46 | ankle 80 → y 1354 |
| tibia (ankle → knee joint) | 410 | 237 | knee 490 → y 1117 |
| femur (knee → hip joint) | 440 | 254 | hip 930 → y 863 |
| torso (hip → shoulder line) | 520 | 300 | shoulder 1450 → y 563 |
| bar centre above the shoulder line (trap shelf) | 18 | 10 | **bar 1468 → y 553** |
| neck + head (shoulder line → crown) | 300 | 173 | crown 1750 → y 390 |
| **stature** | **1750** | **1010** | |

| Limb / mass | mm | canvas px |
| --- | --- | --- |
| upper arm | 300 | 173 |
| forearm | 260 | 150 |
| hand (wrist → fingertip) | 190 | 110 |
| foot length | 270 | 156 |
| shoulder width (front view, deltoid to deltoid) | 480 | 277 |
| hip width (front view) | 340 | 196 |
| chest depth (side view, sternum → spine) | 260 | 150 |
| hip depth (side view) | 240 | 138 |
| thigh depth at mid-femur (side view, relaxed) | 200 | 115 |
| head length | 233 | 134 |

**The torso / femur relationship is 520 / 440 = 1.18** — torso longer than
femur. That is what makes this athlete a moderately upright squatter who
still leans to 45° at the bottom (§4): the lean comes from the flat shoe and
a forward knee, not from a long femur. **Never adjust femur or torso per
pose.** They are the two numbers the squat's whole shape depends on.

**Feet are planted and are the root.** Mid-foot is the origin of every
measurement above and of the rig (handoff §6). Stance in the side view: the
near foot flat, toes frame-right, the far foot exactly behind it. In the
front view: stance width **520 mm** heel to heel, toes turned out **20°**.

## 3. Wardrobe, belt, sleeves, shoes, wraps, chalk

Every colour is a hex the stage already draws with (`src/session/sessionPalette.ts`,
the `SQUAT_*` and Iron & Amber block), so the athlete cannot arrive in a
palette the room does not share.

| Item | Specification | Colour |
| --- | --- | --- |
| Singlet | Plain, no text, no logo, no federation mark. One amber piping line down the side seam is the only ornament. Cloth: follows the body one step late (pipeline §10). | body `#1c1612`, piping `#c9a15b` |
| Belt | **Lever belt, 13 mm thick, 100 mm tall**, uniform width all round, steel lever at the front. **Rigid** — it compresses the torso above and below it and never stretches or wrinkles. Worn just above the hip bones; its top edge is 190 mm above the hip joint at lockout. | leather `#3a2a1c`, edge stitch `#c9a15b`, lever `#d8d0c4` |
| Knee sleeves | **7 mm neoprene**, 300 mm long, centred on the knee joint. Sleeves, not wraps — wraps imply an equipment division the mechanics do not model. Rigid pieces on the rig, parented to the knee. | `#2c3242`, seam `#1c2230` |
| Shoes | **Flat-soled**, thin sole (≤ 10 mm), canvas-style upper, no branding. Heel height 0 — a raised heel would change the authored depth angles in §4. | upper `#1a1a1a`, sole `#e8dcc8` |
| Wrist wraps | Stiff, 300 mm wrapped, thumb loop tucked. | `#2c3242` with one `#c9a15b` stripe |
| Chalk | Authored on the hands (palms and fingers, heaviest at the pads), the knurl of the bar where the hands sit, and as a light haze on the traps under the bar. Intensity arrives as `chalk` (0..1); placement is the artist's. No particle system. | `#e8dcc8` |
| Hair | Close-cropped. | `#24160e` |
| Not worn | Headphones, phone, watch, hat, jewellery, tape on the fingers. |

## 4. Posture at the reference lines — the torso / femur relationship in motion

The rig's pose is a function of `barHeight` (handoff §5): 1 = lockout, 0 =
the authored bottom of the hole. The bar lines are the handoff's canvas lines.
Torso angle and shin angle are from vertical; hip is the hip joint's height
above the floor. **Bar over mid-foot at every key** (horizontal offset from
the mid-foot origin within ±20 mm) except the buried collapse.

| `barHeight` (`depth` for the buried row — `barHeight` is clamped at 0 there) | Beat | bar drop from lockout (mm) | bar canvas y | torso | shin | hip joint (mm) | what must read |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.00 | brace / lockout | 0 | 553 | 10° | 5° | 930 | Already under load: air in, belt tight, ribs down. |
| 0.75 | early descent | 180 | 657 | 20° | 15° | 781 | Hips back and down, knees start forward. |
| 0.50 | mid descent | 360 | 761 | 28° | 25° | 631 | Control; bar vertical over mid-foot. |
| 0.34 | **the stick** (`STICK.HEIGHT_FRAC`, `src/art/spriteTuning.ts`) | 475 | 827 | 30° descending / **36° ascending** | 28° | 539 | On the way up: hips rise ahead of the chest, torso briefly closes, bar speed near zero. The grind's home. |
| 0.20 | **judged depth** (`DEPTH_LEGAL.squat 0.8`, `src/game/liftTuning.ts`) | 576 | 885 | 31° | 30° | **428** | Hip joint at or below the knee joint (knee joint 435 mm with the shin at 30°); the hip crease is visibly below the top of the knee. `depthAchieved` flips here; it must be legible at phone size. |
| 0.00 | **the hole** (`DEPTH_IDEAL.squat 1.0`) | 720 | 968 | **45° ± 5°** | 35° | **362** | Maximum lean, maximum knee flexion, shins forward, hip 54 mm below the knee joint. |
| `depth` 1.30 (`barHeight` 0) | **buried** (`DEPTH_COLLAPSE.squat 1.3`) | 936 | 1093 | 60° | 35° | ≈ 250 | Collapse, not a deeper squat: the athlete folds, the bar rolls forward of mid-foot by ~150 mm. This is the `buried` miss's picture, authored as failure. Keyed on `depth`: the contract clamps `barHeight` to 0..1, so nothing below the hole reaches the rig through it. |

Derivation, so an illustrator can check it rather than trust it: bar drop =
hip drop + torso height lost to lean, where the lost height is
520 × (1 − cos θ). At the hole, 720 = 568 + 152. Knee joint height at a shin
angle φ is 80 + 410 × cos φ.

Ascent is the same `barHeight` curve read upward with an additive intent
blend: torso closes 4–6° relative to the descent at the same height, chest
leads out of the hole, hips shoot slightly at the stick. The descent is
never the ascent reversed (pipeline §10).

Deformation limits (knee ≤ 140°, hip ≤ 125°, ankle ≤ 35°, limb-length change
0, volume ±5%) are in handoff §6 and are rejections, not notes.

## 5. Bar and plate scale — the drawn bar must plausibly be the weight

Read from `src/art/plates.ts` (`PLATE_SPECS`, `BAR_AND_COLLARS_KG`) and the
`BAR` header in `src/art/spriteTuning.ts`. Canvas px at 0.577 px/mm; phone px
at the cover fit in §9 (× 0.403).

| Piece | Real dimension | canvas px | phone px |
| --- | --- | --- | --- |
| Bar length | 2200 mm | 1269 (seen along its axis in the side view — it does not span the frame) | — |
| Shaft diameter | 29 mm | 17 | 7 |
| Sleeve length (collar face to sleeve end) | 415 mm | 240 (foreshortened in the side view; see below) | — |
| Sleeve diameter | 50 mm | 29 | 12 |
| Collar | 2.5 kg each; 25 kg bar-and-collars total | | |
| 25 kg plate | red, 450 mm | **260** | 105 |
| 20 kg plate | blue, 450 mm | 260 | 105 |
| 15 kg plate | yellow, 400 mm | 231 | 93 |
| 10 kg plate | green, 325 mm | 188 | 76 |
| 5 kg plate | black, 228 mm | 132 | 53 |
| 2.5 kg plate | black, 190 mm | 110 | 44 |
| 1.25 kg plate | black, 160 mm | 92 | 37 |
| Calibrated disc thickness | ≈ 30 mm (25 kg) down to ≈ 10 mm (1.25 kg) | 17 → 6 | |

Plate hues on the rig are the stage's Iron & Amber set, not the sprite
primaries: red `#b83228`, blue `#2c4f9a`, yellow `#d4b43c`, green `#2f7a3e`,
black `#1a1a1a` (`SQUAT_PLATE_*`). Bar steel `#d8d0c4`.

**Camera and the bar.** The production view is side-on, orthographic, the
bar seen along its axis: the near sleeve's discs face the camera and stack
toward it; the far sleeve is behind the athlete. Rotate the view no more
than **5° toward the camera** so a sliver of shaft and the sleeve's depth
read (at 5°, a full 415 mm sleeve shows ≈ 36 mm ≈ 21 px of length). Bar tilt
(`barTiltDeg`) reads as the far discs peeking above the near ones; lateral
offset (`barLateralPx`) as a small scale-and-y shift in depth; bend
(`barBendPx`) as sleeve droop, never a change in length.

**Loaded height check.** A 450 mm disc against the 1750 mm athlete is a
quarter of the stature: with the bar at the traps, the bottom of a 25 kg disc
sits at 1468 − 225 = 1243 mm — chest height — and at the hole (bar 748 mm)
at 523 mm, just above the knee. Draw the three loads pipeline §12 asks for
and check them against this: light (bar + 2 × 10 kg = 45 kg), mid
(bar + 2 × (25 + 10) = 95 kg), heavy (bar + 2 × (25 + 25 + 20 + 10 + 2.5) =
190 kg). Eight slots per sleeve, inboard-first, pitched one disc thickness
apart (handoff §6).

## 6. Lighting — measured from the room plates, baked into the art

Read from `assets/iron-amber/squat-brace.jpg` (the room the athlete has to sit
in) rather than chosen: the plates' light is the room's light.

| Light | Direction | Character | Colour reference |
| --- | --- | --- | --- |
| Key | High, frame-left, slightly toward camera (about 10 o'clock from the athlete, 45° elevation) — a warm pendant. Falls on the athlete's back, shoulders and the near sleeve's discs. | Dominant, warm, soft-edged. | `#e8c27a` (`SQUAT_GLOW`) at full, `#c9a15b` in the falloff |
| Rim | Frame-right, low-to-mid — the window/doorway behind the direction the athlete faces. Separates chest, knees and forearms from the espresso room. **Required, not a flourish** (pipeline §6). | Thin, cool-white. | `#e8dcc8` |
| Fill | Ambient, from the room. | Cool charcoal so the shadow side stays a shape, never black. | `#2c3242` into `#1a120e` (`SQUAT_WALL`) |
| Ground | Contact shadow under both feet and under the plates at the hole. | Soft, warm-dark. | `#241810` (`SQUAT_FLOOR`) |

The light does not move during a rep. The only runtime modulation is the
contract's own scalars — `commandGlow` blooms amber on the bar and hands.

## 7. Reference lines — floor, lockout, depth, stick

All on the 1152 × 1728 canvas; the rig maps `barHeight` linearly between the
hole and lockout lines.

| Line | canvas y | mm above floor | Meaning |
| --- | --- | --- | --- |
| Floor | 1400 | 0 | Both feet, the rack's feet, the plates at rest. |
| Lockout bar (`barHeight = 1`) | 553 | 1468 | Bar centre on the traps; the rack's J-cups sit here. |
| Sticking band (`0.34 ± 0.14`) | centre 827, band 769 … 885 | 993, 895 … 1093 | Where the simulation's stall lives (`STICK` in `spriteTuning.ts`); the grind pose is authored here. |
| Judged depth (`barHeight = 0.2`) | 885 | 828 | Hip joint at/below the knee joint. The sport's fact. |
| Hole (`barHeight = 0`) | 968 | 748 | The authored bottom. |
| Buried (`depth = 1.3`, `barHeight = 0`) | 1093 | 532 | Collapse. |
| Crown at lockout | 390 | 1750 | The athlete's height on the canvas: 1010 px. |

The sticking band's lower edge and the judged-depth line coincide
(0.34 − 0.14 = 0.20) — a grind that begins the instant depth is made is what
the constants say, and the drawing must not separate them.

## 8. The three views and the room plate — what gets drawn

All at the same scale (0.577 px/mm), on the same floor line, with the bar in
frame at lockout, loaded to the mid load in §5.

| Deliverable | File | Purpose |
| --- | --- | --- |
| **Side view — PRODUCTION** | `assets/athlete/athlete-01-side.png` (1152 × 1728, transparent) | The squat camera; the view the rig is built from. Athlete at lockout, facing frame-right, plus the six §4 keys as separate layers/pages of the working file. |
| Front view | `assets/athlete/athlete-01-front.png` | Locks shoulder/hip width, stance, the belt and sleeves all round, so mass stays consistent for a second camera or appearance. |
| Three-quarter view | `assets/athlete/athlete-01-three-quarter.png` | Consistency check between the two. |
| Reference sheet | `assets/athlete/athlete-01-reference-sheet.png` | The three views side by side, same baseline, bar at lockout, with the §2 numbers annotated. |
| Silhouette test | `assets/athlete/athlete-01-silhouette-390x844.png` | §9. |
| **Empty side-on room plate** | `assets/iron-amber/squat-room-side.jpg` (1152 × 1728) | **Required, and NOT one of the existing plates** — see below. The room behind the rack, side-on at this camera, in §6's light, with no athlete, no bar and no plates painted in; the rack is a separate static layer with its J-cups on the lockout line. |

**Why the room plate is a new deliverable, and a rule, not a preference
(ruled 2026-09-08).** The pipeline (§7a) assumed the existing Iron & Amber
squat plates were the room. They are not: each is a FRONT three-quarter
scene with a painted lifter already in it — face, tattoos, a shield emblem
on the tank and visible shoe branding — a whole picture, not an
environment. A rigged athlete cannot be composited over a painted one.
**Do not crop, mask, blur, mirror or otherwise re-use those JPEGs behind
`athlete-01`.** The required background is a NEW production asset: EMPTY,
side-on, 1152 × 1728, the same Iron & Amber lighting (§6), the same floor
line and lockout framing (§7). (The painted lifter's marks are also a note for the
human who owns `src/licensing/`: those plates carry brand-shaped marks that
no registry row names; this document does not name any brand.)

## 9. Silhouette test at actual phone size

The stage draws the artboard at the 390 × 844 mint viewport (the A0/A1
rulings' viewport) into a stage area of 844 − 56 − 92 = **696 px**
(`SET_HUD_HEIGHT`, `SET_COMMAND_HEIGHT` in `src/game/sessionTuning.ts`).
Cover-fitting 1152 × 1728 into 390 × 696 is **× 0.403** (height-limited; the
sides crop to the middle 390 of 464 px). Contain-by-width is × 0.339 — the
worst case. Test at both.

| | canvas px | phone px (× 0.403) | phone px (× 0.339) |
| --- | --- | --- | --- |
| Athlete at lockout | 1010 | **407** | 342 |
| Athlete crown at the hole | 594 | 239 | 201 |
| Head | 134 | 54 | 45 |
| Belt height | 58 | 23 | 20 |
| Bar shaft (end-on) | 17 | 7 | 6 |
| 25 kg disc | 260 | 105 | 88 |
| 1.25 kg disc | 92 | 37 | 31 |
| Hand | 110 | 44 | 37 |
| Knee-sleeve length | 173 | 70 | 59 |

**Procedure.** Render the side view as a solid `#000000` shape on
`#1a120e` at each scale, at lockout, at judged depth and at the hole. Pass
conditions, each yes/no:

1. A reader who has not seen the colour art says "squat" at all three keys.
2. Lockout, judged depth and the hole are distinguishable from each other by
   silhouette alone.
3. The belt, the bar and at least the largest disc are separable from the
   body outline.
4. The head is small enough that no facial feature would survive (≤ 55 px):
   confirms the no-face decision rather than contradicting it.
5. Feet read as planted, on one floor line, at every key.

## 10. What the rig may not redraw

Every one of these arrives as an input (handoff §4) and is never
reconstructed in the art: bar velocity, grind, strain, effort band, load,
plates, depth judged, lockout, outcome, miss reason. The art expresses them;
it does not compute them. A beat the art needs and the contract lacks is a
request under `docs/design/PRESENTATION-CONTRACT-REQUEST.md` §10, not an
invention.

## 11. Acceptance checklist for this package's deliverables

1. Three views at one scale on one baseline, bar in frame at lockout, mid
   load.
2. Every §2 length measurable on the side view within ±2% and identical
   across all six §4 keys.
3. §4 angles and hip heights within ±3° / ±15 mm at each key.
4. §5 disc diameters within ±2% of the table; the three loads drawn and
   checked at chest / knee height.
5. §6 light direction consistent across the three views and the room plate.
6. §9 silhouette test passed at both scales, all five conditions.
7. No text, logo, wordmark, brand or real likeness anywhere.
8. The empty side-on room plate, same size, same light.
9. Editor source and flat PNGs delivered, owned or licensed for
   redistribution (`docs/design/IRON-AND-AMBER-REFERENCE.md`).

**Grading.** Items 1–5 and 8–9 are checkable against this document by
anyone. Items 1 and 6 (does it read as the athlete, does the shape hold at
phone size) are VISUAL judgements: a human reviewer grades them, never this
lane, and OWNER PLAYTEST is Bryant's alone.

## 12. `ASSET_AUTHORING_BLOCKED` — what this environment cannot produce

| Blocked deliverable | Why | What unblocks it |
| --- | --- | --- |
| The three views, the reference sheet, the silhouette render | No illustrator and no owned image pipeline in this environment; an AI-generated pose frame is a ruled rejection for the player path. | A human illustrator (or an owned/licensed image pipeline) drawing to §1–§9. |
| The empty side-on room plate | Same. The existing plates are painted scenes with a lifter in them (§8). | Same, to §6 and §8. |
| The rig and the `.riv` | No Rive editor here — measured 2026-09-08: `rive.app`, `editor.rive.app` and `app.rive.app` answer 403 at the egress proxy, no display, no authoring binary; by ruling no binary generator, no format reverse-engineering, no replacement format, no diagnostic file promoted. **PRODUCTION ATHLETE AUTHORING = BLOCKED — RIVE EDITOR / ASSET AUTHOR REQUIRED.** | An editor author working from `docs/design/RIVE-AUTHORING-HANDOFF.md` (§14 there lists the exact environment); acceptance is `node tools/rivContract.mjs assets/athlete/athlete-01.riv --artboard squat`, then handoff §15. |

Not blocked, and done: this specification; the handoff; the input manifest
(`docs/design/athlete-rig-manifest.json`, pinned to the binding by test); the
validation command; the unmounted production stage pair that drives the rig
from `liftPresentation(state, totalKg, prior)` and nothing else.
