import base64
import hashlib
import hmac
import os
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional


COOKIE_NAME = "octopus_session"
DEFAULT_EMAIL = "test@mail.com"
DEFAULT_PASSWORD = "Test2026"
PASSWORD_ITERATIONS = 210_000

DEFAULT_DB_PATH = Path(__file__).resolve().parent / "data" / "octopus.sqlite3"


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def now_iso() -> str:
    return now_utc().isoformat()


def get_db_path() -> Path:
    configured = os.environ.get("OCTOPUS_DB_PATH")
    if configured:
        return Path(configured).expanduser()
    return DEFAULT_DB_PATH


def connect() -> sqlite3.Connection:
    db_path = get_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        PASSWORD_ITERATIONS,
    )
    return "$".join(
        [
            "pbkdf2_sha256",
            str(PASSWORD_ITERATIONS),
            base64.b64encode(salt).decode("ascii"),
            base64.b64encode(digest).decode("ascii"),
        ]
    )


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, iterations, salt_b64, digest_b64 = stored_hash.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        salt = base64.b64decode(salt_b64.encode("ascii"))
        expected = base64.b64decode(digest_b64.encode("ascii"))
        candidate = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt,
            int(iterations),
        )
        return hmac.compare_digest(candidate, expected)
    except Exception:
        return False


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def init_auth_db() -> None:
    with connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              email TEXT NOT NULL UNIQUE COLLATE NOCASE,
              password_hash TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              token_hash TEXT NOT NULL UNIQUE,
              created_at TEXT NOT NULL,
              expires_at TEXT NOT NULL,
              revoked_at TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_sessions_token_hash
              ON sessions(token_hash);

            CREATE INDEX IF NOT EXISTS idx_sessions_user_id
              ON sessions(user_id);

            CREATE TABLE IF NOT EXISTS optimizations (
              id            INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              created_at    TEXT    NOT NULL,
              filter_type   TEXT    NOT NULL,
              metric_type   TEXT    NOT NULL,
              noise_type    TEXT    NOT NULL,
              noise_sigma   REAL    NOT NULL,
              noise_amount  REAL    NOT NULL,
              population    INTEGER NOT NULL,
              iterations    INTEGER NOT NULL,
              seed          INTEGER,
              params_json       TEXT NOT NULL,
              metrics_json      TEXT NOT NULL,
              convergence_json  TEXT NOT NULL,
              best_cost     REAL    NOT NULL,
              metric_used   TEXT    NOT NULL,
              original_path TEXT,
              noisy_path    TEXT,
              result_path   TEXT,
              duration_ms   INTEGER,
              algorithm     TEXT,
              config_mode   TEXT NOT NULL DEFAULT 'advanced'
            );

            CREATE INDEX IF NOT EXISTS idx_optimizations_user_created
              ON optimizations(user_id, created_at DESC);

            CREATE TABLE IF NOT EXISTS experimental_runs (
              id            INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              created_at    TEXT    NOT NULL,
              filter_type   TEXT    NOT NULL,
              params_json   TEXT    NOT NULL,
              input_path    TEXT,
              result_path   TEXT,
              duration_ms   INTEGER,
              source_mode   TEXT NOT NULL DEFAULT 'experimental'
            );

            CREATE INDEX IF NOT EXISTS idx_experimental_runs_user_created
              ON experimental_runs(user_id, created_at DESC);
            """
        )

        # Migration: add algorithm column to existing databases
        try:
            conn.execute("ALTER TABLE optimizations ADD COLUMN algorithm TEXT")
        except Exception:
            pass  # column already exists

        try:
            conn.execute(
                "ALTER TABLE optimizations ADD COLUMN config_mode TEXT NOT NULL DEFAULT 'advanced'"
            )
        except Exception:
            pass  # column already exists

        conn.execute(
            "DELETE FROM sessions WHERE expires_at <= ? OR revoked_at IS NOT NULL",
            (now_iso(),),
        )

        existing = conn.execute(
            "SELECT id FROM users WHERE email = ?",
            (DEFAULT_EMAIL,),
        ).fetchone()

        if existing is None:
            timestamp = now_iso()
            conn.execute(
                """
                INSERT INTO users (email, password_hash, created_at, updated_at)
                VALUES (?, ?, ?, ?)
                """,
                (DEFAULT_EMAIL, hash_password(DEFAULT_PASSWORD), timestamp, timestamp),
            )


def user_payload(row: sqlite3.Row) -> dict:
    return {"id": int(row["id"]), "email": row["email"]}


def authenticate_user(email: str, password: str) -> Optional[dict]:
    normalized_email = email.strip().lower()
    if not normalized_email or not password:
        return None

    with connect() as conn:
        row = conn.execute(
            "SELECT id, email, password_hash FROM users WHERE email = ?",
            (normalized_email,),
        ).fetchone()

    if row is None or not verify_password(password, row["password_hash"]):
        return None

    return user_payload(row)


def create_session(user_id: int, remember: bool) -> tuple[str, str, Optional[int]]:
    token = secrets.token_urlsafe(32)
    created_at = now_utc()
    max_age = 60 * 60 * 24 * 30 if remember else None
    expires_at = created_at + timedelta(seconds=max_age or 60 * 60 * 12)

    with connect() as conn:
        conn.execute(
            """
            INSERT INTO sessions (user_id, token_hash, created_at, expires_at, revoked_at)
            VALUES (?, ?, ?, ?, NULL)
            """,
            (
                user_id,
                hash_token(token),
                created_at.isoformat(),
                expires_at.isoformat(),
            ),
        )

    return token, expires_at.isoformat(), max_age


def get_user_for_session(token: Optional[str]) -> Optional[dict]:
    if not token:
        return None

    with connect() as conn:
        row = conn.execute(
            """
            SELECT
              sessions.id AS session_id,
              sessions.expires_at,
              users.id,
              users.email
            FROM sessions
            JOIN users ON users.id = sessions.user_id
            WHERE sessions.token_hash = ?
              AND sessions.revoked_at IS NULL
            """,
            (hash_token(token),),
        ).fetchone()

        if row is None:
            return None

        expires_at = datetime.fromisoformat(row["expires_at"])
        if expires_at <= now_utc():
            conn.execute(
                "UPDATE sessions SET revoked_at = ? WHERE id = ?",
                (now_iso(), row["session_id"]),
            )
            return None

        return user_payload(row)


def revoke_session(token: Optional[str]) -> None:
    if not token:
        return

    with connect() as conn:
        conn.execute(
            """
            UPDATE sessions
            SET revoked_at = ?
            WHERE token_hash = ?
              AND revoked_at IS NULL
            """,
            (now_iso(), hash_token(token)),
        )
