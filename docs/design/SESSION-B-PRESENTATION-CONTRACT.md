# Session B presentation-state contract

Renderer-independent world truth. Grok owns this document and
`src/empire/presentationState.ts`. Claude Code owns how it looks.

Draft. Do not merge. No Visual / Animation / Soft-Feel PASS.

---

## Factory boundary

| Owner | Owns |
| --- | --- |
| Grok (this contract) | What the gym **does**: sim, identity, queues, placement, economy, staff mechanics, persistence shape |
| Claude Code | What the gym **looks and feels like**: art, animation, lighting, HUD styling, interpolation, camera |

Claude must not recreate simulation logic. Grok must not put visual instructions in this state.

---

## 1. Facility state

Read `PresentationWorld.facility`.

| Field | Meaning |
| --- | --- |
| `rung` | `garage` \| `storage-unit` \| `strip-mall-unit` \| `warehouse` |
| `grid` | tiles `{ width, height }` from `FLOOR_GRID_SIZE` |
| `tick` | integer sim tick, starts at 0 |
| `seed` | deterministic mix seed |

Authoritative store: `GymViewState.floor` + the live `FloorSimState` snapshot passed into `presentationWorld`.

Placement areas = empty cells of `grid` that do not overlap placed footprints. Grok owns legality (`placeFloorItem` / `placeFloorFurniture`). Claude owns the ghost / invalid tint.

---

## 2. Entity IDs

| Entity | Identity | Not identity |
| --- | --- | --- |
| Member | `GymMemberId` (`member:n{nonce}:{ordinal}`) | array index, screen order, displayName |
| Session equipment | SKU (`SessionEquipmentItem`) | cell, sprite, instance UUID |
| Furniture | SKU (`LadderEquipmentItem` in the starting kit) | cell |
| Station | `FloorStationRef` (`training:competition-bench-bay`, `fixed:power-bar`, `session:mats`) | station-array index |
| Staff | one optional manager per gym (`PresentationStaff`) | floor cell (none exists) |

**SKU is the equipment instance id.** The economy refuses `already-owned`. Two mats cannot exist. Capacity 2 is two `useCells` on **one** bay, not two bay entities.

If a later economy allows duplicate SKUs, this identity model must change **before** that purchase ships. Do not paper over it in the renderer.

`WorldMemberView.index` in `worldView.ts` is a FloorGrid convenience. The contract id is `PresentationMember.id`.

---

## 3. Member state

`lifecycle` is the real floor-sim alphabet. Do not invent parallel names in the renderer.

| Sim `lifecycle` | What they are doing | Suggested (Claude) motion |
| --- | --- | --- |
| `seeking` | choosing or walking to a station (`target` may be null) | walk / idle wander |
| `queuing` | standing in the station line | wait |
| `using` | occupying a seat | use pose |
| `leaving` | stepping off the **equipment** (not leaving the gym) | walk away |
| `interrupted` | target moved, removed, or route-blocked | reaction beat |

`stranded: true` is a flag on top of walking (`strandedAt` set). A sealed pocket still walks.

Spatial facts Grok owns:

- `cell` — discrete tile they occupy
- `next` — tile they are stepping into, or `null` if standing
- `progress` — `[0, 1)` toward `next`. Commits at 1. At most one cell per tick
- `target` — `FloorStationRef` or `null`

Claude owns interpolation, easing, gait, visual speed. Do **not** treat `worldView.memberWorldPoint` as a second sim. It is a lerp of `cell`/`next`/`progress`.

Other fields:

- `queueRank` — 0 is next to be served among claimants; `null` if not claiming
- `waitTicks` — live `tick - queueArrivedAt`, or completed `usingStartedAt - queueArrivedAt`; `null` if they never queued
- `timer` — remaining using / leaving / interrupted ticks
- `interruptedBy` — `target-removed` \| `target-moved` \| `route-blocked` \| `null`
- experience: `forming` has null scores (insufficient history — do not fake 0 or 1). `formed` splits **wait** vs **training** vs composite. A good training score must not be read as a good queue.

`displayName` lives on `LivingGymMember` in `GymViewState.livingMembers`. It is stored identity, not art. Look it up by `id`. It does not enter the sim.

---

