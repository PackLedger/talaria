/**
 * Conductor mission routes — the ONLY thing Talaria answers itself.
 *
 * M0 FINDING (see docs/m0-contract.md): the real Hermes dashboard :9119 has NO
 * `/api/conductor/*` routes — it 404s them. hermes-workspace's Conductor calls
 * `POST /api/conductor/missions` on HERMES_DASHBOARD_URL and, on 404, falls back
 * to native-swarm. So Talaria does not *intercept* an existing route: it SERVES
 * the conductor routes the dashboard lacks (translating to mission-control), and
 * passes EVERYTHING else through byte-for-byte. Because the served routes are
 * ones the dashboard 404s anyway, this only ADDS capability — it never overrides
 * native behavior (unset HERMES_DASHBOARD_URL ⇒ 404 ⇒ native-swarm, as before).
 *
 * SAFETY MODEL: allowlist. A request is answered by Talaria ONLY if it matches a
 * MISSION_ROUTE below (all under /api/conductor/). Everything else — 164 dashboard
 * routes, /assets, the SPA, the 4 websockets, and any endpoint future Hermes
 * versions add — passes straight through to the real dashboard.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { MissionControlClient } from "./missionControl.js";

interface MissionRoute {
  method: string;
  /** Matched against the request pathname (query stripped). */
  pattern: RegExp;
  label: string;
}

/**
 * The conductor routes Talaria serves (source: hermes-workspace
 * src/routes/api/conductor-spawn.ts). Translation targets are in docs/m0-contract.md.
 */
export const MISSION_ROUTES: MissionRoute[] = [
  // M1 (captured live): the workspace probes conductor availability with
  // `GET /api/conductor/missions` and marks it AVAILABLE iff the response is
  // 200 + application/json (gateway-capabilities.ts:probeConductor). Talaria must
  // answer this bare GET so the workspace uses remote dispatch, not native-swarm.
  { method: "GET", pattern: /^\/api\/conductor\/missions\/?$/, label: "list/probe missions" },
  { method: "POST", pattern: /^\/api\/conductor\/missions\/?$/, label: "create mission" },
  { method: "GET", pattern: /^\/api\/conductor\/missions\/[^/]+\/?$/, label: "poll mission" },
  { method: "DELETE", pattern: /^\/api\/conductor\/missions\/[^/]+\/?$/, label: "cancel mission" },
];

