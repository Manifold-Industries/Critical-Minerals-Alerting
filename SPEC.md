# Spec: Supply-Chain Data Visualization

Branch: `svenkatarao/data-visualization` · Status: **APPROVED** (2026-08-31) · Last updated: 2026-08-31

## Objective

Give an analyst watching for critical-minerals supply disruption a way to *see* the graph that
currently only exists as JSON under `api/src/data/`. Three views, sharing one detail panel:

| View | Question it answers | Route |
| --- | --- | --- |
| **Flow** | What feeds what? Deposit → project → facility → material → component → defence system, with financial and fallback edges. | `/` |
| **Geography** | Where are the assets, and in which jurisdictions? | `/map` |
| **Evidence** | Why do we believe this? Every attested field's source, confidence and verification date, one click away from any node or edge. | side panel on both views |

Success looks like: an analyst opens the app, immediately understands that Eneabba sits between
three feed sources and an unresolved downstream, can tell a contracted flow from a potential one
without reading a legend twice, and can click through to the ASX release that backs the claim.

**Explicitly out of scope for this branch** (each is a follow-up spec):

- Impact/traversal queries ("if Browns Range stops, what is hit") — the alerting payoff, deferred.
- Alerts, notifications, or any write path.
- New data ingestion; the seed JSON is the only data source.
- Authentication.

### User stories

1. As an analyst I see the full supply chain as a left-to-right graph, grouped by stage, so that
   I can trace a defence system back to the ground.
2. As an analyst I can distinguish edge status (`OBSERVED`/`CONTRACTED` vs `PLANNED`/`POTENTIAL`
   vs `UNRESOLVED` vs `HISTORICAL`) and assertion confidence (`HIGH`/`MEDIUM`/`LOW`) from the
   drawing alone.
3. As an analyst I can see an `UNRESOLVED` edge (e.g. Fingerboards → ?) as a visible dangling
   dependency, not as a missing edge.
4. As an analyst I click a node or edge and get every attested field with its provenance type,
   source name, confidence, `last_verified`, and a link to the source `url` when one exists.
5. As an analyst I open the map and see the assets that have attested coordinates, and a clear
   count of those that do not — the app never guesses a location.
6. As an analyst I can see each country's attested alignment (and risk score, when present) with
   its provenance.

### Assumptions

1. Read-only. Data is the seed JSON, loaded once at API startup.
2. The web app talks to the API over HTTP via `NEXT_PUBLIC_API_URL` (already wired in
   `docker-compose.yml`); nothing is bundled from `api/src/data/` into the web build.
3. The Python dataclasses stay the single source of truth for the schema; the TypeScript types
   mirror them and are validated at the boundary with zod.
4. The graph is small (43 nodes, 49 edges after derivation) — no pagination or virtualisation.
5. The map uses OpenStreetMap raster tiles, which is an outbound network dependency at runtime.
   Acceptable for a sample workflow; flagged under Open Questions.

## Tech Stack

| Layer | Choice | Version | Notes |
| --- | --- | --- | --- |
| API | Python / FastAPI | Python ≥3.12 (`api/.venv` is 3.14, Docker is 3.13) / fastapi ≥0.115 | existing |
| API settings | pydantic-settings | ≥2.7 | existing |
| API tests | pytest + httpx | ≥8.3 / ≥0.28 | existing |
| API tooling (**new dev deps**) | ruff, pytest-cov | latest | required by the coverage + lint commands below |
| Web | Next.js (App Router) / React / TypeScript | 16.3.3 / 19.2.8 / ^5 | existing — **read `web/node_modules/next/dist/docs/` before writing Next code; this version has breaking changes** |
| Styling | Tailwind CSS | ^4 | existing |
| Graph | `@xyflow/react` + `elkjs` | 12.11.5 / 0.12.0 | ELK `layered` layout, left-to-right |
| Map | `react-leaflet` + `leaflet` + `@types/leaflet` | 5.0.0 / 1.9.4 / 1.9.22 | react-leaflet 5 is the only option with a React 19 peer dep; client-only component |
| Validation | `zod` | 4.5.4 | API response schemas |

