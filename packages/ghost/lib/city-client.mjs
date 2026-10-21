
// Ghost City — live playground client. Mirrors /playground: tape rail, 3D code
// city, autopsy panel and timeline dock, fed by the recorder's own /session.
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const GHOST = (size, cls) =>
  '<svg class="ghost-mark ' + (cls || "") + '" width="' + size + '" height="' + size + '" viewBox="0 0 32 32" fill="none" aria-hidden="true">' +
  '<path d="M16 3.35c-5.5 0-9 4.4-9 10.4v13.15l3.2-2.6 2.3 2.6 3.5-2.95 3.5 2.95 2.3-2.6 3.2 2.6V13.75c0-6-3.5-10.4-9-10.4Z" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round"/>' +
  '<circle cx="12.7" cy="14" r="1.05" fill="currentColor"/><circle cx="19.3" cy="14" r="1.05" fill="currentColor"/>' +
  '<path d="M13.6 18.7c.7.7 1.5 1 2.4 1s1.7-.3 2.4-1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity=".45"/></svg>';

const icon = (d, size) =>
  '<svg width="' + (size || 14) + '" height="' + (size || 14) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';

const ICON = {
  robot: icon('<rect x="5" y="8" width="14" height="11" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01M9.5 16h5"/>'),
  user: icon('<circle cx="12" cy="8.5" r="3.2"/><path d="M5.5 20c.8-3.4 3.3-5.2 6.5-5.2s5.7 1.8 6.5 5.2"/>'),
  warning: icon('<path d="M12 4.8 21 20H3L12 4.8Z"/><path d="M12 10v4.2M12 17.2h.01"/>'),
  check: icon('<circle cx="12" cy="12" r="8.2"/><path d="m8.6 12.2 2.3 2.3 4.5-4.7"/>'),
  play: icon('<path d="M8 5.5 18 12 8 18.5V5.5Z"/>', 16),
  pause: icon('<path d="M9 5.5v13M15 5.5v13"/>', 16),
  left: icon('<path d="m14.5 6-6 6 6 6"/>', 16),
  right: icon('<path d="m9.5 6 6 6-6 6"/>', 16),
  refresh: icon('<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/>'),
  back: icon('<path d="M19 12H5m6-6-6 6 6 6"/>', 16),
  broadcast: icon('<circle cx="12" cy="12" r="2"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 16.2a6 6 0 0 0 0-8.4"/>'),
  cube: icon('<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>'),
  map: icon('<path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2V6Z"/><path d="M9 4v14M15 6v14"/>'),
  crosshair: icon('<circle cx="12" cy="12" r="7"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>'),
  file: icon('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5"/>'),
  x: icon('<path d="m6 6 12 12M18 6 6 18"/>'),
  undo: icon('<path d="M4 10h9a5 5 0 1 1 0 10H8"/><path d="M4 10l4-4M4 10l4 4"/>'),
  copy: icon('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>'),
};

const state = {
  raw: null, demo: false, first: true,
  id: "—", repo: "—", head: null, agent: "ghost watch · local",
  turns: [], towers: [], samples: [], anomaly: null, blamedPath: null,
  active: 0, selected: null, playing: false, speed: 1, preset: "overview",
  diffCache: new Map(), sig: "", seq: 0,
};
let timer = null;

const hash = (value) => {
  let out = 2166136261;
  for (let i = 0; i < value.length; i += 1) { out ^= value.charCodeAt(i); out = Math.imul(out, 16777619); }
  return (out >>> 0) / 4294967296;
};
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const timecode = (turn) => (turn && turn.ts ? new Date(turn.ts).toISOString().slice(11, 19) : "00:00:00");

// ── data ─────────────────────────────────────────────────────────────────────
function normalize(raw) {
  const checkpoints = raw.checkpoints || [];
  const samples = raw.samples || [];
  const perTurn = new Map();
  for (const cp of checkpoints) {
    const list = perTurn.get(cp.turnNumber) || [];
    perTurn.set(cp.turnNumber, list.concat(cp.files || []));
  }
  const turns = (raw.turns || []).map((t, i) => {
    const n = t.index ?? i + 1;
    const cp = checkpoints.find((c) => c.turnNumber === n && c.sha && !String(c.sha).startsWith("nogit-"));
    return {
      index: i, n,
      role: t.id ? "assistant" : "user",
      text: t.prompt || (t.id ? "[assistant turn " + String(t.id).slice(0, 8) + "]" : "[no prompt captured]"),
      files: [...new Set([...(t.files || []), ...(perTurn.get(n) || [])])],
      ts: t.startedAt || t.ts || null,
      sha: cp ? cp.sha : null,
      estimated: !!t.estimated,
    };
  });

  const seen = new Map();
  for (const cp of checkpoints) {
    for (const f of cp.files || []) {
      if (!f) continue;
      const cur = seen.get(f) || { path: f, loc: 0, git: false, turn: cp.turnNumber || 1, ts: cp.ts, sha: cp.sha, cps: 0 };
      const churn = cp.churn ? cp.churn[f] : null;
      if (churn != null) {
        cur.loc += churn; cur.git = true;
        if (!cur.sha || String(cur.sha).startsWith("nogit-")) cur.sha = cp.sha;
      }
      cur.cps += 1;
      seen.set(f, cur);
    }
  }
  const spacing = 3.05, cols = 10, rows = 8;
  const towers = [...seen.values()].sort((a, b) => String(a.ts).localeCompare(String(b.ts))).map((t) => {
    const col = Math.floor(hash(t.path) * cols);
    const row = Math.floor(hash(t.path + "·z") * rows);
    return {
      ...t,
      owner: "ai",
      x: (col - (cols - 1) / 2) * spacing,
      z: (row - (rows - 1) / 2) * spacing,
      w: 0.8 + (hash(t.path + "w") % 0.3) * 0.9,
      d: 0.8 + (hash(t.path + "d") % 0.3) * 0.9,
      h: t.git ? clamp(t.loc / 7 + 2.2, 1.6, 12) : 2.0,
    };
  });

  const anomaly = detect(samples);
  let blamedPath = null;
  if (anomaly) {
    // Probes sample every few seconds, so a spike is often first seen one turn
    // after the write that caused it. Blame the window [turn-1, turn], weighted
    // so the current turn still wins a tie — otherwise the fix prompt points at
    // whichever stylesheet happened to be edited next.
    let best = null;
    for (const turn of [anomaly.turn, anomaly.turn - 1]) {
      const weight = turn === anomaly.turn ? 1 : 0.7;
      for (const c of checkpoints) {
        if (c.turnNumber !== turn) continue;
        for (const [p, v] of Object.entries(c.churn || {})) {
          const score = v * weight;
          if (!best || score > best.score) best = { p, score };
        }
      }
    }
    blamedPath = best ? best.p : null;
  }

  return {
    id: raw.id || "session", repo: raw.repo || "—", head: raw.head || null,
    agent: raw.demo ? "demo fixture" : "ghost watch · local",
    turns, towers, samples, anomaly, blamedPath,
  };
}

