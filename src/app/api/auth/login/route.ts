import { NextRequest, NextResponse } from "next/server";
import { dbGet } from "@/lib/db";
import { setSession } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body || {};

    if (!email?.trim() || !password) {
      return NextResponse.json(
        { error: "E-mail et mot de passe requis." },
        { status: 400 }
      );
    }

    const user = await dbGet<{ id: number; password_hash: string }>(
      "SELECT id, password_hash FROM users WHERE email = ?",
      [email.trim().toLowerCase()]
    );

    if (!user) {
      return NextResponse.json({ error: "Identifiants incorrects." }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: "Identifiants incorrects." }, { status: 401 });
    }

    await setSession(user.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
