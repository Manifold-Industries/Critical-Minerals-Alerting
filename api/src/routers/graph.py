"""GET /graph: the full supply-chain graph with context."""

from fastapi import APIRouter, Request

from src.graph import build_graph
from src.routers.envelope import ok

router = APIRouter()


@router.get("/graph")
def get_graph(request: Request) -> dict:
    return ok(build_graph(request.app.state.repository.records))
