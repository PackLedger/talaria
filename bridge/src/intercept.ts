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
  { method: "POST", pattern: /^\/api\/conductor\/missions\/?$/, label: "create mission" },
  { method: "GET", pattern: /^\/api\/conductor\/missions\/[^/]+\/?$/, label: "poll mission" },
  { method: "DELETE", pattern: /^\/api\/conductor\/missions\/[^/]+\/?$/, label: "cancel mission" },
  // TODO(M1): add the capability-probe route once captured live, so the workspace
  // flips capabilities.conductor=true and uses remote dispatch (not native-swarm).
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

  // GET (poll) / DELETE (cancel): need the MC-status → workspace-state map verified
  // against a live workspace before shipping (avoid a guessed enum). See M0 § Open items.
  const id = missionIdFromPath(path);
  sendJson(res, 501, {
    error: "talaria: conductor poll/cancel not yet implemented (M3)",
    mission_id: id,
  });
}
