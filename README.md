# cyberPink — monorepo

Next.js : landing + holding (produits, auth, commentaires, dons) + API + Turso.

## Variables d'environnement

Il n'y a **pas** de `.env` commité (secrets). Tu dois le créer :

```bash
cp .env.example .env.local
```

Puis remplir :

```env
AUTH_SECRET=...                    # openssl rand -hex 32
TURSO_DATABASE_URL=libsql://...    # obligatoire sur Vercel
TURSO_AUTH_TOKEN=...
```

Sur **Vercel** : Settings → Environment Variables (mêmes clés).

Sans `TURSO_*` en local → `file:cyberpink.db` automatique.

## Tables auto (1ʳᵉ requête)

À **chaque premier appel** API du process, `ensureDb()` crée :

| Table | Rôle |
|-------|------|
| `users` | Comptes (email, téléphone, mot de passe) |
| `comments` | Commentaires / opinions (public/privé, anonyme OK) |
| `contacts` | Formulaire contact |
| `donations` | Messages de dons |
| `_migrations` | Suivi des migrations |

+ index sur email, subject, visibility, dates, etc.

Vérifier à la main :

```bash
curl http://localhost:3000/api/setup
```

→ `{ ok: true, mode: "turso"|"local-file", tables: [...] }`

## RLS (Row Level Security)

**Turso = SQLite/libSQL → pas de RLS PostgreSQL.**

Sécurité cyberPink :

1. **API** : session cookie, rôles (`user`/`admin`), filtre `visibility`
2. **Turso** : token d’accès (ne partage pas le token en public)
3. Commentaires privés : jamais renvoyés en `GET` public (`visibility = 'public'` seulement)

## Démarrage

```bash
npm install
cp .env.example .env.local   # remplir Turso pour prod
npm run dev
```

## API

| Route | Rôle |
|-------|------|
| `GET /api/setup` | Init + diagnostic DB |
| `POST /api/auth/register` | Inscription |
| `POST /api/auth/login` | Connexion |
| `GET/POST /api/comments` | Commentaires |
| `POST /api/contact` | Contact |
| `POST /api/dons` | Dons |

## Dons

+227 86 06 90 20 — MyNita, Amanata, Wave, Airtel Money

© 2026 cyberPink — Niamey, Niger
