# Talaria

> *Talaria: the winged sandals of Hermes, the thing that carries him between worlds.*

Talaria is a little bridge with a big job. It lets the slick Hermes-native UI
[**hermes-workspace**](https://github.com/outsourc-e/hermes-workspace) use a battle-tested,
framework-agnostic fleet manager, [**mission-control**](https://github.com/builderz-labs/mission-control),
as its brain. Best of both worlds, and you don't fork or patch either one. You just point one env var
at Talaria and you're off.

Want the long version (why, how, what we checked)? It's in [`PLAN.md`](./PLAN.md) and
[`docs/m0-contract.md`](./docs/m0-contract.md).

> **Where it's at:** M0 through M4 are done and *actually verified against a live stack* (2026-07-01),
> not just "compiles on my machine." Missions created in the workspace land as real tasks in
> mission-control, poll/cancel round-trip, every agent registers and heartbeats, and Hermes shows up
> as a first-class framework in mission-control. Run [`scripts/verify-stack.sh`](./scripts/verify-stack.sh)
> and watch it go green. What's left is the fun stretch goals (see [Milestones](#milestones)).

## Why bother

hermes-workspace is great at *thinking up* a plan (its Conductor decomposes missions like a champ),
but when it comes to *running* them it only knows one trick: spin up tmux workers on the one box it's
sitting on. That's fine until you want more than one box, or you want the work to survive a restart,
or you want to know what the whole fleet is spending.

mission-control already solves all of that: cross-host fan-out, a durable (SQLite) task queue, cost
and token governance, health checks and crash recovery, agent-to-agent messaging. So instead of
rebuilding any of it, Talaria just wires the workspace's brain into mission-control's muscle. And the
best part: **every node stays a full Hermes agent**, memory and skills and learning intact. We're
orchestrating smart agents, not dumb workers.

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

Three pieces, one repo:

| Path | Piece | What it does |
|---|---|---|
| [`bridge/`](./bridge) | **talaria-bridge** (Node/TS) | Sits in front of the dashboard `:9119`, serves the conductor routes, proxies the rest untouched. |
| [`plugin/talaria/`](./plugin/talaria) | **Talaria Hermes plugin** | Rides along on each agent (`plugins.enabled: [talaria]`). Registers the agent with mission-control, heartbeats for work, reports progress. One source dir, bind-mounted read-only into every agent. |
| [`adapter/`](./adapter) | **mission-control adapter** | A `HermesAdapter` that makes Hermes a first-class framework inside mission-control. Ready to PR upstream. |
| [`stack/`](./stack) | **docker stack** | Compose that wires workspace + mission-control + bridge onto the shared `edge` network. |

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

## Milestones

- **M0 (spike) ✅** ([`docs/m0-contract.md`](./docs/m0-contract.md)): the contract diff and the `:9119`
  allowlist. Headline finding: no `/api/conductor/*` on the dashboard, so Talaria serves them.
- **M1 (pass-through) ✅ live:** the dashboard works identically through Talaria. The conductor
  capability probe is `GET /api/conductor/missions` (wants `200` + JSON), and we serve it, so the
  workspace picks remote dispatch over native-swarm.
- **M2 (create) ✅ live:** `POST /api/conductor/missions` becomes a real mission-control task.
- **M3 (poll + cancel) ✅ live:** `GET`/`DELETE /api/conductor/missions/{id}` round-trip, with status
  mapped from the task. `done` stays human-gated.
- **M3 (adapter half) ✅ live:** the plugin registers each agent, heartbeats for assigned work, and
  reports progress. Verified end to end (register, get an assigned task via heartbeat, report it).
- **M4 (packaging + mc adapter) ✅ live:** installs via `plugins.enabled: [talaria]`, and the
  `HermesAdapter` makes Hermes first-class in mission-control (`GET /api/frameworks` lists `hermes`).
  PR-ready patch in [`adapter/`](./adapter).
- **M5 (OSS release) ✅ repo:** MIT, this README, a pinned compat matrix, the docker stack, a
  reproducible [`verify-stack.sh`](./scripts/verify-stack.sh), plus [`CHANGELOG`](./CHANGELOG.md) and
  [`CONTRIBUTING`](./CONTRIBUTING.md).

### Still on the wishlist

- **Decomposed and broadcast missions.** Those go through the workspace's *local* `:3000` endpoints,
  not the dashboard, so the bridge can't see them yet. The clean fix is a small upstream PR to
  hermes-workspace adding a `HERMES_MISSION_API_URL` override. That's next.
- **Actually running the pulled work.** Right now the heartbeat *pulls* assigned tasks; wiring them
  into the Hermes run loop so agents execute autonomously is the next layer.
- **Flip it on for the live fleet.** The plugin's staged on all 8 agents but still a no-op until we
  set the URL and recreate them.

## Compatibility matrix

Both upstreams move fast, so pin what you actually tested. This is the set we verified together
(2026-07-01):

| Talaria | hermes-workspace | mission-control | hermes-agent (dashboard) |
|---|---|---|---|
| 0.1.0 (unreleased) | v2.3.0, `ghcr.io/outsourc-e/hermes-workspace@sha256:2d2ba9aa…` | commit `d09e608` (build from source) | v0.16.0 (release 2026.6.5) |

## Kick the tires

```bash
cp stack/.env.example stack/.env          # fill in MISSION_CONTROL_API_KEY etc.
docker compose -f stack/docker-compose.yml up -d --build
./scripts/verify-stack.sh                 # should print ALL PASS
```

(mission-control has no published image, so it builds from source. See [`stack/README.md`](./stack/README.md).)

## License

MIT (see [`LICENSE`](./LICENSE)), same as both upstreams, so no copyleft headaches. Private for now,
going public when it's ready to share.
