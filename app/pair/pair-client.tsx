"use client";
// Pairing confirm UI — the human half of `ghost setup`.
import { useState } from "react";

export default function PairClient({ code }: { code: string }) {
  const [status, setStatus] = useState<"idle" | "working" | "paired" | "unauth" | "error">("idle");
  const [message, setMessage] = useState("");

  async function confirm() {
    setStatus("working");
    try {
      const res = await fetch("/api/v1/pair/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (res.ok) {
        setStatus("paired");
        return;
      }
      if (res.status === 401) {
        setStatus("unauth");
        return;
      }
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      setMessage(json.error ?? `error ${res.status}`);
      setStatus("error");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "network error");
      setStatus("error");
    }
  }

  if (!code) {
    return <p className="pair-note">No pairing code. Run <code>ghost setup</code> in your terminal.</p>;
  }

  return (
    <div className="pair-body">
      <p className="pair-note">
        A CLI on your machine wants to pair with your Ghost account.
      </p>
      <div className="pair-code">{code}</div>
      {status === "paired" ? (
        <p className="pair-note ok">✓ Device paired — token stored locally on that machine. You can close this tab.</p>
      ) : status === "unauth" ? (
        <p className="pair-note">
          <a href={`/api/auth/github?next=${encodeURIComponent(`/pair?code=${code}`)}`} className="pair-link">
            Sign in with GitHub
          </a>{" "}
          to confirm the pairing.
        </p>
      ) : status === "error" ? (
        <>
          <p className="pair-note bad">✗ {message}</p>
          <button className="pair-btn" onClick={confirm}>Retry</button>
        </>
      ) : (
        <button className="pair-btn" onClick={confirm} disabled={status === "working"}>
          {status === "working" ? "Pairing…" : "Confirm pairing"}
        </button>
      )}
    </div>
  );
}
