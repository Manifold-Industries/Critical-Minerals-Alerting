"""Critical-minerals v0 data model.

Frozen dataclasses describing supply-chain entities, the relationships between
them, and the provenance of the assertions made about them.
"""

from src.models.component import Component
from src.models.deposit import Deposit, ResourceClassification, ResourceEstimate
from src.models.facility import Capacity, FacilityType, ProcessingFacility
from src.models.geography import Coordinates, Country
from src.models.lifecycle import DevelopmentStage, OperatingStatus
from src.models.material import Material, MaterialCategory
from src.models.organization import Organization, OrganizationType
from src.models.project import ProductionFigure, ProductionPeriod, Project
from src.models.provenance import (
    Attested,
    Confidence,
    Provenance,
    ProvenanceType,
    Source,
    SourceType,
)
from src.models.system import System

__all__ = [
    "Attested",
    "Capacity",
    "Component",
    "Confidence",
    "Coordinates",
    "Country",
    "Deposit",
    "DevelopmentStage",
    "FacilityType",
    "Material",
    "MaterialCategory",
    "OperatingStatus",
    "Organization",
    "OrganizationType",
    "ProcessingFacility",
    "ProductionFigure",
    "ProductionPeriod",
    "Project",
    "Provenance",
    "ProvenanceType",
    "ResourceClassification",
    "ResourceEstimate",
    "Source",
    "SourceType",
    "System",
]
