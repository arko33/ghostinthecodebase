#!/usr/bin/env node
// Ghost — local recorder & CLI.
// Commands: setup · connect opencode · watch · status · sessions · pair-status
// Philosophy: recording works with zero accounts (Mode B/C); sync is opt-in.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as shadow from "./lib/shadowgit.mjs";
import * as store from "./lib/store.mjs";
import { createProbes } from "./lib/probes.mjs";

const ROOT = process.cwd();
const GHOST_DIR = path.join(ROOT, ".ghost");
const DEFAULT_RECORDER_PORT = 5417;

// ── Ghost Studio (served by the recorder on 127.0.0.1:<port>) ────────────────
// Zero-dependency live view of the session being recorded: repo, turns,
// checkpoints (files + diff refs), runtime samples. Data source: GET /session.
function studioHtml(base) {
  return `<!doctype html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Ghost Studio — live recording</title>
<style>
  :root{--bg:#040a08;--fg:#e8f0ee;--dim:#9fb5af;--line:rgba(255,255,255,.09);--hot:#ff7a6b;--cold:#5eead4;--card:rgba(255,255,255,.04)}
  *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.55 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
  .wrap{max-width:860px;margin:0 auto;padding:28px 20px 60px}
  .top{display:flex;align-items:center;gap:10px;margin-bottom:6px}
  .dot{width:8px;height:8px;border-radius:50%;background:var(--cold);box-shadow:0 0 8px var(--cold);animation:pulse 2s infinite}
  @keyframes pulse{50%{opacity:.35}}
  h1{font-size:17px;margin:0;letter-spacing:.02em}
  sub{color:var(--dim);display:block;margin:10px 0 22px}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin-bottom:26px}
  .stat{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px}
  .stat b{display:block;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .stat i{font-style:normal;color:var(--dim);font-size:11px;letter-spacing:.08em;text-transform:uppercase}
  h2{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);margin:26px 0 10px}
  .empty{color:var(--dim);padding:14px;border:1px dashed var(--line);border-radius:10px}
  ul{list-style:none;margin:0;padding:0}
  .turn{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:11px 14px;margin-bottom:8px}
  .turn b{color:var(--dim);margin-right:8px}
  .est{display:inline-block;font-size:10px;color:var(--hot);border:1px solid var(--hot);border-radius:99px;padding:0 7px;margin-right:8px}
  .file{display:block;color:var(--cold);font-size:12px;margin-top:4px;word-break:break-all}
  .prompt{white-space:pre-wrap;word-break:break-word}
  table{width:100%;border-collapse:collapse;font-size:12px}
  td,th{border-bottom:1px solid var(--line);padding:6px 8px;text-align:right}
  td:first-child,th:first-child{text-align:left}
  th{color:var(--dim);font-weight:400;letter-spacing:.08em;text-transform:uppercase;font-size:10px}
  .hotm{color:var(--hot)}
  footer{margin-top:28px;color:var(--dim);font-size:11px;line-height:1.8}
  a{color:var(--cold)}
</style></head><body><div class="wrap">
<div class="top"><span class="dot"></span><h1>Ghost Studio — recording live</h1></div>
<sub>same host as your recorder · loopback only · data stays in this machine</sub>
<div class="grid">
  <div class="stat"><i>repo</i><b id="repo">…</b></div>
  <div class="stat"><i>session</i><b id="sid">…</b></div>
  <div class="stat"><i>git head</i><b id="head">…</b></div>
  <div class="stat"><i>app</i><b id="app">…</b></div>
</div>
<h2>Turns <span id="tcount"></span></h2><ul id="turns"></ul>
<h2>Checkpoints — shadow commits</h2><div id="cps"></div>
<h2>Runtime samples</h2><div id="samples"></div>
<footer>Recorder keeps saving to <span id="dref">.ghost/sessions/…</span> · Ctrl+C stops &amp; saves ·<br/>
locals: <a href="/session">/session</a> (JSON) · events target for the OpenCode adapter: <a href="#">${base}/events</a></footer>
</div><script>
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
async function tick(){
  try{const s=await(top?0:0,0)||await fetch("/session").then(r=>r.json());
  repo.textContent=s.repo;sid.textContent=s.id;head.textContent=s.head?s.head.slice(0,10):"(no git)";app.textContent=s.appUrl;
  dref.textContent=".ghost/sessions/"+s.id+"/";
  tcount.textContent="("+(s.turns??.length)+" recorded)";
  turns.innerHTML=(s.turns??[]).map(t=>"<li class='turn'><b>t"+t.index+"</b>"+(t.estimated?"<span class='est'>estimated</span>":"")+
    "<span class='prompt'>"+esc(t.prompt??(t.id?"[assistant turn — "+t.id+"]":"[no prompt captured]"))+"</span>"+
    (t.files??[]).slice(0,8).map(f=>"<span class='file'>"+esc(f)+"</span>").join("")+
    (t.startedAt?" <span style='color:var(--dim);font-size:11px'>"+new Date(t.startedAt).toLocaleTimeString()+"</span>":"")+"</li>").join("")||"<div class='empty'>No turns yet — make an edit or let your agent work; turn 1 shows within ~1s.</div>";
  cps.innerHTML=(s.checkpoints??[]).map(c=>"<div class='turn'><b>"+c.sha.slice(0,10)+"</b> <span style='color:var(--dim);font-size:11px'>turn "+c.turnNumber+" · "+new Date(c.ts).toLocaleTimeString()+"</span>"+(c.files??[]).map(f=>"<span class='file'>"+esc(f)+"</span>").join("")+"</div>").join("")||"<div class='empty'>No checkpoints yet — a burst of file changes tips them out.</div>";
  const sm=s.samples??[];
  samples.innerHTML=sm.length?"<table><tr><th>ts</th><th>turn</th><th>rss</th><th>cpu</th><th>state</th></tr>"+
    sm.slice(-12).map(x=>"<tr><td>"+esc(x.ts?.slice(11,19))+"</td><td>t"+x.turnNumber+"</td><td>"+(x.metrics?.rss??"—")+"</td><td>"+(x.metrics?.cpu??"—")+"</td><td>"+(x.probeFailed?"<span class='hotm'>probe failed</span>":"ok")+"</td></tr>").join("")+
    "</table><div class='empty'>"+sm.length+" samples counted · saved with the session"+"</div>"
    :"<div class='empty'>No samples yet — is your app running? the recorder probes "+esc(s.appUrl||"http://localhost:3000")+".</div>";
  }catch(e){document.title="ghost studio…retrying"}}
tick();setInterval(tick,2000);
</script></body></html>`;
}

