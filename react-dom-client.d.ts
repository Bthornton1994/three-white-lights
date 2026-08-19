/**
 * react-dom-client.d.ts — the minimal typing `ladder-dev.tsx` needs for
 * `react-dom/client`, which ships untyped here (`@types/react-dom` is not
 * installed, and this build adds no npm dependencies). Named for the module
 * it types rather than for its consumer, because a same-basename
 * `ladder-dev.d.ts` is shadowed by `ladder-dev.tsx` under the include
 * wildcard's extension priority and silently drops out of the program. Only
 * what the dev mount calls is declared, so a wider use of react-dom stays a
 * type error rather than quietly `any`.
 */
declare module 'react-dom/client' {
  import type { ReactNode } from 'react';
  export interface Root {
    render(children: ReactNode): void;
    unmount(): void;
  }
  export function createRoot(container: Element | DocumentFragment): Root;
}
