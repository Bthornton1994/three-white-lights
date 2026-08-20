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
 */

import { useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  type PanResponderGestureState,
  Pressable,
  ScrollView,
  Text,
  type ViewStyle,
  View,
} from 'react-native';

import { EMPIRE_TUNING } from './empireTuning';
import {
  type FloorState,
  type GridPosition,
  floorGridSize,
  floorLayout,
  sessionItemFootprint,
  unplacedOwnedFloorItems,
} from './floor';
import { type GymViewAction } from './ladderView';
import { type SessionEquipmentItem } from './sessions';

/**
 * `userSelect` is a real react-native-web style extension (it maps straight
 * to the CSS property of the same name) that the core `react-native` types
 * `tsc` checks against do not declare, because native has no such concept.
 * This widens `ViewStyle` by exactly that one field rather than reaching for
 * `any` anywhere in this file — see the two call sites below for why the
 * property is load-bearing rather than decorative.
 */
type WebSelectableViewStyle = ViewStyle & { readonly userSelect?: 'none' };

export interface FloorGridProps {
  readonly owned: readonly SessionEquipmentItem[];
  readonly floor: FloorState;
  readonly dispatch: (action: GymViewAction) => void;
}

/**
 * A stable, legible colour per item — cycling a small fixed palette by the
 * item's own position in `SESSION_EQUIPMENT_ITEMS`, so the same item is
 * always the same colour across a whole session and no lookup table needs
 * maintaining as items are added. Placeholder shapes only, per GDD §5.13's
 * own build order: "Phases 1-2 build against placeholder shapes; committing
 * final art to a layout system that might still change shape wastes budget
 * on a moving target."
 *
 * Named CSS colour keywords, not hex or `rgb()` — deliberately, so this
 * table does not need a `src/tuning/` palette-module registration (a real
 * crossing, per CLAUDE.md's session-coordination section) to pass
 * `src/tuning/audit.ts`'s colour-literal scan, which matches only `#...` and
 * `rgba?(...)` and does not reach a bare colour name.
 */
const PLACEHOLDER_PALETTE: readonly string[] = Object.freeze([
  'firebrick',
  'steelblue',
  'seagreen',
  'goldenrod',
  'mediumpurple',
  'mediumvioletred',
  'darkturquoise',
]);

const FLOOR_BACKGROUND_COLOR = 'darkslategray';
const FLOOR_GRID_BORDER_COLOR = 'gray';
const FLOOR_ITEM_BORDER_COLOR = 'black';

function colorFor(item: SessionEquipmentItem): string {
  const index = EMPIRE_TUNING.SESSION_EQUIPMENT_ITEMS.indexOf(item);
  return PLACEHOLDER_PALETTE[index % PLACEHOLDER_PALETTE.length] as string;
}

/** Round a page-relative pixel offset to the NEAREST whole grid tile. */
function pixelsToTile(pixels: number, tilePixels: number): number {
  return Math.round(pixels / tilePixels);
}

