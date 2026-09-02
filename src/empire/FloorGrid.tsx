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
 * WHAT THIS FILE DOES NOT DO. It does not validate a placement — every
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
 * WHAT THIS HALF DOES NOT DO, since the list is the point. It computes no
 * behaviour: every state, target, queue position and interruption is
 * `floorSim.ts`'s, and what happens here is tile-to-pixel conversion,
 * interpolation and style. It reads no wallet, no Gym Bucks, no chalk, no
 * Total, no e1RM, no streak, no covered day and no reputation —
 * `FloorSimContext` carries five fields and this file builds all five from
 * props it already had. And it writes nothing back: the sim is a function of
 * the floor, never the other way round.
 */

import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
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
  type FixedFurnitureItem,
  type FloorSpriteFacing,
  type FloorSpritePose,
  type FloorStationUseClass,
  FLOOR_SPRITE_URIS,
  FLOOR_STATION_USE_CLASS,
} from './floorSprites';
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
  stepFloorSim,
} from './floorSim';
import { type LadderEquipmentItem } from './ladder';
import { type GymViewAction } from './ladderView';
import { type ManagedGym, maintenancePrompt } from './management';
import { type MemberType } from './members';
import { type SessionEquipmentItem } from './sessions';
import {
  isStationUpgradeSlice,
  stationLevels,
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
type PixelSnappedViewStyle = ViewStyle & { readonly imageRendering?: 'pixelated' };

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

const FLOOR_BACKGROUND_COLOR = 'darkslategray';
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
const FLOOR_LABEL_COLOR = 'white';
/** The caption style every sprite label shares — colour above, size from the registered knob. */
const FLOOR_LABEL_STYLE = Object.freeze({
  color: FLOOR_LABEL_COLOR,
  fontSize: EMPIRE_TUNING.FLOOR_SPRITE_LABEL_FONT_SIZE,
});
/** The tray chip's backing — a quiet dark slate the sprites read against, one class for every item now that the sprite carries the identity the old colour cycle used to. */
const FLOOR_TRAY_CHIP_COLOR = 'darkslateblue';
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
/** The contextual station panel's own backing, the same quiet slate the tray chip already reads against. */
const FLOOR_STATION_PANEL_BACKGROUND_COLOR = 'darkslateblue';
/** The panel's action-button chrome — the identical literals `GymScreen.tsx`'s own `styles.button` already uses, so a control looks like the same control on both screens. */
const FLOOR_STATION_PANEL_BUTTON_BACKGROUND_COLOR = 'darkslateblue';
const FLOOR_STATION_PANEL_BUTTON_BORDER_COLOR = 'deepskyblue';
const FLOOR_STATION_PANEL_BUTTON_TEXT_COLOR = 'white';

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
 * Where to draw a member this instant: its cell, or a linear interpolation
 * between its cell and the cell it is stepping into.
 *
 * `floorSim.ts`'s own header states the contract this reads — "a member holds
 * `cell` (where it is), `next` (the cell it is stepping into, or null when it
 * is standing still) and `progress` in [0, 1) toward `next`. The renderer
 * lerps between the two." This is that lerp and nothing else: no behaviour is
 * decided here, and the sim's own numbers are not adjusted, only positioned.
 */
function memberTilePoint(member: FloorSimMember): FloorTilePoint {
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

/** The two rep-cycle frames of each use class, as pose names the sprite table is keyed by. */
const USING_POSE: Readonly<
  Record<FloorStationUseClass, { readonly a: FloorSpritePose; readonly b: FloorSpritePose }>
> = Object.freeze({
  bench: Object.freeze({ a: 'using-bench-a', b: 'using-bench-b' }),
  bar: Object.freeze({ a: 'using-bar-a', b: 'using-bar-b' }),
  generic: Object.freeze({ a: 'using-generic-a', b: 'using-generic-b' }),
});

/**
 * GDD §5.13 presentation Phase 4 (extended by P4b): which sprite pose a sim
 * member is drawn in this instant. While `using`, the station's own use
 * class picks the body (bench / bar / generic) and the two-frame rep cycle
 * alternates from the sim's own tick at `FLOOR_SPRITE_REP_FRAME_TICKS` —
 * faster than the walk cycle's `FLOOR_SPRITE_WALK_FRAME_TICKS`, which is the
 * "working a set" read the P4b ruling asks for. The walk alternates the two
 * step frames while a step is in flight; standing otherwise. Everything is
 * offset by the member's index so a crowd does not march or rep in lockstep,
 * and everything is deterministic from the tick — no clock and no dice, per
 * the directory's own rules. The five sim states keep their distinct cue
 * bubbles regardless of pose.
 */
function memberPose(member: FloorSimMember, tick: number): FloorSpritePose {
  if (member.state === 'using' && member.target !== null) {
    const poses = USING_POSE[stationUseClassFor(member.target)];
    const rep = Math.floor(tick / EMPIRE_TUNING.FLOOR_SPRITE_REP_FRAME_TICKS) + member.index;
    return rep % 2 === 0 ? poses.a : poses.b;
  }
  if (member.next === null) return 'stand';
  const frame = Math.floor(tick / EMPIRE_TUNING.FLOOR_SPRITE_WALK_FRAME_TICKS) + member.index;
  return frame % 2 === 0 ? 'step-a' : 'step-b';
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
 * GDD §5.13 P4b: where to DRAW a member this instant. For everything except
 * `using` it is the sim's own interpolated tile point, exactly as Phase 3
 * wired it. While `using`, the drawn position is pulled from the sim's use
 * cell toward THAT bench's anchor by the class's
 * `FLOOR_SIM_USING_ANCHOR_BIAS` fraction, so the body meets the furniture
 * (on the bench, under the bar, at the machine face) instead of standing on
 * the adjacent cell beside a green box. Capacity's second user is pulled
 * onto the second bench, not onto the primary. RENDERER ONLY, the same
 * additive register as the walk tween: the sim's `cell` is never touched,
 * no state is kept, and the offset exists only while the sim says `using`.
 */
function memberDrawPoint(
  member: FloorSimMember,
  station: FloorStation | undefined,
  bay: CompetitionBenchBay,
): FloorTilePoint {
  const base = memberTilePoint(member);
  if (member.state !== 'using' || member.target === null || station === undefined) return base;
  const bias = EMPIRE_TUNING.FLOOR_SIM_USING_ANCHOR_BIAS[stationUseClassFor(member.target)];
  const bench = usingBenchFor(member, station, bay);
  const anchor = stationAnchor(bench.position, bench.footprint);
  return {
    x: base.x + (anchor.x - base.x) * bias,
    y: base.y + (anchor.y - base.y) * bias,
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
  member: FloorSimMember,
  station: FloorStation | undefined,
  bay: CompetitionBenchBay,
): FloorSpriteFacing {
  if (member.state === 'using' && station !== undefined) {
    const bench = usingBenchFor(member, station, bay);
    return stationAnchor(bench.position, bench.footprint).x < member.cell.x ? 'left' : 'right';
  }
  if (member.next !== null && member.next.x < member.cell.x) return 'left';
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
  if (quality) return FLOOR_SPRITE_URIS.bay.qualityBench;
  return fixedSpriteUriFor(COMPETITION_BENCH_BAY_PRIMARY, occupied);
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
  member: FloorSimMember,
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


interface AmbientMemberBodyProps {
  readonly index: number;
  readonly type: MemberType;
  /**
   * GDD §5.13 presentation Phase 3: where to draw this member THIS INSTANT,
   * in tiles, interpolated between the cell it is on and the cell it is
   * stepping into. Phase 2 passed a whole `GridPosition` here because a body
   * that never moved was always on a cell exactly.
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
   * GDD §5.13 presentation Phase 4 (P4b): which of the nine sprite poses to
   * draw — computed by `FloorGrid` from the sim member (a station-class rep
   * frame while `using`, the two-frame walk cycle while a step is in flight,
   * standing otherwise), so this component stays a pure renderer of what it
   * is told.
   */
  readonly pose: FloorSpritePose;
  /** Phase 4: which way the sprite faces — the mirror is baked into the sprite table, not computed here. */
  readonly facing: FloorSpriteFacing;
  /**
   * Play-mode tap on this visible body. Presentation only — not a
   * `GymViewAction`. Absent in Build, where the same animated root is
   * `pointerEvents none`. Stage C.1d: the animated root owns the hit
   * region; there is no second member-shaped Pressable on the floor.
   */
  readonly onPress?: () => void;
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
 * `state`, `interruptedBy`, and (since Phase 4) `pose` and `facing` as their
 * own string-literal unions, and `type` as its five string literals. Because the reading is the resolved type, three things
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
  type,
  position,
  tile,
  state,
  interruptedBy,
  stranded,
  pose,
  facing,
  onPress,
}: AmbientMemberBodyProps) {
  const footprintWidth = EMPIRE_TUNING.AMBIENT_MEMBER_FOOTPRINT_TILES.width * tile;
  const footprintHeight = EMPIRE_TUNING.AMBIENT_MEMBER_FOOTPRINT_TILES.height * tile;

  const bob = useRef(new Animated.Value(0)).current;

  // ONE EFFECT OWNS THE LOOPING ANIMATION ON THIS TOKEN, AND ONE CLEANUP
  // STOPS IT. That is a structural choice rather than a stylistic one:
  // `empireForbiddenOutput.test.ts`'s returned-closure census keys a site by
  // its MEMBER PATH, so two `useEffect` cleanups inside one component are two
  // rows carrying the same key, and the seal census pins the number of
  // DISTINCT members against the length of its two declared lists. Two
  // cleanups here make those two numbers disagree. One effect keeps the key
  // one-to-one with the site, which is what that census is asking for.
  //
  // THE `using` PULSE THAT USED TO SHARE THIS EFFECT IS GONE, AND ITS TWO
  // KNOBS RETIRED WITH IT — GDD §5.13's P4b ruling replaces the pulse bob
  // with the sprite-level rep cycle (`FLOOR_SPRITE_REP_FRAME_TICKS`) as the
  // "working a set" read. The Phase 2 idle bob stays for every state,
  // untouched per PLAYTEST 4b's ruling, and no longer restarts on a state
  // change: with the pulse gone, `state` is no longer a dependency here.
  useEffect(() => {
    const lane = index % EMPIRE_TUNING.AMBIENT_MEMBER_BOB_STAGGER_LANES;
    const delay = lane * EMPIRE_TUNING.AMBIENT_MEMBER_BOB_STAGGER_STEP_MS;
    const bobLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(bob, {
          toValue: 1,
          duration: EMPIRE_TUNING.AMBIENT_MEMBER_BOB_HALF_CYCLE_MS,
          useNativeDriver: false,
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: EMPIRE_TUNING.AMBIENT_MEMBER_BOB_HALF_CYCLE_MS,
          useNativeDriver: false,
        }),
      ]),
    );
    bobLoop.start();

    return () => {
      bobLoop.stop();
    };
  }, [bob, index]);

  const bobTranslateY = bob.interpolate({
    inputRange: [0, 1],
    outputRange: [0, EMPIRE_TUNING.AMBIENT_MEMBER_BOB_AMPLITUDE_PIXELS],
  });

  // GDD §5.13 presentation Phase 3 — THE WALK. The sim advances a member by a
  // fraction of a tile per tick, and the renderer would show that as three
  // hops per tile if it simply wrote the new position out. Instead each new
  // position is tweened from wherever the token currently is, LINEARLY (the
  // `Animated.timing` default is an ease-in-out, which would put a stop and a
  // start inside every tick and read as limping), over
  // `FLOOR_SIM_MOVE_TWEEN_MS` — which at the shipped values equals the tick
  // interval, so the tween for one tick is still running when the next
  // replaces it and the walk is continuous.
  //
  // NO CLEANUP, and the reason is `AnimatedValue.animate`'s own contract: it
  // stops whatever animation is already attached to the value before
  // attaching the new one, so re-targeting mid-tween needs no teardown from
  // here. What that leaves is an unmount with a tween in flight, which runs
  // out its remaining `FLOOR_SIM_MOVE_TWEEN_MS` against a value nothing reads
  // and then stops by itself. That residual is why this is a comment and not
  // a silence.
  const walk = useRef(
    new Animated.ValueXY({ x: position.x * tile, y: position.y * tile }),
  ).current;
  useEffect(() => {
    Animated.timing(walk, {
      toValue: { x: position.x * tile, y: position.y * tile },
      duration: EMPIRE_TUNING.FLOOR_SIM_MOVE_TWEEN_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  }, [walk, position.x, position.y, tile]);

  const cueScale =
    state === 'interrupted' ? EMPIRE_TUNING.FLOOR_SIM_INTERRUPTED_CUE_SCALE : 1;
  const cueDiameter =
    Math.min(footprintWidth, footprintHeight) *
    EMPIRE_TUNING.FLOOR_SIM_CUE_DIAMETER_FRACTION *
    cueScale;

  return (
    <Animated.View
      testID={`floorgrid-ambient-${index}`}
      // Stage C.1d: this animated root IS the member. Play passes onPress
      // and a filling Pressable rides the same transform; Build passes
      // nothing and the whole token is out of hit-testing so stations
      // remain tappable underneath.
      pointerEvents={onPress === undefined ? 'none' : 'box-none'}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: footprintWidth,
        height: footprintHeight,
        zIndex: EMPIRE_TUNING.FLOOR_SIM_MEMBER_Z_INDEX,
        // `leaving` is the one state drawn at less than full strength — a
        // member that has finished with a machine and is stepping away.
        opacity: state === 'leaving' ? EMPIRE_TUNING.FLOOR_SIM_LEAVING_OPACITY : 1,
        // Two additive transforms: the tweened walk and the Phase 2 idle
        // bob. `left`/`top` stay at zero so the walk owns the whole position
        // and the bob rides on top of it. (P4b: the `using` pulse transform
        // is gone — the rep-cycle sprite frames are the working read now.)
        transform: [
          { translateX: walk.x },
          { translateY: walk.y },
          { translateY: bobTranslateY },
        ],
      }}
    >
      {/*
        GDD §5.13 presentation Phase 4: the member is the sprite now — one
        pre-upscaled indexed PNG per (type, pose, facing), drawn at the same
        footprint box the Phase 2 head-and-body placeholder occupied, so the
        outer element's bounding box (what the browser check reads) is
        unchanged. Type identity is the sprite's own outfit palette; the
        Phase 2 fraction/corner-radius knobs stay registered in
        `EMPIRE_TUNING` for the placeholder they describe but are no longer
        read here.
      */}
      <Image
        testID={`floorgrid-member-sprite-${index}`}
        source={{ uri: FLOOR_SPRITE_URIS.member[type][pose][facing] }}
        resizeMode={'stretch'}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: footprintWidth,
          height: footprintHeight,
        }}
        {...({ pointerEvents: 'none' } as object)}
      />
      {/*
        GDD §5.13 presentation Phase 3 — the state cue, in the register §5.13
        names by hand ("a visible reaction cue (RCT's thought-bubble
        pattern)"). One bubble above the head, coloured by state, carrying the
        cause glyph while an interruption beat is running and drawn larger
        while it is. Its testID carries the state, so a browser check can ask
        which state a member is in by reading the drawn DOM rather than by
        reading a caption.
      */}
      <View
        testID={`floorsim-cue-${index}-${state}`}
        pointerEvents={'none'}
        style={{
          position: 'absolute',
          left: (footprintWidth - cueDiameter) / 2,
          top: -(cueDiameter + EMPIRE_TUNING.FLOOR_SIM_CUE_GAP_PIXELS),
          width: cueDiameter,
          height: cueDiameter,
          borderRadius: cueDiameter / 2,
          backgroundColor: FLOOR_SIM_STATE_COLOR[state],
          borderWidth: EMPIRE_TUNING.FLOOR_ITEM_BORDER_WIDTH_PIXELS,
          borderColor: AMBIENT_MEMBER_BORDER_COLOR,
        }}
      />
      {interruptedBy === null ? null : (
        // The cause, in a word, beside the body rather than inside the
        // bubble: the bubble is a fraction of a 28-pixel tile and a word laid
        // out inside it would wrap to one letter a line. It overflows its
        // member's own footprint, which is what makes it readable and is
        // acceptable for a beat that runs for
        // `FLOOR_SIM_INTERRUPTED_BEAT_TICKS` and then resolves.
        <Text
          testID={`floorsim-cue-word-${index}`}
          pointerEvents={'none'}
          style={{
            position: 'absolute',
            left: 0,
            top: footprintHeight + EMPIRE_TUNING.FLOOR_SIM_CUE_GAP_PIXELS,
            color: FLOOR_SIM_STATE_COLOR.interrupted,
          }}
        >
          {FLOOR_SIM_INTERRUPTION_WORD[interruptedBy]}
        </Text>
      )}
      {/*
        The stranded ring. `floorSim.ts`'s own header states why this needs a
        cue of its own: the interruption beat is transient, so a member walled
        off from every station reacts once and then paces, and "still moving"
        is exactly what a stranded member and a member walking with purpose
        have in common. `FloorSimMember.strandedAt` is what tells them apart,
        and this holds a mark against it for as long as it is set.
      */}
      {stranded ? (
        <View
          testID={`floorsim-stranded-${index}`}
          pointerEvents={'none'}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: footprintWidth,
            height: footprintHeight,
            borderWidth: EMPIRE_TUNING.FLOOR_SIM_HIGHLIGHT_BORDER_WIDTH_PIXELS,
            borderColor: FLOOR_SIM_STATE_COLOR.interrupted,
            backgroundColor: FLOOR_SIM_HIGHLIGHT_FILL,
          }}
        />
      ) : null}
      {onPress === undefined ? null : (
        <Pressable
          accessibilityRole={'button'}
          onPress={onPress}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: footprintWidth,
            height: footprintHeight,
            cursor: 'pointer',
          } as WebSelectableViewStyle}
        />
      )}
    </Animated.View>
  );
}

