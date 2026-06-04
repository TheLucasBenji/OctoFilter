"""
Filtro de difusión anisotrópica (Perona-Malik).

Parámetros a optimizar (4 dimensiones, 3 variables independientes + 1 opción discreta):
    x[0]  →  niter   (número de iteraciones de difusión), int en [5, 50]
    x[1]  →  kappa   (umbral de magnitud de gradiente), float en [10, 100]
    x[2]  →  gamma   (tasa / velocidad de difusión), float en [0.05, 0.25]
    x[3]  →  option  (selector de función de difusión), 1 o 2

Opción 1 — Flujo exponencial:
    c(||∇I||) = exp(-(||∇I|| / kappa)^2)
    Favorece los bordes de alto contraste.

Opción 2 — Flujo recíproco:
    c(||∇I||) = 1 / (1 + (||∇I|| / kappa)^2)
    Favorece regiones amplias sobre las más pequeñas.
"""

from __future__ import annotations

import numpy as np


# Límites del espacio de búsqueda ---------------------------------------------
LOWER_BOUNDS = np.array([5.0, 10.0, 0.05, 1.0])
UPPER_BOUNDS = np.array([50.0, 100.0, 0.25, 2.0])
DIM = 4
PARAM_NAMES = ["Iteraciones", "Kappa", "Gamma", "Opción (1=exp, 2=rec)"]
PARAM_METADATA = [
    {
        "key": "niter",
        "display_name": "niter · Diffusion iterations",
        "scientific_name": "Diffusion iterations",
        "symbol": "niter",
        "common_name": "niter",
        "aliases": ["iterations", "iteraciones", "diffusion steps"],
        "description": "Número de pasos de difusión aplicados por el modelo de Perona-Malik.",
    },
    {
        "key": "kappa",
        "display_name": "κ · Gradient threshold (kappa)",
        "scientific_name": "Gradient threshold",
        "symbol": "κ",
        "common_name": "kappa",
        "aliases": ["conductance", "gradient threshold", "edge threshold"],
        "description": "Umbral de gradiente que regula la preservación de bordes en Perona-Malik.",
    },
    {
        "key": "gamma",
        "display_name": "γ · Diffusion rate / time step",
        "scientific_name": "Diffusion rate / time step",
        "symbol": "γ",
        "common_name": "gamma",
        "aliases": ["time step", "integration constant", "diffusion rate"],
        "description": "Tasa de difusión o paso temporal que controla la intensidad de cada actualización.",
    },
    {
        "key": "option",
        "display_name": "g(|∇I|) · Conduction function",
        "scientific_name": "Conduction function",
        "symbol": "g(|∇I|)",
        "common_name": "option",
        "aliases": ["diffusion function", "flux function", "conductance function"],
        "description": "Función de conducción de Perona-Malik: exponencial o recíproca.",
    },
]


def _perona_malik(
    image: np.ndarray,
    niter: int,
    kappa: float,
    gamma_val: float,
    option: int,
) -> np.ndarray:
    """Difusión anisotrópica de Perona-Malik.

    Parámetros
    ----------
    image : np.ndarray
        Imagen de entrada como float64 en [0, 255].
    niter : int
        Número de iteraciones de difusión.
    kappa : float
        Umbral de magnitud de gradiente que controla la conducción.
    gamma_val : float
        Constante de integración (0 < gamma <= 0.25 por estabilidad).
    option : int
        1 → función de flujo exponencial
        2 → función de flujo recíproco (cuadrático)

    Retorna
    -------
    np.ndarray
        Imagen difundida como float64.
    """
    img = image.astype(np.float64)

    # Gradientes en diferencias finitas (Norte, Sur, Este, Oeste)
    deltaN = np.zeros_like(img)
    deltaS = np.zeros_like(img)
    deltaE = np.zeros_like(img)
    deltaW = np.zeros_like(img)

    for _ in range(niter):
        deltaN[:-1, :] = img[1:, :] - img[:-1, :]
        deltaS[1:, :] = img[:-1, :] - img[1:, :]
        deltaE[:, :-1] = img[:, 1:] - img[:, :-1]
        deltaW[:, 1:] = img[:, :-1] - img[:, 1:]

        # Coeficientes de conducción
        if option == 1:
            cN = np.exp(-(deltaN / kappa) ** 2)
            cS = np.exp(-(deltaS / kappa) ** 2)
            cE = np.exp(-(deltaE / kappa) ** 2)
            cW = np.exp(-(deltaW / kappa) ** 2)
        else:
            cN = 1.0 / (1.0 + (deltaN / kappa) ** 2)
            cS = 1.0 / (1.0 + (deltaS / kappa) ** 2)
            cE = 1.0 / (1.0 + (deltaE / kappa) ** 2)
            cW = 1.0 / (1.0 + (deltaW / kappa) ** 2)

        img += gamma_val * (cN * deltaN + cS * deltaS + cE * deltaE + cW * deltaW)

    return img


def apply(image: np.ndarray, params: np.ndarray) -> np.ndarray:
    """Aplica difusión anisotrópica con el vector continuo ``params``.

    Parámetros
    ----------
    image : np.ndarray
        Imagen de entrada (uint8, canal único).
    params : np.ndarray
        [niter, kappa, gamma, option] — valores continuos que serán
        discretizados internamente.

    Retorna
    -------
    np.ndarray
        Imagen filtrada (uint8).
    """
    niter = max(1, int(round(params[0])))
    kappa = float(params[1])
    gamma_val = float(np.clip(params[2], 0.01, 0.25))
    option = 1 if params[3] < 1.5 else 2

    result = _perona_malik(image, niter, kappa, gamma_val, option)
    return result


def format_params(params: np.ndarray) -> str:
    """Representación legible de los parámetros."""
    niter = max(1, int(round(params[0])))
    option = 1 if params[3] < 1.5 else 2
    return (
        f"niter={niter}, kappa={params[1]:.2f}, "
        f"gamma={params[2]:.4f}, option={option}"
    )
