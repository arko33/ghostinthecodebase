// GET /api/auth/github — kick off GitHub OAuth web sign-in.
// Optional ?next=/pair?code=… so the browser lands back on the pairing page
// after login (device-code binding stays out of OAuth — CLI never logs in).
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { setOAuthState } from "@/src/lib/auth";
import { originFrom } from "@/src/lib/origin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) return new NextResponse("GitHub OAuth not configured (GITHUB_CLIENT_ID)", { status: 500 });

  const url = new URL(req.url);
  const next = (url.searchParams.get("next") ?? "/").toString();
  const state = crypto.randomBytes(12).toString("hex");

  const authUrl = new URL("https://github.com/login/oauth/authorize");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", `${originFrom(req)}/api/auth/github/callback`);
  authUrl.searchParams.set("scope", "read:user");
  authUrl.searchParams.set("state", state);

  const res = NextResponse.redirect(authUrl.toString());
  // `next` validated downstream (must start with "/" — never an absolute URL)
  setOAuthState(res, state, next.startsWith("/") ? next : "/");
  return res;
}
