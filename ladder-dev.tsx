/**
 * ladder-dev.tsx — the dev-only mount for the §5.11 stage gates.
 *
 *     npm ci
 *     npx vite --open /ladder-dev.html
 *
 * Vite serves this zero-config from the repository root; `ladder-dev.html` is
 * the page and this file is its one module script. It exists so a human can
 * play `src/empire/ladderView.tsx`'s `GymView` — the stage-2 gate's
 * instrument, covering the full stage-1+2 loop — see that component's header
 * for what the render test covers and what only the human gate can answer.
 * `LadderView`, the closed stage-1 gate's own instrument, stays in that file
 * unmounted; its colocated test is the record of the gate that already
 * played.
 *
 * This is the one place the view's state hook lives. Everything of substance
 * — the reducer, the transitions, the numbers — is imported; this file mounts
 * and nothing else, so it stays outside every census on purpose and has
 * nothing in it worth a census's attention: no literal, no copy, no math.
 */

import { StrictMode, useReducer } from 'react';
import { createRoot } from 'react-dom/client';
import { GymView, createGymViewState, gymViewReduce } from './src/empire/ladderView';

function LadderDevApp() {
  const [state, dispatch] = useReducer(gymViewReduce, undefined, createGymViewState);
  return <GymView state={state} dispatch={dispatch} />;
}

const mount = document.getElementById('ladder-root');
if (mount === null) {
  throw new Error('ladder-dev.html must carry an element with id ladder-root');
}
createRoot(mount).render(
  <StrictMode>
    <LadderDevApp />
  </StrictMode>,
);
