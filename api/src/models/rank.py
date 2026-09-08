"""Rank entities by criteria applied in order, with ties falling through.

Each criterion returns groups, best first, and every group it could not split is
handed to the next criterion. What comes back is one ``Ranked`` per entity,
carrying which group it fell into at every criterion and that criterion's own
account of it. Nothing here reads that trace back: a domain supplies the filters
and the criteria, and ``rank_explain`` turns a trace into an explanation.
"""

from collections.abc import Callable
from dataclasses import dataclass
from math import fsum
from typing import Any, Generic, Protocol, TypeVar

T = TypeVar("T")


class Criteria(Protocol):
    """One ordering pass, returning groups of entities best first.

    Entities in the same group are tied and fall through to the next criterion.
    Every entity passed in must come back in exactly one group; a criterion
    orders, it never filters. ``explain`` returns the criterion's own account of
    an entity, in whatever vocabulary that criterion uses.
    """

    def rank(self, entities: list[T]) -> list[list[T]]: ...

    def explain(self, entity: T) -> Any: ...


def _group_by_key(
    entities: list[T], key: Callable[[T], Any], reverse: bool
) -> list[list[T]]:
    """Sort on ``key``, then collect runs of equal keys into one group each."""
    keyed = [(key(entity), entity) for entity in entities]
    # Sort on the key alone; entities are not required to be comparable.
    keyed.sort(key=lambda pair: pair[0], reverse=reverse)

    groups: list[list[T]] = []
    previous: Any = None
    for value, entity in keyed:
        if groups and value == previous:
            groups[-1].append(entity)
        else:
            groups.append([entity])
        previous = value
    return groups


class LinearSumTerm:
    def __init__(self,
                 var_name: str,
                 float_transform: Callable[[Any], float]):
        self.var_name = var_name
        self.float_transform = float_transform

    def normalize(self, entity: Any) -> float:
        return self.float_transform(getattr(entity, self.var_name))

    def contribution(self, entity: Any, coef: float) -> float:
        return coef * self.normalize(entity)


@dataclass(frozen=True)
class Contribution:
    """One term's part of a score, kept so a score can be taken apart."""

    term: LinearSumTerm
    #: What ``float_transform`` returned, before the coefficient.
    normalized: float
    coef: float
    #: ``coef * normalized``, rounded. Contributions sum to ``Score.value``.
    value: float


@dataclass(frozen=True)
class Score:
    value: float
    #: One per term, in the order the factors were declared.
    contributions: tuple[Contribution, ...]


@dataclass(frozen=True)
class Step:
    """What one criterion did with one entity."""

    criterion: Criteria
    #: The criterion's own account of the entity: an ``Ordinal``'s key, a
    #: ``LinearSum``'s ``Score`` with every contribution.
    detail: Any
    #: Which of this criterion's groups the entity fell into, or ``None`` where
    #: the entity was already alone and the criterion never ran.
    group: int | None


@dataclass(frozen=True)
class Ranked(Generic[T]):
    """An entity in its place, with one ``Step`` per criterion in chain order."""

    entity: T
    explanation: tuple[Step, ...]


class LinearSum:
    """Weighted sum of terms, best first, with equal scores left in one group.

    Grouping ties is what lets a further criterion run behind a coarse score, so
    a caller wanting a total order ends with a criterion that cannot tie. ``dp``
    rounds each contribution before they are summed, so accumulated float error
    does not present as a ranking and the parts of a score add up to the score
    exactly. ``higher_is_better`` is a flag rather than a sign convention, since
    negating coefficients would negate the terms with them.
    """

    def __init__(
        self,
        factors: list[tuple[LinearSumTerm, float]],
        *,
        higher_is_better: bool = True,
        dp: int | None = None,
    ):
        self.factors = factors
        self.higher_is_better = higher_is_better
        self.dp = dp

    def _round(self, value: float) -> float:
        return value if self.dp is None else round(value, self.dp)

    def score(self, entity: Any) -> Score:
        """The entity's score and every term's part of it."""
        contributions = []
        for term, coef in self.factors:
            normalized = term.normalize(entity)
            contributions.append(
                Contribution(term, normalized, coef, self._round(coef * normalized))
            )
        total = self._round(fsum(c.value for c in contributions))
        return Score(total, tuple(contributions))

    def explain(self, entity: Any) -> Score:
        return self.score(entity)

    def rank(self, entities: list[T]) -> list[list[T]]:
        return _group_by_key(
            entities, lambda entity: self.score(entity).value, self.higher_is_better
        )


class Ordinal:
    """Order on one field, leaving equal values in one group.

    ``transform`` maps the field to whatever should be compared, the way
    ``LinearSumTerm`` does for scores: a rank table lookup, an inverted flag, a
    stand-in for a null the field may carry. Lowest first unless ``reverse``.
    """

    def __init__(
        self,
        var_name: str,
        transform: Callable[[Any], Any] | None = None,
        *,
        reverse: bool = False,
    ):
        self.var_name = var_name
        self.transform = transform
        self.reverse = reverse

    def key(self, entity: Any) -> Any:
        raw = getattr(entity, self.var_name)
        return raw if self.transform is None else self.transform(raw)

    def explain(self, entity: Any) -> Any:
        return self.key(entity)

    def rank(self, entities: list[T]) -> list[list[T]]:
        return _group_by_key(entities, self.key, self.reverse)


@dataclass(frozen=True)
class Filter:
    """A named predicate. Dropping rows is invisible in the output, so the
    description is what lets a caller account for what it removed."""

    description: str
    predicate: Callable[[Any], bool]

    def is_valid(self, entity: Any) -> bool:
        return self.predicate(entity)


def _traced(
    entities: list[T], criteria: list[Criteria], prefix: list[int | None]
) -> list[tuple[T, list[int | None]]]:
    """Rank recursively, recording the group each entity fell into at each level.

    A group of one stops the recursion, so the criteria behind it never run and
    are recorded as ``None`` rather than as a group they were never offered.
    """
    if len(entities) == 0:
        return []
    if len(entities) == 1 or len(criteria) == 0:
        return [(entity, prefix + [None] * len(criteria)) for entity in entities]

    next_criterion = criteria[0]
    remaining_criteria = criteria[1:]
    traced = []
    for index, group in enumerate(next_criterion.rank(entities)):
        traced += _traced(group, remaining_criteria, prefix + [index])
    return traced


def rank(
    entities: list[T], filters: list[Filter], criteria: list[Criteria]
) -> list[Ranked[T]]:
    """Drop what fails any filter, then order the rest by each criterion in turn.

    Best first. Every criterion accounts for every entity, so two rows can be
    read side by side whichever of them the ordering stopped at; ``Step.group``
    is what says which of those accounts bore on the placement.
    """
    # First filter
    valid_entities = [
        entity for entity in entities
        if all(f.is_valid(entity) for f in filters)
    ]

    # Then rank by criteria
    return [
        Ranked(
            entity,
            tuple(
                Step(criterion, criterion.explain(entity), group)
                for criterion, group in zip(criteria, groups)
            ),
        )
        for entity, groups in _traced(valid_entities, criteria, [])
    ]
