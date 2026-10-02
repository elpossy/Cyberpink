"""Accès à la base de données.

Deux moteurs, même interface :
  - SQLiteBackend : fichier local db/cyberpink.db          (APP_MODE=debug)
  - TursoBackend  : Turso/libSQL via son API HTTP (Hrana) (APP_MODE=production)

Le schéma est strictement identique à celui de l'ancienne application Next.js,
les données existantes sur Turso restent donc utilisables telles quelles.
"""

from __future__ import annotations

import base64
import logging
import sqlite3
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Any, Sequence

import httpx

from .config import Settings, get_settings

log = logging.getLogger("cyberpink.db")

Args = Sequence[Any]


# --------------------------------------------------------------------------- #
# Erreurs et résultat
# --------------------------------------------------------------------------- #
class DatabaseError(Exception):
    """Erreur générique d'accès à la base."""


class IntegrityError(DatabaseError):
    """Violation de contrainte (doublon UNIQUE, clé étrangère...)."""


@dataclass
class QueryResult:
    rows: list[dict[str, Any]] = field(default_factory=list)
    last_insert_id: int = 0
    rows_affected: int = 0


# --------------------------------------------------------------------------- #
# Schéma (migrations idempotentes, identiques à l'ancien db.ts)
# --------------------------------------------------------------------------- #
MIGRATIONS: list[str] = [
    # --- suivi des migrations ---
    """CREATE TABLE IF NOT EXISTS _migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        applied_at TEXT DEFAULT CURRENT_TIMESTAMP
    )""",
    # --- utilisateurs ---
    """CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        phone TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )""",
    "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)",
    "CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone)",
    # --- commentaires ---
    """CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        author_name TEXT,
        subject TEXT NOT NULL,
        content TEXT NOT NULL,
        visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
        parent_id INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
    )""",
    "CREATE INDEX IF NOT EXISTS idx_comments_subject ON comments(subject)",
    "CREATE INDEX IF NOT EXISTS idx_comments_visibility ON comments(visibility)",
    "CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id)",
    "CREATE INDEX IF NOT EXISTS idx_comments_created ON comments(created_at DESC)",
    # --- contacts ---
    """CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        subject TEXT,
        message TEXT NOT NULL,
        source TEXT DEFAULT 'site-cyberpink',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )""",
    "CREATE INDEX IF NOT EXISTS idx_contacts_created ON contacts(created_at DESC)",
    # --- dons ---
    """CREATE TABLE IF NOT EXISTS donations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        product TEXT,
        message TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )""",
    "CREATE INDEX IF NOT EXISTS idx_donations_user ON donations(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_donations_created ON donations(created_at DESC)",
]

MARQUEUR_SCHEMA = "v1_core_schema"


# --------------------------------------------------------------------------- #
# Moteur 1 : SQLite local
# --------------------------------------------------------------------------- #
class SQLiteBackend:
    """Fichier SQLite local. Une connexion courte par appel (simple et thread-safe)."""

    def __init__(self, path) -> None:
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.path, timeout=10)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def execute_many(self, statements: Sequence[tuple[str, Args]]) -> list[QueryResult]:
        conn = self._connect()
        resultats: list[QueryResult] = []
        try:
            for sql, args in statements:
                cur = conn.execute(sql, tuple(args))
                rows = [dict(r) for r in cur.fetchall()] if cur.description else []
                resultats.append(
                    QueryResult(
                        rows=rows,
                        last_insert_id=cur.lastrowid or 0,
                        rows_affected=max(cur.rowcount, 0),
                    )
                )
            conn.commit()
            return resultats
        except sqlite3.IntegrityError as exc:
            conn.rollback()
            raise IntegrityError(str(exc)) from exc
        except sqlite3.Error as exc:
            conn.rollback()
            raise DatabaseError(str(exc)) from exc
        finally:
            conn.close()

    def close(self) -> None:  # rien à fermer : connexions éphémères
        pass


