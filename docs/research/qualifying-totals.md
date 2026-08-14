# Qualifying totals — sourced research, tier x gender x weight class

**Status: RESEARCH ONLY. Wired into nothing. Reviewed by nobody yet.**

Produced on branch `claude/qualifying-totals-research` off `cd1dd05`, 2026-08-14.
Second pass 2026-08-14, on four rulings recorded in §10.

A human ruling put this piece under an explicit restriction and it is honoured:
**nothing here is wired into `CareerLifter`, `careerTuning.ts`, or any other
implementation.** `src/career/**`, `src/game/**`, `CLAUDE.md`, `.github/**` and
every existing test other than the citation registration in §8 are untouched by
this branch. The numbers below are for a human to review before any of them
becomes a constant.

**Read section 6 before using any number.** Three of the four named sources are
hard-blocked from this environment and could not be read at all; the fourth was
reachable only as raw data, not as published standards.

**THE TABLE IS MIXED-METHOD AND EVERY CELL SAYS SO.** Three of the four tiers are
a percentile of their own field; the top tier is not, because its field is
filled by national quota rather than by standard and a percentile of it measured
the smallest quota holder. The mixing is declared in §1.1, marked on every cell
that carries it, and derived in §3.6. Half the cells additionally carry a marker
saying they come from an **ungated** population and are **not** qualifying
standards at all.

**Every number in this document is re-derivable by one command**, and the
document is machine-checked against it. See §1.4.

---

## 0. Why this exists

`src/career/careerTuning.ts` currently ships one flat number per tier —
`{ local: null, regional: 400, nationals: 550, worlds: 650 }` — and its own
comment says so plainly: *"THE LEAST EVIDENCED NUMBERS IN THIS FILE… They are
not read off any published qualifying table."* It also predicts this document's
finding: *"ONE NUMBER PER TIER IS A SIMPLIFICATION AND A REAL LIFTER WILL SPOT
IT. A published qualifying total is a table: a row per weight class, a column
per sex."*

The ruling that commissioned this work settles that: **qualifying totals are
keyed by both gender and weight class.** This document supplies the sourced
table. It does not install it.

---

## 1. Methodology

### 1.1 The methods used, and where each one applies — DECLARED, NOT BLENDED

| tier | how entry to that field is controlled | designation used | what the number is |
|---|---|---|---|
| `local` | **open** — anybody may enter | P10 of the tier's own field | descriptive only. **Not a gate.** §4.7 |
| `regional` | **open** — anybody may enter | P10 of the tier's own field | descriptive of an open field. **Not a qualifying standard.** §4.2 |
| `nationals` | gated — entry needs a published qualifying total | P10 of the tier's own field | the closest thing here to a standard, with the caveat in §1.2 |
| `worlds` | **quota** — entry is a national allocation | **top 25% of the NATIONALS field** | a selection standard applied to the field a lifter is actually picked from. §3.6 |

Two markers carry those caveats onto the cells themselves, in every table in
this document and in every generated artifact beside it:

- **†  DERIVED FROM AN UNGATED POPULATION.** Entry to those meets is open —
  anybody may enter, nothing had to be cleared to be in that field. The number
  describes what the people who showed up totalled. **It is not a qualifying
  standard and no lifter in it had to meet one.**
- **‡  MIXED METHOD: this cell is not the same statistic as the unmarked ones.**
  It is the total reached by the strongest 25% of the tier below, not a
  percentile of this tier's own field.

The markers are on individual cells rather than on column headings on purpose:
a caveat in a heading is one copy-paste from being separated from its data, and
§10's ruling on this said exactly that. `qualifyingTotalsDerive.mjs` emits the
same markers into the `.md` artifacts and the equivalent booleans
(`openEntryPopulation`, `isQualifyingStandard`, `method`, `entryRegime`,
`designatedFromTier`, `populationCaveat`) into the `.json` ones, and a structural
check fails the run if any ungated cell is unmarked **or** any gated one is
marked.

### 1.2 What the entry regime does to the estimate — the frame the rest of this rests on

A percentile of a field is only a qualifying standard if something had to be
cleared to be in that field. Three regimes appear here and they are not
interchangeable:

- **Open.** Anyone may enter. The distribution is of whoever turned up, and its
  10th percentile is a fact about local participation, not about a standard.
  This is `local` and `regional`.
- **Gated.** Entry requires a qualifying total earned at an earlier meet. The
  field has been filtered by a standard.
- **Quota.** Entry is a per-nation allocation. The field is the world's best
  **plus** one or two entrants from every federation holding a place, so its low
  percentiles measure the smallest allocation. This is `worlds`, and §3.6 is the
  measurement.

**One thing this document tried to establish and could not, stated because it
weakens every cell rather than one of them.** If a gated field really were
filtered at its floor, its minimum would sit just under its gate. It does not.
The median of (P10 − minimum) over the cells of each tier is
**155.0**<!--@raw:leftTail.nationals.medianDropKg--> kg at the gated tier against
**100.5**<!--@raw:leftTail.worlds.medianDropKg--> kg at the quota tier and
**182.5**<!--@raw:leftTail.local.medianDropKg--> kg at the open one — the gated
tier's tail is the *longest* of the three, not the shortest.

The reason is mechanical: **a lifter qualifies at an earlier meet, and the total
recorded at the championship is the performance on the day.** Someone who
qualified at 630 and then went nine-for-nine wrong records 415. So no percentile
of any of these fields recovers a published standard, at any tier, and none of
the numbers below should be described as "the qualifying total" — they are
percentiles of competition results, designated as gates by the rules in §1.1.

### 1.3 Why derived at all, rather than transcribed from the published tables

**Because the published tables are not retrievable from this environment, and the
alternative was to relay numbers I cannot read.** That is a hard fact about the
sandbox, not a preference:

| Source | URL attempted | Result |
|---|---|---|
| International federation | `https://www.powerlifting.sport/` | `curl: (56) CONNECT tunnel failed, response 403` |
| USA Powerlifting | `https://www.usapowerlifting.com/lifters-corner/qualifying-totals/` | `curl: (56) CONNECT tunnel failed, response 403` |
| Powerlifting America | `https://powerlifting-america.com/` | `curl: (56) CONNECT tunnel failed, response 403` |
| OpenPowerlifting (site) | `https://www.openpowerlifting.org/` | `curl: (56) CONNECT tunnel failed, response 403` |
| British Powerlifting | `https://www.britishpowerlifting.org/…/2026_Open_QT.pdf` | egress blocked |
| Canadian union standards PDF | `https://powerlifting.ca/org/pl_national_qt.pdf` | egress blocked |
| Web archive | `https://web.archive.org/` | egress blocked |

The egress policy on this session permits code-hosting infrastructure and
essentially nothing else — `gitlab.com`, `raw.githubusercontent.com` and
`bitbucket.org` answer; `en.wikipedia.org`, `google.com` and every federation
domain probed do not. The proxy README's instruction for a 403 is *"Do not retry
or route around it — report the blocked host."* That is what §6 does.

**What IS retrievable is the OpenPowerlifting project's source dataset**, whose
git repository is hosted on GitLab:

- `https://gitlab.com/openpowerlifting/opl-data.git`
- Dataset commit pinned: **`698e4918cb583f21be70ccfcf6a33d69572357bc`**
  (*"Disambiguate Jillian Cote. Closes #28762"*)
- Retrieved 2026-08-14. Latest meet inside the analysed range: **2026-08-01**.
- Data licence: the repository carries `LICENSE-DATA` (CC0) separately from its
  code licence. Read it before any redistribution of derived values.