/** Extract the mission id from `/api/conductor/missions/{id}`, or null. */
export function missionIdFromPath(path: string): string | null {
  const m = path.match(/^\/api\/conductor\/missions\/([^/?]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

/** True iff Talaria should answer this request itself (not proxy it). */
export function isMissionRoute(req: IncomingMessage): boolean {
  const method = (req.method ?? "GET").toUpperCase();
  const path = (req.url ?? "").split("?")[0];
  return MISSION_ROUTES.some((r) => r.method === method && r.pattern.test(path));
}

/** Read a request body to a string (bounded), for JSON translation. */
function readBody(req: IncomingMessage, limitBytes = 1_000_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > limitBytes) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

/**
 * Answer a conductor mission request by translating to mission-control.
 *
 * M2 status: POST (create) is implemented per the M0 contract but UNTESTED against
 * a live mission-control — verify the round-trip when the stack runs (docs/m0-contract.md
 * § Open items). GET (poll) + DELETE (cancel) need the status-state map confirmed
 * live, so they remain explicit TODO(M3) stubs rather than a guessed mapping.
 */
export async function handleMission(
  req: IncomingMessage,
  res: ServerResponse,
  mc: MissionControlClient,
): Promise<void> {
  const method = (req.method ?? "GET").toUpperCase();
  const path = (req.url ?? "").split("?")[0];

  if (!mc.enabled) {
    sendJson(res, 503, { error: "talaria: mission-control not configured (MISSION_CONTROL_URL unset)" });
    return;
  }

  if (method === "POST") {
    let mission: { name?: string; prompt?: string };
    try {
      mission = JSON.parse((await readBody(req)) || "{}");
    } catch {
      sendJson(res, 400, { error: "talaria: invalid JSON body" });
      return;
    }
    const name = mission.name ?? `mission-${req.headers["x-request-id"] ?? "unnamed"}`;
    // Field map: workspace {name, prompt} → mission-control POST /api/tasks.
    const created = (await mc.createTask({
      title: name,
      description: mission.prompt ?? "",
      status: "inbox",
      priority: "medium",
      metadata: { talaria: { source: "hermes-workspace", mission_name: name } },
    })) as { task?: { id?: number | string; ticket_ref?: string } };
    const task = created?.task ?? {};
    // Shape the response the workspace's Conductor reads (conductor-spawn.ts:122).
    sendJson(res, 200, { id: String(task.id ?? ""), name, session_id: String(task.ticket_ref ?? task.id ?? "") });
    return;
  }

  const id = missionIdFromPath(path);

  // Bare `GET /api/conductor/missions` = the capability probe + mission list.
  // 200 + application/json flips the workspace to remote dispatch (M1). We reach
  // this only when mc.enabled (the !enabled guard above returns 503, which correctly
  // makes the workspace fall back to native-swarm when no brain is configured).
  if (method === "GET" && id === null) {
    // TODO(M3): populate from mission-control (GET /api/tasks) once the mission
    // list view is wired; an empty list is sufficient for the probe today.
    sendJson(res, 200, { missions: [] });
    return;
  }

  // GET /api/conductor/missions/{id} — poll status. The workspace passes this
  // record straight through to the Conductor UI, which reads {id,name,status,error,
  // lines,exit_code,session_id,updatedAt}. status ∈ running|completed|failed (M3,
  // mapped from mission-control task status; see missionStatusFromTask).
  if (method === "GET") {
    const got = (await mc.getTask(id!).catch(() => null)) as { task?: McTask } | null;
    const task = got?.task;
    if (!task) {
      sendJson(res, 404, { error: "talaria: mission not found", detail: `no mission-control task ${id}` });
      return;
    }
    sendJson(res, 200, missionRecordFromTask(id!, task));
    return;
  }

  // DELETE /api/conductor/missions/{id} — cancel. The workspace only checks res.ok.
  // mission-control has no 'cancelled' task state, and moving to 'done' needs Aegis
  // (quality-gate) approval — which we must NOT bypass. So we record cancellation via
  // outcome='abandoned' (valid enum: success|failed|partial|abandoned) WITHOUT forcing
  // the status, and map outcome→'cancelled' on poll. Best-effort; always return ok.
  if (method === "DELETE") {
    await mc
      .updateTask(id!, { outcome: "abandoned", resolution: "Cancelled via hermes-workspace Conductor" })
      .catch(() => undefined);
    sendJson(res, 200, { ok: true, id });
    return;
  }

  sendJson(res, 405, { error: "talaria: method not allowed on conductor route" });
}

/** Subset of the mission-control task fields Talaria maps from. */
interface McTask {
  title?: string;
  status?: string;
  outcome?: string | null;
  error_message?: string | null;
  ticket_ref?: string | null;
  updated_at?: number;
}

/**
 * mission-control task status → the workspace mission status enum. The workspace
 * treats {completed} as terminal-success and {failed,cancelled} as terminal-failure
 * (use-conductor-gateway.ts). Outcome is checked FIRST because it's terminal regardless
 * of status: a cancel sets outcome='abandoned' without forcing 'done' (Aegis-gated).
 * mission-control outcome enum: success|failed|partial|abandoned; status reaching 'done'
 * requires human/Aegis approval (we never bypass it — completion flows through naturally).
 */
function missionStatusFromTask(task: McTask): "running" | "completed" | "failed" | "cancelled" {
  if (task.outcome === "abandoned") return "cancelled";
  if (task.outcome === "failed" || task.error_message) return "failed";
  if (task.status === "done" || task.outcome === "success") return "completed";
  return "running"; // inbox | assigned | in_progress | quality_review
}

/** Build the conductor mission record the workspace UI renders (conductor-spawn.ts:290). */
function missionRecordFromTask(id: string, task: McTask): Record<string, unknown> {
  const status = missionStatusFromTask(task);
  return {
    id,
    name: task.title ?? id,
    status,
    error: task.error_message ?? null,
    session_id: task.ticket_ref ?? null,
    lines: [], // mission-control has no conductor log stream; empty is safe (TODO(M3+): task comments)
    exit_code: status === "completed" ? 0 : status === "failed" || status === "cancelled" ? 1 : null,
    updatedAt: task.updated_at,
  };
}
