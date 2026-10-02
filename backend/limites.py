"""Limites de taille : protègent la base et les réponses publiques contre les contenus démesurés.

Sans elles, n'importe qui pourrait envoyer un commentaire anonyme de plusieurs Mo, qui serait
ensuite renvoyé à tous les visiteurs par GET /api/comments (jusqu'à 50 commentaires par réponse).
"""

from __future__ import annotations

from .errors import ApiError

# Taille maximale d'un corps de requête (octets). Tous les corps légitimes sont bien plus petits :
# le plus gros (message de contact de 5000 caractères) fait < 60 Ko, même avec les échappements JSON.
MAX_CORPS_OCTETS = 131_072

# Longueurs maximales, en CARACTÈRES (pas en octets), après suppression des espaces autour.
NOM_MAX = 100
EMAIL_MAX = 254  # limite usuelle d'une adresse e-mail (RFC 5321)
TELEPHONE_MAX = 30
MOT_DE_PASSE_MAX = 128
COMMENTAIRE_MAX = 2000
MESSAGE_CONTACT_MAX = 5000
SUJET_CONTACT_MAX = 200
MESSAGE_DON_MAX = 2000
PRODUIT_MAX = 100


def verifier_taille(valeur: str | None, libelle: str, maximum: int) -> None:
    """Lève une erreur 400 si `valeur` dépasse `maximum` caractères. `libelle` : « Le nom », « Le contenu »..."""
    if valeur is not None and len(valeur) > maximum:
        raise ApiError(400, f"{libelle} ne doit pas dépasser {maximum} caractères.")


class LimiteCorps:
    """Middleware ASGI : répond 413 si le corps de la requête dépasse `max_octets`.

    - Corps annoncé par Content-Length : refusé immédiatement, sans rien lire.
    - Corps en Transfer-Encoding: chunked (pas de Content-Length) : lu en mémoire jusqu'à
      `max_octets` au plus, refusé au dépassement, sinon rejoué tel quel à l'application.
    """

    def __init__(self, app, max_octets: int = MAX_CORPS_OCTETS) -> None:
        self.app = app
        self.max_octets = max_octets

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        entetes = {nom: valeur for nom, valeur in scope["headers"]}
        annonce = entetes.get(b"content-length")
        if annonce is not None:
            if annonce.isdigit() and int(annonce) > self.max_octets:
                await self._refuser(send)
                return
            await self.app(scope, receive, send)  # uvicorn garantit que le corps == Content-Length
            return

        if b"transfer-encoding" not in entetes:  # pas de corps (GET, OPTIONS...)
            await self.app(scope, receive, send)
            return

        morceaux: list[bytes] = []
        total = 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            corps = message.get("body", b"")
            total += len(corps)
            if total > self.max_octets:
                await self._refuser(send)
                return
            morceaux.append(corps)
            if not message.get("more_body", False):
                break

        complet = b"".join(morceaux)
        rejoue = False

        async def receive_rejoue():
            nonlocal rejoue
            if not rejoue:
                rejoue = True
                return {"type": "http.request", "body": complet, "more_body": False}
            return await receive()

        await self.app(scope, receive_rejoue, send)

    @staticmethod
    async def _refuser(send) -> None:
        corps = '{"error":"Requête trop volumineuse."}'.encode()
        await send({
            "type": "http.response.start",
            "status": 413,
            "headers": [
                (b"content-type", b"application/json"),
                (b"content-length", str(len(corps)).encode()),
                (b"connection", b"close"),  # le corps non lu ne doit pas être réinterprété comme une requête
            ],
        })
        await send({"type": "http.response.body", "body": corps})