All web dependencies above are **new** and need approval (see Boundaries → Ask first). Nothing
else is added.

## Commands

Run API commands from `api/`, web commands from `web/`.

```bash
# API
.venv/bin/uvicorn src.main:app --reload --port 8000        # dev server
.venv/bin/python -m pytest                                  # tests
.venv/bin/python -m pytest --cov=src --cov-report=term-missing   # coverage (needs pytest-cov)
.venv/bin/ruff check src tests scripts && .venv/bin/ruff format --check src tests scripts   # lint
.venv/bin/python scripts/validate_data.py                   # seed-data integrity (must stay green)

# Web
npm run dev              # http://localhost:3000, expects API on http://localhost:8000
npm run build            # production build — must pass with zero warnings
npm run lint             # eslint (next core-web-vitals + typescript)
npm run typecheck        # tsc --noEmit  (script to be added to package.json)

# Full stack
docker compose up --build   # from repo root; web waits for api healthcheck
```

Environment: `API_CORS_ORIGINS` (API, JSON list), `NEXT_PUBLIC_API_URL` (web). No secrets.

## Project Structure

```text
api/
  src/
    main.py                 → app factory, CORS, router registration (exists)
    config.py               → Settings (exists)
    models/                 → frozen dataclasses (exists, unchanged)
    data/                   → seed JSON + README (exists, unchanged)
    data_loader/            → NEW: JSON → dataclass parsing, moved out of scripts/validate_data.py
      __init__.py
      parse.py              →   parse_prov / attested / per-type builders
      repository.py         →   GraphRepository: load once, find_all(kind), find_by_id(kind, id)
    serialization/          → NEW: dataclass → JSON-safe dict (enums→str, date→ISO, tuple→list)
      encode.py
    graph/                  → NEW: derived edges + graph assembly
      derive_edges.py       →   structural edges from entity fields (see API contract)
      build.py              →   nodes + edges → GraphResponse
    routers/                → NEW: FastAPI routers
      graph.py              →   GET /graph
      entities.py           →   GET /{kind}/{id}, GET /sources/{id}
  scripts/validate_data.py  → keeps its checks, imports parsing from src/data_loader
  tests/
    test_health.py          → exists
    test_data_loader.py     → NEW
    test_serialization.py   → NEW
    test_derive_edges.py    → NEW
    test_graph_endpoint.py  → NEW
    test_entity_endpoints.py→ NEW

web/
  src/
    app/
      layout.tsx            → title/description updated, nav (Flow | Map)
      page.tsx              → Flow view
      map/page.tsx          → Geography view
      globals.css           → + leaflet.css import
    lib/
      api/
        client.ts           → fetchGraph(), fetchEntity(kind, id) — zod-validated
        schemas.ts          → zod schemas mirroring api/src/models (one per dataclass)
        types.ts            → z.infer types
      graph/
        toFlow.ts           → GraphResponse → React Flow nodes/edges (pure)
        layout.ts           → ELK layered layout (async, pure in/out)
        styles.ts           → status → stroke, confidence → opacity, kind → colour tokens
      provenance/
        fields.ts           → entity → list of {label, value, provenance} rows (pure)
    components/
      graph/
        SupplyChainGraph.tsx→ ReactFlow wrapper, selection state
        nodes/*.tsx         → one custom node per kind (Deposit, Project, Facility, Material, Component, System, Organization, Unresolved)
        edges/StatusEdge.tsx→ styled edge with material label
        Legend.tsx
      map/
        AssetMap.tsx        → client-only (dynamic import, ssr: false)
        CountryList.tsx     → alignment / risk with provenance
        UnlocatedNotice.tsx → "N assets have no attested coordinates"
      entity/
        EntityPanel.tsx     → detail side panel (shared by both views)
        ProvenanceRow.tsx
        SourceLink.tsx
      ui/                   → small shared primitives (Badge, Panel)
```

