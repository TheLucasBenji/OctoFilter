from __future__ import annotations

import io
from pathlib import Path

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

import auth
import main


@pytest.fixture(autouse=True)
def isolated_storage(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("OCTOPUS_DB_PATH", str(tmp_path / "octopus.sqlite3"))
    monkeypatch.setenv("OCTOPUS_HISTORY_ROOT", str(tmp_path / "history"))
    main.jobs.clear()
    auth.init_auth_db()
    yield
    main.jobs.clear()


@pytest.fixture
def client() -> TestClient:
    with TestClient(main.app) as test_client:
        yield test_client


@pytest.fixture
def authenticated_client(client: TestClient) -> TestClient:
    response = client.post(
        "/api/auth/login",
        json={"email": auth.DEFAULT_EMAIL, "password": auth.DEFAULT_PASSWORD, "remember": True},
    )
    assert response.status_code == 200
    return client


@pytest.fixture
def test_user() -> dict:
    user = auth.authenticate_user(auth.DEFAULT_EMAIL, auth.DEFAULT_PASSWORD)
    assert user is not None
    return user


@pytest.fixture
def png_bytes() -> bytes:
    image = np.arange(64, dtype=np.uint8).reshape(8, 8) * 4
    ok, encoded = cv2.imencode(".png", image)
    assert ok
    return encoded.tobytes()


def upload_file(data: bytes, name: str = "fixture.png") -> dict:
    return {"image": (name, io.BytesIO(data), "image/png")}
