from collections.abc import Callable
from typing import Protocol, Any, TypeVar

T = TypeVar('T')

class Criteria(Protocol):
    # return groups of entities; same group means same ranking
    def rank(self, entities: list[T]) -> list[list[T]]:
        pass


class LinearSumTerm:
    def __init__(self, 
                 var_name: str,
                 float_transform: Callable[[Any], float]):
        self.var_name = var_name
        self.float_transform = float_transform

    def contribution(self, entity: Any, coef: float):
        raw = self.float_transform(getattr(entity, self.var_name))
        return coef * raw


class LinearSum:
    def __init__(self, factors: list[tuple[LinearSumTerm, float]]):
        self.factors = factors

    def rank(self, entities: list[T]) -> list[list[T]]:
        scores = []
        for entity in entities:
            entity_score = 0
            for linear_sum_term, coef in self.factors:
                entity_score += linear_sum_term.contribution(entity, coef)
            scores.append((entity_score, entity))
        sorted_scores = sorted(scores, key=lambda x: x[0])
        grouped_scores = []
        for score in sorted_scores:
            # linear sum is a terminal ranking criteria;
            # entities with equivalent linear sum scores should not be ranked with further criteria
            grouped_scores.append([score[1]])
        return grouped_scores


class Filter:
    def __init__(self, description: str):
        self.description = description

    def is_valid(self, entity) -> bool:
        raise RuntimeError(f"check_valid on Filter with description {self.description} unimplemented")


# recursively rank by criteria in order
def rank_helper(entities: list[T], criteria: list[Criteria]) -> list[T]:
    if len(entities) == 0:
        return []
    if len(entities) == 1:
        return [entities]

    if len(criteria) == 0:
        return [entities]

    next_criterion = criteria[0]
    ranked_groups = next_criterion.rank(entities)

    remaining_criteria = criteria[1:]
    ranked_entities = []
    for group in ranked_groups:
        ranked_entities += rank_helper(group, remaining_criteria)
    return ranked_entities


def rank(entities: list[T], filters: list[Filter], criteria: list[Criteria]) -> list[T]:
    # First filter
    valid_entities = [
        entity for entity in entities 
        if all(f.is_valid(entity) for f in filters)
    ]

    # Then rank by criteria
    return rank_helper(valid_entities, criteria)