Files stay under 300 lines; one component or one pure module per file.

## API Contract

All responses use the envelope `{ "success": bool, "data": T | null, "error": string | null }`.

### `GET /graph`

```jsonc
{
  "success": true,
  "data": {
    "nodes": [
      { "kind": "facility", "id": "fac-eneabba", "name": "Eneabba Rare Earths Refinery", "entity": { /* full serialized ProcessingFacility */ } }
    ],
    "edges": [
      // (a) every record from relationships.json, as-is:
      { "id": "rel-browns-range-supplies-eneabba", "type": "SUPPLIES", "from_id": "proj-browns-range", "to_id": "fac-eneabba",
        "status": "CONTRACTED", "provenance": {...}, "material_ids": ["mat-hre-concentrate"], "derived": false, ... },
      // (b) structural edges derived from entity fields:
      { "id": "drv-proj-browns-range-develops-dep-browns-range", "type": "DEVELOPS", "from_id": "proj-browns-range", "to_id": "dep-browns-range",
        "status": "OBSERVED", "provenance": null, "material_ids": [], "derived": true }
    ],
    // Non-node records the views need on every load (added at plan review, 2026-09-01):
    // full country records for the Geography view, full source records so the Evidence
    // panel can resolve names/urls without per-click round-trips.
    "context": {
      "countries": [ /* 5 serialized Country records */ ],
      "sources": [ /* 9 serialized Source records */ ]
    }
  },
  "error": null
}
```

Derived edge rules (`derived: true`, `status: OBSERVED`, `provenance: null` unless the source
field is `Attested`, in which case its provenance is carried across):

| Source field | Edge type | Direction |
| --- | --- | --- |
| `Project.deposit_id` | `DEVELOPS` | project → deposit |
| `Project.operator_id`, `ProcessingFacility.operator_id` | `OPERATES` | organization → asset |
| `Organization.parent_organization_id` | `SUBSIDIARY_OF` | child → parent |
| `ProcessingFacility.output_material_ids` | `PRODUCES` | facility → material |
| `Component.requires[i]` (Attested) | `REQUIRES` | component → material |
| `System.requires[i]` (Attested) | `REQUIRES` | system → component |

`ProcessingFacility.input_material_ids` and `Relationship.material_ids` are **not** nodes/edges;
they render as labels on the edge. Countries are not graph nodes; `country_id` is shown on the
node card and in the panel. An `UNRESOLVED` relationship (`to_id: null`) is returned unchanged;
the client renders a placeholder target.

### `GET /{kind}/{id}` and `GET /sources/{id}`

`kind ∈ {countries, deposits, organizations, projects, facilities, materials, components, systems, relationships}`.
Returns the serialized record; `404` with `success: false` for an unknown kind or id.

Serialization: `StrEnum` → string, `date` → `YYYY-MM-DD`, tuples → lists, `Attested`/`Provenance`
as nested objects — i.e. the wire format equals the seed JSON format, so the web zod schemas
also describe the seed files.

## Code Style

### Python — pure functions over immutable data, typed, small

```python
# api/src/graph/derive_edges.py
from collections.abc import Iterator

from src.models import Project
from src.graph.types import DerivedEdge


def derive_project_edges(project: Project) -> Iterator[DerivedEdge]:
    """Structural edges implied by a project's own fields (never mutates its input)."""
    if project.deposit_id:
        yield DerivedEdge(
            id=f"drv-{project.id}-develops-{project.deposit_id}",
            type="DEVELOPS",
            from_id=project.id,
            to_id=project.deposit_id,
        )
    if project.operator_id:
        yield DerivedEdge(
            id=f"drv-{project.operator_id}-operates-{project.id}",
            type="OPERATES",
            from_id=project.operator_id,
            to_id=project.id,
        )
```

