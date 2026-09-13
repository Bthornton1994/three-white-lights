# Iron & Amber training assets

Owned illustrated stills for the Session A daily loop. Generated 2026-09-07
from the binding mockup `docs/design/iron-and-amber-reference.jpeg`. These are
not third-party stock, not sprite rasters, and not a CSS recolor of the old
stage.

The plates are the gameplay surface: check-in, briefing, live squat/bench/deadlift,
rest, and close-out fill the room. Set chrome is a compact overlay (set/weight/pips
on top, command prompt at the thumb). Cue rings sit on the plate, not at
sprite-era TRACE coordinates. GDD §3.2 check-in stays on the played path.

## Loading path

Metro `require` of each `.jpg`. TypeScript sees them through `src/session/jpg.d.ts`.

| Surface | Module | How it loads |
| --- | --- | --- |
| Check-in gym | `src/session/CheckInView.tsx` | `IronAmberRoom` + `gym-briefing.jpg` |
| Briefing gym | `src/session/BriefingView.tsx` | same gym plate via `IronAmberRoom` |
| Close-out gym | `src/session/CloseOutView.tsx` | same gym plate |
| Live set | `src/session/TrainingLiftStage.tsx` | `PLATE_SOURCE[ironAmberPlateFor(kind, phase, height)]` |
| Cover | `ironAmberPlateLayout(kind, w, h)` | cover-focus so the bar stays in frame (not JPEG intrinsic size) |
| Wiring | `src/session/SetView.tsx` | mounts `TrainingLiftStage` as `LiftStage` |

Meet Day still draws `src/lift/LiftStage.tsx` (sprite stage). A0 lift files
are not on this path.

## Provenance

Imagine reference-to-image (mockup = style, prior plate = pose). Gym briefing
was a follow-up image-to-image pass to strip a leftover panel.

| Plate | File | Imagine id |
| --- | --- | --- |
| gym-briefing | `assets/iron-amber/gym-briefing.jpg` | `e81a338d-ff85-42e9-9984-59debb3ca2e4` |
| squat-brace | `assets/iron-amber/squat-brace.jpg` | `419fe97d-88b3-47a1-926c-eb7ff5e91ed6` |
| squat-hole | `assets/iron-amber/squat-hole.jpg` | `587c740e-a9dd-4df1-a3a5-b51561b0191f` |
| squat-drive | `assets/iron-amber/squat-drive.jpg` | `07d4ac98-4702-40a9-bfc0-14c5f832fd9e` |
| bench-brace | `assets/iron-amber/bench-brace.jpg` | `90ca6b5f-d99e-4c41-bba2-98ece38b7ba4` |
| bench-chest | `assets/iron-amber/bench-chest.jpg` | `cbeec4ec-42fc-4772-bc62-322f1f5461f4` |
| bench-press | `assets/iron-amber/bench-press.jpg` | `999a5ee8-e5ff-483a-8cd0-83812f789dfd` |
| deadlift-floor | `assets/iron-amber/deadlift-floor.jpg` | `71f084f0-4aaf-4a46-9d60-a668784a27fd` |
| deadlift-knee | `assets/iron-amber/deadlift-knee.jpg` | `7897c3dd-d965-4741-ac6b-5e1b78977387` |
| deadlift-lockout | `assets/iron-amber/deadlift-lockout.jpg` | `537e953e-7021-4847-ba1b-d01ee7609363` |