So the choice is between a method with a real, pinned, byte-verifiable input and
a method whose inputs I would be transcribing from a search engine's summary of
a page I cannot open. **I have not blended them.** Every number in §3 comes from
the dataset above and from nothing else. The fragments a search engine relayed
from published tables are quarantined in §6.3, are explicitly marked unverified,
and are not in the table.

### 1.4 Reproducing and CHECKING every number here — the commands

`docs/research/qualifyingTotalsDerive.mjs`. Every methodology value in it — the
percentile, the quota fraction, the per-tier choice of method, the rounding step,
the date cut, the minimum cell size, the class boundaries, the equipment filter,
the excluded placings — is a named constant in one frozen `DERIVATION` block at
the top of the file, for the reason CLAUDE.md gives: these get turned by hand
later and a value buried in a function body is a value nobody can turn.

```
git clone --depth 1 --filter=blob:none --sparse \
  https://gitlab.com/openpowerlifting/opl-data.git
cd opl-data && git sparse-checkout set meet-data/ipf meet-data/usapl meet-data/amp
git checkout 698e4918cb583f21be70ccfcf6a33d69572357bc

# from the repository root — regenerate the committed artifacts
node docs/research/qualifyingTotalsDerive.mjs <path-to-that-checkout>
QT_EQUIPMENT=Single-ply node docs/research/qualifyingTotalsDerive.mjs <path>
git diff --exit-code docs/research/     # must be empty

# ...and CHECK THIS DOCUMENT against a fresh run
node docs/research/qualifyingTotalsDerive.mjs <path> --check-doc
QT_EQUIPMENT=Single-ply node docs/research/qualifyingTotalsDerive.mjs <path> --check-doc
```

`--check-doc` re-derives everything and compares it against this file: every
table under a `<!--TABLE …-->` marker cell by cell, and every number carrying an
inline `<!--@…-->` tag. It exits **4** and prints the block it expected on any
disagreement. The run itself exits **3** if the emitted table breaks one of its
own structural properties (§3.4).

**What that covers and what it does not, stated rather than implied — and that
statement is itself checked.** The raw run resolves
**82**<!--@raw:doc.taggedClaims--> tagged claims and
**256**<!--@raw:doc.tableCells--> table cells in
**6**<!--@raw:doc.tables--> tables, against
**941**<!--@raw:doc.numericLiterals--> numeric literals in this document. The
equipped run resolves a further **9**<!--@single-ply:doc.taggedClaims--> claims
and **32**<!--@single-ply:doc.tableCells--> cells in its own namespace. **The
remaining literals are prose** — section numbers, dates, URLs, kilo figures
quoted from unreachable sources, counts of things not derived from the dataset —
**and they are checked by nothing.**

Those four coverage numbers carry tags of their own, because a sentence claiming
how much checking happened is precisely the shape CLAUDE.md calls
*measured, carried, displayed, never compared*: it is the number a reader uses to
decide how much the rest is worth, and it was the number nothing compared. A tag
naming a key the script does not compute is a FAILURE rather than a skip, so a
typo cannot read as coverage, and the checker refuses to pass if fewer than
`DOC_CHECK_FLOORS` claims or cells resolve — otherwise deleting every tag would
make it green.

**AND THE CHECKER WAS MUTATION-TESTED WHEN IT WAS WRITTEN, because a checker
that passes is not evidence that it can fail.** Four mutants, applied to a copy
of this document, with the verbatim line each one produced. `MUTATION_WITNESSES`
cannot hold these — they are a tool's checks and have no `it(` body to bind to,
which CLAUDE.md names as a known hole in that schema — so they are recorded here
and in the commit that introduced them.

| mutant | what the checker said | exit |
|---|---|---|
| one table cell moved one rounding step: `735.0‡ (261)` → `737.5‡ (261)` | `FAIL raw:shipped-M row 83 col "worlds" — doc says "737.5‡ (261)", this run computes "735.0‡ (261)"` | 4 |
| one tagged scalar moved by one: `82` → `83` | `FAIL raw:worlds.belowGateLifters — doc says 83, this run computes 82` | 4 |
| every `<!--@…-->` and `<!--TABLE…-->` marker deleted | `FAIL ONLY 0 TAGGED CLAIMS RESOLVED in the raw namespace, floor is 40…` and two more | 4 |
| one claim key typo'd: `belowGateLifters` → `belowGateLifers` | `FAIL UNKNOWN CLAIM KEY raw:worlds.belowGateLifers` — plus the coverage claim itself moving 82 → 81 | 4 |

Outputs, all generated and all committed beside it:

- `qualifying-totals-derived-raw.md` / `.json` — the full ladder, raw
- `qualifying-totals-derived-single-ply.md` / `.json` — the equipped attempt
- `qualifying-totals-meets-raw.txt` — **every meet, its assigned tier, and how
  many rows it contributed**, so the tier mapping is checkable by reading rather
  than by trusting the regex

---

## 2. Filters, stated in full

The dataset's quality varies enormously across these dimensions and an
unfiltered pull produces garbage, so here is every filter, with counts.

| Filter | Value | Rows rejected |
|---|---|---:|
| Date range | `2021-01-01` .. present | 171,854<!--@raw:filter.outOfDateRange--> |
| Meet matched no tier rule | see §4.2 | 34,999<!--@raw:filter.noTier--> |
| Equipment | `Raw` only (no single-ply, no knee wraps) | 7,347<!--@raw:filter.equipment--> |
| Event | `SBD` only — full power, three lifts | 7,165<!--@raw:filter.event--> |
| Sex | `M` / `F`; `Mx` has no published class set | 70<!--@raw:filter.sex--> |
| Division | **Open only** (see §4.3) | 82,705<!--@raw:filter.division--> |
| Placing | not `DQ`, `NS`, `DD` or `G` (guest) | 2,603<!--@raw:filter.place--> |
| Total | present and > 0 | 0<!--@raw:filter.noTotal--> |
| Bodyweight | present and > 0 | 7<!--@raw:filter.noBodyweight--> |
| Name | non-empty | 3<!--@raw:filter.noName--> |

- **Meets scanned:** 5,245<!--@raw:meta.meetsScanned-->. **Entry rows read:**
  169,401<!--@raw:meta.rowsScanned-->.
- **Distinct lifter-tier-class records kept:** 49,854<!--@raw:meta.recordsKept-->.

**Tested vs untested:** all three source federations are drug-tested bodies, so
the entire input is tested. There is no untested arm in this table, and the game's
untested federation option has **no** empirical basis here. Named as a gap in §6.

**Raw vs equipped:** the shipped table is raw only. The equipped run is §5.

