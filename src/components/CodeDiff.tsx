"use client";

import { FileCode, Minus, Plus } from "lucide-react";
import type { DiffHunk } from "@/src/types";

// Renders a list of unified-diff hunks with +/- coloring.
export default function CodeDiff({ hunks }: { hunks: DiffHunk[] }) {
  if (hunks.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-dashed border-line bg-elev/30 px-3 py-3 text-[12px] text-dim">
        <FileCode className="h-3.5 w-3.5" />
        No code changes in this turn.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {hunks.map((h, i) => {
        const adds = h.lines.filter((l) => l.startsWith("+")).length;
        const dels = h.lines.filter((l) => l.startsWith("-")).length;
        return (
          <div key={i} className="diff">
            <div className="file">
              <FileCode className="h-3 w-3 shrink-0" />
              <span className="truncate">{h.file}</span>
              <span className="ml-auto shrink-0 font-mono text-[10px]">
                <span className="text-ok/80">+{adds}</span>{" "}
                <span className="text-danger/80">-{dels}</span>
              </span>
            </div>
            <pre>
              {h.lines.map((line, j) => {
                const kind = line.startsWith("+")
                  ? "add"
                  : line.startsWith("-")
                    ? "del"
                    : "ctx";
                const body = line.replace(/^[+-]/, "");
                return (
                  <div key={j} className={`line ${kind}`}>
                    <span className="mt-[3px] w-3 shrink-0 select-none">
                      {kind === "add" && <Plus className="h-3 w-3" />}
                      {kind === "del" && <Minus className="h-3 w-3" />}
                    </span>
                    <span className="w-5 shrink-0 select-none text-right text-[10px] tabular-nums text-dim/40">
                      {j + 1}
                    </span>
                    <code className="min-w-0 flex-1">{body}</code>
                  </div>
                );
              })}
            </pre>
          </div>
        );
      })}
    </div>
  );
}
