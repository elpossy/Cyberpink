// Liste et formulaire de commentaires (partagés par la page Produits et les pages produit).

import { api, getCurrentUser } from "./api.js";
import { h, remplacer, etatBouton } from "./dom.js";
import { commentSubjects } from "./products.js";

export function formatDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// « opinion » n'est pas proposé dans le formulaire (il vient du champ de la page d'accueil).
const LIBELLES_SUPPLEMENTAIRES = { opinion: "Opinion" };

function libelleSujet(valeur) {
  return (
    commentSubjects.find((s) => s.value === valeur)?.label ??
    LIBELLES_SUPPLEMENTAIRES[valeur] ??
    valeur
  );
}

function avis(message) {
  return h("div", { class: "notice" }, h("p", { style: "margin: 0" }, message));
}

function carteCommentaire(c) {
  return h(
    "article",
    { class: "comment" },
    h(
      "div",
      { class: "comment-header" },
      h(
        "div",
        { style: "display: flex; align-items: center; gap: 10px; flex-wrap: wrap" },
        h("span", { class: "comment-author" }, c.authorName),
        h("span", { class: "comment-subject" }, libelleSujet(c.subject)),
        c.visibility === "private" ? h("span", { class: "badge private" }, "Privé") : null
      ),
      h("div", { class: "comment-meta" }, h("span", {}, formatDate(c.createdAt)))
    ),
    h("div", { class: "comment-body" }, c.content)
  );
}

/** Affiche une liste de commentaires (ou le message « vide »). */
export function renderCommentList(conteneur, commentaires, messageVide) {
  if (!commentaires.length) {
    remplacer(conteneur, avis(messageVide));
    return;
  }
  remplacer(conteneur, h("div", {}, commentaires.map(carteCommentaire)));
}

/** Charge les commentaires publics (d'un sujet, ou tous) depuis l'API et les affiche. */
export async function chargerCommentaires(conteneur, { sujet, messageVide }) {
  try {
    const query = sujet ? `?subject=${encodeURIComponent(sujet)}` : "";
    const commentaires = await api(`/comments${query}`);
    renderCommentList(conteneur, commentaires, messageVide);
  } catch (err) {
    remplacer(conteneur, avis(err.message));
  }
}

function lienConnexion(chemin, libelle) {
  return h("a", { href: chemin, style: "color: var(--pink); text-decoration: underline" }, libelle);
}

/**
 * Formulaire de commentaire. Si le visiteur n'est pas connecté, affiche une invitation à
 * se connecter (avec retour sur la page courante après connexion).
 */
export async function montrerFormulaireCommentaire(
  conteneur,
  { sujetParDefaut = "recommandation", sujetVerrouille = false, apresPublication } = {}
) {
  const utilisateur = await getCurrentUser();

  if (!utilisateur) {
    const retour = encodeURIComponent(location.pathname + location.hash);
    remplacer(
      conteneur,
      h(
        "div",
        { class: "notice", style: "margin-top: 8px" },
        h(
          "p",
          { style: "margin: 0" },
          "Connectez-vous pour publier un commentaire et participer à la conversation. ",
          lienConnexion(`/auth/login?next=${retour}`, "Se connecter"),
          " ou ",
          lienConnexion(`/auth/register?next=${retour}`, "créer un compte"),
          "."
        )
      )
    );
    return;
  }

  const choixSujet = h(
    "select",
    { id: "subject", disabled: sujetVerrouille },
    commentSubjects.map((s) =>
      h("option", { value: s.value, selected: s.value === sujetParDefaut }, s.label)
    )
  );
  const choixVisibilite = h(
    "select",
    { id: "visibility" },
    h("option", { value: "public" }, "Public — visible par tous"),
    h("option", { value: "private" }, "Privé — uniquement l'administration")
  );
  const contenu = h("textarea", {
    id: "content",
    placeholder: "Partagez une recommandation, une idée, un retour...",
    required: true,
    rows: "4",
    maxlength: "2000",
  });
  const bouton = h(
    "button",
    { type: "submit", class: "btn btn-primary", style: "border: none; cursor: pointer" },
    "Publier le commentaire"
  );
  const statut = h("span", { style: "font-size: 14px" });

  const formulaire = h(
    "form",
    { class: "contact-form", style: "margin-top: 8px" },
    h(
      "div",
      { style: "display: grid; grid-template-columns: 1fr 1fr; gap: 16px" },
      h("div", { class: "field" }, h("label", { for: "subject" }, "Sujet"), choixSujet),
      h("div", { class: "field" }, h("label", { for: "visibility" }, "Visibilité"), choixVisibilite)
    ),
    h("div", { class: "field" }, h("label", { for: "content" }, "Votre commentaire"), contenu),
    h(
      "div",
      { style: "display: flex; align-items: center; gap: 16px; flex-wrap: wrap" },
      bouton,
      statut
    )
  );

  formulaire.addEventListener("submit", async (e) => {
    e.preventDefault();
    const texte = contenu.value.trim();
    if (!texte) return;

    etatBouton(bouton, true, "Publier le commentaire", "Envoi...");
    statut.textContent = "";
    try {
      await api("/comments", {
        method: "POST",
        body: { subject: choixSujet.value, visibility: choixVisibilite.value, content: texte },
        erreurParDefaut: "Erreur lors de l'envoi",
      });
      contenu.value = "";
      statut.style.color = "#1a7a4c";
      statut.textContent = "Commentaire publié ✓";
      setTimeout(() => (statut.textContent = ""), 2500);
      if (apresPublication) apresPublication();
    } catch (err) {
      statut.style.color = "var(--pink)";
      statut.textContent = err.message;
    } finally {
      etatBouton(bouton, false, "Publier le commentaire", "Envoi...");
    }
  });

  remplacer(conteneur, formulaire);
}
