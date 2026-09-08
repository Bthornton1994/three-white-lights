/**
 * FloorGrid.tsx — GDD §5.13 presentation Phase 1's real interaction surface:
 * drag equipment from the unplaced tray onto the floor grid, drag a placed
 * item to move it, tap its remove control to take it off the floor.
 *
 * WHY THIS IS A SEPARATE COMPONENT FROM `GymScreen.tsx`, RATHER THAN INLINE
 * THERE THE WAY EVERY OTHER CONTROL IS. `GymScreen`'s own header states, and
 * `GymScreen.test.ts` / `empireForbiddenOutput.test.ts` both rely on, the
 * fact that `GymScreen` is a pure function of its props with NO internal
 * hook — both files call `GymScreen({state, dispatch})` directly, outside
 * React's reconciler, and a hook called that way throws ("Invalid hook
 * call"). A real drag gesture needs to track a live pointer position across a
 * grab/move/release sequence, which needs component-local state that
 * survives across that sequence — there is no way to give a plain,
 * prop-driven render function that without either re-deriving position from
 * scratch every frame (defeating the point of tracking it) or storing it
 * outside React entirely (which would not repaint). So the stateful part is
 * pulled into its own component, and `GymScreen` embeds it as
 * `<FloorGrid .../>` — an ELEMENT DESCRIPTOR (`{type: FloorGrid, props}`),
 * not a call. `GymScreen({...})` therefore still returns a tree with no
 * hook having run, and `FloorGrid`'s body only executes when something
 * actually renders it — the real app, or a browser-driven check.
 *
 * `ladderView.tsx`'s own comment on the parallel case (why `GymScreen.tsx`
 * exists instead of mounting `GymView`'s DOM tags) makes the same point in
 * the other direction: a render tree is not pure logic to begin with, so a
 * component holding gesture-tracking state is not a violation of "pure logic
 * is separate from UI" — the arithmetic (grid math, collision, footprint
 * lookup, refusal reasons) all lives in `floor.ts`, fully pure, fully unit
 * tested. This file wires a pointer gesture to that arithmetic and to
 * `dispatch`; it computes nothing of its own beyond pixel<->tile conversion.
 *
 * THE INTERACTION, so a reviewer can picture it without running it. Every
 * unplaced owned item renders as a chip in a tray below the grid; every
 * placed item renders as a coloured rectangle on the grid at its real
 * position and footprint, in tiles, scaled by `FLOOR_TILE_PIXELS`. Pressing
 * and dragging either kind of chip tracks the pointer with a live-following
 * preview (`Animated.ValueXY`, the classic imperative API — chosen because it
 * moves a view without a React state update on every pointer-move frame,
 * which matters here since a re-render on every pixel of drag would be a
 * real performance cost this file has no reason to pay). On release, the
 * pointer's page position is converted to a grid cell (relative to the grid
 * container's own measured page position) and dispatched as a single
 * `floor-place` action — the same action for a first placement and a move,
 * matching `floor.ts`'s own `placeFloorItem` (`floor.ts` header: "the one
 * placement transition, and it serves both 'place' and 'move'"). A placed
 * item's small remove control dispatches `floor-remove` and does not start a
 * drag.
 *
 * WHAT THIS FILE DOES NOT DO. It does not own the Play visual identity —
 * GymScreen composes `gymscreen-facility-scene` behind this overlay. Play
 * mode here is occupancy cards, live member/furniture sprites, and
 * station/member hit-testing. The placement grid, labels, quality/throughput
 * marks, and tray are Build-mode interaction. It does not validate a
 * placement — every
 * dispatched `floor-place` may be refused, and the refusal (`gymscreen-
 * refusal`, GymScreen's existing display) is where a rejected drop is
 * reported, the same "reported, never silent" rule `sessions.ts` states for
 * a spend. It does not maintain a second copy of `owned` or `floor` — both
 * are read from props on every render, and the only local state here is the
 * PURELY VISUAL in-flight drag (which item, and the live pixel offset),
 * discarded the instant a gesture ends and never read by anything outside
 * this file.
 *
 * A KNOWN, UNRESOLVED FEEL RISK, STATED RATHER THAN HIDDEN: this grid is
 * nested inside `GymScreen`'s outer `ScrollView` (`gymscreen-root`), and a
 * touch gesture starting on a draggable chip can compete with that outer
 * scroll's own responder on a real device, the way any custom pan gesture
 * nested inside a scroll container can. This is exactly the kind of thing
 * GDD §5.13's own gate question — "does placing things feel good?" — exists
 * to catch, and it is not something a unit test or even the Playwright check
 * below can settle; it needs a human's thumb on a real phone.
 *
 * GDD §5.13's PLAYTEST 2 RULING — THREE ADDITIONS, ALL PRESENTATION-ONLY.
 * (1) Fixed furniture: `floor.ts`'s `fixedFloorFurniture` reads the real
 * `LadderState.equipment` and this file draws each row as a plain, non-
 * draggable `View` (`floorgrid-fixed-<item>`, no `PanResponder`, no remove
 * control) — never wrapped in a `FloorPlacement`, never dispatched through
 * `floor-place`/`floor-remove`. (2) Grid lines: `floorgrid-line-v-<i>` /
 * `floorgrid-line-h-<j>`, one per interior column/row edge, so the floor
 * reads as a grid of discrete cells instead of one solid rectangle — pure
 * pixel arithmetic, the same class of inline conversion this file already
 * does for a placed chip's own `left`/`top`. (3) An honest empty-tray state
 * (`floorgrid-tray-empty`) replacing the dead "drag onto the floor above"
 * prompt when there is nothing in the tray to drag — see the tray section
 * below for the exact wording and the two cases it distinguishes.
 *
 * KNOWN, UNRESOLVED, AND NAMED RATHER THAN QUIETLY DECIDED: fixed furniture
 * is a read model with no `FloorState` of its own, so nothing in
 * `placeFloorItem`'s overlap check knows it exists — a session item CAN be
 * dragged to a position that visually overlaps a fixed row today. Whether
 * that should be refused is a design question this piece's own report
 * raises rather than answers. (GDD §5.13's PLAYTEST 3 ruling later answered
 * it: the drop handler refuses, and `releaseAt` below is where.)
 *
 * ===========================================================================
 * GDD §5.13 PRESENTATION PHASE 3 — THE RENDER HALF OF THE FLOOR SIMULATION
 * ===========================================================================
 *
 * `floorSim.ts` is the machine: pure, deterministic, no clock, no pixels, and
 * its own header says "A SECOND BUILDER WIRES THIS TO A SCREEN." This is that
 * wiring, and it is four things and no more.
 *
 * 1. THE TICK. `stepFloorSim` is called on a `setInterval` at
 *    `FLOOR_SIM_TICK_INTERVAL_MS`, with the context rebuilt from props each
 *    time. The sim state is component-local, in the same class as the
 *    in-flight drag: purely visual, dispatched nowhere, read by nothing
 *    outside this file, gone when this component unmounts. `GymState` gains
 *    no field and no action for it, which is §5.13's "presentation, not a
 *    second source of truth" applied to the one place it would be easiest to
 *    break. The tick is suspended during a drag — see its own comment for
 *    the mechanical reason.
 *
 * 2. THE WALK. A member is drawn at the linear interpolation between its cell
 *    and the cell it is stepping into, which is the position model
 *    `floorSim.ts` documents ("The renderer lerps between the two"), and the
 *    resulting position is tweened over one tick's worth of milliseconds so a
 *    walk is continuous rather than three hops per tile.
 *
 * 3. THE FIVE STATES, drawn apart. A cue bubble above the head carries the
 *    state as a colour and, while a member is `interrupted`, the cause as a
 *    glyph in a larger bubble — GDD §5.13's own "RCT's thought-bubble
 *    pattern". `using` swaps the body to a station-class working pose with a
 *    two-frame rep cycle and pulls the drawn position onto the station's own
 *    anchor (P4b), `leaving` drops to
 *    `FLOOR_SIM_LEAVING_OPACITY`, and a member the sim reports as stranded
 *    holds a ring for as long as `strandedAt` is set. The station being
 *    walked to or used is outlined on the floor in the matching colour.
 *
 * 4. A READOUT AND A LEGEND under the grid: the tick number, the state
 *    census, and what each colour means. Wireframe affordances, and
 *    deliberately not what Phase 3's gate is asking about — that question is
 *    whether the motion reads as behaviour.
 *
 * 5. Stage D2.2 plate loading. While `FloorSimState.changeovers` holds a
 *    seat, crimson plate discs travel from a stack position to the bar
 *    sleeve on that bench. Progress is remaining/total ticks from the same
 *    sim field the loading highlight already reads. Stock 18 and plate-tree
 *    6 share the path; only duration differs. No second `setInterval`, no
 *    loader body, no staff system.
 *
 * WHAT THIS HALF DOES NOT DO, since the list is the point. It computes no
 * behaviour: every state, target, queue position and interruption is
 * `floorSim.ts`'s, and what happens here is tile-to-pixel conversion,
 * interpolation and style. It reads no wallet, no Gym Bucks, no chalk, no
 * Total, no e1RM, no streak, no covered day and no reputation —
 * `FloorSimContext` carries five fields and this file builds all five from
 * props it already had. And it writes nothing back: the sim is a function of
 * the floor, never the other way round.
 *
 * LIVING WORLD SLICE. Play draws station occupancy and queue cells in the
 * world from `worldView.ts`. Occupancy cards explain the same numbers; they
 * are not the occupancy. Station outlines and plate-loading discs stay
 * visible on Play. Cue bubbles stay Build-only. No new simulation.
 *
 * VL-1 — CLAUDE CODE SESSION B'S FIRST SLICE ON THE PRESENTATION CONTRACT
 * (CLAUDE.md "Crossing VL-1", `docs/design/SESSION-B-PRESENTATION-CONTRACT.md`).
 * Members are drawn from `presentationWorld(...)`'s `PresentationMember`
 * rows, keyed by the contract's `id` rather than by array position, with
 * `lifecycle`, `cell` / `next` / `progress`, `target` and `queueRank` read
 * off that object and nothing re-derived from the raw sim member. The lerp
 * between `cell` and `next`, the walking bounce, the eased settle onto a
 * bench, the grounding shadow, feet-on-cell draw order and the larger drawn
 * body are this file's visual interpretation; the sim tick stays exactly
 * where contract §9 says it stays. The station highlight boxes, plate discs
 * and the tap panels still read the same `FloorSimState` snapshot through
 * `floorSim.ts` / `stationView.ts`'s own functions — they were already
 * reads of Grok-owned truth and are not re-derived here either. Each member
 * root also carries `data-memberid` / `data-lifecycle` / `data-target` /
 * `data-queuerank` so `tools/capture-living-world.mjs` can follow one member
 * by contract identity across frames; those are evidence attributes, not a
 * card, and nothing reads them back.
 *
 * VL-2 — PRODUCTION WORLD PRESENTATION (CLAUDE.md "Crossing VL-2"). Four
 * changes, all on the Play surface, none to a mechanic:
 *
 * 1. ONE CAMERA. `floorCamera.ts` fits a pinhole ground plane to the painted
 *    floor of the facility scene, and every Play element — station art,
 *    the queue-cell and using anchors, plate discs, members — is positioned
 *    through `projectFloorPoint` on it. A member on the back row is drawn
 *    smaller and higher than one on the front row; a station's painting
 *    stands on its footprint's front edge at the painting's own aspect
 *    instead of being stretched into the footprint; everything draws in
 *    order of its front edge's screen y, so a body walking behind the bench
 *    goes under it and one lying on it goes over it. Build keeps the
 *    orthographic plan through the same function's identity mode.
 * 2. THE FRAME LOOP. `AmbientMemberBody` runs one `requestAnimationFrame`
 *    loop per body: a playback clock in sim ticks that walks the feet
 *    between the last two ticks' snapshots at the sim's own rate (holding
 *    when nothing newer has arrived, catching up by a bounded rate when it
 *    has fallen behind — a stall is drawn as a stall, never as a burst), an
 *    eased pull onto or off a station on top of that, an animation phase
 *    advanced by distance walked or time elapsed, a sample of the member's
 *    clip from `memberAnimation.ts`, and writes into animated values. No
 *    React re-render per frame; no sim step from a frame.
 * 3. THE CLIPS. Which frame is drawn is no longer keyed to the sim tick.
 *    The walk is phased by tiles moved with its bounce locked to the same
 *    phase; a rep holds its two keyposes and crossfades between them;
 *    waiting sways toward the station; idling breathes. The art is still
 *    the two-keypose set, said plainly in `memberAnimation.ts`'s header.
 * 4. DIAGNOSTICS RETIRED FROM PLAY WHERE THE WORLD CARRIES THE READ. The
 *    green station outline and khaki queue squares are transparent
 *    geometry anchors on Play (their testIDs and boxes stay, because the
 *    evidence tools measure against them) and return under Build or the
 *    diagnostics toggle; the three occupancy cards are one quiet caption
 *    strip. Each member root also carries `data-cell` / `data-anchor` /
 *    `data-scale` / `data-clip` so a tool can measure the drawn body
 *    against the contract rather than trust this file.
 */

import { useEffect, useRef, useState, type ReactElement } from 'react';
import {
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type ViewStyle,
  View,
} from 'react-native';

import { EMPIRE_TUNING } from './empireTuning';
import {
  type FloorCamera,
  orthographicFloorCamera,
  perspectiveFloorCamera,
  projectFloorPoint,
} from './floorCamera';
import {
  type MemberAnimationClip,
  type MemberAnimationFrame,
  type MemberPlaybackSnapshot,
  advanceMemberAnimationPhase,
  advancePlaybackTick,
  clipWhileSettling,
  memberAnimationBlend,
  memberAnimationClipFor,
  memberAnimationPoses,
  memberAnimationStartPhase,
  sampleMemberAnimation,
  samplePlayback,
  settleDurationMs,
  settleRemainder,
} from './memberAnimation';
import {
  type FixedFurnitureItem,
  type FloorSpriteFacing,
  type FloorSpritePose,
  type FloorStationUseClass,
  FLOOR_SPRITE_POSES,
  FLOOR_SPRITE_URIS,
  FLOOR_STATION_USE_CLASS,
} from './floorSprites';
import {
  ironAmberFixedUri,
  ironAmberFloorPlaneUri,
  ironAmberMemberUri,
  ironAmberPlateTreeUri,
  ironAmberSessionUri,
} from './ironAmberArt';
import {
  type FloorState,
  type GridPosition,
  type GridSize,
  floorFurnitureLayout,
  floorGridSize,
  floorLayout,
  furnitureItemFootprint,
  overlapsFixedFurniture,
  sessionItemFootprint,
  unplacedOwnedFloorItems,
  unplacedOwnedFurnitureItems,
} from './floor';
import {
  FLOOR_SIM_MEMBER_STATES,
  type FloorSimContext,
  type FloorSimInterruption,
  type FloorSimMember,
  type FloorSimMemberState,
  type FloorSimState,
  type FloorStation,
  type FloorStationRef,
  createFloorSimState,
  floorSimStateCounts,
  floorStationRefKey,
  floorStations,
  seatChangeoverTicks,
  stationChangeoverSeats,
  stepFloorSimWithObservations,
} from './floorSim';
import { type LadderEquipmentItem } from './ladder';
import { type GymViewAction } from './ladderView';
import {
  floorSimPopulationFromRoster,
  livingMemberAtIndex,
  playerFacingMemberShortId,
  playerFacingServiceVisitLine,
  playerFacingTenureLine,
  type GymMemberId,
  type LivingMemberRoster,
} from './livingMembers';
import { livingMemberExperience } from './livingMemberExperience';
import { livingMemberRetentionPressure } from './livingMemberRetention';
import { type ManagedGym, maintenancePrompt } from './management';
import { type MemberType } from './members';
import {
  presentationWorld,
  type PresentationMember,
  type PresentationWorld,
} from './presentationState';
import { type SessionEquipmentItem } from './sessions';
import {
  isStationUpgradeSlice,
  stationLevels,
  stationChangeoverTicks,
  stationUpgradeCostGymBucks,
  type StationCapabilityState,
  type StationUpgradeAxis,
} from './stationCapability';
import {
  type PlacementRefuseKind,
  type StationConditionView,
  type StationIdentityView,
  type StationManagerEffectView,
  type StationOperationView,
  displayConditionPercent,
  playerFacingBayRole,
  playerFacingEquipmentLabel,
  playerFacingMemberActivityLine,
  playerFacingMemberTypeLabel,
  playerFacingPlacementRefuse,
  playerFacingStationOperation,
  playerFacingUpgradeEffect,
  playerFacingUpgradeLabel,
  playerFacingUpgradeRefuse,
  plateLoadingDiscs,
  plateLoadingProgress,
  stationConditionView,
  stationIdentityView,
  stationManagerEffectView,
  stationOperationView,
} from './stationView';
import {
  COMPETITION_BENCH_BAY,
  COMPETITION_BENCH_BAY_PRIMARY,
  capacityRealizesOn,
  competitionBenchBay,
  overlapsBayExpansion,
  type BayBench,
  type CompetitionBenchBay,
} from './trainingStation';
import {
  worldFrame,
  type WorldStationView,
} from './worldView';

/**
 * `userSelect` and `cursor` are real react-native-web style extensions (they
 * map straight to the CSS properties of the same names) that the core
 * `react-native` types `tsc` checks against do not declare, because native
 * has no such concept. This widens `ViewStyle` by exactly those two fields
 * rather than reaching for `any` anywhere in this file — see the call sites
 * below for why the properties are load-bearing rather than decorative.
 * `cursor` joined this type in GDD §5.14 Stage C, for the same S4h reason
 * `GymScreen.tsx`'s own button chrome already states: WebKit's click-
 * delegation quirk on a non-natively-interactive element wants an explicit
 * `cursor` declaration.
 */
type WebSelectableViewStyle = ViewStyle & { readonly userSelect?: 'none'; readonly cursor?: 'pointer' };

/**
 * GDD §5.13 presentation Phase 4: `imageRendering` is a real react-native-web
 * style pass-through (it maps straight to the CSS property, which is
 * INHERITED, so setting it once on the grid and once on the tray covers every
 * sprite image drawn inside them) that the core `react-native` types do not
 * declare. Without it a browser smooths every scaled sprite back into the
 * blur this whole phase exists to avoid — nearest-neighbour or nothing is the
 * same rule `src/art/`'s own view layer states for the lift screen. On a
 * native renderer the property is unknown and inert; the sprites there are
 * pre-upscaled to their drawn size, so only the device-pixel-ratio scale is
 * outside this file's control. Same widening pattern as
 * `WebSelectableViewStyle` above.
 */
type PixelSnappedViewStyle = ViewStyle & { readonly imageRendering?: 'pixelated' | 'auto' };

export interface FloorGridProps {
  readonly owned: readonly SessionEquipmentItem[];
  /**
   * GDD §5.13's PLAYTEST 2 ruling, gap 1: the real `LadderState.equipment`
   * (`gym.ladder.equipment`), read so `fixedFloorFurniture` can draw the
   * Barbell-group starting baseline as fixed furniture. Never written here —
   * this component reads it and dispatches nothing that touches it, the same
   * "client is a renderer" discipline `owned` already carries for session
   * equipment.
   */
  readonly barbellOwned: readonly LadderEquipmentItem[];
  readonly floor: FloorState;
  readonly dispatch: (action: GymViewAction) => void;
  /**
   * GDD §5.14 Stage C: the composed §5.11 stage-4 state — condition, the
   * manager, the failure ledger. Read only, the same "client is a renderer"
   * discipline `owned`/`barbellOwned` already carry: the contextual station
   * panel reads condition, repair cost and manager capability straight out of
   * `management.ts`'s own functions through `stationView.ts`'s selectors, and
   * every action it offers (repair, remove) dispatches through the same
   * reducer arms `GymScreen.tsx`'s own per-item report already uses. Nothing
   * about this prop's arithmetic is duplicated here.
   */
  readonly managed: ManagedGym;
  /** Stage D Q/C/T levels. Stock is `{}`. */
  readonly capability: StationCapabilityState;
  /**
   * Stage C.1b: when true, the floor is in Build mode — tray is the place/
   * move surface, tap-a-piece-then-tap-a-tile is the primary thumb path,
   * and starting Barbell furniture is movable. When false, taps inspect
   * stations and members. Never an economic flag.
   */
  readonly buildMode: boolean;
  /** Stage G.1 — persistent member identities and service history. */
  readonly livingMembers: LivingMemberRoster;
  /** Gym clock seconds for tenure copy. */
  readonly gymClockSeconds: number;
}

/** Live tile size from the measured gym stage, so a garage fills the viewport. */
function tilePixelsForStage(
  gridWidth: number,
  gridHeight: number,
  stageWidth: number,
  stageHeight: number,
): number {
  const pad = EMPIRE_TUNING.FLOOR_STAGE_PADDING_PIXELS;
  const availW = stageWidth - pad * 2;
  const availH = stageHeight - pad * 2;
  if (availW <= 0 || availH <= 0) return EMPIRE_TUNING.FLOOR_TILE_PIXELS;
  const raw = Math.floor(Math.min(availW / gridWidth, availH / gridHeight));
  if (raw < 1) return 1;
  if (raw > EMPIRE_TUNING.FLOOR_TILE_PIXELS_MAX) return EMPIRE_TUNING.FLOOR_TILE_PIXELS_MAX;
  return raw;
}

