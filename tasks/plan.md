# Implementation Plan: Supply-Chain Data Visualization

Spec: [SPEC.md](../SPEC.md) (approved 2026-08-31) · Branch: `svenkatarao/data-visualization`
Status: **DRAFT — awaiting review**

## Overview

Expose the seed-data graph through three read-only FastAPI endpoints, then build a Next.js
front end with a Flow view (React Flow + ELK), a Geography view (react-leaflet), and a shared
Evidence panel that shows provenance for every attested value. Work is sliced so that each task
ends with something runnable: the first web task already shows live API data on screen.

## Dependency Graph

```text
api/src/models (exists)          api/src/data/*.json (exists)
        │                                  │
        └──────────┬───────────────────────┘
                   ▼
   T1  data_loader (parse + GraphRepository)  ◄── scripts/validate_data.py re-pointed here
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
   T2  serialization      T3  graph/derive_edges + build
       + GET /{kind}/{id}      + GET /graph
        │                     │
        └──────────┬──────────┘
                   ▼
   T4  web: zod schemas + client + useGraph + loading/error shell
                   │
        ┌──────────┼─────────────────────┐
        ▼          ▼                     ▼
   T5 toFlow    T9 /map: AssetMap     T7 provenance/fields.ts
      + ELK        + UnlocatedNotice     + EntityPanel (node selection)
        │          │                     │
        ▼          ▼                     ▼
   T6 custom    T10 CountryList       T8 edge selection in panel
      nodes/edges    + nav/layout
      + Legend
        └──────────┬──────────┘
                   ▼
   T11 integration: docker compose, README, final review
```

T5/T6, T7/T8 and T9/T10 are independent chains after T4 and can run in parallel sessions.

## Architecture Decisions

- **Parsing lives in `api/src/data_loader/`, not the script.** `scripts/validate_data.py` keeps
  its cross-reference checks but imports `build()` from the package, so the API and the validator
  cannot drift. The repository is built once at app startup (`lifespan`) and stored on
  `app.state`; a parse failure aborts startup with the file name in the log.
- **Wire format == seed-file format.** `serialization/encode.py` is the exact inverse of the
  loader; tests assert `encode(parse(record)) == record` for every seed record. This means the
  web zod schemas describe both the API and the JSON files.
- **`/graph` carries a `context` block** — `data.context.countries` and `data.context.sources`
  (full records) alongside `nodes` and `edges`. Rationale: the Evidence panel needs source names
  and URLs for every click, and the Geography view needs all countries; neither is a graph node
  and the spec's `/{kind}/{id}` endpoint would force N round-trips. This extends the spec's
  contract without adding a route. **SPEC.md is updated in T3** to record it.
- **Client-side fetching.** `NEXT_PUBLIC_API_URL` is a browser-facing address in
  `docker-compose.yml` (server-side fetch inside the web container would not resolve it). A
  `useGraph()` hook (`useEffect` + `AbortController` + zod) owns loading / error / retry state and
  is the only place the API is called. No SWR/React Query — one fetch, small payload.
- **ELK via the bundled build** (`elkjs/lib/elk.bundled.js`) rather than the web-worker entry,
  to avoid worker-bundling configuration in Next/Turbopack. Layout is async and runs in a hook.
- **Leaflet is client-only** through `next/dynamic(..., { ssr: false })` called from a Client
  Component (Next 16 forbids it in Server Components). Marker icons are declared explicitly with
  `L.icon` and imported asset URLs — the default icon path breaks under bundlers.
- **All visual encodings in `lib/graph/styles.ts`**: kind → colour token, status → dash pattern,
  confidence → opacity/stroke width. Components consume tokens; the Legend renders from the same
  table so it cannot disagree with the graph.
- **Selection state is one `{ kind: "node" | "edge", id } | null`** held in the view page and
  passed to both the graph/map and the panel; the panel resolves the record from the graph
  response, so it works identically on both routes.

## Task List

### Phase 1: API

