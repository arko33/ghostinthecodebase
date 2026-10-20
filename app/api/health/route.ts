import { NextResponse } from "next/server";

// Runtime probe for the app under observation. The metrics runner polls this
// endpoint, so the numbers have to come from the process itself, not from a
// guess. CPU is the delta of process.cpuUsage() between two probes, which is
// why the previous reading is kept in module scope (one value per instance).
export const dynamic = "force-dynamic";

let previousCpu = process.cpuUsage();
let previousAt = Date.now();

export async function GET() {
  const now = Date.now();
  const usage = process.cpuUsage(previousCpu);
  const elapsedMs = Math.max(1, now - previousAt);
  const cpuMs = (usage.user + usage.system) / 1000;
  const cpuPct = Math.min(100, Math.max(0, Math.round((cpuMs / elapsedMs) * 100)));

  previousCpu = process.cpuUsage();
  previousAt = now;

  const mem = process.memoryUsage();

  return NextResponse.json({
    ok: true,
    cpuPct,
    rssMb: Math.round(mem.rss / 1048576),
    heapUsedMb: Math.round(mem.heapUsed / 1048576),
    heapTotalMb: Math.round(mem.heapTotal / 1048576),
    uptimeSec: Math.round(process.uptime()),
    ts: new Date(now).toISOString(),
  });
}
