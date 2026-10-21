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
import { cityHtml3d } from "./lib/city.mjs";

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
locals: <a href="/session">/session</a> (JSON) · <a href="/city">city view</a> · events target for the OpenCode adapter: <a href="#">${base}/events</a></footer>
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

// Ghost City — a zero-dependency live playground served by the recorder
// itself, so `ghost watch` works like prisma studio: install once, run it in
// any project, open the URL — no repo clone, no "npm run dev" required.
// Towers are facts of the recording: files actually touched (churn height
// when a git patch exists, flat tiles when not — never invented data).
function cityHtml() {
  return `<!doctype html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Ghost City — live playground</title>
<style>
  :root{--bg:#04100c;--fg:#e8f0ee;--dim:#9fb5af;--line:rgba(255,255,255,.09)}
  *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
  .top{display:flex;align-items:center;gap:10px;padding:14px 20px;border-bottom:1px solid var(--line);flex-wrap:wrap}
  .dot{width:8px;height:8px;border-radius:50%;background:#5eead4;box-shadow:0 0 8px #5eead4;animation:pulse 2s infinite}
  @keyframes pulse{50%{opacity:.35}}
  h1{font-size:15px;margin:0;letter-spacing:.02em}
  .meta{color:var(--dim);font-size:12px}
  .note{color:var(--dim);font-size:11px;padding:8px 20px;border-bottom:1px dashed var(--line)}
  canvas{display:block;width:100%}
  #tip{position:fixed;pointer-events:none;background:#061713;border:1px solid var(--line);border-radius:8px;padding:6px 10px;font-size:11px;display:none;z-index:9;max-width:340px;word-break:break-all}
  footer{color:var(--dim);font-size:11px;padding:16px 20px 40px;line-height:1.8}
  a{color:#5eead4}
</style></head><body>
<div class="top"><span class="dot"></span><h1>Ghost City — recording live</h1><span class="meta" id="meta">…</span></div>
<div class="note" id="note"></div>
<canvas id="c"></canvas>
<div id="tip"></div>
<footer>loopback only (127.0.0.1) — the recorder never leaves this machine · data: <a href="/session">/session</a> · detail view: <a href="/studio">/studio</a><br/>towers = files the agent actually touched this session. with a git patch → height = added+deleted lines (churn). non-git → flat tiles, because there is no patch to measure.</footer>
<script>
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const cv=document.getElementById("c"),ctx=cv.getContext("2d"),tip=document.getElementById("tip"),meta=document.getElementById("meta"),note=document.getElementById("note");
let towers=[],gitMode=true,turnCount=0;
function build(s){
  gitMode=!!s.head;turnCount=(s.turns??[]).length;
  const seen=new Map();
  for(const cp of s.checkpoints??[]){
    for(const f of cp.files??[]){
      const cur=seen.get(f)||{loc:null,turn:cp.turnNumber,ts:cp.ts};
      const loc=(cp.churn||{})[f];
      if(loc!=null)cur.loc=(cur.loc??0)+loc;
      seen.set(f,cur);
    }
  }
  towers=[...seen.entries()].sort((a,b)=>a[1].ts.localeCompare(b[1].ts))
    .map(([p,v])=>({p,...v}));
}
function heightOf(t){return gitMode&&t.loc!=null?Math.min(10+t.loc*1.6,140):(gitMode?10:22)}
function draw(){
  const W=Math.max(560,innerWidth-2);
  const cols=Math.max(1,Math.ceil(Math.sqrt(towers.length)));
  const rows=Math.max(1,Math.ceil(towers.length/cols));
  const T=cols>10?34:46,TH=T*0.56;
  const maxH=towers.length?Math.max(...towers.map(heightOf)):0;
  const H=Math.max(340,rows*TH*2+maxH+130);
  cv.width=W*devicePixelRatio;cv.height=H*devicePixelRatio;cv.style.height=H+"px";
  ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
  ctx.clearRect(0,0,W,H);ctx.fillStyle="#04100c";ctx.fillRect(0,0,W,H);
  const ox=W/2,oy=70+rows*TH;
  const iso=(x,z)=>[(x-z)*T/2+ox,(x+z)*TH/2+oy];
  if(!towers.length){
    ctx.fillStyle="#9fb5af";ctx.font="13px ui-monospace,monospace";
    ctx.fillText("the city is empty — no files touched yet",30,60+rows*TH);
    ctx.fillText("run your agent (OpenCode) in this project; each burst of file",30,84+rows*TH);
    ctx.fillText("edits lays a new tower here. non-git repos show flat tiles.",30,108+rows*TH);
    return;
  }
  ctx.strokeStyle="rgba(255,255,255,.06)";
  for(let z=0;z<rows;z++)for(let x=0;x<cols;x++){
    const[i,j]=iso(x,z);ctx.beginPath();ctx.moveTo(i,j);ctx.lineTo(i+T/2,j+TH/2);
    ctx.lineTo(i,j+TH);ctx.lineTo(i-T/2,j+TH/2);ctx.closePath();ctx.stroke();
  }
  for(let idx=0;idx<towers.length;idx++){
    const t=towers[idx],x=idx%cols,z=Math.floor(idx/cols),h=heightOf(t);
    const[i,j]=iso(x,z),y=j-h;
    const hot=gitMode&&t.loc!=null;
    const l=hot?0.42+Math.min(h,140)/140*0.28:0.5;
    const hue=hot?168-Math.min(h,140)/140*72:205;
    ctx.fillStyle="hsl("+hue+",55%,"+Math.round(l*100)+"%)";
    ctx.beginPath();ctx.moveTo(i,y);ctx.lineTo(i+T/2,y+TH/2);ctx.lineTo(i,y+TH);ctx.lineTo(i-T/2,y+TH/2);ctx.closePath();ctx.fill();
    ctx.fillStyle="hsl("+hue+",45%,"+Math.round(l*70)+"%)";
    ctx.beginPath();ctx.moveTo(i-T/2,y+TH/2);ctx.lineTo(i,y+TH);ctx.lineTo(i,j+TH);ctx.lineTo(i-T/2,j+TH/2);ctx.closePath();ctx.fill();
    ctx.fillStyle="hsl("+hue+",50%,"+Math.round(l*55)+"%)";
    ctx.beginPath();ctx.moveTo(i+T/2,y+TH/2);ctx.lineTo(i,y+TH);ctx.lineTo(i,j+TH);ctx.lineTo(i+T/2,j+TH/2);ctx.closePath();ctx.fill();
    if (h>=26){ctx.fillStyle="rgba(232,240,238,.8)";ctx.fillText(t.p,i-T/2,y-4);}
    t._poly=[[i,y],[i+T/2,y+TH/2],[i,j+TH],[i-T/2,y+TH/2]];
  }
  ctx.fillStyle="rgba(232,240,238,.75)";ctx.font="12px ui-monospace,monospace";
  ctx.fillText(towers.length+" files built this city",20,26);
}
cv.onmousemove=e=>{
  const r=cv.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top;
  const hit=towers.find(t=>{const P=t._poly;if(!P)return false;
    let inn=false;for(let a=0,b=P.length-1;a<P.length;b=a++){const x1=P[a][0],y1=P[a][1],x2=P[b][0],y2=P[b][1];
      if((y1>my)!=(y2>my)&&mx<(x2-x1)*(my-y1)/(y2-y1)+x1)inn=!inn;}return inn;});
  if(hit){tip.style.display="block";tip.style.left=e.clientX+12+"px";tip.style.top=e.clientY+12+"px";
    tip.innerHTML="<b>"+esc(hit.p)+"</b><br/>"+(hit.loc!=null?"churn "+hit.loc+" lines":"touched (no patch — non-git)")+" · turn "+hit.turn;}
  else tip.style.display="none";
};
cv.onmouseleave=()=>tip.style.display="none";
async function tick(){try{
  build(await fetch("/session").then(r=>r.json()));
  meta.textContent=turnCount+" turns · refreshed live";
  draw();}catch(e){}}
tick();setInterval(tick,1600);addEventListener("resize",draw);
</script></body></html>`;
}

