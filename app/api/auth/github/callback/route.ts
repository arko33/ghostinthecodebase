// GET /api/auth/github/callback — exchange code, upsert user, set session.
import { NextRequest, NextResponse } from "next/server";
import { newSessionCookie, readOAuthState } from "@/src/lib/auth";
import { q, type UserRow } from "@/src/lib/db";
import { originFrom } from "@/src/lib/origin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const saved = readOAuthState(req);

  if (!code) return nextResponse(req, { error: "missing code" });
  if (!saved || saved.state !== state) return nextResponse(req, { error: "oauth state mismatch" });

  // token exchange
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${originFrom(req)}/api/auth/github/callback`,
    }),
  });
  const tokenJson = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (!tokenJson.access_token) return nextResponse(req, { error: tokenJson.error ?? "token exchange failed" });

  const ghRes = await fetch("https://api.github.com/user", {
    headers: { authorization: `Bearer ${tokenJson.access_token}`, accept: "application/vnd.github+json", "user-agent": "ghostinthecodebase" },
  });
  if (!ghRes.ok) return nextResponse(req, { error: `github profile fetch failed (${ghRes.status})` });
  const gh = (await ghRes.json()) as { id: number; login: string; name?: string; email?: string; avatar_url?: string };

  const { rows } = await q<UserRow & { name: string | null }>(
    `INSERT INTO users (github_id, login, name, email, avatar_url)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (github_id) DO UPDATE
       SET login = EXCLUDED.login, name = EXCLUDED.name, email = EXCLUDED.email, avatar_url = EXCLUDED.avatar_url
     RETURNING id, github_id, login, name, avatar_url`,
    [String(gh.id), gh.login, gh.name ?? null, gh.email ?? null, gh.avatar_url ?? null],
  );
  const user = rows[0];

  const res = NextResponse.redirect(`${originFrom(req)}${saved.next}`);
  newSessionCookie(res, { id: user.id, login: user.login });
  return res;
}

function nextResponse(req: NextRequest, { error }: { error: string }) {
  return NextResponse.redirect(`${originFrom(req)}/login?error=${encodeURIComponent(error)}`);
}
