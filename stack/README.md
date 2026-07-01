# Talaria stack

Wires **hermes-workspace** (UI) + **mission-control** (brain) + **talaria-bridge** (seam) together
and onto the live PackLedger fleet. Standalone compose that joins the shared `edge` network created
by the root `packledger-services` compose.

## Topology

```
workspace.packledger.co ──(cloudflared, edge net)──► hermes-workspace
   HERMES_DASHBOARD_URL ─────────────────────────────► talaria-bridge :9119 ──► kanban-dashboard :9119  (live fleet dashboard, pass-through)
   HERMES_API_URL       ─────────────────────────────► agent-developer :8642   (live fleet gateway, NEVER via bridge)
                                                        talaria-bridge ─(intercept, M2)─► mission-control  ◄─register/heartbeat─ live 8 agents (Talaria plugin)
```

## Prereqs

- The root `packledger-services` stack is up (creates the `packledger-services_edge` network).
- The `ai/orchestration` fleet is up (provides `kanban-dashboard`, `agent-developer`, … on `edge`).

## Run

```bash
cp talaria/stack/.env.example talaria/stack/.env      # then fill MISSION_CONTROL_API_KEY etc.
docker compose -f talaria/stack/docker-compose.yml config          # validate
docker compose -f talaria/stack/docker-compose.yml --env-file talaria/stack/.env up -d --build
```

Local debug ports (bound to `127.0.0.1` only): bridge `:9119`, mission-control `:8700`,
workspace `:8711`.

## Expose (Cloudflare tunnel)

Routing lives in the Cloudflare dashboard (Zero Trust → Networks → Tunnels → Public Hostnames), not
in this repo. Add:

| Hostname | Service (over `edge`) |
|---|---|
| `workspace.packledger.co` | `http://hermes-workspace:3000` |

Gate it with Cloudflare Access (Google OAuth), consistent with the other AI UIs.

## Status / TODO

- **Images are unpinned** (`TODO(M5)`): `mission-control` and `hermes-workspace` reference
  placeholder tags; both likely need building from source. `docker compose config` validates the
  wiring without pulling. Actually starting them is M0→M5 work.
- **`TODO(M0)`**: confirm mission-control's internal port + env keys; confirm hermes-workspace's
  internal port; enumerate the `:9119` mission-route allowlist (drives `../bridge/src/intercept.ts`).
- **`HERMES_API_URL`** currently points at `agent-developer`; revisit whether it should target an
  identity-proxy router across the fleet (PLAN.md open question #1, M2).

See [`../PLAN.md`](../PLAN.md) for the full milestone plan and compatibility-matrix requirements.
