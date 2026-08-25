"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
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
      password: (form.elements.namedItem("password") as HTMLInputElement).value,
    };

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Erreur lors de l'inscription");

      router.push("/auth/login?registered=1");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Erreur inconnue");
    }
  }

  return (
    <section style={{ padding: "64px 0" }}>
      <div className="wrap" style={{ maxWidth: 440 }}>
        <span className="eyebrow">Compte</span>
        <h1 style={{ fontSize: 32, marginTop: 12 }}>Créer un compte</h1>
        <p style={{ color: "var(--slate)", marginTop: 10, marginBottom: 28 }}>
          Email, téléphone et mot de passe sont obligatoires. Pas d&apos;OTP pour le moment.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="name">Nom complet</label>
            <input type="text" id="name" name="name" required />
          </div>
          <div className="field">
            <label htmlFor="email">Adresse e-mail</label>
            <input type="email" id="email" name="email" required />
          </div>
          <div className="field">
            <label htmlFor="phone">Numéro de téléphone</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              placeholder="+227 __ __ __ __"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Mot de passe</label>
            <input type="password" id="password" name="password" minLength={6} required />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={status === "loading"}
            style={{ border: "none", cursor: "pointer", width: "100%", marginTop: 8 }}
          >
            {status === "loading" ? "Création..." : "S'inscrire"}
          </button>

          {status === "error" && (
            <p style={{ color: "var(--pink)", fontSize: 14, marginTop: 14 }}>{errorMsg}</p>
          )}
        </form>

        <p style={{ marginTop: 24, fontSize: 14, color: "var(--slate)" }}>
          Déjà un compte ?{" "}
          <Link href="/auth/login" style={{ color: "var(--pink)", textDecoration: "underline" }}>
            Se connecter
          </Link>
        </p>
      </div>
    </section>
  );
}
