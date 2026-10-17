"""Limites de taille : champs (caractères) et corps de requête (octets)."""

import asyncio
import itertools
import json

import pytest

from backend import limites as L

_n = itertools.count(1)


def _reg(**o):
    n = next(_n)
    d = {"name": "Nom", "email": f"u{n}@ex.com", "phone": f"+2270{n:07d}", "password": "secret1"}
    d.update(o)
    return d


def _email(longueur):
    return "x" * (longueur - len("@ex.com")) + "@ex.com"


# (libellé, requête(client, valeur), maximum) : la valeur de EXACTEMENT `maximum` caractères doit passer,
# `maximum + 1` doit être refusé en 400 avec un message qui cite la limite.
CHAMPS = [
    ("register nom", lambda c, v: c.post("/api/auth/register", json=_reg(name=v)), L.NOM_MAX, lambda n: "n" * n),
    ("register e-mail", lambda c, v: c.post("/api/auth/register", json=_reg(email=v)), L.EMAIL_MAX, _email),
    ("register téléphone", lambda c, v: c.post("/api/auth/register", json=_reg(phone=v)), L.TELEPHONE_MAX, lambda n: "1" * n),
    ("register mot de passe", lambda c, v: c.post("/api/auth/register", json=_reg(password=v)), L.MOT_DE_PASSE_MAX, lambda n: "p" * n),
    ("login mot de passe", lambda c, v: c.post("/api/auth/login", json={"email": "a@ex.com", "password": v}), L.MOT_DE_PASSE_MAX, lambda n: "p" * n),
    ("login e-mail", lambda c, v: c.post("/api/auth/login", json={"email": v, "password": "secret1"}), L.EMAIL_MAX, _email),
    ("commentaire", lambda c, v: c.post("/api/comments", json={"content": v, "anonymous": True}), L.COMMENTAIRE_MAX, lambda n: "c" * n),
    ("contact nom", lambda c, v: c.post("/api/contact", json={"name": v, "email": "a@b.co", "message": "m"}), L.NOM_MAX, lambda n: "n" * n),
    ("contact e-mail", lambda c, v: c.post("/api/contact", json={"name": "A", "email": v, "message": "m"}), L.EMAIL_MAX, _email),
    ("contact téléphone", lambda c, v: c.post("/api/contact", json={"name": "A", "email": "a@b.co", "message": "m", "phone": v}), L.TELEPHONE_MAX, lambda n: "1" * n),
    ("contact sujet", lambda c, v: c.post("/api/contact", json={"name": "A", "email": "a@b.co", "message": "m", "subject": v}), L.SUJET_CONTACT_MAX, lambda n: "s" * n),
    ("contact message", lambda c, v: c.post("/api/contact", json={"name": "A", "email": "a@b.co", "message": v}), L.MESSAGE_CONTACT_MAX, lambda n: "m" * n),
    ("don message", lambda c, v: c.post("/api/dons", json={"message": v}), L.MESSAGE_DON_MAX, lambda n: "m" * n),
    ("don produit", lambda c, v: c.post("/api/dons", json={"message": "m", "product": v}), L.PRODUIT_MAX, lambda n: "p" * n),
]


@pytest.mark.parametrize("libelle,requete,maximum,fabrique", CHAMPS, ids=[c[0] for c in CHAMPS])
def test_borne_exacte_de_chaque_champ(client, libelle, requete, maximum, fabrique):
    exact = requete(client, fabrique(maximum))
    assert exact.status_code != 400 and exact.status_code < 500, f"{libelle} : {maximum} caractères doivent passer ({exact.json()})"
    trop = requete(client, fabrique(maximum + 1))
    assert trop.status_code == 400, f"{libelle} : {maximum + 1} caractères doivent être refusés"
    assert str(maximum) in trop.json()["error"] and "caractères" in trop.json()["error"]


def test_la_limite_compte_des_caracteres_pas_des_octets(client):
    assert client.post("/api/comments", json={"content": "é" * L.COMMENTAIRE_MAX, "anonymous": True}).status_code == 201   # 4000 octets
    assert client.post("/api/comments", json={"content": "😀" * L.COMMENTAIRE_MAX, "anonymous": True}).status_code == 201  # 8000 octets
    assert client.post("/api/comments", json={"content": "😀" * (L.COMMENTAIRE_MAX + 1), "anonymous": True}).status_code == 400


def test_les_espaces_autour_ne_comptent_pas(client):
    assert client.post("/api/comments", json={"content": "  " + "c" * L.COMMENTAIRE_MAX + "  ", "anonymous": True}).status_code == 201
    assert client.post("/api/auth/register", json=_reg(name=" " + "n" * L.NOM_MAX + " ")).status_code == 201


