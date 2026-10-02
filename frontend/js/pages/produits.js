// Page « Produits » (/produits) : registre des filiales + commentaires généraux (#commentaires).

import { chargerCommentaires, montrerFormulaireCommentaire } from "../comments.js";
import { esc } from "../dom.js";
import { initLayout } from "../layout.js";
import { donateButton, products } from "../products.js";

initLayout();

function carteProduit(p) {
  const essayer =
    p.status === "available" && p.tryUrl
      ? `<a href="${esc(p.tryUrl)}" class="btn btn-outline-pink" style="font-size: 13px; padding: 10px 16px">${esc(p.tryLabel)}</a>`
      : "";
  return `
    <div class="card" id="${esc(p.slug)}">
      <span class="reg-code">${esc(p.code)} · Filiale</span>
      <span class="status ${p.status === "available" ? "available" : "soon"}">${esc(p.statusLabel)}</span>
      <h3>${esc(p.name)}</h3>
      <p>${esc(p.longDesc)}</p>
      <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-top: 8px">
        <a href="/produits/${esc(p.slug)}" class="btn btn-primary" style="font-size: 13px; padding: 10px 16px">Voir la page</a>
        ${essayer}
      </div>
    </div>`;
}

document.getElementById("liste-produits").innerHTML = products.map(carteProduit).join("");
document.getElementById("zone-don").append(donateButton());

// Commentaires généraux (tous sujets confondus)
const liste = document.getElementById("commentaires-liste");
const recharger = () =>
  chargerCommentaires(liste, {
    messageVide: "Aucun commentaire public pour le moment. Soyez le premier à partager une recommandation.",
  });

recharger();
montrerFormulaireCommentaire(document.getElementById("commentaires-formulaire"), {
  sujetParDefaut: "recommandation",
  apresPublication: recharger,
});
