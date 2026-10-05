import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Hand, MousePointer2, Minus, Plus, Scan } from 'lucide-react';
import { floorGridSize, type GridPosition } from '../../src/facility/floor';
import { createFloorSimState, stepFloorSim, type FloorSimState } from '../../src/facility/floorSim';
import { EMPIRE_TUNING } from '../../src/facility/empireTuning';
import { sceneContextFor, reconcileSceneSimulation } from '../../src/facility/scene/runtime';
import { createSceneCamera, unprojectFloor } from '../../src/facility/scene/camera';
import { buildGymSceneFrame, buildEquipmentPreview, hitTestScene } from '../../src/facility/scene/frame';
import type { GymSceneFrame, SceneActivityCounts, ScenePoint } from '../../src/facility/scene/types';
import type { GymViewState } from '../../src/facility/ladderView';
import type { ManagedEquipmentItem } from '../../src/facility/management';
import type { FacilityPort } from './facilityPort';
import { createGymSceneRenderer } from './gymSceneRenderer';
import { GYM_INTERACTION_TUNING as T } from './gymInteractionTuning';
import { INTERFACE_TUNING as UI } from './interfaceTuning';
import { placementFootprint, placementRefusal, type GymPlacement } from './gymModel';

interface Runtime { sim: FloorSimState; elapsed: number; accumulator: number }
const RUNTIMES = new WeakMap<FacilityPort, Runtime>();
function sceneRuntime(port: FacilityPort, state: GymViewState): Runtime {
  const existing = RUNTIMES.get(port);
  if (existing) return existing;
  const runtime = { sim: createFloorSimState(sceneContextFor(state), EMPIRE_TUNING.FLOOR_SIM_RENDER_SEED), elapsed: T.ZERO, accumulator: T.ZERO };
  RUNTIMES.set(port, runtime); return runtime;
}
export interface GymWorldMetrics { readonly frameIntervals: number[]; readonly drawDurations: number[]; readonly interactionLatencies: number[] }
interface InstrumentedCanvas extends HTMLCanvasElement { twlMetrics?: GymWorldMetrics }
interface Props {
  state: GymViewState; port: FacilityPort; build: boolean; selected: ManagedEquipmentItem | null; draft: GymPlacement | null;
  onPick: (item: ManagedEquipmentItem) => void; onPosition: (position: GridPosition) => void; onCancel: () => void;
  onCounts: (counts: SceneActivityCounts) => void;
}
interface Gesture { id: number; kind: 'pan' | 'place' | 'inspect'; start: ScenePoint; last: ScenePoint; pan: ScenePoint; anchor: ScenePoint; moved: boolean }

export function EquipmentPreview({ item }: { item: ManagedEquipmentItem }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvas.current) return;
    const renderer = createGymSceneRenderer(canvas.current);
    const frame = buildEquipmentPreview(item, { width: T.PREVIEW_WIDTH, height: T.PREVIEW_HEIGHT });
    renderer.drawFrame(frame); return () => renderer.dispose();
  }, [item]);
  return <canvas className="equipment-preview" ref={canvas} width={T.PREVIEW_WIDTH} height={T.PREVIEW_HEIGHT} aria-hidden="true" />;
}

