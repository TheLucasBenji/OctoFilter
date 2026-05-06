"""
Utilidades de inyección de ruido.

Añade ruido controlado a las imágenes para probar la optimización de filtros.
"""

from __future__ import annotations

import numpy as np
from skimage.util import random_noise


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
    sigma = float(sigma)
    if sigma < 0.0 or not np.isfinite(sigma):
        raise ValueError("sigma debe ser un valor finito mayor o igual a 0")

    if rng is None:
        rng = np.random.default_rng()

    noise = rng.normal(0, sigma, image.shape)
    noisy = image.astype(np.float64) + noise
    return np.clip(noisy, 0, 255).astype(np.uint8)


def add_salt_and_pepper_noise(
    image: np.ndarray,
    amount: float = 0.05,
    rng: np.random.Generator | int | None = None,
) -> np.ndarray:
    """Añade ruido sal y pimienta a una imagen.

    Parámetros
    ----------
    image : np.ndarray
        Imagen de entrada.
    amount : float
        Proporción de píxeles a reemplazar por ruido (default: 0.05).
    rng : np.random.Generator, int, optional
        Semilla para reproducibilidad.

    Retorna
    -------
    np.ndarray
        Imagen con ruido (uint8), restringida a [0, 255].
    """
    amount = float(amount)
    if not 0.0 <= amount <= 1.0:
        raise ValueError("amount debe estar entre 0 y 1")

    if amount == 0.0:
        return image.copy()

    # random_noise devuelve float en rango [0, 1]
    noisy = random_noise(image, mode='s&p', amount=amount, rng=rng)
    return np.rint(np.clip(noisy * 255, 0, 255)).astype(np.uint8)
