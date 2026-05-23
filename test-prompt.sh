#!/usr/bin/env bash
# test-prompt.sh — Build the storybook period prompt from local DB and call Claude.
# Usage: ./test-prompt.sh --period START-END [--user EMAIL] [--temperature N]
# Example: ./test-prompt.sh --period 0-12
# Requires: ANTHROPIC_API_KEY env var, Docker container gotcherapp-postgres running.

set -e

PERIOD=""
USER_EMAIL="demo@gotcherapp.com"
TEMPERATURE="${ANTHROPIC_TEMPERATURE:-0.3}"
MODEL="${ANTHROPIC_MODEL:-claude-haiku-4-5-20251001}"

while [[ $# -gt 0 ]]; do
    case $1 in
        --period)      PERIOD="$2";      shift 2 ;;
        --user)        USER_EMAIL="$2";  shift 2 ;;
        --temperature) TEMPERATURE="$2"; shift 2 ;;
        *) echo "Unknown argument: $1" >&2; exit 1 ;;
    esac
done

if [ -z "$PERIOD" ]; then
    echo "Usage: $0 --period START-END [--user EMAIL] [--temperature N]" >&2
    echo "  Example: $0 --period 0-12" >&2
    exit 1
fi

if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "ERROR: ANTHROPIC_API_KEY is not set" >&2
    exit 1
fi

WEEK_START="${PERIOD%%-*}"
WEEK_END="${PERIOD##*-}"

if ! [[ "$WEEK_START" =~ ^[0-9]+$ ]] || ! [[ "$WEEK_END" =~ ^[0-9]+$ ]]; then
    echo "ERROR: --period must be START-END with integers (e.g. 0-12)" >&2
    exit 1
fi

ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
ANTHROPIC_MODEL="$MODEL" \
ANTHROPIC_TEMPERATURE="$TEMPERATURE" \
python3 - "$WEEK_START" "$WEEK_END" "$USER_EMAIL" << 'PYEOF'
import os, sys, subprocess, json, urllib.request, urllib.error

week_start  = int(sys.argv[1])
week_end    = int(sys.argv[2])
user_email  = sys.argv[3]
api_key     = os.environ["ANTHROPIC_API_KEY"]
model       = os.environ.get("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")
temperature = float(os.environ.get("ANTHROPIC_TEMPERATURE", "0.3"))

# Must stay in sync with StorybookService.MILESTONE_LABELS and Frontend babyData.js
MILESTONE_LABELS = {
    0:  ["Turns toward voices", "Lifts head during tummy time", "High contrast patterns"],
    4:  ["Social smiling", "Tracks objects side to side", "Brings hands to mouth"],
    8:  ["Coos and babbles", "Better head control", "Kicks and stretches"],
    12: ["Laughs out loud", "Holds head steady", "Grasps toys and shakes them"],
    16: ["Rolls tummy to back", "Reaches for objects", "Brings feet to hands"],
    20: ["Rolls both ways", "Responds to name", "Babbles ba-da sounds"],
    24: ["Sits with support", "Transfers objects hand to hand", "Explores with mouth"],
    28: ["Sits without support", "Bears weight on legs", "Object permanence begins"],
    32: ["Army crawls or pivots", "Stranger awareness", "Imitates sounds"],
    36: ["Crawls on hands/knees", "Pulls to stand", "Plays peek-a-boo"],
    40: ["Cruises along furniture", "Pincer grasp", "Says mama/dada"],
    44: ["Stands alone briefly", "Understands gestures", "Drops objects on purpose"],
    48: ["Takes first steps", "Says 1-2 words with meaning", "Claps and waves"],
}

# Must stay in sync with ClaudeClient.SYSTEM_PROMPT
SYSTEM_PROMPT = (
    "You are writing a chapter in a baby's memory book. "
    "Write in second person, addressed to the baby ('You did…' / 'You were…'). "
    "LENGTH: For each memory or event provided, assess its richness — a brief note may earn 1 paragraph, "
    "a detailed entry with personal context may deserve 3–4. "
    "Write exactly as many paragraphs as the content genuinely earns. "
    "Do not pad with generic filler, repetition, or sentiment not in the source. Maximum: 25 paragraphs. "
    "STRICT RULES: "
    "(1) You may only reference people, relationships, and events that are explicitly named in the journal entries provided. "
    "(2) Do not infer or assume how many parents are present, their genders, or anyone's relationship to the baby unless the journal text states it explicitly. "
    "(3) Never write 'your dad', 'your mom', or 'the two of us' unless those exact relationships appear in the source text. "
    "If the source is silent about who was present, describe the baby's actions directly or use 'the people who love you'. "
    "(4) Do not add emotional reactions, physical details, or sensory color that are not mentioned in the source text. "
    "(5) Use 'we' only if the journal entries themselves use 'we'. "
    "(6) Tone: heartfelt and warm, never saccharine. "
    "(7) Photo markers: if the prompt includes a 'Photos available:' line, you MUST place "
    "the exact marker on its own line, preceded by a blank line, immediately after the paragraph "
    "that most directly references that memory. "
    "Marker format: [PHOTO:journal:42] or [PHOTO:first_time:42]. "
    "Only emit markers for IDs listed under 'Photos available'. "
    "If no 'Photos available' line is present, emit no markers. "
    "Do not add a chapter title — just the body paragraphs and photo markers as instructed."
)

CONTAINER = "gotcherapp-postgres"
DB_USER   = "gotcherapp_app"
DB_PASS   = "changeme_local"
DB_NAME   = "gotcherapp"

