"""
Métricas de calidad de imagen.

Proporciona MSE y SNR (full-reference) y PIQE (no-referencia) para evaluar
la calidad de imágenes filtradas.
"""

from __future__ import annotations

import numpy as np
from pypiqe import piqe as _piqe_impl


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


def piqe(image: np.ndarray) -> float:
    """Perception-based Image Quality Evaluator (PIQE), métrica no-referencia.

    Estima la calidad perceptual de una imagen sin requerir una referencia
    limpia. Divide la imagen en bloques de 16×16, identifica los activos
    (alto gradiente espacial) y cuantifica artefactos visibles y ruido.

    Parámetros
    ----------
    image : np.ndarray
        Imagen en escala de grises uint8 (mínimo 16×16 px).

    Retorna
    -------
    float
        PIQE en [0, 100] — menor es mejor (0 = mayor calidad perceptual).

    Referencia
    ----------
    Venkatanath, N., Praneeth, D., Chandrasekhar Bh., M.,
    Channappayya, S. S., & Medasani, S. S. (2015).
    "Blind Image Quality Evaluation Using Perception Based Features."
    21st National Conference on Communications (NCC), IEEE.
    DOI: 10.1109/NCC.2015.7084843
    """
    score, _, _, _ = _piqe_impl(image)
    return float(score)
