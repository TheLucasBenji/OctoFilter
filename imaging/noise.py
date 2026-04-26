"""
Utilidades de inyección de ruido.

Añade ruido controlado a las imágenes para probar la optimización de filtros.
"""

from __future__ import annotations

import numpy as np


def add_gaussian_noise(
    image: np.ndarray,
    sigma: float = 25.0,
    rng: np.random.Generator | None = None,
) -> np.ndarray:
    """Añade ruido gaussiano aditivo a una imagen.

    Parámetros
    ----------
    image : np.ndarray
        Imagen de entrada (uint8).
    sigma : float
        Desviación estándar del ruido gaussiano.
    rng : np.random.Generator, optional
        Generador de números aleatorios para reproducibilidad.

    Retorna
    -------
    np.ndarray
        Imagen con ruido (uint8), restringida a [0, 255].
    """
    if rng is None:
        rng = np.random.default_rng()

    noise = rng.normal(0, sigma, image.shape)
    noisy = image.astype(np.float64) + noise
    return np.clip(noisy, 0, 255).astype(np.uint8)