- PEP 8, type hints on every signature, `ruff` clean, frozen dataclasses, no `print` (use `logging`).
- Errors: unknown ids → `HTTPException(404)` with a message that names the kind and id; loader
  failures at startup are fatal and logged with the offending file.

### TypeScript — validate at the boundary, transform purely, style via tokens

```ts
// web/src/lib/graph/toFlow.ts
import type { Edge, Node } from "@xyflow/react";
import type { GraphEdge, GraphNode } from "@/lib/api/types";
import { edgeStyleFor } from "@/lib/graph/styles";

export const UNRESOLVED_TARGET_PREFIX = "unresolved:";

export function toFlowEdges(edges: readonly GraphEdge[]): Edge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.from_id,
    target: edge.to_id ?? `${UNRESOLVED_TARGET_PREFIX}${edge.id}`,
    type: "status",
    data: { edge },
    style: edgeStyleFor(edge.status, edge.provenance?.assertion_confidence ?? null),
  }));
}
```

- `strict` TypeScript, no `any`, no `console.log` in committed code.
- Components: function components, props typed with `interface`, one export per file.
- Naming: `PascalCase` components, `camelCase` functions, `SCREAMING_SNAKE` constants; wire-format
  field names stay `snake_case` (they mirror the API), local view-model fields are `camelCase`.

- Colour/stroke/opacity live only in `lib/graph/styles.ts`; components never hard-code them.
- Leaflet must be loaded client-side only (`next/dynamic` with `ssr: false`).

## Testing Strategy

### API (pytest, target ≥80% of `api/src`)

- Unit: `data_loader` parses every seed file into the exact record counts in `validate_data.py`
  (9 sources, 5 countries, 4 deposits, 8 organizations, 6 projects, 4 facilities, 13 materials,
  1 component, 7 systems, 16 relationships); serialization round-trips (`encode(parse(x)) == x`
  for every seed record); `derive_edges` produces exactly the rule table above for a fixture.

- Integration (`TestClient`): `/graph` returns the envelope, node count == sum of entity counts,
  edge count == 16 + derived; every `from_id`/`to_id` in edges resolves to a node or is `null`
  only when `status == UNRESOLVED`; `/{kind}/{id}` 200 and 404 paths; unknown kind → 404.

- `scripts/validate_data.py` remains a required green check.

**Web — explicit exception to the 80% rule, agreed 2026-08-30:** no test framework this
iteration. Quality gates are `npm run lint`, `npm run typecheck`, and `npm run build` (zero
warnings), plus the manual checklist under Success Criteria. Pure modules (`toFlow`, `layout`,
`styles`, `fields`, `schemas`) are written so that Vitest can be added later without refactoring.

## Boundaries

### Always

- Read the relevant `web/node_modules/next/dist/docs/` page before writing Next.js code.
- Run `scripts/validate_data.py`, `pytest`, `ruff`, `npm run lint`, `npm run typecheck` before
  every commit; `npm run build` before opening the PR.

- Validate every API response in the web app with zod before use; fail with a visible error state.
- Render provenance wherever an `Attested` value is shown — never display a bare value.
- Show "unknown / not attested" for `null` — never a default, centroid, or placeholder value.
- Keep functions <50 lines, files <300 lines, no mutation of props/state/inputs.
- Conventional commit messages (`feat:`, `fix:`, …).

### Ask first

- Adding any dependency beyond the table in Tech Stack.
- Changing anything under `api/src/models/` or `api/src/data/` (schema or facts).
- Changing `docker-compose.yml`, Dockerfiles, or CI.
- Adding routes beyond `/`, `/map`, and the three API endpoints above.
- Any external network call from the browser other than the API and OSM tiles.

### Never

- Fabricate coordinates, tonnages, dates, or sources to make a view look fuller.
- Commit secrets or `.env` files.
- Bundle `api/src/data/*.json` into the web build.
- Delete or weaken a failing test or the validate-data check to get green.
- Remove the `AGENTS.md` block that `next dev` re-adds.

## Success Criteria

API

