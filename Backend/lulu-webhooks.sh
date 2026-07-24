#!/usr/bin/env sh
# Lulu webhook registration — s14a-1. Registering the PRINT_JOB_STATUS_CHANGED webhook is a ONE-TIME setup call
# per environment, not app code: the URL is environment-specific (a cloudflared tunnel locally, cradlehq.app in
# prod) and sandbox/prod are separate universes with separate registrations, exactly like the API keys.
#
# Reads LULU_* from Backend/.env (same as lulu-verify.sh / lulu-pr5-verify.sh; secrets never committed).
#
#   ./lulu-webhooks.sh                        # list registered webhooks (+ is_active)
#   ./lulu-webhooks.sh register <base_url>    # subscribe <base_url>/print/lulu-webhook to PRINT_JOB_STATUS_CHANGED
#   ./lulu-webhooks.sh test <webhook_id>      # ask Lulu to fire a DUMMY payload at it (plumbing check, no order)
#   ./lulu-webhooks.sh submissions <id>       # last 30 days of delivery attempts — Lulu's built-in audit log
#   ./lulu-webhooks.sh delete <webhook_id>    # remove a registration (e.g. a dead tunnel url)
#
# ⚠ Lulu DEACTIVATES a webhook after 5 CONSECUTIVE failed deliveries. A stale tunnel url, a deploy window, or a
#   restart can silently switch off our failure detector — so `list` and check is_active after any deploy, and
#   remember PrintOrderStatusService.reconcile() is the backstop that makes a dead webhook survivable.
#
# ⚠ The HMAC key our receiver verifies with is LULU_CLIENT_SECRET (see LuluWebhookService).

set -eu

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
ENV_FILE="$SCRIPT_DIR/.env"
[ -f "$ENV_FILE" ] || { echo "✗ No .env at $ENV_FILE"; exit 1; }
get_env() { grep -E "^$1=" "$ENV_FILE" | head -n1 | cut -d= -f2- ; }

CLIENT_ID=$(get_env LULU_CLIENT_ID)
CLIENT_SECRET=$(get_env LULU_CLIENT_SECRET)
BASE=$(get_env LULU_API_BASE); [ -n "$BASE" ] || BASE="https://api.sandbox.lulu.com"

[ -n "$CLIENT_ID" ] && [ -n "$CLIENT_SECRET" ] || { echo "✗ LULU_CLIENT_ID/SECRET blank in .env"; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "✗ curl not found."; exit 1; }

echo "Lulu API base: $BASE"

TOKEN_URL="$BASE/auth/realms/glasstree/protocol/openid-connect/token"
ACCESS=$(curl -s -u "$CLIENT_ID:$CLIENT_SECRET" -d grant_type=client_credentials "$TOKEN_URL" \
  | sed -n 's/.*"access_token"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
[ -n "$ACCESS" ] || { echo "✗ OAuth failed — check creds / base URL."; exit 1; }

AUTH="Authorization: Bearer $ACCESS"
JSON="Content-Type: application/json"
CMD="${1:-list}"

case "$CMD" in
  list)
    echo "→ GET /webhooks/"
    curl -s "$BASE/webhooks/" -H "$AUTH"
    echo ""
    echo "   (check \"is_active\": false means Lulu deactivated it after 5 consecutive failures)"
    ;;

  register)
    URL_BASE="${2:-}"
    [ -n "$URL_BASE" ] || { echo "✗ usage: ./lulu-webhooks.sh register <base_url>   e.g. https://xxx.trycloudflare.com"; exit 1; }
    HOOK_URL="${URL_BASE%/}/print/lulu-webhook"
    echo "→ POST /webhooks/  topic=PRINT_JOB_STATUS_CHANGED  url=$HOOK_URL"
    curl -s -X POST "$BASE/webhooks/" -H "$AUTH" -H "$JSON" \
      -d "{\"topics\":[\"PRINT_JOB_STATUS_CHANGED\"],\"url\":\"$HOOK_URL\"}"
    echo ""
    ;;

  test)
    ID="${2:-}"
    [ -n "$ID" ] || { echo "✗ usage: ./lulu-webhooks.sh test <webhook_id>"; exit 1; }
    echo "→ POST /webhooks/$ID/test/  (Lulu fires a DUMMY payload — our receiver should answer 200, not 500)"
    curl -s -X POST "$BASE/webhooks/$ID/test/" -H "$AUTH" -H "$JSON" -d '{}'
    echo ""
    ;;

  submissions)
    ID="${2:-}"
    [ -n "$ID" ] || { echo "✗ usage: ./lulu-webhooks.sh submissions <webhook_id>"; exit 1; }
    echo "→ GET /webhooks/$ID/submissions/  (last 30 days of delivery attempts)"
    curl -s "$BASE/webhooks/$ID/submissions/" -H "$AUTH"
    echo ""
    ;;

  delete)
    ID="${2:-}"
    [ -n "$ID" ] || { echo "✗ usage: ./lulu-webhooks.sh delete <webhook_id>"; exit 1; }
    echo "→ DELETE /webhooks/$ID/"
    curl -s -o /dev/null -w "HTTP %{http_code}\n" -X DELETE "$BASE/webhooks/$ID/" -H "$AUTH"
    ;;

  *)
    echo "✗ unknown command '$CMD' — use: list | register <base_url> | test <id> | submissions <id> | delete <id>"
    exit 1
    ;;
esac
