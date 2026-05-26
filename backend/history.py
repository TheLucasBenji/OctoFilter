import base64
import json
import shutil
from pathlib import Path
from typing import Optional

from auth import connect, now_iso

HISTORY_ROOT = Path(__file__).parent / "data" / "history"


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
                duration_ms, algorithm
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?)
            """,
            (
                user_id, now_iso(),
                params_req["filter_type"], params_req["metric"], params_req["noise_type"],
                params_req["noise_sigma"], params_req["noise_amount"],
                params_req["population"], params_req["iterations"],
                params_req.get("seed"),
                json.dumps(best_params), json.dumps(metrics), json.dumps(convergence),
                float(metrics["best_cost"]), metrics["metric_used"],
                duration_ms, params_req.get("algorithm"),
            ),
        )
        opt_id = cur.lastrowid

    entry_dir = HISTORY_ROOT / str(opt_id)
    entry_dir.mkdir(parents=True, exist_ok=True)

    paths = {}
    for name, img_bytes in images.items():
        p = entry_dir / f"{name}.png"
        p.write_bytes(img_bytes)
        paths[name] = str(Path(str(opt_id)) / f"{name}.png")

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


def list_optimizations(user_id: int, limit: int = 50, offset: int = 0) -> list:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT id, created_at, filter_type, metric_type, best_cost, metric_used, algorithm
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
    d["params"] = json.loads(d.pop("params_json"))
    d["metrics"] = json.loads(d.pop("metrics_json"))
    d["convergence"] = json.loads(d.pop("convergence_json"))

    for key, field in (("original_path", "original_image"), ("noisy_path", "noisy_image"), ("result_path", "result_image")):
        path_str = d.pop(key)
        if path_str:
            img_path = HISTORY_ROOT / path_str
            if img_path.exists():
                d[field] = base64.b64encode(img_path.read_bytes()).decode()
            else:
                d[field] = None
        else:
            d[field] = None

    return d


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
