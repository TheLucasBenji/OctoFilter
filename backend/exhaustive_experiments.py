#!/usr/bin/env python3
"""Exhaustive baseline runner for discretized filter-parameter spaces."""

from __future__ import annotations

import argparse
import csv
import json
import logging
import math
import os
import sys
import time
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable

import cv2
import numpy as np

BACKEND_DIR = Path(__file__).resolve().parent
REPO_ROOT = BACKEND_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))

from batch_experiments import (
    DEFAULT_FILTERS,
    DEFAULT_IMAGES,
    DEFAULT_METRICS,
    DEFAULT_NOISE,
    DEFAULT_SEED,
    NoiseSpec,
    bounded_int,
    compute_improvement,
    finite_or_none,
    fmt_mean_std,
    json_safe,
    latex_escape,
    make_noisy_image,
    mean_std,
    parse_noise_spec,
    repetition_seed,
    report_metric_order,
    resolve_image_path,
    search_space_size,
)
from imaging import metrics as img_metrics
from main import FILTER_LABELS, FILTER_MODULES, _adjusted_bounds


DEFAULT_EXHAUSTIVE_REPETITIONS = 3
METHOD = "exhaustive"
METHOD_LABEL = "Exhaustiva"
REPORT_METHOD_ORDER = {METHOD: 0}

SUMMARY_FIELDS = [
    "run_index",
    "status",
    "repetition",
    "image",
    "filter",
    "noise",
    "noise_type",
    "noise_sigma",
    "noise_amount",
    "metric",
    "method",
    "seed",
    "duration_ms",
    "global_space_size",
    "effective_space_size",
    "evaluated_candidates",
    "truncated",
    "best_candidate_index",
    "best_cost",
    "noisy_snr",
    "snr",
    "noisy_piqe",
    "piqe",
    "noisy_mse",
    "mse",
    "improvement_value",
    "improvement_percent",
    "params_json",
    "error",
]

AVERAGE_FIELDS = [
    "filter",
    "image",
    "noise",
    "noise_type",
    "noise_sigma",
    "noise_amount",
    "metric",
    "method",
    "repetitions",
    "duration_ms_mean",
    "duration_ms_std",
    "global_space_size_mean",
    "global_space_size_std",
    "effective_space_size_mean",
    "effective_space_size_std",
    "evaluated_candidates_mean",
    "evaluated_candidates_std",
    "best_cost_mean",
    "best_cost_std",
    "noisy_snr_mean",
    "noisy_snr_std",
    "snr_mean",
    "snr_std",
    "noisy_piqe_mean",
    "noisy_piqe_std",
    "piqe_mean",
    "piqe_std",
    "noisy_mse_mean",
    "noisy_mse_std",
    "mse_mean",
    "mse_std",
    "improvement_value_mean",
    "improvement_value_std",
    "improvement_percent_mean",
    "improvement_percent_std",
]