- [ ] **Task 1** — `data_loader` package + `GraphRepository` (S/M)
- [ ] **Task 2** — Serialization + `GET /{kind}/{id}` + `GET /sources/{id}` (M)
- [ ] **Task 3** — Derived edges + `GET /graph` (M)

### Checkpoint A: API complete

- [ ] `pytest --cov=src` ≥ 80%; `ruff check` + `ruff format --check` clean
- [ ] `scripts/validate_data.py` prints `OK` with the same record counts as before
- [ ] `curl localhost:8000/graph | jq '.data.nodes | length'` → 43; `.data.edges | length` → 49
- [ ] SPEC.md API contract updated for `context`; human review before Phase 2

### Phase 2: Flow view

- [ ] **Task 4** — Web deps, zod schemas, API client, `useGraph`, loading/error shell (M)
- [ ] **Task 5** — `toFlow` + ELK layout + graph renders with default nodes (M)
- [ ] **Task 6** — Custom nodes, `StatusEdge`, styles, Legend, unresolved placeholder, ALTERNATIVE_TO toggle (M)

### Checkpoint B: Flow view

- [ ] All "Web — Flow view" success criteria in SPEC.md ticked by manual check
- [ ] `npm run lint`, `npm run typecheck`, `npm run build` clean
- [ ] Human review of the visual encoding before building the panel on top of it

### Phase 3: Evidence panel

- [ ] **Task 7** — `provenance/fields.ts` + `EntityPanel` for nodes (M)
- [ ] **Task 8** — Edge selection: relationship details in the panel (S)

### Phase 4: Geography view

- [ ] **Task 9** — `/map` route, `AssetMap` (client-only), markers, `UnlocatedNotice` (M)
- [ ] **Task 10** — `CountryList` with provenance, nav in layout, metadata (S)

### Checkpoint C: Feature complete

- [ ] Every SPEC.md success criterion ticked
- [ ] `docker compose up --build` serves the working app; API-down state shows retry
- [ ] Code review (`code-reviewer` agent) — CRITICAL/HIGH addressed

### Phase 5: Ship

- [ ] **Task 11** — README, final lint/build, PR (S)

## Task Details

### Task 1: `data_loader` package + `GraphRepository`

**Description:** Move the JSON → dataclass parsing out of `scripts/validate_data.py` into
`api/src/data_loader/` (`parse.py` with the per-type builders, `repository.py` with a frozen
`GraphRepository` exposing `find_all(kind)` / `find_by_id(kind, id)` / `kinds`). The script
imports `build()` from the package and keeps only its `check()` logic. Parse errors are raised as
a `DataLoadError` naming the file and record index.

**Acceptance criteria:**
- [ ] `GraphRepository.load(DATA_DIR)` returns exactly 9 sources, 5 countries, 4 deposits, 8 organizations, 6 projects, 4 facilities, 13 materials, 1 component, 7 systems, 16 relationships
- [ ] `find_by_id("projects", "proj-browns-range")` returns a `Project`; unknown kind or id returns `None` (no exception)
- [ ] A seed file with one malformed record raises `DataLoadError` whose message contains the file name

**Verification:**
- [ ] `.venv/bin/python -m pytest tests/test_data_loader.py`
- [ ] `.venv/bin/python scripts/validate_data.py` still prints `OK` and the same counts
- [ ] No parsing code remains in `scripts/validate_data.py` (only `check()` and `main()`)

**Dependencies:** None
**Files:** `api/src/data_loader/__init__.py`, `parse.py`, `repository.py`, `api/scripts/validate_data.py`, `api/tests/test_data_loader.py`
**Scope:** M

### Task 2: Serialization + entity endpoints

**Description:** Add `serialization/encode.py` (dataclass → JSON-safe dict: `StrEnum` → str, `date`
→ ISO, tuple → list, `Attested`/`Provenance` nested), an `Envelope` helper, the app `lifespan`
that loads the repository into `app.state`, and `routers/entities.py` with `GET /{kind}/{id}` and
`GET /sources/{id}`. Add `ruff` + `pytest-cov` to dev deps and a `[tool.ruff]` block.

