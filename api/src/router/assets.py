"""FastAPI routes for per-asset reference detail."""

from fastapi import APIRouter, Depends, HTTPException, Path

from src.dependencies import get_graph
from src.graph import SupplyGraph
from src.schemas import assets as schemas
from src.service import assets as service

router = APIRouter(prefix="/assets", tags=["assets"])


@router.get("/{asset_id}", response_model=schemas.AssetDetail)
def get_asset(
    asset_id: str = Path(description="Project or facility id, e.g. fac-white-mesa"),
    graph: SupplyGraph = Depends(get_graph),
) -> schemas.AssetDetail:
    """Everything the graph records about one mine or plant."""
    try:
        return service.get_asset(graph, asset_id)
    except KeyError:
        raise HTTPException(
            status_code=404, detail=f"No project or facility {asset_id!r} in the graph"
        )