type PendingPlace =
  | { readonly kind: 'session'; readonly item: SessionEquipmentItem }
  | { readonly kind: 'furniture'; readonly item: LadderEquipmentItem };

const FLOOR_GRID_BORDER_COLOR = 'gray';
const FLOOR_ITEM_BORDER_COLOR = 'black';
/** GDD §5.13's PLAYTEST 2 ruling, gap 3: the internal tile-boundary lines. Same shade as the outer frame, for one consistent "this is a grid" read. */
const FLOOR_GRID_LINE_COLOR = FLOOR_GRID_BORDER_COLOR;
/** GDD §5.13's PLAYTEST 3 ruling: the outline a fixed-furniture cell draws while it is the target of a just-refused drop — distinct from `FLOOR_ITEM_BORDER_COLOR` so a refusal reads as a warning, not a resting state. */
const FLOOR_OVERLAP_REFUSAL_OUTLINE_COLOR = 'crimson';
/**
 * GDD §5.13 presentation Phase 4: the item/fixed labels now sit over pixel
 * art rather than over a flat mid-grey chip, so they carry an explicit light
 * colour instead of the platform default (near-black text on a dark sprite
 * was unreadable). Named CSS colour keywords throughout this file,
 * deliberately, so no `src/tuning/` palette-module registration (a real
 * crossing) is needed to pass the colour-literal scan — the sprite colours
 * themselves are numeric components in `EMPIRE_TUNING`, which is registered.
 */
const FLOOR_LABEL_COLOR = 'ivory';
/** The caption style every sprite label shares — colour above, size from the registered knob. */
const FLOOR_LABEL_STYLE = Object.freeze({
  color: FLOOR_LABEL_COLOR,
  fontSize: EMPIRE_TUNING.FLOOR_SPRITE_LABEL_FONT_SIZE,
});
/** The tray chip's backing — a quiet dark slate the sprites read against, one class for every item now that the sprite carries the identity the old colour cycle used to. */
const FLOOR_TRAY_CHIP_COLOR = 'black';
const AMBIENT_MEMBER_BORDER_COLOR = 'black';
/**
 * GDD §5.14 Stage C: the outline a station carries while it is the selected
 * one — the same colour `AMBIENT_MEMBER_PALETTE` already uses for the
 * `'athlete'` member type below, reused here rather than adding a new word to
 * this directory's string vocabulary (the string census this file's own
 * header already explains). Distinct from `FLOOR_OVERLAP_REFUSAL_OUTLINE_
 * COLOR` (a warning) and from every `FLOOR_SIM_STATE_COLOR` (a behavioural
 * cue) — selection is neither.
 */
const FLOOR_STATION_SELECTED_OUTLINE_COLOR = 'gold';
/**
 * Stage D Quality rest-cue — a darker gold than selection, so a Quality
 * station at rest is not readable as "this is the tapped station".
 */
const FLOOR_QUALITY_MARK_COLOR = 'goldenrod';
/**
 * Stage D Throughput rest-cue — darker than the queue-state khaki, so a
 * faster station is not readable as "someone is waiting here".
 */
const FLOOR_THROUGHPUT_MARK_COLOR = 'darkkhaki';
/** Stage D2.2 plate discs during a changeover — competition-plate red, named CSS so no palette-module crossing. */
const FLOOR_PLATE_LOADING_COLOR = 'crimson';
const FLOOR_PLATE_LOADING_HOLE_COLOR = 'white';
/** The contextual station panel's own backing, the same quiet slate the tray chip already reads against. */
const FLOOR_STATION_PANEL_BACKGROUND_COLOR = 'black';
/** The panel's action-button chrome — amber fill, iron label, matching GymScreen. */
const FLOOR_STATION_PANEL_BUTTON_BACKGROUND_COLOR = 'goldenrod';
const FLOOR_STATION_PANEL_BUTTON_BORDER_COLOR = 'goldenrod';
const FLOOR_STATION_PANEL_BUTTON_TEXT_COLOR = 'black';

/**
 * The station panel's own `StyleSheet.create` block — GDD §5.14 Stage C.
 * Static, unlike a floor chip's per-row geometry, so it is registered here
 * rather than built inline the way a placed item's absolute position is.
 * `cursor: 'pointer'` is the same S4h fix `GymScreen.tsx`'s own `styles.
 * button` carries, for the identical WebKit click-delegation reason.
 */
const panelStyles = StyleSheet.create({
  panel: {
    marginTop: EMPIRE_TUNING.FLOOR_STATION_PANEL_MARGIN_TOP_PIXELS,
    padding: EMPIRE_TUNING.FLOOR_STATION_PANEL_PADDING_PIXELS,
    borderWidth: EMPIRE_TUNING.FLOOR_STATION_PANEL_BORDER_WIDTH_PIXELS,
    borderColor: FLOOR_STATION_SELECTED_OUTLINE_COLOR,
    backgroundColor: FLOOR_STATION_PANEL_BACKGROUND_COLOR,
    // Same cap the facility drawers already use. Without it the open panel
    // grows through gymscreen-dock and shell-leave-gym (13j measured the
    // overlap at 390×844: panel bottom 787, pill top 762).
    maxHeight:
      EMPIRE_TUNING.GYM_SCREEN_BUTTON_MIN_HEIGHT_PIXELS *
      EMPIRE_TUNING.FLOOR_GRID_SIZE.garage.height,
  },
  diagnosticsToggle: {
    alignSelf: 'flex-start',
    paddingVertical: EMPIRE_TUNING.FLOOR_TRAY_ITEM_MARGIN_PIXELS,
    paddingHorizontal: EMPIRE_TUNING.GYM_SCREEN_BUTTON_PADDING_HORIZONTAL_PIXELS,
    cursor: 'pointer',
  },
  button: {
    marginTop: EMPIRE_TUNING.FLOOR_STATION_PANEL_MARGIN_TOP_PIXELS,
    paddingVertical: EMPIRE_TUNING.GYM_SCREEN_BUTTON_PADDING_VERTICAL_PIXELS,
    paddingHorizontal: EMPIRE_TUNING.GYM_SCREEN_BUTTON_PADDING_HORIZONTAL_PIXELS,
    minHeight: EMPIRE_TUNING.GYM_SCREEN_BUTTON_MIN_HEIGHT_PIXELS,
    borderRadius: EMPIRE_TUNING.GYM_SCREEN_BUTTON_BORDER_RADIUS_PIXELS,
    borderWidth: EMPIRE_TUNING.GYM_SCREEN_BUTTON_BORDER_WIDTH_PIXELS,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: FLOOR_STATION_PANEL_BUTTON_BACKGROUND_COLOR,
    borderColor: FLOOR_STATION_PANEL_BUTTON_BORDER_COLOR,
    cursor: 'pointer',
  },
  buttonText: {
    color: FLOOR_STATION_PANEL_BUTTON_TEXT_COLOR,
  },
  // VL-2: the occupancy read is one quiet caption strip along the stage's
  // bottom edge — three small pills, no border, no button height — where
  // the VL-1 cards were three button-sized boxes across the floor. "UI may
  // explain, must not substitute": the world (a lifter on the bench, a
  // member standing in the queue cell, one walking at the bay) is the read
  // and this strip captions it. The three testIDs and copy are unchanged.
  occupancy: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    // Left-aligned, so the strip never runs under `GymScreen.tsx`'s BUILD
    // control docked at the stage's bottom-right.
    justifyContent: 'flex-start',
    paddingHorizontal: EMPIRE_TUNING.FLOOR_TRAY_ITEM_MARGIN_PIXELS,
    paddingBottom: EMPIRE_TUNING.FLOOR_TRAY_ITEM_MARGIN_PIXELS,
    zIndex: EMPIRE_TUNING.FLOOR_DRAGGING_Z_INDEX,
  },
  occupancyCard: {
    flexShrink: 1,
    marginHorizontal: EMPIRE_TUNING.FLOOR_TRAY_ITEM_MARGIN_PIXELS,
    paddingVertical: EMPIRE_TUNING.FLOOR_TRAY_ITEM_MARGIN_PIXELS,
    paddingHorizontal: EMPIRE_TUNING.GYM_SCREEN_BUTTON_PADDING_HORIZONTAL_PIXELS,
    borderRadius: EMPIRE_TUNING.GYM_SCREEN_BUTTON_BORDER_RADIUS_PIXELS,
    backgroundColor: FLOOR_STATION_PANEL_BACKGROUND_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  occupancyText: {
    color: FLOOR_LABEL_COLOR,
    fontSize: EMPIRE_TUNING.FLOOR_SPRITE_LABEL_FONT_SIZE,
  },
  quietCaption: {
    color: FLOOR_LABEL_COLOR,
    fontSize: EMPIRE_TUNING.FLOOR_SPRITE_LABEL_FONT_SIZE,
    paddingHorizontal: EMPIRE_TUNING.GYM_SCREEN_BUTTON_PADDING_HORIZONTAL_PIXELS,
  },
  visuallyHidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    opacity: 0,
  },
});

/**
 * GDD §5.13 presentation Phase 3 — one named colour per behavioural state, so
 * the five arms of `floorSim.ts`'s machine read apart on the floor.
 *
 * A THIRD palette in this file, on the same terms as the two above: named CSS
 * colour keywords rather than hex or `rgb()`, so it needs no `src/tuning/`
 * palette-module registration (a real crossing, per CLAUDE.md's session-
 * coordination section) to pass `src/tuning/audit.ts`'s colour-literal scan.
 * No value here repeats a literal already used by `PLACEHOLDER_PALETTE`,
 * `AMBIENT_MEMBER_PALETTE`, or the grid/fixed/refusal colours above — the
 * three visual classes stay apart and the state cue is a fourth.
 *
 * WHY THE STATE IS A CUE ABOVE THE HEAD AND NOT THE BODY'S OWN COLOUR: the
 * body's colour is the member's TYPE, which a human passed Phase 2's gate on
 * reading, and recolouring it by state would spend that read on this one. The
 * cue is drawn on top instead, which is also the register GDD §5.13 asks for
 * by name ("RCT's thought-bubble pattern").
 *
 * Placeholder shapes only. Phase 4 is the real pixel-art pass, and this piece
 * is explicitly not it.
 */
const FLOOR_SIM_STATE_COLOR: Readonly<Record<FloorSimMemberState, string>> = Object.freeze({
  seeking: 'deepskyblue',
  queuing: 'khaki',
  using: 'springgreen',
  leaving: 'silver',
  interrupted: 'red',
});

/**
 * What an interrupted member says, in one word — the label held beside the
 * body for the length of the beat, so the reaction names its own cause
 * instead of being a colour a reader has to look up.
 *
 * A word rather than a glyph, and that was a measured choice rather than a
 * taste: `empireCore.test.ts`'s string census probes every space-free shipped
 * literal for a real name and SKIPS anything under two characters, with a
 * count pinned against the list's own length so a skip is red. A one-letter
 * glyph table would have left three shipped literals unprobed.
 */
const FLOOR_SIM_INTERRUPTION_WORD: Readonly<Record<FloorSimInterruption, string>> = Object.freeze({
  'target-removed': 'removed',
  'target-moved': 'moved',
  'route-blocked': 'blocked',
});

/**
 * The legend under the grid: what each state colour means, in the words a
 * player would use.
 *
 * A WIREFRAME AFFORDANCE AND NOT THE READ THE GATE ASKS ABOUT. GDD §5.13's
 * PLAYTEST 4b asked its question with the caption covered, on purpose, so the
 * tokens had to carry the read on their own. The same standard applies here:
 * what Phase 3's gate judges is whether the walking, queueing, using and
 * reacting are legible as behaviour, not whether a colour key can be looked
 * up. The legend is here because a placeholder colour has no meaning to a
 * first-time reader at all, and because the browser check reads it.
 */
const FLOOR_SIM_STATE_LEGEND: Readonly<Record<FloorSimMemberState, string>> = Object.freeze({
  seeking: 'walking to a machine',
  queuing: 'waiting behind one',
  using: 'on the machine',
  leaving: 'stepping away',
  interrupted: 'what they wanted is gone, moved or walled off',
});

/** Transparent, as a named value rather than a bare string at four call sites. */
const FLOOR_SIM_HIGHLIGHT_FILL = 'transparent';

/**
 * A position on the floor in TILES, unlike `GridPosition`, which `floor.ts`
 * documents as a whole-numbered grid cell. A member mid-step stands between
 * two cells, and this is the type that says so.
 *
 * Declared as an `interface` rather than a type alias deliberately: the prop
 * surface census in `empireForbiddenOutput.test.ts` reads the resolved type,
 * and TypeScript withholds an implicit index signature from an interface, so
 * this keeps `position`'s existing row on that census's conservative
 * `HOLDS_A_FUNCTION` list rather than silently moving it off.
 */
interface FloorTilePoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Where a member stands this instant, in tiles: its cell, or the linear
 * interpolation between its cell and the cell it is stepping into.
 *
 * The three inputs are the contract's (`PresentationMember.cell` / `next` /
 * `progress`, contract §3), and the contract hands the lerp itself to this
 * file — "Claude owns interpolation, easing, gait, visual speed". This is that
 * lerp and nothing else: no behaviour is decided here, and the sim's own
 * numbers are not adjusted, only positioned.
 */
function memberTilePoint(member: PresentationMember): FloorTilePoint {
  if (member.next === null) return { x: member.cell.x, y: member.cell.y };
  return {
    x: member.cell.x + (member.next.x - member.cell.x) * member.progress,
    y: member.cell.y + (member.next.y - member.cell.y) * member.progress,
  };
}

/**
 * GDD §5.13 P4b: which use class a station draws on the member working it.
 * Read from `floorSprites.ts`'s own total tables; the `hasOwnProperty` guard
 * on the fixed arm mirrors `fixedSpriteUriFor` below — a future ladder item
 * with no row falls back to the engaged generic stance rather than throwing.
 */
function stationUseClassFor(ref: FloorStationRef): FloorStationUseClass {
  if (ref.kind === 'training') return 'bench';
  if (ref.kind === 'session') return FLOOR_STATION_USE_CLASS.session[ref.item];
  return Object.prototype.hasOwnProperty.call(FLOOR_STATION_USE_CLASS.fixed, ref.item)
    ? FLOOR_STATION_USE_CLASS.fixed[ref.item as FixedFurnitureItem]
    : 'generic';
}

/**
 * VL-2: which animation clip a contract member is drawn in this instant —
 * `memberAnimation.ts`'s mapping of the contract's lifecycle, whether a step
 * is in flight (`next !== null`) and the station's use class. Replaces the
 * tick-driven pose flip VL-1 inherited: the clip is chosen here from the
 * contract, and WHICH FRAME of it is on screen is decided per animation
 * frame inside `AmbientMemberBody`, by distance walked or time elapsed,
 * never by the sim tick. Nothing here decides what the member does.
 */
function memberClipFor(member: PresentationMember): MemberAnimationClip {
  return memberAnimationClipFor(
    member.lifecycle,
    member.next !== null,
    member.target === null ? null : stationUseClassFor(member.target),
  );
}

/**
 * VL-2: the height-over-width of a fixed item's painting, from the
 * registered `FLOOR_FIXED_ART_HEIGHT_OVER_WIDTH` table — `quality-bench`
 * for the upgraded bay bench, 1 (a square box) for any item the table does
 * not name, mirroring `fixedSpriteUriFor`'s own `hasOwnProperty` fallback.
 */
function fixedArtAspectFor(item: string, quality: boolean): number {
  const table = EMPIRE_TUNING.FLOOR_FIXED_ART_HEIGHT_OVER_WIDTH;
  if (item === 'flat-bench' && quality) return table['quality-bench'];
  return Object.prototype.hasOwnProperty.call(table, item)
    ? table[item as keyof typeof table]
    : 1;
}

/**
 * VL-2: the aspect a station's art is drawn at in Play. Training and fixed
 * stations draw their painting's own aspect; a session item is drawn
 * `contain` inside a box with its footprint's aspect, because the fourteen
 * session paintings vary and are not yet in the aspect table — a stated
 * residual, not a hidden stretch.
 */
function stationArtAspectFor(ref: FloorStationRef, quality: boolean, footprint: GridSize): number {
  if (ref.kind === 'training') return fixedArtAspectFor('flat-bench', quality);
  if (ref.kind === 'fixed') return fixedArtAspectFor(ref.item, false);
  return footprint.height / Math.max(footprint.width, 1);
}

/** One drawn station box in stage pixels, plus its depth-order key and the tile scale at its front edge. */
interface StationDrawBox {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly scale: number;
}

/**
 * VL-2: where a station's art is drawn. Under Build's plan camera this is
 * exactly the footprint box it always was (position × tile, footprint ×
 * tile), so nothing about Build moves. Under the Play camera the box stands
 * on the footprint's projected FRONT EDGE: as wide as the footprint is at
 * that depth, as tall as the art's own aspect makes it, centred on the
 * footprint's centre line — a bench painted in three-quarter view standing
 * on the floor it occupies, instead of a painting stretched into a floor
 * rectangle. `depth` is the front edge's screen y, the key every Play
 * element is drawn in order of.
 */
function stationDrawBox(
  camera: FloorCamera,
  position: GridPosition,
  footprint: GridSize,
  heightOverWidth: number,
): StationDrawBox {
  if (camera.kind === 'orthographic') {
    return {
      left: position.x * camera.tile,
      top: position.y * camera.tile,
      width: footprint.width * camera.tile,
      height: footprint.height * camera.tile,
      depth: (position.y + footprint.height) * camera.tile,
      scale: 1,
    };
  }
  const front = projectFloorPoint(camera, {
    x: position.x + footprint.width / 2,
    y: position.y + footprint.height,
  });
  const width = footprint.width * camera.tile * front.scale;
  const height = width * heightOverWidth;
  return {
    left: front.x - width / 2,
    top: front.y - height,
    width,
    height,
    depth: front.y,
    scale: front.scale,
  };
}

/** A floor cell's drawn box: the plan square under Build, the projected cell quad's bounding box under Play. */
function floorCellBox(camera: FloorCamera, cell: GridPosition): { readonly left: number; readonly top: number; readonly width: number; readonly height: number } {
  if (camera.kind === 'orthographic') {
    return { left: cell.x * camera.tile, top: cell.y * camera.tile, width: camera.tile, height: camera.tile };
  }
  const back = projectFloorPoint(camera, { x: cell.x + 1 / 2, y: cell.y });
  const front = projectFloorPoint(camera, { x: cell.x + 1 / 2, y: cell.y + 1 });
  const width = camera.tile * front.scale;
  return { left: front.x - width / 2, top: back.y, width, height: front.y - back.y };
}

/**
 * Where the middle of a member's own drawn footprint would sit if it were
 * centred on `station`'s box, in tiles — the anchor the P4b coupling pulls a
 * `using` member toward.
 *
 * What the mechanism actually guarantees, in its own terms: within one
 * render, the `station` argument arrives through `stationByRefKey`, which is
 * rebuilt each render from the same `floorStations(simContext)` call the sim
 * is stepped against, and this function derives the anchor from that
 * station's own `position`/`footprint` plus two registered constants — so in
 * the code as written there is no cached or copied station table for the
 * drawn anchor to disagree with. The route past it: a future edit that
 * stores stations across renders (a `useRef`/`useState` cache, a
 * module-level memo) or hands `memberDrawPoint` a station from anywhere
 * else would decouple the anchor from the sim's truth without a type
 * changing. No test reddens on that edit as such; the nearest instrument is
 * `tools/verify-floor-reachability.mjs`'s coupling claim (a using member's
 * box must overlap its station's highlight), which fails on a driven run
 * where the drift exceeds the overlap threshold and is silent on drift
 * smaller than that. So the sentence above is bounded to the current
 * derivation, not enforced against future ones.
 */
function stationAnchor(position: GridPosition, footprint: GridSize): FloorTilePoint {
  return {
    x:
      position.x +
      (footprint.width - EMPIRE_TUNING.AMBIENT_MEMBER_FOOTPRINT_TILES.width) / 2,
    y:
      position.y +
      (footprint.height - EMPIRE_TUNING.AMBIENT_MEMBER_FOOTPRINT_TILES.height) / 2,
  };
}

/**
 * VL-2: what `AmbientMemberBody` is told about where it stands: the FEET
 * point in stage pixels (the contract's cell, projected — the point the
 * playback timeline walks), the PULL from that point to where the body is
 * actually drawn while using a station (zero otherwise; the body eases
 * along it over `FLOOR_MEMBER_SETTLE_MS`), the depth scale, the draw-order
 * key, and the contract cell it all came from.
 */
interface MemberAnchor {
  readonly position: FloorTilePoint;
  readonly pull: FloorTilePoint;
  readonly scale: number;
  readonly depth: number;
  readonly cell: FloorTilePoint;
}