@dataclass
class BestCandidate:
    params: np.ndarray | None = None
    metric_value: float | None = None
    cost: float | None = None
    candidate_index: int | None = None


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Ejecuta busqueda exhaustiva sobre espacios discretizados de filtros.",
    )
    parser.add_argument(
        "--images",
        nargs="+",
        default=DEFAULT_IMAGES,
        help="Imagenes a procesar (default: lena.png cameraman.png barbara.png)",
    )
    parser.add_argument(
        "--noise",
        nargs="+",
        type=parse_noise_spec,
        default=[parse_noise_spec(spec) for spec in DEFAULT_NOISE],
        help="Niveles de ruido, formato gaussian:<sigma> o sp:<amount>",
    )
    parser.add_argument(
        "--filters",
        nargs="+",
        choices=sorted(FILTER_MODULES.keys()),
        default=DEFAULT_FILTERS,
        help="Filtros a recorrer exhaustivamente",
    )
    parser.add_argument(
        "--metrics",
        nargs="+",
        choices=["mse", "snr", "piqe"],
        default=DEFAULT_METRICS,
        help="Metricas objetivo (default: mse snr piqe)",
    )
    parser.add_argument(
        "--repetitions",
        default=DEFAULT_EXHAUSTIVE_REPETITIONS,
        type=bounded_int("repetitions", 1, 10_000),
        help="Realizaciones de ruido por combinacion (default: 3)",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=DEFAULT_SEED,
        help="Semilla base para generar ruido comparable al batch metaheuristico",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help="Directorio para summary.csv, averages.csv, runs.json, summary.md, progress.log y latex/",
    )
    parser.add_argument(
        "--max-candidates",
        type=bounded_int("max-candidates", 1, 10_000_000),
        default=None,
        help="Limita candidatos por busqueda solo para pruebas rapidas; no usar para resultados finales",
    )
    parser.add_argument(
        "--continue-on-error",
        action="store_true",
        help="Registra errores y continua con la siguiente busqueda",
    )
    return parser


def default_output_dir() -> Path:
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return BACKEND_DIR / "data" / "exhaustive_batches" / stamp


def setup_logging(output_dir: Path) -> logging.Logger:
    output_dir.mkdir(parents=True, exist_ok=True)
    logger = logging.getLogger("exhaustive_experiments")
    logger.handlers.clear()
    logger.setLevel(logging.INFO)
    logger.propagate = False

    formatter = logging.Formatter("%(asctime)s | %(levelname)s | %(message)s")
    file_handler = logging.FileHandler(output_dir / "progress.log", encoding="utf-8")
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(console_handler)

    return logger


def int_values(low: float, high: float) -> list[int]:
    start = int(math.ceil(float(low)))
    stop = int(math.floor(float(high)))
    if stop < start:
        return []
    return list(range(start, stop + 1))


def odd_values(low: float, high: float) -> list[int]:
    values = int_values(low, high)
    return [value for value in values if value % 2 == 1]


def gamma_values(low: float, high: float) -> list[float]:
    values: list[float] = []
    for raw in range(5, 26):
        value = raw / 100.0
        if float(low) <= value <= float(high):
            values.append(value)
    return values


def exhaustive_candidate_count(filter_type: str, lb: np.ndarray, ub: np.ndarray) -> int:
    if filter_type == "bilateral":
        return (
            len(odd_values(lb[0], ub[0]))
            * len(int_values(lb[1], ub[1]))
            * len(int_values(lb[2], ub[2]))
        )

    if filter_type == "anisotropic":
        return (
            len(int_values(lb[0], ub[0]))
            * len(int_values(lb[1], ub[1]))
            * len(gamma_values(lb[2], ub[2]))
            * len(int_values(lb[3], ub[3]))
        )

    if filter_type == "nlmeans":
        h_values = int_values(lb[0], ub[0])
        templates = odd_values(lb[1], ub[1])
        searches = odd_values(lb[2], ub[2])
        return sum(
            len(h_values)
            for template in templates
            for search in searches
            if search >= template + 2
        )

    raise ValueError(f"No hay generador exhaustivo para el filtro '{filter_type}'")


def iter_candidate_params(filter_type: str, lb: np.ndarray, ub: np.ndarray) -> Iterable[np.ndarray]:
    if filter_type == "bilateral":
        for d in odd_values(lb[0], ub[0]):
            for sigma_color in int_values(lb[1], ub[1]):
                for sigma_space in int_values(lb[2], ub[2]):
                    yield np.array([d, sigma_color, sigma_space], dtype=float)
        return

    if filter_type == "anisotropic":
        for niter in int_values(lb[0], ub[0]):
            for kappa in int_values(lb[1], ub[1]):
                for gamma in gamma_values(lb[2], ub[2]):
                    for option in int_values(lb[3], ub[3]):
                        yield np.array([niter, kappa, gamma, option], dtype=float)
        return

    if filter_type == "nlmeans":
        h_values = int_values(lb[0], ub[0])
        templates = odd_values(lb[1], ub[1])
        searches = odd_values(lb[2], ub[2])
        for h in h_values:
            for template in templates:
                for search in searches:
                    if search >= template + 2:
                        yield np.array([h, template, search], dtype=float)
        return

    raise ValueError(f"No hay generador exhaustivo para el filtro '{filter_type}'")


