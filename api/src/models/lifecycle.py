"""Lifecycle enums shared by projects and processing facilities."""

from enum import StrEnum


class DevelopmentStage(StrEnum):
    """Where a project sits in the mine-development lifecycle.

    ``DEVELOPMENT`` is a catch-all for pre-construction projects whose exact
    sub-stage (feasibility, permitting, ...) has not been sourced.
    """

    EXPLORATION = "EXPLORATION"
    DEVELOPMENT = "DEVELOPMENT"
    FEASIBILITY = "FEASIBILITY"
    PERMITTING = "PERMITTING"
    CONSTRUCTION = "CONSTRUCTION"
    PRODUCTION = "PRODUCTION"
    CARE_AND_MAINTENANCE = "CARE_AND_MAINTENANCE"
    CLOSED = "CLOSED"


class OperatingStatus(StrEnum):
    """Whether an asset is currently producing."""

    PLANNED = "PLANNED"
    UNDER_CONSTRUCTION = "UNDER_CONSTRUCTION"
    COMMISSIONING = "COMMISSIONING"
    OPERATING = "OPERATING"
    SUSPENDED = "SUSPENDED"
    CLOSED = "CLOSED"
