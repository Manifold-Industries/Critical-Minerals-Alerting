"""Encode dataclass records to the JSON wire format.

The wire format equals the seed-file format, so this module is the exact
inverse of ``src.data_loader.parse`` (verified by a round-trip test over
every seed record).
"""

from dataclasses import fields, is_dataclass
from datetime import date
from enum import Enum


def encode(value: object) -> object:
    """Recursively convert a record to JSON-safe primitives.

    Enums become their string values, dates ISO strings, tuples lists, and
    nested dataclasses (``Attested``, ``Provenance``, ...) plain dicts.
    """
    if is_dataclass(value) and not isinstance(value, type):
        return {f.name: encode(getattr(value, f.name)) for f in fields(value)}
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, tuple | list):
        return [encode(item) for item in value]
    return value
