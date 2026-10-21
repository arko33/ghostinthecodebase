"use client";

import {
  CaretLeft,
  CaretRight,
  Pause,
  Play,
} from "@phosphor-icons/react";
import type { Turn } from "@/src/types";
import GhostMark from "../site/GhostMark";
import Kbd from "../site/Kbd";

interface Props {
  turns: Turn[];
  activeTurn: number;
  anomalyTurn: number;
  playing: boolean;
  speed: number;
  onSelect: (index: number) => void;
  onTogglePlay: () => void;
  onStep: (delta: number) => void;
  onSpeed: () => void;
}

function timecode(turn: Turn | undefined) {
  if (!turn) return "00:00:00";
  return new Date(turn.timestamp).toISOString().slice(11, 19);
}

export default function TimelineDock({
  turns,
  activeTurn,
  anomalyTurn,
  playing,
  speed,
  onSelect,
  onTogglePlay,
  onStep,
  onSpeed,
}: Props) {
  const last = Math.max(1, turns.length - 1);
  const progress = (activeTurn / last) * 100;
  const anomaly = (anomalyTurn / last) * 100;

  return (
    <footer className="pg-dock" aria-label="Timeline">
      <div className="pg-dock__controls">
        <button
          type="button"
          className="pg-icon-btn"
          onClick={() => onStep(-1)}
          aria-label="Previous turn"
        >
          <CaretLeft size={16} weight="light" />
        </button>
        <button
          type="button"
          className="pg-play"
          onClick={onTogglePlay}
          aria-label={playing ? "Pause replay" : "Play replay"}
        >
          {playing ? (
            <Pause size={16} weight="regular" />
          ) : (
            <Play size={16} weight="regular" />
          )}
        </button>
        <button
          type="button"
          className="pg-icon-btn"
          onClick={() => onStep(1)}
          aria-label="Next turn"
        >
          <CaretRight size={16} weight="light" />
        </button>
      </div>

      <div className="pg-dock__time">
        <span className="pg-rec" data-on={playing ? "true" : "false"}>
          <i aria-hidden="true" />
          REC
        </span>
        <span className="pg-dock__tc">{timecode(turns[activeTurn])}</span>
        <span className="pg-dock__turn">
          t{activeTurn + 1} / {turns.length}
        </span>
      </div>

      <div className="pg-dock__track">
        <div className="pg-dock__rail" aria-hidden="true" />
        <div className="pg-dock__fill" style={{ width: `${progress}%` }} />
        {turns.map((turn, index) => (
          <button
            key={turn.id}
            type="button"
            className="pg-dock__tick"
            style={{ left: `${(index / last) * 100}%` }}
            data-active={index === activeTurn ? "true" : "false"}
            aria-label={`Go to turn ${index + 1}`}
            aria-current={index === activeTurn ? "step" : undefined}
            onClick={() => onSelect(index)}
          >
            <span />
          </button>
        ))}
        <span
          className="pg-dock__anomaly"
          style={{ left: `${anomaly}%` }}
          title={`Anomaly on turn ${anomalyTurn + 1}`}
          aria-label={`Anomaly on turn ${anomalyTurn + 1}`}
        >
          <i aria-hidden="true" />
        </span>
        <span
          className="pg-dock__playhead"
          style={{ left: `${progress}%` }}
          aria-hidden="true"
        >
          <GhostMark size={16} variant="glow" />
        </span>
      </div>

      <div className="pg-dock__meta">
        <button
          type="button"
          className="pg-speed"
          onClick={onSpeed}
          aria-label={`Playback speed ${speed}x`}
        >
          {speed}x
        </button>
        <span className="pg-dock__keys">
          <Kbd>Space</Kbd>
          <Kbd>←</Kbd>
          <Kbd>→</Kbd>
        </span>
      </div>
    </footer>
  );
}
