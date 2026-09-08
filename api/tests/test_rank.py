"""What the ranker promises: ties fall through, and nothing is ordered by accident."""

from dataclasses import dataclass
from math import fsum

from src.models.rank import (
    Filter,
    LinearSum,
    LinearSumTerm,
    Ordinal,
    Ranked,
    Score,
    rank,
)


@dataclass(frozen=True)
class Row:
    id: str
    weight: int
    tier: int
    size: float | None = None


def rows(*specs: tuple[str, int, int]) -> list[Row]:
    return [Row(*spec) for spec in specs]


def order(ranked: list[Ranked]) -> list[str]:
    return [placed.entity.id for placed in ranked]


def groups(ranked: list[Ranked], depth: int) -> list[int | None]:
    return [placed.explanation[depth].group for placed in ranked]


class ById:
    """A terminal criterion, and a check that ``Criteria`` is implementable."""

    def rank(self, entities: list[Row]) -> list[list[Row]]:
        return [[row] for row in sorted(entities, key=lambda row: row.id)]

    def explain(self, entity: Row) -> str:
        return entity.id


BY_WEIGHT = [(LinearSumTerm("weight", float), 1.0)]

#: Both rows are six tenths, but ``1*0.1 + 5*0.1`` and ``2*0.1 + 4*0.1`` are not
#: the same float. See ``test_float_noise_is_a_tie_only_when_a_caller_says_so``.
BY_TENTHS = [
    (LinearSumTerm("weight", lambda v: v * 0.1), 1.0),
    (LinearSumTerm("tier", lambda v: v * 0.1), 1.0),
]

#: A rank table, the shape a domain ordinal usually arrives in.
TIER_RANK = {9: 0, 1: 1, 2: 2}


def test_a_higher_score_ranks_first() -> None:
    ranked = rank(rows(("a", 1, 0), ("b", 3, 0), ("c", 2, 0)), [], [LinearSum(BY_WEIGHT)])
    assert order(ranked) == ["b", "c", "a"]


def test_lower_is_better_is_a_flag_not_a_negated_coefficient() -> None:
    """Negating coefficients to flip the order would negate the terms with it."""
    ranked = rank(
        rows(("a", 1, 0), ("b", 3, 0), ("c", 2, 0)),
        [],
        [LinearSum(BY_WEIGHT, higher_is_better=False)],
    )
    assert order(ranked) == ["a", "c", "b"]


def test_coefficients_scale_their_terms() -> None:
    factors = [(LinearSumTerm("weight", float), 1.0), (LinearSumTerm("tier", float), 10.0)]
    ranked = rank(rows(("a", 9, 0), ("b", 0, 1)), [], [LinearSum(factors)])
    assert order(ranked) == ["b", "a"]


def test_a_tie_falls_through_to_the_next_criterion() -> None:
    """The whole point: a coarse score orders into groups, not into a sequence.

    ``b`` arrives first and ends up last, so this fails if the tie were being
    settled by sort stability rather than by the criterion behind the score.
    """
    ranked = rank(
        rows(("b", 1, 0), ("a", 1, 0), ("c", 2, 0)), [], [LinearSum(BY_WEIGHT), ById()]
    )
    assert order(ranked) == ["c", "a", "b"]


def test_running_out_of_criteria_leaves_the_tie_visible() -> None:
    """Two rows sharing a group is the ranker declining to invent a distinction."""
    ranked = rank(rows(("a", 1, 0), ("b", 1, 0), ("c", 2, 0)), [], [LinearSum(BY_WEIGHT)])
    assert order(ranked) == ["c", "a", "b"]
    assert groups(ranked, 0) == [0, 1, 1]


def test_float_noise_is_a_tie_only_when_a_caller_says_so() -> None:
    """``dp`` is a claim about which digits meant anything, not a tuning knob."""
    exact = rank(rows(("a", 1, 5), ("b", 2, 4)), [], [LinearSum(BY_TENTHS), ById()])
    assert order(exact) == ["b", "a"], "1e-16 of float error decided the order"

    rounded = rank(rows(("a", 1, 5), ("b", 2, 4)), [], [LinearSum(BY_TENTHS, dp=6), ById()])
    assert order(rounded) == ["a", "b"]


def test_a_filter_drops_rows_before_anything_is_ranked() -> None:
    ranked = rank(
        rows(("a", 1, 0), ("b", 3, 0), ("c", 2, 0)),
        [Filter("weight above one", lambda row: row.weight > 1)],
        [LinearSum(BY_WEIGHT)],
    )
    assert order(ranked) == ["b", "c"]


def test_every_filter_has_to_pass() -> None:
    ranked = rank(
        rows(("a", 1, 0), ("b", 3, 1), ("c", 2, 0)),
        [
            Filter("weight above one", lambda row: row.weight > 1),
            Filter("tier is set", lambda row: row.tier > 0),
        ],
        [LinearSum(BY_WEIGHT)],
    )
    assert order(ranked) == ["b"]


def test_filtering_everything_out_is_an_empty_ranking() -> None:
    ranked = rank(rows(("a", 1, 0)), [Filter("nothing", lambda row: False)], [LinearSum(BY_WEIGHT)])
    assert ranked == []


def test_no_criteria_leaves_every_row_tied() -> None:
    ranked = rank(rows(("a", 1, 0), ("b", 2, 0)), [], [])
    assert order(ranked) == ["a", "b"]
    assert all(placed.explanation == () for placed in ranked)


def test_an_ordinal_puts_the_lowest_first() -> None:
    ranked = rank(rows(("a", 3, 0), ("b", 1, 0), ("c", 2, 0)), [], [Ordinal("weight")])
    assert order(ranked) == ["b", "c", "a"]


