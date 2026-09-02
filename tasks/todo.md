# Todo — Supply-Chain Data Visualization

Detailed acceptance criteria and verification steps: [plan.md](plan.md). Spec: [SPEC.md](../SPEC.md).

## Phase 1: API

- [x] Task 1: `data_loader` package + `GraphRepository`; `validate_data.py` re-pointed
  - Acceptance: exact seed counts; `find_by_id` returns `None` for unknowns; `DataLoadError` names the file
  - Verify: `pytest tests/test_data_loader.py`; `scripts/validate_data.py` → `OK`
  - Files: `api/src/data_loader/{__init__,parse,repository}.py`, `api/scripts/validate_data.py`, `api/tests/test_data_loader.py`
- [x] Task 2: Serialization + envelope + lifespan + `GET /{kind}/{id}`, `GET /sources/{id}`; add ruff + pytest-cov
  - Acceptance: round-trip over all 73 records; 200/404 envelope shapes; startup fails loudly on bad data
  - Verify: `pytest tests/test_serialization.py tests/test_entity_endpoints.py`; `ruff check`
  - Files: `api/src/serialization/encode.py`, `api/src/routers/{entities,envelope}.py`, `api/src/{main,config}.py`, `api/pyproject.toml`, tests
- [ ] Task 3: Derived edges + `GET /graph` (+ `context`); update SPEC.md contract
  - Acceptance: 43 nodes / 49 edges (16 + 33 by rule); all ids resolve; per-rule unit tests
  - Verify: `pytest --cov=src` ≥ 80%
  - Files: `api/src/graph/{derive_edges,build,types}.py`, `api/src/routers/graph.py`, `api/src/main.py`, tests, `SPEC.md`

### Checkpoint A — API complete

- [ ] coverage ≥ 80%, ruff clean, validate_data OK, `curl /graph` counts correct
- [ ] Human review

## Phase 2: Flow view

- [ ] Task 4: Web deps + zod schemas + `client.ts` + `useGraph` + loading/error/retry shell
  - Acceptance: "43 nodes · 49 edges" with API up; Retry recovers; zod failure → error state
  - Verify: `npm run lint && npm run typecheck && npm run build`; manual stop/start API
  - Files: `web/package.json`, `web/src/lib/api/{schemas,types,client,useGraph}.ts`, `web/src/app/{page,layout}.tsx`, `web/src/components/ui/ErrorState.tsx`
- [ ] Task 5: `toFlow` + ELK layout + `SupplyChainGraph` with default nodes
  - Acceptance: 36 + 2 placeholder nodes, left-to-right stage order, no overlaps; pure lib modules
  - Verify: lint/typecheck/build; screenshot at 1280px
  - Files: `web/src/lib/graph/{toFlow,layout}.ts`, `web/src/components/graph/SupplyChainGraph.tsx`, `web/src/app/page.tsx`, `globals.css`
- [ ] Task 6: `styles.ts` tokens, custom nodes per kind, `UnresolvedNode`, `StatusEdge`, `Legend`, alternatives toggle
  - Acceptance: status/confidence distinguishable unaided; toggle removes/restores 3 edges; no style literals outside `styles.ts`
  - Verify: lint/typecheck/build; grep for hex/dasharray literals; SPEC Flow checklist
  - Files: `web/src/lib/graph/styles.ts`, `web/src/components/graph/{nodes/*,edges/StatusEdge,Legend,SupplyChainGraph}.tsx`

### Checkpoint B — Flow view

- [ ] SPEC "Web — Flow view" criteria ticked; lint/typecheck/build clean
- [ ] Human review of visual encoding

## Phase 3: Evidence panel

- [ ] Task 7: `provenance/fields.ts` + `EntityPanel` + `ProvenanceRow` + `SourceLink`; node selection
  - Acceptance: Eneabba fields with source/HIGH/date/link; Fingerboards shows "document not yet identified"; nulls → "not attested"
  - Verify: lint/typecheck/build; click all 36 nodes
  - Files: `web/src/lib/provenance/fields.ts`, `web/src/components/entity/{EntityPanel,ProvenanceRow,SourceLink}.tsx`, `web/src/app/page.tsx`
- [ ] Task 8: Edge selection → relationship details (note, tonnes, years, material names, derived-rule label)
  - Acceptance: Browns Range→Eneabba shows CONTRACTED / 30 500 t / 2028 / note; derived edge shows rule; unresolved shows "unknown"
  - Verify: lint/typecheck/build; click all 49 edges
  - Files: `fields.ts`, `EntityPanel.tsx`, `RelationshipDetails.tsx`, `SupplyChainGraph.tsx`

## Phase 4: Geography view

- [ ] Task 9: `/map` route, client-only `AssetMap`, markers, `UnlocatedNotice`, leaflet CSS
  - Acceptance: 1 marker (Browns Range), notice "7 of 8 assets…" with names; marker opens panel; build has no SSR errors; icon renders
  - Verify: lint/typecheck/build; hard-reload and client-navigate; attribution visible
  - Files: `web/src/app/map/page.tsx`, `web/src/components/map/{AssetMap,UnlocatedNotice}.tsx`, `web/src/lib/map/markers.ts`, `globals.css`
- [ ] Task 10: `CountryList` with provenance; nav (Flow | Map); metadata
  - Acceptance: 5 countries; AU = ALLY/JUDGMENT/HIGH, risk "not attested"; nav client-side with active state; tab title set
  - Verify: lint/typecheck/build; SPEC Geography checklist
  - Files: `web/src/components/map/CountryList.tsx`, `web/src/components/ui/Nav.tsx`, `web/src/app/layout.tsx`, `web/src/app/map/page.tsx`

### Checkpoint C — Feature complete

- [ ] Every SPEC success criterion ticked; `docker compose up --build` works; API-down retry works
- [ ] `code-reviewer` agent run; CRITICAL/HIGH resolved

## Phase 5: Ship

- [ ] Task 11: README run instructions + view descriptions; full command set green; PR linking SPEC.md and tasks/plan.md
  - Files: `README.md`

## Definition of Done (every task)

- [ ] Acceptance criteria met and verified at runtime, not just typechecked
- [ ] New API behaviour covered by tests that fail without the change; existing tests green
- [ ] `ruff` / `eslint` / `tsc` clean; no debug output, dead code, or unrelated refactors
- [ ] Conventional commit per task (`feat:`, `refactor:`, `test:`, `docs:`)
