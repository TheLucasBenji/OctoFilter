from __future__ import annotations

import sqlite3

import auth


def test_init_auth_db_creates_default_user() -> None:
    user = auth.authenticate_user(auth.DEFAULT_EMAIL, auth.DEFAULT_PASSWORD)

    assert user == {"id": 1, "email": auth.DEFAULT_EMAIL}


def test_password_hash_verification() -> None:
    stored = auth.hash_password("secret")

    assert auth.verify_password("secret", stored)
    assert not auth.verify_password("wrong", stored)
    assert not auth.verify_password("secret", "not-a-valid-hash")


def test_login_me_and_logout_flow(client) -> None:
    bad_login = client.post(
        "/api/auth/login",
        json={"email": auth.DEFAULT_EMAIL, "password": "bad-password"},
    )
    assert bad_login.status_code == 401

    login = client.post(
        "/api/auth/login",
        json={"email": auth.DEFAULT_EMAIL, "password": auth.DEFAULT_PASSWORD, "remember": False},
    )
    assert login.status_code == 200
    assert auth.COOKIE_NAME in login.cookies
    assert login.json()["user"]["email"] == auth.DEFAULT_EMAIL

    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["user"]["email"] == auth.DEFAULT_EMAIL

    logout = client.post("/api/auth/logout")
    assert logout.status_code == 200

    after_logout = client.get("/api/auth/me")
    assert after_logout.status_code == 401


def test_expired_session_is_revoked(monkeypatch) -> None:
    user = auth.authenticate_user(auth.DEFAULT_EMAIL, auth.DEFAULT_PASSWORD)
    assert user is not None
    token, _, _ = auth.create_session(user["id"], remember=False)

    with auth.connect() as conn:
        conn.execute(
            "UPDATE sessions SET expires_at = ? WHERE token_hash = ?",
            ("2000-01-01T00:00:00+00:00", auth.hash_token(token)),
        )

    assert auth.get_user_for_session(token) is None

    with auth.connect() as conn:
        row: sqlite3.Row = conn.execute(
            "SELECT revoked_at FROM sessions WHERE token_hash = ?",
            (auth.hash_token(token),),
        ).fetchone()
    assert row["revoked_at"] is not None
