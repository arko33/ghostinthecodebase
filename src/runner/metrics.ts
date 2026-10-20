// Runner: samples runtime metrics (CPU, memory, errors, latency) for the app
// under observation, so Autopsy can correlate regressions to agent turns.
//
// matcha:todo scaffold stub — in the full build use `pidusage` (or the app's
// own /metrics endpoint) on a polling loop and emit MetricSample per turn.

import type { MetricSample } from "@/src/types";

export interface MetricsRunnerOptions {
  /** Polling interval in ms. */
  intervalMs?: number;
  /** Turn index to tag samples with. */
  currentTurn: () => number;
}

export function createMetricsRunner(_opts: MetricsRunnerOptions): {
  sample(): MetricSample;
  stop(): void;
} {
  // matcha:todo replace with real pidusage sampling keyed to the active turn.
  return {
    sample() {
      return { turn: 0, cpu: 0, mem: 0, errors: 0, latency: 0 };
    },
    stop() {},
  };
}
