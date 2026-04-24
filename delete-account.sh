#!/usr/bin/env bash
set -euo pipefail

EMAIL="${1:?Usage: ./delete-account.sh <email>}"

# Load ADMIN_SECRET from env or .env in the same directory as this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -z "${ADMIN_SECRET:-}" && -f "$SCRIPT_DIR/.env" ]]; then
    ADMIN_SECRET=$(grep -E '^ADMIN_SECRET=' "$SCRIPT_DIR/.env" | cut -d= -f2- | tr -d '"' | tr -d "'")
fi
if [[ -z "${ADMIN_SECRET:-}" && -f "$SCRIPT_DIR/Backend/.env" ]]; then
    ADMIN_SECRET=$(grep -E '^ADMIN_SECRET=' "$SCRIPT_DIR/Backend/.env" | cut -d= -f2- | tr -d '"' | tr -d "'")
fi

if [[ -z "${ADMIN_SECRET:-}" ]]; then
    echo "ERROR: ADMIN_SECRET not set." >&2
    echo "  Set it as an env var, or add ADMIN_SECRET=... to .env or Backend/.env" >&2
    exit 1
fi

API_URL="${API_URL:-http://localhost:3001}"

echo "============================================="
echo "  CradleHQ Account Deletion"
echo "============================================="
echo "  Email : $EMAIL"
echo "  API   : $API_URL"
echo "============================================="
echo ""

TMPFILE=$(mktemp)
HTTP_CODE=$(curl -s -o "$TMPFILE" -w "%{http_code}" \
    -X DELETE \
    -H "X-Admin-Secret: $ADMIN_SECRET" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$EMAIL\"}" \
    "$API_URL/admin/account")

BODY=$(cat "$TMPFILE")
rm -f "$TMPFILE"

if [[ "$HTTP_CODE" == "200" ]]; then
    echo "STATUS: SUCCESS"
    echo ""

    if command -v jq &>/dev/null; then
        echo "--- Rows deleted ---"
        echo "$BODY" | jq '.deleted'
        echo ""
        echo "--- Cloudinary cleanup ---"
        echo "$BODY" | jq '.cloudinary'
    else
        echo "$BODY"
    fi
    exit 0

elif [[ "$HTTP_CODE" == "404" ]]; then
    echo "STATUS: NOT FOUND — no account exists for $EMAIL"
    echo "$BODY"
    exit 1

else
    echo "STATUS: FAILED (HTTP $HTTP_CODE)"
    echo "$BODY"
    exit 1
fi
