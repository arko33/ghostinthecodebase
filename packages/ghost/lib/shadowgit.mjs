// Ghost — shadow-git: checkpoints & diffs WITHOUT moving HEAD or touching branches.
// Technique: stage changes into a throwaway index (GIT_INDEX_FILE env), write-tree,
// commit-tree. The worktree and the user's branches are never modified.

import { execFileSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const IGNORE_SET = new Set([
  "node_modules", ".next", ".git", ".ghost", "out", ".vercel",
  "testsprite_tests", ".turbo", "dist",
]);

/**
 * Create a shadow commit of the current worktree state.
 * Returns { sha, diff } — sha is a real git commit object (not on any branch),
 * diff is a unified diff patch versus HEAD ("" when the worktree matches HEAD).
 */
export function commitSnapshot(repo, message = "ghost checkpoint") {
  // One index file per recorder process. Two recorders watching the same repo
  // (a leftover demo run + a manual `ghost watch`, say) would otherwise fight
  // over a single .ghost/shadow-index.lock, and every `git add` after the first
  // would die with "File exists" — the city silently froze at a couple of towers.
  const idx = path.join(repo, ".ghost", `shadow-index-${process.pid}`);
  fs.mkdirSync(path.dirname(idx), { recursive: true });
  // A killed recorder leaves its lock behind; this pid is ours now, so anything
  // left under this exact name is dead weight.
  for (const stale of [idx, `${idx}.lock`]) {
    try { fs.unlinkSync(stale); } catch { /* nothing to clean */ }
  }
  const env = { ...process.env, GIT_INDEX_FILE: idx };

  const git = (args, extraEnv = {}) =>
    execFileSync("git", args, {
      cwd: repo,
      env: { ...env, ...extraEnv },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 1024 * 1024 * 64,
    }).trim();
  // execFileSync only exposes stderr when we ask for it; without this the CLI
  // printed a bare "Command failed: git add -A -- ." and hid the real reason.
  const run = (args, extraEnv) => {
    try { return git(args, extraEnv); }
    catch (e) {
      const detail = String(e.stderr || "").trim().split(/\r?\n/).filter(Boolean).pop();
      throw new Error(`git ${args[0]} failed: ${detail || e.message}`);
    }
  };

  try { run(["read-tree", "HEAD"]); } catch { /* empty repo without HEAD */ }
  // .ghost is the recorder's own bookkeeping (shadow index + patches). Staging
  // it would grow every snapshot by megabytes and eventually blow maxBuffer —
  // the city would silently stop growing. Add it to the repo-local exclude
  // (never committed, never touches the user's .gitignore) so a plain add
  // skips it everywhere, including repos that do not ignore .ghost.
  ensureExcluded(repo);
  run(["add", "-A", "--", "."]);
  const tree = run(["write-tree"]);
  let parent = null;
  try { parent = run(["rev-parse", "HEAD"]); } catch { /* first snapshot */ }
  const commitArgs = parent ? ["commit-tree", tree, "-p", parent, "-m", message] : ["commit-tree", tree, "-m", message];
  const sha = run(commitArgs, { GIT_AUTHOR_DATE: new Date().toISOString(), GIT_COMMITTER_DATE: new Date().toISOString() });
  const diffOut = execFileSync(
    "git", ["diff", "--binary", ...(parent ? [parent] : ["4b825dc642cb6eb9a060e54bf8d69288fbee4904"]), sha],
    { cwd: repo, encoding: "utf8", maxBuffer: 1024 * 1024 * 64 },
  ).trim();
  return { sha, diff: diffOut, changedFiles: listChangedFiles(repo, parent ? parent : "4b825dc642cb6eb9a060e54bf8d69288fbee4904", sha) };
}

function ensureExcluded(repo) {
  try {
    const file = path.join(repo, ".git", "info", "exclude");
    const text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
    if (text.split(/\r?\n/).includes(".ghost/")) return;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, (text && !text.endsWith("\n") ? "\n" : "") + ".ghost/\n");
  } catch { /* worktree without .git — nothing to exclude */ }
}

function listChangedFiles(repo, from, to) {
  try {
    const out = execFileSync("git", ["diff", "--name-only", from, to], { cwd: repo, encoding: "utf8" }).trim();
    return out ? out.split("\n").map((s) => s.trim()).filter(Boolean) : [];
  } catch { return []; }
}

/** Roll back ONE file to a snapshot (worktree + index for that file only). */
export function rollbackFile(repo, sha, filePath) {
  execFileSync("git", ["checkout", sha, "--", filePath], { cwd: repo, encoding: "utf8" });
}

/** Fetch a file's content at a snapshot. */
export function showFile(repo, sha, filePath) {
  return execFileSync("git", ["show", `${sha}:${filePath}`], { cwd: repo, encoding: "utf8" });
}

export function currentHead(repo) {
  try { return execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); }
  catch { return null; }
}
