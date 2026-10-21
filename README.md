<p align="center">
  <img src="public/ghost.png" alt="GhostInTheCodebase" width="150" />
</p>

<h1 align="center">GhostInTheCodebase</h1>

<p align="center"><strong>See what the AI builds. Know when it breaks it.</strong></p>

<p align="center">
  <a href="https://ghostinthecodebase.vercel.app">Live demo</a> ·
  <a href="https://ghostinthecodebase.vercel.app/playground">Playground</a> ·
  <a href="#quickstart">Quickstart</a> ·
  <a href="#what-the-suite-covers">Test suite</a>
</p>

<p align="center">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-14-000?logo=nextdotjs&logoColor=white" />
  <img alt="three.js" src="https://img.shields.io/badge/three.js-r169-000?logo=threedotjs&logoColor=white" />
  <img alt="Tailwind" src="https://img.shields.io/badge/Tailwind-3.4-0f172a?logo=tailwindcss&logoColor=38bdf8" />
  <img alt="TestSprite" src="https://img.shields.io/badge/TestSprite-Season%204-a371f7" />
</p>

> **TestSprite tells you the PR is red. Ghost tells you which prompt turned it red.**

GhostInTheCodebase is a **black-box recorder and time-travel autopsy for AI coding
agents**. It records every agent turn, watches the app at runtime, attributes a
regression to the exact turn that introduced it, and rewinds the file in one
click. The same timeline is rendered as a 3D code city.

It is agent-agnostic by construction: Ghost watches the **filesystem and the
process**, not the agent. Cursor, Claude Code, Codex, OpenCode or a human with a
keyboard all produce the same recording.

---

## Why

Agentic coding moved the bottleneck from writing code to **understanding what was
written**. A pull request can be green on types and still leak memory, spin the
CPU, or slow a p95 down by 400ms. Existing tools answer one question well:

| Tool | Question it answers |
| --- | --- |
| CI / types | Does it compile? |
| TestSprite | Does the PR break the app? |
| **Ghost** | **Which turn broke it, and how do I undo it?** |

That last question is the gap this project fills. It is the layer behind the
maker, not another checker at the merge.

---

## The loop

| Step | What happens | Where it lives |
| --- | --- | --- |
| **01 Record** | A shadow git commit per change burst; runtime metrics sampled from the app; HTTP probe for latency and errors. | `src/collector`, `src/runner` |
| **02 Attribute** | Threshold check, trend slope, and a per-turn bisect name the turn that introduced the regression. | `src/autopsy/engine.ts` |
| **03 Reverse** | Roll the blamed file back to the pre-regression commit, re-measure, watch the curve flatten. | `src/collector/shadow-git.ts` |

---

## Live demo

- **Landing page:** https://ghostinthecodebase.vercel.app
- **Playground (the product surface):** https://ghostinthecodebase.vercel.app/playground

The playground replays a recorded session: seven turns, an unbounded in-memory
cache, a memory leak that climbs for two turns, an autopsy that blames turn 4,
and a heal that flattens the curve. Scrub the timeline, read the diff, rotate the
city, copy the fix prompt.

---

