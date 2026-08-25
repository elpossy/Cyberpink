import { cookies } from "next/headers";
import { dbGet } from "./db";

const SESSION_COOKIE = "cyberpink_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: string;
}

function createToken(userId: number): string {
  const payload = `${userId}:${Date.now()}`;
  const secret = process.env.AUTH_SECRET || "cyberpink-dev-secret-change-me";
  const sig = Buffer.from(`${payload}:${secret}`).toString("base64url");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

function parseToken(token: string): number | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(":");
    const userId = parseInt(parts[0], 10);
    if (!userId || parts.length < 3) return null;
    return userId;
  } catch {
    return null;
  }
}

export async function setSession(userId: number) {
  const token = createToken(userId);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const userId = parseToken(token);
  if (!userId) return null;

  const row = await dbGet<SessionUser>(
    "SELECT id, name, email, phone, role FROM users WHERE id = ?",
    [userId]
  );
  return row;
}
