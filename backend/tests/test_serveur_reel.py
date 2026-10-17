"""Démarre un VRAI processus `uvicorn backend.main:app` (comme en développement) et l'interroge en HTTP.

Ces tests attrapent ce que TestClient ne voit pas : erreur d'import au démarrage, fichiers incohérents,
vrai réseau (corps chunked, en-têtes truqués), concurrence, redémarrage, base créée au bon endroit.
"""

import os
import shutil
import socket
import subprocess
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor

import httpx
import pytest

from conftest import RACINE, port_libre

CONFIG = ("APP_MODE", "AUTH_SECRET", "TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN", "CORS_ORIGINS", "DB_DIR")


def _environnement(**extra):
    env = {k: v for k, v in os.environ.items() if k not in CONFIG}
    # Valeurs posées explicitement (même vides) : un vrai backend/.env du développeur ne doit pas fausser les tests.
    env.update(APP_MODE="debug", AUTH_SECRET="", TURSO_DATABASE_URL="", TURSO_AUTH_TOKEN="", CORS_ORIGINS="",
               PYTHONDONTWRITEBYTECODE="1", PYTHONIOENCODING="utf-8")
    env.update(extra)
    return env


class Serveur:
    def __init__(self, cwd, env):
        self.port = port_libre()
        self.sortie: list[str] = []
        self.proc = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "backend.main:app", "--port", str(self.port)],
            cwd=cwd, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace")
        threading.Thread(target=lambda: [self.sortie.append(l) for l in self.proc.stdout], daemon=True).start()
        self.url = f"http://127.0.0.1:{self.port}"
        for _ in range(120):
            if self.proc.poll() is not None:
                break
            try:
                if httpx.get(self.url + "/api/health", timeout=1).status_code == 200:
                    return
            except httpx.HTTPError:
                pass
            time.sleep(0.25)
        self.arreter()
        pytest.fail("le serveur n'a pas démarré :\n" + "".join(self.sortie))

    def arreter(self):
        if self.proc.poll() is None:
            self.proc.terminate()
            try:
                self.proc.wait(10)
            except subprocess.TimeoutExpired:
                self.proc.kill()
        time.sleep(0.2)

    @property
    def log(self):
        return "".join(self.sortie)


@pytest.fixture
def serveur(tmp_path):
    s = Serveur(RACINE, _environnement(DB_DIR=str(tmp_path / "db")))
    yield s
    s.arreter()


def _brut(serveur, octets, fragments=None):
    """Envoie des octets TCP bruts ; renvoie tout ce que le serveur répond jusqu'à la fermeture."""
    with socket.create_connection(("127.0.0.1", serveur.port), timeout=8) as s:
        try:
            for morceau in (fragments or [octets]):
                s.sendall(morceau)
        except OSError:
            pass
        recu = b""
        try:
            while True:
                bloc = s.recv(65536)
                if not bloc:
                    break
                recu += bloc
        except OSError:
            pass
    return recu


def _statuts(reponse):
    return [l.split(b" ")[1].decode() for l in reponse.split(b"\r\n") if l.startswith(b"HTTP/1.1 ")]


def test_demarrage_et_parcours_complet(serveur, tmp_path):
    u = {"name": "Réel", "email": "reel@example.com", "phone": "+22790000000", "password": "secret1"}
    assert httpx.post(serveur.url + "/api/auth/register", json=u).status_code == 201
    jeton = httpx.post(serveur.url + "/api/auth/login", json=u).json()["token"]
    h = {"Authorization": f"Bearer {jeton}"}
    assert httpx.get(serveur.url + "/api/auth/me", headers=h).json()["user"]["email"] == "reel@example.com"
    assert httpx.post(serveur.url + "/api/comments", json={"subject": "elyon", "content": "ça marche"}, headers=h).status_code == 201
    assert httpx.get(serveur.url + "/api/comments").json()[0]["content"] == "ça marche"
    assert (tmp_path / "db" / "cyberpink.db").is_file()
    assert "Fichier de la base SQLite" in serveur.log and "Aucun fichier backend/.env" in serveur.log or "Configuration lue dans" in serveur.log
    assert "Traceback" not in serveur.log


