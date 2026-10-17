# cyberPink — backend (API FastAPI)

API JSON uniquement (aucune page HTML). Base SQLite locale en mode `debug`, Turso en mode `production`.
Authentification par jeton `Authorization: Bearer <jeton>` (pas de cookie). Routes : voir plus bas.

## ⚠️ Mise à jour d'un backend existant

**Supprime l'ancien dossier `backend/` avant d'extraire celui-ci** — ne le fusionne pas. Un ancien
`main.py` mélangé aux nouveaux fichiers provoque :
`AttributeError: module 'backend.routers.pages' has no attribute 'router'`
(l'ancienne version servait aussi les pages HTML via `routers/pages.py`, qui n'existe plus). Le
frontend est maintenant un ensemble de fichiers statiques dans `frontend/`, servi séparément. Il ne
faut **pas** recréer `pages.py`.

Vérifier que le `main.py` est le bon : il ne doit contenir **aucune** occurrence de `pages`
(PowerShell : `Select-String -Path backend\main.py -Pattern pages` ne doit rien afficher).

## Démarrage

À lancer **depuis le dossier qui contient `backend/`** (pas depuis `backend/` lui-même : `backend`
est un package Python, la commande est `backend.main:app`).

**Windows (PowerShell ou cmd)**

```bat
python -m venv venv
venv\Scripts\activate
pip install -r backend\requirements.txt
copy backend\.env.example backend\.env
uvicorn backend.main:app --reload
```

PowerShell peut refuser `Activate.ps1` : `Set-ExecutionPolicy -Scope Process RemoteSigned`, ou utiliser cmd.

**Linux / macOS**

```bash
python3 -m venv venv && source venv/bin/activate
pip install -r backend/requirements.txt
cp backend/.env.example backend/.env
uvicorn backend.main:app --reload
```

Au démarrage, le serveur affiche **quel fichier `.env` est lu** et **où se trouve la base SQLite**
(`db/` à côté de `backend/`, créé automatiquement). API : <http://127.0.0.1:8000/api/health> ;
documentation interactive (mode debug seulement) : <http://127.0.0.1:8000/api/docs>.

## Configuration (`backend/.env`)

| Variable | Rôle |
|---|---|
| `APP_MODE` | `debug` (SQLite `db/cyberpink.db`) ou `production` (Turso). Défaut : `debug`. |
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `AUTH_SECRET` | Obligatoires en production (`AUTH_SECRET` : 32 caractères minimum). |
| `CORS_ORIGINS` | Origines du frontend autorisées, séparées par des virgules (vide = toutes). `http://localhost:8080` et `http://127.0.0.1:8080` sont **deux origines différentes**. |
| `DB_DIR` | Dossier de la base SQLite (défaut : `db/` voisin de `backend/`). |

Le fichier doit être en **UTF-8** (sinon : message d'erreur explicite). Les variables d'environnement
priment sur le `.env`. Seul `backend/.env` est lu : un `.env` à la racine du projet, ou un
`.env.txt` (extension ajoutée par le Bloc-notes), est ignoré — le serveur le signale au démarrage.

## Routes (préfixe `/api`)

`POST /auth/register` · `POST /auth/login` (renvoie `token`) · `POST /auth/logout` · `GET /auth/me` ·
`GET|POST /comments` · `POST /contact` · `POST /dons` · `GET /health`.
Erreurs : `{"error": "message"}`. Limites : corps 131 072 octets (413) ; champs en caractères
(nom 100, e-mail 254, téléphone 30, mot de passe 128, commentaire 2000, message de contact 5000,
sujet 200, message de don 2000, produit 100) → 400 — voir `limites.py`.

## Tests

```bash
pip install pytest
python -m pytest backend/tests                       # mode debug (SQLite)
```

Mode production contre un faux serveur Turso — Linux/macOS : `TEST_BACKEND=turso python -m pytest backend/tests` ;
PowerShell : `$env:TEST_BACKEND="turso"; python -m pytest backend/tests`.

La suite démarre aussi un vrai `uvicorn backend.main:app` et vérifie, entre autres, que les routes sont
exactement celles attendues et qu'aucune référence à l'ancien module `pages` ne subsiste.

## Docker

```bash
cd backend
docker build -t cyberpink-backend .
docker run --env-file .env -p 8000:8000 cyberpink-backend
# essai en debug, base conservée dans un volume : le dossier db/ du projet est /app/db dans le conteneur
docker run -e APP_MODE=debug -v cyberpink-db:/app/db -p 8000:8000 cyberpink-backend
```
