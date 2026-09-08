# `rive-spike.riv` is not a real Rive asset — and that is now its only job

This file's bytes are deliberately invalid (not the `RIVE` magic-byte format),
with a NUL on purpose so `src/licensing/realIp.ts` classifies it as binary
and keeps it out of its text-extension census. Both runtimes reject it at
load — measured on web as the engine's own `Bad header` / `The file failed
to load`, and `tools/rivSchema.mjs` refuses it by magic before the engine is
asked. It is the ERROR-PATH FIXTURE: `src/art/rivContract.test.ts` pins that
an invalid file reads as invalid and diffs as every path missing, and
`src/dev/riveRuntimeSpike/riveSpikeTypes.test.ts` pins that it is still not
a Rive file. `src/session/athleteAsset.ts` still points at it, because no
production athlete `.riv` exists and the standing rule is no placeholder
athlete — the production stage pair mounts nowhere until one does.

**The spike no longer loads this file.** Since 2026-09-08 it loads
`assets/dev/quick_start.riv`, a real, MIT-licensed test asset — see
`THIRD-PARTY-RIVE-ASSETS.md` beside it for provenance, hash and licence text.

**The earlier claim, corrected rather than deleted.** A previous version of
this README said no legally usable `.riv` was obtainable here. The two facts
it rested on are still true: `cdn.rive.app` is not reachable (`CONNECT
tunnel failed, response 403`), and no npm-published Rive package bundles a
`.riv` in its tarball (zero across six packages, checked). The conclusion
was false, because a third channel was never tried: this sandbox's git path
to the source host is open, and the vendor's own runtime repositories are
MIT with their example assets committed in-tree. "We looked and found none"
was a measurement at the channels somebody happened to try, read as a
property — the shape CLAUDE.md warns about, one level out from tests.
