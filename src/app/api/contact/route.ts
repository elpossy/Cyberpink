import { NextRequest, NextResponse } from "next/server";
import { dbRun } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, phone, subject, message } = body || {};

    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return NextResponse.json(
        { error: "Nom, e-mail et message sont obligatoires." },
        { status: 400 }
      );
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      return NextResponse.json({ error: "Adresse e-mail invalide." }, { status: 400 });
    }

    const result = await dbRun(
      `INSERT INTO contacts (name, email, phone, subject, message, source)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        name.trim(),
        email.trim(),
        (phone || "").trim() || null,
        (subject || "").trim() || null,
        message.trim(),
        "site-cyberpink",
      ]
    );

    return NextResponse.json(
      { success: true, id: result.lastInsertRowid },
      { status: 201 }
    );
  } catch (err) {
    console.error("Contact error:", err);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