**Acceptance criteria:**
- [ ] For every record in every seed file, `encode(parse(record)) == record` (round-trip test over all 73 records)
- [ ] `GET /projects/proj-browns-range` → 200 `{success: true, data: {...}, error: null}`; `GET /projects/nope` and `GET /widgets/x` → 404 with `success: false` and a message naming kind and id
- [ ] App fails to start (logged error naming the file) when `API_DATA_DIR` points at a corrupted copy of the seed data

**Verification:**
- [ ] `.venv/bin/python -m pytest tests/test_serialization.py tests/test_entity_endpoints.py`
- [ ] `.venv/bin/ruff check src tests scripts`
- [ ] `curl -s localhost:8000/facilities/fac-eneabba | jq .data.capacities`

**Dependencies:** Task 1
**Files:** `api/src/serialization/encode.py`, `api/src/routers/entities.py`, `api/src/routers/envelope.py`, `api/src/main.py`, `api/src/config.py` (add `data_dir`), `api/pyproject.toml`, `api/tests/test_serialization.py`, `api/tests/test_entity_endpoints.py`
**Scope:** M (borderline L — if `main.py` lifespan + config grows, split "lifespan + config" into its own XS task first)

### Task 3: Derived edges + `GET /graph`

**Description:** `graph/derive_edges.py` implements the six rules from the SPEC table as pure
generator functions; `graph/build.py` assembles `{nodes, edges, context}`; `routers/graph.py`
serves it. Update SPEC.md's API contract section to document `context`.

**Acceptance criteria:**
- [ ] `GET /graph` → 43 nodes, 49 edges (16 with `derived: false`, 33 with `derived: true`: 4 DEVELOPS, 10 OPERATES, 1 SUBSIDIARY_OF, 8 PRODUCES, 3 + 7 REQUIRES), `context.countries` (5) and `context.sources` (9)
- [ ] Every edge `from_id`/`to_id` resolves to a node id, except `to_id: null` on `UNRESOLVED` edges; derived edges from `Attested` fields carry that field's provenance, others `provenance: null`
- [ ] Each derive rule has its own unit test using a hand-built fixture (not the seed data)

**Verification:**
- [ ] `.venv/bin/python -m pytest tests/test_derive_edges.py tests/test_graph_endpoint.py`
- [ ] `.venv/bin/python -m pytest --cov=src --cov-report=term-missing` ≥ 80%
- [ ] SPEC.md "API Contract" shows the `context` block

**Dependencies:** Task 2
**Files:** `api/src/graph/derive_edges.py`, `api/src/graph/build.py`, `api/src/graph/types.py`, `api/src/routers/graph.py`, `api/src/main.py`, `api/tests/test_derive_edges.py`, `api/tests/test_graph_endpoint.py`, `SPEC.md`
**Scope:** M

### Task 4: Web foundation — schemas, client, `useGraph`, shell

**Description:** Install `@xyflow/react`, `elkjs`, `react-leaflet`, `leaflet`, `@types/leaflet`,
`zod` (versions per SPEC); add `"typecheck": "tsc --noEmit"`. Write zod schemas mirroring every
dataclass, `client.ts` with `fetchGraph()`, and a `useGraph()` hook. Replace the template
`page.tsx` with a Client Component that shows loading → error (with Retry) → a one-line summary
("43 nodes · 49 edges"). Update `layout.tsx` metadata.

**Acceptance criteria:**
- [ ] With the API running, `/` shows "43 nodes · 49 edges"; with the API stopped, `/` shows an error state whose Retry button re-fetches successfully once the API is back
- [ ] A response that fails zod validation (e.g. a node missing `kind`) surfaces as the error state with the zod issue path, not a crash
- [ ] `NEXT_PUBLIC_API_URL` missing → a clear error at first fetch, not a request to `undefined/graph`

