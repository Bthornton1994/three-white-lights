# Lift cards (actual ~104 px read) and title-screen concept

**CONCEPT ONLY. DO_NOT_MERGE.**

## 1. What the cards actually are on screen (measured at 50b07c89)

| Viewport | `.lift-card-art img` box | Drawn art | Scale from the 104 export |
| --- | --- | --- | --- |
| 390×844 phone | 162 × 104 | 104 × 104 (object-fit contain) | 1.0 (integer, clean) |
| 1280×800 desktop | 190 × 190 | 190 × 190 | 1.827 (non-integer → uneven pixels) |

Cards render with `image-rendering: pixelated`. The phone read is an exact 2×
of a 52-lattice drawing. The desktop read smears any lattice; the fix is a CSS
integer cap (156 = 3×52 or 208 = 4×52) that Cursor applies at integration, not
an art problem. `tools/preview_harness.py` shows both reads plus a squint pass.

## 2. Card rule: crop to the identifying mass, never shrink the master

A 52-lattice card cannot hold a full body with a barbell and stay readable
(the audit: "squat sitting blob; deadlift head collapses; faces two dots"). Each
card is a **separately drawn composition** whose bar runs off both edges and
whose head is at least 10 px tall.

Diagrams (boxes, not art): `templates/card-52-composition-{squat,bench,deadlift}.png`.

| Card | Crop | Head | Bar | Plates | Identity carried by |
| --- | --- | --- | --- | --- | --- |
| Squat | Waist-up, front 3/4 | 12 × 12 at (20–32, 3–15) | Across the traps y 15–18, full width | Cropped by both edges (x 0–9 and 44–52) | Hair wedge, beard mass, chevron at y 30, belt at the bottom edge |
| Bench | 3/4 side, chest and bar | Lying, 12 × 10 at (12–24, 14–24), eyes up | Diagonal (10,18)→(48,21) | Far small at (6–14, 8–20); near LARGE at (34–52, 22–48) overlapping pad | Rack upright at left, pad diagonal, near plate overlap |
| Deadlift | Lockout, head to knee | 10 × 11 at (21–31, 1–12), chin up | Upper thigh y 38–41, full width | Cropped by both edges | Shoulders back, straight arms, belt, knee sleeves cropped at the bottom |

Per-card colour budget: **16**. Face on a card: brow 1 row, eyes 1 px HAIR0
each with 1 px WRAP1 beside, nose 1 px SKIN1, beard a 3-row HAIR1 mass, hair
3-row HAIR0/HAIR1 wedge. No mouth on NEUTRAL cards; a 3 px CHALK teeth row on
STRAIN (max) cards.

Light vs max on cards: red stack vs red+blue; bar bows 1 px on max; FLUSH head
and STRAIN on max; near shoulder 1 px rounder on max. Same crop for both so the
pair reads as one lift at two loads.

Test before handoff: view the 104 export at 100 % on a phone at arm's length
and at 190 px on a desktop. If the lift is not identifiable in one second with
the caption hidden, the card fails.

## 3. Title screen concept — "Three White Lights"

The title must read as *Three White Lights* first and *Iron & Amber Arcade*
second, on both masters, without clipping the identity on any common viewport.

### 3.1 Composition

- **Hero motif:** three round white judge lights on a dark steel box above
  the platform — the brightest pixels in the image. The logo lockup integrates
  three white circles (in the counters or as the dots over the I's), so the
  motif appears twice: once as the logo, once as the object.
- **Reed from behind, 3/4**, walking toward the platform: broad back, chalk
  handprints, singlet straps, belt buckle glint, knee sleeves. Identity from
  the back = silhouette + hair wedge + kit. No face on the title (the face is
  the game's, not the poster's).
- **Environment:** iron-and-brick meet hall, amber industrial lamps upper-left
  and upper-right, crowd silhouettes (CROWD0/CROWD1) at the far edges, wooden
  platform (WOOD0–2) with a 1 px AMB2 edge highlight.
- **Lower third stays dark and quiet.** The runtime's `.title-veil` darkens
  from 42 % to 100 % of height and places the copy and the "Step onto the
  platform" button there. Hero content lives in the upper 55 %.
- **Logo:** heavy condensed pixel letterforms, WHT1 face, BAR0 1 px drop
  shadow, AMB1 sub-line "IRON & AMBER ARCADE" with AMB0 rules. No studio
  name, no copyright line, no "PRESS START" in the art — the runtime supplies
  the copy.

Reference (AI, direction only, do not trace):
`reference-ai/AI-REF-05-TITLE-SCREEN.png`. Ignore its invented "PRESS START"
and "© 1994 Ironwrought Games" text entirely — that is model hallucination, not
part of this product.

### 3.2 Masters and safe zones (computed for the live CSS)

| Master | Size | Selected when | CSS |
| --- | --- | --- | --- |
| `title.png` | 1008 × 1792 | viewport < 860 px wide | cover, position center 42 % |
| `title-wide.png` | 1792 × 1008 | viewport ≥ 860 px wide | cover, position center |

Safe zones = intersection of the visible rects across the listed viewports
(`templates/title-portrait-safe-zone.png`, `templates/title-wide-safe-zone.png`):

| Master | Viewports checked | Safe x | Safe y |
| --- | --- | --- | --- |
| portrait | 390×844, 360×800, 430×932, 768×1024 | 100..907 | 188..1532 |
| wide | 1280×800, 1440×900, 1920×1080, 2560×1080, **1024×1366** | **518..1273** | 126..882 |

The wide safe zone is narrow because a portrait tablet ≥ 860 px wide
(1024×1366) still receives `title-wide.png` and crops it to the centre 756 px.
Either the logo + lights + Reed fit inside x 518..1273, or Cursor switches the
`<source media>` query from width to aspect ratio at integration. This brief
assumes the art fits the zone; the CSS fix is recommended as well.

### 3.3 Lift-select backdrop

`platform.png` (1280 × 720) is the backdrop for lift select, attempts, and the
stage. Keep the platform surface in rows 62 %–80 % so the 320 lifter (drawn
with feet at master y 304) lands on the wood at both measured stage sizes.
Brick lattice must be *irregular* (mortar breaks, two brick tones alternating
per course, a darker band behind the lights) — the audit called the current one
"tiled brick gym".
