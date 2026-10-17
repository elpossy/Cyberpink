"""Configuration de l'application, lue depuis le fichier `.env` du dossier backend/.

Variable principale : APP_MODE
  - "debug"       -> base SQLite locale : <racine>/db/cyberpink.db (dossier db/ voisin de backend/,
                     ou DB_DIR si défini)
  - "production"  -> base distante Turso (TURSO_DATABASE_URL + TURSO_AUTH_TOKEN)
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

# Dossier du service backend (déployé indépendamment du frontend).
ROOT_DIR = Path(__file__).resolve().parent
# Dossier de la base SQLite locale (mode debug) : db/, voisin de backend/ à la racine du projet
# (dans le conteneur : /app/backend -> /app/db). Surchargeable avec la variable DB_DIR.
DB_DIR = ROOT_DIR.parent / "db"

log = logging.getLogger("cyberpink")

MODES_VALIDES = ("debug", "production")
SECRET_DE_DEV = "cyberpink-dev-secret-change-me"


class ConfigError(RuntimeError):
    """Configuration invalide : l'application refuse de démarrer."""


@dataclass(frozen=True)
class Settings:
    mode: str
    auth_secret: str
    turso_url: str | None
    turso_token: str | None
    sqlite_path: Path
    cors_origins: tuple[str, ...]
    env_file: Path | None = None  # fichier .env réellement lu (None : aucun)

    @property
    def is_production(self) -> bool:
        return self.mode == "production"


def _dossier_db() -> Path:
    """Dossier de la base SQLite : DB_DIR si défini, sinon db/ voisin de backend/."""
    brut = _lire("DB_DIR")
    return Path(brut).expanduser().resolve() if brut else DB_DIR


def _charger_env() -> Path | None:
    """Charge backend/.env s'il existe et renvoie son chemin (None s'il n'y en a pas).

    Les variables déjà présentes dans l'environnement (hébergeur) restent prioritaires.
    """
    chemin = ROOT_DIR / ".env"
    if not chemin.is_file():
        # Erreurs classiques : .env à la racine du projet, ou « .env.txt » créé par le Bloc-notes.
        for autre in (ROOT_DIR.parent / ".env", ROOT_DIR / ".env.txt"):
            if autre.is_file():
                log.warning(
                    "Le fichier %s existe mais n'est PAS lu : seul %s est pris en compte.", autre, chemin
                )
        return None
    try:
        load_dotenv(chemin, override=False)
    except UnicodeDecodeError as exc:
        raise ConfigError(
            f"Le fichier {chemin} n'est pas encodé en UTF-8 (octet invalide en position {exc.start}). "
            "Réenregistre-le en UTF-8 (Bloc-notes : Enregistrer sous > Encodage : UTF-8)."
        ) from exc
    return chemin


def _lire(nom: str) -> str | None:
    """Lit une variable d'environnement (vide -> None)."""
    valeur = os.getenv(nom, "").strip()
    return valeur or None


@lru_cache
def get_settings() -> Settings:
    env_file = _charger_env()

    mode = (_lire("APP_MODE") or "debug").lower()
    if mode not in MODES_VALIDES:
        raise ConfigError(
            f"APP_MODE invalide : « {mode} ». Valeurs acceptées : "
            + " ou ".join(MODES_VALIDES)
            + "."
        )

    secret = _lire("AUTH_SECRET")
    turso_url = _lire("TURSO_DATABASE_URL")
    turso_token = _lire("TURSO_AUTH_TOKEN")

    if mode == "production":
        manquantes = [
            nom
            for nom, valeur in (
                ("TURSO_DATABASE_URL", turso_url),
                ("TURSO_AUTH_TOKEN", turso_token),
                ("AUTH_SECRET", secret),
            )
            if not valeur
        ]
        if manquantes:
            raise ConfigError(
                "Mode production : variables manquantes (environnement ou fichier .env) -> " + ", ".join(manquantes)
            )
        if secret.startswith("change-moi") or len(secret) < 32:
            raise ConfigError(
                "Mode production : AUTH_SECRET est trop faible ou n'a pas été changé. "
                "Génère-en un avec : openssl rand -hex 32"
            )
    else:
        # En debug, on tolère l'absence de secret (valeur de développement).
        secret = secret or SECRET_DE_DEV

    # Origines autorisées à appeler l'API depuis un autre domaine (frontend séparé,
    # ex. servi par un autre conteneur). Liste séparée par des virgules, ex. :
    # "http://localhost:5500,https://cyberpink.app". Vide par défaut : "*" (toutes),
    # possible ici sans risque puisque l'authentification passe par un jeton dans
    # l'en-tête Authorization, jamais par un cookie (pas de credentials à protéger).
    brut = _lire("CORS_ORIGINS") or ""
    cors_origins = tuple(o.strip() for o in brut.split(",") if o.strip()) or ("*",)
    for o in cors_origins:
        if o != "*" and not (o.startswith("http://") or o.startswith("https://")):
            raise ConfigError(f"CORS_ORIGINS : origine invalide « {o} » (doit commencer par http:// ou https://).")

    return Settings(
        mode=mode,
        auth_secret=secret,
        turso_url=turso_url,
        turso_token=turso_token,
        sqlite_path=_dossier_db() / "cyberpink.db",
        cors_origins=cors_origins,
        env_file=env_file,
    )
