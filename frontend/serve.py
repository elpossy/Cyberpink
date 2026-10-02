"""Serveur statique minimal pour le frontend, indépendant du backend.

Sert les fichiers de ce dossier (HTML, css/, js/, assets/) sur un port séparé.
Le frontend appelle le backend par HTTP via l'URL codée dans js/api.js — pas de lien
de code entre les deux, seulement une URL.

Lancement :  python3 serve.py [port]     (8080 par défaut)
"""

from __future__ import annotations

import sys
from pathlib import Path

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

FRONTEND_DIR = Path(__file__).resolve().parent

app = FastAPI(title="cyberPink — frontend", docs_url=None, redoc_url=None, openapi_url=None)

for dossier in ("assets", "css", "js"):
    app.mount(f"/{dossier}", StaticFiles(directory=FRONTEND_DIR / dossier), name=dossier)

PAGES = {
    "/": "index.html",
    "/produits": "produits.html",
    "/contact": "contact.html",
    "/dons": "dons.html",
    "/auth/login": "auth/login.html",
    "/auth/register": "auth/register.html",
}
PRODUITS = ("antigramme", "elyon", "damundje")


# GET et HEAD : les sondes de disponibilité (curl -I, répartiteurs de charge) utilisent souvent HEAD.
@app.api_route("/favicon.ico", methods=["GET", "HEAD"])
def favicon():
    return FileResponse(FRONTEND_DIR / "assets" / "favicon.ico")


@app.api_route("/{chemin:path}", methods=["GET", "HEAD"])
def page(chemin: str):
    url = "/" + chemin.rstrip("/") if chemin else "/"
    if url in PAGES:
        return FileResponse(FRONTEND_DIR / PAGES[url])
    if url.startswith("/produits/") and url.removeprefix("/produits/") in PRODUITS:
        return FileResponse(FRONTEND_DIR / "produit.html")
    return FileResponse(FRONTEND_DIR / "404.html", status_code=404)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    uvicorn.run(app, host="0.0.0.0", port=port)
