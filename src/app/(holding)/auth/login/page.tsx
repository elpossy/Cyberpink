"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    const form = e.currentTarget;
    const data = {
      email: (form.elements.namedItem("email") as HTMLInputElement).value,
      password: (form.elements.namedItem("password") as HTMLInputElement).value,
    };

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Identifiants incorrects");

      router.push("/");
      router.refresh();
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Erreur inconnue");
    }
  }

  return (
    <section style={{ padding: "64px 0" }}>
      <div className="wrap" style={{ maxWidth: 440 }}>
        <span className="eyebrow">Compte</span>
        <h1 style={{ fontSize: 32, marginTop: 12 }}>Connexion</h1>
        <p style={{ color: "var(--slate)", marginTop: 10, marginBottom: 28 }}>
          Connectez-vous avec votre e-mail et votre mot de passe.
        </p>

        {registered && (
          <div className="notice" style={{ marginBottom: 24, borderLeftColor: "#1a7a4c" }}>
            <p style={{ margin: 0, color: "#1a7a4c" }}>
              Compte créé avec succès. Vous pouvez maintenant vous connecter.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Adresse e-mail</label>
            <input type="email" id="email" name="email" required />
          </div>
          <div className="field">
            <label htmlFor="password">Mot de passe</label>
            <input type="password" id="password" name="password" required />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={status === "loading"}
            style={{ border: "none", cursor: "pointer", width: "100%", marginTop: 8 }}
          >
            {status === "loading" ? "Connexion..." : "Se connecter"}
          </button>

          {status === "error" && (
            <p style={{ color: "var(--pink)", fontSize: 14, marginTop: 14 }}>{errorMsg}</p>
          )}
        </form>

        <p style={{ marginTop: 24, fontSize: 14, color: "var(--slate)" }}>
          Pas encore de compte ?{" "}
          <Link href="/auth/register" style={{ color: "var(--pink)", textDecoration: "underline" }}>
            S&apos;inscrire
          </Link>
        </p>
      </div>
    </section>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="wrap" style={{ padding: 48 }}>Chargement...</div>}>
      <LoginForm />
    </Suspense>
  );
}
