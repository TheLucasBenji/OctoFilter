from __future__ import annotations

import base64

import history


def test_save_read_list_and_delete_optimization(test_user, png_bytes) -> None:
    opt_id = history.save_optimization(
        test_user["id"],
        params_req={
            "filter_type": "bilateral",
            "metric": "mse",
            "noise_type": "gaussian",
            "noise_sigma": 25.0,
            "noise_amount": 0.05,
            "population": 9,
            "iterations": 5,
            "seed": 123,
            "algorithm": "ooa",
            "config_mode": "advanced",
        },
        result_payload={
            "metrics": {
                "mse": 1.0,
                "snr": 20.0,
                "piqe": None,
                "noisy_mse": 2.0,
                "noisy_snr": 15.0,
                "noisy_piqe": None,
                "best_cost": 1.0,
                "metric_used": "mse",
            },
            "params": {"d": 5.0},
            "convergence": [3.0, 2.0, 1.0],
        },
        images={"original": png_bytes, "noisy": png_bytes, "result": png_bytes},
        duration_ms=123,
    )

    assert history.count_history(test_user["id"]) == 1
    listing = history.list_history(test_user["id"])
    assert listing[0]["history_key"] == f"optimization:{opt_id}"
    assert listing[0]["algorithm"] == "ooa"

    detail = history.get_optimization(test_user["id"], opt_id)
    assert detail is not None
    assert detail["params"] == {"d": 5.0}
    assert detail["convergence"] == [3.0, 2.0, 1.0]
    assert base64.b64decode(detail["result_image"]) == png_bytes

    assert history.delete_optimization(test_user["id"], opt_id)
    assert history.get_optimization(test_user["id"], opt_id) is None
    assert history.count_history(test_user["id"]) == 0


def test_save_read_list_and_delete_experimental_run(test_user, png_bytes) -> None:
    run_id = history.save_experimental_run(
        test_user["id"],
        filter_type="nlmeans",
        params_used={"h": 10.0},
        images={"input": png_bytes, "result": png_bytes},
        duration_ms=50,
    )

    assert history.count_history(test_user["id"]) == 1
    listing = history.list_history(test_user["id"])
    assert listing[0]["history_key"] == f"experimental:{run_id}"
    assert listing[0]["entry_type"] == "experimental"

    detail = history.get_history_entry(test_user["id"], "experimental", run_id)
    assert detail is not None
    assert detail["params"] == {"h": 10.0}
    assert base64.b64decode(detail["input_image"]) == png_bytes

    assert history.delete_history_entry(test_user["id"], "experimental", run_id)
    assert history.get_experimental_run(test_user["id"], run_id) is None
