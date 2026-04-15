#!/usr/bin/env bash
# Seed a demo user with a full baby profile and journal entries.
# Requires: curl, python3 (or python)
# Services must be running: cd Backend && ./start-services.sh
#
# Demo credentials:
#   Email:    demo@gotcherapp.com
#   Password: DemoPass1

set -e

API="http://localhost:3001"
EMAIL="demo@gotcherapp.com"
PASSWORD="DemoPass1"
DISPLAY_NAME="Sarah Mitchell"
BABY_NAME="Lily"
# Born ~20 weeks ago from 2026-03-22
BIRTHDATE="2025-11-02"
PARENT_NAME="Sarah Mitchell"
PHONE="555-012-3456"

echo "==> Registering demo user..."
REG=$(curl -sf -X POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"displayName\":\"$DISPLAY_NAME\"}" || true)

if [ -z "$REG" ]; then
  echo "    (Registration failed — user may already exist, attempting login...)"
  REG=$(curl -sf -X POST "$API/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
fi

TOKEN=$(echo "$REG" | python -c "import sys,json; print(json.load(sys.stdin).get('accessToken',''))" 2>/dev/null \
  || echo "$REG" | python3 -c "import sys,json; print(json.load(sys.stdin).get('accessToken',''))" 2>/dev/null \
  || echo "")
if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "ERROR: Could not get access token. Is the API running on port 3001?"
  exit 1
fi
echo "    Token acquired."

# Helper: JSON-encode a string value (handles quotes, newlines, special chars)
json_str() {
  printf '%s' "$1" | python -c "import sys,json; print(json.dumps(sys.stdin.read()))" 2>/dev/null \
    || printf '%s' "$1" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))"
}

# ── Baby Profile ──────────────────────────────────────────────────────────────
echo "==> Creating baby profile (Lily, born $BIRTHDATE)..."
curl -sf -X PUT "$API/baby-profile" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"babyName\":\"$BABY_NAME\",\"birthdate\":\"$BIRTHDATE\",\"parentName\":\"$PARENT_NAME\",\"phone\":\"$PHONE\"}" \
  > /dev/null
echo "    Baby profile saved."

# ── Journal Entries ───────────────────────────────────────────────────────────
post_entry() {
  local WEEK="$1"
  local TITLE="$2"
  local STORY="$3"
  curl -sf -X POST "$API/journal" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"week\":$WEEK,\"title\":$(json_str "$TITLE"),\"story\":$(json_str "$STORY")}" \
    > /dev/null
  echo "    Week $WEEK: $TITLE"
}

echo "==> Creating journal entries..."

post_entry 2 "Home at last" \
"We brought Lily home from the hospital today. The house felt completely different — quieter in one way, noisier in another. She slept most of the drive and woke up the moment we stopped. Classic. We laid her in the bassinet and just stared at her for about twenty minutes. Nobody wanted to be the first one to look away."

post_entry 4 "First real smile" \
"It happened right after her morning feed. She looked up at me, and the corners of her mouth curled up — a real smile, not the gassy kind. I know because she did it twice. I may have cried a little. Her dad definitely cried. We're not embarrassed about it."

post_entry 6 "Tummy time champion" \
"We've been doing tummy time every day and Lily is getting so strong. Today she lifted her head and actually held it there for a good ten seconds before flopping back down. She looked very pleased with herself. We cheered like she'd scored a goal and she looked at us like we were slightly unhinged."

post_entry 8 "First laugh" \
"This is the moment I've been waiting for. I was making ridiculous faces at her and she just — laughed. A real, full baby belly laugh. I immediately forgot every exhausted night and hard morning. We spent the next hour trying to get it to happen again. She's figured out she has power over us."

post_entry 10 "Grabbing everything" \
"Lily has discovered her hands. More specifically, she has discovered that her hands can grab things, and that things include my hair, my necklace, a full glass of water, and the corner of a very important document. She is very good at grabbing. We are adjusting everything about the house accordingly."

