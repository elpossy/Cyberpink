"""API complète : authentification par jeton, commentaires, contact, dons, erreurs, CORS."""

import json
import time

import pytest

from conftest import TURSO


def inscrire(c, **kw):
    corps = dict(name="Aïcha", email="Aicha@Example.com", phone="+22786000000", password="secret1")
    corps.update(kw)
    return c.post("/api/auth/register", json=corps)


def entete(jeton):
    return {"Authorization": f"Bearer {jeton}"}


def connecte(c, **kw):
    inscrire(c, **kw)
    r = c.post("/api/auth/login", json={"email": kw.get("email", "aicha@example.com"), "password": "secret1"})
    return entete(r.json()["token"])


def faire_admin(email="aicha@example.com"):
    from backend.database import get_db
    get_db().run("UPDATE users SET role='admin' WHERE email = ?", (email,))


# ----------------------------------------------------------------------------- inscription
def test_register_ok_et_doublons(client):
    r = inscrire(client)
    assert r.status_code == 201 and r.json()["success"] is True and r.json()["id"] == 1
    assert "token" not in r.json()  # l'inscription ne connecte pas : le frontend renvoie vers la connexion
    r = inscrire(client, phone="+22700000001")  # même e-mail, casse différente
    assert r.status_code == 409 and r.json() == {"error": "Un compte existe déjà avec cet e-mail ou ce numéro."}
    assert inscrire(client, email="autre@example.com").status_code == 409  # même téléphone


@pytest.mark.parametrize("corps,message", [
    ({"name": ""}, "Nom, e-mail, téléphone et mot de passe sont obligatoires."),
    ({"password": "123"}, "Le mot de passe doit contenir au moins 6 caractères."),
    ({"email": "pas-un-mail"}, "Adresse e-mail invalide."),
])
def test_register_validations(client, corps, message):
    r = inscrire(client, **corps)
    assert r.status_code == 400 and r.json() == {"error": message}


@pytest.mark.parametrize("brut", [b"pas du json", b"", b"[1,2]", b'{"name": 5}', b'{"name": null}'])
def test_register_corps_invalide(client, brut):
    r = client.post("/api/auth/register", content=brut, headers={"Content-Type": "application/json"})
    assert 400 <= r.status_code < 500


def test_register_injection_sql_traitee_comme_texte(client):
    r = inscrire(client, name="'); DROP TABLE users; --", email="inj@example.com", phone="+22711111111")
    assert r.status_code == 201
    assert client.post("/api/auth/login", json={"email": "inj@example.com", "password": "secret1"}).status_code == 200
    assert client.post("/api/auth/login", json={"email": "x' OR '1'='1", "password": "x' OR '1'='1"}).status_code == 401


def test_unicode_mot_de_passe_et_nom(client):
    assert inscrire(client, name="Émoji 😀", email="e@example.com", phone="+22722222222", password="mdp-é😀-secret").status_code == 201
    assert client.post("/api/auth/login", json={"email": "e@example.com", "password": "mdp-é😀-secret"}).status_code == 200


# ----------------------------------------------------------------------------- connexion / jeton
def test_login_logout_me(client):
    inscrire(client)
    assert client.get("/api/auth/me").json() == {"user": None}
    r = client.post("/api/auth/login", json={"email": "aicha@example.com", "password": "mauvais"})
    assert r.status_code == 401 and r.json() == {"error": "Identifiants incorrects."}
    r = client.post("/api/auth/login", json={"email": "inconnu@example.com", "password": "secret1"})
    assert r.status_code == 401 and r.json() == {"error": "Identifiants incorrects."}  # même message : ne révèle pas l'existence
    assert client.post("/api/auth/login", json={"email": "", "password": ""}).status_code == 400

    r = client.post("/api/auth/login", json={"email": " AICHA@example.com ", "password": "secret1"})
    assert r.status_code == 200 and r.json()["success"] is True
    jeton = r.json()["token"]
    assert jeton.count(".") == 2
    assert "set-cookie" not in {k.lower() for k in r.headers}

    me = client.get("/api/auth/me", headers=entete(jeton))
    assert me.json()["user"] == {"id": 1, "name": "Aïcha", "email": "aicha@example.com", "role": "user"}
    assert "password" not in me.text and "$2" not in me.text
    assert client.post("/api/auth/logout").json() == {"success": True}


