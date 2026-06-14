import base64
import json
import shutil
from pathlib import Path
from typing import Optional

from auth import connect, now_iso

HISTORY_ROOT = Path(__file__).parent / "data" / "history"
EXPERIMENTAL_ROOT = HISTORY_ROOT / "experimental"


def _read_image(path_str: Optional[str]) -> Optional[str]:
    if not path_str:
        return None

    img_path = HISTORY_ROOT / path_str
    if not img_path.exists():
        return None

    return base64.b64encode(img_path.read_bytes()).decode()


def _write_entry_images(entry_dir: Path, stored_dir: Path, images: dict) -> dict:
    entry_dir.mkdir(parents=True, exist_ok=True)

    paths = {}
    for name, img_bytes in images.items():
        p = entry_dir / f"{name}.png"
        p.write_bytes(img_bytes)
        paths[name] = str(stored_dir / f"{name}.png")

    return paths


def save_optimization(
    user_id: int,
    *,
    params_req: dict,
    result_payload: dict,
    images: dict,
    duration_ms: int,
) -> int:
    metrics = result_payload["metrics"]
    best_params = result_payload["params"]
    convergence = result_payload["convergence"]

    with connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO optimizations (
                user_id, created_at,
                filter_type, metric_type, noise_type,
                noise_sigma, noise_amount, population, iterations, seed,
                params_json, metrics_json, convergence_json,
                best_cost, metric_used,
                original_path, noisy_path, result_path,
                duration_ms, algorithm, config_mode
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?)
            """,
            (
                user_id, now_iso(),
                params_req["filter_type"], params_req["metric"], params_req["noise_type"],
                params_req["noise_sigma"], params_req["noise_amount"],
                params_req["population"], params_req["iterations"],
                params_req.get("seed"),
                json.dumps(best_params), json.dumps(metrics), json.dumps(convergence),
                float(metrics["best_cost"]), metrics["metric_used"],
                duration_ms, params_req.get("algorithm"), params_req.get("config_mode", "advanced"),
            ),
        )
        opt_id = cur.lastrowid

    entry_dir = HISTORY_ROOT / str(opt_id)
    paths = _write_entry_images(entry_dir, Path(str(opt_id)), images)

    with connect() as conn:
        conn.execute(
            """
            UPDATE optimizations
            SET original_path = ?, noisy_path = ?, result_path = ?
            WHERE id = ?
            """,
            (paths.get("original"), paths.get("noisy"), paths.get("result"), opt_id),
        )

    return opt_id


def save_experimental_run(
    user_id: int,
    *,
    filter_type: str,
    params_used: dict,
    images: dict,
    duration_ms: int,
    source_mode: str = "experimental",
) -> int:
    with connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO experimental_runs (
                user_id, created_at, filter_type, params_json,
                input_path, result_path, duration_ms, source_mode
            ) VALUES (?, ?, ?, ?, NULL, NULL, ?, ?)
            """,
            (
                user_id, now_iso(), filter_type, json.dumps(params_used),
                duration_ms, source_mode,
            ),
        )
        run_id = cur.lastrowid

    entry_dir = EXPERIMENTAL_ROOT / str(run_id)
    stored_dir = Path("experimental") / str(run_id)
    paths = _write_entry_images(entry_dir, stored_dir, images)

    with connect() as conn:
        conn.execute(
            """
            UPDATE experimental_runs
            SET input_path = ?, result_path = ?
            WHERE id = ?
            """,
            (paths.get("input"), paths.get("result"), run_id),
        )

    return run_id


