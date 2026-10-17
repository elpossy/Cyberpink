// Adresse publique de l'API. En local : uvicorn sur le port 8000.
// Au déploiement, remplacer cette valeur par l'URL HTTPS du backend, sans /api final.
export const API_BASE_URL = "http://127.0.0.1:8000";

const TOKEN_KEY = "cyberpink.authToken";

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Enregistre le jeton renvoyé par /auth/login pour les prochains appels API. */
export function enregistrerToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
  utilisateurEnCache = null;
}

/** Oublie la session locale : l'API utilise des jetons non persistés côté serveur. */
export function oublierToken() {
  localStorage.removeItem(TOKEN_KEY);
  utilisateurEnCache = null;
}

/**
 * Appelle l'API et renvoie le JSON de la réponse.
 * En cas d'erreur, lève une ApiError dont le message est affichable tel quel.
 *
 * @param {string} chemin  ex. "/comments?subject=elyon"
 * @param {{method?: string, body?: object, erreurParDefaut?: string}} [options]
 */
export async function api(chemin, { method = "GET", body, erreurParDefaut = "Erreur serveur." } = {}) {
  let reponse;
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const headers = body !== undefined ? { "Content-Type": "application/json" } : {};
    if (token) headers.Authorization = `Bearer ${token}`;
    reponse = await fetch(`${API_BASE_URL}/api${chemin}`, {
      method,
      headers: Object.keys(headers).length ? headers : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError("Impossible de joindre le serveur. Vérifiez votre connexion.");
  }

  const donnees = await reponse.json().catch(() => ({}));
  if (!reponse.ok) {
    throw new ApiError(donnees.error || erreurParDefaut, reponse.status);
  }
  return donnees;
}

let utilisateurEnCache = null;

/** Utilisateur connecté ({id, name, email, role}) ou null. Mis en cache pour la page. */
export function getCurrentUser() {
  if (!utilisateurEnCache) {
    utilisateurEnCache = api("/auth/me")
      .then((d) => d.user)
      .catch(() => null);
  }
  return utilisateurEnCache;
}

/** Empêche les redirections ouvertes : uniquement des chemins internes commençant par « / ». */
export function safeNextPath(brut) {
  if (!brut) return "/produits.html";
  const chemin = brut.trim();
  if (!chemin.startsWith("/") || chemin.startsWith("//") || chemin.includes("://")) {
    return "/produits.html";
  }
  return chemin;
}
