# Qualifying totals research — working notes

Branch `claude/qualifying-totals-research`, off `cd1dd05`.
**RESEARCH ONLY. Nothing here is wired into any module.**

The deliverable is `qualifying-totals.md`. Read that. These are the working
notes behind it — what was tried, what failed, and how to reproduce.

## Reproducing the derivation

```
git clone --depth 1 --filter=blob:none --sparse \
  https://gitlab.com/openpowerlifting/opl-data.git
cd opl-data
git sparse-checkout set meet-data/ipf meet-data/usapl meet-data/amp
# pinned at 698e4918cb583f21be70ccfcf6a33d69572357bc, retrieved 2026-08-14
```

then from the repository root:

```
node docs/research/qualifyingTotalsDerive.mjs <path-to-that-checkout>
QT_EQUIPMENT=Single-ply node docs/research/qualifyingTotalsDerive.mjs <path>
```

Runtime is about 40 seconds per pass on this machine. Both passes write into
`docs/research/`.

## Network reality of this sandbox

Probed with `curl -o /dev/null -w '%{http_code}'` through the session proxy.
Recorded because the next research piece will hit the same wall and should not
spend the time re-discovering it.

| host | result |
|---|---|
| `gitlab.com` | 301 (reachable) |
| `raw.githubusercontent.com` | 200 |
| `bitbucket.org` | 200 |
| `sourceforge.net` | 403 |
| every powerlifting federation domain tried | 403 / blocked |
| `en.wikipedia.org`, `www.google.com`, `web.archive.org` | blocked |

The allowlist is code-hosting infrastructure. **If a research task names a data
source, check first whether it is on a code host** — that decides the
methodology before any analysis starts, and in this piece it decided it
entirely.

## Things that went wrong and were fixed, in order

1. **Wrong federation directory.** `meet-data/pa` is Powerlifting Australia, not
   the American body. The right directory is `meet-data/amp`, found by reading
   the dataset's own `crates/opltypes/src/federation.rs`.
2. **A dead constant with a comment asserting the opposite.**
   `DROP_BELOW_LIGHTEST_CLASS: true` claimed under-lightest lifters were dropped
   while `classFor` folded them up. The fold is correct for the sport; the
   constant and its comment were wrong and are replaced by
   `FOLD_UNDER_LIGHTEST_CLASS_UP` with the reasoning written down.
3. **Tier regexes admitted the wrong meets.** See §4.2 of the deliverable.
4. **A real project name at `code` position.** See §8.4.
5. **A captured test transcript in a scanned directory.** See §8.6(d). This one
   is the sharpest: it was invisible for exactly one run.

## What is deliberately NOT here

- No edit to `src/career/**`, `src/game/**`, `CLAUDE.md`, `.github/**`, or any
  existing test.
- No edit to `src/licensing/realIp.ts`. See §8.5 for why and for what closing it
  requires.
- No number from this research installed anywhere.
