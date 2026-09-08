"""Read a ranking back: what separated two rows, and what nothing separated.

``rank`` records which group each entity fell into at each criterion and stops
there. Deciding is a property of the boundary between two rows rather than of
either one, so it is answered here, two rows at a time.
"""

from src.models.rank import Criteria, Ranked


def decided_by(above: Ranked, below: Ranked) -> Criteria | None:
    """The first criterion whose groups the two rows fell into differently.

    ``None`` where no criterion separated them, which is what a tie is.
    """
    for above_step, below_step in zip(above.explanation, below.explanation):
        if above_step.group is None or below_step.group is None:
            break
        if above_step.group != below_step.group:
            return above_step.criterion
    return None


def tied(above: Ranked, below: Ranked) -> bool:
    return decided_by(above, below) is None
