# Shared Iron & Amber scene asset specification

Status: implemented scene candidate; independent visual acceptance and physical-device verification remain required. The binding references are `01-living-gym.png`, `02-direct-build.png`, `03-visible-progression.png`, and `../IRON-AND-AMBER-REFERENCE.md`.

The scene is an original illustrated vector composition. It uses no photographed equipment cutouts, legacy pixel sprites, competitor assets, or permanently painted usable stations. The reference artwork sets material, anatomy, lighting, and mobile-composition goals; it is not an equipment-state background.

## Coordinates and camera

One integer placement cell represents one world metre. `floor.ts` supplies the occupied rectangle and quarter-turn orientation. Asset meshes use local world coordinates within that rectangle; the remaining rectangle is access clearance. Equipment origins are their floor-placement origins. Feet, support pads, bar grips, and seat contacts use the same world projection.

`camera.ts` projects world X/Y into an oblique diamond floor with a 0.47 slope and a 0.98 vertical scale. Pan is measured in viewport pixels. Zoom scales people, equipment, shadows, wall fixtures, and placement geometry together. `fitSceneCamera` fits the complete stage, including its stage-specific wall height; a closer inhabited view may intentionally crop the room.

`equipmentTransform` rotates local mesh coordinates through the same four supported orientations as domain footprints. Asset dimensions never determine placement validity: that remains the facility reducer's responsibility.

## Palette, materials, and light

`scenePalette.ts` owns the material palette. Espresso surrounds, charcoal rubber, amber windows, warm brick, dark steel, weathered wood, and restrained plate colours apply to the whole room. Steel has separate lit tops, shaded sides, dark edges, bolt holes, and highlights. Pads have seams. Plates have rims, recessed faces, sleeves, and readable outside labels.

Window and pendant light create floor pools. Contact shadows sit on the floor beneath the mesh's physical support bounds, with a softer radial falloff outside contact. The placement rectangle remains distinct from a cast shadow or a decorative highlight.

## Equipment and interaction poses

`equipmentData.ts` owns mesh dimensions, material choices, parts, and contact fixtures. `anatomyData.ts` owns joint locations, body proportions, and station-local poses. `sceneTuning.ts` owns motion rates and rendering values.

| Equipment | Represented interaction |
| --- | --- |
| Competition bench | Supine press; moving hands and bar; feet beside the pad |
| Squat rack | Squat with descending hips, bent knees, and a shoulder-level bar |
| Power bar and competition plates | Handling/preparation pose when used independently |
| Air bike | Seated posture with rotating pedals and matching ankles |
| Rower | Seated stroke, extending legs, moving seat/torso, and pulled handle |
| Treadmill | Standing stride on the belt |
| Sled | Forward lean and hand contact on the uprights |
| Dumbbells | Curling hands with held weights |
| Cables | Seated pulling motion and cables attached to the hand grips |
| Strength machine | Seated pressing motion |
| Mats and foam rollers | Floor-level stretching and recovery poses |
| Sauna | Seated posture within the wooden enclosure |
| Wraps, belts, sleeves, specialty bars | Preparing or handling the corresponding item |

The Competition Bench Bay's purchased capacity produces a second physical mesh at the domain-derived expansion position. Each occupied simulation seat binds to its corresponding bench. Removing or rotating a targeted station leaves the simulation responsible for interruption and replanning; a stale target is not drawn in a newly invented station pose.

Walking, waiting, leaving, interrupted, and stranded states come from the deterministic floor simulation. Reduced motion suppresses body cycles. A manager appears only when the managed gym has a hired manager. Clipboard-reading is presentation flavor; it does not invent a repair job, new pathfinding, wages, bonuses, or service effects.

## Bounds, depth, and platform adapters

Assets are command lists with transparent space outside their geometry. Equipment hit bounds derive from the rendered mesh, with a small touch margin. Selection and placement feedback use the complete projected domain footprint.

Entity depth derives from its floor anchor. Mesh parts are ordered within an entity; this avoids a long bench pad painting over its lifter. Floor and environmental light render beneath entities. The builder returns the same screen-space polygon, line, ellipse, text, and gradient commands to web Canvas and native SVG adapters.

## Visible progression and provenance

Garage: intimate brick walls and low fixtures. Storage unit: corrugated steel and aisle markings. Neighborhood unit: plaster, wood dado panels, and wider windows. Warehouse: larger floor dimensions, tall brick, steel roof trusses, and marked aisles. The domain supplies each room's usable floor size and live equipment.

All mesh, anatomy, foliage, brick, floor-wear, and material data in this scene were authored for TWL in this implementation. There are no third-party asset licenses to import. Library/framework licenses remain those of the existing application dependencies. Reference/store screenshots are inspection material, not shipped art.

Focused tests cover projection inversion, complete-stage fit at phone widths, quarter-turn contacts and hits, physical capacity, visible population counts, preview bounds, manager presence, and the bench-pad occlusion regression. Passing these checks does not establish the supplied reference's illustration bar, touch feel, or device frame rate.
