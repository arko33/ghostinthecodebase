// Domain model for CodeAutopsy + GhostInTheCodebase.
// Mirrors the data model described in PRD_CONCEPT.md (sessions, turns,
// snapshots, metric_samples, anomalies, autopsies). Kept framework-agnostic so
// the collector, autopsy engine, and dashboard all share one shape.

export type TurnRole = "user" | "assistant";

export type DiffSide = "ai" | "human";

export interface DiffHunk {
  file: string;
  /** unified-diff style lines; "+" added, "-" removed, " " context. */
  lines: string[];
}

export interface Turn {
  id: string;
  index: number;
  role: TurnRole;
  /** user turns carry the prompt; assistant turns carry the answer summary. */
  text: string;
  timestamp: string;
  /** human-readable list of files touched this turn. */
  changedFiles: string[];
  diff: DiffHunk[];
  snapshotId?: string;
}

export interface FileNode {
  path: string;
  loc: number;
  owner: DiffSide;
  /** true when AI-written and not yet human-reviewed (Fog of War). */
  unreviewed?: boolean;
}

export interface Snapshot {
  id: string;
  turnId: string;
  files: FileNode[];
  /** import edges: [from, to]. */
  imports: Array<[string, string]>;
}

export interface MetricSample {
  /** turn this sample belongs to (0-based). */
  turn: number;
  cpu: number; // %
  mem: number; // MB
  errors: number; // count in window
  latency: number; // ms p95
}

export type AnomalyKind = "leak" | "cpu-spin" | "hang" | "error-spike";
export type Severity = "low" | "med" | "high";

export interface Anomaly {
  id: string;
  kind: AnomalyKind;
  /** turn the anomaly first manifests in. */
  turnId: string;
  severity: Severity;
  metric: keyof Omit<MetricSample, "turn">;
  detectedAt: string;
  note: string;
}

export interface Autopsy {
  id: string;
  anomalyId: string;
  /** turn the engine blames as root cause. */
  blamedTurnId: string;
  rootCause: string;
  fixPrompt: string;
  healed: boolean;
}

export interface Session {
  id: string;
  agent: string;
  repo: string;
  startedAt: string;
  turns: Turn[];
  metrics: MetricSample[];
  snapshots: Snapshot[];
  anomalies: Anomaly[];
  autopsies: Autopsy[];
}
