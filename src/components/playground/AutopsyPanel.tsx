"use client";

import {
  ArrowUUpLeft,
  CheckCircle,
  Crosshair,
  FileCode,
  Robot,
  User,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import type { Session } from "@/src/types";
import CodeDiff from "../CodeDiff";
import CopyButton from "../site/CopyButton";
import GhostMark from "../site/GhostMark";
import MetricsChart from "../MetricsChart";

interface Props {
  session: Session;
  activeTurn: number;
  selectedFile: string | null;
  onClearSelection: () => void;
  onJumpToBlame: () => void;
  onRollback: () => void;
  rolledBack: boolean;
  onHoverTurn: (turn: number) => void;
  onSelectTurn: (turn: number) => void;
}

export default function AutopsyPanel({
  session,
  activeTurn,
  selectedFile,
  onClearSelection,
  onJumpToBlame,
  onRollback,
  rolledBack,
  onHoverTurn,
  onSelectTurn,
}: Props) {
  const turn = session.turns[activeTurn];
  const autopsy = session.autopsies[0];
  const anomaly = session.anomalies[0];
  const blameTurn = autopsy
    ? session.turns.find((t) => t.id === autopsy.blamedTurnId) ?? null
    : null;
  const blameIndex = blameTurn ? blameTurn.index : null;
  const selectedTower = selectedFile
    ? session.snapshots
        .flatMap((snapshot) => snapshot.files)
        .find((file) => file.path === selectedFile)
    : null;
  // live recordings heal only when the recording says so; the demo scrub keeps
  // its activeTurn-driven narrative.
  const isLive = session.agent?.startsWith("ghost-live") ?? false;
  const healed = rolledBack || (!isLive && activeTurn >= 5) || !!autopsy?.healed;
  if (!turn) {
    return (
      <aside className="pg-autopsy" aria-label="Autopsy">
        <div className="pg-autopsy__head">
          <span className="pg-label">Autopsy</span>
          <span className="pg-autopsy__state" data-healed="false">
            <WarningCircle size={14} weight="light" aria-hidden="true" />
            waiting
          </span>
        </div>
        <p style={{ opacity: 0.6, fontSize: 13 }}>
          Recording — no turn data at this position yet.
        </p>
      </aside>
    );
  }

  return (
    <aside className="pg-autopsy" aria-label="Autopsy">
      <div className="pg-autopsy__head">
        <span className="pg-label">Autopsy</span>
        <span className="pg-autopsy__state" data-healed={healed ? "true" : "false"}>
          {healed ? (
            <CheckCircle size={14} weight="light" aria-hidden="true" />
          ) : (
            <WarningCircle size={14} weight="light" aria-hidden="true" />
          )}
          {healed ? "healed" : "regression"}
        </span>
      </div>

      {anomaly && autopsy ? (
        <div className="pg-verdict" data-healed={healed ? "true" : "false"}>
          <div className="pg-verdict__top">
            <span className="pg-label">Blamed turn</span>
            <span className="pg-verdict__delta">
              {healed ? "curve flat" : `${anomaly.kind} over threshold`}
            </span>
          </div>
          <div className="pg-verdict__main">
            <strong>{blameIndex !== null ? `t${blameIndex}` : "t—"}</strong>
            <div>
              <span className="pg-verdict__file">
                {blameTurn?.changedFiles?.length
                  ? blameTurn.changedFiles.join(", ")
                  : "files captured per checkpoint"}
              </span>
              <span className="pg-verdict__kind">
                {anomaly.kind} · {anomaly.severity}
                {blameIndex !== null ? ` · turn ${blameIndex}` : ""}
              </span>
            </div>
          </div>
          <div className="pg-verdict__actions">
            <button type="button" onClick={onJumpToBlame}>
              <Crosshair size={14} weight="light" aria-hidden="true" />
              Jump to blame
            </button>
            <button type="button" onClick={onRollback} data-healed={healed ? "true" : "false"}>
              <ArrowUUpLeft size={14} weight="light" aria-hidden="true" />
              {healed ? "Re-measured" : "Roll back"}
            </button>
          </div>
        </div>
      ) : (
        <div className="pg-verdict">
          <div className="pg-verdict__main">
            <strong>—</strong>
            <div>
              <span className="pg-verdict__file">no anomaly detected</span>
              <span className="pg-verdict__kind">
                the recorded samples stayed inside every threshold so far
              </span>
            </div>
          </div>
        </div>
      )}

      {selectedFile && (
        <div className="pg-selected">
          <div className="pg-selected__top">
            <span className="pg-selected__file">
              <FileCode size={14} weight="light" aria-hidden="true" />
              {selectedFile}
            </span>
            <button
              type="button"
              onClick={onClearSelection}
              aria-label="Clear selected tower"
            >
              <X size={14} weight="light" aria-hidden="true" />
            </button>
          </div>
          <div className="pg-selected__meta">
            <span>
              turn {turn.changedFiles.includes(selectedFile) ? activeTurn + 1 : "ambient"}
            </span>
            <span>{selectedTower?.owner ?? "module"}</span>
            <span>{selectedTower?.loc ? `${selectedTower.loc} loc` : "no fixture"}</span>
          </div>
          {!turn.changedFiles.includes(selectedFile) && (
            <p>No file changes for this tower in the selected turn.</p>
          )}
        </div>
      )}

      <div className="pg-block">
        <div className="pg-block__head">
          <span className="pg-label">Turn t{activeTurn + 1}</span>
          <span className="pg-block__role">
            {turn.role === "assistant" ? (
              <Robot size={14} weight="light" aria-hidden="true" />
            ) : (
              <User size={14} weight="light" aria-hidden="true" />
            )}
            {turn.role}
          </span>
        </div>
        <p className="pg-prompt">{turn.text}</p>
        {turn.changedFiles.length > 0 && (
          <div className="pg-files">
            {turn.changedFiles.map((file) => (
              <span key={file}>{file}</span>
            ))}
          </div>
        )}
      </div>

      <div className="pg-block pg-block--flush">
        <div className="pg-block__head">
          <span className="pg-label">Code diff</span>
          <span className="pg-block__count">
            {turn.diff.length > 0
              ? `${turn.diff.reduce((count, hunk) => count + hunk.lines.length, 0)} lines`
              : "empty"}
          </span>
        </div>
        {turn.diff.length > 0 ? (
          <details className="pg-details" open>
            <summary>
              {turn.diff.map((hunk) => hunk.file).join(", ")}
            </summary>
            <CodeDiff hunks={turn.diff} />
          </details>
        ) : (
          <div className="pg-empty">
            <GhostMark size={28} variant="glow" />
            <p>No file changes in this turn.</p>
          </div>
        )}
      </div>

      <div className="pg-block">
        <div className="pg-block__head">
          <span className="pg-label">Runtime metrics</span>
          <span className="pg-block__count">28 samples</span>
        </div>
        <MetricsChart
          metrics={session.metrics}
          activeTurn={activeTurn}
          onHoverTurn={onHoverTurn}
          onSelectTurn={onSelectTurn}
        />
      </div>

      <div className="pg-block">
        <div className="pg-block__head">
          <span className="pg-label">Fix prompt</span>
          <CopyButton value={autopsy.fixPrompt} label="Copy" />
        </div>
        <p className="pg-fix">{autopsy.fixPrompt}</p>
      </div>
    </aside>
  );
}
