# Phase 2 — Talaria's own UI

> Status: **started (2026-07-01).** The app is scaffolded in [`ui/`](../ui) (Vite + TanStack Start),
> the design system is decided and built (**Mercury**, dark + light), and auth has landed (Google OAuth
> + username/password, each independently toggleable). Phase 1 (the two-plane framework in front of the
> real hermes-workspace + mission-control) is the on-ramp and stays useful. Phase 2 makes Talaria a
> product with its own frontend and identity.
>
> **Decided so far:** framework = Vite + TanStack Start · design system = **Mercury** (see below) ·
> auth = a pluggable, env-gated provider registry (Google first). **Next:** P2.1 — agent picker +
> streaming chat over the gateway plane.

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

- **Framework: Vite + TanStack (Start / Router). DECIDED.** React + TypeScript. This matches
  hermes-workspace, so the harder-to-port half (streaming chat, the agent/model switcher, the session
  sidebar, the conductor UI) lifts with minimal friction, and Vite gives fast dev. The trade: mission-
  control's ops/data views are Next.js and get ported into TanStack (data fetching + routing) rather than
  lifted as-is. That's the cheaper direction overall, since data-fetching/table/board views port more
  easily than live streaming chat. Practically: TanStack Start for the app + server routes (same shape as
  hermes-workspace's own API routes), TanStack Query for data, TanStack Router for the shell.
- **Design system: Mercury. DECIDED + BUILT.** A hand-rolled Tailwind v4 token system in the same
  cyberpunk-HUD family as hermes-workspace (deep-navy sci-fi, `framer-motion`) — deliberately *not* a
  component library, because both upstreams already are hand-rolled sci-fi (not shadcn look-alikes). We
  match hermes-workspace's `--theme-*` token *contract* exactly so its chat components lift with near-zero
  friction, but ship Talaria's own identity: Mercury-the-planet neutrals (graphite / basalt / regolith)
  with a violet→magenta neon accent. Two modes — `mercury` (dark) and `mercury-light`. Tokens live in
  [`ui/src/styles.css`](../ui/src/styles.css).
- **Auth/SSO: pluggable + env-gated. Google OAuth + username/password shipped.** Each provider is
  independently enable-able (enabled only when its flag is on *and* its secrets are present), via the
  registry in [`ui/src/server/auth/config.ts`](../ui/src/server/auth/config.ts). Sessions are stateless
  HMAC-signed cookies. Adding GitHub / Microsoft / generic OIDC is a small change. Role-drives-view and
  the Cloudflare Access gate still layer on top.
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

- **P2.0 — Component inventory + shell decision. ✅ (core done).** Framework (Vite + TanStack Start) and
  design system (Mercury) decided and built; the `ui/` shell, login, and auth are live. Both upstreams
  are vendored under [`vendor/`](../vendor) (gitignored) as lift sources. Still open: the per-component
  lift/adapt/rebuild map (weighted toward mission-control's Next→TanStack ports).
- **P2.1 — Simple view MVP. 🟡 in progress.** Shell + branding + auth done; **next up** is the agent
  picker + streaming chat over the gateway plane (`/v1/models`, model-routed chat). This alone could
  replace hermes-workspace as the normie UI.
- **P2.2 — Advanced view MVP.** Fleet dashboard (agents + cost) + task board over mission-control REST,
  behind the mode toggle.
- **P2.3 — Missions + sessions + activity** in both views; polish the simple ↔ advanced handoff.
- **P2.4 — Identity + release.** Branding, docs, one deployable image; retire the two external UIs from the
  stack (Talaria UI is now the single front door).
- **P2.5 (later) — All-in-one self-hosted super-dashboard.** Beyond the Hermes fleet, monitor local
  **inference stacks** (Ollama, vLLM, llama.cpp, LM Studio, TGI, …): health, loaded models, GPU/VRAM,
  tokens/sec. Turns Talaria into the single pane of glass for a self-hosted Hermes rig — the agents *and*
  the metal underneath them.

## Open questions

- **BFF or direct?** Does the UI hit the gateway plane + MC REST directly, or does Talaria add a
  backend-for-frontend that unifies them (auth, shaping, one origin)? Leaning BFF for a clean single-origin
  app, but it's more to build.
- ~~Framework~~ **Decided: Vite + TanStack** (see Tech). Implication for P2.0: mission-control's ops views
  are the ones needing a port (Next → TanStack), so weight the component inventory toward them.
- **How much to lift vs rebuild.** Lifting keeps parity fast but inherits upstream quirks; rebuilding is
  cleaner but slower. Decide per component in P2.0. (hermes-workspace components lift; mission-control
  views mostly rebuild-in-TanStack.)
- **Where the simple ↔ advanced toggle lives**, and whether it's user-choice or purely role-gated.
- ~~Design system / branding~~ **Decided: Mercury** — hand-rolled Tailwind v4 tokens (dark + light),
  violet→magenta on Mercury-planet neutrals; matches hermes-workspace's token contract so its chat
  components lift. See Tech.

## Definition of done (first real cut)

A single Talaria UI, our branding, that a normie can open, pick any fleet agent, and chat with (P2.1),
and that a maintainer can flip to an ops view showing the live fleet + task board + cost (P2.2). At that
point the stack drops the two external UIs and serves the Talaria UI as the one front door.