function detect(samples) {
  if (!samples || samples.length < 3) return null;
  let best = null;
  for (let i = 1; i < samples.length; i += 1) {
    const a = (samples[i - 1].metrics || {}).rss || 0;
    const b = (samples[i].metrics || {}).rss || 0;
    const delta = b - a;
    if (delta > 40 * 1024 * 1024 && (!best || delta > best.delta)) {
      best = { index: i, delta, turn: samples[i].turnNumber || 1, kind: "memory", severity: delta > 80 * 1024 * 1024 ? "critical" : "warning" };
    }
  }
  return best;
}

function demoRaw() {
  const t0 = Date.now() - 9 * 60000;
  const files = [
    "app/api/invoices/[id]/route.ts", "src/store/invoices.ts", "src/types.ts",
    "app/api/invoices/route.ts", "src/autopsy/engine.ts", "src/components/GhostCity.tsx",
    "app/playground/page.tsx", "src/components/Dashboard.tsx", "src/collector/opencode.ts",
    "src/runner/metrics.ts", "app/globals.css", "README.md",
  ];
  const prompts = [
    "add the invoices API — list plus read by id",
    "wire the read route into the in-memory store",
    "ship the playground shell with the tape rail",
    "optimize the store lookup — cache by owner",
    "tune the city palette to violet and cyan",
    "add runtime probes to the recorder",
    "write the autopsy verdict card",
    "document the three minute demo path",
  ];
  const turns = prompts.map((p, i) => ({
    index: i + 1, id: "demo-" + i, estimated: false, agent: "opencode", prompt: p,
    startedAt: new Date(t0 + i * 52000).toISOString(),
    endedAt: new Date(t0 + i * 52000 + 40000).toISOString(),
    files: files.slice(0, 3 + ((i * 2) % 7)),
  }));
  const checkpoints = turns.map((t, i) => {
    const touched = files.slice(i % 3, (i % 3) + 4);
    const churn = {};
    touched.forEach((f, j) => { churn[f] = 8 + ((i * 7 + j * 13) % 42); });
    return { ts: t.endedAt, turnNumber: t.index, sha: "demo" + String(i).padStart(4, "0"), files: touched, churn };
  });
  const samples = [];
  for (let i = 0; i < 28; i += 1) {
    const turn = clamp(1 + Math.floor(i / 3.5), 1, 8);
    const spike = turn >= 4 && turn <= 5 ? 52 * 1024 * 1024 : 0;
    samples.push({
      ts: new Date(t0 + i * 15000).toISOString(), turnNumber: turn,
      metrics: { rss: 120 * 1024 * 1024 + i * 1.4 * 1024 * 1024 + spike, cpu: 18 + Math.sin(i / 2) * 6 + (turn === 4 ? 38 : 0), heap: 64 * 1024 * 1024, latencyMs: null, errors: 0, uptime: i * 15 },
      probeFailed: false,
    });
  }
  return { id: "demo-session", repo: "ghostinthecodebase", head: "8c0073a9f2", app: { baseUrl: "http://localhost:3000" }, turns, checkpoints, samples, demo: true };
}

// ── render ───────────────────────────────────────────────────────────────────
function apply(raw) {
  const model = normalize(raw);
  state.raw = raw;
  state.id = model.id; state.repo = model.repo; state.head = model.head; state.agent = model.agent;
  state.turns = model.turns; state.towers = model.towers; state.samples = model.samples;
  state.anomaly = model.anomaly; state.blamedPath = model.blamedPath;
  if (state.first) { state.active = Math.max(0, state.turns.length - 1); state.first = false; }
  state.active = clamp(state.active, 0, Math.max(0, state.turns.length - 1));
  if (state.selected && !state.towers.some((t) => t.path === state.selected)) state.selected = null;
  renderAll();
  const sig = state.towers.map((t) => t.path + ":" + t.h + ":" + (t.path === state.blamedPath ? 1 : 0)).join("|") + "#" + (state.demo ? "demo" : "live");
  if (sig !== state.sig) { state.sig = sig; buildScene(); }
  else updateSelection();
}

function renderAll() {
  renderTop(); renderRail(); renderAutopsy(); renderDock(); renderStage(); updateSelection();
}

function renderTop() {
  $("pillSession").textContent = state.id;
  $("pillAgent").textContent = state.agent;
  $("pillRepo").textContent = state.repo;
  const live = state.demo ? false : !state.raw || state.raw.status === "recording";
  $("liveChip").setAttribute("data-on", live ? "true" : "false");
  $("liveText").textContent = state.demo ? "Demo" : live ? "Live" : "Replay";
  $("railRec").setAttribute("data-on", live ? "true" : "false");
  $("dockRec").setAttribute("data-on", live || state.playing ? "true" : "false");
  $("btnDemo").setAttribute("data-on", state.demo ? "true" : "false");
  $("btnDemo").textContent = state.demo ? "Live" : "Demo";
  $("railAgent").textContent = state.agent;
  $("railSid").textContent = state.id === "—" ? "—" : String(state.id).slice(0, 8);
}

