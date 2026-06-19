#!/usr/bin/env python3
"""Batch runner for algorithm comparison experiments.

Runs image x noise x filter x metric x algorithm combinations sequentially,
saves each completed run to the normal UI history, and writes analysis files.
"""

from __future__ import annotations

import argparse
import csv
import json
import logging
import math
import os
import sys
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

import cv2
import numpy as np

BACKEND_DIR = Path(__file__).resolve().parent
REPO_ROOT = BACKEND_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))

from auth import DEFAULT_EMAIL, connect, init_auth_db
import history as hist_mod
from imaging import metrics as img_metrics
from imaging import noise as img_noise
from main import ALGORITHMS, FILTER_LABELS, FILTER_MODULES, _adjusted_bounds, _canonical_algorithm


DEFAULT_IMAGES = ["cere.png", "woody.png", "1366_2000.jpg"]
DEFAULT_NOISE = ["gaussian:15", "gaussian:35"]
DEFAULT_FILTERS = ["bilateral", "anisotropic", "nlmeans"]
DEFAULT_METRICS = ["snr", "piqe"]
DEFAULT_ALGORITHMS = ["ooa", "sfoa", "ao"]

ALGORITHM_LABELS = {
    "ooa": "OOA",
    "sfoa": "SFOA",
    "ao": "AO",
    "aquila": "AO",
}

SUMMARY_FIELDS = [
    "run_index",
    "status",
    "history_id",
    "image",
    "filter",
    "noise",
    "noise_type",
    "noise_sigma",
    "noise_amount",
    "metric",
    "algorithm",
    "population",
    "iterations",
    "seed",
    "duration_ms",
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
    "history_original_path",
    "history_noisy_path",
    "history_result_path",
    "error",
]


@dataclass(frozen=True)
class NoiseSpec:
    raw: str
    noise_type: str
    value: float
    noise_sigma: float
    noise_amount: float

    @property
    def label(self) -> str:
        if self.noise_type == "gaussian":
            return f"gaussian:{self.noise_sigma:g}"
        return f"sp:{self.noise_amount:g}"


def parse_noise_spec(value: str) -> NoiseSpec:
    try:
        kind, raw_level = value.split(":", 1)
        level = float(raw_level)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("use formato gaussian:<sigma> o sp:<amount>") from exc

    kind = kind.strip().lower()
    if kind in {"gaussian", "gauss", "normal"}:
        if level < 0.0 or not math.isfinite(level):
            raise argparse.ArgumentTypeError("sigma debe ser finito y >= 0")
        return NoiseSpec(
            raw=value,
            noise_type="gaussian",
            value=level,
            noise_sigma=level,
            noise_amount=0.0,
        )

    if kind in {"sp", "s&p", "salt-pepper", "salt_and_pepper"}:
        if not 0.0 <= level <= 1.0:
            raise argparse.ArgumentTypeError("amount debe estar entre 0 y 1")
        return NoiseSpec(
            raw=value,
            noise_type="sp",
            value=level,
            noise_sigma=0.0,
            noise_amount=level,
        )

    raise argparse.ArgumentTypeError("tipo de ruido invalido: use gaussian o sp")


def bounded_int(label: str, minimum: int, maximum: int):
    def parse(value: str) -> int:
        try:
            parsed = int(value)
        except ValueError as exc:
            raise argparse.ArgumentTypeError(f"{label} debe ser entero") from exc
        if not minimum <= parsed <= maximum:
            raise argparse.ArgumentTypeError(f"{label} debe estar entre {minimum} y {maximum}")
        return parsed

    return parse


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Ejecuta un batch secuencial para comparar OOA, SFOA y AO.",
    )
    parser.add_argument(
        "--images",
        nargs="+",
        default=DEFAULT_IMAGES,
        help="Imagenes a procesar (default: cere.png woody.png 1366_2000.jpg)",
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
        help="Filtros a optimizar",
    )
    parser.add_argument(
        "--metrics",
        nargs="+",
        choices=["mse", "snr", "piqe"],
        default=DEFAULT_METRICS,
        help="Metricas objetivo",
    )
    parser.add_argument(
        "--algorithms",
        nargs="+",
        choices=sorted(ALGORITHMS.keys()),
        default=DEFAULT_ALGORITHMS,
        help="Algoritmos a ejecutar, en el orden indicado",
    )
    parser.add_argument(
        "--population",
        required=True,
        type=bounded_int("population", 9, 200),
        help="Tamano de poblacion usado en todas las corridas",
    )
    parser.add_argument(
        "--iterations",
        required=True,
        type=bounded_int("iterations", 1, 500),
        help="Numero de iteraciones usado en todas las corridas",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=None,
        help="Semilla compartida para ruido y algoritmos",
    )
    parser.add_argument(
        "--user-email",
        default=DEFAULT_EMAIL,
        help=f"Usuario dueño del historial (default: {DEFAULT_EMAIL})",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help="Directorio para summary.csv, runs.json, progress.log y latex/",
    )
    parser.add_argument(
        "--continue-on-error",
        action="store_true",
        help="Registra errores y continua con la siguiente corrida",
    )
    return parser