export function FloorGrid(props: FloorGridProps) {
  const { owned, floor, dispatch } = props;
  const grid = floorGridSize(floor.rung);
  const placed = floorLayout(floor);
  const unplaced = unplacedOwnedFloorItems(floor, owned);
  const tile = EMPIRE_TUNING.FLOOR_TILE_PIXELS;

  // The grid container's own page position. `.measure()` returns it relative
  // to the SCREEN, including whatever the page has scrolled to at the moment
  // it is called — so a value captured once, at mount, goes stale the moment
  // an ancestor `ScrollView` moves (an RN `onLayout` fires on a SIZE/POSITION
  // change relative to the PARENT, not on a scroll, so scrolling the outer
  // `gymscreen-root` down to reach this section at all — which every real
  // play-through does, since the floor sits below the shop and week log —
  // never re-fires it). Read imperatively, at the START of every drag
  // (`onPanResponderGrant`) rather than once at mount, so the position used
  // at release is the position the grid is drawn at when the drag begins.
  //
  // THE LIMIT, stated rather than hidden: this is a grant-time reading, not
  // a release-time one. If an ancestor `ScrollView` moves DURING the drag
  // itself — observed, on the web build under Playwright's synthetic mouse
  // driving, as a `gymscreen-root` scroll of up to ~90px between grant and
  // release with the on-screen pointer position held fixed — the tile a
  // release computes against can be off by more than one cell. A
  // release-time re-measurement was tried and made the web build's own
  // placement LESS reliable under the same harness (a placement that had
  // been landing dropped to never firing at all), which is a worse defect
  // than an occasionally-imprecise cell, so it was reverted rather than
  // shipped. This is disclosed in this piece's own report as an open feel
  // risk for a human to evaluate on a real device, where a touch responder
  // negotiating against a native scroll gesture may not behave the same way
  // a desktop mouse drag emulated through Playwright does.
  const gridOrigin = useRef({ x: 0, y: 0 });
  const gridRef = useRef<View>(null);
  const remeasureGridOrigin = (): void => {
    gridRef.current?.measure((_x, _y, _width, _height, pageX, pageY) => {
      gridOrigin.current = { x: pageX, y: pageY };
    });
  };

  // The one in-flight drag, if any — purely visual, never persisted.
  const [draggingItem, setDraggingItem] = useState<SessionEquipmentItem | null>(null);
  const dragOffset = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  const releaseAt = (
    item: SessionEquipmentItem,
    gestureState: PanResponderGestureState,
  ): void => {
    const position: GridPosition = {
      x: pixelsToTile(gestureState.moveX - gridOrigin.current.x, tile),
      y: pixelsToTile(gestureState.moveY - gridOrigin.current.y, tile),
    };
    dispatch({ kind: 'floor-place', item, position });
    setDraggingItem(null);
    dragOffset.setValue({ x: 0, y: 0 });
  };

  const panResponderFor = (item: SessionEquipmentItem) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        remeasureGridOrigin();
        setDraggingItem(item);
        dragOffset.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: dragOffset.x, dy: dragOffset.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_event, gestureState) => releaseAt(item, gestureState),
      onPanResponderTerminate: () => {
        setDraggingItem(null);
        dragOffset.setValue({ x: 0, y: 0 });
      },
    });

  return (
    <View testID={'floorgrid-root'}>
      <Text testID={'floorgrid-caption'}>
        floor ({floor.rung}) — {grid.width}x{grid.height} tiles, {placed.length} placed,{' '}
        {unplaced.length} unplaced
      </Text>
      <ScrollView horizontal testID={'floorgrid-scroll-x'}>
        <ScrollView testID={'floorgrid-scroll-y'}>
          <View
            ref={gridRef}
            testID={'floorgrid-grid'}
            onLayout={() => remeasureGridOrigin()}
            style={{
              width: grid.width * tile,
              height: grid.height * tile,
              backgroundColor: FLOOR_BACKGROUND_COLOR,
              borderWidth: EMPIRE_TUNING.FLOOR_GRID_BORDER_WIDTH_PIXELS,
              borderColor: FLOOR_GRID_BORDER_COLOR,
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
            }}
          >
            {placed.map((row) => {
              const isDragging = draggingItem === row.item;
              const responder = panResponderFor(row.item);
              return (
                <Animated.View
                  key={row.item}
                  testID={`floorgrid-placed-${row.item}`}
                  {...responder.panHandlers}
                  style={{
                    position: 'absolute',
                    left: row.position.x * tile,
                    top: row.position.y * tile,
                    width: row.footprint.width * tile,
                    height: row.footprint.height * tile,
                    backgroundColor: colorFor(row.item),
                    borderWidth: EMPIRE_TUNING.FLOOR_ITEM_BORDER_WIDTH_PIXELS,
                    borderColor: FLOOR_ITEM_BORDER_COLOR,
                    transform: isDragging
                      ? [{ translateX: dragOffset.x }, { translateY: dragOffset.y }]
                      : [],
                    zIndex: isDragging ? EMPIRE_TUNING.FLOOR_DRAGGING_Z_INDEX : 1,
                    // Web only, and load-bearing rather than cosmetic: without
                    // it, a browser's own text/drag selection races the
                    // PanResponder negotiation for the mousedown and wins,
                    // so a drag on the web build selects text instead of
                    // moving the chip. Native has no such race — a touch
                    // responder there is granted by the RN runtime directly.
                    userSelect: 'none',
                  } as WebSelectableViewStyle}
                >
                  <Text>{row.item}</Text>
                  <Pressable
                    testID={`floorgrid-remove-${row.item}`}
                    onPress={() => dispatch({ kind: 'floor-remove', item: row.item })}
                  >
                    <Text>x</Text>
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
        </ScrollView>
      </ScrollView>
      <View testID={'floorgrid-tray'}>
        <Text>unplaced equipment — drag onto the floor above</Text>
        <ScrollView horizontal testID={'floorgrid-tray-scroll'}>
          {unplaced.map((item) => {
            const isDragging = draggingItem === item;
            const responder = panResponderFor(item);
            const footprint = sessionItemFootprint(item);
            return (
              <Animated.View
                key={item}
                testID={`floorgrid-tray-item-${item}`}
                {...responder.panHandlers}
                style={{
                  width: Math.max(footprint.width, EMPIRE_TUNING.FLOOR_TRAY_ITEM_MIN_TILES) * tile,
                  height: Math.max(footprint.height, EMPIRE_TUNING.FLOOR_TRAY_ITEM_MIN_TILES) * tile,
                  backgroundColor: colorFor(item),
                  borderWidth: EMPIRE_TUNING.FLOOR_ITEM_BORDER_WIDTH_PIXELS,
                  borderColor: FLOOR_ITEM_BORDER_COLOR,
                  margin: EMPIRE_TUNING.FLOOR_TRAY_ITEM_MARGIN_PIXELS,
                  transform: isDragging
                    ? [{ translateX: dragOffset.x }, { translateY: dragOffset.y }]
                    : [],
                  zIndex: isDragging ? EMPIRE_TUNING.FLOOR_DRAGGING_Z_INDEX : 1,
                  // See the placed-chip style above: web-only, load-bearing.
                  userSelect: 'none',
                } as WebSelectableViewStyle}
              >
                <Text>{item}</Text>
              </Animated.View>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}