// ── helpers ──────────────────────────────────────────────────────────────────
// Parse a unified diff into per-file churn (added+deleted lines) used as the
// 3D city "height" — so towers stay a fact of the recording, never invented.
function parseDiffChurn(diffText) {
  const churn = {};
  let current = null;
  for (const line of String(diffText).split(/\r?\n/)) {
    const m = /^\+\+\+ b\/(.+)$/.exec(line);
    if (m) { current = m[1]; if (!churn[current]) churn[current] = 0; continue; }
    if (line.startsWith("diff --git ")) { current = null; continue; }
    if (current && (line.startsWith("+") || line.startsWith("-")) && !line.startsWith("+++") && !line.startsWith("---")) churn[current] += 1;
  }
  return churn;
}
const readConfig = () => {
  try { return JSON.parse(fs.readFileSync(path.join(GHOST_DIR, "config.json"), "utf8")); }
  catch { return { cloudUrl: "https://ghostinthecodebase.vercel.app", sync: "off", recorderPort: DEFAULT_RECORDER_PORT }; }
};
const writeConfig = (c) => { fs.mkdirSync(GHOST_DIR, { recursive: true }); fs.writeFileSync(path.join(GHOST_DIR, "config.json"), JSON.stringify(c, null, 2)); };
const readCreds = () => { try { return JSON.parse(fs.readFileSync(path.join(GHOST_DIR, "credentials.json"), "utf8")); } catch { return null; } };
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── ghost setup (device pairing → Cloud) ─────────────────────────────────────
async function cmdSetup() {
  const config = readConfig();
  const base = arg("--cloud", config.cloudUrl || "https://ghostinthecodebase.vercel.app");
  const res = await fetch(`${base}/api/v1/pair`, { method: "POST" });
  if (!res.ok) { console.error(`✗ cloud unreachable (${res.status}) — run local-only, or check GHOST_API_URL`); process.exit(1); }
  const { code, expiresAt } = await res.json();
  const url = `${base}/pair?code=${code}`;
  console.log(`\n  Pair your device with Ghost Cloud`);
  console.log(`  1) Open:  ${url}`);
  console.log(`  2) Sign in with GitHub and confirm the code: ${code}`);
  console.log(`  3) This window is waiting (${expiresAt ?? "10 min"} window)...\n`);
  tryOpenBrowser(url);
  // poll until bound
  for (let i = 0; i < 180; i++) {
    await sleep(2000);
    const r = await fetch(`${base}/api/v1/pair?code=${code}`);
    if (r.ok) {
      const st = await r.json();
      if (st.status === "bound") {
        fs.mkdirSync(GHOST_DIR, { recursive: true });
        const creds = readCreds() || {};
        fs.writeFileSync(path.join(GHOST_DIR, "credentials.json"), JSON.stringify({ deviceToken: st.deviceToken, cloudUrl: base }, null, 2));
        writeConfig({ ...config, cloudUrl: base, sync: config.sync === "off" ? "on" : config.sync });
        console.log(`  ✓ Device paired — token stored in .ghost/credentials.json (never commit it)`);
        console.log(`  ✓ Sync is now ON (policy: metadata+metrics+summaries; source code never)`);
        return;
      }
    }
  }
  console.error("  ✗ Timed out waiting for pairing confirmation");
  process.exit(1);
}

