// Autopsy Engine: detects anomalies in the metric stream, attributes each to
// the agent turn that caused it, and proposes a rollback + heal.
//
// Three layers:
//   1. Threshold  — hard limits (memory, CPU, errors, latency).
//   2. Trend      — least-squares slope over the sample stream, which is what
//                   separates a leak from a single busy minute.
//   3. Attribution — the regression is blamed on the last assistant turn at or
//                   before the point where the metric deviates. Metrics move
//                   after the code lands, so the cause is always upstream.

import type {
  Anomaly,
  AnomalyKind,
  Autopsy,
  MetricSample,
  Session,
  Severity,
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

const TREND = {
  /** MB per sample before memory growth is treated as a leak. */
  memMbPerSample: 8,
  /** CPU points per sample before growth is treated as a spin. Rising CPU
   * alongside rising traffic is expected, so this bar is deliberately higher
   * than the memory one. */
  cpuPctPerSample: 6,
  /** Samples per trend window. A healed series still contains the leak. */
  window: 8,
  /** Turn-over-turn jump that starts a rising series. */
  memJumpMb: 10,
  cpuJumpPct: 3,
};

/** Least-squares slope of a series, in units per sample. */
function slope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = i - meanX;
    num += dx * (values[i] - meanY);
    den += dx * dx;
  }
  return den === 0 ? 0 : num / den;
}

function groupByTurn(metrics: MetricSample[]): Map<number, MetricSample[]> {
  const byTurn = new Map<number, MetricSample[]>();
  for (const m of metrics) {
    const list = byTurn.get(m.turn);
    if (list) list.push(m);
    else byTurn.set(m.turn, [m]);
  }
  return byTurn;
}

/** First turn whose average is a real jump over the previous turn. */
function firstRisingTurn(metrics: MetricSample[], key: "mem" | "cpu"): number {
  const jump = key === "mem" ? TREND.memJumpMb : TREND.cpuJumpPct;
  const turns = [...groupByTurn(metrics).entries()].sort((a, b) => a[0] - b[0]);
  let previous: number | null = null;

  for (const [turn, samples] of turns) {
    const avg = samples.reduce((sum, s) => sum + s[key], 0) / samples.length;
    if (previous !== null && avg - previous > jump) return turn;
    previous = avg;
  }

  return metrics[0]?.turn ?? 0;
}

/**
 * Steepest rise inside a sliding window. A series that climbs and then heals
 * has a near-zero slope end to end, so the window is what actually finds it.
 */
function steepestRise(
  metrics: MetricSample[],
  key: "mem" | "cpu",
): { slope: number; turn: number } {
  const size = Math.min(TREND.window, metrics.length);
  let best = { slope: -Infinity, turn: metrics[0]?.turn ?? 0 };

  for (let start = 0; start + size <= metrics.length; start++) {
    const window = metrics.slice(start, start + size).map((m) => m[key]);
    const s = slope(window);
    if (s > best.slope) best = { slope: s, turn: metrics[start].turn };
  }

  return best;
}

function turnIdFor(turnIndex: number, turns?: Turn[]): string {
  return turns?.find((t) => t.index === turnIndex)?.id ?? `t${turnIndex + 1}`;
}

/**
 * Layer 1 + 2: hard thresholds on each turn, then trend detection across the
 * whole series. Returns one anomaly per (kind, turn) pair.
 */