# --------------------------------------------------------------------------- #
# Moteur 2 : Turso (libSQL) via l'API HTTP "pipeline" (Hrana over HTTP)
# --------------------------------------------------------------------------- #
class TursoBackend:
    """Client minimal pour Turso : POST {url}/v2/pipeline avec un jeton Bearer."""

    def __init__(self, url: str, token: str | None) -> None:
        base = url.strip().rstrip("/")
        for ancien, nouveau in (
            ("libsql://", "https://"),
            ("wss://", "https://"),
            ("ws://", "http://"),
        ):
            if base.startswith(ancien):
                base = nouveau + base[len(ancien):]
                break
        self.endpoint = f"{base}/v2/pipeline"

        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        self._client = httpx.Client(
            headers=headers,
            timeout=httpx.Timeout(20.0, connect=10.0),
        )

    # -- encodage / décodage des valeurs Hrana --
    @staticmethod
    def _encode(valeur: Any) -> dict[str, Any]:
        if valeur is None:
            return {"type": "null"}
        if isinstance(valeur, bool):
            return {"type": "integer", "value": "1" if valeur else "0"}
        if isinstance(valeur, int):
            return {"type": "integer", "value": str(valeur)}
        if isinstance(valeur, float):
            return {"type": "float", "value": valeur}
        if isinstance(valeur, (bytes, bytearray)):
            return {"type": "blob", "base64": base64.b64encode(bytes(valeur)).decode()}
        return {"type": "text", "value": str(valeur)}

    @staticmethod
    def _decode(cellule: dict[str, Any]) -> Any:
        type_ = cellule.get("type")
        if type_ == "null":
            return None
        if type_ == "integer":
            return int(cellule["value"])
        if type_ == "float":
            return float(cellule["value"])
        if type_ == "blob":
            return base64.b64decode(cellule.get("base64", ""))
        return cellule.get("value")

    def _post(self, payload: dict[str, Any]) -> dict[str, Any]:
        derniere: Exception | None = None
        for _ in range(2):  # 1 nouvel essai en cas de coupure réseau
            try:
                reponse = self._client.post(self.endpoint, json=payload)
                break
            except httpx.TransportError as exc:
                derniere = exc
        else:
            raise DatabaseError(f"Turso injoignable : {derniere}") from derniere

        if reponse.status_code >= 400:
            raise DatabaseError(f"Turso a répondu HTTP {reponse.status_code} : {reponse.text[:200]}")
        return reponse.json()

    def execute_many(self, statements: Sequence[tuple[str, Args]]) -> list[QueryResult]:
        requetes: list[dict[str, Any]] = [
            {
                "type": "execute",
                "stmt": {"sql": sql, "args": [self._encode(a) for a in args]},
            }
            for sql, args in statements
        ]
        requetes.append({"type": "close"})
        donnees = self._post({"requests": requetes})

        resultats: list[QueryResult] = []
        for item in donnees.get("results", [])[: len(statements)]:
            if item.get("type") == "error":
                erreur = item.get("error", {})
                message = erreur.get("message", "erreur inconnue")
                code = str(erreur.get("code", ""))
                if "constraint" in message.lower() or "CONSTRAINT" in code:
                    raise IntegrityError(message)
                raise DatabaseError(message)

            res = item["response"]["result"]
            colonnes = [c.get("name") for c in res.get("cols", [])]
            lignes = [
                {nom: self._decode(cel) for nom, cel in zip(colonnes, ligne)}
                for ligne in res.get("rows", [])
            ]
            dernier = res.get("last_insert_rowid")
            resultats.append(
                QueryResult(
                    rows=lignes,
                    last_insert_id=int(dernier) if dernier is not None else 0,
                    rows_affected=int(res.get("affected_row_count", 0) or 0),
                )
            )
        if len(resultats) != len(statements):
            raise DatabaseError("Réponse Turso incomplète.")
        return resultats

    def close(self) -> None:
        self._client.close()


# --------------------------------------------------------------------------- #
# Façade utilisée par les routes
# --------------------------------------------------------------------------- #
class Database:
    def __init__(self, backend: SQLiteBackend | TursoBackend, label: str) -> None:
        self._backend = backend
        self.label = label

    def all(self, sql: str, args: Args = ()) -> list[dict[str, Any]]:
        return self._backend.execute_many([(sql, args)])[0].rows

    def get(self, sql: str, args: Args = ()) -> dict[str, Any] | None:
        rows = self.all(sql, args)
        return rows[0] if rows else None

    def run(self, sql: str, args: Args = ()) -> QueryResult:
        return self._backend.execute_many([(sql, args)])[0]

    def init_schema(self) -> None:
        """Crée les tables et index s'ils n'existent pas (idempotent)."""
        statements: list[tuple[str, Args]] = [(sql, ()) for sql in MIGRATIONS]
        statements.append(
            ("INSERT OR IGNORE INTO _migrations (name) VALUES (?)", (MARQUEUR_SCHEMA,))
        )
        self._backend.execute_many(statements)
        log.info("Schéma prêt (%s).", self.label)

    def close(self) -> None:
        self._backend.close()


def create_database(settings: Settings) -> Database:
    if settings.is_production:
        assert settings.turso_url  # garanti par config.get_settings()
        return Database(TursoBackend(settings.turso_url, settings.turso_token), "turso")
    return Database(SQLiteBackend(settings.sqlite_path), f"sqlite:{settings.sqlite_path.name}")


@lru_cache
def get_db() -> Database:
    return create_database(get_settings())
