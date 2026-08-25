import Link from "next/link";

export function Footer() {
  return (
    <footer className="site">
      <div className="wrap">
        <div className="cols">
          <div>
            <h4>Navigation</h4>
            <Link href="/">Accueil</Link>
            <Link href="/produits">Produits</Link>
            <Link href="/dons">Dons</Link>
            <Link href="/contact">Contact</Link>
          </div>
          <div>
            <h4>Filiales</h4>
            <Link href="/produits/antigramme">Antigramme</Link>
            <Link href="/produits/elyon">Elyon</Link>
            <Link href="/produits/damundje">Damundjé</Link>
          </div>
          <div>
            <h4>Compte</h4>
            <Link href="/auth/login">Connexion</Link>
            <Link href="/auth/register">S&apos;inscrire</Link>
          </div>
          <div>
            <h4>Soutenir</h4>
            <Link href="/dons">Faire un don</Link>
            <Link href="/contact">Nous contacter</Link>
          </div>
        </div>
      </div>
      <div className="wrap bottom">
        <span>© 2026 cyberPink — Niamey, Niger</span>
        <span>Maison mère d&apos;Antigramme, Elyon et Damundjé</span>
      </div>
    </footer>
  );
}
