# cyberPink — backend (API uniquement, service indépendant du frontend)
# Construire (depuis le dossier backend/) :  docker build -t cyberpink-backend .
# Lancer     :  docker run --env-file .env -p 8000:8000 cyberpink-backend
# Debug + données conservées : docker run -e APP_MODE=debug -v cyberpink-db:/app/db -p 8000:8000 cyberpink-backend
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    APP_MODE=production

# Le code garde son nom de package "backend" (imports relatifs .config, ..database, etc.,
# écrits pour "backend.main") : le contenu du dossier backend/ (= build context) est copié
# dans /app/backend/, et uvicorn est lancé depuis /app.
WORKDIR /app

# Dépendances d'abord : cette couche est mise en cache tant que requirements.txt ne change pas.
COPY requirements.txt backend/requirements.txt
RUN pip install -r backend/requirements.txt

# COPY d'un dossier = copie de son CONTENU : /app/backend/main.py, /app/backend/routers/...
# (.dockerignore exclut .env, __pycache__, Dockerfile...)
COPY . backend/

# Utilisateur non-root. /app/db n'est utile qu'en APP_MODE=debug (SQLite locale) : y monter un volume.
RUN useradd --system --uid 10001 --no-create-home app \
    && mkdir -p db \
    && chown -R app:app db
USER app

EXPOSE 8000

# $PORT est fourni par certains hébergeurs (Render, Railway...) ; 8000 par défaut.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD ["python", "-c", "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:%s/api/health' % os.environ.get('PORT', '8000'), timeout=3)"]

CMD ["sh", "-c", "exec uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