def resolve_image_path(value: str) -> Path:
    path = Path(value).expanduser()
    candidates = [path]
    if not path.is_absolute():
        candidates.append(REPO_ROOT / path)

    for candidate in candidates:
        if candidate.exists():
            return candidate.resolve()

    raise FileNotFoundError(f"No se encontro la imagen: {value}")


def canonical_algorithms(values: list[str]) -> list[str]:
    canonical: list[str] = []
    for value in values:
        algorithm = _canonical_algorithm(value)
        if algorithm not in canonical:
            canonical.append(algorithm)
    return canonical


def default_output_dir() -> Path:
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return BACKEND_DIR / "data" / "batches" / stamp


def setup_logging(output_dir: Path) -> logging.Logger:
    output_dir.mkdir(parents=True, exist_ok=True)
    logger = logging.getLogger("batch_experiments")
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


def get_user_id(email: str) -> int:
    init_auth_db()
    normalized = email.strip().lower()
    with connect() as conn:
        row = conn.execute(
            "SELECT id FROM users WHERE email = ?",
            (normalized,),
        ).fetchone()
    if row is None:
        raise ValueError(f"No existe el usuario '{email}' en la base configurada")
    return int(row["id"])


def png_bytes(image: np.ndarray) -> bytes:
    ok, buf = cv2.imencode(".png", image)
    if not ok:
        raise RuntimeError("No se pudo codificar una imagen PNG")
    return buf.tobytes()


def make_noisy_image(original: np.ndarray, spec: NoiseSpec, seed: int | None) -> np.ndarray:
    rng = np.random.default_rng(seed)
    if spec.noise_type == "gaussian":
        return img_noise.add_gaussian_noise(original, sigma=spec.noise_sigma, rng=rng)
    return img_noise.add_salt_and_pepper_noise(original, amount=spec.noise_amount, rng=rng)


def finite_or_none(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, np.generic):
        value = value.item()
    if isinstance(value, float) and not math.isfinite(value):
        return None
    return value


def json_safe(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(key): json_safe(val) for key, val in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_safe(item) for item in value]
    if isinstance(value, np.ndarray):
        return json_safe(value.tolist())
    return finite_or_none(value)


def compute_improvement(metric: str, metrics: dict[str, Any]) -> tuple[float | None, float | None]:
    def pct(delta: float, baseline: float) -> float | None:
        if baseline == 0.0 or not math.isfinite(baseline):
            return None
        value = delta / abs(baseline) * 100.0
        return value if math.isfinite(value) else None

    if metric == "snr":
        before = metrics["noisy_snr"]
        after = metrics["snr"]
        if not (math.isfinite(before) and math.isfinite(after)):
            return None, None
        delta = after - before
        return delta, pct(delta, before)

    if metric == "piqe":
        before = metrics.get("noisy_piqe")
        after = metrics.get("piqe")
        if before is None or after is None:
            return None, None
        delta = before - after
        return delta, pct(delta, before)

    before = metrics["noisy_mse"]
    after = metrics["mse"]
    if not (math.isfinite(before) and math.isfinite(after)):
        return None, None
    delta = before - after
    return delta, pct(delta, before)


def saved_history_paths(history_id: int) -> dict[str, str | None]:
    with connect() as conn:
        row = conn.execute(
            """
            SELECT created_at, original_path, noisy_path, result_path
            FROM optimizations
            WHERE id = ?
            """,
            (history_id,),
        ).fetchone()

    if row is None:
        return {
            "created_at": None,
            "original_path": None,
            "noisy_path": None,
            "result_path": None,
            "original_abs_path": None,
            "noisy_abs_path": None,
            "result_abs_path": None,
        }

    root = hist_mod.get_history_root()
    return {
        "created_at": row["created_at"],
        "original_path": row["original_path"],
        "noisy_path": row["noisy_path"],
        "result_path": row["result_path"],
        "original_abs_path": str(root / row["original_path"]) if row["original_path"] else None,
        "noisy_abs_path": str(root / row["noisy_path"]) if row["noisy_path"] else None,
        "result_abs_path": str(root / row["result_path"]) if row["result_path"] else None,
    }


