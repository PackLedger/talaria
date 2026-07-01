"""talaria — the mission-control adapter, as a Hermes plugin.

Runs on each Hermes agent and connects it to a mission-control fleet brain:

  on_session_start  → register the agent with mission-control (once), remember its id
  post_tool_call    → (M2) report task progress/results back to the fleet brain
  on_session_end    → drain per-session state

Design rules (mirror confab-guard):
  * Never break a turn. Every hook is wrapped in try/except and logs at debug.
  * Never alter user-facing output. This plugin only reaches OUT to mission-control.
  * Safe no-op until configured. With TALARIA_MISSION_CONTROL_URL unset, the client
    is disabled and every hook returns immediately — so the fleet can enable the
    plugin BEFORE the M0 contract is wired, with zero behavior change.

TODO(M0): heartbeat-poll for assigned work and the task register/report bodies are
stubs until the M0 contract diff maps the mission-control schema. TODO(M2): wire
post_tool_call → report_task and dispatch heartbeat-assigned work into the run loop.
"""

from __future__ import annotations

import logging
import os
import threading
from typing import Any, Dict

from .mission_client import MissionControlClient

logger = logging.getLogger("talaria")

# Per-agent process-wide state. One Hermes process == one agent, so a single
# registration is shared across that agent's sessions.
_lock = threading.Lock()
_client = MissionControlClient()
_agent_id: str = ""
_registered = False
# Sessions we've already seen, so we register-on-first-touch at most once.
_seen_sessions: set = set()


def _agent_identity() -> Dict[str, Any]:
    """Best-effort agent identity for mission-control registration.

    TODO(M0): enrich with the real Hermes profile/model once the mission-control
    agent schema is confirmed. Env vars below already exist in the fleet's
    &agent-env anchor (see ai/orchestration/docker-compose.yml).
    """
    return {
        "name": os.environ.get("API_SERVER_MODEL_NAME", "") or os.environ.get("HERMES_AGENT_NAME", ""),
        "model": os.environ.get("LLM_MODEL", ""),
        "adapter": "hermes",
        "talaria_version": "0.1.0",
    }


def _ensure_registered() -> None:
    """Register this agent with mission-control exactly once (no-op if disabled)."""
    global _agent_id, _registered
    if _registered or not _client.enabled:
        return
    with _lock:
        if _registered:
            return
        agent_id = _client.register_agent(_agent_identity())
        if agent_id:
            _agent_id = agent_id
            _registered = True
            logger.info("talaria: registered agent with mission-control (id=%s)", agent_id)
        else:
            # Leave _registered False so we retry on the next session; disabled or
            # unreachable brain must not wedge the agent.
            logger.debug("talaria: registration skipped/failed (enabled=%s)", _client.enabled)


def _on_session_start(session_id: str = "", **_: Any) -> None:
    try:
        if not _client.enabled:
            return
        _ensure_registered()
        with _lock:
            _seen_sessions.add(session_id or "default")
        # TODO(M0/M2): start/refresh the heartbeat poll for assigned work here.
    except Exception as exc:  # never break the turn
        logger.debug("talaria on_session_start failed: %s", exc)


def _on_post_tool_call(
    tool_name: str = "",
    session_id: str = "",
    task_id: str = "",
    result: Any = None,
    status: str = "",
    **_: Any,
) -> None:
    try:
        if not _client.enabled or not task_id:
            return
        # TODO(M2): translate Hermes tool outcome → mission-control task report.
        # _client.report_task(task_id, status or "in_progress", result)
    except Exception as exc:  # never break the turn
        logger.debug("talaria post_tool_call failed: %s", exc)


def _on_session_end(session_id: str = "", **_: Any) -> None:
    try:
        with _lock:
            _seen_sessions.discard(session_id or "")
    except Exception as exc:
        logger.debug("talaria on_session_end failed: %s", exc)


def register(ctx) -> None:
    ctx.register_hook("on_session_start", _on_session_start)
    ctx.register_hook("post_tool_call", _on_post_tool_call)
    ctx.register_hook("on_session_end", _on_session_end)