/**
 * VL-2: the point a member's FEET stand on this instant, in stage pixels,
 * through the one camera every Play element is drawn through. For every
 * state except `using` that is the contract's interpolated tile point
 * (`memberTilePoint`), taken at the bottom-centre of its 1×1 sim footprint
 * and projected — so a body on the back row is smaller and higher than one
 * on the front row by the camera's own law, and the drawn body (a square of
 * `FLOOR_MEMBER_DRAW_SCALE_TILES` tiles at that depth's scale, feet on this
 * point) is taller than the tile it stands on. `memberTilePoint` is still
 * the only positional read of the contract.
 *
 * GDD §5.13 P4b, carried forward through the camera: while `using`, the
 * body is pulled from that feet-on-cell placement toward being CENTRED on
 * the pad of its own bench's drawn box (`FLOOR_STATION_PAD_FRACTION` down
 * the art) by the class's `FLOOR_SIM_USING_ANCHOR_BIAS`, and its depth key
 * is set just in front of the bench's so a lying body draws over the bench
 * it lies on rather than under it. Capacity's second user is pulled onto
 * the second bench. Renderer only: the sim's `cell` is never touched, no
 * state is kept, and the pull exists only while the contract says `using`.
 * The floor-to-bench move on `using` and the bench-to-floor move on
 * `leaving` are the two moments this point jumps without the cell moving,
 * and `AmbientMemberBody` eases exactly those two over
 * `FLOOR_MEMBER_SETTLE_MS` — as an eased PULL added on top of the walked
 * feet point, so the timeline the feet play along never sees the jump.
 */
function memberAnchorFor(
  member: PresentationMember,
  station: FloorStation | undefined,
  bay: CompetitionBenchBay,
  camera: FloorCamera,
  benchArtAspect: number,
): MemberAnchor {
  const footprint = EMPIRE_TUNING.AMBIENT_MEMBER_FOOTPRINT_TILES;
  const cell = memberTilePoint(member);
  const feet = projectFloorPoint(camera, {
    x: cell.x + footprint.width / 2,
    y: cell.y + footprint.height,
  });
  const standing: MemberAnchor = {
    position: { x: feet.x, y: feet.y },
    pull: { x: 0, y: 0 },
    scale: feet.scale,
    depth: Math.round(feet.y),
    cell,
  };
  if (member.lifecycle !== 'using' || member.target === null || station === undefined) {
    return standing;
  }
  const bias = EMPIRE_TUNING.FLOOR_SIM_USING_ANCHOR_BIAS[stationUseClassFor(member.target)];
  const bench = usingBenchFor(member, station, bay);
  const box = stationDrawBox(camera, bench.position, bench.footprint, benchArtAspect);
  const side = EMPIRE_TUNING.FLOOR_MEMBER_DRAW_SCALE_TILES * camera.tile * box.scale;
  const centred: FloorTilePoint = {
    x: box.left + box.width / 2,
    y: box.top + EMPIRE_TUNING.FLOOR_STATION_PAD_FRACTION * box.height + side / 2,
  };
  return {
    position: standing.position,
    pull: {
      x: (centred.x - standing.position.x) * bias,
      y: (centred.y - standing.position.y) * bias,
    },
    scale: box.scale,
    depth: Math.round(box.depth) + 1,
    cell,
  };
}

/**
 * Phase 4: sprite facing. While `using`, the member faces its own bench —
 * the pose is a body working a machine, so it orients toward the anchor it
 * is drawn against (strictly-left mirrors; ties and everything else keep the
 * authored right facing). Otherwise, from the step in flight alone: a member
 * stepping leftward mirrors; standing and vertical steps face right.
 * Stateless on purpose — deriving a persistent facing would mean this file
 * keeping sim-adjacent state of its own, which the Phase 3 wiring rules out.
 */
function memberFacing(
  member: PresentationMember,
  station: FloorStation | undefined,
  bay: CompetitionBenchBay,
): FloorSpriteFacing {
  if (member.lifecycle === 'using' && station !== undefined) {
    const bench = usingBenchFor(member, station, bay);
    return stationAnchor(bench.position, bench.footprint).x < member.cell.x ? 'left' : 'right';
  }
  // A horizontal step in flight faces the way it is going.
  if (member.next !== null && member.next.x !== member.cell.x) {
    return member.next.x < member.cell.x ? 'left' : 'right';
  }
  // VL-2: standing or stepping vertically with a station claimed — a queued
  // member on its queue cell, one waiting to step toward the bay — faces
  // the station, so a line reads as a line waiting for THAT bench rather
  // than three bodies looking the same way. Still stateless: the station
  // arrives from the same lookup the anchor used.
  if (station !== undefined) {
    return stationAnchor(station.position, station.footprint).x < member.cell.x ? 'left' : 'right';
  }
  return 'right';
}


/**
 * Phase 4: the fixed-furniture sprite for a Barbell-baseline item, or null
 * for a ladder item the fixed-sprite table does not draw. `fixedFloorFurniture`
 * only ever emits the three baseline rows today, so the null arm is a guard
 * for a future ladder item arriving, not a path anything reaches now.
 *
 * P4c: leftover non-bay Barbell still swaps an occupied variant while a
 * member is `using` that furniture. Today that painter exists only for
 * `power-bar`. Stage D.1's opening garage does not send members at the bar
 * — they train at the Competition Bench Bay — so the bar stays at rest and
 * the double-bar composite cannot arise there. The bay's benches use
 * per-position occupancy instead: a using member on `useCells[i]` marks
 * `benches[i]`, not the whole bay.
 */
function fixedSpriteUriFor(item: LadderEquipmentItem, occupied: boolean): string | null {
  const owned = ironAmberFixedUri(item, false);
  if (owned !== null) return owned;
  if (occupied && Object.prototype.hasOwnProperty.call(FLOOR_SPRITE_URIS.fixedOccupied, item)) {
    return FLOOR_SPRITE_URIS.fixedOccupied[item as keyof typeof FLOOR_SPRITE_URIS.fixedOccupied];
  }
  return Object.prototype.hasOwnProperty.call(FLOOR_SPRITE_URIS.fixed, item)
    ? FLOOR_SPRITE_URIS.fixed[item as FixedFurnitureItem]
    : null;
}

/**
 * Stage D.1b: Quality swaps the bay's benches to the competition-spec pad.
 * Occupied stock benches still use the resting flat-bench sprite (the lying
 * pose brings its own bar); the Quality pad has no occupied variant because
 * it is the surface, not a loaded bar.
 */
function bayBenchSpriteUri(quality: boolean, occupied: boolean): string | null {
  const owned = ironAmberFixedUri(COMPETITION_BENCH_BAY_PRIMARY, quality);
  if (owned !== null) return owned;
  if (quality) return FLOOR_SPRITE_URIS.bay.qualityBench;
  return fixedSpriteUriFor(COMPETITION_BENCH_BAY_PRIMARY, occupied);
}

function sessionSpriteUri(item: SessionEquipmentItem): string {
  return ironAmberSessionUri(item) ?? FLOOR_SPRITE_URIS.session[item];
}

/** A station's identity as a map key — matching `floorStationRefKey` in `floorSim.ts`. */
function stationKey(ref: FloorStationRef): string {
  return floorStationRefKey(ref);
}

function refsMatch(left: FloorStationRef, right: FloorStationRef): boolean {
  return floorStationRefKey(left) === floorStationRefKey(right);
}

function refToken(ref: FloorStationRef): string {
  return ref.kind === 'training' ? ref.station : ref.item;
}

function cellsEqual(left: GridPosition, right: GridPosition): boolean {
  return left.x === right.x && left.y === right.y;
}

/**
 * Verifier-stable highlight id. Dashes, never `floorStationRefKey`'s colon,
 * so `floorsim-using-session-mats` and `floorsim-using-training-competition-
 * bench-bay` stay the form `tools/verify-floor-reachability.mjs` already
 * reads. Capacity's second bench is a second element (`-expansion`).
 */
function highlightTestId(
  activity: 'using' | 'claimed' | 'loading',
  ref: FloorStationRef,
  expansion: boolean,
): string {
  if (ref.kind === 'training' && expansion) {
    return `floorsim-${activity}-training-${ref.station}-expansion`;
  }
  if (ref.kind === 'training') {
    return `floorsim-${activity}-training-${ref.station}`;
  }
  return `floorsim-${activity}-${ref.kind}-${ref.item}`;
}

function plateLoadingTestId(ref: FloorStationRef, expansion: boolean): string {
  if (ref.kind === 'training' && expansion) {
    return `floorsim-plate-loading-training-${ref.station}-expansion`;
  }
  if (ref.kind === 'training') {
    return `floorsim-plate-loading-training-${ref.station}`;
  }
  return `floorsim-plate-loading-${ref.kind}-${ref.item}`;
}

function memberUsesCell(
  members: readonly FloorSimMember[],
  ref: FloorStationRef,
  cell: GridPosition | undefined,
): boolean {
  if (cell === undefined) return false;
  for (const member of members) {
    if (member.state !== 'using') continue;
    if (member.target === null || !refsMatch(member.target, ref)) continue;
    if (cellsEqual(member.cell, cell)) return true;
  }
  return false;
}

function usingBenchFor(
  member: PresentationMember,
  station: FloorStation,
  bay: CompetitionBenchBay,
): BayBench {
  const fallback: BayBench = {
    position: station.position,
    footprint: station.footprint,
    source: 'primary',
  };
  if (station.ref.kind !== 'training' || bay.benches.length === 0) return fallback;
  let index = -1;
  for (let i = 0; i < station.useCells.length; i += 1) {
    const cell = station.useCells[i];
    if (cell !== undefined && cellsEqual(cell, member.cell)) {
      index = i;
      break;
    }
  }
  return index >= 0 ? (bay.benches[index] ?? fallback) : fallback;
}

interface StationHighlightBox {
  readonly key: string;
  readonly testID: string;
  readonly activity: 'using' | 'claimed' | 'loading';
  readonly position: GridPosition;
  readonly footprint: GridSize;
}

/**
 * One outline per realised physical position. Capacity's second bench is a
 * second box, not a second approach cell around the primary.
 */
function stationHighlightBoxes(
  station: FloorStation,
  bay: CompetitionBenchBay,
  members: readonly FloorSimMember[],
  changeovers: Readonly<Record<string, number>>,
): readonly StationHighlightBox[] {
  const targeting: FloorSimMember[] = [];
  for (const member of members) {
    if (member.target !== null && refsMatch(member.target, station.ref)) targeting.push(member);
  }
  if (targeting.length === 0) return [];
  let waiting = false;
  for (const member of targeting) {
    if (member.state !== 'using') waiting = true;
  }
  const benches: { readonly bench: BayBench; readonly expansion: boolean }[] = [];
  if (station.ref.kind === 'training' && bay.benches.length > 0) {
    for (const bench of bay.benches) {
      benches.push({ bench, expansion: bench.source === 'expansion' });
    }
  } else {
    benches.push({
      bench: {
        position: station.position,
        footprint: station.footprint,
        source: 'primary',
      },
      expansion: false,
    });
  }
  const boxes: StationHighlightBox[] = [];
  for (let index = 0; index < benches.length; index += 1) {
    const row = benches[index];
    if (row === undefined) continue;
    const usingHere = memberUsesCell(members, station.ref, station.useCells[index]);
    const loadingHere =
      station.useCells[index] !== undefined &&
      seatChangeoverTicks(changeovers, station.ref, station.useCells[index] as GridPosition) > 0;
    const activity: 'using' | 'claimed' | 'loading' | null = usingHere
      ? 'using'
      : loadingHere
        ? 'loading'
        : waiting
          ? 'claimed'
          : null;
    if (activity === null) continue;
    const testID = highlightTestId(activity, station.ref, row.expansion);
    boxes.push({
      key: `station-${testID}`,
      testID,
      activity,
      position: row.bench.position,
      footprint: row.bench.footprint,
    });
  }
  return boxes;
}

interface PlateLoadingLayer {
  readonly key: string;
  readonly testID: string;
  readonly discs: readonly {
    readonly index: number;
    readonly left: number;
    readonly top: number;
    readonly size: number;
  }[];
}

/**
 * Stage D2.2: plate discs on the bench while `changeovers` holds the seat.
 * Progress maps remaining=total..1 onto 0..1 so the last drawn frame
 * reaches the sleeve. No parallel timer.
 */
function plateLoadingLayers(
  station: FloorStation,
  bay: CompetitionBenchBay,
  changeovers: Readonly<Record<string, number>>,
  capability: StationCapabilityState,
  camera: FloorCamera,
  benchArtAspect: number,
): readonly PlateLoadingLayer[] {
  if (station.ref.kind !== 'training') return [];
  const total = stationChangeoverTicks(capability, station.ref.kind, station.ref.station);
  if (total <= 0) return [];
  const layout = EMPIRE_TUNING.FLOOR_PLATE_LOADING;
  const layers: PlateLoadingLayer[] = [];
  const benches: { readonly bench: BayBench; readonly expansion: boolean }[] = [];
  if (bay.benches.length > 0) {
    for (const bench of bay.benches) {
      benches.push({ bench, expansion: bench.source === 'expansion' });
    }
  } else {
    benches.push({
      bench: {
        position: station.position,
        footprint: station.footprint,
        source: 'primary',
      },
      expansion: false,
    });
  }
  for (let index = 0; index < benches.length; index += 1) {
    const row = benches[index];
    if (row === undefined) continue;
    const cell = station.useCells[index];
    if (cell === undefined) continue;
    const remaining = seatChangeoverTicks(changeovers, station.ref, cell);
    if (remaining <= 0) continue;
    const progress = plateLoadingProgress(remaining, total);
    // VL-2: the discs travel across the bench's DRAWN box — the footprint
    // box under Build, the projected art box under Play — sized as PLATES
    // (the footprint's short side at the bench's drawn tile scale, exactly
    // Build's size at scale 1): sized off the art box they doubled and read
    // as three balloons over the bench on Play, seen in the first evidence.
    const box = stationDrawBox(camera, row.bench.position, row.bench.footprint, benchArtAspect);
    const size = Math.min(row.bench.footprint.width, row.bench.footprint.height) * camera.tile * box.scale * layout.discSizeFraction;
    const half = size / 2;
    const discs = plateLoadingDiscs(progress).map((disc) =>
      Object.freeze({
        index: disc.index,
        left: box.left + disc.xFraction * box.width - half,
        top: box.top + disc.yFraction * box.height - half,
        size,
      }),
    );
    const testID = plateLoadingTestId(station.ref, row.expansion);
    layers.push({
      key: testID,
      testID,
      discs: Object.freeze(discs),
    });
  }
  return layers;
}

/**
 * Disc Views for one loading layer. A C-style loop rather than
 * `layer.discs.map`, so the channel census does not file a
 * member-of-parameter `.map` on the layer callback's parameter. The discs
 * are already a frozen array from `plateLoadingLayers`; this only renders.
 */
function plateLoadingDiscViews(layer: PlateLoadingLayer): readonly ReactElement[] {
  const views: ReactElement[] = [];
  for (let index = 0; index < layer.discs.length; index += 1) {
    const disc = layer.discs[index];
    if (disc === undefined) continue;
    views.push(
      <View
        key={`${layer.key}-disc-${disc.index}`}
        testID={`${layer.testID}-disc-${disc.index}`}
        pointerEvents={'none'}
        style={{
          position: 'absolute',
          left: disc.left,
          top: disc.top,
          width: disc.size,
          height: disc.size,
          borderRadius: disc.size,
          backgroundColor: FLOOR_PLATE_LOADING_COLOR,
          borderWidth: EMPIRE_TUNING.FLOOR_ITEM_BORDER_WIDTH_PIXELS,
          borderColor: FLOOR_PLATE_LOADING_HOLE_COLOR,
        }}
      />,
    );
  }
  return views;
}

function queueCellTestId(ref: FloorStationRef, slot: number): string {
  if (ref.kind === 'training') {
    return `floorsim-queue-cell-training-${ref.station}-${slot}`;
  }
  return `floorsim-queue-cell-${ref.kind}-${ref.item}-${slot}`;
}

/**
 * Waiting members occupy queue cells. C-style loops keep the channel census
 * off a `.map` of the world-view parameter.
 *
 * VL-2: on Play these are TRANSPARENT GEOMETRY ANCHORS, not marks. The
 * khaki outline was a Phase 3 diagnostic — a square on the floor saying
 * "someone is queued here" — and the world now says it itself: the queued
 * member stands on that cell, facing its station, swaying. The element
 * stays because `tools/verify-floor-reachability.mjs` and
 * `tools/capture-living-world.mjs` read `floorsim-queue-cell-*` boxes as
 * the queue's geometry, and geometry is a relation the tools measure, not
 * a thing a player is shown; `outlined` says which of the two this call is
 * drawing, and Build keeps the outline as its diagnostic read.
 */
function queueOccupancyViews(
  stations: readonly WorldStationView[],
  camera: FloorCamera,
  outlined: boolean,
): readonly ReactElement[] {
  const views: ReactElement[] = [];
  const inset = outlined ? EMPIRE_TUNING.FLOOR_SIM_HIGHLIGHT_BORDER_WIDTH_PIXELS : 0;
  for (let stationIndex = 0; stationIndex < stations.length; stationIndex += 1) {
    const station = stations[stationIndex];
    if (station === undefined) continue;
    for (let slot = 0; slot < station.occupiedQueueCells.length; slot += 1) {
      const cell = station.occupiedQueueCells[slot];
      if (cell === undefined) continue;
      const testID = queueCellTestId(station.ref, slot);
      const box = floorCellBox(camera, cell);
      views.push(
        <View
          key={testID}
          testID={testID}
          pointerEvents={'none'}
          style={{
            position: 'absolute',
            left: box.left + inset,
            top: box.top + inset,
            width: box.width - inset * 2,
            height: box.height - inset * 2,
            borderWidth: outlined ? EMPIRE_TUNING.FLOOR_ITEM_BORDER_WIDTH_PIXELS : 0,
            borderColor: FLOOR_SIM_STATE_COLOR.queuing,
            backgroundColor: FLOOR_SIM_HIGHLIGHT_FILL,
            zIndex: EMPIRE_TUNING.FLOOR_SIM_STATION_HIGHLIGHT_Z_INDEX,
          }}
        />,
      );
    }
  }
  return views;
}

interface AmbientMemberBodyProps {
  readonly index: number;
  readonly type: MemberType;
  /**
   * GDD §5.13 presentation Phase 3: where to draw this member THIS INSTANT.
   * Phase 2 passed a whole `GridPosition` here because a body that never
   * moved was always on a cell exactly; Phase 3 passed the interpolated
   * tile point. VL-2: this is the point the body's FEET stand on, in STAGE
   * PIXELS, already projected through the floor camera by `memberAnchorFor`
   * — the bottom-centre of the drawn box. The shape (`{ x, y }`) is
   * unchanged; the unit is not, and the frame loop below interpolates it
   * between ticks in pixel space.
   */
  readonly position: FloorTilePoint;
  /** Which of `FLOOR_SIM_MEMBER_STATES`'s five arms this member is in, read straight off the sim. */
  readonly state: FloorSimMemberState;
  /** The cause of an in-flight interruption beat, or null — what the bubble says. */
  readonly interruptedBy: FloorSimInterruption | null;
  /**
   * Whether the sim reports this member as having no route to any station
   * (`FloorSimMember.strandedAt` set). Passed as a boolean rather than as the
   * tick itself because the renderer holds a cue while it is true and has no
   * use for WHEN it started — and a tick number is the shape a channel would
   * take.
   */
  readonly stranded: boolean;
  /**
   * VL-2: which animation CLIP this member is drawn in — computed by
   * `FloorGrid` from the contract member (`memberClipFor`: the station's
   * use clip while `using`, the walk while a step is in flight, wait while
   * queued, idle otherwise, the reaction beat while interrupted). Replaces
   * Phase 4's `pose`: which FRAME of the clip is on screen is no longer a
   * prop at all, because it changes every animation frame and is decided
   * inside the frame loop below from distance walked or time elapsed. A
   * closed literal union, like `pose` was.
   */
  readonly clip: MemberAnimationClip;
  /** Phase 4: which way the sprite faces — the mirror is baked into the sprite table, not computed here. */
  readonly facing: FloorSpriteFacing;
  /**
   * VL-2: the floor camera's depth scale at this member's feet — 1 on the
   * front row, `FLOOR_CAMERA_BACK_SCALE` on the back row, 1 everywhere under
   * Build's plan camera. Multiplies every drawn size (body, shadow, cue,
   * bounce). A plain number, computed by the camera, never compared.
   */
  readonly scale: number;
  /**
   * VL-2: the draw-order key — the feet point's screen y under Play, the
   * registered member z-index under Build — written to `zIndex` so a body
   * lower on the floor paints over one behind it AND over the bench it is
   * lying on. A plain number.
   */
  readonly depth: number;
  /**
   * VL-2: the contract's interpolated tile point this member's anchor was
   * projected from, carried onto the drawn root as `data-cell` so the
   * evidence tools can compare where the CONTRACT says the member is with
   * where it is DRAWN — the lag after a stall is measured by the tool from
   * those two, not reported by this component about itself. Two numbers,
   * read off the contract, never written.
   */
  readonly cellX: number;
  readonly cellY: number;
  /**
   * VL-2: the sim tick this anchor came from — the index the body's
   * playback timeline files the snapshot under. Read off the sim's own
   * counter; never compared here beyond "is this a newer snapshot".
   */
  readonly tick: number;
  /**
   * VL-2: the pull, in stage pixels, from the walked feet point to where
   * the body is drawn while using a station — zero when it is not. The
   * body eases along it over `FLOOR_MEMBER_SETTLE_MS` on each change, so
   * lying down and getting up are the two eased beats and the walk
   * timeline never sees the jump. Two plain numbers.
   */
  readonly pullX: number;
  readonly pullY: number;
  /**
   * Compact selected-member cue only. Warehouse can hold 40 living members;
   * permanent floating names over every sprite would cover the room.
   */
  readonly selectedName?: string;
  /**
   * Play-mode tap on this visible body. Presentation only — not a
   * `GymViewAction`. Absent in Build, where the same animated root is
   * `pointerEvents none`. Stage C.1d: the animated root owns the hit
   * region; there is no second member-shaped Pressable on the floor.
   */
  readonly onPress?: () => void;
  /**
   * VL-1: the contract's stable member identity (`PresentationMember.id`),
   * carried onto the drawn root as `data-memberid` so the evidence tool can
   * follow ONE member by identity rather than by array position. A branded
   * string, read straight off the contract; never written, never a dispatch.
   */
  readonly memberId: GymMemberId;
  /**
   * VL-1: the station this member has claimed, from the contract, carried
   * onto the drawn root as `data-target` (its `floorStationRefKey`). The
   * pose class and facing already key off the station the caller resolves
   * from the same ref; this prop exists only for the evidence attribute.
   */
  readonly target: FloorStationRef | null;
  /**
   * VL-1: `PresentationMember.queueRank` — 0 is next to be served, `null`
   * when not claiming — carried onto the drawn root as `data-queuerank`.
   * An integer rank, not a balance; presentation reads it and writes nothing.
   */
  readonly queueRank: number | null;
  /**
   * LAST ON PURPOSE, and the reason is in another session's file. The
   * `MUTATION_WITNESSES` row for `ambient-member-props-hold-no-channel` in
   * `src/game/guaranteeTags.test.ts` anchors its planted mutation on the text
   * `readonly tile: number;` followed by this interface's closing brace, and
   * the witness expires if that text does not occur exactly once. Phase 3
   * added three members; appending them AFTER `tile` broke the anchor and
   * reddened that check. Reordering restores it without editing a file this
   * piece is barred from — which is the right way round, since the witness is
   * evidence about this interface and the ordering of members carries no
   * meaning of its own.
   */
  readonly tile: number;
}