## 4. Equipment state

`PresentationEquipment`:

| Field | Meaning |
| --- | --- |
| `item` | SKU id |
| `kind` | `furniture` (starting Barbell kit) or `session` (bought) |
| `placed` | on the floor vs in the tray |
| `position` | top-left tile, or `null` if unplaced |
| `footprint` | tiles |
| `condition` | 0..1 from `management.ts` |

Purchase does **not** auto-place. Buy writes `GymState.sessionEquipment`. Place writes `FloorState.placements[item]`.

`placeFloorItem` / `placeFloorFurniture` **are** move: placing an already-placed SKU overwrites its cell and excludes itself from overlap. Repeated moves are valid. Relocation (`move-up`) resets the floor to a new room; ownership stays on `GymState`.

Starting kit is granted on `createLadderState` and pre-placed by `createFloorState`. Purchased ladder SKUs (squat-rack etc.) have **no floor body** in this stage.

---

## 5. Station state

Stations are **derived** each call from floor + capability (`floorStations`). They are not a stored table.

| Field | Meaning |
| --- | --- |
| `ref` | stable SKU-kind id |
| `position` / `footprint` | primary rectangle (Capacity does not move this) |
| `capacity` | `useCells.length` — simultaneous seats |
| `occupancy` | `occupied` > `changeover` > `queued` > `approaching` > `available` |
| `usingIds` | members in `using` on this ref |
| `queueIds` | members in `queuing`, **FIFO service order** |
| `approachingIds` | members in `seeking` whose target is this ref |
| `changeoverSeats` | seats reserved for plate change |

Do not reconstruct queue order from HUD labels or from `queueCells` geometry. Use `queueIds` / `queueRank`.

Incomplete Competition Bench Bay (any of power-bar / comp-plates / flat-bench off the floor) is not a training station.

---

## 6. Queue semantics

There is **no queue table** in `FloorSimState`. Order is recomputed every tick:

1. Arrivals (`queuedAt` set) before walkers
2. Then `queuedAt` (or `claimedAt` for walkers) ascending
3. Then `index` ascending

`queueIds` is that order filtered to `queuing`. The head of `queueIds` is who acquires the next free seat after changeover.

Stock garage: 3 members, bay capacity 1, queue cap 3. A line will form without shrinking the roster.

Capacity upgrade (second bench) is the **next** visual proof. It must not reset members or clear the queue. Grok already owns that sim behaviour (`stationCapability` live Capacity).

---

## 7. Staff state

```
PresentationStaff { hired, tier, hiredUnderWarning }
```

One optional manager (`novice` \| `steady` \| `veteran`). Gym-wide hire/dismiss. Wage and auto-repair are management mechanics.

**No floor cell. No station assignment. No task animation.** Do not invent a walking staff body from this object. World presence is a later authorised slice.

Staff currently do **not** change floor-sim throughput or wait. Do not animate a throughput effect that the sim does not produce.

---

## 8. Placement truth

Grok:

- owned?
- legal cell? (bounds, overlap including furniture and bay expansion)
- `FloorState` after place/move/remove
- interruption (`target-moved` / `target-removed`) when a used object relocates

Claude:

- placement ghost
- movement tween
- valid/invalid tint
- selection chrome

The previously observed “cannot move a second time” class of bug is **not** in `placeFloorItem` / `placeFloorFurniture`. Those overwrite the same SKU key. If it still appears, it is renderer pending-place state — Claude’s surface — unless a new sim refusal can be shown in a test.

---

## 9. Update cadence

| Quantity | Value | Owner |
| --- | --- | --- |
| `presentationTickIntervalMs()` | 120 | renderer interval between `stepFloorSim` |
| `presentationStepProgressPerTick()` | 0.34 | sim |
| `FLOOR_SIM_LEAVING_TICKS` | 6 | sim |
| `FLOOR_SIM_INTERRUPTED_BEAT_TICKS` | 8 | sim |
| Stock changeover | 18 ticks | sim |
| Throughput changeover | 6 ticks | capability |

Continuous: `progress` in `[0, 1)`. Discrete: `cell`, `lifecycle`, queue membership, occupancy, SKU cells, economy.