function renderRail() {
  $("railCount").textContent = state.turns.length + " turns";
  const anomalyTurn = state.anomaly ? state.anomaly.turn : null;
  $("tape").innerHTML = state.turns.map((t, i) => {
    const active = i === state.active;
    const hot = anomalyTurn != null && t.n === anomalyTurn;
    const node = hot ? GHOST(15) : t.role === "assistant" ? ICON.robot : ICON.user;
    const badge = hot
      ? '<span class="pg-turn__badge pg-turn__badge--hot">' + ICON.warning.replace('width="14" height="14"', 'width="12" height="12"') + "regression</span>"
      : t.role === "assistant" ? '<span class="pg-turn__badge">AI</span>' : "";
    const files = active && t.files.length
      ? '<span class="pg-turn__files">' + t.files.map((f) => "<span>" + esc(f) + "</span>").join("") + "</span>"
      : "";
    return '<li class="pg-rail__item"><span class="pg-rail__connector"></span>' +
      '<button type="button" class="pg-turn" data-i="' + i + '" data-active="' + active + '" data-hot="' + hot + '">' +
      '<span class="pg-turn__node">' + node + "</span>" +
      '<span class="pg-turn__body"><span class="pg-turn__top">' +
      '<span class="pg-turn__index">t' + t.n + "</span>" +
      '<span class="pg-turn__role">' + t.role + "</span>" + badge +
      '</span><span class="pg-turn__text">' + esc(t.text) + "</span>" + files +
      "</span></button></li>";
  }).join("") || '<div class="pg-empty">' + GHOST(26, "ghost-mark--glow") + "<p>No turns yet — talk to your agent; the tape fills live.</p></div>";
}

function renderStage() {
  $("stageTag").innerHTML = ICON.cube + "code city · " + state.turns.length + " turns";
  const empty = !state.towers.length;
  $("cityEmpty").style.display = empty ? "flex" : "none";
  if (empty) {
    $("cityEmpty").innerHTML = GHOST(34, "ghost-mark--glow") +
      "<h3>" + (state.demo ? "building the demo skyline" : "the city is empty") + "</h3>" +
      "<p>" + (state.demo
        ? "demo fixture — no files from your machine are shown."
        : 'each file your agent touches raises a tower. run your agent in this repo and the recorder lays towers from real checkpoints.<br/><button type="button" id="emptyDemo" style="pointer-events:auto;color:var(--violet-soft);text-decoration:underline">open the demo city</button>') + "</p>";
    const demo = $("emptyDemo");
    if (demo) demo.onclick = () => $("btnDemo").click();
  }
  [...document.querySelectorAll("[data-preset]")].forEach((b) => b.setAttribute("data-active", b.dataset.preset === state.preset ? "true" : "false"));
}

function chartSvg(samples) {
  if (!samples.length) {
    return '<div class="pg-empty">' + GHOST(24, "ghost-mark--glow") + "<p>0 samples yet — point the recorder at your app (--app-url) so health samples arrive.</p></div>";
  }
  const W = 560, H = 250, padL = 44, padR = 46, padT = 30, padB = 30;
  const mem = samples.map((s) => Math.round(((s.metrics || {}).rss || 0) / 1048576));
  const lat = samples.map((s) => Math.round((s.metrics || {}).latencyMs || 0));
  const maxMem = Math.max(400, Math.max.apply(null, mem)) * 1.02;
  const maxLat = Math.max(300, Math.max.apply(null, lat)) * 1.08;
  const threshold = 200;
  const x = (i) => padL + (i / Math.max(1, samples.length - 1)) * (W - padL - padR);
  const yMem = (v) => H - padB - (v / maxMem) * (H - padT - padB);
  const yLat = (v) => H - padB - (v / maxLat) * (H - padT - padB);
  const smooth = (pts) => {
    if (!pts.length) return "";
    let d = "M " + pts[0][0].toFixed(1) + " " + pts[0][1].toFixed(1);
    for (let i = 0; i < pts.length - 1; i += 1) {
      const mid = (pts[i][0] + pts[i + 1][0]) / 2;
      d += " C " + mid.toFixed(1) + " " + pts[i][1].toFixed(1) + ", " + mid.toFixed(1) + " " + pts[i + 1][1].toFixed(1) + ", " + pts[i + 1][0].toFixed(1) + " " + pts[i + 1][1].toFixed(1);
    }
    return d;
  };
  const memPath = smooth(mem.map((v, i) => [x(i), yMem(v)]));
  const latPath = smooth(lat.map((v, i) => [x(i), yLat(v)]));
  const areaPath = memPath + " L " + x(samples.length - 1).toFixed(1) + " " + (H - padB) + " L " + x(0).toFixed(1) + " " + (H - padB) + " Z";

  const anomalyIdx = state.anomaly ? Math.min(samples.length - 1, state.anomaly.index) : -1;
  const anomalyEnd = anomalyIdx >= 0 ? Math.min(samples.length - 1, anomalyIdx + 4) : -1;
  const delta = anomalyIdx > 0 ? mem[anomalyIdx] - mem[anomalyIdx - 1] : 0;
  const activeN = state.turns[state.active] ? state.turns[state.active].n : 0;
  let activeIdx = 0;
  samples.forEach((s, i) => { if ((s.turnNumber || 0) <= activeN) activeIdx = i; });

  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const value = Math.round(maxMem * f);
    const y = yMem(value);
    return '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="rgba(255,255,255,.055)"/>' +
      '<text x="' + (padL - 8) + '" y="' + (y + 3).toFixed(1) + '" text-anchor="end" class="pg-chart__axis">' + value + "</text>";
  }).join("");
  const right = [0, 0.5, 1].map((f) => {
    const value = Math.round(maxLat * f);
    return '<text x="' + (W - padR + 8) + '" y="' + (yLat(value) + 3).toFixed(1) + '" text-anchor="start" class="pg-chart__axis">' + value + "</text>";
  }).join("");

  const region = anomalyIdx >= 0
    ? '<rect x="' + x(anomalyIdx).toFixed(1) + '" y="' + padT + '" width="' + Math.max(0, x(anomalyEnd) - x(anomalyIdx)).toFixed(1) + '" height="' + (H - padT - padB) + '" fill="rgba(255,122,107,.06)"/>' +
      '<line x1="' + x(anomalyIdx).toFixed(1) + '" x2="' + x(anomalyIdx).toFixed(1) + '" y1="' + padT + '" y2="' + (H - padB) + '" stroke="rgba(255,122,107,.3)" stroke-dasharray="3 5"/>'
    : "";

  const leader = anomalyIdx > 0
    ? '<line x1="' + x(anomalyIdx).toFixed(1) + '" y1="' + yMem(mem[anomalyIdx]).toFixed(1) + '" x2="' + (x(anomalyIdx) + 14).toFixed(1) + '" y2="' + (padT + 18) + '" stroke="rgba(255,122,107,.55)"/>' +
      '<text x="' + (x(anomalyIdx) + 18).toFixed(1) + '" y="' + (padT + 14) + '" class="pg-chart__anomaly-label">+' + delta + " MB / sample</text>"
    : "";

  return '<div class="pg-chart__legend">' +
    '<span><i class="pg-chart__swatch pg-chart__swatch--mem"></i>rss (MB)</span>' +
    '<span><i class="pg-chart__swatch pg-chart__swatch--lat"></i>p95 (ms)</span>' +
    '<span><i class="pg-chart__swatch pg-chart__swatch--threshold"></i>threshold</span>' +
    "</div>" +
    '<svg viewBox="0 0 ' + W + " " + H + '" class="pg-chart__svg" role="img" aria-label="Memory and p95 latency across ' + samples.length + ' recorded samples">' +
    '<defs><linearGradient id="pg-mem-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ff7a6b" stop-opacity=".26"/><stop offset="100%" stop-color="#ff7a6b" stop-opacity="0"/></linearGradient>' +
    '<linearGradient id="pg-lat-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#67e8f9" stop-opacity=".12"/><stop offset="100%" stop-color="#67e8f9" stop-opacity="0"/></linearGradient></defs>' +
    region + grid + right +
    '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + yMem(threshold).toFixed(1) + '" y2="' + yMem(threshold).toFixed(1) + '" stroke="rgba(255,122,107,.5)" stroke-dasharray="4 5"/>' +
    '<text x="' + (W - padR) + '" y="' + (yMem(threshold) - 6).toFixed(1) + '" text-anchor="end" class="pg-chart__threshold">threshold ' + threshold + " MB</text>" +
    '<path d="' + areaPath + '" fill="url(#pg-mem-fill)"/>' +
    '<path d="' + latPath + '" fill="none" stroke="#67e8f9" stroke-width="1.4" stroke-opacity=".65" stroke-linecap="round"/>' +
    '<path d="' + memPath + '" fill="none" stroke="#ff7a6b" stroke-width="2.2" stroke-linecap="round"/>' +
    '<line x1="' + x(activeIdx).toFixed(1) + '" x2="' + x(activeIdx).toFixed(1) + '" y1="' + padT + '" y2="' + (H - padB) + '" stroke="rgba(182,168,255,.7)" stroke-dasharray="3 4"/>' +
    '<text x="' + (x(activeIdx) + 5).toFixed(1) + '" y="' + (padT + 10) + '" class="pg-chart__active-label">t' + activeN + "</text>" +
    leader +
    '<g id="chartHover"></g>' +
    '<rect id="chartHit" x="' + padL + '" y="' + padT + '" width="' + (W - padL - padR) + '" height="' + (H - padT - padB) + '" fill="transparent" style="cursor:crosshair"/>' +
    "</svg>";
}

