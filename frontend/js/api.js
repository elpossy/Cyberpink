// Client de l'API cyberPink.
//
// Le frontend est un service indépendant du backend (autre origine, autre port,
// potentiellement un autre domaine en production) : les deux ne communiquent que
// par HTTP, jamais par cookie. L'authentification se fait donc par un jeton que le
// serveur renvoie après connexion/inscription, que ce client conserve (localStorage)
// et renvoie dans l'en-tête `Authorization: Bearer <jeton>` à chaque appel.
//
// ⚠️ URL EN DUR À MODIFIER AVANT CHAQUE DÉPLOIEMENT :
//   - développement local (les deux sur la même machine) : "http://127.0.0.1:8000"
//   - production : l'URL publique du backend, ex. "https://api.cyberpink.app"
// Le backend doit alors avoir CORS_ORIGINS=<url-du-frontend> dans son .env, sinon le
// navigateur bloquera les requêtes (voir backend/.env.example).
export const API_BASE_URL = "http://127.0.0.1:8000";

const CLE_JETON = "cyberpink_token";

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function getToken() {
  try {
    return localStorage.getItem(CLE_JETON);
  } catch {
    return null; // stockage indisponible (navigation privée stricte, etc.)
  }
}

function setToken(jeton) {
  try {
    localStorage.setItem(CLE_JETON, jeton);
  } catch {
    /* tant pis : la session ne survivra pas au rechargement */
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(CLE_JETON);
  } catch {
    /* rien à faire */
  }
}

/**
 * Appelle l'API et renvoie le JSON de la réponse.
 * En cas d'erreur, lève une ApiError dont le message est affichable tel quel.
 * Si la réponse contient un jeton (ex. après connexion), il est mémorisé automatiquement.
 *
 * @param {string} chemin  ex. "/comments?subject=elyon"
 * @param {{method?: string, body?: object, erreurParDefaut?: string}} [options]
 */
export async function api(chemin, { method = "GET", body, erreurParDefaut = "Erreur serveur." } = {}) {
  const jeton = getToken();
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (jeton) headers["Authorization"] = `Bearer ${jeton}`;

  let reponse;
  try {
    reponse = await fetch(`${API_BASE_URL}/api${chemin}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Impossible de joindre le serveur. Vérifiez votre connexion.");
  }

  const donnees = await reponse.json().catch(() => ({}));
  if (!reponse.ok) {
    // Jeton refusé (expiré, invalide...) : on l'oublie pour ne pas le renvoyer en boucle.
    if (reponse.status === 401) clearToken();
    throw new ApiError(donnees.error || erreurParDefaut, reponse.status);
  }
  if (typeof donnees.token === "string") setToken(donnees.token);
  return donnees;
}

let utilisateurEnCache = null;

/** Utilisateur connecté ({id, name, email, role}) ou null. Mis en cache pour la page. */
export function getCurrentUser() {
  if (!getToken()) return Promise.resolve(null);
  if (!utilisateurEnCache) {
    utilisateurEnCache = api("/auth/me")
      .then((d) => d.user)
      .catch(() => null);
  }
  return utilisateurEnCache;
}

/** Empêche les redirections ouvertes : uniquement des chemins internes commençant par « / ». */
export function safeNextPath(brut) {
  if (!brut) return "/produits";
  const chemin = brut.trim();
  if (!chemin.startsWith("/") || chemin.startsWith("//") || chemin.includes("://")) {
    return "/produits";
  }
  return chemin;
}
