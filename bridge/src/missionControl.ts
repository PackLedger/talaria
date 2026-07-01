/**
 * mission-control REST client (the fleet brain).
 *
 * Uses Node 18+ global fetch (no dependency). Every call is defensive: a failure
 * throws a typed error the caller translates into an HTTP response — the bridge
 * must degrade gracefully, never crash, when the brain is unreachable.
 *
 * Verified OpenAPI 3.1 surface (bodies filled in M0):
 *   POST /api/tasks               → create/dispatch a task
 *   POST /api/agents/message      → inter-agent messaging
 *   GET  /api/agents              → list fleet agents
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
      headers["Authorization"] = `Bearer ${this.cfg.missionControlApiKey}`;
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
   * Create a task from a translated hermes-workspace mission dispatch.
   * TODO(M0): the `task` shape is a placeholder — map field-by-field from the
   * captured Conductor payloads to mission-control's /api/tasks schema.
   */
  createTask(task: Record<string, unknown>): Promise<unknown> {
    return this.request("POST", "/api/tasks", task);
  }

  /** TODO(M2): broadcast / inter-agent messaging translation. */
  sendMessage(message: Record<string, unknown>): Promise<unknown> {
    return this.request("POST", "/api/agents/message", message);
  }
}
