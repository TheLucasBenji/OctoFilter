import asyncio
import base64
import json
import os
import queue
import sys
import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Optional

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import cv2
import numpy as np
from fastapi import Cookie, Depends, FastAPI, File, Form, HTTPException, Query, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from auth import (
    COOKIE_NAME,
    authenticate_user,
    create_session,
    get_user_for_session,
    init_auth_db,
    revoke_session,
)
import history as hist_mod
from filters import anisotropic, bilateral, nlmeans
from imaging import metrics as img_metrics
from imaging import noise as img_noise
from ooa.algorithm import ooa
from sfoa.algorithm import sfoa

app = FastAPI(title="Octopus API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FILTER_MODULES = {
    "bilateral": bilateral,
    "anisotropic": anisotropic,
    "nlmeans": nlmeans,
}

FILTER_LABELS = {
    "bilateral": "Bilateral",
    "anisotropic": "Anisotropic Diffusion",
    "nlmeans": "Non-Local Means",
}

MANUAL_PARAM_META = {
    "bilateral": [
        {"manual_lb": 1.0, "manual_ub": 101.0, "kind": "odd-int", "step": 2.0},
        {"manual_lb": 0.0, "manual_ub": 500.0, "kind": "float", "step": 0.1},
        {"manual_lb": 0.0, "manual_ub": 500.0, "kind": "float", "step": 0.1},
    ],
    "anisotropic": [
        {"manual_lb": 1.0, "manual_ub": 250.0, "kind": "int", "step": 1.0},
        {"manual_lb": 1.0, "manual_ub": 300.0, "kind": "float", "step": 0.1},
        {"manual_lb": 0.01, "manual_ub": 0.25, "kind": "float", "step": 0.01},
        {"manual_lb": 1.0, "manual_ub": 2.0, "kind": "choice", "step": 1.0, "choices": [1, 2]},
    ],
    "nlmeans": [
        {"manual_lb": 0.1, "manual_ub": 100.0, "kind": "float", "step": 0.1},
        {"manual_lb": 3.0, "manual_ub": 31.0, "kind": "odd-int", "step": 2.0},
        {"manual_lb": 5.0, "manual_ub": 101.0, "kind": "odd-int", "step": 2.0},
    ],
}

ALGORITHMS = {
    "ooa": ooa,
    "sfoa": sfoa,
}

ALGORITHM_LABELS = {
    "ooa": "Octopus",
    "sfoa": "Starfish",
}


@dataclass
class OptimizationJob:
    queue: queue.Queue
    cancelled: threading.Event
    created_at: float = field(default_factory=time.time)
    thread: Optional[threading.Thread] = None


class OptimizationCancelled(Exception):
    pass


jobs: dict[str, OptimizationJob] = {}

JOB_TTL_SECONDS = 3600


def _sweep_jobs() -> None:
    for job_id, job in list(jobs.items()):
        if time.time() - job.created_at > JOB_TTL_SECONDS and (
            job.thread is None or not job.thread.is_alive()
        ):
            jobs.pop(job_id, None)


class LoginRequest(BaseModel):
    email: str
    password: str
    remember: bool = True


@app.on_event("startup")
def startup():
    init_auth_db()


def set_session_cookie(response: Response, token: str, max_age: Optional[int]) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=max_age,
        path="/",
        httponly=True,
        secure=False,
        samesite="lax",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(key=COOKIE_NAME, path="/")


def require_user(session_token: Optional[str] = Cookie(default=None, alias=COOKIE_NAME)) -> dict:
    user = get_user_for_session(session_token)
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user


def encode_image(img: np.ndarray) -> str:
    if img.dtype != np.uint8:
        img = np.clip(img, 0, 255).astype(np.uint8)
    _, buf = cv2.imencode(".png", img)
    return base64.b64encode(buf).decode()


def decode_image(data: bytes) -> np.ndarray:
    arr = np.frombuffer(data, np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE)


def _nearest_choice(value: float, choices: list[int]) -> float:
    return float(min(choices, key=lambda choice: abs(choice - value)))


def _coerce_manual_value(value: float, meta: dict) -> float:
    kind = meta.get("kind", "float")

    if kind == "choice":
        return _nearest_choice(value, meta["choices"])

    lb = float(meta["manual_lb"])
    ub = float(meta["manual_ub"])

    if kind == "float":
        return float(np.clip(value, lb, ub))

    coerced = int(round(float(np.clip(value, lb, ub))))
    min_val = int(lb)
    max_val = int(ub)

    if kind == "odd-int" and coerced % 2 == 0:
        coerced = coerced - 1 if coerced >= max_val else coerced + 1

    return float(np.clip(coerced, min_val, max_val))