def objective_cost(metric: str, value: float | None) -> float | None:
    if value is None or not math.isfinite(value):
        return None
    if metric == "snr":
        return -value
    return value


def is_better(metric: str, value: float | None, best_value: float | None) -> bool:
    if value is None or not math.isfinite(value):
        return False
    if best_value is None:
        return True
    if metric == "snr":
        return value > best_value
    return value < best_value


def evaluate_requested_metrics(
    original_f32: np.ndarray,
    filtered: np.ndarray,
    requested_metrics: set[str],
) -> dict[str, float | None]:
    values: dict[str, float | None] = {}
    if "mse" in requested_metrics:
        values["mse"] = float(img_metrics.mse(original_f32, filtered))
    if "snr" in requested_metrics:
        values["snr"] = float(img_metrics.snr(original_f32, filtered))
    if "piqe" in requested_metrics:
        try:
            values["piqe"] = float(img_metrics.piqe(np.clip(filtered, 0, 255).astype(np.uint8)))
        except Exception:
            values["piqe"] = None
    return values


def evaluate_all_metrics(original_f32: np.ndarray, image: np.ndarray) -> dict[str, float | None]:
    result_u8 = np.clip(image, 0, 255).astype(np.uint8)
    try:
        piqe_value = float(img_metrics.piqe(result_u8))
    except Exception:
        piqe_value = None
    return {
        "mse": float(img_metrics.mse(original_f32, image)),
        "snr": float(img_metrics.snr(original_f32, image)),
        "piqe": piqe_value,
    }


def metric_payload(
    *,
    metric: str,
    selected_metrics: dict[str, float | None],
    noisy_metrics: dict[str, float | None],
    best_cost: float,
) -> dict[str, Any]:
    return {
        "mse": selected_metrics["mse"],
        "snr": selected_metrics["snr"],
        "piqe": selected_metrics["piqe"],
        "noisy_mse": noisy_metrics["mse"],
        "noisy_snr": noisy_metrics["snr"],
        "noisy_piqe": noisy_metrics["piqe"],
        "best_cost": best_cost,
        "metric_used": metric,
    }


