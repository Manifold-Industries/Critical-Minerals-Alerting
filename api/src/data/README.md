# Seed data

One JSON file per datatype, each a top-level list whose fields mirror the dataclass in
`api/src/models/` one-to-one (enums as their string values, dates as `YYYY-MM-DD`).

| File | Dataclass | What it holds |
|---|---|---|
| `sources.json` | `Source` | The evidence everything else cites |
| `countries.json` | `Country` | Jurisdictions; alignment / risk are attested judgments |
| `deposits.json` | `Deposit` | Geological resources (Browns Range, Wimmera, Glenaladale, Pela Ema) |
| `organizations.json` | `Organization` | Companies, government bodies |
| `projects.json` | `Project` | Mines / stockpiles developing a deposit; `products` records the form each actually ships |
| `facilities.json` | `ProcessingFacility` | Refineries, separation, metallisation, magnet plants; each carries an attested `accepted_feeds` envelope and `products` |
| `materials.json` | `Material` | Concentrates, carbonates, oxides, alloys, magnets |
| `components.json` | `Component` | NdFeB magnet → required oxides |
| `systems.json` | `System` | Defence systems → required components |
| `relationships.json` | `Relationship` | `SUPPLIES`, `INVESTED_IN`, `ALTERNATIVE_TO` edges not already expressed as node fields |
| `relationships_inferred.json` | `Relationship` | **Derived, not evidence.** `CAN_SUPPLY` edges written by the form-matching pass. Regenerate, never hand-edit |

## Conventions

- **Ids** are prefixed by type: `src-`, `dep-`, `org-`, `proj-`, `fac-`, `mat-`, `cmp-`, `sys-`, `rel-`.
  Countries use ISO alpha-2 (`AU`).
- **Provenance is attached to the assertion, not the node.** Decision-relevant fields are wrapped as
  `{"value": ..., "provenance": {"type", "source_id", "assertion_confidence", "last_verified"}}`.
  - `type`: `MEASURED` / `REPORTED` (must cite a source) · `INFERRED` (a *person* derived it, e.g.
    coordinates read off a map grid) · `JUDGMENT` · `MODEL_ESTIMATE` (a fitted or judged quantity) ·
    `AUTOMATED` (a deterministic rule wrote it, no document and no human in the loop - reproducible by
    re-running its generator, and safe to delete and rebuild) · `UNKNOWN`.
  - `assertion_confidence`: `HIGH` / `MEDIUM` / `LOW` — confidence in *this claim*, separate from
    `source_confidence` on the source itself.
  - `last_verified`: the date someone actually checked the claim against the document.
  - `unverified_model_extraction`: `true` (the default) means a model read the document and wrote the
    claim, and no human has since checked it. Set it to `false` only after a person has verified the
    claim against the source.
- **Relationship status** is the evidentiary status of the edge, not of the endpoints:
  `OBSERVED` (happening / in force) · `CONTRACTED` · `PLANNED` · `POTENTIAL` · `UNRESOLVED`
  (counterparty unknown; `to_id` is `null`) · `HISTORICAL`.
  For `ALTERNATIVE_TO` edges it means "how real is this alternative today".
- **Never fabricate.** If a document doesn't give a coordinate, tonnage or date, leave it `null`
  and say so in the `note` / `description`. Corrections from a primary source beat the v0 brief.
- **Sources grow with the entities that cite them.** Don't add a source until a claim uses it.

## Commented-out records

JSON has no comment syntax, so a record that is currently out of scope carries a
`"_commented_out": "<reason>"` as its first key and is skipped by `load()` in
`scripts/validate_data.py`. The record is left byte-for-byte otherwise intact, in place and in
order: deleting that one line puts it back, and the diff of scoping the set up or down is one
line per record rather than a block move.

**Currently loaded: the Dy/Tb mining and refining chain, plus the end-use column** - deposits,
mines and stockpiles, beneficiation, refineries and separation plants, plus the organizations,
jurisdictions, sources and edges that describe them, and `systems.json` -> `components.json` ->
oxides. Recycled magnet feed (`mat-sintered-ndfeb-magnet`) stays too, because Mountain Pass,
Caremag and Wheat Ridge accept it as refinery *input*.

Commented out, in two groups:

- **The plants between refining and the end use.** `fac-less-common-metals`
  (metallisation/alloying), `fac-usar-stillwater` and `fac-neo-narva` (magnet manufacturing);
  `org-vacuumschmelze` (magnet plant).
- **Whatever that left with no in-subset reference.** The 4 edges with a commented-out endpoint
  (including `rel-caremag-supplies-neo-narva`, the only attested ex-China Dy/Tb *demand* edge, so
  restore it first if the metal-to-magnet stage comes back); `org-less-common-metals`;
  `mat-re-metals` and `mat-ndfeb-alloy`; countries `GB` and `DE`.

Note the shape this leaves: `systems.json` and `components.json` state what the end use *requires*
in oxide terms, but the physical path from separated oxide to magnet is commented out, so nothing
connects the two halves. `cmp-ndfeb-magnet` and `src-dod-ree-magnet-publications` are loaded only
because `systems.json` requires and cites them - restoring a system means restoring both.

Light rare-earth material records (`mat-ndpr-oxide`, `mat-lreo`, `mat-sm-oxide`, `mat-eu-oxide`,
`mat-gd-oxide`) are **kept**: they are co-products of in-subset refineries, and dropping them
would mean editing `products` and `capacities` inside records that are themselves in scope.
Scoping by element rather than by stage is a separate, more invasive pass.

## Verifying a source

Every claim in the graph should trace to a checkable document. To anchor a placeholder source:

1. Get the document (URL or PDF). For PDFs, download it and read it directly — summaries are
   unreliable. Large PDFs: `api/.venv/bin/python -c "from pypdf import PdfReader; ..."` to find
   pages, since the built-in PDF reader needs poppler.
2. `grep -rn "<source id>" api/src/data/` to list every claim that cites it.
3. Table each claim against the document: supported / wrong / not in this document.
4. Rename the source id to something document-specific (e.g. `src-ntu-browns-range-dfs-2025`),
   fill `published_on`, `url`, `locator` (page/table refs), and update every citing id.
5. Correct wrong claims, fill gaps the document provides, and set `last_verified`.
6. A claim the document does **not** support must not keep citing it — re-cite to a document that
   does, or move it to an explicit placeholder source named `... - DOCUMENT NOT YET IDENTIFIED`
   with `url: null` and `LOW` confidence.
7. Run `api/.venv/bin/python scripts/validate_data.py` from `api/`.

Verified so far:

| Source id | Document | Date |
|---|---|---|
| `src-ntu-browns-range-dfs-2025` | Northern Minerals ASX release + DFS Executive Summary | 2025-09-15 |
| `src-iluka-eneabba-fid-2022` | Iluka ASX notice: Eneabba refinery FID | 2022-04-03 |
| `src-iluka-ar25-2025` | Iluka 2025 Annual Report | 2026-02-18 |
| `src-lynas-q4-fy26-quarterly` | Lynas Quarterly Report, period ended 30 Jun 2026 | 2026-07-22 |
| `src-energy-fuels-hre-construction-2026` | Energy Fuels: commercial-scale heavy REE plant under construction | 2026-07-29 |
| `src-carester-caremag-launch-2025` | Carester: Caremag secures EUR 216M | 2025-03-17 |
| `src-solvay-la-rochelle-inauguration-2025` | Solvay: La Rochelle inauguration press release | 2025-04-08 |
| `src-neo-silmet-hree-commissioning-2026` | Neo: HREE separation line commissioned at Silmet | 2026-04-10 |
| `src-ucore-dod-phase2-2025` | Ucore: US$18.4M DoD Phase 2 award launch | 2025-07-14 |
| `src-mp-materials-dod-partnership-2025` | MP Materials: DoD public-private partnership | 2025-07-10 |
| `src-lynas-hre-expansion-2025` | Lynas ASX: expanded HRE separation facility, Malaysia (Dy/Tb nameplate) | 2025-10-29 |
| `src-bre-carester-offtake-2025` | BRE / Carester 10-year heavy REE offtake and partnership | 2025-10-09 |
| `src-aclara-carina-fs-2026` | Aclara: Carina feasibility study filing and results | 2026-04-13 |
| `src-ucore-engineering-report-2026` | Ucore: Louisiana SMC optimized deployment plan | 2026-05-28 |
| `src-iluka-investor-briefing-2025` | Iluka Investor Briefing (Eneabba 750 tpa Dy/Tb capacity; Wimmera ~15 ktpa) | 2025-05-05 |
| `src-mp-q3-2025-results` | MP Materials Q3 2025 8-K (Dy/Tb circuit 200 MT/yr; 3,000 MT feed) | 2025-11-06 |
| `src-mp-10k-fy2025` / `src-mp-sk1300-trs-2025` | MP FY2025 10-K and SK-1300 technical report (SEG+ ~4% Dy/Tb) | 2026-02-26 |
| `src-mp-10q-q2-2026` | MP Q2 2026 10-Q (commissioning slips to H2 2026; no Dy/Tb produced) | 2026-08-07 |
| `src-neo-aif-2026` | Neo 2026 AIF (Silmet 3,200 mT facility total; Narva 2,000 t) | 2026-03-31 |
| `src-neo-carester-2026` | Neo / Carester binding term sheet (Caremag Dy/Tb to Narva; Silmet tolling) | 2026-08-31 |
| `src-mkango-crma-2025` | Mkango CRMA strategic project RNS (Pulawy 50 tpa Dy/Tb - conflicted) | 2025-03-25 |
| `src-mkango-pulawy-pfs-2026` | Mkango Songwe FS + Pulawy PFS (product suite excludes separated Dy/Tb) | 2026-03-19 |
| `src-aclara-louisiana-site-2025` | Aclara Louisiana site selection (200/30 t Carina+Penco basis) | 2025-10-24 |
| `src-aclara-dynamo-scoping-2026` | Aclara Project Dynamo scoping study (148 t Dy, 25 t Tb) | 2026-04-13 |
| `src-aclara-itep-2026` | Aclara ITEP final approval (~US$20.8M; groundbreaking Q4 2026) | 2026-06-26 |
| `src-ucore-scaleup-2026` / `src-ucore-caldeira-mou-2024` | Ucore capacity basis (contained TREO) and the sole Dy/Tb basket | 2026-08-05 / 2024-08-21 |
| `src-lynas-ar25-2025` | Lynas FY2025 Annual Report (Seadrift US$258m allocated, expenditure-based) | 2025-08-28 |
| `src-lynas-dow-loi-2026` | Lynas / US DoW letter of intent (Seadrift uncertainty, pivot) | 2026-03-16 |
| `src-lynas-ar26-2026` | Lynas FY2026 Annual Report (Texas facility "will no longer proceed") | 2026-08-26 |
| `src-usar-10k-fy2025` | USAR FY2025 10-K (Wheat Ridge is a demo facility; Stillwater 600 MTPA) | 2026-03-30 |
| `src-usar-defm14a-2026` | USAR merger proxy (Serra Verde terms; Pela Ema 6,400 t/y TREO) | 2026-07-24 |
| `src-usar-10q-q2-2026` | USAR Q2 2026 10-Q (Wheat Ridge samples, Jul 2026) | 2026-08-10 |
| `src-viridis-colossus-pfs-2025` | Viridis Colossus PFS (Table 3 production; Tables 6/7 ANSTO MREC assemblage) | 2025-07-09 |
| `src-viridis-funding-2026` | Viridis: US$120M strategic equity, DFS complete, FID Q4 2026, offtake unresolved | 2026-08-20 |