def _coerce_manual_params(filter_type: str, params_arr: np.ndarray) -> np.ndarray:
    meta = MANUAL_PARAM_META[filter_type]
    return np.array(
        [_coerce_manual_value(float(value), param_meta) for value, param_meta in zip(params_arr, meta)],
        dtype=float,
    )


@app.post("/api/auth/login")
def login(payload: LoginRequest, response: Response):
    user = authenticate_user(payload.email, payload.password)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token, expires_at, max_age = create_session(user_id=user["id"], remember=payload.remember)
    set_session_cookie(response, token, max_age)
    return {"user": user, "expires_at": expires_at}


@app.get("/api/auth/me")
def me(user: dict = Depends(require_user)):
    return {"user": user}


@app.post("/api/auth/logout")
def logout(
    response: Response,
    session_token: Optional[str] = Cookie(default=None, alias=COOKIE_NAME),
):
    revoke_session(session_token)
    clear_session_cookie(response)
    return {"status": "logged_out"}


def run_optimization(
    job_id: str,
    original: np.ndarray,
    noisy: np.ndarray,
    filter_type: str,
    metric: str,
    algorithm: str,
    population: int,
    iterations: int,
    seed: Optional[int],
    q: queue.Queue,
    cancelled: threading.Event,
    user_id: int,
    started_at: float,
    params_req: dict,
    original_bytes: bytes,
    noisy_bytes: bytes,
):
    try:
        fmod = FILTER_MODULES[filter_type]
        rng = np.random.default_rng(seed)

        lb = fmod.LOWER_BOUNDS.copy()
        ub = fmod.UPPER_BOUNDS.copy()

        noise_estimate = float(np.std(noisy.astype(np.float32) - original.astype(np.float32)))

        if filter_type == "bilateral":
            lb[1] = max(10.0, noise_estimate * 0.5)
            ub[1] = min(200.0, noise_estimate * 3.0)
            lb[2] = max(10.0, noise_estimate * 0.5)
            ub[2] = min(200.0, noise_estimate * 3.0)
        elif filter_type == "anisotropic":
            lb[1] = max(10.0, noise_estimate * 0.5)
            ub[1] = min(100.0, noise_estimate * 3.0)

        noisy_f32 = noisy.astype(np.float32)
        original_f32 = original.astype(np.float32)

        def check_cancelled():
            if cancelled.is_set():
                raise OptimizationCancelled()

        def objective(params: np.ndarray) -> float:
            check_cancelled()
            filtered = fmod.apply(noisy_f32, params)
            check_cancelled()
            if metric == "mse":
                return img_metrics.mse(original_f32, filtered)
            elif metric == "snr":
                return -img_metrics.snr(original_f32, filtered)
            elif metric == "piqe":
                u8 = np.clip(filtered, 0, 255).astype(np.uint8)
                return img_metrics.piqe(u8)
            return img_metrics.mse(original_f32, filtered)

        def on_iter(iteration: int, best_cost: float, _best_pos: np.ndarray):
            check_cancelled()
            q.put_nowait({
                "type": "progress",
                "iteration": iteration,
                "cost": float(best_cost),
            })

        algo_fn = ALGORITHMS[algorithm]
        best_cost, best_pos, convergence = algo_fn(
            n_population=population,
            max_iter=iterations,
            lb=lb,
            ub=ub,
            dim=fmod.DIM,
            objective_fn=objective,
            on_iteration=on_iter,
            rng=rng,
        )

        check_cancelled()
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

        complete_metrics = {
            "mse": float(mse_val),
            "snr": float(snr_val),
            "piqe": float(piqe_result) if piqe_result is not None else None,
            "noisy_mse": float(noisy_mse),
            "noisy_snr": float(noisy_snr),
            "noisy_piqe": float(piqe_noisy) if piqe_noisy is not None else None,
            "best_cost": float(best_cost),
            "metric_used": metric,
        }
        complete_params = {name: float(val) for name, val in zip(fmod.PARAM_NAMES, best_pos)}
        complete_convergence = [float(c) for c in convergence]

        try:
            _, result_buf = cv2.imencode(".png", result_u8)
            hist_mod.save_optimization(
                user_id,
                params_req=params_req,
                result_payload={
                    "metrics": complete_metrics,
                    "params": complete_params,
                    "convergence": complete_convergence,
                },
                images={
                    "original": original_bytes,
                    "noisy": noisy_bytes,
                    "result": result_buf.tobytes(),
                },
                duration_ms=int((time.time() - started_at) * 1000),
            )
        except Exception:
            import traceback as _tb
            print(_tb.format_exc(), flush=True)

        q.put_nowait({
            "type": "complete",
            "result_image": encode_image(result_u8),
            "convergence": complete_convergence,
            "metrics": complete_metrics,
            "params": complete_params,
        })
    except OptimizationCancelled:
        q.put_nowait({"type": "cancelled"})
    except Exception as exc:
        import traceback
        q.put_nowait({"type": "error", "message": str(exc), "trace": traceback.format_exc()})


