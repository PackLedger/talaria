# Talaria

> *Talaria — the winged sandals of Hermes. The thing that carries Hermes between worlds.*

A drop-in **bridge**, shipped as a Hermes plugin, that lets the Hermes-native UI
[**hermes-workspace**](https://github.com/outsourc-e/hermes-workspace) drive
[**mission-control**](https://github.com/builderz-labs/mission-control) — a proven, agent-agnostic
fleet manager — as its orchestration brain, **without forking or modifying either tool**.

The full design rationale, verification status, and milestone plan live in [`PLAN.md`](./PLAN.md).

> **Status:** scaffold (M0 contract diff pending). This repo currently ships working skeletons with
> `TODO(M0)`/`TODO(M2)`/`TODO(M5)` seams — the mission-dispatch *translation* logic is intentionally
> empty until the M0 contract diff is done. See [Milestones](#milestones).

---

## Why

Native hermes-workspace gives smart mission *decomposition* (Conductor) but only **local, ephemeral**
execution (native-swarm = tmux workers on one box). mission-control adds a mature execution + fleet
layer Hermes lacks: cross-host fan-out, durable (SQLite) task state, fleet cost/token governance,
health monitoring + crash recovery, and inter-agent messaging. Talaria wires decomposition →
durable, distributed execution, while **every node stays a full Hermes agent** (memory, learning,
skills preserved).

## Architecture (the seam)

```
hermes-workspace UI
   │  Conductor → HERMES_DASHBOARD_URL  (point this at Talaria)
   ▼
┌─────────────────────────────────────────────┐
│  talaria-bridge  (this repo, MIT)            │
│  • reverse-proxies ALL dashboard endpoints   │
│    (sessions/skills/config/MCP) byte-for-byte│
│  • intercepts ONLY mission-dispatch routes   │
│    → translates to mission-control REST       │
└─────────────────────────────────────────────┘
   │  upstream (pass-through)        │  REST (intercept)
   ▼                                 ▼
Hermes dashboard :9119        mission-control  ──► N Hermes agents
(the real one; untouched)     (task queue · cost · RBAC · telemetry)
        ▲                                 ▲
        │  chat/streaming + gateway :8642 │  register / heartbeat / report
        │  NEVER traverse Talaria         │  via the Talaria plugin on each agent
    hermes-workspace                  each Hermes agent
```

Two artifacts, one repo:

| Path | Artifact | Role |
|---|---|---|
| [`bridge/`](./bridge) | **talaria-bridge** (Node/TS) | Central reverse-proxy of the Hermes dashboard `:9119`; intercepts mission dispatch → mission-control REST. |
| [`plugin/talaria/`](./plugin/talaria) | **Talaria Hermes plugin** | Installed on *each* Hermes agent (`plugins.enabled: [talaria]`). Plays the mission-control adapter role: register → heartbeat-poll → report. Distributed by read-only bind-mount (one source, N mounts). |
| [`adapter/`](./adapter) | mission-control adapter (upstream PR) | Staging notes for `src/lib/adapters/hermes/` — makes each agent first-class in mission-control (M4). |
| [`stack/`](./stack) | docker stack | Compose wiring hermes-workspace + mission-control + talaria-bridge, joined to the PackLedger `edge` network. |

## Non-destructiveness (hard requirement)

Talaria must never break Hermes's native behavior. The blast radius is deliberately tiny:

- **Never touches** the Hermes agent runtime / gateway (`:8642`): chat, streaming, run loop, memory,
  skill execution, plugins, native subagents. Workspace chat/streaming and `HERMES_API_URL` go
  **straight to the gateway**, not through Talaria.
- **Only sits in front of** the dashboard service (`:9119`): everything is passed through
  byte-for-byte (headers/auth/SSE/websockets); only the mission-dispatch routes are intercepted.
- **Allowlist-intercept, never denylist.** Unknown/new endpoints (incl. ones future Hermes versions
  add) pass straight through.
- **Opt-in and instantly reversible.** Active only because `HERMES_DASHBOARD_URL` points at Talaria.
  Unset it → 100% native behavior (incl. native-swarm dispatch). Talaria never edits Hermes files.

## Milestones

- **M0 — Spike (next task):** capture hermes-workspace's mission-dispatch payloads (single /
  decomposed / broadcast), map field-by-field to mission-control's `/api/tasks`, and enumerate the
  `:9119` route allowlist (mission=intercept vs native=pass-through). This *is* the safety contract.
- **M1 — Pass-through proxy:** dashboard works identically through Talaria, nothing intercepted.
- **M2 — Mission translation:** intercept + translate single-task dispatch → mission-control.
- **M3 — Decomposition + broadcast + status round-trip:** full Conductor parity.
- **M4 — Package as Hermes plugin + mission-control adapter PR.**
- **M5 — OSS release:** MIT, README, compat matrix, `docker compose` demo.

## Compatibility matrix

Both upstreams move fast; pin explicitly. **(TODO(M5): fill on first pinned release.)**

| Talaria | hermes-workspace | mission-control | NousResearch/hermes-agent |
|---|---|---|---|
| _unreleased_ | _TBD_ | _TBD_ | _TBD_ |

## License

MIT (see [`LICENSE`](./LICENSE)) — matches both upstreams, no copyleft friction. Repo is private
during scaffolding; intended public on OSS release (M5).
