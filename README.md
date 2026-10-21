<div align="center">

<img src="publics/ghost.png" alt="GhostInTheCodebase" width="320" />

# GhostInTheCodebase

**See what the AI builds. Know when it breaks it.**

*Black-box recorder and time-travel autopsy for AI coding agents*

[![Next.js](https://img.shields.io/badge/Next.js_14-000000?style=flat-square&logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![three.js](https://img.shields.io/badge/three.js-000000?style=flat-square&logo=threedotjs&logoColor=white)](https://threejs.org)
[![TestSprite S4](https://img.shields.io/badge/TestSprite_Season_4-0EA5E9?style=flat-square)](https://www.testsprite.com)

</div>

---

> **TestSprite tells you the PR is red. Ghost tells you which prompt turned it red.**

Agentic coding moved the bottleneck from *writing* code to *understanding what was
written*. A diff can be green on types and still leak memory, spin the CPU, or
slow a p95 down by 400 ms.

| Tool | Question it answers |
| --- | --- |
| CI / types | Does it compile? |
| TestSprite | Does the PR break the app? |
| **Ghost** | **Which turn broke it — and how do I undo it?** |

Ghost is agent-agnostic by construction: it watches the **filesystem and the
process**, not the agent. Cursor, Claude Code, Codex, OpenCode, or a human with
a keyboard all produce the same recording.

---

## The loop

1. **Record** — a checkpoint per change burst, plus runtime metrics sampled from
   the app under observation (CPU, RSS, heap, latency, errors).
2. **Attribute** — thresholds, trend slopes, and per-turn bisect name the exact
   turn that introduced a regression.
3. **Reverse** — roll the blamed file back to the pre-regression state,
   re-measure, and watch the curve flatten.

## Surfaces

| Route | Purpose |
| --- | --- |
| `/` | Cinematic landing: the code city, record → attribute → reverse, autopsy bento. |
| `/playground` | The product surface: tape rail, 3D city, autopsy panel, timeline dock. |
| `/api/invoices` | Live target API exercised by the test suite. |
| `/api/invoices/:id` | Single-invoice endpoint with owner-scoped reads. |

The playground replays a deterministic recorded session: 7 agent turns, an
unbounded in-memory cache (`src/store/invoices.ts`), a leak of ~38 MB per
sample, and an autopsy that blames turn 4. The heal flattens the curve.

## Architecture

```
ghostinthecodebase/
├─ app/
│  ├─ page.tsx                 # landing
│  ├─ playground/page.tsx      # dashboard route
│  └─ api/invoices/            # live target API
├─ src/
│  ├─ components/              # Dashboard, AIPanel, CodeDiff, MetricsChart, GhostCity
│  ├─ components/site/         # landing engine: SceneLayer, GhostCanvas, Terminal, ...
│  ├─ data/fixture.ts          # the recorded demo session
│  ├─ store/invoices.ts        # in-memory store, ownership-scoped reads
│  ├─ collector/opencode.ts    # OpenCode session adapter (scaffold)
│  ├─ runner/metrics.ts        # runtime metrics sampler (scaffold)
│  ├─ autopsy/engine.ts        # threshold + trend + attribution
│  └─ types.ts                 # Turn, MetricSample, Session contracts
└─ publics/                    # brand assets (ghost.png)
```

No third-party runtime calls, no fabricated verdicts. If a number appears on
the dashboard, it comes from the fixture or from a real recording.

### Honest status

| Module | State |
| --- | --- |
| Landing, playground, 3D code city | **done** |
| Target API + ownership checks | **done** |
| Autopsy engine (engine.ts) | **done**, runs against the fixture |
| `collector/opencode.ts` adapter | **scaffold** — event contract defined, SSE wiring pending |
| `runner/metrics.ts` sampler | **scaffold** — `MetricSample` contract defined, polling loop pending |
| Shadow-git checkpoint / rollback | **planned** |

## Product direction 🧭

Ghost ships as **hybrid: a local recorder + a cloud dashboard.**

- **Ghost Local** runs on the developer's machine, next to the repository:
  filesystem watcher, checkpoints, runtime probes, agent adapters.
- **Ghost Cloud** (dashboard) owns accounts, projects, session history, and the
  autopsy view.
- **Agent adapters** normalize events from each agent into one internal event
  contract — an OpenCode adapter first, others to follow.

Recording works in three layers, from always-works to richest-context:

| Mode | Mechanism | Context quality |
| --- | --- | --- |
| **B** — filesystem + git | Watch the worktree, checkpoint per change burst | works with *any* agent, no turn identity |
| **C** — runtime monitoring | HTTP probes + process metrics against a baseline | evidence for the autopsy, not the cause |
| **A** — direct agent integration | Plugin/hook events from agents that support it (OpenCode plugins & hooks, Antigravity) | full session/turn identity |

Mode B and C make Ghost useful on day one; Mode A is added per agent once the
internal event contract is stable.

### Roadmap

| Milestone | Deliverable |
| --- | --- |
| MVP 1 | Local recorder persists a session to file; dashboard loads it |
| MVP 2 | Ghost Cloud: auth, projects, session API, dashboard |
| MVP 3 | CLI ↔ cloud pairing; optional, consented sync (metadata + metrics only, source code **never** by default) |
| MVP 4 | OpenCode adapter ships real session events into the recorder |
| MVP 5 | Additional agents, resilient sync, CI workflows |

## Quickstart

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm run typecheck  # tsc --noEmit
```

Deploy on Vercel with `framework: Next.js` — no environment variables required;
ownership in the demo API is enforced in code.

## Testing 🧪

The target API (`/api/invoices`) is the surface the TestSprite suite exercises:
list/create with auth (`401` when unauthenticated), owner-scoped reads
(`403` cross-owner, `404` unknown id, `422` invalid create). Keep the requests
authentic — a red suite is the point of the demo, and no verdict is ever
fabricated in this repository.

Built for **TestSprite Season 4** (October 2026).
