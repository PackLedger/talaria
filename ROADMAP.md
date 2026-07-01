# Talaria roadmap & status

Milestone labels map to [`PLAN.md`](./PLAN.md). Everything marked "live" was verified against a
running stack ([`scripts/verify-stack.sh`](./scripts/verify-stack.sh) passes M1–M4).

## Where it's at (2026-07-01)

Talaria is now a **two-plane fleet framework**, all verified live:

- **Gateway plane (fleet multiplexer):** one hermes-workspace talks to the whole fleet. Each agent is
  an OpenAI model; `/v1/chat/completions` routes by model to that agent's real gateway (per-agent key,
  SSE streamed). Verified: chat to `dex-developer` → Dex, to `sam-support` → Sam.
- **Dashboard plane (management bridge):** conductor missions + the kanban board are served from
  mission-control; the rest of the dashboard passes through. Every agent registers/heartbeats/reports
  to mission-control via the plugin, and Hermes is a first-class MC framework.

M0–M4 + the fleet kanban view + the gateway multiplexer all pass `scripts/verify-stack.sh`.

## Milestones

- **M0 (spike) ✅** ([`docs/m0-contract.md`](./docs/m0-contract.md)): the contract diff and the `:9119`
  allowlist. Headline finding: the dashboard has no `/api/conductor/*` routes, so Talaria serves them.
- **M1 (pass-through) ✅ live:** the dashboard works identically through Talaria. The conductor
  capability probe is `GET /api/conductor/missions` (wants `200` + JSON), which we serve, so the
  workspace picks remote dispatch over native-swarm.
- **M2 (create) ✅ live:** `POST /api/conductor/missions` becomes a real mission-control task.
- **M3 (poll + cancel) ✅ live:** `GET`/`DELETE /api/conductor/missions/{id}` round-trip, status mapped
  from the task. `done` stays human-gated.
- **M3 (adapter half) ✅ live:** the plugin registers each agent, heartbeats for assigned work, and
  reports progress. Verified end to end.
- **M4 (packaging + mc adapter) ✅ live:** installs via `plugins.enabled: [talaria]`, and the
  `HermesAdapter` makes Hermes first-class in mission-control (`GET /api/frameworks` lists `hermes`).
  PR-ready patch in [`adapter/`](./adapter).
- **M5 (OSS release) ✅ repo:** MIT, README, pinned compat matrix, docker stack, reproducible
  `verify-stack.sh`, [`CHANGELOG`](./CHANGELOG.md), [`CONTRIBUTING`](./CONTRIBUTING.md).

## Workspace surface coverage (what shows mission-control)

The goal: the friendly hermes-workspace UI for everyday users, backed by mission-control's
enterprise-grade management for operators. What's reachable depends on where each workspace screen gets
its data. Talaria can only re-point **dashboard-fed** surfaces (`:9119`); **gateway-fed** ones (`:8642`,
chat/agents runtime) are deliberately untouched and would need a small upstream hook.

| Workspace surface | Data source | mission-control backing |
|---|---|---|
| Conductor missions | dashboard `/api/conductor/*` | ✅ done (bridge) |
| Swarm / kanban board | dashboard `/api/plugins/kanban/*` | ✅ done (bridge) |
| Dashboard overview — cron tile | dashboard `/api/cron/jobs` | 🟡 bridge-able (MC has `/api/cron`) — not yet built |
| Dashboard overview — status/agent tiles | dashboard `/api/status` | 🟡 bridge-able by augmenting the passthrough — not yet built |
| Cost / tokens | MC `/api/tokens/by-agent` exists, but the workspace has no dashboard-fed cost surface to inject into | 🔵 needs upstream hook |
| **Per-agent chat (any agent, one workspace)** | gateway `/v1/chat/completions` | ✅ done (gateway plane, model-routed) |
| Per-agent sessions / history | gateway `/api/sessions*` | ✅ done (merged fleet-wide, agent-tagged, routed by namespaced key) |
| Agents-online widget | gateway (no model selector) | 🟡 still resolves to the default agent |
| Chat / streaming | gateway `/v1/*` | ✅ multiplexed by the gateway plane (native streaming preserved) |
| Skills / MCP / config / memory | local + gateway | ⚪ stays Hermes-native by design |

Legend: ✅ done · 🟡 bridge-only, buildable now · 🔵 needs an upstream hermes-workspace change · ⚪ out of scope by design.

## Phase 2 — one product, its own identity (bookmarked)

> Full plan: [`docs/PHASE2-UI-PLAN.md`](./docs/PHASE2-UI-PLAN.md).

Today Talaria is the *seam* between two external UIs. The real flex is making it a **product** with its
own UI and its own identity. Not a fork of either upstream (that's a maintenance trap), but our own
frontend that **pulls in just the bits we need** from each (both are MIT, so we can lift components
freely) and drops the rest. One app, two faces:

- **Simple view (for normies):** the friendly cockpit. Pick an agent, chat, kick off a mission, watch
  it go. Nothing scary.
- **Advanced view (for harness maintainers):** the full ops console. Fleet health, cost/token
  governance, RBAC, the task queue, telemetry, the works.

Same brain underneath (the two-plane bridge from Phase 1 becomes the internal API), one login, one
design language, one release, no upstream to track. We cherry-pick the good components (the chat/agent
UX from hermes-workspace, the ops/board/cost views from mission-control), rebuild the shell around
them, and own the whole experience.

Open questions for when we start: which components are worth lifting vs. rebuilding, where the "simple ↔
advanced" toggle lives, and branding. Phase 1 (this repo as a framework in front of the two real tools)
stays the on-ramp for people who already run them.

## Still on the wishlist

- **Decomposed and broadcast missions.** Those go through the workspace's *local* `:3000` endpoints,
  not the dashboard, so the bridge can't see them yet. The clean fix is a small upstream PR to
  hermes-workspace adding a `HERMES_MISSION_API_URL` override (drafted in
  [`docs/upstream/`](./docs/upstream)).
- **Actually running the pulled work.** The heartbeat *pulls* assigned tasks today; wiring them into
  the Hermes run loop so agents execute autonomously is the next layer.
- **Flip it on for the live fleet.** The plugin is staged on all agents but stays a no-op until the
  mission-control URL is set and the agents are recreated.

## Compatibility

Both upstreams move fast, so pin what you actually tested. Verified-together set (2026-07-01):

| Talaria | hermes-workspace | mission-control | hermes-agent (dashboard) |
|---|---|---|---|
| 0.1.0 (unreleased) | v2.3.0, `ghcr.io/outsourc-e/hermes-workspace@sha256:2d2ba9aa…` | commit `d09e608` (build from source) | v0.16.0 (release 2026.6.5) |
