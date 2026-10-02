// Page d'inscription (/auth/register).

import { api, safeNextPath } from "../api.js";
import { etatBouton } from "../dom.js";
import { initLayout } from "../layout.js";

initLayout();

const suite = safeNextPath(new URLSearchParams(location.search).get("next"));

const formulaire = document.getElementById("form-inscription");
const bouton = document.getElementById("bouton");
const erreur = document.getElementById("erreur");

document.getElementById("lien-connexion").href = `/auth/login?next=${encodeURIComponent(suite)}`;

formulaire.addEventListener("submit", async (e) => {
  e.preventDefault();
  etatBouton(bouton, true, "S'inscrire", "Création...");
  erreur.hidden = true;

  const champs = formulaire.elements;
  try {
    await api("/auth/register", {
      method: "POST",
      body: {
        name: champs.name.value,
        email: champs.email.value,
        phone: champs.phone.value,
        password: champs.password.value,
      },
      erreurParDefaut: "Erreur lors de l'inscription",
    });
    // Après l'inscription : connexion, en conservant la destination.
    location.assign(`/auth/login?registered=1&next=${encodeURIComponent(suite)}`);
  } catch (err) {
    erreur.textContent = err.message;
    erreur.hidden = false;
    etatBouton(bouton, false, "S'inscrire", "Création...");
  }
});
