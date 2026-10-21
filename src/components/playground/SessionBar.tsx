"use client";

import {
  ArrowLeft,
  ArrowClockwise,
  Broadcast,
} from "@phosphor-icons/react";
import Link from "next/link";
import GhostMark from "../site/GhostMark";

interface Props {
  sessionId: string;
  agent: string;
  repo: string;
  playing: boolean;
  onReload: () => void;
}

export default function SessionBar({
  sessionId,
  agent,
  repo,
  playing,
  onReload,
}: Props) {
  return (
    <header className="pg-top">
      <div className="pg-top__brand">
        <GhostMark size={28} variant="glow" />
        <div className="pg-top__title">
          <strong>Ghost</strong>
          <span>Code Autopsy</span>
        </div>
      </div>

      <div className="pg-pills" aria-label="Session metadata">
        <span className="pg-pill">
          <Broadcast size={14} weight="light" aria-hidden="true" />
          {sessionId}
        </span>
        <span className="pg-pill">{agent}</span>
        <span className="pg-pill">{repo}</span>
      </div>

      <div className="pg-top__actions">
        <span className="pg-live" data-on={playing ? "true" : "false"}>
          <i aria-hidden="true" />
          {playing ? "REC" : "Replay"}
        </span>
        <button type="button" className="pg-pill-btn" onClick={onReload}>
          <ArrowClockwise size={14} weight="light" aria-hidden="true" />
          Load session
        </button>
        <Link className="pg-icon-link" href="/" aria-label="Back to landing">
          <ArrowLeft size={16} weight="light" aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
}
