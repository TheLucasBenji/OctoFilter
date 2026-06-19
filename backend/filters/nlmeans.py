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
PARAM_METADATA = [
    {
        "key": "h",
        "display_name": "h · Filtering strength",
        "scientific_name": "Filtering strength",
        "symbol": "h",
        "common_name": "h",
        "aliases": ["denoising strength", "filter strength", "smoothing parameter"],
        "description": "Parámetro de suavizado que controla la fuerza de filtrado de Non-Local Means.",
    },
    {
        "key": "templateWindowSize",
        "display_name": "Patch size · templateWindowSize",
        "scientific_name": "Patch size",
        "symbol": "T",
        "common_name": "templateWindowSize",
        "aliases": ["patch size", "template window", "patch comparison window"],
        "description": "Tamaño del parche usado para comparar similitud entre regiones.",
    },
    {
        "key": "searchWindowSize",
        "display_name": "Search window size · searchWindowSize",
        "scientific_name": "Search window size",
        "symbol": "S",
        "common_name": "searchWindowSize",
        "aliases": ["search window", "search area", "non-local search window"],
        "description": "Tamaño de la ventana donde se buscan parches similares.",
    },
]


def _finite_float(val: float, fallback: float) -> float:
    try:
        number = float(val)
    except (TypeError, ValueError):
        return fallback
    return number if np.isfinite(number) else fallback


def _odd_int(val: float, min_val: int = 1, max_val: int | None = None) -> int:
    """Convierte un valor continuo a un entero impar válido para OpenCV."""
    number = _finite_float(val, float(min_val))
    if max_val is not None:
        number = float(np.clip(number, min_val, max_val))

    v = int(round(number))
    if v < min_val:
        v = min_val
    if max_val is not None and v > max_val:
        v = max_val
    if v % 2 == 0:
        if max_val is not None and v + 1 > max_val:
            v -= 1
        else:
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
    h = float(np.clip(_finite_float(params[0], LOWER_BOUNDS[0]), LOWER_BOUNDS[0], UPPER_BOUNDS[0]))
    template = _odd_int(params[1], min_val=3, max_val=int(UPPER_BOUNDS[1]))
    search = _odd_int(params[2], min_val=template + 2, max_val=int(UPPER_BOUNDS[2]))

    # fastNlMeansDenoising solo soporta CV_8U
    if image.dtype != np.uint8:
        image_uint8 = np.clip(image, 0, 255).astype(np.uint8)
    else:
        image_uint8 = image

    result = cv2.fastNlMeansDenoising(image_uint8, None, h, template, search)
    return result.astype(np.float32)


def format_params(params: np.ndarray) -> str:
    """Representación legible para humanos de los parámetros."""
    h = float(np.clip(_finite_float(params[0], LOWER_BOUNDS[0]), LOWER_BOUNDS[0], UPPER_BOUNDS[0]))
    template = _odd_int(params[1], min_val=3, max_val=int(UPPER_BOUNDS[1]))
    search = _odd_int(params[2], min_val=template + 2, max_val=int(UPPER_BOUNDS[2]))
    return f"h={h:.2f}, template={template}, search={search}"