**Missing and disqualified entries:** a placing of `DQ`, `NS` (no show) or `DD`
(doctor's disqualification) is dropped, and so is `G` (guest), because a guest is
not entered in the meet's own ranking and is frequently visiting from another
federation. Note that `noTotal` rejected **0**<!--@raw:filter.noTotal--> rows:
after the placing filter, every remaining row carried a total, which is the
dataset's own checker doing its job rather than an absent check here.

**Deduplication — one vote per lifter, not one per meet.** A lifter who competes
eight times locally would otherwise contribute eight data points and drag the
distribution toward whoever competes most. Rows are reduced to **one record per
`(lifter, tier, weight class)`, keeping that lifter's best total.** This also
matches the game's gate semantics exactly: `qualifiesFor` reads a lifter's best
total, so the population the threshold is computed over should be lifters at
their best, not performances.

---

## 3. The table

### 3.1 Designated qualifying totals, kg — RAW / classic, Open division

**† = derived from an ungated, open-entry population. Not a qualifying standard;
nobody in that field had to clear anything. ‡ = quota method, computed from the
tier below rather than from this tier's own field.** Both legends in full in
§1.1; the reasoning is §4.2 and §4.7 for † and §3.6 for ‡.

`(n)` is the number of distinct lifters in **the population the number was
derived from** — which for a ‡ cell is the nationals field, not the worlds one.

#### Men

<!--TABLE raw:shipped-M-->
| class kg | local | regional | nationals | worlds |
|---|---:|---:|---:|---:|
| 59 | 267.5† (295) | 302.5† (69) | 417.5 (47) | 537.5‡ (47) |
| 66 | 350.0† (913) | 365.0† (200) | 515.0 (61) | 657.5‡ (61) |
| 74 | 390.0† (2956) | 425.0† (678) | 557.5 (146) | 672.5‡ (146) |
| 83 | 435.0† (5443) | 477.5† (1216) | 627.5 (261) | 735.0‡ (261) |
| 93 | 460.0† (5354) | 485.0† (1222) | 630.0 (169) | 802.5‡ (169) |
| 105 | 477.5† (4590) | 515.0† (1114) | 662.5 (215) | 807.5‡ (215) |
| 120 | 495.0† (2750) | 532.5† (709) | 730.0 (151) | 845.0‡ (151) |
| 120+ | 495.0† (1692) | 537.5† (490) | 737.5 (135) | 902.5‡ (135) |

#### Women

<!--TABLE raw:shipped-F-->
| class kg | local | regional | nationals | worlds |
|---|---:|---:|---:|---:|
| 47 | 175.0† (152) | 185.0† (48) | GAP (35) | GAP (35) |
| 52 | 205.0† (587) | 212.5† (151) | 310.0 (82) | 382.5‡ (82) |
| 57 | 222.5† (1144) | 247.5† (270) | 350.0 (94) | 420.0‡ (94) |
| 63 | 227.5† (2024) | 245.0† (489) | 360.0 (127) | 445.0‡ (127) |
| 69 | 245.0† (2551) | 265.0† (632) | 395.0 (152) | 465.0‡ (152) |
| 76 | 252.5† (2451) | 282.5† (572) | 392.5 (159) | 475.0‡ (159) |
| 84 | 255.0† (1816) | 280.0† (436) | 412.5 (111) | 495.0‡ (111) |
| 84+ | 257.5† (2820) | 287.5† (703) | 422.5 (181) | 535.0‡ (181) |

**62**<!--@raw:count.cellsWithNumber--> of
**64**<!--@raw:count.cells--> cells carry a number.
**2**<!--@raw:count.gaps--> are gaps — women's 47 kg at nationals and at worlds,
both resting on a nationals population of **35**<!--@raw:cell.nationals.F.47.n-->
lifters, below the 40-lifter floor. They are left empty rather than filled by
interpolation. (The worlds cell of that class has
**39**<!--@raw:cell.worlds.F.47.n--> lifters of its own, also below the floor, so
neither designation could have filled it.)

### 3.2 The worlds row, five ways — the numbers both ways, in one table

Each cell is `gate kg / the share of the NATIONALS field that clears it`. The
last column is what §3.1 ships. **`own P10` is what the first pass of this
document shipped**, and reading down that column against the `nationals gate`
column is the whole of §3.6's argument.

#### Men

<!--TABLE raw:worlds-methods-M-->
| class kg | nationals gate | own P10 | own P25 | own P50 | trimmed P10 | quota P75 (SHIPPED) |
|---|---:|---:|---:|---:|---:|---:|
| 59 | 417.5 | 500.0 / 44.7% | 535.0 / 27.7% | 555.0 / 17% | 500.0 / 44.7% | 537.5 / 25.5% |
| 66 | 515.0 | 567.5 / 60.7% | 605.0 / 34.4% | 632.5 / 29.5% | 567.5 / 60.7% | 657.5 / 26.2% |
| 74 | 557.5 | 580.0 / 82.2% | 620.0 / 62.3% | 680.0 / 22.6% | 600.0 / 73.3% | 672.5 / 26% |
| 83 | 627.5 | 627.5 / 90% | 685.0 / 59.4% | 732.5 / 28.7% | 672.5 / 71.3% | 735.0 / 25.7% |
| 93 | 630.0 | 670.0 / 84.6% | 710.0 / 73.4% | 755.0 / 46.2% | 677.5 / 82.8% | 802.5 / 25.4% |
| 105 | 662.5 | 680.0 / 87.9% | 745.0 / 67.4% | 802.5 / 29.3% | 712.5 / 81.9% | 807.5 / 25.6% |
| 120 | 730.0 | 722.5 / 91.4% | 802.5 / 48.3% | 847.5 / 24.5% | 782.5 / 60.3% | 845.0 / 25.8% |
| 120+ | 737.5 | 797.5 / 75.6% | 847.5 / 46.7% | 905.0 / 25.2% | 800.0 / 75.6% | 902.5 / 25.9% |

#### Women

<!--TABLE raw:worlds-methods-F-->
| class kg | nationals gate | own P10 | own P25 | own P50 | trimmed P10 | quota P75 (SHIPPED) |
|---|---:|---:|---:|---:|---:|---:|
| 47 | GAP | GAP | GAP | GAP | GAP | GAP |
| 52 | 310.0 | 322.5 / 84.1% | 350.0 / 62.2% | 382.5 / 29.3% | 332.5 / 73.2% | 382.5 / 29.3% |
| 57 | 350.0 | 347.5 / 91.5% | 387.5 / 53.2% | 410.0 / 35.1% | 380.0 / 59.6% | 420.0 / 27.7% |
| 63 | 360.0 | 367.5 / 85.8% | 397.5 / 61.4% | 440.0 / 27.6% | 380.0 / 77.2% | 445.0 / 26% |
| 69 | 395.0 | 382.5 / 94.7% | 417.5 / 71.1% | 460.0 / 31.6% | 412.5 / 77% | 465.0 / 28.9% |
| 76 | 392.5 | 425.0 / 71.7% | 455.0 / 47.2% | 492.5 / 17.6% | 432.5 / 67.3% | 475.0 / 27% |
| 84 | 412.5 | 435.0 / 74.8% | 462.5 / 55% | 520.0 / 14.4% | 435.0 / 74.8% | 495.0 / 27% |
| 84+ | 422.5 | 442.5 / 84.5% | 480.0 / 60.2% | 552.5 / 18.2% | GAP | 535.0 / 26.5% |

### 3.3 The quota designation applied at EVERY tier — an alternative, not shipped

The same rule the worlds row uses, run all the way down: **the total reached by
the strongest 25% of the tier below.** It answers "how big do I want the field"
instead of "who shows up".

**Two of its three columns are marked †, and that is the point of marking by
source rather than by tier:** a `regional` quota gate is the top quarter of the
*local* field and a `nationals` one is the top quarter of the *regional* field,
and both of those are open-entry populations. Using the quota rule at those tiers
does not escape §1.2's problem, it relocates it.

#### Men

<!--TABLE raw:quota-M-->
| class kg | regional | nationals | worlds |
|---|---:|---:|---:|
| 59 | 467.5† (295) | 477.5† (69) | 537.5 (47) |
| 66 | 507.5† (913) | 545.0† (200) | 657.5 (61) |
| 74 | 550.0† (2956) | 582.5† (678) | 672.5 (146) |
| 83 | 600.0† (5443) | 635.0† (1216) | 735.0 (261) |
| 93 | 630.0† (5354) | 662.5† (1222) | 802.5 (169) |
| 105 | 665.0† (4590) | 702.5† (1114) | 807.5 (215) |
| 120 | 692.5† (2750) | 742.5† (709) | 845.0 (151) |
| 120+ | 727.5† (1692) | 780.0† (490) | 902.5 (135) |

#### Women

<!--TABLE raw:quota-F-->
| class kg | regional | nationals | worlds |
|---|---:|---:|---:|
| 47 | 287.5† (152) | 297.5† (48) | GAP (35) |
| 52 | 315.0† (587) | 327.5† (151) | 382.5 (82) |
| 57 | 327.5† (1144) | 345.0† (270) | 420.0 (94) |
| 63 | 340.0† (2024) | 370.0† (489) | 445.0 (127) |
| 69 | 357.5† (2551) | 387.5† (632) | 465.0 (152) |
| 76 | 372.5† (2451) | 410.0† (572) | 475.0 (159) |
| 84 | 380.0† (1816) | 412.5† (436) | 495.0 (111) |
| 84+ | 402.5† (2820) | 437.5† (703) | 535.0 (181) |

It is much harsher at the lower tiers — a 467.5 kg gate on a men's 59 kg
*regional* entry asks for a strong lifter to enter a state championship, and real
state championships have no qualifying total at all. **Which designation ships at
the lower two tiers is a game-design call and is not made here.**

### 3.4 The ladder — a CONSTRAINT of the derivation, not an observation about it

A published qualifying table is monotone in both directions: a heavier class asks
for more, a higher tier asks for more. A percentile from a finite sample is not.
The tier direction is now a **constraint**: `LADDER_MUST_BE_MONOTONE_ACROSS_TIERS`
makes a table whose designated column ever falls or flattens from one tier to the
next a **failed run** — exit 3, offending cells named — rather than a table that
ships with a footnote.

Measured on the shipped table:

- Tier inversions or ties: **0**<!--@raw:count.tierInversions--> of
  **46**<!--@raw:count.tierComparisons--> comparisons.
- The ladder rises **strictly** at
  **46**<!--@raw:count.tierComparisonsStrict--> of those 46 steps, so no cell is
  carrying a gate that asks exactly what the tier below already asked.
- Weight-class inversions: **3**<!--@raw:count.classInversions--> of
  **54**<!--@raw:count.classComparisons--> comparisons —
  `regional F 57 → 63` (247.5 → 245.0), `regional F 76 → 84` (282.5 → 280.0),
  `nationals F 69 → 76` (395.0 → 392.5). Every one is exactly one 2.5 kg rounding
  step and all three are in the women's columns, where the cells are smallest.

**WHAT CAN ACTUALLY FAIL THAT LADDER CHECK, because a check that cannot fail is
worse than no check.** Of the 46 comparisons,
**15**<!--@raw:count.tierComparisonsGuaranteed--> — the nationals → worlds edge —
are **guaranteed by construction**: the worlds gate is the 75th percentile of the
very population the nationals gate takes its 10th from, and flooring is monotone,
so `P75 ≥ P10` is arithmetic. The other
**31**<!--@raw:count.tierComparisonsNotGuaranteed--> are genuinely measured.
The guarantee is not unconditional either — it holds only while
`100 − ADMIT_TOP_PCT_OF_TIER_BELOW > DESIGNATED_PERCENTILE`, and the check reads
those two knobs rather than assuming them.

That the check bites is demonstrated rather than asserted:

```
QT_WORLDS_METHOD=tier-field-percentile node docs/research/qualifyingTotalsDerive.mjs <path> /tmp/qt-p10
  FAIL  the tier ladder does not invert — INVERTED: M 83: nationals 627.5 -> worlds 627.5;
        M 120: nationals 730 -> worlds 722.5; F 57: nationals 350 -> worlds 347.5;
        F 69: nationals 395 -> worlds 382.5
  FAIL  the ladder rises strictly at every step — 42/46 strictly greater
  EMPTY quota cells name the population they came from — 0 quota cells
2 structural check(s) FAILED …   [exit 3]
```

**AND WHY THE CONSTRAINT IS NOT A REPAIR PASS.** The obvious alternative is to
raise every offending cell to the one below it. Computed on the counterfactual
table — the same cells with the worlds tier designated the old way, which the
shipped run computes for exactly this comparison rather than making you re-run
anything:

- **4**<!--@raw:counterfactual.ownP10.tierInversions--> inversions or ties, worst
  deficit **12.5**<!--@raw:counterfactual.ownP10.worstDeficitKg--> kg.
- A repair moves **3**<!--@raw:counterfactual.ownP10.repairMoves--> of them
  (M 120 +7.5 kg, F 57 +2.5 kg, F 69 +12.5 kg) and leaves
  **1**<!--@raw:counterfactual.ownP10.tierTies--> — men's 83 kg, where the two
  gates are already equal — **exactly where it is.** A tie is already monotone,
  so the repair does not see it, and a worlds gate identical to the nationals
  gate is a gate that does nothing.
- On the shipped table a repair would move
  **0**<!--@raw:count.monotoneRepairMoves--> cells, because there is nothing to
  repair once the top tier stops being derived from the wrong population.

So the repair pass fixes three cells cosmetically, cannot see the fourth, and
leaves the cause in place. The constraint fails the run instead, and the fix that
satisfies it is §3.6's change of population.

### 3.5 Clearance — what fraction of the tier BELOW already clears each gate

A gate everybody below clears is decoration. Measured on the shipped table:

| gate | cleared by the tier below | cells |
|---|---|---:|
| regional | **78.5**<!--@raw:clearance.regional.min-->% – **87.1**<!--@raw:clearance.regional.max-->% | 16<!--@raw:clearance.regional.cells--> |
| nationals | **22.5**<!--@raw:clearance.nationals.min-->% – **52.2**<!--@raw:clearance.nationals.max-->% | 15<!--@raw:clearance.nationals.cells--> |
| worlds | **25.4**<!--@raw:clearance.worlds.min-->% – **29.3**<!--@raw:clearance.worlds.max-->% | 15<!--@raw:clearance.worlds.cells--> |

**The clearance figure against a gate's OWN field is arithmetic and is not
reported here as evidence of anything.** A P10 gate is cleared by about 90% of
the population it was taken from whatever the numbers are; the script pins that
identity as a structural check (`own-field clearance is arithmetic, not
evidence`) precisely so it can never be quoted as a finding. The table above is
the informative direction: the population the player is coming up **from**.

The regional band is the weak row in that table for a different reason than it
looks: it says 4 in 5 local lifters already clear the regional gate, which is
what a percentile designation does — but the regional field it is measured
against is open-entry (†), so what is being cleared is not a standard.

### 3.6 Why `worlds` is derived from a different population — the measurement

**The first pass of this document designated every tier by P10 of its own field,
and at `worlds` that produced a number that was not a gate.** The evidence for
that was already in the first pass and is sharper now.

**(a) The gate did not gate.** Under P10 of the worlds field, the gate was
cleared by **44.7**<!--@raw:worlds.selectivity.ownP10.min-->% to
**94.7**<!--@raw:worlds.selectivity.ownP10.max-->% of the nationals field — in
men's 120 kg, 91.4% of the national field already cleared the world gate.

**(b) It inverted the ladder in four cells**, listed in §3.4. In a game whose
tiers are a ladder that is not a rounding artifact; it is the ladder running
backwards.

**(c) The cause, measured.** A world championship field is not a distribution of
the world's best. It is that distribution **plus** the entrants of every
federation holding a quota place. Across the 15 measurable cells the worlds field
holds **1191**<!--@raw:worlds.fieldLifters--> lifters, of whom
**82**<!--@raw:worlds.belowGateLifters--> total **less than their own class's
nationals gate**. Per cell that contaminated band runs from
**1.9**<!--@raw:worlds.contaminationMinPct-->% to
**14.3**<!--@raw:worlds.contaminationMaxPct-->%. The single sharpest number: the
minimum total in the men's 74 kg worlds cell is
**307.5**<!--@raw:cell.worlds.M.74.min--> kg, against a nationals P10 of
**557.5**<!--@raw:cell.nationals.M.74.designated--> kg.

**(d) And that is exactly why P10 specifically failed there.** A P10 estimator
lands inside a contaminated band whenever the band is wider than 10%. The two
predicates — *"this cell's sub-standard band is wider than the percentile being
taken"* and *"this cell inverts under P10"* — **agree in
15<!--@raw:worlds.contaminationPredictsInversion--> of
15<!--@raw:worlds.cellsPaired--> cells**:
**4**<!--@raw:worlds.cellsContaminatedBeyondPercentile--> cells are contaminated
past the percentile and
**4**<!--@raw:worlds.cellsInvertingUnderOwnFieldP10--> invert, and they are the
same four. The diagnosis is mechanical, not a story fitted to four cells.

**(e) Supporting but weak, with its base rate attached.** Of the 82 sub-standard
entrants, **67.1**<!--@raw:worlds.smallDelegationBelowGatePct-->% come from a
delegation of two or fewer in that cell — against a base rate of
**53.6**<!--@raw:worlds.smallDelegationBaseRatePct-->% across the whole worlds
field. That is elevated by 13.5 points, which is consistent with the quota story
and is nowhere near proof of it. It is reported with its base rate because the
first figure alone would read as decisive and is not.

#### The three candidate fixes, and why the shipped one won

| candidate | selectivity against the nationals field | verdict |
|---|---|---|
| keep `own P10` | **44.7**<!--@raw:worlds.selectivity.ownP10.min-->% – **94.7**<!--@raw:worlds.selectivity.ownP10.max-->% | rejected: (a)–(d) |
| trim the population to entrants clearing the nationals gate, then P10 | **44.7**<!--@raw:worlds.selectivity.trimmed.min-->% – **82.8**<!--@raw:worlds.selectivity.trimmed.max-->% | **rejected on measurement** |
| `own P50` — same population, different percentile | **14.4**<!--@raw:worlds.selectivity.ownP50.min-->% – **46.2**<!--@raw:worlds.selectivity.ownP50.max-->% | viable, rejected on the spread |
| **quota: top 25% of the nationals field** | **25.4**<!--@raw:worlds.selectivity.quota.min-->% – **29.3**<!--@raw:worlds.selectivity.quota.max-->% | **shipped** |

- **Trimming was the obvious repair and it does not work.** Removing everyone
  below the nationals gate and re-taking P10 still leaves a gate that 82.8% of
  the national field clears in men's 93 kg, because the contamination is 2–14% of
  the field and P10 sits just above it rather than clear of it. It also costs a
  cell: the trimmed women's 84+ population is
  **38**<!--@raw:cell.worlds.F.84+.trimmedN--> lifters, under the 40 floor, so
  that cell becomes a GAP and the method covers
  **14**<!--@raw:worlds.selectivity.trimmed.cells--> cells instead of
  **15**<!--@raw:worlds.selectivity.quota.cells-->.
- **`own P50` works numerically and loses on consistency.** It keeps the
  population and moves the percentile, which is the smaller deviation to
  describe, and it rises above the nationals gate in every cell. But the *same
  nominal rule* is three times as selective in one class as another —
  14.4% of the national field clears it in women's 84 kg against 46.2% in men's
  93 kg. Applied to a player, that means the path from nationals to worlds is
  three times harder in one weight class than in another for no reason anybody
  designed. It is also no longer a floor of its field by any reading: it declares
  half of an actual world championship field unqualified while being described as
  a qualifying total.
- **The quota rule's uniformity is BY CONSTRUCTION and must not be read as a
  finding.** `P75` of a population excludes about 25% of it whatever the numbers
  are; the 25.4–29.3% spread is flooring and ties, not a discovery. What the
  comparison actually says is: one rule guarantees the property and the other
  does not deliver it. That is still the right basis for choosing, and it is a
  different sentence from "we measured the quota rule and it was uniform".
- **What the quota rule gives up:** the worlds cell's own data no longer enters
  its own number at all. The world field is used for the diagnosis in this
  section and for the alternative columns in §3.2, and not for the shipped value.
  A reviewer who thinks a world gate must be computed from world results should
  take the `own P50` column, and this document's answer to that is the spread
  above rather than an argument about principle.

**The real-world footnote a real lifter will raise.** A US national championship
is, for several classes, harder to qualify for than a world championship is to be
selected for, because the US field is deep and the world field is quota-filled.
**The ladder is a property the game wants, not a property the sport has.** §3.4's
constraint is therefore a design constraint honestly labelled, not a correction
of the data.

---

## 4. Every decision the sources did not make for me

Named as decisions, with the reasoning, so a reviewer can overturn them one at a
time.

### 4.1 Weight-class set — DECISION

**The table is keyed on the current international Open set:**

- **Men:** 59, 66, 74, 83, 93, 105, 120, 120+
- **Women:** 47, 52, 57, 63, 69, 76, 84, 84+

Three sub-decisions inside that one:

**(a) The sub-junior/junior-only classes are excluded.** Men's 53 kg and women's
43 kg exist in the dataset (25 and 17 lifters respectively in 2025 alone) but
**not in the Open division**, which is the division this table is keyed on.
Including them would create rows no Open lifter can be in.

**(b) Class is assigned from BODYWEIGHT, not from the recorded class field.**
This is forced, and it is the single most consequential technical decision here.
**The two American federations use different weight-class sets from each other.**
After the 2021 split, the national federation formerly affiliated internationally
kept its own older ladder — its most populous men's classes in this data are
82.5, 90, 100, 75, 110, 125, 140, 140+ — while the new international affiliate
uses 59/66/74/83/93/105/120/120+. Keying on the recorded class field would
produce two disjoint tables that cannot be compared. Every lifter is therefore
binned by their actual measured bodyweight into the international ladder, which
is what a real weigh-in does anyway. Bodyweight is present on **99.99%** of rows
(**7**<!--@raw:filter.noBodyweight--> rejected out of ~50,000 kept).

**(c) A lifter lighter than the lightest Open bound is folded UP into it, not
dropped.** There is no Open class below 59 kg / 47 kg, so a 55 kg man competing
Open competes in the 59 kg class in real life. The reject counter
`belowLightestClass` therefore reads
**0**<!--@raw:filter.belowLightestClass--> by construction and is kept only so a
future change to `CLASS_BOUNDS_KG` that does create an unreachable band reports
itself instead of silently discarding rows.

### 4.2 Mapping the game's four tiers onto real structure — DECISION

The game's tiers are local → regional → nationals → worlds. Real structure does
not have exactly those four, so:

| Game tier | Mapped to | Meets | Justification |
|---|---|---:|---|
| `worlds` | International federation World Championships | 11<!--@raw:meets.worlds--> | Direct correspondence |
| `nationals` | Both US national championships (both federations) | 22<!--@raw:meets.nationals--> | Direct correspondence |
| `regional` | **State championships** + the handful named "regional" | 305<!--@raw:meets.regional--> | See below |
| `local` | Every other sanctioned meet in those two federations | 2647<!--@raw:meets.local--> | The residual |

**`regional` IS THE WEAKEST LINK IN THIS DOCUMENT, AND THE CONSEQUENCE TRAVELS
WITH EVERY REGIONAL CELL.** A "regional" tier barely exists in US structure: only
**27 meets** in five years carry the word "regional" in the title and most of
those are collegiate. What does exist, populously, is the **state championship** —
305 meets after filtering. So `regional` is read as "the state championship
layer", which is the closest populated analogue of a tier between the local meet
and nationals.

**A state championship is an OPEN meet. Anybody may enter it.** There is no
qualifying total to be in that field, so:

- The regional column is a **percentile of whoever showed up**, not a percentile
  of a population that cleared a standard.
- It is **not a qualifying standard** and must not be described as one. Every
  regional cell in this document and in every generated artifact carries the
  **†** marker for that reason, and the `.json` rows carry
  `openEntryPopulation: true` / `isQualifyingStandard: false` so a machine
  consumer cannot miss it either.
- Every other column at least has *some* gate behind it — nationals has a
  published qualifying total (with §1.2's caveat about what the recorded total
  measures), worlds has a national quota. Regional has nothing.

Overturning the mapping is a one-regex change in `TIER_RULES`; overturning the
caveat is not possible while the mapping stands, because it is a fact about the
meets, not about the arithmetic.

**The mapping is auditable rather than asserted.** `qualifying-totals-meets-raw.txt`
lists every `worlds`, `nationals` and `regional` meet with its assigned tier and
its row contribution; `local` is summarised, for the two reasons the script's own
comment gives (it is the residual tier, and its 2,647 lines carried ~2,400
real-federation mentions — see §8.4). That file is how a first-pass error was
caught: the obvious exclusion regex admitted `Elk Mound HS Nationals`,
`Raw Master's Nationals`, `Teen Nationals`, `Junior Nationals` and
`Australia Nationals` into the national tier, because `HS`, the apostrophe in
`Master's` and `Teen` all walked past a pattern that spelled `high school` and
`masters`. The Open-division filter would have emptied most of them anyway —
**which is precisely why it had to be fixed at the meet level too**: a filter
that silently makes a wrong meet contribute zero rows leaves the meet list
looking wrong to anyone auditing it.

The remaining zero-contribution meets are all equipped-only championships, which
the raw filter correctly empties: `nationals` has
**11**<!--@raw:meets.nationals.zeroContribution--> of its 22 contributing no rows,
and `worlds` **5**<!--@raw:meets.worlds.zeroContribution--> of 11.

### 4.3 Division — DECISION

**Open only.** Two dialects in the input: the international dataset writes the
word `Open`; the two American ones write a code whose last segment is the
division, so `MR-O` is male / raw / open. Junior, sub-junior, masters, teen,
collegiate, high-school, university, police and guest divisions all fail the
predicate. This rejects **82,705**<!--@raw:filter.division--> rows — by far the
largest filter — which is correct, because a real qualifying total is published
per division and these are the Open figures.

**The cost:** a junior lifter competing at national level is recorded in the
junior division and is dropped, even though they are genuinely national-calibre.
Cells at the top tiers are correspondingly smaller than the meet attendance
suggests.

### 4.4 Date range — DECISION

**2021-01-01 onward**, and this one is data-driven rather than arbitrary. The
international women's Open class set changed from
`{47, 52, 57, 63, 72, 84, 84+}` to `{47, 52, 57, 63, 69, 76, 84, 84+}`. The
change is measurable in the input: women's 72 kg runs through 2019 (200 entries),
**zero meets in 2020**, and 69/76 kg from 2021 (103 and 106 entries). The men's
set is stable across the whole window. Including earlier meets would key half the
women's rows on a class that no longer exists.

**This is what "pin an edition or date" means for this table.** The class set is
an edition, it moved recently, and it moved for one sex and not the other.

### 4.5 The designated percentile and the quota fraction — DECISIONS, and the biggest judgement calls

**P10 of the tier's own field** at `local`, `regional` and `nationals`, and
**the top 25% of the tier below** at `worlds`. Both are design decisions, not
published facts, and §3.6 is the argument for the second one. The full ladder —
P5, P10, P25, P50, P75, P90, min, max, the quota value and the trimmed value — is
emitted for **every** cell in the `.json`, so a reviewer can re-designate any
tier without re-running anything.

### 4.6 Rounding — DECISION

**Floored to 2.5 kg**, because that is the smallest change loadable with a
matched pair of the smallest competition plates in wide use, and a floor should
stay a floor when it is rounded. Unrounded values are in the JSON. Note that
flooring is what turns the quota rule's exact 25% into the measured 25.4–29.3%
band in §3.5.

### 4.7 What to do where no standard exists for a tier — DECISION

**`local` stays open.** No federation publishes a local qualifying total, because
the local meet is the entry point — that is what makes it local. The `local`
column above is therefore **descriptive, not a gate**: it says what people
actually total at local meets, which is useful for tuning starting totals and
opener suggestions, and it should not become a gate. It carries the same **†**
marker as `regional` for the same reason — an open field — and the marker's
meaning is the honest one in both cases. This agrees with what `careerTuning.ts`
already ships (`local: null`) and with the reason its comment gives (a lifter's
Total is `null` until their first meet, so a gated entry tier is a game nobody
can enter).

---

## 5. The equipped table — attempted, and it is a GAP

The same script run with `QT_EQUIPMENT=Single-ply` keeps
**1645**<!--@single-ply:meta.recordsKept--> records against 49,854 raw. Only
**8**<!--@single-ply:count.cellsWithNumber--> of
**64**<!--@single-ply:count.cells--> cells reach the 40-lifter floor, and **every
one of them is `local`** — that is, every equipped cell that carries a number is
marked †, ungated, and is not a qualifying standard:

<!--TABLE single-ply:sufficient-->
| tier sex class | source lifters | designated kg | method |
|---|---:|---:|---:|
| local M 74 | 62 | 360.0† | tier-field-percentile |
| local M 83 | 71 | 452.5† | tier-field-percentile |
| local M 93 | 82 | 467.5† | tier-field-percentile |
| local M 105 | 84 | 455.0† | tier-field-percentile |
| local M 120 | 51 | 527.5† | tier-field-percentile |
| local M 120+ | 43 | 575.0† | tier-field-percentile |
| local F 63 | 51 | 255.0† | tier-field-percentile |
| local F 84+ | 67 | 252.5† | tier-field-percentile |

**The two equipped worlds cells the first pass published are gone, and their
disappearance is the methodology change doing its job.** Under P10-of-own-field
the equipped men's 83 kg and 105 kg worlds cells carried
**685**<!--@single-ply:cell.worlds.M.83.ownP10--> kg (on
**40**<!--@single-ply:cell.worlds.M.83.n--> lifters) and
**755**<!--@single-ply:cell.worlds.M.105.ownP10--> kg (on
**42**<!--@single-ply:cell.worlds.M.105.n-->). Under the quota rule those cells
are derived from the equipped *nationals* field, which has no cell above the
floor at all, so they are GAPs. That is the correct answer: there is no equipped
national population to select a world team from in this data, and a number that
looked available under the old method was available only because it was measuring
the wrong population.

**There is no equipped regional, nationals or worlds row at all, and no equipped
women's row above `local`.** An equipped qualifying-total table cannot be derived
from this input at this cell size. Do not interpolate one.

---

## 6. What I could not source, named

### 6.1 Published federation qualifying standards — UNREACHABLE

Every one of the primary standards documents is behind the egress policy. The
exact hosts and the exact failures are in the table in §1.3. This is the
repository's standing rule applied: an unverifiable claim is reported as
unverifiable rather than filled in by reasoning.

**This is also the honest answer to "should the worlds tier just use the
published international standards instead of a derived number?" — yes, if
somebody can read them.** §3.6 chooses between derived candidates because the
published table is 403 from here, not because a derived number is better than a
published one. The first thing a human with a browser should do is retrieve the
list below and compare it against §3.1; if the published international standards
disagree with the quota column, the published ones win.

**What a human with an open browser should retrieve, in priority order:**

1. `https://www.usapowerlifting.com/lifters-corner/qualifying-totals/` — the
   national qualifying totals, per weight class, per division, per equipment.
2. `https://powerlifting-america.com/classic-open/` and
   `https://powerlifting-america.com/nationalteams/nationalteams-classicopen/` —
   the other US national body's standards and its international team criteria.
   **The second of those is the one that matters most for §3.6:** an
   international *team selection* standard is precisely the quantity the quota
   designation is estimating.
3. `https://www.powerlifting.sport/` technical rulebook, current edition — the
   international championship entry standards and the authoritative weight-class
   table with its effective date.
4. `https://www.britishpowerlifting.org/wp-content/uploads/2026/03/2026_Open_QT.pdf`
   — worth retrieving even though it is a third country's, because it appears to
   publish its **method** as well as its numbers.

### 6.2 Other gaps

- **Untested / non-drug-tested federations.** All three source federations are
  tested. The game's untested federation option has no empirical basis in this
  document.
- **Equipped above local.** §5.
- **Women's 47 kg at nationals and worlds.** 35 and 39 lifters, below the floor.
- **Age divisions.** Open only. Junior, sub-junior and masters qualifying totals
  are real and published and are not derived here.
- **A "regional" tier that actually exists.** §4.2 — and with it, any gated
  population at that tier.
- **What a published standard actually is.** §1.2: the recorded total is the
  performance on the day, not the total that qualified the lifter, so no
  percentile of this data recovers a published number even at the gated tier.
- **Whether any of this is fun.** These are sourced numbers, not playtested ones.

### 6.3 QUARANTINE — relayed fragments, UNVERIFIED, NOT IN THE TABLE

A search engine's summariser reported reading values out of two pages I could not
open. **They are recorded only so a human can go and check them, and they are not
used anywhere above.** Treat them as leads, not data:

- A Canadian union standards PDF (`https://powerlifting.ca/org/pl_national_qt.pdf`)
  was reported as containing men's Open classic values *"including 440, 482,
  527.5, 570, 605, 635, 662.5"* — seven values for a nine-class ladder, with no
  class attribution I can confirm. The same summary reported that document's
  women's classes as `43, 47, 52, 57, 63, 72, 84, 84+`, i.e. **the pre-2021
  set**, which suggests the document is stale.
- A separate summary reported men's classic national Open values of
  *"66 kg: 485, 74 kg: 535, 83 kg: 585, 93 kg: 630"* without naming which of the
  two pages in its result list they came from.

Two independent relays, no attributable source, one of them internally dated to a
superseded weight-class set. **This is the shape this repository calls an
anecdote.** It is in a quarantine section for that reason.

---

## 7. The real-IP constraint

CLAUDE.md's rule is that **no real federation, athlete or brand may be an in-game
entity.** Nothing in this document is or becomes one. The game's four federations
stay fictional. Real bodies are named here only as the provenance of a number,
which is the same judgement `src/licensing/realIp.ts` already records for the
rulebook and coefficient citations in `meet.ts`, `plates.ts` and `dots.test.ts`:
*"Naming the body that publishes a rule being implemented."*

Three concrete precautions taken:

1. **No real athlete is named.** The dataset commit message quoted in §1.3
   contains a lifter's name because that is the verbatim commit subject line and
   redacting it would break the pin; that is the only personal name in this
   document, and it is a provenance stamp, not a fixture. The delegation of every
   worlds entrant is read by §3.6's diagnostic and **no country, name or
   delegation reaches any output** — the script holds them in memory and emits
   counts.
2. **The derivation script is `.mjs`, not `.py`.** This mattered mechanically
   when it was written — see §8.4(c) — and no longer does, because the audit now
   sniffs bytes rather than extensions.
3. **No number here is installed anywhere.** A citation that never reaches a
   screen cannot become a mark the game trades on.

---

## 8. `realIp.ts` — the citations are REGISTERED, and what that cost

### 8.1 What was done, on an explicit human ruling

The citation census in `src/licensing/realIp.ts` pins the **exact occurrence
count** of every watched real name in every readable file in the tree, and
`realIp.test.ts` set-equals it against a freshly computed inventory in both
directions. Adding this research module necessarily moved those counts, and the
first pass of this document left the suite red and said so rather than editing a
legal-exposure guard on its own authority.

**A human ruled: real source citations legitimately belong in this module, so
they are REGISTERED the way every other citation in the repository is —
`REVIEWABLE_CITATIONS` rows with exact counts.** Not exempted. The exact scope of
that ruling, written down because the difference matters:

- `docs/research/**` is **not** on any ignore list, is **not** excluded from the
  walk, and no pattern was widened to stop the directory being read.
- No count was relaxed into a bound. Every row added is an exact number.
- **The guard keeps its bite:** a new real name arriving in these files, or an
  existing count moving by one, still reddens `realIp.test.ts`.

The rows registered are listed in §8.2. They were taken **after** the prose was
final, for the reason CLAUDE.md names in *"re-taking evidence and then editing
its subject restales it in one step"*: a census of a document that is still being
edited is stale before it is committed.

### 8.2 The rows

Three things had to move, and each is a different kind of registration:

1. **`EXTENSIONS_READ_AS_TEXT` gains `.txt`.** The audit now decides text by
   sniffing bytes rather than by extension, and this module's committed
   meet-audit files are the first `.txt` files in the walked tree. That list is a
   census of what the audit reads, pinned in both directions, so a new kind of
   readable file is *supposed* to redden it once.
2. **`REVIEWABLE_CITATIONS` gains the research module's rows**, with exact
   counts. See the block in `realIp.ts`; the rows for this document, the notes,
   the script, the two `.txt` meet audits and the two generated `.json` files are
   grouped there with a `why:` paragraph.
3. **The project-name prose pin in `realIp.test.ts` gains two files.** That
   assertion pinned open-source project names at `prose` position to exactly one
   file — the design document. A research document that cites the database it
   derives from is a second and third. The pin is still an exact list in both
   directions; it is not a pattern and it is not a bound.

**A caution for whoever regenerates that block next.** Six of these rows are
`SBD`, which in this sport is the standard abbreviation for squat-bench-deadlift
and is the dataset's own value for the full-power event. It is also a watched
apparel brand. Those rows are the **event code**, not the brand — the one genuine
brand mention is inside a verbatim meet title in the audit `.txt` files, and a
reader of `REVIEWABLE_CITATIONS` cannot tell them apart from the row alone.

### 8.3 The check that fired during the first pass and is now green — worth reading

```
AssertionError: a project name moved into code position in a new file
+   "docs/research/qualifyingTotalsDerive.mjs",
```

The offending line was the script's `console.error` usage string, which spelled
the dataset's short name. `code` position, in a string the program **prints**.

I read it and removed the name from that string; the provenance stays in the
file's header comment, where it is a citation rather than output. The assertion
is green now. That is the guard doing precisely the job it is written for — *"If
it is a published-record citation, keep it… If it is anything else, delete the
name instead"* — and it is recorded here because a guard that fires, is read, and
changes the artifact is worth more evidence than a guard that merely passes.

### 8.4 Four findings about the guard, reported not exploited

**(a) The census is not built for bulk generated data, and I trimmed rather than
hid.** The tier-mapping audit file originally listed all 2,647 `local` meets and
carried **~2,400** mentions of one federation's acronym plus two real apparel
brands arriving inside verbatim third-party meet titles — one a title sponsor
("… Presented by SBD"), one a sponsored high-school invitational. That is a data
dump, not a citation, and pinning it would bury the list.

`local` is now summarised, which takes that file from 2,992 lines to 346 and the
acronym count from ~2,400 to 275. **The script says both reasons out loud**,
including that the second reason would not stand alone: trimming evidence to
quiet a guard is the wrong instinct, and the full per-meet audit is preserved for
the three tiers where the mapping is a judgement rather than a residual. A human
may reasonably conclude the generated artifacts should not be committed at all
and should be regenerated on demand; that is a legal-exposure call, so it is
flagged rather than taken.

**(b) A false positive worth knowing about: `SBD`.** See §8.2's caution.

**(c) CAPTURING THIS TEST'S OUTPUT INTO A SCANNED DIRECTORY IS ITSELF A REAL-IP
EVENT, AND I DID IT BEFORE I NOTICED.** The first capture of the run was written
to `docs/research/realip-run.txt`. The output of this particular test is **a
census of every real name in the tree** — so the capture file adds, on the next
run, **46 citation rows of its own, including eight real athletes' names** and one
federation acronym at **x1181**.

It was invisible for one run because the shell truncates the redirect target
before the test reads the tree, so the file was empty at the moment it was
scanned. It appeared the instant the run was repeated. **A file that is empty
during its own measurement and full afterwards is the worst shape a check can
have**, and it is worth recording because nothing here would have caught it: the
counts simply grow on the next unrelated run and get pasted in by whoever
regenerates the block.

`realIp.ts` already names the general case as the reason `.gauntlet` is on
`NOT_WALKED` — *"every string in it is a COPY of one this audit reads at its
source"* — so the capture lives at
`.gauntlet/evidence/qualifying-totals-research.txt`, produced by the repository's
own `tools/evidence.mjs`, which is the designated home for exactly this artifact.
Confirmed by re-running: **zero `.gauntlet/` rows in the inventory.**

The general rule this implies, for whoever writes the next research piece:
**never commit a captured test transcript to a scanned directory.** It is not
specific to this test; any suite output that echoes source text will do it.

**(d) The `.py` hole this document reported in its first pass IS CLOSED, by
somebody else, and the fix went further than the report asked.** The first pass
recorded that `realIp.ts`'s file-type rule was an extension allowlist that did
not include `.py`, so a Python data script would have been invisible to the
census, and that the derivation was written in `.mjs` specifically so the guard
would see it. On the branch this document now sits on, that predicate has been
inverted onto **bytes**: anything that decodes as UTF-8 with no NUL is read,
whatever it is called, and `EXTENSIONS_READ_AS_TEXT` is the pinned *answer*
rather than the *input*. A `.py` file would now be scanned. This is recorded as
closed rather than deleted, because the report and the fix were independent and
that is the interesting part.

---

## 9. Where these numbers would go, if a human approves them

Not doing this. Recording it so the reviewer can see the size of the eventual
change.

`src/career/calendar.ts:117` is the only reader of the flat table:

```
return CAREER_TUNING.QUALIFYING_TOTAL_KG[tier];
```

and `careerTuning.ts`'s own comment already names the shape of the replacement:
*"replacing it is a change to one function: `qualifyingTotalKgFor` in
`calendar.ts` is the only reader, and a per-class version takes the lifter's
class and returns the same shape."*

Four things that would have to be settled first and are not settled here:

1. **Whether the lower two tiers gate at all.** `local` should not (§4.7), and
   `regional`'s number is a description of an open field rather than a standard
   (§4.2). A gate keyed on a † cell is a gate whose number means something other
   than what a player will assume it means.
2. **Which designation at `regional` and `nationals`** — §3.1's percentile or
   §3.3's quota. They disagree by up to 165 kg. `worlds` is already ruled (§3.6).
3. **The three weight-class inversions in §3.4**, each one rounding step wide,
   all in the women's columns. The tier ladder is a constraint of the derivation
   now; the class ladder is not, and a human smoothing pass is the cheapest fix.
4. **What the game does when a lifter has no weight class yet.** GDD §6.1's
   weigh-in beat picks the class, and the gate is read before the meet. A
   per-class gate needs a defined answer for a lifter whose class is not yet
   chosen, and the current flat table did not have to have one.

Also worth flagging to whoever wires it: `careerTuning.test.ts` pins
`expect(gated).toEqual([400, 550, 650])` and `careerSweep.ts` carries
`TOP_QUALIFYING_TOTAL_KG: 650` with several derived claims measured against it
(the `657.5` minimum-worlds-total margin, among others). A per-class table
invalidates that constant and every measurement taken against it — and the worlds
column has moved a long way from 650 (men's 120+ is now
**902.5**<!--@raw:cell.worlds.M.120+.designated--> kg). That is not a reason not
to do it; it is the size of the job.

---

## 10. The second pass — what four rulings changed

Recorded so a reviewer can see what moved and why, rather than diffing two
versions of a table.

1. **Register the citations.** §8. Rows added to `REVIEWABLE_CITATIONS`,
   `EXTENSIONS_READ_AS_TEXT` and the project-name prose pin, with exact counts,
   taken after the prose was final. No ignore list, no widened pattern, no bound.
2. **Flag every regional cell as derived from an ungated population, wherever the
   table ships.** §1.1's markers, on individual cells, in this document, in the
   generated `.md`, and as `openEntryPopulation` / `isQualifyingStandard` /
   `populationCaveat` in the generated `.json`. A structural check fails the run
   if a marker is missing or misplaced. `local` carries the same marker for the
   same reason.
3. **Re-do the worlds methodology.** §3.6. P10 of a quota-filled field measured
   the smallest quota holder; the shipped designation is now the top 25% of the
   nationals field, the table is declared MIXED-METHOD at the point of use, the
   two rejected candidates are shown with their numbers, and the monotone ladder
   is a constraint of the derivation (§3.4) rather than a footnote — with the 15
   comparisons that are guaranteed by construction named as such, so the check is
   not mistaken for stronger evidence than it is.
4. **Make the arithmetic checkable.** §1.4. Every number in this document that
   comes from the dataset carries a tag, and `--check-doc` re-derives and
   compares all of them plus every table cell, exiting non-zero on any
   disagreement and on a domain that has gone empty.

**What the second pass did NOT do:** nothing here is wired into anything, no
tuning module was created, and no number in `src/` moved.
