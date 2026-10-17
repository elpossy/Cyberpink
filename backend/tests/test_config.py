"""Configuration : modes, variables obligatoires, CORS, dossier de la base, lecture du fichier .env."""

import logging

import pytest


def lire(env, **variables):
    cfg, _ = env(**variables)
    return cfg.get_settings()


def test_mode_par_defaut_debug(env):
    assert lire(env).mode == "debug"


def test_mode_invalide(env):
    cfg, _ = env(APP_MODE="prod")
    with pytest.raises(cfg.ConfigError, match="APP_MODE invalide"):
        cfg.get_settings()


def test_mode_insensible_a_la_casse(env):
    assert lire(env, APP_MODE="DEBUG").mode == "debug"


def test_production_variables_manquantes(env):
    cfg, _ = env(APP_MODE="production")
    with pytest.raises(cfg.ConfigError) as e:
        cfg.get_settings()
    for nom in ("TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN", "AUTH_SECRET"):
        assert nom in str(e.value)


@pytest.mark.parametrize("secret", ["court", "change-moi-par-une-longue-chaine-aleatoire", "a" * 31])
def test_production_secret_faible(env, secret):
    cfg, _ = env(APP_MODE="production", TURSO_DATABASE_URL="libsql://x", TURSO_AUTH_TOKEN="t", AUTH_SECRET=secret)
    with pytest.raises(cfg.ConfigError, match="AUTH_SECRET"):
        cfg.get_settings()


def test_production_ok(env):
    s = lire(env, APP_MODE="production", TURSO_DATABASE_URL="libsql://x", TURSO_AUTH_TOKEN="t", AUTH_SECRET="a" * 32)
    assert s.is_production and s.turso_url == "libsql://x"


def test_secret_de_dev_seulement_en_debug(env):
    cfg, _ = env()
    assert cfg.get_settings().auth_secret == cfg.SECRET_DE_DEV


def test_cors_par_defaut_toutes_origines(env):
    assert lire(env).cors_origins == ("*",)


def test_cors_liste_explicite(env):
    assert lire(env, CORS_ORIGINS="http://localhost:8080, https://cyberpink.app").cors_origins == (
        "http://localhost:8080", "https://cyberpink.app")


def test_cors_origine_invalide(env):
    cfg, _ = env(CORS_ORIGINS="pas-une-url")
    with pytest.raises(cfg.ConfigError, match="CORS_ORIGINS"):
        cfg.get_settings()


def test_dossier_db_par_defaut_voisin_de_backend():
    import backend.config as cfg
    assert cfg.DB_DIR == cfg.ROOT_DIR.parent / "db"


def test_dossier_db_surcharge(env, tmp_path):
    s = lire(env, DB_DIR=str(tmp_path / "autre"))
    assert s.sqlite_path == (tmp_path / "autre").resolve() / "cyberpink.db"


# ------------------------------------------------------------------ fichier .env (pièges Windows inclus)
PROD = ("APP_MODE=production\nTURSO_DATABASE_URL=http://x\nTURSO_AUTH_TOKEN=t\nAUTH_SECRET=" + "s" * 40 + "\n")


def _avec_env(env, contenu: bytes):
    cfg, _ = env()
    (cfg.ROOT_DIR / ".env").write_bytes(contenu)
    cfg.get_settings.cache_clear()
    return cfg


@pytest.mark.parametrize("nom,contenu", [
    ("UTF-8", PROD.encode()),
    ("UTF-8 avec BOM (Bloc-notes)", b"\xef\xbb\xbf" + PROD.encode()),
    ("fins de ligne Windows (CRLF)", PROD.replace("\n", "\r\n").encode()),
    ("valeurs entre guillemets", PROD.replace("production", '"production"').encode()),
])
def test_env_lu_correctement(env, nom, contenu):
    cfg = _avec_env(env, contenu)
    s = cfg.get_settings()
    assert s.mode == "production", nom
    assert s.env_file == cfg.ROOT_DIR / ".env"


def test_env_avec_accents_utf8(env):
    cfg = _avec_env(env, "APP_MODE=debug\nAUTH_SECRET=café-été-secret\n".encode())
    assert cfg.get_settings().auth_secret == "café-été-secret"


def test_env_non_utf8_message_clair(env):
    cfg = _avec_env(env, b"APP_MODE=debug\nAUTH_SECRET=caf\xe9\n")  # ANSI/cp1252
    with pytest.raises(cfg.ConfigError, match="UTF-8"):
        cfg.get_settings()


def test_env_absent(env):
    assert lire(env).env_file is None


def test_variable_d_environnement_prioritaire_sur_env(env):
    cfg, _ = env(APP_MODE="debug")
    (cfg.ROOT_DIR / ".env").write_text("APP_MODE=production\n")
    cfg.get_settings.cache_clear()
    assert cfg.get_settings().mode == "debug"


def test_env_mal_place_signale(env, caplog):
    cfg, _ = env()
    (cfg.ROOT_DIR.parent / ".env").write_text("APP_MODE=production\n")      # à la racine du projet : PAS lu
    (cfg.ROOT_DIR / ".env.txt").write_text("APP_MODE=production\n")         # extension ajoutée par le Bloc-notes : PAS lu
    with caplog.at_level(logging.WARNING, logger="cyberpink"):
        s = cfg.get_settings()
    assert s.env_file is None and s.mode == "debug"
    assert caplog.text.count("n'est PAS lu") == 2