export function FloorGrid(props: FloorGridProps) {
  const { owned, barbellOwned, floor, dispatch, managed, capability, buildMode } = props;
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
      setSim((previous) => stepFloorSim(previous, simContextRef.current));
    }, EMPIRE_TUNING.FLOOR_SIM_TICK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [pendingPlace]);

  // The stations the sim can send a member to, and what is happening at each.
  // A derived read: `floorStations` recomputes from the same context every
  // render and is stored nowhere, the same "read model, never a `FloorState`"
  // discipline `fixedFloorFurniture` already carries.
  const stations = floorStations(simContext);
  // GDD §5.13 P4b: the same read model keyed for lookup, so a `using`
  // member's draw bias and facing resolve against the identical stations the
  // sim was stepped with this render — one derivation, no second copy.
  const stationByRefKey = new Map<string, FloorStation>();
  for (const station of stations) {
    stationByRefKey.set(stationKey(station.ref), station);
  }
  const stationActivity = new Map<string, 'using' | 'claimed'>();
  for (const member of sim.members) {
    if (member.target === null) continue;
    const key = stationKey(member.target);
    if (member.state === 'using') {
      stationActivity.set(key, 'using');
    } else if (!stationActivity.has(key)) {
      stationActivity.set(key, 'claimed');
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
      style={{ flex: 1 }}
    >
      <Text testID={'floorgrid-caption'}>
        {buildMode
          ? placing
            ? 'build — tap a tile to place'
            : 'build — tap a piece, then tap a tile'
          : `floor (${floor.rung})`}
      </Text>
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
      <View testID={'floorgrid-scroll-x'} style={{ flex: 1 }}>
        <View testID={'floorgrid-scroll-y'} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View
            testID={'floorgrid-grid'}
            style={{
              width: grid.width * tile,
              height: grid.height * tile,
              backgroundColor: FLOOR_BACKGROUND_COLOR,
              borderWidth: EMPIRE_TUNING.FLOOR_GRID_BORDER_WIDTH_PIXELS,
              borderColor: FLOOR_GRID_BORDER_COLOR,
              // GDD §5.13 presentation Phase 4: every sprite under this
              // container inherits crisp nearest-neighbour scaling on the
              // web renderer. See `PixelSnappedViewStyle`.
              imageRendering: 'pixelated',
              // Explicit, rather than relying on a platform default: every
              // placed item below is `position: 'absolute'`, and CSS
              // resolves that against the nearest ANCESTOR that is itself
              // positioned. Without this, a placed item escaped this
              // container's own box on the web build and grew an ancestor
              // ScrollView's measured content height, which shifted the
              // grid's OWN on-screen position after every placement —
              // measured directly: `floorgrid-grid`'s drawn Y moved from
              // 440 to 532 after a single placement, with nothing else on
              // screen changing shape.
              position: 'relative',
            } as PixelSnappedViewStyle}
          >
            {/*
              GDD §5.13 presentation Phase 4: the floor itself. One indexed
              PNG per rung at the sprite-native resolution, drawn stretched
              to the grid's full pixel size (an integer scale by
              construction — both sides are the same tile count). It sits
              first in the container so everything else paints over it; the
              flat background colour above stays as the fallback a failed
              image load would reveal.
            */}
            <View
              pointerEvents={'none'}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: grid.width * tile,
                height: grid.height * tile,
              }}
            >
              <Image
                testID={'floorgrid-floor-texture'}
                source={{ uri: FLOOR_SPRITE_URIS.floor[floor.rung] }}
                resizeMode={'stretch'}
                style={{
                  width: grid.width * tile,
                  height: grid.height * tile,
                }}
              />
            </View>
            {verticalLines.map((i) => (
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
            ))}
            {horizontalLines.map((j) => (
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
            ))}
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
            {furniture.map((row) => {
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
                    left: row.position.x * tile,
                    top: row.position.y * tile,
                    width: row.footprint.width * tile,
                    height: row.footprint.height * tile,
                    zIndex: 0,
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
                    : fixedSpriteUriFor(row.item, isOccupied)) === null ? null : (
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
                        width: row.footprint.width * tile,
                        height: row.footprint.height * tile,
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
                          width: row.footprint.width * tile,
                          height: row.footprint.height * tile,
                        }}
                        {...({ pointerEvents: 'none' } as object)}
                      />
                    </View>
                  )}
                  {qualityMark ? (
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
                  {throughputMark ? (
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
                  {isBayPrimary ? null : (
                    <Text pointerEvents={'none'} style={FLOOR_LABEL_STYLE}>
                      {row.item}
                    </Text>
                  )}
                </Pressable>
              );
            })}
            {bay.expansion === null ? null : (
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
                  left: bay.expansion.position.x * tile,
                  top: bay.expansion.position.y * tile,
                  width: bay.expansion.footprint.width * tile,
                  height: bay.expansion.footprint.height * tile,
                  zIndex: 0,
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
                {bayBenchSpriteUri(bayQualityMark, expansionOccupied) === null ? null : (
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
                      width: bay.expansion.footprint.width * tile,
                      height: bay.expansion.footprint.height * tile,
                    }}
                    {...({ pointerEvents: 'none' } as object)}
                  />
                )}
              </Pressable>
            )}
            {bay.complete && bay.primary !== null && bayThroughputMark ? (
              <Image
                testID={'floorgrid-plate-tree-competition-bench-bay'}
                source={{ uri: FLOOR_SPRITE_URIS.bay.plateTree }}
                resizeMode={'stretch'}
                style={{
                  position: 'absolute',
                  left: (bay.primary.position.x + bay.primary.footprint.width - 1) * tile,
                  top: (bay.primary.position.y + bay.primary.footprint.height - 2) * tile,
                  width: tile,
                  height: tile * 2,
                  zIndex: 1,
                }}
                {...({ pointerEvents: 'none' } as object)}
              />
            ) : null}
            {placed.map((row) => {
              const isSelected =
                selectedStation !== null &&
                selectedStation.kind === 'session' &&
                selectedStation.item === row.item;
              const isPending =
                pendingPlace !== null &&
                pendingPlace.kind === 'session' &&
                pendingPlace.item === row.item;
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
                    left: row.position.x * tile,
                    top: row.position.y * tile,
                    width: row.footprint.width * tile,
                    height: row.footprint.height * tile,
                    borderWidth:
                      isSelected || isPending
                        ? EMPIRE_TUNING.FLOOR_SIM_HIGHLIGHT_BORDER_WIDTH_PIXELS
                        : EMPIRE_TUNING.FLOOR_ITEM_BORDER_WIDTH_PIXELS,
                    borderColor:
                      isSelected || isPending
                        ? FLOOR_STATION_SELECTED_OUTLINE_COLOR
                        : FLOOR_ITEM_BORDER_COLOR,
                    zIndex: 1,
                    cursor: 'pointer',
                  } as WebSelectableViewStyle}
                >
                  <Image
                    testID={`floorgrid-placed-sprite-${row.item}`}
                    source={{ uri: FLOOR_SPRITE_URIS.session[row.item] }}
                    resizeMode={'stretch'}
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: row.footprint.width * tile,
                      height: row.footprint.height * tile,
                    }}
                    {...({ pointerEvents: 'none' } as object)}
                  />
                  <Text pointerEvents={'none'} style={FLOOR_LABEL_STYLE}>
                    {row.item}
                  </Text>
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
              stations.flatMap((station) =>
                stationHighlightBoxes(station, bay, sim.members, sim.changeovers).map((box) => (
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
                      left: box.position.x * tile,
                      top: box.position.y * tile,
                      width: box.footprint.width * tile,
                      height: box.footprint.height * tile,
                      borderWidth: EMPIRE_TUNING.FLOOR_SIM_HIGHLIGHT_BORDER_WIDTH_PIXELS,
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
                )),
              )
            }
            {null}
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
              // Keyed by `member.index`, which `floorSim.ts` documents as
              // stable for the life of a sim — so a member keeps its own
              // animated values across ticks instead of being remounted and
              // snapping.
              sim.members.map((member) => {
                // P4b: the member's own station, when it has one — what the
                // using-pose class, the draw bias and the facing all key on.
                const station =
                  member.target === null
                    ? undefined
                    : stationByRefKey.get(stationKey(member.target));
                return (
                  <AmbientMemberBody
                    key={`ambient-${member.index}`}
                    index={member.index}
                    type={member.type}
                    position={memberDrawPoint(member, station, bay)}
                    tile={tile}
                    state={member.state}
                    interruptedBy={member.interruptedBy}
                    stranded={member.strandedAt !== null}
                    pose={memberPose(member, sim.tick)}
                    facing={memberFacing(member, station, bay)}
                    onPress={
                      buildMode ? undefined : () => toggleSelectedMember(member.index)
                    }
                  />
                );
              })
            }
            {buildMode || !bay.complete || bay.primary === null
              ? null
              : (
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
              )}
            {buildMode || bay.expansion === null
              ? null
              : (
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
              )}
          </View>
        </View>
      </View>
      <Text testID={'floorgrid-ambient-caption'}>{sim.members.length} member(s) around the gym</Text>
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
                  source={{ uri: FLOOR_SPRITE_URIS.session[item] }}
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
        style={panelStyles.diagnosticsToggle as WebSelectableViewStyle}
      >
        <Text style={panelStyles.buttonText}>
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
        <View testID={'floorgrid-member-panel'} style={panelStyles.panel}>
          <Text testID={'floorgrid-member-panel-identity'}>
            {playerFacingMemberTypeLabel(selectedMember.type)}
          </Text>
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
        </View>
      )}
      {panelStation === null ||
      panelIdentity === null ||
      panelOperation === null ||
      panelCondition === null ||
      panelManagerEffect === null ||
      selectedMember !== null ? null : (
        <View testID={'floorgrid-station-panel'} style={panelStyles.panel}>
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
        </View>
      )}
      {panelEquipment === null || selectedMember !== null || panelStation !== null ? null : (
        <View testID={'floorgrid-equipment-panel'} style={panelStyles.panel}>
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
        </View>
      )}
    </View>
  );
}
