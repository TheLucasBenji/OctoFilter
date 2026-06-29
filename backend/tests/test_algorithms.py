from __future__ import annotations

import numpy as np
import pytest

from algorithms.ao.algorithm import ao
from algorithms.ooa.algorithm import ooa
from algorithms.sfoa.algorithm import sfoa


@pytest.mark.parametrize("algorithm", [ooa, sfoa, ao])
def test_algorithm_contract_with_seeded_sphere(algorithm) -> None:
    lb = np.array([-5.0, -5.0])
    ub = np.array([5.0, 5.0])
    callback_events: list[tuple[int, float, np.ndarray]] = []

    def sphere(position: np.ndarray) -> float:
        return float(np.sum(position**2))

    best_cost, best_pos, convergence = algorithm(
        n_population=9,
        max_iter=3,
        lb=lb,
        ub=ub,
        dim=2,
        objective_fn=sphere,
        on_iteration=lambda iteration, cost, pos: callback_events.append((iteration, cost, pos.copy())),
        rng=np.random.default_rng(7),
    )

    assert np.isfinite(best_cost)
    assert best_pos.shape == (2,)
    assert np.all(best_pos >= lb)
    assert np.all(best_pos <= ub)
    assert len(convergence) == 3
    assert all(np.isfinite(value) for value in convergence)
    assert len(callback_events) == 3
