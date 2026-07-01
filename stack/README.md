# Talaria stack

Brings up the whole thing: **hermes-workspace** (the cockpit) + **mission-control** (the ops console)
+ **talaria-bridge** (both planes), wired to your fleet. `docker compose up` and you have the fleet
framework running.

## Topology

```
                         hermes-workspace
        HERMES_API_URL ──►│              │◄── HERMES_DASHBOARD_URL
       (gateway plane)    ▼              ▼    (dashboard plane)
                  talaria-bridge :8642   talaria-bridge :9119
                        │                      │
       routes /v1/chat by model               ├─ serves /api/conductor/* + kanban ─► mission-control
       + merges /api/sessions                 └─ proxies the rest ─► real Hermes dashboard
                        │
                        ▼
        agent-1 … agent-N gateways (the fleet, from fleet.json)
```

## Prereqs

- The root `packledger-services` stack is up (creates the `packledger-services_edge` network).
- Your Hermes fleet is up. Talaria reaches the agent gateways over the fleet network — this stack
  joins `ai_default` (the `ai/orchestration` fleet net); change it in `docker-compose.yml` if yours
  differs.

## Run

```bash
cp .env.example .env                 # fill MISSION_CONTROL_API_KEY + HERMES_PASSWORD
cp fleet.example.json fleet.json     # declare your agents: model → gateway url + API_SERVER_KEY
docker compose up -d --build
../scripts/verify-stack.sh           # should print ALL PASS
```

`fleet.json` is the **fleet manifest** (and is gitignored, since it holds the per-agent keys). Each
entry maps a model name (the agent's `API_SERVER_MODEL_NAME`) to its gateway URL and key. Talaria
exposes each as a model, so the workspace's model switcher becomes the agent switcher.

Local debug ports (bound to `127.0.0.1`): dashboard plane `:9119`, gateway plane `:8642`,
mission-control `:8700`, workspace `:8711`.

## Expose (Cloudflare tunnel)

Routing lives in the Cloudflare dashboard (Zero Trust → Networks → Tunnels → Public Hostnames). Add
`workspace.packledger.co` → `http://hermes-workspace:3000` and gate it with Cloudflare Access, like
the other AI UIs.

## Notes

- **mission-control has no published image** — build it from source (pinned commit `d09e608`); see the
  comment in [`docker-compose.yml`](./docker-compose.yml).
- **hermes-workspace** is the published `ghcr.io/outsourc-e/hermes-workspace:latest`.
- Two of the workspace's surfaces still ride the workspace-native path (out of Talaria's reach): the
  dedicated *agents-online* widget resolves to the fleet's default agent. Chat, sessions, missions,
  and the kanban board are all per-agent / fleet-wide today.
