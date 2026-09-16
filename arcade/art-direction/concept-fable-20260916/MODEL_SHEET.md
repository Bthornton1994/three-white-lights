# Model sheet — Reed Hale (locked identity, documented)

**CONCEPT ONLY. DO_NOT_MERGE. Not production art.**
This document *is* the model sheet. `reference-ai/AI-REF-01-MODEL-SHEET.png` is an
AI-generated mood/proportion reference stamped as such; it is not the model sheet
and must not be traced. The human pixel artist draws the real model sheet page
(`model-sheet.png`, see `PRODUCTION_SPEC.md`) from this text.

Reed Hale is an entirely fictional heavyweight powerlifter. Not a likeness of any
real athlete or person. Slam Masters / Super Punch-Out!! / NBA Jam are quality-bar
references only.

## 1. Who he is (one paragraph the artist can hold in their head)

A 120 kg-class raw lifter in his mid-thirties who has been on platforms for
fifteen years. Stocky, not bodybuilder-lean: thick trunk, short neck, big
forearms, heavy thighs. He is calm on light attempts and turns into a red,
bared-teeth grinder on max attempts. He never looks cute and never looks like a
cartoon strongman; he looks like a man moving something heavy.

## 2. Silhouette (read at 273 px stage and 104 px card)

| Anchor | Value (160 lattice, standing 3/4 front) |
| --- | --- |
| Standing height | 126 px (head-top y 26 → shoe bottom y 152) = 6.3 heads of 20 |
| Head | 16 w × 20 h incl. hair; square jaw, corners cut 1 px |
| Neck | 10 w × 4 h — short; disappears under load |
| Shoulders / traps | 52 w (2.6 heads) at y 50–62 |
| Torso (singlet) | 40 w, y 62–90; chest box, not a V |
| Belt | y 90–94, 4 rows |
| Hips | 36 w (1.8 heads), y 94–104 |
| Thighs | 18 w each, 4 px gap, y 104–124 |
| Knee sleeves | y 120–134 |
| Shins | 12 w each, y 134–148 |
| Shoes | 14 w × 4 h, flat, y 148–152 |

Silhouette test: filled black, at 52 px tall, he must still read as a *wide,
short-necked block on thick legs*. If the silhouette reads as an average
athletic figure, the shoulders or thighs are too narrow.

Diagram: `templates/proportion-guide-160.png` (boxes, not art).

## 3. Face (16 × 20 at 160 lattice; ~8 × 10 on a 52 card)

Rows are offsets from head-top.

| Rows | Feature | Pixel rule |
| --- | --- | --- |
| +0..+4 | Hair wedge | HAIR0/HAIR1 flat top, front edge 1 px higher than back (wedge). Sides shaved: 2 px band of SKIN1 at the temples, not hair. |
| +5..+7 | Forehead | SKIN3 with 1 px SKIN4 highlight top-left |
| +8 | Brow | 1 row HAIR0, 2 px per side, 1 px gap over the nose — heavy |
| +9..+10 | Eyes | 2 × 2 each: 1 px WRAP1 (white) outer, 1 px HAIR0 inner. Deep-set: SKIN1 1 px under each eye |
| +9..+13 | Ears | 1 px wide SKIN2 on both sides, top at brow line |
| +11..+13 | Nose | Broad: 1 px SKIN1 shadow column, 2 px SKIN1 base row at +13 |
| +13 | Beard top edge | Cheek line: starts at ear, 1 px below cheekbone |
| +14..+15 | Mouth | 3 px MOUTH at +15, framed by beard |
| +13..+20 | Beard | HAIR1 mass covering jaw and chin, moustache joins at the corners; 2 px HAIR2 texture highlights (upper-left of chin, upper-left of moustache). Never a thin line — a *shape*. |

**Identity anchors** (the drift checklist — every frame, every effort, both
outcomes, both cards):

