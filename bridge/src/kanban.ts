/**
 * Kanban fleet view: serve the workspace's `/api/plugins/kanban/*` surface from
 * mission-control instead of the Hermes kanban plugin.
 *
 * The hermes-workspace swarm board (swarm2-kanban-board.tsx via
 * kanban-dashboard-proxy.ts) reads `/api/plugins/kanban/board` and expects
 * `{ columns: [{ name, tasks: DashboardKanbanTask[] }] }`, plus GET/POST/PATCH on
 * `/api/plugins/kanban/tasks`. When Talaria intercepts these and maps them onto
 * mission-control's task queue, that board becomes a live view of the MC fleet:
 * columns = mission-control statuses, cards = mission-control tasks. Fully bridge
 * side; no hermes-workspace change required.
 *
 * Non-destructive note: this REPLACES the workspace's view of the Hermes kanban
 * with the mission-control board (that is the point — mission-control is the brain).
 * Unset HERMES_DASHBOARD_URL and everything reverts to native.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { MissionControlClient } from "./missionControl.js";
import { readBody, sendJson } from "./http-util.js";

/** mission-control task statuses, in board order. Column name == status value so
 *  a drag-to-move PATCH round-trips losslessly. */
const STATUSES = ["inbox", "assigned", "in_progress", "quality_review", "done"] as const;

interface McTask {
  id?: number | string;
  title?: string;
  description?: string | null;
  status?: string;
  priority?: string;
  assigned_to?: string | null;
  created_by?: string | null;
  created_at?: number | null;
  completed_at?: number | null;
}

const PRIORITY_TO_NUM: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const NUM_TO_PRIORITY = ["critical", "high", "medium", "low"];

function prioToNum(p?: string): number | null {
  return p && p in PRIORITY_TO_NUM ? PRIORITY_TO_NUM[p] : null;
}
function numToPrio(n?: number | null): string {
  return typeof n === "number" && NUM_TO_PRIORITY[n] ? NUM_TO_PRIORITY[n] : "medium";
}

/** mission-control task → the DashboardKanbanTask card the workspace renders. */
function toCard(t: McTask): Record<string, unknown> {
  return {
    id: String(t.id ?? ""),
    title: t.title ?? "",
    body: t.description ?? null,
    assignee: t.assigned_to ?? null,
    status: t.status ?? "inbox",
    priority: prioToNum(t.priority),
    created_by: t.created_by ?? null,
    created_at: t.created_at ?? null,
    started_at: null,
    completed_at: t.completed_at ?? null,
    workspace_kind: null,
    workspace_path: null,
  };
}

/** Kanban plugin request? (any method under the plugin path). */
export function isKanbanRoute(req: IncomingMessage): boolean {
  const path = (req.url ?? "").split("?")[0];
  return path.startsWith("/api/plugins/kanban/");
}

function taskIdFromPath(path: string): string | null {
  const m = path.match(/^\/api\/plugins\/kanban\/tasks\/([^/?]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

/** Serve a kanban plugin request from mission-control. */
export async function handleKanban(
  req: IncomingMessage,
  res: ServerResponse,
  mc: MissionControlClient,
): Promise<void> {
  if (!mc.enabled) {
    // No brain configured: 404 so the workspace falls back to its local kanban store.
    sendJson(res, 404, { error: "talaria: mission-control not configured" });
    return;
  }
  const method = (req.method ?? "GET").toUpperCase();
  const path = (req.url ?? "").split("?")[0];

  // GET /api/plugins/kanban/board — the whole board, grouped into columns.
  if (method === "GET" && /^\/api\/plugins\/kanban\/board\/?$/.test(path)) {
    const resp = (await mc.listTasks(200).catch(() => null)) as { tasks?: McTask[] } | null;
    const tasks = resp?.tasks ?? [];
    const columns = STATUSES.map((s) => ({
      name: s,
      tasks: tasks.filter((t) => (t.status ?? "inbox") === s).map(toCard),
    }));
    sendJson(res, 200, { columns });
    return;
  }

  // GET /api/plugins/kanban/boards — single synthetic "default" board (the MC queue).
  if (method === "GET" && /^\/api\/plugins\/kanban\/boards\/?$/.test(path)) {
    sendJson(res, 200, { boards: [{ slug: "default", display_name: "Mission Control", archived: false }] });
    return;
  }

  // GET /api/plugins/kanban/tasks/{id}
  if (method === "GET") {
    const id = taskIdFromPath(path);
    if (!id) {
      sendJson(res, 404, { error: "talaria: unknown kanban route" });
      return;
    }
    const got = (await mc.getTask(id).catch(() => null)) as { task?: McTask } | null;
    if (!got?.task) {
      sendJson(res, 404, { error: "talaria: task not found" });
      return;
    }
    sendJson(res, 200, { task: toCard(got.task) });
    return;
  }

  // POST /api/plugins/kanban/tasks — create a task on the board.
  if (method === "POST" && /^\/api\/plugins\/kanban\/tasks\/?$/.test(path)) {
    const body = await readBodyJson(req);
    if (!body || typeof body.title !== "string") {
      sendJson(res, 400, { error: "talaria: title required" });
      return;
    }
    try {
      const task: Record<string, unknown> = {
        title: body.title,
        description: typeof body.body === "string" ? body.body : "",
        status: typeof body.status === "string" ? body.status : "inbox",
        priority: numToPrio(body.priority as number | undefined),
        metadata: { talaria: { source: "hermes-workspace-kanban" } },
      };
      // mission-control rejects assigned_to: null — only send a real assignee.
      if (typeof body.assignee === "string" && body.assignee) task.assigned_to = body.assignee;
      const created = (await mc.createTask(task)) as { task?: McTask };
      sendJson(res, 201, { task: toCard(created?.task ?? {}) });
    } catch (err) {
      sendJson(res, 502, { error: `talaria: create failed: ${(err as Error).message}` });
    }
    return;
  }

  // PATCH /api/plugins/kanban/tasks/{id} — update / move (drag between columns).
  if (method === "PATCH") {
    const id = taskIdFromPath(path);
    if (!id) {
      sendJson(res, 404, { error: "talaria: unknown kanban route" });
      return;
    }
    const body = (await readBodyJson(req)) ?? {};
    const patch: Record<string, unknown> = {};
    if (typeof body.title === "string") patch.title = body.title;
    if (typeof body.body === "string") patch.description = body.body;
    // Only send a real assignee (mission-control rejects null).
    if (typeof body.assignee === "string" && body.assignee) patch.assigned_to = body.assignee;
    if (typeof body.status === "string") patch.status = body.status;
    if ("priority" in body) patch.priority = numToPrio(body.priority as number | undefined);
    try {
      await mc.updateTask(id, patch);
      const got = (await mc.getTask(id).catch(() => null)) as { task?: McTask } | null;
      sendJson(res, 200, { task: toCard(got?.task ?? { id }) });
    } catch (err) {
      // e.g. moving to `done` is Aegis/human-gated in mission-control.
      sendJson(res, 409, {
        error: `talaria: update rejected by mission-control (${(err as Error).message}). ` +
          "Moving a task to 'done' requires approval in mission-control.",
      });
    }
    return;
  }

  sendJson(res, 405, { error: "talaria: kanban method not allowed" });
}

async function readBodyJson(req: IncomingMessage): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse((await readBody(req)) || "{}") as Record<string, unknown>;
  } catch {
    return null;
  }
}
