# Talaria 🪽👟

> *Talaria: the winged sandals of Hermes, the thing that carries him between worlds.*

**Talaria is a multiplayer-first agentic business platform.** Humans and AI agents share the same
boards, tickets, and teams and work them together in real time — with **sensible guardrails** that keep
a human in the loop on the decisions that matter. Every agent in the fleet is a full
[**Hermes**](https://github.com/outsourc-e/hermes-workspace) agent: memory, skills, and run loop intact.
Talaria is the surface your whole organization — people and agents — actually works on.

- **Multiplayer-first.** Boards are live: teammates and agents see each other's changes as they happen
  (Redis pub/sub → SSE). Teams, sharing, watchers, comments, activity — collaboration is the default,
  not a bolt-on.
- **Agentic business platform.** A polished project-management suite (Plane/Linear-grade) where a ticket
  is a unit of work an agent can pick up, triage, and drive — not just a card a human moves.
- **Sensible guardrails.** Agents can create and triage work, but **can't self-assign or sign their own
  work off as done** — assignment and approval stay human. Boards are restrictive by default about which
  agents may touch them.
- **Hermes as the base for all agents.** Talaria doesn't ship a weaker "worker"; every node is a real
  Hermes agent, reachable through one gateway. Bring the agents you already run.

Status, milestones, and the wishlist live in [`ROADMAP.md`](./ROADMAP.md) and
[`docs/PHASE2-UI-PLAN.md`](./docs/PHASE2-UI-PLAN.md); the wire-level engine contract is in
[`PLAN.md`](./PLAN.md) and [`docs/m0-contract.md`](./docs/m0-contract.md). New here? Start with
[`HANDOFF.md`](./HANDOFF.md).

## The product: where humans and agents work together

The app ([`ui/`](./ui), Vite + TanStack Start, the **Mercury** design system) is Talaria's own front
end — one login, one design language, one place for the whole team.

- **Boards & teams** — shareable kanban boards (personal or team-owned), a consolidated Board settings
  modal (general / people / agents), and a **restrictive agent policy by default** (allow-all is an
  explicit opt-in per board).
- **Tickets** — a rich detail view: WYSIWYG description (markdown under the hood so agents read/write it
  natively), read/edit + full-screen editor, threaded comments (Ctrl+Enter), an activity log, watchers,
  and a quality-review approval gate. Every ticket is a **directly-linkable route** you can share.
- **The work model** — priority, agent-appropriate **effort** (XS–XL, not fake hour estimates),
  **multiple assignees**, **dependencies** (blocked-by / blocks), labels, due dates, and
  **auto-accumulated time-spent** (agents log real time per iteration).
- **Flow** — Inbox → Assigned → In progress → **Blocked** → Quality review → Done, drag-and-drop, plus a
  list view with configurable, reorderable, sortable columns.
- **Live + shared** — multiplayer boards over SSE, teams with members, per-agent access.

Agent/human group chat (mini-Slack with agents), notifications, and a cost/token ledger are next; see
the roadmap.

## Sensible guardrails (human-in-the-loop)

Autonomy without a blast radius. Agents authenticate with an agent key and operate on tickets through a
guarded API:

- Agents may **create** tickets and **triage** them — set priority, effort, labels, description, and move
  work to `in_progress`, `blocked`, or `quality_review`.
- Agents may **not** move a ticket to `assigned` (assignment is a human decision) or to `done` (they land
  in `quality_review` for a human to approve). They can't reassign work either.
- Boards decide **which agents** are even allowed to be assigned; the default is none-until-chosen.
- The upcoming **`talaria-mcp`** server exposes *only* these safe operations as tools — there is no
  "assign" or "complete" tool for a model to reach for, so the guardrails hold by construction.

## Hermes as the base: the fleet engine

Under the product sits Talaria's fleet runtime — **two planes** in front of your agents. You declare a
fleet once and Talaria routes to it; every node stays a full Hermes agent.

```
                         Talaria UI  +  hermes-workspace
              gateway plane │            │ dashboard plane
                            ▼            ▼
        ┌──────────────────────────┐  ┌──────────────────────────────┐
        │ GATEWAY PLANE  :8642      │  │ DASHBOARD PLANE  :9119        │
        │ fleet multiplexer         │  │ management bridge             │
        │ • /v1/models = whole fleet│  │ • serves conductor + kanban   │
        │ • /v1/chat routed by model│  │ • proxies everything else     │
        │   → the right agent, per- │  │   through untouched           │
        │   agent key, SSE streamed │  │                               │
        └──────────────┬───────────┘  └───────────────┬──────────────┘
          per-agent     │                 register /   │
          routing       ▼                 heartbeat /  ▼
   ┌────────┬────────┬────────┐           report    Talaria's own Postgres/Redis
   ▼        ▼        ▼        ▼                       (boards, tickets, teams, cost,
 agent-1  agent-2  …      agent-N                     activity — owned, not proxied)
 gateway  gateway         gateway
   (each a full Hermes agent)
```

The **gateway plane** exposes each agent as an OpenAI model, so one workspace's model switcher becomes
the agent switcher — pick `dex-developer` and you're talking to Dex, `sam-support` and you're talking to
Sam, each with its own key, memory, and skills. The **dashboard plane** bridges the legacy management
surfaces. Talaria's **own** Postgres/Redis is the system of record for the platform (boards, tickets,
teams, activity) — ripped from mission-control's capabilities into our stack, **not** proxied from a
running MC.

