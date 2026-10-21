"use client";

// LiveDashboard — the playground fed by the real local recording.
// Polls the loopback bridge (/api/ghost/snapshot → ghost watch on 127.0.0.1),
// adapts contract-v1 recordings into the dashboard Session, and renders the
// SAME Dashboard the demo uses: 3D code city, tape rail, autopsy panel.
import { useCallback, useEffect, useRef, useState } from "react";
import Dashboard from "@/src/components/Dashboard";
import type { Session } from "@/src/types";
import { toDashboardSession } from "@/src/ghost/adapter";

const POLL_MS = 2500;

export default function LiveDashboard() {
  const [session, setSession] = useState<Session | null>(null);
  const [reachable, setReachable] = useState(true);
  const latest = useRef<NodeJS.Timeout | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/ghost/snapshot", { cache: "no-store" });
      const body = await res.json();
      if (!body.recorder) {
        setReachable(false);
        return;
      }
      setReachable(true);
      setSession(toDashboardSession(body.session));
    } catch {
      setReachable(false);
    }
  }, []);

  useEffect(() => {
    void poll();
    latest.current = setInterval(() => void poll(), POLL_MS);
    return () => {
      if (latest.current) clearInterval(latest.current);
    };
  }, [poll]);

  if (!session || !session.turns.length) {
    return (
      <main className="app">
        <div
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            textAlign: "center",
            padding: 24,
          }}
        >
          {!reachable ? (
            <>
              <div>
                <p style={{ opacity: 0.7, maxWidth: 460, margin: "0 auto" }}>
                  No local <code>ghost watch</code> is running on this machine.
                  Start the recorder in your project, then reload — no clouds
                  involved, this page only talks to <code>127.0.0.1</code>.
                </p>
                <p style={{ opacity: 0.45, marginTop: 10 }}>
                  <code>npx ghost watch</code> … or see the README quickstart.
                </p>
              </div>
            </>
          ) : (
            <>
              <div>
                <p style={{ opacity: 0.8, maxWidth: 460, margin: "0 auto" }}>
                  Ghost is recording — waiting for turn 1. Make an edit (or let
                  your agent work) and the city will build itself from the real
                  files it touches.
                </p>
                <p style={{ opacity: 0.45, marginTop: 10 }}>polling…</p>
              </div>
            </>
          )}
        </div>
      </main>
    );
  }

  return <Dashboard session={session} />;
}
