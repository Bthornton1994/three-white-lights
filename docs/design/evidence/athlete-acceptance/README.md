# Athlete acceptance harness — the route is live, and it reports ASSET_MISSING

**What this is:** the record of `node tools/athleteAccept.mjs --web` against a
server started by `tools/dev-web.sh` (a `--clear` restart, so the bundle is
the shipped source), in a real Chromium (Playwright, 390×844, DPR 2), on the
tree that landed the harness. `accept.json` is the machine record;
`route.png` is the harness route as it stood.

**What it proves, today:** the dev-only acceptance route
(`?dev-rive-spike=1&dev-mode=athlete-accept`) mounts on the web host in
19.6 s cold, is behind exactly the spike's gate (`__DEV__` and the spike key —
`dev-mode` alone opens nothing), carries the six canonical scenarios and their
tick counts in its probe (126 / 231 / 103 / 181 / 110 / 279 ticks of the real
mechanic), reports `ASSET_MISSING` because `src/session/athleteAsset.ts` still
points at the invalid placeholder, mounts NO stage and substitutes NO
diagnostic asset for an athlete, and raises 0 page errors. The gate's verdict
was `ATHLETE_ACCEPT: ASSET_MISSING`, exit 2 — the mechanical gates are armed
and nothing has arrived.

**What it does not prove:** anything about an athlete. When
`assets/athlete/athlete-01.riv` lands and `athleteAsset.ts` is repointed
(`athleteAsset.test.ts` pins both halves together), the same command follows
every scenario through the probe, reads the canvas back per scenario (0 changed
pixels is BOUND, not DRIVEN), samples rAF pacing, and writes screenshots per
scenario — that run replaces this one. VISUAL, ANIMATION, SOFT-FEEL and OWNER
PLAYTEST are printed as OWED by the tool and are never claimed by it.
