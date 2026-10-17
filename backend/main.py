"""Point d'entrée FastAPI : API cyberPink (JSON uniquement, /api/* + /api/health).

Service indépendant du frontend statique, relié uniquement par une URL HTTP
(voir CORS_ORIGINS dans .env, et API_BASE_URL côté frontend).

Lancement (depuis la racine du projet, celle qui contient backend/, frontend/ et db/) :
    uvicorn backend.main:app --reload
(« backend » est un package Python : ses imports relatifs exigent ce nom de module.)
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import get_db
from .errors import register_error_handlers
from .limites import LimiteCorps
from .routers import auth, comments, contact, dons, health

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(name)s  %(message)s")
log = logging.getLogger("cyberpink")


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()  # échoue tout de suite si le .env est invalide
    db = get_db()
    db.init_schema()
    log.info("cyberPink démarré en mode %s (base : %s).", settings.mode, db.label)
    if settings.env_file:
        log.info("Configuration lue dans : %s", settings.env_file)
    else:
        log.info("Aucun fichier backend/.env : variables d'environnement uniquement.")
    if not settings.is_production:
        log.info("Fichier de la base SQLite : %s", settings.sqlite_path)
    yield
    db.close()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="cyberPink",
        lifespan=lifespan,
        # La documentation interactive n'est exposée qu'en mode debug.
        docs_url=None if settings.is_production else "/api/docs",
        redoc_url=None,
        openapi_url=None if settings.is_production else "/api/openapi.json",
    )
    register_error_handlers(app)

    # Corps de requête plafonné (413). Ajouté AVANT le CORS, donc placé à l'intérieur : ses réponses
    # 413 traversent le CORS et portent les en-têtes CORS (sinon le navigateur ne pourrait pas les lire).
    app.add_middleware(LimiteCorps)

    # Frontend hébergé comme service indépendant (autre origine, autre port) : ce backend
    # n'utilise pas de cookies (authentification par jeton dans l'en-tête Authorization),
    # donc allow_credentials=False suffit et allow_origins peut être "*" sans risque —
    # aucun cookie ni identifiant de session n'est partagé entre origines.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["Content-Type", "Authorization"],
    )

    # API uniquement : ce backend ne sert pas le frontend, qui est un service statique
    # indépendant. Toutes les routes sont sous /api/*, sauf /health (sonde).
    for module in (auth, comments, contact, dons, health):
        app.include_router(module.router)
    return app


app = create_app()
