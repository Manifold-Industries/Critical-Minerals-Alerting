"""Minimal validation helpers for the data-model dataclasses."""


def require_non_blank(field: str, value: str) -> None:
    if not value.strip():
        raise ValueError(f"{field} must be a non-empty string")


def require_in_range(field: str, value: float | None, low: float, high: float) -> None:
    """Accept ``None`` or a value within the closed interval [low, high]."""
    if value is not None and not low <= value <= high:
        raise ValueError(f"{field} must be between {low} and {high}, got {value}")