function tryOpenBrowser(url) {
  try {
    if (process.platform === "win32") spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
    else spawn(process.platform === "darwin" ? "open" : "xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
  } catch {}
}

// ── ghost connect opencode ───────────────────────────────────────────────────
function cmdConnectOpencode() {
  const src = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "opencode-plugin", "index.ts");
  const dest = path.join(ROOT, ".opencode", "plugins", "ghost");
  fs.mkdirSync(dest, { recursive: true });
  fs.copyFileSync(src, path.join(dest, "index.ts"));
  writeConfig({ ...readConfig(), recorderPort: DEFAULT_RECORDER_PORT });
  console.log(`  ✓ OpenCode adapter installed at .opencode/plugins/ghost/index.ts`);
  console.log(`    (OpenCode auto-loads it next session; recording also works WITHOUT it — Mode B/C)`);
}

// ── recorder core ────────────────────────────────────────────────────────────
async function cmdWatch() {
  const repo = path.resolve(arg("--repo", ROOT));
  const appUrl = arg("--app-url", `http://localhost:${arg("--port", "3000")}`);
  const healthPath = arg("--health-path", store.DEFAULT_HEALTH_PATH ?? "/api/health");
  const config = readConfig();
  const creds = readCreds();
  const sync = arg("--sync", config.sync && creds ? config.sync : "off");

  const session = store.newSession({ repo, appUrl, sync });
  session.head = shadow.currentHead(repo);

  // active turn tracking
  let turnNumber = 0;
  const currentTurn = () => turnNumber;
  const startTurn = (data = {}) => {
    turnNumber += 1;
    session.turns.push({
      index: turnNumber,
      id: data.turnId ?? null,
      estimated: !data.turnId,
      agent: data.agent ?? null,
      prompt: data.prompt ? store.scrub(String(data.prompt)).slice(0, 2000) : undefined,
      startedAt: data.ts ?? new Date().toISOString(),
      endedAt: null,
      files: [],
    });
    return session.turns[session.turns.length - 1];
  };
  const activeTurn = () => session.turns.find((t) => t.index === turnNumber) ?? null;

  // Mode C — runtime monitor
  const probes = createProbes({ url: appUrl.replace(/\/$/, "") + healthPath, intervalMs: 4000 });
  probes.sink = (sample) => session.samples.push({ ts: sample.ts, turnNumber: currentTurn(), metrics: sample.metrics, probeFailed: sample.probeFailed });
  if (!arg("--no-probes", false)) probes.start();

  // Mode A/B — event receiver for the OpenCode adapter (loopback only)
  const port = Number(arg("--recorder-port", config.recorderPort || DEFAULT_RECORDER_PORT));
  const eventsBase = `http://127.0.0.1:${port}`;
  const emitter = http.createServer((req, res) => {
    if (req.method === "GET" && (req.url === "/" || req.url === "/studio")) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(studioHtml(eventsBase));
      return;
    }
    if (req.method === "GET" && req.url === "/session") {
      res.writeHead(200, {
        "content-type": "application/json; charset=utf-8",
        "access-control-allow-origin": "*",
      });
      res.end(JSON.stringify(session));
      return;
    }
    if (req.method === "GET" && req.url.startsWith("/diff/")) {
      const name = decodeURIComponent(req.url.slice(6).split("?")[0]);
      const dir = store.sessionDir(ROOT, session);
      try {
        const file = fs.readdirSync(path.join(dir, "diffs")).find((f) => f.startsWith(name));
        if (!file) throw new Error("not found");
        res.writeHead(200, {
          "content-type": "text/plain; charset=utf-8",
          "access-control-allow-origin": "*",
        });
        res.end(fs.readFileSync(path.join(dir, "diffs", file), "utf8"));
      } catch { res.writeHead(404).end(); return; }
      return;
    }
    if (req.method !== "POST" || req.url !== "/events") { res.writeHead(404).end(); return; }
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      res.writeHead(204).end();
      try {
        const { type, data = {}, ts } = JSON.parse(body);
        const stamp = ts ?? new Date().toISOString();
        if (type === "turn.started") startTurn({ ...data, ts: stamp });
        else if (type === "turn.completed") {
          const t = activeTurn();
          if (t) { t.endedAt = stamp; if (data.turnId && !t.id) { t.id = data.turnId; t.estimated = false; } }
          checkpoint(`turn ${turnNumber} completed`);
        } else if (type === "turn.meta") {
          const t = activeTurn();
          if (t) t.files = [...new Set([...(t.files ?? []), ...(data.files ?? [])])];
        }
      } catch { /* malformed event — recorder stays resilient */ }
    });
  });
  await new Promise((r) => emitter.listen(port, "127.0.0.1", r));

  // open Ghost Studio in the default browser (best effort; --no-open to skip)
  if (!arg("--no-open", false)) {
    try {
      if (process.platform === "win32") spawn("cmd", ["/c", "start", "", `${eventsBase}/studio`], { detached: true, stdio: "ignore" }).unref();
      else spawn(process.platform === "darwin" ? "open" : "xdg-open", [`${eventsBase}/studio`], { detached: true, stdio: "ignore" }).unref();
    } catch { /* headless machine — the banner still shows the URL */ }
  }

  // Mode B — filesystem watcher (works with ANY agent, no events needed)
  let burst = null;
  const pendingFiles = new Set();
  const hasGit = !!session.head;
  const isNoise = (p) => p.startsWith(".ghost/") || p === ".ghost";
  const checkpoint = (label, burstFiles = []) => {
    try {
      if (!hasGit) {
        // Non-git project: shadow-git is unavailable, so record the burst as a
        // plain file-list checkpoint (paths are facts; no patch to compute).
        const files = [...new Set(burstFiles)].filter((p) => p && !isNoise(p));
        if (!files.length) return;
        const sha = `nogit-${crypto.createHash("sha1").update(files.join("\n") + Date.now()).digest("hex").slice(0, 12)}`;
        session.checkpoints.push({ ts: new Date().toISOString(), turnNumber: currentTurn(), sha, files });
        const t = activeTurn();
        return;
      }
      const snap = shadow.commitSnapshot(repo, `ghost: ${label}`);
      if (!snap.diff) return;
      // recorder internals (.ghost/*) are bookkeeping, not app files — they
      // must never become towers in the city.
      const changedFiles = snap.changedFiles.filter((p) => !isNoise(p));
      const churnEntries = Object.entries(parseDiffChurn(snap.diff)).filter(([p]) => !isNoise(p));
      if (!changedFiles.length || !churnEntries.length) return;
      const dir = store.sessionDir(ROOT, session);
      fs.mkdirSync(path.join(dir, "diffs"), { recursive: true });
      fs.writeFileSync(path.join(dir, "diffs", `${snap.sha.slice(0, 12)}.patch`), snap.diff);
      session.checkpoints.push({ ts: new Date().toISOString(), turnNumber: currentTurn(), sha: snap.sha, files: changedFiles, diffRef: `${session.id}/diffs/${snap.sha.slice(0, 12)}.patch`, churn: Object.fromEntries(churnEntries) });
      const t = activeTurn(); // attribute checkpoint against the open turn
    } catch (e) { console.error("  ! checkpoint failed:", e.message); }
  };
  let watching;
  try { watching = fs.watch(repo, { recursive: true }, (ev, file) => {
    if (!file) return;
    const p = file.split(path.sep)[0];
    if (["node_modules", ".next", ".git", ".ghost", "out", ".vercel", "testsprite_tests"].includes(p)) return;
    pendingFiles.add(file.split(path.sep).join("/"));
    if (burst) clearTimeout(burst);
    burst = setTimeout(() => {
      burst = null;
      // no open turn? attribute as estimated turn so nothing is lost
      if (!activeTurn()) startTurn({ ts: new Date().toISOString() });
      checkpoint("worktree burst", [...pendingFiles]);
      pendingFiles.clear();
      const t = activeTurn(); if (t && !t.endedAt) t.endedAt = new Date().toISOString();
    }, 900);
  }); } catch { console.error("  ! recursive watch unavailable on this FS — adapter events only"); }

  console.log(`\n  ● Ghost recorder is live`);
  console.log(`    session  ${session.id}`);
  console.log(`    repo     ${repo}`);
  if (!session.head) console.log(`    git      none — file recording only (run git init to enable shadow-git checkpoints)`);
  console.log(`    app      ${appUrl}`);
  console.log(`    studio   ${eventsBase}  ← open in browser: live turns, checkpoints, samples`);
  console.log(`    replay   local dashboard: /playground?live=1 (identical to the published demo)`);
  console.log(`    adapter  ${eventsBase}/events (OpenCode plugin target)`);
  console.log(`    sync     ${sync}${sync === "off" ? "  (local-only) — run: ghost setup to enable" : ""}`);
  console.log(`    press Ctrl+C to stop & save\n`);

  const finalize = async () => {
    probes.stop();
    try { watching?.close(); } catch {}
    if (activeTurn()?.endedAt == null && turnNumber >= 1) activeTurn().endedAt = new Date().toISOString();
    store.endSession(session);
    store.persist(ROOT, session);
    if (sync !== "off") {
      store.queueSync(ROOT, session);
      try {
        const n = await store.flushOutbox(ROOT, { ...config, cloudUrl: (readCreds()?.cloudUrl) || config.cloudUrl, deviceToken: readCreds()?.deviceToken });
        console.log(n ? `  ↥ synced ${n} session(s) to Ghost Cloud` : "");
      } catch (e) { console.log("  (queued for later sync — cloud unreachable)"); }
    }
    console.log(`\n  ✓ saved .ghost/sessions/${session.id}/session.json`);
    console.log(`    replay: open /playground → load session → pick this file\n`);
    process.exit(0);
  };
  process.on("SIGINT", finalize);
  process.on("SIGTERM", finalize);
  // keep alive
  await new Promise(() => {});
}

