# mission-control Hermes adapter (upstream PR staging)

This directory stages the **mission-control-side adapter** — the third Talaria artifact — to be
contributed upstream to [`builderz-labs/mission-control`](https://github.com/builderz-labs/mission-control)
as `src/lib/adapters/hermes/`, so a Hermes agent's register / heartbeat / task-report is a
first-class citizen in the fleet brain (rather than bolted on).

**Status:** M4. Not started — nothing to build here until the M0 contract diff and M2 translation
land. The per-agent runtime behavior is currently carried by the Hermes **plugin** at
[`../plugin/talaria/`](../plugin/talaria) (mission_client.py), which we vendor now and upstream later.

## Plan

- Mirror the existing adapters in mission-control's `src/lib/adapters/` (study CrewAI / LangGraph /
  AutoGen / Claude-SDK adapters for the interface contract).
- Map the Hermes agent lifecycle → the adapter interface:
  - register → `POST /api/agents`
  - poll → `GET /api/agents/{id}/heartbeat`
  - report → task status/result
  - message → `POST /api/agents/message` (inter-agent)
- Decision to revisit (PLAN.md open question #2): maintain as an upstream PR vs. vendor until merged.

See [`../PLAN.md`](../PLAN.md) § "What we ship" (artifact #3) and § Milestones (M4).