function bindChart() {
  const hit = $("chartHit");
  const layer = $("chartHover");
  if (!hit || !layer) return;
  const W = 560, H = 250, padL = 44, padR = 46, padT = 30, padB = 30;
  const samples = state.samples;
  const mem = samples.map((s) => Math.round(((s.metrics || {}).rss || 0) / 1048576));
  const lat = samples.map((s) => Math.round((s.metrics || {}).latencyMs || 0));
  const maxMem = Math.max(400, Math.max.apply(null, mem)) * 1.02;
  const maxLat = Math.max(300, Math.max.apply(null, lat)) * 1.08;
  const x = (i) => padL + (i / Math.max(1, samples.length - 1)) * (W - padL - padR);
  const yMem = (v) => H - padB - (v / maxMem) * (H - padT - padB);
  const yLat = (v) => H - padB - (v / maxLat) * (H - padT - padB);

  const indexAt = (event) => {
    const rect = hit.ownerSVGElement.getBoundingClientRect();
    const local = ((event.clientX - rect.left) / rect.width) * W;
    const ratio = (local - padL) / (W - padL - padR);
    return Math.max(0, Math.min(samples.length - 1, Math.round(ratio * (samples.length - 1))));
  };

  hit.addEventListener("pointermove", (event) => {
    const i = indexAt(event);
    const s = samples[i];
    const tooltipW = 156;
    const tx = Math.min(W - tooltipW - 6, Math.max(6, x(i) - tooltipW / 2));
    const metrics = s.metrics || {};
    layer.innerHTML =
      '<line x1="' + x(i).toFixed(1) + '" x2="' + x(i).toFixed(1) + '" y1="' + padT + '" y2="' + (H - padB) + '" stroke="rgba(237,239,245,.35)"/>' +
      '<circle cx="' + x(i).toFixed(1) + '" cy="' + yMem(mem[i]).toFixed(1) + '" r="3.2" fill="#ff7a6b" stroke="#05060a" stroke-width="1.2"/>' +
      '<circle cx="' + x(i).toFixed(1) + '" cy="' + yLat(lat[i]).toFixed(1) + '" r="2.6" fill="#67e8f9" stroke="#05060a" stroke-width="1"/>' +
      '<g transform="translate(' + tx.toFixed(1) + ',' + (padT + 4) + ')">' +
      '<rect width="' + tooltipW + '" height="52" rx="6" fill="rgba(11,13,20,.96)" stroke="rgba(255,255,255,.14)"/>' +
      '<text x="9" y="17" class="pg-chart__tip-strong">t' + (s.turnNumber || 0) + " · " + mem[i] + " MB</text>" +
      '<text x="9" y="33" class="pg-chart__tip">' + lat[i] + " ms p95 · " + Math.round(metrics.cpu || 0) + "% cpu</text>" +
      '<text x="9" y="46" class="pg-chart__tip">' + (metrics.errors || 0) + " errors</text></g>";
  });
  hit.addEventListener("pointerleave", () => { layer.innerHTML = ""; });
  hit.addEventListener("click", (event) => {
    const s = samples[indexAt(event)];
    const idx = state.turns.findIndex((t) => t.n === (s.turnNumber || 0));
    if (idx >= 0) selectTurn(idx);
  });
}

