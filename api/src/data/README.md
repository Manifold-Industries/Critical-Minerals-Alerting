# Seed data

One JSON file per datatype, each a top-level list whose fields mirror the dataclass in
`api/src/models/` one-to-one (enums as their string values, dates as `YYYY-MM-DD`).

| File | Dataclass | What it holds |
|---|---|---|
| `sources.json` | `Source` | The evidence everything else cites |
| `countries.json` | `Country` | Jurisdictions; alignment / risk are attested judgments |
| `deposits.json` | `Deposit` | Geological resources (Browns Range, Wimmera, Glenaladale, Pela Ema) |
| `organizations.json` | `Organization` | Companies, government bodies |
| `projects.json` | `Project` | Mines / stockpiles developing a deposit |
| `facilities.json` | `ProcessingFacility` | Refineries, separation, metallisation, magnet plants |
| `materials.json` | `Material` | Concentrates, carbonates, oxides, alloys, magnets |
| `components.json` | `Component` | NdFeB magnet → required oxides |
| `systems.json` | `System` | Defence systems → required components |
| `relationships.json` | `Relationship` | `SUPPLIES`, `INVESTED_IN`, `ALTERNATIVE_TO` edges not already expressed as node fields |

## Conventions

- **Ids** are prefixed by type: `src-`, `dep-`, `org-`, `proj-`, `fac-`, `mat-`, `cmp-`, `sys-`, `rel-`.
  Countries use ISO alpha-2 (`AU`).
- **Provenance is attached to the assertion, not the node.** Decision-relevant fields are wrapped as
  `{"value": ..., "provenance": {"type", "source_id", "assertion_confidence", "last_verified"}}`.
  - `type`: `MEASURED` / `REPORTED` (must cite a source) · `INFERRED` (derived, e.g. coordinates read
    off a map grid) · `JUDGMENT` · `MODEL_ESTIMATE` · `UNKNOWN`.
  - `assertion_confidence`: `HIGH` / `MEDIUM` / `LOW` — confidence in *this claim*, separate from
    `source_confidence` on the source itself.
  - `last_verified`: the date someone actually checked the claim against the document.
- **Relationship status** is the evidentiary status of the edge, not of the endpoints:
  `OBSERVED` (happening / in force) · `CONTRACTED` · `PLANNED` · `POTENTIAL` · `UNRESOLVED`
  (counterparty unknown; `to_id` is `null`) · `HISTORICAL`.
  For `ALTERNATIVE_TO` edges it means "how real is this alternative today".
- **Never fabricate.** If a document doesn't give a coordinate, tonnage or date, leave it `null`
  and say so in the `note` / `description`. Corrections from a primary source beat the v0 brief.
- **Sources grow with the entities that cite them.** Don't add a source until a claim uses it.

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

## Pending sources

These are placeholders (`url: null`). The graph works without them; anchoring them raises the
confidence you can place on the claims listed.

| Source id | Backs | Document to find |
|---|---|---|
| `src-iluka-wimmera-feed-scenarios` | Wimmera ~15 ktpa / 25+ yr concentrate figure (`LOW`, unverified) | Iluka investor-day / refinery feed-scenario deck; if not found, delete the figure from `projects.json` and this source |
| `src-gcm-fingerboards-disclosures` | Fingerboards stage/status, 280 ktpa HMC, unresolved downstream refinery, `ALTERNATIVE_TO` (LOW) | Gippsland Critical Minerals project pages / ASX releases |
| `src-au-gov-major-project-status-fingerboards` | Fingerboards 200 tpa HREO / 1,800 tpa LREO | Australian Government Major Project Status listing (DISR) |
| `src-serra-verde-disclosures` | Pela Ema in production since 2024; 6,400 tpa REO target by 2027; deposit | Serra Verde website / press releases |
| `src-usar-disclosures` | Serra Verde combination + 15-yr offtake (Apr 2026); Wheat Ridge, LCM, Stillwater status; intra-USAR flows | USA Rare Earth SEC filings / press releases |
| `src-dod-ree-magnet-publications` | Magnet dependency for the seven named systems | DoD industrial-base / rare-earth reports naming F-35, Virginia/Columbia, Tomahawk, Predator, radar, JDAM |

Also unfilled, pending a dataset rather than a document: deposit coordinates and resource
estimates for Wimmera / Glenaladale / Pela Ema (USGS REE Occurrence Database, Jan 2026 Wimmera
resource announcement), facility capacities outside Eneabba, and country `risk_score`.
