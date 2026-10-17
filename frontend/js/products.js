// Données des produits et des sujets de commentaires.
// Les slugs doivent rester synchronisés avec PRODUITS dans backend/routers/pages.py.

export const products = [
  {
    slug: "antigramme",
    code: "ANT · 01",
    name: "Antigramme",
    status: "available",
    statusLabel: "● Disponible",
    shortDesc: "Réseau social pensé pour se retrouver et rester proche.",
    longDesc:
      "Un espace social pensé pour se retrouver, s'exprimer et rester proche de ceux qui comptent. Sur Antigramme, chacun construit son cercle : on s'abonne aux personnes et pages qui nous intéressent, on réagit et on commente ce qui nous touche. La messagerie instantanée et les appels intégrés permettent de garder le contact en temps réel, sans jamais quitter la plateforme. Un seul endroit pour publier, discuter et échanger.",
    tryLabel: "Essayer Antigramme",
    tryUrl: "#", // à remplacer par l'URL réelle plus tard
  },
  {
    slug: "elyon",
    code: "ELY · 02",
    name: "Elyon",
    status: "soon",
    statusLabel: "● Bientôt disponible",
    shortDesc: "LLM spécialisé dans l'éducation et l'auto-formation.",
    longDesc:
      "Un assistant intelligent conçu pour accompagner l'apprentissage, pas pour s'y substituer. Elyon aide les élèves et étudiants à chercher, comprendre et progresser par eux-mêmes : il explique une méthode, pose les bonnes questions et montre comment arriver à la réponse, plutôt que de la donner directement. Pensé comme un professeur particulier disponible à tout moment, pour l'auto-formation et la réussite scolaire.",
    tryLabel: "Essayer Elyon",
    tryUrl: "#",
  },
  {
    slug: "damundje",
    code: "DMJ · 03",
    name: "Damundjé",
    status: "soon",
    statusLabel: "● Bientôt disponible",
    shortDesc: "Plateforme de commerce électronique (Amazon-like).",
    longDesc:
      "Damundjé est une plateforme de commerce électronique pensée pour l'Afrique. Elle permet aux vendeurs locaux de proposer leurs produits et aux acheteurs de trouver ce dont ils ont besoin, simplement et en toute confiance. Une infrastructure commerciale numérique au service des économies locales.",
    tryLabel: "Essayer Damundjé",
    tryUrl: "#",
  },
];

export function getProduct(slug) {
  return products.find((p) => p.slug === slug);
}

export const commentSubjects = [
  { value: "recommandation", label: "Recommandation" },
  { value: "generale", label: "Générale" },
  { value: "cyberpink", label: "cyberPink" },
  { value: "antigramme", label: "Antigramme" },
  { value: "elyon", label: "Elyon" },
  { value: "damundje", label: "Damundjé" },
];

/** Lien vers la page de don, avec message (et produit) pré-remplis. */
export function donateUrl(productName) {
  const message = productName
    ? `Je contribue au développement de ma nation en investissant dans ${productName}.`
    : "Je contribue au développement de ma nation en investissant dans cyberPink.";
  return `/dons.html?message=${encodeURIComponent(message)}${
    productName ? `&product=${encodeURIComponent(productName)}` : ""
  }`;
}

const VARIANTES_DON = {
  primary: "btn btn-primary",
  "ghost-light": "btn btn-ghost-light",
  "ghost-dark": "btn btn-ghost-dark",
  "outline-pink": "btn btn-outline-pink",
};

/** Classes CSS d'un bouton « Faire un don » selon sa variante. */
export function donateClass(variant = "primary") {
  return VARIANTES_DON[variant] || VARIANTES_DON["outline-pink"];
}

/** Bouton « Faire un don » (élément <a>). */
export function donateButton({ productName, variant = "primary" } = {}) {
  const a = document.createElement("a");
  a.href = donateUrl(productName);
  a.className = donateClass(variant);
  a.textContent = "Faire un don";
  return a;
}