function renderAutopsy() {
  const turn = state.turns[state.active] || null;
  const anomaly = state.anomaly;
  const healed = false;
  const stateLabel = anomaly ? "regression" : turn && state.samples.length ? "no anomaly" : "waiting";
  const stateIcon = anomaly ? ICON.warning : turn && state.samples.length ? ICON.check : ICON.warning;
  let html = '<div class="pg-autopsy__head"><span class="pg-label">Autopsy</span>' +
    '<span class="pg-autopsy__state" data-healed="' + (anomaly ? "false" : "true") + '">' + stateIcon + stateLabel + "</span></div>";

  if (!turn) {
    html += '<div class="pg-verdict"><div class="pg-verdict__main"><strong>—</strong><div>' +
      '<span class="pg-verdict__file">recording — no turn data yet</span>' +
      '<span class="pg-verdict__kind">the tape is armed; the first burst of file edits opens turn 1.</span>' +
      "</div></div></div>";
  } else if (anomaly) {
    const blame = state.turns.find((t) => t.n === anomaly.turn);
    const file = state.blamedPath || (blame && blame.files[0]) || "files captured per checkpoint";
    const patch = blame && blame.sha
      ? (state.demo
        ? '<button type="button" id="viewPatch">' + ICON.file + "View patch</button>"
        : '<a href="/diff/' + encodeURIComponent(blame.sha) + '" target="_blank">' + ICON.file + "View patch</a>")
      : "";
    html += '<div class="pg-verdict" data-healed="false"><div class="pg-verdict__top">' +
      '<span class="pg-label">Blamed turn</span><span class="pg-verdict__delta">' + anomaly.kind + " over threshold</span></div>" +
      '<div class="pg-verdict__main"><strong>t' + anomaly.turn + "</strong><div>" +
      '<span class="pg-verdict__file">' + esc(file) + "</span>" +
      '<span class="pg-verdict__kind">' + anomaly.kind + " · " + anomaly.severity + " · turn " + anomaly.turn + "</span></div></div>" +
      '<div class="pg-verdict__actions"><button type="button" id="jumpBlame">' + ICON.crosshair + "Jump to blame</button>" + patch + "</div></div>";
  } else if (!state.samples.length) {
    html += '<div class="pg-verdict"><div class="pg-verdict__main"><strong>—</strong><div>' +
      '<span class="pg-verdict__file">runtime monitor waiting</span>' +
      '<span class="pg-verdict__kind">0 samples yet — the engine cannot judge curves it has not seen. point the recorder at your app (--app-url) so health samples arrive.</span>' +
      "</div></div></div>";
  } else {
    html += '<div class="pg-verdict" data-healed="true"><div class="pg-verdict__main"><strong>—</strong><div>' +
      '<span class="pg-verdict__file">no anomaly detected</span>' +
      '<span class="pg-verdict__kind">the recorded samples stayed inside every threshold so far</span>' +
      "</div></div></div>";
  }

  if (state.selected) {
    const tower = state.towers.find((t) => t.path === state.selected);
    const inTurn = turn && turn.files.indexOf(state.selected) >= 0;
    html += '<div class="pg-selected"><div class="pg-selected__top">' +
      '<span class="pg-selected__file">' + ICON.file + esc(state.selected) + "</span>" +
      '<button type="button" id="clearSel" aria-label="Clear selected tower">' + ICON.x + "</button></div>" +
      '<div class="pg-selected__meta"><span>turn ' + (inTurn ? turn.n : "ambient") + "</span>" +
      "<span>" + (tower ? tower.owner : "module") + "</span>" +
      "<span>" + (tower && tower.loc ? tower.loc + " lines" : "no churn") + "</span></div>" +
      (inTurn ? "" : "<p>No file changes for this tower in the selected turn.</p>") + "</div>";
  }

  if (turn) {
    html += '<div class="pg-block"><div class="pg-block__head"><span class="pg-label">Turn t' + turn.n + "</span>" +
      '<span class="pg-block__role">' + (turn.role === "assistant" ? ICON.robot : ICON.user) + turn.role + "</span></div>" +
      '<p class="pg-prompt">' + esc(turn.text) + "</p>" +
      (turn.files.length ? '<div class="pg-files">' + turn.files.map((f) => "<span>" + esc(f) + "</span>").join("") + "</div>" : "") + "</div>";
    html += '<div class="pg-block pg-block--flush"><div class="pg-block__head"><span class="pg-label">Code diff</span>' +
      '<span class="pg-block__count" id="diffCount">' + (turn.sha ? "loading…" : "no patch") + "</span></div>" +
      (turn.sha ? '<details class="pg-details"><summary>checkpoint ' + esc(String(turn.sha).slice(0, 10)) + '</summary><div class="diff" id="diffBody"><pre>loading patch…</pre></div></details>' : '<div class="pg-empty"><p>No patch for this turn — the recorder only stores diffs when git shadow checkpoints exist.</p></div>') + "</div>";
  }

  html += '<div class="pg-block"><div class="pg-block__head"><span class="pg-label">Runtime metrics</span><span class="pg-block__count">' + state.samples.length + " samples</span></div>" + chartSvg(state.samples) + "</div>";

  const fixPrompt = state.anomaly
    ? "Add a bounded LRU eviction (e.g. clear or shift when size exceeds a cap) to " + (state.blamedPath || "the hottest module") + " and re-run the memory regression check."
    : "No anomaly detected — nothing to heal yet. Keep recording; the engine drafts the heal prompt if a sample breaches a threshold.";
  html += '<div class="pg-block"><div class="pg-block__head"><span class="pg-label">Fix prompt</span>' +
    (state.anomaly ? '<button type="button" class="copy-btn" id="copyFix" data-copied="false">' + ICON.copy + "<span>Copy</span></button>" : "") +
    '</div><p class="pg-fix">' + esc(fixPrompt) + "</p></div>";
  $("autopsy").innerHTML = html;

  const jump = $("jumpBlame");
  if (jump) jump.onclick = () => { const i = state.turns.findIndex((t) => t.n === (state.anomaly ? state.anomaly.turn : 0)); if (i >= 0) selectTurn(i); state.preset = "blame"; renderAll(); };
  const clear = $("clearSel");
  if (clear) clear.onclick = () => { state.selected = null; renderAll(); };
  const copyFix = $("copyFix");
  if (copyFix) copyFix.onclick = async () => {
    try {
      await navigator.clipboard.writeText(fixPrompt);
      copyFix.dataset.copied = "true";
      copyFix.innerHTML = ICON.check + "<span>Copied</span>";
      setTimeout(() => {
        if (!copyFix.isConnected) return;
        copyFix.dataset.copied = "false";
        copyFix.innerHTML = ICON.copy + "<span>Copy</span>";
      }, 1800);
    } catch {
      copyFix.dataset.copied = "false";
    }
  };
  bindChart();
  const viewPatch = $("viewPatch");
  if (viewPatch) viewPatch.onclick = () => {
    const d = document.querySelector(".pg-details");
    if (d) { d.open = true; d.scrollIntoView({ block: "nearest" }); }
  };
  if (turn && turn.sha) loadDiff(turn.sha);
}

