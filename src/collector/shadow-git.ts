// Shadow git: the substrate for diffs and rollback. Every assistant turn is
// committed, so the timeline is built from what actually landed on disk instead
// of what an agent claims it did.
//
// Server-side only: this shells out to git, so it runs where the repository is
// checked out (a local recorder). It is not used by the deployed dashboard.

import { execFileSync } from "node:child_process";
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
