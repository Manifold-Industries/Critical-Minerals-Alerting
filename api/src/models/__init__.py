"""Critical-minerals v0 data model.

Frozen dataclasses describing supply-chain entities, the relationships between
them, and the provenance of the assertions made about them.
"""

from src.models.deposit import Deposit, ResourceClassification, ResourceEstimate
from src.models.geography import Coordinates, Country
from src.models.provenance import (
    Attested,
    Provenance,
    ProvenanceType,
    Source,
    SourceType,
)

__all__ = [
    "Attested",
    "Coordinates",
    "Country",
    "Deposit",
    "Provenance",
    "ProvenanceType",
    "ResourceClassification",
    "ResourceEstimate",
    "Source",
    "SourceType",
]