def run_single_optimization(
    *,
    user_id: int,
    run_index: int,
    total_runs: int,
    image_path: Path,
    original: np.ndarray,
    noisy: np.ndarray,
    original_bytes: bytes,
    noisy_bytes: bytes,
    noise_spec: NoiseSpec,
    filter_type: str,
    metric: str,
    algorithm: str,
    population: int,
    iterations: int,
    seed: int | None,
) -> dict[str, Any]:
    fmod = FILTER_MODULES[filter_type]
    algo_fn = ALGORITHMS[algorithm]
    rng = np.random.default_rng(seed)

    noise_estimate = float(np.std(noisy.astype(np.float32) - original.astype(np.float32)))
    lb, ub = _adjusted_bounds(filter_type, noise_estimate)

    original_f32 = original.astype(np.float32)
    noisy_f32 = noisy.astype(np.float32)

    def objective(params: np.ndarray) -> float:
        filtered = fmod.apply(noisy_f32, params)
        if metric == "snr":
            return -img_metrics.snr(original_f32, filtered)
        if metric == "piqe":
            return img_metrics.piqe(np.clip(filtered, 0, 255).astype(np.uint8))
        return img_metrics.mse(original_f32, filtered)

    started_at = time.time()
    best_cost, best_pos, convergence = algo_fn(
        n_population=population,
        max_iter=iterations,
        lb=lb,
        ub=ub,
        dim=fmod.DIM,
        objective_fn=objective,
        rng=rng,
    )
    duration_ms = int((time.time() - started_at) * 1000)

    result = fmod.apply(noisy_f32, best_pos)
    result_u8 = np.clip(result, 0, 255).astype(np.uint8)

    mse_val = img_metrics.mse(original_f32, result)
    snr_val = img_metrics.snr(original_f32, result)
    noisy_mse = img_metrics.mse(original_f32, noisy_f32)
    noisy_snr = img_metrics.snr(original_f32, noisy_f32)

    try:
        piqe_result = img_metrics.piqe(result_u8)
        piqe_noisy = img_metrics.piqe(np.clip(noisy, 0, 255).astype(np.uint8))
    except Exception:
        piqe_result = None
        piqe_noisy = None

    metrics = {
        "mse": float(mse_val),
        "snr": float(snr_val),
        "piqe": float(piqe_result) if piqe_result is not None else None,
        "noisy_mse": float(noisy_mse),
        "noisy_snr": float(noisy_snr),
        "noisy_piqe": float(piqe_noisy) if piqe_noisy is not None else None,
        "best_cost": float(best_cost),
        "metric_used": metric,
    }
    params = {name: float(val) for name, val in zip(fmod.PARAM_NAMES, best_pos)}
    convergence_values = [float(value) for value in convergence]
    improvement_value, improvement_percent = compute_improvement(metric, metrics)

    params_req = {
        "filter_type": filter_type,
        "metric": metric,
        "noise_type": noise_spec.noise_type,
        "noise_sigma": noise_spec.noise_sigma,
        "noise_amount": noise_spec.noise_amount,
        "population": population,
        "iterations": iterations,
        "seed": seed,
        "algorithm": algorithm,
        "config_mode": "advanced",
    }
    history_id = hist_mod.save_optimization(
        user_id,
        params_req=params_req,
        result_payload={
            "metrics": metrics,
            "params": params,
            "convergence": convergence_values,
        },
        images={
            "original": original_bytes,
            "noisy": noisy_bytes,
            "result": png_bytes(result_u8),
        },
        duration_ms=duration_ms,
    )
    history_paths = saved_history_paths(history_id)

    return {
        "run_index": run_index,
        "total_runs": total_runs,
        "status": "complete",
        "history_id": history_id,
        "history_key": f"optimization:{history_id}",
        "created_at": history_paths["created_at"],
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
        "algorithm": algorithm,
        "algorithm_label": ALGORITHM_LABELS.get(algorithm, algorithm.upper()),
        "population": population,
        "iterations": iterations,
        "seed": seed,
        "duration_ms": duration_ms,
        "best_cost": float(best_cost),
        "params": params,
        "metrics": metrics,
        "convergence": convergence_values,
        "improvement_value": improvement_value,
        "improvement_percent": improvement_percent,
        "history_paths": history_paths,
    }


def init_summary_csv(path: Path) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=SUMMARY_FIELDS)
        writer.writeheader()


def append_summary_csv(path: Path, record: dict[str, Any]) -> None:
    row = summary_row(record)
    with path.open("a", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=SUMMARY_FIELDS)
        writer.writerow(row)


