// Runner: samples runtime metrics for the app under observation so Autopsy can
// correlate a regression to the agent turn that caused it.
//
// The sampler reads /api/health rather than guessing: memory and CPU come from
// the observed process, latency is the round trip to that probe, and a failed
// probe is counted as an error.

import type { MetricSample } from "@/src/types";

export interface MetricsRunnerOptions {
  /** Polling interval in ms. */
  intervalMs?: number;
  /** Turn index to tag samples with. */
  currentTurn: () => number;
  /** Health probe URL. Relative paths work in the browser, absolute ones on the server. */
  healthUrl?: string;
}

export interface MetricsRunner {
  /** Take one sample and append it to the buffer. */
  sample(): Promise<MetricSample>;
  /** Poll on an interval until stop() is called. */
  start(onSample?: (sample: MetricSample) => void): void;
  stop(): void;
  /** Everything sampled so far (bounded). */
  samples(): MetricSample[];
}

interface HealthBody {
  cpuPct?: number;
  rssMb?: number;
}

const MAX_SAMPLES = 720;

export function createMetricsRunner(opts: MetricsRunnerOptions): MetricsRunner {
  const intervalMs = opts.intervalMs ?? 2000;
  const healthUrl = opts.healthUrl ?? "/api/health";
  const buffer: MetricSample[] = [];

  let errors = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  let inFlight = false;

  async function sample(): Promise<MetricSample> {
    const started = Date.now();
    let cpu = 0;
    let mem = 0;

    try {
      const res = await fetch(healthUrl, { cache: "no-store" });
      if (!res.ok) throw new Error(`health responded ${res.status}`);
      const body = (await res.json()) as HealthBody;
      cpu = body.cpuPct ?? 0;
      mem = body.rssMb ?? 0;
    } catch {
      errors += 1;
    }

    const sample: MetricSample = {
      turn: opts.currentTurn(),
      cpu: Math.round(cpu),
      mem: Math.round(mem),
      errors,
      latency: Date.now() - started,
    };

    buffer.push(sample);
    if (buffer.length > MAX_SAMPLES) buffer.shift();
    return sample;
  }

  return {
    sample,
    start(onSample) {
      if (timer) return;
      timer = setInterval(() => {
        if (inFlight) return;
        inFlight = true;
        void sample()
          .then((s) => onSample?.(s))
          .finally(() => {
            inFlight = false;
          });
      }, intervalMs);
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
    samples() {
      return [...buffer];
    },
  };
}
