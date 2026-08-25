"use client";

import { useState } from "react";
import { commentSubjects, type CommentSubject } from "@/lib/products";
import Link from "next/link";

interface CommentFormProps {
  defaultSubject?: CommentSubject;
  lockedSubject?: boolean;
  /** Si true, on affiche un message invitant à se connecter */
  requireAuth?: boolean;
  isAuthenticated?: boolean;
}

export function CommentForm({
  defaultSubject = "recommandation",
  lockedSubject = false,
  requireAuth = true,
  isAuthenticated = false,
}: CommentFormProps) {
  const [subject, setSubject] = useState<CommentSubject>(defaultSubject);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;

    if (requireAuth && !isAuthenticated) {
      setStatus("error");
      setErrorMsg("Vous devez être connecté pour publier un commentaire.");
      return;
    }

    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, visibility, content: content.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors de l'envoi");
      }

      setStatus("success");
      setContent("");
      // Soft refresh of comments list could be added via router.refresh()
      setTimeout(() => setStatus("idle"), 2500);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Erreur inconnue");
    }
  }

  if (requireAuth && !isAuthenticated) {
    return (
      <div className="notice" style={{ marginTop: 8 }}>
        <p style={{ margin: 0 }}>
          Connectez-vous pour publier un commentaire et participer à la conversation.{" "}
          <Link href="/auth/login" style={{ color: "var(--pink)", textDecoration: "underline" }}>
            Se connecter
          </Link>{" "}
          ou{" "}
          <Link href="/auth/register" style={{ color: "var(--pink)", textDecoration: "underline" }}>
            créer un compte
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="contact-form" style={{ marginTop: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="field">
          <label htmlFor="subject">Sujet</label>
          <select
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value as CommentSubject)}
            disabled={lockedSubject}
          >
            {commentSubjects.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="visibility">Visibilité</label>
          <select
            id="visibility"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as "public" | "private")}
          >
            <option value="public">Public — visible par tous</option>
            <option value="private">Privé — uniquement l&apos;administration</option>
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="content">Votre commentaire</label>
        <textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Partagez une recommandation, une idée, un retour..."
          required
          rows={4}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={status === "loading"}
          style={{ border: "none", cursor: "pointer" }}
        >
          {status === "loading" ? "Envoi..." : "Publier le commentaire"}
        </button>
        {status === "success" && (
          <span style={{ color: "#1a7a4c", fontSize: 14 }}>Commentaire publié ✓</span>
        )}
        {status === "error" && (
          <span style={{ color: "var(--pink)", fontSize: 14 }}>{errorMsg}</span>
        )}
      </div>
    </form>
  );
}
