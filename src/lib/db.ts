import { createClient, type Client, type ResultSet } from "@libsql/client";

/**
 * Client Turso / libSQL
 *
 * - Prod (Vercel) : TURSO_DATABASE_URL + TURSO_AUTH_TOKEN
 * - Local sans env  : file:cyberpink.db
 *
 * À la première requête API, ensureDb() crée tables + index.
 *
 * Note RLS : Turso = SQLite/libSQL → pas de Row Level Security
 * style PostgreSQL. La sécurité se fait :
 *   1. côté API (session, rôles, filtres visibility)
 *   2. côté Turso (tokens avec droits limités si besoin)
 */

let client: Client | null = null;
let schemaReady: Promise<void> | null = null;

export function getClient(): Client {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL?.trim();
    const authToken = process.env.TURSO_AUTH_TOKEN?.trim();

    if (url) {
      client = createClient({
        url,
        authToken: authToken || undefined,
      });
    } else {
      client = createClient({ url: "file:cyberpink.db" });
    }
  }
  return client;
}

/** Toutes les migrations SQL (idempotentes). */
const MIGRATIONS: string[] = [
  // --- meta versioning ---
  `CREATE TABLE IF NOT EXISTS _migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    applied_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,

  // --- users ---
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
  `CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone)`,

  // --- comments ---
  `CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    author_name TEXT,
    subject TEXT NOT NULL,
    content TEXT NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
    parent_id INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_comments_subject ON comments(subject)`,
  `CREATE INDEX IF NOT EXISTS idx_comments_visibility ON comments(visibility)`,
  `CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id)`,
  `CREATE INDEX IF NOT EXISTS idx_comments_created ON comments(created_at DESC)`,

  // --- contacts ---
  `CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    subject TEXT,
    message TEXT NOT NULL,
    source TEXT DEFAULT 'site-cyberpink',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_contacts_created ON contacts(created_at DESC)`,

  // --- donations ---
  `CREATE TABLE IF NOT EXISTS donations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    product TEXT,
    message TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_donations_user ON donations(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_donations_created ON donations(created_at DESC)`,
];

async function initSchema(db: Client) {
  // Active les foreign keys (SQLite/libSQL)
  try {
    await db.execute("PRAGMA foreign_keys = ON");
  } catch {
    // certains endpoints Turso distants ignorent PRAGMA — ok
  }

  // Exécute chaque statement séparément (plus fiable que batch sur Turso distant)
  for (const sql of MIGRATIONS) {
    try {
      await db.execute(sql);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Ignore "already exists" / duplicate column
      if (
        msg.includes("already exists") ||
        msg.includes("duplicate column") ||
        msg.includes("UNIQUE constraint failed")
      ) {
        continue;
      }
      console.error("[db] migration error:", msg, "\nSQL:", sql.slice(0, 120));
      throw err;
    }
  }

  // Marqueur : schéma appliqué
  try {
    await db.execute({
      sql: `INSERT OR IGNORE INTO _migrations (name) VALUES (?)`,
      args: ["v1_core_schema"],
    });
  } catch {
    // table _migrations peut ne pas encore être lisible — non bloquant
  }
}

/**
 * Garantit tables + index.
 * Appelé automatiquement par dbAll / dbGet / dbRun au premier hit.
 */
export async function ensureDb(): Promise<Client> {
  const db = getClient();
  if (!schemaReady) {
    schemaReady = initSchema(db).catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  await schemaReady;
  return db;
}

export async function dbAll<T = Record<string, unknown>>(
  sql: string,
  args: (string | number | null | boolean | undefined)[] = []
): Promise<T[]> {
  const db = await ensureDb();
  const result = await db.execute({
    sql,
    args: args.map((a) => (a === undefined ? null : a)),
  });
  return result.rows as unknown as T[];
}

export async function dbGet<T = Record<string, unknown>>(
  sql: string,
  args: (string | number | null | boolean | undefined)[] = []
): Promise<T | null> {
  const rows = await dbAll<T>(sql, args);
  return rows[0] ?? null;
}

export async function dbRun(
  sql: string,
  args: (string | number | null | boolean | undefined)[] = []
): Promise<{ lastInsertRowid: number; rowsAffected: number }> {
  const db = await ensureDb();
  const result: ResultSet = await db.execute({
    sql,
    args: args.map((a) => (a === undefined ? null : a)),
  });
  return {
    lastInsertRowid: Number(result.lastInsertRowid ?? 0),
    rowsAffected: result.rowsAffected ?? 0,
  };
}
