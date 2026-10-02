"""Intentions de don (simple enregistrement d'un message, sans paiement en ligne)."""

from __future__ import annotations

from fastapi import APIRouter, Request

from ..database import get_db
from ..errors import ApiError
from ..limites import MESSAGE_DON_MAX, PRODUIT_MAX, verifier_taille
from ..schemas import DonIn
from ..security import get_session_user

router = APIRouter(prefix="/api/dons", tags=["dons"])


@router.post("", status_code=201)
def create_don(body: DonIn, request: Request):
    message = (body.message or "").strip()
    if not message:
        raise ApiError(400, "Le message est obligatoire.")
    verifier_taille(message, "Le message", MESSAGE_DON_MAX)
    verifier_taille(body.product, "Le produit", PRODUIT_MAX)

    utilisateur = get_session_user(request)
    resultat = get_db().run(
        "INSERT INTO donations (user_id, product, message) VALUES (?, ?, ?)",
        (utilisateur["id"] if utilisateur else None, body.product or None, message),
    )
    return {"success": True, "id": resultat.last_insert_id}
