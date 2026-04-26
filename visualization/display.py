"""
Visualización de resultados usando matplotlib.

Muestra una única ventana con:
  - Fila superior: Imágenes Original | Con ruido | Optimizada
  - Inferior izquierda: Curva de convergencia (MSE vs iteración)
  - Inferior derecha: Métricas finales y mejores parámetros como texto
"""

from __future__ import annotations

import numpy as np
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec


def show_results(
    original: np.ndarray,
    noisy: np.ndarray,
    optimised: np.ndarray,
    convergence: list[float],
    metrics: dict[str, float],
    best_params_str: str,
    filter_name: str,
    metric_name: str = "MSE",
) -> None:
    """Muestra los resultados finales en una sola ventana de matplotlib.

    Parámetros
    ----------
    original : np.ndarray
        Imagen limpia original (escala de grises, uint8).
    noisy : np.ndarray
        Imagen con ruido (escala de grises, uint8).
    optimised : np.ndarray
        Imagen filtrada con parámetros optimizados (escala de grises, uint8).
    convergence : list[float]
        Valores MSE por iteración (curva de convergencia).
    metrics : dict[str, float]
        Métricas finales, ej. ``{"MSE": ..., "SNR": ...}``.
    best_params_str : str
        Mejores parámetros en formato legible.
    filter_name : str
        Nombre del filtro utilizado (para visualización).
    metric_name : str
        Nombre de la métrica optimizada ("MSE" o "SNR").
    """
    fig = plt.figure(figsize=(13, 8))
    fig.suptitle(
        f"OOA — Optimización de filtro {filter_name}",
        fontsize=14,
        fontweight="bold",
    )

    gs = gridspec.GridSpec(2, 3, height_ratios=[1, 1], hspace=0.35, wspace=0.25)

    # --- Fila superior: imágenes ---
    ax_orig = fig.add_subplot(gs[0, 0])
    ax_orig.imshow(original, cmap="gray", vmin=0, vmax=255)
    ax_orig.set_title("Original")
    ax_orig.axis("off")

    ax_noisy = fig.add_subplot(gs[0, 1])
    ax_noisy.imshow(noisy, cmap="gray", vmin=0, vmax=255)
    ax_noisy.set_title("Con ruido")
    ax_noisy.axis("off")

    ax_opt = fig.add_subplot(gs[0, 2])
    ax_opt.imshow(optimised, cmap="gray", vmin=0, vmax=255)
    ax_opt.set_title("Optimizada")
    ax_opt.axis("off")

    # --- Inferior izquierda: curva de convergencia ---
    ax_conv = fig.add_subplot(gs[1, 0:2])
    ax_conv.plot(convergence, color="#2563eb", linewidth=1.5)
    ax_conv.set_title("Curva de convergencia")
    ax_conv.set_xlabel("Iteración")
    ax_conv.set_ylabel(f"{metric_name} (costo)")
    
    # Si la métrica es MSE (baja), invertimos el eje Y para que se vea en ascenso
    if metric_name.upper() == "MSE":
        ax_conv.invert_yaxis()
        
    ax_conv.grid(True, alpha=0.3)

    # --- Inferior derecha: texto de métricas ---
    ax_text = fig.add_subplot(gs[1, 2])
    ax_text.axis("off")

    text_lines = [
        f"Filtro: {filter_name}",
        "",
        "── Métricas finales ──",
    ]
    for name, value in metrics.items():
        if isinstance(value, float):
            text_lines.append(f"  {name}: {value:.4f}")
        else:
            text_lines.append(f"  {name}: {value}")

    text_lines += [
        "",
        "── Mejores parámetros ──",
        f"  {best_params_str}",
    ]

    ax_text.text(
        0.05,
        0.95,
        "\n".join(text_lines),
        transform=ax_text.transAxes,
        fontsize=11,
        verticalalignment="top",
        fontfamily="monospace",
        bbox=dict(boxstyle="round,pad=0.5", facecolor="#f0f0f0", alpha=0.8),
    )

    plt.tight_layout(rect=[0, 0, 1, 0.95])
    plt.show()
