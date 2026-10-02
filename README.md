# cyberPink

Site de la holding cyberPink (Niamey, Niger) : page d'accueil, produits (Antigramme, Elyon,
Damundjé), commentaires, contact, dons, comptes utilisateurs.

**Trois dossiers à la racine**, indépendants les uns des autres, reliés uniquement par une URL
HTTP (frontend → backend) et par un dossier de données (backend → `db/`) :

- **`backend/`** — API FastAPI (JSON uniquement, aucune page HTML). Base SQLite locale en mode
  debug, Turso en mode production.
- **`frontend/`** — HTML/CSS/JS statiques, sans framework ni étape de build, servis par un petit
  serveur Python (`frontend/serve.py`) qui reconstruit les jolies URLs (`/produits/elyon`, page 404…).
- **`db/`** — dossier de la base SQLite locale, utilisé **uniquement en mode debug**
  (`db/cyberpink.db`, créée automatiquement, non versionnée). En production la base est Turso :
  ce dossier n'est pas utilisé.

```
cyberpink/
├── backend/
│   ├── main.py · config.py · database.py · security.py · errors.py · schemas.py · limites.py
│   ├── routers/         auth · comments · contact · dons · health
│   ├── requirements.txt · Dockerfile · .dockerignore
│   └── .env.example
├── frontend/
│   ├── serve.py          petit serveur (routage des pages + fichiers statiques)
│   ├── *.html · auth/*.html
│   ├── css/               base.css · globals.css · landing.css
│   ├── js/                api.js · layout.js · comments.js · products.js · dom.js · pages/*.js
│   ├── assets/            images .png et .svg
│   └── Dockerfile · .dockerignore
├── db/                   base SQLite du mode debug (rien de versionné sauf .gitkeep)
└── README.md
```

## Authentification : jeton, pas cookie

Le frontend et le backend n'étant pas sur la même origine, l'authentification passe par un
jeton signé (HMAC-SHA256, 30 jours), pas par un cookie :

1. `POST /api/auth/login` renvoie `{"success": true, "token": "…"}`.
2. Le frontend mémorise ce jeton (`localStorage`, voir `frontend/js/api.js`).
3. Chaque appel suivant l'envoie dans l'en-tête `Authorization: Bearer <jeton>`.

Ce choix évite d'exiger HTTPS en développement local : un cookie de session cross-site
nécessite `SameSite=None; Secure`, donc HTTPS partout, y compris sur `localhost`. Le jeton,
lui, fonctionne aussi bien en HTTP qu'en HTTPS.

`POST /api/auth/register` crée le compte **sans** connecter : le site renvoie ensuite vers la
page de connexion. `POST /api/auth/logout` ne fait rien côté serveur (aucune session n'y est
stockée) : c'est le frontend qui oublie son jeton, lequel reste valide jusqu'à son expiration.

## Relier les deux services

**`frontend/js/api.js`** contient une constante `API_BASE_URL` codée en dur — à modifier
avant chaque déploiement :

```js
export const API_BASE_URL = "http://127.0.0.1:8000";   // adresse du backend
```

Trois points à respecter :

- Cette URL est appelée **depuis le navigateur du visiteur** : ce doit être l'adresse publique
  du backend, pas un nom interne de Docker ou de réseau privé.
- Si le site est servi en **HTTPS**, le backend doit l'être aussi (un navigateur bloque les
  appels HTTP depuis une page HTTPS).
