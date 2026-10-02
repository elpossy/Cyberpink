"""Authentification : inscription, connexion, déconnexion, utilisateur courant."""

from __future__ import annotations

import re

from fastapi import APIRouter, Request

from ..database import IntegrityError, get_db
from ..errors import ApiError
from ..limites import EMAIL_MAX, MOT_DE_PASSE_MAX, NOM_MAX, TELEPHONE_MAX, verifier_taille
from ..schemas import LoginIn, RegisterIn
from ..security import (
    create_token,
    get_session_user,
    hash_password,
    verify_dummy,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
MOT_DE_PASSE_MIN = 6


@router.post("/register", status_code=201)
def register(body: RegisterIn):
    name = (body.name or "").strip()
    email = (body.email or "").strip().lower()
    phone = (body.phone or "").strip()
    password = body.password or ""

    if not name or not email or not phone or not password:
        raise ApiError(400, "Nom, e-mail, téléphone et mot de passe sont obligatoires.")
    if len(password) < MOT_DE_PASSE_MIN:
        raise ApiError(400, "Le mot de passe doit contenir au moins 6 caractères.")
    if not EMAIL_RE.match(email):
        raise ApiError(400, "Adresse e-mail invalide.")
    verifier_taille(name, "Le nom", NOM_MAX)
    verifier_taille(email, "L'adresse e-mail", EMAIL_MAX)
    verifier_taille(phone, "Le numéro de téléphone", TELEPHONE_MAX)
    verifier_taille(password, "Le mot de passe", MOT_DE_PASSE_MAX)

    db = get_db()
    existant = db.get("SELECT id FROM users WHERE email = ? OR phone = ?", (email, phone))
    doublon = ApiError(409, "Un compte existe déjà avec cet e-mail ou ce numéro.")
    if existant:
        raise doublon

    try:
        resultat = db.run(
            "INSERT INTO users (name, email, phone, password_hash) VALUES (?, ?, ?, ?)",
            (name, email, phone, hash_password(password)),
        )
    except IntegrityError:
        # Deux inscriptions simultanées avec les mêmes identifiants.
        raise doublon

    return {"success": True, "id": resultat.last_insert_id}


@router.post("/login")
def login(body: LoginIn):
    email = (body.email or "").strip().lower()
    password = body.password or ""

    if not email or not password:
        raise ApiError(400, "E-mail et mot de passe requis.")
    verifier_taille(email, "L'adresse e-mail", EMAIL_MAX)
    verifier_taille(password, "Le mot de passe", MOT_DE_PASSE_MAX)

    utilisateur = get_db().get("SELECT id, password_hash FROM users WHERE email = ?", (email,))
    if not utilisateur:
        verify_dummy()
        raise ApiError(401, "Identifiants incorrects.")
    if not verify_password(password, utilisateur["password_hash"]):
        raise ApiError(401, "Identifiants incorrects.")

    # Le jeton est renvoyé dans le corps de la réponse : c'est au frontend de le
    # conserver (ex. localStorage) et de le renvoyer dans l'en-tête Authorization.
    return {"success": True, "token": create_token(utilisateur["id"])}


@router.post("/logout")
def logout():
    # Rien à faire côté serveur : le jeton n'est pas stocké côté serveur (pas de
    # session en base), donc "se déconnecter" consiste juste à ce que le frontend
    # oublie le jeton. On garde la route pour que le frontend ait un appel explicite.
    return {"success": True}


@router.get("/me")
def me(request: Request):
    """Utilisateur connecté, ou {"user": null} (200) s'il n'y en a pas."""
    utilisateur = get_session_user(request)
    if not utilisateur:
        return {"user": None}
    return {
        "user": {
            "id": utilisateur["id"],
            "name": utilisateur["name"],
            "email": utilisateur["email"],
            "role": utilisateur["role"],
        }
    }