post_entry 12 "Three months already" \
"Three months. I keep saying it out loud because I can't quite believe it. She's so much more of a person now than the tiny, sleepy bundle we brought home. She has opinions — strong ones — about songs, about which side of the room she'd like to face, and about whether she'd like to nap right now (she would not). I wouldn't trade any of it."

post_entry 16 "Rolling over — both ways!" \
"She has been rocking back and forth for two weeks and today she finally committed. Back to front, front to back, done. She looked absolutely delighted with herself and then immediately tried to roll off the mat. We are now on full alert at all times. The era of leaving her somewhere and trusting she'll stay there is officially over."

post_entry 20 "Sitting up" \
"Lily sat up by herself today — properly, no wobbling, for about thirty seconds before toppling gently sideways onto the mat. She seemed totally unbothered by the fall and immediately tried again. She's determined. She gets that from her dad. I'm writing this down because I don't want to forget the exact way she looked when she realised she'd done it."

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

# Use Python to generate timestamps relative to now, then post each feed
python3 - "$API" "$TOKEN" << 'PYEOF'
import sys, json, urllib.request, urllib.error
from datetime import datetime, timedelta, timezone

api, token = sys.argv[1], sys.argv[2]
headers = {"Content-Type": "application/json", "Authorization": f"Bearer {token}"}
now = datetime.now(timezone.utc)

