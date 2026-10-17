// Page d'un produit (/produit.html?product=antigramme, etc.).

import { chargerCommentaires, montrerFormulaireCommentaire } from "../comments.js";
import { esc } from "../dom.js";
import { initLayout } from "../layout.js";
import { donateClass, donateUrl, getProduct } from "../products.js";

initLayout();

const slug = new URLSearchParams(location.search).get("product");
const produit = getProduct(slug);
const racine = document.getElementById("contenu-produit");

if (!produit) {
  racine.innerHTML = `
    <section class="hero" style="padding: 64px 0 48px"><div class="wrap">
      <span class="eyebrow">Erreur 404</span>
      <h1 style="font-size: clamp(30px, 4.4vw, 44px)">Produit introuvable</h1>
      <div class="hero-cta"><a href="/produits.html" class="btn btn-primary">← Tous les produits</a></div>
    </div></section>`;
} else {
  document.title = `${produit.name} — cyberPink`;

  const disponible = produit.status === "available" && produit.tryUrl;
  const essayer = (classe) =>
    disponible ? `<a href="${esc(produit.tryUrl)}" class="${classe}">${esc(produit.tryLabel)}</a>` : "";
  const don = (variante) =>
    `<a href="${esc(donateUrl(produit.name))}" class="${donateClass(variante)}">Faire un don</a>`;

  racine.innerHTML = `
    <section class="hero" style="padding: 64px 0 48px">
      <div class="wrap">
        <span class="eyebrow">${esc(produit.code)}</span>
        <h1 style="font-size: clamp(30px, 4.4vw, 44px); margin-top: 12px">${esc(produit.name)}</h1>
        <p class="lead">${esc(produit.shortDesc)}</p>
        <div class="hero-cta">
          ${essayer("btn btn-primary")}
          ${don("ghost-dark")}
          <a href="/produits.html" class="btn btn-ghost-dark">← Tous les produits</a>
        </div>
      </div>
    </section>

    <section>
      <div class="wrap grid-2">
        <div>
          <span class="eyebrow">À propos</span>
          <h2 style="margin-top: 14px; font-size: 26px">${esc(produit.name)}</h2>
          <p style="color: var(--slate); margin-top: 16px; line-height: 1.7">${esc(produit.longDesc)}</p>
          <div style="margin-top: 28px; display: flex; gap: 12px; flex-wrap: wrap">
            ${essayer("btn btn-primary")}
            ${don("outline-pink")}
          </div>
        </div>
        <div>
          <div class="card">
            <span class="reg-code">Statut</span>
            <h3 style="font-size: 18px; margin-top: 10px">${esc(produit.statusLabel)}</h3>
            <p style="margin-bottom: 0">${
              produit.status === "available"
                ? "Ce produit est accessible. Cliquez sur le bouton pour l'essayer."
                : "Ce produit est en cours de développement. Revenez bientôt."
            }</p>
          </div>
          <div class="card" style="margin-top: 16px">
            <span class="reg-code">Maison mère</span>
            <h3 style="font-size: 18px; margin-top: 10px">cyberPink</h3>
            <p style="margin-bottom: 0">Filiale de la holding cyberPink, basée à Niamey, Niger. Produit conçu par et pour l'Afrique.</p>
          </div>
        </div>
      </div>
    </section>

    <hr class="divider">

    <section>
      <div class="wrap">
        <div class="section-head">
          <span class="eyebrow">Commentaires — ${esc(produit.name)}</span>
          <h2 style="margin-top: 14px">Retours de la communauté</h2>
          <p>Les commentaires ci-dessous concernent ${esc(produit.name)}. Le sujet est pré-sélectionné. Vous pouvez choisir une visibilité publique ou privée.</p>
        </div>

        <div id="commentaires-liste"></div>

        <div style="margin-top: 36px">
          <h3 style="font-size: 18px; margin-bottom: 12px">Commenter ${esc(produit.name)}</h3>
          <div id="commentaires-formulaire"></div>
        </div>

        <div style="margin-top: 40px">${don("primary")}</div>
      </div>
    </section>`;

  const liste = document.getElementById("commentaires-liste");
  const recharger = () =>
    chargerCommentaires(liste, {
      sujet: produit.slug,
      messageVide: `Aucun commentaire public sur ${produit.name} pour le moment. Soyez le premier.`,
    });

  recharger();
  montrerFormulaireCommentaire(document.getElementById("commentaires-formulaire"), {
    sujetParDefaut: produit.slug,
    sujetVerrouille: true,
    apresPublication: recharger,
  });
}