## Pending sources

These are placeholders (`url: null`). The graph works without them; anchoring them raises the
confidence you can place on the claims listed.

| Source id | Backs | Document to find |
|---|---|---|
| `src-gcm-fingerboards-disclosures` | Fingerboards stage/status, 280 ktpa HMC, unresolved downstream refinery, `ALTERNATIVE_TO` (LOW) | Gippsland Critical Minerals project pages / ASX releases |
| `src-au-gov-major-project-status-fingerboards` | Fingerboards 200 tpa HREO / 1,800 tpa LREO | Australian Government Major Project Status listing (DISR) |
| `src-dod-ree-magnet-publications` | Magnet dependency for the seven named systems | DoD industrial-base / rare-earth reports naming F-35, Virginia/Columbia, Tomahawk, Predator, radar, JDAM |
| `src-usar-caremag-split-2026` | Caremag's 500 t Dy / 100 t Tb per-element split | USA Rare Earth news release, 23 Jul 2026 |
| `src-viridis-colossus-dfs-2026` | Every Colossus DFS number, including the two inputs to its 124 tpa Dy+Tb | VMM ASX, 20 Aug 2026, 'Colossus DFS Confirms Project Bankability and Execution' - title and date known from Reference 3 of the funding release; PDF not retrieved |

## Coverage

Deliberately a Pareto frontier of ex-China Dy/Tb supply, not a census: the nodes that are operating,
commissioning, or funded and building. Currently held - Lynas (Mt Weld / Kalgoorlie / Lynas Malaysia,
the only commercial ex-China Dy/Tb separation in production), MP Materials, Energy Fuels (White Mesa
+ Donald feed), Caremag, Solvay La Rochelle, Neo Silmet, Ucore, Mkango Pulawy, alongside the original
Iluka / Northern Minerals / USA Rare Earth set.

The mining side was closed to match: Carina + Penco (Aclara), Monte Alto (BRE), Songwe Hill (Mkango),
Lofdal (Namibia Critical Metals), Caldeira (Meteoric), Makuutu (Ionic Rare Earths), Round Top (USAR),
Mt Weld and Mountain Pass, plus Colossus (Viridis). Round Top and Penco in particular closed
structural holes - both had a downstream plant modelled without its deposit. Colossus closed a
different kind of hole: it was excluded on an assumption rather than a document, and the assumption
was wrong in both directions - it is the most advanced unfunded-gap-free ionic clay project ex-China
(DFS complete, equity fully identified, FID targeted Q4 2026), yet it carries far less Dy/Tb than its
size implies. See the basket note below.

Still knowingly excluded, none having a comparable disclosed Dy/Tb figure: Steenkampskraal, Tanbreez,
Pensana (Longonjo), Rainbow (Phalaborwa), Hastings (Yangibana, NdPr-focused), Vietnam, IREL, and the
MP-Ma'aden Saudi JV. Add one only when a primary document supports a stage, date or capacity worth
alerting on.

### Reading the capacity numbers

`Capacity` now carries `target_year` and `note`, mirroring `ProductionFigure`. **Entries for the same
material on the same facility supersede one another - never sum them.** White Mesa holds Dy at 120 t
(2027) and 288 t (2029); Ucore holds TREO throughput at 600 / 3,600 / 9,600 t for successive build
stages. Filter by `target_year` and take the max per material.

Attested ex-China Dy+Tb *separation* capacity, on that basis: **2,213 tpa by 2028** (Eneabba 750,
Caremag 600, Lynas Malaysia 300, Mountain Pass 200, Project Dynamo 173, White Mesa 140, Pulawy 50)
rising to **2,441 tpa by 2029** as White Mesa's second expansion lands. Set that against Lynas's FY26
actual output of **62 t** - still the only ex-China Dy/Tb produced at commercial scale. Nameplate
exceeds demonstrated output by roughly 36x, and every number is feedstock-conditional.

#### `mat-dytb-combined`, and the Dy/Tb split

Most operators disclose Dy and Tb as **one number**. That was previously stored as `mat-hreo`, which
also means the broader heavy-oxide bucket - one id for two different claims, distinguished only by
prose. `mat-dytb-combined` now carries the unsplit disclosure. It is a **reporting unit, not a
physical product**: Eneabba, Mountain Pass and Caremag all make separated Dy and Tb oxide, so it does
not belong in any `accepted_feeds` / `products` list. Nine entries moved; only
`proj-fingerboards` stayed on `mat-hreo`, its note saying "heavy rare-earth oxides *including* Dy and
Tb" rather than a Dy+Tb figure.

Where the split is not disclosed it is estimated and recorded as `JUDGMENT` with **no `source_id`** -
the underlying document does not support it, so it must not cite one.

