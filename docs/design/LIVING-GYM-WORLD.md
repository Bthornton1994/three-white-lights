# Living Gym World — architecture and first slice

Architecture / prototype phase. Draft only. Not merged.

This document is the Session B answer to the living-gym product ruling:
Gym Empire is a persistent animated world, not a collection of static room
images with cards layered over them.

No Visual PASS, Soft-Feel PASS, Empire Ready, or Performance PASS is claimed
here.

## 1. Diagnosis of the current Session B rendering architecture

Session B already has a real floor simulation and a real sprite renderer, then
hides most of that simulation on Play.

- `floorSim.ts` is a persistent entity machine: members hold `cell` / `next` /
  `progress`, walk seeking → queuing → using → leaving, and queues are derived
  from members. Stations are persistent `FloorStation` objects with use cells
  and queue cells.
- `FloorGrid.tsx` already lerps that position and tweens it with
  `Animated.timing` over the tick interval. Pose cycles exist for walk and use.
- Play identity after Iron & Amber art-02 is an owned empty-room PNG in
  `GymScreen`, plus tiny live sprites, plus occupancy **cards**. Station
  occupancy outlines and plate-loading discs were `opacity: 0` on Play.
- Cue bubbles (the Phase 3 thought-bubble language) are also hidden on Play.
- Build is a second visual (orthographic floor-plane + grid + tray) that
  manipulates the same `FloorState` objects.

The product failure is not "there is no sim." It is that Play still *reads*
like:

static gym painting → occupancy cards → tap → drawer.

The world was present and then covered.

## 2. Which parts already support a persistent world

- Member identity: `livingMembers.ts` gym-local ids, not recreated per tick.
- Pathing and use: `floorSim.ts` cell/next/progress, five states, derived FIFO
  queues, interruptions, changeovers.
- Persistent equipment: `floor.ts` placements + fixed furniture +
  `trainingStation.ts` Competition Bench Bay.
- Renderer interpolation: `memberWorldPoint` (now the shared projector) and
  `AmbientMemberBody` walk tween.
- Shop → owned → place → physical object: session buy still goes through
  `sessions.ts` / `placeFloorItem`. Confirmed placement already participates
  in `floorStations`.

## 3. Which parts still behave like screens/cards instead of a game world

- Occupancy cards are the Play occupancy language (`N on the floor`,
  `N waiting`, `N on the machine`).
- Station highlights were hidden on Play (fixed this slice).
- Queue cells had no world mark (fixed this slice).
- Members are 1-tile tokens on a full-bleed painting; they move, but they do
  not dominate the scene.
- Staff exist only as management cards. No world presence. Not invented here.
- Shop is still a catalog surface. Purchase already connects; the shop screen
  itself is not a world view.
- Build still *looks* like a different board. Placement is real; the visual
  mode split remains.

## 4. Recommended animation/rendering architecture

Do not rewrite the sim. Do not swap room images. Do not introduce Rive, Phaser,
or 3D for this slice.

| Layer | Choice now | Scale-up path |
| --- | --- | --- |
| Simulation | Keep `floorSim.ts` as truth | unchanged |
| Mapping | `worldView.ts` projector | same module |
| Render now | RN `View` / `Image` / `Animated.ValueXY` | proven on garage (3 members) |
| Render later | Skia canvas or instanced sprites if warehouse 40 fails | measure first |
| Character animation | Existing two-frame walk / use poses | optional later sprite cycles |
| Environment | Empty-room atmosphere PNG as **layer 1 only** | lighting overlays, not state JPEGs |

Rejected now:

- Crossfading generated gym-state stills.
- Rive: authored character files do not solve 40 simultaneous entities.
- Lightweight 3D: Expo/web cost and interaction rewrite with no product gain
  for a 2D management floor.
- Phaser: not the Expo/RN ownership model.

Skia is already in the repo for Session A. Session B may adopt it later as a
**renderer**, not as a second sim, and only after measuring the RN sprite
path at warehouse scale.

## 5. Entity model

Persistent entities (gameplay relevant):

- **Member** — `FloorSimMember` projected to `WorldMemberView` (`index`,
  `activity`, interpolated `tile`, `target`, `queueSlot`).
- **Station** — `FloorStation` projected to `WorldStationView` (`occupancy`,
  counts, occupied queue cells).
- **Equipment** — the same stations plus Build-mode placed/fixed sprites.
  Placement writes `FloorState`; the object stays.
- **Staff** — not a world entity this slice. Management card only. Do not
  invent staff AI.

Activities: `walking` | `waiting` | `using` | `leaving` | `interrupted` |
`stranded`.

Station occupancy, priority order: `occupied` > `changeover` > `queued` >
`approaching` > `available`.

## 6. Simulation-to-rendering interface

```
worldFrame(FloorSimState, FloorStation[]) -> WorldFrame
```

- Simulation owns truth. `worldFrame` is a pure read.
- Renderer (`FloorGrid`) draws `WorldFrame` plus sprite pose/facing (sprite
  presentation stays in FloorGrid; occupancy lives in worldView).
- Furniture-meeting draw bias (`memberDrawPoint`) stays renderer-only so the
  sim cell is never rewritten.
- No `GymViewAction` for occupancy. No new `GymState` field.

## 7. One-member / one-station vertical slice (this prototype)

Proof on the opening garage:

