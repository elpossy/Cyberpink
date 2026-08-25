"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUpRight,
  Binary,
  BrainCircuit,
  ChevronDown,
  GraduationCap,
  HeartPulse,
  Menu,
  PackageOpen,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";

const PI_MARK = "/assets/cyberpink-pi-mark.png";

const domains = [
  {
    number: "01",
    name: "Intelligence",
    eyebrow: "LLM & systèmes",
    description:
      "Des outils de raisonnement et de langage pensés pour augmenter la capacité d'action, pas l'opacité.",
    icon: BrainCircuit,
    tone: "bg-pink-200",
  },
  {
    number: "02",
    name: "Santé",
    eyebrow: "Sciences humaines",
    description:
      "Des approches de santé qui rapprochent la recherche, le soin et l'accès à une information compréhensible.",
    icon: HeartPulse,
    tone: "bg-[#E8DDD1]",
  },
  {
    number: "03",
    name: "Éducation",
    eyebrow: "Transmission",
    description:
      "Des environnements où apprendre, fabriquer et partager deviennent une pratique quotidienne et ouverte.",
    icon: GraduationCap,
    tone: "bg-[#DDE3FF]",
  },
  {
    number: "04",
    name: "Appareils",
    eyebrow: "Hardware & code",
    description:
      "Des produits programmables, précis et réparables, du prototype aux systèmes qui vivent dans le réel.",
    icon: Wrench,
    tone: "bg-[#E5F1E8]",
  },
  {
    number: "05",
    name: "Industrie",
    eyebrow: "Fabrication utile",
    description:
      "Des chaînes de valeur et des objets conçus avec plus de soin, de matière et de responsabilité.",
    icon: PackageOpen,
    tone: "bg-[#F3E4B8]",
  },
  {
    number: "06",
    name: "Open source",
    eyebrow: "Bien commun",
    description:
      "Des fondations publiques qui rendent les idées plus vérifiables, réutilisables et durables.",
    icon: Binary,
    tone: "bg-[#E2D5EF]",
  },
];

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand-mark ${compact ? "brand-mark--compact" : ""}`} aria-label="cyberPink">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={PI_MARK} alt="Symbole π humanisé de cyberPink" />
      {!compact && (
        <div className="brand-word" aria-hidden="true">
          <span>CYBER</span>
          <span className="brand-pi">
            π<i>pi</i>
          </span>
          <span>NK</span>
        </div>
      )}
    </div>
  );
}

function SectionEyebrow({
  children,
  light = false,
}: {
  children: React.ReactNode;
  light?: boolean;
}) {
  return (
    <p className={`section-eyebrow ${light ? "section-eyebrow--light" : ""}`}>
      <span />
      {children}
    </p>
  );
}

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [opinion, setOpinion] = useState("");
  const [opinionStatus, setOpinionStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [opinionError, setOpinionError] = useState("");

  useEffect(() => {
    const updateHeader = () => setScrolled(window.scrollY > 24);
    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });
    return () => window.removeEventListener("scroll", updateHeader);
  }, []);

  const closeMenu = () => setMenuOpen(false);

  async function submitOpinion(e: React.FormEvent) {
    e.preventDefault();
    if (!opinion.trim()) return;
    setOpinionStatus("loading");
    setOpinionError("");
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: "opinion",
          content: opinion.trim(),
          visibility: "public",
          anonymous: true,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors de l'envoi");
      }
      setOpinionStatus("success");
      setOpinion("");
      setTimeout(() => setOpinionStatus("idle"), 3000);
    } catch (err) {
      setOpinionStatus("error");
      setOpinionError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  }

  return (
    <main className="site-shell">
      <header className={`site-header ${scrolled ? "site-header--scrolled" : ""}`}>
        <a className="header-brand" href="#top" onClick={closeMenu}>
          <BrandMark />
        </a>

        <nav className={`site-nav ${menuOpen ? "site-nav--open" : ""}`} aria-label="Navigation principale">
          <a href="#ecosystem" onClick={closeMenu}>
            Écosystème
          </a>
          <a href="#method" onClick={closeMenu}>
            Méthode
          </a>
          <a href="#open" onClick={closeMenu}>
            Open source
          </a>
          <Link href="/auth/login" onClick={closeMenu}>
            Connexion
          </Link>
          <Link href="/auth/login?next=/produits" onClick={closeMenu}>
            Découvrez cyberPink
          </Link>
          <Link href="/auth/login?next=/produits#commentaires" onClick={closeMenu}>
            Donner mon opinion
          </Link>
          <Link href="/auth/login?next=/dons" className="nav-cta" onClick={closeMenu}>
            Faire un don <ArrowUpRight size={15} strokeWidth={2.2} />
          </Link>
        </nav>

        <button
          className="menu-toggle"
          type="button"
          aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      <section className="hero" id="top">
        <div className="hero-orbit hero-orbit--one" />
        <div className="hero-orbit hero-orbit--two" />
        <div className="hero-content">
          <div className="hero-intro reveal">
            <SectionEyebrow light>Maison mère multidisciplinaire</SectionEyebrow>
            <h1>
              Des branches
              <br />
              indépendantes.
              <br />
              <em>Une même</em> impulsion
              <br />
              humaine.
            </h1>
            <p>
              cyberPink imagine, construit et relie des initiatives dans les domaines où la
              technologie devient réellement utile.
            </p>
            <a className="circle-link" href="#ecosystem">
              <ArrowDown size={19} strokeWidth={2.2} />
              <span>
                Explorer
                <br />
                l&apos;écosystème
              </span>
            </a>
          </div>

          <div className="hero-art reveal reveal--late" aria-label="Vision cyberPink">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/cyberpink-hero-ecosystem.png"
              alt="Vision multidisciplinaire et humaine de cyberPink"
            />
            <div className="hero-art-caption">
              <span className="caption-index">∞</span>
              <span>Le progrès est un écosystème vivant.</span>
            </div>
          </div>
        </div>
        <div className="hero-bottomline">
          <span>CYBERπNK / 01</span>
          <span>Pas un secteur. Une constellation.</span>
          <ChevronDown size={18} aria-hidden="true" />
        </div>
      </section>

      <section className="statement" id="about">
        <div className="section-rail">
          <span>01</span>
          <i />
        </div>
        <div className="statement-copy reveal">
          <SectionEyebrow>La maison mère</SectionEyebrow>
          <h2>
            Une structure légère
            <br />
            pour des idées
            <br />
            <em>lourdes de sens.</em>
          </h2>
          <p>
            cyberPink n&apos;est pas une collection de produits empilés. C&apos;est une impulsion :
            imaginer des outils, des apprentissages et des objets qui augmentent la capacité
            d&apos;agir — sans remplacer le jugement humain.
          </p>
        </div>
        <div className="statement-aside reveal reveal--late">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/cyberpink-device-industry.png"
            alt="Objets et dispositifs liés à l'industrie et aux appareils"
          />
          <p>
            Des branches indépendantes, une même exigence : utilité, clarté, responsabilité.
          </p>
        </div>
      </section>

      <section className="ecosystem" id="ecosystem">
        <div className="ecosystem-heading reveal">
          <SectionEyebrow>Écosystème</SectionEyebrow>
          <h2>
            Six domaines.
            <br />
            Une constellation.
          </h2>
        </div>
        <div className="domain-grid">
          {domains.map((d) => {
            const Icon = d.icon;
            return (
              <article key={d.number} className={`domain-card reveal ${d.tone}`}>
                <div className="domain-top">
                  <span>{d.number}</span>
                  <Icon size={20} strokeWidth={1.8} />
                </div>
                <h3>{d.name}</h3>
                <p className="domain-eyebrow">{d.eyebrow}</p>
                <p>{d.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="method" id="method">
        <div className="section-rail">
          <span>03</span>
          <i />
        </div>
        <div className="method-copy reveal">
          <SectionEyebrow>Méthode</SectionEyebrow>
          <h2>
            Observer.
            <br />
            Prototyper.
            <br />
            Faire circuler.
          </h2>
        </div>
        <div className="method-steps reveal reveal--late">
          <div>
            <span>01</span>
            <p>
              <strong>Observer.</strong> Partir du terrain, des contraintes réelles et des
              personnes concernées.
            </p>
          </div>
          <div>
            <span>02</span>
            <p>
              <strong>Prototyper.</strong> Tester vite, documenter, ajuster avant d&apos;élargir.
            </p>
          </div>
          <div>
            <span>03</span>
            <p>
              <strong>Faire circuler.</strong> Les apprentissages, les outils et les réseaux
              deviennent plus grands lorsqu&apos;ils sont partagés.
            </p>
          </div>
        </div>
      </section>

      <section className="lab-strip">
        <div className="lab-copy reveal">
          <span className="lab-kicker">
            <Sparkles size={15} /> Recherche appliquée
          </span>
          <h2>
            Faire converser la science,
            <br />
            la machine et la main.
          </h2>
        </div>
        <div className="lab-visual reveal reveal--late">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/cyberpink-health-learning.png"
            alt="Objets évoquant la santé et l'apprentissage dans l'univers cyberPink"
          />
        </div>
      </section>

      <section className="open-source" id="open">
        <div className="open-art" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/cyberpink-open-source-network.png" alt="" />
        </div>
        <div className="section-rail section-rail--light">
          <span>04</span>
          <i />
        </div>
        <div className="open-copy reveal">
          <SectionEyebrow light>La part ouverte</SectionEyebrow>
          <h2>
            Ce qui avance
            <br />
            vraiment se <em>partage.</em>
          </h2>
          <p>
            L&apos;open source n&apos;est pas une vitrine. C&apos;est une manière de rendre une idée
            plus solide : documentée, critiquable, transmissible et disponible pour celles et ceux
            qui voudront l&apos;emmener ailleurs.
          </p>
          <a className="text-link" href="#contact">
            Voir ce que nous voulons ouvrir <ArrowUpRight size={18} />
          </a>
        </div>
      </section>

      {/* CONTACT — textes modifiés selon la demande */}
      <section className="contact" id="contact">
        <div className="contact-mark">
          <BrandMark compact />
        </div>
        <div className="contact-copy reveal">
          <SectionEyebrow>Une idée qui cherche son foyer ?</SectionEyebrow>
          <h2>
            La prochaine branche
            <br />
            pourrait partir d&apos;ici.
          </h2>
          <p>
            Partenariats, recherche, projets à lancer ou conversation sur un problème encore mal
            posé : découvrez un moyen fiable de vous adresser à CyberPink.
          </p>
          <div style={{ marginTop: 28 }}>
            <Link href="/auth/login?next=/produits" className="nav-cta" style={{ display: "inline-flex" }}>
              Découvrez cyberPink <ArrowUpRight size={15} strokeWidth={2.2} />
            </Link>
          </div>
        </div>
        <div className="contact-utility reveal reveal--late">
          <span>CYBERπNK</span>
          <span>cyberpink / Niger au delà de vos attentes</span>
          <span>2026</span>
        </div>
      </section>

      <footer className="site-footer">
        <div>
          <BrandMark />
          <span>© 2026 cyberPink</span>
        </div>

        {/* Opinion anonyme — stockée en DB, affichée en commentaires publics */}
        <form
          onSubmit={submitOpinion}
          style={{
            width: "100%",
            maxWidth: 420,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            margin: "12px 0",
          }}
        >
          <textarea
            value={opinion}
            onChange={(e) => setOpinion(e.target.value)}
            placeholder="c'est mon opinion"
            rows={3}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.06)",
              color: "var(--paper)",
              fontFamily: "inherit",
              fontSize: 14,
              resize: "vertical",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button
              type="submit"
              disabled={opinionStatus === "loading"}
              className="nav-cta"
              style={{ cursor: "pointer", border: "none" }}
            >
              {opinionStatus === "loading" ? "Envoi..." : "Publier mon opinion"}
            </button>
            {opinionStatus === "success" && (
              <span style={{ color: "#8fdfb0", fontSize: 13 }}>Opinion publiée ✓</span>
            )}
            {opinionStatus === "error" && (
              <span style={{ color: "var(--pink)", fontSize: 13 }}>{opinionError}</span>
            )}
          </div>
        </form>

        <p>Human ideas, infinite branches.</p>
        <a href="#top">
          Retour en haut <ArrowUpRight size={15} />
        </a>
      </footer>
    </main>
  );
}
