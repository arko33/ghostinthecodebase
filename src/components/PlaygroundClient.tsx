"use client";

import { useCallback, useState } from "react";
import type { Session } from "@/src/types";
import Dashboard from "./Dashboard";

/** Shape check, not a full schema: enough to reject arbitrary JSON. */
function isSession(value: unknown): value is Session {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Session>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.repo === "string" &&
    Array.isArray(candidate.turns) &&
    Array.isArray(candidate.metrics) &&
    Array.isArray(candidate.snapshots) &&
    Array.isArray(candidate.anomalies) &&
    Array.isArray(candidate.autopsies)
  );
}

export default function PlaygroundClient({ initial }: { initial: Session }) {
  const [session, setSession] = useState(initial);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      if (!isSession(parsed)) {
        setNotice({ kind: "err", text: "That file is not a Ghost session." });
        return;
      }
      if (parsed.turns.length === 0) {
        setNotice({ kind: "err", text: "That session has no turns. Record for longer." });
        return;
      }
      setSession(parsed);
      setNotice({ kind: "ok", text: `Loaded ${parsed.turns.length} turns from ${parsed.repo}` });
    } catch {
      setNotice({ kind: "err", text: "Could not parse that file as JSON." });
    }
  }, []);

  const reset = useCallback(() => {
    setSession(initial);
    setNotice(null);
  }, [initial]);

  const custom = session.id !== initial.id;

  return (
    <>
      <Dashboard session={session} onLoadSession={load} />

      {(notice || custom) && (
        <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-line bg-panel/95 px-3 py-2 text-[11.5px] shadow-panel backdrop-blur">
          <span className={notice?.kind === "err" ? "text-danger" : "text-dim"}>
            {notice ? notice.text : `Replaying ${session.id}`}
          </span>
          {custom && (
            <button
              type="button"
              onClick={reset}
              className="rounded border border-line px-2 py-0.5 text-[11px] text-dim transition hover:border-accent/40 hover:text-accent"
            >
              back to demo
            </button>
          )}
        </div>
      )}
    </>
  );
}
