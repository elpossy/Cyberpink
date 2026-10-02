"""Formulaire de contact."""

from __future__ import annotations

import re

from fastapi import APIRouter

from ..database import get_db
from ..errors import ApiError
from ..limites import (
    EMAIL_MAX,
    MESSAGE_CONTACT_MAX,
    NOM_MAX,
    SUJET_CONTACT_MAX,
    TELEPHONE_MAX,
    verifier_taille,
)
from ..schemas import ContactIn

router = APIRouter(prefix="/api/contact", tags=["contact"])

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


@router.post("", status_code=201)
def send_contact(body: ContactIn):
    name = (body.name or "").strip()
    email = (body.email or "").strip()
    message = (body.message or "").strip()

    if not name or not email or not message:
        raise ApiError(400, "Nom, e-mail et message sont obligatoires.")
    if not EMAIL_RE.match(email):
        raise ApiError(400, "Adresse e-mail invalide.")
    phone = (body.phone or "").strip()
    sujet = (body.subject or "").strip()
    verifier_taille(name, "Le nom", NOM_MAX)
    verifier_taille(email, "L'adresse e-mail", EMAIL_MAX)
    verifier_taille(phone, "Le numéro de téléphone", TELEPHONE_MAX)
    verifier_taille(sujet, "Le sujet", SUJET_CONTACT_MAX)
    verifier_taille(message, "Le message", MESSAGE_CONTACT_MAX)

    resultat = get_db().run(
        """INSERT INTO contacts (name, email, phone, subject, message, source)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (
            name,
            email,
            phone or None,
            sujet or None,
            message,
            "site-cyberpink",
        ),
    )
    return {"success": True, "id": resultat.last_insert_id}
