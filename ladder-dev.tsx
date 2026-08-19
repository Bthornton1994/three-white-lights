/**
 * ladder-dev.tsx — the dev-only mount for the §5.11 stage-1 gate.
 *
 *     npm ci
 *     npx vite --open /ladder-dev.html
 *
 * Vite serves this zero-config from the repository root; `ladder-dev.html` is
 * the page and this file is its one module script. It exists so a human can
 * play `src/empire/ladderView.tsx` — see that view's header for what the
 * render test covers and what only the human gate can answer.
 *
 * This is the one place the view's state hook lives. Everything of substance
 * — the reducer, the transitions, the numbers — is imported; this file mounts
 * and nothing else, so it stays outside every census on purpose and has
 * nothing in it worth a census's attention: no literal, no copy, no math.
 */

import { StrictMode, useReducer } from 'react';
import { createRoot } from 'react-dom/client';
import { LadderView, createLadderViewState, ladderViewReduce } from './src/empire/ladderView';

function LadderDevApp() {
  const [state, dispatch] = useReducer(ladderViewReduce, undefined, createLadderViewState);
  return <LadderView state={state} dispatch={dispatch} />;
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
