// Ghost — runtime monitor (Mode C): polls the app's health probe and emits
// MetricSample objects tagged with the active turn. Probe failures count as
// errors but never crash the recorder.

export const DEFAULT_HEALTH_PATH = "/api/health";

export function createProbes({ url, intervalMs = 4000, fetchImpl = globalThis.fetch }) {
  const state = { running: false, timer: null, out: (s) => {} };
  let lastCpu = null;

  async function sample() {
    const ts = new Date().toISOString();
    try {
      const res = await fetchImpl(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(5000) });
      if (!res.ok) return push(ts, { errors: 1, httpStatus: res.status }, true);
      const body = await res.json().catch(() => ({}));
      const cpu = Number(body.cpuPercent ?? body.cpu ?? 0) || 0;
      let cpuDelta = cpu;
      if (lastCpu !== null) cpuDelta = Math.max(0, cpu - lastCpu);
      lastCpu = cpu;
      push(ts, {
        cpu: Number((cpuDelta * 100 + cpu).toFixed(2)),
        rss: Number(body.rss ?? 0),
        heap: Number(body.heap ?? 0),
        latencyMs: null,
        errors: 0,
        uptime: Number(body.uptime ?? 0),
      }, false);
    } catch {
      push(ts, { errors: 1, httpStatus: 0 }, true);
    }
  }

  function push(ts, metrics, failed) {
    state.out({ ts, metrics, probeFailed: failed });
  }

  return {
    // the recorder injects the active turn as samples stream out
    set sink(fn) { state.out = fn; },
    start() {
      if (state.running) return;
      state.running = true;
      void sample();
      state.timer = setInterval(() => void sample(), intervalMs);
      state.timer.unref?.();
    },
    stop() {
      if (state.timer) clearInterval(state.timer);
      state.running = false;
    },
  };
}
