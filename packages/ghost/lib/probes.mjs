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
      const started = Date.now();
      const res = await fetchImpl(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(5000) });
      const latencyMs = Date.now() - started;
      if (!res.ok) return push(ts, { errors: 1, httpStatus: res.status, latencyMs }, true);
      const body = await res.json().catch(() => ({}));
      const cpu = Number(body.cpuPercent ?? body.cpu ?? 0) || 0;
      let cpuDelta = cpu;
      if (lastCpu !== null) cpuDelta = Math.max(0, cpu - lastCpu);
      lastCpu = cpu;
      push(ts, {
        cpu: Number((cpuDelta * 100 + cpu).toFixed(2)),
        rss: Number(body.rss ?? 0),
        heap: Number(body.heap ?? 0),
        latencyMs,
        errors: 0,
        uptime: Number(body.uptime ?? 0),
      }, false);
    } catch {
      push(ts, { errors: 1, httpStatus: 0 }, true);
    }
  }

  // Back off when the target keeps failing (wrong URL, app down, no
  // /api/health): keep the last sample slot moving but stop hammering the
  // app — 5 straight failures slow the cadence 8x, 10 straight 30x.
  let consecutiveFailures = 0;
  function reschedule() {
    if (state.timer) clearInterval(state.timer);
    const slot = intervalMs * (consecutiveFailures >= 10 ? 30 : consecutiveFailures >= 5 ? 8 : 1);
    state.timer = setInterval(() => void sample(), slot);
    state.timer.unref?.();
  }

  function push(ts, metrics, failed) {
    if (failed) consecutiveFailures += 1; else consecutiveFailures = 0;
    if (consecutiveFailures === 5 || consecutiveFailures === 10) {
      // keep the slot bookkeeping correct while the cadence backs off
      reschedule();
    }
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
