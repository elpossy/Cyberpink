"""Commentaires / opinions (publics ou privés, anonymes autorisés)."""

from __future__ import annotations

from fastapi import APIRouter, Request

from ..database import get_db
from ..errors import ApiError
from ..limites import COMMENTAIRE_MAX, verifier_taille
from ..schemas import CommentIn
from ..security import get_session_user

router = APIRouter(prefix="/api/comments", tags=["commentaires"])

SUJETS_AUTORISES = (
    "recommandation",
    "generale",
    "cyberpink",
    "antigramme",
    "elyon",
    "damundje",
    "opinion",
)
VISIBILITES = ("public", "private")

SELECT_BASE = """
    SELECT c.id, c.subject, c.content, c.visibility, c.created_at, c.parent_id,
           COALESCE(c.author_name, u.name, 'Anonyme') AS author_name
    FROM comments c
    LEFT JOIN users u ON u.id = c.user_id
    WHERE c.visibility = ? AND c.parent_id IS NULL
"""


def _iso_utc(valeur: str | None) -> str | None:
    """'2026-08-11 11:00:00' (UTC, format SQLite) -> '2026-08-11T11:00:00Z'."""
    if not valeur:
        return valeur
    if "T" in valeur:
        return valeur
    return valeur.replace(" ", "T") + "Z"


@router.get("")
def list_comments(request: Request, subject: str | None = None, visibility: str = "public"):
    if visibility not in VISIBILITES:
        raise ApiError(400, "Visibilité invalide.")

    # Les commentaires privés ne sont visibles que par l'administration.
    if visibility == "private":
        utilisateur = get_session_user(request)
        if not utilisateur or utilisateur["role"] != "admin":
            raise ApiError(403, "Accès réservé à l'administration.")

    sql = SELECT_BASE
    args: list = [visibility]
    if subject:
        sql += " AND c.subject = ?"
        args.append(subject)
    sql += " ORDER BY c.created_at DESC, c.id DESC LIMIT 50"

    return [
        {
            "id": r["id"],
            "authorName": r["author_name"],
            "subject": r["subject"],
            "content": r["content"],
            "visibility": r["visibility"],
            "createdAt": _iso_utc(r["created_at"]),
        }
        for r in get_db().all(sql, args)
    ]


@router.post("", status_code=201)
def create_comment(body: CommentIn, request: Request):
    utilisateur = get_session_user(request)
    content = (body.content or "").strip()

    if not content:
        raise ApiError(400, "Le contenu est obligatoire.")
    verifier_taille(content, "Le contenu", COMMENTAIRE_MAX)
    if not body.anonymous and not utilisateur:
        raise ApiError(401, "Vous devez être connecté pour commenter.")
    if body.subject not in SUJETS_AUTORISES:
        raise ApiError(400, "Sujet invalide.")
    if body.visibility not in VISIBILITES:
        raise ApiError(400, "Visibilité invalide.")

    db = get_db()
    if body.parent_id and not db.get("SELECT id FROM comments WHERE id = ?", (body.parent_id,)):
        raise ApiError(400, "Commentaire parent introuvable.")

    if body.anonymous or not utilisateur:
        auteur, user_id = "Anonyme", None
    else:
        auteur, user_id = utilisateur["name"], utilisateur["id"]

    resultat = db.run(
        """INSERT INTO comments (user_id, author_name, subject, content, visibility, parent_id)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (user_id, auteur, body.subject, content, body.visibility, body.parent_id or None),
    )
    return {"success": True, "id": resultat.last_insert_id}