| Node | Combined | Dy | Tb | Ratio basis | Provenance |
|---|--:|--:|--:|---|---|
| `fac-caremag-lacq` | 600 | 500 | 100 | USAR release, 23 Jul 2026 | `REPORTED` / MEDIUM |
| `proj-caldeira` | 127 | 104 | 23 | own LOM split, same document (4.64) | `JUDGMENT` / MEDIUM |
| `proj-penco` | 52 | 46 | 6 | own LOM split, **cross-source** (7.41) | `JUDGMENT` / MEDIUM |
| `fac-eneabba` | 750 | 642 | 108 | pooled median 5.92 | `JUDGMENT` / LOW |
| `fac-mountain-pass-refinery` | 200 | 171 | 29 | pooled median 5.92 | `JUDGMENT` / LOW |
| `proj-monte-alto` | 150 | 128 | 22 | pooled median 5.92 | `JUDGMENT` / LOW |
| `proj-songwe-hill` | 56 | 48 | 8 | pooled median 5.92 | `JUDGMENT` / LOW |

**Never sum a split with its `mat-dytb-combined` parent** - the parent is the disclosed figure the
split came from. Prefer a node's own ratio where it discloses one on another basis (Caldeira and Penco
both split their LOM totals but not their annual figures); fall back to the pooled median only
otherwise. Caldeira's is a same-document ratio and its result is corroborated - the DFS's own LOM
notes annualise to ~105 tpa Dy and ~23 tpa Tb, which the derivation reproduces at 104/23. Penco's is
**not** same-document: the ratio comes from the 2021 PEA (12-year life) while the combined 52 tpa
comes from a 2026 presentation stating a 17-year life. A ratio is an assemblage property and survives
a life revision better than a tonnage does, so it still beats the pooled median - but it is a
cross-source transfer and the note says so.

The pooled median is 5.92 - the median Dy:Tb of the nine nodes that disclose both. Splitting that
sample into mine-only (median 6.69) and plant-only (5.46) medians tested **worse**, n being too small,
even though plants really are more Tb-rich than their feed. Backtested leave-one-out: **median
absolute error on Tb 13%, maximum 34%**, and the misses are biased toward *under*-stating Tb. The
Caremag holdout - combined 600 disclosed by Carester, split later attested by USAR - came in at Tb 87
against an actual 100.

Two limits on that method. The observed ratio range is 3.60-7.41 (Tb 11.9-21.7% of Dy+Tb) - use the
band, not the point, for sensitivity. And deposit type moves it: Mt Weld's LREE carbonatite sits at
2.78-4.00 against 6.2-7.9 for ionic clay and xenotime, so the estimate does not transfer to a
carbonatite or monazite-sands node without saying so.

**"Ionic clay" is not one population, and the parent lithology is what moves the ratio.** Adding
Colossus split the clay nodes cleanly by source rock. Granite-derived clays sit high - Serra Verde
5.8, Makuutu 6.3, Carina 5.8, Penco 7.4 - while the two Pocos de Caldas *alkaline-complex* clays sit
near 4.6: Caldeira discloses 4.64, and Colossus's PFS assemblage implies 4.0 (Northern Concessions)
and 5.5 (Southern Complex). Do not apply the pooled 5.92 to a Pocos de Caldas node; use Caldeira's
disclosed 4.64 as the comparator. The tenor differs even more than the ratio - Dy+Tb is 1.3-1.5% of
product TREO at Colossus against 3.8% at Serra Verde and 4.44% at Makuutu, because the Pocos de Caldas
basket is lanthanum-dominated (La2O3 44-48% of product TREO) and Ce-depleted.

**Fit for purpose:** feed-security and reroute ranking, where a 13% Tb error reorders nothing.
**Not** for sizing a Tb shortfall against demand - the error band is comparable to the entire ex-China
Tb margin, and `Component.requires` carries no quantities, so there is no demand ratio to compare
against. Two nodes are deliberately left unsplit: `fac-mkango-pulawy` (its 50 t parent is flagged
CONFLICTED) and Mountain Pass's 120 t SEG+-feed entry (itself a `MODEL_ESTIMATE`; splitting it would
compound two estimates). Mountain Pass now holds two `mat-dytb-combined` entries at `target_year`
2026 - 200 t nameplate and 120 t on own feed - which are different *bases*, not supersessions; the
missing `basis` field noted below is what would disambiguate them.

Eneabba's 750 tpa is the largest of them and applies to the 23,000 tpa max-TREO blended-feed case,
not to owned stockpile feed - under Iluka's own Scenario C (stockpile + Balranald) steady state is
15.1 ktpa TREO and 3.3 ktpa NdPr. Realising 750 tpa needs heavy-rich third-party concentrate,
principally Browns Range xenotime, whose supply agreement has unsatisfied conditions precedent.

Two nodes still disclose **no Dy/Tb capacity**, and in both cases that is now known to be deliberate
rather than a research gap:

- **Ucore SMC** - every published figure is *contained TREO in feedstock* ("processing up to
  approximately 9,600 tpa of contained TREOs"). The plant is explicitly multi-feed, so output would
  swing several-fold on feed choice; the only Dy/Tb-bearing basket Ucore has quantified is the
  non-binding 2024 Caldeira MOU (~0.8% Dy, 0.2% Tb of TREO). The techno-economic assessment that
  would contain a split is proprietary to the Department of War. **Do not cross-apply Aclara's much
  richer ionic-clay ratios.**
- **Neo Silmet** - no tonnage exists for the HREE line in any Neo document. The only Silmet nameplate
  (3,200 mT) is facility-total and predates the heavy line. Neo says "pre-cursor dysprosium and
  terbium" and "process solutions", never finished oxide; secondary outlets calling it a Dy/Tb *oxide*
  line contradict Neo's own wording.

Do not treat the totals above as a market view: they are what operators have committed to on paper.

### The feed side, and the gap that matters

Quantified annual contained Dy+Tb in planned mine output: Serra Verde 203, Fingerboards 200, Carina 183,
Monte Alto 150 (contracted maximum), Wimmera 145, Lofdal 137, Caldeira 127, Colossus 124, Donald 98,
Songwe Hill 56, Penco 52, Makuutu 51 - plus Browns Range at 4,860 t over an 11-year LOM (~442 tpa).
**All are contained in concentrate or carbonate, never separated oxide.**

The two **operating** mines are bounded rather than projected, and are not additive with the above in
kind - one is a floor on material that actually moved, the other a re-attributed model estimate:

| Mine | tpa | Basis | Provenance |
|---|--:|---|---|
| `proj-mountain-pass` | 120 | 3,000 t/yr SEG+ x ~4% Dy+Tb, re-attributed from the refinery node | `MODEL_ESTIMATE` / MEDIUM |
| `proj-mount-weld` | **>= 62** | mass balance from Lynas Malaysia's FY26 actual output | `INFERRED` / HIGH |

Set roughly 2,150 tpa of quantified ex-China mine feed against 2,213 tpa of refining nameplate.
(That total keeps this section's long-standing convention of counting Fingerboards' 200 t, which is
the one genuine `mat-hreo` bucket figure rather than a Dy+Tb number. A query that filters strictly on
`mat-dytb-combined` plus split Dy/Tb entries returns **1,950 tpa** - the same fourteen mines, minus
Fingerboards. Both are correct; say which basis you are on.)

**Do not read the remaining margin as a finding.** On the loose basis it is now 63 tpa, under 3% of
either total, which is smaller than the rounding on several individual nodes. It also sits inside a
coverage bias that runs one way: the deliberate exclusions are almost all *mines* (Steenkampskraal,
Tanbreez, Pensana, Hastings, Vietnam, IREL, MP-Ma'aden) with no comparable excluded ex-China
separation plant, and five in-graph mines still carry no Dy/Tb figure at all - including
`proj-eneabba-stockpile`, which is the primary declared feed to a 750 tpa refinery. Adding Colossus
moved the loose-basis margin from +9% to +2.9% on its own. The honest statement is that committed
refining nameplate and quantified mine feed are **roughly in balance** by 2028, not that the build-out
is running ahead of feed.

What survives, and what this graph is actually for, is the *pairing* rather than the aggregate: only
about half the 2,213 tpa nameplate has a firm feed edge from a quantified mine, while roughly 1,100 tpa
of mine supply - Serra Verde, Fingerboards, Colossus, Lofdal, Caldeira, Wimmera, Penco, Makuutu - has
no committed route to a Dy/Tb-capable plant. Over- and under-supply coexist, and the aggregate hides
both. Every refinery node carries an explicit feedstock condition.

#### Bounding a mine from downstream actuals

Where a mine discloses nothing but its output is *observably flowing through a sole-source chain*, the
downstream actual is a valid floor and beats any assay arithmetic. Mt Weld is the case: Lynas Malaysia
produced 62 t Dy+Tb across FY26 (9 / 26 / 8 / 19 by quarter), its only feed is Kalgoorlie and
Kalgoorlie's only feed is Mt Weld, so contained Dy+Tb at the mine is at least 62 t once recovery losses
are allowed for. The upper bound is disclosed too - Lynas says its 250 t Dy / 50 t Tb nameplate is
"subject to sourcing other potential feedstock", i.e. Mt Weld alone cannot fill it. **62-300 tpa**, both
ends anchored. Note the symmetry: the sole-source chain that makes Mt Weld the highest-impact disruption
in the graph is the same property that makes the bound valid.

This is the only Dy/Tb feed figure here derived from material that actually moved, which makes it more
reliable than Browns Range's 442 tpa - a feasibility projection for a mine that does not yet exist.

**Do not** substitute the reserve-grade route for Mt Weld (0.63% Dy2O3 + 0.16% Tb4O7 = 0.79% of TREO):
that is ore-basis, and the concentrate assemblage is a hard null. It is still worth one free check -
inverting 62 t at 0.79% implies ~7,850 t TREO through the chain, reconcilable against Lynas's FY26 REO
production.

Neither operating mine is split into Dy and Tb. Both are LREE carbonatites, and the pooled median 5.92
explicitly does not transfer to a carbonatite - Mt Weld's own assemblage sits at 2.78-4.00. Splitting
them would apply a ratio the data says is wrong for exactly this deposit type.

**Makuutu is the best-evidenced derived figure in the graph** at 51 tpa (Dy 44 / Tb 7). The DFS prints
the annual tonnages only as unlabelled bars, but publishes both inputs, and two derivations sharing no
inputs agree to within 2.1%: 1,156 t REO x the 3.82%/0.62% basket shares gives 51.3 t, while the
172.9 Mt @ 848 ppm reserve over 35 years at the disclosed Dy 49% / Tb 45% recoveries gives 50.2 t. The
second route back-implies basket shares of 3.77% and 0.58% against the disclosed 3.82% and 0.62%, and an
overall REO recovery of 27.6% that reproduces the disclosed 1,156 t. Makuutu is also the one node whose
per-element split needs no ratio judgment - the DFS discloses Dy and Tb shares separately, so both are
`MODEL_ESTIMATE`, not `JUDGMENT`.

Mines carrying **no** Dy/Tb figure: Eneabba stockpile, Kangankunde (LREE - Lindian publishes NdPr only)
and Round Top (exploration stage, no production figure of any kind).

This list used to be longer, and used to say the gaps were "disclosure-limited rather than unresearched".
**That was wrong.** Three of the four mines it named turned out to have public numbers, none of which
required new disclosure:

| Mine | Where the figure actually was | tpa Dy+Tb |
|---|---|--:|
| Donald | Energy Fuels press release, 3 Jun 2024 | 98 (Ph1, as disclosed) |
| Wimmera | Iluka ASX Ore Reserve notice, 22 Feb 2023 | 145 (separated) |
| Serra Verde | a **chart image** inside SEC 8-K EX-99.3, 20 Apr 2026 | 203 (contained, derived) |

Treat "not disclosed" as a claim needing evidence, the same as any other. The Serra Verde case is the
instructive one: EDGAR full-text search returns zero hits for `Dy2O3` and `Tb4O7` across every USA Rare
Earth filing, because the numbers are pixels, not text.

#### Contaminated figures in circulation - reject on sight

Serra Verde attracts a specific, repeated error: USAR's basket split of NdPr 22% / Dy 19% / Tb 13% /
Y 42% is explicitly **% of value** (EX-99.3 footnote 5), and several outlets multiply it by 6,400 t as
though it were % of mass.

- **Dy ~1,024 t and Tb ~1,024 t** (Discovery Alert, 23 Apr 2026) - roughly 6x and 34x too high. Equal Dy
  and Tb mass is physically impossible; the real ratio is ~6:1, and 1,024 t Tb exceeds Benchmark's entire
  non-China Tb supply of 74 t by 14x.
- **"about 32% will be terbium and dysprosium"** - Bloomberg/MINING.COM, 23 Apr 2026, quoting Serra Verde's
  COO. Same value share, same misreading, more authoritative outlet.
- **"2.5-3.5% dysprosium oxide and 0.8-1.2% terbium oxide"** (Discovery Alert, unsourced) - the Dy range
  happens to bracket the truth, the Tb range is ~2x too high.

By mass, Dy+Tb is about 3.8% of Serra Verde's product TREO. None of these figures is in the graph; the
notes on `proj-serra-verde` and `dep-pela-ema` record them so they stay out.

Colossus attracts two errors of its own, and the first is **the company's own headline contradicting its
own tables** - a reminder that "primary source" is not the same as "any sentence in a primary source":

- **190 tpa Dy+Tb**, from the PFS page 2 line "9,500 tonnes of TREO and 3,500 tonnes of MREO, with a
  high-value mix comprising 36% NdPr oxides and **2% DyTb oxides**". Tables 3, 6 and 7 of the same
  document put Dy+Tb at 1.2-1.5% of TREO. The 2% is a rounded-up headline; the tables are the claim.
- **~380 tpa Dy+Tb**, from applying the ~4%-of-TREO share that holds at Serra Verde and Makuutu to
  Colossus's 9,500 tpa TREO. About 3x too high, and the instructive failure: it treats "ionic clay" as a
  basket when the parent lithology is what sets the basket. This one was generated *inside* this project
  during a coverage review, not by an outlet - derived figures need the same scepticism as sourced ones.

The correct figure, 124 tpa, is a definitional subtraction (MREO minus NdPr, since Viridis defines MREO
as Dy2O3 + Nd2O3 + Pr6O11 + Tb4O7) corroborated by four independent routes landing in 117-142. See the
note on `proj-colossus`.

### Mine to refinery compatibility

**Compatibility is never inferred from material category or id.** `MaterialCategory` describes stage
in the chain (ORE, CONCENTRATE, CARBONATE, ...), not chemistry: LREE monazite and HREE xenotime are
both `CONCENTRATE` and behave differently in acid consumption, cracking and radionuclide handling. A
naive "mine product id appears in refinery input list" join over this data yields 46 matches
of which only 9 have any evidence - 35 of them generated by `mat-mrec` alone, shared by six mines and
five refineries - while missing two CONTRACTED edges. Do not use it.

The chemistry that category omits now lives on `HostMineral`, recorded on the *feed* rather than on the
`Material`, because one id is legitimately shipped in several hosts: `mat-re-concentrate` covers Mountain
Pass bastnaesite, Wimmera monazite/xenotime, Mt Weld's churchite-bearing flotation concentrate and Round
Top's leach-derived stream. `UNDISCLOSED` is a real value and fails closed - an unknown host never clears
a narrowed envelope.

Compatibility lives on the edge instead, as `RelationshipType.CAN_SUPPLY` plus a `qualification` tier:

| Tier | Meaning |
|---|---|
| `QUALIFIED` | testwork done, contract signed, or the operator names this specific feed |
| `FEED_ENVELOPE` | the operator states it accepts this *class* of material, but not this source |
| `PLAUSIBLE` | chemistry suggests it could work; no public evidence |
| `INFEASIBLE` | flowsheet or product form rules it out - recorded to prune the reroute space |

**`qualification` and `status` are orthogonal and you need both.** `status` records whether material
*does* flow (commercial); `qualification` records whether it *could* (technical). Browns Range to
Caremag is `FEED_ENVELOPE`/`POTENTIAL`; Wimmera to Eneabba is `FEED_ENVELOPE` on an edge that is
already `POTENTIAL` between the same owner's assets.

Put the tier on the existing `SUPPLIES` edge where material already flows - `CAN_SUPPLY` is only for
routes that are *not* happening, and the validator warns if you duplicate. `qualification_lead_months`
is a modelling heuristic for disruption scenarios, never a disclosed lead time; say so in the `note`.

#### `accepted_feeds` vs the edge layer - they are independent on purpose

`accepted_feeds` is a **coarse product-class descriptor** of what a plant has said it can take, each
class citing the disclosure it was read from; `ProcessingFacility.input_material_ids` survives as a
derived view of it. Compatibility with a *specific source* lives on the edge. The two are maintained
separately and are allowed to disagree: when they do, that disagreement is information, and
`validate_data.py` now warns on every one of them rather than leaving them to prose.

Three facilities were under-declared against their own documented feed envelopes and have been widened -
**from the documents, never by back-filling from the edges**:

| Facility | Added | Documentary basis |
|---|---|---|
| `fac-eneabba` | `mat-monazite-concentrate`, `mat-mrec` | Iluka: "capable of processing a broad range of feedstocks including mineral sands concentrates, hard rock concentrates and **ionic clay carbonates**" (Investor Briefing, 5 May 2025), plus the contracted Kangankunde monazite |
| `fac-caremag-lacq` | `mat-hre-concentrate` | Carester: dual feed of end-of-life magnets and "5,000 t/yr of **mining concentrates**"; Monte Alto SEG+/HRE concentrate is contracted |
| `fac-usar-wheat-ridge` | `mat-re-concentrate`, `mat-sintered-ndfeb-magnet` | USAR: operations "validate flowsheets for **Round Top**, third-party feedstock and **magnet swarf** recycling" |

That took edge/input mismatches from 18 to 6 and resolved every one on a firm edge. **The remaining six are
deliberate. Do not close them by widening the input lists** - each is a real envelope boundary the edge
tier is correctly recording:

- **MREC into `fac-caremag-lacq`** (Serra Verde, Lofdal, Caldeira) - Carester's stated class is *mining
  concentrates*. The Lofdal edge note says it directly: a mixed 99% TREO carbonate "is not a mining
  concentrate, so it sits outside Carester's stated feed class on form". MREC is outside the envelope.
- **Xenotime into `fac-ucore-louisiana`** (Browns Range) - Ucore's declared envelope is MREC/MREO. The
  edge is `PLAUSIBLE`, not `FEED_ENVELOPE`, precisely because the form sits outside it.
- **Heavy mineral concentrate into `fac-eneabba`** (Fingerboards) - HMC is a bulk mineral-sands stream
  that needs separation into monazite/xenotime before any refinery takes it. **The missing node is an
  intermediate mineral-separation step**, not a wider input list; `mat-heavy-mineral-concentrate` has no
  accepting facility anywhere in the graph, and Fingerboards is the only mine with no valid declared path.
- **`mat-hre-concentrate` into `fac-mountain-pass-refinery`** (Monte Alto) - MP's declared inputs already
  match its documented envelope exactly (its COO named just two classes, SEG+ and a full MREC with lights
  and heavies, both declared). Monte Alto's own note describes its product as SEG+, so the likely fix is
  the **edge's** `material_ids`, not MP's input list. Left as-is pending a document on Monte Alto's
  product form.

Two materials still have no producer or no consumer, and both are structural gaps rather than data errors:
`mat-heavy-mineral-concentrate` (produced by Fingerboards, accepted by nobody) and `mat-seg-plus`
(accepted by Mountain Pass, produced by no node - the same stockpile-has-no-upstream-node gap noted above).

Two constraints that recur and are **not** technical - record them in the `note`, because a chemistry-
only reading of the matrix will get them wrong:

- **Commercial foreclosure.** JOGMEC holds a first right of refusal over *all* Lofdal production, so
  Lofdal routes are shut regardless of it having the richest assemblage in the graph.
- **Compatibility is not availability.** Carina fits Ucore's envelope, but it is designated to Aclara's
  own Project Dynamo, whose economics rest on a US$314.4M annual separation fee from Carina.

#### The automated first pass, and what it is allowed to decide

`src/feed_matching.py` tiers every (mine product, plant envelope) pair from node data alone. It never
reads the edge layer. `scripts/verify_feed_matching.py` scores it:

| Measure | Result |
|---|--:|
| Tier agreement on curated cells (inside vs outside the envelope) | **57/62 = 91.9%** |
| Exact tier, excluding the 13 QUALIFIED edges it cannot reach | 44/49 = 89.8% |
| Uncurated cells it proposes for review | 90 of 218 (41%) |
| Uncurated cells it prunes without review | 128 |

**It never emits `QUALIFIED`.** That tier means testwork was done, a contract was signed, or the
operator named this specific feed - all pair-specific evidence that exists on neither node. The best
form can support is `FEED_ENVELOPE`, so 13 of the 62 curated tiers are unreachable by construction.

Read the two numbers differently. The 91.9% is measured only on cells a human already ruled on, and the
labelled set contains exactly **one** negative (`rel-round-top-can-supply-eneabba`), so it cannot
support a false-positive rate. The 90-cell queue has no ground truth at all: it is a review burden, not
an accuracy. It is also dominated by "any MREC into any MREC separator", which is true on form and
nearly content-free - a reminder that form screens chemistry, not availability or commercial intent.

**`INFEASIBLE` is deliberately hard to reach, and the pass does not reproduce the one curated negative.**
Form cannot separate `rel-round-top-can-supply-eneabba` (curated INFEASIBLE) from Round Top -> Caremag
(curated PLAUSIBLE): the two are form-identical, and the tiers differ only on evidence neither node
carries. The pass returns PLAUSIBLE for both, because surfacing a route for review costs a read while
pruning a real one is silent. It reserves INFEASIBLE for streams that are more processed than every
class a plant declares *and* than everything that plant makes - 20 cells, all into Lynas Kalgoorlie and
SARECO, which crack concentrate and whose own product is MREC, so an arriving carbonate has no stage to
enter. Reading the feed list alone, without the plant's `products`, hard-pruned all four curated
MREC-to-Caremag routes; declared feeds say where a flowsheet starts, not where it ends.

The five disagreements are the point of the field, not its error bar, and `validate_data.py` now warns
on each rather than leaving them to prose:

- **Three are Monte Alto**, all downstream of one unresolved question. The binding Carester offtake calls
  the product "heavy rare earth concentrate (SEG+)", which reads as `mat-seg-plus`, but the edges carry
  `mat-hre-concentrate` and no document on the mineral host has been read. Recorded as
  `UNDISCLOSED`, which fails closed. Resolving it with one document would take agreement to 60/62.
- **`rel-serra-verde-can-supply-caremag` looks like a curation slip.** Its three MREC siblings into
  Caremag (Lofdal, Caldeira, Colossus) are all `PLAUSIBLE`, and the prose above says MREC sits outside
  Carester's stated mining-concentrate class. Serra Verde alone is `FEED_ENVELOPE`. Left as-is - the pass
  flagged it, a human should settle it.
- **`rel-fingerboards-can-supply-eneabba`** is the intermediate-mineral-separation gap already described
  above, restated mechanically: HMC is upstream of every class Eneabba declares.

The pass is materialised, but into its own file. `scripts/generate_inferred_routes.py` writes all 218
uncurated cells to `relationships_inferred.json` as `CAN_SUPPLY` / `POTENTIAL` edges stamped
`AUTOMATED` / `LOW` with `source_id: null` and a `rel-auto-` id. Any pair that already carries a curated
edge is skipped outright.

| Tier written | Rows |
|---|--:|
| `FEED_ENVELOPE` | 90 |
| `PLAUSIBLE` | 108 |
| `INFEASIBLE` | 20 |

**Do not promote these into `relationships.json`.** The separation is what makes the two layers
distinguishable at all - before it existed there was no way to tell a derived route from a curated one
in the JSON, because every row in the file was curated. `validate_data.py` now enforces all three
invariants: no `AUTOMATED` row in `relationships.json`, nothing but `AUTOMATED` in
`relationships_inferred.json`, and no derived edge shadowing a curated pair. Merging them would
overwrite exactly the rows above, which is where the layer's information actually is.

### Assemblage percentages, where disclosed

The single most useful cross-check on any Dy/Tb claim, as % of TREO:

| Deposit | Dy | Tb | Note |
|---|--:|--:|---|
| Lofdal (in situ) | 5.1-5.6% | 0.8-0.9% | dedicated HREE; 6.2% Dy in concentrate |
| Penco (desorbible) | 5.5% | 0.7% | desorbible basis; total-REO basis is much lower |
| Makuutu (product basket) | 3.82% | 0.62% | post-recovery basket, not in-ground |
| Mt Weld - Duncan (2012) | 1.27% | 0.26% | not the main ore source |
| Mt Weld - CLD (2012) | 0.25% | 0.09% | the main ore source |
| MP SEG+ concentrate | ~4% combined | | stockpiled heavy concentrate, not ore |
| Caldeira | 30 ppm Dy / 6 ppm Tb of 3,524 ppm TREO (reserve) | | significance is scale, not tenor |

Mt Weld is the load-bearing one: Lynas published a full per-element distribution only between 2003 and
2012 and dropped it thereafter, so the assemblage sits in a 2012 announcement while the tonnages sit in
FY2026. The CLD's 0.25% Dy explains why Lynas states its 250 t Dy nameplate is "subject to sourcing
other potential feedstock". Mt Weld's **concentrate** assemblage is a hard null - a sweep of all 1,767
Lynas ASX announcements and 24 annual reports found no per-oxide concentrate assay ever published.

### Two nodes that are not capacity at all

- **Lynas Seadrift, Texas: cancelled.** FY2026 Annual Report p.16 - funding was "reallocated from
  funds previously intended for the construction of a HRE facility in Texas which will no longer
  proceed", replaced by a US$96m / 4-year DoW supply LOI. Lynas never says "cancelled"; the operative
  phrase is "will no longer proceed", buried in narrative with no standalone announcement. No
  impairment was attributable. The DoD contribution was **US$258m allocated** under an
  expenditure-reimbursement contract, not the ~US$288m "received" reported in trade press. No capacity
  was ever disclosed; the circulating "2,500-3,000 tpa HREO" appears to be a conflation of two
  *Malaysian* figures.
- **USAR Wheat Ridge: a demonstration facility, not a separation plant.** The FY2025 10-K says so
  twice, including in risk factors. It is leased warehouse space (US$224k total lease payments to
  Mar 2028) with "500+ planned mixer/settlers", operating since 15 Jun 2026, which produced Dy and
  NdPr oxide **samples** from recycled swarf in Jul 2026. Reclassified to `OTHER` with no outputs.

Two structural gaps in the model, surfaced by this batch:

- **Recycling feedstock has no upstream node.** Caremag's 2,000 t/yr of end-of-life magnets is neither
  a `Deposit` nor a `Project`; it is currently expressed only as `mat-sintered-ndfeb-magnet` on the
  facility's `accepted_feeds`, with no `SUPPLIES` edge and no way to model collection risk. Same
  problem will hit Cyclic, Ionic Technologies and REEtec.
- **`Capacity` cannot distinguish input throughput from product output.** Ucore's 9,600 tpa TREO,
  Lynas's 5,000 tpa HRE feedstock and Caremag's 5,000 t + 2,000 t dual feed are all *input* figures,
  while Dy 250 t is a *product* figure. Only the `material_id` disambiguates them, by convention.
  Since feedstock is the binding risk on every node in this set, a `basis` field is worth considering.
- **Facility-to-facility ownership chains are implicit.** Energy Fuels' pending ASM and VAC
  acquisitions are modelled as `INVESTED_IN` edges between organizations, so the White Mesa -> ASM ->
  VAC Sumter material path is only partly expressible.

Also unfilled, pending a dataset rather than a document: deposit coordinates and resource
estimates for Wimmera / Glenaladale / Pela Ema (USGS REE Occurrence Database, Jan 2026 Wimmera
resource announcement), facility capacities outside Eneabba, and country `risk_score`.
