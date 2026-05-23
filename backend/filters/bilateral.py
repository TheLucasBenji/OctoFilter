"""
Envoltorio de filtro bilateral para cv2.bilateralFilter.

Parámetros a optimizar (3 dimensiones):
    x[0]  ->  d        (diámetro de la vecindad de píxeles), int en [3, 15], impar
    x[1]  ->  sigmaColor  (sigma del filtro en el espacio de color), float en [10, 200]
    x[2]  ->  sigmaSpace  (sigma del filtro en el espacio de coordenadas), float en [10, 200]
"""

from __future__ import annotations

import numpy as np
import cv2


# Límites del espacio de búsqueda ---------------------------------------------
LOWER_BOUNDS = np.array([3.0, 10.0, 10.0])
UPPER_BOUNDS = np.array([15.0, 200.0, 200.0])
DIM = 3
PARAM_NAMES = ["d (diameter)", "sigma Color", "sigma Space"]


def _get_d(val: float) -> int:
    """Extrae y formatea el parámetro de diámetro para que sea válido."""
    d = int(round(val))
    if d < 1:
        d = 1
    if d % 2 == 0:
        d += 1
    return d


def apply(image: np.ndarray, params: np.ndarray) -> np.ndarray:
    """Aplica el filtro bilateral con el vector continuo ``params``.

    Parámetros
    ----------
    image : np.ndarray
        Imagen de entrada (uint8, canal único o BGR).
    params : np.ndarray
        [d, sigmaColor, sigmaSpace] — valores continuos que serán
        discretizados internamente.

    Retorna
    -------
    np.ndarray
        Imagen filtrada (mismo dtype que la entrada).
    """
    d = _get_d(params[0])
    sigma_color = float(params[1])
    sigma_space = float(params[2])

    return cv2.bilateralFilter(image, d, sigma_color, sigma_space)


def format_params(params: np.ndarray) -> str:
    """Representación legible para humanos de los parámetros."""
    d = _get_d(params[0])
    return f"d={d}, sigmaColor={params[1]:.2f}, sigmaSpace={params[2]:.2f}"