export function GymWorld(props: Props) {
  const canvasRef = useRef<InstrumentedCanvas>(null);
  const frameRef = useRef<GymSceneFrame | null>(null);
  const latest = useRef(props); latest.current = props;
  const runtime = useMemo(() => sceneRuntime(props.port, props.state), [props.port]);
  const context = useMemo(() => sceneContextFor(props.state), [props.state]);
  const contextRef = useRef(context); contextRef.current = context;
  const [mode, setMode] = useState<'equipment' | 'pan'>('equipment');
  const [zoom, setZoom] = useState<number>(T.DEFAULT_ZOOM);
  const [pan, setPan] = useState<ScenePoint>({ x: T.ZERO, y: T.ZERO });
  const [fitAll, setFitAll] = useState(false);
  const cameraOptions = useRef({ zoom, pan, fitAll }); cameraOptions.current = { zoom, pan, fitAll };
  const gesture = useRef<Gesture | null>(null);
  const pendingInput = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = createGymSceneRenderer(canvas);
    const metrics: GymWorldMetrics = { frameIntervals: [], drawDurations: [], interactionLatencies: [] };
    canvas.twlMetrics = metrics;
    let viewport: { width: number; height: number } = { width: T.INITIAL_WIDTH, height: T.INITIAL_HEIGHT };
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      viewport = { width: Math.max(T.ONE, rect.width), height: Math.max(T.ONE, rect.height) };
      const dpr = Math.min(T.MAX_DPR, window.devicePixelRatio || T.ONE);
      canvas.width = Math.round(viewport.width * dpr); canvas.height = Math.round(viewport.height * dpr);
    };
    resize(); const observer = new ResizeObserver(resize); observer.observe(canvas);
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let last = performance.now(), reported = last, handle: number = T.ZERO;
    function sample(bucket: number[], value: number) { bucket.push(value); if (bucket.length > T.MAX_PERFORMANCE_SAMPLES) bucket.shift(); }
    const animate = (now: number) => {
      const gap = now - last; last = now;
      if (!document.hidden) {
        const delta = Math.min(T.MAX_FRAME_GAP_MS, gap);
        runtime.elapsed += delta; runtime.accumulator += delta;
        runtime.sim = reconcileSceneSimulation(contextRef.current, runtime.sim);
        while (runtime.accumulator >= T.STEP_MS) { runtime.sim = stepFloorSim(runtime.sim, contextRef.current); runtime.accumulator -= T.STEP_MS; }
        const current = latest.current, options = cameraOptions.current;
        const grid = floorGridSize(contextRef.current.rung);
        const camera = createSceneCamera(grid, viewport, { zoom: options.zoom, pan: options.pan, fitAll: options.fitAll });
        const preview = current.draft?.position ? { item: current.draft.target.item, position: current.draft.position, rotation: current.draft.rotation, footprint: placementFootprint(current.draft), valid: placementRefusal(current.state, current.draft) === null } : null;
        const started = performance.now();
        const frame = buildGymSceneFrame({ context: contextRef.current, sim: runtime.sim, managed: current.state.managed, elapsedSeconds: runtime.elapsed / T.SECOND_MS, tickAlpha: runtime.accumulator / T.STEP_MS, selected: current.selected, preview, build: current.build, reducedMotion: motion.matches }, camera);
        renderer.drawFrame(frame); frameRef.current = frame;
        sample(metrics.drawDurations, performance.now() - started);
        if (gap < T.MAX_FRAME_GAP_MS) sample(metrics.frameIntervals, gap);
        if (pendingInput.current !== null) { sample(metrics.interactionLatencies, performance.now() - pendingInput.current); pendingInput.current = null; }
        if (now - reported >= T.REPORT_INTERVAL_MS) {
          reported = now; current.onCounts(frame.counts);
          canvas.dataset.simTick = String(runtime.sim.tick);
          canvas.dataset.memberIds = JSON.stringify(runtime.sim.members.map(member => member.memberId));
          canvas.dataset.activities = JSON.stringify(runtime.sim.members.map(member => ({ id: member.memberId, state: member.state, target: member.target, cell: member.cell })));
          canvas.dataset.camera = JSON.stringify(camera);
          canvas.dataset.entities = JSON.stringify(frame.entities.map(({ id, item, kind, position, footprint, rotation, hitPolygon }) => ({ id, item, kind, position, footprint, rotation, hitPolygon })));
          canvas.dataset.activityCounts = JSON.stringify(frame.counts);
        }
      }
      handle = requestAnimationFrame(animate);
    };
    handle = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(handle); observer.disconnect(); renderer.dispose(); gesture.current = null; };
  }, [runtime]);

  function point(event: PointerEvent<HTMLCanvasElement>): ScenePoint {
    const rect = event.currentTarget.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  function snap(screen: ScenePoint, anchor: ScenePoint) {
    const frame = frameRef.current; if (!frame) return;
    const floor = unprojectFloor(frame.camera, screen);
    latest.current.onPosition({ x: Math.floor(floor.x - anchor.x), y: Math.floor(floor.y - anchor.y) });
    pendingInput.current = performance.now();
  }
  function start(event: PointerEvent<HTMLCanvasElement>) {
    if (!event.isPrimary || event.button !== T.ZERO || gesture.current) return;
    const screen = point(event), frame = frameRef.current;
    if (!frame) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const entity = hitTestScene(frame, screen);
    let anchor: ScenePoint = { x: T.ZERO, y: T.ZERO };
    if (mode !== 'pan' && entity?.kind === 'equipment' && entity.item) {
      latest.current.onPick(entity.item);
      const floor = unprojectFloor(frame.camera, screen);
      anchor = { x: floor.x - entity.position.x + (entity.footprint?.width ?? T.ZERO) / T.TWO, y: floor.y - entity.position.y + (entity.footprint?.height ?? T.ZERO) / T.TWO };
    } else if (props.build && props.draft) {
      const footprint = placementFootprint(props.draft);
      anchor = { x: footprint.width / T.TWO, y: footprint.height / T.TWO };
    }
    const kind = mode === 'pan' ? 'pan' : props.build && (props.draft || entity?.item) ? 'place' : 'inspect';
    gesture.current = { id: event.pointerId, kind, start: screen, last: screen, pan, anchor, moved: false };
    if (kind === 'place' && entity?.kind !== 'equipment') snap(screen, anchor);
  }
  function move(event: PointerEvent<HTMLCanvasElement>) {
    const active = gesture.current; if (!active || active.id !== event.pointerId) return;
    const screen = point(event); active.last = screen;
    active.moved ||= Math.hypot(screen.x - active.start.x, screen.y - active.start.y) > T.TAP_SLOP_PX;
    if (active.kind === 'pan') { setPan({ x: active.pan.x + screen.x - active.start.x, y: active.pan.y + screen.y - active.start.y }); pendingInput.current = performance.now(); }
    else if (active.kind === 'place' && active.moved) snap(screen, active.anchor);
  }
  function end(event: PointerEvent<HTMLCanvasElement>) {
    if (gesture.current?.id !== event.pointerId) return;
    gesture.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function keys(event: KeyboardEvent<HTMLCanvasElement>) {
    if (event.key === 'Escape') { props.onCancel(); event.preventDefault(); return; }
    const directions: Record<string, ScenePoint> = { ArrowLeft: { x: -T.ONE, y: T.ZERO }, ArrowRight: { x: T.ONE, y: T.ZERO }, ArrowUp: { x: T.ZERO, y: -T.ONE }, ArrowDown: { x: T.ZERO, y: T.ONE } };
    const direction = directions[event.key];
    if (direction && props.build && props.draft) { const current = props.draft.position ?? { x: T.ZERO, y: T.ZERO }; props.onPosition({ x: current.x + direction.x, y: current.y + direction.y }); event.preventDefault(); }
  }
  return <div className={'gym-world' + (props.build ? ' is-building' : '')}>
    <canvas ref={canvasRef} className="gym-world-canvas" data-testid="gym-world" tabIndex={T.ZERO} aria-label={props.build ? 'Gym floor. Select equipment, then drag or tap to preview placement. Arrow keys move the preview; Escape cancels.' : 'Living gym floor. Select equipment to inspect it.'} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={() => { gesture.current = null; }} onKeyDown={keys} />
    <div className="world-tools" aria-label="Gym camera controls">
      <button aria-label="Select equipment" aria-pressed={mode === 'equipment'} onClick={() => setMode('equipment')}><MousePointer2 size={UI.ICON_MEDIUM} /></button>
      <button aria-label="Pan camera" aria-pressed={mode === 'pan'} onClick={() => setMode('pan')}><Hand size={UI.ICON_MEDIUM} /></button>
      <button aria-label="Zoom out" onClick={() => setZoom(value => Math.max(T.MIN_ZOOM, value - T.ZOOM_STEP))}><Minus size={UI.ICON_MEDIUM} /></button>
      <button aria-label="Zoom in" onClick={() => setZoom(value => Math.min(T.MAX_ZOOM, value + T.ZOOM_STEP))}><Plus size={UI.ICON_MEDIUM} /></button>
      <button aria-label="Fit whole gym" onClick={() => { setFitAll(true); setZoom(T.ONE); setPan({ x: T.ZERO, y: T.ZERO }); }}><Scan size={UI.ICON_MEDIUM} /></button>
    </div>
    {props.build && <span className="world-mode">{mode === 'pan' ? 'CAMERA · DRAG TO PAN' : 'BUILD · DRAG OR TAP TO PLACE'}</span>}
  </div>;
}
