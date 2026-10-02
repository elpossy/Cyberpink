// Petit utilitaire pour construire du DOM sans jamais injecter de texte utilisateur en HTML.

/**
 * h("div", { class: "comment", onclick: fn }, "texte", autreElement)
 * Les enfants de type chaîne sont insérés comme du texte (jamais interprétés comme du HTML).
 */
export function h(balise, attributs = {}, ...enfants) {
  const el = document.createElement(balise);
  for (const [nom, valeur] of Object.entries(attributs)) {
    if (valeur === null || valeur === undefined || valeur === false) continue;
    if (nom === "class") el.className = valeur;
    else if (nom === "style" && typeof valeur === "string") el.style.cssText = valeur;
    else if (nom.startsWith("on") && typeof valeur === "function") {
      el.addEventListener(nom.slice(2), valeur);
    } else el.setAttribute(nom, valeur === true ? "" : String(valeur));
  }
  for (const enfant of enfants.flat()) {
    if (enfant === null || enfant === undefined || enfant === false) continue;
    el.append(enfant instanceof Node ? enfant : document.createTextNode(String(enfant)));
  }
  return el;
}

/** Remplace le contenu d'un conteneur. */
export function remplacer(conteneur, ...enfants) {
  conteneur.replaceChildren(...enfants.flat().filter(Boolean));
}

/** Affiche un message d'état sur un bouton (chargement / repos). */
export function etatBouton(bouton, enCours, texteRepos, texteEnCours) {
  bouton.disabled = enCours;
  bouton.textContent = enCours ? texteEnCours : texteRepos;
}

/** Échappe une chaîne pour l'insérer dans du HTML (à n'utiliser que pour des gabarits internes). */
export function esc(texte) {
  return String(texte)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
