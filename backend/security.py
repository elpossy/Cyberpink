"""Sécurité : mots de passe (bcrypt) et jeton de session signé (HMAC-SHA256).

Correction par rapport à l'ancienne version Next.js : le jeton n'était jamais vérifié
et contenait le secret en clair. Ici il est signé, daté (expiration 30 jours) et
vérifié à temps constant.

Le jeton est transmis par le client dans l'en-tête `Authorization: Bearer <jeton>`,
pas par un cookie : le frontend est un service indépendant (autre origine, autre
port, potentiellement en HTTP), et un cookie de session cross-site exigerait
`SameSite=None; Secure`, donc HTTPS partout — y compris en développement local.
Un jeton porté par le client fonctionne en HTTP comme en HTTPS, sans configuration
particulière du navigateur.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import time

import bcrypt
from fastapi import Request

from .config import get_settings
from .database import get_db

SESSION_MAX_AGE = 60 * 60 * 24 * 30  # 30 jours

# bcrypt ne prend en compte que les 72 premiers octets (bcryptjs tronquait de la même façon).
_BCRYPT_MAX = 72


# --------------------------------------------------------------------------- #
# Mots de passe
# --------------------------------------------------------------------------- #
def hash_password(mot_de_passe: str) -> str:
    brut = mot_de_passe.encode("utf-8")[:_BCRYPT_MAX]
    return bcrypt.hashpw(brut, bcrypt.gensalt(rounds=10)).decode("ascii")


def verify_password(mot_de_passe: str, hachage: str) -> bool:
    """Compatible avec les hachages `$2a$`/`$2b$` produits par bcryptjs."""
    try:
        brut = mot_de_passe.encode("utf-8")[:_BCRYPT_MAX]
        return bcrypt.checkpw(brut, hachage.encode("ascii"))
    except (ValueError, TypeError):
        return False


# Hachage factice : on le vérifie même quand l'e-mail est inconnu, pour que le temps de
# réponse ne révèle pas si un compte existe.
_HACHAGE_FACTICE = hash_password("mot-de-passe-factice")


def verify_dummy() -> None:
    verify_password("x", _HACHAGE_FACTICE)


# --------------------------------------------------------------------------- #
# Jeton de session : "<user_id>.<expiration>.<signature>"
# --------------------------------------------------------------------------- #
def _b64(donnees: bytes) -> str:
    return base64.urlsafe_b64encode(donnees).rstrip(b"=").decode("ascii")


def _signer(charge: str) -> str:
    secret = get_settings().auth_secret.encode("utf-8")
    return _b64(hmac.new(secret, charge.encode("ascii"), hashlib.sha256).digest())


def create_token(user_id: int, maintenant: float | None = None) -> str:
    expiration = int((maintenant if maintenant is not None else time.time()) + SESSION_MAX_AGE)
    charge = f"{user_id}.{expiration}"
    return f"{charge}.{_signer(charge)}"


def parse_token(jeton: str, maintenant: float | None = None) -> int | None:
    """Retourne l'id utilisateur si le jeton est authentique et non expiré, sinon None."""
    try:
        id_txt, exp_txt, signature = jeton.split(".")
        charge = f"{id_txt}.{exp_txt}"
        # Comparaison sur des octets : hmac.compare_digest lève TypeError sur une chaîne
        # contenant des caractères non-ASCII (en-tête Authorization forgé par un client).
        if not hmac.compare_digest(signature.encode("utf-8"), _signer(charge).encode("ascii")):
            return None
        if int(exp_txt) < (maintenant if maintenant is not None else time.time()):
            return None
        user_id = int(id_txt)
        return user_id if user_id > 0 else None
    except (ValueError, UnicodeError, TypeError):
        return None


# --------------------------------------------------------------------------- #
# Utilisateur courant, à partir du jeton porté dans l'en-tête Authorization
# --------------------------------------------------------------------------- #
def _extraire_jeton(request: Request) -> str | None:
    entete = request.headers.get("authorization")
    if not entete:
        return None
    prefixe = "bearer "
    if entete[: len(prefixe)].lower() != prefixe:
        return None
    return entete[len(prefixe) :].strip() or None


def get_session_user(request: Request) -> dict | None:
    """Utilisateur connecté (id, name, email, phone, role) ou None."""
    jeton = _extraire_jeton(request)
    if not jeton:
        return None
    user_id = parse_token(jeton)
    if user_id is None:
        return None
    return get_db().get(
        "SELECT id, name, email, phone, role FROM users WHERE id = ?", (user_id,)
    )
