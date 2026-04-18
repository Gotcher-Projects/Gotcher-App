#!/usr/bin/env bash
# Seed growth records and feeding logs for the existing demo user.
# Run seed-demo-user.sh first if the demo account doesn't exist yet.
# Requires: curl, python3
# Services must be running: cd Backend && ./start-services.sh
#
# Demo credentials:
#   Email:    demo@gotcherapp.com
#   Password: DemoPass1

set -e

API="http://localhost:3001"
EMAIL="demo@gotcherapp.com"
PASSWORD="DemoPass1"

echo "==> Logging in as demo user..."
LOGIN=$(curl -sf -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin).get('accessToken',''))")
if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "ERROR: Could not get access token. Is the API running and the demo user created?"
  exit 1
fi
echo "    Token acquired."

# Helper: JSON-encode a string value
json_str() {
  printf '%s' "$1" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))"
}

# ── Growth Records ────────────────────────────────────────────────────────────
post_growth() {
  local DATE="$1"
  local WEIGHT="$2"  # lbs
  local HEIGHT="$3"  # total inches
  local HEAD="$4"    # inches
  local NOTES="$5"
  curl -sf -X POST "$API/growth" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"recordedDate\":\"$DATE\",\"weightLbs\":$WEIGHT,\"heightIn\":$HEIGHT,\"headIn\":$HEAD,\"notes\":$(json_str "$NOTES")}" \
    > /dev/null
  echo "    $DATE: ${WEIGHT} lbs, ${HEIGHT} in, head ${HEAD} in"
}

echo "==> Creating growth records..."
# Lily born 2025-11-02 — realistic growth curve over 20 weeks
post_growth "2025-11-03" 7.5  20.0  13.5 "Newborn checkup"
post_growth "2025-12-01" 9.2  21.5  14.5 "4-week visit"
post_growth "2026-01-05" 11.5 23.0  15.2 "9-week checkup"
post_growth "2026-02-02" 13.0 24.0  15.8 "3-month well visit"
post_growth "2026-03-02" 14.2 25.0  16.1 "4-month checkup"
post_growth "2026-03-22" 15.1 25.75 16.4 "4.5 month — on track!"

# ── Feeding Logs ──────────────────────────────────────────────────────────────
echo "==> Creating feeding logs (last 3 days)..."

python3 - "$API" "$TOKEN" << 'PYEOF'
import sys, json, urllib.request
from datetime import datetime, timedelta, timezone

api, token = sys.argv[1], sys.argv[2]
headers = {"Content-Type": "application/json", "Authorization": f"Bearer {token}"}
now = datetime.now(timezone.utc)

sessions = [
    # (days_ago, start_hour, start_min, duration_min, type)
    (3, 7,  0,  22, "breast_left"),
    (3, 10, 30, 20, "breast_right"),
    (3, 14,  0, 18, "bottle"),
    (3, 19, 15, 15, "breast_left"),
    (2,  6, 45, 23, "breast_right"),
    (2, 11,  0, 20, "breast_left"),
    (2, 15, 30, 16, "formula"),
    (2, 19,  0, 17, "breast_right"),
    (1,  7,  0, 25, "breast_left"),
    (1, 11, 30, 19, "breast_right"),
    (1, 16,  0, 14, "bottle"),
]

def req(method, path, body=None):
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(f"{api}{path}", data=data, headers=headers, method=method)
    with urllib.request.urlopen(r) as resp:
        return json.loads(resp.read())

for days_ago, sh, sm, dur, ftype in sessions:
    d = now - timedelta(days=days_ago)
    started = d.replace(hour=sh, minute=sm, second=0, microsecond=0)
    ended   = started + timedelta(minutes=dur)
    log = req("POST", "/feeding", {"type": ftype, "startedAt": started.isoformat()})
    req("PATCH", f"/feeding/{log['id']}", {"endedAt": ended.isoformat()})
    print(f"    {ftype}: {started.strftime('%Y-%m-%d %H:%M')} ({dur} min)")

PYEOF

echo ""
echo "Done! Seeded for demo@gotcherapp.com / Lily:"
echo "  Growth:   6 records (newborn → 20 weeks, imperial units)"
echo "  Feeding:  11 completed sessions (last 3 days)"
