"""FastAPI route for per-node OSINT.

Mounted under ``/assets`` rather than at a ``/nodes`` prefix of its own: the
console's "node" is an asset, ``/assets/{id}`` is already the node-detail
resource, and a second name for the same thing would let the two drift. OSINT
is a sub-resource of the node, and reads like one.
"""

from fastapi import APIRouter, Depends, HTTPException, Path

from src.dependencies import get_graph, get_osint_corpus
from src.graph import SupplyGraph
from src.osint import Corpus
from src.schemas import osint as schemas
from src.service import osint as service

router = APIRouter(prefix="/assets", tags=["osint"])


@router.get("/{asset_id}/osint", response_model=schemas.NodeOSINT)
def get_asset_osint(
    asset_id: str = Path(description="Project or facility id, e.g. proj-browns-range"),
    graph: SupplyGraph = Depends(get_graph),
    corpus: Corpus = Depends(get_osint_corpus),
) -> schemas.NodeOSINT:
    """Prioritized developments affecting one mine or plant.

    404 only where the id names no asset, which is the same answer
    ``/assets/{id}`` gives. A node the corpus has nothing on returns an empty
    list: monitoring is a property of every node in the world model, and a 404
    would tell the console to hide the section - saying the node cannot be
    monitored rather than that nothing has been found for it.
    """
    if asset_id not in graph.projects and asset_id not in graph.facilities:
        raise HTTPException(
            status_code=404, detail=f"No project or facility {asset_id!r} in the graph"
        )
    return service.get_node_osint(corpus, asset_id)
