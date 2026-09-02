"""Provenance layer: where a fact came from and how much we trust it.

Two distinct notions are modelled, per the v0 data model:

* ``Source`` — the underlying evidence (a document, database row, cable, ...)
  and our confidence in *the source itself*.
* ``Provenance`` — attached to a specific *assertion* (a property value or a
  relationship) and carrying our confidence in *that conclusion*.

``Attested[T]`` pairs a value with its provenance so that different properties
on the same entity can cite different sources (e.g. a deposit's location from
USGS but its planned production from a company feasibility study).
"""

from dataclasses import dataclass
from datetime import date
from enum import StrEnum

from src.models._validation import require_non_blank


class Confidence(StrEnum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class SourceType(StrEnum):
    DOCUMENT = "DOCUMENT"
    DATABASE = "DATABASE"
    TABLE = "TABLE"
    CABLE = "CABLE"
    NEWS = "NEWS"
    API = "API"
    OTHER = "OTHER"


class ProvenanceType(StrEnum):
    MEASURED = "MEASURED"
    REPORTED = "REPORTED"
    INFERRED = "INFERRED"
    JUDGMENT = "JUDGMENT"
    MODEL_ESTIMATE = "MODEL_ESTIMATE"
    UNKNOWN = "UNKNOWN"


# Provenance types that must cite a Source: they are direct readings of evidence.
EVIDENCE_BACKED_TYPES: frozenset[ProvenanceType] = frozenset({ProvenanceType.MEASURED, ProvenanceType.REPORTED})


@dataclass(frozen=True)
class Source:
    """A piece of evidence that data in the graph can cite."""

    id: str
    name: str
    source_type: SourceType
    publisher: str | None = None
    published_on: date | None = None
    url: str | None = None
    #: Page / row / section locator within the source, where relevant.
    locator: str | None = None
    #: Confidence in the source itself.
    source_confidence: Confidence | None = None

    def __post_init__(self) -> None:
        require_non_blank("id", self.id)
        require_non_blank("name", self.name)


@dataclass(frozen=True)
class Provenance:
    """How a specific assertion is supported.

    ``source_id`` is required for evidence-backed types (MEASURED, REPORTED)
    and optional for judgments, inferences and model estimates.
    """

    type: ProvenanceType
    source_id: str | None = None
    #: Confidence in this specific conclusion, independent of the source's own confidence.
    assertion_confidence: Confidence | None = None
    last_verified: date | None = None

    def __post_init__(self) -> None:
        if self.type in EVIDENCE_BACKED_TYPES and not self.source_id:
            raise ValueError(f"source_id is required for {self.type.value} provenance")


@dataclass(frozen=True)
class Attested[T]:
    """A value together with the provenance of the assertion that it holds."""

    value: T
    provenance: Provenance