- One persistent gym scene (owned empty-room atmosphere, not a state JPEG).
- Living members from Session B roster (garage ships 3; the proof follows a
  real member onto the Competition Bench Bay).
- That member receives a real destination from `floorSim`.
- Walk is interpolated; tests forbid a >1 tile teleport per tick.
- Station occupancy outline is visible on Play.
- Use pose + occupied occupancy when the member acquires the bay.
- Release remains sim `leaving` (already timed). Not a new mechanic.

Not in this slice: shrinking the roster to one body, new art, staff, D2
balance, G.2C3.

## 8. Queue visualization proof plan (next, not this PR)

Garage stock capacity is one seat and three members, so a queue will form on
the same scene. This slice already marks occupied queue cells.

The **second proof** is still later:

1. Capture a constrained bay with a visible line.
2. Buy Capacity (second bench) through the existing upgrade arm.
3. Show the line shortening without resetting members.

Do not start that until the one-member walk/occupy proof is accepted.

## 9. Facility placement / movement animation plan

Already true, not rebuilt here:

- Place/move is `floor-place` against `placeFloorItem`.
- The same `FloorPlacement` object relocates.
- Sim interruptions fire on move/remove (`target-moved` / `target-removed`).
- Do not fake placement by swapping the atmosphere PNG.

Later: tween the moving sprite to the drop cell instead of snapping on
release. Not this slice.

## 10. Performance scaling strategy

Targets, not claims:

- Garage 3, storage-unit 8, strip-mall 18, warehouse 40 simultaneous members.
- Measure FPS, frame-time spikes, interaction latency, memory before any
  Performance PASS.
- Current cost: one `Animated.ValueXY` + `Image` per member, plus station
  sprites. Fine for 3; unproven at 40.
- If warehouse janks: batch onto one Skia surface, freeze off-screen bob,
  drop walk tween for distant bodies (LOD), never drop sim ticks.
- Do not assume one-member smoothness equals forty.

## 11. Mobile interaction strategy

- Facility remains the primary surface.
- Occupancy cards stay as compact HUD explanation, not the sim.
- Station/member taps still open compact panels; they dismiss.
- Build FAB on Play; TRAIN remains Session A (`shell-leave-gym`).
- Required viewports 375×812 and 390×844: no horizontal overflow, no clipped
  dock, no permanently-eating drawer.

## 12. Files / modules expected to change

This slice:

- `src/empire/worldView.ts` (new projector)
- `src/empire/worldView.test.ts`
- `src/empire/FloorGrid.tsx` (draw world occupancy on Play)
- `src/empire/GymScreen.test.ts`, `src/empire/empireCore.test.ts`,
  `src/empire/empireForbiddenOutput.test.ts` (census pins)
- `docs/design/LIVING-GYM-WORLD.md`
- `tools/capture-living-world.mjs`
- screenshots under `docs/design/living-gym-world/`

Not converted to TanStack Start. `package.json` `dev` script not re-added.

## 13. Protected boundaries that remain untouched

- Session A lift / art / plates (`src/lift`, `src/art`, `src/session`, meet).
- PR #46 Iron & Amber chrome foundation.
- PR #49 art-02 commit is the base; this is a new branch on top, not a rewrite
  of that PR.
- G.2C3 / G.2D / G.2E, D2 balance, reputation, persistent NPCs, Portfolio,
  dues, arrivals, random churn.
- Session A worktree / lease.
- Untracked App Builder chrome.

## 14. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Census / forbidden-output pins move | Pin from actuals; do not guess |
| Occupancy outlines feel like debug chrome | Named CSS colours already used for using/claimed; queue mark uses the queuing colour; no new palette |
| Tiny tokens still fail the "alive gym" read | Named residual; do not generate new art this slice |
| Architectural set dressing double-draws live furniture | Named residual from art-02 |
| `setInterval` tick vs display refresh | Existing tween already covers one tick; RAF rewrite later if hitching is measured |
| Warehouse 40 Animated nodes | Measure; Skia batching is the escape hatch, not the first build |
| Queue proof confused with this slice | Queue marks exist; Capacity upgrade proof is explicitly next |

## 15. Evidence required before claiming the architecture works

Separate verdicts. None of these is inferred from the others.

- **TECHNICAL PASS:** `worldView.test.ts` plus focused Empire tests. No-teleport
  walk. Occupancy projector matches sim states.
- **SIMULATION PASS:** already owned by `floorSim.test.ts`; this slice must not
  change step behaviour.
- **PERFORMANCE PASS:** measured FPS at target entity counts. Not this slice.
- **VISUAL PASS:** human watches one member walk, wait if needed, occupy, use,
  release on device-sized Play. Screenshots are evidence, not the pass.
- **SOFT-FEEL PASS:** motion is smooth and restrained. Not claimed.
- **OWNER PLAYTEST PASS:** Bryant plays it. Not claimed.

Exact evidence this slice must produce:

1. Occupancy outline visible on Play for the bench in use
  (`floorsim-using-training-competition-bench-bay` opacity > 0).
2. Member sprite opacity 1, position changing across sampled frames.
3. No room-image swap (same `floor-garage.png` atmosphere).
4. Queue cell marks when a member is actually queuing.
5. 375×812 and 390×844 Play captures; no horizontal overflow.
6. GitHub CI reported Unknown if no workflow run exists.

The architecture works when a player can look at the gym and see a member
go to a station. Tests cannot say that. They can only say the mapping is
true.
