"use client";

import {
  Crosshair,
  Cube,
  MapTrifold,
  Robot,
  User,
  WarningCircle,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { Session } from "@/src/types";
import { useReducedMotion } from "./site/hooks";
import AIPanel from "./AIPanel";
import AutopsyPanel from "./playground/AutopsyPanel";
import SessionBar from "./playground/SessionBar";
import TimelineDock from "./playground/TimelineDock";

const GhostCity = dynamic(() => import("./GhostCity"), {
  ssr: false,
  loading: () => (
    <div className="pg-city pg-city--loading">
      <span className="pg-label">Loading city</span>
    </div>
  ),
});

export default function Dashboard({ session }: { session: Session }) {
  const [activeTurn, setActiveTurn] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [preset, setPreset] = useState<"overview" | "blame">("overview");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [rolledBack, setRolledBack] = useState(false);
  const [mobileTab, setMobileTab] = useState<"tape" | "autopsy">("autopsy");
  const reduced = useReducedMotion();

  const turns = session.turns;
  const turn = turns[activeTurn];
  const anomalyTurnIndex = Math.max(
    0,
    turns.findIndex((item) => item.id === session.anomalies[0]?.turnId),
  );

  const activeSnapshot = useMemo(() => {
    const eligible = session.snapshots.filter((snapshot) => {
      const source = turns.find((item) => item.id === snapshot.turnId);
      return source ? source.index <= activeTurn : false;
    });
    return eligible.length ? eligible[eligible.length - 1] : session.snapshots[0];
  }, [session.snapshots, turns, activeTurn]);

  const hotFile =
    activeTurn === anomalyTurnIndex ? turn.changedFiles[0] : undefined;

  const stop = useCallback(() => {
    setPlaying(false);
    setMobileTab("autopsy");
  }, []);

  const handleSelect = useCallback(
    (index: number) => {
      setPlaying(false);
      setRolledBack(false);
      setSelectedFile(null);
      setActiveTurn(Math.max(0, Math.min(turns.length - 1, index)));
    },
    [turns.length],
  );

  const handleStep = useCallback(
    (delta: number) => {
      setPlaying(false);
      setRolledBack(false);
      setSelectedFile(null);
      setActiveTurn((current) =>
        Math.max(0, Math.min(turns.length - 1, current + delta)),
      );
    },
    [turns.length],
  );

  const handleTogglePlay = useCallback(() => {
    setRolledBack(false);
    setSelectedFile(null);
    setPlaying((current) => {
      if (!current && activeTurn >= turns.length - 1) {
        setActiveTurn(0);
      }
      return !current;
    });
  }, [activeTurn, turns.length]);

  const handleHoverTurn = useCallback(
    (index: number) => {
      setPlaying(false);
      setRolledBack(false);
      setSelectedFile(null);
      setActiveTurn(Math.max(0, Math.min(turns.length - 1, index)));
    },
    [turns.length],
  );

  const handleRollback = useCallback(() => {
    setPlaying(false);
    setPreset("blame");
    setRolledBack(true);
    setActiveTurn(5);
    setSelectedFile("src/store/invoices.ts");
    window.setTimeout(() => setRolledBack(false), 1800);
  }, []);

  const handleJumpToBlame = useCallback(() => {
    setPlaying(false);
    setRolledBack(false);
    setSelectedFile("src/store/invoices.ts");
    setPreset("blame");
    setActiveTurn(3);
  }, []);

  const handleReload = useCallback(() => {
    setPlaying(false);
    setRolledBack(false);
    setSelectedFile(null);
    setPreset("overview");
    setActiveTurn(0);
    setMobileTab("autopsy");
  }, []);

  useEffect(() => {
    if (!playing) return;
    if (activeTurn >= turns.length - 1) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setActiveTurn((current) =>
        Math.min(turns.length - 1, current + 1),
      );
    }, 1800 / speed);
    return () => window.clearTimeout(timer);
  }, [activeTurn, playing, speed, turns.length]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
      ) {
        return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        handleTogglePlay();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        handleStep(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        handleStep(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleStep, handleTogglePlay]);

  return (
    <div className="pg-shell" data-mobile={mobileTab}>
      <SessionBar
        sessionId={session.id}
        agent={session.agent}
        repo={session.repo}
        playing={playing}
        onReload={handleReload}
      />

      <div className="pg-body">
        <div className="pg-rail-wrap">
          <AIPanel
            turns={turns}
            activeTurn={activeTurn}
            anomalies={session.anomalies}
            onSelect={handleSelect}
            playing={playing}
            agent={session.agent}
            sessionId={session.id}
          />
        </div>

        <div className="pg-work">
          <section className="pg-stage" aria-label="Code city">
            <div className="pg-stage__sky" aria-hidden="true" />
            <div className="pg-stage__canvas">
              <GhostCity
                session={session}
                snapshot={activeSnapshot}
                activeTurn={activeTurn}
                hotFile={hotFile}
                selectedFile={selectedFile}
                onSelectFile={(path) => {
                  setSelectedFile(path);
                  setMobileTab("autopsy");
                }}
                preset={preset}
                rolledBack={rolledBack}
                reduced={reduced}
              />
            </div>

            <div className="pg-stage__top">
              <span className="pg-stage__tag">
                <Cube size={14} weight="light" aria-hidden="true" />
                code city · {turns.length} turns
              </span>
              <div className="pg-presets">
                <button
                  type="button"
                  data-active={preset === "overview" ? "true" : "false"}
                  onClick={() => setPreset("overview")}
                >
                  <MapTrifold size={14} weight="light" aria-hidden="true" />
                  Overview
                </button>
                <button
                  type="button"
                  data-active={preset === "blame" ? "true" : "false"}
                  onClick={() => {
                    setPreset("blame");
                    setActiveTurn(3);
                    setSelectedFile("src/store/invoices.ts");
                    stop();
                  }}
                >
                  <Crosshair size={14} weight="light" aria-hidden="true" />
                  Focus on blame
                </button>
              </div>
            </div>

            <div className="pg-stage__legend">
              <span>
                <Cube size={13} weight="light" aria-hidden="true" />
                healthy
              </span>
              <span>
                <WarningCircle size={13} weight="light" aria-hidden="true" />
                anomaly
              </span>
              <span>
                <Robot size={13} weight="light" aria-hidden="true" />
                AI-written
              </span>
              <span>
                <User size={13} weight="light" aria-hidden="true" />
                human
              </span>
            </div>
          </section>

          <div className="pg-mobile-tabs" role="tablist" aria-label="Panels">
            <button
              type="button"
              role="tab"
              aria-selected={mobileTab === "tape"}
              data-active={mobileTab === "tape" ? "true" : "false"}
              onClick={() => setMobileTab("tape")}
            >
              Tape
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mobileTab === "autopsy"}
              data-active={mobileTab === "autopsy" ? "true" : "false"}
              onClick={() => setMobileTab("autopsy")}
            >
              Autopsy
            </button>
          </div>

          <AutopsyPanel
            session={session}
            activeTurn={activeTurn}
            selectedFile={selectedFile}
            onClearSelection={() => setSelectedFile(null)}
            onJumpToBlame={handleJumpToBlame}
            onRollback={handleRollback}
            rolledBack={rolledBack}
            onHoverTurn={handleHoverTurn}
            onSelectTurn={handleSelect}
          />
        </div>
      </div>

      <TimelineDock
        turns={turns}
        activeTurn={activeTurn}
        anomalyTurn={anomalyTurnIndex}
        playing={playing}
        speed={speed}
        onSelect={handleSelect}
        onTogglePlay={handleTogglePlay}
        onStep={handleStep}
        onSpeed={() =>
          setSpeed((current) => (current === 0.5 ? 1 : current === 1 ? 2 : 0.5))
        }
      />
    </div>
  );
}
