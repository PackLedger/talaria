# Talaria 🪽👟

> *Talaria: the winged sandals of Hermes, the thing that carries him between worlds.*

Talaria is a little bridge with a big job. It lets the slick Hermes-native UI
[**hermes-workspace**](https://github.com/outsourc-e/hermes-workspace) use a battle-tested,
framework-agnostic fleet manager, [**mission-control**](https://github.com/builderz-labs/mission-control),
as its brain. Best of both worlds, and you don't fork or patch either one. You point one env var at
Talaria and you're off.

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

## How the seam works

```
hermes-workspace UI
   │  Conductor → HERMES_DASHBOARD_URL  (point this at Talaria)
   ▼
┌─────────────────────────────────────────────┐
│  talaria-bridge  (this repo, MIT)            │
│  • proxies EVERY dashboard route byte-for-   │
│    byte (sessions/skills/config/MCP/ws)      │
│  • SERVES the /api/conductor/* routes the    │
│    real dashboard doesn't have, translating  │
│    them to mission-control REST              │
└─────────────────────────────────────────────┘
   │  everything else (pass-through)   │  conductor routes (served)
   ▼                                   ▼
Hermes dashboard :9119          mission-control  ──► N Hermes agents
(the real one, untouched)       (task queue, cost, RBAC, telemetry)
        ▲                                   ▲
        │  chat/streaming + gateway :8642   │  register / heartbeat / report
        │  NEVER go through Talaria         │  via the Talaria plugin on each agent
    hermes-workspace                    each Hermes agent
```

Here's the fun bit we found while building it: the Hermes dashboard **doesn't even have**
`/api/conductor/*` routes. It 404s them, and the workspace quietly falls back to running tmux workers
locally. So Talaria isn't hijacking anything. It's *filling in a gap*, answering routes nobody else
answers and passing the other ~160 straight through. That's why it's so safe (more on that below).

### The pieces

| Path | Piece | What it does |
|---|---|---|
| [`bridge/`](./bridge) | **talaria-bridge** (Node/TS) | Sits in front of the dashboard `:9119`, serves the conductor routes + the kanban board (from mission-control), proxies the rest untouched. |
| [`plugin/talaria/`](./plugin/talaria) | **Talaria Hermes plugin** | Rides along on each agent (`plugins.enabled: [talaria]`). Registers the agent with mission-control, heartbeats for work, reports progress. One source dir, bind-mounted read-only into every agent. |
| [`adapter/`](./adapter) | **mission-control adapter** | A `HermesAdapter` that makes Hermes a first-class framework inside mission-control. |
| [`stack/`](./stack) | **docker stack** | Compose that wires workspace + mission-control + bridge onto the shared `edge` network. |

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

**Honest limit:** the workspace's dedicated *agents-online* widget is fed by the Hermes gateway
(`:8642`), which Talaria never touches, so that specific panel still shows gateway agents, not MC
agents. The fleet *work* (tasks + who owns them) shows up on the board; a native MC agents-list panel
would need an upstream addition.

## The "don't break anything" promise

This is the whole ballgame, so we take it seriously. Talaria's blast radius is tiny on purpose:

- It **never touches the agent runtime** (gateway `:8642`): chat, streaming, the run loop, memory,
  skills, native subagents. The workspace's chat and `HERMES_API_URL` talk to the gateway directly,
  nowhere near Talaria.
- It **only sits in front of the dashboard** (`:9119`), and even there it passes everything through
  byte-for-byte (headers, auth, SSE, websockets). The only routes it answers itself are the conductor
  ones the dashboard didn't have anyway.
- **Allowlist, not denylist.** Anything Talaria doesn't explicitly recognize (including routes a future
  Hermes version adds) sails straight through.
- **One env var, fully reversible.** It's only active because `HERMES_DASHBOARD_URL` points at it.
  Unset that and you're 100% back to native, tmux workers and all. Talaria never writes to a single
  Hermes file.

One more: mission-control gates the final `done` on a task behind an approval step (its "Aegis" gate).
Talaria **does not** bypass that. Agents report their work up to `quality_review` and let the humans
sign off, which happens to line up nicely with how PackLedger already runs its Done column.

## Kick the tires

```bash
cp stack/.env.example stack/.env          # fill in MISSION_CONTROL_API_KEY etc.
docker compose -f stack/docker-compose.yml up -d --build
./scripts/verify-stack.sh                 # should print ALL PASS
```

mission-control has no published image, so it builds from source. See [`stack/README.md`](./stack/README.md)
for the network prereqs and the pinned build commit.

## License

MIT (see [`LICENSE`](./LICENSE)), same as both upstreams, so no copyleft headaches. Private for now,
going public when it's ready to share.
