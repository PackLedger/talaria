/**
 * Talaria bridge configuration, resolved from the environment.
 *
 * See stack/.env.example for the canonical list. Everything has a sensible
 * default so the bridge boots in pure pass-through mode with zero config.
 */
import { readFileSync } from "node:fs";

/** One agent in the fleet manifest: a model name routed to a gateway with a key. */
export interface FleetAgent {
  /** The model id exposed to the workspace (= the agent's API_SERVER_MODEL_NAME). */
  model: string;
  /** The agent's real Hermes gateway base URL (e.g. http://agent-developer:8642). */
  url: string;
  /** The agent gateway's API_SERVER_KEY (Bearer), injected on forward. */
  key: string;
  /** Optional display label / persona. */
  label?: string;
}

export interface TalariaConfig {
  /** Port the bridge listens on. hermes-workspace's HERMES_DASHBOARD_URL points here. */
  port: number;
  /** The REAL Hermes dashboard we reverse-proxy to (e.g. http://kanban-dashboard:9119). */
  dashboardUpstream: string;
  /** mission-control base URL (the fleet brain). Empty ⇒ interception disabled. */
  missionControlUrl: string;
  /** mission-control API key (Bearer). Prefer the *_FILE docker-secret form. */
  missionControlApiKey: string;
  /** Serve the workspace kanban board from mission-control (fleet view). Default on. */
  kanbanFromMc: boolean;
  /** Gateway plane: port the fleet multiplexer listens on (workspace HERMES_API_URL → here). */
  gatewayPort: number;
  /** The fleet manifest: agents this Talaria multiplexes (empty ⇒ gateway plane disabled). */
  fleet: FleetAgent[];
  /** Default agent model for non-chat gateway calls (sessions, health, …). Defaults to fleet[0]. */
  defaultModel: string;
}

/** Load the fleet manifest from TALARIA_FLEET (JSON) or TALARIA_FLEET_FILE (path). */
function loadFleet(): FleetAgent[] {
  const filePath = process.env.TALARIA_FLEET_FILE;
  let raw = process.env.TALARIA_FLEET ?? "";
  if (!raw && filePath) {
    try {
      raw = readFileSync(filePath, "utf8");
    } catch {
      raw = "";
    }
  }
  if (!raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((a) => a && typeof a.model === "string" && typeof a.url === "string")
      .map((a) => ({ model: a.model, url: String(a.url).replace(/\/$/, ""), key: a.key ?? "", label: a.label }));
  } catch {
    return [];
  }
}

function readSecret(fileEnv: string, valueEnv: string): string {
  const path = process.env[fileEnv];
  if (path) {
    try {
      return readFileSync(path, "utf8").trim();
    } catch {
      /* fall through to the plain env var */
    }
  }
  return (process.env[valueEnv] ?? "").trim();
}

export function loadConfig(): TalariaConfig {
  return {
    port: Number(process.env.TALARIA_PORT ?? "9119"),
    dashboardUpstream: (process.env.TALARIA_DASHBOARD_UPSTREAM ?? "http://127.0.0.1:9119").replace(/\/$/, ""),
    missionControlUrl: (process.env.MISSION_CONTROL_URL ?? "").replace(/\/$/, ""),
    missionControlApiKey: readSecret("MISSION_CONTROL_API_KEY_FILE", "MISSION_CONTROL_API_KEY"),
    kanbanFromMc: (process.env.TALARIA_KANBAN_FROM_MC ?? "1") !== "0",
    gatewayPort: Number(process.env.TALARIA_GATEWAY_PORT ?? "8642"),
    fleet: loadFleet(),
    defaultModel: (process.env.TALARIA_DEFAULT_MODEL ?? "").trim(),
  };
}
