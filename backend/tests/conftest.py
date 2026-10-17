"""Configuration commune des tests.

Lancer depuis la racine du projet (le dossier qui contient backend/) :
    python -m pytest backend/tests                      # mode debug (SQLite)
    TEST_BACKEND=turso python -m pytest backend/tests   # mode production contre un faux Turso
    (PowerShell : $env:TEST_BACKEND="turso"; python -m pytest backend/tests)
"""

from __future__ import annotations

import os
import socket
import sys
import threading
import time
from pathlib import Path

import pytest

RACINE = Path(__file__).resolve().parents[2]  # dossier qui contient backend/
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(Path(__file__).parent))  # fake_turso

TURSO = os.environ.get("TEST_BACKEND") == "turso"
VARIABLES = ("APP_MODE", "AUTH_SECRET", "TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN", "CORS_ORIGINS", "DB_DIR")


def port_libre() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _isoler(monkeypatch, tmp_path, variables):
    """Environnement vierge : ni .env réel, ni variables héritées, base dans un dossier temporaire."""
    monkeypatch.setattr(os, "environ", os.environ.copy())  # load_dotenv ne doit pas polluer les autres tests
    for nom in VARIABLES:
        monkeypatch.delenv(nom, raising=False)
    for nom, valeur in variables.items():
        monkeypatch.setenv(nom, valeur)
    import backend.config as cfg
    import backend.database as dbm

    faux_backend = tmp_path / "backend"
    faux_backend.mkdir(exist_ok=True)
    monkeypatch.setattr(cfg, "ROOT_DIR", faux_backend)
    monkeypatch.setattr(cfg, "DB_DIR", tmp_path / "db")
    cfg.get_settings.cache_clear()
    dbm.get_db.cache_clear()
    return cfg, dbm


@pytest.fixture
def env(monkeypatch, tmp_path):
    """env(APP_MODE="production", ...) -> (module config, module database), environnement isolé."""
    def appliquer(**variables):
        return _isoler(monkeypatch, tmp_path, variables)
    return appliquer


@pytest.fixture(scope="session")
def faux_turso():
    if not TURSO:
        yield None
        return
    import fake_turso
    import uvicorn

    port = port_libre()
    serveur = uvicorn.Server(uvicorn.Config(fake_turso.app, host="127.0.0.1", port=port, log_level="error"))
    fil = threading.Thread(target=serveur.run, daemon=True)
    fil.start()
    while not serveur.started:
        time.sleep(0.05)
    yield f"http://127.0.0.1:{port}", fake_turso
    serveur.should_exit = True


@pytest.fixture
def client(env, faux_turso):
    """Client de test sur l'application complète (debug/SQLite, ou production/faux Turso)."""
    from fastapi.testclient import TestClient

    if TURSO:
        import httpx

        url, ft = faux_turso
        httpx.post(url + "/__reset")
        env(APP_MODE="production", TURSO_DATABASE_URL=url, TURSO_AUTH_TOKEN=ft.TOKEN, AUTH_SECRET="s" * 48)
    else:
        env(APP_MODE="debug")
    import backend.database as dbm
    import backend.main as main

    with TestClient(main.create_app(), base_url="http://testserver", raise_server_exceptions=False) as c:
        yield c
    dbm.get_db.cache_clear()
