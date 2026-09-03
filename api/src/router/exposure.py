"""FastAPI routes for the end uses a mine's elements reach."""

from fastapi import APIRouter, Depends, HTTPException, Path

from src.dependencies import get_graph
from src.graph import SupplyGraph
from src.schemas import exposure as schemas
from src.service import exposure as service

router = APIRouter(prefix="/exposure", tags=["exposure"])


@router.get("/{mine_id}", response_model=schemas.MineExposure)
def get_exposure(
    mine_id: str = Path(description="Project id, e.g. proj-mount-weld"),
    graph: SupplyGraph = Depends(get_graph),
) -> schemas.MineExposure:
    """Components and platforms reachable from one mine's Dy/Tb elements.

    Scoped to Dy and Tb, like the rest of the graph. No year parameter: nothing
    in the end-use layer is staged, so the answer does not move with one.
    """
    try:
        return service.get_exposure(graph, mine_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"No project {mine_id!r} in the graph")