def run_single_exhaustive(
    *,
    run_index: int,
    total_runs: int,
    repetition: int,
    image_path: Path,
    original: np.ndarray,
    noisy: np.ndarray,
    noise_spec: NoiseSpec,
    filter_type: str,
    metrics: list[str],
    seed: int,
    max_candidates: int | None,
) -> list[dict[str, Any]]:
    fmod = FILTER_MODULES[filter_type]
    original_f32 = original.astype(np.float32)
    noisy_f32 = noisy.astype(np.float32)
    requested_metrics = set(metrics)
    noisy_metrics = evaluate_all_metrics(original_f32, noisy_f32)

    noise_estimate = float(np.std(noisy_f32 - original_f32))
    lb, ub = _adjusted_bounds(filter_type, noise_estimate)
    global_space = search_space_size(filter_type)
    effective_space = exhaustive_candidate_count(filter_type, lb, ub)
    if effective_space <= 0:
        raise RuntimeError(f"Espacio exhaustivo vacio para filtro {filter_type}")

    best_by_metric = {metric: BestCandidate() for metric in metrics}
    started_at = time.time()
    evaluated_candidates = 0

    for candidate_index, params in enumerate(iter_candidate_params(filter_type, lb, ub), start=1):
        if max_candidates is not None and evaluated_candidates >= max_candidates:
            break

        filtered = fmod.apply(noisy_f32, params)
        values = evaluate_requested_metrics(original_f32, filtered, requested_metrics)
        evaluated_candidates += 1

        for metric in metrics:
            value = values.get(metric)
            best = best_by_metric[metric]
            if is_better(metric, value, best.metric_value):
                best.metric_value = value
                best.cost = objective_cost(metric, value)
                best.params = params.copy()
                best.candidate_index = candidate_index

    duration_ms = int((time.time() - started_at) * 1000)
    truncated = evaluated_candidates < effective_space
    records: list[dict[str, Any]] = []

    for metric in metrics:
        best = best_by_metric[metric]
        if best.params is None or best.cost is None:
            raise RuntimeError(f"No se encontro candidato valido para metrica {metric}")

        result = fmod.apply(noisy_f32, best.params)
        selected_metrics = evaluate_all_metrics(original_f32, result)
        metrics_dict = metric_payload(
            metric=metric,
            selected_metrics=selected_metrics,
            noisy_metrics=noisy_metrics,
            best_cost=best.cost,
        )
        improvement_value, improvement_percent = compute_improvement(metric, metrics_dict)
        params = {name: float(val) for name, val in zip(fmod.PARAM_NAMES, best.params)}

        records.append({
            "run_index": run_index,
            "total_runs": total_runs,
            "status": "complete",
            "repetition": repetition,
            "image": {
                "path": str(image_path),
                "name": image_path.name,
                "width": int(original.shape[1]),
                "height": int(original.shape[0]),
            },
            "filter": {
                "type": filter_type,
                "label": FILTER_LABELS.get(filter_type, filter_type),
            },
            "noise": {
                "spec": noise_spec.raw,
                "label": noise_spec.label,
                "type": noise_spec.noise_type,
                "value": noise_spec.value,
                "sigma": noise_spec.noise_sigma,
                "amount": noise_spec.noise_amount,
            },
            "metric": metric,
            "method": METHOD,
            "method_label": METHOD_LABEL,
            "seed": seed,
            "duration_ms": duration_ms,
            "global_space_size": global_space,
            "effective_space_size": effective_space,
            "evaluated_candidates": evaluated_candidates,
            "truncated": truncated,
            "best_candidate_index": best.candidate_index,
            "best_cost": best.cost,
            "params": params,
            "metrics": metrics_dict,
            "improvement_value": improvement_value,
            "improvement_percent": improvement_percent,
        })

    return records


def init_summary_csv(path: Path) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=SUMMARY_FIELDS)
        writer.writeheader()


def summary_row(record: dict[str, Any]) -> dict[str, Any]:
    if record.get("status") != "complete":
        return {
            field: record.get(field, "")
            for field in SUMMARY_FIELDS
        } | {
            "run_index": record.get("run_index", ""),
            "status": record.get("status", "error"),
            "repetition": record.get("repetition", ""),
            "image": record.get("image", {}).get("name", ""),
            "filter": record.get("filter", ""),
            "noise": record.get("noise", ""),
            "metric": record.get("metric", ""),
            "method": record.get("method", METHOD),
            "error": record.get("error", ""),
        }

    metrics = record["metrics"]
    return {
        "run_index": record["run_index"],
        "status": record["status"],
        "repetition": record["repetition"],
        "image": record["image"]["name"],
        "filter": record["filter"]["type"],
        "noise": record["noise"]["label"],
        "noise_type": record["noise"]["type"],
        "noise_sigma": record["noise"]["sigma"],
        "noise_amount": record["noise"]["amount"],
        "metric": record["metric"],
        "method": record["method"],
        "seed": record["seed"],
        "duration_ms": record["duration_ms"],
        "global_space_size": record["global_space_size"],
        "effective_space_size": record["effective_space_size"],
        "evaluated_candidates": record["evaluated_candidates"],
        "truncated": "yes" if record["truncated"] else "no",
        "best_candidate_index": record["best_candidate_index"],
        "best_cost": metrics["best_cost"],
        "noisy_snr": metrics["noisy_snr"],
        "snr": metrics["snr"],
        "noisy_piqe": metrics["noisy_piqe"],
        "piqe": metrics["piqe"],
        "noisy_mse": metrics["noisy_mse"],
        "mse": metrics["mse"],
        "improvement_value": record["improvement_value"],
        "improvement_percent": record["improvement_percent"],
        "params_json": json.dumps(json_safe(record["params"]), ensure_ascii=True),
        "error": "",
    }


