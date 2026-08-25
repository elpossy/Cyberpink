"use client";

import { useState } from "react";

export default function ContactPage() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    const form = e.currentTarget;
    const data = {
      name: (form.elements.namedItem("name") as HTMLInputElement).value,
      email: (form.elements.namedItem("email") as HTMLInputElement).value,
      phone: (form.elements.namedItem("phone") as HTMLInputElement).value,
      subject: (form.elements.namedItem("subject") as HTMLInputElement).value,
      message: (form.elements.namedItem("message") as HTMLTextAreaElement).value,
    };

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Erreur lors de l'envoi");
      }

      setStatus("success");
      form.reset();
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Erreur inconnue");
    }
  }

  return (
    <>
      <section className="hero" style={{ padding: "64px 0 48px" }}>
        <div className="wrap">
          <span className="eyebrow">Nous joindre</span>
          <h1 style={{ fontSize: "clamp(30px, 4.4vw, 44px)" }}>Contactez cyberPink</h1>
          <p className="lead">
            Une question, une suggestion, un partenariat ? Écrivez-nous. Nous lisons chaque message.
          </p>
        </div>
      </section>

      <section>
        <div className="wrap grid-2">
          <div>
            <span className="eyebrow">Formulaire</span>
            <h2 style={{ marginTop: 14, fontSize: 22 }}>Envoyer un message</h2>

            {status === "success" ? (
              <div className="notice" style={{ marginTop: 20, borderLeftColor: "#1a7a4c" }}>
                <p style={{ margin: 0, color: "#1a7a4c" }}>
                  Message envoyé avec succès. Nous vous répondrons dès que possible.
                </p>
              </div>
            ) : (
              <form className="contact-form" onSubmit={handleSubmit} style={{ marginTop: 20 }}>
                <div className="field">
                  <label htmlFor="name">Nom complet</label>
                  <input type="text" id="name" name="name" required />
                </div>
                <div className="field">
                  <label htmlFor="email">Adresse e-mail</label>
                  <input type="email" id="email" name="email" required />
                </div>
                <div className="field">
                  <label htmlFor="phone">Téléphone (optionnel)</label>
                  <input type="tel" id="phone" name="phone" placeholder="+227 __ __ __ __" />
                </div>
                <div className="field">
                  <label htmlFor="subject">Sujet</label>
                  <input
                    type="text"
                    id="subject"
                    name="subject"
                    placeholder="Ex : Suggestion pour Elyon"
                  />
                </div>
                <div className="field">
                  <label htmlFor="message">Message</label>
                  <textarea id="message" name="message" required />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={status === "loading"}
                  style={{ border: "none", cursor: "pointer", width: "fit-content" }}
                >
                  {status === "loading" ? "Envoi..." : "Envoyer le message"}
                </button>
                {status === "error" && (
                  <p style={{ color: "var(--pink)", fontSize: 14, marginTop: 12 }}>{errorMsg}</p>
                )}
              </form>
            )}
          </div>

          <div>
            <span className="eyebrow">Coordonnées</span>
            <h2 style={{ marginTop: 14, fontSize: 22 }}>Autres moyens de nous joindre</h2>
            <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 22 }}>
              <div className="stat">
                <div className="label">E-mail</div>
                <div className="num" style={{ fontSize: 20 }}>
                  contact@cyberpink.com
                </div>
              </div>
              <div className="stat">
                <div className="label">Localisation</div>
                <div className="num" style={{ fontSize: 20 }}>
                  Niamey, Niger
                </div>
              </div>
              <div className="stat">
                <div className="label">Filiales</div>
                <div className="num" style={{ fontSize: 20 }}>
                  Antigramme · Elyon · Damundjé
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
