"""
Algoritmo de Optimización del Pulpo (OOA) — Versión en Python de OOA5.m

Adaptado de la implementación en MATLAB por Meijia Song et al.
Referencia: Song, M., Lin, J., Liu, X., Jia, H., & Luo, S. (2025).
           Octopus optimization algorithm: A novel single- and multi-objective
           optimization algorithm for optimization problems.
           Cluster Computing, 28, 484.

El algoritmo organiza una población en tres roles:
  - Cabezas (cuerpos de pulpo)   — NHead = floor((N - NScout) / 9)
  - Tentáculos (por cabeza ≈ 8)  — NTentacles = N - NHead - NScout
  - Exploradores (scouts)        — NScout = N mod 9

Cada iteración tiene tres fases:
  1. Movimiento de tentáculos (exploración / explotación decidida por |trans| vs ll)
  2. Intercambio (si un tentáculo es mejor que su cabeza, se intercambian)
  3. Fase de exploradores (exploran alrededor de las cabezas mejor/peor/aleatoria)
"""

from __future__ import annotations

import math
import concurrent.futures
from dataclasses import dataclass, field
from typing import Callable, Optional

import numpy as np
from scipy.special import gamma


# ---------------------------------------------------------------------------
# Estructuras de datos
# ---------------------------------------------------------------------------

@dataclass
class Agent:
    """Agente de búsqueda individual (usado para cabezas, tentáculos y exploradores)."""
    pos: np.ndarray = field(default_factory=lambda: np.array([]))
    cost: float = float("inf")


@dataclass
class OctopusHead:
    """Una cabeza de pulpo con sus tentáculos asociados."""
    pos: np.ndarray = field(default_factory=lambda: np.array([]))
    cost: float = float("inf")
    tentacles: list[Agent] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Funciones auxiliares
# ---------------------------------------------------------------------------

def _levy_flight(dim: int, beta: float = 1.5, rng: Optional[np.random.Generator] = None) -> np.ndarray:
    """Genera un vector de paso de vuelo de Lévy de una dimensión dada.

    Usa el algoritmo de Mantegna:
        sigma = (Gamma(1+beta) * sin(pi*beta/2) /
                 (Gamma((1+beta)/2) * beta * 2^((beta-1)/2))) ^ (1/beta)
        u ~ N(0, sigma^2),  v ~ N(0, 1)
        step = u / |v|^(1/beta)
    """
    if rng is None:
        rng = np.random.default_rng()

    sigma = (
        gamma(1 + beta) * math.sin(math.pi * beta / 2)
        / (gamma((1 + beta) / 2) * beta * 2 ** ((beta - 1) / 2))
    ) ** (1 / beta)

    u = rng.standard_normal(dim) * sigma
    v = rng.standard_normal(dim)
    step = u / np.abs(v) ** (1 / beta)
    return step


def _exchange(octopus_list: list[OctopusHead]) -> None:
    """Si el mejor tentáculo de una cabeza es mejor que la cabeza, se intercambian.

    Refleja la función ``exchange.m`` de MATLAB. Opera **in-place**.
    """
    for head in octopus_list:
        if not head.tentacles:
            continue
        costs = np.array([t.cost for t in head.tentacles])
        best_idx = int(np.argmin(costs))
        if costs[best_idx] < head.cost:
            # Intercambiar cabeza <-> mejor tentáculo
            best_tent = head.tentacles[best_idx]
            head.tentacles[best_idx] = Agent(pos=head.pos.copy(), cost=head.cost)
            head.pos = best_tent.pos.copy()
            head.cost = best_tent.cost


# ---------------------------------------------------------------------------
# Algoritmo principal
# ---------------------------------------------------------------------------

