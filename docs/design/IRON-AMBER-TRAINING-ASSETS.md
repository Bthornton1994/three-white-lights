# Iron & Amber training assets

Owned illustrated stills for Session A (daily loop and Meet Day). Generated
2026-09-13 from the binding mockup `docs/design/iron-and-amber-reference.jpeg`
(panel 03: warm gym atmosphere + athletic HUD). These are not third-party stock,
not sprite rasters, not a CSS recolor of the old stage, and they do not carry
third-party marks. HUD chrome is the React overlay, not pixels in the JPEG.

The plates are the gameplay surface: check-in, briefing, live squat/bench/deadlift,
rest, close-out, walk-out, attempt, verdict, and attempt-select fill the room.
Chrome is a compact overlay (HUD on top, command at the thumb). Cue rings sit on
the plate, not at sprite-era TRACE coordinates. GDD §3.2 check-in stays on the
played path.

## Loading path

Metro `require` of each `.jpg`. TypeScript sees them through `src/session/jpg.d.ts`.

| Surface | Module | How it loads |
| --- | --- | --- |
| Check-in gym | `src/session/CheckInView.tsx` | `IronAmberRoom` + `gym-briefing.jpg` |
| Briefing gym | `src/session/BriefingView.tsx` | same gym plate via `IronAmberRoom` |
| Close-out gym | `src/session/CloseOutView.tsx` | same gym plate |
| Live set | `src/session/TrainingLiftStage.tsx` | `PLATE_SOURCE[ironAmberPlateFor(kind, phase, height)]` |
| Meet hall | `src/meet/MeetHallView.tsx` | `ironAmberHallPlateId` + cover-focus |
| Meet attempt | `src/meet/AttemptView.tsx` | `TrainingLiftStage` as `LiftStage` |
| Cover | `ironAmberPlateLayout` / `ironAmberHallLayout` | cover-focus so the bar stays in frame |

`src/lift/LiftStage.tsx` remains the A0 sprite harness. It is not the Meet Day
picture.

## Provenance

Cursor GenerateImage, rights-clean illustrated facility stills matching mockup
panel 03's garage: brick, amber lights, original Three White Lights posters,
plants, crate copy, unbranded plates. Chrome stays a React overlay — the JPEGs
are the room, not the HUD. Source size 720×1280 JPEG.

| Plate | File |
| --- | --- |
| gym-briefing | `assets/iron-amber/gym-briefing.jpg` |
| squat-brace | `assets/iron-amber/squat-brace.jpg` |
| squat-hole | `assets/iron-amber/squat-hole.jpg` |
| squat-drive | `assets/iron-amber/squat-drive.jpg` |
| bench-brace | `assets/iron-amber/bench-brace.jpg` |
| bench-chest | `assets/iron-amber/bench-chest.jpg` |
| bench-press | `assets/iron-amber/bench-press.jpg` |
| deadlift-floor | `assets/iron-amber/deadlift-floor.jpg` |
| deadlift-knee | `assets/iron-amber/deadlift-knee.jpg` |
| deadlift-lockout | `assets/iron-amber/deadlift-lockout.jpg` |
