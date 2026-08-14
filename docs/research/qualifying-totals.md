# Qualifying totals — sourced research, tier x gender x weight class

**Status: RESEARCH ONLY. Wired into nothing. Reviewed by nobody yet.**

Produced on branch `claude/qualifying-totals-research` off `cd1dd05`, 2026-08-14.

A human ruling put this piece under an explicit restriction and it is honoured:
**nothing here is wired into `CareerLifter`, `careerTuning.ts`, or any other
implementation.** `src/career/**`, `src/game/**`, `CLAUDE.md`, `.github/**` and
every existing test are untouched by this branch. The numbers below are for a
human to review before any of them becomes a constant.

**Read section 6 before using any number.** Two of the four named sources could
not be retrieved from this environment at all, one designation in the table is
measurably near-vacuous at the top tier, and there are seven measured
inversions.

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

## 1. Methodology — one method, chosen, with the reason

### The method used

**Percentile-derived thresholds computed from raw competition results.**

For each `tier x sex x weight class` cell, the designated qualifying total is
the **10th percentile of the distribution of best competition totals achieved by
Open-division raw lifters at meets of that tier**, floored to 2.5 kg.

### Why this method and not the other

**Because the other one is not retrievable from this environment, and I would
have to relay numbers I cannot read.** That is a hard fact about the sandbox,
not a preference:

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
or route around it — report the blocked host."* That is what section 6 does.

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
a page I cannot open. **I have not blended them.** Every number in section 3
comes from the dataset above and from nothing else. The fragments a search
engine relayed from published tables are quarantined in section 6.3, are
explicitly marked unverified, and are not in the table.

### The derivation is a committed, re-runnable script

`docs/research/qualifyingTotalsDerive.mjs`. Every methodology value in it — the
percentile, the rounding step, the date cut, the minimum cell size, the class
boundaries, the equipment filter, the excluded placings — is a named constant in
one frozen `DERIVATION` block at the top of the file, for the reason CLAUDE.md
gives: these get turned by hand later and a value buried in a function body is a
value nobody can turn.

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
| Date range | `2021-01-01` .. present | 171,854 |
| Meet matched no tier rule | see section 4.2 | 34,999 |
| Equipment | `Raw` only (no single-ply, no knee wraps) | 7,347 |
| Event | `SBD` only — full power, three lifts | 7,165 |
| Sex | `M` / `F`; `Mx` has no published class set | 70 |
| Division | **Open only** (see 4.3) | 82,705 |
| Placing | not `DQ`, `NS`, `DD` or `G` (guest) | 2,603 |
| Total | present and > 0 | 0 |
| Bodyweight | present and > 0 | 7 |
| Name | non-empty | 3 |

- **Meets scanned:** 5,245. **Entry rows read:** 169,401.
- **Distinct lifter-tier-class records kept:** 49,854.

**Tested vs untested:** all three source federations are drug-tested bodies, so
the entire input is tested. There is no untested arm in this table, and the game's
untested federation option has **no** empirical basis here. Named as a gap in
section 6.

**Raw vs equipped:** the shipped table is raw only. The equipped run is section 5.

