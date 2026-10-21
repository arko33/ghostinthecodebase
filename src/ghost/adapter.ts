// Ghost recorder (contract v1) → dashboard Session adapter.
// Bridges the REAL recording (packages/ghost ghost watch) into the exact
// Session type the playground renders. Every field is derived from the
// recording itself — nothing invented:
//   turns        ← recorder turns (prompt = user text; assistant turns keep
//                  their plugin id) + meta-attested file lists
//   checkpoints  ← cumulative snapshot towers; loc = diff churn
//                  ("height is churn" — the recording fact, not fiction)
//   samples      ← runtime probes (metrics), unit-normalized to MB
//   anomalies/autopsies ← src/autopsy/engine run on the real curves
import type { MetricSample, Session, Snapshot, Turn } from "@/src/types";
import { runAutopsy } from "@/src/autopsy/engine";

/** raw session shape served by the recorder at GET 127.0.0.1:<port>/session */
interface RecorderTurn {
  index: number;
  id?: string | null;
  estimated?: boolean;
  agent?: string | null;
  prompt?: string;
  startedAt: string;
  endedAt?: string | null;
  files?: string[];
}
interface RecorderCheckpoint {
  ts: string;
  turnNumber: number;
  sha: string;
  files: string[];
  diffRef?: string;
  churn?: Record<string, number>;
}
interface RecorderSample {
  ts: string;
  turnNumber: number;
  metrics: {
    cpu?: number;
    rss?: number;
    heap?: number;
    latencyMs?: number | null;
    errors?: number;
    httpStatus?: number;
  };
  probeFailed?: boolean;
}
export interface GhostRecordingSession {
  id: string;
  repo: string;
  appUrl?: string;
  head?: string | null;
  synced?: string | null;
  turns: RecorderTurn[];
  samples: RecorderSample[];
  checkpoints: RecorderCheckpoint[];
}

/** recorder rss unit is whatever the probed app reports — normalize to MB */
function toMb(rss: number | undefined): number {
  if (!rss) return 0;
  return rss > 100_000 ? Math.round((rss / 1_048_576) * 10) / 10 : Math.round(rss * 10) / 10;
}

export function toDashboardSession(raw: GhostRecordingSession): Session {
  const turns: Turn[] = [];

  // checkpoints grouped per turn → changed files + patch refs
  const filesByTurn = new Map<number, string[]>();
  const refsByTurn = new Map<number, string[]>();
  orderCheckpoints(raw.checkpoints ?? []).forEach((c) => {
    if (!c.turnNumber) return;
    filesByTurn.set(c.turnNumber, [...new Set([...(filesByTurn.get(c.turnNumber) ?? []), ...(c.files ?? [])])]);
    refsByTurn.set(c.turnNumber, [...(refsByTurn.get(c.turnNumber) ?? []), c.diffRef ?? ""]);
  });

  for (const t of raw.turns ?? []) {
    const files = [...new Set([...(t.files ?? []), ...(filesByTurn.get(t.index) ?? [])])];
    turns.push({
      id: t.id ?? `est-turn-${t.index}`,
      index: t.index,
      role: t.prompt ? "user" : "assistant",
      text:
        t.prompt ??
        (t.id
          ? `assistant turn (id ${t.id}) — events only`
          : "turn inferred from file activity (mode B)"),
      timestamp: t.startedAt,
      changedFiles: files,
      diff: [],
      snapshotId: refsByTurn.get(t.index)?.[0] ? `sha:${refsByTurn.get(t.index)![0].split("/").pop()}` : undefined,
    });
  }

  // cumulative snapshots: each checkpoint = city state after that burst
  const cumulative = new Map<string, number>();
  const snapshots: Snapshot[] = (raw.checkpoints ?? []).map((c) => {
    for (const [file, churn] of Object.entries(c.churn ?? {})) {
      cumulative.set(file, (cumulative.get(file) ?? 0) + churn);
    }
    const turn = turns.find((x) => x.index === c.turnNumber);
    return {
      id: c.sha.slice(0, 12),
      turnId: turn?.id ?? `est-turn-${c.turnNumber}`,
      files: [...cumulative.entries()].map(([path, loc]) => ({
        path,
        loc: Math.max(1, loc),
        owner: "ai" as const,
        unreviewed: true,
      })),
      imports: [],
    };
  });

  const metrics: MetricSample[] = (raw.samples ?? [])
    .filter((s) => !s.probeFailed)
    .map((s) => ({
      turn: s.turnNumber,
      cpu: s.metrics.cpu ?? 0,
      mem: toMb(s.metrics.rss),
      errors: s.metrics.errors ?? 0,
      latency: s.metrics.latencyMs ?? 0,
    }));

  const session: Session = {
    id: raw.id,
    agent: "ghost-live (agent-agnostic)",
    repo: raw.repo,
    startedAt: raw.turns?.[0]?.startedAt ?? raw.checkpoints?.[0]?.ts ?? new Date().toISOString(),
    turns,
    metrics,
    snapshots,
    anomalies: [],
    autopsies: [],
  };

  const { anomalies, autopsies } = runAutopsy(session);
  // engine ids are sample-turn-based ("t<n>"); re-resolve to the real turn id
  const realId = (id: string) =>
    /^t\d+$/.test(id) ? turns.find((t) => t.index === Number(id.slice(1)))?.id ?? id : id;
  session.anomalies = anomalies.map((a) => ({ ...a, turnId: realId(a.turnId) }));
  session.autopsies = autopsies.map((a) => ({ ...a, blamedTurnId: realId(a.blamedTurnId) }));
  return session;
}

function orderCheckpoints(checkpoints: RecorderCheckpoint[]): RecorderCheckpoint[] {
  return [...checkpoints].sort((a, b) => (a.turnNumber - b.turnNumber) || (a.ts < b.ts ? -1 : 1));
}
