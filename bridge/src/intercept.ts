/**
 * Mission-dispatch interception — the ONLY thing Talaria rewrites.
 *
 * SAFETY MODEL (see PLAN.md § Non-destructiveness): allowlist-intercept, never
 * denylist. A request is intercepted ONLY if its method+path matches an entry in
 * MISSION_ROUTES below. Everything else — sessions, skills, config, MCP browsing,
 * and any endpoint future Hermes versions add — passes straight through to the
 * real dashboard, untouched.
 *
 * TODO(M0): MISSION_ROUTES is intentionally EMPTY until the M0 contract diff
 * enumerates hermes-workspace's actual mission-dispatch routes on :9119 and maps
 * their payloads to mission-control. With an empty allowlist the bridge is a pure
 * transparent proxy (milestone M1) — safe by construction.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { MissionControlClient } from "./missionControl.js";

interface MissionRoute {
  method: string;
  /** Matched against the request path (pathname only). */
  pattern: RegExp;
  /** Human label for logs. */
  label: string;
}

/** The intercept allowlist. EMPTY until M0 — do not guess routes. */
export const MISSION_ROUTES: MissionRoute[] = [
  // TODO(M0): e.g. { method: "POST", pattern: /^\/api\/mission\/dispatch$/, label: "single-task dispatch" }
];

/** True iff this request should be intercepted and translated (not proxied). */
export function isMissionRoute(req: IncomingMessage): boolean {
  const method = (req.method ?? "GET").toUpperCase();
  const path = (req.url ?? "").split("?")[0];
  return MISSION_ROUTES.some((r) => r.method === method && r.pattern.test(path));
}

/**
 * Handle an intercepted mission-dispatch request by translating it to
 * mission-control REST. Unreachable until MISSION_ROUTES is populated (M0).
 *
 * TODO(M2): read+buffer the body, translate the Conductor payload, call
 * mission-control, and shape a response hermes-workspace's Conductor accepts.
 */
export async function handleMission(
  _req: IncomingMessage,
  res: ServerResponse,
  _mc: MissionControlClient,
): Promise<void> {
  res.statusCode = 501;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ error: "talaria: mission translation not yet implemented (M2)" }));
}
