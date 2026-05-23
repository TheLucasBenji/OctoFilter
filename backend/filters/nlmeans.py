"""
Envoltorio del filtro Non-Local Means para cv2.fastNlMeansDenoising.

Parámetros a optimizar (3 dimensiones):
    x[0]  →  h                  (fuerza del filtro), float en [1.0, 30.0]
    x[1]  →  templateWindowSize (tamaño del parche de comparación), int impar en [3, 11]
    x[2]  →  searchWindowSize   (tamaño de la ventana de búsqueda), int impar en [7, 35]

Restricción inter-parámetros: searchWindowSize > templateWindowSize.
Se aplica internamente forzando search >= template + 2 (y ajustando a impar si es necesario).
"""

from __future__ import annotations

import numpy as np
import cv2


# Límites del espacio de búsqueda ---------------------------------------------
LOWER_BOUNDS = np.array([1.0,  3.0,  7.0])
UPPER_BOUNDS = np.array([30.0, 11.0, 35.0])
DIM = 3
PARAM_NAMES = ["h (fuerza)", "templateWindowSize", "searchWindowSize"]


def _odd_int(val: float, min_val: int = 1) -> int:
    """Convierte un valor continuo a un entero impar válido para OpenCV."""
    v = int(round(val))
    if v < min_val:
        v = min_val
    if v % 2 == 0:
        v += 1
    return v


def apply(image: np.ndarray, params: np.ndarray) -> np.ndarray:
    """Aplica Non-Local Means con el vector continuo ``params``.

    Parámetros
    ----------
    image : np.ndarray
        Imagen de entrada (uint8, canal único).
    params : np.ndarray
        [h, templateWindowSize, searchWindowSize] — valores continuos que serán
        discretizados internamente.

    Retorna
    -------
    np.ndarray
        Imagen filtrada (uint8, mismo tamaño que la entrada).
    """
    h = float(np.clip(params[0], 0.1, None))
    template = _odd_int(params[1], min_val=3)
    search = _odd_int(params[2], min_val=template + 2)

    # fastNlMeansDenoising solo soporta CV_8U
    if image.dtype != np.uint8:
        image_uint8 = np.clip(image, 0, 255).astype(np.uint8)
    else:
        image_uint8 = image

    result = cv2.fastNlMeansDenoising(image_uint8, None, h, template, search)
    return result.astype(np.float32)


def format_params(params: np.ndarray) -> str:
    """Representación legible para humanos de los parámetros."""
    h = float(np.clip(params[0], 0.1, None))
    template = _odd_int(params[1], min_val=3)
    search = _odd_int(params[2], min_val=template + 2)
    return f"h={h:.2f}, template={template}, search={search}"