## Quickstart

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm run typecheck  # tsc --noEmit
```

Routes:

- `/` — landing page
- `/playground` — the dashboard (timeline, diff, metrics, 3D city)
- `/api/invoices` — the live target API that the test suite exercises

Deploy on Vercel with `framework: Next.js` and no extra configuration. No
environment variables are required: ownership is enforced in code, not behind a
flag.

---

## Architecture

```
ghostinthecodebase/
├─ app/
│  ├─ page.tsx                # landing
│  ├─ playground/page.tsx     # dashboard route
│  └─ api/
│     ├─ invoices/            # live target API (TestSprite pokes this)
│     ├─ health/              # runtime probe: cpu, rss, heap, uptime
│     └─ autopsy/             # engine verdict for the demo session
├─ src/
│  ├─ components/             # Dashboard, AIPanel, CodeDiff, MetricsChart, GhostCity
│  ├─ components/site/        # SiteNav, SiteFooter
│  ├─ data/fixture.ts         # recorded demo session
│  ├─ store/invoices.ts       # in-memory store, ownership-scoped reads
│  ├─ collector/opencode.ts   # OpenCode SSE adapter (stub)
│  ├─ collector/shadow-git.ts # commits, diffs and rollback per turn
│  ├─ runner/metrics.ts       # polls /api/health into MetricSample
│  └─ autopsy/engine.ts       # threshold + trend + attribution
├─ public/                    # brand assets
├─ docs/                      # OpenAPI spec + test PRD
└─ PRD_CONCEPT.md             # full product PRD
```

The dashboard replays `src/data/fixture.ts`. The capture path underneath it is
real: the metrics runner polls `/api/health`, the shadow-git collector commits
and diffs the worktree, and the autopsy engine turns the sample stream into a
verdict.

### The capture path

Four moving parts, no agent SDK:

| Module | Role |
| --- | --- |
| `app/api/health` | CPU from the delta of `process.cpuUsage()`, RSS, heap, uptime |
| `src/runner/metrics.ts` | Polls the probe, tags each sample with the active turn, counts failed probes as errors |
| `src/collector/shadow-git.ts` | `commitSnapshot`, `diffBetween`, `rollbackFile` — the substrate for diffs and one-click rollback |
| `src/autopsy/engine.ts` | Hard thresholds, sliding-window slope, attribution to the last assistant turn |

`GET /api/autopsy` runs the engine against the demo session, which keeps the
detectors inspectable and doubles as a smoke test: the demo must always produce a
leak of ~38 MB per sample, blamed on turn 4, healed by the end of the session.

---

## The target API

`app/api/invoices` simulates an app generated by an agent and left under
observation:

- `GET /api/invoices` — list invoices for the caller (`x-user-id` header).
- `POST /api/invoices` — create an invoice.
- `GET /api/invoices/:id` — **BOLA / IDOR** when `SECURE_MODE=off`: returns any
  invoice regardless of owner. With `SECURE_MODE=on`, a cross-owner read returns
  `403`.

Seed data is deterministic: users `alice` and `bob`, invoice `inv-1001` owned by
`alice`.

---

## What the suite covers

13 backend tests in the TestSprite 3.0 project, built from
[`docs/openapi.json`](docs/openapi.json) and executed against the **deployed URL**
(never localhost) by the `TestSprite` workflow on every pull request. The job is a
required check: a red suite blocks the merge.

| # | Case | Request | Asserts |
| --- | --- | --- | --- |
| 1 | Health probe | `GET /api/health` | `200`, `ok=true`, metrics in range |
| 2 | Leak detected | `GET /api/autopsy` | one `leak` anomaly on `mem`, severity `high` |
| 3 | Turn attribution | `GET /api/autopsy` | anomaly on `t5` blamed on `t4`, names `invoices.ts` |
| 4 | Alice lists | `GET /api/invoices`, alice | only alice's, never `inv-1002` |
| 5 | Bob lists | `GET /api/invoices`, bob | only bob's, never `inv-1001` |
| 6 | List unauthenticated | `GET /api/invoices` | `401`, no data |
| 7 | Owner reads own | `GET /api/invoices/inv-1001`, alice | `200`, seeded fields |
| 8 | Cross-owner read (BOLA) | `GET /api/invoices/inv-1001`, bob | `403`, no payload |
| 9 | Unknown id | `GET /api/invoices/inv-9999` | `404 not_found` |
| 10 | Read unauthenticated | `GET /api/invoices/inv-1001` | `401` |
| 11 | Create | `POST /api/invoices` | `201`, `USD` default, `draft` |
| 12 | Create without customer | `POST /api/invoices` | `422` |
| 13 | Create unauthenticated | `POST /api/invoices` | `401`, nothing created |

Run the same suite locally with `npx @testsprite/testsprite-cli ci run --project aa7e92b6-93ed-43a2-8cdf-9d4889269c86 --env default`.
That is the **catch** half of the demo; flipping the gate to `on` is the **green**
half. No verdict is ever fabricated in this repository — the suite is authored in
the portal against the deployed URL and executed by the GitHub App.

---

## Wiring TestSprite (catch, then green)

| PR | Change | `SECURE_MODE` | Suite |
| --- | --- | --- | --- |
| #1 | Scaffold, dashboard, 3D city | `off` | red — BOLA is caught |
| #2 | Ownership check on `GET /api/invoices/:id` | `on` | green — same suite passes |
| #3 | Polish, health endpoint, legend | `on` | green — regression guard holds |

Install the GitHub App from the TestSprite dashboard, enable **Run on Pull
Requests** and **Blocking PRs**, and every pull request gets a status check that
holds the merge.

---

## Status

| Area | State |
| --- | --- |
| Landing, playground, 3D city | done |
| Live target API + BOLA demo | done |
| TestSprite suite + GitHub App | pending — authored in the 3.0 portal |
| Shadow-git collector, metrics runner, autopsy engine | done — see the capture path |
| MCP read-only surface (`get_autopsy`) | planned |

---

## Credits

Built for **TestSprite Season 4**. Stack: Next.js 14, React 18, three.js,
@react-three/fiber, Tailwind CSS, lucide-react.
