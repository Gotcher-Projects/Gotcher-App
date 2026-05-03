#!/usr/bin/env bash

# GotcherApp — Start Services
#
# Starts Docker (postgres + pgadmin) and the Node API server.
# NOTE: TavernTales uses the same ports (5432, 5050) — run stop-services.sh first if needed.
# To add more Node services later, copy the start_service pattern below.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$ROOT_DIR/logs"

mkdir -p "$LOG_DIR"

export PATH="$PATH:/c/Program Files/nodejs"

# Make gradlew executable if it isn't already
chmod +x "$ROOT_DIR/Backend/gradlew" 2>/dev/null || true

PIDS=()
NAMES=()
URLS=()

cleanup() {
  echo ""
  echo "  Shutting down all services..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  echo "  Done."
  echo ""
  exit 0
}

trap cleanup SIGINT SIGTERM

start_service() {
  local name="$1"
  local dir="$2"
  local cmd="$3"
  local url="$4"
  local log="$LOG_DIR/${name}.log"

  if [ ! -d "$dir" ]; then
    echo "  [SKIP] $name — directory not found: $dir"
    return
  fi

  (cd "$dir" && eval "$cmd" > "$log" 2>&1) &
  local pid=$!
  PIDS+=("$pid")
  NAMES+=("$name")
  URLS+=("$url")
  printf "  %-20s PID %-6s → logs/%s.log\n" "$name" "$pid" "$name"
}

echo ""
echo "  GotcherApp — Starting Services"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── Port conflict check ────────────────────────────────────────────────────
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^taverntales-"; then
  echo "  [ERROR] TavernTales containers are running and own ports 5432/5050/3000."
  echo "          GotcherApp's postgres will start without a port binding and all"
  echo "          DB connections will hit the wrong database."
  echo ""
  echo "  Stop TavernTales first:"
  echo "    docker stop taverntales-postgres taverntales-pgadmin"
  echo ""
  echo "  Then re-run this script."
  exit 1
fi
# ──────────────────────────────────────────────────────────────────────────

# ── Docker ─────────────────────────────────────────────────────────────────
DOCKER_DESKTOP="/c/Program Files/Docker/Docker/Docker Desktop.exe"

if ! docker info > /dev/null 2>&1; then
  echo "  Docker not running — launching Docker Desktop..."
  if [ -f "$DOCKER_DESKTOP" ]; then
    "$DOCKER_DESKTOP" &
  else
    echo "  [WARN] Docker Desktop not found at expected path. Please start it manually."
  fi

  echo -n "  Waiting for Docker engine"
  for i in $(seq 1 60); do
    if docker info > /dev/null 2>&1; then
      echo " ready."
      break
    fi
    echo -n "."
    sleep 2
    if [ "$i" -eq 60 ]; then
      echo ""
      echo "  [ERROR] Docker engine did not start in time. Aborting."
      exit 1
    fi
  done
else
  echo "  Docker already running."
fi

echo "  Starting postgres + pgadmin via docker compose..."
docker compose -f "$ROOT_DIR/Backend/docker-compose.yml" up -d
echo ""
# ──────────────────────────────────────────────────────────────────────────

# ── Capacitor Android sync (only if android/ project exists) ───────────────
if [ -d "$ROOT_DIR/Frontend/android" ]; then
  echo "  Android project detected — building and syncing Capacitor assets..."
  (cd "$ROOT_DIR/Frontend" && npm run build && npx cap sync android)
  if [ $? -eq 0 ]; then
    echo "  Capacitor sync complete."
  else
    echo "  [WARN] Capacitor sync failed — Android assets may be stale."
  fi
  echo ""
fi
# ──────────────────────────────────────────────────────────────────────────

# ── Services ───────────────────────────────────────────────────────────────
start_service "api"      "$ROOT_DIR/Backend"   "set -a && [ -f .env ] && source .env; set +a && ./gradlew bootRun"  "http://localhost:3001"
start_service "frontend" "$ROOT_DIR/Frontend"  "npm run dev"        "http://localhost:3000"
# Future services — uncomment as they are built:
# start_service "worker"   "$ROOT_DIR/Worker"    "npm run dev"  ""
# ──────────────────────────────────────────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  URLs:"
printf "  %-20s %s\n" "postgres"  "localhost:5432"
printf "  %-20s %s\n" "pgadmin"   "http://localhost:5050"
for i in "${!NAMES[@]}"; do
  printf "  %-20s %s\n" "${NAMES[$i]}" "${URLS[$i]}"
done
echo ""
echo "  Logs: ./logs/"
echo "  Press Ctrl+C to stop everything."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── Log Tail ───────────────────────────────────────────────────────────────
COLORS=($'\033[36m' $'\033[33m' $'\033[35m' $'\033[32m' $'\033[34m' $'\033[31m')
RESET=$'\033[0m'

echo ""
echo "  Tailing logs — live output below (Ctrl+C to stop everything)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

for i in "${!NAMES[@]}"; do
  name="${NAMES[$i]}"
  color="${COLORS[$((i % ${#COLORS[@]}))]}"
  (
    tail -n 0 -f "$LOG_DIR/${name}.log" 2>/dev/null | while IFS= read -r line; do
      printf "${color}[%-18s]${RESET} %s\n" "$name" "$line"
    done
  ) &
  PIDS+=($!)
done
# ──────────────────────────────────────────────────────────────────────────

wait
