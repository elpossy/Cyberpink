"""Garde-fous contre un dossier backend/ incohérent (fichiers de plusieurs versions mélangés)."""

import importlib
import pkgutil
import re
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[1]

ROUTES_ATTENDUES = {
    ("POST", "/api/auth/register"), ("POST", "/api/auth/login"), ("POST", "/api/auth/logout"), ("GET", "/api/auth/me"),
    ("GET", "/api/comments"), ("POST", "/api/comments"), ("POST", "/api/contact"), ("POST", "/api/dons"),
    ("GET", "/api/health"),
}


def test_main_importable_et_sans_page_html(env):
    env()
    main = importlib.import_module("backend.main")
    assert main.create_app() is not None


def test_aucune_reference_a_l_ancien_module_pages():
    for fichier in BACKEND.rglob("*.py"):
        if "tests" in fichier.parts:
            continue
        texte = fichier.read_text(encoding="utf-8")
        assert not re.search(r"\bpages\b\s*\.\s*router|routers\s+import[^\n]*\bpages\b|routers\.pages", texte), (
            f"{fichier.name} référence encore l'ancien module « pages » (version périmée de ce fichier ?)")


def _routes_de_l_application(app):
    """Couples (méthode, chemin) lus dans le schéma OpenAPI (stable d'une version de FastAPI à l'autre)."""
    return {(m.upper(), chemin) for chemin, ops in app.openapi()["paths"].items() for m in ops}


def test_routes_exactement_celles_attendues(client):
    assert _routes_de_l_application(client.app) == ROUTES_ATTENDUES


def test_chaque_routeur_est_branche(client):
    import backend.routers as paquet
    branchees = _routes_de_l_application(client.app)
    modules = [m.name for m in pkgutil.iter_modules(paquet.__path__)]
    assert set(modules) == {"auth", "comments", "contact", "dons", "health"}, modules  # un module en trop = fichier d'une autre version
    for nom in modules:
        mod = importlib.import_module(f"backend.routers.{nom}")
        assert hasattr(mod, "router"), f"routers/{nom}.py n'expose pas « router »"
        propres = _routes_de_l_application(_app_avec(mod.router))
        assert propres and propres <= branchees, f"routers/{nom}.py : routes non branchées dans main.py : {propres - branchees}"


def _app_avec(routeur):
    from fastapi import FastAPI
    app = FastAPI()
    app.include_router(routeur)
    return app


def test_requirements_uvloop_exclu_sous_windows():
    ligne = next(l for l in (BACKEND / "requirements.txt").read_text().splitlines() if l.startswith("uvloop"))
    assert 'sys_platform != "win32"' in ligne, "uvloop n'existe pas sous Windows : pip install échouerait"


def test_requirements_tout_est_fige():
    for l in (BACKEND / "requirements.txt").read_text().splitlines():
        l = l.split("#")[0].strip()
        if l:
            assert "==" in l, f"dépendance non figée : {l}"
