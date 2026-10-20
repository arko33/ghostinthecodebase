"use client";

import { Bot, TriangleAlert, User } from "lucide-react";
import type { Anomaly, Turn } from "@/src/types";

interface Props {
  turns: Turn[];
  activeTurn: number;
  anomalies: Anomaly[];
  onSelect: (index: number) => void;
}

function clock(iso: string) {
  return iso.slice(11, 16);
}

// Left rail: the chronological agent-turn list. Selecting a turn drives the
// rest of the dashboard (the time-travel scrubber target).
export default function AIPanel({ turns, activeTurn, anomalies, onSelect }: Props) {
  const anomTurnIds = new Set(anomalies.map((a) => a.turnId));
  const aiCount = turns.filter((t) => t.role === "assistant").length;

  return (
    <aside className="panel flex min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <h2 className="section-title">
          <Bot className="h-3.5 w-3.5 text-accent" />
          Agent Session
        </h2>
        <span className="chip border-line bg-elev text-dim">{turns.length} turns</span>
      </div>

      <div className="flex-1 min-h-0 space-y-0.5 overflow-auto p-1.5">
        {turns.map((t) => {
          const isAnom = anomTurnIds.has(t.id);
          const isAi = t.role === "assistant";
          const active = t.index === activeTurn;
          const Icon = isAi ? Bot : User;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.index)}
              aria-current={active ? "true" : undefined}
              className={`turn group flex w-full gap-2 text-left ${active ? "active" : ""}`}
            >
              <span
                className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border ${
                  isAnom
                    ? "border-danger/40 bg-danger/10 text-danger"
                    : isAi
                      ? "border-ai/30 bg-ai/10 text-ai"
                      : "border-human/30 bg-human/10 text-human"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] tabular-nums text-dim/70">
                    {String(t.index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-dim">
                    {t.role}
                  </span>
                  {isAi && <span className="badge ai">ai</span>}
                  {isAnom && (
                    <span className="badge anom">
                      <TriangleAlert className="h-2.5 w-2.5" />
                      regression
                    </span>
                  )}
                  <span className="ml-auto font-mono text-[10px] text-dim/50">
                    {clock(t.timestamp)}
                  </span>
                </span>
                <span className="mt-0.5 line-clamp-2 block text-[12.5px] leading-snug text-[#dfe7f1]">
                  {t.text}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-line px-3 py-1.5 text-[10px] text-dim">
        <span>{aiCount} AI turns</span>
        <span className={anomalies.length ? "text-danger" : "text-ok"}>
          {anomalies.length ? `${anomalies.length} anomaly` : "no anomalies"}
        </span>
      </div>
    </aside>
  );
}