// ── status & list ────────────────────────────────────────────────────────────
function cmdStatus() {
  const config = readConfig();
  const creds = readCreds();
  const head = shadow.currentHead(ROOT);
  console.log(`repo      ${ROOT}`);
  console.log(`head      ${head ? head.slice(0, 10) : "(no git)"}`);
  if (!head) console.log(`          (not a git repo — run git init to enable shadow-git checkpoints)`);
  console.log(`cloud     ${config.cloudUrl}${creds ? " (paired)" : " (NOT paired)"}`);
  console.log(`sync      ${creds ? config.sync : "off (local-only)"}`);
  console.log(`settings  .ghost/config.json — secrets handled per README policy`);
}
function cmdSessions() {
  const list = store.listSessions(ROOT);
  if (!list.length) { console.log("no sessions yet — run: npm run ghost -- watch"); return; }
  for (const s of list) console.log(`${new Date(s.mtime).toISOString()}  ${s.id}`);
}

// ── entry ────────────────────────────────────────────────────────────────────
const cmd0 = process.argv[2] ?? "help";
const help = () => {
  console.log(`ghost — local recorder for AI coding agents

  node packages/ghost/ghost.mjs setup              pair this machine with Ghost Cloud
  node packages/ghost/ghost.mjs connect opencode   install the OpenCode adapter
  node packages/ghost/ghost.mjs watch [--repo .] [--app-url http://localhost:3000] [--sync on|off]
  node packages/ghost/ghost.mjs status
  node packages/ghost/ghost.mjs sessions`);
};
if (cmd0 === "setup") await cmdSetup();
else if (cmd0 === "connect") { if (process.argv[3] === "opencode") cmdConnectOpencode(); else help(); }
else if (cmd0 === "watch") await cmdWatch();
else if (cmd0 === "status") cmdStatus();
else if (cmd0 === "sessions") cmdSessions();
else help();