export function detectAnomalies(
  metrics: MetricSample[],
  turns?: Turn[],
): Anomaly[] {
  if (metrics.length === 0) return [];

  const found: Anomaly[] = [];
  const seen = new Set<string>();

  function push(
    kind: AnomalyKind,
    turn: number,
    severity: Severity,
    metric: Anomaly["metric"],
    note: string,
  ) {
    const key = `${kind}:${turn}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push({
      id: `anom-${kind}-${turn}`,
      kind,
      turnId: turnIdFor(turn, turns),
      severity,
      metric,
      detectedAt: new Date().toISOString(),
      note,
    });
  }

  for (const [turn, samples] of groupByTurn(metrics)) {
    const maxMem = Math.max(...samples.map((s) => s.mem));
    const maxCpu = Math.max(...samples.map((s) => s.cpu));
    const maxLatency = Math.max(...samples.map((s) => s.latency));
    const maxErrors = Math.max(...samples.map((s) => s.errors));

    if (maxMem > THRESHOLDS.memMb) {
      push("leak", turn, "high", "mem", `Resident memory peaked at ${maxMem} MB, above the ${THRESHOLDS.memMb} MB ceiling.`);
    }
    if (maxCpu > THRESHOLDS.cpuPct) {
      push("cpu-spin", turn, "high", "cpu", `CPU peaked at ${maxCpu}%, above the ${THRESHOLDS.cpuPct}% ceiling.`);
    }
    if (maxErrors >= THRESHOLDS.errors) {
      push("error-spike", turn, "high", "errors", `${maxErrors} errors inside a single turn.`);
    }
    if (maxLatency > THRESHOLDS.latencyMs) {
      push("hang", turn, "med", "latency", `p95 latency peaked at ${maxLatency} ms, above the ${THRESHOLDS.latencyMs} ms ceiling.`);
    }
  }

  const memTrend = steepestRise(metrics, "mem");
  if (memTrend.slope >= TREND.memMbPerSample) {
    push(
      "leak",
      firstRisingTurn(metrics, "mem"),
      memTrend.slope > 20 ? "high" : "med",
      "mem",
      `Memory grows ${memTrend.slope.toFixed(1)} MB per sample inside a ${TREND.window}-sample window, with no plateau.`,
    );
  }

  const cpuTrend = steepestRise(metrics, "cpu");
  if (cpuTrend.slope >= TREND.cpuPctPerSample) {
    push(
      "cpu-spin",
      firstRisingTurn(metrics, "cpu"),
      cpuTrend.slope > 10 ? "high" : "med",
      "cpu",
      `CPU grows ${cpuTrend.slope.toFixed(1)} points per sample inside a ${TREND.window}-sample window.`,
    );
  }

  const indexOf = (a: Anomaly) => turns?.find((t) => t.id === a.turnId)?.index ?? 0;
  return found.sort((a, b) => indexOf(a) - indexOf(b));
}

const EXPLAIN: Record<AnomalyKind, { cause: string; fix: string }> = {
  leak: {
    cause:
      "introduced code that retains memory for the lifetime of the process without an eviction path, so usage climbs with every request instead of settling.",
    fix:
      "Add a bounded eviction policy (LRU or a hard cap) to the structure that grows, then re-run the memory regression check until the curve is flat.",
  },
  "cpu-spin": {
    cause:
      "introduced a loop or retry path that keeps the event loop busy without yielding, so CPU rises with load and never returns to idle.",
    fix:
      "Bound the loop or add backoff between retries, then profile the hot path and re-run the CPU regression check.",
  },
  hang: {
    cause:
      "introduced a blocking call on the request path, so latency grows faster than throughput and requests start to queue.",
    fix:
      "Move the blocking work off the request path (queue or background job) or add a timeout, then re-run the latency check.",
  },
  "error-spike": {
    cause:
      "introduced an error path that is not handled, so failures surface as a burst of 5xx responses under load.",
    fix:
      "Handle the failing branch explicitly and add a regression test for it, then re-run the error-rate check.",
  },
};

/**
 * Layer 3: attribution. The metric moves after the code lands, so the blamed
 * turn is the last assistant turn at or before the anomaly becomes visible.
 */
export function buildAutopsy(anomaly: Anomaly, turns: Turn[]): Autopsy {
  const manifestIndex = turns.find((t) => t.id === anomaly.turnId)?.index ?? 0;
  const blamed =
    [...turns]
      .reverse()
      .find((t) => t.role === "assistant" && t.index <= manifestIndex) ??
    turns.find((t) => t.id === anomaly.turnId) ??
    turns[0];

  const explain = EXPLAIN[anomaly.kind];
  const files = blamed?.changedFiles ?? [];
  const where = files.length ? ` (${files.join(", ")})` : "";

  return {
    id: `aut-${anomaly.id}`,
    anomalyId: anomaly.id,
    blamedTurnId: blamed?.id ?? anomaly.turnId,
    rootCause: `Turn ${(blamed?.index ?? 0) + 1}${where} ${explain.cause}`.trim(),
    fixPrompt: `In ${files[0] ?? "the affected file"}: ${explain.fix}`,
    healed: false,
  };
}

/** True when the metric returns to a healthy fraction of its peak by the end. */
function hasRecovered(metrics: MetricSample[], anomaly: Anomaly): boolean {
  const key = anomaly.metric;
  const values = metrics.map((m) => m[key]);
  if (values.length === 0) return false;
  const peak = Math.max(...values);
  const last = values[values.length - 1];
  if (peak <= 0) return false;
  return last <= peak * 0.6;
}

export function runAutopsy(session: Session): AutopsyResult {
  const anomalies = detectAnomalies(session.metrics, session.turns);
  const autopsies = anomalies.map((anomaly) => ({
    ...buildAutopsy(anomaly, session.turns),
    healed: hasRecovered(session.metrics, anomaly),
  }));
  return { anomalies, autopsies };
}
