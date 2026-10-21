<div align="center">

<img src="publics/ghost.png" alt="GhostInTheCodebase" width="340" />

# GhostInTheCodebase

**See what the AI builds. Know when it breaks it.**

*Black-box recorder and time-travel autopsy for AI coding agents.*

[![Next.js](https://img.shields.io/badge/Next.js_14-000000?style=flat-square&logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React_18-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![three.js](https://img.shields.io/badge/three.js-0.169-000000?style=flat-square&logo=threedotjs&logoColor=white)](https://threejs.org)
[![TestSprite S4](https://img.shields.io/badge/TestSprite_Season_4-0EA5E9?style=flat-square)](https://www.testsprite.com)
[![License](https://img.shields.io/badge/license-demo-64748B?style=flat-square)](#license-–-usage--hackathon)

**[Live demo](https://ghostinthecodebase.vercel.app) · [Playground](https://ghostinthecodebase.vercel.app/playground) · [How it works](#-how-it-works) · [Features](#-features) · [Roadmap](#-product-direction--roadmap)**

</div>

---

> 🎯 **One-liner for judges:**
> **TestSprite tells you the PR is red. Ghost tells you *which prompt* turned it red — and rolls the file back.**

Agentic coding moved the bottleneck from *writing* code to *understanding what
was written*. A diff can be green on types and still leak memory, spin the CPU,
or slow a p95 down by 400 ms. Existing tools stop at "something is broken".

| Tool | Question it answers |
| --- | --- |
| Linter / CI / types | Does it compile? |
| TestSprite | Does the PR break the app? |
| **GhostInTheCodebase** | **Which agent turn broke it — and how do I undo it?** |

Ghost is **agent-agnostic by construction**: it watches the *filesystem and the
running process*, not the agent. Cursor, Claude Code, Codex, OpenCode, or a
human typing manually — they all produce the same recording.

![GhostInTheCodebase landing — the bottleneck story over the 3D code city](publics/landing1.png)

---

## 👤 The 60-second judge walkthrough

1. Open the **[playground](https://ghostinthecodebase.vercel.app/playground)** —
   it replays a recorded *7-turn agent session* over a demo invoice app.
2. **Scrub the tape dock** at the bottom: turn 3 adds an unbounded in-memory
   cache, turn 4 re-uses it blindly, and the app starts leaking ~38 MB per
   request.
3. Watch the **metrics chart** climb, then the **autopsy panel** opens its
   verdict: the leak is attributed to *turn 4*, naming the file that caused it.
4. Read the **AI panel**: it drafts the *heal prompt* that fixes the cache —
   copy it, paste it to your agent, and the curve flattens.
5. Every step is rendered in a **3D code city**: buildings are files, heat
   auras are runtime stress, so you *feel* the regression before you read it.

**The replay dashboard — tape rail, 3D city, autopsy verdict on turn 4:**

![Playground — code city with the blame focused on turn 4, diff + RSS chart crossing the threshold](publics/playgroundfocuson-t4.png)

**Full session view — seven turns, timeline dock at the bottom, live metrics:**

![Playground — full replay view with tape rail and timeline](publics/playground.png)

> 🔍 **Why this is honest:** the demo session is a committed fixture
> (`src/data/fixture.ts`), and every verdict is computed live by
> `src/autopsy/engine.ts` from that data — nothing is hard-coded into the UI.
> The recorder underneath is live and shipped (see the
> [status table](#-honest-status)).

---

## 🧩 Features

### What works today

| # | Feature | Where | Description |
| --- | --- | --- | --- |
| 1 | 🎬 **Cinematic landing** | `app/page.tsx` | Scroll-driven product story: the loop (record → attribute → reverse), autopsy bento, the hole/Green arc of the demo API. |
| 2 | 🖥️ **Replay dashboard** | `/playground` | Tape rail + timeline dock: scrub any point of the session, see the code *and* the runtime state at that instant. |
| 3 | 🏙️ **3D code city** | `src/components/GhostCity.tsx` | three.js + react-three-fiber. Files are buildings; runtime stress draws heat auras; autopsied turns pulse red then heal green. |
| 4 | 🧠 **Autopsy engine** | `src/autopsy/engine.ts` | Anomaly detection (threshold + sliding-window trend slope) over metric samples, plus **turn attribution** — bisects the sample history to name the turn that introduced the regression. |
| 5 | 🩻 **Diff viewer** | `src/components/CodeDiff.tsx` | Line-level before/after diff for any turn, wired to the blame panel. |
| 6 | 📈 **Metrics chart** | `src/components/MetricsChart.tsx` | CPU / RSS / heap / latency timeline rendered per turn boundary. |
| 7 | 🤖 **AI panel** | `src/components/AIPanel.tsx` | Reads the autopsy verdict and drafts the next *fix prompt* for the user's agent — the "heal" half of the loop. |
| 8 | 💳 **Live target API** | `app/api/invoices/*` | A realistic invoices API the suite can poke: auth, ownership, validation. It is the application Ghost observes. |

### Plugged in and running live

The capture layer is no longer a sketch — it ships in this repository and runs
today:

| Module | Contract | State |
| --- | --- | --- |
| `packages/ghost` CLI | `ghost watch / status / sessions / setup` — records real sessions into a shadow-git store | **done** — one curl line to install, no npm |
| `packages/ghost/lib/shadowgit.mjs` | checkpoints + diffs per change burst, never touches HEAD | **done** (throwaway index + `commit-tree`) |
| `packages/ghost/lib/probes.mjs` | `MetricSample` stream tagged with the active turn (polls `/api/health`) | **done** — runtime probes (Mode C) |
| `packages/opencode-plugin` | Mode A: streams real OpenCode session events into the recorder | **done** — posts file/tool events to the local recorder |
| Ghost Cloud (`/login`, `/pair`, `/api/v1/*`) | GitHub OAuth, device pairing codes, session sync to Neon Postgres | **done** — live on the public deployment |

> Ghost never needs your agent account. Mode B/C below record everything from
> the outside; Mode A upgrades fidelity per agent.

---

## ⛓️ How it works

### The loop

```mermaid
sequenceDiagram
    autonumber
    participant U as Developer
    participant A as Coding agent
    participant FS as Filesystem
    participant R as Ghost recorder
    participant M as Runtime monitor
    participant AT as Autopsy engine
    participant D as Dashboard

    U->>A: prompt
    A->>FS: edits code
    R->>FS: watches changes (file watcher)
    R->>R: checkpoint the change burst
    M->>A: polls app metrics (cpu, rss, latency)
    AT->>AT: detect anomaly vs baseline
    AT->>U: verdict: turn N caused the regression (with diff)
    D->>U: timeline + diff + city + attribution
    U->>U: accept rollback or copy the heal prompt
    M-->>AT: curve flattens ✔ heals confirmed
```

### Autopsy internals

```mermaid
flowchart LR
    S[Metric samples<br/>per turn] --> T{Hard threshold<br/>breach?}
    S --> P{Trend slope over<br/>sliding window?}
    T -->|yes| V[Mark anomaly<br/>type + severity]
    P -->|yes| V
    V --> B[Bisect sample history<br/>per turn boundary]
    B --> BL[Blamed turn + file<br/>+ evidence window]
    BL --> H{Re-measure after rollback}
    H -->|flat| OK[Confirmed heal]
    H -->|still rising| NO[Blame rejected<br/>must keep bisecting]
```

Anomalies detected on the demo session: **memory leak** (unbounded in-memory
cache), attributed to turn 4, severity `high`, confirmed healed at the end of
the session.

### Where Ghost sits — target architecture

```mermaid
flowchart TB
    subgraph DEV[Developer machine]
        subgraph AGENT[Coding agent — unchanged workflow]
            OC[OpenCode]
            AG[Antigravity / Cursor / Claude Code]
        end
        subgraph GHOSTLOCAL[Ghost Local]
            AD[Agent adapter<br/>A — events]
            FW[Filesystem watcher<br/>B — changes]
            SG[Checkpoints / diffs]
            RM[Runtime monitor<br/>C — probes]
            LQ[Local queue]
        end
        APP[(App under<br/>observation)]
    end
    subgraph GHOSTCLOUD[Ghost Cloud — dashboard]
        API[Session API]
        DB[(Metadata · metrics<br/>session summaries)]
        UI[Timeline · diff ·<br/>anomaly · autopsy]
    end
    OC -->|plugin events| AD
    AG -.->|optional adapter| AD
    AD --> FW
    FW --> SG --> LQ
    RM --> LQ
    APP --> RM
    LQ -->|consented sync:<br/>metadata + metrics,<br/>never source code| API --> DB --> UI
    HUB[Agent Tools Hub] -.->|discover ·<br/>install ·<br/>configure| GHOSTLOCAL
```

The demo dashboard in this repository is the **UX of Ghost Cloud**, replaying a
session that the recorder produced. Three recording modes keep Ghost useful on
day one and progressively richer:

| Mode | Mechanism | Context |
| --- | --- | --- |
| **B** — filesystem + git | watch the worktree, checkpoint every change burst | works with *any* agent, no turn identity |
| **C** — runtime monitoring | HTTP probes + process metrics vs. measured baseline | evidence for the autopsy, not the cause by itself |
| **A** — direct agent integration | plugin/hook events for agents that support them (OpenCode plugins, hooks, SSE; Antigravity equivalents) | full session/turn identity |

**Mode B/C first; Mode A per agent.** Autopsy never fabricates a turn id: if an
agent event provides one, Ghost uses it; otherwise attribution is time-based
and *labeled as estimated*.

---

## 🧭 Product direction & roadmap

Ghost ships as **hybrid: a local recorder + a cloud dashboard.** Neither a
pure SaaS (cloud servers cannot see your filesystem, your processes, or the
app running on your laptop) nor a pure CLI (results get hard to share,
review, and onboard onto).

- **Ghost Local** runs next to the repository: filesystem watcher,
  checkpoints/shadow-git, runtime probes, agent adapters, and a local queue.
  Recording must work fully **without any cloud account** — local-only mode is
  the default.
- **Ghost Cloud** owns accounts, projects, session history and the autopsy
  view. Foundation stack: **Vercel** for the dashboard + Session API and
  **PostgreSQL** for structured metadata, metrics, and summary verdicts.
  The cloud never reads files off your machine — the local recorder is the
  only thing that observes, and it syncs deliberately.
- **Agent adapters** normalize each agent's events into **one internal event
  contract**: a plugin watches OpenCode session/file/tool events, the adapter
  translates them, and the shared recorder + autopsy engine never change per
  agent. Antigravity and others plug in later without rewriting the engine.

**Agent Tools Hub is the doorway, not the workspace** — discover Ghost, pick
your agent, read compatibility + install steps there; recording always runs
on the user's machine, next to their code.

### The user journey (target)

1. Sign in, create a project, point it at a repository → `project_id`.
2. Connect the machine: Ghost Local authenticates as a **device** via a
   one-time pairing code confirmed in the browser — the agent's account is
   never OAuth'd into Ghost.
3. Turn on an agent adapter (OpenCode first). No adapter? Modes B/C still
   record; turn identity is then marked as **estimated, never invented**.
4. Ghost takes a baseline, watches changes, probes the running app.
5. The dashboard shows timeline, diff, metrics, autopsy — **local-only by
   default**, sync is explicit opt-in.

### What syncs to the cloud — an explicit policy

| Data | Policy |
| --- | --- |
| Project name, session ids, timestamps | sync |
| Runtime metrics + probe results | sync (configurable) |
| Autopsy summaries | sync (configurable) |
| Diffs and file names | opt-in, consent-gated |
| Agent prompts / responses | opt-in — may contain secrets |
| Full source code | **never by default** |
| Tokens, API keys, secrets | **never — scrubbed before any sync** |

```mermaid
timeline
    title Ghost milestones
    MVP 1 done : Local recorder persists a session : shadow-git store, dashboard replay
    MVP 2 done : Ghost Cloud - auth, projects, session API
    MVP 3 done : CLI + cloud pairing : consented sync, metadata and metrics only
    MVP 4 done : OpenCode adapter streams live session events : recorder accepts real turns
    MVP 5 next : Antigravity adapter : resilient sync : CI workflows : Agent Tools Hub listing
```

The recording modes and adapters are deliberately behind one **internal event
contract** (`src/types.ts`): agents vary, the engine does not.

Recording works in three layers, from always-works to richest-context:

| Mode | Mechanism | Context |
| --- | --- | --- |
| **B** — filesystem + git | watch the worktree, checkpoint every change burst | works with *any* agent, no turn identity |
| **C** — runtime monitoring | HTTP probes + process metrics vs. measured baseline | evidence for the autopsy, not the cause by itself |
| **A** — direct agent integration | plugin/hook events for agents that support them (OpenCode plugins & hooks, SSE; Antigravity equivalents) | full session/turn identity |

**Mode B/C are the base; Mode A is added per agent.** Autopsy never fabricates
a turn id: when an agent event provides one it is used; otherwise attribution
is time-based and explicitly *labeled as estimated*. Agent events (coding
activity) and runtime events (app condition) are two separate data streams —
the autopsy engine joins them only through timestamps, session identity,
checkpoints, and test evidence.

---

## 🗺️ Surfaces & API

### Web routes

| Route | Purpose |
| --- | --- |
| `/` | Landing: the loop, the city, the proof. No login needed. |
| `/playground` | The product surface: tape rail, 3D city, autopsy panel, timeline dock. |
| `/login` | Sign in with GitHub (OAuth) — the human half of Ghost Cloud. |
| `/pair` | Confirm a device pairing code from the `ghost` CLI. |
| `/api/invoices` | Live target API exercised by the test suite. |
| `/api/invoices/[id]` | Single-invoice read — the ownership demo surface. |
| `/api/auth/github`, `/api/auth/logout` | OAuth start + callback, session cookie end. |
| `/api/v1/pair` (+ `/confirm`) | Issue a time-boxed pairing code; agents confirm it after the human approves. |
| `/api/v1/sessions` | Session sync for paired devices (metadata, metrics, summaries — never source). |

### Target API contract

| Endpoint | Auth | Behavior |
| --- | --- | --- |
| `GET /api/invoices` | `x-user-id` header | Lists only the caller's invoices |
| `POST /api/invoices` | `x-user-id` header | Creates an invoice (validation enforced) |
| `GET /api/invoices/[id]` | `x-user-id` header | Owner-scoped read: `200` own · `403` cross-owner · `404` unknown |
| (any route, missing header) | — | `401` unauthenticated |

Seed data is deterministic: users `alice` and `bob`, invoice `inv-1001` owned
by `alice` — so every status code above is reproducible on demand.

### What the suite covers (test plan)

The API above is deliberately small and observable, so an end-to-end suite can
be asserted precisely:

**Suite status:** green — **24/24** (`23` unit-style backend tests + `1`
integration flow) against `https://ghostinthecodebase.vercel.app`. Verified
three ways:

1. **CLI batch executions** — TestSprite CLI, all tests passed
   (executions [`ddf5126a`](https://www.testsprite.com/dashboard-v3/o/24abe963-d8fe-5bb8-8011-903daea7f178/projects/b14ba0a9-90d6-4c20-873e-583c7783a9fc/execution/ddf5126a-c6e9-4436-baff-e48b4faad841) and later re-runs).
2. **GitHub Actions check** — `.github/workflows/testsprite.yml` reruns the
   suite on every pull request; it went green on
   [PR #5](https://github.com/arko33/ghostinthecodebase/pull/5),
   [PR #6](https://github.com/arko33/ghostinthecodebase/pull/6) and
   [PR #7](https://github.com/arko33/ghostinthecodebase/pull/7).
3. **Exported test code** — the exact tests TestSprite executes are committed
   under [`docs/testsprite-exports/`](docs/testsprite-exports) for full
   transparency.

The work behind that green: the suite flagged two real issues — a live BOLA
hole on preview (missing `SECURE_MODE` env) and per-instance state loss on
serverless — both fixed and narrated in `docs/test-prd.md` → *Suite
maintenance log*. The list/shape tests were then hardened to be
count-tolerant (the suite's own create tests legitimately add records on
shared instances) and the integration flow was re-synced to the deployed
contract after a test-code/signature mismatch caused portal-only failures.


| # | Case | Expected |
| --- | --- | --- |
| 1 | Health of the target API routes | routes respond, no 500s |
| 2 | `alice` lists invoices | only alice's; never `inv-1002`'s owner data |
| 3 | `bob` lists invoices | only bob's; never `inv-1001` |
| 4 | List without header | `401`, no data leak |
| 5 | `alice` reads own invoice | `200`, seeded fields |
| 6 | **BOLA check** — `bob` reads alice's invoice | `403`, empty payload |
| 7 | Unknown id | `404 not_found` |
| 8 | Create with valid payload | `201`, currency + status defaults |
| 9 | Create missing required field | `422` |
| 10 | Create unauthenticated | `401`, nothing created |
| 11 | Autopsy on fixture run | one `leak` anomaly, severity `high` |
| 12 | Attribution | blame names the introducing turn + file |
| 13 | Heal confirmed | metric curve flattens after the fix |

Cases 11–13 run the *actual* `src/autopsy/engine.ts` against the committed
fixture — the detector must always converge on the leak, blame turn 4, and
confirm the heal. **No verdict is fabricated in this repository:** if the
engine cannot prove it, the dashboard cannot show it.

---

## ✅ Honest status

| Area | State |
| --- | --- |
| Landing page + scroll story | done |
| Playground: tape rail, timeline dock, autopsy panel | done |
| 3D code city (three.js) | done |
| Target API: invoices + ownership (`401/403/404`) | done |
| Autopsy engine: thresholds, trend, attribution, heal check | done, exercised live against the fixture |
| Metrics chart + diff viewer driven by fixture data | done |
| OpenCode collector SSE wiring | done — Mode A plugin streams real session events (`packages/opencode-plugin`) |
| Metrics runtime sampler loop | done — Mode C probes poll `/api/health` and emit MetricSamples |
| Shadow-git checkpoints / one-click rollback | done — throwaway index + `commit-tree`, never touches HEAD |
| Ghost Cloud (auth, projects, session sync) | done — GitHub OAuth, device pairing, Neon Postgres (`/login` + `/pair`) |

The dashboard replays a recorded session end-to-end. The recorder underneath is
**live**: the Ghost CLI records real agent sessions into a shadow-git store and
syncs them to Ghost Cloud when a device is paired. Nothing in the UI fakes live
behavior: parts that are not wired yet are not presented as working.

---

## 🚀 Quickstart

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm run typecheck  # tsc --noEmit
```

Deploy on Vercel with `framework: Next.js` — no environment variables required;
ownership in the demo API is enforced in code, not behind a flag.

## 🧰 Install the Ghost CLI — one curl line, no npm

The recorder is a plain Node script (no packages, no build step). Requires
**Node.js >= 18** and **curl + tar** (both ship with macOS, most Linux distros,
and Windows 10+).

**macOS / Linux:**

```bash
curl -fsSL https://raw.githubusercontent.com/arko33/ghostinthecodebase/main/packages/ghost/install.sh | bash
```

**Windows (PowerShell):**

```powershell
curl -fsSL https://raw.githubusercontent.com/arko33/ghostinthecodebase/main/packages/ghost/install.ps1 -o ghost-install.ps1
powershell -ExecutionPolicy Bypass -File ghost-install.ps1
```

Both installers download the recorder from this repo, place it in `~/.ghost`,
and put a `ghost` command on your PATH. Then, from any project directory:

```bash
ghost status     # repo head, cloud pairing state, sync policy
ghost watch      # record: watch the working tree, checkpoint each change burst, sample runtime metrics
ghost sessions   # list sessions stored in .ghost
ghost setup      # optional: pair the device with Ghost Cloud (metadata-only sync; source code never leaves the machine)
```

## 🛠️ Stack

<details>
<summary><strong>Why these choices</strong> (click to expand)</summary>

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 14 (App Router) | server routes for the target API in the same process the dashboard runs in |
| UI | React 18, custom CSS tokens, Phosphor icons | full control of the cinematic look; no UI library fighting the layout |
| 3D | three.js + `@react-three/fiber` + `drei` | the code-city metaphor needs real 3D, not a canvas trick |
| Language | TypeScript strict-ish (`tsc --noEmit` gate) | the autopsy engine is logic that must not rot |
| Runtime data | committed fixture + in-memory store | deterministic demo, zero external services at runtime |

</details>

## 🧪 Testing philosophy

- **The red suite is the point.** The demo ships a hole in the API; the suite
  catches it; PR #2-fixed-style changes make it green. Enforcing ownership is
  the "green" half; the regression narrative is the "catch" half.
- The deployed dashboard replays the committed fixture, so the same demo view
  is reproducible with **no API key, no login, no network**.
- `npm run typecheck` is part of the workflow; UI work must not touch
  contracts in `app/api/*`, `src/autopsy/engine.ts`, or `src/types.ts`.

## ❓ FAQ

<details>
<summary><strong>Does Ghost replace TestSprite?</strong></summary>

No — it sits *behind* it. TestSprite answers "does the app break?" Ghost
answers "which agent prompt did it, and what is the minimal undo?".
</details>

<details>
<summary><strong>Do I need to change my agent?</strong></summary>

No. Mode B/C record from the outside — your workflow stays untouched. Mode A
adapters (OpenCode first) only *enrich* the recording with turn identity when
available.
</details>

<details>
<summary><strong>Is the demo session fake?</strong></summary>

It is a *committed, deterministic recording* (a fixture), and every verdict
shown for it is computed by the real engine at request time. Nothing is
hard-coded in the UI. The live capture path is being wired per the roadmap and
marked as such in the status table.
</details>

<details>
<summary><strong>Why in-memory store / why CPU-only metrics?</strong></summary>

Because it makes the regression *obvious and reproducible* for judges and
reviewers: a clean 38 MB-per-sample climb, blamed precisely. Production
probes (real processes, real p95) are exactly what the metrics sampler
scaffold grows into.
</details>

## 🏗️ Repository layout

```
ghostinthecodebase/
├─ app/
│  ├─ page.tsx                  # landing
│  ├─ playground/page.tsx       # playground route
│  ├─ login/page.tsx            # GitHub sign-in (Ghost Cloud)
│  ├─ pair/page.tsx             # device pairing confirm
│  ├─ styles/{landing,dashboard}.css
│  └─ api/
│     ├─ invoices/                  # live target API (+ [id])
│     ├─ auth/github/               # OAuth start + callback (+ logout)
│     └─ v1/                        # pair (+ confirm), sessions — Ghost Cloud sync
├─ src/
│  ├─ components/               # Dashboard, AIPanel, CodeDiff, GhostCity, MetricsChart
│  │  ├─ playground/            # AutopsyPanel, SessionBar, TimelineDock, city scene
│  │  └─ site/                  # landing engine: SceneLayer, GhostCanvas, Terminal, ...
│  ├─ data/fixture.ts           # the recorded demo session
│  ├─ store/invoices.ts         # in-memory store with ownership-scoped reads
│  ├─ collector/opencode.ts     # OpenCode event contract (TS mirror of the shipped plugin)
│  ├─ runner/metrics.ts         # MetricSample contract (TS mirror of ghost probes)
│  ├─ autopsy/engine.ts         # detection + attribution + heal check
│  └─ types.ts                  # Turn, MetricSample, Session contracts
├─ packages/
│  ├─ ghost/                    # the local recorder CLI — install.sh / install.ps1 (curl, no npm)
│  │  ├─ ghost.mjs              # setup / watch / status / sessions commands
│  │  └─ lib/                   # shadow-git checkpoints, session store, runtime probes
│  └─ opencode-plugin/          # Mode A adapter: streams OpenCode events to the recorder
├─ docs/
│  ├─ test-prd.md               # suite maintenance log (BOLA catch, per-instance findings)
│  └─ testsprite-exports/       # the exact test code TestSprite executes
└─ publics/ghost.png            # brand asset
```

## 🎓 Credits & meta

Built for **TestSprite Hackathon Season 4** (October 2026) — the pitch: every
other tool watches the *merge*; Ghost watches the *maker*.

- Live demo: <https://ghostinthecodebase.vercel.app>
- Playground: <https://ghostinthecodebase.vercel.app/playground>

### License — usage & hackathon

Shipped for evaluation in TestSprite Season 4. Built from scratch for this
event; reuse the *ideas*, credit the project.

<div align="center">

*Ghost stays. You code like always.*
<br/>**records · attributes · reverses**

</div>