def summary_row(record: dict[str, Any]) -> dict[str, Any]:
    if record.get("status") != "complete":
        return {
            field: record.get(field, "")
            for field in SUMMARY_FIELDS
        } | {
            "run_index": record.get("run_index", ""),
            "status": record.get("status", "error"),
            "image": record.get("image", {}).get("name", ""),
            "filter": record.get("filter", ""),
            "noise": record.get("noise", ""),
            "metric": record.get("metric", ""),
            "algorithm": record.get("algorithm", ""),
            "error": record.get("error", ""),
        }

    metrics = record["metrics"]
    paths = record["history_paths"]
    return {
        "run_index": record["run_index"],
        "status": record["status"],
        "history_id": record["history_id"],
        "image": record["image"]["name"],
        "filter": record["filter"]["type"],
        "noise": record["noise"]["label"],
        "noise_type": record["noise"]["type"],
        "noise_sigma": record["noise"]["sigma"],
        "noise_amount": record["noise"]["amount"],
        "metric": record["metric"],
        "algorithm": record["algorithm"],
        "population": record["population"],
        "iterations": record["iterations"],
        "seed": record["seed"] if record["seed"] is not None else "",
        "duration_ms": record["duration_ms"],
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
        "history_original_path": paths["original_abs_path"],
        "history_noisy_path": paths["noisy_abs_path"],
        "history_result_path": paths["result_abs_path"],
        "error": "",
    }


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


def latex_escape(value: Any) -> str:
    text = "" if value is None else str(value)
    replacements = {
        "\\": r"\textbackslash{}",
        "&": r"\&",
        "%": r"\%",
        "$": r"\$",
        "#": r"\#",
        "_": r"\_",
        "{": r"\{",
        "}": r"\}",
        "~": r"\textasciitilde{}",
        "^": r"\textasciicircum{}",
    }
    return "".join(replacements.get(char, char) for char in text)


def fmt_num(value: Any, decimals: int = 2) -> str:
    if value is None:
        return "--"
    try:
        number = float(value)
    except (TypeError, ValueError):
        return "--"
    if not math.isfinite(number):
        return "--"
    return f"{number:.{decimals}f}"


def fmt_improvement(record: dict[str, Any]) -> str:
    value = record.get("improvement_value")
    percent = record.get("improvement_percent")
    if value is None:
        return "--"
    if record["metric"] == "snr":
        return f"{value:+.2f} dB"
    if percent is None:
        return f"{value:+.2f}"
    return f"{percent:+.1f}\\%"


