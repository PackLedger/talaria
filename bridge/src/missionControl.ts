/**
 * mission-control REST client (the fleet brain).
 *
 * Uses Node 18+ global fetch (no dependency). Every call is defensive: a failure
 * throws a typed error the caller translates into an HTTP response — the bridge
 * must degrade gracefully, never crash, when the brain is unreachable.
 *
 * Verified OpenAPI 3.1 surface (M0 — see docs/m0-contract.md):
 *   POST /api/tasks               → create a task   ({title required, description, status, priority, metadata})
 *   PUT  /api/tasks/{id}          → update/report   ({status, outcome, error_message, resolution})
 *   POST /api/agents/message      → inter-agent messaging
 *   GET  /api/agents              → list fleet agents
 * Auth: `x-api-key` header (mission-control also accepts Authorization: Bearer). src/lib/auth.ts:580.
 */
import type { TalariaConfig } from "./config.js";

export class MissionControlClient {
  constructor(private readonly cfg: TalariaConfig) {}

  get enabled(): boolean {
    return Boolean(this.cfg.missionControlUrl);
  }

  private async request<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.cfg.missionControlApiKey) {
      headers["x-api-key"] = this.cfg.missionControlApiKey;
    }
    const res = await fetch(`${this.cfg.missionControlUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`mission-control ${method} ${path} → ${res.status}`);
    }
    return (await res.json().catch(() => ({}))) as T;
  }

  /**
   * Create a task from a translated hermes-workspace conductor mission.
   * `title` is required; see the field map in docs/m0-contract.md. Returns
   * `{ task: { id, ticket_ref, status, ... } }`.
   */
  createTask(task: Record<string, unknown>): Promise<unknown> {
    return this.request("POST", "/api/tasks", task);
  }

  /** Update/report a task: PUT /api/tasks/{id} with {status, outcome, ...}. */
  updateTask(id: string | number, patch: Record<string, unknown>): Promise<unknown> {
    return this.request("PUT", `/api/tasks/${encodeURIComponent(String(id))}`, patch);
  }

  /** TODO(M3): broadcast / inter-agent messaging translation. */
  sendMessage(message: Record<string, unknown>): Promise<unknown> {
    return this.request("POST", "/api/agents/message", message);
  }
}
