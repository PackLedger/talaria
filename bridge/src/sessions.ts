/**
 * Per-agent session routing for the gateway plane.
 *
 * The workspace's session sidebar reads /api/sessions off the gateway. With a
 * fleet behind Talaria we make that a FLEET-WIDE history: the list is merged
 * across every agent, each session's key is namespaced with its agent, and
 * opening a session routes back to the agent that owns it.
 *
 *   GET /api/sessions            → merged list (keys prefixed `<model>::<id>`, tagged by agent)
 *   /api/sessions/<model>::<id>… → routed to that agent's real gateway (key stripped)
 *
 * Anything else under /api/sessions (search, stats, unprefixed keys) falls through
 * to the default agent via the gateway plane's default proxy.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import type { TalariaConfig, FleetAgent } from "./config.js";
import { upstreamBase } from "./config.js";
import { readBody, sendJson } from "./http-util.js";

export const SEP = "::";

function authHeaders(agent: FleetAgent): Record<string, string> {
  return agent.key ? { Authorization: `Bearer ${agent.key}` } : {};
}

/** True for a routed-by-key session request (its key carries the agent prefix). */
export function isNamespacedSession(path: string): boolean {
  let decoded = path;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    /* keep raw */
  }
  return decoded.startsWith("/api/sessions/") && decoded.includes(SEP);
}

/** GET /api/sessions → one merged, agent-tagged list across the whole fleet. */
export async function handleSessionsList(
  cfg: TalariaConfig,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = new URL(req.url ?? "/api/sessions", "http://x");
  const limit = Number(url.searchParams.get("limit") ?? "50");

  const results = await Promise.all(
    cfg.fleet.map(async (agent) => {
      try {
        const r = await fetch(`${upstreamBase(agent)}/api/sessions?limit=${limit}&offset=0`, {
          headers: authHeaders(agent),
        });
        if (!r.ok) return [];
        const body = (await r.json()) as { data?: Record<string, unknown>[] };
        return (body.data ?? []).map(
          (s): Record<string, unknown> => ({
            ...s,
            // Namespace the key so by-key calls route back here; tag the agent.
            id: `${agent.model}${SEP}${s.id}`,
            agent: agent.model,
            agent_label: agent.label ?? agent.model,
          }),
        );
      } catch {
        return [] as Record<string, unknown>[];
      }
    }),
  );

  const merged = results.flat();
  merged.sort((a, b) => Number(b.last_active ?? 0) - Number(a.last_active ?? 0));
  const data = merged.slice(0, limit);
  sendJson(res, 200, { object: "list", data, limit, offset: 0, has_more: merged.length > limit });
}

/** Route a namespaced session request to the agent that owns it. */
export async function handleSessionByKey(
  cfg: TalariaConfig,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const raw = req.url ?? "";
  const [pathOnly, query] = raw.split("?");
  let decoded = pathOnly;
  try {
    decoded = decodeURIComponent(pathOnly);
  } catch {
    /* keep raw */
  }
  // decoded = /api/sessions/<model>::<id>[/subpath]
  const rest = decoded.slice("/api/sessions/".length);
  const sep = rest.indexOf(SEP);
  const model = rest.slice(0, sep);
  const afterModel = rest.slice(sep + SEP.length); // <id>[/subpath]
  const agent = cfg.fleet.find((a) => a.model === model);
  if (!agent) {
    sendJson(res, 404, { error: `talaria: unknown agent '${model}' in session key` });
    return;
  }
  // Rebuild the real upstream path with the agent prefix stripped.
  const upstreamPath = `/api/sessions/${afterModel.split("/").map(encodeURIComponent).join("/")}${query ? "?" + query : ""}`;

  const method = (req.method ?? "GET").toUpperCase();
  const init: RequestInit = { method, headers: { ...authHeaders(agent) } };
  if (method !== "GET" && method !== "HEAD") {
    const body = await readBody(req);
    if (body) {
      init.body = body;
      (init.headers as Record<string, string>)["Content-Type"] =
        req.headers["content-type"] ?? "application/json";
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${upstreamBase(agent)}${upstreamPath}`, init);
  } catch (err) {
    sendJson(res, 502, { error: `talaria: agent ${model} unreachable: ${(err as Error).message}` });
    return;
  }
  res.statusCode = upstream.status;
  const ct = upstream.headers.get("content-type");
  if (ct) res.setHeader("Content-Type", ct);
  if (upstream.body) {
    Readable.fromWeb(upstream.body as import("node:stream/web").ReadableStream).pipe(res);
  } else {
    res.end(await upstream.text());
  }
}
