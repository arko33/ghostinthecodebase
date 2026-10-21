"use client";

import { Robot, User, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useRef } from "react";
import type { Anomaly, Turn } from "@/src/types";
import GhostMark from "./site/GhostMark";

interface Props {
  turns: Turn[];
  activeTurn: number;
  anomalies: Anomaly[];
  onSelect: (index: number) => void;
  playing?: boolean;
  agent?: string;
  sessionId?: string;
}

export default function AIPanel({
  turns,
  activeTurn,
  anomalies,
  onSelect,
  playing,
  agent,
  sessionId,
}: Props) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const anomalyIds = new Set(anomalies.map((anomaly) => anomaly.turnId));

  useEffect(() => {
    refs.current[activeTurn]?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }, [activeTurn]);

  return (
    <aside className="pg-rail" aria-label="Session tape">
      <div className="pg-rail__head">
        <div>
          <span className="pg-label">Tape</span>
          <h2>{turns.length} turns</h2>
        </div>
        <span className="pg-rec" data-on={playing ? "true" : "false"}>
          <i aria-hidden="true" />
          REC
        </span>
      </div>

      <div className="pg-rail__meta">
        <span>{agent ?? "agent"}</span>
        <span>{sessionId ?? "session"}</span>
      </div>

      <ol className="pg-rail__list">
        {turns.map((turn, index) => {
          const hot = anomalyIds.has(turn.id);
          const active = index === activeTurn;
          const assistant = turn.role === "assistant";
          return (
            <li className="pg-rail__item" key={turn.id}>
              <span className="pg-rail__connector" aria-hidden="true" />
              <button
                ref={(node) => {
                  refs.current[index] = node;
                }}
                type="button"
                className="pg-turn"
                data-active={active ? "true" : "false"}
                data-hot={hot ? "true" : "false"}
                aria-current={active ? "step" : undefined}
                onClick={() => onSelect(index)}
              >
                <span className="pg-turn__node" aria-hidden="true">
                  {hot ? (
                    <GhostMark size={15} variant="glow" />
                  ) : assistant ? (
                    <Robot size={14} weight="light" />
                  ) : (
                    <User size={14} weight="light" />
                  )}
                </span>
                <span className="pg-turn__body">
                  <span className="pg-turn__top">
                    <span className="pg-turn__index">
                      t{index + 1}
                    </span>
                    <span className="pg-turn__role">{turn.role}</span>
                    {hot ? (
                      <span className="pg-turn__badge pg-turn__badge--hot">
                        <WarningCircle size={12} weight="light" />
                        regression
                      </span>
                    ) : assistant ? (
                      <span className="pg-turn__badge">AI</span>
                    ) : null}
                  </span>
                  <span className="pg-turn__text">{turn.text}</span>
                  {active && turn.changedFiles.length > 0 && (
                    <span className="pg-turn__files">
                      {turn.changedFiles.map((file) => (
                        <span key={file}>{file}</span>
                      ))}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
