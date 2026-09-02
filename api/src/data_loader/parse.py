"""Parse seed-data JSON into the dataclass model.

The seed format mirrors the dataclasses one-to-one: enums as their string
values, dates as ``YYYY-MM-DD``, ``Attested``/``Provenance`` as nested
objects. Any record that fails to construct raises :class:`DataLoadError`
naming the offending file and record index.
"""

import json
from collections.abc import Callable
from datetime import date
from pathlib import Path

from src.models import (
    Attested,
    Capacity,
    Component,
    Confidence,
    Coordinates,
    Country,
    Deposit,
    DevelopmentStage,
    FacilityType,
    Material,
    MaterialCategory,
    OperatingStatus,
    Organization,
    OrganizationType,
    ProcessingFacility,
    ProductionFigure,
    ProductionPeriod,
    Project,
    Provenance,
    ProvenanceType,
    Relationship,
    RelationshipStatus,
    RelationshipType,
    ResourceClassification,
    ResourceEstimate,
    Source,
    SourceType,
    System,
)


class DataLoadError(Exception):
    """A seed-data file failed to load or parse into the dataclass model."""


def _parse_date(value: str | None) -> date | None:
    return date.fromisoformat(value) if value else None


def _prov(raw: dict) -> Provenance:
    confidence = Confidence(raw["assertion_confidence"]) if raw["assertion_confidence"] else None
    return Provenance(
        type=ProvenanceType(raw["type"]),
        source_id=raw["source_id"],
        assertion_confidence=confidence,
        last_verified=_parse_date(raw["last_verified"]),
    )


def _attested(raw: dict | None, cast: Callable = lambda value: value) -> Attested | None:
    return None if raw is None else Attested(cast(raw["value"]), _prov(raw["provenance"]))


def _estimate(raw: dict) -> ResourceEstimate:
    return ResourceEstimate(
        **{
            **raw,
            "classification": ResourceClassification(raw["classification"]),
            "provenance": _prov(raw["provenance"]),
        }
    )


def _figure(raw: dict) -> ProductionFigure:
    return ProductionFigure(**{**raw, "period": ProductionPeriod(raw["period"])})


def _source(r: dict) -> Source:
    return Source(
        **{
            **r,
            "source_type": SourceType(r["source_type"]),
            "published_on": _parse_date(r["published_on"]),
            "source_confidence": Confidence(r["source_confidence"]) if r["source_confidence"] else None,
        }
    )


def _country(r: dict) -> Country:
    return Country(**{**r, "alignment": _attested(r["alignment"]), "risk_score": _attested(r["risk_score"])})


def _deposit(r: dict) -> Deposit:
    return Deposit(
        **{
            **r,
            "commodities": tuple(r["commodities"]),
            "aliases": tuple(r["aliases"]),
            "coordinates": _attested(r["coordinates"], lambda v: Coordinates(**v)),
            "resource_estimates": tuple(_estimate(e) for e in r["resource_estimates"]),
        }
    )


def _organization(r: dict) -> Organization:
    return Organization(
        **{
            **r,
            "organization_type": OrganizationType(r["organization_type"]),
            "government_affiliation": _attested(r["government_affiliation"]),
            "aliases": tuple(r["aliases"]),
        }
    )


def _project(r: dict) -> Project:
    return Project(
        **{
            **r,
            "development_stage": _attested(r["development_stage"], DevelopmentStage),
            "operating_status": _attested(r["operating_status"], OperatingStatus),
            "expected_production_start": _attested(r["expected_production_start"]),
            "planned_production": tuple(_attested(f, _figure) for f in r["planned_production"]),
            "resource_estimates": tuple(_estimate(e) for e in r["resource_estimates"]),
            "aliases": tuple(r["aliases"]),
        }
    )


def _facility(r: dict) -> ProcessingFacility:
    return ProcessingFacility(
        **{
            **r,
            "facility_type": FacilityType(r["facility_type"]),
            "operating_status": _attested(r["operating_status"], OperatingStatus),
            "coordinates": _attested(r["coordinates"], lambda v: Coordinates(**v)),
            "expected_start": _attested(r["expected_start"]),
            "input_material_ids": tuple(r["input_material_ids"]),
            "output_material_ids": tuple(r["output_material_ids"]),
            "capacities": tuple(_attested(c, lambda v: Capacity(**v)) for c in r["capacities"]),
            "aliases": tuple(r["aliases"]),
        }
    )


def _material(r: dict) -> Material:
    return Material(**{**r, "category": MaterialCategory(r["category"]), "elements": tuple(r["elements"])})


def _component(r: dict) -> Component:
    return Component(**{**r, "requires": tuple(_attested(a) for a in r["requires"])})


def _system(r: dict) -> System:
    return System(**{**r, "requires": tuple(_attested(a) for a in r["requires"])})


def _relationship(r: dict) -> Relationship:
    return Relationship(
        **{
            **r,
            "type": RelationshipType(r["type"]),
            "status": RelationshipStatus(r["status"]),
            "provenance": _prov(r["provenance"]),
            "material_ids": tuple(r["material_ids"]),
        }
    )


#: One builder per seed file; the key is both the file stem and the record kind.
BUILDERS: dict[str, Callable[[dict], object]] = {
    "sources": _source,
    "countries": _country,
    "deposits": _deposit,
    "organizations": _organization,
    "projects": _project,
    "facilities": _facility,
    "materials": _material,
    "components": _component,
    "systems": _system,
    "relationships": _relationship,
}


def load_all(data_dir: Path) -> dict[str, tuple[object, ...]]:
    """Load every seed file in ``data_dir`` into typed, immutable records."""
    return {kind: _load_file(data_dir / f"{kind}.json", builder) for kind, builder in BUILDERS.items()}


def _load_file(path: Path, builder: Callable[[dict], object]) -> tuple[object, ...]:
    try:
        raw = json.loads(path.read_text())
    except FileNotFoundError as exc:
        raise DataLoadError(f"{path.name}: file not found") from exc
    except json.JSONDecodeError as exc:
        raise DataLoadError(f"{path.name}: invalid JSON: {exc}") from exc
    if not isinstance(raw, list):
        raise DataLoadError(f"{path.name}: expected a top-level list, got {type(raw).__name__}")

    records: list[object] = []
    for index, record in enumerate(raw):
        try:
            records.append(builder(record))
        except (ValueError, TypeError, KeyError) as exc:
            raise DataLoadError(f"{path.name}[{index}]: {exc}") from exc
    return tuple(records)
