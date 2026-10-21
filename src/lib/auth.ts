// Ghost Cloud — auth primitives.
// Web: HMAC-signed session cookie (GitHub OAuth identity).
// CLI: device bearer tokens — only sha256 hashes are ever stored.
import crypto from "node:crypto";
import type { NextRequest } from "next/server";

export const SESSION_COOKIE = "ghost_session";
export const OAUTH_STATE_COOKIE = "ghost_oauth";

type SessionData = { uid: string; login: string; exp: number };
type StateData = { state: string; next: string };

const b64u = (buf: Buffer | string) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64uJSON = (v: unknown) => b64u(JSON.stringify(v));
function fromB64u(s: string): unknown {
  return JSON.parse(Buffer.from(s, "base64").toString("utf8"));
}

function sign(payload: string): string {
  return b64u(crypto.createHmac("sha256", sessionSecret()).update(payload).digest());
}

function sessionSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not configured");
  return s;
}

function cookieBase(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
    secure: process.env.NODE_ENV === "production",
  };
}

export function newSessionCookie(res: import("next/server").NextResponse, user: { id: string; login: string }) {
  const data: SessionData = { uid: user.id, login: user.login, exp: Date.now() + 30 * 24 * 3600_000 };
  const value = `${b64uJSON(data)}.${sign(b64uJSON(data))}`;
  res.cookies.set(SESSION_COOKIE, value, cookieBase(30 * 24 * 3600));
}

export function clearSessionCookie(res: import("next/server").NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { ...cookieBase(0), maxAge: 0 });
}

export function sessionFrom(req: NextRequest): SessionData | null {
  const raw = req.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot < 1) return null;
  const payload = raw.slice(0, dot);
  const mac = raw.slice(dot + 1);
  try {
    if (mac !== sign(payload)) return null;
    const data = fromB64u(payload) as SessionData;
    if (!data?.uid || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export function setOAuthState(res: import("next/server").NextResponse, state: string, next: string) {
  const data: StateData = { state, next };
  const value = `${b64uJSON(data)}.${sign(b64uJSON(data))}`;
  res.cookies.set(OAUTH_STATE_COOKIE, value, cookieBase(600));
}

export function readOAuthState(req: NextRequest): StateData | null {
  const raw = req.cookies.get(OAUTH_STATE_COOKIE)?.value;
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot < 1) return null;
  const payload = raw.slice(0, dot);
  const mac = raw.slice(dot + 1);
  try {
    if (mac !== sign(payload)) return null;
    return fromB64u(payload) as StateData;
  } catch {
    return null;
  }
}

// ── device tokens ────────────────────────────────────────────────────────────
export function deviceTokenHash(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function newDeviceToken(): string {
  return `ght_${crypto.randomBytes(24).toString("hex")}`;
}

/** Bearer-token auth for CLI routes. Returns the owning user id, or null. */
export async function deviceFromRequest(req: NextRequest): Promise<{ userId: string; deviceId: string } | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  const { q } = await import("./db");
  const { rows } = await q(
    `SELECT id, user_id FROM devices WHERE token_hash = $1 AND revoked = false LIMIT 1`,
    [deviceTokenHash(token)],
  );
  if (!rows.length) return null;
  await q(`UPDATE devices SET last_seen_at = now() WHERE id = $1`, [rows[0].id]);
  return { userId: rows[0].user_id, deviceId: rows[0].id };
}

/** Web-cookie auth helper — returns the signed-in user or null. */
export function userFromRequest(req: NextRequest): { uid: string; login: string } | null {
  const s = sessionFrom(req);
  return s ? { uid: s.uid, login: s.login } : null;
}
