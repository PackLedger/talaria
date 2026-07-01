# Talaria 🪽👟

> *Talaria: the winged sandals of Hermes, the thing that carries him between worlds.*

Talaria is a **framework for running a Hermes fleet** with two front doors to the same agents:
[**hermes-workspace**](https://github.com/outsourc-e/hermes-workspace), the friendly cockpit for the
people doing the work (chat with any agent, spin up a mission, watch it run), and
[**mission-control**](https://github.com/builderz-labs/mission-control), the observable,
enterprise-grade console for the operators running the harness (fleet health, cost governance, RBAC,
the full task queue and telemetry). You declare your fleet once; Talaria wires both dashboards to the
same agents so the everyday view and the ops view never drift. Pick whichever pane of glass fits the
person in front of it.

You don't fork or patch either tool. Talaria is **two planes** in front of your fleet: a **gateway
plane** that multiplexes all your agent gateways (so one workspace can talk to every agent), and a
**dashboard plane** that bridges the management surfaces to mission-control. Adopt it incrementally as
a drop-in **bridge** in front of an existing setup, or run it as the **framework** that stands up and
commands the whole fleet.

(Status, milestones, and the wishlist live in [`ROADMAP.md`](./ROADMAP.md). The design rationale and
the wire-level contract are in [`PLAN.md`](./PLAN.md) and [`docs/m0-contract.md`](./docs/m0-contract.md).)

## Why bother

hermes-workspace is great at *thinking up* a plan (its Conductor decomposes missions like a champ),
but when it comes to *running* them it only knows one trick: spin up tmux workers on the one box it's
sitting on. That's fine until you want more than one box, or you want the work to survive a restart,
or you want to know what the whole fleet is spending.

mission-control already solves all of that: cross-host fan-out, a durable (SQLite) task queue, cost
and token governance, health checks and crash recovery, agent-to-agent messaging. So instead of
rebuilding any of it, Talaria wires the workspace's brain into mission-control's muscle. And the best
part: **every node stays a full Hermes agent**, memory and skills and learning intact. We orchestrate
smart agents, not dumb workers.

## How it works: two planes in front of the fleet

The workspace points its two URLs at Talaria. Talaria fans out to your whole fleet.

```
                         hermes-workspace UI
              HERMES_API_URL │            │ HERMES_DASHBOARD_URL
              (gateway plane) │            │ (dashboard plane)
                              ▼            ▼
        ┌──────────────────────────┐  ┌──────────────────────────────┐
        │ GATEWAY PLANE  :8642      │  │ DASHBOARD PLANE  :9119        │
        │ fleet multiplexer         │  │ management bridge             │
        │ • /v1/models = whole fleet│  │ • serves /api/conductor/*     │
        │ • /v1/chat routed by model│  │   + the kanban board from MC  │
        │   → the right agent, per- │  │ • proxies everything else to  │
        │   agent key, SSE streamed │  │   the real dashboard untouched│
        └──────────────┬───────────┘  └───────────────┬──────────────┘
          per-agent     │                 conductor +  │  pass-through
          routing       ▼                 kanban        ▼
   ┌────────┬────────┬────────┐      mission-control   Hermes dashboard :9119
   ▼        ▼        ▼        ▼      (tasks, cost,      (the real one, untouched)
 agent-1  agent-2  …      agent-N    RBAC, telemetry)
 gateway  gateway         gateway         ▲
   (each a full Hermes agent)             │ register / heartbeat / report
                                          └── via the Talaria plugin on each agent
```

The **gateway plane** exposes each agent as an OpenAI model (its `API_SERVER_MODEL_NAME`), so the
workspace's model switcher becomes the agent switcher: pick `dex-developer` and you're talking to Dex,
pick `sam-support` and you're talking to Sam. Each agent stays a full Hermes agent; Talaria just routes
the request (with that agent's key) and streams the reply back.

The **dashboard plane** does the management side. Fun bit we found: the Hermes dashboard **doesn't even
have** `/api/conductor/*` routes. It 404s them and the workspace falls back to local tmux workers. So
Talaria isn't hijacking anything there, it's *filling a gap*, answering the mission + kanban routes and
passing the other ~160 straight through to the real dashboard.

**Two ways to run it.** *Bridge mode:* drop Talaria in front of an existing Hermes + workspace, point
one env var, nothing else changes. *Framework mode:* declare your fleet in a manifest and let Talaria
command the topology and multiplex the whole thing. Same code, you just fill in more of the manifest.

### The pieces

| Path | Piece | What it does |
|---|---|---|
| [`bridge/`](./bridge) | **talaria-bridge** (Node/TS) | Both planes. Gateway plane multiplexes the fleet (`/v1/models`, model-routed chat); dashboard plane serves conductor + the kanban board from MC and proxies the rest untouched. |
| [`stack/fleet.json`](./stack/fleet.example.json) | **fleet manifest** | Declares your agents (model → gateway url + key). This is the "framework" input; Talaria routes off it. Gitignored (holds keys). |
| [`plugin/talaria/`](./plugin/talaria) | **Talaria Hermes plugin** | Rides along on each agent (`plugins.enabled: [talaria]`). Registers with mission-control, heartbeats for work, reports progress. One source dir, mounted read-only into every agent. |
| [`adapter/`](./adapter) | **mission-control adapter** | A `HermesAdapter` that makes Hermes a first-class framework inside mission-control. |
| [`stack/`](./stack) | **docker stack** | Compose that wires workspace + mission-control + bridge + the fleet network together. |

### The conductor path, end to end

1. **Probe.** On boot the workspace sends `GET /api/conductor/missions`. It only uses remote dispatch
   if that returns `200` + `application/json`, so the bridge serves exactly that (an empty mission
   list). Otherwise the workspace falls back to native-swarm, which is the safe default.
2. **Create.** `POST /api/conductor/missions {name, prompt}` becomes a mission-control
   `POST /api/tasks {title, description, …}`. The bridge returns `{id, name, session_id}` shaped the
   way the Conductor expects.
3. **Poll / cancel.** `GET`/`DELETE /api/conductor/missions/{id}` map the mission-control task back to
   the workspace mission record (`status` ∈ running/completed/failed/cancelled, plus `exit_code`).

### The plugin, end to end

Each agent's plugin talks to mission-control directly over REST: `POST /api/agents/register` on
startup, an opt-in background heartbeat (`TALARIA_HEARTBEAT_SECONDS`) that polls
`GET /api/agents/{id}/heartbeat` for assigned work, and `PUT /api/tasks/{id}` to report progress. It's
distributed the "one source, N mounts" way: the plugin lives once in this repo and every agent
bind-mounts that same directory read-only, so there's a single source of truth and no copy step.

### The fleet board (see mission-control *inside* the workspace)

The workspace's swarm/kanban board reads `/api/plugins/kanban/*` off the dashboard. Talaria serves
those from mission-control instead, so that board becomes a live view of the whole MC fleet: columns
are mission-control statuses (`inbox → assigned → in_progress → quality_review → done`), cards are MC
tasks (with the assignee = which agent). It's full CRUD, so creating a card creates a task and
dragging between columns moves it (dragging to `done` is politely refused, since that's the
human/Aegis-gated step). This is on whenever a brain is configured; flip it off with
`TALARIA_KANBAN_FROM_MC=0`. To get it you run in full-proxy mode (`HERMES_DASHBOARD_URL` → Talaria)
so the kanban traffic actually passes through.

### One workspace, the whole fleet

This is the point of the gateway plane. Your users open one hermes-workspace and every agent shows up
in the model switcher; picking one routes the whole chat to that agent's real gateway (native
streaming, that agent's memory and skills, all intact). No per-user setup, no juggling tabs, no
workspace fork. Add or remove agents by editing the fleet manifest.

Sessions come along for the ride: the session sidebar is a **fleet-wide history**, merged across every
agent and tagged by who owns each conversation (with per-agent token/cost right on the card). Open any
session and Talaria routes it back to the agent it belongs to.

**Current edge (honest):** the dedicated *agents-online* widget still resolves against the fleet's
*default* agent, since that call doesn't carry the model selector. Chat and sessions are fully
per-agent today; that one widget is the remaining bit.

## The "don't break anything" promise

Talaria routes; it never rewrites your agents. The guarantees:

- **Every node stays a full Hermes agent.** The gateway plane forwards chat/streaming to each agent's
  real gateway with that agent's own key. Memory, skills, the run loop, native subagents, all intact.
  Talaria picks *which* agent gets the request; it doesn't change how the agent answers.
- **Dashboard plane passes through byte-for-byte** (headers, auth, SSE, websockets). The only routes it
  answers itself are the conductor + kanban ones (and conductor is a gap the dashboard 404s anyway).
- **Allowlist, not denylist.** Anything Talaria doesn't explicitly recognize (including routes a future
  Hermes version adds) sails straight through.
- **Nothing is written to your agents.** Talaria never edits a Hermes file or config. In bridge mode
  it's fully reversible: unset the two env vars and you're 100% back to native. In framework mode you
  add the fleet manifest, but the agents themselves are untouched.
- **Secrets stay put.** The fleet manifest (with per-agent keys) is gitignored and mounted read-only;
  the plugin no-ops until you give it a mission-control URL.

One more: mission-control gates the final `done` on a task behind an approval step (its "Aegis" gate).
Talaria **does not** bypass that. Agents report their work up to `quality_review` and let the humans
sign off, which happens to line up nicely with how PackLedger already runs its Done column.

## Kick the tires

```bash
cp stack/.env.example stack/.env          # fill in MISSION_CONTROL_API_KEY etc.
cp stack/fleet.example.json stack/fleet.json   # declare your agents (model → gateway url + key)
docker compose -f stack/docker-compose.yml up -d --build
./scripts/verify-stack.sh                 # should print ALL PASS
```

Then point a hermes-workspace at Talaria (`HERMES_API_URL` → the gateway plane `:8642`,
`HERMES_DASHBOARD_URL` → the dashboard plane `:9119`) and every agent in your manifest shows up in the
model switcher. mission-control has no published image, so it builds from source. See
[`stack/README.md`](./stack/README.md) for the network prereqs and the pinned build commit.

## License

MIT (see [`LICENSE`](./LICENSE)), same as both upstreams, so no copyleft headaches. Private for now,
going public when it's ready to share.
