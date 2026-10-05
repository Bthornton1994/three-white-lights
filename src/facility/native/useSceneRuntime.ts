import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { EMPIRE_TUNING } from '../empireTuning';
import { createFloorSimState, stepFloorSim } from '../floorSim';
import type { GymViewState } from '../ladderView';
import { presentationTickIntervalMs } from '../presentationState';
import { reconcileSceneSimulation, sceneContextFor } from '../scene/runtime';
import { NATIVE_FACILITY_TUNING as T } from './nativeTuning';

export function useSceneRuntime(state: GymViewState, active: boolean, reducedMotion: boolean) {
  const context = useMemo(() => sceneContextFor(state), [state]);
  const contextRef = useRef(context);
  contextRef.current = context;
  const [openingSim] = useState(() => createFloorSimState(context, EMPIRE_TUNING.FLOOR_SIM_RENDER_SEED));
  const simRef = useRef(openingSim);
  const [presentation, setPresentation] = useState({ sim: simRef.current, tickAlpha: 0 });
  const [foreground, setForeground] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const listener = AppState.addEventListener('change', value => setForeground(value === 'active'));
    return () => listener.remove();
  }, []);
  useEffect(() => {
    const next = reconcileSceneSimulation(context, simRef.current);
    if (next !== simRef.current) {
      simRef.current = next;
      setPresentation(current => ({ ...current, sim: next }));
    }
  }, [context]);
  useEffect(() => {
    if (!active || !foreground) return undefined;
    let previous = Date.now();
    let remainder = 0;
    const interval = presentationTickIntervalMs();
    const timer = setInterval(() => {
      const now = Date.now();
      remainder += Math.max(0, Math.min(now - previous, interval * T.SIM_CATCHUP_MAX_TICKS));
      previous = now;
      simRef.current = reconcileSceneSimulation(contextRef.current, simRef.current);
      while (remainder >= interval) {
        simRef.current = stepFloorSim(simRef.current, contextRef.current);
        remainder -= interval;
      }
      setPresentation({ sim: simRef.current, tickAlpha: reducedMotion ? 0 : remainder / interval });
    }, reducedMotion ? interval : T.SIM_FRAME_MS);
    return () => clearInterval(timer);
  }, [active, foreground, reducedMotion]);
  return { ...presentation, context, elapsedSeconds: (presentation.sim.tick + presentation.tickAlpha) * presentationTickIntervalMs() / EMPIRE_TUNING.MILLISECONDS_PER_SECOND };
}
