/**
 * Talaria gateway plane: the fleet multiplexer.
 *
 * This is the second Talaria plane. Where the dashboard plane (:9119) bridges the
 * management surfaces, the gateway plane fronts the Hermes gateway (:8642) for a
 * WHOLE FLEET of agents, so a single hermes-workspace can talk to every agent.
 *
 * Agents-as-models: each fleet agent is exposed as an OpenAI model (its
 * API_SERVER_MODEL_NAME). The workspace's model switcher becomes the agent
 * switcher — no workspace change needed for the core "chat with any agent" flow.
 *
 *   GET  /v1/models             → the whole fleet (one model per agent)
 *   POST /v1/chat/completions   → routed by `model` to that agent's real gateway
 *                                 (per-agent Bearer key injected, SSE streamed back)
 *   GET  /health                → ok when a fleet is configured
 *   everything else             → proxied to the default agent's gateway
 *
 * The fleet is declared in a manifest (config.fleet, from TALARIA_FLEET). Talaria
 * commands the topology: it must be able to reach each agent's gateway URL (put it
 * on the fleet network). Empty fleet ⇒ the gateway plane does not start.
 */
import http from "node:http";
import { Readable } from "node:stream";
import httpProxy from "http-proxy";

import type { TalariaConfig, FleetAgent } from "./config.js";
import { upstreamBase, upstreamModelFor } from "./config.js";
import { readBody, sendJson } from "./http-util.js";
import { handleSessionsList, handleSessionByKey, isNamespacedSession } from "./sessions.js";

function agentForModel(cfg: TalariaConfig, model: string): FleetAgent | undefined {
  return cfg.fleet.find((a) => a.model === model);
}

function defaultAgent(cfg: TalariaConfig): FleetAgent | undefined {
  return cfg.fleet.find((a) => a.model === cfg.defaultModel) ?? cfg.fleet[0];
}

/** GET /v1/models → the fleet, one OpenAI model per agent. */
function handleModels(cfg: TalariaConfig, res: http.ServerResponse): void {
  const data = cfg.fleet.map((a) => ({
    id: a.model,
    object: "model",
    created: 0,
    owned_by: "talaria-fleet",
  }));
  sendJson(res, 200, { object: "list", data });
}

/** POST /v1/chat/completions → route by `model` to the agent's gateway, stream back. */
async function handleChat(cfg: TalariaConfig, req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const body = await readBody(req, 20_000_000); // prompts can be large (context)
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(body || "{}") as Record<string, unknown>;
  } catch {
    sendJson(res, 400, { error: "talaria: invalid JSON body" });
    return;
  }
  const model = String(parsed.model ?? "");
  const agent = agentForModel(cfg, model) ?? defaultAgent(cfg);
  if (!agent) {
    sendJson(res, 503, { error: "talaria: no fleet agents configured" });
    return;
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (agent.key) headers["Authorization"] = `Bearer ${agent.key}`;

  // Profile-routed gateways select the agent by the `model` field, so rewrite it
  // to the agent's upstream model (profile name) when it differs. Dedicated
  // single-model gateways ignore the field, so this is a no-op there.
  const forwardModel = upstreamModelFor(agent);
  let outBody = body;
  if (forwardModel && forwardModel !== model) {
    parsed.model = forwardModel;
    outBody = JSON.stringify(parsed);
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${upstreamBase(agent)}/v1/chat/completions`, { method: "POST", headers, body: outBody });
  } catch (err) {
    sendJson(res, 502, { error: `talaria: agent ${agent.model} unreachable: ${(err as Error).message}` });
    return;
  }
  res.statusCode = upstream.status;
  res.setHeader("Content-Type", upstream.headers.get("content-type") ?? "application/json");
  const cc = upstream.headers.get("cache-control");
  if (cc) res.setHeader("Cache-Control", cc);
  if (upstream.body) {
    // Streams SSE (stream:true) or a single JSON body back, unchanged.
    Readable.fromWeb(upstream.body as import("node:stream/web").ReadableStream).pipe(res);
  } else {
    res.end(await upstream.text());
  }
}

/**
 * Start the gateway plane on cfg.gatewayPort. Returns the server, or null when no
 * fleet is configured (the plane is opt-in via the manifest).
 */
export function startGatewayPlane(cfg: TalariaConfig): http.Server | null {
  if (!cfg.fleet.length) return null;

  const def = defaultAgent(cfg)!;
  // Non-chat gateway calls (sessions/health-detail/etc.) go to the default agent.
  const proxy = httpProxy.createProxyServer({ target: upstreamBase(def), changeOrigin: false });
  proxy.on("proxyReq", (proxyReq) => {
    if (def.key) proxyReq.setHeader("Authorization", `Bearer ${def.key}`);
  });
  proxy.on("error", (err, _req, res) => {
    if (res instanceof http.ServerResponse && !res.headersSent) {
      res.statusCode = 502;
      res.end(JSON.stringify({ error: `talaria: default agent unreachable: ${err.message}` }));
    }
  });

  const logReq = process.env.TALARIA_LOG_REQUESTS === "1";
  const server = http.createServer((req, res) => {
    const path = (req.url ?? "").split("?")[0];
    const method = (req.method ?? "GET").toUpperCase();
    if (logReq) console.log(`[talaria/gw] ${method} ${path}`);

    if (method === "GET" && path === "/v1/models") return void handleModels(cfg, res);
    if (method === "POST" && path === "/v1/chat/completions") {
      handleChat(cfg, req, res).catch((err) => {
        console.error(`[talaria/gw] chat error: ${err.message}`);
        if (!res.headersSent) sendJson(res, 500, { error: "talaria: chat routing failed" });
      });
      return;
    }
    if (method === "GET" && (path === "/health" || path === "/__talaria/health")) {
      return sendJson(res, 200, { ok: true, fleet: cfg.fleet.map((a) => a.model) });
    }
    // Per-agent sessions: merge the list across the fleet, route by-key calls home.
    if (method === "GET" && path === "/api/sessions") {
      handleSessionsList(cfg, req, res).catch((err) => {
        console.error(`[talaria/gw] sessions list error: ${err.message}`);
        if (!res.headersSent) sendJson(res, 500, { error: "talaria: sessions merge failed" });
      });
      return;
    }
    if (isNamespacedSession(path)) {
      handleSessionByKey(cfg, req, res).catch((err) => {
        console.error(`[talaria/gw] session route error: ${err.message}`);
        if (!res.headersSent) sendJson(res, 500, { error: "talaria: session routing failed" });
      });
      return;
    }
    // Everything else → the default agent's gateway.
    proxy.web(req, res);
  });

  // Proxy websocket upgrades to the default agent (chat streaming over ws).
  server.on("upgrade", (req, socket, head) => proxy.ws(req, socket, head));

  server.listen(cfg.gatewayPort, () => {
    console.log(
      `[talaria] gateway plane on :${cfg.gatewayPort} — fleet of ${cfg.fleet.length}` +
        ` (${cfg.fleet.map((a) => a.model).join(", ")}); default=${def.model}`,
    );
  });
  return server;
}
