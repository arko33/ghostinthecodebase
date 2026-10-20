import { NextResponse } from "next/server";
import { demoSession } from "@/src/data/fixture";
import { runAutopsy } from "@/src/autopsy/engine";

// Runs the autopsy engine against the recorded demo session so the detectors
// can be inspected without the dashboard. Useful as a smoke test: the demo
// session must always produce a leak blamed on the turn that added the cache.
export const dynamic = "force-dynamic";

export async function GET() {
  const result = runAutopsy(demoSession);
  return NextResponse.json({
    sessionId: demoSession.id,
    anomalies: result.anomalies,
    autopsies: result.autopsies,
  });
}
