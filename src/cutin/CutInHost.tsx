/**
 * CutInHost.tsx — where one sitting's gate state lives, and the only thing that
 * mounts a cut-in.
 *
 * ---------------------------------------------------------------------------
 * THE HOST OWNS THE SESSION; THE LEAF VIEWS ONLY REPORT BEATS
 * ---------------------------------------------------------------------------
 * GDD §7.2's cap is per SESSION, and no leaf view knows what a session is: the
 * walk-out sees one attempt, the close-out sees one day's last screen. So the
 * gate state sits here, above the whole loop, and the screens below call
 * `useOfferCutIn` with what just happened.
 *
 * A leaf view therefore CANNOT fire a cut-in. It can only describe a beat, and
 * `cutInGate.ts` decides. That is the shape §7.2's "hard gate" needs — a rule a
 * caller could route around is a convention, not a gate.
 *
 * ---------------------------------------------------------------------------
 * ONE GATE SESSION PER SITTING, KEYED ON ITS ID
 * ---------------------------------------------------------------------------
 * `cutInGate.ts` §5 states the one thing it cannot defend against: a caller
 * that opens a second session mid-sitting hands itself a second slot. This is
 * where that is defended. The session is opened in an effect keyed ON THE
 * SESSION ID ALONE, so re-rendering, navigating away and back, or a parent
 * re-mounting a child does not reset the count — only a genuinely new sitting
 * does, and `cutInWiring.test.ts` reads this file to check the dependency list
 * still says that.
 *
 * ---------------------------------------------------------------------------
 * IT IS A REF, NOT STATE, AND THAT IS DELIBERATE
 * ---------------------------------------------------------------------------
 * The gate session is in a `useRef`; only the LIVE cut-in is React state. Two
 * reasons, and the first is the load-bearing one:
 *
 *   - `offer` has to be a STABLE callback, because the leaf views call it from
 *     effects. A callback that changed identity whenever the count changed
 *     would re-run those effects and offer the same beat again — which the cap
 *     would refuse, but only after the fact, and the second offer of a beat is
 *     exactly the shape of accident this piece exists to make impossible.
 *   - Nothing renders the count. What renders is the cut-in.
 *
 * NOTHING HERE IS PERSISTED, for the reason `useMeetDay` gives about its own
 * stand-in record: persistence is the server's job (CLAUDE.md, GDD §9.2). The
 * cost is stated rather than hidden — a reload mid-session hands the sitting a
 * fresh slot. A server-side counter is the fix and it belongs with the Edge
 * Function, not here.
 */

import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { LICENSING_CATALOGUE } from '../licensing/partners';
import type { LicensingCatalogue } from '../licensing/catalogue';
import { CutInView } from './CutInView';
import {
  cutInAutoDismissMs,
  dismissCutIn,
  openCutInSession,
  requestCutIn,
  type CutInBeat,
  type CutInSessionState,
  type LiveCutIn,
} from './cutInGate';

/** What a leaf view can do: describe a beat. It cannot fire anything. */
export interface CutInApi {
  readonly offer: (beats: readonly CutInBeat[]) => void;
}

/**
 * The default is a no-op, so a screen rendered outside a host — a preview
 * capture, a standalone render — simply never shows a cut-in rather than
 * throwing. An interrupt is the one feature whose absence is safe.
 */
const NO_HOST: CutInApi = Object.freeze({ offer: () => undefined });

const CutInContext = React.createContext<CutInApi>(NO_HOST);

export interface CutInHostProps {
  /**
   * The sitting this gate session belongs to. `cutInSessionId(kind, day)`.
   *
   * ONE PER TRAINING DAY, ONE PER MEET (GDD §7.2 as read in `cutInGate.ts` §3).
   * Changing it opens a fresh session with a fresh slot, so it must not be
   * derived from anything that moves within a sitting.
   */
  readonly sessionId: string;
  /** `cutInSessionSeed(kind, day)`. The scarcity rolls come from this. */
  readonly seed: number;
  /** Defaults to the fictional-placeholder table (GDD §7.3, §12.3). */
  readonly catalogue?: LicensingCatalogue | undefined;
  readonly children: React.ReactNode;
}

export function CutInHost({
  sessionId,
  seed,
  catalogue = LICENSING_CATALOGUE,
  children,
}: CutInHostProps): React.ReactElement {
  const { width } = useWindowDimensions();
  const session = React.useRef<CutInSessionState>(openCutInSession({ sessionId, seed }));
  const [live, setLive] = React.useState<LiveCutIn | null>(null);

  // A NEW SITTING, AND ONLY A NEW SITTING, GETS A NEW SLOT.
  //
  // THE GUARD IS THE LOAD-BEARING LINE, NOT THE DEPENDENCY LIST, and it is here
  // because of a bug this file had and a browser found. React runs effects
  // BOTTOM-UP: every child's effect fires before the parent's. So a mount
  // effect that unconditionally re-opened the session threw away the cut-in the
  // walk-out had just been granted, one tick after granting it — the gate was
  // correct, the wiring was correct, and nothing ever appeared on screen. No
  // unit test in this repository could have seen that, because none of them
  // mounts a component.
  //
  // Comparing the ref's own `sessionId` makes the effect idempotent: on mount it
  // does nothing, because the ref was built with this id already.
  React.useEffect(() => {
    if (session.current.sessionId === sessionId) return;
    session.current = openCutInSession({ sessionId, seed });
    setLive(null);
  }, [sessionId, seed]);

  const offer = React.useCallback((beats: readonly CutInBeat[]) => {
    const decision = requestCutIn(session.current, beats);
    session.current = decision.state;
    if (decision.outcome.kind === 'fire') setLive(decision.outcome.live);
  }, []);

  const dismiss = React.useCallback(() => {
    session.current = dismissCutIn(session.current);
    setLive(null);
  }, []);

  // It leaves on its own as well as on a tap. An interrupt that waits for
  // permission is a modal dialog.
  React.useEffect(() => {
    if (live === null) return undefined;
    const timer = setTimeout(dismiss, cutInAutoDismissMs());
    return () => clearTimeout(timer);
  }, [live, dismiss]);

  const api = React.useMemo<CutInApi>(() => ({ offer }), [offer]);

  return (
    <CutInContext.Provider value={api}>
      <View style={styles.root}>
        {children}
        {live === null ? null : (
          <CutInView
            live={live}
            catalogue={catalogue}
            availableWidth={width}
            onDismiss={dismiss}
          />
        )}
      </View>
    </CutInContext.Provider>
  );
}

/** The gate, from inside a screen. */
export function useCutIn(): CutInApi {
  return React.useContext(CutInContext);
}

/**
 * REPORT WHAT JUST HAPPENED. The gate decides whether it is worth interrupting
 * for.
 *
 * Offered once per distinct set of beats, not once per render: the effect is
 * keyed on a JSON signature of the beats, because a screen rebuilds its array
 * on every render and the identity would otherwise change constantly. The cap
 * would refuse the repeats, but a hook that leans on the cap to cover its own
 * churn is a hook that has stopped saying what it means.
 *
 * An empty array is a screen saying "nothing here" and costs nothing.
 */
export function useOfferCutIn(beats: readonly CutInBeat[]): void {
  const { offer } = useCutIn();
  const latest = React.useRef<readonly CutInBeat[]>(beats);
  latest.current = beats;
  const signature = JSON.stringify(beats);
  React.useEffect(() => {
    if (latest.current.length === 0) return;
    offer(latest.current);
  }, [offer, signature]);
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
