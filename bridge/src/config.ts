/**
 * Talaria bridge configuration, resolved from the environment.
 *
 * See stack/.env.example for the canonical list. Everything has a sensible
 * default so the bridge boots in pure pass-through mode with zero config.
 */
import { readFileSync } from "node:fs";

export interface TalariaConfig {
  /** Port the bridge listens on. hermes-workspace's HERMES_DASHBOARD_URL points here. */
  port: number;
  /** The REAL Hermes dashboard we reverse-proxy to (e.g. http://kanban-dashboard:9119). */
  dashboardUpstream: string;
  /** mission-control base URL (the fleet brain). Empty ⇒ interception disabled. */
  missionControlUrl: string;
  /** mission-control API key (Bearer). Prefer the *_FILE docker-secret form. */
  missionControlApiKey: string;
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
  };
}