- [ ] `GET /graph` returns 200 with **43 nodes** (4 deposits + 8 organizations + 6 projects + 4 facilities + 13 materials + 1 component + 7 systems; countries excluded) and **49 edges** (16 from `relationships.json` + 33 derived: 4 `DEVELOPS`, 6+4 `OPERATES`, 1 `SUBSIDIARY_OF`, 8 `PRODUCES`, 3 component `REQUIRES`, 7 system `REQUIRES`). Counts are asserted in tests and must be updated with the seed data.
- [ ] Every derived-edge rule has a test; `pytest --cov=src` ≥ 80%.
- [ ] `ruff check` and `ruff format --check` pass; `validate_data.py` prints `OK`.
- [ ] Startup with a corrupted seed file fails loudly with the file name in the log.

Web — Flow view (`/`)

- [ ] Graph loads from the API and lays out left-to-right in stage order: deposit, project, facility, material, component, system; organizations in a separate rank above/below.
- [ ] Materials with no incident edge are hidden by the client (today: 36 of 43 nodes visible — the 6 materials shown are `mat-ndpr-oxide`, `mat-dy-oxide`, `mat-tb-oxide`, `mat-re-metals`, `mat-ndfeb-alloy`, `mat-sintered-ndfeb-magnet`); hiding is a pure function in `lib/graph/toFlow.ts`, not an API concern.
- [ ] Edge status is distinguishable without hover: `OBSERVED`/`CONTRACTED` solid, `PLANNED`/`POTENTIAL` dashed, `HISTORICAL` muted, `UNRESOLVED` dashed into a visibly hollow "?" node.
- [ ] Assertion confidence modulates edge weight/opacity; `LOW` is visibly weaker than `HIGH`.
- [ ] `ALTERNATIVE_TO` edges are styled distinctly from `SUPPLIES` and can be toggled off.
- [ ] Clicking any node or edge opens the entity panel; clicking empty canvas closes it.
- [ ] Legend explains every encoding used.

Web — Geography view (`/map`)

- [ ] Markers for every deposit/facility with a non-null `coordinates`; clicking a marker opens the same entity panel.
- [ ] A notice states exactly how many deposits/facilities lack coordinates and lists them.
- [ ] Country list shows `alignment` and `risk_score` with provenance, or "not attested".
- [ ] Map renders only on the client; `npm run build` succeeds with no SSR/window errors.

Web — Evidence panel

- [ ] For a selected entity, every `Attested` field shows value, provenance type, confidence, `last_verified`, and source name; source `url` is a link when present, and "document not yet identified" when the source has `url: null`.
- [ ] For a selected relationship, `note`, tonnages, years, and `material_ids` (resolved to names) are shown.

Cross-cutting

- [ ] API unreachable → visible error state with retry, not a blank page.
- [ ] `npm run lint`, `npm run typecheck`, `npm run build` all pass with zero warnings.
- [ ] `docker compose up --build` serves the working app at `http://localhost:3000`.
- [ ] No horizontal page scroll at 1280px; usable at 1024px.

## Decisions (resolved 2026-08-31, spec approved as-is)

1. **Unlocated assets on the map.** Markers only for attested coordinates, plus a notice listing
   the rest. No centroid pins — the data README's no-fabrication rule applies to display too.
2. **OSM tiles.** Accepted as a runtime network dependency for this sample workflow. If an
   air-gapped deployment is ever required, the map view shrinks to the country list.
3. **Material nodes.** The API returns all 13 materials; the Flow view hides the 7 with no
   `PRODUCES`/`REQUIRES` edge (concentrates, MREC, HREO/LREO, separated REO) and shows them only
   as labels on `SUPPLIES` edges and facility inputs.
4. **Python version.** Leave `requires-python = ">=3.12"` unchanged; the 3.13 image / 3.14 venv
   split is harmless and not this branch's concern.
5. **Impact traversal.** `/graph` stays minimal — no precomputed `downstream_ids`. The follow-up
   impact spec owns that.

## Open Questions

None.
