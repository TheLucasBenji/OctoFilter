"""
Aquila Optimizer (AO) — Traducción fiel de AO.m (versión 0.2)

Autor original: Abualigah, L., Yousri, D., Abd Elaziz, M., Ewees, A.,
                Al-qaness, M., Gandomi, A.
Referencia: Abualigah, L. et al. (2021). Aquila Optimizer: A novel
            meta-heuristic optimization algorithm.
            Computers & Industrial Engineering.
            https://doi.org/10.1016/j.cie.2021.107250
Código MATLAB original:
            https://www.mathworks.com/matlabcentral/fileexchange/89381-aquila-optimizer-a-meta-heuristic-optimization-algorithm
Licencia: ver backend/algorithms/ao/LICENSE.

Esta implementación es una traducción directa del código MATLAB original
(AO.m + initialization.m, versión 0.2, marzo 2021).
No se introdujeron cambios algorítmicos, optimizaciones de rendimiento ni
vectorizaciones que alteren la estructura del algoritmo. Solo se adaptó la
interfaz (firma de función, callback de progreso, uso de rng reproducible)
para integrarse con este caso de uso de filtros digitales.

Decisiones de fidelidad documentadas
-------------------------------------
- Eq. (13): el término de ruido ((UB-LB)*rand+LB)*delta usa un escalar aleatorio
  único que escala todo el vector, tal como MATLAB produce un escalar con `rand`.
- Xnew no se recorta antes de evaluar: AO.m evalúa F_obj(Xnew) sin clampear;
  el recorte de límites ocurre al inicio de la siguiente iteración, sobre X.
- Best_P / Best_FF solo se actualizan en el escaneo inicial de cada iteración
  (líneas 36-45 de AO.m), no durante la selección codiciosa.
- Convergence[t-1] = best_cost refleja el best al inicio del ciclo de
  actualización de la iteración t (como conv(t)=Best_FF en AO.m línea 104).
"""

from __future__ import annotations

import math
from typing import Callable, Optional

import numpy as np


def _levy(dim: int, rng: np.random.Generator) -> np.ndarray:
    """Vuelo de Lévy (función Levy(d) de AO.m).

    beta=1.5, sin factor 0.01 adicional (fidelidad al original).
    """
    beta = 1.5
    sigma = (
        math.gamma(1 + beta) * math.sin(math.pi * beta / 2)
        / (math.gamma((1 + beta) / 2) * beta * 2 ** ((beta - 1) / 2))
    ) ** (1 / beta)
    u = rng.standard_normal(dim) * sigma   # randn(1,d)*sigma
    v = rng.standard_normal(dim)           # randn(1,d)
    return u / (np.abs(v) ** (1 / beta))   # step = u./abs(v).^(1/beta)


