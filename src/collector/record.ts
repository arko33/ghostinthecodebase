// Recorder: turns a repository plus a running app into a Session the dashboard
// can replay.
//
// It never touches HEAD, the branch, or the user's index: every change burst is
// written as a throwaway commit in the object database (see shadowSnapshot), so
// the timeline is built from what actually landed on disk. Metrics come from the
// app's own /api/health probe, not from a guess.
//
// Runs where the code lives (a laptop, CI, a devcontainer). The deployed
// dashboard only replays the JSON it produces.

import fs from "node:fs";
import path from "node:path";
import type { Session, Turn, MetricSample, Snapshot, FileNode } from "../types.ts";
import {
  isGitRepo,
  shadowTree,
  commitShadowTree,
  treeOf,
  shadowSnapshot,
  diffBetween,
} from "./shadow-git.ts";
import { runAutopsy } from "../autopsy/engine.ts";

export interface RecordOptions {
  repoPath: string;
  /** Probe polled for cpu/mem/latency, e.g. http://localhost:3000/api/health */
  healthUrl: string;
  /** How long to record. Default 60s. */
  durationMs?: number;
  /** Sampling interval. Default 2s. */
  intervalMs?: number;
}

interface HealthPayload {
  ok?: boolean;
  cpuPct?: number;
  rssMb?: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Relative and alias imports of a file, used to draw the 3D city's arcs. */
function importsFor(repoPath: string, file: string): string[] {
  if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(file)) return [];
  try {
    const source = fs.readFileSync(path.join(repoPath, file), "utf8");
    const found = new Set<string>();
    for (const match of source.matchAll(/from\s+["']([^"']+)["']/g)) {
      const spec = match[1];
      if (spec.startsWith(".") || spec.startsWith("@/")) found.add(spec);
    }
    return [...found];
  } catch {
    return [];
  }
}

export async function recordSession(options: RecordOptions): Promise<Session> {
  const { repoPath, healthUrl, durationMs = 60_000, intervalMs = 2_000 } = options;

  if (!isGitRepo(repoPath)) {
    throw new Error(`${repoPath} is not inside a git work tree`);
  }

  const startedAt = new Date().toISOString();
  const turns: Turn[] = [];
  const metrics: MetricSample[] = [];
  const snapshots: Snapshot[] = [];

  let parent = shadowSnapshot(repoPath, null, "baseline").hash;
  let parentTree = treeOf(repoPath, parent);
  let turnIndex = 0;
  let errors = 0;

  // Warm the app once so the first recorded sample is not a cold start.
  try {
    await fetch(healthUrl, { cache: "no-store" });
  } catch {
    // A cold-start miss is not a recorded error.
  }

  const deadline = Date.now() + durationMs;

  while (Date.now() < deadline) {
    const tick = Date.now();

    let cpu = 0;
    let mem = 0;
    try {
      const res = await fetch(healthUrl, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as HealthPayload;
      cpu = Math.round(body.cpuPct ?? 0);
      mem = Math.round(body.rssMb ?? 0);
    } catch {
      errors += 1;
    }
    const latency = Date.now() - tick;

    metrics.push({ turn: turnIndex, cpu, mem, errors, latency });

    const tree = shadowTree(repoPath);
    if (tree !== parentTree) {
      const hash = commitShadowTree(repoPath, tree, parent, `turn ${turnIndex + 1}`).hash;
      const diff = diffBetween(repoPath, parent, hash);
      const message = `turn ${turnIndex + 1}: ${diff.length} file(s) changed`;

      const files: FileNode[] = diff.map((hunk) => ({
        path: hunk.file,
        loc: hunk.lines.length,
        owner: "ai" as const,
      }));

      const imports: Array<[string, string]> = [];
      for (const file of files) {
        for (const target of importsFor(repoPath, file.path)) {
          imports.push([file.path, target]);
        }
      }

      const turn: Turn = {
        id: `t${turnIndex + 1}`,
        index: turnIndex,
        role: "assistant",
        text: message,
        timestamp: new Date().toISOString(),
        changedFiles: files.map((f) => f.path),
        diff,
        snapshotId: `snap-${turnIndex + 1}`,
      };

      turns.push(turn);
      snapshots.push({
        id: `snap-${turnIndex + 1}`,
        turnId: turn.id,
        files,
        imports,
      });

      parent = hash;
      parentTree = tree;
      turnIndex += 1;
    }

    const wait = intervalMs - (Date.now() - tick);
    if (wait > 0) await sleep(wait);
  }

  const base = {
    id: `sess-${Date.now()}`,
    agent: "shadow-git",
    repo: path.basename(repoPath),
    startedAt,
    turns,
    metrics,
    snapshots,
  };

  const { anomalies, autopsies } = runAutopsy({
    ...base,
    anomalies: [],
    autopsies: [],
  } as Session);

  return { ...base, anomalies, autopsies };
}
