"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/", label: "Accueil" },
  { href: "/produits", label: "Produits" },
  { href: "/dons", label: "Dons" },
  { href: "/contact", label: "Contact" },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="site">
      <div className="nav">
        <Link href="/" className="logo">
          <span className="dot" />
          cyberPink
          <span className="sub">Holding</span>
        </Link>

        <nav className="links">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href))
                  ? "active"
                  : ""
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="auth-links">
          <Link href="/auth/login" className="btn btn-ghost-dark" style={{ padding: "8px 14px", fontSize: 13 }}>
            Connexion
          </Link>
          <Link href="/auth/register" className="btn btn-primary" style={{ padding: "8px 14px", fontSize: 13 }}>
            S&apos;inscrire
          </Link>
        </div>
      </div>
    </header>
  );
}