def test_corps_chunked_et_requete_cachee(serveur):
    tete = b"POST /api/comments HTTP/1.1\r\nHost: t\r\nConnection: close\r\nContent-Type: application/json\r\nTransfer-Encoding: chunked\r\n\r\n"
    ok = b'{"subject":"opinion","content":"chunked ok","anonymous":true}'
    rep = _brut(serveur, None, [tete, b"%x\r\n" % 20 + ok[:20] + b"\r\n", b"%x\r\n" % (len(ok) - 20) + ok[20:] + b"\r\n", b"0\r\n\r\n"])
    assert _statuts(rep) == ["201"]
    gros = [tete] + [b"%x\r\n" % 50000 + b"a" * 50000 + b"\r\n"] * 3 + [b"0\r\n\r\n"]
    assert _statuts(_brut(serveur, None, gros)) == ["413"]
    piege = b"GET /api/health HTTP/1.1\r\nHost: t\r\n\r\n"
    corps = piege + b"x" * 131_100
    requete = b"POST /api/comments HTTP/1.1\r\nHost: t\r\nConnection: close\r\nContent-Length: %d\r\n\r\n" % len(corps) + corps
    assert _statuts(_brut(serveur, requete)) == ["413"]  # une seule réponse : la requête glissée dans le corps n'est pas exécutée


@pytest.mark.parametrize("en_tetes", [b"Content-Length: abc\r\n", b"Content-Length: -1\r\n", b"Content-Length: 2\r\nTransfer-Encoding: chunked\r\n"])
def test_en_tetes_de_longueur_truques_ne_provoquent_aucune_erreur_serveur(serveur, en_tetes):
    rep = _brut(serveur, b"POST /api/comments HTTP/1.1\r\nHost: t\r\nConnection: close\r\nContent-Type: application/json\r\n" + en_tetes + b"\r\n{}")
    assert all(s < "500" for s in _statuts(rep))
    assert httpx.get(serveur.url + "/api/health").status_code == 200
    assert "Traceback" not in serveur.log


def test_concurrence(serveur):
    def inscrire(i):
        return httpx.post(serveur.url + "/api/auth/register", json={"name": f"P{i}", "email": f"p{i}@ex.com", "phone": f"+2273{i:07d}", "password": "secret1"}, timeout=20).status_code
    with ThreadPoolExecutor(10) as ex:
        assert set(ex.map(inscrire, range(10))) == {201}
    doublon = {"name": "Dup", "email": "dup@ex.com", "phone": "+22799999999", "password": "secret1"}
    with ThreadPoolExecutor(8) as ex:
        codes = sorted(ex.map(lambda _: httpx.post(serveur.url + "/api/auth/register", json=doublon, timeout=20).status_code, range(8)))
    assert codes.count(201) == 1 and set(codes) <= {201, 409}, codes
    with ThreadPoolExecutor(20) as ex:
        codes = list(ex.map(lambda i: httpx.post(serveur.url + "/api/comments", json={"content": f"c{i}", "anonymous": True}, timeout=20).status_code, range(60)))
    assert set(codes) == {201}
    assert len(httpx.get(serveur.url + "/api/comments").json()) == 50
    assert "Traceback" not in serveur.log


def test_les_donnees_survivent_a_un_redemarrage(tmp_path):
    env = _environnement(DB_DIR=str(tmp_path / "db"))
    u = {"name": "Perso", "email": "perso@example.com", "phone": "+22791111111", "password": "secret1"}
    s1 = Serveur(RACINE, env)
    try:
        assert httpx.post(s1.url + "/api/auth/register", json=u).status_code == 201
        assert httpx.post(s1.url + "/api/comments", json={"content": "avant", "anonymous": True}).status_code == 201
    finally:
        s1.arreter()
    s2 = Serveur(RACINE, env)
    try:
        assert httpx.post(s2.url + "/api/auth/login", json=u).status_code == 200
        assert httpx.get(s2.url + "/api/comments").json()[0]["content"] == "avant"
    finally:
        s2.arreter()


def test_backend_livre_seul_cree_db_a_cote(tmp_path):
    """On ne livre que backend/ : le dossier db/ (voisin) n'existe pas encore et doit être créé tout seul."""
    projet = tmp_path / "mon projet avec espaces"  # chemin avec espaces, comme souvent sous Windows
    shutil.copytree(RACINE / "backend", projet / "backend", ignore=shutil.ignore_patterns("tests", "__pycache__", ".env"))
    assert not (projet / "db").exists()
    s = Serveur(projet, _environnement())  # pas de DB_DIR : on teste l'emplacement par défaut
    try:
        r = httpx.post(s.url + "/api/auth/register", json={"name": "Seul", "email": "seul@example.com", "phone": "+22792222222", "password": "secret1"})
        assert r.status_code == 201
    finally:
        s.arreter()
    assert (projet / "db" / "cyberpink.db").is_file()


def test_demarrage_invalide_echoue_avec_un_message_clair(tmp_path):
    env = _environnement(APP_MODE="production", DB_DIR=str(tmp_path / "db"))
    r = subprocess.run([sys.executable, "-m", "uvicorn", "backend.main:app", "--port", str(port_libre())], cwd=RACINE, env=env,
                       capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=60)
    assert r.returncode != 0
    sortie = r.stdout + r.stderr
    assert "ConfigError" in sortie and "TURSO_DATABASE_URL" in sortie and "AUTH_SECRET" in sortie
