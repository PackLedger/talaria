# mission-control Hermes adapter (M4)

The **mission-control-side adapter** — Talaria's third artifact — making Hermes a first-class
framework inside [`builderz-labs/mission-control`](https://github.com/builderz-labs/mission-control),
alongside its CrewAI / LangGraph / AutoGen / Claude-SDK / OpenClaw adapters.

**Status:** written + verified (2026-07-01). Ready to contribute upstream (PR) or vendor.

## What it adds

A `hermes` `FrameworkAdapter` (register / heartbeat / reportTask / getAssignments / disconnect) that
fans lifecycle events onto mission-control's `eventBus` and reads assignments from the shared task
queue — mirroring the existing adapters. This makes Hermes appear in `GET /api/frameworks`, in the
`FRAMEWORK_REGISTRY` (with setup hints citing this Talaria repo), and in the universal agent
templates. Runtime behavior (register/heartbeat/report over REST) already works via the Talaria
plugin without this; the adapter makes Hermes *native* in mission-control's framework model.

## The change (3 files, +94 lines)

- **`src/lib/adapters/hermes.ts`** (new) — the `HermesAdapter` (see [`hermes.ts`](./hermes.ts)).
- **`src/lib/adapters/index.ts`** — import + register `hermes: () => new HermesAdapter()`.
- **`src/lib/framework-templates.ts`** — a `hermes` `FRAMEWORK_REGISTRY` entry + `'hermes'` added to
  each universal template's `frameworks` list (so `getTemplatesForFramework('hermes')` returns
  templates and the adapter-loop test stays green).

The full diff is in [`mission-control-hermes-adapter.patch`](./mission-control-hermes-adapter.patch).
Apply against a mission-control checkout with:

```bash
git -C <mission-control> apply /path/to/mission-control-hermes-adapter.patch
```

## Verification

Built into the `talaria/stack` mission-control image (`talaria/vendor/mission-control`, pinned at
`d09e608` + this patch) and confirmed: `GET /api/frameworks` lists `hermes`, and
`getTemplatesForFramework('hermes')` resolves the universal templates. See
[`../docs/m0-contract.md`](../docs/m0-contract.md) and [`../scripts/verify-stack.sh`](../scripts/verify-stack.sh).

## Design note

Talaria never forces mission-control's **Aegis-gated `done`** transition — Hermes agents report toward
`quality_review` and completion flows through mission-control's own (human) approval. The adapter
preserves that; it only broadcasts lifecycle/task events, it does not auto-complete.
