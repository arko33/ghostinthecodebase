// Ghost Cloud — Neon PostgreSQL access.
// Pooled singleton (survives Next.js route hot-reload in dev). node-postgres
// does not honor `channel_binding` in the DSN, so it is stripped defensively.
import { Pool, type QueryResultRow } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __ghostPool: Pool | undefined;
}

function sanitizeUrl(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  const [base, qs] = raw.split("?");
  if (!qs) return raw;
  const keep = qs.split("&").filter((p) => !p.startsWith("channel_binding="));
  return keep.length ? `${base}?${keep.join("&")}` : base;
}

function createPool(): Pool {
  const url = sanitizeUrl(process.env.DATABASE_URL);
  if (!url) throw new Error("DATABASE_URL is not configured");
  const needsSsl = /sslmode=require|neon\.tech/.test(url);
  return new Pool({
    connectionString: url,
    max: 5,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  });
}

const pool: Pool = globalThis.__ghostPool ?? (globalThis.__ghostPool = createPool());

export function q<T extends QueryResultRow = any>(text: string, params?: unknown[]) {
  return pool.query<T>(text, params as unknown[]);
}

export type UserRow = { id: string; github_id: string; login: string; name: string | null; avatar_url: string | null };
