# Changelog

All notable changes to Talaria. Milestone labels refer to [`PLAN.md`](./PLAN.md).

## [Unreleased] — 0.1.0

Initial working slice: hermes-workspace ↔ mission-control bridge + per-agent adapter plugin.
All milestones below verified live against a running stack on 2026-07-01
([`scripts/verify-stack.sh`](./scripts/verify-stack.sh) — all checks pass).

### Added
- **Bridge** (`bridge/`, Node/TS) — transparent reverse-proxy of the Hermes dashboard `:9119`.
  - **M1** pass-through: all 164 dashboard routes (incl. OAuth + 4 websockets) proxied byte-for-byte
    to the real dashboard; conductor capability-probe (`GET /api/conductor/missions`) served as
    `200 application/json` so the workspace uses remote dispatch instead of native-swarm.
  - **M2** mission create: `POST /api/conductor/missions {name,prompt}` → mission-control
    `POST /api/tasks`, response shaped for the Conductor.
  - **M3** status round-trip: `GET/DELETE /api/conductor/missions/{id}` poll + cancel, mapping
    mission-control task status → the workspace mission enum. Never forces the Aegis-gated `done`.
- **Fleet board** — the bridge serves the workspace's `/api/plugins/kanban/*` surface from
  mission-control, so the swarm/kanban board becomes a live view of the MC fleet (columns = MC
  statuses, cards = MC tasks, full CRUD; `done` stays Aegis-gated). Toggle `TALARIA_KANBAN_FROM_MC=0`.
  The conductor poll's `lines` are also enriched with the task's header + comment feed.
- **Plugin** (`plugin/talaria/`, Hermes standalone) — per-agent mission-control adapter.
  - **M3** register (`POST /api/agents/register`) + opt-in background heartbeat
    (`TALARIA_HEARTBEAT_SECONDS`) that polls `/api/agents/{id}/heartbeat` + reports via
    `PUT /api/tasks/{id}` (toward `quality_review`, never `done`). Safe no-op until configured.
- **mission-control adapter** (`adapter/`) — **M4** `HermesAdapter` making Hermes a first-class
  framework in mission-control; PR-ready patch + verification.
- **Stack** (`stack/`) — compose wiring workspace + mission-control + bridge on the shared `edge`
  network; `scripts/verify-stack.sh` reproduces the M1–M3 verification end-to-end.
- **Docs** — [`docs/m0-contract.md`](./docs/m0-contract.md) (the M0 contract diff + `:9119` allowlist),
  README with architecture + compatibility matrix.

### Key findings (verified against source)
- The Hermes dashboard has **no** `/api/conductor/*` routes — Talaria *serves* them (adds capability),
  it does not override native behavior. Unset `HERMES_DASHBOARD_URL` → 100% native.
- mission-control gates `done` behind **Aegis** approval; Talaria respects it (human-only Done).
- mission-control has no published image (builds from source, pinned `d09e608`).

### Not yet
- Decomposed/broadcast mission parity (those go workspace-local `:3000`) — needs the
  `HERMES_MISSION_API_URL` upstream PR to hermes-workspace.
- Executing pulled work inside the Hermes run loop (heartbeat pulls; in-agent dispatch is next).
- Enabling the plugin on the live PackLedger fleet (staged, not yet `--force-recreate`d).
