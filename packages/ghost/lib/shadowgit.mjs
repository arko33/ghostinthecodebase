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
  const idx = path.join(repo, ".ghost", "shadow-index");
  fs.mkdirSync(path.dirname(idx), { recursive: true });
  const env = { ...process.env, GIT_INDEX_FILE: idx };

  const git = (args, extraEnv = {}) =>
    execFileSync("git", args, { cwd: repo, env: { ...env, ...extraEnv }, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();

  try { git(["read-tree", "HEAD"]); } catch { /* empty repo without HEAD */ }
  git(["add", "-A"]);
  const tree = git(["write-tree"]);
  let parent = null;
  try { parent = git(["rev-parse", "HEAD"]); } catch { /* first snapshot */ }
  const commitArgs = parent ? ["commit-tree", tree, "-p", parent, "-m", message] : ["commit-tree", tree, "-m", message];
  const sha = git(commitArgs, { GIT_AUTHOR_DATE: new Date().toISOString(), GIT_COMMITTER_DATE: new Date().toISOString() });
  const diffOut = execFileSync(
    "git", ["diff", "--binary", ...(parent ? [parent] : ["4b825dc642cb6eb9a060e54bf8d69288fbee4904"]), sha],
    { cwd: repo, encoding: "utf8", maxBuffer: 1024 * 1024 * 16 },
  ).trim();
  return { sha, diff: diffOut, changedFiles: listChangedFiles(repo, parent ? parent : "4b825dc642cb6eb9a060e54bf8d69288fbee4904", sha) };
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
