"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { DonateButton } from "@/components/DonateButton";

function DonsContent() {
  const searchParams = useSearchParams();
  const prefilledMessage =
    searchParams.get("message") ||
    "Je contribue au développement de ma nation en investissant dans cyberPink.";
  const product = searchParams.get("product") || "";

  const [message, setMessage] = useState(prefilledMessage);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/dons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim(), product: product || null }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors de l'envoi");
      }

      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Erreur inconnue");
    }
  }

  return (
    <>
      <section className="hero" style={{ padding: "64px 0 48px" }}>
        <div className="wrap">
          <span className="eyebrow">Soutenir cyberPink</span>
          <h1 style={{ fontSize: "clamp(30px, 4.4vw, 44px)" }}>
            Contribuez au développement de la nation.
          </h1>
          <p className="lead">
            Vos dons financent le développement des produits, l&apos;équipe locale et
            l&apos;infrastructure. Chaque contribution compte.
          </p>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow">Comment faire un don</span>
            <h2 style={{ marginTop: 14 }}>Envoyez ou déposez de l&apos;argent</h2>
            <p>
              Transférez ou déposez sur le numéro ci-dessous via les opérateurs listés. L&apos;envoi
              d&apos;argent <strong>et</strong> le dépôt d&apos;argent sont tous deux acceptés.
              Ensuite, envoyez-nous le reçu et un petit mot.
            </p>
          </div>

          <div
            className="donate-box"
            style={{ maxWidth: 480, marginBottom: 32 }}
          >
            <span className="op">Numéro unique</span>
            <h3>Mobile Money</h3>
            <div className="num">+227 86 06 90 20</div>
            <p>
              Via <strong>MyNita</strong>, <strong>Amanata</strong>, <strong>Wave</strong> et{" "}
              <strong>Airtel Money</strong>
            </p>
          </div>

          <div className="notice" style={{ marginBottom: 36 }}>
            Après votre transfert ou dépôt, merci d&apos;envoyer le reçu (capture d&apos;écran ou
            photo) à{" "}
            <a href="mailto:contact@cyberpink.com" style={{ color: "var(--pink)", textDecoration: "underline" }}>
              contact@cyberpink.com
            </a>{" "}
            ou via le formulaire ci-dessous pour que nous puissions vous remercier.
          </div>

          <div className="section-head">
            <span className="eyebrow">Confirmation</span>
            <h2 style={{ marginTop: 14, fontSize: 22 }}>Dites-nous pourquoi</h2>
          </div>

          {status === "success" ? (
            <div className="notice" style={{ borderLeftColor: "#1a7a4c" }}>
              <p style={{ margin: 0, color: "#1a7a4c" }}>
                Merci infiniment pour votre contribution et votre message. Nous avons bien reçu
                votre intention de don. N&apos;oubliez pas d&apos;envoyer le reçu !
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ maxWidth: 560 }}>
              <div className="field">
                <label htmlFor="message">Votre message</label>
                <textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Dites-vous pourquoi vous avez décidé de nous secourir !"
                  required
                  rows={4}
                />
              </div>
              {product && (
                <p style={{ fontSize: 13, color: "var(--slate)", marginBottom: 16 }}>
                  Contexte produit : <strong>{product}</strong>
                </p>
              )}
              <button
                type="submit"
                className="btn btn-primary"
                disabled={status === "loading"}
                style={{ border: "none", cursor: "pointer" }}
              >
                {status === "loading" ? "Envoi..." : "Envoyer mon message"}
              </button>
              {status === "error" && (
                <p style={{ color: "var(--pink)", fontSize: 14, marginTop: 12 }}>{errorMsg}</p>
              )}
            </form>
          )}
        </div>
      </section>

      <hr className="divider" />

      <section>
        <div className="section-head wrap">
          <span className="eyebrow">Pourquoi donner</span>
          <h2 style={{ marginTop: 14 }}>À quoi servent vos contributions</h2>
        </div>
        <div className="wrap grid-3" style={{ padding: 0 }}>
          <div className="card">
            <span className="reg-code">01</span>
            <h3 style={{ fontSize: 17 }}>Développement produit</h3>
            <p>
              Financer les mises à jour et nouvelles fonctionnalités d&apos;Antigramme, Elyon et
              Damundjé.
            </p>
          </div>
          <div className="card">
            <span className="reg-code">02</span>
            <h3 style={{ fontSize: 17 }}>Équipe locale</h3>
            <p>Soutenir les développeurs et l&apos;équipe nigérienne derrière cyberPink.</p>
          </div>
          <div className="card">
            <span className="reg-code">03</span>
            <h3 style={{ fontSize: 17 }}>Infrastructure</h3>
            <p>
              Couvrir les coûts techniques : hébergement, sécurité et outils de développement.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

export default function DonsPage() {
  return (
    <Suspense fallback={<div className="wrap" style={{ padding: 48 }}>Chargement...</div>}>
      <DonsContent />
    </Suspense>
  );
}
