# Talaria

> *Talaria — the winged sandals of Hermes. The thing that carries Hermes between worlds.*
> A drop-in **bridge**, released as a Hermes plugin, that lets **`hermes-workspace`** (the Hermes-native UI)
> drive **`mission-control`** (a proven, agent-agnostic fleet manager) as its "brain."

**Status:** finalized — ready for build handoff · **License (intended):** MIT · **Repo name:** `talaria`

---

## TL;DR

Build **Talaria**, an MIT-licensed bridge — shipped as an installable **Hermes plugin** — that lets
the Hermes-native **hermes-workspace** UI use **mission-control** as its fleet "brain." Integration
is **config-only on the workspace side** (point `HERMES_DASHBOARD_URL` at Talaria); Talaria
transparently proxies the dashboard (:9119) and intercepts *only* mission-dispatch calls, translating
them to mission-control's REST API. The Hermes agent runtime (:8642) is **never touched**, so native
behavior is preserved and the whole thing is **opt-in / instantly reversible**. Architecture premises
are primary-source verified (see *Verification status*). **First deliverable: the M0 contract diff**
(decides weekend-vs-month).

## Thesis

Keep the two best-of-breed tools unmodified. Insert one small bridge service that speaks
hermes-workspace's dashboard-mission contract on one side and mission-control's REST API on the
other. Ship it as an installable Hermes plugin so the whole thing is
`hermes plugins install <you>/talaria` + one env var. No forks required to *use* it.

We get the **Hermes-ecosystem-focused UI** we actually like, backed by a **more proven open-source
fleet manager** as the orchestration brain.

## Orchestration advantages (the "why")

Native hermes-workspace gives smart mission *decomposition* (Conductor) but only **local, ephemeral
execution** (native-swarm = tmux workers on one box). mission-control adds a mature **execution +
fleet** layer Hermes lacks natively. Talaria wires decomposition → durable, distributed execution.
What you gain over native:

1. **Cross-host fan-out** — a real task queue + per-agent heartbeat polling
   (`/api/agents/{id}/heartbeat`) across agents on *different machines*, vs one box's tmux workers.
2. **Durable task state** — SQLite-persisted; survives a workspace/UI restart (native swarm is
   ephemeral).
3. **Fleet-wide cost/token governance** — Hermes has **no** native fleet cost rollup.
4. **Health monitoring & crash recovery** — heartbeats + task reassignment; fills #344's documented
   "no crash recovery or health monitoring" gap.
