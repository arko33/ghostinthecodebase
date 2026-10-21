// Autopsy Engine: detects anomalies in the metric stream, attributes each to
// the agent turn that caused it, and proposes a one-click rollback + heal.
//
// Three layers (from PRD_CONCEPT.md):
//   1. Threshold — hard limits (mem > X, error rate > Y).
//   2. Trend — slope / derivative spikes (leak, cpu-spin).
//   3. Attribution — bisect metric deltas to the turn that introduced them.
//
// matcha:todo scaffold stub — implement the detectors + attribution in the
// full build. The demo fixture already ships a precomputed anomaly + autopsy.

import type {
  Anomaly,
  Autopsy,
  MetricSample,
  Session,
  Turn,
} from "@/src/types";

export interface AutopsyResult {
  anomalies: Anomaly[];
  autopsies: Autopsy[];
}

const THRESHOLDS = {
  memMb: 512,
  cpuPct: 90,
  errors: 3,
  latencyMs: 800,
};

export function detectAnomalies(metrics: MetricSample[]): Anomaly[] {
  // First-breach detection over the hard thresholds, deduped per kind: the
  // goal is the ONSET turn of a real breach, not an alert storm. The
  // trend-slope detector is the next layer (PRD_CONCEPT.md); for live
  // recordings the onset turn is already an actionable, honest verdict.
  // Convention: metric samples carry their recorder turn number verbatim
  // (1-based) and turn ids are "t<turnNumber>" — the adapter re-resolves.
  const out: Anomaly[] = [];
  const seen = new Set<string>();
  const now = () => new Date().toISOString();
  for (const m of metrics) {
    if (m.mem > THRESHOLDS.memMb && !seen.has("leak")) {
      seen.add("leak");
      out.push({
        id: `anom-mem-t${m.turn}`,
        kind: "leak",
        turnId: `t${m.turn}`,
        severity: "high",
        metric: "mem",
        detectedAt: now(),
        note: `Memory breached ${THRESHOLDS.memMb} MB (first sample: ${m.mem} MB).`,
      });
    }
    if (m.cpu > THRESHOLDS.cpuPct && !seen.has("cpu-spin")) {
      seen.add("cpu-spin");
      out.push({
        id: `anom-cpu-t${m.turn}`,
        kind: "cpu-spin",
        turnId: `t${m.turn}`,
        severity: "med",
        metric: "cpu",
        detectedAt: now(),
        note: `CPU breached ${THRESHOLDS.cpuPct}% (${m.cpu}%).`,
      });
    }
    if (m.errors > THRESHOLDS.errors && !seen.has("error-spike")) {
      seen.add("error-spike");
      out.push({
        id: `anom-err-t${m.turn}`,
        kind: "error-spike",
        turnId: `t${m.turn}`,
        severity: "high",
        metric: "errors",
        detectedAt: now(),
        note: `${m.errors} errors in one sample window.`,
      });
    }
    if (m.latency > THRESHOLDS.latencyMs && !seen.has("hang")) {
      seen.add("hang");
      out.push({
        id: `anom-lat-t${m.turn}`,
        kind: "hang",
        turnId: `t${m.turn}`,
        severity: "med",
        metric: "latency",
        detectedAt: now(),
        note: `Latency breached ${THRESHOLDS.latencyMs} ms p95 (${m.latency} ms).`,
      });
    }
  }
  return out;
}

export function buildAutopsy(
  anomaly: Anomaly,
  turns: Turn[],
): Autopsy {
  // Attribution, honest edition: global turn ids may differ from the recording
  // (plugin ids / estimated turns), so attach the real turn — if present — and
  // ground the verdict in what the recording actually shows: the onset sample
  // plus the files that turn touched. Never claim more causality than that.
  const blamedTurn =
    turns.find((t) => t.id === anomaly.turnId) ??
    turns.find((t) => `t${t.index}` === anomaly.turnId) ??
    null;
  const files = blamedTurn?.changedFiles ?? [];
  const rootCause = files.length
    ? `${anomaly.note} Recorded while this turn was in flight (it touched: ${files.join(", ")}). The recording, not a causal claim.`
    : anomaly.note;
  const fixPrompt = files.length
    ? `Roll back the files touched by this turn (${files.join(", ")}) to their pre-turn state, re-run ghost watch, and confirm the curve flattens.`
    : `Re-run ghost watch around a checkpoint and compare the curve across the burst.`;
  return {
    id: `aut-${anomaly.id}`,
    anomalyId: anomaly.id,
    blamedTurnId: anomaly.turnId,
    rootCause,
    fixPrompt,
    healed: false,
  };
}

export function runAutopsy(session: Session): AutopsyResult {
  const anomalies = detectAnomalies(session.metrics);
  const autopsies = anomalies.map((a) => buildAutopsy(a, session.turns));
  return { anomalies, autopsies };
}