function demoDiff(sha) {
  const cp = ((state.raw && state.raw.checkpoints) || []).find((c) => c.sha === sha);
  if (!cp) return "";
  let out = "";
  for (const f of cp.files || []) {
    out += "+++ b/" + f + "\n@@ -1,6 +1,8 @@\n";
    out += "-  const rows = listInvoices();\n-  return rows.filter((row) => row.owner === owner);\n";
    out += "+  const rows = cache.get(owner) ?? listInvoices(owner);\n+  cache.set(owner, rows);\n+  return rows;\n";
    out += "   // checkpoint " + cp.sha.slice(0, 10) + " · turn " + cp.turnNumber + "\n";
  }
  return out;
}

async function loadDiff(sha) {
  const seq = ++state.seq;
  let text = state.diffCache.get(sha);
  if (text == null) {
    if (state.demo) text = demoDiff(sha);
    else {
      try {
        const res = await fetch("/diff/" + encodeURIComponent(sha));
        text = res.ok ? await res.text() : "";
      } catch (e) { text = ""; }
    }
    state.diffCache.set(sha, text);
  }
  if (seq !== state.seq) return;
  const body = $("diffBody");
  const count = $("diffCount");
  if (!body) return;
  const lines = text.split(/\r?\n/).filter((l) => l && !l.startsWith("diff --git") && !l.startsWith("index "));
  if (count) count.textContent = lines.length ? lines.length + " lines" : "empty";
  body.innerHTML = "<pre>" + lines.slice(0, 220).map((l) => {
    const cls = l.startsWith("+++") || l.startsWith("---") ? "meta" : l.startsWith("+") ? "add" : l.startsWith("-") ? "del" : "meta";
    return '<div class="' + cls + '">' + esc(l) + "</div>";
  }).join("") + "</pre>";
}

function renderDock() {
  const last = Math.max(1, state.turns.length - 1);
  const progress = state.turns.length ? (state.active / last) * 100 : 0;
  $("tc").textContent = timecode(state.turns[state.active]);
  $("dockTurn").textContent = "t" + (state.turns.length ? state.active + 1 : 0) + " / " + state.turns.length;
  $("play").innerHTML = state.playing ? ICON.pause : ICON.play;
  $("play").setAttribute("aria-label", state.playing ? "Pause replay" : "Play replay");
  $("speed").textContent = state.speed + "x";

  const anomalyTurn = state.anomaly ? state.anomaly.turn : null;
  const ticks = state.turns.map((t, i) =>
    '<button type="button" class="pg-dock__tick" data-i="' + i + '" style="left:' + ((i / last) * 100).toFixed(2) + '%" data-active="' + (i === state.active) + '" aria-label="Go to turn ' + t.n + '"><span></span></button>'
  ).join("");
  const anomaly = anomalyTurn != null
    ? '<span class="pg-dock__anomaly" style="left:' + ((Math.max(0, state.turns.findIndex((t) => t.n === anomalyTurn)) / last) * 100).toFixed(2) + '%" title="Anomaly on turn ' + anomalyTurn + '"><i></i></span>'
    : "";
  $("track").innerHTML = '<div class="pg-dock__rail"></div>' +
    '<div class="pg-dock__fill" style="width:' + progress.toFixed(2) + '%"></div>' + ticks + anomaly +
    '<span class="pg-dock__playhead" style="left:' + progress.toFixed(2) + '%">' + GHOST(16) + "</span>";
}

// ── interaction ──────────────────────────────────────────────────────────────
function selectTurn(i) {
  if (!state.turns.length) return;
  state.playing = false;
  state.active = clamp(i, 0, state.turns.length - 1);
  state.selected = null;
  renderAll();
  const turn = state.turns[state.active];
  const tower = turn && turn.files.length ? state.towers.find((t) => t.path === turn.files[0]) : null;
  if (tower) flyTo(tower);
}

function togglePlay() {
  if (!state.turns.length) return;
  state.playing = !state.playing;
  if (state.playing && state.active >= state.turns.length - 1) state.active = 0;
  renderAll();
  schedule();
}

function schedule() {
  clearTimeout(timer);
  if (!state.playing) return;
  timer = setTimeout(() => {
    if (!state.playing) return;
    if (state.active >= state.turns.length - 1) { state.playing = false; renderAll(); return; }
    state.active += 1;
    renderAll();
    const turn = state.turns[state.active];
    const tower = turn && turn.files.length ? state.towers.find((t) => t.path === turn.files[0]) : null;
    if (tower) flyTo(tower);
    schedule();
  }, 1800 / state.speed);
}

function bind() {
  $("tape").addEventListener("click", (e) => {
    const b = e.target.closest(".pg-turn");
    if (b) selectTurn(Number(b.dataset.i));
  });
  $("track").addEventListener("click", (e) => {
    const b = e.target.closest(".pg-dock__tick");
    if (b) selectTurn(Number(b.dataset.i));
  });
  $("prev").onclick = () => { state.playing = false; selectTurn(state.active - 1); };
  $("next").onclick = () => { state.playing = false; selectTurn(state.active + 1); };
  $("play").onclick = togglePlay;
  $("speed").onclick = () => { state.speed = state.speed === 0.5 ? 1 : state.speed === 1 ? 2 : 0.5; renderAll(); };
  $("btnReload").onclick = () => { state.first = true; tick(); };
  $("btnDemo").onclick = () => {
    state.demo = !state.demo;
    state.playing = false;
    if (state.demo) { apply(demoRaw()); }
    else { state.first = true; state.raw = null; state.rawSig = null; tick(); }
    renderAll();
  };
  document.querySelectorAll("[data-tab]").forEach((b) => {
    b.onclick = () => {
      $("shell").setAttribute("data-mobile", b.dataset.tab);
      document.querySelectorAll("[data-tab]").forEach((x) => x.setAttribute("data-active", x.dataset.tab === b.dataset.tab ? "true" : "false"));
    };
  });
  document.querySelectorAll("[data-preset]").forEach((b) => {
    b.onclick = () => {
      state.preset = b.dataset.preset;
      if (state.preset === "blame" && state.anomaly) {
        const i = state.turns.findIndex((t) => t.n === state.anomaly.turn);
        if (i >= 0) { state.active = i; state.selected = state.blamedPath; }
      }
      renderAll();
      if (state.preset === "blame") { const t = state.towers.find((x) => x.path === state.selected) || (state.anomaly && state.towers.find((x) => x.path === state.blamedPath)); if (t) flyTo(t, true); }
      else flyTo({ x: 0, z: 0, h: 4 }, false);
    };
  });
  addEventListener("keydown", (e) => {
    const tag = (e.target && e.target.tagName) || "";
    if (["INPUT", "TEXTAREA", "SELECT"].indexOf(tag) >= 0) return;
    if (e.code === "Space") { e.preventDefault(); togglePlay(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); state.playing = false; selectTurn(state.active + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); state.playing = false; selectTurn(state.active - 1); }
  });
}