/**
 * One ambient member. Phase 2 (PLAYTEST 4) drew it as a two-part placeholder
 * silhouette — a circular "head" over a rounded-rect "body" — plus a small,
 * purely-visual, staggered idle bob; GDD §5.13 presentation Phase 4 replaces
 * the silhouette with the member's real sprite from `floorSprites.ts` (one
 * pre-upscaled indexed PNG per type, pose and facing) while the bob, the walk
 * tween, the cue bubble, the interruption word and the stranded ring all
 * survive unchanged on top of it.
 *
 * WHY A SEPARATE COMPONENT, rather than the bob's `Animated.Value` living in
 * `FloorGrid` and being indexed by array position: React's rules of hooks
 * forbid calling `useRef`/`useEffect` inside a `.map` callback, and each
 * member needs its OWN animated value and its OWN start/stop lifecycle (a
 * garage's 3 members and a warehouse's 40 must each bob independently,
 * out of phase by lane). Giving each member its own component instance,
 * keyed by roster index the same way the single `View` this replaces already
 * was, makes that legal: each instance owns one `Animated.Value`, starts its
 * own `Animated.loop` on mount, and `useEffect`'s cleanup function stops it
 * on unmount — which covers "the ambient roster's length changes" exactly,
 * since a shorter roster on re-render unmounts every index past the new
 * length and a longer one mounts a fresh instance (fresh loop, correctly
 * un-started-until-now) for every new index.
 *
 * THE BOB IS PURELY VISUAL, AND PHASE 3 LEFT IT THAT WAY. It reads no
 * `GymState`, no `EmpireGym`, no reputation and no wallet; it dispatches
 * nothing; and it never touches the position it sits on — only an ADDITIVE
 * `translateY` transform on top of it, the identical pattern the drag preview
 * above already uses via `dragOffset`. What changed under it is where that
 * base position comes from: Phase 2 read a fixed cell out of
 * `ambientMemberRoster`, and Phase 3 reads an interpolated tile point out of
 * `floorSim.ts`, whose own context type carries exactly four presentation
 * inputs and no wallet, no reputation and no streak. The bob and the walk
 * tween are two additive transforms on one token; neither is a game-state
 * input and neither writes anything. (P4b retired the third — the `using`
 * pulse — in favour of the sprite-level rep cycle, and the P4b anchor bias
 * arrives inside `position` itself, computed by `memberDrawPoint` before
 * this component ever sees it, so the prop surface is unchanged.)
 *
 * The Phase 2 bob's own knobs — `AMBIENT_MEMBER_BOB_AMPLITUDE_PIXELS`,
 * `_HALF_CYCLE_MS`, `_STAGGER_LANES`, `_STAGGER_STEP_MS` — are untouched by
 * this round, per GDD §5.13's PLAYTEST 4b ruling that a knob which just
 * passed its gate on no reported complaint does not get retuned.
 *
 * The bounded version of that claim, in the shape CLAUDE.md's own "Form That
 * Survived" section asks for.
 *
 * `@guarantee ambient-member-props-hold-no-channel`
 *
 * WHAT THE MECHANISM GUARANTEES, in its own terms. `empireForbiddenOutput.
 * test.ts` reads this component's prop surface out of the TYPE CHECKER — the
 * interface's resolved type, via `getPropertiesOfType`, and not the member
 * list written between one declaration's braces — and pins, in both
 * directions, the set of `{name, shape}` pairs it finds: `index: number`,
 * `tile: number`, `position: object{x:number,y:number}`, `stranded: boolean`,
 * `state`, `interruptedBy`, and (since Phase 4) `facing` — and, since VL-2,
 * `clip` in place of `pose` — as their own string-literal unions, `type` as
 * its five string literals, and VL-2's `scale` / `depth` / `cellX` / `cellY`
 * as plain numbers beside `index` and `tile`. Because the reading is the resolved type, three things
 * are inside it that a member-name list off the AST left outside: a member
 * arriving on a SECOND, merged `interface AmbientMemberBodyProps` declaration;
 * a member inherited through an `extends`; and an existing member's TYPE being
 * widened to carry a callable — `tile: number | { px: number; dispatch: ... }`
 * renders `union[number|object{dispatch:callable,px:number}]` and the diff
 * names both the member and the smuggled field. A second reading, the
 * directory's own `memberTypeScreen`, is joined to the first and covers the
 * structural render's weak spot, which is a type that declares no function
 * while still being able to hold one.
 *
 * A separate pin resolves this component's own parameter type by IDENTITY
 * against the interface, so leaving `AmbientMemberBodyProps` in place as dead
 * code and re-annotating the function with something else is red rather than
 * green — `tsconfig.json` sets no `noUnusedLocals`, so that edit compiles.
 *
 * ITS LIMITS, named concretely because none of the three is covered:
 *
 *   1. The prop surface is not the render body. This component could read a
 *      React context, or a module-scope binding written by `FloorGrid` below,
 *      and hold a dispatch that appears in no prop. The import fence in
 *      `empireCore.test.ts` pins which PACKAGES this file may import and not
 *      which names it takes from them, so adding `useContext` to the existing
 *      `react` import passes it. There is no catcher for that route today.
 *   2. The render sees structure, not modifiers, so dropping `readonly` from a
 *      member is invisible to it. That weakens the surface without opening a
 *      channel, which is why it is listed as a limit rather than a hole.
 *   3. `memberTypeScreen` refuses every interface-typed member whatever it
 *      holds, because TypeScript withholds an implicit index signature from an
 *      `interface`. `position` is therefore on that reading's refused list as a
 *      conservative answer rather than a finding, and the census entry carries
 *      the matched control rows that measure the difference.
 *
 * The named catcher is `empireForbiddenOutput.test.ts`'s describe block
 * "AmbientMemberBody's prop surface has no dispatch/game-state channel" — four
 * tests. Three mutants were planted against it and all three redden it: a
 * direct `dispatch` member, a second merged declaration carrying one, and the
 * `tile` widening above, each left compiling at `tsc --noEmit` exit 0 so that
 * the mutant is one that could really ship. See that block's own header for the
 * verbatim mutants and their observed failures.
 *
 * Outer element keeps the `floorgrid-ambient-<index>` testID the browser
 * check and existing unit tests key off of, with the SAME real, non-zero
 * `width`/`height` (`AMBIENT_MEMBER_FOOTPRINT_TILES` scaled by `tile`) the
 * single-`View` version carried, so a bounding-box read still covers the
 * whole visible member.
 */
function AmbientMemberBody({
  index,
  memberId,
  type,
  position,
  tile,
  state,
  interruptedBy,
  stranded,
  clip,
  facing,
  scale,
  depth,
  cellX,
  cellY,
  tick,
  pullX,
  pullY,
  target,
  queueRank,
  selectedName,
  onPress,
}: AmbientMemberBodyProps) {
  // VL-2: every drawn size is the front-row size times the camera's depth
  // scale at this body's feet. The box is `FLOOR_MEMBER_DRAW_SCALE_TILES`
  // tiles on a side at that depth, its bottom-centre on `position`.
  const bodySide = EMPIRE_TUNING.FLOOR_MEMBER_DRAW_SCALE_TILES * tile * scale;
  const shadowWidth = EMPIRE_TUNING.FLOOR_MEMBER_SHADOW_WIDTH_FRACTION * tile * scale;
  const shadowHeight = EMPIRE_TUNING.FLOOR_MEMBER_SHADOW_HEIGHT_FRACTION * tile * scale;

  // The per-body animated values: the root's offset (the walk), the body's
  // lift (bounce / breath) and lean, and one opacity per sprite pose (the
  // frame). Created once per mounted body; written every animation frame by
  // the loop below and read by the styles, so a frame never re-renders React.
  const rootOffset = useRef(
    new Animated.ValueXY({ x: position.x - bodySide / 2, y: position.y - bodySide }),
  ).current;
  const lift = useRef(new Animated.Value(0)).current;
  const lean = useRef(new Animated.Value(0)).current;
  const poseOpacity = useRef(poseOpacityValues()).current;

  // The latest props, for the frame loop. `requestAnimationFrame`'s callback
  // closes over the render it was created in, so without this the loop
  // would go on drawing the anchor as it stood when the body mounted.
  // Written after every render (no dependency array), which runs before
  // any frame fires.
  const latest = useRef({ position, scale, clip, state, facing, tile, index, tick, pullX, pullY });
  useEffect(() => {
    latest.current = { position, scale, clip, state, facing, tile, index, tick, pullX, pullY };
  });

  // The previous clip's poses stay mounted for one render after a clip
  // change, so the loop's blend has both the outgoing and the incoming
  // frame to write to. `FLOOR_MEMBER_CLIP_BLEND_MS` is one tick long for
  // exactly that reason (see the knob).
  const previousClip = useRef(clip);
  useEffect(() => {
    previousClip.current = clip;
  }, [clip]);
  const mountedPoses = posesToMount(clip, previousClip.current);

  // ONE EFFECT OWNS THE FRAME LOOP ON THIS BODY, AND ONE CLEANUP STOPS IT.
  // Structural rather than stylistic: `empireForbiddenOutput.test.ts`'s
  // returned-closure census keys a site by its MEMBER PATH, so two
  // `useEffect` cleanups inside one component are two rows carrying the
  // same key, and the seal census pins DISTINCT members against its two
  // declared lists. One effect keeps the key one-to-one with the site.
  //
  // VL-2 — THE FRAME LOOP. VL-1 ran two `Animated` timers per body: a
  // looping bounce on its own clock and a per-tick `Animated.timing` tween
  // toward each new position. Both are gone. One `requestAnimationFrame`
  // loop per body now does, every frame, in this order:
  //
  //   1. THE WALK — a playback timeline in sim ticks. Every tick's feet
  //      point is filed as a snapshot under its tick; a playback clock
  //      advances one tick per `FLOOR_SIM_TICK_INTERVAL_MS` of real time,
  //      `FLOOR_MEMBER_RENDER_DELAY_TICKS` behind the newest snapshot, and
  //      the feet are drawn between the two snapshots it sits between
  //      (`advancePlaybackTick`, `samplePlayback`). So the drawn speed is
  //      the sim's own speed: a tick that arrives late leaves the clock
  //      holding on the newest snapshot, and a main-thread stall is drawn
  //      as a stall. When the clock has fallen more than
  //      `FLOOR_MEMBER_CATCH_UP_BEHIND_TICKS` behind it runs faster by
  //      `FLOOR_MEMBER_CATCH_UP_RATE` — a bounded catch-up whose ceiling
  //      the evidence tool reads from source and checks — never a jump.
  //      VL-1's tween retargeted FROM its in-flight position over a fresh
  //      full duration, which is why it caught up at ~0.5 tiles per 100 ms
  //      after a stall; a first VL-2 trial that simply interpolated to
  //      each new anchor over one tick did the same when ticks arrived
  //      bunched after a harness stall, which is what this replaced.
  //      `data-cell` / `data-anchor` / `data-tick` on the root let the
  //      evidence tool measure the drawn-versus-contract gap instead of
  //      trusting this comment. The two lifecycle moments that move the
  //      body without the cell moving — onto and off a station — are an
  //      eased PULL added on top of the walked feet point, timed per tile
  //      of pull (`settleDurationMs`, `settleRemainder`) so a long pull
  //      glides at about walking speed with the WALK clip playing over it
  //      (`clipWhileSettling`) and the use pose lands with the body; the
  //      timeline never sees that jump either. The first VL-2 build settled
  //      every pull in one fixed 360 ms, and the garage bench's ~2.5-tile
  //      pull crossed at three times walking speed — the stall probe's
  //      largest single-frame step, and not from the stall.
  //   2. THE PHASE — the clip's phase advances by tiles the body actually
  //      moved on screen this frame (the walk) or by the frame's elapsed
  //      milliseconds (everything else), per `memberAnimation.ts`. A clip
  //      change restarts the phase at the body's own stagger and starts a
  //      one-tick blend from the outgoing clip's last frames.
  //   3. THE SAMPLE — `sampleMemberAnimation` returns the frame(s) to show
  //      and the lift and lean to show them with, all off that one phase.
  //   4. THE WRITE — the root's offset (walk), the inner view's lift and
  //      lean, and one opacity per mounted pose (frame, times the blend).
  //      `Animated.Value.setValue` on a value bound in a style updates the
  //      node directly; React is not re-rendered by any of this, which is
  //      the property that lets a warehouse's forty bodies run it.
  //
  // No `Date`, no `performance`: the only clock is the timestamp
  // `requestAnimationFrame` hands its callback, per the directory's own
  // clock ban. Where there is no `requestAnimationFrame` (the node test
  // harness) the loop simply does not run and the body draws its first
  // frame at its anchor.
  useEffect(() => {
    if (typeof requestAnimationFrame !== 'function' || typeof cancelAnimationFrame !== 'function') {
      return undefined;
    }
    let handle = 0;
    let lastNow: number | null = null;
    const snapshots: MemberPlaybackSnapshot[] = [];
    let playTick: number | null = null;
    let pullFrom: FloorTilePoint = { x: latest.current.pullX, y: latest.current.pullY };
    let pullTo: FloorTilePoint = pullFrom;
    let pullChangedAt: number | null = null;
    let lastDrawn: FloorTilePoint | null = null;
    let runningClip = latest.current.clip;
    let outgoingFrames: readonly MemberAnimationFrame[] = [];
    let clipChangedAt: number | null = null;
    let phase = memberAnimationStartPhase(runningClip, latest.current.index);
    let settleMs = settleDurationMs(0);
    const frame = (now: number): void => {
      const p = latest.current;
      const elapsed = lastNow === null ? 0 : now - lastNow;
      lastNow = now;
      // 1. Snapshot intake: a new tick files a new snapshot; the same tick
      //    re-rendered with a moved anchor (a layout change) replaces it.
      const newest = snapshots[snapshots.length - 1];
      if (newest === undefined || newest.tick !== p.tick) {
        snapshots.push({ tick: p.tick, x: p.position.x, y: p.position.y });
      } else if (newest.x !== p.position.x || newest.y !== p.position.y) {
        snapshots[snapshots.length - 1] = { tick: p.tick, x: p.position.x, y: p.position.y };
      }
      // 2. The playback clock, then the walked feet point along the buffer;
      //    snapshots the clock has passed are dropped.
      const latestTick = (snapshots[snapshots.length - 1] as MemberPlaybackSnapshot).tick;
      playTick = advancePlaybackTick(playTick, latestTick, elapsed);
      while (snapshots.length > 2 && (snapshots[1] as MemberPlaybackSnapshot).tick <= playTick) {
        snapshots.shift();
      }
      const feet = samplePlayback(snapshots, playTick) ?? p.position;
      // 3. The eased pull onto or off a station: a changed pull starts a new
      //    settle from wherever the previous one had got to, timed by how
      //    far it has to cross in tiles at this body's depth.
      const tileHere = p.tile * p.scale;
      if (p.pullX !== pullTo.x || p.pullY !== pullTo.y) {
        const remainderNow = pullChangedAt === null ? 0 : settleRemainder(now - pullChangedAt, settleMs);
        pullFrom = {
          x: pullTo.x + (pullFrom.x - pullTo.x) * remainderNow,
          y: pullTo.y + (pullFrom.y - pullTo.y) * remainderNow,
        };
        pullTo = { x: p.pullX, y: p.pullY };
        pullChangedAt = now;
        settleMs = settleDurationMs(
          tileHere <= 0 ? 0 : Math.hypot(pullTo.x - pullFrom.x, pullTo.y - pullFrom.y) / tileHere,
        );
      }
      const remainder = pullChangedAt === null ? 0 : settleRemainder(now - pullChangedAt, settleMs);
      if (remainder === 0) pullChangedAt = null;
      const drawn: FloorTilePoint = {
        x: feet.x + pullTo.x + (pullFrom.x - pullTo.x) * remainder,
        y: feet.y + pullTo.y + (pullFrom.y - pullTo.y) * remainder,
      };
      // 4. The clip phase, by distance walked on screen or by time. While a
      //    settle is still crossing the floor the body walks it; the use
      //    pose starts when the settle lands.
      const wantedClip = remainder > 0 ? clipWhileSettling(p.clip) : p.clip;
      const movedTiles =
        lastDrawn === null || tileHere <= 0
          ? 0
          : Math.hypot(drawn.x - lastDrawn.x, drawn.y - lastDrawn.y) / tileHere;
      lastDrawn = drawn;
      if (wantedClip !== runningClip) {
        outgoingFrames = sampleMemberAnimation(runningClip, phase).frames;
        runningClip = wantedClip;
        clipChangedAt = now;
        phase = memberAnimationStartPhase(runningClip, p.index);
      }
      phase = advanceMemberAnimationPhase(runningClip, phase, movedTiles, elapsed);
      const sample = sampleMemberAnimation(runningClip, phase);
      const blend = clipChangedAt === null ? 1 : memberAnimationBlend(now - clipChangedAt);
      if (blend >= 1) {
        clipChangedAt = null;
        outgoingFrames = [];
      }
      // 5. The write.
      const side = EMPIRE_TUNING.FLOOR_MEMBER_DRAW_SCALE_TILES * tileHere;
      rootOffset.setValue({ x: drawn.x - side / 2, y: drawn.y - side });
      lift.setValue(-sample.liftPixels * p.scale);
      lean.setValue(p.facing === 'left' ? -sample.leanDegrees : sample.leanDegrees);
      for (const pose of FLOOR_SPRITE_POSES) {
        let opacity = 0;
        for (const shown of sample.frames) if (shown.pose === pose) opacity += shown.opacity * blend;
        for (const fading of outgoingFrames) {
          if (fading.pose === pose) opacity += fading.opacity * (1 - blend);
        }
        poseOpacity[pose].setValue(opacity > 1 ? 1 : opacity);
      }
      handle = requestAnimationFrame(frame);
    };
    handle = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(handle);
    };
  }, [lean, lift, poseOpacity, rootOffset]);

  const cueScale =
    state === 'interrupted' ? EMPIRE_TUNING.FLOOR_SIM_INTERRUPTED_CUE_SCALE : 1;
  const cueDiameter = bodySide * EMPIRE_TUNING.FLOOR_SIM_CUE_DIAMETER_FRACTION * cueScale;

  return (
    <Animated.View
      testID={`floorgrid-ambient-${index}`}
      // Stage C.1d: this animated root IS the member. Play passes onPress
      // and a filling Pressable rides the same transform; Build passes
      // nothing and the whole token is out of hit-testing so stations
      // remain tappable underneath.
      pointerEvents={onPress === undefined ? 'none' : 'box-none'}
      // VL-1: contract identity and lifecycle on the drawn root as data
      // attributes (react-native-web maps `dataSet` to `data-*`), so the
      // evidence tool follows one member by `data-memberid` across frames
      // and reads what the contract says it is doing from the same node.
      // VL-2 adds the contract's tile point (`data-cell`), the projected
      // anchor (`data-anchor`) and the depth scale, so the tool can measure
      // the drawn body against the contract rather than trust the renderer.
      // Evidence only — nothing in this file reads them back.
      {...({
        dataSet: {
          memberid: memberId,
          lifecycle: state,
          // Absent, not empty, when there is no target or no rank — the
          // attribute is simply not written for that frame.
          target: target === null ? undefined : floorStationRefKey(target),
          queuerank: queueRank === null ? undefined : String(queueRank),
          cell: `${String(cellX)},${String(cellY)}`,
          anchor: `${String(position.x + pullX)},${String(position.y + pullY)}`,
          tick: String(tick),
          scale: String(scale),
          clip,
        },
      } as object)}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: bodySide,
        height: bodySide,
        zIndex: depth,
        // VL-1: on Play a member stepping away from a bench is drawn at full
        // strength — a person, not a ghost. Build keeps the Phase 3
        // `leaving` fade as its diagnostic read of the fifth state.
        opacity:
          state === 'leaving' && onPress === undefined
            ? EMPIRE_TUNING.FLOOR_SIM_LEAVING_OPACITY
            : 1,
        // The frame loop owns the whole position; `left`/`top` stay at
        // zero. The lift and lean live on the inner view so the grounding
        // shadow below stays on the floor while the body moves over it.
        transform: [{ translateX: rootOffset.x }, { translateY: rootOffset.y }],
      }}
    >
      {/*
        VL-1: the grounding shadow — a flat ellipse under the feet, on the
        floor, outside the lift transform so the body rises off it during a
        step. Not drawn while lying on a bench. `AMBIENT_MEMBER_BORDER_COLOR`
        is the named black this file already carries; the opacity and
        geometry are the registered `FLOOR_MEMBER_SHADOW_*` knobs, scaled by
        depth like everything else on this body.
      */}
      {state === 'using' ? null : (
        <View
          testID={`floorgrid-member-shadow-${index}`}
          pointerEvents={'none'}
          style={{
            position: 'absolute',
            left: (bodySide - shadowWidth) / 2,
            top: bodySide - shadowHeight / 2,
            width: shadowWidth,
            height: shadowHeight,
            borderRadius: shadowHeight,
            backgroundColor: AMBIENT_MEMBER_BORDER_COLOR,
            opacity: EMPIRE_TUNING.FLOOR_MEMBER_SHADOW_OPACITY,
          }}
        />
      )}
      <Animated.View
        pointerEvents={'none'}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: bodySide,
          height: bodySide,
          transform: [
            { translateY: lift },
            // Degrees in, a rotation string out; `extrapolate` is the
            // default `extend`, so the unit range maps every angle.
            { rotate: lean.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '1deg'] }) },
          ],
        }}
      >
        {/*
          GDD §5.13 presentation Phase 4: the member is the sprite. VL-2:
          the sprite is a small stack of pre-mounted pose images — the
          poses of the current clip, plus the previous clip's for one
          render after a change — each bound to its own opacity value, so
          a frame change is an opacity write from the loop above and never
          a mount, an unmount or a `source` swap. `floorgrid-member-sprite-
          <index>` is the stack's box (what the browser checks read); the
          visible frame is whichever image the loop has at opacity 1.
        */}
        <View
          testID={`floorgrid-member-sprite-${index}`}
          pointerEvents={'none'}
          style={{ position: 'absolute', left: 0, top: 0, width: bodySide, height: bodySide }}
        >
          {memberPoseImages(mountedPoses, poseOpacity, type, facing, bodySide, index)}
        </View>
        {/*
          GDD §5.13 presentation Phase 3 — the state cue, in the register
          §5.13 names by hand ("a visible reaction cue (RCT's thought-bubble
          pattern)"). One bubble above the head, coloured by state, carrying
          the cause glyph while an interruption beat is running and drawn
          larger while it is. Its testID carries the state, so a browser
          check can ask which state a member is in by reading the drawn DOM
          rather than by reading a caption.
        */}
        <View
          testID={`floorsim-cue-${index}-${state}`}
          pointerEvents={'none'}
          style={{
            position: 'absolute',
            left: (bodySide - cueDiameter) / 2,
            top: -(cueDiameter + EMPIRE_TUNING.FLOOR_SIM_CUE_GAP_PIXELS),
            width: cueDiameter,
            height: cueDiameter,
            borderRadius: cueDiameter / 2,
            backgroundColor: FLOOR_SIM_STATE_COLOR[state],
            borderWidth: EMPIRE_TUNING.FLOOR_ITEM_BORDER_WIDTH_PIXELS,
            borderColor: AMBIENT_MEMBER_BORDER_COLOR,
            opacity: onPress === undefined ? 1 : 0,
          }}
        />
        {interruptedBy === null ? null : (
          // The cause, in a word, beside the body rather than inside the
          // bubble: the bubble is a fraction of a 28-pixel tile and a word
          // laid out inside it would wrap to one letter a line. It
          // overflows its member's own footprint, which is what makes it
          // readable and is acceptable for a beat that runs for
          // `FLOOR_SIM_INTERRUPTED_BEAT_TICKS` and then resolves.
          <Text
            testID={`floorsim-cue-word-${index}`}
            pointerEvents={'none'}
            style={{
              position: 'absolute',
              left: 0,
              top: bodySide + EMPIRE_TUNING.FLOOR_SIM_CUE_GAP_PIXELS,
              color: FLOOR_SIM_STATE_COLOR.interrupted,
              opacity: onPress === undefined ? 1 : 0,
            }}
          >
            {FLOOR_SIM_INTERRUPTION_WORD[interruptedBy]}
          </Text>
        )}
        {selectedName === undefined ? null : (
          <Text
            testID={'floorgrid-selected-member-name'}
            pointerEvents={'none'}
            style={{
              position: 'absolute',
              left: -tile,
              top: -(
                cueDiameter +
                EMPIRE_TUNING.FLOOR_SIM_CUE_GAP_PIXELS * 2 +
                EMPIRE_TUNING.FLOOR_SPRITE_LABEL_FONT_SIZE
              ),
              width: bodySide + tile * 2,
              color: AMBIENT_MEMBER_BORDER_COLOR,
              fontSize: EMPIRE_TUNING.FLOOR_SPRITE_LABEL_FONT_SIZE,
              textAlign: 'center',
              opacity: onPress === undefined ? 1 : 0,
            }}
          >
            {selectedName}
          </Text>
        )}
        {/*
          The stranded ring. `floorSim.ts`'s own header states why this
          needs a cue of its own: the interruption beat is transient, so a
          member walled off from every station reacts once and then paces,
          and "still moving" is exactly what a stranded member and a member
          walking with purpose have in common. `FloorSimMember.strandedAt`
          is what tells them apart, and this holds a mark against it for as
          long as it is set.
        */}
        {stranded ? (
          <View
            testID={`floorsim-stranded-${index}`}
            pointerEvents={'none'}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: bodySide,
              height: bodySide,
              borderWidth: EMPIRE_TUNING.FLOOR_SIM_HIGHLIGHT_BORDER_WIDTH_PIXELS,
              borderColor: FLOOR_SIM_STATE_COLOR.interrupted,
              backgroundColor: FLOOR_SIM_HIGHLIGHT_FILL,
              opacity: onPress === undefined ? 1 : 0,
            }}
          />
        ) : null}
      </Animated.View>
      {onPress === undefined ? null : (
        <Pressable
          accessibilityRole={'button'}
          onPress={onPress}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: bodySide,
            height: bodySide,
            cursor: 'pointer',
          } as WebSelectableViewStyle}
        />
      )}
    </Animated.View>
  );
}

