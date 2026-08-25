import { NextRequest, NextResponse } from "next/server";
import { dbRun } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, product } = body || {};

    if (!message?.trim()) {
      return NextResponse.json(
        { error: "Le message est obligatoire." },
        { status: 400 }
      );
    }

    const user = await getSessionUser();
    const result = await dbRun(
      `INSERT INTO donations (user_id, product, message) VALUES (?, ?, ?)`,
      [user?.id ?? null, product || null, message.trim()]
    );

    return NextResponse.json(
      { success: true, id: result.lastInsertRowid },
      { status: 201 }
    );
  } catch (err) {
    console.error("Dons error:", err);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
