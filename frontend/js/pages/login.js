// Page de connexion (/auth/login).

import { api, getCurrentUser, safeNextPath } from "../api.js";
import { etatBouton } from "../dom.js";
import { initLayout } from "../layout.js";

initLayout();

const params = new URLSearchParams(location.search);
const suite = safeNextPath(params.get("next"));
const inscritAvecSucces = Boolean(params.get("registered"));

const formulaire = document.getElementById("form-connexion");
const bouton = document.getElementById("bouton");
const erreur = document.getElementById("erreur");

document.getElementById("lien-inscription").href = `/auth/register?next=${encodeURIComponent(suite)}`;
if (inscritAvecSucces) document.getElementById("notice-inscription").hidden = false;

// Déjà connecté : on renvoie directement vers la page demandée.
if (!inscritAvecSucces) {
  getCurrentUser().then((utilisateur) => {
    if (utilisateur) location.replace(suite);
  });
}

formulaire.addEventListener("submit", async (e) => {
  e.preventDefault();
  etatBouton(bouton, true, "Se connecter", "Connexion...");
  erreur.hidden = true;

  try {
    await api("/auth/login", {
      method: "POST",
      body: {
        email: formulaire.elements.email.value,
        password: formulaire.elements.password.value,
      },
      erreurParDefaut: "Identifiants incorrects",
    });
    location.assign(suite);
  } catch (err) {
    erreur.textContent = err.message;
    erreur.hidden = false;
    etatBouton(bouton, false, "Se connecter", "Connexion...");
  }
});