def list_history(user_id: int, limit: int = 50, offset: int = 0) -> list:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT *
            FROM (
                SELECT
                    id,
                    'optimization' AS entry_type,
                    'optimization:' || id AS history_key,
                    created_at,
                    filter_type,
                    metric_type,
                    best_cost,
                    metric_used,
                    algorithm,
                    COALESCE(config_mode, 'advanced') AS source_mode
                FROM optimizations
                WHERE user_id = ?

                UNION ALL

                SELECT
                    id,
                    'experimental' AS entry_type,
                    'experimental:' || id AS history_key,
                    created_at,
                    filter_type,
                    NULL AS metric_type,
                    NULL AS best_cost,
                    NULL AS metric_used,
                    NULL AS algorithm,
                    COALESCE(source_mode, 'experimental') AS source_mode
                FROM experimental_runs
                WHERE user_id = ?
            )
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
            """,
            (user_id, user_id, limit, offset),
        ).fetchall()
    return [dict(r) for r in rows]


def list_optimizations(user_id: int, limit: int = 50, offset: int = 0) -> list:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT
                id,
                'optimization' AS entry_type,
                'optimization:' || id AS history_key,
                created_at,
                filter_type,
                metric_type,
                best_cost,
                metric_used,
                algorithm,
                COALESCE(config_mode, 'advanced') AS source_mode
            FROM optimizations
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
            """,
            (user_id, limit, offset),
        ).fetchall()
    return [dict(r) for r in rows]


def get_optimization(user_id: int, opt_id: int) -> Optional[dict]:
    with connect() as conn:
        row = conn.execute(
            "SELECT * FROM optimizations WHERE id = ? AND user_id = ?",
            (opt_id, user_id),
        ).fetchone()

    if row is None:
        return None

    d = dict(row)
    d["entry_type"] = "optimization"
    d["history_key"] = f"optimization:{d['id']}"
    d["source_mode"] = d.get("config_mode") or "advanced"
    d["params"] = json.loads(d.pop("params_json"))
    d["metrics"] = json.loads(d.pop("metrics_json"))
    d["convergence"] = json.loads(d.pop("convergence_json"))

    for key, field in (("original_path", "original_image"), ("noisy_path", "noisy_image"), ("result_path", "result_image")):
        d[field] = _read_image(d.pop(key))

    return d


def get_experimental_run(user_id: int, run_id: int) -> Optional[dict]:
    with connect() as conn:
        row = conn.execute(
            "SELECT * FROM experimental_runs WHERE id = ? AND user_id = ?",
            (run_id, user_id),
        ).fetchone()

    if row is None:
        return None

    d = dict(row)
    d["entry_type"] = "experimental"
    d["history_key"] = f"experimental:{d['id']}"
    d["source_mode"] = d.get("source_mode") or "experimental"
    d["params"] = json.loads(d.pop("params_json"))
    d["input_image"] = _read_image(d.pop("input_path"))
    d["result_image"] = _read_image(d.pop("result_path"))

    return d


def get_history_entry(user_id: int, entry_type: str, entry_id: int) -> Optional[dict]:
    if entry_type == "optimization":
        return get_optimization(user_id, entry_id)
    if entry_type == "experimental":
        return get_experimental_run(user_id, entry_id)
    return None


def delete_optimization(user_id: int, opt_id: int) -> bool:
    with connect() as conn:
        cur = conn.execute(
            "DELETE FROM optimizations WHERE id = ? AND user_id = ?",
            (opt_id, user_id),
        )
        deleted = cur.rowcount > 0

    if deleted:
        shutil.rmtree(HISTORY_ROOT / str(opt_id), ignore_errors=True)

    return deleted


def delete_experimental_run(user_id: int, run_id: int) -> bool:
    with connect() as conn:
        cur = conn.execute(
            "DELETE FROM experimental_runs WHERE id = ? AND user_id = ?",
            (run_id, user_id),
        )
        deleted = cur.rowcount > 0

    if deleted:
        shutil.rmtree(EXPERIMENTAL_ROOT / str(run_id), ignore_errors=True)

    return deleted


def delete_history_entry(user_id: int, entry_type: str, entry_id: int) -> bool:
    if entry_type == "optimization":
        return delete_optimization(user_id, entry_id)
    if entry_type == "experimental":
        return delete_experimental_run(user_id, entry_id)
    return False
