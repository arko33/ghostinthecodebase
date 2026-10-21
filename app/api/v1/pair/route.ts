// Device pairing — the CLI's only auth channel. No OAuth for agents, ever.
//   POST /api/v1/pair           → { code, expiresAt } (CLI prints the URL)
//   GET  /api/v1/pair?code=…    → { status: "pending" | "bound" | "expired" | "not_found" }
//                                 (once bound: { status:"bound", deviceToken })
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { q } from "@/src/lib/db";

export const runtime = "nodejs";

const WINDOW_MINUTES = 15;

const newCode = () => "ghost-" + crypto.randomBytes(4).toString("hex").toUpperCase();

export async function POST() {
  const code = newCode();
  const { rows } = await q(
    `INSERT INTO pairing_codes (code, expires_at) VALUES ($1, now() + interval '${WINDOW_MINUTES} minutes')
     RETURNING code, expires_at`,
    [code],
  );
  return NextResponse.json({ code: rows[0].code, expiresAt: rows[0].expires_at, windowMinutes: WINDOW_MINUTES });
}

export async function GET(req: NextRequest) {
  const code = new URL(req.url).searchParams.get("code");
  if (!code) return NextResponse.json({ error: "missing code" }, { status: 400 });

  const { rows } = await q(
    `SELECT user_id, raw_token, bound_at, expires_at FROM pairing_codes WHERE code = $1 LIMIT 1`,
    [code],
  );
  if (!rows.length) return NextResponse.json({ status: "not_found" }, { status: 404 });
  if (rows[0].bound_at) {
    return NextResponse.json({ status: "bound", deviceToken: rows[0].raw_token });
  }
  if (new Date(rows[0].expires_at).getTime() < Date.now()) {
    return NextResponse.json({ status: "expired" }, { status: 410 });
  }
  return NextResponse.json({ status: "pending", expiresAt: rows[0].expires_at });
}
