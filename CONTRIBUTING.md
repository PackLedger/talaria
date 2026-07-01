# Contributing to Talaria

Talaria is MIT-licensed. It has three parts — a Node/TS **bridge**, a Python Hermes **plugin**, and a
mission-control **adapter** — plus a docker **stack** that wires them to hermes-workspace and a fleet.

## Layout

| Path | What | Build / test |
|---|---|---|
| `bridge/` | dashboard reverse-proxy + conductor translation | `cd bridge && npm i && npm run build` (`npm run typecheck`) |
| `plugin/talaria/` | per-agent mission-control adapter (Hermes plugin) | `python3 -m py_compile plugin/talaria/*.py` |
| `adapter/` | mission-control `HermesAdapter` (upstream patch) | applied to a mission-control checkout |
| `stack/` | compose: workspace + mission-control + bridge | `docker compose -f stack/docker-compose.yml config` |
| `scripts/verify-stack.sh` | end-to-end smoke test (M1–M3) | run against an up stack |

## Dev loop

1. Bring up the stack (see [`stack/README.md`](./stack/README.md)) — needs the shared `edge` network
   and a reachable Hermes dashboard + agent gateway. mission-control builds from source
   (`stack/docker-compose.yml` documents the pinned commit).
2. Iterate on the bridge: `docker compose -f stack/docker-compose.yml up -d --build talaria-bridge`.
   Set `TALARIA_LOG_REQUESTS=1` to log all proxied requests (handy for capturing new routes).
3. Verify: `scripts/verify-stack.sh` (exits non-zero on the first failing check).

### Plugin distribution — "one dev instance, sync the rest"

The plugin lives once in this repo (`plugin/talaria/`). Each Hermes agent bind-mounts that *same*
directory read-only into `/opt/data/plugins/talaria` and opts in via `plugins.enabled: [talaria]` —
so there is a single source of truth and N synced mounts (no copy step). Edit the one directory;
recreate the agents to pick it up.

## Conventions

- **Non-destructive first.** The bridge must pass unknown routes through untouched (allowlist-intercept,
  never denylist). The plugin only reaches *out* to mission-control and never alters agent output.
- **Never bypass mission-control governance.** Do not force the Aegis-gated `done` transition;
  completion flows through mission-control's approval.
- Keep the compatibility matrix (README) honest — both upstreams move fast; pin what you verify.
- Match surrounding style; the bridge is strict TypeScript, the plugin is stdlib-only Python.

## Pull requests

Include what you verified (ideally a `verify-stack.sh` run) and update `CHANGELOG.md`. Upstream
contributions (the `HERMES_MISSION_API_URL` workspace PR, the mission-control adapter) are tracked in
[`docs/m0-contract.md`](./docs/m0-contract.md) and [`adapter/`](./adapter).
