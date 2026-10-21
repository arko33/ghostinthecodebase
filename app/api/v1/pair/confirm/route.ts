// POST /api/v1/pair/confirm — the human confirms a pairing code in the browser.
// Requires the web session cookie (GitHub OAuth). Issues a device token:
// raw token lives only in the pending pairing row for the CLI to pick up;
// devices stores just its sha256.
import { NextRequest, NextResponse } from "next/server";
import { userFromRequest, newDeviceToken, deviceTokenHash } from "@/src/lib/auth";
import { q } from "@/src/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = userFromRequest(req);
  if (!user) return NextResponse.json({ error: "sign in first" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const code = typeof body.code === "string" ? body.code : "";
  if (!code) return NextResponse.json({ error: "missing code" }, { status: 400 });

  const { rows } = await q(
    `SELECT user_id, raw_token, bound_at, expires_at FROM pairing_codes WHERE code = $1 LIMIT 1`,
    [code],
  );
  if (!rows.length) return NextResponse.json({ error: "code not found" }, { status: 404 });
  const row = rows[0];
  if (row.user_id || row.raw_token) {
    return NextResponse.json({ error: "code already bound" }, { status: 409 });
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "code expired" }, { status: 410 });
  }

  const token = newDeviceToken();
  await q(`INSERT INTO devices (user_id, name, token_hash) VALUES ($1, $2, $3)`, [
    user.uid,
    `cli@${user.login}`,
    deviceTokenHash(token),
  ]);
  await q(
    `UPDATE pairing_codes SET user_id = $1, raw_token = $2, bound_at = now() WHERE code = $3`,
    [user.uid, token, code],
  );
  return NextResponse.json({ ok: true });
}
