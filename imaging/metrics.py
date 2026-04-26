"""
Métricas de calidad de imagen.

Proporciona MSE y SNR para comparar una imagen filtrada contra la original
(ground truth).
"""

from __future__ import annotations

import numpy as np


def mse(original: np.ndarray, filtered: np.ndarray) -> float:
    """Error Cuadrático Medio (MSE) entre dos imágenes.

    Parámetros
    ----------
    original, filtered : np.ndarray
        Imágenes con la misma forma (uint8 o float).

    Retorna
    -------
    float
        Valor MSE (menor es mejor).
    """
    return float(np.mean((original.astype(np.float64) - filtered.astype(np.float64)) ** 2))


def snr(original: np.ndarray, filtered: np.ndarray) -> float:
    """Relación Señal a Ruido (SNR) en dB.

    SNR = 10 * log10( potencia_señal / potencia_ruido )

    donde potencia_señal = mean(original^2)
          potencia_ruido = mean((original - filtered)^2) = MSE

    Parámetros
    ----------
    original, filtered : np.ndarray
        Imágenes con la misma forma.

    Retorna
    -------
    float
        SNR en dB (mayor es mejor).
    """
    signal_power = float(np.mean(original.astype(np.float64) ** 2))
    noise_power = mse(original, filtered)
    if noise_power < 1e-10:
        return float("inf")
    return float(10 * np.log10(signal_power / noise_power))
