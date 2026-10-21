// GET /api/auth/logout — clear the web session and go home.
import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/src/lib/auth";
import { originFrom } from "@/src/lib/origin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(`${originFrom(req)}/`);
  clearSessionCookie(res);
  return res;
}
