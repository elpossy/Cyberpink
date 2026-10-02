"""Erreurs de l'API : toutes les réponses d'erreur ont la forme {"error": "message"}."""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger("cyberpink")

MESSAGES_HTTP = {
    404: "Ressource introuvable.",
    405: "Méthode non autorisée.",
}


class ApiError(Exception):
    """Erreur métier renvoyée telle quelle au client."""

    def __init__(self, status_code: int, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.message = message


def register_error_handlers(app: FastAPI) -> None:
    # Ce backend ne sert que l'API : toutes les erreurs sont en JSON.
    @app.exception_handler(ApiError)
    async def _api_error(_: Request, exc: ApiError):
        return JSONResponse({"error": exc.message}, status_code=exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, __: RequestValidationError):
        return JSONResponse({"error": "Requête invalide."}, status_code=400)

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException):
        message = MESSAGES_HTTP.get(exc.status_code, str(exc.detail))
        return JSONResponse({"error": message}, status_code=exc.status_code)

    @app.exception_handler(Exception)
    async def _inattendue(request: Request, exc: Exception):
        log.exception("Erreur non gérée sur %s %s", request.method, request.url.path)
        return JSONResponse({"error": "Erreur serveur."}, status_code=500)
