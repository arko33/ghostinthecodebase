// GhostInTheCodebase — OpenCode adapter (Mode A)
// Loads as an OpenCode plugin (`.opencode/plugins/ghost/index.ts` auto-load or
// published as @ghostinthecodebase/opencode). Streams session/turn/file events
// to the local Ghost recorder (default http://127.0.0.1:5417/events).
//
// Recording degrades gracefully: if this plugin is absent, Ghost Mode B/C still
// records from the filesystem + runtime (turn ids are then marked estimated).

import { Plugin } from "@opencode/plugin"

const RECORDER = process.env.GHOST_RECORDER_URL ?? "http://127.0.0.1:5417"
const DEBUG = process.env.GHOST_DEBUG === "1"

async function post(type, data = {}) {
  try {
    await fetch(`${RECORDER}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type, data, ts: new Date().toISOString() }),
      signal: AbortSignal.timeout(2000),
    })
  } catch (e) {
    if (DEBUG) console.error(`[ghost] ${type} -> ${e?.message ?? e}`)
  }
}

export default Plugin.define({
  id: "ghost",
  async setup(ctx) {
    if (DEBUG) console.error(`[ghost] adapter loaded — project ${ctx.location?.project?.canonical ?? "?"}`)

    // 1) Prompt admission — the authoritative turn boundary (Mode A identity).
    let registration = await ctx.session.hook("prompt", (event) => {
      void post("turn.started", {
        turnId: `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        prompt: event.prompt.text,
      })
    })

    // 2) Turn end + file metadata — normalize the server event stream.
    const controller = new AbortController()
    void (async () => {
      try {
        for await (const event of ctx.event.subscribe({ signal: controller.signal })) {
          const type = String(event?.type ?? "")
          if (DEBUG) console.error(`[ghost] ev ${type}`)
          // agent loop finished a response → turn.completed; recorder checkpoints
          if (type === "session.idle" || type === "message.updated") {
            void post("turn.completed")
          }
        }
      } catch (e) {
        if (DEBUG) console.error(`[ghost] stream: ${e?.message ?? e}`)
      }
    })()

    return () => {
      controller.abort()
      registration?.dispose?.()
    }
  },
})
