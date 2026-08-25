import { NextResponse } from "next/server";
import { ensureDb, dbAll } from "@/lib/db";

/**
 * GET /api/setup
 * Force la création des tables sur Turso et renvoie l'état.
 * Utile une fois après le déploiement pour vérifier la connexion.
 */
export async function GET() {
  try {
    await ensureDb();

    const tables = await dbAll<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
    );

    const hasTurso = Boolean(process.env.TURSO_DATABASE_URL?.trim());

    return NextResponse.json({
      ok: true,
      mode: hasTurso ? "turso" : "local-file",
      tables: tables.map((t) => t.name),
      message: hasTurso
        ? "Connecté à Turso — tables prêtes."
        : "Mode local (file:cyberpink.db) — tables prêtes. Ajoute TURSO_* pour la prod.",
    });
  } catch (err) {
    console.error("Setup error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Erreur inconnue",
        hint: "Vérifie TURSO_DATABASE_URL et TURSO_AUTH_TOKEN dans .env.local / Vercel.",
      },
      { status: 500 }
    );
  }
}
