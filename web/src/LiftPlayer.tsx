import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import {
  cueProgress,
  promptFor,
  type LiftConfig,
  type LiftInputKind,
  type LiftResolution,
} from '../../src/game/lift';
import { TICK_MS } from '../../src/game/liftTuning';
import { meetCommandFor } from '../../src/game/meetDay';
import { SESSION_TUNING } from '../../src/game/sessionTuning';
import { commandHit, cueRing, hitFlash, stageArmed, stageShake, stallBand } from '../../src/lift/liftFrame';
import {
  advanceBrowserLift,
  BROWSER_LIFT_TUNING,
  createBrowserLift,
  keySpriteBackdrop,
  liftControlCopy,
  liftControlIsReady,
  pauseBrowserLift,
  queueBrowserInput,
  resumeBrowserLift,
  spritePathFor,
  type BrowserLiftFrame,
} from './liftBrowser';

const spriteSurfaces = new Map<string, Promise<HTMLCanvasElement>>();

function spriteSurface(src: string): Promise<HTMLCanvasElement> {
  const cached = spriteSurfaces.get(src);
  if (cached !== undefined) return cached;
  const promise = new Promise<HTMLCanvasElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      if (context === null) { reject(new Error('Canvas unavailable')); return; }
      context.imageSmoothingEnabled = false;
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const keyed = keySpriteBackdrop(pixels.data, canvas.width, canvas.height);
      pixels.data.set(keyed);
      context.putImageData(pixels, 0, 0);
      resolve(canvas);
    };
    image.onerror = () => { spriteSurfaces.delete(src); reject(new Error(`Sprite unavailable: ${src}`)); };
    image.src = src;
  });
  spriteSurfaces.set(src, promise);
  return promise;
}

function AthleteSprite({ src }: { readonly src: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    let active = true;
    void spriteSurface(src).then((surface) => {
      if (!active || canvas.current === null) return;
      const target = canvas.current;
      target.width = surface.width;
      target.height = surface.height;
      const context = target.getContext('2d');
      if (context === null) { setUnavailable(true); return; }
      context.imageSmoothingEnabled = false;
      context.clearRect(0, 0, target.width, target.height);
      context.drawImage(surface, 0, 0);
      setUnavailable(false);
    }).catch(() => { if (active) setUnavailable(true); });
    return () => { active = false; };
  }, [src]);
  return <>
    <canvas ref={canvas} className="lift-athlete" aria-hidden="true" data-sprite={src} />
    {unavailable ? <span className="lift-sprite-error" role="status">Athlete art could not load. The lift control is still available.</span> : null}
  </>;
}

export interface LiftPlayerProps {
  readonly config: LiftConfig;
  readonly onResolved: (resolution: LiftResolution) => void;
  readonly competition?: boolean;
}