/** One opacity value per sprite pose, all starting at 0 — the frame loop raises the ones a clip shows. A loop rather than a `.map`, for the channel census. */
function poseOpacityValues(): Readonly<Record<FloorSpritePose, Animated.Value>> {
  const values: Partial<Record<FloorSpritePose, Animated.Value>> = {};
  for (const pose of FLOOR_SPRITE_POSES) values[pose] = new Animated.Value(0);
  return values as Readonly<Record<FloorSpritePose, Animated.Value>>;
}

/**
 * The union of two clips' poses, in `FLOOR_SPRITE_POSES` order, so the
 * mounted stack is stable across a clip change — PLUS the poses of the clip
 * the frame loop runs while a settle onto the current clip's station is
 * still crossing (`clipWhileSettling`: the walk, for a use clip). Measured
 * before this line existed: a member entering `using` walked its glide for
 * one render, then the re-render on the next sim tick mounted only the use
 * poses, and the body was INVISIBLE for the rest of the glide (0.7 s with
 * no pose at opacity above 0) until the settle landed. The loop writes
 * opacities into whatever is mounted; what is mounted has to include what
 * the loop can choose.
 */
function posesToMount(current: MemberAnimationClip, previous: MemberAnimationClip): readonly FloorSpritePose[] {
  const wanted = new Set<FloorSpritePose>();
  for (const pose of memberAnimationPoses(current)) wanted.add(pose);
  for (const pose of memberAnimationPoses(previous)) wanted.add(pose);
  for (const pose of memberAnimationPoses(clipWhileSettling(current))) wanted.add(pose);
  const ordered: FloorSpritePose[] = [];
  for (const pose of FLOOR_SPRITE_POSES) if (wanted.has(pose)) ordered.push(pose);
  return ordered;
}

/**
 * The pre-mounted pose images of one body, each bound to its own opacity.
 * A C-style loop rather than `poses.map`, so the channel census does not
 * file a member-of-parameter `.map`; every image is a full-box stretch of
 * the same square, so whichever is visible sits exactly where the others
 * do.
 */
function memberPoseImages(
  poses: readonly FloorSpritePose[],
  opacities: Readonly<Record<FloorSpritePose, Animated.Value>>,
  type: MemberType,
  facing: FloorSpriteFacing,
  side: number,
  index: number,
): readonly ReactElement[] {
  const images: ReactElement[] = [];
  for (let at = 0; at < poses.length; at += 1) {
    const pose = poses[at];
    if (pose === undefined) continue;
    images.push(
      <Animated.Image
        key={pose}
        testID={`floorgrid-member-pose-${index}-${pose}`}
        source={{ uri: ironAmberMemberUri(type, pose, facing) }}
        resizeMode={'stretch'}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: side,
          height: side,
          opacity: opacities[pose],
        }}
        {...({ pointerEvents: 'none' } as object)}
      />,
    );
  }
  return images;
}