**Missing and disqualified entries:** a placing of `DQ`, `NS` (no show) or `DD`
(doctor's disqualification) is dropped, and so is `G` (guest), because a guest is
not entered in the meet's own ranking and is frequently visiting from another
federation. Note that `noTotal` rejected **0** rows: after the placing filter,
every remaining row carried a total, which is the dataset's own checker doing its
job rather than an absent check here.

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

P10 of each tier's own field, floored to 2.5 kg. `(n)` is the number of distinct
lifters in the cell.

#### Men

| class kg | local | regional | nationals | worlds |
|---|---:|---:|---:|---:|
| 59 | 267.5 (295) | 302.5 (69) | 417.5 (47) | 500.0 (43) |
| 66 | 350.0 (913) | 365.0 (200) | 515.0 (61) | 567.5 (54) |
| 74 | 390.0 (2956) | 425.0 (678) | 557.5 (146) | 580.0 (77) |
| 83 | 435.0 (5443) | 477.5 (1216) | 627.5 (261) | **627.5** (115) |
| 93 | 460.0 (5354) | 485.0 (1222) | 630.0 (169) | 670.0 (121) |
| 105 | 477.5 (4590) | 515.0 (1114) | 662.5 (215) | 680.0 (104) |
| 120 | 495.0 (2750) | 532.5 (709) | 730.0 (151) | **722.5** (82) |
| 120+ | 495.0 (1692) | 537.5 (490) | 737.5 (135) | 797.5 (60) |

#### Women

| class kg | local | regional | nationals | worlds |
|---|---:|---:|---:|---:|
| 47 | 175.0 (152) | 185.0 (48) | **GAP** (35) | **GAP** (39) |
| 52 | 205.0 (587) | 212.5 (151) | 310.0 (82) | 322.5 (70) |
| 57 | 222.5 (1144) | **247.5** (270) | 350.0 (94) | **347.5** (83) |
| 63 | 227.5 (2024) | **245.0** (489) | 360.0 (127) | 367.5 (81) |
| 69 | 245.0 (2551) | 265.0 (632) | **395.0** (152) | **382.5** (91) |
| 76 | 252.5 (2451) | **282.5** (572) | **392.5** (159) | 425.0 (79) |
| 84 | 255.0 (1816) | **280.0** (436) | 412.5 (111) | 435.0 (51) |
| 84+ | 257.5 (2820) | 287.5 (703) | 422.5 (181) | 442.5 (41) |

**62 of 64 cells carry a number. Two are gaps** — women's 47 kg at nationals
(35 lifters) and at worlds (39 lifters), both below the 40-lifter floor. They are
left empty rather than filled by interpolation.

**Bolded cells are the measured inversions.** See 3.3.

### 3.2 The quota alternative, kg

The same data, designated differently: **the total reached by the strongest 25%
of the tier below.** This answers "how big do I want the field" instead of "who
shows up", and it is emitted because designation 3.1 turns out to be nearly
vacuous at the top of the ladder — see 3.4.

| class kg | regional (M) | nationals (M) | worlds (M) | | class kg | regional (F) | nationals (F) | worlds (F) |
|---|---:|---:|---:|---|---|---:|---:|---:|
| 59 | 467.5 | 477.5 | 537.5 | | 47 | 287.5 | 297.5 | GAP |
| 66 | 507.5 | 545.0 | 657.5 | | 52 | 315.0 | 327.5 | 382.5 |
| 74 | 550.0 | 582.5 | 672.5 | | 57 | 327.5 | 345.0 | 420.0 |
| 83 | 600.0 | 635.0 | 735.0 | | 63 | 340.0 | 370.0 | 445.0 |
| 93 | 630.0 | 662.5 | 802.5 | | 69 | 357.5 | 387.5 | 465.0 |
| 105 | 665.0 | 702.5 | 807.5 | | 76 | 372.5 | 410.0 | 475.0 |
| 120 | 692.5 | 742.5 | 845.0 | | 84 | 380.0 | 412.5 | 495.0 |
| 120+ | 727.5 | 780.0 | 902.5 | | 84+ | 402.5 | 437.5 | 535.0 |

This one has **zero inversions in either direction** and looks far more like a
published table. It is also much harsher at the lower tiers — a 467.5 kg gate on
a men's 59 kg *regional* entry is asking for a strong lifter to enter a state
championship, and real state championships have no qualifying total at all.

**The two designations disagree substantially and I am not choosing between
them.** Both are computed from the same rows by the same script; which one ships
is a game-design call.

### 3.3 Measured inversions — seven of them

A published qualifying table is monotone in both directions: a heavier class asks
for more, a higher tier asks for more. A percentile from a finite sample is not.
Measured, not asserted:

**Tier inversions or ties (4)** — the higher tier asks no more than the one below:

- M 83: nationals 627.5 -> worlds 627.5 *(a tie: the gate does nothing here)*
- M 120: nationals 730 -> worlds 722.5
- F 57: nationals 350 -> worlds 347.5
- F 69: nationals 395 -> worlds 382.5

**Weight-class inversions (3)** — a heavier class asks less than the one below:

- regional F: 57 kg 247.5 -> 63 kg 245.0
- regional F: 76 kg 282.5 -> 84 kg 280.0
- nationals F: 69 kg 395.0 -> 76 kg 392.5

**All seven are in the raw designation and none is in the quota alternative.**
A human smoothing pass is required before designation 3.1 can be used as a gate;
the script recomputes this list on every run so the smoothing cannot silently
rot.

### 3.4 The clearance column — why the worlds row is the weak one

For every gate, the script measures **what fraction of the tier below already
clears it**. A gate everybody clears is decoration.

- regional gates: cleared by **78–87%** of the local field
- nationals gates: cleared by **22–52%** of the regional field
- worlds gates: cleared by **45–95%** of the nationals field

That last band is the finding. In men's 83 kg the worlds gate is cleared by
**90%** of the national field; in men's 120 kg, **91.4%**; in women's 69 kg,
**94.7%**. The cause is visible in the raw distribution: a world championship
field carries national-quota entrants from small federations who are far below
the American national standard — the minimum total in the men's 74 kg worlds cell
is **307.5 kg**, against a nationals P10 of 557.5 kg. So the world field's own
10th percentile is not an elite threshold; it is a quota entrant.

This is exactly why real international qualifying totals exist and are
administered per country, and it is the strongest argument in this document for
preferring the quota designation at the top tier.

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
(7 rejected out of ~50,000 kept).

**(c) A lifter lighter than the lightest Open bound is folded UP into it, not
dropped.** There is no Open class below 59 kg / 47 kg, so a 55 kg man competing
Open competes in the 59 kg class in real life.

### 4.2 Mapping the game's four tiers onto real structure — DECISION

The game's tiers are local -> regional -> nationals -> worlds. Real structure
does not have exactly those four, so:

| Game tier | Mapped to | Meets | Justification |
|---|---|---:|---|
| `worlds` | International federation World Championships | 11 | Direct correspondence |
| `nationals` | Both US national championships (both federations) | 22 | Direct correspondence |
| `regional` | **State championships** + the handful named "regional" | 305 | See below |
| `local` | Every other sanctioned meet in those two federations | 2647 | The residual |

**`regional` is the decision, and it is the weakest link in the mapping.** A
"regional" tier barely exists in US structure: only **27 meets** in five years
carry the word "regional" in the title and most of those are collegiate. What
does exist, populously, is the **state championship** — 305 meets after
filtering. So `regional` is read as "the state championship layer", which is the
closest populated analogue of a tier between the local meet and nationals.
Overturning this is a one-regex change in `TIER_RULES`.

**The mapping is auditable rather than asserted.** `qualifying-totals-meets-raw.txt`
lists every `worlds`, `nationals` and `regional` meet with its assigned tier and
its row contribution; `local` is summarised, for the two reasons the script's own
comment gives (it is the residual tier, and its 2,647 lines carried ~2,400
real-federation mentions — see 8.6). That file is
how a first-pass error was caught: the obvious exclusion regex admitted
`Elk Mound HS Nationals`, `Raw Master's Nationals`, `Teen Nationals`,
`Junior Nationals` and `Australia Nationals` into the national tier, because
`HS`, the apostrophe in `Master's` and `Teen` all walked past a pattern that
spelled `high school` and `masters`. The Open-division filter would have emptied
most of them anyway — **which is precisely why it had to be fixed at the meet
level too**: a filter that silently makes a wrong meet contribute zero rows
leaves the meet list looking wrong to anyone auditing it.

The remaining zero-contribution meets are all equipped-only championships, which
the raw filter correctly empties. That is visible in the file and in the
generated header: `nationals: 22 meets, 11 contributing zero rows`.

### 4.3 Division — DECISION

**Open only.** Two dialects in the input: the international dataset writes the
word `Open`; the two American ones write a code whose last segment is the
division, so `MR-O` is male / raw / open. Junior, sub-junior, masters, teen,
collegiate, high-school, university, police and guest divisions all fail the
predicate. This rejects **82,705 rows** — by far the largest filter — which is
correct, because a real qualifying total is published per division and these are
the Open figures.

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

### 4.5 The designated percentile — DECISION, and the biggest judgement call

**P10 of the tier's own field.** A qualifying total is a floor that nearly
everyone who belongs at the tier clears, so a threshold at the 10th percentile
admits roughly nine in ten of them. This is a design decision and not a published
fact. The full ladder — P5, P10, P25, P50, P75, P90, min, max — is emitted for
every cell so a reviewer can re-designate without re-running anything.

### 4.6 Rounding — DECISION

**Floored to 2.5 kg**, because that is the smallest change loadable with a
matched pair of the smallest competition plates in wide use, and a floor should
stay a floor when it is rounded. Unrounded values are in the JSON.

### 4.7 What to do where no standard exists for a tier — DECISION

**`local` stays open.** No federation publishes a local qualifying total, because
the local meet is the entry point — that is what makes it local. The `local`
column above is therefore **descriptive, not a gate**: it says what people
actually total at local meets, which is useful for tuning starting totals and
opener suggestions, and it should not become a gate. This agrees with what
`careerTuning.ts` already ships (`local: null`) and with the reason its comment
gives (a lifter's Total is `null` until their first meet, so a gated entry tier is
a game nobody can enter).

---

## 5. The equipped table — attempted, and it is a GAP

The same script run with `QT_EQUIPMENT=Single-ply` keeps **1,645** records
against 49,854 raw. Only **10 of 64 cells** reach the 40-lifter floor, and eight
of those ten are `local`:

| tier | sex | class | lifters | P10 kg |
|---|---|---|---:|---:|
| local | M | 74 | 62 | 360.0 |
| local | M | 83 | 71 | 452.5 |
| local | M | 93 | 82 | 467.5 |
| local | M | 105 | 84 | 455.0 |
| local | M | 120 | 51 | 527.5 |
| local | M | 120+ | 43 | 575.0 |
| local | F | 63 | 51 | 255.0 |
| local | F | 84+ | 67 | 252.5 |
| worlds | M | 83 | 40 | 685.0 |
| worlds | M | 105 | 42 | 755.0 |

**There is no equipped regional or nationals row at all, and no equipped women's
row above local.** An equipped qualifying-total table cannot be derived from this
input at this cell size. Do not interpolate one.

---

## 6. What I could not source, named

### 6.1 Published federation qualifying standards — UNREACHABLE

Every one of the primary standards documents is behind the egress policy. The
exact hosts and the exact failures are in the table in section 1. This is the
repository's standing rule applied: an unverifiable claim is reported as
unverifiable rather than filled in by reasoning.

**What a human with an open browser should retrieve, in priority order:**

1. `https://www.usapowerlifting.com/lifters-corner/qualifying-totals/` — the
   national qualifying totals, per weight class, per division, per equipment.
2. `https://powerlifting-america.com/classic-open/` and
   `https://powerlifting-america.com/nationalteams/nationalteams-classicopen/` —
   the other US national body's standards and its international team criteria.
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
- **Equipped above local.** Section 5.
- **Women's 47 kg at nationals and worlds.** 35 and 39 lifters, below the floor.
- **Age divisions.** Open only. Junior, sub-junior and masters qualifying totals
  are real and published and are not derived here.
- **A "regional" tier that actually exists.** Section 4.2.
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

1. **No real athlete is named.** The dataset commit message quoted in section 1
   contains a lifter's name because that is the verbatim commit subject line and
   redacting it would break the pin; that is the only personal name in this
   document, and it is a provenance stamp, not a fixture.
2. **The derivation script is `.mjs`, not `.py`.** This matters mechanically —
   see section 8.
3. **No number here is installed anywhere.** A citation that never reaches a
   screen cannot become a mark the game trades on.

---

## 8. `realIp.test.ts` — the result, and what it requires

### 8.1 The result, verbatim

```
 Test Files  1 failed (1)
      Tests  2 failed | 46 passed (48)
```

Exit code 1. And the whole suite, from the same bundle, so the reader can see
that **nothing else on this branch is red**:

```
 Test Files  1 failed | 84 passed (85)
      Tests  2 failed | 3338 passed (3340)
```

Full unsummarised capture: **`.gauntlet/evidence/qualifying-totals-research.txt`**,
produced by `node tools/evidence.mjs qualifying-totals-research src/licensing/realIp.test.ts`.
It is under `.gauntlet/` rather than beside this document for a measured reason —
see 8.6(d).

**Two assertions fail, and they are two different requirements.** A third fired
during the work and is now green — that one is the most interesting of the three
and is 8.4.

### 8.2 Failure 1 — the census pin

`the reviewable citation list > is exactly the list in realIp.ts — a new mention
is a human decision`

`REVIEWABLE_CITATIONS` in `src/licensing/realIp.ts` pins the **exact occurrence
count** of every watched real name in every text file in the tree, and the test
asserts set equality against a freshly computed inventory. The scan walks the
whole repository, so **adding this document necessarily moves those counts.**
That is the guard working, not the guard breaking; its own header says so —
*"A count that is off by one on merge is this list WORKING."*

**24 new rows, across 6 files:**

| file | name | where | count |
|---|---|---|---:|
| `qualifying-totals-derived-raw.json` | IPF | code | 1 |
| `qualifying-totals-derived-raw.json` | SBD | code | 1 |
| `qualifying-totals-derived-raw.json` | USAPL | code | 3 |
| `qualifying-totals-derived-single-ply.json` | IPF | code | 1 |
| `qualifying-totals-derived-single-ply.json` | SBD | code | 1 |
| `qualifying-totals-derived-single-ply.json` | USAPL | code | 3 |
| `qualifying-totals-meets-raw.txt` | IPF | prose | 11 |
| `qualifying-totals-meets-raw.txt` | SBD | prose | 1 |
| `qualifying-totals-meets-raw.txt` | USAPL | prose | 275 |
| `qualifying-totals-meets-single-ply.txt` | IPF | prose | 11 |
| `qualifying-totals-meets-single-ply.txt` | SBD | prose | 1 |
| `qualifying-totals-meets-single-ply.txt` | USAPL | prose | 275 |
| `qualifyingTotalsDerive.mjs` | IPF | code | 1 |
| `qualifyingTotalsDerive.mjs` | IPF | comment | 1 |
| `qualifyingTotalsDerive.mjs` | OpenPowerlifting | comment | 2 |
| `qualifyingTotalsDerive.mjs` | OPL | comment | 4 |
| `qualifyingTotalsDerive.mjs` | SBD | code | 1 |
| `qualifyingTotalsDerive.mjs` | USAPL | code | 3 |
| `qualifyingTotalsDerive.mjs` | USAPL | comment | 1 |
| `qualifying-totals.md` | 7 rows | prose | **self-referential — see below** |

**26 rows across 6 files** at the run captured in the bundle. Nineteen of them
are listed above exactly and are stable, because none of those files mentions
itself. The seven rows for **this document** are not listed, and that is the
honest choice rather than a lazy one: **this section is inside the file being
scanned**, so writing its own counts into it changes them. Regenerate the block
from what the test prints, never from this table.

### 8.3 Failure 2 — and this one CANNOT be closed within my brief

`the reviewable citation list > counts the open-source project citations, which
is what it used to miss`, at `src/licensing/realIp.test.ts:876`:

```
AssertionError: expected [ 'docs/GDD.md', …(2) ] to deeply equal [ 'docs/GDD.md' ]
+   "docs/research/qualifying-totals.md",
+   "docs/research/qualifying-totals.md",
```

That assertion pins **project-kind names at `prose` position to exactly one
file** — the design document. This research document is a second one, because it
names the results database it derives from.

**Closing this requires editing `realIp.test.ts`, which my brief explicitly puts
out of bounds** ("Do not touch … or any existing test"). So the red is structural,
not a choice: the brief asks for a sourced document, sourcing it means naming the
source, and naming the source trips a pin that only an edit to an existing test
can widen. Stating it rather than working around it, because the workaround would
be to stop citing the source.

### 8.4 The check that fired and is now green — read this one

A third assertion in the same test fired first:

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

### 8.5 What a human has to decide, and what I deliberately did NOT do

The test prints the exact regenerated `REVIEWABLE_CITATIONS` block on failure and
its header says *"REGENERATE, DO NOT HAND-EDIT."*

**I have not regenerated it, and I have not touched `realIp.ts` or
`realIp.test.ts`. Stated prominently, as the brief required.** Three reasons:

- `src/licensing/realIp.ts` is a **legal-exposure guard**. Widening its allowlist
  is the act the guard exists to make visible; doing it quietly inside a research
  branch would consume the one moment a human is supposed to look.
- If this document is edited, renamed, moved or rejected during review, any rows
  I add now are stale immediately — and a stale row in that list reads exactly
  like a live one.
- The rows are a **classification** decision. The module's header sorts citations
  into groups with a judgement per group, and several are explicitly marked
  `NOT RULED HERE`. "Derived-data provenance in a research document" is a new
  group and a new ruling, and it is not mine to make.

**The mechanical steps, if the document stays:**

1. Run the test; paste the printed block over `REVIEWABLE_CITATIONS`; read every
   changed line.
2. Add a bullet to the module header's group list describing what `docs/research/*`
   citations are and why they are kept.
3. Widen `realIp.test.ts:876`'s prose pin beyond the single design-document entry.
4. **Decide whether the generated artifacts belong in the tree at all** — see 8.6.

### 8.6 Two findings about the guard, reported not exploited

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

**(b) A false positive worth knowing about: `SBD`.** In this sport `SBD` is the
standard abbreviation for squat-bench-deadlift and is the dataset's value for the
full-power event. It is also a watched apparel brand. The `SBD  code` rows in the
two JSON files and the script are the **event code**, not the brand — the one
genuine brand mention is inside a verbatim meet title. A reviewer regenerating
the block should not read those three rows as brand leakage, and a future reader
of `REVIEWABLE_CITATIONS` has no way to tell them apart from the row alone.

**(d) CAPTURING THIS TEST'S OUTPUT INTO A SCANNED DIRECTORY IS ITSELF A REAL-IP
EVENT, AND I DID IT BEFORE I NOTICED.** The first capture of the run was written
to `docs/research/realip-run.txt`. `.txt` is inside `realIp.ts`'s `TEXT_FILE`
pattern, and the output of this particular test is **a census of every real name
in the tree** — so the capture file adds, on the next run, **46 citation rows of
its own, including eight real athletes' names** and one federation acronym at
**x1181**.

It was invisible for one run because the shell truncates the redirect target
before the test reads the tree, so the file was empty at the moment it was
scanned. It appeared the instant the run was repeated. **A file that is empty
during its own measurement and full afterwards is the worst shape a check can
have**, and it is worth recording because nothing here would have caught it: the
counts simply grow on the next unrelated run and get pasted in by whoever
regenerates the block.

`realIp.ts` already names the general case as the reason `.gauntlet` is on
`NOT_WALKED` — *"every string in it is a COPY of one this audit reads at its
source"* — so the capture now lives at
`.gauntlet/evidence/qualifying-totals-research.txt`, produced by the repository's
own `tools/evidence.mjs`, which is the designated home for exactly this artifact.
Confirmed by re-running: **zero `.gauntlet/` rows in the inventory.**

The general rule this implies, for whoever writes the next research piece:
**never commit a captured test transcript to a scanned directory.** It is not
specific to this test; any suite output that echoes source text will do it.

**(c) `realIp.ts`'s `TEXT_FILE` regex does not include `.py`.**

```
const TEXT_FILE = /\.(?:tsx?|m?js|cjs|json|md|markdown|txt|html|css|sh|ya?ml|xml|svg)$/;
```

A Python file anywhere in this repository is invisible to the citation inventory.
My first instinct was to write the derivation in Python; had I done so, every
federation name in it would have been unwatched and this test would have stayed
**green** while the tree gained unpinned real-name mentions. I wrote it in `.mjs`
specifically so the guard would see it.

Reported rather than patched: `realIp.ts` is not this branch's file, and the fix
has a cost worth a human's judgement — adding `.py` also starts scanning any
vendored or tooling Python that arrives later. The repository has no `.py` files
today, so the hole is currently theoretical. It will stop being theoretical the
first time somebody reaches for a data script, which is exactly what this piece
was.

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

Three things that would have to be settled first and are not settled here:

1. **Which designation** — 3.1 or 3.2. They disagree by up to 165 kg.
2. **The smoothing pass** for the seven inversions in 3.3, if 3.1 is chosen.
3. **What the game does when a lifter has no weight class yet.** GDD §6.1's
   weigh-in beat picks the class, and the gate is read before the meet. A
   per-class gate needs a defined answer for a lifter whose class is not yet
   chosen, and the current flat table did not have to have one.

Also worth flagging to whoever wires it: `careerTuning.test.ts` pins
`expect(gated).toEqual([400, 550, 650])` and `careerSweep.ts` carries
`TOP_QUALIFYING_TOTAL_KG: 650` with several derived claims measured against it
(the `657.5` minimum-worlds-total margin, among others). A per-class table
invalidates that constant and every measurement taken against it. That is not a
reason not to do it; it is the size of the job.