def write_latex_tables(output_dir: Path, runs: list[dict[str, Any]], algorithms: list[str]) -> list[Path]:
    latex_dir = output_dir / "latex"
    latex_dir.mkdir(parents=True, exist_ok=True)
    paths: list[Path] = []

    for algorithm in algorithms:
        rows = [
            run for run in runs
            if run.get("status") == "complete" and run.get("algorithm") == algorithm
        ]
        label = ALGORITHM_LABELS.get(algorithm, algorithm.upper())
        path = latex_dir / f"comparacion_{algorithm}.tex"
        lines = [
            r"\begin{table}[htbp]",
            r"\centering",
            r"\scriptsize",
            f"\\caption{{Comparacion de resultados para {latex_escape(label)}}}",
            r"\begin{tabular}{lllllrrrrrl}",
            r"\hline",
            r"Img & Filtro & Ruido & Obj. & Hist. & SNRa & SNRd & PIQEa & PIQEd & Mej. & t(s) \\",
            r"\hline",
        ]
        for run in rows:
            metrics = run["metrics"]
            cells = [
                latex_escape(run["image"]["name"]),
                latex_escape(run["filter"]["type"]),
                latex_escape(run["noise"]["label"]),
                latex_escape(run["metric"].upper()),
                str(run["history_id"]),
                fmt_num(metrics["noisy_snr"]),
                fmt_num(metrics["snr"]),
                fmt_num(metrics["noisy_piqe"]),
                fmt_num(metrics["piqe"]),
                fmt_improvement(run),
                fmt_num(run["duration_ms"] / 1000.0, 1),
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


def build_config(args: argparse.Namespace, images: list[Path], algorithms: list[str], output_dir: Path) -> dict[str, Any]:
    return {
        "images": [str(path) for path in images],
        "noise": [spec.label for spec in args.noise],
        "filters": args.filters,
        "metrics": args.metrics,
        "algorithms": algorithms,
        "population": args.population,
        "iterations": args.iterations,
        "seed": args.seed,
        "user_email": args.user_email,
        "output_dir": str(output_dir),
        "history_root": str(hist_mod.get_history_root()),
        "db_path": os.environ.get("OCTOPUS_DB_PATH", str(BACKEND_DIR / "data" / "octopus.sqlite3")),
    }


def run_batch(args: argparse.Namespace) -> tuple[Path, Path, list[Path]]:
    output_dir = (args.output_dir or default_output_dir()).expanduser().resolve()
    logger = setup_logging(output_dir)
    summary_path = output_dir / "summary.csv"
    runs_path = output_dir / "runs.json"
    init_summary_csv(summary_path)

    images = [resolve_image_path(value) for value in args.images]
    algorithms = canonical_algorithms(args.algorithms)
    user_id = get_user_id(args.user_email)
    total_runs = len(images) * len(args.noise) * len(args.filters) * len(args.metrics) * len(algorithms)
    config = build_config(args, images, algorithms, output_dir)
    runs: list[dict[str, Any]] = []

    logger.info("Batch iniciado: %s corridas secuenciales", total_runs)
    logger.info("Salida: %s", output_dir)
    logger.info("Historial: %s", hist_mod.get_history_root())
    write_runs_json(runs_path, status="running", config=config, runs=runs)

    run_index = 0
    for image_path in images:
        original = cv2.imread(str(image_path), cv2.IMREAD_GRAYSCALE)
        if original is None:
            raise RuntimeError(f"No se pudo cargar la imagen: {image_path}")
        original_bytes = png_bytes(original)

        for noise_spec in args.noise:
            noisy = make_noisy_image(original, noise_spec, args.seed)
            noisy_bytes = png_bytes(noisy)

            for filter_type in args.filters:
                for metric in args.metrics:
                    for algorithm in algorithms:
                        run_index += 1
                        logger.info(
                            "[%d/%d] %s | %s | %s | %s | %s",
                            run_index,
                            total_runs,
                            image_path.name,
                            noise_spec.label,
                            filter_type,
                            metric.upper(),
                            ALGORITHM_LABELS.get(algorithm, algorithm.upper()),
                        )
                        try:
                            record = run_single_optimization(
                                user_id=user_id,
                                run_index=run_index,
                                total_runs=total_runs,
                                image_path=image_path,
                                original=original,
                                noisy=noisy,
                                original_bytes=original_bytes,
                                noisy_bytes=noisy_bytes,
                                noise_spec=noise_spec,
                                filter_type=filter_type,
                                metric=metric,
                                algorithm=algorithm,
                                population=args.population,
                                iterations=args.iterations,
                                seed=args.seed,
                            )
                            runs.append(record)
                            append_summary_csv(summary_path, record)
                            write_runs_json(runs_path, status="running", config=config, runs=runs)
                            logger.info(
                                "  listo history_id=%s duracion=%.1fs SNR %.2f->%.2f PIQE %s->%s",
                                record["history_id"],
                                record["duration_ms"] / 1000.0,
                                record["metrics"]["noisy_snr"],
                                record["metrics"]["snr"],
                                fmt_num(record["metrics"]["noisy_piqe"]),
                                fmt_num(record["metrics"]["piqe"]),
                            )
                        except Exception as exc:
                            error_record = {
                                "run_index": run_index,
                                "total_runs": total_runs,
                                "status": "error",
                                "image": {"path": str(image_path), "name": image_path.name},
                                "filter": filter_type,
                                "noise": noise_spec.label,
                                "metric": metric,
                                "algorithm": algorithm,
                                "error": str(exc),
                            }
                            runs.append(error_record)
                            append_summary_csv(summary_path, error_record)
                            write_runs_json(runs_path, status="error", config=config, runs=runs)
                            logger.exception("  fallo la corrida")
                            if not args.continue_on_error:
                                raise

    latex_paths = write_latex_tables(output_dir, runs, algorithms)
    write_runs_json(runs_path, status="complete", config=config, runs=runs)
    logger.info("Batch completado")
    logger.info("CSV: %s", summary_path)
    logger.info("JSON: %s", runs_path)
    for path in latex_paths:
        logger.info("LaTeX: %s", path)

    return summary_path, runs_path, latex_paths


def main() -> int:
    args = build_parser().parse_args()
    try:
        summary_path, runs_path, latex_paths = run_batch(args)
    except KeyboardInterrupt:
        print("\nBatch interrumpido por el usuario.", file=sys.stderr)
        return 130
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    print("\nArchivos generados:")
    print(f"  summary.csv: {summary_path}")
    print(f"  runs.json:   {runs_path}")
    for path in latex_paths:
        print(f"  latex:       {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