**Verification:**
- [ ] `npm run lint && npm run typecheck && npm run build` clean
- [ ] Manual: stop the API, reload, click Retry, start the API, click Retry
- [ ] `git diff package.json` shows only the six deps + the script

**Dependencies:** Task 3 (needs the real `/graph` shape)
**Files:** `web/package.json`, `web/src/lib/api/schemas.ts`, `types.ts`, `client.ts`, `web/src/lib/api/useGraph.ts`, `web/src/app/page.tsx`, `web/src/app/layout.tsx`, `web/src/components/ui/ErrorState.tsx`
**Scope:** M

### Task 5: `toFlow` + ELK layout — the graph renders

**Description:** Pure `toFlowNodes` / `toFlowEdges` (hides materials with no incident
`PRODUCES`/`REQUIRES` edge; synthesises an `unresolved:<edge-id>` placeholder node for
`to_id: null`), an async `layoutWithElk` returning positioned nodes (left-to-right, rank order
deposit → project → facility → material → component → system, organizations in their own
partition), and `SupplyChainGraph.tsx` rendering React Flow with default node types. `page.tsx`
swaps the summary line for the graph.

**Acceptance criteria:**
- [ ] `/` renders 36 visible nodes + 2 placeholder nodes, laid out left-to-right with no overlapping nodes at default zoom; pan/zoom/fit-view work
- [ ] Stage ordering holds: every deposit is left of its project, every system is rightmost
- [ ] `toFlow.ts` and `layout.ts` import nothing from React or components (pure; test-ready)

**Verification:**
- [ ] `npm run lint && npm run typecheck && npm run build`
- [ ] Manual: screenshot at 1280px, confirm ordering and no horizontal page scroll
- [ ] `grep -L "from \"react\"" src/lib/graph/*.ts` lists all three files

**Dependencies:** Task 4
**Files:** `web/src/lib/graph/toFlow.ts`, `layout.ts`, `web/src/components/graph/SupplyChainGraph.tsx`, `web/src/app/page.tsx`, `web/src/app/globals.css` (React Flow stylesheet import)
**Scope:** M

### Task 6: Visual encoding — custom nodes, `StatusEdge`, Legend, toggle

**Description:** `styles.ts` token tables; one custom node per kind under
`components/graph/nodes/` (name, kind badge, country, status chip where the entity has one);
`UnresolvedNode` (hollow, "?"); `StatusEdge` (dash by status, opacity/width by confidence,
material-name label, distinct colour for `ALTERNATIVE_TO` and `INVESTED_IN`); `Legend`
generated from the token tables; an "Show alternatives" toggle that filters `ALTERNATIVE_TO`
edges before layout.

**Acceptance criteria:**
- [ ] Without hovering, `OBSERVED`/`CONTRACTED` (solid), `PLANNED`/`POTENTIAL` (dashed), `HISTORICAL` (muted), `UNRESOLVED` (dashed → hollow "?") are distinguishable; `LOW` confidence edges are visibly fainter than `HIGH`
- [ ] Toggling alternatives off removes the 3 `ALTERNATIVE_TO` edges and re-lays out; toggling on restores them
- [ ] Legend lists every encoding in use and nothing that is not; no colour/dash literal exists outside `styles.ts`

**Verification:**
- [ ] `npm run lint && npm run typecheck && npm run build`
- [ ] `grep -rn "#[0-9a-fA-F]\{3,6\}\|strokeDasharray" src/components` returns nothing outside `styles.ts` consumers passing tokens
- [ ] Manual: compare against SPEC "Web — Flow view" checklist

**Dependencies:** Task 5
**Files:** `web/src/lib/graph/styles.ts`, `web/src/components/graph/nodes/*.tsx` (8 small files), `edges/StatusEdge.tsx`, `Legend.tsx`, `SupplyChainGraph.tsx`
**Scope:** M by logic, L by file count — the node files are near-identical 20-line components; if it drags, land `styles.ts` + `StatusEdge` + `Legend` first (6a) and the node set second (6b)