def ao(
    n_population: int,
    max_iter: int,
    lb: np.ndarray,
    ub: np.ndarray,
    dim: int,
    objective_fn: Callable[[np.ndarray], float],
    on_iteration: Optional[Callable[[int, float, np.ndarray], None]] = None,
    rng: Optional[np.random.Generator] = None,
) -> tuple[float, np.ndarray, list[float]]:
    """Ejecuta el Aquila Optimizer (AO).

    Traducción fiel de AO.m. Parámetros y retorno idénticos a ooa() / sfoa()
    para ser drop-in intercambiable.

    Parámetros
    ----------
    n_population : int
        Tamaño de la población (N en MATLAB).
    max_iter : int
        Número máximo de iteraciones (T en MATLAB).
    lb, ub : np.ndarray
        Límites inferior/superior por dimensión, forma (dim,).
    dim : int
        Número de variables de decisión (Dim en MATLAB).
    objective_fn : callable
        Función objetivo f(x) -> float a minimizar (F_obj en MATLAB).
    on_iteration : callable, optional
        Callback (iteration_0based, best_cost, best_pos) -> None, llamado
        una vez por iteración.
    rng : np.random.Generator, optional
        Generador de números aleatorios. Si None, se crea uno nuevo.

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

    # ── Inicialización (AO.m línea 24 vía initialization.m, rama B_no>1) ──
    # X = rand(N,Dim).*(UB-LB)+LB  (por dimensión, equivalente a B_no>1)
    X = lb + rng.random((n_population, dim)) * (ub - lb)
    X_new = X.copy()  # Xnew=X  (AO.m línea 25)

    Ffun = np.full(n_population, np.inf)      # Ffun=zeros(1,N)  (se llena en iter 1)
    Ffun_new = np.full(n_population, np.inf)  # Ffun_new=zeros(1,N)

    best_pos = np.zeros(dim)   # Best_P=zeros(1,Dim)  (AO.m línea 20)
    best_cost = np.inf          # Best_FF=inf          (AO.m línea 21)

    alpha = 0.1
    delta = 0.1

    # Curve preallocada (AO.m usa conv(t) indexado 1..T)
    convergence: list[float] = [0.0] * max_iter

    # Denominador de QF; protección ante max_iter==1 (caso degenerado)
    qf_denom = (1 - max_iter) ** 2 if max_iter != 1 else 1.0

    # ── Bucle principal: t = 1 .. T  (AO.m: while t<T+1) ──────────────────
    for t in range(1, max_iter + 1):

        # ── Escaneo: recorte, evaluación y actualización de best ────────────
        # AO.m líneas 36-45
        for i in range(n_population):
            # Recorte de bounds (AO.m líneas 37-39)
            X[i] = np.clip(X[i], lb, ub)

            Ffun[i] = objective_fn(X[i])
            if Ffun[i] < best_cost:
                best_cost = float(Ffun[i])
                best_pos = X[i].copy()

        # ── Parámetros globales de la iteración (AO.m líneas 48-59) ────────
        G2 = 2 * rng.random() - 1           # Eq. (16)
        G1 = 2 * (1 - t / max_iter)         # Eq. (17)

        # Espiral de caza (AO.m líneas 50-58)
        to = np.arange(1, dim + 1, dtype=float)  # to = 1:Dim
        u_s = 0.0265
        r0 = 10
        r = r0 + u_s * to
        omega = 0.005
        phi0 = 3 * math.pi / 2
        phi = -omega * to + phi0
        x_sp = r * np.sin(phi)   # Eq. (9)
        y_sp = r * np.cos(phi)   # Eq. (10)

        # QF = t^((2*rand-1)/(1-T)^2)  (Eq. 15; denominador usa T total)
        QF = t ** ((2 * rng.random() - 1) / qf_denom)

        # ── Actualización de posiciones (AO.m líneas 61-99) ─────────────────
        for i in range(n_population):

            if t <= (2 / 3) * max_iter:
                # ── Exploración (t ≤ 2T/3) ──────────────────────────────────
                if rng.random() < 0.5:
                    # Eq. (3) y Eq. (4): vuelo de caza expandido
                    # mean(X(i,:)) → np.mean(X[i]) es escalar (media de fila)
                    X_new[i] = (
                        best_pos * (1 - t / max_iter)
                        + (np.mean(X[i]) - best_pos) * rng.random()
                    )
                else:
                    # Eq. (5): vuelo de caza estrecho con Lévy
                    # floor(N*rand()+1) en MATLAB → índice 1-based ∈ {1..N}
                    rand_idx = rng.integers(0, n_population)
                    X_new[i] = (
                        best_pos * _levy(dim, rng)
                        + X[rand_idx]
                        + (y_sp - x_sp) * rng.random()
                    )

            else:
                # ── Explotación (t > 2T/3) ──────────────────────────────────
                if rng.random() < 0.5:
                    # Eq. (13): descenso con ruido
                    # mean(X) en MATLAB → media por columna, vector de tamaño Dim
                    # rand en MATLAB → ESCALAR (fidelidad: un solo valor aleatorio)
                    X_new[i] = (
                        (best_pos - np.mean(X, axis=0)) * alpha
                        - rng.random()                               # escalar
                        + ((ub - lb) * rng.random() + lb) * delta   # escalar
                    )
                else:
                    # Eq. (14): vuelo de caza con QF y Lévy
                    X_new[i] = (
                        QF * best_pos
                        - (G2 * X[i] * rng.random())
                        - G1 * _levy(dim, rng)
                        + rng.random() * G2
                    )

            # ── Selección codiciosa (AO.m dentro de cada rama if/else) ──────
            # X_new NO se recorta aquí; el recorte ocurre en el escaneo de la
            # siguiente iteración, exactamente como en AO.m.
            Ffun_new[i] = objective_fn(X_new[i])
            if Ffun_new[i] < Ffun[i]:
                X[i] = X_new[i].copy()
                Ffun[i] = Ffun_new[i]
            # Nota: Best_FF NO se actualiza aquí (fidelidad a AO.m líneas 66-95)

        # conv(t) = Best_FF  (AO.m línea 104); índice 0-based para igualar OOA/SFOA
        convergence[t - 1] = best_cost

        if on_iteration is not None:
            on_iteration(t - 1, best_cost, best_pos)

    return best_cost, best_pos, convergence


# Backwards-compatible symbol for older imports.
aquila = ao
