import { NextRequest, NextResponse } from "next/server";
import { dbAll, dbRun } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const subject = searchParams.get("subject");
    const visibility = searchParams.get("visibility") || "public";

    let rows: {
      id: number;
      subject: string;
      content: string;
      visibility: string;
      created_at: string;
      parent_id: number | null;
      author_name: string;
    }[];

    if (subject) {
      rows = await dbAll(
        `SELECT c.id, c.subject, c.content, c.visibility, c.created_at, c.parent_id,
                COALESCE(c.author_name, u.name, 'Anonyme') as author_name
         FROM comments c
         LEFT JOIN users u ON u.id = c.user_id
         WHERE c.visibility = ? AND c.subject = ? AND c.parent_id IS NULL
         ORDER BY c.created_at DESC
         LIMIT 50`,
        [visibility, subject]
      );
    } else {
      rows = await dbAll(
        `SELECT c.id, c.subject, c.content, c.visibility, c.created_at, c.parent_id,
                COALESCE(c.author_name, u.name, 'Anonyme') as author_name
         FROM comments c
         LEFT JOIN users u ON u.id = c.user_id
         WHERE c.visibility = ? AND c.parent_id IS NULL
         ORDER BY c.created_at DESC
         LIMIT 50`,
        [visibility]
      );
    }

    const comments = rows.map((r) => ({
      id: r.id,
      authorName: r.author_name,
      subject: r.subject,
      content: r.content,
      visibility: r.visibility,
      createdAt: r.created_at,
    }));

    return NextResponse.json(comments);
  } catch (err) {
    console.error("Comments GET error:", err);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    const body = await req.json();
    const {
      subject = "recommandation",
      content,
      visibility = "public",
      parent_id,
      anonymous = false,
    } = body || {};

    if (!content?.trim()) {
      return NextResponse.json(
        { error: "Le contenu est obligatoire." },
        { status: 400 }
      );
    }

    if (!anonymous && !user) {
      return NextResponse.json(
        { error: "Vous devez être connecté pour commenter." },
        { status: 401 }
      );
    }

    const allowedSubjects = [
      "recommandation",
      "generale",
      "cyberpink",
      "antigramme",
      "elyon",
      "damundje",
      "opinion",
    ];
    if (!allowedSubjects.includes(subject)) {
      return NextResponse.json({ error: "Sujet invalide." }, { status: 400 });
    }

    if (!["public", "private"].includes(visibility)) {
      return NextResponse.json({ error: "Visibilité invalide." }, { status: 400 });
    }

    const authorName = anonymous ? "Anonyme" : user?.name ?? "Anonyme";
    const userId = anonymous ? null : user?.id ?? null;

    const result = await dbRun(
      `INSERT INTO comments (user_id, author_name, subject, content, visibility, parent_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, authorName, subject, content.trim(), visibility, parent_id || null]
    );

    return NextResponse.json(
      { success: true, id: result.lastInsertRowid },
      { status: 201 }
    );
  } catch (err) {
    console.error("Comments POST error:", err);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
