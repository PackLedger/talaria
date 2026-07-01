# Phase 2 — Talaria's own UI

> Status: plan / not started. Phase 1 (the two-plane framework in front of the real hermes-workspace +
> mission-control) is the on-ramp and stays useful. Phase 2 makes Talaria a product with its own
> frontend and identity.

## The idea

Today Talaria is the seam *between* two external UIs. Phase 2 is Talaria's **own** UI: one app, one
identity, two faces over the same brain.

- **Simple view (for normies):** the friendly cockpit. Pick an agent, chat, kick off a mission, watch it
  run. No ops chrome, nothing scary.
- **Advanced view (for harness maintainers):** the full ops console. Fleet health, cost/token governance,
  the task board, agent roster, telemetry, RBAC.

Same two-plane brain underneath, one login, one design language, one release.

## Principles

1. **Not a fork.** Forking both upstreams is a maintenance trap. Instead, build our own shell and **pull
   in the components we need** from each (both are MIT, so we can lift freely) and drop the rest.
2. **The Phase 1 bridge becomes the internal API.** The gateway plane (`/v1/models`, model-routed chat,
   merged sessions) and mission-control's REST are the backends. The new UI is a client of Talaria, not a
   proxy in front of two apps.
3. **Two views, one app.** A single frontend with a mode toggle (or role-gated: normies land on simple,
   maintainers can flip to advanced). Not two separate apps.
4. **Incremental.** Ship the simple view first (chat + agent switcher), then layer the advanced view. Each
   is independently useful.
5. **Own the experience.** One design system, our branding, no upstream to track.

## Architecture

```
                 Talaria UI  (our app, one identity)
        ┌──────────────────────────────────────────────┐
        │  simple view (normies) │ advanced view (ops)  │
        └───────────┬───────────────────────┬──────────┘
                    │ chat / agents / sessions│ fleet / tasks / cost / telemetry
                    ▼                         ▼
        Talaria gateway plane          mission-control REST
        (/v1/models, model-routed      (agents, tasks, tokens/by-agent,
         chat, merged sessions)         activities, alerts, workspaces/RBAC)
                    │                         ▲
                    ▼                         │ register / heartbeat / report
              the agent fleet ───────────────┘ (Talaria plugin)
```

The UI talks to two backends: the gateway plane for the chat/agent experience, and mission-control's REST
for the ops data. Talaria may add a thin BFF (backend-for-frontend) layer if it's cleaner than the UI
hitting both directly (open question below).

## Tech

- **Framework:** React + TypeScript (both upstreams are React, which makes component lifting realistic).
  Pick one shell: Next.js (matches mission-control, good for the ops/data views) or Vite + TanStack
  (matches hermes-workspace, good for the chat/streaming UX). Decide based on which half is heavier to
  port; leaning Next.js since the ops surface is larger and MC is already Next.
- **Design system:** one component library + tokens for both views (so simple/advanced feel like one
  product). Adopt whichever upstream's styling is closer, or a neutral base (e.g. shadcn/Tailwind).
- **Auth/SSO:** reuse the existing Cloudflare Access / Google SSO gate; role drives which view a user sees.
- **Streaming:** the chat view needs SSE (already how the gateway plane streams).

## What to lift from each upstream (candidates)

Early task: a **component inventory** pass to mark each as lift-as-is / adapt / rebuild.

**From hermes-workspace (the chat/agent UX):**
- Chat thread + message rendering, streaming handling
- Model/agent switcher (becomes the agent picker over `/v1/models`)
- Session sidebar (over the merged `/api/sessions`)
- Conductor mission UI (create / poll / cancel)
- Optionally the swarm/kanban board view

**From mission-control (the ops/observability UX):**
- Agent roster with status + task stats + cost per agent
- Task board (kanban) + task detail
- Cost / token governance views (`tokens/by-agent`)
- Activity feed, standup, system-monitor, workload, alerts
- Workspace / RBAC / settings surfaces

## The two views

**Simple (normies) — the default landing:**
- Agent picker (from `/v1/models`)
- Chat with the selected agent (streaming, its memory/skills intact)
- "Start a mission" + a simple status card
- Maybe a lightweight "my recent conversations" (from merged sessions)
- Everything else hidden

**Advanced (maintainers) — one toggle away:**
- Fleet dashboard: agents online/idle/busy, per-agent cost/tokens, health
- Task board (the full MC kanban) + task detail
- Missions, sessions across the fleet, activity feed, alerts
- Cost governance, RBAC, config

## Milestones

- **P2.0 — Component inventory + shell decision.** Pick the framework + design system; audit which
  upstream components lift cleanly vs need a rebuild. Output: a component map + the tech decision.
- **P2.1 — Simple view MVP.** Our shell, agent picker + streaming chat over the gateway plane, our
  branding. This alone could replace hermes-workspace as the normie UI.
- **P2.2 — Advanced view MVP.** Fleet dashboard (agents + cost) + task board over mission-control REST,
  behind the mode toggle.
- **P2.3 — Missions + sessions + activity** in both views; polish the simple ↔ advanced handoff.
- **P2.4 — Identity + release.** Branding, docs, one deployable image; retire the two external UIs from the
  stack (Talaria UI is now the single front door).

## Open questions

- **BFF or direct?** Does the UI hit the gateway plane + MC REST directly, or does Talaria add a
  backend-for-frontend that unifies them (auth, shaping, one origin)? Leaning BFF for a clean single-origin
  app, but it's more to build.
- **Framework:** Next.js vs Vite/TanStack (see Tech). One decision that shapes how easily each half's
  components port.
- **How much to lift vs rebuild.** Lifting keeps parity fast but inherits upstream quirks; rebuilding is
  cleaner but slower. Decide per component in P2.0.
- **Where the simple ↔ advanced toggle lives**, and whether it's user-choice or purely role-gated.
- **Design system / branding** for Talaria as a product.

## Definition of done (first real cut)

A single Talaria UI, our branding, that a normie can open, pick any fleet agent, and chat with (P2.1),
and that a maintainer can flip to an ops view showing the live fleet + task board + cost (P2.2). At that
point the stack drops the two external UIs and serves the Talaria UI as the one front door.
