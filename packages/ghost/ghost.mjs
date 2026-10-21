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

// ── helpers ──────────────────────────────────────────────────────────────────
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

  // Mode B — filesystem watcher (works with ANY agent, no events needed)
  let burst = null;
  const checkpoint = (label) => {
    try {
      const snap = shadow.commitSnapshot(repo, `ghost: ${label}`);
      if (!snap.diff) return;
      const dir = store.sessionDir(ROOT, session);
      fs.mkdirSync(path.join(dir, "diffs"), { recursive: true });
      fs.writeFileSync(path.join(dir, "diffs", `${snap.sha.slice(0, 12)}.patch`), snap.diff);
      session.checkpoints.push({ ts: new Date().toISOString(), turnNumber: currentTurn(), sha: snap.sha, files: snap.changedFiles, diffRef: `${session.id}/diffs/${snap.sha.slice(0, 12)}.patch` });
      const t = activeTurn(); // attribute checkpoint against the open turn
    } catch (e) { console.error("  ! checkpoint failed:", e.message); }
  };
  let watching;
  try { watching = fs.watch(repo, { recursive: true }, (ev, file) => {
    if (!file) return;
    const p = file.split(path.sep)[0];
    if (["node_modules", ".next", ".git", ".ghost", "out", ".vercel", "testsprite_tests"].includes(p)) return;
    if (burst) clearTimeout(burst);
    burst = setTimeout(() => {
      burst = null;
      // no open turn? attribute as estimated turn so nothing is lost
      if (!activeTurn()) startTurn({ ts: new Date().toISOString() });
      checkpoint("worktree burst");
      const t = activeTurn(); if (t && !t.endedAt) t.endedAt = new Date().toISOString();
    }, 900);
  }); } catch { console.error("  ! recursive watch unavailable on this FS — adapter events only"); }

  console.log(`\n  ● Ghost recorder is live`);
  console.log(`    session  ${session.id}`);
  console.log(`    repo     ${repo}`);
  console.log(`    app      ${appUrl}`);
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
