"use client";

import type { DiffHunk } from "@/src/types";
import GhostMark from "./site/GhostMark";

// Renders a list of unified-diff hunks with +/- coloring.
export default function CodeDiff({ hunks }: { hunks: DiffHunk[] }) {
  if (hunks.length === 0) {
    return (
      <div className="pg-empty">
        <GhostMark size={28} variant="glow" />
        <p>No code changes in this turn.</p>
      </div>
    );
  }
  return (
    <div className="diff">
      {hunks.map((h, i) => (
        <div key={i}>
          <div className="file">{h.file}</div>
          <pre>
            {h.lines.map((line, j) => {
              const cls = line.startsWith("+")
                ? "add"
                : line.startsWith("-")
                  ? "del"
                  : "";
              return (
                <div key={j} className={cls}>
                  {line}
                </div>
              );
            })}
          </pre>
        </div>
      ))}
    </div>
  );
}