def db_json(sql):
    """Run sql via docker exec psql; each row must be a single json_build_object column."""
    result = subprocess.run(
        ["docker", "exec", "-e", f"PGPASSWORD={DB_PASS}",
         CONTAINER, "psql", "-U", DB_USER, "-d", DB_NAME, "-t", "-A", "-c", sql],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print(f"DB ERROR: {result.stderr}", file=sys.stderr)
        sys.exit(1)
    rows = []
    for line in result.stdout.strip().split('\n'):
        line = line.strip()
        if line:
            rows.append(json.loads(line))
    return rows

def db_val(sql):
    result = subprocess.run(
        ["docker", "exec", "-e", f"PGPASSWORD={DB_PASS}",
         CONTAINER, "psql", "-U", DB_USER, "-d", DB_NAME, "-t", "-A", "-c", sql],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print(f"DB ERROR: {result.stderr}", file=sys.stderr)
        sys.exit(1)
    return result.stdout.strip()

def decode_milestone(key):
    try:
        parts = key.split('-')
        week, idx = int(parts[0]), int(parts[1])
        labels = MILESTONE_LABELS.get(week)
        if labels and idx < len(labels):
            return labels[idx]
    except Exception:
        pass
    return None

# ── Fetch data ────────────────────────────────────────────────────────────────
user_id = db_val(f"SELECT id FROM users WHERE email = '{user_email}'")
if not user_id:
    print(f"ERROR: User '{user_email}' not found in database", file=sys.stderr)
    sys.exit(1)

baby_rows = db_json(
    f"SELECT json_build_object('id', id, 'baby_name', baby_name, 'birthdate', birthdate::text) "
    f"FROM baby_profiles WHERE user_id = {user_id} LIMIT 1"
)
if not baby_rows:
    print(f"ERROR: No baby profile found for '{user_email}'", file=sys.stderr)
    sys.exit(1)
baby       = baby_rows[0]
profile_id = baby['id']
baby_name  = baby['baby_name'] or 'Baby'

journal_entries = db_json(
    f"SELECT json_build_object('title', title, 'story', story, 'week', week, 'entry_date', entry_date::text) "
    f"FROM journal_entries "
    f"WHERE baby_profile_id = {profile_id} AND week >= {week_start} AND week <= {week_end} "
    f"ORDER BY entry_date LIMIT 10"
)

first_times = db_json(
    f"SELECT json_build_object('label', ft.label, 'notes', ft.notes, 'occurred_date', ft.occurred_date::text) "
    f"FROM first_times ft "
    f"JOIN baby_profiles bp ON bp.id = ft.baby_profile_id "
    f"WHERE ft.baby_profile_id = {profile_id} "
    f"AND (ft.occurred_date - bp.birthdate) / 7.0 BETWEEN {week_start} AND {week_end} "
    f"ORDER BY ft.occurred_date"
)

milestone_keys = db_json(
    f"SELECT json_build_object('key', milestone_key) "
    f"FROM milestones WHERE baby_profile_id = {profile_id}"
)

# ── Build prompt (matches StorybookService.appendMergedPeriodContext) ─────────
def chapter_label(ws, we):
    if ws == 0 and we <= 13:
        return "Your First Three Months"
    if ws <= 13 and we <= 26:
        return "Three to Six Months"
    return f"Weeks {ws}–{we}"

prompt  = f"Baby: {baby_name}\n"
prompt += f"Chapter: {chapter_label(week_start, week_end)}\n"
prompt += f"Time period: weeks {week_start}–{week_end} of life\n\n"

all_memories = []
for e in journal_entries:
    week  = e['week']
    title = e['title'] or ''
    story = e.get('story')
    date  = e.get('entry_date') or ''
    line  = f"- [Week {week}] {title}"
    if story:
        line += f": {story}"
    all_memories.append((date, line))

for f in first_times:
    lbl   = f['label'] or ''
    notes = f.get('notes')
    date  = f.get('occurred_date') or ''
    line  = f"- {lbl}"
    if notes:
        line += f" ({notes})"
    all_memories.append((date, line))

all_memories.sort(key=lambda x: x[0])

if all_memories:
    prompt += "Memories from this time:\n"
    for _, line in all_memories:
        prompt += line + "\n"
    prompt += "\n"

milestones_in_window = []
for m in milestone_keys:
    key = m['key']
    try:
        week_num = int(key.split('-')[0])
        if week_start <= week_num <= week_end:
            decoded = decode_milestone(key)
            if decoded:
                milestones_in_window.append(decoded)
    except Exception:
        pass

if milestones_in_window:
    prompt += "Other milestones achieved around this time:\n"
    for lbl in milestones_in_window:
        prompt += f"- {lbl}\n"
    prompt += "\n"

# ── Print what we're sending ──────────────────────────────────────────────────
SEP = "=" * 70

print(SEP)
print("[SYSTEM PROMPT]")
print(SEP)
print(SYSTEM_PROMPT)
print()
print(SEP)
print("[USER PROMPT]")
print(SEP)
print(prompt)

# ── Call Claude ───────────────────────────────────────────────────────────────
print(SEP)
print(f"[CALLING CLAUDE  model={model}  temperature={temperature}  max_tokens=1200]")
print(SEP)
print()

req_body = json.dumps({
    "model": model,
    "max_tokens": 1200,
    "temperature": temperature,
    "system": SYSTEM_PROMPT,
    "messages": [{"role": "user", "content": prompt}]
}).encode()

req = urllib.request.Request(
    "https://api.anthropic.com/v1/messages",
    data=req_body,
    headers={
        "Content-Type": "application/json",
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
    },
    method="POST"
)

try:
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read())
    text = data["content"][0]["text"]
    print(SEP)
    print("[CLAUDE RESPONSE]")
    print(SEP)
    print(text)
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f"ERROR: Claude API returned {e.code}: {body}", file=sys.stderr)
    sys.exit(1)

PYEOF
