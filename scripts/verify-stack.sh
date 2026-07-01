#!/usr/bin/env bash
# Talaria stack smoke test — reproduces the M1/M2/M3 verification end-to-end
# against a running `talaria/stack`. Exits non-zero on the first failure.
#
#   docker compose -f talaria/stack/docker-compose.yml up -d --build
#   talaria/scripts/verify-stack.sh
#
# Assumes the default local-debug ports: bridge :9119, mission-control :8700.
set -euo pipefail

BRIDGE="${BRIDGE:-http://127.0.0.1:9119}"
MC="${MC:-http://127.0.0.1:8700}"
ENV_FILE="${ENV_FILE:-$(dirname "$0")/../stack/.env}"
MCKEY="${MISSION_CONTROL_API_KEY:-$(grep -oE '^MISSION_CONTROL_API_KEY=.+' "$ENV_FILE" 2>/dev/null | cut -d= -f2- || true)}"
[ -n "$MCKEY" ] || { echo "FAIL: MISSION_CONTROL_API_KEY not found (set it or ENV_FILE)"; exit 1; }

pass() { echo "  PASS: $1"; }
fail() { echo "  FAIL: $1"; exit 1; }
mc()   { curl -s -H "x-api-key: $MCKEY" -H 'Content-Type: application/json' "$@"; }

echo "== M1: conductor capability probe =="
code=$(curl -s -o /dev/null -w '%{http_code}' "$BRIDGE/api/conductor/missions")
ct=$(curl -s -o /dev/null -w '%{content_type}' "$BRIDGE/api/conductor/missions")
[ "$code" = "200" ] && case "$ct" in application/json*) true;; *) false;; esac \
  && pass "GET /api/conductor/missions → 200 application/json (workspace uses remote dispatch)" \
  || fail "probe expected 200 application/json, got $code $ct"

echo "== M1: pass-through to the real Hermes dashboard =="
curl -s "$BRIDGE/api/status" | grep -q '"version"' \
  && pass "/api/status proxied to kanban-dashboard" \
  || fail "/api/status did not return the dashboard status JSON"

echo "== M2: mission create round-trips to a mission-control task =="
created=$(curl -s -X POST "$BRIDGE/api/conductor/missions" -H 'Content-Type: application/json' \
  -d '{"name":"verify-mission","prompt":"smoke-test round-trip"}')
mid=$(echo "$created" | grep -oE '"id":"[0-9]+"' | grep -oE '[0-9]+' | head -1)
[ -n "$mid" ] || fail "create returned no id: $created"
mc "$MC/api/tasks/$mid" | grep -q '"title":"verify-mission"' \
  && pass "POST mission → mission-control task id=$mid (title matched)" \
  || fail "task $mid not found / title mismatch in mission-control"

echo "== M3: poll reports running =="
echo "$(curl -s "$BRIDGE/api/conductor/missions/$mid")" | grep -q '"status":"running"' \
  && pass "GET mission/$mid → status running" \
  || fail "poll did not report running"

echo "== M3: cancel → poll reports cancelled =="
curl -s -X DELETE "$BRIDGE/api/conductor/missions/$mid" | grep -q '"ok":true' || fail "cancel did not return ok"
sleep 0.3
curl -s "$BRIDGE/api/conductor/missions/$mid" | grep -q '"status":"cancelled"' \
  && pass "after DELETE → status cancelled" \
  || fail "cancelled status not reflected on poll"

echo "== M3: unknown mission → 404 =="
[ "$(curl -s -o /dev/null -w '%{http_code}' "$BRIDGE/api/conductor/missions/99999999")" = "404" ] \
  && pass "GET unknown mission → 404" || fail "unknown mission did not 404"

echo "== M3 adapter half: register → assign → heartbeat pulls work → report =="
agent="verify-agent-$$"
aid=$(mc -X POST "$MC/api/agents/register" -d "{\"name\":\"$agent\",\"role\":\"agent\",\"framework\":\"hermes\"}" \
  | grep -oE '"id":[0-9]+' | head -1 | grep -oE '[0-9]+')
[ -n "$aid" ] || fail "agent register returned no id"
tid=$(mc -X POST "$MC/api/tasks" -d "{\"title\":\"verify-assigned\",\"assigned_to\":\"$agent\",\"status\":\"assigned\"}" \
  | grep -oE '"id":[0-9]+' | head -1 | grep -oE '[0-9]+')
mc "$MC/api/agents/$aid/heartbeat" | grep -q '"status":"WORK_ITEMS_FOUND"' \
  && pass "heartbeat for agent $aid → WORK_ITEMS_FOUND" \
  || fail "heartbeat did not surface assigned work"
mc -X PUT "$MC/api/tasks/$tid" -d '{"status":"in_progress"}' >/dev/null
mc "$MC/api/tasks/$tid" | grep -q '"status":"in_progress"' \
  && pass "report moved assigned task $tid → in_progress" \
  || fail "report did not update task status"

echo "== M4: Hermes is a first-class mission-control framework =="
mc "$MC/api/frameworks" | grep -q '"hermes"' \
  && pass "GET /api/frameworks lists hermes (HermesAdapter registered)" \
  || fail "hermes not listed in /api/frameworks"

echo "== Fleet view: workspace kanban board served from mission-control =="
board=$(curl -s "$BRIDGE/api/plugins/kanban/board")
echo "$board" | grep -q '"columns"' && echo "$board" | grep -q '"in_progress"' \
  && pass "GET /api/plugins/kanban/board → columns of mission-control tasks" \
  || fail "kanban board not served from mission-control"
kid=$(curl -s -X POST "$BRIDGE/api/plugins/kanban/tasks" -H 'Content-Type: application/json' \
  -d '{"title":"verify-kanban-card","status":"inbox","priority":2}' | grep -oE '"id":"[0-9]+"' | grep -oE '[0-9]+' | head -1)
[ -n "$kid" ] && pass "POST kanban card → created mission-control task $kid" || fail "kanban create failed"
curl -s -X PATCH "$BRIDGE/api/plugins/kanban/tasks/$kid" -H 'Content-Type: application/json' -d '{"status":"in_progress"}' \
  | grep -q '"status":"in_progress"' && pass "PATCH card inbox→in_progress (drag-to-move)" || fail "kanban move failed"

echo "== Gateway plane: fleet multiplexer (agents-as-models) =="
GW="${GW:-http://127.0.0.1:8642}"
models=$(curl -s "$GW/v1/models")
echo "$models" | grep -q '"object":"model"' \
  && pass "GET /v1/models lists the fleet ($(echo "$models" | grep -oE '"id":"[^"]+"' | wc -l | tr -d ' ') agents)" \
  || fail "gateway plane /v1/models not served"
curl -s "$GW/health" | grep -q '"ok":true' && pass "gateway plane /health ok" || fail "gateway plane health failed"

echo
echo "ALL PASS — Talaria M1-M4 + fleet kanban + gateway multiplexer verified against the running stack."
