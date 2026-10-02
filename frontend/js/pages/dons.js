// Page de dons (/dons) : numéro Mobile Money + enregistrement d'un message d'intention.

import { api } from "../api.js";
import { etatBouton } from "../dom.js";
import { initLayout } from "../layout.js";

initLayout();

const params = new URLSearchParams(location.search);
const messageInitial =
  params.get("message") || "Je contribue au développement de ma nation en investissant dans cyberPink.";
const produit = params.get("product") || "";

const formulaire = document.getElementById("form-don");
const champMessage = document.getElementById("message");
const bouton = document.getElementById("bouton");
const erreur = document.getElementById("erreur");
const succes = document.getElementById("notice-succes");

champMessage.value = messageInitial;

if (produit) {
  document.getElementById("contexte-produit-nom").textContent = produit;
  document.getElementById("contexte-produit").hidden = false;
}

formulaire.addEventListener("submit", async (e) => {
  e.preventDefault();
  etatBouton(bouton, true, "Envoyer mon message", "Envoi...");
  erreur.hidden = true;

  try {
    await api("/dons", {
      method: "POST",
      body: { message: champMessage.value.trim(), product: produit || null },
      erreurParDefaut: "Erreur lors de l'envoi",
    });
    formulaire.hidden = true;
    succes.hidden = false;
  } catch (err) {
    erreur.textContent = err.message;
    erreur.hidden = false;
    etatBouton(bouton, false, "Envoyer mon message", "Envoi...");
  }
});