@app.get("/api/filters")
def get_filters(_user: dict = Depends(require_user)):
    def build_param(mod, key: str, idx: int, name: str, lb: float, ub: float) -> dict:
        metadata = getattr(mod, "PARAM_METADATA", [])
        param_meta = dict(metadata[idx]) if idx < len(metadata) else {}
        return {
            "name": name,
            "lb": float(lb),
            "ub": float(ub),
            **MANUAL_PARAM_META[key][idx],
            **param_meta,
        }

    return {
        key: {
            "label": FILTER_LABELS[key],
            "dim": mod.DIM,
            "params": [
                build_param(mod, key, idx, name, lb, ub)
                for idx, (name, lb, ub) in enumerate(zip(mod.PARAM_NAMES, mod.LOWER_BOUNDS, mod.UPPER_BOUNDS))
            ],
        }
        for key, mod in FILTER_MODULES.items()
    }


@app.post("/api/manual-filter")
async def manual_filter(
    _user: dict = Depends(require_user),
    image: UploadFile = File(...),
    filter_type: str = Form("bilateral"),
    params: str = Form(...),
):
    data = await image.read()
    img = decode_image(data)
    if img is None:
        raise HTTPException(400, "Invalid image")

    if filter_type not in FILTER_MODULES:
        raise HTTPException(400, f"filter_type inválido: '{filter_type}'")

    try:
        raw_params = json.loads(params)
    except Exception as exc:
        raise HTTPException(400, "params inválidos") from exc

    if not isinstance(raw_params, (list, tuple)):
        raise HTTPException(400, "params inválidos")

    fmod = FILTER_MODULES[filter_type]
    if len(raw_params) != fmod.DIM:
        raise HTTPException(400, f"params debe tener {fmod.DIM} valores")

    try:
        params_arr = np.array(raw_params, dtype=float)
    except Exception as exc:
        raise HTTPException(400, "params inválidos") from exc

    if not np.all(np.isfinite(params_arr)):
        raise HTTPException(400, "params inválidos")

    params_arr = _coerce_manual_params(filter_type, params_arr)
    result = fmod.apply(img, params_arr)
    result_u8 = np.clip(result, 0, 255).astype(np.uint8)

    return {
        "original_image": encode_image(img),
        "result_image": encode_image(result_u8),
        "params_used": {name: float(val) for name, val in zip(fmod.PARAM_NAMES, params_arr)},
    }


@app.post("/api/preview-noise")
async def preview_noise(
    _user: dict = Depends(require_user),
    image: UploadFile = File(...),
    noise_type: str = Form("gaussian"),
    noise_sigma: float = Form(25.0),
    noise_amount: float = Form(0.05),
    seed: Optional[int] = Form(None),
):
    data = await image.read()
    img = decode_image(data)
    if img is None:
        raise HTTPException(400, "Invalid image")

    rng = np.random.default_rng(seed)
    if noise_type == "gaussian":
        noisy = img_noise.add_gaussian_noise(img, sigma=noise_sigma, rng=rng)
    else:
        noisy = img_noise.add_salt_and_pepper_noise(img, amount=noise_amount, rng=rng)

    return {
        "noisy_image": encode_image(noisy),
        "original_image": encode_image(img),
        "noisy_mse": float(img_metrics.mse(img.astype(np.float32), noisy.astype(np.float32))),
        "noisy_snr": float(img_metrics.snr(img.astype(np.float32), noisy.astype(np.float32))),
    }


