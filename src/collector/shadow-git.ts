// Shadow git: the substrate for diffs and rollback. Every assistant turn is
// committed, so the timeline is built from what actually landed on disk instead
// of what an agent claims it did.
//
// Server-side only: this shells out to git, so it runs where the repository is
// checked out (a local recorder). It is not used by the deployed dashboard.

import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import type { DiffHunk } from "@/src/types";

export interface ShadowCommit {
  hash: string;
  message: string;
  at: string;
}

function git(repoPath: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: repoPath,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
}

export function isGitRepo(repoPath: string): boolean {
  try {
    git(repoPath, ["rev-parse", "--is-inside-work-tree"]);
    return true;
  } catch {
    return false;
  }
}

/** Commit everything currently on disk and return the new hash. */
export function commitSnapshot(repoPath: string, message: string): ShadowCommit {
  git(repoPath, ["add", "-A"]);
  git(repoPath, ["commit", "-m", message, "--allow-empty", "--no-verify"]);
  const hash = git(repoPath, ["rev-parse", "HEAD"]).trim();
  const at = git(repoPath, ["log", "-1", "--format=%cI"]).trim();
  return { hash, message, at };
}

/** Parse `git diff` output into the DiffHunk shape the dashboard renders. */
export function parseUnifiedDiff(text: string): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  let current: DiffHunk | null = null;

  for (const line of text.split("\n")) {
    if (line.startsWith("diff --git ")) {
      const match = line.match(/ b\/(.+)$/);
      current = { file: match?.[1] ?? line.slice("diff --git ".length), lines: [] };
      hunks.push(current);
      continue;
    }

    if (!current) continue;
    if (line.startsWith("+++") || line.startsWith("---")) continue;
    if (line.startsWith("@@")) continue;
    if (line.startsWith("+") || line.startsWith("-") || line.startsWith(" ")) {
      current.lines.push(line);
    }
  }

  return hunks.filter((h) => h.lines.length > 0);
}

/** Diff between two commits, or from a commit to the working tree. */
export function diffBetween(repoPath: string, from: string, to = "HEAD"): DiffHunk[] {
  const text = git(repoPath, ["diff", "--unified=3", `${from}..${to}`]);
  return parseUnifiedDiff(text);
}

/** Restore a single file to the state it had at `hash` (one-click rollback). */
export function rollbackFile(repoPath: string, hash: string, file: string): void {
  git(repoPath, ["checkout", hash, "--", file]);
}

/** Restore the whole worktree to `hash`. */
export function rollbackAll(repoPath: string, hash: string): void {
  git(repoPath, ["checkout", hash, "--", "."]);
}

/** Files with uncommitted changes, including untracked ones. */
export function workingTreeChanges(repoPath: string): string[] {
  const out = git(repoPath, ["status", "--porcelain"]);
  return out
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.slice(2).trim())
    .filter(Boolean);
}

/**
 * Stage the whole working tree into a throwaway index and return its tree hash.
 * Nothing about HEAD, the branch or the user's own index is touched.
 */
export function shadowTree(repoPath: string): string {
  const run = ghostGit(repoPath);
  run(["add", "-A"]);
  return run(["write-tree"]).trim();
}

/** Write a commit for an already-staged tree, without moving any ref. */
export function commitShadowTree(
  repoPath: string,
  tree: string,
  parent: string | null,
  message: string,
): ShadowCommit {
  const args = ["commit-tree", tree, "-m", message];
  if (parent) args.push("-p", parent);
  const hash = ghostGit(repoPath)(args).trim();
  return { hash, message, at: new Date().toISOString() };
}

/** Tree hash of an existing commit. */
export function treeOf(repoPath: string, commit: string): string {
  return git(repoPath, ["rev-parse", `${commit}^{tree}`]).trim();
}

/**
 * Stage + commit the working tree as a throwaway commit. Returns the commit.
 * Kept for callers that do not need to compare trees first.
 */
export function shadowSnapshot(
  repoPath: string,
  parent: string | null,
  message: string,
): ShadowCommit {
  return commitShadowTree(repoPath, shadowTree(repoPath), parent, message);
}

function ghostGit(repoPath: string) {
  const gitDir = execFileSync("git", ["rev-parse", "--absolute-git-dir"], {
    cwd: repoPath,
    encoding: "utf8",
  }).trim();

  const env = {
    ...process.env,
    GIT_INDEX_FILE: path.join(os.tmpdir(), `ghost-index-${path.basename(gitDir)}`),
    GIT_AUTHOR_NAME: "Ghost Recorder",
    GIT_AUTHOR_EMAIL: "ghost@localhost",
    GIT_COMMITTER_NAME: "Ghost Recorder",
    GIT_COMMITTER_EMAIL: "ghost@localhost",
  };

  return (args: string[]) =>
    execFileSync("git", args, {
      cwd: repoPath,
      env,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
}
