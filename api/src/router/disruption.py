"""FastAPI routes for mine-disruption simulation."""

from fastapi import APIRouter, Depends, HTTPException, Path, Query

from src.dependencies import get_graph
from src.disruption import ScoreFactor
from src.graph import SupplyGraph
from src.models import QualificationTier
from src.schemas import disruption as schemas
from src.service import disruption as service

router = APIRouter(prefix="/disruption", tags=["disruption"])


# Declared before "/{mine_id}", which would otherwise match "years" as an id.
@router.get("/years", response_model=schemas.YearRange)
def get_year_range(graph: SupplyGraph = Depends(get_graph)) -> schemas.YearRange:
    """The band of years over which the graph returns different answers."""
    return service.year_range(graph)


@router.get("/mines", response_model=list[schemas.MineSummary])
def list_mines(
    as_of_year: int = Query(default=2027, ge=2000, le=2100),
    reaches_refiner: bool | None = Query(
        default=None, description="Filter to mines whose disruption reaches a Dy/Tb refiner"
    ),
    graph: SupplyGraph = Depends(get_graph),
) -> list[schemas.MineSummary]:
    """Mines that can be simulated, those with downstream effect first."""
    mines = service.list_mines(graph, as_of_year=as_of_year)
    if reaches_refiner is not None:
        mines = [m for m in mines if m.reaches_refiner is reaches_refiner]
    return mines


@router.get("/{mine_id}", response_model=schemas.DisruptionResponse)
def get_disruption(
    mine_id: str = Path(description="Project id, e.g. proj-mount-weld"),
    as_of_year: int = Query(
        default=2027,
        ge=2000,
        le=2100,
        description="Required by the engine: capacities are staged and supersede one another, "
        "so any share-of-nameplate figure is undefined without a year",
    ),
    severity: float = Query(default=1.0, ge=0.0, le=1.0, description="Fraction of output lost"),
    max_hops: int = Query(default=3, ge=1, le=6),
    min_qualification: QualificationTier = Query(
        default=QualificationTier.PLAUSIBLE,
        description="Prunes the reroute space. INFEASIBLE edges are always dropped.",
    ),
    limit: int | None = Query(
        default=None, ge=1, description="Cap alternatives per facility, best first"
    ),
    exclude_factor: list[ScoreFactor] = Query(
        default=[],
        description="Drop a factor from the score. Repeatable. Remaining weights are "
        "renormalised, so scores stay on 0-100, but a run that excludes anything is "
        "not the same measurement as a default one. Excluding every factor is a 422.",
    ),
    graph: SupplyGraph = Depends(get_graph),
) -> schemas.DisruptionResponse:
    """Simulate a mine losing output and rank what could take its place."""
    try:
        return service.get_disruption(
            graph,
            mine_id,
            as_of_year=as_of_year,
            severity=severity,
            max_hops=max_hops,
            min_qualification=min_qualification,
            limit=limit,
            exclude_factors=exclude_factor,
        )
    except KeyError:
        raise HTTPException(status_code=404, detail=f"No project {mine_id!r} in the graph")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
