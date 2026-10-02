# cyberPink — frontend (fichiers statiques + petit serveur FastAPI, service indépendant du backend)
# Construire (depuis le dossier frontend/) :  docker build -t cyberpink-frontend .
# Lancer     :  docker run -p 8080:8080 cyberpink-frontend
#
# ⚠️ Avant de construire l'image, vérifie js/api.js : API_BASE_URL doit pointer vers
# l'URL publique du backend (voir le commentaire en haut de ce fichier).
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN pip install fastapi==0.141.1 "uvicorn[standard]==0.53.0"
COPY . .
RUN rm -f Dockerfile .dockerignore

RUN useradd --system --uid 10001 --no-create-home app && chown -R app:app /app
USER app

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/', timeout=3)"]

CMD ["python", "serve.py", "8080"]
