#!/usr/bin/env python3
"""
Optimizador de Filtros de Imagen OOA — Punto de Entrada CLI

Uso:
    python main.py <ruta_imagen> [--filter bilateral|anisotropic|nlmeans]
                                 [--noise-sigma 25]
                                 [--population 30]
                                 [--iterations 50]

Carga una imagen, la degrada con ruido gaussiano, luego usa el Algoritmo de
Optimización del Pulpo (OOA) para encontrar los parámetros óptimos del filtro
que minimicen el MSE o maximicen el SNR entre la imagen filtrada y la original.
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from typing import Callable

import cv2
import numpy as np
from skimage.restoration import estimate_sigma

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from algorithms.ooa.algorithm import ooa
from imaging.noise import add_gaussian_noise, add_salt_and_pepper_noise
from imaging.metrics import mse, snr, piqe
from filters import bilateral, anisotropic, nlmeans
from visualization.display import show_results


def _non_negative_float(value: str) -> float:
    parsed = float(value)
    if parsed < 0.0 or not np.isfinite(parsed):
        raise argparse.ArgumentTypeError("debe ser un número finito mayor o igual a 0")
    return parsed


def _unit_interval_float(value: str) -> float:
    parsed = float(value)
    if not 0.0 <= parsed <= 1.0:
        raise argparse.ArgumentTypeError("debe estar entre 0 y 1")
    return parsed


def _min_int(minimum: int) -> Callable[[str], int]:
    def parse(value: str) -> int:
        parsed = int(value)
        if parsed < minimum:
            raise argparse.ArgumentTypeError(f"debe ser un entero mayor o igual a {minimum}")
        return parsed

    return parse


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
        choices=["bilateral", "anisotropic", "nlmeans"],
        default="bilateral",
        help="Tipo de filtro a optimizar (default: bilateral)",
    )
    parser.add_argument(
        "--metric",
        type=str,
        choices=["mse", "snr", "piqe"],
        default="mse",
        help="Métrica a optimizar: 'mse' (minimizar), 'snr' (maximizar) o 'piqe' (minimizar, no-referencia) (default: mse)",
    )
    parser.add_argument(
        "--noise-type",
        type=str,
        choices=["gaussian", "sp"],
        default="gaussian",
        help="Tipo de ruido a aplicar: 'gaussian' o 'sp' (sal y pimienta) (default: gaussian)",
    )
    parser.add_argument(
        "--noise-amount",
        type=_unit_interval_float,
        default=0.05,
        help="Proporción para ruido sal y pimienta (default: 0.05)",
    )
    parser.add_argument(
        "--noise-sigma",
        type=_non_negative_float,
        default=25.0,
        help="Desviación estándar del ruido gaussiano (default: 25)",
    )
    parser.add_argument(
        "--population",
        type=_min_int(9),
        default=30,
        help="Tamaño de la población OOA (default: 30)",
    )
    parser.add_argument(
        "--iterations",
        type=_min_int(1),
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
    if args.noise_type == "gaussian":
        noisy = add_gaussian_noise(image, sigma=args.noise_sigma, rng=rng)
        noise_info = f"Gaussiano (sigma={args.noise_sigma})"
    else:
        noisy = add_salt_and_pepper_noise(image, amount=args.noise_amount, rng=rng)
        noise_info = f"Sal y Pimienta (proporción={args.noise_amount})"
    
    # Conversión a float32 para evaluación sub-píxel de OOA
    image_f32 = image.astype(np.float32)
    noisy_f32 = noisy.astype(np.float32)

    noisy_mse = mse(image, noisy)
    noisy_snr = snr(image, noisy)
    noisy_piqe = piqe(noisy)
    print(f"Ruido añadido: {noise_info}  ->  MSE={noisy_mse:.2f}, SNR={noisy_snr:.2f} dB, PIQE={noisy_piqe:.2f}")

    # --- Seleccionar módulo de filtro ---
    if args.filter == "bilateral":
        filter_mod = bilateral
        filter_name = "Bilateral"
    elif args.filter == "anisotropic":
        filter_mod = anisotropic
        filter_name = "Difusión Anisotrópica (Perona-Malik)"
    else:
        filter_mod = nlmeans
        filter_name = "Non-Local Means"

    lb = filter_mod.LOWER_BOUNDS.copy()
    ub = filter_mod.UPPER_BOUNDS.copy()
    dim = filter_mod.DIM

    # --- Estimación dinámica de límites ---
    if args.noise_type == "gaussian":
        try:
            ruido_estimado = estimate_sigma(noisy_f32, channel_axis=None)
        except TypeError:
            # Fallback para versiones antiguas de skimage
            ruido_estimado = estimate_sigma(noisy_f32, multichannel=False)
        print(f"Ruido estimado en la imagen: {ruido_estimado:.2f}")
    else:
        # estimate_sigma no funciona bien con ruido impulsivo (sal y pimienta)
        # Usamos un valor virtual basado en la proporción para que los límites no colapsen
        ruido_estimado = args.noise_amount * 1000.0  # Heurística simple
        print(f"Ruido Sal y Pimienta detectado. Desactivando restricción estricta de límites.")

    if args.filter == "bilateral":
        # Ajustar sigmaColor (idx 1) y sigmaSpace (idx 2)
        lb[1] = max(10.0, ruido_estimado * 0.5)
        ub[1] = max(lb[1] + 10.0, min(200.0, ruido_estimado * 3.0))
        lb[2] = max(10.0, ruido_estimado * 0.5)
        ub[2] = max(lb[2] + 10.0, min(200.0, ruido_estimado * 3.0))
    elif args.filter == "anisotropic":
        # Ajustar kappa (idx 1)
        lb[1] = max(10.0, ruido_estimado * 0.5)
        ub[1] = max(lb[1] + 10.0, min(100.0, ruido_estimado * 3.0))

    print(f"\nFiltro: {filter_name}")
    print(f"Espacio de búsqueda: {dim}D")
    print(f"  Límites inf: {lb}")
    print(f"  Límites sup: {ub}")
    print(f"  Parámetros:  {filter_mod.PARAM_NAMES}")

    # --- Función objetivo ---
    def objective(params: np.ndarray) -> float:
        """Aplica el filtro con los parámetros dados y retorna el costo (MSE, -SNR o PIQE)."""
        filtered = filter_mod.apply(noisy_f32, params)
        if args.metric == "snr":
            # OOA minimiza, por lo que para maximizar SNR retornamos su negativo
            return -snr(image_f32, filtered)
        elif args.metric == "piqe":
            # PIQE podría necesitar valores en [0, 255]
            return piqe(np.clip(filtered, 0, 255).astype(np.uint8))
        else:
            return mse(image_f32, filtered)

    # --- Callback para reportar por iteración ---
    def on_iteration(iteration: int, best_cost: float, best_pos: np.ndarray) -> None:
        elapsed = time.time() - start_time
        params_str = filter_mod.format_params(best_pos)

        filtered_best = filter_mod.apply(noisy_f32, best_pos)
        current_mse = mse(image_f32, filtered_best)
        current_snr = snr(image_f32, filtered_best)
        # PIQE sigue necesita formato uint8 [0,255]
        current_piqe = piqe(np.clip(filtered_best, 0, 255).astype(np.uint8))

        cost_str = f"{-best_cost if args.metric == 'snr' else best_cost:>10.4f}"

        print(
            f"  Iter {iteration:>3d}/{args.iterations}  |  "
            f"MSE={current_mse:>10.4f}  |  SNR={current_snr:>7.2f} dB  |  PIQE={current_piqe:>6.2f}  |  "
            f"Costo={cost_str}  |  "
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
        rng=rng,
    )
    total_time = time.time() - start_time

    print("=" * 90)
    print(f"\nOptimización completada en {total_time:.1f}s")

    # --- Resultados finales ---
    best_filtered = filter_mod.apply(noisy_f32, best_pos)
    best_filtered_uint8 = np.clip(best_filtered, 0, 255).astype(np.uint8)
    final_mse = mse(image_f32, best_filtered)
    final_snr = snr(image_f32, best_filtered)
    final_piqe = piqe(best_filtered_uint8)
    params_str = filter_mod.format_params(best_pos)

    def percent_change(delta: float, baseline: float) -> float | None:
        if baseline == 0.0 or not np.isfinite(baseline):
            return None

        value = delta / baseline * 100
        if not np.isfinite(value):
            return None
        return float(value)

    if args.metric == "snr":
        improvement_pct = percent_change(final_snr - noisy_snr, abs(noisy_snr))
        improvement_label = "Mejora SNR"
    elif args.metric == "piqe":
        improvement_pct = percent_change(noisy_piqe - final_piqe, noisy_piqe)
        improvement_label = "Mejora PIQE"
    else:
        improvement_pct = percent_change(noisy_mse - final_mse, noisy_mse)
        improvement_label = "Mejora MSE"
    improvement_value = improvement_pct if improvement_pct is not None else "N/A"
    improvement_text = f"{improvement_pct:.1f}%" if improvement_pct is not None else "N/A"

    print(f"\n{'-' * 50}")
    print(f"  RESULTADOS FINALES")
    print(f"{'-' * 50}")
    print(f"  MSE  (con ruido):     {noisy_mse:.4f}")
    print(f"  MSE  (optimizado):    {final_mse:.4f}")
    print(f"  SNR  (con ruido):     {noisy_snr:.2f} dB")
    print(f"  SNR  (optimizado):    {final_snr:.2f} dB")
    print(f"  PIQE (con ruido):     {noisy_piqe:.2f}")
    print(f"  PIQE (optimizado):    {final_piqe:.2f}")
    print(f"  Mejores parámetros:   {params_str}")
    print(f"  {improvement_label}:           {improvement_text}")
    print(f"{'-' * 50}\n")

    # --- Mostrar ---
    metrics = {
        "Métrica Objetivo": args.metric.upper(),
        "MSE (con ruido)": noisy_mse,
        "MSE (optimizado)": final_mse,
        "SNR (con ruido) [dB]": noisy_snr,
        "SNR (optimizado) [dB]": final_snr,
        "PIQE (con ruido)": noisy_piqe,
        "PIQE (optimizado)": final_piqe,
        f"{improvement_label} [%]": improvement_value,
    }
    
    # Si optimizamos SNR, el costo que grafica OOA es negativo.
    # Lo invertimos para visualizar la subida del SNR.
    if args.metric == "snr":
        convergence = [-c for c in convergence]

    show_results(
        original=image,
        noisy=noisy,
        optimised=best_filtered_uint8,
        convergence=convergence,
        metrics=metrics,
        best_params_str=params_str,
        filter_name=filter_name,
        metric_name=args.metric.upper(),
    )


if __name__ == "__main__":
    main()