def test_jetons_forges_refuses(client):
    inscrire(client)
    bon = client.post("/api/auth/login", json={"email": "aicha@example.com", "password": "secret1"}).json()["token"]
    uid, exp, sig = bon.split(".")
    for faux in [f"1.{int(time.time()) + 9999}.AAAA", f"2.{exp}.{sig}", f"1.{int(exp) + 10000}.{sig}",
                 "1", "", "a.b.c", "1.2.3.4", "-1.9999999999.x", "A" * 20000]:
        assert client.get("/api/auth/me", headers=entete(faux)).json() == {"user": None}, faux
    # en-tête non-ASCII (envoyé en octets : un client malveillant n'est pas limité à l'ASCII)
    assert client.get("/api/auth/me", headers={"Authorization": "Bearer é.é.é".encode("utf-8")}).json() == {"user": None}


def test_jeton_expire_ou_utilisateur_inexistant(client):
    import backend.security as sec
    inscrire(client)
    assert client.get("/api/auth/me", headers=entete(sec.create_token(1))).json()["user"]["id"] == 1
    vieux = sec.create_token(1, maintenant=time.time() - sec.SESSION_MAX_AGE - 10)
    assert sec.parse_token(vieux) is None
    assert client.get("/api/auth/me", headers=entete(vieux)).json() == {"user": None}
    assert client.get("/api/auth/me", headers=entete(sec.create_token(999))).json() == {"user": None}


def test_entete_authorization_mal_forme(client):
    inscrire(client)
    jeton = client.post("/api/auth/login", json={"email": "aicha@example.com", "password": "secret1"}).json()["token"]
    for mauvais in [{"Authorization": jeton}, {"Authorization": f"Basic {jeton}"}, {"Authorization": f"Digest {jeton}"},  # « Digest » : 7 caractères, comme « Bearer »
                    {"Authorization": f"Bearerx {jeton}"}, {"Authorization": f"Token {jeton}"}, {"Authorization": "Bearer"}, {"Authorization": "Bearer "}]:
        assert client.get("/api/auth/me", headers=mauvais).json() == {"user": None}, mauvais
    assert client.get("/api/auth/me", headers={"Authorization": f"bearer {jeton}"}).json()["user"]["id"] == 1


def test_mots_de_passe_bcrypt():
    import bcrypt
    import backend.security as sec
    for prefixe in (b"2a", b"2b"):  # bcryptjs produit des $2a$ ; Python/bcrypt des $2b$
        h = bcrypt.hashpw("motdepasse é!".encode(), bcrypt.gensalt(rounds=4, prefix=prefixe)).decode()
        assert sec.verify_password("motdepasse é!", h) and not sec.verify_password("autre", h)
    long = bcrypt.hashpw(("x" * 100).encode()[:72], bcrypt.gensalt(rounds=4)).decode()
    assert sec.verify_password("x" * 100, long)       # troncature à 72 octets, comme bcryptjs
    assert not sec.verify_password("x", "pas un hash")  # hachage invalide -> False, jamais d'exception


# ----------------------------------------------------------------------------- commentaires
def test_commentaire_anonyme_liste_et_forme(client):
    r = client.post("/api/comments", json={"subject": "opinion", "content": " Super ! ", "anonymous": True})
    assert r.status_code == 201 and r.json()["success"]
    (c,) = client.get("/api/comments").json()
    assert c["authorName"] == "Anonyme" and c["content"] == "Super !" and c["subject"] == "opinion"
    assert c["createdAt"].endswith("Z") and "T" in c["createdAt"]
    assert set(c) == {"id", "authorName", "subject", "content", "visibility", "createdAt"}


def test_commentaire_validations(client):
    assert client.post("/api/comments", json={"subject": "elyon", "content": "salut"}).status_code == 401
    h = connecte(client)
    assert client.post("/api/comments", json={"content": "  "}, headers=h).json() == {"error": "Le contenu est obligatoire."}
    assert client.post("/api/comments", json={"subject": "nimporte", "content": "x"}, headers=h).json() == {"error": "Sujet invalide."}
    assert client.post("/api/comments", json={"content": "x", "visibility": "secret"}, headers=h).json() == {"error": "Visibilité invalide."}
    assert client.post("/api/comments", json={"content": "x", "parent_id": 9999}, headers=h).status_code == 400
    assert 400 <= client.post("/api/comments", json={"content": ["liste"]}, headers=h).status_code < 500
    assert client.post("/api/comments", json={"content": "par défaut"}, headers=h).status_code == 201
    assert client.get("/api/comments").json()[0]["subject"] == "recommandation"


