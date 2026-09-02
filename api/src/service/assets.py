"""Assembles the reference view of one asset.

Everything here is a read of the graph as recorded. Nothing is combined,
superseded away or converted: the disruption service already does that for
ranking, and doing it again here would hide the staging this view exists to show.
"""

from src.graph import SupplyGraph
from src.models import Attested, Provenance
from src.schemas import assets as schemas
from src.schemas.disruption import Coordinates


def _provenance(prov: Provenance) -> schemas.Provenance | None:
    return schemas.Provenance(
        type=prov.type.value,
        source_id=prov.source_id,
        assertion_confidence=(
            prov.assertion_confidence.value if prov.assertion_confidence else None
        ),
    )


def _material(graph: SupplyGraph, material_id: str) -> tuple[str | None, list[str]]:
    material = graph.materials.get(material_id)
    return (material.name, list(material.elements)) if material else (None, [])


def _supersession(entries: list[tuple[str, int | None]]) -> list[int | None]:
    """For each entry, the target year of the entry that replaces it.

    Same rule the engine sorts on: within one material, a later target year
    supersedes an earlier one. Entries with no target year are always in force
    and are never superseded, so they return None.
    """
    latest: dict[str, int] = {}
    for material_id, year in entries:
        if year is not None:
            latest[material_id] = max(latest.get(material_id, year), year)
    out: list[int | None] = []
    for material_id, year in entries:
        top = latest.get(material_id)
        out.append(top if top is not None and year is not None and year < top else None)
    return out


def _figures(
    graph: SupplyGraph,
    entries: list[tuple[Attested, str, float, str | None, int | None, str | None]],
) -> list[schemas.MaterialFigure]:
    superseded = _supersession([(e[1], e[4]) for e in entries])
    out = []
    for (attested, material_id, tonnes, period, year, note), replaced_by in zip(
        entries, superseded
    ):
        name, elements = _material(graph, material_id)
        out.append(
            schemas.MaterialFigure(
                material_id=material_id,
                material_name=name,
                elements=elements,
                tonnes=tonnes,
                period=period,
                target_year=year,
                superseded_by=replaced_by,
                note=note,
                provenance=_provenance(attested.provenance),
            )
        )
    return out


def _linked(graph: SupplyGraph, edges, *, outbound: bool) -> list[schemas.LinkedAsset]:
    out = []
    for edge in edges:
        other = edge.to_id if outbound else edge.from_id
        out.append(
            schemas.LinkedAsset(
                id=other,
                name=graph.name_of(other) if other else None,
                relationship_id=edge.id,
                type=edge.type.value,
                status=edge.status.value,
                inferred=edge.provenance.type.value == "AUTOMATED",
                qualification=edge.qualification.value if edge.qualification else None,
                note=edge.note,
            )
        )
    return out


def _edges_for(graph: SupplyGraph, asset_id: str) -> tuple[list, list]:
    """Curated edges only. The generated layer is 218 rows of "not evidence" and
    would bury the hand-read ones it is not a substitute for."""
    inbound = [e for e in graph.curated if e.to_id == asset_id]
    outbound = [e for e in graph.curated if e.from_id == asset_id]
    return inbound, outbound


def get_asset(graph: SupplyGraph, asset_id: str) -> schemas.AssetDetail:
    """Full reference detail for one mine or plant.

    Raises ``KeyError`` where the id names neither.
    """
    country_id = graph.country_of(asset_id)
    country = graph.countries.get(country_id) if country_id else None
    coords = graph.coordinates_of(asset_id)
    inbound, outbound = _edges_for(graph, asset_id)
    common = dict(
        id=asset_id,
        country_id=country_id,
        country_name=country.name if country else None,
        coordinates=(
            Coordinates(lat=coords.latitude, lon=coords.longitude) if coords else None
        ),
        supplied_by=_linked(graph, inbound, outbound=False),
        supplies_to=_linked(graph, outbound, outbound=True),
    )

    project = graph.projects.get(asset_id)
    if project is not None:
        deposit = graph.deposits.get(project.deposit_id) if project.deposit_id else None
        operator = graph.organizations.get(project.operator_id) if project.operator_id else None
        return schemas.AssetDetail(
            **common,
            kind="MINE",
            name=project.name,
            operating_status=project.operating_status.value.value,
            development_stage=project.development_stage.value.value,
            expected_start=(
                project.expected_production_start.value
                if project.expected_production_start
                else None
            ),
            operator_id=project.operator_id,
            operator_name=operator.name if operator else None,
            deposit=(
                schemas.DepositSummary(
                    id=deposit.id,
                    name=deposit.name,
                    deposit_type=deposit.deposit_type,
                    commodities=list(deposit.commodities),
                    location_description=deposit.location_description,
                )
                if deposit
                else None
            ),
            figures=_figures(
                graph,
                [
                    (a, a.value.material_id, a.value.tonnes, a.value.period.value,
                     a.value.target_year, a.value.note)
                    for a in project.planned_production
                ],
            ),
            products=[
                schemas.ProductForm(
                    material_id=a.value.material_id,
                    material_name=_material(graph, a.value.material_id)[0],
                    host_mineral=a.value.host_mineral.value,
                    grade_pct_treo=a.value.grade_pct_treo,
                    note=a.value.note,
                )
                for a in project.products
            ],
            description=project.description,
            aliases=list(project.aliases),
        )

    facility = graph.facilities.get(asset_id)
    if facility is None:
        raise KeyError(asset_id)
    operator = graph.organizations.get(facility.operator_id) if facility.operator_id else None
    return schemas.AssetDetail(
        **common,
        kind="FACILITY",
        name=facility.name,
        operating_status=facility.operating_status.value.value,
        facility_type=facility.facility_type.value,
        expected_start=facility.expected_start.value if facility.expected_start else None,
        operator_id=facility.operator_id,
        operator_name=operator.name if operator else None,
        figures=_figures(
            graph,
            [
                (a, a.value.material_id, a.value.tonnes_per_year, None,
                 a.value.target_year, a.value.note)
                for a in facility.capacities
            ],
        ),
        accepted_feeds=[
            schemas.FeedSpec(
                material_id=a.value.material_id,
                material_name=_material(graph, a.value.material_id)[0],
                accepted_hosts=[h.value for h in a.value.accepted_hosts],
                note=a.value.note,
            )
            for a in facility.accepted_feeds
        ],
        products=[
            schemas.ProductForm(
                material_id=a.value.material_id,
                material_name=_material(graph, a.value.material_id)[0],
                host_mineral=a.value.host_mineral.value,
                grade_pct_treo=a.value.grade_pct_treo,
                note=a.value.note,
            )
            for a in facility.products
        ],
        is_dytb_refiner=graph.is_dytb_refiner(asset_id),
        location_description=facility.location_description,
        description=facility.description,
        aliases=list(facility.aliases),
    )
