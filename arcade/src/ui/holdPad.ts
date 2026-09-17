/**
 * Hold-pad state for the active lift. Pure TypeScript, no React, no sim.
 *
 * The pad owns exactly one bit: whether the current press is being tracked.
 * That bit is forgotten on every screen change and on any global pointerup or
 * pointercancel, so a lift that resolves while the finger is still down can
 * never swallow the next attempt's first press. (Defect found by the
 * development analyzer on fc4c1aec: attempts 2 and 3 began with
 * data-held="true" and their first press was dropped.)
 *
 * Input semantics are unchanged from the original pad: a press while already
 * held is ignored, a release while not held is ignored, and inputs reach the
 * sim only while the lift is live. Nothing here touches lift.ts, feel.ts, the
 * frame maps or the art.
 */
export type HoldInput = "press" | "release";

export interface HoldPadOptions {
  /** True while the play screen is mounted and the sim accepts inputs. */
  isLive: () => boolean;
  /** Receives the input the sim should queue, in order. */
  onInput: (kind: HoldInput) => void;
  /** Where global pointerup / pointercancel are observed (window in the app). */
  target?: EventTarget | null;
}

export interface HoldPadController {
  /** Whether a press is currently being tracked. */
  readonly held: boolean;
  /** Pointer or key down on the pad. Returns the queued input, or null when ignored. */
  down(): HoldInput | null;
  /** Pointer or key up anywhere. Always clears the held bit; queues a release only while live. */
  up(): HoldInput | null;
  /** The screen changed (resolve, judging, fail, transition, reset, new attempt): forget any hold. */
  screenChanged(): void;
  /** Detach global listeners and forget any hold. Idempotent. */
  dispose(): void;
}

export const HOLD_RELEASE_EVENTS = ["pointerup", "pointercancel"] as const;

export function createHoldPad(opts: HoldPadOptions): HoldPadController {
  let held = false;
  let disposed = false;

  const down = (): HoldInput | null => {
    if (disposed || !opts.isLive()) return null;
    if (held) return null;
    held = true;
    opts.onInput("press");
    return "press";
  };

  const up = (): HoldInput | null => {
    if (!held) return null;
    held = false;
    if (disposed || !opts.isLive()) return null;
    opts.onInput("release");
    return "release";
  };

  const screenChanged = (): void => {
    held = false;
  };

  const onGlobalUp = (): void => {
    up();
  };

  const target = opts.target ?? null;
  if (target) {
    for (const name of HOLD_RELEASE_EVENTS) target.addEventListener(name, onGlobalUp);
  }

  const dispose = (): void => {
    if (target) {
      for (const name of HOLD_RELEASE_EVENTS) target.removeEventListener(name, onGlobalUp);
    }
    held = false;
    disposed = true;
  };

  return {
    get held() {
      return held;
    },
    down,
    up,
    screenChanged,
    dispose,
  };
}
