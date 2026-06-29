from __future__ import annotations

import io

import numpy as np

import main


def test_manual_param_coercion() -> None:
    bilateral = main._coerce_manual_params("bilateral", np.array([200, -5, 501], dtype=float))
    assert bilateral.tolist() == [101.0, 0.0, 500.0]

    anisotropic = main._coerce_manual_params("anisotropic", np.array([1.2, 20, 0.07, 1.7]))
    assert anisotropic.tolist() == [1.0, 20.0, 0.07, 2.0]


def test_algorithm_alias_and_eval_counts() -> None:
    assert main._canonical_algorithm("aquila") == "ao"
    assert main._canonical_algorithm("ooa") == "ooa"
    assert main._eval_counts("sfoa", population=9, iterations=5) == (0, 54)
    assert main._eval_counts("ao", population=9, iterations=5) == (0, 90)

    parallel, serial = main._eval_counts("ooa", population=10, iterations=5)
    assert parallel > 0
    assert serial > 0


def test_protected_endpoints_require_auth(client, png_bytes) -> None:
    assert client.get("/api/filters").status_code == 401

    response = client.post(
        "/api/preview-noise",
        files={"image": ("fixture.png", io.BytesIO(png_bytes), "image/png")},
    )
    assert response.status_code == 401


def test_filters_and_preview_noise(authenticated_client, png_bytes) -> None:
    filters = authenticated_client.get("/api/filters")
    assert filters.status_code == 200
    assert set(filters.json()) == {"bilateral", "anisotropic", "nlmeans"}

    preview = authenticated_client.post(
        "/api/preview-noise",
        files={"image": ("fixture.png", io.BytesIO(png_bytes), "image/png")},
        data={"noise_type": "gaussian", "noise_sigma": "5", "seed": "1"},
    )
    assert preview.status_code == 200
    body = preview.json()
    assert body["original_image"]
    assert body["noisy_image"]
    assert body["noisy_mse"] >= 0


def test_manual_filter_validation_and_history(authenticated_client, png_bytes) -> None:
    invalid = authenticated_client.post(
        "/api/manual-filter",
        files={"image": ("fixture.png", io.BytesIO(png_bytes), "image/png")},
        data={"filter_type": "bilateral", "params": "[1,2]"},
    )
    assert invalid.status_code == 400

    response = authenticated_client.post(
        "/api/manual-filter",
        files={"image": ("fixture.png", io.BytesIO(png_bytes), "image/png")},
        data={
            "filter_type": "bilateral",
            "params": "[4,20,20]",
            "save_history": "true",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["history_key"].startswith("experimental:")
    assert body["params_used"]["d (diameter)"] == 5.0