// ── three.js ─────────────────────────────────────────────────────────────────
let THREE = null, OrbitControls = null, renderer = null, scene = null, camera = null, controls = null;
let group = null, towerMeshes = [], beam = null, raycaster = null, pointer = null;
let threeReady = false, winTex = null, auraTex = null, flying = null;
const clock = { t: 0 };

function makeWindowTexture() {
  const c = document.createElement("canvas");
  c.width = 64; c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "#000"; g.fillRect(0, 0, 64, 128);
  for (let y = 6; y < 122; y += 11) {
    for (let x = 5; x < 60; x += 9) {
      if (Math.random() < 0.55) {
        g.fillStyle = "rgba(200,190,255," + (0.35 + Math.random() * 0.6).toFixed(2) + ")";
        g.fillRect(x, y, 5, 5);
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeAuraTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(64, 64, 2, 64, 64, 62);
  grd.addColorStop(0, "rgba(255,122,107,.85)");
  grd.addColorStop(0.5, "rgba(255,122,107,.24)");
  grd.addColorStop(1, "rgba(255,122,107,0)");
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

async function initThree() {
  THREE = await import("three");
  ({ OrbitControls } = await import("three/addons/controls/OrbitControls.js"));
  const canvas = $("gl");
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05060a, 0.011);
  camera = new THREE.PerspectiveCamera(38, 1, 0.1, 240);
  camera.position.set(22, 18, 32);
  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.07;
  controls.autoRotate = true; controls.autoRotateSpeed = 0.35;
  controls.minDistance = 7; controls.maxDistance = 95;
  controls.maxPolarAngle = Math.PI / 2.05;
  controls.target.set(0, 2, 0);

  scene.add(new THREE.AmbientLight(0x8f96c8, 0.9));
  const key = new THREE.PointLight(0xcbd5ff, 24, 80, 2); key.position.set(0, 20, 12); scene.add(key);
  const violet = new THREE.PointLight(0x8b7cff, 18, 70, 2); violet.position.set(-18, 9, -12); scene.add(violet);
  const cyan = new THREE.PointLight(0x67e8f9, 10, 60, 2); cyan.position.set(16, 6, -16); scene.add(cyan);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 220),
    new THREE.MeshStandardMaterial({ color: 0x06070d, roughness: 0.95, metalness: 0.15 })
  );
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.03; scene.add(ground);
  const grid = new THREE.GridHelper(140, 92, 0x3d2f7a, 0x1b1938);
  grid.material.transparent = true; grid.material.opacity = 0.55; grid.position.y = 0.002; scene.add(grid);

  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeAuraTexture(), color: 0x8b7cff, transparent: true, opacity: 0.22, depthWrite: false }));
  glow.scale.set(70, 70, 1); glow.position.y = 0.05; scene.add(glow);

  group = new THREE.Group(); scene.add(group);
  raycaster = new THREE.Raycaster(); pointer = new THREE.Vector2();
  winTex = makeWindowTexture(); auraTex = makeAuraTexture();
  threeReady = true;

  const resize = () => {
    const box = canvas.parentElement;
    const w = Math.max(1, box.clientWidth), h = Math.max(1, box.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  resize();
  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas.parentElement);
  addEventListener("resize", resize);

  let down = null;
  canvas.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener("pointermove", (e) => {
    const hit = pick(e);
    const tip = $("tip");
    if (hit) {
      const t = hit.userData.tower;
      $("city").setAttribute("data-hovered", "true");
      tip.style.display = "block";
      tip.style.left = Math.min(e.clientX + 14, innerWidth - 300) + "px";
      tip.style.top = (e.clientY + 14) + "px";
      tip.innerHTML = '<span class="pg-city-tip__path">' + esc(t.path) + "</span>" +
        '<span class="pg-city-tip__meta">turn t' + t.turn + " · " + (t.git ? "churn " + t.loc + " lines" : "touched · no patch") + "</span>" +
        (t.path === state.blamedPath ? '<span class="pg-city-tip__delta">blamed · anomaly</span>' : "");
    } else {
      $("city").setAttribute("data-hovered", "false");
      tip.style.display = "none";
    }
  });
  canvas.addEventListener("pointerleave", () => { $("tip").style.display = "none"; });
  canvas.addEventListener("click", (e) => {
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
    const hit = pick(e);
    if (hit) selectTower(hit.userData.tower);
    else { state.selected = null; renderAll(); }
  });

  animate();
  buildScene();
  if (!state.camInit && state.towers.length) {
    state.camInit = true;
    flyTo({ x: 0, z: 0, h: 4 }, false);
  }
}

function overviewDist() {
  const ext = state.towers.length
    ? Math.max(...state.towers.map((t) => Math.max(Math.abs(t.x), Math.abs(t.z))))
    : 12;
  return clamp(ext * 3.0 + 20, 44, 100);
}

function pick(e) {
  if (!threeReady) return null;
  const r = renderer.domElement.getBoundingClientRect();
  pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObjects(towerMeshes, false)[0]?.object || null;
}

function disposeGroup() {
  group.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      if (o.material.emissiveMap && o.material.emissiveMap !== winTex) o.material.emissiveMap.dispose();
      o.material.dispose();
    }
  });
  group.clear();
  towerMeshes = [];
  beam = null;
}

function buildScene() {
  if (!threeReady) return;
  disposeGroup();
  for (const t of state.towers) addTower(t);
  if (state.demo) addAmbient();
  updateSelection();
  $("cityEmpty").style.display = state.towers.length ? "none" : "flex";
}

