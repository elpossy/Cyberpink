"""Schémas des corps de requêtes.

Tous les champs sont optionnels au niveau du schéma : la validation métier (et ses
messages en français) est faite dans les routes, comme dans l'application d'origine.
"""

from __future__ import annotations

from pydantic import BaseModel


class RegisterIn(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    password: str | None = None


class LoginIn(BaseModel):
    email: str | None = None
    password: str | None = None


class CommentIn(BaseModel):
    subject: str | None = "recommandation"
    content: str | None = None
    visibility: str | None = "public"
    parent_id: int | None = None
    anonymous: bool = False


class ContactIn(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    subject: str | None = None
    message: str | None = None


class DonIn(BaseModel):
    message: str | None = None
    product: str | None = None
