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
 * ONE GATE SESSION PER SITTING, AND IT OUTLIVES THIS COMPONENT
 * ---------------------------------------------------------------------------
 * `cutInGate.ts` §5 states the one thing it cannot defend against: a caller
 * that opens a second session mid-sitting hands itself a second slot.
 *
 * THE COUNT USED TO LIVE IN THIS COMPONENT'S REF, WHICH IS THE WRONG LIFETIME.
 * §12.3's refusal condition is about a SESSION; a `useRef` is about a MOUNT.
 * `AppShell.tsx` swaps `MeetScreen` and `SessionScreen` with a ternary, and both
 * screens early-return above their `<CutInHost>` — the result card and the
 * already-trained screen — so the app un-mounts this component in ordinary play
 * and the count came back at zero under the same `sessionId`.
 *
 * `cutInLedger.ts` is where the count lives now: one gate session per
 * `sessionId` for the life of the process. The ref is a cache of it. What is
 * still NOT survived is a reload, and that is stated rather than hidden — a
 * server-side counter is the real fix and it belongs with the Edge Function
 * (CLAUDE.md, GDD §9.2), not here.
 *
 * The mount effect is still keyed ON THE SESSION ID ALONE and still guards on
 * the ref's own id, and that guard is still load-bearing for a different reason
 * — see the comment on it, and the bug a browser found.
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
 * ---------------------------------------------------------------------------
 * THE DEBUG ROUTE, AND THE ONE PLATFORM READ OUTSIDE `App.tsx`
 * ---------------------------------------------------------------------------
 * `?cutin=<moment>` stages one cut-in so the overlay can be photographed
 * (`cutInPreview.ts`, `tools/capture-cutin.mjs`). Nothing about the played path
 * changes: with no such query string the preview is `null` and every line below
 * that mentions it is dead.
 *
 * READING `window` HERE IS A DEVIATION AND IT IS DISCLOSED RATHER THAN QUIET.
 * `App.tsx` is this project's platform edge and `src/shell/shellRoute.ts` turns
 * the string into a surface; the other three debug routes are resolved there and
 * handed down as props. This one is not, because the shell was another
 * builder's file in the wave that added it and a cut-in is an OVERLAY rather
 * than a surface, so it has no `ShellSurface` to be. `search` is a prop with the
 * platform read only as its default, so lifting it is a one-line change here
 * and one more prop in the shell when that file is editable again.
 */

import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { LICENSING_CATALOGUE } from '../licensing/partners';
import type { LicensingCatalogue } from '../licensing/catalogue';
import { CutInView } from './CutInView';
import {
  cutInAutoDismissMs,
  dismissCutIn,
  requestCutIn,
  type CutInBeat,
  type CutInSessionState,
  type LiveCutIn,
} from './cutInGate';
import { rememberCutInSession, resumeCutInSession } from './cutInLedger';
import { cutInPreviewFrom, cutInPreviewSessionFor, type CutInPreviewSession } from './cutInPreview';

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
  /**
   * DEBUG ONLY. A `location.search`-shaped string, or `null` for none.
   *
   * Defaults to the platform read — see the header for why that read is here
   * rather than in `App.tsx`, and what it would take to move it. Passing `null`
   * explicitly is how a caller opts a host out of the debug route entirely.
   */
  readonly search?: string | null | undefined;
  readonly children: React.ReactNode;
}

/**
 * `window.location.search`, or `null` where there is no URL.
 *
 * The same shape `App.tsx` uses. On native `window.location` does not exist and
 * every debug branch downstream is correctly dead.
 */
function platformSearch(): string | null {
  if (typeof window === 'undefined') return null;
  return window.location.search;
}

export function CutInHost({
  sessionId,
  seed,
  catalogue = LICENSING_CATALOGUE,
  search,
  children,
}: CutInHostProps): React.ReactElement {
  const { width } = useWindowDimensions();

  // DEBUG ONLY, AND `null` IN PLAY. Resolved once: the seed search inside it
  // walks real sessions, so it must not run per render.
  const preview = React.useMemo<CutInPreviewSession | null>(() => {
    const request = cutInPreviewFrom(search === undefined ? platformSearch() : search);
    return request === null ? null : cutInPreviewSessionFor(request);
  }, [search]);

  const activeSessionId = preview?.sessionId ?? sessionId;
  const activeSeed = preview?.seed ?? seed;

  // THE COUNT COMES FROM THE LEDGER, NOT FROM THIS MOUNT. A host that has been
  // un-mounted and re-mounted inside one sitting resumes the state that already
  // spent the slot. `resumeCutInSession` is idempotent, which is what makes it
  // safe in a `useRef` argument — that expression is evaluated on every render.
  const session = React.useRef<CutInSessionState>(
    resumeCutInSession({ sessionId: activeSessionId, seed: activeSeed }),
  );
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
    if (session.current.sessionId === activeSessionId) return;
    session.current = resumeCutInSession({ sessionId: activeSessionId, seed: activeSeed });
    setLive(null);
  }, [activeSessionId, activeSeed]);

  const offer = React.useCallback((beats: readonly CutInBeat[]) => {
    const decision = requestCutIn(session.current, beats);
    session.current = decision.state;
    // Written back on EVERY decision, not only on a fire, so a sitting that has
    // spent its slot is remembered as having spent it even if the host goes
    // away between the fire and the next beat.
    rememberCutInSession(decision.state);
    if (decision.outcome.kind === 'fire') setLive(decision.outcome.live);
  }, []);

  const dismiss = React.useCallback(() => {
    session.current = dismissCutIn(session.current);
    rememberCutInSession(session.current);
    setLive(null);
  }, []);

  // THE DEBUG ROUTE'S BEAT, OFFERED THROUGH THE SAME GATE AS EVERY OTHER ONE.
  // Not a bypass: the cap, the rate and the qualification all apply, and if the
  // gate refuses, the capture photographs an empty screen and says so.
  React.useEffect(() => {
    if (preview === null) return;
    offer(preview.beats);
  }, [preview, offer]);

  // It leaves on its own as well as on a tap. An interrupt that waits for
  // permission is a modal dialog.
  //
  // A FROZEN PREVIEW IS THE ONE EXCEPTION, and it is unreachable in play: the
  // whole beat is under two seconds, so a shutter cannot be relied on to land
  // inside it. `?cutin=<moment>&live=1` is the same preview with this clock
  // running, which is how the capture proves the timer really fires.
  React.useEffect(() => {
    if (live === null) return undefined;
    if (preview !== null && preview.frozen) return undefined;
    const timer = setTimeout(dismiss, cutInAutoDismissMs());
    return () => clearTimeout(timer);
  }, [live, dismiss, preview]);

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