def append_summary_csv(path: Path, record: dict[str, Any]) -> None:
    with path.open("a", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=SUMMARY_FIELDS)
        writer.writerow(summary_row(record))


def write_runs_json(
    path: Path,
    *,
    status: str,
    config: dict[str, Any],
    runs: list[dict[str, Any]],
) -> None:
    payload = {
        "status": status,
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "config": config,
        "runs": runs,
    }
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    with tmp_path.open("w", encoding="utf-8") as handle:
        json.dump(json_safe(payload), handle, indent=2, ensure_ascii=True, allow_nan=False)
        handle.write("\n")
    tmp_path.replace(path)


def metric_value(record: dict[str, Any], key: str) -> Any:
    if key in {
        "duration_ms",
        "global_space_size",
        "effective_space_size",
        "evaluated_candidates",
        "improvement_value",
        "improvement_percent",
    }:
        return record.get(key)
    return record.get("metrics", {}).get(key)


def average_sort_key(record: dict[str, Any]) -> tuple[Any, ...]:
    return (
        record["filter"],
        record["image"],
        record["noise"],
        report_metric_order(record["metric"]),
        record["metric"],
        REPORT_METHOD_ORDER.get(record["method"], len(REPORT_METHOD_ORDER)),
        record["method"],
    )


def build_average_records(runs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[tuple[str, str, str, str, str], list[dict[str, Any]]] = defaultdict(list)

    for run in runs:
        if run.get("status") != "complete":
            continue
        key = (
            run["filter"]["type"],
            run["image"]["name"],
            run["noise"]["label"],
            run["metric"],
            run["method"],
        )
        grouped[key].append(run)

    averages: list[dict[str, Any]] = []
    for key in sorted(
        grouped,
        key=lambda item: (
            item[0],
            item[1],
            item[2],
            report_metric_order(item[3]),
            item[3],
            REPORT_METHOD_ORDER.get(item[4], len(REPORT_METHOD_ORDER)),
            item[4],
        ),
    ):
        rows = sorted(grouped[key], key=lambda item: item["repetition"])
        first = rows[0]
        record: dict[str, Any] = {
            "filter": first["filter"]["type"],
            "filter_label": first["filter"]["label"],
            "image": first["image"]["name"],
            "noise": first["noise"]["label"],
            "noise_type": first["noise"]["type"],
            "noise_sigma": first["noise"]["sigma"],
            "noise_amount": first["noise"]["amount"],
            "metric": first["metric"],
            "method": first["method"],
            "method_label": first["method_label"],
            "repetitions": len(rows),
        }

        for field in (
            "duration_ms",
            "global_space_size",
            "effective_space_size",
            "evaluated_candidates",
            "best_cost",
            "noisy_snr",
            "snr",
            "noisy_piqe",
            "piqe",
            "noisy_mse",
            "mse",
            "improvement_value",
            "improvement_percent",
        ):
            mean, std = mean_std([metric_value(row, field) for row in rows])
            record[f"{field}_mean"] = mean
            record[f"{field}_std"] = std

        averages.append(record)

    return averages


def write_averages_csv(path: Path, averages: list[dict[str, Any]]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=AVERAGE_FIELDS)
        writer.writeheader()
        for record in averages:
            writer.writerow({
                field: finite_or_none(record.get(field, ""))
                for field in AVERAGE_FIELDS
            })


def markdown_num(value: Any, decimals: int = 3) -> str:
    if value is None:
        return ""
    try:
        number = float(value)
    except (TypeError, ValueError):
        return ""
    if not math.isfinite(number):
        return ""
    return f"{number:.{decimals}f}"


def markdown_mean_std(mean: Any, std: Any, decimals: int = 3) -> str:
    mean_text = markdown_num(mean, decimals)
    if not mean_text:
        return ""

    std_text = markdown_num(std, decimals)
    if not std_text:
        return mean_text

    return f"{mean_text} +/- {std_text}"


def markdown_objective_value(row: dict[str, Any], metric: str) -> str:
    value = markdown_mean_std(row[f"{metric}_mean"], row[f"{metric}_std"])
    if not value:
        return value
    if row["metric"] == metric:
        return f"**{value}**"
    return value


def write_markdown_summary(path: Path, averages: list[dict[str, Any]], filters: list[str]) -> None:
    repetitions = sorted({int(record["repetitions"]) for record in averages})
    if len(repetitions) == 1:
        repetition_text = f"Valores reportados como media muestral +/- desviacion estandar muestral, con n = {repetitions[0]}."
    else:
        repetition_text = "Valores reportados como media muestral +/- desviacion estandar muestral, con n igual al numero de repeticiones disponibles por combinacion."

    lines = [
        "# Resumen de busqueda exhaustiva",
        "",
        "Las tablas muestran el optimo exhaustivo discretizado por filtro, imagen, ruido, metrica objetivo y metodo.",
        repetition_text,
        "",
    ]

    for filter_type in filters:
        filter_rows = [record for record in averages if record["filter"] == filter_type]
        if not filter_rows:
            continue

        filter_label = FILTER_LABELS.get(filter_type, filter_type)
        lines.extend([f"## {filter_label}", ""])
        for image_name in sorted({record["image"] for record in filter_rows}):
            rows = sorted(
                (record for record in filter_rows if record["image"] == image_name),
                key=average_sort_key,
            )
            lines.extend([
                f"### {image_name}",
                "",
                "| Ruido | Obj. | Metodo | MSE | SNR | PIQE | t(s) | Eval. |",
                "|---|---|---|---:|---:|---:|---:|---:|",
            ])
            for row in rows:
                lines.append(
                    "| "
                    + " | ".join([
                        row["noise"],
                        row["metric"].upper(),
                        row["method_label"],
                        markdown_objective_value(row, "mse"),
                        markdown_objective_value(row, "snr"),
                        markdown_objective_value(row, "piqe"),
                        markdown_mean_std(
                            (row["duration_ms_mean"] or 0.0) / 1000.0,
                            (row["duration_ms_std"] or 0.0) / 1000.0,
                            2,
                        ),
                        markdown_mean_std(
                            row["evaluated_candidates_mean"],
                            row["evaluated_candidates_std"],
                            0,
                        ),
                    ])
                    + " |"
                )
            lines.append("")

    path.write_text("\n".join(lines), encoding="utf-8")


def write_latex_tables(output_dir: Path, averages: list[dict[str, Any]], filters: list[str]) -> list[Path]:
    latex_dir = output_dir / "latex"
    latex_dir.mkdir(parents=True, exist_ok=True)
    paths: list[Path] = []

    for filter_type in filters:
        filter_rows = [record for record in averages if record.get("filter") == filter_type]
        if not filter_rows:
            continue

        label = FILTER_LABELS.get(filter_type, filter_type)
        for image_name in sorted({record["image"] for record in filter_rows}):
            rows = sorted(
                (record for record in filter_rows if record["image"] == image_name),
                key=average_sort_key,
            )
            image_stem = Path(image_name).stem
            path = latex_dir / f"exhaustiva_{filter_type}_{image_stem}.tex"
            repetitions = sorted({int(record["repetitions"]) for record in rows})
            repetition_note = (
                f"Media muestral +/- desviacion estandar muestral; n = {repetitions[0]}."
                if len(repetitions) == 1
                else "Media muestral +/- desviacion estandar muestral; n corresponde a las repeticiones disponibles por combinacion."
            )
            lines = [
                r"\begin{table}[htbp]",
                r"\centering",
                r"\scriptsize",
                f"\\caption{{Busqueda exhaustiva discretizada para {latex_escape(label)} en {latex_escape(image_name)}. {latex_escape(repetition_note)}}}",
                r"\begin{tabular}{lllrrrrr}",
                r"\hline",
                r"Ruido & Obj. & Metodo & MSE & SNR & PIQE & t(s) & Eval. \\",
                r"\hline",
            ]
            for row in rows:
                mse_value = fmt_mean_std(row["mse_mean"], row["mse_std"])
                snr_value = fmt_mean_std(row["snr_mean"], row["snr_std"])
                piqe_value = fmt_mean_std(row["piqe_mean"], row["piqe_std"])
                if row["metric"] == "mse":
                    mse_value = rf"\textbf{{{mse_value}}}"
                elif row["metric"] == "snr":
                    snr_value = rf"\textbf{{{snr_value}}}"
                elif row["metric"] == "piqe":
                    piqe_value = rf"\textbf{{{piqe_value}}}"

                cells = [
                    latex_escape(row["noise"]),
                    latex_escape(row["metric"].upper()),
                    latex_escape(row["method_label"]),
                    mse_value,
                    snr_value,
                    piqe_value,
                    fmt_mean_std(
                        (row["duration_ms_mean"] or 0.0) / 1000.0,
                        (row["duration_ms_std"] or 0.0) / 1000.0,
                        1,
                    ),
                    fmt_mean_std(
                        row["evaluated_candidates_mean"],
                        row["evaluated_candidates_std"],
                        0,
                    ),
                ]
                lines.append(" & ".join(cells) + r" \\")
            lines.extend([
                r"\hline",
                r"\end{tabular}",
                r"\end{table}",
                "",
            ])
            path.write_text("\n".join(lines), encoding="utf-8")
            paths.append(path)

    return paths


def build_config(args: argparse.Namespace, images: list[Path], output_dir: Path) -> dict[str, Any]:
    return {
        "experiment_type": "exhaustive_discretized",
        "images": [str(path) for path in images],
        "noise": [spec.label for spec in args.noise],
        "filters": args.filters,
        "metrics": args.metrics,
        "method": METHOD,
        "method_label": METHOD_LABEL,
        "repetitions": args.repetitions,
        "seed": args.seed,
        "max_candidates": args.max_candidates,
        "output_dir": str(output_dir),
        "db_path": os.environ.get("OCTOPUS_DB_PATH", str(BACKEND_DIR / "data" / "octopus.sqlite3")),
    }


def run_batch(args: argparse.Namespace) -> tuple[Path, Path, Path, Path, list[Path]]:
    output_dir = (args.output_dir or default_output_dir()).expanduser().resolve()
    logger = setup_logging(output_dir)
    summary_path = output_dir / "summary.csv"
    averages_path = output_dir / "averages.csv"
    markdown_path = output_dir / "summary.md"
    runs_path = output_dir / "runs.json"
    init_summary_csv(summary_path)

    images = [resolve_image_path(value) for value in args.images]
    total_searches = len(images) * len(args.noise) * len(args.filters) * args.repetitions
    total_metric_rows = total_searches * len(args.metrics)
    config = build_config(args, images, output_dir)
    runs: list[dict[str, Any]] = []

    logger.info("Busqueda exhaustiva iniciada: %s recorridos", total_searches)
    logger.info("Filas de metricas a generar: %s", total_metric_rows)
    logger.info("Repeticiones de ruido: %s", args.repetitions)
    logger.info("Salida: %s", output_dir)
    if args.max_candidates is not None:
        logger.warning("Modo prueba: max_candidates=%s; estos resultados no son exhaustivos finales", args.max_candidates)
    write_runs_json(runs_path, status="running", config=config, runs=runs)

    run_index = 0
    for image_index, image_path in enumerate(images):
        original = cv2.imread(str(image_path), cv2.IMREAD_GRAYSCALE)
        if original is None:
            raise RuntimeError(f"No se pudo cargar la imagen: {image_path}")

        for noise_index, noise_spec in enumerate(args.noise):
            for filter_type in args.filters:
                for repetition in range(1, args.repetitions + 1):
                    run_index += 1
                    seed = repetition_seed(args.seed, image_index, noise_index, repetition)
                    noisy = make_noisy_image(original, noise_spec, seed)
                    logger.info(
                        "[%d/%d] %s | %s | %s | rep %d/%d",
                        run_index,
                        total_searches,
                        image_path.name,
                        noise_spec.label,
                        filter_type,
                        repetition,
                        args.repetitions,
                    )
                    try:
                        records = run_single_exhaustive(
                            run_index=run_index,
                            total_runs=total_searches,
                            repetition=repetition,
                            image_path=image_path,
                            original=original,
                            noisy=noisy,
                            noise_spec=noise_spec,
                            filter_type=filter_type,
                            metrics=args.metrics,
                            seed=seed,
                            max_candidates=args.max_candidates,
                        )
                        runs.extend(records)
                        for record in records:
                            append_summary_csv(summary_path, record)
                        write_runs_json(runs_path, status="running", config=config, runs=runs)

                        first = records[0]
                        logger.info(
                            "  listo duracion=%.1fs evaluados=%s/%s",
                            first["duration_ms"] / 1000.0,
                            first["evaluated_candidates"],
                            first["effective_space_size"],
                        )
                    except Exception as exc:
                        error_record = {
                            "run_index": run_index,
                            "total_runs": total_searches,
                            "status": "error",
                            "repetition": repetition,
                            "image": {"path": str(image_path), "name": image_path.name},
                            "filter": filter_type,
                            "noise": noise_spec.label,
                            "metric": ";".join(args.metrics),
                            "method": METHOD,
                            "error": str(exc),
                        }
                        runs.append(error_record)
                        append_summary_csv(summary_path, error_record)
                        write_runs_json(runs_path, status="error", config=config, runs=runs)
                        logger.exception("  fallo el recorrido")
                        if not args.continue_on_error:
                            raise

    averages = build_average_records(runs)
    write_averages_csv(averages_path, averages)
    write_markdown_summary(markdown_path, averages, args.filters)
    latex_paths = write_latex_tables(output_dir, averages, args.filters)
    write_runs_json(runs_path, status="complete", config=config, runs=runs)
    logger.info("Busqueda exhaustiva completada")
    logger.info("CSV: %s", summary_path)
    logger.info("Promedios CSV: %s", averages_path)
    logger.info("Markdown: %s", markdown_path)
    logger.info("JSON: %s", runs_path)
    for path in latex_paths:
        logger.info("LaTeX: %s", path)

    return summary_path, averages_path, markdown_path, runs_path, latex_paths


def main() -> int:
    args = build_parser().parse_args()
    try:
        summary_path, averages_path, markdown_path, runs_path, latex_paths = run_batch(args)
    except KeyboardInterrupt:
        print("\nBusqueda exhaustiva interrumpida por el usuario.", file=sys.stderr)
        return 130
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    print("\nArchivos generados:")
    print(f"  summary.csv:  {summary_path}")
    print(f"  averages.csv: {averages_path}")
    print(f"  summary.md:   {markdown_path}")
    print(f"  runs.json:    {runs_path}")
    for path in latex_paths:
        print(f"  latex:       {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
