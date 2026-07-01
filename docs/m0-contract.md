# M0 — Contract diff + intercept allowlist

> **Verdict: weekend to first working round-trip (M2); ~2–3 weeks to full Conductor parity (M3).**
> The intercept surface is 3 routes; translation is straight field-mapping; pass-through is a stock
> reverse proxy (already built). Source-read from the three upstreams on 2026-06-30 — see
> [Sources](#sources). This supersedes the "unverified bodies" caveat in [`../PLAN.md`](../PLAN.md).

## The key architectural correction

The plan assumed Talaria *intercepts* an existing dashboard mission route. It doesn't — **the Hermes
dashboard `:9119` has no `/api/conductor/*` routes at all.** Its `/api/*` catch-all returns 404 for
anything unmatched (`hermes_cli/web_server.py:11042`). Meanwhile hermes-workspace's Conductor *calls*
`POST /api/conductor/missions` on `HERMES_DASHBOARD_URL` and, when it 404s, flips
`capabilities.conductor = false` and falls back to **native-swarm** (local tmux workers on `:3000`,
`src/routes/api/conductor-spawn.ts:449`).

So Talaria's real job: **SERVE the `/api/conductor/*` routes the dashboard lacks** (translating to
mission-control), and **pass everything else through** to the real `:9119`. This makes the
non-destructiveness guarantee *stronger* than the plan claimed:

- The routes Talaria answers are ones the real dashboard **404s anyway** → we add capability, never
  override native behavior.
- Unset `HERMES_DASHBOARD_URL` → workspace 404s conductor → native-swarm. 100% native, as before.
- Every other `:9119` route (164 of them) proxies byte-for-byte, including OAuth + websockets.

```
workspace Conductor ──POST /api/conductor/missions──► TALARIA ──translate──► mission-control POST /api/tasks
                     ──(all other /api/*, /assets, ws)─► TALARIA ──pass-through──► real :9119 dashboard (kanban-dashboard)
```

## Intercept allowlist (the safety contract)

**SERVE (Talaria answers; do NOT forward):**

| Method | Path | Purpose | Translates to (mission-control) |
|---|---|---|---|
| POST | `/api/conductor/missions` | create a mission | `POST /api/tasks` |
| GET | `/api/conductor/missions/{id}` | poll mission status (`?lines=`) | `GET /api/tasks/{id}` (map status) |
| DELETE | `/api/conductor/missions/{id}` | cancel mission | `PUT /api/tasks/{id}` `{status:"done"|cancelled}` |

**PLUS the capability probe** — the workspace decides `capabilities.conductor` by probing the
dashboard. Talaria must answer the probe affirmatively so the workspace uses remote dispatch instead
of native-swarm. **TODO(M1): capture the exact probe request** (method+path — likely
`GET/OPTIONS /api/conductor/missions` or a field in `GET /api/status`) by diffing a live workspace
boot with `HERMES_DASHBOARD_URL` → a logging proxy. This is the one remaining unknown; everything
else is source-confirmed.

**PASS THROUGH (everything else, byte-for-byte):** all 164 dashboard routes — `/api/status`,
`/api/sessions/*`, `/api/config/*`, `/api/skills/*`, `/api/mcp/*`, `/api/cron/*`, `/api/profiles/*`,
`/api/models/*`, `/api/dashboard/*`, `/assets/*`, the SPA fallback `/{path}`, and the 4 websockets
(`/api/pty`, `/api/ws`, `/api/pub`, `/api/events`). Allowlist-intercept: any route not matching
`/api/conductor/*` is forwarded untouched — including routes future Hermes versions add.

## Field-by-field: workspace mission → mission-control task

**Workspace → Talaria** (`POST /api/conductor/missions`, `conductor-spawn.ts:116`):
```jsonc
{ "name": "conductor-1735689600000",   // mission label
  "prompt": "<orchestrator system prompt + goal>" }
```
**Talaria → mission-control** (`POST /api/tasks`, `src/app/api/tasks/route.ts:174`):
```jsonc
{ "title":       "<name>",             // required
  "description": "<prompt>",
  "status":      "inbox",              // default; MC workflow: inbox→assigned→in_progress→quality_review→done
  "priority":    "medium",             // default
  "metadata":    { "talaria": { "source": "hermes-workspace", "mission_name": "<name>" } } }
```
**mission-control → Talaria → workspace:** MC returns `{ task: { id, ticket_ref, status, ... } }`;
Talaria shapes the conductor response the workspace reads (`conductor-spawn.ts:122`):
```jsonc
{ "id": "<task.id>", "name": "<name>", "session_id": "<task.ticket_ref or id>" }
```
**Status round-trip** (`GET /api/conductor/missions/{id}`): map MC task `status` →
workspace mission state. Suggested map: `inbox|assigned`→`planning`, `in_progress`→`executing`,
`quality_review`→`reviewing`, `done`→`complete`. (TODO(M3): confirm the exact state enum the
workspace UI expects for a *remote* mission vs the local `SwarmMission.state`.)