export function LiftPlayer({ config, onResolved, competition = false }: LiftPlayerProps) {
  const [frame, setFrame] = useState<BrowserLiftFrame>(() => createBrowserLift(config));
  const [physicalHeld, setPhysicalHeld] = useState(false);
  const [pauseReason, setPauseReason] = useState('');
  const live = useRef(frame);
  const sources = useRef(new Set<string>());
  const onResolvedRef = useRef(onResolved);
  const controlRef = useRef<HTMLButtonElement>(null);
  const delivered = useRef(false);
  const resultElapsed = useRef(0);
  const lastTime = useRef<number | null>(null);
  const needsFocus = useRef(true);
  onResolvedRef.current = onResolved;

  function publish(next: BrowserLiftFrame) {
    live.current = next;
    setFrame(next);
  }

  function pause(reason: string) {
    sources.current.clear();
    setPhysicalHeld(false);
    lastTime.current = null;
    if (live.current.state.phase === 'RESOLVED') return;
    setPauseReason(reason);
    publish(pauseBrowserLift(live.current));
  }

  function input(kind: LiftInputKind) {
    publish(queueBrowserInput(live.current, kind));
  }

  function press(source: string) {
    if (live.current.state.phase === 'RESOLVED') return;
    if (live.current.paused) {
      publish(resumeBrowserLift(live.current));
      lastTime.current = null;
      setPauseReason('');
    }
    const wasHeld = sources.current.size > 0;
    sources.current.add(source);
    if (!wasHeld) input('press');
    setPhysicalHeld(true);
  }

  function release(source: string) {
    if (!sources.current.delete(source)) return;
    if (sources.current.size === 0) {
      input('release');
      setPhysicalHeld(false);
    }
  }

  useEffect(() => {
    const fresh = createBrowserLift(config);
    live.current = fresh;
    setFrame(fresh);
    sources.current.clear();
    setPhysicalHeld(false);
    setPauseReason('');
    delivered.current = false;
    resultElapsed.current = 0;
    lastTime.current = null;
    needsFocus.current = true;

    let raf = 0;
    let running = true;
    const animate = (now: number) => {
      if (!running) return;
      const elapsed = lastTime.current === null ? 0 : now - lastTime.current;
      lastTime.current = now;
      const previous = live.current;
      const next = advanceBrowserLift(previous, elapsed);
      if (needsFocus.current && !next.paused && liftControlIsReady(next.state)) {
        controlRef.current?.focus({ preventScroll: true });
        needsFocus.current = false;
      }
      if (next !== previous) {
        live.current = next;
        setFrame(next);
      }
      if (!previous.paused && next.paused) {
        sources.current.clear();
        setPhysicalHeld(false);
        setPauseReason('The tab slowed down. Your lift is held here.');
      }
      if (next.state.phase === 'RESOLVED' && next.state.resolution !== null && !delivered.current) {
        resultElapsed.current += Math.min(elapsed, TICK_MS * BROWSER_LIFT_TUNING.MAX_CATCH_UP_TICKS);
        if (resultElapsed.current >= SESSION_TUNING.REP_RESULT_HOLD_MS) {
          delivered.current = true;
          onResolvedRef.current(next.state.resolution);
        }
      }
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    const loseWindow = () => pause('You left the platform. Your lift is paused.');
    const changeVisibility = () => {
      if (document.visibilityState === 'hidden') pause('The tab was hidden. Your lift is paused.');
      lastTime.current = null;
    };
    window.addEventListener('blur', loseWindow);
    document.addEventListener('visibilitychange', changeVisibility);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      sources.current.clear();
      window.removeEventListener('blur', loseWindow);
      document.removeEventListener('visibilitychange', changeVisibility);
    };
    // One rep has one immutable prescription. New rep keys come from the
    // session/meet engine; parent renders alone do not restart the clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.kind, config.seed, config.loadRatio]);

  useEffect(() => {
    for (const suffix of ['', '-max']) {
      for (let index = 1; index <= BROWSER_LIFT_TUNING.SPRITE_FRAME_COUNT; index += 1) {
        void spriteSurface(`/sprites/${config.kind}${suffix}/frame-${String(index).padStart(2, '0')}.png`).catch(() => undefined);
      }
    }
  }, [config.kind]);

  const pointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || !event.isPrimary) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    press(`pointer-${event.pointerId}`);
  };
  const pointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    release(`pointer-${event.pointerId}`);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  const keyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.code !== 'Space' && event.code !== 'Enter') return;
    event.preventDefault();
    if (!event.repeat) press(`key-${event.code}`);
  };
  const keyUp = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.code !== 'Space' && event.code !== 'Enter') return;
    event.preventDefault();
    release(`key-${event.code}`);
  };

  const state = frame.state;
  const copy = liftControlCopy(state, frame.paused);
  const ring = state.activeCue === null ? null : cueRing(cueProgress(state));
  const hit = commandHit(state);
  const armed = stageArmed(state);
  const shake = stageShake(state);
  const stalled = stallBand(state);
  const flash = hitFlash(state);
  const command = competition ? meetCommandFor(state) : null;
  const prompt = frame.paused ? 'LIFT PAUSED' : state.resolution?.headline ?? promptFor(state);
  const resolved = state.phase === 'RESOLVED';
  const target = BROWSER_LIFT_TUNING.CUE_VIEW_CENTER;

  return (
    <div
      className={`lift-player lift-player--${config.kind}${frame.paused ? ' lift-player--paused' : ''}${resolved ? ` lift-player--${state.resolution?.outcome}` : ''}`}
      data-phase={state.phase}
      data-tick={state.tick}
      data-held={state.held}
      data-seed={config.seed}
    >
      <div className="lift-stage" aria-label={`Live ${config.kind} lift`}>
        <div className="lift-stage-light" aria-hidden="true" />
        <div className="lift-platform" aria-hidden="true" />
        <div className="lift-athlete-wrap" style={{ transform: `translate(${shake.dx}px, ${shake.dy}px)` }}>
          <AthleteSprite src={spritePathFor(state)} />
        </div>
        {hit !== null ? <div className={`lift-command-flash lift-command-flash--${hit.command}`} style={{ opacity: hit.washAlpha }} aria-hidden="true" /> : null}
        {stalled !== null ? <div className="lift-stall" style={{ opacity: stalled.alpha }} aria-hidden="true" /> : null}
        {flash > 0 ? <div className="lift-hit-flash" style={{ opacity: flash }} aria-hidden="true" /> : null}
        {ring !== null && !frame.paused ? (
          <div className={`lift-cue${ring.inPerfectBand ? ' lift-cue--on-beat' : ''}`} aria-hidden="true">
            <svg viewBox={`0 0 ${BROWSER_LIFT_TUNING.CUE_VIEW_SIZE} ${BROWSER_LIFT_TUNING.CUE_VIEW_SIZE}`}>
              <circle className="lift-cue-target" cx={target} cy={target} r={ring.targetRadius} fill="none" strokeWidth={BROWSER_LIFT_TUNING.CUE_STROKE} />
              <circle className="lift-cue-moving" cx={target} cy={target} r={ring.radius} fill="none" strokeWidth={BROWSER_LIFT_TUNING.CUE_STROKE} />
            </svg>
            <span>{state.activeCue?.wants === 'release' ? 'RELEASE' : 'TAP'}</span>
          </div>
        ) : null}
        {armed !== null && !frame.paused ? <div className="lift-armed" style={{ opacity: armed }} aria-hidden="true" /> : null}
        <div className="lift-stage-caption" aria-live="polite" aria-atomic="true">
          {command !== null && !frame.paused ? <span className={`lift-referee-command${command.live ? ' lift-referee-command--live' : ''}`}>{command.text}</span> : null}
          <h2 className="lift-prompt">{prompt}</h2>
          {frame.paused ? <p className="lift-pause-reason">{pauseReason}</p> : null}
          {state.resolution?.detail ? <p className="lift-result-detail">{state.resolution.detail}</p> : null}
        </div>
      </div>
      <div className="lift-console">
        <p className="lift-instruction" id={`lift-instruction-${config.seed}`}>{copy.instruction}</p>
        <button
          ref={controlRef}
          type="button"
          className={`lift-control${physicalHeld ? ' lift-control--held' : ''}`}
          aria-label={copy.label}
          aria-describedby={`lift-instruction-${config.seed}`}
          aria-keyshortcuts="Space Enter"
          aria-pressed={physicalHeld}
          disabled={resolved || (!frame.paused && !liftControlIsReady(state))}
          onPointerDown={pointerDown}
          onPointerUp={pointerUp}
          onPointerCancel={() => pause('Touch interrupted. Regrip to continue your lift.')}
          onLostPointerCapture={(event) => {
            if (sources.current.has(`pointer-${event.pointerId}`)) pause('Grip interrupted. Continue with the lift control.');
          }}
          onKeyDown={keyDown}
          onKeyUp={keyUp}
          onBlur={() => {
            if (sources.current.size > 0) pause('Grip interrupted. Continue with the lift control.');
          }}
          onContextMenu={(event) => event.preventDefault()}
          onClick={(event) => {
            if (event.detail !== 0 || sources.current.size > 0 || resolved) return;
            if (live.current.paused) publish(resumeBrowserLift(live.current));
            input('press');
            input('release');
          }}
        >
          <span className="lift-control-icon" aria-hidden="true">↥</span>
          <span>{copy.label}</span>
          <span className="lift-control-key" aria-hidden="true">SPACE</span>
        </button>
        <div className="lift-console-footer">
          <span>Touch, mouse, or <kbd>Space</kbd> / <kbd>Enter</kbd></span>
          <button type="button" className="lift-pause-button" disabled={resolved || frame.paused} onClick={() => pause('Take a breath. Your lift is paused.')}>Pause</button>
        </div>
      </div>
    </div>
  );
}
