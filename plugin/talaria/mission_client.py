"""Minimal mission-control REST client used by the Talaria Hermes plugin.

Stdlib-only (urllib) so the plugin adds no dependencies to the Hermes runtime.
Every method is defensive: network/parse failures return a falsy result and log
at debug — the plugin must NEVER break an agent turn because the fleet brain is
unreachable.

Endpoint shapes are the verified mission-control OpenAPI 3.1 surface:
  POST /api/agents                    → register this agent, returns {id, ...}
  GET  /api/agents/{id}/heartbeat     → poll for assigned work
  POST /api/tasks/{id}/report         → report task status/result   (TODO(M0): confirm exact path/body)
  POST /api/agents/message            → inter-agent messaging        (TODO(M2))

TODO(M0): the exact request/response BODIES are still source-reading work — the
field maps below are placeholders to be filled from mission-control's
openapi.json during the M0 contract diff. Until then callers stay in no-op mode.
"""

from __future__ import annotations

import json
import logging
import os
import urllib.error
import urllib.request
from typing import Any, Optional

logger = logging.getLogger("talaria.mission_client")

_TIMEOUT = float(os.environ.get("TALARIA_MC_TIMEOUT", "5"))


class MissionControlClient:
    """Thin, dependency-free wrapper over the mission-control REST API."""

    def __init__(self, base_url: str = "", api_key: str = "") -> None:
        self.base_url = (base_url or os.environ.get("TALARIA_MISSION_CONTROL_URL", "")).rstrip("/")
        self.api_key = api_key or _read_api_key()

    @property
    def enabled(self) -> bool:
        """True only when a mission-control URL is configured.

        The fleet mounts this plugin before the M0 contract is wired; with no URL
        set the plugin loads and stays silent (safe no-op).
        """
        return bool(self.base_url)

    # ── low-level ────────────────────────────────────────────────────────────
    def _request(self, method: str, path: str, body: Optional[dict] = None) -> Optional[dict]:
        if not self.enabled:
            return None
        url = f"{self.base_url}{path}"
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(url, data=data, method=method)
        req.add_header("Content-Type", "application/json")
        if self.api_key:
            req.add_header("Authorization", f"Bearer {self.api_key}")
        try:
            with urllib.request.urlopen(req, timeout=_TIMEOUT) as resp:
                raw = resp.read().decode() or "{}"
                return json.loads(raw)
        except (urllib.error.URLError, ValueError, TimeoutError) as exc:
            logger.debug("talaria: mission-control %s %s failed: %s", method, path, exc)
            return None

    # ── high-level (stubs — bodies filled in M0) ──────────────────────────────
    def register_agent(self, agent: dict) -> Optional[str]:
        """POST /api/agents — register this agent, return its assigned id."""
        # TODO(M0): map Hermes agent identity → mission-control agent schema.
        resp = self._request("POST", "/api/agents", agent)
        return (resp or {}).get("id")

    def heartbeat(self, agent_id: str) -> Optional[dict]:
        """GET /api/agents/{id}/heartbeat — poll for assigned work."""
        if not agent_id:
            return None
        return self._request("GET", f"/api/agents/{agent_id}/heartbeat")

    def report_task(self, task_id: str, status: str, result: Any = None) -> bool:
        """Report task status/result back to mission-control."""
        # TODO(M0): confirm exact path + body against openapi.json.
        resp = self._request("POST", f"/api/tasks/{task_id}/report", {"status": status, "result": result})
        return resp is not None


def _read_api_key() -> str:
    """Prefer a docker-secret file, fall back to env (see stack/.env.example)."""
    path = os.environ.get("TALARIA_MISSION_CONTROL_API_KEY_FILE", "/run/secrets/talaria_mc_key")
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return fh.read().strip()
    except OSError:
        return os.environ.get("TALARIA_MISSION_CONTROL_API_KEY", "").strip()
