"""Assemble the /graph payload: nodes, edges (explicit + derived), context.

Derived edges use the same wire shape as relationship edges so the client
handles one edge type; fields a derived edge cannot have are null/empty.
"""

from collections.abc import Mapping

from src.graph.derive_edges import derive_edges
from src.graph.types import NODE_KINDS, DerivedEdge
from src.models import Relationship
from src.serialization import encode

_EMPTY_EDGE_FIELDS: dict = {
    "material_ids": [],
    "annual_tonnes": None,
    "total_tonnes": None,
    "start_year": None,
    "end_year": None,
    "note": None,
}


def build_graph(records: Mapping[str, tuple]) -> dict:
    nodes = [
        {"kind": label, "id": entity.id, "name": entity.name, "entity": encode(entity)}
        for kind, label in NODE_KINDS.items()
        for entity in records.get(kind, ())
    ]
    edges = [_relationship_edge(r) for r in records.get("relationships", ())]
    edges += [_derived_edge(e) for e in derive_edges(records)]
    context = {
        "countries": [encode(c) for c in records.get("countries", ())],
        "sources": [encode(s) for s in records.get("sources", ())],
    }
    return {"nodes": nodes, "edges": edges, "context": context}


def _relationship_edge(relationship: Relationship) -> dict:
    return {**encode(relationship), "derived": False}


def _derived_edge(edge: DerivedEdge) -> dict:
    return {
        "id": edge.id,
        "type": edge.type,
        "from_id": edge.from_id,
        "to_id": edge.to_id,
        "status": "OBSERVED",
        "provenance": encode(edge.provenance) if edge.provenance else None,
        **_EMPTY_EDGE_FIELDS,
        "derived": True,
    }