function addTower(t) {
  const hot = t.path === state.blamedPath;
  const geo = new THREE.BoxGeometry(t.w, t.h, t.d);
  geo.translate(0, t.h / 2, 0);
  const tex = winTex.clone();
  tex.needsUpdate = true;
  tex.repeat.set(Math.max(1, Math.round(t.w * 2)), Math.max(2, Math.round(t.h * 1.1)));
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(hot ? 0.015 : 0.7, hot ? 0.6 : 0.45, hot ? 0.42 : 0.32),
    emissive: new THREE.Color().setHSL(hot ? 0.015 : 0.7, 0.85, hot ? 0.3 : 0.16),
    emissiveMap: tex,
    emissiveIntensity: 1,
    roughness: 0.38,
    metalness: 0.4,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(t.x, 0, t.z);
  mesh.userData.tower = t;
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color: hot ? 0xff7a6b : 0x67e8f9, transparent: true, opacity: hot ? 0.55 : 0.22 })
  );
  mesh.add(edges);
  if (hot) {
    const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: auraTex, color: 0xff7a6b, transparent: true, opacity: 0.5, depthWrite: false }));
    aura.scale.set(4, 4, 1); aura.position.set(0, t.h * 0.55, 0); mesh.add(aura);
  }
  group.add(mesh);
  towerMeshes.push(mesh);
  t._mesh = mesh;
}

function addAmbient() {
  const spacing = 3.05, cols = 12, rows = 10;
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 46; i += 1) {
    const col = Math.floor(rnd() * cols), row = Math.floor(rnd() * rows);
    const x = (col - (cols - 1) / 2) * spacing + (rnd() - 0.5) * 1.2;
    const z = (row - (rows - 1) / 2) * spacing + (rnd() - 0.5) * 1.2;
    if (state.towers.some((t) => Math.hypot(t.x - x, t.z - z) < 1.6)) continue;
    const h = 0.8 + rnd() * 3.4;
    const geo = new THREE.BoxGeometry(1 + rnd() * 1.2, h, 1 + rnd() * 1.2);
    geo.translate(0, h / 2, 0);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: 0x121427, emissive: 0x2a2450, emissiveIntensity: 0.5, roughness: 0.8, metalness: 0.2,
    }));
    mesh.position.set(x, 0, z);
    mesh.userData.ambient = true;
    group.add(mesh);
  }
}

function selectTower(t) {
  state.selected = t.path;
  state.preset = "blame";
  if (innerWidth <= 900) {
    $("shell").setAttribute("data-mobile", "autopsy");
    document.querySelectorAll("[data-tab]").forEach((x) => x.setAttribute("data-active", x.dataset.tab === "autopsy" ? "true" : "false"));
  }
  renderAll();
  flyTo(t, true);
}

function updateSelection() {
  if (!threeReady) return;
  for (const mesh of towerMeshes) {
    const t = mesh.userData.tower;
    const on = t.path === state.selected;
    const hot = t.path === state.blamedPath;
    mesh.material.emissiveIntensity = on ? 2.4 : hot ? 1.6 : 1;
    const edge = mesh.children[0];
    if (edge && edge.material) edge.material.opacity = on ? 0.85 : hot ? 0.55 : 0.22;
  }
  if (beam) { group.remove(beam); beam.geometry.dispose(); beam.material.dispose(); beam = null; }
  const sel = state.towers.find((t) => t.path === state.selected);
  if (sel && sel._mesh) {
    const h = 26;
    beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, h, 6, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xb6a8ff, transparent: true, opacity: 0.3, depthWrite: false })
    );
    beam.position.set(sel.x, h / 2, sel.z);
    group.add(beam);
  }
}

function flyTo(t, close) {
  if (!threeReady) return;
  const target = new THREE.Vector3(t.x || 0, close ? Math.min(6, (t.h || 4) * 0.6) : 2, t.z || 0);
  const dist = close ? 14 : overviewDist();
  const pos = new THREE.Vector3((t.x || 0) + dist * 0.55, dist * 0.62, (t.z || 0) + dist * 0.8);
  const fromPos = camera.position.clone();
  const fromTarget = controls.target.clone();
  const start = performance.now();
  controls.autoRotate = false;
  flying = () => {
    const k = Math.min(1, (performance.now() - start) / 700);
    const e = 1 - Math.pow(1 - k, 3);
    camera.position.lerpVectors(fromPos, pos, e);
    controls.target.lerpVectors(fromTarget, target, e);
    if (k >= 1) { flying = null; controls.autoRotate = state.preset === "overview"; }
  };
}

function animate() {
  requestAnimationFrame(animate);
  if (!threeReady) return;
  clock.t += 0.016;
  if (flying) flying();
  controls.update();
  if (beam) beam.material.opacity = 0.18 + Math.sin(clock.t * 2.2) * 0.1;
  for (const mesh of towerMeshes) {
    if (mesh.userData.tower && mesh.userData.tower.path === state.blamedPath) {
      const pulse = 0.9 + Math.sin(clock.t * 3.2) * 0.35;
      mesh.material.emissiveIntensity = Math.max(mesh.material.emissiveIntensity, pulse * 1.3);
    }
  }
  renderer.render(scene, camera);
}

// ── live loop ────────────────────────────────────────────────────────────────
async function tick() {
  if (state.demo) return;
  try {
    const res = await fetch("/session", { cache: "no-store" });
    if (!res.ok) throw new Error("bad status");
    const raw = await res.json();
    const sig = JSON.stringify(raw);
    if (sig !== state.rawSig) { state.rawSig = sig; apply(raw); }
  } catch (e) {
    $("liveChip").setAttribute("data-on", "false");
    $("liveText").textContent = "reconnecting";
  }
}

async function boot() {
  bind();
  renderAll();
  const params = new URLSearchParams(location.search);
  if (params.get("demo") === "1") { state.demo = true; apply(demoRaw()); }
  try {
    await initThree();
  } catch (e) {
    threeReady = false;
    $("cityEmpty").style.display = "flex";
    $("cityEmpty").innerHTML = GHOST(34, "ghost-mark--glow") +
      "<h3>3D engine unavailable</h3><p>three.js could not load from the CDN (offline?). the zero-dependency 2D city still works: <a href=\"/city2d\" style=\"color:var(--cyan)\">/city2d</a></p>";
  }
  tick();
  setInterval(tick, 1600);
}

boot();