def test_reverse_puts_the_highest_first() -> None:
    ranked = rank(
        rows(("a", 3, 0), ("b", 1, 0), ("c", 2, 0)), [], [Ordinal("weight", reverse=True)]
    )
    assert order(ranked) == ["a", "c", "b"]


def test_a_transform_maps_the_field_before_it_is_compared() -> None:
    ranked = rank(
        rows(("a", 0, 1), ("b", 0, 9), ("c", 0, 2)), [], [Ordinal("tier", TIER_RANK.__getitem__)]
    )
    assert order(ranked) == ["b", "a", "c"]


def test_a_transform_covers_a_field_that_may_be_null() -> None:
    """Sorting on a raw ``None`` would raise; the transform is where that is fixed."""
    sized = [Row("a", 0, 0, 5.0), Row("b", 0, 0, None), Row("c", 0, 0, 9.0)]
    ranked = rank(sized, [], [Ordinal("size", lambda v: -(v or 0.0))])
    assert order(ranked) == ["c", "a", "b"]


def test_equal_values_fall_through_to_the_next_criterion() -> None:
    ranked = rank(rows(("b", 1, 0), ("a", 1, 0)), [], [Ordinal("weight"), ById()])
    assert order(ranked) == ["a", "b"]
    assert groups(ranked, 0) == [0, 0]


def test_a_chain_of_ordinals_is_a_lexicographic_order() -> None:
    """What replaces a tuple sort key: one ``Ordinal`` per field, in order."""
    unordered = rows(("c", 1, 2), ("a", 1, 1), ("b", 0, 9))
    ranked = rank(unordered, [], [Ordinal("weight"), Ordinal("tier"), Ordinal("id")])
    assert order(ranked) == ["b", "a", "c"]


def test_a_score_can_be_tiebroken_by_ordinals() -> None:
    """The disruption shape: a coarse score with a lexicographic key behind it."""
    unordered = rows(("c", 1, 5), ("a", 1, 2), ("b", 2, 9))
    ranked = rank(unordered, [], [LinearSum(BY_WEIGHT), Ordinal("tier"), Ordinal("id")])
    assert order(ranked) == ["b", "a", "c"]


def test_the_parts_of_a_score_add_up_to_the_score() -> None:
    """Rounding the total alone would leave the reported parts short of it, and a
    client cannot take apart a score whose pieces do not sum to what it was."""
    thirds = [(LinearSumTerm("weight", lambda v: v / 3.0), 1.0) for _ in range(3)]
    scored = LinearSum(thirds, dp=6).score(Row("a", 1, 0))

    assert [c.value for c in scored.contributions] == [0.333333] * 3
    assert scored.value == fsum(c.value for c in scored.contributions) == 0.999999


def test_a_contribution_carries_what_its_term_was_given_and_returned() -> None:
    weight = LinearSumTerm("weight", float)
    tier = LinearSumTerm("tier", lambda v: v / 10.0)
    scored = LinearSum([(weight, 2.0), (tier, 0.5)]).score(Row("a", 3, 4))

    assert [c.term for c in scored.contributions] == [weight, tier]
    assert [(c.normalized, c.coef, c.value) for c in scored.contributions] == [
        (3.0, 2.0, 6.0),
        (0.4, 0.5, 0.2),
    ]
    assert scored.value == 6.2


def test_the_ordering_and_the_explanation_are_one_call() -> None:
    """``rank`` orders on the value ``score`` reports, so the two cannot drift."""
    scorer = LinearSum(BY_TENTHS, dp=6)
    ranked = rank(rows(("a", 1, 5), ("b", 2, 4), ("c", 9, 9)), [], [scorer, Ordinal("id")])

    assert order(ranked) == ["c", "a", "b"]
    assert scorer.score(Row("a", 1, 5)).value == scorer.score(Row("b", 2, 4)).value


def test_every_criterion_accounts_for_every_entity() -> None:
    """A short trace would stop two rows being read side by side."""
    criteria = [LinearSum(BY_WEIGHT), Ordinal("tier"), Ordinal("id")]
    ranked = rank(rows(("a", 1, 0), ("b", 2, 0), ("c", 3, 0)), [], criteria)

    assert all(len(placed.explanation) == 3 for placed in ranked)
    assert [step.criterion for step in ranked[0].explanation] == criteria


def test_a_criterion_that_never_ran_records_no_group() -> None:
    """``group`` is what separates an account that bore on the placement from one
    taken after the row was already alone."""
    ranked = rank(
        rows(("a", 1, 5), ("b", 1, 2), ("c", 2, 0)), [], [Ordinal("weight"), Ordinal("tier")]
    )
    assert order(ranked) == ["b", "a", "c"]
    assert groups(ranked, 0) == [0, 0, 1]
    assert groups(ranked, 1) == [0, 1, None], "c was alone before tier was reached"


def test_a_step_carries_the_criterion_s_own_account() -> None:
    """An ``Ordinal`` reports its key, a ``LinearSum`` the whole ``Score``."""
    ranked = rank(rows(("a", 1, 0), ("b", 2, 0)), [], [LinearSum(BY_WEIGHT), Ordinal("id")])
    top = ranked[0]

    assert top.entity.id == "b"
    assert isinstance(top.explanation[0].detail, Score)
    assert top.explanation[0].detail.value == 2.0
    # Measured even though ``b`` was already alone, which is what the group says.
    assert (top.explanation[1].detail, top.explanation[1].group) == ("b", None)