5. **Inter-agent messaging** — mission-control exposes `/api/agents/message` + `/api/agents/comms`
   (verified), a coordination channel Hermes lacks natively (#344: agents "can't talk to each other").
6. **Heterogeneous fleets** — the adapter layer also speaks CrewAI / LangGraph / AutoGen / Claude
   SDK, so Hermes and non-Hermes agents share one board.
7. **Decoupled dispatch** — the REST brain is drivable from CLI / cron (scheduler) / CI / webhooks,
   not just the UI. The Hermes-native UI becomes one client of the fleet, not the single control point.
8. **Governance / multi-operator** — API-key auth, RBAC, workspace isolation (`/api/super/*`).

## It does NOT back away from Hermes's strong suits — it depends on them

Talaria's non-destructive design (never touches the gateway :8642) means **every node in the fleet
stays a full Hermes agent**: persistent memory, learning loop, skills, "grows with you." We
orchestrate *smart* nodes, not thin workers.

On the #344 "agent cognition gap," be precise — it has two halves, sourced from two places:

- **Intra-agent cognition** (one agent's memory / learning / skills / reasoning depth): filled by
  **Hermes itself**, and **preserved 100%** by Talaria. ✅ This is the half Hermes's strong suits
  cover — and the reason non-destructiveness is non-negotiable.
- **Inter-agent cognition** (agents talking + sharing state): Hermes can't do this natively. Talaria
  gets a meaningful chunk from **mission-control's `/api/agents/message` + `/api/agents/comms`** — a
  task-level coordination fabric.

So the combination = **smart Hermes nodes (intra-agent) + a messaging/coordination fabric
(inter-agent) = orchestrated multi-agent cognition.** The one genuinely-remaining gap is a true
**shared memory pool** (shared in-context reasoning state, #344's deepest phase): messaging
*approximates* it but isn't a single shared brain. **Forward path:** Hermes plugins can register
**memory backends** (verified), so a future Talaria can ship a shared-memory backend *as a Hermes
plugin* and close even that — the route is built into the architecture.

## Why this is the right shape (the key findings)

- **hermes-workspace has no UI plugin system — but doesn't need one.** Its Conductor reaches the
  mission backend through a single env var: **`HERMES_DASHBOARD_URL`** (default
  `http://127.0.0.1:9119`). Point it at Talaria and the workspace talks to us with **zero code
  changes on its side.** This is the linchpin.
- **mission-control has no plugin SDK either**, but exposes exactly the surfaces we need: a
  documented REST API (OpenAPI 3.1.0, title "Mission Control API") to drive — `/api/agents` (POST
  register, GET list), `/api/agents/{id}/heartbeat` (GET = poll for work), `/api/tasks`, plus
  `/api/agents/message` + `/api/agents/comms` for inter-agent messaging — and an adapter folder
  (`src/lib/adapters/`) where a **Hermes adapter is a clean upstream PR**. MIT-licensed.
  *(Verified against `openapi.json`; earlier `/api/agents/register` + `/api/tasks/queue` names were
  search-summary approximations — the real shape is `/api/agents` + heartbeat-poll.)*
- **Hermes itself *does* have a real plugin system** — `~/.hermes/plugins/`, a `plugin.yaml`
  manifest, `hermes plugins install owner/repo`, and an allow-list security model. **That is where
  Talaria's "plugin" actually lives and how people install it.**

## Architecture (the seam)

```
hermes-workspace UI
   │  Conductor → HERMES_DASHBOARD_URL  (point this at Talaria)
   ▼
┌─────────────────────────────────────────────┐
│  TALARIA  (our code, MIT)                    │
│  • intercepts mission-dispatch calls         │
│  • translates → mission-control REST schema  │
│  • reverse-proxies all OTHER dashboard       │
│    endpoints (sessions/skills/config/MCP)    │
│    straight through to the real :9119        │
└─────────────────────────────────────────────┘
   │  REST: /api/agents, /api/agents/{id}/heartbeat, /api/tasks, /api/agents/message
   ▼
mission-control  ──►  N deployed Hermes agents (registered via adapter)
   (fleet dispatch · cost · RBAC · telemetry)
```

**The catch we must handle:** `HERMES_DASHBOARD_URL` redirects the **whole** dashboard (port 9119
also serves sessions/skills/config/MCP), not just mission dispatch. So Talaria must **reverse-proxy
the non-mission endpoints untouched** and only intercept the mission ones. (The upstream PR below
gives a cleaner long-term path.)

## Non-destructiveness — preserving Hermes native functionality (HARD REQUIREMENT)

Talaria must never break Hermes's native behavior. The blast radius is deliberately tiny:

**What Talaria does NOT touch:**
- **The Hermes agent runtime** (gateway, port **8642**): chat, model streaming, jobs, plus the
  agent's run loop, memory, skill *execution*, plugins, `delegate_task`/native subagents. Talaria is
  nowhere near it.
- **The core workspace chat/streaming experience** also goes to the gateway (8642), **not** through
  Talaria.

**What Talaria DOES sit in front of:** only the dashboard service (port **9119**) — session/skills/
config/MCP browsing (passed through untouched) and mission dispatch (intercepted/translated).

**Design rules that make this safe:**
1. **Transparent pass-through by default; allowlist-intercept.** Forward all 9119 traffic byte-for-
   byte (headers, auth, SSE/streaming, websockets); only rewrite the specific mission-dispatch
   routes. Unknown/new endpoints — including ones future Hermes versions add — pass straight
   through. (A denylist would be fragile; use an allowlist.)
2. **Opt-in and instantly reversible.** Active only because `HERMES_DASHBOARD_URL` points at Talaria.
   Unset it → 100% native behavior restored (incl. native-swarm dispatch). **Talaria never edits
   Hermes's files, config, or the dashboard** — no residue.
3. **One intentional substitution, clearly bounded.** When active, Talaria replaces hermes-workspace's
   native-swarm mission dispatch (tmux workers) with mission-control dispatch. We swap the *fleet
   dispatch layer*, never the *agent runtime*. The agent executes tasks exactly as before; only who
   hands it the task changes.
4. **Preferred mode = the `HERMES_MISSION_API_URL` upstream PR** (see below): with it, the dashboard
   talks directly to native :9119 and Talaria only answers mission calls — removing the proxy risk
   surface entirely. Full-dashboard-proxy is the fallback for un-patched workspaces.

**Caveat / M0 dependency:** the safety guarantee rests on the allowlist being correct, which means
**verifying the exact 9119 route boundaries (mission vs. native) is an explicit M0/M1 deliverable.**

## What we ship (three artifacts, increasing ambition)

1. **The bridge service** — the core deliverable. Standalone (Node/TS to match both projects'
   stack). Config: `HERMES_DASHBOARD_URL` in + mission-control URL/API key out. MIT.
2. **A Hermes plugin wrapper** — `plugin.yaml` manifest so it installs via
   `hermes plugins install <you>/talaria`, respects the allow-list, and registers a tool/hook to
   launch the bridge. **This is the "plugin for open-source release."**
3. **A mission-control Hermes adapter (upstream PR)** — `src/lib/adapters/hermes/` so each Hermes
   agent's register/heartbeat/task-report is first-class in the proven brain.

## Recommended upstream contribution (de-risks everything)

Send hermes-workspace a tiny PR adding a **`HERMES_MISSION_API_URL`** override that decouples
mission dispatch from the dashboard URL. That turns their "conditional fallback" into a true
pluggable interface — then Talaria no longer has to proxy the whole dashboard, just answer mission
calls. Good for the ecosystem, and it makes our integration officially sanctioned rather than a
redirect hack.

## Milestones

- **M0 — Spike (½–1 wk):** (a) Capture hermes-workspace's actual mission-dispatch request/response
  payloads (one task / decomposed mission / broadcast) and map field-by-field to mission-control's
  `/api/tasks` schema. (b) Enumerate the 9119 routes and classify each as **mission (intercept)** vs
  **native (pass-through)** — this list *is* the safety allowlist. Output: a contract diff + the
  intercept allowlist. **Go/no-go — tells us whether the shim is a weekend or a month.**
- **M1 — Pass-through proxy:** Talaria proxies 9119 transparently (headers/auth/SSE/websockets
  byte-for-byte); workspace works **identically** through it with nothing intercepted yet. Proves
  native functionality is preserved before we translate anything.
- **M2 — Mission translation:** Intercept + translate single-task dispatch → mission-control; tasks
  appear on the fleet board and route to a real agent.
- **M3 — Decomposition + broadcast + status round-trip:** Full Conductor parity; cost/telemetry
  visible in mission-control, status reflected back in the workspace.
- **M4 — Package as Hermes plugin** + the mission-control adapter PR.
- **M5 — OSS release:** repo, MIT license, README with the architecture diagram, `docker compose`
  demo wiring workspace + Talaria + mission-control + 2 mock Hermes agents, version-pin
  compatibility matrix.

## Open-source release specifics

- **License:** MIT (matches both deps — no copyleft friction).
- **Versioning:** publish a **compatibility matrix** (Talaria vX ↔ hermes-workspace vY ↔
  mission-control vZ) — both move fast, so this is non-negotiable.
- **Positioning:** "Use the Hermes-native UI you already like with a proven, agent-agnostic fleet
  manager as the brain." List on `awesome-hermes-agent` / Hermes Atlas.

## Risks to size at M0, before committing

- **Schema drift** across two fast-moving APIs → mitigated by the compat matrix + the upstream
  `HERMES_MISSION_API_URL` PR.
- **Two sources of truth** (both tools track cost + task state): decide early that **mission-control
  owns the task queue and cost ledger**; the workspace is a view.
- **Cross-host queue semantics:** confirm mission-control dispatches cleanly to agents on *different*
  hosts (its gateway-optional standalone mode suggests yes — verify in M2).

## Reference projects

| Project | Role | Notes |
|---|---|---|
| `outsourc-e/hermes-workspace` (~5.9k★, MIT) | **UI** | Hermes-native; Conductor + `HERMES_DASHBOARD_URL` seam |
| `builderz-labs/mission-control` (~5.5k★, MIT) | **Brain** | Agent-agnostic fleet manager; REST API + adapter layer |
| `NousResearch/hermes-agent` | **Runtime** | Real plugin system (`~/.hermes/plugins/`, `plugin.yaml`) |

## Verification status (primary-source checked)

Confirmed against repos/docs (quotes, not inference): the **8642 gateway / 9119 dashboard** port
split; `HERMES_DASHBOARD_URL=http://127.0.0.1:9119` + `HERMES_API_URL=http://127.0.0.1:8642`;
Conductor's "dashboard mission API → `mode: native-swarm`" fallback; the Hermes plugin system
(`hermes plugins install user/repo`, `plugin.yaml`, `~/.hermes/plugins/`, allow-list, disabled by
default, can register tools/hooks/**memory backends**); mission-control's OpenAPI 3.1 surface incl.
`/api/agents`, `/api/agents/{id}/heartbeat`, `/api/tasks`, `/api/agents/message`, `/api/agents/comms`.
**Residual risk:** exact request/response *bodies* are still M0 source-reading work (web fetches
summarize). The safety guarantee rests on the 9119 intercept allowlist, verified in M0/M1.

## Open questions (resolve during build, not blockers)

1. Where does the bridge run — a sidecar next to each agent host, or one central instance? (Decide
   with cross-host findings at M2.)
2. Do we maintain the mission-control Hermes adapter as an upstream PR, or vendor it until merged?

## Handoff notes

**Decisions locked:** name = **Talaria**; license = **MIT**; stack = **Node/TS** (matches both deps);
**mission-control owns the task queue + cost ledger**, the workspace is a view; **preferred
integration mode** = the `HERMES_MISSION_API_URL` upstream PR, with full-dashboard-proxy as the
fallback for un-patched workspaces.

**Reference repos:** `outsourc-e/hermes-workspace` (UI), `builderz-labs/mission-control` (brain),
`NousResearch/hermes-agent` (runtime + plugin host).

**Definition of done for M0** (the first task, see *Next action*): (1) a field-by-field map of
hermes-workspace's three Conductor dispatch shapes — single task / decomposed mission / broadcast —
onto mission-control `/api/tasks`; (2) the **9119 route allowlist** (mission = intercept vs native =
pass-through), which *is* the safety contract; (3) a weekend-vs-month effort call. All three read
from source, not summaries.

---

## Next action

**M0 contract diff** — pull hermes-workspace's mission-dispatch payloads and map them against
mission-control's `openapi.json`. That single artifact decides weekend-vs-month and unblocks M1.
