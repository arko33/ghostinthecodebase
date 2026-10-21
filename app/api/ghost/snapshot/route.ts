// Loopback bridge to the local Ghost recorder (packages/ghost ghost watch).
// Works only while the dashboard runs on the same machine (`npm run dev`):
// the recorder serves the live session JSON on 127.0.0.1:<port>/session.
// On a hosted deployment this responds as "recorder: not reachable".
import { NextResponse } from "next/server";

const RECORDER =
  process.env.GHOST_RECORDER_URL ?? "http://127.0.0.1:5417";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await fetch(`${RECORDER}/session`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(1500),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`recorder ${res.status}`);
    const session = await res.json();
    return NextResponse.json(
      { recorder: true, session },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { recorder: false, reason: "no local ghost watch is running on this machine" },
      { headers: { "cache-control": "no-store" } },
    );
  }
}