### Task 7: Evidence panel for nodes

**Description:** `provenance/fields.ts` turns any node entity into an ordered list of
`{ label, value, provenance | null }` rows (all `Attested` fields, resource estimates,
capacities, production figures); `EntityPanel` renders them with `ProvenanceRow` (type,
confidence, `last_verified`) and `SourceLink` (source name → `url`, or "document not yet
identified" when `url` is null), resolving sources and material names from `context`. Clicking a
node selects it; clicking the canvas clears.

**Acceptance criteria:**
- [ ] Selecting `fac-eneabba` shows operating status, expected start, and the 16 000 tpa capacity, each with source "Iluka 2025 Annual Report", HIGH, 2026-08-30, and a working link
- [ ] Selecting `proj-fingerboards` shows a "document not yet identified" marker on fields citing `src-gcm-fingerboards-disclosures`
- [ ] `null` values render as "not attested"; nothing renders as `undefined`, `null`, or an empty string

**Verification:**
- [ ] `npm run lint && npm run typecheck && npm run build`
- [ ] Manual: click through all 36 nodes; no console errors
- [ ] `fields.ts` has no React imports

**Dependencies:** Task 6 (selection wiring), Task 3 (`context.sources`)
**Files:** `web/src/lib/provenance/fields.ts`, `web/src/components/entity/EntityPanel.tsx`, `ProvenanceRow.tsx`, `SourceLink.tsx`, `web/src/app/page.tsx`
**Scope:** M

### Task 8: Evidence panel for edges

**Description:** Extend selection to edges. For a relationship the panel shows type, status, its
provenance row, `note`, `annual_tonnes`/`total_tonnes`, `start_year`/`end_year`, and
`material_ids` resolved to material names; for a derived edge it shows the rule that produced it
and the carried provenance (if any).

**Acceptance criteria:**
- [ ] Selecting `rel-browns-range-supplies-eneabba` shows CONTRACTED, 30 500 t total, 2028, "Heavy rare earth concentrate", and the full note
- [ ] Selecting a derived `PRODUCES` edge shows "derived from facility output materials" and no provenance row
- [ ] Selecting the unresolved Fingerboards edge shows the counterparty as "unknown"

**Verification:**
- [ ] `npm run lint && npm run typecheck && npm run build`
- [ ] Manual: click all 49 edges (alternatives on), no console errors

**Dependencies:** Task 7
**Files:** `web/src/lib/provenance/fields.ts`, `web/src/components/entity/EntityPanel.tsx`, `web/src/components/entity/RelationshipDetails.tsx`, `web/src/components/graph/SupplyChainGraph.tsx`
**Scope:** S

### Task 9: `/map` — `AssetMap`, markers, `UnlocatedNotice`

**Description:** New route `app/map/page.tsx` (Client Component) using `useGraph()`. `AssetMap`
is loaded with `next/dynamic({ ssr: false })` from that Client Component; renders OSM tiles with
attribution and one marker per deposit/facility whose `coordinates` is non-null; marker click
sets the same selection and opens `EntityPanel`. `UnlocatedNotice` lists the deposits/facilities
with `coordinates: null`. Import `leaflet/dist/leaflet.css` in `globals.css`.

**Acceptance criteria:**
- [ ] `/map` shows one marker (Browns Range at −18.86, 128.94) and a notice reading "7 of 8 assets have no attested coordinates" listing them by name
- [ ] Clicking the marker opens the Evidence panel for `dep-browns-range` with the INFERRED/MEDIUM coordinates provenance visible
- [ ] `npm run build` succeeds (no `window is not defined`); marker icon renders (no broken image)

**Verification:**
- [ ] `npm run lint && npm run typecheck && npm run build`
- [ ] Manual: hard-reload `/map` (SSR path) and client-navigate to it from `/`
- [ ] Tile attribution visible in the map corner

**Dependencies:** Task 7 (panel), Task 4
**Files:** `web/src/app/map/page.tsx`, `web/src/components/map/AssetMap.tsx`, `UnlocatedNotice.tsx`, `web/src/lib/map/markers.ts`, `web/src/app/globals.css`
**Scope:** M

### Task 10: `CountryList` + navigation

**Description:** `CountryList` beside the map shows each `context.countries` entry with
`alignment` and `risk_score` (value + `ProvenanceRow`, or "not attested"). Add a top nav
(Flow | Map) to `layout.tsx` with active-link styling; finalise metadata title/description.

**Acceptance criteria:**
- [ ] Five countries listed; AU shows ALLY / JUDGMENT / HIGH and "risk score: not attested"
- [ ] Nav switches between `/` and `/map` without a full reload; active link highlighted
- [ ] Browser tab title is "Critical Minerals Alerting"

**Verification:**
- [ ] `npm run lint && npm run typecheck && npm run build`
- [ ] Manual: SPEC "Web — Geography view" checklist

**Dependencies:** Task 9
**Files:** `web/src/components/map/CountryList.tsx`, `web/src/components/ui/Nav.tsx`, `web/src/app/layout.tsx`, `web/src/app/map/page.tsx`
**Scope:** S

### Task 11: Integration, README, PR

**Description:** Run the full stack with `docker compose up --build`, verify the API-down retry
path and both views in the container build, update the root README with how to run and what
each view shows, run the code-review agent, open the PR referencing SPEC.md sections.

**Acceptance criteria:**
- [ ] `docker compose up --build` → both views work at `http://localhost:3000`
- [ ] README documents run commands and the three views
- [ ] All SPEC.md success criteria ticked; CRITICAL/HIGH review findings resolved

**Verification:**
- [ ] `docker compose up --build`; `curl localhost:8000/health`
- [ ] Full command set from SPEC "Commands" green
- [ ] PR body links SPEC.md and tasks/plan.md

**Dependencies:** Tasks 1–10
**Files:** `README.md`, possibly `web/Dockerfile` (ask first if it needs to change)
**Scope:** S

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Next 16 API drift from training data (`next/dynamic`, metadata, `LayoutProps`) | High — build failures late | Read `node_modules/next/dist/docs/` page before each web task (Boundaries: Always); Task 4 is deliberately small to surface problems early |
| `elkjs` worker/bundling under Turbopack | Med | Use `elkjs/lib/elk.bundled.js`; verify in Task 5 before any styling work |
| Leaflet SSR / default-icon breakage | Med | `ssr: false` only inside a Client Component; explicit `L.icon` with imported asset URLs; both covered by Task 9 acceptance criteria |
| `NEXT_PUBLIC_API_URL` browser-vs-container address | Med | Client-side fetch only (architecture decision); verified in Task 11 under docker compose |
| `react-leaflet@5` / `@xyflow/react@12` peer-dep or ESM issues with React 19.2 | Low | Pinned versions already checked for React 19 peer support; `npm install` failure would show in Task 4 |
| Graph clutter even at 36 nodes | Med — usability | ELK layered layout with partitions; alternatives toggle; Checkpoint B is a visual review before investing in the panel |
| Round-trip serialization misses a field | Low | Exhaustive `encode(parse(x)) == x` test over all 73 seed records in Task 2 |
| Scope creep into impact traversal | Low | Out of scope in SPEC; `/graph` stays minimal by decision 5 |

## Parallelization

After Task 4: {T5 → T6}, {T9 → T10} and the pure part of T7 (`fields.ts`) are independent. T7's
panel wiring needs T6's selection hook; T8 needs T7. Single-session order: 1 → 2 → 3 → 4 → 5 → 6
→ 7 → 8 → 9 → 10 → 11.

## Open Questions

- `/graph` `context` block (see Architecture Decisions) extends the approved contract. Confirm,
  or I fall back to `/countries` + `/sources` list endpoints (two new routes — "ask first").