def test_commentaires_filtre_auteur_ordre_unicode_xss(client):
    h = connecte(client)
    client.post("/api/comments", json={"subject": "elyon", "content": "pour elyon"}, headers=h)
    client.post("/api/comments", json={"subject": "antigramme", "content": "pour ant"}, headers=h)
    client.post("/api/comments", json={"subject": "elyon", "content": "<img src=x onerror=alert(1)>", "anonymous": True}, headers=h)
    client.post("/api/comments", json={"subject": "elyon", "content": "😀 Ça marche — été ✓"}, headers=h)
    tous = client.get("/api/comments")
    assert tous.headers["content-type"].startswith("application/json")
    assert [c["id"] for c in tous.json()] == sorted((c["id"] for c in tous.json()), reverse=True)  # plus récent d'abord
    contenus = {c["content"] for c in tous.json()}
    assert "<img src=x onerror=alert(1)>" in contenus and "😀 Ça marche — été ✓" in contenus  # renvoyé tel quel (échappé par le client)
    elyon = client.get("/api/comments?subject=elyon").json()
    assert all(c["subject"] == "elyon" for c in elyon) and len(elyon) == 3
    assert {c["authorName"] for c in elyon} == {"Aïcha", "Anonyme"}
    assert client.get("/api/comments?subject=inconnu").json() == []


def test_commentaires_prives_reserves_a_l_admin(client):
    h = connecte(client)
    client.post("/api/comments", json={"content": "secret", "visibility": "private"}, headers=h)
    client.post("/api/comments", json={"content": "public"}, headers=h)
    assert [c["content"] for c in client.get("/api/comments").json()] == ["public"]
    r = client.get("/api/comments?visibility=private", headers=h)
    assert r.status_code == 403 and r.json() == {"error": "Accès réservé à l'administration."}
    assert client.get("/api/comments?visibility=private").status_code == 403
    assert client.get("/api/comments?visibility=nimporte", headers=h).status_code == 400
    faire_admin()
    h2 = entete(client.post("/api/auth/login", json={"email": "aicha@example.com", "password": "secret1"}).json()["token"])
    assert [c["content"] for c in client.get("/api/comments?visibility=private", headers=h2).json()] == ["secret"]
    assert client.get("/api/auth/me", headers=h2).json()["user"]["role"] == "admin"


def test_liste_limitee_a_50(client):
    for i in range(55):
        client.post("/api/comments", json={"content": f"c{i}", "anonymous": True})
    assert len(client.get("/api/comments").json()) == 50


# ----------------------------------------------------------------------------- contact / dons
def test_contact(client):
    assert client.post("/api/contact", json={"name": "A", "email": "a@b.co", "message": ""}).json() == {"error": "Nom, e-mail et message sont obligatoires."}
    assert client.post("/api/contact", json={"name": "A", "email": "nope", "message": "m"}).json() == {"error": "Adresse e-mail invalide."}
    r = client.post("/api/contact", json={"name": "A", "email": "a@b.co", "message": "m", "phone": " ", "subject": ""})
    assert r.status_code == 201 and r.json()["id"] == 1
    from backend.database import get_db
    ligne = get_db().get("SELECT * FROM contacts WHERE id = 1")
    assert ligne["phone"] is None and ligne["subject"] is None and ligne["source"] == "site-cyberpink"
    assert client.post("/api/contact", json={"name": "É", "email": "a@b.co", "message": "😀' OR 1=1 --"}).status_code == 201
    assert client.get("/api/contact").status_code == 405


def test_dons(client):
    assert client.post("/api/dons", json={"message": "  "}).json() == {"error": "Le message est obligatoire."}
    assert client.post("/api/dons", json={"message": "merci", "product": "Elyon"}).status_code == 201
    h = connecte(client)
    client.post("/api/dons", json={"message": "encore", "product": None}, headers=h)
    from backend.database import get_db
    lignes = get_db().all("SELECT user_id, product, message FROM donations ORDER BY id")
    assert lignes[0] == {"user_id": None, "product": "Elyon", "message": "merci"}
    assert lignes[1] == {"user_id": 1, "product": None, "message": "encore"}