def ooa(
    n_population: int,
    max_iter: int,
    lb: np.ndarray,
    ub: np.ndarray,
    dim: int,
    objective_fn: Callable[[np.ndarray], float],
    on_iteration: Optional[Callable[[int, float, np.ndarray], None]] = None,
    rng: Optional[np.random.Generator] = None,
) -> tuple[float, np.ndarray, list[float]]:
    """Ejecuta el Algoritmo de Optimización del Pulpo.

    Parámetros
    ----------
    n_population : int
        Tamaño total de la población (N). Se divide en cabezas, tentáculos y exploradores.
    max_iter : int
        Número máximo de iteraciones (T).
    lb, ub : np.ndarray
        Límites inferior / superior para cada dimensión (forma ``(dim,)``).
    dim : int
        Número de variables de decisión.
    objective_fn : callable
        Función objetivo ``f(x) -> float`` a **minimizar**.
    on_iteration : callable, optional
        Callback ``(iteration, best_cost, best_pos) -> None`` invocado después
        de cada iteración para reportar el progreso.

    Retorna
    -------
    best_cost : float
    best_pos : np.ndarray
    convergence_curve : list[float]
    """

    if rng is None:
        rng = np.random.default_rng()

    lb = np.asarray(lb, dtype=float)
    ub = np.asarray(ub, dtype=float)

    # --- Asignación de roles (coincide exactamente con MATLAB) ---
    N = n_population
    NScout = N % 9
    NHead = (N - NScout) // 9
    NTentacles = N - NHead - NScout

    # Asegura que tengamos al menos 1 cabeza y algunos tentáculos
    if NHead < 1:
        NHead = 1
        NTentacles = max(N - NHead - NScout, 1)

    vr = 3.0        # rango de exploración/explotación
    ll = 0.8        # umbral entre exploración y explotación

    tentacles: list[Agent] = []
    scouts: list[Agent] = []
    octopus: list[OctopusHead] = []

    with concurrent.futures.ThreadPoolExecutor() as executor:
        # --- Inicializar agentes en paralelo ---
        all_initial_positions = []
        for _ in range(NTentacles):
            all_initial_positions.append(lb + rng.random(dim) * (ub - lb))
        for _ in range(NScout):
            all_initial_positions.append(lb + rng.random(dim) * (ub - lb))
        for _ in range(NHead):
            all_initial_positions.append(lb + rng.random(dim) * (ub - lb))
            
        all_initial_costs = list(executor.map(objective_fn, all_initial_positions))
        
        idx = 0
        for _ in range(NTentacles):
            tentacles.append(Agent(pos=all_initial_positions[idx], cost=all_initial_costs[idx]))
            idx += 1
        for _ in range(NScout):
            scouts.append(Agent(pos=all_initial_positions[idx], cost=all_initial_costs[idx]))
            idx += 1
        for _ in range(NHead):
            octopus.append(OctopusHead(pos=all_initial_positions[idx], cost=all_initial_costs[idx]))
            idx += 1

        # --- Asignar tentáculos a las cabezas (round-robin) ---
        perm = rng.permutation(NTentacles)
        for idx_t, t_idx in enumerate(perm):
            head_idx = idx_t % NHead
            octopus[head_idx].tentacles.append(tentacles[t_idx])

        # --- Intercambio inicial ---
        _exchange(octopus)

        # --- Mejor global (posición de la concha) ---
        head_costs = np.array([h.cost for h in octopus])
        best_head_idx = int(np.argmin(head_costs))
        pBest = octopus[best_head_idx].pos.copy()
        pBestScore = octopus[best_head_idx].cost

        convergence: list[float] = [pBestScore]

        if on_iteration is not None:
            on_iteration(0, pBestScore, pBest)

        # ===================================================================
        # Bucle principal
        # ===================================================================
        for t in range(1, max_iter):
            ld = vr * (1 - t / max_iter)  # decrece linealmente de vr a 0

            # ----- Fase 1: Movimiento de tentáculos -----
            agents_to_eval = []
            for head in octopus:
                for j, tent in enumerate(head.tentacles):
                    trans = 2 * ld * rng.random() - ld  # en [-ld, ld]

                    if abs(trans) < ll:
                        # Explotación: moverse hacia el mejor global usando vuelo de Lévy
                        tent_costs = np.array([tt.cost for tt in head.tentacles])
                        local_best_idx = int(np.argmin(tent_costs))
                        new_pos = (
                            tent.pos
                            + rng.random()
                            * (pBest - head.tentacles[local_best_idx].pos)
                            * _levy_flight(dim, rng=rng)
                        )
                    else:
                        # Exploración: moverse relativo a la cabeza usando vuelo de Lévy
                        new_pos = (
                            head.pos
                            + rng.random()
                            * (head.pos - tent.pos)
                            * _levy_flight(dim, rng=rng)
                        )

                    # Restringir a los límites
                    new_pos = np.clip(new_pos, lb, ub)
                    tent.pos = new_pos
                    agents_to_eval.append(tent)

            # Evaluar en paralelo
            costs = list(executor.map(objective_fn, [a.pos for a in agents_to_eval]))
            for i, tent in enumerate(agents_to_eval):
                tent.cost = costs[i]

            _exchange(octopus)

            # ----- Fase 2: Fase de exploradores -----
            head_costs_arr = np.array([h.cost for h in octopus])
            sorted_indices = np.argsort(head_costs_arr)

            for z in range(len(scouts)):
                if z == 0:
                    flag_idx = sorted_indices[0]            # mejor cabeza
                elif z == 1:
                    flag_idx = sorted_indices[-1]           # peor cabeza
                else:
                    if len(sorted_indices) > 2:
                        mid = rng.integers(1, len(sorted_indices) - 1)
                        flag_idx = sorted_indices[mid]          # cabeza intermedia aleatoria
                    else:
                        flag_idx = sorted_indices[rng.integers(0, len(sorted_indices))]

                flag = octopus[flag_idx]

                # El explorador explora alrededor de la cabeza marcada
                scouts[z].pos = (
                    flag.pos
                    + rng.random() * ((ub + lb) / 2 - flag.pos)
                )
                scouts[z].pos = np.clip(scouts[z].pos, lb, ub)
                scouts[z].cost = objective_fn(scouts[z].pos)

                if scouts[z].cost < flag.cost:
                    # Reemplazar la posición de la cabeza con el explorador
                    octopus[flag_idx].pos = scouts[z].pos.copy()
                    octopus[flag_idx].cost = scouts[z].cost

                    # Reinicializar tentáculos alrededor de la nueva posición
                    n_tent = len(octopus[flag_idx].tentacles)
                    new_positions = []
                    for i in range(n_tent):
                        new_pos = (
                            (octopus[flag_idx].pos - ll)
                            + rng.random(dim) * (2 * ll)
                        )
                        new_positions.append(np.clip(new_pos, lb, ub))
                        
                    new_costs = list(executor.map(objective_fn, new_positions))
                    
                    for i in range(n_tent):
                        octopus[flag_idx].tentacles[i] = Agent(
                            pos=new_positions[i],
                            cost=new_costs[i],
                        )
                    _exchange(octopus)

            # ----- Actualizar el mejor global -----
            head_costs_arr = np.array([h.cost for h in octopus])
            min_idx = int(np.argmin(head_costs_arr))
            if head_costs_arr[min_idx] < pBestScore:
                pBest = octopus[min_idx].pos.copy()
                pBestScore = head_costs_arr[min_idx]

            convergence.append(pBestScore)

            if on_iteration is not None:
                on_iteration(t, pBestScore, pBest)

        return pBestScore, pBest, convergence
