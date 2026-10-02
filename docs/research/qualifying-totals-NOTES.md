# Qualifying totals research — working notes

Branch `claude/qualifying-totals-research`, off `cd1dd05`, merged with the
integration tip for the second pass.
**RESEARCH ONLY. Nothing here is wired into any module.**

The deliverable is `qualifying-totals.md`. Read that. These are the working
notes behind it — what was tried, what failed, and how to reproduce.

## Reproducing the derivation

```
git clone --depth 1 --filter=blob:none --sparse \
  https://gitlab.com/openpowerlifting/opl-data.git
cd opl-data
git sparse-checkout set meet-data/ipf meet-data/usapl meet-data/amp
git checkout 698e4918cb583f21be70ccfcf6a33d69572357bc   # retrieved 2026-08-14
```

then from the repository root:

```
node docs/research/qualifyingTotalsDerive.mjs <path-to-that-checkout>
QT_EQUIPMENT=Single-ply node docs/research/qualifyingTotalsDerive.mjs <path>
git diff --exit-code docs/research/          # regeneration is byte-idempotent

node docs/research/qualifyingTotalsDerive.mjs <path> --check-doc
QT_EQUIPMENT=Single-ply node docs/research/qualifyingTotalsDerive.mjs <path> --check-doc
```

A pass takes about 3 seconds on a warm page cache and about 40 on a cold one.
Both passes write into `docs/research/`; `--check-doc` writes nothing and only
reads.

**Exit codes are the point of the tool, not decoration.** 0 clean, 2 usage,
3 the emitted table broke one of its own structural properties, 4 the
deliverable disagrees with a fresh run. Anything that prints a number and cannot
exit non-zero when it is wrong is the failure mode CLAUDE.md calls
"measured, carried, displayed, never compared".

The rejected worlds designations stay runnable, into a scratch directory so the
committed artifacts are not clobbered:

```
QT_WORLDS_METHOD=tier-field-percentile \
  node docs/research/qualifyingTotalsDerive.mjs <path> /tmp/qt-p10     # exits 3
```

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

### First pass

1. **Wrong federation directory.** `meet-data/pa` is Powerlifting Australia, not
   the American body. The right directory is `meet-data/amp`, found by reading
   the dataset's own `crates/opltypes/src/federation.rs`.
2. **A dead constant with a comment asserting the opposite.**
   `DROP_BELOW_LIGHTEST_CLASS: true` claimed under-lightest lifters were dropped
   while `classFor` folded them up. The fold is correct for the sport; the
   constant and its comment were wrong and are replaced by
   `FOLD_UNDER_LIGHTEST_CLASS_UP` with the reasoning written down.
3. **Tier regexes admitted the wrong meets.** See §4.2 of the deliverable.
4. **A real project name at `code` position.** See §8.3.
5. **A captured test transcript in a scanned directory.** See §8.4(c). This one
   is the sharpest: it was invisible for exactly one run.

### Second pass

6. **The top tier was derived from the wrong population**, which is the whole of
   §3.6. The tell was in the first pass's own §3.4 and was written down there as
   a weakness rather than acted on: a gate cleared by 45–95% of the tier below is
   not a gate.
7. **A hypothesis that had to be retracted rather than quietly dropped.** The
   frame in §1.2 predicts that a *gated* tier's field is truncated at its floor.
   It is not — measured, the gated tier's left tail is the longest of the three.
   The reason is that the recorded total is the performance on the day and the
   qualifying total was earned at an earlier meet. That weakens every cell in the
   table, not one of them, so it is in §1.2 rather than in a footnote.
8. **A statistic that would have been read as evidence and is arithmetic.** A
   P10 gate is cleared by ~90% of the population it was taken from, always. The
   first pass reported own-field clearance beside tier-below clearance in the
   generated tables with nothing distinguishing them. There is now a structural
   check asserting the identity, so the number can never be quoted as a finding.
9. **A claim key whose name said the opposite of its value.**
   `count.tierComparisonsGuaranteed` was populated with the count of comparisons
   *not* guaranteed. Nothing would have caught it — the number was right and the
   label was wrong, which is the shape that reaches prose intact.
10. **A marker keyed to the wrong tier.** The ungated-population marker was first
    computed from the cell's own tier, which is wrong under a mixed method: a
    quota cell at `worlds` is computed from the nationals field and inherits
    *that* field's regime. Keyed the first way, the alternative table in §3.3
    would have marked nothing at all, when in fact two of its three columns are
    ungated.

## What is deliberately NOT here

- No edit to `src/career/**`, `src/game/**`, `CLAUDE.md`, `.github/**`, or any
  test other than the citation registration named below.
- **No tuning module.** The `DERIVATION` block in the script is the knob home for
  the derivation; nothing in `src/` was created or touched to hold these numbers.
- No number from this research installed anywhere.

## What IS edited outside `docs/research/`, and why

On an explicit human ruling, the real-name citations this module introduces are
**registered** rather than exempted — `src/licensing/realIp.ts`'s
`REVIEWABLE_CITATIONS` and `EXTENSIONS_READ_AS_TEXT`, plus the project-name prose
pin in `src/licensing/realIp.test.ts`. Exact counts, both directions, no ignore
list and no widened pattern. §8 of the deliverable has the scope of that ruling
and the rows. The census was taken **after** the prose was final, because a
census of a document still being edited is stale before it is committed.
