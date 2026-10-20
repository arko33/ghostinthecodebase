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
  // matcha:todo real detection (trend + threshold). Placeholder: flag any
  // sample breaching a hard threshold and attribute to its turn.
  const out: Anomaly[] = [];
  for (const m of metrics) {
    if (m.mem > THRESHOLDS.memMb) {
      out.push({
        id: `anom-mem-${m.turn}`,
        kind: "leak",
        turnId: `t${m.turn + 1}`,
        severity: "high",
        metric: "mem",
        detectedAt: new Date().toISOString(),
        note: `Memory exceeded ${THRESHOLDS.memMb} MB.`,
      });
    }
  }
  return out;
}

export function buildAutopsy(
  _anomaly: Anomaly,
  _turns: Turn[],
): Autopsy {
  // matcha:todo attribution bisect -> blamedTurnId + generated fixPrompt.
  return {
    id: "aut-stub",
    anomalyId: _anomaly.id,
    blamedTurnId: _anomaly.turnId,
    rootCause: "Stub autopsy — wire attribution in the full build.",
    fixPrompt: "Stub fix prompt.",
    healed: false,
  };
}

export function runAutopsy(session: Session): AutopsyResult {
  const anomalies = detectAnomalies(session.metrics);
  const autopsies = anomalies.map((a) => buildAutopsy(a, session.turns));
  return { anomalies, autopsies };
}
