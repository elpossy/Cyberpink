// En-tête et pied de page des pages « holding » (tout sauf la landing page).

import { api, clearToken, getCurrentUser } from "./api.js";
import { h, remplacer } from "./dom.js";

const NAVIGATION = [
  { href: "/", label: "Accueil" },
  { href: "/produits", label: "Produits" },
  { href: "/dons", label: "Dons" },
  { href: "/contact", label: "Contact" },
];

function estActif(href) {
  const chemin = location.pathname;
  return chemin === href || (href !== "/" && chemin.startsWith(href));
}

function boutons() {
  return [
    h(
      "a",
      { href: "/auth/login", class: "btn btn-ghost-dark", style: "padding: 8px 14px; font-size: 13px" },
      "Connexion"
    ),
    h(
      "a",
      { href: "/auth/register", class: "btn btn-primary", style: "padding: 8px 14px; font-size: 13px" },
      "S'inscrire"
    ),
  ];
}

function zoneUtilisateur(utilisateur) {
  const deconnexion = h(
    "button",
    {
      type: "button",
      class: "btn btn-ghost-dark",
      style: "padding: 8px 14px; font-size: 13px",
      onclick: async () => {
        // Le jeton n'est pas stocké côté serveur : se déconnecter, c'est l'oublier ici.
        try {
          await api("/auth/logout", { method: "POST" });
        } finally {
          clearToken();
          location.reload();
        }
      },
    },
    "Déconnexion"
  );
  return [
    h(
      "span",
      {
        style:
          "color: #C9C4D1; font-size: 13px; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap",
      },
      `Bonjour, ${utilisateur.name}`
    ),
    deconnexion,
  ];
}

function construireEntete(entete) {
  const zoneAuth = h("div", { class: "auth-links", style: "visibility: hidden" });

  remplacer(
    entete,
    h(
      "div",
      { class: "nav" },
      h(
        "a",
        { href: "/", class: "logo" },
        h("span", { class: "dot" }),
        "cyberPink",
        h("span", { class: "sub" }, "Holding")
      ),
      h(
        "nav",
        { class: "links" },
        NAVIGATION.map((n) => h("a", { href: n.href, class: estActif(n.href) ? "active" : null }, n.label))
      ),
      zoneAuth
    )
  );

  // L'état de connexion est affiché dès qu'il est connu (zone masquée d'ici là, sans décalage).
  getCurrentUser().then((utilisateur) => {
    remplacer(zoneAuth, utilisateur ? zoneUtilisateur(utilisateur) : boutons());
    zoneAuth.style.visibility = "visible";
  });
}

function colonne(titre, liens) {
  return h(
    "div",
    {},
    h("h4", {}, titre),
    liens.map(([href, libelle]) => h("a", { href }, libelle))
  );
}

function construirePied(pied) {
  remplacer(
    pied,
    h(
      "div",
      { class: "wrap" },
      h(
        "div",
        { class: "cols" },
        colonne("Navigation", [
          ["/", "Accueil"],
          ["/produits", "Produits"],
          ["/dons", "Dons"],
          ["/contact", "Contact"],
        ]),
        colonne("Filiales", [
          ["/produits/antigramme", "Antigramme"],
          ["/produits/elyon", "Elyon"],
          ["/produits/damundje", "Damundjé"],
        ]),
        colonne("Compte", [
          ["/auth/login", "Connexion"],
          ["/auth/register", "S'inscrire"],
        ]),
        colonne("Soutenir", [
          ["/dons", "Faire un don"],
          ["/contact", "Nous contacter"],
        ])
      )
    ),
    h(
      "div",
      { class: "wrap bottom" },
      h("span", {}, "© 2026 cyberPink — Niamey, Niger"),
      h("span", {}, "Maison mère d'Antigramme, Elyon et Damundjé")
    )
  );
}

/** À appeler sur chaque page holding : remplit <header data-site-header> et <footer data-site-footer>. */
export function initLayout() {
  const entete = document.querySelector("[data-site-header]");
  const pied = document.querySelector("[data-site-footer]");
  if (entete) construireEntete(entete);
  if (pied) construirePied(pied);
}