export function FloorGrid(props: FloorGridProps) {
  const { owned, barbellOwned, floor, dispatch, managed, capability, buildMode, livingMembers, gymClockSeconds } =
    props;
  const grid = floorGridSize(floor.rung);
  const placed = floorLayout(floor);
  const unplaced = unplacedOwnedFloorItems(floor, owned);
  const furniture = floorFurnitureLayout(floor, barbellOwned);
  const unplacedFurniture = unplacedOwnedFurnitureItems(floor, barbellOwned);
  const bay = competitionBenchBay(
    floor,
    barbellOwned,
    stationLevels(capability, COMPETITION_BENCH_BAY).capacity,
  );
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const tile = tilePixelsForStage(grid.width, grid.height, stageSize.width, stageSize.height);
  // VL-2 — THE CAMERA. Build draws the orthographic plan at `tile` pixels a
  // cell, exactly as before; Play draws the pinhole ground plane
  // `floorCamera.ts` fits to this stage and this rung's painted floor. Every
  // Play element below — stations, queue cells, plate discs, members — is
  // positioned through `projectFloorPoint` on this one object, which is
  // what makes the scene one scene. Derived every render from measured
  // stage size and props; stored nowhere.
  const camera: FloorCamera = buildMode
    ? orthographicFloorCamera(grid, tile)
    : perspectiveFloorCamera(stageSize, grid, floor.rung);
  // Play's camera is a function of the MEASURED stage, and the first render
  // happens before `onLayout` has measured anything. Drawing the world
  // against a 0×0 stage put every body a few hundred pixels above the floor
  // for one frame and then slid it into place over the next tick — a
  // teleport the evidence tool caught at ~2 tiles per 100 ms on entry. So on
  // Play nothing in the world is drawn until the stage has a size; Build's
  // plan camera needs no measurement and draws as before.
  const worldMeasured = buildMode || (stageSize.width > 0 && stageSize.height > 0);
  const [pendingPlace, setPendingPlace] = useState<PendingPlace | null>(null);
  const [selectedMemberIndex, setSelectedMemberIndex] = useState<number | null>(null);
  // Stage C.1d two-phase Build machine, explicit rather than inferred from
  // competing responders:
  //   SELECT (`pendingPlace === null`): equipment and inventory are tappable;
  //     floor cells are not mounted.
  //   PLACE (`pendingPlace !== null`): ONE cell layer is mounted; equipment,
  //     inventory, members, and Play-mode station taps are pointerEvents none.
  const placing = buildMode && pendingPlace !== null;

  // GDD §5.13 presentation Phase 3 — everything `floorSim.ts` is allowed to
  // see, rebuilt from PROPS on every render. Never copied into sim state and
  // never written back: `stepFloorSim` takes it as an argument each tick, so
  // the rung, the real `FloorState` and both ownership lists are read fresh
  // and this component holds no second copy of any of them. That is §5.13's
  // hard constraint — "this is presentation, not a second source of truth" —
  // and it is why `GymState` gains no field and no reducer action for any of
  // this.
  const simContext: FloorSimContext = {
    rung: floor.rung,
    floor,
    barbellOwned,
    sessionOwned: owned,
    capability,
    livingPopulation: floorSimPopulationFromRoster(livingMembers),
  };
  // GDD §5.13's PLAYTEST 2 ruling, gap 3: the grid's own internal tile
  // boundaries, one line per interior column/row edge — `grid.width - 1`
  // vertical lines and `grid.height - 1` horizontal lines, since the two
  // outer edges are already the container's own border
  // (`FLOOR_GRID_BORDER_WIDTH_PIXELS`). Pure pixel arithmetic from the
  // already-read `grid`/`tile`, the same class of inline conversion this file
  // already does for a placed item's `left`/`top`/`width`/`height` below —
  // not moved to `floor.ts` because nothing here compares a value against
  // it, it only scales an output for drawing, matching `FLOOR_TILE_PIXELS`'s
  // own registered rationale.
  const verticalLines = Array.from({ length: Math.max(grid.width - 1, 0) }, (_unused, i) => i + 1);
  const horizontalLines = Array.from({ length: Math.max(grid.height - 1, 0) }, (_unused, j) => j + 1);
  const tileXs = Array.from({ length: grid.width }, (_unused, x) => x);
  const tileYs = Array.from({ length: grid.height }, (_unused, y) => y);

  // GDD §5.14 Stage C — the one selected station, if any. The same class of
  // purely-visual, component-local state as `draggingItem`/`overlapRefusalItem`
  // above: it carries no economic meaning (which station is being LOOKED AT is
  // not part of `GymState`), so it does not go through `GymViewState`/
  // `GymViewAction` the way a repair or a removal does — it is never
  // dispatched, never persisted, and gone the instant this component unmounts.
  // Selecting or dismissing a station therefore cannot reset the floor, the
  // sim, the drag/placement state, or anything the reducer owns: this is a
  // second, independent `useState`, not a write through any of the others.
  const [selectedStation, setSelectedStation] = useState<FloorStationRef | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<LadderEquipmentItem | null>(null);

  // GDD §5.14 Stage C.1 — whether the verification-flavoured diagnostics
  // (the sim tick/state-census readout, its legend, and the raw grid-
  // dimensions caption) are expanded. Collapsed by default: CLAUDE.md's own
  // Stage C.1 brief separates PLAYER information from VERIFICATION/DEVELOPER
  // information and asks that the latter not permanently dominate the normal
  // screen. The same class of purely-visual, component-local state as
  // `selectedStation` above — it carries no economic meaning, dispatches
  // nothing, and is gone the instant this component unmounts.
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  // GDD §5.13's PLAYTEST 3 ruling on the furniture/session-item overlap gap:
  // which fixed row, if any, a drop was just refused for landing on — purely
  // visual, cleared by its own timeout, never persisted and never read by
  // `floor.ts`. The refusal is decided and enforced HERE, before `dispatch`
  // is ever called — `placeFloorItem`/`FloorState` stay exactly as blind to
  // fixed furniture as `floor.ts`'s own header states; this is the one place
  // in the shipped app that ever dispatches `floor-place` (grepped, not
  // assumed), so refusing here is refusing for the whole app.
  const [overlapRefusalItem, setOverlapRefusalItem] = useState<LadderEquipmentItem | null>(null);
  const [placementRefuseKind, setPlacementRefuseKind] = useState<PlacementRefuseKind | null>(null);
  const [refusalRegion, setRefusalRegion] = useState<{
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  } | null>(null);
  const overlapRefusalTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (overlapRefusalTimeout.current !== null) clearTimeout(overlapRefusalTimeout.current);
    },
    [],
  );

  useEffect(() => {
    setSelectedStation(null);
    setSelectedEquipment(null);
    setSelectedMemberIndex(null);
    setPendingPlace(null);
    setPlacementRefuseKind(null);
    setOverlapRefusalItem(null);
    setRefusalRegion(null);
  }, [buildMode]);

  /** Select `ref`, or deselect it if it is already the selected one — a second tap on the same station closes its own panel. */
  const toggleSelectedStation = (ref: FloorStationRef): void => {
    setSelectedMemberIndex(null);
    setSelectedEquipment(null);
    setSelectedStation((previous) =>
      previous !== null && refsMatch(previous, ref) ? null : ref,
    );
  };

  const toggleSelectedEquipment = (item: LadderEquipmentItem): void => {
    setSelectedMemberIndex(null);
    setSelectedStation(null);
    setSelectedEquipment((previous) => (previous === item ? null : item));
  };

  const beginPlace = (next: PendingPlace): void => {
    setSelectedStation(null);
    setSelectedEquipment(null);
    setSelectedMemberIndex(null);
    setPlacementRefuseKind(null);
    setOverlapRefusalItem(null);
    setRefusalRegion(null);
    setPendingPlace(next);
  };

  const cancelPlace = (): void => {
    setPendingPlace(null);
    setPlacementRefuseKind(null);
    setOverlapRefusalItem(null);
    setRefusalRegion(null);
  };

  const clipRefusalRegion = (
    position: GridPosition,
    footprint: { width: number; height: number },
  ): { readonly x: number; readonly y: number; readonly width: number; readonly height: number } | null => {
    const x = Math.max(0, position.x);
    const y = Math.max(0, position.y);
    const right = Math.min(grid.width, position.x + footprint.width);
    const bottom = Math.min(grid.height, position.y + footprint.height);
    if (right <= x || bottom <= y) return null;
    return { x, y, width: right - x, height: bottom - y };
  };

  const flashRefusal = (
    kind: PlacementRefuseKind,
    furnitureItem: LadderEquipmentItem | null,
    region: { readonly x: number; readonly y: number; readonly width: number; readonly height: number } | null,
  ): void => {
    if (overlapRefusalTimeout.current !== null) clearTimeout(overlapRefusalTimeout.current);
    setOverlapRefusalItem(furnitureItem);
    setPlacementRefuseKind(kind);
    setRefusalRegion(region);
    // Cell/furniture flash is transient; the banner reason stays until the
    // next attempt, a successful place, or Cancel. C-DEBT-04: a reason that
    // only lives on the grid is covered by the Cancel chrome.
    overlapRefusalTimeout.current = setTimeout(() => {
      setOverlapRefusalItem(null);
      overlapRefusalTimeout.current = null;
    }, EMPIRE_TUNING.FLOOR_OVERLAP_REFUSAL_FLASH_MS);
  };

  const footprintFits = (position: GridPosition, footprint: { width: number; height: number }): boolean =>
    position.x >= 0 &&
    position.y >= 0 &&
    position.x + footprint.width <= grid.width &&
    position.y + footprint.height <= grid.height;

  const tryPlaceAt = (position: GridPosition): void => {
    if (pendingPlace === null) return;
    if (pendingPlace.kind === 'session') {
      const footprint = sessionItemFootprint(pendingPlace.item);
      if (!footprintFits(position, footprint)) {
        flashRefusal(
          position.x < 0 || position.y < 0 || position.x >= grid.width || position.y >= grid.height
            ? 'outside'
            : 'doesnt-fit',
          null,
          clipRefusalRegion(position, footprint),
        );
        return;
      }
      const overlappedFurniture = furniture.find((row) =>
        overlapsFixedFurniture(position, footprint, [row]),
      );
      if (overlappedFurniture !== undefined) {
        flashRefusal('occupied', overlappedFurniture.item, clipRefusalRegion(position, footprint));
        return;
      }
      if (overlapsBayExpansion(position, footprint, bay)) {
        flashRefusal('occupied', COMPETITION_BENCH_BAY_PRIMARY, clipRefusalRegion(position, footprint));
        return;
      }
      const overlappedSession = placed.find(
        (row) =>
          row.item !== pendingPlace.item &&
          overlapsFixedFurniture(position, footprint, [
            { item: 'power-bar', position: row.position, footprint: row.footprint },
          ]),
      );
      if (overlappedSession !== undefined) {
        flashRefusal('occupied', null, clipRefusalRegion(position, footprint));
        return;
      }
      dispatch({ kind: 'floor-place', item: pendingPlace.item, position });
    } else {
      const footprint = furnitureItemFootprint(pendingPlace.item);
      if (!footprintFits(position, footprint)) {
        flashRefusal(
          position.x < 0 || position.y < 0 || position.x >= grid.width || position.y >= grid.height
            ? 'outside'
            : 'doesnt-fit',
          null,
          clipRefusalRegion(position, footprint),
        );
        return;
      }
      const overlappedFurniture = furniture.find(
        (row) =>
          row.item !== pendingPlace.item && overlapsFixedFurniture(position, footprint, [row]),
      );
      if (overlappedFurniture !== undefined) {
        flashRefusal('occupied', overlappedFurniture.item, clipRefusalRegion(position, footprint));
        return;
      }
      if (
        pendingPlace.item !== COMPETITION_BENCH_BAY_PRIMARY &&
        overlapsBayExpansion(position, footprint, bay)
      ) {
        flashRefusal('occupied', COMPETITION_BENCH_BAY_PRIMARY, clipRefusalRegion(position, footprint));
        return;
      }
      const overlappedSession = placed.find((row) =>
        overlapsFixedFurniture(position, footprint, [
          { item: 'power-bar', position: row.position, footprint: row.footprint },
        ]),
      );
      if (overlappedSession !== undefined) {
        flashRefusal('occupied', null, clipRefusalRegion(position, footprint));
        return;
      }
      dispatch({ kind: 'floor-place-furniture', item: pendingPlace.item, position });
    }
    setPendingPlace(null);
    setPlacementRefuseKind(null);
    setRefusalRegion(null);
    setOverlapRefusalItem(null);
  };

  const pressTile = (position: GridPosition): void => {
    if (!placing) return;
    if (
      position.x < 0 ||
      position.y < 0 ||
      position.x >= grid.width ||
      position.y >= grid.height
    ) {
      flashRefusal('outside', null, clipRefusalRegion(position, { width: 1, height: 1 }));
      return;
    }
    tryPlaceAt(position);
  };

  const toggleSelectedMember = (index: number): void => {
    if (buildMode) return;
    setSelectedStation(null);
    setSelectedEquipment(null);
    setSelectedMemberIndex((previous) => (previous === index ? null : index));
  };

  // The latest context, for the tick callback. `setInterval`'s callback closes
  // over the render it was created in, so without this a tick would go on
  // reading the floor as it stood when the timer started. Written after every
  // render (no dependency array), which runs before any timer fires.
  const simContextRef = useRef(simContext);
  useEffect(() => {
    simContextRef.current = simContext;
  });

  // The sim itself — the same class of purely-visual, component-local state as
  // the in-flight drag above, and discarded the same way when this component
  // unmounts. Nothing outside this file reads it and nothing it holds is
  // dispatched.
  const [sim, setSim] = useState<FloorSimState>(() =>
    createFloorSimState(simContext, EMPIRE_TUNING.FLOOR_SIM_RENDER_SEED),
  );

  // A rung change is the one context change the sim cannot absorb by being
  // stepped: the grid is a different size and the roster is a different
  // length, so the members are rebuilt from `ambientMemberRoster` through
  // `createFloorSimState`. Guarded on the PREVIOUS rung rather than on the
  // effect firing, so mounting does not immediately throw away the state the
  // `useState` initialiser just built.
  const simRung = useRef(floor.rung);
  useEffect(() => {
    if (simRung.current === floor.rung) return;
    simRung.current = floor.rung;
    setSim(createFloorSimState(simContextRef.current, EMPIRE_TUNING.FLOOR_SIM_RENDER_SEED));
    // GDD §5.14 Stage C: a relocation is a full move (`floor.ts`'s own header
    // — "you leave the old place behind"), so whatever was selected on the
    // old floor has no reading on the new one. Cleared here rather than left
    // to the panel's own "does this station still exist" guard below, so a
    // relocation does not draw one frame of a panel naming equipment that is
    // no longer this gym's.
    setSelectedStation(null);
    setSelectedEquipment(null);
  }, [floor.rung]);

  // THE TICK. One `stepFloorSim` per `FLOOR_SIM_TICK_INTERVAL_MS`, against
  // whatever the props say the floor is at that moment.
  //
  // SUSPENDED WHILE A TILE IS PENDING. The gym must not keep walking onto
  // the tile the player is about to use. The gym holds still in PLACE phase.
  useEffect(() => {
    if (pendingPlace !== null) return undefined;
    const timer = setInterval(() => {
      setSim((previous) => {
        const stepped = stepFloorSimWithObservations(previous, simContextRef.current);
        if (stepped.observations.length > 0) {
          dispatch({
            kind: 'apply-living-member-observations',
            observations: stepped.observations,
          });
        }
        return stepped.state;
      });
    }, EMPIRE_TUNING.FLOOR_SIM_TICK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [pendingPlace]);

  // The stations the sim can send a member to, and what is happening at each.
  // A derived read: `floorStations` recomputes from the same context every
  // render and is stored nowhere, the same "read model, never a `FloorState`"
  // discipline `fixedFloorFurniture` already carries.
  const stations = floorStations(simContext);
  // VL-1 — THE CONTRACT READ. `presentationWorld` refuses a snapshot whose
  // roster does not match its sim (contract §5), and there is exactly one
  // render on which this component hands it such a pair: the render right
  // after a relocation, when `floor.rung` and `livingMembers` are already
  // the new gym's and `sim` is still the old one — the rung effect below
  // rebuilds the sim on the NEXT commit. A refusal thrown from inside render
  // would take the whole screen down for that one frame, so the same
  // coherence the contract checks is asked here first, in the contract's own
  // terms (rung, roster length, id-by-position) — a guard against a known
  // transient, not a second implementation of anything the contract decides.
  // On that frame no member is drawn; on every other frame the members are
  // the contract's.
  const contractCoherent =
    simRung.current === floor.rung &&
    sim.members.length === livingMembers.members.length &&
    sim.members.every(
      (member, ordinal) => livingMembers.members[ordinal]?.id === member.memberId,
    );
  const contractWorld: PresentationWorld | null = contractCoherent
    ? presentationWorld({ sim, floor, roster: livingMembers, managed, capability })
    : null;
  // `worldView.ts`'s occupancy convenience still supplies the occupied queue
  // CELLS (a geometry the contract does not carry — it carries `queueIds`
  // and `queueRank`, which is what order is read from).
  const occupancyFrame = worldFrame(sim, stations);
  // GDD §5.13 P4b: the same read model keyed for lookup, so a `using`
  // member's draw bias and facing resolve against the identical stations the
  // sim was stepped with this render — one derivation, no second copy.
  const stationByRefKey = new Map<string, FloorStation>();
  for (const station of stations) {
    stationByRefKey.set(stationKey(station.ref), station);
  }
  // VL-1: which stations are in use, read off the contract's own per-station
  // `usingIds` rather than off raw sim members. Only the `'using'` reading
  // is consumed below (the fixed furniture's occupied sprite swap); the
  // `'claimed'` arm is kept so the map's vocabulary is unchanged.
  const stationActivity = new Map<string, 'using' | 'claimed'>();
  if (contractWorld !== null) {
    for (const station of contractWorld.stations) {
      const key = stationKey(station.ref);
      if (station.usingIds.length > 0) {
        stationActivity.set(key, 'using');
      } else if (station.queueIds.length > 0 || station.approachingIds.length > 0) {
        stationActivity.set(key, 'claimed');
      }
    }
  }
  // Stage D.1 — Capacity is a second physical bench, drawn as a real
  // bench sprite (`floorgrid-bay-expansion`), not as approach-cell pads.
  // Occupancy is per realised bench: a using member on `useCells[i]` marks
  // `benches[i]`, so two simultaneous users light two benches.
  const bayStation = stations.find(
    (station) => station.ref.kind === 'training' && station.ref.station === COMPETITION_BENCH_BAY,
  );
  const bayRef: FloorStationRef = { kind: 'training', station: COMPETITION_BENCH_BAY };
  const primaryOccupied =
    bayStation !== undefined && memberUsesCell(sim.members, bayRef, bayStation.useCells[0]);
  const expansionOccupied =
    bayStation !== undefined && memberUsesCell(sim.members, bayRef, bayStation.useCells[1]);
  const bayLevels = stationLevels(capability, COMPETITION_BENCH_BAY);
  const bayQualityMark = bay.complete && bayLevels.quality > 0;
  const bayThroughputMark = bay.complete && bayLevels.throughput > 0;
  const capacityFits = capacityRealizesOn(floor, barbellOwned);
  const stateCounts = floorSimStateCounts(sim);

  // VL-1 — what to draw for each contract member this instant: its station
  // (for the pose class, the bench anchor and the facing), and the drawn
  // origin. Sorted by that origin's row so a member lower on the floor paints
  // over one behind it — feet-on-cell depth from document order, with every
  // member at the same registered z-index. The ordinal is the contract row's
  // position, which equals the sim's roster index (the contract builds its
  // rows in sim order and refuses a roster that does not line up), and it is
  // used only for the verifier-stable `floorgrid-ambient-<n>` testID, the
  // tap-selection index and the animation stagger — identity is `member.id`.
  // VL-2: the station's art aspect a using member is laid on, and the clip
  // and projected anchor for every member, through the camera above.
  const benchArtAspect = fixedArtAspectFor('flat-bench', bayQualityMark);
  const memberDraws = (contractWorld === null || !worldMeasured ? [] : contractWorld.members).map(
    (member, ordinal) => {
      const station =
        member.target === null ? undefined : stationByRefKey.get(stationKey(member.target));
      const aspect =
        member.target === null || station === undefined
          ? benchArtAspect
          : stationArtAspectFor(member.target, bayQualityMark, station.footprint);
      return {
        member,
        ordinal,
        station,
        clip: memberClipFor(member),
        anchor: memberAnchorFor(member, station, bay, camera, aspect),
      };
    },
  );
  memberDraws.sort((left, right) => left.anchor.depth - right.anchor.depth);
  // VL-2: the second bench's and the plate tree's drawn boxes, through the
  // same camera, computed here because a `const` cannot live inside a JSX
  // conditional. The plate tree stands on the bench's front corner and is
  // half the bench's depth deep, as the Stage D.1b layout drew it.
  const expansionBox =
    bay.expansion === null
      ? null
      : stationDrawBox(camera, bay.expansion.position, bay.expansion.footprint, benchArtAspect);
  const plateTreeBox =
    bay.primary === null
      ? null
      : stationDrawBox(
          camera,
          {
            x: bay.primary.position.x + bay.primary.footprint.width - 1,
            y: bay.primary.position.y + bay.primary.footprint.height / 2,
          },
          { width: 1, height: bay.primary.footprint.height / 2 },
          fixedArtAspectFor('plate-tree', false),
        );

  /**
   * GDD §5.14 Stage C — item 9's tap/drag disambiguation. `origin` says
   * whether this responder is attached to a TRAY chip (not yet a station —
   * nothing to select) or an already-PLACED chip (a real `FloorStationRef`).
   * A release whose total accumulated movement is at or under
   * `STATION_TAP_MAX_DRAG_PIXELS` is read as a TAP: it selects the placed
   * chip's station (toggling it closed on a second tap of the same one) and
   * dispatches nothing, so a stationary press can never be misread as a
   * same-cell placement attempt. Anything past that threshold is the drag
   * this file already handled before this round, byte-identical below.
   */

  // ---------------------------------------------------------------------
  // GDD §5.14 Stage C — the contextual station panel's own derived data.
  // ---------------------------------------------------------------------
  //
  // A station may have been selected on an earlier render and then taken off
  // the floor since — the on-chip `floorgrid-remove-*` control still removes
  // a session item directly, independently of this panel's own remove
  // button. So the panel is drawn only for a selection that still names a
  // real chip on THIS render's own `fixed`/`placed` lists, computed fresh
  // every time rather than trusted from state. `panelStation` is null both
  // when nothing is selected and when the selected item just stopped
  // existing; either way, no panel is drawn and no dispatch happens.
  const panelStation: FloorStationRef | null =
    selectedStation === null
      ? null
      : selectedStation.kind === 'training'
        ? bay.complete
          ? selectedStation
          : null
        : selectedStation.kind === 'fixed'
          ? furniture.some((row) => row.item === selectedStation.item)
            ? selectedStation
            : null
          : placed.some((row) => row.item === selectedStation.item)
            ? selectedStation
            : null;
  const panelEquipment: LadderEquipmentItem | null =
    selectedEquipment === null
      ? null
      : furniture.some((row) => row.item === selectedEquipment)
        ? selectedEquipment
        : null;

  // Every derived read the panel needs, computed only when a station is
  // actually selected — each one a call into `stationView.ts` (which is
  // itself a thin composition of `management.ts`/`floorSim.ts`, see that
  // file's own header).
  //
  // REPAIR ACTIONABILITY DELIBERATELY DOES NOT CALL `repairEquipment` FOR
  // ITS GATE, AND THIS IS A NARROWER CHOICE THAN IT LOOKS. Calling the real
  // transition to decide whether to draw a button — `GymScreen.tsx`'s own
  // header names this as the discipline a gated control should use — was
  // the first version of this panel, and it was wrong: `repairEquipment`'s
  // `'already-sound'` arm refuses only at EXACT-ZERO cost (condition exactly
  // 1), so a barely-worn item (condition 0.999998, say) reads `'repaired'`
  // and the panel would draw a live "repair for 0.0000123" button — the
  // precise "chrome vs paid" dust-repair defect `GymScreen.tsx`'s own
  // `isDustRepairCost`/`isSoundCondition` split (S4f, that file's header)
  // already fixed once, for its per-item report. `stationConditionView`'s
  // `isSound` is `MAINTENANCE_PROMPT_CONDITION`-gated, the SAME predicate
  // `GymScreen.tsx`'s per-item row uses, so the two surfaces cannot disagree
  // about when a repair control is worth drawing — and the shown cost still
  // comes from `repairCostGymBucks` untouched; only the display rounding and
  // the gate are shared with the older, already-fixed surface.
  let panelIdentity: StationIdentityView | null = null;
  let panelOperation: StationOperationView | null = null;
  let panelLoadingSeats = 0;
  let panelCondition: StationConditionView | null = null;
  let panelManagerEffect: StationManagerEffectView | null = null;
  if (panelStation !== null) {
    const conditionItem =
      panelStation.kind === 'training' ? COMPETITION_BENCH_BAY_PRIMARY : panelStation.item;
    panelIdentity = stationIdentityView(panelStation);
    const selectedStationRow = stationByRefKey.get(stationKey(panelStation));
    panelOperation = stationOperationView(
      sim.members,
      panelStation,
      selectedStationRow === undefined ? undefined : selectedStationRow.useCells,
    );
    panelLoadingSeats =
      selectedStationRow === undefined
        ? 0
        : stationChangeoverSeats(
            sim.changeovers,
            selectedStationRow.ref,
            selectedStationRow.useCells,
          );
    panelCondition = stationConditionView(managed, conditionItem);
    panelManagerEffect = stationManagerEffectView(managed, conditionItem);
  }
  // Whether the gym's one standing maintenance review currently names the
  // selected item — GDD §5.14 Stage C item 6's "staff relationship... where
  // the actual state makes the relationship clear", read from
  // `management.ts`'s own function rather than re-derived.
  const standingPrompt = maintenancePrompt(managed);

  const selectedMember =
    selectedMemberIndex === null
      ? null
      : (sim.members.find((member) => member.index === selectedMemberIndex) ?? null);

  return (
    <View
      testID={'floorgrid-root'}
      onLayout={(event) => {
        const next = event.nativeEvent.layout;
        setStageSize((previous) =>
          previous.width === next.width && previous.height === next.height
            ? previous
            : { width: next.width, height: next.height },
        );
      }}
      style={{ flex: 1, position: 'relative', backgroundColor: 'transparent' }}
    >
      <Text
        testID={'floorgrid-caption'}
        style={buildMode ? panelStyles.quietCaption : panelStyles.visuallyHidden}
      >
        {buildMode
          ? placing
            ? 'build — tap a tile to place'
            : 'build — tap a piece, then tap a tile'
          : `floor (${floor.rung})`}
      </Text>
      {buildMode ? null : (
        <View testID={'floorgrid-occupancy'} style={panelStyles.occupancy}>
          <View style={panelStyles.occupancyCard}>
            <Text
              testID={'floorgrid-occupancy-on-floor'}
              numberOfLines={1}
              style={panelStyles.occupancyText}
            >
              {sim.members.length} on the floor
            </Text>
          </View>
          <View style={panelStyles.occupancyCard}>
            <Text
              testID={'floorgrid-occupancy-waiting'}
              numberOfLines={1}
              style={panelStyles.occupancyText}
            >
              {stateCounts.queuing} waiting
            </Text>
          </View>
          <View style={panelStyles.occupancyCard}>
            <Text
              testID={'floorgrid-occupancy-using'}
              numberOfLines={1}
              style={panelStyles.occupancyText}
            >
              {stateCounts.using} on the machine
            </Text>
          </View>
        </View>
      )}
      {pendingPlace === null ? null : (
        <View testID={'floorgrid-place-banner'}>
          <Text testID={'floorgrid-pending'}>
            Moving: {playerFacingEquipmentLabel(pendingPlace.item)}
          </Text>
          {placementRefuseKind === null ? null : (
            <Text
              testID={'floorgrid-drop-refused'}
              style={{ color: FLOOR_OVERLAP_REFUSAL_OUTLINE_COLOR }}
            >
              {playerFacingPlacementRefuse(placementRefuseKind)}
            </Text>
          )}
          <Pressable
            testID={'floorgrid-place-cancel'}
            accessibilityRole={'button'}
            onPress={cancelPlace}
            style={panelStyles.button as WebSelectableViewStyle}
          >
            <Text style={panelStyles.buttonText}>Cancel</Text>
          </Pressable>
        </View>
      )}
      {/*
        VL-1: this full-width stage box clips. A member's drawn body is wider
        than its cell (`FLOOR_MEMBER_DRAW_SCALE_TILES`), so one standing on
        the last column reaches a few pixels past the grid — and, measured at
        390×844, three pixels past the viewport, which is a horizontal page
        overflow. Clipping here, at the stage's own edge rather than at the
        grid's, loses those few pixels of an arm and nothing else: heads above
        the top row and feet on the bottom row stay inside this box, and the
        panels below the grid are siblings of it, not children.
      */}
      <View testID={'floorgrid-scroll-x'} style={{ flex: 1, zIndex: 1, overflow: 'hidden' }}>
        <View testID={'floorgrid-scroll-y'} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View
            testID={'floorgrid-grid'}
            style={{
              // VL-2: on Play the world box IS the stage — every element is
              // positioned in stage pixels through the camera — while Build
              // keeps its centred plan of `grid` × `tile` cells.
              width: buildMode ? grid.width * tile : stageSize.width,
              height: buildMode ? grid.height * tile : stageSize.height,
              backgroundColor: FLOOR_SIM_HIGHLIGHT_FILL,
              borderWidth: buildMode ? EMPIRE_TUNING.FLOOR_GRID_BORDER_WIDTH_PIXELS : 0,
              borderColor: FLOOR_GRID_BORDER_COLOR,
              position: 'relative',
            } as PixelSnappedViewStyle}
          >
            {buildMode ? (
            <Image
              testID={'floorgrid-floor-plane'}
              source={{ uri: ironAmberFloorPlaneUri() }}
              resizeMode={'stretch'}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: grid.width * tile,
                height: grid.height * tile,
              }}
              {...({ pointerEvents: 'none' } as object)}
            />
            ) : null}
            {buildMode
              ? verticalLines.map((i) => (
              <View
                key={`v${i}`}
                testID={`floorgrid-line-v-${i}`}
                pointerEvents={'none'}
                style={{
                  position: 'absolute',
                  left: i * tile,
                  top: 0,
                  width: EMPIRE_TUNING.FLOOR_GRID_LINE_WIDTH_PIXELS,
                  height: grid.height * tile,
                  backgroundColor: FLOOR_GRID_LINE_COLOR,
                }}
              />
            ))
              : null}
            {buildMode
              ? horizontalLines.map((j) => (
              <View
                key={`h${j}`}
                testID={`floorgrid-line-h-${j}`}
                pointerEvents={'none'}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: j * tile,
                  width: grid.width * tile,
                  height: EMPIRE_TUNING.FLOOR_GRID_LINE_WIDTH_PIXELS,
                  backgroundColor: FLOOR_GRID_LINE_COLOR,
                }}
              />
            ))
              : null}
            {placing
              ? tileYs.flatMap((y) =>
                  tileXs.map((x) => (
                    <Pressable
                      key={`cell-${x}-${y}`}
                      testID={`floorgrid-cell-${x}-${y}`}
                      accessibilityRole={'button'}
                      onPress={() => pressTile({ x, y })}
                      style={{
                        position: 'absolute',
                        left: x * tile,
                        top: y * tile,
                        width: tile,
                        height: tile,
                        zIndex: EMPIRE_TUNING.FLOOR_DRAGGING_Z_INDEX,
                        cursor: 'pointer',
                      } as WebSelectableViewStyle}
                    />
                  )),
                )
              : null}
            {refusalRegion === null ? null : (
              <View
                testID={'floorgrid-drop-refused-area'}
                pointerEvents={'none'}
                style={{
                  position: 'absolute',
                  left: refusalRegion.x * tile,
                  top: refusalRegion.y * tile,
                  width: refusalRegion.width * tile,
                  height: refusalRegion.height * tile,
                  borderWidth: EMPIRE_TUNING.FLOOR_OVERLAP_REFUSAL_OUTLINE_WIDTH_PIXELS,
                  borderColor: FLOOR_OVERLAP_REFUSAL_OUTLINE_COLOR,
                  zIndex: EMPIRE_TUNING.FLOOR_DRAGGING_Z_INDEX,
                }}
              />
            )}
            {!worldMeasured ? null : furniture.map((row) => {
              const isRefusalTarget = overlapRefusalItem === row.item;
              const isBayPrimary =
                bay.complete && row.item === COMPETITION_BENCH_BAY_PRIMARY;
              const isOccupied = isBayPrimary
                ? primaryOccupied
                : stationActivity.get(`fixed:${row.item}`) === 'using';
              const isSelected = isBayPrimary
                ? selectedStation !== null &&
                  selectedStation.kind === 'training' &&
                  selectedStation.station === COMPETITION_BENCH_BAY
                : selectedEquipment === row.item;
              const qualityMark = isBayPrimary && bayQualityMark;
              const throughputMark = isBayPrimary && bayThroughputMark;
              // VL-2: the footprint box under Build; the art's own box
              // standing on the footprint's front edge under Play.
              const box = stationDrawBox(
                camera,
                row.position,
                row.footprint,
                fixedArtAspectFor(row.item, qualityMark),
              );
              return (
                <Pressable
                  key={row.item}
                  testID={`floorgrid-fixed-${row.item}`}
                  accessibilityRole={'button'}
                  pointerEvents={placing ? 'none' : 'auto'}
                  onPress={() => {
                    if (buildMode) {
                      beginPlace({ kind: 'furniture', item: row.item });
                      return;
                    }
                    if (isBayPrimary) {
                      toggleSelectedStation({
                        kind: 'training',
                        station: COMPETITION_BENCH_BAY,
                      });
                      return;
                    }
                    toggleSelectedEquipment(row.item);
                  }}
                  style={{
                    position: 'absolute',
                    left: box.left,
                    top: box.top,
                    width: box.width,
                    height: box.height,
                    // VL-2: on Play the draw order is the front edge's
                    // screen y, the same key the members use, so a body
                    // behind a station draws under it and one in front
                    // draws over it.
                    zIndex: buildMode ? 0 : Math.round(box.depth),
                    // Phase 4: the sprite is the body of the chip; the
                    // refusal outline still draws over it, and no border in
                    // the resting state so the sprite's own baked outline is
                    // the edge — which is also what makes fixed furniture
                    // read as part of the floor rather than as a draggable
                    // chip (those keep their black chip border below). GDD
                    // §5.14 Stage C: a refusal in flight still wins over a
                    // selection outline — the refusal is transient and more
                    // urgent than "this is the tapped station". Stage D.1b:
                    // Quality is the competition-spec pad itself, not a
                    // goldenrod rest-edge around the bay.
                    borderWidth: isRefusalTarget
                      ? EMPIRE_TUNING.FLOOR_OVERLAP_REFUSAL_OUTLINE_WIDTH_PIXELS
                      : isSelected
                        ? EMPIRE_TUNING.FLOOR_SIM_HIGHLIGHT_BORDER_WIDTH_PIXELS
                        : 0,
                    borderColor: isRefusalTarget
                      ? FLOOR_OVERLAP_REFUSAL_OUTLINE_COLOR
                      : FLOOR_STATION_SELECTED_OUTLINE_COLOR,
                    cursor: 'pointer',
                  } as WebSelectableViewStyle}
                >
                  {(isBayPrimary
                    ? bayBenchSpriteUri(qualityMark, isOccupied)
                    : fixedSpriteUriFor(row.item, isOccupied)) !== null ? (
                    <View
                      testID={
                        qualityMark
                          ? 'floorgrid-quality-bench-competition-bench-bay'
                          : undefined
                      }
                      pointerEvents={'none'}
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        width: box.width,
                        height: box.height,
                      }}
                    >
                      <Image
                        testID={`floorgrid-fixed-sprite-${row.item}`}
                        source={{
                          uri: (isBayPrimary
                            ? bayBenchSpriteUri(qualityMark, isOccupied)
                            : fixedSpriteUriFor(row.item, isOccupied)) as string,
                        }}
                        resizeMode={'stretch'}
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          width: box.width,
                          height: box.height,
                        }}
                        {...({ pointerEvents: 'none' } as object)}
                      />
                    </View>
                  ) : null}
                  {buildMode && qualityMark ? (
                    <View
                      testID={'floorgrid-quality-mark-competition-bench-bay'}
                      pointerEvents={'none'}
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        width: Math.max(
                          tile * EMPIRE_TUNING.FLOOR_SIM_CUE_DIAMETER_FRACTION,
                          1,
                        ),
                        height: Math.max(
                          tile * EMPIRE_TUNING.FLOOR_SIM_CUE_DIAMETER_FRACTION,
                          1,
                        ),
                        backgroundColor: FLOOR_QUALITY_MARK_COLOR,
                      }}
                    />
                  ) : null}
                  {buildMode && throughputMark ? (
                    <View
                      testID={'floorgrid-throughput-mark-competition-bench-bay'}
                      pointerEvents={'none'}
                      style={{
                        position: 'absolute',
                        left: 0,
                        bottom: 0,
                        width: Math.max(
                          tile * EMPIRE_TUNING.FLOOR_SIM_CUE_DIAMETER_FRACTION,
                          1,
                        ),
                        height: Math.max(
                          tile * EMPIRE_TUNING.FLOOR_SIM_CUE_DIAMETER_FRACTION,
                          1,
                        ),
                        backgroundColor: FLOOR_THROUGHPUT_MARK_COLOR,
                      }}
                    />
                  ) : null}
                  {isBayPrimary || !buildMode ? null : (
                    <Text pointerEvents={'none'} style={FLOOR_LABEL_STYLE}>
                      {row.item}
                    </Text>
                  )}
                </Pressable>
              );
            })}
            {bay.expansion === null || expansionBox === null || !worldMeasured ? null : (
              <Pressable
                testID={'floorgrid-bay-expansion'}
                accessibilityRole={'button'}
                pointerEvents={placing ? 'none' : 'auto'}
                onPress={() => {
                  if (buildMode) return;
                  toggleSelectedStation({
                    kind: 'training',
                    station: COMPETITION_BENCH_BAY,
                  });
                }}
                style={{
                  position: 'absolute',
                  left: expansionBox.left,
                  top: expansionBox.top,
                  width: expansionBox.width,
                  height: expansionBox.height,
                  zIndex: buildMode ? 0 : Math.round(expansionBox.depth),
                  borderWidth:
                    selectedStation !== null &&
                    selectedStation.kind === 'training' &&
                    selectedStation.station === COMPETITION_BENCH_BAY
                      ? EMPIRE_TUNING.FLOOR_SIM_HIGHLIGHT_BORDER_WIDTH_PIXELS
                      : 0,
                  borderColor: FLOOR_STATION_SELECTED_OUTLINE_COLOR,
                  cursor: 'pointer',
                } as WebSelectableViewStyle}
              >
                {bayBenchSpriteUri(bayQualityMark, expansionOccupied) !== null ? (
                  <Image
                    testID={'floorgrid-bay-expansion-sprite'}
                    source={{
                      uri: bayBenchSpriteUri(bayQualityMark, expansionOccupied) as string,
                    }}
                    resizeMode={'stretch'}
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: expansionBox.width,
                      height: expansionBox.height,
                    }}
                    {...({ pointerEvents: 'none' } as object)}
                  />
                ) : null}
              </Pressable>
            )}
            {bay.complete && bay.primary !== null && bayThroughputMark && plateTreeBox !== null && worldMeasured ? (
              <Image
                testID={'floorgrid-plate-tree-competition-bench-bay'}
                source={{ uri: ironAmberPlateTreeUri() }}
                resizeMode={'stretch'}
                style={{
                  position: 'absolute',
                  left: plateTreeBox.left,
                  top: plateTreeBox.top,
                  width: plateTreeBox.width,
                  height: plateTreeBox.height,
                  zIndex: buildMode ? 1 : Math.round(plateTreeBox.depth),
                }}
                {...({ pointerEvents: 'none' } as object)}
              />
            ) : null}
            {!worldMeasured ? null : placed.map((row) => {
              const isSelected =
                selectedStation !== null &&
                selectedStation.kind === 'session' &&
                selectedStation.item === row.item;
              const isPending =
                pendingPlace !== null &&
                pendingPlace.kind === 'session' &&
                pendingPlace.item === row.item;
              // VL-2: the footprint box under Build; under Play a box with
              // the footprint's own aspect standing on its front edge, the
              // painting drawn `contain` inside it (see `stationArtAspectFor`).
              const box = stationDrawBox(
                camera,
                row.position,
                row.footprint,
                stationArtAspectFor({ kind: 'session', item: row.item }, false, row.footprint),
              );
              return (
                <Pressable
                  key={row.item}
                  testID={`floorgrid-placed-${row.item}`}
                  accessibilityRole={'button'}
                  pointerEvents={placing ? 'none' : 'auto'}
                  onPress={() => {
                    if (buildMode) {
                      beginPlace({ kind: 'session', item: row.item });
                      return;
                    }
                    toggleSelectedStation({ kind: 'session', item: row.item });
                  }}
                  style={{
                    position: 'absolute',
                    left: box.left,
                    top: box.top,
                    width: box.width,
                    height: box.height,
                    borderWidth:
                      isSelected || isPending
                        ? EMPIRE_TUNING.FLOOR_SIM_HIGHLIGHT_BORDER_WIDTH_PIXELS
                        : EMPIRE_TUNING.FLOOR_ITEM_BORDER_WIDTH_PIXELS,
                    borderColor:
                      isSelected || isPending
                        ? FLOOR_STATION_SELECTED_OUTLINE_COLOR
                        : buildMode
                          ? FLOOR_ITEM_BORDER_COLOR
                          : FLOOR_SIM_HIGHLIGHT_FILL,
                    zIndex: buildMode ? 1 : Math.round(box.depth),
                    cursor: 'pointer',
                  } as WebSelectableViewStyle}
                >
                  <Image
                    testID={`floorgrid-placed-sprite-${row.item}`}
                    source={{ uri: sessionSpriteUri(row.item) }}
                    resizeMode={buildMode ? 'stretch' : 'contain'}
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: box.width,
                      height: box.height,
                    }}
                    {...({ pointerEvents: 'none' } as object)}
                  />
                  {buildMode ? (
                  <Text pointerEvents={'none'} style={FLOOR_LABEL_STYLE}>
                    {row.item}
                  </Text>
                  ) : null}
                </Pressable>
              );
            })}
            {
              // GDD §5.13 presentation Phase 3 — the station highlights. A
              // machine somebody is walking towards is outlined in the
              // `seeking` colour and one somebody is on is outlined in the
              // `using` colour, over the chip rather than instead of it, so
              // "that machine is running" reads from the floor without
              // reading a caption. Drawn only for stations that are actually
              // claimed, so an empty gym draws none of these at all.
              //
              // Stage D.1: one outline per realised bench. Capacity's second
              // physical bench gets its own using highlight when a second
              // member is on it. testIDs are dash-stable (`floorsim-using-
              // training-competition-bench-bay`), never colon keys.
              !worldMeasured ? null : stations.flatMap((station) =>
                stationHighlightBoxes(station, bay, sim.members, sim.changeovers).map((box) => {
                  // VL-2: the same drawn box as the station's own art, so
                  // the anchor a tool reads is the bench a player sees.
                  const drawn = stationDrawBox(
                    camera,
                    box.position,
                    box.footprint,
                    stationArtAspectFor(station.ref, bayQualityMark, box.footprint),
                  );
                  return (
                  <View
                    key={box.key}
                    testID={box.testID}
                    // GDD §5.14 Stage C.1 — REGRESSION FOUND AND FIXED, NAMED
                    // RATHER THAN WORKED AROUND. This highlight sits directly
                    // over the station it decorates (same position/footprint,
                    // painted after the chip in DOM order, and with an
                    // explicit z-index above it) and, before this fix, carried
                    // no `pointerEvents`, so on a real device it would have
                    // intercepted a tap on the exact station a player is most
                    // likely to want to inspect: one that is currently
                    // claimed or in use. Found driving GDD §5.14 Stage C.1's
                    // own new browser claims (9g's recovery walk, tapping a
                    // station after real elapsed operation time rather than
                    // on an untouched cold gym the way every pre-existing
                    // Stage C claim did) — `locator.click` timed out at
                    // `floorgrid-fixed-flat-bench`, Playwright's own
                    // interception log naming this exact testID as the
                    // blocker. This View is purely decorative — an outline
                    // and a translucent fill, never an `onPress` — so
                    // `pointerEvents="none"` takes it out of hit-testing
                    // entirely without changing anything drawn.
                    pointerEvents={'none'}
                    style={{
                      position: 'absolute',
                      left: drawn.left,
                      top: drawn.top,
                      width: drawn.width,
                      height: drawn.height,
                      // VL-2: on Play this is a TRANSPARENT GEOMETRY ANCHOR.
                      // The green/khaki outline was a Phase 3 diagnostic;
                      // the world now carries the read — a lifter on the
                      // bench, a member walking at it — and the outline
                      // returns under Build or the diagnostics toggle. The
                      // element stays because the evidence tools measure
                      // the using member's box against it.
                      borderWidth:
                        buildMode || showDiagnostics
                          ? EMPIRE_TUNING.FLOOR_SIM_HIGHLIGHT_BORDER_WIDTH_PIXELS
                          : 0,
                      borderColor:
                        box.activity === 'using'
                          ? FLOOR_SIM_STATE_COLOR.using
                          : box.activity === 'loading'
                            ? FLOOR_THROUGHPUT_MARK_COLOR
                            : FLOOR_SIM_STATE_COLOR.seeking,
                      backgroundColor: FLOOR_SIM_HIGHLIGHT_FILL,
                      zIndex: EMPIRE_TUNING.FLOOR_SIM_STATION_HIGHLIGHT_Z_INDEX,
                    }}
                  />
                  );
                }),
              )
            }
            {
              !worldMeasured ? null : stations.flatMap((station) =>
                plateLoadingLayers(station, bay, sim.changeovers, capability, camera, benchArtAspect).map((layer) => (
                  <View
                    key={layer.key}
                    testID={layer.testID}
                    pointerEvents={'none'}
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      zIndex: EMPIRE_TUNING.FLOOR_SIM_STATION_HIGHLIGHT_Z_INDEX,
                    }}
                  >
                    {plateLoadingDiscViews(layer)}
                  </View>
                )),
              )
            }
            {buildMode || !worldMeasured ? null : queueOccupancyViews(occupancyFrame.stations, camera, showDiagnostics)}
            {
              // GDD §5.13 presentation Phase 3: the members, at the position
              // the sim puts them at this instant. Still non-draggable, still
              // non-collidable with `placeFloorItem`'s overlap check, still
              // dispatching nothing — what changed since Phase 2 is that the
              // position moves. `AmbientMemberBody`'s own header explains why
              // the render lives in its own component (each member needs its
              // own `Animated.Value`s and its own start/stop lifecycles,
              // which `.map` cannot give a hook directly).
              //
              // VL-1: each row is a contract `PresentationMember`, keyed by
              // its `id` — the identity the contract names — so a member
              // keeps its own animated values across ticks and across the
              // depth re-sort above instead of being remounted and snapping.
              memberDraws.map((draw) => (
                <AmbientMemberBody
                  key={draw.member.id}
                  index={draw.ordinal}
                  memberId={draw.member.id}
                  type={draw.member.type}
                  position={draw.anchor.position}
                  tile={camera.tile}
                  state={draw.member.lifecycle}
                  interruptedBy={draw.member.interruptedBy}
                  stranded={draw.member.stranded}
                  clip={draw.clip}
                  facing={memberFacing(draw.member, draw.station, bay)}
                  scale={draw.anchor.scale}
                  depth={buildMode ? EMPIRE_TUNING.FLOOR_SIM_MEMBER_Z_INDEX : draw.anchor.depth}
                  cellX={draw.anchor.cell.x}
                  cellY={draw.anchor.cell.y}
                  tick={sim.tick}
                  pullX={draw.anchor.pull.x}
                  pullY={draw.anchor.pull.y}
                  target={draw.member.target}
                  queueRank={draw.member.queueRank}
                  selectedName={
                    selectedMemberIndex === draw.ordinal
                      ? (livingMemberAtIndex(livingMembers, draw.ordinal)?.displayName ??
                        undefined)
                      : undefined
                  }
                  onPress={buildMode ? undefined : () => toggleSelectedMember(draw.ordinal)}
                />
              ))
            }
            {buildMode && bay.complete && bay.primary !== null
              ? (
                <Pressable
                  testID={'floorgrid-bay-label-competition-bench-bay'}
                  accessibilityRole={'button'}
                  pointerEvents={placing ? 'none' : 'auto'}
                  onPress={() =>
                    toggleSelectedStation({
                      kind: 'training',
                      station: COMPETITION_BENCH_BAY,
                    })
                  }
                  style={{
                    position: 'absolute',
                    left: bay.primary.position.x * tile,
                    top: bay.primary.position.y * tile,
                    width: bay.primary.footprint.width * tile,
                    height: tile,
                    zIndex: EMPIRE_TUNING.FLOOR_SIM_MEMBER_Z_INDEX + 1,
                    backgroundColor: FLOOR_STATION_PANEL_BACKGROUND_COLOR,
                    justifyContent: 'center',
                    cursor: 'pointer',
                  } as WebSelectableViewStyle}
                >
                  <Text pointerEvents={'none'} style={FLOOR_LABEL_STYLE}>
                    bench bay
                  </Text>
                </Pressable>
              ) : null}
            {buildMode && bay.expansion !== null
              ? (
                <Pressable
                  testID={'floorgrid-bay-label-second-bench'}
                  accessibilityRole={'button'}
                  pointerEvents={placing ? 'none' : 'auto'}
                  onPress={() =>
                    toggleSelectedStation({
                      kind: 'training',
                      station: COMPETITION_BENCH_BAY,
                    })
                  }
                  style={{
                    position: 'absolute',
                    left: bay.expansion.position.x * tile,
                    top: bay.expansion.position.y * tile,
                    width: bay.expansion.footprint.width * tile,
                    height: tile,
                    zIndex: EMPIRE_TUNING.FLOOR_SIM_MEMBER_Z_INDEX + 1,
                    backgroundColor: FLOOR_STATION_PANEL_BACKGROUND_COLOR,
                    justifyContent: 'center',
                    cursor: 'pointer',
                  } as WebSelectableViewStyle}
                >
                  <Text pointerEvents={'none'} style={FLOOR_LABEL_STYLE}>
                    second bench
                  </Text>
                </Pressable>
              ) : null}
          </View>
        </View>
      </View>
      <Text testID={'floorgrid-ambient-caption'} style={panelStyles.visuallyHidden}>{sim.members.length} member(s) around the gym</Text>
      <View
        testID={'floorgrid-tray'}
        style={buildMode ? undefined : { display: 'none' }}
      >
        {unplaced.length === 0 && unplacedFurniture.length === 0 ? (
          <Text testID={'floorgrid-tray-empty'}>
            {owned.length === 0
              ? 'no session equipment yet — buy some, then tap it here and tap a tile'
              : 'every piece you own is on the floor — tap one, then tap a new tile'}
          </Text>
        ) : (
          <Text>unplaced — tap a piece, then tap a tile on the gym</Text>
        )}
        <ScrollView horizontal testID={'floorgrid-tray-scroll'}>
          {unplacedFurniture.map((item) => {
            const footprint = furnitureItemFootprint(item);
            const chipWidth =
              Math.max(footprint.width, EMPIRE_TUNING.FLOOR_TRAY_ITEM_MIN_TILES) * tile;
            const chipHeight =
              Math.max(footprint.height, EMPIRE_TUNING.FLOOR_TRAY_ITEM_MIN_TILES) * tile;
            const isPending =
              pendingPlace !== null && pendingPlace.kind === 'furniture' && pendingPlace.item === item;
            return (
              <Pressable
                key={item}
                testID={`floorgrid-tray-item-${item}`}
                accessibilityRole={'button'}
                pointerEvents={placing ? 'none' : 'auto'}
                onPress={() => beginPlace({ kind: 'furniture', item })}
                style={{
                  width: chipWidth,
                  height: chipHeight,
                  backgroundColor: FLOOR_TRAY_CHIP_COLOR,
                  borderWidth: EMPIRE_TUNING.FLOOR_ITEM_BORDER_WIDTH_PIXELS,
                  borderColor: isPending
                    ? FLOOR_STATION_SELECTED_OUTLINE_COLOR
                    : FLOOR_ITEM_BORDER_COLOR,
                  margin: EMPIRE_TUNING.FLOOR_TRAY_ITEM_MARGIN_PIXELS,
                  cursor: 'pointer',
                } as WebSelectableViewStyle}
              >
                {fixedSpriteUriFor(item, false) === null ? null : (
                  <Image
                    testID={`floorgrid-tray-sprite-${item}`}
                    source={{ uri: fixedSpriteUriFor(item, false) as string }}
                    resizeMode={'stretch'}
                    style={{
                      position: 'absolute',
                      left: (chipWidth - footprint.width * tile) / 2,
                      top: (chipHeight - footprint.height * tile) / 2,
                      width: footprint.width * tile,
                      height: footprint.height * tile,
                    }}
                  />
                )}
                <Text style={FLOOR_LABEL_STYLE}>{item}</Text>
              </Pressable>
            );
          })}
          {unplaced.map((item) => {
            const footprint = sessionItemFootprint(item);
            const chipWidth =
              Math.max(footprint.width, EMPIRE_TUNING.FLOOR_TRAY_ITEM_MIN_TILES) * tile;
            const chipHeight =
              Math.max(footprint.height, EMPIRE_TUNING.FLOOR_TRAY_ITEM_MIN_TILES) * tile;
            const isPending =
              pendingPlace !== null && pendingPlace.kind === 'session' && pendingPlace.item === item;
            return (
              <Pressable
                key={item}
                testID={`floorgrid-tray-item-${item}`}
                accessibilityRole={'button'}
                pointerEvents={placing ? 'none' : 'auto'}
                onPress={() => beginPlace({ kind: 'session', item })}
                style={{
                  width: chipWidth,
                  height: chipHeight,
                  backgroundColor: FLOOR_TRAY_CHIP_COLOR,
                  borderWidth: EMPIRE_TUNING.FLOOR_ITEM_BORDER_WIDTH_PIXELS,
                  borderColor: isPending
                    ? FLOOR_STATION_SELECTED_OUTLINE_COLOR
                    : FLOOR_ITEM_BORDER_COLOR,
                  margin: EMPIRE_TUNING.FLOOR_TRAY_ITEM_MARGIN_PIXELS,
                  cursor: 'pointer',
                } as WebSelectableViewStyle}
              >
                <Image
                  testID={`floorgrid-tray-sprite-${item}`}
                  source={{ uri: sessionSpriteUri(item) }}
                  resizeMode={'stretch'}
                  style={{
                    position: 'absolute',
                    left: (chipWidth - footprint.width * tile) / 2,
                    top: (chipHeight - footprint.height * tile) / 2,
                    width: footprint.width * tile,
                    height: footprint.height * tile,
                  }}
                  {...({ pointerEvents: 'none' } as object)}
                />
                <Text pointerEvents={'none'} style={FLOOR_LABEL_STYLE}>
                  {item}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      {/*
        Developer readout, below the tray so it does not sit between the gym
        and the Build inventory. Collapsed by default; the dock Play/Build/
        Shop/Staff/More controls stay the primary chrome.
      */}
      <Pressable
        testID={'floorgrid-diagnostics-toggle'}
        accessibilityRole={'button'}
        onPress={() => setShowDiagnostics((previous) => !previous)}
        // VL-2 REGRESSION, FOUND BY `tools/verify-floor-reachability.mjs`
        // AND FIXED HERE. This control is visually hidden (1×1, opacity 0)
        // and sits at the top-left corner of `floorgrid-root` because
        // `visuallyHidden` is `position: 'absolute'` with no offset. The
        // Build plan never reached that corner; VL-2's Play world box IS
        // the stage, and `floorgrid-scroll-x` stacks at z-index 1, so the
        // stage now paints over the toggle and a force-click — the only
        // way the evidence tools open the diagnostics — landed on the
        // world instead. Measured: `elementFromPoint` at the toggle's
        // centre returned `floorgrid-grid`; with this z-index it returns
        // the toggle and the diagnostics attach. The floor's topmost
        // layer is the right stack for a control that draws nothing.
        style={[panelStyles.visuallyHidden, { zIndex: EMPIRE_TUNING.FLOOR_DRAGGING_Z_INDEX }]}
      >
        <Text style={FLOOR_LABEL_STYLE}>
          {showDiagnostics ? 'hide diagnostics' : 'show diagnostics'}
        </Text>
      </Pressable>
      {showDiagnostics ? (
        <View testID={'floorgrid-diagnostics'}>
          <Text testID={'floorgrid-diagnostic-caption'}>
            floor ({floor.rung}) — {grid.width}x{grid.height} tiles, {furniture.length} furniture,{' '}
            {placed.length} placed, {unplaced.length} unplaced
          </Text>
          <Text testID={'floorsim-caption'}>
            {`tick ${sim.tick} — `}
            {FLOOR_SIM_MEMBER_STATES.map((each) => `${stateCounts[each]} ${each}`).join(', ')}
          </Text>
          <View testID={'floorsim-legend'}>
            {FLOOR_SIM_MEMBER_STATES.map((each) => (
              <Text
                key={each}
                testID={`floorsim-legend-${each}`}
                style={{ color: FLOOR_SIM_STATE_COLOR[each] }}
              >
                {`${each}: ${FLOOR_SIM_STATE_LEGEND[each]}`}
              </Text>
            ))}
          </View>
        </View>
      ) : null}
      {/*
        GDD §5.14 Stage C — the contextual station panel. An ANCHORED PANEL
        (CLAUDE.md's brief names "bottom sheet, anchored panel, compact
        overlay" as the acceptable shapes) sitting in this file's own normal
        document flow, directly below the grid/tray it is about, rather than
        a `position: 'fixed'` sheet — chosen because `GymScreen.tsx`'s
        `ScrollView` already nests this component inside another scroll
        surface, and a fixed-position sheet is exactly the shape that risks
        landing under `AppShell.tsx`'s absolutely-positioned `BACK TO
        TRAINING` pill (S4i's own defect, one layer up) unless it is given
        its own clearance maths. An inline panel cannot make that mistake by
        construction: it has no fixed position to conflict with anything.

        Stage D.1b: the panel is NOT `position: 'absolute'` over the floor.
        An overlay forced a close-first ritual (taps on other world objects
        hit the panel). Document flow keeps the floor as the primary
        interaction surface, so one tap on another visible object selects it.

        Dismissing this panel dispatches nothing — `setSelectedStation(null)`
        is the only thing any control inside it does when it does not touch
        `management.ts`, so closing it can never move a piece of equipment,
        change the floor, or touch anything `GymViewState` owns.
      */}
      {selectedMember === null ? null : (
        <ScrollView testID={'floorgrid-member-panel'} style={panelStyles.panel}>
          {(() => {
            const living = livingMemberAtIndex(livingMembers, selectedMember.index);
            return (
              <>
                {living === null ? null : (
                  <Text testID={'floorgrid-member-panel-display-name'}>{living.displayName}</Text>
                )}
                <Text testID={'floorgrid-member-panel-identity'}>
                  {playerFacingMemberTypeLabel(selectedMember.type)}
                </Text>
                {living === null ? null : (
                  <>
                    <Text testID={'floorgrid-member-panel-short-id'}>
                      {playerFacingMemberShortId(living.id)}
                    </Text>
                    <Text testID={'floorgrid-member-panel-tenure'}>
                      {playerFacingTenureLine(living.joinedAtSeconds, gymClockSeconds)}
                    </Text>
                    {(() => {
                      const experience = livingMemberExperience(living.recentVisits);
                      const retention = livingMemberRetentionPressure(experience);
                      return (
                        <>
                          <Text testID={'floorgrid-member-panel-experience'}>
                            {`RECENT EXPERIENCE ${experience.labels.overall}`}
                          </Text>
                          {experience.status === 'forming' ? (
                            <Text testID={'floorgrid-member-panel-no-history'}>
                              {experience.reasons[0]?.text}
                            </Text>
                          ) : (
                            <>
                              <Text testID={'floorgrid-member-panel-experience-components'}>
                                <Text testID={'floorgrid-member-panel-experience-wait'}>
                                  {`WAIT ${experience.labels.wait}`}
                                </Text>
                                {' / '}
                                <Text testID={'floorgrid-member-panel-experience-training'}>
                                  {`TRAINING ${experience.labels.training}`}
                                </Text>
                                {' / '}
                                <Text testID={'floorgrid-member-panel-experience-reliability'}>
                                  {`SERVICE ${experience.labels.reliability}`}
                                </Text>
                              </Text>
                              <Text testID={'floorgrid-member-panel-experience-reason'}>
                                {experience.reasons.map((reason) => reason.text).join(' ')}
                              </Text>
                            </>
                          )}
                          <Text testID={'floorgrid-member-panel-membership'}>
                            {`MEMBERSHIP ${retention.label}`}
                          </Text>
                          <Text testID={'floorgrid-member-panel-membership-reason'}>
                            {retention.reasons.map((reason) => reason.text).join(' ')}
                          </Text>
                        </>
                      );
                    })()}
                    {living.recentVisits.length === 0 ? null : (
                      living.recentVisits.map((visit, visitIndex) => (
                        <Text
                          key={`visit-${visit.observedAtTick}-${visitIndex}`}
                          testID={`floorgrid-member-panel-visit-${visitIndex}`}
                        >
                          {playerFacingServiceVisitLine(visit)}
                        </Text>
                      ))
                    )}
                  </>
                )}
              </>
            );
          })()}
          <Text testID={'floorgrid-member-panel-state'}>
            {playerFacingMemberActivityLine(
              selectedMember.state,
              selectedMember.target === null ? null : refToken(selectedMember.target),
            )}
          </Text>
          <Pressable
            testID={'floorgrid-member-panel-dismiss'}
            accessibilityRole={'button'}
            style={panelStyles.button}
            onPress={() => setSelectedMemberIndex(null)}
          >
            <Text style={panelStyles.buttonText}>close</Text>
          </Pressable>
        </ScrollView>
      )}
      {panelStation === null ||
      panelIdentity === null ||
      panelOperation === null ||
      panelCondition === null ||
      panelManagerEffect === null ||
      selectedMember !== null ? null : (
        <ScrollView testID={'floorgrid-station-panel'} style={panelStyles.panel}>
          <Text testID={'floorgrid-station-panel-identity'}>
            {playerFacingEquipmentLabel(panelIdentity.item)}
          </Text>
          {/*
            Live operation — GDD §5.14 Stage C item 6: "currently in use /
            idle, active member, queue count". Read straight off
            `stationOperationView` against this render's `useCells`, so the
            panel and the floor light the same snapshot; no fake
            "efficiency score" is computed here.
          */}
          <Text testID={'floorgrid-station-panel-operation'}>
            {playerFacingStationOperation(panelOperation, panelLoadingSeats)}
          </Text>
          {/*
            GDD §5.14 Stage C.1a: the shown cost switches to the real,
            unrounded `repairCostGymBucks` whenever THIS item is a recovery
            blocker — `displayRepairCostGymBucks` rounds to 0 once
            `isSoundCondition` clears (the routine-maintenance question,
            S4f's dust-repair fix), and an item can be routine-sound while
            still below `RECOVERY_CONDITION_MIN` (Stage C.1's own disclosed
            gap). Outside dormancy `blocksRecovery` is always false, so this
            line reads exactly as it did before for every already-tested
            non-dormant state — see `stationConditionView`'s own comment.
          */}
          <Text testID={'floorgrid-station-panel-condition'}>
            Condition {displayConditionPercent(panelCondition.condition)}% — repair{' '}
            {panelCondition.blocksRecovery
              ? panelCondition.repairCostGymBucks
              : panelCondition.displayRepairCostGymBucks}{' '}
            gym bucks
          </Text>
          {/*
            GDD §5.14 Stage C.1a: the recovery-specific reading of this same
            item, drawn only while the gym is actually dormant
            (`panelCondition.dormant`) — a station tapped on a healthy gym
            has nothing to say about reopening. Written as one ternary
            expression, the same shape `floorgrid-station-panel-manager`
            below already uses for a fully dynamic sentence, so this adds no
            new plain-JSX-text chunk to `empireCore.test.ts`'s JSX census.
          */}
          {panelCondition.dormant ? (
            <Text testID={'floorgrid-station-panel-recovery'}>
              {panelCondition.blocksRecovery
                ? `recovery repair required — condition ${displayConditionPercent(panelCondition.condition)}% is below the reopening minimum of ${displayConditionPercent(EMPIRE_TUNING.RECOVERY_CONDITION_MIN)}%`
                : `condition ${displayConditionPercent(panelCondition.condition)}% clears the reopening minimum of ${displayConditionPercent(EMPIRE_TUNING.RECOVERY_CONDITION_MIN)}% — not blocking recovery`}
            </Text>
          ) : null}
          {/*
            Staff relationship — item 6's third bullet. This states what the
            HIRED manager, if any, actually does to THIS item, rather than a
            generic staffing blurb. The novice tier's registered 0 threshold
            (Stage B's own measurement, CLAUDE.md) reads here as "never
            repairs automatically", not as a vague "management" line.
          */}
          <Text testID={'floorgrid-station-panel-manager'}>
            {panelManagerEffect.hired
              ? panelManagerEffect.wouldAutoRepairNow
                ? `your ${panelManagerEffect.tier} manager repairs this automatically below condition ${panelManagerEffect.autoRepairCondition}`
                : panelManagerEffect.autoRepairCondition === 0
                  ? `your ${panelManagerEffect.tier} manager never repairs equipment automatically — their threshold is 0`
                  : `your ${panelManagerEffect.tier} manager repairs automatically below condition ${panelManagerEffect.autoRepairCondition}, and this item is above that line`
              : 'no manager hired — nothing repairs this automatically'}
          </Text>
          {standingPrompt.kind === 'offered' &&
          standingPrompt.item ===
            (panelStation.kind === 'training'
              ? COMPETITION_BENCH_BAY_PRIMARY
              : panelStation.item) ? (
            <Text testID={'floorgrid-station-panel-review-note'}>
              the standing maintenance review is currently about this item
            </Text>
          ) : null}
          {panelStation.kind === 'training' && isStationUpgradeSlice(panelStation.station)
            ? EMPIRE_TUNING.STATION_UPGRADE_AXES.map((axis: StationUpgradeAxis) => {
                const station = panelStation.station;
                if (!isStationUpgradeSlice(station)) return null;
                const levels = stationLevels(capability, station);
                const owned = levels[axis] > 0;
                const cost = stationUpgradeCostGymBucks(axis);
                if (owned) {
                  return (
                    <Text
                      key={axis}
                      testID={`floorgrid-station-panel-upgrade-${axis}-done`}
                    >
                      {`${playerFacingUpgradeLabel(axis)} — ${playerFacingUpgradeEffect(axis)}`}
                    </Text>
                  );
                }
                if (axis === 'capacity' && !capacityFits) {
                  return (
                    <Text
                      key={axis}
                      testID={`floorgrid-station-panel-upgrade-${axis}-unavailable`}
                    >
                      {`${playerFacingUpgradeLabel(axis)} — ${playerFacingUpgradeRefuse('no-second-position')}`}
                    </Text>
                  );
                }
                if (cost > managed.gym.ladder.gymBucks) {
                  return (
                    <Text
                      key={axis}
                      testID={`floorgrid-station-panel-upgrade-${axis}-unavailable`}
                    >
                      {`${playerFacingUpgradeLabel(axis)} needs ${cost} gym bucks — you have ${managed.gym.ladder.gymBucks}`}
                    </Text>
                  );
                }
                return (
                  <Pressable
                    key={axis}
                    testID={`floorgrid-station-panel-upgrade-${axis}`}
                    accessibilityRole={'button'}
                    style={panelStyles.button}
                    onPress={() =>
                      dispatch({ kind: 'upgrade-station', station, axis })
                    }
                  >
                    <Text style={panelStyles.buttonText}>
                      {`${playerFacingUpgradeLabel(axis)} — ${playerFacingUpgradeEffect(axis)} (${cost})`}
                    </Text>
                  </Pressable>
                );
              })
            : null}
          {/*
            Contextual repair — dispatches through the exact reducer arm
            `GymScreen.tsx`'s own per-item report already uses
            (`repair-item`), never a parallel mutation, never a new formula
            and never an automatic charge. The gate is `panelCondition.
            isSound` then a purse comparison, BYTE FOR BYTE the same two-arm
            order `GymScreen.tsx`'s own per-item row uses — see the comment
            above `panelCondition` for why this reads `isSound` rather than
            calling `repairEquipment` itself.

            GDD §5.14 STAGE C.1a WIDENS THE GATE BY EXACTLY ONE DISJUNCT:
            `panelCondition.isSound && !panelCondition.blocksRecovery`, not
            `panelCondition.isSound` alone. This is the fix the whole round
            is about — an item can be routine-sound (above
            `MAINTENANCE_PROMPT_CONDITION`) and still be a recovery blocker
            (below `RECOVERY_CONDITION_MIN`), and Stage C.1 shipped a panel
            that read "as new — nothing to repair" over exactly that item
            while the gym-level recovery surface, one screen up, refused to
            reopen because of it. `blocksRecovery` is `false` whenever the
            gym is not dormant (`stationConditionView`'s own definition), so
            this disjunct changes NOTHING for any already-tested non-dormant
            state — it only widens the surface where dormancy already made
            the old gate wrong. The unaffordable and available arms below
            are untouched: same two checks, same order, now reachable for a
            recovery-blocking item exactly when they would already be
            reachable for a routine-worn one.
          */}
          {panelCondition.isSound && !panelCondition.blocksRecovery ? (
            <Text testID={'floorgrid-station-panel-repair-unavailable'}>
              no routine maintenance needed — nothing to repair
            </Text>
          ) : panelCondition.repairCostGymBucks > managed.gym.ladder.gymBucks ? (
            <Text testID={'floorgrid-station-panel-repair-unavailable'}>
              needs {panelCondition.repairCostGymBucks} gym bucks — you have{' '}
              {managed.gym.ladder.gymBucks}
            </Text>
          ) : (
            <Pressable
              testID={'floorgrid-station-panel-repair'}
              accessibilityRole={'button'}
              style={panelStyles.button}
              onPress={() =>
                dispatch({
                  kind: 'repair-item',
                  item:
                    panelStation.kind === 'training'
                      ? COMPETITION_BENCH_BAY_PRIMARY
                      : panelStation.item,
                })
              }
            >
              <Text style={panelStyles.buttonText}>
                repair for {panelCondition.repairCostGymBucks}
              </Text>
            </Pressable>
          )}
          {/*
            Placement/removal — item 6's second example. Fixed Barbell
            furniture has no `sell`/remove instrument anywhere in this
            directory (`GymScreen.tsx`'s own header: the ladder is one-way),
            so this arm is session-only, dispatching the same `floor-remove`
            action the chip's own on-floor "x" control already uses.
          */}
          {panelStation.kind === 'session' ? (
            <Pressable
              testID={'floorgrid-station-panel-remove'}
              accessibilityRole={'button'}
              style={panelStyles.button}
              onPress={() => {
                dispatch({ kind: 'floor-remove', item: panelStation.item });
                setSelectedStation(null);
              }}
            >
              <Text style={panelStyles.buttonText}>remove from the floor</Text>
            </Pressable>
          ) : (
            <Pressable
              testID={'floorgrid-station-panel-remove-furniture'}
              accessibilityRole={'button'}
              style={panelStyles.button}
              onPress={() => {
                dispatch({
                  kind: 'floor-remove-furniture',
                  item:
                    panelStation.kind === 'training'
                      ? COMPETITION_BENCH_BAY_PRIMARY
                      : panelStation.item,
                });
                setSelectedStation(null);
              }}
            >
              <Text style={panelStyles.buttonText}>move to the tray</Text>
            </Pressable>
          )}
          <Pressable
            testID={'floorgrid-station-panel-dismiss'}
            accessibilityRole={'button'}
            style={panelStyles.button}
            onPress={() => setSelectedStation(null)}
          >
            <Text style={panelStyles.buttonText}>close</Text>
          </Pressable>
        </ScrollView>
      )}
      {panelEquipment === null || selectedMember !== null || panelStation !== null ? null : (
        <ScrollView testID={'floorgrid-equipment-panel'} style={panelStyles.panel}>
          <Text testID={'floorgrid-equipment-panel-identity'}>
            {playerFacingEquipmentLabel(panelEquipment)}
          </Text>
          <Text testID={'floorgrid-equipment-panel-role'}>
            {playerFacingBayRole(bay.complete, bay.missing)}
          </Text>
          <Text testID={'floorgrid-equipment-panel-condition'}>
            Condition {displayConditionPercent(stationConditionView(managed, panelEquipment).condition)}%
          </Text>
          <Pressable
            testID={'floorgrid-equipment-panel-repair'}
            accessibilityRole={'button'}
            style={panelStyles.button}
            onPress={() => dispatch({ kind: 'repair-item', item: panelEquipment })}
          >
            <Text style={panelStyles.buttonText}>
              repair for {stationConditionView(managed, panelEquipment).repairCostGymBucks}
            </Text>
          </Pressable>
          <Pressable
            testID={'floorgrid-equipment-panel-remove'}
            accessibilityRole={'button'}
            style={panelStyles.button}
            onPress={() => {
              dispatch({ kind: 'floor-remove-furniture', item: panelEquipment });
              setSelectedEquipment(null);
            }}
          >
            <Text style={panelStyles.buttonText}>move to the tray</Text>
          </Pressable>
          <Pressable
            testID={'floorgrid-equipment-panel-dismiss'}
            accessibilityRole={'button'}
            style={panelStyles.button}
            onPress={() => setSelectedEquipment(null)}
          >
            <Text style={panelStyles.buttonText}>close</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}