def test_les_limites_serveur_sont_coherentes():
    assert L.MAX_CORPS_OCTETS == 131_072
    pire = 6 * L.MESSAGE_CONTACT_MAX  # échappement JSON \uXXXX : 6 octets par caractère au pire
    assert pire < L.MAX_CORPS_OCTETS // 2, "un message de contact légitime doit tenir largement dans la limite du corps"


# ----------------------------------------------------------------------------- corps de requête (Content-Length)
def _json_de_taille(n):
    base, fin = b'{"content":"hi","anonymous":true,"pad":"', b'"}'
    return base + b"x" * (n - len(base) - len(fin)) + fin


def test_corps_de_la_taille_maximale_accepte(client):
    corps = _json_de_taille(L.MAX_CORPS_OCTETS)
    assert len(corps) == L.MAX_CORPS_OCTETS
    r = client.post("/api/comments", content=corps, headers={"Content-Type": "application/json"})
    assert r.status_code != 413 and r.status_code < 500


def test_corps_trop_gros_413_avec_cors_et_fermeture(client):
    corps = _json_de_taille(L.MAX_CORPS_OCTETS + 1)
    r = client.post("/api/comments", content=corps, headers={"Content-Type": "application/json", "Origin": "http://localhost:8080"})
    assert r.status_code == 413 and r.json() == {"error": "Requête trop volumineuse."}
    assert r.headers.get("access-control-allow-origin") in ("*", "http://localhost:8080")
    assert r.headers["connection"] == "close"  # le corps non lu ne doit pas être réinterprété comme une 2e requête


# ----------------------------------------------------------------------------- corps « chunked » (sans Content-Length), au niveau ASGI
def _appeler(morceaux, max_octets=100, entetes=((b"transfer-encoding", b"chunked"),), type_scope="http"):
    recu, envoyes = {"appels": 0}, []

    async def app(scope, receive, send):
        recu["appels"] += 1
        corps = b""
        while True:
            m = await receive()
            corps += m.get("body", b"")
            if not m.get("more_body"):
                break
        recu["corps"] = corps
        await send({"type": "http.response.start", "status": 200, "headers": []})
        await send({"type": "http.response.body", "body": b"ok"})

    messages = [{"type": "http.request", "body": c, "more_body": i < len(morceaux) - 1} for i, c in enumerate(morceaux)]

    async def receive():
        return messages.pop(0) if messages else {"type": "http.disconnect"}

    async def send(m):
        envoyes.append(m)

    asyncio.run(L.LimiteCorps(app, max_octets=max_octets)({"type": type_scope, "headers": list(entetes)}, receive, send))
    return envoyes, recu


def test_chunked_sous_la_limite_rejoue_le_corps_a_l_identique():
    envoyes, recu = _appeler([b"a" * 40, b"b" * 40])
    assert envoyes[0]["status"] == 200 and recu["corps"] == b"a" * 40 + b"b" * 40


def test_chunked_exactement_a_la_limite_accepte():
    envoyes, recu = _appeler([b"a" * 50, b"b" * 50])
    assert envoyes[0]["status"] == 200 and len(recu["corps"]) == 100


def test_chunked_au_dessus_de_la_limite_413_sans_appeler_l_application():
    envoyes, recu = _appeler([b"a" * 60, b"b" * 41])
    assert envoyes[0]["status"] == 413 and recu["appels"] == 0
    assert json.loads(envoyes[1]["body"]) == {"error": "Requête trop volumineuse."}


def test_chunked_un_seul_morceau_enorme_413():
    envoyes, recu = _appeler([b"a" * 101])
    assert envoyes[0]["status"] == 413 and recu["appels"] == 0


def test_chunked_deconnexion_en_cours_de_route_aucune_reponse():
    messages_iter = [{"type": "http.request", "body": b"a", "more_body": True}]
    envoyes = []

    async def receive():
        return messages_iter.pop(0) if messages_iter else {"type": "http.disconnect"}

    async def send(m):
        envoyes.append(m)

    async def app(*a):
        raise AssertionError("l'application ne doit pas être appelée")

    asyncio.run(L.LimiteCorps(app, max_octets=100)({"type": "http", "headers": [(b"transfer-encoding", b"chunked")]}, receive, send))
    assert envoyes == []


def test_requete_sans_corps_et_scopes_non_http_passent_tels_quels():
    envoyes, recu = _appeler([b""], entetes=())
    assert envoyes[0]["status"] == 200 and recu["appels"] == 1
    _, recu = _appeler([b""], type_scope="lifespan")
    assert recu["appels"] == 1


def test_content_length_non_numerique_ne_plante_pas_le_middleware():
    envoyes, recu = _appeler([b"{}"], entetes=((b"content-length", b"abc"),))
    assert recu["appels"] == 1 and envoyes[0]["status"] == 200  # rejeté plus haut par le serveur HTTP, jamais par une exception ici
