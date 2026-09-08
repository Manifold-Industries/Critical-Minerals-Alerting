"""Reading a ranking back: what separated two rows, and what nothing did."""

from dataclasses import dataclass

from src.models.rank import LinearSum, LinearSumTerm, Ordinal, rank
from src.models.rank_explain import decided_by, tied


@dataclass(frozen=True)
class Row:
    id: str
    weight: int
    tier: int


def rows(*specs: tuple[str, int, int]) -> list[Row]:
    return [Row(*spec) for spec in specs]


BY_WEIGHT = [(LinearSumTerm("weight", float), 1.0)]


def test_the_criterion_that_separated_two_rows_is_named() -> None:
    scorer, by_tier, by_id = LinearSum(BY_WEIGHT), Ordinal("tier"), Ordinal("id")
    ranked = rank(rows(("b", 2, 0), ("a", 1, 5), ("c", 1, 2)), [], [scorer, by_tier, by_id])

    assert [placed.entity.id for placed in ranked] == ["b", "c", "a"]
    assert decided_by(ranked[0], ranked[1]) is scorer
    assert decided_by(ranked[1], ranked[2]) is by_tier


def test_two_rows_that_are_not_neighbours_can_still_be_compared() -> None:
    """Deciding is a fact about a pair, so it is not restricted to adjacent pairs."""
    scorer, by_tier = LinearSum(BY_WEIGHT), Ordinal("tier")
    ranked = rank(rows(("b", 2, 0), ("a", 1, 5), ("c", 1, 2)), [], [scorer, by_tier])

    assert decided_by(ranked[0], ranked[2]) is scorer


def test_nothing_separating_two_rows_is_a_tie() -> None:
    ranked = rank(rows(("a", 1, 0), ("b", 1, 0)), [], [LinearSum(BY_WEIGHT)])

    assert decided_by(ranked[0], ranked[1]) is None
    assert tied(ranked[0], ranked[1])


def test_a_tie_stops_being_one_once_a_criterion_breaks_it() -> None:
    by_id = Ordinal("id")
    ranked = rank(rows(("a", 1, 0), ("b", 1, 0)), [], [LinearSum(BY_WEIGHT), by_id])

    assert decided_by(ranked[0], ranked[1]) is by_id
    assert not tied(ranked[0], ranked[1])


def test_with_no_criteria_every_row_is_tied() -> None:
    ranked = rank(rows(("a", 1, 0), ("b", 2, 0)), [], [])

    assert tied(ranked[0], ranked[1])
