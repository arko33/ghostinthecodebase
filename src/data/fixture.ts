import type { Session, MetricSample } from "@/src/types";

// A recorded agent session used to demo the CodeAutopsy timeline + the
// GhostInTheCodebase 3D city without a live agent connection. The narrative:
// the AI adds an in-memory invoice cache that never evicts (a leak), metrics
// ramp, Autopsy blames turn 4, then turn 6 heals it.

function metricSeries(): MetricSample[] {
  // 4 samples per turn; baseline healthy, ramp after the cache lands (turn 4),
  // recover after the fix (turn 6).
  const out: MetricSample[] = [];
  let mem = 60;
  let cpu = 8;
  let errors = 0;
  let latency = 40;
  for (let turn = 0; turn < 7; turn++) {
    for (let s = 0; s < 4; s++) {
      if (turn >= 4 && turn < 6) {
        mem += 38; // leak climbs
        cpu += 4;
        latency += 25;
        if (turn === 5 && s === 3) errors += 1;
      } else if (turn >= 6) {
        mem = 70 + (s === 3 ? -2 : 0); // healed
        cpu = 10;
        latency = 42;
      } else {
        mem += 2;
      }
      out.push({
        turn,
        cpu: Math.min(100, Math.round(cpu)),
        mem: Math.round(mem),
        errors,
        latency: Math.round(latency),
      });
    }
  }
  return out;
}

export const demoSession: Session = {
  id: "sess-demo-001",
  agent: "OpenCode",
  repo: "ghostinthecodebase",
  startedAt: "2026-10-20T07:00:00.000Z",
  turns: [
    {
      id: "t1",
      index: 0,
      role: "user",
      text: "Add a REST endpoint to list invoices for the current user.",
      timestamp: "2026-10-20T07:00:05.000Z",
      changedFiles: [],
      diff: [],
    },
    {
      id: "t2",
      index: 1,
      role: "assistant",
      text:
        "Created GET /api/invoices returning owner-scoped invoices. Added the route handler and a typed store.",
      timestamp: "2026-10-20T07:01:20.000Z",
      changedFiles: ["app/api/invoices/route.ts", "src/store/invoices.ts"],
      diff: [
        {
          file: "app/api/invoices/route.ts",
          lines: [
            "+ export async function GET(req: NextRequest) {",
            "+   const userId = userIdFrom(req);",
            "+   return NextResponse.json({ invoices: listInvoices(userId) });",
            "+ }",
          ],
        },
      ],
      snapshotId: "snap-1",
    },
    {
      id: "t3",
      index: 2,
      role: "user",
      text:
        "Invoice lookups are slow under load. Add an in-memory cache to speed them up.",
      timestamp: "2026-10-20T07:03:00.000Z",
      changedFiles: [],
      diff: [],
    },
    {
      id: "t4",
      index: 3,
      role: "assistant",
      text:
        "Added a module-level Map cache in front of the invoice store. Hits bypass the DB read.",
      timestamp: "2026-10-20T07:04:10.000Z",
      changedFiles: ["src/store/invoices.ts"],
      diff: [
        {
          file: "src/store/invoices.ts",
          lines: [
            "+ const cache = new Map<string, Invoice>();",
            "+ export function getInvoice(id: string, userId: string) {",
            "+   if (cache.has(id)) return cache.get(id)!;", // matcha:debt no eviction -> leak
            "+   const inv = store.get(id); cache.set(id, inv); return inv;",
            "+ }",
          ],
        },
      ],
      snapshotId: "snap-2",
    },
    {
      id: "t5",
      index: 4,
      role: "user",
      text: "The server keeps running out of memory after a few minutes. Diagnose and fix it.",
      timestamp: "2026-10-20T07:10:00.000Z",
      changedFiles: [],
      diff: [],
    },
    {
      id: "t6",
      index: 5,
      role: "assistant",
      text:
        "Root cause: the cache grows unbounded. Added a max-size LRU eviction so memory stays flat.",
      timestamp: "2026-10-20T07:12:30.000Z",
      changedFiles: ["src/store/invoices.ts"],
      diff: [
        {
          file: "src/store/invoices.ts",
          lines: [
            "- const cache = new Map<string, Invoice>();",
            "+ const cache = new Map<string, Invoice>();",
            "+ const MAX = 1000;",
            "+ if (cache.size > MAX) cache.clear(); // evict",
          ],
        },
      ],
      snapshotId: "snap-3",
    },
    {
      id: "t7",
      index: 6,
      role: "user",
      text: "Now render the codebase as a 3D city so I can see what you built.",
      timestamp: "2026-10-20T07:15:00.000Z",
      changedFiles: [],
      diff: [],
    },
  ],
  metrics: metricSeries(),
  snapshots: [
    {
      id: "snap-1",
      turnId: "t2",
      files: [
        { path: "app/api/invoices/route.ts", loc: 22, owner: "ai", unreviewed: true },
        { path: "src/store/invoices.ts", loc: 40, owner: "ai", unreviewed: true },
      ],
      imports: [
        ["app/api/invoices/route.ts", "src/store/invoices.ts"],
      ],
    },
    {
      id: "snap-2",
      turnId: "t4",
      files: [
        { path: "app/api/invoices/route.ts", loc: 22, owner: "ai", unreviewed: false },
        { path: "src/store/invoices.ts", loc: 58, owner: "ai", unreviewed: true },
      ],
      imports: [
        ["app/api/invoices/route.ts", "src/store/invoices.ts"],
      ],
    },
    {
      id: "snap-3",
      turnId: "t6",
      files: [
        { path: "app/api/invoices/route.ts", loc: 22, owner: "ai", unreviewed: false },
        { path: "src/store/invoices.ts", loc: 64, owner: "ai", unreviewed: false },
      ],
      imports: [
        ["app/api/invoices/route.ts", "src/store/invoices.ts"],
      ],
    },
  ],
  anomalies: [
    {
      id: "anom-1",
      kind: "leak",
      turnId: "t4",
      severity: "high",
      metric: "mem",
      detectedAt: "2026-10-20T07:09:00.000Z",
      note: "Resident memory climbs ~38 MB per sample with no plateau after the cache landed.",
    },
  ],
  autopsies: [
    {
      id: "aut-1",
      anomalyId: "anom-1",
      blamedTurnId: "t4",
      rootCause:
        "Turn 4 introduced a module-level Map cache with no eviction policy. Every invoice read is retained for the process lifetime, so memory grows unbounded under traffic.",
      fixPrompt:
        "Add a bounded LRU eviction (e.g. clear or shift when size exceeds a cap) to src/store/invoices.ts and re-run the memory regression check.",
      healed: true,
    },
  ],
};