Event order inside one tick (sim, not renderer): interruptions → motion commit → claims in member-index order → occupancy from the **previous** snapshot (no same-tick handover).

Claude should interpolate between logical ticks. Do not step the sim from an animation frame independently of the 120 ms cadence unless Grok changes the contract.

`FloorSimState` today is component-local in FloorGrid. Remount resets bodies; `GymMemberId` and visit history survive on `GymViewState`. Lifting the live sim onto `GymViewState` is OWNER_BLOCKED until Claude coordinates — it requires editing the renderer tick.

---

## 10. Units / ranges

| Field | Unit | Range |
| --- | --- | --- |
| grid / cell | tiles | integers ≥ 0 |
| progress | fraction of one tile step | `[0, 1)` |
| waitTicks / timer | sim ticks | integers ≥ 0 |
| condition / experience components | unit interval | 0..1, or `null` if forming |
| gymBucks | settled purse | ≥ 0 |
| occupancy counts | members / seats | integers ≥ 0 |
| bayQuality / bayCapacity / bayThroughput | axis levels | 0 or 1 |

---

## 11. Persistence expectations

**SERIALIZATION SHAPE = PASS.** `persistableFacilityTruth` is JSON-round-trippable.

**PERSISTENCE = NOT WIRED / OWNER_BLOCKED.** There is **no** `localStorage` and no
save file in `src/empire` (banned by census). Application save/load does not
exist yet. Do not report persistence as shipped.

What survives in-process on `GymViewState`:

- owned equipment, purses, rung
- floor placements and furniture cells
- Q/C/T capability
- living roster ids, names, visit history
- hired manager, condition, strikes

What does **not** survive remount:

- `FloorSimState` pose, queues, in-flight timers

`persistableFacilityTruth` is the JSON-round-trippable mechanical snapshot (SKU cells, ownership, capability, identity nonce + member count). Reload proof: same SKU, same cell, same `deriveMemberId(nonce, ordinal)`.

---

## 12. Read-only mechanical fields

Everything on `PresentationWorld` is a **read**. Claude must not write these fields back into the sim.

Legal writes are `GymViewAction` arms already on the reducer: `buy-session`, `floor-place`, `floor-place-furniture`, `upgrade-station`, `hire-manager`, etc.

Selection, drag, and diagnostics are renderer-local and must stay that way.

Forbidden on this object: `animation`, `sprite`, `glow`, `camera`, clip names.

---

## 13. Extension process

1. Change the sim in `src/empire/*.ts` (not FloorGrid / GymScreen / sprites).
2. Extend `presentationWorld` with the new **fact**, not the new drawing.
3. Add a deterministic test in `presentationState.test.ts`.
4. Update this document in the same commit.
5. Keep PRs draft. Do not merge. Do not touch Session A.

If Claude needs a field that would be a visual instruction, refuse and expose the underlying fact instead.

---

## API

```
presentationWorld(input) -> PresentationWorld
persistableFacilityTruth(input) -> PersistableFacilityTruth
presentationTickIntervalMs() -> 120
presentationStepProgressPerTick() -> 0.34
```

`input` is `{ sim, floor, roster, managed, capability }`.

Stations are **derived** inside `presentationWorld` via `floorStations` from that
same bundle. Callers cannot pass a station list from another world.

Queue order is `claimantsOf` in `floorSim.ts`. The contract does not re-sort.

---

## Accidental UI truth (do not treat as sim)

- FloorGrid occupancy cards
- FloorGrid `selectedStation` / `selectedMemberIndex`
- Cue bubbles
- `worldView` index-keyed members (occupancy convenience only)
- `stationView` player-facing copy (`Idle`, `Loading plates`)
- Pixel-to-tile conversion on drag

---

## Named gaps (OWNER_BLOCKED)

- Wired save/load (disk / localStorage)
- Staff world presence / staff AI
- Equipment instance UUIDs (blocked until duplicate SKUs exist)
- Lifting `FloorSimState` onto `GymViewState` (needs Claude coordination)
- Horizon throughput report as a stored field (tests already pin closed-loop numbers; the contract exposes instantaneous counts + Q/C/T levels)
- G.2C3 / G.2D / G.2E, D2 balance, dues, arrivals, random churn, persistent NPCs, Portfolio
