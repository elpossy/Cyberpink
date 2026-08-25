import { NextRequest, NextResponse } from "next/server";
import { dbGet, dbRun } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, phone, password } = body || {};

    if (!name?.trim() || !email?.trim() || !phone?.trim() || !password) {
      return NextResponse.json(
        { error: "Nom, e-mail, téléphone et mot de passe sont obligatoires." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Le mot de passe doit contenir au moins 6 caractères." },
        { status: 400 }
      );
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      return NextResponse.json({ error: "Adresse e-mail invalide." }, { status: 400 });
    }

    const existing = await dbGet(
      "SELECT id FROM users WHERE email = ? OR phone = ?",
      [email.trim().toLowerCase(), phone.trim()]
    );

    if (existing) {
      return NextResponse.json(
        { error: "Un compte existe déjà avec cet e-mail ou ce numéro." },
        { status: 409 }
      );
    }

    const password_hash = await bcrypt.hash(password, 10);
    const result = await dbRun(
      `INSERT INTO users (name, email, phone, password_hash) VALUES (?, ?, ?, ?)`,
      [name.trim(), email.trim().toLowerCase(), phone.trim(), password_hash]
    );

    return NextResponse.json(
      { success: true, id: result.lastInsertRowid },
      { status: 201 }
    );
  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