@app.post("/api/optimize")
async def start_optimize(
    _user: dict = Depends(require_user),
    image: UploadFile = File(...),
    filter_type: str = Form("bilateral"),
    metric: str = Form("mse"),
    noise_type: str = Form("gaussian"),
    noise_sigma: float = Form(25.0),
    noise_amount: float = Form(0.05),
    population: int = Form(30),
    iterations: int = Form(50),
    seed: Optional[int] = Form(None),
    algorithm: str = Form("ooa"),
):
    data = await image.read()
    original = decode_image(data)
    if original is None:
        raise HTTPException(400, "Invalid image")

    if filter_type not in FILTER_MODULES:
        raise HTTPException(400, f"filter_type inválido: '{filter_type}'")
    if metric not in {"mse", "snr", "piqe"}:
        raise HTTPException(400, f"metric inválido: '{metric}'")
    if noise_type not in {"gaussian", "sp"}:
        raise HTTPException(400, f"noise_type inválido: '{noise_type}'")
    if not (9 <= population <= 200):
        raise HTTPException(400, "population debe estar entre 9 y 200")
    if not (1 <= iterations <= 500):
        raise HTTPException(400, "iterations debe estar entre 1 y 500")
    if noise_sigma < 0:
        raise HTTPException(400, "noise_sigma debe ser >= 0")
    if not (0.0 <= noise_amount <= 1.0):
        raise HTTPException(400, "noise_amount debe estar entre 0 y 1")
    if algorithm not in ALGORITHMS:
        raise HTTPException(400, f"algorithm inválido: '{algorithm}'")

    rng_noise = np.random.default_rng(seed)
    if noise_type == "gaussian":
        noisy = img_noise.add_gaussian_noise(original, sigma=noise_sigma, rng=rng_noise)
    else:
        noisy = img_noise.add_salt_and_pepper_noise(original, amount=noise_amount, rng=rng_noise)

    _, orig_buf = cv2.imencode(".png", original)
    _, noisy_buf = cv2.imencode(".png", noisy)
    original_bytes = orig_buf.tobytes()
    noisy_bytes = noisy_buf.tobytes()

    params_req = {
        "filter_type": filter_type,
        "metric": metric,
        "noise_type": noise_type,
        "noise_sigma": noise_sigma,
        "noise_amount": noise_amount,
        "population": population,
        "iterations": iterations,
        "seed": seed,
        "algorithm": algorithm,
    }

    _sweep_jobs()
    job_id = str(uuid.uuid4())
    q: queue.Queue = queue.Queue()
    cancelled = threading.Event()
    job = OptimizationJob(queue=q, cancelled=cancelled)
    jobs[job_id] = job

    t = threading.Thread(
        target=run_optimization,
        args=(
            job_id, original, noisy, filter_type, metric, algorithm, population, iterations, seed,
            q, cancelled,
            _user["id"], time.time(), params_req, original_bytes, noisy_bytes,
        ),
        daemon=True,
    )
    job.thread = t
    t.start()

    return {
        "job_id": job_id,
        "noisy_image": encode_image(noisy),
        "original_image": encode_image(original),
    }


@app.post("/api/optimize/{job_id}/cancel")
async def cancel_optimize(job_id: str, _user: dict = Depends(require_user)):
    job = jobs.get(job_id)
    if job is None:
        raise HTTPException(404, "Job not found")

    job.cancelled.set()
    return {"status": "cancelling"}


@app.get("/api/optimize/{job_id}/stream")
async def stream_optimize(job_id: str, _user: dict = Depends(require_user)):
    job = jobs.get(job_id)
    if job is None:
        raise HTTPException(404, "Job not found")

    q = job.queue
    loop = asyncio.get_running_loop()

    def poll():
        try:
            return q.get(timeout=0.2)
        except Exception:
            return None

    async def generator():
        try:
            while True:
                event = await loop.run_in_executor(None, poll)
                if event is None:
                    yield 'data: {"type":"ping"}\n\n'
                else:
                    yield f"data: {json.dumps(event)}\n\n"
                    if event.get("type") in ("complete", "error", "cancelled"):
                        break
        finally:
            jobs.pop(job_id, None)

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/api/history")
def list_history(
    user: dict = Depends(require_user),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    return hist_mod.list_optimizations(user["id"], limit=limit, offset=offset)


@app.get("/api/history/{opt_id}")
def get_history_item(opt_id: int, user: dict = Depends(require_user)):
    item = hist_mod.get_optimization(user["id"], opt_id)
    if item is None:
        raise HTTPException(404, "Not found")
    return item


@app.delete("/api/history/{opt_id}", status_code=204)
def delete_history_item(opt_id: int, user: dict = Depends(require_user)):
    if not hist_mod.delete_optimization(user["id"], opt_id):
        raise HTTPException(404, "Not found")
