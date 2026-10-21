// Ghost — session manifest (contract v1), local persistence, secret scrubbing,
// and policy-gated sync to Ghost Cloud.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const CONTRACT_VERSION = 1;

/** Policy: secrets never sync, ever. Source code content likewise stays local. */
const SECRET_PATTERNS = [
  [/sk-(?:[A-Za-z0-9_-]{16,}|member-[A-Za-z0-9_-]{10,})/g, "[redacted:key]"],
  [/gh[pousr]_[A-Za-z0-9]{20,}/g, "[redacted:gh-token]"],
  [/AKIA[0-9A-Z]{16}/g, "[redacted:aws]"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "[redacted:pem]"],
  [/"(?:secret|token|password|api[_-]?key)"\s*:\s*"[^"]{4,}"/gi, '"[redacted]"'],
  [/[A-Za-z0-9+/]{40,}={0,2}>/g, (m) => (m.length > 64 ? "[redacted:blob]" : m)],
];

export function scrub(text) {
  if (typeof text !== "string") return text;
  for (const [re, rep] of SECRET_PATTERNS) text = text.replace(re, rep);
  return text;
}

export function newSession({ repo, appUrl, sync }) {
  return {
    v: CONTRACT_VERSION,
    id: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
    endedAt: null,
    status: "recording",
    repo: path.basename(repo),
    repoPath: repo,
    app: { baseUrl: appUrl },
    sync,
    head: null,
    turns: [],      // {index, id?, estimated, prompt?(scrubbed), startedAt, endedAt, files}
    samples: [],    // {ts, turnNumber, metrics, probeFailed}
    checkpoints: [],// {ts, turnNumber, sha, files, diffRef}
  };
}

export function endSession(s) {
  s.endedAt = new Date().toISOString();
  s.status = "recorded";
  return s;
}

export function sessionDir(root, session) {
  return path.join(root, ".ghost", "sessions", session.id);
}

export function persist(root, session) {
  const dir = sessionDir(root, session);
  fs.mkdirSync(dir, { recursive: true });
  const copy = JSON.parse(JSON.stringify(session));
  copy.repoPath = undefined; // local path stays out of anything syncable
  fs.writeFileSync(path.join(dir, "session.json"), JSON.stringify(scrub(JSON.stringify(copy)), null, 2));
  return dir;
}

export function listSessions(root) {
  const base = path.join(root, ".ghost", "sessions");
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base).flatMap((id) => {
    try {
      return [{ id, mtime: fs.statSync(path.join(base, id, "session.json")).mtimeMs }];
    } catch { return []; }
  }).sort((a, b) => b.mtime - a.mtime);
}

export function loadSession(root, id) {
  return JSON.parse(fs.readFileSync(path.join(root, ".ghost", "sessions", id, "session.json"), "utf8"));
}

/** Outbox: pending syncs survive crashes; flushed when the cloud is reachable. */
export function queueSync(root, session) {
  const q = path.join(root, ".ghost", "outbox");
  fs.mkdirSync(q, { recursive: true });
  fs.writeFileSync(path.join(q, `${session.id}.json`), JSON.stringify(session));
}

export function pendingSyncs(root) {
  const q = path.join(root, ".ghost", "outbox");
  if (!fs.existsSync(q)) return [];
  return fs.readdirSync(q).filter((f) => f.endsWith(".json")).map((f) => path.join(q, f));
}

export async function flushOutbox(root, config) {
  const files = pendingSyncs(root);
  for (const file of files) {
    const session = JSON.parse(fs.readFileSync(file, "utf8"));
    await syncSession(config, session);
    fs.rmSync(file, { force: true });
  }
  return files.length;
}

/** POST one session to Ghost Cloud. MetadataPolicy applies here. */
export async function syncSession(config, session) {
  if (!config.deviceToken || config.sync === "off") return false;
  const payload = preparePayload(session);
  const res = await fetch(`${config.cloudUrl}/api/v1/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${config.deviceToken}` },
    body: JSON.stringify(payload),
  });
  return res.ok;
}

function preparePayload(session) {
  const copy = JSON.parse(JSON.stringify(session));
  copy.repoPath = undefined;
  if (copy.sync !== "full") { // consent-gated: no prompts, no diffs leave the machine
    for (const t of copy.turns ?? []) t.prompt = undefined;
    for (const c of copy.checkpoints ?? []) c.diffRef = undefined;
  }
  return scrub(JSON.stringify(copy)) === JSON.stringify(copy) ? copy : JSON.parse(scrub(JSON.stringify(copy)));
}
