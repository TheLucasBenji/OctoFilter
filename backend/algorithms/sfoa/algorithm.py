"""
Starfish Optimization Algorithm (SFOA) — Traducción fiel de SFOA.m

Autor original: Dr. Changting Zhong (zhongct@hainanu.edu.cn)
Referencia: Changting Zhong, Gang Li, Zeng Meng, Haijiang Li, Ali Riza Yildiz, Seyedali Mirjalili.
            Starfish Optimization Algorithm (SFOA): A bio-inspired metaheuristic algorithm for
            global optimization compared with 100 optimizers.
            Neural Computing and Applications, 2025, 37: 3641-3683.
            DOI: 10.1007/s00521-024-10694-1

Esta implementación es una traducción directa del código MATLAB original.
No se introdujeron cambios algorítmicos, optimizaciones de rendimiento ni vectorizaciones
que alteren la estructura del algoritmo. Solo se adaptó la interfaz (firma de función,
callback de progreso y cancelación) para integrarse con este caso de uso de filtros digitales.
"""

from __future__ import annotations

import math
from typing import Callable, Optional

import numpy as np


def sfoa(
    n_population: int,
    max_iter: int,
    lb: np.ndarray,
    ub: np.ndarray,
    dim: int,
    objective_fn: Callable[[np.ndarray], float],
    on_iteration: Optional[Callable[[int, float, np.ndarray], None]] = None,
    rng: Optional[np.random.Generator] = None,
) -> tuple[float, np.ndarray, list[float]]:
    """Ejecuta el Starfish Optimization Algorithm (SFOA).

    Traducción fiel de SFOA.m. Parámetros y retorno idénticos a ooa() para ser drop-in.

    Parámetros
    ----------
    n_population : int
        Tamaño de la población (Npop en MATLAB).
    max_iter : int
        Número máximo de iteraciones (Max_it en MATLAB).
    lb, ub : np.ndarray
        Límites inferior/superior por dimensión, forma (dim,).
    dim : int
        Número de variables de decisión (nD en MATLAB).
    objective_fn : callable
        Función objetivo f(x) -> float a minimizar (fobj en MATLAB).
    on_iteration : callable, optional
        Callback (iteration, best_cost, best_pos) -> None, una llamada por iteración.
    rng : np.random.Generator, optional
        Generador de números aleatorios.

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

    # --- Inicialización (MATLAB líneas 8-24) ---
    GP = 0.5  # parámetro del algoritmo original

    Xpos = lb + rng.random((n_population, dim)) * (ub - lb)  # rand(Npop,nD).*(ub-lb)+lb

    Fitness = np.empty(n_population)
    for i in range(n_population):
        Fitness[i] = objective_fn(Xpos[i])

    order = int(np.argmin(Fitness))
    fvalbest = float(Fitness[order])
    xposbest = Xpos[order].copy()

    # Buffer persistente inicializado en ceros — fidelidad intencional al MATLAB original.
    # En la rama de exploración (dim<=5) solo se actualiza UNA dimensión por individuo;
    # las demás dimensiones retienen sus valores previos, exactamente como en SFOA.m.
    newX = np.zeros((n_population, dim))

    convergence: list[float] = [0.0] * max_iter  # Curve = zeros(1,Max_it)

    # --- Bucle principal (MATLAB líneas 27-91): T = 1 .. Max_it ---
    for T in range(1, max_iter + 1):

        theta = math.pi / 2 * T / max_iter                   # MATLAB línea 28
        tEO = (max_iter - T) / max_iter * math.cos(theta)    # MATLAB línea 29

        if rng.random() < GP:
            # ── Exploración (MATLAB líneas 30-58) ──────────────────────────────
            for i in range(n_population):
                if dim > 5:
                    # Patrón de búsqueda 5-dimensional (MATLAB líneas 32-45)
                    jp1 = rng.permutation(dim)[:5]  # randperm(nD,5)
                    for j in jp1:
                        pm = (2 * rng.random() - 1) * math.pi
                        if rng.random() < GP:
                            newX[i, j] = (Xpos[i, j]
                                          + pm * (xposbest[j] - Xpos[i, j]) * math.cos(theta))
                        else:
                            newX[i, j] = (Xpos[i, j]
                                          - pm * (xposbest[j] - Xpos[i, j]) * math.sin(theta))
                        # Revertir si sale de límites (MATLAB líneas 42-44)
                        if newX[i, j] > ub[j] or newX[i, j] < lb[j]:
                            newX[i, j] = Xpos[i, j]
                else:
                    # Patrón de búsqueda unidimensional (MATLAB líneas 46-56)
                    # ceil(nD*rand) en MATLAB → índice 1-based; convertir a 0-based
                    r_jp2 = rng.random()
                    jp2 = int(math.ceil(dim * r_jp2)) - 1
                    if jp2 < 0:
                        jp2 = 0  # borde: rand==0 → ceil(0)=0 → clamp

                    im = rng.permutation(n_population)  # randperm(Npop)
                    rand1 = 2 * rng.random() - 1
                    rand2 = 2 * rng.random() - 1

                    newX[i, jp2] = (tEO * Xpos[i, jp2]
                                    + rand1 * (Xpos[im[0], jp2] - Xpos[i, jp2])
                                    + rand2 * (Xpos[im[1], jp2] - Xpos[i, jp2]))

                    # Revertir si sale de límites (MATLAB líneas 53-55)
                    if newX[i, jp2] > ub[jp2] or newX[i, jp2] < lb[jp2]:
                        newX[i, jp2] = Xpos[i, jp2]

                # Recorte global de la fila (MATLAB línea 57)
                newX[i] = np.clip(newX[i], lb, ub)

        else:
            # ── Explotación (MATLAB líneas 59-75) ──────────────────────────────
            # Cinco brazos de la estrella de mar (randperm(Npop,5))
            df = rng.permutation(n_population)[:5]
            dm = xposbest - Xpos[df]  # dm[k] = xposbest - Xpos[df[k]], k=0..4

            for i in range(n_population):
                r1 = rng.random()
                r2 = rng.random()
                kp = rng.permutation(5)[:2]  # randperm(length(df),2)

                newX[i] = Xpos[i] + r1 * dm[kp[0]] + r2 * dm[kp[1]]

                # Regeneración: solo el último individuo (MATLAB líneas 70-72, i==Npop)
                if i == n_population - 1:
                    newX[i] = math.exp(-T * n_population / max_iter) * Xpos[i]

                newX[i] = np.clip(newX[i], lb, ub)  # MATLAB línea 73

        # ── Evaluación y selección codiciosa (MATLAB líneas 77-88) ────────────
        for i in range(n_population):
            newFit = objective_fn(newX[i])
            if newFit < Fitness[i]:
                Fitness[i] = newFit
                Xpos[i] = newX[i].copy()
                if newFit < fvalbest:
                    fvalbest = float(newFit)
                    xposbest = Xpos[i].copy()

        # Curve(T) = fvalbest  (MATLAB línea 90)
        convergence[T - 1] = fvalbest

        # Glue de integración: callback de progreso (índice 0-based para igualar OOA)
        if on_iteration is not None:
            on_iteration(T - 1, fvalbest, xposbest)

    return fvalbest, xposbest, convergence
