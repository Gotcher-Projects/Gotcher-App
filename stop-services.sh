#!/usr/bin/env bash

# GotcherApp — Stop All Services
#
# Stops all Docker containers for BOTH GotcherApp and TavernTales,
# then kills any processes still holding known ports.
# Safe to run from either project.

GOTCHERAPP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TAVERNTALES_DIR="/c/Projects/TavernTales"

# All ports used across both projects
PORTS=(5432 5050 3000 8080 8081 8082 8083 8084 8085 8086 8087)
NAMES=(postgres pgadmin frontend api-gateway npc-service campaign-service "location-service" auth-service "search-service" "transcription-service" encounter-service)

echo ""
echo "  GotcherApp + TavernTales — Stopping All Services"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── Docker Compose Down ─────────────────────────────────────────────────────
if docker info > /dev/null 2>&1; then
  if [ -f "$GOTCHERAPP_DIR/Backend/docker-compose.yml" ]; then
    echo "  Stopping GotcherApp containers..."
    docker compose -f "$GOTCHERAPP_DIR/Backend/docker-compose.yml" down
  fi

  if [ -f "$TAVERNTALES_DIR/docker-compose.yml" ]; then
    echo "  Stopping TavernTales containers..."
    docker compose -f "$TAVERNTALES_DIR/docker-compose.yml" down
  fi
else
  echo "  Docker not running — skipping container shutdown."
fi
echo ""
# ──────────────────────────────────────────────────────────────────────────

# ── Kill Port Processes ─────────────────────────────────────────────────────
killed_any=false

for i in "${!PORTS[@]}"; do
  port="${PORTS[$i]}"
  name="${NAMES[$i]}"

  pid=$(netstat -ano 2>/dev/null \
    | grep -E "TCP.*:${port}[[:space:]].*LISTENING" \
    | awk '{print $NF}' \
    | head -1)

  if [ -n "$pid" ] && [ "$pid" != "0" ]; then
    taskkill //PID "$pid" //F > /dev/null 2>&1
    printf "  %-24s port %-6s PID %-6s → stopped\n" "$name" "$port" "$pid"
    killed_any=true
  else
    printf "  %-24s port %-6s → not running\n" "$name" "$port"
  fi
done
# ──────────────────────────────────────────────────────────────────────────

echo ""
if $killed_any; then
  echo "  All running services stopped."
else
  echo "  No port processes were running."
fi
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
