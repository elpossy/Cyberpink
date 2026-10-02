// Page de contact (/contact).

import { api } from "../api.js";
import { etatBouton } from "../dom.js";
import { initLayout } from "../layout.js";

initLayout();

const formulaire = document.getElementById("form-contact");
const bouton = document.getElementById("bouton");
const erreur = document.getElementById("erreur");
const succes = document.getElementById("notice-succes");

formulaire.addEventListener("submit", async (e) => {
  e.preventDefault();
  etatBouton(bouton, true, "Envoyer le message", "Envoi...");
  erreur.hidden = true;

  const champs = formulaire.elements;
  try {
    await api("/contact", {
      method: "POST",
      body: {
        name: champs.name.value,
        email: champs.email.value,
        phone: champs.phone.value,
        subject: champs.subject.value,
        message: champs.message.value,
      },
      erreurParDefaut: "Erreur lors de l'envoi",
    });
    formulaire.hidden = true;
    succes.hidden = false;
  } catch (err) {
    erreur.textContent = err.message;
    erreur.hidden = false;
    etatBouton(bouton, false, "Envoyer le message", "Envoi...");
  }
});
