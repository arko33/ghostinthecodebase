"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bot,
  FileCode,
  Ghost,
  GitBranch,
  History,
  Microscope,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Timer,
  TriangleAlert,
  User,
} from "lucide-react";
import type { Session } from "@/src/types";
import AIPanel from "./AIPanel";
import AutopsyCard from "./AutopsyCard";
import CityPanel from "./CityPanel";
import CodeDiff from "./CodeDiff";
import MetricsChart from "./MetricsChart";

function clock(iso: string) {
  return iso.slice(11, 16);
}

export default function Dashboard({ session }: { session: Session }) {
  const [activeTurn, setActiveTurn] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [pinned, setPinned] = useState<string | null>(null);

  const total = session.turns.length;
  const turn = session.turns[activeTurn];

  const selectTurn = useCallback((index: number) => {
    setActiveTurn(index);
    setPinned(null);
  }, []);

  const next = useCallback(() => {
    setPlaying(false);
    setPinned(null);
    setActiveTurn((i) => (i + 1) % total);
  }, [total]);

  const prev = useCallback(() => {
    setPlaying(false);
    setPinned(null);
    setActiveTurn((i) => (i - 1 + total) % total);
  }, [total]);

  // Keyboard time-travel: arrows scrub, space toggles playback.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "BUTTON"].includes(target.tagName)) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      } else if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  // Auto-play walks the timeline forward for hands-free demos.
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setActiveTurn((i) => {
        const n = i + 1;
        if (n >= total) {
          setPlaying(false);
          return i;
        }
        return n;
      });
      setPinned(null);
    }, 1700);
    return () => clearInterval(id);
  }, [playing, total]);

  // Latest snapshot at or before the active turn (so user turns still show a city).
  const activeSnapshot = useMemo(() => {
    const eligible = session.snapshots.filter((s) => {
      const t = session.turns.find((tt) => tt.id === s.turnId);
      return t ? t.index <= activeTurn : false;
    });
    return eligible.length ? eligible[eligible.length - 1] : session.snapshots[0];
  }, [session, activeTurn]);

  const anomTurnIds = useMemo(
    () => new Set(session.anomalies.map((a) => a.turnId)),
    [session],
  );
  const isAnomTurn = anomTurnIds.has(turn.id);
  const hotFile = pinned ?? (isAnomTurn ? turn.changedFiles[0] : undefined);

  const activeAutopsy = useMemo(
    () =>
      session.autopsies.find(
        (a) =>
          a.blamedTurnId === turn.id ||
          session.anomalies.find((an) => an.id === a.anomalyId)?.turnId === turn.id,
      ),
    [session, turn.id],
  );

  const activeAnomaly = activeAutopsy
    ? session.anomalies.find((a) => a.id === activeAutopsy.anomalyId)
    : undefined;

  const RoleIcon = turn.role === "assistant" ? Bot : User;

  return (
    <div className="flex min-h-screen flex-col lg:h-screen lg:overflow-hidden">
      <header className="z-20 border-b border-line bg-ink/85 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
          <Link href="/" title="Back to home" className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-md border border-accent/30 bg-gradient-to-br from-accent/30 to-human/15">
              <Ghost className="h-4 w-4 text-accent" />
            </div>
            <div className="leading-tight">
              <div className="text-[13.5px] font-semibold tracking-tight">
                GhostInTheCodebase
              </div>
              <div className="text-[10.5px] text-dim">
                Code Autopsy &amp; Time-Travel Debugger
              </div>
            </div>
          </Link>

          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <Meta icon={History} value={session.id} mono />
            <Meta icon={Bot} value={session.agent} />
            <Meta icon={GitBranch} value={session.repo} mono />
            <span
              className={`chip ${
                isAnomTurn
                  ? "border-danger/40 bg-danger/10 text-danger"
                  : "border-ok/40 bg-ok/10 text-ok"
              }`}
            >
              {isAnomTurn ? (
                <>
                  <TriangleAlert className="h-2.5 w-2.5" />
                  regression
                </>
              ) : (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-ok animate-pulseGlow" />
                  healthy
                </>
              )}
            </span>
          </div>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-3 p-3 lg:grid-cols-[290px_minmax(0,1fr)_minmax(340px,1.02fr)]">
        <AIPanel
          turns={session.turns}
          activeTurn={activeTurn}
          anomalies={session.anomalies}
          onSelect={selectTurn}
        />

        <section className="panel flex max-h-[75vh] min-h-0 flex-col lg:max-h-none">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
            <h2 className="section-title">
              <Microscope className="h-3.5 w-3.5 text-danger" />
              Autopsy Lens
            </h2>
            <div className="flex items-center gap-1.5">
              <span className="chip border-line bg-elev font-mono text-dim">
                Turn {turn.index + 1}/{total}
              </span>
              <span
                className={`chip ${
                  turn.role === "assistant"
                    ? "border-ai/40 bg-ai/10 text-ai"
                    : "border-human/40 bg-human/10 text-human"
                }`}
              >
                <RoleIcon className="h-2.5 w-2.5" />
                {turn.role}
              </span>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-auto p-3">
            <div className="rounded-lg border border-line bg-elev/50 p-3">
              <div className="flex items-center gap-2 text-[10.5px] text-dim">
                <span className="inline-flex items-center gap-1 font-semibold uppercase tracking-wider">
                  <RoleIcon className="h-3 w-3" />
                  {turn.role}
                </span>
                <span className="ml-auto inline-flex items-center gap-1 font-mono text-[10px]">
                  <Timer className="h-3 w-3" />
                  {clock(turn.timestamp)}
                </span>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[#e6edf3]">
                {turn.text}
              </p>

              {turn.changedFiles.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1">
                  {turn.changedFiles.map((f) => {
                    const active = f === hotFile;
                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setPinned(active ? null : f)}
                        title="Highlight this file in the 3D city"
                        className={`inline-flex max-w-full items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] transition-colors ${
                          active
                            ? "border-danger/50 bg-danger/10 text-danger"
                            : "border-line bg-glow text-dim hover:border-accent/40 hover:text-accent"
                        }`}
                      >
                        <FileCode className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate">{f}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <h3 className="section-title">
                  <FileCode className="h-3.5 w-3.5 text-human" />
                  Code diff
                </h3>
                <span className="text-[10px] text-dim">
                  {turn.diff.length} {turn.diff.length === 1 ? "file" : "files"}
                </span>
              </div>
              <CodeDiff hunks={turn.diff} />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <h3 className="section-title">
                  <Activity className="h-3.5 w-3.5 text-ai" />
                  Runtime metrics
                </h3>
                <span className="text-[10px] text-dim">4 samples / turn</span>
              </div>
              <MetricsChart metrics={session.metrics} activeTurn={activeTurn} />
            </div>

            {activeAutopsy && (
              <AutopsyCard autopsy={activeAutopsy} anomaly={activeAnomaly} />
            )}
          </div>
        </section>

        <div className="h-[480px] lg:h-auto lg:min-h-[460px]">
          <CityPanel
            snapshot={activeSnapshot}
            hotFile={hotFile}
            onSelectFile={(f) => setPinned((prev) => (prev === f ? null : f))}
          />
        </div>
      </div>

      <footer className="border-t border-line bg-panel/70 backdrop-blur">
        <div className="flex items-center gap-2.5 px-4 py-2.5">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? "Pause replay" : "Play replay"}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-accent/40 bg-accent/10 text-accent transition-colors hover:bg-accent/20"
          >
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>

          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={prev}
              aria-label="Previous turn"
              className="grid h-6 w-6 place-items-center rounded text-dim transition-colors hover:bg-elev hover:text-[#e6edf3]"
            >
              <SkipBack className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Next turn"
              className="grid h-6 w-6 place-items-center rounded text-dim transition-colors hover:bg-elev hover:text-[#e6edf3]"
            >
              <SkipForward className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="scrubber relative flex-1">
            <input
              type="range"
              min={0}
              max={total - 1}
              value={activeTurn}
              onChange={(e) => selectTurn(Number(e.target.value))}
              aria-label="Timeline scrubber"
            />
            <div className="pointer-events-none absolute inset-x-0 -top-2.5 flex h-0 items-center">
              {session.anomalies.map((a) => {
                const idx = session.turns.findIndex((t) => t.id === a.turnId);
                if (idx < 0) return null;
                const left = total > 1 ? (idx / (total - 1)) * 100 : 0;
                return (
                  <span
                    key={a.id}
                    style={{ left: `${left}%` }}
                    className="absolute h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-danger shadow-hot"
                  />
                );
              })}
            </div>
          </div>

          <span className="shrink-0 font-mono text-[11px] tabular-nums text-dim">
            {String(turn.index + 1).padStart(2, "0")}
            <span className="text-dim/40"> / {String(total).padStart(2, "0")}</span>
          </span>

          <span className="hidden shrink-0 items-center gap-1 rounded border border-line bg-elev px-1.5 py-0.5 font-mono text-[10px] text-dim sm:inline-flex">
            ← → space
          </span>
        </div>
      </footer>
    </div>
  );
}

function Meta({
  icon: Icon,
  value,
  mono,
}: {
  icon: typeof Bot;
  value: string;
  mono?: boolean;
}) {
  return (
    <span className="chip border-line bg-elev text-dim">
      <Icon className="h-2.5 w-2.5" />
      <span className={mono ? "font-mono" : ""}>{value}</span>
    </span>
  );
}