# ----------------------------------------------------------------------------- erreurs, santé, docs
def test_health_et_erreurs_json(client):
    assert client.get("/api/health").json() == {"ok": True}
    r = client.get("/api/setup")
    assert r.status_code == 404 and r.json() == {"error": "Ressource introuvable."}
    r = client.put("/api/comments")
    assert r.status_code == 405 and r.json() == {"error": "Méthode non autorisée."}
    assert client.delete("/api/auth/me").status_code == 405


def test_le_backend_ne_sert_aucune_page(client):
    for url in ["/", "/produits", "/produits/elyon", "/contact", "/auth/login", "/assets/favicon.ico", "/js/api.js"]:
        r = client.get(url)
        assert r.status_code == 404 and r.headers["content-type"].startswith("application/json"), url


def test_docs_selon_le_mode(client):
    assert (client.get("/api/docs").status_code == 404) == TURSO
    assert (client.get("/api/openapi.json").status_code == 404) == TURSO


def test_erreur_interne_500_json_sans_fuite(client, monkeypatch):
    import backend.routers.comments as c

    class Casse:
        def all(self, *a, **k):
            raise RuntimeError("secret interne de la base")
    monkeypatch.setattr(c, "get_db", lambda: Casse())
    r = client.get("/api/comments")
    assert r.status_code == 500 and r.json() == {"error": "Erreur serveur."}
    assert "secret interne" not in r.text


# ----------------------------------------------------------------------------- CORS
ORIGINE = "http://localhost:8080"


def test_cors_preflight(client):
    r = client.options("/api/auth/login", headers={"Origin": ORIGINE, "Access-Control-Request-Method": "POST",
                                                   "Access-Control-Request-Headers": "authorization,content-type"})
    assert r.status_code == 200
    assert r.headers["access-control-allow-origin"] in ("*", ORIGINE)
    assert "authorization" in r.headers["access-control-allow-headers"].lower()
    assert "POST" in r.headers["access-control-allow-methods"]
    assert r.headers.get("access-control-allow-credentials", "").lower() != "true"


def test_cors_present_meme_sur_les_erreurs(client, monkeypatch):
    """Sans en-tête CORS, le navigateur masque le message d'erreur et affiche « erreur réseau »."""
    def cors(r):
        return r.headers.get("access-control-allow-origin") in ("*", ORIGINE)
    h = {"Origin": ORIGINE}
    assert cors(client.get("/api/comments", headers=h))                              # 200
    assert cors(client.post("/api/comments", json={"content": "x"}, headers=h))      # 401
    assert cors(client.get("/api/nimportequoi", headers=h))                          # 404
    assert cors(client.put("/api/comments", headers=h))                              # 405
    assert cors(client.post("/api/auth/login", content=b"{", headers={**h, "Content-Type": "application/json"}))  # 400
    import backend.routers.comments as c
    monkeypatch.setattr(c, "get_db", lambda: (_ for _ in ()).throw(RuntimeError("panne")))
    r = client.get("/api/comments", headers=h)
    assert r.status_code == 500 and cors(r)                                          # 500


def test_cors_origine_restreinte(env, faux_turso):
    """Avec CORS_ORIGINS, seule l'origine listée reçoit l'en-tête (y compris sur une 500)."""
    from fastapi.testclient import TestClient
    if TURSO:
        url, ft = faux_turso
        env(APP_MODE="production", TURSO_DATABASE_URL=url, TURSO_AUTH_TOKEN=ft.TOKEN, AUTH_SECRET="s" * 48, CORS_ORIGINS="http://127.0.0.1:8080")
    else:
        env(APP_MODE="debug", CORS_ORIGINS="http://127.0.0.1:8080")
    import backend.main as main
    with TestClient(main.create_app(), raise_server_exceptions=False) as c:
        ok = c.get("/api/health", headers={"Origin": "http://127.0.0.1:8080"})
        ko = c.get("/api/health", headers={"Origin": "http://localhost:8080"})  # autre origine pour un navigateur !
        assert ok.headers.get("access-control-allow-origin") == "http://127.0.0.1:8080"
        assert "access-control-allow-origin" not in ko.headers
