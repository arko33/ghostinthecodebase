// Collector: captures an OpenCode agent session (prompt/answer/diff) via the
// OpenCode SDK + SSE stream, and snapshots code state into a shadow git repo.
//
// matcha:todo scaffold stub — wire to `opencode serve` SSE + official SDK in the
// full build. The dashboard currently replays src/data/fixture.ts instead.

import type { Turn } from "@/src/types";

export interface CollectorHandle {
  start(): Promise<void>;
  stop(): Promise<void>;
  onTurn(cb: (turn: Turn) => void): void;
}

export interface OpenCodeCollectorOptions {
  /** Base URL of the OpenCode headless server (opencode serve). */
  baseUrl: string;
  sessionId: string;
}

export function createOpenCodeCollector(
  _opts: OpenCodeCollectorOptions,
): CollectorHandle {
  // matcha:todo connect to OpenCode SSE: session.messages, session.diff,
  // tool.execute.before/after, file.edited. Translate events into Turn objects
  // and commit each assistant turn to the shadow repo for diff + rollback.
  return {
    async start() {},
    async stop() {},
    onTurn() {},
  };
}