1. Hair wedge: flat top, shaved-side SKIN1 band present.
2. Beard: full jaw + chin + joined moustache, HAIR1 mass with HAIR2 texture.
3. Heavy 1-row brow with a 1 px gap.
4. Chevron: 5 w × 3 h AMB1 with AMB2 top edge, centred on the chest.
5. Belt: BELT 4 rows, 3 × 3 AMB1 buckle centred.
6. Knee sleeves KNEE1 with a 1-row KNEE2 top band.
7. Wrist wraps WRAP1 3 rows.
8. Shoulder : hip width ratio 52 : 36.

If any anchor is missing or altered in a frame, that frame is identity drift.
This is what Independent QA verdict #6 checks.

## 4. Expression set (six stamps, edits from NEUTRAL)

| Stamp | Edit | Used on |
| --- | --- | --- |
| NEUTRAL | as above | idle, light setup/lockout, cards (light) |
| BRACE | cheeks +1 px each side (SKIN3), eyes → 1 px HAIR0 slits, mouth flat 4 px MOUTH | light descend/pause/pull |
| STRAIN | brow drops to +9 as a shallow V, eyes shut (2 px HAIR0), mouth open 4 × 2 with a CHALK teeth row, skin → FLUSH | max hole/sticking/grind, max cards |
| EXHALE | mouth 3 × 3 MOUTH open, eyes open, brow relaxed at +8 | lockouts, success frame 1 |
| GRIN | mouth 5 px CHALK row with MOUTH beneath, eyes 1 px closed arcs | success frames 3–4 |
| SLACK | brow up to +7, eyes 2 px looking down (dark px low), mouth 2 px open | miss frames 3–4 |

FLUSH replaces SKIN1→FLUSH0, SKIN2→FLUSH1, SKIN3→FLUSH2 on the head and neck
only, from the sticking frame onward on max sheets and on every max card.
Arms and legs stay in SKIN.

## 5. Hair and beard colour

HAIR0 `#17110F` shadow / outline-adjacent, HAIR1 `#2E211B` mass, HAIR2 `#4A3628`
texture highlight only. No brown lighter than HAIR2 anywhere on the head.

## 6. Clothing and kit (all palette names from `palette/iron-amber-v2.json`)

| Item | Colour | Notes |
| --- | --- | --- |
| Singlet | SING0 shadow, SING1 mass, SING2 lit planes, SING3 1 px rim on the lit shoulder | Iron-black, wide straps (4 px), legs end mid-thigh at y 110, hem 1 row SING0 |
| Chevron | AMB1 with AMB2 top edge, AMB0 bottom edge | 5 w × 3 h, chest centre y 66–68; the single edition mark |
| Belt | BELT, buckle AMB1 3 × 3 with AMB2 1 px | Lever belt: buckle centred, 1 px AMB0 lever line |
| Knee sleeves | KNEE0 shadow, KNEE1 mass, KNEE2 1-row top band | 14 rows; read as burgundy blocks, no stripes |
| Wrist wraps | WRAP0 shadow, WRAP1 mass | 3 rows at the wrist, chalk CHALK 1–2 px on the palm side |
| Shoes | SHOE0 mass, SHOE1 lit top, WRAP0 sole 1 row | Flat, no heel — powerlifting flats |
| Chalk | CHALK | Hands always; back (bar contact) on squat; a 3–5 px puff on max break/drop only |

## 7. Skin and lighting on the body

Ramp SKIN0..SKIN4. Key light upper-left (the platform lamp), cool violet
shadow side (SKIN0/SKIN1 lean purple, not brown-black). Muscle is drawn as
*plane changes*, not as line drawings: one SKIN3 plane on the top of a forearm,
one SKIN1 plane under it, one SKIN0 pixel where it meets the elbow. Never more
than three tones across a limb width at 160 lattice; two tones on a 52 card.

## 8. What is locked vs artist-owned

Locked by this brief: everything in §2–§7 (silhouette values, anchors, palette
roles, expression set).

Artist-owned: the exact pixel placement that makes the face a *face*. The
artist should draw the NEUTRAL head first at 160 lattice, then at 52, check
both against §3 and the anchors, and only then start poses. If the 52 head does
not read as the same man as the 160 head, the design — not the artist — is
wrong, and the brief should be revised rather than forced.
