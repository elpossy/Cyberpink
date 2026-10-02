// Page d'accueil (/) : en-tête au défilement, menu mobile, opinion anonyme.

import { api } from "../api.js";

// --- En-tête : compact et opaque dès qu'on défile ---
const entete = document.querySelector(".site-header");
const majEntete = () => entete.classList.toggle("site-header--scrolled", window.scrollY > 24);
majEntete();
window.addEventListener("scroll", majEntete, { passive: true });

// --- Menu mobile ---
const bouton = document.querySelector(".menu-toggle");
const navigation = document.querySelector(".site-nav");
const iconeMenu = document.getElementById("icone-menu");
const iconeFermer = document.getElementById("icone-fermer");

function ouvrirMenu(ouvert) {
  navigation.classList.toggle("site-nav--open", ouvert);
  bouton.setAttribute("aria-expanded", String(ouvert));
  bouton.setAttribute("aria-label", ouvert ? "Fermer le menu" : "Ouvrir le menu");
  iconeMenu.hidden = ouvert;
  iconeFermer.hidden = !ouvert;
}

bouton.addEventListener("click", () => ouvrirMenu(!navigation.classList.contains("site-nav--open")));
navigation.addEventListener("click", (e) => {
  if (e.target.closest("a")) ouvrirMenu(false);
});
document.querySelector(".header-brand").addEventListener("click", () => ouvrirMenu(false));

// --- Opinion anonyme (enregistrée comme commentaire public, sujet « opinion ») ---
const formulaire = document.getElementById("form-opinion");
const champ = document.getElementById("opinion");
const envoyer = document.getElementById("opinion-envoyer");
const succes = document.getElementById("opinion-succes");
const erreur = document.getElementById("opinion-erreur");

formulaire.addEventListener("submit", async (e) => {
  e.preventDefault();
  const texte = champ.value.trim();
  if (!texte) return;

  envoyer.disabled = true;
  envoyer.textContent = "Envoi...";
  succes.hidden = true;
  erreur.hidden = true;

  try {
    await api("/comments", {
      method: "POST",
      body: { subject: "opinion", content: texte, visibility: "public", anonymous: true },
      erreurParDefaut: "Erreur lors de l'envoi",
    });
    champ.value = "";
    succes.hidden = false;
    setTimeout(() => (succes.hidden = true), 3000);
  } catch (err) {
    erreur.textContent = err.message;
    erreur.hidden = false;
  } finally {
    envoyer.disabled = false;
    envoyer.textContent = "Publier mon opinion";
  }
});
