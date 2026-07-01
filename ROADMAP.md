# Talaria roadmap & status

Milestone labels map to [`PLAN.md`](./PLAN.md). Everything marked "live" was verified against a
running stack ([`scripts/verify-stack.sh`](./scripts/verify-stack.sh) passes M1–M4).

## Where it's at (2026-07-01)

M0 through M4 are done and verified live. Missions created in hermes-workspace land as real
mission-control tasks, poll/cancel round-trip, every agent registers and heartbeats, and Hermes is a
first-class framework in mission-control. M5 (the repo/release side) is done.

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
