# Upstream hermes-workspace contributions

Three small changes to [`outsourc-e/hermes-workspace`](https://github.com/outsourc-e/hermes-workspace),
each opened as its own PR from the `joniler` fork (authored `jon@packledger.co`). Upstream merge is the
maintainers' call; for our own fleet we run a **combined image** that includes all three (see below).

| Patch | What | PR branch |
|---|---|---|
| [`hermes-workspace-mission-api-url.patch`](./hermes-workspace-mission-api-url.patch) | `HERMES_MISSION_API_URL` — decouple Conductor mission dispatch from the dashboard URL (no-op unless set) | `feat/hermes-mission-api-url` |
| [`hermes-workspace-dockerfile-pnpm-workspace.patch`](./hermes-workspace-dockerfile-pnpm-workspace.patch) | copy `pnpm-workspace.yaml` before install so a clean-clone `docker build` works on modern pnpm | `fix/dockerfile-copy-pnpm-workspace` |
| [`hermes-workspace-gateway-agents-roster.patch`](./hermes-workspace-gateway-agents-roster.patch) | add `/api/gateway/agents` so the Agents screen shows real agents (the fleet) instead of a stub | `feat/gateway-agents-roster` |

See [`hermes-workspace-mission-api-url.md`](./hermes-workspace-mission-api-url.md) for the detailed
write-up on the flagship change.

## The combined "fleet" image

The Talaria stack runs `packledger/hermes-workspace:fleet` = stock hermes-workspace + all three patches.
To (re)build it from a clean clone:

```bash
git clone https://github.com/outsourc-e/hermes-workspace
cd hermes-workspace
git apply /path/to/talaria/docs/upstream/*.patch
docker build -t packledger/hermes-workspace:fleet .
```

Then set `HERMES_WORKSPACE_IMAGE=packledger/hermes-workspace:fleet` in `stack/.env`. When the PRs merge
upstream, drop the patches and go back to the published `ghcr.io/outsourc-e/hermes-workspace` image.