sessions = [
    # (days_ago, start_hour, start_min, duration_min, type)
    (3, 7,  0,  22, "breast_left"),
    (3, 10, 30, 20, "breast_right"),
    (3, 14, 0,  18, "bottle"),
    (3, 19, 15, 15, "breast_left"),
    (2, 6,  45, 23, "breast_right"),
    (2, 11, 0,  20, "breast_left"),
    (2, 15, 30, 16, "formula"),
    (2, 19, 0,  17, "breast_right"),
    (1, 7,  0,  25, "breast_left"),
    (1, 11, 30, 19, "breast_right"),
    (1, 16, 0,  14, "bottle"),
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

# ── Sleep Logs ────────────────────────────────────────────────────────────────
echo "==> Creating sleep logs (last 7 days)..."

python3 - "$API" "$TOKEN" << 'PYEOF'
import sys, json, urllib.request
from datetime import datetime, timedelta, timezone

api, token = sys.argv[1], sys.argv[2]
headers = {"Content-Type": "application/json", "Authorization": f"Bearer {token}"}
now = datetime.now(timezone.utc)

def req(method, path, body=None):
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(f"{api}{path}", data=data, headers=headers, method=method)
    with urllib.request.urlopen(r) as resp:
        return json.loads(resp.read())

# (days_ago, start_hour, start_min, end_hour, end_min, type, notes)
sessions = [
    # Night sleeps — goes down ~8pm, wakes ~6am (realistic 10h night with one waking treated as one block)
    (7, 20,  0,  6, 15, "night", "Slept well, only one waking"),
    (6, 20, 15,  5, 50, "night", "Fussy going down, slept through"),
    (5, 19, 45,  6,  0, "night", "Good night"),
    (4, 20, 30,  6, 30, "night", "Two wakings around 2am and 4am"),
    (3, 20,  0,  6, 10, "night", "Best night yet!"),
    (2, 20, 20,  6, 45, "night", None),
    (1, 20,  0,  6,  0, "night", None),
    # Naps — 2-3 per day
    (7,  9,  0,  9, 45, "nap", "Morning nap"),
    (7, 12, 30, 14,  0, "nap", "Long afternoon nap"),
    (7, 16,  0, 16, 30, "nap", "Short catnap"),
    (6,  9, 15, 10, 10, "nap", None),
    (6, 13,  0, 14, 15, "nap", None),
    (6, 16, 30, 17,  0, "nap", None),
    (5,  9, 30, 10, 20, "nap", "Went down easy"),
    (5, 13, 15, 14, 45, "nap", None),
    (4,  9,  0,  9, 35, "nap", "Short nap today"),
    (4, 12, 45, 14,  0, "nap", None),
    (4, 16,  0, 16, 25, "nap", None),
    (3,  9, 30, 10, 30, "nap", None),
    (3, 13,  0, 14, 30, "nap", "Long one!"),
    (2,  9,  0,  9, 50, "nap", None),
    (2, 12, 30, 13, 45, "nap", None),
    (1,  9, 15, 10,  5, "nap", None),
    (1, 13,  0, 14, 20, "nap", None),
    (1, 16, 30, 17,  0, "nap", "Catnap before bedtime"),
]

for days_ago, sh, sm, eh, em, stype, notes in sessions:
    d = now - timedelta(days=days_ago)
    started = d.replace(hour=sh, minute=sm, second=0, microsecond=0)
    ended   = d.replace(hour=eh, minute=em, second=0, microsecond=0)
    if ended <= started:
        ended += timedelta(days=1)
    body = {"type": stype, "startedAt": started.isoformat(), "endedAt": ended.isoformat()}
    if notes:
        body["notes"] = notes
    req("POST", "/sleep", body)
    dur = int((ended - started).total_seconds() / 60)
    print(f"    {stype}: {started.strftime('%Y-%m-%d %H:%M')} ({dur} min)")

PYEOF

# ── Poop Logs ─────────────────────────────────────────────────────────────────
echo "==> Creating poop logs (last 7 days)..."

python3 - "$API" "$TOKEN" << 'PYEOF'
import sys, json, urllib.request
from datetime import datetime, timedelta, timezone

api, token = sys.argv[1], sys.argv[2]
headers = {"Content-Type": "application/json", "Authorization": f"Bearer {token}"}
now = datetime.now(timezone.utc)

def req(method, path, body=None):
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(f"{api}{path}", data=data, headers=headers, method=method)
    with urllib.request.urlopen(r) as resp:
        return json.loads(resp.read())

# (days_ago, hour, min, type, color, consistency, notes)
logs = [
    (7,  9, 30, "normal", "yellow",  "seedy",   "Classic newborn yellow"),
    (7, 16,  0, "normal", "yellow",  "seedy",   None),
    (6,  8, 45, "normal", "brown",   "normal",  None),
    (6, 14, 15, "loose",  "yellow",  "watery",  "A bit runny today"),
    (5, 10,  0, "normal", "yellow",  "seedy",   None),
    (5, 17, 30, "normal", "brown",   "normal",  None),
    (4,  9, 15, "normal", "yellow",  "seedy",   None),
    (4, 13,  0, "normal", "yellow",  "seedy",   None),
    (4, 18, 30, "normal", "brown",   "normal",  "After formula bottle"),
    (3,  8, 30, "normal", "yellow",  "seedy",   None),
    (3, 15,  0, "normal", "brown",   "normal",  None),
    (2,  9,  0, "normal", "yellow",  "seedy",   None),
    (2, 14, 30, "normal", "yellow",  "seedy",   None),
    (1,  8, 15, "normal", "yellow",  "seedy",   None),
    (1, 12, 45, "normal", "brown",   "normal",  None),
    (1, 17,  0, "loose",  "green",   "watery",  "Green one — might be foremilk"),
]

for days_ago, hour, minute, ptype, color, consistency, notes in logs:
    d = now - timedelta(days=days_ago)
    logged_at = d.replace(hour=hour, minute=minute, second=0, microsecond=0)
    body = {"loggedAt": logged_at.isoformat(), "type": ptype, "color": color, "consistency": consistency}
    if notes:
        body["notes"] = notes
    req("POST", "/poop", body)
    print(f"    {ptype} / {color} / {consistency}: {logged_at.strftime('%Y-%m-%d %H:%M')}")

PYEOF

echo ""
echo "Done! Demo account ready:"
echo "  Email:    $EMAIL"
echo "  Password: $PASSWORD"
echo "  Baby:     $BABY_NAME (born $BIRTHDATE, ~22 weeks)"
echo "  Journal:  8 entries (weeks 2, 4, 6, 8, 10, 12, 16, 20)"
echo "  Growth:   6 records (newborn → 20 weeks, imperial units)"
echo "  Feeding:  11 completed sessions (last 3 days)"
echo "  Sleep:    25 sessions (7 nights + 18 naps, last 7 days)"
echo "  Poop:     16 entries (last 7 days)"
