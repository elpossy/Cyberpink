"""Sonde de santé (remplace l'ancien GET /api/setup, qui exposait des détails internes)."""

from __future__ import annotations

import logging

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from ..database import get_db

router = APIRouter(prefix="/api", tags=["santé"])
log = logging.getLogger("cyberpink")


@router.get("/health")
def health():
    try:
        get_db().get("SELECT 1 AS ok")
    except Exception:  # noqa: BLE001 - on ne divulgue aucun détail au client
        log.exception("Sonde de santé : base injoignable")
        return JSONResponse({"ok": False}, status_code=503)
    return {"ok": True}
