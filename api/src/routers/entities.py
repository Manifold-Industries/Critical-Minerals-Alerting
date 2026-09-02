"""GET /{kind}/{entity_id}: any seed record by kind and id.

``kind`` is a seed-file stem (``projects``, ``sources``, ...), so this one
route also serves ``GET /sources/{id}`` from the spec contract.
"""

from fastapi import APIRouter, HTTPException, Request

from src.routers.envelope import ok
from src.serialization import encode

router = APIRouter()


@router.get("/{kind}/{entity_id}")
def get_entity(kind: str, entity_id: str, request: Request) -> dict:
    repository = request.app.state.repository
    if repository.find_all(kind) is None:
        raise HTTPException(status_code=404, detail=f"unknown kind '{kind}'")
    record = repository.find_by_id(kind, entity_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"no {kind} record with id '{entity_id}'")
    return ok(encode(record))