### The pieces

| Path | Piece | What it does |
|---|---|---|
| [`ui/`](./ui) | **Talaria app** (Vite + TanStack Start) | The product: boards, tickets, teams, multiplayer, auth. Owns state in Postgres/Redis. |
| [`bridge/`](./bridge) | **talaria-bridge** (Node/TS) | The fleet engine. Gateway plane multiplexes the fleet (`/v1/models`, model-routed chat); dashboard plane bridges conductor + kanban and proxies the rest. |
| [`stack/fleet.json`](./stack/fleet.example.json) | **fleet manifest** | Declares your agents (model → gateway url + key). Gitignored (holds keys). |
| [`plugin/talaria/`](./plugin/talaria) | **Talaria Hermes plugin** | Rides on each agent: registers with Talaria, heartbeats for work, reports progress toward `quality_review` (never `done`). |
| [`adapter/`](./adapter) | **mission-control adapter** | Makes Hermes a first-class framework inside mission-control (lift source). |
| [`stack/`](./stack) | **docker stack** | Compose wiring the fleet engine + network together. |

## Run it

**The app (Phase 2 UI):**

```bash
cd ui
cp .env.example .env       # set AUTH_SECRET, enable a provider, point at Postgres/Redis
npm install
npm run dev                # http://localhost:5273
```

Dev state runs as containers (`talaria-postgres-dev` on `:5544`, `talaria-redis-dev` on `:6399`).
Default self-host admin: **`jon@packledger.co` / `talaria-dev`**. See [`ui/README.md`](./ui/README.md)
and [`HANDOFF.md`](./HANDOFF.md) for details and gotchas.

**The fleet engine (bridge + stack):**

```bash
cp stack/.env.example stack/.env
cp stack/fleet.example.json stack/fleet.json   # declare your agents (model → gateway url + key)
docker compose -f stack/docker-compose.yml up -d --build
./scripts/verify-stack.sh                       # should print ALL PASS
```

See [`stack/README.md`](./stack/README.md) for network prereqs and the pinned build commit.

## The "don't break anything" promise

Talaria routes; it never rewrites your agents.

- **Every node stays a full Hermes agent.** The gateway plane forwards chat/streaming to each agent's
  real gateway with that agent's own key — memory, skills, run loop, native subagents all intact.
- **Nothing is written to your agents.** Talaria never edits a Hermes file or config; the fleet manifest
  (with per-agent keys) is gitignored and mounted read-only, and the plugin no-ops until configured.
- **Human sign-off is never bypassed.** Agents report work up to `quality_review`; the final `done` is a
  human decision (lining up with how PackLedger already runs its Done column).
- **Allowlist, not denylist.** Anything the dashboard plane doesn't explicitly recognize passes straight
  through, so future Hermes routes keep working.

## License

MIT (see [`LICENSE`](./LICENSE)). Private for now, going public when it's ready to share.