// Ghost City (the /city route) lives in ./lib/city.mjs so the recorder and the
// published /playground share one shell: tape rail, 3D city, autopsy, dock.

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
    const pathname = (req.url || "/").split("?")[0];
    if (req.method === "GET" && (pathname === "/" || pathname === "/studio")) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(studioHtml(eventsBase));
      return;
    }
    if (req.method === "GET" && pathname === "/city") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      res.end(cityHtml3d());
      return;
    }
    if (req.method === "GET" && pathname === "/city2d") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      res.end(cityHtml());
      return;
    }
    if (req.method === "GET" && pathname === "/session") {
      res.writeHead(200, {
        "content-type": "application/json; charset=utf-8",
        "access-control-allow-origin": "*",
      });
      res.end(JSON.stringify(session));
      return;
    }
    if (req.method === "GET" && pathname.startsWith("/diff/")) {
      const name = decodeURIComponent(pathname.slice(6)).slice(0, 12);
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
    if (req.method !== "POST" || pathname !== "/events") { res.writeHead(404).end(); return; }
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
  console.log(`    studio   ${eventsBase}  ← detail: turns, checkpoints, samples`);
  console.log(`    city     ${eventsBase}/city  ← playground kota 3D live (tanpa npm run dev)`);
  console.log(`    replay   full 3D dashboard: repo → npm run dev → /playground?live=1`);
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
