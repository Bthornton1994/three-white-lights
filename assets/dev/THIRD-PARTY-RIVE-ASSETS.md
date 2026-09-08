# Third-party Rive test assets under `assets/dev/` — provenance and licence

**Dev-only fixtures. Not an athlete. Never on the player path.** These two
files exist so the runtime spike (`src/dev/riveRuntimeSpike/`, ADR-001 §7)
can draw a REAL articulated scene under a continuous ViewModel write stream,
and so the `.riv` schema reader (`tools/rivSchema.mjs`, consumed by
`src/art/rivContract.ts`) has real files to read. Neither is imported by
`AppShell.tsx`, `shellRoute.ts`, or any lift stage a player reaches.

| File | Upstream path | SHA-256 | Exposes (default ViewModel) |
| --- | --- | --- | --- |
| `quick_start.riv` (194,281 bytes) | `example/assets/rive/quick_start.riv` | `9571c07e95c2bbf3a60f7e8ca73812e6c7b2916233dbfea9e0dd2394bed786a9` | `health_bar_01`: `health` number, `healthColor` color, `hoverYes` / `hoverNo` boolean, `gameOver` trigger |
| `rewards.riv` (216,976 bytes) | `example/assets/rive/rewards.riv` | `455a1652230d6cf088fb1388fb6bd417f920f6092b56375211b1d714660b6398` | `Rewards`: nested ViewModels (`Coin/Item_Value`, `Energy_Bar/Bar_Color`, `Button/Pressed`, …) — the nested-path grammar the athlete rig's `plates/<i>/…` paths use |

**Source:** the vendor's own React Native runtime repository,
`github.com/rive-app/rive-nitro-react-native`, commit
`f332c88ac57d285ba24da6dbcaad02ec33bd2d9e` (shallow clone over this
sandbox's git path on 2026-09-08). Both files are committed in that
repository's tree (not LFS pointers — `.gitattributes` carries no LFS rule;
each begins with the `RIVE` magic). The example source that loads them
(`example/src/demos/QuickStart.tsx`, `example/src/exercisers/
RiveDataBindingExample.tsx`) cites no marketplace listing for either — two
OTHER example assets in that tree do, and were deliberately not taken,
because a marketplace listing carries its own terms.

**Licence:** the repository carries one `LICENSE` at its root and no
asset-specific notice, so the files are distributed under it. Verbatim:

```
MIT License

Copyright (c) 2025 Rive
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

**What this does and does not settle.** It settles that a legally usable,
real, articulated `.riv` can be obtained from here — the placeholder's README
said no redistributable one existed, and that was true of npm tarballs and
of the vendor's asset host, both still blocked, and false of the git path.
It does NOT settle the athlete: these are a health bar and a rewards card.
No production asset, and no visual gate, moves because of them. The
`REVIEWABLE_CITATIONS` census in `src/licensing/realIp.ts` is a human's to
edit; the vendor's name appears here because the licence text requires the
copyright notice verbatim, and this file is a `.md` under `assets/`, outside
that census's text-extension walk of `src/`, `CLAUDE.md` and `docs/GDD.md` —
checked by running `src/licensing/realIp.test.ts` after adding it.
