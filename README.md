# cyberPink

## Architecture réelle

Ce dépôt est un **monorepo au sens organisationnel** : il contient deux projets dans le même dépôt, `backend/` et `frontend/`. Ce n'est pas une application monolithique ni un déploiement à une seule commande.

| Composant | Contenu | Exécution locale |
|---|---|---|
| API | `backend/` : FastAPI, données SQLite en développement ou Turso en production | Uvicorn, par défaut sur `http://127.0.0.1:8000` |
| Interface | `frontend/` : HTML, CSS et JavaScript statiques, sans Node.js ni étape de build | serveur statique Python, par défaut sur `http://127.0.0.1:8080` |

L'API **ne sert pas** le frontend. L'interface appelle l'API directement avec `fetch`, via la constante `API_BASE_URL` dans [`frontend/js/api.js`](frontend/js/api.js). En local, elle vaut `http://127.0.0.1:8000`. En production, il faut la remplacer par l'URL HTTPS publique de l'API, sans ajouter `/api` à la fin.

Le navigateur voit donc deux origines différentes en local (`:8080` pour l'UI et `:8000` pour l'API). CORS doit autoriser l'origine de l'UI.

## Démarrage local complet

Prérequis : Python 3.12 recommandé et `pip`. Aucun package Node.js n'est nécessaire.

### 1. Installer les dépendances de l'API

Depuis la racine du dépôt (`cyberpink/`) :

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r backend\requirements.txt
```

Si PowerShell bloque l'activation :

```powershell
Set-ExecutionPolicy -Scope Process RemoteSigned
.\.venv\Scripts\Activate.ps1
```

### 2. Configurer le backend local

Créer `backend/.env`. Le mode `debug` utilise automatiquement `db/cyberpink.db` ; Turso et `AUTH_SECRET` ne sont pas requis en local.

```env
APP_MODE=debug
CORS_ORIGINS=http://127.0.0.1:8080
```

Le fichier doit être exactement `backend/.env` et encodé en UTF-8. Il n'existe pas de fichier `.env.example` dans ce dépôt.

### 3. Démarrer l'API

Dans un premier terminal, depuis la racine du dépôt :

```powershell
.\.venv\Scripts\Activate.ps1
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

Vérifier l'API avec <http://127.0.0.1:8000/api/health>. En mode debug, la documentation est disponible sur <http://127.0.0.1:8000/api/docs>.

### 4. Démarrer l'interface

Dans un deuxième terminal, depuis la racine du dépôt :

```powershell
python -m http.server 8080 --directory frontend
```

Ouvrir <http://127.0.0.1:8080/>. Avec `http.server`, les pages utilisent les noms réels des fichiers :

- <http://127.0.0.1:8080/produits.html>
- <http://127.0.0.1:8080/contact.html>
- <http://127.0.0.1:8080/dons.html>
- <http://127.0.0.1:8080/auth/login.html>

Les liens internes du frontend sont écrits avec ces extensions pour fonctionner avec ce serveur statique. Les pages produit utilisent par exemple `produit.html?product=elyon`.

## Changer l'adresse de l'API

Avant de publier l'interface, modifier une seule ligne dans [`frontend/js/api.js`](frontend/js/api.js) :

```js
export const API_BASE_URL = "https://api.exemple.com";
```

Puis, sur l'API, autoriser l'origine exacte où sera publié le frontend :

```env
CORS_ORIGINS=https://www.exemple.com
```

Ne jamais placer les secrets Turso ni `AUTH_SECRET` dans le frontend : seules les données publiques et l'URL publique de l'API y figurent.

## Déploiement

Déployer les deux composants séparément :

1. Héberger `frontend/` sur un hébergeur de fichiers statiques.
2. Héberger `backend/` dans un service Python qui lance `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`, avec `APP_MODE=production`, `AUTH_SECRET`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` et `CORS_ORIGINS` définis dans ses variables d'environnement.
3. Mettre l'URL HTTPS publique du backend dans `API_BASE_URL`, puis redéployer le frontend.

Le [`backend/Dockerfile`](backend/Dockerfile) concerne uniquement l'API ; il ne construit ni ne sert l'interface.

## Tests de l'API

```powershell
python -m pip install pytest
python -m pytest backend/tests
```

La base SQLite locale (`db/cyberpink.db`) est créée automatiquement et est ignorée par Git.
