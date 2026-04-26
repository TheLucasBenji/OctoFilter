#!/usr/bin/env python3
"""
Optimizador de Filtros de Imagen OOA — Punto de Entrada CLI

Uso:
    python main.py <ruta_imagen> [--filter bilateral|anisotropic]
                                 [--noise-sigma 25]
                                 [--population 30]
                                 [--iterations 50]

Carga una imagen, la degrada con ruido gaussiano, luego usa el Algoritmo de
Optimización del Pulpo (OOA) para encontrar los parámetros óptimos del filtro
que minimicen el MSE entre la imagen filtrada y la original.
"""

from __future__ import annotations

import argparse
import sys
import time

import cv2
import numpy as np

from ooa.algorithm import ooa
from imaging.noise import add_gaussian_noise
from imaging.metrics import mse, snr
from filters import bilateral, anisotropic
from visualization.display import show_results


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Optimización de parámetros de filtros de imagen mediante OOA",
    )
    parser.add_argument(
        "image",
        type=str,
        help="Ruta a la imagen de entrada",
    )
    parser.add_argument(
        "--filter",
        type=str,
        choices=["bilateral", "anisotropic"],
        default="bilateral",
        help="Tipo de filtro a optimizar (default: bilateral)",
    )
    parser.add_argument(
        "--noise-sigma",
        type=float,
        default=25.0,
        help="Desviación estándar del ruido gaussiano (default: 25)",
    )
    parser.add_argument(
        "--population",
        type=int,
        default=30,
        help="Tamaño de la población OOA (default: 30)",
    )
    parser.add_argument(
        "--iterations",
        type=int,
        default=50,
        help="Número máximo de iteraciones OOA (default: 50)",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=None,
        help="Semilla para reproducibilidad (default: None)",
    )
    return parser


def main() -> None:
    args = build_parser().parse_args()

    # --- Reproducibilidad ---
    if args.seed is not None:
        np.random.seed(args.seed)
        rng = np.random.default_rng(args.seed)
    else:
        rng = np.random.default_rng()

    # --- Cargar imagen ---
    image = cv2.imread(args.image, cv2.IMREAD_GRAYSCALE)
    if image is None:
        print(f"Error: no se pudo cargar la imagen '{args.image}'", file=sys.stderr)
        sys.exit(1)

    print(f"Imagen cargada: {args.image}  ({image.shape[1]}x{image.shape[0]} px)")

    # --- Añadir ruido ---
    noisy = add_gaussian_noise(image, sigma=args.noise_sigma, rng=rng)
    noisy_mse = mse(image, noisy)
    noisy_snr = snr(image, noisy)
    print(f"Ruido añadido (σ={args.noise_sigma})  →  MSE={noisy_mse:.2f}, SNR={noisy_snr:.2f} dB")

    # --- Seleccionar módulo de filtro ---
    if args.filter == "bilateral":
        filter_mod = bilateral
        filter_name = "Bilateral"
    else:
        filter_mod = anisotropic
        filter_name = "Difusión Anisotrópica (Perona-Malik)"

    lb = filter_mod.LOWER_BOUNDS
    ub = filter_mod.UPPER_BOUNDS
    dim = filter_mod.DIM

    print(f"\nFiltro: {filter_name}")
    print(f"Espacio de búsqueda: {dim}D")
    print(f"  Límites inf: {lb}")
    print(f"  Límites sup: {ub}")
    print(f"  Parámetros:  {filter_mod.PARAM_NAMES}")

    # --- Función objetivo ---
    def objective(params: np.ndarray) -> float:
        """Aplica el filtro con los parámetros dados y retorna el MSE frente a la original."""
        filtered = filter_mod.apply(noisy, params)
        return mse(image, filtered)

    # --- Callback para reportar por iteración ---
    def on_iteration(iteration: int, best_cost: float, best_pos: np.ndarray) -> None:
        elapsed = time.time() - start_time
        params_str = filter_mod.format_params(best_pos)
        filtered_best = filter_mod.apply(noisy, best_pos)
        current_snr = snr(image, filtered_best)
        print(
            f"  Iter {iteration:>3d}/{args.iterations}  |  "
            f"MSE={best_cost:>10.4f}  |  SNR={current_snr:>7.2f} dB  |  "
            f"Params: {params_str}  |  "
            f"t={elapsed:.1f}s"
        )

    # --- Ejecutar OOA ---
    print(f"\nIniciando OOA (población={args.population}, iteraciones={args.iterations})...")
    print("=" * 90)

    start_time = time.time()
    best_cost, best_pos, convergence = ooa(
        n_population=args.population,
        max_iter=args.iterations,
        lb=lb,
        ub=ub,
        dim=dim,
        objective_fn=objective,
        on_iteration=on_iteration,
    )
    total_time = time.time() - start_time

    print("=" * 90)
    print(f"\nOptimización completada en {total_time:.1f}s")

    # --- Resultados finales ---
    best_filtered = filter_mod.apply(noisy, best_pos)
    final_mse = mse(image, best_filtered)
    final_snr = snr(image, best_filtered)
    params_str = filter_mod.format_params(best_pos)

    print(f"\n{'─' * 50}")
    print(f"  RESULTADOS FINALES")
    print(f"{'─' * 50}")
    print(f"  MSE  (con ruido):     {noisy_mse:.4f}")
    print(f"  MSE  (optimizado):    {final_mse:.4f}")
    print(f"  SNR  (con ruido):     {noisy_snr:.2f} dB")
    print(f"  SNR  (optimizado):    {final_snr:.2f} dB")
    print(f"  Mejores parámetros:   {params_str}")
    print(f"  Mejora MSE:           {((noisy_mse - final_mse) / noisy_mse * 100):.1f}%")
    print(f"{'─' * 50}\n")

    # --- Mostrar ---
    metrics = {
        "MSE (con ruido)": noisy_mse,
        "MSE (optimizado)": final_mse,
        "SNR (con ruido) [dB]": noisy_snr,
        "SNR (optimizado) [dB]": final_snr,
        "Mejora MSE [%]": (noisy_mse - final_mse) / noisy_mse * 100,
    }

    show_results(
        original=image,
        noisy=noisy,
        optimised=best_filtered,
        convergence=convergence,
        metrics=metrics,
        best_params_str=params_str,
        filter_name=filter_name,
    )


if __name__ == "__main__":
    main()
