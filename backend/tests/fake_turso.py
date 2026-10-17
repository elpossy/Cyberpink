"""Faux serveur Turso (protocole Hrana « pipeline » sur HTTP) pour tester le mode production
sans compte Turso : exécute les requêtes SQL dans une base SQLite en mémoire."""

from __future__ import annotations

import base64
import sqlite3
import threading

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

TOKEN = "jeton-turso-de-test"
app = FastAPI()
_verrou = threading.Lock()
_conn: sqlite3.Connection | None = None


def _nouvelle_base() -> None:
    global _conn
    _conn = sqlite3.connect(":memory:", check_same_thread=False, isolation_level=None)
    _conn.execute("PRAGMA foreign_keys = ON")


_nouvelle_base()


def _valeur(cellule: dict):
    type_ = cellule.get("type")
    if type_ == "null":
        return None
    if type_ == "integer":
        return int(cellule["value"])
    if type_ == "float":
        return float(cellule["value"])
    if type_ == "blob":
        return base64.b64decode(cellule["base64"])
    return cellule["value"]


def _cellule(valeur):
    if valeur is None:
        return {"type": "null"}
    if isinstance(valeur, int):
        return {"type": "integer", "value": str(valeur)}
    if isinstance(valeur, float):
        return {"type": "float", "value": valeur}
    if isinstance(valeur, bytes):
        return {"type": "blob", "base64": base64.b64encode(valeur).decode()}
    return {"type": "text", "value": valeur}


@app.post("/__reset")
def reinitialiser():
    with _verrou:
        _nouvelle_base()
    return {"ok": True}


@app.post("/v2/pipeline")
async def pipeline(request: Request):
    if request.headers.get("authorization") != f"Bearer {TOKEN}":
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    corps = await request.json()
    resultats = []
    with _verrou:
        for req in corps.get("requests", []):
            if req.get("type") == "close":
                resultats.append({"type": "ok", "response": {"type": "close"}})
                continue
            stmt = req["stmt"]
            try:
                cur = _conn.execute(stmt["sql"], [_valeur(a) for a in stmt.get("args", [])])
                lignes = cur.fetchall()
                insertion = stmt["sql"].lstrip().upper().startswith("INSERT")
                resultats.append({"type": "ok", "response": {"type": "execute", "result": {
                    "cols": [{"name": d[0]} for d in (cur.description or [])],
                    "rows": [[_cellule(v) for v in ligne] for ligne in lignes],
                    "affected_row_count": max(cur.rowcount, 0),
                    "last_insert_rowid": str(cur.lastrowid) if insertion and cur.lastrowid else None,
                }}})
            except sqlite3.IntegrityError as exc:
                resultats.append({"type": "error", "error": {"message": str(exc), "code": "SQLITE_CONSTRAINT"}})
            except sqlite3.Error as exc:
                resultats.append({"type": "error", "error": {"message": str(exc), "code": "SQLITE_ERROR"}})
    return {"baton": None, "base_url": None, "results": resultats}