- Le backend doit autoriser l'origine du frontend dans `backend/.env` :

  ```
  CORS_ORIGINS=http://127.0.0.1:8080
  ```

  Attention : `http://localhost:8080` et `http://127.0.0.1:8080` sont deux origines **différentes**
  pour un navigateur ; il faut lister celle que l'on tape réellement. Vide ou absent = toutes
  origines autorisées (sans risque ici : aucun cookie n'est échangé, seulement un jeton explicite
  dans l'en-tête `Authorization`).

## Prérequis

Python **3.12** (testé avec 3.12.3). Toutes les dépendances sont figées dans
`backend/requirements.txt` ; le frontend n'a besoin que de `fastapi` et `uvicorn`, aux mêmes
versions : **un seul environnement virtuel suffit pour les deux services**.

## Démarrage (développement local)

Toutes les commandes se lancent **depuis la racine** du projet (le dossier qui contient
`backend/`, `frontend/` et `db/`). `backend` est un package Python : ses imports relatifs exigent
`backend.main:app`, et `uvicorn main:app` depuis `backend/` ne fonctionne pas.

```bash
# Une seule fois : environnement virtuel + dépendances + configuration
python3 -m venv venv && source venv/bin/activate
pip install -r backend/requirements.txt
cp backend/.env.example backend/.env          # APP_MODE=debug par défaut

# Terminal 1 — backend, sur :8000
uvicorn backend.main:app --reload

# Terminal 2 — frontend, sur :8080 (après « source venv/bin/activate » dans ce terminal)
python3 frontend/serve.py 8080
```

Ouvre <http://127.0.0.1:8080>. En mode debug, la documentation interactive de l'API est sur
<http://127.0.0.1:8000/api/docs>.

## Modes du backend (`APP_MODE` dans `backend/.env`)

| Mode         | Base de données                         | Variables requises                                      |
|--------------|-----------------------------------------|---------------------------------------------------------|
| `debug`      | SQLite locale `db/cyberpink.db` (créée seule) | aucune                                            |
| `production` | Turso                                   | `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `AUTH_SECRET` |

Le dossier de la base SQLite peut être changé avec la variable `DB_DIR`.

En production, l'application refuse de démarrer si une variable manque, si `AUTH_SECRET` est
trop faible ou si Turso est injoignable, et la documentation `/api/docs` est désactivée. Les
tables sont créées automatiquement au démarrage (schéma identique à l'ancienne version Next.js :
les données Turso existantes restent utilisables).

## Limites de taille

Elles protègent la base et les réponses publiques (`GET /api/comments` renvoie jusqu'à 50
commentaires d'un coup). Longueurs en **caractères** :

| Champ                         | Maximum |
|-------------------------------|---------|
| Nom · sujet de contact        | 100 · 200 |
| E-mail · téléphone            | 254 · 30 |
| Mot de passe                  | 128 |
| Commentaire · message de don  | 2000 |
| Message de contact            | 5000 |
| Nom de produit (don)          | 100 |
| **Corps d'une requête**       | **131 072 octets** |

Un champ trop long renvoie **400** avec un message en français ; un corps trop gros renvoie
**413** `{"error": "Requête trop volumineuse."}`. Les attributs `maxlength` des formulaires
reprennent ces valeurs : **si tu modifies `backend/limites.py`, aligne-les** (pages HTML et
`frontend/js/comments.js`).

## Docker

Chaque service a son propre `Dockerfile`, à construire et déployer indépendamment (le contexte
de build est le dossier du service).

```bash
# Backend
cd backend
docker build -t cyberpink-backend .
docker run --env-file .env -p 8000:8000 cyberpink-backend
# Essai local en debug, avec la base SQLite conservée dans un volume nommé :
docker run -e APP_MODE=debug -v cyberpink-db:/app/db -p 8000:8000 cyberpink-backend
```

Dans le conteneur, le dossier `db/` du projet correspond à `/app/db`. Avec un volume nommé, les
droits sont corrects ; avec un dossier de l'hôte (`-v $(pwd)/../db:/app/db`), il doit être
accessible en écriture à l'utilisateur 10001 (`chown 10001 db`).

```bash
# Frontend — vérifier d'abord API_BASE_URL dans js/api.js (elle est figée dans l'image) !
cd frontend
docker build -t cyberpink-frontend .
docker run -p 8080:8080 cyberpink-frontend
```

Les deux images tournent sous un utilisateur non-root, n'embarquent pas de secrets, et
exposent chacune une sonde de santé (`HEALTHCHECK`). Le backend respecte `$PORT` si
l'hébergeur le définit (8000 par défaut) ; le frontend écoute sur 8080.

## Pages (frontend)

| URL                  | Contenu                                           |
|----------------------|---------------------------------------------------|
| `/`                  | Landing page (+ champ « opinion » anonyme)        |
| `/produits`          | Registre des filiales + commentaires (`#commentaires`) |
| `/produits/{slug}`   | `antigramme`, `elyon`, `damundje`                 |
| `/dons` · `/contact` | Dons (Mobile Money) · formulaire de contact       |
| `/auth/login` · `/auth/register` | Connexion · inscription               |

## API (backend, préfixe `/api`)

| Méthode | Route                | Description |
|---------|----------------------|-------------|
| POST    | `/auth/register`     | Créer un compte. Renvoie `{"success": true, "id": …}` (pas de jeton) |
| POST    | `/auth/login`        | Connexion. Renvoie `{"success": true, "token": "…"}` |
| POST    | `/auth/logout`       | Rien côté serveur (pas de session stockée) ; le frontend oublie son jeton |
| GET     | `/auth/me`           | Utilisateur connecté (`{"user": null}` sinon), d'après `Authorization: Bearer` |
| GET     | `/comments`          | Commentaires publics (`?subject=`), 50 max. `?visibility=private` : admin uniquement |
| POST    | `/comments`          | Publier (connexion requise, sauf `anonymous: true`) |
| POST    | `/contact`           | Envoyer un message |
| POST    | `/dons`              | Enregistrer une intention de don (message + produit) |
| GET     | `/health`            | Sonde de santé (`{"ok": true}`) |

Toutes les erreurs ont la forme `{"error": "message en français"}`.

## Ajouter un produit

1. Ajouter l'entrée dans `frontend/js/products.js`.
2. Ajouter son `slug` dans `PRODUITS` de `frontend/serve.py`.
3. Si des commentaires lui sont liés, ajouter le sujet dans `SUJETS_AUTORISES`
   (`backend/routers/comments.py`) et dans `commentSubjects` (`frontend/js/products.js`).

## Créer un administrateur

Les comptes créés via le site ont le rôle `user`. Pour donner le rôle admin (accès aux
commentaires privés), exécuter sur la base (en debug : `sqlite3 db/cyberpink.db`) :

```sql
UPDATE users SET role = 'admin' WHERE email = 'toi@exemple.com';
```
