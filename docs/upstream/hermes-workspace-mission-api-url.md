# Upstream PR — hermes-workspace: `HERMES_MISSION_API_URL`

Target: [`outsourc-e/hermes-workspace`](https://github.com/outsourc-e/hermes-workspace)
Patch: [`hermes-workspace-mission-api-url.patch`](./hermes-workspace-mission-api-url.patch)
(4 files, +57/-9)

## Title

`feat: HERMES_MISSION_API_URL — decouple Conductor mission dispatch from the dashboard URL`

## Body

### What

Adds an optional `HERMES_MISSION_API_URL` env var. When set, the workspace sends only its
**Conductor mission-dispatch calls** (`/api/conductor/*`: the capability probe, create, poll, cancel)
to that base URL. Everything else (sessions, skills, config, MCP, kanban, websockets, …) keeps going
to `HERMES_DASHBOARD_URL` exactly as before. When unset, `HERMES_MISSION_API_URL` **defaults to
`HERMES_DASHBOARD_URL`**, so the change is a no-op for existing setups.

### Why

Today the Conductor mission API is assumed to live on the dashboard (`:9119`). Teams who run a
dedicated fleet manager / orchestrator want to answer *just* the mission calls from that service
without having to reverse-proxy the entire dashboard in front of it. Right now that forces an
all-or-nothing choice: either point the whole dashboard URL at the proxy, or don't integrate.

This turns the existing "dashboard has conductor? use it : fall back to native-swarm" behavior into a
clean, opt-in seam: point `HERMES_MISSION_API_URL` at your orchestrator and the workspace uses it for
missions while the dashboard stays exactly where it is. It makes fleet-manager integrations a
sanctioned one-liner instead of a full-dashboard proxy hack.

### How

Mirrors the existing `gatewayFetch` / `dashboardFetch` split in `src/server/gateway-capabilities.ts`:

- Factor the shared request/auth body of `dashboardFetch` into a private `baseFetch(requestPath, init)`.
- Add `missionApiBase()` (`HERMES_MISSION_API_URL` normalized, else `CLAUDE_DASHBOARD_URL`) and a
  `missionFetch(path, init)` that targets it. Auth is injected identically, so the mission endpoint is
  expected to be dashboard-token compatible (a bridge can accept or ignore the token).
- Route the four `/api/conductor/*` call sites (`probeConductor`, `createDashboardConductorMission`,
  the mission poll, and `conductor-stop`'s cancel) through `missionFetch`.
- Document the var in `.env.example`.

No behavior change unless the operator sets the new var. No dependency changes.

### Verification status

The change is a small, mechanical refactor that mirrors the existing `gatewayFetch` / `dashboardFetch`
split, and it is a **no-op unless `HERMES_MISSION_API_URL` is set** (it falls back to
`HERMES_DASHBOARD_URL`). The receiving end is already proven: Talaria's bridge serves the
`/api/conductor/*` calls and round-trips missions to mission-control (create/poll/cancel), verified
end to end against a running stack.

What is *not* yet done: a full `hermes-workspace` image build to exercise the patched client at
runtime. Our build environment tripped on an unrelated pnpm `--frozen-lockfile` / approve-builds
issue (electron/esbuild install scripts), not on this change. Maintainer CI should confirm the build;
the diff itself is type-consistent with the surrounding code by inspection.

### Real-world use

This is the sanctioned integration point for **Talaria** (https://github.com/PackLedger/talaria), a
small MIT bridge that lets hermes-workspace drive a
[mission-control](https://github.com/builderz-labs/mission-control) fleet as its orchestration brain.
Talaria currently proxies the whole dashboard to answer conductor calls; with this var it only needs
to answer the mission calls, which is cleaner and lower-risk for everyone.