> **Scope finding (drives M3 + the upstream PR):** the workspace's *decomposed* and *broadcast*
> flavors go to its **local** `:3000` `/api/swarm-decompose` + `/api/swarm-dispatch`, **not** the
> dashboard — so a dashboard-proxy only captures the single Conductor "mission" path. Full parity
> (decomposition/broadcast → mission-control) needs either the upstream `HERMES_MISSION_API_URL` PR
> (recommended) or a second seam on the local endpoints. **M2 beachhead = single mission; M3 = parity.**

## Per-agent plugin ↔ mission-control (the adapter half)

Confirmed endpoints (correcting the scaffold's stubs, which used wrong paths):

| Op | mission-control endpoint | Body / notes |
|---|---|---|
| register | **`POST /api/agents/register`** | `{ name, role:"agent", capabilities:[], framework:"hermes" }` → `{ agent:{id,...}, registered }` |
| poll | `GET /api/agents/{id}/heartbeat` | → `{ status:"HEARTBEAT_OK"\|"WORK_ITEMS_FOUND", work_items:[{type,count,items:[…]}] }` |
| report | **`PUT /api/tasks/{id}`** | `{ status, outcome?, error_message?, resolution?, actual_hours? }` (NOT a `/report` subpath) |
| message | `POST /api/agents/message` | `{ from, to, content, type? }` (inter-agent, M3) |

**Auth (both bridge + plugin):** `x-api-key: <key>` header (also accepts `Authorization: Bearer`).
Global `API_KEY` = admin; per-agent keys live in MC's `agent_api_keys` (scoped roles). Task
create/report needs `operator+`. `src/lib/auth.ts:580`.

## mission-control Hermes adapter (M4 target)

MC already defines `FrameworkAdapter` (`src/lib/adapters/adapter.ts:56`): `register` / `heartbeat` /
`reportTask` / `getAssignments` / `disconnect`, each broadcasting via `eventBus`. A `hermes` adapter
mirrors `claude-sdk.ts`. MC even ships a nascent `/api/hermes` hook integration
(`.hermes/hooks/mission-control/`). Clean upstream PR — see [`../adapter/README.md`](../adapter/README.md).

## Deploy facts (corrects the stack — M5)

| | image | port | key env | data |
|---|---|---|---|---|
| **hermes-workspace** | `ghcr.io/outsourc-e/hermes-workspace:latest` ✅ published | `3000` | `HERMES_API_URL`, `HERMES_DASHBOARD_URL`, `HERMES_API_TOKEN`, `HERMES_PASSWORD` (required if non-loopback), `HERMES_HOME`, `HERMES_WORKSPACE_DIR` | vols `.hermes`, `/workspace` |
| **mission-control** | ⚠️ **no published image** — builds locally (`mission-control:latest`) | `3000` | `PORT`, `API_KEY` (auto-gen), `AUTH_SECRET` (auto-gen), `OPENCLAW_GATEWAY_HOST/PORT` | SQLite `/app/.data/mission-control.db`, vol `mc-data:/app/.data`; read-only rootfs + cap_drop hardening |

Stack compose updated to match (`../stack/docker-compose.yml`): workspace uses the real ghcr image;
mission-control switched to a **build context** (must `git clone builderz-labs/mission-control` +
`docker build` — vendoring TBD) with its real env + data volume.

## Sources

Source-read 2026-06-30 (shallow clones in scratch; not vendored):
- **hermes-workspace** `outsourc-e/hermes-workspace` v2.3.0 — `src/server/gateway-capabilities.ts`,
  `src/routes/api/conductor-spawn.ts`, `swarm-dispatch.ts`, `swarm-decompose.ts`, `docker-compose.yml`.
- **mission-control** `builderz-labs/mission-control` — `openapi.json`, `src/app/api/{tasks,agents}/*`,
  `src/lib/{auth,adapters}/*`, `docker-compose.yml`, `Dockerfile`.
- **hermes-agent** `NousResearch/hermes-agent` (vendored `ai/hermes-upstream`) —
  `hermes_cli/web_server.py` (164 routes + 4 ws), `dashboard_auth/{routes,middleware,public_paths}.py`.

## Open items (ranked)

1. **M1:** capture the exact conductor **capability-probe** request (the one unknown) via a logging proxy.
2. **M2:** implement `/api/conductor/missions` POST→`/api/tasks`; single mission round-trips to the board.
3. **M3:** status-state mapping fidelity; decomposed/broadcast parity → the `HERMES_MISSION_API_URL` upstream PR.
4. **M5:** vendor + pin mission-control build; compatibility matrix.
